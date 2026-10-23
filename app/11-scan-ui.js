// ================================================================
// 11-scan-ui.js — showing the generated replies
//
// The reply carousel, the AI Coach topic icons, Home’s widget carousel,
// and copying or using a reply.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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

function _safeImageDataUrl(value) {
  const src = String(value || '');
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(src) ? src : '';
}

// Auto-generated short title from a message — used both for a newly-saved
// scan's thread name (History) and an AI Coach chat's title (see
// _persistAiCoachChat()). Kept to 3-7 words per the spec; a message that's
// already that short is used verbatim (this is deliberately NOT an LLM
// call — it's meant to read as "the actual first question", not a
// paraphrase, and costs nothing to run on every save).
function _autoShortTitle(text) {
  const trimmed = (text || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const words = trimmed.split(' ');
  if (words.length <= 7) return trimmed;
  return words.slice(0, 7).join(' ') + '…';
}

// ================================================================
// AI COACH CHAT CLASSIFICATION — 4 icon categories + the small pill's
// specific-action label, both derived once from the first real user
// message in a coach chat and then fixed for good (see
// _persistAiCoachChat()) — never re-evaluated as the conversation
// continues, per spec.
// ================================================================
const AICOACH_TOPIC_ICONS = {
  reply:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  interest: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  flirty:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.2 3-2.7 4.2-2.7 7.8a2.7 2.7 0 0 0 5.4 0c0-.6-.3-1.2-.6-1.6 1.8 1 2.9 2.8 2.9 4.9a4.9 4.9 0 0 1-9.8 0c0-4 3.2-6.6 4.8-11.1z"/></svg>',
  advice:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/></svg>',
};
const AICOACH_TOPIC_COLORS = {
  reply:    { bg: '#eef2ff', accent: '#4488f6' },
  interest: { bg: '#fce3ee', accent: '#ec4899' },
  flirty:   { bg: '#fff1e9', accent: '#fe8e36' },
  advice:   { bg: '#f9f6fd', accent: '#885cea' },
};
// Real per-topic gem icon (assets/icons/aicoach-topics/{topic}.png, cropped
// pixel-for-pixel from the user's own reference) swapped in over the drawn
// AICOACH_TOPIC_ICONS SVG — same load/error technique used everywhere else
// a real icon image can replace a placeholder (.yr-card-illustration etc).
function _aiCoachTopicIconHTML(topic) {
  const svg = AICOACH_TOPIC_ICONS[topic] || AICOACH_TOPIC_ICONS.advice;
  return `<img class="aicoach-topic-icon-img" src="assets/icons/aicoach-topics/${topic}.png" alt=""
             onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">
           <span class="aicoach-topic-icon-svg">${svg}</span>`;
}

// AI Coach's own generic/brand icon — every plain "this is Zelo/AI Coach"
// spot (the chat avatar, suggestion-card icons, the promo card on the Scan
// page) now uses the same pink gem as the "interest" topic icon instead of
// the old sparkle SVG, per direct request ("I don't want to see the star
// icon anymore"). Fills its host span completely (same has-img toggle as
// _aiCoachTopicIconHTML, and its CSS clears that host's own colored-circle
// background once loaded) rather than floating as a small fixed-size icon
// inside one — the gem crop already has its own circular backdrop baked
// in, so a smaller icon inside another colored circle just doubled up as
// a visible ring around it ("a small circle around the gems").
function _aiCoachBrandIconHTML() {
  return `<img class="aicoach-brand-icon-img" src="assets/icons/aicoach-topics/mascot-brand.png" alt=""
             onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">
           <span class="aicoach-brand-icon-svg">${AICOACH_TOPIC_ICONS.interest}</span>`;
}
// FINALIZED — do not keep re-tuning this on a hunch; if a real message
// still lands in the wrong bucket, add its exact keyword to the matching
// regex below rather than redesigning the whole thing. Checked in this
// exact order, first match wins:
//
//   1. flirty   — wants a flirty/spicy/teasing line, or to "rizz" someone
//                 up. (flirt, rizz, spicy, tease, seduce, steamy, sexy)
//   2. interest — asking whether the OTHER PERSON is into them, or to
//                 read her signals — about HER feelings, not what to say
//                 back. ("does she like me", "is she interested", "what's
//                 the vibe", "did I mess it up", "read the signs")
//   3. reply    — asking to be handed the actual words to send — a
//                 request for generated text, not general strategy.
//                 ("what should I say/write/send/text", "help me reply",
//                 "rewrite this", "make this sound better", "text her
//                 back")
//   4. advice   — everything else. The default, catch-all bucket for
//                 general dating strategy/relationship questions that
//                 aren't asking for exact wording or reading her interest
//                 — "should I keep talking to her", "is this a red flag",
//                 "what do I do here". Most ad-hoc questions land here on
//                 purpose — that's why purple "Situation advice" is the
//                 most common pill, not a bug.
function _classifyCoachTopic(text) {
  const low = (text || '').toLowerCase();
  if (/flirt|rizz|spicy|tease|seduc|steamy|sexy/.test(low)) return 'flirty';
  if (/does (she|he).{0,20}like|is (she|he) interested|(she|he)('s| is) into (me|you)|into (me|him|her)\b|likes? me\b|feelings? for me|read (into|the signs)|what'?s the vibe|mess(ed)? (it |things )?up|sign(s)? (she|he)/.test(low)) return 'interest';
  if (/what should i (say|write|send|text|reply)|help me (reply|respond|write|text)|repl(y|ies) to|rewrite (this|my|it)|sound better|text (her|him) back|write (back|something)|say back/.test(low)) return 'reply';
  return 'advice';
}
function _coachPillLabel(topic, text) {
  if (topic === 'reply') {
    const low = (text || '').toLowerCase();
    const styleHit = Object.keys(STYLE_LABELS).find(k => low.includes(k));
    if (styleHit) return STYLE_LABELS[styleHit] + ' reply';
    return 'Reply help';
  }
  if (topic === 'interest') return 'Interest analysis';
  if (topic === 'flirty')   return 'Flirty reply';
  return 'Situation advice';
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
    longer:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>',
    // No cropped asset for this demo-only style (see STYLE_LABELS) — a wink,
    // to read distinctly from funny's plain smiley.
    playful: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M7.3 9.5c.6-.6 1.8-.6 2.4 0"/></svg>'
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
// exact hex values for (border/badge/quote/iconBg — all accent colors, so
// they stay fixed in dark mode same as everywhere else). Other styles
// don't have spec'd colors, so they reuse their existing STYLE_COLORS
// accent (unchanged from the old pill/peek system) tinted into the same
// border+badge treatment. gradTop/gradBottom are the one background piece
// here, so — unlike the rest of this theme — they're computed against
// var(--s1) rather than a literal hex, so the card's own surface still
// goes dark while its accent tint stays exactly the same percentage mix.
const CARD_THEME_SMOOTH = {
  border: "#F56BAE",
  badge: "#F14E9B",
  quote: "#F14A95",
  iconBg: "#F14E9B"
};

function _cardThemeFor(style) {
  const isSmooth = style === "smooth";
  const accent = isSmooth ? CARD_THEME_SMOOTH.badge : (STYLE_COLORS[style] || STYLE_COLORS.smooth).accent;
  const base = isSmooth ? CARD_THEME_SMOOTH : { border: accent, badge: accent, quote: accent, iconBg: accent };
  return {
    ...base,
    gradTop: `color-mix(in srgb, ${accent} 4%, var(--s1))`,
    gradBottom: `color-mix(in srgb, ${accent} 8%, var(--s1))`,
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
  const isBest = (state.replayBestStyle || state.eligibleStyles[0]) === style;
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
        <img class="yr-card-illustration-img" src="assets/icons/reply-styles/${style}.${ICON_EXT}" alt="" draggable="false"
             onload="this.closest('.yr-card-illustration').classList.add('has-img')"
             onerror="this.remove()">
        <span class="yr-card-illustration-svg">${_styleIconSvg(style)}</span>
      </div>
      <span class="yr-card-quote" style="color:${theme.quote}">${_CARD_QUOTE_SVG}</span>
      <p class="yr-card-text" hidden></p>
      <div class="yr-card-loading" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="yr-card-error" hidden>
        <p class="yr-card-error-text">Couldn't reach Zelo. Check your connection.</p>
        <button type="button" class="yr-card-error-retry" onclick="_retryStyleFetch('${style}')">Retry</button>
      </div>
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
  const text   = state.asstCurrentSet[style];
  const failed = state.asstFailedStyles.has(style);
  document.querySelectorAll(`.yr-card[data-style="${style}"]`).forEach(card => {
    const textEl    = card.querySelector(".yr-card-text");
    const loadingEl = card.querySelector(".yr-card-loading");
    const errorEl   = card.querySelector(".yr-card-error");
    if (!textEl) return;
    if (failed) {
      textEl.hidden = true;
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = false;
    } else if (text) {
      textEl.textContent = text; // .textContent, not innerHTML — no escaping needed, no injection risk
      textEl.hidden = false;
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
    } else {
      textEl.hidden = true;
      if (loadingEl) loadingEl.hidden = false;
      if (errorEl) errorEl.hidden = true;
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
  if (n <= 1) { dotsEl.innerHTML = ""; return; }
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
  ZeloAnalytics.track('tone_selected', { tone: style });
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

// ================================================================
// SCAN WIDGET CAROUSEL — 4 fixed full-width slides (promo + 3 dummy-data
// widgets). Same native scroll-snap + mouse-drag-polyfill technique as
// _wireCarousel/_initCarouselDrag above, simplified: no loop/phantom cards
// (only 4 real slides, arrows just disable at the ends instead of
// wrapping), no per-card data fetching.
// ================================================================
let _widgetCarouselIndex = 0;

function _widgetCarouselCards(track) {
  return Array.from(track.querySelectorAll(".widget-card:not([hidden])"));
}

function _closestWidgetCard(track) {
  const cards = _widgetCarouselCards(track);
  const center = track.scrollLeft + track.clientWidth / 2;
  let closest = null, closestDist = Infinity;
  cards.forEach(card => {
    const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
    if (dist < closestDist) { closestDist = dist; closest = card; }
  });
  return closest;
}

// Idle-fade chrome (border outline, arrows, dots): hidden by default —
// nothing to see right after login or swiping into the Scan tab — and
// only revealed by touching/dragging the carousel or tapping an arrow/dot,
// then faded back out after 3s of no further interaction. Never auto-shown
// on load, per the "should not see any of it in the normal state" ask.
let _widgetChromeTimer = null;
// Tracked via focus/blur rather than reading document.activeElement live
// inside _showWidgetChrome() — that raced the browser's own blur timing:
// the tap that closes the keyboard fires pointerdown while the input can
// still momentarily report as document.activeElement, so that first tap
// after closing the keyboard would suppress the reveal too, and the user
// had to tap the widget a second time before it actually worked. A flag
// updated by real focus/blur events isn't subject to that race.
let _textInputFocused = false;
// Timestamp of the last input/textarea blur — lets the touchstart-dismiss
// listener further down recognize "a field was just focused" even when a
// device's own native tap-outside-to-dismiss behavior (unreliable, which is
// why that listener does its own explicit blur() too — see its comment)
// races ahead and resigns first responder before that listener's JS runs,
// leaving document.activeElement already reset by the time it checks.
let _lastTextInputBlurAt = 0;
document.addEventListener("focusin", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") _textInputFocused = true;
});
document.addEventListener("focusout", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    _textInputFocused = false;
    _lastTextInputBlurAt = Date.now();
  }
});
// If a tap lands outside a currently-focused text input, that SAME tap is
// the one dismissing the keyboard — it shouldn't ALSO count as a tap on
// whatever it happened to land on. There's already a dedicated
// touchstart/capture listener elsewhere (search "blur it directly" further
// down this file) that performs the actual blur() for exactly this case —
// _dismissingKeyboard is set from inside THAT listener (not a second one
// here) so this reliably reflects "focused right before that blur," not a
// separately-raced guess: a second capture listener checking
// document.activeElement on its own could easily run after that one
// already blurred it, seeing "nothing was focused" and missing the case
// entirely (checking _textInputFocused alone has that exact problem — by
// the time a bubble-phase listener like the widget's own touchstart runs,
// the existing blur has already fired and flipped it back to false).
let _dismissingKeyboard = false;

function _showWidgetChrome() {
  // While a text field is focused (keyboard up), taps anywhere — including
  // on the widget itself — are the user dismissing the keyboard, not
  // asking to see the widget's chrome. Every reveal path (swipe, scroll,
  // drag, arrow tap, dot tap) funnels through this one function, so gating
  // it here covers all of them.
  if (_textInputFocused || _dismissingKeyboard) return;
  const carousel = document.getElementById("widget-carousel");
  if (!carousel) return;
  carousel.classList.add("chrome-visible");
  clearTimeout(_widgetChromeTimer);
  _widgetChromeTimer = setTimeout(() => {
    carousel.classList.remove("chrome-visible");
  }, 3000);
}

function _hideWidgetChrome() {
  const carousel = document.getElementById("widget-carousel");
  if (!carousel) return;
  clearTimeout(_widgetChromeTimer);
  carousel.classList.remove("chrome-visible");
}

function _wireWidgetCarousel() {
  const track = document.getElementById("widget-carousel-track");
  if (!track || track._wired) return;
  track._wired = true;
  track.scrollLeft = 0;

  // Dot indicator updates live, on every scroll tick during the swipe —
  // not debounced to "settled" — so it registers the new card the instant
  // the drag crosses the midpoint, instead of visibly lagging until the
  // motion fully stops. The 100ms trailing call stays as a cheap safety
  // net for whichever scroll event actually lands the final position
  // (harmless — it's just re-running the same closest-card check).
  let settleTimer = null;
  track.addEventListener("scroll", () => {
    _showWidgetChrome();
    _onWidgetCarouselSettled(track);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => _onWidgetCarouselSettled(track), 100);
  }, { passive: true });

  // Touch swipe reveals chrome too — scroll fires during the swipe on most
  // browsers, but this covers a tap/press that doesn't end up scrolling.
  track.addEventListener("touchstart", _showWidgetChrome, { passive: true });

  // Tap anywhere outside the widget (blank space, the message box, any
  // other UI) closes the chrome immediately instead of waiting out the 3s
  // timer. No preventDefault/stopPropagation — the tap still does its own
  // normal job afterward (e.g. focusing the textarea underneath).
  const carousel = document.getElementById("widget-carousel");
  document.addEventListener("pointerdown", e => {
    if (!carousel.classList.contains("chrome-visible")) return;
    if (carousel.contains(e.target)) return;
    _hideWidgetChrome();
  });

  _initWidgetCarouselDrag(track);
  _updateWidgetCarouselChrome();

  // Inter loads async (see the <link> in <head>) — if it swaps in after
  // this point, the resulting reflow can shift each card's width by a
  // fraction of a pixel, which is enough for scroll-snap to settle on the
  // wrong card. Re-pin to whichever card was actually active once fonts
  // are done, so the swap can never visibly knock the carousel off card 1.
  document.fonts?.ready?.then(() => {
    if (track._dragging) return;
    track.scrollLeft = _widgetCarouselIndex * track.clientWidth;
  });
}

function _onWidgetCarouselSettled(track) {
  if (track._dragging) return;
  const closest = _closestWidgetCard(track);
  if (!closest) return;
  _widgetCarouselIndex = Number(closest.dataset.widgetIndex) || 0;
  _updateWidgetCarouselChrome();
}

function _updateWidgetCarouselChrome() {
  const dots = document.querySelectorAll("#widget-carousel-dots .widget-carousel-dot");
  dots.forEach((dot, i) => dot.classList.toggle("active", i === _widgetCarouselIndex));

  const prevBtn = document.getElementById("widget-carousel-prev");
  const nextBtn = document.getElementById("widget-carousel-next");
  if (prevBtn) prevBtn.hidden = _widgetCarouselIndex <= 0;
  // Next stays visible even on the last card — it wraps back to card 1
  // instead of clamping, so there's always a way forward.
  if (nextBtn) nextBtn.hidden = false;
}

function _widgetCarouselScrollTo(index) {
  const track = document.getElementById("widget-carousel-track");
  const cards = _widgetCarouselCards(track);
  const card = cards[index];
  if (!track || !card) return;
  _widgetCarouselIndex = index;
  track.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  _updateWidgetCarouselChrome();
}

function widgetCarouselGoTo(index) { _showWidgetChrome(); _widgetCarouselScrollTo(index); }
function widgetCarouselPrev()      { _showWidgetChrome(); _widgetCarouselScrollTo(Math.max(0, _widgetCarouselIndex - 1)); }
function widgetCarouselNext() {
  _showWidgetChrome();
  const track = document.getElementById("widget-carousel-track");
  const last = _widgetCarouselCards(track).length - 1;
  // Wraps to the first card from the last one instead of stopping dead.
  const next = _widgetCarouselIndex >= last ? 0 : _widgetCarouselIndex + 1;
  _widgetCarouselScrollTo(next);
}

// Mouse-drag polyfill — identical technique to _initCarouselDrag above,
// duplicated rather than shared since that one is wired into the reply
// carousel's own style-fetch/phantom-loop side effects.
function _initWidgetCarouselDrag(track) {
  let startX = 0, startScroll = 0, moved = false;

  function onDown(e) {
    if (e.button !== 0) return;
    _showWidgetChrome();
    track._dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
    track.classList.add("dragging");
    e.preventDefault();
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
    const closest = _closestWidgetCard(track);
    if (closest) {
      _widgetCarouselIndex = Number(closest.dataset.widgetIndex) || 0;
      track.scrollTo({ left: closest.offsetLeft, behavior: "smooth" });
      _updateWidgetCarouselChrome();
    }
  }

  track.addEventListener("mousedown", onDown);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  track.addEventListener("click", e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);
}

// Fetches a style's reply only if it isn't cached yet — used both for the
// card the user just landed on, and (via _prefetchNextStyle) the one ahead.
// One brief automatic retry before surfacing a failure — a single dropped
// request (common on a flaky connection) shouldn't immediately show an
// error card; a real outage still will, just ~700ms later instead of
// silently leaving the loading dots spinning or showing a fake "reply".
async function _fetchDeepSeekReplyWithRetry(style) {
  try {
    return await _fetchDeepSeekReply(style);
  } catch (e) {
    await new Promise(r => setTimeout(r, 700));
    return _fetchDeepSeekReply(style); // second failure propagates to the caller
  }
}

function _ensureStyleFetched(style) {
  if (state.asstCurrentSet[style]) return;
  state.asstFailedStyles.delete(style);
  _fetchDeepSeekReplyWithRetry(style)
    .then(reply => {
      state.asstCurrentSet[style] = reply;
      _saveGeneratedReply(style, reply);
      _renderCardText(style);
      if (state.replayThreadId) _replayOnReplyReady(style, reply);
    })
    .catch(() => {
      state.asstFailedStyles.add(style);
      _renderCardText(style);
    });
}

// Tapped from a card's own "Retry" button (see _cardHTML()'s .yr-card-error).
function _retryStyleFetch(style) {
  state.asstFailedStyles.delete(style);
  delete state.asstCurrentSet[style];
  _renderCardText(style); // back to the loading dots immediately
  _ensureStyleFetched(style);
}

// ---- Replay layout (see .is-replay in style.css) ----------------------
// Everything the user does on a replayed scan is written straight back into
// that thread's most recent scan (_replayPersist), so History, the Link a
// thread picker and AI Coach's linked-conversation card all show the
// updated conversation/reply/tone instead of the one that was first saved.

function _replayCurrentStyle() {
  return state.eligibleStyles[state.currentStyleIndex] || state.asstStyle;
}

function _replayRenderConvo(popIdx) {
  renderHerMessagePreview(state.asstMessage, state.replayConvo);
  if (popIdx == null) return;
  const row = document.querySelectorAll('#yr-conv .yr-conv-row')[popIdx];
  if (row) row.classList.add('yr-conv-row--pop');
}

// commit=true also writes the currently shown suggestion (reply + tone) as the
// scan's reply/style — only "Use this reply" does that; just browsing tones or
// getting new suggestions never touches what's saved.
function _replayPersist(commit) {
  const threads = getThreads();
  const thread  = threads.find(t => t.id === state.replayThreadId);
  const scan    = thread && thread.scans && thread.scans[thread.scans.length - 1];
  if (!scan) return;
  const convo = state.replayConvo;
  const lastHer = [...convo].reverse().find(m => m.sender === 'her');
  scan.conversationMessages = convo.map(m => ({ sender: m.sender, text: m.text }));
  if (lastHer) scan.message = lastHer.text;
  if (commit) {
    scan.reply = state.replayCurrentReply;
    scan.style = state.replayStyle;
  }
  scan.time  = Date.now();
  saveThreads(threads);
  // AI Coach's linked-conversation preview lives on the screen underneath and
  // was built from the OLD scan — refresh it so going back shows the update.
  if (document.getElementById('aicoach-context-row')) renderAiCoachContext();
}

// A new suggestion arrived (tone change / new suggestions / shorter / a new
// message from her). It only becomes the card's text — the conversation and the
// saved scan are NOT touched until the user presses "Use this reply".
function _replayOnReplyReady(style, reply) {
  if (style !== _replayCurrentStyle()) return;
  state.replayCurrentReply = reply;
  state.replayStyle        = style;
}

// Hold a bubble in the replay's conversation card to delete it. Delegated on
// the (persistent) #yr-conv box because its rows are re-rendered on every
// change; ignored unless the screen is in replay mode. Moving the finger
// (scrolling the card) or lifting early cancels the hold.
const REPLAY_HOLD_MS = 480;
// Springy ease-back applied only when a press ENDS (release/cancel/matured-
// into-delete) — the press itself is instant (see the CSS comment on
// .yr-conv-row--pressing), same "snap while held, ease on release" split
// used by the sheet drag-to-close gestures elsewhere in this file.
const REPLAY_PRESS_RELEASE_TRANSITION = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';

function attachReplayBubbleHold() {
  const box = document.getElementById('yr-conv');
  if (!box) return;
  let timer = null, row = null, sx = 0, sy = 0;
  const release = () => {
    clearTimeout(timer); timer = null;
    if (row) {
      row.style.transition = REPLAY_PRESS_RELEASE_TRANSITION;
      row.classList.remove('yr-conv-row--pressing');
    }
    row = null;
  };
  box.addEventListener('pointerdown', e => {
    if (!_holdDeletableConvo()) return;
    const r = e.target.closest('.yr-conv-row');
    if (!r) return;
    release();
    row = r; sx = e.clientX; sy = e.clientY;
    // No transition here — the row has to visibly react the instant it's
    // touched, not ease in a beat later (that's what read as "not still" /
    // unresponsive during the hold).
    row.style.transition = 'none';
    row.classList.add('yr-conv-row--pressing');
    timer = setTimeout(() => {
      const idx = [...box.querySelectorAll('.yr-conv-row')].indexOf(r);
      r.style.transition = REPLAY_PRESS_RELEASE_TRANSITION;
      r.classList.remove('yr-conv-row--pressing');
      row = null;
      navigator.vibrate?.(15); _cineHaptic('MEDIUM');
      if (idx >= 0) replayConfirmDeleteMessage(idx);
    }, REPLAY_HOLD_MS);
  });
  box.addEventListener('pointermove', e => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) release();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => box.addEventListener(t, release));
  box.addEventListener('contextmenu', e => { if (_holdDeletableConvo()) e.preventDefault(); });
}

// "Use this reply": besides copying it, the reply becomes the user's own
// message in the conversation (pops in), and it — with its tone — is saved as
// the scan's reply/style. If the conversation already ends with that exact pink
// bubble it is only re-popped (committed), not duplicated.
function replayUseReply(text) {
  const convo = state.replayConvo;
  const last  = convo[convo.length - 1];
  if (!(last && last.sender === 'me' && last.text === text)) convo.push({ sender: 'me', text });
  state.replayCurrentReply = text;
  state.replayStyle        = _replayCurrentStyle();
  _replayRenderConvo(convo.length - 1);
  _replayPersist(true);
}

// The conversation a long-press can delete from: the replay's, or — on a fresh
// scan — the one shown as bubbles (a screenshot's, or one messages were added to).
function _holdDeletableConvo() {
  if (state.replayThreadId) return state.replayConvo;
  const c = state.asstConversationMessages;
  return (c && c.length && document.getElementById('yr-preview-block')?.classList.contains('has-shot')) ? c : null;
}

function replayConfirmDeleteMessage(idx) {
  const convo = _holdDeletableConvo();
  const msg = convo && convo[idx];
  if (!msg) return;
  if (convo.length <= 1) {
    flashLimitToast("A saved conversation needs at least one message");
    return;
  }
  _showChatConfirm("Delete message?", "This removes it from this conversation.", "Delete", () => replayDeleteMessage(idx));
}

function replayDeleteMessage(idx) {
  const convo = _holdDeletableConvo();
  if (!convo) return;
  const removed = convo.splice(idx, 1)[0];
  if (!removed) return;
  // What the suggestion answers is her latest remaining message.
  const lastHer = [...convo].reverse().find(m => m.sender === 'her');
  if (lastHer) state.asstMessage = lastHer.text;
  if (state.replayThreadId) {
    _replayRenderConvo();
    _replayPersist();
  } else {
    renderHerMessagePreview(state.asstMessage, convo);   // fresh scan: saved later with the scan
    document.getElementById('yr-preview-block')?.classList.add('has-added');
    _renderZeloRead(state.asstMessage);
  }
}

// Which side of the Her/You toggle is active — decides who a sent message
// (replayAddCurrentMessage(), the composer's one always-visible send button)
// is added as. Reset to 'her' every time the composer (re)appears, since a
// fresh scan or a newly opened replay should always start on the same side.
let _replayAddOpen = false;
function _setReplayAddOpen(open, focus) {
  _replayAddOpen = open;
  document.getElementById('yr-add-row')?.classList.toggle('is-open', open);
  document.getElementById('yr-add-row-label')?.setAttribute('aria-expanded', String(open));
  _srMakeScrollable();
  if (open && focus !== false) setTimeout(() => document.getElementById('yr-add-' + _replayAddWho)?.focus(), 240);
  if (!open) document.activeElement?.blur?.();
}
function toggleReplayAddBox() { _cineHaptic('LIGHT'); _setReplayAddOpen(!_replayAddOpen); }

let _replayAddWho = 'her';

function _resetReplayAdd() {
  ['her', 'me'].forEach(who => {
    const ta = document.getElementById('yr-add-' + who);
    if (ta) { ta.value = ''; ta.style.height = ''; }
  });
  _replayAddWho = 'her';
  _setReplayAddOpen(false, false);          // normal state: closed
  document.getElementById('yr-add-field-her')?.removeAttribute('hidden');
  document.getElementById('yr-add-field-me')?.setAttribute('hidden', '');
  document.getElementById('yr-add-tab-her')?.classList.add('yr-add-tab--active');
  document.getElementById('yr-add-tab-me')?.classList.remove('yr-add-tab--active');
  const labelText = document.getElementById('yr-add-row-label-text');
  if (labelText) labelText.textContent = 'Add her message';
  // Best-effort here — at this point in both call sites (generateReplies()/
  // openScanReplay()) #scan-result-content is usually still `hidden` (real
  // layout doesn't exist yet, so the tab has 0 width to measure), so this
  // alone isn't enough; _armAddTogglePill() below is what actually runs once
  // content is real. Kept here too for any future caller where it's already
  // visible at reset time.
  _armAddTogglePill();
}

// Two frames: the toggle has to actually be laid out (real width/position)
// before its pill can be measured — same reasoning as updateTabGlassPill()
// being called after the tab bar itself is in the DOM. Call this once
// #scan-result-content has actually been revealed (`hidden = false`), not
// from _resetReplayAdd() alone — that runs earlier, while content is still
// hidden and every element in it reads a real width of 0.
// Your Reply fits the viewport, so it had nothing to scroll and felt fixed.
// Same size and layout; just guarantee a little overflow so it drags and bounces.
function _srMakeScrollable() {
  const el = document.getElementById('screen-scan-result');
  if (!el) return;
  const go = () => _ensureScrollableOverflow(el, 56);
  // Re-measured as the layout settles (reply text, the toggle pill and the
  // conversation box all change the height after first paint).
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 350); setTimeout(go, 1000);
}

function _armAddTogglePill() {
  _srMakeScrollable();
  requestAnimationFrame(() => requestAnimationFrame(() => _slideAddTogglePill(false)));
}

// Slides the pink pill (#yr-add-toggle-pill) behind whichever of Her/You is
// active, sized/positioned from that tab's own live rect — same technique as
// the bottom tab bar's #tab-glass-pill (updateTabGlassPill()) — so it always
// lines up exactly with the tab's real rendered width regardless of its text.
function _slideAddTogglePill(animate) {
  const pill = document.getElementById('yr-add-toggle-pill');
  const wrap = document.getElementById('yr-add-toggle');
  if (!pill || !wrap) return;
  const btn = document.getElementById('yr-add-tab-' + _replayAddWho);
  if (!btn || !btn.offsetWidth) return;
  const wrapRect = _rectA(wrap);
  const btnRect  = _rectA(btn);
  pill.style.transition = animate === false ? 'none' : '';
  pill.style.width = btnRect.width + 'px';
  pill.style.transform = 'translateX(' + (btnRect.left - wrapRect.left - 3) + 'px)';
  pill.classList.add('yr-add-toggle-pill--ready');
  if (animate === false) void pill.offsetWidth; // flush the no-transition jump before transitions are re-enabled
}
window.addEventListener('resize', () => _slideAddTogglePill(false));

// Switches which side of the toggle is active. Cross-dissolves the input box
// as a whole (a quick opacity/scale dip while the field underneath swaps and
// refocuses, back up once the new field is in) rather than trying to overlap
// two different-height fields mid-transition — a clean, simple motion instead
// of a layout jump. The right-hand "Add her/your message" label fades through
// the same beat.
function setReplayAddWho(who) {
  if (!_replayAddOpen) _setReplayAddOpen(true, false);      // pressing Her or You opens the box
  if (who === _replayAddWho) { setTimeout(() => document.getElementById('yr-add-' + who)?.focus(), _replayAddOpen ? 0 : 240); return; }
  _replayAddWho = who;
  navigator.vibrate?.(6);
  _slideAddTogglePill(true);
  document.getElementById('yr-add-tab-her')?.classList.toggle('yr-add-tab--active', who === 'her');
  document.getElementById('yr-add-tab-me')?.classList.toggle('yr-add-tab--active', who === 'me');

  const box = document.getElementById('yr-add-box');
  box?.classList.add('yr-add-box--switching');
  // The label text swaps INSTANTLY, not faded — a small bold label crossfading
  // through a low-opacity mid-transition frame is what actually looked like
  // garbled/doubled text ("AAdd her message") on a real device: opacity-fading
  // small bold text is a known bad case, unlike the box's own dip/scale above,
  // which is a plain colour/shape change and reads cleanly. Confirmed by
  // grabbing frames during the transition — a low-opacity bold "A" genuinely
  // looks smudged/doubled, not a real second element overlapping.
  document.getElementById('yr-add-row-label-text').textContent = who === 'her' ? 'Add her message' : 'Add your message';
  setTimeout(() => {
    document.getElementById('yr-add-field-her')?.toggleAttribute('hidden', who !== 'her');
    document.getElementById('yr-add-field-me')?.toggleAttribute('hidden', who !== 'me');
    box?.classList.remove('yr-add-box--switching');
    document.getElementById('yr-add-' + who)?.focus();
  }, 130);
}

function onReplayAddInput(who) {
  const ta = document.getElementById('yr-add-' + who);
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 84) + 'px';
}

function onReplayAddKey(e, who) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); replayAddMessage(who); }
}

