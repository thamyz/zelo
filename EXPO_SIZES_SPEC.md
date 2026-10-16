# Zelo — Exact Sizes, Positions & Typography for the Expo Port

This file is ONLY geometry and typography — no behavior/logic (that's `EXPO_MIGRATION_SPEC.md`).
Every number below is a REAL measurement taken by rendering the actual app and reading
`getBoundingClientRect()` + `getComputedStyle()` — not values copied from the CSS source. Source
CSS uses rem/em/percentages in places, so the rendered pixel value is what's captured here, which
is what actually has to be matched on screen, not what the source technically declares.

## The measuring standard (read this first)

**Device pinned: iPhone 11** (per the user — this is what's used for testing right now).
iPhone 11 = **414 × 896** in Apple's own point units, **@2x** pixel density (828×1792 physical
pixels — NOT @3x; that's the Pro/Pro Max models only).

**The key fact that makes this whole file directly usable in Expo:** this app's `<meta
name="viewport">` is `width=device-width, initial-scale=1.0, ... viewport-fit=cover` — meaning
**1 CSS pixel in this app's stylesheet = 1 iOS "point" on the real device**, with zero scale
factor to convert. iOS points are *also* exactly what React Native's `StyleSheet` numbers mean on
iOS (RN's `width: 58` = 58 points = 58 of these same CSS pixels). **So every number in this
document can be typed into an RN `StyleSheet` as-is — no ×2, no ×3, no conversion factor, no unit
math.** (This equivalence breaks only for things measured in real device *pixels*, like exported
PNG assets at @2x/@3x — those still need the usual `@2x`/`@3x` filename suffixes; the POINT/logical
values in the tables below are what you put in `style={{ width: N }}`.)

All measurements below were captured with Playwright/Chromium at `viewport: 414×896,
deviceScaleFactor: 2` — the exact iPhone 11 configuration — against the real, currently-shipping
app (`index.html`/`style.css`/`script.js` in this repo), not a mockup.

**What survives the CSS→RN translation and what doesn't (added 2026-10-01, from real Expo build
attempts).** Not every number in this file carries the same confidence level:

- **`x`/`y`/`w`/`h` (trustworthy as-is).** These come from `getBoundingClientRect()` — the browser's
  own post-layout answer to "where did this actually end up on screen" — not from reading CSS
  source. They're real rendered pixels/points, already netting out margin collapsing, line-height
  spillover, and box-model quirks. Structural facts derived from these (what's absolutely
  positioned vs. in-flow, what sits above/below/inside what, which element owns a given visual
  effect — e.g. "the dots overlay sits 14px above the card's bottom edge, not below it in flow")
  are equally trustworthy: they're geometry facts about the real render, not guesses.
- **Declared `padding`/`gap`/`margin` values in the "extra" column (starting point, not the
  answer).** These ARE read from CSS source (`getComputedStyle`), and copying them literally into
  RN does not reliably reproduce the same visual gap. Proven case: a divider's CSS margin of 20px
  needed to become 10px in RN to look the same. Root causes: RN's `Text` adds font-metric
  leading/ascent padding above and below that CSS line-height math already absorbs on web; RN
  doesn't collapse adjacent margins the way block-level CSS does; flexbox `gap` rounds/handles
  differently across the two engines. Treat every padding/gap/margin number here as a first guess —
  set it, rebuild, compare against the real device, nudge, and change **one value per rebuild**, not
  a batch of unverified guesses in one pass (batching multiple numeric changes before seeing any of
  them rendered is exactly what turned one fix into five build cycles).
- **Track spacing as named relationships between specific element pairs, not a global offset.** A
  fix like "increase the header→widget-carousel gap without touching the who-section→AI-Coach gap"
  is only safe to make if each gap is addressed individually. Don't refactor toward one shared
  top-padding/spacing constant across sections unless the real CSS already does that (check before
  assuming).
- **The gap in tooling, if this keeps being manual:** this repo has `EXPO_SIZES_DATA.json` — real
  measured `{x,y,w,h,...}` per element, diffable against Expo output. The Expo project has no
  equivalent dump yet. A small `measureInWindow()`-based dev-only export on the Expo side, written
  to the same `{x,y,w,h}` shape per named element, would let a diff script point at exactly which
  values survived translation and which didn't — one script run instead of several build-and-eyeball
  cycles. This file can't build that piece (no access to the Expo project's codebase from here) —
  it's a task for whichever session is driving the Expo build.

**Coordinate system:** `x`/`y` = top-left corner of the element, measured from the top-left corner
of the *screen* (i.e. `(0,0)` is the very top-left of the 414×896 viewport — NOT inside a card or
a parent container). `w`/`h` = the element's real rendered width/height, border included, in the
same point units.

**Font:** the whole app uses **Inter** (loaded from Google Fonts, weights 400/500/600/700/800),
falling back to `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif` if Inter
fails to load. In Expo: bundle Inter (e.g. `expo-font` + `@expo-google-fonts/inter`) as the default
app font rather than relying on the system font — the app was designed against Inter's specific
metrics (x-height, letter shapes), not San Francisco.

**Weight distribution across the whole stylesheet** (how many `font-weight` declarations use each
value — tells you which weights actually matter): **700 → 133 uses**, **800 → 126 uses**, **600 →
76 uses**, **500 → 19 uses**, **400 → 5 uses**, **900 → 4 uses** (one screen only — the onboarding
"Even smooth talkers get stuck" headline). In practice: **800 = headlines/big numbers, 700 =
buttons/labels/emphasis, 600 = secondary emphasis, 400/500 = body text.** Inter's own weight names:
400=Regular, 500=Medium, 600=SemiBold, 700=Bold, 800=ExtraBold, 900=Black — make sure all 6 are
actually loaded as separate font files/variants, not faked with CSS `font-weight` on a single
Regular file (which RN/iOS will NOT fake-bold the way a browser does).

## Press / active states — how buttons should look and move when touched

Resting-state geometry (everywhere else in this file) is only half the spec — what a button does
the instant it's pressed is just as real a design decision, and guessing it produces the same
"looks slightly off" result as guessing a size would. Real values below, read directly from the
`:active` CSS rules for every already-documented interactive element in this file (methodology:
see the `web-to-rn-conversion` skill's Step 2 — the general technique is to toggle the equivalent
class and re-read `getComputedStyle` for the delta; these specific values are simple enough
`scale()`-only rules that reading the declared CSS directly is sufficient, no ambiguity):

| Element | Press feedback |
|---|---|
| `.asst-suggest-btn` (Get Suggestions) | `scale(0.97)` |
| `.send-btn`, `.aicoach-entry-btn` (Chat composer) | `scale(0.93)` |
| `.scan-fab` (tab bar center button) | `scale(0.94)` |
| `.swipe-card-info-btn` | `scale(0.92)` |
| `.swipe-action-btn` (skip/like) | `scale(0.97)` |
| `.scan-who-card` | `scale(0.97)` |
| `.asst-coach-banner` (AI Coach card on Scan) | `scale(0.995)` (barely perceptible — deliberately subtle for a large card) |
| `.aicoach-quick-pill` (suggestion chips) | `scale(0.97)` |
| `.cine-back` (52×52 back button — onboarding step 1 AND the Practice tutorial's Edit Details screen) | `scale(0.92)` |
| `.cine-avatar` (used identically in onboarding, confirm-profile, edit-details) | `scale(0.98)` |
| `.cine-next` / `.ptw-start-btn` (the pink primary CTA button — onboarding "Continue" and all 3 Practice-tutorial primary buttons) | `scale(0.99)` / `scale(0.98)` respectively — both are subtle, near-imperceptible presses, not a dramatic shrink |
| `.cine-showcase-skip` (onboarding skip "X") | `scale(0.92)` |
| `.widget-carousel-arrow` | `translateY(-50%) scale(0.92)` — note the `translateY(-50%)` is the button's own vertical-centering transform, kept in the rule so the scale doesn't un-center it |
| `.settings2-row` (every settings list row, including the Practice tutorial's Edit Details rows) | **not a scale — a background color flash** to `var(--s2)` (the secondary surface token), no transform at all |

**Pattern:** every PRIMARY action button (CTAs, cards, pills) uses a subtle `scale()` between
0.92–0.99 on press, never a color change. List/settings ROWS use a background color flash instead,
never a scale. If an element isn't in this table, no `:active` rule exists for it in source —
that's a real fact (no press feedback), not a gap to fill with a guess.

## Mechanical rules for using these numbers (added 2026-10-01, no judgment calls allowed)

The actual failure pattern across every repeat-bug on the Expo side so far (the divider, the info-
button position, the card radius) was never a bad measurement — it was **re-deriving a number from
a measured one by eyeballing proportions** (padding, scale factors, "looks about right"). The fix
is to delete that step entirely:

1. **Copy the number, don't recompute it.** If an element has a measured `x,y,w,h,radius` in
   `EXPO_SIZES_DATA.json`, that becomes the RN style literally — `width`, `height`, `borderRadius`
   as-is. For a gap between two elements, the margin is `nextY - (prevY + prevH)` computed directly
   from the JSON, never an independently-chosen value.
2. **Mechanical sum-check, every time, not just after a bug report.** For any fixed-height
   container (a card, a carousel slide), the stacked children's heights + margins **must** sum to
   exactly that container's height before calling it done. This single check would have caught the
   divider bug on the first attempt instead of the fourth.
3. **Nothing gets guessed.** If an element (an icon's exact size, a glyph's inset, a stroke width)
   isn't in the measured JSON, that's a stop sign — ask for that specific missing number instead of
   eyeballing it. Icon/glyph proportions were never measured in the first pass, which is exactly
   why they were never going to be right — see the real icon specs added below, which close that
   gap for the two highest-bug screens.
4a. **If the same class appears more than once in a table with different `w`/`h`, that's a stop
   sign too, not a varied-measurement.** Check whether a parent has a resting-state (not just
   `:active`/transition) `transform: scale()` on it before assuming they're independently sized —
   React's own `getBoundingClientRect()` returns the POST-transform box, which silently bakes a
   parent's scale into what looks like a standalone measurement. (Real example that slipped through
   once already: the swipe deck's 3 stacked cards and their internal buttons/text all measured as
   different-sized boxes before this was caught — they're one identical layout box each, scaled per
   `data-stack`. Confirmed as the ONLY place in the stylesheet this pattern exists in a resting
   state — everywhere else `scale()` is used, it's either `:active` press-feedback or a one-shot
   animation keyframe, neither of which produces simultaneous multi-instance ambiguity.)
4. **For fixed-layout screens specifically (swipe deck, widget carousel):** position every child
   absolutely (`left`/`top`/`width`/`height` straight from the JSON) inside a fixed 414×896
   container, with one outer wrapper that uniformly scales that box to whatever device it's
   actually running on. This removes flex reflow as a variable for exactly the components that
   have been breaking. Tradeoff: only valid for fixed, non-scrolling layouts — not a global rewrite,
   and don't apply it to scrollable screens (Settings lists, chat, etc.), which need real flex flow.

---

## Swipe deck — exact icon/glyph specs (closes the "icons never measured" gap)

Every icon on the Practice swipe card is a literal inline SVG with explicit `width`/`height`/
`viewBox` in the source — these are exact vector specs, not proportions to eyeball, and port
directly to `react-native-svg` with the same path data.

**Badge pill ("✦ Top Match")** — pill itself already in the Practice section above (x:59, y:266,
86×22 on the top card); its internals:
```
Icon:    12×12, viewBox="0 0 24 24", fill="currentColor" (inherits the pill's pink text color)
         <path d="M12 2.5l1.9 5.7a3 3 0 0 0 1.9 1.9L21.5 12l-5.7 1.9a3 3 0 0 0-1.9 1.9L12 21.5
                   l-1.9-5.7a3 3 0 0 0-1.9-1.9L2.5 12l5.7-1.9a3 3 0 0 0 1.9-1.9z"/>
Inset:   6px from the pill's top edge, 10px from its left edge (matches the pill's own
         padding: 5px 10px exactly)
Gap:     5px between icon and "Top Match" text
```

**Info button (ⓘ, next to the name)** — button itself already in the Practice section (x:344,
y:635, 26×26 circle on the top card); its internals:
```
Icon:    14×14, viewBox="0 0 24 24", fill="none", stroke="currentColor", stroke-width="2.4",
         stroke-linecap/linejoin="round"
         <circle cx="12" cy="12" r="9.5"/>
         <line x1="12" y1="11" x2="12" y2="16.5"/>
         <circle cx="12" cy="7.6" r="0.6" fill="currentColor" stroke="none"/>
Inset:   exactly centered — (26-14)/2 = 6px on all 4 sides, confirmed by measurement
```

**Skip button (✕) / Like button (heart)** — buttons already in the Practice section (141×45 /
141×45 on the top card); their internals:
```
Skip icon:  16×16, viewBox="0 0 24 24", stroke="currentColor", stroke-width="2.5", round caps/joins
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
Like icon:  16×16, viewBox="0 0 24 24", fill="currentColor" (solid heart, not stroked)
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78
                      l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
Gap:        7px between icon and label text (both buttons)
Padding:    15px 10px (both buttons, button's own box — already in the Practice section)
```

## Corner-radius tokens (used everywhere, not just where measured below)

| Token | Value | Typical use |
|---|---|---|
| `--r-sm` | **8px** | small pills/rows (e.g. Upload Screenshot) |
| `--r-md` | **14px** | medium controls |
| `--r-lg` | **20px** | the default card radius (most `.settings2-card`-style cards) |
| (local, widget cards only) | **34px** | Home widget carousel cards specifically |
| pill / fully round | **999px** | "Get Suggestions", most primary `.btn2-primary` buttons |
| circle | **50%** | avatars, the Scan tab FAB, icon-circle buttons |

## Card surface convention (applies to nearly every card measured below)

No visible border on any card. Every card/row surface instead uses:
```
background: #ffffff (light) / #201c17 (dark)   /* --s1 */
box-shadow: 0 1px 6px rgba(28, 25, 23, 0.06)
border: none
```
If a "border" appears in a table below, it is a DELIBERATE exception (an active/selected state, or
a dark-mode-only outline on imagery) — not the default. See `EXPO_MIGRATION_SPEC.md` §13.1 for the
short list of real exceptions.

---

## Shared header bar (`.screen-header`) — reused on ~35 sub-screens

Every pushed sub-screen (Settings rows, Privacy & Data, Notifications, Account dashboard, etc. —
anything that isn't a tab root) uses one identical header component. Measured on 2 different
screens to confirm it's pixel-identical everywhere:

| Element | x | y | w | h | extra |
|---|---|---|---|---|---|
| `.screen-header` | 0 | 0–36* | 414 | 73–109* | `padding: 14px 20px` (dashboard root adds `50px` top padding for the status bar — see note), `gap: 12px`, `border-bottom: 1px solid var(--border)`, `background: var(--s1)` (#fff light), `position: sticky`, `top: 0`, `z-index: 10` |
| `.screen-header .back-btn` | 20 | 14–50* | 44 | 44 | `border-radius: 50%`, `background: #fff`, `border: 1px solid var(--border)` |
| `.screen-header .screen-title` | — | — | — | — | text label, follows the "screen title" row in the global type scale |

\* y/h vary only because the safe-area top inset differs per screen context (36px on a pushed
sub-screen vs. 0px + larger padding on the dashboard root, which sits directly under the status
bar). The `x/w/padding/gap/border/background/position` values are identical everywhere.

In RN/Expo terms: this is one shared `<ScreenHeader>` component, not something to rebuild per
screen. Its back button is a 44×44 circular tap target (meets iOS HIG minimum), centered 20pt from
the left edge.

---

## Pseudo-element overlays (`::before`/`::after`) — invisible to plain element inspection

These are real visual layers the app renders via CSS `content: ""` pseudo-elements. They do **not**
exist as DOM nodes, so naive "find every element and measure it" sweeps miss them entirely — this
whole section exists because that's exactly what happened on the first pass of this file. Anything
building the Expo UI from a DOM/element inspector alone (not the stylesheet) will miss these too.

**`.widget-card::after` — the grey outline around the front-page promo/widget cards.** This is the
actual mechanism behind what reads as a "grey border" on those cards; the card element itself has
`border: none` — the outline is this separate overlay, invisible until touched:

| State | opacity | border | radius | inset |
|---|---|---|---|---|
| At rest (default) | `0` (invisible) | `1px solid rgb(236,229,218)` | `34px` (inherits card radius) | `0 0 0 0` (covers full card) |
| While touched (`.chrome-visible` on the carousel) | `0.4` (CSS-declared target; mid-transition sample measured `0.153` at +100ms) | same | same | same |

Transition: `opacity 0.35s ease`. In Expo: an `Animated.View` positioned absolutely over the card,
matching its border-radius, border `1px solid #ece5da`, animating opacity 0→0.4 on press.

**`.settings2-toggle-slider::before` — the toggle switch knob.** The track (`.settings2-toggle`) is
44×26, `border-radius: 999px` (pill). The knob itself:

| State | w | h | position | bg |
|---|---|---|---|---|
| Off | 20 | 20 | `left: 3px, top: 3px` (relative to track) | `#ffffff` |
| On | 20 | 20 | `transform: translateX(18px)` added on top of the same `left:3px` (i.e. knob's right edge lands flush with the track's right inset) | `#ffffff` |

Track background changes `var(--border)` (off) → `var(--accent)`/pink (on) at the same time. In
Expo: knob is a 20×20 circle inset 3pt from the track edge, animating `translateX` by 18pt, not a
recomputed `left`.

**Other `::before`/`::after` overlays found in the stylesheet** (grep'd exhaustively; included for
completeness — most are decorative, not primary navigation chrome):

| Selector | Role | Key properties |
|---|---|---|
| `.swipe-card[data-stack="1"/"2"]::after` | Back-of-stack cards, flat color mask so the stacked card behind doesn't show through | `inset: 0`, `background: #fff` (var(--s1)), `border-radius: inherit`, `z-index: 100` |
| `.journey-hero::before` | Top fade gradient over the Journey hero image | measured **414×70px**, `position: absolute`, `top: 0`, gradient `var(--bg)` → transparent |
| `.age-roller-wrap::before` / `::after` | Top/bottom fade gradients over the age picker's scroll list | same gradient-fade pattern, over `var(--s2)` |
| `.aicoach-status-dot::after` | Pulsing halo ring behind the AI Coach status dot | `inset: -4px`, `border-radius: 50%`, `opacity: 0.22`, same color as the dot |
| `.cine-opt.selected .cine-radio::after`, `.cine-setup-row.done .cine-setup-dot::after`, `.cine-check input:checked + .cine-check-box::after`, `.cine-trial-plan--selected .cine-trial-radio::after`, `.settings2-radio-row.selected .settings2-radio::after`, `.settings2-check-row.selected .settings2-check::after` | Checkmark glyphs drawn with the CSS border-trick (a small rotated 2-sided border, not an image/icon) | each ~5–7px wide × 9–12px tall, `border-width: 0 ~2.4px ~2.4px 0`, `transform: rotate(45deg)` — different exact px per component, all the same technique |
| `.ptw-icon-wrap::before` / `::after` | Sparkle shapes (practice tutorial walkthrough), via `clip-path: polygon(...)` | decorative, tutorial-only |
| `.ptw-dim::before` | Full-screen dim overlay behind the tutorial spotlight | `inset: 0`, `background: rgba(0,0,0,0.45)`, `z-index: 1` |
| `.dd-checklist li::before` | Green checkmark circle on the Download-My-Data checklist | measured **22×22px**, `border-radius: 50%`, `background: var(--accent)` + inline checkmark SVG data-URI |
| `.refer-step::before` (not last child) | Vertical connecting line between referral steps | measured **2×33px** (height varies with row spacing), `background: rgba(236,72,153,0.1)`, `left: 13px`, `top: 28px` |
| `.pl-divider::before` / `::after` | The two horizontal lines flanking an "or" divider | `flex: 1`, `height: 1px`, `background: var(--border)` |

In Expo, every row in the table above is a small absolutely-positioned `<View>` rendered as a
sibling, not a pseudo-element (RN has no `::before`/`::after`) — same visual result, different
implementation mechanism.

---

## Toast / notification banner (`.limit-toast` and siblings — shared floating-alert pattern)

Measured via a scan-limit toast; the same visual treatment is reused for streak/XP/level-up copy
toasts (same class family, different text/icon):

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| `.limit-toast.visible` | 16 | 3 | 382 | 75 | 20px | 13.12px/600 | rgb(28,25,23) | rgb(255,255,255) | `shadow: rgba(28,25,23,.18) 0 14px 32px 0, rgba(28,25,23,.08) 0 2px 10px 0` (double shadow — soft+tight); pad: 14px 14px 17px; gap: 14px |

Sits flush to the top safe area (y:3), full-width minus 16px side margins, floating above content
(not inline) — standard dismissible top-banner pattern.

---

## Global type scale — every distinct text style actually rendered in the app

**98 distinct combinations of size+weight+letter-spacing+line-height** found across all 8 priority screens measured (see below for which). Sorted largest to smallest.

| Font size | Weight | Letter spacing | Line height | Used | Example(s) |
|---|---|---|---|---|---|
| 64px | 800 | -2px | 64px | 1× | cine-pct: "1%" |
| 41.6px | 800 | -1px | normal | 1× | match-heading: "It's a Match" |
| 35.2px | 800 | -0.8px | 39.424px | 14× | cine-title.locked-title: "Keep going withZelo"; cine-title: "Let's get toknow you 👋" |
| 35.2px | 900 | -0.8px | 39.424px | 1× | cine-showcase-head: "Even smooth talkers get stuc" |
| 33.6px | 800 | -1px | normal | 1× | scan-page-brand: "Zelo" |
| 30.4px | 800 | -1px | 30.4px | 4× | home-brand: "Zelo"; chat-back-bar-brand: "Zelo" |
| 28.8px | 800 | -0.8px | 32.256px | 4× | cine-title.cine-title--plain: "Stay on track with Zelo noti"; cine-title.cine-title--plain: "We're setting everything up " |
| 28.8px | 800 | normal | normal | 1× | milestones-title: "Milestones" |
| 28px | 800 | -0.5px | 33.6px | 1× | scan-headline: "Get the right words,effortle" |
| 27.2px | 800 | normal | 32.64px | 1× | refer-headline: "Invite friends.Get rewards." |
| 27.2px | 800 | normal | normal | 1× | ptw-title: "Let's get you ready!" |
| 27.2px | 800 | -0.5px | 32.096px | 1× | cine-trial-headline: "Start your 3-day FREEtrial t" |
| 26.88px | 800 | -0.5px | 31.7184px | 1× | paywall-headline: "How your 7-dayfree trial wor" |
| 26.4px | 800 | -0.5px | normal | 1× | chats-title: "Chats" |
| 24.8px | 800 | -0.4px | 29.76px | 4× | auth-email-title: "Add Your Email"; auth-email-title: "Email Connected!" |
| 24.8px | 800 | -0.496px | normal | 1× | history-title: "History" |
| 24px | 800 | normal | normal | 2× | pl-hero-title: "Profile & Login"; journey-title: "Your Journey" |
| 24px | 800 | -0.3px | normal | 4× | settings2-title: "Practice Preferences"; settings2-title: "Notifications" |
| 24px | 800 | -1px | normal | 1× | scan-page-brand.paywall-brand: "Zelo" |
| 23.2px | 800 | -0.5px | 27.84px | 1× |  |
| 22.4px | 800 | -0.3px | normal | 1× | pr-title: "Help Zelo get smarter" |
| 20.8px | 800 | normal | normal | 1× | chats-empty-text: "No chats yet" |
| 20px | 800 | normal | normal | 4× | dash-stat-num: "12"; dash-stat-num: "0" |
| 19.2px | 800 | normal | normal | 1× | skipped-title: "Skipped Profiles" |
| 18.4px | 800 | normal | normal | 3× | chats-empty-cta: "Start a conversation"; settings2-pro-hero-title: "Zelo Pro" |
| 18.4px | 800 | -0.3px | normal | 1× | settings2-title.settings2-title--sm: "How can we help?" |
| 17.92px | 800 | normal | normal | 2× | cine-showcase-cta: "Get Started"; cine-offer-price: "THB 2,999.00 THB 699.00/year" |
| 17.92px | 700 | normal | normal | 5× | cine-btn: "Continue"; cine-btn.cine-btn--light: "Skip" |
| 17.6px | 800 | -0.3px | normal | 1× | home-section-title: "Today's Top Match" |
| 17.28px | 400 | normal | 25.056px | 13× | cine-lede: "This helps us personalize yo"; cine-lede: "This helps personalize your " |
| 17px | 700 | -0.2px | normal | 1× | screen-title: "Your Reply" |
| 17px | 800 | normal | normal | 1× | paywall-cta: "Continue" |
| 16.8px | 800 | normal | normal | 5× | refer-howitworks-title: "How it works"; settings2-plan-price: "THB 999 / year" |
| 16.8px | 700 | 0.168px | normal | 4× | start-btn.match-start-btn: "Send a Message"; generate-btn: "Continue" |
| 16.8px | 700 | normal | normal | 1× | match-skip-btn: "Keep Swiping" |
| 16.32px | 800 | normal | normal | 2× | mission-section-title: "This Week"; mission-section-title: "Daily Missions" |
| 16px | 600 | normal | normal | 1× | asst-suggest-btn: "Get Suggestions" |
| 16px | 800 | normal | normal | 6× | scan-who-title: "Who's this about?"; cine-note-title: "Personalized to your goals" |
| 16px | 700 | normal | normal | 5× | asst-coach-title: "AI Coach"; cine-provider.cine-provider--apple: "Continue with Apple" |
| 16px | 600 | normal | 21.6px | 1× | cine-sysprompt-txt: "Zelo would like to send you " |
| 16px | 400 | normal | normal | 1× | cine-offer-sub: "78% less than our monthly ra" |
| 15.68px | 400 | normal | normal | 1× | match-sub: "You and liked each other" |
| 15.68px | 800 | normal | normal | 2× | cine-plan2-value: "Playful"; cine-plan2-value: "Overthinking" |
| 15.5px | 800 | normal | 18.6px | 3× | widget-card-title: "Your Streak"; widget-card-title: "Your Activity" |
| 15.36px | 700 | normal | normal | 12× | btn2.btn2-primary.settings2-signout-btn: "Sign Out"; refer-share-btn: "Share with friends" |
| 15.36px | 600 | normal | normal | 1× | btn2.btn2-text: "Try Another Tone" |
| 15.2px | 600 | normal | 21.28px | 1× | chats-empty-sub.chats-empty-sub--1: "Start a conversation and see" |
| 15.2px | 700 | normal | normal | 7× | pl-signout-btn: "Sign Out of All Devices"; auth-submit-btn: "Link Email" |
| 15.2px | 400 | normal | 22.8px | 1× | pr-body: "Want your practice conversat" |
| 15.2px | 600 | normal | normal | 2× | pr-later: "Not right now"; cine-setup-cap: "Customizing your Zelo experi" |
| 15.2px | 400 | normal | normal | 3× | cine-sysprompt-btn: "Don't Allow"; cine-sysprompt-btn.cine-sysprompt-btn--go: "Allow" |
| 15.2px | 800 | normal | normal | 2× | aicoach-suggest-title: "What do you need help with?"; aicoach-suggest-title: "Quick actions" |
| 15px | 400 | normal | normal | 1× | scan-upload-clear-btn: "Remove Photo" |
| 15px | 700 | normal | 18.75px | 4× | paywall-step-title: "Complete Sign-up"; paywall-step-title: "Today: Get Instant Access" |
| 14.88px | 700 | normal | normal | 6× | swipe-action-btn.swipe-action-btn--skip: "Skip"; swipe-action-btn.swipe-action-btn--like: "I'm Interested" |
| 14.72px | 700 | normal | normal | 6× | pl-avatar-label: "Profile photo"; cine-referral-apply: "Apply" |
| 14.72px | 400 | normal | normal | 1× | cine-showcase-signin: "Already have an account? Sig" |
| 14.72px | 600 | normal | normal | 2× | history-tab.active: "Scans"; history-tab: "Matches" |
| 14.4px | 700 | normal | normal | 90× | screen-title: "Account"; b: "Personalization" |
| 14.4px | 400 | normal | 20.88px | 1× | refer-sub: "Share Zelo with your friends" |
| 14.4px | 400 | normal | 21.6px | 1× | cine-note-sub: "We'll use your answers to ta" |
| 14.08px | 400 | normal | 21.12px | 17× | settings2-lede: "Customize how Zelo talks to "; settings2-lede: "See how Zelo responds with t" |
| 14.08px | 700 | normal | normal | 1× | settings2-plan-name: "Annual Plan" |
| 14.08px | 600 | normal | normal | 1× | scan-result-loading-text: "Zelo is thinking…" |
| 14.08px | 400 | normal | normal | 1× |  |
| 14px | 400 | normal | 21px | 1× | scan-headline-sub: "Smart, natural replies for a" |
| 13.76px | 400 | normal | 19.264px | 1× | pl-hero-sub: "Manage your account and sign" |
| 13.76px | 400 | normal | 20.64px | 4× | auth-subtext: "Create an email and password"; auth-subtext: "You can now sign in with you" |
| 13.76px | 700 | normal | normal | 1× | settings2-footlink: "Back to settings" |
| 13.76px | 400 | normal | normal | 4× | settings2-pro-hero-sub: "You're getting the most out "; cine-offer-legal: "Terms · Privacy · Restore" |
| 13.6px | 400 | normal | normal | 3× | pr-note: "You can turn this off anytim"; journey-subtitle: "One day at a time." |
| 13.6px | 400 | normal | 18.36px | 1× | p: "The more you use Zelo, the b" |
| 13.6px | 700 | normal | normal | 4× | aicoach-quick-pill: "Generate Reply"; aicoach-quick-pill: "Explain Message" |
| 13.6px | 600 | normal | normal | 1× | journey-progress-msg: "You're on the right path!" |
| 13.44px | 600 | normal | 18.144px | 1× | p: "The more friends you invite," |
| 13.44px | 700 | normal | normal | 2× | pl-resend-btn: "Resend link"; skipped-delete-all-btn: "Delete All" |
| 13.3333px | 400 | normal | normal | 184× | upload-row: "Upload Screenshot"; scan-who-card: "Dating" |
| 13.12px | 400 | normal | normal | 2× |  |
| 13px | 600 | normal | normal | 1× | upload-label-text: "Upload Screenshot" |
| 13px | 400 | normal | 16.9px | 1× | asst-coach-sub: "Level up your conversations " |
| 13px | 400 | normal | 17.55px | 4× | paywall-step-sub: "You successfully created you"; paywall-step-sub: "Unlock Pro and enjoy all fea" |
| 13px | 700 | normal | normal | 3× | lb-tab: "Weekly"; lb-tab: "Monthly" |
| 12.8px | 400 | normal | normal | 43× | home-section-sub: "Handpicked for you. Get to k"; span: "Change how Zelo responds to " |
| 12.8px | 700 | normal | 17.92px | 1× | chats-empty-sub.chats-empty-sub--2: "Practice now to feel more co" |
| 12.8px | 400 | normal | 18.56px | 1× | span: "Let us review some of your p" |
| 12.8px | 400 | normal | 16.64px | 2× | cine-plan2-desc: "Light, fun and easygoing con"; cine-plan2-desc: "We'll help you respond witho" |
| 12.8px | 400 | normal | 19.2px | 1× | cine-trial-legal: "3 days free, then THB 999.00" |
| 12.48px | 700 | normal | normal | 1× | refer-link-label: "Your referral link" |
| 12.48px | 400 | normal | normal | 5× | pl-avatar-sub: "Tap to change your photo"; pl-field-sub: "This is how you'll appear in" |
| 12.48px | 400 | normal | 18.72px | 9× | settings2-footnote: "You'll stay signed in on thi"; settings2-footnote: "These settings only affect y" |
| 12.48px | 600 | normal | normal | 1× |  |
| 12.16px | 400 | normal | 18.24px | 1× | auth-sheet-legal: "By continuing, you agree to " |
| 12px | 400 | normal | normal | 1× | mission-subtitle: "Track your journey to rizz m" |
| 11.52px | 700 | 0.6912px | normal | 17× | settings2-section-label: "Zelo"; settings2-section-label: "Account" |
| 11.52px | 800 | 0.576px | normal | 4× | cine-plan2-eyebrow: "Your style"; cine-plan2-eyebrow: "Your focus" |
| 11.52px | 400 | normal | 16.128px | 1× | aicoach-history-footnote: "All conversations are saved " |
| 11.52px | 400 | normal | normal | 2× | lb-subtitle: "Compete. Improve. Climb high"; lb-timer: "⏱️ This week ends in 2d 14h " |
| 11.5px | 400 | normal | 15.525px | 3× | widget-card-sub: "Great job! You're building c"; widget-card-sub: "Track your progress and keep" |

---

## Per-screen measurements

8 priority screens — the ones visible in the screenshots under discussion, plus the ones covering the most-reused shared components (a Settings list row measured once covers ~25 other Settings screens that reuse the exact same `.settings2-row`/`.settings2-card` classes). Not every one of the app's ~44 screens is in this file; say which screen to add next and it's the same process.

### Tab bar (bottom nav)

**bar**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| tab-bar#tab-bar "Practice " | 0 | 798 | 414 | 98 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(255, 255, 255, 0.72) | border: 1px 0px 0px solid none none rgb(236, 229, 218) rgb(28, 25, 23) rgb(28, 25, 23); pad: 0px 0px 34px |

**buttons**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| tab-btn#tabbtn-practice "Practice" | 0 | 799 | 138 | 63 | 0px | 13.3333px/400 | rgb(141, 141, 141) | rgba(0, 0, 0, 0) | gap: 4px |
| tab-btn.tab-btn--scan.active#tabbtn-assistant "Scan" | 138 | 799 | 138 | 63 | 0px | 13.3333px/400 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) | gap: 4px |
| tab-btn#tabbtn-chats "Chats" | 276 | 799 | 138 | 63 | 0px | 13.3333px/400 | rgb(141, 141, 141) | rgba(0, 0, 0, 0) | gap: 4px |

**fab**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| scan-fab | 177 | 775 | 61 | 61 | 50% | 13.3333px/400 | rgb(255, 255, 255) | rgb(219, 39, 119) | shadow: rgba(236, 72, 153, 0.45) 0px 8px 24px 0p; border: 4px solid rgb(255, 255, 255) |

**labels**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| tab-label "Practice" | 47 | 836 | 45 | 13 | 0px | 10.4px/600 | rgb(141, 141, 141) | rgba(0, 0, 0, 0) |  |
| tab-label "Scan" | 194 | 838 | 27 | 13 | 0px | 10.4px/600 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) |  |
| tab-label "Chats" | 329 | 836 | 31 | 13 | 0px | 10.4px/600 | rgb(141, 141, 141) | rgba(0, 0, 0, 0) |  |


### Scan / Home (assistant tab)

**header**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| app-header.app-header--pad "Zelo " | 0 | 0 | 414 | 108 | 0px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | pad: 50px 22px 14px |
| app-header.app-header--pad "Zelo" | 0 | 0 | 414 | 108 | 0px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | pad: 50px 22px 14px |
| app-header.app-header--pad "Zelo" | 0 | 0 | 414 | 108 | 0px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | pad: 50px 22px 14px |
| app-header.app-header--pad "Zelo" | 0 | 34 | 414 | 74 | 0px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | pad: 16px 22px 14px |

*(corrected — the row above is the generic header CONTAINER; the actual "Zelo" brand wordmark is a
separate child that was missing from the first pass, likely the real cause of the "header text
needs to be bigger and pink" complaint — it already IS, just wasn't broken out before:)*

| Element | x | y | w | h | font | color | extra |
|---|---|---|---|---|---|---|---|
| `.profile-btn.profile-btn--avatar` | 22 | 50 | 44 | 44 | — | rgb(138,129,117) | circular avatar button, left side |
| `.scan-page-brand` "Zelo" | 60 | 52 | 294 | 41 | **33.6px/800** | **rgb(236,72,153)** (pink/accent) | the actual wordmark — big and pink already in source |
| `.scan-spark` (sparkle accent icon next to wordmark) | 235 | 54 | 18 | 18 | — | rgb(236,72,153) | inline SVG, same accent color |
| `.history-btn` | 354 | 50 | 44 | 44 | — | rgb(138,129,117) | circular button, right side (opens scan history) |

**streak pill**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| streak-pill#streak-pill "0" | 275 | 50 | 63 | 44 | 999px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 0px 12px 0px 6px; gap: 4px |
| streak-pill-icon | 281 | 57 | 30 | 30 | 0px |  | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | src: streak-pill-mascot.png |
| streak-pill-num#streak-pill-num "0" | 315 | 62 | 11 | 20 | 0px | 16px/800 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) |  |

**widget card (promo)**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| widget-card.widget-card--promo "Get the right words,effortle" | 22 | 126 | 370 | 170 | 34px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) |  |

**widget headline**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| scan-headline-text "Get the right words,effortle" | 22 | 144 | 370 | 152 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 0px 0px 0px 6px |
| scan-headline "Get the right words,effortle" | 28 | 144 | 364 | 67 | 0px | 28px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| scan-headline-accent "right" | 130 | 143 | 64 | 34 | 0px | 28px/800 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) |  |
| scan-headline-sub "Smart, natural replies for a" | 28 | 231 | 230 | 42 | 0px | 14px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| scan-headline-divider | 28 | 293 | 48 | 3 | 2px | 16px/400 | rgb(28, 25, 23) | rgb(236, 72, 153) |  |

**widget dots**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| widget-carousel-dot.active | 182 | 274 | 8 | 8 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgb(236, 72, 153) |  |
| widget-carousel-dot | 197 | 275 | 7 | 7 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgb(217, 217, 217) |  |
| widget-carousel-dot | 211 | 275 | 7 | 7 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgb(217, 217, 217) |  |
| widget-carousel-dot | 225 | 275 | 7 | 7 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgb(217, 217, 217) |  |

**input card**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| input-card.scan-message "Upload Screenshot " | 22 | 336 | 370 | 144 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |

**textarea**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| msg-textarea.scan-inline-textarea#asst-input | 22 | 336 | 370 | 84 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 16px 18px 14px |

**upload row**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| upload-row#upload-row "Upload Screenshot" | 36 | 437 | 143 | 26 | 8px | 13.3333px/400 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) | pad: 5px 2px; gap: 4px |

**generate button**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| asst-suggest-btn#asst-generate-btn "Get Suggestions" | 204 | 430 | 174 | 40 | 999px | 16px/600 | rgb(255, 255, 255) | rgba(0, 0, 0, 0) | shadow: rgba(236, 72, 153, 0.35) 0px 4px 14px 0p; pad: 10px 18px; gap: 6px |

**who section label**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| scan-who-head "Who's this about? " | 22 | 496 | 370 | 20 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | gap: 10px |

**who cards**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| scan-who-card#scan-who-dating "Dating" | 22 | 528 | 117 | 76 | 14px | 13.3333px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 10px 6px; gap: 6px |
| scan-who-card#scan-who-crush "Crush" | 149 | 528 | 117 | 76 | 14px | 13.3333px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 10px 6px; gap: 6px |
| scan-who-card.scan-who-card--tellzelo#tellzelo-card "Other " | 275 | 528 | 117 | 76 | 14px | 13.3333px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 10px 6px; gap: 6px |

**ai coach card**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| asst-coach-banner#aicoach-card "AI Coach Level" | 22 | 622 | 370 | 84 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 16px; gap: 12px |

**ai coach avatar**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| asst-coach-avatar | 38 | 636 | 56 | 56 | 50% | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**ai coach title**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| asst-coach-title "AI Coach" | 106 | 637 | 270 | 20 | 0px | 16px/700 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**ai coach sub**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| asst-coach-sub "Level up your conversations " | 106 | 659 | 270 | 34 | 0px | 13px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |

**Real total page height** *(resolves the "Scan screen reads as ~1.5 of 3 screen-units tall vs.
Capacitor's ~2.8 of 3" on-device report — measured directly instead of eyeballed):* the Scan tab's
scrollable content (header through the end of the AI Coach banner) is **690px tall**, fitting
inside an 896px-tall viewport with no scroll needed (`scrollHeight === clientHeight === 690`) — i.e.
content should fill **~77%** of the screen height, not ~50%. If Expo's version visually reads much
shorter than that, something in the vertical stack (header padding, widget-carousel margin, card
paddings) is compressed relative to the values already in this doc — cross-check against the
per-element `y` values above rather than guessing a global scale fix.

**Widget carousel vertical offset** (for the separate "carousel sits lower than Capacitor" report):
measured gap between the header's bottom edge (y=108) and the carousel's top edge (y=126) is
exactly **18px** — matches `.widget-carousel`'s `margin-top: 6px` plus `.scan-headline-row`'s own
internal `margin-top: 18px` reconciling against the header. If Expo's carousel sits lower, the gap
above it is bigger than 18px — check whatever margin/padding sits between its header and carousel.

### Practice (swipe deck)

**deck container** — found and verified via the real CSS source (not just a bounding-rect read),
since this is also the key to resolving the stack-card "contradiction" below:

| Element | x | y | w | h | extra |
|---|---|---|---|---|---|
| `#card-deck.card-deck` | 27 | 167 | 360 | 615 | `width: calc(100% - 44px); max-width: 360px;` — on this 414pt-wide screen, `100%-44=370`, so the `max-width:360` cap is what's actually active; centered horizontally (27px clear on each side, confirmed by the measured x), vertically it's a `flex:1` child so it fills whatever space is left above/below it in its column — not a fixed height by itself. |

**IMPORTANT — the "two different card boxes" issue:** `.swipe-card { position: absolute; inset:
0; }` — this means **all 3 stacked cards (`data-stack="0"/"1"/"2"`) share one identical,
untransformed box: exactly the deck container's own box above (27, 167, 360, 615).** There is no
second, independently-sized/positioned card box — that was a real ambiguity in how this was
presented before (two unlabeled rows read as contradictory), not a second real measurement. All
visible size/position/opacity differences between the 3 stacked cards come ENTIRELY from a CSS
`transform` + `opacity` applied per `data-stack` value — nothing else changes:

| `data-stack` | role | `transform` | `opacity` | `z-index` |
|---|---|---|---|---|
| `"0"` | front/interactive card | *(none)* | 1 | 3 |
| `"1"` | middle | `scale(0.95) translateY(10px)` | 0.75 | 2 |
| `"2"` | back | `scale(0.90) translateY(20px)` | 0.5 | 1 |

`transform-origin: 50% 110%` on all three (horizontally centered, but the vertical origin point
sits 10% of the card's height BELOW its own bottom edge — this is why scaling down also reads as
"sinking," not just shrinking in place). The two raw bounding-rect rows previously shown here
(`45,253,324,554` and `27,167,360,615`) were `getBoundingClientRect()` reads of stack `"2"` and
`"0"` respectively — real numbers, but presented without the transform math that actually produces
them, which is what read as a contradiction. Confirmed by direct math: `360 × scale(0.90) = 324` ✓,
and the x-shift `(360×(1−0.90))/2 = 18px` ✓ — both match the measured stack-`"2"` box exactly.

**Port to RN as:** one card component, absolutely positioned to exactly fill the deck container's
box (not three separately-sized boxes) — then apply `transform: [{ scale }, { translateY }]` +
`opacity` per the table above, driven by stack index. **RN gotcha:** `transform-origin` support
varies by RN version — if it's unavailable, the `50% 110%` vertical offset must be hand-computed
into the `translateY` value instead of relying on a non-default transform-origin (the math above —
origin point at `cardHeight × 1.10` below the untransformed top edge — is what to replicate).

**top card** *(the actual unscaled box — identical to "deck container" above, listed separately
here only for clarity; this is `data-stack="0"`)*

| Element | x | y | w | h | radius | color | bg | extra |
|---|---|---|---|---|---|---|---|---|
| `.swipe-card[data-stack="0"]` | 27 | 167 | 360 | 615 | 24px | rgb(28,25,23) | rgb(255,255,255) | `border: 1px solid rgb(236,229,218)`; `overflow: hidden` (this one legitimately clips — card content, e.g. the photo, is meant to be cropped to the rounded card shape) |

**card internals** *(real numbers below are all from the REAL, interactive card — `data-stack="0"`,
identifiable by having a real `id`, e.g. `#btn-skip`/`#btn-like`. The deck also renders 2 more full
copies of this same markup for the middle/back stack cards, holding the NEXT profiles in the queue
— those copies are non-interactive (`tabindex="-1" aria-hidden="true"`, no `id`) and every one of
their measured sizes is just these same numbers shrunk by the stack's own `scale()` — e.g. the skip
button measures 157×50 on the real card, 149×48 at `scale(0.95)`, 141×45 at `scale(0.90)` — not 3
different buttons. Build ONE card-internals component; the deck instantiates it 3× bound to 3
different profiles, with stack transform/opacity applied to the whole card as covered above —
nothing internal needs its own separate scaling logic.)*

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|---|
| `.swipe-card-photo` | 46 | 254 | 322 | 410 | — | — | — | `rgb(91,141,239)` | placeholder fill (real photo not wired up yet) |
| `.swipe-card-badge-pill` ("✦ Top Match") | 59 | 266 | 87 | 22 | 99px | 11.52px/700 | rgb(236,72,153) | rgba(255,255,255,.88) | icon/text specs in the "exact icon specs" section above |
| `.swipe-card-name` ("Tiara, 19") | 60 | 676 | 73 | 22 | — | 20px/800 | rgb(28,25,23) | — |  |
| `.swipe-card-occ` ("College") | 60 | 699 | 293 | 14 | — | 12.48px/500 | rgb(138,129,117) | — |  |
| `.swipe-card-info-btn` | 344 | 635 | 26 | 26 | 99px | — | rgb(236,72,153) | rgb(243,237,228) | glyph spec above |
| `#btn-skip.swipe-action-btn--skip` "Skip" | 44 | 715 | 157 | 50 | 20px | 14.88px/700 | rgb(239,68,68) | rgb(255,255,255) | `border: 1px solid rgba(239,68,68,.25)`; pad: 15px 10px; gap: 7px |
| `#btn-like.swipe-action-btn--like` "I'm Interested" | 213 | 715 | 157 | 50 | 20px | 14.88px/700 | rgb(255,255,255) | rgb(236,72,153) | `shadow: rgba(236,72,153,.25) 0 4px 16px 0`; `border: 1px solid rgb(236,72,153)`; pad: 15px 10px; gap: 7px |


### Practice tab — first-visit tutorial flow (added 2026-10-01 — previously NOT documented at all)

**This entire flow was missing from every spec file until now — a real gap on this side, not a
guess the Expo session invented out of nothing.** It's a real, asset-backed 6-step sequence (`#
practice-tutorial-welcome` → `#practice-confirm-profile` → `#practice-edit-details` → swipe-right
lesson → swipe-left lesson → photo-nav lesson, all in `index.html`/`script.js` around
`startPracticeTutorial()`), shown on first visit to the Practice tab. Every icon in it is a REAL
PNG asset in `assets/icons/onboarding/` — crop these per the standing rule, don't redraw them:
`tutorial-waving-hand.png`, `tutorial-swipe-right.png`, `tutorial-swipe-left.png`,
`tutorial-last-photo.png`, `tutorial-next-photo.png` (all confirmed to exist on disk).

**Welcome screen** (`#practice-tutorial-welcome`):

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| `.ptw-icon-wrap` | 112 | 252 | 190 | 190 | 50% | — | — | transparent | circular frame around the icon |
| `.ptw-icon` (`tutorial-waving-hand.png`) | 142 | 280 | 132 | 132 | — | — | — | — | the REAL image — not an emoji |
| `.ptw-title` "Let's get you ready!" | 73 | 470 | 267 | 33 | — | 27.2px/800 | rgb(28,25,23) | — | "ready!" is a `.ptw-accent` pink span |
| `.ptw-sub` | 77 | 511 | 259 | 19 | — | 15.2px/400 | rgb(138,129,117) | — |  |
| `.ptw-start-btn` "Start tutorial" | 37 | 558 | 340 | 52 | 20px | 16px/700 | rgb(255,255,255) | rgb(236,72,153) | `shadow: rgba(236,72,153,.3) 0 8px 22px 0` |
| `.ptw-skip-btn` "Skip" | 191 | 626 | 32 | 19 | — | 15.2px/700 | rgb(236,72,153) | transparent | plain text link, no border/bg |

**Confirm-profile screen** (`#practice-confirm-profile`, shown after the swipe-left lesson):

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| `.home-brand` "Zelo" (+ pink spark icon) | 175 | 24 | 63 | 24 | — | 24px/800 | rgb(236,72,153) | — | same `.scan-spark` pattern as the Scan header |
| `.ptw-title` "Let's confirm your profile" | 117 | 220 | 179 | 66 | — | 27.2px/800 | rgb(28,25,23) | — |  |
| `.ptw-sub` | 51 | 294 | 312 | 19 | — | 15.2px/400 | rgb(138,129,117) | — |  |
| `.cine-avatar` (real component reused from onboarding step 1) | 133 | 347 | 148 | 148 | 50% | — | rgb(185,176,162) | rgb(243,237,228) | `border: 5px solid rgb(251,217,232)` — identical to the onboarding avatar already spec'd |
| `.pcp-sparkle--1/2/3` (decorative dots around the avatar) | (119,341,20×20) / (288,415,13×13) / (257,481,16×16) | — | — | — | 50%-ish | — | `rgb(236,72,153)` | 3 small pink dots scattered around the avatar ring |
| `.pcp-name` "Oz" | 193 | 515 | 28 | 25 | — | 20.8px/800 | rgb(28,25,23) | — |  |
| `.pcp-meta` "25 • Attracted to Women" | 115 | 544 | 183 | 18 | — | 14.72px/400 | rgb(138,129,117) | — | "Women" portion is `.pcp-accent` pink |
| `.ptw-start-btn` "Continue" | 37 | 590 | 340 | 52 | 20px | 16px/700 | rgb(255,255,255) | rgb(236,72,153) | identical button style to the welcome screen's |
| `.ptw-skip-btn` "Edit details" | 166 | 658 | 82 | 19 | — | 15.2px/700 | rgb(236,72,153) | transparent | plain text link |

**Edit-details screen** (`#practice-edit-details`) — **this is where the Expo session's back
button was wrong: it's `.cine-back` (52×52, the SAME component as onboarding step 1's back
button), not the shared `.screen-header`'s 44×44 back-btn:**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| `.cine-back.ped-back-btn` | 18 | 20 | 52 | 52 | 50% | — | rgb(28,25,23) | rgb(255,255,255) | `shadow: rgba(28,25,23,.07) 0 2px 10px 0`; contains a 20×20 stroked chevron-left SVG, centered |
| `.home-brand` "Zelo" | 175 | 24 | 63 | 24 | — | 24px/800 | rgb(236,72,153) | — | same as confirm-profile |
| `.ptw-title` "Edit Details" | 131 | 179 | 152 | 33 | — | 27.2px/800 | rgb(28,25,23) | — |  |
| `.ptw-sub` | 52 | 220 | 310 | 19 | — | 15.2px/400 | rgb(138,129,117) | — |  |
| `.cine-avatar#ped-avatar` (tappable, has camera badge + delete button — same as onboarding) | 133 | 273 | 148 | 148 | 50% | — | rgb(185,176,162) | rgb(243,237,228) | identical to onboarding step 1's avatar |
| `.ped-rows` card (real `.settings2-card`, NOT a hand-built list) | 37 | 441 | 340 | 203 | 20px | — | rgb(28,25,23) | rgb(255,255,255) | `shadow: rgba(28,25,23,.06) 0 1px 6px 0` |
| `.settings2-row` × 3 (Name / Age / Attracted to) | 37 | 441 / 509 / 577 | 340 | 68 / 68 / 67 | — | 13.33px/400 | rgb(28,25,23) | — | pad: 14px 16px; gap: 12px; `›` chevron is plain text, not an icon — this one IS correct as Unicode |
| `.ptw-start-btn` "Save Changes" | 37 | 666 | 340 | 52 | 20px | 16px/700 | rgb(255,255,255) | rgb(236,72,153) | same button style |

