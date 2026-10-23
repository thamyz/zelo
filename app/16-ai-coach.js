// ================================================================
// 16-ai-coach.js — AI Coach
//
// The coach chat, adding context (paste, screenshot, link a chat), staged
// suggestion pills and the saved-conversation history panel.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// AI COACH  (Fix 5/6/7/8 — replaces the old Ask-Zelo-inside-thread)
// Full-page coach. Real DeepSeek via the Supabase proxy. Counts toward
// the shared 10/day scan limit. Optionally linked to a saved thread,
// whose scans are fed as context.
// ================================================================

// In-flight coach conversation for the currently open page.
let _aiCoachChat = [];

// Whether AI Coach is currently showing as a bottom sheet over an open chat
// (openAiCoachFromChat(), the composer's sparkle button) rather than the
// normal full-page presentation (Home tab card, History row). Read by
// renderAiCoachChat() (swaps the greeting/linked-thread row for the live
// chat's own "Analyzing this conversation" replay) and by the edge-swipe-back
// wiring for #screen-ai-coach (a sheet closes back to the chat sitting right
// behind it, not through the normal screen-stack pop).
let _aiCoachChatSheetOpen = false;

// One-time latch for the empty-state greeting's "push past the fold" scroll
// (see renderAiCoachChat()): false only while AI Coach is freshly opened
// with nothing in it yet, so the very first message sent (or thread linked)
// scrolls just past the greeting's own height instead of jumping all the
// way to scrollHeight, which has no visible effect while the conversation
// is still short enough to fit on one screen. Set from openAiCoach()/
// linkThread() based on whether there's already content; every render after
// the first flips it true and reverts to a normal stick-to-bottom scroll.
let _aiCoachGreetingPushed = false;

// A normal (non-History) session that isn't linked to any thread still gets
// one auto-created the instant the user actually sends something (see
// _ensureAiCoachAutoThread(), called from sendAiCoachMessage()) — not
// deferred until the user leaves AI Coach, so it shows up in chat history
// immediately, while still on the page. Tracked separately from
// getLinkedThreadId() so this stays invisible to the current screen (no
// "Linked conversation" card/greeting change mid-chat) — it's purely
// where THIS session's messages get saved, reset to null on every fresh
// AI Coach entry.
let _aiCoachAutoThreadId = null;

// ── Linked thread (Fix 7) ──────────────────────────────────────
function getLinkedThreadId() { return localStorage.getItem('zelo_ai_coach_thread') || null; }
function setLinkedThreadId(id) {
  if (id) localStorage.setItem('zelo_ai_coach_thread', id);
  else    localStorage.removeItem('zelo_ai_coach_thread');
}
function getLinkedThread() {
  const id = getLinkedThreadId();
  if (!id) return null;
  return getThreads().find(t => t.id === id) || null;
}

// Keeps the dropdown on the Scan-page AI Coach card in sync.
function refreshAiCoachCard() {
  const label = document.getElementById('aicoach-thread-dropdown-label');
  if (!label) return;
  const thread = getLinkedThread();
  label.textContent = thread ? thread.name : 'No conversation linked';
}

// ── Open / close the full page ─────────────────────────────────
function openAiCoach(keepLinkedThread) {
  // Reachable directly from a History row now (see renderHistory()) —
  // capture whether History is open BEFORE pushScreen() below hides it,
  // so closeAiCoach() can bring it back instead of landing on whatever's
  // underneath (see _captureHistoryReturn()/_restoreHistoryReturn()). A
  // no-op (sets null) for every other entry path, where History isn't open.
  _captureHistoryReturn();
  _aiCoachAutoThreadId = null; // fresh session — re-armed the instant a message is actually sent
  _aiCoachShotConvo = null;    // an uploaded screenshot belongs to one visit, like the unlinked chat
  // If a text field on the previous screen (e.g. Tell Zelo More's free-text
  // step, or the "Other" wizard) is still focused/keyboard-up when this
  // opens, hand off cleanly instead of leaving it fighting a hidden field.
  if (document.activeElement
    && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
    document.activeElement.blur();
  }

  // Every normal open (Home card, launch) is a NEW chat: any thread link left
  // over from a previous visit — including one that survived the app being
  // killed while AI Coach was open — is dropped. Only History's row tap
  // (openAiCoach(true)) deliberately continues a saved thread.
  if (!keepLinkedThread) { setLinkedThreadId(null); refreshAiCoachCard(); }
  const thread = getLinkedThread();
  _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
  _aiCoachGreetingPushed = _aiCoachChat.length > 0; // resuming existing content, not a fresh greeting — skip the one-time push
  renderAiCoachChat();
  // Suggestions panel always starts collapsed — the user taps to reveal it,
  // regardless of whether this is a fresh conversation or has history.
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  toggleAiCoachHistoryPanel(false); // reset from any previous visit — classList state persists across screen show/hide
  const limit = document.getElementById('aicoach-limit');
  if (limit) limit.hidden = true;
  pushScreen('ai-coach');
  // No auto-focus on open (matches chat's message-input, which had this
  // removed earlier) — opening AI Coach used to pop the keyboard open by
  // itself via a delayed focus() here, and a quick swipe-back right after
  // opening could have that delayed keyboardWillShow fire mid-gesture,
  // after the swipe's own early keyboard-nudge clear had already run,
  // re-applying a shift with nothing left to catch it — reading as the
  // screen still moving on swipe-back even though the underlying clear
  // logic (shared with chat, confirmed fixed there) was already correct.
}

function closeAiCoach() {
  _autoSaveAiCoachChatOnExit();
  // Force any keyboard-avoidance shift back to rest before navigating away
  // — swiping back doesn't reliably blur the focused field first, so a
  // stale shift on .aicoach-messages/.aicoach-input-bar could otherwise
  // still be sitting there and only resolve (visibly dropping) once
  // something else eventually cleared it, well after this screen's gone.
  // Instant — an animated ease-back here is what read as "the screen
  // moves up a bit" on its own during the navigation.
  if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
  if (_restoreHistoryReturn()) return;
  popScreen();
}

// Leaving AI Coach always keeps the conversation — a linked (via History)
// or already auto-created (see _ensureAiCoachAutoThread(), which now does
// this the instant a message is first sent, not deferred until exit) thread
// just gets its latest state persisted, same as after every message, just
// defensive here too. The explicit create-fresh fallback below only
// matters for a chat that somehow reached exit with a real message but no
// thread yet (shouldn't normally happen now that sending already creates
// one). A no-op (beyond the unlink below) if nothing was actually said.
// Either way, AI Coach itself always resets to unlinked afterward — a
// normal (non-History) entry should start fresh; the saved chat is only
// re-linked by opening it again from History.
function _autoSaveAiCoachChatOnExit() {
  const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
  if (firstUserMsg) {
    if (getLinkedThreadId() || _aiCoachAutoThreadId) {
      _persistAiCoachChat();
    } else {
      _createAiCoachThreadFromFirstMessage(firstUserMsg);
    }
  }
  // Always leave AI Coach unlinked on exit, whether or not anything was
  // said or saved — a subsequent normal entry starts fresh, and re-linking
  // only happens by going through History again.
  setLinkedThreadId(null);
  _aiCoachAutoThreadId = null;
}

// Edge-swipe-back target while on the AI Coach screen — see the
// resolveTarget comment on this screen's attachEdgeSwipeBack() call above.
function _aiCoachSwipeBack() {
  // Opened as a sheet over a chat (openAiCoachFromChat()) — this was never
  // pushed onto state.screenStack, so closeAiCoach()'s own popScreen() would
  // incorrectly pop the CHAT screen's own prior entry instead. Only the
  // chat-sheet's own dismiss path applies here.
  if (_aiCoachChatSheetOpen) { closeAiCoachChatSheet(); return; }
  if (_aiCoachHistoryOpen) { toggleAiCoachHistoryPanel(false); return; }
  closeAiCoach();
}

// Real message-list a linked thread's most recent scan actually has —
// the full parsed conversation if it was saved with one (see
// confirmSaveScan()'s conversationMessages field), otherwise just the
// single her-message + reply pair. Scans saved before conversationMessages
// existed fall back to the same 2-message reconstruction.
function _linkedThreadConversation(thread) {
  const lastScan = thread.scans && thread.scans.length ? thread.scans[thread.scans.length - 1] : null;
  if (!lastScan) return { messages: [], totalCount: 0, replyCount: 0 };
  const messages = (Array.isArray(lastScan.conversationMessages) && lastScan.conversationMessages.length)
    ? lastScan.conversationMessages
    : [
        ...(lastScan.message ? [{ sender: 'her', text: lastScan.message }] : []),
        ...(lastScan.reply   ? [{ sender: 'me',  text: lastScan.reply   }] : []),
      ];
  return { messages, totalCount: messages.length, replyCount: messages.filter(m => m.sender === 'me').length };
}