// The composer's one always-visible send button — adds the message as
// whichever side of the toggle is currently active.
function replayAddCurrentMessage() {
  replayAddMessage(_replayAddWho);
}

// who: 'her' | 'me'. The message pops into the conversation card and is
// saved. A message from HER also becomes what the suggestion answers, so the
// card regenerates for it; one from the user just joins the conversation.
function replayAddMessage(who) {
  const ta = document.getElementById('yr-add-' + who);
  const text = ta ? ta.value.trim() : '';
  if (!text) return;
  if (!state.replayThreadId) { freshAddMessage(who, ta, text); return; }
  state.replayConvo.push({ sender: who, text });
  ta.value = '';
  onReplayAddInput(who);
  navigator.vibrate?.(8);
  if (who === 'her') state.asstMessage = text;
  _replayRenderConvo(state.replayConvo.length - 1);
  _replayPersist();
  if (who === 'her') _retryStyleFetch(_replayCurrentStyle());
}

// Same two boxes on a FRESH scan (not yet saved): the message pops into the
// conversation card (a typed single message becomes the first bubble) and rides
// along into the saved scan via state.asstConversationMessages (see
// _saveScanPreviewMessages()). A message from her also becomes what Zelo answers.
function freshAddMessage(who, ta, text) {
  if (!state.asstConversationMessages || !state.asstConversationMessages.length) {
    state.asstConversationMessages = state.asstMessage ? [{ sender: 'her', text: state.asstMessage }] : [];
  }
  state.asstConversationMessages.push({ sender: who, text });
  ta.value = '';
  onReplayAddInput(who);
  navigator.vibrate?.(8);
  renderHerMessagePreview(who === 'her' ? text : state.asstMessage, state.asstConversationMessages);
  document.getElementById('yr-preview-block')?.classList.add('has-added');
  const rows = document.querySelectorAll('#yr-conv .yr-conv-row');
  rows[rows.length - 1]?.classList.add('yr-conv-row--pop');
  if (who === 'her') _regenerateFromResultInput(text);
  else _renderZeloRead(state.asstMessage);
}

