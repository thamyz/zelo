// ================================================================
// 18-settings.js — Settings, and everything reachable from Account
//
// Profile & Login (photo crop, password), personalization, practice
// preferences, privacy and data, download my data, help and support,
// the mail sheet and the feature-request board.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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

// Pulling Profile & Login past its top exposes the screen's own background. Instead of guessing colors, read the
// REAL top row of the rendered header image (same cover-crop the <img> uses on this screen size) and paint
// that as a horizontal gradient, so the pulled-down area continues the header with no visible seam.
function _plSyncPullColor() {
  const scr = document.getElementById('screen-settings-profile-login');
  const img = scr && scr.querySelector('.pl-hero-bg');
  const hero = scr && scr.querySelector('.pl-hero');
  if (!img || !hero || !img.complete || !img.naturalWidth) return;
  const r = hero.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const scale = Math.max(r.width / nw, r.height / nh);
  const srcH = Math.max(1, 3 / scale);
  const srcY = Math.max(0, (nh - r.height / scale) / 2);
  const srcW = Math.min(nw, r.width / scale);
  const srcX = (nw - srcW) / 2;
  const N = 24;
  try {
    const cv = document.createElement('canvas');
    cv.width = N; cv.height = 1;
    const cx = cv.getContext('2d');
    cx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, N, 1);
    const d = cx.getImageData(0, 0, N, 1).data;
    const stops = [];
    for (let i = 0; i < N; i++) stops.push('rgb(' + d[i*4] + ',' + d[i*4+1] + ',' + d[i*4+2] + ') ' + Math.round(i / (N - 1) * 100) + '%');
    scr.style.backgroundImage = 'linear-gradient(to bottom, transparent 88%, var(--bg) 88%), linear-gradient(90deg, ' + stops.join(',') + ')';
  } catch (e) { /* keep the CSS fallback colors */ }
}
// Easter egg: the mascot hangs above the top of the phone and is lowered in step with how far the content is
// pulled down, then rises back as it settles. Pull = how far the header has moved below the top of the screen.
const PL_MASCOT = { startPull: 300, ratio: 0.9, hidden: -140, maxY: 120, ease: 0.16 };
let _plMascotY = PL_MASCOT.hidden, _plMascotRunning = false;
function _plMascotStart() {
  if (_plMascotRunning) return;
  _plMascotRunning = true;
  requestAnimationFrame(_plMascotTick);
}
function _plMascotTick() {
  const scr = document.getElementById('screen-settings-profile-login');
  const el = document.getElementById('pl-mascot-peek');
  const hero = scr && scr.querySelector('.pl-hero');
  if (!scr || !el || !hero || !scr.classList.contains('active')) {
    if (el) el.style.transform = 'translateY(' + PL_MASCOT.hidden + 'px)';
    _plMascotY = PL_MASCOT.hidden; _plMascotRunning = false; return;
  }
  const pull = Math.max(0, _rectA(hero).top);
  const target = pull <= PL_MASCOT.startPull
    ? PL_MASCOT.hidden
    : Math.min(PL_MASCOT.maxY, PL_MASCOT.hidden + (pull - PL_MASCOT.startPull) * PL_MASCOT.ratio);
  _plMascotY += (target - _plMascotY) * PL_MASCOT.ease;
  if (Math.abs(target - _plMascotY) < 0.3) _plMascotY = target;
  el.style.transform = 'translateY(' + _plMascotY.toFixed(1) + 'px)';
  requestAnimationFrame(_plMascotTick);
}
(function () {
  const start = () => {
    const scr = document.getElementById('screen-settings-profile-login');
    if (!scr) return;
    const img = scr.querySelector('.pl-hero-bg');
    if (img) img.addEventListener('load', _plSyncPullColor);
    window.addEventListener('resize', _plSyncPullColor);
    new MutationObserver(() => {
      if (scr.classList.contains('active')) { _plSyncPullColor(); setTimeout(_plSyncPullColor, 400); _plMascotStart(); }
    }).observe(scr, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

function openSettingsProfileLogin() {
  _plRenderAvatar();
  const nameInput = document.getElementById('pl-display-name-input');
  if (nameInput) nameInput.value = getDisplayName();
  _plRenderSigninMethods();
  pushScreen('settings-profile-login');
}

// ---- Avatar (photo + initial fallback) ----
function _plRenderAvatar() {
  const placeholderEl = document.getElementById('pl-avatar');
  const photo = localStorage.getItem('zelo_profile_photo');
  const img = document.getElementById('pl-avatar-photo');
  if (img) { img.src = photo || ''; img.hidden = !photo; }
  if (placeholderEl) placeholderEl.hidden = !!photo;
  const removeBtn = document.getElementById('pl-avatar-remove');
  if (removeBtn) removeBtn.hidden = !photo;
  const sub = document.getElementById('pl-avatar-sub');
  if (sub) sub.textContent = photo ? 'Tap to change your photo' : 'Tap to add a photo';
  _refreshProfilePhotoEverywhere();
}

// Every place the user's photo shows, updated together: the 3 tab-header profile buttons (the actual
// first thing anyone sees, before ever opening the dashboard — was a static generic icon, never wired
// to the real photo at all) + the Account tab's own dashboard card. Called from _plRenderAvatar() (so
// every set/remove already covers this) and once on app init for a returning user who set a photo in
// an earlier session.
// Deliberately NOT the 3 tab-header profile buttons (tried that, reverted per the user: the photo
// should only show on the dashboard's own "Player #.../Zelo member" card — the header stays the
// plain generic icon). .profile-btn-photo/.profile-btn-icon still exist in the markup/CSS from that
// attempt but are simply never toggled now.
function _refreshProfilePhotoEverywhere() {
  const photo = localStorage.getItem('zelo_profile_photo');
  const dashImg = document.getElementById('dash-avatar-photo');
  const dashInitial = document.getElementById('dash-avatar');
  if (dashImg) { dashImg.src = photo || ''; dashImg.hidden = !photo; }
  if (dashInitial) dashInitial.hidden = !!photo;
}
_refreshProfilePhotoEverywhere();   // picks up a photo set in an earlier session, before the dashboard/PL screen is ever opened

function plPickPhoto() { document.getElementById('pl-photo-input')?.click(); }
function plRemovePhoto() {
  localStorage.removeItem('zelo_profile_photo');
  _plRenderAvatar();
}

// ---- Crop/reposition sheet: picking a photo never writes it directly — it loads into this sheet
// first, and only plCropConfirm() ever touches zelo_profile_photo. Drag to pan, slider to zoom; the
// image is always kept scaled to fully cover the circular stage (same "cover" rule object-fit:cover
// would give you, just with the user controlling WHERE within that cover window the crop sits). ----
const _plCrop = { natW: 0, natH: 0, minScale: 1, scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 };
const PL_CROP_STAGE = 280, PL_CROP_OUT = 320;

function plPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => _plOpenCrop(reader.result);
  reader.readAsDataURL(file);
}

function _plOpenCrop(dataUrl) {
  const img = document.getElementById('pl-crop-img');
  img.onload = () => {
    _plCrop.natW = img.naturalWidth; _plCrop.natH = img.naturalHeight;
    _plCrop.minScale = PL_CROP_STAGE / Math.min(_plCrop.natW, _plCrop.natH);
    _plCrop.scale = _plCrop.minScale;
    _plCrop.x = (PL_CROP_STAGE - _plCrop.natW * _plCrop.scale) / 2;
    _plCrop.y = (PL_CROP_STAGE - _plCrop.natH * _plCrop.scale) / 2;
    document.getElementById('pl-crop-zoom').value = '1';
    _plApplyCropTransform();
    document.getElementById('pl-crop-overlay').hidden = false;
  };
  img.src = dataUrl;
}

function _plClampCrop() {
  const w = _plCrop.natW * _plCrop.scale, h = _plCrop.natH * _plCrop.scale;
  _plCrop.x = Math.min(0, Math.max(PL_CROP_STAGE - w, _plCrop.x));
  _plCrop.y = Math.min(0, Math.max(PL_CROP_STAGE - h, _plCrop.y));
}
function _plApplyCropTransform() {
  _plClampCrop();
  const img = document.getElementById('pl-crop-img');
  img.style.transform = `translate(${_plCrop.x}px, ${_plCrop.y}px) scale(${_plCrop.scale})`;
}

function plCropZoom(sliderVal) {
  const newScale = _plCrop.minScale * Number(sliderVal);
  // Zoom around the stage's own center, not the image's top-left corner, so zooming in/out feels
  // anchored to what's actually visible rather than yanking the image toward a corner.
  const cx = PL_CROP_STAGE / 2, cy = PL_CROP_STAGE / 2;
  const ratio = newScale / _plCrop.scale;
  _plCrop.x = cx - (cx - _plCrop.x) * ratio;
  _plCrop.y = cy - (cy - _plCrop.y) * ratio;
  _plCrop.scale = newScale;
  _plApplyCropTransform();
}

function _plCropPointerDown(clientX, clientY) {
  _plCrop.dragging = true; _plCrop.startX = clientX; _plCrop.startY = clientY;
  _plCrop.baseX = _plCrop.x; _plCrop.baseY = _plCrop.y;
}
function _plCropPointerMove(clientX, clientY) {
  if (!_plCrop.dragging) return;
  _plCrop.x = _plCrop.baseX + (clientX - _plCrop.startX);
  _plCrop.y = _plCrop.baseY + (clientY - _plCrop.startY);
  _plApplyCropTransform();
}
function _plCropPointerUp() { _plCrop.dragging = false; }

function _plInitCropDrag() {
  const stage = document.getElementById('pl-crop-stage');
  if (!stage || stage.dataset.bound) return;
  stage.dataset.bound = '1';
  stage.addEventListener('touchstart', e => { const t = e.touches[0]; _plCropPointerDown(t.clientX, t.clientY); }, { passive: true });
  stage.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; _plCropPointerMove(t.clientX, t.clientY); }, { passive: false });
  stage.addEventListener('touchend', _plCropPointerUp);
  stage.addEventListener('mousedown', e => _plCropPointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => _plCropPointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', _plCropPointerUp);
}

function plCropCancel() {
  document.getElementById('pl-crop-overlay').hidden = true;
}
function plCropConfirm() {
  const img = document.getElementById('pl-crop-img');
  const canvas = document.createElement('canvas');
  canvas.width = PL_CROP_OUT; canvas.height = PL_CROP_OUT;
  const ctx = canvas.getContext('2d');
  const ratio = PL_CROP_OUT / PL_CROP_STAGE;
  ctx.scale(ratio, ratio);
  ctx.drawImage(img, _plCrop.x, _plCrop.y, _plCrop.natW * _plCrop.scale, _plCrop.natH * _plCrop.scale);
  localStorage.setItem('zelo_profile_photo', canvas.toDataURL('image/jpeg', 0.9));
  document.getElementById('pl-crop-overlay').hidden = true;
  _plRenderAvatar();
}
_plInitCropDrag();

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

// ---- Forgot password ------------------------------------------------------
// Sends a 6-digit code (not a link: a link opens Safari and cannot set a
// password inside the app). Goes through the SAME entry point as the sign-in
// sheet, AUTH.startPasswordReset(), which opens the code screen at once and
// sends the email in the background — so this handler does not wait on the
// network and cannot be tapped twice into two emails.
function plOpenForgotPassword() {
  const input = document.getElementById('pl-forgot-email');
  if (input) input.value = AUTH.currentEmail();
  const err = document.getElementById('pl-forgot-error');
  if (err) err.textContent = '';
  pushScreen('settings-forgot-password');
}

function plSendPasswordReset() {
  const err = document.getElementById('pl-forgot-error');
  if (err) err.textContent = '';
  const r = AUTH.startPasswordReset(document.getElementById('pl-forgot-email')?.value, 'settings');
  if (r.error && err) err.textContent = r.error;
}

// "Back to settings" always returns to Profile & Login specifically,
// regardless of how deep the stack is — unlike each screen's own back arrow
// (plain popScreen()), which just steps back one level at a time. Also called
// by the password-reset overlay once the new password is saved.
function _plBackToProfileLogin() {
  let guard = 0;
  while (state.activeScreen !== 'settings-profile-login' && state.screenStack.length && guard < 5) {
    popScreen();
    guard++;
  }
}

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
// The Profile & Login code boxes use the same implementation as sign-up and
// password reset (AUTH.bindCodeRow) — it used to be a second, separate copy.
function _plBindCodeRow(rowId) {
  if (_plBoundCodeRows.has(rowId)) return;
  _plBoundCodeRows.add(rowId);
  AUTH.bindCodeRow(rowId);
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
  const previous = localStorage.getItem('zelo_history_retention_days') || DEFAULT_RETENTION_DAYS;
  const doomed = retentionDeleteCount(value);
  const apply = () => {
    document.querySelectorAll('#settings2-retention-list .settings2-radio-row').forEach(row => row.classList.remove('selected'));
    el.classList.add('selected');
    onRetentionChange(value);
  };
  // Shortening the window deletes history immediately and permanently, so it
  // gets the same confirmation as any other destructive action in the app.
  if (doomed > 0) {
    showDeleteConfirm(
      `This will delete ${doomed} saved scan${doomed === 1 ? '' : 's'} older than this. It can't be undone.`,
      apply
    );
    // Leave the radio where it was unless/until they confirm.
    document.querySelectorAll('#settings2-retention-list .settings2-radio-row').forEach(row => {
      row.classList.toggle('selected', row.dataset.days === previous);
    });
    return;
  }
  apply();
}

// ---- Zelo Pro ----
function restoreSettingsPurchases() {
  ZeloAnalytics.track('restore_purchase_tapped');
  // Truthful either way: with no purchase system there is genuinely nothing to
  // restore, and once StoreKit lands this is where its restore result lands.
  const ent = getEntitlement();
  _settingsToast(ent.active ? 'Your subscription has been restored.' : 'No purchases found to restore.');
}

// Same action from the paywall/offer screens' "Restore" link, which Apple
// expects to be present and working on a subscription screen. Uses the toast
// rather than the settings modal so it works over those full-screen layouts.
function restorePurchasesFromPaywall() {
  ZeloAnalytics.track('restore_purchase_tapped');
  const ent = getEntitlement();
  flashLimitToast(ent.active ? 'Your subscription has been restored.' : 'No purchases found to restore.');
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

// ── Support (Report a problem / Contact support) ────────────────────────────
// The in-app sheet (saves straight to Supabase `support_messages`, services/support.js) is the PRIMARY
// and only reliable path — every report is guaranteed captured regardless of the user's device.
// Native Mail (MainViewController.swift, webkit.messageHandlers.zeloMail) is offered as an OPTIONAL
// secondary action inside the sheet ("Open in Mail instead"), never the entry point.
//
// Why native Mail can't be the primary/gating path: MFMailComposeViewController.canSendMail() only
// checks that SOME Mail account exists on the device — it does not verify that account can actually
// send. And once the user taps Send, iOS reports .sent the moment the message is QUEUED, not once
// delivery is confirmed — if the account's SMTP auth is broken (a real, fairly common failure, found
// by testing this exact build), Apple's Mail app handles that error entirely on its own, with zero
// visibility given to any third-party app. A user hitting that would see our "Message sent" toast and
// believe it worked, while their report silently vanished forever with no signal to them or to us.
// Routing it through native Mail first (2026-10-19l) was the wrong call for that reason; this undoes it.
const SUPPORT_EMAIL = 'support@zelofficial.com';
const MAIL_KINDS = {
  problem: { title: 'Report a Problem', subject: 'Report a problem', file: 'zelo-problem-log.txt', placeholder: '' },
  contact: { title: 'Contact Support',  subject: 'Contact support',  file: 'zelo-contact-log.txt', placeholder: '' },
};
// Opens the REAL native Mail compose sheet pre-filled with whatever the user has already typed in our
// own sheet, as an OPTIONAL extra — our sheet's own Send button is still the one guaranteed to reach us.
function mailOpenNative() {
  const handlers = window.webkit && window.webkit.messageHandlers;
  if (!handlers || !handlers.zeloMail) { showChatToast("Mail isn't available on this device."); return; }
  const k = _mail.kind, cfg = MAIL_KINDS[k] || MAIL_KINDS.contact;
  const t = document.getElementById('mail-text');
  try { ZeloAnalytics.track('support_sent', { kind: k, result: 'native_opened' }); } catch (e) {}
  handlers.zeloMail.postMessage({
    to: SUPPORT_EMAIL, subject: cfg.subject, body: t ? t.value : '',
    attachmentName: cfg.file, attachmentText: ZeloSupport.buildDiagnostics(k),
  });
}
window._zeloMailUnavailable = () => showChatToast("No Mail account is set up on this device.");
// Native Mail's .sent only means "queued", not confirmed delivered (see note above) — so this is just a
// courtesy toast, never anything Supabase-side; our sheet's own Send already did the reliable part.
window._zeloMailResult = (outcome) => {
  if (outcome === 'sent') showChatToast('Opened in Mail — send it from there whenever you like.');
};
const _mail = { kind: 'contact', sending: false, drafts: {} };
let _mailHideTimer = null;
function openSupport(kind) {
  const k = MAIL_KINDS[kind] ? kind : 'contact', cfg = MAIL_KINDS[k], sheet = document.getElementById('mail-sheet');
  if (!sheet) return;
  _mail.kind = k; _mail.sending = false;
  document.getElementById('mail-title').textContent = cfg.title;
  document.getElementById('mail-subject').textContent = cfg.subject;
  document.getElementById('mail-file').textContent = cfg.file;
  document.getElementById('mail-size').textContent = (ZeloSupport.buildDiagnostics(k).length / 1024).toFixed(1) + ' KB';
  document.getElementById('mail-text').value = '';
  const err = document.getElementById('mail-error'); err.hidden = true;
  mailInput();
  clearTimeout(_mailHideTimer);
  sheet.hidden = false;
  sheet.classList.remove('chat-settings-sheet--in'); void sheet.offsetWidth;
  requestAnimationFrame(() => sheet.classList.add('chat-settings-sheet--in'));
  setTimeout(() => { const t = document.getElementById('mail-text'); if (t && !sheet.hidden) t.focus(); }, 380);   // like a compose sheet: the keyboard is already up
}
function mailInput() {
  const t = document.getElementById('mail-text'), b = document.getElementById('mail-send');
  if (b && !_mail.sending) b.disabled = (t ? t.value.trim().length : 0) < 3;
}
function _mailClose() {
  const sheet = document.getElementById('mail-sheet');
  if (!sheet || sheet.hidden) return;
  const t = document.getElementById('mail-text'); if (t) t.blur();
  sheet.classList.remove('chat-settings-sheet--in');
  clearTimeout(_mailHideTimer);
  _mailHideTimer = setTimeout(() => { sheet.hidden = true; }, 320);
}
function mailCancel() {
  if (_mail.sending) return;
  const t = document.getElementById('mail-text');
  if (t && t.value.trim().length) { _showChatConfirm('Discard this message?', "What you've written won't be sent.", 'Discard', _mailClose); return; }
  _mailClose();
}
async function mailSend() {
  const t = document.getElementById('mail-text'), btn = document.getElementById('mail-send'), err = document.getElementById('mail-error');
  const msg = t ? t.value.trim() : '';
  if (msg.length < 3 || _mail.sending) return;
  _mail.sending = true; btn.disabled = true; btn.classList.add('mail-send--busy'); err.hidden = true;
  const kind = _mail.kind;
  const result = await ZeloSupport.sendSupport(kind, msg);
  _mail.sending = false; btn.classList.remove('mail-send--busy');
  try { ZeloAnalytics.track('support_sent', { kind, result }); } catch (e) {}
  if (result === 'limit') {
    err.textContent = "You've sent a lot of messages today. Please try again tomorrow."; err.hidden = false; mailInput();
    return;
  }
  _mailClose();
  setTimeout(() => {
    if (result === 'queued') showCopyToast("We'll send it as soon as you're signed in and online.", 'Saved on your phone');
    else showCopyToast("We read every message, but we can't reply to each one.", kind === 'problem' ? 'Report sent' : 'Message sent');
  }, 250);
}

// ── Feature requests (board + new request) ─────────────────────────────────
// Rows come from `list_feature_requests()` (services/support.js); the title/body are checked by a
// database trigger before a request is shown to anyone else. Voting is optimistic and settles to
// the server's count.
const FR = { sort: 'top', q: '', gen: 0, items: [], timer: null, voting: new Set(), detail: null, comments: [], editing: null };
// ── AI review (edge function moderate-feature-text) ──
// A new post, edit or comment that passed the free checks is 'pending' until Gemini says ok/hold. The app asks for the
// review right after saving; if that fails (offline, function not deployed, Gemini busy) the database makes the item
// visible to everyone after 3 minutes, and the next time the board or page loads we ask again.
FR.modAsked = new Map();                                              // kind+id -> when we last asked (retry after 30 s, never more often)
async function _frModerate(kind, id) {
  if (!id) return;
  FR.modAsked.set(kind + id, Date.now());
  const r = await ZeloSupport.moderate(kind, id);
  if (!r.status || r.status === 'pending') return;
  if (kind === 'request') {
    const it = FR.items.find(x => String(x.id) === String(id)); if (it) it.status = r.status;
    if (FR.detail && String(FR.detail.id) === String(id)) { FR.detail.status = r.status; _frdRenderCard(); }
    if (state.activeScreen === 'settings-feature-requests') frLoad(false);
    if (r.status === 'held') showNotice('Under review', 'Your post was held for review. Only you can see it for now.');
    else if (r.status === 'live') showNotice('Your post is live', 'Everyone can see and vote on it now.');
  } else if (FR.detail) {
    const com = await ZeloSupport.listComments(FR.detail.id);
    if (com.items && state.activeScreen === 'settings-feature-detail') _frdRenderComments(com.items, false);
    if (r.status === 'held') showNotice('Under review', 'Your comment was held for review. Only you can see it for now.');
  }
}
function _frRetryPending(items, kind) {
  (items || []).forEach(it => {
    const last = FR.modAsked.get(kind + it.id) || 0;
    if (it.is_mine && it.status === 'pending' && Date.now() - last > 30000) _frModerate(kind, it.id);
  });
}
function openFeatureRequests() {
  const go = () => { pushScreen('settings-feature-requests'); frLoad(true); };
  if (typeof AUTH !== 'undefined' && AUTH.signedIn && !AUTH.signedIn()) { AUTH.requireAuth('feature-requests', go); return; }
  go();
}
function _frCount(n) {
  n = Number(n) || 0;
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
  return String(n);
}
function _frDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
}
const _FR_BUBBLE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z"/></svg>';
const _FR_CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 15 12 9 18 15"/></svg>';
function _frCardHTML(it) {
  const who = it.is_mine ? 'You' : 'Member ' + _escapeHtml(it.author_tag || '');
  const badge = it.status === 'held' ? '<span class="fr-badge">Under review</span>' : (it.status === 'pending' && it.is_mine ? '<span class="fr-badge">Checking…</span>' : '');
  const body = it.body ? '<p class="fr-card-body">' + _escapeHtml(it.body) + '</p>' : '';
  return '<article class="fr-card" data-id="' + _escapeHtml(it.id) + '">' +
    '<div class="fr-card-main"><h3 class="fr-card-title">' + _escapeHtml(it.title) + '</h3>' + body +
    '<div class="fr-card-meta"><span>' + who + '</span><span class="fr-cmt">' + _FR_BUBBLE + (Number(it.comment_count) || 0) + '</span><span>' + _frDate(it.created_at) + '</span>' + badge + '</div></div>' +
    '<button type="button" class="fr-vote' + (it.i_voted ? ' voted' : '') + '" aria-pressed="' + (it.i_voted ? 'true' : 'false') + '" aria-label="Vote">' +
    _FR_CHEVRON + '<span>' + _frCount(it.vote_count) + '</span></button></article>';
}
function _frState(title, text, btnLabel) {
  return '<div class="fr-state"><b>' + title + '</b>' + text + (btnLabel ? '<br><button type="button" onclick="frLoad(true)">' + btnLabel + '</button>' : '') + '</div>';
}
async function frLoad(showSkeleton) {
  const list = document.getElementById('fr-list'); if (!list) return;
  const gen = ++FR.gen;
  if (showSkeleton && !FR.items.length) list.innerHTML = '<div class="fr-skel"></div><div class="fr-skel"></div><div class="fr-skel"></div>';
  const r = await ZeloSupport.listRequests(FR.sort, FR.q);
  if (gen !== FR.gen) return;                                       // a newer load (typing, sort change) replaced this one
  if (r.error) {
    FR.items = [];
    const msg = r.error === 'net' ? ['No connection', 'Check your internet and try again.']
      : r.error === 'signed_out' ? ['Sign in to see requests', 'Requests are shared between Zelo users, so you need to be signed in.']
      : r.error === 'unavailable' ? ['Not available yet', 'The request board is not ready. Please try again later.']
      : ['Something went wrong', "We couldn't load the requests."];
    list.innerHTML = _frState(msg[0], msg[1], r.error === 'unavailable' ? '' : 'Try again');
    return;
  }
  FR.items = r.items;
  if (!r.items.length) {
    list.innerHTML = FR.q ? _frState('No matches', 'Nobody has asked for that yet. Be the first.', '')
      : _frState('No requests yet', 'Be the first to tell us what Zelo should do next.', '');
    return;
  }
  list.innerHTML = r.items.map(_frCardHTML).join('');
  _frRetryPending(r.items, 'request');
}
function frSetSort(sort) {
  if (FR.sort === sort) return;
  FR.sort = sort;
  const seg = document.getElementById('fr-seg');
  if (seg) { seg.classList.toggle('fr-seg--new', sort === 'new'); seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sort === sort)); }
  frLoad(false);
}
function frSearchInput() {
  clearTimeout(FR.timer);
  FR.timer = setTimeout(() => { const el = document.getElementById('fr-search'); FR.q = el ? el.value.trim() : ''; frLoad(false); }, 280);
}
function _frFindItem(id) {
  if (FR.detail && String(FR.detail.id) === String(id)) return FR.detail;
  return FR.items.find(x => String(x.id) === String(id));
}
async function frVote(host) {
  const id = host && host.dataset.id; if (!id || FR.voting.has(id)) return;
  const btn = host.querySelector('.fr-vote'), numEl = btn.querySelector('span');
  const was = btn.classList.contains('voted');
  const item = _frFindItem(id);
  const base = item ? Number(item.vote_count) || 0 : 0;
  const apply = (voted, count) => {
    btn.classList.toggle('voted', voted); btn.setAttribute('aria-pressed', String(voted)); numEl.textContent = _frCount(count);
    const lbl = host.querySelector('.fr-votes-label'); if (lbl) lbl.textContent = count + (count === 1 ? ' vote' : ' votes');
    [FR.detail].concat(FR.items).forEach(x => { if (x && String(x.id) === String(id)) { x.i_voted = voted; x.vote_count = count; } });
  };
  FR.voting.add(id);
  apply(!was, Math.max(0, base + (was ? -1 : 1)));
  btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  try { navigator.vibrate && navigator.vibrate(6); _cineHaptic('LIGHT'); } catch (e) {}
  const r = await ZeloSupport.toggleVote(id);
  FR.voting.delete(id);
  if (r.error) { apply(was, base); showNotice("Couldn't save your vote", 'Check your connection and try again.'); return; }
  apply(r.voted, r.count);
}
document.addEventListener('click', (e) => {
  const card = e.target.closest && e.target.closest('#fr-list .fr-card');
  if (card) { if (e.target.closest('.fr-vote')) frVote(card); else openFeatureDetail(card.dataset.id); return; }
  const dv = e.target.closest && e.target.closest('#frd-card .fr-vote');
  if (dv) frVote(document.getElementById('frd-card'));
});

