// ================================================================
// services/auth.js — Authentication layer for Zelo
// Depends on: zeloSupabase (services/supabase.js)
// ================================================================

const AUTH = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  let _session     = null;
  let _initialized = false;
  let _pending     = null;   // { destination: string, cb: fn }
  let _emailMode   = 'signup';
  let _verifyEmail = '';     // email currently being confirmed on the verify screen
  let _explicitSignOut = false; // set right before OUR OWN signOut() calls — see onAuthStateChange's SIGNED_OUT branch

  const OVERLAY_IDS = ['auth-overlay', 'auth-verify-overlay', 'auth-reset-overlay', 'auth-setup-overlay'];

  // ── Overlay helpers ────────────────────────────────────────────

  function _showOverlay(id) {
    OVERLAY_IDS.forEach(oid => {
      const el = document.getElementById(oid);
      if (el) el.hidden = (oid !== id);
    });
    if (id === 'auth-overlay') _applyProviderVisibility();
  }

  function _hideAll() {
    OVERLAY_IDS.forEach(oid => {
      const el = document.getElementById(oid);
      if (el) el.hidden = true;
    });
  }

  // ── Restore across the in-app Terms browser ─────────────────────
  // SFSafariViewController (opened for the Terms link) sits directly on top
  // of the WKWebView and is memory-heavy; iOS can reclaim the webview's
  // content process while it's not visible, which reloads the app fresh —
  // wiping in-memory state including whatever was typed here. Snapshotting
  // just before opening it, and replaying on the next boot, makes the
  // sign-up screen come back exactly as the user left it either way: a
  // no-op if nothing reloaded, a restore if it did. One-shot (consumed on
  // read) and time-boxed so a leftover key can't resurrect a stale form on
  // an unrelated future launch.
  const RESTORE_KEY     = 'zelo_auth_restore';
  const RESTORE_TTL_MS  = 2 * 60 * 1000;

  function rememberAuthState() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay || overlay.hidden) return;
    localStorage.setItem(RESTORE_KEY, JSON.stringify({
      t: Date.now(),
      mode: _emailMode,
      email: document.getElementById('auth-email-input')?.value || '',
      terms: !!document.getElementById('auth-terms-checkbox')?.checked
    }));
    // Password is deliberately not persisted — not worth writing a plaintext
    // password to disk, even briefly, just to save a retype.
  }

  function _restoreAuthStateIfAny() {
    const raw = localStorage.getItem(RESTORE_KEY);
    if (!raw) return;
    localStorage.removeItem(RESTORE_KEY);
    let state;
    try { state = JSON.parse(raw); } catch (_) { return; }
    if (!state || (Date.now() - state.t) > RESTORE_TTL_MS) return;
    showEmailScreen(state.mode);
    showEmailStep(); // the Terms link only exists on stage 2 — that's where they were
    const emailInput = document.getElementById('auth-email-input');
    const termsCheck = document.getElementById('auth-terms-checkbox');
    if (emailInput) emailInput.value = state.email || '';
    if (termsCheck && state.mode === 'signup') termsCheck.checked = state.terms;
  }

  // ── Init ───────────────────────────────────────────────────────

  async function init() {
    _applyProviderVisibility();
    const { data } = await zeloSupabase.auth.getSession();
    _session     = data.session;
    _initialized = true;
    if (_session) ensureProfile().then(ok => { if (ok) _loadProfileIntoLocalStorage(); });   // background; heals accounts whose profile row was never created
    if (_session && typeof ZeloRecords !== 'undefined') ZeloRecords.flushConsents().then(() => ZeloRecords.syncPracticeConsent()); // returning user: retry anything queued, then read the server-side consent back

    // Post-OAuth page reload: session appeared and we stored a pending dest
    if (_session) {
      const dest = sessionStorage.getItem('zelo_auth_dest');
      if (dest) {
        sessionStorage.removeItem('zelo_auth_dest');
        if (!localStorage.getItem('zelo_setup_done')) {
          _pending = { destination: dest, cb: () => _navigate(dest) };
          _showSetupScreen();
        } else {
          _navigate(dest);
        }
        return;
      }
    }

    if (!_session) _restoreAuthStateIfAny();

    zeloSupabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      if (event === 'SIGNED_IN')  _onSignedIn();
      if (event === 'SIGNED_OUT') {
        _session = null;
        // signOut()/deleteAccount() below both set this right before their
        // own explicit signOut() call, then reload() immediately after —
        // this event still fires either way, but only an UNEXPECTED one
        // (token revoked/expired server-side, not the user tapping "Sign
        // out") should ever show the session-expired screen.
        if (!_explicitSignOut && window.showSessionExpiredScreen) {
          window.showSessionExpiredScreen();
        }
        _explicitSignOut = false;
      }
    });
  }

  function signedIn() { return !!_session; }

  // ── Auth gate ──────────────────────────────────────────────────

  function requireAuth(destination, cb) {
    if (!_initialized) {
      setTimeout(() => requireAuth(destination, cb), 50);
      return;
    }
    if (signedIn()) { cb(); return; }
    _pending = { destination, cb };
    sessionStorage.setItem('zelo_auth_dest', destination); // survive OAuth redirect
    showEmailScreen('signup');
  }

  // "Already have an account? Sign in": open the sign-in sheet and run cb once a
  // session exists (the caller decides where to go — see cineShowcaseSignIn).
  // onNoAccount runs instead when the person turns out not to have an account
  // (they tap "New to Zelo? Get started", or a fresh Apple/Google sign-in has no
  // Zelo profile yet) — the caller sends them through onboarding.
  // Already signed in when onboarding reaches its sign-up step (they signed in first,
  // then had to go through onboarding): _onSignedIn won't fire again, so write the
  // profile from the onboarding answers here.
  // Makes sure the signed-in account has its row in public.profiles, creating it from the name and
  // age collected in onboarding if it is missing. The profile is what holds the referral code, so
  // without it a friend code is a dud. Confirmed once per account per device (zelo_profile_ok).
  // Resolves true when the row exists afterwards, false when it could not be confirmed or created
  // (offline, no permission, or no name/age to build it from, which the setup screen handles).
  async function ensureProfile() {
    const uid = _session?.user?.id;
    if (!uid) return false;
    if (localStorage.getItem('zelo_profile_ok') === uid) return true;
    try {
      const { data, error } = await zeloSupabase.from('profiles').select('id').eq('id', uid).limit(1);
      if (error) return false;
      if (data && data.length) { localStorage.setItem('zelo_profile_ok', uid); return true; }
      const name = localStorage.getItem('zelo_display_name');
      const age  = Number(localStorage.getItem('zelo_user_age'));
      if (!name || !age) return false;
      const { error: insertError } = await zeloSupabase.from('profiles').insert({ id: uid, display_name: name, age });
      if (insertError && insertError.code !== '23505') return false;
      localStorage.setItem('zelo_profile_ok', uid);
      return true;
    } catch (e) { return false; }
  }

  async function _insertProfileFromOnboarding() {
    const userId = _session?.user?.id;
    const name = localStorage.getItem('zelo_display_name');
    const age  = localStorage.getItem('zelo_user_age');
    if (!userId || !name || !age) return;
    // Only mark setup done if the profile row really exists afterwards. This used to set the
    // flag unconditionally, so an account whose insert failed looked finished forever and
    // never retried. (23505 = it already exists, which is fine.)
    if (await ensureProfile()) localStorage.setItem('zelo_setup_done', '1');
    if (typeof window._redeemPendingReferralIfAny === 'function') window._redeemPendingReferralIfAny();
  }

  function startSignIn(cb, onNoAccount) {
    if (!_initialized) { setTimeout(() => startSignIn(cb, onNoAccount), 50); return; }
    // Deliberately NO "already signed in -> skip" shortcut: tapping Sign in must always show
    // the sign-in page, even when a session from an earlier run is still saved on the device.
    _pending = { destination: 'signin', cb, onNoAccount };
    showEmailScreen('signin');
  }

  // Onboarding's "Save your progress" step (script.js cineProviderTap) —
  // runs the REAL account creation for whichever provider was tapped and
  // calls cb once a session exists, so onboarding only moves on for a
  // genuinely signed-in user. Opens the same sheet as requireAuth() so any
  // provider error (Apple/Google unavailable, bad password…) has somewhere
  // visible to show; the terms box is pre-ticked because onboarding's own
  // terms checkbox already had to be ticked to get here.
  function startFromOnboarding(provider, cb) {
    if (!_initialized) { setTimeout(() => startFromOnboarding(provider, cb), 50); return; }
    // Apple/Google are one-shot native flows — if a session is already open there's nothing
    // left to show, just attach this onboarding's answers and move on. Email is different:
    // "Continue with email" must always show the real fill-in form, never silently skip it
    // just because some earlier session (e.g. from testing) happens to still be open — it is
    // also how you sign IN to a different/existing account from here, not only sign up.
    if (signedIn() && provider !== 'email') { _insertProfileFromOnboarding().finally(cb); return; }
    _pending = { destination: 'onboarding', cb };
    showEmailScreen('signup');
    const termsCheck = document.getElementById('auth-terms-checkbox');
    if (termsCheck) termsCheck.checked = true;
    if (provider === 'email')       showEmailStep();
    else if (provider === 'apple')  signInWithApple();
    else if (provider === 'google') signInWithGoogle();
  }

  // ── Sign in / create account screen ─────────────────────────────

  function showEmailScreen(mode) {
    _emailMode = mode || 'signup';
    _renderEmailScreen();
    // Always re-enter on the stage-1 provider-picker sheet, even if a
    // previous visit was left on the stage-2 email step.
    document.getElementById('auth-email-step')?.classList.remove('auth-email-step--show');
    document.getElementById('auth-overlay')?.classList.remove('auth-overlay--open');
    _showOverlay('auth-overlay');
    // Two-frame delay so the browser paints the pre-open (off-screen) state
    // first — adding the open class in the same tick as un-hiding would let
    // the sheet render already-open with no visible slide-up.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('auth-overlay')?.classList.add('auth-overlay--open');
    }));
  }

  function _renderEmailScreen() {
    const el = document.getElementById('auth-overlay');
    if (!el) return;
    const isSignup = _emailMode === 'signup';

    el.querySelector('#auth-heading').textContent = isSignup ? 'Create Account' : 'Sign In';
    el.querySelector('#auth-email-step-title').textContent = "What's your email?";
    el.querySelector('#auth-subtext').textContent = isSignup
      ? 'Enter your email and create a password to continue.'
      : 'Enter your email and password to continue.';

    const termsWrap = el.querySelector('#auth-terms-wrap');
    if (termsWrap) termsWrap.hidden = !isSignup;

    el.querySelector('#auth-submit-btn').textContent = isSignup ? 'Create account' : 'Sign in';
    { const b = el.querySelector('#auth-submit-btn'); b.disabled = false; b.classList.remove('auth-submit-btn--busy'); }
    el.querySelector('#auth-toggle-btn').textContent = isSignup
      ? 'Already have an account? Sign in'
      : (_pending && _pending.onNoAccount ? 'New to Zelo? Get started' : "Don't have an account? Sign up");
    el.querySelector('#auth-apple-btn-label').textContent  = isSignup ? 'Sign up with Apple'  : 'Sign in with Apple';
    el.querySelector('#auth-google-btn-label').textContent = isSignup ? 'Sign up with Google' : 'Sign in with Google';
    el.querySelector('#auth-email-btn-label').textContent  = 'Continue with email';

    const errEl = el.querySelector('#auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
    const provErrEl = el.querySelector('#auth-provider-error');
    if (provErrEl) provErrEl.textContent = '';

    const emailInput = el.querySelector('#auth-email-input');
    const passInput  = el.querySelector('#auth-password-input');
    const termsCheck = el.querySelector('#auth-terms-checkbox');
    if (emailInput) emailInput.value = '';
    if (passInput)  passInput.value  = '';
    if (termsCheck) termsCheck.checked = false;
  }

  // Stage 1 (provider-picker sheet) -> stage 2 (full-screen email+password).
  function showEmailStep() {
    const step = document.getElementById('auth-email-step');
    if (!step) return;
    step.classList.add('auth-email-step--show');
    setTimeout(() => document.getElementById('auth-email-input')?.focus(), 260);
  }

  function backToPicker() {
    document.getElementById('auth-email-step')?.classList.remove('auth-email-step--show');
  }

  // Instant feedback on the submit button. Signing in is two network round trips
  // (the sign-in, then loading the profile) before the sheet closes; with nothing
  // changing on screen in the meantime the press looked like it had not registered.
  function _setSubmitBusy(busy) {
    const btn = document.getElementById('auth-submit-btn');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle('auth-submit-btn--busy', !!busy);
    const signup = _emailMode === 'signup';
    btn.textContent = busy ? (signup ? 'Creating account\u2026' : 'Signing in\u2026') : (signup ? 'Create account' : 'Sign in');
  }

  async function handleEmailSubmit() {
    try { await _handleEmailSubmit(); }
    catch (e) {
      _setSubmitBusy(false);
      const errEl = document.getElementById('auth-email-error');
      if (errEl) errEl.textContent = "Can't reach Zelo. Check your internet connection and try again.";
    }
  }

  async function _handleEmailSubmit() {
    const email    = (document.getElementById('auth-email-input')?.value    || '').trim();
    const password =  document.getElementById('auth-password-input')?.value || '';
    const errEl    =  document.getElementById('auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Please fill in all fields.';
      return;
    }
    if (!_looksLikeEmail(email)) {
      if (errEl) errEl.textContent = "That doesn't look like a valid email address. Check for typos.";
      return;
    }

    _setSubmitBusy(true);
    if (_emailMode === 'signup') {
      _pendingIsOnboardingSignIn = false;
      // Signing up IS the agreement (stated on the form): that is the consent moment.
      if (typeof ZeloRecords !== 'undefined') ZeloRecords.recordConsent('terms_and_privacy', true);
      const { data, error } = await zeloSupabase.auth.signUp({ email, password });
      if (error) { _setSubmitBusy(false); if (errEl) errEl.textContent = await _friendlyAuthError(error, email, 'signup'); return; }

      if (!data?.session) {
        // Email confirmation is required before a session is issued —
        // send the user to the verification-code screen.
        _setSubmitBusy(false);
        _showVerifyScreen(email);
      }
      // else: confirmation is disabled on this project, session issued
      // immediately, onAuthStateChange fires SIGNED_IN → _onSignedIn()
    } else {
      // Signing IN (not up) from the email step reached mid-onboarding
      // (onboarding's step 14 "Continue with email" → toggle to "Sign in"):
      // this is exactly the front-of-onboarding "Sign in" case (an existing
      // account), not a new signup — _onSignedIn() reads this flag once to
      // route the same way (restore the real profile, skip straight into
      // the app) instead of treating the onboarding answers as a fresh
      // signup and walking the rest of onboarding.
      _pendingIsOnboardingSignIn = !!(_pending && _pending.destination === 'onboarding');
      const { error } = await zeloSupabase.auth.signInWithPassword({ email, password });
      if (error) {
        _pendingIsOnboardingSignIn = false;
        if (_isUnconfirmedEmailError(error)) {
          await zeloSupabase.auth.resend({ type: 'signup', email }).catch(() => {});
          _setSubmitBusy(false);
          _showVerifyScreen(email);
          return;
        }
        _setSubmitBusy(false);
        if (errEl) errEl.textContent = await _friendlyAuthError(error, email, 'signin');
        return;
      }
    }
    // onAuthStateChange fires SIGNED_IN → _onSignedIn()
  }

  function _isUnconfirmedEmailError(error) {
    if (error?.code === 'email_not_confirmed') return true;
    return /not confirmed/i.test(error?.message || '');
  }

  // ── Specific, human error messages ───────────────────────────────
  function _looksLikeEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  // true / false / null (couldn't find out). Backed by public.email_exists() — migration …170000.
  async function _emailExists(email) {
    try {
      const { data, error } = await zeloSupabase.rpc('email_exists', { p_email: email });
      if (error || typeof data !== 'boolean') return null;
      return data;
    } catch (_) { return null; }
  }

  async function _friendlyAuthError(error, email, mode) {
    const msg  = String(error?.message || '');
    const code = error?.code || '';
    if (!navigator.onLine || /failed to fetch|network|load failed/i.test(msg)) {
      return "Can't reach Zelo. Check your internet connection and try again.";
    }
    if (error?.status === 429 || /rate limit|too many/i.test(msg + code)) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (mode === 'signin' && (code === 'invalid_credentials' || /invalid login credentials/i.test(msg))) {
      const exists = await _emailExists(email);
      if (exists === false) return 'No account found with this email. Check the spelling, or create an account.';
      if (exists === true)  return 'Wrong password. Try again, or tap "Forgot password?".';
      return 'Email or password is incorrect.';
    }
    if (mode === 'signup' && (code === 'user_already_exists' || /already registered|already exists/i.test(msg))) {
      return 'An account with this email already exists. Sign in instead.';
    }
    if (code === 'weak_password' || /password.*(short|weak|at least)/i.test(msg)) {
      return 'That password is too weak. Use at least 8 characters with letters and numbers.';
    }
    if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) {
      return "That doesn't look like a valid email address. Check for typos.";
    }
    return msg || 'Something went wrong. Try again.';
  }

  // ── Forgot password: its own page (just the email form now — the
  // "we emailed you a link" step moved to #auth-reset-overlay, which takes
  // the code and the new password together) ──
  function handleForgotPassword() {
    const step = document.getElementById('auth-forgot-step');
    if (!step) return;
    const typed = (document.getElementById('auth-email-input')?.value || '').trim();
    document.getElementById('auth-forgot-email').value = typed;
    document.getElementById('auth-forgot-error').textContent = '';
    document.getElementById('auth-forgot-form').hidden = false;
    document.getElementById('auth-forgot-send').hidden = false;
    step.classList.add('auth-email-step--show');
    setTimeout(() => document.getElementById('auth-forgot-email')?.focus(), 320);
  }

  function closeForgot() {
    document.getElementById('auth-forgot-step')?.classList.remove('auth-email-step--show');
  }

  // Sync on purpose: nothing here waits on the network. The code screen opens
  // immediately and the email is sent in the background (see
  // startPasswordReset / _deliverResetCode).
  function sendForgot() {
    const errEl = document.getElementById('auth-forgot-error');
    if (errEl) errEl.textContent = '';
    const r = startPasswordReset(document.getElementById('auth-forgot-email')?.value, 'sheet');
    if (r.error) { if (errEl) errEl.textContent = r.error; return; }
    closeForgot();
  }

  // ── Reset password (recovery code -> new password) ───────────────
  // Supabase's recovery email is consumed as a 6-digit code (verifyOtp with
  // type 'recovery'), the same way sign-up verification already works, because
  // a reset LINK opens Safari at the Site URL and cannot set a password inside
  // the app. verifyOtp DOES issue a session, which fires SIGNED_IN — so
  // _resettingPassword holds _onSignedIn() back until the new password is
  // actually saved, otherwise the sheet would navigate away mid-flow and leave
  // the old password in place.
  let _resetEmail = '';
  let _resettingPassword = false;
  let _resetFrom = 'sheet';        // 'sheet' (sign-in) | 'settings' (Profile & Login)
  let _resetTapLatch = false;      // swallows a double-tap on the send button

  // Last code request, so asking again for the same address inside the window
  // reuses the code already in their inbox instead of sending a second email.
  // 60 s mirrors the server's own limit (smtp_max_frequency).
  const RESET_SENT_KEY    = 'zelo_reset_sent';
  const RESET_COOLDOWN_MS = 60 * 1000;
  function _resetCooldownLeft(email) {
    try {
      const r = JSON.parse(localStorage.getItem(RESET_SENT_KEY) || 'null');
      if (!r || r.e !== String(email).toLowerCase()) return 0;
      return Math.max(0, r.t + RESET_COOLDOWN_MS - Date.now());
    } catch (e) { return 0; }
  }
  function _markResetSent(email) {
    try { localStorage.setItem(RESET_SENT_KEY, JSON.stringify({ e: String(email).toLowerCase(), t: Date.now() })); } catch (e) {}
  }
  function _clearResetSent() { try { localStorage.removeItem(RESET_SENT_KEY); } catch (e) {} }

  // ONE entry point for both places a password can be reset from. Returns
  // synchronously: { error } only for something wrong with the input itself.
  // On success the code screen is ALREADY showing and the email is on its way
  // in the background, so the person never sits watching a greyed-out button
  // while an SMTP round trip finishes.
  function startPasswordReset(rawEmail, source) {
    const email = String(rawEmail || '').trim();
    if (!email) return { error: 'Enter your email address.' };
    if (!_looksLikeEmail(email)) return { error: "That doesn't look like a valid email address. Check for typos." };
    if (_resetTapLatch) return { error: null };            // second tap of the same press: ignore
    _resetTapLatch = true;
    setTimeout(() => { _resetTapLatch = false; }, 2000);
    _resetFrom = source === 'settings' ? 'settings' : 'sheet';
    _showResetScreen(email);
    _deliverResetCode(email, false);                       // deliberately not awaited
    return { error: null };
  }

  async function _deliverResetCode(email, isResend) {
    const errEl = document.getElementById('auth-reset-error');
    // Only write to the screen if it is still about this address.
    const say = (msg, ok) => { if (errEl && _resetEmail === email) { errEl.textContent = msg; errEl.style.color = ok ? '#22c55e' : ''; } };
    if (!isResend && _resetCooldownLeft(email) > 0) {
      say('A code was already sent. Check your email.', true);
      return true;
    }
    _markResetSent(email);       // claimed BEFORE the network call, so a re-entry can't race it
    try {
      if (await _emailExists(email) === false) {
        _clearResetSent();
        say('No account found with this email. Go back and check the spelling.', false);
        _resetResendEnable();
        return false;
      }
      const { error } = await zeloSupabase.auth.resetPasswordForEmail(email);
      if (error) {
        _clearResetSent();
        say(await _friendlyAuthError(error, email, 'reset'), false);
        _resetResendEnable();
        return false;
      }
      say('Code sent. Check your email.', true);
      return true;
    } catch (e) {
      _clearResetSent();
      say("Can't reach Zelo. Check your internet connection and try again.", false);
      _resetResendEnable();
      return false;
    }
  }

  function _showResetScreen(email) {
    _resetEmail = email;
    const el = document.getElementById('auth-reset-overlay');
    if (el) {
      const emailEl = el.querySelector('#auth-reset-email');
      if (emailEl) emailEl.textContent = email;
      const errEl = el.querySelector('#auth-reset-error');
      if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
      el.querySelectorAll('.auth-code-input').forEach(inp => { inp.value = ''; });
      const p1 = el.querySelector('#auth-reset-password');
      const p2 = el.querySelector('#auth-reset-password2');
      if (p1) p1.value = '';
      if (p2) p2.value = '';
    }
    _initCodeInputs('auth-reset-code-row');
    _showOverlay('auth-reset-overlay');
    _resetResendCountdown();   // a code was just sent — don't offer an instant resend
    el?.querySelector('.auth-code-input')?.focus();
  }

  function backFromReset() {
    clearInterval(_resetResendTimer);
    _resettingPassword = false;
    // From Settings there is no sign-in sheet to return to: closing the overlay
    // lands back on the Forgot Password page underneath.
    if (_resetFrom === 'settings') { _hideAll(); return; }
    _showOverlay('auth-overlay');
  }

  async function handleResetSubmit() {
    const errEl = document.getElementById('auth-reset-error');
    const set = msg => { if (errEl) { errEl.textContent = msg; errEl.style.color = ''; } };
    set('');
    const code = _readCode('auth-reset-code-row');
    const pw   = document.getElementById('auth-reset-password')?.value  || '';
    const pw2  = document.getElementById('auth-reset-password2')?.value || '';
    if (code.length !== 6)  { set('Enter the 6-digit code.'); return; }
    // Supabase's own default minimum. Checked here so a weak password is
    // rejected BEFORE the code is spent — a recovery code is single-use, and
    // failing after verifyOtp would force the user to request a new one.
    if (pw.length < 6)      { set('Use at least 6 characters for your new password.'); return; }
    if (pw !== pw2)         { set("Those passwords don't match."); return; }

    const btn = document.getElementById('auth-reset-submit-btn');
    if (btn) btn.disabled = true;
    _resettingPassword = true;
    try {
      const { error: otpError } = await zeloSupabase.auth.verifyOtp({ email: _resetEmail, token: code, type: 'recovery' });
      if (otpError) {
        _resettingPassword = false;
        set(/expired|invalid/i.test(otpError.message || '')
          ? 'That code is wrong or has expired. Tap "Resend code" for a new one.'
          : otpError.message);
        return;
      }
      const { error: pwError } = await zeloSupabase.auth.updateUser({ password: pw });
      if (pwError) {
        // The code was spent and a session exists, so the user IS signed in —
        // say exactly that rather than implying nothing happened.
        _resettingPassword = false;
        set("You're signed in, but the new password couldn't be saved: " + (pwError.message || 'please try again from Settings.'));
        return;
      }
      _resettingPassword = false;
      if (_resetFrom === 'settings') {
        // Already signed in and already inside the app: just close the overlay,
        // go back to Profile & Login and say it worked. _onSignedIn() would
        // run the sign-in navigation, which makes no sense from Settings.
        _hideAll();
        if (typeof window._plBackToProfileLogin === 'function') window._plBackToProfileLogin();
        if (typeof window.showNotice === 'function') window.showNotice('Password updated', 'Your new password is ready to use.');
        return;
      }
      _onSignedIn();   // held back above; run the normal post-sign-in path now
    } catch (e) {
      _resettingPassword = false;
      set("Can't reach Zelo. Check your internet connection and try again.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  let _resetResendTimer = null;

  function _resetResendCountdown() {
    clearInterval(_resetResendTimer);
    const btn = document.getElementById('auth-reset-resend-btn');
    if (!btn) return;
    let remaining = 60;
    btn.disabled = true;
    const tick = () => {
      if (remaining <= 0) {
        clearInterval(_resetResendTimer);
        btn.disabled = false;
        btn.textContent = 'Resend code';
        return;
      }
      btn.textContent = `Resend code in ${remaining}s`;
      remaining--;
    };
    tick();
    _resetResendTimer = setInterval(tick, 1000);
  }

  // Failed to send: give the button back immediately instead of making them
  // wait out a 60 s cooldown for an email that never went.
  function _resetResendEnable() {
    clearInterval(_resetResendTimer);
    const btn = document.getElementById('auth-reset-resend-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Resend code'; }
  }

  async function handleResetResend() {
    const btn = document.getElementById('auth-reset-resend-btn');
    if (!_resetEmail || (btn && btn.disabled)) return;
    _resetResendCountdown();                 // disables the button on THIS tap, before any await
    await _deliverResetCode(_resetEmail, true);
  }

  function toggleEmailMode() {
    // Opened from the first screen's "Sign in": "no account" means onboarding, not an
    // in-sheet sign-up form.
    if (_emailMode === 'signin' && _pending && _pending.destination === 'signin' && _pending.onNoAccount) {
      const goOnboard = _pending.onNoAccount;
      dismiss();
      goOnboard();
      return;
    }
    _emailMode = _emailMode === 'signup' ? 'signin' : 'signup';
    _renderEmailScreen();
  }

  // ── Email verification (6-digit code) ───────────────────────────

  function _showVerifyScreen(email) {
    _verifyEmail = email;
    const el = document.getElementById('auth-verify-overlay');
    if (el) {
      const emailEl = el.querySelector('#auth-verify-email');
      if (emailEl) emailEl.textContent = email;
      const errEl = el.querySelector('#auth-verify-error');
      if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
      el.querySelectorAll('.auth-code-input').forEach(inp => { inp.value = ''; });
    }
    _initCodeInputs();
    _showOverlay('auth-verify-overlay');
    el?.querySelector('.auth-code-input')?.focus();
  }

  function backFromVerify() {
    _showOverlay('auth-overlay');
  }

  function _codeInputs(rowId) {
    return Array.from(document.querySelectorAll('#' + (rowId || 'auth-code-row') + ' .auth-code-input'));
  }

  // ── The one-time-code boxes (sign-up verify, password reset, Profile & Login) ──
  // ONE implementation, used by all three rows (script.js's Profile & Login
  // modals call AUTH.bindCodeRow too — they had their own copy with the same flaw).
  //
  // What it has to cope with, none of which a "one character per box" handler does:
  //  * iOS offers the code from Messages/Mail ("From Messages") and puts the WHOLE code
  //    into the one field that carries autocomplete="one-time-code". The old handler
  //    kept only the last character, so autofill left a single digit behind.
  //  * a maxlength="1" box truncates that autofill to one digit before any script sees it,
  //    so maxlength is removed and the length is enforced here instead.
  //  * the same code can arrive by paste, or into whichever box happened to be focused.
  //  * typing a digit over one that is already there.
  //  * Backspace on an empty box should delete the PREVIOUS digit, not just move the cursor.
  const _codeRowsBound = new Set();
  function bindCodeRow(rowId) {
    const row = rowId || 'auth-code-row';
    if (_codeRowsBound.has(row)) return;
    const inputs = _codeInputs(row);
    if (!inputs.length) return;
    _codeRowsBound.add(row);
    const last = inputs.length - 1;
    const digitsOf = v => String(v || '').replace(/\D/g, '');

    inputs.forEach(inp => {
      inp.removeAttribute('maxlength');                   // see above
      inp.setAttribute('autocomplete', 'one-time-code');  // any box can receive the autofill
      inp.setAttribute('inputmode', 'numeric');
      inp._prev = digitsOf(inp.value);
    });

    // Put `digits` into the boxes from `start`, then park the cursor after the last one written.
    const fill = (start, digits) => {
      const d = digits.slice(0, inputs.length - start);
      d.split('').forEach((ch, k) => { inputs[start + k].value = ch; inputs[start + k]._prev = ch; });
      inputs[Math.min(start + d.length, last)].focus();
    };

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const d = digitsOf(inp.value);
        const prev = inp._prev || '';
        if (d.length <= 1) {                                 // normal typing / deleting
          inp.value = d; inp._prev = d;
          if (d && i < last) inputs[i + 1].focus();
        } else if (d.length === 2 && prev.length === 1) {    // typed over an existing digit
          const typed = d[0] === prev ? d[1] : d[0];
          inp.value = typed; inp._prev = typed;
          if (i < last) inputs[i + 1].focus();
        } else {                                             // a whole code: autofill, paste, IME
          // A complete code always starts at box 1, whichever box received it.
          fill(d.length >= inputs.length ? 0 : i, d);
        }
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && i > 0) {
          e.preventDefault();                                // delete the previous digit in one press
          inputs[i - 1].value = ''; inputs[i - 1]._prev = '';
          inputs[i - 1].focus();
        }
      });
      inp.addEventListener('paste', (e) => {
        const text = digitsOf(e.clipboardData?.getData('text'));
        if (!text) return;
        e.preventDefault();
        fill(text.length >= inputs.length ? 0 : i, text);
      });
    });
  }
  const _initCodeInputs = bindCodeRow;

  function _readCode(rowId) {
    return _codeInputs(rowId).map(inp => inp.value).join('');
  }

  async function handleVerifySubmit() {
    const errEl = document.getElementById('auth-verify-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
    const code = _readCode();
    if (code.length !== 6) {
      if (errEl) errEl.textContent = 'Enter the 6-digit code.';
      return;
    }
    const { error } = await zeloSupabase.auth.verifyOtp({ email: _verifyEmail, token: code, type: 'signup' });
    if (error) { if (errEl) errEl.textContent = error.message; return; }
    // onAuthStateChange fires SIGNED_IN → _onSignedIn()
  }

  async function handleResendCode() {
    const errEl = document.getElementById('auth-verify-error');
    if (!_verifyEmail) return;
    const { error } = await zeloSupabase.auth.resend({ type: 'signup', email: _verifyEmail });
    if (errEl) {
      errEl.textContent = error ? error.message : 'Code resent — check your email.';
      errEl.style.color = error ? '' : '#22c55e';
    }
  }

  // ── OAuth (native Google / Apple via @capgo/capacitor-social-login) ──
  // REPLACE these before shipping — see ios/App/App/Info.plist (GIDClientID /
  // CFBundleURLTypes) for the matching native-side Google config, and the
  // Supabase dashboard (Auth → Providers → Google/Apple) which must list the
  // same client IDs as authorized audiences.
  const GOOGLE_IOS_CLIENT_ID = 'REPLACE_WITH_IOS_CLIENT_ID.apps.googleusercontent.com';
  const APPLE_SERVICE_ID     = 'com.ozlilbrother.zelo'; // bundle id — fine for native iOS

  // Each provider needs work OUTSIDE this file before its button can work, and
  // a button that always fails is worse than no button (App Review taps every
  // one of them). Flip a flag to true only once its whole chain is done:
  //
  //   apple:  Xcode > Signing & Capabilities > + Sign in with Apple (writes
  //           App.entitlements), AND Supabase > Auth > Providers > Apple
  //           enabled with the bundle id as an authorized client.
  //   google: a real iOS OAuth client in Google Cloud Console, its id in
  //           GOOGLE_IOS_CLIENT_ID above AND in Info.plist (GIDClientID +
  //           the reversed-id CFBundleURLScheme), AND Supabase > Auth >
  //           Providers > Google listing it as an authorized audience.
  //
  // Email sign-in works on its own, and Apple only *requires* Sign in with
  // Apple when some other third-party login is offered — so shipping with
  // both off is compliant, not a gap.
  const PROVIDER_ENABLED = { apple: false, google: false };

  // Hides the buttons whose chain isn't finished, so nothing on screen
  // promises a sign-in route that cannot complete. Covers BOTH places they
  // appear: the auth sheet and onboarding step 14 ("Save your progress"),
  // which is the one that matters most — every new user has to get past it,
  // and tapping a broken provider there left them stuck.
  function _applyProviderVisibility() {
    document.querySelectorAll('[data-provider]').forEach(btn => {
      const name = btn.dataset.provider;
      if (name in PROVIDER_ENABLED) btn.hidden = !PROVIDER_ENABLED[name];
    });
  }

  let _socialInitDone = null;

  // Native plugin only exists inside the compiled iOS app, not plain web —
  // mirrors the window.Capacitor?.Plugins?.X guard used for ATT elsewhere.
  function _initSocialLogin() {
    const SocialLogin = window.Capacitor?.Plugins?.SocialLogin;
    if (!SocialLogin) return Promise.resolve(null);
    if (!_socialInitDone) {
      _socialInitDone = SocialLogin.initialize({
        google: { iOSClientId: GOOGLE_IOS_CLIENT_ID, mode: 'online' },
        apple:  { clientId: APPLE_SERVICE_ID }
      }).then(() => SocialLogin);
    }
    return _socialInitDone;
  }

  function _isUserCancelled(e) {
    const msg = String(e?.message || e?.errorMessage || '').toLowerCase();
    return msg.includes('cancel');
  }

  // A literal 'REPLACE_WITH_...' client ID means Google Cloud Console
  // credentials were never provisioned. Sending that to GIDSignIn still
  // opens a real Google OAuth request with a nonexistent client_id, which
  // Google's server correctly rejects with a 400 "invalid_request" page —
  // that's the root cause of the "cannot process for google" error. Catch
  // it client-side first so the failure is an actionable message instead
  // of a confusing native OAuth error page.
  function _isUnconfigured(id) {
    return !id || id.indexOf('REPLACE_WITH') === 0;
  }

  async function signInWithApple() {
    if (!PROVIDER_ENABLED.apple) { _setProviderError('Apple sign-in isn\u2019t available yet. Use your email instead.'); return; }
    const SocialLogin = await _initSocialLogin();
    if (!SocialLogin) { _setProviderError('Apple sign-in is only available in the app.'); return; }
    try {
      const { result } = await SocialLogin.login({ provider: 'apple', options: { scopes: ['email', 'name'] } });
      if (!result?.idToken) { _setProviderError('Apple sign-in did not return a token.'); return; }
      const { error } = await zeloSupabase.auth.signInWithIdToken({ provider: 'apple', token: result.idToken });
      if (error) _setProviderError(error.message);
    } catch (e) {
      if (!_isUserCancelled(e)) _setProviderError('Apple sign-in failed. Please try again.');
    }
  }

  async function signInWithGoogle() {
    if (!PROVIDER_ENABLED.google) { _setProviderError('Google sign-in isn\u2019t available yet. Use your email instead.'); return; }
    if (_isUnconfigured(GOOGLE_IOS_CLIENT_ID)) {
      _setProviderError('Google sign-in isn’t configured yet (missing OAuth Client ID).');
      return;
    }
    const SocialLogin = await _initSocialLogin();
    if (!SocialLogin) { _setProviderError('Google sign-in is only available in the app.'); return; }
    try {
      const { result } = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
      if (!result?.idToken) { _setProviderError('Google sign-in did not return a token.'); return; }
      const { error } = await zeloSupabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
      if (error) _setProviderError(error.message);
    } catch (e) {
      if (!_isUserCancelled(e)) _setProviderError('Google sign-in failed. Please try again.');
    }
  }

  function _setProviderError(msg) {
    let errEl = document.getElementById('auth-provider-error');
    if (errEl) { errEl.textContent = msg; }
  }

  // ── Post sign-in ───────────────────────────────────────────────

  // Set only for the moment between submitting the EMAIL sign-in form reached from inside
  // onboarding and _onSignedIn() consuming it once (see handleEmailSubmit) — lets _onSignedIn
  // tell "signing into an existing account, met mid-onboarding" apart from "signing up".
  let _pendingIsOnboardingSignIn = false;

  // Same destination as the front-of-onboarding "Sign in": drop the onboarding overlay and
  // land straight in the app, instead of resolving `_pending.cb` (which would just advance
  // onboarding by one step, as if this had been a signup).
  function _finishAsOnboardingSignIn() {
    _pending = null;
    sessionStorage.removeItem('zelo_auth_dest');
    if (typeof window.cineEnterAppAfterSignIn === 'function') window.cineEnterAppAfterSignIn();
  }

  function _onSignedIn() {
    // A recovery code issues a session before the new password is saved (see
    // handleResetSubmit) — navigating here would abandon the reset half-done.
    if (_resettingPassword) return;
    // Consent given before there was an account (onboarding) gets written now.
    if (typeof ZeloRecords !== 'undefined') ZeloRecords.flushConsents().then(() => ZeloRecords.syncPracticeConsent());
    const isOnboardingSignIn = _pendingIsOnboardingSignIn;
    _pendingIsOnboardingSignIn = false; // consume once
    // Onboarding (script.js's cine flow) already collected display name +
    // exact age before ever reaching sign-up — asking again here on the
    // setup screen would be a redundant second ask. Only skip when both are
    // actually present (e.g. a user who signed in directly from Showcase's
    // "Already have an account", without running onboarding first, still
    // gets the normal setup screen below) AND this was actually a signup —
    // an existing account signing IN mid-onboarding must never have a new
    // profile inserted from the onboarding answers (see isOnboardingSignIn).
    const onboardingName = localStorage.getItem('zelo_display_name');
    const onboardingAge  = localStorage.getItem('zelo_user_age');
    if (!isOnboardingSignIn && !localStorage.getItem('zelo_setup_done') && onboardingName && onboardingAge) {
      // setup_done is set only once ensureProfile() has confirmed the row exists (see its comment);
      // if the insert fails the flag stays unset, so the next launch or the Invite screen retries it.
      const insert = ensureProfile().then(done => { if (done) localStorage.setItem('zelo_setup_done', '1'); });
      insert.finally(() => {
        if (typeof window._redeemPendingReferralIfAny === 'function') window._redeemPendingReferralIfAny();
        _hideAll(); _resolvePending();
      });
      return;
    }
    if (!localStorage.getItem('zelo_setup_done')) {
      // Signing in to an account that already has a profile (fresh install, another
      // device, cleared storage, or an existing account met mid-onboarding): restore
      // it and skip the name/age setup screen.
      _loadProfileIntoLocalStorage().then(status => {
        if (localStorage.getItem('zelo_display_name') && localStorage.getItem('zelo_user_age')) {
          localStorage.setItem('zelo_setup_done', '1');
          _hideAll();
          if (isOnboardingSignIn) _finishAsOnboardingSignIn();
          else _resolvePending();
        } else if (status === 'error') {
          // The profile could not be READ (network, or the table's permissions), which says
          // nothing about whether one exists. Asking a returning user for their name and age
          // again was the unexplained screen after signing in, so carry on without it and
          // retry next time (setup_done stays unset).
          _hideAll();
          if (isOnboardingSignIn) _finishAsOnboardingSignIn();
          else _resolvePending();
        } else if (isOnboardingSignIn) {
          // Existing account, but no profile row (rare in practice — the onboarding name/age
          // answered a moment ago are already sitting in local storage regardless): ask for
          // name/age directly rather than looping back into the onboarding this came from.
          _showSetupScreen();
        } else if (_pending && _pending.destination === 'signin' && _pending.onNoAccount) {
          // Signed in (e.g. a brand-new Apple/Google account) but there is no Zelo
          // profile: this person has not been through onboarding yet — send them there.
          const goOnboard = _pending.onNoAccount;
          _pending = null;
          sessionStorage.removeItem('zelo_auth_dest');
          _hideAll();
          goOnboard();
        } else {
          _showSetupScreen();
        }
      });
    } else {
      // Returning user: the profile is already on this device, so the sheet does not
      // wait for another round trip to refresh it (that wait was most of what made
      // Continue feel slow). Only the onboarding sign-in path still needs it first.
      const refresh = _loadProfileIntoLocalStorage();
      if (isOnboardingSignIn) refresh.then(() => { _hideAll(); _finishAsOnboardingSignIn(); });
      else { _hideAll(); _resolvePending(); }
    }
  }

  // Resolves 'found', 'none' (the account genuinely has no profile row) or 'error'
  // (could not read it). .single() reports "no rows" as PGRST116; anything else is a
  // failure to read, not proof that there is no profile.
  async function _loadProfileIntoLocalStorage() {
    const userId = _session?.user?.id;
    if (!userId) return 'error';
    try {
      const { data, error } = await zeloSupabase
        .from('profiles')
        .select('display_name, age')
        .eq('id', userId)
        .single();
      if (data && !error) {
        if (data.display_name) localStorage.setItem('zelo_display_name', data.display_name);
        if (data.age != null)  localStorage.setItem('zelo_user_age', String(data.age));
        return 'found';
      }
      return error && error.code !== 'PGRST116' ? 'error' : 'none';
    } catch (_) { return 'error'; }
  }

  // ── Setup screen ───────────────────────────────────────────────

  function _showSetupScreen() {
    _showOverlay('auth-setup-overlay');
    initAgeRoller({ rollerId: 'age-roller', warnId: 'age-warn', minAge: 18, maxAge: 40, defaultAge: 22 });
    // Prefill with the name already chosen during onboarding, if any —
    // avoids asking twice.
    const nameInput = document.getElementById('setup-username-input');
    const existing  = localStorage.getItem('zelo_display_name');
    if (nameInput && existing) nameInput.value = existing;
  }

  // Shared age-roller mechanics (build/scroll/read) — used by both the
  // post-signup setup screen's #age-roller (18-40, default 22) and the
  // onboarding birth-date screen's #cine-age-roller (extended range so
  // under-18 is actually reachable to block). Same implementation, two DOM
  // instances — not a rebuilt picker. `minAge` is captured per-instance via
  // the roller element's own dataset so scroll/read stay correct even with
  // two rollers using different ranges at once.
  function initAgeRoller({ rollerId, warnId, minAge, maxAge, defaultAge }) {
    const roller = document.getElementById(rollerId);
    if (!roller) return;
    roller.dataset.minAge = String(minAge);
    roller.dataset.warnId = warnId || '';
    roller.removeEventListener('scroll', _onRollerScroll);
    roller.innerHTML = '';

    // 2 ghost items top → minAge can sit at center when scrollTop=0
    for (let i = 0; i < 2; i++) {
      const g = document.createElement('div');
      g.className = 'age-roller-item age-roller-ghost';
      roller.appendChild(g);
    }
    for (let age = minAge; age <= maxAge; age++) {
      const item = document.createElement('div');
      item.className = 'age-roller-item';
      item.dataset.age = age;
      item.textContent = age;
      roller.appendChild(item);
    }
    // 2 ghost items bottom → maxAge can sit at center when scrollTop=max
    for (let i = 0; i < 2; i++) {
      const g = document.createElement('div');
      g.className = 'age-roller-item age-roller-ghost';
      roller.appendChild(g);
    }

    requestAnimationFrame(() => {
      roller.scrollTop = ((defaultAge != null ? defaultAge : minAge) - minAge) * 44;
    });
    roller.addEventListener('scroll', _onRollerScroll, { passive: true });
    _onRollerScroll({ target: roller }); // seed the warn text for the initial position
  }

  function _onRollerScroll(e) {
    const roller = (e && e.target) || document.getElementById('age-roller');
    if (!roller) return;
    const minAge = Number(roller.dataset.minAge || 18);
    const age    = readAge(roller.id, minAge);
    const warnEl = document.getElementById(roller.dataset.warnId || 'age-warn');
    if (warnEl) warnEl.textContent = age < 18 ? 'Zelo is for users 18 and older.' : '';
  }

  function readAge(rollerId, minAge) {
    const r = document.getElementById(rollerId || 'age-roller');
    if (!r) return 22;
    const floor = minAge != null ? minAge : Number(r.dataset.minAge || 18);
    const idx   = Math.round(r.scrollTop / 44);
    return Math.max(floor, floor + idx);
  }

  async function handleSetupContinue() {
    const raw         = (document.getElementById('setup-username-input')?.value || '').trim();
    const displayName = raw || ('Player #' + Math.floor(1000 + Math.random() * 9000));

    // 1. Write to localStorage first
    localStorage.setItem('zelo_display_name', displayName);
    const age = readAge('age-roller', 18);
    localStorage.setItem('zelo_user_age', String(age));
    localStorage.setItem('zelo_setup_done', '1');

    // Force deck to re-filter by age pool on next practice tab visit
    if (typeof state !== 'undefined' && state.swipeProfiles) {
      state.swipeIndex = state.swipeProfiles.length;
    }

    // 2. Insert profile row to Supabase after localStorage is written
    const userId = _session?.user?.id;
    if (userId) {
      const { error } = await zeloSupabase.from('profiles').insert({
        id:           userId,
        display_name: displayName,
        age:          age
      });
      if (error && error.code !== "23505") console.error("profile insert failed", error.code);
    }

    _hideAll();
    _resolvePending();
  }

  // ── Navigate to destination ────────────────────────────────────

  function _navigate(dest) {
    if      (dest === 'practice')        showTab('practice');
    else if (dest === 'chats')           showTab('chats');
    else if (dest === 'save-thread')     openThreadPicker();
    else if (dest === 'download-data')   openDownloadData();
  }

  function _resolvePending() {
    if (!_pending) return;
    const cb = _pending.cb;
    _pending = null;
    sessionStorage.removeItem('zelo_auth_dest');
    if (typeof cb === 'function') cb();
  }

  // ── Dismiss ────────────────────────────────────────────────────

  function dismiss() {
    _pending = null;
    sessionStorage.removeItem('zelo_auth_dest');
    const overlay = document.getElementById('auth-overlay');
    // Only the sheet-presented auth-overlay animates closed (slides the
    // sheet back down) — the verify/setup overlays (full-screen, no sheet)
    // just hide immediately, same as before.
    if (overlay && !overlay.hidden && overlay.classList.contains('auth-overlay--open')) {
      overlay.classList.remove('auth-overlay--open');
      setTimeout(() => _hideAll(), 320);
      return;
    }
    _hideAll();
  }

  // ── Sign out ───────────────────────────────────────────────────

  async function signOut() {
    // Force onboarding to replay after sign-out, independent of the
    // dev-mode wipe in script.js's DOMContentLoaded handler.
    localStorage.removeItem('zelo_onboarding_done');
    // Practice conversations persist across launches now, so they have to be
    // dropped here or the next person to sign in on this device would open
    // the Chats tab and find someone else's.
    if (typeof clearLocalChats === 'function') clearLocalChats();
    _explicitSignOut = true;
    await zeloSupabase.auth.signOut();
    location.reload();
  }

  // ── Account settings (Login & Security) ─────────────────────────

  function currentEmail() {
    return _session?.user?.email || '';
  }

  function currentUserId() {
    return _session?.user?.id || '';
  }

  // ── Forgot password (Profile & Login) ─────────────────────────────
  // ── Link a new email/password identity (Profile & Login → Sign-in
  // methods → Email → "Add Your Email") ─────────────────────────────
  // updateUser({email, password}) on an authenticated session with no
  // matching email yet routes through Supabase's real email-change
  // confirmation — same verifyOtp/resend surface as signup, just with
  // type: 'email_change' instead of 'signup'.
  let _pendingEmailChange = '';

  async function linkEmail(email, password) {
    const { error } = await zeloSupabase.auth.updateUser({ email, password });
    if (!error) _pendingEmailChange = email;
    return { error: error ? error.message : null };
  }

  async function verifyEmailChange(code) {
    const { error } = await zeloSupabase.auth.verifyOtp({ email: _pendingEmailChange, token: code, type: 'email_change' });
    if (!error) _pendingEmailChange = '';
    return { error: error ? error.message : null };
  }

  async function resendEmailChange() {
    if (!_pendingEmailChange) return { error: 'No pending email change.' };
    const { error } = await zeloSupabase.auth.resend({ type: 'email_change', email: _pendingEmailChange });
    return { error: error ? error.message : null };
  }

  // Deletes the profile row this client can reach via RLS, then wipes all
  // local data and signs out. Full purge of the auth credential itself
  // (email/password record) requires the Supabase admin API, which must
  // run server-side (e.g. a service-role Edge Function) — not something a
  // client with only the anon key can safely do. That backend job is what
  // actually fulfills the "deleted within 30 days" promise in the
  // confirmation modal.
  // Real deletion happens server-side in one call (delete_my_account(): every table holding this
  // user's rows, then the sign-in identity itself — see supabase/migrations/…160000). If that
  // fails we must NOT wipe the phone and act as if it worked: report the error and stay signed in.
  async function deleteAccount() {
    if (_session?.user?.id) {
      let error = null;
      try { ({ error } = await zeloSupabase.rpc('delete_my_account')); } catch (e) { error = e; }
      if (error) return { error: error.message || String(error) };
    }
    localStorage.clear();
    _explicitSignOut = true;
    try { await zeloSupabase.auth.signOut({ scope: 'local' }); } catch (_) { /* the auth user is gone server-side */ }
    location.reload();
    return { error: null };
  }

  // ── Public API ─────────────────────────────────────────────────

  return {
    init,
    signedIn,
    requireAuth,
    startFromOnboarding,
    startSignIn,
    showEmailScreen,
    showEmailStep,
    backToPicker,
    handleEmailSubmit,
    handleForgotPassword,
    closeForgot,
    sendForgot,
    handleResetSubmit,
    handleResetResend,
    backFromReset,
    toggleEmailMode,
    rememberAuthState,
    backFromVerify,
    handleVerifySubmit,
    handleResendCode,
    signInWithApple,
    signInWithGoogle,
    handleSetupContinue,
    initAgeRoller,
    readAge,
    signOut,
    dismiss,
    currentEmail,
    currentUserId,
    startPasswordReset,
    bindCodeRow,
    ensureProfile,
    linkEmail,
    verifyEmailChange,
    resendEmailChange,
    deleteAccount
  };
})();
