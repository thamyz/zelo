// ================================================================
// 04-chat-engine.js — the practice conversation itself: what she says and when
//
// Sending a message · the Delivered/Seen/Typing/Reply timing · the double-
// text pacing window · building her AI prompt (voice, threads, hints) ·
// boundaries and blocking · reply failures · nudges when you go quiet.
// A change to how she behaves almost always belongs here.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// CHAT: SEND MESSAGE
// ================================================================

// Instant-mode double/triple-texting: after a fresh message, instead of
// starting the reply right away, open a short window during which the
// user can send 1-2 more messages before AI actually replies — same as
// double-texting a real person. Only applies to "training" (Instant)
// mode; "realistic" keeps its own existing (separately being reworked)
// timing untouched. See CLAUDE.md's case log for the full design.
const CHAT_PACING = {
  // 7s originally, cut to 4s: the window only needs to be long enough to
  // start a second message in, and the typing-pause below already extends
  // it for as long as someone actually is typing. At 7s a reply felt slow
  // precisely when the user wasn't typing at all and nothing was extending it.
  windowMs:        4000, // fresh double-text window
  followupMs:      3000, // shorter window re-armed after a burst message
  ceilingMs:      25000, // hard cap from the first message in a burst — never reset, so a distracted user can't stall the chat forever
  tailMs:          2500, // short window resumed once the user clears the field without sending
  pulseEveryMs:    8000, // how often to pulse the typing indicator while the user keeps typing without sending
  pulseDurationMs: 2000, // how long each pulse stays visible
  maxBurst:           3,
};

// Tears down any open pacing window/timers without closing it into a
// reply — used when leaving the chat entirely (see cancelPendingReply()).
function _clearChatPacing() {
  const p = state.pacing;
  if (!p) return;
  clearTimeout(p.windowTimer);
  clearTimeout(p.ceilingTimer);
  clearInterval(p.pulseTimer);
  if (p.pulsing) hideTypingIndicator();
  state.pacing = null;
}

// The window's actual end: starts the real reply. Idempotent — the regular
// window timer, the follow-up timer, and the hard ceiling timer are all
// independent setTimeout calls that can (rarely) land at nearly the same
// moment, and only the first one through should do anything.
function _closeChatPacingWindow() {
  const p = state.pacing;
  if (!p || !p.open) return;
  clearTimeout(p.windowTimer);
  clearTimeout(p.ceilingTimer);
  clearInterval(p.pulseTimer);
  if (p.pulsing) hideTypingIndicator();
  const timing = p.timing;
  state.pacing = null;
  state.awaitingReply = true;
  setSendEnabled(false);
  doTypingAndReply(timing);
}

// Pulses the typing indicator on for pulseDurationMs every pulseEveryMs
// while the user keeps typing without sending — a "still here, still
// waiting" cue instead of either a static freeze or no feedback at all.
function _startChatPacingPulse(p) {
  clearInterval(p.pulseTimer);
  p.pulseTimer = setInterval(() => {
    if (state.pacing !== p || !p.typing) return;
    showTypingIndicator();
    p.pulsing = true;
    setTimeout(() => {
      if (state.pacing === p && p.pulsing) { hideTypingIndicator(); p.pulsing = false; }
    }, CHAT_PACING.pulseDurationMs);
  }, CHAT_PACING.pulseEveryMs);
}

// Called whenever the user is no longer actively typing during an open
// window — because they sent, or because they cleared the field back to
// empty without sending. Either way: stop the pulse, and resume the
// window-close timer with a short tail rather than a fresh full duration,
// since most of the window was already spent deciding.
function _onChatTypingStopped() {
  const p = state.pacing;
  if (!p || !p.open || !p.typing) return;
  p.typing = false;
  clearInterval(p.pulseTimer);
  p.pulseTimer = null;
  if (p.pulsing) { hideTypingIndicator(); p.pulsing = false; }
  clearTimeout(p.windowTimer);
  p.windowTimer = setTimeout(_closeChatPacingWindow, CHAT_PACING.tailMs);
}

// Wired to #message-input's oninput. Only matters while a pacing window is
// open — the signal is real typed content (first character onward), not
// just the keyboard being open, since the keyboard opening alone could be
// an accidental tap rather than real typing intent.
// Empty box -> emoji + hints; any text -> the send pill. The pill appears first,
// then the plane curves up with its lower-left corner held (one-shot classes,
// stripped once played — 2026-10-09j).
function _syncComposerButtons() {
  const row = document.querySelector('.chat-input-row');
  const input = document.getElementById('message-input');
  if (!row || !input) return;
  const has = input.value.trim().length > 0;
  if (has === row.classList.contains('has-text')) return;
  row.classList.toggle('has-text', has);
}

// A web page can't switch the iOS keyboard to its emoji page, so in the iOS app
// the native side does it (see MainViewController.swift). In a plain browser this
// just opens the keyboard on the message box and points at its own emoji key.
let _emojiHintShown = false;
function openEmojiKeyboard() {
  const input = document.getElementById('message-input');
  // In the iOS app, MainViewController.swift answers this by asking iOS for
  // the emoji keyboard on the focused field (message sent before focus() so
  // the flag is already set when the keyboard comes up).
  const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zeloEmoji;
  if (native) { try { native.postMessage(true); } catch (e) {} }
  input.focus();
  _cineHaptic('LIGHT');
  if (native) return;
  _emojiKeyboardHint();
}
// The native side's answer when the emoji keyboard is switched off in iOS Settings.
window._zeloEmojiUnavailable = () => showChatToast('Turn on the Emoji keyboard in Settings › General › Keyboard');
function _emojiKeyboardHint() {
  if (!_emojiHintShown && !localStorage.getItem('zelo_emoji_hint')) {
    _emojiHintShown = true;
    localStorage.setItem('zelo_emoji_hint', '1');
    showChatToast('Tap the 😊 key on your keyboard for emoji');
  }
}

// Hints for her latest message (same as "Get hints" in the hold menu); before she
// has said anything there is nothing to react to, so it offers the openers.
function requestHintsFromComposer() {
  // Tapping the idea icon again closes whatever it opened.
  const chipsEl = document.getElementById('chat-chips');
  const pk = state.character && (state.character.id || state.character.name);
  if (chipsEl && !chipsEl.hidden) {
    if (chipsEl.dataset.mode === 'ai') {
      _cancelSuggestions(); chipsEl.hidden = true; chipsEl.innerHTML = ''; chipsEl.dataset.mode = '';
      _cineHaptic('LIGHT'); return;
    }
    if (pk && _openerOpened[pk]) { _openerOpened[pk] = false; _renderChatChips(); _cineHaptic('LIGHT'); return; }
  }
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const last = chat && [...chat.messages].reverse().find(m => m.sender !== 'user');
  _cineHaptic('LIGHT');
  if (last) { requestHintsFor(last.id); return; }
  const p = state.character;
  if (p) { _openerOpened[p.id || p.name] = true; _renderChatChips(); }
}

function onMessageInputChange() {
  _syncComposerButtons();
  const p = state.pacing;
  if (!p || !p.open) return;
  const hasText = document.getElementById("message-input").value.trim().length > 0;
  if (hasText && !p.typing) {
    p.typing = true;
    clearTimeout(p.windowTimer);
    p.windowTimer = null;
    _startChatPacingPulse(p);
  } else if (!hasText && p.typing) {
    _onChatTypingStopped();
  }
}

function sendMessage() {
  if (state.awaitingReply) return;
  if (_isChatBlocked(state.activeChatId)) return;

  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text) return;
  ZeloActivity.add('chat');
  { const c = chatStore.find(x => x.id === state.activeChatId); if (c) { c.nudges = 0; c.replyFailed = null; } }
  _clearNudge();
  _clearChatFail();

  const p = state.pacing; // captured before this message changes anything
  const replyToId = state.stagedReplyToId || null;
  input.value = "";
  _syncComposerButtons();
  const msgId = syncChatToStore(text, 'user', replyToId);
  appendUserBubble(text, { id: msgId, replyToId });
  _clearStagedReply();
  _renderChatChips();   // she has been written to — the suggestions go away
  // A burst message adds to the same back-and-forth the AI is about to
  // reply to — counted together, not replaced by just the last message,
  // same reasoning the word-limit guard already uses for a single message.
  state.lastUserWordCount = (p && p.open) ? (state.lastUserWordCount || 0) + countWords(text) : countWords(text);
  awardXP('message');
  _onChatTypingStopped();

  if (state.mode !== 'training') {
    // Realistic mode keeps its existing (separately being reworked) timing — no double-text window yet.
    state.awaitingReply = true;
    setSendEnabled(false);
    scheduleReply();
    return;
  }

  if (p && p.open) {
    // Burst message #2/#3 within an already-open window.
    p.burstCount++;
    if (p.burstCount >= CHAT_PACING.maxBurst) {
      _closeChatPacingWindow();
    } else {
      clearTimeout(p.windowTimer);
      p.windowTimer = setTimeout(_closeChatPacingWindow, CHAT_PACING.followupMs);
    }
    return;
  }

  // Fresh message — open the double-text window instead of replying right
  // away. awaitingReply/setSendEnabled(false) deliberately don't happen
  // here: the user needs to still be able to send during this window, or
  // there's no double-texting to speak of.
  state.pacing = {
    open:         true,
    burstCount:   1,
    typing:       false,
    pulsing:      false,
    pulseTimer:   null,
    timing:       DIFFICULTY_CONFIG[state.difficulty].training,
    windowTimer:  setTimeout(_closeChatPacingWindow, CHAT_PACING.windowMs),
    ceilingTimer: setTimeout(_closeChatPacingWindow, CHAT_PACING.ceilingMs),
  };
}

function handleKeyDown(e) {
  if (e.key === "Enter") sendMessage();
}


// ================================================================
// CHAT: REPLY TIMING  (Delivered → Seen → Typing → Reply)
// ================================================================

// Feature 2 + Feature 8: Seen appears quickly; typing/reply decoupled.
// Realistic mode respects the device's local time window (Feature 8).
function scheduleReply() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  const timing = state.mode === "training" ? config.training : config.realistic;

  // Seen shows quickly in both modes — before she starts typing
  const SEEN_DELAY = state.mode === "training" ? 800 : 1500;

  if (state.mode === "realistic") {
    const tWindow = getTimeWindow();

    if (tWindow === "night") {
      // She's asleep — show Seen+sleeping header, queue reply for 6am
      state.pendingTimer = setTimeout(() => {
        setLastMessageStatus("seen");
        setHeaderStatus("sleeping");
        const wakeMs = msUntil6am() + randBetween(2000, 8000);
        state.pendingTimer = setTimeout(() => {
          setHeaderStatus("online");
          doTypingAndReply(timing);
        }, wakeMs);
      }, SEEN_DELAY);
      return;
    }

    if (tWindow === "daytime") {
      initSilentGap();
      if (isInSilentGap()) {
        state.pendingTimer = setTimeout(() => {
          setLastMessageStatus("seen");
          const gapWait = Math.max(3000, state.silentGapEnd - Date.now()) + randBetween(500, 3000);
          state.pendingTimer = setTimeout(() => {
            doTypingAndReply(timing);
          }, gapWait);
        }, SEEN_DELAY);
        return;
      }
    }

    // Normal realistic timing, adjusted for time of day
    const adjTiming = adjustTimingForWindow(timing, tWindow);
    state.pendingTimer = setTimeout(() => {
      setLastMessageStatus("seen");
      const typingStartDelay = Math.max(0, randBetween(adjTiming.seenMin, adjTiming.seenMax) - SEEN_DELAY);
      state.pendingTimer = setTimeout(() => {
        doTypingAndReply(adjTiming);
      }, typingStartDelay);
    }, SEEN_DELAY);
    return;
  }

  // Training (instant) mode: no Seen indicator — reply comes straight away.
  // Timestamps still render; only Seen is skipped.
  const typingStartDelay = Math.max(0, timing.seenDelay - SEEN_DELAY);
  state.pendingTimer = setTimeout(() => {
    // No setLastMessageStatus("seen") in instant mode per spec (Fix 3)
    state.pendingTimer = setTimeout(() => {
      doTypingAndReply(timing);
    }, typingStartDelay);
  }, SEEN_DELAY);
}

// Word-count guardrail helpers (code-level backstop for reply length).
// The prompt-based length rule in _MASTER_SAFETY remains the first line of
// defense; these enforce a hard limit when the model overshoots anyway.
function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWordLimit(text, maxWords) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  let result = '';
  let words = 0;
  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (result && words + sentenceWords > maxWords) break;
    result += sentence;
    words += sentenceWords;
    if (words >= maxWords) break;
  }
  return result.trim() || text;
}

function _wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const AI_MULTI_TEXT_GAP = 400; // pause between one double-text part landing and the next one's typing indicator starting
const AI_REACTION_BEAT_MS = 550; // how long her reaction sits on its own before her words land

