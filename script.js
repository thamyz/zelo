// ================================================================
// ChatPractice — script.js
// ================================================================

const DEV_MODE = false; // DEV — set to false before release


// ================================================================
// APP STATE
// ================================================================

const state = {
  // Navigation
  activeTab:    "assistant",  // "assistant" | "practice"
  activeScreen: null,         // "profile" | "chat" | "match" | null
  screenStack:  [],           // screens pushed while another screen (not a tab) was active — popScreen() unwinds this before falling back to the tab

  // Practice session
  difficulty:   null,
  character:    null,
  mode:         "training",
  replyIndex:   0,
  pendingTimer: null,
  awaitingReply: false,

  // Swipe deck
  swipeProfiles: [],  // shuffled copy of PROFILES
  swipeIndex:    0,   // index of the current top card

  // Assistant
  asstStyle:        "smooth",
  asstCurrentSet:   null,  // cache: style → reply text, populated on demand
  asstMessage:      "",    // message text for the current scan
  asstContext:      "",    // scanContextString() snapshot for the current scan
  scanContext:      {},    // ACTIVE who/situation/goal selection used for the pending scan
  tellzeloAnswers:  {},    // the "Other" (Tell Zelo More) wizard's own saved answers — persists
                           // across Dating/Crush taps; copied into scanContext on completion;
                           // only cleared once a scan actually finishes generating (see _onReplyRevealed())
  scanWhoCard:      null,  // which "Who's this about?" card is exclusively selected: 'dating' | 'crush' | 'other' | null
  tzStep:           0,     // current step in the Tell Zelo More flow
  eligibleStyles:   [],    // ordered styles for the current scan's Situation+Goal (see getEligibleStyles())
  currentStyleIndex: 0,    // index into eligibleStyles for the card currently shown

  // mode chosen per swipe-card profile (Open/Neutral/Cold), keyed by name
  cardModes: {},

  // Active chat id (for syncing to chatStore)
  activeChatId: null,

  // Which chat-mode option (if any) is mid-confirmation in the "Set the
  // pace" modal — null when neither card has been tapped yet.
  chatModePending: null,

  // Feature 5+6: active thread detail
  activeThreadId: null,
  threadChat:     [],    // [{role,content}] for Ask Zelo session

  // Feature 8: daytime silent gap (realistic mode, per session)
  silentGapStart: null,
  silentGapEnd:   null,

  // Thread pre-selected on the typing screen before analyzing
  preselectThreadId: null,

  // Result-screen save tracking (for Go Back reminder)
  scanSavedToThread: false,
  scanSkippedSave:   false,
};

window.addEventListener('DOMContentLoaded', () => {
  // DEV — clear first-run keys on every load for testing. Remove before release.
  // NOTE: this wipes zelo_onboarding_done every load, so maybeShowWelcomeBack()
  // below never fires in dev (onboarding always looks "not done" first).
  // Comment this block out temporarily to test the welcome-back typewriter.
  localStorage.removeItem('zelo_onboarding_done');
  localStorage.removeItem('zelo_tour_seen');
  // Onboarding + Home-tab answers start blank each run — nothing pre-chosen.
  localStorage.removeItem('zelo_practice_mode');
  localStorage.removeItem('zelo_mode_selected');
  localStorage.removeItem('zelo_age_range');
  localStorage.removeItem('zelo_display_name');

  AUTH.init(); // session check — must run before any auth triggers fire
  // TODO — merge anonymous scan history on signup

  _loadGibberishDictionary(); // preload word dictionary for fast gibberish detection

  ensureTrialStarted();
  initScanCountForToday();
  initMatchSlots();           // Feature 7: restore expired deletion slots
  maybeShowWelcomeBack();     // returning users only — see NOTE above
  initOnboarding();
  refreshScanLimitBanner();
  // Drop a stale AI Coach link if its thread no longer exists
  if (getLinkedThreadId() && !getLinkedThread()) setLinkedThreadId(null);
  refreshAiCoachCard();       // Fix 5: sync the AI Coach card dropdown label
  attachProfileDetailDragToClose(); // Fix 4: swipe-down to dismiss profile detail
});


// ================================================================
// NAVIGATION — two modes
//   showTab(name)    → switch between Assistant / Practice tabs
//   pushScreen(name) → overlay a full screen (profile, chat)
//   popScreen()      → return to whichever tab was active
// ================================================================

function showTab(name) {
  // Chats stays hard-gated behind sign-up at the tab level. Practice (Home)
  // is intentionally NOT gated here anymore — anonymous users can see the
  // mode-selection popup / locked deck; the auth check happens when they
  // actually try to act (see homeModeSelect()).
  if (name === 'chats' && !AUTH.signedIn() && !tourSwitchingTab) {
    if (!DEV_MODE) AUTH.requireAuth(name, () => showTab(name));
    else showTab(name);
    return;
  }

  // History overlay keeps the tab bar visible — close it on any tab nav
  closeHistory();

  // Cancel any chat timer if leaving
  cancelPendingReply();

  // The tour drives its own tab switches; only end it when the user navigates
  // away on their own (e.g. tapping a tab mid-tour).
  const tour = document.getElementById('tour');
  if (tour && !tour.hidden && !tourSwitchingTab) endTour();

  // Hide all screens and tabs
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the tab
  document.getElementById("tab-" + name).classList.add("active");

  // Update tab bar buttons
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById("tabbtn-" + name).classList.add("active");

  // Show tab bar
  document.getElementById("tab-bar").classList.remove("hidden");

  state.activeTab    = name;
  state.activeScreen = null;
  state.screenStack  = [];

  // Practice (Home) tab: first visit shows the mode popup; after that,
  // signed-in users get the deck and anonymous users see it locked.
  if (name === 'practice') {
    if (!localStorage.getItem('zelo_mode_selected')) {
      showHomeModePopup();
    } else if (AUTH.signedIn()) {
      hideHomeLocked();
      initSwipeDeck();
    } else {
      showHomeLocked();
    }
  }
  if (name === 'chats') renderChatsList();
  if (name === 'assistant') {
    maybeShowScanIntro();
    refreshScanLimitBanner();
    refreshScanWhoCards();
    checkGenerateReady();
  }
}

function pushScreen(name) {
  // Hide all tabs and screens
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the screen (covers everything including tab bar)
  document.getElementById("screen-" + name).classList.add("active");

  // Hide tab bar
  document.getElementById("tab-bar").classList.add("hidden");

  // Remember what screen (if any) was showing before this one, so popScreen()
  // can return to it instead of always falling back to the base tab. Skip
  // the push if we're already on this screen — otherwise re-entering the
  // same screen (e.g. openDashboard() called while Account is already
  // showing) piles up redundant stack entries that corrupt later "back"s.
  if (state.activeScreen && state.activeScreen !== name) {
    state.screenStack.push(state.activeScreen);
  }
  state.activeScreen = name;
}

function popScreen() {
  const prevScreen = state.screenStack.pop();
  if (prevScreen) {
    document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));
    document.getElementById("screen-" + prevScreen).classList.add("active");
    document.getElementById("tab-bar").classList.add("hidden");
    state.activeScreen = prevScreen;
  } else {
    // Nothing to unwind to — return to whichever tab was last active
    state.activeScreen = null;
    showTab(state.activeTab);
  }
}


// ================================================================
// PRACTICE: START / EXIT CHAT
// ================================================================

function startChat() {
  const c = state.character;

  const headerAvatar = document.getElementById("chat-header-avatar");
  headerAvatar.style.background = c.color;
  headerAvatar.textContent      = c.initial;

  document.getElementById("chat-header-name").textContent = c.name;
  setHeaderStatus("online");
  document.getElementById("chat-mode-pill").textContent = "";

  document.getElementById("chat-messages").innerHTML = "";
  setSendEnabled(false);

  pushScreen("chat");
  bindDevPaceToggle();

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

  document.getElementById("chat-mode-pill").textContent = mode === 'realistic' ? 'Realistic' : 'Instant';

  document.getElementById("chat-mode-modal").hidden = true;


  const diff = state.difficulty;
  const openerText = (state.character && state.character.opener) || OPENINGS[diff];
  const openingDelay = mode === "training" ? 700 : 1500;
  setTimeout(() => {
    appendAIBubble(openerText);
    syncChatToStore(openerText, 'ai');
    setSendEnabled(true);
    document.getElementById("message-input").focus();
  }, openingDelay);
}

function closeRealisticIntro() {}

function openChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (!sheet) return;
  const label = document.getElementById('chat-settings-timing-label');
  if (label) {
    label.textContent = state.mode === 'realistic' ? 'Switch to Instant' : 'Switch to Realistic';
  }
  sheet.hidden = false;
}

function closeChatSettings() {
  const sheet = document.getElementById('chat-settings-sheet');
  if (sheet) sheet.hidden = true;
}

function chatSettingsToggleInstant() {
  closeChatSettings();
  const newMode = state.mode === 'realistic' ? 'training' : 'realistic';
  state.mode = newMode;
  const pill = document.getElementById('chat-mode-pill');
  if (pill) pill.textContent = newMode === 'realistic' ? 'Realistic' : 'Instant';
}

function chatSettingsReset() {
  closeChatSettings();
  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';
  const cid = state.character?.id || state.character?.name;
  if (cid) {
    localStorage.removeItem('chat_' + cid);
    delete state.chatHistory;
  }
  const resetChat = chatStore.find(c => c.id === state.activeChatId);
  if (resetChat) resetChat.messages = [];
  setSendEnabled(false);
  const resetOpenerText = (state.character?.opener) || OPENINGS[state.difficulty] || 'hey';
  appendAIBubble(resetOpenerText);
  syncChatToStore(resetOpenerText, 'ai');
  setSendEnabled(true);
}

function chatSettingsDelete() {
  closeChatSettings();
  const cid = state.character?.id || state.character?.name;
  if (cid) localStorage.removeItem('chat_' + cid);
  exitChat();
}

function exitChat() {
  cancelPendingReply();
  if (_restoreHistoryReturn()) return;
  if (state.screenStack.length > 0) { popScreen(); return; }
  // If we came from chats tab, return there; otherwise practice
  const returnTab = state.activeTab === 'chats' ? 'chats' : 'practice';
  showTab(returnTab);
}


// ================================================================
// CHAT: SEND MESSAGE
// ================================================================

function sendMessage() {
  if (state.awaitingReply) return;

  const input = document.getElementById("message-input");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  appendUserBubble(text);
  syncChatToStore(text, 'user');
  state.lastUserWordCount = countWords(text);

  state.awaitingReply = true;
  setSendEnabled(false);
  scheduleReply();
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

// Shared: show typing indicator then deliver the AI reply
function doTypingAndReply(timing) {
  const typingDuration = randBetween(timing.typingMin, timing.typingMax);
  setHeaderStatus("typing");
  showTypingIndicator();

  // Start the DeepSeek fetch concurrently while the typing indicator shows
  const replyPromise = _fetchAIGirlReply();

  state.pendingTimer = setTimeout(async () => {
    let aiReply;
    try {
      aiReply = await replyPromise;
      const userWords = state.lastUserWordCount || 10;
      const wordLimit = Math.max(userWords * 2, 12);
      if (countWords(aiReply) > wordLimit) {
        try {
          const regenerated = await _fetchAIGirlReply(true);
          aiReply = countWords(regenerated) <= wordLimit
            ? regenerated
            : truncateToWordLimit(regenerated, wordLimit);
        } catch (_) {
          aiReply = truncateToWordLimit(aiReply, wordLimit);
        }
      }
    } catch (_) {
      aiReply = "sorry got distracted lol";
    }
    hideTypingIndicator();
    setHeaderStatus("online");
    removeSeenStatus();
    appendAIBubble(aiReply);
    syncChatToStore(aiReply, 'ai');
    state.awaitingReply = false;
    state.pendingTimer  = null;
    setSendEnabled(true);
    document.getElementById("message-input").focus();
  }, typingDuration);
}

async function _fetchAIGirlReply(forceShort) {
  const systemPrompt = state.character?.systemPrompt || '';
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const history = chat ? chat.messages : [];

  const userWords  = state.lastUserWordCount || 10;
  const maxTokens  = Math.max(40, Math.min(200, userWords * 12 + 20));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }))
  ];

  if (forceShort) {
    messages.push({
      role: 'system',
      content: `Your last reply ran too long. Reply in roughly ${userWords} words or fewer this time — match the user's message length, do not exceed it.`
    });
  }

  const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
    body: { model: 'deepseek-chat', messages, max_tokens: maxTokens, temperature: 1.0 }
  });

  if (error) throw new Error(error.message);
  return data.choices[0].message.content.trim();
}

function cancelPendingReply() {
  if (state.pendingTimer !== null) {
    clearTimeout(state.pendingTimer);
    state.pendingTimer = null;
  }
  hideTypingIndicator();
  state.awaitingReply = false;
  setSendEnabled(true);
}


// ================================================================
// CHAT: DOM HELPERS
// ================================================================

function appendUserBubble(text) {
  const messages = document.getElementById("chat-messages");
  messages.querySelectorAll(".msg-status").forEach(s => s.remove());

  const row    = document.createElement("div");
  row.className = "msg-row user";

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className   = "bubble user";
  bubble.textContent = text;

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
  row.appendChild(createMsgAvatar(false));
  messages.appendChild(row);
  scrollToBottom();
}

function appendAIBubble(text, atTime) {
  const messages = document.getElementById("chat-messages");

  const row    = document.createElement("div");
  row.className = "msg-row ai";

  const wrap   = document.createElement("div");
  wrap.className = "msg-wrap";

  const bubble = document.createElement("div");
  bubble.className   = "bubble ai";
  bubble.textContent = text;

  const timestamp = document.createElement("div");
  timestamp.className   = "msg-timestamp";
  timestamp.textContent = formatTime(atTime);

  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(createMsgAvatar(true));
  row.appendChild(wrap);
  messages.appendChild(row);
  scrollToBottom();
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
  messages.appendChild(row);
  scrollToBottom();
}

function hideTypingIndicator() {
  const row = document.getElementById("typing-row");
  if (row) row.remove();
}

function scrollToBottom() {
  const messages = document.getElementById("chat-messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}

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
  } else {
    el.style.background = '#d1d5db';
  }
  return el;
}


// ================================================================
// SWIPE DECK — module-level drag state (outside `state` object)
// ================================================================

let drag = {
  active:   false,
  card:     null,
  startX:   0,
  startY:   0,
  currentX: 0,
  currentY: 0,
};

const SWIPE_THRESHOLD = 88;   // px from center to commit a swipe
const MAX_ROTATION    = 15;   // max degrees of tilt while dragging
const TAP_MAX_MOVEMENT = 6;   // px — below this, a release counts as a tap, not a drag


// ================================================================
// initSwipeDeck()
// Called by showTab('practice'). Shuffles the PROFILES pool only
// when the deck is exhausted; otherwise resumes where it left off.
// ================================================================

function initSwipeDeck() {
  if (state.swipeIndex >= state.swipeProfiles.length) {
    const age = parseInt(localStorage.getItem('zelo_user_age') || '0', 10);
    let pool;
    if      (age >= 18 && age <= 20) pool = PROFILES.filter(p => p.age_pool === '18-20');
    else if (age >= 21 && age <= 29) pool = PROFILES.filter(p => p.age_pool === '21-29');
    else if (age >= 30)              pool = PROFILES.filter(p => p.age_pool === '30+');
    if (!pool || pool.length === 0)  pool = PROFILES; // fallback: no age set or pool empty
    state.swipeProfiles = shuffleArray([...pool]);
    state.swipeIndex    = 0;
  }
  renderDeck();
}


// ================================================================
// shuffleArray() — Fisher-Yates in-place shuffle
// ================================================================

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


// ================================================================
// renderDeck()
// Clears #card-deck and paints up to 3 cards (back-to-front so the
// top card is last in DOM = highest stacking context).
// ================================================================

function renderDeck() {
  const deck      = document.getElementById('card-deck');
  deck.innerHTML  = '';

  const remaining = state.swipeProfiles.length - state.swipeIndex;

  if (remaining <= 0) {
    deck.innerHTML = `
      <div class="deck-empty">
        <div class="deck-empty-icon">✨</div>
        <div class="deck-empty-title">You've seen everyone</div>
        <div class="deck-empty-sub">Check your Chats or come back later for new people.</div>
      </div>`;
    disableSwipeButtons();
    return;
  }

  const count = Math.min(3, remaining);

  // Render back-to-front: stack index 2 first, 0 last (sits on top)
  for (let i = count - 1; i >= 0; i--) {
    const profile = state.swipeProfiles[state.swipeIndex + i];
    const cardEl  = buildCardElement(profile, i);
    deck.appendChild(cardEl);
  }

  // Only the top card gets drag listeners
  const topCard = deck.querySelector('[data-stack="0"]');
  if (topCard) attachDragListeners(topCard);

  enableSwipeButtons();
}


// ================================================================
// buildCardElement()
// Creates one .swipe-card DOM node for a given profile.
// ================================================================

const INTEREST_ICONS = {
  // Food & drink
  'Coffee': '☕', 'Specialty coffee': '☕', 'Matcha': '🍵', 'Boba': '🧋', 'Bubble tea': '🧋',
  'Cooking': '🍳', 'Baking': '🧁', 'Wine': '🍷', 'Nutrition': '🥗', 'Sushi': '🍣', 'Brunch': '🥂',
  // Fitness & outdoors
  'Running': '🏃', 'Hiking': '🥾', 'Cycling': '🚴', 'Fitness': '💪', 'Yoga': '🧘',
  'Boxing': '🥊', 'Cold plunges': '🧊', 'Rock climbing': '🧗', 'Surfing': '🏄', 'Dancing': '💃',
  // Music & media
  'Music': '🎵', 'Live music': '🎵', 'Indie music': '🎸', 'Podcasts': '🎧', 'K-pop': '🎤',
  'Piano': '🎹', 'K-dramas': '📺', 'Reality TV': '📺', 'Documentaries': '📺', 'Anime': '🎌',
  // Arts & creativity
  'Art': '🎨', 'Photography': '📷', 'Film photography': '📷', 'Writing': '✍️',
  'Art galleries': '🖼️', 'Interior design': '🏠',
  // Books & learning
  'Books': '📚', 'Reading': '📖', 'Entrepreneurship': '💡', 'Politics': '🗞️',
  // Travel
  'Travel': '✈️', 'Japanese culture': '🏯',
  // Fashion & lifestyle
  'Fashion': '👗', 'Thrifting': '🛍️', 'Vintage clothing': '👗', 'Makeup': '💄', 'Skincare': '🧴',
  // Pets
  'Dogs': '🐶', 'Cats': '🐱',
  // Gaming & hobbies
  'Gaming': '🎮', 'Nintendo': '🎮', 'Board games': '🎲',
  // Nature
  'Plants': '🌿', 'Aquariums': '🐠',
  // Misc
  'Formula 1': '🏎️'
};

// Shared by the swipe card and the full-screen profile detail page.
function buildInterestTagsHTML(interests) {
  return interests
    .map(i => {
      const icon = INTEREST_ICONS[i] || '✨';
      return `<span class="interest-tag">${icon} ${i}</span>`;
    })
    .join('');
}