**Swipe-right lesson** (dims the top card's photo, overlays a real hand-swipe image + text):

| Element | x | y | w | h | font | color | extra |
|---|---|---|---|---|---|---|---|
| `.ptw-swipe-overlay` | 28 | 168 | 358 | 453 | — | — | fills the top card's `.swipe-card-photo` exactly; `padding: 0 28px` |
| `.ptw-swipe-hand` (`tutorial-swipe-right.png`) | 175 | 308 | 64 | 64 | — | — | the REAL image, not an arrow icon |
| `.ptw-swipe-title` "Slide right to like" | 122 | 394 | 171 | 37 | 20.8px/800 | rgb(255,255,255) | `border-bottom: 2px solid rgb(236,72,153)` (underline accent) |
| `.ptw-swipe-sub` | 56 | 441 | 302 | 41 | 13.6px/400 | rgba(255,255,255,.9) | — |

**Swipe-left lesson** — identical overlay structure, mirrored hand image:

| Element | x | y | w | h | extra |
|---|---|---|---|---|---|
| `.ptw-swipe-hand.ptw-swipe-hand--left` (`tutorial-swipe-left.png`) | 184 | 317 | 46 | 46 | smaller than the right-swipe hand (46×46 vs 64×64) and horizontally flipped source image, not a CSS mirror of the same asset — confirmed real, separate source file |

**Photo-nav lesson** (tap left/right half of the photo to step through demo photos — **the real
app uses actual PNG icons here, NOT chevron glyphs of any kind, Unicode or SVG**):

| Element | x | y | w | h | bg | extra |
|---|---|---|---|---|---|---|
| `.ptw-photo-nav-overlay` | 28 | 168 | 358 | 453 | rgba(0,0,0,.3) | dim overlay over the whole photo |
| `.ptw-photo-divider` (vertical line splitting left/right tap zones) | 207 | 168 | 2 | 453 | — | `border-left: 2px solid rgba(255,255,255,.6)` |
| `.ptw-photo-zone--last` ("Last photo") | 83 | 361 | 68 | 68 | — | gap: 8px between icon and label |
| `.ptw-photo-zone--next` ("Next photo") | 261 | 361 | 70 | 68 | — | gap: 8px |
| `.ptw-photo-zone--last img` (`tutorial-last-photo.png`) | 95 | 361 | 44 | 44 | — | REAL image |
| `.ptw-photo-zone--next img` (`tutorial-next-photo.png`) | 274 | 361 | 44 | 44 | — | REAL image |

### Chat (practice conversation)

**header** *(corrected — real class is `.chat-back-bar`, not `.app-header`/`.chat-header`)*

| Element | x | y | w | h | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|
| `.chat-back-bar` "Zelo" | 0 | 38 | 414 | 69 | 16px/400 | rgb(28,25,23) | rgb(255,255,255) | `border-bottom: 1px solid rgb(236,229,218)`; pad: 12px 16px; gap: 10px |

**message bubbles** *(corrected — real classes are `.msg-row.user`/`.msg-row.ai`, not `.ai-bubble`/`.user-bubble`)*

| Element | x | y | w | h | font | color | extra |
|---|---|---|---|---|---|---|---|
| `.msg-row.ai` (AI message) | 16 | 300 | 382 | 78 | 16px/400 | rgb(28,25,23) | transparent row wrapper; bubble styling is on a nested `.msg-wrap` inside |

**composer bar**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| chat-input-bar | 0 | 787 | 414 | 75 | 0px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | border: 1px 0px 0px solid none none rgb(236, 229, 218) rgb(28, 25, 23) rgb(28, 25, 23); pad: 12px 14px 16px; gap: 9px |

**composer input**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| message-input#message-input | 65 | 800 | 284 | 46 | 22px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | border: 1px solid rgb(236, 229, 218); pad: 13px 18px |

**send button**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| send-btn#send-btn | 358 | 802 | 42 | 42 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**ai coach entry**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| aicoach-entry-btn#chat-aicoach-entry-btn | 14 | 802 | 42 | 42 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |


### Account / Settings dashboard

**profile card**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| dash-profile-card "O " | 20 | 129 | 374 | 92 | 20px | 13.3333px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 18px; gap: 14px |

**avatar**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| dash-avatar#dash-avatar "O" | 38 | 147 | 56 | 56 | 50% | 19.2px/800 | rgb(255, 255, 255) | rgba(0, 0, 0, 0) |  |

**stat tiles**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| dash-stat "12 Scans" | 20 | 243 | 119 | 67 | 14px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 8px; gap: 2px |
| dash-stat "0 Matches" | 147 | 243 | 119 | 67 | 14px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 8px; gap: 2px |
| dash-stat "0 Chats" | 275 | 243 | 119 | 67 | 14px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 8px; gap: 2px |

**section label**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-section-label "Zelo" | 20 | 449 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Account" | 20 | 632 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Privacy & Data" | 20 | 882 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Support" | 20 | 1065 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "About" | 20 | 1181 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Appearance" | 20 | 193 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Your style" | 20 | 441 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "What Zelo helps you with" | 20 | 823 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "You" | 20 | 172 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label#settings2-preview-tone-label "Zelo (Confident)" | 20 | 265 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "What you'd like to hear abou" | 20 | 366 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Current plan" | 20 | 417 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Your data" | 20 | 219 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Your privacy choices" | 20 | 518 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Legal" | 20 | 620 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Frequently asked questions" | 20 | 169 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |
| settings2-section-label "Need more help?" | 20 | 618 | 374 | 14 | 0px | 11.52px/700 | rgb(185, 176, 162) | rgba(0, 0, 0, 0) |  |

**settings card**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-card "PersonalizationChange how Ze" | 20 | 471 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Profile & loginManage your a" | 20 | 654 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Privacy & dataControl your d" | 20 | 904 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Help & SupportGet help and c" | 20 | 1087 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "About ZeloApp info, terms, a" | 20 | 1203 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-appearance-list "SystemMatch your phone's set" | 20 | 221 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-tone-list "FriendlyWarm and supportive " | 20 | 469 | 374 | 334 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-helpswith-list "Replying to messages " | 20 | 851 | 374 | 267 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Who you practice withWomen " | 20 | 213 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Age rangeAny ›" | 20 | 293 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Practice difficultyBalanced " | 20 | 373 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Conversation topicsAll " | 20 | 453 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Show skipped profilesReview " | 20 | 533 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-who-list "Women " | 20 | 166 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card.settings2-agefilter-card "Age range 18 –" | 20 | 166 | 374 | 203 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 16px |
| settings2-card#settings2-age-list "18–24 " | 20 | 383 | 374 | 211 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Push notifications " | 20 | 213 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Reply remindersGet reminded " | 20 | 394 | 374 | 267 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card.settings2-plan-card "Annual Plan THB " | 20 | 445 | 374 | 84 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 16px |
| settings2-card "Change Plan › " | 20 | 543 | 374 | 95 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#dev-subscription-row "DEV: simulate expired subscr" | 20 | 652 | 374 | 77 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Scan history retention30 day" | 20 | 247 | 374 | 251 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Do Not Sell or Share My Data" | 20 | 546 | 374 | 54 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Privacy Policy " | 20 | 648 | 374 | 91 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |

**settings row**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-row "PersonalizationChange how Ze" | 20 | 471 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Practice preferencesCustomiz" | 20 | 538 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Profile & loginManage your a" | 20 | 654 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "NotificationsManage what you" | 20 | 721 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Refer friendsGet rewards by " | 20 | 788 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Privacy & dataControl your d" | 20 | 904 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "AI & transparencyLearn how Z" | 20 | 971 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Help & SupportGet help and c" | 20 | 1087 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "About ZeloApp info, terms, a" | 20 | 1203 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Who you practice withWomen " | 20 | 213 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Age rangeAny ›" | 20 | 293 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Practice difficultyBalanced " | 20 | 373 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Conversation topicsAll " | 20 | 453 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Show skipped profilesReview " | 20 | 533 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--link "Change Plan ›" | 20 | 543 | 374 | 48 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--link "Restore Purchases " | 20 | 591 | 374 | 47 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Scan history retention30 day" | 20 | 247 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Download my dataExport your " | 20 | 310 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Help Zelo get smarterLet us " | 20 | 373 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--danger "Delete my accountPermanently" | 20 | 436 | 374 | 62 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Privacy Policy" | 20 | 648 | 374 | 46 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Terms of Service" | 20 | 694 | 374 | 45 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--noborder "How does Zelo work? " | 20 | 197 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--noborder "Are Practice characters real" | 20 | 264 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |

**row icon**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-icon | 36 | 485 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-personalization.png |
| settings2-icon | 36 | 552 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-practice-prefs.png |
| settings2-icon | 36 | 668 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-profile-login.png |
| settings2-icon | 36 | 735 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-notifications.png |
| settings2-icon | 36 | 802 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-refer-friends.png |
| settings2-icon | 36 | 918 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-privacy-data.png |
| settings2-icon | 36 | 985 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-ai-transparency.png |
| settings2-icon | 36 | 1101 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-help-support.png |
| settings2-icon | 36 | 1217 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings-icon-about-zelo.png |
| settings2-icon | 36 | 227 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-who-practice.png |
| settings2-icon | 36 | 307 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-age-range.png |
| settings2-icon | 36 | 387 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-difficulty.png |
| settings2-icon | 36 | 467 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-topics.png |
| settings2-icon | 36 | 547 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-skipped.png |
| settings2-icon | 36 | 211 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-howworks.png |
| settings2-icon | 36 | 278 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-characters.png |
| settings2-icon | 36 | 345 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-scanworks.png |
| settings2-icon | 36 | 412 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-trial.png |
| settings2-icon | 36 | 479 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-cancel.png |
| settings2-icon | 36 | 546 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-faq-delete.png |
| settings2-icon | 36 | 660 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-report.png |
| settings2-icon | 36 | 727 | 38 | 38 | 12px |  | rgb(28, 25, 23) | rgb(243, 237, 228) | src: settings2-icon-contact.png |

**chevron**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-chevron "›" | 371 | 348 | 7 | 19 | 0px | 19.2px/400 | rgba(255, 255, 255, 0.8) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 494 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 561 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 677 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 744 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 811 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 927 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 994 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 1110 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 1226 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 455 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 588 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 647 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 706 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 237 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 317 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 397 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 477 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 557 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 557 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 605 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 269 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 332 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-chevron "›" | 371 | 395 | 7 | 19 | 0px | 19.2px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |

**sign out button**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| btn2.btn2-primary.settings2-signout-btn "Sign Out" | 20 | 1299 | 374 | 51 | 14px | 15.36px/700 | rgb(255, 255, 255) | rgb(236, 72, 153) | shadow: rgba(236, 72, 153, 0.28) 0px 2px 8px 0px; pad: 16px |
| pl-signout-btn "Sign Out of All Devices" | 20 | 758 | 374 | 51 | 20px | 15.2px/700 | rgb(236, 72, 153) | rgba(0, 0, 0, 0) | border: 1px solid rgb(236, 72, 153); pad: 15px; gap: 8px |
| pl-signout-icon | 110 | 775 | 18 | 18 | 0px |  | rgb(236, 72, 153) | rgba(0, 0, 0, 0) | src: icon-pl-signout.png |


### Settings > Privacy & Data

**title**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-title "Practice Preferences" | 20 | 131 | 374 | 29 | 0px | 24px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-title "Notifications" | 20 | 131 | 374 | 29 | 0px | 24px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-title "Privacy & Data" | 20 | 131 | 374 | 29 | 0px | 24px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-title "Help Zelo get smarter" | 20 | 131 | 374 | 29 | 0px | 24px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-title.settings2-title--sm "How can we help?" | 20 | 127 | 374 | 22 | 0px | 18.4px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**lede**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-lede "Customize how Zelo talks to " | 20 | 127 | 374 | 42 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "See how Zelo responds with t" | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Tailor your practice experie" | 20 | 174 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Choose who you want to pract" | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Select the age range you wan" | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede.skipped-subtitle "Profiles you've skipped won'" | 20 | 112 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Choose what you want to hear" | 20 | 174 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Manage your data and privacy" | 20 | 174 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Choose how long Zelo keeps y" | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "We'll prepare a copy of your" | 32 | 234 | 350 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Let us review some of your p" | 20 | 174 | 374 | 42 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "This action cannot be undone" | 20 | 223 | 374 | 42 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Learn how Zelo uses AI to he" | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Send us a message and we'll " | 20 | 127 | 374 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Made with ❤️ for better conv" | 78 | 296 | 258 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Please read our Terms of Ser" | 64 | 223 | 287 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| settings2-lede "Your privacy is important to" | 104 | 223 | 207 | 21 | 0px | 14.08px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |

**card**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-card "PersonalizationChange how Ze" | 20 | 471 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Profile & loginManage your a" | 20 | 654 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Privacy & dataControl your d" | 20 | 904 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Help & SupportGet help and c" | 20 | 1087 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "About ZeloApp info, terms, a" | 20 | 1203 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-appearance-list "SystemMatch your phone's set" | 20 | 221 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-tone-list "FriendlyWarm and supportive " | 20 | 469 | 374 | 334 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-helpswith-list "Replying to messages " | 20 | 851 | 374 | 267 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Who you practice withWomen " | 20 | 213 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Age rangeAny ›" | 20 | 293 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Practice difficultyBalanced " | 20 | 373 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Conversation topicsAll " | 20 | 453 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Show skipped profilesReview " | 20 | 533 | 374 | 66 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#settings2-who-list "Women " | 20 | 166 | 374 | 200 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card.settings2-agefilter-card "Age range 18 –" | 20 | 166 | 374 | 203 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 16px |
| settings2-card#settings2-age-list "18–24 " | 20 | 383 | 374 | 211 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Push notifications " | 20 | 213 | 374 | 133 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Reply remindersGet reminded " | 20 | 394 | 374 | 267 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card.settings2-plan-card "Annual Plan THB " | 20 | 445 | 374 | 84 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px; pad: 14px 16px |
| settings2-card "Change Plan › " | 20 | 543 | 374 | 95 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card#dev-subscription-row "DEV: simulate expired subscr" | 20 | 652 | 374 | 77 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Scan history retention30 day" | 20 | 247 | 374 | 251 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Do Not Sell or Share My Data" | 20 | 546 | 374 | 54 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |
| settings2-card "Privacy Policy " | 20 | 648 | 374 | 91 | 20px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.06) 0px 1px 6px 0px |

