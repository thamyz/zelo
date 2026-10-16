# Zelo — Interaction Mechanics & State Machines for the Expo Port

This file is the third leg of the Expo spec set:
- **`EXPO_MIGRATION_SPEC.md`** — architecture, screen inventory, business logic, data model.
- **`EXPO_SIZES_SPEC.md`** / **`EXPO_SIZES_DATA.json`** — static geometry/typography (x/y/w/h/font).
- **`EXPO_INTERACTION_SPEC.md`** (this file) — **behavior over time**: gestures, timers, state
  machines, and the specific CSS mechanisms that do NOT translate 1:1 to React Native. Written
  after a real build session spent several rounds re-discovering these facts one bug report at a
  time — the goal is to front-load them instead.

**Scope, stated honestly:** this covers the *shared, reusable* interaction patterns that recur
across many screens (they're the highest-leverage ones — get one wrong and every screen using it
inherits the bug). It is **not** a line-by-line mechanics catalog of all ~44 screens; a one-off
mechanic unique to a single screen not listed here still needs to be read from `script.js`
directly. Every value below is a real constant/line read from the current `script.js`/`style.css`,
not a guess.

---

## 1. CSS mechanisms with no 1:1 React Native equivalent (read this before writing gesture/animation code)

| CSS behavior | What RN actually does | Where this bit us |
|---|---|---|
| `border-radius` alone clips nothing | RN needs explicit `overflow: 'hidden'` to clip children to a rounded corner | Added `overflow:'hidden'` "for the rounded look" on the widget card — it wasn't needed (CSS never clips there) and it silently ate the pink divider at the corner and, separately, anything that overflowed the card's fixed height |
| A scrollable container's own `overflow` clips independently from a child's `overflow` | Same clipping logic, but remember a **parent** (e.g. a horizontal `ScrollView`/track) can have its own hard clip window even after a child's `overflow:hidden` is removed | The carousel *track* clips at exactly the card's height regardless of the card's own overflow setting — fixing the card didn't fix content that overflows the track |
| `transform: scale(n)` on an image | Same transform, but the scale factor was tuned against one specific exported asset's own padding/crop | Re-cropping the source PNG and keeping the same `scale(1.3)` overshot — the number was never a universal constant, it was asset-specific |
| `margin-top`/`margin` (block collapsing) | RN margins never collapse between siblings | A literal CSS margin value reproduces a *different* visual gap in RN than it does on web |
| Text `line-height` math | RN's `Text` adds font-metric leading/ascent above and below that CSS already absorbed into its line-height number | Identical declared margin values did not produce the identical total stack height once Inter was actually loaded correctly in RN |
| `::before`/`::after` pseudo-elements | No RN equivalent — must be a real sibling view | Covered fully in `EXPO_SIZES_SPEC.md`'s "Pseudo-element overlays" section; don't re-litigate here, just remember it when porting anything with a CSS overlay |
| `position: sticky` | No direct RN equivalent; RN lists need a measured/pinned header component | `.screen-header` relies on this for its top-of-scroll pinning |
| A plain `document.addEventListener('pointerdown', ...)` that bubbles through everything | RN's legacy Touchable/responder system lets a child (ScrollView, TouchableOpacity, etc.) claim a touch and never let it reach an ancestor listener | "Tap outside to close" worked inconsistently — depends on exactly what was tapped. Needs a root-level `react-native-gesture-handler` `TapGesture` that isn't cancelled by children, not a plain `Pressable` wrapping part of the screen |

**General rule going forward:** before implementing any gesture/overlay/clip effect, grep the real
CSS for the exact property (`overflow`, `transform`, `position`, pseudo-elements) rather than
inferring it from how it looks — several of these look identical to a CSS mental model until they
aren't.