// Plain outline speech-bubble — same shape as the "What should I reply?"
// suggestion card / the reply-topic icon in AI Coach's own chat history.
// Used for the Linked Conversation card specifically — the dotted bubble
// above reads fine as a small list-row icon (History) but looked heavy/busy
// at the card-header size this card uses.
const AICOACH_MESSAGE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

const AICOACH_ADD_ICON_DIR = 'assets/icons/aicoach-add/aicoach-add-';

function _aiCoachAddCardHTML() {
  return `
    <div class="aicoach-add-card">
      <p class="aicoach-add-title">Add your conversation</p>
      <p class="aicoach-add-sub">Paste a message, upload a screenshot, or link your chat so I have the full context.</p>
      <div class="aicoach-add-grid">
        <button type="button" class="aicoach-add-tile" onclick="aiCoachAddPasteMessage()">
          <img src="${AICOACH_ADD_ICON_DIR}paste.png" alt="">
          <span>Paste<br>Message</span>
        </button>
        <button type="button" class="aicoach-add-tile" onclick="aiCoachUploadScreenshot()">
          <img src="${AICOACH_ADD_ICON_DIR}upload.png" alt="">
          <span>Upload<br>Screenshot</span>
        </button>
        <button type="button" class="aicoach-add-tile" onclick="openThreadLinkPicker()">
          <img src="${AICOACH_ADD_ICON_DIR}link.png" alt="">
          <span>Link Chat</span>
          <span class="aicoach-add-info" role="button" aria-label="About linking a chat" onclick="event.stopPropagation(); aiCoachAddInfo()">
            <img src="${AICOACH_ADD_ICON_DIR}info.png" alt="">
          </span>
        </button>
      </div>
    </div>`;
}

// Upload Screenshot: the same vision reader Scan uses turns the picture into the conversation, which
// then rides along as the coach's context (shown in place of the "Add your conversation" card).
let _aiCoachShotConvo = null;       // [{sender:'her'|'me', text}] read from an uploaded screenshot
let _aiCoachShotLoading = false;

function aiCoachUploadScreenshot() {
  if (_aiCoachShotLoading) return;
  let input = document.getElementById('aicoach-shot-input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = 'aicoach-shot-input';
    input.hidden = true;
    input.addEventListener('change', aiCoachShotSelected);
    document.body.appendChild(input);
  }
  input.click();
}

async function aiCoachShotSelected(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';   // allow picking the same file again
  if (!file) return;
  _aiCoachShotLoading = true;
  const row = document.getElementById('aicoach-context-row');
  if (row) {
    row.className = 'aicoach-context-row aicoach-context-row--plain';
    row.innerHTML = '<div class="aicoach-linked-head"><span class="yr-label aicoach-live-conv-label">Reading your screenshot…</span></div>';
  }
  const result = await _extractScreenshotConversation(file);
  _aiCoachShotLoading = false;
  if (result && result !== NO_MESSAGE_SENTINEL) {
    _aiCoachShotConvo = result.messages.map(m => ({ sender: m.sender === 'me' ? 'me' : 'her', text: String(m.text || '') }));
  } else {
    showNotice(result === NO_MESSAGE_SENTINEL ? "Couldn't find a conversation" : "Couldn't read that screenshot",
               result === NO_MESSAGE_SENTINEL ? 'Try a screenshot that shows the messages.' : 'Check your connection and try again.');
  }
  renderAiCoachContext();
  document.getElementById('aicoach-input')?.focus();
}

function aiCoachRemoveShot() {
  _aiCoachShotConvo = null;
  renderAiCoachContext();
}

