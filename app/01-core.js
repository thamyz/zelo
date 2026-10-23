// ================================================================
// 01-core.js — app bootstrap, loaded first; everything below assumes it ran
//
// Dark/light theme · the shared `state` object · the launch connectivity
// gate · the crash fallback screen · session-expired · and the main
// DOMContentLoaded start-up sequence that boots every other file.
// BUILD_STAMP is at the top of this file — bump it on every change.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// ================================================================
// ChatPractice — script.js
// ================================================================

// Bumped by hand right before every autopush.sh — an on-screen, unambiguous
// way to confirm which build is actually running on a device (see the
// small badge this drives, added after a round where a real build gap
// between "pushed" and "what Xcode actually installed" wasted several
// rounds of back-and-forth). Compare what's on screen to what was just
// pushed before trusting any "still broken" or "still not showing" report.
const BUILD_STAMP = "2026-10-23h (code reorganised: script.js -> app/, style.css -> css/; app itself unchanged)";
// Analytics must never be able to break the app: if services/analytics.js didn't load, every ZeloAnalytics call becomes a no-op.
if (typeof ZeloAnalytics === 'undefined') window.ZeloAnalytics = { track() {}, setOptOut() {} };
if (typeof ZeloRecords === 'undefined') window.ZeloRecords = { submitChatReport() { return Promise.resolve('queued'); }, flushReports() {}, recordConsent() {}, flushConsents() { return Promise.resolve(); }, saveGeneratedReply() { return null; }, markReplyCopied() {}, savePracticeSession() {}, queueOnboarding() {}, flushOnboarding() {}, setReplyOutcome() {}, logAiRequest() {}, syncPracticeConsent() { return Promise.resolve(); }, status() {} };
const SHOW_BUILD_STAMP = false;
window.addEventListener('DOMContentLoaded', () => {
  if (!SHOW_BUILD_STAMP) return;
  const b = document.createElement('div');
  b.id = 'zelo-build-stamp';
  b.dataset.base = 'build ' + BUILD_STAMP;
  b.textContent = b.dataset.base;
  b.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:999999;' +
    'font:9px monospace;color:rgba(0,0,0,0.35);pointer-events:none;' +
    'background:rgba(255,255,255,0.6);padding:1px 4px;border-radius:3px;';
  document.body.appendChild(b);
});

// ================================================================
// DARK MODE — one set of light/dark palettes lives in style.css
// (:root, then a prefers-color-scheme media query + a [data-theme]
// attribute override, in that order — see the comment there). This is
// just the JS side: read/write the user's choice, and flip the
// [data-theme] attribute that lets an explicit Light/Dark override the
// system setting (Settings > Personalization > Appearance). 'system' —
// the default — sets no attribute at all, so the CSS media query alone
// (which already tracks the OS live, no JS involved) is what's driving
// it; the matchMedia listener below exists only so anything JS-side that
// ever needs to know the *effective* theme has a live hook, matching the
// "real-time OS detection" behavior asked for.
const THEME_PREF_KEY = 'zelo_theme_pref'; // 'system' | 'light' | 'dark'

function getThemePref() {
  return localStorage.getItem(THEME_PREF_KEY) || 'system';
}

function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'light' || pref === 'dark') root.setAttribute('data-theme', pref);
  else root.removeAttribute('data-theme');
  applyDarkIconSet();
}

function setThemePref(pref) {
  localStorage.setItem(THEME_PREF_KEY, pref);
  applyTheme(pref);
}

function initTheme() {
  applyTheme(getThemePref());
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => { if (getThemePref() === 'system') applyTheme('system'); applyDarkIconSet(); };
  (mq.addEventListener ? mq.addEventListener.bind(mq) : mq.addListener.bind(mq))('change', onSystemChange);
}

