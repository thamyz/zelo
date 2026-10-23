// ================================================================
// 03-persona-profile.js — starting and leaving a practice chat, and her profile page
//
// startChat()/exitChat(), plus the Instagram-style profile opened by tapping
// her photo, name or avatar in a chat: posts grid, post feed, followers.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// PRACTICE: START / EXIT CHAT
// ================================================================

// Builds the large Instagram-DM-style profile block (photo/name/age) and
// inserts it as the first item in the scrollable thread — not a fixed
// header, so it scrolls away naturally like any other list item, with no
// animation or scroll-position tracking involved. Called right after
// #chat-messages is cleared, from both startChat() (new match) and
// openChatFromStore() (reopening a saved chat).
// Round profile picture (head-and-shoulders crop of the persona's master
// reference, 320px). Layered over the gradient + initial, which stay underneath
// as the fallback for personas without one or a failed load.
function _pfpUrl(p) {
  if (!p) return '';
  if (p.avatar) return p.avatar;
  const hit = (typeof ALL_PROFILES !== 'undefined') && ALL_PROFILES.find(x => x.id === p.id);
  return (hit && hit.avatar) || '';
}
function _pfpImgHTML(p) {
  const u = _pfpUrl(p);
  return u ? `<img class="pfp-img" src="${_escapeHtml(u)}" alt="" decoding="async" onerror="this.remove()">` : '';
}

// ================================================================
// PERSONA PROFILE — Instagram-style page for each character
// ================================================================
// Opened by tapping her photo/name at the top of a chat or the little avatar
// beside her messages. A full-screen overlay that slides in over the chat
// (not a pushScreen), so the chat underneath stays the live screen and a reply
// that arrives while you browse still lands in it. Her four photos are the
// posts; captions come from personas-posts.js; the bio is what she's into.
let _ppProfile = null;

