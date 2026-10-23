// ================================================================
// 13-onboarding-steps.js — the onboarding questions and the screens after them
//
// Steps 1–16: the questions, the reply-style demo, the referral field, the
// plan screen, trial and offer, plus the sign-up prompt and welcome-back.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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
  const referralInput = document.getElementById('cine-referral-input');
  if (referralInput && cineAnswers.referral && !referralInput.value) referralInput.value = cineAnswers.referral;
}

// ================================================================
// STEP 7 — "Which reply sounds like you?"
//
// A scripted demo of what Scan actually does: a persona texts, the user
// picks the reply they'd really send, and only then is told which style
// that was. The answer is a real STYLE_LABELS id (not an invented tone
// word), saved to FIRST_STYLE_KEY, which getEligibleStyles() then puts
// first on every scan — so this question changes what the app does.
//
// Nothing here calls the AI: there's no account until step 14 and the
// proxy rejects signed-out callers, so every line is written out.
// ================================================================

// Three conversations, one per A/B arm. A user sees exactly one, fixed for
// the life of the install (_styleDemoVariant()). They differ only in what
// Kendra says and the five replies to it — the layout, the style order and
// the reveal are identical, so whichever converts better is down to the
// conversation itself and nothing else.
//
// Every line follows the natural-texting rules: no manufactured jokes, no
// forced flirting, no pickup lines, no tidy closing punctuation, and not
// every reply ends in a question. A joke-shaped or over-polished line reads
// as machine-written instantly, which is the one thing this screen can't be.
const STYLE_DEMO_VARIANTS = {
  // A — getting to know someone
  a: {
    her: "i feel like you're actually pretty quiet in person, am i wrong?",
    options: [
      { style: 'smooth', text: "a little at first maybe, but once i'm comfortable with someone i talk a lot more" },
      { style: 'funny',  text: "depends, my friends would probably disagree with you on that one" },
      { style: 'direct', text: "not really, i'm pretty talkative once i get to know someone" },
      { style: 'warmer', text: "i can be sometimes, especially around new people. are you usually the talkative one?" },
      { style: 'bolder', text: "you'll have to find out when we meet, i think you'd be surprised" },
    ],
  },
  // B — first date
  b: {
    her: "okay random question but do you prefer going somewhere nice for a first date or doing something more casual",
    options: [
      { style: 'smooth', text: "somewhere casual honestly, i feel like it's easier to get to know someone when there's not too much pressure" },
      { style: 'funny',  text: "casual for sure, imagine sitting through a fancy dinner and realizing you have nothing to talk about" },
      { style: 'direct', text: "probably somewhere casual like coffee or getting food, what would you prefer?" },
      { style: 'warmer', text: "i'd be happy with either honestly, i think it depends more on who you're going with" },
      { style: 'bolder', text: "i'd rather take you somewhere casual first, we can save the fancy dinner for the second date" },
    ],
  },
  // C — going out or staying in
  c: {
    her: "i remember you said you liked going out but are you actually more of a going out person or staying in person",
    options: [
      { style: 'smooth', text: "depends who i'm with honestly, i don't really mind either" },
      { style: 'funny',  text: "i always say i'm staying in and somehow end up going out anyway" },
      { style: 'direct', text: "probably going out, i get bored if i'm home all weekend" },
      { style: 'warmer', text: "i like both tbh, what about you? are you more of a homebody?" },
      { style: 'bolder', text: "i'd rather go out, we should get food sometime if you're down" },
    ],
  },
};
const STYLE_VARIANT_KEY = 'zelo_style_variant';
const STYLE_VARIANT_IDS = Object.keys(STYLE_DEMO_VARIANTS);

// Assigned once per install and never re-rolled, so a user who backs out of
// onboarding and returns sees the same conversation (a re-roll would put one
// person in two arms and quietly poison the result). Assignment happens at
// launch rather than on reaching step 7, so the earlier steps' events carry
// it too — that is what makes it possible to check the arms were balanced
// BEFORE the screen they differ on, i.e. an A/A sanity check.
function _styleDemoVariant() {
  let v = localStorage.getItem(STYLE_VARIANT_KEY);
  if (!STYLE_DEMO_VARIANTS[v]) {
    v = STYLE_VARIANT_IDS[Math.floor(Math.random() * STYLE_VARIANT_IDS.length)];
    localStorage.setItem(STYLE_VARIANT_KEY, v);
  }
  return v;
}