// ---- Dark-mode icon set --------------------------------------------
// A chunk of this app's illustrated icons (badges, milestone category
// hexagons, a few hero images) bake a glossy highlight/ring meant to sit
// on a white page — no CSS can touch that, it's baked into the pixels.
// Rather than keep hand-editing the single shared file to be a compromise
// between both themes, each affected icon now has a real second file,
// "<name>-dark.png" next to the original, specifically cleaned up for a
// dark backdrop; light mode keeps the untouched original. This swaps an
// <img>'s src to the -dark sibling whenever dark mode is actually in
// effect (explicit override OR system preference), and back to the
// original otherwise — driven off ICONS_WITH_DARK_VARIANT below so it
// only ever touches files that actually have a sibling to swap to.
const ICONS_WITH_DARK_VARIANT = new Set([
  'assets/icons/aicoach-add/aicoach-add-paste.png',
  'assets/icons/aicoach-add/aicoach-add-upload.png',
  'assets/icons/aicoach-add/aicoach-add-link.png',
  'assets/icons/aicoach-add/aicoach-add-info.png',
  'assets/icons/mission/mission-chat.png',
  'assets/icons/mission/mission-envelope.png',
  'assets/icons/mission/mission-scan.png',
  'assets/icons/mission/mission-match.png',
  'assets/icons/mission/mission-trophy.png',
  'assets/icons/chats-page/chat-aicoach-icon.png',
  'assets/icons/chats-page/chat-send-icon.png',
  'assets/icons/chats-page/chat-settings-icon-mute.png',
  'assets/icons/chats-page/chat-settings-icon-reset.png',
  // Message long-press menu. All five have a -dark sibling, report
  // included: its glyph is red in both sheets, but the crop carries the
  // sheet's own white/black background with it, so it still has to swap.
  'assets/icons/chats-page/msg-menu/add.png',
  'assets/icons/chats-page/msg-menu/reply.png',
  'assets/icons/chats-page/chat-settings-sliders.png',
  'assets/icons/chats-page/msg-menu/copy.png',
  'assets/icons/chats-page/msg-menu/delete.png',
  'assets/icons/chats-page/msg-menu/report.png',
  'assets/icons/leaderboard/hero-podium-blank.png',
  'assets/icons/leaderboard/hero-podium.png',
  'assets/icons/leaderboard/lb-cat-level-hero-icon.png',
  'assets/icons/leaderboard/lb-cat-messages-hero-icon.png',
  'assets/icons/leaderboard/lb-cat-streak-hero-icon.png',
  'assets/icons/leaderboard/lb-cat-streak-icon.png',
  'assets/icons/leaderboard/widget-leaderboard-trophy.png',
  'assets/icons/misc/hero-mountain.png',
  'assets/icons/misc/hero-planet.png',
  'assets/icons/misc/journey-hero-flame.png',
  'assets/icons/misc/new-paywall.png',
  'assets/icons/misc/stat-this-week.png',
  'assets/icons/misc/stat-total-days.png',
  'assets/icons/onboarding/onb-achieve.png',
  'assets/icons/onboarding/onb-cloud.png',
  'assets/icons/onboarding/onb-gender-icon.png',
  'assets/icons/onboarding/onb-plan.png',
  'assets/icons/onboarding/onb-bell-body.png',
  'assets/icons/onboarding/onb-thanks-mascot.png',
  'assets/icons/onboarding/onb-thanks-badge.png',
  'assets/icons/onboarding/onb-achieve-convo.png',
  'assets/icons/onboarding/onb-achieve-examples.png',
  'assets/icons/onboarding/onb-achieve-progress.png',
  'assets/icons/onboarding/onb-bell-clapper.png',
  'assets/icons/tabs/chats-empty-icon.png',
  'assets/icons/misc/crash-connection-icon.png',
  'assets/icons/misc/crash-general-icon.png',
  'assets/icons/misc/session-expired-icon.png',
  'assets/icons/onboarding/onb-showcase-phone-frame.png',
  'assets/icons/onboarding/onb-thanks.png',
  'assets/icons/onboarding/onb-setup-chat.png',
  'assets/icons/onboarding/onb-setup-heart.png',
  'assets/icons/onboarding/onb-setup-target.png',
  'assets/icons/onboarding/onb-setup-sparkle.png',
  'assets/icons/onboarding/onb-setup-people.png',
  'assets/icons/onboarding/onb-plan-tone-playful.png',
  'assets/icons/onboarding/onb-plan-tone-chill.png',
  'assets/icons/onboarding/onb-plan-tone-direct.png',
  'assets/icons/onboarding/onb-plan-brain.png',
  'assets/icons/aicoach-topics/reply.png',
  'assets/icons/aicoach-topics/interest.png',
  'assets/icons/aicoach-topics/flirty.png',
  'assets/icons/aicoach-topics/advice.png',
  'assets/icons/reply-styles/bolder.png',
  'assets/icons/reply-styles/direct.png',
  'assets/icons/reply-styles/funny.png',
  'assets/icons/reply-styles/longer.png',
  'assets/icons/reply-styles/shorter.png',
  'assets/icons/reply-styles/smooth.png',
  'assets/icons/reply-styles/warmer.png',
  'assets/icons/settings/icon-pl-signout.png',
  'assets/icons/settings/settings2-data-request.png',
  'assets/icons/settings/settings2-icon-feature-request.png',
  'assets/icons/settings/settings2-data-preparing.png',
  'assets/icons/settings/settings2-data-email.png',
  'assets/icons/settings/settings2-help-chat.png',
  'assets/icons/settings/settings2-help-eye.png',
  'assets/icons/settings/settings2-help-gear.png',
  'assets/icons/settings/settings2-data-submitted.png',
  'assets/icons/streak/stat-best-streak.png',
  'assets/icons/streak/widget-streak-flame-small.png',
  'assets/icons/tabs/chats-tab-active.png',
  'assets/icons/xp-levels/level-tier-crown.png',
  'assets/icons/xp-levels/level-tier-crystal.png',
  'assets/icons/xp-levels/level-tier-planet.png',
  'assets/icons/xp-levels/level-tier-sprout.png',
  'assets/icons/xp-levels/level-tier-star.png',
  'assets/icons/xp-levels/xp-icon-conversation.png',
  'assets/icons/xp-levels/xp-icon-message.png',
  'assets/icons/xp-levels/xp-icon-quest.png',
  'assets/icons/xp-levels/xp-icon-rank.png',
  'assets/icons/xp-levels/xp-icon-refer.png',
  'assets/icons/xp-levels/xp-icon-revival.png',
  'assets/icons/xp-levels/xp-icon-scan.png',
  'assets/icons/xp-levels/xp-icon-streak.png',
  'assets/icons/xp-levels/xp-panel-planet.png',
  'assets/icons/xp-levels/xp-panel-star.png',
  'assets/icons/milestones/streak-1.png',
  'assets/icons/milestones/streak-2.png',
  'assets/icons/milestones/streak-3.png',
  'assets/icons/milestones/streak-4.png',
  'assets/icons/milestones/streak-5.png',
  'assets/icons/milestones/conversation-1.png',
  'assets/icons/milestones/conversation-2.png',
  'assets/icons/milestones/conversation-3.png',
  'assets/icons/milestones/conversation-4.png',
  'assets/icons/milestones/conversation-5.png',
  'assets/icons/milestones/progress-1.png',
  'assets/icons/milestones/progress-2.png',
  'assets/icons/milestones/progress-3.png',
  'assets/icons/milestones/progress-4.png',
  'assets/icons/milestones/progress-5.png',
  'assets/icons/milestones/explorer-1.png',
  'assets/icons/milestones/explorer-2.png',
  'assets/icons/milestones/explorer-3.png',
  'assets/icons/milestones/explorer-4.png',
  'assets/icons/milestones/explorer-5.png',
  'assets/icons/milestones/comeback-1.png',
  'assets/icons/milestones/comeback-2.png',
  'assets/icons/milestones/comeback-3.png',
  'assets/icons/milestones/comeback-4.png',
  'assets/icons/milestones/comeback-5.png',
  'assets/icons/milestones/social-1.png',
  'assets/icons/milestones/social-2.png',
  'assets/icons/milestones/social-3.png',
  'assets/icons/milestones/social-4.png',
  'assets/icons/milestones/social-5.png',
  'assets/icons/milestones/special-1.png',
  'assets/icons/milestones/special-2.png',
  'assets/icons/milestones/special-3.png',
  'assets/icons/milestones/special-4.png',
  'assets/icons/milestones/special-5.png',
  'assets/icons/milestones/texting-1.png',
  'assets/icons/milestones/texting-2.png',
  'assets/icons/milestones/texting-3.png',
  'assets/icons/milestones/texting-4.png',
  'assets/icons/milestones/texting-5.png',
  'assets/icons/milestones/digit-1.png',
  'assets/icons/milestones/digit-2.png',
  'assets/icons/milestones/digit-3.png',
  'assets/icons/milestones/digit-4.png',
  'assets/icons/milestones/digit-5.png',
  'assets/icons/milestones/digit-6.png',
  'assets/icons/milestones/digit-7.png',
  'assets/icons/milestones/digit-8.png',
  'assets/icons/milestones/digit-9.png',
  'assets/icons/milestones/digit-0.png',
  'assets/icons/milestones/hero-streak-flame.png',
  'assets/icons/milestones/hero-badge-gem.png',
]);

