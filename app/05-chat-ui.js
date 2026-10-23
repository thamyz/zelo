// ================================================================
// 05-chat-ui.js — drawing the chat: bubbles, menus, banners
//
// Appending bubbles, grouping, the long-press message menu, swipe-to-reply,
// reactions, and the banner shown when she replies while you are elsewhere.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// CHAT: DOM HELPERS
// ================================================================

// Plays the entrance animation once and then takes it off the element.
// Leaving `animation` on permanently (as the CSS used to) means every
// reparent restarts it — the swipe-nav blink.
function _playRowEntrance(row, cls) {
  row.classList.add(cls);
  setTimeout(() => row.classList.remove(cls), 220);
}

function appendUserBubble(text, opts = {}) {
  const messages = document.getElementById("chat-messages");
  messages.querySelectorAll(".msg-status").forEach(s => s.remove());

  const row    = document.createElement("div");
  row.className = "msg-row user";
  if (opts.id) row.dataset.msgId = opts.id;

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble user";
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));

  const timestamp = document.createElement("div");
  timestamp.className   = "msg-timestamp";
  timestamp.textContent = formatTime();

  // Seen will be written here by scheduleReply; starts empty (no "Delivered")
  const status = document.createElement("div");
  status.className = "msg-status";
  status.id        = "last-msg-status";

  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  wrap.appendChild(status);
  row.appendChild(wrap);
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
  scrollToBottom();
}

function appendAIBubble(text, atTime, opts = {}) {
  const messages = document.getElementById("chat-messages");
  const wasNearBottom = _isChatNearBottom(); // sampled before this row changes the height

  const row    = document.createElement("div");
  row.className = "msg-row ai";
  if (opts.id) row.dataset.msgId = opts.id;

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble ai";
  const quoteEl = _buildReplyQuoteEl(opts.replyToId);
  if (quoteEl) bubble.appendChild(quoteEl);
  bubble.appendChild(document.createTextNode(text));

  const timestamp = document.createElement("div");
  timestamp.className   = "msg-timestamp";
  timestamp.textContent = formatTime(atTime);

  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(createMsgAvatar(true));
  row.appendChild(wrap);
  messages.appendChild(row);
  _playRowEntrance(row, 'msg-row--in');
  _applyMsgGrouping(row);
  if (opts.id) { _attachReplyLongPress(row, opts.id); _attachSwipeToReply(row, opts.id); _renderMsgReactionBadge(opts.id); }
  _followChatIfAtBottom(wasNearBottom, true);
}

// Consecutive messages from the same sender read as one run (double/triple
// texts, either side) — so only the LAST message in a run keeps its avatar
// and timestamp, exactly like iMessage/Instagram. Applied to the row BEFORE
// the one just appended: that row has just stopped being the run's last.
// Walks back past non-.msg-row siblings on purpose — scrollToBottom()'s
// overflow spacer is re-appended at the end each time, so it's routinely
// sitting between the previous message and the new one at this point.
function _applyMsgGrouping(newRow) {
  let prev = newRow.previousElementSibling;
  while (prev && !prev.classList.contains('msg-row')) prev = prev.previousElementSibling;
  if (!prev) return;
  const sameSender = prev.classList.contains('user') === newRow.classList.contains('user');
  if (sameSender) prev.classList.add('msg-row--grouped');
}

// Reply-to-message: a bubble with a replyToId shows a compact quoted strip
// above its own text, referencing the original message (truncated).
// Manual/opt-in only (long-press a row to stage it, see
// _attachReplyLongPress) — never auto-attached to a double/triple-text
// burst, so it doesn't clutter every turn.
function _buildReplyQuoteEl(replyToId) {
  if (!replyToId) return null;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const original = chat ? chat.messages.find(m => m.id === replyToId) : null;
  if (!original) return null;
  const quote = document.createElement("div");
  quote.className = "msg-reply-quote";
  quote.textContent = original.text.length > 80 ? original.text.slice(0, 80) + '…' : original.text;
  quote.addEventListener('click', () => _scrollToMessage(replyToId));
  return quote;
}

// Scrolls to and briefly highlights the original message a reply-quote
// strip points at.
function _scrollToMessage(id) {
  const row = document.querySelector(`.msg-row[data-msg-id="${id}"]`);
  if (!row) return;
  row.scrollIntoView({ block: 'center' });
  row.classList.add('msg-row--highlight');
  setTimeout(() => row.classList.remove('msg-row--highlight'), 1200);
}

// Long-press a message row to stage it as "replying to" — no intermediate
// menu, since reply is the only action a press on a chat bubble offers.
// Same 500ms-hold-cleared-on-move convention as AI Coach history rows'
// _aiCoachLongPressTimer.
// 300ms, not the 500ms used for list rows elsewhere — this fires on a
// message bubble where there's nothing else a press could mean, and the
// user asked for it to feel immediate. Buzzes on open the way iOS/Instagram
// do, so the menu never appears without the press being acknowledged first.
const MSG_LONG_PRESS_MS = 300;
let _chatRowLongPressTimer = null;
function _attachReplyLongPress(row, msgId) {
  row.addEventListener('touchstart', () => {
    clearTimeout(_chatRowLongPressTimer);
    _chatRowLongPressTimer = setTimeout(() => {
      navigator.vibrate?.(12);
      _cineHaptic('MEDIUM');
      openMsgMenu(msgId, row);
    }, MSG_LONG_PRESS_MS);
  }, { passive: true });
  row.addEventListener('touchmove', () => clearTimeout(_chatRowLongPressTimer), { passive: true });
  row.addEventListener('touchend',  () => clearTimeout(_chatRowLongPressTimer), { passive: true });
  row.addEventListener('touchcancel', () => clearTimeout(_chatRowLongPressTimer), { passive: true });
}

