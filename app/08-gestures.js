// ================================================================
// 08-gestures.js — the shared gesture engine, used by most screens
//
// The slide track two screens are dragged in, scroll-position preservation
// across a reparent, tab swiping, edge-swipe-back, and drag-to-close for
// sheets. Change something here and it changes everywhere at once.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

function _getOrCreateSlideTrack(trackId, zIndex) {
  let track = document.getElementById(trackId);
  if (!track) {
    track = document.createElement('div');
    track.id = trackId;
    track.style.cssText = `position:absolute; top:0; left:0; height:100%; display:flex; z-index:${zIndex}; pointer-events:none;`;
    document.getElementById('app').appendChild(track);
  }
  return track;
}

// Snapshot of EVERY scrolled element inside (and including) `el` — the
// screen/tab itself plus any nested overflow:auto list, carousel, sheet, etc.
// Reparenting or changing position on a subtree in WebKit resets scrollTop/
// scrollLeft to 0 on all of them (see _slideMountEl's comments), so anything
// that isn't in this snapshot jumps back to the top the instant a
// swipe-back gesture starts. This used to only cover chat/AI Coach's
// message lists by class name, which is why every OTHER scrollable page
// (settings sub-pages, History, Account, sheets...) still reset. Reading
// scrollTop/scrollLeft on elements that don't scroll is just 0 — cheap, no
// per-element "is this scrollable" check needed.
function _captureScrollState(el) {
  const saved = [];
  const nodes = [el, ...el.querySelectorAll('*')];
  for (const n of nodes) {
    if (n.scrollTop || n.scrollLeft) saved.push([n, n.scrollTop, n.scrollLeft]);
  }
  return saved;
}

// Restores a _captureScrollState() snapshot instantly, bypassing any
// element's own `scroll-behavior: smooth` (chat/AI Coach both set it) — a
// plain `el.scrollTop = x` assignment is one of the operations that CSS
// property animates, so without forcing 'auto' first, restoring the
// position would itself visibly animate the content scrolling back into
// place — the exact "screen moves" motion this exists to prevent.
function _restoreScrollState(saved) {
  saved.forEach(([n, top, left]) => {
    const prev = n.style.scrollBehavior;
    n.style.scrollBehavior = 'auto';
    n.scrollTop = top;
    n.scrollLeft = left;
    n.style.scrollBehavior = prev;
  });
}

function _slideMountEl(el, track, widthPx) {
  // Read the real, already-correct rendered height BEFORE touching any
  // styles — .tab has its own `bottom: calc(var(--tab-h) + 34px)` (leaves
  // room for the tab bar) and some .screen overrides similarly reserve
  // space at the bottom; both work by combining inset:0 with that bottom
  // value under position:absolute. Clearing top/right/bottom/left to
  // 'auto' below (needed so position:relative doesn't apply them as flow
  // offsets — see that comment) also throws away that height-constraining
  // math, since there's no inset box left to compute it from. Left
  // uncorrected, the element's height then falls back to its own content's
  // natural height instead — taller than before, since it's no longer
  // clipped above the tab bar — which is exactly why flex-filled content
  // (e.g. the Practice tab's card deck) visibly grew longer during a drag
  // and snapped back to its normal size on release. Pinning the captured
  // height explicitly (cleared again in _slideUnmountEl) keeps it
  // identical throughout the drag instead of recomputing from content.
  const height = _rectA(el).height;
  // Capture BEFORE the position:relative switch just below — that switch
  // alone (still position:absolute at this point, before any reparenting)
  // already resets scrollTop to 0 on a nested overflow-y:auto flex child in
  // WebKit, synchronously, the instant the ancestor's position changes.
  // Reparenting itself (the appendChild further down) turned out not to be
  // the trigger here — this is; confirmed directly against real WebKit.
  const scrollState = _captureScrollState(el);
  // Reparenting a subtree makes WebKit RESTART every CSS animation inside
  // it — so every .msg-row/.typing-row replays its `msgIn` entrance
  // (opacity 0 -> 1 plus a 4px slide), twice per gesture, once on mount and
  // again on unmount. That is the "blink/refresh" on swipe, and it's why an
  // empty chat looks clean and a full one doesn't. Frozen for the gesture.
  document.getElementById('app')?.classList.add('slide-animating');
  el.style.position = 'relative';
  // Base CSS for both .tab and .screen is position:absolute with inset:0,
  // several also override bottom/top individually — under position:relative
  // those same values apply as flow offsets instead of box edges, visually
  // shifting the content. Reset all four explicitly (inset shorthand +
  // each longhand, belt-and-suspenders) so position:relative has no offset.
  el.style.inset = 'auto';
  el.style.top = 'auto';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.left = 'auto';
  el.style.width = widthPx + 'px';
  el.style.height = height + 'px';
  el.style.flex = '0 0 ' + widthPx + 'px';
  el.style.opacity = '1';
  el.style.transform = 'none';
  el.style.pointerEvents = 'none';
  track.appendChild(el);
  // Restore every scrolled element's position (the screen itself and any
  // nested scroller), wiped by the position:relative switch + reparent above
  // (see those comments) — reads as the whole screen jumping to the top the
  // instant a swipe-back gesture starts, visible on any page scrolled away
  // from 0 (originally only chat/AI Coach's message lists were covered).
  _restoreScrollState(scrollState);
  // Reparenting resets scrollLeft on any nested overflow-x:auto descendant
  // (see _slideUnmountEl's matching fix below) — without re-pinning here
  // too, the widget carousel shows card 1 for the entire live drag preview
  // (every frame until the gesture settles and _slideUnmountEl runs),
  // regardless of which card was actually active before the swipe started.
  if (el.id === 'tab-assistant') {
    const wcTrack = document.getElementById('widget-carousel-track');
    if (wcTrack) wcTrack.scrollLeft = _widgetCarouselIndex * wcTrack.clientWidth;
  }
  // This tab/screen's own header (.app-header for tabs, .screen-header for
  // pushed screens — every screen using attachEdgeSwipeBack shares this
  // same _slideMountEl, not just the tab carousel) switches away from its
  // normal CSS position for the drag's duration, to whichever of
  // absolute/relative keeps its FLOW BEHAVIOR identical to what it
  // started with:
  //   - Practice/Scan/Chats' headers, and Account's (#screen-dashboard)
  //     .screen-header, are position:fixed (see #tab-practice .app-header
  //     and the #screen-dashboard .screen-header override in style.css) —
  //     fixed reserves no space in flow at all, which is why those pages
  //     each carry their own compensating padding-top to leave room for
  //     it. A transform on the shared track would hijack fixed's
  //     containing block to be the full 2-page-wide track though
  //     (centering/drifting the header across BOTH pages, not just this
  //     one — this was the real cause of Account's header visibly
  //     sliding toward Scan mid-swipe instead of staying put on its own
  //     page) — switching to ABSOLUTE (relative to `el`, exactly
  //     viewport-width) fixes that math while staying just as
  //     flow-space-free as fixed was, so the page's own padding-top
  //     compensation still lines up.
  //   - History's .app-header and every plain settings sub-page's
  //     .screen-header have no such ID-specific override, so they fall
  //     back to the shared rule: position:sticky, which DOES reserve its
  //     own space in flow (unlike fixed) — WebKit also has a known bug
  //     rendering sticky incorrectly inside a transformed ancestor
  //     (same drifting-toward-the-other-page symptom, different root
  //     cause). Switching these to RELATIVE keeps that same
  //     flow-reserving behavior (no compensating padding needed or
  //     present) while sitting outside sticky's buggy code path.
  // Picking the wrong one of the two here is a real, previously-shipped
  // bug: it double-reserves or zero-reserves the header's own height for
  // the drag's duration (visible content jump), AND/OR lets the header's
  // containing block become the full 2-page track (visible drift toward
  // the other page) — both read as "the header doesn't stay put." Reading
  // the header's OWN computed position before touching it (rather than
  // hardcoding per tab/screen id) keeps this correct automatically if
  // that CSS ever changes.
  const header = el.querySelector(':scope > .app-header, :scope > .screen-header');
  if (header) {
    const wasFixed = getComputedStyle(header).position === 'fixed';
    header.style.position = wasFixed ? 'absolute' : 'relative';
  }
  // Naturally slides in lockstep with the rest of el's own content as the
  // track moves either way, for BOTH tabs sharing the gesture — the whole
  // page, header included, moves as one piece with the drag in either
  // direction, rather than the header staying put while the page slides
  // under it. Never reparenting the header at all is what actually
  // matters for a separate reason: an earlier version moved it out to
  // #app instead, which moves an ancestor of whatever the finger is
  // actively touching mid-gesture — WebKit can silently stop delivering
  // the rest of that touch sequence when that happens, if the drag
  // happened to start on the header itself (e.g. dragging from the
  // history icon), leaving the tab permanently stuck mid-drag. This way
  // avoids that failure mode entirely too, regardless of where the drag
  // starts.
}