function _replaySwitchStyle(style) {
  state.eligibleStyles    = [style];
  state.currentStyleIndex = 0;
  state.asstStyle         = style;
  renderReplyCarousel();
  _centerCarouselOnCurrent();
  _ensureStyleFetched(style);
  // Already generated earlier this visit → no fetch will fire the hook.
  if (state.asstCurrentSet[style]) _replayOnReplyReady(style, state.asstCurrentSet[style]);
}

function replayGetNewSuggestions() {
  ZeloAnalytics.track('reply_regenerated', { tone: _replayCurrentStyle() });
  _retryStyleFetch(_replayCurrentStyle());
}

// Change tone: slide-up sheet with every tone; tapping one closes it and the
// card shows that tone generating.
const REPLAY_TONES = ['smooth', 'direct', 'funny', 'warmer', 'bolder', 'shorter', 'longer'];
function replayChangeTone() {
  const cur = _replayCurrentStyle();
  document.getElementById('yr-tone-grid').innerHTML = REPLAY_TONES.map(t => `
    <button type="button" class="yr-tone${t === cur ? ' selected' : ''}" onclick="replayPickTone('${t}')">
      <img src="assets/icons/reply-styles/${t}.${ICON_EXT}" alt="" draggable="false">
      <span>${STYLE_LABELS[t]}</span>
    </button>`).join('');
  document.getElementById('yr-tone-overlay').hidden = false;
}