function buildCardElement(profile, stackIndex) {
  const card        = document.createElement('div');
  card.className    = 'swipe-card';
  card.dataset.stack = stackIndex;

  const interestTags = buildInterestTagsHTML(profile.interests);

  const currentMode = state.cardModes[profile.name] || CARD_MODE_DEFAULT;
  const currentModeDesc = CARD_MODES.find(m => m.key === currentMode).desc;

  const modePillsHTML = CARD_MODES.map(m => {
    const locked = !m.free && !isColdAvailable();
    return `<button type="button" class="card-mode-pill${m.key === currentMode ? ' active' : ''}${locked ? ' locked' : ''}" data-mode="${m.key}">
      ${m.label}${locked ? ' 🔒' : ''}
    </button>`;
  }).join('');

  card.innerHTML = `
    <div class="swipe-card-photo">
      <div class="swipe-card-badge-pill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg>
        Top Match
      </div>
    </div>
    <div class="swipe-stamp swipe-stamp--like">LIKE ♥</div>
    <div class="swipe-stamp swipe-stamp--nope">NOPE ✕</div>
    <div class="swipe-card-body">
      <div class="swipe-card-name-row">
        <span class="swipe-card-name">${profile.name}, ${profile.age}</span>
      </div>
      <span class="swipe-card-occ">${profile.occupation}</span>
      <hr class="swipe-card-divider"/>
      <div class="swipe-card-section">
        <span class="swipe-card-section-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          About Me
        </span>
        <p class="swipe-card-bio">${profile.bio}</p>
      </div>
      <div class="swipe-card-section">
        <span class="swipe-card-section-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          Likes
        </span>
        <div class="swipe-card-tags">${interestTags}</div>
      </div>
      <div class="card-mode-section">
        <div class="card-mode-pills">${modePillsHTML}</div>
        <p class="card-mode-desc">${currentModeDesc}</p>
      </div>
    </div>
  `;

  // Wire pill interaction only for top card (only top card is interactive)
  if (stackIndex === 0) {
    const pillsWrap = card.querySelector('.card-mode-pills');
    const descEl    = card.querySelector('.card-mode-desc');
    pillsWrap.querySelectorAll('.card-mode-pill').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const modeKey    = btn.dataset.mode;
        const modeConfig = CARD_MODES.find(m => m.key === modeKey);
        const locked     = !modeConfig.free && !isColdAvailable();
        if (locked) {
          descEl.textContent  = 'Cold mode is a paid feature';
          descEl.style.color  = 'var(--accent)';
          btn.classList.add('locked-tap');
          setTimeout(() => btn.classList.remove('locked-tap'), 260);
          return;
        }
        pillsWrap.querySelectorAll('.card-mode-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.cardModes[profile.name] = modeKey;
        descEl.textContent = modeConfig.desc;
        descEl.style.color = '';
      });
    });
  }

  return card;
}

// Wires the Open/Neutral/Cold pills inside the full-screen profile detail
// page. Cold is locked for free users outside their 7-day trial window —
// tapping it just shows the paywall note inline, it never commits the
// selection.
function attachProfileDetailModeListeners(profile) {
  const wrap   = document.getElementById('pd-mode-pills');
  const descEl = document.getElementById('pd-mode-desc');
  wrap.querySelectorAll('.card-mode-pill').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.mode;
      const config = CARD_MODES.find(m => m.key === mode);
      const locked = !config.free && !isColdAvailable();

      descEl.textContent = config.desc;

      if (locked) {
        btn.classList.add('locked-tap');
        setTimeout(() => btn.classList.remove('locked-tap'), 260);
        return;
      }

      wrap.querySelectorAll('.card-mode-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.cardModes[profile.name] = mode;
    };
  });
}


// ================================================================
// DRAG / TOUCH SYSTEM
// Mouse and touch share the same onDragStart/Move/End handlers.
// Mouse listeners for move/up go on document so the card doesn't
// lose track when the cursor leaves the card boundary.
// ================================================================

function attachDragListeners(cardEl) {
  // Touch
  cardEl.addEventListener('touchstart',  onDragStart, { passive: true });
  cardEl.addEventListener('touchmove',   onDragMove,  { passive: false });
  cardEl.addEventListener('touchend',    onDragEnd);
  cardEl.addEventListener('touchcancel', onDragEnd);
  // Mouse
  cardEl.addEventListener('mousedown', onDragStart);
}

function onDragStart(e) {
  // Don't start drag when tapping a mode pill (Feature 4)
  if (e.target.closest && e.target.closest('.card-mode-pill')) return;
  // Ignore if we're mid-animation or a reply is pending
  if (drag.active) return;

  const touch = e.touches ? e.touches[0] : e;
  drag.active   = true;
  drag.card     = e.currentTarget;
  drag.startX   = touch.clientX;
  drag.startY   = touch.clientY;
  drag.currentX = 0;
  drag.currentY = 0;

  // Remove transition so card snaps to finger immediately
  drag.card.style.transition = 'none';

  // Stop the demo the moment a real drag begins (tutorial only)
  if (tourSwipeArmed) cancelSwipeDemo();

  // Attach document-level mouse handlers (removed in onDragEnd)
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
}

function onDragMove(e) {
  if (!drag.active) return;

  // Prevent page scroll during a horizontal swipe gesture
  if (e.touches) e.preventDefault();

  const touch   = e.touches ? e.touches[0] : e;
  drag.currentX = touch.clientX - drag.startX;
  drag.currentY = touch.clientY - drag.startY;

  // Clamp ratio to ±1 for rotation calc; allow card to move freely beyond
  const ratio   = Math.max(-1, Math.min(1, drag.currentX / SWIPE_THRESHOLD));
  const rotate  = ratio * MAX_ROTATION;

  drag.card.style.transform =
    `translate(${drag.currentX}px, ${drag.currentY * 0.4}px) rotate(${rotate}deg)`;

  // Fade stamps proportionally to drag distance
  const absRatio = Math.abs(ratio);
  const likeStamp = drag.card.querySelector('.swipe-stamp--like');
  const nopeStamp = drag.card.querySelector('.swipe-stamp--nope');

  if (drag.currentX > 0) {
    if (likeStamp) likeStamp.style.opacity = absRatio;
    if (nopeStamp) nopeStamp.style.opacity = 0;
  } else {
    if (nopeStamp) nopeStamp.style.opacity = absRatio;
    if (likeStamp) likeStamp.style.opacity = 0;
  }

  // Nudge background cards toward their "ready" position during drag
  animateBackCards(absRatio);
}

function onDragEnd(e) {
  if (!drag.active) return;
  drag.active = false;

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);

  const moved = Math.max(Math.abs(drag.currentX), Math.abs(drag.currentY));

  if (Math.abs(drag.currentX) >= SWIPE_THRESHOLD) {
    const direction = drag.currentX > 0 ? 'right' : 'left';
    commitSwipe(drag.card, direction);
  } else {
    springBack(drag.card);
    // A release with barely any movement is a tap, not a drag — open the
    // full-screen profile detail page instead of treating it as a swipe.
    if (moved < TAP_MAX_MOVEMENT) openProfileDetail();
  }
}

// Interpolate back-cards toward their next stack position as the top card is dragged
function animateBackCards(absRatio) {
  const deck  = document.getElementById('card-deck');
  const card1 = deck ? deck.querySelector('[data-stack="1"]') : null;
  const card2 = deck ? deck.querySelector('[data-stack="2"]') : null;

  if (card1) {
    const scale = 0.95 + (0.05 * absRatio);
    const ty    = 10   - (10   * absRatio);
    card1.style.transform = `scale(${scale}) translateY(${ty}px)`;
    card1.style.opacity   = 0.75 + (0.25 * absRatio);
  }

  if (card2) {
    const scale = 0.90 + (0.05 * absRatio);
    const ty    = 20   - (10   * absRatio);
    card2.style.transform = `scale(${scale}) translateY(${ty}px)`;
    card2.style.opacity   = 0.5  + (0.25 * absRatio);
  }
}

// Spring-back: card returns to resting position with an overshoot bounce
function springBack(cardEl) {
  cardEl.style.transition = 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  cardEl.style.transform  = '';

  // Hide stamps
  cardEl.querySelectorAll('.swipe-stamp').forEach(s => s.style.opacity = 0);

  // Let CSS rules restore back-cards to their default stack positions
  const deck  = document.getElementById('card-deck');
  if (!deck) return;
  const card1 = deck.querySelector('[data-stack="1"]');
  const card2 = deck.querySelector('[data-stack="2"]');
  if (card1) { card1.style.transform = ''; card1.style.opacity = ''; }
  if (card2) { card2.style.transform = ''; card2.style.opacity = ''; }
}

// Fly card off-screen, then advance or show match
function commitSwipe(cardEl, direction) {
  disableSwipeButtons();

  // Guided tutorial swipe: confirm meaning with a motion cue (heart vs X).
  if (tourSwipeArmed) flashSwipeFeedback(direction);

  const flyX = direction === 'right'
    ?  window.innerWidth  * 1.6
    : -window.innerWidth  * 1.6;
  const flyR = direction === 'right' ? 30 : -30;

  cardEl.style.transition = 'transform 0.36s ease-in';
  cardEl.style.transform  = `translate(${flyX}px, 0px) rotate(${flyR}deg)`;

  cardEl.addEventListener('transitionend', () => {
    const profile = state.swipeProfiles[state.swipeIndex];
    state.swipeIndex++;
    cardEl.remove();

    // During a Home swipe step, swiping IS the lesson. Each step teaches one
    // direction; a matching swipe advances, anything else just re-deals and
    // re-demos the intended motion.
    if (tourSwipeArmed) {
      cancelSwipeDemo();
      renderDeck();                       // fresh top card either way
      if (direction === tourSwipeDir) {
        tourSwipeArmed = false;
        goNextStep();
      } else {
        runSwipeDemo(tourSwipeDir);        // wrong way — show the move again
      }
      return;
    }

    if (direction === 'right') {
      // Swiping and matching are unrestricted — the free-tier limit gates
      // starting a chat (see onStartChatting()), not matching itself.
      showMatchOverlay(profile);
    } else {
      renderDeck();  // simple re-render — picks up new swipeIndex
    }
  }, { once: true });
}


// ================================================================
// BUTTON HANDLERS
// ================================================================

function onSkipBtn() {
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'left');
}

function onLikeBtn() {
  const topCard = document.querySelector('#card-deck [data-stack="0"]');
  if (!topCard) return;
  disableSwipeButtons();
  commitSwipe(topCard, 'right');
}

function disableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = true;
  if (like) like.disabled = true;
}

function enableSwipeButtons() {
  const skip = document.getElementById('btn-skip');
  const like = document.getElementById('btn-like');
  if (skip) skip.disabled = false;
  if (like) like.disabled = false;
}


// ================================================================
// PROFILE DETAIL — full-screen, modal-style page opened by tapping the
// swipe card (not dragging it). Shows everything the card shows plus the
// Open/Neutral/Cold mode pills, and moves Skip/I'm Interested down here.
// The Home tab stays rendered (and active) behind the dim backdrop —
// this does NOT use pushScreen()/the .screen takeover system.
// ================================================================

function openProfileDetail() {
  const profile = state.swipeProfiles[state.swipeIndex];
  if (!profile) return;

  const modal = document.getElementById('profile-detail-modal');
  if (!modal) return;

  // Populate gradient photo area
  const photo = document.getElementById('pd-photo');
  photo.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  photo.innerHTML = `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:700;color:rgba(255,255,255,0.9);">${profile.initial}</span>`;
  photo.style.position = 'relative';

  // Populate text fields
  document.getElementById('pd-name').textContent = profile.name;
  document.getElementById('pd-age').textContent  = profile.age;
  document.getElementById('pd-occ').textContent  = profile.occupation;
  document.getElementById('pd-bio').textContent  = profile.bio;
  document.getElementById('pd-tags').innerHTML   = buildInterestTagsHTML(profile.interests);

  // Mode pills
  const currentMode = state.cardModes[profile.name] || CARD_MODE_DEFAULT;
  const currentModeDesc = CARD_MODES.find(m => m.key === currentMode).desc;
  document.getElementById('pd-mode-pills').innerHTML = CARD_MODES.map(m => {
    const locked = !m.free && !isColdAvailable();
    return `<button type="button" class="card-mode-pill${m.key === currentMode ? ' active' : ''}${locked ? ' locked' : ''}" data-mode="${m.key}">
      ${m.label}${locked ? ' 🔒' : ''}
    </button>`;
  }).join('');
  document.getElementById('pd-mode-desc').textContent = currentModeDesc;
  attachProfileDetailModeListeners(profile);

  // Tap backdrop to close
  modal.onclick = e => { if (e.target === modal) closeProfileDetail(); };

  modal.removeAttribute('hidden');
}

function closeProfileDetail() {
  const modal = document.getElementById('profile-detail-modal');
  if (modal) modal.setAttribute('hidden', '');
}