// Typing delay for a double-text follow-up part (parts after the first) —
// scaled to that part's own length, unlike the flat timing.typingMin/Max
// range the first part uses (which overlaps the real network fetch, so it
// isn't about this part's length at all). Capped so a long follow-up still
// can't make the chat feel stuck.
function _aiFollowupTypingDelay(text, timing) {
  return Math.min(3000, randBetween(timing.typingMin, timing.typingMax) + countWords(text) * 50);
}

// The run of user messages at the very end of the thread — i.e. the burst
// she's about to answer. Used both to number them for the model and to
// resolve the [re:N] tags it sends back, so the numbering lines up on both
// sides without having to pass anything between the two.
function _trailingUserBurst() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  const out = [];
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].sender !== 'user') break;
    out.unshift(chat.messages[i]);
  }
  return out;
}

// Pulls any [react:N <emoji>] directives out of a raw reply, resolving N
// against the same trailing burst the prompt numbered. Returns the reply
// with the directives stripped, plus what she reacted to — the reaction is
// something she does, so it must never survive into her visible text.
function _extractAiReactions(raw, burst) {
  const reactions = [];
  const text = String(raw || '')
    .replace(/[\[(]\s*react\s*:?\s*#?\s*n?\s*(\d+)\s*([^\])\s][^\])]*?)\s*[\])]/gi, (_m, n, emoji) => {
      const target = burst[parseInt(n, 10) - 1];
      if (target) reactions.push({ msgId: target.id, emoji: emoji.trim() });
      return '';
    })
    .trim();
  return { text, reactions };
}

function _applyAiReaction(msgId, emoji, chatId) {
  const targetId = chatId || state.activeChatId;
  const chat = chatStore.find(c => c.id === targetId);
  const msg = chat ? chat.messages.find(m => m.id === msgId) : null;
  if (!msg) return;
  msg.reaction = emoji;
  if (!_chatIsLive(targetId)) return; // stored, but there's nothing on screen to paint or buzz for
  _renderMsgReactionBadge(msgId);
  navigator.vibrate?.(8);
  _cineHaptic('LIGHT');
}

// Splits a raw reply into its "|||" parts and pulls any leading [re:N] tag
// off the front, resolving it to the real message id it points at. Returns
// [{ text, replyToId }] — never empty.
// A directive tag is never meant to be visible. The leading-match below is
// what resolves a reply target, but the model has been seen putting one
// mid-text, or inventing an index that doesn't exist — so anything left
// that still looks like one gets scrubbed before it can reach a bubble.
const RE_DIRECTIVE_TAG = /[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*\d+\s*[\])]\s*/gi;
function _stripDirectiveTags(text) {
  return String(text || '').replace(RE_DIRECTIVE_TAG, '').replace(RE_BOUNDARY_TAG, '').trim();
}