function _ppHash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function _ppClean(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function _personaHandle(p) {
  const f = _ppClean(p.name), l = _ppClean(p.lastName), c = _ppClean((p.city || '').split(/[\s,]/)[0]);
  const h = _ppHash(p.id || p.name), n = (h % 90) + 10;
  const opts = l ? [`${f}.${l}`, `${f}_${l}`, `${f}${l[0]}.${n}`, `${f}.${l.slice(0, 3)}`]
                 : [`${f}.${c}`, `${f}_${n}`, `its.${f}`];
  return opts[h % opts.length];
}
function _personaStats(p) {
  const h = _ppHash('stats' + (p.id || p.name));
  return {
    posts: (p.photos || []).length,
    followers: (280 + h % 4200).toLocaleString('en-US'),
    following: (120 + (h >>> 7) % 780).toLocaleString('en-US'),
  };
}
function _personaPosts(p) {
  return (p.photos || []).map((src, i) => {
    const set = (src.match(/characters\/([a-z]\d{3})-/) || [])[1];
    const caps = (typeof PERSONA_POST_CAPTIONS !== 'undefined' && set && PERSONA_POST_CAPTIONS[set]) || [];
    return { src, caption: caps[i] || '' };
  });
}

const _PP_ICONS = {
  grid:   '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>',
  tagged: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4"/></svg>',
  check:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
  camera: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

function _ppAvatar(p, cls) {
  const grad = `linear-gradient(145deg, ${p.gradientColors[0]}, ${p.gradientColors[1]})`;
  return `<div class="${_escapeHtml(cls)}" style="background:${_escapeHtml(grad)}">${_escapeHtml(p.initial || '')}${_pfpImgHTML(p)}</div>`;
}

function openPersonaProfile(profile) {
  const p = profile || state.character;
  const o = document.getElementById('pp-overlay');
  if (!p || !o) return;
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  _ppProfile = p;
  const handle = _personaHandle(p);
  const st = _personaStats(p);
  const posts = _personaPosts(p);
  const likes = (p.interests || []).map(x => x.toLowerCase()).join(' · ');
  const where = [ (p.occupation || '').trim(), (p.city || '').trim() ].filter(Boolean).join(' · ');
  document.getElementById('pp-handle').textContent = handle;
  document.getElementById('pp-feed-handle').textContent = handle;
  document.getElementById('pp-scroll').innerHTML = `
    <div class="pp-top">
      ${_ppAvatar(p, 'pp-avatar')}
      <div class="pp-top-right">
        <div class="pp-name">${_escapeHtml(p.name)}${p.age ? ', ' + p.age : ''}</div>
        <div class="pp-stats">
          <div><b>${st.posts}</b><span>posts</span></div>
          <div><b>${st.followers}</b><span>followers</span></div>
          <div><b>${st.following}</b><span>following</span></div>
        </div>
      </div>
    </div>
    <div class="pp-bio">
      ${where ? `<p class="pp-bio-meta">${_escapeHtml(where)}</p>` : ''}
      ${p.bio ? `<p class="pp-bio-text">${_escapeHtml(p.bio)}</p>` : ''}
      ${likes ? `<p class="pp-bio-likes"><span aria-hidden="true">♡</span> ${_escapeHtml(likes)}</p>` : ''}
    </div>
    <div class="pp-actions">
      <span class="pp-btn pp-btn--status">${_PP_ICONS.check} Matched</span>
      <button type="button" class="pp-btn" onclick="personaProfileMessage()">Message</button>
    </div>
    <div class="pp-tabs" role="tablist">
      <button type="button" class="pp-tab pp-tab--on" data-tab="grid" onclick="personaProfileTab('grid')" aria-label="Posts">${_PP_ICONS.grid}</button>
      <button type="button" class="pp-tab" data-tab="tagged" onclick="personaProfileTab('tagged')" aria-label="Tagged">${_PP_ICONS.tagged}</button>
    </div>
    <div class="pp-grid" id="pp-grid">
      ${posts.map((x, i) => `<button type="button" class="pp-cell" onclick="openPersonaPost(${i})" aria-label="Post ${i + 1}"><img src="${_escapeHtml(x.src)}" alt="" loading="lazy" decoding="async"></button>`).join('')}
    </div>
    <div class="pp-empty" id="pp-tagged" hidden>
      <span class="pp-empty-ic">${_PP_ICONS.camera}</span>
      <p>No tagged photos yet</p>
    </div>`;
  document.getElementById('pp-feed-list').innerHTML = posts.map((x, i) => `
    <article class="pp-post" id="pp-post-${i}">
      <header class="pp-post-head">${_ppAvatar(p, 'pp-post-av')}<span><b>${handle}</b>${p.city ? `<i>${_escapeHtml(p.city)}</i>` : ''}</span></header>
      <img class="pp-post-img" src="${_escapeHtml(x.src)}" alt="" loading="lazy" decoding="async">
      ${x.caption ? `<p class="pp-post-cap"><b>${handle}</b> ${_escapeHtml(x.caption)}</p>` : ''}
    </article>`).join('');
  document.getElementById('pp-scroll').scrollTop = 0;
  // Same trailing-spacer trick as the other pages, so the profile always drags
  // and bounces even though four photos fit on one screen.
  const _ppGo = () => _ensureScrollableOverflow(document.getElementById('pp-scroll'), 56);
  requestAnimationFrame(() => requestAnimationFrame(_ppGo)); setTimeout(_ppGo, 400);
  const panel = document.getElementById('pp-panel');
  panel.style.transition = ''; panel.style.transform = '';
  o.hidden = false;
  void o.offsetWidth;
  requestAnimationFrame(() => o.classList.add('pp-overlay--in'));
  _cineHaptic('LIGHT');
}

function personaProfileTab(tab) {
  document.querySelectorAll('#pp-scroll .pp-tab').forEach(t => t.classList.toggle('pp-tab--on', t.dataset.tab === tab));
  document.getElementById('pp-grid').hidden = tab !== 'grid';
  document.getElementById('pp-tagged').hidden = tab !== 'tagged';
  setTimeout(() => _ensureScrollableOverflow(document.getElementById('pp-scroll'), 56), 30);
}

function closePersonaProfile() {
  const o = document.getElementById('pp-overlay');
  if (!o || o.hidden) return;
  closePersonaFeed(true);
  const panel = document.getElementById('pp-panel');
  panel.style.transition = ''; panel.style.transform = '';
  o.classList.remove('pp-overlay--in');
  setTimeout(() => {
    o.hidden = true;
    // Let the decoded photos go — four 1080x1350 images are ~22 MB of bitmap.
    document.getElementById('pp-scroll').innerHTML = '';
    document.getElementById('pp-feed-list').innerHTML = '';
  }, 340);
}

// "Message" goes back to her chat: closes the profile if we came from it,
// otherwise opens the chat from the Chats store.
function personaProfileMessage() {
  const p = _ppProfile;
  const inChat = document.getElementById('screen-chat')?.classList.contains('active') && state.character && p && state.character.id === p.id;
  closePersonaProfile();
  if (inChat || !p) return;
  const chat = chatStore.find(c => c.profile && c.profile.id === p.id);
  if (chat) setTimeout(() => openChatFromStore(chat), 200);
}

function openPersonaPost(i) {
  const feed = document.getElementById('pp-feed');
  feed.style.transition = ''; feed.style.transform = '';
  feed.hidden = false;
  const list = document.getElementById('pp-feed-list');
  const target = document.getElementById('pp-post-' + i);
  list.style.scrollBehavior = 'auto';
  // offsetTop is measured from the feed panel, not the list, so take the list's own offset off.
  list.scrollTop = target ? target.offsetTop - list.offsetTop : 0;
  void feed.offsetWidth;
  requestAnimationFrame(() => feed.classList.add('pp-feed--in'));
}

function closePersonaFeed(instant) {
  const feed = document.getElementById('pp-feed');
  if (!feed || feed.hidden) return;
  feed.style.transition = ''; feed.style.transform = '';
  feed.classList.remove('pp-feed--in');
  if (instant) { feed.hidden = true; return; }
  setTimeout(() => { feed.hidden = true; }, 320);
}

// Swipe right to go back (anywhere on the page, like the rest of the app):
// the page follows the finger and either slides away or springs back.
function _attachPersonaSwipe(el, onClose) {
  if (!el || el._ppSwipe) return;
  el._ppSwipe = true;
  let x0 = 0, y0 = 0, dx = 0, mode = null, t0 = 0;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; t0 = Date.now(); }, { passive: true });
  el.addEventListener('touchmove', e => {
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      mode = (mx > 0 && Math.abs(mx) > Math.abs(my) * 1.2) ? 'h' : 'v';
      if (mode === 'h') el.style.transition = 'none';
    }
    if (mode !== 'h') return;
    dx = Math.max(0, mx);
    el.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  const end = () => {
    if (mode !== 'h') { mode = null; return; }
    mode = null;
    const fast = dx > 40 && (Date.now() - t0) < 250;
    el.style.transition = '';
    if (dx > el.clientWidth * 0.3 || fast) {
      el.style.transform = 'translateX(100%)';
      setTimeout(onClose, 10);
    } else {
      el.style.transform = '';
    }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}
document.addEventListener('DOMContentLoaded', () => {
  _attachPersonaSwipe(document.getElementById('pp-panel'), closePersonaProfile);
  _attachPersonaSwipe(document.getElementById('pp-feed'), () => closePersonaFeed());
});

function _renderChatProfileHeader(character) {
  const messagesEl = document.getElementById("chat-messages");
  const block = document.createElement("div");
  block.className = "chat-profile-block";

  const photo = document.createElement("div");
  photo.className = "chat-profile-photo";
  photo.style.background = character.gradientColors
    ? `linear-gradient(145deg, ${character.gradientColors[0]}, ${character.gradientColors[1]})`
    : character.color;
  photo.innerHTML = `${character.initial}${_pfpImgHTML(character)}`;

  // Name + age on one line, one font — same "Name, Age" pattern already
  // used for swipe cards and chat list rows elsewhere in the app.
  const name = document.createElement("h2");
  name.className = "chat-profile-name";
  name.id = "chat-profile-name";
  name.textContent = character.age != null ? `${character.name}, ${character.age}` : character.name;

  // Instagram-DM style "View profile" pill under her name.
  const view = document.createElement('button');
  view.type = 'button';
  view.className = 'chat-profile-view-btn';
  view.textContent = 'View profile';
  block.append(photo, name, view);
  // Only the three parts open her profile (the block spans the full width, so a
  // handler on it made empty space either side of her photo a hit target).
  [photo, name, view].forEach(el => {
    el.classList.add('chat-profile-hit');
    el.setAttribute('data-open-profile', '');
    el.onclick = (e) => { e.stopPropagation(); openPersonaProfile(character); };
  });
  messagesEl.appendChild(block);
}

// Analytics: a practice session = from opening a chat to leaving it. "finished"
// = the user sent at least PRACTICE_FINISHED_MIN_MSGS messages in it; anything
// shorter is "abandoned" (chats have no built-in end state to key off).
const PRACTICE_FINISHED_MIN_MSGS = 5;
let _practiceSince = 0, _practiceMsgs0 = 0, _practiceIdx0 = 0, _practiceDrive0 = { ack: 0, carried: 0 };
function _practiceUserMsgCount() {
  const c = chatStore.find(x => x.id === state.activeChatId);
  return c ? c.messages.filter(m => m.sender !== 'ai').length : 0;
}
// What the chat was waiting on when the user left — the point of this whole
// measurement. 'her_question' = she asked and they walked away without replying;
// 'user_ack' = they gave her an "ok"/"lol" and left; and so on.
function _practiceLeftAfter(chat) {
  const h = chat ? chat.messages : [];
  if (!h.length) return null;
  const last = h[h.length - 1];
  if (last.sender !== 'user') return /\?/.test(last.text || '') ? 'her_question' : 'her_statement';
  const t = _readUserTurn(h);
  return t ? 'user_' + t.kind : null;
}
function _trackPracticeStart(resumed) {
  _practiceSince = Date.now();
  _practiceMsgs0 = _practiceUserMsgCount();
  const c0 = chatStore.find(x => x.id === state.activeChatId);
  _practiceIdx0 = c0 ? c0.messages.length : 0; // this session's messages start here
  _practiceDrive0 = { ack: (c0 && c0.drive && c0.drive.ack) || 0, carried: (c0 && c0.drive && c0.drive.carried) || 0 };
  ZeloAnalytics.track('practice_session_started', { mode: state.mode, difficulty: state.difficulty, resumed });
}
// background = the app is being sent away (e.g. to check Supabase) mid-chat: save what has been said so far
// and keep going, so the rows exist without having to leave the chat. A chat that is backgrounded and
// resumed is stored as one row per stretch (each with its own messages), never duplicated.
function _trackPracticeEnd(background) {
  if (!_practiceSince) return;
  const sent = _practiceUserMsgCount() - _practiceMsgs0;
  const outcome = sent >= PRACTICE_FINISHED_MIN_MSGS ? 'finished' : 'abandoned';
  const chat = chatStore.find(x => x.id === state.activeChatId);
  if (background && !(chat && chat.messages.length > _practiceIdx0)) return; // nothing new to save yet
  if (!background) {
    const drive = (chat && chat.drive) || { ack: 0, carried: 0 };
    ZeloAnalytics.track('practice_session_ended', {
      duration_s: (Date.now() - _practiceSince) / 1000, outcome, difficulty: state.difficulty, user_msgs: sent,
      left_after: _practiceLeftAfter(chat), ack_turns: drive.ack - _practiceDrive0.ack, carried: drive.carried - _practiceDrive0.carried,
    });
  }
  // Database: metadata always; the chat text ONLY if the user opted in (practiceReviewOn()).
  ZeloRecords.savePracticeSession({
    personaId: state.character && state.character.id, difficulty: state.difficulty, mode: state.mode,
    startedAt: _practiceSince, endedAt: Date.now(), messageCount: sent, outcome,
    messages: chat ? chat.messages.slice(_practiceIdx0) : [], includeText: practiceReviewOn(),
  });
  if (background) {
    // keep tracking: the next save covers only what is said from here on
    _practiceSince = Date.now();
    _practiceMsgs0 = _practiceUserMsgCount();
    _practiceIdx0 = chat ? chat.messages.length : 0;
    return;
  }
  _practiceSince = 0;
}

document.addEventListener('visibilitychange', () => { if (document.hidden) _trackPracticeEnd(true); });

// ---- Opener suggestions above the composer --------------------------------
// Shown only in a chat the user hasn't written in yet. Built from the
// persona's own interests and job, so each one is specific to her; tapping one
// puts a ready-to-edit line in the message box (it never sends by itself).
const _chipSets = Object.create(null);

function _chipsFor(p) {
  // Plain greetings, written the way people actually text them — lowercase, no
  // exclamation marks, no "how are you today".
  return [
    { label: 'Say hey',              text: 'hey' },
    { label: 'Ask about her day',    text: "hey how's your day been" },
    { label: "Ask what she's up to", text: 'hi what are you up to today' },
  ];
}

// Before she has been written to: just a quiet "Need an opener?" link (tapping it
// reveals the static, profile-based openers). Once the conversation is going,
// the suggestions are generated from it — see _fetchSuggestions().
const _openerOpened = Object.create(null);

function _fillComposer(text) {
  const input = document.getElementById('message-input');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // Only focus if the keyboard is not already up for this field. Calling
  // focus() on the already-focused input is what made iOS close and reopen
  // the keyboard between hints (the press moves focus to the button first,
  // see _keepComposerFocus below).
  if (document.activeElement !== input) input.focus();
  _cineHaptic('LIGHT');
}

// A <button> takes focus on press, which blurs the composer and drops the
// keyboard before the chip's own click even runs. Cancelling the press's
// default focus move keeps the keyboard exactly where it was.
function _keepComposerFocus(btn) {
  const hold = e => {
    const input = document.getElementById('message-input');
    if (document.activeElement === input) e.preventDefault();
  };
  btn.addEventListener('mousedown', hold);
  btn.addEventListener('touchstart', hold, { passive: false });
  return btn;
}
function _chipEl(label, text, extra) {
  const b = document.createElement('button');
  b.type = 'button';
  _keepComposerFocus(b);
  b.className = 'chat-chip' + (extra ? ' ' + extra : '');
  b.textContent = label;
  if (text != null) b.onclick = () => _fillComposer(text);
  return b;
}

function _renderChatChips() {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  const p = state.character;
  const fresh = p && !document.querySelector('#chat-messages .msg-row.user');
  wrap.dataset.mode = '';
  if (!fresh) { _cancelSuggestions(); wrap.hidden = true; wrap.innerHTML = ''; return; }
  wrap.innerHTML = '';
  const key = p.id || p.name;
  if (!_openerOpened[key]) {
    const b = _chipEl('Need an opener?', null, 'chat-chip--link');
    b.onclick = () => { _openerOpened[key] = true; _cineHaptic('LIGHT'); _renderChatChips(); };
    wrap.appendChild(b);
  } else {
    _chipsFor(p).forEach(c => wrap.appendChild(_chipEl(c.label, c.text)));
  }
  wrap.hidden = false;
  wrap.scrollLeft = 0;
  _followChatAfterChips();
}

// The chips row sits inside .chat-input-bar, so showing it makes the whole bar
// taller and the message list shorter — without this the newest bubble ends up
// clipped behind it. Only follows if they were already at the bottom.
function _followChatAfterChips() {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  const wasNearBottom = _isChatNearBottom();
  requestAnimationFrame(() => { if (wasNearBottom) _scrollToLogicalBottom(el); });
}

// ---- Conversation-aware suggestions ---------------------------------------
// After she replies and the user has been idle for a few seconds, one small AI
// call reads the recent conversation and offers three things to send next.
// Cheap by design: one call per message of hers, last 6 messages only, ~120
// output tokens, cached per message, capped per chat per day, never while the
// user is typing or she is mid-reply, and silently falls back to static chips.
const SUGG = { idleMs: 6000, perChatPerDay: 15, refreshGapMs: 3000, history: 6, maxTokens: 130 };
let _suggTimer = null, _suggGen = 0, _suggLastRefresh = 0;
const _suggCache = Object.create(null);

function _suggBudgetKey(chatId) { return `zelo_sugg_${chatId}_${new Date().toISOString().slice(0, 10)}`; }
function _suggUsed(chatId) { return parseInt(localStorage.getItem(_suggBudgetKey(chatId)) || '0', 10) || 0; }

function _cancelSuggestions() { clearTimeout(_suggTimer); _suggTimer = null; _suggGen++; }

function _scheduleSuggestions() {
  clearTimeout(_suggTimer);
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const last = chat && chat.messages[chat.messages.length - 1];
  if (!last || last.sender === 'user' || !_chatIsLive(chat.id)) return;
  _suggTimer = setTimeout(() => _fetchSuggestions(false), SUGG.idleMs);
}

function _renderSuggestions(list, msgId) {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.dataset.mode = 'ai';
  list.forEach(c => wrap.appendChild(_chipEl(c.label, c.text)));
  const r = document.createElement('button');
  r.type = 'button';
  r.className = 'chat-chip chat-chip--refresh';
  r.setAttribute('aria-label', 'New ideas');
  r.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  r.onclick = () => {
    if (Date.now() - _suggLastRefresh < SUGG.refreshGapMs) return;
    _suggLastRefresh = Date.now();
    _cineHaptic('LIGHT');
    r.classList.add('chat-chip--spin');
    _fetchSuggestions(true);
  };
  wrap.insertBefore(r, wrap.firstChild);   // first, so it is never pushed off-screen by long labels
  wrap.hidden = false;
  wrap.classList.remove('chat-chips--in'); void wrap.offsetWidth; wrap.classList.add('chat-chips--in');
  wrap.scrollLeft = 0;
  _followChatAfterChips();
}

// Models write texts that read as written-by-a-model: exclamation marks,
// em dashes, tidy full stops, capital letters, emoji. Texts between people
// don't look like that, so strip it back whatever the model returned.
function _humanizeText(t) {
  t = String(t)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{200d}\u{fe0f}]/gu, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, '')
    .replace(/\.\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.toLowerCase();   // people texting rarely capitalise anything
}

// Hold her message -> "Get hints": skeleton pills straight away, then the
// ideas for that message (instant if they were already fetched).
function _renderSuggestionSkeleton() {
  const wrap = document.getElementById('chat-chips');
  if (!wrap) return;
  wrap.innerHTML = [118, 92, 136].map(w => `<span class="chat-chip chat-chip--skel" style="width:${w}px" aria-hidden="true"></span>`).join('');
  wrap.dataset.mode = 'ai';
  wrap.classList.remove('chat-chips--in');   // its chipIn animation would replace the shimmer
  wrap.hidden = false;
  wrap.scrollLeft = 0;
  _followChatAfterChips();
}
function requestHintsFor(msgId) {
  clearTimeout(_suggTimer);
  if (!_suggCache[msgId]) _renderSuggestionSkeleton();
  _fetchSuggestions(false, msgId);
}

function _parseSuggestions(raw) {
  try {
    const m = String(raw).match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : raw);
    return arr.filter(x => x && typeof x.label === 'string' && typeof x.text === 'string')
      .map(x => ({ label: x.label.trim().slice(0, 36), text: _humanizeText(x.text).slice(0, 140) }))
      .filter(x => x.label && x.text).slice(0, 3);
  } catch (_) { return []; }
}