// Fix 2: Swipe-down-to-dismiss on the profile detail sheet.
// Supports both touch (mobile) and mouse (desktop). Only activates
// when the internal scroll is at the top so normal bio scrolling is
// never interrupted. Dragging upward cancels immediately.
function attachProfileDetailDragToClose() {
  const sheet    = document.querySelector('.profile-detail-sheet');
  const scrollEl = sheet ? sheet.querySelector('.profile-detail-scroll') : null;
  if (!sheet) return;

  let startY = 0, dragging = false, dy = 0;

  function onStart(clientY) {
    if (scrollEl && scrollEl.scrollTop > 0) return;
    startY   = clientY;
    dragging = true;
    dy       = 0;
    sheet.style.transition = 'none';
    sheet.style.userSelect = 'none';
    sheet.style.webkitUserSelect = 'none';
  }

  function onMove(clientY) {
    if (!dragging) return;
    dy = Math.max(0, clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    sheet.style.userSelect = '';
    sheet.style.webkitUserSelect = '';
    if (dy > window.innerHeight * 0.3) {
      sheet.style.transform = '';
      closeProfileDetail();
    } else {
      sheet.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      sheet.style.transform  = '';
      setTimeout(() => { sheet.style.transition = ''; }, 320);
    }
    dy = 0;
  }

  // Touch
  sheet.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  sheet.addEventListener('touchmove',  e => onMove(e.touches[0].clientY),  { passive: true });
  sheet.addEventListener('touchend',   onEnd);
  sheet.addEventListener('touchcancel', onEnd);

  // Mouse (desktop testing)
  sheet.addEventListener('mousedown', e => {
    onStart(e.clientY);
    const onMouseMove = ev => onMove(ev.clientY);
    const onMouseUp   = () => {
      onEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });
}

function onProfileDetailSkip() {
  closeProfileDetail();
  onSkipBtn();
}

function onProfileDetailLike() {
  closeProfileDetail();
  onLikeBtn();
}


// ================================================================
// MATCH OVERLAY
// ================================================================

function showMatchOverlay(profile) {
  // Populate match screen with this profile's details
  document.getElementById('match-name').textContent = profile.name;

  const avatarThem = document.getElementById('match-avatar-them');
  avatarThem.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  avatarThem.textContent      = profile.initial;

  // Wire up state for startChat()
  state.character  = profile;
  state.difficulty = profile.difficulty;
  state.replyIndex = 0;

  // Create a new chat entry in the store for this match
  const newChatId = 'chat_' + Date.now();
  state.activeChatId = newChatId;
  chatStore.unshift({
    id:          newChatId,
    profile:     profile,
    difficulty:  profile.difficulty,
    mode:        'training',
    cardMode:    state.cardModes[profile.name] || CARD_MODE_DEFAULT,
    messages:    [],
    lastMessage: 'New match!',
    lastActive:  'just now',
    unread:      0
  });

  pushScreen('match');
}

// "Start Chatting" — gates on available slots (Feature 7), not raw count.
// Slots can be restored after 10-day deletion cooldown.
function onStartChatting() {
  if (!isPaidUser() && matchSlots() <= 0) {
    flashLimitToast("You've used all 3 slots. A slot restores 10 days after deleting a chat.");
    return;
  }
  incrementMatchCount();
  decrementMatchSlots();
  startChat();
}


// ================================================================
// ASSISTANT: INPUT GATING
// Generate button enables when there is text OR an uploaded image.
// ================================================================

function onAsstInput() {
  const el = document.getElementById("asst-input");
  const cc = document.getElementById("char-count");
  if (cc) cc.textContent = `${el.value.length}/4000`;
  updateScanMessagePreview();
  checkGenerateReady();
}

// Keeps the message preview button on the main Scan page in sync with
// whatever was typed on the dedicated typing page.
function clearScanInput() {
  state.asstMessage = '';
  state.asstContext = '';
  state.scanContext = {};
  state.tellzeloAnswers = {};
  state.scanWhoCard = null;
  const input = document.getElementById('asst-input');
  if (input) input.value = '';
  updateScanMessagePreview();
  updateTellZeloSummary(); // resets the "Or tell zelo more" subtitle + all 3 card highlights
  // Full reset once a scan is done — screenshot goes too, back to a blank Scan tab
  clearUploadedPhoto();
}

function updateScanMessagePreview() {
  const text    = document.getElementById("asst-input")?.value.trim();
  const previewEl = document.getElementById("asst-message-preview-text");
  if (!previewEl) return;
  if (text) {
    previewEl.textContent = text;
    previewEl.classList.remove("msg-preview-placeholder");
  } else {
    previewEl.textContent = "Paste a message, describe the situation, or upload a screenshot…";
    previewEl.classList.add("msg-preview-placeholder");
  }
}

// ---- Legacy situation hooks — kept null-safe for the guided tour ----
function openSituation()  { document.getElementById('situation')?.classList.add('open'); }
function closeSituation() { document.getElementById('situation')?.classList.remove('open'); }


// ================================================================
// SCAN — DEDICATED SUB-PAGES
// Message typing, screenshot upload, and the generated reply each
// live on their own screen so the Scan tab stays a lightweight
// entry point (tap a row → its own page → back into Scan).
// ================================================================

function openScanType() {
  document.getElementById('asst-input')?.focus();
}

function confirmScanType() {
  updateScanMessagePreview();
  checkGenerateReady();
}

function renderScanTypeThreadPicker() {
  const container = document.getElementById('scan-type-thread-picker');
  if (!container) return;
  const threads = getThreads();
  if (threads.length === 0) {
    container.innerHTML = '<p class="scan-type-thread-empty">No threads yet — you can save after analyzing.</p>';
    return;
  }
  let html = '<p class="scan-type-thread-label">Save to a thread?</p>';
  threads.forEach(t => {
    const sel = state.preselectThreadId === t.id ? ' selected' : '';
    const safeId = t.id.replace(/'/g, "\\'");
    html += `<button class="scan-type-thread-row${sel}" onclick="togglePreselectThread('${safeId}')">
      <span>${t.name}</span>
      <span class="scan-type-thread-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>
    </button>`;
  });
  container.innerHTML = html;
}

function togglePreselectThread(id) {
  state.preselectThreadId = state.preselectThreadId === id ? null : id;
  renderScanTypeThreadPicker();
}

function openScanUpload() {
  pushScreen('scan-upload');
}


// ================================================================
// TELL ZELO MORE — a quick, tap-driven context flow (not a form).
// Context lives here, off the Scan page, so Scan stays lightweight.
// ================================================================

const TELLZELO_STEPS = [
  {
    key:  "who",
    q:    "Who is this to you?",
    options: [
      { icon: "💌", label: "New Match" },
      { icon: "👀", label: "Crush" },
      { icon: "⏳", label: "Talking for a While" },
      { icon: "✨", label: "Situationship" },
      { icon: "💕", label: "Someone I'm Dating" },
      { icon: "💔", label: "Ex" },
      { icon: "🤝", label: "Friend" },
    ],
  },
  {
    key:  "situation",
    q:    "What's going on?",
    options: [
      { icon: "🌱", label: "First Conversation" },
      { icon: "📅", label: "Planning Something" },
      { icon: "😏", label: "Flirting" },
      { icon: "🤐", label: "Awkward Silence" },
      { icon: "😤", label: "Argument" },
      { icon: "⚠️", label: "Toxic Relationship" },
      { icon: "🌤️", label: "Getting to Know Each Other" },
    ],
  },
  {
    key:  "goal",
    q:    "What do you want?",
    options: [
      { icon: "💬", label: "Get a Reply" },
      { icon: "🔄", label: "Keep Things Going" },
      { icon: "💘", label: "Ask Them Out" },
      { icon: "🔧", label: "Fix Things" },
      { icon: "😂", label: "Be Funny" },
      { icon: "🎯", label: "Be Direct" },
    ],
  },
];

// ---- "Who's this about?" quick-pick cards (Dating, Crush) ----
// Shortcuts that set the same state.scanContext.who the full Tell Zelo More
// wizard uses — generateReplies() and the wizard both read from the same
// place, so a quick pick here is indistinguishable from picking it in step 1
// of the wizard. Opening "Or tell zelo more" still gets the full flow.
// Deliberately does NOT call updateTellZeloSummary() — that would also mark
// the "Or tell zelo more" card as filled/highlighted, showing two selected
// cards at once. Only one card should ever look selected at a time.
function scanQuickWho(label, el) {
  // Quick-picks replace the ACTIVE selection only — state.tellzeloAnswers
  // (the Other wizard's own progress) is deliberately left untouched so it's
  // still there if the user taps back into Other later this session.
  state.scanContext = { who: label };
  state.scanWhoCard = label === 'Dating' ? 'dating' : 'crush';
  refreshScanWhoCards();
  navigator.vibrate?.(4);
}

// Single source of truth for the "Who's this about?" highlight — exactly one
// of Dating / Crush / Other is ever marked selected, driven off
// state.scanWhoCard (not off scanContext content, since a completed Other
// answer can coincidentally share a label with a quick-pick, e.g. "Crush").
function refreshScanWhoCards() {
  const dating = document.getElementById('scan-who-dating');
  const crush  = document.getElementById('scan-who-crush');
  const other  = document.getElementById('tellzelo-card');
  dating?.classList.toggle('selected', state.scanWhoCard === 'dating');
  crush?.classList.toggle('selected', state.scanWhoCard === 'crush');
  other?.classList.toggle('filled', state.scanWhoCard === 'other');
}

// Open the flow — always start at the first step, keep prior selections.
function openTellZelo() {
  state.tzStep = 0;
  pushScreen('tellzelo');
  renderTellZeloStep();
}

function renderTellZeloStep() {
  const step = TELLZELO_STEPS[state.tzStep];

  // Progress — one segment per step, filled up to and including the current one
  const prog = document.getElementById("tz-progress");
  prog.innerHTML = "";
  TELLZELO_STEPS.forEach((_, i) => {
    const seg = document.createElement("span");
    seg.className = "tz-seg" + (i <= state.tzStep ? " done" : "");
    prog.appendChild(seg);
  });

  document.getElementById("tz-question").textContent = step.q;

  // Help line is gone — hide the element so it takes no space
  const helpEl = document.getElementById("tz-help");
  helpEl.textContent = "";
  helpEl.style.display = "none";

  const wrap = document.getElementById("tz-options");
  wrap.innerHTML = "";

  const isLast = state.tzStep === TELLZELO_STEPS.length - 1;
  document.getElementById("tz-next-label").textContent = isLast ? "Done" : "Next";

  if (step.freeText) {
    // Free-text step — render a plain textarea instead of radio options
    const ta = document.createElement("textarea");
    ta.id          = "tz-freetext";
    ta.className   = "msg-textarea tz-freetext";
    ta.placeholder = step.placeholder || "";
    ta.value       = state.tellzeloAnswers[step.key] || "";
    ta.oninput     = () => {
      state.tellzeloAnswers[step.key] = ta.value;
      // "Done" is always enabled on the free-text step (it's optional seasoning)
      document.getElementById("tz-next").disabled = false;
    };
    wrap.appendChild(ta);
    // Free-text step is always advanceable (it's optional)
    document.getElementById("tz-next").disabled = false;
  } else {
    // Radio-style quick-select options
    const chosen = state.tellzeloAnswers[step.key];
    step.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tz-option" + (chosen === opt.label ? " selected" : "");
      btn.onclick = () => tellZeloSelect(step.key, opt.label);
      btn.innerHTML = `
        <span class="tz-option-icon">${opt.icon}</span>
        <span class="tz-option-label">${opt.label}</span>
        <span class="tz-option-radio">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>`;
      wrap.appendChild(btn);
    });
    document.getElementById("tz-next").disabled = !state.tellzeloAnswers[step.key];
  }
}

function tellZeloSelect(key, label) {
  state.tellzeloAnswers[key] = label;
  renderTellZeloStep();
}

function tellZeloNext() {
  const step = TELLZELO_STEPS[state.tzStep];
  if (!step.freeText && !state.tellzeloAnswers[step.key]) return;  // require a choice (not for free-text)

  if (state.tzStep < TELLZELO_STEPS.length - 1) {
    state.tzStep++;
    renderTellZeloStep();
  } else {
    // Wizard complete — this becomes the ACTIVE selection for the pending
    // scan and "Other" becomes the exclusively-highlighted card. The
    // underlying answers stay in state.tellzeloAnswers so they're still
    // there if the user taps back into Other again later this session.
    state.scanContext = { ...state.tellzeloAnswers };
    state.scanWhoCard = 'other';
    updateTellZeloSummary();
    popScreen();
  }
}

function tellZeloBack() {
  if (state.tzStep > 0) {
    state.tzStep--;
    renderTellZeloStep();
  } else {
    popScreen();
  }
}

function updateTellZeloSummary() {
  const sub = document.getElementById('tellzelo-sub');
  if (sub) sub.textContent = tellzeloAnswersString() || 'Friends, situations or anything else';
  refreshScanWhoCards();
}

// Build a single context string for generation from the ACTIVE selection.
function scanContextString() {
  const order = ["who", "situation", "goal"];
  return order.map(k => state.scanContext[k]).filter(Boolean).join(" · ");
}

// Preview string built from the Other/tellzelo wizard's own saved answers —
// independent of state.scanContext so it still reflects prior progress even
// while Dating/Crush is the currently active selection.
function tellzeloAnswersString() {
  const order = ["who", "situation", "goal"];
  return order.map(k => state.tellzeloAnswers[k]).filter(Boolean).join(" · ");
}

// Get Suggestions stays fully pink/glowing at all times now — it's never
// visually disabled. Tapping it with no input still safely no-ops (see the
// early-return in generateReplies()), which now also shakes the input card
// instead of silently doing nothing. Kept as a no-op (rather than removing
// its several call sites) so nothing else breaks.
function checkGenerateReady() {}

// Trigger the hidden file input
function triggerUpload() {
  document.getElementById("screenshot-input").click();
}

function clearUploadedPhoto() {
  const input = document.getElementById("screenshot-input");
  if (input) input.value = "";
  handleUpload({ files: [] });
}

// Called when the user selects a file. Just shows the thumbnail — both on
// the dedicated upload page's dropzone and in place of the Upload Screenshot
// row on the main Scan page. No text extraction happens here; that's
// deferred to Analyze time (see _extractScreenshotText) and never shown.
function handleUpload(input) {
  const file       = input.files[0];
  const dropzone    = document.getElementById("scan-dropzone");
  const dzIcon      = document.getElementById("scan-dropzone-icon");
  const dzTitle     = document.getElementById("scan-dropzone-title");
  const dzSub       = document.getElementById("scan-dropzone-sub");
  const dzThumb     = document.getElementById("scan-dropzone-thumb");

  const clearBtn  = document.getElementById("scan-upload-clear-btn");
  const minusBtn  = document.getElementById("scan-photo-minus-btn");

  const uploadRow = document.getElementById("upload-row");
  const thumbWrap = document.getElementById("scan-thumb-preview");
  const thumbImg  = document.getElementById("scan-thumb-preview-img");
  const ocrErr    = document.getElementById("scan-ocr-error");

  if (file) {
    dropzone.classList.add("has-file");
    if (clearBtn) clearBtn.hidden = false;
    if (minusBtn) minusBtn.hidden = false;
    if (ocrErr)   ocrErr.hidden = true;

    const reader = new FileReader();
    reader.onload = () => {
      dzThumb.src    = reader.result;
      dzThumb.hidden = false;

      // Thumbnail replaces Upload Screenshot in the action row — the textarea
      // above stays empty and unchanged in either state.
      if (thumbImg)  thumbImg.src = reader.result;
      if (thumbWrap) thumbWrap.hidden = false;
      if (uploadRow) uploadRow.hidden = true;
    };
    reader.readAsDataURL(file);

    dzIcon.hidden  = true;
    dzTitle.hidden = true;
    dzSub.hidden   = true;

    // Auto-transfer: the instant a photo is linked on the dedicated Upload
    // page, jump straight back to Scan (the inline preview is already set via
    // the reader above) — no need to also tap "Done".
    if (state.activeScreen === 'scan-upload') popScreen();
  } else {
    dropzone.classList.remove("has-file");

    dzThumb.hidden = true;
    dzThumb.src    = "";
    dzIcon.hidden  = false;
    dzTitle.hidden = false;
    dzSub.hidden   = false;
    if (clearBtn) clearBtn.hidden = true;
    if (minusBtn) minusBtn.hidden = true;

    if (thumbWrap) thumbWrap.hidden = true;
    if (thumbImg)  thumbImg.src = "";
    if (uploadRow) uploadRow.hidden = false;
    if (ocrErr)    ocrErr.hidden = true;
  }

  checkGenerateReady();
}


// ================================================================
// SCREENSHOT READING — openai-proxy (GPT-5.4 mini vision) silently
// extracts the message text from an attached screenshot at Analyze
// time. The user never sees this text — it's used directly as the
// DeepSeek prompt. Text-only scans are untouched, still via deepseek-proxy.
// ================================================================

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Returns the extracted text, or null on any failure (missing key, bad
// deploy, network error, empty result) — callers stop and show the
// generic error message when this returns null. Returns NO_MESSAGE_SENTINEL
// when the model explicitly found no real conversation in the image (as
// opposed to a technical failure) — callers show a different, friendlier
// message for that case.
const NO_MESSAGE_SENTINEL = "__NO_MESSAGE_FOUND__";

async function _extractScreenshotText(file) {
  try {
    const base64Data = await _fileToBase64(file);
    console.log("[Zelo OCR] extracting screenshot text at analyze time — base64 length:", base64Data.length, "mimeType:", file.type);
    if (!base64Data) return null;

    const { data, error } = await zeloSupabase.functions.invoke('openai-proxy', {
      body: { image: base64Data, mimeType: file.type }
    });

    if (error) {
      // supabase-js only puts a generic message on error.message for a
      // non-2xx response — the actual { error: "..." } body from
      // openai-proxy has to be read off error.context.
      let details = error.message;
      try {
        if (error.context && typeof error.context.clone === "function") {
          details = await error.context.clone().text();
        }
      } catch (_) { /* best-effort — fall back to error.message */ }
      console.error("[Zelo OCR] openai-proxy invoke error:", error, "— response body:", details);
      return null;
    }

    console.log("[Zelo OCR] openai-proxy response:", data);
    const cleaned = (data?.text || "").trim();
    if (!cleaned) return null;
    if (cleaned.toUpperCase() === "NO_MESSAGE_FOUND") return NO_MESSAGE_SENTINEL;
    return cleaned;
  } catch (err) {
    console.error("[Zelo OCR] openai-proxy invoke threw:", err);
    return null;
  }
}

function _showScanOcrError(message) {
  const err = document.getElementById('scan-ocr-error');
  if (!err) return;
  err.textContent = message;
  err.hidden = false;
}


// ================================================================
// STYLE ELIGIBILITY
// Situation + Goal (never Who) select which styles are eligible, in
// priority order. STYLE_ELIGIBILITY (data.js) is the table; this is the
// only function that should read it, so the hard safety rule below is
// always enforced regardless of what the table says.
// ================================================================

const SAFE_FALLBACK_STYLES        = ["direct", "shorter"];
// No Situation/Goal provided at all — gives a spread across the main axes
// (neutral, direct, shorter, longer) so there's something to swipe through
// even without filling in Tell Zelo More.
const NO_CONTEXT_DEFAULT_STYLES   = ["smooth", "direct", "shorter", "longer"];
const HEAVY_SITUATIONS            = new Set(["Argument", "Toxic Relationship"]);
const BANNED_STYLES_IN_HEAVY_SITS = new Set(["funny", "bolder"]);

function getEligibleStyles(situation, goal) {
  let styles;
  const tableEntry = situation && goal && STYLE_ELIGIBILITY[situation]
    ? STYLE_ELIGIBILITY[situation][goal]
    : null;

  if (tableEntry && tableEntry.length) {
    styles = tableEntry.slice();
  } else if (HEAVY_SITUATIONS.has(situation)) {
    // "not offered" cell (e.g. Argument + Be Funny) — safe fallback, never Funny/Bolder
    styles = SAFE_FALLBACK_STYLES.slice();
  } else {
    // No Situation/Goal selected at all, or an otherwise-unmapped combo
    styles = NO_CONTEXT_DEFAULT_STYLES.slice();
  }

  // Hard safety rule, enforced in code — not just by relying on the table
  // being correct. Funny and Bolder must never reach the user during an
  // Argument or Toxic Relationship, regardless of Goal.
  if (HEAVY_SITUATIONS.has(situation)) {
    styles = styles.filter(s => !BANNED_STYLES_IN_HEAVY_SITS.has(s));
    if (styles.length === 0) styles = SAFE_FALLBACK_STYLES.slice();
  }

  return styles;
}


// ================================================================
// ASSISTANT: DEEPSEEK API
// ================================================================

// Turns the structured Tell Zelo More selections into plain-language
// constraints the model is explicitly told to follow, rather than a bare
// unlabeled string it has to guess the meaning of.
function buildScanContextBlock() {
  const ctx = state.asstContextObj || {};
  const lines = [];
  if (ctx.who)       lines.push(`This message is from a ${ctx.who}.`);
  if (ctx.situation) lines.push(`The situation is: ${ctx.situation}.`);
  if (ctx.goal)       lines.push(`The user wants to: ${ctx.goal}.`);
  return lines.join(' ');
}

async function _fetchDeepSeekReply(style) {
  const contextBlock = buildScanContextBlock();

  let userPrompt = `Message I received: "${state.asstMessage}"\nTone: ${STYLE_LABELS[style]}`;
  if (contextBlock) userPrompt += `\nContext: ${contextBlock}`;

  const systemPrompt = contextBlock
    ? `You are Zelo, a witty and confident texting coach. Generate a reply to the message the user received. The user has told you who the message is from, what the situation is, and what they're trying to achieve — treat these as real constraints that must shape the reply's tone and content, not background flavor to ignore. A reply to an Ex during an Argument where the user wants to Fix Things should sound noticeably different from a reply to a Crush who is Flirting where the user wants to Be Funny. Keep it short, natural, and conversational — the way a real person texts. Do not use emojis unless the tone specifically calls for it.`
    : `You are Zelo, a witty and confident texting coach. Generate a reply to the message the user received. Keep it short, natural, and conversational — the way a real person texts. Do not use emojis unless the tone specifically calls for it.`;

  const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
    body: {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 150,
      temperature: 0.85
    }
  });

  if (error) throw new Error(`DeepSeek proxy error: ${error.message}`);
  return data.choices[0].message.content.trim();
}


// ================================================================
// RANDOM-TEXT GUARD — dictionary-based gibberish detection.
// Flags messages that contain zero recognizable English words or slang.
// Loads a word dictionary (5000+ common words + texting slang) at startup
// for O(1) lookups. Fast, no API calls, catches everything from "sadawe"
// to "adijaoidj;a" while letting real short messages/slang through.
// ================================================================

let _gibDictionary       = new Set();
let _gibDictionaryLoaded = false;

async function _loadGibberishDictionary() {
  try {
    const response = await fetch('words-dict.txt?v=20260706d');
    const text = await response.text();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    _gibDictionary = new Set(words.map(w => w.toLowerCase()));
    console.log("[Gibberish Guard] Dictionary loaded:", _gibDictionary.size, "words");
  } catch (err) {
    console.warn("[Gibberish Guard] Failed to load dictionary:", err);
    _gibDictionary = new Set(["the","a","is","and","or","you","me","i","like","love","want"]);
  } finally {
    _gibDictionaryLoaded = true;
  }
}

// Strips common inflections (plurals, -ing, -ed) down to a root the
// dictionary might actually contain — "looking"/"looked"/"looks" all
// reduce toward "look", "friends" toward "friend". A hand-curated word
// list will never cover every inflected form, so this generalizes instead
// of requiring every variant to be added one at a time.
function _stemCandidates(word) {
  const candidates = [];
  if (word.length > 4 && word.endsWith("ies")) candidates.push(word.slice(0, -3) + "y");
  if (word.length > 3 && word.endsWith("es"))  candidates.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith("s"))   candidates.push(word.slice(0, -1));
  if (word.length > 4 && word.endsWith("ing")) {
    const stem = word.slice(0, -3);
    candidates.push(stem, stem + "e");
  }
  if (word.length > 4 && word.endsWith("ied")) candidates.push(word.slice(0, -3) + "y");
  if (word.length > 3 && word.endsWith("ed")) {
    const stem = word.slice(0, -2);
    candidates.push(stem, stem + "e");
  }
  return candidates;
}

// A word counts as recognized if it's in the dictionary as-is, OR if
// collapsing repeated letters makes it match one ("kkk" -> "k", "yess" ->
// "yes", "nooo" -> "no") — texting emphasis is extremely common and
// shouldn't read as gibberish — OR if a common inflection strips down to
// one (see _stemCandidates). The exact-match check always runs first, so
// real words that legitimately double a letter ("good", "book") or end in
// these letter patterns already pass before any fallback is considered.
function _isRecognizedWord(word) {
  if (_gibDictionary.has(word)) return true;

  const collapsed = word.replace(/(.)\1+/g, "$1");
  if (collapsed !== word && _gibDictionary.has(collapsed)) return true;

  return _stemCandidates(word).some(c => c !== word && _gibDictionary.has(c));
}