function _slideUnmountEl(el) {
  // Capture BEFORE the position reset just below — same WebKit quirk as
  // _slideMountEl's own fix (see its comment): changing this element's
  // position wipes scrollTop on a nested overflow-y:auto flex child
  // synchronously, independent of the reparenting that follows.
  const scrollState = _captureScrollState(el);
  el.style.position = '';
  el.style.inset = '';
  el.style.top = '';
  el.style.right = '';
  el.style.bottom = '';
  el.style.left = '';
  el.style.width = '';
  el.style.height = '';
  el.style.flex = '';
  el.style.opacity = '';
  el.style.transform = '';
  el.style.pointerEvents = '';
  el.style.boxShadow = '';
  document.getElementById('app').appendChild(el);
  _restoreScrollState(scrollState);
  // Undo _slideMountEl's position switch (back to whichever of fixed/sticky
  // its own CSS defines — see _slideMountEl's comment on the two cases).
  const header = el.querySelector(':scope > .app-header, :scope > .screen-header');
  if (header) header.style.position = '';
  // Reparenting a live subtree resets scrollLeft on any nested
  // overflow-x:auto descendant (a WebKit detach/reattach quirk) — the
  // widget carousel's own JS state (_widgetCarouselIndex) survives this
  // untouched, but its visual scroll position silently snaps back to card
  // 1 every time the Scan tab takes part in a swipe-nav gesture, even when
  // Scan is just the tab being slid away FROM. Re-pin it to whichever card
  // was actually active immediately after reattaching.
  if (el.id === 'tab-assistant') {
    const track = document.getElementById('widget-carousel-track');
    if (track) track.scrollLeft = _widgetCarouselIndex * track.clientWidth;
  }
}