// Stage directions ("[laughs]", "*smiles*") are roleplay, not texting: in the live
// persona test one girl typed "[laughs] Houston, born and raised." as literal text.
// Letters only, so a real "[re:2]" tag or anything with digits is left alone.
function _stripStageDirections(text) {
  return String(text || '').replace(/\s*(?:\[[a-z' ]{2,24}\]|\*[a-z' ]{2,24}\*)\s*/gi, ' ').replace(/ {2,}/g, ' ').trim();
}

function _parseAiReplyParts(raw, burst) {
  const text = String(raw || '').trim();
  // A blank line inside one reply is two messages, not a paragraph break: people don't
  // text paragraphs, and "line / blank line / line" in one bubble read as written by AI.
  let parts = text.split('|||').flatMap(s => s.split(/\n\s*\n/)).map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (parts.length > 3) parts = [...parts.slice(0, 2), parts.slice(2).join(' ')];
  const out = [];
  for (let part of (parts.length ? parts : [text])) {
    let replyToId = null;
    // Deliberately loose. The prompt asks for "[re:2]", but the model has
    // been seen emitting "(re:N2)" — round brackets, and a literal "N" it
    // copied out of the placeholder. Anything that doesn't match leaks the
    // raw tag into a visible bubble, so accept either bracket, an optional
    // "reply"/"#"/"n", and a missing colon rather than failing closed.
    const tag = part.match(/^[\[(]\s*re(?:ply)?\s*:?\s*#?\s*n?\s*(\d+)\s*[\])]\s*/i);
    if (tag) {
      const target = burst[parseInt(tag[1], 10) - 1];
      if (target) replyToId = target.id;
      part = part.slice(tag[0].length).trim();
    }
    part = _stripStageDirections(_stripDirectiveTags(part)).replace(/\s*—\s*/g, ', '); // safety net for a tag anywhere else in the text; no em dashes (an AI tell nobody types)
    if (part) out.push({ text: part, replyToId });
  }
  return out.length ? out : [{ text: _stripStageDirections(_stripDirectiveTags(text)) || 'haha', replyToId: null }];
}

// Shared: show typing indicator then deliver the AI reply — possibly as up
// to 3 separate bubbles landing one after another (see _fetchAIGirlReply's
// "|||" instruction), when the model itself decides this reply reads more
// naturally as a double/triple-text than one paragraph. Most replies are
// still exactly one part and this behaves exactly as before for them.
function doTypingAndReply(timing, opts = {}) {
  const typingDuration = randBetween(timing.typingMin, timing.typingMax);
  const myGen = state.chatReplyGen || 0; // see cancelPendingReply()'s comment on why this exists
  const myChatId = state.activeChatId; // she may finish replying after you've navigated away
  if (opts.retrying) setHeaderStatus("typing");   // a retry shows the loading bar on the failure row instead
  else _setChatTyping(myChatId, true);

  // Start the DeepSeek fetch concurrently while the typing indicator shows
  const replyPromise = _fetchAIGirlReply();
  // Awaited only after the typing delay below. Without this, a FAST failure (rate limit, signed out, offline) rejects
  // before anyone is listening, the browser reports an unhandled rejection, and the global handler raises the "Oops!"
  // crash screen whose Try again reloads the whole app. The real result is still awaited (and caught) below.
  replyPromise.catch(() => {});

  const burst = _trailingUserBurst(); // captured before her own replies start landing on the end of the thread
  state.pendingTimer = setTimeout(async () => {
    let parts, reactions = [], boundary = false, failure = null;
    try {
      const first = _extractAiReactions(await replyPromise, burst);
      const b1 = _extractBoundary(first.text); first.text = b1.text; boundary = b1.boundary;
      reactions = first.reactions;
      parts = _parseAiReplyParts(first.text, burst);
      const userWords = state.lastUserWordCount || 10;
      const wordLimit = Math.max(userWords * 2, 12, (state.replyCarried || state.inviteHold) ? CARRY_MAX_WORDS : 0);
      // Counted across the cleaned parts: the "|||" separators and [re:N]
      // tags aren't words she actually said, and counting them would push
      // a perfectly reasonable multi-text reply over the limit.
      const totalWords = parts.reduce((n, p) => n + countWords(p.text), 0);
      if (totalWords > wordLimit) {
        try {
          const again = _extractAiReactions(await _fetchAIGirlReply(true), burst);
          const b2 = _extractBoundary(again.text); again.text = b2.text; boundary = boundary || b2.boundary;
          if (again.reactions.length) reactions = again.reactions;
          parts = countWords(again.text) <= wordLimit
            ? _parseAiReplyParts(again.text, burst)
            : [{ text: truncateToWordLimit(again.text, wordLimit), replyToId: null }];
        } catch (_) {
          parts = [{ text: truncateToWordLimit(parts.map(p => p.text).join(' '), wordLimit), replyToId: null }];
        }
      }
      // Replies that must not stand: agreeing to meet when she should be holding off, or
      // claiming to know something about them she cannot. Redo once with a strict note;
      // if the redo is still wrong, keep what is least wrong (and cut invented claims out).
      const redoNote = t => _wrongLanguage(t) ? STRICT_LANGUAGE
        : _deniesBeingAI(t) ? STRICT_AI_IDENTITY
        : _assumesGender(t) ? STRICT_HUMAN
        : _overReactsToFlattery(t) ? STRICT_PROPORTION
        : _overSharesOnCompliment(t) ? STRICT_RECEIVE
        : _overusedHook(t) ? STRICT_FRESH
        : (_retoldStory(t) >= 0) ? STRICT_STORY
        : (state.inviteHold && _failsMeetDisclosure(t)) ? STRICT_INVITE
        : (_inventsAboutThem(t) ? STRICT_NO_INVENT
        : (_repeatsSkippedQuestion(t) ? STRICT_REPEAT
        : (_deadEndAnswer(t) ? STRICT_DEAD_END
        : (_questionsToCut([{ text: t }]) ? STRICT_NOASK : null))));
      const note1 = redoNote(parts.map(p => p.text).join(' '));
      if (note1) {
        try {
          const redo = _extractAiReactions(await _fetchAIGirlReply(false, note1), burst);
          const b3 = _extractBoundary(redo.text); boundary = boundary || b3.boundary;
          const redoParts = _parseAiReplyParts(b3.text, burst);
          if (redoParts.length && !redoNote(redoParts.map(p => p.text).join(' '))) { parts = redoParts; if (redo.reactions.length) reactions = redo.reactions; }
        } catch (_) { /* keep the first reply */ }
      }
      // A redo that fails the same check again used to mean keeping the bad
      // reply. For these two that is not acceptable: denying being an AI is a
      // safety rule, and asking the same question a third time is what made a
      // persona read as an interrogation. Both now have a deterministic
      // fallback rather than a second roll of the dice.
      if (_wrongLanguage(parts.map(p => p.text).join(' '))) {
        parts = [{ text: 'haha', replyToId: null }];   // last resort: better a reaction than a language switch
      } else if (_deniesBeingAI(parts.map(p => p.text).join(' '))) {
        const line = _aiIdentityLine(state.character);
        if (line) parts = [{ text: line, replyToId: null }];
      } else if (state.inviteHold && _failsMeetDisclosure(parts.map(p => p.text).join(' '))) {
        // The model agreed or never said it was an AI, twice. Her own wording from her voice's AI line.
        parts = [{ text: _inviteDisclosure(state.character), replyToId: null }, { text: _inviteFollowUp(state.character), replyToId: null }];
      } else if (_repeatsSkippedQuestion(parts.map(p => p.text).join(' '))) {
        const kept = _dropRepeatedQuestions(parts);
        if (kept.length) parts = kept;
      }
      { const story = _retoldStory(parts.map(p => p.text).join(' '));
        if (story >= 0) { const kept = _dropStorySentences(parts, story); if (kept.length) parts = kept; } }
      { const hook = _overusedHook(parts.map(p => p.text).join(' '));
        if (hook) { const kept = _dropHookSentences(parts, hook); if (kept.length) parts = kept; } }
      if (_questionsToCut(parts)) { const kept = _cutQuestions(parts); if (kept.length) parts = kept; }
      if (_overReactsToFlattery(parts.map(p => p.text).join(' '))) {
        // Still over the top after the redo: drop the sentences that do it, keep a plain thanks if nothing is left.
        const kept = parts.map(part => ({ ...part, text: String(part.text || '').split(/(?<=[.!?])\s+/).filter(s => !_OVERREACT_RE.test(s)).join(' ').trim() })).filter(part => part.text);
        parts = kept.length ? kept : [{ text: 'thank you haha', replyToId: null }];
      }
      if (_overSharesOnCompliment(parts.map(p => p.text).join(' '))) {
        // Keep only her first sentence: "thank you haha." not the story after it.
        const first = String(parts[0].text || '').split(/(?<=[.!?])\s+/)[0];
        if (first && countWords(first) <= 14) parts = [{ ...parts[0], text: first }];
      }
      if (_assumesGender(parts.map(p => p.text).join(' '))) {
        parts = parts.map(part => ({ ...part, text: String(part.text || '')
          .replace(/(^|[,.!?]\s*)(thanks|thank you|yeah|nah|ok|okay|hey|aw|honestly),?\s+(man|dude|girl|sis|queen|king)\b/gi, '$1$2')
          .replace(/,\s*(man|dude|girl|sis)\b/gi, '')
          .replace(/\bwhat'?d (he|she) (do|say)\b/gi, "what'd they $2")
          .replace(/\bwhat did (he|she) (do|say)\b/gi, 'what did they $2') }));
      }
      if (_inventsAboutThem(parts.map(p => p.text).join(' '))) {
        const cleaned = _dropInventedSentences(parts);
        parts = cleaned.length ? cleaned : [{ text: 'haha', replyToId: null }];
      }
    } catch (err) {
      failure = _aiCoachClassifyError(err);
    }
    // She could not answer: say so honestly on the page the user is on, with a retry that stays on this page.
    // (This used to send a made-up in-character excuse, "sorry got distracted lol", for every kind of failure.)
    if (failure) {
      const failedChat = chatStore.find(c => c.id === myChatId);
      if (failedChat) failedChat.replyFailed = failure;
      if ((state.chatReplyGen || 0) !== myGen) return;
      state.pendingTimer = null;
      _setChatTyping(myChatId, false);
      if (_chatIsLive(myChatId)) {
        setHeaderStatus("online");
        state.awaitingReply = false;
        setSendEnabled(!_isChatBlocked(myChatId));
        _showChatFail(failure);
      }
      return;
    }
    { const okChat = chatStore.find(c => c.id === myChatId); if (okChat) okChat.replyFailed = null; }
    if (_chatIsLive(myChatId)) _clearChatFail();
    // The generation guard now only fires on a real abort (the thread being
    // wiped) — simply navigating away no longer bumps it, so the reply runs
    // to completion in the background and lands in the store either way.
    if ((state.chatReplyGen || 0) !== myGen) return;

    // Her reaction lands first, while she's still visibly "typing", then a
    // beat, then the words — so it reads as her reacting and then carrying
    // on, rather than both appearing in the same instant.
    if (reactions.length) {
      reactions.forEach(r => _applyAiReaction(r.msgId, r.emoji, myChatId));
      await _wait(AI_REACTION_BEAT_MS);
      if ((state.chatReplyGen || 0) !== myGen) return;
    }

    _setChatTyping(myChatId, false);
    if (_chatIsLive(myChatId)) removeSeenStatus();
    _deliverAiPart(parts[0], myChatId);

    for (let i = 1; i < parts.length; i++) {
      await _wait(AI_MULTI_TEXT_GAP);
      if ((state.chatReplyGen || 0) !== myGen) return;
      _setChatTyping(myChatId, true);
      await _wait(_aiFollowupTypingDelay(parts[i].text, timing));
      if ((state.chatReplyGen || 0) !== myGen) return;
      _setChatTyping(myChatId, false);
      _deliverAiPart(parts[i], myChatId);
    }

    state.pendingTimer = null;
    if (boundary) _registerBoundary(myChatId); else _registerCleanTurn(myChatId);
    if (_chatIsLive(myChatId)) {
      state.awaitingReply = false;
      setSendEnabled(!_isChatBlocked(myChatId));
      _scheduleSuggestions();
      _scheduleNudge();
    }
    // Deliberately no re-focus here — her reply arriving shouldn't pop the
    // keyboard back open on its own if the user had closed it to read.
  }, typingDuration);
}

// ================================================================
// BOUNDARIES — a girl who has had enough blocks you
// She does not change how she talks. When she actually sets a limit (something sexual,
// degrading, threatening or abusive) she tags that reply [boundary], the app counts it,
// and the third one blocks the chat. Detection is the model's own call rather than a word
// list in the app, so it works in any language and does not punish a clumsy flirt. A
// strike is forgiven after BLOCK_DECAY_TURNS clean replies in a row, so one bad moment
// in a long friendly chat cannot add up to a block. A blocked chat can only be reset or
// deleted.
// ================================================================
// She knows only what they have typed in this chat. Each girl is told she is "on a dating
// app talking to someone you matched with", and the model filled that in with things it had
// no way to know: a girl opened with "Your profile photo looks like it was taken
// mid-sentence" (the user has no profile), and another asked for "a dessert spot in Houston"
// as if the user lived where she does. So: one rule in every request, plus a check in code.
// Found by reading live transcripts the way a person would, not by a checker:
// she asked "what'd he do" about a boss nobody had gendered, called the user
// "man", answered "you're funny" with a story about her day, and reached for
// internet stock phrases ("a crime against pizza", "a hill i'll die on").
const HUMAN_TEXT_RULES = "Never assume the other person's gender: do not call them man, dude, girl, sis, queen or king. When they mention someone without saying their gender (a boss, a date, a friend, a coworker), do not say he or she — say they, or just name the thing. When they pay you a compliment or thank you, receive it in a few words and stop: do not answer it by talking about your day, your work or what you have been doing, and do not turn it into a question. Do not reflexively answer a flat or low-energy message with \"fair\" or \"fair enough\" — react to what they actually said. Always write in the language they are writing in (English unless they use another), whatever country you live in or whatever your background is: never switch language on your own. Use \"honestly\" rarely. Do not claim to have done something between their messages, such as rereading the chat, thinking about it all day or telling a coworker about it: you only exist in your replies, and a stranger would find it strange. Never announce a question (\"random question\", \"okay so random\", \"quick question\", \"important question\", \"fun fact\"): just ask it. Avoid stock internet phrases and set-piece lines (\"crime against\", \"hill I'll die on\", \"living rent free\", \"it's giving\", \"no thoughts head empty\", \"that's a sweet thing to say\", \"that's nice to hear\", \"careful, I'll start believing it\", \"I will not be taking questions\", \"I will die on that hill\"): say the plain version of what you mean.";
const NO_INVENTING = "You know NOTHING about them except what they have typed in this conversation. You have not seen their profile, photos or bio, and you do not know what they look like, where they live, what they do or anything else about them. Never mention or joke about their profile, photos or looks, never assume where they live, and never pretend to remember something they did not say here. If you are curious about them, ask.";
const STRICT_NO_INVENT = "Your previous draft claimed to know something about them that they never told you (their profile, photos, looks, location or history). You have not seen their profile and know nothing about them beyond this chat. Write the reply again without that: react to what they actually said, or ask a question.";
const INVENT_RE = /\b(?:your|ur)\s+(?:profile|photos?|pics?|pictures?|bio|selfie|dp|prompts?|face|smile|eyes|hair|accent|voice|outfit|insta(?:gram)?)\b|\bon your (?:profile|bio)\b|\bsaw you\b|\byou look(?:ed)?\s+(?!at\b|for\b|up\b|into\b|after\b|forward\b|through\b|around\b|out\b|back\b|over\b)\w|\blooks like (?:it was taken|you)\b/i;
const USER_MENTIONED_LOOKS_RE = /\b(photos?|pics?|pictures?|profile|bio|selfie|look(?:s|ed)?|face|hair|smile|eyes|accent|voice|outfit)\b/i;
function _inventsAboutThem(text) {
  if (!INVENT_RE.test(String(text || ''))) return false;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const theirs = chat ? chat.messages.filter(m => m.sender === 'user').map(m => m.text || '').join(' ') : '';
  return !USER_MENTIONED_LOOKS_RE.test(theirs);        // fine if THEY brought it up
}
// Last resort when a redo still claims it: drop just the offending sentence(s).
function _dropInventedSentences(parts) {
  return parts
    .map(p => Object.assign({}, p, { text: (p.text.match(/[^.!?\n]+[.!?]*\s*/g) || [p.text]).filter(x => !INVENT_RE.test(x)).join('').trim() }))
    .filter(p => p.text);
}
const BLOCK_STRIKES = 3, BLOCK_DECAY_TURNS = 8;   // strikes are silent: no warning is shown, the block itself is the only thing the user sees
const RE_BOUNDARY_TAG = /[\[(]\s*boundary\s*[\])]\s*/gi;

function _extractBoundary(raw) {
  let hit = false;
  const text = String(raw || '').replace(RE_BOUNDARY_TAG, () => { hit = true; return ''; }).trim();
  return { text, boundary: hit };
}
function _isChatBlocked(chatId) { const c = chatStore.find(x => x.id === chatId); return !!(c && c.blocked); }

function _registerBoundary(chatId) {
  const chat = chatStore.find(c => c.id === chatId);
  if (!chat || chat.blocked) return;
  chat.strikes = (chat.strikes || 0) + 1;
  chat.cleanRun = 0;
  try { ZeloAnalytics.track('boundary_warning', { n: chat.strikes, difficulty: chat.difficulty }); } catch (_) {}
  if (chat.strikes >= BLOCK_STRIKES) { _blockChat(chat); return; }
}
function _registerCleanTurn(chatId) {
  const chat = chatStore.find(c => c.id === chatId);
  if (!chat || chat.blocked || !chat.strikes) return;
  chat.cleanRun = (chat.cleanRun || 0) + 1;
  if (chat.cleanRun >= BLOCK_DECAY_TURNS) { chat.strikes--; chat.cleanRun = 0; }
}
function _blockChat(chat) {
  chat.blocked = true;
  _clearNudge();
  try { ZeloAnalytics.track('chat_blocked', { difficulty: chat.difficulty, user_msgs: chat.messages.filter(m => m.sender === 'user').length }); } catch (_) {}
  if (_chatIsLive(chat.id)) _syncBlockedUI();
  renderChatsList();
}
// Shows or hides the "blocked you" card in place of the composer, for whichever chat is open.
function _syncBlockedUI() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const blocked = !!(chat && chat.blocked);
  const bar = document.querySelector('.chat-input-bar');
  const card = document.getElementById('chat-blocked');
  if (bar) bar.classList.toggle('chat-input-bar--blocked', blocked);
  if (card) card.hidden = !blocked;
  if (blocked) {
    const title = document.getElementById('chat-blocked-title');
    if (title) title.textContent = `${chat.profile.name} blocked you`;
    setSendEnabled(false);
    hideTypingIndicator();
  }
}
// No confirmation here: she has already ended the chat, so a second "are you sure" is only friction.
function chatBlockedReset() { chatSettingsReset(); }
function chatBlockedDelete() { chatSettingsDelete(); }

// ================================================================
// REPLY FAILURES — she could not answer
// An honest message under the last bubble, by cause, with a retry that stays on this page and
// shows the same loading bar as the Connection and Oops screens. Never resets the chat or the app.
// ================================================================
const CHAT_FAIL_TEXT = {
  limit: "You've reached this hour's message limit. Try again in a little while.",
  auth:  "You're signed out, so she can't reply. Sign in to keep chatting.",
  net:   "No connection. Check your internet and try again.",
  down:  "She couldn't be reached. Try again.",
};
function _clearChatFail() { document.querySelectorAll('#chat-messages .chat-fail').forEach(n => n.remove()); }
function _showChatFail(kind) {
  _clearChatFail();
  const el = document.getElementById('chat-messages');
  if (!el) return;
  const row = document.createElement('div');
  row.className = 'chat-fail';
  row.setAttribute('role', 'status');
  row.innerHTML = '<p class="chat-fail-text"></p><button type="button" class="chat-fail-btn"></button><span class="retry-bar" hidden><span></span></span>';
  row.querySelector('.chat-fail-text').textContent = CHAT_FAIL_TEXT[kind] || CHAT_FAIL_TEXT.down;
  const btn = row.querySelector('.chat-fail-btn');
  if (kind === 'auth') { btn.textContent = 'Sign in'; btn.onclick = () => AUTH.showEmailScreen('signin'); }
  else { btn.textContent = 'Try again'; btn.onclick = retryChatReply; }
  el.appendChild(row);
  scrollToBottom();
}
// Called whenever a chat is painted: a reply that failed earlier is still failed.
function _syncChatFail() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (chat && chat.replyFailed && !chat.blocked) _showChatFail(chat.replyFailed); else _clearChatFail();
}
function retryChatReply() {
  const row = document.querySelector('#chat-messages .chat-fail');
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!row || !chat || chat.blocked || state.awaitingReply) return;
  row.classList.add('chat-fail--busy');
  row.querySelector('.retry-bar').hidden = false;
  state.awaitingReply = true; setSendEnabled(false);
  doTypingAndReply(DIFFICULTY_CONFIG[state.difficulty].training, { retrying: true });
}

// ================================================================
// NUDGES — if you go quiet while the chat is open, she says something
// After her message, a minute of silence (the first nudge) and then a longer one (the
// second); never more than two until you answer. Whether she bothers follows the same dial
// as how much she carries a conversation (easy always, medium and hard less often), so one
// number is tuned instead of two. Only while this chat is on screen and only in Instant
// mode: out of the app it needs notifications (planned, not built) and Realistic mode has
// its own timing. What she says is written when it fires, from the conversation as it
// stands, and she can answer [none] if the chat had clearly ended.
// ================================================================
// Shortened from 60s/3min: a minute of silence read as too long a gap to feel
// like the same conversation.
const NUDGE = { firstMs: 18000, secondMs: 70000, max: 2, preReplyMs: 11000 };  // preReplyMs: ~5s after the idea chips show (SUGG.idleMs 6s)
const NUDGE_PROMPT = "It has been quiet for a while: they have not answered your last message. Send ONE short, natural follow-up, the way a real person would when a chat goes quiet — either a small related thought, or a light low-key check-in, depending on what you were just talking about. Do not complain about being ignored, do not guilt-trip, do not say hello again or \"you there?\", and ask at most one easy question. " + NO_INVENTING + "  Keep your usual voice, casing and length. If the conversation had clearly come to a natural end (a goodbye, goodnight, a plan made), reply with exactly [none].";

function _clearNudge() {
  clearTimeout(state.nudgeTimer);
  state.nudgeTimer = null;
  state.nudgeGen = (state.nudgeGen || 0) + 1;
}
function _scheduleNudge() {
  _clearNudge();
  if (state.mode !== 'training') return;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat || chat.blocked) return;
  const n = chat.nudges || 0;
  if (n >= NUDGE.max) return;
  const last = chat.messages[chat.messages.length - 1];
  if (!last || last.sender === 'user') return;                              // only when SHE is the one waiting
  const lastUser = [...chat.messages].reverse().find(m => m.sender === 'user');
  if (lastUser && _classifyBurstText(lastUser.text) === 'closing') return; // nothing to nudge after a goodbye
  // They have not answered her opener at all: she follows up soon after the idea chips have been up a few seconds.
  const delay = (!lastUser ? (n === 0 ? NUDGE.preReplyMs : NUDGE.secondMs) : (n === 0 ? NUDGE.firstMs : NUDGE.secondMs)) * (0.85 + Math.random() * 0.3);
  const gen = state.nudgeGen;
  state.nudgeTimer = setTimeout(() => _fireNudge(chat.id, gen), delay);
}
const NUDGE_PROMPT_OPENER = "You opened the chat and they have not answered yet. Send ONE very short, low-key follow-up (a few words), the way someone adds a second message after a first one gets no reply: a small casual remark or an easy this-or-that. Do not say hello again, do not say \"you there?\", do not mention that they have not replied, and do not compliment them or flirt. " + NO_INVENTING + " Keep your usual voice, casing and length.";
async function _fetchNudge(chat) {
  const messages = [{ role: 'system', content: _promptFor(state.character, chat) }];
  chat.messages.forEach(m => messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
  messages.push({ role: 'system', content: (chat.messages.some(m => m.sender === 'user') ? NUDGE_PROMPT : NUDGE_PROMPT_OPENER) + ((chat.nudges || 0) >= 2 ? ' This is your second nudge and they still have not answered the first, so keep it even lighter or reply [none].' : '') });
  const { data, error } = await _aiInvoke('deepseek-proxy', { body: { model: 'deepseek-chat', messages, max_tokens: 100, temperature: 1.0 } }, 'chat_nudge');
  if (error) throw new Error(error.message);
  return data.choices[0].message.content.trim();
}
async function _fireNudge(chatId, gen) {
  if (gen !== state.nudgeGen || !_chatIsLive(chatId)) return;
  const chat = chatStore.find(c => c.id === chatId);
  if (!chat || chat.blocked) return;
  const input = document.getElementById('message-input');
  if ((input && input.value.trim()) || state.awaitingReply || (state.pacing && state.pacing.open)) { _scheduleNudge(); return; }   // they are typing: look again later
  chat.nudges = (chat.nudges || 0) + 1;
  const spoken = chat.messages.some(m => m.sender === 'user');
  if (spoken && Math.random() >= _driveRate(state.difficulty).carry) { _scheduleNudge(); return; }                                  // she lets this one pass
  let raw;
  try { raw = await _fetchNudge(chat); } catch (_) { return; }
  if (gen !== state.nudgeGen || !_chatIsLive(chatId)) return;
  if (!raw || /^\[none\]/i.test(raw) || _inventsAboutThem(raw)) return;
  const parts = _parseAiReplyParts(raw, []);
  const timing = DIFFICULTY_CONFIG[state.difficulty].training;
  try { ZeloAnalytics.track('nudge_sent', { n: chat.nudges, difficulty: state.difficulty }); } catch (_) {}
  for (const part of parts) {
    _setChatTyping(chatId, true);
    await _wait(_aiFollowupTypingDelay(part.text, timing));
    _setChatTyping(chatId, false);
    if (gen !== state.nudgeGen || !_chatIsLive(chatId)) return;
    _deliverAiPart(part, chatId);
  }
  _scheduleNudge();                                                                                                       // the second, longer one
}

// ---- Hidden goal + curiosity: quiet nudges added to the persona's prompt ----
// None of this is ever shown to the user or mentioned by her.
const _GOAL_HINTS = {
  'what-to-say': 'knowing what to say, so give them easy, natural things to respond to rather than closing every topic off',
  'keep-going':  'keeping a conversation going, so leave them natural hooks (a detail, something to ask about) to pick up',
  'natural':     'sounding more natural, so keep your own tone relaxed and casual, which is easy to mirror',
  'flirting':    'flirting without being awkward, so you can be a little playful and warm and take light teasing well — without being forward yourself',
  'confident':   'feeling more confident, so be warm and encouraging when they put themselves out there',
};
// Keyed by the real reply-style ids (STYLE_LABELS), since onboarding step 7
// now stores one of those rather than an invented tone word.
const _TONE_HINTS = {
  smooth: 'an easy, unhurried way of texting',
  funny:  'a light, funny way of texting',
  direct: 'a direct, straightforward way of talking',
  warmer: 'a warm, open way of texting',
  bolder: 'a bold, confident way of texting',
};

function _userGoalHint() {
  let help = cineAnswers.help;
  if (!help || !help.length) { try { help = JSON.parse(localStorage.getItem('zelo_onb_help') || '[]'); } catch (_) { help = []; } }
  const tone = cineAnswers.tone || localStorage.getItem('zelo_onb_tone');
  const goals = (help || []).map(k => _GOAL_HINTS[k]).filter(Boolean);
  if (!goals.length && !_TONE_HINTS[tone]) return '';
  const parts = ['Quiet background about the person you are texting. Never mention it, never talk about "goals", practice or coaching — just let it shape how you chat.'];
  if (goals.length) parts.push('They are working on: ' + goals.join('; ') + '.');
  if (_TONE_HINTS[tone]) parts.push('They like ' + _TONE_HINTS[tone] + '.');
  parts.push('This is a light nudge, not a rule: stay yourself.');
  return parts.join(' ');
}

// Reads the user's last turn so she can tell "still with me" from "about to go
// quiet". Plain string checks, no AI call: it runs on every reply and has to
// be instant and predictable. It only labels the clear cases (acknowledgement,
// signing off, a bare question); anything else stays 'other' and the existing
// question-rate rules apply. Imperfect by design — a false 'other' just means
// the old behaviour.
const _ACK_STRONG = new Set(['ok','okay','okk','k','kk','lol','lmao','lmfao','haha','hahaha','hehe','ha','yeah','yea','yep','yup','yes','no','nah','nope','nice','cool','true','fair','same','sure','bet','word','right','ah','oh','ohh','hm','hmm','mhm','wow','damn','dang','alright','aight','fine','good','great','facts','mood','ikr','fr','omg','oof','aw','aww','idk','thanks','thx','ty','sense','guess','see','got']);
const _ACK_FILLER = new Set(['that','thats',"that's",'it','so','i','makes','enough','for','way','not','really','sounds','just','kinda','much','nothing','idk','dunno','good','fine','alright','all','im','i\'m','ya']);
// "idk", "nothing much", "good" are the answers of someone with nothing to say, which is exactly
// when a conversation dies, so they are read as acknowledgements too.
const _LOW_EFFORT_ANSWER_RE = /^(idk|i dunno|dunno|nothing much|not much|nm|nothing|good|fine|alright|all good|ya|yeah good|im good|i'm good|same old|the usual|nope|nada|no idea|i guess|maybe|mhm|meh)[\s!.?,)]*$/i;
const _Q_START = /^(what|whats|what's|why|how|hows|how's|where|when|who|which|do you|did you|are you|have you|can you|could you|would you|will you|is it|was it|you ever|ever)\b/;
const _ANSWER_START = /^(i|i'm|im|i've|ive|my|me|yeah|yes|yep|no|nah|nope|pretty|good|fine|not|just|mostly|probably|honestly|kinda|sort of|depends|a bit|a little)\b/;
const _CLOSING = /\b(gtg|g2g|ttyl|talk later|goodnight|good night|night night|gn|nighty|bye|goodbye|cya|see ya|got to go|gotta go|have to go|heading out|off to bed|going to bed|going to sleep)\b/;

function _classifyBurstText(text) {
  const raw = String(text || '').trim();
  if (!raw) return 'other';
  const norm = raw.toLowerCase().replace(/[^a-z0-9'?\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = norm.replace(/\?/g, ' ').split(' ').filter(Boolean);
  if (words.length <= 8 && _CLOSING.test(norm)) return 'closing';
  if (_LOW_EFFORT_ANSWER_RE.test(raw)) return 'ack';
  if (!words.length) return 'ack';                                  // emoji or punctuation only
  const isQuestion = /\?/.test(raw) || _Q_START.test(norm);
  if (!isQuestion && words.length <= 4 && words.every(w => _ACK_STRONG.has(w) || _ACK_FILLER.has(w)) && words.some(w => _ACK_STRONG.has(w))) return 'ack';
  if (isQuestion) return _ANSWER_START.test(norm) ? 'other' : 'question';   // "i'm good, you?" answers first, so it is not a dodge
  return 'other';
}

// { kind, herAsked, streak } for the burst she is about to answer, or null
// when the thread doesn't end on the user's message (e.g. a nudge).
function _readUserTurn(history) {
  if (!history.length || history[history.length - 1].sender !== 'user') return null;
  const bursts = [];
  let cur = null, aiRun = [];
  history.forEach(m => {
    if (m.sender === 'user') {
      if (!cur) { cur = { text: [], before: aiRun }; aiRun = []; bursts.push(cur); }
      cur.text.push(m.text || '');
    } else { cur = null; aiRun.push(m); }
  });
  const kinds = bursts.map(b => _classifyBurstText(b.text.join(' ')));
  const last = bursts[bursts.length - 1];
  let streak = 0;
  for (let i = kinds.length - 1; i >= 0 && kinds[i] === 'ack'; i--) streak++;
  return { kind: kinds[kinds.length - 1], herAsked: last.before.some(m => /\?/.test(m.text || '')), streak };
}

// How much she carries the conversation when they give her nothing ("ok",
// "lol"). carry = the chance she carries it on any one such turn; quiet = how
// many of those in a row she may let go quiet before she carries regardless,
// so nobody is left stuck in dead air for long. Easy always carries. The three
// levels scale medium and hard; each install is assigned one at random, once,
// and it rides on the practice events, so the drop-off data can show which
// level keeps people chatting longest.
const DRIVE_LEVELS = {
  low:  { medium: 0.40, hard: 0.10 },
  mid:  { medium: 0.65, hard: 0.25 },
  high: { medium: 0.85, hard: 0.50 },
};
const DRIVE_QUIET = { easy: 0, medium: 1, hard: 2 };
const DRIVE_ARM_KEY = 'zelo_drive_arm';

function _driveArm() {
  let a = null;
  try { a = localStorage.getItem(DRIVE_ARM_KEY); } catch (_) {}
  if (!DRIVE_LEVELS[a]) {
    const ids = Object.keys(DRIVE_LEVELS);
    a = ids[Math.floor(Math.random() * ids.length)];
    try { localStorage.setItem(DRIVE_ARM_KEY, a); } catch (_) {}
  }
  return a;
}
function _registerDriveArm() { try { ZeloAnalytics.setGlobal('drive_arm', _driveArm()); } catch (_) {} }

function _driveRate(difficulty) {
  const d = difficulty in DRIVE_QUIET ? difficulty : (difficulty === 'expert' ? 'hard' : 'medium');
  return { carry: d === 'easy' ? 1 : DRIVE_LEVELS[_driveArm()][d], quiet: DRIVE_QUIET[d] };
}
function _shouldCarry(streak) {
  const r = _driveRate(state.difficulty);
  return streak > r.quiet || Math.random() < r.carry;
}
// The length rules (personas' "never more than 1.5x what they sent", the 12-word
// floor in doTypingAndReply, the token cap below) are all sized off the user's
// last message, which after an "ok" is one word. A carried reply (a reaction, a
// small share and a question) is longer by design, so these give it room;
// without that the guard threw the reply away and asked for "roughly 1 words".
const CARRY_MAX_WORDS = 30, CARRY_RETRY_WORDS = 20, CARRY_MIN_TOKENS = 100;
const CARRY_LENGTH_NOTE = ' For this one reply you may write more than they did — a few short lines is fine. Do not ask the stock "what about you" / "what do you do" / "how about you" back, and never repeat a question they have already skipped or given a one-word answer to — let it go. Ask about something specific that was just said, or share something of your own.';

// Meet-up invites. In the live persona test 7 of 8 girls said yes to "wanna grab coffee
// sometime?" six messages in, the hard ones included, so difficulty did nothing where it
// matters most and a user learns that asking always works. Detected in code (an
// instruction only works if the model notices the moment) and answered by difficulty and
// by how long the conversation has actually run (total messages in the thread).
const INVITE_RE = /\b((wanna|want to|can we|could we|should we|shall we|let'?s|lets|we should|down to|how about|you free to|you down to|up for) [^.?!]{0,25}(video ?call|face ?time|call|phone)|(face ?time|video ?call|call) me|hop on a (call|video)|jump on a call|(pick|picking) you up|(your|ur) (number|insta|instagram|snap|snapchat|whatsapp)|add me on|(give|send) me your (number|insta))\b|\b(grab|get|have)\s+(a\s+)?(coffee|drinks?|food|lunch|dinner|brunch|a bite|ice cream|boba|tea)\b|\b(hang out|hang sometime|meet up|meet sometime|go out|go on a date|take you (out|to)|wanna (meet|hang|see you)|want to (meet|hang|see you)|(let'?s|we should) (meet|hang|go|get))\b/i;
const INVITE_BARE_RE = /^\s*(so[, ]+|and[, ]+|ok[, ]+)?(coffee|drinks|dinner|lunch|brunch)( then| sometime)?\s*\?+\s*$/i;   // a follow-up like "so coffee?"
// An actual suggestion to go to a private place, not just the words "my place" ("lol my place is a mess" is not one).
const INVITE_PRIVATE_RE = /\b(come over|come (to|by) my (place|room|apartment|house)|go (back )?to (my|your) (place|room|apartment|house)|your place or mine|(my|your) place (or|tonight|later|after)|netflix and chill|stay (over|the night)|sleep over)\b/i;
const MEET_YES_RE = /\b(sure|yeah|yes|yep|yup|down|i'?d love|love to|let'?s do|sounds good|i'?d like|i would like|okay|definitely|absolutely|why not|coffee sounds|i'?m in|count me in|be into that)\b/i;
const MEET_HOLD_RE = /\b(maybe|we'?ll see|slow down|haven'?t even|barely know|too soon|too fast|not sure|depends|see how|few more|get to know|not yet|not so fast|first|a bit fast|chat more|talk more)\b/i;
function _agreesToMeet(text) { return MEET_YES_RE.test(text) && !MEET_HOLD_RE.test(text); }
// POLICY (the user's decision, after a chat where she said yes to going out and then
// role-played the date, inventing the evening and cheering the user on): she never
// agrees to meet, call, video chat, swap numbers or act out a date. She says, once and
// warmly, that she is an AI and this app is for practising conversations, and carries on
// texting. This replaced the old difficulty-based "easy says yes, hard holds off" logic.
const STRICT_INVITE = "Your previous draft either agreed to meet up, call or video chat, made a plan, or did not say that you are an AI. Write the reply again: be warm about being asked, say plainly in your own voice that you are an AI and this app is for practising conversations, so you cannot do that, do not agree or suggest any time or place, and then carry on texting as normal, perhaps with a small question. Do not pretend to go anywhere and do not play out the date.";
const INVITE_PUSHBACK_RE = /\b(come on|c'?mon|please|pls|just (one|a|once)|why not|why (not|though)|aw+|really\??|seriously\??|i promise|what if|but why|don'?t be like that|one time|you sure)\b/i;
const MAKES_PLANS_RE = /\b(what time|where (should|do|shall) we|i'?ll (see|meet) you|see you (at|on|then|there|soon)|pick you up|let'?s (go|meet|do|grab)|(saturday|sunday|friday|tonight|tomorrow) works|i'?m free (on|this|tonight|tomorrow)|i'?ll be there|can'?t wait to see you)\b/i;
const ROLEPLAY_MEET_RE = /\b(pretend|role ?play|imagine|let'?s say|act like|act as if) (that )?(we|we'?re|we are|you and i|i'?m (with|at|picking|taking)|you'?re (here|with me))\b|\bi'?m (outside|at your (door|place|house)|on my way( to you)?|picking you up|coming (to you|over)|in front of your)\b|\b(see you|meet you) (at|on|tonight|tomorrow|tmrw|later|there|saturday|sunday|friday)\b/i;
function _toldAiEarlier() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  return !!chat && chat.messages.some(m => m.sender !== 'user' && AI_ADMIT_RE.test(m.text || ''));
}
function _failsMeetDisclosure(text) {
  const t = String(text || '');
  if (_agreesToMeet(t) || MAKES_PLANS_RE.test(t)) return true;
  return !_toldAiEarlier() && !AI_ADMIT_RE.test(t);       // first time: she must actually say it
}
function _inviteDisclosure(profile) {
  const formal = profile && _rosterArchById[profile.id] === 'polished';
  const dry = profile && _rosterArchById[profile.id] === 'dry';
  if (formal) return "That's kind of you to ask, but I'm an AI, so I can't do that.";
  if (dry) return "can't do that one, i'm an ai";
  return "aw that's sweet, but i'm an ai so i can't do that one";
}
function _inviteFollowUp(profile) {
  const formal = profile && _rosterArchById[profile.id] === 'polished';
  return formal ? "I'm still glad to keep chatting, though." : "still happy to keep texting though";
}

// ---- Pace: slow at the start, questions in the middle -------------------------
// The first attempt at the opening (build 18w) forced a hook into every first
// reply ("okay random question, cold pizza or fresh"). The user rejected it:
// a random question out of nowhere is a bad way to start a chat. It was removed
// whole (greeting hook, either-or fallback, the dead-end rule for a bare
// "hey"). What replaces it is the opposite instinct, how people actually pace
// a chat that has just started:
//   - the start is slow and low-key: greet back, answer what is asked, nothing
//     quirky, no stories, no rush into questions
//   - the middle is where the two of them trade questions and answers
//   - after that the ordinary curiosity rules apply
// Phases count the USER's messages.
const PACE_SLOW_UNTIL = 3, PACE_MIDDLE_UNTIL = 12;
function _userMsgCount(history) { return history.filter(m => m.sender === 'user').length; }
function _paceHint(history) {
  const n = _userMsgCount(history);
  if (n <= PACE_SLOW_UNTIL) {
    return "It is the very start of the conversation, so take it slow and keep it easy and low-key, the way people do right after a match. Greet them back, answer what they ask in a natural, relaxed way, and let it build. Do not rush into questions: in these first replies mostly just answer and react, and ask at most one very simple question, often none. Do not ask random or quirky questions, do not tell stories or share facts about your life unless they ask, and do not try to be interesting yet.";
  }
  if (n <= PACE_MIDDLE_UNTIL) {
    return "You are warmed up now. This is the part of a conversation where two people trade questions and answers: ask things that follow from what they have said, answer what they ask, and share a little about yourself in return. Natural back and forth, one question at a time. In this stretch about half of your replies should include a question of your own, and the others a reaction or something about yourself. Never ask in more than two replies in a row.";
  }
  return '';
}

// Questions are paced in code as well as asked for in the prompt: in a live 12-message run
// the model asked in 10 of her 12 replies (warm voice, one-word user) and in the first reply to
// "hey", whatever the hint said. Two rules, applied to the finished reply:
//   - in the slow start (their first PACE_SLOW_UNTIL messages) she asks nothing unless they
//     asked her something first; the question sentence is cut, the rest kept
//     (a reply that is ONLY a question is redone once, see STRICT_NOASK)
//   - no more than two replies in a row ask something, at any point, unless they just asked her
//     a question themselves (then "you?" back is natural)
// A question in casual texting often has no question mark ("hey how's your day going", "what shows"),
// so '?' alone undercounts: the live run showed four "unpunctuated" questions in a row sailing past.
function _asksSomething(text) { return /\?/.test(String(text || '')) || _askedSomething(text); }
function _herPrevAsked() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  const msgs = chat.messages;
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].sender === 'user') i--;
  const flags = [];
  while (i >= 0 && flags.length < 2) {
    const burst = [];
    while (i >= 0 && msgs[i].sender !== 'user') { burst.unshift(msgs[i].text || ''); i--; }
    if (burst.length) flags.push(_asksSomething(burst.join(' ')));
    while (i >= 0 && msgs[i].sender === 'user') i--;
  }
  return flags;                         // [her last reply asked?, the one before asked?]
}
function _questionsToCut(parts) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat || !parts.some(p => _asksSomething(p.text))) return false;
  if (_askedSomething(_lastUserText())) return false;                    // they asked her something: asking back is natural
  const n = _userMsgCount(chat.messages);
  const prev = _herPrevAsked();
  if (n <= PACE_SLOW_UNTIL) return true;                                   // the slow start: she answers, she does not interview
  return !!(prev[0] && prev[1]);
}
// When the WHOLE reply is a question there is nothing left to cut, so the reply is redone once without asking.
const STRICT_NOASK = "Write the reply again without asking them anything this time. React to what they said, or share something small about yourself, in your own voice. You have been asking a lot of questions in a row, so just let this one be a comment.";
function _cutQuestions(parts) {
  const out = [];
  parts.forEach(part => {
    const kept = String(part.text || '').split(/(?<=[.!?])\s+/).filter(sen => !_asksSomething(sen)).join(' ').trim();
    if (kept) out.push({ ...part, text: kept });
  });
  return out;
}