function _styleDemoConfig() { return STYLE_DEMO_VARIANTS[_styleDemoVariant()]; }

// Registers the arm with analytics (auto-attached to every event that
// allow-lists style_variant) and queues it for this account's own
// onboarding_responses row. Called at launch; see initOnboarding().
function _registerStyleVariant() {
  const v = _styleDemoVariant();
  try { ZeloAnalytics.setGlobal('style_variant', v); } catch (_) {}
  cineAnswers.style_variant = v;
  try { ZeloRecords.queueOnboarding(cineAnswers); } catch (_) {}
  return v;
}

const CINE_STYLE_DOTS_MS = 620, CINE_STYLE_CHAR_MS = 16, CINE_STYLE_SPACE_MS = 26;

let _cineStyleTimers = [], _cineStyleGen = 0, _cineStyleRepicked = false;

function _cineStyleClearTimers() { _cineStyleTimers.forEach(clearTimeout); _cineStyleTimers = []; }
function _cineStyleWait(ms) { return new Promise(res => { _cineStyleTimers.push(setTimeout(res, ms)); }); }

async function cineRunStyleEntrance() {
  _cineStyleClearTimers();
  const gen = ++_cineStyleGen;
  const thread = document.getElementById('cine-style-thread');
  const opts   = document.getElementById('cine-style-opts');
  const result = document.getElementById('cine-style-result');
  if (!thread || !opts || !result) return;

  thread.innerHTML = '';
  opts.innerHTML = '';
  result.hidden = true;

  const her = document.createElement('p');
  her.className = 'sty-bubble sty-bubble--her';
  thread.appendChild(her);

  // Reached by Back with an answer already given: show the finished state
  // rather than replaying the whole demo.
  const convo = _styleDemoConfig();

  if (cineAnswers.tone) {
    her.textContent = convo.her;
    _cineStyleCommit(cineAnswers.tone, true);
    return;
  }

  // Fired once per arrival at the unanswered screen — the denominator for
  // every conversion rate this test reports.
  try { ZeloAnalytics.track('style_demo_shown', {}); } catch (_) {}

  her.classList.add('sty-bubble--dots');
  her.innerHTML = '<span></span><span></span><span></span>';
  await _cineStyleWait(CINE_STYLE_DOTS_MS);
  if (gen !== _cineStyleGen || cineStep !== 7) return;
  her.classList.remove('sty-bubble--dots');
  her.textContent = '';

  for (const ch of convo.her) {
    her.textContent += ch;
    _convoTick(ch);
    await _cineStyleWait(ch === ' ' ? CINE_STYLE_SPACE_MS : CINE_STYLE_CHAR_MS);
    if (gen !== _cineStyleGen || cineStep !== 7) return;
  }

  await _cineStyleWait(260);
  if (gen !== _cineStyleGen || cineStep !== 7) return;
  _cineStyleRenderOptions();
}

function _cineStyleRenderOptions() {
  const opts = document.getElementById('cine-style-opts');
  if (!opts) return;
  opts.innerHTML = '';
  _styleDemoConfig().options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sty-opt sty-opt--in' + (o.style === cineAnswers.tone ? ' selected' : '');
    b.textContent = o.text;
    b.onclick = () => cineStylePick(o.style);
    opts.appendChild(b);
    // One-shot entrance: both classes come off once it has played, so
    // nothing keeps an `animation` a reparent could replay (2026-10-09j).
    _cineStyleTimers.push(setTimeout(() => {
      b.classList.add('sty-opt--playing');
      _cineStyleTimers.push(setTimeout(() => {
        b.classList.remove('sty-opt--in', 'sty-opt--playing');
      }, CINE_OPT_ANIM_MS + 40));
    }, CINE_OPT_STAGGER_MS * i));
  });
}

function cineStylePick(style) {
  const options = _styleDemoConfig().options;
  const position = options.findIndex(o => o.style === style);
  if (position === -1) return;
  cineAnswers.tone = style;
  localStorage.setItem('zelo_onb_tone', style);
  localStorage.setItem(FIRST_STYLE_KEY, style);
  // position is 1-5 down the list, so a result can be checked for plain
  // "everyone taps the first one" bias before it is read as a preference.
  try {
    ZeloAnalytics.track('style_demo_picked', { tone: style, position: position + 1, repicked: _cineStyleRepicked });
  } catch (_) {}
  _cineStyleCommit(style, false);
  cineSetNextEnabled(true);
}

