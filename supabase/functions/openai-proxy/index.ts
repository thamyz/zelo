// ================================================================
// supabase/functions/openai-proxy/index.ts
// Screenshot OCR proxy — GPT-5.4 mini vision.
// Only ever called for screenshot uploads; text-only scans stay on
// DeepSeek via the separate deepseek-proxy function.
// OPENAI_API_KEY is read from Supabase Edge Function secrets at
// runtime (`supabase secrets set OPENAI_API_KEY=...`) — never embedded
// here or anywhere in client code.
//
// SECURITY: every call here costs real money (a GPT-5.4 mini vision
// request), and this endpoint's URL + the public anon key needed to
// reach it are both extractable from the shipped client bundle. Two
// gates were added on top of the original implementation:
//   1. requireUser() — rejects any caller who isn't a genuinely
//      signed-in Supabase user (the anon key alone no longer works;
//      SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are
//      auto-injected into every edge function by the platform, no
//      manual secret needed for these three).
//   2. checkRateLimit() — caps each signed-in user to a fixed number
//      of calls per rolling hour via the increment_rate_limit() RPC
//      (see supabase/migrations/20260923163151_rls_profiles_and_rate_limits.sql),
//      using the service_role client so it bypasses RLS as a trusted
//      backend call.
// ================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OPENAI_API_KEY         = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT_PER_HOUR = 20; // screenshot OCR is the costliest call in the app — generous above real usage, tight enough to blunt abuse

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Verifies the caller's own JWT (forwarded by zeloSupabase.functions.invoke())
// actually belongs to a signed-in user — not just anyone holding the
// public anon key, which by itself is not a per-user token and fails
// getUser(). Returns the user id, or null if unauthenticated.
async function requireUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await supabaseAuth.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Atomic per-user, per-hour counter via the increment_rate_limit() RPC —
// a single round trip avoids a check-then-write race between concurrent
// requests from the same user. Uses the service_role client since this
// table has no policies for any other role (see the migration).
async function checkRateLimit(userId: string): Promise<boolean> {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const windowStart = new Date();
  windowStart.setUTCMinutes(0, 0, 0); // top of the current UTC hour
  const { data, error } = await supabaseAdmin.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_fn: "openai-proxy",
    p_window_start: windowStart.toISOString(),
  });
  if (error) {
    // Fail CLOSED on an unexpected error here — a broken rate-limit
    // check should never become a free pass to spend unlimited money.
    console.error("rate limit check failed:", error);
    return false;
  }
  return (data as number) <= RATE_LIMIT_PER_HOUR;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const userId = await requireUser(req);
  if (!userId) {
    return jsonResponse({ error: "Sign in required." }, 401);
  }

  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
    return jsonResponse({ error: "Too many scans this hour — try again shortly." }, 429);
  }

  let payload: { image?: string; mimeType?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { image, mimeType } = payload;
  if (!image || !mimeType) {
    return jsonResponse({ error: "Missing image or mimeType" }, 400);
  }
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "OPENAI_API_KEY not configured" }, 500);
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "You are analyzing a chat screenshot. Read every message bubble visible in the conversation, top to bottom. For each one, decide who sent it by its side/color — the user's own messages are the right-aligned/colored bubbles, the other person's are the left-aligned/gray bubbles — and transcribe its exact text. " +
                  'Respond with ONLY a single JSON object, no markdown code fences, no explanation, in exactly this shape: {"found": true, "messages": [{"sender": "her", "text": "..."}, {"sender": "me", "text": "..."}]} — "sender" must be exactly "her" or "me" for every message, in the same top-to-bottom order they appear in the screenshot. Do not guess or invent a message that is not actually visible. ' +
                  'If the image does not show a real chat conversation — for example a random photo, a blank image, or anything with no actual visible messages — respond with exactly: {"found": false, "messages": []}',
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${image}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return jsonResponse(
        { error: data?.error?.message || "OpenAI request failed" },
        openaiRes.status
      );
    }

    const raw = (data?.choices?.[0]?.message?.content || "").trim();

    // response_format:json_object should already guarantee raw JSON, but
    // strip ```json fences defensively in case a model revision ever wraps
    // it anyway — cheap insurance against a hard parse failure.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: { found?: boolean; messages?: Array<{ sender?: string; text?: string }> } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Last resort: the model prefixed/suffixed the JSON with stray prose
      // despite the instructions — grab the outermost {...} span and retry
      // once before actually giving up.
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        return jsonResponse({ error: "Could not parse OCR response" }, 502);
      }
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return jsonResponse({ error: "Could not parse OCR response" }, 502);
      }
    }

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter((m) => m && typeof m.text === "string" && m.text.trim())
          .map((m) => ({
            sender: m.sender === "me" ? "me" : "her", // anything unrecognized defaults to "her" rather than dropping the message
            text: String(m.text).trim(),
          }))
      : [];

    if (parsed.found === false || messages.length === 0) {
      return jsonResponse({ found: false, messages: [] });
    }

    return jsonResponse({ found: true, messages });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