async function aiCoachAddPasteMessage() {
  const input = document.getElementById('aicoach-input');
  if (!input) return;
  let text = '';
  try { text = (await navigator.clipboard.readText()) || ''; } catch (e) {}
  if (text.trim()) {
    input.value = text.trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  input.focus();
}

function aiCoachAddInfo() {
  flashLimitToast('Link a chat you saved in Scan for deeper context.');
}

function renderAiCoachContext() {
  const row = document.getElementById('aicoach-context-row');
  if (!row) return;
  const thread = getLinkedThread();
  if (thread && _aiCoachHasRealContext()) {
    const conv = _linkedThreadConversation(thread);
    // Same plain look as the "This conversation" block in the chat sheet (label +
    // .yr-conv bubble box), renamed, with "View full chat" beside the label.
    row.className = 'aicoach-context-row aicoach-context-row--plain';
    row.innerHTML = `
      <div class="aicoach-linked-head">
        <span class="yr-label aicoach-live-conv-label">Linked conversation</span>
        <button type="button" class="aicoach-change-btn" data-open-scan-replay>View full chat ›</button>
      </div>
      <div class="yr-conv aicoach-live-conv-box" id="aicoach-context-conv">${_convRowsHTML(conv.messages)}</div>`;
    row.querySelector('[data-open-scan-replay]')?.addEventListener('click', () => openScanReplay(thread.id));
    const convBox = document.getElementById('aicoach-context-conv');
    if (convBox) requestAnimationFrame(() => { convBox.scrollTop = convBox.scrollHeight; });
  } else if (thread) {
    // Linked but no real scan on it yet (e.g. a thread created with no
    // saved scans) — same "linked" mechanism, just nothing to show yet.
    row.className = 'aicoach-context-row';
    row.innerHTML = `
      <div class="aicoach-context-head">
        <span class="aicoach-context-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <div class="aicoach-context-info">
          <span class="aicoach-context-title">Conversation context
            <span class="aicoach-context-linked">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Linked</span></span>
          <span class="aicoach-context-meta">${_escapeHtml(thread.name)} • no scans yet</span>
        </div>
        <button type="button" class="aicoach-change-btn" onclick="openThreadLinkPicker()">Change</button>
      </div>`;
  } else if (_aiCoachShotConvo && _aiCoachShotConvo.length) {
    row.className = 'aicoach-context-row aicoach-context-row--plain';
    row.innerHTML = `
      <div class="aicoach-linked-head">
        <span class="yr-label aicoach-live-conv-label">Screenshot conversation</span>
        <button type="button" class="aicoach-change-btn" onclick="aiCoachRemoveShot()">Remove</button>
      </div>
      <div class="yr-conv aicoach-live-conv-box" id="aicoach-context-conv">${_convRowsHTML(_aiCoachShotConvo)}</div>`;
    const convBox = document.getElementById('aicoach-context-conv');
    if (convBox) requestAnimationFrame(() => { convBox.scrollTop = convBox.scrollHeight; });
  } else {
    row.className = 'aicoach-context-row aicoach-context-row--add';
    row.innerHTML = _aiCoachAddCardHTML();
  }
}

function _aiCoachGreeting() {
  const thread = getLinkedThread();
  if (thread && _aiCoachHasRealContext()) {
    return {
      hi: "Got it!",
      body: "I can see the conversation and your reply here. I'll use this context to give you better advice, suggest replies, or help you with anything you want to say next.",
    };
  }
  return {
    hi: "Hi! I'm Zelo.",
    body: thread
      ? `I've reviewed the full conversation with ${thread.name}. Ask me anything or get suggestions on how to reply.`
      : `I can help you understand this situation and suggest the best replies. Add the current conversation and I'll give you advice and options.`,
  };
}

// The currently open practice chat's own messages (chatStore, keyed by
// state.activeChatId), reshaped into the same {sender:'her'|'me', text}
// shape _linkedThreadConversation()/_convRowsHTML() already use for scan
// threads — lets the chat-sheet's "this conversation" replay reuse that
// exact rendering instead of a separate one.
// True while the AI Coach sheet was opened from Your Reply (openAiCoachFromScan()):
// the "live conversation" is then the scan screen's own conversation, not a chat's.
let _aiCoachScanSheet = false;

function _scanScreenConversation() {
  if (state.replayThreadId) return state.replayConvo.map(m => ({ sender: m.sender, text: m.text }));
  const c = state.asstConversationMessages;
  if (c && c.length) return c.map(m => ({ sender: m.sender, text: m.text }));
  return state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : [];
}

function openAiCoachFromScan() {
  _aiCoachExplainCard = null; // a plain "Ask AI Coach" open is never about one specific suggested reply
  _aiCoachScanSheet = true;
  openAiCoachFromChat();
}

function _aiCoachLiveChatConversation() {
  if (_aiCoachScanSheet) return _scanScreenConversation();
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  return chat.messages.map(m => {
    const target = m.replyToId ? chat.messages.find(x => x.id === m.replyToId) : null;
    return { sender: m.sender === 'user' ? 'me' : 'her', text: m.text, replyTo: target ? target.text : null };
  });
}

// "Analyzing this conversation" card + read-only replay of the live chat,
// shown instead of the greeting/linked-thread row while opened as a sheet
// from a chat (see openAiCoachFromChat()/renderAiCoachChat()). Reuses the
// existing "Linked conversation" pink-card look (.aicoach-context-row.linked)
// and the conversation-bubble box already used for Your Reply's "Her
// message" preview (.yr-conv/.yr-conv-row/.yr-conv-bubble, see
// _convRowsHTML()) — same visual language already built for those, just a
// different label and no "View full chat" action, since the real chat is
// already sitting right behind this sheet.
// Zelo's read on the topic, for the sheet opened from Your Reply — built from her
// latest message with the same rule-based read the old on-screen box used.
function _analyzingScanRead(conv) {
  const lastHer = [...conv].reverse().find(m => m.sender === 'her');
  return "Zelo's read: " + _escapeHtml(_buildZeloRead(lastHer ? lastHer.text : '', state.scanContext));
}

function _aiCoachAnalyzingCard() {
  const wrap = document.createElement('div');
  const conv = _aiCoachLiveChatConversation();
  wrap.innerHTML = `
    ${conv.length ? `
      <span class="yr-label aicoach-live-conv-label">This conversation</span>
      <div class="yr-conv aicoach-live-conv-box" id="aicoach-live-conv-box">${_convRowsHTML(conv)}</div>
    ` : ''}
    <div class="aicoach-context-row linked aicoach-analyzing-card">
      <div class="aicoach-context-head">
        <span class="aicoach-context-icon aicoach-analyzing-icon">
          <img src="assets/icons/reply-styles/smooth.png" alt="" onerror="this.remove()">
        </span>
        <div class="aicoach-context-info">
          <span class="aicoach-context-title">Analyzing this conversation</span>
          <span class="aicoach-context-meta">${_aiCoachScanSheet ? _analyzingScanRead(conv) : 'I can see the full chat above and help you with suggestions or advice.'}</span>
        </div>
      </div>
    </div>`;
  const box = wrap.querySelector('#aicoach-live-conv-box');
  if (box) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  return wrap;
}

function renderAiCoachChat() {
  const wrap = document.getElementById('aicoach-messages');
  if (!wrap) return;
  wrap.innerHTML = '';

  let greetingEl = null;
  if (_aiCoachChatSheetOpen) {
    // Opened from a chat's own composer — replaces the greeting/linked-
    // thread row above with a read-only replay of THIS chat's live
    // messages, since there's nothing to "link" here (see
    // openAiCoachFromChat()'s own comment).
    wrap.appendChild(_aiCoachAnalyzingCard());
  } else {
    // Opening Zelo greeting (not part of the stored turns) — always
    // rendered, same as every other message: scrolling up still has to be
    // able to reach it. What changed (see the scroll call at the bottom of
    // this function) is how far the view scrolls on the FIRST real
    // interaction — just past the greeting's own height, not necessarily
    // all the way to the true bottom, so it reliably leaves view even when
    // the rest of the content is still short.
    const greeting = _aiCoachGreeting();
    greetingEl = _aiCoachZeloBubble(greeting.body, { greeting: true, hiText: greeting.hi });
    wrap.appendChild(greetingEl);

    // Linked-conversation context card — right below the greeting, scrolling
    // with the rest of the chat rather than pinned as its own fixed strip.
    const ctxRow = document.createElement('div');
    ctxRow.id = 'aicoach-context-row';
    wrap.appendChild(ctxRow);
    renderAiCoachContext();
  }

  _aiCoachChat.forEach(msg => {
    if (msg.role === 'user') {
      wrap.appendChild(_aiCoachUserBubble(msg));
    } else {
      wrap.appendChild(_aiCoachZeloBubble(msg.content, { time: msg.time, replyToId: msg.replyToId }));
      (msg.suggestions || []).forEach(s => wrap.appendChild(_aiCoachSuggestion(s)));
    }
  });

  // Action pills after the latest Zelo answer — or, if that answer is a
  // failure, the availability indicator instead (see _aiCoachStatusPill()).
  const last = _aiCoachChat[_aiCoachChat.length - 1];
  if (last && last.role === 'assistant' && last.failKind) {
    if (_aiCoachStatusMsg !== last) _aiCoachStartStatusWatch(last, last !== _aiCoachJustFailedMsg);
    wrap.appendChild(_aiCoachStatusPill(last));
  } else {
    _aiCoachStopStatusWatch();
    _aiCoachStatusGen++;
    _aiCoachStatusMsg = null;
    if (last && last.role === 'assistant' && last.content !== '…') {
      wrap.appendChild(_aiCoachActionPills());
    }
  }

  _ensureScrollableOverflow(wrap, 48);

  if (greetingEl && _aiCoachChat.length === 0) {
    // True empty state — show the greeting at the top, same as any fresh
    // open. scrollTop still belongs at 0 here, not wherever the spacer
    // above would otherwise carry wrap.scrollHeight to.
    wrap.scrollTop = 0;
  } else if (greetingEl && !_aiCoachGreetingPushed) {
    // First real interaction after the empty-state greeting (first message
    // sent, or a thread linked with its own history) — scroll just past the
    // greeting's own height rather than all the way to scrollHeight, so it
    // reliably clears the fold even when the rest of the content is still
    // short enough to otherwise fit on one screen. Still reachable by
    // scrolling back up afterward since it's never removed from the DOM.
    _aiCoachGreetingPushed = true;
    const target = greetingEl.offsetTop + greetingEl.offsetHeight;
    wrap.scrollTop = Math.max(0, Math.min(target, _logicalScrollHeight(wrap) - wrap.clientHeight));
  } else {
    _scrollToLogicalBottom(wrap);
  }
}

function _aiCoachZeloBubble(text, opts = {}) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--zelo';
  const avatar = opts.greeting
    ? `<span class="aicoach-msg-avatar" aria-hidden="true">${_aiCoachBrandIconHTML()}</span>`
    : '';
  const hi = opts.greeting ? `<p class="aicoach-bubble-hi">${_escapeHtml(opts.hiText || "Hi! I'm Zelo.")}</p>` : '';
  // The waiting-for-reply placeholder (see sendAiCoachMessage()'s '…'
  // content) gets the same animated bouncing dots as the main chat's own
  // typing indicator, instead of a plain static ellipsis character —
  // same .typing-dot markup/animation, just sitting inside this bubble's
  // own shape/theme instead of .typing-bubble's.
  const body = text === '…'
    ? `<div class="aicoach-typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`
    : `<p class="aicoach-bubble-text">${_escapeHtml(text)}</p>`;
  row.innerHTML = `
    ${avatar}
    <div class="aicoach-bubble aicoach-bubble--zelo">
      ${hi}
      ${_aiCoachReplyQuoteHTML(opts.replyToId)}
      ${body}
    </div>`;
  return row;
}

function _aiCoachUserBubble(msg) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--user';
  const bubble = document.createElement('div');
  bubble.className = 'aicoach-bubble aicoach-bubble--user';
  const imageSrc = _safeImageDataUrl(msg.image);
  if (imageSrc) {
    const img = document.createElement('img');
    img.className = 'aicoach-bubble-img';
    img.src = imageSrc;
    img.alt = '';
    bubble.appendChild(img);
  }
  bubble.appendChild(document.createTextNode(String(msg.content || '')));
  row.appendChild(bubble);
  return row;
}

function _aiCoachSuggestion(text) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'aicoach-suggestion';
  card.onclick = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    flashLimitToast('Copied to clipboard');
  };
  const icon = document.createElement('span');
  icon.className = 'aicoach-suggestion-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = _aiCoachBrandIconHTML();
  const label = document.createElement('span');
  label.className = 'aicoach-suggestion-text';
  label.textContent = String(text || '');
  card.append(icon, label);
  return card;
}

