// ================================================================
// 10-activity.js — what counts as using Zelo, and the streak maths
//
// A rolling log of real actions, the streak figures (current/best/this week)
// and the copy for each state. Home’s Activity widget and the Milestones
// page both read from here.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// ACTIVITY — real counts behind the Home "Your Activity" widget (rolling last 7 days, kept on the phone).
// Kinds: 'scan' (a scan that produced replies), 'reply' (each reply generated), 'like' (a practice profile liked).
// ================================================================
const ACTIVITY_KEY = 'zelo_activity_log';
const ACTIVITY_OWNER_KEY = 'zelo_activity_owner';
const ACTIVITY_DAYS_KEY = 'zelo_active_days';
const ACTIVITY_BEST_KEY = 'zelo_best_streak';
// Last streak length and badge set we reported, so the events below fire once
// per real change rather than on every render.
const ACTIVITY_SEEN_STREAK_KEY = 'zelo_streak_reported';
const ACTIVITY_SEEN_BADGES_KEY = 'zelo_badges_reported';
const ACTIVITY_WINDOW_MS = 7 * 24 * 3600 * 1000;
const ZeloActivity = {
  _syncing: false, _pulled: false, _flushTimer: null,
  _newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  },
  _read() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]'); } catch (_) {}
    let changed = false;
    log.forEach(e => { if (!e.id) { e.id = this._newId(); changed = true; } });
    if (changed) this._write(log);
    return log;
  },
  _write(log) { try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log.slice(-1000))); } catch (_) {} },
  // ---- Active days (one per calendar day with any activity) — what the streak is made of ----
  _dayKey(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },
  _days() {
    let days;
    try { days = JSON.parse(localStorage.getItem(ACTIVITY_DAYS_KEY) || 'null'); } catch (_) { days = null; }
    if (!Array.isArray(days)) { days = [...new Set(this._read().map(e => this._dayKey(e.t)))].sort(); this._writeDays(days); }
    return days;
  },
  _writeDays(days) { try { localStorage.setItem(ACTIVITY_DAYS_KEY, JSON.stringify(days.slice(-800))); } catch (_) {} },
  _addDay(key) { const d = this._days(); if (!d.includes(key)) { d.push(key); d.sort(); this._writeDays(d); } },
  // current = consecutive days ending today, or ending yesterday if today has nothing yet (still alive).
  streakInfo() {
    const days = new Set(this._days()), DAY = 86400000, today = this._dayKey(Date.now());
    const doneToday = days.has(today);
    let cur = 0, t = Date.now();
    if (!doneToday) t -= DAY;
    while (days.has(this._dayKey(t))) { cur++; t -= DAY; }
    let best = 0, run = 0, prev = null;
    [...days].sort().forEach(k => {
      const ms = Date.parse(k + 'T12:00:00');
      run = (prev !== null && Math.round((ms - prev) / DAY) === 1) ? run + 1 : 1;
      prev = ms; if (run > best) best = run;
    });
    let storedBest = 0; try { storedBest = parseInt(localStorage.getItem(ACTIVITY_BEST_KEY) || '0', 10) || 0; } catch (_) {}
    best = Math.max(best, storedBest, cur);
    if (best > storedBest) { try { localStorage.setItem(ACTIVITY_BEST_KEY, String(best)); } catch (_) {} }
    const week = []; for (let i = 6; i >= 0; i--) week.push(days.has(this._dayKey(Date.now() - i * DAY)));
    return { current: cur, doneToday, alive: cur > 0, hadStreak: best > 0, best, total: days.size, week, thisWeek: week.filter(Boolean).length };
  },
  // The words for each state. Short on purpose: they sit in small cards.
  streakCopy(s) {
    if (s.doneToday) return { sub: 'Done for today. Back tomorrow.', pill: 'Done today', journey: 'Done for today. See you tomorrow.' };
    if (s.alive) return { sub: 'Use Zelo today to keep it.', pill: 'Not done today', journey: 'Use Zelo today to keep your streak.' };
    if (s.hadStreak) return { sub: 'Your last streak ended.', pill: 'Start again', journey: 'Your last streak ended. Start a new one today.' };
    return { sub: 'Use Zelo today to start one.', pill: 'Start today', journey: 'Use Zelo today to start your streak.' };
  },
  add(kind) {
    const now = Date.now();
    const log = this._read().filter(e => now - e.t < 30 * 24 * 3600 * 1000);
    // Chatting adds one event per few minutes, not one per message (it only feeds the streak and the server log).
    if (kind === 'chat' && log.some(e => e.k === 'chat' && now - e.t < 5 * 60 * 1000)) return;
    log.push({ id: this._newId(), t: now, k: kind });
    this._write(log);
    this._addDay(this._dayKey(now));
    this.render();
    clearTimeout(this._flushTimer);
    this._flushTimer = setTimeout(() => this.sync(), 1500);
  },
  // Server copy (activity_events, owner-only). Local stays the source the widget reads, so the widget works
  // offline and signed out; events carry a client id so a retried upload can never double-count.
  async sync() {
    try {
      const uid = (typeof AUTH !== 'undefined' && AUTH.currentUserId) ? AUTH.currentUserId() : '';
      if (!uid || this._syncing || typeof zeloSupabase === 'undefined') return;
      this._syncing = true;
      // Another account on this phone must not inherit (or upload) the previous account's activity.
      const owner = localStorage.getItem(ACTIVITY_OWNER_KEY);
      if (owner && owner !== uid) { this._write([]); this._writeDays([]); try { localStorage.removeItem(ACTIVITY_BEST_KEY); } catch (_) {} this._pulled = false; }
      localStorage.setItem(ACTIVITY_OWNER_KEY, uid);
      let log = this._read();
      const unsynced = log.filter(e => !e.s);
      for (let i = 0; i < unsynced.length; i += 200) {
        const batch = unsynced.slice(i, i + 200);
        const { error } = await zeloSupabase.from('activity_events').upsert(
          batch.map(e => ({ id: e.id, user_id: uid, kind: e.k, created_at: new Date(e.t).toISOString() })),
          { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
        const ids = new Set(batch.map(e => e.id));
        log = this._read(); log.forEach(e => { if (ids.has(e.id)) e.s = 1; }); this._write(log);
      }
      if (!this._pulled) {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const { data, error } = await zeloSupabase.from('activity_events')
          .select('id,kind,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
        if (error) throw error;
        const have = new Set(this._read().map(e => e.id));
        const merged = this._read();
        (data || []).forEach(r => { if (!have.has(r.id)) merged.push({ id: r.id, t: Date.parse(r.created_at), k: r.kind, s: 1 }); });
        merged.sort((a, b) => a.t - b.t);
        this._write(merged);
        merged.forEach(e => this._addDay(this._dayKey(e.t)));
        this._pulled = true;
        this.render();
      }
    } catch (_) { /* stays local; tries again next time */ }
    finally { this._syncing = false; }
  },
  counts() {
    const since = Date.now() - ACTIVITY_WINDOW_MS, c = { scan: 0, reply: 0, like: 0 };
    this._read().forEach(e => { if (e.t >= since && e.k in c) c[e.k]++; });
    return c;
  },
  // What the widget's banner says. First match wins; every line is short so it fits on one line.
  bannerText() {
    const log = this._read(), now = Date.now(), DAY = 86400000;
    const week = log.filter(e => now - e.t < 7 * DAY);
    if (!week.length) return log.length ? 'Pick up again' : 'Start a scan';
    const last = Math.max(...week.map(e => e.t));
    if (now - last >= 2 * DAY) return 'Pick up again';
    const c = this.counts();
    if (c.like >= 5 && c.scan === 0) return 'Try a real scan';
    // consecutive calendar days with any activity, counting back from today (or yesterday if nothing yet today)
    const dayKey = t => { const d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
    const days = new Set(log.map(e => dayKey(e.t)));
    let streak = 0, cur = now;
    if (!days.has(dayKey(cur))) cur -= DAY;
    while (days.has(dayKey(cur))) { streak++; cur -= DAY; }
    if (streak >= 2) return streak + ' days in a row';
    const prev = log.filter(e => now - e.t >= 7 * DAY && now - e.t < 14 * DAY).length;
    if (prev > 0 && week.length > prev) return 'Up on last week';
    return 'Keep going!';
  },
  render() {
    const c = this.counts();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    set('act-replies', c.reply); set('act-scans', c.scan); set('act-likes', c.like);
    const bn = document.getElementById('act-banner');
    if (bn) bn.textContent = this.bannerText();
    const s = this.streakInfo(), cp = this.streakCopy(s), txt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    txt('streak-num', s.current); txt('streak-label', s.current === 1 ? 'day in a row' : 'days in a row');
    txt('streak-sub', cp.sub); txt('streak-widget-pill', cp.pill); txt('streak-pill-num', s.current);
    txt('journey-num', s.current); txt('journey-label', s.current === 1 ? 'day in a row' : 'days in a row');
    txt('journey-msg', cp.journey);
    const dayWord = n => n + (n === 1 ? ' day' : ' days');
    txt('journey-best', dayWord(s.best)); txt('journey-total', dayWord(s.total)); txt('journey-week', dayWord(s.thisWeek));
    txt('mission-streak', dayWord(s.current));
    const dots = document.getElementById('journey-dots');
    if (dots) dots.innerHTML = s.week.map(on => on
      ? '<span class="journey-dot journey-dot--done"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
      : '<span class="journey-dot journey-dot--upcoming"></span>').join('');
    document.querySelectorAll('.mission-stat-tile').forEach(t => {
      const l = t.querySelector('.mission-stat-label'), n = t.querySelector('.mission-stat-num');
      if (l && n && l.textContent.trim() === 'Scans') n.textContent = String(c.scan);
    });
    this._reportStreakChange(s);
    this._reportNewBadges();
  },

  // Fires once per real change. Numbers only — no content, same rule as the
  // rest of the analytics allowlist.
  _reportStreakChange(s) {
    try {
      const raw = localStorage.getItem(ACTIVITY_SEEN_STREAK_KEY);
      const seen = raw == null ? null : Number(raw);
      if (seen === s.current) return;
      localStorage.setItem(ACTIVITY_SEEN_STREAK_KEY, String(s.current));
      if (seen == null) return;                 // first run: record, don't report
      if (s.current > seen)      ZeloAnalytics.track('streak_incremented', { days: s.current });
      else if (s.current === 0)  ZeloAnalytics.track('streak_broken', { days: seen });
    } catch (e) { /* analytics must never break the app */ }
  },

  _reportNewBadges() {
    try {
      if (typeof MILESTONE_BADGES === 'undefined') return;
      const unlocked = MILESTONE_BADGES.filter(isBadgeUnlocked).map(b => b.id);
      let seen;
      try { seen = JSON.parse(localStorage.getItem(ACTIVITY_SEEN_BADGES_KEY) || 'null'); } catch (_) { seen = null; }
      localStorage.setItem(ACTIVITY_SEEN_BADGES_KEY, JSON.stringify(unlocked));
      if (!Array.isArray(seen)) return;         // first run: record, don't report
      const fresh = unlocked.filter(id => !seen.includes(id));
      fresh.forEach(id => ZeloAnalytics.track('badge_earned', { badge_id: id }));
    } catch (e) { /* analytics must never break the app */ }
  },
};
document.addEventListener('DOMContentLoaded', () => ZeloActivity.render());
document.addEventListener('visibilitychange', () => { if (!document.hidden) { ZeloActivity.render(); ZeloActivity.sync(); } });

let _lastScanSource = null;

// Server-side record of an AI suggestion (generated_replies): output + tone + input
// SOURCE only, never the input itself. Only fresh scans — demo scans and saved-scan
// replays (original source unknown) are not saved. The "couldn't reach Zelo" fallback
// text is not a suggestion, so it is skipped too.
const REPLY_FETCH_FAILED_TEXT = "Couldn't reach Zelo right now. Try again.";
function _saveGeneratedReply(style, reply) {
  if (!reply || reply === REPLY_FETCH_FAILED_TEXT) return;
  if (!state.asstInputSource) { ZeloRecords.status('reply not saved: demo/replay'); return; }
  ZeloActivity.add('reply');
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

  if (!isPaidUser() && scansRemainingToday() <= 0) {
    refreshScanLimitBanner();
    return;
  }

  // Instant, local check — flags genuine keyboard mashing before anything
  // else happens. No API call, so normal messages pay zero extra delay.
  if (userInput && _looksLikeGibberish(userInput)) {
    const proceed = await _confirmGibberish(userInput);
    if (!proceed) return; // user chose to edit — nothing consumed, no navigation
  }

  state.scanSavedToThread = false;
  state.scanSkippedSave   = false;

  // Analytics: source only ("text"/"screenshot") — never the content. Demo
  // (screen-recording) scans aren't real usage.
  _lastScanSource = hasImage ? 'screenshot' : 'text';
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
  if (_lastScanSource) { ZeloAnalytics.track('scan_completed', { source: _lastScanSource }); ZeloActivity.add('scan'); _lastScanSource = null; }
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
        const saved = document.createElement('p');
        saved.className = 'thread-save-q thread-save-success';
        saved.textContent = `Saved to "${preThr.name}" ✓`;
        tsp.replaceChildren(saved);
        tsp.hidden = false;
        setTimeout(() => { tsp.hidden = true; }, 1500);
      }
    }
    state.preselectThreadId = null;
  }
}


// ================================================================