function isDarkModeActive() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Swaps every matching <img> currently in the DOM to its -dark sibling
// (or back), based on the CURRENT src rather than a stored "original" —
// safe to call repeatedly/idempotently from anywhere.
function _applyDarkIconOne(img) {
  const dark = isDarkModeActive();
  const src = img.getAttribute('src');
  if (!src) return;
  const isDarkVariant = src.endsWith('-dark.png');
  const baseSrc = isDarkVariant ? src.replace(/-dark\.png$/, '.png') : src;
  if (!ICONS_WITH_DARK_VARIANT.has(baseSrc)) return;
  const wantSrc = dark ? baseSrc.replace(/\.png$/, '-dark.png') : baseSrc;
  if (src !== wantSrc) img.setAttribute('src', wantSrc);
}

function applyDarkIconSet(root) {
  const scope = root || document;
  // querySelectorAll only searches DESCENDANTS, so a scope that's itself
  // an <img> (e.g. one whose .src was just reassigned directly, rather
  // than a new node being inserted) needs handling on its own.
  if (scope.tagName === 'IMG') { _applyDarkIconOne(scope); return; }
  const imgs = scope.querySelectorAll ? scope.querySelectorAll('img[src*="assets/icons/"]') : [];
  imgs.forEach(_applyDarkIconOne);
}

// Catches icons rendered later via innerHTML (badges, milestone icons,
// etc. are all built this way) without having to hook every render
// function individually.
function watchForNewIcons() {
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'attributes') {
        // An existing <img>'s src was reassigned directly (e.g.
        // `el.src = '...png'`), not inserted as a new node — the
        // childList branch below never sees this case.
        applyDarkIconSet(m.target);
        continue;
      }
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === 'IMG') applyDarkIconSet(node.parentNode || document);
        else if (node.querySelector && node.querySelector('img')) applyDarkIconSet(node);
      }
    }
  });
  observer.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['src'],
  });
}


// ================================================================
// APP STATE
// ================================================================

