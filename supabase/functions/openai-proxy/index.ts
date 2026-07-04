// ================================================================
// supabase/functions/openai-proxy/index.ts
// Screenshot OCR proxy — GPT-5.4 mini vision.
// Only ever called for screenshot uploads; text-only scans stay on
// DeepSeek via the separate deepseek-proxy function.
// OPENAI_API_KEY is read from Supabase Edge Function secrets at
// runtime (`supabase secrets set OPENAI_API_KEY=...`) — never embedded
// here or anywhere in client code.
// ================================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
                text: "Extract only the text messages from this screenshot. Return just the message text, nothing else.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${image}` },
              },
            ],
          },
        ],
        max_completion_tokens: 500,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return jsonResponse(
        { error: data?.error?.message || "OpenAI request failed" },
        openaiRes.status
      );
    }

    const text = (data?.choices?.[0]?.message?.content || "").trim();
    return jsonResponse({ text });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
