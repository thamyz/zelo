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
  asstStyle:      "smooth",
  asstCurrentSet: null,  // cache: tone → reply text, populated on demand
  asstMessage:    "",    // message text for the current scan
  asstContext:    "",    // scanContextString() snapshot for the current scan
  scanContext:    {},   // structured "Tell Zelo More" selections { where, who, goal, vibe }
  tzStep:         0,    // current step in the Tell Zelo More flow

  // True while the pre-filled onboarding example is still sitting in the
  // scan input untouched by the user.
  exampleScanActive: false,

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
  AUTH.init(); // session check — must run before any auth triggers fire
  // TODO — merge anonymous scan history on signup

  ensureTrialStarted();
  initScanCountForToday();
  initMatchSlots();           // Feature 7: restore expired deletion slots
  initOnboarding();
  maybePrefillExampleScan();
  refreshScanLimitBanner();
  renderThreadList();         // Feature 5: show saved threads on Scan tab
  attachProfileDetailDragToClose(); // Fix 4: swipe-down to dismiss profile detail
});


// ================================================================
// NAVIGATION — two modes
//   showTab(name)    → switch between Assistant / Practice tabs
//   pushScreen(name) → overlay a full screen (profile, chat)
//   popScreen()      → return to whichever tab was active
// ================================================================

function showTab(name) {
  if ((name === 'practice' || name === 'chats') && !AUTH.signedIn() && !tourSwitchingTab) {
    if (!DEV_MODE) AUTH.requireAuth(name, () => showTab(name));
    else showTab(name);
    return;
  }

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

  // Initialise the swipe deck whenever the practice tab becomes visible
  if (name === 'practice') initSwipeDeck();
  if (name === 'chats') renderChatsList();
  if (name === 'assistant') {
    maybeShowScanIntro();
    refreshScanLimitBanner();
  }
}

function pushScreen(name) {
  // Hide all tabs and screens
  document.querySelectorAll(".tab, .screen").forEach(el => el.classList.remove("active"));

  // Show the screen (covers everything including tab bar)
  document.getElementById("screen-" + name).classList.add("active");

  // Hide tab bar
  document.getElementById("tab-bar").classList.add("hidden");

  state.activeScreen = name;
}

function popScreen() {
  // Return to whichever tab was last active
  showTab(state.activeTab);
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
  setSendEnabled(false);
  appendAIBubble((state.character?.opener) || OPENINGS[state.difficulty] || 'hey');
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

async function _fetchAIGirlReply() {
  const systemPrompt = state.character?.systemPrompt || '';
  const chat = chatStore.find(c => c.id === state.activeChatId);
  const history = chat ? chat.messages : [];

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }))
  ];

  const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
    body: { model: 'deepseek-chat', messages, max_tokens: 200, temperature: 1.0 }
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

function openProfileDetail() {}
function closeProfileDetail() {}

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
  // Once the user edits the pre-filled example, first-run is over
  if (state.exampleScanActive && el.value !== EXAMPLE_SCAN_MESSAGE) {
    state.exampleScanActive = false;
  }
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
  state.exampleScanActive = false;
  const input = document.getElementById('asst-input');
  if (input) input.value = '';
  updateScanMessagePreview();
  // Reset Tell Zelo More sub-label
  const sub = document.getElementById('tellzelo-sub');
  if (sub) sub.textContent = 'Add details for better analysis';
  const card = document.getElementById('tellzelo-card');
  if (card) card.classList.remove('filled');
  // Reset upload row
  const thumb = document.getElementById('upload-row-thumb');
  const label = document.getElementById('upload-label-text');
  const icon  = document.getElementById('upload-icon-sm');
  const row   = document.getElementById('upload-row');
  if (thumb) { thumb.hidden = true; thumb.src = ''; }
  if (label) label.hidden = false;
  if (icon)  icon.hidden  = false;
  if (row)   row.classList.remove('has-file');
}

function updateScanMessagePreview() {
  const text    = document.getElementById("asst-input").value.trim();
  const previewEl = document.getElementById("asst-message-preview-text");
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
  state.preselectThreadId = null;
  pushScreen('scan-type');
  const input = document.getElementById('asst-input');
  requestAnimationFrame(() => {
    input.focus();
    renderScanTypeThreadPicker();
  });
}

// "Continue" / back-arrow on the typing page — saves the preview and returns.
function confirmScanType() {
  updateScanMessagePreview();
  checkGenerateReady();
  popScreen();
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
      { icon: "✨", label: "New Match" },
      { icon: "💬", label: "Talking for a While" },
      { icon: "💕", label: "Someone I'm Dating" },
      { icon: "🔄", label: "Ex" },
      { icon: "🙂", label: "Friend" },
      { icon: "💼", label: "Coworker" },
      { icon: "👋", label: "Someone I Know" },
    ],
  },
  {
    key:  "situation",
    q:    "What's going on?",
    options: [
      { icon: "👋", label: "First Conversation" },
      { icon: "📅", label: "Planning Something" },
      { icon: "😏", label: "Flirting" },
      { icon: "🌀", label: "Awkward Silence" },
      { icon: "⚡", label: "Argument" },
      { icon: "🤝", label: "Getting to Know Each Other" },
    ],
  },
  {
    key:  "goal",
    q:    "What do you want?",
    options: [
      { icon: "💬", label: "Get a Reply" },
      { icon: "🔥", label: "Keep Things Going" },
      { icon: "📅", label: "Ask Them Out" },
      { icon: "🛟", label: "Fix Things" },
      { icon: "😂", label: "Be Funny" },
      { icon: "💪", label: "Be Direct" },
    ],
  },
  {
    key:   "extra",
    q:     "Add the last bit of seasoning.",
    freeText: true,
    placeholder: "Anything extra that might help.",
  },
];

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
    ta.value       = state.scanContext[step.key] || "";
    ta.oninput     = () => {
      state.scanContext[step.key] = ta.value;
      // "Done" is always enabled on the free-text step (it's optional seasoning)
      document.getElementById("tz-next").disabled = false;
    };
    wrap.appendChild(ta);
    // Free-text step is always advanceable (it's optional)
    document.getElementById("tz-next").disabled = false;
  } else {
    // Radio-style quick-select options
    const chosen = state.scanContext[step.key];
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
    document.getElementById("tz-next").disabled = !state.scanContext[step.key];
  }
}