function _looksLikeGibberish(text) {
  // Fail open: if the dictionary hasn't loaded yet (e.g. Analyze pressed
  // right after page load, before the fetch resolves), don't flag anything
  // rather than flagging everything against an empty word list.
  if (!_gibDictionaryLoaded) return false;

  const clean = text.trim();
  if (clean.length === 0) return false;

  const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
  const hasRealWord = words.some(word => {
    const cleaned = word.replace(/[^a-z']/g, "");
    return cleaned.length > 0 && _isRecognizedWord(cleaned);
  });

  return !hasRealWord;
}

let _gibResolve     = null;
let _gibCurrentText = "";

function _confirmGibberish(text) {
  _gibCurrentText = text;
  return new Promise(resolve => {
    _gibResolve = resolve;
    const askStep    = document.getElementById('gib-confirm-step-ask');
    const thanksStep = document.getElementById('gib-confirm-step-thanks');
    if (askStep)    askStep.hidden    = false;
    if (thanksStep) thanksStep.hidden = true;
    const overlay = document.getElementById('gib-confirm-overlay');
    if (overlay) overlay.hidden = false;
  });
}

function gibConfirmEdit() {
  const overlay = document.getElementById('gib-confirm-overlay');
  if (overlay) overlay.hidden = true;
  if (_gibResolve) { const r = _gibResolve; _gibResolve = null; r(false); }
}

function gibConfirmProceed() {
  const overlay = document.getElementById('gib-confirm-overlay');
  if (overlay) overlay.hidden = true;
  if (_gibResolve) { const r = _gibResolve; _gibResolve = null; r(true); }
}

// User says the flagged text was actually real — log it locally so it can
// be reviewed later to improve the dictionary, then apologize and let them
// continue straight through (no need to also tap "Analyze Anyway").
function gibReportFalsePositive() {
  try {
    const reports = JSON.parse(localStorage.getItem('zelo_gib_reports') || '[]');
    reports.push({ text: _gibCurrentText, time: Date.now() });
    localStorage.setItem('zelo_gib_reports', JSON.stringify(reports));
  } catch (_) { /* best effort — never block the user over a storage error */ }

  const askStep    = document.getElementById('gib-confirm-step-ask');
  const thanksStep = document.getElementById('gib-confirm-step-thanks');
  if (askStep)    askStep.hidden    = true;
  if (thanksStep) thanksStep.hidden = false;
}


// ================================================================
// ASSISTANT: GENERATE
// ================================================================

// Populates the "Her message" area on the result screen. Text mode → the
// editable text field shows the message. Screenshot mode → the screenshot ITSELF
// is shown (filling the box area); we deliberately do NOT surface the OCR text in
// the box — the extracted text lives only in state.asstMessage to feed reply
// generation ("ChatGPT already reads it"), it's not something the user re-reads.
function renderHerMessagePreview(text, screenshotUrl) {
  const ta = document.getElementById("asst-preview-bubble"); // the <textarea>
  if (!ta) return;
  if (screenshotUrl) {
    ta.value = "";                     // screenshot mode: the image is the message
    _showResultThumb(screenshotUrl);
  } else {
    ta.value = text || "";             // text mode: reflect the message in the box
    _hideResultThumb();
    _renderZeloRead(text);             // fill the gap with a coaching read
  }
}

// Zelo's read — a short, human coaching take on HER message, shown in the gap
// below the box for text replies. Rule-based (instant, zero extra API cost): reads
// simple signals in the message + the user's Goal. Easy to swap for an AI-written
// read later. Hidden automatically in screenshot mode (the image fills the gap).
function _buildZeloRead(message, ctx) {
  const msg = (message || "").trim();
  if (!msg) return "Drop her message in and I'll tell you what she's really saying.";
  const low   = msg.toLowerCase();
  const words = low.split(/\s+/).filter(Boolean);
  const goal  = (ctx && ctx.goal ? String(ctx.goal) : "").toLowerCase();

  const emojiOnly     = !/[a-z0-9]/i.test(msg) && /\p{Extended_Pictographic}/u.test(msg);
  const oneWord       = words.length <= 1;
  const lowEffortWord = /^(k|kk|ok|okay|okok|sure|idk|idc|lol+|lmao+|ha(ha)+|hm+|meh|nvm|fine|yeah?|ya|yep|yup|nope?|no|maybe|cool)$/i.test(low.replace(/[.! ]/g, ""));
  const handsLead     = /(idk|i don'?t know|up to you|you decide|whatever( works)?|what do you (wanna|want to)|your call|you pick)/.test(low);
  const asksQuestion  = low.includes("?");
  const warm          = /(!|😊|😍|🥰|😄|😁|❤|💕|can'?t wait|excited|love|omg|haha)/.test(low) && !lowEffortWord;

  // move — a short nudge tied to the user's Goal (optional)
  let move = "";
  if      (/date|meet|hang|see you|link up/.test(goal))                          move = " Aim for a real plan — a day and place.";
  else if (/number|digits|snap|insta|contact/.test(goal))                        move = " Set up a smooth number swap.";
  else if (/reply|response|revive|ghost|quiet|restart|re-?engage|reconnect/.test(goal)) move = " Keep it easy to reply to.";
  else if (/flirt|tension|spark|attract|interest/.test(goal))                    move = " Add a little playful tension.";

  let read;
  if      (handsLead)                read = "She's handing you the wheel — take the lead and be specific.";
  else if (emojiOnly)               read = "Just an emoji — engaged, but giving you nothing to grab. You steer.";
  else if (lowEffortWord || oneWord) read = "Low-effort reply — she wants to see if you'll bring the energy.";
  else if (asksQuestion)            read = "She's curious and leaning in — answer with a hook, then turn it back.";
  else if (warm)                    read = "She's warm and into it — match her energy and move a step forward.";
  else                              read = "She's keeping it open — add spark and give her a thread to grab.";

  return read + move;
}

function _renderZeloRead(message) {
  const el = document.getElementById("yr-zelo-read-text");
  if (el) el.textContent = _buildZeloRead(message, state.scanContext);
}

// Shows / hides the screenshot preview in its own row BELOW the box. The row's
// height is reserved in CSS at a constant size, so the box stays compact and the
// cards below never move; only the image inside is toggled (via .has-shot) — empty
// breathing room for a text reply, a big portrait preview for a screenshot reply.
function _showResultThumb(url) {
  const img = document.getElementById("yr-message-shot-img");
  if (img) img.src = url;
  document.getElementById("yr-preview-block")?.classList.add("has-shot");
}
function _hideResultThumb() {
  const img = document.getElementById("yr-message-shot-img");
  if (img) img.src = "";
  document.getElementById("yr-preview-block")?.classList.remove("has-shot");
}

// --- Result-screen combined-input handlers -----------------------------
// Text the user had typed before attaching a screenshot. Restored verbatim if
// the OCR fails or the screenshot is removed — the fix for the wrong-text bug
// (previously it fell back to the STALE state.asstMessage from a prior scan).
let _typedBeforeShot = "";

// Typed text: commit (regenerate) on blur only, so we don't fire a request on
// every keystroke — matches "feeds reply generation as if typed."
function onResultMessageInput() { /* live typing; commit happens on blur */ }

function onResultMessageCommit() {
  const ta = document.getElementById("asst-preview-bubble");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text || text === (state.asstMessage || "")) return; // unchanged — no-op
  _regenerateFromResultInput(text);
}

function triggerResultUpload() {
  document.getElementById("result-screenshot-input")?.click();
}

// Tapping the message box opens the file picker — the box itself is the
// trigger (there is no upload icon). Typing still works: the textarea focuses
// under the (modal) picker, so cancelling it leaves the field ready to type.
function onMessageBoxTap() {
  triggerResultUpload();
}

// Screenshot chosen: show the thumbnail (below the box) immediately and
// silently (no spinner, per app convention), then reuse the EXISTING OCR
// pipeline (_extractScreenshotText → openai-proxy) and feed the extracted text
// into generation exactly as typed text would. On success the screenshot's
// text becomes the message (intended precedence — screenshot wins).
async function onResultScreenshot(input) {
  const file = input.files?.[0];
  if (!file) return;

  const ta = document.getElementById("asst-preview-bubble");
  _typedBeforeShot = ta ? ta.value : "";   // remember typed text to restore on failure

  // Read + show the thumbnail first, AWAITED — otherwise the FileReader's async
  // onload can fire after the OCR-failure branch and re-show a hidden thumb.
  const dataUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = () => res(null);
    r.readAsDataURL(file);
  });
  if (dataUrl) _showResultThumb(dataUrl);

  const extracted = await _extractScreenshotText(file);
  // Requested: log the RAW OCR result before it's written into the input, so a
  // wrong/garbled substitution is debuggable if it recurs.
  console.log("[Zelo OCR] result-box raw extracted text (before writing to input):", JSON.stringify(extracted));

  if (extracted && extracted !== NO_MESSAGE_SENTINEL) {
    // Do NOT write the OCR text into the box — the screenshot stays shown as the
    // message. The extracted text only feeds generation (state.asstMessage).
    if (ta) ta.value = "";
    _regenerateFromResultInput(extracted);
  } else {
    // OCR failed / no message — restore the user's OWN typed text (never the
    // stale previous-scan message) and drop the unreadable screenshot.
    if (ta) ta.value = _typedBeforeShot;
    input.value = "";
    _hideResultThumb();
  }
}

function removeResultScreenshot() {
  const input = document.getElementById("result-screenshot-input");
  if (input) input.value = "";
  _hideResultThumb();
  // Restore the text the user had before the screenshot (their own text, not a
  // stale message), and re-run generation for it so the replies match the box.
  const ta = document.getElementById("asst-preview-bubble");
  const restore = _typedBeforeShot || "";
  if (ta) ta.value = restore;
  if (restore.trim() && restore.trim() !== (state.asstMessage || "")) {
    _regenerateFromResultInput(restore.trim());
  }
}

// Re-runs reply generation in place (no navigation, no full loading screen —
// the box/thumbnail stay visible) with a new message. Reuses the same carousel
// + fetch path as generateReplies(); only the trigger differs. Does not
// re-decrement the daily scan count — this refines the current scan.
function _regenerateFromResultInput(messageText) {
  if (!messageText) return;
  state.asstMessage    = messageText;
  _renderZeloRead(messageText);        // keep the read in sync with edited text
  state.asstContext    = scanContextString();
  state.asstContextObj = { ...state.scanContext };
  state.asstCurrentSet = {};

  state.eligibleStyles    = getEligibleStyles(state.scanContext.situation, state.scanContext.goal);
  state.currentStyleIndex = 0;
  state.asstStyle         = state.eligibleStyles[0];
  renderReplyCarousel();

  const firstStyle = state.asstStyle;
  _fetchDeepSeekReply(firstStyle)
    .catch(() => "Couldn't reach Zelo right now. Try again.")
    .then(reply => {
      state.asstCurrentSet[firstStyle] = reply;
      _renderCardText(firstStyle);
      _centerCarouselOnCurrent();
      _prefetchNextStyle();
    });
}

// Briefly shakes the input card — signals "add something first" when Get
// Suggestions is tapped with no text and no screenshot. Re-triggerable: the
// class is removed after the animation so a second empty tap shakes again.
function shakeInputCard() {
  const card = document.querySelector('.input-card');
  if (!card) return;
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation if it's already mid-shake
  card.classList.add('shake');
  navigator.vibrate?.(15);
  setTimeout(() => card.classList.remove('shake'), 400);
}

async function generateReplies() {
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

  // Navigate to the loading screen immediately — the silent OCR step (when
  // needed) and the DeepSeek call both run while "Zelo is thinking…" is
  // already on screen, so Analyze never looks like it's frozen/done nothing.
  const loading = document.getElementById("scan-result-loading");
  const content = document.getElementById("scan-result-content");
  loading.hidden = false;
  content.hidden = true;
  pushScreen("scan-result");

  // Typed message always wins. Only when there's no typed text do we fall
  // back to the attached screenshot, read silently in the background via
  // openai-proxy — the extracted text is never shown, just used as the
  // DeepSeek prompt below. The screenshot itself (not the text) is what
  // gets displayed in "Her message" for this case.
  let messageText = userInput;
  let screenshotPreviewUrl = null;
  if (!messageText && hasImage) {
    const err = document.getElementById('scan-ocr-error');
    if (err) err.hidden = true;

    const extracted = await _extractScreenshotText(screenshotFile);
    if (extracted === NO_MESSAGE_SENTINEL) {
      popScreen(); // back to Scan — nothing was generated, no scan consumed
      _showScanOcrError("Hmm, I don't think I caught a real message in that screenshot. Try a clearer one, or paste the message instead.");
      return;
    }
    if (extracted == null) {
      popScreen();
      _showScanOcrError("Couldn't read the screenshot. Try pasting the message instead.");
      return;
    }
    messageText = extracted;
    screenshotPreviewUrl = document.getElementById('scan-thumb-preview-img')?.src || null;
  }

  renderHerMessagePreview(messageText, screenshotPreviewUrl);

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
  _fetchDeepSeekReply(firstStyle)
    .catch(() => "Couldn't reach Zelo right now. Try again.")
    .then(reply => {
      state.asstCurrentSet[firstStyle] = reply;
      _renderCardText(firstStyle);
      loading.hidden = true;
      content.hidden = false;
      _centerCarouselOnCurrent(); // only now is the carousel actually laid out and measurable
      _onReplyRevealed();
      _prefetchNextStyle();
    });
}

// Runs once per scan after the first reply is revealed.
function _onReplyRevealed() {
  // Fix 5: the Other/tellzelo wizard's own saved answers only reset once a
  // scan actually completes — not on every Dating/Crush/Other switch.
  state.tellzeloAnswers = {};
  updateTellZeloSummary();

  // Reset the thread-save prompt so it appears fresh on every new scan
  const tsp = document.getElementById('thread-save-prompt');
  if (tsp) {
    tsp.hidden = false;
    const main   = document.getElementById('thread-save-main');
    const picker = document.getElementById('thread-picker');
    if (main)   main.hidden = false;
    if (picker) { picker.hidden = true; picker.innerHTML = ''; }
  }

  // If a thread was pre-selected on the typing screen, auto-save now
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
      if (tsp) {
        tsp.innerHTML = `<p class="thread-save-q thread-save-success">Saved to "${preThr.name}" ✓</p>`;
        setTimeout(() => { tsp.hidden = true; }, 1500);
      }
    }
    state.preselectThreadId = null;
  }
}


// ================================================================
// ASSISTANT: REPLY CAROUSEL
// Native horizontal scroll-snap carousel (Apple Wallet / App Store Today
// pattern) — every eligible style gets a real .yr-card sibling, centered
// one at a time via CSS scroll-snap-align, with true neighbor cards
// peeking in on both sides rather than a synthetic peek element. Only the
// centered style + one card ahead are ever fetched; see
// _ensureStyleFetched()/_prefetchNextStyle().
// ================================================================