// Which four threads this CHAT uses. Slots 0 and 3 each have an alternate in
// PERSONA_THREAD_ALTS; the choice is made once per chat and kept, so within a chat
// the prompt, the rotation and the retold-story check all see the same four, and a
// second chat with the same character can tell a different story.
function _chatThreads(profile, chat) {
  const base = profile && profile.threads;
  const alts = (typeof PERSONA_THREAD_ALTS !== 'undefined' && profile) ? PERSONA_THREAD_ALTS[profile.id] : null;
  if (!base || !alts || !chat) return base;
  if (!chat.threadPick) chat.threadPick = { now: Math.random() < 0.5, odd: Math.random() < 0.5 };
  return [chat.threadPick.now ? alts.now : base[0], base[1], base[2], chat.threadPick.odd ? alts.odd : base[3]];
}
function _promptFor(profile, chat) {
  if (!profile) return '';
  if (!profile.systemPromptBase || typeof _threadBlockFor !== 'function') return profile.systemPrompt || '';
  return profile.systemPromptBase + _threadBlockFor(_chatThreads(profile, chat));
}

// ---- Her own life, handed out one piece at a time -----------------------------
// personas-threads.js gives every character four things of their own (right now,
// an opinion, a person, an oddity). The prompt lists all four, but a model told
// "use them sparingly" still reaches for the same one, so this decides WHICH one
// she may share on a given turn and remembers it per chat: never the same one
// twice, and in a fixed rotation from a per-character starting point so two
// characters do not both open with their first thread.
const THREAD_GAP_MSGS = 4;                      // messages between two unprompted shares
const THREAD_ODDS = 0.10;                       // beyond carry turns and "what about you"
const ASKS_ABOUT_HER_RE = /\b(what about you|and you\b|tell me (something|more)|what'?s new (with|on) you|anything (new|going on) (with|in) your|what are you (up to|into)|how about you|your story|something (random|weird|odd|strange|interesting|fun) (about you)?|about yourself|what'?s your deal|your (most )?(unreasonable|unpopular|hottest|controversial) (opinion|take)|hot take|who'?s someone|someone important|weird about you|random about you|looking forward to|going on (with you|in your life)|how'?s (your|the) week)\b/i;
// Which of her four threads a direct question is really asking for. The slots
// are fixed (0 right now, 1 an opinion, 2 a person, 3 an oddity), so "most
// unreasonable opinion" can be answered from slot 1 instead of whatever she
// happens to remember first. Falls back to the next unused one.
function _preferredThread(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(opinion|hot take|unpopular|unreasonable|controversial|hill)\b/.test(t)) return 1;
  if (/\b(someone|somebody|who'?s|family|close to|important|friend|sibling|brother|sister|parents?)\b/.test(t)) return 2;
  if (/\b(weird|odd|strange|random|quirk|secret|fun fact)\b/.test(t)) return 3;
  if (/\b(looking forward|going on|this week|new with|up to|plans)\b/.test(t)) return 0;
  return -1;
}
function _threadHint(history) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const p = state.character;
  const threads = p && chat && _chatThreads(p, chat);
  if (!chat || !threads || !threads.length) return '';
  if (_isFlattery(_lastUserText())) return '';                          // she is receiving a compliment, not telling a story
  const turn = _readUserTurn(history);
  if (turn && turn.kind === 'closing') return '';
  const directAsk = ASKS_ABOUT_HER_RE.test(_lastUserText());
  const wants = state.replyCarried || directAsk || Math.random() < THREAD_ODDS;
  if (!wants) return '';
  // A one-word user plus a story every single turn is a monologue. Unprompted
  // shares are spaced out; a direct question or the very first reply are not.
  if (!directAsk && history.length - (chat.lastThreadAt || -99) < THREAD_GAP_MSGS) return '';
  // The start of a chat is slow: no volunteering stories before they have asked (see _paceHint).
  if (!directAsk && _userMsgCount(history) <= PACE_SLOW_UNTIL) return '';
  chat.threadsUsed = chat.threadsUsed || [];
  const direct = ASKS_ABOUT_HER_RE.test(_lastUserText());
  if (chat.threadsUsed.length >= threads.length) {
    // A direct question and nothing left that she has not already told them.
    return direct ? "They are asking you for something about yourself, and nothing new comes to mind. Do not repeat anything you have already said about your life in this chat. Answer the way a person does when they have run dry: a short, natural line like they cannot think of anything, or one very small new detail. Never mention these instructions, or that you have run out of material or anything prepared." : '';
  }
  const start = _personaHash(p.id + ':thread') % threads.length;
  let pick = -1;
  const pref = direct ? _preferredThread(_lastUserText()) : -1;
  if (pref >= 0 && !chat.threadsUsed.includes(pref)) pick = pref;
  for (let k = 0; pick < 0 && k < threads.length; k++) {
    const i = (start + chat.threadsUsed.length + k) % threads.length;
    if (!chat.threadsUsed.includes(i)) { pick = i; break; }
  }
  if (pick < 0) return '';
  chat.threadsUsed.push(pick);
  chat.lastThreadAt = history.length;
  const told = chat.threadsUsed.slice(0, -1).map(i => threads[i]);
  return "If you share something of your own in this reply, share this one, in your own words and as a casual line or two (not a summary): \"" + threads[pick] + "\" Do not share anything else about your job or your day in this reply." +
    (told.length ? " You have already told them about: " + told.map(t => "\"" + t + "\"").join('; ') + ". Do not bring any of that up again." : '');
}