async function _fetchSuggestions(isRefresh, focusId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat || !_chatIsLive(chat.id) || state.awaitingReply) return;
  const input = document.getElementById('message-input');
  const manual = !!focusId;                                      // asked for from the hold menu
  if (!manual && input && input.value.trim()) return;            // they are already writing
  const last = focusId ? chat.messages.find(m => m.id === focusId) : chat.messages[chat.messages.length - 1];
  if (!last || last.sender === 'user') return;
  if (!isRefresh && _suggCache[last.id]) { _renderSuggestions(_suggCache[last.id], last.id); return; }
  if (_suggUsed(chat.id) >= SUGG.perChatPerDay) {
    if (manual) _renderSuggestions(_chipsFor(chat.profile), last.id);   // out of hints today: plain ones rather than nothing
    return;
  }

  const p = chat.profile;
  const gen = ++_suggGen;
  const convo = chat.messages.slice(-SUGG.history).map(m => `${m.sender === 'user' ? 'You' : p.name}: ${m.text}`).join('\n');
  const goal = _userGoalHint();
  const messages = [
    { role: 'system', content: [
      'You write the next text for someone who is messaging a girl they matched with. Give 3 different options.',
      'Reply with ONLY a JSON array of exactly 3 objects: {"label": "<2-4 word plain description, e.g. ask about it / tease her / share yours>", "text": "<the text itself>"}.',
      'THE TEXTS MUST SOUND LIKE A REAL PERSON TYPING ON THEIR PHONE, NOT AN AI: all lowercase is fine, short, sometimes just a fragment, no exclamation marks, no emojis, no em dashes, no full stops at the end. Use "lol", "haha", "wait", "ok but", "lowkey" only if natural. Never "That is so cool", "amazing", "I would love to hear", "how about you", "I am curious". No compliments as filler. Do not repeat or summarise what she said back to her.',
      'Pick up the specific thing she just said and react to it the way a friend would: reuse one of her own words, tease lightly, ask one real question, or say something small about themselves that connects. Make the 3 different in kind and in length (one can be 2-4 words, none over 12).',
      'Base EVERYTHING on what has actually been said in this conversation. Do not use or invent facts about her life, photos or profile; if little has been said, build on her last message.',
      'Bad: "That sounds amazing! What do you love most about it?"  Good: "wait you actually do that for a living"  Bad: "Haha that is so funny! How was your day?"  Good: "ok that is genuinely unhinged lol".',
    ].join(' ') },
    { role: 'user', content: [
      `The other person is ${p.name}, ${p.age}.`,
      goal ? `Background on the user (never mention it): ${goal}` : '',
      'Recent conversation:', convo,
      last !== chat.messages[chat.messages.length - 1] ? `Write the ideas as replies to this specific message of hers: "${last.text}"` : '',
    ].filter(Boolean).join('\n') },
  ];
  try {
    const { data, error } = await _aiInvoke('deepseek-proxy', {
      body: { model: 'deepseek-chat', messages, max_tokens: SUGG.maxTokens, temperature: 1.0 }
    }, 'suggest');
    if (error) throw new Error(error.message);
    localStorage.setItem(_suggBudgetKey(chat.id), String(_suggUsed(chat.id) + 1));
    const list = _parseSuggestions(data.choices[0].message.content);
    if (gen !== _suggGen || !_chatIsLive(chat.id)) return;       // moved on while it was thinking
    if (!manual && input && input.value.trim()) return;
    if (list.length < 2) throw new Error('unusable suggestions');
    _suggCache[last.id] = list;
    _renderSuggestions(list, last.id);
  } catch (_) {
    if (gen !== _suggGen || !_chatIsLive(chat.id)) return;
    // Offline / bad reply: the static, profile-based chips, so the row is never empty.
    if (manual || !(input && input.value.trim())) _renderSuggestions(_chipsFor(p), last.id);
  }
}

