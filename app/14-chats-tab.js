// ================================================================
// 14-chats-tab.js — the Chats list
//
// Rendering the list, saving conversations to localStorage so they survive a
// relaunch, the hold menu (pin/search/reset/delete) and search.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// CHATS TAB
// ================================================================

// Practice chat sessions. Persisted across launches (see loadChats/saveChats
// below) — this used to be a bare in-memory array, so every conversation was
// lost on relaunch and the Chats tab was empty every time the app opened.
let chatStore = [];

// ── Chat persistence ─────────────────────────────────────────────
// Stored SLIM: the persona is kept as an id and rehydrated from ALL_PROFILES
// on load, because the live chat object holds the whole persona — four photo
// paths and a long systemPrompt — which must not be duplicated into
// localStorage once per chat.
const CHATS_KEY       = 'zelo_chats';
const CHATS_OWNER_KEY = 'zelo_chats_owner';
const CHATS_MAX       = 30;    // most recent conversations kept
const CHAT_MSGS_MAX   = 300;   // most recent messages kept per conversation

// Everything that is part of the conversation's real state. Deliberately
// EXCLUDES `typing` and `replyFailed`: both describe an in-flight reply, and
// restoring them would show a permanent typing indicator or a stale error on
// a conversation that is no longer doing anything.
const _CHAT_SAVED_FIELDS = ['id', 'difficulty', 'mode', 'cardMode', 'lastMessage', 'lastActive',
  'unread', 'blocked', 'pinned', 'nudges', 'strikes', 'cleanRun', 'compCount', 'lastCompAt',
  'lastInviteAt', 'lastThreadAt', 'threadsUsed', 'threadPick', 'drive', 'status', 'scan'];

function _chatsOwner() {
  try {
    return (typeof AUTH !== 'undefined' && AUTH.currentUserId && AUTH.currentUserId()) || '';
  } catch (e) { return ''; }
}

function _serializeChats() {
  return chatStore.slice(0, CHATS_MAX).map(c => {
    const out = { profileId: c.profile && c.profile.id };
    _CHAT_SAVED_FIELDS.forEach(k => { if (c[k] !== undefined) out[k] = c[k]; });
    out.messages = (Array.isArray(c.messages) ? c.messages : []).slice(-CHAT_MSGS_MAX)
      .map(m => ({ id: m.id, sender: m.sender, text: m.text, time: m.time, replyToId: m.replyToId }));
    return out;
  }).filter(c => c.profileId);
}

let _chatsSaveTimer = null;

// Debounced: a single reply can touch the store several times in a few ms.
function saveChats() {
  clearTimeout(_chatsSaveTimer);
  _chatsSaveTimer = setTimeout(saveChatsNow, 400);
}

function saveChatsNow() {
  clearTimeout(_chatsSaveTimer);
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(_serializeChats()));
    const uid = _chatsOwner();
    if (uid) localStorage.setItem(CHATS_OWNER_KEY, uid);
  } catch (e) { /* quota or private mode — never break the app over a save */ }
}

// Called from AUTH.signOut() before it reloads, so the next person on this
// device does not inherit the previous account's conversations.
// AI Coach chats are NOT touched here: they live inside zelo_threads
// (thread.coachChat, written by _persistAiCoachChatToThread) alongside saved
// scan history, which sign-out has never cleared. Wiping that would be a
// separate behaviour change, not part of making practice chats persist.
function clearLocalChats() {
  chatStore = [];
  clearTimeout(_chatsSaveTimer);
  try {
    localStorage.removeItem(CHATS_KEY);
    localStorage.removeItem(CHATS_OWNER_KEY);
  } catch (e) {}
}

function loadChats() {
  try {
    // A different account on the same device must not inherit these. Only acts
    // when the current user is actually known — at launch AUTH.init() has not
    // resolved yet, and signOut() clears the keys itself.
    const uid = _chatsOwner();
    const owner = localStorage.getItem(CHATS_OWNER_KEY);
    if (uid && owner && owner !== uid) { clearLocalChats(); return; }

    const raw = JSON.parse(localStorage.getItem(CHATS_KEY) || '[]');
    if (!Array.isArray(raw)) return;
    chatStore = raw.map(c => {
      // A persona that no longer exists (roster edited between releases) would
      // otherwise render as an undefined avatar/name — drop that chat instead.
      const profile = (typeof ALL_PROFILES !== 'undefined' ? ALL_PROFILES : []).find(p => p.id === c.profileId);
      if (!profile) return null;
      const chat = { ...c, profile, messages: Array.isArray(c.messages) ? c.messages : [],
                     typing: false, replyFailed: null };
      delete chat.profileId;
      return chat;
    }).filter(Boolean);
  } catch (e) { chatStore = []; }
}