function closeReplayToneSheet() {
  document.getElementById('yr-tone-overlay').hidden = true;
}

function replayPickTone(style) {
  closeReplayToneSheet();
  if (style === _replayCurrentStyle()) return;
  ZeloAnalytics.track('tone_selected', { tone: style });
  _replaySwitchStyle(style);
}

// ---- "Explain why" — real AI Coach, not a canned line. Opens the same
// AI Coach chat sheet as the header's "Ask AI Coach" (openAiCoachFromScan()),
// then sends an actual question into it exactly like a user typing one
// (sendAiCoachMessage()) — same chat UI, same live DeepSeek call. So Zelo
// answers about THIS specific suggested reply (not the message in general),
// _aiCoachExplainCard is stashed for _buildAiCoachMessages() to fold into the
// system prompt as real context: the card's exact text + tone label. ----
let _aiCoachExplainCard = null; // { style, text } — read by _buildAiCoachMessages(); cleared whenever the sheet opens fresh

function showReplyExplain() {
  const style = _replayCurrentStyle();
  const text  = state.asstCurrentSet[style];
  if (!text) return; // still loading/failed — nothing to ask about yet
  openAiCoachFromScan();               // resets _aiCoachExplainCard to null, opens the sheet
  _aiCoachExplainCard = { style, text };
  sendAiCoachMessage('Why does this reply work?');
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
  const text = _currentReplyText();
  // Button itself stays "Copy" always — confirmation is the toast now
  // (showCopyToast() below), not a label swap. Clipboard write failures
  // still show the toast (silent fallback, matches the previous behavior).
  navigator.clipboard.writeText(text).then(showCopyToast).catch(showCopyToast);
  ZeloRecords.markReplyCopied((state.asstReplyIds || {})[state.asstStyle]);
}