function attachTabSwipeGestures(tabName, excludeSelector) {
  const el = document.getElementById('tab-' + tabName);
  if (!el || el._tabGesturesAttached) return;
  el._tabGesturesAttached = true;

  // dx > 0 (dragging right) reveals whichever tab sits to this one's left
  // in the nav order; dx < 0 reveals the one to its right. Either can be
  // null (Home has nothing to its left, Chats nothing to its right).
  const idx = TAB_SWIPE_ORDER.indexOf(tabName);
  const leftTarget  = idx > 0 ? TAB_SWIPE_ORDER[idx - 1] : null;
  const rightTarget = idx < TAB_SWIPE_ORDER.length - 1 ? TAB_SWIPE_ORDER[idx + 1] : null;

  // Note: this tab's own header is NOT special-cased here. It rides along
  // with the rest of the tab's content as one piece throughout the drag —
  // that's the whole point of _slideMountEl's fixed->absolute switch (see
  // its own comment). An earlier version reparented the header out of the
  // tab to keep it visually pinned in place during a swipe; besides
  // fighting what this is actually supposed to look like, moving an
  // ancestor of whatever the finger is actively touching mid-gesture also
  // caused a rare but real bug — WebKit can silently stop delivering the
  // rest of that touch sequence once the touched element's ancestor chain
  // changes, if the drag happened to start on the header itself (e.g.
  // dragging from the history icon) — leaving the tab stuck mid-drag
  // forever with no touchend ever arriving. Never touching the header's
  // place in the DOM tree at all, and never fighting its natural motion
  // with an inline transform, avoids that failure mode entirely.

  // ---- Vertical rubber-band tuning (unchanged from before) ----
  const MAX_PULL = 46;   // px cap — never moves more than this regardless of drag distance
  const RESISTANCE = 90; // higher = stiffer band

  // ---- Horizontal nav-swipe tuning (unchanged) ----
  // Threshold is a real, deliberate distance (not a light nudge) — tuned
  // against screen width so it feels consistent across device sizes,
  // similar in spirit to iOS's own edge-swipe-back gesture.
  const NAV_THRESHOLD = Math.max(90, el.clientWidth * 0.24);
  const AXIS_DEADZONE = 10; // px of ambiguous movement before committing to an axis
  let active = false;      // a single touch is in progress
  let axis = null;         // null (undecided) | 'x' (nav-swipe) | 'y' (rubber-band)
  let startX = 0, startY = 0;
  let pulling = false;     // vertical rubber-band currently engaged
  let destTab = null, destName = null, dir = 0; // the adjacent tab being dragged into view, and which side it's entering from (+1 left, -1 right)
  let gestureToken = 0;    // bumped on every touchstart; lets a stale in-flight finishSlide() loop from a quickly-superseded gesture detect it's obsolete and bail instead of fighting the new one

  // Include the tab's own opacity transition (see .tab in style.css) in
  // every inline transition string set here — otherwise setting
  // el.style.transition would silently replace it and break the tab
  // switch fade the next time this tab is shown/hidden.
  function applyPull(px) {
    el.style.transition = 'transform 0s linear, opacity 0.18s ease';
    el.style.transform = `translateY(${px}px)`;
  }
  function releasePull() {
    el.style.transition = 'transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.18s ease';
    el.style.transform = '';
    pulling = false;
  }

  let track = null; // the shared track element while a gesture owns it
  let base = 0;      // track translateX that shows only `el` at rest (depends on dir)

  // Build the track with `el` and the adjacent tab side by side, ordered
  // so dragging in `direction` reveals the adjacent tab from the correct
  // edge, and park the track at the resting position that shows only `el`.
  function armSlide(name, direction) {
    destName = name;
    dir = direction;
    destTab = document.getElementById('tab-' + name);
    if (!destTab) { destTab = null; return; }
    const W = el.clientWidth;

    track = _getOrCreateSlideTrack('tab-slide-track', 60);
    // A previous gesture that never reached touchend/touchcancel (an
    // OS-level gesture — e.g. iOS's own edge-swipe-back — stealing the
    // touch mid-drag, a stray multi-touch, etc.) can leave its own two
    // tabs still parked in here from an earlier armSlide() that was never
    // followed by finishSlide()'s cleanup. Restoring them properly via
    // _slideUnmountEl — not wiping them with innerHTML below — is what
    // actually matters: innerHTML would rip them out of the document with
    // their forced opacity/pointer-events/position never reset and no way
    // to look them up by id ever again, which is the real mechanism
    // behind the rare "app frozen, tabs stop responding entirely" bug
    // after an interrupted swipe.
    Array.from(track.children).forEach(child => _slideUnmountEl(child));
    track.style.transition = 'none';
    track.style.width = (W * 2) + 'px';
    track.innerHTML = '';

    const leftChild  = dir > 0 ? destTab : el;
    const rightChild = dir > 0 ? el : destTab;
    _slideMountEl(leftChild, track, W);
    _slideMountEl(rightChild, track, W);

    // Depth cue on the incoming page's leading edge — the edge that will
    // meet the outgoing page in the middle of the drag.
    destTab.style.boxShadow = dir > 0
      ? '8px 0 28px rgba(0,0,0,0.16)'
      : '-8px 0 28px rgba(0,0,0,0.16)';

    base = dir > 0 ? -W : 0; // el is the right child when dir>0 (needs -W to sit at viewport x=0), the left child otherwise (needs 0)
    track.style.transform = `translateX(${base}px)`;
  }

  let lastClampedDx = 0; // last live-drag offset, used as the spring's start point

  function updateSlide(dx) {
    if (!destTab || !track) return;
    const W = el.clientWidth;
    lastClampedDx = Math.max(-W, Math.min(W, dx));
    const trackX = base + lastClampedDx;
    track.style.transform = `translateX(${trackX}px)`;
  }

  // easeOutBack — a manual overshoot-then-settle curve (the JS equivalent
  // of the cubic-bezier this used to run as a CSS transition).
  function springEase(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Springs the track's transform the rest of the way — either completing
  // the page turn (commit) or returning home (cancel) — with an ease-out +
  // slight overshoot, not a linear snap. Only one element's transform is
  // ever touched here.
  function finishSlide(commit) {
    if (!destTab || !track) return;
    const W = el.clientWidth;
    const finishedTrack = track, finishedDestTab = destTab, finishedDestName = destName, finishDir = dir;
    const myToken = gestureToken; // if a new touch supersedes this one before the loop finishes, bail without touching showTab or fighting the new gesture's own transform writes
    destTab = null; destName = null; track = null;

    const startX = base + lastClampedDx;
    // Commit shows only the destination tab; cancel returns to `base`
    // (shows only `el`) — in both cases that's "shift by dir*W from base".
    const endX = commit ? base + finishDir * W : base;

    finishedTrack.style.transition = 'none';
    const DURATION = 380;
    const t0 = performance.now();

    function cleanupTrack() {
      // Same freeze the back-swipe's own cleanup uses. This is reached from
      // two EARLY-RETURN paths as well as the settled one, and those were
      // calling it bare — the settled path's per-element suppression never
      // covered them, which is the chat<->scan flash.
      const app = document.getElementById('app');
      app?.classList.add('slide-cleanup');
      _slideUnmountEl(el); // also resets el's own header back to position:fixed
      _slideUnmountEl(finishedDestTab);
      finishedTrack.remove();
      void document.body.offsetHeight; // flush while still frozen
      requestAnimationFrame(() => {
        const app2 = document.getElementById('app');
        app2?.classList.remove('slide-cleanup');
        app2?.classList.remove('slide-animating');
      });
    }

    function frame(now) {
      if (myToken !== gestureToken) {
        // Superseded mid-flight — just drop both tabs back to normal
        // instantly rather than leaving them stuck mid-slide inside a
        // track a newer gesture doesn't know about.
        cleanupTrack();
        return;
      }
      const t = Math.min(1, (now - t0) / DURATION);
      const e = springEase(t);
      const trackX = startX + (endX - startX) * e;
      finishedTrack.style.transform = `translateX(${trackX}px)`;
      if (t < 1) { requestAnimationFrame(frame); return; }

      // The track is now visually settled in its final resting position —
      // nothing left to animate. showTab() below does real work beyond a
      // class swap (initSwipeDeck(), renderChatsList(), etc.), which on
      // real hardware can take long enough to still be running when the
      // next frame is due, blocking that paint. If it ran in this same
      // callback, the settled position set just above would never get its
      // own paint. Deferring by one more rAF tick guarantees the browser
      // actually paints this settled frame first, so showTab()'s work
      // always starts from a screen that already looks correct.
      requestAnimationFrame(() => {
        if (myToken !== gestureToken) { cleanupTrack(); return; }
        // Both tabs are already visually settled in their final on-screen
        // position from the slide animation that just finished — cleanupTrack
        // clearing the inline opacity override it forced during the drag (see
        // _slideUnmountEl), and showTab()'s .active class swap below, are
        // state corrections, not real visual changes. But .tab's CSS
        // `transition: opacity 0.18s ease` doesn't know that — either step can
        // read as a genuine computed-opacity change and animate a brief fade,
        // letting the tab underneath visibly bleed through for a moment
        // (the recurring "quick flash of the old page" bug). Suppress the
        // transition on both tabs for this one swap so any correction is
        // instant, then restore it next frame so normal tap-to-switch tab
        // changes keep their intended fade.
        el.style.transition = 'none';
        finishedDestTab.style.transition = 'none';
        cleanupTrack();
        if (commit) showTab(finishedDestName);
        void finishedDestTab.offsetHeight;
        requestAnimationFrame(() => {
          el.style.transition = '';
          finishedDestTab.style.transition = '';
        });
      });
    }
    requestAnimationFrame(frame);
  }

  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    // A touch starting inside e.g. the Home tab's swipe-card deck must
    // belong entirely to that control's own drag handling — arming this
    // gesture too would mean one finger driving two independent swipes at
    // once (the card AND the tab underneath it).
    if (excludeSelector && e.target.closest(excludeSelector)) { active = false; return; }
    active = true;
    axis = null;
    pulling = false;
    destTab = null; destName = null;
    gestureToken++;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    if (axis === null) {
      if (Math.abs(dx) < AXIS_DEADZONE && Math.abs(dy) < AXIS_DEADZONE) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'x') {
        const target = dx > 0 ? leftTarget : rightTarget;
        if (target) armSlide(target, dx > 0 ? 1 : -1);
      }
    }

    if (axis === 'y') {
      const atTop    = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy > 0 && atTop) || (dy < 0 && atBottom)) {
        pulling = true;
        const resisted = Math.sign(dy) * MAX_PULL * (1 - 1 / (Math.abs(dy) / RESISTANCE + 1));
        applyPull(resisted);
      } else if (pulling) {
        releasePull();
      }
      return;
    }

    // axis === 'x'
    if (destTab) updateSlide(dx);
  }, { passive: true });

  function finishTouch(dx) {
    active = false;
    if (axis === 'y') {
      if (pulling) releasePull();
    } else if (axis === 'x' && destTab) {
      finishSlide(Math.abs(dx) >= NAV_THRESHOLD);
    }
    axis = null;
  }

  el.addEventListener('touchend', e => {
    if (!active) return;
    const t = e.changedTouches[0];
    finishTouch(t ? t.clientX - startX : 0);
  });
  el.addEventListener('touchcancel', () => {
    if (!active) return;
    finishTouch(0);
  });
}