// Swipe a message to the right to reply to it — the shortcut for the menu's
// own Reply action. The row follows the finger with resistance, springs
// back on release, and fires the reply past the trigger distance.
const SWIPE_REPLY_TRIGGER = 56;
const SWIPE_REPLY_MAX     = 78;
// The row has to travel past the avatar (28px + 6px margin) before the icon
// shows — revealing it sooner put it on top of the pfp, then on the message.
const SWIPE_REPLY_REVEAL  = 34;
// Set by a row the moment its swipe commits horizontally, so the back
// gesture (which sees the same touch a few pixels later, as it bubbles up)
// can stand down for that one drag instead of both running at once. Back
// swipe therefore works anywhere EXCEPT on a drag a row has claimed.
let _msgRowSwipeClaimed = false;

function _attachSwipeToReply(row, msgId) {
  // Her messages sit on the left and pull right; yours sit on the right and
  // pull left. Mirroring it this way also leaves rightward drags on your own
  // messages free for the back gesture.
  const dir = row.classList.contains('user') ? -1 : 1;

  const icon = document.createElement('span');
  icon.className = 'msg-swipe-reply-icon';
  icon.innerHTML = `<img src="assets/icons/chats-page/msg-menu/reply.png" alt="" aria-hidden="true" onerror="this.remove()">`;
  row.appendChild(icon);

  let startX = 0, startY = 0, axis = null, armed = false, active = false, pull = 0;

  function paint() {
    row.style.transform = `translateX(${pull * dir}px)`;
    // The icon is a child of the row, so the row's own transform drags it
    // along too — which is why it kept ending up over the avatar and then
    // over the message. Counter-translating by the same amount pins it to
    // the far edge while the bubble slides out from under it.
    // It also stays hidden until the row has travelled past the avatar, so
    // it only appears once there's actually clear space for it.
    const progress = Math.max(0, Math.min(1,
      (pull - SWIPE_REPLY_REVEAL) / Math.max(1, SWIPE_REPLY_TRIGGER * 0.55 - SWIPE_REPLY_REVEAL)));
    icon.style.opacity = String(progress);
    icon.style.transform = `translateX(${-pull * dir}px) scale(${0.7 + 0.3 * progress})`;
  }
  function reset(withTransition) {
    row.style.transition = withTransition ? 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    row.style.transform = '';
    icon.style.transition = withTransition ? 'opacity 0.18s ease' : 'none';
    icon.style.opacity = '0';
    icon.style.transform = '';
  }

  row.addEventListener('touchstart', e => {
    active = false;
    if (e.touches.length !== 1) return;
    const o = document.getElementById('msg-menu-overlay');
    if (o && !o.hidden) return; // menu is up; it owns the screen
    active = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    axis = null; armed = false; pull = 0;
    row.style.transition = 'none';
    icon.style.transition = 'none';
  }, { passive: true });

  row.addEventListener('touchmove', e => {
    if (!active || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Only the direction this row replies in, and only when it's clearly
      // horizontal — anything else stays a plain scroll.
      axis = (dx * dir > 0 && Math.abs(dx) > Math.abs(dy)) ? 'x' : 'dead';
    }
    if (axis !== 'x') return;
    e.preventDefault(); // committed horizontally: don't also scroll the thread
    _msgRowSwipeClaimed = true; // this touch belongs to the row, not to back-swipe
    // Directional, floored at zero. Using Math.abs() here was the bug that
    // made the row swing back OUT again once the finger went past the start
    // in the opposite direction — abs() turned that negative travel back
    // into a positive pull, so one drag read as two.
    pull = Math.max(0, Math.min(SWIPE_REPLY_MAX, (dx * dir) * 0.55));
    paint();
    const past = pull >= SWIPE_REPLY_TRIGGER * 0.55;
    if (past && !armed) {
      armed = true; // buzz on crossing, and again if they pull back and out
      navigator.vibrate?.(10);
      _cineHaptic('LIGHT');
    } else if (!past) {
      armed = false;
    }
  }, { passive: false });

  function release() {
    _msgRowSwipeClaimed = false;
    if (!active) return;
    // Judged on where the finger ACTUALLY ended, not on whether it was ever
    // far enough — dragging out and then back near the start now cancels,
    // which is what the latched flag used to get wrong.
    const committed = axis === 'x' && pull >= SWIPE_REPLY_TRIGGER * 0.55;
    active = false; axis = null; armed = false; pull = 0;
    reset(true);
    if (committed) _stageReplyTo(msgId);
  }
  row.addEventListener('touchend', release, { passive: true });
  row.addEventListener('touchcancel', release, { passive: true });
}

