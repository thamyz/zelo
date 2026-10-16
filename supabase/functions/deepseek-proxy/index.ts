// ================================================================
// supabase/functions/deepseek-proxy/index.ts
// DeepSeek chat-completions proxy — used for AI Coach replies, "generate
// a reply" suggestions, and DeepSeek-side scan-screenshot parsing (see
// script.js's zeloSupabase.functions.invoke('deepseek-proxy', ...) call
// sites). DEEPSEEK_API_KEY is read from Supabase Edge Function secrets
// at runtime (`supabase secrets set DEEPSEEK_API_KEY=...`) — never
// embedded here or anywhere in client code.
//
// SECURITY: every call here costs real money (a DeepSeek chat-
// completions request), and this endpoint's URL + the public anon key
// needed to reach it are both extractable from the shipped client
// bundle. This function previously forwarded the ENTIRE client-supplied
// JSON body verbatim to DeepSeek's API with no auth check, no rate
// limit, and no validation of what fields were even in that body.
// Three gates were added on top of the original implementation:
//   1. requireUser() — rejects any caller who isn't a genuinely
//      signed-in Supabase user (the anon key alone no longer works;
//      SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are
//      auto-injected into every edge function by the platform, no
//      manual secret needed for these three).
//   2. checkRateLimit() — caps each signed-in user to a fixed number
//      of calls per rolling hour via the increment_rate_limit() RPC
//      (see supabase/migrations/20260923163151_rls_profiles_and_rate_limits.sql),
//      using the service_role client so it bypasses RLS as a trusted
//      backend call. Set higher than openai-proxy's since this is the
//      everyday chat-reply path, not just screenshot scans.
//   3. Only the exact fields script.js ever actually sends (model,
//      messages, max_tokens, temperature) are forwarded — model is
//      pinned to 'deepseek-chat' and max_tokens is clamped, instead of
//      passing an arbitrary client-supplied body straight through to a
//      paid third-party API.
// ================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DEEPSEEK_API_KEY       = Deno.env.get("DEEPSEEK_API_KEY");
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT_PER_HOUR = 120; // chat replies + scan parsing all flow through here — generous for normal active use, still a hard ceiling
const MAX_TOKENS_CEILING  = 1000; // largest max_tokens any real call site sends is 320; this just stops an abusive value from ever reaching DeepSeek

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
    p_fn: "deepseek-proxy",
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

  // Availability probe for the AI Coach's red/green status pill (see
  // script.js's _probeZelo()). Still requires a signed-in user, but skips the
  // hourly counter and never spends tokens — it only asks DeepSeek whether
  // the account is reachable and funded (GET /user/balance is free).
  const probe = await req.clone().json().catch(() => null);
  if (probe && probe.health === true) {
    if (!DEEPSEEK_API_KEY) return jsonResponse({ ok: false }, 200);
    try {
      const r = await fetch("https://api.deepseek.com/user/balance", {
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      });
      const info = r.ok ? await r.json() : null;
      return jsonResponse({ ok: !!(info && info.is_available !== false) }, 200);
    } catch {
      return jsonResponse({ ok: false }, 200);
    }
  }

  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
    return jsonResponse({ error: "Too many requests this hour — try again shortly." }, 429);
  }

  let body: { model?: string; messages?: unknown; max_tokens?: number; temperature?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "Missing messages" }, 400);
  }
  if (!DEEPSEEK_API_KEY) {
    return jsonResponse({ error: "DEEPSEEK_API_KEY not configured" }, 500);
  }

  // Only forward the exact shape script.js ever sends — never the raw
  // client body — so an arbitrary/extra field a caller adds can't reach
  // DeepSeek's API through this proxy.
  const forwardBody = {
    model: "deepseek-chat", // the only model any call site ever requests; pinned rather than trusting the client's own value
    messages: body.messages,
    max_tokens: Math.min(Number(body.max_tokens) || 150, MAX_TOKENS_CEILING),
    temperature: typeof body.temperature === "number" ? body.temperature : 1.0,
  };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(forwardBody),
    });

    const data = await response.json();
    return jsonResponse(data, response.status);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
