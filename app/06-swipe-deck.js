// ================================================================
// 06-swipe-deck.js — the practice card deck
//
// Building and rendering the stack of cards, the photo stepper, and the
// drag/throw gesture (including rewind and the edge bounce).
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
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
  rotate:   0,
};

const SWIPE_THRESHOLD = 90;  // px from center to commit a swipe — still deliberate, not a light nudge, just reachable without a long drag
const MAX_ROTATION    = 15;   // max degrees of tilt while dragging
const DRAG_FOLLOW_RESISTANCE = 0.8; // card visually translates at 80% of the raw finger delta — gives the drag some "weight" instead of a raw 1:1 snap; rotation/stamps/back-card feedback stay tied to the true (undamped) distance so progress-toward-threshold still reads accurately
const TAP_MAX_MOVEMENT = 6;   // px — below this, a release counts as a tap, not a drag

// The card's visible POSITION lags behind the raw finger delta via
// exponential smoothing — same technique, same 0.3 factor, already proven
// on the onboarding demo card (see cineArmDragSmoothing()). A fast/long
// real flick can otherwise translate the raw delta far past where
// commitSwipe()'s own fixed-duration fly-off animation is headed (its
// target is a constant screen-relative point, not relative to wherever the
// drag let go) before that animation even starts — reading as "the swipe
// is instant" on a fast gesture, and only looking right when dragged
// slowly. Rotation and the stamp/back-card feedback deliberately keep
// tracking the raw, unsmoothed delta (see DRAG_FOLLOW_RESISTANCE's own
// comment) — only the rendered position is speed-capped, so how quickly a
// drag counts toward the threshold doesn't change, just how fast the card
// visibly travels once it's moving.
let _deckSmoothRAF = null;
function _startDeckDragSmoothing(card) {
  if (_deckSmoothRAF) cancelAnimationFrame(_deckSmoothRAF);
  let visX = 0, visY = 0;
  const step = () => {
    if (!drag.active || drag.card !== card) { _deckSmoothRAF = null; return; }
    visX += (drag.currentX - visX) * 0.3;
    visY += (drag.currentY - visY) * 0.3;
    card.style.transform =
      `translate(${visX * DRAG_FOLLOW_RESISTANCE}px, ${visY * 0.4 * DRAG_FOLLOW_RESISTANCE}px) rotate(${drag.rotate}deg)`;
    _deckSmoothRAF = requestAnimationFrame(step);
  };
  _deckSmoothRAF = requestAnimationFrame(step);
}


// ================================================================
// initSwipeDeck()
// Called by showTab('practice'). Shuffles the PROFILES pool only
// when the deck is exhausted; otherwise resumes where it left off.
// ================================================================

// ---- Who appears in the deck -----------------------------------------
// The deck draws from one of two libraries, chosen by the "Who to practice
// with" setting (zelo_practice_mode: women / men / nonbinary / both) combined with
// who the user is (zelo_onb_gender) — see initSwipeDeck's "which library".
// Women, men, and non-binary choices all draw from real persona records.
//
// On top of that sits the Age Range screen. It has a dual-handle slider
// (zelo_age_filter_min / _max) and a "Show only people in this age range"
// toggle (zelo_age_filter_strict, on by default); picking a preset row just
// moves the slider. Until now none of that reached the deck: the old filter
// matched presets against `profile.age_pool`, and the 10 pilot profiles carry
// '18-24' — a value no preset ever mapped to — so the lookup always came up
// empty and silently fell back to EVERYONE. The filter now reads the real age.
function _ageFilterRange() {
  const lo = localStorage.getItem('zelo_age_filter_min');
  const hi = localStorage.getItem('zelo_age_filter_max');
  let min = lo === null ? null : parseInt(lo, 10);
  let max = hi === null ? null : parseInt(hi, 10);
  if (min === null && max === null) {
    const preset = AGE_FILTER_PRESET_RANGES[localStorage.getItem('zelo_age_range')];
    if (!preset) return null;                       // nothing chosen: any age
    [min, max] = preset;
  }
  if (min === null || isNaN(min)) min = AGE_FILTER_MIN_BOUND;
  if (max === null || isNaN(max)) max = AGE_FILTER_MAX_BOUND;
  // The slider's top stop (39) is open-ended: anything at or past it counts.
  const open = max >= AGE_FILTER_MAX_BOUND;
  if (min <= AGE_FILTER_MIN_BOUND && open) return null;   // full span = any age
  return { min, max: open ? Infinity : max };
}

function _ageFilterStrict() {
  return (localStorage.getItem('zelo_age_filter_strict') ?? 'true') === 'true';
}

// Text for Practice Preferences' "Age range" row.
function _ageRangeLabel() {
  const r = _ageFilterRange();
  if (!r) return 'Any';
  return `${r.min}–${r.max === Infinity ? AGE_FILTER_MAX_BOUND : r.max}`;
}

