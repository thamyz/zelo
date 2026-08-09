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

  const OVERLAY_IDS = ['auth-overlay', 'auth-verify-overlay', 'auth-setup-overlay'];

  // ── Overlay helpers ────────────────────────────────────────────

  function _showOverlay(id) {
    OVERLAY_IDS.forEach(oid => {
      const el = document.getElementById(oid);
      if (el) el.hidden = (oid !== id);
    });
  }

  function _hideAll() {
    OVERLAY_IDS.forEach(oid => {
      const el = document.getElementById(oid);
      if (el) el.hidden = true;
    });
  }

  // ── Init ───────────────────────────────────────────────────────

  async function init() {
    const { data } = await zeloSupabase.auth.getSession();
    _session     = data.session;
    _initialized = true;

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

    zeloSupabase.auth.onAuthStateChange((event, session) => {
      _session = session;
      if (event === 'SIGNED_IN')  _onSignedIn();
      if (event === 'SIGNED_OUT') _session = null;
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

  // ── Sign in / create account screen ─────────────────────────────

  function showEmailScreen(mode) {
    _emailMode = mode || 'signup';
    _renderEmailScreen();
    _showOverlay('auth-overlay');
  }

  function _renderEmailScreen() {
    const el = document.getElementById('auth-overlay');
    if (!el) return;
    const isSignup = _emailMode === 'signup';

    el.querySelector('#auth-heading').textContent = isSignup ? 'Create your account' : 'Welcome back';
    el.querySelector('#auth-subtext').textContent  = isSignup
      ? 'Start practicing real conversations in seconds.'
      : 'Sign in to pick up where you left off.';

    const nameWrap    = el.querySelector('#auth-name-wrap');
    const confirmWrap = el.querySelector('#auth-confirm-wrap');
    const termsWrap   = el.querySelector('#auth-terms-wrap');
    if (nameWrap)    nameWrap.hidden    = !isSignup;
    if (confirmWrap) confirmWrap.hidden = !isSignup;
    if (termsWrap)   termsWrap.hidden   = !isSignup;

    el.querySelector('#auth-submit-btn').textContent = isSignup ? 'Create account' : 'Sign in';
    el.querySelector('#auth-toggle-btn').textContent = isSignup
      ? 'Already have an account? Sign in'
      : "Don't have an account? Sign up";
    el.querySelector('#auth-divider span').textContent = isSignup ? 'or sign up with' : 'or';

    const errEl = el.querySelector('#auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
    const provErrEl = el.querySelector('#auth-provider-error');
    if (provErrEl) provErrEl.textContent = '';

    const nameInput  = el.querySelector('#auth-name-input');
    const emailInput = el.querySelector('#auth-email-input');
    const passInput  = el.querySelector('#auth-password-input');
    const confInput  = el.querySelector('#auth-confirm-input');
    const termsCheck = el.querySelector('#auth-terms-checkbox');
    if (nameInput)  nameInput.value  = '';
    if (emailInput) emailInput.value = '';
    if (passInput)  passInput.value  = '';
    if (confInput)  confInput.value  = '';
    if (termsCheck) termsCheck.checked = false;
  }

  async function handleEmailSubmit() {
    const name     = (document.getElementById('auth-name-input')?.value     || '').trim();
    const email    = (document.getElementById('auth-email-input')?.value    || '').trim();
    const password =  document.getElementById('auth-password-input')?.value || '';
    const errEl    =  document.getElementById('auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Please fill in all fields.';
      return;
    }

    if (_emailMode === 'signup') {
      if (!name) {
        if (errEl) errEl.textContent = 'Please enter your name.';
        return;
      }
      const confirm = document.getElementById('auth-confirm-input')?.value || '';
      if (password !== confirm) {
        if (errEl) errEl.textContent = 'Passwords do not match.';
        return;
      }
      if (!document.getElementById('auth-terms-checkbox')?.checked) {
        if (errEl) errEl.textContent = 'Please agree to the Terms & Conditions to continue.';
        return;
      }
      // Written before the network call, not after: when confirmation is
      // disabled, signUp() can fire the SIGNED_IN listener (which reads this
      // key to prefill the setup screen) before an await-after write would
      // land — same "localStorage first" ordering handleSetupContinue() uses.
      localStorage.setItem('zelo_display_name', name);

      const { data, error } = await zeloSupabase.auth.signUp({
        email, password,
        options: { data: { display_name: name } }
      });
      if (error) { if (errEl) errEl.textContent = error.message; return; }

      if (!data?.session) {
        // Email confirmation is required before a session is issued —
        // send the user to the verification-code screen.
        _showVerifyScreen(email);
      }
      // else: confirmation is disabled on this project, session issued
      // immediately, onAuthStateChange fires SIGNED_IN → _onSignedIn()
    } else {
      const { error } = await zeloSupabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (_isUnconfirmedEmailError(error)) {
          await zeloSupabase.auth.resend({ type: 'signup', email }).catch(() => {});
          _showVerifyScreen(email);
          return;
        }
        if (errEl) errEl.textContent = error.message;
        return;
      }
    }
    // onAuthStateChange fires SIGNED_IN → _onSignedIn()
  }

  function _isUnconfirmedEmailError(error) {
    if (error?.code === 'email_not_confirmed') return true;
    return /not confirmed/i.test(error?.message || '');
  }

  async function handleForgotPassword() {
    const email = (document.getElementById('auth-email-input')?.value || '').trim();
    const errEl = document.getElementById('auth-email-error');
    if (!email) {
      if (errEl) errEl.textContent = 'Enter your email address first.';
      return;
    }
    const { error } = await zeloSupabase.auth.resetPasswordForEmail(email);
    if (errEl) {
      errEl.textContent = error ? error.message : 'Check your email for a reset link.';
      errEl.style.color = error ? '' : '#22c55e';
    }
  }

  function toggleEmailMode() {
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

  function _codeInputs() {
    return Array.from(document.querySelectorAll('#auth-code-row .auth-code-input'));
  }

  let _codeInputsBound = false;
  function _initCodeInputs() {
    if (_codeInputsBound) return;
    _codeInputsBound = true;
    const inputs = _codeInputs();
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

  function _readCode() {
    return _codeInputs().map(inp => inp.value).join('');
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

  function _onSignedIn() {
    if (!localStorage.getItem('zelo_setup_done')) {
      _showSetupScreen();
    } else {
      // Returning user — sync profile from Supabase into localStorage then navigate
      _loadProfileIntoLocalStorage().then(() => {
        _hideAll();
        _resolvePending();
      });
    }
  }

  async function _loadProfileIntoLocalStorage() {
    const userId = _session?.user?.id;
    if (!userId) return;
    const { data, error } = await zeloSupabase
      .from('profiles')
      .select('display_name, age')
      .eq('id', userId)
      .single();
    if (data && !error) {
      if (data.display_name) localStorage.setItem('zelo_display_name', data.display_name);
      if (data.age != null)  localStorage.setItem('zelo_user_age', String(data.age));
    }
  }

  // ── Setup screen ───────────────────────────────────────────────

  function _showSetupScreen() {
    _showOverlay('auth-setup-overlay');
    _initAgeRoller();
    // Prefill with the name already chosen during onboarding, if any —
    // avoids asking twice.
    const nameInput = document.getElementById('setup-username-input');
    const existing  = localStorage.getItem('zelo_display_name');
    if (nameInput && existing) nameInput.value = existing;
  }

  function _initAgeRoller() {
    const roller = document.getElementById('age-roller');
    if (!roller) return;
    roller.removeEventListener('scroll', _onRollerScroll);
    roller.innerHTML = '';

    // 2 ghost items top → age 18 can sit at center when scrollTop=0
    for (let i = 0; i < 2; i++) {
      const g = document.createElement('div');
      g.className = 'age-roller-item age-roller-ghost';
      roller.appendChild(g);
    }
    for (let age = 18; age <= 40; age++) {
      const item = document.createElement('div');
      item.className = 'age-roller-item';
      item.dataset.age = age;
      item.textContent = age;
      roller.appendChild(item);
    }
    // 2 ghost items bottom → age 40 can sit at center when scrollTop=max
    for (let i = 0; i < 2; i++) {
      const g = document.createElement('div');
      g.className = 'age-roller-item age-roller-ghost';
      roller.appendChild(g);
    }

    // Default: age 22  (scrollTop = (22-18) * 44 = 176)
    requestAnimationFrame(() => {
      roller.scrollTop = (22 - 18) * 44;
    });
    roller.addEventListener('scroll', _onRollerScroll, { passive: true });
  }

  function _onRollerScroll() {
    const roller = document.getElementById('age-roller');
    if (!roller) return;
    const age    = _readAge(roller);
    const warnEl = document.getElementById('age-warn');
    if (warnEl) warnEl.textContent = age < 18 ? 'Zelo is for users 18 and older.' : '';
  }

  function _readAge(roller) {
    const r   = roller || document.getElementById('age-roller');
    if (!r) return 22;
    const idx = Math.round(r.scrollTop / 44);
    return Math.max(18, 18 + idx);
  }

  async function handleSetupContinue() {
    const raw         = (document.getElementById('setup-username-input')?.value || '').trim();
    const displayName = raw || ('Player #' + Math.floor(1000 + Math.random() * 9000));

    // 1. Write to localStorage first
    localStorage.setItem('zelo_display_name', displayName);
    const age = _readAge();
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
    }

    _hideAll();
    _resolvePending();
  }

  // ── Navigate to destination ────────────────────────────────────

  function _navigate(dest) {
    if      (dest === 'practice')    showTab('practice');
    else if (dest === 'chats')       showTab('chats');
    else if (dest === 'save-thread') openThreadPicker();
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
    _hideAll();
  }

  // ── Sign out ───────────────────────────────────────────────────

  async function signOut() {
    // Force onboarding to replay after sign-out, independent of the
    // dev-mode wipe in script.js's DOMContentLoaded handler.
    localStorage.removeItem('zelo_onboarding_done');
    await zeloSupabase.auth.signOut();
    location.reload();
  }

  // ── Account settings (Login & Security) ─────────────────────────

  function currentEmail() {
    return _session?.user?.email || '';
  }

  async function changeEmail(newEmail) {
    const { error } = await zeloSupabase.auth.updateUser({ email: newEmail });
    return { error: error ? error.message : null };
  }

  async function changePassword(newPassword) {
    const { error } = await zeloSupabase.auth.updateUser({ password: newPassword });
    return { error: error ? error.message : null };
  }

  // Deletes the profile row this client can reach via RLS, then wipes all
  // local data and signs out. Full purge of the auth credential itself
  // (email/password record) requires the Supabase admin API, which must
  // run server-side (e.g. a service-role Edge Function) — not something a
  // client with only the anon key can safely do. That backend job is what
  // actually fulfills the "deleted within 30 days" promise in the
  // confirmation modal.
  async function deleteAccount() {
    const userId = _session?.user?.id;
    if (userId) {
      try { await zeloSupabase.from('profiles').delete().eq('id', userId); } catch (_) { /* best effort */ }
    }
    localStorage.clear();
    await zeloSupabase.auth.signOut();
    location.reload();
  }

  // ── Public API ─────────────────────────────────────────────────

  return {
    init,
    signedIn,
    requireAuth,
    showEmailScreen,
    handleEmailSubmit,
    handleForgotPassword,
    toggleEmailMode,
    backFromVerify,
    handleVerifySubmit,
    handleResendCode,
    signInWithApple,
    signInWithGoogle,
    handleSetupContinue,
    signOut,
    dismiss,
    currentEmail,
    changeEmail,
    changePassword,
    deleteAccount
  };
})();