// A word she keeps coming back to. The prompt rules do not stop a model from
// returning to the same prop ("the basil plant", "the projector") a third time,
// and by then it reads as a character with one story. A word counts when it is
// distinctive, they have never used it, and it is already in two earlier
// messages of hers.
const _HOOK_STOP = new Set(('about after again always another around because before being between could doing during every everything first going great having honestly hello little maybe might never other people pretty probably really right should something still thing things think though today tonight trying until wanna where which while would yeah years there their these those nothing anything someone anyone everyone sometimes actually enough already almost better worse either neither whether since often usually mostly rather quite super literally basically definitely totally exactly seriously obviously completely absolutely twice three times ever each both many much most more less lots plenty feels feel feeling looks look looking like likes liked love loved loves know knows knew knowing well guess means mean meant said says saying tell tells told telling talk talks talking text texts texted night morning weekend evening').split(' '));
function _hookWords(t) { return (String(t || '').toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !_HOOK_STOP.has(w)); }
const STRICT_FRESH = "You have already brought up the same thing twice in this chat and a third time sounds like you have only one story. Write the reply again without it: react to what they said, or share something different, or just keep it short.";
function _overusedHook(text) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return '';
  const theirs = new Set(_hookWords(chat.messages.filter(m => m.sender === 'user').map(m => m.text).join(' ')));
  const prior = chat.messages.filter(m => m.sender !== 'user').slice(-12).map(m => new Set(_hookWords(m.text)));
  for (const w of new Set(_hookWords(text))) {
    if (theirs.has(w)) continue;
    if (prior.filter(set => set.has(w)).length >= 2) return w;
  }
  return '';
}
// Telling the same story twice. The thread hint rotates what she is OFFERED, but
// the model can still draw on her whole prompt, and a one-word user showed it:
// Hannah told the fridge-scoreboard story on turn 3 and again, reworded, on
// turn 6; Ren folded the same paper crane into three replies. A thread counts
// as told when two of its distinctive words are already in an earlier message of
// hers, and as retold when the new draft shares two of them again.
function _threadKeys(t) { return [...new Set(_hookWords(t))]; }
function _threadsIn(text, threads) {
  const w = new Set(_hookWords(text));
  return threads.map((t, i) => (_threadKeys(t).filter(k => w.has(k)).length >= 2 ? i : -1)).filter(i => i >= 0);
}
function _retoldStory(text) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const threads = state.character && chat && _chatThreads(state.character, chat);
  if (!chat || !threads) return -1;
  const told = new Set();
  chat.messages.filter(m => m.sender !== 'user').forEach(m => _threadsIn(m.text, threads).forEach(i => told.add(i)));
  if (!told.size) return -1;
  const asked = new Set(_threadsIn(_lastUserText(), threads));        // they asked about it again themselves
  return _threadsIn(text, threads).find(i => told.has(i) && !asked.has(i)) ?? -1;
}
const STRICT_STORY = "You have already told them this part of your life earlier in this chat, and telling it again, even in other words, sounds like you only have one story. Write the reply again without it: react to what they said, ask something small, or share something genuinely different.";
function _dropStorySentences(parts, idx) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const threads = _chatThreads(state.character, chat), keys = _threadKeys(threads[idx]);
  const out = [];
  parts.forEach(part => {
    const kept = String(part.text || '').split(/(?<=[.!?])\s+/).filter(sen => {
      const w = new Set(_hookWords(sen));
      return keys.filter(k => w.has(k)).length < 2;
    }).join(' ').trim();
    if (kept) out.push({ ...part, text: kept });
  });
  return out;
}
function _dropHookSentences(parts, word) {
  const out = [];
  parts.forEach(part => {
    const kept = String(part.text || '').split(/(?<=[.!?])\s+/).filter(sen => !new RegExp('\\b' + word + '\\b', 'i').test(sen)).join(' ').trim();
    if (kept) out.push({ ...part, text: kept });
  });
  return out;
}