// Trackpad-style swipe-back: drag left->right starting ANYWHERE on the
// screen (no edge hitbox) to trigger whatever "back" function this screen
// already uses. Applied to a fixed, explicit allowlist of screens only
// (wired up below) — every other screen is untouched.
//
// Where the destination is knowable ahead of time, this uses the same
// single-container reveal technique as the tab carousel: the real
// destination element (a .tab or another .screen) is reparented into a
// shared track alongside this screen and both slide together as the
// finger moves, so the actual content underneath is what's revealed —
// not a fake stand-in. Where it genuinely isn't knowable in advance
// (tellZeloBack() may step back within a wizard instead of exiting;
// goBackFromResult() may show a save-prompt instead of navigating), this
// falls back to a plain slide-away with a depth shadow, since there's no
// real content to reveal for those cases.
function _defaultBackRevealTarget() {
  // Mirrors popScreen()'s own resolution: the top of the screen stack if
  // there is one, otherwise whatever tab is currently active.
  if (state.screenStack.length) {
    const el = document.getElementById('screen-' + state.screenStack[state.screenStack.length - 1]);
    if (el) return el;
  }
  return document.getElementById('tab-' + state.activeTab);
}

function attachEdgeSwipeBack(screenId, backFn, opts) {
  opts = opts || {};
  const el = document.getElementById(screenId);
  if (!el || el._edgeSwipeAttached) return;
  el._edgeSwipeAttached = true;

  const AXIS_DEADZONE = 10;
  let active = false, axis = null, startX = 0, startY = 0, lastDx = 0;
  let gestureToken = 0;
  let track = null, targetEl = null, usingReveal = false;

  function threshold() { return Math.max(90, el.clientWidth * 0.28); }

  function springEase(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function resolveTarget() {
    return opts.resolveTarget ? opts.resolveTarget() : _defaultBackRevealTarget();
  }

  // Decides — once, at the moment a drag commits to the horizontal axis —
  // whether a live destination can be revealed this time, and if so
  // builds the shared track for it. Re-evaluated on every new touch since
  // e.g. tellzelo's step or scan-result's saved state can change between
  // gestures.
  let unhidTabBar = false; // whether this drag temporarily un-hid the tab-bar (pushScreen() hides it while any screen is active)
  let tabBar = null; // set only while unhidTabBar is true — see armReveal()

  function armReveal() {
    targetEl = resolveTarget();
    if (!targetEl || targetEl === el) { usingReveal = false; return; }
    usingReveal = true;
    const W = el.clientWidth;
    track = _getOrCreateSlideTrack('back-slide-track', 90); // above normal .tab/.screen stacking, below .tab-bar's z-index:100
    // Same defensive restore as armSlide() above — see its comment for the
    // full explanation of why innerHTML alone is the actual bug.
    Array.from(track.children).forEach(child => _slideUnmountEl(child));
    track.style.transition = 'none';
    track.style.width = (W * 2) + 'px';
    track.innerHTML = '';
    _slideMountEl(targetEl, track, W); // left child — revealed as the user drags right
    _slideMountEl(el, track, W);       // right child — this screen, dragged away
    track.style.transform = `translateX(${-W}px)`; // resting: el alone fills the viewport

    // Revealing a tab means the real destination (once this actually
    // completes) will have the tab-bar visible — but pushScreen() hid it
    // for as long as this screen has been active. Un-hiding it here (so
    // it's paintable at all — display:none can't fade) but starting it at
    // opacity:0 and fading it in step with the drag itself (see the
    // touchmove handler and finish()'s own frame loop below), instead of
    // snapping straight to fully visible the instant the gesture locks
    // onto this axis, is what actually matters: doing that unconditionally
    // made the tab-bar visibly pop in within the first ~10px of any
    // rightward drag, long before the page underneath was meaningfully
    // revealed — reads as it "popping up first" rather than arriving
    // together with the page it belongs to.
    const tabBarEl = document.getElementById('tab-bar');
    if (targetEl.classList.contains('tab') && tabBarEl && tabBarEl.classList.contains('hidden')) {
      tabBarEl.classList.remove('hidden');
      // The bar carries backdrop-filter: blur(24px) saturate(180%). Pulling
      // a backdrop-filter element in and out of the render tree forces
      // WebKit to tear down and rebuild its compositing layer, which is a
      // well-known source of a one-frame flash across the area behind it —
      // and this is the only thing in a cancelled back-swipe that does
      // that. Dropped for the gesture's duration; the bar is fading from
      // zero the whole time, so losing the blur transiently is invisible.
      tabBarEl.classList.add('tab-bar--gesture-reveal');
      tabBarEl.style.transition = 'none';
      tabBarEl.style.opacity = '0';
      tabBar = tabBarEl;
      unhidTabBar = true;
    }
  }

  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    // Lets a caller turn this whole gesture off under some condition (e.g.
    // AI Coach's chat-sheet mode, which uses a different vertical
    // swipe-down-to-close gesture on this same element instead — see
    // attachAiCoachChatSheetDragClose()) without needing a DOM selector.
    if (opts.disabled && opts.disabled()) { active = false; return; }
    // A touch starting inside e.g. the Scan Result reply carousel must
    // belong entirely to that control's own horizontal swipe.
    if (opts.excludeSelector && e.target.closest(opts.excludeSelector)) { active = false; return; }
    active = true;
    axis = null;
    lastDx = 0;
    usingReveal = false;
    gestureToken++;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);

    if (axis === null) {
      if (Math.abs(dx) < AXIS_DEADZONE && dy < AXIS_DEADZONE) return;
      // Only a rightward, horizontally-dominant drag means "back" — a
      // leftward drag has no defined gesture here, and a vertical one is
      // normal scrolling; both are left alone entirely.
      axis = (Math.abs(dx) > dy && dx > 0) ? 'x' : 'dead';
      // A message row commits its own swipe-to-reply on the same touch a
      // few pixels earlier (rows listen at the target, this listens as the
      // event bubbles up, so the flag is already set by now). Back-swipe
      // stands down for that drag only — which keeps it working everywhere
      // else, including a rightward drag on the user's own messages, where
      // the row replies leftward and never claims it.
      if (axis === 'x' && _msgRowSwipeClaimed) { axis = 'dead'; active = false; return; }
      if (axis === 'x') {
        // Snap any keyboard-avoidance shift back to rest BEFORE this
        // screen gets reparented into the live drag track below — armReveal()
        // mounts whatever this screen looks like RIGHT NOW for the reveal
        // animation, so if a shift was still applied (keyboard was open),
        // that shifted state is what drags/reveals, and closeAiCoach()'s own
        // clear (added earlier for this exact glitch) only runs once the
        // gesture actually completes — too late for the drag itself, and
        // never at all if the gesture is released early and cancelled.
        // Instant, not eased — this is the start of leaving the screen, so
        // any animated settle here is exactly the "screen moves by itself"
        // motion this is meant to prevent, not produce.
        if (window._clearKeyboardNudge) window._clearKeyboardNudge(true);
        armReveal();
      }
    }
    if (axis !== 'x') return;

    const clamped = Math.max(0, Math.min(el.clientWidth, dx));
    lastDx = clamped;
    if (usingReveal) {
      track.style.transform = `translateX(${clamped - el.clientWidth}px)`;
      if (tabBar) tabBar.style.opacity = String(clamped / el.clientWidth);
    } else {
      el.style.transition = 'none';
      el.style.transform = `translateX(${clamped}px)`;
      el.style.boxShadow = `-8px 0 24px rgba(0,0,0,${0.18 * (clamped / el.clientWidth)})`;
    }
  }, { passive: true });

  function finish(commit) {
    const W = el.clientWidth;
    const myToken = gestureToken;
    const DURATION = 380;
    const t0 = performance.now();

    if (usingReveal) {
      const finishedTrack = track, finishedTarget = targetEl;
      track = null; targetEl = null;
      const startPx = lastDx - W;
      const endPx = commit ? 0 : -W;
      finishedTrack.style.transition = 'none';

      const cleanupTrack = () => {
        // Unmounting restores the inline opacity _slideMountEl() forced
        // during the drag, and .screen/.tab's own `transition: opacity`
        // happily animates that correction as a real fade — the one-second
        // blink when a settle is interrupted. The settle path below already
        // suppressed this for its own swap, but the two early-return paths
        // (a fresh touch bumping gestureToken mid-settle, which is exactly
        // "swipe, come back to the same page") called this bare. Doing it
        // here covers every exit instead.
        // Per-element suppression wasn't enough: unmounting resets inline
        // opacity/position on BOTH pages and re-hides the tab bar, and any
        // of those corrections can be picked up as an animatable change.
        // Freeze the lot for the swap, then release next frame.
        const app = document.getElementById('app');
        app?.classList.add('slide-cleanup');
        _slideUnmountEl(el);
        _slideUnmountEl(finishedTarget);
        finishedTrack.remove();
        // Cancelled — staying on this screen, which expects the tab-bar
        // hidden. On commit, leave it as-is: backFn() (popScreen/showTab)
        // already re-derives the correct state on its own.
        const barToSettle = tabBar, reHide = !commit && unhidTabBar;
        unhidTabBar = false;
        tabBar = null;
        void document.body.offsetHeight; // flush while still frozen
        // The bar is already at opacity 0 by now, so settling it a frame
        // later is invisible — and it keeps the display toggle (a
        // compositing-layer teardown, see armReveal's note) out of the same
        // frame as the reparent above. Two heavy operations in one frame is
        // what gives the compositor a chance to show a gap.
        requestAnimationFrame(() => {
          if (reHide) barToSettle?.classList.add('hidden');
          if (barToSettle) {
            barToSettle.style.opacity = '';
            barToSettle.style.transition = '';
            barToSettle.classList.remove('tab-bar--gesture-reveal');
          }
          const app2 = document.getElementById('app');
          app2?.classList.remove('slide-cleanup');
          app2?.classList.remove('slide-animating');
        });
      };
      const frame = now => {
        if (myToken !== gestureToken) { cleanupTrack(); return; }
        const t = Math.min(1, (now - t0) / DURATION);
        const e = springEase(t);
        const trackX = startPx + (endPx - startPx) * e;
        finishedTrack.style.transform = `translateX(${trackX}px)`;
        // Keep fading in lockstep with the same spring through the
        // release/settle animation, not just the live drag — otherwise a
        // fast flick would still jump straight to fully visible the
        // instant the finger lifts, before the settle animation finishes.
        if (tabBar) tabBar.style.opacity = String(Math.max(0, Math.min(1, (trackX + W) / W)));
        if (t < 1) { requestAnimationFrame(frame); return; }
        // Settle one extra frame before calling the (possibly heavy) back
        // function — same reasoning as the tab-carousel fix — so the
        // browser actually paints the fully-settled position first.
        requestAnimationFrame(() => {
          if (myToken !== gestureToken) { cleanupTrack(); return; }
          // cleanupTrack() clears the inline opacity override _slideMountEl
          // forced during the drag, and backFn() (popScreen/closeJourney/
          // closeMissionControl/etc.) flips .active on el/target — both are
          // state corrections, not real visual changes, but .screen/.tab's
          // own `transition: opacity` doesn't know that and can read either
          // as a genuine opacity change, animating a brief fade where the
          // old screen visibly flashes back in (the same "quick flash of
          // the old page" bug the tab-carousel's finishSlide() fixed).
          // Suppress it for this one swap, then restore next frame so
          // normal tap navigation keeps its intended fade.
          el.style.transition = 'none';
          finishedTarget.style.transition = 'none';
          cleanupTrack();
          if (commit) backFn();
          void finishedTarget.offsetHeight;
          requestAnimationFrame(() => {
            el.style.transition = '';
            finishedTarget.style.transition = '';
          });
        });
      };
      requestAnimationFrame(frame);
    } else {
      const startPx = lastDx;
      // opts.willNavigate lets a caller say "committing this gesture won't
      // actually leave the screen" (scan-result: backFn() may just pop up
      // the save-prompt sheet instead of navigating, exactly when
      // usingReveal is false here) — sliding fully away and then
      // snapping back for the sheet read as the screen leaving and
      // un-leaving before the prompt showed up. Defaults to true so every
      // other caller (which never passes this) keeps its current behavior.
      const willNavigate = opts.willNavigate ? opts.willNavigate() : true;
      const endPx = (commit && willNavigate) ? W : 0;
      el.style.transition = 'none';

      const frame = now => {
        if (myToken !== gestureToken) return;
        const t = Math.min(1, (now - t0) / DURATION);
        const e = springEase(t);
        const px = startPx + (endPx - startPx) * e;
        el.style.transform = `translateX(${px}px)`;
        el.style.boxShadow = `-8px 0 24px rgba(0,0,0,${0.18 * Math.max(0, Math.min(1, px / W))})`;
        if (t < 1) { requestAnimationFrame(frame); return; }
        requestAnimationFrame(() => {
          if (myToken !== gestureToken) return;
          el.style.transition = '';
          el.style.transform = '';
          el.style.boxShadow = '';
          if (commit) backFn();
        });
      };
      requestAnimationFrame(frame);
    }
  }

  el.addEventListener('touchend', e => {
    if (!active) return;
    active = false;
    const wasX = axis === 'x';
    axis = null;
    if (!wasX) return;
    const t = e.changedTouches[0];
    const dx = t ? Math.max(0, Math.min(el.clientWidth, t.clientX - startX)) : 0;
    finish(dx >= threshold());
  });
  el.addEventListener('touchcancel', () => {
    if (!active) return;
    active = false;
    const wasX = axis === 'x';
    axis = null;
    if (!wasX) return;
    finish(false);
  });
}