function _aiCoachActionPills() {
  const wrap = document.createElement('div');
  wrap.className = 'aicoach-action-pills';
  wrap.innerHTML = `
    <button class="aicoach-action-pill" type="button" onclick="sendAiCoachMessage('Explain more')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Explain more
    </button>
    <button class="aicoach-action-pill" type="button" onclick="sendAiCoachMessage('Show me more options')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      Show more options
    </button>`;
  return wrap;
}

// ---- Collapsible suggestions panel (anchored above the input bar) ----
// Always starts collapsed — the user taps the toggle to reveal it. Every
// category/quick-action button routes through aiCoachPromptTap(), which
// asks for her message first if there's no real linked context — it does
// NOT hand the button's own label straight to the AI as if it were a
// fully-formed question.
let _aiCoachSuggestOpen = false;

// Suggestions panel and keyboard are mutually exclusive — opening one
// closes the other, they never stack/overlap. One tap on the toggle: keyboard
// dismisses first, panel opens automatically right after — sequential, but
// a single tap does both with no second tap needed. (This only reaches this
// function at all now because of the touchstart exception above — without
// it, the tap's own blur-and-reflow could dodge the click event entirely.)
function toggleAiCoachSuggestPanel() {
  const input = document.getElementById('aicoach-input');
  const willOpen = !_aiCoachSuggestOpen;
  if (willOpen && input && document.activeElement === input) {
    input.blur();
    setTimeout(() => {
      _aiCoachSuggestOpen = true;
      _updateAiCoachSuggestToggle();
    }, 280); // keyboard-dismiss animation duration, roughly
    return;
  }
  _aiCoachSuggestOpen = !_aiCoachSuggestOpen;
  _updateAiCoachSuggestToggle();
}

function _updateAiCoachSuggestToggle() {
  const panel   = document.getElementById('aicoach-suggest-panel');
  const chevron = document.getElementById('aicoach-suggest-toggle-chevron');
  if (panel)   panel.classList.toggle('open', _aiCoachSuggestOpen);
  if (chevron) chevron.classList.toggle('aicoach-suggest-toggle-chevron--open', _aiCoachSuggestOpen);
  // Opening the panel eats into .aicoach-messages' flex space (both share
  // the same fixed-height column) without moving anything — so the last
  // message can end up sitting behind where the panel now is unless the
  // thread re-anchors to its own bottom once the panel's expand transition
  // actually finishes (mid-transition, scrollHeight/clientHeight are still
  // the old, taller values).
  if (_aiCoachSuggestOpen) {
    const body = document.getElementById('aicoach-suggest-body');
    if (body) body.addEventListener('transitionend', scrollAiCoachToBottom, { once: true });
  }
}

function scrollAiCoachToBottom() {
  const el = document.querySelector('.aicoach-messages');
  if (el) _scrollToLogicalBottom(el);
  _updateAiCoachScrollBottomBtn();
}

function _updateAiCoachScrollBottomBtn() {
  const el = document.getElementById('aicoach-messages');
  const btn = document.getElementById('aicoach-scroll-bottom-btn');
  if (!el || !btn) return;
  const distanceFromBottom = _logicalScrollHeight(el) - el.scrollTop - el.clientHeight;
  btn.hidden = distanceFromBottom < CHAT_SCROLL_BOTTOM_THRESHOLD;
}
(function () {
  const el = document.getElementById('aicoach-messages');
  if (el) el.addEventListener('scroll', _updateAiCoachScrollBottomBtn, { passive: true });
})();

// Focusing the input (keyboard opening) closes the suggestions panel if
// it's open — same mutual-exclusivity in the other direction.
document.addEventListener('focusin', (e) => {
  if (e.target.id === 'aicoach-input' && _aiCoachSuggestOpen) {
    _aiCoachSuggestOpen = false;
    _updateAiCoachSuggestToggle();
    // The keyboard-avoidance nudge (script.js's keyboard-nudge IIFE) runs
    // 30-80ms after this same focus event — but .aicoach-suggest-body's
    // own collapse (max-height, 0.35s) is nowhere near done by then, so
    // that first nudge measures a mid-collapse, not-yet-settled layout
    // and computes the wrong shift. That's the root cause of the AI Coach
    // input "jumping up too high" specifically after the suggestions
    // panel had been open — not the keyboard nudge itself misbehaving.
    // Re-run the same nudge once this transition actually finishes so the
    // final shift reflects where things really end up, not a snapshot
    // mid-flight.
    const body = document.getElementById('aicoach-suggest-body');
    if (body && window._nudgeFocusedIntoView) {
      body.addEventListener('transitionend', () => window._nudgeFocusedIntoView(), { once: true });
    }
  }
}, true);

function renderAiCoachSuggestPanel() {
  const body = document.getElementById('aicoach-suggest-body');
  if (!body) return;
  body.innerHTML = `
    <p class="aicoach-suggest-title">What do you need help with?</p>
    <div class="aicoach-suggest-grid">
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('Is she interested?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="#ec4899"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>
        <span class="aicoach-suggest-label">Is she interested?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('What should I reply?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
        <span class="aicoach-suggest-label">What should I reply?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('Did I mess up?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 15.5s1.5-2 4-2 4 2 4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></span>
        <span class="aicoach-suggest-label">Did I mess up?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('How do I keep the conversation going?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>
        <span class="aicoach-suggest-label">Keep the conv. going</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="aiCoachPromptTap('How do I ask her out?')">
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="11" x2="21" y2="11"/></svg></span>
        <span class="aicoach-suggest-label">How do I ask her out?</span>
      </button>
      <button type="button" class="aicoach-suggest-card" onclick="document.getElementById('aicoach-input')?.focus()">
        <span class="aicoach-suggest-ic">${_aiCoachBrandIconHTML()}</span>
        <span class="aicoach-suggest-label">Other question</span>
      </button>
    </div>
    <p class="aicoach-suggest-title">Quick actions</p>
    <div class="aicoach-suggest-quick">
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Generate a reply for me')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        Generate Reply
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Explain what this message means')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Explain Message
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Rewrite my message to sound better')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
        Rewrite Message
      </button>
      <button type="button" class="aicoach-quick-pill" onclick="aiCoachPromptTap('Give me more replies like this')">
        <svg class="aicoach-quick-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.5.4.8 1 .8 1.6v.2h6.4v-.2c0-.6.3-1.2.8-1.6A7 7 0 0 0 12 2Z"/></svg>
        More Like This
      </button>
    </div>`;
  _updateAiCoachSuggestToggle();
}

// True once there's an actual message on record — either a linked thread
// with real scans, or (opened from a chat's own composer) that chat's own
// live messages — that the AI can reason about, not just a category label
// with nothing behind it.
function _aiCoachHasRealContext() {
  const thread = getLinkedThread();
  if (thread && Array.isArray(thread.scans) && thread.scans.length > 0) return true;
  if (_aiCoachChatSheetOpen && _aiCoachLiveChatConversation().length > 0) return true;
  return false;
}

function aiCoachPromptTap(question) {
  // Always stage — tapping a suggestion never sends by itself, regardless
  // of whether a thread is linked yet (see aiCoachStagePrompt()). The
  // "no context yet, ask for her message" canned reply that used to fire
  // right here now happens at actual send time instead (see
  // sendAiCoachMessage()), since sending is the only thing that's
  // allowed to happen just from tapping a suggestion.
  aiCoachStagePrompt(question);
}

// ================================================================
// STAGED SUGGESTION — PROTOTYPE (see #aicoach-staged-pill in index.html).
// Tapping a suggestion card (when there's already real context) lands it
// here as a preview box instead of sending immediately — same size,
// material, and behavior as the photo preview right below it: it's just
// a preview, tapping it does nothing, the X removes it, and it only
// actually sends once the user hits send/Enter (see sendAiCoachMessage(),
// which folds it in alongside anything typed).
// ================================================================
let _aiCoachStagedPrompt = null;

function aiCoachStagePrompt(question) {
  _aiCoachStagedPrompt = question;
  const pill = document.getElementById('aicoach-staged-pill');
  const text = document.getElementById('aicoach-staged-pill-text');
  if (pill && text) {
    text.textContent = question;
    pill.hidden = false;
  }
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();
  // Deliberately NOT auto-focusing the input here. Staging a suggestion
  // shouldn't reopen the keyboard on its own if the user had it closed —
  // the keyboard should only ever respond to the user's own taps, never
  // pop back open as a side effect of something else they tapped.
}

function aiCoachDismissStagedPill() {
  _aiCoachStagedPrompt = null;
  const pill = document.getElementById('aicoach-staged-pill');
  if (pill) pill.hidden = true;
}