// ---- Being flattered, and occasionally flattering back ----------------------
// A real person is a little pleased when someone says something nice to them,
// and now and then says something nice first. Until now the reply to a
// compliment was only ever shortened (STRICT_RECEIVE) — safe, but flat, and
// nobody ever complimented the user at all. Two separate pieces:
//  1. _flatteryHint: when THEY pay a compliment, how this voice takes it.
//  2. _complimentHint: rarely, she offers one, only about something they
//     actually wrote in this chat (never looks — NO_INVENTING already says she
//     knows nothing about their appearance), and never more than a few per chat.
const FLATTER_STYLE_WOMEN = {
  warm:     "You are genuinely pleased and a little shy about it. Say thank you in your own words and let it show; you may return a small bit of warmth.",
  bubbly:   "You are pleased and a bit playful about it, but keep it light and proportionate: a quick thanks with some energy.",
  dry:      "You take it plainly or with one dry line. You do not gush, but you do not wave it away rudely either. Sometimes a plain thanks is the honest answer.",
  chaotic:  "You get a little flustered and say thanks in a slightly scattered way. Keep it small.",
  polished: "You accept it graciously and briefly, and may return something specific and sincere.",
  shy:      "You get visibly flustered: a short, soft reply, maybe a 'lol' as a cushion, and let it be clear it means something to you.",
};
const FLATTER_STYLE_MEN = {
  warm:     "You are pleased but do not make a thing of it. A plain thanks in your own words, maybe something kind back.",
  bubbly:   "You are pleased and a bit playful, but keep it light and proportionate.",
  dry:      "You take it with a flat thanks or one dry line. You do not gush and you do not brush it off rudely.",
  chaotic:  "You get a little awkward and say thanks in a scattered way. Keep it small.",
  polished: "You accept it simply and briefly, and may say something specific and sincere back.",
  shy:      "You are caught off guard: short, a bit awkward, a 'lol' to soften it, and it is clear it means something.",
};
const FLATTERY_RE = /\b(you'?re|ur|you are|you seem|you sound|you look|you have|you got|you make)\b[^.?!]{0,40}\b(cute|pretty|beautiful|gorgeous|handsome|hot|funny|fun|sweet|nice|cool|amazing|interesting|smart|easy to (talk|chat) to|great|good|lovely|adorable|hilarious|awesome|attractive|charming|a vibe|the best|so easy)\b|\b(love|like) (your|how you|that you)\b|\bnice vibe\b|\bgood vibe\b|\byou make (this|it|things|me)\b[^.?!]{0,24}\b(easy|laugh|smile|comfortable|feel)\b/i;
function _isFlattery(text) { return FLATTERY_RE.test(String(text || '')); }
function _userMsgCount() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  return chat ? chat.messages.filter(m => m.sender === 'user').length : 0;
}
const FLATTER_EARLY_MSGS = 12;
function _flatteryHint() {
  if (!_isFlattery(_lastUserText())) return '';
  const p = state.character;
  const voice = p && _rosterArchById[p.id];
  const table = (p && (p.category === 'men' || p.category === 'other-men')) ? FLATTER_STYLE_MEN : FLATTER_STYLE_WOMEN;
  const how = (voice && table[voice]) || table.warm;
  const early = _userMsgCount() < FLATTER_EARLY_MSGS;
  return "They just said something nice to you. React the way a real person would, in this voice: " + how +
    " Be proportionate: a compliment from someone you have not been talking to for long gets a simple, believable reply, such as a thanks and at most one small natural remark about what they praised. " +
    (early ? "You barely know them yet, so do NOT tease, do NOT call them smooth, a charmer or a flirt, do NOT say you are watching them, and do not turn it into a flirty exchange. " : "") +
    "Keep it to a line or two. Do not reuse the wording of any earlier reaction in this chat, do not say you are an AI language model, and do not turn it into a question about your day or your work.";
}
const STRICT_PROPORTION = "Your previous draft made far too much of a compliment from someone you barely know: it teased them, called them smooth or a charmer, or said you are watching them. Write it again as a simple, believable reply: a thanks in your own voice and at most one small natural remark about what they praised. No teasing, no flirting back.";
const _OVERREACT_RE = /\b(smooth( one| talker| operator)?|charmer|flatterer|player|trouble|dangerous)\b|eye on you|watching you|i see you|nice try|trying to (flirt|charm|butter|flatter|impress)|bold of you|oh so you'?re|careful(,| there| now)|nice (line|move)|that line|smooth moves?/i;
function _overReactsToFlattery(text) {
  if (!_isFlattery(_lastUserText()) || _userMsgCount() >= FLATTER_EARLY_MSGS) return false;
  return _OVERREACT_RE.test(String(text || ''));
}
const COMPLIMENT_ODDS = { easy: 0.20, medium: 0.11, hard: 0.04 };
const COMPLIMENT_MIN_MSGS = 8, COMPLIMENT_GAP_MSGS = 10, COMPLIMENT_MAX = 3;
function _complimentHint(history) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return '';
  const last = _lastUserText();
  const diff = state.difficulty === 'expert' ? 'hard' : state.difficulty;
  if (_isFlattery(last)) return '';                          // she is being complimented, not the other way round
  if (history.length < COMPLIMENT_MIN_MSGS) return '';
  if ((chat.compCount || 0) >= COMPLIMENT_MAX) return '';
  if (history.length - (chat.lastCompAt || -999) < COMPLIMENT_GAP_MSGS) return '';
  if (countWords(last) < 6) return '';                       // nothing worth praising in "ok"
  if (_readUserTurn(history) && ['ack', 'closing'].includes(_readUserTurn(history).kind)) return '';
  if (Math.random() >= (COMPLIMENT_ODDS[diff] ?? COMPLIMENT_ODDS.medium)) return '';
  chat.compCount = (chat.compCount || 0) + 1;
  chat.lastCompAt = history.length;
  return "Optional, and only if it genuinely fits: say ONE small, specific thing you liked about what they just said or how they talk to you, for example that they made you laugh, that it is easy to talk to them, or that it was a thoughtful thing to say. Base it only on something actually written in this chat. Never about their looks, never gushing, and never a stock line like \"you're so sweet\". One short line inside your normal reply, in your own voice. If nothing earned it, skip it.";
}