// Rubber-band nudge for "no more photos this way". Driven by a class so
// the motion lives in CSS with the rest of the card's animation, and
// re-armed by stripping the class first — otherwise a second tap at the
// same edge does nothing, because restarting a running CSS animation
// requires it to be removed and reflowed in between.
function _bounceCardEdge(cardEl, dir) {
  const cls = dir < 0 ? 'swipe-card--edge-left' : 'swipe-card--edge-right';
  cardEl.classList.remove('swipe-card--edge-left', 'swipe-card--edge-right');
  void cardEl.offsetWidth; // reflow, so the animation can restart
  cardEl.classList.add(cls);
  // navigator.vibrate alone does nothing on iOS — WKWebView doesn't
  // implement it. _cineHaptic() is the Capacitor Haptics call that actually
  // fires on device, and every other haptic in this file pairs the two.
  navigator.vibrate?.(6);
  _cineHaptic('LIGHT');
  setTimeout(() => cardEl.classList.remove(cls), 340);
}

// ---- Message long-press menu (Instagram-style) ----------------------
// Emoji reaction row above the pressed message, action list below it, the
// rest of the screen blurred back. Reference screenshots the user supplied
// live in assets/icons/chats-page/ alongside the cropped menu icons.
const MSG_QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🥹'];
const MSG_MORE_REACTIONS  = ['🔥', '😭', '🙄', '😅', '👀', '💀', '🫶', '😤'];
// Kept in sync with the stack's transform transition in style.css. The
// travel's easing is front-loaded, so it's visually home well before the
// 240ms transition formally ends — SETTLE fires at that visual landing, not
// at the end, or there's a dead beat before the emoji row pops.
const MSG_MENU_TRAVEL_MS = 240;
const MSG_MENU_SETTLE_MS = 150;
const MSG_MENU_CLOSE_MS  = 180;
let _msgMenuTargetId = null;
let _msgMenuSettleTimer = null;
let _msgMenuCloseTimer = null;

function _activeChatMsg(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  return chat ? chat.messages.find(m => m.id === msgId) : null;
}

function openMsgMenu(msgId, row) {
  const msg = _activeChatMsg(msgId);
  const overlay = document.getElementById('msg-menu-overlay');
  if (!msg || !overlay || !row) return;
  _msgMenuTargetId = msgId;

  const stack = document.getElementById('msg-menu-stack');
  const slot  = document.getElementById('msg-menu-bubble-slot');
  const isUser = msg.sender === 'user';
  stack.classList.toggle('msg-menu-stack--user', isUser);

  // The whole row is cloned, avatar included, and the slot carries the same
  // side padding as .chat-messages — so the lifted copy lands at exactly the
  // same indent as the real one without any per-side offset math. The
  // grouped class is dropped so the time always shows here, even when the
  // real row had it merged away into the run below it.
  const clone = row.cloneNode(true);
  clone.classList.remove('msg-row--grouped');
  // The clone is a visual copy only — it must NOT stay addressable by id,
  // or `.msg-row[data-msg-id=...]` lookups (_scrollToMessage,
  // _renderMsgReactionBadge) can resolve to this copy instead of the real
  // message, and a repaint of the thread underneath would appear to leave
  // the row behind.
  clone.removeAttribute('data-msg-id');
  clone.querySelectorAll('.msg-status, .bubble-reaction').forEach(el => el.remove());
  slot.innerHTML = '';
  slot.appendChild(clone);

  _renderMsgMenuReactions(false);
  _renderMsgMenuActions(msg);

  // The long-press that opened this menu also looks, to the global
  // keyboard-dismiss handler, like a tap outside a focused input — so if
  // the composer was focused (staging a reply focuses it, for one), that
  // handler has just armed a one-shot click swallower and dropped a
  // full-screen blocker over everything for 500ms. Both would eat the
  // user's first tap on this menu and leave it sitting there doing
  // nothing. Opening the menu is deliberate, not a dismiss gesture, so
  // stand both down now that it's up.
  document.removeEventListener('click', _swallowKeyboardDismissClick, { capture: true });
  document.querySelectorAll('.kb-dismiss-click-blocker').forEach(el => el.remove());

  const rowRect = _rectA(row);
  overlay.hidden = false;
  _positionMsgMenu();

  // The lifted copy starts exactly where the real message sits in the thread
  // and travels up into place, so the menu reads as coming out of the message
  // the user pressed rather than just appearing somewhere else. Measured off
  // the slot's offset inside the stack, so the emoji row's reserved height
  // (it's invisible until the stack lands) is already accounted for.
  const travelY = Math.round(rowRect.top - (stack.offsetTop + slot.offsetTop));
  stack.style.transition = 'none';
  stack.style.transform = `translateY(${travelY}px) scale(0.96)`;
  void stack.offsetHeight; // flush, so the clearing below animates FROM here
  requestAnimationFrame(() => {
    stack.style.transition = '';
    stack.style.transform = '';
    overlay.classList.add('msg-menu-overlay--in');
  });
  // Emoji row pops and the action card bounces only once the travel has
  // landed — see the --settled rules in style.css.
  clearTimeout(_msgMenuSettleTimer);
  _msgMenuSettleTimer = setTimeout(() => overlay.classList.add('msg-menu-overlay--settled'), MSG_MENU_SETTLE_MS);
}