function tellZeloSelect(key, label) {
  state.scanContext[key] = label;
  renderTellZeloStep();
}

function tellZeloNext() {
  const step = TELLZELO_STEPS[state.tzStep];
  if (!step.freeText && !state.scanContext[step.key]) return;  // require a choice (not for free-text)

  if (state.tzStep < TELLZELO_STEPS.length - 1) {
    state.tzStep++;
    renderTellZeloStep();
  } else {
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
  const sub  = document.getElementById('tellzelo-sub');
  const card = document.getElementById('tellzelo-card');
  if (!sub || !card) return;
  const ctx = scanContextString();
  if (ctx) {
    sub.textContent = ctx;
    card.classList.add('filled');
  } else {
    sub.textContent = 'Add details for better analysis';
    card.classList.remove('filled');
  }
}

// Build a single context string for generation from the structured selections.
function scanContextString() {
  const order = ["who", "situation", "goal", "extra"];
  return order.map(k => state.scanContext[k]).filter(Boolean).join(" · ");
}

function checkGenerateReady() {
  const hasText  = document.getElementById("asst-input").value.trim().length > 0;
  const hasImage = document.getElementById("screenshot-input").files?.length > 0;
  document.getElementById("asst-generate-btn").disabled = !(hasText || hasImage);
}

// Trigger the hidden file input
function triggerUpload() {
  document.getElementById("screenshot-input").click();
}

function clearUploadedPhoto() {
  const input = document.getElementById("screenshot-input");
  if (input) input.value = "";
  handleUpload({ files: [] });
}

// Called when the user selects a file. Updates both the dropzone (its own
// page — shown as a thumbnail, no filename/label needed) and the upload
// row preview (back on the main Scan page — also just a thumbnail, no text).
function handleUpload(input) {
  const file       = input.files[0];
  const row        = document.getElementById("upload-row");
  const footer      = document.querySelector(".msg-footer");
  const labelEl     = document.getElementById("upload-label-text");
  const rowIcon     = document.getElementById("upload-icon-sm");
  const rowThumb    = document.getElementById("upload-row-thumb");
  const dropzone    = document.getElementById("scan-dropzone");
  const dzIcon      = document.getElementById("scan-dropzone-icon");
  const dzTitle     = document.getElementById("scan-dropzone-title");
  const dzSub       = document.getElementById("scan-dropzone-sub");
  const dzThumb     = document.getElementById("scan-dropzone-thumb");

  const clearBtn  = document.getElementById("scan-upload-clear-btn");
  const minusBtn  = document.getElementById("scan-photo-minus-btn");

  if (file) {
    row.classList.add("has-file");
    footer.classList.add("has-thumb");
    dropzone.classList.add("has-file");
    if (clearBtn) clearBtn.hidden = false;
    if (minusBtn) minusBtn.hidden = false;

    const reader = new FileReader();
    reader.onload = () => {
      dzThumb.src    = reader.result;
      dzThumb.hidden = false;
      // Same image, shown larger on the main Scan page row — the image
      // itself confirms the attachment, no filename text needed.
      rowThumb.src    = reader.result;
      rowThumb.hidden = false;
    };
    reader.readAsDataURL(file);

    rowIcon.hidden = true;
    dzIcon.hidden  = true;
    dzTitle.hidden = true;
    dzSub.hidden   = true;
  } else {
    labelEl.textContent = "Upload Screenshot";
    row.classList.remove("has-file");
    footer.classList.remove("has-thumb");
    dropzone.classList.remove("has-file");

    rowThumb.hidden = true;
    rowThumb.src    = "";
    rowIcon.hidden  = false;
    dzThumb.hidden = true;
    dzThumb.src    = "";
    dzIcon.hidden  = false;
    dzTitle.hidden = false;
    dzSub.hidden   = false;
    if (clearBtn) clearBtn.hidden = true;
    if (minusBtn) minusBtn.hidden = true;
  }

  checkGenerateReady();
}


// ================================================================
// ASSISTANT: DEEPSEEK API
// ================================================================

const TONE_LABELS = { smooth: 'Smooth', funny: 'Funny', flirty: 'Flirty', confident: 'Confident' };

async function _fetchDeepSeekReply(tone) {
  let userPrompt = `Message I received: "${state.asstMessage}"\nTone: ${TONE_LABELS[tone]}`;
  if (state.asstContext) userPrompt += `\nContext: ${state.asstContext}`;

  const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
    body: {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are Zelo, a witty and confident texting coach. Generate a reply to the message the user received. Keep it short, natural, and conversational — the way a real person texts. Do not use emojis unless the tone specifically calls for it.'
        },
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
// ASSISTANT: GENERATE
// ================================================================

function generateReplies() {
  document.getElementById("asst-generate-btn").classList.remove('generate-btn--bounce');

  const userInput = document.getElementById("asst-input").value.trim();
  const context   = scanContextString();
  const hasImage  = document.getElementById("screenshot-input").files?.length > 0;

  if (!userInput && !hasImage) return;

  state.scanSavedToThread = false;
  state.scanSkippedSave   = false;

  if (!isPaidUser() && scansRemainingToday() <= 0) {
    refreshScanLimitBanner();
    return;
  }

  document.getElementById("asst-preview-bubble").textContent =
    userInput || "📷 Screenshot uploaded";

  recordScan(context || userInput || "Screenshot scan");

  // The pre-filled onboarding example must not cost a scan credit — only
  // the user's own scans count against the daily limit. Captured before
  // any state changes below so it reflects this specific generate.
  const wasFirstRunScan    = isFirstRunScan();
  const isExactExampleText = userInput === EXAMPLE_SCAN_MESSAGE;
  if (!(wasFirstRunScan && isExactExampleText)) {
    decrementScanCount();
  }

  // Snapshot message + context for this scan — used by per-tone API calls
  state.asstCurrentSet = {};  // cache: tone → reply text, filled on demand
  state.asstMessage    = userInput;
  state.asstContext    = context;

  // Reset to Smooth style on each new generate
  state.asstStyle = "smooth";
  updateStylePills("smooth");

  const loading = document.getElementById("scan-result-loading");
  const content = document.getElementById("scan-result-content");
  loading.hidden = false;
  content.hidden = true;
  pushScreen("scan-result");

  // Fetch the default (Smooth) reply immediately; reveal when it arrives
  _fetchDeepSeekReply("smooth")
    .catch(() => "Couldn't reach Zelo right now. Try again.")
    .then(reply => {
      state.asstCurrentSet["smooth"] = reply;
      renderReplyCard();
      loading.hidden = true;
      content.hidden = false;
      _onReplyRevealed(wasFirstRunScan, isExactExampleText);
    });
}

// Runs once per scan after the first reply is revealed.
function _onReplyRevealed(wasFirstRunScan, isExactExampleText) {
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
    const preMsg   = document.getElementById('asst-preview-bubble').textContent;
    const preReply = document.getElementById('reply-text').textContent;
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

  // Exactly one of two mutually exclusive prompts: "Your turn. Type
  // anything." shows once, on the result screen for the first-run
  // pre-populated message, and never again after that — even if the user
  // backs out without tapping "Got it". So the completion flag is marked
  // the moment this result is shown, not on dismissal. Every subsequent
  // result instead gets the plain "Go back" nav hint.
  const promptEl = document.getElementById("scan-post-result-prompt");
  if (wasFirstRunScan && isExactExampleText) {
    promptEl.innerHTML = `
      <div class="example-banner">
        <span>Your turn. Type anything.</span>
        <button type="button" onclick="dismissExampleScan()">Got it</button>
      </div>`;
    localStorage.setItem('zelo_scan_first_run', 'true');
  } else {
    if (wasFirstRunScan) {
      state.exampleScanActive = false;
      localStorage.setItem('zelo_scan_first_run', 'true');
    }
    promptEl.innerHTML = `
      <button type="button" class="scan-back-hint" onclick="goBackFromResult()">
        <span class="scan-back-hint-arrow" aria-hidden="true">↩</span>
        <span>Go back</span>
      </button>`;
  }
  promptEl.hidden = false;
}

// Clears the pre-filled onboarding example so the next scan is the user's own.
// zelo_scan_first_run is already marked complete by the time this runs (see
// generateReplies' result-reveal step) — this just resets the input/UI.
function dismissExampleScan() {
  const promptEl = document.getElementById("scan-post-result-prompt");
  promptEl.hidden = true;
  promptEl.innerHTML = "";
  clearScanInput();
  checkGenerateReady();
  popScreen();
}

// True only while the pre-filled example is still sitting in the scan input,
// untouched and not yet dismissed — backed by zelo_scan_first_run so a stale
// in-memory flag can never re-grant a free scan after completion.
function isFirstRunScan() {
  if (localStorage.getItem('zelo_scan_first_run') === 'true') return false;
  return state.exampleScanActive === true;
}


// ================================================================
// ASSISTANT: SELECT STYLE
// Called when user taps a style pill. Updates the single card.
// ================================================================

function selectStyle(style) {
  if (!state.asstCurrentSet) return;  // nothing generated yet

  if (isToneLocked(style)) {
    const pill = document.querySelector(`.style-pill[data-style="${style}"]`);
    if (pill) {
      pill.classList.add('locked-tap');
      setTimeout(() => pill.classList.remove('locked-tap'), 260);
    }
    return;
  }

  state.asstStyle = style;
  updateStylePills(style);

  if (state.asstCurrentSet[style]) {
    // Already cached — render immediately, no usage charge
    renderReplyCard();
  } else {
    // Gate: new tone fetch counts against the shared daily limit
    if (!isPaidUser() && scansRemainingToday() <= 0) {
      refreshScanLimitBanner();
      return;
    }
    // Show placeholder while fetching
    document.getElementById("reply-text").textContent = "…";
    decrementScanCount();
    _fetchDeepSeekReply(style)
      .catch(() => "Couldn't reach Zelo right now. Try again.")
      .then(reply => {
        state.asstCurrentSet[style] = reply;
        if (state.asstStyle === style) renderReplyCard();
      });
  }
}

function updateStylePills(activeStyle) {
  document.querySelectorAll(".style-pill").forEach(pill => {
    pill.classList.toggle("active", pill.dataset.style === activeStyle);
    pill.classList.toggle("locked", isToneLocked(pill.dataset.style));
  });
}

// Free users only get Smooth + Funny — Flirty/Confident stay visible but locked.
function isToneLocked(style) {
  return !isPaidUser() && !FREE_LIMITS.freeTones.includes(style);
}

// Renders/updates the single reply card with the current style's text.
// The card header is now a static "Zelo Suggests" label — it no longer
// swaps per style, since the style pills below already show the choice.
function renderReplyCard() {
  const set   = state.asstCurrentSet;
  const style = state.asstStyle;
  const text  = set[style];

  document.getElementById("reply-text").textContent = text;

  // Reset copy button
  const copyBtn = document.getElementById("copy-btn");
  document.getElementById("copy-btn-label").textContent = "Copy";
  copyBtn.classList.remove("copied");

  // Re-trigger the card pop animation
  const card = document.getElementById("reply-card");
  card.style.animation = "none";
  card.offsetHeight;          // force reflow
  card.style.animation = "";
}


// ================================================================
// ASSISTANT: COPY REPLY
// ================================================================

function copyCurrentReply() {
  const text  = document.getElementById("reply-text").textContent;
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


// ================================================================
// ONBOARDING
// ================================================================

let onboardingSlide = 0;
const ONBOARDING_TOTAL = 3;
let threadEditMode = false;

let _obTypeTimer = null;
let _obTyping    = false;
let _obTextReady = false;

function _obType(titleEl, descEl, titleText, descText) {
  _obTyping = true;
  _obTextReady = false;
  if (_obTypeTimer) clearTimeout(_obTypeTimer);
  titleEl.textContent = '';
  descEl.textContent  = '';
  let i = 0;
  const total = titleText.length + 1 + descText.length;
  function tick() {
    if (i < titleText.length) {
      titleEl.textContent = titleText.slice(0, ++i);
      navigator.vibrate?.(1);
      _obTypeTimer = setTimeout(tick, 32);
    } else if (i === titleText.length) {
      i++;
      _obTypeTimer = setTimeout(tick, 180);
    } else {
      const di = i - titleText.length - 1;
      if (di < descText.length) {
        descEl.textContent = descText.slice(0, di + 1);
        i++;
        navigator.vibrate?.(1);
        _obTypeTimer = setTimeout(tick, 28);
      } else {
        _obTyping = false;
        _obTextReady = true;
        _obTypeTimer = null;
        navigator.vibrate?.(10);
      }
    }
  }
  tick();
}

function _obRevealAll(titleEl, descEl, titleText, descText) {
  if (_obTypeTimer) { clearTimeout(_obTypeTimer); _obTypeTimer = null; }
  _obTyping = false;
  _obTextReady = true;
  titleEl.textContent = titleText;
  descEl.textContent  = descText;
}

function onboardingTap(e) {
  if (e && e.target.closest('.onboarding-close-btn')) return;
  const slide = document.querySelectorAll('.onboarding-slide')[onboardingSlide];
  if (!slide) { onboardingNext(); return; }
  const titleEl = slide.querySelector('.onboarding-title');
  const descEl  = slide.querySelector('.onboarding-desc');
  if (_obTyping) {
    _obRevealAll(titleEl, descEl,
      titleEl.dataset.full || titleEl.textContent,
      descEl.dataset.full  || descEl.textContent);
  } else if (_obTextReady) {
    onboardingNext();
  }
}

function initOnboarding() {
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.style.display = 'none';
  initChatsTab();

  if (localStorage.getItem('zelo_onboarding_done')) {
    const el = document.getElementById('onboarding');
    if (el) el.setAttribute('hidden', '');
    startTour();
    return;
  }

  onboardingSlide = 0;
  showOnboardingSlide(0);
}

function showOnboardingSlide(index) {
  document.querySelectorAll('.onboarding-slide').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  document.querySelectorAll('.onboarding-dot').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  const fill = document.getElementById('onboarding-progress-fill');
  if (fill) fill.style.width = ((index + 1) / ONBOARDING_TOTAL * 100) + '%';
  const btn = document.querySelector('.onboarding-btn');
  if (btn) btn.textContent = (index === ONBOARDING_TOTAL - 1) ? 'Get Started' : 'Next';
}

function onboardingNext() {
  if (onboardingSlide < ONBOARDING_TOTAL - 1) {
    onboardingSlide++;
    showOnboardingSlide(onboardingSlide);
  } else {
    finishOnboarding();
  }
}

function finishOnboarding() {
  localStorage.setItem('zelo_onboarding_done', '1');
  const overlay = document.getElementById('onboarding');
  overlay.classList.add('hidden');
  setTimeout(() => { overlay.setAttribute('hidden', ''); overlay.classList.remove('hidden'); }, 300);
  startTour();
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
// GUIDED SPOTLIGHT TOUR  (one continuous journey: Scan → Home → Chats)
// Every step uses the SAME language: spotlight cutout, dimmed
// background, anchored callout with a pointer arrow. The Scan steps
// keep the real UI live (typing/tapping the target advances). The
// Home / Chats / completion steps are purposeful overviews — the
// background is blocked so a stray swipe can't fire, and the user
// moves on with Next.
//
//   tab       → which app tab the step lives on (engine switches to it)
//   act       → 'input' | 'click' makes the live target auto-advance
//   secondary → calmer visual (lower-priority step)
//   dwell     → ms the step "settles" before it accepts advancing
//   final     → the completion step (button reads "Get Started")
// ================================================================

//   kicker    → small branded label at the top of the card (e.g. "Scan")
//   swipe     → Home step: shows a swipe hint; a real swipe advances
//   tapTarget → a transparent hit sits over the target; tapping it advances
//   round     → spotlight is circular (for the round Scan/FAB buttons)
//   expand    → Situation step: auto-demos the collapse→expand interaction
const TOUR_STEPS = [
  // — SCAN —
  { tab: 'assistant', sel: '#asst-message-preview', kicker: 'Scan', text: 'Paste their message here.' },
  { tab: 'assistant', sel: '#asst-message-preview', kicker: 'Scan', text: 'Who are you texting? What happened? What do you want?', secondary: true },
  { tab: 'assistant', sel: '#tellzelo-card', kicker: 'Scan', text: 'Add a little context.' },
  { tab: 'assistant', sel: '#upload-row', kicker: 'Scan', text: 'Or just drop a screenshot.', secondary: true },
  { tab: 'assistant', sel: '#asst-generate-btn', kicker: 'Scan', text: 'Hit generate for your reply.' },
  // — HOME —
  { tab: 'practice',  sel: '#tabbtn-practice', kicker: 'Home', text: 'This is Home — meet new people here.' },
  { tab: 'practice',  sel: '#card-deck', kicker: 'Home', text: 'Browse profiles and find someone to chat with.' },
  { tab: 'practice',  sel: '#card-deck', swipeDir: 'right', kicker: 'Home', text: 'Swipe right to like.' },
  { tab: 'practice',  sel: '#card-deck', swipeDir: 'left',  kicker: 'Home', text: 'Now swipe left to pass.' },
  // — CHATS —
  { tab: 'chats',     sel: '#tabbtn-chats', kicker: 'Chats', text: 'This is Chats — where your conversations live.' },
  { tab: 'chats',     sel: '#chats-list', selFallback: '#chats-empty', kicker: 'Chats', text: 'Matches show up here. Jump back in anytime.' },
  // — FINISH —
  { tab: 'assistant', sel: '.scan-fab', round: true, kicker: 'All set', text: "You've got it from here.", last: true },
];

const TOUR_ARM_DEFAULT = 2000;   // fallback dwell if a step omits one

let tourIndex       = 0;
let tourArmed       = false;
let tourArmTimer    = null;
let tourStepBinding = null;
let tourScrollEl    = null;
let tourSwitchingTab = false;
let tourSwipeArmed  = false;
let tourSwipeDir    = null;
let tourDemoTimeout = null;
let _tourTypeTimer  = null;
let _tourTyping     = false;
let _tourTextReady  = false;

function _tourType(text) {
  _tourTyping = true;
  _tourTextReady = false;
  if (_tourTypeTimer) clearTimeout(_tourTypeTimer);
  const el = document.getElementById('tour-text');
  el.textContent = '';
  el.classList.add('tour-text--entering');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.remove('tour-text--entering');
      let i = 0;
      function tick() {
        if (i < text.length) {
          el.textContent = text.slice(0, ++i);
          navigator.vibrate?.(1);
          _tourTypeTimer = setTimeout(tick, 32);
        } else {
          _tourTyping = false;
          _tourTextReady = true;
          _tourTypeTimer = null;
          navigator.vibrate?.(10);
        }
      }
      tick();
    });
  });
}