// ── One request: the post, its comments, edit / delete for your own ──
function _frAvatar(isMine) { return '<span class="fr-avatar' + (isMine ? ' fr-avatar--me' : '') + '" aria-hidden="true">' + (isMine ? 'Y' : 'M') + '</span>'; }
function _frWho(it) { return it.is_mine ? 'You' : 'Member ' + _escapeHtml(it.author_tag || ''); }
function _frdRenderCard() {
  const it = FR.detail, card = document.getElementById('frd-card'); if (!it || !card) return;
  card.dataset.id = it.id;
  const votes = Number(it.vote_count) || 0;
  const own = it.is_mine ? '<div class="fr-own-actions"><button type="button" onclick="frEdit()">Edit</button><button type="button" class="danger" onclick="frDelete()">Delete</button></div>' : '';
  card.innerHTML =
    '<div class="fr-author">' + _frAvatar(it.is_mine) + '<div class="fr-author-text"><b>' + _frWho(it) + '</b><span>' + _frDate(it.created_at) + (it.edited_at ? ' · edited' : '') + '</span></div></div>' +
    '<h2 class="fr-detail-title">' + _escapeHtml(it.title) + '</h2>' +
    (it.body ? '<p class="fr-detail-body">' + _escapeHtml(it.body) + '</p>' : '') +
    (it.status === 'held' ? '<div><span class="fr-badge">Under review. Only you can see this for now.</span></div>' : (it.status === 'pending' && it.is_mine ? '<div><span class="fr-badge">Checking your post…</span></div>' : '')) +
    '<div class="fr-detail-actions"><button type="button" class="fr-vote' + (it.i_voted ? ' voted' : '') + '" aria-pressed="' + (it.i_voted ? 'true' : 'false') + '" aria-label="Vote">' + _FR_CHEVRON + '<span>' + _frCount(votes) + '</span></button>' +
    '<span class="fr-votes-label">' + votes + (votes === 1 ? ' vote' : ' votes') + '</span>' + own + '</div>';
}
function _frdCommentHTML(c) {
  const held = c.status === 'held' ? ' <span class="fr-badge">Under review</span>' : (c.status === 'pending' && c.is_mine ? ' <span class="fr-badge">Checking…</span>' : '');
  const del = c.is_mine ? '<button type="button" class="fr-comment-del" data-del="' + _escapeHtml(c.id) + '">Delete</button>' : '';
  return '<div class="fr-comment" data-cid="' + _escapeHtml(c.id) + '">' + _frAvatar(c.is_mine) +
    '<div class="fr-comment-main"><div class="fr-comment-head"><b>' + _frWho(c) + '</b><span>' + _frDate(c.created_at) + '</span>' + held + '</div>' +
    '<p class="fr-comment-text">' + _escapeHtml(c.body) + '</p>' + del + '</div></div>';
}
function _frdRenderComments(items, isNew) {
  FR.comments = items;
  const list = document.getElementById('frd-comments'), label = document.getElementById('frd-count');
  const live = items.filter(c => c.status === 'live').length;
  list.innerHTML = items.length ? items.map(_frdCommentHTML).join('') : '';
  label.textContent = !items.length ? 'No comments yet. Start the conversation below.' : (live === 1 ? '1 comment' : live + ' comments');
  if (isNew) { const last = list.lastElementChild; if (last) { last.classList.add('new'); last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
}
async function openFeatureDetail(id) {
  const base = FR.items.find(x => String(x.id) === String(id));
  if (!base) return;
  FR.detail = Object.assign({}, base); FR.comments = [];
  const input = document.getElementById('frd-input'); if (input) input.value = '';
  frdInput();
  _frdRenderCard(); _frdRenderComments([], false);
  document.getElementById('frd-count').textContent = 'Loading comments…';
  pushScreen('settings-feature-detail');
  const [req, com] = await Promise.all([ZeloSupport.getRequest(id), ZeloSupport.listComments(id)]);
  if (!FR.detail || String(FR.detail.id) !== String(id)) return;       // left, or opened another one meanwhile
  if (req.item === null) { showNotice('Request not available', 'It may have been removed.'); frDetailBack(); return; }
  if (req.item) { FR.detail = req.item; _frdRenderCard(); }
  if (com.items) { _frdRenderComments(com.items, false); _frRetryPending(com.items, 'comment'); }
  else document.getElementById('frd-count').textContent = com.error === 'net' ? "No connection. Comments couldn't load." : "Comments couldn't load.";
}
function frDetailBack() {
  FR.detail = null;
  const input = document.getElementById('frd-input'); if (input) input.blur();
  popScreen();
  frLoad(false);                                                        // counts and votes may have changed
}
function frdInput() {
  const i = document.getElementById('frd-input'), b = document.getElementById('frd-send');
  if (i && b && !b.dataset.busy) b.disabled = i.value.trim().length < 1;
}
async function frdSendComment() {
  const i = document.getElementById('frd-input'), b = document.getElementById('frd-send');
  const text = i ? i.value.trim() : ''; if (!text || !FR.detail || b.dataset.busy) return;
  const bad = ZeloTextGuard.check(text);
  if (bad) { showNotice("Can't post that", ZeloTextGuard.MESSAGES[bad]); return; }
  b.dataset.busy = '1'; b.disabled = true;
  const r = await ZeloSupport.addComment(FR.detail.id, text);
  delete b.dataset.busy;
  if (r.error || !r.item) {
    const msg = { daily_limit: "You've posted a lot of comments today. Try again tomorrow.", net: 'Check your connection and try again.', signed_out: 'Please sign in to comment.', not_found: 'This request is no longer available.', inappropriate: ZeloTextGuard.MESSAGES.rude, has_link: ZeloTextGuard.MESSAGES.link }[r.error] || 'Please try again.';
    showNotice("Couldn't post your comment", msg); frdInput(); return;
  }
  i.value = ''; frdInput();
  if (r.item.status === 'live') FR.detail.comment_count = (Number(FR.detail.comment_count) || 0) + 1;
  _frdRenderComments((FR.comments || []).concat([r.item]), true);
  if (r.item.status === 'held') showNotice('Thanks for commenting', 'Your comment will be under review before others see it.');
  else if (r.item.status === 'pending') _frModerate('comment', r.item.id);
}
document.addEventListener('click', (e) => {
  const del = e.target.closest && e.target.closest('#frd-comments .fr-comment-del'); if (!del) return;
  const id = del.dataset.del;
  _showChatConfirm('Delete this comment?', "It will be removed for everyone. This can't be undone.", 'Delete', async () => {
    const r = await ZeloSupport.deleteComment(id);
    if (r.error) { showNotice("Couldn't delete", 'Check your connection and try again.'); return; }
    const was = (FR.comments || []).find(c => String(c.id) === String(id));
    if (was && was.status === 'live' && FR.detail) FR.detail.comment_count = Math.max(0, (Number(FR.detail.comment_count) || 0) - 1);
    _frdRenderComments((FR.comments || []).filter(c => String(c.id) !== String(id)), false);
  });
});
function frEdit() {
  const it = FR.detail; if (!it || !it.is_mine) return;
  FR.editing = it.id; FR.formMode = 'edit';
  const t = document.getElementById('fr-new-title'), b = document.getElementById('fr-new-body');
  t.value = it.title; b.value = it.body || ''; delete t.dataset.sent; delete b.dataset.sent;
  document.getElementById('fr-new-heading').textContent = 'Edit request';
  document.getElementById('fr-new-send').textContent = 'Save changes';
  document.getElementById('fr-new-note').textContent = 'Changes are checked again before they show to others.';
  document.getElementById('fr-new-error').hidden = true;
  frNewInput();
  pushScreen('settings-feature-new');
}
function frDelete() {
  const it = FR.detail; if (!it || !it.is_mine) return;
  _showChatConfirm('Delete this request?', "It will be removed for everyone, along with its votes and comments. This can't be undone.", 'Delete', async () => {
    const r = await ZeloSupport.deleteRequest(it.id);
    if (r.error) { showNotice("Couldn't delete", 'Check your connection and try again.'); return; }
    FR.items = FR.items.filter(x => String(x.id) !== String(it.id));
    showNotice('Request deleted', 'It has been removed from the board.');
    frDetailBack();
  });
}

function openFeatureNew() {
  const wasEdit = FR.formMode === 'edit';                                // the form still holds an edit's text
  FR.editing = null; FR.formMode = 'new';
  ['fr-new-title', 'fr-new-body'].forEach(id => { const el = document.getElementById(id); if (el && (el.dataset.sent || wasEdit)) { el.value = ''; delete el.dataset.sent; } });
  document.getElementById('fr-new-heading').textContent = 'New request';
  document.getElementById('fr-new-send').textContent = 'Submit request';
  document.getElementById('fr-new-note').textContent = 'Search first in case someone already asked. Requests are checked automatically before they go live.';
  const err = document.getElementById('fr-new-error'); if (err) err.hidden = true;
  frNewInput();
  pushScreen('settings-feature-new');
}
function frNewInput() {
  const t = document.getElementById('fr-new-title'), b = document.getElementById('fr-new-body'), btn = document.getElementById('fr-new-send');
  if (!t || !b) return;
  document.getElementById('fr-new-title-n').textContent = String(t.value.length);
  document.getElementById('fr-new-body-n').textContent = String(b.value.length);
  if (btn && !btn.dataset.busy) btn.disabled = t.value.trim().length < 8;
}
async function frSubmitNew() {
  const t = document.getElementById('fr-new-title'), b = document.getElementById('fr-new-body'), btn = document.getElementById('fr-new-send'), err = document.getElementById('fr-new-error');
  if (!t || !btn || btn.dataset.busy || t.value.trim().length < 8) return;
  const bad = ZeloTextGuard.check(t.value) || ZeloTextGuard.check(b.value);
  if (bad) { err.textContent = ZeloTextGuard.MESSAGES[bad]; err.hidden = false; return; }
  const editing = FR.editing;
  btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = editing ? 'Saving…' : 'Submitting…';
  t.blur(); b.blur(); err.hidden = true;
  const r = editing ? await ZeloSupport.updateRequest(editing, t.value, b.value) : await ZeloSupport.submitRequest(t.value, b.value);
  delete btn.dataset.busy; btn.textContent = editing ? 'Save changes' : 'Submit request';
  if (r.error) {
    const text = { duplicate: 'Someone already asked for this. Search the list and give it a vote instead.',
      daily_limit: "You've added a few requests today. Please try again tomorrow.",
      net: 'No connection. Check your internet and try again.',
      signed_out: 'Please sign in to add a request.',
      invalid: 'Please give your request a title of at least 8 characters.',
      not_found: 'This request is no longer available.',
      inappropriate: ZeloTextGuard.MESSAGES.rude,
      has_link: ZeloTextGuard.MESSAGES.link,
      unavailable: 'Requests are not available yet. Please try again later.' }[r.error] || "Something went wrong. Please try again.";
    err.textContent = text; err.hidden = false; btn.disabled = false;
    return;
  }
  if (editing) {                                                         // back to the request page with the new text
    FR.editing = null;
    popScreen();
    const fresh = await ZeloSupport.getRequest(editing);
    if (fresh.item && FR.detail && String(FR.detail.id) === String(editing)) { FR.detail = fresh.item; _frdRenderCard(); }
    showNotice('Changes saved', 'Your edit will be checked again before others see it.');
    if (r.status === 'pending') _frModerate('request', editing);
    return;
  }
  t.dataset.sent = '1'; b.dataset.sent = '1';
  try { ZeloAnalytics.track('feature_requested', { held: r.status === 'held' }); } catch (e) {}
  popScreen();
  FR.sort = 'new'; FR.q = '';
  const seg = document.getElementById('fr-seg');
  if (seg) { seg.classList.add('fr-seg--new'); seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.sort === 'new')); }
  const se = document.getElementById('fr-search'); if (se) se.value = '';
  frLoad(false);
  showNotice('Thanks for submitting the feature request', 'Your post will be under review before it goes live.');
  if (r.status === 'pending') _frModerate('request', r.id);
}