// Centres the stack vertically, clamped inside the safe area. Called on open
// and again if the emoji row is expanded, since that makes the stack taller
// ---- App coordinate space -------------------------------------------------
// On iPad the whole app is laid out small and scaled up (see the
// "iPad / large touch screens" block in style.css), so window.innerWidth /
// innerHeight are DEVICE pixels while everything the app lays out, and every
// CSS px it writes, is in the smaller pre-scale space. getBoundingClientRect()
// reports post-transform (device) values, so any calculation that mixes a rect
// with offsetWidth/innerHeight and then writes a px value has to agree on one
// space. These return the app's own space; all three are no-ops on a phone,
// where the scale is 1.
function _appScale() {
  const a = document.getElementById('app');
  if (!a || !a.offsetWidth) return 1;
  const s = a.getBoundingClientRect().width / a.offsetWidth;
  return s > 0.01 ? s : 1;
}
function _appW() { const a = document.getElementById('app'); return a ? a.clientWidth  : window.innerWidth;  }
// An element's rect in the app's own space. getBoundingClientRect() reports
// post-transform (device) values, so any rect number that is going to be
// written back out as a px style / transform has to come through here or it
// lands scale-times too far. Identity on a phone.
function _rectA(el) {
  const r = el.getBoundingClientRect();
  const s = _appScale();
  if (s === 1) return r;
  return { left: r.left / s, top: r.top / s, right: r.right / s, bottom: r.bottom / s,
           width: r.width / s, height: r.height / s };
}
function _appH() { const a = document.getElementById('app'); return a ? a.clientHeight : window.innerHeight; }

// and could otherwise push the actions off the bottom of the screen.
function _positionMsgMenu() {
  const stack = document.getElementById('msg-menu-stack');
  if (!stack) return;
  const SAFE_TOP = 56, SAFE_BOTTOM = 40;
  const stackH = stack.offsetHeight;
  const appH = _appH();
  let top = Math.round((appH - stackH) / 2);
  top = Math.max(SAFE_TOP, Math.min(top, appH - stackH - SAFE_BOTTOM));
  stack.style.top = top + 'px';
}

function closeMsgMenu() {
  const overlay = document.getElementById('msg-menu-overlay');
  if (!overlay || overlay.hidden) return;
  clearTimeout(_msgMenuSettleTimer);
  // No reverse travel and no bounce on the way out — everything just settles
  // down and fades together. --settled deliberately stays on so the emoji
  // row's pop animation keeps its finished state while it fades, instead of
  // snapping back to its hidden start frame.
  overlay.classList.remove('msg-menu-overlay--in');
  overlay.classList.add('msg-menu-overlay--out');
  clearTimeout(_msgMenuCloseTimer);
  _msgMenuCloseTimer = setTimeout(() => {
    overlay.hidden = true;
    overlay.classList.remove('msg-menu-overlay--out', 'msg-menu-overlay--settled');
    const stack = document.getElementById('msg-menu-stack');
    if (stack) { stack.style.transform = ''; stack.style.transition = ''; }
    _msgMenuTargetId = null;
  }, MSG_MENU_CLOSE_MS);
}

function _renderMsgMenuReactions(expanded) {
  const el = document.getElementById('msg-menu-reactions');
  if (!el) return;
  const msg = _activeChatMsg(_msgMenuTargetId);
  const list = expanded ? MSG_QUICK_REACTIONS.concat(MSG_MORE_REACTIONS) : MSG_QUICK_REACTIONS;
  el.classList.toggle('msg-menu-reactions--expanded', expanded);
  el.innerHTML = '';
  list.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msg-menu-reaction' + (msg && msg.reaction === emoji ? ' msg-menu-reaction--on' : '');
    btn.textContent = emoji;
    btn.addEventListener('click', () => _toggleMsgReaction(emoji));
    el.appendChild(btn);
  });
  if (!expanded) {
    const div = document.createElement('span');
    div.className = 'msg-menu-reaction-div';
    el.appendChild(div);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'msg-menu-reaction msg-menu-reaction--plus';
    plus.setAttribute('aria-label', 'More reactions');
    plus.innerHTML = `<img src="assets/icons/chats-page/msg-menu/add.png" alt="" aria-hidden="true" onerror="this.remove()">`;
    plus.addEventListener('click', () => { _renderMsgMenuReactions(true); _positionMsgMenu(); });
    el.appendChild(plus);
  }
}

function _toggleMsgReaction(emoji) {
  const msg = _activeChatMsg(_msgMenuTargetId);
  if (!msg) return;
  msg.reaction = msg.reaction === emoji ? null : emoji;
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
  _renderMsgReactionBadge(msg.id);
  closeMsgMenu();
}

// Paints (or clears) the little reaction badge on the real bubble without
// re-rendering the whole thread.
function _renderMsgReactionBadge(msgId) {
  const msg = _activeChatMsg(msgId);
  const row = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (!row) return;
  const wrap = row.querySelector('.msg-wrap');
  wrap.querySelectorAll('.bubble-reaction').forEach(el => el.remove());
  if (msg && msg.reaction) {
    const badge = document.createElement('span');
    badge.className = 'bubble-reaction';
    badge.textContent = msg.reaction;
    // Straight after the bubble, not at the end of the wrap — the
    // timestamp has to stay below it.
    wrap.querySelector('.bubble')?.insertAdjacentElement('afterend', badge);
  }
}