// Anything that changes who can appear has to throw the current deck away,
// or the change is invisible until it happens to run out.
function _invalidateDeck() {
  state.swipeIndex = state.swipeProfiles.length;
}

// opts.fresh rebuilds the deck even if the current one still has cards;
// opts.ignoreSkipped builds it from the FULL pool instead of leaving out
// Skipped Profiles — and, for the same reason, ignores the age range. The
// practice tutorial uses both: it needs at least 3 cards (swipe-right lesson,
// swipe-left lesson, photo-nav lesson) and running out mid-lesson silently
// ends the whole tutorial, so it must never depend on how many profiles
// someone happened to have skipped or filtered out.
// The practice tutorial always opens on these two, so every user is taught on
// the same cards: Kendra (24), 4th photo, for "swipe right"; Haeun (21), 3rd
// photo, for "swipe left". `photo` is the 0-based slot.
const PRACTICE_TUTORIAL_CARDS = [{ id: 'z019', photo: 3 }, { id: 'z026', photo: 2 }];

// Identity labels that put a persona in the non-binary deck. Matched against
// the roster's own free-text `identity` string (e.g. "nonbinary (they/them)",
// "genderfluid (she/they)"), so adding a persona is a data change only.
const NONBINARY_IDENTITY_RE = /non-?binary|enby|genderqueer|genderfluid|agender/i;