// AI Coach chat-history panel — swipe-right-to-close, tied live to the
// finger the same way attachProfileDetailDragToClose() below drags its
// sheet: closing this panel isn't a real navigation (it's the exact same
// "dismiss the overlay" as tapping the scrim, see toggleAiCoachHistoryPanel()),
// so it shouldn't get attachEdgeSwipeBack's "slide the whole screen away
// like a page transition" treatment. Attached to the panel + scrim
// themselves (not #screen-ai-coach) with stopPropagation on move/end, so
// attachEdgeSwipeBack's own listener there — which still handles the
// "swipe from the dimmed sliver on the left" edge case — never sees these
// touches and doesn't fight this over the same gesture.
function attachAiCoachHistoryDragClose() {
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!panel || !scrim || panel._dragCloseAttached) return;
  panel._dragCloseAttached = true;

  let active = false, startX = 0, dx = 0, W = 0;

  function onStart(e) {
    if (!_aiCoachHistoryOpen || e.touches.length !== 1) return;
    active = true;
    startX = e.touches[0].clientX;
    dx = 0;
    W = panel.clientWidth || 320;
    panel.style.transition = 'none';
    scrim.style.transition = 'none';
  }
  function onMove(e) {
    if (!active) return;
    dx = Math.max(0, e.touches[0].clientX - startX); // only the closing direction moves it
    panel.style.transform = `translateX(${dx}px)`;
    scrim.style.opacity = String(Math.max(0, 1 - dx / W));
  }
  function settle(closing) {
    if (!active) return;
    active = false;
    const EASE = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transition = EASE;
    scrim.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transform = '';
    scrim.style.opacity = '';
    if (closing) {
      toggleAiCoachHistoryPanel(false); // removes .open -> CSS carries the transform/opacity the rest of the way, animated by the transitions just set
    }
    setTimeout(() => { panel.style.transition = ''; scrim.style.transition = ''; }, 340);
    dx = 0;
  }

  [panel, scrim].forEach(el => {
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', e => { onMove(e); e.stopPropagation(); }, { passive: true });
    el.addEventListener('touchend', e => {
      const wasActive = active;
      const committed = wasActive && dx > W * 0.3;
      settle(committed);
      if (wasActive) e.stopPropagation();
    });
    el.addEventListener('touchcancel', e => {
      const wasActive = active;
      settle(false);
      if (wasActive) e.stopPropagation();
    });
  });
}