function _tourRevealAll() {
  if (_tourTypeTimer) { clearTimeout(_tourTypeTimer); _tourTypeTimer = null; }
  _tourTyping = false;
  _tourTextReady = true;
  const el = document.getElementById('tour-text');
  if (el) el.textContent = TOUR_STEPS[tourIndex].text;
}

function tourTooltipTap(e) {
  if (e.target.closest('.tour-close-btn, .tour-back')) return;
  const step = TOUR_STEPS[tourIndex];
  if (!step) return;
  if (_tourTyping) {
    _tourRevealAll();
  } else if (_tourTextReady) {
    goNextStep();
  }
}

function tourBackdropTap(e) {
  tourTooltipTap(e);
}

function startTour() {
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.style.display = '';
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) { entry.hidden = false; return; }
  _launchTour();
}

function tourEntryYes() {
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) entry.hidden = true;
  _launchTour();
}

function tourEntryNo() {
  const entry = document.getElementById('tour-entry-overlay');
  if (entry) entry.hidden = true;
  maybeShowScanIntro();
}

function _launchTour() {
  tourIndex = 0;
  const tour = document.getElementById('tour');
  tour.hidden = false;
  renderTourStep(0);
}

// Resolve a step's element, falling back when the primary target is absent or
// collapsed (e.g. an empty Chats list on a brand-new account).
function resolveStepEl(step) {
  let el = document.querySelector(step.sel);
  if ((!el || el.getBoundingClientRect().height < 8) && step.selFallback) {
    const fb = document.querySelector(step.selFallback);
    if (fb) el = fb;
  }
  return el;
}