function _renderMsgMenuActions(msg) {
  const el = document.getElementById('msg-menu-actions');
  if (!el) return;
  const ICONS = 'assets/icons/chats-page/msg-menu';
  const items = [
    // Her messages only: ask for ideas on what to send back to THIS message.
    ...(msg.sender !== 'user' ? [{ src: 'assets/icons/aicoach-topics/mascot-brand.png', label: 'Get hints', sepAfter: true, fn: () => { closeMsgMenu(); requestHintsFor(msg.id); } }] : []),
    { icon: 'reply',  label: 'Reply',          fn: () => { closeMsgMenu(); _stageReplyTo(msg.id); } },
    { icon: 'copy',   label: 'Copy',           fn: () => { _copyMsgText(msg.text); closeMsgMenu(); } },
    { icon: 'delete', label: 'Delete for you', fn: () => { closeMsgMenu(); _deleteMsgForYou(msg.id); } },
    // On her reply it reports THAT reply; on one of yours it reports the conversation (you are not the thing being reported).
    { icon: 'report', label: 'Report', fn: () => { closeMsgMenu(); setTimeout(() => openReportSheet(msg.sender !== 'user' ? 'message' : 'chat', msg.id), 180); }, danger: true },
  ];
  el.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'msg-menu-action' + (item.danger ? ' msg-menu-action--danger' : '');
    btn.innerHTML = `<img src="${item.src || `${ICONS}/${item.icon}.png`}" alt="" aria-hidden="true" onerror="this.remove()"><span>${item.label}</span>`;
    btn.addEventListener('click', item.fn);
    el.appendChild(btn);
    if (item.sepAfter) el.appendChild(Object.assign(document.createElement('div'), { className: 'msg-menu-sep' }));
  });
}