function initSwipeDeck(opts = {}) {
  if (opts.fresh || state.swipeIndex >= state.swipeProfiles.length) {
    // A reshuffled deck is a clean slate — a profile coming back around
    // later should start on photo 1, not wherever it was left last time.
    _forgetCardPhotoIndexes();
    state.deckEmptyReason = null;
    state.skipHistory = [];
    const practiceMode = _practiceMode();
    const myGender = localStorage.getItem('zelo_onb_gender');
    const skippedIds = opts.ignoreSkipped ? new Set() : _skippedProfileIds();
    // The tutorial's two demo cards are fixed, and are kept out of the deck
    // that follows it so they don't come straight back round.
    const excluded = new Set(opts.exclude || []);
    const finishDeck = () => {
      if (opts.tutorial) {
        const lead = PRACTICE_TUTORIAL_CARDS.map(c => PROFILES.find(p => p.id === c.id)).filter(Boolean);
        const leadIds = new Set(lead.map(p => p.id));
        state.swipeProfiles = [...lead, ...state.swipeProfiles.filter(p => !leadIds.has(p.id))];
        PRACTICE_TUTORIAL_CARDS.forEach(c => { _cardPhotoIndex[c.id] = c.photo; });
      }
      // Keep a given card on top if it is still part of the deck — used so the
      // card the user has already been looking at doesn't swap under them.
      if (opts.pin) {
        const i = state.swipeProfiles.findIndex(p => p.id === opts.pin);
        if (i > 0) state.swipeProfiles.unshift(...state.swipeProfiles.splice(i, 1));
      }
    };

    // Non-binary draws only on real persona records whose own identity label
    // puts them under the non-binary umbrella — never on placeholder cards.
    // The roster is small (both persona files carry `identity`, so this grows
    // on its own as more are written), which is why running out gets its own
    // honest empty state instead of the generic "widen your filters" one.
    if (practiceMode === 'nonbinary') {
      const isEnby = p => NONBINARY_IDENTITY_RE.test(p.identity || '');
      let pool = ALL_PROFILES.filter(p => isEnby(p) && !skippedIds.has(p.id) && !excluded.has(p.id));
      // Everyone skipped — refill rather than show an empty deck, same as the
      // other libraries do.
      if (pool.length === 0) pool = ALL_PROFILES.filter(p => isEnby(p) && !excluded.has(p.id));
      state.swipeProfiles = shuffleArray([...pool]);
      state.swipeIndex    = 0;
      if (pool.length === 0) state.deckEmptyReason = 'nonbinary';
      finishDeck();
      renderDeck();
      return;
    }

    // 1) which library — decided by WHO THEY ARE and who they want, not by a
    // sexuality label. The 100 "women" personas are written as straight women and
    // the 35 "other" ones as LGBTQ+ women:
    //   man  + Women -> the straight-women library only
    //   woman + Women -> the LGBTQ+ women first, the rest after (so the deck is
    //                    never tiny) — she can be gay or bi, we never ask
    //   anyone else + Women, and Everyone -> the whole library, mixed
    // Men mirror it exactly: the 71 "men" personas are written as straight men
    // and the 30 "other-men" ones as gay, bi, trans and non-binary, so a woman
    // practising with men gets the straight library and a man gets the queer
    // one first.
    const WOMEN_CATS = ['women', 'other'], MEN_CATS = ['men', 'other-men'];
    let pool = ALL_PROFILES.filter(p => !excluded.has(p.id));
    let leadCategory = null;
    if (practiceMode === 'women') {
      pool = pool.filter(p => WOMEN_CATS.includes(p.category));
      if (myGender === 'male') pool = pool.filter(p => p.category !== 'other');
      else if (myGender === 'female') leadCategory = 'other';
    } else if (practiceMode === 'men') {
      pool = pool.filter(p => MEN_CATS.includes(p.category));
      if (myGender === 'female') pool = pool.filter(p => p.category !== 'other-men');
      else if (myGender === 'male') leadCategory = 'other-men';
    }

    // 2) the age range
    const range = opts.ignoreSkipped ? null : _ageFilterRange();
    let preferred = null;
    if (range) {
      const inRange = p => p.age >= range.min && p.age <= range.max;
      if (_ageFilterStrict()) {
        pool = pool.filter(inRange);             // "show ONLY people in this range"
      } else {
        preferred = new Set(pool.filter(inRange).map(p => p.id));   // soft: range first
      }
    }

    // A strict range can legitimately match nobody (e.g. Other option, 18-19
    // only has a couple of people). Say so, rather than quietly showing
    // everyone — that would contradict the very setting the user just made.
    if (pool.length === 0) {
      state.swipeProfiles = [];
      state.swipeIndex    = 0;
      state.deckEmptyReason = 'filter';
      renderDeck();
      return;
    }

    // 3) skipped profiles
    // Skipped Profiles' whole premise ("won't show up again" / Unskip to
    // undo that) needs an actual exclusion here — without it the deck
    // already re-includes everyone on its own next reshuffle regardless
    // of anyone's skip history, making both halves of that page a no-op.
    let unseen = pool.filter(p => !skippedIds.has(p.id));
    if (unseen.length === 0) unseen = pool; // everyone in the pool is skipped — refill rather than dead-end the deck

    // Soft orderings (age range when not strict, then the lead category), each
    // shuffled inside its own tier.
    const rank = p => (preferred && !preferred.has(p.id) ? 2 : 0) + (leadCategory && p.category !== leadCategory ? 1 : 0);
    const tiers = [[], [], [], []];
    unseen.forEach(p => tiers[rank(p)].push(p));
    state.swipeProfiles = tiers.flatMap(t => shuffleArray(t));
    state.swipeIndex = 0;
    finishDeck();
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

function renderDeck(opts = {}) {
  const deck      = document.getElementById('card-deck');
  // A card mid-fly-off is passed in so the deck can be rebuilt UNDER it
  // while it is still animating out — see commitSwipe.
  const keep      = (opts.keep && opts.keep.parentNode === deck) ? opts.keep : null;
  // Every card still flying out is kept, not just the newest one — a skip's
  // fly-off must finish too, or its "skipped" record is never written.
  [...deck.children].forEach(ch => { if (ch !== keep && !ch.classList.contains('swipe-card--flying')) ch.remove(); });

  const remaining = state.swipeProfiles.length - state.swipeIndex;

  if (remaining <= 0) {
    const reason  = state.deckEmptyReason;
    // 'nonbinary' gets its own copy: the non-binary roster is small, so telling
    // someone to widen their age range would be false advice — no age range
    // produces more people.
    const icon  = reason === 'nonbinary' ? '🌱' : reason === 'filter' ? '🔍' : '✨';
    const title = reason === 'nonbinary' ? 'More profiles on the way'
                : reason === 'filter'    ? 'No one matches your filters'
                : "You've seen everyone";
    const sub   = reason === 'nonbinary' ? "We're still writing non-binary characters. You can switch who you practise with in Home settings."
                : reason === 'filter'    ? 'Try widening your age range in Home settings.'
                : 'Check your Chats or come back later for new people.';
    deck.insertAdjacentHTML('afterbegin', `
      <div class="deck-empty">
        <div class="deck-empty-icon">${icon}</div>
        <div class="deck-empty-title">${title}</div>
        <div class="deck-empty-sub">${sub}</div>
      </div>`);
    disableSwipeButtons();
    return;
  }

  const count = Math.min(3, remaining);

  // Render back-to-front: stack index 2 first, 0 last (sits on top)
  for (let i = count - 1; i >= 0; i--) {
    const profile = state.swipeProfiles[state.swipeIndex + i];
    const cardEl  = buildCardElement(profile, i);
    if (keep) deck.insertBefore(cardEl, keep); else deck.appendChild(cardEl);
  }

  // Only the top card gets drag listeners
  const topCard = deck.querySelector('[data-stack="0"]');
  if (topCard) attachDragListeners(topCard);

  enableSwipeButtons();
}

// REMOVED (2026-10-10h): a `new Image()` preloader for the next few
// profiles' first photo. It measurably bought nothing — the promoted card
// reuses the src the card behind already loaded, so it reports `complete`
// on the first frame either way — while forcing a FULL decode of each
// preloaded photo. These are 1080x1350, i.e. ~5.6 MB of bitmap each once
// decoded, so it added ~22 MB on top of the deck's own ~17 MB, every
// single swipe. Suspected cause of images elsewhere failing to decode and
// video going black on device; nothing else is worth that risk.


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

// EXPERIMENT (2026-10-10): floating pill tab bar, in the style of LINE's —
// a detached rounded bar inset from the screen edges with a soft grey chip
// behind the active tab, instead of the full-width frosted-glass bar.
// Flip to false to go back; everything else is driven off the
// .tab-bar--floating class, so the original bar is untouched.
const TAB_BAR_FLOATING = true;
function _applyFloatingTabBar() {
  if (!TAB_BAR_FLOATING) return;
  document.getElementById('tab-bar')?.classList.add('tab-bar--floating');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _applyFloatingTabBar);
} else {
  _applyFloatingTabBar();
}

// Full-bleed card layout: the photo fills the whole card and the name /
// actions sit over it behind a gradient scrim, instead of below it on a
// white panel. Flip this one constant to go back to the panel layout —
// everything else is driven off the .swipe-card--full class.
const CARD_FULL_BLEED = true;

// Show the photo at its true aspect ratio (object-fit: contain) with a
// blurred copy of itself filling the leftover space, instead of cropping it
// to the card (object-fit: cover). Nothing is cut off — the trade is that
// the subject renders smaller. Flip to true for the uncropped look.
// Currently false: back to the 2026-10-09m cover-cropped look on request.
const CARD_PHOTO_UNCROPPED = false;

// The two pills at the top-left of a card: what she is (orientation) and what she
// is looking for. Placeholder cards have neither, so they get no pills.
function _cardPillsHTML(profile) {
  const intent = profile.intent && PERSONA_INTENTS[profile.intent];
  if (!profile.orientation && !intent) return '';
  return `<div class="swipe-card-pills" aria-hidden="true">
    ${profile.orientation ? `<span class="swipe-card-pill swipe-card-pill--orient">${_escapeHtml(profile.orientation)}</span>` : ''}
    ${intent ? `<span class="swipe-card-pill swipe-card-pill--intent">${_escapeHtml(intent.label)}</span>` : ''}
  </div>`;
}

function buildCardElement(profile, stackIndex) {
  const card        = document.createElement('div');
  card.className    = 'swipe-card'
    + (CARD_FULL_BLEED ? ' swipe-card--full' : '')
    + (CARD_PHOTO_UNCROPPED ? ' swipe-card--uncropped' : '')
    + (_practiceTutorialActive ? ' swipe-card--bare' : '');   // tutorial: photo only, no name/buttons
  card.dataset.stack = stackIndex;
  card._profile     = profile; // read by _navigateCardPhoto() to swap photo slots

  // renderDeck() wipes and rebuilds every card, so without this the photo
  // slot resets to 1 every time the deck is re-rendered — which includes
  // simply leaving the Practice tab and coming back.
  const startIdx = _rememberedPhotoIndex(profile);
  card.dataset.photoIndex = String(startIdx);

  const photos   = (profile.photos && profile.photos.length) ? profile.photos : null;
  const startSrc = photos ? (photos[startIdx] || photos[0]) : '';
  // Two stacked layers, swapped by _setCardPhoto() so a photo change can
  // cross-fade instead of popping. Each holds both image layers (the
  // contained photo and, in uncropped mode, the blurred backdrop) so the
  // pair always moves together.
  // The blurred backdrop only exists in uncropped mode, where it is the
  // thing that fills the space beside a contained photo. In cropped mode it
  // is `display: none` — but a hidden <img> with a src still downloads AND
  // decodes, and at 1080x1350 that is ~5.6 MB of bitmap per card for
  // something never drawn. Emit it only when it is actually used.
  const photoLayer = (active) => `
    <div class="swipe-card-photo-layer${active ? ' is-active' : ''}">
      ${CARD_PHOTO_UNCROPPED
        ? `<img class="swipe-card-photo-bg" src="${startSrc}" alt="" aria-hidden="true" onerror="this.remove()">`
        : ''}
      <img class="swipe-card-photo-main" src="${startSrc}" alt="" aria-hidden="true" onerror="this.remove()">
    </div>`;

  card.innerHTML = `
    <div class="swipe-card-photo">
      ${photos ? `<div class="swipe-card-photo-stack">${photoLayer(true)}${photoLayer(false)}</div>` : ''}
      <div class="swipe-card-progress" aria-hidden="true">
        ${Array.from({ length: SWIPE_PHOTO_SLOTS }, (_, i) =>
          `<span class="swipe-card-progress-seg${i === startIdx ? ' is-active' : ''}"></span>`).join('')}
      </div>
      ${_cardPillsHTML(profile)}
      ${photos ? '' : `<span class="swipe-photo-label">Card ${startIdx + 1}</span>`}
    </div>
    <div class="swipe-card-bare-blur" aria-hidden="true"></div>
    <div class="swipe-stamp swipe-stamp--like">LIKE ♥</div>
    <div class="swipe-stamp swipe-stamp--nope">NOPE ✕</div>
    <div class="swipe-card-overlay">
    <div class="swipe-card-body">
      <div class="swipe-card-name-row">
        <span class="swipe-card-name">${profile.name}, ${profile.age}</span>
        ${stackIndex === 0 ? `<button type="button" class="swipe-card-info-btn" onclick="openProfileDetail()" aria-label="More info">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9.5"/>
            <line x1="12" y1="11" x2="12" y2="16.5"/>
            <circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none"/>
          </svg>
        </button>` : ''}
      </div>
      <span class="swipe-card-occ">${profile.occupation}</span>
    </div>
    <hr class="swipe-card-divider"/>
    <div class="swipe-card-actions">
      <button type="button" class="swipe-rewind-btn"${stackIndex === 0 ? ' id="btn-rewind" onclick="onRewindBtn()"' : ' tabindex="-1" aria-hidden="true"'}${(state.skipHistory && state.skipHistory.length) ? '' : ' disabled'} aria-label="Bring back the last person you skipped"><span class="swipe-rewind-ic" aria-hidden="true"></span></button>
      <button type="button" class="swipe-action-btn swipe-action-btn--skip"${stackIndex === 0 ? ' id="btn-skip" onclick="onSkipBtn()"' : ' tabindex="-1" aria-hidden="true"'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Skip
      </button>
      <button type="button" class="swipe-action-btn swipe-action-btn--like"${stackIndex === 0 ? ' id="btn-like" onclick="onLikeBtn()"' : ' tabindex="-1" aria-hidden="true"'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        I'm Interested
      </button>
    </div>
    </div>
  `;

  return card;
}

// Tap left/right half of the card's photo to step back/forward through its
// 4 "cards" (replaces the old tap-anywhere-opens-profile-detail behavior
// and the (i) "more about them" popup — both removed). Only card slots
// 2-4 exist as placeholders for now; real per-slot photos are a separate,
// later pass (see SWIPE_PHOTO_SLOTS).
const SWIPE_PHOTO_SLOTS = 4;

// How long the cross-fade between two photo slots runs. Kept in sync with
// .swipe-card-photo-layer.is-entering's animation duration in style.css.
const CARD_PHOTO_FADE_MS = 260;

// Which photo slot each profile was last left on, so re-rendering the deck
// (leaving the Practice tab and coming back, a settings change, anything
// that calls renderDeck()) doesn't throw you back to photo 1. Keyed by
// profile id; cleared whenever the deck is reshuffled from scratch.
const _cardPhotoIndex = Object.create(null);

function _cardPhotoKey(profile) {
  return profile && (profile.id || profile.name) || '';
}

function _rememberedPhotoIndex(profile) {
  const saved = _cardPhotoIndex[_cardPhotoKey(profile)];
  if (!saved) return 0;
  return Math.max(0, Math.min(SWIPE_PHOTO_SLOTS - 1, saved));
}

function _forgetCardPhotoIndexes() {
  for (const k in _cardPhotoIndex) delete _cardPhotoIndex[k];
}

// Swaps the visible photo by promoting the inactive layer rather than
// re-pointing one <img>'s src, so the new photo fades in over the old one
// instead of popping. The outgoing layer deliberately keeps opacity 1 and
// just drops behind — fading BOTH would let the black card background show
// through at the midpoint and read as a dip to dark.
function _setCardPhoto(cardEl, idx, photos) {
  const layers = cardEl.querySelectorAll('.swipe-card-photo-layer');
  if (layers.length < 2 || !photos || !photos[idx]) return;

  const cur = cardEl.querySelector('.swipe-card-photo-layer.is-active') || layers[0];
  const nxt = (cur === layers[0]) ? layers[1] : layers[0];
  nxt.querySelectorAll('img').forEach(im => { im.src = photos[idx]; });

  // Guards a fast double-tap: two decodes can be in flight at once, and
  // without this the slower one could land last and show the wrong slot.
  const gen = cardEl._photoGen = (cardEl._photoGen || 0) + 1;
  const show = () => {
    if (cardEl._photoGen !== gen) return;
    // Removing + reflowing first, so a re-tap mid-fade restarts the
    // animation instead of being swallowed by the running one.
    nxt.classList.remove('is-entering');
    void nxt.offsetWidth;
    nxt.classList.add('is-active', 'is-entering');
    cur.classList.remove('is-active');
    // The entrance must not stay on the element: a permanent `animation`
    // replays on every reparent (see the 2026-10-09j swipe-blink case).
    setTimeout(() => nxt.classList.remove('is-entering'), CARD_PHOTO_FADE_MS + 40);
  };

  // Decode before showing, so the fade can never reveal a half-painted
  // image on a slot that isn't in the cache yet.
  const main = nxt.querySelector('.swipe-card-photo-main');
  if (main && main.decode) main.decode().then(show).catch(show);
  else show();
}

function _renderCardProgress(cardEl, idx) {
  cardEl.querySelectorAll('.swipe-card-progress-seg')
    .forEach((seg, i) => seg.classList.toggle('is-active', i === idx));
}

function _navigateCardPhoto(cardEl, dir) {
  const current = Number(cardEl.dataset.photoIndex) || 0;
  const next = Math.max(0, Math.min(SWIPE_PHOTO_SLOTS - 1, current + dir));
  // Already at the first or last photo: this used to do nothing at all, so
  // there was no way to tell "there's nothing there" from "the tap missed".
  // Nudge the card a short way in the attempted direction and let it spring
  // back, the way a scroll view rubber-bands at its end.
  if (next === current) { _bounceCardEdge(cardEl, dir); return; }
  // A real move cancels any edge bounce still playing, so the card can't be
  // mid-rubber-band while the photo changes under it.
  cardEl.classList.remove('swipe-card--edge-left', 'swipe-card--edge-right');
  cardEl.dataset.photoIndex = String(next);
  _renderCardProgress(cardEl, next);
  if (cardEl._profile) _cardPhotoIndex[_cardPhotoKey(cardEl._profile)] = next;
  const label = cardEl.querySelector('.swipe-photo-label');
  if (label) label.textContent = 'Card ' + (next + 1);
  // Real photo for this slot, when the profile has one. The per-slot
  // placeholder colours stay as the fallback for profiles that don't.
  const photos = (state.deckProfiles && state.deckProfiles[Number(cardEl.dataset.stack)] || {}).photos
              || (cardEl._profile && cardEl._profile.photos);
  _setCardPhoto(cardEl, next, photos);
}

// ================================================================
// DRAG / TOUCH SYSTEM
// Mouse and touch share the same onDragStart/Move/End handlers.
// Mouse listeners for move/up go on document so the card doesn't
// lose track when the cursor leaves the card boundary.
// ================================================================

// True from the moment a RIGHT swipe is committed until its fly-off finishes
// and the match page is on its way. Without it you could keep swiping while the
// first like was still in flight: each later commitSwipe rebuilt the deck and
// removed the earlier flying card before its transitionend fired, so that like
// never produced a match page and was never counted.
let _swipeLock = false;
let _swipeLockTimer = null;
function _releaseSwipeLock() { _swipeLock = false; clearTimeout(_swipeLockTimer); _swipeLockTimer = null; }

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
  // Don't start drag when tapping Skip/I'm Interested (they live inside
  // the card now, not a separate pinned bar) or the (i) info button.
  if (e.target.closest && e.target.closest('.swipe-card-actions')) return;
  if (e.target.closest && e.target.closest('.swipe-card-info-btn')) return;
  // ...or the practice-tutorial's photo-nav lesson — it has its own tap
  // handler (_practiceTutorialPhotoTap); without this exclusion, that same
  // tap also reached the card's own tap-to-navigate-photos logic in
  // onDragEnd (stopPropagation() on the tutorial's click handler doesn't
  // stop it — mousedown/touchend are separate listeners, not part of the
  // click bubble it's stopping), advancing the real photo index behind
  // the tutorial's own fake one.
  if (e.target.closest && e.target.closest('.ptw-photo-nav-overlay')) return;
  // Ignore if we're mid-animation or a reply is pending
  if (drag.active) return;
  if (_swipeLock && e.currentTarget.id !== 'cine-swipe-card') return;

  const touch = e.touches ? e.touches[0] : e;
  drag.active   = true;
  drag.card     = e.currentTarget;
  drag.startX   = touch.clientX;
  drag.startY   = touch.clientY;
  drag.currentX = 0;
  drag.currentY = 0;
  drag.rotate   = 0;

  // Remove transition so card snaps to finger immediately
  drag.card.style.transition = 'none';

  // The onboarding demo card owns its own separate smoothing loop instead
  // (see cineArmDragSmoothing(), attached alongside this same listener) —
  // it already reads from this same drag.currentX/currentY, so running a
  // second loop here too would just fight it over the same transform.
  if (drag.card.id !== 'cine-swipe-card') _startDeckDragSmoothing(drag.card);

  // Stop the demo the moment a real drag begins (tutorial only — guarded
  // since the guided-tour script that declares tourSwipeArmed is archived
  // and not loaded in the shipped bundle)
  if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) cancelSwipeDemo();

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

  // Clamp ratio to ±1 for rotation calc; allow card to move freely beyond.
  // Stays tied to the raw, unsmoothed delta on purpose (see
  // DRAG_FOLLOW_RESISTANCE's own comment) — only the rendered POSITION is
  // speed-capped (_startDeckDragSmoothing()'s rAF loop, reading drag.rotate
  // set here), so progress-toward-threshold still reads accurately and
  // rotation/stamps keep responding immediately, not laggily.
  const ratio   = Math.max(-1, Math.min(1, drag.currentX / SWIPE_THRESHOLD));
  drag.rotate   = ratio * MAX_ROTATION;

  // The onboarding demo card owns its own separate eased rAF follow
  // instead (see cineArmDragSmoothing()); the real deck's own follow is
  // driven by _startDeckDragSmoothing()'s loop (started in onDragStart),
  // not here — this function only feeds it drag.currentX/currentY/rotate.

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

  // A touchend that isn't preventDefault()-ed causes the browser to also
  // synthesize a mousedown/mouseup/click sequence a moment later for
  // compatibility — since mousedown is bound directly on the card (see
  // attachDragListeners) and drag.active is already false by then, that
  // synthetic sequence re-enters this same tap-handling logic a second time
  // and double-applies whatever the tap just did (e.g. stepping 2 photo
  // slots per tap instead of 1). Suppressing it here is the standard fix.
  if (e.touches) e.preventDefault();

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);

  const moved = Math.max(Math.abs(drag.currentX), Math.abs(drag.currentY));

  if (Math.abs(drag.currentX) >= SWIPE_THRESHOLD) {
    const direction = drag.currentX > 0 ? 'right' : 'left';
    commitSwipe(drag.card, direction);
  } else {
    springBack(drag.card);
    // A release with barely any movement is a tap, not a drag — step
    // back/forward through this card's photos depending on which half was
    // tapped (left = back, right = forward), instead of treating it as a
    // swipe. Not applicable to the onboarding demo card — it isn't backed
    // by state.swipeProfiles. Also suppressed during the swipe-right/
    // swipe-left tutorial steps — a stray tap there shouldn't advance a
    // real photo mid-lesson.
    if (moved < TAP_MAX_MOVEMENT && drag.card.id !== 'cine-swipe-card' && !_practiceTutorialActive) {
      const rect = drag.card.getBoundingClientRect();
      const tappedLeftHalf = (drag.startX - rect.left) < rect.width / 2;
      _navigateCardPhoto(drag.card, tappedLeftHalf ? -1 : 1);
    }
  }
}

