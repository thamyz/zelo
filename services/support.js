// In-app support (Report a problem / Contact support) and the Feature Requests board.
// Schema + rules: supabase/migrations/20261019100000_support_and_feature_requests.sql
//
// Support messages carry a small diagnostics text block (build, device, recent error NAMES).
// It never contains chats, scans or anything the user typed elsewhere. The user can open it
// from the form before sending (see openSupportDiagnostics in script.js).
//
// Everything is best-effort: a failed send is queued and retried after sign-in, never lost
// silently and never thrown into the UI.
const ZeloSupport = (() => {
  const QUEUE_KEY = 'zelo_pending_support';
  const QUEUE_CAP = 10;

  function _uid() { return (typeof AUTH !== 'undefined' && AUTH.currentUserId) ? AUTH.currentUserId() : ''; }
  function _client() { return (typeof zeloSupabase !== 'undefined') ? zeloSupabase : null; }
  function _newId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function _queue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; } }
  function _saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_CAP))); } catch (e) {} }
  function _p2(n) { return String(n).padStart(2, '0'); }
  function _clock(t) { const d = new Date(t); return _p2(d.getHours()) + ':' + _p2(d.getMinutes()) + ':' + _p2(d.getSeconds()); }

  // The "txt file". Two shapes: a contact message gets the basics, a problem report also gets
  // what was happening in the app when it went wrong.
  function buildDiagnostics(kind) {
    const L = [];
    const build = (typeof BUILD_STAMP !== 'undefined') ? BUILD_STAMP : 'unknown';
    const dark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
      (document.documentElement.getAttribute('data-theme') !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    L.push(kind === 'problem' ? 'Zelo problem report log' : 'Zelo contact log');
    L.push('Written ' + new Date().toISOString());
    L.push('');
    L.push('build: ' + build);
    L.push('signed in: ' + (_uid() ? 'yes' : 'no'));
    L.push('online: ' + (navigator.onLine ? 'yes' : 'no'));
    L.push('device: ' + String(navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 160));
    L.push('screen: ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x');
    L.push('language: ' + (navigator.language || '') + '  timezone: ' + ((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || ''));
    L.push('theme: ' + (dark ? 'dark' : 'light'));
    if (kind === 'problem') {
      try {
        const st = (typeof state !== 'undefined') ? state : null;
        if (st) {
          const stack = (st.screenStack || []).concat(st.activeScreen ? [st.activeScreen] : []).slice(-6);
          L.push('');
          L.push('screens (oldest first): ' + (stack.join(' > ') || 'n/a'));
          L.push('tab: ' + (st.activeTab || 'n/a'));
          L.push('practice mode: ' + (localStorage.getItem('zelo_practice_mode') || 'n/a') + '  difficulty: ' + (st.difficulty || 'n/a'));
        }
      } catch (e) {}
      const errs = (window.__zeloErrLog || []).slice(-12);
      L.push('');
      L.push('recent errors (names only, newest last): ' + (errs.length ? '' : 'none'));
      errs.forEach(e => L.push('  ' + _clock(e.t) + '  ' + e.name + (e.where ? ' @ ' + e.where : '')));
    }
    return L.join('\n');
  }

  async function _sendRow(row) {
    const c = _client(), uid = _uid();
    if (!c || !uid) return { ok: false, reason: 'signed_out' };
    const { error } = await c.from('support_messages').insert(Object.assign({}, row, { user_id: uid }));
    if (error) {
      const m = String(error.message || '');
      if (/zelo:daily_limit/.test(m)) return { ok: false, reason: 'daily_limit' };
      return { ok: false, reason: 'error' };
    }
    return { ok: true };
  }

  // Returns 'sent' | 'queued' | 'limit'. 'queued' means saved on the phone and sent once there is
  // a session and a connection.
  async function sendSupport(kind, message) {
    const row = {
      id: _newId(),
      kind: kind === 'problem' ? 'problem' : 'contact',
      message: String(message || '').trim().slice(0, 4000),
      diagnostics: buildDiagnostics(kind).slice(0, 6000),
      app_build: (typeof BUILD_STAMP !== 'undefined') ? String(BUILD_STAMP).slice(0, 120) : null,
    };
    try {
      const r = await _sendRow(row);
      if (r.ok) return 'sent';
      if (r.reason === 'daily_limit') return 'limit';
    } catch (e) {}
    const q = _queue(); q.push(row); _saveQueue(q);
    return 'queued';
  }

  async function flush() {
    try {
      const q = _queue(); if (!q.length || !_uid()) return;
      const left = [];
      for (const row of q) { const r = await _sendRow(row); if (!r.ok && r.reason !== 'daily_limit') left.push(row); }
      _saveQueue(left);
    } catch (e) { /* stays queued */ }
  }

  // ── Feature requests ──
  function _errCode(error) {
    const m = String((error && error.message) || '');
    const hit = m.match(/zelo:(\w+)/);
    if (hit) return hit[1];
    if (!navigator.onLine || /failed to fetch|network|load failed/i.test(m)) return 'net';
    if (error && (error.code === '42501' || error.code === '42883' || error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205')) return 'unavailable';
    if (error && error.code === '23514') return 'invalid';
    return 'error';
  }

  async function listRequests(sort, query) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('list_feature_requests', { p_sort: sort === 'new' ? 'new' : 'top', p_query: String(query || '').trim().slice(0, 80), p_limit: 60 });
      if (error) return { error: _errCode(error) };
      return { items: data || [] };
    } catch (e) { return { error: 'net' }; }
  }

  async function toggleVote(requestId) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('toggle_feature_vote', { p_request: requestId });
      if (error) return { error: _errCode(error) };
      const row = Array.isArray(data) ? data[0] : data;
      return { voted: !!(row && row.voted), count: Number(row && row.vote_count) || 0 };
    } catch (e) { return { error: 'net' }; }
  }

  async function submitRequest(title, body) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.from('feature_requests').insert({ title: String(title || '').trim().slice(0, 120), body: String(body || '').trim().slice(0, 2000) }).select('id,status').single();
      if (error) return { error: _errCode(error) };
      return { id: data && data.id, status: (data && data.status) || 'live' };
    } catch (e) { return { error: 'net' }; }
  }

  // One request for its own page; null when it is gone (deleted, or held and not yours).
  async function getRequest(id) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('get_feature_request', { p_request: id });
      if (error) return { error: _errCode(error) };
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { item: row } : { item: null };
    } catch (e) { return { error: 'net' }; }
  }
  async function listComments(requestId) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('list_feature_comments', { p_request: requestId });
      if (error) return { error: _errCode(error) };
      return { items: data || [] };
    } catch (e) { return { error: 'net' }; }
  }
  async function addComment(requestId, body) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('add_feature_comment', { p_request: requestId, p_body: String(body || '').trim().slice(0, 1000) });
      if (error) return { error: _errCode(error) };
      return { item: Array.isArray(data) ? data[0] : data };
    } catch (e) { return { error: 'net' }; }
  }
  async function deleteComment(id) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try { const { error } = await c.rpc('delete_feature_comment', { p_comment: id }); return error ? { error: _errCode(error) } : { ok: true }; }
    catch (e) { return { error: 'net' }; }
  }
  async function updateRequest(id, title, body) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.rpc('update_feature_request', { p_request: id, p_title: String(title || '').trim().slice(0, 120), p_body: String(body || '').trim().slice(0, 2000) });
      if (error) return { error: _errCode(error) };
      const row = Array.isArray(data) ? data[0] : data;
      return { status: (row && row.status) || 'live' };
    } catch (e) { return { error: 'net' }; }
  }
  async function deleteRequest(id) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try { const { error } = await c.rpc('delete_feature_request', { p_request: id }); return error ? { error: _errCode(error) } : { ok: true }; }
    catch (e) { return { error: 'net' }; }
  }

  // AI review of a pending post / edit / comment (edge function moderate-feature-text). Never throws.
  // Returns {status} ('live' | 'held' | 'pending' when it could not be reviewed) or {error}.
  async function moderate(kind, id) {
    const c = _client();
    if (!c || !_uid()) return { error: 'signed_out' };
    try {
      const { data, error } = await c.functions.invoke('moderate-feature-text', { body: { kind: kind === 'comment' ? 'comment' : 'request', id } });
      if (error || !data) return { error: 'unavailable' };
      return { status: data.status || 'pending', reviewed: !!data.reviewed };
    } catch (e) { return { error: 'unavailable' }; }
  }

  return { moderate, buildDiagnostics, sendSupport, flush, listRequests, toggleVote, submitRequest, getRequest, listComments, addComment, deleteComment, updateRequest, deleteRequest };
})();