function _copyMsgText(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function _deleteMsgForYou(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return;
  const i = chat.messages.findIndex(m => m.id === msgId);
  if (i === -1) return;
  chat.messages.splice(i, 1);
  // Anything still pointing at the message that just went away would render
  // a quote strip with nothing behind it — _buildReplyQuoteEl() already
  // bails on a missing target, but clearing it keeps the stored data honest.
  chat.messages.forEach(m => { if (m.replyToId === msgId) delete m.replyToId; });
  if (state.stagedReplyToId === msgId) _clearStagedReply();
  const last = chat.messages[chat.messages.length - 1];
  chat.lastMessage = last ? last.text : '';
  _rerenderChatMessages();
}

// Re-entering a chat has been reported on-device as showing a blank white
// area where the thread should be, until a touch makes it appear — i.e. the
// rebuilt list is laid out but its layer never gets painted as the screen
// fades back in. Not reproducible in headless Chrome (the rows are present,
// positioned and visible there), so this is a WKWebView compositing nudge
// rather than a diagnosed fix: touching opacity for one frame forces the
// layer to be invalidated and repainted. Costs nothing where the bug
// doesn't happen — but it does need confirming on a real device.
function _forceChatRepaint() {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  requestAnimationFrame(() => {
    // Mirrors the exact thing that makes it appear on device — a scroll.
    // scroll-behavior is forced to auto first or the nudge animates instead
    // of applying immediately (this file has been bitten by that before).
    const prevBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = 'auto';
    // Land on the newest message. This has to happen HERE, after
    // pushScreen() has made the screen active — _rerenderChatMessages()
    // runs while it's still inactive, where clientHeight isn't yet the real
    // one, so its own scroll resolved against the wrong height and left the
    // thread sitting at the top.
    _ensureScrollableOverflow(el, 48);
    el.scrollTop = Math.max(0, _logicalScrollHeight(el) - el.clientHeight);
    el.style.scrollBehavior = prevBehavior;
    // ...plus a layer touch, for the case where the stale layer isn't the
    // scroller's own.
    el.style.opacity = '0.999';
    requestAnimationFrame(() => { el.style.opacity = ''; });
  });
}

// Is `chatId` the conversation actually on screen right now? Her reply can
// outlive you leaving the chat, so every paint has to be gated on this.
// A genuine abort — the thread this reply belongs to is being destroyed, so
// it must NOT be allowed to land. Bumping the generation is what the
// delivery loop checks; cancelPendingReply() no longer does this, because
// merely navigating away should let the reply finish.
function abortPendingReply() {
  _clearNudge();
  state.chatReplyGen = (state.chatReplyGen || 0) + 1;
  if (state.pendingTimer !== null) { clearTimeout(state.pendingTimer); state.pendingTimer = null; }
  _clearChatPacing();
  _setChatTyping(state.activeChatId, false);
  state.awaitingReply = false;
  setSendEnabled(true);
}

// One place that knows whether she is typing in a chat. The flag lives on the chat, so it survives
// leaving it: the Chats list shows animated dots on her row, and opening the chat again mid-reply
// brings the in-thread indicator back (leaving only removes the DOM bubble, see cancelPendingReply).
function _typingDotsHTML() {
  return '<span class="typing-dots-inline" aria-label="typing"><i class="typing-dot"></i><i class="typing-dot"></i><i class="typing-dot"></i></span>';
}
function _setChatTyping(chatId, on) {
  const chat = chatStore.find(c => c.id === chatId);
  if (chat) chat.typing = !!on;
  const row = document.querySelector(`#chats-list .chat-row[data-chat-id="${chatId}"] .chat-row-preview`);
  if (row && chat) {
    if (on) row.innerHTML = _typingDotsHTML();
    else row.textContent = chat.lastMessage || '';
  }
  if (_chatIsLive(chatId)) {
    if (on) { setHeaderStatus('typing'); showTypingIndicator(); }
    else { hideTypingIndicator(); setHeaderStatus('online'); }
  }
}

function _chatIsLive(chatId) {
  const screen = document.getElementById('screen-chat');
  return !!chatId && state.activeChatId === chatId && !!screen && screen.classList.contains('active');
}

// Always stores the message; only paints it when that chat is the one on
// screen. Leaving mid-reply therefore still gets the message — it lands in
// the thread and the chats list shows it unread — instead of the reply
// being thrown away as though it had never sent.
function _deliverAiPart(part, chatId) {
  const id = syncChatToStore(part.text, 'ai', part.replyToId, chatId);
  if (_chatIsLive(chatId)) {
    appendAIBubble(part.text, undefined, { id, replyToId: part.replyToId });
  } else {
    const chat = chatStore.find(c => c.id === chatId);
    if (chat) chat.unread = (chat.unread || 0) + 1;
    renderChatsList();
    showMsgBanner(chatId, part.text);
  }
  return id;
}

// ================================================================
// MESSAGE BANNER — a girl replied while you were somewhere else
// Like an Instagram reply notification: her picture on the left, her name on top, what she
// said underneath. It drops in from the top (same geometry as every other banner in the app),
// stays about 4.5 s, and tapping it opens her chat. Swipe it up to dismiss. Not shown for the
// chat you are already looking at, her muted chats, onboarding or the locked screen. It does show
// on the Chats list too (the row's unread badge alone was too easy to miss). Several messages in a row
// from the same girl update the one banner instead of stacking.
// ================================================================
const MSG_BANNER = { ms: 4500 };   // an object so the duration can be changed in tests, like NUDGE
let _msgBannerTimer = null, _msgBannerChatId = null, _msgBannerSwiped = false;

function showMsgBanner(chatId, text) {
  const chat = chatStore.find(c => c.id === chatId);
  const el = document.getElementById('msg-banner');
  if (!chat || !el || _chatIsLive(chatId)) return;
  const pid = chat.profile && (chat.profile.id || chat.profile.name);
  if (pid && localStorage.getItem('chat_muted_' + pid) === 'true') return;
  const onb = document.getElementById('cine-onboarding');
  if (onb && !onb.hasAttribute('hidden')) return;
  if (subscriptionExpired()) return;

  const prof = chat.profile || {};
  const g = prof.gradientColors || ['#f093fb', '#f5576c'];
  const sameChat = !el.hidden && _msgBannerChatId === chatId;
  _msgBannerChatId = chatId;
  const pfp = document.getElementById('msg-banner-pfp');
  pfp.style.background = `linear-gradient(145deg, ${g[0]}, ${g[1]})`;
  pfp.innerHTML = `${prof.initial || ''}${_pfpImgHTML(prof)}`;
  document.getElementById('msg-banner-name').textContent = prof.name || chat.name || '';
  document.getElementById('msg-banner-body').textContent = text;
  el.hidden = false;
  el.style.transform = '';
  if (!sameChat) {
    el.classList.remove('msg-banner--in');
    void el.offsetWidth;                                  // let it start from above before sliding in
    requestAnimationFrame(() => el.classList.add('msg-banner--in'));
    try { navigator.vibrate?.(8); _cineHaptic('LIGHT'); } catch (_) {}
  } else {
    el.classList.add('msg-banner--in');
  }
  clearTimeout(_msgBannerTimer);
  _msgBannerTimer = setTimeout(hideMsgBanner, MSG_BANNER.ms);
}
function hideMsgBanner() {
  clearTimeout(_msgBannerTimer);
  _msgBannerChatId = null;
  const el = document.getElementById('msg-banner');
  if (!el || el.hidden) return;
  el.classList.remove('msg-banner--in');
  el.style.transform = '';
  setTimeout(() => { if (!el.classList.contains('msg-banner--in')) el.hidden = true; }, 340);
}
function msgBannerOpen() {
  if (_msgBannerSwiped) { _msgBannerSwiped = false; return; }   // that tap was the end of a swipe-up
  const chat = chatStore.find(c => c.id === _msgBannerChatId);
  hideMsgBanner();
  if (!chat) return;
  // Already inside another chat: leave it the way exitChat() does (its reply keeps arriving in the background).
  if (state.activeScreen === 'chat') { _cancelSuggestions(); _trackPracticeEnd(); cancelPendingReply(); }
  openChatFromStore(chat);
}
// Swipe up to dismiss; the banner follows the finger and goes if you drag it far enough.
function _attachMsgBannerSwipe() {
  const el = document.getElementById('msg-banner');
  if (!el || el._swipeAttached) return;
  el._swipeAttached = true;
  let y0 = null, dy = 0;
  el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; clearTimeout(_msgBannerTimer); }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = Math.min(0, e.touches[0].clientY - y0);
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  const end = () => {
    if (y0 === null) return;
    y0 = null;
    el.style.transition = '';
    if (dy < -28) { _msgBannerSwiped = true; hideMsgBanner(); }
    else {
      _msgBannerSwiped = dy < -6;
      el.style.transform = '';
      clearTimeout(_msgBannerTimer);
      _msgBannerTimer = setTimeout(hideMsgBanner, MSG_BANNER.ms);
    }
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}
window.addEventListener('DOMContentLoaded', _attachMsgBannerSwipe);

// Full repaint of the thread from the store — used after a delete, and by
// openChatFromStore() for its own replay so there's only one copy of this.
function _rerenderChatMessages() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const el = document.getElementById('chat-messages');
  if (!chat || !el) return;
  el.innerHTML = '';
  _renderChatProfileHeader(chat.profile);
  chat.messages.forEach(m => {
    const opts = { id: m.id, replyToId: m.replyToId };
    if (m.sender === 'user') appendUserBubbleStatic(m.text, m.time, opts);
    else appendAIBubble(m.text, m.time, opts);
  });
  _syncChatFail();
  // She is still typing a reply that began before you left (or before this repaint): bring the dots back.
  if (chat.typing) { showTypingIndicator(); setHeaderStatus('typing'); }
  else { const hs = document.getElementById('chat-header-status'); if (hs && hs.classList.contains('typing')) setHeaderStatus('online'); }
  // appendUserBubbleStatic deliberately doesn't scroll per message, so a
  // thread ending on a user message would otherwise land one bubble short
  // of the real bottom — this always finishes at the true bottom.
  scrollToBottom();
}