function startChat() {
  hideMsgBanner();
  const c = state.character;
  awardXP('conversation');


  document.getElementById("chat-messages").innerHTML = "";
  _renderChatProfileHeader(c);
  scrollToBottom(); // no messages yet, but still patches in the scroll-spacer so v-scroll isn't dead on a fresh chat
  _clearStagedReply(); // defensive — nothing should be staged entering a brand-new chat
  _renderChatChips();
  _syncComposerButtons();
  setSendEnabled(false);
  _syncBlockedUI();

  // Reached via the "It's a Match" overlay (Send a Message) — drop 'match'
  // from the stack chat is about to push onto rather than letting it ride
  // along: pressing back from a fresh chat should return straight to the
  // practice deck, not re-show "It's a Match"/"Keep Swiping" first.
  if (state.activeScreen === 'match') state.activeScreen = null;
  pushScreen("chat");
  _trackPracticeStart(false);

  // Every brand-new chat asks once, with no way to dismiss without choosing.
  // Reopening an existing chat goes through openChatFromStore() instead,
  // which never calls startChat() — so this never reappears for that chat.
  state.chatModePending = null;
  updateChatModeOptionUI();
  document.getElementById("chat-mode-modal-name").textContent = c.name;
  document.getElementById("chat-mode-modal").hidden = false;
}