**Mechanical rule for using measured numbers at all** (see `EXPO_SIZES_SPEC.md`'s "Mechanical
rules" section for the full version): every repeat-bug on the Expo side so far traced back to
*re-deriving* a number from a measured one by eyeballing proportions, not to a bad measurement.
Copy `x/y/w/h/radius` values from the JSON literally; for the swipe deck and widget carousel
specifically, build them as absolutely-positioned children (straight from the JSON) inside a fixed
414×896 frame with one outer uniform-scale wrapper, rather than flex/padding — removes reflow as a
variable for exactly the two components that have broken repeatedly. Don't apply this to
scrollable screens, which need real flex flow.

---

## 2. Universal interaction state machines

### 2.1 Drag-tied panel + scrim (sheets, side panels, modals)

This exact pattern repeats across the AI Coach history panel, chat-mode modal, and others. **The
panel's transform and the scrim's opacity are tied directly to the live drag delta, frame by
frame — never a binary show/hide.** (This matches the standing rule: gesture-driven transitions
must track live drag progress, not snap.)

```
onTouchStart:  note startX, set BOTH panel and scrim transition to 'none' (no easing while dragging)
onTouchMove:   dx = max(0, touch.x - startX)                 // only the closing direction moves it
               panel.transform = translateX(dx)
               scrim.opacity   = max(0, 1 - dx / panelWidth)  // scrim fades in lockstep with the drag
onTouchEnd:    decide closing vs. snap-back (by dx threshold or velocity)
               apply EASE = 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)' to both
               panel.transform = '' ; scrim.opacity = ''      // let the (re)applied CSS state finish it
               after 340ms: clear the inline transition properties (cleanup, not a timing tweak)
```

RN equivalent: one shared `Animated.Value` (or Reanimated `SharedValue`) driven by a
`PanGestureHandler`/`Gesture.Pan()`, with `panelTranslateX` and `scrimOpacity` both derived from it
via `interpolate()` — not two independently-animated values that can drift apart.

### 2.2 Edge-swipe-back (screen dismiss gesture)

```
Axis lock:       10px dead zone before committing to horizontal vs. vertical
Commit threshold: max(90, screenWidth * 0.28)   // not a flat 90px — scales with device width
Live reveal:     while dragging, the INCOMING screen (or tab) is mounted side-by-side and both
                 screens move together with the raw drag delta — not revealed only on release
Tab-bar special case: if the destination is a tab, the tab bar (hidden while any screen is
                 pushed) is un-hidden at opacity 0 and faded in AT THE SAME RATE as the drag,
                 not snapped to visible the instant the gesture starts — snapping it in immediately
                 made it "pop in" before the page behind it was meaningfully revealed
Release:         below threshold -> spring back (cubic-bezier(1.70158-based overshoot curve,
                 i.e. a "springEase" bounce) to the original screen
                 at/above threshold -> commit to the destination
```

Screens themselves cross-fade, they don't slide: `.screen { opacity: 0; transition: opacity 0.18s
ease; }`, `.screen.active { opacity: 1; }` — the SLIDE sensation during edge-swipe-back comes
entirely from the drag-tracking track described above, not from the screens' own normal
push/pop transition (which is just `pushScreen()`/`popScreen()` toggling an `active` class with no
animation of its own; the opacity cross-fade is the only motion on a plain, non-gestural
navigation).

### 2.3 Swipe deck (Practice screen cards)

```
Constants:       SWIPE_THRESHOLD = 90px (flat, not width-relative here — different from edge-swipe-back)
                 MAX_ROTATION    = 15deg
                 TAP_MAX_MOVEMENT = 6px   // below this on release, treat as a TAP not a swipe
Drag:            ratio = clamp(dragX / 90, -1, 1);  rotation = ratio * 15deg
                 like/nope stamp opacity = abs(ratio)  — fades in proportionally, tied to raw drag
                 back-stack cards (stack 1 & 2) nudge toward their "ready" position proportionally too
Release below threshold: springBack() — 'transform 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                 (an overshoot/bounce curve), stamps fade back to 0
                 If movement < 6px total, it was a TAP not a drag: left-half tap = previous photo,
                 right-half tap = next photo (photo-stepping within the same card, not a swipe)
Release at/above threshold: commitSwipe() — flies off-screen:
                 flyX = ±innerWidth * 1.6, flyR = ±30deg
                 'transform 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)' (deliberate, weighted throw, not a
                 quick vanish)
                 A light haptic buzz fires on a RIGHT (like) swipe only, not left/nope
Known render bug worth avoiding in RN: a release landing right after a fast drag can have the
                 transition-enable and the transform-change land in the same paint frame, which
                 some engines then apply with NO animation (teleport) instead of interpolating —
                 the real app forces a reflow (`void el.offsetWidth`) between setting the
                 transition and changing the transform specifically to avoid this; Reanimated/RN
                 Animated don't have this specific bug but keep it in mind if using raw CSS-like
                 transitions on web/React DOM anywhere in the port.