function _currentReplyText() {
  return (state.asstCurrentSet && state.asstCurrentSet[state.asstStyle]) || "";
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Small flat line-icon per style, matching the app's existing outline-icon
// language rather than introducing a clashing illustration style.
function _styleIconSvg(style) {
  const icons = {
    smooth:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><path d="M21 12c0 4.97-4.03 9-9 9-1.5 0-2.9-.37-4.14-1.02L3 21l1.02-3.86A8.96 8.96 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/></svg>',
    funny:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    bolder:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
    direct:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    warmer:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    shorter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg>',
    longer:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>'
  };
  return icons[style] || icons.smooth;
}

// Per-style icon image assets live in assets/icons/{style}.{ICON_EXT}. Each
// card tries to load its image and falls back to the drawn SVG below if the
// file is missing — so a partial icon set never breaks the card. Change
// ICON_EXT here in one place if the delivered files use a different format.
const ICON_EXT = 'png';

const _CARD_SPARK_SVG  = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg>';
const _CARD_QUOTE_SVG  = '<svg viewBox="0 0 32 24" fill="currentColor"><path d="M0 12c0-6 4-10 9-11l1 3c-3 1-5 3-5 6h5v9H0z"/><path d="M16 12c0-6 4-10 9-11l1 3c-3 1-5 3-5 6h5v9h-10z"/></svg>';

// Literal per-spec theme for "smooth" — the pink card the design spec gives
// exact hex values for. Other styles don't have spec'd colors, so they
// reuse their existing STYLE_COLORS accent (unchanged from the old pill/
// peek system) tinted into the same border+gradient+badge treatment.
const CARD_THEME_SMOOTH = {
  border: "#F56BAE",
  gradTop: "#FFF7FB",
  gradBottom: "#FFF3F8",
  badge: "#F14E9B",
  quote: "#F14A95",
  iconBg: "#F14E9B"
};

function _cardThemeFor(style) {
  if (style === "smooth") return CARD_THEME_SMOOTH;
  const accent = (STYLE_COLORS[style] || STYLE_COLORS.smooth).accent;
  return {
    border: accent,
    gradTop: `color-mix(in srgb, ${accent} 4%, white)`,
    gradBottom: `color-mix(in srgb, ${accent} 8%, white)`,
    badge: accent,
    quote: accent,
    iconBg: accent
  };
}

// realIndex is this style's position in state.eligibleStyles. phantom cards
// are extra clones — see renderReplyCarousel() — that make the carousel
// loop: a phantom of the last style sits before the first real card, and a
// phantom of the first style sits after the last, so the first/best-match
// card always has a real-looking neighbor to peek at on both sides instead
// of a blank edge.
function _cardHTML(style, realIndex, phantom) {
  const theme  = _cardThemeFor(style);
  const isBest = state.eligibleStyles[0] === style;
  const indexAttr = phantom ? `data-phantom="true"` : `data-index="${realIndex}"`;
  return `
    <div class="yr-card" data-style="${style}" ${indexAttr} ${phantom ? 'aria-hidden="true"' : ""}
         style="background:linear-gradient(180deg, ${theme.gradTop}, ${theme.gradBottom}); border-color:color-mix(in srgb, ${theme.border} 70%, transparent);">
      <div class="yr-card-top">
        <div class="yr-card-badges">
          <span class="yr-card-badge" style="color:${theme.badge}">${STYLE_LABELS[style] || ""}</span>
          ${isBest ? `<span class="yr-best-match">Best Match</span>` : ""}
        </div>
        <span class="yr-card-spark" aria-hidden="true">${_CARD_SPARK_SVG}</span>
      </div>
      <div class="yr-card-illustration" style="background:${theme.iconBg}">
        <img class="yr-card-illustration-img" src="assets/icons/${style}.${ICON_EXT}" alt="" draggable="false"
             onload="this.closest('.yr-card-illustration').classList.add('has-img')"
             onerror="this.remove()">
        <span class="yr-card-illustration-svg">${_styleIconSvg(style)}</span>
      </div>
      <span class="yr-card-quote" style="color:${theme.quote}">${_CARD_QUOTE_SVG}</span>
      <p class="yr-card-text" hidden></p>
      <div class="yr-card-loading" aria-hidden="true"><span></span><span></span><span></span></div>
      <button class="yr-card-btn" onclick="copyReplyFromCard('${style}', this)">Use this reply</button>
    </div>`;
}

// Builds every eligible style's card shell up front (so scroll-snap has
// real neighbors), plus — when there's more than one style — a phantom
// clone of the last style before the first card and of the first style
// after the last, so the carousel loops and both peeks always have real
// content. Then paints whichever cards already have cached text. Doesn't
// position the scroll here — #scan-result-content is still hidden at this
// point (see generateReplies()), so offsetLeft/clientWidth would all read
// 0; call _centerCarouselOnCurrent() once the screen is actually visible.
function renderReplyCarousel() {
  const track = document.getElementById("reply-carousel");
  if (!track) return;
  const styles = state.eligibleStyles;
  const n = styles.length;
  const loop = n > 1;

  const parts = [];
  if (loop) parts.push(_cardHTML(styles[n - 1], n - 1, true));
  styles.forEach((style, i) => parts.push(_cardHTML(style, i, false)));
  if (loop) parts.push(_cardHTML(styles[0], 0, true));
  track.innerHTML = parts.join("");

  styles.forEach(style => _renderCardText(style));
  _renderDots();
  _updateSwipeHintVisibility();
  _wireCarousel(track);
}

// Snaps the track to whichever card matches state.currentStyleIndex, with
// no animation — used right after the screen becomes visible (real layout
// now exists to measure) and after a manual goToStyleIndex jump.
function _centerCarouselOnCurrent() {
  const track = document.getElementById("reply-carousel");
  const card  = track?.querySelector(`.yr-card[data-index="${state.currentStyleIndex}"]`);
  if (!track || !card) return;
  track.scrollLeft = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
  _updateCenterCardClass(track);
}

// Paints (or re-paints) every DOM node for this style — the real card and,
// if it's currently cloned at either loop boundary, its phantom too —
// from cache. Called after every fetch resolves, and once per style at
// initial render.
function _renderCardText(style) {
  const text = state.asstCurrentSet[style];
  document.querySelectorAll(`.yr-card[data-style="${style}"]`).forEach(card => {
    const textEl    = card.querySelector(".yr-card-text");
    const loadingEl = card.querySelector(".yr-card-loading");
    if (!textEl) return;
    if (text) {
      textEl.textContent = text; // .textContent, not innerHTML — no escaping needed, no injection risk
      textEl.hidden = false;
      if (loadingEl) loadingEl.hidden = true;
    } else {
      textEl.hidden = true;
      if (loadingEl) loadingEl.hidden = false;
    }
  });
}

// The active dot starts at the MIDDLE position (like the reference) and
// moves relative to it — the carousel loops, so position is relative, not
// absolute: dot position = (style index + half the count) mod count.
function _renderDots() {
  const dotsEl = document.getElementById("reply-dots");
  if (!dotsEl || !state.eligibleStyles) return;
  const n = state.eligibleStyles.length;
  const activePos = (state.currentStyleIndex + Math.floor(n / 2)) % n;
  dotsEl.innerHTML = state.eligibleStyles.map((_, i) =>
    `<span class="reply-dot${i === activePos ? " active" : ""}"></span>`
  ).join("");
}

// Always shown when there's more than one card — a permanent affordance,
// not first-time-only guidance.
function _updateSwipeHintVisibility() {
  const hint = document.getElementById("reply-swipe-hint");
  if (!hint) return;
  hint.classList.toggle("hidden", state.eligibleStyles.length <= 1);
}

function _closestCard(track) {
  const cards = track.querySelectorAll(".yr-card");
  const center = track.scrollLeft + track.clientWidth / 2;
  let closest = null, closestDist = Infinity;
  cards.forEach(card => {
    const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
    if (dist < closestDist) { closestDist = dist; closest = card; }
  });
  return closest;
}

// Keeps .is-center on whichever card is nearest the middle — this is what
// makes the centered card render taller than its neighbors (see .yr-card).
// Runs on every scroll frame, not just on settle, so the scale hand-off
// happens live mid-swipe.
function _updateCenterCardClass(track) {
  const closest = _closestCard(track);
  track.querySelectorAll(".yr-card").forEach(c => c.classList.toggle("is-center", c === closest));
}

// Wires the track's scroll-settle detection and pointer-drag, exactly once
// (renderReplyCarousel re-runs per scan, but the track element persists).
let _carouselScrollTimer = null;
function _wireCarousel(track) {
  if (track._wired) { _updateCenterCardClass(track); return; }
  track._wired = true;

  track.addEventListener("scroll", () => {
    _updateCenterCardClass(track);
    clearTimeout(_carouselScrollTimer);
    _carouselScrollTimer = setTimeout(() => _onCarouselSettled(track), 120);
  }, { passive: true });

  _initCarouselDrag(track);
  _updateCenterCardClass(track);
}

// Detects which card is centered once native scrolling settles (debounced
// on the 'scroll' event rather than 'scrollend', which isn't universally
// supported), updates state.currentStyleIndex/asstStyle, and fetches/
// prefetches accordingly. If the settled card is a loop phantom, silently
// (no animation) jumps the track to the matching real card at the same
// scroll position, so the loop is invisible to the user.
function _onCarouselSettled(track) {
  if (track._dragging) return; // wait for the hand to lift; onUp re-triggers settle
  const closest = _closestCard(track);
  if (!closest) return;

  const style      = closest.dataset.style;
  const isPhantom   = closest.dataset.phantom === "true";
  const realIndex   = state.eligibleStyles.indexOf(style);
  if (!isPhantom && realIndex === state.currentStyleIndex) return; // nothing actually changed

  state.currentStyleIndex = realIndex;
  state.asstStyle = style;
  _renderDots();
  _ensureStyleFetched(style);
  _prefetchNextStyle();

  if (isPhantom) {
    const realCard = track.querySelector(`.yr-card[data-style="${style}"][data-index]`);
    if (realCard) {
      track.scrollLeft = realCard.offsetLeft + realCard.offsetWidth / 2 - track.clientWidth / 2;
      _updateCenterCardClass(track);
    }
  }
}

// Pointer drag-to-swipe — same mouse+touch mechanics as the homepage card
// stack (attachDragListeners/onDragStart): shared handlers, and the mouse
// move/up listeners live on document so the drag survives the cursor
// leaving the track. Touch swipes already work via native scroll; this is
// what makes dragging work with a mouse on desktop. Text selection is
// blocked by user-select:none on the track (see .yr-carousel).
function _initCarouselDrag(track) {
  let startX = 0, startScroll = 0, moved = false;

  function onDown(e) {
    if (e.button !== 0) return; // left button only
    track._dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("dragging"); // suspends scroll-snap so it doesn't fight the hand
    e.preventDefault();              // stops native text/image drag from hijacking the gesture
  }

  function onMove(e) {
    if (!track._dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startScroll - dx;
  }

  function onUp() {
    if (!track._dragging) return;
    track._dragging = false;
    track.classList.remove("dragging");
    const closest = _closestCard(track);
    if (closest) {
      track.scrollTo({
        left: closest.offsetLeft + closest.offsetWidth / 2 - track.clientWidth / 2,
        behavior: "smooth"
      });
    }
  }

  track.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);

  // A drag that moved shouldn't also fire the card's "Use this reply" click
  track.addEventListener("click", e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);
}

// Fetches a style's reply only if it isn't cached yet — used both for the
// card the user just landed on, and (via _prefetchNextStyle) the one ahead.
function _ensureStyleFetched(style) {
  if (state.asstCurrentSet[style]) return;
  _fetchDeepSeekReply(style)
    .catch(() => "Couldn't reach Zelo right now. Try again.")
    .then(reply => {
      state.asstCurrentSet[style] = reply;
      _renderCardText(style);
    });
}

// Silent background fetch, exactly one card ahead of whatever's centered —
// wraps around at the end since the carousel loops. Never fetches more
// than one card at a time.
function _prefetchNextStyle() {
  const n = state.eligibleStyles.length;
  if (n <= 1) return;
  const nextIndex = (state.currentStyleIndex + 1) % n;
  _ensureStyleFetched(state.eligibleStyles[nextIndex]);
}

// Programmatic navigation — native touch/trackpad swipe doesn't need this,
// but it's what regenerate/future prev-next controls scroll the track with.
function goToStyleIndex(index) {
  const n = state.eligibleStyles.length;
  if (!n) return;
  const wrapped = ((index % n) + n) % n;
  const track = document.getElementById("reply-carousel");
  const card  = track?.querySelector(`.yr-card[data-index="${wrapped}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}


// ================================================================
// ASSISTANT: COPY REPLY
// ================================================================

function copyCurrentReply() {
  const text  = _currentReplyText();
  const btn   = document.getElementById("copy-btn");
  const label = document.getElementById("copy-btn-label");

  navigator.clipboard.writeText(text).then(() => {
    label.textContent = "Copied";
    btn.classList.add("copied");
    setTimeout(() => {
      label.textContent = "Copy";
      btn.classList.remove("copied");
    }, 2000);
  }).catch(() => {
    // Clipboard API blocked — silent fallback
    label.textContent = "Copied";
    setTimeout(() => { label.textContent = "Copy"; }, 2000);
  });
}

// "Use this reply" on an individual carousel card — copies that card's own
// text (not necessarily the centered one) and flashes feedback on that
// same button, since the shared header Copy button may belong to a
// different card than whichever one was actually tapped — including a
// phantom loop clone, since btn is the exact clicked element, not a re-query.
function copyReplyFromCard(style, btn) {
  const text = state.asstCurrentSet[style];
  if (!text) return;
  const original = btn ? btn.textContent : null;
  const flash = () => {
    if (!btn) return;
    btn.textContent = "Copied ✓";
    setTimeout(() => { btn.textContent = original; }, 2000);
  };
  navigator.clipboard.writeText(text).then(flash).catch(flash);
}


// ================================================================
// ONBOARDING  (two-phase cinematic — active first-launch flow)
//   PHASE 1 (auto, ~4-5s, no interaction) — UNCHANGED:
//     typewriter -> word morph (Confidence/Connection/Conversations) -> logo
//   SHOWCASE (Cal AI style landing, auto-shown right after Phase 1):
//     phone mockup + headline + dark "Get Started" CTA + "Sign in" link.
//     No dots, no skip — tapping Get Started begins Phase 2.
//   PHASE 2 (Next + X-to-skip, 5 screens):
//     1 name (profanity-filtered, no Next until valid) · 2 swipe -> match
//     (auto after 2s, tap match to advance) · 3 notifications · 4 tracking ·
//     5 age range  ->  stores zelo_onboarding_done, shows the sign-up
//     prompt, then lands on Scan with the pre-filled example.
// Every screen fits the viewport (no scroll). App stays pink throughout —
// no theme/color picker anywhere.
// Legacy 3-slide onboarding + 12-step spotlight tour live in
// archive/legacy-onboarding.js and never run.
// ================================================================

let threadEditMode = false;

const CINE_LAST = 5;           // last Phase 2 screen
let cineStep    = 0;           // 0 = Phase 1; 'showcase'; 1-5 = Phase 2 screens
let _cineTimers = [];

function _cineClearTimers() {
  _cineTimers.forEach(t => clearTimeout(t));
  _cineTimers = [];
}
function _cineDelay(fn, ms) {
  const t = setTimeout(fn, ms);
  _cineTimers.push(t);
  return t;
}
// Forces the browser to paint the "before" state before adding entrance
// classes on the next frame, so CSS animations restart reliably.
function _cineNextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

function initOnboarding() {
  initChatsTab();
  const overlay = document.getElementById('cine-onboarding');

  if (localStorage.getItem('zelo_onboarding_done')) {
    if (overlay) overlay.setAttribute('hidden', '');
    return;
  }
  if (!overlay) return;

  overlay.removeAttribute('hidden');
  startCineOnboarding();
}

function startCineOnboarding() {
  cineStep = 0;
  cineSetChrome('none');  // no skip / dots during the auto intro
  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', s.dataset.screen === '0');
  });
  cinePhase1();
}

// Chrome modes: 'none' (Phase 1 + showcase — no skip, no dots),
// 'phase2' (skip + dots visible).
function cineSetChrome(mode) {
  const show = mode === 'phase2';
  ['cine-next', 'cine-dots', 'cine-skip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('cine-hidden', !show);
  });
}

// ---- PHASE 1 — typewriter -> word morph -> logo -> auto-advance ----
// (unchanged original sequence: "Never freeze up again." ->
//  Confidence / Connection / Conversations -> Zelo logo)
function cinePhase1() {
  const type = document.getElementById('cine-p1-type');
  const word = document.getElementById('cine-p1-word');
  const logo = document.getElementById('cine-p1-logo');
  if (!type) { cineGoToShowcase(); return; }

  type.textContent = '';  type.hidden = false;
  word.textContent = '';  word.hidden = true;  word.classList.remove('cine-p1-word--in');
  logo.hidden = true;     logo.classList.remove('cine-p1-logo--in');

  // 1) Typewriter "Never freeze up again."
  const text = 'Never freeze up again.';
  let i = 0;
  function tick() {
    if (i < text.length) {
      type.textContent = text.slice(0, ++i);
      navigator.vibrate?.(1);
      _cineDelay(tick, 38);
    } else {
      _cineDelay(runWords, 500);   // hold half a second
    }
  }
  tick();

  // 2) Word morph — crossfade in the same position, light bg / pink text
  function runWords() {
    type.hidden = true;
    word.hidden = false;
    const words = ['Confidence', 'Connection', 'Conversations'];
    words.forEach((w, idx) => {
      _cineDelay(() => {
        word.textContent = w;
        word.classList.remove('cine-p1-word--in'); void word.offsetWidth;
        word.classList.add('cine-p1-word--in');
        navigator.vibrate?.(4);
      }, idx * 620);
    });
    _cineDelay(runLogo, words.length * 620 + 80);
  }

  // 3) Zelo logo with sparkle, then advance into the showcase screen
  function runLogo() {
    word.hidden = true;
    logo.hidden = false;
    void logo.offsetWidth;
    logo.classList.add('cine-p1-logo--in');
    navigator.vibrate?.(12);
    _cineDelay(() => { cineGoToShowcase(); }, 1000);
  }
}

// ---- SHOWCASE — Cal AI style landing (no chrome, static) ----
function cineGoToShowcase() {
  _cineClearTimers();
  cineStep = 'showcase';
  cineSetChrome('none');
  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', s.dataset.screen === 'showcase');
  });
}

function cineShowcaseStart(e) {
  if (e) e.stopPropagation();
  cineGoTo(1);
}

function cineShowcaseSignIn(e) {
  if (e) e.stopPropagation();
  AUTH.showEmailScreen('signin');
}

// ---- PHASE 2 navigation ----
function cineGoTo(n) {
  _cineClearTimers();
  cineStep = n;

  cineSetChrome('phase2');
  // Screen 2 (swipe demo) hides only the X skip button — dots stay visible.
  const skipBtn = document.getElementById('cine-skip');
  if (skipBtn) skipBtn.classList.toggle('cine-hidden', n === 2);
  document.querySelectorAll('.cine-screen').forEach(s => {
    s.classList.toggle('active', Number(s.dataset.screen) === n);
  });
  document.querySelectorAll('.cine-dot').forEach((d, i) => {
    d.classList.toggle('active', i === n - 1);
  });

  const nextBtn = document.getElementById('cine-next');
  if (nextBtn) {
    // Screen 2 (swipe -> match) drives its own transition — no shared CTA.
    nextBtn.classList.toggle('cine-hidden', n === 2);
    if (n === 1)      nextBtn.textContent = 'Next';
    else if (n === 3) nextBtn.textContent = 'Allow & continue';
    else if (n === 4) nextBtn.textContent = 'Allow & continue';
    else if (n === 5) nextBtn.textContent = 'Get Started →';
  }

  // Screens 1 (name) and 5 (age) require a valid answer before Next unlocks.
  if (n === 1) cineSetNextEnabled(cineNameValid(cineCurrentNameValue()));
  else if (n === 5) cineSetNextEnabled(!!localStorage.getItem('zelo_age_range'));
  else cineSetNextEnabled(true);

  if (n === 1) cineRunNameEntrance();
  else if (n === 2) cineRunSwipeEntrance();
}

function cineSetNextEnabled(on) {
  const b = document.getElementById('cine-next');
  if (!b) return;
  b.disabled = !on;
  b.classList.toggle('cine-next--disabled', !on);
}

function cineNext() {
  if (cineStep === 0 || cineStep === 'showcase') return;  // non-interactive via this button
  const btn = document.getElementById('cine-next');
  if (btn?.disabled) return;
  if (cineStep === 3) requestNotifPermission();       // "Allow & continue" fires the real prompt
  if (cineStep === 4) requestTrackingPermission();    // "Allow & continue" fires the tracking API
  if (cineStep >= CINE_LAST) { cineFinishPhase2(); return; }
  cineGoTo(cineStep + 1);
}

// X (top right) — skip the rest of onboarding on any Phase 2 screen.
function cineSkip(e) {
  if (e) e.stopPropagation();
  finishOnboardingNoPrompt();
}

// Screen 2's match state advances on a tap anywhere; every other screen is inert.
function cineScreenTap(e) {
  const overlay = document.getElementById('cine-onboarding');
  if (!overlay || overlay.hasAttribute('hidden')) return;
  if (cineStep !== 2) return;
  const matchCards = document.getElementById('cine-match-cards');
  if (matchCards && matchCards.style.display !== 'none') cineGoTo(3);
}

// ---- Screen 1 — name input (profanity-filtered, no bad/empty/space-only) ----
const NAME_BLOCKLIST = [
  'fuck','shit','bitch','asshole','bastard','cunt','dick','pussy',
  'nigger','nigga','fag','faggot','whore','slut','rape'
];

function cineCurrentNameValue() {
  return (document.getElementById('cine-name-input')?.value || '').trim();
}

// Tokenizes on any non-letter run so "classic" doesn't match "ass",
// but the whole word "ass" (as its own token) still does.
function cineNameHasProfanity(trimmed) {
  const tokens = trimmed.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some(t => NAME_BLOCKLIST.includes(t));
}

function cineNameValid(trimmed) {
  return trimmed.length >= 2 && !cineNameHasProfanity(trimmed);
}

function cineRunNameEntrance() {
  const input = document.getElementById('cine-name-input');
  const errEl = document.getElementById('cine-name-error');
  if (errEl) errEl.textContent = '';
  if (input) {
    const saved = localStorage.getItem('zelo_display_name');
    if (saved && !input.value) input.value = saved;
    setTimeout(() => input.focus(), 60);
  }
}

function cineNameInput() {
  const raw     = document.getElementById('cine-name-input')?.value || '';
  const trimmed = raw.trim();
  const errEl   = document.getElementById('cine-name-error');

  if (trimmed.length > 0 && cineNameHasProfanity(trimmed)) {
    if (errEl) errEl.textContent = "That name isn't allowed. Try another.";
    cineSetNextEnabled(false);
    return;
  }
  if (errEl) errEl.textContent = '';

  const valid = cineNameValid(trimmed);
  cineSetNextEnabled(valid);
  if (valid) localStorage.setItem('zelo_display_name', trimmed);
}

// ---- Screen 2 — swipe demo -> match (auto after 2s, tap match to advance) ----
// Simple, reliable sequence: hold static 2s -> front card transitions
// (transform+opacity, 500ms ease-in) off-screen right -> on the real
// transitionend event, swap the like/match content instantly (no fade) ->
// burst lines + CTA text fade in. The card deck itself (.cine-swipe-deck)
// is absolutely positioned with a fixed offset and never moves — only the
// like-state and match-state content inside it toggles via style.display
// (not the `hidden` attribute, which an author `display` rule can silently
// override regardless of specificity).
let _cineSwipeTransitionHandler = null;

function cineRunSwipeEntrance() {
  const deco        = document.getElementById('cine-swipe-deco');
  const likeStage    = document.getElementById('cine-swipe-stage');
  const likeControls = document.getElementById('cine-swipe-controls');
  const matchCards    = document.getElementById('cine-match-cards');
  const matchCta       = document.getElementById('cine-match-cta');
  const card         = document.getElementById('cine-swipe-card');
  if (!likeStage || !matchCards || !card) return;

  const burstEl = matchCards.querySelector('.cine-match-burst');

  if (_cineSwipeTransitionHandler) {
    card.removeEventListener('transitionend', _cineSwipeTransitionHandler);
    _cineSwipeTransitionHandler = null;
  }

  // Reset to the like state — deck stays put, only its contents toggle.
  if (deco)         deco.style.display        = '';
  likeStage.style.display    = 'block';
  if (likeControls) likeControls.style.display = 'flex';
  matchCards.style.display  = 'none';
  if (matchCta) matchCta.style.display = 'none';
  card.classList.remove('cine-swipe-card--fly');
  if (burstEl)  burstEl.classList.remove('cine-match-burst--in');
  if (matchCta) matchCta.classList.remove('cine-match-cta--in');
  void card.offsetWidth;   // force reflow so the removed class registers

  _cineDelay(() => {
    _cineSwipeTransitionHandler = () => {
      card.removeEventListener('transitionend', _cineSwipeTransitionHandler);
      _cineSwipeTransitionHandler = null;

      // Instant swap — no transition. Deck container itself never moves;
      // only the like/match content inside it (and the bottom row) toggles.
      if (deco)         deco.style.display        = 'none';
      likeStage.style.display    = 'none';
      if (likeControls) likeControls.style.display = 'none';
      matchCards.style.display  = 'block';
      if (matchCta) matchCta.style.display = 'block';
      navigator.vibrate?.(16);
      _cineNextFrame(() => {
        if (burstEl)  burstEl.classList.add('cine-match-burst--in');
        if (matchCta) matchCta.classList.add('cine-match-cta--in');
      });
    };
    card.addEventListener('transitionend', _cineSwipeTransitionHandler, { once: true });
    card.classList.add('cine-swipe-card--fly');
    navigator.vibrate?.(8);
  }, 2000);
}

// ---- Screen 3 — notifications ----
function requestNotifPermission() {
  try {
    if (window.Notification && typeof Notification.requestPermission === 'function') {
      const r = Notification.requestPermission();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    }
  } catch (_) {}
}

// ---- Screen 4 — tracking permission ----
function requestTrackingPermission() {
  try {
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
  } catch (_) {}
}

// ---- Screen 5 — age range ----
function cineSelectAge(range, el) {
  localStorage.setItem('zelo_age_range', range);
  document.querySelectorAll('.cine-age-pill').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  cineSetNextEnabled(true);
  navigator.vibrate?.(4);
}

// Phase 1 / showcase are non-interactive except their own dedicated buttons.
function cineNoop() {}

// ---- End of Phase 2 — store completion, land on Scan, show sign-up prompt ----
function cineFinishPhase2() {
  _cineClearTimers();
  localStorage.setItem('zelo_onboarding_done', '1');
  const overlay = document.getElementById('cine-onboarding');
  if (overlay) {
    overlay.classList.add('cine-out');
    setTimeout(() => {
      overlay.setAttribute('hidden', '');
      overlay.classList.remove('cine-out');
    }, 360);
  }
  if (state.activeTab !== 'assistant') showTab('assistant');
  _paywallOnClose = () => showSignupPrompt(
    'Save your progress',
    'Create an account to save your history, chats, and leaderboard score.',
    null
  );
  showPaywallNow();
}

// X-skip bypasses the sign-up prompt entirely — lands straight on Scan.
function finishOnboardingNoPrompt() {
  _cineClearTimers();
  localStorage.setItem('zelo_onboarding_done', '1');
  const overlay = document.getElementById('cine-onboarding');
  if (overlay) {
    overlay.classList.add('cine-out');
    setTimeout(() => {
      overlay.setAttribute('hidden', '');
      overlay.classList.remove('cine-out');
    }, 360);
  }
  if (state.activeTab !== 'assistant') showTab('assistant');
}


// ================================================================
// SIGN-UP PROMPT — reusable full-screen overlay. Shown after onboarding
// Screen 5 and again (with different copy) from the Home-tab mode popup.
// ================================================================

let _signupPromptOnLater = null;

function showSignupPrompt(headline, subtext, onLater) {
  const head = document.getElementById('signup-prompt-head');
  const sub  = document.getElementById('signup-prompt-sub');
  if (head) head.textContent = headline;
  if (sub)  sub.textContent  = subtext;
  _signupPromptOnLater = typeof onLater === 'function' ? onLater : null;
  const overlay = document.getElementById('signup-prompt-overlay');
  if (overlay) overlay.hidden = false;
}

function signupPromptCreateAccount() {
  const overlay = document.getElementById('signup-prompt-overlay');
  if (overlay) overlay.hidden = true;
  AUTH.requireAuth('signup-prompt', () => {});
}

function signupPromptLater() {
  const overlay = document.getElementById('signup-prompt-overlay');
  if (overlay) overlay.hidden = true;
  const cb = _signupPromptOnLater;
  _signupPromptOnLater = null;
  if (typeof cb === 'function') cb();
}


// ================================================================
// HOME TAB — first-visit practice-mode popup + locked-deck state
// ================================================================

function showHomeModePopup() {
  const el = document.getElementById('home-mode-popup');
  if (el) el.hidden = false;
}

function homeModeSelect(mode, el) {
  localStorage.setItem('zelo_practice_mode', mode);
  localStorage.setItem('zelo_mode_selected', '1');
  document.querySelectorAll('.home-mode-card-btn').forEach(c => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  navigator.vibrate?.(4);

  const popup = document.getElementById('home-mode-popup');
  if (popup) popup.hidden = true;

  if (AUTH.signedIn()) {
    hideHomeLocked();
    initSwipeDeck();
  } else {
    showHomeLocked();
    showSignupPrompt(
      'Create an account to start matching.',
      'Sign up to unlock swiping and start real conversations.',
      null
    );
  }
}

function showHomeLocked() {
  const el = document.getElementById('home-locked-overlay');
  if (el) el.hidden = false;
}
function hideHomeLocked() {
  const el = document.getElementById('home-locked-overlay');
  if (el) el.hidden = true;
}
function homeLockedTap() {
  showSignupPrompt(
    'Create an account to start matching.',
    'Sign up to unlock swiping and start real conversations.',
    null
  );
}


// ================================================================
// WELCOME BACK — typewriter overlay for returning users (onboarding
// already completed). Fully automatic; no button, no tap.
// ================================================================

function maybeShowWelcomeBack() {
  if (!localStorage.getItem('zelo_onboarding_done')) return;
  const overlay = document.getElementById('welcome-back-overlay');
  const type    = document.getElementById('welcome-back-type');
  if (!overlay || !type) return;

  const name = localStorage.getItem('zelo_display_name');
  const text = name ? `Welcome back, ${name}.` : 'Welcome back.';

  overlay.hidden = false;
  overlay.classList.remove('welcome-back--out');
  type.textContent = '';

  let i = 0;
  function tick() {
    if (i < text.length) {
      type.textContent = text.slice(0, ++i);
      setTimeout(tick, 38);
    } else {
      setTimeout(() => {
        overlay.classList.add('welcome-back--out');
        setTimeout(() => { overlay.hidden = true; }, 400);
      }, 1000);
    }
  }
  tick();
}



// ================================================================
// SCAN BEGINNER POP-UP
// Shown once per session when the user first enters the Scan tab.
// Not persisted (testing phase).
// ================================================================

let scanIntroShown = false;

function maybeShowScanIntro() {}
function scanBeginnerYes() {}
function closeScanModal() {}




// ================================================================
// CHATS TAB
// ================================================================

// In-memory store of chat sessions. Starts empty; new matches are pushed here.
let chatStore = [];

function initChatsTab() {
  // Chats start empty — only real matches populate the store.
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

  chatStore.forEach(chat => {
    const profile = chat.profile;
    const grad = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-row-wrapper';

    const row = document.createElement('div');
    row.className = 'chat-row';
    row.onclick = () => openChatFromStore(chat);
    row.innerHTML = `
      <div class="chat-row-avatar" style="background:${grad}">${profile.initial}</div>
      <div class="chat-row-info">
        <div class="chat-row-top">
          <span class="chat-row-name">${profile.name}, ${profile.age}</span>
          <span class="chat-row-time">${chat.lastActive}</span>
        </div>
        <span class="chat-row-preview">${chat.lastMessage}</span>
      </div>
      ${chat.unread ? `<div class="chat-row-unread">${chat.unread}</div>` : ''}
    `;

    wrapper.appendChild(row);
    list.appendChild(wrapper);

    attachSwipeDelete(row, 'Delete this chat? This cannot be undone.', () => onDeleteChat(chat.id));
  });
}

function openChatFromStore(chat) {
  _captureHistoryReturn();

  // Mark unread cleared
  chat.unread = 0;

  // Set up state as if we just matched
  state.character  = chat.profile;
  state.difficulty = chat.difficulty;
  state.mode       = chat.mode;
  state.replyIndex = chat.messages.filter(m => m.sender === 'ai').length % REPLIES[chat.difficulty].length;
  state.activeChatId = chat.id;

  // Build header
  const headerAvatar = document.getElementById('chat-header-avatar');
  headerAvatar.style.background = `linear-gradient(145deg, ${chat.profile.gradientColors[0]}, ${chat.profile.gradientColors[1]})`;
  headerAvatar.textContent = chat.profile.initial;
  document.getElementById('chat-header-name').textContent = chat.profile.name;
  setHeaderStatus('online');
  document.getElementById('chat-mode-pill').textContent = chat.mode === 'realistic' ? 'Realistic' : 'Instant';

  // Replay messages
  const messagesEl = document.getElementById('chat-messages');
  messagesEl.innerHTML = '';
  chat.messages.forEach(m => {
    if (m.sender === 'user') appendUserBubbleStatic(m.text, m.time);
    else appendAIBubble(m.text, m.time);
  });

  setSendEnabled(true);
  pushScreen('chat');
  bindDevPaceToggle();
  setTimeout(() => { document.getElementById('message-input').focus(); }, 100);
}

// Appends a user bubble without status label (for replayed history)
function appendUserBubbleStatic(text, atTime) {
  const messages = document.getElementById('chat-messages');
  const row    = document.createElement('div');
  row.className = 'msg-row user';
  const wrap   = document.createElement('div');
  wrap.className = 'msg-wrap';
  const bubble = document.createElement('div');
  bubble.className   = 'bubble user';
  bubble.textContent = text;
  const timestamp = document.createElement('div');
  timestamp.className   = 'msg-timestamp';
  timestamp.textContent = formatTime(atTime);
  wrap.appendChild(bubble);
  wrap.appendChild(timestamp);
  row.appendChild(wrap);
  row.appendChild(createMsgAvatar(false));
  messages.appendChild(row);
}

// Save the current chat messages back to the store whenever a message is sent/received
function syncChatToStore(text, sender) {
  if (!state.activeChatId) return;
  const chat = chatStore.find(c => c.id === state.activeChatId);
  if (!chat) return;
  chat.messages.push({ sender, text, time: Date.now() });
  chat.lastMessage = text;
  chat.lastActive  = 'just now';
}


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
}

let _dashHistoryTab = 'scans';

function setDashHistoryTab(tab) {
  _dashHistoryTab = tab;
  document.getElementById('dash-history-tab-scans')?.classList.toggle('active', tab === 'scans');
  document.getElementById('dash-history-tab-matches')?.classList.toggle('active', tab === 'matches');
  renderDashHistoryPreview();
}

// Compact History preview on the Account page — reuses the exact same data
// (getThreads() / chatStore) and row helpers (_threadLastActivity,
// historyTime) as the full History screen (screen-history). One data
// source, two presentations — no separate "recent scans"/"recent matches"
// logic to keep in sync.
function renderDashHistoryPreview() {
  const listEl = document.getElementById('dash-history-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (_dashHistoryTab === 'scans') {
    const threads = getThreads();
    if (threads.length === 0) {
      listEl.innerHTML = '<p class="dash-empty">No scans yet</p>';
      return;
    }
    threads.slice(0, 3).forEach(thread => {
      const activity = _threadLastActivity(thread);
      const row = document.createElement('div');
      row.className = 'dash-history-row';
      row.onclick = () => openThreadDetail(thread.id);
      row.innerHTML = `
        <div class="dash-history-avatar">${(thread.name || '?').trim().charAt(0).toUpperCase()}</div>
        <div class="dash-history-main">
          <span class="dash-history-name">${thread.name}</span>
          <span class="dash-history-preview">${activity.text}</span>
        </div>
        <span class="dash-history-time">${historyTime(activity.time)}</span>`;
      listEl.appendChild(row);
    });
  } else {
    if (chatStore.length === 0) {
      listEl.innerHTML = '<p class="dash-empty">No matches yet</p>';
      return;
    }
    chatStore.slice(0, 3).forEach(c => {
      const grad = `linear-gradient(145deg, ${c.profile.gradientColors[0]}, ${c.profile.gradientColors[1]})`;
      const row = document.createElement('div');
      row.className = 'dash-history-row';
      row.onclick = () => openChatFromStore(c);
      row.innerHTML = `
        <div class="dash-history-avatar" style="background:${grad}">${c.profile.initial}</div>
        <div class="dash-history-main">
          <span class="dash-history-name">${c.profile.name}</span>
          <span class="dash-history-preview">${c.lastMessage || 'New match!'}</span>
        </div>`;
      listEl.appendChild(row);
    });
  }
}

function openDashboard() {
  const displayName = getDisplayName();
  document.getElementById('dash-name').textContent   = displayName;
  document.getElementById('dash-avatar').textContent = displayName.charAt(0).toUpperCase();

  // Stats — lifetime persisted counts (matchCount() survives reload; chatStore doesn't)
  document.getElementById('stat-scans').textContent   = scanCount;
  document.getElementById('stat-matches').textContent = matchCount();
  document.getElementById('stat-chats').textContent   =
    chatStore.filter(c => c.messages.length > 0).length;

  // History — see renderDashHistoryPreview() above
  _dashHistoryTab = 'scans';
  setDashHistoryTab('scans');

  // Leaderboard — reuses the same rank computation as the full leaderboard screen
  const myEntry = getMyLeaderboardEntry();
  const rankEl = document.getElementById('dash-lb-rank');
  if (rankEl) rankEl.textContent = `Rank #${myEntry.rank}`;

  // Settings dropdown always starts collapsed
  const settingsDropdown = document.getElementById('dash-settings-dropdown');
  const settingsBtn      = document.getElementById('dash-settings-btn');
  if (settingsDropdown) settingsDropdown.hidden = true;
  if (settingsBtn) settingsBtn.classList.remove('dash-settings-btn--open');

  pushScreen('dashboard');
}


// ================================================================
// PAID STATUS / TRIAL
// No auth or paywall exists yet — isPaidUser() is a stub flag for testing.
// Trial start is stamped on first-ever app launch since there's no account
// creation moment yet to anchor it to.
// ================================================================

function isPaidUser() {
  return true;  // all features unlocked — paywall gates wired in later
}

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

// Cold mode (swipe card) and the 3rd "Cold mode" women-trial both gate on this.
function isColdAvailable() {
  return isPaidUser() || isWithinTrial();
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
    localStorage.setItem('zelo_ad_used_today', '0');
    localStorage.setItem('zelo_scan_exhausted', '0');
  }
}

function scansRemainingToday() {
  if (isPaidUser()) return Infinity;
  return Number(localStorage.getItem('zelo_scan_count') || 0);
}

function adUsedToday() {
  return localStorage.getItem('zelo_ad_used_today') === '1';
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

// Mocked rewarded video — no ad SDK yet, watching it just adds +3 directly
// to today's remaining count. User-initiated only, never forced.
function watchRewardedAd() {
  if (adUsedToday()) return;
  localStorage.setItem('zelo_ad_used_today', '1');
  localStorage.setItem('zelo_scan_count', String(scansRemainingToday() + FREE_LIMITS.bonusScansPerAd));
  refreshScanLimitBanner();
}

function refreshScanLimitBanner() {
  const banner = document.getElementById('scan-limit-banner');
  const text   = document.getElementById('scan-limit-text');
  const adBtn  = document.getElementById('scan-limit-ad-btn');
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
  adBtn.hidden = !(remaining <= 0 && !adUsedToday());
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
  toast.textContent = message;
  app.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 250); }, 2400);
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
// SET THE PACE — HIDDEN DEV TOGGLE
// Safety net only: lets the timing choice be reverted mid-chat without a
// real settings screen. Buried behind a long-press on the chat header
// status text so it's never a visible, prominent control.
// ================================================================

