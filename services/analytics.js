// PostHog product analytics, via @capawesome/capacitor-posthog (native iOS SDK
// through the Capacitor bridge — this app has no bundler, so it's reached as
// window.Capacitor.Plugins.Posthog like the other native plugins).
//
// PRIVACY CONTRACT: behavior events only. No message text, no chat content, no
// screenshots, no email/name — track() drops any event that isn't in EVENTS and
// any property that isn't allow-listed for that event, and only lets through
// numbers, booleans and short strings (so a sentence can't slip in by accident).
// Nobody is identify()'d: PostHog's own anonymous ID is the only identity.
//
// Inert until a PROJECT key ("phc_…") is set in config.js (window.ZELO_POSTHOG)
// and we're running inside the native app; in a browser it does nothing.
// A "phx_…" key is a personal/admin API key — it must never ship in an app, so
// it is refused.
const ZeloAnalytics = (() => {
  const EVENTS = {
    // Onboarding
    step_completed:            ['step'],
    step_abandoned:            ['step', 'time_spent_s'],
    onboarding_finished:       [],
    // Core feature usage
    scan_started:              ['source'],
    scan_completed:            ['source'],
    tone_selected:             ['tone'],
    reply_regenerated:         ['tone'],
    reply_favorited:           ['tone'],
    reply_shared:              ['tone'],
    reply_reported:            ['tone'],
    // Practice mode
    persona_selected:          ['persona_id'],
    practice_session_started:  ['mode', 'difficulty', 'resumed'],
    practice_session_ended:    ['duration_s', 'outcome'],
    // Gamification
    xp_earned:                 ['source', 'amount'],
    level_up:                  ['level'],
    streak_incremented:        ['days'],
    streak_broken:             ['days'],
    badge_earned:              ['badge_id'],
    // Monetization
    paywall_viewed:            ['screen', 'plan', 'price'],
    trial_started:             ['plan', 'price'],
    subscription_started:      ['plan', 'price'],
    restore_purchase_tapped:   [],
    payment_failed:            ['reason'],
    // Ads
    ad_watched:                [],
    ad_skipped:                [],
    // AI reliability / cost (numbers and short codes only — never a prompt or a reply)
    ai_request:                ['kind', 'ok', 'latency_ms', 'prompt_tokens', 'completion_tokens', 'model', 'error_kind'],
    reply_feedback:            ['outcome'],
    app_error:                 ['kind', 'name', 'where'],
    // App lifecycle
    app_opened:                [],
    app_backgrounded:          [],
    session_length:            ['duration_s'],
    // Referral
    referral_link_shared:      [],
    referral_signup_completed: [],
  };

  const MAX_STRING = 40;
  let _ready = null;          // promise; resolves true once setup() succeeded
  let _optedOut = false;
  let _fgSince = Date.now();

  function _plugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Posthog) || null;
  }

  function _clean(event, props) {
    const allowed = EVENTS[event];
    const out = {};
    if (!props) return out;
    for (const k of allowed) {
      const v = props[k];
      if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'number' && isFinite(v)) out[k] = Math.round(v * 100) / 100;
      else if (typeof v === 'string' && v.length > 0 && v.length <= MAX_STRING && !/[\r\n]/.test(v)) out[k] = v;
    }
    return out;
  }

  function track(event, props) {
    try {
      if (!(event in EVENTS) || !_ready || _optedOut) return;
      const properties = _clean(event, props);
      _ready.then(ok => {
        if (!ok) return;
        const p = _plugin();
        if (p) p.capture({ event, properties }).catch(() => {});
      });
    } catch (e) { /* analytics must never break the app */ }
  }

  function setOptOut(optedOut) {
    _optedOut = !!optedOut;
    const p = _plugin();
    if (!p || !_ready) return;
    _ready.then(ok => { if (ok) (_optedOut ? p.optOut() : p.optIn()).catch(() => {}); });
  }

  function init() {
    const cfg = window.ZELO_POSTHOG || {};
    const key = cfg.apiKey || '';
    const p = _plugin();
    _optedOut = localStorage.getItem('zelo_do_not_sell') === 'true';
    if (!key || !p) return;                       // not configured / not in the native app
    if (!/^phc_/.test(key)) {
      console.warn('[analytics] refusing to start: a PostHog project key starts with "phc_". ("phx_" keys are secret personal keys and must not be in the app.)');
      return;
    }
    _ready = p.setup({
      apiKey: key,
      apiHost: cfg.apiHost || 'https://us.i.posthog.com',
      optOut: _optedOut,
      enableSessionReplay: false,                 // would record the screen — never
      autoCaptureExceptions: false,
      captureApplicationLifecycleEvents: false,   // we send our own lifecycle events
      preloadFeatureFlags: false,
      surveys: false,
    }).then(() => true, () => false);

    track('app_opened');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        track('session_length', { duration_s: (Date.now() - _fgSince) / 1000 });
        track('app_backgrounded');
      } else {
        _fgSince = Date.now();
        track('app_opened');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { track, setOptOut, EVENTS };
})();