function renderTourStep(i) {
  const step = TOUR_STEPS[i];

  clearStepBinding();
  unbindTourReposition();
  cancelSwipeDemo();
  cancelSituationDemo();

  // Move to the step's tab without ending the tour, then re-track that tab's
  // scroll container for repositioning.
  if (step.tab && state.activeTab !== step.tab) {
    tourSwitchingTab = true;
    showTab(step.tab);
    tourSwitchingTab = false;
  }
  tourScrollEl = document.getElementById('tab-' + (step.tab || state.activeTab));
  if (tourScrollEl) tourScrollEl.scrollTop = 0;
  bindTourReposition();

  const tour = document.getElementById('tour');

  // Card content + branded header
  document.getElementById('tour-kicker').textContent = step.kicker || 'Zelo';
  _tourType(step.text);
  document.getElementById('tour-back').hidden = (i === 0);
  tour.classList.toggle('tour--secondary', !!step.secondary);
  tour.classList.toggle('tour--final', !!step.last);
  const gsBtn = document.getElementById('tour-get-started');
  if (gsBtn) gsBtn.hidden = !step.last;

  const live = !!step.act || !!step.swipeDir || !!step.expand;
  const backdrop = document.getElementById('tour-backdrop');
  if (backdrop) backdrop.style.pointerEvents = 'auto';
  tourSwipeArmed = !!step.swipeDir;
  tourSwipeDir   = step.swipeDir || null;

  if (step.expand) closeSituation();

  document.getElementById('tour-spotlight').style.borderRadius = step.round ? '50%' : '';
  const hit = document.getElementById('tour-hit');
  hit.hidden = !step.tapTarget;
  hit.dataset.active = step.tapTarget ? '1' : '0';

  const el = resolveStepEl(step);
  if (!el) { endTour(); return; }

  // Bring the target into view, then measure after layout has committed.
  el.scrollIntoView({ block: 'center', behavior: 'auto' });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    positionTour(el, i === 0);                  // snap (no transition) on the first step
    if (step.act) bindStepTarget(el, step.act); // typing/tapping the real element advances
    if (step.swipeDir) runSwipeDemo(step.swipeDir); // the card itself shows the move
    if (step.expand) runSituationDemo();        // show the collapse → expand interaction
  }));
}