// Exact reverse of attachAiCoachHistoryDragClose() above — a leftward
// drag starting anywhere on the main AI Coach content (while the history
// panel is closed) live-reveals it from the right, in step with the
// finger, same easing/spring-back/commit-threshold logic as closing it.
// Attached to #aicoach-main (not #screen-ai-coach itself) so it targets
// the same closed-state content the close-gesture's panel/scrim sit
// beside — mutually exclusive with that one via _aiCoachHistoryOpen, so
// only one of the two is ever actually live for a given drag.
function attachAiCoachHistorySwipeOpen() {
  const main  = document.getElementById('aicoach-main');
  const panel = document.getElementById('aicoach-history-panel');
  const scrim = document.getElementById('aicoach-history-scrim');
  if (!main || !panel || !scrim || main._historySwipeOpenAttached) return;
  main._historySwipeOpenAttached = true;

  const AXIS_DEADZONE = 10;
  let active = false, axis = null, startX = 0, startY = 0, dx = 0, W = 0;

  main.addEventListener('touchstart', e => {
    if (_aiCoachHistoryOpen || e.touches.length !== 1) { active = false; return; }
    active = true;
    axis = null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    W = panel.clientWidth || Math.round(main.clientWidth * 0.78);
  }, { passive: true });

  main.addEventListener('touchmove', e => {
    if (!active) return;
    const t = e.touches[0];
    const rawDx = t.clientX - startX;
    const rawDy = Math.abs(t.clientY - startY);
    if (axis === null) {
      if (Math.abs(rawDx) < AXIS_DEADZONE && rawDy < AXIS_DEADZONE) return;
      // Only a leftward, horizontally-dominant drag opens the panel — a
      // rightward or vertical one is left alone entirely (normal scroll,
      // or the separate edge-swipe-back gesture on #screen-ai-coach).
      axis = (Math.abs(rawDx) > rawDy && rawDx < 0) ? 'x' : 'dead';
      if (axis === 'x') {
        panel.style.transition = 'none';
        scrim.style.transition = 'none';
      }
    }
    if (axis !== 'x') return;
    dx = Math.min(0, t.clientX - startX);
    const openAmount = Math.min(W, -dx); // 0 (closed) .. W (fully open)
    panel.style.transform = `translateX(${W - openAmount}px)`;
    scrim.style.opacity = String(openAmount / W);
    e.stopPropagation();
  }, { passive: true });

  function finish(e) {
    if (!active) return;
    active = false;
    const wasDragging = axis === 'x';
    axis = null;
    if (!wasDragging) return;
    const openAmount = Math.min(W, -dx);
    const committed = openAmount > W * 0.3;
    const EASE = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transition = EASE;
    scrim.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
    panel.style.transform = '';
    scrim.style.opacity = '';
    if (committed) {
      toggleAiCoachHistoryPanel(true); // adds .open -> CSS carries the transform/opacity the rest of the way, animated by the transitions just set
    }
    setTimeout(() => { panel.style.transition = ''; scrim.style.transition = ''; }, 340);
    dx = 0;
    e.stopPropagation();
  }
  main.addEventListener('touchend', finish);
  main.addEventListener('touchcancel', finish);
}