// Puts the chosen reply into the thread as the user's own message, clears
// the choices and names the style behind it.
function _cineStyleCommit(style, instant) {
  const thread = document.getElementById('cine-style-thread');
  const opts   = document.getElementById('cine-style-opts');
  const result = document.getElementById('cine-style-result');
  const option = _styleDemoConfig().options.find(o => o.style === style);
  if (!thread || !opts || !result || !option) return;

  thread.querySelector('.sty-bubble--me')?.remove();
  const me = document.createElement('p');
  me.className = 'sty-bubble sty-bubble--me' + (instant ? '' : ' sty-bubble--pop');
  me.textContent = option.text;
  thread.appendChild(me);
  if (!instant) {
    _cineStyleTimers.push(setTimeout(() => me.classList.remove('sty-bubble--pop'), 460));
  }

  opts.innerHTML = '';

  const label = document.getElementById('cine-style-result-label');
  const sub   = document.getElementById('cine-style-result-sub');
  if (label) {
    label.textContent = 'You picked ' + (STYLE_LABELS[style] || style) + '.';
    label.style.color = (STYLE_COLORS[style] || {}).accent || 'var(--accent)';
  }
  if (sub) sub.textContent = "We'll use this style first when you try Scan.";

  result.hidden = false;
  result.classList.remove('sty-result--in');
  if (!instant) {
    void result.offsetWidth;
    result.classList.add('sty-result--in');
    _cineStyleTimers.push(setTimeout(() => result.classList.remove('sty-result--in'), 460));
  }
}

// Brings the choices back without retyping her message. The existing answer
// stands until a different one is picked, so Continue stays unlocked.
function cineStylePickAgain() {
  _cineStyleRepicked = true;
  _cineStyleClearTimers();
  const result = document.getElementById('cine-style-result');
  if (result) result.hidden = true;
  document.querySelector('#cine-style-thread .sty-bubble--me')?.remove();
  _cineStyleRenderOptions();
}

// ================================================================
// STEP 8 — referral code (optional, no shared CTA — see CINE_STEPS[8])
// ================================================================

// Apply stores the code locally and confirms it — the account doesn't exist yet at this point in
// onboarding, so real redemption (crediting the referrer) can't happen until sign-up completes a few
// steps later. See _redeemPendingReferralIfAny(), which reads this same zelo_onb_referral value.
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

// Step 13 ("Your plan is set"): the goal the user picked in step 5, phrased
// so it reads as a thing being worked on. Keyed by the same ids that
// question's own options use, so the two can't drift apart.
const CINE_READY_GOALS = {
  'what-to-say': 'Knowing what to say',
  'keep-going':  'Keeping conversations going',
  'natural':     'Sounding more like yourself',
  'flirting':    'Flirting without it feeling forced',
  'confident':   'Feeling more confident',
};
// One line per goal, in the same plain register as the demo replies.
const CINE_READY_GOAL_NOTES = {
  'what-to-say': 'Getting past the blank screen when you open a chat.',
  'keep-going':  'Getting past the awkward "what do i say now" moments.',
  'natural':     'Sounding like you, not like a script.',
  'flirting':    'Being playful without it landing weird.',
  'confident':   'Sending it without second-guessing every word.',
};