function positionTour(el, snap) {
  // All coordinates are relative to #app so the tour stays anchored inside
  // the phone frame on desktop and the full screen on mobile.
  const appRect = document.getElementById('app').getBoundingClientRect();
  const rect    = el.getBoundingClientRect();

  const spotlight = document.getElementById('tour-spotlight');
  const tooltip   = document.getElementById('tour-tooltip');

  // On the first step there is no previous position to glide from, so snap
  // straight to the target instead of sweeping in from the top-left corner.
  if (snap) {
    spotlight.style.transition = 'none';
    tooltip.style.transition   = 'none';
  }

  const pad  = 6;
  const top  = rect.top  - appRect.top;
  const left = rect.left - appRect.left;

  // Spotlight cutout around the element
  spotlight.style.top    = (top  - pad) + 'px';
  spotlight.style.left   = (left - pad) + 'px';
  spotlight.style.width  = (rect.width  + pad * 2) + 'px';
  spotlight.style.height = (rect.height + pad * 2) + 'px';

  // Keep the tap-target proxy aligned with the cutout, when active
  const hit = document.getElementById('tour-hit');
  if (hit && hit.dataset.active === '1') {
    hit.style.top    = (top  - pad) + 'px';
    hit.style.left   = (left - pad) + 'px';
    hit.style.width  = (rect.width  + pad * 2) + 'px';
    hit.style.height = (rect.height + pad * 2) + 'px';
  }

  // Tooltip: below the element unless there isn't room inside the app.
  // Use the CSS max-width (250px) as the assumed width — tipRect.width is
  // measured while the typewriter has cleared the text, so it underestimates
  // the final rendered width and would allow right-edge overflow once text
  // fills in. Similarly pad the height estimate so the placeAbove decision
  // doesn't flip incorrectly when text hasn't typed yet.
  const gap       = 16;
  const margin    = 14;
  const tipRect   = tooltip.getBoundingClientRect();
  const assumedW  = 250;                              // matches CSS max-width
  const assumedH  = Math.max(tipRect.height, 120);   // conservative when empty

  const spaceBelow = appRect.height - (top + rect.height);
  const placeAbove = spaceBelow < assumedH + gap + 24;

  tooltip.classList.toggle('above', placeAbove);

  let tipTop = placeAbove
    ? top - pad - gap - assumedH
    : top + rect.height + pad + gap;

  // Clamp all four edges inside the app
  tipTop  = Math.max(margin, Math.min(tipTop,  appRect.height - assumedH - margin));
  let tipLeft = left;
  tipLeft = Math.max(margin, Math.min(tipLeft, appRect.width  - assumedW - margin));

  tooltip.style.top  = tipTop  + 'px';
  tooltip.style.left = tipLeft + 'px';

  // Restore transitions after the snap so subsequent steps glide.
  if (snap) {
    spotlight.offsetHeight;   // force reflow to lock in the snapped position
    spotlight.style.transition = '';
    tooltip.style.transition   = '';
  }
}