// Copy for each option's two states: its normal label/desc, and the
// in-place confirmation prompt shown after the first tap.
const CHAT_MODE_TEXT = {
  training: {
    label:        "Instant replies",
    desc:         "She responds right away",
    confirmLabel: "Confirm instant replies?",
    confirmDesc:  "She'll respond right away."
  },
  realistic: {
    label:        "Realistic timing",
    desc:         "Her responses are delayed",
    confirmLabel: "This takes longer. Confirm?",
    confirmDesc:  "Replies will be delayed. This can't be undone."
  }
};

// First tap on an option flips that card into a confirmation prompt
// in place; the other card stays tappable so the user can switch instead.
// A second tap on the already-flipped card locks the choice in.
function handleChatModeOptionClick(mode) {
  if (state.chatModePending === mode) {
    selectChatMode(mode);
    return;
  }
  state.chatModePending = mode;
  updateChatModeOptionUI();
}

function updateChatModeOptionUI() {
  ['training', 'realistic'].forEach(mode => {
    const t       = CHAT_MODE_TEXT[mode];
    const btnEl   = document.getElementById('chat-mode-btn-'  + mode);
    const labelEl = document.getElementById('chat-mode-label-' + mode);
    const descEl  = document.getElementById('chat-mode-desc-'  + mode);
    if (!btnEl) return;

    const confirming = state.chatModePending === mode;
    labelEl.textContent = confirming ? t.confirmLabel : t.label;
    descEl.textContent  = confirming ? t.confirmDesc  : t.desc;
    btnEl.classList.toggle('confirming', confirming);
  });
}

// Locks the reply-timing mode for this conversation, then reveals the chat
// and sends the opening message. Called only from the second confirming tap.
function selectChatMode(mode) {
  state.mode = mode;
  state.chatModePending = null;

  if (state.activeChatId) {
    const chat = chatStore.find(c => c.id === state.activeChatId);
    if (chat) chat.mode = mode;
  }


  document.getElementById("chat-mode-modal").hidden = true;
  setTimeout(maybeShowPracticeReviewModal, 350); // first practice chat only, after the pace is chosen

  const diff = state.difficulty;
  const openerText = (state.character && state.character.opener) || 'hey';
  const openingDelay = mode === "training" ? 700 : 1500;
  setTimeout(() => {
    const openerId = syncChatToStore(openerText, 'ai');
    appendAIBubble(openerText, undefined, { id: openerId });
    _scheduleNudge();
    setSendEnabled(true);
    // No auto-focus here either — same reasoning as the mid-conversation
    // reply path below: her message arriving shouldn't pop the keyboard
    // open on its own.
  }, openingDelay);
}

function openChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (!sheet) return;
  const cid = state.character?.id || state.character?.name;
  const muteToggle = document.getElementById('chat-settings-mute-toggle');
  if (muteToggle) muteToggle.checked = cid ? localStorage.getItem('chat_muted_' + cid) === 'true' : false;
  clearTimeout(_chatSettingsHideTimer);
  sheet.hidden = false;
  _initChatSettingsSwipeDown();
  // Slides up (and the backdrop fades in) instead of appearing at once: the base
  // CSS keeps it off-screen, and a frame later --in releases it.
  sheet.classList.remove('chat-settings-sheet--in');
  void sheet.offsetWidth;
  requestAnimationFrame(() => sheet.classList.add('chat-settings-sheet--in'));
}
let _chatSettingsHideTimer = null;

