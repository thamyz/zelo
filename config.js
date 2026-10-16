// DeepSeek API key is stored in Supabase Edge Function secrets — never in client code.

// PostHog analytics (services/analytics.js). Paste the PROJECT API key here — it
// starts with "phc_" (PostHog > Project settings > Project API key). It is meant
// to live in the app, unlike a "phx_" personal API key, which is a secret and
// must never go in this file. Leave empty to keep analytics switched off.
// apiHost: US cloud is https://us.i.posthog.com, EU cloud is https://eu.i.posthog.com.
window.ZELO_POSTHOG = { apiKey: 'phc_D6xnjJe3Le5HAU4r64jvwNmitrzCFC7GdGd92EiPzQV8', apiHost: 'https://us.i.posthog.com' };