**row**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-row "PersonalizationChange how Ze" | 20 | 471 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Practice preferencesCustomiz" | 20 | 538 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Profile & loginManage your a" | 20 | 654 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "NotificationsManage what you" | 20 | 721 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Refer friendsGet rewards by " | 20 | 788 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Privacy & dataControl your d" | 20 | 904 | 374 | 67 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "AI & transparencyLearn how Z" | 20 | 971 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Help & SupportGet help and c" | 20 | 1087 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "About ZeloApp info, terms, a" | 20 | 1203 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Who you practice withWomen " | 20 | 213 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Age rangeAny ›" | 20 | 293 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Practice difficultyBalanced " | 20 | 373 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Conversation topicsAll " | 20 | 453 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Show skipped profilesReview " | 20 | 533 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--link "Change Plan ›" | 20 | 543 | 374 | 48 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--link "Restore Purchases " | 20 | 591 | 374 | 47 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Scan history retention30 day" | 20 | 247 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Download my dataExport your " | 20 | 310 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Help Zelo get smarterLet us " | 20 | 373 | 374 | 63 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--danger "Delete my accountPermanently" | 20 | 436 | 374 | 62 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row "Privacy Policy" | 20 | 648 | 374 | 46 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-row "Terms of Service" | 20 | 694 | 374 | 45 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--noborder "How does Zelo work? " | 20 | 197 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-row.settings2-row--noborder "Are Practice characters real" | 20 | 264 | 374 | 66 | 0px | 13.3333px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |

**toggle row**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-toggle-row.settings2-agefilter-toggle-row "Show only people in this age" | 36 | 304 | 342 | 49 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | gap: 12px |
| settings2-toggle-row "Push notifications" | 20 | 213 | 374 | 67 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Email notifications" | 20 | 280 | 374 | 66 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Reply remindersGet reminded " | 20 | 394 | 374 | 67 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Practice updatesNew features" | 20 | 461 | 374 | 67 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Zelo tipsHelpful tips and ad" | 20 | 528 | 374 | 67 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Trial & subscription reminde" | 20 | 595 | 374 | 66 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-toggle-row "DEV: simulate expired subscr" | 20 | 652 | 374 | 77 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-toggle-row "Do Not Sell or Share My Data" | 20 | 546 | 374 | 54 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 16px; gap: 12px |
| settings2-toggle-row.hs-toggle-row "Help improve Zelo's AILet us" | 20 | 234 | 374 | 85 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | border: 0px 0px 1px none none solid rgb(28, 25, 23) rgb(28, 25, 23) rgb(236, 229, 218); pad: 14px 16px; gap: 12px |

**toggle switch**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-toggle | 334 | 316 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 233 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 300 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 414 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 481 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 548 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 615 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 678 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 560 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| settings2-toggle | 334 | 263 | 44 | 26 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |


