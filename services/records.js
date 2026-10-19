// Structured records written to Supabase (separate from PostHog's behavior
// analytics): consent_records and generated_replies. Schema:
// supabase/migrations/20260926120000_content_and_compliance_tables.sql
//
// Everything here is best-effort and must never break the app — every call is
// wrapped, and if the tables don't exist yet (migration not applied) or the
// user isn't signed in, it simply does nothing / keeps the record queued.
//
// NOT stored: the pasted text, the screenshot, or a Scan conversation. Only the
// AI output (generated_text) plus its tone and input *source* (text|screenshot).
// ONE deliberate exception: when a user taps "Send report" on a practice chat, that
// chat's messages are sent with the report (submitChatReport). It is an explicit
// action behind a sheet that says so, never automatic.
const ZeloRecords = (() => {
  // Bump whenever the Terms / Privacy Policy text changes, so a consent row
  // proves WHICH version was accepted. PLACEHOLDER value — set it to whatever
  // version identifier the published legal pages use.
  const POLICY_VERSION = '2026-09-26';

  // Kill switch for saving AI outputs server-side (there is no in-app
  // "AI processing" consent screen to gate it on yet — see CLAUDE.md).
  const SAVE_GENERATED_REPLIES = true;

  const CONSENT_QUEUE_KEY = 'zelo_pending_consents';
  const REPORT_QUEUE_KEY  = 'zelo_pending_reports';
  const REPORT_QUEUE_CAP  = 20;           // conversations are big; localStorage is ~5 MB
  const QUEUE_CAP = 50;
  let _flushing = false;

  // DEV: shows the outcome of the last database write next to the build stamp at the
  // bottom of the screen (only exists while SHOW_BUILD_STAMP is on), so a silent
  // failure — signed out, missing table, RLS — is visible without a debugger.
  function _status(msg) {
    try {
      const el = document.getElementById('zelo-build-stamp');
      if (el) el.textContent = (el.dataset.base || '') + ' | db: ' + String(msg).slice(0, 90);
    } catch (e) {}
  }

  function _uid() { return (typeof AUTH !== 'undefined' && AUTH.currentUserId) ? AUTH.currentUserId() : ''; }
  function _newId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function _queue() { try { return JSON.parse(localStorage.getItem(CONSENT_QUEUE_KEY) || '[]'); } catch (e) { return []; } }
  function _saveQueue(q) { try { localStorage.setItem(CONSENT_QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_CAP))); } catch (e) {} }

  // Consent is often given BEFORE the user has an account (onboarding's terms
  // checkbox comes before sign-in), so it is queued locally with the moment it
  // was actually given, and written as soon as there is a session.
  function recordConsent(consentType, granted) {
    try {
      const q = _queue();
      q.push({ id: _newId(), consent_type: consentType, granted: !!granted, timestamp: new Date().toISOString(), policy_version: POLICY_VERSION });
      _saveQueue(q);
      flushConsents();
    } catch (e) {}
  }

  async function flushConsents() {
    try {
      const userId = _uid();
      const q = _queue();
      if (!userId && q.length) _status('consent queued (signed out)');
      if (userId) { flushOnboarding(); flushReports(); if (typeof ZeloSupport !== 'undefined') ZeloSupport.flush(); if (typeof ZeloActivity !== 'undefined') ZeloActivity.sync(); }
      if (!userId || _flushing || typeof zeloSupabase === 'undefined') return;
      if (!q.length) return;
      _flushing = true;
      // Client-generated ids + ignore-duplicates make a retry after a lost
      // response harmless (no double rows).
      const { error } = await zeloSupabase.from('consent_records')
        .upsert(q.map(r => ({ ...r, user_id: userId })), { onConflict: 'id', ignoreDuplicates: true });
      if (!error) {
        const sent = new Set(q.map(r => r.id));
        _saveQueue(_queue().filter(r => !sent.has(r.id)));
        _status('consent saved');
      } else {
        _status('consent error: ' + (error.message || error.code || 'unknown'));
      }
    } catch (e) { /* stays queued, retried on next sign-in / launch */ }
    finally { _flushing = false; }
  }

  // Reinstall / new device: the local "have they been asked / what did they choose" memory is gone,
  // but the choice is on the server (consent_records, append-only). Read the LATEST practice
  // consent back so the first-chat modal doesn't ask again and the Settings toggle shows the truth.
  // A choice still waiting in the local queue is newer than anything on the server, so it wins.
  async function syncPracticeConsent() {
    try {
      const userId = _uid();
      if (!userId || typeof zeloSupabase === 'undefined') return;
      if (_queue().some(r => r.consent_type === 'practice_content_review')) return;
      const { data, error } = await zeloSupabase.from('consent_records')
        .select('granted')
        .eq('user_id', userId).eq('consent_type', 'practice_content_review')
        .order('timestamp', { ascending: false }).limit(1);
      if (error || !data || !data.length) return;
      localStorage.setItem('zelo_practice_review', String(!!data[0].granted));
      localStorage.setItem('zelo_practice_review_asked', '1');
    } catch (e) { /* offline: keep whatever is stored locally */ }
  }

  // ── Onboarding answers -> onboarding_responses ────────────────────────────
  // The answers are given before there is an account, so the latest snapshot is kept on the phone and
  // written (upsert, one row per user+question) as soon as there is a session. NOT uploaded: `attracted`
  // — it is effectively sexual orientation, a special category of personal data that needs explicit
  // consent first (the analytics/sensitive-data consent screen), and `referral` is a code, not an answer.
  // 'style_variant' is the onboarding A/B arm the account was shown — kept
  // here as well as in PostHog so a signed-up user's arm survives on our own
  // side (PostHog is what captures the people who never sign up at all).
  const ONBOARDING_KEYS = ['gender', 'source', 'overthink', 'help', 'tone', 'style_variant'];
  const ONBOARDING_KEY = 'zelo_pending_onboarding';
  function queueOnboarding(answers) {
    try {
      const snap = {};
      ONBOARDING_KEYS.forEach(k => { const v = answers && answers[k]; if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) snap[k] = v; });
      if (!Object.keys(snap).length) return;
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(snap));
      flushOnboarding();
    } catch (e) {}
  }
  async function flushOnboarding() {
    try {
      const userId = _uid();
      if (!userId || typeof zeloSupabase === 'undefined') return;
      const raw = localStorage.getItem(ONBOARDING_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw);
      const rows = Object.entries(snap).map(([k, v]) => ({ user_id: userId, question_key: k, answer_value: Array.isArray(v) ? JSON.stringify(v) : String(v) }));
      const { error } = await zeloSupabase.from('onboarding_responses').upsert(rows, { onConflict: 'user_id,question_key' });
      if (!error && localStorage.getItem(ONBOARDING_KEY) === raw) localStorage.removeItem(ONBOARDING_KEY); // unchanged since -> done
    } catch (e) { /* stays queued */ }
  }

  // ── Reply feedback (👍/👎) on the reply's own row ────────────────────────
  function setReplyOutcome(id, outcome) {
    try {
      if (!id || !_uid() || typeof zeloSupabase === 'undefined') return;
      if (outcome !== 'helped' && outcome !== 'not_helped') return;
      zeloSupabase.from('scan_replies').update({ outcome, outcome_at: new Date().toISOString() }).eq('id', id).then(() => {}, () => {});
    } catch (e) {}
  }

  // ── AI request log (cost + reliability; NO content) ──────────────────────
  function logAiRequest(r) {
    try {
      const userId = _uid();
      if (!userId || typeof zeloSupabase === 'undefined') return;
      const int = v => (typeof v === 'number' && isFinite(v)) ? Math.round(v) : null;
      zeloSupabase.from('ai_usage_log').insert({
        user_id: userId, kind: String(r.kind || 'unknown'), model: r.model ? String(r.model).slice(0, 40) : null,
        prompt_tokens: int(r.promptTokens), completion_tokens: int(r.completionTokens), latency_ms: int(r.latencyMs),
        ok: !!r.ok, error_kind: r.errorKind || null,
      }).then(() => {}, () => {});
    } catch (e) {}
  }

  // Returns the new row's id (so a later copy can mark was_copied), or null.
  function saveGeneratedReply({ source, tone, text }) {
    try {
      const userId = _uid();
      if (SAVE_GENERATED_REPLIES && !userId) _status('reply NOT saved: signed out');
      if (!SAVE_GENERATED_REPLIES || !userId || typeof zeloSupabase === 'undefined') return null;
      if ((source !== 'text' && source !== 'screenshot') || !tone || !text) return null;
      const id = _newId();
      zeloSupabase.from('scan_replies')
        .insert({ id, user_id: userId, input_source: source, tone, generated_text: text })
        .then(({ error }) => _status(error ? 'reply error: ' + (error.message || error.code) : 'reply saved'),
              e => _status('reply error: ' + e));
      return id;
    } catch (e) { return null; }
  }

  // One row per practice session with METADATA only (persona, difficulty, mode, times,
  // how many messages the user sent, finished/abandoned). The chat TEXT is added only when
  // includeText is true — i.e. the user opted in ("Help Zelo get smarter"). The database
  // enforces the same rule: practice_messages inserts are rejected unless the user's latest
  // practice_content_review consent is granted, so consent has to be on the server first.
  async function savePracticeSession(s) {
    try {
      const userId = _uid();
      if (!userId || typeof zeloSupabase === 'undefined' || !s || !s.personaId) return;
      const id = _newId();
      const { error } = await zeloSupabase.from('practice_sessions').insert({
        id, user_id: userId, persona_id: String(s.personaId), difficulty: s.difficulty || null, mode: s.mode || null,
        started_at: new Date(s.startedAt).toISOString(), ended_at: new Date(s.endedAt).toISOString(),
        message_count: s.messageCount || 0, outcome: s.outcome,
      });
      if (error) { _status('session error: ' + (error.message || error.code)); return; }
      if (!s.includeText || !s.messages || !s.messages.length) { _status('session saved (no chat text)'); return; }
      for (let i = 0; i < 15 && _flushing; i++) await new Promise(r => setTimeout(r, 200));
      await flushConsents();
      const rows = s.messages.map(m => ({
        id: _newId(), user_id: userId, session_id: id, sender: m.sender === 'ai' ? 'persona' : 'user',
        body: String(m.text || ''), created_at: new Date(m.time || Date.now()).toISOString(),
      }));
      const r = await zeloSupabase.from('practice_messages').insert(rows);
      _status(r.error ? 'chat text error: ' + (r.error.message || r.error.code) : 'session + chat text saved');
    } catch (e) { /* best effort */ }
  }


  // ---- Reports about the AI ------------------------------------------------
  // The user reported a reply or a whole practice chat. The conversation travels with
  // it (capped) so the report can be understood. Queued locally when signed out or
  // offline, or when the table still lacks the new columns (migration
  // 20261018230000_chat_reports.sql not applied yet), and retried on sign-in/launch.
  function _reportQueue() { try { return JSON.parse(localStorage.getItem(REPORT_QUEUE_KEY) || '[]'); } catch (e) { return []; } }
  function _saveReportQueue(q) {
    try { localStorage.setItem(REPORT_QUEUE_KEY, JSON.stringify(q.slice(-REPORT_QUEUE_CAP))); }
    catch (e) { try { localStorage.setItem(REPORT_QUEUE_KEY, JSON.stringify(q.slice(-3))); } catch (e2) {} }
  }
  async function _sendReport(row) {
    const uid = _uid();
    if (!uid || typeof zeloSupabase === 'undefined') return false;
    const { error } = await zeloSupabase.from('content_reports').insert(Object.assign({}, row, { user_id: uid }));
    if (error) { _status('report not sent: ' + (error.message || error.code)); return false; }
    _status('report sent');
    return true;
  }
  async function flushReports() {
    try {
      const q = _reportQueue(); if (!q.length || !_uid()) return;
      const left = [];
      for (const row of q) { if (!(await _sendReport(row))) left.push(row); }
      _saveReportQueue(left);
    } catch (e) { /* stays queued */ }
  }
  // payload: { scope: 'message'|'chat', reason, note, personaId, messageId, messageText, conversation:[{id,sender,text,time}], build }
  async function submitChatReport(payload) {
    const row = {
      id: _newId(),
      reported_content_type: payload.scope === 'message' ? 'chat_message' : 'chat',
      reported_content_id: payload.messageId || payload.personaId || null,
      reason: String(payload.reason || 'other').slice(0, 60),
      note: payload.note ? String(payload.note).slice(0, 500) : null,
      persona_id: payload.personaId || null,
      message_id: payload.messageId || null,
      message_text: payload.messageText ? String(payload.messageText).slice(0, 4000) : null,
      conversation: (payload.conversation || []).slice(-120).map(m => ({ id: m.id || null, sender: m.sender, text: String(m.text || '').slice(0, 4000), time: m.time })),
      app_build: payload.build || null,
      created_at: new Date().toISOString(),
    };
    try { if (await _sendReport(row)) return 'sent'; } catch (e) {}
    const q = _reportQueue(); q.push(row); _saveReportQueue(q);
    return 'queued';
  }

  function markReplyCopied(id) {
    try {
      if (!id || !_uid() || typeof zeloSupabase === 'undefined') return;
      zeloSupabase.from('scan_replies').update({ was_copied: true }).eq('id', id).then(() => {}, () => {});
    } catch (e) {}
  }

  // Referrals — schema: supabase/migrations/20261019150000_referral_codes.sql (not yet applied as of
  // writing). The code is server-issued and persisted on profiles.referral_code, not invented client-side,
  // so a different account can actually resolve it back to this one. null = not signed in / not applied yet.
  let _myReferralCode = null;
  async function getMyReferralCode() {
    if (_myReferralCode) return _myReferralCode;
    if (!_uid() || typeof zeloSupabase === 'undefined') return null;
    try {
      const { data, error } = await zeloSupabase.rpc('my_referral_code');
      if (error || !data) return null;
      _myReferralCode = data;
      return data;
    } catch (e) { return null; }
  }
  // Called once, right after a NEW account is created, with whatever code the person typed in during
  // onboarding (if any). Silently does nothing for an empty/invalid/own/already-used code — never
  // reveals which case it was, so this can't be used to probe which codes are real.
  async function redeemReferralCode(code) {
    const c = String(code || '').trim();
    if (!c || !_uid() || typeof zeloSupabase === 'undefined') return false;
    try {
      const { data, error } = await zeloSupabase.rpc('redeem_referral_code', { p_code: c });
      return !error && data === true;
    } catch (e) { return false; }
  }

  return { POLICY_VERSION, submitChatReport, flushReports, recordConsent, flushConsents, syncPracticeConsent, queueOnboarding, flushOnboarding, setReplyOutcome, logAiRequest, saveGeneratedReply, markReplyCopied, savePracticeSession, getMyReferralCode, redeemReferralCode, status: _status };
})();