// Wire the live target so typing/tapping it advances — the user is touching
// the real UI, not a slideshow. Guarded by the arm flag so a stray tap as the
// step appears can't skip ahead.
function bindStepTarget(el, evt) {
  const handler = () => { goNextStep(); };
  el.addEventListener(evt, handler);
  tourStepBinding = { el, evt, handler };
}

function clearStepBinding() {
  if (!tourStepBinding) return;
  const { el, evt, handler } = tourStepBinding;
  el.removeEventListener(evt, handler);
  tourStepBinding = null;
}

// The Next/Done button doubles as the "settling" indicator: a subtle fill
// sweeps across it, and only once full does the step accept advancing. No
// numbers, no countdown — it just looks like the button is settling in.
function armTourButton(dwell) {
  tourArmed = false;
  clearTimeout(tourArmTimer);

  // Stretch the fill to the full dwell so the button visibly settles in over
  // ~2s. Premium easing (not linear) makes it feel intentional, not a timer.
  const fill = document.getElementById('tour-next-fill');
  fill.style.animation = 'none';
  fill.offsetHeight;                 // reflow cancels the previous run
  fill.style.animation = `tourFill ${dwell}ms cubic-bezier(0.33, 0, 0.2, 1) forwards`;

  tourArmTimer = setTimeout(() => { tourArmed = true; }, dwell);
}

// Forward progression. tourAdvance is the arm-gated path (Next button, target
// tap, input); goNextStep is the unguarded mover the guided swipe uses.
function tourAdvance() {
  if (!tourArmed) return;
  goNextStep();
}

function goNextStep() {
  _tourRevealAll();
  clearStepBinding();
  if (tourIndex >= TOUR_STEPS.length - 1) {
    endTour();
  } else {
    tourIndex++;
    renderTourStep(tourIndex);
  }
}

function tourBack() {
  if (tourIndex <= 0) return;
  _tourRevealAll();
  clearStepBinding();
  tourIndex--;
  renderTourStep(tourIndex);
}

// Completion: collapse the cutout to a point (its shadow dims everything) and
// center the branded card — no element to anchor to.
function positionFinal() {
  const appRect   = document.getElementById('app').getBoundingClientRect();
  const spotlight = document.getElementById('tour-spotlight');
  const tooltip   = document.getElementById('tour-tooltip');

  spotlight.style.width  = '0';
  spotlight.style.height = '0';
  spotlight.style.top    = (appRect.height / 2) + 'px';
  spotlight.style.left   = (appRect.width  / 2) + 'px';

  const tipRect = tooltip.getBoundingClientRect();
  tooltip.classList.remove('above');
  tooltip.style.left = Math.round((appRect.width  - tipRect.width)  / 2) + 'px';
  tooltip.style.top  = Math.round((appRect.height - tipRect.height) / 2) + 'px';
}

// The CARD is the instructor: gently slide the top card the way the user should
// swipe, surface its like/pass stamp + a big heart/X, then let it spring back to
// center. No arrows — the motion itself shows what the gesture does.
function runSwipeDemo(direction) {
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (!top) return;

  const dx    = direction === 'right' ? 96 : -96;
  const rot   = direction === 'right' ? 9  : -9;
  const stamp = top.querySelector(direction === 'right' ? '.swipe-stamp--like' : '.swipe-stamp--nope');

  top.style.transition = 'transform 0.55s cubic-bezier(0.33, 0, 0.2, 1)';
  top.style.transform  = `translate(${dx}px, 0) rotate(${rot}deg)`;
  if (stamp) stamp.style.opacity = '1';
  flashSwipeFeedback(direction);

  tourDemoTimeout = setTimeout(() => {
    top.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    top.style.transform  = '';
    if (stamp) stamp.style.opacity = '0';
  }, 720);
}

function cancelSwipeDemo() {
  clearTimeout(tourDemoTimeout);
  tourDemoTimeout = null;
  const top = document.querySelector('#card-deck [data-stack="0"]');
  if (top) {
    top.style.transition = '';
    top.style.transform  = '';
    top.querySelectorAll('.swipe-stamp').forEach(s => s.style.opacity = '0');
  }
}

// Situation step: start collapsed, then auto-expand so the user SEES the
// tap-to-open interaction. The spotlight glides to the taller, expanded row.
let tourSituationTimeout = null;
function runSituationDemo() {
  clearTimeout(tourSituationTimeout);
  tourSituationTimeout = setTimeout(() => {
    openSituation();
    tourSituationTimeout = setTimeout(() => {
      const el = document.getElementById('situation');
      if (el && !document.getElementById('tour').hidden) positionTour(el, false); // animate growth
    }, 360);
  }, 700);
}

function cancelSituationDemo() {
  clearTimeout(tourSituationTimeout);
  tourSituationTimeout = null;
}

// Big heart / X that pops over the card on a guided swipe — confirms meaning
// through motion (green like, red pass) without extra words.
function flashSwipeFeedback(direction) {
  const fb = document.getElementById('tour-swipe-feedback');
  if (!fb) return;
  const appRect = document.getElementById('app').getBoundingClientRect();
  const deck    = document.getElementById('card-deck') || document.getElementById('app');
  const r       = deck.getBoundingClientRect();
  fb.textContent = direction === 'right' ? '♥' : '✕';
  fb.className   = 'tour-swipe-feedback ' + (direction === 'right' ? 'like' : 'nope');
  fb.style.left  = (r.left - appRect.left + r.width / 2) + 'px';
  fb.style.top   = (r.top  - appRect.top  + r.height / 2) + 'px';
  fb.hidden = false;
  fb.style.animation = 'none';
  fb.offsetHeight;                 // restart the pop each time
  fb.style.animation = '';
  clearTimeout(fb._hideTimer);
  fb._hideTimer = setTimeout(() => { fb.hidden = true; }, 650);
}

