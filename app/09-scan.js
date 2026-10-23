// ================================================================
// 09-scan.js — Scan: from her message to a generated reply
//
// The match overlay, the scan input, Tell Zelo More, reading a screenshot
// via openai-proxy, which styles are allowed for a situation, the DeepSeek
// call, the gibberish guard, and generateReplies() that drives it all.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// MATCH OVERLAY
// ================================================================

function showMatchOverlay(profile) {
  // Populate match screen with this profile's details
  document.getElementById('match-name').textContent = profile.name;

  const avatarThem = document.getElementById('match-avatar-them');
  avatarThem.style.background = `linear-gradient(145deg, ${profile.gradientColors[0]}, ${profile.gradientColors[1]})`;
  avatarThem.innerHTML        = `${profile.initial}${_pfpImgHTML(profile)}`;

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
  saveChats();

  pushScreen('match');

  // A fast/long swipe can already carry the card fully off-screen before
  // commitSwipe()'s own fly-off transition even starts (see that function's
  // comment) — so the plain instant screen fade this used to rely on was
  // the only motion left to see, and barely registered as one. This gives
  // the match its own deliberate, guaranteed-visible entrance instead (see
  // .match-entrance in style.css) regardless of how the swipe played out.
  // Remove+reflow+re-add so the animation actually replays on every match,
  // not just the first one this session (a class that's already present
  // doesn't restart its animation just by being "added" again).
  const matchScreen = document.getElementById('screen-match');
  matchScreen.classList.remove('match-entrance');
  void matchScreen.offsetWidth;
  matchScreen.classList.add('match-entrance');

  // Buzz timed to .match-heart-medallion's own animation-delay (0.42s, see
  // style.css) so it lands right as the heart pops in, not on screen-open.
  setTimeout(() => { navigator.vibrate?.(15); _cineHaptic('MEDIUM'); }, 420);
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
  state.asstConversationMessages = null;
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

// ================================================================
// SCAN — DEDICATED SUB-PAGES
// Message typing, screenshot upload, and the generated reply each
// live on their own screen so the Scan tab stays a lightweight
// entry point (tap a row → its own page → back into Scan).
// ================================================================

function openScanUpload() {
  pushScreen('scan-upload');
}


// ================================================================
// TELL ZELO MORE — a quick, tap-driven context flow (not a form).
// Context lives here, off the Scan page, so Scan stays lightweight.
// ================================================================

// The map behind the three questions. Each answer narrows the next page to what could
// actually be true: someone you are dating is never a "First Conversation", an Argument is
// never answered with "Be Funny" or "Ask Them Out". `desc` is what the Scan prompt is told, since
// a bare label like "Gone Quiet" says little to the model.
const TZ_GOALS = {
  "Get a Reply":        { icon: "💬", desc: "get them to answer" },
  "Keep Things Going":  { icon: "🔄", desc: "keep the conversation alive" },
  "Ask Them Out":       { icon: "💘", desc: "ask them to meet up" },
  "Fix Things":         { icon: "🔧", desc: "repair things and make it right" },
  "Be Funny":           { icon: "😂", desc: "make them laugh" },
  "Be Direct":          { icon: "🎯", desc: "say what they mean, plainly" },
  "Set a Boundary":     { icon: "🛑", desc: "say what they are not okay with, calmly and clearly" },
  "Let Them Down Easy": { icon: "🕊️", desc: "turn them down or step back kindly" },
  "Define Things":      { icon: "🧭", desc: "find out where they stand with each other" },
};
const TZ_SITUATIONS = {
  "First Conversation":         { icon: "🌱", desc: "they just matched or are just starting to talk",
                                  goals: ["Get a Reply", "Keep Things Going", "Be Funny", "Be Direct", "Ask Them Out"] },
  "Getting to Know Each Other": { icon: "🌤️", desc: "still learning about each other",
                                  goals: ["Keep Things Going", "Get a Reply", "Be Funny", "Be Direct", "Ask Them Out"] },
  "Flirting":                   { icon: "😏", desc: "the chat has a flirty vibe",
                                  goals: ["Keep Things Going", "Be Funny", "Be Direct", "Ask Them Out", "Get a Reply"] },
  "Dry Replies":                { icon: "😶", desc: "they are giving short, low-effort replies",
                                  goals: ["Keep Things Going", "Get a Reply", "Be Funny", "Be Direct", "Let Them Down Easy"] },
  "Awkward Silence":            { icon: "🤐", desc: "the conversation went flat or stalled",
                                  goals: ["Get a Reply", "Keep Things Going", "Be Funny", "Be Direct"] },
  "Gone Quiet":                 { icon: "👻", desc: "they stopped replying for a while, or the user did",
                                  goals: ["Get a Reply", "Be Funny", "Be Direct"] },
  "Planning Something":         { icon: "📅", desc: "setting up a plan or a date",
                                  goals: ["Ask Them Out", "Be Direct", "Keep Things Going", "Get a Reply", "Be Funny"] },
  "After a Date":               { icon: "🌙", desc: "following up after they met in person",
                                  goals: ["Keep Things Going", "Ask Them Out", "Be Direct", "Be Funny", "Let Them Down Easy"] },
  "Mixed Signals":              { icon: "🔀", desc: "unsure where they stand with each other",
                                  goals: ["Define Things", "Be Direct", "Get a Reply", "Keep Things Going"] },
  "Argument":                   { icon: "😤", desc: "they are in a disagreement",
                                  goals: ["Fix Things", "Get a Reply", "Be Direct", "Set a Boundary"] },
  "I Messed Up":                { icon: "😬", desc: "the user did something wrong and wants to make it right",
                                  goals: ["Fix Things", "Get a Reply", "Be Direct"] },
  "Toxic Relationship":         { icon: "⚠️", desc: "they are hurtful, controlling or disrespectful",
                                  goals: ["Set a Boundary", "Be Direct", "Let Them Down Easy", "Fix Things", "Get a Reply"] },
};
const TZ_WHO = [
  { label: "New Match",           icon: "💌", phrase: "someone they just matched with",
    situations: ["First Conversation", "Getting to Know Each Other", "Flirting", "Dry Replies", "Awkward Silence", "Gone Quiet", "Planning Something"] },
  { label: "Crush",               icon: "👀", phrase: "their crush",
    situations: ["First Conversation", "Getting to Know Each Other", "Flirting", "Dry Replies", "Awkward Silence", "Gone Quiet", "Planning Something", "Mixed Signals"] },
  { label: "Talking for a While", icon: "⏳", phrase: "someone they have been talking to for a while",
    situations: ["Getting to Know Each Other", "Flirting", "Dry Replies", "Awkward Silence", "Gone Quiet", "Planning Something", "After a Date", "Mixed Signals", "Argument"] },
  { label: "Situationship",       icon: "✨", phrase: "someone they are in a situationship with",
    situations: ["Flirting", "Mixed Signals", "Dry Replies", "Gone Quiet", "Awkward Silence", "Planning Something", "After a Date", "Argument", "I Messed Up", "Toxic Relationship"] },
  { label: "Someone I'm Dating",  icon: "💕", phrase: "someone they are dating",
    situations: ["Flirting", "Planning Something", "After a Date", "Awkward Silence", "Dry Replies", "Gone Quiet", "Mixed Signals", "Argument", "I Messed Up", "Toxic Relationship"] },
  { label: "My Partner",          icon: "💍", phrase: "their partner",
    situations: ["Flirting", "Planning Something", "Awkward Silence", "Dry Replies", "Gone Quiet", "Argument", "I Messed Up", "Toxic Relationship"] },
  { label: "Ex",                  icon: "💔", phrase: "their ex",
    situations: ["Gone Quiet", "Awkward Silence", "Dry Replies", "Planning Something", "Mixed Signals", "Argument", "I Messed Up", "Toxic Relationship"] },
  { label: "Friend",              icon: "🤝", phrase: "a friend",
    situations: ["Getting to Know Each Other", "Flirting", "Dry Replies", "Awkward Silence", "Gone Quiet", "Planning Something", "After a Date", "Mixed Signals", "Argument", "I Messed Up"] },
];
// A few goals only make sense for some relationships (you do not "ask out" an ex or "define things" with a partner).
const TZ_WHO_NO_GOALS = { "Ex": ["Ask Them Out"], "My Partner": ["Define Things"] };
const TZ_WHO_PHRASE = Object.assign({ "Dating": "someone they are dating" }, Object.fromEntries(TZ_WHO.map(w => [w.label, w.phrase])));

function _tzSituationsFor(who) {
  const w = TZ_WHO.find(x => x.label === who);
  return w ? w.situations.map(l => ({ icon: TZ_SITUATIONS[l].icon, label: l })) : [];
}
function _tzGoalsFor(who, situation) {
  const sit = TZ_SITUATIONS[situation];
  if (!sit) return [];
  const banned = TZ_WHO_NO_GOALS[who] || [];
  return sit.goals.filter(g => !banned.includes(g)).map(l => ({ icon: TZ_GOALS[l].icon, label: l }));
}
// Going back and changing an earlier answer can leave later ones that no longer fit; drop them.
function _tzPrune(answers) {
  if (answers.situation && !_tzSituationsFor(answers.who).some(o => o.label === answers.situation)) { delete answers.situation; delete answers.goal; }
  if (answers.goal && !_tzGoalsFor(answers.who, answers.situation).some(o => o.label === answers.goal)) delete answers.goal;
}

const TELLZELO_STEPS = [
  { key: "who",       q: "Who is this to you?", options: () => TZ_WHO.map(w => ({ icon: w.icon, label: w.label })) },
  { key: "situation", q: "What's going on?",    options: a => _tzSituationsFor(a.who) },
  { key: "goal",      q: "What do you want?",   options: a => _tzGoalsFor(a.who, a.situation) },
  {
    key:   "extra",
    q:     "Add the last bit of seasoning.",
    freeText: true,
    placeholder: "Anything extra that might help.",
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
  const card = label === 'Dating' ? 'dating' : 'crush';
  // Tapping the already-selected (pink) card again cancels it, back to the
  // same "nothing picked yet" state the app starts in — a real toggle,
  // not just re-confirming the same pick every tap.
  if (state.scanWhoCard === card) {
    state.scanContext = {};
    state.scanWhoCard = null;
  } else {
    state.scanContext = { who: label };
    state.scanWhoCard = card;
  }
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
  const remove = document.getElementById('scan-who-remove');
  dating?.classList.toggle('selected', state.scanWhoCard === 'dating');
  crush?.classList.toggle('selected', state.scanWhoCard === 'crush');
  other?.classList.toggle('filled', state.scanWhoCard === 'other');
  if (remove) remove.hidden = !state.scanWhoCard;
}

// "Remove" button next to the "Who's this about?" heading — clears
// whichever of Dating/Crush/Other is currently picked, same end state as
// tapping an already-selected quick-pick card again (see scanQuickWho()),
// just without needing to know that trick, and it works for "Other" too
// (which has no tap-to-toggle of its own, since tapping it opens the
// wizard instead of picking it directly).
function scanWhoRemove() {
  state.scanContext = {};
  state.scanWhoCard = null;
  refreshScanWhoCards();
  navigator.vibrate?.(4);
}

// Open the flow — always start at the first step, keep prior selections.
function openTellZelo() {
  state.tzStep = 0;
  pushScreen('tellzelo');
  renderTellZeloStep();
}

function renderTellZeloStep() {
  _tzRenderInto(document.getElementById('screen-tellzelo'), state.tzStep, false);
  _tzMakeScrollable();
}

// Fills `root` with step `stepIdx`. `ghost` = a static copy shown underneath during a swipe-back
// (no handlers, no ids), so the user sees the previous page and not a blank one.
function _tzRenderInto(root, stepIdx, ghost) {
  if (!root) return;
  _tzPrune(state.tellzeloAnswers);
  const step = TELLZELO_STEPS[stepIdx];
  const q = sel => root.querySelector(sel);

  // Progress — one segment per step, filled up to and including this one
  const prog = q('.tz-progress');
  prog.innerHTML = "";
  TELLZELO_STEPS.forEach((_, i) => {
    const seg = document.createElement("span");
    seg.className = "tz-seg" + (i <= stepIdx ? " done" : "");
    prog.appendChild(seg);
  });

  q('.tz-question').textContent = step.q;

  // Help line is gone — hide the element so it takes no space
  const helpEl = q('.tz-help');
  helpEl.textContent = "";
  helpEl.style.display = "none";

  const wrap = q('.tz-options');
  wrap.innerHTML = "";

  const isLast = stepIdx === TELLZELO_STEPS.length - 1;
  q('.tz-next-label').textContent = isLast ? "Done" : "Next";
  const nextBtn = q('.tz-next');

  if (step.freeText) {
    // Free-text step — render a plain textarea instead of radio options
    const ta = document.createElement("textarea");
    if (!ghost) ta.id = "tz-freetext";
    ta.className   = "msg-textarea tz-freetext";
    ta.placeholder = step.placeholder || "";
    ta.value       = state.tellzeloAnswers[step.key] || "";
    if (!ghost) ta.oninput = () => {
      state.tellzeloAnswers[step.key] = ta.value;
      // "Done" is always enabled on the free-text step (it's optional seasoning)
      nextBtn.disabled = false;
    };
    wrap.appendChild(ta);
    // Free-text step is always advanceable (it's optional)
    nextBtn.disabled = false;
  } else {
    // Radio-style quick-select options (computed from the earlier answers)
    const chosen = state.tellzeloAnswers[step.key];
    const options = typeof step.options === 'function' ? step.options(state.tellzeloAnswers) : step.options;
    options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tz-option" + (chosen === opt.label ? " selected" : "");
      if (!ghost) btn.onclick = () => tellZeloSelect(step.key, opt.label);
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
    nextBtn.disabled = !state.tellzeloAnswers[step.key];
  }
}

// The previous step, rendered into a copy of this screen that sits underneath while the
// current one is dragged away (see the screen-tellzelo swipe wiring). Built once, repainted
// per gesture. Without it the swipe slid the page off to a blank white screen and then
// re-rendered the earlier step, because the steps all live inside one screen.
function _tzGhost(stepIdx) {
  const real = document.getElementById('screen-tellzelo');
  let g = document.getElementById('screen-tellzelo-ghost');
  if (!g) {
    g = real.cloneNode(true);
    g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    g.id = 'screen-tellzelo-ghost';
    g.classList.remove('active');
    g.setAttribute('aria-hidden', 'true');
    real.parentNode.insertBefore(g, real.nextSibling);
  }
  _tzRenderInto(g, stepIdx, true);
  return g;
}

// The screen is the scroller (.screen is overflow-y:auto), but a step that
// fits the viewport has nothing to scroll, so it felt fixed. Same size, same
// layout — just guarantee a little overflow so it drags and bounces.
function _tzMakeScrollable() {
  const el = document.getElementById('screen-tellzelo');
  if (!el) return;
  requestAnimationFrame(() => _ensureScrollableOverflow(el, 56));
}

function tellZeloSelect(key, label) {
  state.tellzeloAnswers[key] = label;
  _tzPrune(state.tellzeloAnswers);
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
  const order = ["who", "situation", "goal", "extra"];
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
// deferred to Analyze time (see _extractScreenshotConversation) and never shown.
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
// SCREENSHOT READING — openai-proxy (GPT-5.4 mini vision) reads the full
// conversation visible in an attached screenshot at Analyze time, returning
// structured { sender: "her"|"me", text }[] for every bubble — not just the
// last line. The conversation is rendered as native bubbles (see
// _showResultConversation()); the last "her" message in it is what actually
// feeds the DeepSeek prompt, same role the single extracted line used to
// play. Text-only scans are untouched, still via deepseek-proxy.
// ================================================================

function _fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Returns { messages, lastHerText }, or null on any failure (missing key,
// bad deploy, network error, empty result) — callers stop and show the
// generic error message when this returns null. Returns NO_MESSAGE_SENTINEL
// when the model explicitly found no real conversation in the image (as
// opposed to a technical failure) — callers show a different, friendlier
// message for that case.
const NO_MESSAGE_SENTINEL = "__NO_MESSAGE_FOUND__";

async function _extractScreenshotConversation(file) {
  try {
    const base64Data = await _fileToBase64(file);
    if (!base64Data) return null;

    const { data, error } = await _aiInvoke('openai-proxy', {
      body: { image: base64Data, mimeType: file.type }
    }, 'ocr');

    if (error) {
      // supabase-js only puts a generic message on error.message for a
      // non-2xx response — the actual { error: "..." } body from
      // openai-proxy has to be read off error.context.
      // The response body can echo back the extracted text, so only its
      // status/shape is logged — never the body itself.
      console.error("[Zelo OCR] openai-proxy failed:", error?.name || "error",
                    "status:", error?.context?.status ?? "n/a");
      return null;
    }

    const messages = Array.isArray(data?.messages) ? data.messages : [];
    if (!data?.found || !messages.length) return NO_MESSAGE_SENTINEL;

    // "The most recent message from the other person" — same semantic the
    // old single-line extraction used, just derived from the structured
    // list instead of asked of the model a second time. Falls back to the
    // conversation's last line if, unusually, every bubble was "me".
    const herMsgs = messages.filter(m => m.sender === 'her');
    const lastHerText = herMsgs.length ? herMsgs[herMsgs.length - 1].text : messages[messages.length - 1].text;

    return { messages, lastHerText };
  } catch (err) {
    // Name only: an exception's message can carry the payload that caused it.
    console.error("[Zelo OCR] openai-proxy threw:", err?.name || "Error");
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

// ================================================================
const SAFE_FALLBACK_STYLES        = ["direct", "shorter"];
// No Situation/Goal provided at all — gives a spread across the main axes
// (neutral, direct, shorter, longer) so there's something to swipe through
// even without filling in Tell Zelo More.
const NO_CONTEXT_DEFAULT_STYLES   = ["smooth", "direct", "shorter", "longer"];
const HEAVY_SITUATIONS            = new Set(["Argument", "Toxic Relationship", "I Messed Up"]);
// Goals that are never a moment for a joke or a bold line, whatever the situation.
const HEAVY_GOALS                 = new Set(["Set a Boundary", "Let Them Down Easy"]);
const BANNED_STYLES_IN_HEAVY_SITS = new Set(["funny", "bolder"]);

function getEligibleStyles(situation, goal) {
  let styles;
  const heavy = HEAVY_SITUATIONS.has(situation) || HEAVY_GOALS.has(goal);
  const tableEntry = situation && goal && STYLE_ELIGIBILITY[situation]
    ? STYLE_ELIGIBILITY[situation][goal]
    : null;

  if (tableEntry && tableEntry.length) {
    styles = tableEntry.slice();
  } else if (heavy) {
    // "not offered" cell (e.g. Argument + Be Funny) — safe fallback, never Funny/Bolder
    styles = SAFE_FALLBACK_STYLES.slice();
  } else {
    // No Situation/Goal selected at all, or an otherwise-unmapped combo
    styles = NO_CONTEXT_DEFAULT_STYLES.slice();
  }

  // Hard safety rule, enforced in code — not just by relying on the table
  // being correct. Funny and Bolder must never reach the user during an
  // Argument or Toxic Relationship, regardless of Goal.
  if (heavy) {
    styles = styles.filter(s => !BANNED_STYLES_IN_HEAVY_SITS.has(s));
    if (styles.length === 0) styles = SAFE_FALLBACK_STYLES.slice();
  }

  // The style picked in onboarding step 7 goes first when this situation
  // offers it at all. Applied AFTER the safety filter above, so a banned
  // style can never be promoted back into a heavy situation.
  const preferred = _preferredFirstStyle();
  if (preferred && styles.includes(preferred)) {
    styles = [preferred, ...styles.filter(s => s !== preferred)];
  }

  return styles;
}

// Onboarding step 7's answer — see cineRunStyleEntrance().
const FIRST_STYLE_KEY = 'zelo_first_style';
function _preferredFirstStyle() {
  const s = localStorage.getItem(FIRST_STYLE_KEY);
  return s && STYLE_LABELS[s] ? s : null;
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
  if (ctx.who)       lines.push(`This message is from ${TZ_WHO_PHRASE[ctx.who] || 'a ' + ctx.who}.`);
  if (ctx.situation) lines.push(`The situation is: ${ctx.situation}${TZ_SITUATIONS[ctx.situation] ? ' (' + TZ_SITUATIONS[ctx.situation].desc + ')' : ''}.`);
  if (ctx.goal)       lines.push(`The user wants to: ${ctx.goal}${TZ_GOALS[ctx.goal] ? ' (' + TZ_GOALS[ctx.goal].desc + ')' : ''}.`);
  return lines.join(' ');
}

async function _fetchDeepSeekReply(style) {
  const contextBlock = buildScanContextBlock();

  let userPrompt = `Message I received: "${state.asstMessage}"\nTone: ${STYLE_LABELS[style]}`;
  if (contextBlock) userPrompt += `\nContext: ${contextBlock}`;

  // The reply is going to be SENT by the user, so it has to read as them, not
  // as a coach writing on their behalf — "witty and confident texting coach"
  // used to be the whole persona here, and a coach voice is exactly what
  // makes a suggestion unsendable. Naturalness is stated first and the style
  // is applied on top of it, in that order, so the style adjusts how the
  // reply is expressed instead of replacing who is speaking.
  const NATURAL_RULES =
    `Write a reply that sounds like a real person texting someone they are getting to know. ` +
    `Respond naturally to the context before applying the requested style. ` +
    `Avoid scripted pickup lines, manufactured jokes, unnecessary flirting, repetitive slang, and polished marketing-style sentences. ` +
    `Don't automatically add questions or invitations. ` +
    `Keep the wording believable, context-appropriate, and easy to send without editing. ` +
    `Match the user's texting habits when examples are available. ` +
    `Let the length follow the message you are answering — don't pad a short answer to make it look complete. ` +
    `Do not use emojis unless the style specifically calls for it.`;

  // What each style changes about the EXPRESSION, once a believable reply
  // already exists. Without this, "Bold" reliably turns into a date invite
  // and "Warmer" into something formal, regardless of what was said.
  const STYLE_RULES = {
    smooth:  `Smooth: relaxed and confident, subtle interest. Not a pickup line.`,
    funny:   `Funny: humour from the situation or something relatable. No setup-and-punchline joke.`,
    direct:  `Direct: answer clearly with no unnecessary wording. Not cold.`,
    warmer:  `Warmer: friendly and attentive, more inviting. Not formal or overly caring.`,
    bolder:  `Bold: more forward, willing to show interest. Not aggressive, not sexual, not automatically an invitation.`,
    shorter: `Shorter: keep the same meaning in fewer words.`,
    longer:  `Longer: add useful detail without rambling.`,
    playful: `Playful: light and teasing, without forcing a joke.`,
  };

  const systemPrompt = [
    NATURAL_RULES,
    STYLE_RULES[style] || '',
    contextBlock
      ? `The user has told you who the message is from, what the situation is, and what they're trying to achieve — treat these as real constraints that shape the reply, not background flavour. A reply to an Ex during an Argument where the user wants to Fix Things should sound nothing like a reply to a Crush who is Flirting.`
      : '',
  ].filter(Boolean).join(' ');

  const { data, error } = await _aiInvoke('deepseek-proxy', {
    body: {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 150,
      temperature: 0.85
    }
  }, 'scan_reply');

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
    // A missing file (404) used to be read as a dictionary full of HTML, so nearly
    // every real message counted as gibberish. Treat it as "not loaded" instead.
    if (!response.ok) throw new Error('words-dict.txt ' + response.status);
    const text = await response.text();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    _gibDictionary = new Set(words.map(w => w.toLowerCase()));
    console.log("[Gibberish Guard] Dictionary loaded:", _gibDictionary.size, "words");
  } catch (err) {
    console.warn("[Gibberish Guard] Failed to load dictionary:", err);
    // Fail open (see _looksLikeGibberish): with no real dictionary the check stays off
    // rather than flagging normal messages against a tiny stand-in list.
    _gibDictionaryLoaded = false;
    return;
  }
  _gibDictionaryLoaded = true;
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
function renderHerMessagePreview(text, conversationMessages) {
  const ta = document.getElementById("asst-preview-bubble"); // the <textarea>
  if (!ta) return;
  if (conversationMessages && conversationMessages.length) {
    ta.value = "";                     // screenshot mode: the rendered conversation is the message
    _showResultConversation(conversationMessages);
  } else {
    ta.value = text || "";             // text mode: reflect the message in the box
    _hideResultConversation();
    _renderZeloRead(text);             // fill the gap with a coaching read
    requestAnimationFrame(_fitHerMessageBubble);
  }
}

// Fresh scan, typed message: the editable bubble hugs its text (a one-word "hi"
// used to sit in a full-width box) instead of always stretching across the row.
// Empty → full width so the placeholder has room. Re-run on every keystroke and
// whenever the box (re)appears/resizes (see _watchHerMessageBox()).
function _fitHerMessageBubble() {
  const ta = document.getElementById("asst-preview-bubble");
  if (!ta || document.getElementById("screen-scan-result")?.classList.contains("is-replay")) return;
  const row = ta.parentElement;
  if (!row || !row.clientWidth) return;
  if (!ta.value) { ta.style.flex = ""; ta.style.width = ""; ta.style.height = ""; return; }
  const cs = getComputedStyle(ta);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const avatar = row.querySelector(".yr-conv-avatar");
  const maxW = row.clientWidth - (avatar ? avatar.offsetWidth + 10 : 0);
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-break:break-word;` +
    `font:${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily};max-width:${maxW - padX}px;`;
  probe.textContent = ta.value + "\u200b";
  row.appendChild(probe);
  const w = Math.min(Math.ceil(_rectA(probe).width) + padX + 2, maxW);
  probe.remove();
  ta.style.flex = "0 0 auto";
  if (ta.style.width !== w + "px") ta.style.width = w + "px";
  ta.style.height = "auto";
  const h = ta.scrollHeight + "px";
  if (ta.style.height !== h) ta.style.height = h;
}
let _herBoxObserver = null;
function _watchHerMessageBox() {
  const box = document.getElementById("yr-message-combined");
  if (!box || _herBoxObserver || typeof ResizeObserver === "undefined") return;
  // Deferred to the next frame: resizing the textarea inside the observer callback
  // changes the very box being observed, which raises the browser's "ResizeObserver
  // loop completed with undelivered notifications" error — and this app's global
  // error handler turns any window error into the crash screen.
  let queued = false;
  _herBoxObserver = new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; _fitHerMessageBubble(); });
  });
  _herBoxObserver.observe(box);
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

// Same generic filled person-silhouette used for every "her" bubble's
// avatar — one shared glyph rather than a per-avatar image, so it never
// depends on a real profile photo (there isn't one for an OCR'd screenshot).
const YR_CONV_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8"/></svg>';

// Shared bubble-row markup — her messages left-aligned with an avatar, the
// user's own right-aligned with none (see .yr-conv in style.css, colors
// sampled directly from assets/icons/reply-styles/Her messages, box.png).
// Used both for the result screen's own parsed-conversation box AND the
// "Save this scan?" sheet's smaller preview of the same conversation.
function _convRowsHTML(messages) {
  return messages.map(m => {
    const isMe = m.sender === 'me';
    const avatar = isMe ? '' : `<span class="yr-conv-avatar" aria-hidden="true">${YR_CONV_AVATAR_SVG}</span>`;
    // A replied-to message shows its quote here too, or the replay reads as
    // a flat back-and-forth and loses which message was being answered.
    const q = m.replyTo
      ? `<span class="yr-conv-quote">${_escapeHtml(m.replyTo.length > 60 ? m.replyTo.slice(0, 60) + '…' : m.replyTo)}</span>`
      : '';
    return `<div class="yr-conv-row yr-conv-row--${isMe ? 'me' : 'her'}">${avatar}<span class="yr-conv-bubble yr-conv-bubble--${isMe ? 'me' : 'her'}">${q}${_escapeHtml(m.text)}</span></div>`;
  }).join('');
}

function _showResultConversation(messages) {
  const box = document.getElementById("yr-conv");
  if (box) {
    box.innerHTML = _convRowsHTML(messages);
    // .yr-conv is height-capped (see style.css) for a long conversation —
    // land scrolled to the bottom so the most recent messages (the ones
    // that actually matter for the reply) are what's visible by default;
    // scrolling up reveals earlier ones. Next frame, since the browser
    // needs to have laid out the new content before scrollHeight is real.
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  }
  document.getElementById("yr-preview-block")?.classList.add("has-shot");
}
function _hideResultConversation() {
  const box = document.getElementById("yr-conv");
  if (box) box.innerHTML = "";
  document.getElementById("yr-preview-block")?.classList.remove("has-shot", "has-added");
}

// Brief placeholder shown the instant a screenshot is picked, while OCR
// reads the full conversation in the background — there's no raw image to
// show any more (that's the whole point), so this fills the gap instead of
// the box just looking empty/broken for that beat.
function _showResultConversationLoading() {
  const box = document.getElementById("yr-conv");
  if (box) box.innerHTML = '<p class="yr-conv-loading">Reading the conversation…</p>';
  document.getElementById("yr-preview-block")?.classList.add("has-shot");
}

// --- Result-screen combined-input handlers -----------------------------
// Text the user had typed before attaching a screenshot. Restored verbatim if
// the OCR fails or the screenshot is removed — the fix for the wrong-text bug
// (previously it fell back to the STALE state.asstMessage from a prior scan).
let _typedBeforeShot = "";

// Typed text: commit (regenerate) on blur only, so we don't fire a request on
// every keystroke — matches "feeds reply generation as if typed."
function onResultMessageInput() { /* commit happens on blur; the bubble just re-fits live */ _fitHerMessageBubble(); }

function onResultMessageCommit() {
  const ta = document.getElementById("asst-preview-bubble");
  if (!ta) return;
  const text = ta.value.trim();
  if (!text || text === (state.asstMessage || "")) return; // unchanged — no-op
  state.asstConversationMessages = null; // typed text is always a single message, not a parsed conversation
  _regenerateFromResultInput(text);
}

function triggerResultUpload() {
  document.getElementById("result-screenshot-input")?.click();
}

// Tapping the avatar icon (only — see index.html's comment on why this moved
// off the whole box) opens the file picker to attach a screenshot instead.
function onMessageBoxTap() {
  triggerResultUpload();
}

// Screenshot chosen: show a lightweight loading placeholder (below the box)
// immediately, then reuse the EXISTING OCR pipeline
// (_extractScreenshotConversation → openai-proxy) and render the parsed
// conversation as native bubbles once it resolves, feeding the last message
// from her into generation exactly as typed text would.
async function onResultScreenshot(input) {
  const file = input.files?.[0];
  if (!file) return;

  const ta = document.getElementById("asst-preview-bubble");
  _typedBeforeShot = ta ? ta.value : "";   // remember typed text to restore on failure

  _showResultConversationLoading();

  const extracted = await _extractScreenshotConversation(file);
  // NOT logged. This is the conversation read out of the user's screenshot;
  // printing it would put their private messages into the device log (a
  // webview console.log is bridged to os_log and captured by sysdiagnose).
  // To debug an extraction, read it off the rendered result box instead.

  if (extracted && extracted !== NO_MESSAGE_SENTINEL) {
    // Do NOT write anything into the text box — the rendered conversation
    // stays shown as the message. Only the derived last-her-message text
    // feeds generation (state.asstMessage).
    if (ta) ta.value = "";
    state.asstConversationMessages = extracted.messages;
    _showResultConversation(extracted.messages);
    _regenerateFromResultInput(extracted.lastHerText);
  } else {
    // OCR failed / no message — restore the user's OWN typed text (never the
    // stale previous-scan message) and drop the unreadable screenshot.
    if (ta) ta.value = _typedBeforeShot;
    input.value = "";
    state.asstConversationMessages = null;
    _hideResultConversation();
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
      _saveGeneratedReply(firstStyle, reply);
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

// ================================================================