let _chatToastTimer = null;
function showChatToast(text) {
  const el = document.getElementById('chat-toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('chat-toast--in'));
  clearTimeout(_chatToastTimer);
  _chatToastTimer = setTimeout(() => {
    el.classList.remove('chat-toast--in');
    setTimeout(() => { el.hidden = true; }, 200);
  }, 2000);
}

function _stageReplyTo(msgId) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const original = chat ? chat.messages.find(m => m.id === msgId) : null;
  if (!original) return;
  state.stagedReplyToId = msgId;
  const textEl = document.getElementById('chat-reply-staged-text');
  const strip  = document.getElementById('chat-reply-staged');
  if (textEl) textEl.textContent = (original.sender === 'user' ? 'You: ' : '') + original.text;
  if (strip) strip.hidden = false;
  document.getElementById('message-input')?.focus();
}

function _clearStagedReply() {
  state.stagedReplyToId = null;
  const strip = document.getElementById('chat-reply-staged');
  if (strip) strip.hidden = true;
}

function setLastMessageStatus(status) {
  const el = document.getElementById("last-msg-status");
  if (!el) return;
  if (status === "seen") {
    el.textContent = "Seen";
    el.classList.add("seen");
  }
}

// Remove the Seen label once she replies (Feature 2)
function removeSeenStatus() {
  const el = document.getElementById("last-msg-status");
  if (el) el.remove();
}

function setHeaderStatus(status) {
  const el = document.getElementById("chat-header-status");
  if (!el) return;
  el.className = "chat-hstatus";
  if (status === "typing") {
    el.textContent = "typing...";
    el.classList.add("typing");
  } else if (status === "sleeping") {
    el.textContent = "😴 She's asleep";
    el.classList.add("sleeping");
  } else {
    el.textContent = "online";
  }
}