### Onboarding — step 1 (name/photo/age)

**title**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| cine-title.locked-title "Keep going withZelo" | 73 | 100 | 268 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Let's get toknow you 👋" | 106 | 90 | 203 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Choose your sex" | 68 | 193 | 279 | 39 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Where did you hearabout Zelo" | 45 | 90 | 324 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Be honest." | 118 | 90 | 178 | 39 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "What would you likeZelo to h" | 40 | 90 | 335 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Who are youmost attracted to" | 55 | 90 | 304 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Let's make Zelosound like yo" | 76 | 90 | 262 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Enter referral code(optional" | 53 | 90 | 309 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Thanks fortrusting us!" | 111 | 300 | 192 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "See what you canachieve." | 61 | 298 | 292 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title.cine-title--plain "Stay on track with Zelo noti" | 37 | 310 | 340 | 65 | 0px | 28.8px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title.cine-title--plain "We're setting everything up " | 37 | 170 | 340 | 65 | 0px | 28.8px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "Your Zelo Planis ready." | 88 | 252 | 238 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title.cine-title--plain "Save your progress" | 76 | 216 | 261 | 32 | 0px | 28.8px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "We want you to tryZelo for f" | 52 | 90 | 311 | 79 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title "We'll send a reminderbefore " | 37 | 90 | 340 | 158 | 0px | 35.2px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |
| cine-title.cine-title--plain "Your one-time offer" | 76 | 273 | 263 | 32 | 0px | 28.8px/800 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**lede**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| cine-lede "This helps us personalize yo" | 37 | 181 | 340 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "This helps personalize your " | 45 | 245 | 325 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "This helps us improve and re" | 37 | 181 | 340 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "How often do you overthink a" | 37 | 141 | 340 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Pick any that apply" | 130 | 181 | 155 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "This helps Zelo personalize " | 37 | 181 | 340 | 75 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Which tone fits you best?" | 104 | 181 | 207 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Got a code? Enter it below t" | 37 | 181 | 340 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Now let's personalize Zelo f" | 60 | 391 | 293 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Better conversations.Real gr" | 80 | 389 | 255 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Built around your goals." | 110 | 343 | 193 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "Create an account to save yo" | 37 | 260 | 340 | 50 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |
| cine-lede "As long as notifications are" | 61 | 260 | 291 | 25 | 0px | 17.28px/400 | rgb(138, 129, 117) | rgba(0, 0, 0, 0) |  |