function cineRunPlanEntrance() {
  const screen = document.querySelector('.cine-screen[data-screen="13"]');
  if (screen) {
    screen.classList.remove('plan-entrance');
    void screen.offsetWidth; // force reflow so the animation replays every visit
    screen.classList.add('plan-entrance');
  }

  const name = (localStorage.getItem('zelo_display_name') || '').trim();
  const nameEl = document.getElementById('cine-ready-name');
  if (nameEl) nameEl.textContent = (name || 'you') + '.';

  const style = cineAnswers.tone || localStorage.getItem(FIRST_STYLE_KEY);
  const styleEl = document.getElementById('cine-ready-style');
  if (styleEl) {
    styleEl.textContent = STYLE_LABELS[style] || 'Smooth';
    // Same colour the style was named in on step 7, so the two screens read
    // as the same answer rather than two unrelated statements.
    styleEl.style.color = (STYLE_COLORS[style] || {}).accent || 'var(--accent)';
  }

  const help = (cineAnswers.help && cineAnswers.help.length) ? cineAnswers.help : [];
  const topGoal = CINE_READY_GOALS[help[0]] ? help[0] : 'natural';
  const goalEl = document.getElementById('cine-ready-goal');
  if (goalEl) goalEl.textContent = CINE_READY_GOALS[topGoal];
  const noteEl = document.getElementById('cine-ready-goal-note');
  if (noteEl) noteEl.textContent = CINE_READY_GOAL_NOTES[topGoal];
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

// Called once, right after a brand-new account's profile row is written (services/auth.js
// _onSignedIn / _insertProfileFromOnboarding). Reads whatever step 8's "Enter referral code" field
// already saved (zelo_onb_referral — was "saved for later, no backend yet" until this). Silent no-op
// for "no code typed" / "code invalid" / "already used one" — redeemReferralCode() never reveals which.
async function _redeemPendingReferralIfAny() {
  const code = localStorage.getItem('zelo_onb_referral');
  localStorage.removeItem('zelo_onb_referral');   // one-shot either way
  if (!code || typeof ZeloRecords === 'undefined') return;
  const ok = await ZeloRecords.redeemReferralCode(code).catch(() => false);
  if (ok) {
    try { ZeloAnalytics.track('referral_signup_completed'); } catch (e) {}
    // Reward granting is not built yet (no real entitlement system exists) — this is a placeholder
    // confirmation only, deliberately vague about WHAT the reward is rather than promising one.
    setTimeout(() => showNotice('Invite code added', "You and your friend are both set — thanks for joining through them!"), 600);
  }
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
    // Deliberately not cached: iOS lets this change in Settings at any time,
    // so the only trustworthy answer is a live checkPermissions() at the point
    // of use — which is what _fbScheduleNotification() does.
    return LocalNotifications.requestPermissions().then(() => {}).catch(() => {});
  }
  // Plain web (Netlify) fallback — no native runtime, use the browser API.
  try {
    if (window.Notification && typeof Notification.requestPermission === 'function') {
      return Promise.resolve(Notification.requestPermission()).catch(() => {});
    }
  } catch (_) {}
  return Promise.resolve();
}

// ---- End of Phase 2 (step 13) — screen 14 ("Start your 3-day FREE trial")
// then, only if the user declines it (taps back), screen 14 (one-time
// offer). Screen 13 is a dedicated screen built to match the reference
// mockup exactly (see #screen-trial-start in index.html) — NOT the app's
// existing #screen-paywall, which stays in place only for the History tab's
// upgradeNow() entry point, a separate already-shipped feature. ----

// ── PRICING — one source of truth for every paywall surface ────
// The two products: annual THB 999, monthly THB 399, 3-day free trial as the
// introductory offer. Every price shown anywhere in the app is derived from
// these, so no screen can drift into a different currency or a figure that
// does not correspond to a real product (the old #screen-paywall was still in
// USD, and the one-time offer struck through THB 2,999 — a price that has
// never existed for anything).
const PRICE_ANNUAL_THB   = 999;
const PRICE_MONTHLY_THB  = 399;
const PRICE_OFFER_THB    = 699;   // one-time win-back offer, annual
const _thb = n => 'THB ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The only honest anchor for an annual price is what 12 months actually cost
// at the monthly rate — that is a real, purchasable comparison.
const PRICE_ANNUAL_AT_MONTHLY_THB = PRICE_MONTHLY_THB * 12;   // 4,788
const _pctOff = price => Math.round((1 - price / PRICE_ANNUAL_AT_MONTHLY_THB) * 100);

const TRIAL_ANNUAL_PRICE  = _thb(PRICE_ANNUAL_THB / 12) + '/mo';
const TRIAL_ANNUAL_NOTE   = _thb(PRICE_ANNUAL_THB) + ' billed annually';
const TRIAL_ANNUAL_LEGAL  = '3 days free, then ' + _thb(PRICE_ANNUAL_THB) + ' per year.<br>Billed annually and renews automatically unless canceled in the App Store.';
const TRIAL_MONTHLY_PRICE = _thb(PRICE_MONTHLY_THB) + '/mo';
const TRIAL_MONTHLY_LEGAL = '3 days free, then ' + _thb(PRICE_MONTHLY_THB) + ' per month.<br>Renews automatically unless canceled in the App Store.';
const OFFER_PCT = _pctOff(PRICE_OFFER_THB);
const OFFER_WAS = _thb(PRICE_ANNUAL_AT_MONTHLY_THB);
const OFFER_NOW = _thb(PRICE_OFFER_THB) + '/year';