const state = {
  // Navigation
  activeTab:    "assistant",  // "assistant" | "practice"
  activeScreen: null,         // "profile" | "chat" | "match" | null
  screenStack:  [],           // screens pushed while another screen (not a tab) was active — popScreen() unwinds this before falling back to the tab

  // Practice session
  difficulty:   null,
  character:    null,
  mode:         "training",
  replyIndex:   0,
  pendingTimer: null,
  awaitingReply: false,

  // Swipe deck
  swipeProfiles: [],  // shuffled copy of PROFILES
  swipeIndex:    0,   // index of the current top card

  // Assistant
  asstStyle:        "smooth",
  asstCurrentSet:   null,  // cache: style → reply text, populated on demand
  asstFailedStyles: new Set(), // styles whose fetch failed (after one auto-retry) — shows a Retry card instead of the loading dots
  asstMessage:      "",    // message text for the current scan
  asstContext:      "",    // scanContextString() snapshot for the current scan
  scanContext:      {},    // ACTIVE who/situation/goal selection used for the pending scan
  tellzeloAnswers:  {},    // the "Other" (Tell Zelo More) wizard's own saved answers — persists
                           // across Dating/Crush taps; copied into scanContext on completion;
                           // only cleared once a scan actually finishes generating (see _onReplyRevealed())
  scanWhoCard:      null,  // which "Who's this about?" card is exclusively selected: 'dating' | 'crush' | 'other' | null
  tzStep:           0,     // current step in the Tell Zelo More flow
  eligibleStyles:   [],    // ordered styles for the current scan's Situation+Goal (see getEligibleStyles())
  currentStyleIndex: 0,    // index into eligibleStyles for the card currently shown

  // mode chosen per swipe-card profile (Open/Neutral), keyed by name
  cardModes: {},

  // Active chat id (for syncing to chatStore)
  activeChatId: null,

  // Which chat-mode option (if any) is mid-confirmation in the "Set the
  // pace" modal — null when neither card has been tapped yet.
  chatModePending: null,

  // Feature 5+6: active thread detail
  activeThreadId: null,
  threadChat:     [],    // [{role,content}] for Ask Zelo session

  // Feature 8: daytime silent gap (realistic mode, per session)
  silentGapStart: null,
  silentGapEnd:   null,

  // Thread pre-selected on the typing screen before analyzing
  preselectThreadId: null,

  // Result-screen save tracking (for Go Back reminder)
  scanSavedToThread: false,
  scanSkippedSave:   false,
};

// ================================================================
// LAUNCH CONNECTIVITY CHECK
// Runs in the BACKGROUND — nothing waits on it. The app used to sit behind a
// "Zelo" loading skeleton on every single launch until this network
// round-trip settled, which on a cold first launch (fresh install/update: no
// DNS/TLS cache, nothing warmed) was the slowest, most visible part of
// launching, for a check that passes the overwhelming majority of the time.
// Now the first screen (onboarding/Home) shows as soon as local init is done
// (see the zelo-app-ready flip in DOMContentLoaded below), and only if this
// check actually FAILS does #no-connection-screen come up over the top.
// The timeout is generous on purpose: since nothing is blocked on it, a slow
// cold-start check costs nothing, whereas a too-short one would throw a
// false "Connection issue" over an app that's actually online.
// ================================================================
const CONNECTIVITY_TIMEOUT_MS = 6000;

function _checkConnectivity() {
  // no-cors + a HEAD request: we only care whether the network round-trip
  // to our own backend completes at all, never read the response itself
  // (an opaque no-cors response can't be inspected, and doesn't need to be).
  const ping = () => fetch(SUPABASE_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    const timer = setTimeout(() => finish(false), CONNECTIVITY_TIMEOUT_MS);
    // One quick retry on a fast rejection (a single dropped request — real
    // networks do this even when perfectly fine) before treating it as an
    // actual outage — still well inside the overall timeout budget above.
    ping()
      .then(() => { clearTimeout(timer); finish(true); })
      .catch(() => {
        ping()
          .then(() => { clearTimeout(timer); finish(true); })
          .catch(() => { clearTimeout(timer); finish(false); });
      });
  });
}

// Tells the native shell (MainViewController.swift) the app has painted, so
// it can fade out the launch icon it keeps on top of the web view until now.
// No-op everywhere that isn't the iOS app (browser, Playwright, Netlify).
function _signalNativeReady() {
  try { window.webkit?.messageHandlers?.zeloReady?.postMessage(1); } catch (_) {}
}