**photo circle** *(corrected — real class is `.cine-avatar`, not `.cine-photo-circle`/`[class*="photo-upload"]`; this was silently empty before)*

| Element | x | y | w | h | radius | color | bg | extra |
|---|---|---|---|---|---|---|---|---|
| `.cine-avatar-wrap` | 133 | 261 | 148 | 148 | — | — | transparent | outer positioning wrapper |
| `.cine-avatar#cine-avatar` (button) | 133 | 261 | 148 | 148 | 50% | rgb(185,176,162) | rgb(243,237,228) | `border: 5px solid rgb(251,217,232)` (pink ring); contains a 54×54 placeholder SVG (`.cine-avatar-ph`) until a photo is set, plus a separate camera-badge (`.cine-avatar-cam`) and delete button (`.cine-avatar-del`) |

**notification-permission mockup** *(step 11, `.cine-sysprompt` — a deliberately stylized preview
of iOS's native permission dialog, not a real system component. Addresses the "Notifications step
reads as a hand-built mockup" on-device report — it IS a mockup by design, but these are its real
dimensions/colors, which may be what's actually off):*

| Element | x | y | w | h | radius | font | color | bg |
|---|---|---|---|---|---|---|---|---|
| `.cine-sysprompt` (card) | 37 | 412 | 340 | 152 | 20px | — | rgb(28,25,23) | rgb(243,237,228) |
| `.cine-sysprompt-txt` | 57 | 434 | 300 | 43 | — | 16px/600 | rgb(28,25,23) | — |
| `.cine-sysprompt-btn` "Don't Allow" | 57 | 495 | 144 | 43 | 99px | 15.2px/400 | rgb(28,25,23) | rgb(235,227,215) |
| `.cine-sysprompt-btn--go` "Allow" | 213 | 495 | 144 | 43 | 99px | 15.2px/400 | rgb(28,25,23) | rgb(220,211,197) |

**skip button** *(the "X / skip to Scan" control — real class `.cine-showcase-skip`, only on the
first onboarding screen; addresses the "sits too high" on-device report with a real position)*

| Element | x | y | w | h | color | bg | extra |
|---|---|---|---|---|---|---|---|---|
| `.cine-showcase-skip` | 370 | 14 | 30 | 30 | rgba(28,25,23,.45) | rgba(28,25,23,.08) | top-right corner, 14px from the very top of the screen (above the safe-area content that starts lower on every other step) |

**name input**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| settings2-input#pl-display-name-input | 86 | 361 | 292 | 48 | 14px | 16px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | border: 1px solid rgb(236, 229, 218); pad: 13px 14px |
| cine-field-input#cine-name-input | 96 | 470 | 95 | 24 | 0px | 20.8px/700 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |

**continue button**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| cine-next#cine-next "Continue" | 24 | 817 | 366 | 59 | 18px | 17.92px/700 | rgb(255, 255, 255) | rgb(236, 72, 153) | shadow: rgba(236, 72, 153, 0.3) 0px 10px 26px 0p; pad: 19px 16px |

**progress bar**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| cine-progress-fill#cine-progress-fill | 86 | 58 | 19 | 6 | 99px | 16px/400 | rgb(28, 25, 23) | rgb(236, 72, 153) |  |
| milestones-progress-fill#milestones-badges-progress-fill | 229 | 269 | 148 | 6 | 3px | 16px/400 | rgb(28, 25, 23) | rgb(236, 72, 153) |  |

**back button**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| cine-back#cine-back | 20 | 35 | 52 | 52 | 50% | 13.3333px/400 | rgb(28, 25, 23) | rgb(255, 255, 255) | shadow: rgba(28, 25, 23, 0.07) 0px 2px 10px 0px |


### AI Coach (chat sheet)

*Opens as a partial-height sheet over the chat screen (see `.aicoach-sheet-open`), not a full
`.screen.active` push — this is why the original sweep found nothing here: it only checked
`state.character`/`state.activeChatId` being set, the generic screen-active selector never
matched. Corrected selectors below, confirmed working.*

**header** *(corrected — real structure is `#screen-ai-coach` → `.aicoach-main` → `.aicoach-header`, not `.aicoach-sheet`/`.aicoach-card`)*

| Element | x | y | w | h | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|
| `.aicoach-header` "AI Coach / Get advice..." | 0 | 116 | 414 | 68 | 16px/400 | rgb(28,25,23) | rgb(255,255,255) | pad: 16px 18px 12px; gap: 12px |

**brand icon / avatar** *(corrected — real class is `.aicoach-brand-icon-img`/`.aicoach-brand-icon-svg`, used in 3 different contexts/sizes)*

| Context | w | h | extra |
|---|---|---|---|
| Composer-adjacent large icon | 56 | 56 | `src: assets/icons/aicoach-topics/interest.png` |
| Header icon | 44 | 44 | same src, smaller crop |
| Per-message avatar (img fallback) | 34 | 34 | same src |
| Per-message avatar (inline SVG fallback, when image unavailable) | 14 | 17 | `.aicoach-brand-icon-svg`, 14.08px/700, pink `rgb(219,39,119)` |

**suggestion chips** *(corrected — real class is `.aicoach-quick-pill`, not `.aicoach-suggestion`/`[class*="aicoach-topic"]`)*

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| "Generate Reply" | 18 | 1054 | 156 | 40 | 999px | 13.6px/700 | rgb(219,39,119) | rgba(236,72,153,.1) | `border: 1px solid rgba(236,72,153,.35)`; pad: 11px 15px; gap: 7px |
| "Explain Message" | 184 | 1054 | 166 | 40 | 999px | 13.6px/700 | rgb(219,39,119) | rgba(236,72,153,.1) | same border/pad |
| "Rewrite Message" | 18 | 1104 | 168 | 40 | 999px | 13.6px/700 | rgb(219,39,119) | rgba(236,72,153,.1) | same border/pad; 2×2 wrapping grid, 50px row gap |
| "More Like This" | 196 | 1104 | 151 | 40 | 999px | 13.6px/700 | rgb(219,39,119) | rgba(236,72,153,.1) | same border/pad |

**status pill** — `#aicoach-status-pill` only renders conditionally (after a failed AI call); not
present on a fresh open, so it correctly measured 0 items both times. Not a bug — re-test by
forcing an error state if its geometry is needed.

**messages**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| aicoach-messages#aicoach-messages "Analyzing this conversation " | 0 | 184 | 414 | 513 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) | pad: 14px 18px 8px; gap: 12px |

**composer bar** *(corrected — was never measured; real class is `.aicoach-input-bar`)*

| Element | x | y | w | h | radius | bg | extra |
|---|---|---|---|---|---|---|---|
| `.aicoach-input-bar` | 18 | 761 | 378 | 58 | 18px | rgb(255,255,255) | `shadow: rgba(220,38,127,.06) 0 2px 12px 0`; pad: 8px 8px 8px 12px; gap: 10px |

**composer input**

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| aicoach-input#aicoach-input | 74 | 781 | 262 | 18 | 0px | 16px/400 | rgb(28, 25, 23) | rgba(0, 0, 0, 0) |  |


---

### Settings > Notifications *(9th screen — added to close a specific §14.1 on-device report: "reads as a hand-built mockup")*

| Element | x | y | w | h | radius | font | color | bg | extra |
|---|---|---|---|---|---|---|---|---|---|
| `.screen-header` | 0 | 36 | 414 | 73 | — | — | — | — | identical to every other sub-screen, see shared section above |
| `.settings2-title` "Notifications" | 20 | 131 | 374 | 29 | — | 24px/800 | rgb(28,25,23) | — |  |
| `.settings2-lede` | 20 | 174 | 374 | 21 | — | 14.08px/400 | rgb(138,129,117) | — |  |
| `.settings2-card` (push notifications) | 20 | 213 | 374 | 133 | 20px | — | rgb(28,25,23) | rgb(255,255,255) |  |
| `.settings2-section-label` "What you'd like to hear about" | 20 | 366 | 374 | 14 | — | 11.52px/700 | rgb(185,176,162) | — |  |
| `.settings2-card` (reply reminders + sub-toggles) | 20 | 394 | 374 | 267 | 20px | — | rgb(28,25,23) | rgb(255,255,255) |  |
| `.settings2-toggle` (×6 total across both cards) | 334 | 233/300/414/481/548/615 | 44 | 26 | — | — | — | — | same toggle component as everywhere else |

Nothing screen-specific here beyond standard `.settings2-*` components already cataloged in the
Privacy & Data section — if Expo's version "reads as a mockup," the components themselves are
likely hand-recreated instead of reusing the real shared `SettingsCard`/`SettingsRow`/`Toggle`
components other settings screens already got right.

## Dark mode — real color tokens *(closes the "dark mode not measured" gap; geometry is identical, only these swap)*

| Token | Light | Dark |
|---|---|---|
| `--bg` (page background) | `#ffffff` | `#15130f` |
| `--s1` (card surface) | `#ffffff` | `#201c17` |
| `--s2` (secondary surface) | `#f8f5f0`-ish | `#2a2520` |
| `--text` (primary text) | `#1c1917` | `#f3ede4` |
| `--text-2` (secondary/muted text) | `#8a8175` | `#a89e90` |
| `--border` (hairline border + the `::after` outline overlay's border color) | `#ece5da` | `#3a352d` |
| `--accent` (pink) | `#ec4899` | `#ec4899` (unchanged — accent never swaps) |

Confirmed structurally identical in dark mode (same x/y/w/h for `.screen-header`, `.widget-card`,
toggle track/knob) — only `background`/`color`/`border-color` swap. The grey touch-outline overlay
in dark mode is `1px solid #3a352d` (not `#ece5da`) at the same 0→0.4 opacity fade.

## Companion raw data

The full, un-truncated measurement output (every property captured for every element, including
ones summarized above) is saved alongside this file as **`EXPO_SIZES_DATA.json`** — same repo root.
If a value is needed that isn't in one of the tables above (a property got cut for table width, or
an element beyond the first 24 per group), it's in that file verbatim. The follow-up audit pass
(screen headers, the widget-card pseudo-element, and every corrected selector) is in that same file
under the `followUpAudit` key.

## What this file does NOT cover yet

- Only 8 of ~44 screens have per-element measurements (see §3 of `EXPO_MIGRATION_SPEC.md` for the
  full screen inventory), though the shared components that repeat across most of the other 36
  (`.screen-header`, `.settings2-card`/`.settings2-row`/`.btn2-*`, the toggle/checkmark pseudo-
  elements, the toast banner) are now captured in the dedicated sections above, not just buried
  per-screen. Anything truly screen-specific on an unmeasured screen (a unique hero image, a custom
  one-off layout) is still not captured until that screen is explicitly measured.
- ~~Dark mode was NOT separately measured~~ — fixed: see the "Dark mode — real color tokens"
  section above. Confirmed geometry-identical; only the 6 color tokens there swap.
- Animation timing/easing is in `EXPO_MIGRATION_SPEC.md` §8, not here (that's motion, not static
  geometry).
- **Fixed in this pass** (previously silently missing, found via a systematic audit after being
  caught twice): the `.screen-header` shared bar, the `.widget-card::after` grey-outline mechanism
  and ~10 other `::before`/`::after` pseudo-element overlays (toggle knob, swipe-card back-stack
  mask, gradient fades, checkmark glyphs, etc. — see "Pseudo-element overlays" section above), the
  Chat screen's header/bubbles, the Practice deck's photo/name-row, the Onboarding photo circle,
  and the entire AI Coach sheet's header/avatar/suggestion-chips/composer (the original sweep
  scored zero elements on all of these because of wrong guessed selectors, not because the
  elements don't exist). The audit method: (1) list every `(screen, label)` pair that returned zero
  elements in the first pass and grep the real markup for each instead of re-guessing, (2) grep the
  full stylesheet for every `::before`/`::after` rule with real visual properties, since those are
  structurally invisible to plain `querySelectorAll`-based measurement. Both were run to completion
  — this is why this section can be trusted as actually re-checked, not just re-asserted.