function showTypingIndicator() {
  if (document.getElementById("typing-row")) return;
  const messages = document.getElementById("chat-messages");
  const row = document.createElement("div");
  row.className = "typing-row";
  row.id        = "typing-row";
  row.innerHTML = `<div class="typing-bubble">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;
  const wasNearBottom = _isChatNearBottom();
  messages.appendChild(row);
  _playRowEntrance(row, 'typing-row--in');
  _followChatIfAtBottom(wasNearBottom, false);
}

function hideTypingIndicator() {
  const row = document.getElementById("typing-row");
  if (row) row.remove();
}

// Guarantees at least `minOverflowPx` of real scrollable overflow on `el`,
// a flex:1 scroll container whose own box is routinely taller than its
// actual content (header/composer above and below only leave so much
// room) — overflow:auto containers like this floor el.scrollHeight to
// el.clientHeight the instant content doesn't overflow, which also means a
// *little* short of overflowing reads identically to "wildly short of it";
// scrollHeight alone can't tell the two apart. el.scrollHeight can't be
// trusted here, so this measures the real content extent via the last
// child's own rendered rect instead, which isn't subject to that floor,
// then adds or removes a trailing spacer to close the gap. A container
// with zero overflow can't be touch-scrolled or bounced at all in WebKit,
// not even slightly, so without this, v-scroll looks completely dead
// whenever content is short (a fresh chat/AI Coach with no messages yet,
// or still only a message or two in).
function _ensureScrollableOverflow(el, minOverflowPx) {
  if (!el) return;
  const spacerId = '_scrollSpacer_' + el.id;
  const existing = document.getElementById(spacerId);
  if (existing) existing.remove();
  const kids = el.children;
  const elRect = _rectA(el);
  // Last child that is actually laid out — a hidden one (display:none) has an
  // all-zero rect, which made the spacer enormous (the profile's hidden Tagged tab).
  let lastKid = null;
  for (let i = kids.length - 1; i >= 0; i--) { if (kids[i].getClientRects().length) { lastKid = kids[i]; break; } }
  const lastRect = lastKid ? _rectA(lastKid) : null;
  const paddingBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  const contentHeight = (lastRect ? lastRect.bottom - elRect.top : 0) + paddingBottom;
  const needed = (el.clientHeight + minOverflowPx) - contentHeight;
  if (needed > 0) {
    const spacer = document.createElement('div');
    spacer.id = spacerId;
    spacer.style.flex = 'none';
    spacer.style.height = needed + 'px';
    el.appendChild(spacer);
  }
}

// The spacer _ensureScrollableOverflow() adds (if any) sits past the real
// content on purpose, purely to give overflow:auto something to drag/
// bounce into when there's otherwise nothing to scroll — it must never
// count as part of "the bottom" for an actual scroll-to-latest-message
// action, or that action overshoots into blank space past the real last
// message. Looked up fresh by id rather than threading a value through,
// so any call site (including ones that never called
// _ensureScrollableOverflow themselves, like the keyboard nudge code's own
// scroll fixup) gets the correct, spacer-excluded height.
function _logicalScrollHeight(el) {
  const spacer = document.getElementById('_scrollSpacer_' + el.id);
  return el.scrollHeight - (spacer ? spacer.offsetHeight : 0);
}

// `el.scrollTop = el.scrollHeight` is the normal "scroll to bottom" idiom
// everywhere else in this app, and it's correct — ONLY because the browser
// clamps an over-large assignment down to the real max, (scrollHeight -
// clientHeight), and raw scrollHeight is always >= that max. But
// _logicalScrollHeight() (scrollHeight with the spacer excluded) is NOT
// guaranteed to be >= that max — it can land anywhere below clientHeight
// on a short conversation — so assigning it directly isn't reliably
// clamped to the right spot; it just sets scrollTop to whatever that raw
// number happens to be, overshooting once the container shrinks further
// (e.g. the keyboard opening while the suggestions panel is also open).
// This explicitly computes the real target instead of leaning on clamping.
function _scrollToLogicalBottom(el) {
  el.scrollTop = Math.max(0, _logicalScrollHeight(el) - el.clientHeight);
}

// Deliberate jump to the newest message — your own send, opening a chat,
// tapping jump-to-latest. Always goes, and clears the unseen count.
function scrollToBottom() {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;
  _ensureScrollableOverflow(messages, 48);
  _scrollToLogicalBottom(messages);
  state.chatUnseen = 0;
  _updateChatScrollBottomBtn();
}

// How close to the bottom still counts as "following the conversation".
const CHAT_STICK_THRESHOLD = 120;
function _isChatNearBottom() {
  const m = document.getElementById("chat-messages");
  if (!m) return true;
  return _logicalScrollHeight(m) - m.scrollTop - m.clientHeight < CHAT_STICK_THRESHOLD;
}

// Her messages and the typing indicator go through here instead of
// scrollToBottom(): if you're scrolled up reading older messages, you keep
// your place and the jump-to-latest button counts what arrived, rather than
// being yanked to the bottom mid-read. `wasNearBottom` has to be sampled
// BEFORE the new content is appended, or the new bubble's own height makes
// it look like you'd scrolled away.
function _followChatIfAtBottom(wasNearBottom, isNewMessage) {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;
  _ensureScrollableOverflow(messages, 48);
  if (wasNearBottom) _scrollToLogicalBottom(messages);
  else if (isNewMessage) state.chatUnseen = (state.chatUnseen || 0) + 1;
  _updateChatScrollBottomBtn();
}

// Jump-to-latest button — shown once the user has scrolled far enough away
// from the newest message that it's no longer obviously one swipe away.
const CHAT_SCROLL_BOTTOM_THRESHOLD = 200;
function _updateChatScrollBottomBtn() {
  const messages = document.getElementById("chat-messages");
  const btn = document.getElementById("chat-scroll-bottom-btn");
  if (!messages || !btn) return;
  const distanceFromBottom = _logicalScrollHeight(messages) - messages.scrollTop - messages.clientHeight;
  if (distanceFromBottom < CHAT_STICK_THRESHOLD) state.chatUnseen = 0; // scrolled back down — caught up
  const unseen = state.chatUnseen || 0;
  // Stays up whenever there's something unread, even if you're not far from
  // the bottom — otherwise a message arriving just below the fold would be
  // silently missed.
  btn.hidden = distanceFromBottom < CHAT_SCROLL_BOTTOM_THRESHOLD && !unseen;
  btn.classList.toggle('chat-scroll-bottom-btn--count', unseen > 0);
  const label = btn.querySelector('.chat-scroll-bottom-label');
  if (label) label.textContent = unseen ? `${unseen} new message${unseen > 1 ? 's' : ''}` : '';
}
(function () {
  const messages = document.getElementById("chat-messages");
  if (messages) messages.addEventListener("scroll", _updateChatScrollBottomBtn, { passive: true });
})();

function setSendEnabled(enabled) {
  const btn = document.getElementById("send-btn");
  if (btn) btn.disabled = !enabled;
}

// Feature 3: small circle avatar beside every bubble (Instagram DM size)
function createMsgAvatar(isAI) {
  const el = document.createElement('div');
  el.className = 'msg-avatar';
  if (isAI) {
    el.style.background = (state.character && state.character.color) || '#b0b0b0';
    el.innerHTML = _pfpImgHTML(state.character);
    el.setAttribute('data-open-profile', '');
    el.onclick = (e) => { e.stopPropagation(); openPersonaProfile(state.character); };
  } else {
    el.style.background = '#d1d5db';
  }
  return el;
}


// ================================================================