// Long-press entry point from the Chats list (see renderChatsList()) — same
// sheet as the in-chat "⋮" menu, just without navigating into the
// conversation first. Reset/Delete/Mute all read off state.activeChatId/
// state.character rather than anything screen-specific, so pointing those
// at the held row's chat and reusing openChatSettings() as-is is enough;
// the sheet itself was moved out of #screen-chat specifically so it's
// visible/interactive while the Chats tab, not the chat screen, is active.
function openChatSettingsForRow(chatId) {
  const chat = chatStore.find(c => c.id === chatId);
  if (!chat) return;
  state.activeChatId = chat.id;
  state.character    = chat.profile;
  state.difficulty   = chat.difficulty;
  state.mode         = chat.mode;
  openChatSettings();
}

// Drag-down-to-dismiss on the sheet itself — tied to live drag position
// (translateY + fading opacity follow the finger, not an instant toggle),
// matching how every other drag dismissal in this app behaves. Attached
// once (guarded by _swipeDownAttached) and reset on every open() in case a
// previous drag left inline styles from a released-but-under-threshold drag.
let _chatSettingsSwipeState = null;
function _initChatSettingsSwipeDown() {
  const wrap = document.querySelector('.chat-settings-sheet-wrap');
  if (!wrap) return;
  wrap.style.transition = '';
  wrap.style.transform = '';
  wrap.style.opacity = '';
  if (wrap._swipeDownAttached) return;
  wrap._swipeDownAttached = true;

  wrap.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    _chatSettingsSwipeState = { startY: e.touches[0].clientY, dy: 0 };
    wrap.style.transition = 'none';
  }, { passive: true });

  wrap.addEventListener('touchmove', e => {
    if (!_chatSettingsSwipeState) return;
    const dy = Math.max(0, e.touches[0].clientY - _chatSettingsSwipeState.startY);
    _chatSettingsSwipeState.dy = dy;
    wrap.style.transform = `translateY(${dy}px)`;
    wrap.style.opacity = String(Math.max(0, 1 - dy / 260));
  }, { passive: true });

  const finish = () => {
    if (!_chatSettingsSwipeState) return;
    const dy = _chatSettingsSwipeState.dy;
    _chatSettingsSwipeState = null;
    wrap.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
    if (dy > 70) {
      closeChatSettings();
    } else {
      wrap.style.transform = '';
      wrap.style.opacity = '';
    }
  };
  wrap.addEventListener('touchend', finish);
  wrap.addEventListener('touchcancel', finish);
}

// "View Profile" row in the chat settings sheet.
function chatSettingsReport() {
  closeChatSettings();
  setTimeout(() => openReportSheet('chat', null), 220);
}