// #screen-paywall (History's upgradeNow() entry point) — same two products,
// rendered from the same numbers instead of the hardcoded USD it shipped with.
const PAYWALL_PRICES = {
  monthlyPrice:  _thb(PRICE_MONTHLY_THB),
  yearlyStrike:  _thb(PRICE_ANNUAL_AT_MONTHLY_THB),
  yearlyPrice:   _thb(PRICE_ANNUAL_THB) + ' / year',
  yearlyPerMo:   _thb(PRICE_ANNUAL_THB / 12)
};

const PAYWALL_ANNUAL_LABEL = PAYWALL_PRICES.yearlyPrice;   // for analytics

function renderPaywallPrices() {
  const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
  // .paywall-plan-price is "<amount> <small>/ mo</small>" — only the leading
  // text node is the amount, so textContent would eat the "/ mo" suffix.
  const setAmount = (sel, text) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const first = el.firstChild;
    if (first && first.nodeType === 3) first.nodeValue = text + ' ';
    else el.textContent = text;
  };
  setAmount('#paywall-plan-monthly .paywall-plan-price', PAYWALL_PRICES.monthlyPrice);
  set('#paywall-plan-monthly .paywall-plan-note',        PAYWALL_PRICES.monthlyPrice + ' billed monthly');
  set('#paywall-plan-yearly .paywall-plan-strike',       PAYWALL_PRICES.yearlyStrike);
  set('#paywall-plan-yearly .paywall-plan-strike-price', PAYWALL_PRICES.yearlyPrice);
  setAmount('#paywall-plan-yearly .paywall-plan-price',  PAYWALL_PRICES.yearlyPerMo);
  set('#paywall-plan-yearly .paywall-plan-permo-pill',   '(~' + PAYWALL_PRICES.yearlyPerMo + '/mo)');
}

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
  ZeloAnalytics.track('paywall_viewed', { screen: 'trial_start', plan: 'annual', price: PAYWALL_ANNUAL_LABEL });
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
  // The History button on Scan sits directly under where the skip X was, so a second tap during (or just
  // after) this hand-off used to land on it. Swallow taps until the loader is gone plus a short grace.
  if (!document.getElementById('post-onboarding-tap-guard')) {
    const g = document.createElement('div');
    g.id = 'post-onboarding-tap-guard';
    g.style.cssText = 'position:fixed;inset:0;z-index:2100;background:transparent;';
    document.body.appendChild(g);
    setTimeout(() => g.remove(), CINE_LANDING_MS + 300 + 800);
  }
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
  // Second launch onward: the Zelo logo and its star, no words. The first launch has its own
  // intro (the typewriter and word morph in onboarding), so this only runs once onboarding is done.
  if (!localStorage.getItem('zelo_onboarding_done')) return;
  const overlay = document.getElementById('welcome-back-overlay');
  const logo    = document.getElementById('welcome-back-type');
  if (!overlay || !logo) return;

  // On the phone the native app-icon screen is still fading out for the first ~0.3s after the page
  // paints, which would hide the start of the animation. Hold the logo back until it has gone.
  const native = !!window.webkit?.messageHandlers?.zeloReady;
  overlay.hidden = false;
  overlay.classList.remove('welcome-back--out');
  logo.classList.remove('cine-p1-logo--in');
  logo.style.opacity = '0';
  setTimeout(() => {
    logo.style.opacity = '';
    void logo.offsetWidth;
    logo.classList.add('cine-p1-logo--in');
    // One tick as the star pops in (the star has a 0.28s delay in CSS).
    setTimeout(() => { navigator.vibrate?.(6); _cineHaptic('MEDIUM'); }, 280);
    setTimeout(() => {
      overlay.classList.add('welcome-back--out');
      setTimeout(() => { overlay.hidden = true; logo.classList.remove('cine-p1-logo--in'); }, 400);
    }, 1500);
  }, native ? 380 : 0);
}



// ================================================================
// SCAN BEGINNER POP-UP
// Shown once per session when the user first enters the Scan tab.
// Not persisted (testing phase).
// ================================================================

let scanIntroShown = false;

function maybeShowScanIntro() {}
// ================================================================