// Backgrounding is the last reliable moment before iOS can discard the web
// view, so flush immediately rather than waiting out the debounce.
document.addEventListener('visibilitychange', () => { if (document.hidden) saveChatsNow(); });
window.addEventListener('pagehide', saveChatsNow);

function initChatsTab() {
  renderChatsList();
}

function renderChatsList() {
  const list  = document.getElementById('chats-list');
  const empty = document.getElementById('chats-empty');
  if (!list) return;

  list.innerHTML = '';

  if (chatStore.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Pinned chats first; otherwise the store's own order (Array.sort is stable).
  [...chatStore].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).forEach(chat => {
    const profile = chat.profile;
    const grad = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-row-wrapper' + (chat.pinned ? ' chat-row-wrapper--pinned' : '');

    const row = document.createElement('div');
    row.className = 'chat-row' + (chat.pinned ? ' chat-row--pinned' : '');
    row.dataset.chatId = chat.id;
    // A press that matured into the hold menu must not also open the chat when the finger lifts.
    row.onclick = () => { if (Date.now() - (row._heldAt || 0) < 700) return; openChatFromStore(chat); };
    row.innerHTML = `
      <div class="chat-row-avatar" style="background:${grad}">${_escapeHtml(profile.initial)}${_pfpImgHTML(profile)}</div>
      <div class="chat-row-info">
        <div class="chat-row-top">
          <span class="chat-row-name">${_escapeHtml(profile.name)}, ${_escapeHtml(profile.age)}</span>
          <span class="chat-row-time">${_escapeHtml(chat.lastActive)}</span>
        </div>
        <span class="chat-row-preview">${chat.typing ? _typingDotsHTML() : _escapeHtml(chat.lastMessage)}</span>
      </div>
      ${chat.unread ? `<div class="chat-row-unread">${_escapeHtml(chat.unread)}</div>` : ''}
    `;

    wrapper.appendChild(row);
    list.appendChild(wrapper);

    // No swipe-to-delete on chats: deleting is in the hold menu (Delete Chat, last).

    _attachChatRowHold(row, chat);
  });
}

// ================================================================
// CHATS — hold menu (Pin / Search / Reset / Delete) and search
// ================================================================
// Replaces the old hold-to-open settings sheet on a chat row. Holding a row
// buzzes, lifts the row and floats a small rounded menu beside it; Delete is
// always last and red. Search in Chat opens a sheet scoped to that chat; the
// search button in the Chats header opens the same sheet across every chat
// (names and messages).
const CHAT_ROW_HOLD_MS = 450;
const CHAT_SEARCH_KEY  = 'zelo_chat_recent_searches';