// Resolves to true/false so retryConnectivityCheck() can react to the result.
function _runLaunchConnectivityGate(opts = {}) {
  const t0 = Date.now();
  return _checkConnectivity().then(async ok => {
    if (opts.minMs) await new Promise(r => setTimeout(r, Math.max(0, opts.minMs - (Date.now() - t0))));   // long enough for the loading bar to be seen
    const noConn = document.getElementById('no-connection-screen');
    const note = document.getElementById('no-connection-status');
    if (ok) {
      if (note) note.hidden = true;
      if (noConn) noConn.hidden = true;
      // Idempotent safety net: normally already set by DOMContentLoaded's
      // own init (see below), but if anything in that handler threw before
      // reaching that line, a passing check still lifts the app's gate.
      document.documentElement.classList.add('zelo-app-ready');
    } else {
      const first = !!(noConn && noConn.hidden);
      if (noConn) noConn.hidden = false;
      _revealLazyImages(noConn);
      if (first) { navigator.vibrate?.(15); _cineHaptic('MEDIUM'); _typewriteConnectionTitle(); }
      else {
        // A failed RETRY must not restart the screen (it used to re-type the whole title from empty): just say so.
        if (note) { note.textContent = "Still can't connect. Check your internet and try again."; note.hidden = false; }
        navigator.vibrate?.(8); _cineHaptic('LIGHT');
      }
    }
    return ok;
  });
}

// "Connection issue" only types itself out once _checkConnectivity() has
// actually finished (however long that took) and this screen is about to
// be shown — not pre-rendered as static text the instant the screen
// becomes visible. Self-chained (each character's setTimeout is scheduled
// only after the previous one actually ran, same pattern proven under a
// stall for cinePhase1()'s "Never freeze up again.") so it stays correct
// even if the device is under load right as this fires.
function _typewriteConnectionTitle() {
  const el = document.getElementById('no-connection-title');
  if (!el) return;
  const text = 'Connection issue';
  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent = text.slice(0, ++i);
      navigator.vibrate?.(1);
      setTimeout(tick, 38);
    }
  }
  tick();
}

// "Retry" button on #no-connection-screen.
// The screen stays up while the re-check runs (it used to swap back to the
// loading skeleton for that — gone now), with the button dimmed/disabled as
// the "working" feedback; a passing check hides the screen, a failing one
// re-types the title again so a still-failing retry visibly reacts.
function retryConnectivityCheck() {
  const noConn = document.getElementById('no-connection-screen');
  const btn = noConn && noConn.querySelector('.fallback-btn-primary');
  const bar = document.getElementById('no-connection-bar');
  const note = document.getElementById('no-connection-status');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
  if (bar) bar.hidden = false;
  if (note) note.hidden = true;
  _runLaunchConnectivityGate({ minMs: 800 }).finally(() => {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    if (bar) bar.hidden = true;
  });
}

// "Go to Home" on #no-connection-screen — an escape hatch for a false
// negative (captive portal, VPN quirk, a flaky check on a connection
// that's actually fine): proceeds into the app anyway rather than trapping
// someone behind a wrong verdict with no way out.
function _launchConnectivitySkip() {
  const noConn = document.getElementById('no-connection-screen');
  if (noConn) noConn.hidden = true;
  document.documentElement.classList.add('zelo-app-ready');
}