const COPY_TOAST_DURATION = 2750; // ms — 2.5-3s is standard for this kind of toast
let _copyToastTimer = null;
let _copyToastHideTimer = null;

// Single reusable toast node (#copy-toast in index.html) instead of
// creating a new one per call — tapping Copy again while it's already
// showing just restarts the countdown bar and the auto-dismiss timer in
// place, rather than stacking a second toast.
function showNotice(title, message) { showCopyToast(message, title, true); }
function showCopyToast(message, title, megaphone) {
  const toast = document.getElementById('copy-toast');
  const bar   = document.getElementById('copy-toast-bar');
  if (!toast || !bar) return;
  const sub = toast.querySelector('.copy-toast-sub');
  if (sub) sub.textContent = message || 'Zelo response copied to clipboard';
  const ttl = toast.querySelector('.copy-toast-title');
  if (ttl) ttl.textContent = title || 'Copied!';   // other banners (feature requests) pass their own heading
  // Feature-request notices show the megaphone instead of the check mark; every other caller keeps the check.
  const icon = toast.querySelector('.copy-toast-icon');
  if (icon) {
    if (!icon.dataset.check) icon.dataset.check = icon.innerHTML;
    if (megaphone) {
      icon.innerHTML = '<img alt="" src="assets/icons/settings/settings2-icon-feature-request' + (isDarkModeActive() ? '-dark' : '') + '.png">';
    } else if (icon.querySelector('img')) icon.innerHTML = icon.dataset.check;
    toast.classList.toggle('copy-toast--megaphone', !!megaphone);
  }

  clearTimeout(_copyToastTimer);
  clearTimeout(_copyToastHideTimer);
  toast.hidden = false;

  // Restart the drain bar cleanly even mid-animation: kill any transition
  // in progress and snap back to full, force a reflow so the browser
  // re-registers that starting state, then start draining from it.
  bar.style.transition = 'none';
  bar.style.width = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${COPY_TOAST_DURATION}ms linear`;
  bar.style.width = '0%';

  requestAnimationFrame(() => toast.classList.add('visible'));

  _copyToastTimer = setTimeout(hideCopyToast, COPY_TOAST_DURATION);
}

function hideCopyToast() {
  const toast = document.getElementById('copy-toast');
  if (!toast) return;
  clearTimeout(_copyToastTimer);
  clearTimeout(_copyToastHideTimer);
  toast.classList.remove('visible');
  // Wait out the fade-out transition before removing it from layout, so a
  // fresh showCopyToast() call (which clears this same timer) can't have
  // its brand-new toast yanked hidden by a stale one.
  _copyToastHideTimer = setTimeout(() => { toast.hidden = true; }, 340); // = the slide-up transition (.copy-toast)
}


// ================================================================