// The keyboard doesn't resize the page (Keyboard.resize is "none"), so these screens pad their
// bottom by the keyboard height and keep the focused field in view.
function _syncSupportKeyboard() {
  const kb = window.__zeloKbH || 0;
  document.querySelectorAll('#screen-settings-feature-new .fr-layout, #screen-settings-feature-requests .fr-layout')
    .forEach(el => { el.style.paddingBottom = kb ? (kb + 24) + 'px' : ''; });
  const comp = document.getElementById('frd-composer'); if (comp) { comp.style.transform = kb ? 'translateY(' + (-kb) + 'px)' : ''; comp.classList.toggle('fr-composer--kb', !!kb); }
  const dl = document.querySelector('#screen-settings-feature-detail .fr-layout'); if (dl) dl.style.paddingBottom = kb ? (kb + 72) + 'px' : '';
  const a = document.activeElement;
  const mp = document.getElementById('mail-panel'); if (mp) mp.style.paddingBottom = kb ? (kb + 8) + 'px' : '';
  if (kb && a && a.closest && a.closest('#screen-settings-feature-new, #mail-panel')) {
    setTimeout(() => a.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  }
}
window.addEventListener('zelo-kb', _syncSupportKeyboard);
document.addEventListener('focusin', (e) => { if (e.target && e.target.closest && e.target.closest('#mail-panel, #screen-settings-feature-new')) setTimeout(_syncSupportKeyboard, 350); });

// Minimal single-button acknowledgement — reuses the same mini-modal shell
// as showDeleteConfirm() above (see that function) rather than a jarring
// native alert().
function _settingsToast(message) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'mini-modal-overlay';
  overlay.innerHTML = `
    <div class="mini-modal-card">
      <p class="mini-modal-body">${_escapeHtml(message)}</p>
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
  if (listEl) {
    listEl.innerHTML = list.map(_skippedRowHTML).join('');
    listEl.querySelectorAll('.skipped-row-card').forEach((row, i) => {
      const profile = list[i];
      row.querySelector('.skipped-unskip-btn')?.addEventListener('click', () => unskipProfile(profile.id));
      row.querySelector('.skipped-row-menu-btn')?.addEventListener('click', () => confirmDeleteSkippedProfile(profile.id, profile.name));
    });
  }
}

// Matches tab rows reuse the Skipped Profiles card look (.skipped-row-card): boxed
// row, rounded-square gradient photo, name + subtitle, an action pill and a ⋯ menu.
function _matchRowHTML(c) {
  const p = c.profile;
  const grad = `linear-gradient(145deg, ${p.gradientColors[0]}, ${p.gradientColors[1]})`;
  const unread = c.unread ? `<span class="match-row-unread">${_escapeHtml(c.unread)}</span>` : '';
  return `
    <div class="skipped-row-card match-row-card">
      <div class="skipped-row-photo" style="background:${_escapeHtml(grad)}">${_escapeHtml(p.initial)}${_pfpImgHTML(p)}</div>
      <div class="skipped-row-main">
        <span class="skipped-row-name">${_escapeHtml(p.name)}${p.age ? ', ' + _escapeHtml(p.age) : ''}</span>
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
  return `
    <div class="skipped-row-card" data-profile-id="${_escapeHtml(p.id)}">
      <div class="skipped-row-photo" style="background:${_escapeHtml(grad)}">${_escapeHtml(p.initial || (p.name ? p.name[0] : '?'))}${_pfpImgHTML(p)}</div>
      <div class="skipped-row-main">
        <span class="skipped-row-name">${_escapeHtml(p.name)}${p.age ? ', ' + _escapeHtml(p.age) : ''}</span>
        <span class="skipped-row-occ">${_escapeHtml(p.occupation || '')}</span>
      </div>
      <div class="skipped-row-actions">
        <button type="button" class="skipped-unskip-btn">Unskip</button>
        <button type="button" class="skipped-row-menu-btn" aria-label="More options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
        </button>
      </div>
    </div>`;
}

