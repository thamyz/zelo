// ================================================================
// 19-keyboard.js — keeping the keyboard from breaking a layout
//
// Stops iOS zooming on focus, hides the up/down field bar, and lifts only a
// designated "movable" area when the keyboard opens — native resize is off,
// so any screen with a text field at the bottom is handled from here.
//
// Part of script.js, split by concern. scripts/build.sh joins app/ back
// into script.js, which is what the app actually loads — see that file
// for why. The number in the filename is the load order.
// Map of every module: app/README.md
// ================================================================

// KEYBOARD: no zoom-on-focus, no up/down "other fields" bar
// ============================================================
//
// 1) Zoom-on-focus — a STATIC "maximum-scale=1.0, user-scalable=no" in the
//    viewport meta tag didn't stop it (tried and confirmed not enough on
//    real hardware). WebKit is more reliable about respecting the zoom cap
//    when the meta tag's content is actively re-written at the moment of
//    focus, rather than left static since page load. Toggle it on
//    focus/blur via one delegated listener instead of a per-field one.
(function () {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const NORMAL  = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
  const NO_ZOOM = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName !== 'INPUT') return false;
    return !['checkbox', 'radio', 'file', 'button', 'submit'].includes(el.type);
  }
  // Only write when the value actually changes, and not at all when focus is
  // merely MOVING between two text fields (focusout's relatedTarget is the next
  // one): the six one-time-code boxes hop focus on every digit, which meant
  // ~12 viewport rewrites to type a code, each a chance for iOS to re-layout
  // and fumble the keyboard while it is up.
  const setMeta = (v) => { if (meta.getAttribute('content') !== v) meta.setAttribute('content', v); };
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) setMeta(NO_ZOOM);
  }, true);
  document.addEventListener('focusout', (e) => {
    if (isTextField(e.target) && !isTextField(e.relatedTarget)) setMeta(NORMAL);
  }, true);
})();

// 2) The up/down "jump to other field" bar above the keyboard — WebKit adds
//    this whenever it thinks there's more than one reachable field on the
//    page. This app keeps every screen's fields in the DOM at once (just
//    hidden), so WebKit was seeing dozens of "other fields" across every
//    screen and offering to jump between them. Fix: keep fields outside the
//    currently-visible screen out of the tab order (tabindex="-1") so
//    they're not "reachable" — WebKit then has nothing to offer navigation
//    to and drops the bar down to just the field's own return key.
//    Recomputed on a MutationObserver watching class changes, so it covers
//    every screen transition (tabs, pushScreen, onboarding, etc.) through
//    one shared hook instead of needing to be wired into each one by hand.
(function () {
  function isVisible(el) {
    // Screens/tabs in this app hide via opacity:0 + pointer-events:none, not
    // display:none, so offsetParent alone doesn't detect a hidden screen —
    // walk the ancestor chain checking the actual computed visibility.
    let node = el;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      node = node.parentElement;
    }
    return true;
  }
  function refresh() {
    document.querySelectorAll('input, textarea').forEach((el) => {
      if (isVisible(el)) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  }
  let scheduled = false;
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; refresh(); });
  }
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ['class', 'hidden'],
  });
  // Synchronous (not debounced) on focusin itself — WebKit decides what's
  // "reachable" for the accessory bar as part of handling this exact event,
  // so the tabindex fix-up needs to land before that, not next frame.
  document.addEventListener('focusin', refresh, true);
  refresh();
})();