// Interpolate back-cards toward their next stack position as the top card is dragged
function animateBackCards(absRatio) {
  const deck  = document.getElementById('card-deck');
  const card1 = deck ? deck.querySelector('[data-stack="1"]') : null;
  const card2 = deck ? deck.querySelector('[data-stack="2"]') : null;

  // Tutorial cards behind the top one stay invisible: these inline writes
  // outrank the stylesheet's opacity:0, which is how the next card showed
  // up behind the one being dragged.
  if (card1 && card1.classList.contains('swipe-card--bare')) return;
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
  // Force a reflow before changing transform — see the matching comment in
  // commitSwipe(); same fast-release "no animation" bug, same fix.
  void cardEl.offsetWidth;
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
  const ownedByDeckEarly = cardEl.id !== 'cine-swipe-card';
  if (ownedByDeckEarly && _swipeLock) return;     // a like is still flying out
  if (ownedByDeckEarly && direction === 'right') {
    _swipeLock = true;
    clearTimeout(_swipeLockTimer);
    _swipeLockTimer = setTimeout(_releaseSwipeLock, 1600);   // safety: never leave the deck locked
  }
  disableSwipeButtons();

  // Light buzz right as a "like" swipe commits — right only, not left/nope.
  if (direction === 'right') { navigator.vibrate?.(10); _cineHaptic('LIGHT'); }

  // Guided tutorial swipe: confirm meaning with a motion cue (heart vs X).
  if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) flashSwipeFeedback(direction);

  const flyX = direction === 'right'
    ?  _appW()  * 1.6
    : -_appW()  * 1.6;
  const flyR = direction === 'right' ? 30 : -30;

  // Weightier, more deliberate fly-off than a plain accelerate-and-vanish —
  // material's "standard" curve (fast-ish start, controlled deceleration
  // toward the end) reads as the card being thrown with some real mass
  // behind it rather than snapping off-screen.
  // One throw speed everywhere. The tutorial used to shorten this to close
  // the gap before the next lesson, but the gap was never the animation —
  // it was the lesson text waiting on transitionend. The text is shown as
  // the throw begins now (below), so the throw keeps its full weight.
  const flyMs = 0.7;

  // The deck used to only advance once the throw FINISHED, so for the whole
  // fly-off you were looking at the card behind — scaled 0.95 and offset
  // 10px down — and it then snapped to full size the instant it was
  // promoted, which is the text visibly jumping up. Promote now instead:
  // the next card is built, full size and loading while the old one is
  // still leaving, so there is nothing to wait for and nothing to snap.
  // The onboarding demo card isn't backed by the deck at all, so it opts out.
  const ownedByDeck = cardEl.id !== 'cine-swipe-card';
  const flyingProfile = ownedByDeck ? state.swipeProfiles[state.swipeIndex] : null;
  let tutorialHandled = false;
  let tutorialNeedsFinish = false;
  if (ownedByDeck) {
    // Out of the stack's numbering (and so out of its z-index/scale rules)
    // but still in the deck, so its transition is never interrupted.
    cardEl.classList.add('swipe-card--flying');
    cardEl.removeAttribute('data-stack');
    // Rewind history: a skip can be brought back; a like can't (it already
    // became a match), so a like ends the chain.
    if (!_practiceTutorialActive) {
      if (!state.skipHistory) state.skipHistory = [];
      if (direction === 'left') state.skipHistory.push(state.swipeIndex);
      else state.skipHistory = [];
    }
    state.swipeIndex++;
    renderDeck({ keep: cardEl });

    // The next lesson's text lands NOW, over the card that is already in
    // place, rather than waiting out the 0.7s throw on transitionend. That
    // wait was the whole reason the step change felt slow.
    if (_practiceTutorialActive) {
      tutorialHandled = true;
      tutorialNeedsFinish = _handlePracticeTutorialSwipe(direction, 'start');
    }
  }

  cardEl.style.transition = `transform ${flyMs}s cubic-bezier(0.4, 0.0, 0.2, 1)`;
  // Force a reflow before changing transform — same fix already used in
  // cineAdvanceSwipeQueue(). Without it, a release that lands right after a
  // fast drag can have this transition-enable and the transform change
  // land in the same paint, which some engines then apply instantly with
  // no animation at all instead of interpolating (the "teleports, no
  // animation" bug on a quick flick).
  void cardEl.offsetWidth;
  cardEl.style.transform  = `translate(${flyX}px, 0px) rotate(${flyR}deg)`;

  function onFlyOffDone(e) {
    // transitionend bubbles — the like/nope stamps inside this card have
    // their own separate opacity transition (.swipe-stamp, 0.05s), and
    // without this check ITS completion (routinely fired well within the
    // 0.7s fly-off, any time the last touchmove before release happens to
    // change stamp opacity) would satisfy this listener instead of the
    // card's own transform finishing — cutting the fly-off short and
    // jumping straight to the match screen/next card, reading as the swipe
    // completing "instantly" regardless of how it was actually dragged.
    // Not a plain {once:true}, since that would consume the listener on
    // this first (wrong) event and leave nothing to catch the real one —
    // removed manually instead, only once the right transition actually ends.
    if (e.target !== cardEl || e.propertyName !== 'transform') return;
    cardEl.removeEventListener('transitionend', onFlyOffDone);
    _releaseSwipeLock();

    // Onboarding demo card — a standalone two-card stack, not the real
    // Home tab deck, so it resolves against its own fixed Sophia profile
    // and the onboarding skip flow instead of state.swipeProfiles/renderDeck().
    if (cardEl.id === 'cine-swipe-card') {
      cineCommitDemoSwipe(direction);
      return;
    }

    const profile = flyingProfile;
    cardEl.remove(); // the deck was already advanced when the throw began

    // Practice-tab tutorial: swiping IS the lesson here too — a matching
    // swipe advances to the next step, anything else just re-deals and
    // re-shows the same step's overlay on the new top card. Skips the
    // normal match-overlay/renderDeck continuation entirely while active.
    if (tutorialHandled || _practiceTutorialActive) {
      // The lesson text already advanced when the throw began; only the
      // confirm-profile handoff is deliberately held back to here.
      if (tutorialNeedsFinish) _handlePracticeTutorialSwipe(direction, 'end');
      return;
    }

    // During a Home swipe step, swiping IS the lesson. Each step teaches one
    // direction; a matching swipe advances, anything else just re-deals and
    // re-demos the intended motion.
    if (typeof tourSwipeArmed !== 'undefined' && tourSwipeArmed) {
      cancelSwipeDemo();
      if (direction === tourSwipeDir) {
        tourSwipeArmed = false;
        goNextStep();
      } else {
        runSwipeDemo(tourSwipeDir);        // wrong way — show the move again
      }
      return;
    }

    if (direction === 'right') {
      ZeloAnalytics.track('persona_selected', { persona_id: profile.id });
      _questCountLike(profile && profile.id);
      ZeloActivity.add('like');
      // Swiping and matching are unrestricted — the free-tier limit gates
      // starting a chat (see onStartChatting()), not matching itself.
      showMatchOverlay(profile);
    } else {
      // Rewound before its fly-off finished: it is back in the deck, so it
      // must not be written down as skipped.
      if (state.swipeProfiles.indexOf(profile) >= state.swipeIndex) return;
      _recordSkippedProfile(profile);
    }
  }
  cardEl.addEventListener('transitionend', onFlyOffDone);
}


// ================================================================