function openSettingsSkippedProfiles() {
  _populateSkippedPanel();
  pushScreen('settings-skipped-profiles');
}

function onRetentionChange(value) {
  localStorage.setItem('zelo_history_retention_days', value);
  pruneExpiredScans();
  _refreshRetentionPreview();
}

function _refreshRetentionPreview() {
  const el = document.getElementById('settings2-retention-preview');
  if (!el) return;
  const pref = localStorage.getItem('zelo_history_retention_days');
  el.textContent = !pref ? '30 days' : pref === 'forever' ? 'Keep forever' : pref + ' days';
}

// GDPR data export — everything the app actually stores for this user, pulled
// from the same sources as the rest of the app (no separate copy). Every
// zelo_* localStorage key is included as well, so the export is genuinely
// "all of it" rather than a curated subset that quietly omits things.
function buildAccountExport() {
  const device = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('zelo_') === 0) device[k] = localStorage.getItem(k);
    }
  } catch (e) { /* storage unavailable — the structured fields below still export */ }
  return {
    exportedAt:  new Date().toISOString(),
    account:     { email: (typeof AUTH !== 'undefined' && AUTH.currentEmail) ? (AUTH.currentEmail() || null) : null },
    displayName: getDisplayName(),
    age:         localStorage.getItem('zelo_user_age'),
    scanCount:   scanCount,
    threads:     getThreads(),
    matches:     chatStore,
    deviceStorage: device
  };
}