// Explicit, JS-only keyboard dismiss — deliberately not relying on WKWebView's
// own native tap-outside-to-dismiss behavior, which has not proven reliable
// across several rounds of native-code attempts. If a text field is
// currently focused and the tap lands outside any input/textarea, blur it
// directly. touchstart (not click) so this fires at the start of the tap,
// same moment native dismiss would — not a delayed second tap.
document.addEventListener('touchstart', (e) => {
  const active = document.activeElement;
  const activeIsField = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  // A device's own native tap-outside-to-dismiss behavior can race ahead of
  // this handler and resign the field before this touchstart's JS runs,
  // leaving document.activeElement already reset to something else by the
  // time it's checked above — which used to make this whole handler bail
  // out as if no field had been focused at all, skipping the click-swallow
  // below and letting the tap fully register on whatever it landed on.
  // Treating a very-recent blur the same as "still focused" covers that.
  const justBlurred = !activeIsField && (Date.now() - _lastTextInputBlurAt < 250);
  // One-shot: consume the grace window immediately so a LATER, unrelated
  // tap (no field focused, nothing to dismiss) can't also read as "just
  // blurred" off the same stale timestamp and wrongly get its own click
  // swallowed too.
  if (justBlurred) _lastTextInputBlurAt = 0;
  if (!activeIsField && !justBlurred) return;
  const target = e.target;
  if (target && target.closest && target.closest('input, textarea')) return;
  // Exception: the AI Coach suggestions toggle handles its own blur+open
  // sequencing (see toggleAiCoachSuggestPanel). Blurring here first would
  // shift the panel/input-bar out from under the tap (nudge clears on
  // blur) before the toggle's own click event fires — the touchend then
  // lands outside the now-moved button and the click gets silently
  // swallowed, which is exactly why the toggle needed two taps before.
  if (target && target.closest && target.closest('#aicoach-suggest-toggle')) return;
  // Same underlying issue, broader exemption: ANY button inside the AI
  // Coach input bar or its attachments row (attach, send, the staged-
  // suggestion pill, the photo-remove button) needs its own tap to land
  // and fire immediately — attach a photo or send a message regardless of
  // whether the keyboard is open or closed. Blurring first here shifts
  // that whole group (nudge clears on blur) out from under the still-
  // active touch before its own click ever fires, which both delays the
  // action until the keyboard's close animation finishes AND can misfire
  // onto a different, now-shifted-into-place element entirely (e.g.
  // tapping "+" landing on the staged pill instead once the row moves).
  // Letting each button's own click handle things natively sidesteps both:
  // there's nothing here forcing an early blur to shift the layout at all.
  // Same for the main chat's own composer (.chat-input-bar) — its Send
  // button needs to fire on the very first tap even with the keyboard
  // still up, not silently dismiss the keyboard and eat that tap.
  if (target && target.closest && target.closest('.aicoach-input-bar, .aicoach-attachments-row, .chat-input-bar')) return;
  // Same underlying issue again: the chat settings sheet (Cancel, the
  // backdrop, Reset/Delete/Mute) and its confirm dialog are full-screen
  // modals opened from the chat screen, where the message composer is
  // very often still focused. Without this exemption, tapping any of them
  // first silently blurs the keyboard and swallows that exact tap's click
  // — reads as "the sheet won't close at all" since the very next tap on
  // Cancel/backdrop does nothing (it's the click-swallow eating it, not a
  // broken handler). These don't need the composer's layout to have
  // settled first, so just let their own tap fire immediately.
  if (target && target.closest && target.closest('.chat-settings-sheet, .chat-confirm-overlay')) return;
  // The onboarding conversation manages its own focus (it deliberately keeps
  // the name field focused). This global handler blurs on the first touch
  // outside the field and swallows that touch's click — which is exactly why
  // Continue and Back needed two presses with the keyboard open.
  if (target && target.closest && target.closest('#cine-convo')) return;
  // Support forms and the feature board: Send, Submit, New, the sort tabs and the vote buttons must work on the first tap with the keyboard up.
  if (target && target.closest && target.closest('#screen-settings-feature-requests, #screen-settings-feature-new, #screen-settings-feature-detail') && target.closest('button, .fr-card, .back-btn')) return;
  // The code / reset / setup screens: Change password, Resend, Verify and Back must work on
  // the FIRST tap while a code box still has focus (otherwise the first tap only closes the
  // keyboard and its click is swallowed — "I have to press it twice").
  if (target && target.closest && target.closest('#auth-reset-overlay, #auth-verify-overlay, #auth-setup-overlay')) return;
  // Opening her profile from the chat must work on the first tap with the keyboard up.
  if (target && target.closest && target.closest('[data-open-profile], #pp-overlay')) return;
  // Flag this exact tap as "just dismissed the keyboard" (see
  // _dismissingKeyboard's own declaration, ~line 3370) so whatever it
  // landed on — the widget carousel, for instance — can tell not to also
  // treat it as a normal tap. Cleared on the next tick, once this same
  // gesture's other listeners have all had their turn.
  _dismissingKeyboard = true;
  setTimeout(() => { _dismissingKeyboard = false; }, 0);
  if (activeIsField) active.blur();
  // blur() above synchronously fires a real focusout, which refreshes
  // _lastTextInputBlurAt to "now" — reset it again right after so THIS
  // dismiss can't also be mistaken for a fresh "just blurred" race by the
  // very next, unrelated tap (see the one-shot comment above).
  _lastTextInputBlurAt = 0;
  // This same tap must ONLY close the keyboard, never also register as a
  // press on whatever it landed on (a widget card, a button, a link) —
  // previously only the widget carousel's own "reveal chrome" check
  // consulted _dismissingKeyboard, so every other tappable thing still
  // fired its click normally on this exact tap. Swallow the one click
  // this touch is about to produce, globally, for anything it lands on.
  // If no click follows shortly (the touch turned into a scroll/drag
  // instead), the timeout below disarms it so a later, unrelated click
  // is never accidentally eaten.
  document.addEventListener('click', _swallowKeyboardDismissClick, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', _swallowKeyboardDismissClick, { capture: true }), 600);
  // Belt-and-suspenders on real devices: stopImmediatePropagation() above
  // relies on our JS listener actually winning a race against however
  // WKWebView schedules the synthesized click for this gesture — reported
  // as still not reliable enough on-device even after hardening that path.
  // A real, physical full-screen overlay sidesteps the race entirely: it
  // doesn't matter when or how the browser decides to synthesize/dispatch
  // the click, because by the time it does, the overlay (not the widget)
  // is literally the element sitting at that screen point, so the browser's
  // own hit-test resolves the click to the overlay — nothing left for any
  // propagation/order trick to get wrong.
  _armKeyboardDismissClickBlocker();
}, { capture: true, passive: true });

function _armKeyboardDismissClickBlocker() {
  const overlay = document.createElement('div');
  overlay.className = 'kb-dismiss-click-blocker';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 500);
}