let devPaceLongPressTimer = null;

function bindDevPaceToggle() {
  const statusEl = document.getElementById('chat-header-status');
  if (!statusEl || statusEl.dataset.devBound) return;
  statusEl.dataset.devBound = '1';

  const start = () => { devPaceLongPressTimer = setTimeout(resetChatPace, 600); };
  const cancel = () => clearTimeout(devPaceLongPressTimer);

  statusEl.addEventListener('mousedown',  start);
  statusEl.addEventListener('touchstart', start, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt =>
    statusEl.addEventListener(evt, cancel)
  );
}

function resetChatPace() {
  if (!document.getElementById('screen-chat').classList.contains('active')) return;
  state.chatModePending = null;
  updateChatModeOptionUI();
  document.getElementById('chat-mode-modal').hidden = false;
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

function getThreads() {
  try { return JSON.parse(localStorage.getItem('zelo_threads') || '[]'); }
  catch { return []; }
}
function saveThreads(arr) { localStorage.setItem('zelo_threads', JSON.stringify(arr)); }
function getThreadCount()  { return Number(localStorage.getItem('zelo_thread_count') || 0); }
function setThreadCount(n) { localStorage.setItem('zelo_thread_count', String(n)); }

// Returns the thread object if save succeeds, or null with a reason string.
function saveToThread(name, message, reply) {
  const threads = getThreads();
  const norm    = name.trim();
  if (!norm) return { error: 'Enter a name first.' };

  let thread = threads.find(t => t.name.toLowerCase() === norm.toLowerCase());
  if (!thread) {
    const count = getThreadCount();
    // DEV — restore paid gate before release
    if (!isPaidUser() && count >= 2) {
      return { error: "You've hit your maximum threads. Delete one to make room or upgrade for unlimited." };
    }
    thread = { id: 'thread_' + Date.now(), name: norm, createdAt: Date.now(), scans: [], chat: [] };
    threads.unshift(thread);
    setThreadCount(count + 1);
  }

  thread.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
  saveThreads(threads);
  return { thread };
}

function deleteThread(threadId) {
  const threads = getThreads().filter(t => t.id !== threadId);
  saveThreads(threads);
  // Fix 7: drop the AI Coach link if it pointed at the deleted thread
  if (getLinkedThreadId() === threadId) setLinkedThreadId(null);
  renderThreadList();
  refreshAiCoachCard();
}

// + button: check free-tier slot then show inline name input
function openAddThread() {
  const count = getThreadCount();
  if (!isPaidUser() && count >= 2) {
    const modal = document.getElementById('thread-upgrade-modal');
    if (modal) modal.hidden = false;
    return;
  }

  // If an input row is already open, just focus it
  const existing = document.getElementById('thread-new-input-row');
  if (existing) { existing.querySelector('input')?.focus(); return; }

  const listEl = document.getElementById('thread-list');
  const newBtn = listEl?.querySelector('.thread-edit-new-btn');
  if (!listEl) return;

  const row = document.createElement('div');
  row.id = 'thread-new-input-row';
  row.className = 'thread-new-input-row';
  row.innerHTML = `
    <input class="thread-save-input thread-new-name-input"
           type="text" placeholder="Thread name…" autocomplete="off" maxlength="50" />
    <button class="thread-save-btn" type="button">Add</button>
  `;

  const input = row.querySelector('input');
  const addBtn = row.querySelector('button');

  function commit() {
    const name = input.value.trim();
    row.remove();
    if (!name) return;
    const threads = getThreads();
    if (!threads.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      const thread = { id: 'thread_' + Date.now(), name, createdAt: Date.now(), scans: [], chat: [] };
      threads.unshift(thread);
      setThreadCount(count + 1);
      saveThreads(threads);
    }
    renderThreadList();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { row.remove(); }
  });
  addBtn.addEventListener('click', commit);

  if (newBtn) listEl.insertBefore(row, newBtn);
  else listEl.appendChild(row);

  setTimeout(() => input.focus(), 30);
}

function cancelAddThread() {}
function confirmAddThread() {}

function dismissThreadUpgrade() {
  document.getElementById('thread-upgrade-modal').hidden = true;
}

// ─── Swipe-to-delete helpers (threads + chats) ─────────────────────────────

function showDeleteConfirm(message, onConfirm) {
  const app = document.getElementById('app');
  const overlay = document.createElement('div');
  overlay.className = 'mini-modal-overlay';
  overlay.innerHTML = `
    <div class="mini-modal-card">
      <p class="mini-modal-body">${message}</p>
      <div class="mini-modal-actions">
        <button class="mini-modal-cancel">Cancel</button>
        <button class="mini-modal-confirm mini-modal-confirm--danger">Delete</button>
      </div>
    </div>`;
  app.appendChild(overlay);
  overlay.querySelector('.mini-modal-cancel').onclick  = () => overlay.remove();
  overlay.querySelector('.mini-modal-confirm').onclick = () => { overlay.remove(); onConfirm(); };
}

function attachSwipeDelete(row, _confirmMsg, onDelete) {
  const wrapper = row.parentElement;
  const FULL = 160;  // visual fill reference (half-speed, so row moves FULL px when finger moves 2×FULL)
  let startX = 0, curX = 0, active = false, delEl = null;

  function getDelEl(leftSwipe) {
    if (delEl) return delEl;
    delEl = document.createElement('div');
    delEl.className = 'swipe-del-reveal';
    const origin    = leftSwipe ? 'right' : 'left';
    const labelSide = leftSwipe ? 'right' : 'left';
    delEl.innerHTML = `
      <div class="swipe-del-fill" style="transform-origin:${origin} center"></div>
      <span class="swipe-del-label" style="${labelSide}:24px">Delete</span>`;
    wrapper.appendChild(delEl);
    return delEl;
  }

  function snapBack() {
    row.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
    row.style.transform  = '';
    if (delEl) {
      const fill = delEl.querySelector('.swipe-del-fill');
      if (fill) { fill.style.transition = 'transform 0.3s'; fill.style.transform = 'scaleX(0)'; }
    }
    setTimeout(() => {
      row.style.transition = '';
      if (delEl) { delEl.remove(); delEl = null; }
    }, 310);
  }

  function showPopup() {
    const app = document.getElementById('app');
    const overlay = document.createElement('div');
    overlay.className = 'mini-modal-overlay';
    overlay.innerHTML = `
      <div class="mini-modal-card">
        <p class="mini-modal-body">Delete this?</p>
        <div class="mini-modal-actions">
          <button class="mini-modal-cancel">Cancel</button>
          <button class="mini-modal-confirm mini-modal-confirm--danger">Delete</button>
        </div>
      </div>`;
    app.appendChild(overlay);
    overlay.querySelector('.mini-modal-cancel').onclick = () => {
      overlay.remove();
      snapBack();
    };
    overlay.querySelector('.mini-modal-confirm').onclick = () => {
      overlay.remove();
      row.style.transition = 'opacity 0.15s';
      row.style.opacity = '0';
      setTimeout(() => {
        row.remove();
        if (delEl) { delEl.remove(); delEl = null; }
      }, 150);
      onDelete();
    };
  }

  function updateDel(dx) {
    const abs = Math.abs(dx);
    if (abs < 4) return;
    const d        = getDelEl(dx < 0);
    const rowDx    = dx * 0.5;  // half-speed
    const progress = Math.min(1, Math.abs(rowDx) / FULL);
    d.querySelector('.swipe-del-fill').style.transform = `scaleX(${progress})`;
    row.style.transform = `translateX(${rowDx}px)`;
  }

  function finish() {
    const rowWidth = row.getBoundingClientRect().width || 300;
    if (Math.abs(curX) >= rowWidth * 0.3) {
      const isLeft = curX < 0;
      const d    = getDelEl(isLeft);
      const fill = d ? d.querySelector('.swipe-del-fill') : null;
      row.style.transition = 'transform 0.22s ease-out';
      row.style.transform  = `translateX(${isLeft ? -FULL : FULL}px)`;
      if (fill) {
        fill.style.transition = 'transform 0.22s ease-out';
        fill.style.transform  = 'scaleX(1)';
      }
      setTimeout(showPopup, 230);
    } else {
      snapBack();
    }
  }

  // Touch
  row.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; curX = 0; active = true;
  }, { passive: true });
  row.addEventListener('touchmove', e => {
    if (!active) return;
    curX = e.touches[0].clientX - startX;
    updateDel(curX);
  }, { passive: true });
  row.addEventListener('touchend',    () => { if (!active) return; active = false; finish(); });
  row.addEventListener('touchcancel', () => { if (!active) return; active = false; snapBack(); });

  // Mouse (desktop)
  row.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    startX = e.clientX; curX = 0; active = true;
    row.style.userSelect = 'none';
    const onMove = ev => { if (!active) return; curX = ev.clientX - startX; updateDel(curX); };
    const onUp   = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      if (!active) return;
      active = false;
      row.style.userSelect = '';
      finish();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