// ================================================================
// CRASH FALLBACK — global catch-all for an uncaught error/rejection
// anywhere in the app. Last resort, not a replacement for handling errors
// where they happen (e.g. Scan's own per-card retry) — this only fires
// for something that would otherwise leave the UI silently stuck.
// ================================================================
// Crash reporting (PostHog `app_error`): only the error's TYPE and WHERE it happened (function@file:line).
// The message text is deliberately never sent — it can echo user input.
function _reportJsError(err, file, line) {
  try {
    const name = String((err && err.name) || 'Error').slice(0, 30);
    let where = '';
    const frame = err && typeof err.stack === 'string' && err.stack.split('\n').find(l => /script\.js|auth\.js|records\.js/.test(l));
    const m = frame && frame.match(/(?:at\s+)?([\w$.<>]+)?[@(\s]*.*?([\w.]+\.js):(\d+)/);
    if (m) where = ((m[1] || '') + '@' + m[2] + ':' + m[3]).slice(0, 40);
    else if (file) where = (String(file).split('/').pop() + ':' + (line || '')).slice(0, 40);
    (window.__zeloErrLog = window.__zeloErrLog || []).push({ t: Date.now(), name, where });
    if (window.__zeloErrLog.length > 20) window.__zeloErrLog.shift();   // names only, for the problem-report log
    ZeloAnalytics.track('app_error', { kind: 'js', name, where });
  } catch (e) { /* the reporter must never throw */ }
}
window.addEventListener('error', (e) => { _reportJsError(e && e.error, e && e.filename, e && e.lineno); _showCrashScreen(); });
window.addEventListener('unhandledrejection', (e) => { _reportJsError(e && e.reason); _showCrashScreen(); });

// ── AI request wrapper: same result as functions.invoke, plus a cost/reliability log ──
// Logged (Supabase ai_requests + PostHog ai_request): which feature, model, token counts, how long it took,
// whether it failed and roughly why. NEVER the prompt or the reply.
function _aiErrorKind(error) {
  const st = error && error.context && error.context.status;
  if (st === 401 || st === 403) return 'auth';
  if (st === 429) return 'limit';
  if (!navigator.onLine || /failed to fetch|network|load failed/i.test(String((error && error.message) || ''))) return 'net';
  return 'server';
}
async function _aiInvoke(fn, options, kind) {
  const t0 = performance.now();
  let res;
  try { res = await zeloSupabase.functions.invoke(fn, options); } catch (e) { res = { data: null, error: e }; }
  try {
    const usage = (res.data && res.data.usage) || {};
    const ok = !res.error;
    const rec = {
      kind, model: (res.data && res.data.model) || (options && options.body && options.body.model) || (fn === 'openai-proxy' ? 'openai-vision' : null),
      promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens,
      latencyMs: performance.now() - t0, ok, errorKind: ok ? null : _aiErrorKind(res.error),
    };
    ZeloRecords.logAiRequest(rec);
    ZeloAnalytics.track('ai_request', { kind, ok, latency_ms: rec.latencyMs, prompt_tokens: rec.promptTokens, completion_tokens: rec.completionTokens, model: rec.model, error_kind: rec.errorKind });
  } catch (e) { /* logging must never break a request */ }
  return res;
}

let _crashScreenShown = false;
function _showCrashScreen() {
  // Once is enough — a second error while it's already up (or while the
  // page is about to reload from the first one) shouldn't re-trigger this.
  if (_crashScreenShown) return;
  _crashScreenShown = true;
  const el = document.getElementById('crash-general-screen');
  if (el) el.hidden = false;
  _revealLazyImages(el);
  navigator.vibrate?.(15); _cineHaptic('MEDIUM');
}

// "Go back" on the crash screen — a lighter recovery than a full reload:
// drop back to Practice (always safe/local, no network dependency) and
// hope whatever broke was scoped to the screen the user was actually on.
// "Try again" on the Oops screen. It used to be location.reload(): a full restart from zero. Now it stays
// on the page the user was on, shows the same loading bar, and repaints that page.
function retryCrashScreen() {
  const el = document.getElementById('crash-general-screen');
  const btn = el && el.querySelector('.fallback-btn-primary');
  const bar = document.getElementById('crash-bar');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
  if (bar) bar.hidden = false;
  setTimeout(() => {
    _crashScreenShown = false;
    if (el) el.hidden = true;
    if (bar) bar.hidden = true;
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    try {
      if (document.getElementById('screen-chat')?.classList.contains('active')) { _rerenderChatMessages(); _syncBlockedUI(); }
      else if (document.getElementById('screen-ai-coach')?.classList.contains('active')) renderAiCoachChat();
    } catch (_) { /* if repainting throws, the Oops screen simply comes back */ }
  }, 900);
}

function _crashGoBack() {
  const el = document.getElementById('crash-general-screen');
  if (el) el.hidden = true;
  _crashScreenShown = false;
  showTab('practice');
}

// ================================================================
// SESSION EXPIRED — called from services/auth.js's onAuthStateChange when
// SIGNED_OUT fires WITHOUT the user having tapped Sign Out themselves
// (token revoked/expired server-side mid-session).
// ================================================================
function showSessionExpiredScreen() {
  const el = document.getElementById('session-expired-screen');
  if (el) el.hidden = false;
  _revealLazyImages(el);
  navigator.vibrate?.(15); _cineHaptic('MEDIUM');
}

function _sessionExpiredSignIn() {
  const el = document.getElementById('session-expired-screen');
  if (el) el.hidden = true;
  AUTH.showEmailScreen ? AUTH.showEmailScreen() : location.reload();
}

function _sessionExpiredGoHome() {
  const el = document.getElementById('session-expired-screen');
  if (el) el.hidden = true;
  showTab('practice');
}

window.addEventListener('DOMContentLoaded', () => {
  // Background reachability check — nothing below waits on it (see the
  // LAUNCH CONNECTIVITY CHECK comment above); #app's own visibility gate is
  // lifted further down, right after onboarding has been set up.
  _runLaunchConnectivityGate();

  initTheme();
  _armLazyImageObserver();
  watchForNewIcons();
  AUTH.init(); // session check — must run before any auth triggers fire
  // TODO — merge anonymous scan history on signup

  _loadGibberishDictionary(); // preload word dictionary for fast gibberish detection

  ensureTrialStarted();
  pruneExpiredScans();        // retention enforced once per launch — see getThreads()
  initScanCountForToday();
  loadChats();                // practice conversations survive a relaunch
  initMatchSlots();           // Feature 7: restore expired deletion slots
  maybeShowWelcomeBack();     // returning users only — see NOTE above
  initOnboarding();
  // Onboarding overlay (or the returning-user path) is now in place, so
  // nothing can flash the default-visible Home tab anymore — safe to reveal
  // #app right now instead of waiting on the network (see the
  // html:not(.zelo-app-ready) rule in index.html's <head>).
  document.documentElement.classList.add('zelo-app-ready');
  _cineNextFrame(_signalNativeReady); // two frames later, once it has actually painted
  refreshScanLimitBanner();
  // Drop a stale AI Coach link if its thread no longer exists
  setLinkedThreadId(null); // AI Coach always starts a new chat on launch (see openAiCoach())
  refreshAiCoachCard();       // Fix 5: sync the AI Coach card dropdown label
  attachProfileDetailDragToClose(); // Fix 4: swipe-down to dismiss profile detail
  attachAiCoachHistoryDragClose(); // swipe-right to dismiss the AI Coach chat-history panel
  attachAiCoachHistorySwipeOpen(); // swipe-left (anywhere on the main screen) to open it, live, the exact reverse
  attachAiCoachRowActionsDragClose('aicoach-row-actions-overlay', closeAiCoachRowActions); // swipe-down on the row-actions sheet's own grey handle to dismiss it
  attachPracticeConfirmDragToClose(); // swipe-down on the confirm-profile sheet
  attachAiCoachChatSheetDragClose(); // swipe-down on AI Coach's own handle to dismiss it, when opened as a sheet from a chat (openAiCoachFromChat())
  _watchHerMessageBox(); // her-message bubble hugs its text on a fresh scan
  attachReplayBubbleHold(); // hold a bubble on Your Reply's replay to delete it
  attachAiCoachRowActionsDragClose('yr-tone-overlay', closeReplayToneSheet); // Your Reply's slide-up tone picker
  attachAiCoachRowActionsDragClose('history-row-actions-overlay', closeHistoryRowActions); // same sheet/gesture, History's own thread rename/delete
  attachAiCoachRowActionsDragClose('thread-link-overlay', closeThreadLinkPicker); // same sheet/gesture, "Link a thread" picker — only when its own list is scrolled to the top
  // rubber-band overscroll + swipe-to-navigate on Home/Scan/Chats. Home
  // excludes the swipe-card deck (#card-deck) — a drag started on a card
  // belongs to that card's own like/nope swipe, not the tab-nav gesture.
  attachTabSwipeGestures('practice', '#card-deck');
  // Scan excludes the widget carousel (#widget-carousel) the same way —
  // a drag started on it belongs to its own horizontal scroll-snap swipe,
  // not the tab-nav gesture. Without this, both gestures were reading the
  // same touch on the Scan tab at once: the tab-nav swipe still armed and
  // could visibly fight the carousel's native scroll, and on some drags
  // would leave the carousel's scroll position knocked back to card 1
  // regardless of which card was showing before the swipe.
  attachTabSwipeGestures('assistant', '#widget-carousel');
  attachTabSwipeGestures('chats');

  // Trackpad-style swipe-back — explicit allowlist only, everything else
  // in the app is untouched. Each entry reuses that screen's own existing
  // back/close function (see attachEdgeSwipeBack's own comment for why
  // nothing else is shared/created).
  attachEdgeSwipeBack('screen-dashboard',   popScreen);         // Account page (Settings 2.0 now lives here too, see below)
  attachEdgeSwipeBack('screen-refer-friends', closeReferFriends); // Refer Friends
  attachEdgeSwipeBack('screen-history',     closeHistory);      // History overlay
  attachEdgeSwipeBack('screen-chat',        exitChat, {         // Chat conversation — its header back button is plain exitChat() too
    excludeSelector: '.chat-settings-sheet, .chat-confirm-overlay, .chat-chips', // .chat-chips scrolls sideways — a drag there must scroll it, not swipe back to the Chats list; both sit as DOM children of screen-chat, so touches on them (Cancel, backdrop, rows) would otherwise still bubble into this same edge-swipe tracker
    // While the long-press menu is up it owns the screen — swiping back out
    // from under it would leave the menu floating over the wrong page.
    disabled: () => { const o = document.getElementById('msg-menu-overlay'); return !!o && !o.hidden; },
  });
  attachEdgeSwipeBack('screen-leaderboard', popScreen);         // Leaderboard — its header back button is plain popScreen() too
  attachEdgeSwipeBack('screen-tellzelo',    tellZeloBack, {     // "Other" wizard: mid-wizard the steps share this one screen, so the previous step is shown as a ghost copy underneath while this one is dragged away
    resolveTarget: () => state.tzStep > 0 ? _tzGhost(state.tzStep - 1) : _defaultBackRevealTarget(),
  });
  attachEdgeSwipeBack('screen-ai-coach', _aiCoachSwipeBack, {  // AI Coach — this only fires for a swipe starting on the
    // dimmed sliver still showing #aicoach-main when the history panel is open (a swipe starting on the panel/scrim
    // itself is handled entirely by attachAiCoachHistoryDragClose() instead, which stops it from ever reaching here).
    // The history panel is an overlay on THIS screen, not a separate pushed one, so state.screenStack doesn't know
    // it's open — first swipe closes the panel (no sibling screen to reveal — same "step back within the same
    // screen" pattern as screen-tellzelo above); once it's closed, a second swipe reveals History itself if this
    // AI Coach session was opened from a History row (see _captureHistoryReturn()/openAiCoach()), otherwise the
    // normal destination underneath.
    //
    // Opened as a sheet over a chat (openAiCoachFromChat()) — this whole
    // rightward-drag gesture is turned off entirely, in favor of the
    // vertical swipe-down-to-close gesture on this same element (see
    // attachAiCoachChatSheetDragClose()). Without this, both gestures would
    // process the same touch sequence independently, and the reveal-drag
    // below would also try to reparent the chat screen out from under
    // itself (it's already sitting right there, still active, underneath).
    disabled: () => _aiCoachChatSheetOpen,
    resolveTarget: () => {
      if (_aiCoachHistoryOpen) return null;
      if (_historyReturnTab) return document.getElementById('screen-history');
      return _defaultBackRevealTarget();
    },
  });
  attachEdgeSwipeBack('screen-scan-result', goBackFromResult, { // Scan Result / reply suggestions
    // goBackFromResult() shows a save-prompt instead of navigating unless
    // the scan was already saved/explicitly skipped — only reveal live
    // content when it would actually navigate. When this replay was opened
    // from AI Coach's own History entry, the back-press skips AI Coach
    // entirely (see _scanReplayViaAiCoachHistory), so reveal History itself
    // during the live drag instead of the AI Coach screen underneath.
    resolveTarget: () => {
      if (!(state.scanSavedToThread || state.scanSkippedSave)) return null;
      if (_scanReplayViaAiCoachHistory) return document.getElementById('screen-history');
      return _defaultBackRevealTarget();
    },
    // Same condition as resolveTarget()'s own null check — committing this
    // gesture while unsaved shows a sheet, it doesn't navigate, so don't
    // play the "slide fully away" exit motion for that case either.
    willNavigate: () => state.scanSavedToThread || state.scanSkippedSave,
    excludeSelector: '#reply-carousel',
  });
  attachEdgeSwipeBack('screen-scan-upload', popScreen);         // Upload Screenshot page
  attachEdgeSwipeBack('screen-journey', closeJourney);           // Your Journey (Streak widget)
  attachEdgeSwipeBack('screen-mission-control', closeMissionControl); // Mission Control (Activity widget)
  attachEdgeSwipeBack('screen-milestones', popScreen);           // Milestones hub
  // User/Account settings' own deep sub-pages (screen-dashboard's list ->
  // any of these) — every one already has a plain "back button calls
  // popScreen()" (verified in index.html), same as screen-milestones
  // above, so swiping back from any of them lands on whatever pushed it
  // (usually screen-dashboard's main settings list) exactly like tapping
  // its own back arrow would.
  // excludeSelector: the crop sheet's drag-to-pan and zoom slider are both horizontal-capable drags
  // living inside this same screen (position:fixed, but still a DOM descendant for event bubbling) —
  // without this, panning/zooming a photo could also be read as an edge-swipe-back, sliding the whole
  // screen away mid-crop. Reported as "everything turns grey" — that's this gesture's own dimming
  // scrim starting to show, not a bug in the crop UI's own colors.
  attachEdgeSwipeBack('screen-settings-profile-login',   popScreen, { excludeSelector: '.pl-crop-overlay' });
  attachEdgeSwipeBack('screen-settings-add-email',       popScreen);
  attachEdgeSwipeBack('screen-settings-forgot-password', popScreen);
  attachEdgeSwipeBack('screen-settings-personalization', popScreen);
  attachEdgeSwipeBack('screen-settings-tone-preview',    popScreen);
  attachEdgeSwipeBack('screen-settings-practice-prefs',  popScreen);
  attachEdgeSwipeBack('screen-settings-who-practice',    popScreen);
  // The age-range screen's own dual-handle slider lives on the left edge
  // of the screen (values start at 18), so a drag that starts on/near the
  // slider or its tick row must not also be read as an edge-swipe-back —
  // excluding that area here leaves swipe-back working everywhere else on
  // the screen (see settings2-agefilter-slider's tap-to-jump handler in
  // _wireAgeFilterTapToJump() for the other half of that touch area's
  // handling).
  attachEdgeSwipeBack('screen-settings-age-range',       popScreen, {
    excludeSelector: '#settings2-agefilter-slider, #settings2-agefilter-ticks',
  });
  attachEdgeSwipeBack('screen-settings-skipped-profiles', popScreen);
  attachEdgeSwipeBack('screen-settings-notifications',   popScreen);
  attachEdgeSwipeBack('screen-settings-zelo-pro',        popScreen);
  attachEdgeSwipeBack('screen-settings-privacy-data',    popScreen);
  attachEdgeSwipeBack('screen-settings-scan-retention',  popScreen);
  attachEdgeSwipeBack('screen-settings-download-data',   popScreen);
  attachEdgeSwipeBack('screen-settings-help-smarter',    popScreen);
  attachEdgeSwipeBack('screen-settings-delete-account',  popScreen);
  attachEdgeSwipeBack('screen-settings-ai-transparency', popScreen);
  attachEdgeSwipeBack('screen-settings-help-support',    popScreen);
  attachEdgeSwipeBack('screen-settings-feature-requests', popScreen);
  attachEdgeSwipeBack('screen-settings-feature-new',     popScreen);
  attachEdgeSwipeBack('screen-settings-feature-detail',  frDetailBack);
  attachEdgeSwipeBack('screen-settings-about',           popScreen);
  attachEdgeSwipeBack('screen-settings-terms',           popScreen);
  attachEdgeSwipeBack('screen-settings-privacy-policy',  popScreen);

  _wireWidgetCarousel();
});


// ================================================================
