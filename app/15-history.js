// ================================================================
// 15-history.js — Account, what the user has paid for, and saved scans
//
// The Account dashboard, the entitlement seam (getEntitlement/isPaidUser —
// the one place a real subscription plugs in), free-tier limits, saved scan
// threads, the History screen and the paywall.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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
  _refreshProfilePhotoEverywhere();

  // Stats — lifetime persisted counts (matchCount() survives reload; chatStore doesn't)
  document.getElementById('stat-scans').textContent   = scanCount;
  document.getElementById('stat-matches').textContent = matchCount();
  document.getElementById('stat-chats').textContent   =
    chatStore.filter(c => c.messages.length > 0).length;

  _renderProSummary();
  _refreshRetentionPreview();
  pushScreen('dashboard');
}

// ================================================================
// PAID STATUS / TRIAL
// No auth or paywall exists yet — isPaidUser() is a stub flag for testing.
// Trial start is stamped on first-ever app launch since there's no account
// creation moment yet to anchor it to.
// ================================================================

// ── ENTITLEMENT SEAM ────────────────────────────────────────────
// The ONE place a real subscription plugs in. When StoreKit/RevenueCat lands,
// getEntitlement() reads the verified receipt/server row and
// ENTITLEMENT_UNLOCK_ALL goes to false — nothing else in the app needs to
// change, because isPaidUser(), subscriptionExpired() and every screen that
// shows plan state all read through here.
//
// Until then ENTITLEMENT_UNLOCK_ALL is true: there is no way to buy anything,
// so gating features behind a purchase would just wall users out of an app
// they cannot pay for. What it must NOT do is make the UI *claim* a
// subscription exists — getEntitlement() reports the truth (active: false),
// which is what the Zelo Pro screen and the Settings card display.
const ENTITLEMENT_UNLOCK_ALL = true;

function getEntitlement() {
  // Shape kept deliberately close to a RevenueCat entitlement so wiring it up
  // is a body swap, not a refactor of every caller.
  return {
    active:     false,
    plan:       null,   // 'annual' | 'monthly'
    priceLabel: null,   // e.g. 'THB 999 / year'
    renewsAt:   null,   // ms epoch
    // Real today: ensureTrialStarted() stamps zelo_trial_start on first launch
    // and isWithinTrial() measures FREE_LIMITS.trialDays from it. Nothing gates
    // on it yet (ENTITLEMENT_UNLOCK_ALL is true), but it is the correct value
    // and StoreKit's own introductory-offer state replaces it later.
    inTrial:    isWithinTrial(),
    source:     'none'  // 'storekit' | 'revenuecat' | 'none'
  };
}

function isPaidUser() {
  return ENTITLEMENT_UNLOCK_ALL || getEntitlement().active;
}

// Settings' Zelo Pro card + the Zelo Pro screen, both rendered from
// getEntitlement() so neither can drift back into claiming a plan that
// isn't there.
function _renderProSummary() {
  const ent = getEntitlement();
  const sub  = document.getElementById('settings2-pro-sub');
  const link = document.getElementById('settings2-manage-link');
  if (sub)  sub.textContent  = ent.active ? [ent.plan === 'monthly' ? 'Monthly plan' : 'Annual plan', ent.priceLabel].filter(Boolean).join(' · ') : 'No active subscription';
  if (link) link.textContent = ent.active ? 'Manage subscription \u203a' : 'See plans \u203a';
}

function openSettingsZeloPro() {
  const ent = getEntitlement();
  const name  = document.getElementById('pro-plan-name');
  const price = document.getElementById('pro-plan-price');
  const renew = document.getElementById('pro-plan-renew');
  const cta   = document.getElementById('pro-plan-cta');
  const hero  = document.getElementById('pro-hero-sub');
  if (name)  name.textContent = ent.active ? (ent.plan === 'monthly' ? 'Monthly Plan' : 'Annual Plan') : 'No active subscription';
  if (price) { price.textContent = ent.priceLabel || ''; price.hidden = !ent.priceLabel; }
  if (renew) {
    renew.textContent = ent.active && ent.renewsAt
      ? 'Renews on ' + new Date(ent.renewsAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Manage or cancel any subscription in the App Store.';
  }
  if (cta)  cta.textContent  = ent.active ? 'Change Plan' : 'See Plans';
  if (hero) hero.textContent = ent.active ? "You're getting the most out of Zelo." : 'Everything Zelo Pro unlocks.';
  pushScreen('settings-zelo-pro');
}

// ── Expired-subscription LOCK (Cal AI style) ─────────────────────────────
// When the subscription has ended the app still opens and Home (Scan) stays visible, but
// everything that does something sends the user to the paywall. Still reachable while locked:
// Settings/Account and the Streak (Journey + badges — view only; nothing here updates it).
// Reads the entitlement seam above. While ENTITLEMENT_UNLOCK_ALL is true nothing
// can expire (there is nothing to buy), so the locked app is unreachable by
// design — it is not dead code, it is waiting on the same one switch.
function subscriptionExpired() {
  if (ENTITLEMENT_UNLOCK_ALL) return false;
  const ent = getEntitlement();
  return !ent.active && !ent.inTrial;
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
    localStorage.setItem('zelo_scan_exhausted', '0');
  }
}