// ---- Report a problem with the AI --------------------------------------------
// From a held message (that reply) or the chat settings (the conversation). A sheet
// asks what went wrong and says plainly that sending shares the WHOLE conversation
// with Zelo; nothing leaves the phone until "Send report". Handled by
// ZeloRecords.submitChatReport (queued if offline / signed out).
const REPORT_REASONS = [
  { id: 'rude',          label: 'It was rude or offensive' },
  { id: 'uncomfortable', label: 'It made me uncomfortable' },
  { id: 'nonsense',      label: "It didn't make sense or ignored what I said" },
  { id: 'robotic',       label: 'It repeated itself or sounded robotic' },
  { id: 'boring',        label: 'It was boring or gave very short answers' },
  { id: 'blocked',       label: 'It blocked me or ended the chat unfairly' },
  { id: 'other',         label: 'Something else' },
];
let _reportCtx = null, _reportHideTimer = null;
function openReportSheet(scope, msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const sheet = document.getElementById('report-sheet');
  if (!chat || !sheet) return;
  const msg = scope === 'message' ? chat.messages.find(m => m.id === msgId) : null;
  _reportCtx = { scope: msg ? 'message' : 'chat', msgId: msg ? msg.id : null, reason: null, sending: false };
  document.getElementById('report-title').textContent = msg ? 'Report this reply' : 'Report a problem';
  document.getElementById('report-sub').textContent = msg ? 'What was wrong with it?' : 'What went wrong in this chat?';
  document.getElementById('report-name').textContent = (state.character && state.character.name) || 'her';
  document.getElementById('report-note').value = '';
  const list = document.getElementById('report-reasons');
  list.innerHTML = '';
  REPORT_REASONS.forEach(r => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'report-reason'; b.dataset.reason = r.id; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.innerHTML = '<span class="report-reason-dot"></span><span></span>';
    b.lastChild.textContent = r.label;
    b.onclick = () => {
      _reportCtx.reason = r.id;
      list.querySelectorAll('.report-reason').forEach(x => { const on = x === b; x.classList.toggle('selected', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
      document.getElementById('report-send').disabled = false;
      _cineHaptic('LIGHT');
    };
    list.appendChild(b);
  });
  const send = document.getElementById('report-send'); send.disabled = true; send.textContent = 'Send report';
  clearTimeout(_reportHideTimer);
  sheet.hidden = false;
  sheet.classList.remove('chat-settings-sheet--in'); void sheet.offsetWidth;
  requestAnimationFrame(() => sheet.classList.add('chat-settings-sheet--in'));
  document.getElementById('report-panel').scrollTop = 0;
}
// Keyboard.resize is "none" in this app, so the sheet is not pushed up by the keyboard on its own:
// lift the note field above it by padding the scrollable panel and scrolling the field into view.
function _syncReportKeyboard() {
  const panel = document.getElementById('report-panel');
  if (!panel) return;
  const kb = window.__zeloKbH || 0;
  panel.style.paddingBottom = kb ? (kb + 16) + 'px' : '';
  const note = document.getElementById('report-note');
  if (kb && document.activeElement === note) setTimeout(() => note.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}
window.addEventListener('zelo-kb', _syncReportKeyboard);
document.addEventListener('focusin', (e) => { if (e.target && e.target.id === 'report-note') setTimeout(_syncReportKeyboard, 350); });

function closeReportSheet() {
  const sheet = document.getElementById('report-sheet');
  if (!sheet || sheet.hidden) return;
  if (_reportCtx && _reportCtx.sending) return;                         // let an in-flight send finish
  const note = document.getElementById('report-note'); if (note) note.blur();
  sheet.classList.remove('chat-settings-sheet--in');
  clearTimeout(_reportHideTimer);
  _reportHideTimer = setTimeout(() => { sheet.hidden = true; }, 320);
}
async function submitReport() {
  const ctx = _reportCtx;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!ctx || !ctx.reason || ctx.sending || !chat) return;
  ctx.sending = true;
  const btn = document.getElementById('report-send'); btn.disabled = true; btn.textContent = 'Sending…';
  const msg = ctx.msgId ? chat.messages.find(m => m.id === ctx.msgId) : null;
  let result = 'queued';
  try {
    result = await ZeloRecords.submitChatReport({
      scope: ctx.scope, reason: ctx.reason, note: document.getElementById('report-note').value.trim(),
      personaId: chat.profile && chat.profile.id, messageId: msg && msg.id, messageText: msg && msg.text,
      conversation: chat.messages.map(m => ({ id: m.id, sender: m.sender, text: m.text, time: m.time ? new Date(m.time).toISOString() : null })),
      build: BUILD_STAMP,
    });
  } catch (e) { result = 'queued'; }
  try { ZeloAnalytics.track('chat_reported', { reason: ctx.reason, scope: ctx.scope, difficulty: state.difficulty }); } catch (e) {}
  ctx.sending = false;
  closeReportSheet();
  showChatToast(result === 'sent' ? 'Report sent. Thanks for helping make Zelo better.' : "Saved. We'll send it as soon as you're signed in and online.");
}

function chatSettingsViewProfile() {
  closeChatSettings();
  setTimeout(() => openPersonaProfile(state.character), 220);
}

function closeChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (!sheet || sheet.hidden) return;
  // Hand the panel back to the stylesheet so it carries on from wherever a
  // swipe left it, down off-screen, rather than jumping.
  const wrap = sheet.querySelector('.chat-settings-sheet-wrap');
  if (wrap) { wrap.style.transition = ''; wrap.style.transform = ''; wrap.style.opacity = ''; }
  sheet.classList.remove('chat-settings-sheet--in');
  clearTimeout(_chatSettingsHideTimer);
  _chatSettingsHideTimer = setTimeout(() => { sheet.hidden = true; }, 320);
}

// Generic centered confirm card (see .chat-confirm-overlay) — reset/delete
// both route through this instead of firing immediately.
let _chatConfirmAction = null;
function _showChatConfirm(title, body, actionLabel, onConfirm) {
  document.getElementById('chat-confirm-title').textContent = title;
  document.getElementById('chat-confirm-body').textContent = body;
  document.getElementById('chat-confirm-action-btn').textContent = actionLabel;
  _chatConfirmAction = onConfirm;
  document.getElementById('chat-confirm-overlay').hidden = false;
}
function chatConfirmCancel() {
  document.getElementById('chat-confirm-overlay').hidden = true;
  _chatConfirmAction = null;
}
function chatConfirmProceed() {
  document.getElementById('chat-confirm-overlay').hidden = true;
  const fn = _chatConfirmAction;
  _chatConfirmAction = null;
  if (fn) fn();
}

function confirmChatSettingsReset() {
  closeChatSettings();
  _showChatConfirm("Reset chat?", "This clears the whole conversation and starts fresh. This can't be undone.", "Reset", chatSettingsReset);
}
function confirmChatSettingsDelete() {
  closeChatSettings();
  _showChatConfirm("Delete chat?", "This permanently deletes this conversation. This can't be undone.", "Delete", chatSettingsDelete);
}

function chatSettingsMuteToggle(value) {
  const cid = state.character?.id || state.character?.name;
  if (cid) localStorage.setItem('chat_muted_' + cid, String(value));
}

function chatSettingsReset() {
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
  const cid = state.character?.id || state.character?.name;
  if (cid) {
    localStorage.removeItem('chat_' + cid);
    delete state.chatHistory;
  }
  const resetChat = chatStore.find(c => c.id === state.activeChatId);
  if (resetChat) { resetChat.messages = []; resetChat.strikes = 0; resetChat.cleanRun = 0; resetChat.blocked = false; resetChat.nudges = 0; resetChat.replyFailed = null; }
  abortPendingReply(); // the thread is about to be wiped — a reply still in flight must not land in it
  _clearStagedReply();
  setSendEnabled(false);
  const resetOpenerText = (state.character?.opener) || 'hey';
  const openerId = syncChatToStore(resetOpenerText, 'ai');
  appendAIBubble(resetOpenerText, undefined, { id: openerId });
  _scheduleNudge();
  setSendEnabled(true);
  _syncBlockedUI();
  renderChatsList(); // updates the list row's preview text if it's the visible screen (e.g. reset via long-press there)
  _renderChatChips();
}

function chatSettingsDelete() {
  closeChatSettings();
  const cid = state.character?.id || state.character?.name;
  if (cid) localStorage.removeItem('chat_' + cid);
  // This only ever cleared the localStorage cache and navigated away —
  // it never actually removed the chat from chatStore (the array
  // renderChatsList()/onDeleteChat() are the source of truth for), so
  // "Delete Chat" here didn't actually delete it from the Chats list.
  // Now matches onDeleteChat()'s own removal + re-render.
  const idx = chatStore.findIndex(c => c.id === state.activeChatId);
  if (idx >= 0) chatStore.splice(idx, 1);
  saveChats();
  renderChatsList();
  exitChat();
}

function exitChat() {
  _cancelSuggestions();
  _trackPracticeEnd();
  cancelPendingReply();
  // Same defensive clear as closeAiCoach() — see its comment. Instant
  // (no ease-back) — this is leaving the screen entirely, so any animated
  // settle here reads as "the screen moves by itself" during a navigation
  // that should hold completely still.
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  if (_restoreHistoryReturn()) return;
  if (state.screenStack.length > 0) { popScreen(); return; }
  // If we came from chats tab, return there; otherwise practice
  const returnTab = state.activeTab === 'chats' ? 'chats' : 'practice';
  showTab(returnTab);
}


// Composer's AI Coach entry point — opens as a bottom sheet over the still-
// visible chat, pre-loaded with a read-only replay of THIS chat's own live
// messages (see renderAiCoachChat()'s _aiCoachChatSheetOpen branch), rather
// than the full-page navigation + separate scan-thread-linking system used
// by the Home tab card / History row (openAiCoach()). chatStore's live
// practice matches were never wired into that thread-linking concept
// (zelo_threads is Scan-saved conversation logs, a different store), so
// this reads chatStore directly instead of going through getLinkedThread().
function openAiCoachFromChat() {
  _aiCoachChatSheetOpen = true;
  _aiCoachAutoThreadId = null;
  if (document.activeElement
    && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  _aiCoachChat = [];
  renderAiCoachChat();
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  toggleAiCoachHistoryPanel(false);
  const limit = document.getElementById('aicoach-limit');
  if (limit) limit.hidden = true;

  const screen = document.getElementById('screen-ai-coach');
  const backdrop = document.getElementById('aicoach-chat-sheet-backdrop');
  screen.classList.add('active', 'aicoach-sheet-open');
  backdrop.hidden = false;
  // Added a frame apart on purpose: .aicoach-sheet-open alone (see
  // style.css) rests at transform:translateY(100%), so the browser paints
  // that off-screen position first — adding .aicoach-sheet-visible next
  // frame is what actually triggers the slide-up transition, instead of the
  // sheet just appearing already open with nothing to animate.
  requestAnimationFrame(() => {
    screen.classList.add('aicoach-sheet-visible');
    backdrop.classList.add('aicoach-sheet-visible');
  });
}

// Closes the chat-sheet presentation above, back to the chat screen
// underneath — which was never actually hidden (see openAiCoachFromChat()).
// Mirrors closeAiCoach()'s own exit bookkeeping (autosave/unlink) but skips
// popScreen() entirely: this sheet was never pushed onto state.screenStack,
// so popping it here would incorrectly pop the CHAT screen's own prior entry
// instead.
function closeAiCoachChatSheet() {
  if (!_aiCoachChatSheetOpen) return;
  _autoSaveAiCoachChatOnExit();
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  const screen = document.getElementById('screen-ai-coach');
  const backdrop = document.getElementById('aicoach-chat-sheet-backdrop');
  screen.classList.remove('aicoach-sheet-visible');
  backdrop.classList.remove('aicoach-sheet-visible');
  _aiCoachChatSheetOpen = false;
  _aiCoachScanSheet = false;
  setTimeout(() => {
    // By this point the sheet has already slid down to translateY(100%),
    // fully off-screen. Removing .aicoach-sheet-open here resets `top` from
    // 11% back to .screen's plain 0 and drops the translateY with it — an
    // instant snap, since nothing in .aicoach-sheet-open transitions `top`.
    // But .screen's OWN base rule (`transition: opacity 0.18s ease`, not
    // scoped to .active) still applies independently of any of that, so the
    // very same tick's .active removal fades opacity 1→0 over that 0.18s —
    // and for that whole fade, the element is already back to its full-
    // screen shape, not the sheet's. That's the flash: a full-screen glimpse
    // of AI Coach fading in over the chat right as it's supposed to have
    // already fully closed. Suppressing the transition for this one cleanup
    // swap (same fix already used for the equivalent bug in
    // attachEdgeSwipeBack()'s finish()) makes it an instant, invisible
    // state correction instead of a visible fade.
    screen.style.transition = 'none';
    screen.classList.remove('active', 'aicoach-sheet-open');
    screen.style.transform = ''; // clears any leftover drag-gesture inline transform
    backdrop.hidden = true;
    void screen.offsetHeight; // flush the above before re-arming transitions
    requestAnimationFrame(() => { screen.style.transition = ''; });
  }, 320); // matches the CSS slide transition duration in style.css
}

// Swipe-down-to-dismiss anywhere on the chat-sheet, not just its drag
// handle — attached to the whole #screen-ai-coach (the handle is a
// descendant, so touches starting on it are covered too by the same
// listener; no separate handler needed there). Only actually arms while
// _aiCoachChatSheetOpen (the normal full-page AI Coach never gets this).
//
// #aicoach-messages is real scrollable content though — a downward drag
// there is ambiguous (could mean "scroll up to earlier messages" just as
// easily as "close the sheet"), so a drag starting inside it only arms once
// it's already scrolled to the top, same established pattern as
// attachProfileDetailDragToClose() elsewhere in this app. Anywhere else on
// the sheet (header, suggestions panel, input bar, footer) arms immediately.
//
// This runs alongside the generic attachEdgeSwipeBack('screen-ai-coach', ...)
// registered above, which listens for horizontal (rightward) drags on this
// same element — that registration's own `disabled` check bails out
// entirely while the sheet is open (see its own comment), so only this
// vertical gesture is ever actually live at once; no fighting over the
// same touch sequence.
function attachAiCoachChatSheetDragClose() {
  const screen = document.getElementById('screen-ai-coach');
  const messagesEl = document.getElementById('aicoach-messages');
  if (!screen) return;

  const DRAG_DEADZONE = 6;
  let startY = 0, dragging = false, committed = false, dy = 0;

  function onStart(clientY, target) {
    if (!_aiCoachChatSheetOpen) return;
    // The conversation never arms the close-drag, at any scroll position.
    // Gating it on "only while scrolled to the top" still meant a downward
    // drag to pull older messages into view closed the sheet instead of
    // scrolling, which is exactly what the user hit. There's plenty of
    // other surface to close from — the header, the suggestions panel, the
    // input bar and the footer all still arm immediately.
    if (messagesEl && messagesEl.contains(target)) return;
    startY = clientY;
    dragging = true;
    committed = false;
    dy = 0;
  }
  function onMove(clientY, e) {
    if (!dragging) return;
    const rawDy = clientY - startY;
    if (!committed) {
      if (rawDy < DRAG_DEADZONE) return; // still within the tap deadzone, or an upward drag — leave it alone entirely
      committed = true;
      screen.style.transition = 'none';
    }
    dy = Math.max(0, rawDy);
    // Not passive — stops the browser from also scrolling #aicoach-messages
    // underneath once this has committed to being a close-drag, same
    // reasoning as attachAiCoachRowActionsDragClose()'s own non-passive
    // touchmove.
    if (e && e.cancelable) e.preventDefault();
    screen.style.transform = `translateY(${dy}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    if (committed && dy > 100) {
      // The drag left `transition: none` and a static translateY(dy) in
      // place (set above, to track the finger 1:1 with no lag) — without
      // explicitly re-arming a transition and an actual target value here,
      // that frozen position would just sit untouched for the whole 320ms
      // of closeAiCoachChatSheet()'s own cleanup delay, then snap shut
      // instantly at the end of it: a visible stop-then-jump instead of one
      // continuous motion. Animating the rest of the way closed here, in
      // the same easing/duration the CSS class-driven open/close otherwise
      // uses, makes the release read as a natural continuation of the drag.
      screen.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
      screen.style.transform = 'translateY(100%)';
      closeAiCoachChatSheet();
    } else if (committed) {
      screen.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      screen.style.transform = '';
      setTimeout(() => { screen.style.transition = ''; }, 320);
    }
    dy = 0;
    committed = false;
  }

  screen.addEventListener('touchstart', e => onStart(e.touches[0].clientY, e.target), { passive: true });
  screen.addEventListener('touchmove',  e => onMove(e.touches[0].clientY, e),  { passive: false });
  screen.addEventListener('touchend',   onEnd);
  screen.addEventListener('touchcancel', onEnd);
}

// ================================================================