// ─── Thread list ────────────────────────────────────────────────────────────

let _activeThreadDeleteRow = null;

function _dismissActiveThreadDelete() {
  if (!_activeThreadDeleteRow) return;
  const del = _activeThreadDeleteRow.querySelector('.thread-row-inline-del');
  if (del) { del.classList.remove('visible'); }
  _activeThreadDeleteRow = null;
}

function _showThreadRowDelete(wrapper, threadId) {
  if (_activeThreadDeleteRow === wrapper) {
    _dismissActiveThreadDelete();
    return;
  }
  _dismissActiveThreadDelete();
  _activeThreadDeleteRow = wrapper;

  let del = wrapper.querySelector('.thread-row-inline-del');
  if (!del) {
    del = document.createElement('button');
    del.className = 'thread-row-inline-del';
    del.textContent = 'Delete';
    del.onclick = (e) => {
      e.stopPropagation();
      _activeThreadDeleteRow = null;
      deleteThread(threadId);
      renderThreadList();
    };
    wrapper.appendChild(del);
  }
  requestAnimationFrame(() => del.classList.add('visible'));
}

function toggleThreadEditMode() {
  _dismissActiveThreadDelete();
  threadEditMode = !threadEditMode;
  const btn = document.getElementById('thread-edit-btn');
  if (btn) btn.textContent = threadEditMode ? 'Done' : 'Edit';
  renderThreadList();
}

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
  const screen = document.getElementById('screen-history');
  if (!screen) return;
  _historyOpenedFromDashboard = (state.activeScreen === 'dashboard');
  _historyTab = tab || 'scans';
  setHistoryTab(_historyTab);
  screen.classList.add('active');
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
// inside it drill into a real screen (thread-detail, chat) via pushScreen;
// without this, that screen's "back" would land on whatever was under
// History instead of Account. Any function that can be entered from a
// History row calls _captureHistoryReturn() before navigating away, and
// its close/back handler calls _restoreHistoryReturn() first — this goes
// straight back to Account, it does not reopen History.
let _historyReturnTab = null;

function _captureHistoryReturn() {
  const screen = document.getElementById('screen-history');
  _historyReturnTab = (screen && screen.classList.contains('active')) ? _historyTab : null;
}

function _restoreHistoryReturn() {
  if (!_historyReturnTab) return false;
  _historyReturnTab = null;
  // Always lands on Account, unconditionally — a Scan/Match row is only
  // ever reached through History, and History is an Account feature.
  openDashboard();
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
    chatStore.forEach(c => {
      const wrapper = document.createElement('div');
      wrapper.className = 'history-row-wrapper';
      const row = document.createElement('div');
      row.className = 'history-row';
      const grad = `linear-gradient(145deg, ${c.profile.gradientColors[0]}, ${c.profile.gradientColors[1]})`;
      row.innerHTML = `
        <div class="history-avatar" style="background:${grad}; color:#fff;">${c.profile.initial}</div>
        <div class="history-row-main">
          <div class="history-row-top">
            <span class="history-row-name">${c.profile.name}</span>
          </div>
          <span class="history-row-preview">${c.lastMessage || 'New match!'}</span>
        </div>
        <svg class="history-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>`;
      row.onclick = () => openChatFromStore(c);
      wrapper.appendChild(row);
      listEl.appendChild(wrapper);
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

    const initial = (thread.name || '?').trim().charAt(0).toUpperCase();
    const activity = _threadLastActivity(thread);

    row.innerHTML = `
      <div class="history-avatar">${initial}<span class="history-avatar-dot"></span></div>
      <div class="history-row-main">
        <div class="history-row-top">
          <span class="history-row-name">${thread.name}</span>
          <span class="history-row-time">${historyTime(activity.time)}</span>
        </div>
        <span class="history-row-preview">${activity.text}</span>
      </div>
      <svg class="history-row-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>`;
    row.onclick = () => openThreadDetail(thread.id);

    wrapper.appendChild(row);
    listEl.appendChild(wrapper);

    attachSwipeDelete(row, 'Delete this thread? This cannot be undone.',
      () => { deleteThread(thread.id); renderHistory(); });
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
  } else {
    // Paid / under cap → "✦ N threads" footer like the mockup
    const footer = document.createElement('div');
    footer.className = 'history-footer-count';
    footer.innerHTML = `
      <span class="history-footer-spark" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/>
        </svg>
      </span>
      ${threads.length} thread${threads.length !== 1 ? 's' : ''}`;
    listEl.appendChild(footer);
  }
}

function upgradeNow() {
  showPaywallNow();
}


// ================================================================
// PAYWALL — UI mock only, no payment logic. RevenueCat/StoreKit
// integration comes later.
//
// Both entry points (upgradeNow(), called from the History tab's upgrade
// button, and the onboarding-complete flow in
// cineFinishPhase2()) navigate straight to the paywall — it never
// dead-ends. The screen isn't pushed onto state.screenStack: it sits on
// top of whatever was active and closePaywall() unwinds straight back to
// it via the existing popScreen()/showTab() fallback.
// ================================================================

function _replaceActiveScreen(name) {
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  document.getElementById("tab-bar").classList.add("hidden");
  state.activeScreen = name;
}

let _paywallOnClose = null;
let _paywallAnimated = false;
let _paywallAnimationTimers = [];

function showPaywallNow() {
  _replaceActiveScreen('paywall');
  if (!_paywallAnimated) {
    _paywallAnimated = true;
    const timelineTotalMs = playPaywallTimelineIntro();
    // Yearly bounce must not overlap the timeline reveal — it only starts
    // once the reveal sequence has fully finished.
    _paywallAnimationTimers.push(setTimeout(playPaywallYearlyBouncePattern, timelineTotalMs));
  }
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
    const overlayRect = overlay.getBoundingClientRect();
    const targetRect = stepIcon.getBoundingClientRect();
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
// has fully finished (see showPaywallNow()).
function playPaywallYearlyBouncePattern() {
  let t = 0;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 1
  t += PAYWALL_BOUNCE_MS + PAYWALL_BOUNCE_PAUSE_MS;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 2
  t += PAYWALL_BOUNCE_MS; // back-to-back, no pause
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 3
  t += PAYWALL_BOUNCE_MS + PAYWALL_BOUNCE_PAUSE_MS;
  _paywallAnimationTimers.push(setTimeout(triggerPaywallYearlyBounce, t)); // bounce 4
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
    popScreen();
    return;
  }
  // Only prompt if there are threads to save to (or the user can create one)
  showSaveBeforeLeave();
}

function showSaveBeforeLeave() {
  const app = document.getElementById('app');
  if (document.getElementById('save-reminder-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'save-reminder-overlay';
  overlay.id = 'save-reminder-overlay';

  function close() {
    const el = document.getElementById('save-reminder-overlay');
    if (el) el.remove();
  }
  function leaveAnyway() { close(); clearScanInput(); popScreen(); }

  function getCard() { return document.getElementById('save-reminder-card'); }

  function showInitial() {
    const card = getCard();
    if (!card) return;
    card.innerHTML = `
      <p class="save-reminder-q">Do you want to save this scan to a thread?</p>
      <div class="save-reminder-actions">
        <button class="save-reminder-save-btn">Save</button>
        <button class="save-reminder-leave-btn">Leave anyway</button>
      </div>`;
    card.querySelector('.save-reminder-save-btn').onclick  = showSavePicker;
    card.querySelector('.save-reminder-leave-btn').onclick = leaveAnyway;
  }

  function showSavePicker() {
    const threads = getThreads();
    const count   = getThreadCount();
    const card    = getCard();
    if (!card) return;

    // Free user with all slots full — offer replace
    if (!isPaidUser() && count >= 2 && threads.length >= 2) {
      let html = `<p class="save-reminder-q">Your threads are full. Replace one or upgrade for more.</p>`;
      threads.forEach(t => {
        html += `<button class="save-reminder-thread-row" data-id="${t.id}">
          <span>${t.name}</span>
          <span class="save-reminder-thread-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>
        </button>`;
      });
      html += `<button class="save-reminder-leave-btn" style="margin-top:10px">Leave anyway</button>`;
      card.innerHTML = html;
      card.querySelectorAll('.save-reminder-thread-row').forEach(btn => {
        btn.onclick = () => {
          const thr = threads.find(t => t.id === btn.dataset.id);
          if (!thr) return;
          card.innerHTML = `
            <p class="save-reminder-q save-reminder-danger">Replace ${thr.name}? Their scans will be deleted.</p>
            <div class="save-reminder-actions">
              <button class="save-reminder-save-btn save-reminder-danger-btn">Replace</button>
              <button class="save-reminder-leave-btn">Cancel</button>
            </div>`;
          card.querySelector('.save-reminder-save-btn').onclick = () => {
            const message = state.asstMessage;
            const reply   = _currentReplyText();
            const allThr  = getThreads();
            const idx     = allThr.findIndex(t => t.id === thr.id);
            if (idx !== -1) {
              allThr[idx].scans = [{ id: 'scan_' + Date.now(), message, reply, time: Date.now() }];
              saveThreads(allThr);
              renderThreadList();
            }
            state.scanSavedToThread = true;
            close(); clearScanInput(); popScreen();
          };
          card.querySelector('.save-reminder-leave-btn').onclick = close;
        };
      });
      card.querySelector('.save-reminder-leave-btn').onclick = leaveAnyway;
      return;
    }

    // Has available slots — show thread list + new option
    let html = `<p class="save-reminder-q">Pick a thread</p>`;
    threads.forEach(t => {
      html += `<button class="save-reminder-thread-row" data-id="${t.id}">
        <span>${t.name}</span>
        <span class="save-reminder-thread-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>
      </button>`;
    });
    html += `<button class="save-reminder-thread-row save-reminder-new-row">+ New thread</button>`;
    html += `<button class="save-reminder-leave-btn" style="margin-top:8px">Cancel</button>`;
    card.innerHTML = html;

    card.querySelectorAll('.save-reminder-thread-row:not(.save-reminder-new-row)').forEach(btn => {
      btn.onclick = () => {
        const message = state.asstMessage;
        const reply   = _currentReplyText();
        const allThr  = getThreads();
        const t       = allThr.find(t => t.id === btn.dataset.id);
        if (!t) return;
        t.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
        saveThreads(allThr);
        renderThreadList();
        state.scanSavedToThread = true;
        close(); popScreen();
      };
    });
    card.querySelector('.save-reminder-new-row').onclick = showNewThreadForm;
    card.querySelector('.save-reminder-leave-btn').onclick = close;
  }

  function showNewThreadForm() {
    const card = getCard();
    if (!card) return;
    card.innerHTML = `
      <p class="save-reminder-q">Create a thread</p>
      <div class="save-reminder-row">
        <input class="thread-save-input" id="reminder-new-name" type="text" placeholder="Name…" />
        <button class="thread-save-btn" id="reminder-add-btn">Add</button>
      </div>
      <button class="save-reminder-leave-btn" style="margin-top:8px">Cancel</button>`;
    const inp = card.querySelector('#reminder-new-name');
    setTimeout(() => inp && inp.focus(), 50);
    inp && inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmReminder(); });
    card.querySelector('#reminder-add-btn').onclick      = confirmReminder;
    card.querySelector('.save-reminder-leave-btn').onclick = close;

    function confirmReminder() {
      const name = inp ? inp.value.trim() : '';
      if (!name) return;
      const threads = getThreads();
      const count   = getThreadCount();
      const norm    = name.toLowerCase();
      let thr = threads.find(t => t.name.toLowerCase() === norm);
      if (!thr) {
        thr = { id: 'thread_' + Date.now(), name, createdAt: Date.now(), scans: [], chat: [] };
        threads.unshift(thr);
        setThreadCount(count + 1);
      }
      const message = state.asstMessage;
      const reply   = _currentReplyText();
      thr.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
      saveThreads(threads);
      renderThreadList();
      state.scanSavedToThread = true;
      close(); popScreen();
    }
  }

  overlay.innerHTML = `
    <div class="save-reminder-backdrop"></div>
    <div class="save-reminder-card" id="save-reminder-card"></div>`;
  app.appendChild(overlay);
  overlay.querySelector('.save-reminder-backdrop').onclick = leaveAnyway;
  showInitial();
}

// "Save" tapped in scan result: show existing threads or go straight to name input
function openThreadPicker() {
  if (!AUTH.signedIn()) {
    if (!DEV_MODE) AUTH.requireAuth('save-thread', () => openThreadPicker());
    else openThreadPicker();
    return;
  }

  const threads = getThreads();
  const picker  = document.getElementById('thread-picker');
  const main    = document.getElementById('thread-save-main');
  if (!picker || !main) return;
  main.hidden = true;

  if (threads.length === 0) {
    showNewThreadInputInPicker(picker);
    return;
  }

  let html = '<p class="thread-save-q">Pick a thread</p>';
  threads.forEach(t => {
    const safeId = t.id.replace(/'/g, "\\'");
    html += `<button class="thread-pick-row" onclick="saveToExistingThread('${safeId}')">
      <span class="thread-pick-name">${t.name}</span>
      <span class="thread-pick-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>
    </button>`;
  });

  const count = getThreadCount();
  if (isPaidUser() || count < 2) {
    html += `<button class="thread-pick-row thread-pick-new" onclick="showNewThreadInputInPicker(null)">+ New person</button>`;
  }
  html += `<button class="thread-save-skip" onclick="closeThreadPicker()">Cancel</button>`;
  picker.innerHTML = html;
  picker.hidden = false;
}

function saveToExistingThread(threadId) {
  const message = state.asstMessage;
  const reply   = _currentReplyText();
  const threads = getThreads();
  const thread  = threads.find(t => t.id === threadId);
  if (!thread) return;
  thread.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
  saveThreads(threads);
  renderThreadList();
  state.scanSavedToThread = true;
  const prompt = document.getElementById('thread-save-prompt');
  if (prompt) {
    prompt.innerHTML = `<p class="thread-save-q thread-save-success">Saved to "${thread.name}" ✓</p>`;
    setTimeout(() => { prompt.hidden = true; }, 1500);
  }
}

function showNewThreadInputInPicker(picker) {
  const el = picker || document.getElementById('thread-picker');
  if (!el) return;
  el.innerHTML = `
    <p class="thread-save-q">Create a thread</p>
    <div class="thread-save-row">
      <input class="thread-save-input" id="thread-new-name" type="text" placeholder="Name…"
             onkeydown="if(event.key==='Enter')confirmSaveToNewThread()" />
      <button class="thread-save-btn" onclick="confirmSaveToNewThread()">Add</button>
    </div>
    <button class="thread-save-skip" onclick="closeThreadPicker()">Cancel</button>
  `;
  el.hidden = false;
  setTimeout(() => { const inp = document.getElementById('thread-new-name'); if (inp) inp.focus(); }, 50);
}

function confirmSaveToNewThread() {
  const nameInput = document.getElementById('thread-new-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) return;

  const count = getThreadCount();
  if (!isPaidUser() && count >= 2) {
    // DEV — connect to paywall before release
    document.getElementById('thread-upgrade-modal').hidden = false;
    return;
  }

  const message = state.asstMessage;
  const reply   = _currentReplyText();
  const threads = getThreads();
  const norm    = name.toLowerCase();
  let thread = threads.find(t => t.name.toLowerCase() === norm);
  if (!thread) {
    thread = { id: 'thread_' + Date.now(), name, createdAt: Date.now(), scans: [], chat: [] };
    threads.unshift(thread);
    setThreadCount(count + 1);
  }
  thread.scans.push({ id: 'scan_' + Date.now(), message, reply, time: Date.now() });
  saveThreads(threads);
  renderThreadList();
  state.scanSavedToThread = true;

  const prompt = document.getElementById('thread-save-prompt');
  if (prompt) {
    prompt.innerHTML = `<p class="thread-save-q thread-save-success">Saved to "${name}" ✓</p>`;
    setTimeout(() => { prompt.hidden = true; }, 1500);
  }
}

function closeThreadPicker() {
  const picker = document.getElementById('thread-picker');
  const main   = document.getElementById('thread-save-main');
  if (picker) { picker.hidden = true; picker.innerHTML = ''; }
  if (main)   main.hidden = false;
}

function skipThreadSave() {
  state.scanSkippedSave = true;
  const prompt = document.getElementById('thread-save-prompt');
  if (prompt) prompt.hidden = true;
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
      <div class="thread-scan-msg">${scan.message}</div>
      <div class="thread-scan-reply">${scan.reply}</div>
      <div class="thread-scan-time">${formatTime(scan.time)}</div>
    `;
    entry.appendChild(body);
    if (!state.scanEditMode) {
      attachSwipeDelete(entry, 'Delete this scan entry?', () => {
        _deleteScanAtIndex(idx);
      });
    }
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

function toggleScanEditMode() {
  state.scanEditMode = !state.scanEditMode;
  const editBtn = document.getElementById('scan-edit-btn');
  const toolbar = document.getElementById('scan-edit-toolbar');
  if (editBtn) editBtn.textContent = state.scanEditMode ? 'Done' : 'Edit';
  if (toolbar) toolbar.hidden = !state.scanEditMode;
  _renderThreadScans();
  if (state.scanEditMode) _updateScanEditCount();
}

function deleteSelectedScans() {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  if (!thread) return;
  const checked = [...document.querySelectorAll('.scan-select-cb:checked')];
  const indices = checked.map(cb => Number(cb.closest('.thread-scan-entry').dataset.scanIdx));
  indices.sort((a, b) => b - a).forEach(i => thread.scans.splice(i, 1));
  saveThreads(threads);
  toggleScanEditMode();
}

function _deleteScanAtIndex(idx) {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  if (!thread) return;
  thread.scans.splice(idx, 1);
  saveThreads(threads);
  _renderThreadScans();
}

function closeThreadDetail() {
  state.activeThreadId = null;
  state.threadChat     = [];
  if (_restoreHistoryReturn()) return;
  popScreen();
}


// ================================================================
// AI COACH  (Fix 5/6/7/8 — replaces the old Ask-Zelo-inside-thread)
// Full-page coach. Real DeepSeek via the Supabase proxy. Counts toward
// the shared 10/day scan limit. Optionally linked to a saved thread,
// whose scans are fed as context.
// ================================================================

// In-flight coach conversation for the currently open page.
let _aiCoachChat = [];

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
  label.textContent = thread ? thread.name : 'No thread linked';
}

// ── Open / close the full page ─────────────────────────────────
function openAiCoach() {
  const thread = getLinkedThread();
  _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
  renderAiCoachContext();
  renderAiCoachChat();
  // Suggestions panel always starts collapsed — the user taps to reveal it,
  // regardless of whether this is a fresh conversation or has history.
  _aiCoachSuggestOpen = false;
  renderAiCoachSuggestPanel();
  const limit = document.getElementById('aicoach-limit');
  if (limit) limit.hidden = true;
  pushScreen('ai-coach');
  setTimeout(() => document.getElementById('aicoach-input')?.focus(), 60);
}

function closeAiCoach() { popScreen(); }

function renderAiCoachContext() {
  const info   = document.getElementById('aicoach-context-info');
  const btn    = document.getElementById('aicoach-change-btn');
  const row    = document.getElementById('aicoach-context-row');
  if (!info) return;
  const thread = getLinkedThread();
  if (thread) {
    const msgCount = (thread.scans?.length || 0) * 2;
    info.innerHTML =
      `<span class="aicoach-context-title">Thread Context
         <span class="aicoach-context-linked">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
             <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
           </svg>Linked</span></span>
       <span class="aicoach-context-meta">${thread.name} • ${msgCount} message${msgCount !== 1 ? 's' : ''}</span>`;
    if (btn) btn.textContent = 'Change';
    if (row) row.classList.add('linked');
  } else {
    info.innerHTML =
      `<span class="aicoach-context-title">No thread linked</span>
       <span class="aicoach-context-meta">Link a thread for deeper context</span>`;
    if (btn) btn.textContent = 'Link';
    if (row) row.classList.remove('linked');
  }
}

function _aiCoachGreeting() {
  const thread = getLinkedThread();
  return thread
    ? `I've reviewed the full conversation with ${thread.name}. Ask me anything or get suggestions on how to reply.`
    : `I can help you analyze this situation and suggest the best replies. Link a thread for deeper context.`;
}

function renderAiCoachChat() {
  const wrap = document.getElementById('aicoach-messages');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Opening Zelo greeting (not part of the stored turns)
  wrap.appendChild(_aiCoachZeloBubble(_aiCoachGreeting(), { greeting: true }));

  _aiCoachChat.forEach(msg => {
    if (msg.role === 'user') {
      wrap.appendChild(_aiCoachUserBubble(msg));
    } else {
      wrap.appendChild(_aiCoachZeloBubble(msg.content, { time: msg.time }));
      (msg.suggestions || []).forEach(s => wrap.appendChild(_aiCoachSuggestion(s)));
    }
  });

  // Action pills after the latest Zelo answer
  const last = _aiCoachChat[_aiCoachChat.length - 1];
  if (last && last.role === 'assistant' && last.content !== '…') {
    wrap.appendChild(_aiCoachActionPills());
  }

  wrap.scrollTop = wrap.scrollHeight;
}

function _aiCoachZeloBubble(text, opts = {}) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--zelo';
  const avatar = opts.greeting
    ? `<span class="aicoach-msg-avatar" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg></span>`
    : '';
  const hi = opts.greeting ? `<p class="aicoach-bubble-hi">Hi! I'm Zelo.</p>` : '';
  row.innerHTML = `
    ${avatar}
    <div class="aicoach-bubble aicoach-bubble--zelo">
      ${hi}
      <p class="aicoach-bubble-text">${text}</p>
    </div>`;
  return row;
}

function _aiCoachUserBubble(msg) {
  const row = document.createElement('div');
  row.className = 'aicoach-msg aicoach-msg--user';
  row.innerHTML = `<div class="aicoach-bubble aicoach-bubble--user">${msg.content}</div>`;
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
  card.innerHTML = `
    <span class="aicoach-suggestion-icon" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/>
      </svg>
    </span>
    <span class="aicoach-suggestion-text">${text}</span>`;
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

function toggleAiCoachSuggestPanel() {
  _aiCoachSuggestOpen = !_aiCoachSuggestOpen;
  _updateAiCoachSuggestToggle();
}

function _updateAiCoachSuggestToggle() {
  const panel   = document.getElementById('aicoach-suggest-panel');
  const chevron = document.getElementById('aicoach-suggest-toggle-chevron');
  if (panel)   panel.classList.toggle('open', _aiCoachSuggestOpen);
  if (chevron) chevron.classList.toggle('aicoach-suggest-toggle-chevron--open', _aiCoachSuggestOpen);
}

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
        <span class="aicoach-suggest-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="#ec4899"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg></span>
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

// True once there's an actual message on record (a linked thread with real
// scans) that the AI can reason about — not just a category label with
// nothing behind it.
function _aiCoachHasRealContext() {
  const thread = getLinkedThread();
  return !!(thread && Array.isArray(thread.scans) && thread.scans.length > 0);
}

function aiCoachPromptTap(question) {
  if (_aiCoachHasRealContext()) {
    // A linked thread already gives the AI something real to work with.
    sendAiCoachMessage(question);
    return;
  }
  // No message on record yet — ask for it instead of letting the AI guess.
  _aiCoachChat.push({ role: 'user', content: question, time: Date.now() });
  _aiCoachChat.push({
    role: 'assistant',
    content: "What did she write? Paste her message (or link a thread) and I'll take it from there.",
    suggestions: [],
    time: Date.now()
  });
  renderAiCoachChat();
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();
  setTimeout(() => document.getElementById('aicoach-input')?.focus(), 60);
}

function handleAiCoachKeyDown(e) {
  if (e.key === 'Enter') sendAiCoachMessage();
}

// Builds the proxy message list: system prompt + linked thread context as
// prior history + the live coach turns.
function _buildAiCoachMessages() {
  const thread = getLinkedThread();
  let system =
    'You are Zelo, a casual texting coach. Never formal, never therapist-like. ' +
    'You talk like a smart friend giving quick, honest advice. Keep replies short, direct, no fluff. ';
  if (thread) {
    system += `The user has linked their conversation with ${thread.name}. ` +
      'The messages above show what they received and how they replied — use that context. ';
  }
  system +=
    'Respond ONLY with a JSON object, no markdown fences, in exactly this shape: ' +
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
    if (m.content === '…') return;
    messages.push({ role: m.role, content: m.content });
  });

  return messages;
}

async function sendAiCoachMessage(preset) {
  const input = document.getElementById('aicoach-input');
  const text  = (preset != null ? preset : (input ? input.value : '')).trim();
  if (!text) return;

  // Daily limit (Fix 8) — AI Coach shares the 10/day scan budget
  if (!isPaidUser() && scansRemainingToday() <= 0) {
    const limit = document.getElementById('aicoach-limit');
    if (limit) limit.hidden = false;
    return;
  }

  if (input && preset == null) input.value = '';
  _aiCoachChat.push({ role: 'user', content: text, time: Date.now() });
  if (!isPaidUser()) decrementScanCount();

  // Sending a message collapses the suggestions panel — it can still be
  // reopened manually anytime via the toggle.
  _aiCoachSuggestOpen = false;
  _updateAiCoachSuggestToggle();

  const placeholder = { role: 'assistant', content: '…', suggestions: [], time: Date.now() };
  _aiCoachChat.push(placeholder);
  renderAiCoachChat();

  const apiMessages = _buildAiCoachMessages().slice(0, -1); // exclude placeholder

  try {
    const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
      body: { model: 'deepseek-chat', messages: apiMessages, max_tokens: 320, temperature: 0.9 }
    });
    if (error) throw error;
    const raw = data.choices[0].message.content.trim();
    const parsed = _parseAiCoachReply(raw);
    placeholder.content     = parsed.advice;
    placeholder.suggestions = parsed.suggestions;
  } catch {
    placeholder.content     = "Hmm, I couldn't reach Zelo right now. Try again in a moment.";
    placeholder.suggestions = [];
  }

  _persistAiCoachChat();
  renderAiCoachChat();
}

