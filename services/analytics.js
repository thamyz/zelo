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
    // 'style_variant' is the onboarding A/B arm (see _styleDemoVariant() in
    // script.js). It is auto-filled by setGlobal() on every event that
    // allow-lists it, so the funnel can be split by arm without each call
    // site remembering to pass it. It is a single letter, never content.
    step_completed:            ['step', 'style_variant'],
    step_abandoned:            ['step', 'time_spent_s', 'style_variant'],
    onboarding_finished:       ['style_variant'],
    style_demo_shown:          ['style_variant'],
    style_demo_picked:         ['style_variant', 'tone', 'position', 'repicked'],
    // Core feature usage
    scan_started:              ['source', 'style_variant'],
    scan_completed:            ['source', 'style_variant'],
    tone_selected:             ['tone', 'style_variant'],
    reply_regenerated:         ['tone'],
    reply_favorited:           ['tone'],
    reply_shared:              ['tone'],
    reply_reported:            ['tone'],
    // Practice mode
    persona_selected:          ['persona_id'],
    // 'drive_arm' (low|mid|high) is how much a medium/hard persona carries a
    // dying conversation — see DRIVE_LEVELS in script.js. 'left_after' is what
    // the chat was waiting on when the user left (a short fixed set of codes),
    // the counts are numbers; nothing here is message content.
    // boundary_warning / chat_blocked: a girl set a limit (1st, 2nd) / blocked the chat (3rd); nudge_sent: she texted after a quiet spell. Counts and the difficulty only.
    boundary_warning:          ['n', 'difficulty'],
    chat_blocked:              ['difficulty', 'user_msgs', 'drive_arm'],
    nudge_sent:                ['n', 'difficulty', 'drive_arm'],
    // chat_reported: the user reported an AI reply or a conversation. Reason code, scope and difficulty only; the conversation itself goes to Supabase, never to PostHog.
    chat_reported:             ['reason', 'scope', 'difficulty', 'drive_arm'],
    // support_sent: counts only (which form, and whether it was sent or queued). feature_requested: whether the request was held for review. Never any text.
    support_sent:              ['kind', 'result'],
    feature_requested:         ['held'],
    practice_session_started:  ['mode', 'difficulty', 'resumed', 'drive_arm'],
    practice_session_ended:    ['duration_s', 'outcome', 'drive_arm', 'difficulty', 'user_msgs', 'left_after', 'ack_turns', 'carried'],
    // Gamification
    xp_earned:                 ['source', 'amount'],
    level_up:                  ['level'],
    streak_incremented:        ['days'],
    streak_broken:             ['days'],
    badge_earned:              ['badge_id'],
    // Monetization
    paywall_viewed:            ['screen', 'plan', 'price', 'style_variant'],
    trial_started:             ['plan', 'price', 'style_variant'],
    subscription_started:      ['plan', 'price', 'style_variant'],
    restore_purchase_tapped:   [],
    payment_failed:            ['reason'],
    // Ads
    // AI reliability / cost (numbers and short codes only — never a prompt or a reply)
    ai_request:                ['kind', 'ok', 'latency_ms', 'prompt_tokens', 'completion_tokens', 'model', 'error_kind'],
    reply_feedback:            ['outcome'],
    app_error:                 ['kind', 'name', 'where'],
    // App lifecycle
    app_opened:                ['drive_arm'],
    app_backgrounded:          [],
    session_length:            ['duration_s', 'drive_arm'],
    // Referral
    referral_link_shared:      ['via'],   // 'instagram_native' | 'messages_native' | 'copy' | 'native_share' | 'redeemed'
    referral_signup_completed: [],
  };

  const MAX_STRING = 40;
  let _ready = null;          // promise; resolves true once setup() succeeded
  let _optedOut = false;
  let _fgSince = Date.now();

  function _plugin() {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Posthog) || null;
  }

  // Properties attached to every event that allow-lists them (experiment arm
  // and the like). They go through the exact same allow-list + type checks as
  // a passed-in property, so this can't be used to smuggle content through.
  const _globals = {};
  function setGlobal(key, value) {
    if (value == null || value === '') delete _globals[key];
    else _globals[key] = value;
  }

  function _clean(event, props) {
    const allowed = EVENTS[event];
    const out = {};
    const merged = Object.assign({}, _globals, props || {});
    for (const k of allowed) {
      const v = merged[k];
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

    // The arm is assigned in script.js (after this runs on a first launch), so
    // pick up one saved on an earlier launch now, or this launch's app_opened
    // would be the one event retention is measured from and it would lack it.
    try { const arm = localStorage.getItem('zelo_drive_arm'); if (arm) setGlobal('drive_arm', arm); } catch (e) {}
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

  return { track, setOptOut, setGlobal, EVENTS };
})();