// Inline stroke icons, same family as the header's gear / back arrow. No pin,
// search or reset artwork exists in assets/ (checked chats-page/, Chats page/,
// misc/), so these are plain geometric strokes — swap for real art if supplied.
const _CR_SVG = (d, extra = '') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}${extra}</svg>`;
const _CR_ICONS = {
  pin:    _CR_SVG('<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>'),
  search: _CR_SVG('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  reset:  _CR_SVG('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  flag:   _CR_SVG('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  trash:  _CR_SVG('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
  // Pinned marker: a filled accent circle with a white pin — big enough to read at a glance.
  pinBadge: '<span class="chat-row-pinbadge" aria-label="Pinned"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2h-4v8h-2v-8H7v-2l3-3z"/></svg></span>',
};

function _attachChatRowHold(row, chat) {
  let timer = null, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; row.classList.remove('chat-row--pressing'); };
  row.addEventListener('touchstart', (e) => {
    cancel();
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    row.classList.add('chat-row--pressing');
    timer = setTimeout(() => {
      timer = null;
      row.classList.remove('chat-row--pressing');
      row._heldAt = Date.now();
      // Buzz as the hold lands. navigator.vibrate alone is a no-op in WKWebView.
      navigator.vibrate?.(14);
      _cineHaptic('MEDIUM');
      openChatRowMenu(chat, row);
    }, CHAT_ROW_HOLD_MS);
  }, { passive: true });
  row.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) cancel();
  }, { passive: true });
  row.addEventListener('touchend', cancel, { passive: true });
  row.addEventListener('touchcancel', cancel, { passive: true });
}

let _crmEl = null;
function openChatRowMenu(chat, row) {
  closeChatRowMenu(true);
  const app = document.getElementById('app');
  if (!app || !row) return;
  const r = row.getBoundingClientRect();
  const o = document.createElement('div');
  o.className = 'crm-overlay';
  const clone = row.cloneNode(true);
  clone.classList.remove('chat-row--pressing');
  clone.removeAttribute('onclick');
  o.innerHTML = `
    <div class="crm-backdrop"></div>
    <div class="crm-lift"></div>
    <div class="crm-card" role="menu">
      <button type="button" class="crm-item" data-act="pin" role="menuitem">${_CR_ICONS.pin}<span>${chat.pinned ? 'Unpin Chat' : 'Pin Chat'}</span></button>
      <button type="button" class="crm-item" data-act="search" role="menuitem">${_CR_ICONS.search}<span>Search in Chat</span></button>
      <button type="button" class="crm-item" data-act="reset" role="menuitem">${_CR_ICONS.reset}<span>Reset Chat</span></button>
      <button type="button" class="crm-item" data-act="report" role="menuitem">${_CR_ICONS.flag}<span>Report a Problem</span></button>
      <div class="crm-divider"></div>
      <button type="button" class="crm-item crm-item--danger" data-act="delete" role="menuitem">${_CR_ICONS.trash}<span>Delete Chat</span></button>
    </div>`;
  const lift = o.querySelector('.crm-lift');
  lift.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;
  lift.appendChild(clone);
  app.appendChild(o);
  _crmEl = o;

  // Below the row, right-aligned; above it when there is no room (tab bar).
  const card = o.querySelector('.crm-card');
  const w = card.offsetWidth, h = card.offsetHeight;
  // r comes from getBoundingClientRect (device space); w/h and the left/top
  // written below are app space, so bring r across before comparing.
  const s = _appScale();
  const rTop = r.top / s, rBottom = r.bottom / s, rRight = r.right / s;
  const below = rBottom + 10 + h <= _appH() - 96;
  const top = below ? rBottom + 10 : Math.max(60, rTop - 10 - h);
  const left = Math.min(Math.max(16, rRight - w - 4), _appW() - w - 16);
  card.style.left = left + 'px';
  card.style.top  = top + 'px';
  card.style.transformOrigin = `${Math.round(rRight - left)}px ${below ? '0' : '100%'}`;

  o.querySelector('.crm-backdrop').onclick = () => closeChatRowMenu();
  lift.onclick = () => closeChatRowMenu();
  card.querySelectorAll('.crm-item').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); _cineHaptic('LIGHT'); _chatRowAction(b.dataset.act, chat); };
  });
  void o.offsetWidth;
  requestAnimationFrame(() => o.classList.add('crm-overlay--in'));
}

function closeChatRowMenu(instant) {
  const o = _crmEl;
  if (!o) return;
  _crmEl = null;
  if (instant) { o.remove(); return; }
  o.classList.remove('crm-overlay--in');
  o.classList.add('crm-overlay--out');
  setTimeout(() => o.remove(), 200);
}

function _chatRowAction(act, chat) {
  closeChatRowMenu();
  if (act === 'pin') {
    chat.pinned = !chat.pinned;
    renderChatsList();
  } else if (act === 'search') {
    setTimeout(() => openChatSearch(chat), 180);
  } else if (act === 'reset') {
    setTimeout(() => _showChatConfirm('Reset chat?', 'This clears the whole conversation and starts fresh. This can’t be undone.', 'Reset', () => {
      state.activeChatId = chat.id; state.character = chat.profile; state.difficulty = chat.difficulty; state.mode = chat.mode;
      chatSettingsReset();
    }), 180);
  } else if (act === 'report') {
    // The report sheet reads the active chat, so point it at the held row first.
    state.activeChatId = chat.id; state.character = chat.profile; state.difficulty = chat.difficulty; state.mode = chat.mode;
    setTimeout(() => openReportSheet('chat', null), 180);
  } else if (act === 'delete') {
    setTimeout(() => _showChatConfirm('Delete chat?', 'This permanently deletes this conversation. This can’t be undone.', 'Delete', () => onDeleteChat(chat.id)), 180);
  }
}

// ---- Search ----------------------------------------------------------------
let _chatSearchScope = null;   // a chat object, or null = every chat

function _recentSearches() {
  try { const a = JSON.parse(localStorage.getItem(CHAT_SEARCH_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
function _saveRecentSearch(q) {
  q = (q || '').trim(); if (!q) return;
  const list = [q, ..._recentSearches().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  localStorage.setItem(CHAT_SEARCH_KEY, JSON.stringify(list));
}
function chatSearchRemoveRecent(i) {
  const l = _recentSearches(); l.splice(i, 1);
  localStorage.setItem(CHAT_SEARCH_KEY, JSON.stringify(l));
  _renderChatSearch();
}
function chatSearchClearAll() { localStorage.removeItem(CHAT_SEARCH_KEY); _renderChatSearch(); }
function chatSearchUseRecent(i) {
  const q = _recentSearches()[i]; if (q == null) return;
  const inp = document.getElementById('csearch-input'); inp.value = q;
  _renderChatSearch();
}

function openChatSearch(chat) {
  const o = document.getElementById('chat-search-overlay');
  if (!o) return;
  _chatSearchScope = chat || null;
  document.getElementById('csearch-title').textContent = chat ? 'Search in Chat' : 'Search';
  const inp = document.getElementById('csearch-input');
  inp.value = '';
  inp.placeholder = chat ? 'Search messages…' : 'Search messages or names…';
  const card = document.getElementById('csearch-card');
  card.style.transition = ''; card.style.transform = '';
  const scrim = o.querySelector('.csearch-scrim');
  if (scrim) { scrim.style.transition = ''; scrim.style.opacity = ''; }
  _renderChatSearch();
  o.hidden = false;
  void o.offsetWidth;
  o.classList.add('csearch-overlay--in');
  setTimeout(() => inp.focus(), 320);
}

function closeChatSearch() {
  const o = document.getElementById('chat-search-overlay');
  if (!o || o.hidden) return;
  document.getElementById('csearch-input').blur();
  o.classList.remove('csearch-overlay--in');
  setTimeout(() => { o.hidden = true; }, 300);
}

function onChatSearchInput() { _renderChatSearch(); }
function chatSearchClearField() { const i = document.getElementById('csearch-input'); i.value = ''; i.focus(); _renderChatSearch(); }

function _hiHTML(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return _escapeHtml(text);
  // Trim to a window around the match so a long message still shows the hit.
  const start = Math.max(0, i - 24);
  const end = Math.min(text.length, i + q.length + 60);
  return (start > 0 ? '…' : '') + _escapeHtml(text.slice(start, i))
    + '<mark>' + _escapeHtml(text.slice(i, i + q.length)) + '</mark>'
    + _escapeHtml(text.slice(i + q.length, end)) + (end < text.length ? '…' : '');
}

function _chatSearchResults(q) {
  const lq = q.toLowerCase();
  const chats = _chatSearchScope ? [_chatSearchScope] : chatStore;
  const people = _chatSearchScope ? [] : chatStore.filter(c => (c.profile.name || '').toLowerCase().includes(lq));
  const msgs = [];
  chats.forEach(c => (c.messages || []).forEach(m => {
    if (m.text && m.text.toLowerCase().includes(lq)) msgs.push({ chat: c, m });
  }));
  msgs.sort((a, b) => (b.m.time || 0) - (a.m.time || 0));
  return { people, msgs: msgs.slice(0, 60) };
}

function _csAvatar(profile, cls) {
  const grad = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  return `<div class="${_escapeHtml(cls)}" style="background:${_escapeHtml(grad)}">${_escapeHtml(profile.initial)}${_pfpImgHTML(profile)}</div>`;
}

function _renderChatSearch() {
  const body = document.getElementById('csearch-body');
  const q = document.getElementById('csearch-input').value.trim();
  document.getElementById('csearch-clear').hidden = !document.getElementById('csearch-input').value;
  if (!q) {
    const rec = _recentSearches();
    body.innerHTML = rec.length ? `
      <div class="csearch-sec"><span>RECENT SEARCHES</span><button type="button" onclick="chatSearchClearAll()">Clear All</button></div>
      ${rec.map((t, i) => `
        <div class="csearch-recent" onclick="chatSearchUseRecent(${i})">
          ${_CR_ICONS.search}<span>${_escapeHtml(t)}</span>
          <button type="button" class="csearch-rm" aria-label="Remove" onclick="event.stopPropagation(); chatSearchRemoveRecent(${i})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>`).join('')}`
      : `<p class="csearch-empty">${_chatSearchScope ? 'Search this conversation.' : 'Search your messages and the people you’ve matched with.'}</p>`;
    return;
  }
  const { people, msgs } = _chatSearchResults(q);
  if (!people.length && !msgs.length) {
    body.innerHTML = `<p class="csearch-empty">No results for “${_escapeHtml(q)}”</p>`;
    return;
  }
  const idOf = (c) => chatStore.indexOf(c);
  body.innerHTML =
    (people.length ? `<div class="csearch-sec"><span>PEOPLE</span></div>` + people.map(c => `
      <button type="button" class="csearch-hit" data-chat-index="${idOf(c)}">
        ${_csAvatar(c.profile, 'csearch-av')}
        <span class="csearch-hit-text"><b>${_hiHTML(`${c.profile.name}, ${c.profile.age}`, q)}</b></span>
      </button>`).join('') : '')
    + (msgs.length ? `<div class="csearch-sec"><span>MESSAGES</span></div>` + msgs.map(({ chat, m }) => `
      <button type="button" class="csearch-hit" data-chat-index="${idOf(chat)}" data-message-id="${_escapeHtml(m.id || '')}">
        ${_csAvatar(chat.profile, 'csearch-av')}
        <span class="csearch-hit-text">
          <b>${_escapeHtml(chat.profile.name)}<i>${m.sender === 'user' ? ' · You' : ''}</i></b>
          <span>${_hiHTML(m.text, q)}</span>
        </span>
      </button>`).join('') : '');
  body.querySelectorAll('.csearch-hit').forEach(hit => {
    hit.addEventListener('click', () => chatSearchOpen(Number(hit.dataset.chatIndex), hit.dataset.messageId || ''));
  });
}

function chatSearchOpen(chatIdx, msgId) {
  const chat = chatStore[chatIdx];
  if (!chat) return;
  _saveRecentSearch(document.getElementById('csearch-input').value);
  closeChatSearch();
  setTimeout(() => {
    openChatFromStore(chat);
    if (msgId) setTimeout(() => _scrollToMessage(msgId), 520);
  }, 200);
}

// Swipe the sheet down to dismiss — same mechanic as the AI Coach chat sheet
// (attachAiCoachChatSheetDragClose): a 6px deadzone, then the card follows the
// finger 1:1 with transitions off, the scrim fades with the drag, and release
// either continues straight into the close (past 110px, or a quick downward
// flick) or springs back. Arms anywhere on the sheet; the results list only
// arms it while scrolled to the very top, so a downward drag mid-list still
// scrolls the list instead of closing the sheet.
function _attachChatSearchDrag() {
  const o = document.getElementById('chat-search-overlay');
  const card = document.getElementById('csearch-card');
  const body = document.getElementById('csearch-body');
  const scrim = o && o.querySelector('.csearch-scrim');
  if (!o || !card || card._wired) return;
  card._wired = true;
  const DEADZONE = 6, CLOSE_PX = 110, FLICK = 0.5; // FLICK in px/ms
  let startY = 0, lastY = 0, lastT = 0, vel = 0, dy = 0, dragging = false, committed = false;

  card.addEventListener('touchstart', e => {
    if (o.hidden || !o.classList.contains('csearch-overlay--in')) return;
    if (body && body.contains(e.target) && body.scrollTop > 0) return;
    startY = lastY = e.touches[0].clientY;
    lastT = e.timeStamp; vel = 0; dy = 0;
    dragging = true; committed = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!dragging) return;
    const y = e.touches[0].clientY;
    const raw = y - startY;
    if (!committed) {
      if (raw < -DEADZONE) { dragging = false; return; } // an upward drag is a scroll
      if (raw < DEADZONE) return;
      committed = true;
      startY = y; // start moving from here, so the card doesn't jump by the deadzone
      card.style.transition = 'none';
      if (scrim) scrim.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault(); // no list rubber-band under a close-drag
    dy = Math.max(0, y - startY);
    if (e.timeStamp > lastT) { vel = (y - lastY) / (e.timeStamp - lastT); lastY = y; lastT = e.timeStamp; }
    card.style.transform = `translateY(${dy}px)`;
    if (scrim) scrim.style.opacity = String(Math.max(0, 1 - dy / (card.offsetHeight || 1)));
  }, { passive: false });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (!committed) return;
    committed = false;
    if (dy > CLOSE_PX || (vel > FLICK && dy > 24)) {
      // Carry on from where the finger let go — never hand a frozen
      // transition:none card to the class-based close (see CLAUDE.md, the
      // AI Coach "stops, then goes down" entry).
      card.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
      card.style.transform = 'translateY(100%)';
      if (scrim) { scrim.style.transition = 'opacity 0.3s ease'; scrim.style.opacity = '0'; }
      closeChatSearch();
      setTimeout(() => {
        card.style.transition = 'none'; card.style.transform = '';
        if (scrim) { scrim.style.transition = ''; scrim.style.opacity = ''; }
        void card.offsetHeight;
        card.style.transition = '';
      }, 340);
    } else {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = '';
      if (scrim) { scrim.style.transition = 'opacity 0.25s ease'; scrim.style.opacity = ''; }
      setTimeout(() => { card.style.transition = ''; if (scrim) scrim.style.transition = ''; }, 320);
    }
    dy = 0; vel = 0;
  };
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', end);
}
window.addEventListener('zelo-kb', () => {
  document.getElementById('csearch-card')?.style.setProperty('--kb', (window.__zeloKbH || 0) + 'px');
});
document.addEventListener('DOMContentLoaded', _attachChatSearchDrag);

function openChatFromStore(chat) {
  hideMsgBanner();
  _captureHistoryReturn();

  // Mark unread cleared
  chat.unread = 0;
  saveChats();   // unread is persisted, so opening a chat has to be recorded

  // Set up state as if we just matched
  state.character  = chat.profile;
  state.difficulty = chat.difficulty;
  state.mode       = chat.mode;
  state.replyIndex = chat.messages.filter(m => m.sender === 'ai').length % REPLIES[chat.difficulty].length;
  state.activeChatId = chat.id;
  _clearStagedReply(); // defensive — nothing from a previous chat should carry over


  // Replay messages (shared with the repaint after a "Delete for you")
  _rerenderChatMessages();
  _renderChatChips();
  _syncComposerButtons();
  setTimeout(_scheduleSuggestions, 700);   // after the screen is live

  setSendEnabled(true);
  _syncBlockedUI();
  pushScreen('chat');
  _forceChatRepaint();
  _trackPracticeStart(true);
  setTimeout(maybeShowPracticeReviewModal, 350);
  // No auto-focus here — opening a chat (from the list, or from a match)
  // shouldn't pop the keyboard on its own; same reasoning as her replies
  // not doing it either (see doTypingAndReply()/startChat()'s own note).
}

// Appends a user bubble without status label (for replayed history)
function appendUserBubbleStatic(text, atTime, opts = {}) {
  const messages = document.getElementById('chat-messages');
  const row    = document.createElement('div');
  row.className = 'msg-row user';
  if (opts.id) row.dataset.msgId = opts.id;
  const wrap   = document.createElement('div');
  wrap.className = 'msg-wrap';
  const bubble = document.createElement('div');
  bubble.className = 'bubble user';
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));
  const timestamp = document.createElement('div');
  timestamp.className   = 'msg-timestamp';
  timestamp.textContent = formatTime(atTime);
  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(wrap);
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
}

// Save the current chat messages back to the store whenever a message is sent/received
// Plain incrementing counter, not Date.now() — a double/triple-text burst
// can land multiple messages within the same millisecond, and the id just
// needs to be unique within this session (chatStore is in-memory only,
// never persisted), not globally unique or sortable.
let _msgIdCounter = 0;
function _newMsgId() { return 'm' + (++_msgIdCounter); }

function syncChatToStore(text, sender, replyToId, chatId) {
  const targetId = chatId || state.activeChatId;
  if (!targetId) return null;
  const chat = chatStore.find(c => c.id === targetId);
  if (!chat) return null;
  const id = _newMsgId();
  const msg = { id, sender, text, time: Date.now() };
  if (replyToId) msg.replyToId = replyToId;
  chat.messages.push(msg);
  chat.lastMessage = text;
  chat.lastActive  = 'just now';
  saveChats();
  return id;
}


// ================================================================
