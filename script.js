// ================================================================
// ChatPractice — script.js
// ================================================================
const DEV_MODE = false; // DEV — set to false before release

// Bumped by hand right before every autopush.sh — an on-screen, unambiguous
// way to confirm which build is actually running on a device (see the
// small badge this drives, added after a round where a real build gap
// between "pushed" and "what Xcode actually installed" wasted several
// rounds of back-and-forth). Compare what's on screen to what was just
// pushed before trusting any "still broken" or "still not showing" report.
const BUILD_STAMP = "2026-10-17b (generating card, option font, gibberish dictionary shipped)";
// Analytics must never be able to break the app: if services/analytics.js didn't load, every ZeloAnalytics call becomes a no-op.
if (typeof ZeloAnalytics === 'undefined') window.ZeloAnalytics = { track() {}, setOptOut() {} };
if (typeof ZeloRecords === 'undefined') window.ZeloRecords = { recordConsent() {}, flushConsents() { return Promise.resolve(); }, saveGeneratedReply() { return null; }, markReplyCopied() {}, savePracticeSession() {}, queueOnboarding() {}, flushOnboarding() {}, setReplyOutcome() {}, logAiRequest() {}, syncPracticeConsent() { return Promise.resolve(); }, status() {} };
const SHOW_BUILD_STAMP = true;
// TEMP (testing): show the "Help Zelo get smarter" modal on EVERY practice chat, ignoring the once-only
// memory, so its UI can be reviewed. Set to false before release.
const DEV_ALWAYS_SHOW_PRACTICE_REVIEW = false;
const DEV_AUTO_SIGN_IN = true;
const SUPPRESS_GIBBERISH_CHECK = false;
const FORCE_DEMO_SCAN_FOR_RECORDING = false; // screen-recording prep, reverted — real generation again
const SUPPRESS_XP_LEVEL_NOTIFS = true; // TEMP — no XP/Level-up popups anywhere for now; flip back to false to re-enable
// DEV — flip either of these to true, reload the app, review the screen,
// then flip back to false before shipping. Lets you see the launch
// No Connection screen or the loading dots → error/Retry card
// (Scan) on demand, without needing a real dropped connection to trigger
// them. See CLAUDE.md's Case Log for exactly which screen each one shows.
const FORCE_NO_CONNECTION_SCREEN = false;
const FORCE_SCAN_ERROR_CARD      = false;
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

  // mode chosen per swipe-card profile (Open/Neutral/Cold), keyed by name
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
  // DEV — see FORCE_NO_CONNECTION_SCREEN at the top of this file. Skips the
  // real network check but keeps a short delay, so the No Connection screen
  // appears a moment after launch — same pacing as a real failure, not an
  // instant jump-cut.
  if (FORCE_NO_CONNECTION_SCREEN) {
    return new Promise(resolve => setTimeout(() => resolve(false), 1000));
  }
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
function _runLaunchConnectivityGate() {
  return _checkConnectivity().then(ok => {
    const noConn = document.getElementById('no-connection-screen');
    if (ok) {
      if (noConn) noConn.hidden = true;
      // Idempotent safety net: normally already set by DOMContentLoaded's
      // own init (see below), but if anything in that handler threw before
      // reaching that line, a passing check still lifts the app's gate.
      document.documentElement.classList.add('zelo-app-ready');
    } else {
      if (noConn) noConn.hidden = false;
      _revealLazyImages(noConn);
      navigator.vibrate?.(15); _cineHaptic('MEDIUM');
      _typewriteConnectionTitle();
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
  if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
  _runLaunchConnectivityGate().finally(() => {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
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

async function _devAutoSignIn() {
  try {
    const { data } = await zeloSupabase.auth.getSession();
    if (data && data.session) return;
    const creds = window.ZELO_DEV_LOGIN;
    if (creds && creds.email && creds.password) {
      await zeloSupabase.auth.signInWithPassword({ email: creds.email, password: creds.password });
    } else {
      await zeloSupabase.auth.signInAnonymously();
    }
  } catch (_) { /* stay signed out — the AI status pill explains it */ }
}

window.addEventListener('DOMContentLoaded', () => {
  // Background reachability check — nothing below waits on it (see the
  // LAUNCH CONNECTIVITY CHECK comment above); #app's own visibility gate is
  // lifted further down, right after onboarding has been set up.
  _runLaunchConnectivityGate();

  // DEV — clear first-run keys on every load for testing. Remove before release.
  // NOTE: this wipes zelo_onboarding_done every load, so maybeShowWelcomeBack()
  // below never fires in dev (onboarding always looks "not done" first).
  // Comment this block out temporarily to test the welcome-back typewriter.
  localStorage.removeItem('zelo_onboarding_done');
  localStorage.removeItem('zelo_tour_seen');
  // The "Finding your type" quest starts from 0 on every launch, like the rest of this block.
  localStorage.removeItem('zelo_quest_likes');
  localStorage.removeItem('zelo_quest_done');
  localStorage.removeItem('zelo_quest_liked');
  // Onboarding + Home-tab answers start blank each run — nothing pre-chosen.
  localStorage.removeItem('zelo_practice_mode');
  localStorage.removeItem('zelo_mode_selected');
  localStorage.removeItem('zelo_age_range');
  localStorage.removeItem('zelo_display_name');
  localStorage.removeItem('zelo_onb_gender');
  localStorage.removeItem('zelo_user_age');
  localStorage.removeItem('zelo_age_pool');
  localStorage.removeItem('zelo_birthdate');
  localStorage.removeItem('zelo_profile_photo');
  localStorage.removeItem('zelo_onb_icebreaker');
  localStorage.removeItem('zelo_onb_struggle');
  localStorage.removeItem('zelo_onb_where');
  localStorage.removeItem('zelo_onb_stopping');
  localStorage.removeItem('zelo_onb_accomplish');
  localStorage.removeItem('zelo_default_tones');
  localStorage.removeItem('zelo_default_card_mode');
  localStorage.removeItem('zelo_decline_discount_shown');
  localStorage.removeItem('zelo_offer_shown');

  initTheme();
  _armLazyImageObserver();
  watchForNewIcons();
  // DEV — automatic sign-in on launch, no screen, no typing. Uses the
  // gitignored dev-credentials.js (window.ZELO_DEV_LOGIN = {email, password})
  // if present, else tries an anonymous session (works only if "Allow
  // anonymous sign-ins" is switched on in the Supabase dashboard). Skipped
  // when a session already exists. A failure here is silent: AI features just
  // show their normal "Sign in required" pill. Set DEV_AUTO_SIGN_IN to false
  // (and delete dev-credentials.js) before release.
  const _devSignedIn = DEV_AUTO_SIGN_IN ? _devAutoSignIn() : Promise.resolve();
  _devSignedIn.then(() => AUTH.init()); // session check — must run before any auth triggers fire
  // TODO — merge anonymous scan history on signup

  _loadGibberishDictionary(); // preload word dictionary for fast gibberish detection

  ensureTrialStarted();
  initScanCountForToday();
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
  attachEdgeSwipeBack('screen-tellzelo',    tellZeloBack, {     // "Other" wizard — mid-wizard steps back within the same screen (no sibling to reveal), so only fall back to a live reveal once back would actually exit
    resolveTarget: () => state.tzStep > 0 ? null : _defaultBackRevealTarget(),
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
  attachEdgeSwipeBack('screen-settings-profile-login',   popScreen);
  attachEdgeSwipeBack('screen-settings-add-email',       popScreen);
  attachEdgeSwipeBack('screen-settings-forgot-password', popScreen);
  attachEdgeSwipeBack('screen-settings-reset-sent',      popScreen);
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
  attachEdgeSwipeBack('screen-settings-contact-support', popScreen);
  attachEdgeSwipeBack('screen-settings-about',           popScreen);
  attachEdgeSwipeBack('screen-settings-terms',           popScreen);
  attachEdgeSwipeBack('screen-settings-privacy-policy',  popScreen);

  _wireWidgetCarousel();
});


// ================================================================
// NAVIGATION — two modes
//   showTab(name)    → switch between Assistant / Practice tabs
//   pushScreen(name) → overlay a full screen (profile, chat)
//   popScreen()      → return to whichever tab was active
// ================================================================

// Slides the frosted-glass pill (#tab-glass-pill) behind whichever of
// Practice/Chats is active, sized/positioned from that button's own live
// rect rather than hardcoded offsets. Scan keeps its own FAB treatment, so
// the pill just fades out for it instead of trying to wrap a circle.
// The indicator's resting height. A constant rather than pill.offsetHeight,
// so the value can never drift from whatever the element happens to measure
// at the moment it is read.
const TAB_PILL_REST_H = 52;

let _tabPillPlaced = false;

function updateTabGlassPill(name) {
  const pill = document.getElementById('tab-glass-pill');
  const bar = document.getElementById('tab-bar');
  if (!pill || !bar) return;
  // Scan ('assistant') used to be excluded here along with every non-tab
  // name, so the indicator vanished whenever Scan was selected. It now
  // tracks Scan too; anything that isn't a real tab button still hides it.
  const btn = document.getElementById('tabbtn-' + name);
  if (!btn) {
    pill.style.opacity = '0';
    return;
  }
  const barRect = bar.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const inset = 10;
  // Scan is the centre FAB, which would cover all but a sliver of the
  // indicator — so it keeps its shape and still travels to Scan's position,
  // but fades out on the way in and back in on the way out. The movement is
  // what reads: the glass goes to the middle, and later comes back out of
  // the middle towards whichever tab you picked, with nothing left sitting
  // awkwardly behind the button.
  const hideHere = !!btn.querySelector('.scan-fab');

  const w = btnRect.width - inset * 2;
  const h = TAB_PILL_REST_H;
  const x = btnRect.left - barRect.left + inset;

  const apply = () => {
    pill.style.width = w + 'px';
    pill.style.height = h + 'px';
    pill.style.transform = 'translateX(' + x + 'px)';
    pill.style.opacity = hideHere ? '0' : '1';
  };

  // The indicator rests at translateX(0) until it is first positioned. Now
  // that it also tracks Scan — which is the tab the app launches on — that
  // first placement would otherwise animate, sliding in from the bar's left
  // edge on every launch. Place it instantly the first time, then re-arm
  // the transition for real tab switches (the standard pattern in this
  // file: kill the transition, change, reflow, restore next frame).
  if (!_tabPillPlaced) {
    _tabPillPlaced = true;
    pill.style.transition = 'none';
    apply();
    void pill.offsetWidth;
    requestAnimationFrame(() => { pill.style.transition = ''; });
    return;
  }

  apply();
}
// ---- Drag across the tab bar -------------------------------------------------
// Press and drag (or hold, then drag) anywhere on the bar and the glass
// indicator follows the finger, stretching slightly like liquid, and glides
// to the nearest tab on release, which is then opened. A plain tap is
// untouched (the buttons' own onclick). The indicator dissolves as it passes
// under the Scan button, the same way it does when Scan is selected.
const TAB_DRAG_ORDER = ['practice', 'assistant', 'chats'];
let _tabDrag = null;

function _tabCenters() {
  const bar = document.getElementById('tab-bar');
  const br = bar.getBoundingClientRect();
  return TAB_DRAG_ORDER.map(n => {
    const r = document.getElementById('tabbtn-' + n).getBoundingClientRect();
    return r.left - br.left + r.width / 2;
  });
}

function _tabDragFrame() {
  const d = _tabDrag;
  if (!d || !d.moved) return;
  // Glide toward the finger rather than snapping to it, so picking the
  // indicator up never jumps, and quick flicks still read as fluid.
  d.x += (d.target - d.x) * 0.32;
  const w = d.w;
  d.pill.style.transform = `translateX(${d.x - w / 2}px) scale(1.1, 0.95)`;
  // Fade as it crosses Scan (centre of the bar).
  const scanC = d.centers[1];
  const near = Math.min(1, Math.abs(d.x - scanC) / (d.centers[2] - scanC) / 0.55);
  d.pill.style.opacity = String(Math.max(0, near));
  // Live "which tab would open" preview.
  let best = 0, bd = 1e9;
  d.centers.forEach((c, i) => { const dd = Math.abs(c - d.x); if (dd < bd) { bd = dd; best = i; } });
  if (best !== d.hot) {
    d.hot = best;
    TAB_DRAG_ORDER.forEach((n, i) => document.getElementById('tabbtn-' + n).classList.toggle('tab-btn--hot', i === best));
    _cineHaptic('LIGHT');
  }
  d.raf = requestAnimationFrame(_tabDragFrame);
}

function _tabDragEnd(commit) {
  const d = _tabDrag;
  if (!d) return;
  _tabDrag = null;
  cancelAnimationFrame(d.raf);
  const bar = document.getElementById('tab-bar');
  bar.classList.remove('tab-bar--dragging');
  TAB_DRAG_ORDER.forEach(n => document.getElementById('tabbtn-' + n).classList.remove('tab-btn--hot'));
  if (!d.moved) return;
  d.pill.style.transition = '';          // glide home with the normal transition
  const name = TAB_DRAG_ORDER[commit ? d.hot : TAB_DRAG_ORDER.indexOf(state.activeTab)] || state.activeTab;
  window.__tabDragClickBlockUntil = Date.now() + 400;   // the lift-off must not also fire a button click
  if (name === state.activeTab) updateTabGlassPill(name); else showTab(name);
}

function _initTabBarDrag() {
  const bar = document.getElementById('tab-bar');
  if (!bar || bar._dragWired) return;
  bar._dragWired = true;
  bar.addEventListener('touchstart', (e) => {
    const pill = document.getElementById('tab-glass-pill');
    const t = e.touches[0];
    _tabDrag = { sx: t.clientX, moved: false, pill, x: 0, target: 0, w: 0, centers: null, hot: -1, raf: 0 };
  }, { passive: true });
  bar.addEventListener('touchmove', (e) => {
    const d = _tabDrag; if (!d) return;
    const t = e.touches[0];
    if (!d.moved) {
      if (Math.abs(t.clientX - d.sx) < 8) return;
      d.moved = true;
      d.centers = _tabCenters();
      d.w = parseFloat(d.pill.style.width) || 64;
      // Start from where the indicator currently is (it is hidden on Scan, so
      // use that tab's centre in that case) — no jump on pick-up.
      const cur = d.centers[Math.max(0, TAB_DRAG_ORDER.indexOf(state.activeTab))];
      d.x = cur; d.target = cur;
      d.pill.style.transition = 'opacity 0.12s ease, width 0.25s ease, height 0.25s ease';
      bar.classList.add('tab-bar--dragging');
      _cineHaptic('LIGHT');
      d.raf = requestAnimationFrame(_tabDragFrame);
    }
    const br = bar.getBoundingClientRect();
    d.target = Math.min(d.centers[2], Math.max(d.centers[0], t.clientX - br.left));
    e.preventDefault();
  }, { passive: false });
  bar.addEventListener('touchend', () => _tabDragEnd(true));
  bar.addEventListener('touchcancel', () => _tabDragEnd(false));
  // Swallow the click that follows a drag.
  bar.addEventListener('click', (e) => {
    if (Date.now() < (window.__tabDragClickBlockUntil || 0)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
document.addEventListener('DOMContentLoaded', _initTabBarDrag);

window.addEventListener('resize', () => updateTabGlassPill(state.activeTab));

// Populates any <img data-src="..."> inside a screen/tab the moment it
// actually becomes active — not before. On cold launch (fresh install/
// update, nothing cached yet), every <img src="..."> in this file used to
// start downloading immediately regardless of which of the app's ~39
// screens it belonged to, because browsers' preload scanner fetches a real
// src attribute on sight and does NOT wait to find out the element is
// actually inside a hidden/display:none screen — confirmed by measuring
// under throttled conditions: 150+ unrelated icon requests (settings,
// badges, leaderboard, screens never opened yet) were saturating bandwidth
// and delaying script.js itself by over 15s. `loading="lazy"` alone did
// NOT fix this — its own deferral heuristic needs a real layout position to
// judge distance from viewport, which a display:none element doesn't have,
// so browsers fetch it eagerly anyway rather than risk never loading it.
// Stripping src down to data-src removes the browser's ability to eagerly
// fetch these at all; this is the one shared choke point every screen/tab
// transition already runs through (showTab/pushScreen/popScreen), so a
// single hook here covers all of them.
function _revealLazyImages(el) {
  if (!el) return;
  el.querySelectorAll('img[data-src]').forEach(img => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  });
}

// Safety net for _revealLazyImages(): this app has dozens of different
// "show a screen/overlay/sheet" functions beyond just showTab()/
// pushScreen()/popScreen() (History, the paywall, crash/session-expired
// fallbacks, sheet toggles, etc.) — hand-auditing every one of them across
// a file this size to make sure each calls _revealLazyImages() is exactly
// the kind of thing that's easy to miss once and silently ship a
// permanently-blank icon somewhere. This observes every data-src image up
// front; the moment ANY of them actually gets a real layout box within/near
// the viewport — which structurally can only happen once its containing
// screen stops being display:none, regardless of which code path did that
// — it reveals itself. Unlike the native loading="lazy" attribute (which
// eagerly fetches at parse time when it can't yet judge a hidden element's
// distance from the viewport — the exact failure mode measured here),
// there is no src on these elements yet for the browser to jump the gun
// on, so this is reliable rather than best-effort.
const _lazyImgObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
    _lazyImgObserver.unobserve(img);
  });
}, { rootMargin: '200px' });

function _armLazyImageObserver() {
  document.querySelectorAll('img[data-src]').forEach(img => _lazyImgObserver.observe(img));
}

function showTab(name) {
  // Locked (subscription ended): Home stays visible, every other tab is the paywall.
  if (name !== 'assistant' && subscriptionExpired()) { state.activeTab = 'assistant'; showLockedScreen(); return; }
  // Chats is never gated at the tab level — anonymous users with zero chat
  // history land on the tab's own empty state (see renderChatsList()) same
  // as Practice (Home); the auth check only happens when they actually try
  // to act (see homeModeSelect()).

  // History overlay keeps the tab bar visible — close it on any tab nav
  closeHistory();

  // Cancel any chat timer if leaving
  cancelPendingReply();

  // The tour drives its own tab switches; only end it when the user navigates
  // away on their own (e.g. tapping a tab mid-tour).
  const tour = document.getElementById('tour');
  if (tour && !tour.hidden && !tourSwitchingTab) endTour();

  // Hide all screens and tabs
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the tab
  const tabEl = document.getElementById("tab-" + name);
  tabEl.classList.add("active");
  _revealLazyImages(tabEl);

  // Update tab bar buttons
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById("tabbtn-" + name).classList.add("active");
  updateTabGlassPill(name);

  // Show tab bar
  document.getElementById("tab-bar").classList.remove("hidden");

  state.activeTab    = name;
  state.activeScreen = null;
  state.screenStack  = [];

  // Practice (Home) tab: first visit shows the tutorial (welcome screen →
  // swipe-right/swipe-left/photo-nav lessons — replaces the old "who do
  // you want to practice with" mode popup entirely); after that the deck
  // loads directly, no account required.
  if (name === 'practice') {
    _syncPracticeOnboardingChrome();
    if (!localStorage.getItem('zelo_mode_selected')) {
      startPracticeTutorial();
    } else {
      initSwipeDeck();
    }
  }
  if (name === 'chats') {
    renderChatsList();
    // TEMP — for review only, remove once checked: pop the level-up panel
    // every time the Chats tab opens, so it can be looked at without
    // needing a real match + real XP first.
    setTimeout(() => { const lvl = getLevelForXP(getXP()); showLevelUpPanel(lvl + 1, lvl); }, 200);
  }
  if (name === 'assistant') {
    maybeShowScanIntro();
    refreshScanLimitBanner();
    refreshScanWhoCards();
    checkGenerateReady();
  }
}

function pushScreen(name) {
  // Locked: only Settings and the Streak screens open; anything else is the paywall.
  if (subscriptionExpired() && !_lockedAllows(name)) { showLockedScreen(); return; }
  // The AI Coach chat sheet isn't a stacked screen: it keeps its own classes and a
  // full-screen backdrop. Pushing a screen over it (Your Reply from "View full
  // chat", for one) used to leave that backdrop sitting on top, invisibly, so every
  // tap hit it instead of the new screen's buttons. Close it first.
  if (_aiCoachChatSheetOpen && name !== 'ai-coach') closeAiCoachChatSheet();
  // Hide all tabs and screens
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the screen (covers everything including tab bar)
  const screenEl = document.getElementById("screen-" + name);
  screenEl.classList.add("active");
  _revealLazyImages(screenEl);

  // Hide tab bar
  document.getElementById("tab-bar").classList.add("hidden");

  // Remember what screen (if any) was showing before this one, so popScreen()
  // can return to it instead of always falling back to the base tab. Skip
  // the push if we're already on this screen — otherwise re-entering the
  // same screen (e.g. openDashboard() called while Account is already
  // showing) piles up redundant stack entries that corrupt later "back"s.
  if (state.activeScreen && state.activeScreen !== name) {
    state.screenStack.push(state.activeScreen);
  }
  state.activeScreen = name;
}

function popScreen() {
  const prevScreen = state.screenStack.pop();
  if (prevScreen) {
    document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));
    const screenEl = document.getElementById("screen-" + prevScreen);
    screenEl.classList.add("active");
    _revealLazyImages(screenEl);
    document.getElementById("tab-bar").classList.add("hidden");
    state.activeScreen = prevScreen;
  } else {
    // Nothing to unwind to — return to whichever tab was last active
    state.activeScreen = null;
    showTab(state.activeTab);
  }
}


// ================================================================
// PRACTICE: START / EXIT CHAT
// ================================================================

// Builds the large Instagram-DM-style profile block (photo/name/age) and
// inserts it as the first item in the scrollable thread — not a fixed
// header, so it scrolls away naturally like any other list item, with no
// animation or scroll-position tracking involved. Called right after
// #chat-messages is cleared, from both startChat() (new match) and
// openChatFromStore() (reopening a saved chat).
// Round profile picture (head-and-shoulders crop of the persona's master
// reference, 320px). Layered over the gradient + initial, which stay underneath
// as the fallback for personas without one or a failed load.
function _pfpUrl(p) {
  if (!p) return '';
  if (p.avatar) return p.avatar;
  const hit = (typeof GIRL_PROFILES !== 'undefined') && GIRL_PROFILES.find(x => x.id === p.id);
  return (hit && hit.avatar) || '';
}
function _pfpImgHTML(p) {
  const u = _pfpUrl(p);
  return u ? `<img class="pfp-img" src="${u}" alt="" decoding="async" onerror="this.remove()">` : '';
}

// ================================================================
// PERSONA PROFILE — Instagram-style page for each character
// ================================================================
// Opened by tapping her photo/name at the top of a chat or the little avatar
// beside her messages. A full-screen overlay that slides in over the chat
// (not a pushScreen), so the chat underneath stays the live screen and a reply
// that arrives while you browse still lands in it. Her four photos are the
// posts; captions come from personas-posts.js; the bio is what she's into.
let _ppProfile = null;

function _ppHash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _ppClean(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function _personaHandle(p) {
  const f = _ppClean(p.name), l = _ppClean(p.lastName), c = _ppClean((p.city || '').split(/[\s,]/)[0]);
  const h = _ppHash(p.id || p.name), n = (h % 90) + 10;
  const opts = l ? [`${f}.${l}`, `${f}_${l}`, `${f}${l[0]}.${n}`, `${f}.${l.slice(0, 3)}`]
                 : [`${f}.${c}`, `${f}_${n}`, `its.${f}`];
  return opts[h % opts.length];
}
function _personaStats(p) {
  const h = _ppHash('stats' + (p.id || p.name));
  return {
    posts: (p.photos || []).length,
    followers: (280 + h % 4200).toLocaleString('en-US'),
    following: (120 + (h >>> 7) % 780).toLocaleString('en-US'),
  };
}
function _personaPosts(p) {
  return (p.photos || []).map((src, i) => {
    const set = (src.match(/characters\/([a-z]\d{3})-/) || [])[1];
    const caps = (typeof PERSONA_POST_CAPTIONS !== 'undefined' && set && PERSONA_POST_CAPTIONS[set]) || [];
    return { src, caption: caps[i] || '' };
  });
}

const _PP_ICONS = {
  grid:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>',
  tagged: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4"/></svg>',
  check:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  camera: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

function _ppAvatar(p, cls) {
  const grad = `linear-gradient(145deg, ${p.gradientColors[0]}, ${p.gradientColors[1]})`;
  return `<div class="${cls}" style="background:${grad}">${p.initial || ''}${_pfpImgHTML(p)}</div>`;
}

function openPersonaProfile(profile) {
  const p = profile || state.character;
  const o = document.getElementById('pp-overlay');
  if (!p || !o) return;
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  _ppProfile = p;
  const handle = _personaHandle(p);
  const st = _personaStats(p);
  const posts = _personaPosts(p);
  const likes = (p.interests || []).map(x => x.toLowerCase()).join(' · ');
  const where = [ (p.occupation || '').trim(), (p.city || '').trim() ].filter(Boolean).join(' · ');
  document.getElementById('pp-handle').textContent = handle;
  document.getElementById('pp-feed-handle').textContent = handle;
  document.getElementById('pp-scroll').innerHTML = `
    <div class="pp-top">
      ${_ppAvatar(p, 'pp-avatar')}
      <div class="pp-top-right">
        <div class="pp-name">${_escapeHtml(p.name)}${p.age ? ', ' + p.age : ''}</div>
        <div class="pp-stats">
          <div><b>${st.posts}</b><span>posts</span></div>
          <div><b>${st.followers}</b><span>followers</span></div>
          <div><b>${st.following}</b><span>following</span></div>
        </div>
      </div>
    </div>
    <div class="pp-bio">
      ${where ? `<p class="pp-bio-meta">${_escapeHtml(where)}</p>` : ''}
      ${p.bio ? `<p class="pp-bio-text">${_escapeHtml(p.bio)}</p>` : ''}
      ${likes ? `<p class="pp-bio-likes"><span aria-hidden="true">♡</span> ${_escapeHtml(likes)}</p>` : ''}
    </div>
    <div class="pp-actions">
      <span class="pp-btn pp-btn--status">${_PP_ICONS.check} Matched</span>
      <button type="button" class="pp-btn" onclick="personaProfileMessage()">Message</button>
    </div>
    <div class="pp-tabs" role="tablist">
      <button type="button" class="pp-tab pp-tab--on" data-tab="grid" onclick="personaProfileTab('grid')" aria-label="Posts">${_PP_ICONS.grid}</button>
      <button type="button" class="pp-tab" data-tab="tagged" onclick="personaProfileTab('tagged')" aria-label="Tagged">${_PP_ICONS.tagged}</button>
    </div>
    <div class="pp-grid" id="pp-grid">
      ${posts.map((x, i) => `<button type="button" class="pp-cell" onclick="openPersonaPost(${i})" aria-label="Post ${i + 1}"><img src="${x.src}" alt="" loading="lazy" decoding="async"></button>`).join('')}
    </div>
    <div class="pp-empty" id="pp-tagged" hidden>
      <span class="pp-empty-ic">${_PP_ICONS.camera}</span>
      <p>No tagged photos yet</p>
    </div>`;
  document.getElementById('pp-feed-list').innerHTML = posts.map((x, i) => `
    <article class="pp-post" id="pp-post-${i}">
      <header class="pp-post-head">${_ppAvatar(p, 'pp-post-av')}<span><b>${handle}</b>${p.city ? `<i>${_escapeHtml(p.city)}</i>` : ''}</span></header>
      <img class="pp-post-img" src="${x.src}" alt="" loading="lazy" decoding="async">
      ${x.caption ? `<p class="pp-post-cap"><b>${handle}</b> ${_escapeHtml(x.caption)}</p>` : ''}
    </article>`).join('');
  document.getElementById('pp-scroll').scrollTop = 0;
  // Same trailing-spacer trick as the other pages, so the profile always drags
  // and bounces even though four photos fit on one screen.
  const _ppGo = () => _ensureScrollableOverflow(document.getElementById('pp-scroll'), 56);
  requestAnimationFrame(() => requestAnimationFrame(_ppGo)); setTimeout(_ppGo, 400);
  const panel = document.getElementById('pp-panel');
  panel.style.transition = ''; panel.style.transform = '';
  o.hidden = false;
  void o.offsetWidth;
  requestAnimationFrame(() => o.classList.add('pp-overlay--in'));
  _cineHaptic('LIGHT');
}

function personaProfileTab(tab) {
  document.querySelectorAll('#pp-scroll .pp-tab').forEach(t => t.classList.toggle('pp-tab--on', t.dataset.tab === tab));
  document.getElementById('pp-grid').hidden = tab !== 'grid';
  document.getElementById('pp-tagged').hidden = tab !== 'tagged';
  setTimeout(() => _ensureScrollableOverflow(document.getElementById('pp-scroll'), 56), 30);
}

function closePersonaProfile() {
  const o = document.getElementById('pp-overlay');
  if (!o || o.hidden) return;
  closePersonaFeed(true);
  const panel = document.getElementById('pp-panel');
  panel.style.transition = ''; panel.style.transform = '';
  o.classList.remove('pp-overlay--in');
  setTimeout(() => {
    o.hidden = true;
    // Let the decoded photos go — four 1080x1350 images are ~22 MB of bitmap.
    document.getElementById('pp-scroll').innerHTML = '';
    document.getElementById('pp-feed-list').innerHTML = '';
  }, 340);
}

// "Message" goes back to her chat: closes the profile if we came from it,
// otherwise opens the chat from the Chats store.
function personaProfileMessage() {
  const p = _ppProfile;
  const inChat = document.getElementById('screen-chat')?.classList.contains('active') && state.character && p && state.character.id === p.id;
  closePersonaProfile();
  if (inChat || !p) return;
  const chat = chatStore.find(c => c.profile && c.profile.id === p.id);
  if (chat) setTimeout(() => openChatFromStore(chat), 200);
}

function openPersonaPost(i) {
  const feed = document.getElementById('pp-feed');
  feed.style.transition = ''; feed.style.transform = '';
  feed.hidden = false;
  const list = document.getElementById('pp-feed-list');
  const target = document.getElementById('pp-post-' + i);
  list.style.scrollBehavior = 'auto';
  // offsetTop is measured from the feed panel, not the list, so take the list's own offset off.
  list.scrollTop = target ? target.offsetTop - list.offsetTop : 0;
  void feed.offsetWidth;
  requestAnimationFrame(() => feed.classList.add('pp-feed--in'));
}

function closePersonaFeed(instant) {
  const feed = document.getElementById('pp-feed');
  if (!feed || feed.hidden) return;
  feed.style.transition = ''; feed.style.transform = '';
  feed.classList.remove('pp-feed--in');
  if (instant) { feed.hidden = true; return; }
  setTimeout(() => { feed.hidden = true; }, 320);
}

// Swipe right to go back (anywhere on the page, like the rest of the app):
// the page follows the finger and either slides away or springs back.
function _attachPersonaSwipe(el, onClose) {
  if (!el || el._ppSwipe) return;
  el._ppSwipe = true;
  let x0 = 0, y0 = 0, dx = 0, mode = null, t0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; t0 = Date.now(); }, { passive: true });
  el.addEventListener('touchmove', e => {
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      mode = (mx > 0 && Math.abs(mx) > Math.abs(my) * 1.2) ? 'h' : 'v';
      if (mode === 'h') el.style.transition = 'none';
    }
    if (mode !== 'h') return;
    dx = Math.max(0, mx);
    el.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  const end = () => {
    if (mode !== 'h') { mode = null; return; }
    mode = null;
    const fast = dx > 40 && (Date.now() - t0) < 250;
    el.style.transition = '';
    if (dx > el.clientWidth * 0.3 || fast) {
      el.style.transform = 'translateX(100%)';
      setTimeout(onClose, 10);
    } else {
      el.style.transform = '';
    }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}
document.addEventListener('DOMContentLoaded', () => {
  _attachPersonaSwipe(document.getElementById('pp-panel'), closePersonaProfile);
  _attachPersonaSwipe(document.getElementById('pp-feed'), () => closePersonaFeed());
});

function _renderChatProfileHeader(character) {
  const messagesEl = document.getElementById("chat-messages");
  const block = document.createElement("div");
  block.className = "chat-profile-block";

  const photo = document.createElement("div");
  photo.className = "chat-profile-photo";
  photo.style.background = character.gradientColors
    ? `linear-gradient(145deg, ${character.gradientColors[0]}, ${character.gradientColors[1]})`
    : character.color;
  photo.innerHTML = `${character.initial}${_pfpImgHTML(character)}`;

  // Name + age on one line, one font — same "Name, Age" pattern already
  // used for swipe cards and chat list rows elsewhere in the app.
  const name = document.createElement("h2");
  name.className = "chat-profile-name";
  name.id = "chat-profile-name";
  name.textContent = character.age != null ? `${character.name}, ${character.age}` : character.name;

  // Instagram-DM style "View profile" pill under her name.
  const view = document.createElement('button');
  view.type = 'button';
  view.className = 'chat-profile-view-btn';
  view.textContent = 'View profile';
  block.append(photo, name, view);
  // Only the three parts open her profile (the block spans the full width, so a
  // handler on it made empty space either side of her photo a hit target).
  [photo, name, view].forEach(el => {
    el.classList.add('chat-profile-hit');
    el.setAttribute('data-open-profile', '');
    el.onclick = (e) => { e.stopPropagation(); openPersonaProfile(character); };
  });
  messagesEl.appendChild(block);
}

// Analytics: a practice session = from opening a chat to leaving it. "finished"
// = the user sent at least PRACTICE_FINISHED_MIN_MSGS messages in it; anything
// shorter is "abandoned" (chats have no built-in end state to key off).
const PRACTICE_FINISHED_MIN_MSGS = 5;
let _practiceSince = 0, _practiceMsgs0 = 0, _practiceIdx0 = 0;
function _practiceUserMsgCount() {
  const c = chatStore.find(x => x.id === state.activeChatId);
  return c ? c.messages.filter(m => m.sender !== 'ai').length : 0;
}
function _trackPracticeStart(resumed) {
  _practiceSince = Date.now();
  _practiceMsgs0 = _practiceUserMsgCount();
  const c0 = chatStore.find(x => x.id === state.activeChatId);
  _practiceIdx0 = c0 ? c0.messages.length : 0; // this session's messages start here
  ZeloAnalytics.track('practice_session_started', { mode: state.mode, difficulty: state.difficulty, resumed });
}
// background = the app is being sent away (e.g. to check Supabase) mid-chat: save what has been said so far
// and keep going, so the rows exist without having to leave the chat. A chat that is backgrounded and
// resumed is stored as one row per stretch (each with its own messages), never duplicated.
function _trackPracticeEnd(background) {
  if (!_practiceSince) return;
  const sent = _practiceUserMsgCount() - _practiceMsgs0;
  const outcome = sent >= PRACTICE_FINISHED_MIN_MSGS ? 'finished' : 'abandoned';
  const chat = chatStore.find(x => x.id === state.activeChatId);
  if (background && !(chat && chat.messages.length > _practiceIdx0)) return; // nothing new to save yet
  if (!background) ZeloAnalytics.track('practice_session_ended', { duration_s: (Date.now() - _practiceSince) / 1000, outcome });
  // Database: metadata always; the chat text ONLY if the user opted in (practiceReviewOn()).
  ZeloRecords.savePracticeSession({
    personaId: state.character && state.character.id, difficulty: state.difficulty, mode: state.mode,
    startedAt: _practiceSince, endedAt: Date.now(), messageCount: sent, outcome,
    messages: chat ? chat.messages.slice(_practiceIdx0) : [], includeText: practiceReviewOn(),
  });
  if (background) {
    // keep tracking: the next save covers only what is said from here on
    _practiceSince = Date.now();
    _practiceMsgs0 = _practiceUserMsgCount();
    _practiceIdx0 = chat ? chat.messages.length : 0;
    return;
  }
  _practiceSince = 0;
}

document.addEventListener('visibilitychange', () => { if (document.hidden) _trackPracticeEnd(true); });

// ---- Opener suggestions above the composer --------------------------------
// Shown only in a chat the user hasn't written in yet. Built from the
// persona's own interests and job, so each one is specific to her; tapping one
// puts a ready-to-edit line in the message box (it never sends by itself).
const _chipSets = Object.create(null);

function _article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }

function _chipsFor(p) {
  // Plain greetings, written the way people actually text them — lowercase, no
  // exclamation marks, no "how are you today".
  return [
    { label: 'Say hey',              text: 'hey' },
    { label: 'Ask about her day',    text: "hey how's your day been" },
    { label: "Ask what she's up to", text: 'hi what are you up to today' },
  ];
}

// Before she has been written to: just a quiet "Need an opener?" link (tapping it
// reveals the static, profile-based openers). Once the conversation is going,
// the suggestions are generated from it — see _fetchSuggestions().
const _openerOpened = Object.create(null);

function _fillComposer(text) {
  const input = document.getElementById('message-input');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  _cineHaptic('LIGHT');
}
function _chipEl(label, text, extra) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chat-chip' + (extra ? ' ' + extra : '');
  b.textContent = label;
  if (text != null) b.onclick = () => _fillComposer(text);
  return b;
}

function _renderChatChips() {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  const p = state.character;
  const fresh = p && !document.querySelector('#chat-messages .msg-row.user');
  wrap.dataset.mode = '';
  if (!fresh) { _cancelSuggestions(); wrap.hidden = true; wrap.innerHTML = ''; return; }
  wrap.innerHTML = '';
  const key = p.id || p.name;
  if (!_openerOpened[key]) {
    const b = _chipEl('Need an opener?', null, 'chat-chip--link');
    b.onclick = () => { _openerOpened[key] = true; _cineHaptic('LIGHT'); _renderChatChips(); };
    wrap.appendChild(b);
  } else {
    _chipsFor(p).forEach(c => wrap.appendChild(_chipEl(c.label, c.text)));
  }
  wrap.hidden = false;
  wrap.scrollLeft = 0;
}

// ---- Conversation-aware suggestions ---------------------------------------
// After she replies and the user has been idle for a few seconds, one small AI
// call reads the recent conversation and offers three things to send next.
// Cheap by design: one call per message of hers, last 6 messages only, ~120
// output tokens, cached per message, capped per chat per day, never while the
// user is typing or she is mid-reply, and silently falls back to static chips.
const SUGG = { idleMs: 6000, perChatPerDay: 15, refreshGapMs: 3000, history: 6, maxTokens: 130 };
let _suggTimer = null, _suggGen = 0, _suggLastRefresh = 0;
const _suggCache = Object.create(null);

function _suggBudgetKey(chatId) { return `zelo_sugg_${chatId}_${new Date().toISOString().slice(0, 10)}`; }
function _suggUsed(chatId) { return parseInt(localStorage.getItem(_suggBudgetKey(chatId)) || '0', 10) || 0; }

function _cancelSuggestions() { clearTimeout(_suggTimer); _suggTimer = null; _suggGen++; }

function _scheduleSuggestions() {
  clearTimeout(_suggTimer);
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const last = chat && chat.messages[chat.messages.length - 1];
  if (!last || last.sender === 'user' || !_chatIsLive(chat.id)) return;
  _suggTimer = setTimeout(() => _fetchSuggestions(false), SUGG.idleMs);
}

function _renderSuggestions(list, msgId) {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.dataset.mode = 'ai';
  list.forEach(c => wrap.appendChild(_chipEl(c.label, c.text)));
  const r = document.createElement('button');
  r.type = 'button';
  r.className = 'chat-chip chat-chip--refresh';
  r.setAttribute('aria-label', 'New ideas');
  r.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  r.onclick = () => {
    if (Date.now() - _suggLastRefresh < SUGG.refreshGapMs) return;
    _suggLastRefresh = Date.now();
    _cineHaptic('LIGHT');
    r.classList.add('chat-chip--spin');
    _fetchSuggestions(true);
  };
  wrap.insertBefore(r, wrap.firstChild);   // first, so it is never pushed off-screen by long labels
  wrap.hidden = false;
  wrap.classList.remove('chat-chips--in'); void wrap.offsetWidth; wrap.classList.add('chat-chips--in');
  wrap.scrollLeft = 0;
}

// Models write texts that read as written-by-a-model: exclamation marks,
// em dashes, tidy full stops, capital letters, emoji. Texts between people
// don't look like that, so strip it back whatever the model returned.
function _humanizeText(t) {
  t = String(t)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{200d}\u{fe0f}]/gu, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, '')
    .replace(/\.\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.toLowerCase();   // people texting rarely capitalise anything
}

// Hold her message -> "Get hints": skeleton pills straight away, then the
// ideas for that message (instant if they were already fetched).
function _renderSuggestionSkeleton() {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  wrap.innerHTML = [118, 92, 136].map(w => `<span class="chat-chip chat-chip--skel" style="width:${w}px" aria-hidden="true"></span>`).join('');
  wrap.dataset.mode = 'ai';
  wrap.classList.remove('chat-chips--in');   // its chipIn animation would replace the shimmer
  wrap.hidden = false;
  wrap.scrollLeft = 0;
}
function requestHintsFor(msgId) {
  clearTimeout(_suggTimer);
  if (!_suggCache[msgId]) _renderSuggestionSkeleton();
  _fetchSuggestions(false, msgId);
}

function _parseSuggestions(raw) {
  try {
    const m = String(raw).match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : raw);
    return arr.filter(x => x && typeof x.label === 'string' && typeof x.text === 'string')
      .map(x => ({ label: x.label.trim().slice(0, 36), text: _humanizeText(x.text).slice(0, 140) }))
      .filter(x => x.label && x.text).slice(0, 3);
  } catch (_) { return []; }
}

async function _fetchSuggestions(isRefresh, focusId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat || !_chatIsLive(chat.id) || state.awaitingReply) return;
  const input = document.getElementById('message-input');
  const manual = !!focusId;                                      // asked for from the hold menu
  if (!manual && input && input.value.trim()) return;            // they are already writing
  const last = focusId ? chat.messages.find(m => m.id === focusId) : chat.messages[chat.messages.length - 1];
  if (!last || last.sender === 'user') return;
  if (!isRefresh && _suggCache[last.id]) { _renderSuggestions(_suggCache[last.id], last.id); return; }
  if (_suggUsed(chat.id) >= SUGG.perChatPerDay) {
    if (manual) _renderSuggestions(_chipsFor(chat.profile), last.id);   // out of hints today: plain ones rather than nothing
    return;
  }

  const p = chat.profile;
  const gen = ++_suggGen;
  const convo = chat.messages.slice(-SUGG.history).map(m => `${m.sender === 'user' ? 'You' : p.name}: ${m.text}`).join('\n');
  const goal = _userGoalHint();
  const messages = [
    { role: 'system', content: [
      'You write the next text for someone who is messaging a girl they matched with. Give 3 different options.',
      'Reply with ONLY a JSON array of exactly 3 objects: {"label": "<2-4 word plain description, e.g. ask about it / tease her / share yours>", "text": "<the text itself>"}.',
      'THE TEXTS MUST SOUND LIKE A REAL PERSON TYPING ON THEIR PHONE, NOT AN AI: all lowercase is fine, short, sometimes just a fragment, no exclamation marks, no emojis, no em dashes, no full stops at the end. Use "lol", "haha", "wait", "ok but", "lowkey" only if natural. Never "That is so cool", "amazing", "I would love to hear", "how about you", "I am curious". No compliments as filler. Do not repeat or summarise what she said back to her.',
      'Pick up the specific thing she just said and react to it the way a friend would: reuse one of her own words, tease lightly, ask one real question, or say something small about themselves that connects. Make the 3 different in kind and in length (one can be 2-4 words, none over 12).',
      'Base EVERYTHING on what has actually been said in this conversation. Do not use or invent facts about her life, photos or profile; if little has been said, build on her last message.',
      'Bad: "That sounds amazing! What do you love most about it?"  Good: "wait you actually do that for a living"  Bad: "Haha that is so funny! How was your day?"  Good: "ok that is genuinely unhinged lol".',
    ].join(' ') },
    { role: 'user', content: [
      `The other person is ${p.name}, ${p.age}.`,
      goal ? `Background on the user (never mention it): ${goal}` : '',
      'Recent conversation:', convo,
      last !== chat.messages[chat.messages.length - 1] ? `Write the ideas as replies to this specific message of hers: "${last.text}"` : '',
    ].filter(Boolean).join('\n') },
  ];
  try {
    const { data, error } = await _aiInvoke('deepseek-proxy', {
      body: { model: 'deepseek-chat', messages, max_tokens: SUGG.maxTokens, temperature: 1.0 }
    }, 'suggest');
    if (error) throw new Error(error.message);
    localStorage.setItem(_suggBudgetKey(chat.id), String(_suggUsed(chat.id) + 1));
    const list = _parseSuggestions(data.choices[0].message.content);
    if (gen !== _suggGen || !_chatIsLive(chat.id)) return;       // moved on while it was thinking
    if (!manual && input && input.value.trim()) return;
    if (list.length < 2) throw new Error('unusable suggestions');
    _suggCache[last.id] = list;
    _renderSuggestions(list, last.id);
  } catch (_) {
    if (gen !== _suggGen || !_chatIsLive(chat.id)) return;
    // Offline / bad reply: the static, profile-based chips, so the row is never empty.
    if (manual || !(input && input.value.trim())) _renderSuggestions(_chipsFor(p), last.id);
  }
}

function startChat() {
  const c = state.character;
  awardXP('conversation');


  document.getElementById("chat-messages").innerHTML = "";
  _renderChatProfileHeader(c);
  scrollToBottom(); // no messages yet, but still patches in the scroll-spacer so v-scroll isn't dead on a fresh chat
  _clearStagedReply(); // defensive — nothing should be staged entering a brand-new chat
  _renderChatChips();
  _syncComposerButtons();
  setSendEnabled(false);

  // Reached via the "It's a Match" overlay (Send a Message) — drop 'match'
  // from the stack chat is about to push onto rather than letting it ride
  // along: pressing back from a fresh chat should return straight to the
  // practice deck, not re-show "It's a Match"/"Keep Swiping" first.
  if (state.activeScreen === 'match') state.activeScreen = null;
  pushScreen("chat");
  bindDevPaceToggle();
  _trackPracticeStart(false);

  // Every brand-new chat asks once, with no way to dismiss without choosing.
  // Reopening an existing chat goes through openChatFromStore() instead,
  // which never calls startChat() — so this never reappears for that chat.
  state.chatModePending = null;
  updateChatModeOptionUI();
  document.getElementById("chat-mode-modal-name").textContent = c.name;
  document.getElementById("chat-mode-modal").hidden = false;
}

// Copy for each option's two states: its normal label/desc, and the
// in-place confirmation prompt shown after the first tap.
const CHAT_MODE_TEXT = {
  training: {
    label:        "Instant replies",
    desc:         "She responds right away",
    confirmLabel: "Confirm instant replies?",
    confirmDesc:  "She'll respond right away."
  },
  realistic: {
    label:        "Realistic timing",
    desc:         "Her responses are delayed",
    confirmLabel: "This takes longer. Confirm?",
    confirmDesc:  "Replies will be delayed. This can't be undone."
  }
};

// First tap on an option flips that card into a confirmation prompt
// in place; the other card stays tappable so the user can switch instead.
// A second tap on the already-flipped card locks the choice in.
function handleChatModeOptionClick(mode) {
  if (state.chatModePending === mode) {
    selectChatMode(mode);
    return;
  }
  state.chatModePending = mode;
  updateChatModeOptionUI();
}

function updateChatModeOptionUI() {
  ['training', 'realistic'].forEach(mode => {
    const t       = CHAT_MODE_TEXT[mode];
    const btnEl   = document.getElementById('chat-mode-btn-'  + mode);
    const labelEl = document.getElementById('chat-mode-label-' + mode);
    const descEl  = document.getElementById('chat-mode-desc-'  + mode);
    if (!btnEl) return;

    const confirming = state.chatModePending === mode;
    labelEl.textContent = confirming ? t.confirmLabel : t.label;
    descEl.textContent  = confirming ? t.confirmDesc  : t.desc;
    btnEl.classList.toggle('confirming', confirming);
  });
}

// Locks the reply-timing mode for this conversation, then reveals the chat
// and sends the opening message. Called only from the second confirming tap.
function selectChatMode(mode) {
  state.mode = mode;
  state.chatModePending = null;

  if (state.activeChatId) {
    const chat = chatStore.find(c => c.id === state.activeChatId);
    if (chat) chat.mode = mode;
  }


  document.getElementById("chat-mode-modal").hidden = true;
  setTimeout(maybeShowPracticeReviewModal, 350); // first practice chat only, after the pace is chosen

  const diff = state.difficulty;
  const openerText = (state.character && state.character.opener) || OPENINGS[diff];
  const openingDelay = mode === "training" ? 700 : 1500;
  setTimeout(() => {
    const openerId = syncChatToStore(openerText, 'ai');
    appendAIBubble(openerText, undefined, { id: openerId });
    setSendEnabled(true);
    // No auto-focus here either — same reasoning as the mid-conversation
    // reply path below: her message arriving shouldn't pop the keyboard
    // open on its own.
  }, openingDelay);
}

function closeRealisticIntro() {}

function openChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (!sheet) return;
  const cid = state.character?.id || state.character?.name;
  const muteToggle = document.getElementById('chat-settings-mute-toggle');
  if (muteToggle) muteToggle.checked = cid ? localStorage.getItem('chat_muted_' + cid) === 'true' : false;
  clearTimeout(_chatSettingsHideTimer);
  sheet.hidden = false;
  _initChatSettingsSwipeDown();
  // Slides up (and the backdrop fades in) instead of appearing at once: the base
  // CSS keeps it off-screen, and a frame later --in releases it.
  sheet.classList.remove('chat-settings-sheet--in');
  void sheet.offsetWidth;
  requestAnimationFrame(() => sheet.classList.add('chat-settings-sheet--in'));
}
let _chatSettingsHideTimer = null;

// Long-press entry point from the Chats list (see renderChatsList()) — same
// sheet as the in-chat "⋮" menu, just without navigating into the
// conversation first. Reset/Delete/Mute all read off state.activeChatId/
// state.character rather than anything screen-specific, so pointing those
// at the held row's chat and reusing openChatSettings() as-is is enough;
// the sheet itself was moved out of #screen-chat specifically so it's
// visible/interactive while the Chats tab, not the chat screen, is active.
function openChatSettingsForRow(chatId) {
  const chat = chatStore.find(c => c.id === chatId);
  if (!chat) return;
  state.activeChatId = chat.id;
  state.character    = chat.profile;
  state.difficulty   = chat.difficulty;
  state.mode         = chat.mode;
  openChatSettings();
}

// Drag-down-to-dismiss on the sheet itself — tied to live drag position
// (translateY + fading opacity follow the finger, not an instant toggle),
// matching how every other drag dismissal in this app behaves. Attached
// once (guarded by _swipeDownAttached) and reset on every open() in case a
// previous drag left inline styles from a released-but-under-threshold drag.
let _chatSettingsSwipeState = null;
function _initChatSettingsSwipeDown() {
  const wrap = document.querySelector('.chat-settings-sheet-wrap');
  if (!wrap) return;
  wrap.style.transition = '';
  wrap.style.transform = '';
  wrap.style.opacity = '';
  if (wrap._swipeDownAttached) return;
  wrap._swipeDownAttached = true;

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    _chatSettingsSwipeState = { startY: e.touches[0].clientY, dy: 0 };
    wrap.style.transition = 'none';
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (!_chatSettingsSwipeState) return;
    const dy = Math.max(0, e.touches[0].clientY - _chatSettingsSwipeState.startY);
    _chatSettingsSwipeState.dy = dy;
    wrap.style.transform = `translateY(${dy}px)`;
    wrap.style.opacity = String(Math.max(0, 1 - dy / 260));
  }, { passive: true });

  const finish = () => {
    if (!_chatSettingsSwipeState) return;
    const dy = _chatSettingsSwipeState.dy;
    _chatSettingsSwipeState = null;
    wrap.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
    if (dy > 70) {
      closeChatSettings();
    } else {
      wrap.style.transform = '';
      wrap.style.opacity = '';
    }
  };
  wrap.addEventListener('touchend', finish);
  wrap.addEventListener('touchcancel', finish);
}

// "View Profile" row in the chat settings sheet.
function chatSettingsViewProfile() {
  closeChatSettings();
  setTimeout(() => openPersonaProfile(state.character), 220);
}

function closeChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (!sheet || sheet.hidden) return;
  // Hand the panel back to the stylesheet so it carries on from wherever a
  // swipe left it, down off-screen, rather than jumping.
  const wrap = sheet.querySelector('.chat-settings-sheet-wrap');
  if (wrap) { wrap.style.transition = ''; wrap.style.transform = ''; wrap.style.opacity = ''; }
  sheet.classList.remove('chat-settings-sheet--in');
  clearTimeout(_chatSettingsHideTimer);
  _chatSettingsHideTimer = setTimeout(() => { sheet.hidden = true; }, 320);
}

// Generic centered confirm card (see .chat-confirm-overlay) — reset/delete
// both route through this instead of firing immediately.
let _chatConfirmAction = null;
function _showChatConfirm(title, body, actionLabel, onConfirm) {
  document.getElementById('chat-confirm-title').textContent = title;
  document.getElementById('chat-confirm-body').textContent = body;
  document.getElementById('chat-confirm-action-btn').textContent = actionLabel;
  _chatConfirmAction = onConfirm;
  document.getElementById('chat-confirm-overlay').hidden = false;
}
function chatConfirmCancel() {
  document.getElementById('chat-confirm-overlay').hidden = true;
  _chatConfirmAction = null;
}
function chatConfirmProceed() {
  document.getElementById('chat-confirm-overlay').hidden = true;
  const fn = _chatConfirmAction;
  _chatConfirmAction = null;
  if (fn) fn();
}

function confirmChatSettingsReset() {
  closeChatSettings();
  _showChatConfirm("Reset chat?", "This clears the whole conversation and starts fresh. This can't be undone.", "Reset", chatSettingsReset);
}
function confirmChatSettingsDelete() {
  closeChatSettings();
  _showChatConfirm("Delete chat?", "This permanently deletes this conversation. This can't be undone.", "Delete", chatSettingsDelete);
}

function chatSettingsMuteToggle(value) {
  const cid = state.character?.id || state.character?.name;
  if (cid) localStorage.setItem('chat_muted_' + cid, String(value));
}

function chatSettingsReset() {
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
  const cid = state.character?.id || state.character?.name;
  if (cid) {
    localStorage.removeItem('chat_' + cid);
    delete state.chatHistory;
  }
  const resetChat = chatStore.find(c => c.id === state.activeChatId);
  if (resetChat) resetChat.messages = [];
  abortPendingReply(); // the thread is about to be wiped — a reply still in flight must not land in it
  _clearStagedReply();
  setSendEnabled(false);
  const resetOpenerText = (state.character?.opener) || OPENINGS[state.difficulty] || 'hey';
  const openerId = syncChatToStore(resetOpenerText, 'ai');
  appendAIBubble(resetOpenerText, undefined, { id: openerId });
  setSendEnabled(true);
  renderChatsList(); // updates the list row's preview text if it's the visible screen (e.g. reset via long-press there)
  _renderChatChips();
}

function chatSettingsDelete() {
  closeChatSettings();
  const cid = state.character?.id || state.character?.name;
  if (cid) localStorage.removeItem('chat_' + cid);
  // This only ever cleared the localStorage cache and navigated away —
  // it never actually removed the chat from chatStore (the array
  // renderChatsList()/onDeleteChat() are the source of truth for), so
  // "Delete Chat" here didn't actually delete it from the Chats list.
  // Now matches onDeleteChat()'s own removal + re-render.
  const idx = chatStore.findIndex(c => c.id === state.activeChatId);
  if (idx >= 0) chatStore.splice(idx, 1);
  renderChatsList();
  exitChat();
}

function exitChat() {
  _cancelSuggestions();
  _trackPracticeEnd();
  cancelPendingReply();
  // Same defensive clear as closeAiCoach() — see its comment. Instant
  // (no ease-back) — this is leaving the screen entirely, so any animated
  // settle here reads as "the screen moves by itself" during a navigation
  // that should hold completely still.
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  if (_restoreHistoryReturn()) return;
  if (state.screenStack.length > 0) { popScreen(); return; }
  // If we came from chats tab, return there; otherwise practice
  const returnTab = state.activeTab === 'chats' ? 'chats' : 'practice';
  showTab(returnTab);
}


// Composer's AI Coach entry point — opens as a bottom sheet over the still-
// visible chat, pre-loaded with a read-only replay of THIS chat's own live
// messages (see renderAiCoachChat()'s _aiCoachChatSheetOpen branch), rather
// than the full-page navigation + separate scan-thread-linking system used
// by the Home tab card / History row (openAiCoach()). chatStore's live
// practice matches were never wired into that thread-linking concept
// (zelo_threads is Scan-saved conversation logs, a different store), so
// this reads chatStore directly instead of going through getLinkedThread().
function openAiCoachFromChat() {
  _aiCoachChatSheetOpen = true;
  _aiCoachAutoThreadId = null;
  if (document.activeElement
    && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  _aiCoachChat = [];
  renderAiCoachChat();
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  aiCoachRemovePhoto();
  toggleAiCoachHistoryPanel(false);
  const limit = document.getElementById('aicoach-limit');
  if (limit) limit.hidden = true;

  const screen = document.getElementById('screen-ai-coach');
  const backdrop = document.getElementById('aicoach-chat-sheet-backdrop');
  screen.classList.add('active', 'aicoach-sheet-open');
  backdrop.hidden = false;
  // Added a frame apart on purpose: .aicoach-sheet-open alone (see
  // style.css) rests at transform:translateY(100%), so the browser paints
  // that off-screen position first — adding .aicoach-sheet-visible next
  // frame is what actually triggers the slide-up transition, instead of the
  // sheet just appearing already open with nothing to animate.
  requestAnimationFrame(() => {
    screen.classList.add('aicoach-sheet-visible');
    backdrop.classList.add('aicoach-sheet-visible');
  });
}

// Closes the chat-sheet presentation above, back to the chat screen
// underneath — which was never actually hidden (see openAiCoachFromChat()).
// Mirrors closeAiCoach()'s own exit bookkeeping (autosave/unlink) but skips
// popScreen() entirely: this sheet was never pushed onto state.screenStack,
// so popping it here would incorrectly pop the CHAT screen's own prior entry
// instead.
function closeAiCoachChatSheet() {
  if (!_aiCoachChatSheetOpen) return;
  _autoSaveAiCoachChatOnExit();
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  const screen = document.getElementById('screen-ai-coach');
  const backdrop = document.getElementById('aicoach-chat-sheet-backdrop');
  screen.classList.remove('aicoach-sheet-visible');
  backdrop.classList.remove('aicoach-sheet-visible');
  _aiCoachChatSheetOpen = false;
  _aiCoachScanSheet = false;
  setTimeout(() => {
    // By this point the sheet has already slid down to translateY(100%),
    // fully off-screen. Removing .aicoach-sheet-open here resets `top` from
    // 11% back to .screen's plain 0 and drops the translateY with it — an
    // instant snap, since nothing in .aicoach-sheet-open transitions `top`.
    // But .screen's OWN base rule (`transition: opacity 0.18s ease`, not
    // scoped to .active) still applies independently of any of that, so the
    // very same tick's .active removal fades opacity 1→0 over that 0.18s —
    // and for that whole fade, the element is already back to its full-
    // screen shape, not the sheet's. That's the flash: a full-screen glimpse
    // of AI Coach fading in over the chat right as it's supposed to have
    // already fully closed. Suppressing the transition for this one cleanup
    // swap (same fix already used for the equivalent bug in
    // attachEdgeSwipeBack()'s finish()) makes it an instant, invisible
    // state correction instead of a visible fade.
    screen.style.transition = 'none';
    screen.classList.remove('active', 'aicoach-sheet-open');
    screen.style.transform = ''; // clears any leftover drag-gesture inline transform
    backdrop.hidden = true;
    void screen.offsetHeight; // flush the above before re-arming transitions
    requestAnimationFrame(() => { screen.style.transition = ''; });
  }, 320); // matches the CSS slide transition duration in style.css
}

// Swipe-down-to-dismiss anywhere on the chat-sheet, not just its drag
// handle — attached to the whole #screen-ai-coach (the handle is a
// descendant, so touches starting on it are covered too by the same
// listener; no separate handler needed there). Only actually arms while
// _aiCoachChatSheetOpen (the normal full-page AI Coach never gets this).
//
// #aicoach-messages is real scrollable content though — a downward drag
// there is ambiguous (could mean "scroll up to earlier messages" just as
// easily as "close the sheet"), so a drag starting inside it only arms once
// it's already scrolled to the top, same established pattern as
// attachProfileDetailDragToClose() elsewhere in this app. Anywhere else on
// the sheet (header, suggestions panel, input bar, footer) arms immediately.
//
// This runs alongside the generic attachEdgeSwipeBack('screen-ai-coach', ...)
// registered above, which listens for horizontal (rightward) drags on this
// same element — that registration's own `disabled` check bails out
// entirely while the sheet is open (see its own comment), so only this
// vertical gesture is ever actually live at once; no fighting over the
// same touch sequence.
function attachAiCoachChatSheetDragClose() {
  const screen = document.getElementById('screen-ai-coach');
  const messagesEl = document.getElementById('aicoach-messages');
  if (!screen) return;

  const DRAG_DEADZONE = 6;
  let startY = 0, dragging = false, committed = false, dy = 0;

  function onStart(clientY, target) {
    if (!_aiCoachChatSheetOpen) return;
    // The conversation never arms the close-drag, at any scroll position.
    // Gating it on "only while scrolled to the top" still meant a downward
    // drag to pull older messages into view closed the sheet instead of
    // scrolling, which is exactly what the user hit. There's plenty of
    // other surface to close from — the header, the suggestions panel, the
    // input bar and the footer all still arm immediately.
    if (messagesEl && messagesEl.contains(target)) return;
    startY = clientY;
    dragging = true;
    committed = false;
    dy = 0;
  }
  function onMove(clientY, e) {
    if (!dragging) return;
    const rawDy = clientY - startY;
    if (!committed) {
      if (rawDy < DRAG_DEADZONE) return; // still within the tap deadzone, or an upward drag — leave it alone entirely
      committed = true;
      screen.style.transition = 'none';
    }
    dy = Math.max(0, rawDy);
    // Not passive — stops the browser from also scrolling #aicoach-messages
    // underneath once this has committed to being a close-drag, same
    // reasoning as attachAiCoachRowActionsDragClose()'s own non-passive
    // touchmove.
    if (e && e.cancelable) e.preventDefault();
    screen.style.transform = `translateY(${dy}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    if (committed && dy > 100) {
      // The drag left `transition: none` and a static translateY(dy) in
      // place (set above, to track the finger 1:1 with no lag) — without
      // explicitly re-arming a transition and an actual target value here,
      // that frozen position would just sit untouched for the whole 320ms
      // of closeAiCoachChatSheet()'s own cleanup delay, then snap shut
      // instantly at the end of it: a visible stop-then-jump instead of one
      // continuous motion. Animating the rest of the way closed here, in
      // the same easing/duration the CSS class-driven open/close otherwise
      // uses, makes the release read as a natural continuation of the drag.
      screen.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
      screen.style.transform = 'translateY(100%)';
      closeAiCoachChatSheet();
    } else if (committed) {
      screen.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      screen.style.transform = '';
      setTimeout(() => { screen.style.transition = ''; }, 320);
    }
    dy = 0;
    committed = false;
  }

  screen.addEventListener('touchstart', e => onStart(e.touches[0].clientY, e.target), { passive: true });
  screen.addEventListener('touchmove',  e => onMove(e.touches[0].clientY, e),  { passive: false });
  screen.addEventListener('touchend',   onEnd);
  screen.addEventListener('touchcancel', onEnd);
}

// ================================================================
// CHAT: SEND MESSAGE
// ================================================================

// Instant-mode double/triple-texting: after a fresh message, instead of
// starting the reply right away, open a short window during which the
// user can send 1-2 more messages before AI actually replies — same as
// double-texting a real person. Only applies to "training" (Instant)
// mode; "realistic" keeps its own existing (separately being reworked)
// timing untouched. See CLAUDE.md's case log for the full design.
const CHAT_PACING = {
  // 7s originally, cut to 4s: the window only needs to be long enough to
  // start a second message in, and the typing-pause below already extends
  // it for as long as someone actually is typing. At 7s a reply felt slow
  // precisely when the user wasn't typing at all and nothing was extending it.
  windowMs:        4000, // fresh double-text window
  followupMs:      3000, // shorter window re-armed after a burst message
  ceilingMs:      25000, // hard cap from the first message in a burst — never reset, so a distracted user can't stall the chat forever
  tailMs:          2500, // short window resumed once the user clears the field without sending
  pulseEveryMs:    8000, // how often to pulse the typing indicator while the user keeps typing without sending
  pulseDurationMs: 2000, // how long each pulse stays visible
  maxBurst:           3,
};

// Tears down any open pacing window/timers without closing it into a
// reply — used when leaving the chat entirely (see cancelPendingReply()).
function _clearChatPacing() {
  const p = state.pacing;
  if (!p) return;
  clearTimeout(p.windowTimer);
  clearTimeout(p.ceilingTimer);
  clearInterval(p.pulseTimer);
  if (p.pulsing) hideTypingIndicator();
  state.pacing = null;
}

// The window's actual end: starts the real reply. Idempotent — the regular
// window timer, the follow-up timer, and the hard ceiling timer are all
// independent setTimeout calls that can (rarely) land at nearly the same
// moment, and only the first one through should do anything.
function _closeChatPacingWindow() {
  const p = state.pacing;
  if (!p || !p.open) return;
  clearTimeout(p.windowTimer);
  clearTimeout(p.ceilingTimer);
  clearInterval(p.pulseTimer);
  if (p.pulsing) hideTypingIndicator();
  const timing = p.timing;
  state.pacing = null;
  state.awaitingReply = true;
  setSendEnabled(false);
  doTypingAndReply(timing);
}

// Pulses the typing indicator on for pulseDurationMs every pulseEveryMs
// while the user keeps typing without sending — a "still here, still
// waiting" cue instead of either a static freeze or no feedback at all.
function _startChatPacingPulse(p) {
  clearInterval(p.pulseTimer);
  p.pulseTimer = setInterval(() => {
    if (state.pacing !== p || !p.typing) return;
    showTypingIndicator();
    p.pulsing = true;
    setTimeout(() => {
      if (state.pacing === p && p.pulsing) { hideTypingIndicator(); p.pulsing = false; }
    }, CHAT_PACING.pulseDurationMs);
  }, CHAT_PACING.pulseEveryMs);
}

// Called whenever the user is no longer actively typing during an open
// window — because they sent, or because they cleared the field back to
// empty without sending. Either way: stop the pulse, and resume the
// window-close timer with a short tail rather than a fresh full duration,
// since most of the window was already spent deciding.
function _onChatTypingStopped() {
  const p = state.pacing;
  if (!p || !p.open || !p.typing) return;
  p.typing = false;
  clearInterval(p.pulseTimer);
  p.pulseTimer = null;
  if (p.pulsing) { hideTypingIndicator(); p.pulsing = false; }
  clearTimeout(p.windowTimer);
  p.windowTimer = setTimeout(_closeChatPacingWindow, CHAT_PACING.tailMs);
}

// Wired to #message-input's oninput. Only matters while a pacing window is
// open — the signal is real typed content (first character onward), not
// just the keyboard being open, since the keyboard opening alone could be
// an accidental tap rather than real typing intent.
// Empty box -> emoji + hints; any text -> the send pill. The pill appears first,
// then the plane curves up with its lower-left corner held (one-shot classes,
// stripped once played — 2026-10-09j).
function _syncComposerButtons() {
  const row = document.querySelector('.chat-input-row');
  const input = document.getElementById('message-input');
  if (!row || !input) return;
  const has = input.value.trim().length > 0;
  if (has === row.classList.contains('has-text')) return;
  row.classList.toggle('has-text', has);
}

// A web page can't switch the iOS keyboard to its emoji page, so in the iOS app
// the native side does it (see MainViewController.swift). In a plain browser this
// just opens the keyboard on the message box and points at its own emoji key.
let _emojiHintShown = false;
function openEmojiKeyboard() {
  const input = document.getElementById('message-input');
  // In the iOS app, MainViewController.swift answers this by asking iOS for
  // the emoji keyboard on the focused field (message sent before focus() so
  // the flag is already set when the keyboard comes up).
  const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zeloEmoji;
  if (native) { try { native.postMessage(true); } catch (e) {} }
  input.focus();
  _cineHaptic('LIGHT');
  if (native) return;
  _emojiKeyboardHint();
}
// The native side's answer when the emoji keyboard is switched off in iOS Settings.
window._zeloEmojiUnavailable = () => showChatToast('Turn on the Emoji keyboard in Settings › General › Keyboard');
function _emojiKeyboardHint() {
  if (!_emojiHintShown && !localStorage.getItem('zelo_emoji_hint')) {
    _emojiHintShown = true;
    localStorage.setItem('zelo_emoji_hint', '1');
    showChatToast('Tap the 😊 key on your keyboard for emoji');
  }
}

// Hints for her latest message (same as "Get hints" in the hold menu); before she
// has said anything there is nothing to react to, so it offers the openers.
function requestHintsFromComposer() {
  // Tapping the idea icon again closes whatever it opened.
  const chipsEl = document.getElementById('chat-chips');
  const pk = state.character && (state.character.id || state.character.name);
  if (chipsEl && !chipsEl.hidden) {
    if (chipsEl.dataset.mode === 'ai') {
      _cancelSuggestions(); chipsEl.hidden = true; chipsEl.innerHTML = ''; chipsEl.dataset.mode = '';
      _cineHaptic('LIGHT'); return;
    }
    if (pk && _openerOpened[pk]) { _openerOpened[pk] = false; _renderChatChips(); _cineHaptic('LIGHT'); return; }
  }
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const last = chat && [...chat.messages].reverse().find(m => m.sender !== 'user');
  _cineHaptic('LIGHT');
  if (last) { requestHintsFor(last.id); return; }
  const p = state.character;
  if (p) { _openerOpened[p.id || p.name] = true; _renderChatChips(); }
}

function onMessageInputChange() {
  _syncComposerButtons();
  const p = state.pacing;
  if (!p || !p.open) return;
  const hasText = document.getElementById("message-input").value.trim().length > 0;
  if (hasText && !p.typing) {
    p.typing = true;
    clearTimeout(p.windowTimer);
    p.windowTimer = null;
    _startChatPacingPulse(p);
  } else if (!hasText && p.typing) {
    _onChatTypingStopped();
  }
}

function sendMessage() {
  if (state.awaitingReply) return;

  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text) return;

  const p = state.pacing; // captured before this message changes anything
  const replyToId = state.stagedReplyToId || null;
  input.value = "";
  _syncComposerButtons();
  const msgId = syncChatToStore(text, 'user', replyToId);
  appendUserBubble(text, { id: msgId, replyToId });
  _clearStagedReply();
  _renderChatChips();   // she has been written to — the suggestions go away
  // A burst message adds to the same back-and-forth the AI is about to
  // reply to — counted together, not replaced by just the last message,
  // same reasoning the word-limit guard already uses for a single message.
  state.lastUserWordCount = (p && p.open) ? (state.lastUserWordCount || 0) + countWords(text) : countWords(text);
  awardXP('message');
  _onChatTypingStopped();

  if (state.mode !== 'training') {
    // Realistic mode keeps its existing (separately being reworked) timing — no double-text window yet.
    state.awaitingReply = true;
    setSendEnabled(false);
    scheduleReply();
    return;
  }

  if (p && p.open) {
    // Burst message #2/#3 within an already-open window.
    p.burstCount++;
    if (p.burstCount >= CHAT_PACING.maxBurst) {
      _closeChatPacingWindow();
    } else {
      clearTimeout(p.windowTimer);
      p.windowTimer = setTimeout(_closeChatPacingWindow, CHAT_PACING.followupMs);
    }
    return;
  }

  // Fresh message — open the double-text window instead of replying right
  // away. awaitingReply/setSendEnabled(false) deliberately don't happen
  // here: the user needs to still be able to send during this window, or
  // there's no double-texting to speak of.
  state.pacing = {
    open:         true,
    burstCount:   1,
    typing:       false,
    pulsing:      false,
    pulseTimer:   null,
    timing:       DIFFICULTY_CONFIG[state.difficulty].training,
    windowTimer:  setTimeout(_closeChatPacingWindow, CHAT_PACING.windowMs),
    ceilingTimer: setTimeout(_closeChatPacingWindow, CHAT_PACING.ceilingMs),
  };
}

function handleKeyDown(e) {
  if (e.key === "Enter") sendMessage();
}


// ================================================================
// CHAT: REPLY TIMING  (Delivered → Seen → Typing → Reply)
// ================================================================

// Feature 2 + Feature 8: Seen appears quickly; typing/reply decoupled.
// Realistic mode respects the device's local time window (Feature 8).
function scheduleReply() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  const timing = state.mode === "training" ? config.training : config.realistic;

  // Seen shows quickly in both modes — before she starts typing
  const SEEN_DELAY = state.mode === "training" ? 800 : 1500;

  if (state.mode === "realistic") {
    const tWindow = getTimeWindow();

    if (tWindow === "night") {
      // She's asleep — show Seen+sleeping header, queue reply for 6am
      state.pendingTimer = setTimeout(() => {
        setLastMessageStatus("seen");
        setHeaderStatus("sleeping");
        const wakeMs = msUntil6am() + randBetween(2000, 8000);
        state.pendingTimer = setTimeout(() => {
          setHeaderStatus("online");
          doTypingAndReply(timing);
        }, wakeMs);
      }, SEEN_DELAY);
      return;
    }

    if (tWindow === "daytime") {
      initSilentGap();
      if (isInSilentGap()) {
        state.pendingTimer = setTimeout(() => {
          setLastMessageStatus("seen");
          const gapWait = Math.max(3000, state.silentGapEnd - Date.now()) + randBetween(500, 3000);
          state.pendingTimer = setTimeout(() => {
            doTypingAndReply(timing);
          }, gapWait);
        }, SEEN_DELAY);
        return;
      }
    }

    // Normal realistic timing, adjusted for time of day
    const adjTiming = adjustTimingForWindow(timing, tWindow);
    state.pendingTimer = setTimeout(() => {
      setLastMessageStatus("seen");
      const typingStartDelay = Math.max(0, randBetween(adjTiming.seenMin, adjTiming.seenMax) - SEEN_DELAY);
      state.pendingTimer = setTimeout(() => {
        doTypingAndReply(adjTiming);
      }, typingStartDelay);
    }, SEEN_DELAY);
    return;
  }

  // Training (instant) mode: no Seen indicator — reply comes straight away.
  // Timestamps still render; only Seen is skipped.
  const typingStartDelay = Math.max(0, timing.seenDelay - SEEN_DELAY);
  state.pendingTimer = setTimeout(() => {
    // No setLastMessageStatus("seen") in instant mode per spec (Fix 3)
    state.pendingTimer = setTimeout(() => {
      doTypingAndReply(timing);
    }, typingStartDelay);
  }, SEEN_DELAY);
}

// Word-count guardrail helpers (code-level backstop for reply length).
// The prompt-based length rule in _MASTER_SAFETY remains the first line of
// defense; these enforce a hard limit when the model overshoots anyway.
function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWordLimit(text, maxWords) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  let result = '';
  let words = 0;
  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (result && words + sentenceWords > maxWords) break;
    result += sentence;
    words += sentenceWords;
    if (words >= maxWords) break;
  }
  return result.trim() || text;
}

function _wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const AI_MULTI_TEXT_GAP = 400; // pause between one double-text part landing and the next one's typing indicator starting
const AI_REACTION_BEAT_MS = 550; // how long her reaction sits on its own before her words land

// Typing delay for a double-text follow-up part (parts after the first) —
// scaled to that part's own length, unlike the flat timing.typingMin/Max
// range the first part uses (which overlaps the real network fetch, so it
// isn't about this part's length at all). Capped so a long follow-up still
// can't make the chat feel stuck.
function _aiFollowupTypingDelay(text, timing) {
  return Math.min(3000, randBetween(timing.typingMin, timing.typingMax) + countWords(text) * 50);
}

// The run of user messages at the very end of the thread — i.e. the burst
// she's about to answer. Used both to number them for the model and to
// resolve the [re:N] tags it sends back, so the numbering lines up on both
// sides without having to pass anything between the two.
function _trailingUserBurst() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  const out = [];
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].sender !== 'user') break;
    out.unshift(chat.messages[i]);
  }
  return out;
}

// Pulls any [react:N <emoji>] directives out of a raw reply, resolving N
// against the same trailing burst the prompt numbered. Returns the reply
// with the directives stripped, plus what she reacted to — the reaction is
// something she does, so it must never survive into her visible text.
function _extractAiReactions(raw, burst) {
  const reactions = [];
  const text = String(raw || '')
    .replace(/[\[(]\s*react\s*:?\s*#?\s*n?\s*(\d+)\s*([^\])\s][^\])]*?)\s*[\])]/gi, (_m, n, emoji) => {
      const target = burst[parseInt(n, 10) - 1];
      if (target) reactions.push({ msgId: target.id, emoji: emoji.trim() });
      return '';
    })
    .trim();
  return { text, reactions };
}

function _applyAiReaction(msgId, emoji, chatId) {
  const targetId = chatId || state.activeChatId;
  const chat = chatStore.find(c => c.id === targetId);
  const msg = chat ? chat.messages.find(m => m.id === msgId) : null;
  if (!msg) return;
  msg.reaction = emoji;
  if (!_chatIsLive(targetId)) return; // stored, but there's nothing on screen to paint or buzz for
  _renderMsgReactionBadge(msgId);
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
}

// Splits a raw reply into its "|||" parts and pulls any leading [re:N] tag
// off the front, resolving it to the real message id it points at. Returns
// [{ text, replyToId }] — never empty.
// A directive tag is never meant to be visible. The leading-match below is
// what resolves a reply target, but the model has been seen putting one
// mid-text, or inventing an index that doesn't exist — so anything left
// that still looks like one gets scrubbed before it can reach a bubble.
const RE_DIRECTIVE_TAG = /[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*\d+\s*[\])]\s*/gi;
function _stripDirectiveTags(text) {
  return String(text || '').replace(RE_DIRECTIVE_TAG, '').trim();
}

function _parseAiReplyParts(raw, burst) {
  const text = String(raw || '').trim();
  const parts = text.split('|||').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const out = [];
  for (let part of (parts.length ? parts : [text])) {
    let replyToId = null;
    // Deliberately loose. The prompt asks for "[re:2]", but the model has
    // been seen emitting "(re:N2)" — round brackets, and a literal "N" it
    // copied out of the placeholder. Anything that doesn't match leaks the
    // raw tag into a visible bubble, so accept either bracket, an optional
    // "reply"/"#"/"n", and a missing colon rather than failing closed.
    const tag = part.match(/^[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*(\d+)\s*[\])]\s*/i);
    if (tag) {
      const target = burst[parseInt(tag[1], 10) - 1];
      if (target) replyToId = target.id;
      part = part.slice(tag[0].length).trim();
    }
    part = _stripDirectiveTags(part); // safety net for a tag anywhere else in the text
    if (part) out.push({ text: part, replyToId });
  }
  return out.length ? out : [{ text: _stripDirectiveTags(text) || text, replyToId: null }];
}

// Shared: show typing indicator then deliver the AI reply — possibly as up
// to 3 separate bubbles landing one after another (see _fetchAIGirlReply's
// "|||" instruction), when the model itself decides this reply reads more
// naturally as a double/triple-text than one paragraph. Most replies are
// still exactly one part and this behaves exactly as before for them.
function doTypingAndReply(timing) {
  const typingDuration = randBetween(timing.typingMin, timing.typingMax);
  const myGen = state.chatReplyGen || 0; // see cancelPendingReply()'s comment on why this exists
  setHeaderStatus("typing");
  showTypingIndicator();

  // Start the DeepSeek fetch concurrently while the typing indicator shows
  const replyPromise = _fetchAIGirlReply();

  const burst = _trailingUserBurst(); // captured before her own replies start landing on the end of the thread
  const myChatId = state.activeChatId; // she may finish replying after you've navigated away
  state.pendingTimer = setTimeout(async () => {
    let parts, reactions = [];
    try {
      const first = _extractAiReactions(await replyPromise, burst);
      reactions = first.reactions;
      parts = _parseAiReplyParts(first.text, burst);
      const userWords = state.lastUserWordCount || 10;
      const wordLimit = Math.max(userWords * 2, 12);
      // Counted across the cleaned parts: the "|||" separators and [re:N]
      // tags aren't words she actually said, and counting them would push
      // a perfectly reasonable multi-text reply over the limit.
      const totalWords = parts.reduce((n, p) => n + countWords(p.text), 0);
      if (totalWords > wordLimit) {
        try {
          const again = _extractAiReactions(await _fetchAIGirlReply(true), burst);
          if (again.reactions.length) reactions = again.reactions;
          parts = countWords(again.text) <= wordLimit
            ? _parseAiReplyParts(again.text, burst)
            : [{ text: truncateToWordLimit(again.text, wordLimit), replyToId: null }];
        } catch (_) {
          parts = [{ text: truncateToWordLimit(parts.map(p => p.text).join(' '), wordLimit), replyToId: null }];
        }
      }
    } catch (_) {
      parts = [{ text: "sorry got distracted lol", replyToId: null }];
    }
    // The generation guard now only fires on a real abort (the thread being
    // wiped) — simply navigating away no longer bumps it, so the reply runs
    // to completion in the background and lands in the store either way.
    if ((state.chatReplyGen || 0) !== myGen) return;

    // Her reaction lands first, while she's still visibly "typing", then a
    // beat, then the words — so it reads as her reacting and then carrying
    // on, rather than both appearing in the same instant.
    if (reactions.length) {
      reactions.forEach(r => _applyAiReaction(r.msgId, r.emoji, myChatId));
      await _wait(AI_REACTION_BEAT_MS);
      if ((state.chatReplyGen || 0) !== myGen) return;
    }

    if (_chatIsLive(myChatId)) { hideTypingIndicator(); setHeaderStatus("online"); removeSeenStatus(); }
    _deliverAiPart(parts[0], myChatId);

    for (let i = 1; i < parts.length; i++) {
      await _wait(AI_MULTI_TEXT_GAP);
      if ((state.chatReplyGen || 0) !== myGen) return;
      if (_chatIsLive(myChatId)) { setHeaderStatus("typing"); showTypingIndicator(); }
      await _wait(_aiFollowupTypingDelay(parts[i].text, timing));
      if ((state.chatReplyGen || 0) !== myGen) return;
      if (_chatIsLive(myChatId)) { hideTypingIndicator(); setHeaderStatus("online"); }
      _deliverAiPart(parts[i], myChatId);
    }

    state.pendingTimer = null;
    if (_chatIsLive(myChatId)) { state.awaitingReply = false; setSendEnabled(true); _scheduleSuggestions(); }
    // Deliberately no re-focus here — her reply arriving shouldn't pop the
    // keyboard back open on its own if the user had closed it to read.
  }, typingDuration);
}

// ---- Hidden goal + curiosity: quiet nudges added to the persona's prompt ----
// None of this is ever shown to the user or mentioned by her.
const _GOAL_HINTS = {
  'what-to-say': 'knowing what to say, so give them easy, natural things to respond to rather than closing every topic off',
  'keep-going':  'keeping a conversation going, so leave them natural hooks (a detail, something to ask about) to pick up',
  'natural':     'sounding more natural, so keep your own tone relaxed and casual, which is easy to mirror',
  'flirting':    'flirting without being awkward, so you can be a little playful and warm and take light teasing well — without being forward yourself',
  'confident':   'feeling more confident, so be warm and encouraging when they put themselves out there',
};
const _TONE_HINTS = { playful: 'a playful tone', chill: 'a laid-back tone', direct: 'a direct, straightforward way of talking' };

function _userGoalHint() {
  let help = cineAnswers.help;
  if (!help || !help.length) { try { help = JSON.parse(localStorage.getItem('zelo_onb_help') || '[]'); } catch (_) { help = []; } }
  const tone = cineAnswers.tone || localStorage.getItem('zelo_onb_tone');
  const goals = (help || []).map(k => _GOAL_HINTS[k]).filter(Boolean);
  if (!goals.length && !_TONE_HINTS[tone]) return '';
  const parts = ['Quiet background about the person you are texting. Never mention it, never talk about "goals", practice or coaching — just let it shape how you chat.'];
  if (goals.length) parts.push('They are working on: ' + goals.join('; ') + '.');
  if (_TONE_HINTS[tone]) parts.push('They like ' + _TONE_HINTS[tone] + '.');
  parts.push('This is a light nudge, not a rule: stay yourself.');
  return parts.join(' ');
}

// Keeps her curious about them without turning it into an interview: a
// question back now and then (about one reply in three or four), more of one
// when they are clearly putting effort in, and none right after she has just
// asked. Looks at her last few replies rather than leaving it to chance.
function _curiosityHint(history) {
  const ai = history.filter(m => m.sender !== 'user').slice(-3);
  const asked = ai.map(m => /\?/.test(m.text || ''));
  const lastUser = [...history].reverse().find(m => m.sender === 'user');
  const effort = !!lastUser && (countWords(lastUser.text) >= 9 || /\?/.test(lastUser.text));
  const base = 'You are curious about them too — real people ask things back, just not every message. Ask a natural question about 1 reply in 3 or 4 (specific to what they said, never a stock "how about you?"). If they are putting effort in (longer messages, asking you things, sharing things), put effort back: say more than a one-liner, share something of your own, and ask a follow-up that comes from what they said. A reply with no question at all is completely normal.';
  if (asked.length >= 2 && asked[asked.length - 1] && asked[asked.length - 2]) {
    return base + ' You asked a question in your last two replies — do NOT end this one with a question; react or share something instead.';
  }
  if (ai.length >= 3 && !asked.some(Boolean)) {
    return base + ' You have not asked them anything in a while — ask one natural question this time.';
  }
  if (effort && ai.length >= 1 && !asked[asked.length - 1]) {
    return base + ' They are putting effort in right now and your last reply had no question — meet that effort and include a natural follow-up question.';
  }
  return base;
}

async function _fetchAIGirlReply(forceShort) {
  const systemPrompt = state.character?.systemPrompt || '';
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const history = chat ? chat.messages : [];

  const userWords  = state.lastUserWordCount || 10;
  // Ceiling bumped from 200: a rare 3-part double/triple-text reply (see the
  // multi-text instruction below) needs headroom for all 3 parts plus their
  // "|||" separators, not just one message's worth of tokens.
  const maxTokens  = Math.max(40, Math.min(260, userWords * 12 + 20));

  // Reactions are surfaced to the model as short notes next to the message
  // they're attached to — otherwise tapping a reaction is invisible to her
  // and the conversation carries on as if nothing happened. Who reacted is
  // implied by whose message it sits on: there are only two people here, and
  // you react to the other one's message, never your own.
  const messages = [{ role: 'system', content: systemPrompt }];
  history.forEach(m => {
    messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text });
    if (!m.reaction) return;
    messages.push({
      role: 'system',
      content: m.sender === 'ai'
        ? `The user reacted ${m.reaction} to that message of yours.`
        : `You reacted ${m.reaction} to that message of theirs.`
    });
  });

  if (forceShort) {
    messages.push({
      role: 'system',
      content: `Your last reply ran too long. Reply in roughly ${userWords} words or fewer this time — match the user's message length, do not exceed it.`
    });
  } else {
    // Double/triple-texting: lets the model itself decide when a reply
    // reads more like 2-3 separate texts in a row than one paragraph —
    // elaborating on something, or tacking on an afterthought/laugh/emoji —
    // the same way a real person texting does. Deliberately not asked for
    // on the forceShort retry above: that path exists specifically to get
    // ONE short reply back under the word limit, and splitting it into
    // several short parts would just work around that limit instead of
    // respecting it.
    messages.push({
      role: 'system',
      content: [
        `Text like a real person, not in one tidy paragraph.`,
        `When you have more than one beat to it, send 2-3 separate short messages in a row instead of one long one — split them with "|||" and nothing else around it. A follow-up message doesn't have to add new information; reacting first and then expanding ("ugh" then the actual answer), or trailing off with a laugh or an emoji, is how people actually text. Don't do it on every single reply — a single short message is still common and fine.`,
        `Answer short questions short. A one-word answer should stay one word instead of being padded into a full sentence.`,
        `Never mention or explain this formatting.`,
      ].join(' ')
    });

    // Hidden goal (from onboarding) and the curiosity/effort-matching nudge.
    const goalHint = _userGoalHint();
    if (goalHint) messages.push({ role: 'system', content: goalHint });
    messages.push({ role: 'system', content: _curiosityHint(history) });

    // When the user double/triple-texted, the model can answer each message
    // separately instead of mashing them into one response — and tag a part
    // with [re:N] to attach it to a specific one, which the client turns
    // into a real reply-quote (see _parseAiReplyParts()). Numbered off the
    // same trailing burst the client re-derives when parsing, so N lines up.
    // Numbered unconditionally, not just for a burst: [react:N] needs the
    // numbering too, and a single message is simply N=1.
    const burst = _trailingUserBurst();
    if (burst.length) {
      const lines = [
        burst.length > 1
          ? `The user just sent you ${burst.length} messages in a row:`
          : `Their latest message, numbered so you can refer to it:`,
        burst.map((m, i) => `[${i + 1}] ${m.text}`).join('\n'),
      ];
      if (burst.length > 1) {
        lines.push(`Answer them as separate messages (split with "|||") rather than one combined reply. Start a message with the number of theirs it answers, in square brackets, like [re:1] or [re:2] — literally that, with a real digit. Use it only where it isn't already obvious which one you mean.`);
      }
      lines.push(`You can also react to one of their messages with a single emoji, the way you'd tap a reaction on a text — put the tag at the very start of your reply, like [react:1 😂] or [react:2 🥹] — literally that, with a real digit and any emoji. Use it only when something genuinely lands (funny, sweet, annoying), not routinely. A reaction is something you DO, not something you say: never mention it, describe it, or refer to having reacted — just carry on texting as normal.`);
      messages.push({ role: 'system', content: lines.join('\n') });
    }
  }

  const { data, error } = await _aiInvoke('deepseek-proxy', {
    body: { model: 'deepseek-chat', messages, max_tokens: maxTokens, temperature: 1.0 }
  }, 'chat_reply');

  if (error) throw new Error(error.message);
  return data.choices[0].message.content.trim();
}

// Leaving the chat. Deliberately does NOT kill an in-flight reply any more:
// it keeps running and lands via _deliverAiPart(), which stores it and marks
// the chat unread. This is only the on-screen teardown.
function cancelPendingReply() {
  // If the double-text window is still open, close it NOW so the message
  // actually gets answered. Throwing the window away was the real reason
  // sending and immediately leaving read as "never sent" — doTypingAndReply
  // was never reached at all, so no reply was ever scheduled.
  if (state.pacing && state.pacing.open) _closeChatPacingWindow();
  // doTypingAndReply()'s own async callback (and its multi-part double-text
  // loop) can already be mid-flight once its outer setTimeout has fired —
  // clearing pendingTimer above does nothing for that, since it's a running
  // function at that point, not a pending timer. This generation counter
  // (same pattern as _aiCoachStatusGen elsewhere) is what that loop checks
  // before each part it appends, so leaving the chat mid-reply can't still
  // have bubbles land in it afterward.
  _clearChatPacing();
  _clearStagedReply(); // a reply staged in this chat shouldn't still be sitting in the composer after leaving it
  hideTypingIndicator();
  state.awaitingReply = false;
  setSendEnabled(true);
}


// ================================================================
// CHAT: DOM HELPERS
// ================================================================

// Plays the entrance animation once and then takes it off the element.
// Leaving `animation` on permanently (as the CSS used to) means every
// reparent restarts it — the swipe-nav blink.
function _playRowEntrance(row, cls) {
  row.classList.add(cls);
  setTimeout(() => row.classList.remove(cls), 220);
}

function appendUserBubble(text, opts = {}) {
  const messages = document.getElementById("chat-messages");
  messages.querySelectorAll(".msg-status").forEach(s => s.remove());

  const row    = document.createElement("div");
  row.className = "msg-row user";
  if (opts.id) row.dataset.msgId = opts.id;

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble user";
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));

  const timestamp = document.createElement("div");
  timestamp.className   = "msg-timestamp";
  timestamp.textContent = formatTime();

  // Seen will be written here by scheduleReply; starts empty (no "Delivered")
  const status = document.createElement("div");
  status.className = "msg-status";
  status.id        = "last-msg-status";

  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  wrap.appendChild(status);
  row.appendChild(wrap);
  row.appendChild(createMsgAvatar(false));
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
  scrollToBottom();
}

function appendAIBubble(text, atTime, opts = {}) {
  const messages = document.getElementById("chat-messages");
  const wasNearBottom = _isChatNearBottom(); // sampled before this row changes the height

  const row    = document.createElement("div");
  row.className = "msg-row ai";
  if (opts.id) row.dataset.msgId = opts.id;

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble ai";
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));

  const timestamp = document.createElement("div");
  timestamp.className   = "msg-timestamp";
  timestamp.textContent = formatTime(atTime);

  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(createMsgAvatar(true));
  row.appendChild(wrap);
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
  _followChatIfAtBottom(wasNearBottom, true);
}

// Consecutive messages from the same sender read as one run (double/triple
// texts, either side) — so only the LAST message in a run keeps its avatar
// and timestamp, exactly like iMessage/Instagram. Applied to the row BEFORE
// the one just appended: that row has just stopped being the run's last.
// Walks back past non-.msg-row siblings on purpose — scrollToBottom()'s
// overflow spacer is re-appended at the end each time, so it's routinely
// sitting between the previous message and the new one at this point.
function _applyMsgGrouping(newRow) {
  let prev = newRow.previousElementSibling;
  while (prev && !prev.classList.contains('msg-row')) prev = prev.previousElementSibling;
  if (!prev) return;
  const sameSender = prev.classList.contains('user') === newRow.classList.contains('user');
  if (sameSender) prev.classList.add('msg-row--grouped');
}

// Reply-to-message: a bubble with a replyToId shows a compact quoted strip
// above its own text, referencing the original message (truncated).
// Manual/opt-in only (long-press a row to stage it, see
// _attachReplyLongPress) — never auto-attached to a double/triple-text
// burst, so it doesn't clutter every turn.
function _buildReplyQuoteEl(replyToId) {
  if (!replyToId) return null;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const original = chat ? chat.messages.find(m => m.id === replyToId) : null;
  if (!original) return null;
  const quote = document.createElement("div");
  quote.className = "msg-reply-quote";
  quote.textContent = original.text.length > 80 ? original.text.slice(0, 80) + '…' : original.text;
  quote.addEventListener('click', () => _scrollToMessage(replyToId));
  return quote;
}

// Scrolls to and briefly highlights the original message a reply-quote
// strip points at.
function _scrollToMessage(id) {
  const row = document.querySelector(`.msg-row[data-msg-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center' });
  row.classList.add('msg-row--highlight');
  setTimeout(() => row.classList.remove('msg-row--highlight'), 1200);
}

// Long-press a message row to stage it as "replying to" — no intermediate
// menu, since reply is the only action a press on a chat bubble offers.
// Same 500ms-hold-cleared-on-move convention as AI Coach history rows'
// _aiCoachLongPressTimer.
// 300ms, not the 500ms used for list rows elsewhere — this fires on a
// message bubble where there's nothing else a press could mean, and the
// user asked for it to feel immediate. Buzzes on open the way iOS/Instagram
// do, so the menu never appears without the press being acknowledged first.
const MSG_LONG_PRESS_MS = 300;
let _chatRowLongPressTimer = null;
function _attachReplyLongPress(row, msgId) {
  row.addEventListener('touchstart', () => {
    clearTimeout(_chatRowLongPressTimer);
    _chatRowLongPressTimer = setTimeout(() => {
      navigator.vibrate?.(12);
      _cineHaptic('MEDIUM');
      openMsgMenu(msgId, row);
    }, MSG_LONG_PRESS_MS);
  }, { passive: true });
  row.addEventListener('touchmove', () => clearTimeout(_chatRowLongPressTimer), { passive: true });
  row.addEventListener('touchend',  () => clearTimeout(_chatRowLongPressTimer), { passive: true });
  row.addEventListener('touchcancel', () => clearTimeout(_chatRowLongPressTimer), { passive: true });
}

// Swipe a message to the right to reply to it — the shortcut for the menu's
// own Reply action. The row follows the finger with resistance, springs
// back on release, and fires the reply past the trigger distance.
const SWIPE_REPLY_TRIGGER = 56;
const SWIPE_REPLY_MAX     = 78;
// The row has to travel past the avatar (28px + 6px margin) before the icon
// shows — revealing it sooner put it on top of the pfp, then on the message.
const SWIPE_REPLY_REVEAL  = 34;
// Set by a row the moment its swipe commits horizontally, so the back
// gesture (which sees the same touch a few pixels later, as it bubbles up)
// can stand down for that one drag instead of both running at once. Back
// swipe therefore works anywhere EXCEPT on a drag a row has claimed.
let _msgRowSwipeClaimed = false;

function _attachSwipeToReply(row, msgId) {
  // Her messages sit on the left and pull right; yours sit on the right and
  // pull left. Mirroring it this way also leaves rightward drags on your own
  // messages free for the back gesture.
  const dir = row.classList.contains('user') ? -1 : 1;

  const icon = document.createElement('span');
  icon.className = 'msg-swipe-reply-icon';
  icon.innerHTML = `<img src="assets/icons/chats-page/msg-menu/reply.png" alt="" aria-hidden="true" onerror="this.remove()">`;
  row.appendChild(icon);

  let startX = 0, startY = 0, axis = null, armed = false, active = false, pull = 0;

  function paint() {
    row.style.transform = `translateX(${pull * dir}px)`;
    // The icon is a child of the row, so the row's own transform drags it
    // along too — which is why it kept ending up over the avatar and then
    // over the message. Counter-translating by the same amount pins it to
    // the far edge while the bubble slides out from under it.
    // It also stays hidden until the row has travelled past the avatar, so
    // it only appears once there's actually clear space for it.
    const progress = Math.max(0, Math.min(1,
      (pull - SWIPE_REPLY_REVEAL) / Math.max(1, SWIPE_REPLY_TRIGGER * 0.55 - SWIPE_REPLY_REVEAL)));
    icon.style.opacity = String(progress);
    icon.style.transform = `translateX(${-pull * dir}px) scale(${0.7 + 0.3 * progress})`;
  }
  function reset(withTransition) {
    row.style.transition = withTransition ? 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    row.style.transform = '';
    icon.style.transition = withTransition ? 'opacity 0.18s ease' : 'none';
    icon.style.opacity = '0';
    icon.style.transform = '';
  }

  row.addEventListener('touchstart', e => {
    active = false;
    if (e.touches.length !== 1) return;
    const o = document.getElementById('msg-menu-overlay');
    if (o && !o.hidden) return; // menu is up; it owns the screen
    active = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    axis = null; armed = false; pull = 0;
    row.style.transition = 'none';
    icon.style.transition = 'none';
  }, { passive: true });

  row.addEventListener('touchmove', e => {
    if (!active || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Only the direction this row replies in, and only when it's clearly
      // horizontal — anything else stays a plain scroll.
      axis = (dx * dir > 0 && Math.abs(dx) > Math.abs(dy)) ? 'x' : 'dead';
    }
    if (axis !== 'x') return;
    e.preventDefault(); // committed horizontally: don't also scroll the thread
    _msgRowSwipeClaimed = true; // this touch belongs to the row, not to back-swipe
    // Directional, floored at zero. Using Math.abs() here was the bug that
    // made the row swing back OUT again once the finger went past the start
    // in the opposite direction — abs() turned that negative travel back
    // into a positive pull, so one drag read as two.
    pull = Math.max(0, Math.min(SWIPE_REPLY_MAX, (dx * dir) * 0.55));
    paint();
    const past = pull >= SWIPE_REPLY_TRIGGER * 0.55;
    if (past && !armed) {
      armed = true; // buzz on crossing, and again if they pull back and out
      navigator.vibrate?.(10);
      _cineHaptic('LIGHT');
    } else if (!past) {
      armed = false;
    }
  }, { passive: false });

  function release() {
    _msgRowSwipeClaimed = false;
    if (!active) return;
    // Judged on where the finger ACTUALLY ended, not on whether it was ever
    // far enough — dragging out and then back near the start now cancels,
    // which is what the latched flag used to get wrong.
    const committed = axis === 'x' && pull >= SWIPE_REPLY_TRIGGER * 0.55;
    active = false; axis = null; armed = false; pull = 0;
    reset(true);
    if (committed) _stageReplyTo(msgId);
  }
  row.addEventListener('touchend', release, { passive: true });
  row.addEventListener('touchcancel', release, { passive: true });
}

// Rubber-band nudge for "no more photos this way". Driven by a class so
// the motion lives in CSS with the rest of the card's animation, and
// re-armed by stripping the class first — otherwise a second tap at the
// same edge does nothing, because restarting a running CSS animation
// requires it to be removed and reflowed in between.
function _bounceCardEdge(cardEl, dir) {
  const cls = dir < 0 ? 'swipe-card--edge-left' : 'swipe-card--edge-right';
  cardEl.classList.remove('swipe-card--edge-left', 'swipe-card--edge-right');
  void cardEl.offsetWidth; // reflow, so the animation can restart
  cardEl.classList.add(cls);
  // navigator.vibrate alone does nothing on iOS — WKWebView doesn't
  // implement it. _cineHaptic() is the Capacitor Haptics call that actually
  // fires on device, and every other haptic in this file pairs the two.
  navigator.vibrate?.(6);
  _cineHaptic('LIGHT');
  setTimeout(() => cardEl.classList.remove(cls), 340);
}

// ---- Message long-press menu (Instagram-style) ----------------------
// Emoji reaction row above the pressed message, action list below it, the
// rest of the screen blurred back. Reference screenshots the user supplied
// live in assets/icons/chats-page/ alongside the cropped menu icons.
const MSG_QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🥹'];
const MSG_MORE_REACTIONS  = ['🔥', '😭', '🙄', '😅', '👀', '💀', '🫶', '😤'];
// Kept in sync with the stack's transform transition in style.css. The
// travel's easing is front-loaded, so it's visually home well before the
// 240ms transition formally ends — SETTLE fires at that visual landing, not
// at the end, or there's a dead beat before the emoji row pops.
const MSG_MENU_TRAVEL_MS = 240;
const MSG_MENU_SETTLE_MS = 150;
const MSG_MENU_CLOSE_MS  = 180;
let _msgMenuTargetId = null;
let _msgMenuSettleTimer = null;
let _msgMenuCloseTimer = null;

function _activeChatMsg(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  return chat ? chat.messages.find(m => m.id === msgId) : null;
}

function openMsgMenu(msgId, row) {
  const msg = _activeChatMsg(msgId);
  const overlay = document.getElementById('msg-menu-overlay');
  if (!msg || !overlay || !row) return;
  _msgMenuTargetId = msgId;

  const stack = document.getElementById('msg-menu-stack');
  const slot  = document.getElementById('msg-menu-bubble-slot');
  const isUser = msg.sender === 'user';
  stack.classList.toggle('msg-menu-stack--user', isUser);

  // The whole row is cloned, avatar included, and the slot carries the same
  // side padding as .chat-messages — so the lifted copy lands at exactly the
  // same indent as the real one without any per-side offset math. The
  // grouped class is dropped so the time always shows here, even when the
  // real row had it merged away into the run below it.
  const clone = row.cloneNode(true);
  clone.classList.remove('msg-row--grouped');
  // The clone is a visual copy only — it must NOT stay addressable by id,
  // or `.msg-row[data-msg-id=...]` lookups (_scrollToMessage,
  // _renderMsgReactionBadge) can resolve to this copy instead of the real
  // message, and a repaint of the thread underneath would appear to leave
  // the row behind.
  clone.removeAttribute('data-msg-id');
  clone.querySelectorAll('.msg-status, .bubble-reaction').forEach(el => el.remove());
  slot.innerHTML = '';
  slot.appendChild(clone);

  _renderMsgMenuReactions(false);
  _renderMsgMenuActions(msg);

  // The long-press that opened this menu also looks, to the global
  // keyboard-dismiss handler, like a tap outside a focused input — so if
  // the composer was focused (staging a reply focuses it, for one), that
  // handler has just armed a one-shot click swallower and dropped a
  // full-screen blocker over everything for 500ms. Both would eat the
  // user's first tap on this menu and leave it sitting there doing
  // nothing. Opening the menu is deliberate, not a dismiss gesture, so
  // stand both down now that it's up.
  document.removeEventListener('click', _swallowKeyboardDismissClick, { capture: true });
  document.querySelectorAll('.kb-dismiss-click-blocker').forEach(el => el.remove());

  const rowRect = row.getBoundingClientRect();
  overlay.hidden = false;
  _positionMsgMenu();

  // The lifted copy starts exactly where the real message sits in the thread
  // and travels up into place, so the menu reads as coming out of the message
  // the user pressed rather than just appearing somewhere else. Measured off
  // the slot's offset inside the stack, so the emoji row's reserved height
  // (it's invisible until the stack lands) is already accounted for.
  const travelY = Math.round(rowRect.top - (stack.offsetTop + slot.offsetTop));
  stack.style.transition = 'none';
  stack.style.transform = `translateY(${travelY}px) scale(0.96)`;
  void stack.offsetHeight; // flush, so the clearing below animates FROM here
  requestAnimationFrame(() => {
    stack.style.transition = '';
    stack.style.transform = '';
    overlay.classList.add('msg-menu-overlay--in');
  });
  // Emoji row pops and the action card bounces only once the travel has
  // landed — see the --settled rules in style.css.
  clearTimeout(_msgMenuSettleTimer);
  _msgMenuSettleTimer = setTimeout(() => overlay.classList.add('msg-menu-overlay--settled'), MSG_MENU_SETTLE_MS);
}

// Centres the stack vertically, clamped inside the safe area. Called on open
// and again if the emoji row is expanded, since that makes the stack taller
// and could otherwise push the actions off the bottom of the screen.
function _positionMsgMenu() {
  const stack = document.getElementById('msg-menu-stack');
  if (!stack) return;
  const SAFE_TOP = 56, SAFE_BOTTOM = 40;
  const stackH = stack.offsetHeight;
  let top = Math.round((window.innerHeight - stackH) / 2);
  top = Math.max(SAFE_TOP, Math.min(top, window.innerHeight - stackH - SAFE_BOTTOM));
  stack.style.top = top + 'px';
}

function closeMsgMenu() {
  const overlay = document.getElementById('msg-menu-overlay');
  if (!overlay || overlay.hidden) return;
  clearTimeout(_msgMenuSettleTimer);
  // No reverse travel and no bounce on the way out — everything just settles
  // down and fades together. --settled deliberately stays on so the emoji
  // row's pop animation keeps its finished state while it fades, instead of
  // snapping back to its hidden start frame.
  overlay.classList.remove('msg-menu-overlay--in');
  overlay.classList.add('msg-menu-overlay--out');
  clearTimeout(_msgMenuCloseTimer);
  _msgMenuCloseTimer = setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove('msg-menu-overlay--out', 'msg-menu-overlay--settled');
    const stack = document.getElementById('msg-menu-stack');
    if (stack) { stack.style.transform = ''; stack.style.transition = ''; }
    _msgMenuTargetId = null;
  }, MSG_MENU_CLOSE_MS);
}

function _renderMsgMenuReactions(expanded) {
  const el = document.getElementById('msg-menu-reactions');
  if (!el) return;
  const msg = _activeChatMsg(_msgMenuTargetId);
  const list = expanded ? MSG_QUICK_REACTIONS.concat(MSG_MORE_REACTIONS) : MSG_QUICK_REACTIONS;
  el.classList.toggle('msg-menu-reactions--expanded', expanded);
  el.innerHTML = '';
  list.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msg-menu-reaction' + (msg && msg.reaction === emoji ? ' msg-menu-reaction--on' : '');
    btn.textContent = emoji;
    btn.addEventListener('click', () => _toggleMsgReaction(emoji));
    el.appendChild(btn);
  });
  if (!expanded) {
    const div = document.createElement('span');
    div.className = 'msg-menu-reaction-div';
    el.appendChild(div);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'msg-menu-reaction msg-menu-reaction--plus';
    plus.setAttribute('aria-label', 'More reactions');
    plus.innerHTML = `<img src="assets/icons/chats-page/msg-menu/add.png" alt="" aria-hidden="true" onerror="this.remove()">`;
    plus.addEventListener('click', () => { _renderMsgMenuReactions(true); _positionMsgMenu(); });
    el.appendChild(plus);
  }
}

function _toggleMsgReaction(emoji) {
  const msg = _activeChatMsg(_msgMenuTargetId);
  if (!msg) return;
  msg.reaction = msg.reaction === emoji ? null : emoji;
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
  _renderMsgReactionBadge(msg.id);
  closeMsgMenu();
}

// Paints (or clears) the little reaction badge on the real bubble without
// re-rendering the whole thread.
function _renderMsgReactionBadge(msgId) {
  const msg = _activeChatMsg(msgId);
  const row = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (!row) return;
  const wrap = row.querySelector('.msg-wrap');
  wrap.querySelectorAll('.bubble-reaction').forEach(el => el.remove());
  if (msg && msg.reaction) {
    const badge = document.createElement('span');
    badge.className = 'bubble-reaction';
    badge.textContent = msg.reaction;
    // Straight after the bubble, not at the end of the wrap — the
    // timestamp has to stay below it.
    wrap.querySelector('.bubble')?.insertAdjacentElement('afterend', badge);
  }
}

function _renderMsgMenuActions(msg) {
  const el = document.getElementById('msg-menu-actions');
  if (!el) return;
  const ICONS = 'assets/icons/chats-page/msg-menu';
  const items = [
    // Her messages only: ask for ideas on what to send back to THIS message.
    ...(msg.sender !== 'user' ? [{ src: 'assets/icons/aicoach-topics/mascot-brand.png', label: 'Get hints', sepAfter: true, fn: () => { closeMsgMenu(); requestHintsFor(msg.id); } }] : []),
    { icon: 'reply',  label: 'Reply',          fn: () => { closeMsgMenu(); _stageReplyTo(msg.id); } },
    { icon: 'copy',   label: 'Copy',           fn: () => { _copyMsgText(msg.text); closeMsgMenu(); } },
    { icon: 'delete', label: 'Delete for you', fn: () => { closeMsgMenu(); _deleteMsgForYou(msg.id); } },
    { icon: 'report', label: 'Report',         fn: () => { closeMsgMenu(); showChatToast('Reported. Thanks for letting us know.'); }, danger: true },
  ];
  el.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msg-menu-action' + (item.danger ? ' msg-menu-action--danger' : '');
    btn.innerHTML = `<img src="${item.src || `${ICONS}/${item.icon}.png`}" alt="" aria-hidden="true" onerror="this.remove()"><span>${item.label}</span>`;
    btn.addEventListener('click', item.fn);
    el.appendChild(btn);
    if (item.sepAfter) el.appendChild(Object.assign(document.createElement('div'), { className: 'msg-menu-sep' }));
  });
}

function _copyMsgText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function _deleteMsgForYou(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return;
  const i = chat.messages.findIndex(m => m.id === msgId);
  if (i === -1) return;
  chat.messages.splice(i, 1);
  // Anything still pointing at the message that just went away would render
  // a quote strip with nothing behind it — _buildReplyQuoteEl() already
  // bails on a missing target, but clearing it keeps the stored data honest.
  chat.messages.forEach(m => { if (m.replyToId === msgId) delete m.replyToId; });
  if (state.stagedReplyToId === msgId) _clearStagedReply();
  const last = chat.messages[chat.messages.length - 1];
  chat.lastMessage = last ? last.text : '';
  _rerenderChatMessages();
}

// Re-entering a chat has been reported on-device as showing a blank white
// area where the thread should be, until a touch makes it appear — i.e. the
// rebuilt list is laid out but its layer never gets painted as the screen
// fades back in. Not reproducible in headless Chrome (the rows are present,
// positioned and visible there), so this is a WKWebView compositing nudge
// rather than a diagnosed fix: touching opacity for one frame forces the
// layer to be invalidated and repainted. Costs nothing where the bug
// doesn't happen — but it does need confirming on a real device.
function _forceChatRepaint() {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  requestAnimationFrame(() => {
    // Mirrors the exact thing that makes it appear on device — a scroll.
    // scroll-behavior is forced to auto first or the nudge animates instead
    // of applying immediately (this file has been bitten by that before).
    const prevBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    // Land on the newest message. This has to happen HERE, after
    // pushScreen() has made the screen active — _rerenderChatMessages()
    // runs while it's still inactive, where clientHeight isn't yet the real
    // one, so its own scroll resolved against the wrong height and left the
    // thread sitting at the top.
    _ensureScrollableOverflow(el, 48);
    el.scrollTop = Math.max(0, _logicalScrollHeight(el) - el.clientHeight);
    el.style.scrollBehavior = prevBehavior;
    // ...plus a layer touch, for the case where the stale layer isn't the
    // scroller's own.
    el.style.opacity = '0.999';
    requestAnimationFrame(() => { el.style.opacity = ''; });
  });
}

// Is `chatId` the conversation actually on screen right now? Her reply can
// outlive you leaving the chat, so every paint has to be gated on this.
// A genuine abort — the thread this reply belongs to is being destroyed, so
// it must NOT be allowed to land. Bumping the generation is what the
// delivery loop checks; cancelPendingReply() no longer does this, because
// merely navigating away should let the reply finish.
function abortPendingReply() {
  state.chatReplyGen = (state.chatReplyGen || 0) + 1;
  if (state.pendingTimer !== null) { clearTimeout(state.pendingTimer); state.pendingTimer = null; }
  _clearChatPacing();
  hideTypingIndicator();
  state.awaitingReply = false;
  setSendEnabled(true);
}

function _chatIsLive(chatId) {
  const screen = document.getElementById('screen-chat');
  return !!chatId && state.activeChatId === chatId && !!screen && screen.classList.contains('active');
}

// Always stores the message; only paints it when that chat is the one on
// screen. Leaving mid-reply therefore still gets the message — it lands in
// the thread and the chats list shows it unread — instead of the reply
// being thrown away as though it had never sent.
function _deliverAiPart(part, chatId) {
  const id = syncChatToStore(part.text, 'ai', part.replyToId, chatId);
  if (_chatIsLive(chatId)) {
    appendAIBubble(part.text, undefined, { id, replyToId: part.replyToId });
  } else {
    const chat = chatStore.find(c => c.id === chatId);
    if (chat) chat.unread = (chat.unread || 0) + 1;
    renderChatsList();
  }
  return id;
}

// Full repaint of the thread from the store — used after a delete, and by
// openChatFromStore() for its own replay so there's only one copy of this.
function _rerenderChatMessages() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const el = document.getElementById('chat-messages');
  if (!chat || !el) return;
  el.innerHTML = '';
  _renderChatProfileHeader(chat.profile);
  chat.messages.forEach(m => {
    const opts = { id: m.id, replyToId: m.replyToId };
    if (m.sender === 'user') appendUserBubbleStatic(m.text, m.time, opts);
    else appendAIBubble(m.text, m.time, opts);
  });
  // appendUserBubbleStatic deliberately doesn't scroll per message, so a
  // thread ending on a user message would otherwise land one bubble short
  // of the real bottom — this always finishes at the true bottom.
  scrollToBottom();
}

let _chatToastTimer = null;
function showChatToast(text) {
  const el = document.getElementById('chat-toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('chat-toast--in'));
  clearTimeout(_chatToastTimer);
  _chatToastTimer = setTimeout(() => {
    el.classList.remove('chat-toast--in');
    setTimeout(() => { el.hidden = true; }, 200);
  }, 2000);
}

function _stageReplyTo(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const original = chat ? chat.messages.find(m => m.id === msgId) : null;
  if (!original) return;
  state.stagedReplyToId = msgId;
  const textEl = document.getElementById('chat-reply-staged-text');
  const strip  = document.getElementById('chat-reply-staged');
  if (textEl) textEl.textContent = (original.sender === 'user' ? 'You: ' : '') + original.text;
  if (strip) strip.hidden = false;
  document.getElementById('message-input')?.focus();
}

function _clearStagedReply() {
  state.stagedReplyToId = null;
  const strip = document.getElementById('chat-reply-staged');
  if (strip) strip.hidden = true;
}

function setLastMessageStatus(status) {
  const el = document.getElementById("last-msg-status");
  if (!el) return;
  if (status === "seen") {
    el.textContent = "Seen";
    el.classList.add("seen");
  }
}

// Remove the Seen label once she replies (Feature 2)
function removeSeenStatus() {
  const el = document.getElementById("last-msg-status");
  if (el) el.remove();
}

function setHeaderStatus(status) {
  const el = document.getElementById("chat-header-status");
  if (!el) return;
  el.className = "chat-hstatus";
  if (status === "typing") {
    el.textContent = "typing...";
    el.classList.add("typing");
  } else if (status === "sleeping") {
    el.textContent = "😴 She's asleep";
    el.classList.add("sleeping");
  } else {
    el.textContent = "online";
  }
}

function showTypingIndicator() {
  if (document.getElementById("typing-row")) return;
  const messages = document.getElementById("chat-messages");
  const row = document.createElement("div");
  row.className = "typing-row";
  row.id        = "typing-row";
  row.innerHTML = `<div class="typing-bubble">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  const wasNearBottom = _isChatNearBottom();
  messages.appendChild(row);
  _playRowEntrance(row, 'typing-row--in');
  _followChatIfAtBottom(wasNearBottom, false);
}

function hideTypingIndicator() {
  const row = document.getElementById("typing-row");
  if (row) row.remove();
}

// Guarantees at least `minOverflowPx` of real scrollable overflow on `el`,
// a flex:1 scroll container whose own box is routinely taller than its
// actual content (header/composer above and below only leave so much
// room) — overflow:auto containers like this floor el.scrollHeight to
// el.clientHeight the instant content doesn't overflow, which also means a
// *little* short of overflowing reads identically to "wildly short of it";
// scrollHeight alone can't tell the two apart. el.scrollHeight can't be
// trusted here, so this measures the real content extent via the last
// child's own rendered rect instead, which isn't subject to that floor,
// then adds or removes a trailing spacer to close the gap. A container
// with zero overflow can't be touch-scrolled or bounced at all in WebKit,
// not even slightly, so without this, v-scroll looks completely dead
// whenever content is short (a fresh chat/AI Coach with no messages yet,
// or still only a message or two in).
function _ensureScrollableOverflow(el, minOverflowPx) {
  if (!el) return;
  const spacerId = '_scrollSpacer_' + el.id;
  const existing = document.getElementById(spacerId);
  if (existing) existing.remove();
  const kids = el.children;
  const elRect = el.getBoundingClientRect();
  // Last child that is actually laid out — a hidden one (display:none) has an
  // all-zero rect, which made the spacer enormous (the profile's hidden Tagged tab).
  let lastKid = null;
  for (let i = kids.length - 1; i >= 0; i--) { if (kids[i].getClientRects().length) { lastKid = kids[i]; break; } }
  const lastRect = lastKid ? lastKid.getBoundingClientRect() : null;
  const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  const contentHeight = (lastRect ? lastRect.bottom - elRect.top : 0) + paddingBottom;
  const needed = (el.clientHeight + minOverflowPx) - contentHeight;
  if (needed > 0) {
    const spacer = document.createElement('div');
    spacer.id = spacerId;
    spacer.style.flex = 'none';
    spacer.style.height = needed + 'px';
    el.appendChild(spacer);
  }
}

// The spacer _ensureScrollableOverflow() adds (if any) sits past the real
// content on purpose, purely to give overflow:auto something to drag/
// bounce into when there's otherwise nothing to scroll — it must never
// count as part of "the bottom" for an actual scroll-to-latest-message
// action, or that action overshoots into blank space past the real last
// message. Looked up fresh by id rather than threading a value through,
// so any call site (including ones that never called
// _ensureScrollableOverflow themselves, like the keyboard nudge code's own
// scroll fixup) gets the correct, spacer-excluded height.
function _logicalScrollHeight(el) {
  const spacer = document.getElementById('_scrollSpacer_' + el.id);
  return el.scrollHeight - (spacer ? spacer.offsetHeight : 0);
}

// `el.scrollTop = el.scrollHeight` is the normal "scroll to bottom" idiom
// everywhere else in this app, and it's correct — ONLY because the browser
// clamps an over-large assignment down to the real max, (scrollHeight -
// clientHeight), and raw scrollHeight is always >= that max. But
// _logicalScrollHeight() (scrollHeight with the spacer excluded) is NOT
// guaranteed to be >= that max — it can land anywhere below clientHeight
// on a short conversation — so assigning it directly isn't reliably
// clamped to the right spot; it just sets scrollTop to whatever that raw
// number happens to be, overshooting once the container shrinks further
// (e.g. the keyboard opening while the suggestions panel is also open).
// This explicitly computes the real target instead of leaning on clamping.
function _scrollToLogicalBottom(el) {
  el.scrollTop = Math.max(0, _logicalScrollHeight(el) - el.clientHeight);
}

// Deliberate jump to the newest message — your own send, opening a chat,
// tapping jump-to-latest. Always goes, and clears the unseen count.
function scrollToBottom() {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;
  _ensureScrollableOverflow(messages, 48);
  _scrollToLogicalBottom(messages);
  state.chatUnseen = 0;
  _updateChatScrollBottomBtn();
}

// How close to the bottom still counts as "following the conversation".
const CHAT_STICK_THRESHOLD = 120;
function _isChatNearBottom() {
  const m = document.getElementById("chat-messages");
  if (!m) return true;
  return _logicalScrollHeight(m) - m.scrollTop - m.clientHeight < CHAT_STICK_THRESHOLD;
}

// Her messages and the typing indicator go through here instead of
// scrollToBottom(): if you're scrolled up reading older messages, you keep
// your place and the jump-to-latest button counts what arrived, rather than
// being yanked to the bottom mid-read. `wasNearBottom` has to be sampled
// BEFORE the new content is appended, or the new bubble's own height makes
// it look like you'd scrolled away.
function _followChatIfAtBottom(wasNearBottom, isNewMessage) {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;
  _ensureScrollableOverflow(messages, 48);
  if (wasNearBottom) _scrollToLogicalBottom(messages);
  else if (isNewMessage) state.chatUnseen = (state.chatUnseen || 0) + 1;
  _updateChatScrollBottomBtn();
}

// Jump-to-latest button — shown once the user has scrolled far enough away
// from the newest message that it's no longer obviously one swipe away.
const CHAT_SCROLL_BOTTOM_THRESHOLD = 200;
function _updateChatScrollBottomBtn() {
  const messages = document.getElementById("chat-messages");
  const btn = document.getElementById("chat-scroll-bottom-btn");
  if (!messages || !btn) return;
  const distanceFromBottom = _logicalScrollHeight(messages) - messages.scrollTop - messages.clientHeight;
  if (distanceFromBottom < CHAT_STICK_THRESHOLD) state.chatUnseen = 0; // scrolled back down — caught up
  const unseen = state.chatUnseen || 0;
  // Stays up whenever there's something unread, even if you're not far from
  // the bottom — otherwise a message arriving just below the fold would be
  // silently missed.
  btn.hidden = distanceFromBottom < CHAT_SCROLL_BOTTOM_THRESHOLD && !unseen;
  btn.classList.toggle('chat-scroll-bottom-btn--count', unseen > 0);
  const label = btn.querySelector('.chat-scroll-bottom-label');
  if (label) label.textContent = unseen ? `${unseen} new message${unseen > 1 ? 's' : ''}` : '';
}
(function () {
  const messages = document.getElementById("chat-messages");
  if (messages) messages.addEventListener("scroll", _updateChatScrollBottomBtn, { passive: true });
})();

function setSendEnabled(enabled) {
  const btn = document.getElementById("send-btn");
  if (btn) btn.disabled = !enabled;
}

// Feature 3: small circle avatar beside every bubble (Instagram DM size)
function createMsgAvatar(isAI) {
  const el = document.createElement('div');
  el.className = 'msg-avatar';
  if (isAI) {
    el.style.background = (state.character && state.character.color) || '#b0b0b0';
    el.innerHTML = _pfpImgHTML(state.character);
    el.setAttribute('data-open-profile', '');
    el.onclick = (e) => { e.stopPropagation(); openPersonaProfile(state.character); };
  } else {
    el.style.background = '#d1d5db';
  }
  return el;
}


// ================================================================
// SWIPE DECK — module-level drag state (outside `state` object)
// ================================================================

let drag = {
  active:   false,
  card:     null,
  startX:   0,
  startY:   0,
  currentX: 0,
  currentY: 0,
  rotate:   0,
};

const SWIPE_THRESHOLD = 90;  // px from center to commit a swipe — still deliberate, not a light nudge, just reachable without a long drag
const MAX_ROTATION    = 15;   // max degrees of tilt while dragging
const DRAG_FOLLOW_RESISTANCE = 0.8; // card visually translates at 80% of the raw finger delta — gives the drag some "weight" instead of a raw 1:1 snap; rotation/stamps/back-card feedback stay tied to the true (undamped) distance so progress-toward-threshold still reads accurately
const TAP_MAX_MOVEMENT = 6;   // px — below this, a release counts as a tap, not a drag

// The card's visible POSITION lags behind the raw finger delta via
// exponential smoothing — same technique, same 0.3 factor, already proven
// on the onboarding demo card (see cineArmDragSmoothing()). A fast/long
// real flick can otherwise translate the raw delta far past where
// commitSwipe()'s own fixed-duration fly-off animation is headed (its
// target is a constant screen-relative point, not relative to wherever the
// drag let go) before that animation even starts — reading as "the swipe
// is instant" on a fast gesture, and only looking right when dragged
// slowly. Rotation and the stamp/back-card feedback deliberately keep
// tracking the raw, unsmoothed delta (see DRAG_FOLLOW_RESISTANCE's own
// comment) — only the rendered position is speed-capped, so how quickly a
// drag counts toward the threshold doesn't change, just how fast the card
// visibly travels once it's moving.
let _deckSmoothRAF = null;
function _startDeckDragSmoothing(card) {
  if (_deckSmoothRAF) cancelAnimationFrame(_deckSmoothRAF);
  let visX = 0, visY = 0;
  const step = () => {
    if (!drag.active || drag.card !== card) { _deckSmoothRAF = null; return; }
    visX += (drag.currentX - visX) * 0.3;
    visY += (drag.currentY - visY) * 0.3;
    card.style.transform =
      `translate(${visX * DRAG_FOLLOW_RESISTANCE}px, ${visY * 0.4 * DRAG_FOLLOW_RESISTANCE}px) rotate(${drag.rotate}deg)`;
    _deckSmoothRAF = requestAnimationFrame(step);
  };
  _deckSmoothRAF = requestAnimationFrame(step);
}


// ================================================================
// initSwipeDeck()
// Called by showTab('practice'). Shuffles the PROFILES pool only
// when the deck is exhausted; otherwise resumes where it left off.
// ================================================================

// ---- Who appears in the deck -----------------------------------------
// The deck draws from one of two libraries, chosen by the "Who to practice
// with" setting (zelo_practice_mode: women / men / nonbinary / both) combined with
// who the user is (zelo_onb_gender) — see initSwipeDeck's "which library".
// Men / Non-binary still use the placeholder pool below — no such personas exist yet.
//
// On top of that sits the Age Range screen. It has a dual-handle slider
// (zelo_age_filter_min / _max) and a "Show only people in this age range"
// toggle (zelo_age_filter_strict, on by default); picking a preset row just
// moves the slider. Until now none of that reached the deck: the old filter
// matched presets against `profile.age_pool`, and the 10 pilot profiles carry
// '18-24' — a value no preset ever mapped to — so the lookup always came up
// empty and silently fell back to EVERYONE. The filter now reads the real age.
function _ageFilterRange() {
  const lo = localStorage.getItem('zelo_age_filter_min');
  const hi = localStorage.getItem('zelo_age_filter_max');
  let min = lo === null ? null : parseInt(lo, 10);
  let max = hi === null ? null : parseInt(hi, 10);
  if (min === null && max === null) {
    const preset = AGE_FILTER_PRESET_RANGES[localStorage.getItem('zelo_age_range')];
    if (!preset) return null;                       // nothing chosen: any age
    [min, max] = preset;
  }
  if (min === null || isNaN(min)) min = AGE_FILTER_MIN_BOUND;
  if (max === null || isNaN(max)) max = AGE_FILTER_MAX_BOUND;
  // The slider's top stop (39) is open-ended: anything at or past it counts.
  const open = max >= AGE_FILTER_MAX_BOUND;
  if (min <= AGE_FILTER_MIN_BOUND && open) return null;   // full span = any age
  return { min, max: open ? Infinity : max };
}

function _ageFilterStrict() {
  return (localStorage.getItem('zelo_age_filter_strict') ?? 'true') === 'true';
}

// Text for Practice Preferences' "Age range" row.
function _ageRangeLabel() {
  const r = _ageFilterRange();
  if (!r) return 'Any';
  return `${r.min}–${r.max === Infinity ? AGE_FILTER_MAX_BOUND : r.max}`;
}

// Anything that changes who can appear has to throw the current deck away,
// or the change is invisible until it happens to run out.
function _invalidateDeck() {
  state.swipeIndex = state.swipeProfiles.length;
}

// opts.fresh rebuilds the deck even if the current one still has cards;
// opts.ignoreSkipped builds it from the FULL pool instead of leaving out
// Skipped Profiles — and, for the same reason, ignores the age range. The
// practice tutorial uses both: it needs at least 3 cards (swipe-right lesson,
// swipe-left lesson, photo-nav lesson) and running out mid-lesson silently
// ends the whole tutorial, so it must never depend on how many profiles
// someone happened to have skipped or filtered out.
// The practice tutorial always opens on these two, so every user is taught on
// the same cards: Kendra (24), 4th photo, for "swipe right"; Haeun (21), 3rd
// photo, for "swipe left". `photo` is the 0-based slot.
const PRACTICE_TUTORIAL_CARDS = [{ id: 'z019', photo: 3 }, { id: 'z026', photo: 2 }];

function initSwipeDeck(opts = {}) {
  if (opts.fresh || state.swipeIndex >= state.swipeProfiles.length) {
    // A reshuffled deck is a clean slate — a profile coming back around
    // later should start on photo 1, not wherever it was left last time.
    _forgetCardPhotoIndexes();
    state.deckEmptyReason = null;
    state.skipHistory = [];
    const practiceMode = _practiceMode();
    const myGender = localStorage.getItem('zelo_onb_gender');
    const skippedIds = opts.ignoreSkipped ? new Set() : _skippedProfileIds();
    // The tutorial's two demo cards are fixed, and are kept out of the deck
    // that follows it so they don't come straight back round.
    const excluded = new Set(opts.exclude || []);
    const finishDeck = () => {
      if (opts.tutorial) {
        const lead = PRACTICE_TUTORIAL_CARDS.map(c => PROFILES.find(p => p.id === c.id)).filter(Boolean);
        const leadIds = new Set(lead.map(p => p.id));
        state.swipeProfiles = [...lead, ...state.swipeProfiles.filter(p => !leadIds.has(p.id))];
        PRACTICE_TUTORIAL_CARDS.forEach(c => { _cardPhotoIndex[c.id] = c.photo; });
      }
      // Keep a given card on top if it is still part of the deck — used so the
      // card the user has already been looking at doesn't swap under them.
      if (opts.pin) {
        const i = state.swipeProfiles.findIndex(p => p.id === opts.pin);
        if (i > 0) state.swipeProfiles.unshift(...state.swipeProfiles.splice(i, 1));
      }
    };

    // No real male or non-binary personas exist yet — until they're written,
    // those two fall back to the same 10 placeholder layout cards used for design
    // review, rather than silently showing the women's deck with no indication
    // the preference did anything. (Everyone is the real library for now.)
    if (practiceMode === 'men' || practiceMode === 'nonbinary') {
      let pool = TEST_LAYOUT_PROFILES.filter(p => !skippedIds.has(p.id) && !excluded.has(p.id));
      if (pool.length === 0) pool = TEST_LAYOUT_PROFILES; // everyone's skipped — refill rather than show an empty deck
      state.swipeProfiles = shuffleArray([...pool]);
      state.swipeIndex    = 0;
      finishDeck();
      renderDeck();
      return;
    }

    // 1) which library — decided by WHO THEY ARE and who they want, not by a
    // sexuality label. The 100 "women" personas are written as straight women and
    // the 35 "other" ones as LGBTQ+ women:
    //   man  + Women -> the straight-women library only
    //   woman + Women -> the LGBTQ+ women first, the rest after (so the deck is
    //                    never tiny) — she can be gay or bi, we never ask
    //   anyone else + Women, and Everyone -> the whole library, mixed
    let pool = PROFILES.filter(p => !excluded.has(p.id));
    let leadCategory = null;
    if (practiceMode === 'women') {
      if (myGender === 'male') pool = pool.filter(p => p.category !== 'other');
      else if (myGender === 'female') leadCategory = 'other';
    }

    // 2) the age range
    const range = opts.ignoreSkipped ? null : _ageFilterRange();
    let preferred = null;
    if (range) {
      const inRange = p => p.age >= range.min && p.age <= range.max;
      if (_ageFilterStrict()) {
        pool = pool.filter(inRange);             // "show ONLY people in this range"
      } else {
        preferred = new Set(pool.filter(inRange).map(p => p.id));   // soft: range first
      }
    }

    // A strict range can legitimately match nobody (e.g. Other option, 18-19
    // only has a couple of people). Say so, rather than quietly showing
    // everyone — that would contradict the very setting the user just made.
    if (pool.length === 0) {
      state.swipeProfiles = [];
      state.swipeIndex    = 0;
      state.deckEmptyReason = 'filter';
      renderDeck();
      return;
    }

    // 3) skipped profiles
    // Skipped Profiles' whole premise ("won't show up again" / Unskip to
    // undo that) needs an actual exclusion here — without it the deck
    // already re-includes everyone on its own next reshuffle regardless
    // of anyone's skip history, making both halves of that page a no-op.
    let unseen = pool.filter(p => !skippedIds.has(p.id));
    if (unseen.length === 0) unseen = pool; // everyone in the pool is skipped — refill rather than dead-end the deck

    // Soft orderings (age range when not strict, then the lead category), each
    // shuffled inside its own tier.
    const rank = p => (preferred && !preferred.has(p.id) ? 2 : 0) + (leadCategory && p.category !== leadCategory ? 1 : 0);
    const tiers = [[], [], [], []];
    unseen.forEach(p => tiers[rank(p)].push(p));
    state.swipeProfiles = tiers.flatMap(t => shuffleArray(t));
    state.swipeIndex = 0;
    finishDeck();
  }
  renderDeck();
}


// ================================================================
// shuffleArray() — Fisher-Yates in-place shuffle
// ================================================================

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ================================================================
// renderDeck()
// Clears #card-deck and paints up to 3 cards (back-to-front so the
// top card is last in DOM = highest stacking context).
// ================================================================

function renderDeck(opts = {}) {
  const deck      = document.getElementById('card-deck');
  // A card mid-fly-off is passed in so the deck can be rebuilt UNDER it
  // while it is still animating out — see commitSwipe.
  const keep      = (opts.keep && opts.keep.parentNode === deck) ? opts.keep : null;
  // Every card still flying out is kept, not just the newest one — a skip's
  // fly-off must finish too, or its "skipped" record is never written.
  [...deck.children].forEach(ch => { if (ch !== keep && !ch.classList.contains('swipe-card--flying')) ch.remove(); });

  const remaining = state.swipeProfiles.length - state.swipeIndex;

  if (remaining <= 0) {
    const filtered = state.deckEmptyReason === 'filter';
    deck.insertAdjacentHTML('afterbegin', `
      <div class="deck-empty">
        <div class="deck-empty-icon">${filtered ? '🔍' : '✨'}</div>
        <div class="deck-empty-title">${filtered ? 'No one matches your filters' : "You've seen everyone"}</div>
        <div class="deck-empty-sub">${filtered
          ? 'Try widening your age range in Home settings.'
          : 'Check your Chats or come back later for new people.'}</div>
      </div>`);
    disableSwipeButtons();
    return;
  }

  const count = Math.min(3, remaining);

  // Render back-to-front: stack index 2 first, 0 last (sits on top)
  for (let i = count - 1; i >= 0; i--) {
    const profile = state.swipeProfiles[state.swipeIndex + i];
    const cardEl  = buildCardElement(profile, i);
    if (keep) deck.insertBefore(cardEl, keep); else deck.appendChild(cardEl);
  }

  // Only the top card gets drag listeners
  const topCard = deck.querySelector('[data-stack="0"]');
  if (topCard) attachDragListeners(topCard);

  enableSwipeButtons();
}

// REMOVED (2026-10-10h): a `new Image()` preloader for the next few
// profiles' first photo. It measurably bought nothing — the promoted card
// reuses the src the card behind already loaded, so it reports `complete`
// on the first frame either way — while forcing a FULL decode of each
// preloaded photo. These are 1080x1350, i.e. ~5.6 MB of bitmap each once
// decoded, so it added ~22 MB on top of the deck's own ~17 MB, every
// single swipe. Suspected cause of images elsewhere failing to decode and
// video going black on device; nothing else is worth that risk.


// ================================================================
// buildCardElement()
// Creates one .swipe-card DOM node for a given profile.
// ================================================================

const INTEREST_ICONS = {
  // Food & drink
  'Coffee': '☕', 'Specialty coffee': '☕', 'Matcha': '🍵', 'Boba': '🧋', 'Bubble tea': '🧋',
  'Cooking': '🍳', 'Baking': '🧁', 'Wine': '🍷', 'Nutrition': '🥗', 'Sushi': '🍣', 'Brunch': '🥂',
  // Fitness & outdoors
  'Running': '🏃', 'Hiking': '🥾', 'Cycling': '🚴', 'Fitness': '💪', 'Yoga': '🧘',
  'Boxing': '🥊', 'Cold plunges': '🧊', 'Rock climbing': '🧗', 'Surfing': '🏄', 'Dancing': '💃',
  // Music & media
  'Music': '🎵', 'Live music': '🎵', 'Indie music': '🎸', 'Podcasts': '🎧', 'K-pop': '🎤',
  'Piano': '🎹', 'K-dramas': '📺', 'Reality TV': '📺', 'Documentaries': '📺', 'Anime': '🎌',
  // Arts & creativity
  'Art': '🎨', 'Photography': '📷', 'Film photography': '📷', 'Writing': '✍️',
  'Art galleries': '🖼️', 'Interior design': '🏠',
  // Books & learning
  'Books': '📚', 'Reading': '📖', 'Entrepreneurship': '💡', 'Politics': '🗞️',
  // Travel
  'Travel': '✈️', 'Japanese culture': '🏯',
  // Fashion & lifestyle
  'Fashion': '👗', 'Thrifting': '🛍️', 'Vintage clothing': '👗', 'Makeup': '💄', 'Skincare': '🧴',
  // Pets
  'Dogs': '🐶', 'Cats': '🐱',
  // Gaming & hobbies
  'Gaming': '🎮', 'Nintendo': '🎮', 'Board games': '🎲',
  // Nature
  'Plants': '🌿', 'Aquariums': '🐠',
  // Misc
  'Formula 1': '🏎️'
};

// Shared by the swipe card and the full-screen profile detail page.
function buildInterestTagsHTML(interests) {
  return interests
    .map(i => {
      const icon = INTEREST_ICONS[i] || '✨';
      return `<span class="interest-tag">${icon} ${i}</span>`;
    })
    .join('');
}

// EXPERIMENT (2026-10-10): floating pill tab bar, in the style of LINE's —
// a detached rounded bar inset from the screen edges with a soft grey chip
// behind the active tab, instead of the full-width frosted-glass bar.
// Flip to false to go back; everything else is driven off the
// .tab-bar--floating class, so the original bar is untouched.
const TAB_BAR_FLOATING = true;
function _applyFloatingTabBar() {
  if (!TAB_BAR_FLOATING) return;
  document.getElementById('tab-bar')?.classList.add('tab-bar--floating');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _applyFloatingTabBar);
} else {
  _applyFloatingTabBar();
}

// Full-bleed card layout: the photo fills the whole card and the name /
// actions sit over it behind a gradient scrim, instead of below it on a
// white panel. Flip this one constant to go back to the panel layout —
// everything else is driven off the .swipe-card--full class.
const CARD_FULL_BLEED = true;

// Show the photo at its true aspect ratio (object-fit: contain) with a
// blurred copy of itself filling the leftover space, instead of cropping it
// to the card (object-fit: cover). Nothing is cut off — the trade is that
// the subject renders smaller. Flip to true for the uncropped look.
// Currently false: back to the 2026-10-09m cover-cropped look on request.
const CARD_PHOTO_UNCROPPED = false;

// The two pills at the top-left of a card: what she is (orientation) and what she
// is looking for. Placeholder cards have neither, so they get no pills.
function _cardPillsHTML(profile) {
  const intent = profile.intent && PERSONA_INTENTS[profile.intent];
  if (!profile.orientation && !intent) return '';
  return `<div class="swipe-card-pills" aria-hidden="true">
    ${profile.orientation ? `<span class="swipe-card-pill swipe-card-pill--orient">${_escapeHtml(profile.orientation)}</span>` : ''}
    ${intent ? `<span class="swipe-card-pill swipe-card-pill--intent">${_escapeHtml(intent.label)}</span>` : ''}
  </div>`;
}

function buildCardElement(profile, stackIndex) {
  const card        = document.createElement('div');
  card.className    = 'swipe-card'
    + (CARD_FULL_BLEED ? ' swipe-card--full' : '')
    + (CARD_PHOTO_UNCROPPED ? ' swipe-card--uncropped' : '')
    + (_practiceTutorialActive ? ' swipe-card--bare' : '');   // tutorial: photo only, no name/buttons
  card.dataset.stack = stackIndex;
  card._profile     = profile; // read by _navigateCardPhoto() to swap photo slots

  // renderDeck() wipes and rebuilds every card, so without this the photo
  // slot resets to 1 every time the deck is re-rendered — which includes
  // simply leaving the Practice tab and coming back.
  const startIdx = _rememberedPhotoIndex(profile);
  card.dataset.photoIndex = String(startIdx);

  const photos   = (profile.photos && profile.photos.length) ? profile.photos : null;
  const startSrc = photos ? (photos[startIdx] || photos[0]) : '';
  // Two stacked layers, swapped by _setCardPhoto() so a photo change can
  // cross-fade instead of popping. Each holds both image layers (the
  // contained photo and, in uncropped mode, the blurred backdrop) so the
  // pair always moves together.
  // The blurred backdrop only exists in uncropped mode, where it is the
  // thing that fills the space beside a contained photo. In cropped mode it
  // is `display: none` — but a hidden <img> with a src still downloads AND
  // decodes, and at 1080x1350 that is ~5.6 MB of bitmap per card for
  // something never drawn. Emit it only when it is actually used.
  const photoLayer = (active) => `
    <div class="swipe-card-photo-layer${active ? ' is-active' : ''}">
      ${CARD_PHOTO_UNCROPPED
        ? `<img class="swipe-card-photo-bg" src="${startSrc}" alt="" aria-hidden="true" onerror="this.remove()">`
        : ''}
      <img class="swipe-card-photo-main" src="${startSrc}" alt="" aria-hidden="true" onerror="this.remove()">
    </div>`;

  card.innerHTML = `
    <div class="swipe-card-photo">
      ${photos ? `<div class="swipe-card-photo-stack">${photoLayer(true)}${photoLayer(false)}</div>` : ''}
      <div class="swipe-card-progress" aria-hidden="true">
        ${Array.from({ length: SWIPE_PHOTO_SLOTS }, (_, i) =>
          `<span class="swipe-card-progress-seg${i === startIdx ? ' is-active' : ''}"></span>`).join('')}
      </div>
      ${_cardPillsHTML(profile)}
      ${photos ? '' : `<span class="swipe-photo-label">Card ${startIdx + 1}</span>`}
    </div>
    <div class="swipe-card-bare-blur" aria-hidden="true"></div>
    <div class="swipe-stamp swipe-stamp--like">LIKE ♥</div>
    <div class="swipe-stamp swipe-stamp--nope">NOPE ✕</div>
    <div class="swipe-card-overlay">
    <div class="swipe-card-body">
      <div class="swipe-card-name-row">
        <span class="swipe-card-name">${profile.name}, ${profile.age}</span>
        ${stackIndex === 0 ? `<button type="button" class="swipe-card-info-btn" onclick="openProfileDetail()" aria-label="More info">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9.5"/>
            <line x1="12" y1="11" x2="12" y2="16.5"/>
            <circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none"/>
          </svg>
        </button>` : ''}
      </div>
      <span class="swipe-card-occ">${profile.occupation}</span>
    </div>
    <hr class="swipe-card-divider"/>
    <div class="swipe-card-actions">
      <button type="button" class="swipe-rewind-btn"${stackIndex === 0 ? ' id="btn-rewind" onclick="onRewindBtn()"' : ' tabindex="-1" aria-hidden="true"'}${(state.skipHistory && state.skipHistory.length) ? '' : ' disabled'} aria-label="Bring back the last person you skipped"><span class="swipe-rewind-ic" aria-hidden="true"></span></button>
      <button type="button" class="swipe-action-btn swipe-action-btn--skip"${stackIndex === 0 ? ' id="btn-skip" onclick="onSkipBtn()"' : ' tabindex="-1" aria-hidden="true"'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Skip
      </button>
      <button type="button" class="swipe-action-btn swipe-action-btn--like"${stackIndex === 0 ? ' id="btn-like" onclick="onLikeBtn()"' : ' tabindex="-1" aria-hidden="true"'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        I'm Interested
      </button>
    </div>
    </div>
  `;

  return card;
}

// Tap left/right half of the card's photo to step back/forward through its
// 4 "cards" (replaces the old tap-anywhere-opens-profile-detail behavior
// and the (i) "more about them" popup — both removed). Only card slots
// 2-4 exist as placeholders for now; real per-slot photos are a separate,
// later pass (see SWIPE_PHOTO_SLOTS).
const SWIPE_PHOTO_SLOTS = 4;

// How long the cross-fade between two photo slots runs. Kept in sync with
// .swipe-card-photo-layer.is-entering's animation duration in style.css.
const CARD_PHOTO_FADE_MS = 260;

// Which photo slot each profile was last left on, so re-rendering the deck
// (leaving the Practice tab and coming back, a settings change, anything
// that calls renderDeck()) doesn't throw you back to photo 1. Keyed by
// profile id; cleared whenever the deck is reshuffled from scratch.
const _cardPhotoIndex = Object.create(null);

function _cardPhotoKey(profile) {
  return profile && (profile.id || profile.name) || '';
}

function _rememberedPhotoIndex(profile) {
  const saved = _cardPhotoIndex[_cardPhotoKey(profile)];
  if (!saved) return 0;
  return Math.max(0, Math.min(SWIPE_PHOTO_SLOTS - 1, saved));
}

function _forgetCardPhotoIndexes() {
  for (const k in _cardPhotoIndex) delete _cardPhotoIndex[k];
}

// Swaps the visible photo by promoting the inactive layer rather than
// re-pointing one <img>'s src, so the new photo fades in over the old one
// instead of popping. The outgoing layer deliberately keeps opacity 1 and
// just drops behind — fading BOTH would let the black card background show
// through at the midpoint and read as a dip to dark.
function _setCardPhoto(cardEl, idx, photos) {
  const layers = cardEl.querySelectorAll('.swipe-card-photo-layer');
  if (layers.length < 2 || !photos || !photos[idx]) return;

  const cur = cardEl.querySelector('.swipe-card-photo-layer.is-active') || layers[0];
  const nxt = (cur === layers[0]) ? layers[1] : layers[0];
  nxt.querySelectorAll('img').forEach(im => { im.src = photos[idx]; });

  // Guards a fast double-tap: two decodes can be in flight at once, and
  // without this the slower one could land last and show the wrong slot.
  const gen = cardEl._photoGen = (cardEl._photoGen || 0) + 1;
  const show = () => {
    if (cardEl._photoGen !== gen) return;
    // Removing + reflowing first, so a re-tap mid-fade restarts the
    // animation instead of being swallowed by the running one.
    nxt.classList.remove('is-entering');
    void nxt.offsetWidth;
    nxt.classList.add('is-active', 'is-entering');
    cur.classList.remove('is-active');
    // The entrance must not stay on the element: a permanent `animation`
    // replays on every reparent (see the 2026-10-09j swipe-blink case).
    setTimeout(() => nxt.classList.remove('is-entering'), CARD_PHOTO_FADE_MS + 40);
  };

  // Decode before showing, so the fade can never reveal a half-painted
  // image on a slot that isn't in the cache yet.
  const main = nxt.querySelector('.swipe-card-photo-main');
  if (main && main.decode) main.decode().then(show).catch(show);
  else show();
}

function _renderCardProgress(cardEl, idx) {
  cardEl.querySelectorAll('.swipe-card-progress-seg')
    .forEach((seg, i) => seg.classList.toggle('is-active', i === idx));
}

function _navigateCardPhoto(cardEl, dir) {
  const current = Number(cardEl.dataset.photoIndex) || 0;
  const next = Math.max(0, Math.min(SWIPE_PHOTO_SLOTS - 1, current + dir));
  // Already at the first or last photo: this used to do nothing at all, so
  // there was no way to tell "there's nothing there" from "the tap missed".
  // Nudge the card a short way in the attempted direction and let it spring
  // back, the way a scroll view rubber-bands at its end.
  if (next === current) { _bounceCardEdge(cardEl, dir); return; }
  // A real move cancels any edge bounce still playing, so the card can't be
  // mid-rubber-band while the photo changes under it.
  cardEl.classList.remove('swipe-card--edge-left', 'swipe-card--edge-right');
  cardEl.dataset.photoIndex = String(next);
  _renderCardProgress(cardEl, next);
  if (cardEl._profile) _cardPhotoIndex[_cardPhotoKey(cardEl._profile)] = next;
  const label = cardEl.querySelector('.swipe-photo-label');
  if (label) label.textContent = 'Card ' + (next + 1);
  // Real photo for this slot, when the profile has one. The per-slot
  // placeholder colours stay as the fallback for profiles that don't.
  const photos = (state.deckProfiles && state.deckProfiles[Number(cardEl.dataset.stack)] || {}).photos
              || (cardEl._profile && cardEl._profile.photos);
  _setCardPhoto(cardEl, next, photos);
}

// Wires the Open/Neutral/Cold pills inside the full-screen profile detail
// page. Cold is locked for free users outside their 7-day trial window —
// tapping it just shows the paywall note inline, it never commits the
// selection.
function attachProfileDetailModeListeners(profile) {
  const wrap   = document.getElementById('pd-mode-pills');
  const descEl = document.getElementById('pd-mode-desc');
  wrap.querySelectorAll('.card-mode-pill').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      const config = CARD_MODES.find(m => m.key === mode);
      const locked = !config.free && !isColdAvailable();

      descEl.textContent = config.desc;

      if (locked) {
        btn.classList.add('locked-tap');
        setTimeout(() => btn.classList.remove('locked-tap'), 260);
        return;
      }

      wrap.querySelectorAll('.card-mode-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cardModes[profile.name] = mode;
    };
  });
}


// ================================================================
// DRAG / TOUCH SYSTEM
// Mouse and touch share the same onDragStart/Move/End handlers.
// Mouse listeners for move/up go on document so the card doesn't
// lose track when the cursor leaves the card boundary.
// ================================================================

// True from the moment a RIGHT swipe is committed until its fly-off finishes
// and the match page is on its way. Without it you could keep swiping while the
// first like was still in flight: each later commitSwipe rebuilt the deck and
// removed the earlier flying card before its transitionend fired, so that like
// never produced a match page and was never counted.
let _swipeLock = false;
let _swipeLockTimer = null;
function _releaseSwipeLock() { _swipeLock = false; clearTimeout(_swipeLockTimer); _swipeLockTimer = null; }

function attachDragListeners(cardEl) {
  // Touch
  cardEl.addEventListener('touchstart',  onDragStart, { passive: true });
  cardEl.addEventListener('touchmove',   onDragMove,  { passive: false });
  cardEl.addEventListener('touchend',    onDragEnd);
  cardEl.addEventListener('touchcancel', onDragEnd);
  // Mouse
  cardEl.addEventListener('mousedown', onDragStart);
}

function onDragStart(e) {
  // Don't start drag when tapping Skip/I'm Interested (they live inside
  // the card now, not a separate pinned bar) or the (i) info button.
  if (e.target.closest && e.target.closest('.swipe-card-actions')) return;
  if (e.target.closest && e.target.closest('.swipe-card-info-btn')) return;
  // ...or the practice-tutorial's photo-nav lesson — it has its own tap
  // handler (_practiceTutorialPhotoTap); without this exclusion, that same
  // tap also reached the card's own tap-to-navigate-photos logic in
  // onDragEnd (stopPropagation() on the tutorial's click handler doesn't
  // stop it — mousedown/touchend are separate listeners, not part of the
  // click bubble it's stopping), advancing the real photo index behind
  // the tutorial's own fake one.
  if (e.target.closest && e.target.closest('.ptw-photo-nav-overlay')) return;
  // Ignore if we're mid-animation or a reply is pending
  if (drag.active) return;
  if (_swipeLock && e.currentTarget.id !== 'cine-swipe-card') return;

  const touch = e.touches ? e.touches[0] : e;
  drag.active   = true;
  drag.card     = e.currentTarget;
  drag.startX   = touch.clientX;
  drag.startY   = touch.clientY;
  drag.currentX = 0;
  drag.currentY = 0;
  drag.rotate   = 0;

  // Remove transition so card snaps to finger immediately
  drag.card.style.transition = 'none';

  // The onboarding demo card owns its own separate smoothing loop instead
  // (see cineArmDragSmoothing(), attached alongside this same listener) —
  // it already reads from this same drag.currentX/currentY, so running a
  // second loop here too would just fight it over the same transform.
  if (drag.card.id !== 'cine-swipe-card') _startDeckDragSmoothing(drag.card);

  // Stop the demo the moment a real drag begins (tutorial only — guarded
  // since the guided-tour script that declares tourSwipeArmed is archived
  // and not loaded in the shipped bundle)
  if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) cancelSwipeDemo();

  // Attach document-level mouse handlers (removed in onDragEnd)
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
}

function onDragMove(e) {
  if (!drag.active) return;

  // Prevent page scroll during a horizontal swipe gesture
  if (e.touches) e.preventDefault();

  const touch   = e.touches ? e.touches[0] : e;
  drag.currentX = touch.clientX - drag.startX;
  drag.currentY = touch.clientY - drag.startY;

  // Clamp ratio to ±1 for rotation calc; allow card to move freely beyond.
  // Stays tied to the raw, unsmoothed delta on purpose (see
  // DRAG_FOLLOW_RESISTANCE's own comment) — only the rendered POSITION is
  // speed-capped (_startDeckDragSmoothing()'s rAF loop, reading drag.rotate
  // set here), so progress-toward-threshold still reads accurately and
  // rotation/stamps keep responding immediately, not laggily.
  const ratio   = Math.max(-1, Math.min(1, drag.currentX / SWIPE_THRESHOLD));
  drag.rotate   = ratio * MAX_ROTATION;

  // The onboarding demo card owns its own separate eased rAF follow
  // instead (see cineArmDragSmoothing()); the real deck's own follow is
  // driven by _startDeckDragSmoothing()'s loop (started in onDragStart),
  // not here — this function only feeds it drag.currentX/currentY/rotate.

  // Fade stamps proportionally to drag distance
  const absRatio = Math.abs(ratio);
  const likeStamp = drag.card.querySelector('.swipe-stamp--like');
  const nopeStamp = drag.card.querySelector('.swipe-stamp--nope');

  if (drag.currentX > 0) {
    if (likeStamp) likeStamp.style.opacity = absRatio;
    if (nopeStamp) nopeStamp.style.opacity = 0;
  } else {
    if (nopeStamp) nopeStamp.style.opacity = absRatio;
    if (likeStamp) likeStamp.style.opacity = 0;
  }

  // Nudge background cards toward their "ready" position during drag
  animateBackCards(absRatio);
}

function onDragEnd(e) {
  if (!drag.active) return;
  drag.active = false;

  // A touchend that isn't preventDefault()-ed causes the browser to also
  // synthesize a mousedown/mouseup/click sequence a moment later for
  // compatibility — since mousedown is bound directly on the card (see
  // attachDragListeners) and drag.active is already false by then, that
  // synthetic sequence re-enters this same tap-handling logic a second time
  // and double-applies whatever the tap just did (e.g. stepping 2 photo
  // slots per tap instead of 1). Suppressing it here is the standard fix.
  if (e.touches) e.preventDefault();

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);

  const moved = Math.max(Math.abs(drag.currentX), Math.abs(drag.currentY));

  if (Math.abs(drag.currentX) >= SWIPE_THRESHOLD) {
    const direction = drag.currentX > 0 ? 'right' : 'left';
    commitSwipe(drag.card, direction);
  } else {
    springBack(drag.card);
    // A release with barely any movement is a tap, not a drag — step
    // back/forward through this card's photos depending on which half was
    // tapped (left = back, right = forward), instead of treating it as a
    // swipe. Not applicable to the onboarding demo card — it isn't backed
    // by state.swipeProfiles. Also suppressed during the swipe-right/
    // swipe-left tutorial steps — a stray tap there shouldn't advance a
    // real photo mid-lesson.
    if (moved < TAP_MAX_MOVEMENT && drag.card.id !== 'cine-swipe-card' && !_practiceTutorialActive) {
      const rect = drag.card.getBoundingClientRect();
      const tappedLeftHalf = (drag.startX - rect.left) < rect.width / 2;
      _navigateCardPhoto(drag.card, tappedLeftHalf ? -1 : 1);
    }
  }
}

// Interpolate back-cards toward their next stack position as the top card is dragged
function animateBackCards(absRatio) {
  const deck  = document.getElementById('card-deck');
  const card1 = deck ? deck.querySelector('[data-stack="1"]') : null;
  const card2 = deck ? deck.querySelector('[data-stack="2"]') : null;

  // Tutorial cards behind the top one stay invisible: these inline writes
  // outrank the stylesheet's opacity:0, which is how the next card showed
  // up behind the one being dragged.
  if (card1 && card1.classList.contains('swipe-card--bare')) return;
  if (card1) {
    const scale = 0.95 + (0.05 * absRatio);
    const ty    = 10   - (10   * absRatio);
    card1.style.transform = `scale(${scale}) translateY(${ty}px)`;
    card1.style.opacity   = 0.75 + (0.25 * absRatio);
  }

  if (card2) {
    const scale = 0.90 + (0.05 * absRatio);
    const ty    = 20   - (10   * absRatio);
    card2.style.transform = `scale(${scale}) translateY(${ty}px)`;
    card2.style.opacity   = 0.5  + (0.25 * absRatio);
  }
}

// Spring-back: card returns to resting position with an overshoot bounce
function springBack(cardEl) {
  cardEl.style.transition = 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  // Force a reflow before changing transform — see the matching comment in
  // commitSwipe(); same fast-release "no animation" bug, same fix.
  void cardEl.offsetWidth;
  cardEl.style.transform  = '';

  // Hide stamps
  cardEl.querySelectorAll('.swipe-stamp').forEach(s => s.style.opacity = 0);

  // Let CSS rules restore back-cards to their default stack positions
  const deck  = document.getElementById('card-deck');
  if (!deck) return;
  const card1 = deck.querySelector('[data-stack="1"]');
  const card2 = deck.querySelector('[data-stack="2"]');
  if (card1) { card1.style.transform = ''; card1.style.opacity = ''; }
  if (card2) { card2.style.transform = ''; card2.style.opacity = ''; }
}

// Fly card off-screen, then advance or show match
function commitSwipe(cardEl, direction) {
  const ownedByDeckEarly = cardEl.id !== 'cine-swipe-card';
  if (ownedByDeckEarly && _swipeLock) return;     // a like is still flying out
  if (ownedByDeckEarly && direction === 'right') {
    _swipeLock = true;
    clearTimeout(_swipeLockTimer);
    _swipeLockTimer = setTimeout(_releaseSwipeLock, 1600);   // safety: never leave the deck locked
  }
  disableSwipeButtons();

  // Light buzz right as a "like" swipe commits — right only, not left/nope.
  if (direction === 'right') { navigator.vibrate?.(10); _cineHaptic('LIGHT'); }

  // Guided tutorial swipe: confirm meaning with a motion cue (heart vs X).
  if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) flashSwipeFeedback(direction);

  const flyX = direction === 'right'
    ?  window.innerWidth  * 1.6
    : -window.innerWidth  * 1.6;
  const flyR = direction === 'right' ? 30 : -30;

  // Weightier, more deliberate fly-off than a plain accelerate-and-vanish —
  // material's "standard" curve (fast-ish start, controlled deceleration
  // toward the end) reads as the card being thrown with some real mass
  // behind it rather than snapping off-screen.
  // One throw speed everywhere. The tutorial used to shorten this to close
  // the gap before the next lesson, but the gap was never the animation —
  // it was the lesson text waiting on transitionend. The text is shown as
  // the throw begins now (below), so the throw keeps its full weight.
  const flyMs = 0.7;

  // The deck used to only advance once the throw FINISHED, so for the whole
  // fly-off you were looking at the card behind — scaled 0.95 and offset
  // 10px down — and it then snapped to full size the instant it was
  // promoted, which is the text visibly jumping up. Promote now instead:
  // the next card is built, full size and loading while the old one is
  // still leaving, so there is nothing to wait for and nothing to snap.
  // The onboarding demo card isn't backed by the deck at all, so it opts out.
  const ownedByDeck = cardEl.id !== 'cine-swipe-card';
  const flyingProfile = ownedByDeck ? state.swipeProfiles[state.swipeIndex] : null;
  let tutorialHandled = false;
  let tutorialNeedsFinish = false;
  if (ownedByDeck) {
    // Out of the stack's numbering (and so out of its z-index/scale rules)
    // but still in the deck, so its transition is never interrupted.
    cardEl.classList.add('swipe-card--flying');
    cardEl.removeAttribute('data-stack');
    // Rewind history: a skip can be brought back; a like can't (it already
    // became a match), so a like ends the chain.
    if (!_practiceTutorialActive) {
      if (!state.skipHistory) state.skipHistory = [];
      if (direction === 'left') state.skipHistory.push(state.swipeIndex);
      else state.skipHistory = [];
    }
    state.swipeIndex++;
    renderDeck({ keep: cardEl });

    // The next lesson's text lands NOW, over the card that is already in
    // place, rather than waiting out the 0.7s throw on transitionend. That
    // wait was the whole reason the step change felt slow.
    if (_practiceTutorialActive) {
      tutorialHandled = true;
      tutorialNeedsFinish = _handlePracticeTutorialSwipe(direction, 'start');
    }
  }

  cardEl.style.transition = `transform ${flyMs}s cubic-bezier(0.4, 0.0, 0.2, 1)`;
  // Force a reflow before changing transform — same fix already used in
  // cineAdvanceSwipeQueue(). Without it, a release that lands right after a
  // fast drag can have this transition-enable and the transform change
  // land in the same paint, which some engines then apply instantly with
  // no animation at all instead of interpolating (the "teleports, no
  // animation" bug on a quick flick).
  void cardEl.offsetWidth;
  cardEl.style.transform  = `translate(${flyX}px, 0px) rotate(${flyR}deg)`;

  function onFlyOffDone(e) {
    // transitionend bubbles — the like/nope stamps inside this card have
    // their own separate opacity transition (.swipe-stamp, 0.05s), and
    // without this check ITS completion (routinely fired well within the
    // 0.7s fly-off, any time the last touchmove before release happens to
    // change stamp opacity) would satisfy this listener instead of the
    // card's own transform finishing — cutting the fly-off short and
    // jumping straight to the match screen/next card, reading as the swipe
    // completing "instantly" regardless of how it was actually dragged.
    // Not a plain {once:true}, since that would consume the listener on
    // this first (wrong) event and leave nothing to catch the real one —
    // removed manually instead, only once the right transition actually ends.
    if (e.target !== cardEl || e.propertyName !== 'transform') return;
    cardEl.removeEventListener('transitionend', onFlyOffDone);
    _releaseSwipeLock();

    // Onboarding demo card — a standalone two-card stack, not the real
    // Home tab deck, so it resolves against its own fixed Sophia profile
    // and the onboarding skip flow instead of state.swipeProfiles/renderDeck().
    if (cardEl.id === 'cine-swipe-card') {
      cineCommitDemoSwipe(direction);
      return;
    }

    const profile = flyingProfile;
    cardEl.remove(); // the deck was already advanced when the throw began

    // Practice-tab tutorial: swiping IS the lesson here too — a matching
    // swipe advances to the next step, anything else just re-deals and
    // re-shows the same step's overlay on the new top card. Skips the
    // normal match-overlay/renderDeck continuation entirely while active.
    if (tutorialHandled || _practiceTutorialActive) {
      // The lesson text already advanced when the throw began; only the
      // confirm-profile handoff is deliberately held back to here.
      if (tutorialNeedsFinish) _handlePracticeTutorialSwipe(direction, 'end');
      return;
    }

    // During a Home swipe step, swiping IS the lesson. Each step teaches one
    // direction; a matching swipe advances, anything else just re-deals and
    // re-demos the intended motion.
    if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) {
      cancelSwipeDemo();
      if (direction === tourSwipeDir) {
        tourSwipeArmed = false;
        goNextStep();
      } else {
        runSwipeDemo(tourSwipeDir);        // wrong way — show the move again
      }
      return;
    }

    if (direction === 'right') {
      ZeloAnalytics.track('persona_selected', { persona_id: profile.id });
      _questCountLike(profile && profile.id);
      // Swiping and matching are unrestricted — the free-tier limit gates
      // starting a chat (see onStartChatting()), not matching itself.
      showMatchOverlay(profile);
    } else {
      // Rewound before its fly-off finished: it is back in the deck, so it
      // must not be written down as skipped.
      if (state.swipeProfiles.indexOf(profile) >= state.swipeIndex) return;
      _recordSkippedProfile(profile);
    }
  }
  cardEl.addEventListener('transitionend', onFlyOffDone);
}


// ================================================================
// PRACTICE TAB TUTORIAL — replaces the old "who do you want to practice
// with" mode popup as the first-visit experience. 4 steps: welcome screen
// (practiceTutorialStart/Skip) → swipe-right lesson → swipe-left lesson →
// a 1.5s pause → photo-nav lesson (tap-to-dismiss, no real swipe needed
// since cards don't have multiple photos yet). Reuses the real deck and
// real commitSwipe() throughout — a tutorial swipe is a real swipe, just
// intercepted at the very end (see the _practiceTutorialActive check
// inside commitSwipe) so it advances the lesson instead of the normal
// match-overlay/renderDeck continuation.
// ================================================================

let _practiceTutorialActive = false;
let _practiceTutorialStep   = 0; // 2 = swipe right, 3 = swipe left, 4 = photo nav

// The Practice header's profile and settings buttons open screens
// (Account, Home settings) that make no sense mid-onboarding — and a tap
// there would pull the user out of the tutorial. They are hidden until the
// tutorial is finished. `zelo_mode_selected` is the single source of truth
// for "has finished" (set by _finishPracticeTutorial), so this derives the
// state from it instead of tracking a second flag that could drift.
// ---- "Find your type" quest bar (Practice tab) ------------------------------
// Replaces the old "Today's Top Match / Handpicked for you" heading, which
// promised curation there is no data behind. Counts real likes (right swipes
// outside the tutorial) towards QUEST_LIKES_GOAL, shows progress in a ring,
// celebrates once when it is reached, then goes away for good.
// NOTE: nothing is actually learned from the likes yet — it is a goal bar,
// not a recommender. See CLAUDE.md 2026-10-11l.
const QUEST_LIKES_GOAL = 10;
const QUEST_LIKES_KEY  = 'zelo_quest_likes';
const QUEST_DONE_KEY   = 'zelo_quest_done';
let _questHideTimer = null;

function _questLikes() { return Math.max(0, parseInt(localStorage.getItem(QUEST_LIKES_KEY) || '0', 10) || 0); }

function _renderQuestBar() {
  const bar = document.getElementById('quest-bar');
  if (!bar) return;
  const n = Math.min(_questLikes(), QUEST_LIKES_GOAL);
  const done = n >= QUEST_LIKES_GOAL;
  if (done && localStorage.getItem(QUEST_DONE_KEY)) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.classList.toggle('quest-bar--done', done);
  const left = QUEST_LIKES_GOAL - n;
  document.getElementById('quest-title').textContent = done ? 'You’re all set' : 'Finding your type';
  document.getElementById('quest-sub').textContent = done
    ? `You’ve liked ${QUEST_LIKES_GOAL} people`
    : `Like ${left} more ${left === 1 ? 'person' : 'people'} to get started`;
  const ring = document.getElementById('quest-ring-fill');
  if (ring) ring.style.strokeDashoffset = String(125.66 * (1 - n / QUEST_LIKES_GOAL));
  if (done && !_questHideTimer) {
    // Shown once as a win, then it fades away and never comes back.
    _questHideTimer = setTimeout(() => {
      localStorage.setItem(QUEST_DONE_KEY, '1');
      bar.classList.add('quest-bar--out');
      setTimeout(() => { bar.hidden = true; bar.classList.remove('quest-bar--out'); _questHideTimer = null; }, 450);
    }, 4000);
  }
}

// Counts people, not swipes: liking the same person twice (or any double-fired
// handler) can never count twice.
const QUEST_LIKED_KEY = 'zelo_quest_liked';
function _questCountLike(profileId) {
  if (localStorage.getItem(QUEST_DONE_KEY)) return;
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(QUEST_LIKED_KEY) || '[]'); } catch (_) {}
  const key = profileId || ('anon' + ids.length);
  if (ids.includes(key)) return;
  ids.push(key);
  localStorage.setItem(QUEST_LIKED_KEY, JSON.stringify(ids));
  localStorage.setItem(QUEST_LIKES_KEY, String(ids.length));
  _renderQuestBar();
}

function _syncPracticeOnboardingChrome() {
  const tab = document.getElementById('tab-practice');
  if (!tab) return;
  tab.classList.toggle('tab--onboarding', !localStorage.getItem('zelo_mode_selected'));
  _renderQuestBar();
}

function startPracticeTutorial() {
  _syncPracticeOnboardingChrome();
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = false;
}

function practiceTutorialSkip() {
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = true;
  _finishPracticeTutorial();
}

function practiceTutorialStart() {
  const el = document.getElementById('practice-tutorial-welcome');
  if (el) el.hidden = true;
  // Active BEFORE the deck renders: tutorial cards are built bare (photo only).
  _practiceTutorialActive = true;
  initSwipeDeck({ fresh: true, ignoreSkipped: true, tutorial: true });
  _practiceTutorialStep   = 2;
  _showPracticeTutorialStep();
}

function _practiceTutorialTopPhoto() {
  const card = document.querySelector('#card-deck .swipe-card[data-stack="0"]');
  return card ? card.querySelector('.swipe-card-photo') : null;
}

function _showPracticeTutorialStep() {
  const photo = _practiceTutorialTopPhoto();
  if (!photo) { _finishPracticeTutorial(); return; } // ran out of demo profiles — bail cleanly
  // The photo-count bar is only introduced by the photo lesson.
  document.getElementById('card-deck')?.classList.toggle('ptw-show-progress', _practiceTutorialStep >= 4);
  photo.querySelectorAll('.ptw-swipe-overlay, .ptw-photo-nav-overlay').forEach(n => n.remove());
  photo.classList.remove('ptw-dim');

  if (_practiceTutorialStep === 2) {
    photo.classList.add('ptw-dim');
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-swipe-overlay">
        <img class="ptw-swipe-hand" src="assets/icons/onboarding/tutorial-swipe-right.png" alt="" />
        <p class="ptw-swipe-title">Slide right to like</p>
        <p class="ptw-swipe-sub">It will only be a Match if you both Like each other. Try it out!</p>
      </div>`);
  } else if (_practiceTutorialStep === 3) {
    photo.classList.add('ptw-dim');
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-swipe-overlay">
        <img class="ptw-swipe-hand ptw-swipe-hand--left" src="assets/icons/onboarding/tutorial-swipe-left.png" alt="" />
        <p class="ptw-swipe-title">Slide left to pass</p>
        <p class="ptw-swipe-sub">If you don't Like them, simply pass. No one has to know you said Nope.</p>
      </div>`);
  } else if (_practiceTutorialStep === 4) {
    photo.insertAdjacentHTML('beforeend', `
      <div class="ptw-photo-nav-overlay" onclick="_practiceTutorialPhotoTap(event)">
        <div class="ptw-photo-divider"></div>
        <div class="ptw-photo-zone ptw-photo-zone--last">
          <img src="assets/icons/onboarding/tutorial-last-photo.png" alt="" />
          <span>Last photo</span>
        </div>
        <div class="ptw-photo-zone ptw-photo-zone--next">
          <img src="assets/icons/onboarding/tutorial-next-photo.png" alt="" />
          <span>Next photo</span>
        </div>
      </div>`);
  }
}

// Runs in two phases around the fly-off, because the two things it can do
// want opposite timing. Swapping one lesson's TEXT for the next should feel
// instant, so that happens as the throw begins ('start'). Handing off to the
// confirm-profile sheet is a screen change, not a lesson swap — arriving
// while the card is still flying reads as the sheet barging in — so that
// waits for the throw to finish ('end').
// Returns true from 'start' when there is still 'end' work to do.
function _handlePracticeTutorialSwipe(direction, phase) {
  // The deck already advanced when the throw began (commitSwipe).
  const expected = _practiceTutorialStep === 2 ? 'right' : 'left';

  if (phase === 'start') {
    if (direction !== expected) {
      // Wrong way: the lesson repeats on the SAME card. commitSwipe already
      // advanced the deck, so step back one and rebuild under the card that is
      // still flying out — its photo slot is remembered, so it comes back as it was.
      state.swipeIndex = Math.max(0, state.swipeIndex - 1);
      renderDeck({ keep: document.querySelector('#card-deck .swipe-card--flying') });
      _showPracticeTutorialStep();
      return false;
    }
    if (_practiceTutorialStep === 2) {
      _practiceTutorialStep = 3;
      _showPracticeTutorialStep();
      return false;
    }
    return _practiceTutorialStep === 3; // confirm-profile, once the card is gone
  }

  const photo = _practiceTutorialTopPhoto();
  photo?.classList.remove('ptw-dim');
  photo?.querySelectorAll('.ptw-swipe-overlay').forEach(n => n.remove());
  _pcOpen();
}

// ---- "Let's confirm your profile" + "Edit Details" — slotted between the
// swipe-left lesson and the photo-nav lesson (see _handlePracticeTutorialSwipe
// above). Reads/writes the SAME localStorage fields the main app onboarding
// (Step 1, and the new "who are you attracted to" step) already uses —
// zelo_display_name / zelo_user_age / zelo_profile_photo / zelo_practice_mode
// — so an edit made here is the same edit made anywhere else in the app, not
// a separate, disconnected copy.
// "Practice with" has four answers: women / men / nonbinary (non-binary people) /
// both (Everyone). Who the user IS (zelo_onb_gender: male / female / other / none)
// is a separate question; the deck combines the two (see initSwipeDeck). A stored
// 'other' is the old "LGBTQ+ women" choice — that library is now routed by the
// pair instead, so it is read as 'women'.
const PRACTICE_WHO_LABELS = { women: 'Women', men: 'Men', nonbinary: 'Non-binary people', both: 'Everyone' };
function _practiceMode() {
  const m = localStorage.getItem('zelo_practice_mode') || 'women';
  if (m === 'other') { localStorage.setItem('zelo_practice_mode', 'women'); return 'women'; }
  return PRACTICE_WHO_LABELS[m] ? m : 'women';
}
function _pedAttractedLabel(mode) {
  return PRACTICE_WHO_LABELS[mode === 'other' ? 'women' : mode] || 'Women';
}
const GENDER_LABELS = { male: 'Man', female: 'Woman', other: 'Non-binary', none: 'Prefer not to say' };

function _practiceRenderConfirmProfile() {
  document.getElementById('pcp-name').textContent = localStorage.getItem('zelo_display_name') || 'John';
  document.getElementById('pcp-age').textContent  = localStorage.getItem('zelo_user_age') || '22';
  document.getElementById('pcp-attracted').textContent = _pedAttractedLabel(_practiceMode());
  // The user's own real photo if they've set one; otherwise the plain grey
  // placeholder icon — not a stock/demo headshot standing in for them.
  const data = localStorage.getItem('zelo_profile_photo');
  const img  = document.getElementById('pcp-avatar-img');
  const ph   = document.getElementById('pcp-avatar-ph');
  if (data) {
    if (img) { img.src = data; img.hidden = false; }
    if (ph)  ph.hidden = true;
  } else {
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph)  ph.hidden = false;
  }
}

// Drag the "Let's confirm your profile" sheet down to dismiss it. There is
// no cancel path for this step — the only ways out are Continue and Edit
// details — so a dismissal resolves the same way Continue does, rather than
// leaving the tutorial with nothing on screen.
function attachPracticeConfirmDragToClose() {
  _attachPracticeSheetDrag('pcp-sheet-card', practiceConfirmProfileContinue);
  // Edit Details uses the same sheet; dragging it down is its back button —
  // every field there saves itself on pick, so there is no draft to discard.
  _attachPracticeSheetDrag('ped-sheet-card', practiceCloseEditDetails);
}

function _attachPracticeSheetDrag(cardId, onDismiss) {
  const card = document.getElementById(cardId);
  if (!card) return;

  let startY = 0, dragging = false, dy = 0;

  function onStart(clientY) {
    startY = clientY; dragging = true; dy = 0;
    card.style.transition = 'none';
  }
  function onMove(clientY) {
    if (!dragging) return;
    dy = Math.max(0, clientY - startY);
    card.style.transform = `translateY(${dy}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    // Same 110px threshold as the profile-detail and AI Coach sheets.
    if (dy > 110) {
      card.style.transition = '';
      card.style.transform = '';
      onDismiss();
    } else {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 320);
    }
    dy = 0;
  }

  card.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  card.addEventListener('touchmove',  e => onMove(e.touches[0].clientY),  { passive: true });
  card.addEventListener('touchend',   onEnd);
  card.addEventListener('touchcancel', onEnd);
}


// ================================================================
// PRACTICE TUTORIAL — typed "confirm your profile" conversation
// ================================================================
// Full screen, same typewriter feel as the onboarding intro (and it reuses
// that screen's .cine-convo* styles), but with its own small engine because
// the intro's helpers are wired to its own element ids. Replaces the old
// confirm-profile sheet: that sheet only echoed what had just been typed, and
// carried a profile photo that nothing in the app uses.
//
// Script: congrats → "let's confirm your profile" → what we know (name, age;
// asks how they identify, since the conversation route skips that step) →
// two preferences: who to practice with, and what age range → hand back to
// the tutorial. Everything is written to the same keys Settings reads.
const PC = {
  // Same pace as the onboarding intro (CONVO) — it was 26/12/380 and read faster.
  // Getters, not copies: CONVO is declared further down this file, so reading it
  // while PC is being built would hit its temporal dead zone at load time.
  get charMs() { return CONVO.charMs; }, get spaceMs() { return CONVO.spaceMs; },
  get afterLineMs() { return CONVO.afterLineMs; }, choiceStaggerMs: 85,
  choiceSettleMs: 340, pickBeatMs: 260, liftMs: 420,
  startAt: 0.30, restAt: 0.58,
};
let _pcActive = false, _pcTimers = [], _pcTyping = false, _pcSkip = false;
let _pcTopPx = 0, _pcRecapEl = null, _pcTapResolve = null;

const _PC_SEX_WORD = { female: 'a woman', male: 'a man', other: 'non-binary', none: '' };
const _PC_AGE_OPTS = [
  { value: '18-24', label: '18–24' }, { value: '25-30', label: '25–30' },
  { value: '31-39', label: '31–39' }, { value: 'any',   label: 'Any age' },
];

function _pcWait(ms) { return new Promise(res => { _pcTimers.push(setTimeout(res, ms)); }); }
function _pcClearTimers() { _pcTimers.forEach(clearTimeout); _pcTimers = []; }

function _pcRelift() {
  const stage = document.getElementById('pc-stage');
  const wrap  = document.getElementById('pc-convo');
  if (!stage || !wrap) return;
  const bottom = _pcTopPx + stage.scrollHeight;
  const lift = Math.max(0, Math.round(bottom - wrap.clientHeight * PC.restAt));
  stage.style.setProperty('--convo-lift', `-${lift}px`);
}

async function _pcType(text, opts = {}) {
  const lines = document.getElementById('pc-lines');
  if (!lines || !_pcActive) return null;
  lines.querySelectorAll('.cine-convo-line').forEach(el => el.classList.add('cine-convo-line--past'));
  const el = document.createElement('p');
  el.className = 'cine-convo-line cine-convo-caret' + (opts.accent ? ' cine-convo-line--accent' : '');
  lines.appendChild(el);
  _pcRelift();
  _pcTyping = true; _pcSkip = false;
  for (let i = 0; i < text.length && _pcActive; i++) {
    if (_pcSkip) { el.textContent = text; break; }
    const ch = text[i];
    el.textContent += ch;
    _convoTick(ch);
    _pcRelift();
    await _pcWait(ch === ' ' ? PC.spaceMs : PC.charMs);
  }
  el.classList.remove('cine-convo-caret');
  _pcRelift();
  _pcTyping = false; _pcSkip = false;
  if (!opts.noBeat) await _pcWait(PC.afterLineMs);
  return el;
}

// A tap while a line is typing finishes that line at once (one tap, one line).
function pcTap(e) {
  if (e && e.target.closest('.cine-convo-choices')) return;
  if (_pcTyping) { _pcSkip = true; return; }
  if (_pcTapResolve) { const r = _pcTapResolve; _pcTapResolve = null; r(); }
}

// Shows the choices one after another from the top and resolves with the
// picked option. `selected` pre-highlights an earlier/default answer. With
// `canBack`, the back button is shown and resolves { back: true } instead.
let _pcBackFn = null;
function _pcSetBack(on) {
  const b = document.getElementById('pc-back');
  if (b) b.hidden = !on;
}
function pcBack() { if (_pcBackFn) { _cineHaptic('LIGHT'); _pcBackFn(); } }

function _pcChoose(opts, selected, canBack) {
  return new Promise(resolve => {
    const wrap = document.getElementById('pc-choices');
    wrap.innerHTML = ''; wrap.hidden = false;
    const close = () => {
      wrap.hidden = true; wrap.innerHTML = ''; delete wrap.dataset.locked;
      _pcBackFn = null; _pcSetBack(false);
      _pcRelift();
    };
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cine-convo-choice' + (o.sub ? ' cine-convo-choice--sub' : '') + (o.value === selected ? ' selected' : '');
      b.textContent = o.label;
      b.onclick = async (ev) => {
        ev.stopPropagation();
        if (wrap.dataset.locked) return;
        wrap.dataset.locked = '1';
        _pcBackFn = null; _pcSetBack(false);
        _cineHaptic('LIGHT');
        wrap.querySelectorAll('.cine-convo-choice').forEach(x => x.classList.toggle('selected', x === b));
        await _pcWait(PC.pickBeatMs);
        close();
        resolve(o);
      };
      wrap.appendChild(b);
      _pcTimers.push(setTimeout(() => {
        b.classList.add('cine-convo-choice--in');
        _pcTimers.push(setTimeout(() => {
          b.classList.remove('cine-convo-choice--in');
          b.classList.add('cine-convo-choice--shown');
        }, PC.choiceSettleMs + 40));
      }, PC.choiceStaggerMs * i));
    });
    if (canBack) {
      _pcBackFn = () => {
        if (wrap.dataset.locked) return;
        wrap.dataset.locked = '1';
        close();
        resolve({ back: true });
      };
      _pcSetBack(true);
    }
    _pcRelift();
  });
}

function _pcRecapText() {
  const name = localStorage.getItem('zelo_display_name') || 'John';
  const age  = localStorage.getItem('zelo_user_age');
  const sex  = _PC_SEX_WORD[localStorage.getItem('zelo_onb_gender')];
  return `${name}, ${age || '—'}${sex ? ', ' + sex : ''}.`;
}

function _pcCurrentAgeValue() {
  const preset = localStorage.getItem('zelo_age_range');
  if (preset && AGE_FILTER_PRESET_RANGES[preset]) return preset;
  return _ageFilterRange() ? null : 'any';
}

function _pcApplyAge(value) {
  const key = ['zelo_age_filter_min', 'zelo_age_filter_max'];
  if (value === 'any') {
    localStorage.removeItem('zelo_age_range');
    key.forEach(k => localStorage.removeItem(k));
  } else {
    const [lo, hi] = AGE_FILTER_PRESET_RANGES[value];
    localStorage.setItem('zelo_age_range', value);
    localStorage.setItem('zelo_age_filter_min', String(lo));
    localStorage.setItem('zelo_age_filter_max', String(hi));
  }
}

// Applies the two answers to the deck WITHOUT changing the card the user has
// been looking at (the conversation covers the screen, but they remember it).
// The card on top is pinned if it still fits the new preferences; the rest of
// the deck is rebuilt around it, minus the two demo cards.
function _pcRebuildDeck() {
  const held = state.swipeProfiles[state.swipeIndex];
  initSwipeDeck({ fresh: true, pin: held && held.id, exclude: PRACTICE_TUTORIAL_CARDS.map(c => c.id) });
}

// Removes one step's typed lines (bottom first, same motion as the final
// clear-out) so that step can be asked again from its choices.
async function _pcRemoveLines(els) {
  for (let i = els.length - 1; i >= 0; i--) {
    els[i].classList.add('cine-convo-line--out');
    await _pcWait(CONVO.clearStaggerMs);
  }
  await _pcWait(CONVO.clearOutMs);
  els.forEach(e => e.remove());
  _pcRelift();
  // The line above is the newest again, so it reads as current, not past.
  const last = document.querySelector('#pc-lines .cine-convo-line:last-child');
  last?.classList.remove('cine-convo-line--past');
}

// The questions, in order. Each types its own lines once (kept in `lines` so a
// Back can remove them) and then shows choices; going back removes the later
// step's lines and re-shows the earlier step's choices with its answer
// highlighted — the earlier question is not typed again.
function _pcBuildSteps(needGender) {
  const mode = () => _practiceMode();
  return [
    { id: 'gender', skip: () => !needGender, lines: [],
      type: async (st) => { st.lines.push(await _pcType('How do you identify?', { noBeat: true })); },
      choose: (canBack) => _pcChoose([
        { value: 'male', label: 'Man' }, { value: 'female', label: 'Woman' },
        { value: 'other', label: 'Non-binary' }, { value: 'none', label: 'Prefer not to say' },
      ], localStorage.getItem('zelo_onb_gender') || 'male', canBack),
      apply: (o) => {
        cineAnswers.gender = o.value;
        localStorage.setItem('zelo_onb_gender', o.value);
        try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
      } },
    { id: 'recap', lines: [],
      type: async (st) => { _pcRecapEl = await _pcType(`Got it: ${_pcRecapText()}`, { accent: true, noBeat: true }); st.lines.push(_pcRecapEl); },
      choose: (canBack) => _pcRecapChoices(canBack),
      apply: () => {} },
    { id: 'who', lines: [],
      type: async (st) => {
        st.lines.push(await _pcType('Two quick things, so your matches actually fit you.'));
        st.lines.push(await _pcType('Who do you want to practice talking to?', { noBeat: true }));
      },
      choose: (canBack) => _pcChoose([
        { value: 'women', label: 'Women' }, { value: 'men', label: 'Men' },
        { value: 'nonbinary', label: 'Non-binary people' }, { value: 'both', label: 'Everyone' },
      ], mode(), canBack),
      apply: (o) => {
        localStorage.setItem('zelo_practice_mode', o.value);
        cineAnswers.attracted = o.value;
        localStorage.setItem('zelo_onb_attracted', o.value);
      } },
    { id: 'age', lines: [],
      type: async (st) => { st.lines.push(await _pcType('And what age range feels right for them?', { noBeat: true })); },
      choose: (canBack) => _pcChoose(_PC_AGE_OPTS, _pcCurrentAgeValue(), canBack),
      apply: (o) => _pcApplyAge(o.value) },
  ];
}

async function _pcOpen() {
  const wrap = document.getElementById('pc-convo');
  if (!wrap || _pcActive) return;
  _pcActive = true;
  _pcClearTimers();
  document.getElementById('pc-lines').innerHTML = '';
  const choices = document.getElementById('pc-choices');
  choices.innerHTML = ''; choices.hidden = true;
  _pcSetBack(false); _pcBackFn = null;
  wrap.classList.remove('cine-convo--out');
  wrap.hidden = false;
  const stage = document.getElementById('pc-stage');
  stage.style.removeProperty('--convo-lift');
  _pcTopPx = Math.round(wrap.clientHeight * PC.startAt);
  stage.style.setProperty('--convo-top', _pcTopPx + 'px');
  try {
    await _pcType('Nice. You’ve got swiping down.', { accent: true });
    await _pcType('Now let’s confirm your profile.');
    const name = localStorage.getItem('zelo_display_name') || 'John';
    const age  = localStorage.getItem('zelo_user_age');
    await _pcType(age ? `So far, I know you as ${name}, ${age}.` : `So far, I know you as ${name}.`);

    const needGender = !(localStorage.getItem('zelo_onb_gender') in _PC_SEX_WORD);
    const steps = _pcBuildSteps(needGender);
    const live = (i) => !(steps[i].skip && steps[i].skip());
    const prevOf = (i) => { for (let j = i - 1; j >= 0; j--) if (live(j)) return j; return -1; };
    let i = 0;
    while (i < steps.length) {
      if (!live(i)) { i++; continue; }
      const st = steps[i];
      if (!st.lines.length) await st.type(st);
      if (!_pcActive) return;
      const res = await st.choose(prevOf(i) >= 0);
      if (!_pcActive) return;
      if (res && res.back) {
        const j = prevOf(i);
        await _pcRemoveLines(st.lines);
        st.lines = [];
        i = j;
        continue;
      }
      st.apply(res);
      i++;
    }
    _pcRebuildDeck();
    await _pcType(`All set, ${localStorage.getItem('zelo_display_name') || 'John'}. Let’s meet your first match.`, { accent: true });
    await _pcWait(300);
    await _pcFinish();
  } catch (e) { /* torn down mid-script */ }
}

// "That's me" moves on; "Change something" opens Edit Details and comes back
// through _pcAfterEdit(), which refreshes the recap and asks again.
async function _pcRecapChoices(canBack) {
  const pick = await _pcChoose([
    { value: 'ok', label: 'That’s me' },
    { value: 'edit', label: 'Change something', sub: true },
  ], null, canBack);
  if (pick.back || pick.value !== 'edit') return pick;
  const wrap = document.getElementById('pc-convo');
  wrap.hidden = true;
  _practiceRenderEditDetails();
  document.getElementById('practice-edit-details').hidden = false;
  await new Promise(res => { _pcEditResolve = res; });
  return _pcRecapChoices(canBack);
}
let _pcEditResolve = null;
function _pcAfterEdit() {
  if (_pcRecapEl) _pcRecapEl.textContent = `Got it: ${_pcRecapText()}`;
  document.getElementById('pc-convo').hidden = false;
  _pcRelift();
  const r = _pcEditResolve; _pcEditResolve = null;
  if (r) r();
}

// Empties the stack bottom-first, fades out over the deck, and hands back to
// the tutorial's next lesson.
async function _pcFinish() {
  const lines = [...document.querySelectorAll('#pc-lines .cine-convo-line')];
  for (let i = lines.length - 1; i >= 0; i--) {
    lines[i].classList.add('cine-convo-line--out');
    await _pcWait(CONVO.clearStaggerMs);
  }
  await _pcWait(CONVO.clearOutMs);
  const wrap = document.getElementById('pc-convo');
  wrap.classList.add('cine-convo--out');
  await _pcWait(220);
  _pcTeardown();
  if (!_practiceTutorialActive) return;
  _practiceTutorialStep = 4;
  _showPracticeTutorialStep();
}

function _pcTeardown() {
  _pcActive = false; _pcTyping = false; _pcSkip = false;
  _pcClearTimers();
  _pcTapResolve = null; _pcEditResolve = null; _pcRecapEl = null; _pcBackFn = null; _pcSetBack(false);
  const wrap = document.getElementById('pc-convo');
  if (wrap) { wrap.hidden = true; wrap.classList.remove('cine-convo--out'); }
  const lines = document.getElementById('pc-lines'); if (lines) lines.innerHTML = '';
  const ch = document.getElementById('pc-choices'); if (ch) { ch.innerHTML = ''; ch.hidden = true; delete ch.dataset.locked; }
}

function practiceConfirmProfileContinue() {
  const el = document.getElementById('practice-confirm-profile');
  if (el) el.hidden = true;
  if (!_practiceTutorialActive) return; // user backed out via Edit Details/Settings mid-way
  _practiceTutorialStep = 4;
  _showPracticeTutorialStep();
}

function practiceOpenEditDetails() {
  document.getElementById('practice-confirm-profile').hidden = true;
  _practiceRenderEditDetails();
  document.getElementById('practice-edit-details').hidden = false;
}

// Both "back" and "Save Changes" return the same way — every field here
// saves itself immediately when picked (see pedConfirmName/pedPickAttracted/
// cineOpenAgeSheet/pedPhotoSelected), so there's no separate draft/commit
// step to distinguish between "saved" and "cancelled".
function _practiceReturnToConfirmProfile() {
  document.getElementById('practice-edit-details').hidden = true;
  if (_pcActive) { _pcAfterEdit(); return; }
  _practiceRenderConfirmProfile();
  document.getElementById('practice-confirm-profile').hidden = false;
}
function practiceCloseEditDetails() { _practiceReturnToConfirmProfile(); }
function practiceSaveEditDetails()  { _practiceReturnToConfirmProfile(); }

function _practiceRenderEditDetails() {
  document.getElementById('ped-name-val').textContent = localStorage.getItem('zelo_display_name') || 'John';
  document.getElementById('ped-age-val').textContent  = localStorage.getItem('zelo_user_age') || '22';
  document.getElementById('ped-attracted-val').textContent = _pedAttractedLabel(_practiceMode());
  const _gv = document.getElementById('ped-gender-val'); if (_gv) _gv.textContent = GENDER_LABELS[localStorage.getItem('zelo_onb_gender')] || 'Not set';
  _pedRenderPhoto();
}

// ---- Photo — parallel to cinePickPhoto/cinePhotoSelected/cineRenderPhoto
// (Step 1 of the main onboarding), targeting this screen's own avatar
// elements instead. Same zelo_profile_photo key, so either editor sees the
// other's change.
function pedPickPhoto() { document.getElementById('ped-photo-input')?.click(); }
function pedPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('zelo_profile_photo', reader.result);
    _pedRenderPhoto();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function _pedRenderPhoto() {
  const data = localStorage.getItem('zelo_profile_photo');
  const img  = document.getElementById('ped-avatar-img');
  const ph   = document.getElementById('ped-avatar-ph');
  const del  = document.getElementById('ped-avatar-del');
  if (data) {
    if (img) { img.src = data; img.hidden = false; }
    if (ph)  ph.hidden = true;
  } else {
    if (img) { img.hidden = true; img.removeAttribute('src'); }
    if (ph)  ph.hidden = false;
  }
  if (del) del.hidden = !data;
}

// stopPropagation so tapping the X never also triggers the avatar's own
// onclick (sits underneath it) and immediately reopens the picker — same
// reasoning as cineRemovePhoto (Step 1).
function pedRemovePhoto(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  localStorage.removeItem('zelo_profile_photo');
  _pedRenderPhoto();
}

// ---- Name — small bottom sheet (own, not Step 1's inline field — Step 1
// isn't a modal, so there's nothing to reuse there beyond the validation).
function pedOpenNameSheet() {
  const input = document.getElementById('ped-name-input');
  if (input) input.value = localStorage.getItem('zelo_display_name') || '';
  document.getElementById('ped-name-sheet').hidden = false;
  input?.focus();
}
function pedCloseNameSheet() { document.getElementById('ped-name-sheet').hidden = true; }
function pedConfirmName() {
  const input = document.getElementById('ped-name-input');
  const trimmed = (input?.value || '').trim();
  if (cineNameValid(trimmed)) {
    localStorage.setItem('zelo_display_name', trimmed);
    document.getElementById('ped-name-val').textContent = trimmed;
  }
  pedCloseNameSheet();
}

// ---- Attracted to — small bottom sheet, same 3 options/colors as the main
// onboarding's own "who are you attracted to" step, writing to the same
// zelo_practice_mode key.
function pedOpenAttractedSheet() {
  const current = _practiceMode();
  document.querySelectorAll('#ped-opts-attracted .cine-opt').forEach((b) => {
    b.classList.toggle('selected', b.dataset.val === current);
  });
  document.getElementById('ped-attracted-sheet').hidden = false;
}
function pedCloseAttractedSheet() { document.getElementById('ped-attracted-sheet').hidden = true; }

// ---- "I am" — who the user is. Only used to pick which library fits them
// (see initSwipeDeck); never shown to anyone and not uploaded.
function pedOpenGenderSheet() {
  const cur = localStorage.getItem('zelo_onb_gender');
  document.querySelectorAll('#ped-opts-gender .cine-opt').forEach(b => b.classList.toggle('selected', b.dataset.val === cur));
  document.getElementById('ped-gender-sheet').hidden = false;
}
function pedCloseGenderSheet() { document.getElementById('ped-gender-sheet').hidden = true; }
function pedPickGender(value) {
  localStorage.setItem('zelo_onb_gender', value);
  cineAnswers.gender = value;
  try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
  _invalidateDeck();
  const gv = document.getElementById('ped-gender-val'); if (gv) gv.textContent = GENDER_LABELS[value] || 'Not set';
  pedCloseGenderSheet();
}
function pedPickAttracted(value, el) {
  localStorage.setItem('zelo_practice_mode', value);
  _invalidateDeck();
  document.getElementById('ped-attracted-val').textContent = _pedAttractedLabel(value);
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.cine-opt').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }
  pedCloseAttractedSheet();
}

function _practiceTutorialPhotoTap(e) {
  e.stopPropagation();
  _finishPracticeTutorial();
}

function _finishPracticeTutorial() {
  _practiceTutorialActive = false;
  _practiceTutorialStep   = 0;
  localStorage.setItem('zelo_mode_selected', '1');
  _syncPracticeOnboardingChrome();   // buttons come back now it's done
  const photo = _practiceTutorialTopPhoto();
  photo?.querySelectorAll('.ptw-swipe-overlay, .ptw-photo-nav-overlay').forEach(n => n.remove());
  photo?.classList.remove('ptw-dim');

  // The cards the user has been looking at are kept: the name and buttons just
  // fade in on them. Rebuilding the deck here swapped the card under the user.
  const bare = document.querySelectorAll('#card-deck .swipe-card--bare');
  bare.forEach(c => c.classList.remove('swipe-card--bare'));
  // practiceTutorialSkip() can reach here without ever going through
  // practiceTutorialStart() (which is what normally loads the deck) —
  // without this, skipping straight from the welcome screen leaves
  // #card-deck permanently empty.
  if (!bare.length) initSwipeDeck();
}


// ================================================================
// BUTTON HANDLERS
// ================================================================

function onSkipBtn() {
  if (_swipeLock) return;
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'left');
}

// Rewind: brings back the last person you skipped (and the one before that,
// on repeated taps, back to your last like). The card comes back in from
// the left, the way it left, and is taken off the Skipped Profiles list.
function onRewindBtn() {
  if (_swipeLock || _practiceTutorialActive) return;
  const hist = state.skipHistory || [];
  if (!hist.length) return;
  const idx = hist.pop();
  const profile = state.swipeProfiles[idx];
  if (!profile) return;
  _removeSkippedProfile(profile.id);
  state.swipeIndex = idx;
  renderDeck();
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (top) {
    top.classList.add('swipe-card--rewind');
    setTimeout(() => top.classList.remove('swipe-card--rewind'), 520);   // one-shot (2026-10-09j)
  }
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
}

function onLikeBtn() {
  if (_swipeLock) return;
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'right');
}

function disableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = true;
  if (like) like.disabled = true;
}

function enableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = false;
  if (like) like.disabled = false;
}


// ================================================================
// PROFILE DETAIL — full-screen, modal-style page opened by tapping the
// swipe card (not dragging it). Shows everything the card shows plus the
// Open/Neutral/Cold mode pills, and moves Skip/I'm Interested down here.
// The Home tab stays rendered (and active) behind the dim backdrop —
// this does NOT use pushScreen()/the .screen takeover system.
// ================================================================

function openProfileDetail() {
  const profile = state.swipeProfiles[state.swipeIndex];
  if (!profile) return;

  const modal = document.getElementById('profile-detail-modal');
  if (!modal) return;

  // Populate gradient photo area
  const photo = document.getElementById('pd-photo');
  photo.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  // Real photo when the profile has one; the initial-on-gradient stays as
  // the fallback. The gradient is left underneath either way, so a slow or
  // failed image load never shows a bare box.
  photo.innerHTML = (profile.photos && profile.photos.length)
    ? `<img src="${profile.photos[0]}" alt="" aria-hidden="true" onerror="this.remove()">`
    : `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:700;color:rgba(255,255,255,0.9);">${profile.initial}</span>`;
  photo.style.position = 'relative';

  // Populate text fields
  document.getElementById('pd-name').textContent = profile.name;
  document.getElementById('pd-age').textContent  = profile.age;
  document.getElementById('pd-occ').textContent  = profile.occupation;
  // About her / interests / in short, written per persona (personas-about.js).
  // Falls back to her bio and interests if a profile has no entry.
  const about = (typeof PERSONA_ABOUT !== 'undefined' && PERSONA_ABOUT[profile.id]) || null;
  document.getElementById('pd-bio').textContent = about ? about.about : profile.bio;
  const topics = about ? about.topics : (profile.interests || []).map(t => ['✨', t]);
  document.getElementById('pd-tags').innerHTML = topics.map(([e, t]) =>
    `<span class="pd-topic"><span aria-hidden="true">${e}</span>${_escapeHtml(t)}</span>`).join('');
  const shortCard = document.getElementById('pd-short-card');
  shortCard.hidden = !about;
  if (about) document.getElementById('pd-short').textContent = about.short;

  // Tap backdrop to close
  modal.onclick = e => { if (e.target === modal) closeProfileDetail(); };

  modal.removeAttribute('hidden');
}

function closeProfileDetail() {
  const modal = document.getElementById('profile-detail-modal');
  if (modal) modal.setAttribute('hidden', '');
}

// Combined touch-gesture handler, attached to each of the three tabs
// (Home / Scan / Chats): vertical rubber-band overscroll feel (existing) +
// horizontal swipe-to-navigate between adjacent tabs (Home <-> Scan <->
// Chats), rendered as a full-screen page-slide — both the current and
// destination .tab elements are visible and move together 1:1 with the
// finger, like paging between photos in iOS Photos/Instagram Stories, not
// a small edge peek. One handler per tab decides the gesture's axis once
// (on the first move past a small deadzone) and locks into either
// vertical-rubber-band or horizontal-nav for the rest of that touch — they
// never run simultaneously or fight each other.
const TAB_SWIPE_ORDER = ['practice', 'assistant', 'chats'];

// Shared single-container slide-track helpers — used by both the tab
// carousel and the screen-back gesture below. A live element (never a
// clone) is temporarily reparented into a shared flex track as a sibling
// of whatever it should slide alongside, and only the TRACK's own
// transform is ever animated. Two independently-transformed elements —
// even algebraically kept in sync — can still live on separate compositor
// layers that don't necessarily paint in lockstep on real hardware; one
// element moving as a single unit has no such failure mode.
function _getOrCreateSlideTrack(trackId, zIndex) {
  let track = document.getElementById(trackId);
  if (!track) {
    track = document.createElement('div');
    track.id = trackId;
    track.style.cssText = `position:absolute; top:0; left:0; height:100%; display:flex; z-index:${zIndex}; pointer-events:none;`;
    document.getElementById('app').appendChild(track);
  }
  return track;
}

// Snapshot of EVERY scrolled element inside (and including) `el` — the
// screen/tab itself plus any nested overflow:auto list, carousel, sheet, etc.
// Reparenting or changing position on a subtree in WebKit resets scrollTop/
// scrollLeft to 0 on all of them (see _slideMountEl's comments), so anything
// that isn't in this snapshot jumps back to the top the instant a
// swipe-back gesture starts. This used to only cover chat/AI Coach's
// message lists by class name, which is why every OTHER scrollable page
// (settings sub-pages, History, Account, sheets...) still reset. Reading
// scrollTop/scrollLeft on elements that don't scroll is just 0 — cheap, no
// per-element "is this scrollable" check needed.
function _captureScrollState(el) {
  const saved = [];
  const nodes = [el, ...el.querySelectorAll('*')];
  for (const n of nodes) {
    if (n.scrollTop || n.scrollLeft) saved.push([n, n.scrollTop, n.scrollLeft]);
  }
  return saved;
}

// Restores a _captureScrollState() snapshot instantly, bypassing any
// element's own `scroll-behavior: smooth` (chat/AI Coach both set it) — a
// plain `el.scrollTop = x` assignment is one of the operations that CSS
// property animates, so without forcing 'auto' first, restoring the
// position would itself visibly animate the content scrolling back into
// place — the exact "screen moves" motion this exists to prevent.
function _restoreScrollState(saved) {
  saved.forEach(([n, top, left]) => {
    const prev = n.style.scrollBehavior;
    n.style.scrollBehavior = 'auto';
    n.scrollTop = top;
    n.scrollLeft = left;
    n.style.scrollBehavior = prev;
  });
}

function _slideMountEl(el, track, widthPx) {
  // Read the real, already-correct rendered height BEFORE touching any
  // styles — .tab has its own `bottom: calc(var(--tab-h) + 34px)` (leaves
  // room for the tab bar) and some .screen overrides similarly reserve
  // space at the bottom; both work by combining inset:0 with that bottom
  // value under position:absolute. Clearing top/right/bottom/left to
  // 'auto' below (needed so position:relative doesn't apply them as flow
  // offsets — see that comment) also throws away that height-constraining
  // math, since there's no inset box left to compute it from. Left
  // uncorrected, the element's height then falls back to its own content's
  // natural height instead — taller than before, since it's no longer
  // clipped above the tab bar — which is exactly why flex-filled content
  // (e.g. the Practice tab's card deck) visibly grew longer during a drag
  // and snapped back to its normal size on release. Pinning the captured
  // height explicitly (cleared again in _slideUnmountEl) keeps it
  // identical throughout the drag instead of recomputing from content.
  const height = el.getBoundingClientRect().height;
  // Capture BEFORE the position:relative switch just below — that switch
  // alone (still position:absolute at this point, before any reparenting)
  // already resets scrollTop to 0 on a nested overflow-y:auto flex child in
  // WebKit, synchronously, the instant the ancestor's position changes.
  // Reparenting itself (the appendChild further down) turned out not to be
  // the trigger here — this is; confirmed directly against real WebKit.
  const scrollState = _captureScrollState(el);
  // Reparenting a subtree makes WebKit RESTART every CSS animation inside
  // it — so every .msg-row/.typing-row replays its `msgIn` entrance
  // (opacity 0 -> 1 plus a 4px slide), twice per gesture, once on mount and
  // again on unmount. That is the "blink/refresh" on swipe, and it's why an
  // empty chat looks clean and a full one doesn't. Frozen for the gesture.
  document.getElementById('app')?.classList.add('slide-animating');
  el.style.position = 'relative';
  // Base CSS for both .tab and .screen is position:absolute with inset:0,
  // several also override bottom/top individually — under position:relative
  // those same values apply as flow offsets instead of box edges, visually
  // shifting the content. Reset all four explicitly (inset shorthand +
  // each longhand, belt-and-suspenders) so position:relative has no offset.
  el.style.inset = 'auto';
  el.style.top = 'auto';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.left = 'auto';
  el.style.width = widthPx + 'px';
  el.style.height = height + 'px';
  el.style.flex = '0 0 ' + widthPx + 'px';
  el.style.opacity = '1';
  el.style.transform = 'none';
  el.style.pointerEvents = 'none';
  track.appendChild(el);
  // Restore every scrolled element's position (the screen itself and any
  // nested scroller), wiped by the position:relative switch + reparent above
  // (see those comments) — reads as the whole screen jumping to the top the
  // instant a swipe-back gesture starts, visible on any page scrolled away
  // from 0 (originally only chat/AI Coach's message lists were covered).
  _restoreScrollState(scrollState);
  // Reparenting resets scrollLeft on any nested overflow-x:auto descendant
  // (see _slideUnmountEl's matching fix below) — without re-pinning here
  // too, the widget carousel shows card 1 for the entire live drag preview
  // (every frame until the gesture settles and _slideUnmountEl runs),
  // regardless of which card was actually active before the swipe started.
  if (el.id === 'tab-assistant') {
    const wcTrack = document.getElementById('widget-carousel-track');
    if (wcTrack) wcTrack.scrollLeft = _widgetCarouselIndex * wcTrack.clientWidth;
  }
  // This tab/screen's own header (.app-header for tabs, .screen-header for
  // pushed screens — every screen using attachEdgeSwipeBack shares this
  // same _slideMountEl, not just the tab carousel) switches away from its
  // normal CSS position for the drag's duration, to whichever of
  // absolute/relative keeps its FLOW BEHAVIOR identical to what it
  // started with:
  //   - Practice/Scan/Chats' headers, and Account's (#screen-dashboard)
  //     .screen-header, are position:fixed (see #tab-practice .app-header
  //     and the #screen-dashboard .screen-header override in style.css) —
  //     fixed reserves no space in flow at all, which is why those pages
  //     each carry their own compensating padding-top to leave room for
  //     it. A transform on the shared track would hijack fixed's
  //     containing block to be the full 2-page-wide track though
  //     (centering/drifting the header across BOTH pages, not just this
  //     one — this was the real cause of Account's header visibly
  //     sliding toward Scan mid-swipe instead of staying put on its own
  //     page) — switching to ABSOLUTE (relative to `el`, exactly
  //     viewport-width) fixes that math while staying just as
  //     flow-space-free as fixed was, so the page's own padding-top
  //     compensation still lines up.
  //   - History's .app-header and every plain settings sub-page's
  //     .screen-header have no such ID-specific override, so they fall
  //     back to the shared rule: position:sticky, which DOES reserve its
  //     own space in flow (unlike fixed) — WebKit also has a known bug
  //     rendering sticky incorrectly inside a transformed ancestor
  //     (same drifting-toward-the-other-page symptom, different root
  //     cause). Switching these to RELATIVE keeps that same
  //     flow-reserving behavior (no compensating padding needed or
  //     present) while sitting outside sticky's buggy code path.
  // Picking the wrong one of the two here is a real, previously-shipped
  // bug: it double-reserves or zero-reserves the header's own height for
  // the drag's duration (visible content jump), AND/OR lets the header's
  // containing block become the full 2-page track (visible drift toward
  // the other page) — both read as "the header doesn't stay put." Reading
  // the header's OWN computed position before touching it (rather than
  // hardcoding per tab/screen id) keeps this correct automatically if
  // that CSS ever changes.
  const header = el.querySelector(':scope > .app-header, :scope > .screen-header');
  if (header) {
    const wasFixed = getComputedStyle(header).position === 'fixed';
    header.style.position = wasFixed ? 'absolute' : 'relative';
  }
  // Naturally slides in lockstep with the rest of el's own content as the
  // track moves either way, for BOTH tabs sharing the gesture — the whole
  // page, header included, moves as one piece with the drag in either
  // direction, rather than the header staying put while the page slides
  // under it. Never reparenting the header at all is what actually
  // matters for a separate reason: an earlier version moved it out to
  // #app instead, which moves an ancestor of whatever the finger is
  // actively touching mid-gesture — WebKit can silently stop delivering
  // the rest of that touch sequence when that happens, if the drag
  // happened to start on the header itself (e.g. dragging from the
  // history icon), leaving the tab permanently stuck mid-drag. This way
  // avoids that failure mode entirely too, regardless of where the drag
  // starts.
}

function _slideUnmountEl(el) {
  // Capture BEFORE the position reset just below — same WebKit quirk as
  // _slideMountEl's own fix (see its comment): changing this element's
  // position wipes scrollTop on a nested overflow-y:auto flex child
  // synchronously, independent of the reparenting that follows.
  const scrollState = _captureScrollState(el);
  el.style.position = '';
  el.style.inset = '';
  el.style.top = '';
  el.style.right = '';
  el.style.bottom = '';
  el.style.left = '';
  el.style.width = '';
  el.style.height = '';
  el.style.flex = '';
  el.style.opacity = '';
  el.style.transform = '';
  el.style.pointerEvents = '';
  el.style.boxShadow = '';
  document.getElementById('app').appendChild(el);
  _restoreScrollState(scrollState);
  // Undo _slideMountEl's position switch (back to whichever of fixed/sticky
  // its own CSS defines — see _slideMountEl's comment on the two cases).
  const header = el.querySelector(':scope > .app-header, :scope > .screen-header');
  if (header) header.style.position = '';
  // Reparenting a live subtree resets scrollLeft on any nested
  // overflow-x:auto descendant (a WebKit detach/reattach quirk) — the
  // widget carousel's own JS state (_widgetCarouselIndex) survives this
  // untouched, but its visual scroll position silently snaps back to card
  // 1 every time the Scan tab takes part in a swipe-nav gesture, even when
  // Scan is just the tab being slid away FROM. Re-pin it to whichever card
  // was actually active immediately after reattaching.
  if (el.id === 'tab-assistant') {
    const track = document.getElementById('widget-carousel-track');
    if (track) track.scrollLeft = _widgetCarouselIndex * track.clientWidth;
  }
}

function attachTabSwipeGestures(tabName, excludeSelector) {
  const el = document.getElementById('tab-' + tabName);
  if (!el || el._tabGesturesAttached) return;
  el._tabGesturesAttached = true;

  // dx > 0 (dragging right) reveals whichever tab sits to this one's left
  // in the nav order; dx < 0 reveals the one to its right. Either can be
  // null (Home has nothing to its left, Chats nothing to its right).
  const idx = TAB_SWIPE_ORDER.indexOf(tabName);
  const leftTarget  = idx > 0 ? TAB_SWIPE_ORDER[idx - 1] : null;
  const rightTarget = idx < TAB_SWIPE_ORDER.length - 1 ? TAB_SWIPE_ORDER[idx + 1] : null;

  // Note: this tab's own header is NOT special-cased here. It rides along
  // with the rest of the tab's content as one piece throughout the drag —
  // that's the whole point of _slideMountEl's fixed->absolute switch (see
  // its own comment). An earlier version reparented the header out of the
  // tab to keep it visually pinned in place during a swipe; besides
  // fighting what this is actually supposed to look like, moving an
  // ancestor of whatever the finger is actively touching mid-gesture also
  // caused a rare but real bug — WebKit can silently stop delivering the
  // rest of that touch sequence once the touched element's ancestor chain
  // changes, if the drag happened to start on the header itself (e.g.
  // dragging from the history icon) — leaving the tab stuck mid-drag
  // forever with no touchend ever arriving. Never touching the header's
  // place in the DOM tree at all, and never fighting its natural motion
  // with an inline transform, avoids that failure mode entirely.

  // ---- Vertical rubber-band tuning (unchanged from before) ----
  const MAX_PULL = 46;   // px cap — never moves more than this regardless of drag distance
  const RESISTANCE = 90; // higher = stiffer band

  // ---- Horizontal nav-swipe tuning (unchanged) ----
  // Threshold is a real, deliberate distance (not a light nudge) — tuned
  // against screen width so it feels consistent across device sizes,
  // similar in spirit to iOS's own edge-swipe-back gesture.
  const NAV_THRESHOLD = Math.max(90, el.clientWidth * 0.24);
  const AXIS_DEADZONE = 10; // px of ambiguous movement before committing to an axis
  let active = false;      // a single touch is in progress
  let axis = null;         // null (undecided) | 'x' (nav-swipe) | 'y' (rubber-band)
  let startX = 0, startY = 0;
  let pulling = false;     // vertical rubber-band currently engaged
  let destTab = null, destName = null, dir = 0; // the adjacent tab being dragged into view, and which side it's entering from (+1 left, -1 right)
  let gestureToken = 0;    // bumped on every touchstart; lets a stale in-flight finishSlide() loop from a quickly-superseded gesture detect it's obsolete and bail instead of fighting the new one

  // Include the tab's own opacity transition (see .tab in style.css) in
  // every inline transition string set here — otherwise setting
  // el.style.transition would silently replace it and break the tab
  // switch fade the next time this tab is shown/hidden.
  function applyPull(px) {
    el.style.transition = 'transform 0s linear, opacity 0.18s ease';
    el.style.transform = `translateY(${px}px)`;
  }
  function releasePull() {
    el.style.transition = 'transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.18s ease';
    el.style.transform = '';
    pulling = false;
  }

  let track = null; // the shared track element while a gesture owns it
  let base = 0;      // track translateX that shows only `el` at rest (depends on dir)

  // Build the track with `el` and the adjacent tab side by side, ordered
  // so dragging in `direction` reveals the adjacent tab from the correct
  // edge, and park the track at the resting position that shows only `el`.
  function armSlide(name, direction) {
    destName = name;
    dir = direction;
    destTab = document.getElementById('tab-' + name);
    if (!destTab) { destTab = null; return; }
    const W = el.clientWidth;

    track = _getOrCreateSlideTrack('tab-slide-track', 60);
    // A previous gesture that never reached touchend/touchcancel (an
    // OS-level gesture — e.g. iOS's own edge-swipe-back — stealing the
    // touch mid-drag, a stray multi-touch, etc.) can leave its own two
    // tabs still parked in here from an earlier armSlide() that was never
    // followed by finishSlide()'s cleanup. Restoring them properly via
    // _slideUnmountEl — not wiping them with innerHTML below — is what
    // actually matters: innerHTML would rip them out of the document with
    // their forced opacity/pointer-events/position never reset and no way
    // to look them up by id ever again, which is the real mechanism
    // behind the rare "app frozen, tabs stop responding entirely" bug
    // after an interrupted swipe.
    Array.from(track.children).forEach(child => _slideUnmountEl(child));
    track.style.transition = 'none';
    track.style.width = (W * 2) + 'px';
    track.innerHTML = '';

    const leftChild  = dir > 0 ? destTab : el;
    const rightChild = dir > 0 ? el : destTab;
    _slideMountEl(leftChild, track, W);
    _slideMountEl(rightChild, track, W);

    // Depth cue on the incoming page's leading edge — the edge that will
    // meet the outgoing page in the middle of the drag.
    destTab.style.boxShadow = dir > 0
      ? '8px 0 28px rgba(0,0,0,0.16)'
      : '-8px 0 28px rgba(0,0,0,0.16)';

    base = dir > 0 ? -W : 0; // el is the right child when dir>0 (needs -W to sit at viewport x=0), the left child otherwise (needs 0)
    track.style.transform = `translateX(${base}px)`;
  }

  let lastClampedDx = 0; // last live-drag offset, used as the spring's start point

  function updateSlide(dx) {
    if (!destTab || !track) return;
    const W = el.clientWidth;
    lastClampedDx = Math.max(-W, Math.min(W, dx));
    const trackX = base + lastClampedDx;
    track.style.transform = `translateX(${trackX}px)`;
  }

  // easeOutBack — a manual overshoot-then-settle curve (the JS equivalent
  // of the cubic-bezier this used to run as a CSS transition).
  function springEase(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Springs the track's transform the rest of the way — either completing
  // the page turn (commit) or returning home (cancel) — with an ease-out +
  // slight overshoot, not a linear snap. Only one element's transform is
  // ever touched here.
  function finishSlide(commit) {
    if (!destTab || !track) return;
    const W = el.clientWidth;
    const finishedTrack = track, finishedDestTab = destTab, finishedDestName = destName, finishDir = dir;
    const myToken = gestureToken; // if a new touch supersedes this one before the loop finishes, bail without touching showTab or fighting the new gesture's own transform writes
    destTab = null; destName = null; track = null;

    const startX = base + lastClampedDx;
    // Commit shows only the destination tab; cancel returns to `base`
    // (shows only `el`) — in both cases that's "shift by dir*W from base".
    const endX = commit ? base + finishDir * W : base;

    finishedTrack.style.transition = 'none';
    const DURATION = 380;
    const t0 = performance.now();

    function cleanupTrack() {
      // Same freeze the back-swipe's own cleanup uses. This is reached from
      // two EARLY-RETURN paths as well as the settled one, and those were
      // calling it bare — the settled path's per-element suppression never
      // covered them, which is the chat<->scan flash.
      const app = document.getElementById('app');
      app?.classList.add('slide-cleanup');
      _slideUnmountEl(el); // also resets el's own header back to position:fixed
      _slideUnmountEl(finishedDestTab);
      finishedTrack.remove();
      void document.body.offsetHeight; // flush while still frozen
      requestAnimationFrame(() => {
        const app2 = document.getElementById('app');
        app2?.classList.remove('slide-cleanup');
        app2?.classList.remove('slide-animating');
      });
    }

    function frame(now) {
      if (myToken !== gestureToken) {
        // Superseded mid-flight — just drop both tabs back to normal
        // instantly rather than leaving them stuck mid-slide inside a
        // track a newer gesture doesn't know about.
        cleanupTrack();
        return;
      }
      const t = Math.min(1, (now - t0) / DURATION);
      const e = springEase(t);
      const trackX = startX + (endX - startX) * e;
      finishedTrack.style.transform = `translateX(${trackX}px)`;
      if (t < 1) { requestAnimationFrame(frame); return; }

      // The track is now visually settled in its final resting position —
      // nothing left to animate. showTab() below does real work beyond a
      // class swap (initSwipeDeck(), renderChatsList(), etc.), which on
      // real hardware can take long enough to still be running when the
      // next frame is due, blocking that paint. If it ran in this same
      // callback, the settled position set just above would never get its
      // own paint. Deferring by one more rAF tick guarantees the browser
      // actually paints this settled frame first, so showTab()'s work
      // always starts from a screen that already looks correct.
      requestAnimationFrame(() => {
        if (myToken !== gestureToken) { cleanupTrack(); return; }
        // Both tabs are already visually settled in their final on-screen
        // position from the slide animation that just finished — cleanupTrack
        // clearing the inline opacity override it forced during the drag (see
        // _slideUnmountEl), and showTab()'s .active class swap below, are
        // state corrections, not real visual changes. But .tab's CSS
        // `transition: opacity 0.18s ease` doesn't know that — either step can
        // read as a genuine computed-opacity change and animate a brief fade,
        // letting the tab underneath visibly bleed through for a moment
        // (the recurring "quick flash of the old page" bug). Suppress the
        // transition on both tabs for this one swap so any correction is
        // instant, then restore it next frame so normal tap-to-switch tab
        // changes keep their intended fade.
        el.style.transition = 'none';
        finishedDestTab.style.transition = 'none';
        cleanupTrack();
        if (commit) showTab(finishedDestName);
        void finishedDestTab.offsetHeight;
        requestAnimationFrame(() => {
          el.style.transition = '';
          finishedDestTab.style.transition = '';
        });
      });
    }
    requestAnimationFrame(frame);
  }

  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    // A touch starting inside e.g. the Home tab's swipe-card deck must
    // belong entirely to that control's own drag handling — arming this
    // gesture too would mean one finger driving two independent swipes at
    // once (the card AND the tab underneath it).
    if (excludeSelector && e.target.closest(excludeSelector)) { active = false; return; }
    active = true;
    axis = null;
    pulling = false;
    destTab = null; destName = null;
    gestureToken++;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (axis === null) {
      if (Math.abs(dx) < AXIS_DEADZONE && Math.abs(dy) < AXIS_DEADZONE) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'x') {
        const target = dx > 0 ? leftTarget : rightTarget;
        if (target) armSlide(target, dx > 0 ? 1 : -1);
      }
    }

    if (axis === 'y') {
      const atTop    = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
        pulling = true;
        const resisted = Math.sign(dy) * MAX_PULL * (1 - 1 / (Math.abs(dy) / RESISTANCE + 1));
        applyPull(resisted);
      } else if (pulling) {
        releasePull();
      }
      return;
    }

    // axis === 'x'
    if (destTab) updateSlide(dx);
  }, { passive: true });

  function finishTouch(dx) {
    active = false;
    if (axis === 'y') {
      if (pulling) releasePull();
    } else if (axis === 'x' && destTab) {
      finishSlide(Math.abs(dx) >= NAV_THRESHOLD);
    }
    axis = null;
  }

  el.addEventListener('touchend', e => {
    if (!active) return;
    const t = e.changedTouches[0];
    finishTouch(t ? t.clientX - startX : 0);
  });
  el.addEventListener('touchcancel', () => {
    if (!active) return;
    finishTouch(0);
  });
}

// Trackpad-style swipe-back: drag left->right starting ANYWHERE on the
// screen (no edge hitbox) to trigger whatever "back" function this screen
// already uses. Applied to a fixed, explicit allowlist of screens only
// (wired up below) — every other screen is untouched.
//
// Where the destination is knowable ahead of time, this uses the same
// single-container reveal technique as the tab carousel: the real
// destination element (a .tab or another .screen) is reparented into a
// shared track alongside this screen and both slide together as the
// finger moves, so the actual content underneath is what's revealed —
// not a fake stand-in. Where it genuinely isn't knowable in advance
// (tellZeloBack() may step back within a wizard instead of exiting;
// goBackFromResult() may show a save-prompt instead of navigating), this
// falls back to a plain slide-away with a depth shadow, since there's no
// real content to reveal for those cases.
function _defaultBackRevealTarget() {
  // Mirrors popScreen()'s own resolution: the top of the screen stack if
  // there is one, otherwise whatever tab is currently active.
  if (state.screenStack.length) {
    const el = document.getElementById('screen-' + state.screenStack[state.screenStack.length - 1]);
    if (el) return el;
  }
  return document.getElementById('tab-' + state.activeTab);
}

function attachEdgeSwipeBack(screenId, backFn, opts) {
  opts = opts || {};
  const el = document.getElementById(screenId);
  if (!el || el._edgeSwipeAttached) return;
  el._edgeSwipeAttached = true;

  const AXIS_DEADZONE = 10;
  let active = false, axis = null, startX = 0, startY = 0, lastDx = 0;
  let gestureToken = 0;
  let track = null, targetEl = null, usingReveal = false;

  function threshold() { return Math.max(90, el.clientWidth * 0.28); }

  function springEase(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function resolveTarget() {
    return opts.resolveTarget ? opts.resolveTarget() : _defaultBackRevealTarget();
  }

  // Decides — once, at the moment a drag commits to the horizontal axis —
  // whether a live destination can be revealed this time, and if so
  // builds the shared track for it. Re-evaluated on every new touch since
  // e.g. tellzelo's step or scan-result's saved state can change between
  // gestures.
  let unhidTabBar = false; // whether this drag temporarily un-hid the tab-bar (pushScreen() hides it while any screen is active)
  let tabBar = null; // set only while unhidTabBar is true — see armReveal()

  function armReveal() {
    targetEl = resolveTarget();
    if (!targetEl || targetEl === el) { usingReveal = false; return; }
    usingReveal = true;
    const W = el.clientWidth;
    track = _getOrCreateSlideTrack('back-slide-track', 90); // above normal .tab/.screen stacking, below .tab-bar's z-index:100
    // Same defensive restore as armSlide() above — see its comment for the
    // full explanation of why innerHTML alone is the actual bug.
    Array.from(track.children).forEach(child => _slideUnmountEl(child));
    track.style.transition = 'none';
    track.style.width = (W * 2) + 'px';
    track.innerHTML = '';
    _slideMountEl(targetEl, track, W); // left child — revealed as the user drags right
    _slideMountEl(el, track, W);       // right child — this screen, dragged away
    track.style.transform = `translateX(${-W}px)`; // resting: el alone fills the viewport

    // Revealing a tab means the real destination (once this actually
    // completes) will have the tab-bar visible — but pushScreen() hid it
    // for as long as this screen has been active. Un-hiding it here (so
    // it's paintable at all — display:none can't fade) but starting it at
    // opacity:0 and fading it in step with the drag itself (see the
    // touchmove handler and finish()'s own frame loop below), instead of
    // snapping straight to fully visible the instant the gesture locks
    // onto this axis, is what actually matters: doing that unconditionally
    // made the tab-bar visibly pop in within the first ~10px of any
    // rightward drag, long before the page underneath was meaningfully
    // revealed — reads as it "popping up first" rather than arriving
    // together with the page it belongs to.
    const tabBarEl = document.getElementById('tab-bar');
    if (targetEl.classList.contains('tab') && tabBarEl && tabBarEl.classList.contains('hidden')) {
      tabBarEl.classList.remove('hidden');
      // The bar carries backdrop-filter: blur(24px) saturate(180%). Pulling
      // a backdrop-filter element in and out of the render tree forces
      // WebKit to tear down and rebuild its compositing layer, which is a
      // well-known source of a one-frame flash across the area behind it —
      // and this is the only thing in a cancelled back-swipe that does
      // that. Dropped for the gesture's duration; the bar is fading from
      // zero the whole time, so losing the blur transiently is invisible.
      tabBarEl.classList.add('tab-bar--gesture-reveal');
      tabBarEl.style.transition = 'none';
      tabBarEl.style.opacity = '0';
      tabBar = tabBarEl;
      unhidTabBar = true;
    }
  }

  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    // Lets a caller turn this whole gesture off under some condition (e.g.
    // AI Coach's chat-sheet mode, which uses a different vertical
    // swipe-down-to-close gesture on this same element instead — see
    // attachAiCoachChatSheetDragClose()) without needing a DOM selector.
    if (opts.disabled && opts.disabled()) { active = false; return; }
    // A touch starting inside e.g. the Scan Result reply carousel must
    // belong entirely to that control's own horizontal swipe.
    if (opts.excludeSelector && e.target.closest(opts.excludeSelector)) { active = false; return; }
    active = true;
    axis = null;
    lastDx = 0;
    usingReveal = false;
    gestureToken++;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);

    if (axis === null) {
      if (Math.abs(dx) < AXIS_DEADZONE && dy < AXIS_DEADZONE) return;
      // Only a rightward, horizontally-dominant drag means "back" — a
      // leftward drag has no defined gesture here, and a vertical one is
      // normal scrolling; both are left alone entirely.
      axis = (Math.abs(dx) > dy && dx > 0) ? 'x' : 'dead';
      // A message row commits its own swipe-to-reply on the same touch a
      // few pixels earlier (rows listen at the target, this listens as the
      // event bubbles up, so the flag is already set by now). Back-swipe
      // stands down for that drag only — which keeps it working everywhere
      // else, including a rightward drag on the user's own messages, where
      // the row replies leftward and never claims it.
      if (axis === 'x' && _msgRowSwipeClaimed) { axis = 'dead'; active = false; return; }
      if (axis === 'x') {
        // Snap any keyboard-avoidance shift back to rest BEFORE this
        // screen gets reparented into the live drag track below — armReveal()
        // mounts whatever this screen looks like RIGHT NOW for the reveal
        // animation, so if a shift was still applied (keyboard was open),
        // that shifted state is what drags/reveals, and closeAiCoach()'s own
        // clear (added earlier for this exact glitch) only runs once the
        // gesture actually completes — too late for the drag itself, and
        // never at all if the gesture is released early and cancelled.
        // Instant, not eased — this is the start of leaving the screen, so
        // any animated settle here is exactly the "screen moves by itself"
        // motion this is meant to prevent, not produce.
        if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
        armReveal();
      }
    }
    if (axis !== 'x') return;

    const clamped = Math.max(0, Math.min(el.clientWidth, dx));
    lastDx = clamped;
    if (usingReveal) {
      track.style.transform = `translateX(${clamped - el.clientWidth}px)`;
      if (tabBar) tabBar.style.opacity = String(clamped / el.clientWidth);
    } else {
      el.style.transition = 'none';
      el.style.transform = `translateX(${clamped}px)`;
      el.style.boxShadow = `-8px 0 24px rgba(0,0,0,${0.18 * (clamped / el.clientWidth)})`;
    }
  }, { passive: true });

  function finish(commit) {
    const W = el.clientWidth;
    const myToken = gestureToken;
    const DURATION = 380;
    const t0 = performance.now();

    if (usingReveal) {
      const finishedTrack = track, finishedTarget = targetEl;
      track = null; targetEl = null;
      const startPx = lastDx - W;
      const endPx = commit ? 0 : -W;
      finishedTrack.style.transition = 'none';

      const cleanupTrack = () => {
        // Unmounting restores the inline opacity _slideMountEl() forced
        // during the drag, and .screen/.tab's own `transition: opacity`
        // happily animates that correction as a real fade — the one-second
        // blink when a settle is interrupted. The settle path below already
        // suppressed this for its own swap, but the two early-return paths
        // (a fresh touch bumping gestureToken mid-settle, which is exactly
        // "swipe, come back to the same page") called this bare. Doing it
        // here covers every exit instead.
        // Per-element suppression wasn't enough: unmounting resets inline
        // opacity/position on BOTH pages and re-hides the tab bar, and any
        // of those corrections can be picked up as an animatable change.
        // Freeze the lot for the swap, then release next frame.
        const app = document.getElementById('app');
        app?.classList.add('slide-cleanup');
        _slideUnmountEl(el);
        _slideUnmountEl(finishedTarget);
        finishedTrack.remove();
        // Cancelled — staying on this screen, which expects the tab-bar
        // hidden. On commit, leave it as-is: backFn() (popScreen/showTab)
        // already re-derives the correct state on its own.
        const barToSettle = tabBar, reHide = !commit && unhidTabBar;
        unhidTabBar = false;
        tabBar = null;
        void document.body.offsetHeight; // flush while still frozen
        // The bar is already at opacity 0 by now, so settling it a frame
        // later is invisible — and it keeps the display toggle (a
        // compositing-layer teardown, see armReveal's note) out of the same
        // frame as the reparent above. Two heavy operations in one frame is
        // what gives the compositor a chance to show a gap.
        requestAnimationFrame(() => {
          if (reHide) barToSettle?.classList.add('hidden');
          if (barToSettle) {
            barToSettle.style.opacity = '';
            barToSettle.style.transition = '';
            barToSettle.classList.remove('tab-bar--gesture-reveal');
          }
          const app2 = document.getElementById('app');
          app2?.classList.remove('slide-cleanup');
          app2?.classList.remove('slide-animating');
        });
      };
      const frame = now => {
        if (myToken !== gestureToken) { cleanupTrack(); return; }
        const t = Math.min(1, (now - t0) / DURATION);
        const e = springEase(t);
        const trackX = startPx + (endPx - startPx) * e;
        finishedTrack.style.transform = `translateX(${trackX}px)`;
        // Keep fading in lockstep with the same spring through the
        // release/settle animation, not just the live drag — otherwise a
        // fast flick would still jump straight to fully visible the
        // instant the finger lifts, before the settle animation finishes.
        if (tabBar) tabBar.style.opacity = String(Math.max(0, Math.min(1, (trackX + W) / W)));
        if (t < 1) { requestAnimationFrame(frame); return; }
        // Settle one extra frame before calling the (possibly heavy) back
        // function — same reasoning as the tab-carousel fix — so the
        // browser actually paints the fully-settled position first.
        requestAnimationFrame(() => {
          if (myToken !== gestureToken) { cleanupTrack(); return; }
          // cleanupTrack() clears the inline opacity override _slideMountEl
          // forced during the drag, and backFn() (popScreen/closeJourney/
          // closeMissionControl/etc.) flips .active on el/target — both are
          // state corrections, not real visual changes, but .screen/.tab's
          // own `transition: opacity` doesn't know that and can read either
          // as a genuine opacity change, animating a brief fade where the
          // old screen visibly flashes back in (the same "quick flash of
          // the old page" bug the tab-carousel's finishSlide() fixed).
          // Suppress it for this one swap, then restore next frame so
          // normal tap navigation keeps its intended fade.
          el.style.transition = 'none';
          finishedTarget.style.transition = 'none';
          cleanupTrack();
          if (commit) backFn();
          void finishedTarget.offsetHeight;
          requestAnimationFrame(() => {
            el.style.transition = '';
            finishedTarget.style.transition = '';
          });
        });
      };
      requestAnimationFrame(frame);
    } else {
      const startPx = lastDx;
      // opts.willNavigate lets a caller say "committing this gesture won't
      // actually leave the screen" (scan-result: backFn() may just pop up
      // the save-prompt sheet instead of navigating, exactly when
      // usingReveal is false here) — sliding fully away and then
      // snapping back for the sheet read as the screen leaving and
      // un-leaving before the prompt showed up. Defaults to true so every
      // other caller (which never passes this) keeps its current behavior.
      const willNavigate = opts.willNavigate ? opts.willNavigate() : true;
      const endPx = (commit && willNavigate) ? W : 0;
      el.style.transition = 'none';

      const frame = now => {
        if (myToken !== gestureToken) return;
        const t = Math.min(1, (now - t0) / DURATION);
        const e = springEase(t);
        const px = startPx + (endPx - startPx) * e;
        el.style.transform = `translateX(${px}px)`;
        el.style.boxShadow = `-8px 0 24px rgba(0,0,0,${0.18 * Math.max(0, Math.min(1, px / W))})`;
        if (t < 1) { requestAnimationFrame(frame); return; }
        requestAnimationFrame(() => {
          if (myToken !== gestureToken) return;
          el.style.transition = '';
          el.style.transform = '';
          el.style.boxShadow = '';
          if (commit) backFn();
        });
      };
      requestAnimationFrame(frame);
    }
  }

  el.addEventListener('touchend', e => {
    if (!active) return;
    active = false;
    const wasX = axis === 'x';
    axis = null;
    if (!wasX) return;
    const t = e.changedTouches[0];
    const dx = t ? Math.max(0, Math.min(el.clientWidth, t.clientX - startX)) : 0;
    finish(dx >= threshold());
  });
  el.addEventListener('touchcancel', () => {
    if (!active) return;
    active = false;
    const wasX = axis === 'x';
    axis = null;
    if (!wasX) return;
    finish(false);
  });
}

// AI Coach chat-history panel — swipe-right-to-close, tied live to the
// finger the same way attachProfileDetailDragToClose() below drags its
// sheet: closing this panel isn't a real navigation (it's the exact same
// "dismiss the overlay" as tapping the scrim, see toggleAiCoachHistoryPanel()),
// so it shouldn't get attachEdgeSwipeBack's "slide the whole screen away
// like a page transition" treatment. Attached to the panel + scrim
// themselves (not #screen-ai-coach) with stopPropagation on move/end, so
// attachEdgeSwipeBack's own listener there — which still handles the
// "swipe from the dimmed sliver on the left" edge case — never sees these
// touches and doesn't fight this over the same gesture.
function attachAiCoachHistoryDragClose() {
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!panel || !scrim || panel._dragCloseAttached) return;
  panel._dragCloseAttached = true;

  let active = false, startX = 0, dx = 0, W = 0;

  function onStart(e) {
    if (!_aiCoachHistoryOpen || e.touches.length !== 1) return;
    active = true;
    startX = e.touches[0].clientX;
    dx = 0;
    W = panel.clientWidth || 320;
    panel.style.transition = 'none';
    scrim.style.transition = 'none';
  }
  function onMove(e) {
    if (!active) return;
    dx = Math.max(0, e.touches[0].clientX - startX); // only the closing direction moves it
    panel.style.transform = `translateX(${dx}px)`;
    scrim.style.opacity = String(Math.max(0, 1 - dx / W));
  }
  function settle(closing) {
    if (!active) return;
    active = false;
    const EASE = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transition = EASE;
    scrim.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transform = '';
    scrim.style.opacity = '';
    if (closing) {
      toggleAiCoachHistoryPanel(false); // removes .open -> CSS carries the transform/opacity the rest of the way, animated by the transitions just set
    }
    setTimeout(() => { panel.style.transition = ''; scrim.style.transition = ''; }, 340);
    dx = 0;
  }

  [panel, scrim].forEach(el => {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', e => { onMove(e); e.stopPropagation(); }, { passive: true });
    el.addEventListener('touchend', e => {
      const wasActive = active;
      const committed = wasActive && dx > W * 0.3;
      settle(committed);
      if (wasActive) e.stopPropagation();
    });
    el.addEventListener('touchcancel', e => {
      const wasActive = active;
      settle(false);
      if (wasActive) e.stopPropagation();
    });
  });
}

// Exact reverse of attachAiCoachHistoryDragClose() above — a leftward
// drag starting anywhere on the main AI Coach content (while the history
// panel is closed) live-reveals it from the right, in step with the
// finger, same easing/spring-back/commit-threshold logic as closing it.
// Attached to #aicoach-main (not #screen-ai-coach itself) so it targets
// the same closed-state content the close-gesture's panel/scrim sit
// beside — mutually exclusive with that one via _aiCoachHistoryOpen, so
// only one of the two is ever actually live for a given drag.
function attachAiCoachHistorySwipeOpen() {
  const main  = document.getElementById('aicoach-main');
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!main || !panel || !scrim || main._historySwipeOpenAttached) return;
  main._historySwipeOpenAttached = true;

  const AXIS_DEADZONE = 10;
  let active = false, axis = null, startX = 0, startY = 0, dx = 0, W = 0;

  main.addEventListener('touchstart', e => {
    if (_aiCoachHistoryOpen || e.touches.length !== 1) { active = false; return; }
    active = true;
    axis = null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    W = panel.clientWidth || Math.round(main.clientWidth * 0.78);
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const rawDx = t.clientX - startX;
    const rawDy = Math.abs(t.clientY - startY);
    if (axis === null) {
      if (Math.abs(rawDx) < AXIS_DEADZONE && rawDy < AXIS_DEADZONE) return;
      // Only a leftward, horizontally-dominant drag opens the panel — a
      // rightward or vertical one is left alone entirely (normal scroll,
      // or the separate edge-swipe-back gesture on #screen-ai-coach).
      axis = (Math.abs(rawDx) > rawDy && rawDx < 0) ? 'x' : 'dead';
      if (axis === 'x') {
        panel.style.transition = 'none';
        scrim.style.transition = 'none';
      }
    }
    if (axis !== 'x') return;
    dx = Math.min(0, t.clientX - startX);
    const openAmount = Math.min(W, -dx); // 0 (closed) .. W (fully open)
    panel.style.transform = `translateX(${W - openAmount}px)`;
    scrim.style.opacity = String(openAmount / W);
    e.stopPropagation();
  }, { passive: true });

  function finish(e) {
    if (!active) return;
    active = false;
    const wasDragging = axis === 'x';
    axis = null;
    if (!wasDragging) return;
    const openAmount = Math.min(W, -dx);
    const committed = openAmount > W * 0.3;
    const EASE = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transition = EASE;
    scrim.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transform = '';
    scrim.style.opacity = '';
    if (committed) {
      toggleAiCoachHistoryPanel(true); // adds .open -> CSS carries the transform/opacity the rest of the way, animated by the transitions just set
    }
    setTimeout(() => { panel.style.transition = ''; scrim.style.transition = ''; }, 340);
    dx = 0;
    e.stopPropagation();
  }
  main.addEventListener('touchend', finish);
  main.addEventListener('touchcancel', finish);
}

// Swipe-down-to-dismiss on the row-actions sheet — the WHOLE overlay
// (backdrop included, not just the small grey handle strip) is the
// draggable hit area now. It used to be scoped to just
// .aicoach-row-actions-drag-zone, a few-pixel-tall strip at the very top
// of the card — dragging down anywhere else on the sheet (the backdrop
// around the card, the gaps between rows) did nothing, which read as "the
// page underneath is what's scrolling" since nothing claimed that gesture.
// A small move-distance deadzone (see DRAG_DEADZONE) keeps this from
// eating real taps on Rename/Delete/Cancel: those fire from touchend with
// ~0 net movement, same as before, just now measured off the whole sheet
// instead of only the handle. Shared by both the AI Coach chat-history
// row-actions sheet and History's own (see openHistoryRowActions()).
// .thread-link-card itself is the scrollable element when it has enough
// content to need it ("Link a thread"'s own long list) — max-height:70%+
// overflow-y:auto (see style.css); the two row-actions sheets turn that
// back off (overflow:visible) since they never have enough content to
// scroll, so checking card.scrollTop is always harmlessly 0 for them.
// Same guard attachProfileDetailDragToClose() already uses elsewhere, so
// scrolling back up through a long list is never hijacked into a close
// attempt partway there.
function attachAiCoachRowActionsDragClose(overlayId, onClose) {
  const overlay = document.getElementById(overlayId);
  const card    = overlay ? overlay.querySelector('.thread-link-card') : null;
  if (!card || !overlay) return;

  const DRAG_DEADZONE = 6; // px of vertical movement before this counts as a drag, not a tap
  let startY = 0, dragging = false, committed = false, dy = 0;

  function onStart(clientY) {
    if (card.scrollTop > 0) return;
    startY = clientY;
    dragging = true;
    committed = false;
    dy = 0;
    card.style.transition = 'none';
  }
  function onMove(clientY, e) {
    if (!dragging) return;
    dy = clientY - startY;
    if (!committed) {
      if (dy < DRAG_DEADZONE) { dy = 0; return; } // still within the tap deadzone — don't touch the transform at all
      committed = true;
    }
    // Once this is a real drag (not a tap), stop the browser from ALSO
    // scrolling whatever scrollable ancestor this overlay happens to sit
    // inside — it's position:fixed so it doesn't visually move with that
    // scroll, but the touch is still a descendant of #screen-history (a
    // .screen, which is overflow-y:auto by default), so without this the
    // same touch drags the sheet down AND scrolls the list underneath at
    // the same time. Only possible on a non-passive listener, which is
    // exactly why this listener (registered further down) isn't one.
    if (e && e.cancelable) e.preventDefault();
    card.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    if (committed && dy > 70) {
      card.style.transform = '';
      onClose();
    } else if (committed) {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform  = '';
      setTimeout(() => { card.style.transition = ''; }, 320);
    }
    dy = 0;
    committed = false;
  }

  overlay.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  // Not passive — see onMove()'s own comment on why this drag needs to be
  // able to preventDefault() the underlying screen's native scroll.
  overlay.addEventListener('touchmove',  e => onMove(e.touches[0].clientY, e),  { passive: false });
  overlay.addEventListener('touchend',   onEnd);
  overlay.addEventListener('touchcancel', onEnd);
  overlay.addEventListener('mousedown', e => {
    onStart(e.clientY);
    const onMouseMove = ev => onMove(ev.clientY);
    const onMouseUp   = () => {
      onEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });
}

// Fix 2: Swipe-down-to-dismiss on the profile detail sheet.
// Supports both touch (mobile) and mouse (desktop). Only activates
// when the internal scroll is at the top so normal bio scrolling is
// never interrupted. Dragging upward cancels immediately.
function attachProfileDetailDragToClose() {
  const sheet    = document.querySelector('.profile-detail-sheet');
  const scrollEl = sheet ? sheet.querySelector('.profile-detail-scroll') : null;
  if (!sheet) return;

  let startY = 0, dragging = false, dy = 0;

  // Only scroll DOWN past the photo: at the top, a downward pull must not
  // rubber-band the content (it showed empty space above the photo) — that
  // same pull is the drag-to-close gesture below, which still runs.
  if (scrollEl && !scrollEl._noTopBounce) {
    scrollEl._noTopBounce = true;
    let y0 = 0;
    scrollEl.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    scrollEl.addEventListener('touchmove', e => {
      if (scrollEl.scrollTop <= 0 && e.touches[0].clientY > y0) e.preventDefault();
    }, { passive: false });
  }

  function onStart(clientY) {
    if (scrollEl && scrollEl.scrollTop > 0) return;
    startY   = clientY;
    dragging = true;
    dy       = 0;
    sheet.style.transition = 'none';
    sheet.style.userSelect = 'none';
    sheet.style.webkitUserSelect = 'none';
  }

  function onMove(clientY) {
    if (!dragging) return;
    dy = Math.max(0, clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    sheet.style.userSelect = '';
    sheet.style.webkitUserSelect = '';
    // 30% of the screen was a long, deliberate haul — matched to the AI
    // Coach sheet's own 100px so it closes with an ordinary flick.
    if (dy > 110) {
      sheet.style.transform = '';
      closeProfileDetail();
    } else {
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      sheet.style.transform  = '';
      setTimeout(() => { sheet.style.transition = ''; }, 320);
    }
    dy = 0;
  }

  // Touch
  sheet.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  sheet.addEventListener('touchmove',  e => onMove(e.touches[0].clientY),  { passive: true });
  sheet.addEventListener('touchend',   onEnd);
  sheet.addEventListener('touchcancel', onEnd);

  // Mouse (desktop testing)
  sheet.addEventListener('mousedown', e => {
    onStart(e.clientY);
    const onMouseMove = ev => onMove(ev.clientY);
    const onMouseUp   = () => {
      onEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });
}

function onProfileDetailSkip() {
  closeProfileDetail();
  onSkipBtn();
}

function onProfileDetailLike() {
  closeProfileDetail();
  onLikeBtn();
}


// ================================================================
// MATCH OVERLAY
// ================================================================

function showMatchOverlay(profile) {
  // Populate match screen with this profile's details
  document.getElementById('match-name').textContent = profile.name;

  const avatarThem = document.getElementById('match-avatar-them');
  avatarThem.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  avatarThem.innerHTML        = `${profile.initial}${_pfpImgHTML(profile)}`;

  // Wire up state for startChat()
  state.character  = profile;
  state.difficulty = profile.difficulty;
  state.replyIndex = 0;

  // Create a new chat entry in the store for this match
  const newChatId = 'chat_' + Date.now();
  state.activeChatId = newChatId;
  chatStore.unshift({
    id:          newChatId,
    profile:     profile,
    difficulty:  profile.difficulty,
    mode:        'training',
    cardMode:    state.cardModes[profile.name] || CARD_MODE_DEFAULT,
    messages:    [],
    lastMessage: 'New match!',
    lastActive:  'just now',
    unread:      0
  });

  pushScreen('match');

  // A fast/long swipe can already carry the card fully off-screen before
  // commitSwipe()'s own fly-off transition even starts (see that function's
  // comment) — so the plain instant screen fade this used to rely on was
  // the only motion left to see, and barely registered as one. This gives
  // the match its own deliberate, guaranteed-visible entrance instead (see
  // .match-entrance in style.css) regardless of how the swipe played out.
  // Remove+reflow+re-add so the animation actually replays on every match,
  // not just the first one this session (a class that's already present
  // doesn't restart its animation just by being "added" again).
  const matchScreen = document.getElementById('screen-match');
  matchScreen.classList.remove('match-entrance');
  void matchScreen.offsetWidth;
  matchScreen.classList.add('match-entrance');

  // Buzz timed to .match-heart-medallion's own animation-delay (0.42s, see
  // style.css) so it lands right as the heart pops in, not on screen-open.
  setTimeout(() => { navigator.vibrate?.(15); _cineHaptic('MEDIUM'); }, 420);
}

// "Start Chatting" — gates on available slots (Feature 7), not raw count.
// Slots can be restored after 10-day deletion cooldown.
function onStartChatting() {
  if (!isPaidUser() && matchSlots() <= 0) {
    flashLimitToast("You've used all 3 slots. A slot restores 10 days after deleting a chat.");
    return;
  }
  incrementMatchCount();
  decrementMatchSlots();
  startChat();
}


// ================================================================
// ASSISTANT: INPUT GATING
// Generate button enables when there is text OR an uploaded image.
// ================================================================

function onAsstInput() {
  const el = document.getElementById("asst-input");
  const cc = document.getElementById("char-count");
  if (cc) cc.textContent = `${el.value.length}/4000`;
  updateScanMessagePreview();
  checkGenerateReady();
}

// Keeps the message preview button on the main Scan page in sync with
// whatever was typed on the dedicated typing page.
function clearScanInput() {
  state.asstMessage = '';
  state.asstConversationMessages = null;
  state.asstContext = '';
  state.scanContext = {};
  state.tellzeloAnswers = {};
  state.scanWhoCard = null;
  const input = document.getElementById('asst-input');
  if (input) input.value = '';
  updateScanMessagePreview();
  updateTellZeloSummary(); // resets the "Or tell zelo more" subtitle + all 3 card highlights
  // Full reset once a scan is done — screenshot goes too, back to a blank Scan tab
  clearUploadedPhoto();
}

function updateScanMessagePreview() {
  const text    = document.getElementById("asst-input")?.value.trim();
  const previewEl = document.getElementById("asst-message-preview-text");
  if (!previewEl) return;
  if (text) {
    previewEl.textContent = text;
    previewEl.classList.remove("msg-preview-placeholder");
  } else {
    previewEl.textContent = "Paste a message, describe the situation, or upload a screenshot…";
    previewEl.classList.add("msg-preview-placeholder");
  }
}

// ---- Legacy situation hooks — kept null-safe for the guided tour ----
function openSituation()  { document.getElementById('situation')?.classList.add('open'); }
function closeSituation() { document.getElementById('situation')?.classList.remove('open'); }


// ================================================================
// SCAN — DEDICATED SUB-PAGES
// Message typing, screenshot upload, and the generated reply each
// live on their own screen so the Scan tab stays a lightweight
// entry point (tap a row → its own page → back into Scan).
// ================================================================

function openScanType() {
  document.getElementById('asst-input')?.focus();
}

function confirmScanType() {
  updateScanMessagePreview();
  checkGenerateReady();
}

function renderScanTypeThreadPicker() {
  const container = document.getElementById('scan-type-thread-picker');
  if (!container) return;
  const threads = getThreads();
  if (threads.length === 0) {
    container.innerHTML = '<p class="scan-type-thread-empty">No threads yet — you can save after analyzing.</p>';
    return;
  }
  let html = '<p class="scan-type-thread-label">Save to a thread?</p>';
  threads.forEach(t => {
    const sel = state.preselectThreadId === t.id ? ' selected' : '';
    const safeId = t.id.replace(/'/g, "\\'");
    html += `<button class="scan-type-thread-row${sel}" onclick="togglePreselectThread('${safeId}')">
      <span>${t.name}</span>
      <span class="scan-type-thread-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>
    </button>`;
  });
  container.innerHTML = html;
}

function togglePreselectThread(id) {
  state.preselectThreadId = state.preselectThreadId === id ? null : id;
  renderScanTypeThreadPicker();
}

function openScanUpload() {
  pushScreen('scan-upload');
}


// ================================================================
// TELL ZELO MORE — a quick, tap-driven context flow (not a form).
// Context lives here, off the Scan page, so Scan stays lightweight.
// ================================================================

const TELLZELO_STEPS = [
  {
    key:  "who",
    q:    "Who is this to you?",
    options: [
      { icon: "💌", label: "New Match" },
      { icon: "👀", label: "Crush" },
      { icon: "⏳", label: "Talking for a While" },
      { icon: "✨", label: "Situationship" },
      { icon: "💕", label: "Someone I'm Dating" },
      { icon: "💔", label: "Ex" },
      { icon: "🤝", label: "Friend" },
    ],
  },
  {
    key:  "situation",
    q:    "What's going on?",
    options: [
      { icon: "🌱", label: "First Conversation" },
      { icon: "📅", label: "Planning Something" },
      { icon: "😏", label: "Flirting" },
      { icon: "🤐", label: "Awkward Silence" },
      { icon: "😤", label: "Argument" },
      { icon: "⚠️", label: "Toxic Relationship" },
      { icon: "🌤️", label: "Getting to Know Each Other" },
    ],
  },
  {
    key:  "goal",
    q:    "What do you want?",
    options: [
      { icon: "💬", label: "Get a Reply" },
      { icon: "🔄", label: "Keep Things Going" },
      { icon: "💘", label: "Ask Them Out" },
      { icon: "🔧", label: "Fix Things" },
      { icon: "😂", label: "Be Funny" },
      { icon: "🎯", label: "Be Direct" },
    ],
  },
  {
    key:   "extra",
    q:     "Add the last bit of seasoning.",
    freeText: true,
    placeholder: "Anything extra that might help.",
  },
];

// ---- "Who's this about?" quick-pick cards (Dating, Crush) ----
// Shortcuts that set the same state.scanContext.who the full Tell Zelo More
// wizard uses — generateReplies() and the wizard both read from the same
// place, so a quick pick here is indistinguishable from picking it in step 1
// of the wizard. Opening "Or tell zelo more" still gets the full flow.
// Deliberately does NOT call updateTellZeloSummary() — that would also mark
// the "Or tell zelo more" card as filled/highlighted, showing two selected
// cards at once. Only one card should ever look selected at a time.
function scanQuickWho(label, el) {
  // Quick-picks replace the ACTIVE selection only — state.tellzeloAnswers
  // (the Other wizard's own progress) is deliberately left untouched so it's
  // still there if the user taps back into Other later this session.
  const card = label === 'Dating' ? 'dating' : 'crush';
  // Tapping the already-selected (pink) card again cancels it, back to the
  // same "nothing picked yet" state the app starts in — a real toggle,
  // not just re-confirming the same pick every tap.
  if (state.scanWhoCard === card) {
    state.scanContext = {};
    state.scanWhoCard = null;
  } else {
    state.scanContext = { who: label };
    state.scanWhoCard = card;
  }
  refreshScanWhoCards();
  navigator.vibrate?.(4);
}

// Single source of truth for the "Who's this about?" highlight — exactly one
// of Dating / Crush / Other is ever marked selected, driven off
// state.scanWhoCard (not off scanContext content, since a completed Other
// answer can coincidentally share a label with a quick-pick, e.g. "Crush").
function refreshScanWhoCards() {
  const dating = document.getElementById('scan-who-dating');
  const crush  = document.getElementById('scan-who-crush');
  const other  = document.getElementById('tellzelo-card');
  const remove = document.getElementById('scan-who-remove');
  dating?.classList.toggle('selected', state.scanWhoCard === 'dating');
  crush?.classList.toggle('selected', state.scanWhoCard === 'crush');
  other?.classList.toggle('filled', state.scanWhoCard === 'other');
  if (remove) remove.hidden = !state.scanWhoCard;
}

// "Remove" button next to the "Who's this about?" heading — clears
// whichever of Dating/Crush/Other is currently picked, same end state as
// tapping an already-selected quick-pick card again (see scanQuickWho()),
// just without needing to know that trick, and it works for "Other" too
// (which has no tap-to-toggle of its own, since tapping it opens the
// wizard instead of picking it directly).
function scanWhoRemove() {
  state.scanContext = {};
  state.scanWhoCard = null;
  refreshScanWhoCards();
  navigator.vibrate?.(4);
}

// Open the flow — always start at the first step, keep prior selections.
function openTellZelo() {
  state.tzStep = 0;
  pushScreen('tellzelo');
  renderTellZeloStep();
}

function renderTellZeloStep() {
  const step = TELLZELO_STEPS[state.tzStep];

  // Progress — one segment per step, filled up to and including the current one
  const prog = document.getElementById("tz-progress");
  prog.innerHTML = "";
  TELLZELO_STEPS.forEach((_, i) => {
    const seg = document.createElement("span");
    seg.className = "tz-seg" + (i <= state.tzStep ? " done" : "");
    prog.appendChild(seg);
  });

  document.getElementById("tz-question").textContent = step.q;

  // Help line is gone — hide the element so it takes no space
  const helpEl = document.getElementById("tz-help");
  helpEl.textContent = "";
  helpEl.style.display = "none";

  const wrap = document.getElementById("tz-options");
  wrap.innerHTML = "";

  const isLast = state.tzStep === TELLZELO_STEPS.length - 1;
  document.getElementById("tz-next-label").textContent = isLast ? "Done" : "Next";

  if (step.freeText) {
    // Free-text step — render a plain textarea instead of radio options
    const ta = document.createElement("textarea");
    ta.id          = "tz-freetext";
    ta.className   = "msg-textarea tz-freetext";
    ta.placeholder = step.placeholder || "";
    ta.value       = state.tellzeloAnswers[step.key] || "";
    ta.oninput     = () => {
      state.tellzeloAnswers[step.key] = ta.value;
      // "Done" is always enabled on the free-text step (it's optional seasoning)
      document.getElementById("tz-next").disabled = false;
    };
    wrap.appendChild(ta);
    // Free-text step is always advanceable (it's optional)
    document.getElementById("tz-next").disabled = false;
  } else {
    // Radio-style quick-select options
    const chosen = state.tellzeloAnswers[step.key];
    step.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tz-option" + (chosen === opt.label ? " selected" : "");
      btn.onclick = () => tellZeloSelect(step.key, opt.label);
      btn.innerHTML = `
        <span class="tz-option-icon">${opt.icon}</span>
        <span class="tz-option-label">${opt.label}</span>
        <span class="tz-option-radio">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>`;
      wrap.appendChild(btn);
    });
    document.getElementById("tz-next").disabled = !state.tellzeloAnswers[step.key];
  }
  _tzMakeScrollable();
}

// The screen is the scroller (.screen is overflow-y:auto), but a step that
// fits the viewport has nothing to scroll, so it felt fixed. Same size, same
// layout — just guarantee a little overflow so it drags and bounces.
function _tzMakeScrollable() {
  const el = document.getElementById('screen-tellzelo');
  if (!el) return;
  requestAnimationFrame(() => _ensureScrollableOverflow(el, 56));
}

function tellZeloSelect(key, label) {
  state.tellzeloAnswers[key] = label;
  renderTellZeloStep();
}

function tellZeloNext() {
  const step = TELLZELO_STEPS[state.tzStep];
  if (!step.freeText && !state.tellzeloAnswers[step.key]) return;  // require a choice (not for free-text)

  if (state.tzStep < TELLZELO_STEPS.length - 1) {
    state.tzStep++;
    renderTellZeloStep();
  } else {
    // Wizard complete — this becomes the ACTIVE selection for the pending
    // scan and "Other" becomes the exclusively-highlighted card. The
    // underlying answers stay in state.tellzeloAnswers so they're still
    // there if the user taps back into Other again later this session.
    state.scanContext = { ...state.tellzeloAnswers };
    state.scanWhoCard = 'other';
    updateTellZeloSummary();
    popScreen();
  }
}

function tellZeloBack() {
  if (state.tzStep > 0) {
    state.tzStep--;
    renderTellZeloStep();
  } else {
    popScreen();
  }
}

function updateTellZeloSummary() {
  const sub = document.getElementById('tellzelo-sub');
  if (sub) sub.textContent = tellzeloAnswersString() || 'Friends, situations or anything else';
  refreshScanWhoCards();
}

// Build a single context string for generation from the ACTIVE selection.
function scanContextString() {
  const order = ["who", "situation", "goal", "extra"];
  return order.map(k => state.scanContext[k]).filter(Boolean).join(" · ");
}

// Preview string built from the Other/tellzelo wizard's own saved answers —
// independent of state.scanContext so it still reflects prior progress even
// while Dating/Crush is the currently active selection.
function tellzeloAnswersString() {
  const order = ["who", "situation", "goal"];
  return order.map(k => state.tellzeloAnswers[k]).filter(Boolean).join(" · ");
}

// Get Suggestions stays fully pink/glowing at all times now — it's never
// visually disabled. Tapping it with no input still safely no-ops (see the
// early-return in generateReplies()), which now also shakes the input card
// instead of silently doing nothing. Kept as a no-op (rather than removing
// its several call sites) so nothing else breaks.
function checkGenerateReady() {}

// Trigger the hidden file input
function triggerUpload() {
  document.getElementById("screenshot-input").click();
}

function clearUploadedPhoto() {
  const input = document.getElementById("screenshot-input");
  if (input) input.value = "";
  handleUpload({ files: [] });
}

// Called when the user selects a file. Just shows the thumbnail — both on
// the dedicated upload page's dropzone and in place of the Upload Screenshot
// row on the main Scan page. No text extraction happens here; that's
// deferred to Analyze time (see _extractScreenshotConversation) and never shown.
function handleUpload(input) {
  const file       = input.files[0];
  const dropzone    = document.getElementById("scan-dropzone");
  const dzIcon      = document.getElementById("scan-dropzone-icon");
  const dzTitle     = document.getElementById("scan-dropzone-title");
  const dzSub       = document.getElementById("scan-dropzone-sub");
  const dzThumb     = document.getElementById("scan-dropzone-thumb");

  const clearBtn  = document.getElementById("scan-upload-clear-btn");
  const minusBtn  = document.getElementById("scan-photo-minus-btn");

  const uploadRow = document.getElementById("upload-row");
  const thumbWrap = document.getElementById("scan-thumb-preview");
  const thumbImg  = document.getElementById("scan-thumb-preview-img");
  const ocrErr    = document.getElementById("scan-ocr-error");

  if (file) {
    dropzone.classList.add("has-file");
    if (clearBtn) clearBtn.hidden = false;
    if (minusBtn) minusBtn.hidden = false;
    if (ocrErr)   ocrErr.hidden = true;

    const reader = new FileReader();
    reader.onload = () => {
      dzThumb.src    = reader.result;
      dzThumb.hidden = false;

      // Thumbnail replaces Upload Screenshot in the action row — the textarea
      // above stays empty and unchanged in either state.
      if (thumbImg)  thumbImg.src = reader.result;
      if (thumbWrap) thumbWrap.hidden = false;
      if (uploadRow) uploadRow.hidden = true;
    };
    reader.readAsDataURL(file);

    dzIcon.hidden  = true;
    dzTitle.hidden = true;
    dzSub.hidden   = true;

    // Auto-transfer: the instant a photo is linked on the dedicated Upload
    // page, jump straight back to Scan (the inline preview is already set via
    // the reader above) — no need to also tap "Done".
    if (state.activeScreen === 'scan-upload') popScreen();
  } else {
    dropzone.classList.remove("has-file");

    dzThumb.hidden = true;
    dzThumb.src    = "";
    dzIcon.hidden  = false;
    dzTitle.hidden = false;
    dzSub.hidden   = false;
    if (clearBtn) clearBtn.hidden = true;
    if (minusBtn) minusBtn.hidden = true;

    if (thumbWrap) thumbWrap.hidden = true;
    if (thumbImg)  thumbImg.src = "";
    if (uploadRow) uploadRow.hidden = false;
    if (ocrErr)    ocrErr.hidden = true;
  }

  checkGenerateReady();
}


// ================================================================
// SCREENSHOT READING — openai-proxy (GPT-5.4 mini vision) reads the full
// conversation visible in an attached screenshot at Analyze time, returning
// structured { sender: "her"|"me", text }[] for every bubble — not just the
// last line. The conversation is rendered as native bubbles (see
// _showResultConversation()); the last "her" message in it is what actually
// feeds the DeepSeek prompt, same role the single extracted line used to
// play. Text-only scans are untouched, still via deepseek-proxy.
// ================================================================

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Returns { messages, lastHerText }, or null on any failure (missing key,
// bad deploy, network error, empty result) — callers stop and show the
// generic error message when this returns null. Returns NO_MESSAGE_SENTINEL
// when the model explicitly found no real conversation in the image (as
// opposed to a technical failure) — callers show a different, friendlier
// message for that case.
const NO_MESSAGE_SENTINEL = "__NO_MESSAGE_FOUND__";

async function _extractScreenshotConversation(file) {
  try {
    const base64Data = await _fileToBase64(file);
    console.log("[Zelo OCR] extracting conversation at analyze time — base64 length:", base64Data.length, "mimeType:", file.type);
    if (!base64Data) return null;

    const { data, error } = await _aiInvoke('openai-proxy', {
      body: { image: base64Data, mimeType: file.type }
    }, 'ocr');

    if (error) {
      // supabase-js only puts a generic message on error.message for a
      // non-2xx response — the actual { error: "..." } body from
      // openai-proxy has to be read off error.context.
      let details = error.message;
      try {
        if (error.context && typeof error.context.clone === "function") {
          details = await error.context.clone().text();
        }
      } catch (_) { /* best-effort — fall back to error.message */ }
      console.error("[Zelo OCR] openai-proxy invoke error:", error, "— response body:", details);
      return null;
    }

    console.log("[Zelo OCR] openai-proxy response:", data);
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    if (!data?.found || !messages.length) return NO_MESSAGE_SENTINEL;

    // "The most recent message from the other person" — same semantic the
    // old single-line extraction used, just derived from the structured
    // list instead of asked of the model a second time. Falls back to the
    // conversation's last line if, unusually, every bubble was "me".
    const herMsgs = messages.filter(m => m.sender === 'her');
    const lastHerText = herMsgs.length ? herMsgs[herMsgs.length - 1].text : messages[messages.length - 1].text;

    return { messages, lastHerText };
  } catch (err) {
    console.error("[Zelo OCR] openai-proxy invoke threw:", err);
    return null;
  }
}

function _showScanOcrError(message) {
  const err = document.getElementById('scan-ocr-error');
  if (!err) return;
  err.textContent = message;
  err.hidden = false;
}


// ================================================================
// STYLE ELIGIBILITY
// Situation + Goal (never Who) select which styles are eligible, in
// priority order. STYLE_ELIGIBILITY (data.js) is the table; this is the
// only function that should read it, so the hard safety rule below is
// always enforced regardless of what the table says.
// ================================================================

// ================================================================
// DEMO SCAN OVERRIDE — fixed/scripted output for exactly one input string,
// for a repeatable screen-recording demo (see generateReplies()/
// _buildZeloRead() below for where these are consumed). Does not touch
// carousel/layout/swipe code at all — only short-circuits which text ends
// up in state.asstCurrentSet and state.eligibleStyles for this one input,
// same as a real scan would populate them.
// ================================================================
const DEMO_SCAN_TRIGGER = "how's your day going";
// TEMP — for review only, swap back to the previous warmer/longer/smooth
// set once this recording is done: see git history / earlier session notes.
const DEMO_SCAN_REPLIES = {
  direct:  "You caught my attention, honestly.",
  smooth:  "You looked like someone I'd regret not getting to know.",
  playful: "I could tell you, but I feel like you'd make me prove it."
};
// Order matters: renderReplyCarousel() centers on index 0 (also the one
// that gets the "Best Match" badge — see isBest in _cardHTML()) and clones
// the *last* style as the left-peek phantom card — so this exact order is
// what puts Smooth centered/Best Match, Playful peeking right (the real
// next card), and a Direct phantom peeking left (clone of the last real style).
const DEMO_SCAN_STYLES = ["smooth", "playful", "direct"];
const DEMO_ZELO_READ = "Casual question, but it's your chance to make the conversation more interesting.";

// Case/whitespace-insensitive, and normalizes curly quotes to straight —
// iOS auto-capitalizes the first letter and smart-punctuation can turn "'"
// into a curly apostrophe, either of which would otherwise silently miss
// the trigger on a real device.
function _isDemoScanTrigger(text) {
  return String(text || "").trim().toLowerCase().replace(/[‘’]/g, "'") === DEMO_SCAN_TRIGGER;
}

const SAFE_FALLBACK_STYLES        = ["direct", "shorter"];
// No Situation/Goal provided at all — gives a spread across the main axes
// (neutral, direct, shorter, longer) so there's something to swipe through
// even without filling in Tell Zelo More.
const NO_CONTEXT_DEFAULT_STYLES   = ["smooth", "direct", "shorter", "longer"];
const HEAVY_SITUATIONS            = new Set(["Argument", "Toxic Relationship"]);
const BANNED_STYLES_IN_HEAVY_SITS = new Set(["funny", "bolder"]);

function getEligibleStyles(situation, goal) {
  let styles;
  const tableEntry = situation && goal && STYLE_ELIGIBILITY[situation]
    ? STYLE_ELIGIBILITY[situation][goal]
    : null;

  if (tableEntry && tableEntry.length) {
    styles = tableEntry.slice();
  } else if (HEAVY_SITUATIONS.has(situation)) {
    // "not offered" cell (e.g. Argument + Be Funny) — safe fallback, never Funny/Bolder
    styles = SAFE_FALLBACK_STYLES.slice();
  } else {
    // No Situation/Goal selected at all, or an otherwise-unmapped combo
    styles = NO_CONTEXT_DEFAULT_STYLES.slice();
  }

  // Hard safety rule, enforced in code — not just by relying on the table
  // being correct. Funny and Bolder must never reach the user during an
  // Argument or Toxic Relationship, regardless of Goal.
  if (HEAVY_SITUATIONS.has(situation)) {
    styles = styles.filter(s => !BANNED_STYLES_IN_HEAVY_SITS.has(s));
    if (styles.length === 0) styles = SAFE_FALLBACK_STYLES.slice();
  }

  return styles;
}


// ================================================================
// ASSISTANT: DEEPSEEK API
// ================================================================

// Turns the structured Tell Zelo More selections into plain-language
// constraints the model is explicitly told to follow, rather than a bare
// unlabeled string it has to guess the meaning of.
function buildScanContextBlock() {
  const ctx = state.asstContextObj || {};
  const lines = [];
  if (ctx.who)       lines.push(`This message is from a ${ctx.who}.`);
  if (ctx.situation) lines.push(`The situation is: ${ctx.situation}.`);
  if (ctx.goal)       lines.push(`The user wants to: ${ctx.goal}.`);
  return lines.join(' ');
}

async function _fetchDeepSeekReply(style) {
  // DEV — see FORCE_SCAN_ERROR_CARD at the top of this file. Fails every
  // attempt (including the auto-retry, since it calls this same function),
  // so Scan naturally lands on the error/Retry card after the same ~700ms
  // beat a real failure would take.
  if (FORCE_SCAN_ERROR_CARD) throw new Error('Forced for review (FORCE_SCAN_ERROR_CARD)');

  const contextBlock = buildScanContextBlock();

  // DEV — confirms the tone actually varies per card/swipe. Remove once the
  // tone-routing report is resolved; see _fetchDeepSeekReply() call sites.
  console.log('[Zelo Tone]', style, '->', STYLE_LABELS[style]);

  let userPrompt = `Message I received: "${state.asstMessage}"\nTone: ${STYLE_LABELS[style]}`;
  if (contextBlock) userPrompt += `\nContext: ${contextBlock}`;

  const systemPrompt = contextBlock
    ? `You are Zelo, a witty and confident texting coach. Generate a reply to the message the user received. The user has told you who the message is from, what the situation is, and what they're trying to achieve — treat these as real constraints that must shape the reply's tone and content, not background flavor to ignore. A reply to an Ex during an Argument where the user wants to Fix Things should sound noticeably different from a reply to a Crush who is Flirting where the user wants to Be Funny. Keep it short, natural, and conversational — the way a real person texts. Do not use emojis unless the tone specifically calls for it.`
    : `You are Zelo, a witty and confident texting coach. Generate a reply to the message the user received. Keep it short, natural, and conversational — the way a real person texts. Do not use emojis unless the tone specifically calls for it.`;

  const { data, error } = await _aiInvoke('deepseek-proxy', {
    body: {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 150,
      temperature: 0.85
    }
  }, 'scan_reply');

  if (error) throw new Error(`DeepSeek proxy error: ${error.message}`);
  return data.choices[0].message.content.trim();
}


// ================================================================
// RANDOM-TEXT GUARD — dictionary-based gibberish detection.
// Flags messages that contain zero recognizable English words or slang.
// Loads a word dictionary (5000+ common words + texting slang) at startup
// for O(1) lookups. Fast, no API calls, catches everything from "sadawe"
// to "adijaoidj;a" while letting real short messages/slang through.
// ================================================================

let _gibDictionary       = new Set();
let _gibDictionaryLoaded = false;

async function _loadGibberishDictionary() {
  try {
    const response = await fetch('words-dict.txt?v=20260706d');
    // A missing file (404) used to be read as a dictionary full of HTML, so nearly
    // every real message counted as gibberish. Treat it as "not loaded" instead.
    if (!response.ok) throw new Error('words-dict.txt ' + response.status);
    const text = await response.text();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    _gibDictionary = new Set(words.map(w => w.toLowerCase()));
    console.log("[Gibberish Guard] Dictionary loaded:", _gibDictionary.size, "words");
  } catch (err) {
    console.warn("[Gibberish Guard] Failed to load dictionary:", err);
    // Fail open (see _looksLikeGibberish): with no real dictionary the check stays off
    // rather than flagging normal messages against a tiny stand-in list.
    _gibDictionaryLoaded = false;
    return;
  }
  _gibDictionaryLoaded = true;
}

// Strips common inflections (plurals, -ing, -ed) down to a root the
// dictionary might actually contain — "looking"/"looked"/"looks" all
// reduce toward "look", "friends" toward "friend". A hand-curated word
// list will never cover every inflected form, so this generalizes instead
// of requiring every variant to be added one at a time.
function _stemCandidates(word) {
  const candidates = [];
  if (word.length > 4 && word.endsWith("ies")) candidates.push(word.slice(0, -3) + "y");
  if (word.length > 3 && word.endsWith("es"))  candidates.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith("s"))   candidates.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith("ing")) {
    const stem = word.slice(0, -3);
    candidates.push(stem, stem + "e");
  }
  if (word.length > 4 && word.endsWith("ied")) candidates.push(word.slice(0, -3) + "y");
  if (word.length > 3 && word.endsWith("ed")) {
    const stem = word.slice(0, -2);
    candidates.push(stem, stem + "e");
  }
  return candidates;
}

// A word counts as recognized if it's in the dictionary as-is, OR if
// collapsing repeated letters makes it match one ("kkk" -> "k", "yess" ->
// "yes", "nooo" -> "no") — texting emphasis is extremely common and
// shouldn't read as gibberish — OR if a common inflection strips down to
// one (see _stemCandidates). The exact-match check always runs first, so
// real words that legitimately double a letter ("good", "book") or end in
// these letter patterns already pass before any fallback is considered.
function _isRecognizedWord(word) {
  if (_gibDictionary.has(word)) return true;

  const collapsed = word.replace(/(.)\1+/g, "$1");
  if (collapsed !== word && _gibDictionary.has(collapsed)) return true;

  return _stemCandidates(word).some(c => c !== word && _gibDictionary.has(c));
}

function _looksLikeGibberish(text) {
  // Fail open: if the dictionary hasn't loaded yet (e.g. Analyze pressed
  // right after page load, before the fetch resolves), don't flag anything
  // rather than flagging everything against an empty word list.
  if (!_gibDictionaryLoaded) return false;

  const clean = text.trim();
  if (clean.length === 0) return false;

  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
  const hasRealWord = words.some(word => {
    const cleaned = word.replace(/[^a-z']/g, "");
    return cleaned.length > 0 && _isRecognizedWord(cleaned);
  });

  return !hasRealWord;
}

let _gibResolve     = null;
let _gibCurrentText = "";

function _confirmGibberish(text) {
  _gibCurrentText = text;
  return new Promise(resolve => {
    _gibResolve = resolve;
    const askStep    = document.getElementById('gib-confirm-step-ask');
    const thanksStep = document.getElementById('gib-confirm-step-thanks');
    if (askStep)    askStep.hidden    = false;
    if (thanksStep) thanksStep.hidden = true;
    const overlay = document.getElementById('gib-confirm-overlay');
    if (overlay) overlay.hidden = false;
  });
}

function gibConfirmEdit() {
  const overlay = document.getElementById('gib-confirm-overlay');
  if (overlay) overlay.hidden = true;
  if (_gibResolve) { const r = _gibResolve; _gibResolve = null; r(false); }
}

function gibConfirmProceed() {
  const overlay = document.getElementById('gib-confirm-overlay');
  if (overlay) overlay.hidden = true;
  if (_gibResolve) { const r = _gibResolve; _gibResolve = null; r(true); }
}

// User says the flagged text was actually real — log it locally so it can
// be reviewed later to improve the dictionary, then apologize and let them
// continue straight through (no need to also tap "Analyze Anyway").
function gibReportFalsePositive() {
  try {
    const reports = JSON.parse(localStorage.getItem('zelo_gib_reports') || '[]');
    reports.push({ text: _gibCurrentText, time: Date.now() });
    localStorage.setItem('zelo_gib_reports', JSON.stringify(reports));
  } catch (_) { /* best effort — never block the user over a storage error */ }

  const askStep    = document.getElementById('gib-confirm-step-ask');
  const thanksStep = document.getElementById('gib-confirm-step-thanks');
  if (askStep)    askStep.hidden    = true;
  if (thanksStep) thanksStep.hidden = false;
}


// ================================================================
// ASSISTANT: GENERATE
// ================================================================

// Populates the "Her message" area on the result screen. Text mode → the
// editable text field shows the message. Screenshot mode → the screenshot ITSELF
// is shown (filling the box area); we deliberately do NOT surface the OCR text in
// the box — the extracted text lives only in state.asstMessage to feed reply
// generation ("ChatGPT already reads it"), it's not something the user re-reads.
function renderHerMessagePreview(text, conversationMessages) {
  const ta = document.getElementById("asst-preview-bubble"); // the <textarea>
  if (!ta) return;
  if (conversationMessages && conversationMessages.length) {
    ta.value = "";                     // screenshot mode: the rendered conversation is the message
    _showResultConversation(conversationMessages);
  } else {
    ta.value = text || "";             // text mode: reflect the message in the box
    _hideResultConversation();
    _renderZeloRead(text);             // fill the gap with a coaching read
    requestAnimationFrame(_fitHerMessageBubble);
  }
}

// Fresh scan, typed message: the editable bubble hugs its text (a one-word "hi"
// used to sit in a full-width box) instead of always stretching across the row.
// Empty → full width so the placeholder has room. Re-run on every keystroke and
// whenever the box (re)appears/resizes (see _watchHerMessageBox()).
function _fitHerMessageBubble() {
  const ta = document.getElementById("asst-preview-bubble");
  if (!ta || document.getElementById("screen-scan-result")?.classList.contains("is-replay")) return;
  const row = ta.parentElement;
  if (!row || !row.clientWidth) return;
  if (!ta.value) { ta.style.flex = ""; ta.style.width = ""; ta.style.height = ""; return; }
  const cs = getComputedStyle(ta);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avatar = row.querySelector(".yr-conv-avatar");
  const maxW = row.clientWidth - (avatar ? avatar.offsetWidth + 10 : 0);
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-break:break-word;` +
    `font:${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily};max-width:${maxW - padX}px;`;
  probe.textContent = ta.value + "\u200b";
  row.appendChild(probe);
  const w = Math.min(Math.ceil(probe.getBoundingClientRect().width) + padX + 2, maxW);
  probe.remove();
  ta.style.flex = "0 0 auto";
  if (ta.style.width !== w + "px") ta.style.width = w + "px";
  ta.style.height = "auto";
  const h = ta.scrollHeight + "px";
  if (ta.style.height !== h) ta.style.height = h;
}
let _herBoxObserver = null;
function _watchHerMessageBox() {
  const box = document.getElementById("yr-message-combined");
  if (!box || _herBoxObserver || typeof ResizeObserver === "undefined") return;
  // Deferred to the next frame: resizing the textarea inside the observer callback
  // changes the very box being observed, which raises the browser's "ResizeObserver
  // loop completed with undelivered notifications" error — and this app's global
  // error handler turns any window error into the crash screen.
  let queued = false;
  _herBoxObserver = new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; _fitHerMessageBubble(); });
  });
  _herBoxObserver.observe(box);
}

// Zelo's read — a short, human coaching take on HER message, shown in the gap
// below the box for text replies. Rule-based (instant, zero extra API cost): reads
// simple signals in the message + the user's Goal. Easy to swap for an AI-written
// read later. Hidden automatically in screenshot mode (the image fills the gap).
function _buildZeloRead(message, ctx) {
  const msg = (message || "").trim();
  if (!msg) return "Drop her message in and I'll tell you what she's really saying.";
  if (_isDemoScanTrigger(msg)) return DEMO_ZELO_READ;
  const low   = msg.toLowerCase();
  const words = low.split(/\s+/).filter(Boolean);
  const goal  = (ctx && ctx.goal ? String(ctx.goal) : "").toLowerCase();

  const emojiOnly     = !/[a-z0-9]/i.test(msg) && /\p{Extended_Pictographic}/u.test(msg);
  const oneWord       = words.length <= 1;
  const lowEffortWord = /^(k|kk|ok|okay|okok|sure|idk|idc|lol+|lmao+|ha(ha)+|hm+|meh|nvm|fine|yeah?|ya|yep|yup|nope?|no|maybe|cool)$/i.test(low.replace(/[.! ]/g, ""));
  const handsLead     = /(idk|i don'?t know|up to you|you decide|whatever( works)?|what do you (wanna|want to)|your call|you pick)/.test(low);
  const asksQuestion  = low.includes("?");
  const warm          = /(!|😊|😍|🥰|😄|😁|❤|💕|can'?t wait|excited|love|omg|haha)/.test(low) && !lowEffortWord;

  // move — a short nudge tied to the user's Goal (optional)
  let move = "";
  if      (/date|meet|hang|see you|link up/.test(goal))                          move = " Aim for a real plan — a day and place.";
  else if (/number|digits|snap|insta|contact/.test(goal))                        move = " Set up a smooth number swap.";
  else if (/reply|response|revive|ghost|quiet|restart|re-?engage|reconnect/.test(goal)) move = " Keep it easy to reply to.";
  else if (/flirt|tension|spark|attract|interest/.test(goal))                    move = " Add a little playful tension.";

  let read;
  if      (handsLead)                read = "She's handing you the wheel — take the lead and be specific.";
  else if (emojiOnly)               read = "Just an emoji — engaged, but giving you nothing to grab. You steer.";
  else if (lowEffortWord || oneWord) read = "Low-effort reply — she wants to see if you'll bring the energy.";
  else if (asksQuestion)            read = "She's curious and leaning in — answer with a hook, then turn it back.";
  else if (warm)                    read = "She's warm and into it — match her energy and move a step forward.";
  else                              read = "She's keeping it open — add spark and give her a thread to grab.";

  return read + move;
}

function _renderZeloRead(message) {
  const el = document.getElementById("yr-zelo-read-text");
  if (el) el.textContent = _buildZeloRead(message, state.scanContext);
}

// Same generic filled person-silhouette used for every "her" bubble's
// avatar — one shared glyph rather than a per-avatar image, so it never
// depends on a real profile photo (there isn't one for an OCR'd screenshot).
const YR_CONV_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8"/></svg>';

// Shared bubble-row markup — her messages left-aligned with an avatar, the
// user's own right-aligned with none (see .yr-conv in style.css, colors
// sampled directly from assets/icons/reply-styles/Her messages, box.png).
// Used both for the result screen's own parsed-conversation box AND the
// "Save this scan?" sheet's smaller preview of the same conversation.
function _convRowsHTML(messages) {
  return messages.map(m => {
    const isMe = m.sender === 'me';
    const avatar = isMe ? '' : `<span class="yr-conv-avatar" aria-hidden="true">${YR_CONV_AVATAR_SVG}</span>`;
    // A replied-to message shows its quote here too, or the replay reads as
    // a flat back-and-forth and loses which message was being answered.
    const q = m.replyTo
      ? `<span class="yr-conv-quote">${_escapeHtml(m.replyTo.length > 60 ? m.replyTo.slice(0, 60) + '…' : m.replyTo)}</span>`
      : '';
    return `<div class="yr-conv-row yr-conv-row--${isMe ? 'me' : 'her'}">${avatar}<span class="yr-conv-bubble yr-conv-bubble--${isMe ? 'me' : 'her'}">${q}${_escapeHtml(m.text)}</span></div>`;
  }).join('');
}

function _showResultConversation(messages) {
  const box = document.getElementById("yr-conv");
  if (box) {
    box.innerHTML = _convRowsHTML(messages);
    // .yr-conv is height-capped (see style.css) for a long conversation —
    // land scrolled to the bottom so the most recent messages (the ones
    // that actually matter for the reply) are what's visible by default;
    // scrolling up reveals earlier ones. Next frame, since the browser
    // needs to have laid out the new content before scrollHeight is real.
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }
  document.getElementById("yr-preview-block")?.classList.add("has-shot");
}
function _hideResultConversation() {
  const box = document.getElementById("yr-conv");
  if (box) box.innerHTML = "";
  document.getElementById("yr-preview-block")?.classList.remove("has-shot", "has-added");
}

// Brief placeholder shown the instant a screenshot is picked, while OCR
// reads the full conversation in the background — there's no raw image to
// show any more (that's the whole point), so this fills the gap instead of
// the box just looking empty/broken for that beat.
function _showResultConversationLoading() {
  const box = document.getElementById("yr-conv");
  if (box) box.innerHTML = '<p class="yr-conv-loading">Reading the conversation…</p>';
  document.getElementById("yr-preview-block")?.classList.add("has-shot");
}

// --- Result-screen combined-input handlers -----------------------------
// Text the user had typed before attaching a screenshot. Restored verbatim if
// the OCR fails or the screenshot is removed — the fix for the wrong-text bug
// (previously it fell back to the STALE state.asstMessage from a prior scan).
let _typedBeforeShot = "";

// Typed text: commit (regenerate) on blur only, so we don't fire a request on
// every keystroke — matches "feeds reply generation as if typed."
function onResultMessageInput() { /* commit happens on blur; the bubble just re-fits live */ _fitHerMessageBubble(); }

function onResultMessageCommit() {
  const ta = document.getElementById("asst-preview-bubble");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text || text === (state.asstMessage || "")) return; // unchanged — no-op
  state.asstConversationMessages = null; // typed text is always a single message, not a parsed conversation
  _regenerateFromResultInput(text);
}

function triggerResultUpload() {
  document.getElementById("result-screenshot-input")?.click();
}

// Tapping the avatar icon (only — see index.html's comment on why this moved
// off the whole box) opens the file picker to attach a screenshot instead.
function onMessageBoxTap() {
  triggerResultUpload();
}

// Screenshot chosen: show a lightweight loading placeholder (below the box)
// immediately, then reuse the EXISTING OCR pipeline
// (_extractScreenshotConversation → openai-proxy) and render the parsed
// conversation as native bubbles once it resolves, feeding the last message
// from her into generation exactly as typed text would.
async function onResultScreenshot(input) {
  const file = input.files?.[0];
  if (!file) return;

  const ta = document.getElementById("asst-preview-bubble");
  _typedBeforeShot = ta ? ta.value : "";   // remember typed text to restore on failure

  _showResultConversationLoading();

  const extracted = await _extractScreenshotConversation(file);
  // Requested: log the RAW OCR result before it's rendered, so a wrong/garbled
  // extraction is debuggable if it recurs.
  console.log("[Zelo OCR] result-box raw extracted conversation (before rendering):", JSON.stringify(extracted));

  if (extracted && extracted !== NO_MESSAGE_SENTINEL) {
    // Do NOT write anything into the text box — the rendered conversation
    // stays shown as the message. Only the derived last-her-message text
    // feeds generation (state.asstMessage).
    if (ta) ta.value = "";
    state.asstConversationMessages = extracted.messages;
    _showResultConversation(extracted.messages);
    _regenerateFromResultInput(extracted.lastHerText);
  } else {
    // OCR failed / no message — restore the user's OWN typed text (never the
    // stale previous-scan message) and drop the unreadable screenshot.
    if (ta) ta.value = _typedBeforeShot;
    input.value = "";
    state.asstConversationMessages = null;
    _hideResultConversation();
  }
}

// Re-runs reply generation in place (no navigation, no full loading screen —
// the box/thumbnail stay visible) with a new message. Reuses the same carousel
// + fetch path as generateReplies(); only the trigger differs. Does not
// re-decrement the daily scan count — this refines the current scan.
function _regenerateFromResultInput(messageText) {
  if (!messageText) return;
  state.asstMessage    = messageText;
  _renderZeloRead(messageText);        // keep the read in sync with edited text
  state.asstContext    = scanContextString();
  state.asstContextObj = { ...state.scanContext };
  state.asstCurrentSet = {};

  state.eligibleStyles    = getEligibleStyles(state.scanContext.situation, state.scanContext.goal);
  state.currentStyleIndex = 0;
  state.asstStyle         = state.eligibleStyles[0];
  renderReplyCarousel();

  const firstStyle = state.asstStyle;
  _fetchDeepSeekReply(firstStyle)
    .catch(() => "Couldn't reach Zelo right now. Try again.")
    .then(reply => {
      state.asstCurrentSet[firstStyle] = reply;
      _saveGeneratedReply(firstStyle, reply);
      _renderCardText(firstStyle);
      _centerCarouselOnCurrent();
      _prefetchNextStyle();
    });
}

// Briefly shakes the input card — signals "add something first" when Get
// Suggestions is tapped with no text and no screenshot. Re-triggerable: the
// class is removed after the animation so a second empty tap shakes again.
function shakeInputCard() {
  const card = document.querySelector('.input-card');
  if (!card) return;
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation if it's already mid-shake
  card.classList.add('shake');
  navigator.vibrate?.(15);
  setTimeout(() => card.classList.remove('shake'), 400);
}

let _lastScanSource = null;

// Server-side record of an AI suggestion (generated_replies): output + tone + input
// SOURCE only, never the input itself. Only fresh scans — demo scans and saved-scan
// replays (original source unknown) are not saved. The "couldn't reach Zelo" fallback
// text is not a suggestion, so it is skipped too.
const REPLY_FETCH_FAILED_TEXT = "Couldn't reach Zelo right now. Try again.";
function _saveGeneratedReply(style, reply) {
  if (!reply || reply === REPLY_FETCH_FAILED_TEXT) return;
  if (!state.asstInputSource) { ZeloRecords.status('reply not saved: demo/replay'); return; }
  const id = ZeloRecords.saveGeneratedReply({ source: state.asstInputSource, tone: style, text: reply });
  if (id) (state.asstReplyIds = state.asstReplyIds || {})[style] = id;
}
async function generateReplies() {
  if (!subscriptionGate()) return; // locked: paywall, and no API call / scan credit spent
  const userInput = document.getElementById("asst-input").value.trim();
  const context   = scanContextString();
  const screenshotFile = document.getElementById("screenshot-input").files?.[0] || null;
  const hasImage  = !!screenshotFile;

  if (!userInput && !hasImage) { shakeInputCard(); return; }

  // Fixed demo input (DEMO_SCAN_TRIGGER, above) bypasses the scan limit and
  // gibberish check too — it needs to be re-runnable an unlimited number of
  // times across takes, not gated by the same limits a real scan is.
  // FORCE_DEMO_SCAN_FOR_RECORDING (top of file) makes ANY input take this
  // same fixed path — no need to type the exact trigger phrase on camera.
  const isDemoScan = FORCE_DEMO_SCAN_FOR_RECORDING || _isDemoScanTrigger(userInput);

  // FORCE_SCAN_ERROR_CARD also bypasses the limit — it's for previewing the
  // error/Retry card on demand, which is useless if it silently no-ops the
  // instant the day's real scan count (easy to burn through while testing)
  // hits zero. This is almost certainly why "reply cards didn't show
  // anything" happened — not a bug in the error-card code itself, just this
  // gate returning before ever reaching it.
  if (!isDemoScan && !FORCE_SCAN_ERROR_CARD && !isPaidUser() && scansRemainingToday() <= 0) {
    refreshScanLimitBanner();
    return;
  }

  // Instant, local check — flags genuine keyboard mashing before anything
  // else happens. No API call, so normal messages pay zero extra delay.
  // Temporarily suppressed (SUPPRESS_GIBBERISH_CHECK, top of file) for
  // screen recording — flip back to false when done, nothing else here
  // changed.
  if (!isDemoScan && !SUPPRESS_GIBBERISH_CHECK && userInput && _looksLikeGibberish(userInput)) {
    const proceed = await _confirmGibberish(userInput);
    if (!proceed) return; // user chose to edit — nothing consumed, no navigation
  }

  state.scanSavedToThread = false;
  state.scanSkippedSave   = false;

  // Analytics: source only ("text"/"screenshot") — never the content. Demo
  // (screen-recording) scans aren't real usage.
  _lastScanSource = isDemoScan ? null : (hasImage ? 'screenshot' : 'text');
  state.asstInputSource = _lastScanSource; // null for demo scans
  state.asstReplyIds = {};
  if (_lastScanSource) ZeloAnalytics.track('scan_started', { source: _lastScanSource });

  // Navigate to the loading screen immediately — the silent OCR step (when
  // needed) and the DeepSeek call both run while "Zelo is thinking…" is
  // already on screen, so Analyze never looks like it's frozen/done nothing.
  const loading = document.getElementById("scan-result-loading");
  const content = document.getElementById("scan-result-content");
  loading.hidden = false;
  content.hidden = true;
  const historyBtn = document.getElementById('scan-result-history-btn');
  if (historyBtn) historyBtn.hidden = false;
  document.getElementById('screen-scan-result')?.classList.remove('is-replay');
  state.replayBestStyle = null;
  state.replayThreadId  = null;
  _resetReplayAdd(); // same Her/You add-message composer as a replay — reset it fresh here too
  pushScreen("scan-result");
  _showScanGen(hasImage && !userInput);

  // Typed message always wins. Only when there's no typed text do we fall
  // back to the attached screenshot, read silently in the background via
  // openai-proxy — the full conversation it returns is never shown raw,
  // just rendered as native bubbles (see renderHerMessagePreview()) and its
  // last "her" message used as the DeepSeek prompt below. This whole branch
  // runs behind the "Zelo is thinking…" loading screen (already pushed
  // above), so there's no bare/empty moment to fill here the way the
  // result-screen's own re-upload path needs a loading placeholder for.
  let messageText = userInput;
  let conversationMessages = null;
  if (!messageText && hasImage) {
    const err = document.getElementById('scan-ocr-error');
    if (err) err.hidden = true;

    const extracted = await _extractScreenshotConversation(screenshotFile);
    if (extracted === NO_MESSAGE_SENTINEL) {
      _hideScanGen(false);
      popScreen(); // back to Scan — nothing was generated, no scan consumed
      _showScanOcrError("Hmm, I don't think I caught a real message in that screenshot. Try a clearer one, or paste the message instead.");
      return;
    }
    if (extracted == null) {
      _hideScanGen(false);
      popScreen();
      _showScanOcrError("Couldn't read the screenshot. Try pasting the message instead.");
      return;
    }
    messageText = extracted.lastHerText;
    conversationMessages = extracted.messages;
  }

  state.asstConversationMessages = conversationMessages;
  renderHerMessagePreview(messageText, conversationMessages);

  if (isDemoScan) {
    // Fixed, scripted output for a repeatable screen-recording demo — see
    // DEMO_SCAN_TRIGGER/DEMO_SCAN_REPLIES/DEMO_SCAN_STYLES above. Deliberately
    // skips recordScan()/decrementScanCount() so re-running it across takes
    // never eats into the real scan limit. Everything else downstream
    // (carousel rendering, centering, prefetch) is the exact same code a
    // real scan uses — only the reply text and eligible-styles source differ.
    state.asstCurrentSet    = { ...DEMO_SCAN_REPLIES };
    state.asstMessage       = messageText;
    state.asstContext       = context;
    state.asstContextObj    = { ...state.scanContext };
    state.eligibleStyles    = DEMO_SCAN_STYLES.slice();
    state.currentStyleIndex = 0;
    state.asstStyle         = state.eligibleStyles[0];

    renderReplyCarousel();

    const firstStyle = state.asstStyle;
    setTimeout(() => {
      _hideScanGen(true);
      _renderCardText(firstStyle);
      loading.hidden = true;
      content.hidden = false;
      _centerCarouselOnCurrent();
      _onReplyRevealed();
      _prefetchNextStyle();
      _armAddTogglePill(); // content was hidden (0 layout) at _resetReplayAdd()'s own call — size it now that it's real
    }, 1000); // fixed ~1s delay — same "Zelo is thinking…" beat every take, deterministic for recording
    return;
  }

  recordScan();
  decrementScanCount();

  // Snapshot message + context for this scan — used by per-style API calls
  state.asstCurrentSet = {};  // cache: style → reply text, filled on demand
  state.asstMessage    = messageText;
  state.asstContext    = context;
  state.asstContextObj = { ...state.scanContext };  // structured who/situation/goal, for prompt building

  // Situation + Goal (never Who) decide which styles are eligible, in
  // priority order. Every eligible style gets a real card shell in the
  // carousel immediately (renderReplyCarousel(), below) so native scroll-
  // snap has real neighbors to show — but only the current style + one
  // card ahead are ever fetched (_ensureStyleFetched()/_prefetchNextStyle()),
  // never all of them upfront. Cards without a fetch yet show a loading dot.
  state.eligibleStyles   = getEligibleStyles(state.scanContext.situation, state.scanContext.goal);
  state.currentStyleIndex = 0;
  state.asstStyle         = state.eligibleStyles[0];

  renderReplyCarousel();

  const firstStyle = state.asstStyle;
  state.asstFailedStyles.delete(firstStyle);
  _fetchDeepSeekReplyWithRetry(firstStyle)
    .then(reply => { state.asstCurrentSet[firstStyle] = reply; _saveGeneratedReply(firstStyle, reply); })
    .catch(() => { state.asstFailedStyles.add(firstStyle); })
    .then(() => {
      _hideScanGen(true);
      _renderCardText(firstStyle);
      loading.hidden = true;
      content.hidden = false;
      _centerCarouselOnCurrent(); // only now is the carousel actually laid out and measurable
      _onReplyRevealed();
      _prefetchNextStyle();
      _armAddTogglePill(); // content was hidden (0 layout) at _resetReplayAdd()'s own call — size it now that it's real
    });
}

// ---- "Writing your replies" card over the dimmed Scan page ------------------
// pushScreen('scan-result') has already run (it owns all the state), but the page is
// held invisible (.scan-result--pending) while the Scan tab is put back on screen
// under the card, so what you see is the Scan page dimmed. _hideScanGen(true)
// reveals the result page (it fades in via .screen's own opacity transition);
// _hideScanGen(false) is for the error paths, which popScreen() right after.
let _scanGenTimer = null;
function _showScanGen(fromScreenshot) {
  const el = document.getElementById('scan-gen');
  if (!el) return;
  const screen = document.getElementById('screen-scan-result');
  screen && screen.classList.add('scan-result--pending');
  document.getElementById('tab-assistant')?.classList.add('active');
  document.getElementById('tab-bar')?.classList.remove('hidden');
  const lines = fromScreenshot
    ? ['Reading your screenshot', 'Finding the conversation', 'Picking the right tone', 'Polishing the wording']
    : ['Reading her message', 'Picking the right tone', 'Polishing the wording'];
  const sub = document.getElementById('scan-gen-sub');
  let i = 0;
  if (sub) { sub.textContent = lines[0]; sub.classList.remove('scan-gen-sub--swap'); }
  clearInterval(_scanGenTimer);
  _scanGenTimer = setInterval(() => {
    i = (i + 1) % lines.length;
    if (!sub) return;
    sub.classList.add('scan-gen-sub--swap');
    setTimeout(() => { sub.textContent = lines[i]; sub.classList.remove('scan-gen-sub--swap'); }, 160);
  }, 1700);
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('scan-gen--in');
}
function _hideScanGen(revealResult) {
  clearInterval(_scanGenTimer); _scanGenTimer = null;
  const el = document.getElementById('scan-gen');
  const screen = document.getElementById('screen-scan-result');
  if (revealResult) {
    // The result page is the active screen: take the Scan tab and tab bar back out.
    document.getElementById('tab-assistant')?.classList.remove('active');
    document.getElementById('tab-bar')?.classList.add('hidden');
  }
  screen && screen.classList.remove('scan-result--pending');
  if (!el || el.hidden) return;
  el.classList.remove('scan-gen--in');
  setTimeout(() => { if (!el.classList.contains('scan-gen--in')) el.hidden = true; }, 220);
}

// Runs once per scan after the first reply is revealed.
function _onReplyRevealed() {
  if (_lastScanSource) { ZeloAnalytics.track('scan_completed', { source: _lastScanSource }); _lastScanSource = null; }
  // Fix 5: the Other/tellzelo wizard's own saved answers only reset once a
  // scan actually completes — not on every Dating/Crush/Other switch.
  state.tellzeloAnswers = {};
  updateTellZeloSummary();

  // If a thread was pre-selected on the typing screen, auto-save now and
  // show a brief confirmation toast (the only remaining use of thread-save-prompt).
  if (state.preselectThreadId) {
    const preMsg   = state.asstMessage;
    const preReply = _currentReplyText();
    const allThr   = getThreads();
    const preThr   = allThr.find(t => t.id === state.preselectThreadId);
    if (preThr) {
      preThr.scans.push({ id: 'scan_' + Date.now(), message: preMsg, reply: preReply, time: Date.now() });
      saveThreads(allThr);
      renderThreadList();
      state.scanSavedToThread = true;
      const tsp = document.getElementById('thread-save-prompt');
      if (tsp) {
        tsp.innerHTML = `<p class="thread-save-q thread-save-success">Saved to "${preThr.name}" ✓</p>`;
        tsp.hidden = false;
        setTimeout(() => { tsp.hidden = true; }, 1500);
      }
    }
    state.preselectThreadId = null;
  }
}


// ================================================================
// ASSISTANT: REPLY CAROUSEL
// Native horizontal scroll-snap carousel (Apple Wallet / App Store Today
// pattern) — every eligible style gets a real .yr-card sibling, centered
// one at a time via CSS scroll-snap-align, with true neighbor cards
// peeking in on both sides rather than a synthetic peek element. Only the
// centered style + one card ahead are ever fetched; see
// _ensureStyleFetched()/_prefetchNextStyle().
// ================================================================

function _currentReplyText() {
  return (state.asstCurrentSet && state.asstCurrentSet[state.asstStyle]) || "";
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Auto-generated short title from a message — used both for a newly-saved
// scan's thread name (History) and an AI Coach chat's title (see
// _persistAiCoachChat()). Kept to 3-7 words per the spec; a message that's
// already that short is used verbatim (this is deliberately NOT an LLM
// call — it's meant to read as "the actual first question", not a
// paraphrase, and costs nothing to run on every save).
function _autoShortTitle(text) {
  const trimmed = (text || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const words = trimmed.split(' ');
  if (words.length <= 7) return trimmed;
  return words.slice(0, 7).join(' ') + '…';
}

// ================================================================
// AI COACH CHAT CLASSIFICATION — 4 icon categories + the small pill's
// specific-action label, both derived once from the first real user
// message in a coach chat and then fixed for good (see
// _persistAiCoachChat()) — never re-evaluated as the conversation
// continues, per spec.
// ================================================================
const AICOACH_TOPIC_ICONS = {
  reply:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  interest: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  flirty:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.2 3-2.7 4.2-2.7 7.8a2.7 2.7 0 0 0 5.4 0c0-.6-.3-1.2-.6-1.6 1.8 1 2.9 2.8 2.9 4.9a4.9 4.9 0 0 1-9.8 0c0-4 3.2-6.6 4.8-11.1z"/></svg>',
  advice:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg>',
};
const AICOACH_TOPIC_COLORS = {
  reply:    { bg: '#eef2ff', accent: '#4488f6' },
  interest: { bg: '#fce3ee', accent: '#ec4899' },
  flirty:   { bg: '#fff1e9', accent: '#fe8e36' },
  advice:   { bg: '#f9f6fd', accent: '#885cea' },
};
// Real per-topic gem icon (assets/icons/aicoach-topics/{topic}.png, cropped
// pixel-for-pixel from the user's own reference) swapped in over the drawn
// AICOACH_TOPIC_ICONS SVG — same load/error technique used everywhere else
// a real icon image can replace a placeholder (.yr-card-illustration etc).
function _aiCoachTopicIconHTML(topic) {
  const svg = AICOACH_TOPIC_ICONS[topic] || AICOACH_TOPIC_ICONS.advice;
  return `<img class="aicoach-topic-icon-img" src="assets/icons/aicoach-topics/${topic}.png" alt=""
             onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">
           <span class="aicoach-topic-icon-svg">${svg}</span>`;
}

// AI Coach's own generic/brand icon — every plain "this is Zelo/AI Coach"
// spot (the chat avatar, suggestion-card icons, the promo card on the Scan
// page) now uses the same pink gem as the "interest" topic icon instead of
// the old sparkle SVG, per direct request ("I don't want to see the star
// icon anymore"). Fills its host span completely (same has-img toggle as
// _aiCoachTopicIconHTML, and its CSS clears that host's own colored-circle
// background once loaded) rather than floating as a small fixed-size icon
// inside one — the gem crop already has its own circular backdrop baked
// in, so a smaller icon inside another colored circle just doubled up as
// a visible ring around it ("a small circle around the gems").
function _aiCoachBrandIconHTML() {
  return `<img class="aicoach-brand-icon-img" src="assets/icons/aicoach-topics/mascot-brand.png" alt=""
             onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">
           <span class="aicoach-brand-icon-svg">${AICOACH_TOPIC_ICONS.interest}</span>`;
}
// FINALIZED — do not keep re-tuning this on a hunch; if a real message
// still lands in the wrong bucket, add its exact keyword to the matching
// regex below rather than redesigning the whole thing. Checked in this
// exact order, first match wins:
//
//   1. flirty   — wants a flirty/spicy/teasing line, or to "rizz" someone
//                 up. (flirt, rizz, spicy, tease, seduce, steamy, sexy)
//   2. interest — asking whether the OTHER PERSON is into them, or to
//                 read her signals — about HER feelings, not what to say
//                 back. ("does she like me", "is she interested", "what's
//                 the vibe", "did I mess it up", "read the signs")
//   3. reply    — asking to be handed the actual words to send — a
//                 request for generated text, not general strategy.
//                 ("what should I say/write/send/text", "help me reply",
//                 "rewrite this", "make this sound better", "text her
//                 back")
//   4. advice   — everything else. The default, catch-all bucket for
//                 general dating strategy/relationship questions that
//                 aren't asking for exact wording or reading her interest
//                 — "should I keep talking to her", "is this a red flag",
//                 "what do I do here". Most ad-hoc questions land here on
//                 purpose — that's why purple "Situation advice" is the
//                 most common pill, not a bug.
function _classifyCoachTopic(text) {
  const low = (text || '').toLowerCase();
  if (/flirt|rizz|spicy|tease|seduc|steamy|sexy/.test(low)) return 'flirty';
  if (/does (she|he).{0,20}like|is (she|he) interested|(she|he)('s| is) into (me|you)|into (me|him|her)\b|likes? me\b|feelings? for me|read (into|the signs)|what'?s the vibe|mess(ed)? (it |things )?up|sign(s)? (she|he)/.test(low)) return 'interest';
  if (/what should i (say|write|send|text|reply)|help me (reply|respond|write|text)|repl(y|ies) to|rewrite (this|my|it)|sound better|text (her|him) back|write (back|something)|say back/.test(low)) return 'reply';
  return 'advice';
}
function _coachPillLabel(topic, text) {
  if (topic === 'reply') {
    const low = (text || '').toLowerCase();
    const styleHit = Object.keys(STYLE_LABELS).find(k => low.includes(k));
    if (styleHit) return STYLE_LABELS[styleHit] + ' reply';
    return 'Reply help';
  }
  if (topic === 'interest') return 'Interest analysis';
  if (topic === 'flirty')   return 'Flirty reply';
  return 'Situation advice';
}

// Small flat line-icon per style, matching the app's existing outline-icon
// language rather than introducing a clashing illustration style.
function _styleIconSvg(style) {
  const icons = {
    smooth:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><path d="M21 12c0 4.97-4.03 9-9 9-1.5 0-2.9-.37-4.14-1.02L3 21l1.02-3.86A8.96 8.96 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/></svg>',
    funny:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    bolder:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    direct:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    warmer:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    shorter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>',
    longer:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>',
    // No cropped asset for this demo-only style (see STYLE_LABELS) — a wink,
    // to read distinctly from funny's plain smiley.
    playful: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M7.3 9.5c.6-.6 1.8-.6 2.4 0"/></svg>'
  };
  return icons[style] || icons.smooth;
}

// Per-style icon image assets live in assets/icons/{style}.{ICON_EXT}. Each
// card tries to load its image and falls back to the drawn SVG below if the
// file is missing — so a partial icon set never breaks the card. Change
// ICON_EXT here in one place if the delivered files use a different format.
const ICON_EXT = 'png';

const _CARD_SPARK_SVG  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg>';
const _CARD_QUOTE_SVG  = '<svg viewBox="0 0 32 24" fill="currentColor"><path d="M0 12c0-6 4-10 9-11l1 3c-3 1-5 3-5 6h5v9H0z"/><path d="M16 12c0-6 4-10 9-11l1 3c-3 1-5 3-5 6h5v9h-10z"/></svg>';

// Literal per-spec theme for "smooth" — the pink card the design spec gives
// exact hex values for (border/badge/quote/iconBg — all accent colors, so
// they stay fixed in dark mode same as everywhere else). Other styles
// don't have spec'd colors, so they reuse their existing STYLE_COLORS
// accent (unchanged from the old pill/peek system) tinted into the same
// border+badge treatment. gradTop/gradBottom are the one background piece
// here, so — unlike the rest of this theme — they're computed against
// var(--s1) rather than a literal hex, so the card's own surface still
// goes dark while its accent tint stays exactly the same percentage mix.
const CARD_THEME_SMOOTH = {
  border: "#F56BAE",
  badge: "#F14E9B",
  quote: "#F14A95",
  iconBg: "#F14E9B"
};

function _cardThemeFor(style) {
  const isSmooth = style === "smooth";
  const accent = isSmooth ? CARD_THEME_SMOOTH.badge : (STYLE_COLORS[style] || STYLE_COLORS.smooth).accent;
  const base = isSmooth ? CARD_THEME_SMOOTH : { border: accent, badge: accent, quote: accent, iconBg: accent };
  return {
    ...base,
    gradTop: `color-mix(in srgb, ${accent} 4%, var(--s1))`,
    gradBottom: `color-mix(in srgb, ${accent} 8%, var(--s1))`,
  };
}

// realIndex is this style's position in state.eligibleStyles. phantom cards
// are extra clones — see renderReplyCarousel() — that make the carousel
// loop: a phantom of the last style sits before the first real card, and a
// phantom of the first style sits after the last, so the first/best-match
// card always has a real-looking neighbor to peek at on both sides instead
// of a blank edge.
function _cardHTML(style, realIndex, phantom) {
  const theme  = _cardThemeFor(style);
  const isBest = (state.replayBestStyle || state.eligibleStyles[0]) === style;
  const indexAttr = phantom ? `data-phantom="true"` : `data-index="${realIndex}"`;
  return `
    <div class="yr-card" data-style="${style}" ${indexAttr} ${phantom ? 'aria-hidden="true"' : ""}
         style="background:linear-gradient(180deg, ${theme.gradTop}, ${theme.gradBottom}); border-color:color-mix(in srgb, ${theme.border} 70%, transparent);">
      <div class="yr-card-top">
        <div class="yr-card-badges">
          <span class="yr-card-badge" style="color:${theme.badge}">${STYLE_LABELS[style] || ""}</span>
          ${isBest ? `<span class="yr-best-match">Best Match</span>` : ""}
        </div>
        <span class="yr-card-spark" aria-hidden="true">${_CARD_SPARK_SVG}</span>
      </div>
      <div class="yr-card-illustration" style="background:${theme.iconBg}">
        <img class="yr-card-illustration-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt="" draggable="false"
             onload="this.closest('.yr-card-illustration').classList.add('has-img')"
             onerror="this.remove()">
        <span class="yr-card-illustration-svg">${_styleIconSvg(style)}</span>
      </div>
      <span class="yr-card-quote" style="color:${theme.quote}">${_CARD_QUOTE_SVG}</span>
      <p class="yr-card-text" hidden></p>
      <div class="yr-card-loading" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="yr-card-error" hidden>
        <p class="yr-card-error-text">Couldn't reach Zelo. Check your connection.</p>
        <button type="button" class="yr-card-error-retry" onclick="_retryStyleFetch('${style}')">Retry</button>
      </div>
      <button class="yr-card-btn" onclick="copyReplyFromCard('${style}', this)">Use this reply</button>
    </div>`;
}

// Builds every eligible style's card shell up front (so scroll-snap has
// real neighbors), plus — when there's more than one style — a phantom
// clone of the last style before the first card and of the first style
// after the last, so the carousel loops and both peeks always have real
// content. Then paints whichever cards already have cached text. Doesn't
// position the scroll here — #scan-result-content is still hidden at this
// point (see generateReplies()), so offsetLeft/clientWidth would all read
// 0; call _centerCarouselOnCurrent() once the screen is actually visible.
function renderReplyCarousel() {
  const track = document.getElementById("reply-carousel");
  if (!track) return;
  const styles = state.eligibleStyles;
  const n = styles.length;
  const loop = n > 1;

  const parts = [];
  if (loop) parts.push(_cardHTML(styles[n - 1], n - 1, true));
  styles.forEach((style, i) => parts.push(_cardHTML(style, i, false)));
  if (loop) parts.push(_cardHTML(styles[0], 0, true));
  track.innerHTML = parts.join("");

  styles.forEach(style => _renderCardText(style));
  _renderDots();
  _updateSwipeHintVisibility();
  _wireCarousel(track);
}

// Snaps the track to whichever card matches state.currentStyleIndex, with
// no animation — used right after the screen becomes visible (real layout
// now exists to measure) and after a manual goToStyleIndex jump.
function _centerCarouselOnCurrent() {
  const track = document.getElementById("reply-carousel");
  const card  = track?.querySelector(`.yr-card[data-index="${state.currentStyleIndex}"]`);
  if (!track || !card) return;
  track.scrollLeft = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
  _updateCenterCardClass(track);
}

// Paints (or re-paints) every DOM node for this style — the real card and,
// if it's currently cloned at either loop boundary, its phantom too —
// from cache. Called after every fetch resolves, and once per style at
// initial render.
function _renderCardText(style) {
  const text   = state.asstCurrentSet[style];
  const failed = state.asstFailedStyles.has(style);
  document.querySelectorAll(`.yr-card[data-style="${style}"]`).forEach(card => {
    const textEl    = card.querySelector(".yr-card-text");
    const loadingEl = card.querySelector(".yr-card-loading");
    const errorEl   = card.querySelector(".yr-card-error");
    if (!textEl) return;
    if (failed) {
      textEl.hidden = true;
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = false;
    } else if (text) {
      textEl.textContent = text; // .textContent, not innerHTML — no escaping needed, no injection risk
      textEl.hidden = false;
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
    } else {
      textEl.hidden = true;
      if (loadingEl) loadingEl.hidden = false;
      if (errorEl) errorEl.hidden = true;
    }
  });
}

// The active dot starts at the MIDDLE position (like the reference) and
// moves relative to it — the carousel loops, so position is relative, not
// absolute: dot position = (style index + half the count) mod count.
function _renderDots() {
  const dotsEl = document.getElementById("reply-dots");
  if (!dotsEl || !state.eligibleStyles) return;
  const n = state.eligibleStyles.length;
  if (n <= 1) { dotsEl.innerHTML = ""; return; }
  const activePos = (state.currentStyleIndex + Math.floor(n / 2)) % n;
  dotsEl.innerHTML = state.eligibleStyles.map((_, i) =>
    `<span class="reply-dot${i === activePos ? " active" : ""}"></span>`
  ).join("");
}

// Always shown when there's more than one card — a permanent affordance,
// not first-time-only guidance.
function _updateSwipeHintVisibility() {
  const hint = document.getElementById("reply-swipe-hint");
  if (!hint) return;
  hint.classList.toggle("hidden", state.eligibleStyles.length <= 1);
}

function _closestCard(track) {
  const cards = track.querySelectorAll(".yr-card");
  const center = track.scrollLeft + track.clientWidth / 2;
  let closest = null, closestDist = Infinity;
  cards.forEach(card => {
    const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
    if (dist < closestDist) { closestDist = dist; closest = card; }
  });
  return closest;
}

// Keeps .is-center on whichever card is nearest the middle — this is what
// makes the centered card render taller than its neighbors (see .yr-card).
// Runs on every scroll frame, not just on settle, so the scale hand-off
// happens live mid-swipe.
function _updateCenterCardClass(track) {
  const closest = _closestCard(track);
  track.querySelectorAll(".yr-card").forEach(c => c.classList.toggle("is-center", c === closest));
}

// Wires the track's scroll-settle detection and pointer-drag, exactly once
// (renderReplyCarousel re-runs per scan, but the track element persists).
let _carouselScrollTimer = null;
function _wireCarousel(track) {
  if (track._wired) { _updateCenterCardClass(track); return; }
  track._wired = true;

  track.addEventListener("scroll", () => {
    _updateCenterCardClass(track);
    clearTimeout(_carouselScrollTimer);
    _carouselScrollTimer = setTimeout(() => _onCarouselSettled(track), 120);
  }, { passive: true });

  _initCarouselDrag(track);
  _updateCenterCardClass(track);
}

// Detects which card is centered once native scrolling settles (debounced
// on the 'scroll' event rather than 'scrollend', which isn't universally
// supported), updates state.currentStyleIndex/asstStyle, and fetches/
// prefetches accordingly. If the settled card is a loop phantom, silently
// (no animation) jumps the track to the matching real card at the same
// scroll position, so the loop is invisible to the user.
function _onCarouselSettled(track) {
  if (track._dragging) return; // wait for the hand to lift; onUp re-triggers settle
  const closest = _closestCard(track);
  if (!closest) return;

  const style      = closest.dataset.style;
  const isPhantom   = closest.dataset.phantom === "true";
  const realIndex   = state.eligibleStyles.indexOf(style);
  if (!isPhantom && realIndex === state.currentStyleIndex) return; // nothing actually changed

  state.currentStyleIndex = realIndex;
  state.asstStyle = style;
  ZeloAnalytics.track('tone_selected', { tone: style });
  _renderDots();
  _ensureStyleFetched(style);
  _prefetchNextStyle();

  if (isPhantom) {
    const realCard = track.querySelector(`.yr-card[data-style="${style}"][data-index]`);
    if (realCard) {
      track.scrollLeft = realCard.offsetLeft + realCard.offsetWidth / 2 - track.clientWidth / 2;
      _updateCenterCardClass(track);
    }
  }
}

// Pointer drag-to-swipe — same mouse+touch mechanics as the homepage card
// stack (attachDragListeners/onDragStart): shared handlers, and the mouse
// move/up listeners live on document so the drag survives the cursor
// leaving the track. Touch swipes already work via native scroll; this is
// what makes dragging work with a mouse on desktop. Text selection is
// blocked by user-select:none on the track (see .yr-carousel).
function _initCarouselDrag(track) {
  let startX = 0, startScroll = 0, moved = false;

  function onDown(e) {
    if (e.button !== 0) return; // left button only
    track._dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("dragging"); // suspends scroll-snap so it doesn't fight the hand
    e.preventDefault();              // stops native text/image drag from hijacking the gesture
  }

  function onMove(e) {
    if (!track._dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startScroll - dx;
  }

  function onUp() {
    if (!track._dragging) return;
    track._dragging = false;
    track.classList.remove("dragging");
    const closest = _closestCard(track);
    if (closest) {
      track.scrollTo({
        left: closest.offsetLeft + closest.offsetWidth / 2 - track.clientWidth / 2,
        behavior: "smooth"
      });
    }
  }

  track.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // A drag that moved shouldn't also fire the card's "Use this reply" click
  track.addEventListener("click", e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);
}

// ================================================================
// SCAN WIDGET CAROUSEL — 4 fixed full-width slides (promo + 3 dummy-data
// widgets). Same native scroll-snap + mouse-drag-polyfill technique as
// _wireCarousel/_initCarouselDrag above, simplified: no loop/phantom cards
// (only 4 real slides, arrows just disable at the ends instead of
// wrapping), no per-card data fetching.
// ================================================================
let _widgetCarouselIndex = 0;

function _widgetCarouselCards(track) {
  return Array.from(track.querySelectorAll(".widget-card"));
}

function _closestWidgetCard(track) {
  const cards = _widgetCarouselCards(track);
  const center = track.scrollLeft + track.clientWidth / 2;
  let closest = null, closestDist = Infinity;
  cards.forEach(card => {
    const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
    if (dist < closestDist) { closestDist = dist; closest = card; }
  });
  return closest;
}

// Idle-fade chrome (border outline, arrows, dots): hidden by default —
// nothing to see right after login or swiping into the Scan tab — and
// only revealed by touching/dragging the carousel or tapping an arrow/dot,
// then faded back out after 3s of no further interaction. Never auto-shown
// on load, per the "should not see any of it in the normal state" ask.
let _widgetChromeTimer = null;
// Tracked via focus/blur rather than reading document.activeElement live
// inside _showWidgetChrome() — that raced the browser's own blur timing:
// the tap that closes the keyboard fires pointerdown while the input can
// still momentarily report as document.activeElement, so that first tap
// after closing the keyboard would suppress the reveal too, and the user
// had to tap the widget a second time before it actually worked. A flag
// updated by real focus/blur events isn't subject to that race.
let _textInputFocused = false;
// Timestamp of the last input/textarea blur — lets the touchstart-dismiss
// listener further down recognize "a field was just focused" even when a
// device's own native tap-outside-to-dismiss behavior (unreliable, which is
// why that listener does its own explicit blur() too — see its comment)
// races ahead and resigns first responder before that listener's JS runs,
// leaving document.activeElement already reset by the time it checks.
let _lastTextInputBlurAt = 0;
document.addEventListener("focusin", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") _textInputFocused = true;
});
document.addEventListener("focusout", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    _textInputFocused = false;
    _lastTextInputBlurAt = Date.now();
  }
});
// If a tap lands outside a currently-focused text input, that SAME tap is
// the one dismissing the keyboard — it shouldn't ALSO count as a tap on
// whatever it happened to land on. There's already a dedicated
// touchstart/capture listener elsewhere (search "blur it directly" further
// down this file) that performs the actual blur() for exactly this case —
// _dismissingKeyboard is set from inside THAT listener (not a second one
// here) so this reliably reflects "focused right before that blur," not a
// separately-raced guess: a second capture listener checking
// document.activeElement on its own could easily run after that one
// already blurred it, seeing "nothing was focused" and missing the case
// entirely (checking _textInputFocused alone has that exact problem — by
// the time a bubble-phase listener like the widget's own touchstart runs,
// the existing blur has already fired and flipped it back to false).
let _dismissingKeyboard = false;

function _showWidgetChrome() {
  // While a text field is focused (keyboard up), taps anywhere — including
  // on the widget itself — are the user dismissing the keyboard, not
  // asking to see the widget's chrome. Every reveal path (swipe, scroll,
  // drag, arrow tap, dot tap) funnels through this one function, so gating
  // it here covers all of them.
  if (_textInputFocused || _dismissingKeyboard) return;
  const carousel = document.getElementById("widget-carousel");
  if (!carousel) return;
  carousel.classList.add("chrome-visible");
  clearTimeout(_widgetChromeTimer);
  _widgetChromeTimer = setTimeout(() => {
    carousel.classList.remove("chrome-visible");
  }, 3000);
}

function _hideWidgetChrome() {
  const carousel = document.getElementById("widget-carousel");
  if (!carousel) return;
  clearTimeout(_widgetChromeTimer);
  carousel.classList.remove("chrome-visible");
}

function _wireWidgetCarousel() {
  const track = document.getElementById("widget-carousel-track");
  if (!track || track._wired) return;
  track._wired = true;
  track.scrollLeft = 0;

  // Dot indicator updates live, on every scroll tick during the swipe —
  // not debounced to "settled" — so it registers the new card the instant
  // the drag crosses the midpoint, instead of visibly lagging until the
  // motion fully stops. The 100ms trailing call stays as a cheap safety
  // net for whichever scroll event actually lands the final position
  // (harmless — it's just re-running the same closest-card check).
  let settleTimer = null;
  track.addEventListener("scroll", () => {
    _showWidgetChrome();
    _onWidgetCarouselSettled(track);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => _onWidgetCarouselSettled(track), 100);
  }, { passive: true });

  // Touch swipe reveals chrome too — scroll fires during the swipe on most
  // browsers, but this covers a tap/press that doesn't end up scrolling.
  track.addEventListener("touchstart", _showWidgetChrome, { passive: true });

  // Tap anywhere outside the widget (blank space, the message box, any
  // other UI) closes the chrome immediately instead of waiting out the 3s
  // timer. No preventDefault/stopPropagation — the tap still does its own
  // normal job afterward (e.g. focusing the textarea underneath).
  const carousel = document.getElementById("widget-carousel");
  document.addEventListener("pointerdown", e => {
    if (!carousel.classList.contains("chrome-visible")) return;
    if (carousel.contains(e.target)) return;
    _hideWidgetChrome();
  });

  _initWidgetCarouselDrag(track);
  _updateWidgetCarouselChrome();

  // Inter loads async (see the <link> in <head>) — if it swaps in after
  // this point, the resulting reflow can shift each card's width by a
  // fraction of a pixel, which is enough for scroll-snap to settle on the
  // wrong card. Re-pin to whichever card was actually active once fonts
  // are done, so the swap can never visibly knock the carousel off card 1.
  document.fonts?.ready?.then(() => {
    if (track._dragging) return;
    track.scrollLeft = _widgetCarouselIndex * track.clientWidth;
  });
}

function _onWidgetCarouselSettled(track) {
  if (track._dragging) return;
  const closest = _closestWidgetCard(track);
  if (!closest) return;
  _widgetCarouselIndex = Number(closest.dataset.widgetIndex) || 0;
  _updateWidgetCarouselChrome();
}

function _updateWidgetCarouselChrome() {
  const dots = document.querySelectorAll("#widget-carousel-dots .widget-carousel-dot");
  dots.forEach((dot, i) => dot.classList.toggle("active", i === _widgetCarouselIndex));

  const prevBtn = document.getElementById("widget-carousel-prev");
  const nextBtn = document.getElementById("widget-carousel-next");
  if (prevBtn) prevBtn.hidden = _widgetCarouselIndex <= 0;
  // Next stays visible even on the last card — it wraps back to card 1
  // instead of clamping, so there's always a way forward.
  if (nextBtn) nextBtn.hidden = false;
}

function _widgetCarouselScrollTo(index) {
  const track = document.getElementById("widget-carousel-track");
  const cards = _widgetCarouselCards(track);
  const card = cards[index];
  if (!track || !card) return;
  _widgetCarouselIndex = index;
  track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  _updateWidgetCarouselChrome();
}

function widgetCarouselGoTo(index) { _showWidgetChrome(); _widgetCarouselScrollTo(index); }
function widgetCarouselPrev()      { _showWidgetChrome(); _widgetCarouselScrollTo(Math.max(0, _widgetCarouselIndex - 1)); }
function widgetCarouselNext() {
  _showWidgetChrome();
  const track = document.getElementById("widget-carousel-track");
  const last = _widgetCarouselCards(track).length - 1;
  // Wraps to the first card from the last one instead of stopping dead.
  const next = _widgetCarouselIndex >= last ? 0 : _widgetCarouselIndex + 1;
  _widgetCarouselScrollTo(next);
}

// Mouse-drag polyfill — identical technique to _initCarouselDrag above,
// duplicated rather than shared since that one is wired into the reply
// carousel's own style-fetch/phantom-loop side effects.
function _initWidgetCarouselDrag(track) {
  let startX = 0, startScroll = 0, moved = false;

  function onDown(e) {
    if (e.button !== 0) return;
    _showWidgetChrome();
    track._dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("dragging");
    e.preventDefault();
  }
  function onMove(e) {
    if (!track._dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startScroll - dx;
  }
  function onUp() {
    if (!track._dragging) return;
    track._dragging = false;
    track.classList.remove("dragging");
    const closest = _closestWidgetCard(track);
    if (closest) {
      _widgetCarouselIndex = Number(closest.dataset.widgetIndex) || 0;
      track.scrollTo({ left: closest.offsetLeft, behavior: "smooth" });
      _updateWidgetCarouselChrome();
    }
  }

  track.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  track.addEventListener("click", e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);
}

// Fetches a style's reply only if it isn't cached yet — used both for the
// card the user just landed on, and (via _prefetchNextStyle) the one ahead.
// One brief automatic retry before surfacing a failure — a single dropped
// request (common on a flaky connection) shouldn't immediately show an
// error card; a real outage still will, just ~700ms later instead of
// silently leaving the loading dots spinning or showing a fake "reply".
async function _fetchDeepSeekReplyWithRetry(style) {
  try {
    return await _fetchDeepSeekReply(style);
  } catch (e) {
    await new Promise(r => setTimeout(r, 700));
    return _fetchDeepSeekReply(style); // second failure propagates to the caller
  }
}

function _ensureStyleFetched(style) {
  if (state.asstCurrentSet[style]) return;
  state.asstFailedStyles.delete(style);
  _fetchDeepSeekReplyWithRetry(style)
    .then(reply => {
      state.asstCurrentSet[style] = reply;
      _saveGeneratedReply(style, reply);
      _renderCardText(style);
      if (state.replayThreadId) _replayOnReplyReady(style, reply);
    })
    .catch(() => {
      state.asstFailedStyles.add(style);
      _renderCardText(style);
    });
}

// Tapped from a card's own "Retry" button (see _cardHTML()'s .yr-card-error).
function _retryStyleFetch(style) {
  state.asstFailedStyles.delete(style);
  delete state.asstCurrentSet[style];
  _renderCardText(style); // back to the loading dots immediately
  _ensureStyleFetched(style);
}

// ---- Replay layout (see .is-replay in style.css) ----------------------
// Everything the user does on a replayed scan is written straight back into
// that thread's most recent scan (_replayPersist), so History, the Link a
// thread picker and AI Coach's linked-conversation card all show the
// updated conversation/reply/tone instead of the one that was first saved.

function _replayCurrentStyle() {
  return state.eligibleStyles[state.currentStyleIndex] || state.asstStyle;
}

function _replayRenderConvo(popIdx) {
  renderHerMessagePreview(state.asstMessage, state.replayConvo);
  if (popIdx == null) return;
  const row = document.querySelectorAll('#yr-conv .yr-conv-row')[popIdx];
  if (row) row.classList.add('yr-conv-row--pop');
}

// commit=true also writes the currently shown suggestion (reply + tone) as the
// scan's reply/style — only "Use this reply" does that; just browsing tones or
// getting new suggestions never touches what's saved.
function _replayPersist(commit) {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.replayThreadId);
  const scan    = thread && thread.scans && thread.scans[thread.scans.length - 1];
  if (!scan) return;
  const convo = state.replayConvo;
  const lastHer = [...convo].reverse().find(m => m.sender === 'her');
  scan.conversationMessages = convo.map(m => ({ sender: m.sender, text: m.text }));
  if (lastHer) scan.message = lastHer.text;
  if (commit) {
    scan.reply = state.replayCurrentReply;
    scan.style = state.replayStyle;
  }
  scan.time  = Date.now();
  saveThreads(threads);
  // AI Coach's linked-conversation preview lives on the screen underneath and
  // was built from the OLD scan — refresh it so going back shows the update.
  if (document.getElementById('aicoach-context-row')) renderAiCoachContext();
}

// A new suggestion arrived (tone change / new suggestions / shorter / a new
// message from her). It only becomes the card's text — the conversation and the
// saved scan are NOT touched until the user presses "Use this reply".
function _replayOnReplyReady(style, reply) {
  if (style !== _replayCurrentStyle()) return;
  state.replayCurrentReply = reply;
  state.replayStyle        = style;
}

// Hold a bubble in the replay's conversation card to delete it. Delegated on
// the (persistent) #yr-conv box because its rows are re-rendered on every
// change; ignored unless the screen is in replay mode. Moving the finger
// (scrolling the card) or lifting early cancels the hold.
const REPLAY_HOLD_MS = 480;
// Springy ease-back applied only when a press ENDS (release/cancel/matured-
// into-delete) — the press itself is instant (see the CSS comment on
// .yr-conv-row--pressing), same "snap while held, ease on release" split
// used by the sheet drag-to-close gestures elsewhere in this file.
const REPLAY_PRESS_RELEASE_TRANSITION = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';

function attachReplayBubbleHold() {
  const box = document.getElementById('yr-conv');
  if (!box) return;
  let timer = null, row = null, sx = 0, sy = 0;
  const release = () => {
    clearTimeout(timer); timer = null;
    if (row) {
      row.style.transition = REPLAY_PRESS_RELEASE_TRANSITION;
      row.classList.remove('yr-conv-row--pressing');
    }
    row = null;
  };
  box.addEventListener('pointerdown', e => {
    if (!_holdDeletableConvo()) return;
    const r = e.target.closest('.yr-conv-row');
    if (!r) return;
    release();
    row = r; sx = e.clientX; sy = e.clientY;
    // No transition here — the row has to visibly react the instant it's
    // touched, not ease in a beat later (that's what read as "not still" /
    // unresponsive during the hold).
    row.style.transition = 'none';
    row.classList.add('yr-conv-row--pressing');
    timer = setTimeout(() => {
      const idx = [...box.querySelectorAll('.yr-conv-row')].indexOf(r);
      r.style.transition = REPLAY_PRESS_RELEASE_TRANSITION;
      r.classList.remove('yr-conv-row--pressing');
      row = null;
      navigator.vibrate?.(15); _cineHaptic('MEDIUM');
      if (idx >= 0) replayConfirmDeleteMessage(idx);
    }, REPLAY_HOLD_MS);
  });
  box.addEventListener('pointermove', e => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) release();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => box.addEventListener(t, release));
  box.addEventListener('contextmenu', e => { if (_holdDeletableConvo()) e.preventDefault(); });
}

// "Use this reply": besides copying it, the reply becomes the user's own
// message in the conversation (pops in), and it — with its tone — is saved as
// the scan's reply/style. If the conversation already ends with that exact pink
// bubble it is only re-popped (committed), not duplicated.
function replayUseReply(text) {
  const convo = state.replayConvo;
  const last  = convo[convo.length - 1];
  if (!(last && last.sender === 'me' && last.text === text)) convo.push({ sender: 'me', text });
  state.replayCurrentReply = text;
  state.replayStyle        = _replayCurrentStyle();
  _replayRenderConvo(convo.length - 1);
  _replayPersist(true);
}

// The conversation a long-press can delete from: the replay's, or — on a fresh
// scan — the one shown as bubbles (a screenshot's, or one messages were added to).
function _holdDeletableConvo() {
  if (state.replayThreadId) return state.replayConvo;
  const c = state.asstConversationMessages;
  return (c && c.length && document.getElementById('yr-preview-block')?.classList.contains('has-shot')) ? c : null;
}

function replayConfirmDeleteMessage(idx) {
  const convo = _holdDeletableConvo();
  const msg = convo && convo[idx];
  if (!msg) return;
  if (convo.length <= 1) {
    flashLimitToast("A saved conversation needs at least one message");
    return;
  }
  _showChatConfirm("Delete message?", "This removes it from this conversation.", "Delete", () => replayDeleteMessage(idx));
}

function replayDeleteMessage(idx) {
  const convo = _holdDeletableConvo();
  if (!convo) return;
  const removed = convo.splice(idx, 1)[0];
  if (!removed) return;
  // What the suggestion answers is her latest remaining message.
  const lastHer = [...convo].reverse().find(m => m.sender === 'her');
  if (lastHer) state.asstMessage = lastHer.text;
  if (state.replayThreadId) {
    _replayRenderConvo();
    _replayPersist();
  } else {
    renderHerMessagePreview(state.asstMessage, convo);   // fresh scan: saved later with the scan
    document.getElementById('yr-preview-block')?.classList.add('has-added');
    _renderZeloRead(state.asstMessage);
  }
}

// Which side of the Her/You toggle is active — decides who a sent message
// (replayAddCurrentMessage(), the composer's one always-visible send button)
// is added as. Reset to 'her' every time the composer (re)appears, since a
// fresh scan or a newly opened replay should always start on the same side.
let _replayAddOpen = false;
function _setReplayAddOpen(open, focus) {
  _replayAddOpen = open;
  document.getElementById('yr-add-row')?.classList.toggle('is-open', open);
  document.getElementById('yr-add-row-label')?.setAttribute('aria-expanded', String(open));
  _srMakeScrollable();
  if (open && focus !== false) setTimeout(() => document.getElementById('yr-add-' + _replayAddWho)?.focus(), 240);
  if (!open) document.activeElement?.blur?.();
}
function toggleReplayAddBox() { _cineHaptic('LIGHT'); _setReplayAddOpen(!_replayAddOpen); }

let _replayAddWho = 'her';

function _resetReplayAdd() {
  ['her', 'me'].forEach(who => {
    const ta = document.getElementById('yr-add-' + who);
    if (ta) { ta.value = ''; ta.style.height = ''; }
  });
  _replayAddWho = 'her';
  _setReplayAddOpen(false, false);          // normal state: closed
  document.getElementById('yr-add-field-her')?.removeAttribute('hidden');
  document.getElementById('yr-add-field-me')?.setAttribute('hidden', '');
  document.getElementById('yr-add-tab-her')?.classList.add('yr-add-tab--active');
  document.getElementById('yr-add-tab-me')?.classList.remove('yr-add-tab--active');
  const labelText = document.getElementById('yr-add-row-label-text');
  if (labelText) labelText.textContent = 'Add her message';
  // Best-effort here — at this point in both call sites (generateReplies()/
  // openScanReplay()) #scan-result-content is usually still `hidden` (real
  // layout doesn't exist yet, so the tab has 0 width to measure), so this
  // alone isn't enough; _armAddTogglePill() below is what actually runs once
  // content is real. Kept here too for any future caller where it's already
  // visible at reset time.
  _armAddTogglePill();
}

// Two frames: the toggle has to actually be laid out (real width/position)
// before its pill can be measured — same reasoning as updateTabGlassPill()
// being called after the tab bar itself is in the DOM. Call this once
// #scan-result-content has actually been revealed (`hidden = false`), not
// from _resetReplayAdd() alone — that runs earlier, while content is still
// hidden and every element in it reads a real width of 0.
// Your Reply fits the viewport, so it had nothing to scroll and felt fixed.
// Same size and layout; just guarantee a little overflow so it drags and bounces.
function _srMakeScrollable() {
  const el = document.getElementById('screen-scan-result');
  if (!el) return;
  const go = () => _ensureScrollableOverflow(el, 56);
  // Re-measured as the layout settles (reply text, the toggle pill and the
  // conversation box all change the height after first paint).
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 350); setTimeout(go, 1000);
}

function _armAddTogglePill() {
  _srMakeScrollable();
  requestAnimationFrame(() => requestAnimationFrame(() => _slideAddTogglePill(false)));
}

// Slides the pink pill (#yr-add-toggle-pill) behind whichever of Her/You is
// active, sized/positioned from that tab's own live rect — same technique as
// the bottom tab bar's #tab-glass-pill (updateTabGlassPill()) — so it always
// lines up exactly with the tab's real rendered width regardless of its text.
function _slideAddTogglePill(animate) {
  const pill = document.getElementById('yr-add-toggle-pill');
  const wrap = document.getElementById('yr-add-toggle');
  if (!pill || !wrap) return;
  const btn = document.getElementById('yr-add-tab-' + _replayAddWho);
  if (!btn || !btn.offsetWidth) return;
  const wrapRect = wrap.getBoundingClientRect();
  const btnRect  = btn.getBoundingClientRect();
  pill.style.transition = animate === false ? 'none' : '';
  pill.style.width = btnRect.width + 'px';
  pill.style.transform = 'translateX(' + (btnRect.left - wrapRect.left - 3) + 'px)';
  pill.classList.add('yr-add-toggle-pill--ready');
  if (animate === false) void pill.offsetWidth; // flush the no-transition jump before transitions are re-enabled
}
window.addEventListener('resize', () => _slideAddTogglePill(false));

// Switches which side of the toggle is active. Cross-dissolves the input box
// as a whole (a quick opacity/scale dip while the field underneath swaps and
// refocuses, back up once the new field is in) rather than trying to overlap
// two different-height fields mid-transition — a clean, simple motion instead
// of a layout jump. The right-hand "Add her/your message" label fades through
// the same beat.
function setReplayAddWho(who) {
  if (!_replayAddOpen) _setReplayAddOpen(true, false);      // pressing Her or You opens the box
  if (who === _replayAddWho) { setTimeout(() => document.getElementById('yr-add-' + who)?.focus(), _replayAddOpen ? 0 : 240); return; }
  _replayAddWho = who;
  navigator.vibrate?.(6);
  _slideAddTogglePill(true);
  document.getElementById('yr-add-tab-her')?.classList.toggle('yr-add-tab--active', who === 'her');
  document.getElementById('yr-add-tab-me')?.classList.toggle('yr-add-tab--active', who === 'me');

  const box = document.getElementById('yr-add-box');
  box?.classList.add('yr-add-box--switching');
  // The label text swaps INSTANTLY, not faded — a small bold label crossfading
  // through a low-opacity mid-transition frame is what actually looked like
  // garbled/doubled text ("AAdd her message") on a real device: opacity-fading
  // small bold text is a known bad case, unlike the box's own dip/scale above,
  // which is a plain colour/shape change and reads cleanly. Confirmed by
  // grabbing frames during the transition — a low-opacity bold "A" genuinely
  // looks smudged/doubled, not a real second element overlapping.
  document.getElementById('yr-add-row-label-text').textContent = who === 'her' ? 'Add her message' : 'Add your message';
  setTimeout(() => {
    document.getElementById('yr-add-field-her')?.toggleAttribute('hidden', who !== 'her');
    document.getElementById('yr-add-field-me')?.toggleAttribute('hidden', who !== 'me');
    box?.classList.remove('yr-add-box--switching');
    document.getElementById('yr-add-' + who)?.focus();
  }, 130);
}

function onReplayAddInput(who) {
  const ta = document.getElementById('yr-add-' + who);
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 84) + 'px';
}

function onReplayAddKey(e, who) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); replayAddMessage(who); }
}

// The composer's one always-visible send button — adds the message as
// whichever side of the toggle is currently active.
function replayAddCurrentMessage() {
  replayAddMessage(_replayAddWho);
}

// who: 'her' | 'me'. The message pops into the conversation card and is
// saved. A message from HER also becomes what the suggestion answers, so the
// card regenerates for it; one from the user just joins the conversation.
function replayAddMessage(who) {
  const ta = document.getElementById('yr-add-' + who);
  const text = ta ? ta.value.trim() : '';
  if (!text) return;
  if (!state.replayThreadId) { freshAddMessage(who, ta, text); return; }
  state.replayConvo.push({ sender: who, text });
  ta.value = '';
  onReplayAddInput(who);
  navigator.vibrate?.(8);
  if (who === 'her') state.asstMessage = text;
  _replayRenderConvo(state.replayConvo.length - 1);
  _replayPersist();
  if (who === 'her') _retryStyleFetch(_replayCurrentStyle());
}

// Same two boxes on a FRESH scan (not yet saved): the message pops into the
// conversation card (a typed single message becomes the first bubble) and rides
// along into the saved scan via state.asstConversationMessages (see
// _saveScanPreviewMessages()). A message from her also becomes what Zelo answers.
function freshAddMessage(who, ta, text) {
  if (!state.asstConversationMessages || !state.asstConversationMessages.length) {
    state.asstConversationMessages = state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : [];
  }
  state.asstConversationMessages.push({ sender: who, text });
  ta.value = '';
  onReplayAddInput(who);
  navigator.vibrate?.(8);
  renderHerMessagePreview(who === 'her' ? text : state.asstMessage, state.asstConversationMessages);
  document.getElementById('yr-preview-block')?.classList.add('has-added');
  const rows = document.querySelectorAll('#yr-conv .yr-conv-row');
  rows[rows.length - 1]?.classList.add('yr-conv-row--pop');
  if (who === 'her') _regenerateFromResultInput(text);
  else _renderZeloRead(state.asstMessage);
}

function _replaySwitchStyle(style) {
  state.eligibleStyles    = [style];
  state.currentStyleIndex = 0;
  state.asstStyle         = style;
  renderReplyCarousel();
  _centerCarouselOnCurrent();
  _ensureStyleFetched(style);
  // Already generated earlier this visit → no fetch will fire the hook.
  if (state.asstCurrentSet[style]) _replayOnReplyReady(style, state.asstCurrentSet[style]);
}

function replayGetNewSuggestions() {
  ZeloAnalytics.track('reply_regenerated', { tone: _replayCurrentStyle() });
  _retryStyleFetch(_replayCurrentStyle());
}

// Change tone: slide-up sheet with every tone; tapping one closes it and the
// card shows that tone generating.
const REPLAY_TONES = ['smooth', 'direct', 'funny', 'warmer', 'bolder', 'shorter', 'longer'];
function replayChangeTone() {
  const cur = _replayCurrentStyle();
  document.getElementById('yr-tone-grid').innerHTML = REPLAY_TONES.map(t => `
    <button type="button" class="yr-tone${t === cur ? ' selected' : ''}" onclick="replayPickTone('${t}')">
      <img src="assets/icons/reply-styles/${t}.${ICON_EXT}" alt="" draggable="false">
      <span>${STYLE_LABELS[t]}</span>
    </button>`).join('');
  document.getElementById('yr-tone-overlay').hidden = false;
}

function closeReplayToneSheet() {
  document.getElementById('yr-tone-overlay').hidden = true;
}

function replayPickTone(style) {
  closeReplayToneSheet();
  if (style === _replayCurrentStyle()) return;
  ZeloAnalytics.track('tone_selected', { tone: style });
  _replaySwitchStyle(style);
}

function replayShorterReply() {
  _replaySwitchStyle('shorter');
}

// ---- "Explain why" — real AI Coach, not a canned line. Opens the same
// AI Coach chat sheet as the header's "Ask AI Coach" (openAiCoachFromScan()),
// then sends an actual question into it exactly like a user typing one
// (sendAiCoachMessage()) — same chat UI, same live DeepSeek call. So Zelo
// answers about THIS specific suggested reply (not the message in general),
// _aiCoachExplainCard is stashed for _buildAiCoachMessages() to fold into the
// system prompt as real context: the card's exact text + tone label. ----
let _aiCoachExplainCard = null; // { style, text } — read by _buildAiCoachMessages(); cleared whenever the sheet opens fresh

function showReplyExplain() {
  const style = _replayCurrentStyle();
  const text  = state.asstCurrentSet[style];
  if (!text) return; // still loading/failed — nothing to ask about yet
  openAiCoachFromScan();               // resets _aiCoachExplainCard to null, opens the sheet
  _aiCoachExplainCard = { style, text };
  sendAiCoachMessage('Why does this reply work?');
}

// Silent background fetch, exactly one card ahead of whatever's centered —
// wraps around at the end since the carousel loops. Never fetches more
// than one card at a time.
function _prefetchNextStyle() {
  const n = state.eligibleStyles.length;
  if (n <= 1) return;
  const nextIndex = (state.currentStyleIndex + 1) % n;
  _ensureStyleFetched(state.eligibleStyles[nextIndex]);
}

// Programmatic navigation — native touch/trackpad swipe doesn't need this,
// but it's what regenerate/future prev-next controls scroll the track with.
function goToStyleIndex(index) {
  const n = state.eligibleStyles.length;
  if (!n) return;
  const wrapped = ((index % n) + n) % n;
  const track = document.getElementById("reply-carousel");
  const card  = track?.querySelector(`.yr-card[data-index="${wrapped}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}


// ================================================================
// ASSISTANT: COPY REPLY
// ================================================================

function copyCurrentReply() {
  const text = _currentReplyText();
  // Button itself stays "Copy" always — confirmation is the toast now
  // (showCopyToast() below), not a label swap. Clipboard write failures
  // still show the toast (silent fallback, matches the previous behavior).
  navigator.clipboard.writeText(text).then(showCopyToast).catch(showCopyToast);
  ZeloRecords.markReplyCopied((state.asstReplyIds || {})[state.asstStyle]);
}

const COPY_TOAST_DURATION = 2750; // ms — 2.5-3s is standard for this kind of toast
let _copyToastTimer = null;
let _copyToastHideTimer = null;

// Single reusable toast node (#copy-toast in index.html) instead of
// creating a new one per call — tapping Copy again while it's already
// showing just restarts the countdown bar and the auto-dismiss timer in
// place, rather than stacking a second toast.
function showCopyToast(message) {
  const toast = document.getElementById('copy-toast');
  const bar   = document.getElementById('copy-toast-bar');
  if (!toast || !bar) return;
  const sub = toast.querySelector('.copy-toast-sub');
  if (sub) sub.textContent = message || 'Zelo response copied to clipboard';

  clearTimeout(_copyToastTimer);
  clearTimeout(_copyToastHideTimer);
  toast.hidden = false;

  // Restart the drain bar cleanly even mid-animation: kill any transition
  // in progress and snap back to full, force a reflow so the browser
  // re-registers that starting state, then start draining from it.
  bar.style.transition = 'none';
  bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${COPY_TOAST_DURATION}ms linear`;
  bar.style.width = '0%';

  requestAnimationFrame(() => toast.classList.add('visible'));

  _copyToastTimer = setTimeout(hideCopyToast, COPY_TOAST_DURATION);
}

function hideCopyToast() {
  const toast = document.getElementById('copy-toast');
  if (!toast) return;
  clearTimeout(_copyToastTimer);
  clearTimeout(_copyToastHideTimer);
  toast.classList.remove('visible');
  // Wait out the fade-out transition before removing it from layout, so a
  // fresh showCopyToast() call (which clears this same timer) can't have
  // its brand-new toast yanked hidden by a stale one.
  _copyToastHideTimer = setTimeout(() => { toast.hidden = true; }, 340); // = the slide-up transition (.copy-toast)
}


// ================================================================
// STREAK NOTIFICATION BANNER — PROTOTYPE ONLY (see #streak-notif in
// index.html). Same reusable single-node drop-down pattern as
// showCopyToast() above. Not wired to any real streak-increment event
// yet: call showStreakNotif(newDays, todayIndex) directly to preview it.
// No persistence, no real trigger wiring — that's for whoever hooks this
// up to the real streak system later. Mascot art is the same real crop
// already used in the header pill, not redrawn.
//
// Sequence: toast drops in -> today's week-row dot checks off + a haptic
// buzz -> the day-count "digit roll" (old digit slides/shrinks up and out
// like it's pulled into a vanishing point, new digit simultaneously
// slides/grows up into place — a two-layer opposing vertical slide, the
// same mechanic as a slot-machine/odometer digit flip) -> holds -> auto-
// dismiss.
// ================================================================
const STREAK_NOTIF_WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const STREAK_NOTIF_CHECK_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

function _renderStreakNotifWeek(doneCount) {
  const wrap = document.getElementById('streak-notif-week');
  if (!wrap) return;
  wrap.innerHTML = STREAK_NOTIF_WEEK_LABELS.map((label, i) => {
    const done = i < doneCount;
    return `<span class="streak-notif-day">
      <span class="streak-notif-day-label">${label}</span>
      <span class="streak-notif-day-dot${done ? ' streak-notif-day-dot--done' : ''}" data-day-index="${i}">${done ? STREAK_NOTIF_CHECK_SVG : ''}</span>
    </span>`;
  }).join('');
}

let _streakNotifTimers = [];

function showStreakNotif(newDays, todayIndex) {
  const toast = document.getElementById('streak-notif');
  if (!toast) return;
  _streakNotifTimers.forEach(clearTimeout);
  _streakNotifTimers = [];

  const oldDays = Math.max(0, newDays - 1);

  // Starting state: today not checked yet, title/number both show the old count.
  _renderStreakNotifWeek(todayIndex);
  document.getElementById('streak-notif-title-num').textContent = oldDays;
  document.getElementById('streak-notif-num-old').textContent = oldDays;
  document.getElementById('streak-notif-num-new').textContent = newDays;
  document.getElementById('streak-notif-num-roll').classList.remove('streak-notif-num-roll--rolling');

  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));

  // Phase 1 (500ms) — check today's dot + haptic buzz.
  _streakNotifTimers.push(setTimeout(() => {
    const dot = document.querySelector(`.streak-notif-day-dot[data-day-index="${todayIndex}"]`);
    if (dot) {
      dot.classList.add('streak-notif-day-dot--done', 'streak-notif-day-dot--pop');
      dot.innerHTML = STREAK_NOTIF_CHECK_SVG;
    }
    navigator.vibrate?.(12);

    // Phase 2 (+280ms) — the digit roll, and the title number updates in
    // lockstep with it.
    _streakNotifTimers.push(setTimeout(() => {
      document.getElementById('streak-notif-title-num').textContent = newDays;
      document.getElementById('streak-notif-num-roll').classList.add('streak-notif-num-roll--rolling');
    }, 280));
  }, 500));

  // Auto-dismiss ~4.2s after opening — long enough to read after the roll settles.
  _streakNotifTimers.push(setTimeout(hideStreakNotif, 4200));
}

function hideStreakNotif() {
  const toast = document.getElementById('streak-notif');
  if (!toast || toast.hidden) return;
  toast.classList.remove('visible');
  _streakNotifTimers.push(setTimeout(() => { toast.hidden = true; }, 340));
}

// "Use this reply" on an individual carousel card — copies that card's own
// text (not necessarily the centered one) and flashes feedback on that
// same button, since the shared header Copy button may belong to a
// different card than whichever one was actually tapped — including a
// phantom loop clone, since btn is the exact clicked element, not a re-query.
function copyReplyFromCard(style, btn) {
  const text = state.asstCurrentSet[style];
  if (!text) return;
  // Same floating "Copied to clipboard" toast as the header Copy button
  // (copyCurrentReply()) — a consistent confirmation everywhere a reply
  // gets copied, instead of this button swapping its own label in place.
  navigator.clipboard.writeText(text).then(showCopyToast).catch(showCopyToast);
  ZeloRecords.markReplyCopied((state.asstReplyIds || {})[style]);
  if (state.replayThreadId) replayUseReply(text);
  else freshUseReply(text);
}

// Fresh scan (not yet saved to a thread) version of replayUseReply(): the
// reply becomes the user's own message in the her-message conversation card
// (pops in), same as it does on a replay — it just isn't persisted to a
// thread yet (that happens later, whenever the scan itself gets saved; see
// _saveScanPreviewMessages(), which already reads asstConversationMessages).
function freshUseReply(text) {
  if (!state.asstConversationMessages || !state.asstConversationMessages.length) {
    state.asstConversationMessages = state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : [];
  }
  const convo = state.asstConversationMessages;
  const last  = convo[convo.length - 1];
  if (!(last && last.sender === 'me' && last.text === text)) convo.push({ sender: 'me', text });
  renderHerMessagePreview(state.asstMessage, convo);
  document.getElementById('yr-preview-block')?.classList.add('has-added');
  const rows = document.querySelectorAll('#yr-conv .yr-conv-row');
  rows[rows.length - 1]?.classList.add('yr-conv-row--pop');
}


// ================================================================
// ONBOARDING  (two-phase cinematic — active first-launch flow)
//   PHASE 1 (auto, ~4-5s, no interaction) — UNCHANGED:
//     typewriter -> word morph (Confidence/Connection/Conversations) -> logo
//   SHOWCASE (Cal AI style landing, auto-shown right after Phase 1):
//     phone mockup + headline + dark "Get Started" CTA + "Sign in" link.
//     No dots, no skip — tapping Get Started begins Phase 2.
//   PHASE 2 (Next + back, 14 dot-stepper screens — see CINE_STEPS):
//     1 name/photo/birth date · 2 gender · 3 be honest (overthink) ·
//     4 help with (multi) · 5 who you're attracted to · 6 tone ·
//     7 thanks/transition · 8 see what you can achieve · 9 notifications ·
//     10 setting up (auto) · 11 Zelo Plan (decorative) ·
//     12 save your progress (inert providers) ·
//     13 try for free · 14 trial reminder  ->  cineFinishPhase2() then hands
//     off to #screen-trial-start (own overlay, not #cine-onboarding) ->
//     Continue finishes onboarding straight onto Scan; back on that screen
//     shows the one-time offer screen instead, which also finishes onto Scan.
// Every screen fits the viewport (no scroll). App stays pink throughout —
// no theme/color picker anywhere.
// Legacy 3-slide onboarding + 12-step spotlight tour live in
// archive/legacy-onboarding.js and never run.
// ================================================================

let threadEditMode = false;

const CINE_LAST = 16;          // last Phase 2 step that lives in #cine-onboarding
let cineStep    = 0;           // 0 = Phase 1; 'showcase'; 1-16 = Phase 2 screens

// Per-step config for the shared chrome (#cine-next label + gating +
// visibility, back button, progress) and each screen's entrance hook. Head/
// body copy lives in the markup itself (index.html) — this table only drives
// behaviour, so adding/removing a screen is a one-line change here plus its
// <section data-screen="n"> and never a hunt through an if/else chain.
//   label        — text on the shared bottom CTA
//   enabledFn    — CTA stays disabled until this returns true (default: true)
//   entrance     — run on entering the step
//   noChrome     — hide back + progress (used by the auto-running setup step)
//   noCta        — screen has no shared bottom CTA at all
// Screens (trial-start) and (one-time offer) are NOT in this table: they're
// standalone .screen overlays reached after step 14 — see cineFinishPhase2().
const CINE_STEPS = {
  1:  { label: 'Continue', enabledFn: () => cineIntroReady(), entrance: cineRunIntroEntrance },
  2:  { label: 'Continue', enabledFn: () => !!cineAnswers.gender, entrance: cineRunQuestionEntrance },
  3:  { label: 'Continue', enabledFn: () => !!cineAnswers.source, entrance: cineRunQuestionEntrance , entrance: cineRunQuestionEntrance },     // NEW — "Where did you hear about Zelo?"
  4:  { label: 'Continue', enabledFn: () => !!cineAnswers.overthink, entrance: cineRunQuestionEntrance },
  5:  { label: 'Continue', enabledFn: () => (cineAnswers.help || []).length > 0, entrance: cineRunQuestionEntrance },
  6:  { label: 'Continue', enabledFn: () => !!cineAnswers.attracted, entrance: cineRunQuestionEntrance },
  7:  { label: 'Continue', enabledFn: () => !!cineAnswers.tone, entrance: cineRunQuestionEntrance },
  8:  { noCta: true },                              // NEW — referral code (optional) — own Continue/Skip buttons, see cineReferralContinue()
  9:  { label: 'Continue' },
  10: { label: 'Continue' },
  11: { noCta: true },                              // notifications — no shared CTA, see cineRequestNotifAndAdvance()
  12: { noCta: true, noChrome: true, entrance: cineRunSetupEntrance },  // auto-advances
  13: { label: 'Continue', arrow: true, entrance: cineRunPlanEntrance },
  14: { noCta: true },   // Save your progress — provider buttons are the only way forward, see cineProviderTap()
  15: { label: 'Try for FREE', entrance: cineRunTrialVideoEntrance },
  16: { label: 'Continue for FREE', dark: true, arrow: true },
};

// Answers collected during onboarding. Kept in memory + mirrored to
// localStorage so back-navigation restores the user's picks; deliberately NOT
// wired into reply-tone/practice-mode defaults — the Zelo Plan screen is
// decorative for now and real personalization is a separate task. `gender`
// IS wired to one real thing though — see cineTrialHeroSrc() — the trial-start
// hero photo picks its male/female crop from this answer. `attracted` IS also
// wired to something real: it writes straight to zelo_practice_mode (see
// cinePickOne), the same key the swipe-deck's dating-pool preference and the
// "Who You Practice With" settings panel already read/write — not a separate,
// disconnected answer. `source` and `referral` are collected and saved to
// localStorage (zelo_onb_source / zelo_onb_referral) for future use but have
// no downstream consumer yet — there's no analytics backend or referral-
// redemption system to feed them into.
let cineAnswers = { gender: null, source: null, overthink: null, help: [], attracted: null, tone: null, referral: null };

let _cineTimers = [];

function _cineClearTimers() {
  _cineTimers.forEach(t => clearTimeout(t));
  _cineTimers = [];
}
function _cineDelay(fn, ms) {
  const t = setTimeout(fn, ms);
  _cineTimers.push(t);
  return t;
}
// Forces the browser to paint the "before" state before adding entrance
// classes on the next frame, so CSS animations restart reliably.
function _cineNextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// Universal light haptic tap for every clickable control across onboarding
// (option rows, Continue/back, provider buttons, checkboxes, trial/offer
// screens) — one delegated listener so coverage doesn't depend on
// remembering to add navigator.vibrate to each individual handler. Matches
// on the same [onclick] convention every interactive element here already
// uses, so anything clickable is covered automatically, present or future.
// Attached once at load, independent of whether onboarding actually runs
// this session — harmless no-op on a tap that never happens.
function _cineTapHaptic(e) {
  const target = e.target.closest('[onclick], input[type="checkbox"]');
  if (!target) return;
  navigator.vibrate?.(4);
  _cineHaptic('LIGHT');
}
// Capture phase, not bubble — several handlers here (cineBack among them)
// call e.stopPropagation(), which would stop a bubble-phase listener on
// these ancestors from ever seeing the click. Capture fires on the way
// down, before the target's own handler runs, so it can't be blocked.
['cine-onboarding', 'screen-trial-start', 'screen-offer'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', _cineTapHaptic, true);
});

function initOnboarding() {
  initChatsTab();
  const overlay = document.getElementById('cine-onboarding');

  if (localStorage.getItem('zelo_onboarding_done')) {
    if (overlay) overlay.setAttribute('hidden', '');
    return;
  }
  if (!overlay) return;

  overlay.removeAttribute('hidden');
  startCineOnboarding();
}

function startCineOnboarding() {
  cineStep = 0;
  cineSetChrome('none');  // no skip / dots during the auto intro
  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', s.dataset.screen === '0');
  });
  _revealLazyImages(document.querySelector('.cine-screen.active'));

  // Brief black hold before the animation starts — the typewriter felt like
  // it snapped in too abruptly with no beat to land on first.
  const preblack = document.getElementById('cine-preblack');
  if (preblack) preblack.classList.remove('cine-preblack-out');
  _cineDelay(() => {
    if (preblack) preblack.classList.add('cine-preblack-out');
    cinePhase1();
  }, 700);
}

// Chrome modes: 'none' (Phase 1 + showcase — no top bar, no CTA),
// 'phase2' (back + progress bar, and the CTA per cineGoTo()).
function cineSetChrome(mode) {
  const show = mode === 'phase2';
  ['cine-next', 'cine-topbar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('cine-hidden', !show);
  });
}

// Native haptic tick for the Phase 1 intro only. window.Capacitor.Plugins is
// injected by the native iOS runtime; on plain web (Netlify) it's undefined,
// so this just no-ops and the existing navigator.vibrate calls carry the web
// fallback exactly as before.
function _cineHaptic(style) {
  window.Capacitor?.Plugins?.Haptics?.impact({ style }).catch(() => {});
}

// ---- PHASE 1 — typewriter -> word morph -> logo -> auto-advance ----
// (unchanged original sequence: "Never freeze up again." ->
//  Confidence / Connection / Conversations -> Zelo logo)
function cinePhase1() {
  const type = document.getElementById('cine-p1-type');
  const word = document.getElementById('cine-p1-word');
  const logo = document.getElementById('cine-p1-logo');
  if (!type) { cineGoToShowcase(); return; }

  type.textContent = '';  type.hidden = false;
  word.textContent = '';  word.hidden = true;  word.classList.remove('cine-p1-word--in');
  logo.hidden = true;     logo.classList.remove('cine-p1-logo--in');

  // 1) Typewriter "Never freeze up again."
  const text = 'Never freeze up again.';
  let i = 0;
  function tick() {
    if (i < text.length) {
      type.textContent = text.slice(0, ++i);
      navigator.vibrate?.(1);
      _cineHaptic('LIGHT');
      _cineDelay(tick, 38);
    } else {
      _cineDelay(runWords, 500);   // hold half a second
    }
  }
  tick();

  // 2) Word morph — crossfade in the same position, light bg / pink text
  function runWords() {
    type.hidden = true;
    word.hidden = false;
    const words = ['Confidence', 'Connection', 'Conversations'];
    words.forEach((w, idx) => {
      _cineDelay(() => {
        word.textContent = w;
        word.classList.remove('cine-p1-word--in'); void word.offsetWidth;
        word.classList.add('cine-p1-word--in');
        navigator.vibrate?.(4);
        _cineHaptic('MEDIUM');
      }, idx * 620);
    });
    _cineDelay(runLogo, words.length * 620 + 80);
  }

  // 3) Zelo logo with sparkle, then advance into the showcase screen
  function runLogo() {
    word.hidden = true;
    logo.hidden = false;
    void logo.offsetWidth;
    logo.classList.add('cine-p1-logo--in');
    // Exactly one haptic tick in this beat, timed to the spark's own pop-in
    // (.cine-p1-logo--in .cine-p1-spark has a 0.28s animation-delay in CSS —
    // this mirrors that so the buzz lands right as the star appears).
    // Nothing before or after it.
    _cineDelay(() => {
      navigator.vibrate?.(6);
      _cineHaptic('MEDIUM');
    }, 280);
    _cineDelay(() => { cineGoToShowcase(); }, 1000);
  }
}

// ---- SHOWCASE — Cal AI style landing (no chrome, static) ----
let _cineShowcaseTimers = [];
const CINE_SHOWCASE_ENTRANCE_MS = 1500; // must match .cine-phone's 0% -> 13.9% timing in style.css

// Video playback for the showcase phone mockup is driven here rather than
// via <video autoplay loop> — the video must start exactly when .cine-phone
// (style.css, @keyframes cinePhoneFly) finishes flying in and settles at
// center, not the instant that fly-in begins, so the very first thing
// visible once the phone is full-size is the TRUE start of the recording
// (picking the screenshot), not wherever it already played to mid-flight.
function _armCineShowcaseCycle() {
  _cineShowcaseTimers.forEach(clearTimeout);
  _cineShowcaseTimers = [];
  const video = document.getElementById('cine-showcase-video');
  if (!video) return;
  video.currentTime = 0;
  // iOS WebKit won't actually paint a video's first frame until play() has
  // been called at least once — a video that's only ever had .currentTime
  // set (never played) renders blank/white. That's why the very first loop
  // showed a white phone: this is the first time play() has ever been
  // called on this element. Kicking it off and immediately pausing forces
  // that first frame to render without visibly playing anything, since
  // this happens while the phone is still small/rotated mid-entrance.
  video.play().then(() => {
    video.pause();
    video.currentTime = 0;
  }).catch(() => {});
  // Guarded: this fires ~1s later, by which time the user may already have
  // left the showcase — without the check it starts the video playing on a
  // screen that is no longer on display, and nothing stops it again.
  _cineShowcaseTimers.push(setTimeout(() => {
    if (cineStep !== 'showcase') return;
    video.play().catch(() => {});
  }, CINE_SHOWCASE_ENTRANCE_MS));
}

function cineGoToShowcase() {
  _cineClearTimers();
  cineStep = 'showcase';
  cineSetChrome('none');
  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', s.dataset.screen === 'showcase');
  });
  _revealLazyImages(document.querySelector('.cine-screen.active'));
  const phone = document.querySelector('.cine-showcase .cine-phone');
  if (phone && !phone.dataset.cycleBound) {
    phone.dataset.cycleBound = '1';
    // .cine-phone's animation is `infinite` in CSS — it keeps looping
    // (including the ~1s gap at the end) with no JS needed to restart it;
    // animationiteration just fires at the start of every repeat so the
    // video can be re-armed for the new cycle.
    phone.addEventListener('animationiteration', _armCineShowcaseCycle);
  }
  _armCineShowcaseCycle();
  requestAnimationFrame(_cineSyncVideoPlayback);
}

// ================================================================
// CONVERSATIONAL ONBOARDING INTRO  (#cine-convo)
// A scripted, typewritten exchange that replaces the old step 1
// (name/photo/birth date) and step 2 (gender) as the way into onboarding.
// Flip CINE_CONVO_INTRO to false and "Get Started" goes back to step 1 —
// those steps are left intact in the markup, just not routed to.
// ================================================================
const CINE_CONVO_INTRO = true;

// Where the conversation hands off. The old step 1 (name/photo/birth date)
// and step 2 (gender) are skipped — the name is collected in the
// conversation itself — so "Be honest" (overthink, step 4) is the first
// question, and it is asked IN the conversation so it keeps the same
// typewriter + slide-in rhythm. Picking an answer leaves for step 5.
// Copy and options are lifted from that step's own markup, not reworded,
// so the two stay in sync if either is edited.
const CINE_CONVO_FIRST_STEP = 4;
const CINE_CONVO_NEXT_STEP  = 5;
const CINE_CONVO_FIRST_Q = {
  key: 'overthink',
  prompt: 'Be honest — how often do you overthink a text before sending it?',
  options: [
    { value: 'way-too-often', label: 'Way too often', icon: '😭' },
    { value: 'sometimes',     label: 'Sometimes',     icon: '🤔' },
    { value: 'pretty-often',  label: 'Pretty often',  icon: '🥺' },
    { value: 'almost-never',  label: 'Almost never',  icon: '😄' },
  ],
};

const CONVO = {
  charMs: 30,        // per character while typing
  revealMs: 14,      // per-character stagger of the question reveal, at most
  revealFadeMs: 200, // each character's own fade, and the tail after the last
  // Hard ceiling for a whole line. A fixed per-character stagger makes long
  // ledes crawl (step 6's ran ~1.6s), so the stagger is squeezed to fit this
  // budget when a line is long. Short lines still run at the full revealMs.
  revealMaxMs: 820,
  spaceMs: 14,       // spaces go quicker, so words land in clumps
  afterLineMs: 420,  // beat after a line finishes before the next starts
  nameLineMs: 180,   // "the name animation is quite quick"
  liftMs: 420,       // matches .cine-convo-stage's transition
  settleMs: 520,     // heading travelling from mid-screen to its resting spot
  pressMs: 170,      // how long Continue holds its pressed state before acting
  ageRowInMs: 300,   // the age row's slide-up, before the native wheel opens
  ageSettleMs: 540,  // how long the chosen age shows before the step moves on
  clearStaggerMs: 70,  // gap between rows as the stack empties
  clearOutMs: 260,     // matches .cine-convo-line--out's animation
  startAt: 0.42,     // where the FIRST line sits, as a fraction of the screen
  restAt: 0.62,      // where the newest line settles once the stack has grown
};

// Captured once when the conversation opens. Kept fixed rather than
// recomputed per line so the resting offset can't jump when the keyboard
// changes the viewport height — only the transform moves after that.
let _convoTopPx = 0;

// How far the stack has been pushed up, and the timers currently running —
// cleared whenever the intro is torn down so a re-entry can't double-type.
let _convoLift = 0;
let _convoTimers = [];
let _convoTyping = false;
// Set by a tap while a line is still typing: the rest of that line lands at
// once instead of waiting it out. Cleared when the line finishes, so one tap
// skips one line rather than the whole script.
let _convoSkip = false;
// True only while the conversation is handing over to a real step: the
// overlay must survive cineGoTo's teardown long enough to fade out over it.
let _convoHandingOff = false;
function _convoRequestSkip() {
  if (!_convoTyping) return false;
  _convoSkip = true;
  return true;
}

function _convoWait(ms) {
  return new Promise(res => { _convoTimers.push(setTimeout(res, ms)); });
}
function _convoClearTimers() {
  _convoTimers.forEach(clearTimeout);
  _convoTimers = [];
}

// One light tick per character. Spaces are skipped — a buzz on empty space
// reads as noise rather than as the letter landing.
function _convoTick(ch) {
  if (ch === ' ' || ch === '\n') return;
  navigator.vibrate?.(4);
  _cineHaptic('LIGHT');
}

// Keeps the newest line at a constant resting height by pushing the whole
// stage up by however much it has grown past the viewport's comfortable
// middle, instead of re-centring the block on every addition.
function _convoRelift() {
  const stage = document.getElementById('cine-convo-stage');
  const wrap  = document.getElementById('cine-convo');
  if (!stage || !wrap) return;
  // The stack starts at startAt (so the first line reads as centred) and is
  // only pulled up once its own growth would push the newest line past
  // restAt — so early lines sit in the middle rather than at the bottom.
  const bottom = _convoTopPx + stage.scrollHeight;
  _convoLift = Math.max(0, Math.round(bottom - wrap.clientHeight * CONVO.restAt));
  // Name step: the keyboard does not resize the page (Keyboard.resize is
  // 'none'), so Continue sat underneath it and the keyboard had to be closed
  // first. Lift far enough that the whole ask — Continue included — clears it.
  const kb = window.__zeloKbH || 0;
  if (kb && _convoNameResolve) {
    _convoLift = Math.max(_convoLift, Math.round(bottom - (wrap.clientHeight - kb - 18)));
  }
  stage.style.setProperty('--convo-lift', `-${_convoLift}px`);
}

async function _convoType(text, opts = {}) {
  const lines = document.getElementById('cine-convo-lines');
  if (!lines) return;
  lines.querySelectorAll('.cine-convo-line').forEach(el => el.classList.add('cine-convo-line--past'));

  const el = document.createElement('p');
  el.className = 'cine-convo-line cine-convo-caret' + (opts.accent ? ' cine-convo-line--accent' : '');
  lines.appendChild(el);
  _convoRelift();

  _convoTyping = true;
  _convoSkip = false;
  const per = opts.fast ? Math.max(8, CONVO.charMs / 2) : CONVO.charMs;
  for (let i = 0; i < text.length; i++) {
    if (_convoSkip) { el.textContent = text; break; }
    const ch = text[i];
    el.textContent += ch;
    _convoTick(ch);
    _convoRelift();
    await _convoWait(ch === ' ' ? CONVO.spaceMs : per);
  }
  el.classList.remove('cine-convo-caret');
  _convoRelift();
  _convoTyping = false;
  _convoSkip = false;
}

// Waits for a tap anywhere on the stage. The hint only appears if the user
// hasn't tapped within a moment, so a quick tapper never sees it.
let _convoTapResolve = null;
function cineConvoTap(e) {
  if (e && e.target.closest('.cine-convo-ask, .cine-convo-choices')) return;
  // While a line is still typing, a tap means "finish this line" — it must
  // not also be consumed as the tap-to-continue that comes later.
  if (_convoRequestSkip()) return;
  if (_convoTapResolve) { const r = _convoTapResolve; _convoTapResolve = null; r(); }
}
function _convoAwaitTap() {
  const hint = document.getElementById('cine-convo-hint');
  return new Promise(res => {
    _convoTapResolve = () => { if (hint) hint.hidden = true; res(); };
    _convoTimers.push(setTimeout(() => { if (hint && _convoTapResolve) hint.hidden = false; }, 900));
  });
}

// The keyboard's own Done/Return key had no handler, so a finished name
// could only be submitted by the button.
function cineConvoNameKey(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  cineConvoNameSubmit(e);
}

function cineConvoNameInput() {
  const input = document.getElementById('cine-convo-input');
  const cta   = document.getElementById('cine-convo-cta');
  if (cta) cta.disabled = !cineNameValid((input?.value || '').trim());
}

let _convoNameResolve = null;

// Continue does double duty: the first press takes the name and opens the
// native birth-date wheel on this same screen; once a date is set, the next
// press moves on. Keeping it one button is why the age row appears inline
// rather than on a screen of its own.
let _convoSubmitting = false;
async function cineConvoNameSubmit(e) {
  if (e) e.stopPropagation();
  if (_convoSubmitting) return;   // a tap outside and a tap on Continue can land together
  _convoSubmitting = true;
  try { await _convoNameSubmitInner(); } finally { _convoSubmitting = false; }
}
async function _convoNameSubmitInner() {
  const input = document.getElementById('cine-convo-input');
  const name  = (input?.value || '').trim();
  if (!cineNameValid(name)) return;

  if (!localStorage.getItem('zelo_user_age')) {
    input?.blur();
    // Three beats rather than one: the press registers, the age row slides
    // up into place, and only then does the native wheel come over it.
    // Opening the wheel straight off the tap gave no sign the button had
    // done anything and the sheet appeared out of nowhere.
    await _convoPressFeedback();
    _convoRevealAgeRow();
    await _convoWait(CONVO.ageRowInMs);
    await cineConvoPickAge();

    // Committing a date on the wheel IS the answer to this step — asking
    // for Continue again afterwards made it two presses to get past one
    // question. A short beat first so the value is seen landing in the row.
    // If the wheel was cancelled (or the date failed the 18+ gate) nothing
    // was stored, so this stays put and Continue simply reopens it.
    if (localStorage.getItem('zelo_user_age')) {
      await _convoWait(CONVO.ageSettleMs);
      _convoFinishName(name);
    }
    return;
  }
  await _convoPressFeedback();
  _convoFinishName(name);
}

function _convoFinishName(name) {
  if (!_convoNameResolve) return;
  const r = _convoNameResolve;
  _convoNameResolve = null;
  r(name);
}

// A short held-down state so a programmatic press reads as a press. :active
// alone only lasts as long as the finger is down, which on a quick tap is
// too brief to register before the screen changes under it.
async function _convoPressFeedback() {
  const cta = document.getElementById('cine-convo-cta');
  if (!cta) return;
  cta.classList.add('cine-convo-cta--pressed');
  await _convoWait(CONVO.pressMs);
  cta.classList.remove('cine-convo-cta--pressed');
}

// Brings the age row in with its own slide-up. One-shot: the class is
// stripped once it has played, never left on the element (2026-10-09j).
function _convoRevealAgeRow() {
  const row = document.getElementById('cine-convo-age');
  if (!row || !row.hidden) return;
  row.hidden = false;
  row.classList.add('cine-convo-age--empty', 'cine-convo-age--in');
  _convoRelift();
  _convoTimers.push(setTimeout(() => row.classList.remove('cine-convo-age--in'), 420));
}

// Opens the real native wheel (the same one Edit Details uses) and reflects
// whatever comes back onto the inline row.
async function cineConvoPickAge(e) {
  if (e) e.stopPropagation();
  await cineOpenAgeSheet();
  _convoRenderAge();
}

function _convoRenderAge() {
  const row   = document.getElementById('cine-convo-age');
  const value = document.getElementById('cine-convo-age-value');
  if (!row || !value) return;
  const age = localStorage.getItem('zelo_user_age');
  row.hidden = false;
  row.classList.toggle('cine-convo-age--empty', !age);
  value.textContent = age ? `${age}` : 'Tap to choose';
  _convoRelift();
  cineConvoNameInput();           // re-evaluate what Continue should be doing
}

async function _convoAskName() {
  const ask   = document.getElementById('cine-convo-ask');
  const input = document.getElementById('cine-convo-input');
  if (!ask || !input) return '';

  ask.hidden = false;
  _convoRelift();

  // Keeping the keyboard up by re-focusing on blur was wrong twice over: it
  // fought every tap outside (blur -> refocus -> the stack lifts and drops,
  // which read as jitter), and it stole focus from the Continue button on
  // its own mousedown, so the button could not be pressed at all.
  // Instead, nothing outside the input is allowed to take focus in the first
  // place — preventDefault on the press means the blur never happens, so a
  // tap outside genuinely does nothing.
  const holdFocus = (e) => {
    if (!_convoNameResolve) return;
    const t = e.target.closest ? e.target : null;
    if (t && t.closest('.cine-back')) return;                          // leaving: let it blur normally
    // Continue is handled on the PRESS, not the click. Pressing it used to blur
    // the input, the keyboard hid, the stack dropped back down and the button
    // moved out from under the finger before the click landed — so it took two
    // presses. Holding focus (preventDefault) keeps everything still.
    if (t && t.closest('.cine-convo-cta')) {
      e.preventDefault();
      if (cineNameValid((input.value || '').trim())) cineConvoNameSubmit();
      return;
    }
    if (t && t.closest('.cine-convo-ask')) return; // input and age row behave normally
    e.preventDefault();
    // Tapping outside does what Continue does (the button can sit under the
    // keyboard, so having to close it first was a dead end). With an
    // invalid/empty name it stays a no-op, as before.
    const typed = (input.value || '').trim();
    if (cineNameValid(typed)) cineConvoNameSubmit();
  };
  const wrap = document.getElementById('cine-convo');
  window.addEventListener('zelo-kb', _convoRelift);
  wrap?.addEventListener('mousedown', holdFocus);
  wrap?.addEventListener('touchstart', holdFocus, { passive: false });
  // Focus AFTER the stack has finished lifting. Focusing at 120ms put the
  // caret in the box while the box was still travelling, and the caret does
  // not ride a transform — it painted at the old spot and jumped to the new
  // one, which is the "teleports from the top" glitch.
  setTimeout(() => input.focus(), CONVO.liftMs + 40);

  const name = await new Promise(res => { _convoNameResolve = res; });

  wrap?.removeEventListener('mousedown', holdFocus);
  wrap?.removeEventListener('touchstart', holdFocus);
  window.removeEventListener('zelo-kb', _convoRelift);
  input.blur();
  ask.hidden = true;
  // Back down to where the stack sat before the keyboard pushed it up,
  // then the greeting lands and lifts it again.
  _convoRelift();
  await _convoWait(CONVO.liftMs);
  return name;
}

function _convoRenderChoices(opts, onPick) {
  const wrap = document.getElementById('cine-convo-choices');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.hidden = false;
  opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cine-convo-choice';
    b.innerHTML = `<span aria-hidden="true">${o.icon || ''}</span><span>${o.label}</span>`;
    b.onclick = (ev) => { ev.stopPropagation(); onPick(o, b); };
    wrap.appendChild(b);
    // Staggered slide-in, one-shot: the class is stripped once it has played.
    _convoTimers.push(setTimeout(() => {
      b.classList.add('cine-convo-choice--in');
      _convoTimers.push(setTimeout(() => {
        b.classList.remove('cine-convo-choice--in');
        b.classList.add('cine-convo-choice--shown');
      }, 460));
    }, 90 * i));
  });
  _convoRelift();
}

// Clears the conversation one row at a time, bottom row first and upward,
// so the stack empties the way it filled rather than vanishing at once.
async function _convoClearLines() {
  const lines = [...document.querySelectorAll('#cine-convo-lines .cine-convo-line')];
  for (let i = lines.length - 1; i >= 0; i--) {
    lines[i].classList.add('cine-convo-line--out');
    await _convoWait(CONVO.clearStaggerMs);
  }
  await _convoWait(CONVO.clearOutMs);
  const wrap = document.getElementById('cine-convo-lines');
  if (wrap) wrap.innerHTML = '';
  _convoRelift();
}

function cineConvoTeardown() {
  if (_convoHandingOff) return;
  _convoClearTimers();
  _convoTapResolve = null;
  _convoNameResolve = null;
  _convoTyping = false;
  _convoLift = 0;
  const wrap = document.getElementById('cine-convo');
  if (wrap) { wrap.hidden = true; wrap.classList.remove('cine-convo--out'); }
  const lines = document.getElementById('cine-convo-lines');
  if (lines) lines.innerHTML = '';
  const choices = document.getElementById('cine-convo-choices');
  if (choices) { choices.innerHTML = ''; choices.hidden = true; }
  const ask = document.getElementById('cine-convo-ask');
  if (ask) ask.hidden = true;
  const ageRow = document.getElementById('cine-convo-age');
  if (ageRow) ageRow.hidden = true;
  const hint = document.getElementById('cine-convo-hint');
  if (hint) hint.hidden = true;
  const stage = document.getElementById('cine-convo-stage');
  if (stage) { stage.style.removeProperty('--convo-lift'); stage.style.removeProperty('--convo-top'); }
  _convoTopPx = 0;
}

// ---- Question entrance: types the question on the REAL step page ----
// Set just before cineGoTo() hands off from the conversation. The step's own
// screen does the work, so the page the user lands on is the real one, not a
// rebuilt stand-in.
// ---- Question step entrance ----
// The page itself just appears — no typewriter, no reveal, no travel. The
// only motion is the choices arriving one after another from the top, which
// is what gives the step its "presentation" feel.
// Paced so each choice reads as its own arrival rather than the group
// appearing at once — a 55ms gap blurred them together.
const CINE_OPT_STAGGER_MS = 85;   // gap between one choice and the next
const CINE_OPT_ANIM_MS    = 340;  // each choice's own slide-in

// Still set by the conversation handoff so cineGoTo knows a question is
// coming, even though the entrance no longer treats that case differently.
let _cineQuestionEntrancePending = false;

// Own timer pool: this runs on a real step, after the conversation has
// handed over, so it must not be cancelled by cineConvoTeardown().
let _cineQTimers = [];
function _cineQClearTimers() {
  _cineQTimers.forEach(clearTimeout);
  _cineQTimers = [];
}

function cineRunQuestionEntrance() {
  _cineQuestionEntrancePending = false;
  _cineQClearTimers();

  const screen = document.querySelector('.cine-screen.active');
  const opts   = screen && screen.querySelector('.cine-opts');
  if (!opts) return;

  [...opts.children].forEach((btn, i) => {
    btn.classList.add('cine-opt--in');          // holds it hidden
    _cineQTimers.push(setTimeout(() => {
      btn.classList.add('cine-opt--playing');   // runs the slide-in
      // One-shot: both classes come off once it has played, so nothing
      // keeps an `animation` property that a reparent could replay
      // (2026-10-09j).
      _cineQTimers.push(setTimeout(() => {
        btn.classList.remove('cine-opt--in', 'cine-opt--playing');
      }, CINE_OPT_ANIM_MS + 40));
    }, CINE_OPT_STAGGER_MS * i));
  });
}

async function cineConvoStart() {
  cineConvoTeardown();
  const overlay = document.getElementById('cine-onboarding');
  if (overlay) { overlay.removeAttribute('hidden'); overlay.classList.remove('cine-out'); }
  cineSetChrome('phase1');          // no back/progress bar over the conversation
  const wrap = document.getElementById('cine-convo');
  if (!wrap) { cineGoTo(CINE_CONVO_FIRST_STEP); return; }
  wrap.hidden = false;

  const stage = document.getElementById('cine-convo-stage');
  // Anchored at restAt, not startAt: with the stack's bottom pinned there,
  // the opening line sits LOW and every line after it pushes the ones above
  // upward — which is the movement that was wanted, rather than the first
  // line simply appearing mid-screen and staying put.
  _convoTopPx = Math.round(wrap.clientHeight * CONVO.restAt);
  stage?.style.setProperty('--convo-top', `${_convoTopPx}px`);
  _convoRelift();

  await _convoWait(360);
  await _convoType("We'll help you text better.");
  await _convoWait(CONVO.afterLineMs);

  await _convoType("First, what's your name and age?");
  await _convoWait(260);

  const name = await _convoAskName();
  localStorage.setItem('zelo_display_name', name);
  cineAnswers.name = name;

  await _convoType(`Hi, ${name}.`, { accent: true, fast: true });
  await _convoWait(CONVO.nameLineMs);

  await _convoType("A few quick questions and I'll set Zelo up around how you actually text.");
  await _convoWait(260);

  await _convoAwaitTap();

  // The conversation's job ends here. It empties itself row by row, then the
  // REAL question step takes over — the question types itself in the middle
  // of that page and settles to the top with its own options sliding in
  // (cineRunQuestionEntrance), rather than this screen rebuilding a copy of
  // a page that already exists.
  await _convoClearLines();

  // Order matters. Fading the (now empty) conversation out FIRST revealed
  // whatever was underneath it — the showcase screen, video and all — for
  // the length of the fade, before cineGoTo swapped in the question. The
  // step is activated first now, so the fade uncovers the question itself
  // and the showcase is never on screen. `_convoHandingOff` stops
  // cineGoTo's own teardown from yanking the overlay away mid-fade.
  _cineQuestionEntrancePending = true;
  _convoHandingOff = true;
  cineGoTo(CINE_CONVO_FIRST_STEP);
  _convoHandingOff = false;

  const wrapEl = document.getElementById('cine-convo');
  wrapEl?.classList.add('cine-convo--out');
  await _convoWait(240);
  cineConvoTeardown();
}

function cineShowcaseStart(e) {
  if (e) e.stopPropagation();
  if (CINE_CONVO_INTRO) { cineConvoStart(); return; }
  cineGoTo(1);
}

// "Already have an account? Sign in" on the first screen. Has an account -> sign in,
// then straight into the app (not back to the onboarding screen underneath the sheet).
// No account ("New to Zelo? Get started", or a new Apple/Google account with no profile)
// -> onboarding.
// TEMP (testing): the front-slide "Sign in" stays in onboarding instead of entering the app,
// so you can sign in first (in Xcode/the simulator, no console needed) and then walk through
// onboarding manually while already signed in — onboarding_responses uploads live as you go,
// instead of only after the whole flow finishes. Flip to false to restore "sign in -> app".
const DEV_ONBOARDING_SIGNIN_STAYS = true;

function cineShowcaseSignIn(e) {
  if (e) e.stopPropagation();
  AUTH.startSignIn(DEV_ONBOARDING_SIGNIN_STAYS ? cineStayInOnboardingAfterSignIn : cineEnterAppAfterSignIn, cineShowcaseStart); // no account -> onboarding
}
// TEMP (testing) — see DEV_ONBOARDING_SIGNIN_STAYS above: the auth sheet is already closing
// (_hideAll(), called before this runs); doing nothing here just leaves whichever onboarding
// screen was underneath it showing, signed in.
function cineStayInOnboardingAfterSignIn() {}
function cineEnterAppAfterSignIn() {
  _cineClearTimers();
  // A returning user skips the intro entirely; marking it done first also keeps
  // cineFinishOnboardingLanding() from reporting an onboarding_finished analytics event.
  localStorage.setItem('zelo_onboarding_done', '1');
  cineFinishOnboardingLanding();
}

// ---- PHASE 2 navigation ----

// Both onboarding videos (the showcase demo and the trial screen's) are
// autoplay+loop, so they keep decoding frames on screens nobody is looking
// at — pure CPU and decoded-frame memory, on an app already measured near
// WebKit's image-memory ceiling. Pause whatever is off-screen and make sure
// whatever IS on screen is running. The visible one is explicitly played
// rather than just left alone, because a video paused while hidden will not
// restart on its own when its screen comes back (see the 2026-09 case where
// an entrance animation paused one permanently).
function _cineSyncVideoPlayback() {
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity <= 0.05) return false;
      if (n.hasAttribute && n.hasAttribute('hidden')) return false;
    }
    return true;
  };
  // Pause-only. Both screens choreograph their own playback — the showcase
  // deliberately holds its video paused through the phone's entrance, and
  // step 15 plays its own on entry — so forcing play() here fights them.
  // All this needs to do is stop videos nobody can see.
  document.querySelectorAll('video').forEach(v => {
    if (!onScreen(v) && !v.paused) v.pause();
  });
}

function cineGoTo(n) {
  _cineClearTimers();
  ZeloRecords.queueOnboarding(cineAnswers); // answers so far -> onboarding_responses (waits for sign-in)
  _cineTrackStep(cineStep, n);
  cineStep = n;
  // Entering any Phase 2 step must guarantee the overlay is actually up.
  // cineFinishPhase2() hides it when handing off to the paywall, so without
  // this a route back into onboarding would set a step "active" on an
  // overlay that is still display:none — an invisible, dead screen.
  const overlay = document.getElementById('cine-onboarding');
  if (overlay) { overlay.removeAttribute('hidden'); overlay.classList.remove('cine-out'); }
  // The conversational intro sits at z-index 1200 over every step, so any
  // route into a normal step has to take it down — otherwise the step is
  // live but invisible underneath it.
  if (typeof cineConvoTeardown === 'function') cineConvoTeardown();
  // #cine-preblack is an opaque white sheet at z-index 2000 that Phase 1
  // fades out on a 700ms timer. _cineClearTimers() above cancels that timer,
  // so any route into Phase 2 that runs before it fires would leave the sheet
  // up forever — a fully white screen with a live, hit-testable UI behind it
  // (it's pointer-events:none, so taps still work and nothing looks "broken"
  // to code, only to the eye). Force it out here rather than relying on the
  // timer having already run.
  document.getElementById('cine-preblack')?.classList.add('cine-preblack-out');
  cineSetChrome('phase2');

  const step = CINE_STEPS[n] || {};

  // Steps that run themselves (the setup/loading screen) hide the whole top
  // bar; everything else shows back + progress. Back is available from step 1
  // onward — on step 1 it returns to the showcase screen. Step 15 ("We want
  // you to try Zelo for free") is a dead end going backward on purpose — no
  // back button at all, not even to notifications — see cineBack().
  const topbar = document.getElementById('cine-topbar');
  if (topbar) topbar.classList.toggle('cine-hidden', !!step.noChrome);
  const backBtn = document.getElementById('cine-back');
  if (backBtn) backBtn.classList.toggle('cine-hidden', n === 15);

  const fill = document.getElementById('cine-progress-fill');
  // The conversational intro skips steps 1-3 entirely, so counting them
  // starts the bar a quarter full on the first question. Measure progress
  // over the steps the user will actually see.
  const skipped = (CINE_CONVO_INTRO && n >= CINE_CONVO_FIRST_STEP) ? CINE_CONVO_FIRST_STEP - 1 : 0;
  if (fill) fill.style.width = Math.max(0, Math.min(100, ((n - skipped) / (CINE_LAST - skipped)) * 100)) + '%';

  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', Number(s.dataset.screen) === n);
  });
  _revealLazyImages(document.querySelector('.cine-screen.active'));

  const nextBtn = document.getElementById('cine-next');
  if (nextBtn) {
    nextBtn.classList.toggle('cine-hidden', !!step.noCta);
    nextBtn.disabled = false;
    nextBtn.classList.remove('cine-next--disabled');
    // Pink is the progression colour used everywhere else; a small number of
    // trial/subscription-confirmation screens use black in the reference
    // instead (matches the same distinction real App Store onboarding flows
    // make between "keep going" and "you're now committing to something").
    nextBtn.classList.toggle('cine-next--dark', !!step.dark);
    nextBtn.innerHTML = (step.label || 'Continue') + (step.arrow ? ' <span class="cine-next-arrow">&rarr;</span>' : '');
  }

  // Re-paint any previously-given answers before evaluating the gate, so a
  // screen reached by Back shows its selection AND an unlocked CTA together.
  // Without this the answer still counts (it's in cineAnswers) but the pill
  // renders unselected, which reads as "my answer was lost".
  cineRestoreAnswers();

  if (!step.noCta) cineSetNextEnabled(step.enabledFn ? step.enabledFn() : true);

  if (step.entrance) step.entrance();

  // Last, and on the next frame: "is this video on screen" is only
  // answerable once the screen swap above has actually taken effect.
  requestAnimationFrame(_cineSyncVideoPlayback);
}

function cineSetNextEnabled(on) {
  const b = document.getElementById('cine-next');
  if (!b) return;
  b.disabled = !on;
  b.classList.toggle('cine-next--disabled', !on);
}

// Analytics (behavior only): step_completed when a numbered step is left going
// forward, step_abandoned when the app is backgrounded while a step is showing.
let _cineOpenStep = null, _cineStepSince = 0, _cineAbandonSent = false;
function _cineTrackStep(prev, n) {
  if (typeof prev === 'number' && prev >= 1 && typeof n === 'number' && n > prev) {
    ZeloAnalytics.track('step_completed', { step: prev });
  }
  if (typeof n === 'number') { _cineOpenStep = n; _cineStepSince = Date.now(); _cineAbandonSent = false; }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || _cineOpenStep === null || _cineAbandonSent) return;
  const overlay = document.getElementById('cine-onboarding');
  if (!overlay || overlay.hasAttribute('hidden') || localStorage.getItem('zelo_onboarding_done')) return;
  _cineAbandonSent = true;
  ZeloAnalytics.track('step_abandoned', { step: _cineOpenStep, time_spent_s: (Date.now() - _cineStepSince) / 1000 });
});

function cineNext() {
  if (cineStep === 0 || cineStep === 'showcase') return;  // non-interactive via this button
  const btn = document.getElementById('cine-next');
  if (btn?.disabled) return;

  if (cineStep === 1) cineCommitIntro();

  if (cineStep >= CINE_LAST) { cineFinishPhase2(); return; }
  cineGoTo(cineStep + 1);
}

// Step 11 (notifications) has no shared bottom CTA (CINE_STEPS[11].noCta) —
// the reference has no visible Continue on this screen at all, just the
// mockup permission dialog itself. Tapping the mockup's "Allow" is what
// fires the REAL native permission prompt, then advances automatically the
// instant it's answered (granted OR denied). The mockup buttons are
// disabled for that brief async gap only, to prevent a double-tap while
// the real dialog is up.
function cineRequestNotifAndAdvance() {
  const stepWhenTapped = cineStep;
  if (stepWhenTapped !== 11) return;
  const dialog = document.querySelector('.cine-sysprompt');
  dialog?.classList.add('cine-sysprompt--busy');
  Promise.resolve(requestNotifPermission()).finally(() => {
    dialog?.classList.remove('cine-sysprompt--busy');
    if (cineStep !== stepWhenTapped) return; // navigated away while waiting
    cineGoTo(stepWhenTapped + 1);
  });
}

// Back — available from step 1 onward; step 1 goes back to the showcase
// screen (there's nothing earlier within Phase 2 itself), everything else
// just steps back one. Doesn't touch any already-saved answers, so
// stepping forward again lands right back where the user left off.
// Back out of the conversation to the showcase, same as step 1's back button.
function cineConvoBack(e) {
  if (e) e.stopPropagation();
  document.getElementById('cine-convo-input')?.blur();
  cineConvoTeardown();
  cineGoToShowcase();
}

function cineBack(e) {
  if (e) e.stopPropagation();
  if (cineStep === 0 || cineStep === 'showcase') return;
  if (cineStep <= 1) { cineGoToShowcase(); return; }
  // With the conversational intro on, the flow enters at the first question
  // and steps 1-3 are never shown — so backing out of it must not land on
  // one of them. It returns to the showcase, the way step 1 does normally.
  if (CINE_CONVO_INTRO && cineStep === CINE_CONVO_FIRST_STEP) { cineGoToShowcase(); return; }
  // Step 12 (the "setting everything up" loading screen) can't be revisited
  // once its result has landed on step 13 — replaying a loading animation
  // backward doesn't mean anything.
  if (cineStep === 13) { cineGoTo(11); return; }
  // Step 15 ("We want you to try Zelo for free") is a dead end going
  // backward — no back at all, not even to save-your-progress. The button
  // itself is hidden here too (see cineGoTo()); this is the no-op fallback.
  if (cineStep === 15) return;
  cineGoTo(cineStep - 1);
}

// ================================================================
// STEP 1 — name / photo / age (all three genuinely interactive)
// ================================================================

function cineIntroReady() {
  return cineNameValid(cineCurrentNameValue()) && !!localStorage.getItem('zelo_user_age');
}

function cineRunIntroEntrance() {
  const input = document.getElementById('cine-name-input');
  const errEl = document.getElementById('cine-name-error');
  if (errEl) errEl.textContent = '';
  if (input) {
    const saved = localStorage.getItem('zelo_display_name');
    if (saved && !input.value) input.value = saved;
    // Deliberately NOT auto-focusing — popping the keyboard open before the
    // user taps anything shoves the whole screen up and hides the heading.
  }
  cineRenderPhoto();
  cineRenderAge();
  cineRefreshIntroChecks();
}

// Step 15's phone frame (.cine-trial-phone-wrap) got a fly-in entrance
// (cineTrialPhoneFlyIn, style.css) that starts it at opacity:0 and 70%
// scale before settling — plain <video autoplay loop> lost the plot there:
// WebKit can pause/refuse to start an autoplaying video while its container
// is invisible/scaled down like that, and with no JS ever telling it to
// resume, it just sits paused (reported as "starts at the end of the video
// and pauses" — whatever frame it stalled on, with loop unable to restart
// something that was never actually playing). Explicitly (re)calling
// .play() once this step becomes active — after currentTime is reset to 0,
// in case a stalled previous visit left it sitting mid/end-of-clip — makes
// playback resume reliably regardless of what the entrance animation did to
// visibility. .play() returns a promise that can reject if autoplay is
// blocked; harmless to ignore since the video is muted+playsinline, which
// every mobile browser's autoplay policy allows.
function cineRunTrialVideoEntrance() {
  const video = document.querySelector('.cine-trial-phone-video');
  if (!video) return;
  video.currentTime = 0;
  video.play().catch(() => {});
}

function cineRefreshIntroChecks() {
  const nameOk = cineNameValid(cineCurrentNameValue());
  const ageOk  = !!localStorage.getItem('zelo_user_age');
  const nc = document.getElementById('cine-name-check');
  const ac = document.getElementById('cine-age-check');
  if (nc) nc.hidden = !nameOk;
  if (ac) ac.hidden = !ageOk;
  cineSetNextEnabled(nameOk && ageOk);
}

function cineCommitIntro() {
  const name = cineCurrentNameValue();
  if (cineNameValid(name)) localStorage.setItem('zelo_display_name', name);
}

// ---- photo ----
function cinePickPhoto() {
  document.getElementById('cine-photo-input')?.click();
}

function cinePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('zelo_profile_photo', reader.result);
    cineRenderPhoto();
  };
  reader.readAsDataURL(file);
  event.target.value = ''; // let the same file be re-picked after a remove
}

// stopPropagation so tapping the X never also triggers the avatar's own
// onclick (which sits underneath it) and immediately reopens the picker.
function cineRemovePhoto(e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  localStorage.removeItem('zelo_profile_photo');
  cineRenderPhoto();
}

function cineRenderPhoto() {
  const data = localStorage.getItem('zelo_profile_photo');
  const img  = document.getElementById('cine-avatar-img');
  const ph   = document.getElementById('cine-avatar-ph');
  const del  = document.getElementById('cine-avatar-del');
  if (img) { if (data) { img.src = data; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; } }
  if (ph)  ph.hidden  = !!data;
  if (del) del.hidden = !data;
}

// ---- birth date — 3-column Month/Day/Year wheel, independent of the
// post-signup setup screen's own single-column #age-roller (that one still
// uses AUTH.initAgeRoller/readAge, services/auth.js, untouched). Stores the
// full date (zelo_birthdate, 'YYYY-MM-DD') AND the computed integer age
// (zelo_user_age) — every existing age-based reader (matching, filters,
// the profile row) keeps reading zelo_user_age exactly as before. ----
const DOB_YEAR_SPAN = 100; // oldest selectable birth year = today - this many years
// Where the wheel opens when nothing is stored yet.
const DOB_DEFAULT_DATE = '2008-07-17';
const DOB_MIN_AGE = 18;

// The age sheet is reachable from onboarding (which has #cine-age-warn to
// write into) AND from Edit Details inside the practice tutorial (which
// doesn't), so the refusal needs somewhere to show in both. Reuses the
// app's standard banner.
function _flashAgeGateToast(msg) {
  try {
    if (typeof flashLimitToast === 'function') { flashLimitToast(msg); return; }
  } catch {}
  if (typeof showChatToast === 'function') showChatToast(msg);
}

// Reads a CSS custom property's live, currently-resolved value straight off
// :root — used to hand the CURRENT theme's colors to native plugin calls
// (the date picker below) that live outside the web view's own CSS and so
// can't just inherit dark mode from style.css on their own.
function _cineThemeColor(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function _cineComputeAge(year, month, day) {
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthdayThisYear = (today.getMonth() + 1 < month) ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthdayThisYear) age--;
  return Math.max(0, age);
}

// Birth date — presents the REAL native iOS date picker (UIDatePicker,
// wheels style) via @capgo/capacitor-date-picker, instead of a hand-built
// scroll-snap recreation. Same trigger everywhere (index.html's
// #cine-age-field on the main onboarding form, and Edit Details' Age row in
// the practice tutorial both still just call cineOpenAgeSheet()) — the
// plugin itself owns the sheet, its scroll physics, and its Cancel/Done
// buttons, so there's no separate open/build/confirm/close cycle to keep in
// sync any more, just one round trip.
async function cineOpenAgeSheet() {
  const DatePicker = window.Capacitor?.Plugins?.DatePicker;
  if (!DatePicker) return; // no native bridge (plain web preview) — nothing to present

  const stored = localStorage.getItem('zelo_birthdate'); // 'YYYY-MM-DD'
  const today = new Date();
  // Fixed starting point rather than one derived from today's date, so the
  // wheel always opens on the same spot and sits mid-range for the ages
  // this app is actually for.
  const defaultDate = stored || DOB_DEFAULT_DATE;
  const yearMin = today.getFullYear() - DOB_YEAR_SPAN;

  let result;
  try {
    result = await DatePicker.present({
      mode: 'date',
      date: defaultDate,
      min: `${yearMin}-01-01`,
      max: today.toISOString().slice(0, 10),
      format: 'yyyy-MM-dd',
      title: 'When were you born?',
      doneText: 'Done', // plugin's own default is "OK" — old sheet said "Done"
      // Matches the old custom sheet's own frame exactly: cream panel, bold
      // near-black title, plain grey Cancel, filled pink Done pill (white
      // text), and a plain dim instead of a frosted blur behind it — same
      // values as .cine-sheet-card/.cine-sheet-title/.cine-btn/--accent/
      // --text-2/.cine-sheet-scrim in style.css. doneButtonBgColor/
      // cancelButtonBgColor/dimColor are patched-in additions to the
      // plugin's native iOS side (see node_modules/@capgo/capacitor-date-picker
      // — patched via patch-package, survives npm reinstalls) since the
      // published plugin only exposes one shared buttonBgColor for both
      // buttons and a hardcoded dark blur with no option to replace it.
      // This is a NATIVE UIDatePicker, entirely outside the web view's own
      // CSS — it can't just inherit dark mode from style.css, so these
      // colors are read live off the current --s1/--text/--text-2 tokens
      // (whatever they've already resolved to — system dark, an explicit
      // override, or plain light) right before presenting the sheet.
      ios: {
        style: 'wheels',
        // Without `theme`, the plugin defaults dark-mode detection to false
        // (DatePicker.swift: `dark = options.theme == "dark"`), forcing
        // `picker.overrideUserInterfaceStyle = .light` regardless of the
        // app's actual theme — and without `fontColor`, the wheel's own
        // scrolling month/day/year text has no explicit override, so it
        // falls back to that forced-light system default (black) even while
        // titleFontColor correctly turns the "When were you born?" header
        // white. Both are needed: theme fixes the wheel's native chrome,
        // fontColor fixes the wheel's own text the same way titleFontColor
        // already does for the title.
        theme: isDarkModeActive() ? 'dark' : 'light',
        bgColor: _cineThemeColor('--s1', '#fdf8f5'),
        titleBgColor: _cineThemeColor('--s1', '#fdf8f5'),
        titleFontColor: _cineThemeColor('--text', '#16130f'),
        fontColor: _cineThemeColor('--text', '#16130f'),
        buttonFontColor: _cineThemeColor('--text-2', '#8a8175'),
        doneButtonBgColor: '#ec4899',
        dimColor: '#00000073', // rgba(0,0,0,0.45) — a neutral dim, works as a backdrop in either theme
      },
    });
  } catch {
    return; // native call failed — leave the stored date untouched
  }
  if (!result?.value) return; // user tapped Cancel

  const [year, month, day] = result.value.split('-').map(Number);
  const age = _cineComputeAge(year, month, day);

  // Hard gate, not the soft "some features are limited" note this used to
  // show: a date that makes the user under 18 is not stored at all, so
  // whatever was there before stays, and the wheel can be reopened.
  if (age < DOB_MIN_AGE) {
    const warnEl = document.getElementById('cine-age-warn');
    const msg = `You must be ${DOB_MIN_AGE} or older to use Zelo.`;
    if (warnEl) warnEl.textContent = msg;
    _flashAgeGateToast(msg);
    return;
  }

  localStorage.setItem('zelo_birthdate', result.value);
  localStorage.setItem('zelo_user_age', String(age));
  cineRenderAge();
  cineRefreshIntroChecks();
  const warnEl = document.getElementById('cine-age-warn');
  if (warnEl) warnEl.textContent = '';
}

function cineRenderAge() {
  const age = localStorage.getItem('zelo_user_age');
  const el = document.getElementById('cine-age-value');
  if (el) {
    el.textContent = age || 'Tap to choose';
    el.classList.toggle('cine-field-value--empty', !age);
  }
  // Edit Details (practice tutorial) reuses this same age sheet — see
  // pedOpenAttractedSheet's sibling row, wired straight to
  // cineOpenAgeSheet() — so its own display needs the same refresh.
  const pedEl = document.getElementById('ped-age-val');
  if (pedEl) pedEl.textContent = age || '—';
}

// ================================================================
// STEPS 2-7 — question screens
// ================================================================

// Single-select: one answer replaces any previous one.
function cinePickOne(field, value, el) {
  cineAnswers[field] = value;
  localStorage.setItem('zelo_onb_' + field, value);
  // Bridges into the swipe-deck's own dating-pool preference / the "Who You
  // Practice With" settings panel, which already read and write this same
  // key ('women'/'men'/'both') — not a separate, disconnected answer.
  if (field === 'attracted') localStorage.setItem('zelo_practice_mode', value);
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.cine-opt').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  }
  cineSetNextEnabled(true);
}

// Multi-select ("pick any that apply"): toggles, and the CTA unlocks as soon
// as at least one is on.
function cinePickMany(field, value, el) {
  const list = cineAnswers[field] || [];
  const i = list.indexOf(value);
  if (i === -1) list.push(value); else list.splice(i, 1);
  cineAnswers[field] = list;
  localStorage.setItem('zelo_onb_' + field, JSON.stringify(list));
  if (el) el.classList.toggle('selected', list.includes(value));
  cineSetNextEnabled(list.length > 0);
}

// Re-paints the selected state from cineAnswers — needed because navigating
// back re-enters a screen whose buttons still carry (or have lost) .selected.
function cineRestoreAnswers() {
  document.querySelectorAll('#cine-opts-gender .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', ['male','female','other'][i] === cineAnswers.gender);
  });
  document.querySelectorAll('#cine-opts-source .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', ['instagram','tiktok','youtube','google','friends','other'][i] === cineAnswers.source);
  });
  document.querySelectorAll('#cine-opts-overthink .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', ['way-too-often','sometimes','pretty-often','almost-never'][i] === cineAnswers.overthink);
  });
  const help = cineAnswers.help || [];
  document.querySelectorAll('#cine-opts-help .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', help.includes(['what-to-say','keep-going','natural','flirting','confident'][i]));
  });
  document.querySelectorAll('#cine-opts-attracted .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', ['women','men','both'][i] === cineAnswers.attracted);
  });
  document.querySelectorAll('#cine-opts-tone .cine-opt').forEach((b, i) => {
    b.classList.toggle('selected', ['playful','chill','direct'][i] === cineAnswers.tone);
  });
  const referralInput = document.getElementById('cine-referral-input');
  if (referralInput && cineAnswers.referral && !referralInput.value) referralInput.value = cineAnswers.referral;
}

// ================================================================
// STEP 8 — referral code (optional, no shared CTA — see CINE_STEPS[8])
// ================================================================

// Apply just stores the code locally and confirms it — there's no
// redemption backend to validate it against yet (no referral-code lookup
// exists anywhere in the app), so this is honestly a "saved for later"
// action, not a real "your friend gets credit right now" one.
function cineReferralApply() {
  const input = document.getElementById('cine-referral-input');
  const msg   = document.getElementById('cine-referral-msg');
  const btn   = document.getElementById('cine-referral-apply-btn');
  const code  = (input?.value || '').trim();
  if (!code) { if (msg) msg.textContent = 'Enter a code first.'; return; }
  cineAnswers.referral = code;
  localStorage.setItem('zelo_onb_referral', code);
  if (msg) msg.textContent = 'Code applied!';
  btn?.classList.add('cine-referral-apply--active');
}

// Continue and Skip both just advance — the code is optional either way,
// so Skip isn't a separate branch, just a visually de-emphasized way to
// move on without typing anything.
function cineReferralContinue() {
  const input = document.getElementById('cine-referral-input');
  const code = (input?.value || '').trim();
  if (code && !cineAnswers.referral) {
    cineAnswers.referral = code;
    localStorage.setItem('zelo_onb_referral', code);
  }
  cineNext();
}

// ================================================================
// STEP 12 — "setting everything up" (auto-advances, no CTA)
// ================================================================

const CINE_SETUP_MS = 7200;

// Piecewise timeline (ms elapsed -> %), not a straight ramp — reads like a
// real loading bar: steady early progress, then a quicker push through
// 75-95 (including the 80-90 range specifically) straight into finishing —
// no flat hold anywhere. An earlier version paused dead at 90% for 1.5s to
// read as "stuck like a real loading bar" — removed on request: it read as
// slow/stalled rather than deliberate, and the 75-95 climb was also slower
// than wanted. Every segment still strictly increases; nothing holds flat.
const CINE_SETUP_SEGMENTS = [
  { end: 4500, from: 0,  to: 75  },
  { end: 6200, from: 75, to: 95  },
  { end: 7200, from: 95, to: 100 },
];
function _cineSetupPct(elapsedMs) {
  let prevEnd = 0;
  for (const seg of CINE_SETUP_SEGMENTS) {
    if (elapsedMs <= seg.end) {
      const segT = seg.end === prevEnd ? 1 : (elapsedMs - prevEnd) / (seg.end - prevEnd);
      return seg.from + (seg.to - seg.from) * segT;
    }
    prevEnd = seg.end;
  }
  return 100;
}

function cineRunSetupEntrance() {
  const numEl  = document.getElementById('cine-pct-num');
  const fillEl = document.getElementById('cine-setup-fill');
  const rows   = Array.from(document.querySelectorAll('#cine-setup-list .cine-setup-row'));
  rows.forEach(r => r.classList.remove('done'));
  if (fillEl) fillEl.style.width = '0%';
  if (numEl)  numEl.textContent = '1';

  const startedAt = Date.now();
  const startedOn = cineStep;
  let attFired = false;
  const tick = () => {
    // Bail out if the user navigated away mid-animation — otherwise this
    // keeps ticking against a screen that is no longer on-screen and then
    // advances the flow from underneath wherever they actually are.
    if (cineStep !== startedOn) return;
    const elapsed = Date.now() - startedAt;
    const t = Math.min(1, elapsed / CINE_SETUP_MS);
    const pct = Math.max(1, Math.round(_cineSetupPct(elapsed)));
    if (numEl)  numEl.textContent = String(pct);
    if (fillEl) fillEl.style.width = pct + '%';
    rows.forEach((r, i) => r.classList.toggle('done', t >= (i + 1) / rows.length));
    // Real native permission prompt, fired once as the bar passes ~20% —
    // mid-loading is where these mock "setting up" screens conventionally
    // slip a real permission ask in, rather than a separate dedicated screen.
    if (!attFired && pct >= 20) {
      attFired = true;
      requestTrackingPermission();
    }
    if (t < 1) { _cineDelay(tick, 40); return; }
    _cineDelay(() => { if (cineStep === startedOn) cineGoTo(startedOn + 1); }, 420);
  };
  tick();
}

// ================================================================
// STEP 13 — "Your Zelo Plan is ready" — reads cineAnswers (collected in
// steps 4-7) to fill in the tone card, focus bullets, and challenge
// description live. Previously this screen was fully hardcoded/decorative
// (see git history) with placeholder values that didn't reflect anything
// the user actually answered — this makes the screen's own claim ("Built
// around your goals") true. "Zelo will adapt to" (tone/goals/practice
// level) stays static on purpose — it's describing categories of ongoing
// adaptation, not a value to fill in.
// ================================================================

// tone -> icon/label/description for the "Your style" card. Falls back to
// 'playful' if the user somehow reached this screen without answering step
// 7 (shouldn't happen — CINE_STEPS[7].enabledFn requires cineAnswers.tone —
// but this screen shouldn't hard-fail if it ever does).
const CINE_PLAN_TONE_INFO = {
  playful: { label: 'Playful', desc: 'Light, fun and easygoing conversations.', icon: 'onb-plan-tone-playful.png' },
  chill:   { label: 'Chill',   desc: 'Relaxed and casual, like a natural back-and-forth.', icon: 'onb-plan-tone-chill.png' },
  direct:  { label: 'Direct',  desc: 'Straight to the point and confident.', icon: 'onb-plan-tone-direct.png' },
};

// help id -> the exact label its own option uses in step 5, so this screen
// never drifts out of sync with the question that produced the answer.
const CINE_PLAN_HELP_LABELS = {
  'what-to-say': 'Knowing what to say',
  'keep-going':  'Keeping conversations going',
  'natural':     'Sounding more natural',
  'flirting':    'Flirting without being awkward',
  'confident':   'Feeling more confident',
};

// overthink -> "Your challenge" description, used only for the
// 'way-too-often' overthinking case (see CINE_PLAN_CHALLENGE_INFO below) —
// the other tiers no longer force an "Overthinking" card when that isn't
// actually the user's main friction point.
const CINE_PLAN_OVERTHINK_DESC = {
  'almost-never':  "We'll help you stay confident, even on the rare occasion it happens.",
  'sometimes':     "We'll help you respond without getting stuck on every word.",
  'pretty-often':  "We'll help you respond without getting stuck on every word.",
  'way-too-often': "We'll help you stop getting stuck on every single word.",
};

// "Your challenge" card: overthinking only wins this slot when the user
// actually said it's a heavy problem ('way-too-often'); otherwise the card
// reflects their #1 pick from "what would you like help with" (step 5),
// so someone who barely overthinks doesn't get told overthinking is their
// challenge just because every user answers that question.
const CINE_PLAN_CHALLENGE_INFO = {
  'what-to-say': { title: 'Knowing what to say', desc: "We'll help you feel more confident when starting your replies.", icon: 'onb-help-what-to-say.png' },
  'keep-going':  { title: 'Keeping conversations going', desc: "We'll help you keep conversations natural and engaging.", icon: 'onb-help-keep-going.png' },
  'natural':     { title: 'Sounding natural', desc: "We'll help your replies feel more like you.", icon: 'onb-help-natural.png' },
  'flirting':    { title: 'Flirting naturally', desc: "We'll help you flirt without making your replies feel forced.", icon: 'onb-help-flirting.png' },
  'confident':   { title: 'Feeling more confident', desc: "We'll help you build confidence without forcing your replies.", icon: 'onb-help-confident.png' },
};

function cineRunPlanEntrance() {
  const planScreenEl = document.querySelector('.cine-screen[data-screen="13"]');
  if (planScreenEl) {
    planScreenEl.classList.remove('plan-entrance');
    void planScreenEl.offsetWidth; // force reflow so the animation replays every visit
    planScreenEl.classList.add('plan-entrance');
  }

  const tone = CINE_PLAN_TONE_INFO[cineAnswers.tone] ? cineAnswers.tone : 'playful';
  const toneInfo = CINE_PLAN_TONE_INFO[tone];
  const iconEl = document.getElementById('cine-plan-style-icon');
  if (iconEl) iconEl.src = 'assets/icons/onboarding/' + toneInfo.icon;
  const valueEl = document.getElementById('cine-plan-style-value');
  if (valueEl) valueEl.textContent = toneInfo.label;
  const descEl = document.getElementById('cine-plan-style-desc');
  if (descEl) descEl.textContent = toneInfo.desc;

  // Up to 2 shown — matches the reference mock and keeps the card a
  // consistent height regardless of how many the user actually picked
  // (step 5 is multi-select, 1-5 possible).
  const help = (cineAnswers.help && cineAnswers.help.length) ? cineAnswers.help : ['what-to-say', 'keep-going'];
  const listEl = document.getElementById('cine-plan-focus-list');
  if (listEl) {
    listEl.innerHTML = help.slice(0, 2).map(h =>
      `<li><span class="cine-plan2-dot"></span>${CINE_PLAN_HELP_LABELS[h] || h}</li>`
    ).join('');
  }

  const challengeIcEl = document.getElementById('cine-plan-challenge-ic');
  const challengeIconEl = document.getElementById('cine-plan-challenge-icon');
  const challengeValueEl = document.getElementById('cine-plan-challenge-value');
  const challengeDescEl = document.getElementById('cine-plan-challenge-desc');
  const topHelp = help[0];
  if (cineAnswers.overthink === 'way-too-often' || !CINE_PLAN_CHALLENGE_INFO[topHelp]) {
    if (challengeIconEl) challengeIconEl.src = 'assets/icons/onboarding/onb-plan-brain.png';
    if (challengeValueEl) challengeValueEl.textContent = 'Overthinking';
    if (challengeDescEl) challengeDescEl.textContent = CINE_PLAN_OVERTHINK_DESC[cineAnswers.overthink] || CINE_PLAN_OVERTHINK_DESC.sometimes;
    if (challengeIcEl) challengeIcEl.classList.remove('cine-plan2-ic--glyph');
  } else {
    const info = CINE_PLAN_CHALLENGE_INFO[topHelp];
    if (challengeIconEl) challengeIconEl.src = 'assets/icons/onboarding/' + info.icon;
    if (challengeValueEl) challengeValueEl.textContent = info.title;
    if (challengeDescEl) challengeDescEl.textContent = info.desc;
    // These are transparent glyph-only crops (from the step-5 help icons),
    // not the opaque cover-cropped tone/brain art -- need contain, not
    // cover, or their non-square padding gets clipped oddly.
    if (challengeIcEl) challengeIcEl.classList.add('cine-plan2-ic--glyph');
  }
}

// ================================================================
// STEP 14 — provider buttons are intentionally inert for now, and gated on
// the terms checkbox — this screen has no shared Continue at all
// (CINE_STEPS[14].noCta); tapping Apple/Google/email is the only way past
// it, and only once terms are agreed to.
// ================================================================

// Onboarding advance — step 14's provider buttons now run real account
// creation first (AUTH.startFromOnboarding) and only call this once a
// session exists (it used to be an inert stub that advanced regardless, so
// ordinary users finished onboarding signed out and every AI call was then
// rejected by the proxy's requireUser()).
function cineAuthStub() {
  if (cineStep >= CINE_LAST) { cineFinishPhase2(); return; }
  cineGoTo(cineStep + 1);
}

// Continuing IS the agreement (stated in the legal line under the buttons), so
// there is no checkbox to tick or warning to show any more.
function cineProviderTap(provider) {
  ZeloRecords.recordConsent('terms_and_privacy', true); // consent is recorded at the moment of continuing
  AUTH.startFromOnboarding(provider, cineAuthStub);
}

// ---- Screen 1 — name input (profanity-filtered, no bad/empty/space-only) ----
const NAME_BLOCKLIST = [
  'fuck','shit','bitch','asshole','bastard','cunt','dick','pussy',
  'nigger','nigga','fag','faggot','whore','slut','rape'
];

function cineCurrentNameValue() {
  return (document.getElementById('cine-name-input')?.value || '').trim();
}

// Tokenizes on any non-letter run so "classic" doesn't match "ass",
// but the whole word "ass" (as its own token) still does.
function cineNameHasProfanity(trimmed) {
  const tokens = trimmed.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some(t => NAME_BLOCKLIST.includes(t));
}

function cineNameValid(trimmed) {
  return trimmed.length >= 2 && !cineNameHasProfanity(trimmed);
}

function cineNameInput() {
  const raw     = document.getElementById('cine-name-input')?.value || '';
  const trimmed = raw.trim();
  const errEl   = document.getElementById('cine-name-error');

  if (trimmed.length > 0 && cineNameHasProfanity(trimmed)) {
    if (errEl) errEl.textContent = "That name isn't allowed. Try another.";
    cineSetNextEnabled(false);
    return;
  }
  if (errEl) errEl.textContent = '';

  const valid = cineNameValid(trimmed);
  if (valid) localStorage.setItem('zelo_display_name', trimmed);
  // Gating is shared with the age field — step 1 needs both, so defer to
  // cineRefreshIntroChecks() rather than toggling the CTA on the name alone.
  cineRefreshIntroChecks();
}

// ---- Screen 2 — interactive swipe demo (real drag, no auto-play) ----
// Populates Sophia's real profile card once, then wires the exact same
// drag physics the Home tab deck uses (attachDragListeners ->
// onDragStart/onDragMove/onDragEnd -> commitSwipe/springBack — see
// cineCommitDemoSwipe() below for what a completed swipe resolves to on
// this screen). Nothing here schedules or plays a scripted animation —
// the card only moves in response to actual touch/mouse input.
// Sequential index into PROFILES for the onboarding swipe demo — starts on
// Sophia, loops through the same 10 girls indefinitely on decline (see
// cineAdvanceSwipeQueue()) instead of ever running out.
let cineSwipeQueueIndex = null;
function cineSwipeQueueInit() {
  if (cineSwipeQueueIndex !== null) return;
  cineSwipeQueueIndex = PROFILES.findIndex(p => p.name === 'Sophia');
  if (cineSwipeQueueIndex < 0) cineSwipeQueueIndex = 0;
}

function cineRunSwipeEntrance() {
  const card = document.getElementById('cine-swipe-card');
  const backCard = document.getElementById('cine-swipe-card-back');
  if (!card || card.dataset.filled) return;

  // Real swipe-card content — reuses buildCardElement() (same component as
  // the Home tab deck) instead of a mocked-up card, populated with the
  // real Sophia persona. No photo wiring exists anywhere yet, so
  // .swipe-card-photo just renders its default solid block, same as it
  // would on the real deck.
  if (typeof PROFILES !== 'undefined' && PROFILES.length) {
    cineSwipeQueueInit();
    const front = PROFILES[cineSwipeQueueIndex];
    card.innerHTML = buildCardElement(front, 1).innerHTML;
    card.dataset.filled = '1';
    if (backCard) {
      const nextProfile = PROFILES[(cineSwipeQueueIndex + 1) % PROFILES.length];
      backCard.innerHTML = buildCardElement(nextProfile, 1).innerHTML;
      backCard.dataset.filled = '1';
    }
  }

  attachDragListeners(card);
  cineArmDragSmoothing(card);
  cineArmSwipeHint(card);
}

// Fixed-feel drag speed for the onboarding demo card — instead of the
// shared onDragMove's raw 1:1 snap-to-finger (see the id guard there), this
// eases the card's rendered position toward the live drag target every
// frame at a constant damping rate. A fast flick and a slow drag end up
// looking the same speed, since the card is always "catching up" to the
// finger rather than teleporting straight to it. Only the real-time follow
// is smoothed — release still hands off to the shared commitSwipe()/
// springBack() transitions untouched.
let _cineSmoothRAF = null;
function cineArmDragSmoothing(card) {
  const start = () => {
    if (_cineSmoothRAF) cancelAnimationFrame(_cineSmoothRAF);
    let visX = 0, visY = 0;
    const step = () => {
      if (!drag.active || drag.card !== card) { _cineSmoothRAF = null; return; }
      visX += (drag.currentX - visX) * 0.3;
      visY += (drag.currentY - visY) * 0.3;
      const ratio  = Math.max(-1, Math.min(1, visX / SWIPE_THRESHOLD));
      const rotate = ratio * MAX_ROTATION;
      card.style.transform = `translate(${visX}px, ${visY * 0.4}px) rotate(${rotate}deg)`;
      _cineSmoothRAF = requestAnimationFrame(step);
    };
    _cineSmoothRAF = requestAnimationFrame(step);
  };
  card.addEventListener('mousedown', start);
  card.addEventListener('touchstart', start, { passive: true });
}

// Gentle "try it" hint — nudges the card ~20% toward the like threshold and
// back, on loop (see .cine-swipe-hint-nudge), not a full auto-play demo.
// Stays on until the user actually engages, then is cancelled for good so
// it never fights with the real drag transform. Re-armed on the promoted
// card after a decline (see cineAdvanceSwipeQueue()).
function cineArmSwipeHint(card) {
  const tryHint = document.getElementById('cine-swipe-tryhint');
  card.classList.add('cine-swipe-hint-nudge');
  if (tryHint) tryHint.classList.add('cine-swipe-tryhint--in');
  const cancelHint = () => {
    card.classList.remove('cine-swipe-hint-nudge');
    if (tryHint) tryHint.classList.remove('cine-swipe-tryhint--in');
  };
  card.addEventListener('mousedown', cancelHint, { once: true });
  card.addEventListener('touchstart', cancelHint, { once: true, passive: true });
}

// X button — routes through the same fly-away + commit pipeline a real
// left-drag uses (commitSwipe -> transitionend -> cineCommitDemoSwipe),
// instead of a separate instant path, so tap and drag behave identically.
function cineSwipeDeclineTap(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('cine-swipe-card');
  if (!card) return;
  commitSwipe(card, 'left');
}

// Left swipe / X on the onboarding demo — instead of exiting onboarding,
// loop to the next of the same 10 girls (wrapping back to the start) and
// keep practicing the gesture. Promotes the existing back card to front
// (it's already built/positioned) rather than rebuilding from scratch.
function cineAdvanceSwipeQueue() {
  const stage = document.getElementById('cine-swipe-stage');
  const oldBack = document.getElementById('cine-swipe-card-back');
  if (!stage || !oldBack || typeof PROFILES === 'undefined' || !PROFILES.length) return;

  cineSwipeQueueInit();
  cineSwipeQueueIndex = (cineSwipeQueueIndex + 1) % PROFILES.length;

  oldBack.id = 'cine-swipe-card';
  oldBack.classList.remove('cine-swipe-card--back');

  // Animate the promotion instead of an instant snap: pin it at its old
  // scaled/offset/dimmed "back" look via inline style (removing the class
  // above would otherwise jump straight to the resting look with nothing
  // to transition from), force a reflow so the browser actually commits
  // that as a starting point, then transition to the resting front look —
  // slow and clearly visible (0.5s), not a quick blend, so it genuinely
  // reads as the next card slowly arriving rather than a swap.
  oldBack.style.transition = 'none';
  oldBack.style.transform  = 'scale(0.94) translate(-16px, 14px) rotate(-6deg)';
  oldBack.style.opacity    = '0.35';
  oldBack.style.filter     = 'saturate(0.85)';
  void oldBack.offsetWidth;
  oldBack.style.transition = 'transform 0.5s cubic-bezier(0.22,0.61,0.36,1), opacity 0.5s ease, filter 0.5s ease';
  oldBack.style.transform  = '';
  oldBack.style.opacity    = '';
  oldBack.style.filter     = '';
  attachDragListeners(oldBack);
  cineArmDragSmoothing(oldBack);

  // The hint-nudge is a CSS *animation*, which takes priority over a
  // running *transition* on the same property — arming it immediately
  // would hijack the promotion transition above. Wait for it to finish
  // (or for the user to just start dragging, which cancels the hint
  // itself via cineArmSwipeHint's own listeners regardless).
  oldBack.addEventListener('transitionend', () => {
    oldBack.style.transition = '';
    // Skip if the user already grabbed the card mid-transition — they've
    // engaged, so the hint would just fight the live drag transform.
    if (!(drag.active && drag.card === oldBack)) cineArmSwipeHint(oldBack);
  }, { once: true });

  const nextProfile = PROFILES[(cineSwipeQueueIndex + 1) % PROFILES.length];
  const newBack = document.createElement('div');
  newBack.className = 'cine-swipe-card cine-swipe-card--back';
  newBack.id = 'cine-swipe-card-back';
  newBack.innerHTML = buildCardElement(nextProfile, 1).innerHTML;
  newBack.dataset.filled = '1';
  stage.insertBefore(newBack, oldBack);
}

// commitSwipe()'s completion handler special-cases this card's id (see
// commitSwipe() below) and calls here instead of touching
// state.swipeProfiles/renderDeck() — this is a standalone two-card demo,
// not the real deck. Right swipe hands off to the real match screen
// (showMatchOverlay() / #screen-match, not a rebuilt one) with Sophia as
// the match, requiring a tap to continue onboarding (see
// cineShowMatchContinuePrompt()); left swipe loops to the next girl
// instead of exiting onboarding.
function cineCommitDemoSwipe(direction) {
  const card = document.getElementById('cine-swipe-card');
  if (card) card.remove();

  if (direction === 'right') {
    const sophia = PROFILES.find(p => p.name === 'Sophia') || PROFILES[0];
    const overlay = document.getElementById('cine-onboarding');
    if (overlay) overlay.setAttribute('hidden', '');

    // showMatchOverlay() mutates real app state (creates a chatStore entry,
    // sets state.character/activeChatId) — save what was there before so
    // this scripted demo match can be fully undone once onboarding
    // continues, instead of leaving a "Sophia" thread in the real Chats tab.
    const prevState = {
      character: state.character, difficulty: state.difficulty,
      replyIndex: state.replyIndex, activeChatId: state.activeChatId,
    };
    showMatchOverlay(sophia);
    cineShowMatchContinuePrompt(state.activeChatId, prevState);
  } else {
    cineAdvanceSwipeQueue();
  }
}

// Onboarding-only step layered onto the real match screen — not a real
// match (Start Chatting/Keep swiping are hidden), so the user taps
// anywhere on the screen to continue onboarding, same "tap the screen to
// advance" pattern the earlier match reveal used, instead of a timed
// auto-advance.
function cineShowMatchContinuePrompt(demoChatId, prevState) {
  const matchScreen = document.getElementById('screen-match');
  const content = matchScreen ? matchScreen.querySelector('.match-content') : null;
  if (!matchScreen || !content) return;

  const startBtn = matchScreen.querySelector('.match-start-btn');
  const skipBtn  = matchScreen.querySelector('.match-skip-btn');
  if (startBtn) startBtn.style.visibility = 'hidden';
  if (skipBtn)  skipBtn.style.visibility  = 'hidden';

  let caption = document.getElementById('cine-match-continue');
  if (!caption) {
    caption = document.createElement('div');
    caption.id = 'cine-match-continue';
    caption.className = 'cine-match-continue';
    caption.innerHTML = '<b>Swipe to match, then practice your replies in a real chat</b><span>Tap to continue</span>';
    content.appendChild(caption);
  }
  caption.style.display = '';

  const advance = () => {
    matchScreen.removeEventListener('click', advance);
    caption.style.display = 'none';
    if (startBtn) startBtn.style.visibility = '';
    if (skipBtn)  skipBtn.style.visibility  = '';

    // Undo the demo match — it only existed for this reveal, and should
    // never surface as a real thread in the Chats tab.
    const idx = chatStore.findIndex(c => c.id === demoChatId);
    if (idx !== -1) chatStore.splice(idx, 1);
    state.character    = prevState.character;
    state.difficulty   = prevState.difficulty;
    state.replyIndex   = prevState.replyIndex;
    state.activeChatId = prevState.activeChatId;

    popScreen();
    const overlay = document.getElementById('cine-onboarding');
    if (overlay) overlay.removeAttribute('hidden');
    // Swipe demo is not part of the current onboarding sequence; if it is
    // ever re-enabled, route back to whichever step hosts it here.
    cineGoToShowcase();
  };
  matchScreen.addEventListener('click', advance);
}

// ---- Step 9 — notification permission (the real native dialog) ----
function requestNotifPermission() {
  const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
  if (LocalNotifications) {
    return LocalNotifications.requestPermissions()
      .then(r => localStorage.setItem('zelo_notif_permission', r?.display || ''))
      .catch(() => {});
  }
  // Plain web (Netlify) fallback — no native runtime, use the browser API.
  try {
    if (window.Notification && typeof Notification.requestPermission === 'function') {
      return Promise.resolve(Notification.requestPermission()).catch(() => {});
    }
  } catch (_) {}
  return Promise.resolve();
}

// App Tracking Transparency. No screen in the current reference sequence
// asks for it, but the plugin is installed and this is the one call site —
// kept so re-adding an ATT screen is a markup + CINE_STEPS change only.
function requestTrackingPermission() {
  const ATT = window.Capacitor?.Plugins?.AppTrackingTransparency;
  if (!ATT) return Promise.resolve();  // no ATT equivalent on plain web
  return ATT.requestPermission()
    .then(r => localStorage.setItem('zelo_att_status', r?.status || ''))
    .catch(() => {});
}

// Phase 1 / showcase are non-interactive except their own dedicated buttons.
function cineNoop() {}

// ---- End of Phase 2 (step 13) — screen 14 ("Start your 3-day FREE trial")
// then, only if the user declines it (taps back), screen 14 (one-time
// offer). Screen 13 is a dedicated screen built to match the reference
// mockup exactly (see #screen-trial-start in index.html) — NOT the app's
// existing #screen-paywall, which stays in place only for the History tab's
// upgradeNow() entry point, a separate already-shipped feature. ----

// Reference-mockup values. Not a confirmed pricing decision — change here.
const TRIAL_ANNUAL_PRICE  = 'THB 83.25/mo';
const TRIAL_ANNUAL_NOTE   = 'THB 999.00 billed annually';
const TRIAL_ANNUAL_LEGAL  = '3 days free, then THB 999.00 per year.<br>Billed annually and renews automatically unless canceled in the App Store.';
const TRIAL_MONTHLY_PRICE = 'THB 399.00/mo';
const TRIAL_MONTHLY_LEGAL = '3 days free, then THB 399.00 per month.<br>Renews automatically unless canceled in the App Store.';
const OFFER_PCT = 78;
const OFFER_WAS = 'THB 2,999.00';
const OFFER_NOW = 'THB 699.00/year';

function cineFinishPhase2() {
  _cineClearTimers();
  ensureTrialStarted();
  // #screen-trial-start (like the paywall/offer screens) sits BELOW
  // #cine-onboarding (z-index 1000, opaque background). Leaving the
  // onboarding overlay up here makes it go .active while staying completely
  // invisible behind step 13 — so hide it before handing off.
  cineHideOverlay();
  cineShowTrialStart();
}

// Hides the onboarding overlay outright (no fade) — used when handing off to
// a .screen overlay that would otherwise be covered by it.
function cineHideOverlay() {
  _cineOpenStep = null; // onboarding steps are over — nothing left to "abandon"
  const overlay = document.getElementById('cine-onboarding');
  if (overlay) {
    overlay.setAttribute('hidden', '');
    overlay.classList.remove('cine-out');
  }
}

let _cineTrialPlan = 'annual';

function cineShowTrialStart() {
  ZeloAnalytics.track('paywall_viewed', { screen: 'trial_start', plan: 'annual', price: 'THB 999.00/year' });
  _cineTrialPlan = 'annual';
  cineSelectTrialPlan('annual');
  const img = document.getElementById('cine-trial-hero-img');
  if (img) {
    const gender = localStorage.getItem('zelo_onb_gender');
    img.src = gender === 'female' ? 'assets/icons/onboarding/onb-trial-start-female.png' : 'assets/icons/onboarding/onb-trial-start-male.png';
  }
  _replaceActiveScreen('trial-start');
}

function cineSelectTrialPlan(plan) {
  _cineTrialPlan = plan;
  const annualBtn  = document.getElementById('cine-trial-plan-annual');
  const monthlyBtn = document.getElementById('cine-trial-plan-monthly');
  annualBtn.classList.toggle('cine-trial-plan--selected', plan === 'annual');
  monthlyBtn.classList.toggle('cine-trial-plan--selected', plan === 'monthly');
  const legal = document.getElementById('cine-trial-legal');
  if (legal) legal.innerHTML = plan === 'annual' ? TRIAL_ANNUAL_LEGAL : TRIAL_MONTHLY_LEGAL;
}

function cineTrialStartContinue() {
  // Locked user: there is no purchase system yet, so "continue" just returns to the app (still locked).
  if (subscriptionExpired()) { popScreen(); return; }
  cineFinishOnboardingLanding();
}

// Tapping back on screen 15 is the route to the one-time offer — but only
// the FIRST time. Once the offer has already been shown once (user declined
// it, came back around through sign-up/notifications/trial-start again),
// showing it a second time doesn't make sense — back instead goes straight
// to "We want you to try Zelo for free" (step 15), skipping the offer
// entirely. See cineBack() for the matching step-15 skip on the way back
// further than that.
function cineTrialStartDecline() {
  if (subscriptionExpired()) { popScreen(); return; } // locked: back to the app, never into onboarding step 15
  if (localStorage.getItem('zelo_offer_shown')) {
    cineGoTo(15);
    return;
  }
  localStorage.setItem('zelo_offer_shown', '1');
  cineShowOffer();
}

function cineShowOffer() {
  ZeloAnalytics.track('paywall_viewed', { screen: 'offer', plan: 'annual', price: OFFER_NOW });
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('cine-offer-pct',  String(OFFER_PCT));
  set('cine-offer-pct2', String(OFFER_PCT));
  set('cine-offer-was',  OFFER_WAS);
  set('cine-offer-now',  OFFER_NOW);
  _replaceActiveScreen('offer');
}

function cineOfferClaim() { if (subscriptionExpired()) { popScreen(); return; } cineFinishOnboardingLanding(); }
// X on the one-time offer routes to step 15 ("We want you to try Zelo for
// free") — matching the intended flow: trial-start -> offer -> close ->
// step 15 -> trial reminder -> paywall. cineGoTo() re-shows #cine-onboarding
// itself (it force-clears `hidden` on every entry), covering this .screen
// overlay back up. Step 15 itself has no way back from here (see
// cineBack()) — this is a one-way door once you've seen the offer.
function cineOfferClose() { if (subscriptionExpired()) { popScreen(); return; } cineGoTo(15); }

// The real finish — only reached once the paywall (and, if shown, the
// one-time offer) has resolved.
function cineFinishOnboardingLanding() {
  ZeloRecords.queueOnboarding(cineAnswers);
  if (!localStorage.getItem('zelo_onboarding_done')) ZeloAnalytics.track('onboarding_finished');
  localStorage.setItem('zelo_onboarding_done', '1');
  // Instant, no fade — .cine-landing-loader (z-index 2000, above
  // #cine-onboarding's 1000) covers it immediately anyway, so animating
  // this hide separately would just be redundant motion underneath it.
  cineHideOverlay();
  _cineShowLandingLoader();
}

const CINE_LANDING_MS = 1200;

// Brief branded loading beat between onboarding finishing and Scan actually
// appearing (see .cine-landing-loader in index.html) — reuses the same
// progress-bar visual language as Step 10's "setting everything up" screen,
// just condensed to one line and much shorter (that one already ran once
// this session; repeating a full 10s wait here would be redundant).
function _cineShowLandingLoader() {
  const loader = document.getElementById('cine-landing-loader');
  const fill = document.getElementById('cine-landing-fill');
  if (!loader || !fill) {
    // Always run this — state.activeTab defaults to 'assistant' from page
    // load and nothing during onboarding's own separate screen system ever
    // changes it, so a "!== 'assistant'" guard here was always false and
    // showTab() never actually ran: #screen-trial-start stayed .active and
    // the tab bar stayed hidden, even though state *said* we were on Scan.
    showTab('assistant');
    return;
  }
  loader.hidden = false;
  loader.classList.remove('cine-landing-loader--out');
  fill.style.transition = 'none';
  fill.style.width = '0%';
  void fill.offsetWidth; // force reflow so the width reset above actually paints before animating
  fill.style.transition = `width ${CINE_LANDING_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  fill.style.width = '100%';

  _cineDelay(() => {
    loader.classList.add('cine-landing-loader--out');
    // Always run this — state.activeTab defaults to 'assistant' from page
    // load and nothing during onboarding's own separate screen system ever
    // changes it, so a "!== 'assistant'" guard here was always false and
    // showTab() never actually ran: #screen-trial-start stayed .active and
    // the tab bar stayed hidden, even though state *said* we were on Scan.
    showTab('assistant');
    _cineDelay(() => { loader.hidden = true; }, 300);
  }, CINE_LANDING_MS);
}

// Kept as the single "bail out of onboarding entirely" path. No screen in the
// current reference flow exposes it, but tour/debug entry points still call it.
function finishOnboardingNoPrompt() {
  _cineClearTimers();
  cineFinishOnboardingLanding();
}


// ================================================================
// SIGN-UP PROMPT — reusable full-screen overlay. Shown after onboarding
// Screen 5 and again (with different copy) from the Home-tab mode popup.
// ================================================================

// ================================================================
// HOME TAB — first-visit practice-mode popup
// ================================================================

function showHomeModePopup() {
  const el = document.getElementById('home-mode-popup');
  if (el) el.hidden = false;
}

function homeModeSelect(mode, el) {
  localStorage.setItem('zelo_practice_mode', mode);
  localStorage.setItem('zelo_mode_selected', '1');
  document.querySelectorAll('.home-mode-card-btn').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  navigator.vibrate?.(4);

  const popup = document.getElementById('home-mode-popup');
  if (popup) popup.hidden = true;

  initSwipeDeck();
}


// ================================================================
// WELCOME BACK — typewriter overlay for returning users (onboarding
// already completed). Fully automatic; no button, no tap.
// ================================================================

function maybeShowWelcomeBack() {
  if (!localStorage.getItem('zelo_onboarding_done')) return;
  const overlay = document.getElementById('welcome-back-overlay');
  const type    = document.getElementById('welcome-back-type');
  if (!overlay || !type) return;

  const name = localStorage.getItem('zelo_display_name');
  const text = name ? `Welcome back, ${name}.` : 'Welcome back.';

  overlay.hidden = false;
  overlay.classList.remove('welcome-back--out');
  type.textContent = '';

  let i = 0;
  function tick() {
    if (i < text.length) {
      type.textContent = text.slice(0, ++i);
      setTimeout(tick, 38);
    } else {
      setTimeout(() => {
        overlay.classList.add('welcome-back--out');
        setTimeout(() => { overlay.hidden = true; }, 400);
      }, 1000);
    }
  }
  tick();
}



// ================================================================
// SCAN BEGINNER POP-UP
// Shown once per session when the user first enters the Scan tab.
// Not persisted (testing phase).
// ================================================================

let scanIntroShown = false;

function maybeShowScanIntro() {}
function scanBeginnerYes() {}
function closeScanModal() {}




// ================================================================
// CHATS TAB
// ================================================================

// In-memory store of chat sessions. Starts empty; new matches are pushed here.
let chatStore = [];

function initChatsTab() {
  // Chats start empty — only real matches populate the store.
  renderChatsList();
}

function renderChatsList() {
  const list  = document.getElementById('chats-list');
  const empty = document.getElementById('chats-empty');
  if (!list) return;

  list.innerHTML = '';

  if (chatStore.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Pinned chats first; otherwise the store's own order (Array.sort is stable).
  [...chatStore].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).forEach(chat => {
    const profile = chat.profile;
    const grad = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-row-wrapper' + (chat.pinned ? ' chat-row-wrapper--pinned' : '');

    const row = document.createElement('div');
    row.className = 'chat-row' + (chat.pinned ? ' chat-row--pinned' : '');
    // A press that matured into the hold menu must not also open the chat when the finger lifts.
    row.onclick = () => { if (Date.now() - (row._heldAt || 0) < 700) return; openChatFromStore(chat); };
    row.innerHTML = `
      <div class="chat-row-avatar" style="background:${grad}">${profile.initial}${_pfpImgHTML(profile)}</div>
      <div class="chat-row-info">
        <div class="chat-row-top">
          <span class="chat-row-name">${profile.name}, ${profile.age}</span>
          <span class="chat-row-time">${chat.lastActive}</span>
        </div>
        <span class="chat-row-preview">${chat.lastMessage}</span>
      </div>
      ${chat.unread ? `<div class="chat-row-unread">${chat.unread}</div>` : ''}
    `;

    wrapper.appendChild(row);
    list.appendChild(wrapper);

    // No swipe-to-delete on chats: deleting is in the hold menu (Delete Chat, last).

    _attachChatRowHold(row, chat);
  });
}

// ================================================================
// CHATS — hold menu (Pin / Search / Reset / Delete) and search
// ================================================================
// Replaces the old hold-to-open settings sheet on a chat row. Holding a row
// buzzes, lifts the row and floats a small rounded menu beside it; Delete is
// always last and red. Search in Chat opens a sheet scoped to that chat; the
// search button in the Chats header opens the same sheet across every chat
// (names and messages).
const CHAT_ROW_HOLD_MS = 450;
const CHAT_SEARCH_KEY  = 'zelo_chat_recent_searches';

// Inline stroke icons, same family as the header's gear / back arrow. No pin,
// search or reset artwork exists in assets/ (checked chats-page/, Chats page/,
// misc/), so these are plain geometric strokes — swap for real art if supplied.
const _CR_SVG = (d, extra = '') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
const _CR_ICONS = {
  pin:    _CR_SVG('<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>'),
  search: _CR_SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  reset:  _CR_SVG('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  trash:  _CR_SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
  // Pinned marker: a filled accent circle with a white pin — big enough to read at a glance.
  pinBadge: '<span class="chat-row-pinbadge" aria-label="Pinned"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2h-4v8h-2v-8H7v-2l3-3z"/></svg></span>',
};

function _attachChatRowHold(row, chat) {
  let timer = null, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; row.classList.remove('chat-row--pressing'); };
  row.addEventListener('touchstart', (e) => {
    cancel();
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    row.classList.add('chat-row--pressing');
    timer = setTimeout(() => {
      timer = null;
      row.classList.remove('chat-row--pressing');
      row._heldAt = Date.now();
      // Buzz as the hold lands. navigator.vibrate alone is a no-op in WKWebView.
      navigator.vibrate?.(14);
      _cineHaptic('MEDIUM');
      openChatRowMenu(chat, row);
    }, CHAT_ROW_HOLD_MS);
  }, { passive: true });
  row.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) cancel();
  }, { passive: true });
  row.addEventListener('touchend', cancel, { passive: true });
  row.addEventListener('touchcancel', cancel, { passive: true });
}

let _crmEl = null;
function openChatRowMenu(chat, row) {
  closeChatRowMenu(true);
  const app = document.getElementById('app');
  if (!app || !row) return;
  const r = row.getBoundingClientRect();
  const o = document.createElement('div');
  o.className = 'crm-overlay';
  const clone = row.cloneNode(true);
  clone.classList.remove('chat-row--pressing');
  clone.removeAttribute('onclick');
  o.innerHTML = `
    <div class="crm-backdrop"></div>
    <div class="crm-lift"></div>
    <div class="crm-card" role="menu">
      <button type="button" class="crm-item" data-act="pin" role="menuitem">${_CR_ICONS.pin}<span>${chat.pinned ? 'Unpin Chat' : 'Pin Chat'}</span></button>
      <button type="button" class="crm-item" data-act="search" role="menuitem">${_CR_ICONS.search}<span>Search in Chat</span></button>
      <button type="button" class="crm-item" data-act="reset" role="menuitem">${_CR_ICONS.reset}<span>Reset Chat</span></button>
      <div class="crm-divider"></div>
      <button type="button" class="crm-item crm-item--danger" data-act="delete" role="menuitem">${_CR_ICONS.trash}<span>Delete Chat</span></button>
    </div>`;
  const lift = o.querySelector('.crm-lift');
  lift.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
  lift.appendChild(clone);
  app.appendChild(o);
  _crmEl = o;

  // Below the row, right-aligned; above it when there is no room (tab bar).
  const card = o.querySelector('.crm-card');
  const w = card.offsetWidth, h = card.offsetHeight;
  const below = r.bottom + 10 + h <= window.innerHeight - 96;
  const top = below ? r.bottom + 10 : Math.max(60, r.top - 10 - h);
  const left = Math.min(Math.max(16, r.right - w - 4), window.innerWidth - w - 16);
  card.style.left = left + 'px';
  card.style.top  = top + 'px';
  card.style.transformOrigin = `${Math.round(r.right - left)}px ${below ? '0' : '100%'}`;

  o.querySelector('.crm-backdrop').onclick = () => closeChatRowMenu();
  lift.onclick = () => closeChatRowMenu();
  card.querySelectorAll('.crm-item').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); _cineHaptic('LIGHT'); _chatRowAction(b.dataset.act, chat); };
  });
  void o.offsetWidth;
  requestAnimationFrame(() => o.classList.add('crm-overlay--in'));
}

function closeChatRowMenu(instant) {
  const o = _crmEl;
  if (!o) return;
  _crmEl = null;
  if (instant) { o.remove(); return; }
  o.classList.remove('crm-overlay--in');
  o.classList.add('crm-overlay--out');
  setTimeout(() => o.remove(), 200);
}

function _chatRowAction(act, chat) {
  closeChatRowMenu();
  if (act === 'pin') {
    chat.pinned = !chat.pinned;
    renderChatsList();
  } else if (act === 'search') {
    setTimeout(() => openChatSearch(chat), 180);
  } else if (act === 'reset') {
    setTimeout(() => _showChatConfirm('Reset chat?', 'This clears the whole conversation and starts fresh. This can’t be undone.', 'Reset', () => {
      state.activeChatId = chat.id; state.character = chat.profile; state.difficulty = chat.difficulty; state.mode = chat.mode;
      chatSettingsReset();
    }), 180);
  } else if (act === 'delete') {
    setTimeout(() => _showChatConfirm('Delete chat?', 'This permanently deletes this conversation. This can’t be undone.', 'Delete', () => onDeleteChat(chat.id)), 180);
  }
}

// ---- Search ----------------------------------------------------------------
let _chatSearchScope = null;   // a chat object, or null = every chat

function _recentSearches() {
  try { const a = JSON.parse(localStorage.getItem(CHAT_SEARCH_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function _saveRecentSearch(q) {
  q = (q || '').trim(); if (!q) return;
  const list = [q, ..._recentSearches().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  localStorage.setItem(CHAT_SEARCH_KEY, JSON.stringify(list));
}
function chatSearchRemoveRecent(i) {
  const l = _recentSearches(); l.splice(i, 1);
  localStorage.setItem(CHAT_SEARCH_KEY, JSON.stringify(l));
  _renderChatSearch();
}
function chatSearchClearAll() { localStorage.removeItem(CHAT_SEARCH_KEY); _renderChatSearch(); }
function chatSearchUseRecent(i) {
  const q = _recentSearches()[i]; if (q == null) return;
  const inp = document.getElementById('csearch-input'); inp.value = q;
  _renderChatSearch();
}

function openChatSearch(chat) {
  const o = document.getElementById('chat-search-overlay');
  if (!o) return;
  _chatSearchScope = chat || null;
  document.getElementById('csearch-title').textContent = chat ? 'Search in Chat' : 'Search';
  const inp = document.getElementById('csearch-input');
  inp.value = '';
  inp.placeholder = chat ? 'Search messages…' : 'Search messages or names…';
  const card = document.getElementById('csearch-card');
  card.style.transition = ''; card.style.transform = '';
  const scrim = o.querySelector('.csearch-scrim');
  if (scrim) { scrim.style.transition = ''; scrim.style.opacity = ''; }
  _renderChatSearch();
  o.hidden = false;
  void o.offsetWidth;
  o.classList.add('csearch-overlay--in');
  setTimeout(() => inp.focus(), 320);
}

function closeChatSearch() {
  const o = document.getElementById('chat-search-overlay');
  if (!o || o.hidden) return;
  document.getElementById('csearch-input').blur();
  o.classList.remove('csearch-overlay--in');
  setTimeout(() => { o.hidden = true; }, 300);
}

function onChatSearchInput() { _renderChatSearch(); }
function chatSearchClearField() { const i = document.getElementById('csearch-input'); i.value = ''; i.focus(); _renderChatSearch(); }

function _hiHTML(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return _escapeHtml(text);
  // Trim to a window around the match so a long message still shows the hit.
  const start = Math.max(0, i - 24);
  const end = Math.min(text.length, i + q.length + 60);
  return (start > 0 ? '…' : '') + _escapeHtml(text.slice(start, i))
    + '<mark>' + _escapeHtml(text.slice(i, i + q.length)) + '</mark>'
    + _escapeHtml(text.slice(i + q.length, end)) + (end < text.length ? '…' : '');
}

function _chatSearchResults(q) {
  const lq = q.toLowerCase();
  const chats = _chatSearchScope ? [_chatSearchScope] : chatStore;
  const people = _chatSearchScope ? [] : chatStore.filter(c => (c.profile.name || '').toLowerCase().includes(lq));
  const msgs = [];
  chats.forEach(c => (c.messages || []).forEach(m => {
    if (m.text && m.text.toLowerCase().includes(lq)) msgs.push({ chat: c, m });
  }));
  msgs.sort((a, b) => (b.m.time || 0) - (a.m.time || 0));
  return { people, msgs: msgs.slice(0, 60) };
}

function _csAvatar(profile, cls) {
  const grad = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  return `<div class="${cls}" style="background:${grad}">${profile.initial}${_pfpImgHTML(profile)}</div>`;
}

function _renderChatSearch() {
  const body = document.getElementById('csearch-body');
  const q = document.getElementById('csearch-input').value.trim();
  document.getElementById('csearch-clear').hidden = !document.getElementById('csearch-input').value;
  if (!q) {
    const rec = _recentSearches();
    body.innerHTML = rec.length ? `
      <div class="csearch-sec"><span>RECENT SEARCHES</span><button type="button" onclick="chatSearchClearAll()">Clear All</button></div>
      ${rec.map((t, i) => `
        <div class="csearch-recent" onclick="chatSearchUseRecent(${i})">
          ${_CR_ICONS.search}<span>${_escapeHtml(t)}</span>
          <button type="button" class="csearch-rm" aria-label="Remove" onclick="event.stopPropagation(); chatSearchRemoveRecent(${i})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>`).join('')}`
      : `<p class="csearch-empty">${_chatSearchScope ? 'Search this conversation.' : 'Search your messages and the people you’ve matched with.'}</p>`;
    return;
  }
  const { people, msgs } = _chatSearchResults(q);
  if (!people.length && !msgs.length) {
    body.innerHTML = `<p class="csearch-empty">No results for “${_escapeHtml(q)}”</p>`;
    return;
  }
  const idOf = (c) => chatStore.indexOf(c);
  body.innerHTML =
    (people.length ? `<div class="csearch-sec"><span>PEOPLE</span></div>` + people.map(c => `
      <button type="button" class="csearch-hit" onclick="chatSearchOpen(${idOf(c)})">
        ${_csAvatar(c.profile, 'csearch-av')}
        <span class="csearch-hit-text"><b>${_hiHTML(`${c.profile.name}, ${c.profile.age}`, q)}</b></span>
      </button>`).join('') : '')
    + (msgs.length ? `<div class="csearch-sec"><span>MESSAGES</span></div>` + msgs.map(({ chat, m }) => `
      <button type="button" class="csearch-hit" onclick="chatSearchOpen(${idOf(chat)}, '${m.id || ''}')">
        ${_csAvatar(chat.profile, 'csearch-av')}
        <span class="csearch-hit-text">
          <b>${_escapeHtml(chat.profile.name)}<i>${m.sender === 'user' ? ' · You' : ''}</i></b>
          <span>${_hiHTML(m.text, q)}</span>
        </span>
      </button>`).join('') : '');
}

function chatSearchOpen(chatIdx, msgId) {
  const chat = chatStore[chatIdx];
  if (!chat) return;
  _saveRecentSearch(document.getElementById('csearch-input').value);
  closeChatSearch();
  setTimeout(() => {
    openChatFromStore(chat);
    if (msgId) setTimeout(() => _scrollToMessage(msgId), 520);
  }, 200);
}

// Swipe the sheet down to dismiss — same mechanic as the AI Coach chat sheet
// (attachAiCoachChatSheetDragClose): a 6px deadzone, then the card follows the
// finger 1:1 with transitions off, the scrim fades with the drag, and release
// either continues straight into the close (past 110px, or a quick downward
// flick) or springs back. Arms anywhere on the sheet; the results list only
// arms it while scrolled to the very top, so a downward drag mid-list still
// scrolls the list instead of closing the sheet.
function _attachChatSearchDrag() {
  const o = document.getElementById('chat-search-overlay');
  const card = document.getElementById('csearch-card');
  const body = document.getElementById('csearch-body');
  const scrim = o && o.querySelector('.csearch-scrim');
  if (!o || !card || card._wired) return;
  card._wired = true;
  const DEADZONE = 6, CLOSE_PX = 110, FLICK = 0.5; // FLICK in px/ms
  let startY = 0, lastY = 0, lastT = 0, vel = 0, dy = 0, dragging = false, committed = false;

  card.addEventListener('touchstart', e => {
    if (o.hidden || !o.classList.contains('csearch-overlay--in')) return;
    if (body && body.contains(e.target) && body.scrollTop > 0) return;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp; vel = 0; dy = 0;
    dragging = true; committed = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!dragging) return;
    const y = e.touches[0].clientY;
    const raw = y - startY;
    if (!committed) {
      if (raw < -DEADZONE) { dragging = false; return; } // an upward drag is a scroll
      if (raw < DEADZONE) return;
      committed = true;
      startY = y; // start moving from here, so the card doesn't jump by the deadzone
      card.style.transition = 'none';
      if (scrim) scrim.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault(); // no list rubber-band under a close-drag
    dy = Math.max(0, y - startY);
    if (e.timeStamp > lastT) { vel = (y - lastY) / (e.timeStamp - lastT); lastY = y; lastT = e.timeStamp; }
    card.style.transform = `translateY(${dy}px)`;
    if (scrim) scrim.style.opacity = String(Math.max(0, 1 - dy / (card.offsetHeight || 1)));
  }, { passive: false });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (!committed) return;
    committed = false;
    if (dy > CLOSE_PX || (vel > FLICK && dy > 24)) {
      // Carry on from where the finger let go — never hand a frozen
      // transition:none card to the class-based close (see CLAUDE.md, the
      // AI Coach "stops, then goes down" entry).
      card.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
      card.style.transform = 'translateY(100%)';
      if (scrim) { scrim.style.transition = 'opacity 0.3s ease'; scrim.style.opacity = '0'; }
      closeChatSearch();
      setTimeout(() => {
        card.style.transition = 'none'; card.style.transform = '';
        if (scrim) { scrim.style.transition = ''; scrim.style.opacity = ''; }
        void card.offsetHeight;
        card.style.transition = '';
      }, 340);
    } else {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = '';
      if (scrim) { scrim.style.transition = 'opacity 0.25s ease'; scrim.style.opacity = ''; }
      setTimeout(() => { card.style.transition = ''; if (scrim) scrim.style.transition = ''; }, 320);
    }
    dy = 0; vel = 0;
  };
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', end);
}
window.addEventListener('zelo-kb', () => {
  document.getElementById('csearch-card')?.style.setProperty('--kb', (window.__zeloKbH || 0) + 'px');
});
document.addEventListener('DOMContentLoaded', _attachChatSearchDrag);

function openChatFromStore(chat) {
  _captureHistoryReturn();

  // Mark unread cleared
  chat.unread = 0;

  // Set up state as if we just matched
  state.character  = chat.profile;
  state.difficulty = chat.difficulty;
  state.mode       = chat.mode;
  state.replyIndex = chat.messages.filter(m => m.sender === 'ai').length % REPLIES[chat.difficulty].length;
  state.activeChatId = chat.id;
  _clearStagedReply(); // defensive — nothing from a previous chat should carry over


  // Replay messages (shared with the repaint after a "Delete for you")
  _rerenderChatMessages();
  _renderChatChips();
  _syncComposerButtons();
  setTimeout(_scheduleSuggestions, 700);   // after the screen is live

  setSendEnabled(true);
  pushScreen('chat');
  _forceChatRepaint();
  _trackPracticeStart(true);
  setTimeout(maybeShowPracticeReviewModal, 350);
  bindDevPaceToggle();
  // No auto-focus here — opening a chat (from the list, or from a match)
  // shouldn't pop the keyboard on its own; same reasoning as her replies
  // not doing it either (see doTypingAndReply()/startChat()'s own note).
}

// Appends a user bubble without status label (for replayed history)
function appendUserBubbleStatic(text, atTime, opts = {}) {
  const messages = document.getElementById('chat-messages');
  const row    = document.createElement('div');
  row.className = 'msg-row user';
  if (opts.id) row.dataset.msgId = opts.id;
  const wrap   = document.createElement('div');
  wrap.className = 'msg-wrap';
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));
  const timestamp = document.createElement('div');
  timestamp.className   = 'msg-timestamp';
  timestamp.textContent = formatTime(atTime);
  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(wrap);
  row.appendChild(createMsgAvatar(false));
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
}

// Save the current chat messages back to the store whenever a message is sent/received
// Plain incrementing counter, not Date.now() — a double/triple-text burst
// can land multiple messages within the same millisecond, and the id just
// needs to be unique within this session (chatStore is in-memory only,
// never persisted), not globally unique or sortable.
let _msgIdCounter = 0;
function _newMsgId() { return 'm' + (++_msgIdCounter); }

function syncChatToStore(text, sender, replyToId, chatId) {
  const targetId = chatId || state.activeChatId;
  if (!targetId) return null;
  const chat = chatStore.find(c => c.id === targetId);
  if (!chat) return null;
  const id = _newMsgId();
  const msg = { id, sender, text, time: Date.now() };
  if (replyToId) msg.replyToId = replyToId;
  chat.messages.push(msg);
  chat.lastMessage = text;
  chat.lastActive  = 'just now';
  return id;
}


// ================================================================
// PROFILE / DASHBOARD
// ================================================================

// Lifetime scan counter — the only thing recordScan() tracks now. Actual
// scan history lives in getThreads() (see screen-history / Account page's
// History section) — this used to duplicate it into a second flat array,
// which is why that array is gone.
let scanCount = parseInt(localStorage.getItem('zelo_scans') || '12', 10);

function recordScan() {
  scanCount++;
  localStorage.setItem('zelo_scans', scanCount);
  awardXP('scan');
}

function openDashboard() {
  const displayName = getDisplayName();
  document.getElementById('dash-name').textContent   = displayName;
  document.getElementById('dash-avatar').textContent = displayName.charAt(0).toUpperCase();

  // Stats — lifetime persisted counts (matchCount() survives reload; chatStore doesn't)
  document.getElementById('stat-scans').textContent   = scanCount;
  document.getElementById('stat-matches').textContent = matchCount();
  document.getElementById('stat-chats').textContent   =
    chatStore.filter(c => c.messages.length > 0).length;

  pushScreen('dashboard');
}

// ================================================================
// PAID STATUS / TRIAL
// No auth or paywall exists yet — isPaidUser() is a stub flag for testing.
// Trial start is stamped on first-ever app launch since there's no account
// creation moment yet to anchor it to.
// ================================================================

function isPaidUser() {
  return true;  // all features unlocked — paywall gates wired in later
}

// ── Expired-subscription LOCK (Cal AI style) ─────────────────────────────
// When the subscription has ended the app still opens and Home (Scan) stays visible, but
// everything that does something sends the user to the paywall. Still reachable while locked:
// Settings/Account and the Streak (Journey + badges — view only; nothing here updates it).
// There is no purchase system yet, so subscriptionExpired() is the ONE place a real entitlement
// (StoreKit receipt / server subscription row) plugs in later. Until then it is driven by
// DEV_SUBSCRIPTION or the temporary switch on Settings > Zelo Pro (localStorage zelo_dev_subscription).
const DEV_SUBSCRIPTION = 'active';               // 'active' | 'expired'  — TEMP testing default
const DEV_SHOW_SUBSCRIPTION_SWITCH = true;       // TEMP: the "simulate expired" row on Settings > Zelo Pro
function subscriptionExpired() {
  return (localStorage.getItem('zelo_dev_subscription') || DEV_SUBSCRIPTION) === 'expired';
}
const LOCKED_ALLOWED_SCREENS = new Set(['dashboard', 'refer-friends', 'journey', 'milestones', 'locked', 'paywall', 'trial-start', 'offer']);
function _lockedAllows(screenName) {
  return LOCKED_ALLOWED_SCREENS.has(screenName) || String(screenName).indexOf('settings-') === 0;
}
// Returns true when the feature may proceed; when locked, opens the paywall and returns false.
function subscriptionGate() {
  if (!subscriptionExpired()) return true;
  showLockedScreen();
  return false;
}

// Where every blocked tap lands: the screen recording (no trial copy). Continue -> the normal
// onboarding paywall (#screen-trial-start). X -> back to the locked app.
function showLockedScreen() {
  ZeloAnalytics.track('paywall_viewed', { screen: 'locked', plan: 'annual', price: 'THB 999.00/year' });
  _replaceActiveScreen('locked');
  const v = document.querySelector('#screen-locked video');
  if (v) { v.currentTime = 0; v.play().catch(() => {}); }
}
function lockedContinue() { cineShowTrialStart(); }
function lockedClose() { popScreen(); }
function devSetSubscriptionExpired(expired) {
  localStorage.setItem('zelo_dev_subscription', expired ? 'expired' : 'active');
  if (expired) state.activeTab = 'assistant'; // the locked app lives on Home
}
window.addEventListener('DOMContentLoaded', () => {
  const row = document.getElementById('dev-subscription-row');
  if (row) row.hidden = !DEV_SHOW_SUBSCRIPTION_SWITCH;
  const t = document.getElementById('toggle-dev-expired');
  if (t) t.checked = subscriptionExpired();
});

function ensureTrialStarted() {
  if (!localStorage.getItem('zelo_trial_start')) {
    localStorage.setItem('zelo_trial_start', String(Date.now()));
  }
}

function isWithinTrial() {
  const start = Number(localStorage.getItem('zelo_trial_start') || 0);
  const trialMs = FREE_LIMITS.trialDays * 24 * 60 * 60 * 1000;
  return Date.now() - start < trialMs;
}

// Cold mode (swipe card) and the 3rd "Cold mode" women-trial both gate on this.
function isColdAvailable() {
  return isPaidUser() || isWithinTrial();
}


// ================================================================
// SCAN LIMITS (free tier)
// zelo_scan_count IS the remaining-scans number shown to the user — not a
// "used today" tally to subtract from a cap. It is only ever touched in
// two places: decremented once per non-first-run Generate tap, and reset
// at app load when zelo_scan_date no longer matches today. Nothing else
// may write to either key.
// ================================================================

function todayKey() {
  return new Date().toDateString();
}

// Called exactly once, at app load (see DOMContentLoaded below). If the
// stored date still matches today, the stored count is left exactly as-is
// — restored, not touched. Only on a date mismatch does it reset to the
// daily cap and stamp today's date.
function initScanCountForToday() {
  // Migration: a previous version could leave a stale/corrupt value in
  // zelo_scan_count under today's date — in that case the date-match branch
  // below would faithfully "restore" the bad value instead of resetting it.
  // Catch that specific combination here, before the date comparison runs.
  // zelo_scan_exhausted distinguishes a legitimate 0 (user used all their
  // scans today) from a corrupt/missing 0 — only the latter is migrated.
  const storedCount = localStorage.getItem('zelo_scan_count');
  const storedDate = localStorage.getItem('zelo_scan_date');
  const isExhausted = localStorage.getItem('zelo_scan_exhausted') === '1';

  if (storedDate === todayKey() && !isExhausted && (storedCount === null || storedCount === 'null' || Number(storedCount) === 0)) {
    localStorage.setItem('zelo_scan_count', FREE_LIMITS.scansPerDay);
    return;
  }

  if (localStorage.getItem('zelo_scan_date') !== todayKey()) {
    localStorage.setItem('zelo_scan_date', todayKey());
    localStorage.setItem('zelo_scan_count', String(FREE_LIMITS.scansPerDay));
    localStorage.setItem('zelo_ad_used_today', '0');
    localStorage.setItem('zelo_scan_exhausted', '0');
  }
}

function scansRemainingToday() {
  if (isPaidUser()) return Infinity;
  return Number(localStorage.getItem('zelo_scan_count') || 0);
}

function adUsedToday() {
  return localStorage.getItem('zelo_ad_used_today') === '1';
}

// The other of the two places zelo_scan_count is allowed to change — one
// decrement per non-first-run Generate tap, never below 0.
function decrementScanCount() {
  const remaining = scansRemainingToday();
  if (remaining > 0) {
    const newCount = remaining - 1;
    localStorage.setItem('zelo_scan_count', String(newCount));
    if (newCount === 0) {
      localStorage.setItem('zelo_scan_exhausted', '1');
    }
  }
  refreshScanLimitBanner();
}

// Mocked rewarded video — no ad SDK yet, watching it just adds +3 directly
// to today's remaining count. User-initiated only, never forced.
function watchRewardedAd() {
  if (adUsedToday()) return;
  ZeloAnalytics.track('ad_watched');
  localStorage.setItem('zelo_ad_used_today', '1');
  localStorage.setItem('zelo_scan_count', String(scansRemainingToday() + FREE_LIMITS.bonusScansPerAd));
  refreshScanLimitBanner();
}

function refreshScanLimitBanner() {
  const banner = document.getElementById('scan-limit-banner');
  const text   = document.getElementById('scan-limit-text');
  const adBtn  = document.getElementById('scan-limit-ad-btn');
  if (!banner) return;

  if (isPaidUser()) {
    banner.hidden = true;
    return;
  }

  const remaining = scansRemainingToday();
  banner.hidden = false;
  text.textContent = remaining > 0
    ? `${remaining} scan${remaining === 1 ? '' : 's'} left today`
    : 'No scans left today';
  adBtn.hidden = !(remaining <= 0 && !adUsedToday());
}


// ================================================================
// MATCH LIMITS (free tier)
// 3 chats started, ever — gates entry to the chat screen via "Start
// Chatting", not swiping/matching. Deleting a chat does NOT restore the
// slot — tracked separately from the live chatStore.
// ================================================================

function matchCount() {
  return Number(localStorage.getItem('zelo_match_count') || 0);
}

function incrementMatchCount() {
  localStorage.setItem('zelo_match_count', String(matchCount() + 1));
}

// Small non-blocking toast for the "out of matches" case — no extra screen.
function flashLimitToast(message) {
  const app = document.getElementById('app');
  const toast = document.createElement('div');
  toast.className = 'limit-toast';
  toast.innerHTML = `<span class="limit-toast-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="11" x2="12" y2="17"/><line x1="12" y1="7" x2="12.01" y2="7"/></svg>
    </span><span class="limit-toast-text"></span>`;
  toast.querySelector('.limit-toast-text').textContent = message;
  app.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 340); }, 2400);
}


// ================================================================
// CHAT TIMESTAMPS (iMessage-style)
// ================================================================

function formatTime(atTime) {
  const d = new Date(atTime || Date.now());
  const isToday = d.toDateString() === new Date().toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return timeStr;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()] + ' ' + timeStr;
}


// ================================================================
// SET THE PACE — HIDDEN DEV TOGGLE
// Safety net only: lets the timing choice be reverted mid-chat without a
// real settings screen. Buried behind a long-press on the chat profile
// block's name text so it's never a visible, prominent control.
// ================================================================

let devPaceLongPressTimer = null;

function bindDevPaceToggle() {
  // Re-anchored to the profile block's name text — the status pill it used
  // to hang off no longer exists (see .chat-profile-block); same "buried
  // behind a long-press on unobtrusive header text" spirit as before.
  const statusEl = document.getElementById('chat-profile-name');
  if (!statusEl || statusEl.dataset.devBound) return;
  statusEl.dataset.devBound = '1';

  const start = () => { devPaceLongPressTimer = setTimeout(resetChatPace, 600); };
  const cancel = () => clearTimeout(devPaceLongPressTimer);

  statusEl.addEventListener('mousedown',  start);
  statusEl.addEventListener('touchstart', start, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt =>
    statusEl.addEventListener(evt, cancel)
  );
}

function resetChatPace() {
  if (!document.getElementById('screen-chat').classList.contains('active')) return;
  state.chatModePending = null;
  updateChatModeOptionUI();
  document.getElementById('chat-mode-modal').hidden = false;
}


// ================================================================
// UTILITY
// ================================================================

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


// ================================================================
// FEATURE 7 — MATCH SLOT RESTORE
// Free users get 3 slots total. Deleting a chat schedules a restore
// after 10 days (never immediate). Paid users: unlimited, skip all.
// ================================================================

function matchSlots() {
  const v = localStorage.getItem('zelo_match_slots');
  return v === null ? FREE_LIMITS.maxMatches : Number(v);
}

function decrementMatchSlots() {
  const s = matchSlots();
  if (s > 0) localStorage.setItem('zelo_match_slots', String(s - 1));
}

function initMatchSlots() {
  if (localStorage.getItem('zelo_match_slots') === null) {
    localStorage.setItem('zelo_match_slots', String(FREE_LIMITS.maxMatches));
  }
  if (isPaidUser()) return;
  const deleted   = JSON.parse(localStorage.getItem('zelo_deleted_matches') || '[]');
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
  const now       = Date.now();
  const toRestore = deleted.filter(ts => now - new Date(ts).getTime() > tenDaysMs);
  const remaining = deleted.filter(ts => now - new Date(ts).getTime() <= tenDaysMs);
  if (toRestore.length > 0) {
    const newSlots = Math.min(FREE_LIMITS.maxMatches, matchSlots() + toRestore.length);
    localStorage.setItem('zelo_match_slots', String(newSlots));
    localStorage.setItem('zelo_deleted_matches', JSON.stringify(remaining));
  }
}

function onDeleteChat(chatId) {
  const idx = chatStore.findIndex(c => c.id === chatId);
  if (idx < 0) return;
  chatStore.splice(idx, 1);
  if (!isPaidUser()) {
    const deleted = JSON.parse(localStorage.getItem('zelo_deleted_matches') || '[]');
    deleted.push(new Date().toISOString());
    localStorage.setItem('zelo_deleted_matches', JSON.stringify(deleted));
  }
  renderChatsList();
}


// ================================================================
// FEATURE 8 — AI GIRL DAILY SCHEDULE (realistic mode only)
// Time windows shape reply speed. Night = offline; replies queued
// until 6am. Daytime has one per-session 90-min silent gap.
// ================================================================

function getTimeWindow() {
  const h = new Date().getHours();
  if (h >= 6  && h < 9)  return 'morning';
  if (h >= 9  && h < 18) return 'daytime';
  if (h >= 18 && h < 23) return 'evening';
  return 'night';
}

function msUntil6am() {
  const now   = new Date();
  const next6 = new Date(now);
  next6.setHours(6, 0, 0, 0);
  if (now.getHours() >= 6) next6.setDate(next6.getDate() + 1);
  return next6.getTime() - now.getTime();
}

function adjustTimingForWindow(timing, window) {
  const adj = { ...timing };
  if (window === 'morning') {
    adj.seenMin  = 3 * 60 * 1000;
    adj.seenMax  = 8 * 60 * 1000;
    adj.typingMin = timing.typingMin;
    adj.typingMax = Math.min(timing.typingMax, 6000);
  } else if (window === 'evening') {
    adj.seenMin  = Math.max(1000, Math.round(timing.seenMin * 0.4));
    adj.seenMax  = Math.max(3000, Math.round(timing.seenMax * 0.4));
    adj.typingMax = Math.round(timing.typingMax * 1.3);
  }
  return adj;
}

function initSilentGap() {
  if (state.silentGapStart !== null) return;
  const offsetMs = Math.floor(Math.random() * 4 * 60 * 60 * 1000);
  state.silentGapStart = Date.now() + offsetMs;
  state.silentGapEnd   = state.silentGapStart + 90 * 60 * 1000;
}

function isInSilentGap() {
  if (!state.silentGapStart || !state.silentGapEnd) return false;
  const now = Date.now();
  return now >= state.silentGapStart && now < state.silentGapEnd;
}


// ================================================================
// FEATURE 5 — SCAN HISTORY THREADS
// Each thread stores the person's name and all scans tagged to them.
// Free users get 2 threads permanently; slots don't restore on delete.
// ================================================================

function getThreads() {
  try { return JSON.parse(localStorage.getItem('zelo_threads') || '[]'); }
  catch { return []; }
}
function saveThreads(arr) { localStorage.setItem('zelo_threads', JSON.stringify(arr)); }
function getThreadCount()  { return Number(localStorage.getItem('zelo_thread_count') || 0); }
function setThreadCount(n) { localStorage.setItem('zelo_thread_count', String(n)); }

// Returns the thread object if save succeeds, or null with a reason string.
function saveToThread(name, message, reply) {
  const threads = getThreads();
  const norm    = name.trim();
  if (!norm) return { error: 'Enter a name first.' };

  let thread = threads.find(t => t.name.toLowerCase() === norm.toLowerCase());
  if (!thread) {
    const count = getThreadCount();
    // DEV — restore paid gate before release
    if (!isPaidUser() && count >= 2) {
      return { error: "You've hit your maximum threads. Delete one to make room or upgrade for unlimited." };
    }
    thread = { id: 'thread_' + Date.now(), name: norm, createdAt: Date.now(), scans: [], chat: [] };
    threads.unshift(thread);
    setThreadCount(count + 1);
  }

  thread.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
  saveThreads(threads);
  return { thread };
}

function deleteThread(threadId) {
  const threads = getThreads().filter(t => t.id !== threadId);
  saveThreads(threads);
  // Fix 7: drop the AI Coach link if it pointed at the deleted thread
  if (getLinkedThreadId() === threadId) setLinkedThreadId(null);
  renderThreadList();
  refreshAiCoachCard();
}

// ================================================================
// HISTORY — long-press row actions (Rename/Delete), same sheet/handle
// treatment as AI Coach's own chat-history rows (see openAiCoachRowActions()
// above) — added because swipe-to-delete alone isn't discoverable; a user
// who's never swiped a row has no way to find it. Deliberately separate
// from that one rather than reusing it: this operates on the thread itself
// (its real .name field, deleteThread() removing it entirely), where AI
// Coach's version only clears that thread's coaching-chat side and never
// touches its saved scans.
// ================================================================
let _historyActionsTargetId = null;

function openHistoryRowActions(id) {
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  _historyActionsTargetId = id;
  document.getElementById('history-row-actions-title').textContent = thread.name;
  document.getElementById('history-row-actions-overlay').hidden = false;
}

function closeHistoryRowActions() {
  document.getElementById('history-row-actions-overlay').hidden = true;
  _historyActionsTargetId = null;
}

function historyRowActionsRename() {
  const id = _historyActionsTargetId; // keep it set — the rename overlay reuses it
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  document.getElementById('history-row-actions-overlay').hidden = true;
  const input = document.getElementById('history-rename-input');
  input.value = thread.name;
  document.getElementById('history-rename-overlay').hidden = false;
  setTimeout(() => input.focus(), 60);
}

function closeHistoryRenamePrompt() {
  document.getElementById('history-rename-overlay').hidden = true;
  _historyActionsTargetId = null;
}

function historyRenameConfirm() {
  const id = _historyActionsTargetId;
  const input = document.getElementById('history-rename-input');
  if (!id || !input) return;
  const threads = getThreads();
  const thread  = threads.find(t => t.id === id);
  if (thread) {
    const name = input.value.trim();
    if (name) thread.name = name;
    saveThreads(threads);
  }
  closeHistoryRenamePrompt();
  renderHistory();
}

function historyRowActionsDelete() {
  const id = _historyActionsTargetId;
  if (!id) return;
  closeHistoryRowActions();
  deleteThread(id);
  renderHistory();
}

// + button: check free-tier slot then show inline name input
function openAddThread() {
  const count = getThreadCount();
  if (!isPaidUser() && count >= 2) {
    const modal = document.getElementById('thread-upgrade-modal');
    if (modal) modal.hidden = false;
    return;
  }

  // If an input row is already open, just focus it
  const existing = document.getElementById('thread-new-input-row');
  if (existing) { existing.querySelector('input')?.focus(); return; }

  const listEl = document.getElementById('thread-list');
  const newBtn = listEl?.querySelector('.thread-edit-new-btn');
  if (!listEl) return;

  const row = document.createElement('div');
  row.id = 'thread-new-input-row';
  row.className = 'thread-new-input-row';
  row.innerHTML = `
    <input class="thread-save-input thread-new-name-input"
           type="text" placeholder="Thread name…" autocomplete="off" maxlength="50" enterkeyhint="done" />
    <button class="thread-save-btn" type="button">Add</button>
  `;

  const input = row.querySelector('input');
  const addBtn = row.querySelector('button');

  function commit() {
    const name = input.value.trim();
    row.remove();
    if (!name) return;
    const threads = getThreads();
    if (!threads.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      const thread = { id: 'thread_' + Date.now(), name, createdAt: Date.now(), scans: [], chat: [] };
      threads.unshift(thread);
      setThreadCount(count + 1);
      saveThreads(threads);
    }
    renderThreadList();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { row.remove(); }
  });
  addBtn.addEventListener('click', commit);

  if (newBtn) listEl.insertBefore(row, newBtn);
  else listEl.appendChild(row);

  setTimeout(() => input.focus(), 30);
}

function cancelAddThread() {}
function confirmAddThread() {}

function dismissThreadUpgrade() {
  document.getElementById('thread-upgrade-modal').hidden = true;
}

// ─── Swipe-to-delete helpers (threads + chats) ─────────────────────────────

function showDeleteConfirm(message, onConfirm) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'mini-modal-overlay';
  overlay.innerHTML = `
    <div class="mini-modal-card">
      <p class="mini-modal-body">${message}</p>
      <div class="mini-modal-actions">
        <button class="mini-modal-cancel">Cancel</button>
        <button class="mini-modal-confirm mini-modal-confirm--danger">Delete</button>
      </div>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('.mini-modal-cancel').onclick  = () => overlay.remove();
  overlay.querySelector('.mini-modal-confirm').onclick = () => { overlay.remove(); onConfirm(); };
}

// ─── Thread list ────────────────────────────────────────────────────────────

let _activeThreadDeleteRow = null;

function _dismissActiveThreadDelete() {
  if (!_activeThreadDeleteRow) return;
  const del = _activeThreadDeleteRow.querySelector('.thread-row-inline-del');
  if (del) { del.classList.remove('visible'); }
  _activeThreadDeleteRow = null;
}

function _showThreadRowDelete(wrapper, threadId) {
  if (_activeThreadDeleteRow === wrapper) {
    _dismissActiveThreadDelete();
    return;
  }
  _dismissActiveThreadDelete();
  _activeThreadDeleteRow = wrapper;

  let del = wrapper.querySelector('.thread-row-inline-del');
  if (!del) {
    del = document.createElement('button');
    del.className = 'thread-row-inline-del';
    del.textContent = 'Delete';
    del.onclick = (e) => {
      e.stopPropagation();
      _activeThreadDeleteRow = null;
      deleteThread(threadId);
      renderThreadList();
    };
    wrapper.appendChild(del);
  }
  requestAnimationFrame(() => del.classList.add('visible'));
}

function toggleThreadEditMode() {
  _dismissActiveThreadDelete();
  threadEditMode = !threadEditMode;
  const btn = document.getElementById('thread-edit-btn');
  if (btn) btn.textContent = threadEditMode ? 'Done' : 'Edit';
  renderThreadList();
}

// History now lives on its own screen (Fix 2/3). Old call sites that
// refreshed the inline Scan list now refresh the History screen instead.
function renderThreadList() {
  renderHistory();
}


// ================================================================
// HISTORY SCREEN  (Fix 2/3)
// Full-screen overlay opened from the Scan top-right icon. The bottom
// tab bar stays visible; an X closes it back to whatever tab was active.
// ================================================================

let _historyTab = 'scans';

// Tracked explicitly (not inferred from DOM/active-class state) so closing
// History always lands back on the right place regardless of how it was
// opened — the Scan tab's header icon, or Account's "See all".
let _historyOpenedFromDashboard = false;

function openHistory(tab) {
  if (!subscriptionGate()) return;
  const screen = document.getElementById('screen-history');
  if (!screen) return;
  _historyOpenedFromDashboard = (state.activeScreen === 'dashboard');
  _historyTab = tab || 'scans';
  setHistoryTab(_historyTab);
  screen.classList.add('active');
  _revealLazyImages(screen);

  // TEMP — for review only, remove once checked: pop the XP panel every
  // time History opens, so it can be looked at without earning real XP.
  // Passes a fake "before" 40 XP lower than current so the count-up
  // animation actually has something to animate.
  setTimeout(() => showXPPanel(10, 'New conversation!', Math.max(0, getXP() - 40)), 200);
}

function closeHistory() {
  const screen = document.getElementById('screen-history');
  if (screen) screen.classList.remove('active');
  if (_historyOpenedFromDashboard) {
    _historyOpenedFromDashboard = false;
    openDashboard();
  }
}

// History is a lightweight overlay (not part of the pushScreen/popScreen
// stack — it deliberately leaves the tab bar visible underneath). Rows
// inside it drill into a real screen (thread-detail, AI Coach, chat) via
// pushScreen; without this, that screen's "back" would land on whatever
// was under History instead of History itself. Any function that can be
// entered from a History row calls _captureHistoryReturn() before
// navigating away, and its close/back handler calls
// _restoreHistoryReturn() first — this pops the one real screen that got
// pushed (restoring whatever was underneath History) and then re-opens
// History itself on top of it, landing exactly back where the row was
// tapped from.
let _historyReturnTab = null;

function _captureHistoryReturn() {
  const screen = document.getElementById('screen-history');
  _historyReturnTab = (screen && screen.classList.contains('active')) ? _historyTab : null;
}

// extraPops lets a screen pushed on top of the one History-row destination
// (e.g. openScanReplay() pushing 'scan-result' on top of 'ai-coach') unwind
// past it in one go instead of landing back on that intermediate screen —
// see _scanReplayViaAiCoachHistory below.
function _restoreHistoryReturn(extraPops = 0) {
  if (!_historyReturnTab) return false;
  const tab = _historyReturnTab;
  _historyReturnTab = null;
  for (let i = 0; i < extraPops; i++) popScreen();
  popScreen();       // undo the single pushScreen() the history-row destination did
  setHistoryTab(tab); // re-render + re-open History on top, on the tab it was showing
  const historyEl = document.getElementById('screen-history');
  historyEl?.classList.add('active');
  _revealLazyImages(historyEl);
  return true;
}

function setHistoryTab(tab) {
  _historyTab = tab;
  const sEl = document.getElementById('history-tab-scans');
  const mEl = document.getElementById('history-tab-matches');
  if (sEl) sEl.classList.toggle('active', tab === 'scans');
  if (mEl) mEl.classList.toggle('active', tab === 'matches');
  renderHistory();
}

// Most recent activity on a thread: last AI Coach message, else last scan.
function _threadLastActivity(thread) {
  const coach = thread.coachChat || [];
  if (coach.length) {
    const last = coach[coach.length - 1];
    return { text: last.content, time: last.time || thread.createdAt };
  }
  if (thread.scans && thread.scans.length) {
    const last = thread.scans[thread.scans.length - 1];
    return { text: last.message, time: last.time || thread.createdAt };
  }
  return { text: 'No messages yet', time: thread.createdAt };
}

// Compact timestamp for History rows: today → time, 1 day → "Yesterday",
// otherwise "Nd ago".
function historyTime(ts) {
  if (!ts) return '';
  const now = new Date();
  const d   = new Date(ts);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (ts >= startToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const daysAgo = Math.floor((startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / dayMs) + 1;
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo}d ago`;
}

// Minute-precision timestamp for the redesigned Scans-tab rows only
// ("2 min ago" / "Yesterday" / "2 days ago", matching the reference
// exactly) — historyTime() above stays untouched since the Matches tab
// still uses it.
function _scanHistoryTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  if (diff < MIN) return 'Just now';
  if (diff < HOUR) { const m = Math.floor(diff / MIN); return `${m} min ago`; }
  if (diff < DAY)  { const h = Math.floor(diff / HOUR); return `${h} hr ago`; }
  const nowD = new Date(now), d = new Date(ts);
  const startToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime();
  const daysAgo = Math.floor((startToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY) + 1;
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo} days ago`;
}

function renderHistory() {
  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  const counterEl = document.getElementById('history-counter');
  const threads   = getThreads();

  listEl.innerHTML = '';

  // ── Matches tab — reuses the exact same chatStore data/rows as the
  // Account page's compact History preview (see renderDashHistoryPreview).
  if (_historyTab === 'matches') {
    if (counterEl) counterEl.hidden = true;
    if (chatStore.length === 0) {
      listEl.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">💘</div>
          <p class="history-empty-title">No matches yet</p>
          <p class="history-empty-sub">Keep swiping to find a match.</p>
        </div>`;
      return;
    }
    if (counterEl) {
      counterEl.hidden = false;
      counterEl.innerHTML = `<strong>${chatStore.length}</strong> match${chatStore.length !== 1 ? 'es' : ''}`;
    }
    chatStore.forEach(c => {
      const holder = document.createElement('div');
      holder.innerHTML = _matchRowHTML(c);
      const card = holder.firstElementChild;
      card.onclick = () => openChatFromStore(c);
      card.querySelector('.skipped-row-menu-btn').onclick = e => { e.stopPropagation(); confirmDeleteMatch(c.id, c.profile.name); };
      listEl.appendChild(card);
    });
    return;
  }

  // ── Scans tab ──────────────────────────────────────────────────
  // Counter: free users only — "You've used X of 2 free threads"
  if (counterEl) {
    if (!isPaidUser()) {
      counterEl.hidden = false;
      counterEl.innerHTML =
        `You've used <strong>${Math.min(threads.length, 2)}</strong> of <strong>2</strong> free threads`;
    } else {
      counterEl.hidden = true;
    }
  }

  if (threads.length === 0) {
    listEl.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">💬</div>
        <p class="history-empty-title">No threads yet</p>
        <p class="history-empty-sub">Save a scan to start a thread.</p>
      </div>`;
    return;
  }

  threads.forEach(thread => {
    const wrapper = document.createElement('div');
    wrapper.className = 'history-row-wrapper';

    const row = document.createElement('div');
    row.className = 'history-row';

    const activity  = _threadLastActivity(thread);
    const lastScan  = thread.scans && thread.scans.length ? thread.scans[thread.scans.length - 1] : null;
    // Reply-style pill — reuses the same STYLE_LABELS/STYLE_COLORS the
    // reply carousel itself is themed from, so "Smooth reply" etc. always
    // matches that style's real color everywhere else in the app. Scans
    // saved before this field existed just fall back to a plain "Reply".
    const style      = lastScan && lastScan.style;
    const styleColor = STYLE_COLORS[style] || { bg: 'rgba(236,72,153,0.12)', accent: 'var(--accent)' };
    const pillLabel  = STYLE_LABELS[style] ? `${STYLE_LABELS[style]} reply` : 'Reply';
    // Real per-style icon (assets/icons/reply-styles/{style}.png) when the
    // scan has one — same swap-in-on-load/remove-on-error technique as
    // .yr-card-illustration/.aicoach-history-row-icon — falling back to the
    // generic "reply" topic gem for older scans saved before `style`
    // existed (every row here is a saved reply, so that's the one generic
    // icon that always fits, not a per-row topic).
    const rowIconHTML = STYLE_LABELS[style]
      ? `<img class="history-row-icon-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt=""
           onload="this.closest('.history-row-icon').classList.add('has-img')" onerror="this.remove()">
         <span class="history-row-icon-svg">${AICOACH_TOPIC_ICONS.reply}</span>`
      : _aiCoachTopicIconHTML('reply');

    // Always paint the colored circle behind the icon, styled or not.
    // Unlike the AI Coach brand gem (see .has-img comment in style.css),
    // these reply-style crops don't carry their own backdrop — they're a
    // flat icon with a soft drop-shadow baked into the crop's edge, so
    // going transparent for a real image just exposes that soft/hazy edge
    // directly against the card background. Barely visible on a light
    // card; a clearly "poorly cropped" smudge against a dark one. The
    // circle contains it cleanly in either theme instead.
    row.innerHTML = `
      <span class="history-row-icon" style="background:${styleColor.bg};color:${styleColor.accent}">${rowIconHTML}</span>
      <div class="history-row-main">
        <div class="history-row-top">
          <span class="history-row-name">${thread.name}</span>
          <span class="history-row-time">${_scanHistoryTime(activity.time)}</span>
        </div>
        <span class="history-row-preview">${activity.text}</span>
        <span class="history-row-pill" style="background:${styleColor.bg};color:${styleColor.accent}">${pillLabel}</span>
      </div>
      <svg class="history-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;
    // Tapping a saved scan opens it in AI Coach (linked to this thread),
    // not the plain thread-detail viewer — see openScanReplay() for AI
    // Coach's own "View full chat" button, which replays the original
    // "Your Reply" screen instead.
    row.onclick = () => { linkThread(thread.id); openAiCoach(true); };

    // Long-press (Rename/Delete) — same 500ms hold as AI Coach's own chat-
    // history rows, so users who never discover the swipe gesture still
    // have a clear way to delete/rename a thread.
    let historyLongPressTimer = null;
    row.addEventListener('touchstart', () => {
      clearTimeout(historyLongPressTimer);
      historyLongPressTimer = setTimeout(() => openHistoryRowActions(thread.id), 500);
    }, { passive: true });
    row.addEventListener('touchmove', () => clearTimeout(historyLongPressTimer), { passive: true });
    row.addEventListener('touchend',  () => clearTimeout(historyLongPressTimer), { passive: true });

    wrapper.appendChild(row);
    listEl.appendChild(wrapper);

    // No swipe-to-delete: hold the row for Rename / Delete.
  });

  // Free user at the cap → dashed upgrade card (Fix 3)
  if (!isPaidUser() && threads.length >= 2) {
    const card = document.createElement('div');
    card.className = 'history-limit-card';
    card.innerHTML = `
      <span class="history-limit-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </span>
      <p class="history-limit-title">Free plan limit reached</p>
      <p class="history-limit-sub">Upgrade to save unlimited threads and get full AI context.</p>
      <button class="history-upgrade-btn" onclick="upgradeNow()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/>
        </svg>
        Upgrade Now
      </button>`;
    listEl.appendChild(card);
  }
}

function upgradeNow() {
  showPaywallNow();
}


// ================================================================
// PAYWALL — UI mock only, no payment logic. RevenueCat/StoreKit
// integration comes later.
//
// Only entry point left is upgradeNow() (History tab's upgrade button) —
// onboarding used to route through this screen too but now has its own
// dedicated #screen-trial-start (see cineFinishPhase2() and the "SCREEN 13"
// block above). The screen isn't pushed onto state.screenStack: it sits on
// top of whatever was active and closePaywall() unwinds straight back to
// it via the existing popScreen()/showTab() fallback.
// ================================================================

function _replaceActiveScreen(name) {
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));
  const screenEl = document.getElementById("screen-" + name);
  screenEl.classList.add("active");
  _revealLazyImages(screenEl);
  document.getElementById("tab-bar").classList.add("hidden");
  state.activeScreen = name;
}

// Bound to #screen-paywall's own buttons (History tab entry point only).
function cinePaywallContinue() { closePaywall(); }
function cinePaywallDecline() { closePaywall(); }

let _paywallOnClose = null;
let _paywallAnimated = false;
let _paywallAnimationTimers = [];

function showPaywallNow() {
  ZeloAnalytics.track('paywall_viewed', { screen: subscriptionExpired() ? 'locked' : 'paywall', plan: 'annual', price: 'THB 999.00/year' });
  _replaceActiveScreen('paywall');
  const declineBtn = document.getElementById('paywall-decline');
  if (!_paywallAnimated) {
    _paywallAnimated = true;
    if (declineBtn) declineBtn.setAttribute('hidden', '');
    const timelineTotalMs = playPaywallTimelineIntro();
    // Yearly bounce must not overlap the timeline reveal — it only starts
    // once the reveal sequence has fully finished.
    _paywallAnimationTimers.push(setTimeout(() => {
      const bounceTotalMs = playPaywallYearlyBouncePattern();
      // "No thanks" only appears once the ENTIRE sequence — timeline reveal
      // + the full yearly-card bounce pattern (1-pause-2-pause-1) — has
      // finished, not right after the timeline/checkmark reveal alone.
      _paywallAnimationTimers.push(setTimeout(() => {
        if (declineBtn) declineBtn.removeAttribute('hidden');
      }, bounceTotalMs));
    }, timelineTotalMs));
  } else if (declineBtn) {
    declineBtn.removeAttribute('hidden'); // already played once this session — no replay, show right away
  }
  // Locked users hit this on every blocked tap — never make them sit through the reveal to get out.
  if (subscriptionExpired() && declineBtn) declineBtn.removeAttribute('hidden');
}

function closePaywall() {
  popScreen();
  _paywallAnimated = false; // screen was left — replay entry animations if reopened
  _paywallAnimationTimers.forEach(clearTimeout);
  _paywallAnimationTimers = [];
  // Reset the checkmark overlay/handoff so a mid-animation close doesn't
  // leave the real step-1 icon stuck hidden or the overlay stuck visible.
  const overlay = document.getElementById('paywall-checkmark-overlay');
  if (overlay) {
    overlay.classList.remove('paywall-checkmark-overlay--pop');
    overlay.style.transition = 'none';
    overlay.style.transform = 'translate(0, 0) scale(1)';
    overlay.style.opacity = '0';
  }
  const checkmarkIcon = document.getElementById('paywall-checkmark-icon');
  if (checkmarkIcon) checkmarkIcon.classList.remove('paywall-checkmark-pending');
  const cb = _paywallOnClose;
  _paywallOnClose = null;
  if (typeof cb === 'function') cb();
}

// Sequential "completing a checklist" reveal. Step 1's checkmark plays a
// dedicated center-stage-then-travel beat (see playPaywallCheckmarkIntro()),
// then the rest proceeds: line 1->2 draws down, step 2 icon appears, line
// 2->3, step 3, line 3->4, step 4. Each step only starts once the previous
// one's transition has finished — not a simultaneous fade. Durations must
// match the CSS transition-durations on .paywall-step-icon/-line (260ms /
// 340ms) so the schedule lines up with what's actually visible. Returns the
// total duration in ms.
function playPaywallTimelineIntro() {
  const timeline = document.querySelector('#screen-paywall .paywall-timeline');
  if (!timeline) return 0;
  const icons = Array.from(timeline.querySelectorAll('.paywall-step-icon'));
  const lines = Array.from(timeline.querySelectorAll('.paywall-step-line'));
  const restSeq = [lines[0], icons[1], lines[1], icons[2], lines[2], icons[3]]
    .filter(Boolean);
  const restDurations = [340, 260, 340, 260, 340, 260];

  restSeq.forEach(el => el.classList.add('tl-hidden'));
  void timeline.offsetWidth; // force reflow so the hidden state is applied before revealing

  let t = playPaywallCheckmarkIntro();
  restSeq.forEach((el, i) => {
    _paywallAnimationTimers.push(setTimeout(() => el.classList.remove('tl-hidden'), t));
    t += restDurations[i] || 260;
  });
  return t;
}

const PAYWALL_CHECKMARK_DRAW_MS = 100;
const PAYWALL_CHECKMARK_POP_MS = 140;
const PAYWALL_CHECKMARK_HOLD_MS = 200;
const PAYWALL_CHECKMARK_TRAVEL_MS = 250;

// Step 1's checkmark: pops in large & centered on screen (point A) with a
// stroke draw-on + elastic scale settle, holds briefly, then travels
// (position + scale together, one continuous motion) into its real resting
// spot — the step 1 circle in the timeline (point B). The real step-1 icon
// stays hidden the whole time; the overlay hands off to it the instant the
// travel finishes, so it reads as one object landing into place, not a cut.
// Returns the total duration in ms (~690ms), so the ~1.8s "rest" sequence
// after it lands still totals ~2.5s, not past it.
function playPaywallCheckmarkIntro() {
  const overlay = document.getElementById('paywall-checkmark-overlay');
  const path = document.getElementById('paywall-checkmark-overlay-path');
  const stepIcon = document.getElementById('paywall-checkmark-icon');
  if (!overlay || !path || !stepIcon) return 0;

  // Reset to the point-A resting state in case this is a replay.
  overlay.classList.remove('paywall-checkmark-overlay--pop');
  overlay.style.transition = 'none';
  overlay.style.transform = 'translate(0, 0) scale(1)';
  overlay.style.opacity = '1';
  const len = path.getTotalLength();
  path.style.transition = 'none';
  path.style.strokeDasharray = String(len);
  path.style.strokeDashoffset = String(len);
  stepIcon.classList.add('paywall-checkmark-pending');
  void overlay.offsetWidth; // force reflow so the reset state applies before animating

  let t = 0;

  // 1. Stroke draws on.
  path.style.transition = `stroke-dashoffset ${PAYWALL_CHECKMARK_DRAW_MS}ms ease`;
  path.style.strokeDashoffset = '0';
  t += PAYWALL_CHECKMARK_DRAW_MS;

  // 2. Elastic scale overshoot/settle.
  _paywallAnimationTimers.push(setTimeout(() => {
    overlay.classList.add('paywall-checkmark-overlay--pop');
  }, t));
  t += PAYWALL_CHECKMARK_POP_MS;

  // 3. Brief hold at point A.
  t += PAYWALL_CHECKMARK_HOLD_MS;

  // 4. Travel — position + scale together, into the real step-1 icon's spot.
  _paywallAnimationTimers.push(setTimeout(() => {
    overlay.classList.remove('paywall-checkmark-overlay--pop'); // free up `transform` for the travel transition
    const overlayRect = overlay.getBoundingClientRect();
    const targetRect = stepIcon.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (overlayRect.left + overlayRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (overlayRect.top + overlayRect.height / 2);
    const scale = targetRect.width / overlayRect.width;
    overlay.style.transition = `transform ${PAYWALL_CHECKMARK_TRAVEL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    overlay.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
  }, t));
  t += PAYWALL_CHECKMARK_TRAVEL_MS;

  // 5. Handoff — hide the overlay and reveal the real icon at the same instant.
  _paywallAnimationTimers.push(setTimeout(() => {
    overlay.style.opacity = '0';
    stepIcon.classList.remove('paywall-checkmark-pending');
  }, t));

  return t;
}

const PAYWALL_BOUNCE_MS = 550; // matches @keyframes paywallYearlyBounce duration
const PAYWALL_BOUNCE_PAUSE_MS = 1000;

// Uniform scale "pop" on the Yearly card. Re-triggerable: remove + reflow +
// re-add so consecutive bounces (and replays on reopen) actually restart
// the CSS animation instead of being no-ops.
function triggerPaywallYearlyBounce() {
  const card = document.getElementById('paywall-plan-yearly');
  if (!card) return;
  card.classList.remove('paywall-plan--bounce');
  void card.offsetWidth;
  card.classList.add('paywall-plan--bounce');
}

// Pattern: 1 bounce -> pause 1s -> 2 bounces back-to-back -> pause 1s ->
// 1 more bounce (4 total), then stop. Only called after the timeline reveal
// has fully finished (see showPaywallNow()). Returns the total duration in
// ms, so callers know exactly when the last bounce finishes.
function playPaywallYearlyBouncePattern() {
  let t = 0;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 1
  t += PAYWALL_BOUNCE_MS + PAYWALL_BOUNCE_PAUSE_MS;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 2
  t += PAYWALL_BOUNCE_MS; // back-to-back, no pause
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 3
  t += PAYWALL_BOUNCE_MS + PAYWALL_BOUNCE_PAUSE_MS;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 4
  return t + PAYWALL_BOUNCE_MS;
}

let paywallSelectedPlan = 'yearly';
function selectPaywallPlan(plan) {
  if (plan !== 'monthly' && plan !== 'yearly') return;
  paywallSelectedPlan = plan;
  document.getElementById('paywall-plan-monthly')
    .classList.toggle('paywall-plan--selected', plan === 'monthly');
  document.getElementById('paywall-plan-yearly')
    .classList.toggle('paywall-plan--selected', plan === 'yearly');
}

// Back button on result screen — check if scan has been saved first
function goBackFromResult() {
  if (state.scanSavedToThread || state.scanSkippedSave) {
    clearScanInput();
    if (_scanReplayViaAiCoachHistory) {
      _scanReplayViaAiCoachHistory = false;
      // This path bypasses closeAiCoach() entirely (we're jumping straight
      // past the AI Coach screen it would normally run from), so do its
      // save-and-unlink work here too.
      _autoSaveAiCoachChatOnExit();
      if (_restoreHistoryReturn(1)) return;
    }
    popScreen();
    return;
  }
  // Only prompt if there are threads to save to (or the user can create one)
  showSaveBeforeLeave();
}

// "Save this scan?" bottom sheet (shared .cine-sheet shell) — replaces the
// old multi-step "pick/replace/create a thread" flow entirely. Saving
// always creates one new thread per scan, auto-named from her message
// (see _autoShortTitle()) — there's no thread-picking step any more, matching
// the reference exactly. A thread can still end up holding more than one
// scan (see openThreadDetail()'s own "add another scan" path, unaffected by
// this), just not as part of this save moment.
function showSaveBeforeLeave() {
  const box = document.getElementById('save-scan-conv');
  if (box) {
    box.innerHTML = _convRowsHTML(_saveScanPreviewMessages());
    // Same "land scrolled to the bottom" behavior as the result screen's
    // own conversation box — the reply just added as the last bubble is
    // the whole point of this preview, so it should be what's visible.
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }
  document.getElementById('save-scan-sheet').hidden = false;
}

function _saveScanPreviewMessages() {
  const msgs = (state.asstConversationMessages && state.asstConversationMessages.length)
    ? state.asstConversationMessages.slice()
    : (state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : []);
  const reply = _currentReplyText();
  const last  = msgs[msgs.length - 1];
  // "Use this reply" (freshUseReply()/replayUseReply()) already pushes the
  // reply into asstConversationMessages as its own "me" bubble — appending
  // it again here unconditionally showed it twice in a row on the "Save
  // this scan?" preview. Only append when the conversation doesn't already
  // end with this exact reply.
  if (reply && !(last && last.sender === 'me' && last.text === reply)) {
    msgs.push({ sender: 'me', text: reply });
  }
  return msgs;
}

function closeSaveScanSheet() {
  const sheet = document.getElementById('save-scan-sheet');
  if (sheet) sheet.hidden = true;
}

// "Don't save" — leave the scan-result screen without keeping it.
function declineSaveScan() {
  state.scanSkippedSave = true;
  // The save/don't-save decision — not the "Use this reply" tap — is when we ask how the
  // currently-shown reply landed: it's the point where the user has actually decided
  // whether to keep it, whether or not they ever tapped Use.
  scheduleReplyFeedback((state.asstReplyIds || {})[state.asstStyle]);
  closeSaveScanSheet();
  clearScanInput();
  popScreen();
}

function confirmSaveScan() {
  const count = getThreadCount();
  // Free-tier cap — the old flow offered an in-place "replace one of your
  // two threads" picker for this; simpler and more honest to just point at
  // Zelo Pro now that every save is its own new thread (nothing sensible
  // to "replace" in place any more).
  if (!isPaidUser() && count >= 2) {
    closeSaveScanSheet();
    showPaywallNow();
    return;
  }
  const message  = state.asstMessage;
  const reply    = _currentReplyText();
  const style    = state.asstStyle;
  // Same array the "Save this scan?" sheet just previewed (her full
  // conversation, if any, with the reply appended as the last bubble) —
  // persisted as-is so the AI Coach "Linked conversation" card can later
  // replay the exact same thing, not just the single message+reply pair.
  const conversationMessages = _saveScanPreviewMessages();
  const name     = _autoShortTitle(message) || 'Saved scan';
  const threads  = getThreads();
  const thread   = { id: 'thread_' + Date.now(), name, createdAt: Date.now(),
                     scans: [{ id: 'scan_' + Date.now(), message, reply, style, conversationMessages, time: Date.now() }], chat: [] };
  threads.unshift(thread);
  setThreadCount(count + 1);
  saveThreads(threads);
  renderThreadList();
  state.scanSavedToThread = true;
  scheduleReplyFeedback((state.asstReplyIds || {})[state.asstStyle]); // see declineSaveScan()
  closeSaveScanSheet();
  clearScanInput();
  popScreen();
}

// AI Coach's "View full chat" — replays the original "Your Reply" screen
// exactly as it looked when this scan was analyzed (her message/conversation
// + the one reply style that was actually generated and saved), instead of
// the plain thread-detail list. No network call — everything needed is
// already on the saved scan. Falls back to the plain viewer if the thread
// somehow has no scan to replay (shouldn't normally happen, since this is
// only ever reached from a linked thread that already showed real context).
// Set while a scan-replay screen is open on top of an AI Coach session that
// was itself opened from a History row — lets goBackFromResult() skip the
// intermediate AI Coach screen on the way back and land directly on
// History again in one step, instead of History -> AI Coach -> replay ->
// (back) -> AI Coach -> (back) -> History.
let _scanReplayViaAiCoachHistory = false;

function openScanReplay(threadId) {
  state.asstInputSource = null; // a saved scan's original input source is unknown — replay suggestions aren't saved
  const threads = getThreads();
  const thread  = threads.find(t => t.id === threadId);
  if (!thread) return;
  const scan = thread.scans && thread.scans.length ? thread.scans[thread.scans.length - 1] : null;
  if (!scan) { openThreadDetail(threadId); return; }

  _scanReplayViaAiCoachHistory = !!_historyReturnTab;

  state.asstMessage = scan.message || '';
  state.asstConversationMessages = (Array.isArray(scan.conversationMessages) && scan.conversationMessages.length)
    ? scan.conversationMessages : null;
  state.asstContext    = '';
  state.asstContextObj = {};

  const style = (scan.style && STYLE_LABELS[scan.style]) ? scan.style : 'smooth';
  state.asstCurrentSet    = { [style]: scan.reply || '' };
  state.eligibleStyles    = [style];
  state.currentStyleIndex = 0;
  state.asstStyle         = style;
  // Already saved — back-navigation shouldn't offer to save it again.
  state.scanSavedToThread = true;
  state.scanSkippedSave   = false;

  // The saved conversation (or just her one message) followed by the reply
  // that was generated for it — the replay layout shows both in one card.
  // A scan saved with its conversation already contains the reply (see
  // _saveScanPreviewMessages()) and, after edits here, whatever the user added
  // or removed — so it's used exactly as stored. Only an older scan with no
  // stored conversation is rebuilt from its message + reply.
  const savedConvo = state.asstConversationMessages && state.asstConversationMessages.length;
  const convo = savedConvo
    ? state.asstConversationMessages.map(m => ({ sender: m.sender, text: m.text }))
    : [{ sender: 'her', text: state.asstMessage }, ...(scan.reply ? [{ sender: 'me', text: scan.reply }] : [])];
  state.replayThreadId     = threadId;
  state.replayConvo        = convo;
  state.replayCurrentReply = scan.reply || '';
  state.replayStyle        = style;
  state.replayBestStyle    = style;
  state.asstFailedStyles   = new Set();
  _replayRenderConvo();
  _resetReplayAdd();

  document.getElementById('scan-result-loading').hidden = true;
  document.getElementById('scan-result-content').hidden = false;
  _armAddTogglePill(); // content was hidden (0 layout) at _resetReplayAdd()'s own call — size it now that it's real
  // The replay layout (see .is-replay in style.css) keeps the header's right
  // slot as an invisible spacer instead of a History button: a replay was
  // only ever reached through History (or a linked AI Coach chat), and its
  // own back-navigation already returns there directly (see
  // _scanReplayViaAiCoachHistory) — an unbounded re-entry point isn't needed.
  const historyBtn = document.getElementById('scan-result-history-btn');
  if (historyBtn) historyBtn.hidden = false;
  document.getElementById('screen-scan-result')?.classList.add('is-replay');
  pushScreen('scan-result');
  renderReplyCarousel();
  _centerCarouselOnCurrent();
}

function openThreadDetail(threadId) {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === threadId);
  if (!thread) return;

  _captureHistoryReturn();

  state.activeThreadId = threadId;
  state.threadChat     = thread.chat || [];
  state.scanEditMode   = false;

  document.getElementById('thread-detail-name').textContent = thread.name;
  const editBtn = document.getElementById('scan-edit-btn');
  const toolbar = document.getElementById('scan-edit-toolbar');
  if (editBtn) { editBtn.textContent = 'Edit'; }
  if (toolbar) toolbar.hidden = true;

  _renderThreadScans();
  pushScreen('thread-detail');
}

function _renderThreadScans() {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  if (!thread) return;
  const scansEl = document.getElementById('thread-scans');
  scansEl.innerHTML = '';
  thread.scans.forEach((scan, idx) => {
    const entry = document.createElement('div');
    entry.className = 'thread-scan-entry';
    entry.dataset.scanIdx = idx;
    if (state.scanEditMode) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'scan-select-cb';
      cb.onchange = _updateScanEditCount;
      entry.appendChild(cb);
    }
    const body = document.createElement('div');
    body.className = 'thread-scan-body';
    body.innerHTML = `
      <div class="thread-scan-msg">${scan.message}</div>
      <div class="thread-scan-reply">${scan.reply}</div>
      <div class="thread-scan-time">${formatTime(scan.time)}</div>
    `;
    entry.appendChild(body);
    // No swipe-to-delete: use Edit to select and delete scan entries.
    scansEl.appendChild(entry);
  });
}

function _updateScanEditCount() {
  const checked = document.querySelectorAll('.scan-select-cb:checked').length;
  const countEl = document.getElementById('scan-edit-count');
  const delBtn  = document.getElementById('scan-edit-delete-btn');
  if (countEl) countEl.textContent = checked + ' selected';
  if (delBtn)  delBtn.disabled = checked === 0;
}

function toggleScanEditMode() {
  state.scanEditMode = !state.scanEditMode;
  const editBtn = document.getElementById('scan-edit-btn');
  const toolbar = document.getElementById('scan-edit-toolbar');
  if (editBtn) editBtn.textContent = state.scanEditMode ? 'Done' : 'Edit';
  if (toolbar) toolbar.hidden = !state.scanEditMode;
  _renderThreadScans();
  if (state.scanEditMode) _updateScanEditCount();
}

function deleteSelectedScans() {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  if (!thread) return;
  const checked = [...document.querySelectorAll('.scan-select-cb:checked')];
  const indices = checked.map(cb => Number(cb.closest('.thread-scan-entry').dataset.scanIdx));
  indices.sort((a, b) => b - a).forEach(i => thread.scans.splice(i, 1));
  saveThreads(threads);
  toggleScanEditMode();
}

function _deleteScanAtIndex(idx) {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  if (!thread) return;
  thread.scans.splice(idx, 1);
  saveThreads(threads);
  _renderThreadScans();
}

function closeThreadDetail() {
  state.activeThreadId = null;
  state.threadChat     = [];
  if (_restoreHistoryReturn()) return;
  popScreen();
}


// ================================================================
// AI COACH  (Fix 5/6/7/8 — replaces the old Ask-Zelo-inside-thread)
// Full-page coach. Real DeepSeek via the Supabase proxy. Counts toward
// the shared 10/day scan limit. Optionally linked to a saved thread,
// whose scans are fed as context.
// ================================================================

// In-flight coach conversation for the currently open page.
let _aiCoachChat = [];

// Whether AI Coach is currently showing as a bottom sheet over an open chat
// (openAiCoachFromChat(), the composer's sparkle button) rather than the
// normal full-page presentation (Home tab card, History row). Read by
// renderAiCoachChat() (swaps the greeting/linked-thread row for the live
// chat's own "Analyzing this conversation" replay) and by the edge-swipe-back
// wiring for #screen-ai-coach (a sheet closes back to the chat sitting right
// behind it, not through the normal screen-stack pop).
let _aiCoachChatSheetOpen = false;

// One-time latch for the empty-state greeting's "push past the fold" scroll
// (see renderAiCoachChat()): false only while AI Coach is freshly opened
// with nothing in it yet, so the very first message sent (or thread linked)
// scrolls just past the greeting's own height instead of jumping all the
// way to scrollHeight, which has no visible effect while the conversation
// is still short enough to fit on one screen. Set from openAiCoach()/
// linkThread() based on whether there's already content; every render after
// the first flips it true and reverts to a normal stick-to-bottom scroll.
let _aiCoachGreetingPushed = false;

// A normal (non-History) session that isn't linked to any thread still gets
// one auto-created the instant the user actually sends something (see
// _ensureAiCoachAutoThread(), called from sendAiCoachMessage()) — not
// deferred until the user leaves AI Coach, so it shows up in chat history
// immediately, while still on the page. Tracked separately from
// getLinkedThreadId() so this stays invisible to the current screen (no
// "Linked conversation" card/greeting change mid-chat) — it's purely
// where THIS session's messages get saved, reset to null on every fresh
// AI Coach entry.
let _aiCoachAutoThreadId = null;

// ── Linked thread (Fix 7) ──────────────────────────────────────
function getLinkedThreadId() { return localStorage.getItem('zelo_ai_coach_thread') || null; }
function setLinkedThreadId(id) {
  if (id) localStorage.setItem('zelo_ai_coach_thread', id);
  else    localStorage.removeItem('zelo_ai_coach_thread');
}
function getLinkedThread() {
  const id = getLinkedThreadId();
  if (!id) return null;
  return getThreads().find(t => t.id === id) || null;
}

// Keeps the dropdown on the Scan-page AI Coach card in sync.
function refreshAiCoachCard() {
  const label = document.getElementById('aicoach-thread-dropdown-label');
  if (!label) return;
  const thread = getLinkedThread();
  label.textContent = thread ? thread.name : 'No conversation linked';
}

// ── Open / close the full page ─────────────────────────────────
function openAiCoach(keepLinkedThread) {
  // Reachable directly from a History row now (see renderHistory()) —
  // capture whether History is open BEFORE pushScreen() below hides it,
  // so closeAiCoach() can bring it back instead of landing on whatever's
  // underneath (see _captureHistoryReturn()/_restoreHistoryReturn()). A
  // no-op (sets null) for every other entry path, where History isn't open.
  _captureHistoryReturn();
  _aiCoachAutoThreadId = null; // fresh session — re-armed the instant a message is actually sent
  // If a text field on the previous screen (e.g. Tell Zelo More's free-text
  // step, or the "Other" wizard) is still focused/keyboard-up when this
  // opens, hand off cleanly instead of leaving it fighting a hidden field.
  if (document.activeElement
    && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  // Every normal open (Home card, launch) is a NEW chat: any thread link left
  // over from a previous visit — including one that survived the app being
  // killed while AI Coach was open — is dropped. Only History's row tap
  // (openAiCoach(true)) deliberately continues a saved thread.
  if (!keepLinkedThread) { setLinkedThreadId(null); refreshAiCoachCard(); }
  const thread = getLinkedThread();
  _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
  _aiCoachGreetingPushed = _aiCoachChat.length > 0; // resuming existing content, not a fresh greeting — skip the one-time push
  renderAiCoachChat();
  // Suggestions panel always starts collapsed — the user taps to reveal it,
  // regardless of whether this is a fresh conversation or has history.
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  aiCoachRemovePhoto();
  toggleAiCoachHistoryPanel(false); // reset from any previous visit — classList state persists across screen show/hide
  const limit = document.getElementById('aicoach-limit');
  if (limit) limit.hidden = true;
  pushScreen('ai-coach');
  // No auto-focus on open (matches chat's message-input, which had this
  // removed earlier) — opening AI Coach used to pop the keyboard open by
  // itself via a delayed focus() here, and a quick swipe-back right after
  // opening could have that delayed keyboardWillShow fire mid-gesture,
  // after the swipe's own early keyboard-nudge clear had already run,
  // re-applying a shift with nothing left to catch it — reading as the
  // screen still moving on swipe-back even though the underlying clear
  // logic (shared with chat, confirmed fixed there) was already correct.
}

function closeAiCoach() {
  _autoSaveAiCoachChatOnExit();
  // Force any keyboard-avoidance shift back to rest before navigating away
  // — swiping back doesn't reliably blur the focused field first, so a
  // stale shift on .aicoach-messages/.aicoach-input-bar could otherwise
  // still be sitting there and only resolve (visibly dropping) once
  // something else eventually cleared it, well after this screen's gone.
  // Instant — an animated ease-back here is what read as "the screen
  // moves up a bit" on its own during the navigation.
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  if (_restoreHistoryReturn()) return;
  popScreen();
}

// Leaving AI Coach always keeps the conversation — a linked (via History)
// or already auto-created (see _ensureAiCoachAutoThread(), which now does
// this the instant a message is first sent, not deferred until exit) thread
// just gets its latest state persisted, same as after every message, just
// defensive here too. The explicit create-fresh fallback below only
// matters for a chat that somehow reached exit with a real message but no
// thread yet (shouldn't normally happen now that sending already creates
// one). A no-op (beyond the unlink below) if nothing was actually said.
// Either way, AI Coach itself always resets to unlinked afterward — a
// normal (non-History) entry should start fresh; the saved chat is only
// re-linked by opening it again from History.
function _autoSaveAiCoachChatOnExit() {
  const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
  if (firstUserMsg) {
    if (getLinkedThreadId() || _aiCoachAutoThreadId) {
      _persistAiCoachChat();
    } else {
      _createAiCoachThreadFromFirstMessage(firstUserMsg);
    }
  }
  // Always leave AI Coach unlinked on exit, whether or not anything was
  // said or saved — a subsequent normal entry starts fresh, and re-linking
  // only happens by going through History again.
  setLinkedThreadId(null);
  _aiCoachAutoThreadId = null;
}

// Edge-swipe-back target while on the AI Coach screen — see the
// resolveTarget comment on this screen's attachEdgeSwipeBack() call above.
function _aiCoachSwipeBack() {
  // Opened as a sheet over a chat (openAiCoachFromChat()) — this was never
  // pushed onto state.screenStack, so closeAiCoach()'s own popScreen() would
  // incorrectly pop the CHAT screen's own prior entry instead. Only the
  // chat-sheet's own dismiss path applies here.
  if (_aiCoachChatSheetOpen) { closeAiCoachChatSheet(); return; }
  if (_aiCoachHistoryOpen) { toggleAiCoachHistoryPanel(false); return; }
  closeAiCoach();
}

// Real message-list a linked thread's most recent scan actually has —
// the full parsed conversation if it was saved with one (see
// confirmSaveScan()'s conversationMessages field), otherwise just the
// single her-message + reply pair. Scans saved before conversationMessages
// existed fall back to the same 2-message reconstruction.
function _linkedThreadConversation(thread) {
  const lastScan = thread.scans && thread.scans.length ? thread.scans[thread.scans.length - 1] : null;
  if (!lastScan) return { messages: [], totalCount: 0, replyCount: 0 };
  const messages = (Array.isArray(lastScan.conversationMessages) && lastScan.conversationMessages.length)
    ? lastScan.conversationMessages
    : [
        ...(lastScan.message ? [{ sender: 'her', text: lastScan.message }] : []),
        ...(lastScan.reply   ? [{ sender: 'me',  text: lastScan.reply   }] : []),
      ];
  return { messages, totalCount: messages.length, replyCount: messages.filter(m => m.sender === 'me').length };
}

// Plain outline speech-bubble — same shape as the "What should I reply?"
// suggestion card / the reply-topic icon in AI Coach's own chat history.
// Used for the Linked Conversation card specifically — the dotted bubble
// above reads fine as a small list-row icon (History) but looked heavy/busy
// at the card-header size this card uses.
const AICOACH_MESSAGE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

const AICOACH_ADD_ICON_DIR = 'assets/icons/aicoach-add/aicoach-add-';

function _aiCoachAddCardHTML() {
  return `
    <div class="aicoach-add-card">
      <p class="aicoach-add-title">Add your conversation</p>
      <p class="aicoach-add-sub">Paste a message, upload a screenshot, or link your chat so I have the full context.</p>
      <div class="aicoach-add-grid">
        <button type="button" class="aicoach-add-tile" onclick="aiCoachAddPasteMessage()">
          <img src="${AICOACH_ADD_ICON_DIR}paste.png" alt="">
          <span>Paste<br>Message</span>
        </button>
        <button type="button" class="aicoach-add-tile" onclick="document.getElementById('aicoach-photo-input').click()">
          <img src="${AICOACH_ADD_ICON_DIR}upload.png" alt="">
          <span>Upload<br>Screenshot</span>
        </button>
        <button type="button" class="aicoach-add-tile" onclick="openThreadLinkPicker()">
          <img src="${AICOACH_ADD_ICON_DIR}link.png" alt="">
          <span>Link Chat</span>
          <span class="aicoach-add-info" role="button" aria-label="About linking a chat" onclick="event.stopPropagation(); aiCoachAddInfo()">
            <img src="${AICOACH_ADD_ICON_DIR}info.png" alt="">
          </span>
        </button>
      </div>
    </div>`;
}

async function aiCoachAddPasteMessage() {
  const input = document.getElementById('aicoach-input');
  if (!input) return;
  let text = '';
  try { text = (await navigator.clipboard.readText()) || ''; } catch (e) {}
  if (text.trim()) {
    input.value = text.trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  input.focus();
}

function aiCoachAddInfo() {
  flashLimitToast('Link a chat you saved in Scan for deeper context.');
}

function renderAiCoachContext() {
  const row = document.getElementById('aicoach-context-row');
  if (!row) return;
  const thread = getLinkedThread();
  if (thread && _aiCoachHasRealContext()) {
    const conv = _linkedThreadConversation(thread);
    // Same plain look as the "This conversation" block in the chat sheet (label +
    // .yr-conv bubble box), renamed, with "View full chat" beside the label.
    row.className = 'aicoach-context-row aicoach-context-row--plain';
    row.innerHTML = `
      <div class="aicoach-linked-head">
        <span class="yr-label aicoach-live-conv-label">Linked conversation</span>
        <button type="button" class="aicoach-change-btn" onclick="openScanReplay('${thread.id}')">View full chat ›</button>
      </div>
      <div class="yr-conv aicoach-live-conv-box" id="aicoach-context-conv">${_convRowsHTML(conv.messages)}</div>`;
    const convBox = document.getElementById('aicoach-context-conv');
    if (convBox) requestAnimationFrame(() => { convBox.scrollTop = convBox.scrollHeight; });
  } else if (thread) {
    // Linked but no real scan on it yet (e.g. a thread created with no
    // saved scans) — same "linked" mechanism, just nothing to show yet.
    row.className = 'aicoach-context-row';
    row.innerHTML = `
      <div class="aicoach-context-head">
        <span class="aicoach-context-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <div class="aicoach-context-info">
          <span class="aicoach-context-title">Conversation context
            <span class="aicoach-context-linked">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Linked</span></span>
          <span class="aicoach-context-meta">${_escapeHtml(thread.name)} • no scans yet</span>
        </div>
        <button type="button" class="aicoach-change-btn" onclick="openThreadLinkPicker()">Change</button>
      </div>`;
  } else {
    row.className = 'aicoach-context-row aicoach-context-row--add';
    row.innerHTML = _aiCoachAddCardHTML();
  }
}

function _aiCoachGreeting() {
  const thread = getLinkedThread();
  if (thread && _aiCoachHasRealContext()) {
    return {
      hi: "Got it!",
      body: "I can see the conversation and your reply here. I'll use this context to give you better advice, suggest replies, or help you with anything you want to say next.",
    };
  }
  return {
    hi: "Hi! I'm Zelo.",
    body: thread
      ? `I've reviewed the full conversation with ${thread.name}. Ask me anything or get suggestions on how to reply.`
      : `I can help you understand this situation and suggest the best replies. Add the current conversation and I'll give you advice and options.`,
  };
}

// The currently open practice chat's own messages (chatStore, keyed by
// state.activeChatId), reshaped into the same {sender:'her'|'me', text}
// shape _linkedThreadConversation()/_convRowsHTML() already use for scan
// threads — lets the chat-sheet's "this conversation" replay reuse that
// exact rendering instead of a separate one.
// True while the AI Coach sheet was opened from Your Reply (openAiCoachFromScan()):
// the "live conversation" is then the scan screen's own conversation, not a chat's.
let _aiCoachScanSheet = false;

function _scanScreenConversation() {
  if (state.replayThreadId) return state.replayConvo.map(m => ({ sender: m.sender, text: m.text }));
  const c = state.asstConversationMessages;
  if (c && c.length) return c.map(m => ({ sender: m.sender, text: m.text }));
  return state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : [];
}

function openAiCoachFromScan() {
  _aiCoachExplainCard = null; // a plain "Ask AI Coach" open is never about one specific suggested reply
  _aiCoachScanSheet = true;
  openAiCoachFromChat();
}

function _aiCoachLiveChatConversation() {
  if (_aiCoachScanSheet) return _scanScreenConversation();
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  return chat.messages.map(m => {
    const target = m.replyToId ? chat.messages.find(x => x.id === m.replyToId) : null;
    return { sender: m.sender === 'user' ? 'me' : 'her', text: m.text, replyTo: target ? target.text : null };
  });
}

// "Analyzing this conversation" card + read-only replay of the live chat,
// shown instead of the greeting/linked-thread row while opened as a sheet
// from a chat (see openAiCoachFromChat()/renderAiCoachChat()). Reuses the
// existing "Linked conversation" pink-card look (.aicoach-context-row.linked)
// and the conversation-bubble box already used for Your Reply's "Her
// message" preview (.yr-conv/.yr-conv-row/.yr-conv-bubble, see
// _convRowsHTML()) — same visual language already built for those, just a
// different label and no "View full chat" action, since the real chat is
// already sitting right behind this sheet.
// Zelo's read on the topic, for the sheet opened from Your Reply — built from her
// latest message with the same rule-based read the old on-screen box used.
function _analyzingScanRead(conv) {
  const lastHer = [...conv].reverse().find(m => m.sender === 'her');
  return "Zelo's read: " + _escapeHtml(_buildZeloRead(lastHer ? lastHer.text : '', state.scanContext));
}

function _aiCoachAnalyzingCard() {
  const wrap = document.createElement('div');
  const conv = _aiCoachLiveChatConversation();
  wrap.innerHTML = `
    ${conv.length ? `
      <span class="yr-label aicoach-live-conv-label">This conversation</span>
      <div class="yr-conv aicoach-live-conv-box" id="aicoach-live-conv-box">${_convRowsHTML(conv)}</div>
    ` : ''}
    <div class="aicoach-context-row linked aicoach-analyzing-card">
      <div class="aicoach-context-head">
        <span class="aicoach-context-icon aicoach-analyzing-icon">
          <img src="assets/icons/reply-styles/smooth.png" alt="" onerror="this.remove()">
        </span>
        <div class="aicoach-context-info">
          <span class="aicoach-context-title">Analyzing this conversation</span>
          <span class="aicoach-context-meta">${_aiCoachScanSheet ? _analyzingScanRead(conv) : 'I can see the full chat above and help you with suggestions or advice.'}</span>
        </div>
      </div>
    </div>`;
  const box = wrap.querySelector('#aicoach-live-conv-box');
  if (box) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  return wrap;
}

function renderAiCoachChat() {
  const wrap = document.getElementById('aicoach-messages');
  if (!wrap) return;
  wrap.innerHTML = '';

  let greetingEl = null;
  if (_aiCoachChatSheetOpen) {
    // Opened from a chat's own composer — replaces the greeting/linked-
    // thread row above with a read-only replay of THIS chat's live
    // messages, since there's nothing to "link" here (see
    // openAiCoachFromChat()'s own comment).
    wrap.appendChild(_aiCoachAnalyzingCard());
  } else {
    // Opening Zelo greeting (not part of the stored turns) — always
    // rendered, same as every other message: scrolling up still has to be
    // able to reach it. What changed (see the scroll call at the bottom of
    // this function) is how far the view scrolls on the FIRST real
    // interaction — just past the greeting's own height, not necessarily
    // all the way to the true bottom, so it reliably leaves view even when
    // the rest of the content is still short.
    const greeting = _aiCoachGreeting();
    greetingEl = _aiCoachZeloBubble(greeting.body, { greeting: true, hiText: greeting.hi });
    wrap.appendChild(greetingEl);

    // Linked-conversation context card — right below the greeting, scrolling
    // with the rest of the chat rather than pinned as its own fixed strip.
    const ctxRow = document.createElement('div');
    ctxRow.id = 'aicoach-context-row';
    wrap.appendChild(ctxRow);
    renderAiCoachContext();
  }

  _aiCoachChat.forEach(msg => {
    if (msg.role === 'user') {
      wrap.appendChild(_aiCoachUserBubble(msg));
    } else {
      wrap.appendChild(_aiCoachZeloBubble(msg.content, { time: msg.time, replyToId: msg.replyToId }));
      (msg.suggestions || []).forEach(s => wrap.appendChild(_aiCoachSuggestion(s)));
    }
  });

  // Action pills after the latest Zelo answer — or, if that answer is a
  // failure, the availability indicator instead (see _aiCoachStatusPill()).
  const last = _aiCoachChat[_aiCoachChat.length - 1];
  if (last && last.role === 'assistant' && last.failKind) {
    if (_aiCoachStatusMsg !== last) _aiCoachStartStatusWatch(last, last !== _aiCoachJustFailedMsg);
    wrap.appendChild(_aiCoachStatusPill(last));
  } else {
    _aiCoachStopStatusWatch();
    _aiCoachStatusGen++;
    _aiCoachStatusMsg = null;
    if (last && last.role === 'assistant' && last.content !== '…') {
      wrap.appendChild(_aiCoachActionPills());
    }
  }

  _ensureScrollableOverflow(wrap, 48);

  if (greetingEl && _aiCoachChat.length === 0) {
    // True empty state — show the greeting at the top, same as any fresh
    // open. scrollTop still belongs at 0 here, not wherever the spacer
    // above would otherwise carry wrap.scrollHeight to.
    wrap.scrollTop = 0;
  } else if (greetingEl && !_aiCoachGreetingPushed) {
    // First real interaction after the empty-state greeting (first message
    // sent, or a thread linked with its own history) — scroll just past the
    // greeting's own height rather than all the way to scrollHeight, so it
    // reliably clears the fold even when the rest of the content is still
    // short enough to otherwise fit on one screen. Still reachable by
    // scrolling back up afterward since it's never removed from the DOM.
    _aiCoachGreetingPushed = true;
    const target = greetingEl.offsetTop + greetingEl.offsetHeight;
    wrap.scrollTop = Math.max(0, Math.min(target, _logicalScrollHeight(wrap) - wrap.clientHeight));
  } else {
    _scrollToLogicalBottom(wrap);
  }
}

function _aiCoachZeloBubble(text, opts = {}) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--zelo';
  const avatar = opts.greeting
    ? `<span class="aicoach-msg-avatar" aria-hidden="true">${_aiCoachBrandIconHTML()}</span>`
    : '';
  const hi = opts.greeting ? `<p class="aicoach-bubble-hi">${opts.hiText || "Hi! I'm Zelo."}</p>` : '';
  // The waiting-for-reply placeholder (see sendAiCoachMessage()'s '…'
  // content) gets the same animated bouncing dots as the main chat's own
  // typing indicator, instead of a plain static ellipsis character —
  // same .typing-dot markup/animation, just sitting inside this bubble's
  // own shape/theme instead of .typing-bubble's.
  const body = text === '…'
    ? `<div class="aicoach-typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
    : `<p class="aicoach-bubble-text">${text}</p>`;
  row.innerHTML = `
    ${avatar}
    <div class="aicoach-bubble aicoach-bubble--zelo">
      ${hi}
      ${_aiCoachReplyQuoteHTML(opts.replyToId)}
      ${body}
    </div>`;
  return row;
}

function _aiCoachUserBubble(msg) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--user';
  const img = msg.image ? `<img class="aicoach-bubble-img" src="${msg.image}" alt="">` : '';
  row.innerHTML = `<div class="aicoach-bubble aicoach-bubble--user">${img}${msg.content}</div>`;
  return row;
}

function _aiCoachSuggestion(text) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'aicoach-suggestion';
  card.onclick = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    flashLimitToast('Copied to clipboard');
  };
  card.innerHTML = `
    <span class="aicoach-suggestion-icon" aria-hidden="true">${_aiCoachBrandIconHTML()}</span>
    <span class="aicoach-suggestion-text">${text}</span>`;
  return card;
}

function _aiCoachActionPills() {
  const wrap = document.createElement('div');
  wrap.className = 'aicoach-action-pills';
  wrap.innerHTML = `
    <button class="aicoach-action-pill" type="button" onclick="sendAiCoachMessage('Explain more')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Explain more
    </button>
    <button class="aicoach-action-pill" type="button" onclick="sendAiCoachMessage('Show me more options')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      Show more options
    </button>`;
  return wrap;
}

// ---- Collapsible suggestions panel (anchored above the input bar) ----
// Always starts collapsed — the user taps the toggle to reveal it. Every
// category/quick-action button routes through aiCoachPromptTap(), which
// asks for her message first if there's no real linked context — it does
// NOT hand the button's own label straight to the AI as if it were a
// fully-formed question.
let _aiCoachSuggestOpen = false;

// Suggestions panel and keyboard are mutually exclusive — opening one
// closes the other, they never stack/overlap. One tap on the toggle: keyboard
// dismisses first, panel opens automatically right after — sequential, but
// a single tap does both with no second tap needed. (This only reaches this
// function at all now because of the touchstart exception above — without
// it, the tap's own blur-and-reflow could dodge the click event entirely.)
function toggleAiCoachSuggestPanel() {
  const input = document.getElementById('aicoach-input');
  const willOpen = !_aiCoachSuggestOpen;
  if (willOpen && input && document.activeElement === input) {
    input.blur();
    setTimeout(() => {
      _aiCoachSuggestOpen = true;
      _updateAiCoachSuggestToggle();
    }, 280); // keyboard-dismiss animation duration, roughly
    return;
  }
  _aiCoachSuggestOpen = !_aiCoachSuggestOpen;
  _updateAiCoachSuggestToggle();
}

function _updateAiCoachSuggestToggle() {
  const panel   = document.getElementById('aicoach-suggest-panel');
  const chevron = document.getElementById('aicoach-suggest-toggle-chevron');
  if (panel)   panel.classList.toggle('open', _aiCoachSuggestOpen);
  if (chevron) chevron.classList.toggle('aicoach-suggest-toggle-chevron--open', _aiCoachSuggestOpen);
  // Opening the panel eats into .aicoach-messages' flex space (both share
  // the same fixed-height column) without moving anything — so the last
  // message can end up sitting behind where the panel now is unless the
  // thread re-anchors to its own bottom once the panel's expand transition
  // actually finishes (mid-transition, scrollHeight/clientHeight are still
  // the old, taller values).
  if (_aiCoachSuggestOpen) {
    const body = document.getElementById('aicoach-suggest-body');
    if (body) body.addEventListener('transitionend', scrollAiCoachToBottom, { once: true });
  }
}

function scrollAiCoachToBottom() {
  const el = document.querySelector('.aicoach-messages');
  if (el) _scrollToLogicalBottom(el);
  _updateAiCoachScrollBottomBtn();
}

function _updateAiCoachScrollBottomBtn() {
  const el = document.getElementById('aicoach-messages');
  const btn = document.getElementById('aicoach-scroll-bottom-btn');
  if (!el || !btn) return;
  const distanceFromBottom = _logicalScrollHeight(el) - el.scrollTop - el.clientHeight;
  btn.hidden = distanceFromBottom < CHAT_SCROLL_BOTTOM_THRESHOLD;
}
(function () {
  const el = document.getElementById('aicoach-messages');
  if (el) el.addEventListener('scroll', _updateAiCoachScrollBottomBtn, { passive: true });
})();

// Focusing the input (keyboard opening) closes the suggestions panel if
// it's open — same mutual-exclusivity in the other direction.
document.addEventListener('focusin', (e) => {
  if (e.target.id === 'aicoach-input' && _aiCoachSuggestOpen) {
    _aiCoachSuggestOpen = false;
    _updateAiCoachSuggestToggle();
    // The keyboard-avoidance nudge (script.js's keyboard-nudge IIFE) runs
    // 30-80ms after this same focus event — but .aicoach-suggest-body's
    // own collapse (max-height, 0.35s) is nowhere near done by then, so
    // that first nudge measures a mid-collapse, not-yet-settled layout
    // and computes the wrong shift. That's the root cause of the AI Coach
    // input "jumping up too high" specifically after the suggestions
    // panel had been open — not the keyboard nudge itself misbehaving.
    // Re-run the same nudge once this transition actually finishes so the
    // final shift reflects where things really end up, not a snapshot
    // mid-flight.
    const body = document.getElementById('aicoach-suggest-body');
    if (body && window._nudgeFocusedIntoView) {
      body.addEventListener('transitionend', () => window._nudgeFocusedIntoView(), { once: true });
    }
  }
}, true);

function renderAiCoachSuggestPanel() {
  const body = document.getElementById('aicoach-suggest-body');
  if (!body) return;
  body.innerHTML = `
    <p class="aicoach-suggest-title">What do you need help with?</p>
    <div class="aicoach-suggest-grid">
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('Is she interested?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="#ec4899"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>
        <span class="aicoach-suggest-label">Is she interested?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('What should I reply?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
        <span class="aicoach-suggest-label">What should I reply?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('Did I mess up?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 15.5s1.5-2 4-2 4 2 4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></span>
        <span class="aicoach-suggest-label">Did I mess up?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('How do I keep the conversation going?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>
        <span class="aicoach-suggest-label">Keep the conv. going</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('How do I ask her out?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="11" x2="21" y2="11"/></svg></span>
        <span class="aicoach-suggest-label">How do I ask her out?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="document.getElementById('aicoach-input')?.focus()">
        <span class="aicoach-suggest-ic">${_aiCoachBrandIconHTML()}</span>
        <span class="aicoach-suggest-label">Other question</span>
      </button>
    </div>
    <p class="aicoach-suggest-title">Quick actions</p>
    <div class="aicoach-suggest-quick">
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Generate a reply for me')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        Generate Reply
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Explain what this message means')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Explain Message
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Rewrite my message to sound better')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        Rewrite Message
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Give me more replies like this')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.5.4.8 1 .8 1.6v.2h6.4v-.2c0-.6.3-1.2.8-1.6A7 7 0 0 0 12 2Z"/></svg>
        More Like This
      </button>
    </div>`;
  _updateAiCoachSuggestToggle();
}

// True once there's an actual message on record — either a linked thread
// with real scans, or (opened from a chat's own composer) that chat's own
// live messages — that the AI can reason about, not just a category label
// with nothing behind it.
function _aiCoachHasRealContext() {
  const thread = getLinkedThread();
  if (thread && Array.isArray(thread.scans) && thread.scans.length > 0) return true;
  if (_aiCoachChatSheetOpen && _aiCoachLiveChatConversation().length > 0) return true;
  return false;
}

function aiCoachPromptTap(question) {
  // Always stage — tapping a suggestion never sends by itself, regardless
  // of whether a thread is linked yet (see aiCoachStagePrompt()). The
  // "no context yet, ask for her message" canned reply that used to fire
  // right here now happens at actual send time instead (see
  // sendAiCoachMessage()), since sending is the only thing that's
  // allowed to happen just from tapping a suggestion.
  aiCoachStagePrompt(question);
}

// ================================================================
// STAGED SUGGESTION — PROTOTYPE (see #aicoach-staged-pill in index.html).
// Tapping a suggestion card (when there's already real context) lands it
// here as a preview box instead of sending immediately — same size,
// material, and behavior as the photo preview right below it: it's just
// a preview, tapping it does nothing, the X removes it, and it only
// actually sends once the user hits send/Enter (see sendAiCoachMessage(),
// which folds it in alongside anything typed).
// ================================================================
let _aiCoachStagedPrompt = null;

function aiCoachStagePrompt(question) {
  _aiCoachStagedPrompt = question;
  const pill = document.getElementById('aicoach-staged-pill');
  const text = document.getElementById('aicoach-staged-pill-text');
  if (pill && text) {
    text.textContent = question;
    pill.hidden = false;
  }
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();
  // Deliberately NOT auto-focusing the input here. Staging a suggestion
  // shouldn't reopen the keyboard on its own if the user had it closed —
  // the keyboard should only ever respond to the user's own taps, never
  // pop back open as a side effect of something else they tapped.
}

function aiCoachDismissStagedPill() {
  _aiCoachStagedPrompt = null;
  const pill = document.getElementById('aicoach-staged-pill');
  if (pill) pill.hidden = true;
}

// ================================================================
// PHOTO ATTACH — PROTOTYPE (see #aicoach-photo-input in index.html).
// Plain accept="image/*" with no capture attribute — opens the OS's
// normal picker (library/files), not the camera, same file-input pattern
// already used for onboarding photos. Attaches to the NEXT message sent
// as an image bubble. No vision/OCR wiring to the AI proxy yet — this is
// the attach/preview/send UI only.
// ================================================================
let _aiCoachPhotoDataUrl = null;

function aiCoachPhotoSelected(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // allow re-selecting the same file later
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    _aiCoachPhotoDataUrl = reader.result;
    const preview = document.getElementById('aicoach-photo-preview');
    const img = document.getElementById('aicoach-photo-preview-img');
    if (preview && img) {
      img.src = _aiCoachPhotoDataUrl;
      preview.hidden = false;
    }
    // The OS photo picker taking over the screen necessarily hides the
    // keyboard while it's up (that part isn't ours to control) — this
    // brings it right back the instant control returns, so the user isn't
    // left having to tap back into the field themselves.
    document.getElementById('aicoach-input')?.focus();
  };
  reader.readAsDataURL(file);
}

function aiCoachRemovePhoto() {
  _aiCoachPhotoDataUrl = null;
  const preview = document.getElementById('aicoach-photo-preview');
  if (preview) preview.hidden = true;
}

function handleAiCoachKeyDown(e) {
  if (e.key === 'Enter') sendAiCoachMessage();
}

// Builds the proxy message list: system prompt + linked thread context as
// prior history + the live coach turns.
// The last few user turns, numbered for [re:N] in both directions (prompt
// out, parse back) so the indices line up without passing state around.
function _aiCoachRecentUserMsgs() {
  return _aiCoachChat.filter(m => m.role === 'user' && m.id).slice(-5);
}

// Quote strip for an AI Coach bubble that links to an earlier message.
// Escaped: these bubbles are built with innerHTML.
function _aiCoachReplyQuoteHTML(replyToId) {
  if (!replyToId) return '';
  const target = _aiCoachChat.find(m => m.id === replyToId);
  if (!target || !target.content) return '';
  const t = String(target.content);
  return `<div class="msg-reply-quote">${_escapeHtml(t.length > 80 ? t.slice(0, 80) + '…' : t)}</div>`;
}

function _buildAiCoachMessages() {
  const thread = getLinkedThread();
  // Opened from a chat's own composer (see openAiCoachFromChat()) never
  // sets a linked thread — that conversation instead lives in chatStore,
  // read here the same way _aiCoachAnalyzingCard()'s on-screen replay does.
  const liveConv = _aiCoachChatSheetOpen ? _aiCoachLiveChatConversation() : [];
  let system =
    'You are Zelo, a casual texting coach. Never formal, never therapist-like. ' +
    'You talk like a smart friend giving quick, honest advice. Keep replies short, direct, no fluff. ';
  if (thread) {
    system += `The user has linked their conversation with ${thread.name}. ` +
      'The messages above show what they received and how they replied — use that context. ';
  } else if (liveConv.length) {
    system += 'Below is the live conversation so far, in order, labeled "Them" (what the other person sent) ' +
      'and "Me" (what the user sent). Use it as context for advice and suggested replies.\n\n' +
      liveConv.map(m => `${m.sender === 'me' ? 'Me' : 'Them'}: ${m.text}`).join('\n') + '\n';
  }
  if (_aiCoachExplainCard) {
    system += `\nZelo already generated this suggested reply for the user (tone: ${STYLE_LABELS[_aiCoachExplainCard.style] || _aiCoachExplainCard.style}): "${_aiCoachExplainCard.text}". ` +
      'When asked why it works, explain specifically why THIS suggested reply fits the conversation above — reference its actual wording and tone, not a generic answer. ';
  }
  system +=
    'Never use markdown formatting anywhere in your response text — no asterisks for bold or italic, ' +
    'no dashes or bullet points, no headers, nothing but plain conversational sentences, the way a real ' +
    'text message reads. Respond ONLY with a JSON object, no markdown fences, in exactly this shape: ' +
    '{"advice": "your short take, 1-3 sentences", "suggestions": ["a ready-to-send reply", "another option", "a third option"]}. ' +
    'suggestions are full reply texts the user could copy and send. Always include 2 or 3.';

  const messages = [{ role: 'system', content: system }];

  // Linked thread scans as conversation history (Fix 6)
  if (thread) {
    (thread.scans || []).forEach(s => {
      messages.push({ role: 'user', content: `They texted me: "${s.message}". I replied: "${s.reply}".` });
    });
  }

  // Live coach turns (assistant turns send only their advice text back)
  _aiCoachChat.forEach(m => {
    if (m.content === '…' || m.failKind) return;
    messages.push({ role: m.role, content: m.content });
  });

  // Same [re:N] mechanism the practice chat uses, so a reply that's picking
  // up an earlier point can be visibly linked to it rather than leaving the
  // user to work out which question is being answered.
  const recent = _aiCoachRecentUserMsgs();
  if (recent.length > 1) {
    messages.push({
      role: 'system',
      content: [
        `The user's recent messages, numbered:`,
        recent.map((m, i) => `[${i + 1}] ${m.content}`).join('\n'),
        `If your reply is picking up one of them specifically rather than the latest, start it with that number in square brackets, like [re:1] or [re:2] — literally that, with a real digit. Skip it when you're simply answering the most recent message. Never mention or explain the tag.`,
      ].join('\n')
    });
  }

  return messages;
}

async function sendAiCoachMessage(preset) {
  const input = document.getElementById('aicoach-input');
  const typedText = (preset != null ? preset : (input ? input.value : '')).trim();
  // preset != null means this call came from something else that already
  // resolved its own exact text (there's no other caller today, but the
  // param exists for that) — a staged suggestion only ever folds in on
  // the normal send-button/Enter path.
  const stagedQuestion = preset == null ? _aiCoachStagedPrompt : null;
  let text = stagedQuestion
    ? (typedText ? `${stagedQuestion} ${typedText}` : stagedQuestion)
    : typedText;

  // A staged suggestion (see aiCoachStagePrompt()) rides along with
  // whatever's typed, folded into the same send — it's a preview, not a
  // button, exactly like the photo attachment right next to it.
  if (stagedQuestion) aiCoachDismissStagedPill();

  const photo = _aiCoachPhotoDataUrl;
  if (!text && !photo) return;
  // No vision wiring yet (see aiCoachPhotoSelected()'s note) — a photo
  // with no caption still needs SOME text so the bubble and the message
  // sent to the AI proxy aren't blank.
  if (!text && photo) text = '[Photo attached]';

  // Daily limit (Fix 8) — AI Coach shares the 10/day scan budget
  if (!isPaidUser() && scansRemainingToday() <= 0) {
    const limit = document.getElementById('aicoach-limit');
    if (limit) limit.hidden = false;
    return;
  }

  if (input && preset == null) input.value = '';
  if (photo) aiCoachRemovePhoto();

  // A staged suggestion (e.g. "Is she interested?") needs an actual
  // message to work from. If there's no linked thread AND the user sent
  // it bare (didn't type anything of their own, no photo either), ask
  // for that instead of sending the question into a vacuum — this is the
  // same "no context yet" behavior that used to fire the instant a
  // suggestion was tapped; it only moved to here, since tapping a
  // suggestion never sends by itself anymore.
  if (stagedQuestion && !typedText && !photo && !_aiCoachHasRealContext()) {
    _aiCoachChat.push({ id: _newMsgId(), role: 'user', content: text, time: Date.now() });
    _aiCoachChat.push({
      role: 'assistant',
      content: "What did she write? Paste her message (or link a thread) and I'll take it from there.",
      suggestions: [],
      time: Date.now()
    });
    _ensureAiCoachAutoThread();
    _persistAiCoachChat();
    renderAiCoachChat();
    _aiCoachSuggestOpen = false;
    _updateAiCoachSuggestToggle();
    return;
  }

  _aiCoachChat.push({ id: _newMsgId(), role: 'user', content: text, image: photo || null, time: Date.now() });
  _ensureAiCoachAutoThread();
  if (!isPaidUser()) decrementScanCount();

  // Sending a message collapses the suggestions panel — it can still be
  // reopened manually anytime via the toggle.
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();

  const placeholder = { id: _newMsgId(), role: 'assistant', content: '…', suggestions: [], time: Date.now() };
  _aiCoachChat.push(placeholder);
  renderAiCoachChat();

  await _aiCoachFetchReply(placeholder);
}

// Runs the actual DeepSeek round trip for one placeholder message and fills
// it in (or marks it failed with a reason). Shared by the normal send and
// the status pill's Retry button — Retry reuses the SAME message object, so
// it never adds a second user turn or a second free-credit charge.
async function _aiCoachFetchReply(placeholder) {
  const apiMessages = _buildAiCoachMessages().slice(0, -1); // exclude placeholder
  try {
    const { data, error } = await _aiInvoke('deepseek-proxy', {
      body: { model: 'deepseek-chat', messages: apiMessages, max_tokens: 320, temperature: 0.9 }
    }, 'coach');
    if (error) throw error;
    let raw = data.choices[0].message.content.trim();
    // Pull [re:N] off before the advice/suggestions split, or the tag ends
    // up rendered as part of her text — the exact leak the practice chat hit.
    const recent = _aiCoachRecentUserMsgs();
    const tag = raw.match(/^[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*(\d+)\s*[\])]\s*/i);
    if (tag) {
      const target = recent[parseInt(tag[1], 10) - 1];
      if (target) placeholder.replyToId = target.id;
      raw = raw.slice(tag[0].length).trim();
    }
    raw = _stripDirectiveTags(raw) || raw;
    const parsed = _parseAiCoachReply(raw);
    placeholder.content     = parsed.advice;
    placeholder.suggestions = parsed.suggestions;
    delete placeholder.failKind;
  } catch (err) {
    placeholder.content     = "Hmm, I couldn't reach Zelo right now. Try again in a moment.";
    placeholder.suggestions = [];
    placeholder.failKind    = _aiCoachClassifyError(err);
    _aiCoachStatusMsg = null; // a fresh failure always restarts the status watch
    _aiCoachJustFailedMsg = placeholder;
  }

  _persistAiCoachChat();
  renderAiCoachChat();
}

// ---- Zelo availability indicator (small pill under a failed reply) ----
// Why a reply failed decides what the pill says: a 401 means the user isn't
// signed in (the proxy rejects the public anon key on purpose — see
// supabase/functions/deepseek-proxy), a 429 is the per-user hourly cap, and
// everything else (5xx, DeepSeek down, no network) is genuine unavailability.
function _aiCoachClassifyError(err) {
  const status = err && err.context && err.context.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'limit';
  if (!status && typeof navigator !== 'undefined' && navigator.onLine === false) return 'net';
  return 'down';
}

// In-memory only — availability is a live fact, not something to persist.
// { state: 'checking' | 'down' | 'up' }
let _aiCoachStatus = { state: 'down' };
let _aiCoachStatusMsg = null;   // the failed message the current watch belongs to
let _aiCoachStatusTimer = null;
let _aiCoachJustFailedMsg = null; // failed THIS session (already known down) vs. reopened from history (unknown)
let _aiCoachStatusGen = 0;
const AI_COACH_STATUS_POLL_MS = 15000;
const AI_COACH_STATUS_MAX_POLLS = 20;

function _aiCoachLastFailedMsg() {
  const last = _aiCoachChat[_aiCoachChat.length - 1];
  return last && last.role === 'assistant' && last.failKind ? last : null;
}

// Asks the proxy whether DeepSeek is actually reachable right now. Doesn't
// touch the hourly rate limit and costs nothing (see the `health` branch in
// deepseek-proxy).
async function _probeZelo() {
  try {
    const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', { body: { health: true } });
    // A proxy build from before the `health` branch existed answers this
    // with 400 "Missing messages" — still proof the function itself is up
    // and the caller is signed in, so that counts as reachable.
    if (error) return !!(error.context && error.context.status === 400);
    return !!(data && data.ok);
  } catch { return false; }
}

function _aiCoachStopStatusWatch() {
  clearTimeout(_aiCoachStatusTimer);
  _aiCoachStatusTimer = null;
}

function _aiCoachStartStatusWatch(msg, immediate) {
  _aiCoachStopStatusWatch();
  _aiCoachStatusMsg = msg;
  const gen = ++_aiCoachStatusGen;
  const kind = msg.failKind;

  if (kind === 'auth') {
    _aiCoachStatus = { state: (window.AUTH && AUTH.signedIn && AUTH.signedIn()) ? 'up' : 'down' };
    return;
  }
  if (kind === 'limit') { _aiCoachStatus = { state: 'down' }; return; }

  _aiCoachStatus = { state: immediate ? 'checking' : 'down' };
  let polls = 0;
  const tick = async () => {
    if (_aiCoachStatusGen !== gen) return;
    if (!document.getElementById('aicoach-status-pill')) { _aiCoachStatusMsg = null; return; } // left the chat — next render restarts it
    _aiCoachStatus = { state: 'checking' };
    _updateAiCoachStatusPill();
    const ok = await _probeZelo();
    if (_aiCoachStatusGen !== gen) return;
    _aiCoachStatus = { state: ok ? 'up' : 'down' };
    _updateAiCoachStatusPill();
    if (ok) { navigator.vibrate?.(8); return; }
    if (++polls < AI_COACH_STATUS_MAX_POLLS) _aiCoachStatusTimer = setTimeout(tick, AI_COACH_STATUS_POLL_MS);
  };
  // Just failed → we already know it's down; wait a beat before re-probing.
  // Reopened old chat → nothing known yet, so check right away.
  _aiCoachStatusTimer = setTimeout(tick, immediate ? 0 : 6000);
}

function _aiCoachStatusPillHTML(msg) {
  const kind = msg.failKind;
  const st = _aiCoachStatus.state;
  let mod, title, sub = '', action = '';
  if (st === 'checking') {
    mod = 'checking'; title = 'Checking Zelo…';
  } else if (st === 'up') {
    mod = 'up'; title = kind === 'auth' ? "You're signed in" : 'Zelo is available now';
    action = `<button type="button" class="aicoach-status-btn" onclick="retryAiCoachReply()">Retry</button>`;
  } else if (kind === 'auth') {
    mod = 'down'; title = 'Sign in required'; sub = 'Sign in to keep chatting with Zelo.';
    action = `<button type="button" class="aicoach-status-btn" onclick="aiCoachStatusSignIn()">Sign in</button>`;
  } else if (kind === 'limit') {
    mod = 'down'; title = 'Hourly limit reached'; sub = 'Sorry for the inconvenience — try again soon.';
  } else if (kind === 'net') {
    mod = 'down'; title = "You're offline"; sub = 'Sorry for the inconvenience — check your connection.';
  } else {
    mod = 'down'; title = 'Zelo is unavailable'; sub = 'Sorry for the inconvenience.';
  }
  return `
    <span class="aicoach-status-dot" aria-hidden="true"></span>
    <span class="aicoach-status-copy">
      <span class="aicoach-status-title">${title}</span>
      ${sub ? `<span class="aicoach-status-sub">${sub}</span>` : ''}
    </span>
    ${action}`;
}

function _aiCoachStatusPillClass() {
  const st = _aiCoachStatus.state;
  return 'aicoach-status aicoach-status--' + (st === 'up' ? 'up' : st === 'checking' ? 'checking' : 'down');
}

function _aiCoachStatusPill(msg) {
  const el = document.createElement('div');
  el.id = 'aicoach-status-pill';
  el.setAttribute('role', 'status');
  el.className = _aiCoachStatusPillClass();
  el.innerHTML = _aiCoachStatusPillHTML(msg);
  return el;
}

function _updateAiCoachStatusPill() {
  const el = document.getElementById('aicoach-status-pill');
  const msg = _aiCoachLastFailedMsg();
  if (!el || !msg) return;
  el.className = _aiCoachStatusPillClass();
  el.innerHTML = _aiCoachStatusPillHTML(msg);
}

async function retryAiCoachReply() {
  const msg = _aiCoachLastFailedMsg();
  if (!msg) return;
  _aiCoachStopStatusWatch();
  _aiCoachStatusGen++;
  _aiCoachStatusMsg = null;
  msg.content = '…';
  msg.suggestions = [];
  delete msg.failKind;
  renderAiCoachChat();
  await _aiCoachFetchReply(msg);
}

function aiCoachStatusSignIn() {
  if (window.AUTH && AUTH.showEmailScreen) AUTH.showEmailScreen('signin');
}

// Safety net behind the system prompt's "no markdown" instruction — the
// model mostly follows it, but not always. Strips **bold**/*italic*
// asterisks and leading "- "/"* " bullet markers without touching a
// legitimate mid-sentence "*" or "-" (a literal typo character, a math
// symbol) that isn't actually acting as markdown syntax.
function _stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')       // *italic*
    .replace(/^[ \t]*[-*][ \t]+/gm, '') // leading "- " / "* " bullets, per line
    .trim();
}

// Tolerant parse — DeepSeek may wrap JSON in ```json fences or add stray text.
function _parseAiCoachReply(raw) {
  let body = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = body.indexOf('{');
  const end   = body.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1));
      const advice = _stripMarkdown((obj.advice || '').toString().trim());
      const suggestions = Array.isArray(obj.suggestions)
        ? obj.suggestions.map(s => _stripMarkdown(String(s).trim())).filter(Boolean).slice(0, 3)
        : [];
      if (advice) return { advice, suggestions };
    } catch (_) { /* fall through */ }
  }
  return { advice: _stripMarkdown(raw), suggestions: [] };
}

// Persist coach chat onto a thread by id so History previews + a return
// visit pick up where the user left off. Also auto-titles + classifies the
// chat (icon category + pill label) the FIRST time it gets a real user
// message — coachTitle/coachTopic/coachPillText are then fixed for good,
// never re-evaluated as the conversation continues (see the AICOACH CHAT
// CLASSIFICATION comment near _classifyCoachTopic()).
function _persistAiCoachChatToThread(id) {
  if (!id) return;
  const threads = getThreads();
  const thread  = threads.find(t => t.id === id);
  if (!thread) return;
  thread.coachChat = _aiCoachChat;
  if (!thread.coachTitle) {
    const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
    if (firstUserMsg) {
      thread.coachTitle    = _autoShortTitle(firstUserMsg.content);
      thread.coachTopic    = _classifyCoachTopic(firstUserMsg.content);
      thread.coachPillText = _coachPillLabel(thread.coachTopic, firstUserMsg.content);
    }
  }
  saveThreads(threads);
}

// Saves to whichever thread this session's messages actually belong to —
// a thread explicitly linked via History/the link picker, or (failing
// that) the one this session auto-created on first send (see
// _ensureAiCoachAutoThread()). Every existing call site that used to save
// "the linked thread" goes through this now, so an ad-hoc unlinked chat
// keeps saving to its own auto-created thread turn by turn, not just once
// on exit.
function _persistAiCoachChat() {
  _persistAiCoachChatToThread(getLinkedThreadId() || _aiCoachAutoThreadId);
}

function _createAiCoachThreadFromFirstMessage(firstUserMsg) {
  const threads = getThreads();
  const title   = _autoShortTitle(firstUserMsg.content) || 'AI Coach chat';
  const topic   = _classifyCoachTopic(firstUserMsg.content);
  const thread  = {
    id: 'thread_' + Date.now(), name: title, createdAt: Date.now(),
    scans: [], chat: [], coachChat: _aiCoachChat.slice(),
    coachTitle: title, coachTopic: topic, coachPillText: _coachPillLabel(topic, firstUserMsg.content),
  };
  threads.unshift(thread);
  setThreadCount(getThreadCount() + 1);
  saveThreads(threads);
  renderThreadList();
  return thread;
}

// Called right after a real user message lands in _aiCoachChat. If this
// session isn't linked to any thread yet (no History entry, no explicit
// link) and hasn't already auto-created one of its own, create it now —
// instantly, not deferred until the user leaves AI Coach — so it's already
// sitting in chat history, named and all, the moment they check. Deliberately
// doesn't touch getLinkedThreadId()/the on-screen "Linked conversation"
// card — this is a plain ad-hoc chat with no real scan context to show,
// and flipping that mid-conversation would rewrite the greeting under the
// user's feet (see renderAiCoachChat() rebuilding it from scratch on every
// send).
function _ensureAiCoachAutoThread() {
  if (getLinkedThreadId() || _aiCoachAutoThreadId) return;
  const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
  if (!firstUserMsg) return;
  _aiCoachAutoThreadId = _createAiCoachThreadFromFirstMessage(firstUserMsg).id;
}

// ── "How it works" popup (Fix 5 — blank for now) ───────────────
function showAiCoachHowItWorks() { document.getElementById('aicoach-hiw-overlay').hidden = false; }
function hideAiCoachHowItWorks() { document.getElementById('aicoach-hiw-overlay').hidden = true; }

// ── Thread link picker (Fix 7) ─────────────────────────────────
function openThreadLinkPicker() {
  const overlay  = document.getElementById('thread-link-overlay');
  const list     = document.getElementById('thread-link-list');
  if (!overlay || !list) return;
  // Only threads that actually hold generated replies (saved scans) — a
  // thread that exists just because an AI Coach chat auto-created it has no
  // scans and nothing to link as conversation context.
  const threads  = getThreads().filter(t => t.scans && t.scans.length);
  const linkedId = getLinkedThreadId();
  list.innerHTML = '';

  // Remove option — only shown when a thread is currently linked
  if (linkedId) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'thread-link-row thread-link-row--remove';
    removeBtn.innerHTML = `
      <span class="thread-link-avatar">✕</span>
      <span class="thread-link-name">Remove conversation</span>`;
    removeBtn.onclick = () => linkThread(null);
    list.appendChild(removeBtn);
  }

  if (threads.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'thread-link-empty';
    empty.textContent = 'No threads yet. Save a scan to a thread first.';
    list.appendChild(empty);
  } else {
    threads.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'thread-link-row' + (t.id === linkedId ? ' selected' : '');
      // Same real per-style icon + colored circle treatment as History's
      // own thread rows (see renderHistoryList()'s rowIconHTML) — was just
      // a plain letter-initial circle before. .history-row-icon is added
      // alongside .thread-link-avatar so the has-img/onload toggle (which
      // looks for that exact class via .closest()) works the same way;
      // .thread-link-avatar's own (later-cascading) size still wins, so
      // this doesn't change these rows' proportions.
      const lastScan   = t.scans && t.scans.length ? t.scans[t.scans.length - 1] : null;
      const style      = lastScan && lastScan.style;
      const styleColor = STYLE_COLORS[style] || { bg: 'rgba(236,72,153,0.12)', accent: 'var(--accent)' };
      const rowIconHTML = STYLE_LABELS[style]
        ? `<img class="history-row-icon-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt=""
             onload="this.closest('.history-row-icon').classList.add('has-img')" onerror="this.remove()">
           <span class="history-row-icon-svg">${AICOACH_TOPIC_ICONS.reply}</span>`
        : _aiCoachTopicIconHTML('reply');
      btn.innerHTML = `
        <span class="thread-link-avatar history-row-icon" style="background:${styleColor.bg};color:${styleColor.accent}">${rowIconHTML}</span>
        <span class="thread-link-name">${t.name}</span>
        <span class="thread-link-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>`;
      btn.onclick = () => linkThread(t.id);
      list.appendChild(btn);
    });
  }
  overlay.hidden = false;
}

function toggleAiCoachCard() {
  const body    = document.getElementById('aicoach-card-body');
  const sub     = document.getElementById('aicoach-card-sub');
  const chevron = document.getElementById('aicoach-card-chevron');
  if (!body) return;
  const opening = body.hidden;
  body.hidden = !opening;
  if (sub)     sub.hidden = !opening;
  if (chevron) chevron.classList.toggle('aicoach-card-chevron--open', opening);
}

function closeThreadLinkPicker() {
  const overlay = document.getElementById('thread-link-overlay');
  if (overlay) overlay.hidden = true;
}

function linkThread(id) {
  setLinkedThreadId(id);
  closeThreadLinkPicker();
  refreshAiCoachCard();
  // If the AI Coach page is open, reload its context + conversation
  if (state.activeScreen === 'ai-coach') {
    const thread = getLinkedThread();
    _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
    _aiCoachGreetingPushed = _aiCoachChat.length > 0;
    renderAiCoachChat();
  }
}

// ================================================================
// AI COACH — CHAT HISTORY PANEL
// AI Coach conversations already live on the thread they're linked to
// (thread.coachChat, saved by _persistAiCoachChat()) — this panel is a
// nicer, sectioned (Pinned/Recents) way to browse and switch between
// those, not a second parallel storage system. Selecting a row reuses
// linkThread(), the exact same "point AI Coach at a different thread"
// logic the existing thread-link picker already uses.
// ================================================================
let _aiCoachHistoryOpen = false;
let _aiCoachActionsTargetId = null; // which thread the row-actions sheet / rename prompt is open for
let _aiCoachLongPressTimer = null;

function toggleAiCoachHistoryPanel(force) {
  _aiCoachHistoryOpen = typeof force === 'boolean' ? force : !_aiCoachHistoryOpen;
  const main  = document.getElementById('aicoach-main');
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!main || !panel || !scrim) return;
  if (_aiCoachHistoryOpen) {
    // Opening a nav panel is a deliberate, explicit action — unlike the
    // input-bar buttons, there's no reason to keep the keyboard up behind it.
    document.getElementById('aicoach-input')?.blur();
    renderAiCoachHistoryPanel();
  }
  main.classList.toggle('aicoach-main--pushed', _aiCoachHistoryOpen);
  panel.classList.toggle('open', _aiCoachHistoryOpen);
  scrim.classList.toggle('open', _aiCoachHistoryOpen);
}

// A thread lands here from either side: a real AI Coach conversation
// (thread.coachChat) or a generated reply saved straight from the Scan page
// (thread.scans, no coach chat at all) — every generated reply should be
// reachable from this same history, not just ad-hoc coaching chats. A
// thread with both (a scan later discussed in AI Coach) shows whichever
// side was touched more recently.
function _aiCoachHistoryEntries() {
  const linkedId = getLinkedThreadId();
  return getThreads()
    .map(_aiCoachHistoryEntryForThread)
    .filter(Boolean)
    .map(entry => ({ ...entry, active: entry.id === linkedId }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function _aiCoachHistoryEntryForThread(t) {
  const hasCoachChat = Array.isArray(t.coachChat) && t.coachChat.length > 0;
  const lastScan = Array.isArray(t.scans) && t.scans.length ? t.scans[t.scans.length - 1] : null;
  if (!hasCoachChat && !lastScan) return null;

  const lastCoachMsg = hasCoachChat ? t.coachChat[t.coachChat.length - 1] : null;
  const coachTime = lastCoachMsg ? (lastCoachMsg.time || 0) : -1;
  const scanTime  = lastScan ? (lastScan.time || 0) : -1;
  const useCoach  = hasCoachChat && coachTime >= scanTime;

  if (useCoach) {
    return {
      id: t.id,
      title: t.coachTitle || t.name,
      topic: t.coachTopic || 'advice',
      pillText: t.coachPillText || 'Situation advice',
      preview: (lastCoachMsg && lastCoachMsg.content) || '',
      pinned: !!t.coachPinned,
      updatedAt: coachTime,
    };
  }
  const styleLabel = STYLE_LABELS[lastScan.style] || 'Reply';
  return {
    id: t.id,
    title: t.name,
    topic: 'reply',
    style: lastScan.style || null,
    pillText: styleLabel + ' reply',
    preview: lastScan.reply || '',
    pinned: !!t.coachPinned,
    updatedAt: scanTime,
  };
}

// A 'reply' entry (whether a generated scan, which knows its style
// directly, or an ad-hoc AI Coach chat that mentioned one by name — same
// keyword match _coachPillLabel() already uses for its pill text) gets its
// actual reply-style icon (smooth/funny/warmer/direct/bolder/shorter/
// longer) instead of the generic reply-bubble icon — a real, specific
// picture of what was generated rather than a topic placeholder.
function _aiCoachHistoryRowStyle(entry) {
  if (entry.topic !== 'reply') return null;
  if (entry.style && STYLE_LABELS[entry.style]) return entry.style;
  const low = `${entry.title || ''} ${entry.preview || ''}`.toLowerCase();
  return Object.keys(STYLE_LABELS).find(k => low.includes(k)) || null;
}

function _aiCoachHistoryRowHTML(entry) {
  const style      = _aiCoachHistoryRowStyle(entry);
  const styleTheme = style ? STYLE_COLORS[style] : null;
  const colors     = styleTheme || AICOACH_TOPIC_COLORS[entry.topic] || AICOACH_TOPIC_COLORS.advice;
  const iconHTML = style
    ? `<img class="aicoach-history-row-icon-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt=""
         onload="this.closest('.aicoach-history-row-icon').classList.add('has-img')" onerror="this.remove()">
       <span class="aicoach-history-row-icon-svg">${AICOACH_TOPIC_ICONS[entry.topic] || AICOACH_TOPIC_ICONS.advice}</span>`
    : _aiCoachTopicIconHTML(entry.topic);
  // Always paint the colored circle, styled or not — see the matching
  // comment in renderHistory() (script.js): reply-style crops don't carry
  // their own backdrop like the AI Coach brand gem does, so going
  // transparent exposes their soft drop-shadow edge directly against the
  // row background, which reads as a poorly-cropped smudge in dark mode.
  return `
    <button type="button" class="aicoach-history-row${entry.active ? ' selected' : ''}" data-thread-id="${entry.id}" onclick="aiCoachHistorySelect('${entry.id}')">
      <span class="aicoach-history-row-icon" style="background:${colors.bg};color:${colors.accent}">${iconHTML}</span>
      <span class="aicoach-history-row-main">
        <span class="aicoach-history-row-top">
          <span class="aicoach-history-row-title">${_escapeHtml(entry.title)}</span>
          <span class="aicoach-history-row-time">${_scanHistoryTime(entry.updatedAt)}</span>
        </span>
        <span class="aicoach-history-row-preview">${_escapeHtml(entry.preview)}</span>
        <span class="aicoach-history-row-pill" style="background:${colors.bg};color:${colors.accent}">${entry.pillText}</span>
      </span>
      ${entry.pinned ? '<span class="aicoach-history-pin-dot" aria-hidden="true"></span>' : ''}
    </button>`;
}

function renderAiCoachHistoryPanel() {
  const list = document.getElementById('aicoach-history-list');
  if (!list) return;
  const entries = _aiCoachHistoryEntries();
  const pinned  = entries.filter(e => e.pinned);
  const recents = entries.filter(e => !e.pinned);

  if (!entries.length) {
    list.innerHTML = '<p class="aicoach-history-empty">No coaching chats yet — start one from a thread’s AI Coach card.</p>';
  } else {
    let html = '';
    if (pinned.length)  html += '<div class="aicoach-history-section-label">Pinned</div>'  + pinned.map(_aiCoachHistoryRowHTML).join('');
    if (recents.length) html += '<div class="aicoach-history-section-label">Recents</div>' + recents.map(_aiCoachHistoryRowHTML).join('');
    list.innerHTML = html;
  }

  // Long-press (pin/rename/delete) needs its own touchstart/move/end
  // sequencing, not a single tap — attached here rather than as inline
  // HTML attributes.
  list.querySelectorAll('.aicoach-history-row').forEach(row => {
    const id = row.dataset.threadId;
    row.addEventListener('touchstart', () => {
      clearTimeout(_aiCoachLongPressTimer);
      _aiCoachLongPressTimer = setTimeout(() => openAiCoachRowActions(id), 500);
    }, { passive: true });
    row.addEventListener('touchmove', () => clearTimeout(_aiCoachLongPressTimer), { passive: true });
    row.addEventListener('touchend',  () => clearTimeout(_aiCoachLongPressTimer), { passive: true });
  });
}

function aiCoachHistorySelect(id) {
  linkThread(id);
  toggleAiCoachHistoryPanel(false);
}

// This called openThreadLinkPicker() before — the "link to an existing
// thread" picker, not a fresh conversation — so "New chat" actually took
// you to pick an EXISTING thread and land in that conversation instead of
// starting a blank one. linkThread(null) unlinks + clears _aiCoachChat +
// re-renders (same reset openAiCoach() itself does for a linkless open),
// mirrored here with the same extra resets that path also does.
function aiCoachHistoryNewChat() {
  linkThread(null);
  _aiCoachAutoThreadId = null;
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  aiCoachRemovePhoto();
  toggleAiCoachHistoryPanel(false);
}

function openAiCoachRowActions(id) {
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  _aiCoachActionsTargetId = id;
  document.getElementById('aicoach-row-actions-title').textContent = thread.coachTitle || thread.name;
  const pinned = !!thread.coachPinned;
  document.getElementById('aicoach-row-actions-pin').innerHTML = `
    <span class="aicoach-row-actions-icon"><img src="assets/icons/misc/row-action-pin.png" alt=""></span>
    <span class="aicoach-row-actions-text">
      <span class="aicoach-row-actions-label">${pinned ? 'Unpin' : 'Pin'}</span>
      <span class="aicoach-row-actions-desc">${pinned ? 'Remove from the top' : 'Keep this chat at the top'}</span>
    </span>`;
  document.getElementById('aicoach-row-actions-overlay').hidden = false;
}

function closeAiCoachRowActions() {
  document.getElementById('aicoach-row-actions-overlay').hidden = true;
  _aiCoachActionsTargetId = null;
}

function aiCoachHistoryTogglePin() {
  const id = _aiCoachActionsTargetId;
  if (!id) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (!thread) return;
  thread.coachPinned = !thread.coachPinned;
  saveThreads(threads);
  closeAiCoachRowActions();
  renderAiCoachHistoryPanel();
}

function aiCoachHistoryRename() {
  const id = _aiCoachActionsTargetId; // keep it set — the rename overlay reuses it
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  document.getElementById('aicoach-row-actions-overlay').hidden = true;
  const input = document.getElementById('aicoach-rename-input');
  input.value = thread.coachTitle || thread.name;
  document.getElementById('aicoach-rename-overlay').hidden = false;
  setTimeout(() => input.focus(), 60);
}

function closeAiCoachRenamePrompt() {
  document.getElementById('aicoach-rename-overlay').hidden = true;
  _aiCoachActionsTargetId = null;
}

function aiCoachHistoryRenameConfirm() {
  const id = _aiCoachActionsTargetId;
  const input = document.getElementById('aicoach-rename-input');
  if (!id || !input) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (thread) {
    thread.coachTitle = input.value.trim() || undefined;
    saveThreads(threads);
  }
  closeAiCoachRenamePrompt();
  renderAiCoachHistoryPanel();
}

function aiCoachHistoryDelete() {
  const id = _aiCoachActionsTargetId;
  if (!id) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (thread) {
    thread.coachChat = [];
    thread.coachPinned = false;
    thread.coachTitle = undefined;
    saveThreads(threads);
    if (thread.id === getLinkedThreadId() && state.activeScreen === 'ai-coach') {
      _aiCoachChat = [];
      renderAiCoachChat();
    }
  }
  closeAiCoachRowActions();
  renderAiCoachHistoryPanel();
}


// ================================================================
// FEATURE 9 — LEADERBOARD
// Paid only. Entry from dashboard. Mocked static data.
// ================================================================

function getDisplayName() {
  let name = localStorage.getItem('zelo_display_name');
  if (!name) {
    name = 'Player #' + String(Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('zelo_display_name', name);
  }
  return name;
}

function saveDisplayName(name) {
  localStorage.setItem('zelo_display_name', name.trim() || getDisplayName());
}

// ================================================================
// REFER FRIENDS — see screen-refer-friends in index.html.
// ================================================================
// Generated once and persisted, same pattern as getDisplayName()'s own
// "Player #XXXX" — reuses those same digits (so the two stay recognizably
// linked) plus two stable letters, never re-rolled on later visits.
function getReferralCode() {
  let code = localStorage.getItem('zelo_referral_code');
  if (!code) {
    const digits = (getDisplayName().match(/\d+/) || [])[0] || String(Math.floor(1000 + Math.random() * 9000));
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no O/I — avoids look-alike-digit confusion
    code = digits + letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    localStorage.setItem('zelo_referral_code', code);
  }
  return code;
}
function getReferralLink() { return 'https://zelo.app/join/' + getReferralCode(); }

function openReferFriends() {
  document.getElementById('refer-link-text').textContent = getReferralLink();
  pushScreen('refer-friends');
}
function closeReferFriends() { popScreen(); }

function copyReferralLink() {
  navigator.clipboard?.writeText(getReferralLink()).then(() => showCopyToast('Referral link copied to clipboard')).catch(() => {});
}

// Every share entry point (the big button and all 4 app-row icons) funnels
// here — there's no real per-app deep-link integration, so the honest
// behavior is the OS share sheet (the user picks Messages/WhatsApp/
// Instagram/whatever themselves from there), falling back to a plain
// clipboard copy if the Web Share API isn't available at all.
function shareReferral() {
  ZeloAnalytics.track('referral_link_shared');
  const shareData = { title: 'Zelo', text: "Join me on Zelo!", url: getReferralLink() };
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    copyReferralLink();
  }
}

let lbTimeFilter = 'weekly';
let lbCategory   = 'messages';

function openLeaderboard() {
  // DEV — restore paid gate before release
  // if (!isPaidUser()) {
  //   flashLimitToast('Leaderboard is a paid feature.');
  //   return;
  // }
  lbTimeFilter = 'weekly';
  lbCategory   = 'messages';
  renderLeaderboard();
  pushScreen('leaderboard');
}

function setLbTimeFilter(f) { lbTimeFilter = f; renderLeaderboard(); }
function setLbCategory(c)   { lbCategory   = c; renderLeaderboard(); }

// Leaderboard settings sheet — skeleton only. Toggles flip their own
// switch visually; nothing is persisted or wired to real behavior yet
// (same build-architecture-first convention as the rest of this screen).
function openLeaderboardSettings() {
  const sheet = document.getElementById('lb-settings-sheet');
  if (sheet) sheet.hidden = false;
}
function closeLeaderboardSettings() {
  const sheet = document.getElementById('lb-settings-sheet');
  if (sheet) sheet.hidden = true;
}
function toggleLbSetting(el) {
  navigator.vibrate?.(4);
}

// Shared rank lookup — used by the full leaderboard screen and by the
// Account page's compact leaderboard card, so both always agree.
function getMyLeaderboardEntry() {
  const data   = getLbData(lbTimeFilter, lbCategory);
  const myName = getDisplayName();
  return data.find(e => e.name === myName) || { rank: data.length + 1, name: myName, score: 0 };
}

const LB_UNITS = { streak: 'days', messages: 'messages', level: 'levels' };

function renderLeaderboard() {
  const data       = getLbData(lbTimeFilter, lbCategory);
  const myName     = getDisplayName();
  const myEntry    = getMyLeaderboardEntry();
  const unit       = LB_UNITS[lbCategory] || 'points';

  // Time filter tabs
  ['weekly','monthly','alltime'].forEach(f => {
    const btn = document.getElementById('lb-time-' + f);
    if (btn) btn.classList.toggle('active', f === lbTimeFilter);
  });
  // Category tabs
  ['streak','messages','level'].forEach(c => {
    const btn = document.getElementById('lb-cat-' + c);
    if (btn) btn.classList.toggle('active', c === lbCategory);
  });

  // Podium (top 3) — pedestal/crown art is the cropped, blank
  // hero-podium-blank.png (no baked-in badge/text, see index.html). The
  // rank number is a big, softly-blended watermark baked into the
  // pedestal background (.lb-podium-rank-bg); name/score/unit are a
  // tight text cluster overlapping it, not spread down toward the base.
  const podium = document.getElementById('lb-podium');
  if (podium && data.length >= 3) {
    const order = [data[1], data[0], data[2]]; // left=2nd, center=1st, right=3rd
    const rankWord = { 1: 'first', 2: 'second', 3: 'third' };
    podium.innerHTML = order.map(e => {
      const r = rankWord[e.rank];
      return `
        <div class="lb-podium-rank-bg lb-podium-rank-bg--${r}">${e.rank}</div>
        <div class="lb-podium-name lb-podium-name--${r}">${e.name}</div>
        <div class="lb-podium-score lb-podium-score--${r}">${e.score}</div>
        <div class="lb-podium-unit lb-podium-unit--${r}">${unit}</div>`;
    }).join('');
  }

  // "Keep going!" motivational line — distance to the next rank up. Not
  // every anonymous player is actually IN the mock 100-entry dataset (see
  // getMyLeaderboardEntry()'s synthetic fallback) — for those, "next rank
  // up" is the lowest real entry rather than nothing.
  const motivEl = document.getElementById('lb-motivation');
  if (motivEl) {
    const myIdxInData = data.findIndex(e => e.name === myEntry.name);
    const aheadIdx = myIdxInData >= 0 ? myIdxInData - 1 : data.length - 1;
    const ahead = aheadIdx >= 0 ? data[aheadIdx] : null;
    if (ahead && ahead.score > myEntry.score) {
      motivEl.textContent = `📈 Keep going! You're ${ahead.score - myEntry.score} ${unit} away from #${ahead.rank}`;
      motivEl.hidden = false;
    } else {
      motivEl.hidden = true;
    }
  }

  // List (rank 4+)
  const listEl = document.getElementById('lb-list');
  if (listEl) {
    listEl.innerHTML = data.slice(3).map(e => `
      <div class="lb-list-row${e.name === myName ? ' lb-list-row--me' : ''}">
        <span class="lb-list-rank">${e.rank}</span>
        <div class="lb-list-avatar"></div>
        <span class="lb-list-name">${e.name}</span>
        <span class="lb-list-score">${e.score}</span>
        <span class="lb-list-badge">${e.rank === 1 ? '👑' : e.rank <= 10 ? '🥇' : '🥉'}</span>
      </div>`).join('');
  }

  // Pinned own rank
  const pinEl = document.getElementById('lb-my-rank');
  if (pinEl) {
    pinEl.innerHTML = `
      <span class="lb-list-rank">#${myEntry.rank}</span>
      <div class="lb-list-avatar"></div>
      <span class="lb-list-name">${myEntry.name} (you)</span>
      <span class="lb-list-score">${myEntry.score}</span>`;
  }
}

function getLbData(timeFilter, category) {
  return (LEADERBOARD_DATA[category] || {})[timeFilter] || [];
}

function openLeaderboardFromDash() {
  popScreen();   // close dashboard first
  setTimeout(() => openLeaderboard(), 50);
}


// ================================================================
// YOUR JOURNEY  (Streak & Badges — opened from the Streak widget card)
// All values are hardcoded dummy data, same convention as the widget
// cards themselves (7-day streak, etc.) — no Supabase calls.
// ================================================================

// 7-slot week strip — reset to a fresh 0-day streak: nothing done yet,
// today still upcoming (not yet checked in).
const JOURNEY_WEEK = ['upcoming', 'upcoming', 'upcoming', 'upcoming', 'today', 'upcoming', 'upcoming'];

function renderJourneyDots() {
  const wrap = document.getElementById('journey-dots');
  if (!wrap) return;
  wrap.innerHTML = JOURNEY_WEEK.map(state => {
    if (state === 'done') {
      return `<span class="journey-dot journey-dot--done">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>`;
    }
    if (state === 'today') {
      return `<span class="journey-dot journey-dot--today">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>`;
    }
    return `<span class="journey-dot journey-dot--upcoming"></span>`;
  }).join('');
}

// Streak hero + badge row are static real-cropped-image markup now (see
// index.html) — this page specifically uses cropped reference art rather
// than the inline-SVG icon system the Milestones pages use, per explicit
// direction. Nothing to render here anymore.
function openJourney() {
  renderJourneyDots();
  const countEl = document.querySelector('.journey-badges-count');
  if (countEl) countEl.textContent = `${getTotalUnlockedCount()}/${MILESTONE_BADGES.length} unlocked`;
  pushScreen('journey');
}

function closeJourney() { popScreen(); }


// ================================================================
// XP / LEVEL SYSTEM
// Real, persisted, currently wired to 3 concrete trigger points that
// already exist elsewhere in this file — sendMessage() (message sent, any
// chat), recordScan() (a real scan completed), startChat() (a brand-new
// conversation, not reopening one from history). Everything else in the
// full gamification spec (daily quests, referral-signup XP, revival
// detection, weekly leaderboard rank bonus) has no real trigger to hook
// into yet — this is the honest subset that's actually backed by real
// usage right now, not a mock waiting to be swapped later.
//
// Level curve (verified against the spec's own cumulative-XP numbers):
// tier rates apply to the LEVEL YOU'RE LEAVING, e.g. every step from
// level 1..5 costs 200 XP each (5 steps to clear the 1-5 tier = 1,000,
// landing on level 6) — this is the only rate assignment that reproduces
// all five "cumulative XP" figures in the spec (1000/3000/6500/11300/12800)
// exactly, so it's not a guess.
// ================================================================
const XP_MAX_LEVEL = 20;
const XP_LEVEL_RATES = [
  { minLevel: 1,  maxLevel: 5,  rate: 200  },
  { minLevel: 6,  maxLevel: 10, rate: 400  },
  { minLevel: 11, maxLevel: 15, rate: 700  },
  { minLevel: 16, maxLevel: 19, rate: 1200 },
  { minLevel: 20, maxLevel: 20, rate: 1500 },
];
function _xpRateForLevel(level) {
  const tier = XP_LEVEL_RATES.find(t => level >= t.minLevel && level <= t.maxLevel);
  return tier ? tier.rate : XP_LEVEL_RATES[XP_LEVEL_RATES.length - 1].rate;
}
// XP_LEVEL_THRESHOLDS[L] = cumulative XP needed to BE at level L.
// Index 21 exists only so level 20's own progress bar has a ceiling to
// fill toward (spec's "20 (max) — 1,500 XP").
const XP_LEVEL_THRESHOLDS = (() => {
  const arr = [null, 0];
  for (let lvl = 1; lvl <= XP_MAX_LEVEL; lvl++) arr[lvl + 1] = arr[lvl] + _xpRateForLevel(lvl);
  return arr;
})();

const XP_TIERS = [
  { minLevel: 1,  maxLevel: 5,  icon: 'level-tier-sprout',  label: '1 - 5',    title: 'Sprout',  rateLabel: '200 XP/level'   },
  { minLevel: 6,  maxLevel: 10, icon: 'level-tier-planet',  label: '6 - 10',   title: 'Orbiter', rateLabel: '400 XP/level'   },
  { minLevel: 11, maxLevel: 15, icon: 'level-tier-star',    label: '11 - 15',  title: 'Star',    rateLabel: '700 XP/level'   },
  { minLevel: 16, maxLevel: 19, icon: 'level-tier-crystal', label: '16 - 19',  title: 'Crystal', rateLabel: '1,200 XP/level' },
  { minLevel: 20, maxLevel: 20, icon: 'level-tier-crown',   label: '20 (max)', title: 'Crown',   rateLabel: '1,500 XP'       },
];
function getTierForLevel(level) {
  return XP_TIERS.find(t => level >= t.minLevel && level <= t.maxLevel) || XP_TIERS[0];
}

function getLevelForXP(xp) {
  let level = 1;
  for (let lvl = 2; lvl <= XP_MAX_LEVEL; lvl++) {
    if (xp >= XP_LEVEL_THRESHOLDS[lvl]) level = lvl; else break;
  }
  return level;
}
// { level, into, span, pct } — into/span is progress toward the NEXT
// level (or, at level 20, toward the spec's final 1,500-XP "fully maxed"
// ceiling — there's no level 21, just a bar that keeps filling).
function getLevelProgress(xp) {
  const level = getLevelForXP(xp);
  const floor = XP_LEVEL_THRESHOLDS[level];
  const ceil  = XP_LEVEL_THRESHOLDS[level + 1];
  const into  = Math.max(0, xp - floor);
  const span  = Math.max(1, ceil - floor);
  return { level, into, span, pct: Math.min(1, into / span), maxed: level === XP_MAX_LEVEL && xp >= ceil };
}

let _xp = Number(localStorage.getItem('zelo_xp') || 0);
function getXP() { return _xp; }
function setXP(xp) {
  _xp = Math.max(0, xp);
  localStorage.setItem('zelo_xp', String(_xp));
}

// Per-source daily caps — see the "1. XP Sources" table. Referral-sent/
// referral-signup, daily quests, and weekly rank bonus are deliberately
// not here; see the comment on this whole section for why.
const XP_SOURCES = {
  message:      { xp: 2,  dailyCap: 20, label: 'Message sent!' },
  scan:         { xp: 5,  dailyCap: 10, label: 'Scan complete!' },
  conversation: { xp: 10, dailyCap: 5,  label: 'New conversation!' },
};

function _xpDailyState() {
  let s;
  try { s = JSON.parse(localStorage.getItem('zelo_xp_daily') || '{}'); } catch { s = {}; }
  if (s.date !== todayKey()) s = { date: todayKey() };
  return s;
}
function _saveXpDailyState(s) { localStorage.setItem('zelo_xp_daily', JSON.stringify(s)); }

// Awards XP for a source in XP_SOURCES, respecting its daily cap. Returns
// the amount actually awarded (0 if today's cap for that source is
// already used up) — callers don't need to pre-check anything themselves.
function awardXP(source) {
  if (subscriptionExpired()) return 0; // locked: nothing earns XP (or moves the streak/levels)
  const spec = XP_SOURCES[source];
  if (!spec) return 0;
  const daily = _xpDailyState();
  const used = daily[source] || 0;
  if (spec.dailyCap != null && used >= spec.dailyCap) return 0;
  daily[source] = used + 1;
  _saveXpDailyState(daily);

  const before = getXP();
  const beforeLevel = getLevelForXP(before);
  setXP(before + spec.xp);
  const afterLevel = getLevelForXP(getXP());
  ZeloAnalytics.track('xp_earned', { source, amount: spec.xp });
  if (afterLevel > beforeLevel) ZeloAnalytics.track('level_up', { level: afterLevel });

  showXPPanel(spec.xp, spec.label, before);
  // Sequenced, not simultaneous — both panels sit in the same spot
  // on-screen, so a level-up crossed by this award waits for the XP
  // panel's own visible window to finish before taking its place.
  if (afterLevel > beforeLevel) setTimeout(() => showLevelUpPanel(afterLevel, beforeLevel), 1900);
  // Mission Control's level card only exists in the DOM while that screen
  // is the active one — cheap to just always try, no-ops otherwise.
  if (state.activeScreen === 'mission-control') renderMissionLevelCard();
  return spec.xp;
}

// ---- XP gain / Level-up panels — see the .xp-panel comment in style.css
// for the shared markup/CSS both of these drive. ----
// Both panels sit above the Zelo header (position:fixed, safe-area-aware
// top), same convention as .streak-notif — see that CSS comment. That
// deliberately sidesteps needing any per-screen offset: a screen-specific
// pixel value here previously had to guess how tall each screen's own
// header renders once the real device's safe-area inset is added in
// (headless testing never renders a notch, so any such value calibrated
// there is only correct on hardware with zero safe-area-inset-top) —
// positioning above the header entirely removes that guess.
let _xpPanelTimer = null;
let _xpCountUpFrame = null;

// Animates the progress bar/text from `fromInto` up to `toInto` (out of
// `span`), ticking a light haptic every few counted points so the buzz
// tracks the number actually moving rather than firing once flat. Distinct
// from the single on-popup buzz in showXPPanel — this one repeats for the
// duration of the count-up.
function _xpPanelCountUp(fromInto, toInto, span, level) {
  const fillEl = document.getElementById('xp-panel-bar-fill');
  const textEl = document.getElementById('xp-panel-bar-text');
  if (!fillEl || !textEl) return;
  cancelAnimationFrame(_xpCountUpFrame);
  const isMax = level >= XP_MAX_LEVEL && toInto >= span;
  const duration = 700;
  const start = performance.now();
  let lastTick = fromInto;
  const render = (into) => {
    fillEl.style.width = Math.round(Math.min(1, into / span) * 100) + '%';
    textEl.textContent = (isMax && into >= toInto)
      ? `${getXP().toLocaleString()} XP — MAX`
      : `${into.toLocaleString()} / ${span.toLocaleString()} XP`;
  };
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const into = Math.round(fromInto + (toInto - fromInto) * eased);
    render(into);
    if (into - lastTick >= 4) { lastTick = into; navigator.vibrate?.(1); _cineHaptic('LIGHT'); }
    if (t < 1) { _xpCountUpFrame = requestAnimationFrame(frame); }
    else { render(toInto); }
  }
  _xpCountUpFrame = requestAnimationFrame(frame);
}

function showXPPanel(amount, sourceLabel, beforeXP, force) {
  if (SUPPRESS_XP_LEVEL_NOTIFS && !force) return;
  const panel = document.getElementById('xp-panel');
  if (!panel) return;
  document.getElementById('xp-panel-title').textContent = `+${amount} XP`;
  document.getElementById('xp-panel-sub').textContent = sourceLabel || 'Nice!';

  const after = getLevelProgress(getXP());
  const before = beforeXP != null ? getLevelProgress(beforeXP) : after;
  // If this award crossed a level, the old bar doesn't visually carry over
  // (it belonged to a different, now-finished level) — start the count-up
  // from empty instead of animating across two different bars' worth of span.
  const startInto = before.level === after.level ? before.into : 0;

  document.getElementById('xp-panel-bar-fill').style.width = Math.round(Math.min(1, startInto / after.span) * 100) + '%';
  document.getElementById('xp-panel-bar-text').textContent = `${startInto.toLocaleString()} / ${after.span.toLocaleString()} XP`;

  panel.hidden = false;
  clearTimeout(_xpPanelTimer);
  requestAnimationFrame(() => panel.classList.add('visible'));
  navigator.vibrate?.(4); _cineHaptic('LIGHT'); // single buzz to confirm the popup itself
  setTimeout(() => _xpPanelCountUp(startInto, after.into, after.span, after.level), 260);
  _xpPanelTimer = setTimeout(hideXPPanel, 2600);
}
function hideXPPanel() {
  const panel = document.getElementById('xp-panel');
  if (!panel || panel.hidden) return;
  clearTimeout(_xpPanelTimer);
  cancelAnimationFrame(_xpCountUpFrame);
  panel.classList.remove('visible');
  setTimeout(() => { panel.hidden = true; }, 340);
}

let _levelUpPanelTimers = [];
function showLevelUpPanel(newLevel, beforeLevel, force) {
  if (SUPPRESS_XP_LEVEL_NOTIFS && !force) return;
  const panel = document.getElementById('levelup-panel');
  if (!panel) return;
  _levelUpPanelTimers.forEach(clearTimeout);
  _levelUpPanelTimers = [];
  const oldLevel = beforeLevel != null ? beforeLevel : Math.max(1, newLevel - 1);

  document.getElementById('levelup-panel-sub').textContent = `You're now Level ${newLevel} 🔥`;
  // Static, matching the reference's own fixed line — not tier-derived
  // (an earlier version tried "Keep going, sprout master." for tier 1,
  // which reads worse than just keeping the reference's actual copy).
  document.getElementById('levelup-panel-tertiary').textContent = 'Keep going, rizz master.';

  // Starting state: icon shows the OLD level's tier icon, same "before"
  // beat as showStreakNotif() — see that function for the reference
  // pattern this reuses (streakNotifNumOut/In keyframes, just driving an
  // <img> pair instead of two number spans).
  const oldTier = getTierForLevel(oldLevel);
  document.getElementById('levelup-icon-old').src = `assets/icons/xp-levels/${oldTier.icon}.png`;
  document.getElementById('levelup-icon-roll').classList.remove('xp-panel-icon-roll--rolling');

  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('visible'));
  navigator.vibrate?.(4); _cineHaptic('LIGHT'); // single buzz to confirm the popup itself

  // Roll to the new (star) icon shortly after appearing, same beat as the
  // streak notif's own dot-check-then-roll sequence.
  _levelUpPanelTimers.push(setTimeout(() => {
    document.getElementById('levelup-icon-roll').classList.add('xp-panel-icon-roll--rolling');
    navigator.vibrate?.(12); _cineHaptic('MEDIUM');
  }, 500));

  _levelUpPanelTimers.push(setTimeout(hideLevelUpPanel, 3200));
}
function hideLevelUpPanel() {
  const panel = document.getElementById('levelup-panel');
  if (!panel || panel.hidden) return;
  _levelUpPanelTimers.forEach(clearTimeout);
  panel.classList.remove('visible');
  setTimeout(() => { panel.hidden = true; }, 340);
}

// ================================================================
// MISSION CONTROL  (opened from the Activity widget card)
// The level card is the one real piece here — see the XP/LEVEL SYSTEM
// block above. "This Week" stats and Daily Missions stay mocked (no
// real per-day activity log or quest-selection system exists yet).
// ================================================================

function renderMissionLevelCard() {
  const xp = getXP();
  const { level, into, span, pct } = getLevelProgress(xp);
  const tier = getTierForLevel(level);
  document.getElementById('mission-level-tier-icon').src = `assets/icons/xp-levels/${tier.icon}.png`;
  document.getElementById('mission-level-num').textContent = level;
  document.getElementById('mission-level-title').textContent = tier.title;
  document.getElementById('mission-xp-fill').style.width = Math.round(pct * 100) + '%';
  document.getElementById('mission-xp-text').textContent =
    level >= XP_MAX_LEVEL && pct >= 1 ? `${xp.toLocaleString()} XP — MAX` : `${into.toLocaleString()} / ${span.toLocaleString()} XP`;
}

function openMissionControl() {
  renderMissionLevelCard();
  _bindMissionTierPreviewToggle();
  pushScreen('mission-control');
}

function closeMissionControl() { popScreen(); }

// "Keep it going"/"Revive a dead conversation" missions are both about an
// EXISTING conversation, not starting a new one — so unlike "Start a
// conversation" (always -> Practice's swipe deck), these send the user to
// their real chat list when they already have one, and only fall back to
// Practice when there's nothing to go back to yet.
function missionGoToChatOrPractice() {
  closeMissionControl();
  showTab(chatStore.length > 0 ? 'chats' : 'practice');
}

// ================================================================
// TIER PREVIEW — HIDDEN DEV TOGGLE
// Same "buried behind a long-press on an unobtrusive element" pattern as
// bindDevPaceToggle() above. There's no way to set a real device's XP from
// this dev environment, and racking up enough real XP to reach a given
// tier legitimately can take weeks (XP_SOURCES' daily caps top out at 140
// XP/day) — so a long-press on the tier icon itself cycles straight to the
// next tier's starting level, entirely on-device, no Safari Web Inspector
// or Mac needed. Purely a preview: it overwrites real XP, so it's a one-way
// door for whoever uses it, same tradeoff devPaceLongPressTimer accepts.
// ================================================================
let missionTierPreviewTimer = null;

function _bindMissionTierPreviewToggle() {
  const el = document.getElementById('mission-level-tier-icon');
  if (!el || el.dataset.devBound) return;
  el.dataset.devBound = '1';

  const start = () => { missionTierPreviewTimer = setTimeout(_missionPreviewNextTier, 600); };
  const cancel = () => clearTimeout(missionTierPreviewTimer);

  el.addEventListener('mousedown',  start);
  el.addEventListener('touchstart', start, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt =>
    el.addEventListener(evt, cancel)
  );
}

function _missionPreviewNextTier() {
  const currentTier = getTierForLevel(getLevelForXP(getXP()));
  const idx = XP_TIERS.indexOf(currentTier);
  const nextTier = XP_TIERS[(idx + 1) % XP_TIERS.length];
  setXP(XP_LEVEL_THRESHOLDS[nextTier.minLevel]);
  renderMissionLevelCard();
  navigator.vibrate?.(8);
}

// ---- "How to Level Up" info modal — replaces the old leaderboard
// shortcut in Mission Control's top-right corner ----
function openLevelUpInfo() {
  document.getElementById('levelup-modal-overlay').hidden = false;
}
function closeLevelUpInfo() {
  document.getElementById('levelup-modal-overlay').hidden = true;
}


// ================================================================
// MILESTONES  (Achievement badge system)
// Hub (screen-milestones): day-streak and badge totals, then one section
// per category with its badges 3 across. Tapping a badge opens the badge
// sheet; its Share button opens the share sheet. Data lives in
// MILESTONE_CATEGORIES / MILESTONE_BADGES (data.js). Each badge's `icon`
// names its art in assets/icons/milestones/ — the -dark sibling is swapped
// in automatically by ICONS_WITH_DARK_VARIANT.
// ================================================================

const MILESTONE_ART_DIR = 'assets/icons/milestones/';

function milestoneArtSrc(name) { return `${MILESTONE_ART_DIR}${name}.png`; }

// Numbers are drawn from the digit glyph art, not the system font.
function milestoneDigitsHTML(value) {
  return String(value).split('').map(ch =>
    `<img class="ms-digit" src="${MILESTONE_ART_DIR}digit-${ch}.png" alt="${ch}">`
  ).join('');
}

function getMilestoneCategory(catId) {
  return MILESTONE_CATEGORIES.find(c => c.id === catId) || null;
}
function getCategoryBadges(catId) {
  return MILESTONE_BADGES.filter(b => b.category === catId);
}
// "Zelo Legend" (dynamic:'all-badges') is unlocked once every OTHER
// badge is — not by its own static progress/target, so it can't
// self-reference into an infinite loop.
function isBadgeUnlocked(badge) {
  if (badge.dynamic === 'all-badges') {
    return MILESTONE_BADGES.filter(b => b.id !== badge.id).every(isBadgeUnlocked);
  }
  return badge.progress >= badge.target;
}
function getCategoryUnlockedCount(catId) {
  return getCategoryBadges(catId).filter(isBadgeUnlocked).length;
}
function getTotalUnlockedCount() {
  return MILESTONE_BADGES.filter(isBadgeUnlocked).length;
}

function openMilestones() {
  renderMilestonesHub();
  pushScreen('milestones');
}

function renderMilestonesHub() {
  const totalUnlocked = getTotalUnlockedCount();
  const total = MILESTONE_BADGES.length;

  document.getElementById('milestones-streak-digits').innerHTML = milestoneDigitsHTML(0);
  document.getElementById('milestones-longest-streak').textContent = '0';
  document.getElementById('milestones-badges-digits').innerHTML = milestoneDigitsHTML(totalUnlocked);
  document.getElementById('milestones-badges-frac').textContent = `${totalUnlocked}/${total}`;
  document.getElementById('milestones-badges-progress-fill').style.width =
    Math.round((totalUnlocked / total) * 100) + '%';

  document.getElementById('milestones-sections').innerHTML = MILESTONE_CATEGORIES.map((cat, i) => {
    const tiles = getCategoryBadges(cat.id).map(b => `
      <button class="ms-badge${isBadgeUnlocked(b) ? '' : ' ms-badge--locked'}" type="button" onclick="openBadgeDetail('${b.id}')">
        <img class="ms-badge-art" src="${milestoneArtSrc(b.icon)}" alt="">
        <span class="ms-badge-name">${b.name}</span>
        <span class="ms-badge-req">${b.requirement}</span>
      </button>`).join('');
    return `${i > 0 ? '<hr class="ms-section-divider">' : ''}
      <section class="ms-section">
        <h2 class="ms-section-title">${cat.name} Milestones</h2>
        <p class="ms-section-sub">${cat.description}</p>
        <div class="ms-grid">${tiles}</div>
      </section>`;
  }).join('');
}

// ---- Sheets (badge + share) ----
let _milestoneSheetBadgeId = null;

function _milestoneOpenSheet(overlayId) {
  const ov = document.getElementById(overlayId);
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add('is-open'));
}
function _milestoneCloseSheet(overlayId) {
  const ov = document.getElementById(overlayId);
  ov.classList.remove('is-open');
  setTimeout(() => { ov.hidden = true; }, 320);
}

function openBadgeDetail(badgeId) {
  const badge = MILESTONE_BADGES.find(b => b.id === badgeId);
  if (!badge) return;
  _milestoneSheetBadgeId = badgeId;
  const done = isBadgeUnlocked(badge);

  const art = document.getElementById('badge-sheet-art');
  art.src = milestoneArtSrc(badge.icon);
  applyDarkIconSet(art);
  art.classList.toggle('ms-art--locked', !done);
  document.getElementById('badge-sheet-label').textContent = done ? 'Badge Unlocked' : 'Badge Locked';
  document.getElementById('badge-sheet-name').textContent = badge.name;
  document.getElementById('badge-sheet-req').textContent = badge.requirement;
  const action = document.getElementById('badge-sheet-action');
  action.textContent = done ? 'Share' : 'Locked';
  action.disabled = !done;
  _milestoneOpenSheet('badge-sheet-overlay');
}

function closeBadgeDetail() {
  _milestoneCloseSheet('badge-sheet-overlay');
}

function _currentSheetBadge() {
  const badge = MILESTONE_BADGES.find(b => b.id === _milestoneSheetBadgeId);
  return badge && isBadgeUnlocked(badge) ? badge : null;
}

let _msShareText = '';

function _openShareSheet({ accent, tint, artName, digitsValue, title, sub, text }) {
  const sheet = document.getElementById('badge-share-sheet');
  sheet.style.setProperty('--ms-accent', accent);
  sheet.style.setProperty('--ms-tint', tint);
  const art = document.getElementById('badge-share-art');
  art.src = milestoneArtSrc(artName);
  applyDarkIconSet(art);
  const digits = document.getElementById('badge-share-digits');
  digits.innerHTML = digitsValue === null ? '' : milestoneDigitsHTML(digitsValue);
  digits.hidden = digitsValue === null;
  document.getElementById('badge-share-title').textContent = title;
  document.getElementById('badge-share-sub').textContent = sub;
  _msShareText = text;
  _milestoneCloseSheet('badge-sheet-overlay');
  _milestoneOpenSheet('badge-share-overlay');
}

function openStreakShare() {
  _openShareSheet({
    accent: '#ec4899',
    tint: '#fdf2f8',
    artName: 'hero-streak-flame',
    digitsValue: 0,
    title: 'Day Streak',
    sub: 'Keep your streak alive',
    text: "I'm building a day streak on Zelo!",
  });
}

function openBadgeShare() {
  const badge = _currentSheetBadge();
  if (!badge) return;
  const cat = getMilestoneCategory(badge.category);
  _openShareSheet({
    accent: cat.accent,
    tint: cat.bgTint,
    artName: badge.icon,
    digitsValue: null,
    title: badge.name,
    sub: `${cat.name} · ${badge.requirement}`,
    text: `I unlocked ${badge.name} on Zelo: ${badge.requirement}!`,
  });
}

function closeBadgeShare() {
  _milestoneCloseSheet('badge-share-overlay');
}

function shareSheetNatively() {
  if (!_msShareText) return;
  if (navigator.share) {
    navigator.share({ title: 'Zelo', text: _msShareText }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(_msShareText).then(() => flashLimitToast('Copied to clipboard')).catch(() => {});
  }
}

function copySheetText() {
  if (!_msShareText || !navigator.clipboard) return;
  navigator.clipboard.writeText(_msShareText).then(() => flashLimitToast('Copied to clipboard')).catch(() => {});
}

// Swipe down on the sheet to dismiss — tracks the finger live, closes past
// a distance or fast-flick threshold, otherwise springs back.
function _attachMsSheetDragClose(overlayId, closeFn) {
  const ov = document.getElementById(overlayId);
  const sheet = ov && ov.querySelector('.ms-sheet');
  if (!sheet) return;
  let active = false, startY = 0, dy = 0, startT = 0;
  sheet.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    active = true; startY = e.touches[0].clientY; dy = 0; startT = Date.now();
    sheet.style.transition = 'none';
    ov.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (!active) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    ov.style.opacity = String(Math.max(0, 1 - dy / 360));
  }, { passive: true });
  const finish = () => {
    if (!active) return;
    active = false;
    const speed = dy / Math.max(1, Date.now() - startT);
    sheet.style.transition = 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)';
    ov.style.transition = 'opacity 0.32s ease';
    if (dy > 110 || speed > 0.6) {
      sheet.style.transform = 'translateY(100%)';
      ov.style.opacity = '0';
      setTimeout(() => {
        closeFn();
        sheet.style.transition = '';
        sheet.style.transform = '';
        ov.style.transition = '';
        ov.style.opacity = '';
      }, 320);
    } else {
      sheet.style.transform = '';
      ov.style.opacity = '';
      setTimeout(() => { sheet.style.transition = ''; ov.style.transition = ''; }, 320);
    }
  };
  sheet.addEventListener('touchend', finish);
  sheet.addEventListener('touchcancel', finish);
}

document.addEventListener('DOMContentLoaded', () => {
  _attachMsSheetDragClose('badge-sheet-overlay', closeBadgeDetail);
  _attachMsSheetDragClose('badge-share-overlay', closeBadgeShare);
});


// ================================================================
// SETTINGS 2.0 — rebuilt against the settings-flow reference, then merged
// directly into the Account page (screen-dashboard) instead of living
// behind its own "Settings" tap-through — see the Account markup in
// index.html. Everything below this point pushes straight from Account
// into its own sub-screen (pushScreen/popScreen), same mechanism as
// before, just with Account as the starting point instead of a
// standalone Settings Home screen. Layout/structure pass only — see the
// comment at the top of the Settings 2.0 markup in index.html for what's
// deliberately left as placeholder (pricing, scan-retention values, icons).
// ================================================================

function openSettingsProfileLogin() {
  _plRenderAvatar();
  const nameInput = document.getElementById('pl-display-name-input');
  if (nameInput) nameInput.value = getDisplayName();
  _plRenderSigninMethods();
  pushScreen('settings-profile-login');
}

// ---- Avatar (photo + initial fallback) ----
function _plRenderAvatar() {
  const name = getDisplayName();
  const initialEl = document.getElementById('pl-avatar');
  if (initialEl) initialEl.textContent = name.charAt(0).toUpperCase();
  const photo = localStorage.getItem('zelo_profile_photo');
  const img = document.getElementById('pl-avatar-photo');
  if (img) {
    img.src = photo || '';
    img.hidden = !photo;
  }
  if (initialEl) initialEl.hidden = !!photo;
}

function plPickPhoto() { document.getElementById('pl-photo-input')?.click(); }
function plPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('zelo_profile_photo', reader.result);
    _plRenderAvatar();
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ---- Display name — saves on blur, same zelo_display_name key every
// other name editor in the app already reads/writes. ----
function plSaveDisplayName() {
  const input = document.getElementById('pl-display-name-input');
  if (!input) return;
  saveDisplayName(input.value);
  input.value = getDisplayName();
  _plRenderAvatar();
}

// ---- Show/hide password ----
function plToggleVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btnEl?.classList.toggle('pl-eye-btn--active', !showing);
}

// ---- Forgot password — real AUTH.sendPasswordReset(), a plain email-link
// flow (zeloSupabase.auth.resetPasswordForEmail) instead of an in-app
// 6-digit reauth step. ----
function plOpenForgotPassword() {
  const input = document.getElementById('pl-forgot-email');
  if (input) input.value = AUTH.currentEmail();
  const err = document.getElementById('pl-forgot-error');
  if (err) err.textContent = '';
  pushScreen('settings-forgot-password');
}

async function plSendPasswordReset() {
  const input = document.getElementById('pl-forgot-email');
  const err   = document.getElementById('pl-forgot-error');
  if (err) err.textContent = '';
  const email = (input?.value || '').trim();
  if (!email) { if (err) err.textContent = 'Enter your email address.'; return; }
  const { error } = await AUTH.sendPasswordReset(email);
  if (error) { if (err) err.textContent = error; return; }
  const sentEl = document.getElementById('pl-reset-sent-email');
  if (sentEl) sentEl.textContent = email;
  pushScreen('settings-reset-sent');
  _plStartResetCountdown();
}

let _plResetCountdownTimer = null;
function _plStartResetCountdown() {
  clearInterval(_plResetCountdownTimer);
  let remaining = 60;
  const btn = document.getElementById('pl-reset-resend-btn');
  const sub = document.getElementById('pl-reset-resend-sub');
  if (btn) btn.disabled = true;
  const tick = () => {
    if (remaining <= 0) {
      clearInterval(_plResetCountdownTimer);
      if (btn) btn.disabled = false;
      if (sub) sub.textContent = "Didn't get it? Check your spam folder.";
      return;
    }
    if (sub) sub.textContent = `You can resend the link in ${remaining} second${remaining === 1 ? '' : 's'}.`;
    remaining--;
  };
  tick();
  _plResetCountdownTimer = setInterval(tick, 1000);
}

async function plResendPasswordReset() {
  const btn = document.getElementById('pl-reset-resend-btn');
  if (btn?.disabled) return;
  const email = document.getElementById('pl-reset-sent-email')?.textContent || '';
  if (!email) return;
  await AUTH.sendPasswordReset(email);
  _plStartResetCountdown();
}

// "Back to settings" (on both the Forgot Password and Reset Sent screens)
// always returns to Profile & Login specifically, regardless of how deep
// the stack is (1 level from Forgot Password, 2 from Reset Sent) — unlike
// each screen's own back arrow (plain popScreen()), which just steps back
// one level at a time.
function _plBackToProfileLogin() {
  let guard = 0;
  while (state.activeScreen !== 'settings-profile-login' && state.screenStack.length && guard < 5) {
    popScreen();
    guard++;
  }
}
function plBackToSettingsFromReset() { _plBackToProfileLogin(); }

function _plOpenCodeModal(modalId, rowId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  document.querySelectorAll(`#${rowId} .auth-code-input`).forEach(inp => { inp.value = ''; });
  modal.hidden = false;
  _plBindCodeRow(rowId);
  requestAnimationFrame(() => document.querySelector(`#${rowId} .auth-code-input`)?.focus());
}

// Same auto-advance/backspace/paste wiring as AUTH's own _initCodeInputs(),
// scoped per-row and bound once per row (idempotent) since these two modals
// share the .auth-code-input markup pattern but aren't part of the AUTH
// module itself.
const _plBoundCodeRows = new Set();
function _plBindCodeRow(rowId) {
  if (_plBoundCodeRows.has(rowId)) return;
  _plBoundCodeRows.add(rowId);
  const inputs = Array.from(document.querySelectorAll(`#${rowId} .auth-code-input`));
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^0-9]/g, '').slice(-1);
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '');
      if (!text) return;
      e.preventDefault();
      text.slice(0, inputs.length).split('').forEach((ch, idx) => { if (inputs[idx]) inputs[idx].value = ch; });
      inputs[Math.min(text.length, inputs.length) - 1]?.focus();
    });
  });
}
function _plReadCode(rowId) {
  return Array.from(document.querySelectorAll(`#${rowId} .auth-code-input`)).map(inp => inp.value).join('');
}

// ---- Sign-in methods ----
function _plRenderSigninMethods() {
  const email = AUTH.currentEmail();
  const emailSub    = document.getElementById('pl-signin-email-sub');
  const emailStatus = document.getElementById('pl-signin-email-status');
  if (emailSub)    emailSub.textContent = email || 'Not connected';
  if (emailStatus) {
    emailStatus.textContent = email ? 'Connected' : 'Connect';
    emailStatus.classList.toggle('pl-signin-status--connected', !!email);
    emailStatus.classList.toggle('pl-signin-status--connect', !email);
  }
  // Google/Apple: this app doesn't track linked-provider state locally, and
  // AUTH's OAuth methods are real sign-in calls (not Supabase's separate
  // identity-linking API) — see plSigninRowTap() below. Always reads as
  // "Not connected" here; there's no local signal that would tell us
  // otherwise without a real linkIdentity() integration.
}

function plSigninRowTap(method) {
  if (method === 'email') {
    if (AUTH.currentEmail()) return; // already connected — nothing to do yet
    document.getElementById('pl-connect-email-sheet').hidden = false;
    return;
  }
  if (method === 'google') { AUTH.signInWithGoogle(); return; }
  if (method === 'apple')  { AUTH.signInWithApple(); return; }
}

function plCloseConnectEmailSheet() {
  const sheet = document.getElementById('pl-connect-email-sheet');
  if (sheet) sheet.hidden = true;
}

function plConnectEmailContinue() {
  plCloseConnectEmailSheet();
  const emailInput = document.getElementById('pl-addemail-email');
  const pwInput    = document.getElementById('pl-addemail-password');
  const cfInput    = document.getElementById('pl-addemail-confirm');
  const errEl      = document.getElementById('pl-addemail-error');
  if (emailInput) emailInput.value = '';
  if (pwInput)    pwInput.value = '';
  if (cfInput)    cfInput.value = '';
  if (errEl)      errEl.textContent = '';
  plAddEmailCheckReqs();
  pushScreen('settings-add-email');
}

// ---- Add Your Email — live password-requirements checklist ----
function _plPasswordReqs(pw) {
  return {
    len:     pw.length >= 8,
    num:     /[0-9]/.test(pw),
    letter:  /[a-zA-Z]/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
  };
}
function plAddEmailCheckReqs() {
  const pw = document.getElementById('pl-addemail-password')?.value || '';
  const reqs = _plPasswordReqs(pw);
  document.querySelectorAll('#pl-pwreq-list .pl-pwreq-item').forEach(li => {
    li.classList.toggle('pl-pwreq-item--met', !!reqs[li.dataset.req]);
  });
}

async function plLinkEmailSubmit() {
  const errEl = document.getElementById('pl-addemail-error');
  if (errEl) errEl.textContent = '';
  const email   = (document.getElementById('pl-addemail-email')?.value || '').trim();
  const pw      = document.getElementById('pl-addemail-password')?.value || '';
  const confirm = document.getElementById('pl-addemail-confirm')?.value || '';
  if (!email) { if (errEl) errEl.textContent = 'Enter an email address.'; return; }
  const reqs = _plPasswordReqs(pw);
  if (!reqs.len || !reqs.num || !reqs.letter || !reqs.special) {
    if (errEl) errEl.textContent = 'Password doesn’t meet all the requirements above.';
    return;
  }
  if (pw !== confirm) { if (errEl) errEl.textContent = 'Passwords don’t match.'; return; }
  const { error } = await AUTH.linkEmail(email, pw);
  if (error) { if (errEl) errEl.textContent = error; return; }
  const addrEl = document.getElementById('pl-verify-email-addr');
  if (addrEl) addrEl.textContent = email;
  _plOpenCodeModal('pl-verify-email-modal', 'pl-email-code-row');
}

function plCloseVerifyEmailModal() {
  const modal = document.getElementById('pl-verify-email-modal');
  if (modal) modal.hidden = true;
  const err = document.getElementById('pl-email-code-error');
  if (err) err.textContent = '';
}

async function plConfirmEmailChange() {
  const err = document.getElementById('pl-email-code-error');
  if (err) err.textContent = '';
  const code = _plReadCode('pl-email-code-row');
  if (code.length !== 6) { if (err) err.textContent = 'Enter the 6-digit code.'; return; }
  const { error } = await AUTH.verifyEmailChange(code);
  if (error) { if (err) err.textContent = error; return; }
  plCloseVerifyEmailModal();
  popScreen(); // back to Profile & Login, discarding "Add Your Email"
  _plShowScreenNoStack('settings-email-connected');
}

async function plResendEmailChangeCode() {
  const err = document.getElementById('pl-email-code-error');
  const { error } = await AUTH.resendEmailChange();
  if (err) { err.textContent = error || 'Code resent — check your email.'; err.style.color = error ? '' : '#22c55e'; }
}

// Swaps which .screen is visible WITHOUT touching state.activeScreen/
// screenStack — used for the "Email Connected" success screen, which sits
// logically "on top of" Profile & Login rather than being its own stack
// entry. popScreen() already did the real navigation back to Profile &
// Login (see plConfirmEmailChange()); this just displays the success
// screen over it, and plEmailConnectedDone() swaps straight back with no
// second pop (there's nothing left on the stack for a second pop to find).
function _plShowScreenNoStack(name) {
  document.querySelectorAll('.tab, .screen').forEach(el => el.classList.remove('active'));
  const screenEl = document.getElementById('screen-' + name);
  screenEl?.classList.add('active');
  _revealLazyImages(screenEl);
  const tb = document.getElementById('tab-bar');
  tb.classList.add('hidden');
  // Belt and braces: if a gesture ever exits without reaching its own
  // cleanup, this class would otherwise stick and the bar would lose its
  // blur permanently.
  tb.classList.remove('tab-bar--gesture-reveal');
  const app = document.getElementById('app');
  app?.classList.remove('slide-animating');
  app?.classList.remove('slide-cleanup');
}

function plEmailConnectedDone() {
  _plShowScreenNoStack('settings-profile-login');
  _plRenderSigninMethods();
}

function plSignOutAllDevices() { AUTH.signOut(); }

// ---- Personalization (tone + "what Zelo helps you with") ----
const SETTINGS_TONE_LABELS = {
  friendly: 'Friendly', playful: 'Playful', confident: 'Confident', casual: 'Casual', direct: 'Direct',
};
const SETTINGS_TONE_PREVIEWS = {
  friendly:  "It was good! Thanks for asking 😊 How was yours?",
  playful:   "It was good, chaotic as always 😂 yours?",
  confident: "It was good! Busy but productive 💪 How was yours?",
  casual:    "Pretty good, nothing crazy. You?",
  direct:    "Good. Productive day. You?",
};

function openSettingsPersonalization() {
  const appearance = getThemePref();
  document.querySelectorAll('#settings2-appearance-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.appearance === appearance);
  });
  const tone = localStorage.getItem('zelo_settings_tone') || 'confident';
  document.querySelectorAll('#settings2-tone-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.tone === tone);
  });
  let helpWith;
  try { helpWith = JSON.parse(localStorage.getItem('zelo_settings_help_with') || '[]'); }
  catch { helpWith = []; }
  if (!helpWith.length) helpWith = ['replying', 'starting', 'understanding'];
  document.querySelectorAll('#settings2-helpswith-list .settings2-check-row').forEach(row => {
    row.classList.toggle('selected', helpWith.includes(row.dataset.help));
  });
  pushScreen('settings-personalization');
}

// Applies instantly (no Save Changes needed, no navigating away) — same
// "live preview" feel as the color-scheme hook this was modeled on.
function settingsAppearanceSelect(pref, el) {
  document.querySelectorAll('#settings2-appearance-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  setThemePref(pref);
}

function settingsToneSelect(tone, el) {
  document.querySelectorAll('#settings2-tone-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  localStorage.setItem('zelo_settings_tone', tone);
  const labelEl = document.getElementById('settings2-preview-tone-label');
  const replyEl = document.getElementById('settings2-preview-reply');
  if (labelEl) labelEl.textContent = `Zelo (${SETTINGS_TONE_LABELS[tone] || tone})`;
  if (replyEl) replyEl.textContent = SETTINGS_TONE_PREVIEWS[tone] || SETTINGS_TONE_PREVIEWS.confident;
  pushScreen('settings-tone-preview');
}

function settingsHelpWithToggle(key, el) {
  let list;
  try { list = JSON.parse(localStorage.getItem('zelo_settings_help_with') || '[]'); }
  catch { list = []; }
  if (!list.length) list = ['replying', 'starting', 'understanding'];
  const i = list.indexOf(key);
  if (i === -1) list.push(key); else list.splice(i, 1);
  localStorage.setItem('zelo_settings_help_with', JSON.stringify(list));
  el.classList.toggle('selected', list.includes(key));
}


// ---- Practice Preferences hub — reached both from Account/User settings
// and directly from the Home tab's top-right gear icon (see the
// .settings-btn onclick in index.html), so back from the latter unwinds
// straight to Home rather than through Account (pushScreen() only records
// a stack entry when state.activeScreen was already set on entry). ----
function openSettingsPracticePrefs() {
  const whoEl = document.getElementById('settings2-who-preview');
  if (whoEl) whoEl.textContent = _pedAttractedLabel(_practiceMode());

  // No preset is chosen until the user picks one (tap it again to clear).
  const age = localStorage.getItem('zelo_age_range') || '';
  const ageEl = document.getElementById('settings2-age-preview');
  if (ageEl) ageEl.textContent = _ageRangeLabel();

  const diff = localStorage.getItem('zelo_settings_difficulty') || 'Balanced';
  const diffEl = document.getElementById('settings2-difficulty-preview');
  if (diffEl) diffEl.textContent = diff;

  const topics = localStorage.getItem('zelo_settings_topics') || 'All';
  const topicsEl = document.getElementById('settings2-topics-preview');
  if (topicsEl) topicsEl.textContent = topics;

  pushScreen('settings-practice-prefs');
}

function openSettingsWhoPractice() {
  const mode = _practiceMode();
  document.querySelectorAll('#settings2-who-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.mode === mode);
  });
  const g = localStorage.getItem('zelo_onb_gender');
  document.querySelectorAll('#settings2-me-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.gender === g);
  });
  pushScreen('settings-who-practice');
}

function settingsPrefsMeSelect(gender, el) {
  document.querySelectorAll('#settings2-me-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  localStorage.setItem('zelo_onb_gender', gender);
  cineAnswers.gender = gender;
  try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
  _invalidateDeck();
}

function settingsPrefsWhoSelect(mode, el) {
  document.querySelectorAll('#settings2-who-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  localStorage.setItem('zelo_practice_mode', mode);
  localStorage.setItem('zelo_mode_selected', '1');
  state.swipeIndex = state.swipeProfiles.length;
}

const AGE_FILTER_MIN_BOUND = 18;
const AGE_FILTER_MAX_BOUND = 39; // slider's own max — the oldest persona is 39, so there is no "40+"

function openSettingsAgeRangeSub() {
  const age = localStorage.getItem('zelo_age_range') || '';
  document.querySelectorAll('#settings2-age-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.age === age);
  });

  const minEl = document.getElementById('settings2-agefilter-min');
  const maxEl = document.getElementById('settings2-agefilter-max');
  minEl.value = localStorage.getItem('zelo_age_filter_min') || AGE_FILTER_MIN_BOUND;
  maxEl.value = localStorage.getItem('zelo_age_filter_max') || AGE_FILTER_MAX_BOUND;   // untouched = full span = any age
  // So the first drag on a freshly-opened screen still buzzes instead of
  // silently matching stale values left over from a previous visit.
  _ageFilterLastHapticMin = null;
  _ageFilterLastHapticMax = null;
  _renderAgeFilterSlider();
  _wireAgeFilterTapToJump();
  const strictToggle = document.getElementById('toggle-age-filter-strict');
  strictToggle.checked = (localStorage.getItem('zelo_age_filter_strict') ?? 'true') === 'true';

  pushScreen('settings-age-range');
}

// Live label + track fill for the dual-handle slider — see the
// .settings2-agefilter-* CSS comment for how the two overlapping range
// inputs stay independently draggable.
let _ageFilterLastHapticMin = null, _ageFilterLastHapticMax = null;
function onAgeFilterSliderInput(e) {
  const minEl = document.getElementById('settings2-agefilter-min');
  const maxEl = document.getElementById('settings2-agefilter-max');
  let minV = parseInt(minEl.value, 10);
  let maxV = parseInt(maxEl.value, 10);
  // Keep a minimum 1-year gap so the two handles can't cross/overlap.
  if (minV > maxV - 1) {
    if (e && e.target === maxEl) { minV = maxV - 1; minEl.value = minV; }
    else { maxV = minV + 1; maxEl.value = maxV; }
  }
  // Buzz once per year the range actually moves by, not once per raw
  // pointermove — a drag fires far more "input" events than there are
  // distinct integer values to feel.
  if (minV !== _ageFilterLastHapticMin || maxV !== _ageFilterLastHapticMax) {
    navigator.vibrate?.(4);
    _cineHaptic('LIGHT');
    _ageFilterLastHapticMin = minV;
    _ageFilterLastHapticMax = maxV;
  }
  localStorage.setItem('zelo_age_filter_min', minV);
  localStorage.setItem('zelo_age_filter_max', maxV);
  _invalidateDeck();            // the deck now reads this range
  _renderAgeFilterSlider();
}

function _renderAgeFilterSlider() {
  const minEl = document.getElementById('settings2-agefilter-min');
  const maxEl = document.getElementById('settings2-agefilter-max');
  const minV = parseInt(minEl.value, 10);
  const maxV = parseInt(maxEl.value, 10);
  const pct = (v) => ((v - AGE_FILTER_MIN_BOUND) / (AGE_FILTER_MAX_BOUND - AGE_FILTER_MIN_BOUND)) * 100;
  const rangeEl = document.getElementById('settings2-agefilter-range');
  rangeEl.style.left = pct(minV) + '%';
  rangeEl.style.right = (100 - pct(maxV)) + '%';
  document.getElementById('settings2-agefilter-value').textContent =
    `${minV} – ${maxV}`;
}

// Pressing outside the ~22px native thumb circle — anywhere on the track
// or tick row — grabs the *nearer* handle and drags it live with the
// finger, same as grabbing the thumb itself would, instead of requiring
// a precise touch on the small circle. A tap with no movement still
// lands the nearer handle on that spot (falls out of the same code path:
// touchstart alone already sets the value once). Routes every value
// change through onAgeFilterSliderInput() so gap enforcement,
// persistence, re-render and haptics all stay identical to a native
// thumb drag.
function _ageFilterValueFromClientX(clientX, containerEl) {
  const rect = containerEl.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return Math.round(AGE_FILTER_MIN_BOUND + pct * (AGE_FILTER_MAX_BOUND - AGE_FILTER_MIN_BOUND));
}

function _wireAgeFilterTapToJump() {
  const slider = document.getElementById('settings2-agefilter-slider');
  const ticks  = document.getElementById('settings2-agefilter-ticks');
  if (!slider || !ticks || slider._customDragWired) return;
  slider._customDragWired = true;

  const minEl = document.getElementById('settings2-agefilter-min');
  const maxEl = document.getElementById('settings2-agefilter-max');
  let draggingEl = null; // which range input this custom drag is currently driving

  function moveHandleTo(clientX, containerEl) {
    const value = _ageFilterValueFromClientX(clientX, containerEl);
    if (draggingEl === minEl) {
      minEl.value = Math.min(value, parseInt(maxEl.value, 10) - 1);
    } else {
      maxEl.value = Math.max(value, parseInt(minEl.value, 10) + 1);
    }
    onAgeFilterSliderInput({ target: draggingEl });
  }

  function onDown(e, containerEl) {
    // A touch that actually landed on the native thumb hit-target (the
    // only case e.target is the <input> itself — see its pointer-events
    // CSS) is left to the browser's own drag; starting a second, custom
    // drag on top of it would fight the native one.
    if (e.target === minEl || e.target === maxEl) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const value = _ageFilterValueFromClientX(clientX, containerEl);
    const minV = parseInt(minEl.value, 10);
    const maxV = parseInt(maxEl.value, 10);
    draggingEl = Math.abs(value - minV) <= Math.abs(value - maxV) ? minEl : maxEl;
    moveHandleTo(clientX, containerEl);
  }

  function onMove(e, containerEl) {
    if (!draggingEl) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    moveHandleTo(clientX, containerEl);
  }

  function onUp() { draggingEl = null; }

  [slider, ticks].forEach(containerEl => {
    containerEl.addEventListener('touchstart', e => onDown(e, containerEl), { passive: true });
    containerEl.addEventListener('touchmove', e => { onMove(e, containerEl); if (draggingEl) e.preventDefault(); }, { passive: false });
    containerEl.addEventListener('touchend', onUp);
    containerEl.addEventListener('touchcancel', onUp);
    containerEl.addEventListener('mousedown', e => {
      onDown(e, containerEl);
      const onMouseMove = ev => onMove(ev, containerEl);
      const onMouseUp = () => { onUp(); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

const AGE_FILTER_PRESET_RANGES = { '18-24': [18, 24], '25-30': [25, 30], '31-39': [31, 39] };

function settingsPrefsAgeSelect(value, el) {
  // Tapping the already-selected preset clears it (no age preset = any age).
  if (el.classList.contains('selected')) {
    el.classList.remove('selected');
    localStorage.removeItem('zelo_age_range');
    // "No preset" means any age. The slider keeps its own stored range and the
    // deck now honours it, so leaving it behind would filter while the screen
    // claimed otherwise — reset it to the full span and drop the stored values.
    localStorage.removeItem('zelo_age_filter_min');
    localStorage.removeItem('zelo_age_filter_max');
    document.getElementById('settings2-agefilter-min').value = AGE_FILTER_MIN_BOUND;
    document.getElementById('settings2-agefilter-max').value = AGE_FILTER_MAX_BOUND;
    _renderAgeFilterSlider();
    _invalidateDeck();
    return;
  }
  document.querySelectorAll('#settings2-age-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  localStorage.setItem('zelo_age_range', value);
  state.swipeIndex = state.swipeProfiles.length;

  // Also move the slider to match, per the product ask that picking a
  // preset row below should visibly move the graph above it too.
  const [lo, hi] = AGE_FILTER_PRESET_RANGES[value] || [18, 24];
  const minEl = document.getElementById('settings2-agefilter-min');
  const maxEl = document.getElementById('settings2-agefilter-max');
  minEl.value = lo;
  maxEl.value = hi;
  onAgeFilterSliderInput();
}

// Practice difficulty / conversation topics — the reference doesn't show a
// dedicated sub-screen for either, so tapping just cycles the value in
// place (same lightweight pattern as a segmented control).
const SETTINGS_DIFFICULTY_OPTIONS = ['Easy', 'Balanced', 'Hard'];
function cycleSettingsDifficulty() {
  const el = document.getElementById('settings2-difficulty-preview');
  if (!el) return;
  const i = SETTINGS_DIFFICULTY_OPTIONS.indexOf(el.textContent);
  const next = SETTINGS_DIFFICULTY_OPTIONS[(i + 1) % SETTINGS_DIFFICULTY_OPTIONS.length];
  el.textContent = next;
  localStorage.setItem('zelo_settings_difficulty', next);
}
const SETTINGS_TOPICS_OPTIONS = ['All', 'Dating', 'Friendship', 'Work'];
function cycleSettingsTopics() {
  const el = document.getElementById('settings2-topics-preview');
  if (!el) return;
  const i = SETTINGS_TOPICS_OPTIONS.indexOf(el.textContent);
  const next = SETTINGS_TOPICS_OPTIONS[(i + 1) % SETTINGS_TOPICS_OPTIONS.length];
  el.textContent = next;
  localStorage.setItem('zelo_settings_topics', next);
}

// ---- Notifications ----
function openSettingsNotifications() {
  const set = (id, key, def) => {
    const el = document.getElementById(id);
    if (!el) return;
    const stored = localStorage.getItem(key);
    el.checked = stored === null ? def : stored === 'true';
  };
  set('toggle-push-notifications', 'zelo_push_notifications', true);
  set('toggle-email-notifications', 'zelo_email_notifications', true);
  set('toggle-reply-reminders', 'zelo_notif_reply_reminders', true);
  set('toggle-practice-updates', 'zelo_notif_practice_updates', true);
  set('toggle-zelo-tips', 'zelo_notif_tips', false);
  set('toggle-trial-reminders', 'zelo_notif_trial_reminders', true);
  pushScreen('settings-notifications');
}

// ---- Privacy & Data ----
function openSettingsPrivacyData() {
  const dns = document.getElementById('toggle-do-not-sell');
  if (dns) dns.checked = localStorage.getItem('zelo_do_not_sell') === 'true';
  const days = localStorage.getItem('zelo_history_retention_days') || DEFAULT_RETENTION_DAYS;
  const labels = { '7': '7 days', '30': '30 days', '90': '90 days', forever: 'Keep forever' };
  const previewEl = document.getElementById('settings2-retention-preview');
  if (previewEl) previewEl.textContent = labels[days] || '30 days';
  pushScreen('settings-privacy-data');
}

// Scan history retention starts at 30 days for everyone until they pick another.
const DEFAULT_RETENTION_DAYS = '30';

function openSettingsScanRetention() {
  const days = localStorage.getItem('zelo_history_retention_days') || DEFAULT_RETENTION_DAYS;
  document.querySelectorAll('#settings2-retention-list .settings2-radio-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.days === days);
  });
  pushScreen('settings-scan-retention');
}

function settingsRetentionSelect(value, el) {
  document.querySelectorAll('#settings2-retention-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
  el.classList.add('selected');
  onRetentionChange(value);
}

// ---- Zelo Pro ----
function restoreSettingsPurchases() {
  ZeloAnalytics.track('restore_purchase_tapped');
  _settingsToast('No purchases found to restore.');
}

// ---- Help & Support ----
function toggleSettingsFaq(rowEl) {
  const answer  = rowEl.querySelector('.settings2-faq-answer');
  const chevron = rowEl.querySelector('.settings2-chevron');
  if (!answer) return;
  const opening = answer.hidden;
  answer.hidden = !opening;
  if (chevron) chevron.style.transform = opening ? 'rotate(90deg)' : '';
}

function sendSettingsSupportMessage() {
  const textarea = document.getElementById('settings2-support-message');
  const msg = (textarea?.value || '').trim();
  if (!msg) return;
  if (textarea) textarea.value = '';
  _settingsToast("Thanks — we'll get back to you soon.");
}

// Minimal single-button acknowledgement — reuses the same mini-modal shell
// as showDeleteConfirm() above (see that function) rather than a jarring
// native alert().
function _settingsToast(message) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'mini-modal-overlay';
  overlay.innerHTML = `
    <div class="mini-modal-card">
      <p class="mini-modal-body">${message}</p>
      <div class="mini-modal-actions">
        <button class="mini-modal-confirm">OK</button>
      </div>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('.mini-modal-confirm').onclick = () => overlay.remove();
}

function onSettingsToggle(key, value) {
  localStorage.setItem(key, String(value));
  if (key === 'zelo_age_filter_strict') _invalidateDeck();
  if (key === 'zelo_do_not_sell') {
    ZeloAnalytics.setOptOut(value); // "Do not sell" also switches analytics off
    ZeloRecords.recordConsent('analytics', !value);
  }
}

// Legal/support pages live on the marketing site, not in the app — opened
// via the Browser plugin's in-app Safari view (user taps "Done" to return,
// no full app-switch) rather than a native screen for each one. Falls back
// to a plain new-tab window.open when Capacitor isn't present (e.g. this
// file opened directly in a desktop browser during development), so this
// never silently no-ops outside the native shell.
const ZELO_WEB_BASE = 'https://zelofficial.com/';
function openLegalPage(path) {
  const url = ZELO_WEB_BASE + path;
  const Browser = window.Capacitor?.Plugins?.Browser;
  // Snapshot the sign-in/create-account screen (if it's the thing open behind
  // this) so it can be restored exactly as left — see AUTH.rememberAuthState.
  if (typeof AUTH !== 'undefined') AUTH.rememberAuthState();
  if (Browser) {
    Browser.open({ url }).catch(() => {});
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

// "Skipped Profiles" — a lightweight snapshot (not a live PROFILES
// lookup) is stored per decline so the list still makes sense even if
// PROFILES data changes later. Most-recent first, capped so this can't
// grow unbounded in localStorage.
const SKIPPED_PROFILES_KEY = 'zelo_skipped_profiles';
const SKIPPED_PROFILES_MAX = 50;

function _getSkippedProfiles() {
  try { return JSON.parse(localStorage.getItem(SKIPPED_PROFILES_KEY) || '[]'); }
  catch { return []; }
}

function _skippedProfileIds() {
  return new Set(_getSkippedProfiles().map(p => p.id));
}

function _recordSkippedProfile(profile) {
  if (!profile) return;
  let list = _getSkippedProfiles();
  list = list.filter(p => p.id !== profile.id); // de-dupe — most recent decline wins the position
  list.unshift({
    id:             profile.id,
    name:           profile.name,
    age:            profile.age,
    occupation:     profile.occupation,
    gradientColors: profile.gradientColors,
    initial:        profile.initial,
    avatar:         profile.avatar,
  });
  if (list.length > SKIPPED_PROFILES_MAX) list.length = SKIPPED_PROFILES_MAX;
  localStorage.setItem(SKIPPED_PROFILES_KEY, JSON.stringify(list));
}

// Shared by both the "Unskip" pill and the row's overflow-menu "Delete" —
// either way, the person's own record is the single source of truth for
// deck exclusion (see initSwipeDeck()), so removing it here is what
// actually lets them reappear, not just tidies up this list.
function _removeSkippedProfile(id) {
  const list = _getSkippedProfiles().filter(p => p.id !== id);
  localStorage.setItem(SKIPPED_PROFILES_KEY, JSON.stringify(list));
  _populateSkippedPanel();
}

function unskipProfile(id) {
  navigator.vibrate?.(6);
  _cineHaptic('MEDIUM');
  _removeSkippedProfile(id);
}

function confirmDeleteAllSkipped() {
  if (_getSkippedProfiles().length === 0) return;
  _showChatConfirm(
    "Delete all skipped profiles?",
    "They may start showing up in your deck again. This can't be undone.",
    "Delete All",
    () => {
      navigator.vibrate?.(10);
      _cineHaptic('MEDIUM');
      localStorage.setItem(SKIPPED_PROFILES_KEY, '[]');
      _populateSkippedPanel();
    }
  );
}

function confirmDeleteSkippedProfile(id, name) {
  _showChatConfirm(
    `Delete ${name}?`,
    "This removes them from your skipped list. They may show up in your deck again.",
    "Delete",
    () => _removeSkippedProfile(id)
  );
}

// Gated behind isPaidUser() per the product ask ("needs to be upgraded to
// see the profiles you skipped") — isPaidUser() is currently a stub that
// always returns true (see its own comment), so this reads as unlocked
// for everyone until real payment logic replaces that stub; the gate
// itself is already wired correctly for when it does.
function _populateSkippedPanel() {
  const locked      = document.getElementById('settings-skipped-locked');
  const listEl       = document.getElementById('settings-skipped-list');
  const emptyEl       = document.getElementById('settings-skipped-empty');
  const deleteAllBtn  = document.getElementById('skipped-delete-all-btn');
  const changeMindCard = document.getElementById('skipped-change-mind-card');
  const footerCard    = document.getElementById('skipped-footer-card');
  const paid = isPaidUser();
  if (locked) locked.hidden = paid;
  if (changeMindCard) changeMindCard.hidden = !paid;
  if (footerCard) footerCard.hidden = !paid;
  if (!paid) {
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = true;
    if (deleteAllBtn) deleteAllBtn.hidden = true;
    return;
  }
  const list = _getSkippedProfiles();
  if (emptyEl) emptyEl.hidden = list.length > 0;
  if (deleteAllBtn) deleteAllBtn.hidden = list.length === 0;
  if (listEl) listEl.innerHTML = list.map(_skippedRowHTML).join('');
}

// Matches tab rows reuse the Skipped Profiles card look (.skipped-row-card): boxed
// row, rounded-square gradient photo, name + subtitle, an action pill and a ⋯ menu.
function _matchRowHTML(c) {
  const p = c.profile;
  const grad = `linear-gradient(145deg, ${p.gradientColors[0]}, ${p.gradientColors[1]})`;
  const unread = c.unread ? `<span class="match-row-unread">${c.unread}</span>` : '';
  return `
    <div class="skipped-row-card match-row-card">
      <div class="skipped-row-photo" style="background:${grad}">${p.initial}${_pfpImgHTML(p)}</div>
      <div class="skipped-row-main">
        <span class="skipped-row-name">${p.name}${p.age ? ', ' + p.age : ''}</span>
        <span class="skipped-row-occ">${_escapeHtml(c.lastMessage || 'New match!')}</span>
      </div>
      <div class="skipped-row-actions">
        ${unread}
        <span class="skipped-unskip-btn">Open</span>
        <button type="button" class="skipped-row-menu-btn" aria-label="More options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
        </button>
      </div>
    </div>`;
}

function confirmDeleteMatch(id, name) {
  _showChatConfirm(
    `Delete ${name}?`,
    "This removes the match and its chat. This can't be undone.",
    "Delete",
    () => { onDeleteChat(id); renderHistory(); }
  );
}

function _skippedRowHTML(p) {
  const grad = p.gradientColors
    ? `linear-gradient(145deg, ${p.gradientColors[0]}, ${p.gradientColors[1]})`
    : 'linear-gradient(145deg, #f0559f, #db2777)';
  const safeName = (p.name || '').replace(/'/g, "\\'");
  return `
    <div class="skipped-row-card">
      <div class="skipped-row-photo" style="background:${grad}">${p.initial || (p.name ? p.name[0] : '?')}${_pfpImgHTML(p)}</div>
      <div class="skipped-row-main">
        <span class="skipped-row-name">${p.name}${p.age ? ', ' + p.age : ''}</span>
        <span class="skipped-row-occ">${p.occupation || ''}</span>
      </div>
      <div class="skipped-row-actions">
        <button type="button" class="skipped-unskip-btn" onclick="unskipProfile('${p.id}')">Unskip</button>
        <button type="button" class="skipped-row-menu-btn" onclick="confirmDeleteSkippedProfile('${p.id}', '${safeName}')" aria-label="More options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
        </button>
      </div>
    </div>`;
}

function openSettingsSkippedProfiles() {
  _populateSkippedPanel();
  pushScreen('settings-skipped-profiles');
}

// 10 blank/placeholder cards (no real names or bios yet) — served as the
// actual Men/Both deck content in initSwipeDeck() until real male
// personas exist, so those preferences show *something* distinct from
// the women's deck instead of silently reusing it.
const TEST_LAYOUT_PROFILES = Array.from({ length: 10 }, (_, i) => ({
  id:             'test-layout-' + (i + 1),
  name:           'Layout ' + (i + 1),
  age:            '—',
  occupation:     '—',
  bio:            '',
  interests:      [],
  initial:        String(i + 1),
  gradientColors: ['#f0559f', '#db2777'],
  color:          '#f0559f',
  difficulty:     'easy',
  age_pool:       '21-29',
}));

function onRetentionChange(value) {
  localStorage.setItem('zelo_history_retention_days', value);
}

// GDPR data export — everything the app actually stores for this user,
// pulled from the same sources as the rest of the app (no separate copy).
function exportAccountData() {
  const payload = {
    displayName: getDisplayName(),
    age:         localStorage.getItem('zelo_user_age'),
    scanCount:   scanCount,
    threads:     getThreads(),
    matches:     chatStore,
    exportedAt:  new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'zelo-my-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Download My Data flow ────────────────────────────────────────
// request → confirm → preparing → submitted (→ ready). One screen, step
// containers toggled by [data-dd-step]. The request is recorded locally as
// zelo_data_export_request {t, email, status}; status 'submitted' is set here,
// 'emailed' is meant to be set by a backend once the email has actually gone
// out (that is what makes the "Your data is ready" step reachable).
const DD_KEY = 'zelo_data_export_request';
// TEMP (testing): forget the last request on every app launch so Download My
// Data can be requested again and again. Delete this line to bring the 24h
// cooldown back across launches.
try { localStorage.removeItem(DD_KEY); } catch (e) {}
let _ddStep = 'request';
let _ddTimer = null;
let _ddTick = null;
let _ddEditing = false; // confirm step: typing a one-off destination instead of the account email
const DD_COOLDOWN_MS = 15 * 60 * 1000;

function _ddStored() {
  try { return JSON.parse(localStorage.getItem(DD_KEY) || 'null'); } catch (e) { return null; }
}

// oz••••@gmail.com — first two chars of the local part, the rest hidden.
function _ddMaskEmail(email) {
  const at = (email || '').lastIndexOf('@');
  if (at < 1) return '';
  const local = email.slice(0, at);
  return local.slice(0, Math.min(2, local.length)) + '••••' + email.slice(at);
}

// ms left before another request is allowed. The cooldown only starts once a
// request was accepted (record written in ddConfirmRequest), so a failed
// submit never locks the user out.
function _ddCooldownLeft() {
  const rec = _ddStored();
  const email = typeof AUTH !== 'undefined' && AUTH.currentEmail ? AUTH.currentEmail() : '';
  if (!rec || !rec.t || rec.email !== email) return 0;
  return Math.max(0, rec.t + DD_COOLDOWN_MS - Date.now());
}

function _ddFormatLeft(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function _ddRenderCooldown() {
  const left = _ddCooldownLeft();
  if (!left) { ddShowStep('request'); return; }
  const el = document.querySelector('#screen-settings-download-data [data-dd-cooldown]');
  if (el) el.textContent = 'Available again in ' + _ddFormatLeft(left);
}

function ddShowStep(step) {
  clearInterval(_ddTick);
  _ddStep = step;
  const screen = document.getElementById('screen-settings-download-data');
  if (!screen) return;
  screen.querySelectorAll('[data-dd-step]').forEach(el => {
    el.hidden = el.dataset.ddStep !== step;
  });
  // Once a request exists, its own destination is shown; before that, the account email.
  const rec = _ddStored();
  const acct = typeof AUTH !== 'undefined' && AUTH.currentEmail ? AUTH.currentEmail() : '';
  const shown = (step === 'submitted' || step === 'cooldown' || step === 'ready') && rec && rec.to ? rec.to : acct;
  const masked = _ddMaskEmail(shown);
  screen.querySelectorAll('[data-dd-email]').forEach(el => { el.textContent = masked || '—'; });
  const err = screen.querySelector('[data-dd-error]');
  if (err) err.hidden = true;
  if (step === 'confirm') {
    _ddEditing = false;
    const inp = screen.querySelector('[data-dd-input]');
    if (inp) inp.value = '';
    _ddRenderEditing();
  }
  _revealLazyImages(screen);
  screen.scrollTop = 0;
  if (step === 'cooldown') {
    _ddRenderCooldown();
    _ddTick = setInterval(_ddRenderCooldown, 15000);
  }
}

// Confirm step: chip (account email) ⇄ input (one-off destination). Only this
// request goes to the typed address — the account email is never changed.
function _ddRenderEditing() {
  const step = document.querySelector('#screen-settings-download-data [data-dd-step="confirm"]');
  if (!step) return;
  const acct = typeof AUTH !== 'undefined' && AUTH.currentEmail ? AUTH.currentEmail() : '';
  step.querySelector('.dd-email').hidden = _ddEditing;
  step.querySelector('[data-dd-input]').hidden = !_ddEditing;
  step.querySelector('[data-dd-link]').textContent = _ddEditing
    ? (acct ? 'Use my account email' : 'Cancel') : 'Use a different email';
  step.querySelector('[data-dd-lede]').innerHTML = _ddEditing
    ? "We'll send your data to<br>the email you enter below."
    : "We'll send your data to<br>the email linked to your Zelo account.";
  // With no account email the button waits for a typed address.
  step.querySelector('.dd-cta').disabled = !_ddEditing && !acct;
  const err = step.querySelector('[data-dd-error]');
  if (!_ddEditing && !acct) {
    err.textContent = 'No email is linked to your account. Use a different email to receive your data.';
    err.hidden = false;
  } else {
    err.hidden = true;
  }
}

function _ddValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

function ddEmailInput() {
  const err = document.querySelector('#screen-settings-download-data [data-dd-step="confirm"] [data-dd-error]');
  if (err) err.hidden = true;
}

function openDownloadData() {
  clearInterval(_ddTick);
  pushScreen('settings-download-data');
  const rec = _ddStored();
  const email = typeof AUTH !== 'undefined' && AUTH.currentEmail ? AUTH.currentEmail() : '';
  if (rec && rec.status === 'emailed' && rec.email === email) ddShowStep('ready');
  else ddShowStep(_ddCooldownLeft() ? 'cooldown' : 'request');
}

// Back arrow: from confirm go back one step, otherwise leave the screen.
function ddBack() {
  if (_ddStep === 'confirm') { ddShowStep('request'); return; }
  clearInterval(_ddTick);
  popScreen();
}

// "Done" stays on this screen and lands on the already-submitted state (the
// same one shown when the user leaves and comes back within the cooldown).
function ddDone() { ddShowStep('cooldown'); }

// "Use a different email": swap the chip for an input for this request only.
function ddChangeEmail() {
  _ddEditing = !_ddEditing;
  const step = document.querySelector('#screen-settings-download-data [data-dd-step="confirm"]');
  const inp = step && step.querySelector('[data-dd-input]');
  if (inp) inp.value = '';
  _ddRenderEditing();
  if (_ddEditing && inp) inp.focus();
}

// "Request Again" from the ready step still respects the 24h cooldown.
function ddRequestAgain() { ddShowStep(_ddCooldownLeft() ? 'cooldown' : 'confirm'); }

function ddRequestData() {
  if (_ddCooldownLeft()) { ddShowStep('cooldown'); return; }
  // Needs a signed-in account — its verified email is the only destination.
  AUTH.requireAuth('download-data', () => {
    ddShowStep('confirm');
  });
}

function ddConfirmRequest() {
  if (_ddStep !== 'confirm') return; // ignore double taps / stale calls
  if (_ddCooldownLeft()) { ddShowStep('cooldown'); return; }
  const email = AUTH.currentEmail();
  let to = email;
  if (_ddEditing) {
    const inp = document.querySelector('#screen-settings-download-data [data-dd-input]');
    to = (inp && inp.value || '').trim().toLowerCase();
    if (!_ddValidEmail(to)) {
      const err = document.querySelector('#screen-settings-download-data [data-dd-step="confirm"] [data-dd-error]');
      if (err) { err.textContent = 'Enter a valid email address.'; err.hidden = false; }
      return;
    }
  }
  if (!to) return;
  ddShowStep('preparing');
  _ddSubmitRequest(to).then(() => {
    // email = the account (for the cooldown), to = where this export goes.
    localStorage.setItem(DD_KEY, JSON.stringify({ t: Date.now(), email, to, status: 'submitted' }));
    // Recorded even if the user left meanwhile; only advance if still waiting.
    if (_ddStep === 'preparing') ddShowStep('submitted');
  });
}

// Seam for the real backend: this should call an edge function that emails
// the export to `to` (the account email or the one-off address the user typed). None exists yet, so for now it only
// simulates the short "preparing" wait — nothing is sent.
function _ddSubmitRequest(email) {
  return new Promise(resolve => { _ddTimer = setTimeout(resolve, 1800); });
}

// ── "How did your reply land?" (reply feedback) ─────────────────────────────
// "Use this reply" -> remember the reply's id and, ~3 hours later, ask. Delivery: ONE local notification
// (generic text, never the message) — at most one per calendar day, only if notification permission was
// already granted (onboarding asks; we never prompt here). If notifications are off/denied, or the person
// just opens the app later, the same card is shown in-app for anything that has come due. The answer is
// written to generated_replies.outcome ('helped' | 'not_helped') and to PostHog as reply_feedback.
const FB_PENDING = 'zelo_reply_feedback_pending';      // [{ id, dueAt }]
const FB_LAST_DAY = 'zelo_reply_feedback_notif_day';   // local YYYY-MM-DD of the last notification we scheduled
// 15 minutes after the user decides to save/not save the scan (not the "Use this reply" tap —
// see declineSaveScan()/confirmSaveScan()). Shorter than a first instinct of a few hours: by
// the time hours pass, a user who scans a lot has moved on to several more scans and won't
// remember which reply this was about.
const FB_DELAY_MS = 15 * 60 * 1000;
const FB_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;          // stop asking a week after it came due
const FB_NOTIF_ID = 9101;
let _fbCurrent = null;

function _fbList() { try { return JSON.parse(localStorage.getItem(FB_PENDING) || '[]'); } catch (e) { return []; } }
function _fbSave(l) { try { localStorage.setItem(FB_PENDING, JSON.stringify(l.slice(-10))); } catch (e) {} }
function _fbDay(ts) { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

async function _fbScheduleNotification(dueAt) {
  try {
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    if (!LN) return;
    const perm = await LN.checkPermissions();
    if (!perm || perm.display !== 'granted') return;                // never prompt here
    if (localStorage.getItem(FB_LAST_DAY) === _fbDay(dueAt)) return; // max one a day
    await LN.schedule({ notifications: [{ id: FB_NOTIF_ID, title: 'How did your reply land?', body: 'Tap to tell Zelo if it helped.', schedule: { at: new Date(dueAt) } }] });
    localStorage.setItem(FB_LAST_DAY, _fbDay(dueAt));
  } catch (e) { /* the in-app card still covers it */ }
}

function scheduleReplyFeedback(replyId) {
  if (!replyId) return;
  const list = _fbList();
  if (list.some(x => x.id === replyId)) return;
  const dueAt = Date.now() + FB_DELAY_MS;
  list.push({ id: replyId, dueAt });
  _fbSave(list);
  _fbScheduleNotification(dueAt);
  // Also check in-app right as it comes due, so it appears without needing to background/
  // foreground the app first (real 3h delay: this is just one cheap extra check).
  setTimeout(maybeShowReplyFeedback, FB_DELAY_MS + 500);
}

function maybeShowReplyFeedback() {
  if (_fbCurrent) return;
  const onb = document.getElementById('cine-onboarding');
  if (onb && !onb.hasAttribute('hidden')) return;
  const ld = document.getElementById('cine-landing-loader');
  if (ld && !ld.hidden) return;
  const now = Date.now();
  const list = _fbList().filter(x => now - x.dueAt < FB_EXPIRE_MS);
  if (list.length !== _fbList().length) _fbSave(list);
  const due = list.filter(x => x.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt)[0];
  if (!due) return;
  const anyModal = [...document.querySelectorAll('.pr-modal, .chat-mode-modal, .mini-modal-overlay')].some(m => !m.hidden && m.id !== 'reply-feedback-modal');
  if (anyModal || subscriptionExpired()) return;
  _fbCurrent = due;
  document.getElementById('reply-feedback-modal').hidden = false;
}

function replyFeedbackAnswer(outcome) {
  const cur = _fbCurrent; _fbCurrent = null;
  document.getElementById('reply-feedback-modal').hidden = true;
  if (!cur) return;
  _fbSave(_fbList().filter(x => x.id !== cur.id));
  if (outcome) {
    ZeloRecords.setReplyOutcome(cur.id, outcome);
    ZeloAnalytics.track('reply_feedback', { outcome });
  }
  try { const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications; LN && LN.cancel({ notifications: [{ id: FB_NOTIF_ID }] }); } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(maybeShowReplyFeedback, 3500);
  try {
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    LN && LN.addListener && LN.addListener('localNotificationActionPerformed', () => setTimeout(maybeShowReplyFeedback, 400));
  } catch (e) {}
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(maybeShowReplyFeedback, 800); });

// ── Help Zelo get smarter (opt-in to sharing PRACTICE chats) ──────
// Two entry points, one consent: the modal on the first practice chat and the Settings row.
// The choice is stored locally (zelo_practice_review 'true'|'false') and appended to
// consent_records as consent_type 'practice_content_review' (granted true/false) every time it
// is made. Only while it is 'true' is practice chat TEXT saved server-side (see
// _trackPracticeEnd); metadata-only sessions are saved regardless. Turning it off stops FUTURE
// text saving immediately — already-saved text is NOT deleted (open product decision).
const PR_KEY = 'zelo_practice_review', PR_ASKED = 'zelo_practice_review_asked';
function practiceReviewOn() { return localStorage.getItem(PR_KEY) === 'true'; }

function maybeShowPracticeReviewModal() {
  if (localStorage.getItem(PR_ASKED) && !DEV_ALWAYS_SHOW_PRACTICE_REVIEW) return;
  const modal = document.getElementById('practice-review-modal');
  if (!modal || state.activeScreen !== 'chat') return;
  const onb = document.getElementById('cine-onboarding');
  if (onb && !onb.hasAttribute('hidden')) return;                       // not during the onboarding demo chat
  if (!document.getElementById('chat-mode-modal').hidden) return;       // the pace question comes first
  modal.hidden = false;
}

function practiceReviewChoose(yes) {
  localStorage.setItem(PR_ASKED, '1');          // never ask again, whichever button was tapped
  localStorage.setItem(PR_KEY, String(!!yes));
  ZeloRecords.recordConsent('practice_content_review', !!yes);
  document.getElementById('practice-review-modal').hidden = true;
}

function _renderHelpSmarter() {
  const on = practiceReviewOn();
  document.getElementById('toggle-practice-review').checked = on;
  document.getElementById('hs-off-note').hidden = localStorage.getItem(PR_KEY) !== 'false'; // shown once explicitly off
}
function openHelpSmarter() { _renderHelpSmarter(); pushScreen('settings-help-smarter'); }
function onPracticeReviewToggle(on) {
  localStorage.setItem(PR_ASKED, '1');
  localStorage.setItem(PR_KEY, String(!!on));
  ZeloRecords.recordConsent('practice_content_review', !!on);
  _renderHelpSmarter();
}

function confirmDeleteAccount() {
  showDeleteConfirm(
    'Deleting your account is permanent. All your data will be deleted within 30 days and cannot be recovered.',
    async () => {
      const res = await AUTH.deleteAccount();
      // Only reached when the server refused/failed — on success the app reloads. Say so instead of
      // pretending the account is gone.
      if (res && res.error) flashLimitToast("Couldn't delete your account. Check your connection and try again.");
    }
  );
}

// ============================================================
// KEYBOARD: no zoom-on-focus, no up/down "other fields" bar
// ============================================================
//
// 1) Zoom-on-focus — a STATIC "maximum-scale=1.0, user-scalable=no" in the
//    viewport meta tag didn't stop it (tried and confirmed not enough on
//    real hardware). WebKit is more reliable about respecting the zoom cap
//    when the meta tag's content is actively re-written at the moment of
//    focus, rather than left static since page load. Toggle it on
//    focus/blur via one delegated listener instead of a per-field one.
(function () {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const NORMAL  = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  const NO_ZOOM = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['checkbox', 'radio', 'file', 'button', 'submit'].includes(el.type);
  }
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) meta.setAttribute('content', NO_ZOOM);
  }, true);
  document.addEventListener('focusout', (e) => {
    if (isTextField(e.target)) meta.setAttribute('content', NORMAL);
  }, true);
})();

// 2) The up/down "jump to other field" bar above the keyboard — WebKit adds
//    this whenever it thinks there's more than one reachable field on the
//    page. This app keeps every screen's fields in the DOM at once (just
//    hidden), so WebKit was seeing dozens of "other fields" across every
//    screen and offering to jump between them. Fix: keep fields outside the
//    currently-visible screen out of the tab order (tabindex="-1") so
//    they're not "reachable" — WebKit then has nothing to offer navigation
//    to and drops the bar down to just the field's own return key.
//    Recomputed on a MutationObserver watching class changes, so it covers
//    every screen transition (tabs, pushScreen, onboarding, etc.) through
//    one shared hook instead of needing to be wired into each one by hand.
(function () {
  function isVisible(el) {
    // Screens/tabs in this app hide via opacity:0 + pointer-events:none, not
    // display:none, so offsetParent alone doesn't detect a hidden screen —
    // walk the ancestor chain checking the actual computed visibility.
    let node = el;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      node = node.parentElement;
    }
    return true;
  }
  function refresh() {
    document.querySelectorAll('input, textarea').forEach((el) => {
      if (isVisible(el)) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  }
  let scheduled = false;
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; refresh(); });
  }
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['class', 'hidden'],
  });
  // Synchronous (not debounced) on focusin itself — WebKit decides what's
  // "reachable" for the accessory bar as part of handling this exact event,
  // so the tabindex fix-up needs to land before that, not next frame.
  document.addEventListener('focusin', refresh, true);
  refresh();
})();

// Explicit, JS-only keyboard dismiss — deliberately not relying on WKWebView's
// own native tap-outside-to-dismiss behavior, which has not proven reliable
// across several rounds of native-code attempts. If a text field is
// currently focused and the tap lands outside any input/textarea, blur it
// directly. touchstart (not click) so this fires at the start of the tap,
// same moment native dismiss would — not a delayed second tap.
document.addEventListener('touchstart', (e) => {
  const active = document.activeElement;
  const activeIsField = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  // A device's own native tap-outside-to-dismiss behavior can race ahead of
  // this handler and resign the field before this touchstart's JS runs,
  // leaving document.activeElement already reset to something else by the
  // time it's checked above — which used to make this whole handler bail
  // out as if no field had been focused at all, skipping the click-swallow
  // below and letting the tap fully register on whatever it landed on.
  // Treating a very-recent blur the same as "still focused" covers that.
  const justBlurred = !activeIsField && (Date.now() - _lastTextInputBlurAt < 250);
  // One-shot: consume the grace window immediately so a LATER, unrelated
  // tap (no field focused, nothing to dismiss) can't also read as "just
  // blurred" off the same stale timestamp and wrongly get its own click
  // swallowed too.
  if (justBlurred) _lastTextInputBlurAt = 0;
  if (!activeIsField && !justBlurred) return;
  const target = e.target;
  if (target && target.closest && target.closest('input, textarea')) return;
  // Exception: the AI Coach suggestions toggle handles its own blur+open
  // sequencing (see toggleAiCoachSuggestPanel). Blurring here first would
  // shift the panel/input-bar out from under the tap (nudge clears on
  // blur) before the toggle's own click event fires — the touchend then
  // lands outside the now-moved button and the click gets silently
  // swallowed, which is exactly why the toggle needed two taps before.
  if (target && target.closest && target.closest('#aicoach-suggest-toggle')) return;
  // Same underlying issue, broader exemption: ANY button inside the AI
  // Coach input bar or its attachments row (attach, send, the staged-
  // suggestion pill, the photo-remove button) needs its own tap to land
  // and fire immediately — attach a photo or send a message regardless of
  // whether the keyboard is open or closed. Blurring first here shifts
  // that whole group (nudge clears on blur) out from under the still-
  // active touch before its own click ever fires, which both delays the
  // action until the keyboard's close animation finishes AND can misfire
  // onto a different, now-shifted-into-place element entirely (e.g.
  // tapping "+" landing on the staged pill instead once the row moves).
  // Letting each button's own click handle things natively sidesteps both:
  // there's nothing here forcing an early blur to shift the layout at all.
  // Same for the main chat's own composer (.chat-input-bar) — its Send
  // button needs to fire on the very first tap even with the keyboard
  // still up, not silently dismiss the keyboard and eat that tap.
  if (target && target.closest && target.closest('.aicoach-input-bar, .aicoach-attachments-row, .chat-input-bar')) return;
  // Same underlying issue again: the chat settings sheet (Cancel, the
  // backdrop, Reset/Delete/Mute) and its confirm dialog are full-screen
  // modals opened from the chat screen, where the message composer is
  // very often still focused. Without this exemption, tapping any of them
  // first silently blurs the keyboard and swallows that exact tap's click
  // — reads as "the sheet won't close at all" since the very next tap on
  // Cancel/backdrop does nothing (it's the click-swallow eating it, not a
  // broken handler). These don't need the composer's layout to have
  // settled first, so just let their own tap fire immediately.
  if (target && target.closest && target.closest('.chat-settings-sheet, .chat-confirm-overlay')) return;
  // The onboarding conversation manages its own focus (it deliberately keeps
  // the name field focused). This global handler blurs on the first touch
  // outside the field and swallows that touch's click — which is exactly why
  // Continue and Back needed two presses with the keyboard open.
  if (target && target.closest && target.closest('#cine-convo')) return;
  // Opening her profile from the chat must work on the first tap with the keyboard up.
  if (target && target.closest && target.closest('[data-open-profile], #pp-overlay')) return;
  // Flag this exact tap as "just dismissed the keyboard" (see
  // _dismissingKeyboard's own declaration, ~line 3370) so whatever it
  // landed on — the widget carousel, for instance — can tell not to also
  // treat it as a normal tap. Cleared on the next tick, once this same
  // gesture's other listeners have all had their turn.
  _dismissingKeyboard = true;
  setTimeout(() => { _dismissingKeyboard = false; }, 0);
  if (activeIsField) active.blur();
  // blur() above synchronously fires a real focusout, which refreshes
  // _lastTextInputBlurAt to "now" — reset it again right after so THIS
  // dismiss can't also be mistaken for a fresh "just blurred" race by the
  // very next, unrelated tap (see the one-shot comment above).
  _lastTextInputBlurAt = 0;
  // This same tap must ONLY close the keyboard, never also register as a
  // press on whatever it landed on (a widget card, a button, a link) —
  // previously only the widget carousel's own "reveal chrome" check
  // consulted _dismissingKeyboard, so every other tappable thing still
  // fired its click normally on this exact tap. Swallow the one click
  // this touch is about to produce, globally, for anything it lands on.
  // If no click follows shortly (the touch turned into a scroll/drag
  // instead), the timeout below disarms it so a later, unrelated click
  // is never accidentally eaten.
  document.addEventListener('click', _swallowKeyboardDismissClick, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', _swallowKeyboardDismissClick, { capture: true }), 600);
  // Belt-and-suspenders on real devices: stopImmediatePropagation() above
  // relies on our JS listener actually winning a race against however
  // WKWebView schedules the synthesized click for this gesture — reported
  // as still not reliable enough on-device even after hardening that path.
  // A real, physical full-screen overlay sidesteps the race entirely: it
  // doesn't matter when or how the browser decides to synthesize/dispatch
  // the click, because by the time it does, the overlay (not the widget)
  // is literally the element sitting at that screen point, so the browser's
  // own hit-test resolves the click to the overlay — nothing left for any
  // propagation/order trick to get wrong.
  _armKeyboardDismissClickBlocker();
}, { capture: true, passive: true });

function _armKeyboardDismissClickBlocker() {
  const overlay = document.createElement('div');
  overlay.className = 'kb-dismiss-click-blocker';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 500);
}

function _swallowKeyboardDismissClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// ============================================================
// KEYBOARD-OPEN: nudge a designated "movable" area, pin everything else
// ============================================================
// Native keyboard-triggered page resize is fully disabled (see
// capacitor.config.json — Keyboard.resize: "none"), replacing the earlier
// per-screen position:fixed/sticky workarounds as the primary fix — those
// are left in place as a harmless extra safety net, but with native resize
// off there's nothing left to push them around in the first place.
//
// With native resize off, NOTHING moves automatically when the keyboard
// opens. First version of this only nudged when the input was strictly
// about to be covered — but every one of these inputs sits high enough on
// its screen that the strict check was almost always false, so in practice
// nothing ever visibly moved (looked "dead" when the keyboard opened).
// Changed to always shift the movable group up by a real, visible amount
// once the keyboard opens (still only the designated group — header/logo/
// nav are never in that group, so they can't move), using whichever is
// bigger: the minimum felt-movement amount, or however much is actually
// needed to clear the keyboard for inputs that really do sit low (e.g. the
// AI Coach input bar).
(function () {
  const Keyboard = window.Capacitor?.Plugins?.Keyboard;
  let keyboardHeight = 0;
  let nudgedEls = [];
  let nudgedContentEl = null; // the content-aware element (see contentSelector) currently shifted, if any
  let caretHiddenOn = null; // the input whose blinking caret is currently masked mid-slide, if any

  // input id -> selectors for the element(s) that should move with it,
  // bottom-most last (used to measure keyboard clearance). Falls back to
  // just the input itself when not listed here. An optional `clip` selector
  // names an ancestor that should get overflow:hidden + its current height
  // locked while shifting, so the moving content clips cleanly at that
  // ancestor's boundary (its bottom, in practice its resting top edge —
  // see .scan-scroll-clip) instead of visually overlapping whatever sits
  // above/outside it (the pinned header).
  const MOVABLE_OVERRIDE = {
    // Headline+subtitle and "Who's this about?" now ride along with the
    // input card so all three move together in proportion — but the shift
    // AMOUNT is still measured off just the input card (`measureBy`), not
    // whichever of these three sits lowest. Measuring off the lowest one
    // (previously: the whole block) is what overcorrected before — the card
    // itself was already correct, this only widens which elements share
    // its same transform value.
    // '.widget-carousel' (not '.scan-headline-row') so the whole widget —
    // border, arrows, dots — rides up as one piece with its own content
    // instead of the text sliding up out of alignment with a frame that
    // stayed put.
    'asst-input':    { move: ['.widget-carousel', '.scan-message', '.scan-who-section', '#aicoach-card'], measureBy: '.scan-message' },
    // The suggestions panel and attachments row ride up together with the
    // input bar (bottom-most, so it stays the measureEl the bar's own shift
    // is computed from) — they're structurally attached to it, so leaving
    // them behind looked disconnected. The message thread itself is handled
    // separately via `contentSelector` below: it only rides up when its own
    // last real message is actually close to the keyboard (e.g. a fresh/
    // short conversation shouldn't drag the profile header up just because
    // the input bar, always bottom-anchored, always has to move). See
    // `contentSelector` handling in nudgeFocusedIntoView() for the second,
    // independent shift this produces.
    'aicoach-input': { move: ['.aicoach-suggest-panel', '.aicoach-attachments-row', '.aicoach-input-bar'], contentSelector: '.aicoach-messages' },
    // The whole bar moves as one piece — border included — instead of just
    // the input escaping a stationary bar. That stationary-bar setup was
    // the actual cause of the border-line glitch a border-color fade kept
    // needing to re-patch: the border lived on an element that never
    // moved, so the input could still visibly cross it mid-shift no matter
    // how the color transition was tuned. Moving them together removes the
    // seam structurally — there's no stationary line left to cross. (The
    // jump-to-latest button doesn't need its own entry here — it's a child
    // of .chat-input-bar, anchored to the bar's own top edge, so it moves
    // for free with the bar itself.) The message thread is content-aware,
    // same as .aicoach-input above — see its comment for why.
    'message-input': { move: ['.chat-input-bar'], contentSelector: '#chat-messages' },
    // Onboarding screen 1 (name/photo/birth date): avatar, the name field,
    // and the age field all ride up together instead of just the name input
    // escaping upward on its own. Headline+lede are deliberately NOT in this
    // group and NOT inside the clip box — they sit close enough to the fixed
    // topbar that a keyboard-clearing shift would push them up underneath
    // it. `clip` locks .cine-name-clip's height so the avatar clips cleanly
    // at the lede's bottom edge as it rises, instead of visually overlapping
    // the lede text.
    'cine-name-input': {
      move: ['.cine-avatar-wrap', '.cine-field', '#cine-name-error', '#cine-age-field'],
      clip: '.cine-name-clip',
      measureBy: '#cine-name-input',
    },
  };

  // Bug fixed here: previously fell back to `{ move: [input] }` — an actual
  // DOM element, not a selector — and resolveEls always tried to use it as
  // a CSS selector string (input.closest(sel)), which throws for any input
  // with no MOVABLE_OVERRIDE entry (e.g. the onboarding name field),
  // silently breaking the nudge for every screen that didn't have an
  // explicit entry.
  function movableElsAndClip(input) {
    const config = MOVABLE_OVERRIDE[input.id];
    if (!config) return { els: [input], clip: null, measureEl: input, contentEl: null };
    const els = config.move.map((sel) => input.closest(sel) || document.querySelector(sel)).filter(Boolean);
    const resolvedEls = els.length ? els : [input];
    const measureEl = (config.measureBy && (input.closest(config.measureBy) || document.querySelector(config.measureBy)))
      || resolvedEls[resolvedEls.length - 1];
    const contentEl = config.contentSelector ? document.querySelector(config.contentSelector) : null;
    return { els: resolvedEls, clip: config.clip || null, measureEl, contentEl };
  }

  let clippedEl = null;
  function applyClip(selector, moveEls) {
    const el = document.querySelector(selector);
    if (!el) return;
    // Lock to the height it has right now (before any shift), so the box
    // stays put while its content (moveEls) slides up inside it and gets
    // cut off at its top edge.
    el.style.height = el.getBoundingClientRect().height + 'px';
    el.style.overflow = 'hidden';
    clippedEl = el;
  }
  function clearClip() {
    if (clippedEl) { clippedEl.style.height = ''; clippedEl.style.overflow = ''; clippedEl = null; }
  }

  // Every nudge — first tap included — goes through a real 0.2s eased
  // transition, on a short delay (see the setTimeout calls at the
  // focusin/keyboardWillShow call sites below) rather than applying
  // instantly and synchronously. This is the original design, restored:
  // an earlier version made the first application instant/synchronous to
  // stop the caret flashing at its unshifted spot before catching up —
  // but that traded a real, visible slide for a teleport-feeling snap,
  // which is the opposite of what this is meant to feel like. The brief
  // flash before the delayed shift kicks in is a known, accepted tradeoff
  // of this version, not a bug to re-"fix" by going back to instant.
  // Reads the Y offset actually applied right now, straight from the
  // computed transform matrix — instead of trusting the separately-tracked
  // nudgedShift number below to still match reality. That tracked number
  // is only correct if NOTHING besides this function's own writes changed
  // since the last call — but content this function doesn't own (e.g. the
  // AI Coach suggestions panel expanding, which changes .aicoach-input-bar's
  // real un-transformed position by growing something above it) can shift
  // the group's true layout out from under it. When that happens, "rect +
  // the old tracked shift" reconstructs the WRONG baseline and the next
  // shift compounds on top of that error — worse with every re-trigger,
  // which is exactly the "keeps going up higher each time" bug. Reading
  // the real current transform is correct regardless of why the layout
  // moved, and — since it never touches el.style.transform itself — costs
  // nothing on the smooth-transition front this whole function is built
  // around.
  function _currentShiftY(el) {
    const m = getComputedStyle(el).transform;
    if (!m || m === 'none') return 0;
    const match = m.match(/^matrix\(([^)]+)\)$/);
    if (!match) return 0;
    const parts = match[1].split(',').map(Number);
    return parts.length >= 6 ? -parts[5] : 0; // ty is negative when shifted up; this fn returns the positive shift amount
  }

  function nudgeFocusedIntoView() {
    const active = document.activeElement;
    if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
    // Sign-in/create-account must never be nudged. Checked here — not just
    // at the focusin call site below — because that's exactly what let the
    // real bug through: keyboardWillShow (fires only with a real device
    // keyboard, never in headless testing) calls this function on its own,
    // unconditionally, with no exclusion check of its own. Guarding inside
    // the function itself, off document.activeElement, covers every call
    // site at once instead of relying on each one to remember to check.
    // Tell Zelo More's free-text step (screen-tellzelo) opts out the same
    // way — it's a short wizard page, the field is always already on
    // screen, and this is the one place we deliberately want NO shift at
    // all rather than a correctly-computed one, per explicit direction.
    // Every other keyboard-avoiding field in the app (AI Coach included)
    // keeps the real nudge — this is a targeted exception, not a change to
    // the shared mechanism.
    if (active.closest && (active.closest('#auth-overlay') || active.closest('#screen-tellzelo'))) return;
    const { els, clip, measureEl, contentEl } = movableElsAndClip(active);
    const sameTarget = nudgedEls.length && nudgedEls[0] === els[0];
    const prevEls = sameTarget ? null : nudgedEls;
    const prevContentEl = sameTarget ? null : nudgedContentEl;
    const prevClippedEl = sameTarget ? null : clippedEl;
    if (clip) applyClip(clip, els);
    // Recover the true unshifted position by adding back whatever shift is
    // ACTUALLY on measureEl right now (see _currentShiftY above) — not the
    // separately-tracked nudgedShift, which goes stale the moment anything
    // else changes this group's real layout. This call's own transform
    // write happens only once, below, and never before this read.
    const rect = measureEl.getBoundingClientRect();
    const trueBottom = rect.bottom + _currentShiftY(measureEl);
    const visibleBottom = window.innerHeight - keyboardHeight;
    const overlap = trueBottom - visibleBottom;
    // Moves exactly as much as the keyboard actually covers, no more — a
    // forced minimum (previously always at least 32-56px, "so opening the
    // keyboard is never a no-op") meant the whole group jumped up a visible
    // amount even when nothing was actually about to be covered. Per
    // explicit direction: if the keyboard doesn't overlap anything, don't
    // move at all; if it does, land flush with its top edge, not floating
    // above it.
    const shift = Math.max(overlap, 0);
    // Content-aware clearance for the message thread (chat/AI Coach only,
    // via contentSelector) — a REAL layout shrink, not a transform or a
    // scroll/padding simulation. Two earlier versions of this both had
    // real bugs: a transform moved the container's top edge underneath
    // its fixed header (confirmed on-device); a padding+manual-scroll
    // version fought its own race conditions and once showed the wrong
    // message entirely. This instead does exactly what the AI Coach
    // suggestions panel already does well (explicit reference for this
    // fix): opening that panel shrinks .aicoach-messages via ordinary
    // flex layout (flex:1 loses space to its now-taller sibling) and the
    // browser's own scroll-clamping reveals the true bottom — no manual
    // measurement of "where's the last message" at all. Margin-bottom
    // here plays the same role the panel's own height does there: shrink
    // the container by exactly as much as the bar rises by, so the
    // container's new bottom edge and the bar's new top edge meet with no
    // gap and no overlap — then let the browser do the rest.
    if (contentEl) {
      contentEl.style.transition = 'margin-bottom 0.2s ease';
      contentEl.style.marginBottom = shift + 'px';
      // Mirrors _updateAiCoachSuggestToggle()'s own transitionend hook —
      // mid-transition, scrollHeight/clientHeight are still the old,
      // taller values, so the only reliable moment to correct the scroll
      // position is once the resize has actually finished settling.
      // _scrollToLogicalBottom(), not raw scrollHeight: contentEl is one of
      // the containers _ensureScrollableOverflow() pads out with a
      // trailing spacer on a short conversation, and scrolling to the raw
      // scrollHeight here would land inside that spacer instead of at the
      // real last message — visible as the conversation shooting way
      // further up than the keyboard actually requires.
      const fixupScroll = () => { _scrollToLogicalBottom(contentEl); };
      contentEl.addEventListener('transitionend', fixupScroll, { once: true });
      setTimeout(fixupScroll, 250); // safety net if the transition never fires (e.g. shift unchanged)
    }
    // Mask the focused input's own blinking text caret for exactly the
    // duration of the slide below — not the whole app, and not the 80ms/30ms
    // delay before it (that pre-slide flash is the separate, accepted
    // tradeoff described above). The caret twitching/teleporting mid-slide
    // is WebKit's own text-cursor overlay re-resolving its on-screen
    // position against the transform each time it repaints, independently
    // of the compositor actually moving the box — a rendering-pipeline
    // mismatch, not something a different easing/duration changes. Hiding
    // it for this one transition and revealing it once the transition
    // actually lands removes the visible glitch without touching how the
    // slide itself moves or how long it takes.
    if (caretHiddenOn && caretHiddenOn !== active) { caretHiddenOn.style.caretColor = ''; caretHiddenOn = null; }
    active.style.caretColor = 'transparent';
    caretHiddenOn = active;
    const revealCaret = () => { if (caretHiddenOn === active) { active.style.caretColor = ''; caretHiddenOn = null; } };
    (measureEl || els[0]).addEventListener('transitionend', revealCaret, { once: true });
    setTimeout(revealCaret, 500); // safety net only, in case transitionend never fires (e.g. shift value unchanged) — not a timing tweak of the slide itself
    els.forEach((el) => {
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = `translateY(${-shift}px)`;
    });
    // contentEl's own clearance (padding-bottom + scrollTop) was already
    // applied above, inline with computing it — no transform to set here.
    // Release the previous target's group only now, after the read/write
    // above — not before, via an unconditional clearNudge() call, as this
    // used to do. Clearing first inserted a transform write ahead of the
    // layout-forcing read above, in the same tick; that forces the browser
    // to resolve style mid-script and hands the transition system that
    // just-cleared (zero) value as its start point, so the old group would
    // skip its 0.25s ease-out and instantly snap to rest — the same
    // teleport this function exists to avoid, just relocated to focus
    // switches between differently-configured inputs.
    if (prevEls) prevEls.forEach((el) => { el.style.transform = ''; });
    if (prevContentEl && prevContentEl !== contentEl) prevContentEl.style.marginBottom = '';
    if (prevClippedEl && prevClippedEl !== clippedEl) {
      prevClippedEl.style.height = '';
      prevClippedEl.style.overflow = '';
    }
    nudgedEls = els;
    nudgedContentEl = contentEl;
  }
  // `instant`: skip the 0.2s ease and snap straight back with no visible
  // motion at all — used when leaving the screen entirely (back button,
  // swipe-back), where any animated settle reads as "the screen moves by
  // itself" during a navigation that should hold completely still. The
  // keyboard's own dismiss (keyboardWillHide, tapping elsewhere without
  // navigating away) keeps the normal animated ease-back — there, the
  // slide is the point, mirroring how it opened.
  function clearNudge(instant) {
    if (instant) {
      nudgedEls.forEach((el) => { el.style.transition = 'none'; });
      if (nudgedContentEl) nudgedContentEl.style.transition = 'none';
    }
    nudgedEls.forEach((el) => { el.style.transform = ''; });
    nudgedEls = [];
    if (nudgedContentEl) { nudgedContentEl.style.marginBottom = ''; nudgedContentEl = null; }
    clearClip();
  }

  if (Keyboard) {
    Keyboard.addListener('keyboardWillShow', (info) => {
      keyboardHeight = (info && info.keyboardHeight) || 0;
      window.__zeloKbH = keyboardHeight;               // read by the onboarding conversation
      window.dispatchEvent(new Event('zelo-kb'));
      setTimeout(nudgeFocusedIntoView, 30);
    });
    Keyboard.addListener('keyboardWillHide', () => {
      keyboardHeight = 0;
      window.__zeloKbH = 0;
      window.dispatchEvent(new Event('zelo-kb'));
      clearNudge();
    });
  }
  // Delayed (80ms), not synchronous — see the note on nudgeFocusedIntoView
  // above. Also covers switching focus to a different field while the
  // keyboard is already open, which doesn't fire another keyboardWillShow.
  //
  // Sign-in/create-account (#auth-overlay) and Tell Zelo More's free-text
  // step (#screen-tellzelo) opt out entirely — no MOVABLE_OVERRIDE entry,
  // no fallback shift, nothing. With native resize already off, skipping
  // the nudge here means those fields never move on focus at all, rather
  // than moving "correctly". (nudgeFocusedIntoView() bails on both too —
  // this is just skipping the pointless setTimeout, not the only guard.)
  document.addEventListener('focusin', (e) => {
    if (e.target.closest && (e.target.closest('#auth-overlay') || e.target.closest('#screen-tellzelo'))) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      setTimeout(nudgeFocusedIntoView, 80);
    }
  }, true);
  document.addEventListener('focusout', (e) => {
    if (e.target.closest && (e.target.closest('#auth-overlay') || e.target.closest('#screen-tellzelo'))) return;
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') return;
    // Only clear if the blurring field's own group is still the one tracked
    // as nudged. WKWebView doesn't guarantee focusout(old) fires before
    // focusin(new) when focus jumps directly between two fields (keyboard
    // "next field" toolbar, programmatic .focus()) — when it arrives late,
    // nudgedEls has already been repointed at the newly-focused field by
    // its own focusin, and an unconditional clearNudge() here would wipe
    // that brand-new nudge back to unshifted instead of leaving it alone.
    const { els } = movableElsAndClip(e.target);
    if (nudgedEls.length && nudgedEls[0] === els[0]) {
      // If this blur is happening because of the global "tap outside a
      // focused field dismisses the keyboard" handler (_dismissingKeyboard,
      // set synchronously just before its own blur() call — see that
      // handler's own comment), clear instantly. That same handler is what
      // fires on the very first touchstart of an edge-swipe-back gesture
      // too, well before this screen's own swipe code gets a chance to run
      // (that code only reacts once the drag crosses its axis threshold on
      // touchmove) — so THIS is actually where "the screen moves by itself"
      // during a swipe-back was really coming from: the animated ease-back
      // this focusout used to always trigger, already underway before the
      // swipe's own instant-clear call ever ran.
      clearNudge(_dismissingKeyboard);
    }
  }, true);

  // Exposed so code outside this IIFE can force a fresh, correctly-timed
  // re-nudge after ITS OWN layout change finishes settling — see the AI
  // Coach suggestions-panel focusin handler above in the file, which
  // needs this because the panel's 0.35s collapse transition runs well
  // past the 30-80ms this module normally waits before measuring.
  window._nudgeFocusedIntoView = nudgeFocusedIntoView;
  // Exposed so a screen can force its own group back to rest on the way
  // out, rather than relying only on blur/keyboardWillHide to catch it —
  // see closeAiCoach()'s call to this, added for the "swipes back to Scan
  // and the content visibly drops" glitch: swiping away doesn't reliably
  // blur the focused field before the screen change starts, so a stale
  // shift could still be sitting on .aicoach-messages/.aicoach-input-bar
  // and only resolve (snapping back down) once something else finally
  // cleared it.
  window._clearKeyboardNudge = clearNudge;
})();

// ============================================================
// ONBOARDING NAME FIELD — one-time width sizing (not per-keystroke)
// ============================================================
// .cine-name-input is text-align:left with its box sized to fit the
// placeholder ("Choose any name") exactly — .cine-screen (its parent)
// already centers children via align-items:center, so this snug box is
// centered as a unit and left-align inside it reads as "starts where the
// visible text starts," lining up with the placeholder's first letter
// instead of the true left edge of a full-width box. Measured once here,
// not on every keystroke — the box's width never changes after this runs,
// so there's nothing to jump when typing starts (same box, same edge,
// before and after). Most real names render narrower than the 16-char
// placeholder and fit inside this width with room to spare; a longer name
// just scrolls within the field like any fixed-width text input.
(function () {
  const input = document.getElementById('cine-name-input');
  if (!input) return;
  function sizeCineNameInput() {
    const cs = getComputedStyle(input);
    const mirror = document.createElement('span');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    mirror.style.left = '-9999px';
    mirror.style.fontSize = cs.fontSize;
    mirror.style.fontWeight = cs.fontWeight;
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.textContent = input.placeholder;
    document.body.appendChild(mirror);
    const textWidth = mirror.getBoundingClientRect().width;
    document.body.removeChild(mirror);
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    input.style.width = Math.min(300, textWidth + paddingLeft + paddingRight + 10) + 'px';
  }
  sizeCineNameInput();
  // Inter loads async (Google Fonts, display:swap) — if it swaps in after
  // the measurement above, re-measure once against the real metrics so the
  // box isn't left sized to a temporary fallback font's width.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeCineNameInput);
})();