// Tolerant parse — DeepSeek may wrap JSON in ```json fences or add stray text.
function _parseAiCoachReply(raw) {
  let body = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = body.indexOf('{');
  const end   = body.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const obj = JSON.parse(body.slice(start, end + 1));
      const advice = (obj.advice || '').toString().trim();
      const suggestions = Array.isArray(obj.suggestions)
        ? obj.suggestions.map(s => String(s).trim()).filter(Boolean).slice(0, 3)
        : [];
      if (advice) return { advice, suggestions };
    } catch (_) { /* fall through */ }
  }
  return { advice: raw, suggestions: [] };
}

// Persist coach chat onto the linked thread so History previews + a return
// visit pick up where the user left off.
function _persistAiCoachChat() {
  const id = getLinkedThreadId();
  if (!id) return;
  const threads = getThreads();
  const thread  = threads.find(t => t.id === id);
  if (!thread) return;
  thread.coachChat = _aiCoachChat;
  saveThreads(threads);
}

// ── "How it works" popup (Fix 5 — blank for now) ───────────────
function showAiCoachHowItWorks() { document.getElementById('aicoach-hiw-overlay').hidden = false; }
function hideAiCoachHowItWorks() { document.getElementById('aicoach-hiw-overlay').hidden = true; }

// ── Thread link picker (Fix 7) ─────────────────────────────────
function openThreadLinkPicker() {
  const overlay  = document.getElementById('thread-link-overlay');
  const list     = document.getElementById('thread-link-list');
  if (!overlay || !list) return;
  const threads  = getThreads();
  const linkedId = getLinkedThreadId();
  list.innerHTML = '';

  // Remove option — only shown when a thread is currently linked
  if (linkedId) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'thread-link-row thread-link-row--remove';
    removeBtn.innerHTML = `
      <span class="thread-link-avatar">✕</span>
      <span class="thread-link-name">Remove thread</span>`;
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
      const initial = (t.name || '?').trim().charAt(0).toUpperCase();
      btn.innerHTML = `
        <span class="thread-link-avatar">${initial}</span>
        <span class="thread-link-name">${t.name}</span>
        <span class="thread-link-count">${t.scans.length} scan${t.scans.length !== 1 ? 's' : ''}</span>`;
      btn.onclick = () => linkThread(t.id);
      list.appendChild(btn);
    });
  }
  overlay.hidden = false;
}

function toggleAiCoachCard() {
  const body    = document.getElementById('aicoach-card-body');
  const sub     = document.getElementById('aicoach-card-sub');
  const chevron = document.getElementById('aicoach-card-chevron');
  if (!body) return;
  const opening = body.hidden;
  body.hidden = !opening;
  if (sub)     sub.hidden = !opening;
  if (chevron) chevron.classList.toggle('aicoach-card-chevron--open', opening);
}

function closeThreadLinkPicker() {
  const overlay = document.getElementById('thread-link-overlay');
  if (overlay) overlay.hidden = true;
}

function linkThread(id) {
  setLinkedThreadId(id);
  closeThreadLinkPicker();
  refreshAiCoachCard();
  // If the AI Coach page is open, reload its context + conversation
  if (state.activeScreen === 'ai-coach') {
    const thread = getLinkedThread();
    _aiCoachChat = thread && Array.isArray(thread.coachChat) ? thread.coachChat.slice() : [];
    renderAiCoachContext();
    renderAiCoachChat();
  }
}


// ================================================================
// FEATURE 9 — LEADERBOARD
// Paid only. Entry from dashboard. Mocked static data.
// ================================================================

function getDisplayName() {
  let name = localStorage.getItem('zelo_display_name');
  if (!name) {
    name = 'Player #' + String(Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('zelo_display_name', name);
  }
  return name;
}

function saveDisplayName(name) {
  localStorage.setItem('zelo_display_name', name.trim() || getDisplayName());
}

let lbTimeFilter = 'weekly';
let lbCategory   = 'streak';

function openLeaderboard() {
  // DEV — restore paid gate before release
  // if (!isPaidUser()) {
  //   flashLimitToast('Leaderboard is a paid feature.');
  //   return;
  // }
  lbTimeFilter = 'weekly';
  lbCategory   = 'streak';
  renderLeaderboard();
  pushScreen('leaderboard');
}

function setLbTimeFilter(f) { lbTimeFilter = f; renderLeaderboard(); }
function setLbCategory(c)   { lbCategory   = c; renderLeaderboard(); }

// Shared rank lookup — used by the full leaderboard screen and by the
// Account page's compact leaderboard card, so both always agree.
function getMyLeaderboardEntry() {
  const data   = getLbData(lbTimeFilter, lbCategory);
  const myName = getDisplayName();
  return data.find(e => e.name === myName) || { rank: data.length + 1, name: myName, score: 0 };
}

function renderLeaderboard() {
  const data       = getLbData(lbTimeFilter, lbCategory);
  const myName     = getDisplayName();
  const myEntry    = getMyLeaderboardEntry();

  // Time filter tabs
  ['weekly','monthly','alltime'].forEach(f => {
    const btn = document.getElementById('lb-time-' + f);
    if (btn) btn.classList.toggle('active', f === lbTimeFilter);
  });
  // Category tabs
  ['streak','messages','cold'].forEach(c => {
    const btn = document.getElementById('lb-cat-' + c);
    if (btn) btn.classList.toggle('active', c === lbCategory);
  });

  // Podium (top 3)
  const podium = document.getElementById('lb-podium');
  if (podium && data.length >= 3) {
    const order = [data[1], data[0], data[2]]; // left=2nd, center=1st, right=3rd
    const positions = ['2nd', '1st', '3rd'];
    podium.innerHTML = order.map((e, i) => `
      <div class="lb-podium-slot${positions[i] === '1st' ? ' lb-podium-slot--first' : ''}">
        ${positions[i] === '1st' ? '<div class="lb-crown">👑</div>' : ''}
        <div class="lb-podium-avatar"></div>
        <div class="lb-podium-name">${e.name}</div>
        <div class="lb-podium-score">${e.score}</div>
        <div class="lb-podium-rank">#${e.rank}</div>
      </div>`).join('');
  }

  // List (rank 4+)
  const listEl = document.getElementById('lb-list');
  if (listEl) {
    listEl.innerHTML = data.slice(3).map(e => `
      <div class="lb-list-row${e.name === myName ? ' lb-list-row--me' : ''}">
        <span class="lb-list-rank">${e.rank}</span>
        <div class="lb-list-avatar"></div>
        <span class="lb-list-name">${e.name}</span>
        <span class="lb-list-score">${e.score}</span>
        <span class="lb-list-badge">${e.rank === 1 ? '👑' : e.rank <= 10 ? '🥇' : '🥉'}</span>
      </div>`).join('');
  }

  // Pinned own rank
  const pinEl = document.getElementById('lb-my-rank');
  if (pinEl) {
    pinEl.innerHTML = `
      <span class="lb-list-rank">#${myEntry.rank}</span>
      <div class="lb-list-avatar"></div>
      <span class="lb-list-name">${myEntry.name} (you)</span>
      <span class="lb-list-score">${myEntry.score}</span>`;
  }
}

function getLbData(timeFilter, category) {
  return (LEADERBOARD_DATA[category] || {})[timeFilter] || [];
}

function openLeaderboardFromDash() {
  popScreen();   // close dashboard first
  setTimeout(() => openLeaderboard(), 50);
}


// ================================================================
// ACCOUNT SETTINGS
// The Settings entry point is an inline dropdown on the Account page
// (toggleSettingsDropdown), not a page of its own. Each row in that
// dropdown pushes straight into screen-settings on its own panel;
// the header back button there always returns straight to Account.
// ================================================================

let _settingsPanel = null;

const SETTINGS_PANEL_IDS = {
  'login':           'settings-panel-login',
  'security':        'settings-panel-security',
  'notifications':   'settings-panel-notifications',
  'privacy':         'settings-panel-privacy',
  'help':            'settings-panel-help'
};

const SETTINGS_PANEL_TITLES = {
  'login':           'Login',
  'security':        'Security',
  'notifications':   'Notifications',
  'privacy':         'Privacy',
  'help':            'Help & Support'
};

// Settings section on the Account page — expands/collapses in place.
function toggleSettingsDropdown() {
  const dropdown = document.getElementById('dash-settings-dropdown');
  const btn      = document.getElementById('dash-settings-btn');
  if (!dropdown) return;
  dropdown.hidden = !dropdown.hidden;
  if (btn) btn.classList.toggle('dash-settings-btn--open', !dropdown.hidden);
}

function openSettingsSubpage(name) {
  showSettingsPanel(name);
  pushScreen('settings');
}

function showSettingsPanel(name) {
  _settingsPanel = name;
  Object.entries(SETTINGS_PANEL_IDS).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = (key !== name);
  });
  const titleEl = document.getElementById('settings-screen-title');
  if (titleEl) titleEl.textContent = SETTINGS_PANEL_TITLES[name] || 'Settings';

  if (name === 'login')          _populateLoginPanel();
  if (name === 'notifications')  _populateNotificationsPanel();
  if (name === 'privacy')        _populatePrivacyPanel();
}

// No intermediate list page anymore — back always returns to Account.
function settingsBack() {
  popScreen();
}

function _populateLoginPanel() {
  const nameInput = document.getElementById('settings-display-name-input');
  if (nameInput) nameInput.value = getDisplayName();
  const emailInput = document.getElementById('settings-email-input');
  if (emailInput) emailInput.value = AUTH.currentEmail();
  const emailMsg = document.getElementById('settings-email-msg');
  if (emailMsg) emailMsg.textContent = '';
  const pwMsg = document.getElementById('settings-password-msg');
  if (pwMsg) pwMsg.textContent = '';
}

function _populateNotificationsPanel() {
  const push  = document.getElementById('toggle-push-notifications');
  const email = document.getElementById('toggle-email-notifications');
  if (push)  push.checked  = localStorage.getItem('zelo_push_notifications')  === 'true';
  if (email) email.checked = localStorage.getItem('zelo_email_notifications') === 'true';
}

function _populatePrivacyPanel() {
  const dns = document.getElementById('toggle-do-not-sell');
  if (dns) dns.checked = localStorage.getItem('zelo_do_not_sell') === 'true';
  const sel = document.getElementById('settings-retention-select');
  if (sel) sel.value = localStorage.getItem('zelo_history_retention_days') || '7';
}

function onSettingsToggle(key, value) {
  localStorage.setItem(key, String(value));
}

function onRetentionChange(value) {
  localStorage.setItem('zelo_history_retention_days', value);
}

function toggleHelpFaq() {
  const el = document.getElementById('settings-faq-content');
  if (el) el.hidden = !el.hidden;
}

function saveAccountDisplayName() {
  const input = document.getElementById('settings-display-name-input');
  if (!input) return;
  saveDisplayName(input.value);
  input.value = getDisplayName();
}

async function changeAccountEmail() {
  const input = document.getElementById('settings-email-input');
  const msg   = document.getElementById('settings-email-msg');
  const email = (input?.value || '').trim();
  if (!email) { if (msg) msg.textContent = 'Enter an email address.'; return; }
  if (msg) msg.textContent = 'Saving…';
  const { error } = await AUTH.changeEmail(email);
  if (msg) msg.textContent = error || 'Check your inbox to confirm the new email.';
}

async function changeAccountPassword() {
  const input = document.getElementById('settings-password-input');
  const msg   = document.getElementById('settings-password-msg');
  const pw = input?.value || '';
  if (pw.length < 6) { if (msg) msg.textContent = 'Password must be at least 6 characters.'; return; }
  if (msg) msg.textContent = 'Saving…';
  const { error } = await AUTH.changePassword(pw);
  if (msg) msg.textContent = error || 'Password updated.';
  if (!error && input) input.value = '';
}

// GDPR data export — everything the app actually stores for this user,
// pulled from the same sources as the rest of the app (no separate copy).
function exportAccountData() {
  const payload = {
    displayName: getDisplayName(),
    age:         localStorage.getItem('zelo_user_age'),
    scanCount:   scanCount,
    threads:     getThreads(),
    matches:     chatStore,
    exportedAt:  new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'zelo-my-data.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function confirmDeleteAccount() {
  showDeleteConfirm(
    'Deleting your account is permanent. All your data will be deleted within 30 days and cannot be recovered.',
    () => { AUTH.deleteAccount(); }
  );
}
