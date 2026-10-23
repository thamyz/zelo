// ================================================================
// 12-onboarding-intro.js — the first thing a new user sees
//
// The streak notification banner, onboarding phase 1 (typewriter → word
// morph → Zelo logo) and the conversational intro that asks for a name.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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
  3:  { label: 'Continue', enabledFn: () => !!cineAnswers.source, entrance: cineRunQuestionEntrance },     // NEW — "Where did you hear about Zelo?"
  4:  { label: 'Continue', enabledFn: () => !!cineAnswers.overthink, entrance: cineRunQuestionEntrance },
  5:  { label: 'Continue', enabledFn: () => (cineAnswers.help || []).length > 0, entrance: cineRunQuestionEntrance },
  6:  { label: 'Continue', enabledFn: () => !!cineAnswers.attracted, entrance: cineRunQuestionEntrance },
  7:  { label: 'Continue', enabledFn: () => !!cineAnswers.tone, entrance: cineRunStyleEntrance },
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
let cineAnswers = { gender: null, source: null, overthink: null, help: [], attracted: null, tone: null, referral: null, style_variant: null };

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
  _registerDriveArm();
  const overlay = document.getElementById('cine-onboarding');

  if (localStorage.getItem('zelo_onboarding_done')) {
    // Already onboarded: don't assign an arm, but do re-register one that
    // was assigned on an earlier launch, so this user's later events (scans,
    // paywall, trial) still carry the arm the test needs to measure.
    if (localStorage.getItem(STYLE_VARIANT_KEY)) _registerStyleVariant();
    if (overlay) overlay.setAttribute('hidden', '');
    return;
  }
  if (!overlay) return;

  _registerStyleVariant();
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
let _showcaseVideoPrimed = false;
function _armCineShowcaseCycle() {
  _cineShowcaseTimers.forEach(clearTimeout);
  _cineShowcaseTimers = [];
  const video = document.getElementById('cine-showcase-video');
  if (!video) return;
  // A decode failure or a memory-pressure eviction leaves the element black with no error to catch at play
  // time, so a video that reports an error or has no decoded data is reloaded before it is played.
  if (video.error || video.readyState === 0) { try { video.load(); } catch (e) {} }
  video.currentTime = 0;
  // iOS WebKit won't paint a video's first frame until play() has been called at least once. That
  // play-then-pause priming is only needed ONCE: repeating it every cycle raced the real play() below (if
  // the priming promise resolved late its pause() cancelled the real playback, and the seek back to 0
  // showed a black frame) — the poster covers the frame before playback starts.
  if (!_showcaseVideoPrimed) {
    _showcaseVideoPrimed = true;
    video.play().then(() => {
      if (cineStep !== 'showcase' || video.currentTime < 0.3) { video.pause(); video.currentTime = 0; }
    }).catch(() => { _showcaseVideoPrimed = false; });
  }
  // Guarded: this fires ~1s later, by which time the user may already have
  // left the showcase — without the check it starts the video playing on a
  // screen that is no longer on display, and nothing stops it again.
  _cineShowcaseTimers.push(setTimeout(() => {
    if (cineStep !== 'showcase') return;
    video.play().catch(() => { try { video.load(); video.play().catch(() => {}); } catch (e) {} });
  }, CINE_SHOWCASE_ENTRANCE_MS));
  // Safety net: if it still is not playing a moment later (black screen), kick it again.
  _cineShowcaseTimers.push(setTimeout(() => {
    if (cineStep === 'showcase' && video.paused) video.play().catch(() => {});
  }, CINE_SHOWCASE_ENTRANCE_MS + 700));
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
function cineShowcaseSignIn(e) {
  if (e) e.stopPropagation();
  AUTH.startSignIn(cineEnterAppAfterSignIn, cineShowcaseStart); // no account -> onboarding
}
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