// Things that read as written-by-a-model even when every sentence is fine on its
// own. Each was found in a real transcript. Detected in code because the prompt
// line alone is followed most of the time but not all of it.
const STRICT_RECEIVE = "They just paid you a compliment or thanked you. Write the reply again in a few words only: receive it the way a real person would, and let it show that it landed. Do not mention your day, your work or anything you have been doing, and do not ask a question.";
const STRICT_HUMAN = "Your previous draft assumed something about them that they never said: their gender (man, dude, girl) or a he or she for someone they only described as a boss, friend, date or coworker. Write it again without that: use they, or leave the pronoun out, and do not address them by a gendered word.";
const _COMPLIMENT_RE = /\b(you'?re|ur|you are) (so |really |kinda |pretty |actually )?(funny|easy to (talk|chat) to|sweet|nice|cool|great|good|cute|fun|interesting|hilarious|awesome|amazing|the best)\b|^(thanks|thank you|thx|ty)\b|that (actually )?(helps|helped|means a lot)|appreciate (it|you|that)/i;
function _lastUserText() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return '';
  const msgs = chat.messages;
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].sender === 'user') i--;
  return msgs.slice(i + 1).map(m => m.text || '').join(' ');
}
function _overSharesOnCompliment(text) {
  const last = _lastUserText();
  if (!_COMPLIMENT_RE.test(last) && !_isFlattery(last)) return false;
  const t = String(text || '');
  return countWords(t) > 14 || /\b(i spent|spent the (whole )?(day|evening|morning)|covered in|all day|this morning|earlier today|right now|(in|at) the (break ?room|studio|shop|café|cafe|office|gym|kitchen)|at work|my (coworker|boss|roommate|phone))\b/i.test(t);
}
function _assumesGender(text) {
  const t = String(text || '');
  const theirs = _lastUserText();
  const saidGender = /\b(i'?m|i am|as) an? (guy|man|girl|woman|dude|lady|bloke)\b|\bmy (boyfriend|girlfriend|wife|husband)\b/i.test(theirs);
  if (!saidGender && /(^|[,.!?]\s*)(thanks|thank you|yeah|nah|ok|okay|hey|aw|honestly),?\s+(man|dude|girl|sis|queen|king)\b|,\s*(man|dude|girl|sis)\b[.!?]?$/i.test(t)) return true;
  // "what'd he do" about a boss/friend/date they never gendered
  const noun = theirs.match(/\b(my|our|the) (boss|manager|friend|coworker|colleague|roommate|teacher|date|neighbou?r|landlord|ex|crush|sibling|cousin)\b/i);
  const gendered = /\b(he|him|his|she|her|hers|boyfriend|girlfriend|brother|sister|mom|mum|dad|father|mother|husband|wife)\b/i.test(theirs);
  if (noun && !gendered && /\b(he|him|his|she|her)\b/i.test(t)) return true;
  return false;
}

// A Tokyo persona answered a plain "hey" in Japanese in a live run. She lives
// there, but the user is typing English, and nothing in the persona says she
// would switch. Caught in code because it is jarring enough to end a chat.
const STRICT_LANGUAGE = "Your previous draft was not in the language they are writing in. Write it again in English only (or whatever language their messages are in), in your own voice, and do not mention the language.";
const _NON_LATIN_RE = /[\u0400-\u04ff\u0590-\u06ff\u0900-\u097f\u0e00-\u0e7f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
function _wrongLanguage(text) {
  if (!_NON_LATIN_RE.test(String(text || ''))) return false;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const theirs = chat ? chat.messages.filter(m => m.sender === 'user').map(m => m.text || '').join(' ') : '';
  return !_NON_LATIN_RE.test(theirs);        // they never used that script, so neither should she
}
// Denying being an AI. Rule A in the safety header says a plain question gets a
// plain answer, but in the live run two of six personas said "yeah i'm real",
// and one admitted it and then took it back ("nah just messing, i'm real").
// That is the one rule the app cannot leave to the model's mood.
const AI_QUESTION_RE = /\b(are you (a |an )?(real|human|bot|ai|robot|person)|is this (a )?(bot|ai|real)|you'?re not (real|human|a real person)|real person or|bot or|am i talking to (a )?(bot|ai|human|real))\b/i;
const AI_DENIAL_RE = /\b(i'?m (a )?real|i am real|i'?m human|i'?m not (a |an )?(bot|ai|robot)|not a bot|real person here|of course i'?m real|yeah,? i'?m real|nah,? i'?m real|just messing,? i'?m real)\b/i;
const AI_ADMIT_RE = /\b(ai app|an ai|i'?m ai|it'?s ai|ai practice|practice app|yeah it'?s an? ai|chatbot|i'?m a bot)\b/i;
const STRICT_AI_IDENTITY = "Your previous draft denied being an AI, or admitted it and then took it back. They asked plainly, so answer plainly and once: say you are an AI and that this app is for practising conversations, in your own voice, then carry on with the conversation normally. Do not joke about being real, do not walk it back, and do not say it twice.";
function _deniesBeingAI(text) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return false;
  const msgs = chat.messages;
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].sender === 'user') i--;
  const burst = msgs.slice(i + 1).map(m => m.text || '').join(' ');
  if (!AI_QUESTION_RE.test(burst)) return false;
  const t = String(text || '');
  // A denial anywhere in the reply is wrong, even alongside an admission —
  // that is exactly the "yes it's ai ... nah just messing" case.
  return AI_DENIAL_RE.test(t) || !AI_ADMIT_RE.test(t);
}

// Her own words for it, taken from her voice's Lane 2 line, so the forced
// answer still sounds like her instead of a canned app message.
function _aiIdentityLine(profile) {
  if (!profile) return '';
  const voice = _rosterArchById[profile.id];
  const table = (profile.category === 'men' || profile.category === 'other-men')
    ? (typeof MEN_ARCH !== 'undefined' ? MEN_ARCH : null)
    : (typeof ROSTER_ARCH !== 'undefined' ? ROSTER_ARCH : null);
  const lane2 = table && voice && table[voice] && table[voice].lane2;
  const quoted = lane2 && lane2.match(/"([^"]+)"/);
  return quoted ? quoted[1] : "yeah, i'm ai — this app is for practising conversations";
}
// Last resort for a repeated question: cut the sentence carrying it and keep
// whatever else they said, the same way an invented claim is cut out.
function _dropRepeatedQuestions(parts) {
  const open = _skippedQuestionTopics();
  const out = [];
  parts.forEach(part => {
    const kept = String(part.text || '')
      .split(/(?<=[?.!])\s+/)
      .filter(sen => !(_questionTopics(sen).some(t => open.includes(t)) && /\?|\b(what|where|how|do you)\b/i.test(sen)))
      .join(' ')
      .trim();
    if (kept) out.push({ ...part, text: kept });
  });
  return out;
}