function endTour() {
  if (_tourTypeTimer) { clearTimeout(_tourTypeTimer); _tourTypeTimer = null; }
  _tourTyping = false;
  clearStepBinding();
  clearTimeout(tourArmTimer);
  unbindTourReposition();
  cancelSwipeDemo();
  cancelSituationDemo();
  tourSwipeArmed = false;
  tourSwipeDir   = null;
  const tour = document.getElementById('tour');
  tour.hidden = true;
  tour.classList.remove('tour--secondary', 'tour--final');
  const hit = document.getElementById('tour-hit');
  if (hit) { hit.hidden = true; hit.dataset.active = '0'; }
  maybeShowScanIntro();
}

// Keep the current step glued to its target while the window resizes or the
// Scan content scrolls. Snap (no transition) so the spotlight tracks 1:1.
function repositionTour() {
  const tour = document.getElementById('tour');
  if (!tour || tour.hidden) return;
  const el = resolveStepEl(TOUR_STEPS[tourIndex]);
  if (el) positionTour(el, true);
}

function bindTourReposition() {
  window.addEventListener('resize', repositionTour);
  if (tourScrollEl) tourScrollEl.addEventListener('scroll', repositionTour, { passive: true });
}

function unbindTourReposition() {
  window.removeEventListener('resize', repositionTour);
  if (tourScrollEl) tourScrollEl.removeEventListener('scroll', repositionTour);
}


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

// Scan counter persists across visits; history is per-session (mock-seeded)
let scanCount = parseInt(localStorage.getItem('zelo_scans') || '12', 10);

let scanHistory = [
  { text: "hey stranger, long time no see 😅", time: Date.now() - 2 * 60 * 60 * 1000 },
  { text: "so what do you actually do for fun?", time: Date.now() - 24 * 60 * 60 * 1000 }
];

function recordScan(text) {
  const short = text.length > 64 ? text.slice(0, 64) + '…' : text;
  scanHistory.unshift({ text: short, time: Date.now() });
  if (scanHistory.length > 50) scanHistory.pop();  // generous cap; the 7-day filter does the real trimming for free users
  scanCount++;
  localStorage.setItem('zelo_scans', scanCount);
}