function handleAiCoachKeyDown(e) {
  if (e.key === 'Enter') sendAiCoachMessage();
}

// Builds the proxy message list: system prompt + linked thread context as
// prior history + the live coach turns.
// The last few user turns, numbered for [re:N] in both directions (prompt
// out, parse back) so the indices line up without passing state around.
function _aiCoachRecentUserMsgs() {
  return _aiCoachChat.filter(m => m.role === 'user' && m.id).slice(-5);
}

// Quote strip for an AI Coach bubble that links to an earlier message.
// Escaped: these bubbles are built with innerHTML.
function _aiCoachReplyQuoteHTML(replyToId) {
  if (!replyToId) return '';
  const target = _aiCoachChat.find(m => m.id === replyToId);
  if (!target || !target.content) return '';
  const t = String(target.content);
  return `<div class="msg-reply-quote">${_escapeHtml(t.length > 80 ? t.slice(0, 80) + '…' : t)}</div>`;
}

function _buildAiCoachMessages() {
  const thread = getLinkedThread();
  // Opened from a chat's own composer (see openAiCoachFromChat()) never
  // sets a linked thread — that conversation instead lives in chatStore,
  // read here the same way _aiCoachAnalyzingCard()'s on-screen replay does.
  const liveConv = _aiCoachChatSheetOpen ? _aiCoachLiveChatConversation() : (_aiCoachShotConvo || []);
  let system =
    'You are Zelo, a casual texting coach. Never formal, never therapist-like. ' +
    'You talk like a smart friend giving quick, honest advice. Keep replies short, direct, no fluff. ';
  if (thread) {
    system += `The user has linked their conversation with ${thread.name}. ` +
      'The messages above show what they received and how they replied — use that context. ';
  } else if (liveConv.length) {
    system += 'Below is the live conversation so far, in order, labeled "Them" (what the other person sent) ' +
      'and "Me" (what the user sent). Use it as context for advice and suggested replies.\n\n' +
      liveConv.map(m => `${m.sender === 'me' ? 'Me' : 'Them'}: ${m.text}`).join('\n') + '\n';
  }
  if (_aiCoachExplainCard) {
    system += `\nZelo already generated this suggested reply for the user (tone: ${STYLE_LABELS[_aiCoachExplainCard.style] || _aiCoachExplainCard.style}): "${_aiCoachExplainCard.text}". ` +
      'When asked why it works, explain specifically why THIS suggested reply fits the conversation above — reference its actual wording and tone, not a generic answer. ';
  }
  system +=
    'Never use markdown formatting anywhere in your response text — no asterisks for bold or italic, ' +
    'no dashes or bullet points, no headers, nothing but plain conversational sentences, the way a real ' +
    'text message reads. Respond ONLY with a JSON object, no markdown fences, in exactly this shape: ' +
    '{"advice": "your short take, 1-3 sentences", "suggestions": ["a ready-to-send reply", "another option", "a third option"]}. ' +
    'suggestions are full reply texts the user could copy and send. Always include 2 or 3.';

  const messages = [{ role: 'system', content: system }];

  // Linked thread scans as conversation history (Fix 6)
  if (thread) {
    (thread.scans || []).forEach(s => {
      messages.push({ role: 'user', content: `They texted me: "${s.message}". I replied: "${s.reply}".` });
    });
  }

  // Live coach turns (assistant turns send only their advice text back)
  _aiCoachChat.forEach(m => {
    if (m.content === '…' || m.failKind) return;
    messages.push({ role: m.role, content: m.content });
  });

  // Same [re:N] mechanism the practice chat uses, so a reply that's picking
  // up an earlier point can be visibly linked to it rather than leaving the
  // user to work out which question is being answered.
  const recent = _aiCoachRecentUserMsgs();
  if (recent.length > 1) {
    messages.push({
      role: 'system',
      content: [
        `The user's recent messages, numbered:`,
        recent.map((m, i) => `[${i + 1}] ${m.content}`).join('\n'),
        `If your reply is picking up one of them specifically rather than the latest, start it with that number in square brackets, like [re:1] or [re:2] — literally that, with a real digit. Skip it when you're simply answering the most recent message. Never mention or explain the tag.`,
      ].join('\n')
    });
  }

  return messages;
}

async function sendAiCoachMessage(preset) {
  const input = document.getElementById('aicoach-input');
  const typedText = (preset != null ? preset : (input ? input.value : '')).trim();
  // preset != null means this call came from something else that already
  // resolved its own exact text (there's no other caller today, but the
  // param exists for that) — a staged suggestion only ever folds in on
  // the normal send-button/Enter path.
  const stagedQuestion = preset == null ? _aiCoachStagedPrompt : null;
  let text = stagedQuestion
    ? (typedText ? `${stagedQuestion} ${typedText}` : stagedQuestion)
    : typedText;

  // A staged suggestion (see aiCoachStagePrompt()) rides along with
  // whatever is typed, folded into the same send.
  if (stagedQuestion) aiCoachDismissStagedPill();

  if (!text) return;

  // Daily limit (Fix 8) — AI Coach shares the 10/day scan budget
  if (!isPaidUser() && scansRemainingToday() <= 0) {
    const limit = document.getElementById('aicoach-limit');
    if (limit) limit.hidden = false;
    return;
  }

  if (input && preset == null) input.value = '';

  // A staged suggestion (e.g. "Is she interested?") needs an actual
  // message to work from. If there's no linked thread AND the user sent
  // it bare (didn't type anything of their own, no photo either), ask
  // for that instead of sending the question into a vacuum — this is the
  // same "no context yet" behavior that used to fire the instant a
  // suggestion was tapped; it only moved to here, since tapping a
  // suggestion never sends by itself anymore.
  if (stagedQuestion && !typedText && !photo && !_aiCoachHasRealContext()) {
    _aiCoachChat.push({ id: _newMsgId(), role: 'user', content: text, time: Date.now() });
    _aiCoachChat.push({
      role: 'assistant',
      content: "What did she write? Paste her message (or link a thread) and I'll take it from there.",
      suggestions: [],
      time: Date.now()
    });
    _ensureAiCoachAutoThread();
    _persistAiCoachChat();
    renderAiCoachChat();
    _aiCoachSuggestOpen = false;
    _updateAiCoachSuggestToggle();
    return;
  }

  _aiCoachChat.push({ id: _newMsgId(), role: 'user', content: text, time: Date.now() });
  _ensureAiCoachAutoThread();
  if (!isPaidUser()) decrementScanCount();

  // Sending a message collapses the suggestions panel — it can still be
  // reopened manually anytime via the toggle.
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();

  const placeholder = { id: _newMsgId(), role: 'assistant', content: '…', suggestions: [], time: Date.now() };
  _aiCoachChat.push(placeholder);
  renderAiCoachChat();

  await _aiCoachFetchReply(placeholder);
}

// Runs the actual DeepSeek round trip for one placeholder message and fills
// it in (or marks it failed with a reason). Shared by the normal send and
// the status pill's Retry button — Retry reuses the SAME message object, so
// it never adds a second user turn or a second free-credit charge.
async function _aiCoachFetchReply(placeholder) {
  const apiMessages = _buildAiCoachMessages().slice(0, -1); // exclude placeholder
  try {
    const { data, error } = await _aiInvoke('deepseek-proxy', {
      body: { model: 'deepseek-chat', messages: apiMessages, max_tokens: 320, temperature: 0.9 }
    }, 'coach');
    if (error) throw error;
    let raw = data.choices[0].message.content.trim();
    // Pull [re:N] off before the advice/suggestions split, or the tag ends
    // up rendered as part of her text — the exact leak the practice chat hit.
    const recent = _aiCoachRecentUserMsgs();
    const tag = raw.match(/^[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*(\d+)\s*[\])]\s*/i);
    if (tag) {
      const target = recent[parseInt(tag[1], 10) - 1];
      if (target) placeholder.replyToId = target.id;
      raw = raw.slice(tag[0].length).trim();
    }
    raw = _stripDirectiveTags(raw) || raw;
    const parsed = _parseAiCoachReply(raw);
    placeholder.content     = parsed.advice;
    placeholder.suggestions = parsed.suggestions;
    delete placeholder.failKind;
  } catch (err) {
    placeholder.content     = "Hmm, I couldn't reach Zelo right now. Try again in a moment.";
    placeholder.suggestions = [];
    placeholder.failKind    = _aiCoachClassifyError(err);
    _aiCoachStatusMsg = null; // a fresh failure always restarts the status watch
    _aiCoachJustFailedMsg = placeholder;
  }

  _persistAiCoachChat();
  renderAiCoachChat();
}