function _swallowKeyboardDismissClick(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// ============================================================
// KEYBOARD-OPEN: nudge a designated "movable" area, pin everything else
// ============================================================
// Native keyboard-triggered page resize is fully disabled (see
// capacitor.config.json — Keyboard.resize: "none"), replacing the earlier
// per-screen position:fixed/sticky workarounds as the primary fix — those
// are left in place as a harmless extra safety net, but with native resize
// off there's nothing left to push them around in the first place.
//
// With native resize off, NOTHING moves automatically when the keyboard
// opens. First version of this only nudged when the input was strictly
// about to be covered — but every one of these inputs sits high enough on
// its screen that the strict check was almost always false, so in practice
// nothing ever visibly moved (looked "dead" when the keyboard opened).
// Changed to always shift the movable group up by a real, visible amount
// once the keyboard opens (still only the designated group — header/logo/
// nav are never in that group, so they can't move), using whichever is
// bigger: the minimum felt-movement amount, or however much is actually
// needed to clear the keyboard for inputs that really do sit low (e.g. the
// AI Coach input bar).
(function () {
  const Keyboard = window.Capacitor?.Plugins?.Keyboard;
  let keyboardHeight = 0;
  let nudgedEls = [];
  let nudgedContentEl = null; // the content-aware element (see contentSelector) currently shifted, if any
  let caretHiddenOn = null; // the input whose blinking caret is currently masked mid-slide, if any

  // input id -> selectors for the element(s) that should move with it,
  // bottom-most last (used to measure keyboard clearance). Falls back to
  // just the input itself when not listed here. An optional `clip` selector
  // names an ancestor that should get overflow:hidden + its current height
  // locked while shifting, so the moving content clips cleanly at that
  // ancestor's boundary (its bottom, in practice its resting top edge —
  // see .scan-scroll-clip) instead of visually overlapping whatever sits
  // above/outside it (the pinned header).
  const MOVABLE_OVERRIDE = {
    // Headline+subtitle and "Who's this about?" now ride along with the
    // input card so all three move together in proportion — but the shift
    // AMOUNT is still measured off just the input card (`measureBy`), not
    // whichever of these three sits lowest. Measuring off the lowest one
    // (previously: the whole block) is what overcorrected before — the card
    // itself was already correct, this only widens which elements share
    // its same transform value.
    // '.widget-carousel' (not '.scan-headline-row') so the whole widget —
    // border, arrows, dots — rides up as one piece with its own content
    // instead of the text sliding up out of alignment with a frame that
    // stayed put.
    'asst-input':    { move: ['.widget-carousel', '.scan-message', '.scan-who-section', '#aicoach-card'], measureBy: '.scan-message' },
    // The suggestions panel and attachments row ride up together with the
    // input bar (bottom-most, so it stays the measureEl the bar's own shift
    // is computed from) — they're structurally attached to it, so leaving
    // them behind looked disconnected. The message thread itself is handled
    // separately via `contentSelector` below: it only rides up when its own
    // last real message is actually close to the keyboard (e.g. a fresh/
    // short conversation shouldn't drag the profile header up just because
    // the input bar, always bottom-anchored, always has to move). See
    // `contentSelector` handling in nudgeFocusedIntoView() for the second,
    // independent shift this produces.
    'aicoach-input': { move: ['.aicoach-suggest-panel', '.aicoach-attachments-row', '.aicoach-input-bar'], contentSelector: '.aicoach-messages' },
    // The whole bar moves as one piece — border included — instead of just
    // the input escaping a stationary bar. That stationary-bar setup was
    // the actual cause of the border-line glitch a border-color fade kept
    // needing to re-patch: the border lived on an element that never
    // moved, so the input could still visibly cross it mid-shift no matter
    // how the color transition was tuned. Moving them together removes the
    // seam structurally — there's no stationary line left to cross. (The
    // jump-to-latest button doesn't need its own entry here — it's a child
    // of .chat-input-bar, anchored to the bar's own top edge, so it moves
    // for free with the bar itself.) The message thread is content-aware,
    // same as .aicoach-input above — see its comment for why.
    'message-input': { move: ['.chat-input-bar'], contentSelector: '#chat-messages' },
    // Onboarding screen 1 (name/photo/birth date): avatar, the name field,
    // and the age field all ride up together instead of just the name input
    // escaping upward on its own. Headline+lede are deliberately NOT in this
    // group and NOT inside the clip box — they sit close enough to the fixed
    // topbar that a keyboard-clearing shift would push them up underneath
    // it. `clip` locks .cine-name-clip's height so the avatar clips cleanly
    // at the lede's bottom edge as it rises, instead of visually overlapping
    // the lede text.
    'cine-name-input': {
      move: ['.cine-avatar-wrap', '.cine-field', '#cine-name-error', '#cine-age-field'],
      clip: '.cine-name-clip',
      measureBy: '#cine-name-input',
    },
  };

  // Bug fixed here: previously fell back to `{ move: [input] }` — an actual
  // DOM element, not a selector — and resolveEls always tried to use it as
  // a CSS selector string (input.closest(sel)), which throws for any input
  // with no MOVABLE_OVERRIDE entry (e.g. the onboarding name field),
  // silently breaking the nudge for every screen that didn't have an
  // explicit entry.
  function movableElsAndClip(input) {
    const config = MOVABLE_OVERRIDE[input.id];
    if (!config) return { els: [input], clip: null, measureEl: input, contentEl: null };
    const els = config.move.map((sel) => input.closest(sel) || document.querySelector(sel)).filter(Boolean);
    const resolvedEls = els.length ? els : [input];
    const measureEl = (config.measureBy && (input.closest(config.measureBy) || document.querySelector(config.measureBy)))
      || resolvedEls[resolvedEls.length - 1];
    const contentEl = config.contentSelector ? document.querySelector(config.contentSelector) : null;
    return { els: resolvedEls, clip: config.clip || null, measureEl, contentEl };
  }

  let clippedEl = null;
  function applyClip(selector, moveEls) {
    const el = document.querySelector(selector);
    if (!el) return;
    // Lock to the height it has right now (before any shift), so the box
    // stays put while its content (moveEls) slides up inside it and gets
    // cut off at its top edge.
    el.style.height = _rectA(el).height + 'px';
    el.style.overflow = 'hidden';
    clippedEl = el;
  }
  function clearClip() {
    if (clippedEl) { clippedEl.style.height = ''; clippedEl.style.overflow = ''; clippedEl = null; }
  }

  // Every nudge — first tap included — goes through a real 0.2s eased
  // transition, on a short delay (see the setTimeout calls at the
  // focusin/keyboardWillShow call sites below) rather than applying
  // instantly and synchronously. This is the original design, restored:
  // an earlier version made the first application instant/synchronous to
  // stop the caret flashing at its unshifted spot before catching up —
  // but that traded a real, visible slide for a teleport-feeling snap,
  // which is the opposite of what this is meant to feel like. The brief
  // flash before the delayed shift kicks in is a known, accepted tradeoff
  // of this version, not a bug to re-"fix" by going back to instant.
  // Reads the Y offset actually applied right now, straight from the
  // computed transform matrix — instead of trusting the separately-tracked
  // nudgedShift number below to still match reality. That tracked number
  // is only correct if NOTHING besides this function's own writes changed
  // since the last call — but content this function doesn't own (e.g. the
  // AI Coach suggestions panel expanding, which changes .aicoach-input-bar's
  // real un-transformed position by growing something above it) can shift
  // the group's true layout out from under it. When that happens, "rect +
  // the old tracked shift" reconstructs the WRONG baseline and the next
  // shift compounds on top of that error — worse with every re-trigger,
  // which is exactly the "keeps going up higher each time" bug. Reading
  // the real current transform is correct regardless of why the layout
  // moved, and — since it never touches el.style.transform itself — costs
  // nothing on the smooth-transition front this whole function is built
  // around.
  function _currentShiftY(el) {
    const m = getComputedStyle(el).transform;
    if (!m || m === 'none') return 0;
    const match = m.match(/^matrix\(([^)]+)\)$/);
    if (!match) return 0;
    const parts = match[1].split(',').map(Number);
    return parts.length >= 6 ? -parts[5] : 0; // ty is negative when shifted up; this fn returns the positive shift amount
  }

  function nudgeFocusedIntoView() {
    const active = document.activeElement;
    if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return;
    // Sign-in/create-account must never be nudged. Checked here — not just
    // at the focusin call site below — because that's exactly what let the
    // real bug through: keyboardWillShow (fires only with a real device
    // keyboard, never in headless testing) calls this function on its own,
    // unconditionally, with no exclusion check of its own. Guarding inside
    // the function itself, off document.activeElement, covers every call
    // site at once instead of relying on each one to remember to check.
    // Tell Zelo More's free-text step (screen-tellzelo) opts out the same
    // way — it's a short wizard page, the field is always already on
    // screen, and this is the one place we deliberately want NO shift at
    // all rather than a correctly-computed one, per explicit direction.
    // Every other keyboard-avoiding field in the app (AI Coach included)
    // keeps the real nudge — this is a targeted exception, not a change to
    // the shared mechanism.
    // Support forms + the feature board manage their own keyboard spacing (_syncSupportKeyboard), so no extra nudge.
    if (active.closest && (active.closest('#auth-overlay') || active.closest('#screen-tellzelo') || active.closest('#mail-sheet, #screen-settings-feature-requests, #screen-settings-feature-new, #screen-settings-feature-detail'))) return;
    const { els, clip, measureEl, contentEl } = movableElsAndClip(active);
    const sameTarget = nudgedEls.length && nudgedEls[0] === els[0];
    const prevEls = sameTarget ? null : nudgedEls;
    const prevContentEl = sameTarget ? null : nudgedContentEl;
    const prevClippedEl = sameTarget ? null : clippedEl;
    if (clip) applyClip(clip, els);
    // Recover the true unshifted position by adding back whatever shift is
    // ACTUALLY on measureEl right now (see _currentShiftY above) — not the
    // separately-tracked nudgedShift, which goes stale the moment anything
    // else changes this group's real layout. This call's own transform
    // write happens only once, below, and never before this read.
    const rect = measureEl.getBoundingClientRect();
    // rect is device space; _currentShiftY is an app-space px transform, so it
    // is scaled up to compare, and the resulting overlap scaled back down
    // because it is written straight back out as an app-space transform.
    const kbScale = _appScale();
    const trueBottom = rect.bottom + _currentShiftY(measureEl) * kbScale;
    const visibleBottom = window.innerHeight - keyboardHeight;
    const overlap = (trueBottom - visibleBottom) / kbScale;
    // Moves exactly as much as the keyboard actually covers, no more — a
    // forced minimum (previously always at least 32-56px, "so opening the
    // keyboard is never a no-op") meant the whole group jumped up a visible
    // amount even when nothing was actually about to be covered. Per
    // explicit direction: if the keyboard doesn't overlap anything, don't
    // move at all; if it does, land flush with its top edge, not floating
    // above it.
    const shift = Math.max(overlap, 0);
    // Content-aware clearance for the message thread (chat/AI Coach only,
    // via contentSelector) — a REAL layout shrink, not a transform or a
    // scroll/padding simulation. Two earlier versions of this both had
    // real bugs: a transform moved the container's top edge underneath
    // its fixed header (confirmed on-device); a padding+manual-scroll
    // version fought its own race conditions and once showed the wrong
    // message entirely. This instead does exactly what the AI Coach
    // suggestions panel already does well (explicit reference for this
    // fix): opening that panel shrinks .aicoach-messages via ordinary
    // flex layout (flex:1 loses space to its now-taller sibling) and the
    // browser's own scroll-clamping reveals the true bottom — no manual
    // measurement of "where's the last message" at all. Margin-bottom
    // here plays the same role the panel's own height does there: shrink
    // the container by exactly as much as the bar rises by, so the
    // container's new bottom edge and the bar's new top edge meet with no
    // gap and no overlap — then let the browser do the rest.
    if (contentEl) {
      contentEl.style.transition = 'margin-bottom 0.2s ease';
      contentEl.style.marginBottom = shift + 'px';
      // Mirrors _updateAiCoachSuggestToggle()'s own transitionend hook —
      // mid-transition, scrollHeight/clientHeight are still the old,
      // taller values, so the only reliable moment to correct the scroll
      // position is once the resize has actually finished settling.
      // _scrollToLogicalBottom(), not raw scrollHeight: contentEl is one of
      // the containers _ensureScrollableOverflow() pads out with a
      // trailing spacer on a short conversation, and scrolling to the raw
      // scrollHeight here would land inside that spacer instead of at the
      // real last message — visible as the conversation shooting way
      // further up than the keyboard actually requires.
      const fixupScroll = () => { _scrollToLogicalBottom(contentEl); };
      contentEl.addEventListener('transitionend', fixupScroll, { once: true });
      setTimeout(fixupScroll, 250); // safety net if the transition never fires (e.g. shift unchanged)
    }
    // Mask the focused input's own blinking text caret for exactly the
    // duration of the slide below — not the whole app, and not the 80ms/30ms
    // delay before it (that pre-slide flash is the separate, accepted
    // tradeoff described above). The caret twitching/teleporting mid-slide
    // is WebKit's own text-cursor overlay re-resolving its on-screen
    // position against the transform each time it repaints, independently
    // of the compositor actually moving the box — a rendering-pipeline
    // mismatch, not something a different easing/duration changes. Hiding
    // it for this one transition and revealing it once the transition
    // actually lands removes the visible glitch without touching how the
    // slide itself moves or how long it takes.
    if (caretHiddenOn && caretHiddenOn !== active) { caretHiddenOn.style.caretColor = ''; caretHiddenOn = null; }
    active.style.caretColor = 'transparent';
    caretHiddenOn = active;
    const revealCaret = () => { if (caretHiddenOn === active) { active.style.caretColor = ''; caretHiddenOn = null; } };
    (measureEl || els[0]).addEventListener('transitionend', revealCaret, { once: true });
    setTimeout(revealCaret, 500); // safety net only, in case transitionend never fires (e.g. shift value unchanged) — not a timing tweak of the slide itself
    els.forEach((el) => {
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = `translateY(${-shift}px)`;
    });
    // contentEl's own clearance (padding-bottom + scrollTop) was already
    // applied above, inline with computing it — no transform to set here.
    // Release the previous target's group only now, after the read/write
    // above — not before, via an unconditional clearNudge() call, as this
    // used to do. Clearing first inserted a transform write ahead of the
    // layout-forcing read above, in the same tick; that forces the browser
    // to resolve style mid-script and hands the transition system that
    // just-cleared (zero) value as its start point, so the old group would
    // skip its 0.25s ease-out and instantly snap to rest — the same
    // teleport this function exists to avoid, just relocated to focus
    // switches between differently-configured inputs.
    if (prevEls) prevEls.forEach((el) => { el.style.transform = ''; });
    if (prevContentEl && prevContentEl !== contentEl) prevContentEl.style.marginBottom = '';
    if (prevClippedEl && prevClippedEl !== clippedEl) {
      prevClippedEl.style.height = '';
      prevClippedEl.style.overflow = '';
    }
    nudgedEls = els;
    nudgedContentEl = contentEl;
  }
  // `instant`: skip the 0.2s ease and snap straight back with no visible
  // motion at all — used when leaving the screen entirely (back button,
  // swipe-back), where any animated settle reads as "the screen moves by
  // itself" during a navigation that should hold completely still. The
  // keyboard's own dismiss (keyboardWillHide, tapping elsewhere without
  // navigating away) keeps the normal animated ease-back — there, the
  // slide is the point, mirroring how it opened.
  function clearNudge(instant) {
    if (instant) {
      nudgedEls.forEach((el) => { el.style.transition = 'none'; });
      if (nudgedContentEl) nudgedContentEl.style.transition = 'none';
    }
    nudgedEls.forEach((el) => { el.style.transform = ''; });
    nudgedEls = [];
    if (nudgedContentEl) { nudgedContentEl.style.marginBottom = ''; nudgedContentEl = null; }
    clearClip();
  }

  if (Keyboard) {
    Keyboard.addListener('keyboardWillShow', (info) => {
      keyboardHeight = (info && info.keyboardHeight) || 0;
      // Consumed as app-space px (composer lifts, --kb), so convert out of device px.
      window.__zeloKbH = keyboardHeight / _appScale();  // read by the onboarding conversation
      window.dispatchEvent(new Event('zelo-kb'));
      setTimeout(nudgeFocusedIntoView, 30);
    });
    Keyboard.addListener('keyboardWillHide', () => {
      keyboardHeight = 0;
      window.__zeloKbH = 0;
      window.dispatchEvent(new Event('zelo-kb'));
      clearNudge();
    });
  }
  // Delayed (80ms), not synchronous — see the note on nudgeFocusedIntoView
  // above. Also covers switching focus to a different field while the
  // keyboard is already open, which doesn't fire another keyboardWillShow.
  //
  // Sign-in/create-account (#auth-overlay) and Tell Zelo More's free-text
  // step (#screen-tellzelo) opt out entirely — no MOVABLE_OVERRIDE entry,
  // no fallback shift, nothing. With native resize already off, skipping
  // the nudge here means those fields never move on focus at all, rather
  // than moving "correctly". (nudgeFocusedIntoView() bails on both too —
  // this is just skipping the pointless setTimeout, not the only guard.)
  document.addEventListener('focusin', (e) => {
    if (e.target.closest && (e.target.closest('#auth-overlay') || e.target.closest('#screen-tellzelo'))) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      setTimeout(nudgeFocusedIntoView, 80);
    }
  }, true);
  document.addEventListener('focusout', (e) => {
    if (e.target.closest && (e.target.closest('#auth-overlay') || e.target.closest('#screen-tellzelo'))) return;
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') return;
    // Only clear if the blurring field's own group is still the one tracked
    // as nudged. WKWebView doesn't guarantee focusout(old) fires before
    // focusin(new) when focus jumps directly between two fields (keyboard
    // "next field" toolbar, programmatic .focus()) — when it arrives late,
    // nudgedEls has already been repointed at the newly-focused field by
    // its own focusin, and an unconditional clearNudge() here would wipe
    // that brand-new nudge back to unshifted instead of leaving it alone.
    const { els } = movableElsAndClip(e.target);
    if (nudgedEls.length && nudgedEls[0] === els[0]) {
      // If this blur is happening because of the global "tap outside a
      // focused field dismisses the keyboard" handler (_dismissingKeyboard,
      // set synchronously just before its own blur() call — see that
      // handler's own comment), clear instantly. That same handler is what
      // fires on the very first touchstart of an edge-swipe-back gesture
      // too, well before this screen's own swipe code gets a chance to run
      // (that code only reacts once the drag crosses its axis threshold on
      // touchmove) — so THIS is actually where "the screen moves by itself"
      // during a swipe-back was really coming from: the animated ease-back
      // this focusout used to always trigger, already underway before the
      // swipe's own instant-clear call ever ran.
      clearNudge(_dismissingKeyboard);
    }
  }, true);

  // Exposed so code outside this IIFE can force a fresh, correctly-timed
  // re-nudge after ITS OWN layout change finishes settling — see the AI
  // Coach suggestions-panel focusin handler above in the file, which
  // needs this because the panel's 0.35s collapse transition runs well
  // past the 30-80ms this module normally waits before measuring.
  window._nudgeFocusedIntoView = nudgeFocusedIntoView;
  // Exposed so a screen can force its own group back to rest on the way
  // out, rather than relying only on blur/keyboardWillHide to catch it —
  // see closeAiCoach()'s call to this, added for the "swipes back to Scan
  // and the content visibly drops" glitch: swiping away doesn't reliably
  // blur the focused field before the screen change starts, so a stale
  // shift could still be sitting on .aicoach-messages/.aicoach-input-bar
  // and only resolve (snapping back down) once something else finally
  // cleared it.
  window._clearKeyboardNudge = clearNudge;
})();