// Relative label for dashboard scan rows ("just now", "2h ago", "3d ago"...)
function relativeTime(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Free users only see the last 7 days of scan history.
function visibleScanHistory() {
  if (isPaidUser()) return scanHistory;
  const cutoff = Date.now() - FREE_LIMITS.historyDays * 24 * 60 * 60 * 1000;
  return scanHistory.filter(s => s.time >= cutoff);
}

function openDashboard() {
  // Stats
  document.getElementById('stat-scans').textContent   = scanCount;
  document.getElementById('stat-matches').textContent = chatStore.length;
  document.getElementById('stat-chats').textContent   =
    chatStore.filter(c => c.messages.length > 0).length;

  // Recent scans — free users only see the last 7 days
  const scansEl = document.getElementById('dash-recent-scans');
  scansEl.innerHTML = '';
  const recentScans = visibleScanHistory();
  if (recentScans.length === 0) {
    scansEl.innerHTML = '<p class="dash-empty">No scans yet</p>';
  } else {
    recentScans.slice(0, 3).forEach(s => {
      const row = document.createElement('div');
      row.className = 'dash-scan-row';
      const textEl = document.createElement('span');
      textEl.className = 'dash-scan-text';
      textEl.textContent = s.text;
      const timeEl = document.createElement('span');
      timeEl.className = 'dash-scan-time';
      timeEl.textContent = relativeTime(s.time);
      row.appendChild(textEl);
      row.appendChild(timeEl);
      scansEl.appendChild(row);
    });
  }

  // Recent matches
  const matchesEl = document.getElementById('dash-recent-matches');
  matchesEl.innerHTML = '';
  if (chatStore.length === 0) {
    matchesEl.innerHTML = '<p class="dash-empty">No matches yet</p>';
  } else {
    chatStore.slice(0, 4).forEach(c => {
      const item = document.createElement('div');
      item.className = 'dash-match';
      item.onclick = () => openChatFromStore(c);
      const grad = `linear-gradient(145deg, ${c.profile.gradientColors[0]}, ${c.profile.gradientColors[1]})`;
      item.innerHTML = `
        <div class="dash-match-avatar" style="background:${grad}">${c.profile.initial}</div>
        <span class="dash-match-name">${c.profile.name}</span>`;
      matchesEl.appendChild(item);
    });
  }

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
// ONBOARDING: PRE-FILLED EXAMPLE SCAN
// First-ever app open only — pre-populates the scan input so Generate
// is already active without the user typing anything.
// ================================================================

function maybePrefillExampleScan() {
  // One-time migration: an earlier version set zelo_example_prefilled before
  // the prefill actually ran, permanently blocking it even for users who
  // never completed the first-run scan. Recover the intended experience for
  // anyone still mid-onboarding, without affecting users who already did.
  if (localStorage.getItem('zelo_example_prefilled') && localStorage.getItem('zelo_scan_first_run') !== 'true') {
    localStorage.removeItem('zelo_example_prefilled');
  }

  if (localStorage.getItem('zelo_example_prefilled')) return;

  const input = document.getElementById('asst-input');
  input.value = EXAMPLE_SCAN_MESSAGE;
  state.exampleScanActive = true;
  updateScanMessagePreview();
  checkGenerateReady();

  // Draws the eye to Generate while the example is sitting there untapped.
  // Stopped the moment Generate is tapped (see generateReplies()) and never
  // applied again on later visits or for user-typed messages.
  document.getElementById('asst-generate-btn').classList.add('generate-btn--bounce');

  localStorage.setItem('zelo_example_prefilled', '1');
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
  renderThreadList();
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

function renderThreadList() {
  const listEl = document.getElementById('thread-list');
  if (!listEl) return;

  // Edit button is always visible regardless of thread count
  const editBtnEl = document.getElementById('thread-edit-btn');
  if (editBtnEl) editBtnEl.hidden = false;

  const threads = getThreads();
  listEl.innerHTML = '';

  if (threads.length === 0) {
    if (threadEditMode) {
      const newBtn = document.createElement('button');
      newBtn.className = 'thread-edit-new-btn';
      newBtn.textContent = '+ New';
      newBtn.onclick = openAddThread;
      listEl.appendChild(newBtn);
      const btn = document.getElementById('thread-edit-btn');
      if (btn) btn.textContent = 'Done';
    } else {
      const label = document.createElement('p');
      label.className = 'thread-empty-label';
      label.textContent = 'No threads yet.';
      listEl.appendChild(label);
    }
    return;
  }

  threads.forEach(thread => {
    const wrapper = document.createElement('div');
    wrapper.className = 'thread-row-wrapper';

    const row = document.createElement('div');
    row.className = 'thread-row';

    const info = document.createElement('div');
    info.className = 'thread-row-info';
    info.innerHTML = `
      <span class="thread-row-name">${thread.name}</span>
      <span class="thread-row-count">${thread.scans.length} scan${thread.scans.length !== 1 ? 's' : ''}</span>`;
    row.appendChild(info);

    if (threadEditMode) {
      const minus = document.createElement('button');
      minus.className = 'thread-row-minus-btn';
      minus.textContent = '−';
      minus.addEventListener('click', (e) => {
        e.stopPropagation();
        _showThreadRowDelete(wrapper, thread.id);
      });
      row.appendChild(minus);
    }

    if (!threadEditMode) {
      const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      chevron.setAttribute('width', '14');
      chevron.setAttribute('height', '14');
      chevron.setAttribute('viewBox', '0 0 24 24');
      chevron.setAttribute('fill', 'none');
      chevron.setAttribute('stroke', 'currentColor');
      chevron.setAttribute('stroke-width', '2.5');
      chevron.setAttribute('stroke-linecap', 'round');
      chevron.setAttribute('stroke-linejoin', 'round');
      chevron.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
      row.appendChild(chevron);
      row.onclick = () => openThreadDetail(thread.id);
    }

    wrapper.appendChild(row);
    listEl.appendChild(wrapper);

    if (!threadEditMode) {
      attachSwipeDelete(row, 'Delete this thread? This cannot be undone.', () => deleteThread(thread.id));
    }
  });

  if (threadEditMode) {
    const newBtn = document.createElement('button');
    newBtn.className = 'thread-edit-new-btn';
    newBtn.textContent = '+ New';
    newBtn.onclick = openAddThread;
    listEl.appendChild(newBtn);
  }
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
            const message = document.getElementById('asst-preview-bubble').textContent;
            const reply   = document.getElementById('reply-text').textContent;
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
        const message = document.getElementById('asst-preview-bubble').textContent;
        const reply   = document.getElementById('reply-text').textContent;
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
      const message = document.getElementById('asst-preview-bubble').textContent;
      const reply   = document.getElementById('reply-text').textContent;
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
  const message = document.getElementById('asst-preview-bubble').textContent;
  const reply   = document.getElementById('reply-text').textContent;
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

  const message = document.getElementById('asst-preview-bubble').textContent;
  const reply   = document.getElementById('reply-text').textContent;
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

  state.activeThreadId = threadId;
  state.threadChat     = thread.chat || [];
  state.scanEditMode   = false;

  document.getElementById('thread-detail-name').textContent = thread.name;
  const editBtn = document.getElementById('scan-edit-btn');
  const toolbar = document.getElementById('scan-edit-toolbar');
  if (editBtn) { editBtn.textContent = 'Edit'; }
  if (toolbar) toolbar.hidden = true;

  _renderThreadScans();
  renderThreadChat();
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
  popScreen();
}


// ================================================================
// FEATURE 6 — ASK ZELO INSIDE THREAD
// DeepSeek API call with full thread context. 7 AI msgs/day free.
// ================================================================

function aiMsgsToday() {
  if (localStorage.getItem('zelo_ai_msg_date') !== todayKey()) return 0;
  return Number(localStorage.getItem('zelo_ai_msg_count') || 0);
}
function incrementAiMsgCount() {
  if (localStorage.getItem('zelo_ai_msg_date') !== todayKey()) {
    localStorage.setItem('zelo_ai_msg_date', todayKey());
    localStorage.setItem('zelo_ai_msg_count', '0');
  }
  localStorage.setItem('zelo_ai_msg_count', String(aiMsgsToday() + 1));
}

function renderThreadChat() {
  const chatWrap = document.getElementById('thread-chat-messages');
  if (!chatWrap) return;
  chatWrap.innerHTML = '';
  state.threadChat.forEach(msg => {
    const el = document.createElement('div');
    el.className = `thread-chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`;
    el.textContent = msg.content;
    chatWrap.appendChild(el);
  });
  chatWrap.scrollTop = chatWrap.scrollHeight;
}

function handleThreadKeyDown(e) {
  if (e.key === 'Enter') sendThreadMessage();
}

async function sendThreadMessage() {
  const input = document.getElementById('thread-message-input');
  const text  = input.value.trim();
  if (!text || !state.activeThreadId) return;

  // DEV — restore paid gate before release
  if (!isPaidUser() && aiMsgsToday() >= 7) {
    const feedback = document.getElementById('thread-ai-limit');
    if (feedback) { feedback.hidden = false; return; }
  }

  input.value = '';
  state.threadChat.push({ role: 'user', content: text });
  renderThreadChat();
  incrementAiMsgCount();

  // Build system prompt from thread context
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.activeThreadId);
  const context = (thread ? thread.scans : []).map((s, i) =>
    `Scan ${i + 1}:\nMessage: ${s.message}\nReply used: ${s.reply}`
  ).join('\n\n');

  const systemPrompt = `You are Zelo, a witty and warm texting coach. The user is asking for advice about their conversation with ${thread ? thread.name : 'someone'}.\n\nConversation history:\n${context || 'No scans yet.'}\n\nGive concise, practical advice in 1-3 sentences. Stay casual and direct.`;

  // Placeholder bubble while waiting
  const placeholder = { role: 'assistant', content: '…' };
  state.threadChat.push(placeholder);
  renderThreadChat();

  try {
    const { data, error } = await zeloSupabase.functions.invoke('deepseek-proxy', {
      body: {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...state.threadChat.filter(m => m !== placeholder).map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 200
      }
    });
    if (error) throw error;
    placeholder.content = data.choices[0].message.content;
  } catch {
    placeholder.content = "Hmm, I couldn't reach Zelo right now. Try again in a moment.";
  }

  // Persist chat back to thread store
  const threads2 = getThreads();
  const t2 = threads2.find(t => t.id === state.activeThreadId);
  if (t2) { t2.chat = state.threadChat; saveThreads(threads2); }

  renderThreadChat();
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

function renderLeaderboard() {
  const data       = getLbData(lbTimeFilter, lbCategory);
  const myName     = getDisplayName();
  const myEntry    = data.find(e => e.name === myName) || { rank: data.length + 1, name: myName, score: 0 };

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