// Hands the file to the user. `<a download>` does nothing inside an iOS
// WKWebView, so the native path is the share sheet (Web Share with a File,
// supported in WKWebView), and the anchor is only the plain-web fallback.
// Returns a promise that resolves true only when the file was actually handed
// over, so the UI can report a failure instead of claiming success.
async function exportAccountData() {
  const json = JSON.stringify(buildAccountExport(), null, 2);
  const name = 'zelo-my-data.json';
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'My Zelo data' });
      return true;
    }
  } catch (e) {
    // AbortError = the user dismissed the share sheet. That is a cancel, not a
    // failure, and must not fall through to a second attempt.
    if (e && e.name === 'AbortError') return false;
  }
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) { return false; }
}

// ── Download My Data screen ──────────────────────────────────────
// request -> preparing -> ready + Download. Restored 2026-10-22a with the
// email flow removed: nothing has ever emailed an export, so the screen now
// describes and performs the real on-device export only.
let _ddStep = 'request';
let _ddTimer = null;

function ddShowStep(step) {
  clearTimeout(_ddTimer);
  _ddStep = step;
  const screen = document.getElementById('screen-settings-download-data');
  if (!screen) return;
  screen.querySelectorAll('[data-dd-step]').forEach(el => { el.hidden = el.dataset.ddStep !== step; });
  const err = screen.querySelector('[data-dd-error]');
  if (err) err.hidden = true;
  _revealLazyImages(screen);
  screen.scrollTop = 0;
}

function openDownloadData() {
  pushScreen('settings-download-data');
  ddShowStep('request');
}

// The short "preparing" beat is honest: it is how long the collect step is
// given before the file is offered, not a stand-in for a server round-trip.
function ddRequestData() {
  ddShowStep('preparing');
  _ddTimer = setTimeout(() => { if (_ddStep === 'preparing') ddShowStep('ready'); }, 900);
}

function ddDownloadNow() {
  exportAccountData().then(ok => {
    if (ok) return;
    const err = document.querySelector('#screen-settings-download-data [data-dd-error]');
    if (err) { err.textContent = "Couldn't save the file. Try again."; err.hidden = false; }
  });
}

function ddDone() { clearTimeout(_ddTimer); popScreen(); }

function ddBack() {
  if (_ddStep === 'preparing' || _ddStep === 'ready') { ddShowStep('request'); return; }
  clearTimeout(_ddTimer);
  popScreen();
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
  if (localStorage.getItem(PR_ASKED)) return;
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