// ---- Zelo availability indicator (small pill under a failed reply) ----
// Why a reply failed decides what the pill says: a 401 means the user isn't
// signed in (the proxy rejects the public anon key on purpose — see
// supabase/functions/deepseek-proxy), a 429 is the per-user hourly cap, and
// everything else (5xx, DeepSeek down, no network) is genuine unavailability.
function _aiCoachClassifyError(err) {
  const status = err && err.context && err.context.status;
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'limit';
  if (!status && typeof navigator !== 'undefined' && navigator.onLine === false) return 'net';
  return 'down';
}

// In-memory only — availability is a live fact, not something to persist.
// { state: 'checking' | 'down' | 'up' }
let _aiCoachStatus = { state: 'down' };
let _aiCoachStatusMsg = null;   // the failed message the current watch belongs to
let _aiCoachStatusTimer = null;
let _aiCoachJustFailedMsg = null; // failed THIS session (already known down) vs. reopened from history (unknown)
let _aiCoachStatusGen = 0;
const AI_COACH_STATUS_POLL_MS = 15000;
const AI_COACH_STATUS_MAX_POLLS = 20;

function _aiCoachLastFailedMsg() {
  const last = _aiCoachChat[_aiCoachChat.length - 1];
  return last && last.role === 'assistant' && last.failKind ? last : null;
}

// Asks the proxy whether DeepSeek is actually reachable right now. Doesn't
// touch the hourly rate limit and costs nothing (see the `health` branch in
// deepseek-proxy).
async function _probeZelo() {
  try {
    const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', { body: { health: true } });
    // A proxy build from before the `health` branch existed answers this
    // with 400 "Missing messages" — still proof the function itself is up
    // and the caller is signed in, so that counts as reachable.
    if (error) return !!(error.context && error.context.status === 400);
    return !!(data && data.ok);
  } catch { return false; }
}

function _aiCoachStopStatusWatch() {
  clearTimeout(_aiCoachStatusTimer);
  _aiCoachStatusTimer = null;
}

function _aiCoachStartStatusWatch(msg, immediate) {
  _aiCoachStopStatusWatch();
  _aiCoachStatusMsg = msg;
  const gen = ++_aiCoachStatusGen;
  const kind = msg.failKind;

  if (kind === 'auth') {
    _aiCoachStatus = { state: (window.AUTH && AUTH.signedIn && AUTH.signedIn()) ? 'up' : 'down' };
    return;
  }
  if (kind === 'limit') { _aiCoachStatus = { state: 'down' }; return; }

  _aiCoachStatus = { state: immediate ? 'checking' : 'down' };
  let polls = 0;
  const tick = async () => {
    if (_aiCoachStatusGen !== gen) return;
    if (!document.getElementById('aicoach-status-pill')) { _aiCoachStatusMsg = null; return; } // left the chat — next render restarts it
    _aiCoachStatus = { state: 'checking' };
    _updateAiCoachStatusPill();
    const ok = await _probeZelo();
    if (_aiCoachStatusGen !== gen) return;
    _aiCoachStatus = { state: ok ? 'up' : 'down' };
    _updateAiCoachStatusPill();
    if (ok) { navigator.vibrate?.(8); return; }
    if (++polls < AI_COACH_STATUS_MAX_POLLS) _aiCoachStatusTimer = setTimeout(tick, AI_COACH_STATUS_POLL_MS);
  };
  // Just failed → we already know it's down; wait a beat before re-probing.
  // Reopened old chat → nothing known yet, so check right away.
  _aiCoachStatusTimer = setTimeout(tick, immediate ? 0 : 6000);
}

function _aiCoachStatusPillHTML(msg) {
  const kind = msg.failKind;
  const st = _aiCoachStatus.state;
  let mod, title, sub = '', action = '';
  if (st === 'checking') {
    mod = 'checking'; title = 'Checking Zelo…';
  } else if (st === 'up') {
    mod = 'up'; title = kind === 'auth' ? "You're signed in" : 'Zelo is available now';
    action = `<button type="button" class="aicoach-status-btn" onclick="retryAiCoachReply()">Retry</button>`;
  } else if (kind === 'auth') {
    mod = 'down'; title = 'Sign in required'; sub = 'Sign in to keep chatting with Zelo.';
    action = `<button type="button" class="aicoach-status-btn" onclick="aiCoachStatusSignIn()">Sign in</button>`;
  } else if (kind === 'limit') {
    mod = 'down'; title = 'Hourly limit reached'; sub = 'Sorry for the inconvenience — try again soon.';
  } else if (kind === 'net') {
    mod = 'down'; title = "You're offline"; sub = 'Sorry for the inconvenience — check your connection.';
  } else {
    mod = 'down'; title = 'Zelo is unavailable'; sub = 'Sorry for the inconvenience.';
  }
  return `
    <span class="aicoach-status-dot" aria-hidden="true"></span>
    <span class="aicoach-status-copy">
      <span class="aicoach-status-title">${title}</span>
      ${sub ? `<span class="aicoach-status-sub">${sub}</span>` : ''}
    </span>
    ${action}`;
}

function _aiCoachStatusPillClass() {
  const st = _aiCoachStatus.state;
  return 'aicoach-status aicoach-status--' + (st === 'up' ? 'up' : st === 'checking' ? 'checking' : 'down');
}

function _aiCoachStatusPill(msg) {
  const el = document.createElement('div');
  el.id = 'aicoach-status-pill';
  el.setAttribute('role', 'status');
  el.className = _aiCoachStatusPillClass();
  el.innerHTML = _aiCoachStatusPillHTML(msg);
  return el;
}

function _updateAiCoachStatusPill() {
  const el = document.getElementById('aicoach-status-pill');
  const msg = _aiCoachLastFailedMsg();
  if (!el || !msg) return;
  el.className = _aiCoachStatusPillClass();
  el.innerHTML = _aiCoachStatusPillHTML(msg);
}

async function retryAiCoachReply() {
  const msg = _aiCoachLastFailedMsg();
  if (!msg) return;
  _aiCoachStopStatusWatch();
  _aiCoachStatusGen++;
  _aiCoachStatusMsg = null;
  msg.content = '…';
  msg.suggestions = [];
  delete msg.failKind;
  renderAiCoachChat();
  await _aiCoachFetchReply(msg);
}

function aiCoachStatusSignIn() {
  if (window.AUTH && AUTH.showEmailScreen) AUTH.showEmailScreen('signin');
}

// Safety net behind the system prompt's "no markdown" instruction — the
// model mostly follows it, but not always. Strips **bold**/*italic*
// asterisks and leading "- "/"* " bullet markers without touching a
// legitimate mid-sentence "*" or "-" (a literal typo character, a math
// symbol) that isn't actually acting as markdown syntax.
function _stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')       // *italic*
    .replace(/^[ \t]*[-*][ \t]+/gm, '') // leading "- " / "* " bullets, per line
    .trim();
}

// Tolerant parse — DeepSeek may wrap JSON in ```json fences or add stray text.
function _parseAiCoachReply(raw) {
  let body = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = body.indexOf('{');
  const end   = body.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1));
      const advice = _stripMarkdown((obj.advice || '').toString().trim());
      const suggestions = Array.isArray(obj.suggestions)
        ? obj.suggestions.map(s => _stripMarkdown(String(s).trim())).filter(Boolean).slice(0, 3)
        : [];
      if (advice) return { advice, suggestions };
    } catch (_) { /* fall through */ }
  }
  return { advice: _stripMarkdown(raw), suggestions: [] };
}

// Persist coach chat onto a thread by id so History previews + a return
// visit pick up where the user left off. Also auto-titles + classifies the
// chat (icon category + pill label) the FIRST time it gets a real user
// message — coachTitle/coachTopic/coachPillText are then fixed for good,
// never re-evaluated as the conversation continues (see the AICOACH CHAT
// CLASSIFICATION comment near _classifyCoachTopic()).
function _persistAiCoachChatToThread(id) {
  if (!id) return;
  const threads = getThreads();
  const thread  = threads.find(t => t.id === id);
  if (!thread) return;
  thread.coachChat = _aiCoachChat;
  if (!thread.coachTitle) {
    const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
    if (firstUserMsg) {
      thread.coachTitle    = _autoShortTitle(firstUserMsg.content);
      thread.coachTopic    = _classifyCoachTopic(firstUserMsg.content);
      thread.coachPillText = _coachPillLabel(thread.coachTopic, firstUserMsg.content);
    }
  }
  saveThreads(threads);
}

