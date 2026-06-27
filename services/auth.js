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

  const OVERLAY_IDS = ['auth-overlay', 'auth-email-overlay', 'auth-setup-overlay'];

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
    _showProviderScreen();
  }

  // ── Provider screen ────────────────────────────────────────────

  function _showProviderScreen() {
    _showOverlay('auth-overlay');
  }

  function goBackToProviders() {
    _showProviderScreen();
  }

  // ── Email screen ───────────────────────────────────────────────

  function showEmailScreen(mode) {
    _emailMode = mode || 'signup';
    _renderEmailScreen();
    _showOverlay('auth-email-overlay');
  }

  function _renderEmailScreen() {
    const el = document.getElementById('auth-email-overlay');
    if (!el) return;
    const isSignup = _emailMode === 'signup';
    el.querySelector('.auth-email-title').textContent = isSignup ? 'Create your account' : 'Welcome back';
    const confirmWrap = el.querySelector('#auth-confirm-wrap');
    if (confirmWrap) confirmWrap.hidden = !isSignup;
    el.querySelector('#auth-submit-btn').textContent  = isSignup ? 'Create account' : 'Sign in';
    el.querySelector('#auth-toggle-btn').textContent  = isSignup
      ? 'Already have an account? Sign in'
      : "Don't have an account? Sign up";
    const errEl = el.querySelector('#auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }
    const emailInput = el.querySelector('#auth-email-input');
    const passInput  = el.querySelector('#auth-password-input');
    const confInput  = el.querySelector('#auth-confirm-input');
    if (emailInput) emailInput.value = '';
    if (passInput)  passInput.value  = '';
    if (confInput)  confInput.value  = '';
  }

  async function handleEmailSubmit() {
    const email    = (document.getElementById('auth-email-input')?.value    || '').trim();
    const password =  document.getElementById('auth-password-input')?.value || '';
    const errEl    =  document.getElementById('auth-email-error');
    if (errEl) { errEl.textContent = ''; errEl.style.color = ''; }

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Please fill in all fields.';
      return;
    }

    if (_emailMode === 'signup') {
      const confirm = document.getElementById('auth-confirm-input')?.value || '';
      if (password !== confirm) {
        if (errEl) errEl.textContent = 'Passwords do not match.';
        return;
      }
      const { error } = await zeloSupabase.auth.signUp({ email, password });
      if (error && errEl) { errEl.textContent = error.message; return; }
    } else {
      const { error } = await zeloSupabase.auth.signInWithPassword({ email, password });
      if (error && errEl) { errEl.textContent = error.message; return; }
    }
    // onAuthStateChange fires SIGNED_IN → _onSignedIn()
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

  // ── OAuth ──────────────────────────────────────────────────────

  async function signInWithApple() {
    const { error } = await zeloSupabase.auth.signInWithOAuth({ provider: 'apple' });
    if (error) _setProviderError(error.message);
  }

  async function signInWithGoogle() {
    const { error } = await zeloSupabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) _setProviderError(error.message);
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

  // ── Sign out ───────────────────────────────────────────────────

  async function signOut() {
    await zeloSupabase.auth.signOut();
    location.reload();
  }

  // ── Public API ─────────────────────────────────────────────────

  return {
    init,
    signedIn,
    requireAuth,
    goBackToProviders,
    showEmailScreen,
    handleEmailSubmit,
    handleForgotPassword,
    toggleEmailMode,
    signInWithApple,
    signInWithGoogle,
    handleSetupContinue,
    signOut
  };
})();