function scansRemainingToday() {
  if (isPaidUser()) return Infinity;
  return Number(localStorage.getItem('zelo_scan_count') || 0);
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

function refreshScanLimitBanner() {
  const banner = document.getElementById('scan-limit-banner');
  const text   = document.getElementById('scan-limit-text');
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

// Pure read. Retention is enforced by pruneExpiredScans() — once at launch and
// again whenever the setting changes — NOT from in here: getThreads() is called
// from dozens of render paths, and deleting the user's history as a side effect
// of reading it made every render a destructive write.
function getThreads() {
  try { return JSON.parse(localStorage.getItem('zelo_threads') || '[]'); }
  catch { return []; }
}

// ms a scan is allowed to live, or null for "keep forever" / nothing chosen yet.
// An unset preference deliberately prunes nothing: the user never asked for a
// 30-day window just because the settings row happens to display one.
function _retentionWindowMs() {
  const pref = localStorage.getItem('zelo_history_retention_days');
  if (!pref || pref === 'forever') return null;
  const days = Number(pref);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days * 24 * 60 * 60 * 1000;
}

// How many stored scans the given retention choice would delete right now.
// Used to confirm before shortening the window (see settingsRetentionSelect).
function retentionDeleteCount(value) {
  if (!value || value === 'forever') return 0;
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return 0;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return getThreads().reduce((total, thread) => total
    + (Array.isArray(thread.scans) ? thread.scans.filter(sc => sc.time && Number(sc.time) < cutoff).length : 0), 0);
}

// Deletes scans older than the chosen window, and any thread left with none.
// Scans with no timestamp are kept — we can't prove they are expired, and
// guessing would silently destroy data.
function pruneExpiredScans() {
  const windowMs = _retentionWindowMs();
  if (!windowMs) return 0;
  const cutoff = Date.now() - windowMs;
  const threads = getThreads();
  let removed = 0;
  const kept = [];
  threads.forEach(thread => {
    const scans = Array.isArray(thread.scans) ? thread.scans : [];
    const fresh = scans.filter(sc => !sc.time || Number(sc.time) >= cutoff);
    removed += scans.length - fresh.length;
    // A thread that had scans and now has none is gone; one that never had any
    // (a freshly created, still-empty thread) is left alone.
    if (fresh.length || !scans.length) kept.push(fresh.length === scans.length ? thread : { ...thread, scans: fresh });
  });
  if (removed) { try { localStorage.setItem('zelo_threads', JSON.stringify(kept)); } catch (e) {} }
  return removed;
}
function saveThreads(arr) { localStorage.setItem('zelo_threads', JSON.stringify(arr)); }
function getThreadCount()  { return Number(localStorage.getItem('zelo_thread_count') || 0); }
function setThreadCount(n) { localStorage.setItem('zelo_thread_count', String(n)); }

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

// ─── Swipe-to-delete helpers (threads + chats) ─────────────────────────────

function showDeleteConfirm(message, onConfirm) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'mini-modal-overlay';
  overlay.innerHTML = `
    <div class="mini-modal-card">
      <p class="mini-modal-body">${_escapeHtml(message)}</p>
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
          <span class="history-row-name">${_escapeHtml(thread.name)}</span>
          <span class="history-row-time">${_scanHistoryTime(activity.time)}</span>
        </div>
        <span class="history-row-preview">${_escapeHtml(activity.text)}</span>
        <span class="history-row-pill" style="background:${styleColor.bg};color:${styleColor.accent}">${_escapeHtml(pillLabel)}</span>
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
  renderPaywallPrices();
  ZeloAnalytics.track('paywall_viewed', { screen: subscriptionExpired() ? 'locked' : 'paywall', plan: 'annual', price: PAYWALL_ANNUAL_LABEL });
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
    const overlayRect = _rectA(overlay);
    const targetRect = _rectA(stepIcon);
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
      <div class="thread-scan-msg">${_escapeHtml(scan.message)}</div>
      <div class="thread-scan-reply">${_escapeHtml(scan.reply)}</div>
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

function closeThreadDetail() {
  state.activeThreadId = null;
  state.threadChat     = [];
  if (_restoreHistoryReturn()) return;
  popScreen();
}


// ================================================================