// Saves to whichever thread this session's messages actually belong to —
// a thread explicitly linked via History/the link picker, or (failing
// that) the one this session auto-created on first send (see
// _ensureAiCoachAutoThread()). Every existing call site that used to save
// "the linked thread" goes through this now, so an ad-hoc unlinked chat
// keeps saving to its own auto-created thread turn by turn, not just once
// on exit.
function _persistAiCoachChat() {
  _persistAiCoachChatToThread(getLinkedThreadId() || _aiCoachAutoThreadId);
}

function _createAiCoachThreadFromFirstMessage(firstUserMsg) {
  const threads = getThreads();
  const title   = _autoShortTitle(firstUserMsg.content) || 'AI Coach chat';
  const topic   = _classifyCoachTopic(firstUserMsg.content);
  const thread  = {
    id: 'thread_' + Date.now(), name: title, createdAt: Date.now(),
    scans: [], chat: [], coachChat: _aiCoachChat.slice(),
    coachTitle: title, coachTopic: topic, coachPillText: _coachPillLabel(topic, firstUserMsg.content),
  };
  threads.unshift(thread);
  setThreadCount(getThreadCount() + 1);
  saveThreads(threads);
  renderThreadList();
  return thread;
}

// Called right after a real user message lands in _aiCoachChat. If this
// session isn't linked to any thread yet (no History entry, no explicit
// link) and hasn't already auto-created one of its own, create it now —
// instantly, not deferred until the user leaves AI Coach — so it's already
// sitting in chat history, named and all, the moment they check. Deliberately
// doesn't touch getLinkedThreadId()/the on-screen "Linked conversation"
// card — this is a plain ad-hoc chat with no real scan context to show,
// and flipping that mid-conversation would rewrite the greeting under the
// user's feet (see renderAiCoachChat() rebuilding it from scratch on every
// send).
function _ensureAiCoachAutoThread() {
  if (getLinkedThreadId() || _aiCoachAutoThreadId) return;
  const firstUserMsg = _aiCoachChat.find(m => m.role === 'user' && m.content && m.content.trim());
  if (!firstUserMsg) return;
  _aiCoachAutoThreadId = _createAiCoachThreadFromFirstMessage(firstUserMsg).id;
}

function hideAiCoachHowItWorks() { document.getElementById('aicoach-hiw-overlay').hidden = true; }

// ── Thread link picker (Fix 7) ─────────────────────────────────
function openThreadLinkPicker() {
  const overlay  = document.getElementById('thread-link-overlay');
  const list     = document.getElementById('thread-link-list');
  if (!overlay || !list) return;
  // Only threads that actually hold generated replies (saved scans) — a
  // thread that exists just because an AI Coach chat auto-created it has no
  // scans and nothing to link as conversation context.
  const threads  = getThreads().filter(t => t.scans && t.scans.length);
  const linkedId = getLinkedThreadId();
  list.innerHTML = '';

  // Remove option — only shown when a thread is currently linked
  if (linkedId) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'thread-link-row thread-link-row--remove';
    removeBtn.innerHTML = `
      <span class="thread-link-avatar">✕</span>
      <span class="thread-link-name">Remove conversation</span>`;
    removeBtn.onclick = () => linkThread(null);
    list.appendChild(removeBtn);
  }

  if (threads.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'thread-link-empty';
    empty.textContent = 'No threads yet. Save a scan to a thread first.';
    list.appendChild(empty);
  } else {
    threads.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'thread-link-row' + (t.id === linkedId ? ' selected' : '');
      // Same real per-style icon + colored circle treatment as History's
      // own thread rows (see renderHistoryList()'s rowIconHTML) — was just
      // a plain letter-initial circle before. .history-row-icon is added
      // alongside .thread-link-avatar so the has-img/onload toggle (which
      // looks for that exact class via .closest()) works the same way;
      // .thread-link-avatar's own (later-cascading) size still wins, so
      // this doesn't change these rows' proportions.
      const lastScan   = t.scans && t.scans.length ? t.scans[t.scans.length - 1] : null;
      const style      = lastScan && lastScan.style;
      const styleColor = STYLE_COLORS[style] || { bg: 'rgba(236,72,153,0.12)', accent: 'var(--accent)' };
      const rowIconHTML = STYLE_LABELS[style]
        ? `<img class="history-row-icon-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt=""
             onload="this.closest('.history-row-icon').classList.add('has-img')" onerror="this.remove()">
           <span class="history-row-icon-svg">${AICOACH_TOPIC_ICONS.reply}</span>`
        : _aiCoachTopicIconHTML('reply');
      btn.innerHTML = `
        <span class="thread-link-avatar history-row-icon" style="background:${styleColor.bg};color:${styleColor.accent}">${rowIconHTML}</span>
        <span class="thread-link-name">${_escapeHtml(t.name)}</span>
        <span class="thread-link-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>`;
      btn.onclick = () => linkThread(t.id);
      list.appendChild(btn);
    });
  }
  overlay.hidden = false;
}

function closeThreadLinkPicker() {
  const overlay = document.getElementById('thread-link-overlay');
  if (overlay) overlay.hidden = true;
}

function linkThread(id) {
  _aiCoachShotConvo = null;   // a linked chat replaces any uploaded screenshot
  setLinkedThreadId(id);
  closeThreadLinkPicker();
  refreshAiCoachCard();
  // If the AI Coach page is open, reload its context + conversation
  if (state.activeScreen === 'ai-coach') {
    const thread = getLinkedThread();
    _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
    _aiCoachGreetingPushed = _aiCoachChat.length > 0;
    renderAiCoachChat();
  }
}

// ================================================================
// AI COACH — CHAT HISTORY PANEL
// AI Coach conversations already live on the thread they're linked to
// (thread.coachChat, saved by _persistAiCoachChat()) — this panel is a
// nicer, sectioned (Pinned/Recents) way to browse and switch between
// those, not a second parallel storage system. Selecting a row reuses
// linkThread(), the exact same "point AI Coach at a different thread"
// logic the existing thread-link picker already uses.
// ================================================================
let _aiCoachHistoryOpen = false;
let _aiCoachActionsTargetId = null; // which thread the row-actions sheet / rename prompt is open for
let _aiCoachLongPressTimer = null;

function toggleAiCoachHistoryPanel(force) {
  _aiCoachHistoryOpen = typeof force === 'boolean' ? force : !_aiCoachHistoryOpen;
  const main  = document.getElementById('aicoach-main');
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!main || !panel || !scrim) return;
  if (_aiCoachHistoryOpen) {
    // Opening a nav panel is a deliberate, explicit action — unlike the
    // input-bar buttons, there's no reason to keep the keyboard up behind it.
    document.getElementById('aicoach-input')?.blur();
    renderAiCoachHistoryPanel();
  }
  main.classList.toggle('aicoach-main--pushed', _aiCoachHistoryOpen);
  panel.classList.toggle('open', _aiCoachHistoryOpen);
  scrim.classList.toggle('open', _aiCoachHistoryOpen);
}