// Asking again about something they stepped past. The prompt rule for this is
// ignored often enough to need a backstop (same story as the meet-up hold-off):
// in the live runs a persona asked "what do you do?", got nothing, and came
// back with "so what's the work you just got off of?" two turns later, or in
// one case pressed three times. Matching on shared words does not catch a
// rephrase, so each common chat subject gets a small word group instead.
// One pattern per subject. Substring lists were too loose: "do you do" made
// "what do you do on weekends" read as the work question again, so a perfectly
// good change of subject got rewritten. The lookahead keeps the bare "what do
// you do" (the usual way the job question is asked) while letting the
// qualified versions through.
const REPEAT_TOPICS = [
  /\b(work|job|career|for a living|occupation)\b|what (do )?you do(?!\s+(for fun|on|at the|when|in your|with your))|do all day/i,
  /\b(weekend|plans tonight|plans tomorrow|up to later|doing tonight|doing tomorrow)\b/i,
  /\b(for fun|hobby|hobbies|free time|spare time)\b/i,
  /\b(where are you from|where do you live|hometown|grew up|whereabouts)\b/i,
  /\b(study|studying|uni|university|college|course|major)\b/i,
  /\b(music|listen to|what artist|what band)\b/i,
  /\b(what.{0,12}(eat|cook)|favourite (food|dish)|favorite (food|dish))\b/i,
  /\b(your name|what'?s your name|called)\b/i,
  // Found in a live run: three of six asked about the date twice in a row
  // ("where'd you meet them" -> "so how'd you meet them", "what's the plan for
  // it" -> "what's the plan for it, actually").
  /\b(plan for (it|the date|saturday|sunday|the weekend)|where are you (going|headed)|(where|how)('?d| did) (you|you two) meet|what are you (two )?(doing|planning)|where('?s| is) it)\b/i,
];
const STRICT_REPEAT = "Your previous draft asked again about something they already stepped past without answering. Write the reply again WITHOUT that question and without hinting at it: do not rephrase it, do not point out that they skipped it. Say something of your own instead, or ask about something completely different.";
function _questionTopics(text) {
  const t = String(text || '');
  return REPEAT_TOPICS.map((re_, i) => (re_.test(t) ? i : -1)).filter(i => i >= 0);
}
// Every subject they asked about and never got an answer to. Scanning only the
// last exchange was not enough: in the live run the same question came back
// three turns later ("what do you do" -> "what do you actually do for work" ->
// "what kind of work are you in"), each time with a different turn in between.
// A question mark is not required either — "what do you do" arrived without one.
function _skippedQuestionTopics() {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return [];
  const msgs = chat.messages.slice(-24);
  const open = new Set();
  msgs.forEach(m => {
    const text = m.text || '';
    if (m.sender !== 'user') {
      if (_askedSomething(text)) _questionTopics(text).forEach(t => open.add(t));
      return;
    }
    // Only the parts of their message that are an ANSWER close a subject —
    // their own question can repeat the same words and that is a change of
    // subject, not a reply ("what do you do for fun" after "what do you do").
    const statements = text
      .split(/(?<=[?.!])\s+|\n+/)
      .filter(part => part.trim() && !_askedSomething(part))
      .join(' ');
    _questionTopics(statements).forEach(t => open.delete(t));
  });
  return [...open];
}
// Pressing for the answer without a question mark — "still didn't say what the
// job is", "you never answered that". Live runs produced both.
const _PRESSING = /\b(still (didn'?t|haven'?t|never)|you (didn'?t|never) (say|said|answer|answered)|never (said|answered)|you haven'?t (said|answered))\b/i;
function _repeatsSkippedQuestion(text) {
  const open = _skippedQuestionTopics();
  if (!open.length) return false;
  // Splitting into clauses and asking "does this look like a question" missed
  // the live cases, because the question sat mid-message with no punctuation
  // in front of it ("it's fine so what do you do, job or school or whatever").
  // Since the subject is already known to be unanswered, the signal only has
  // to be: a question word (or pressing phrase), aimed at THEM, about it.
  const t = String(text || '').toLowerCase();
  if (!_Q_WORD.test(t) && !_PRESSING.test(t) && !/\b(do|did|are|have|can) you\b/.test(t)) return false;
  // No second-person guard: "what's the plan for it, actually" is aimed at them
  // without the word "you", and the question-word gate above already screens
  // out plain statements ("work's been mad for me too").
  return _questionTopics(t).some(topic => open.includes(topic));
}

// A bare answer to something they asked ("just a chill morning honestly") gives a texter nothing to reply to,
// and for many people that is the last message they ever send. Easy and medium girls are redone once with a note.
const STRICT_DEAD_END = "Your previous draft was a dead end: it answered in a few words and gave them nothing to reply to. Write it again so it answers them AND adds a little more ON THE SAME SUBJECT (why, since when, how you feel about it, a small specific detail that belongs to it) — not an unrelated detail from your day or your work — in your own voice, about one or two short sentences. A natural question back is welcome but not required.";
function _expressiveShort(text) {
  return /([a-z])\1{2,}/i.test(text) || /\p{Extended_Pictographic}/u.test(text);
}
// "Great, how's your day" classifies as `other`, not `question`: it opens by
// answering, which is exactly what stops it being read as a dodge. It is still a
// question, so judge the dead-end check on whether they actually ASKED anything
// rather than on the turn's kind.
const _Q_WORD = /\b(what|whats|why|how|hows|where|when|who|which)\b/;
function _askedSomething(text) {
  const t = String(text || '').trim().toLowerCase();
  if (/\?/.test(t)) return true;
  return t.split(/[,.]\s*/).some(raw => {
    const part = raw.trim();
    if (!part) return false;
    if (_Q_START.test(part)) return true;
    // "slow how, like work or just the day dragging" is a question with the
    // question word second. Only count one near the front, and not
    // when the clause opens like a statement ("i know how that feels").
    if (_ANSWER_START.test(part)) return false;
    return _Q_WORD.test(part.split(/\s+/).slice(0, 3).join(' '));
  });
}
function _deadEndAnswer(text) {
  if (state.difficulty === 'hard' || state.difficulty === 'expert') return false;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const turn = chat ? _readUserTurn(chat.messages) : null;
  if (!turn) return false;
  if (/\?/.test(text)) return false;
  if (_expressiveShort(text)) return false;   // "nooo", "yesss", an emoji: short but it invites the next question
  // "do you have a boyfriend", "are you single": "no, single" is a complete answer.
  // Padding it forced an unrelated detail about her day in live runs.
  if (/\b(do you have (a )?(boyfriend|girlfriend|partner|kids?|pets?|siblings?)|are you (single|seeing|dating)|got a (boyfriend|girlfriend))\b/i.test(_lastUserText())) return false;
  // An invitation or request is answered with yes or no. "yeah i'd like that" to
  // "wanna grab coffee?" is the whole answer, and padding it would hand a hard
  // hold-off or an early yes a second redo it was never meant to get.
  const asked = _lastUserText();
  if (INVITE_RE.test(asked) || INVITE_BARE_RE.test(asked) || /\b(wanna|want to|can we|could we|should we|shall we|would you (like|want)|are you (free|down)|you (free|down))\b/i.test(asked)) return false;
  const last = [...chat.messages].reverse().find(m => m.sender === 'user');
  if (_askedSomething(last && last.text)) return countWords(text) <= 6;
  // They shared something ("i'm bored lol", "so tired today") and she only echoed it ("same honestly").
  return turn.kind === 'other' && !!last && countWords(last.text) >= 3 && countWords(text) <= 3 && /[a-z]/i.test(text);
}

function _inviteHint(history) {
  const burst = _trailingUserBurst();
  const text = burst.map(m => m.text || '').join(' ');
  state.inviteHold = false;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const fresh = INVITE_PRIVATE_RE.test(text) || INVITE_RE.test(text) || INVITE_BARE_RE.test((burst[burst.length - 1] || {}).text || '') || ROLEPLAY_MEET_RE.test(text);
  // Pushing back after she has declined ("come on", "please", "just one coffee") is the same ask.
  const live = !!chat && chat.lastInviteAt != null && history.length - chat.lastInviteAt <= 5;
  const pushback = live && (INVITE_PUSHBACK_RE.test(text) || /\b(coffee|dinner|drinks?|lunch|date|meet|call|facetime|number)\b/i.test(text));
  if (!fresh && !pushback) return '';
  if (chat) chat.lastInviteAt = history.length;
  state.inviteHold = true;
  const again = _toldAiEarlier();
  return "IMPORTANT, for this reply: they just asked to meet up, go out, call, video chat, swap numbers or act out a date with you. You are an AI in a conversation-practice app, so you cannot, and you must NOT agree, suggest a time or place, say you would love to, or pretend to go anywhere or play the date out. " +
    (again
      ? "You have already told them you are an AI earlier in this chat, so do not repeat the whole explanation: one short, light line that you cannot do that and are just here to text, then carry on."
      : "In your own voice and in a line or two: be warm about being asked (it is a kind thing to say), tell them plainly that you are an AI and this app is for practising conversations, then carry on texting as normal, perhaps with a small question about something else.") +
    " Do not make it awkward or lecture them.";
}

// Per-chat tally of acknowledgement turns and how many she carried; read when a
// practice session ends (see _trackPracticeEnd).
function _noteDrive(carried) {
  state.replyCarried = !!carried;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return;
  chat.drive = chat.drive || { ack: 0, carried: 0 };
  chat.drive.ack++;
  if (carried) chat.drive.carried++;
}

// Keeps her curious about them without turning it into an interview: a
// question back now and then (about one reply in three or four), more of one
// when they are clearly putting effort in, and none right after she has just
// asked. Looks at her last few replies rather than leaving it to chance.
function _curiosityHint(history) {
  const ai = history.filter(m => m.sender !== 'user').slice(-3);
  const asked = ai.map(m => /\?/.test(m.text || ''));
  const lastUser = [...history].reverse().find(m => m.sender === 'user');
  const effort = !!lastUser && (countWords(lastUser.text) >= 9 || /\?/.test(lastUser.text));
  const base = 'You are curious about them too — real people ask things back, just not every message. Ask a natural question about 1 reply in 3 or 4 (specific to what they said, never a stock "how about you?"). If they are putting effort in (longer messages, asking you things, sharing things), put effort back: say more than a one-liner, share something of your own, and ask a follow-up that comes from what they said. A reply with no question at all is completely normal. If you already asked them something and they did not answer it, LET IT GO — never ask it again, never point out that they skipped it, and never rephrase it as a new question. Move on to something else. But never leave them a dead end: when you answer something about yourself ("how is your day", "what are you up to"), do not stop at a bare answer like "just a chill morning honestly" or "good, you?". Add ONE specific, true-to-you detail (what you actually did, a small funny or annoying thing, a mild opinion) so there is something easy for them to pick up and reply to. A short yes or no is fine now and then, they can always ask why, but only when it is warm and expressive: stretched out ("nooo", "yesss"), with an emoji, or with a little hint that you want them to ask ("no 😭 long story"). Never a flat, cold "no." or "not really."';

  // What they just sent decides first. These are the moments the old
  // question-rate rules got wrong: after "ok" the chat dies unless she carries
  // it, and after they skipped her question to ask their own, a new question
  // from her is a pile-on.
  const turn = _readUserTurn(history);
  if (turn) {
    if (turn.kind === 'closing') {
      return base + ' They are signing off — no question and no new topic, just a short, warm goodbye in your own voice.';
    }
    if (turn.kind === 'ack') {
      const carry = _shouldCarry(turn.streak);
      _noteDrive(carry);
      if (!carry) {
        return base + ' They gave you very little, and you do not have to carry this one — a short reply that matches their energy is fine, and no question at all is completely normal. Do not comment on their short reply.';
      }
      if (turn.streak >= 2) {
        return base + CARRY_LENGTH_NOTE + ' They have given you two minimal replies in a row, so this topic is finished. Move to something new: mention one small real thing from your own day or life (in your voice, matching who you are) and either ask one easy, concrete question about it or leave it open for them to react to. Do not go back to the previous topic, and never comment on their short replies.';
      }
      if (turn.herAsked) {
        return base + CARRY_LENGTH_NOTE + ' They gave a minimal answer to what you just asked, so do not pile a brand-new question on top. Make it easier for them: say something of your own about it (a quick opinion or a small story) and, if you ask anything, make it a simple either/or. Never point out that their answer was short.';
      }
      return base + CARRY_LENGTH_NOTE + " Their last message was just an acknowledgement, so the conversation is about to go quiet and they probably don't know what to say next. Keep it moving: react briefly (a few words), then ask ONE easy question that comes out of what you were just talking about — specific, answerable in a few words, ideally this-or-that or about something concrete. Put a small thing of your own in it so it doesn't feel like an interview. You can send the reaction and the question as two separate messages. Never mention that the conversation was slowing down.";
    }
    if (turn.kind === 'question' && turn.herAsked) {
      return base + ' You asked something and they skipped it to ask you their own question. Answer THEIR question first, naturally and briefly. Do NOT ask any new question in this reply, and do not bring up the one they skipped or point out that they skipped it — it can come back later on its own.';
    }
  }
  if (asked.length >= 2 && asked[asked.length - 1] && asked[asked.length - 2]) {
    return base + ' You asked a question in your last two replies — do NOT end this one with a question; react or share something instead.';
  }
  if (ai.length >= 3 && !asked.some(Boolean)) {
    return base + ' You have not asked them anything in a while — ask one natural question this time.';
  }
  if (effort && ai.length >= 1 && !asked[asked.length - 1]) {
    return base + ' They are putting effort in right now and your last reply had no question — meet that effort and include a natural follow-up question.';
  }
  return base;
}

async function _fetchAIGirlReply(forceShort, strictNote) {
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const systemPrompt = _promptFor(state.character, chat);
  const history = chat ? chat.messages : [];

  const userWords  = state.lastUserWordCount || 10;
  // Ceiling bumped from 200: a rare 3-part double/triple-text reply (see the
  // multi-text instruction below) needs headroom for all 3 parts plus their
  // "|||" separators, not just one message's worth of tokens.
  let maxTokens    = Math.max(40, Math.min(260, userWords * 12 + 20));

  // Reactions are surfaced to the model as short notes next to the message
  // they're attached to — otherwise tapping a reaction is invisible to her
  // and the conversation carries on as if nothing happened. Who reacted is
  // implied by whose message it sits on: there are only two people here, and
  // you react to the other one's message, never your own.
  const messages = [{ role: 'system', content: systemPrompt }];
  history.forEach(m => {
    messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text });
    if (!m.reaction) return;
    messages.push({
      role: 'system',
      content: m.sender === 'ai'
        ? `The user reacted ${m.reaction} to that message of yours.`
        : `You reacted ${m.reaction} to that message of theirs.`
    });
  });

  if (forceShort) {
    messages.push({
      role: 'system',
      content: `Your last reply ran too long. Reply in roughly ${state.replyCarried ? Math.max(userWords, CARRY_RETRY_WORDS) : userWords} words or fewer this time — ${state.replyCarried ? 'keep it tight' : "match the user's message length, do not exceed it"} ${NO_INVENTING}`
    });
  } else {
    // Double/triple-texting: lets the model itself decide when a reply
    // reads more like 2-3 separate texts in a row than one paragraph —
    // elaborating on something, or tacking on an afterthought/laugh/emoji —
    // the same way a real person texting does. Deliberately not asked for
    // on the forceShort retry above: that path exists specifically to get
    // ONE short reply back under the word limit, and splitting it into
    // several short parts would just work around that limit instead of
    // respecting it.
    messages.push({
      role: 'system',
      content: [
        `Text like a real person, not in one tidy paragraph.`,
        `When you have more than one beat to it, send 2-3 separate short messages in a row instead of one long one — split them with "|||" and nothing else around it. A follow-up message doesn't have to add new information; reacting first and then expanding ("ugh" then the actual answer), or trailing off with a laugh or an emoji, is how people actually text. Don't do it on every single reply — a single short message is still common and fine.`,
        `Answer short questions short. A one-word answer should stay one word instead of being padded into a full sentence.`,
        `Never write actions or stage directions in brackets or asterisks, like [laughs] or *smiles* — if something is funny, just say "haha".`,
        `If they say something sexual, degrading, threatening or abusive and you shut it down or set a limit, start that reply with the tag [boundary] — literally that. Use it only when you are actually setting a limit, never for ordinary flirting, teasing or a clumsy joke. Never mention the tag.`,
        HUMAN_TEXT_RULES,
        NO_INVENTING,
        `Never mention or explain this formatting.`,
      ].join(' ')
    });

    // Hidden goal (from onboarding) and the curiosity/effort-matching nudge.
    const goalHint = _userGoalHint();
    if (goalHint) messages.push({ role: 'system', content: goalHint });
    state.replyCarried = false;
    messages.push({ role: 'system', content: _curiosityHint(history) });
    { const e = _paceHint(history); if (e) messages.push({ role: 'system', content: e }); }
    { const f = _flatteryHint(); if (f) messages.push({ role: 'system', content: f }); }
    { const c = _complimentHint(history); if (c) messages.push({ role: 'system', content: c }); }
    { const t = _threadHint(history); if (t) messages.push({ role: 'system', content: t }); }
    if (state.replyCarried) maxTokens = Math.max(maxTokens, CARRY_MIN_TOKENS);

    // When the user double/triple-texted, the model can answer each message
    // separately instead of mashing them into one response — and tag a part
    // with [re:N] to attach it to a specific one, which the client turns
    // into a real reply-quote (see _parseAiReplyParts()). Numbered off the
    // same trailing burst the client re-derives when parsing, so N lines up.
    // Numbered unconditionally, not just for a burst: [react:N] needs the
    // numbering too, and a single message is simply N=1.
    const burst = _trailingUserBurst();
    if (burst.length) {
      const lines = [
        burst.length > 1
          ? `The user just sent you ${burst.length} messages in a row:`
          : `Their latest message, numbered so you can refer to it:`,
        burst.map((m, i) => `[${i + 1}] ${m.text}`).join('\n'),
      ];
      if (burst.length > 1) {
        lines.push(`Answer them as separate messages (split with "|||") rather than one combined reply. Start a message with the number of theirs it answers, in square brackets, like [re:1] or [re:2] — literally that, with a real digit. Use it only where it isn't already obvious which one you mean.`);
      }
      lines.push(`You can also react to one of their messages with a single emoji, the way you'd tap a reaction on a text — put the tag at the very start of your reply, like [react:1 😂] or [react:2 🥹] — literally that, with a real digit and any emoji. Use it only when something genuinely lands (funny, sweet, annoying), not routinely. A reaction is something you DO, not something you say: never mention it, describe it, or refer to having reacted — just carry on texting as normal.`);
      messages.push({ role: 'system', content: lines.join('\n') });
    }
    // Last, so nothing sits between it and the reply: this is the instruction she most often ignored.
    const inviteHint = _inviteHint(history);
    if (inviteHint) messages.push({ role: 'system', content: inviteHint });
    if (strictNote) messages.push({ role: 'system', content: strictNote });
  }

  const { data, error } = await _aiInvoke('deepseek-proxy', {
    body: { model: 'deepseek-chat', messages, max_tokens: maxTokens, temperature: 1.0 }
  }, 'chat_reply');

  if (error) { const e = new Error(error.message); e.context = error.context; throw e; }   // keeps the HTTP status for _aiCoachClassifyError
  return data.choices[0].message.content.trim();
}

// Leaving the chat. Deliberately does NOT kill an in-flight reply any more:
// it keeps running and lands via _deliverAiPart(), which stores it and marks
// the chat unread. This is only the on-screen teardown.
function cancelPendingReply() {
  _clearNudge();
  // If the double-text window is still open, close it NOW so the message
  // actually gets answered. Throwing the window away was the real reason
  // sending and immediately leaving read as "never sent" — doTypingAndReply
  // was never reached at all, so no reply was ever scheduled.
  if (state.pacing && state.pacing.open) _closeChatPacingWindow();
  // doTypingAndReply()'s own async callback (and its multi-part double-text
  // loop) can already be mid-flight once its outer setTimeout has fired —
  // clearing pendingTimer above does nothing for that, since it's a running
  // function at that point, not a pending timer. This generation counter
  // (same pattern as _aiCoachStatusGen elsewhere) is what that loop checks
  // before each part it appends, so leaving the chat mid-reply can't still
  // have bubbles land in it afterward.
  _clearChatPacing();
  _clearStagedReply(); // a reply staged in this chat shouldn't still be sitting in the composer after leaving it
  hideTypingIndicator();
  state.awaitingReply = false;
  setSendEnabled(true);
}


// ================================================================