// Swipe-down-to-dismiss on the row-actions sheet — the WHOLE overlay
// (backdrop included, not just the small grey handle strip) is the
// draggable hit area now. It used to be scoped to just
// .aicoach-row-actions-drag-zone, a few-pixel-tall strip at the very top
// of the card — dragging down anywhere else on the sheet (the backdrop
// around the card, the gaps between rows) did nothing, which read as "the
// page underneath is what's scrolling" since nothing claimed that gesture.
// A small move-distance deadzone (see DRAG_DEADZONE) keeps this from
// eating real taps on Rename/Delete/Cancel: those fire from touchend with
// ~0 net movement, same as before, just now measured off the whole sheet
// instead of only the handle. Shared by both the AI Coach chat-history
// row-actions sheet and History's own (see openHistoryRowActions()).
// .thread-link-card itself is the scrollable element when it has enough
// content to need it ("Link a thread"'s own long list) — max-height:70%+
// overflow-y:auto (see style.css); the two row-actions sheets turn that
// back off (overflow:visible) since they never have enough content to
// scroll, so checking card.scrollTop is always harmlessly 0 for them.
// Same guard attachProfileDetailDragToClose() already uses elsewhere, so
// scrolling back up through a long list is never hijacked into a close
// attempt partway there.
function attachAiCoachRowActionsDragClose(overlayId, onClose) {
  const overlay = document.getElementById(overlayId);
  const card    = overlay ? overlay.querySelector('.thread-link-card') : null;
  if (!card || !overlay) return;

  const DRAG_DEADZONE = 6; // px of vertical movement before this counts as a drag, not a tap
  let startY = 0, dragging = false, committed = false, dy = 0;

  function onStart(clientY) {
    if (card.scrollTop > 0) return;
    startY = clientY;
    dragging = true;
    committed = false;
    dy = 0;
    card.style.transition = 'none';
  }
  function onMove(clientY, e) {
    if (!dragging) return;
    dy = clientY - startY;
    if (!committed) {
      if (dy < DRAG_DEADZONE) { dy = 0; return; } // still within the tap deadzone — don't touch the transform at all
      committed = true;
    }
    // Once this is a real drag (not a tap), stop the browser from ALSO
    // scrolling whatever scrollable ancestor this overlay happens to sit
    // inside — it's position:fixed so it doesn't visually move with that
    // scroll, but the touch is still a descendant of #screen-history (a
    // .screen, which is overflow-y:auto by default), so without this the
    // same touch drags the sheet down AND scrolls the list underneath at
    // the same time. Only possible on a non-passive listener, which is
    // exactly why this listener (registered further down) isn't one.
    if (e && e.cancelable) e.preventDefault();
    card.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    if (committed && dy > 70) {
      card.style.transform = '';
      onClose();
    } else if (committed) {
      card.style.transition = 'transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)';
      card.style.transform  = '';
      setTimeout(() => { card.style.transition = ''; }, 320);
    }
    dy = 0;
    committed = false;
  }

  overlay.addEventListener('touchstart', e => onStart(e.touches[0].clientY), { passive: true });
  // Not passive — see onMove()'s own comment on why this drag needs to be
  // able to preventDefault() the underlying screen's native scroll.
  overlay.addEventListener('touchmove',  e => onMove(e.touches[0].clientY, e),  { passive: false });
  overlay.addEventListener('touchend',   onEnd);
  overlay.addEventListener('touchcancel', onEnd);
  overlay.addEventListener('mousedown', e => {
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

// Fix 2: Swipe-down-to-dismiss on the profile detail sheet.
// Supports both touch (mobile) and mouse (desktop). Only activates
// when the internal scroll is at the top so normal bio scrolling is
// never interrupted. Dragging upward cancels immediately.
function attachProfileDetailDragToClose() {
  const sheet    = document.querySelector('.profile-detail-sheet');
  const scrollEl = sheet ? sheet.querySelector('.profile-detail-scroll') : null;
  if (!sheet) return;

  let startY = 0, dragging = false, dy = 0;

  // Only scroll DOWN past the photo: at the top, a downward pull must not
  // rubber-band the content (it showed empty space above the photo) — that
  // same pull is the drag-to-close gesture below, which still runs.
  if (scrollEl && !scrollEl._noTopBounce) {
    scrollEl._noTopBounce = true;
    let y0 = 0;
    scrollEl.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    scrollEl.addEventListener('touchmove', e => {
      if (scrollEl.scrollTop <= 0 && e.touches[0].clientY > y0) e.preventDefault();
    }, { passive: false });
  }

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
    // 30% of the screen was a long, deliberate haul — matched to the AI
    // Coach sheet's own 100px so it closes with an ordinary flick.
    if (dy > 110) {
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

// ================================================================