// A thread lands here from either side: a real AI Coach conversation
// (thread.coachChat) or a generated reply saved straight from the Scan page
// (thread.scans, no coach chat at all) — every generated reply should be
// reachable from this same history, not just ad-hoc coaching chats. A
// thread with both (a scan later discussed in AI Coach) shows whichever
// side was touched more recently.
function _aiCoachHistoryEntries() {
  const linkedId = getLinkedThreadId();
  return getThreads()
    .map(_aiCoachHistoryEntryForThread)
    .filter(Boolean)
    .map(entry => ({ ...entry, active: entry.id === linkedId }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function _aiCoachHistoryEntryForThread(t) {
  const hasCoachChat = Array.isArray(t.coachChat) && t.coachChat.length > 0;
  const lastScan = Array.isArray(t.scans) && t.scans.length ? t.scans[t.scans.length - 1] : null;
  if (!hasCoachChat && !lastScan) return null;

  const lastCoachMsg = hasCoachChat ? t.coachChat[t.coachChat.length - 1] : null;
  const coachTime = lastCoachMsg ? (lastCoachMsg.time || 0) : -1;
  const scanTime  = lastScan ? (lastScan.time || 0) : -1;
  const useCoach  = hasCoachChat && coachTime >= scanTime;

  if (useCoach) {
    return {
      id: t.id,
      title: t.coachTitle || t.name,
      topic: t.coachTopic || 'advice',
      pillText: t.coachPillText || 'Situation advice',
      preview: (lastCoachMsg && lastCoachMsg.content) || '',
      pinned: !!t.coachPinned,
      updatedAt: coachTime,
    };
  }
  const styleLabel = STYLE_LABELS[lastScan.style] || 'Reply';
  return {
    id: t.id,
    title: t.name,
    topic: 'reply',
    style: lastScan.style || null,
    pillText: styleLabel + ' reply',
    preview: lastScan.reply || '',
    pinned: !!t.coachPinned,
    updatedAt: scanTime,
  };
}

// A 'reply' entry (whether a generated scan, which knows its style
// directly, or an ad-hoc AI Coach chat that mentioned one by name — same
// keyword match _coachPillLabel() already uses for its pill text) gets its
// actual reply-style icon (smooth/funny/warmer/direct/bolder/shorter/
// longer) instead of the generic reply-bubble icon — a real, specific
// picture of what was generated rather than a topic placeholder.
function _aiCoachHistoryRowStyle(entry) {
  if (entry.topic !== 'reply') return null;
  if (entry.style && STYLE_LABELS[entry.style]) return entry.style;
  const low = `${entry.title || ''} ${entry.preview || ''}`.toLowerCase();
  return Object.keys(STYLE_LABELS).find(k => low.includes(k)) || null;
}

function _aiCoachHistoryRowHTML(entry) {
  const style      = _aiCoachHistoryRowStyle(entry);
  const styleTheme = style ? STYLE_COLORS[style] : null;
  const colors     = styleTheme || AICOACH_TOPIC_COLORS[entry.topic] || AICOACH_TOPIC_COLORS.advice;
  const iconHTML = style
    ? `<img class="aicoach-history-row-icon-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt=""
         onload="this.closest('.aicoach-history-row-icon').classList.add('has-img')" onerror="this.remove()">
       <span class="aicoach-history-row-icon-svg">${AICOACH_TOPIC_ICONS[entry.topic] || AICOACH_TOPIC_ICONS.advice}</span>`
    : _aiCoachTopicIconHTML(entry.topic);
  // Always paint the colored circle, styled or not — see the matching
  // comment in renderHistory() (script.js): reply-style crops don't carry
  // their own backdrop like the AI Coach brand gem does, so going
  // transparent exposes their soft drop-shadow edge directly against the
  // row background, which reads as a poorly-cropped smudge in dark mode.
  return `
    <button type="button" class="aicoach-history-row${entry.active ? ' selected' : ''}" data-thread-id="${_escapeHtml(entry.id)}">
      <span class="aicoach-history-row-icon" style="background:${colors.bg};color:${colors.accent}">${iconHTML}</span>
      <span class="aicoach-history-row-main">
        <span class="aicoach-history-row-top">
          <span class="aicoach-history-row-title">${_escapeHtml(entry.title)}</span>
          <span class="aicoach-history-row-time">${_scanHistoryTime(entry.updatedAt)}</span>
        </span>
        <span class="aicoach-history-row-preview">${_escapeHtml(entry.preview)}</span>
        <span class="aicoach-history-row-pill" style="background:${colors.bg};color:${colors.accent}">${_escapeHtml(entry.pillText)}</span>
      </span>
      ${entry.pinned ? '<span class="aicoach-history-pin-dot" aria-hidden="true"></span>' : ''}
    </button>`;
}

function renderAiCoachHistoryPanel() {
  const list = document.getElementById('aicoach-history-list');
  if (!list) return;
  const entries = _aiCoachHistoryEntries();
  const pinned  = entries.filter(e => e.pinned);
  const recents = entries.filter(e => !e.pinned);

  if (!entries.length) {
    list.innerHTML = '<p class="aicoach-history-empty">No coaching chats yet — start one from a thread’s AI Coach card.</p>';
  } else {
    let html = '';
    if (pinned.length)  html += '<div class="aicoach-history-section-label">Pinned</div>'  + pinned.map(_aiCoachHistoryRowHTML).join('');
    if (recents.length) html += '<div class="aicoach-history-section-label">Recents</div>' + recents.map(_aiCoachHistoryRowHTML).join('');
    list.innerHTML = html;
  }

  // Long-press (pin/rename/delete) needs its own touchstart/move/end
  // sequencing, not a single tap — attached here rather than as inline
  // HTML attributes.
  list.querySelectorAll('.aicoach-history-row').forEach(row => {
    const id = row.dataset.threadId;
    row.addEventListener('click', () => aiCoachHistorySelect(id));
    row.addEventListener('touchstart', () => {
      clearTimeout(_aiCoachLongPressTimer);
      _aiCoachLongPressTimer = setTimeout(() => openAiCoachRowActions(id), 500);
    }, { passive: true });
    row.addEventListener('touchmove', () => clearTimeout(_aiCoachLongPressTimer), { passive: true });
    row.addEventListener('touchend',  () => clearTimeout(_aiCoachLongPressTimer), { passive: true });
  });
}

function aiCoachHistorySelect(id) {
  linkThread(id);
  toggleAiCoachHistoryPanel(false);
}

// This called openThreadLinkPicker() before — the "link to an existing
// thread" picker, not a fresh conversation — so "New chat" actually took
// you to pick an EXISTING thread and land in that conversation instead of
// starting a blank one. linkThread(null) unlinks + clears _aiCoachChat +
// re-renders (same reset openAiCoach() itself does for a linkless open),
// mirrored here with the same extra resets that path also does.
function aiCoachHistoryNewChat() {
  linkThread(null);
  _aiCoachAutoThreadId = null;
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  aiCoachDismissStagedPill();
  toggleAiCoachHistoryPanel(false);
}

function openAiCoachRowActions(id) {
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  _aiCoachActionsTargetId = id;
  document.getElementById('aicoach-row-actions-title').textContent = thread.coachTitle || thread.name;
  const pinned = !!thread.coachPinned;
  document.getElementById('aicoach-row-actions-pin').innerHTML = `
    <span class="aicoach-row-actions-icon"><img src="assets/icons/misc/row-action-pin.png" alt=""></span>
    <span class="aicoach-row-actions-text">
      <span class="aicoach-row-actions-label">${pinned ? 'Unpin' : 'Pin'}</span>
      <span class="aicoach-row-actions-desc">${pinned ? 'Remove from the top' : 'Keep this chat at the top'}</span>
    </span>`;
  document.getElementById('aicoach-row-actions-overlay').hidden = false;
}

function closeAiCoachRowActions() {
  document.getElementById('aicoach-row-actions-overlay').hidden = true;
  _aiCoachActionsTargetId = null;
}

function aiCoachHistoryTogglePin() {
  const id = _aiCoachActionsTargetId;
  if (!id) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (!thread) return;
  thread.coachPinned = !thread.coachPinned;
  saveThreads(threads);
  closeAiCoachRowActions();
  renderAiCoachHistoryPanel();
}

function aiCoachHistoryRename() {
  const id = _aiCoachActionsTargetId; // keep it set — the rename overlay reuses it
  const thread = getThreads().find(t => t.id === id);
  if (!thread) return;
  document.getElementById('aicoach-row-actions-overlay').hidden = true;
  const input = document.getElementById('aicoach-rename-input');
  input.value = thread.coachTitle || thread.name;
  document.getElementById('aicoach-rename-overlay').hidden = false;
  setTimeout(() => input.focus(), 60);
}

function closeAiCoachRenamePrompt() {
  document.getElementById('aicoach-rename-overlay').hidden = true;
  _aiCoachActionsTargetId = null;
}

function aiCoachHistoryRenameConfirm() {
  const id = _aiCoachActionsTargetId;
  const input = document.getElementById('aicoach-rename-input');
  if (!id || !input) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (thread) {
    thread.coachTitle = input.value.trim() || undefined;
    saveThreads(threads);
  }
  closeAiCoachRenamePrompt();
  renderAiCoachHistoryPanel();
}

function aiCoachHistoryDelete() {
  const id = _aiCoachActionsTargetId;
  if (!id) return;
  const threads = getThreads();
  const thread = threads.find(t => t.id === id);
  if (thread) {
    thread.coachChat = [];
    thread.coachPinned = false;
    thread.coachTitle = undefined;
    saveThreads(threads);
    if (thread.id === getLinkedThreadId() && state.activeScreen === 'ai-coach') {
      _aiCoachChat = [];
      renderAiCoachChat();
    }
  }
  closeAiCoachRowActions();
  renderAiCoachHistoryPanel();
}


// ================================================================