```

### 2.4 Scroll/touch-triggered "chrome" reveal with timed auto-hide (widget carousel)

Already fully specified in earlier back-and-forth; repeated here as the canonical example of the
state-machine category (grey touch-outline + pink divider swap):

```
On touchstart OR scroll/drag of the carousel:
    show chrome (outline fades 0->0.4 over 350ms; divider fades 1->0 in the same motion)
    (re)start a 3000ms timer
On the 3000ms timer firing with no further touch:
    hide chrome (outline fades back to 0, divider fades back to 1) over 350ms
Touching again before the timer fires:
    does NOT re-trigger a fade-out/fade-in — stays visible, timer just restarts
Tap OUTSIDE the carousel while chrome is visible:
    hide immediately (cancel the timer, fade out right away) — don't wait out the 3s
Gating: suppressed entirely while a text input is focused (that tap is dismissing the keyboard,
    not asking for the widget's chrome)
```

### 2.5 Toast / panel auto-hide timing catalog (every timed dismissal in the app, for reference)

| UI element | Visible duration | Dismiss transition |
|---|---|---|
| Copy-toast ("Copied!") | until manually re-triggered | 340ms slide-up-and-fade, matches `.copy-toast`'s own CSS transition |
| Streak notification | 4200ms | 340ms fade |
| XP gain panel | 2600ms | 340ms fade; count-up animation starts 260ms after shown |
| Level-up panel | 3200ms | 340ms fade; shown 1900ms after an XP award that crosses a level boundary (so it never overlaps the XP panel's own count-up) |
| Scan-limit toast | 2400ms | 340ms fade-out, DOM removal 340ms after that (two-stage: class removed, then unmounted) |
| Chat-settings/history/AI-Coach row long-press menu | — (stays open until dismissed) | triggered by a 500ms press-and-hold, not a tap |
| Terms checkbox warning | 2600ms | class-based fade |
| "Shake" invalid-input animation | 400ms | — |

General pattern: **340ms is the app's standard "fade out and unmount" duration** for anything
dismissible — reuse that as the default rather than inventing a new number per component.

### 2.6 Practice tab first-visit tutorial — reuses the REAL deck, never a separate mock

**This whole flow was undocumented until 2026-10-01 (see `EXPO_SIZES_SPEC.md`'s new "Practice tab
— first-visit tutorial flow" section for full geometry) — flagging the one critical architecture
fact here since it's behavior, not geometry:**

```
startPracticeTutorial() → welcome screen → confirm-profile → edit-details (optional detour) →
swipe-right lesson → swipe-left lesson → photo-nav lesson → done
```

The swipe-right/swipe-left lessons do **not** show a separate mock card — they dim and overlay
instructional content directly on top of `#card-deck`'s real top card (`.swipe-card[data-stack="0"]
.swipe-card-photo`), and a tutorial swipe is a REAL swipe through the same `commitSwipe()`/
`springBack()` functions documented in §2.3 above — just intercepted at the very end (inside
`commitSwipe`, gated on `_practiceTutorialActive`) to advance the lesson step instead of continuing
normal match logic. **After the lesson ends, you're already looking at the real, normal deck** —
there's no transition/rebuild into "the real cards," because it was always the real deck underneath
the whole time. If an RN port shows a visible rebuild/transition when the tutorial finishes, the
tutorial was likely implemented as a separate mock card screen instead of an overlay on the live
deck component — that's an architecture mismatch to fix, not a timing/animation tweak.

### 2.7 Long-press row actions

Chat history rows, AI Coach history rows, and the dev pace-reset control all use the same
**500ms press-and-hold** threshold to open a contextual action menu (distinct from a tap, which
opens the row normally). Treat this as the standard long-press duration for any row-level action
menu in the port, not a per-screen invention.

---

## 3. What this file does NOT cover

- Screen-specific one-off mechanics not shared by anything else (e.g. a single onboarding step's
  custom validation) — read `script.js` directly for those.
- Exact easing-curve *visual feel* comparison — the cubic-bezier/spring values above are copied
  verbatim from source; whether RN's `Animated`/Reanimated curve functions produce an identical
  feel from the same control points hasn't been independently verified on-device.
- Dark-mode-specific timing differences — there are none; only color tokens change, confirmed
  already in `EXPO_SIZES_SPEC.md`.