// ============================================================
// ONBOARDING NAME FIELD — one-time width sizing (not per-keystroke)
// ============================================================
// .cine-name-input is text-align:left with its box sized to fit the
// placeholder ("Choose any name") exactly — .cine-screen (its parent)
// already centers children via align-items:center, so this snug box is
// centered as a unit and left-align inside it reads as "starts where the
// visible text starts," lining up with the placeholder's first letter
// instead of the true left edge of a full-width box. Measured once here,
// not on every keystroke — the box's width never changes after this runs,
// so there's nothing to jump when typing starts (same box, same edge,
// before and after). Most real names render narrower than the 16-char
// placeholder and fit inside this width with room to spare; a longer name
// just scrolls within the field like any fixed-width text input.
(function () {
  const input = document.getElementById('cine-name-input');
  if (!input) return;
  function sizeCineNameInput() {
    const cs = getComputedStyle(input);
    const mirror = document.createElement('span');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre';
    mirror.style.left = '-9999px';
    mirror.style.fontSize = cs.fontSize;
    mirror.style.fontWeight = cs.fontWeight;
    mirror.style.fontFamily = cs.fontFamily;
    mirror.style.letterSpacing = cs.letterSpacing;
    mirror.textContent = input.placeholder;
    document.body.appendChild(mirror);
    const textWidth = mirror.getBoundingClientRect().width;
    document.body.removeChild(mirror);
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    input.style.width = Math.min(300, textWidth + paddingLeft + paddingRight + 10) + 'px';
  }
  sizeCineNameInput();
  // Inter loads async (Google Fonts, display:swap) — if it swaps in after
  // the measurement above, re-measure once against the real metrics so the
  // box isn't left sized to a temporary fallback font's width.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeCineNameInput);
})();


