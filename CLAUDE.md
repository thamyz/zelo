# Working notes for Claude Code on this project

Read this before touching UI/UX/animation/gesture code in Zelo. It exists because
the same categories of bug have burned multiple rounds of back-and-forth more than
once — this is where the lessons go so they don't get re-learned from scratch in a
new chat. **Update this file yourself** whenever a UI/UX bug takes more than one
real attempt to fix: add a short entry to the Case Log below (symptom → wrong
turn(s) → actual root cause → fix → generalizable lesson). Keep entries short —
a few sentences each, not an essay. Prune/merge if it gets too long to skim.

## Recurring mistakes, Sep 20–21 (read this section first, every session)

The same handful of mistakes repeated multiple times across two days of
work on this screen set, several of them AFTER already being written down
once below — meaning the case-log-after-the-fact format wasn't enough on
its own. These are the same lessons restated as before-you-act checks
instead of after-the-fact stories, specifically because "write it down
once" already failed to stop the repeat.

1. **Before drawing/coding any icon by hand (SVG, inline shape, emoji) —
   stop and `ls`/`find` the relevant `assets/icons/**` folder first, every
   time, even if a similar spot earlier in the same conversation was already
   handled correctly.** I repeated this exact mistake three separate times
   in two days (setup-list icons, Plan-screen focus/adapt icons, Chats-empty
   CTA icon) despite it already being a standing rule below. A user can drop
   a new reference file into an existing folder mid-conversation without
   announcing it — "I already checked this folder" from an earlier turn is
   not good enough.

2. **Before changing any color/spacing described as "too dark/light/small,"
   confirm which theme and which literal pixels the user is looking at —
   don't infer it from unrelated context** (a status-bar clock icon, an
   older screenshot from earlier in the conversation, "it looked right in my
   own test"). Screenshot both themes and compare actual rendered RGB values
   against the complaint before picking which one to touch. Guessing wrong
   here burned two full rounds fixing a theme the user wasn't even looking
   at, with nothing visibly changing on their end either time.

3. **Before calling anything "matches the reference," actually measure the
   reference file** — crop the exact region, scan pixel rows for text
   bounds, sample RGB values — rather than eyeballing a side-by-side
   screenshot. Every round that came back with "still isn't right" was a
   round where a size, color, or spacing value got approximated by eye
   instead of measured from the source file. Measuring first is faster than
   three rounds of guess → ship → get corrected.

4. **Don't add anything that wasn't asked for** — a drop shadow, a resized
   hero image, a swapped-in "nicer" icon, extra polish. Build exactly the
   request; if something looks like it's missing a finishing touch, say so
   and ask, don't just add it. Every unrequested addition this session (the
   Plan-screen hero shrunk to dodge scrolling, a CSS shadow under the
   Chats-empty icon) had to be explicitly undone by the user afterward.

5. **When the user names the same screen/component again after a "fix,"
   assume the fix was incomplete — re-open the reference file and re-diff
   the WHOLE component, not just the one detail they happened to mention
   this time.** Several "still not right" follow-ups here would have been
   one round instead of two or three if the first pass had done a full
   side-by-side comparison instead of reacting only to the literal words of
   the request.

## Standing rules (see also the user's memory, which overrides nothing here)

- Never commit or push to git automatically — the user reviews and commits themselves.
- **Status wording: every progress message says explicitly "Not done yet"
  (then what's still pending/running) or "Done".** Never leave it ambiguous
  whether a task is finished — long simulator builds and `npx cap copy ios`
  runs on this drive take 10–20+ minutes, so "still waiting on a background
  job" is the normal state and must be stated as such. "Done" only once the
  change is built, verified, synced (byte-identical against `www/` and
  `ios/App/App/public/`), and the new `BUILD_STAMP` value has been reported.
  Never question whether the user rebuilt/tested correctly, and don't write a
  "user was on a stale build"-style explanation into this file.
- **When the user hands you a reference screenshot/mockup file (dropped into
  `assets/icons/**`, referenced by name like "New ver onb N"), crop the actual
  icons out of THAT file pixel-for-pixel — that takes priority over reusing an
  existing SVG/asset elsewhere in the app, even one that looks conceptually
  close.** Only fall back to reusing an existing unrelated asset when no
  reference file was actually given for that spot. Getting this precedence
  backwards (drawing/reusing something "close enough" instead of cropping the
  file the user actually pointed at) is a real, repeated mistake here — see
  the Case Log. Never redraw/recreate a reference as a hand-drawn mockup either
  way.
- **If you're not sure which existing asset to use, or which folder/file the
  user means, ASK — do not guess and proceed.** Blindly picking one has
  already burned multiple rounds in this project (see Case Log). This
  overrides the general "act autonomously" instinct specifically for asset/
  folder identity — the cost of a wrong guess here (re-cropping, re-syncing,
  re-verifying) is much higher than the cost of one clarifying question.
- Every change: bump `style.css?v=`/`script.js?v=` in `index.html` AND `BUILD_STAMP`
  in `script.js`, then sync and `diff -q` against both `www/` and
  `ios/App/App/public/` to confirm byte-identical.
- **DO NOT run `npx cap copy ios` for a web-only change.** It deletes and rewrites
  the whole `public/` folder (~470 files, ~55s) and, on this exFAT drive, creates
  hundreds of `._*` AppleDouble files as it goes — which is what makes Xcode fail
  with `copy(... /public/assets/...)` or "no such file" on a file that is plainly
  there. A build landing anywhere in that window breaks. Instead copy the changed
  files straight into both trees:
  ```
  for f in script.js index.html style.css personas.js; do
    cp "$f" "www/$f"; cp "$f" "ios/App/App/public/$f"
  done
  find . -name '._*' -not -path './node_modules/*' -delete     # ALWAYS, same step
  ```
  That is what `cap copy` would have done for those files, minus the wipe — it is
  sub-second and cannot race a build.
- **`._*` files cannot be prevented on this drive — only purged.** Tested: both
  `COPYFILE_DISABLE=1 cp` and a plain `cat > dest` still produce one AppleDouble
  stub per file written, because the volume materialises them for any new file,
  not because the source has extended attributes (it has none). So the purge is
  not optional cleanup, it is part of writing a file here.
- **Verify by FILE COUNT, not only `diff -q`.** `www` and `ios/App/App/public`
  must differ by exactly 2 (Capacitor's empty `cordova.js`/`cordova_plugins.js`).
  Every byte-level diff passed while 460 junk files sat in the bundle and broke
  the build — the files being diffed were genuinely fine.
- `npx cap copy ios` / `cap sync ios` are **only** for asset, config or native-plugin
  changes. After either, always `find . www ios -name '._*' -delete` and check the
  file counts match (`www` and `public` differ by exactly 2: Capacitor's empty
  `cordova.js`/`cordova_plugins.js`). A count like 931 vs 471 means the AppleDouble
  junk is still there and the next build will fail.
- Verify behavior via Playwright before declaring anything done — see below for
  which engine to use and how to actually reproduce the reported symptom.
- When the user pushes back ("still broken", "wrong thing"), re-diagnose from
  scratch instead of assuming the same fix just needs tuning. Several of the cases
  below only got found on the second or third real attempt.

## Debugging methodology for UI/UX bugs specifically

- **Use real WebKit for scroll/touch/keyboard bugs, not just Chromium.** Chromium
  silently fails to reproduce several WebKit-only quirks (see Case Log). If
  `playwright.webkit` isn't installed, `npx playwright install webkit` works and is
  worth the ~80MB download before spending time debugging in the wrong engine.
  - `new Touch(...)` throws `Illegal constructor` in this WebKit build — use
    `document.createTouch(window, target, id, x, y, x, y)` +
    `document.createTouchList(t)` + `new TouchEvent(type, {touches: tl, ...})` instead.
- **Reproduce the actual reported gesture, not an approximation.** "Swipe fast" is
  not "drag slowly across many small steps" — simulate it as touchstart followed
  immediately by one large touchmove jump and immediate touchend, with no artificial
  waits in between. A test that adds `waitForTimeout` between steps can hide exactly
  the bug being investigated (see the fast-flick case below).
- **A CSS-visible "instant"/"frozen"/"stiff" symptom almost always has one of these
  causes** — check them in this order before assuming it's a tuning/easing problem:
  1. Something already set `transition: none` (often for 1:1 drag-follow) and never
     re-armed a real transition before handing off to a later step.
  2. A `transitionend`/`animationend` listener isn't filtering `e.target`/
     `e.propertyName`, and a shorter transition on a *descendant* element bubbled up
     and satisfied it early (these events bubble).
  3. The animation's start value and end value were computed independently, and for
     a fast/extreme input the "start" already equals (or is past) the "end" before
     the animation code even runs — so there's nothing left to visibly interpolate.
  4. The transition-enable and the value-change landed in the same paint (classic
     "set transition, then immediately set the new value" without a forced reflow
     in between) — fix with `void el.offsetWidth;` between the two.
- **A CSS property assignment can silently animate.** If an element (or an ancestor)
  has `scroll-behavior: smooth`, a plain `el.scrollTop = x` assignment is *itself*
  transition-affected — reading it back immediately can show a stale value, and
  "restoring" a scroll position this way can visibly animate when you wanted an
  instant snap. Force `el.style.scrollBehavior = 'auto'` first if the write needs
  to be instant.
- When a fix is meant to be **instant** (no visible motion), the standard pattern in
  this codebase is: `el.style.transition = 'none'`, make the state change, force a
  reflow (`void el.offsetHeight`), then `requestAnimationFrame(() => { el.style.transition = ''; })`
  to re-arm normal transitions for next time. Don't skip the reflow — without it the
  transition can still apply to the very change you just made.

## Case Log (append new entries at the bottom, newest last)

**Swipe-back reveal reset scroll to top (AI Coach / Chat).** Symptom: swiping back
to close a screen with messages loaded made it look like the screen "jumped." First
two attempts wrongly blamed the keyboard-avoidance nudge (a real, separate mechanism
that WAS buggy but wasn't THIS bug). Actual cause: the swipe-back reveal reparents
the screen into a shared drag track (`_slideMountEl`), and — confirmed only by
actually running WebKit, not Chromium — changing the screen's `position` from
`absolute` to `relative` (a step *before* the reparent itself) resets `scrollTop` to
0 on any nested `overflow-y:auto` descendant. Invisible with an empty message list,
obvious with a real one. Fixed by capturing `scrollTop` before any style mutation
and restoring it (via `scrollBehavior:'auto'` first, see above) right after. Lesson:
when a "screen moves" bug only shows up with real content, suspect scroll-position
loss during a reparent/position-change, not a transform/animation bug.

**AI Coach chat-sheet swipe-down felt stiff ("stops, then goes down").** The drag
handler set `transition:none` to follow the finger with zero lag (correct), but on
release (past the close threshold) it called the close function directly — which
only removes CSS classes and waits 320ms before actually changing anything. With
`transition:none` still applied and no new transform target set, the sheet visually
froze at the release point for the full 320ms, then snapped shut instantly. Fixed by
explicitly setting a fresh transition + a real closed-position target *before*
handing off to the close function, so release reads as one continuous motion instead
of two disconnected ones. Lesson: when a JS drag hands off to a deferred/class-based
close animation, always bridge the gap explicitly — never assume the deferred step
will pick up smoothly from wherever the drag left off.

**Card-deck fast swipe looked instant / had no visible fly-off animation.** Two
separate bugs stacked here, found in the same investigation:
1. The live drag followed the raw finger delta 1:1 (well, at a fixed 0.8x), so a
   fast/long real flick could already carry the card visually past its fly-off
   target before the committed fly-off animation even started — nothing left to
   see. Fixed with the same exponential-smoothing drag-follow already used (and
   proven) for the onboarding demo card: the visible *position* lags behind the raw
   delta via a per-frame lerp, capping visible speed regardless of input speed,
   while rotation/stamp-fade stay tied to the raw delta so the threshold still feels
   immediate. Slow drags are barely affected (~5% change); fast ones are
   meaningfully held back.
2. Independently, the fly-off's `transitionend` listener didn't filter
   `e.propertyName`/`e.target`, and the LIKE/NOPE stamp's own much-shorter (0.05s)
   opacity transition — fired by the same last touchmove — bubbled up and satisfied
   it early, cutting a 0.7s animation down to ~50ms and jumping straight to the next
   screen. This is bug type #2 from the methodology list above; would have hit any
   generic `{once:true}` transitionend listener on this element regardless of the
   smoothing fix. Both had to be fixed for the animation to actually play out fully
   — fixing only one would have looked like a partial improvement at best.

**Match/reveal screen felt instant on a fast action.** Not really a bug in the
"screen show" call itself — `pushScreen()`'s plain 0.18s opacity fade is the same
for every screen and was never the problem. The real issue was upstream (the
fly-off animation feeding into it wasn't visible — see above); once that's fixed,
whatever screen comes next automatically gets a fair, visible run-up. Where a richer
entrance was independently wanted (not required by a bug, just liked), a staggered
CSS-keyframe reveal on the destination screen's own content (heading → avatars →
accent element → buttons, each on a delay) reads as much more deliberate than
relying on the generic screen-fade, and is cheap to add without touching the shared
`pushScreen()` transition every other screen depends on.

**"When were you born?" title/wheel text stayed black in dark mode.** This
screen is a real native iOS `UIDatePicker` (`@capgo/capacitor-date-picker`), not
web CSS, so dark mode has to be threaded through explicitly on every present()
call — assuming it "just inherits" from the page is wrong for anything native.
The JS already passed `titleFontColor` (correctly resolved from `--text`), which
is why the header text looked fine, but the actual scrolling wheel text stayed
black regardless of theme. Root cause, found by reading the plugin's Swift
source directly (`node_modules/@capgo/capacitor-date-picker/ios/.../DatePicker.swift`):
(1) the wheel's own text color only gets set from a *different* option,
`fontColor` (not `titleFontColor`) — never passed, so never applied; (2) native
dark chrome (`picker.overrideUserInterfaceStyle`) is driven by a `theme` option
that also was never passed, defaulting to light. Fixed by adding both
`theme: isDarkModeActive() ? 'dark' : 'light'` and `fontColor: _cineThemeColor('--text', ...)`
alongside the existing `titleFontColor`. Lesson: a native plugin call "looking
right" for one visible piece of text doesn't mean the whole dialog is
theme-wired — check every text-color-bearing option the plugin actually exposes
by reading its native source, not just the JS wrapper's types/examples.

**Cropping a new icon from a light/dark reference image punched holes in dark
mode.** Given a designer's side-by-side mockup (pink icon on white | same icon
glowing on black), the obvious approach — alpha-key each half independently
against its own corner background color — silently breaks whenever the artwork
has a BLACK design element (eyes, outline, shadow) sitting on the dark half's
near-black canvas: that glyph is color-indistinguishable from the background at
that spot, so independent keying punches a transparent hole straight through it
(invisible against a white preview background, but shows as a real hole once
composited over anything else). The soft glow bleeding into black also picked
up ugly semi-transparent banding under simple distance thresholding. Fix: since
both halves are the same artwork at the same coordinates, derive the alpha mask
ONCE from the light half only (full, unambiguous contrast against flat white),
then build the dark output from the dark half's own RGB colors under that
*borrowed* alpha instead of re-deriving alpha independently. No holes, no
banding, and the dark version still keeps its own richer glow-lit coloring.
**Reused the light crop for "-dark" hero icons because their card was
hardcoded white in both themes — wrong call, user pushed back.** Found that
`.cine-hero-img` (the card behind the Thanks/Achieve/Plan/Cloud/Bell onboarding
hero icons) had `background:#ffffff` with no dark-mode branch, so — reasoning
"the backdrop never changes, so there's nothing for the icon to adapt to" — I
shipped the *light* crop for both the regular and `-dark` files. Technically
consistent with the card as it existed, but wrong: the user's actual ask was
for dark mode to look different/better, and reusing the light asset made dark
mode indistinguishable from light regardless of how "correct" that felt given
the surrounding CSS. The real fix was two-sided and either half alone would
have kept failing: (1) make `.cine-hero-img`'s background theme-aware
(`var(--s1)`, the same card-surface token `.cine-note-card`/`.cine-plan-card`
already use on these exact screens) instead of hardcoded white, AND (2) use
the actually-different glowing dark crop (see the borrowed-alpha technique
above) now that there's a dark backdrop worth adapting to. Lesson: when a
"why would this even need to differ" reasoning is based on current CSS you
also have the power to change, don't let it talk you out of the thing the
user explicitly asked for — question whether the CSS itself is the bug before
concluding the asset doesn't need to change. Re-verified after the fix that
the *other* icons sharing that same card (`onb-plan.png`, `onb-cloud.png`,
`onb-bell.png` — none of which got new crops) still looked clean against the
now-dark card before considering the shared CSS change safe.

**Same icon crop looked badly off-center once actually installed (on-device
screenshot, not my own preview).** The bounding-box + alpha-falloff crop
script used one threshold (distance-18-from-background) for both jobs. Real
device screenshots showed the icon crammed into one corner of its card with a
huge dead zone opposite it; my own Playwright preview during development had
looked fine. Debugged by sweeping the threshold and printing the resulting
bbox at each value: at 18 the box was 738x693 (near the full half-canvas);
at 40+ it snapped down to a sane 578x432. Root cause: the source PNG has an
almost-imperceptible vignette/gradient extending nearly to the canvas edges —
invisible to the eye, but its color distance from the background clears a
lenient threshold across nearly the whole canvas, so the "tight" bounding box
was actually including a vast near-empty margin, badly skewing where the
real content sat inside its own crop. Fixed by splitting the two jobs: a
firm, separate BBOX_THRESH (45) just to find the crop rectangle, while
keeping the original soft TOL_LO/TOL_HI range for the actual per-pixel alpha
(so visible edges still antialias smoothly). Lesson: don't trust "looks
right in my own dev preview" for a crop — reproduce the exact reported
symptom (a real device screenshot in this case) and, when a crop looks
oddly off-balance, sweep the alpha threshold and print the bbox at each
value rather than eyeballing the mask once at one setting; a threshold that
looks reasonable on a clean reference image can still pick up near-invisible
artifacts that only reveal themselves as a badly asymmetric crop.

**"Borrow alpha from the light half" (the previous fix) still wasn't right —
it couldn't reproduce the reference's actual glow.** That technique took the
icon's silhouette-only alpha from the light half (no glow at all there) and
just recolored it with the dark half's pixels — so the dark output was "the
icon in a different color," never an actual glowing bloom radiating past the
icon's own edge like the reference clearly has. Confirms: composite a crop
onto the ACTUAL target background (a plain black/dark test page, not the
Read tool's own white-canvas preview) before judging it — a real glow
halo looks like an ugly grey/black smudge on white and can be wrongly
"fixed away" by someone assuming that smudge is the bug. The real fix was a
flood-fill from the canvas border through background-colored pixels: pixels
the fill *reaches* are confirmed background (get a smooth distance-based
alpha, rendering the glow's own falloff); pixels it can't reach (enclosed
inside the icon, e.g. a black eye/mouth glyph sitting inside a pink bubble —
color-identical to a black canvas but never connected to the border without
crossing solid pink) stay fully opaque regardless of their own color. This
fixes the punched-eye-hole bug and renders a real glow in one pass, no
borrowing needed. Two real bugs surfaced getting there, both worth knowing
for next time: (1) the flood-fill's own connectivity threshold has to be
tuned separately from how "far the icon's color is from background" —
assumed a vivid dark-mode icon would always be far enough from black to
need a very generous threshold (130), but the LIGHT half's icon is a pale
pastel only ~40-45 units from off-white, so a permissive threshold let the
fill tunnel straight through the entire bubble as if it were background
(confirmed by literally rendering the reachable/unreachable mask as an
image — do this immediately when a flood-fill result looks wrong, don't
guess at the threshold blind). (2) the crop's bounding box must be based on
*flood-fill-unreachable pixels specifically*, not "wherever the final alpha
ends up above some cutoff" — a confirmed-background pixel still gets real,
visible partial alpha from the glow falloff, and that soft gradient reaches
exactly as far as the earlier faint-vignette bug did, so bbox-by-alpha
silently reintroduces the same huge-dead-zone bug this was supposed to fix.

**Added a hero icon to the "setting everything up" screen that the user
never asked for.** Read "the icon still isn't here" (about that screen) as
"add a hero image like the other onboarding screens have" — actually meant
the *list row* icons weren't visibly updated yet on the build being tested.
Wasted a full round: added `onb-plan.png` as a hero image, had to retune
five other CSS values to keep the 5-row list from overflowing the viewport,
then reverted all of it next round. Lesson: "the icon isn't here" describing
a screen that already has SOME icons (the 5 list rows) is ambiguous between
"add a new icon" and "the icons I already asked about aren't showing" — when
a fix could mean adding a new element vs. one already in flight not having
landed yet, ask which, don't build the bigger/riskier interpretation.

**Hand-drew SVG replacements for the setup-list icons instead of cropping
the reference screenshot the user had already provided for exactly that
screen ("New ver onb 3.png").** The project's own standing rule already said
to crop real reference images and only fall back to reusing an existing
asset — but reused/hand-drew anyway, including inventing a bar-chart icon
for "Fine-tuning suggestions" that turned out to be *wrong for light mode*:
the reference's light half actually shows two sparkles for that row, and
ONLY the dark half shows a bar chart — a genuine, deliberate light/dark
content difference in the source art, not just a recolor. Fixed by cropping
all 5 tiles directly out of the reference (light and dark independently, so
asymmetric rows like this one are captured correctly) as real `onb-setup-*.png`
assets wired through the existing dark-variant swap mechanism, replacing the
hand-coded SVGs entirely. Lesson (see the new standing rule above): when the
user has already dropped a reference file in for a specific screen, crop
that file — don't substitute "an existing icon that looks about right,"
even when it happens to look reasonable, because it can be silently wrong
in ways a visual approximation won't reveal (like a light/dark content
difference you'd never guess without looking at the actual source).

**Those same 5 cropped setup-list tiles were visibly off-center once
installed** (icon crammed toward one corner of its rounded-square tile,
different per row). Root cause, found by measuring one output file's actual
margins programmatically (find the tile's bbox by color-distance from a
corner pixel, print left/right/top/bottom margins) rather than eyeballing:
7px left vs 20px right, 16px top vs 4px bottom — the hand-picked per-row
crop rectangles (guessed from a grid-overlay screenshot) just weren't
centered on the tile they were supposed to contain. Two hand-tuning passes
trying to nudge the guessed coordinates still drifted (later rows'
guessed Y positions accumulated error). Fixed properly on the third attempt
by removing hand-estimated coordinates entirely: scan a thin vertical strip
known to sit inside every tile for contiguous runs of "differs from the
CARD's own background" — not the page's background, which is a different
shade and wrongly flagged the gaps *between* tiles as content too, merging
all 5 rows into one giant run on the first attempt — giving each tile's Y
bounds directly from the pixels; then independently find that tile's tight
X bounds within its own run. Crop = detected bbox + EQUAL padding on all
four sides, so centering is structural, not estimated. Lesson: for
"crop this out of a bigger reference image" tasks, don't hand-pick pixel
rectangles from a grid screenshot even after they look plausible — measure
the actual output's margins (or better, detect the target's true bounds
from color/content directly) before trusting a crop is centered. Also: when
sampling "background" to distinguish it from content, sample from the
right *local* background — a page corner and a card surface are not always
close enough in color for one to safely stand in for the other.

**Adding a fly-in entrance animation to `.cine-trial-phone-wrap` (Step 15,
new ver — see the earlier hero-icon entries) broke the video inside it —
reported as "starts at the end of the video and now it pauses, not
playing."** The wrapper's animation starts it at `opacity:0` scaled to 70%
before settling; the `<video autoplay loop muted playsinline>` inside
apparently got paused by the browser while its container was in that
invisible/shrunk state, and with nothing to ever call `.play()` again, it
just sat there — `loop` can't restart a video that was never actually
granted a play. Fixed with a plain step-entrance hook (the same
`CINE_STEPS[n].entrance` mechanism already used elsewhere) that resets
`currentTime = 0` and explicitly calls `.play()` (swallowing the promise
rejection, harmless since it's muted+playsinline and always allowed) every
time that step becomes active. Lesson: a CSS entrance animation that starts
an element at `opacity:0`/heavily transformed can silently interfere with
autoplaying media inside it — if a screen has both, don't assume `autoplay`
alone survives the animation; verify by checking `video.paused` after the
entrance, and if in doubt, explicitly (re)trigger playback once the step
becomes active rather than trusting the attribute.

**The setup-list tiles cropped from the reference screenshot (previous
entry) were still off-center once installed — "moved to the right."**
Confirmed the TILE's own rounded-square background WAS correctly centered
in the crop (measured its bbox: ~centered to within 1px). The actual bug:
the icon glyph drawn inside that tile in the source reference isn't itself
centered within the tile — confirmed by isolating just the glyph (a much
higher color-distance threshold than the tile-vs-card one, since the glyph
is far more saturated than the tile's pale background) and comparing its
own center to the tile's: consistently offset ~16-17px out of a ~145px-wide
tile, the same direction and magnitude on literally every one of the 5
icons in both themes. Fixed by cropping centered on the GLYPH's own bbox
center instead of the tile's edges (fixed half-size around it, generous
enough the full tile still fits). Lesson: "center the crop on the thing's
own edges" and "the visible content ends up centered once rendered" are NOT
the same claim — a container can be perfectly centered in its crop while
whatever's drawn inside that container is itself off-center in the source
art. When centering is the actual complaint, measure/detect the CONTENT
people are looking at (the glyph), not the nearest containing shape (the
tile) — they can differ, and by this scale of offset, it's very visible
once scaled down to a small icon size even if it looked minor at full
resolution.

**A hand-drawn "Women" venus-symbol icon (♀) looked visually
higher/off-balance next to "Men"/"Everyone" in a stacked list, despite its
own SVG bounding box being genuinely centered in its 24x24 viewBox.** The
circle (♀'s bold, high-ink-coverage part) sat at cy=9, well above the
viewBox's true center (12); the thin stem+crossbar below made the box
average out to a centered bbox on paper, but a human eye weights the bold
circle far more than the thin lines beneath it, so it visibly reads as
riding high. "Men" (♂) has the same kind of asymmetry but in the opposite
direction (circle in the lower half, arrow above) and happened to look
fine; "Everyone" (two overlapping circles, both dead-center) was never in
question. Fixed by shifting the whole symbol down (circle to cy=10.5, stem
and crossbar shifted the same amount) so the circle — the part someone's
eye actually anchors on — sits closer to true center, not just the overall
bounding box. This exact SVG is inlined identically in 3 places (onboarding
step 2 "Choose your sex", step 6 "attracted to", and the Edit Details
"attracted to" sheet) — fixed all 3 via one `replace_all`, since a shape
that reads as off-balance in one place will look identical everywhere else
it's copy-pasted. Lesson: for icons meant to sit in a uniform row/list,
"is the SVG's bounding box centered" is the wrong question — check where
the visually dominant shape (fill/bold stroke, not thin decorative lines)
sits, since that's what an eye actually aligns against.

**That venus-icon SVG fix still wasn't the actual bug the user meant.** They
followed up: the "Attracted to" ROW itself (in Edit Details' row list, not
the sheet's own options) had its icon and chevron "off" compared to Name/Age
above it — nothing to do with the icon's internal geometry at all. Comparing
screenshots of the three rows directly showed the real issue: the icon
circle was visibly bigger and flush against the left edge, and the chevron
sat differently, only on this one row. Root cause: this row alone carried an
extra `settings2-row--noborder` class, whose CSS overrides
`padding: 14px 16px` (used by every other row) down to `padding: 12px 0` —
zero horizontal padding — so its content sat flush against the container
instead of inset like its siblings. The class was unnecessary to begin with:
`.settings2-card > .settings2-row:last-child` already strips the bottom
border automatically, which was the only reason `--noborder` had been added.
Fix was a one-word class removal. Lesson: when a symptom is "this one row's
icon/spacing looks wrong compared to its siblings" and the icon's own markup
is identical between rows, check what row-level classes differ before
touching the icon at all — a modifier class doing double duty (here:
removing a border ALSO zeroing padding as a side effect) is an easy thing to
miss when eyeballing one row in isolation instead of diffing it against a
working sibling.

**The recentered setup-list tiles then showed white/dark page-background
bleeding through the corners — "some parts are pink but not full."** That
crop centered a fixed 160×160 window on the icon glyph's own center to fix
the earlier off-center complaint, but the actual tile in the source art is
only ~145×130 — so the fixed window overshot the tile's real edges on the
sides with less slack, sampling past the tile into the surrounding card
background. First attempt at a fix (re-cropping strictly inside the tile's
own detected bounds) was WRONG per explicit user pushback — it visibly
undid the centering fix ("not center too, not like before"). Correct fix:
leave the glyph-centered crop files exactly as they were (revert, don't
re-touch them), and instead scale the `<img>` up (`transform: scale()`)
inside its already-`overflow:hidden` 40px container — since the crop is a
perfect square matching the container's own aspect ratio 1:1,
`object-fit:cover` alone has nothing to crop and shows the full crop
including its bled edges; scaling the image up around its own center
pushes exactly those bled edges outside the visible clipped area without
touching the source files or shifting where the glyph sits. First value
tried, 1.3, LOOKED fixed at the size these actually render at (40px) and in
a normal screenshot — but the user zoomed in and caught a thin rim still
showing on one edge (bleed was asymmetric: up to ~24px overshoot on the
worst edge out of the 160px crop, so 1.3x wasn't enough to clear it; the
minimum that clears every edge works out to roughly 1.44x). Swept 1.3/1.5/
1.7/2.0 rendered at 180-220px (not 40px) to actually see thin rims that
vanish into anti-aliasing at true size, confirmed 1.5 is the smallest value
clean on all 5 icons in both themes at that zoom. Lesson #1: when a crop is
"centered correctly but overshoots its container's true bounds on the
edges," that's a display-time cropping problem, not a source-crop
problem — solve it with `transform:scale` inside an already-clipping
container rather than re-cropping the asset, which can easily re-break a
previous fix. Lesson #2: when a user says "revert, don't touch the icons,
just fix X," react literally — restore the exact prior file, don't reach
for "a slightly different re-crop that also addresses X." Lesson #3: a thin
bleed rim can be invisible at an element's true rendered size (40px here)
and only show up once someone actually zooms in — when verifying a
"trim/crop/clip this" fix, render the element far larger than its real size
(not just at-size) before declaring it clean, the same way the user
actually caught it.

**A settings row ("Show skipped profiles") permanently displayed
"Upgrade to see" with a lock icon regardless of paid status.** Turned out
this exact feature already exists, fully built and unlocked, elsewhere
(`_populateSkippedPanel()`, gated on `isPaidUser()` which already returns
true) — this row was a separate, stale, hand-written placeholder from
before that real feature existed, with no `onclick`, no dynamic text, and
nothing ever re-rendering it, so it just permanently showed its original
placeholder copy. Fixed by turning it into a real navigation link to the
screen where the working feature already lives (matching its sibling rows'
existing click-through pattern), removing the lock icon, and replacing the
stale copy with a plain description of what it actually does. Lesson: before
writing new copy/logic for a "broken/stale-looking" row, grep for whether
the feature it describes is already implemented somewhere else in the
app — a row that never got wired up to the real feature reads identically
to a row that's still actually paywalled, and the fix is completely
different (connect it) vs. (build the gate).

**A CSS rule (`.cine-plan2-ic img`, the Plan screen's tone/brain icon
sizing) silently vanished from the parsed stylesheet — computed styles
showed browser defaults no matter what was written, `!important` included.**
Spent a long stretch ruling out cache (CDP cache-disable, MD5-matched curl
fetches), duplicate selectors (grep clean), inline styles (`null`), and
cascade/specificity — `element.matches('.cine-plan2-ic img')` returned
`true` and the raw served CSS text looked completely valid, so it read like
a genuine cascade mystery. Root cause, found by walking `document.styleSheets[0].cssRules`
directly instead of trusting raw text: the rule wasn't in the PARSED
stylesheet at all. A `/* ... */` comment two rules earlier, documenting
"these onb-plan-tone-*/onb-plan-brain crops," contained the literal
substring `*/` mid-sentence (the tone-icon filename glob `onb-plan-tone-*`
immediately followed by `/onb-plan-brain`) — closing the C-style comment
early. Everything after that point (the rest of that sentence, plus a whole
second comment block) became raw, invalid, unparseable CSS text sitting
between rules, and the parser's error-recovery silently ate the next actual
rule along with it. `.matches()` only checks selector syntax against an
element, not whether the rule exists in the live stylesheet — it will
happily return `true` for a rule that was never parsed, which is exactly
what made this look like a cascade bug instead of a parse bug. The
`!important` "fix" applied under time pressure never actually worked (the
whole declaration block was being swallowed regardless of its contents) —
confirmed and reverted once the real cause was found. Lesson: when a rule's
selector matches but its properties never apply and nothing about cascade/
specificity/cache explains it, check `document.styleSheets[n].cssRules`
(or `getMatchedCSSRules`-equivalent) to see whether the rule was parsed at
all before assuming it's a cascade problem — and never write a filename
glob or path fragment containing `*/` inside a CSS comment (spell it with a
space, e.g. `tone-* / onb-plan-brain`, or avoid the wildcard entirely).

**After that CSS-parse fix, declared the Plan screen "done" without actually
diffing it against the reference mockup the user had already dropped in the
assets folder (`Reference results.png`) — cost a wasted round and explicit
"very dissapointed" pushback.** Several real, avoidable defects shipped at
once: (1) the "What would you like Zelo to help with" icon crops had solid
BLACK squares baked into their rounded corners — root cause, alpha was
computed purely from distance-to-TILE-color, so the tile's own rounded
corners (where the dark PAGE background peeks through, a totally different
color) measured as "far from tile color" and got treated as opaque glyph.
Fixing that with a dual-background check (transparent if close to EITHER
page or tile bg) still left a faint ghost ring, because the anti-aliased
blend band between the two backgrounds is itself a third color close to
neither pure reference point. The robust fix was to stop keying off
background color entirely and mask by HSV **saturation** instead (vivid
glyph vs. anything washed-out) — but the first saturation attempt ALSO
failed, because saturation is unstable near-black: a page-bg pixel like
rgb(27,25,20) computes to s≈0.27 purely from a couple of units of noise,
easily clearing a naive threshold. Fix: gate on VALUE too (v<0.3 -> always
background, regardless of noisy saturation) before applying the saturation
gradient. (2) Card boxes were visibly different widths/indents from each
other — root cause, `.cine-scroll` uses `align-items:center` (not the flex
default `stretch`), so any child without an explicit width sizes to its own
CONTENT's natural width instead of filling the row; `.cine-plan2-card` had
no explicit width, so cards with shorter text/content ended up narrower and
centered instead of edge-to-edge like their siblings. Fixed with
`width:100%` on the card. (3) The "Your focus" card icon was a generic
hand-drawn pulse-rings SVG instead of the reference's actual bullseye+arrow
icon, the "Zelo will adapt to" card icon used the unrelated AI gem
(`interest.png`) instead of the reference's sparkle-cluster glyph, and the
3 sub-icons (tone/goals/practice level) mixed one baked-background raster
icon with two flat hand-drawn SVGs the reference doesn't use at all — all
three defects were exactly the standing "crop the reference the user
already gave you, don't substitute/hand-draw something close" mistake
(see the earlier setup-list-icons entry above) recurring on a screen where
the reference file (`Reference results.png`, a real full-screen mockup PNG
already sitting in the assets folder) had been sitting there the whole
time. Fixed by cropping all 5 of these directly out of that file (target,
sparkle, tone, goals, practice-level), using the same saturation+value
glyph-masking technique. (4) The hero image had been shrunk (`width:92px`)
and given extra card-shrinking overrides (smaller title/lede) specifically
to avoid the screen needing to scroll — the user explicitly did not want
that trade: reverted to the original `--sm` (172px) hero size, restored
default title/lede sizing, and additionally stripped the hero's shared
boxed-card background for this screen only (the reference shows the
clipboard artwork floating directly on the page, not inside a card — it
already has its own baked-in shadow). The screen now genuinely scrolls
past the fold on a real device viewport, which is fine — `.cine-scroll`
already supports it. Lesson #1: when a full-screen reference mockup file
exists in the assets folder, DIFF the actual rendered output against it
side-by-side before calling a UI rebuild done — a CSS-parser bug fix (the
entry above) is not the same task as "matches the mockup," and finishing
the former doesn't mean the latter is true. Lesson #2: an alpha-masking
technique tuned and proven on one reference image (dark page + pale tile,
high color separation) does not automatically transfer to a different
image with different background relationships — re-verify the masking
approach's assumptions (what colors are actually present, how they blend
at edges) each time, the same way crop scale values needed re-tuning per
icon set earlier in this log. Lesson #3: don't shrink existing, previously
correct-sized UI elements to eliminate scrolling unless the user actually
asked for that trade-off — this codebase's scroll containers are designed
to degrade to scrolling gracefully, so "make it not scroll" should never be
an unstated assumption driving a redesign.

**Follow-up round on the same screen: card boxes still uneven height, and
the "Direct" tone icon's lightning bolt was visibly clipped at the bottom.**
Fast, targeted fixes this time: (1) gave `.cine-plan2-card` a shared
`min-height` + `align-items:center` so all 4 cards match regardless of
content length. (2) The bolt clip was `.cine-plan2-ic img`'s `scale(1.08)`
— tuned earlier by checking the OTHER 3 icons (playful/chill/brain) at
large size, but never re-checked per-icon once set; the direct/bolt crop
had less bottom padding than the other 3 and lost its tip. Rendered all 4
at 300px again: every one was already clean at scale(1.0), so dropped the
zoom entirely rather than special-casing one icon. Lesson: a shared scale
tuned by checking N-1 of N icons isn't verified for the Nth — check every
icon that will share a rule before shipping it, not just the ones on
screen during tuning. Also restored the gems icon (`interest.png`) and
`onb-setup-chat.png` for the "Zelo will adapt to" card per the user's
original ask (the reference mockup's own sparkle/plain-bubble icons were a
detour, not the actual target), enlarged the 3 adapt-row sub-icons, and
added back a grey divider between them.

**Follow-up: lightened the "setting everything up" list icon glyphs, added
a top-to-bottom staggered entrance animation to the Plan screen, and made
"Your challenge" actually conditional instead of hardcoded to
"Overthinking".** The icon lightening reused the same saturation-based
masking from the help-icon crop work (glyph vs. pale tile bg) to blend
only the saturated glyph pixels toward white, leaving the tile untouched —
straightforward once that technique already existed. The challenge logic
change was the more interesting piece: previously the card always said
"Overthinking" regardless of the user's actual answer to that question,
which is misleading for someone who barely overthinks. Now it only shows
Overthinking when `cineAnswers.overthink === 'way-too-often'`; otherwise it
derives title/description/icon from the user's #1 pick in
`cineAnswers.help` (reusing the same 5 icons already cropped for that
question, so no new assets needed) via a new `CINE_PLAN_CHALLENGE_INFO`
map. Those reused icons are transparent glyph-only crops, not the opaque
cover-cropped brain art, so the challenge icon's container needed a
`--glyph` modifier (object-fit:contain at 68% size) toggled dynamically
depending on which branch is showing — same lesson as the earlier
`--flat`/`--bare` split: a shared image container can't assume every image
that will ever fill it wants the same fit/scale treatment.

**Added a frosted-glass tab bar + sliding pill; the dark-mode override
initially leaked into light mode too.** This codebase's dark-mode pattern
is always two-part: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) SEL {...} }`
(follows OS setting) PLUS a separate unconditional `:root[data-theme="dark"] SEL {...}`
(explicit in-app override) outside any media query. Wrote only the second
half for `.tab-bar`/`.tab-glass-pill` and reused the bare
`:root:not([data-theme="light"])` selector without its media-query
wrapper — that selector matches whenever `data-theme` isn't literally
`"light"`, which by default is basically always, so the "dark" background
applied unconditionally regardless of actual color scheme. Caught by
screenshotting in `colorScheme: 'light'` before calling it done, not by
inspection — the two rules read as a matched, correct-looking pair at a
glance. Lesson: this specific two-part pattern is used dozens of times in
this file already; when adding a new dark-mode override, copy an existing
full pair (both halves) rather than reconstructing it from memory, and
always screenshot the LIGHT-mode result too, not just dark, since a leak
in this direction shows up there, not in the mode being tested.

**Chats-tab empty state redesign (new illustrated icon, shadow, CTA
button) — the light-mode icon crop punched a noisy hole through part of
its own artwork.** Given a light-bg + dark-bg pair of the same
illustration (two overlapping speech bubbles, one of them white/glossy),
tried the project's usual flood-fill-from-border technique on both. Dark
version (pure black bg) came out clean. Light version (near-white bg,
#fdfdfd-ish) came out with a static-noise hole through the white bubble's
own glossy highlight — because that highlight is itself close enough to
the page-white background color that the flood-fill couldn't tell "this
is background" from "this is a near-white part of the actual icon."
Fixed by recognizing the flood-fill wasn't even necessary here: the app's
real light-mode page background is genuinely `rgb(255,255,255)`, matching
the source crop's own near-white background almost exactly — so a plain
opaque bounding-box crop (no alpha channel at all) sits on the page with
no visible edge, sidestepping the whole background-color-collision
problem. Lesson: flood-fill transparency is only needed when the crop's
own background WON'T match the page it'll sit on (like a dark glow crop
against a warm off-black page); when they already match closely, a plain
opaque crop is simpler and immune to this exact failure mode — check
whether transparency is actually required before reaching for the more
failure-prone technique by default.

**Spent two rounds lightening `.cine-setup-card`'s DARK-mode background
when the user was testing in LIGHT mode the whole time — "it doesn't
change at all" was literally true, not user error.** Wrongly inferred
dark mode from a moon glyph next to the clock in an unrelated screenshot
several turns earlier in the session — that's iOS's Focus/Sleep status
icon, unrelated to the app's own light/dark theme, and I never actually
confirmed which theme the user's screenshots were in before scoping both
fixes to `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`
only. The user's actual screenshots the whole time showed the warm beige
light-mode color (`--s2` #f3ede4), which I misread as "this looks light
enough already, they must mean dark mode." Fixed by changing the base
(unconditional) rule instead of a theme-scoped override. Lesson: a status
bar icon (moon, battery %, signal bars) is not a reliable signal for which
CSS theme is active — if a color complaint doesn't specify light/dark and
a themed fix doesn't visibly help, check the actual screenshot's own
background color against both themes' known token values before
re-guessing which theme to scope the next attempt to, rather than staying
in the same (possibly wrong) theme and just intensifying the change.

**Scan Result's edge-swipe-back visibly slid the whole screen away, then
snapped it back into view, before the "Save this scan?" sheet appeared —
read as the screen leaving and un-leaving before being asked anything.**
`attachEdgeSwipeBack()`'s shared finish() has two paths: a "reveal" path
(drags a real destination screen into view underneath, for a normal back
navigation) and a plain path (no destination to reveal, just slides `el`
itself). Scan Result's own `resolveTarget()` already correctly returns
`null` (no reveal) whenever the scan isn't saved/skipped yet, specifically
because `goBackFromResult()` won't navigate in that case — it pops up a
save-prompt sheet instead. But the plain path didn't know that distinction
existed; it always slid `el` all the way to full width on a committed
gesture, then reset the transform to snap back to rest — a needed step
since it's not actually leaving — immediately before calling `backFn()`.
Fixed by adding an explicit `opts.willNavigate` callback (defaults to
`true`, so every other `attachEdgeSwipeBack()` caller is unaffected) —
Scan Result passes the same saved/skipped check `resolveTarget()` already
uses, and the plain path now settles back to rest (never slides to full
width) whenever `willNavigate()` says the commit won't actually leave the
screen. Verified with real `Touch`/`TouchEvent` objects, sampling the
element's live inline transform every ~30ms after touchend — confirmed it
now decays back toward 0 (with the same spring overshoot/settle already
used elsewhere) instead of climbing toward the screen's full width.
Lesson: a shared gesture utility's "no reveal target" branch can carry an
implicit assumption (here: "no target = still actually navigating, just
without a fancy transition") that silently breaks for a caller where that
assumption isn't true — trace what the committed branch's OWN motion
implies about `backFn()`'s effect, not just whether the function eventually
gets called.

**Same Chats-empty-state task, round 2: hand-drew an SVG icon for the CTA
button instead of checking the asset folder for a reference file first,
and added a CSS shadow under the hero icon that wasn't asked for and
didn't land well.** Direct repeat of the project's oldest standing
mistake (see the "New ver onb 3.png" entry above) — didn't notice the
user had dropped "Small message icon.png" into the same asset folder for
exactly this spot until they pointed it out themselves. Also worth
recording: that file's Read-tool preview (shown large) displayed with a
huge soft glow halo that looked like it needed the flood-fill
glow-extraction treatment used elsewhere in this project — but checking
its actual RGBA data pixel-by-pixel showed a hard, clean alpha cutoff (0
straight to 253, no gradient at all); the apparent "glow" was just the
preview's own large-size rendering of the bubble's pale internal shading,
not real alpha data extending past the shape. A plain alpha-bounding-box
trim was all it needed. Lesson #1: before hand-drawing ANY icon element,
re-check the same asset folder the user already dropped references
into — a follow-up message can add a new file after the original ask, so
check again on every visible-icon complaint, not just once per screen.
Lesson #2: a transparent PNG can look like it needs glow-extraction
purely from how large a preview renders it — check the actual alpha
channel data before assuming a cropping technique is needed at all.

**"Sometimes on first launch, something flashes briefly on the intro
screen before I've done anything."** Intermittent + only on cold
first-launch + not reproducible on demand is the signature of a parse-
timing race, not app logic — confirmed the mechanism directly:
`#tab-assistant` (the main app's Home/Scan tab) is `class="tab active"`,
visible by default, at line 33 of `index.html`; the onboarding overlay
that's supposed to cover it (`#cine-onboarding`, `hidden` by default) sits
~2000 lines further down, and nothing hides the former until script.js's
`DOMContentLoaded` handler runs `initOnboarding()`. On a slow HTML parse —
a large bundled file, a real device's first cold launch, anything slower
than a local dev server — the browser can paint `#tab-assistant`'s default
visible state before the parser even reaches the onboarding markup, let
alone before any JS executes to hide it. A fast local Playwright test
against localhost never hits this because parsing is too quick for the
window to matter, which is exactly why it wasn't caught here and reads as
device-dependent "sometimes" in the wild. Fixed the same way this file
already solves the analogous dark/light theme-flash problem (see the
inline `<script>` in `<head>` for `data-theme`): a plain CSS rule in
`<head>` — `html:not(.zelo-app-ready) #app { visibility: hidden; }` — gates
the ENTIRE app invisible until a class flip, and that class flip is the
very first line of the main `DOMContentLoaded` handler. CSS in `<head>` is
parsed and applied before `<body>` paints anything, so this closes the
race regardless of how slowly the rest of the document parses — nothing
can paint before JS has decided what should show. Lesson: "intermittent,
first-load-only, can't reproduce it on demand" almost always means a
parse/paint race, not a logic bug — look for default-visible content that
sits BEFORE (in document order) whatever JS is supposed to hide it, since
that ordering is exactly what a slow parse can expose.

**Built app-launch + mid-scan connectivity handling (skeleton → No
Connection screen; retry-then-error card) — testing it surfaced a real CSS
bug of exactly the same shape as the FOUC fix directly above.** New full-
screen elements (`.launch-skeleton`, `.no-connection-screen`) were toggled
via the `hidden` attribute/property from JS, same pattern used everywhere
else in this file — but their own rules (`.no-connection-screen { display:
flex; ... }`) never included a `[hidden]` override. A plain class selector
outranks the browser's default `[hidden] { display: none }` UA rule
(higher specificity), so `hidden` being correctly set on the element did
nothing — it rendered at all times regardless, sitting at z-index 10000
above everything else in the app, which is why the No-Connection screen
looked "stuck" no matter what the actual connectivity state was. Caught
because a Playwright click on a supposedly-hidden element's sibling failed
with "element intercepts pointer events," not because it was visually
obvious in a screenshot — a full-bleed overlay covering the whole viewport
can look identical to "nothing's covering the screen" if you're not
specifically looking for it, since there was nothing else to visually
contrast it against. Also worth recording: `page.route(url, route =>
route.abort('internetdisconnected'))` in Playwright is NOT scoped to just
the matched URL — it appears to simulate an actual device-wide network
outage, so an unrelated request (in this case, the separate launch
connectivity check) can fail too. Use `route.abort('failed')` (or
`route.fulfill()` with an error status) instead when the test should only
affect the one targeted endpoint. Lesson: any new element toggled via the
`hidden` attribute/property needs its own explicit `.the-class[hidden] {
display: none; }` rule in this codebase — the convention already exists
(`.yr-card-error[hidden]`, `.chats-empty-sub[hidden]`, etc.) precisely
because relying on the bare attribute is not safe once the element has
its own `display` rule of any specificity higher than a plain attribute
selector, which is essentially always.

**Onboarding's word-morph ("Confidence / Connection / Conversations")
"jumping"/no-typewriter report — two code changes were tried (chaining
`runWords()`'s `_cineDelay` calls instead of scheduling them upfront, and
dropping `filter: blur()` from `cineP1Morph`'s keyframes since `filter`
forces WebKit off the GPU-compositor fast path `opacity`/`transform` get)
and both were verified in isolation (a synthetic-stall Chromium test for
the first, code-level reasoning for the second) — but the user reported no
change on the real device either time, and explicitly asked for both
reverted rather than continuing to iterate blind. Reverted; the actual
cause of what they were seeing was never confirmed. Lesson: a change that
is independently correct and passes its own targeted test is not the same
claim as "this is what the user is actually seeing" — without a way to
reproduce the reported symptom on the user's own real device (not
simulator, not Chromium), two technically-sound fixes in a row still
provably fixed nothing from the user's side. If a real device isn't
reachable, say so and ask what evidence would actually confirm a fix,
rather than shipping another plausible-but-unverified attempt.

**Real root cause of "app takes ~15s to load on a fresh install/update,
worse than ever after a later change."** Two earlier attempts (vendoring
supabase-js locally instead of a CDN `<script>`, making the Google Fonts
`<link>` non-render-blocking) were real fixes for real render-blocking
resources, but the user reported zero perceptible improvement — both were
minor next to the actual dominant cause, found only by measuring, not
guessing again: `index.html` had 157 `<img>` tags with real `src`
attributes and zero `loading="lazy"`, spread across ~39 mostly-hidden
screens (Settings sub-pages, History, Badges, Leaderboard — screens a
session may never visit). Browsers' preload scanner fetches a real `src`
on sight regardless of `display:none`/`hidden` on an ancestor — confirmed
under Playwright + CDP network/CPU throttling that on a cold cache all
150+ of these compete directly with `script.js` and the connectivity
check for bandwidth, at one point starving `script.js` itself for 18+
seconds. `loading="lazy"` alone did NOT fix it either — its own
deferral heuristic needs a real layout position to judge distance from
viewport, which a `display:none` element doesn't have, so the browser
fetches eagerly anyway rather than risk never loading it. The fix that
actually worked (confirmed via the same throttled harness: critical path
dropped from never-completing-within-45s to ~15.8s): strip `src` down to
`data-src` for every image outside the always-visible first tab, and only
populate the real `src` the moment a screen actually becomes active —
hooked into every "show a screen" function that exists in this codebase
(`showTab`/`pushScreen`/`popScreen`/`openHistory`/`_restoreHistoryReturn`/
`_replaceActiveScreen`/`_plShowScreenNoStack`/the three `.cine-screen`
togglers/`_showCrashScreen`/`showSessionExpiredScreen`/the connectivity
gate's no-connection screen), PLUS a global `IntersectionObserver` safety
net (`_armLazyImageObserver()`) since a codebase this size will always
have a "show a sheet/modal" path someone forgets to hook by hand.

**That lazy-image fix then caused two of its own regressions, both only
visible on real WebKit and reported as "worse than before the fix":**
1. The showcase screen's phone-frame image
   (`onb-showcase-phone-frame.png`) — the single most visually prominent
   element in onboarding, animating in over a 1.5s fly-in — got swept
   into the same `data-src` conversion as everything else. Its `src` was
   only populated the instant its own screen became active, i.e. the
   exact instant its fly-in animation started, so it visibly popped in
   mid-flight instead of already being there. Root lesson: a screen that
   ~100% of sessions reach within the first few seconds, with a
   choreographed entrance animation on its own key visual, is a bad
   candidate for "defer until shown" — the whole `#cine-onboarding`
   subtree (34 images, all but one of which stayed accurate) was reverted
   back to eager loading, keeping the lazy-load fix only for genuinely
   optional/rarely-visited screens.
2. Even after (1), a single-frame white flash appeared in dark mode at
   the phase1-to-showcase transition — confirmed genuinely new (a
   per-frame RGB scan of the earlier "verified clean" recording found
   zero white frames; the same scan on the regressed build found exactly
   one). Root cause: `MainViewController.swift`'s dark/light background
   fix (see the entry below on the original white-flash bug) set
   `webView.backgroundColor` and `webView.scrollView.backgroundColor` but
   never `webView.underPageBackgroundColor` — a separate, dedicated
   WKWebView API (iOS 15.4+) specifically for what paints before the page
   itself has content, which the other two properties don't cover. Fixed
   by also setting that property in `applyLaunchBackgroundColor()`.
   Verified with the same per-frame whiteness scan: zero white frames
   after the fix, across the full launch sequence.
   Lesson for both: when a fix that measurably solves the RIGHT problem
   (verified via a real harness, not just eyeballing) gets reported as
   "worse than before," don't assume the report is wrong or re-litigate
   the original diagnosis — the new fix itself is the first suspect, and
   a real recording + frame-level comparison against the last known-good
   recording is what actually separates "still the old bug" from "a new
   bug this fix introduced." They can look identical from a one-line bug
   report but require completely different fixes.

**Swipe-back still jumped every scrolled page back to the top, even after
the earlier AI Coach/Chat scroll fix — plus scrollbars still showed on some
lists.** The earlier fix (see the "Swipe-back reveal reset scroll to top"
entry above) saved/restored scrollTop in `_slideMountEl`/`_slideUnmountEl`
only for `.chat-messages, .aicoach-messages`, found by class name via
`el.querySelector`. Every other scrollable thing — the `.screen`/`.tab`
element itself (they're `overflow-y:auto`), History, Account, settings
sub-pages, sheets, carousels — was never in that list, so all of them
still reset to 0 the moment a swipe-back gesture started, on both the page
being dragged away AND the page being revealed underneath it. Reproduced in
Chromium too (raw `appendChild` of a scrolled `.screen` drops scrollTop
500 -> 0), so this was testable without real WebKit: seed a long list,
scroll it, dispatch real Touch/TouchEvent edge-drag events, sample
scrollTop mid-drag — before the fix both screens read 0 from the first
move; after, both hold. Fix: `_captureScrollState(el)` snapshots scrollTop/
scrollLeft for `el` and every descendant that's scrolled (no class list to
keep in sync), `_restoreScrollState()` puts them back with
`scroll-behavior:auto` forced so the restore doesn't animate. Lesson: a
fix scoped to "the one element the bug was first noticed on, found by
class name" only fixes that element — for a gesture utility shared by
every screen, snapshot generically instead of by selector.
Scrollbars: the old rule hid them for `.tab/.screen/.chat-messages` only;
a control run against the previous stylesheet (headless Chromium hides
scrollbars by default — must launch with `ignoreDefaultArgs:
['--hide-scrollbars']` or the check can't fail) found the leaderboard's
`.lb-scroll-area` still reserving a 15px gutter. Now one global
`* { scrollbar-width:none }` + `*::-webkit-scrollbar { display:none }`;
0 offenders across all 45 screens/tabs.

**Launch: removed the "Zelo" loading screen; white flash in dark mode
again; "is the slow first launch just Xcode, or will users get it?"** The
launch skeleton sat over the app on EVERY launch until a network round-trip
(the connectivity check) resolved — on a cold first launch (fresh
install/update, no DNS/TLS cache) that was the most visible, slowest part,
for a check that passes almost every time. It's gone: the first screen
shows as soon as local init finishes (`zelo-app-ready` is now flipped right
after `initOnboarding()`), and the connectivity check runs in the
background — only a FAILED check raises `#no-connection-screen` over the
app (timeout raised 2.5s -> 6s, since nothing waits on it any more and a too
short one would throw a false "Connection issue" over an online app; Retry
now dims its button instead of swapping back to a skeleton). White flash:
until `style.css` is fetched and applied the page paints the browser's
default WHITE canvas over the WKWebView's own dark native background — the
earlier `underPageBackgroundColor` fix only covered the native layer under
the page, not the page's own canvas. Fixed with `<meta name="color-scheme"
content="light dark">` plus a tiny inline `<style>` in `<head>` giving `html`
the same #ffffff / #15130f as `--bg`, honoring `[data-theme]`. Measured
(iOS Simulator, dark mode, screen recording analyzed frame-by-frame —
`/tmp`-style harness: record, ffmpeg frames, detect white frames): old code
showed one ~105ms full-white frame run in 1 of 8 fresh installs, new code 0
of 16. That is consistent with the fix but NOT proof — a ~1-in-8 flake shows
0 in 16 about a third of the time; the mechanism (canvas painted before CSS
lands) is the stronger argument. Do not over-claim from a small N.
Xcode-vs-users, measured on the simulator: Release starts consistently
faster than Debug (native view ~1.3s vs ~1.4s fresh, and up to ~2x faster on
relaunch in one batch), fresh install is a little slower than relaunch, and
run-to-run noise (+/-0.7s) is bigger than most single changes — so compare
medians of several runs, never one. What can't be measured here: a real
phone's flash-storage cold start, Xcode's own install-and-attach time. So:
users DO get one cold first launch per install/update (unavoidable; we only
control how much network/blocking work sits in it), while Xcode Run adds
Debug-build + debugger + reinstalling the bundle on top. Judge speed on a
Release build (Edit Scheme > Run > Build Configuration = Release) or
TestFlight, not a Debug Run.
Two measurement traps worth remembering: (1) `du` on this exFAT drive
reports every small file as a 512KB cluster — it said the bundle's web
payload was 454MB; the real byte total is ~72MB (sum file sizes, don't
trust `du`). (2) 838 stray `._*` AppleDouble files were sitting inside
`www/` and `ios/App/App/public/` (they get copied into the .app); a plain
`cp` on this drive keeps creating them — run copies with
`COPYFILE_DISABLE=1` and `find www ios/App/App/public -name '._*' -delete`
after syncing.
Payoff of that cleanup, measured: `npx cap copy ios` took 24.95s with the
`._*` files gone and `COPYFILE_DISABLE=1` set, versus the usual 15–20+
minutes on this drive for every sync earlier in the same session. So the
"slow exFAT drive" wait was mostly AppleDouble junk being copied/regenerated
(838 files), not raw disk speed — clean them before every sync, and expect
the same for Xcode's own bundle copy on Run.

**App icon on launch instead of a loading screen (build 2026-09-24c).** Ask:
"show the app icon instantly at launch, centered, not too big/small, no Zelo
heading." Only the NATIVE launch screen can be instant (it exists before
any web content), so: `LaunchScreen.storyboard` is now a plain background
(`LaunchBackground` named color: #ffffff light / #15130f dark = style.css's
`--bg`, so there's no black-to-dark jump at handoff) with the real app icon
(`LaunchIcon.imageset`, cut from `AppIcon-1024-new.png`, squircle-masked with
alpha, 120pt) centered by constraints. That launch screen only lasts until
the first view-controller frame, after which the WKWebView is blank until
index.html paints (~1-2s of dead dark screen, measured) — so
`MainViewController.installLaunchOverlay()` puts the same icon, same size,
same spot over the web view and fades it out when script.js posts
`webkit.messageHandlers.zeloReady` (`_signalNativeReady`, sent two animation
frames after `zelo-app-ready` so it has really painted), with a 6s hard
timeout. Verified on the simulator in dark AND light mode: icon appears
centered, stays through the whole former blank gap (no empty frames),
fades into the typewriter, 0 white frames. The stock Capacitor `Splash`
imageset is gone. This is a native change — needs a real Xcode rebuild, a
web-only sync won't show it. Note the first ~3 frames of a simulator launch
are the OS's own app-open zoom placeholder (black), not ours.

**Practice tutorial showed only "Slide right to like", then vanished.** Cause
was my own Skipped Profiles change: `initSwipeDeck()` now leaves out
profiles listed in `zelo_skipped_profiles`, which persists across launches
(the dev wipe in DOMContentLoaded doesn't clear it), and the pool is only 10
profiles. After enough testing skips the deck had 1–2 cards, and the tutorial
needs 3 (right lesson, left lesson, photo-nav lesson) —
`_showPracticeTutorialStep()` silently calls `_finishPracticeTutorial()` the
moment `#card-deck` has no top card, so the tutorial just ended. Reproduced
in Chromium by seeding `zelo_skipped_profiles` with 9 of 10 ids: tutorial
stayed active through "Slide right", then `tutorialActive` went false on the
first swipe. Fix: `initSwipeDeck({ fresh: true, ignoreSkipped: true })` in
`practiceTutorialStart()`, so the tutorial always gets the full pool;
verified with 0 and 9 skipped through all four steps. Lesson: when a new
feature filters shared state (the deck) that a scripted flow (the tutorial)
assumes is full-size, the scripted flow must opt out of the filter — and a
"bail cleanly" branch that ends a flow with no visible error will present as
"the rest is gone", so check for that pattern first when a multi-step flow
stops early.

### 2026-09-24e — AI Coach "Hmm, I couldn't reach Zelo" + availability pill

The message came from a bare `catch {}` in the AI Coach send that turned every
failure into the same text. Direct calls to `deepseek-proxy` showed the backend
and DeepSeek are healthy: a signed-in user gets 200 with a valid reply, but a
caller with only the anon key gets 401 "Sign in required." — the security
hardening (`requireUser`) rejects them on purpose. `AUTH.requireAuth` is never
called in script.js and onboarding's `cineAuthStub()` doesn't create real
accounts, so a user who never signed in via the email screen hits this on every
AI call (AI Coach, scan reply, OCR, practice chat). Not fixed here — it's a
product/security decision (require real sign-in before AI use vs. loosen the
proxy).
Added: `_aiCoachClassifyError()` (401/403 → auth, 429 → limit, offline → net,
else down), stored as `failKind` on the failed message and excluded from the
history sent back to the model; a small red/green/neutral pill under the failed
reply (`#aicoach-status-pill`, `.aicoach-status*` in style.css, alpha tints so
light/dark both work) with "Sorry for the inconvenience"; a Sign in button for
auth failures; a background probe (`_probeZelo`, `{health:true}` body) that
re-checks every 15s and flips the pill green with a Retry button, which reuses
the same message object so it never adds a second user turn.
Gotchas: `zeloSupabase.functions` is a getter returning a NEW client each
access, so tests must `Object.defineProperty(zeloSupabase,'functions',…)`, not
assign `.invoke`. The `health` branch in `supabase/functions/deepseek-proxy` is
written but NOT deployed (production deploy was blocked); the client treats the
old proxy's 400 "Missing messages" reply as "function is up", so it works
either way. `decrementScanCount()` still runs before the request, so a failed
request costs a free credit until the user hits Retry-less abandon — unfixed
(that function is documented as one of two places allowed to change the count).

### 2026-09-24f — Real onboarding sign-in, link-thread icons, back buttons unified

Follow-up to the AI Coach "couldn't reach Zelo" finding (2026-09-24e): the
cause was users never being signed in. Onboarding step 14's Apple/Google/email
buttons were inert (`cineAuthStub()` just advanced). Now `cineProviderTap()` →
`AUTH.startFromOnboarding(provider, cineAuthStub)` (new, services/auth.js):
opens the real auth sheet (terms pre-ticked, email step or native Apple/Google
started), and onboarding only advances once `_onSignedIn` → `_resolvePending`
fires the callback. Already-signed-in users skip straight through.
`DEV_FORCE_SIGN_IN_EACH_LAUNCH` (script.js top) does a local-scope signOut
before `AUTH.init()` on every launch, same spirit as the existing DEV first-run
wipes — flip to false before release. The "Sign in required" pill from 09-24e
stays for genuinely signed-out cases (skipped sign-in, session/subscription
ended). Test tip: fake a login with
`zeloSupabase.auth._notifyAllSubscribers('SIGNED_IN', {access_token, user})`;
advance waits on the profiles insert network round trip (several seconds with a
fake token). Google sign-in still has the placeholder client ID in auth.js.
Link-a-thread picker (`openThreadLinkPicker`): rows now show ONLY the
reply-style (generated message) icon; threads with no styled scan use "smooth".
No gem, no drawn chat-bubble fallback. History rows untouched.
Back buttons: audited every `.back-btn`/`.auth-back-btn`/etc. by computed
style + SVG in light and dark. Fixed: `.aicoach-back-btn` was pink (accent) →
`--text`; `.auth-back-btn` used `--s2` in light → `--s1`; `.journey-back-btn` was
40px translucent-white → 44px `--s1` + border; journey and email-step arrows
were stroke 2.2 / 20px → 22px stroke 2; scan-result's hard-coded border
`#E8DDD2` → `--border`; `.aicoach-history-close` pink → `--text`. Left on
purpose: `.back-btn--pink` (Skipped Profiles, matches its reference) and the
52px onboarding-style `.cine-back` / `.ped-back-btn` (practice edit details,
which has a chevron instead of the arrow).

### 2026-09-24g — Link-a-thread misread corrected, launch sign-in, pinned History header

Link a thread: 09-24f swapped the gem fallback for the smooth chat icon, which
was a misreading. "No chat as a thread, only the ones generated" meant WHICH
threads are listed, not their icon. Reverted the icon code to the original
(gem fallback stays) and instead `openThreadLinkPicker()` now lists only
threads with saved scans (`t.scans.length`) — threads that exist just because
an AI Coach chat auto-created them (empty `scans`, `coachChat` set) are left
out. Lesson: when a request says "remove X" about an icon and "only show Y",
check whether Y is about the data set before touching visuals.
Launch sign-in: onboarding-step sign-in alone (09-24f) never appeared unless you
walked to step 14, so it read as "didn't make me sign in". With
`DEV_FORCE_SIGN_IN_EACH_LAUNCH` and no session, launch now also opens the real
Sign In sheet 400ms after `AUTH.init()` (script.js DOMContentLoaded). Remove
with the flag before release.
History header: `.app-header` was `position: sticky` inside the scrolling
`.screen`, so rows scrolled up through the `.screen`'s own 34px top padding and
behind the header. Fixed with the same recipe as the tab headers
(`#screen-history .app-header { position: fixed; top:0; padding-top:50px }` +
`.screen--history { padding-top: 108px }`); verified scrolled 300px in
Chromium: header stays at top 0 with an opaque background.

### 2026-09-24h — History header truly pinned, dev auto sign-in (needs one credential)

History: the fixed-header fix (24g) still let the header follow a pull-down on
device. Real fix: `.screen--history` is `overflow:hidden` and never scrolls;
`.history-layout` (`flex:1; overflow-y:auto`) is the only scroller, and the
Zelo/X header is a plain sibling above it, so nothing (scroll or rubber-band)
can move it. Chromium check: header top stayed at 34px with the list scrolled
300px, screen scrollTop 0. Lesson: sticky/fixed inside the scrolling element
is not reliable on iOS — put the header outside the scroller instead.
Dev auto sign-in: the launch Sign In popup and the forced sign-out from 24f/24g
are GONE. `DEV_AUTO_SIGN_IN` (script.js top) → `_devAutoSignIn()` signs in
silently on launch with `window.ZELO_DEV_LOGIN` from the gitignored
`dev-credentials.js` (loaded before script.js), else tries
`signInAnonymously()`. Anonymous sign-ins are DISABLED on the project (422
`signup` response), and creating a dev account myself needed the service-role
key, which was denied — so until `dev-credentials.js` is filled in (or anonymous
sign-ins are enabled in the dashboard), launch stays signed out and AI Coach
shows the "Sign in required" pill. Remove flag + file before release.

### 2026-09-24i — "Your Reply" replay redesign (reference 1:1)

Saved-reply replay (`openScanReplay()`, reached from a thread/History/AI Coach
"View full chat") now adds `.is-replay` to `#screen-scan-result`; a freshly
generated scan removes it, so the carousel layout is unchanged. All replay CSS
lives in one block above the "YOUR REPLY SCREEN" rules, measured from the
reference at 430pt (1.807 px/pt): label INSIDE the conversation card, her bubble
+ the saved reply as the pink "me" bubble, "Edit your message" field (0/300),
Zelo Suggests + bigger Copy pill, full-width suggestion card (min-height 307,
18.5px text), "Other actions" tiles (79×49, radius 18). Colours are tokens
mixed with `--accent` via color-mix, so dark mode follows automatically.
New behaviour (script.js, next to `_retryStyleFetch`): typing in the edit box
overrides the card text/Copy target in memory (empty restores the generated
one); "Get new suggestions" = refetch current style; "Change tone" = next of
smooth/funny/bolder/direct/warmer; "Shorter reply" = the `shorter` style. Best
Match badge only on the saved style (`state.replayBestStyle`). Nothing is
persisted back to the thread. The reference's "…" header button was NOT built —
no action was defined for it; the header keeps an invisible spacer so the title
stays centred. Also fixed: `#screen-scan-result .screen-title` was hard-coded
#121212 (invisible in dark mode) → `var(--text)`.

### 2026-09-24j — Replay v2: compact, add her/your message, tone sheet, persistence, dark reply-style icons

Replay ("Your Reply" opened from a saved thread) reworked after the first pass:
scaled down so "Other actions" is visible on an iPhone 11 (414×896, labels end at
~757px with the standard 38px+12px header offset kept for the notch); the 0/300
counter and the single "Edit your message" box are gone. In their place: two
boxes side by side, "Add her message" | "Add your message" (`#yr-add-row`); the
chat composer's `chat-send-icon.png` send button only appears once text is typed
(`.yr-add-box.has-text`; needs `.yr-add-box .yr-add-send` specificity because
`.send-btn` is defined later and otherwise wins). Enter sends. A sent message
pops into the conversation card (`yr-conv-row--pop`). A message from HER also
becomes `state.asstMessage` and regenerates the suggestion; one from the user
just joins the conversation. "Change tone" is now a slide-up sheet
(`#yr-tone-overlay`, reuses `.thread-link-overlay` chrome + swipe-down close) with
every tone as a tile; tapping one shows that tone generating in the card.
Persistence: `_replayPersist()` writes the conversation, last her-message,
reply, style and time back into the thread's last scan on every change, so
History, Link a thread and AI Coach's linked-conversation card stop showing the
old one. `_replayOnReplyReady` also rewrites the trailing pink bubble when it was
just the previous suggestion. Gotcha: `_ensureStyleFetched` returns early when a
style is cached, so `_replaySwitchStyle` calls the hook itself in that case.
Dark icons ("poorly cropped, white spots"): the `reply-styles/*-dark.png` files
(already swapped in via `ICONS_WITH_DARK_VARIANT`) had white-contaminated RGB on
every partly-transparent edge pixel plus a baked pale ground-shadow under the
tail. Reprocessed all 7 with /tmp script logic: baked shadow rows → transparent;
every partial-alpha pixel takes the colour of the nearest solid body pixel
(scipy distance-transform indices); alpha < 40 dropped. Originals kept only in
/tmp (git has them). Verified composited on the dark card colour at 3×. Remember
to copy changed assets into www/ — the local server serves www/, so the first
screenshot after the fix still showed the old icons.

### 2026-09-24k — New reply-style icons (14 supplied renders) + hold-to-delete a message

The user supplied real renders (7 styles × light-on-white + dark-on-black, 1300px)
because my earlier crops had white fringes. Old files are kept, untouched, in
`assets/icons/_source/reply-styles-old/` (14 PNGs) so they can be restored by
copying back. The new ones replace `reply-styles/{style}.png` and `{style}-dark.png`
(same names, so `ICONS_WITH_DARK_VARIANT`'s swap keeps working). Script:
/tmp/zelo_pw_test/build_new_icons.py (source images in the session's images/4–17.png;
mapping 4 warmer-dark, 5 smooth-dark, 6 shorter, 7 longer, 8 smooth, 9 warmer,
10 direct-dark, 11 bolder, 12 shorter-dark, 13 longer-dark, 14 funny, 15 funny-dark,
16 direct, 17 bolder-dark). Method: DARK images → alpha = clip(max(rgb)/150), colour
= rgb/alpha (unpremultiply from black; the glowing ground ellipse stays as the art
has it). LIGHT images → bubble silhouette = biggest connected component of
saturation > 0.4, closed + hole-filled, eroded 2px; inside that keep original
pixels; outside/rim, alpha = (255-p)/(255-bubbleColour) and colour = unpremultiplied
bubble colour (so the soft shadow becomes a translucent tint, no white fringe).
Every icon is cropped by BUBBLE width (not shadow) with fixed margins and saved as
240×~233 so all 14 read the same size; `.is-replay .yr-card-illustration` grew to
70×68 to keep the icon as large as before. Verified composited on white, pink-tint
card and dark card. Not yet judged by the user — revert path is the folder above.
Hold to delete: `attachReplayBubbleHold()` (delegated on `#yr-conv`, 480ms, cancels on
move >8px/lift) → `_showChatConfirm` → `replayDeleteMessage()` (also re-points
`state.asstMessage` at her latest remaining message, persists to the thread). Cannot
delete the last remaining message. Also fixed a bug found while testing: reopening a
replay whose saved conversation ended with HER message appended the reply again as
a new pink bubble; a scan with a stored conversation is now used exactly as stored
(only scans with none are rebuilt from message + reply).

### 2026-09-24l — "Use this reply" adds your message; copy toast drops from the top

`copyReplyFromCard()` (the card's "Use this reply") now also calls
`replayUseReply(text)` when `state.replayThreadId` is set: the reply becomes a pink
"me" bubble (pops in) and is saved to the thread. If the conversation already ends
with that exact bubble it is only re-popped (committed), not duplicated. The header
"Copy" pill still only copies. Mirror tracking changed from "last bubble text ==
current reply" to an explicit `state.replayMirrorIdx` (the pink bubble that is only a
stand-in for the current suggestion): a new suggestion replaces it only while it is
still the last bubble and uncommitted; Use / adding your own message / deleting sets it
to -1, so a committed message is never overwritten by later regenerations.
`.copy-toast` now mirrors `.streak-notif`: `position: fixed; top: calc(10px +
env(safe-area-inset-top))`, starts at `translateY(-140%)`, same spring transition;
hide timer 340ms to match. This is global — every "Copied!" toast in the app drops in
from the top now, not only the replay screen.

### 2026-09-24m — One standard banner size, fixed replay card, AI Coach always a new chat

Banners: `.copy-toast` is the reference. A single block at the END of style.css
("ONE STANDARD NOTIFICATION BANNER") now gives `.streak-notif`, `.xp-panel` /
levelup, `.limit-toast` (flashLimitToast) and `.cine-terms-warn` the same fixed top
position, 16px insets, 20px radius, shadow, spring drop-in and 44px icon / 1rem +
.8rem type. Measured at 414 wide: all 382 wide, radius 20, top 10; heights copy 75,
limit 75, XP 84, level-up 87, streak 96 (week dots), terms 87 (two-line text) —
extra height only where a banner has extra content. flashLimitToast was a dark
108px-down pill; it and the terms warning now use icon + text cards (markup changed).
Hide timers for streak/XP/level-up/limit raised 220 → 340ms to outlast the slide.
XP/level-up are still switched off by SUPPRESS_XP_LEVEL_NOTIFS (checked by forcing
them visible). Replay card: "Best Match" badge and corner sparkle hidden under
`.is-replay`; conversation box is a fixed 150px (`.is-replay .yr-conv`) so adding
messages scrolls it (stays scrolled to the newest) instead of growing the card.
AI Coach: `openAiCoach(keepLinkedThread)` now unlinks by default; only History's row
tap passes `true`. The launch code also clears `zelo_ai_coach_thread` (the old exit
handler only unlinked on a clean close, so a killed app or an in-sheet link pick
survived into the next launch as a "linked conversation").

### 2026-09-24n — Replay: suggestions never edit the chat; AI Coach preview refresh; TEMP notification preview

Replay rules simplified after user feedback ("change tone changed my message and I
didn't press it"): the pink "mirror" bubble idea (state.replayMirrorIdx) is GONE. A
new suggestion (tone / new / shorter / after her message) only changes the card text
(`_replayOnReplyReady` just records `replayCurrentReply`/`replayStyle`). The
conversation and the saved scan's reply/style change ONLY on "Use this reply"
(`_replayPersist(true)`); adding/deleting messages persist the conversation only.
`_replayPersist` now also calls `renderAiCoachContext()` — the AI Coach screen sits
underneath the replay and its "Linked conversation" preview was built from the old
scan, so going back showed stale messages. Verified: browse tone → nothing changes;
Use → bubble + saved reply/style; change tone afterwards → nothing changes.
TEMP `DEV_NOTIF_PREVIEW` (script.js top; block at the very end): a capture-phase click
handler makes the FIRST tap on Dating / Crush / Other / AI Coach / Practice tab / Chats
tab show a notification and swallow the tap; the SECOND tap does the normal action and
re-arms it. Mapping: Dating→Copied, Crush→Streak, Other→XP (forced past
SUPPRESS_XP_LEVEL_NOTIFS via a new `force` arg), AI Coach→Level up, Practice→"You're out
of matches" limit toast, Chats→onboarding terms warning (cloned into #app because the
original lives inside the hidden #cine-onboarding). Remove the flag + block when done.

### 2026-09-24o — Fresh "Your Reply": add her/your message, hugging bubble, read lowered; XP preview start

XP: the REAL path (`awardXP`) already passes `before = getXP()` captured before the award, so the
bar starts from the player's actual XP and counts up — not from a fixed number. What was fixed-number
was only my temporary preview (`getXP() - 40`) and the old TEMP History hack; the Other-tap preview now
does a real-style award (setXP(+10), count-up from the true current value, XP restored ~3s later).
Verified: xp 120 → bar 120/200 → 130/200.
Fresh scan result screen (`#screen-scan-result:not(.is-replay)`): the same Add her / Add your message boxes
(`freshAddMessage`, via `replayAddMessage` when no `replayThreadId`) — a typed single message becomes the first
bubble of `state.asstConversationMessages`, so it saves with the scan; her message re-runs
`_regenerateFromResultInput`. Zelo's read moved out of the her-message box into `#yr-read-block` BELOW the add
boxes (hidden for screenshot conversations unless the user added messages: `.has-added`). The typed bubble hugs its
text (`_fitHerMessageBubble`, 15px instead of 16px — viewport meta has maximum-scale=1, if iOS ever zooms on focus
put it back to 16px in `.yr-message-input`), textarea `rows="1"`. Conversation card capped at 128px and scrolls
to the newest bubble; whole screen fits 414×896 with no scrolling (checked with 3 added messages).
GOTCHA that cost a crash screen: resizing an element from inside its own ResizeObserver callback raises "ResizeObserver
loop completed with undelivered notifications", and this app's global `error` handler shows the crash screen for any
window error — defer the work with requestAnimationFrame. Also: the "hi" test hangs unless `_confirmGibberish` is
stubbed (the gibberish guard asks about "hi"). Header divider was hard-coded #EFE5DA (bright in dark) → var(--border).

### 2026-09-24p — Two-message fixed conversation box, hold-to-delete on fresh scans, notif preview removed

The temporary notification preview (DEV_NOTIF_PREVIEW, first-tap-shows-a-notification on Dating/Crush/Other/AI
Coach/Practice/Chats) is REMOVED — those controls behave normally again; every notification still fires from its real
trigger. (`showXPPanel`/`showLevelUpPanel` keep the harmless `force` arg.) Conversation box: fixed height — 136px on the
fresh screen (applies to BOTH the typed-message box `#yr-message-combined` and the bubble card `#yr-conv`, so a lone
"hi" leaves room for two messages and adding never resizes it), 132px on the replay; more than two messages scroll with
the newest in view. Hold-to-delete (`attachReplayBubbleHold`) now also works on a fresh scan via `_holdDeletableConvo()`
(bubble-mode conversation only — the typed textarea bubble is just editable); deleting re-points `asstMessage` at her
latest remaining message and re-renders; the last remaining message can't be deleted. Verified: box stays 136px from
"hi" through four added messages, no page overflow, hold 750ms → confirm → message removed.

### 2026-09-24q — Matches tab in Skipped-Profiles style; AI Coach entry replaces Zelo's read

History → Matches now renders `_matchRowHTML(c)` using the Skipped Profiles card classes (`.skipped-row-card`,
`.skipped-row-photo` rounded square, name + age, last message, an "Open" pill styled as `.skipped-unskip-btn`, unread badge,
⋯ menu) plus an "N matches" counter. Row tap opens the chat; ⋯ → `confirmDeleteMatch()` → `onDeleteChat()` (keeps the free-tier
deleted-slot bookkeeping) → re-render. The old box-in-Home-tab-style rows are gone. On the fresh Your Reply screen the "Zelo's
read" box (`#yr-read-block`) was replaced by a compact "Ask AI Coach" card (`.yr-coach-card`, ~58px vs ~80px, carousel now starts
~24px higher) → `openAiCoachFromScan()` = `openAiCoachFromChat()` with `_aiCoachScanSheet = true`, which swaps
`_aiCoachLiveChatConversation()` for `_scanScreenConversation()` (replayConvo / asstConversationMessages / the single typed
message). The sheet's "Analyzing this conversation" card shows "Zelo's read: …" (`_analyzingScanRead`, same rule-based
`_buildZeloRead`), and the coach prompt gets the conversation as context, so follow-up questions work. The old read-hiding
CSS for has-shot was removed; the card is hidden on the replay layout (.is-replay) which has no room. Verified in Chromium: sheet
opens over Your Reply, message → AI reply, closing returns to Your Reply.

### 2026-09-25a — "Use this reply" now pops in on a fresh scan; AI Coach entry moved into the header

Bug: `copyReplyFromCard()` only ever called `replayUseReply()`, which is gated on
`state.replayThreadId` — set only for a reply opened from a saved thread. A
freshly generated scan (not yet saved) has no thread id, so "Use this reply"
copied the text but never touched `#yr-conv` — nothing popped into the her-
message box. Added `freshUseReply(text)` as the no-thread-yet counterpart:
same push-into-`asstConversationMessages` + pop-in-animation behavior as
`replayUseReply`, minus the thread persistence (that happens later, whenever
the scan itself is saved — `_saveScanPreviewMessages()` already reads
`asstConversationMessages`). `copyReplyFromCard()` now branches on
`state.replayThreadId` between the two. Verified: clicking a real card's "Use
this reply" button pops the reply into the conversation card in both light and
dark.

Per request, removed the "Ask AI Coach" card from the fresh Your Reply screen's
body (added in 2026-09-24q) — the entry point moved to the header's right-hand
button (`#scan-result-history-btn`), which used to open History; it now calls
`openAiCoachFromScan()` directly (gem/sparkle icon, "Ask AI Coach" label). Still
invisible on the replay layout (`.is-replay #scan-result-history-btn`, unchanged)
since a replay has no room and was reached through History/AI Coach already.
Removing the card's flex child freed vertical space; `.scan-result-content`'s
gap was also tightened 16px → 13px and the carousel's own top margin 14px →
10px, so Zelo Suggests sits noticeably higher. Confirmed no page overflow with
the card gone and a message added.

### 2026-09-25b — Her/You composer redesign (1:1 reference), real gem AI Coach icon, instant hold feedback

Three fixes from user pushback on 2026-09-25a:
1. **Header icon was "a random ai mockup look".** `#scan-result-history-btn`'s
   AI Coach icon (added in 25a) was a plain hand-drawn sparkle SVG directly on
   `.history-btn`'s neutral background — not the app's actual gem-icon "this is
   AI Coach" language used everywhere else (`.asst-coach-avatar`,
   `_aiCoachBrandIconHTML()`). Replaced with the same real crop
   (`assets/icons/aicoach-topics/interest.png`) + SVG fallback inside a
   `#FFE1F0`-tinted circle (`.history-btn--coach`/`.scan-result-coach-icon`,
   reusing the generic `.has-img` toggle rule).
2. **Hold-to-delete read as "still", not being touched.** Two real bugs, found
   by inspecting the actual CSS: (a) `.yr-conv-row--pressing` was scoped under
   `.is-replay`, so on a FRESH scan (no `.is-replay` class) pressing a bubble
   had zero styling at all; (b) even on replay, the transition was `ease` on
   BOTH directions (0.18s), so the press itself visibly lagged instead of
   reacting instantly. Fixed with the same "instant while held, spring on
   release" split already used by this file's drag-to-close sheets (e.g. "Link
   a thread"'s own handle): `row.style.transition = 'none'` the moment a
   finger goes down, only switching to an eased
   `cubic-bezier(0.34,1.56,0.64,1)` bounce-back transition on release/cancel/
   matured-into-delete. Verified: 60ms into a hold (test used a mouse, well
   under the 480ms threshold) the row already reads `transform:
   matrix(0.95,...)` with `transition: none`; releasing swaps in the eased
   transition and clears the pressed state.
3. **New her-message/your-message composer, 1:1 from
   `assets/icons/reply-styles/"New message box in your reply.png"`.** Replaces
   the old two-boxes-side-by-side layout (24j) on BOTH the fresh scan and the
   replay screen (same shared `#yr-add-row` markup): a segmented Her/You
   toggle with a sliding pink pill (`#yr-add-toggle-pill`, positioned via
   `getBoundingClientRect()` off the active tab — same live-rect technique as
   the bottom tab bar's `#tab-glass-pill`/`updateTabGlassPill()`), a small
   "Add her/your message ⌄" label that cross-dissolves on switch, and ONE
   input below with the send button now ALWAYS visible (the reference shows it
   even empty — supersedes 24j's "only show once typed" behavior). Switching
   sides (`setReplayAddWho()`) is a clean whole-box cross-dissolve
   (`.yr-add-box--switching`, 130ms) rather than trying to overlap two
   different-height fields mid-transition. The one send button
   (`replayAddCurrentMessage()`) dispatches to whichever side is active via the
   existing `replayAddMessage(who)`, so persistence/regeneration logic is
   unchanged. GOTCHA that cost a real bug: `_resetReplayAdd()` runs BEFORE
   `#scan-result-content.hidden` is cleared in both `generateReplies()` (the
   fetch is async) and `openScanReplay()`, so the toggle tabs read 0 width at
   that point and the pill never positioned itself (silently — the width-guard
   swallowed it). Fixed by splitting out `_armAddTogglePill()` (the actual
   double-rAF positioning call) and calling it separately at each of the 3
   spots right after `content.hidden = false` actually runs, not just once
   inside `_resetReplayAdd()`. Also found `generateReplies()`'s fresh-scan path
   never called `_resetReplayAdd()` at all (only `openScanReplay()` did) — the
   toggle was never initialized there before this fix. Verified after the fix:
   pill width matches the active tab's real rect on first paint in both light
   and dark, switching Her→You→Her updates placeholder/label/focus/pill
   correctly, sending as "You" attributes the message to `me` in the saved
   conversation, and the replay screen's version fits with zero overflow.

### 2026-09-25c — Accidental photo-picker tap, "AAdd her message" ghosting, AI Coach conversation order

1. **Tapping the her-message box sometimes opened the camera/file picker.**
   `onclick="onMessageBoxTap()"` sat on the WHOLE `#yr-message-combined` box
   (a pre-existing behavior, "tap the box to attach a screenshot" — fine when
   this box was normally empty). Now that it's usually pre-filled with real
   text people want to edit, any tap to position the cursor — including
   directly on the textarea — bubbled up and fired the same handler. Moved
   the `onclick` off the box entirely, onto ONLY the avatar icon
   (`.yr-conv-avatar--tap`, scoped to this one instance — every other
   `.yr-conv-avatar` elsewhere in the app stays inert). Verified: clicking the
   textarea or the box background no longer opens the picker; clicking the
   avatar still does.
2. **"AAdd her message" — looked like doubled/cropped text, "for You it's
   normal".** Not a crop or overlap bug — confirmed by capturing frames
   during the actual toggle transition (`setReplayAddWho()`'s crossfade):
   the label was set to fade via opacity (`.yr-add-row-label--fading`,
   0.13s) with the textContent swapped by a `setTimeout` timed to land at
   the faded-out point. Small BOLD text at low opacity mid-transition
   renders as a smudged/doubled-looking glyph (confirmed visually in a
   captured frame — this is a real, known bad case for fading small bold
   text via opacity, unlike the box's own colour/shape dip which reads
   cleanly). "Her" being the DEFAULT state (shown instantly on load, no
   transition ever played) vs. "You" only ever being reached BY transitioning
   explains the "only Her looks wrong" report — any switch back to Her had
   to pass through this same faulty animation. Fixed by dropping the label's
   own fade entirely — it now swaps instantly, no transition — while the
   toggle pill and the box's own dip/scale (both colour/shape, not small
   text) keep their motion. Lesson: opacity-fading small/bold text is a
   distinct risk from fading a colored box — verify by capturing actual
   frames mid-transition, not by eyeballing a static before/after
   screenshot, when a description sounds like garbled/doubled characters.
3. **AI Coach sheet order (Your Reply's "Ask AI Coach"):** swapped
   `_aiCoachAnalyzingCard()`'s two blocks — "This conversation" (the actual
   message bubbles) now renders BEFORE the "Analyzing this conversation"
   card, not after. One-line reorder in the template string. Follow-up:
   added `.aicoach-analyzing-card { margin-top: 18px }` for more breathing
   room between the two — the shared `.aicoach-messages` 12px gap doesn't
   reach here since both live inside one wrapped element
   (`_aiCoachAnalyzingCard()`'s own `wrap` div), not as separate
   `#aicoach-messages` children.

### 2026-09-25e — Duplicate reply bubble in "Save this scan?"

After "Use this reply" started pushing the reply into
`state.asstConversationMessages` as its own "me" bubble (2026-09-25a), going
back to the unsaved-scan prompt showed that same reply TWICE in a row.
`_saveScanPreviewMessages()` unconditionally appended `_currentReplyText()`
as a new bubble regardless of whether the conversation already ended with
that exact one — correct before 25a (the array never contained the reply
yet at that point), duplicating now that it sometimes already does. Fixed
with the same "skip if the last bubble already is this" guard already used
by `replayUseReply()`/`freshUseReply()`. Verified: use a reply, go back —
the "Save this scan?" preview shows it once.

### 2026-09-25f — Your Reply's grey borders replaced with soft shadows (Scan page's own method)

The Scan page's own cards (`.input-card`, `.scan-who-card`, `.asst-coach-banner`)
never use `border: 1px solid var(--border)` — just `background: var(--s1)` +
`box-shadow: 0 1px 6px rgba(28,25,23,0.06)`, no visible outline. Your Reply's
own boxes never picked that up and had FIVE separate grey-bordered elements
stacked down the screen: the her-message/conversation card (`.yr-conv` base
rule, and `.is-replay .preview-block` for the replay layout, which turns
`.yr-conv`'s own border off and puts one on the wrapping card instead), the
Her/You toggle (`.yr-add-toggle`), the message input box (`.yr-add-box`), the
Change Tone sheet's tone tiles (`.yr-tone`), and the fresh screen's "Copy" pill
(`.copy-btn`; the replay one already had `border:none` from an earlier pass).
All five now use that same shadow-only treatment. Two of them (`.yr-add-box`,
`.yr-tone`) still need a REAL border for their active/focus/selected state
(`:focus-within`, `.selected`) to color in without a 1px size jump — those keep
`border: 1px solid transparent` at rest instead of `none`. Verified against a
dark-mode Scan page screenshot side by side: same barely-visible-shadow, no-
outline look in dark mode too (a `rgba(28,25,23,...)` shadow reads as almost
nothing on a dark background either way — this is expected/consistent, not a
dark-mode bug, since the Scan page's own cards do the exact same thing there).

### 2026-09-25g — Settings & Home Settings: same border→shadow method

Extended 2026-09-25f's fix (Your Reply) to the Settings/Account section and
Home Settings (Practice Preferences, reached via the Scan tab's "Home
settings" gear). `.settings2-card` is the shared card class behind nearly
every settings screen (Account's own grouped lists, Personalization, Practice
Preferences, Who to Practice, Age Range, Notifications, Zelo Pro, Privacy &
Data, Retention, FAQ, Terms, Privacy Policy, About, Help & Support, Contact —
~25 usages) — removing its border there alone covered most of the screen.
Also converted: `.dash-profile-card` (the "Player #…" card), `.dash-stat` (the
3 stat tiles), `.pl-card` and `.pl-resend-row` (Profile & Login /
forgot-password), `.refer-link-row` (Refer Friends), `.settings-info-block`
(Skipped Profiles' locked banner), `.settings2-info-card` (AI & Transparency's
info rows) — same swap, `border: 1px solid var(--border)` → `box-shadow: 0 1px
6px rgba(28,25,23,0.06)`, no other property touched. Deliberately did NOT
touch `.settings2-row`'s own `border-bottom` (row-to-row dividers inside a
card) — that's a different, intentional thing (separating list items), not a
card outline, so it wasn't part of "the method" being reused. Also left
`.back-btn`/`.auth-back-btn` (shared icon-button border, consistent everywhere
in the app) and the Skipped Profiles ROW cards (`.skipped-row-card`, matches a
different, explicit user-supplied reference — see the 2026-09-24f case log
entry — changing its border isn't this fix's call to make). Verified in both
themes: cards now float via shadow only, matching a dark-mode Scan-page
screenshot side by side (2026-09-25f already established that a barely-
visible shadow in dark mode is expected/correct, not a regression).

### 2026-09-25h — "Shorter reply" replaced with "Explain why"

User's own call after being asked for options (Explain why / Share / Save to
favorites / Add emoji): "Shorter reply" duplicated Change Tone (shorter is one
of REPLAY_TONES already), so it was replaced with a small "Explain why" sheet
— reuses the same reusable no-API-cost rule-based approach as `_buildZeloRead()`
(the sheet/AI-Coach reads already built): `_buildReplyWhy(style, herText)`
combines that read with a new one-line `STYLE_WHY_BLURBS[style]` map (one
sentence per tone) and shows it in `#yr-explain-overlay`, reusing the exact
same `.thread-link-overlay`/`.thread-link-card` chrome + swipe-down-to-close
as the Change Tone sheet. `replayShorterReply()`/the `shorter` tone itself is
UNTOUCHED — still reachable via Change Tone's own grid, only the dedicated
shortcut button was removed. Verified: button gone, sheet shows a real
explanation combining her-message read + tone reasoning, Shorter still appears
in Change Tone's tiles.

### 2026-09-25i — "Explain why" now asks real AI Coach about the suggested card

Follow-up to 25h: the static rule-based sheet is GONE. "Explain why" now opens
the real AI Coach chat sheet (`openAiCoachFromScan()`) and sends an actual
message into it — `sendAiCoachMessage('Why does this reply work?')`, the exact
same send pipeline a typed question goes through (real bubble, real DeepSeek
call, "Explain more"/"Show more options" pills after, follow-up input still
open). The model needs to know WHICH suggestion is being asked about (it's a
candidate on a card, not yet a real sent message) — `_aiCoachExplainCard =
{style, text}` is stashed right after opening and folded into
`_buildAiCoachMessages()`'s system prompt as one extra sentence naming the
exact reply text + tone label, instructing the model to explain that specific
wording, not a generic answer. `openAiCoachFromScan()` clears
`_aiCoachExplainCard` on every open — confirmed a later PLAIN "Ask AI Coach"
tap (the header button, same function) never carries a stale card reference
from an earlier "Explain why" tap in the same visit. Verified end to end with
a mocked reply: real user/assistant bubbles in the chat UI, system prompt
contains the card's exact text and tone, context clears on a plain reopen.

### 2026-09-25j — Download My Data: real 3D icons cropped from the user's reference sheets

User dropped three files in `assets/icons/settings/`: `First data.png` (folder+arrow,
light|dark side by side), `After data.png` (document+clock, light|dark), and
`Reference not for cropting, data.png` (full-screen mockup of both states — measure-only,
NOT for cropping). Ask was icon only, text untouched. The screen (`#screen-settings-download-data`)
only HAS the first state ("Request Data"); its icon was an empty 64px pink circle
(`.settings2-icon--xl`). There is NO "We're preparing your data" state in the app (no
markup, no JS) — so the second icon (`settings2-data-preparing.png`/`-dark.png`) is cropped,
installed and registered in `ICONS_WITH_DARK_VARIANT` but not displayed anywhere yet.
Crop method (script kept at `assets/icons/_source/build_data_icons.py`): both halves share
one crop rectangle (centred on the union content bbox, 600px square → 300px) so the theme
swap can't shift the icon. DARK = real alpha from the black bg: source bg is ~10, not 0, so
alpha = clip((max(rgb)-bg)/(150-bg)) and colour = (p-(1-a)·bg)/a (continuous at a=1 — a plain
p/alpha with a bg offset leaves a visible ring in the glow). LIGHT = feathered OPAQUE crop
(gain so the ring median → 255, smoothstep to pure white over the outer 40px) — the
saturation/segmentation alpha used for the chat-bubble icons FAILS here: the light document
body is (254,225,237), sat 0.11, indistinguishable from the ground glow and the bg. Page bg in
light mode is #fff so opaque is invisible. Sizing measured from the reference (scale 1.98 px/pt
from the 44pt back button): artwork ≈ 88pt wide, 21pt below the header line, 24pt above the
text. Rendered result (Playwright, 430×932): 88.0pt wide, 21.5pt, 24.0pt, centred to <1pt.
The crop's built-in padding + the shared `.settings2-layout--centered` padding-top pushed it
~23pt too low, so the fix is negative margins on `.settings2-data-hero` only (that layout
class is shared with other screens). Dark swap verified (`src` → `-dark.png`).

### 2026-09-25k — Download My Data: multi-step flow + email/check icons
- User asked to add the "Third data" (envelope+check) and "Fourth data" (pink check circle) icons and wire the full flow from `Complete flow reference.png`. Icons cropped from the user's own light|dark sheets with `assets/icons/_source/build_data_icons.py` (JOBS/THR/ONLY args; thr 90 for the envelope so the crop centres on the solid body, not the wide glow) → `settings2-data-email` / `settings2-data-submitted` (+ `-dark`), registered in `ICONS_WITH_DARK_VARIANT`.
- One screen (`#screen-settings-download-data`), five `[data-dd-step]` containers toggled by `ddShowStep()`: request (original text untouched) → confirm (masked account email `oz••••@gmail.com`, no re-entry) → preparing → submitted → ready. Back arrow: confirm → request, else leave screen. Signed-out → `AUTH.requireAuth('download-data', …)`; auth.js `_navigate` resumes it after OAuth reload.
- Request stored in localStorage `zelo_data_export_request` `{t,email,status}`. **No email is actually sent**: `_ddSubmitRequest()` is a 1.8s simulated wait (seam for a future edge function). "Your data is ready" only shows when a backend sets status `'emailed'`. `exportAccountData()` kept but no longer wired.
- GOTCHA: `AUTH` is a top-level `const`, NOT `window.AUTH` — use `typeof AUTH !== 'undefined'`, never `window.AUTH && …` (the latter is always falsy; existing line in the AI-coach status code has this latent issue).

### 2026-09-25l — Download My Data: change-email link + 24h cooldown
- Confirm step: "We'll email you when it's ready." moved directly under the email chip; bottom footnote replaced by a "Use a different email" text button (`ddChangeEmail()` → `openSettingsProfileLogin()`). NOTE: there is no in-app change-email flow — Profile & Login's Email row does nothing when an email is already connected, and only offers "Connect" when none exists.
- 24h cooldown: `_ddCooldownLeft()` reads `zelo_data_export_request.t` (written only after `_ddSubmitRequest` resolves, so a failed submit never locks the user out). While active, `openDownloadData()` / `ddRequestData()` / `ddConfirmRequest()` / `ddRequestAgain()` show the `cooldown` step ("Data request already submitted", disabled Request Data button, live "Available again in 18h 42m", ticks every 30s). After 24h the normal request step returns. Local-only — a real backend should enforce it server-side too.

### 2026-09-25m — Download My Data audit fixes
- Leaving the screen mid-"preparing" used to `clearTimeout` the submit → request silently lost though the user was told it was submitted. Removed; the record is always written, UI only advances if still on `preparing`.
- Double-tap on Confirm created two submits → `ddConfirmRequest` returns unless `_ddStep === 'confirm'`.
- Cooldown record now only applies when `rec.email === AUTH.currentEmail()` (a different account on the same device isn't blocked).
- No verified email → "Confirm & Request" is disabled (was a silent no-op) besides the inline message. Cooldown label shows "24h" not "24h 0m".
- Known/accepted: on 375×667 the confirm step scrolls ~30px to reach "Use a different email".

### 2026-09-25n — TEMP: Download My Data request resets on every launch
- User wants to re-test the flow, so `script.js` clears `zelo_data_export_request` at load (marked `TEMP (testing)` next to `DD_KEY`). **Remove that line before release** or the 24h cooldown never survives an app relaunch.

### 2026-09-25o — Download My Data: one-off destination email + 15 min cooldown
- "Use a different email" no longer opens Profile & Login. It swaps the email chip for an input on the confirm step (`ddChangeEmail`/`_ddRenderEditing`, link toggles to "Use my account email"/"Cancel"; lede text switches). Validated with `_ddValidEmail`, lowercased. The account email is never changed — only this request goes to the typed address. Record is now `{t, email (account, drives the cooldown), to (destination shown masked on submitted/cooldown/ready), status}`.
- Accounts with no email can now request by typing one (Confirm disabled until they do).
- `DD_COOLDOWN_MS` = 15 minutes (was 24h — user: paying users shouldn't wait a day); countdown ticks every 15s. The TEMP launch-time reset (2026-09-25n) is still in place.
- SECURITY NOTE for the future backend: the typed address is unverified, so anyone holding a signed-in session could mail an account's export to any address. Server should verify it (e.g. one-time code to the new address) before sending.

### 2026-09-25p — Download My Data: "Done" instead of "Go Back"
- Submitted step's button is now "Done" and no longer leaves the screen: `ddDone()` → `ddShowStep('cooldown')` ("Data request already submitted"). Leaving via the back arrow and reopening within the cooldown lands on that same state (existing `openDownloadData` behavior).

### 2026-09-25q — cooldown step title
- "Data request already submitted" → "Data request submitted" (the step Done and re-entry land on). Cooldown-step comments/notes elsewhere may still say "already submitted".

### 2026-09-25r — Home widgets + their inside screens: grey borders → soft shadows
- Same Scan-page method (no border, `box-shadow: 0 1px 6px rgba(28,25,23,0.06)`). Widget carousel cards: the grey outline overlay (`.widget-card::after`, only shown while `.chrome-visible`) lowered from opacity 1 → 0.4 — kept as a faint hairline rather than removed because `.widget-carousel-track` has `overflow:hidden` + `contain:paint`, which would clip a box-shadow on the card edge.
- Your Journey: `.journey-stats-card` (shadow), `.journey-dot--upcoming` (border removed). Mission Control: `.mission-level-card`, `.mission-stat-tile`, `.mission-missions-card`, `.mission-bottom-card` (shadow), `.mission-row-check--todo` (border removed). Leaderboard: non-active `.lb-cat-card` (shadow; border is `transparent` so `.active`'s accent border doesn't change size).
- Row dividers (`.journey-stat-row`, `.mission-row`) kept but softened to `color-mix(in srgb, var(--border) 45%, transparent)`.
- Deliberately kept: accent/pink borders (active leaderboard hero card, XP pills, "my rank" bar), header back/icon buttons, header divider lines, `.lb-list-row` hairlines, and the dark-mode-only outlines from the earlier dark-mode pass (`.journey-progress-card`, `.lb-settings-panel`, headers) — cards there sit on imagery/dark bg where shadow alone vanishes.

### 2026-09-25s — Scan history default 30 days; age range no default preset
- `DEFAULT_RETENTION_DAYS = '30'` replaces the hard-coded '7' fallbacks (Privacy & Data preview, Scan Retention selection, HTML preview). Only users who explicitly picked another value keep it. NOTE: nothing in the app actually prunes scans by `zelo_history_retention_days` yet — it is UI/preference only.
- Age Range: the '18-24' fallback is gone (`zelo_age_range` empty → no radio selected; Practice Preferences shows "Any"; swipe deck already falls back to all PROFILES). `settingsPrefsAgeSelect` toggles: tapping the selected preset clears it (removes the key; slider left as is).
- Tooling GOTCHA: /tmp/zelo_pw_test was wiped between sessions (macOS tmp cleanup). Playwright scripts now live in the session scratchpad with `npm i playwright-core`; server: `cd www && python3 -m http.server 8936`.

### 2026-09-25t — PostHog analytics (behavior events only)
- Plugin check (done first, as asked): `@capawesome/capacitor-posthog` exists on npm, v8.6.2, last published 2026-09-10, Capacitor >=8 (this project is 8.4.2), peer `posthog-js` — active, so used (no posthog-js fallback needed). It is reached like the other native plugins: `window.Capacitor.Plugins.Posthog` (no bundler). `npx cap sync ios` added it to `ios/App/CapApp-SPM/Package.swift` (pulls posthog-ios via SwiftPM) — **native change: needs an Xcode rebuild**, a web-only sync won't include it.
- `services/analytics.js` = `ZeloAnalytics.track(event, props)`. Allow-list of the 30 agreed events and their allowed property keys; anything else is dropped; only numbers/booleans/strings ≤40 chars pass. No identify() — PostHog's anonymous id only. Session replay, exception capture, surveys, flags and plugin lifecycle events are OFF. Inert unless `window.ZELO_POSTHOG.apiKey` (config.js) is set AND running natively. A key not starting `phc_` is refused (a `phx_` key is a secret personal API key — never ship it; the user pasted one in chat, it was NOT written to any file). The Settings "Do not sell" toggle also calls `ZeloAnalytics.setOptOut()`.
- Wired: step_completed/step_abandoned/onboarding_finished (`cineGoTo`, visibilitychange while onboarding shows, `cineFinishOnboardingLanding`), scan_started/scan_completed (`generateReplies`/`_onReplyRevealed`, source text|screenshot, demo scans skipped), tone_selected (carousel settle + `replayPickTone`), reply_regenerated (`replayGetNewSuggestions`), persona_selected (right-swipe in `commitSwipe`), practice_session_started/ended (`startChat`/`openChatFromStore`/`exitChat`; "finished" = ≥ `PRACTICE_FINISHED_MIN_MSGS` (5) user messages, chats have no end state), xp_earned/level_up (`awardXP`), paywall_viewed (trial-start, offer, History paywall), restore_purchase_tapped, ad_watched (mock ad), referral_link_shared, app_opened/app_backgrounded/session_length (analytics.js).
- NOT wired because the app has no such feature/trigger: reply_favorited, reply_shared, reply_reported, streak_incremented, streak_broken, badge_earned (streak/badge progress is static 0), trial_started, subscription_started, payment_failed (no StoreKit purchase flow — the trial button just moves on), ad_skipped, referral_signup_completed. They're in the allow-list so wiring later is one `track()` line.
- Test: Playwright with a mocked `Capacitor.Plugins.Posthog` recording setup/capture/optOut calls (config.js intercepted with a `phc_` test key).

### 2026-09-25u — PostHog switched ON (project key + simulator run)
- `config.js` now holds the PUBLIC project key (`phc_…`, meant to ship in apps) with the US host. Validated non-destructively before wiring: POST `https://us.i.posthog.com/flags/?v=2` → 200; same key on the EU host → 401 (so the project is US). The `phx_` (personal) and `phs_` (secret) keys the user pasted earlier are NOT in any file and should be rotated.
- Full simulator build (`xcodebuild … -sdk iphonesimulator -derivedDataPath <scratch>`; bundle id is `com.ozlilbrother.zelo`, not com.zelo.app) succeeded; on an iPhone 17 Pro sim the WebView saw `Capacitor.Plugins.Posthog` registered, a native anonymous distinctId, and `capture()` resolved. Actual arrival in PostHog can only be confirmed in PostHog's own UI (Activity / "Waiting for events") — not visible from here.

### 2026-09-26 — PostHog privacy audit (no code changed; build stays 2026-09-25u)
- Autocapture is OFF. The Capawesome plugin exposes NO autocapture option; it builds `PostHogConfig` itself and sets `captureScreenViews=false`, `sessionReplay` from our `enableSessionReplay:false`, `errorTrackingConfig.autoCapture` from our `autoCaptureExceptions:false`, `captureApplicationLifecycleEvents`/`preloadFeatureFlags`/`surveys` from our setup(). `captureElementInteractions` (iOS's element autocapture) is never set → SDK default `false` (posthog-ios 3.84.1, PostHogConfig.swift). So it is off by default, not explicitly set — re-run this audit after any posthog-ios/plugin upgrade (Package.resolved / `^8.6.2`).
- Wire-level proof: a patched scratch build (config.js pointed at a local sink, never the project) ran the real app with canary strings in the scan input, `asstMessage`, conversation, chatStore names/messages and reply cache; the sink received 12 events, 0 canary bytes, no `$`-prefixed events (no `$autocapture`/`$screen`/`$snapshot`/lifecycle). Properties were exactly the allow-list. Scan/persona/level_up/step_abandoned/lifecycle verified through Playwright real code paths with a mocked plugin (network mocked; canary replies).
- Auto-attached by the SDK on every event (not content): app name/version/build, OS name/version, device model/type/manufacturer, `$device_name` ("iPhone"), screen size, locale, timezone, wifi/cellular flag, session id, anonymous distinct id, `$is_testflight/$is_emulator`, `$process_person_profile:false`. PostHog also derives coarse location from IP server-side unless "Discard client IP data" is enabled in project settings.

### 2026-09-26 — Supabase content/compliance schema (migration written, NOT applied)
- `supabase/migrations/20260926120000_content_and_compliance_tables.sql` adds generated_replies, onboarding_responses, consent_records, referrals, reports, account_deletions (owner-only RLS, anon revoked). Parses with pglast (52 statements); never run against a database. Apply with `supabase db push` after diffing the live schema.
- Existing state found: repo has ONE migration (profiles delete policy + api_rate_limits). Its comments say scans/threads/matches/messages also exist live with RLS, but the client only ever touches `profiles`; all scans/threads/chats live in localStorage. The local supabase CLI is logged in to a different account (only project: ozlilbrother-trades), so the live Zelo project (bfxxywxhydxvccusjinm) could NOT be inspected from here.
- No retention/auto-delete exists anywhere: the edge functions store nothing (they only console.error rate-limit failures), and the app's "Scan history retention" setting is a preference that nothing enforces. New tables deliberately have NO raw-input column (only input_source) so the raw-content retention job is not needed unless that changes. consent_records/account_deletions have no FK/cascade on purpose (proof outlives the account) — confirm with counsel. Nothing in the app writes to these tables yet.

### 2026-09-26a — consent_records + generated_replies wired; 90-day reply retention
- **Migrations NOT applied.** Two files in `supabase/migrations/`: `…120000_content_and_compliance_tables.sql` and `…130000_generated_replies_retention.sql` (`purge_old_generated_replies()`, default 90 days, pg_cron daily 03:17 UTC, guarded if pg_cron is unavailable; execute only for service_role). MUST be run against the ZELO project `bfxxywxhydxvccusjinm`. The local supabase CLI is logged into a different account (project `ozlilbrother-trades`), and `supabase/.temp/project-ref` points at Zelo — so `supabase db push` from here would fail auth or (worse, if someone re-links) hit the wrong project. Check `supabase projects list` shows `bfxxywxhydxvccusjinm` before pushing, or paste the SQL into Zelo's dashboard SQL editor. Until applied, the client writes fail silently (consents stay queued).
- `services/records.js` (`ZeloRecords`): `recordConsent(type, granted)` queues to localStorage `zelo_pending_consents` (consent is given BEFORE sign-in in onboarding), flushes when there is a session (`AUTH.currentUserId()`, on SIGNED_IN, and at init for a returning user) using client-generated ids + `upsert(ignoreDuplicates)` so retries never double-write; failures stay queued (cap 50). `POLICY_VERSION` is a PLACEHOLDER ('2026-09-26') — set it to the real published-policy version. Consent points wired: onboarding terms checkbox (`cineProviderTap`), auth-sheet signup (`handleEmailSubmit`), and Settings "Do not sell" toggle → `analytics` (granted = !value). NOT wired (no UI exists): `ai_processing`, `sensitive_content`. Analytics currently defaults ON with no consent screen — flag for legal.
- `saveGeneratedReply` runs at the 3 places a fresh scan reply lands (`generateReplies`, `_ensureStyleFetched`, `_regenerateFromResultInput`), storing only input SOURCE (text|screenshot) + tone + the AI output; never the pasted text/screenshot/conversation. Skipped: demo scans, saved-scan replays (original source unknown), the "Couldn't reach Zelo" fallback text, signed-out users. `SAVE_GENERATED_REPLIES` is a kill switch. Copy buttons set `was_copied`. Prefetched next-card replies are saved too (rows ≠ cards the user actually saw). `was_favorited` stays false (no favorites feature).
- Tested with a mocked supabase client (signed-out queueing, failing server keeps queue, success clears it, exact payloads, canary text never in any write). Still to do by you: apply migrations, then verify a real row appears in Zelo's tables.

### 2026-09-26b — Sign-in opens the app; db write status on the build stamp
- "Already have an account? Sign in" (first screen) used to open the sign-in sheet with NO pending callback, so after signing in the user was left on the onboarding screen underneath ("bounces back to onboarding"). Now `AUTH.startSignIn(cineEnterAppAfterSignIn)` (new, auth.js) registers a callback: on SIGNED_IN it marks onboarding done and runs `cineFinishOnboardingLanding()` (no onboarding_finished analytics event — the done flag is set first). Also `_onSignedIn`: when local setup isn't marked done and there's no onboarding name/age, it first restores the server profile and skips the name/age setup screen if one exists (fresh install / cleared storage / other device); only accounts without a profile still see setup. Verified with a mocked SIGNED_IN: overlay hidden, Scan tab active, setup skipped.
- DEV diagnostic: `ZeloRecords` writes its last outcome onto the bottom build-stamp line (`... | db: reply saved / reply NOT saved: signed out / reply error: <msg> / consent queued (signed out) / reply not saved: demo/replay`). Exists only while `SHOW_BUILD_STAMP` is true. Reason: with empty tables after a signed-in scan the failure was invisible. Note typing exactly "how's your day going" is the demo trigger and is intentionally never saved.
- Dev auto-sign-in still falls back to anonymous (disabled on the project) → the app starts signed out each launch unless `dev-credentials.js` is filled in or the user signs in.

### 2026-09-26c — First-screen "Sign in": account -> app, no account -> onboarding
- Product rule (user): Sign in = sign in first. Has an account -> signed in, lands in the app. No account -> onboarding. `AUTH.startSignIn(cb, onNoAccount)` (auth.js) opens the sheet with `_pending = {destination:'signin', cb, onNoAccount}`. (1) The sheet's toggle reads "New to Zelo? Get started" and `toggleEmailMode()` closes the sheet and runs `onNoAccount` (= `cineShowcaseStart` → onboarding step 1) instead of switching to an in-sheet sign-up form. (2) `_onSignedIn`: no local setup and no onboarding name/age → restore the server profile; profile exists → skip setup + `cb` (`cineEnterAppAfterSignIn`); NO profile (e.g. a brand-new Apple/Google account — OAuth can't tell "sign in" from "sign up") → `onNoAccount` → onboarding. (3) Because that user is already signed in when onboarding reaches its sign-up step, `startFromOnboarding` now calls `_insertProfileFromOnboarding()` (writes profiles row from zelo_display_name/zelo_user_age) before continuing — `_onSignedIn` won't fire again. Supabase returns the same "Invalid login credentials" for a wrong password and an unknown email, so a failed email sign-in cannot auto-route to onboarding (would dump wrong-password users into it) — the "Get started" link is the route.
- NOT built: "expired paid version -> enter the app but can't use anything". There is no subscription data to detect expiry (`isPaidUser()` is hard-coded `true`, no StoreKit, no server subscription field; only a local `zelo_trial_start`). Needs a real entitlement source first; then a locked mode keyed on `isPaidUser()`.

### 2026-09-26d — "Sign in" always opens the sign-in page
- `AUTH.startSignIn` had an `if (signedIn()) { cb(); return; }` shortcut (copied from `requireAuth`). A session saved on the device by an earlier Xcode run is still valid on the next launch, so tapping the first screen's "Sign in" skipped the page and went straight into the app. Removed: the sheet always opens; the callback only runs after a real SIGNED_IN. Verified with a pre-existing session: tap -> sheet open (heading "Sign In"), onboarding still up; completing sign-in -> app. (In dev the first screen shows on every launch because `zelo_onboarding_done` is wiped at load; a real user with a saved session never sees it.)

### 2026-09-26 — Why nothing saved: missing GRANTs (migration 20260926140000)
- Symptom: signed-in scans hit Supabase (api_rate_limits filled) but generated_replies/consent_records stayed empty. Probe (unauthenticated GET, no writes) showed the tables exist on the Zelo project (`bfxxywxhydxvccusjinm`) and answer `42501 permission denied … Grant the required privileges to the current role`. Root cause: migration 120000 enabled RLS/policies and revoked from anon but never `GRANT`ed to `authenticated`; new tables on this project are not auto-granted to the API roles, and Postgres checks GRANTs before RLS. Fix: `20260926140000_grant_table_privileges.sql` (grants match each table's policies: consent_records/referrals/reports/account_deletions select+insert only; generated_replies/onboarding_responses full CRUD; service_role all). Confirmation still pending: the build-stamp `db:` line should read `reply saved` and a row should appear after the grants run. LESSON: any new public table on this project needs explicit GRANTs in the same migration as its RLS policies.

### 2026-09-26e — "Help Zelo get smarter" (practice-chat sharing consent) + practice session saving
- UI: new row "Help Zelo get smarter / Let us review some of your practice chats" in Privacy & Data between "Download my data" and "Delete my account" (nothing else on that page changed — the reference's different list layout was deliberately NOT followed, per user). Detail screen `#screen-settings-help-smarter` (toggle + 3 bullets + "Conversation sharing turned off" note once explicitly off) and first-practice-chat modal `#practice-review-modal` (floating card, X / "Not right now" = declined, "Yes, help improve Zelo" = accepted; shown once EVER, after the pace modal, never during the onboarding demo chat; fires from `selectChatMode` and `openChatFromStore` via `maybeShowPracticeReviewModal`). Measured from `Help improve chat ref.png` / `Chat ref help.png`: bullet box is ~4% pink (254,247,251), not `--accent-soft`.
- Assets: bullet icons cropped from `settings/icons for chat help ref.png` → `settings2-help-chat|eye|gear(.png/-dark.png)` via `assets/icons/_source/build_help_icons.py` (LIGHT = colour-to-alpha vs white so they sit on the tinted card without a white box; DARK = alpha from black). Modal hero = existing `misc/chat-bubble-hero.png` (transparent; art only in x147-922/y384-1045 of 1024x1536, positioned with CSS).
- Data: one consent, two entry points. `zelo_practice_review` ('true'|'false') + `zelo_practice_review_asked`; every choice appends `consent_records` `practice_content_review` (granted true/false). `_trackPracticeEnd` → `ZeloRecords.savePracticeSession`: `practice_sessions` row (metadata only: persona, difficulty, mode, start/end, user message count, finished/abandoned) ALWAYS; `practice_messages` (chat TEXT) only when opted in at session end. Migration `20260926150000_practice_sessions_and_messages.sql` also enforces it in the DB: a practice_messages insert is rejected unless the user's latest practice_content_review consent is granted (client flushes consents first). It includes its own GRANTs (lesson from 20260926140000). NOT APPLIED yet.
- OPEN DECISIONS (flagged to user, not assumed): (1) opting out does not delete text already saved; (2) no retention/purge for practice_messages; (3) deleteAccount() only deletes the profiles row (auth user + cascades not removed); (4) opt-in survives only locally — a reinstall re-asks (server consent is not read back into the toggle); (5) text is uploaded at session END, so a killed app loses that session's text.

### 2026-09-26f — Help modal polish + compliance fixes (user's 5 answers)
- Modal (`#practice-review-modal`): now centred on screen (was a lower card), ✦ removed from the title. Dark mode reads as a floating layer instead of a hole: elevated surface (`color-mix(--s1 90%, #fff)`), a light-catching GRADIENT hairline (bright top-left → fades → pink at bottom-right, via padding-box/border-box double background — not a flat grey border), deep shadow + faint pink bloom, scrim 62% black. Two-part dark pattern (media query + `[data-theme="dark"]`).
- User decisions implemented in `supabase/migrations/20260926160000_consent_withdrawal_retention_account_deletion.sql` (NOT APPLIED — user must run it in Zelo's SQL editor): (1) consent withdrawal deletes that user's practice TEXT — a trigger on `consent_records` (`practice_content_review` granted=false → delete practice_messages), so it can't be skipped by a failed client call; practice_sessions metadata stays. (2) `purge_old_practice_messages()` 90 days, pg_cron daily 03:27 (guarded if pg_cron missing). (3) `delete_my_account()` RPC: writes account_deletions, deletes every public base table with a `user_id` column (multi-pass, retries FK-blocked tables — the pre-existing scans/threads/matches/messages schemas aren't in the repo), referrals (referrer rows deleted, referred link nulled), profiles, then `auth.users`. AUDIT FINDING: before this, `AUTH.deleteAccount()` only deleted the profiles row and signed out — the auth user and all other tables stayed and the FK cascades never fired; api_rate_limits had no FK and was orphaned. consent_records/account_deletions are kept on purpose (proof, id only) — confirm with counsel.
- Client: `AUTH.deleteAccount()` now calls the RPC and returns `{error}`; on failure it does NOT wipe local storage or pretend — `confirmDeleteAccount` shows "Couldn't delete your account…". UNTIL THE MIGRATION IS APPLIED the RPC doesn't exist, so account deletion will show that error. (4) `ZeloRecords.syncPracticeConsent()` (after consent flush, on sign-in and at init with a session) reads the latest server `practice_content_review` and writes `zelo_practice_review(_asked)` locally so a reinstall doesn't re-ask; a still-queued local choice wins. (5) incremental saving of a chat killed mid-way: NOT done, low priority (text uploads at session end).
- Not changed: the "Conversation sharing turned off" note text (reference copy) doesn't mention that previously shared text is now deleted — suggested to the user, their call.
- Verified with mocks only (never against the real DB): server-granted / server-declined / queued-choice-wins; delete failure keeps everything + toast; delete success → wipe + reload. Ended the day with the SQL untested against Postgres beyond a pglast parse.

### 2026-09-26g/h — Sign-in page fixes, Help modal review switch, LOCKED app (expired subscription)
- Sign-in with email (`services/auth.js`, index.html `#auth-email-step`): password dots smaller once typed (`#auth-password-input:not(:placeholder-shown)` 12px + letter-spacing; placeholder stays 16px), spacing between Sign in / Forgot password? / New-to-Zelo (`.auth-email-step-foot` flex column + margins), and SPECIFIC errors via `_friendlyAuthError` (no account found / wrong password / bad email format / offline / rate limited / already registered / weak password) using `public.email_exists()` (migration …170000; anon-callable → deliberate ACCOUNT-ENUMERATION trade-off chosen by the user; without the function the app falls back to "Email or password is incorrect."). Forgot password is now a real page inside the auth overlay (`#auth-forgot-step`: form → "Reset link sent!" with 60s resend), it had only been a tiny inline message that needed an email typed first; unknown emails get "No account found".
- TEMP `DEV_ALWAYS_SHOW_PRACTICE_REVIEW` (script.js top) makes the "Help Zelo get smarter" modal show on every practice chat so its UI can be reviewed; set false before release.
- Practice text empty in DB: verified through the REAL screens (swipe → match → chat → send → back arrow) with a mock DB — session + all messages saved. Text uploads only when the chat is LEFT (back arrow / edge swipe → `exitChat`) — chatting and then checking Supabase without leaving shows nothing. Bottom build-stamp `db:` line says what happened.
- LOCKED MODE (user's plan, "same as Cal AI"): `subscriptionExpired()` (script.js next to `isPaidUser`) is the ONE hook for a real entitlement later; today it reads `DEV_SUBSCRIPTION` / localStorage `zelo_dev_subscription`, flipped by a TEMP switch row on Settings > Zelo Pro (`DEV_SHOW_SUBSCRIPTION_SWITCH`). When expired: `showTab` (any tab but Scan/Home) and `pushScreen` (anything not in `LOCKED_ALLOWED_SCREENS` = dashboard, refer-friends, journey, milestones, milestone-category, paywall, trial-start, offer, and every `settings-*`) show `#screen-paywall` instead; `generateReplies` and `openHistory` call `subscriptionGate()` first (no API call / scan credit spent); `awardXP` returns 0. Home widgets: Streak → Journey opens, Activity/Leaderboard → paywall. The paywall shows "No thanks" immediately when locked (normally it waits for the full reveal). `paywall_viewed` analytics uses screen 'locked'. The streak itself is untouched (there is no real streak logic yet — Journey is static/view-only). "closePaywall → popScreen → showTab(activeTab)" would loop for a locked user on a non-Home tab, so the gate resets `state.activeTab` to 'assistant'. Assumption: the user's "redirects to the screen recording all again" = the paywall. Real detection (StoreKit/server) is still TODO.
- Verified with Playwright: active user unaffected; locked user: Practice/Chats tabs, Generate, History, Mission Control, Leaderboard, AI Coach, Match, Chat, Scan-type → paywall (0 API calls); Journey, Account, Settings sub-pages, Milestones, Streak widget open; XP frozen; unlocking restores everything.

### 2026-09-26i — Help modal back to once-only
- `DEV_ALWAYS_SHOW_PRACTICE_REVIEW` set back to `false`: the "Help Zelo get smarter" modal shows once on the first practice chat again (the server-side consent sync still prevents a re-ask after reinstall). The 7-day/3-day trial code (`FREE_LIMITS.trialDays`, `isWithinTrial`, `isColdAvailable`, `ensureTrialStarted`) is untouched — user: no longer used, keep it just in case.

### 2026-09-26j — Locked screen = the screen recording, Continue -> normal onboarding paywall
- Every blocked tap while `subscriptionExpired()` now goes to `showLockedScreen()` (`#screen-locked`: title "Keep going with Zelo" — PLACEHOLDER copy —, the same phone demo video as onboarding step 15 (`assets/video/onboarding-showcase-demo.mp4`) and a Continue button; NO trial copy). Continue -> `cineShowTrialStart()` = the normal onboarding paywall (`#screen-trial-start`, "Start your 3-day FREE trial…"); an X (added — not asked for, but without it a locked user could not get back to Settings/Streak) -> `popScreen()`. From the onboarding paywall, while locked, back / offer-close / continue-claim all `popScreen()` back to the app instead of `cineGoTo(15)` / the landing loader (no purchase system yet, so Continue does not unlock; use the Zelo Pro dev switch). The old `#screen-paywall` is still what Settings > Zelo Pro > "Change Plan" opens. The 7-day trial code is untouched.

### 2026-09-26k — matches + messages tables, save-on-background, chat placeholder
- Why `matches`/`messages` looked empty: they are OLDER live tables the app never wrote to; practice data went to `practice_sessions`/`practice_messages`. Migration `20260926180000_matches_and_messages_names.sql` (NOT APPLIED until the user pastes it): renames old `matches`→`matches_legacy`, old `messages`→`messages_legacy` (data kept), then `practice_sessions`→`matches` and `practice_messages`→`messages`; re-creates `purge_practice_text_on_withdrawal()` and `purge_old_practice_messages()` against `public.messages`. It aborts with an error unless 20260926150000 ran first (so the withdrawal/retention functions can never touch an old messages table). RLS/policies/grants/FKs follow the rename. `services/records.js` now writes `matches` (metadata, always) and `messages` (text, opted-in only). `delete_my_account()` still covers all of them (dynamic user_id loop). Run order: 150000, 160000, 170000, 180000 (all idempotent).
- Second reason rows "never appeared": a chat only counted as saved when LEFT; checking Supabase means backgrounding the app mid-chat. Now `visibilitychange` (hidden) calls `_trackPracticeEnd(true)`: saves everything said so far (metadata + opted-in text) and keeps tracking from there, so a chat backgrounded N times is N rows each holding only its own stretch — no duplicates (verified: background → 4 messages; leave → only the 2 new ones).
- Chat input report ("grey message text overlaps the keyboard, not spelled right"): could NOT reproduce with the English keyboard in the iOS simulator (layout above the keyboard is clean, QuickType bar normal); typing into the simulator was not possible (System Events/AppleScript hung — don't retry that route). All 84 canned girl replies/openers were spell-checked against /usr/share/dict/words: only valid words missing from the list plus deliberate slang ("mhm", "rly"). Applied a safe fix for the most likely cause: `.message-input:focus::placeholder { color: transparent }` so the grey "Message…" placeholder cannot show under typed/composing text (known to linger behind marked text, e.g. Thai keyboard). Asked the user for a screenshot / which keyboard if it persists. `words-dict.txt` in the repo only has ~28 words — useless as a spell-check source.

### 2026-09-26l — Data round 2: onboarding answers, reply feedback, AI request log, JS crash reports
- Migration `20260926190000_onboarding_feedback_ai_tracking.sql` (NOT APPLIED until pasted): unique (user_id, question_key) on onboarding_responses; `generated_replies.outcome` ('helped'|'not_helped') + `outcome_at`; new `ai_requests` table (user_id, kind, model, prompt/completion tokens, latency_ms, ok, error_kind — NO content; owner select/insert only; 90-day purge fn `purge_old_ai_requests` + pg_cron 03:37; covered by `delete_my_account()`'s user_id loop).
- #1 onboarding answers: `ZeloRecords.queueOnboarding(cineAnswers)` on every `cineGoTo` and at finish → localStorage snapshot → upsert on sign-in (same flush points as consents; `flushConsents` now also calls `flushOnboarding`). Uploaded: gender, source, overthink, help (JSON array string), tone. NOT uploaded: `attracted` (≈ sexual orientation = special-category data; needs explicit consent first — do with the consent screen) and `referral` (a code). Wait on consent before adding `attracted`.
- #3 reply feedback: "Use this reply" (`copyReplyFromCard`) → `scheduleReplyFeedback(replyId)` → pending list (`zelo_reply_feedback_pending`) + ONE local notification id 9101 at +3h ("How did your reply land?" / "Tap to tell Zelo if it helped." — never message text), max one per local day, only if `LocalNotifications.checkPermissions()` is already granted (never prompts). The card `#reply-feedback-modal` (👍 It helped / 👎 Not really / Skip) shows for due items on app open, on foreground and on notification tap (`maybeShowReplyFeedback`; not during onboarding/other modals/locked; expires 7 days after due) — so denied notifications still get the in-app card. Answer → `generated_replies.outcome`, PostHog `reply_feedback {outcome}`, cancels the notification. Only replies that have a `generated_replies` id (signed-in, real scans) are asked about.
- #4 AI cost/failure: `_aiInvoke(fn, options, kind)` replaces the 4 `functions.invoke` call sites (kinds chat_reply, ocr, scan_reply, coach; the health probe is untouched) and logs to `ai_requests` + PostHog `ai_request` (kind, ok, latency_ms, tokens, model, error_kind) — client-side because edge-function deploys are blocked (tokens come from `data.usage`; slightly spoofable, fine for analytics). Crash reporting: the global error/unhandledrejection handlers now send PostHog `app_error {kind:'js', name, where:'fn@file:line'}` — NEVER the message text (it can echo user input). Native `autoCaptureExceptions` deliberately stays off (unverifiable payload; native crashes are covered by App Store Connect's free crash reports).
- New PostHog events allow-listed: ai_request, reply_feedback, app_error. Canary test (private text in prompts, replies and error messages) confirms none reaches the DB writes or PostHog.
- OPEN LOOSE ENDS: (a) the "finished vs abandoned" cutoff (`PRACTICE_FINISHED_MIN_MSGS = 5`) is arbitrary — sanity-check it against a few real sessions (`matches.message_count`/`outcome`) before trusting it; (b) RevenueCat: the user pasted a secret key (`…msk_…`/sk) and a `test_…` public key in chat — the secret is NOT stored anywhere and should be rotated; `test_…` is RevenueCat's Test Store key (real App Store purchases need the `appl_…` iOS public key); (c) #5 analytics consent screen — draft wording sent to the user for approval, not built; then PostHog identify + `attracted` upload.

### 2026-09-27a — Password field: same box/position as email, only the dots smaller
- Follow-up to the 09-26g dot-size fix: shrinking `#auth-password-input`'s font-size to 12px also shrank its whole box (line-height "normal" scales with font-size: 52px → 47px tall) and left the dots sitting low/uneven versus the email field above it. Fixed on the shared `.auth-input` class (all 8 uses: sign-in, sign-up, Add Your Email, Forgot Password ×2, etc.) with `height: 52px` (fixed, so a smaller font-size can't shrink the box) + `display: flex; align-items: center` (centers the value regardless of font-size, instead of relying on line-height math). Verified in light and dark: both fields now exactly 52px, dots vertically centered in line with the email text — only the dot size itself changed, nothing else moved.

### 2026-09-27c — Onboarding's own email "Sign in" now matches the front-of-onboarding one
- Bug: onboarding step 14 ("Continue with email") lets you toggle to "Sign in" (`AUTH.toggleEmailMode()`), but a successful sign-in there was mishandled by `_onSignedIn()`: since onboarding's step 1 already saved a display name + age locally, the "no setup yet + local name/age present" branch always fired regardless of whether this was actually a NEW signup or a SIGN-IN to an EXISTING account — it tried to INSERT a brand-new profile row (using the just-typed-in-onboarding name/age, silently failing against an existing row) and then just continued onboarding one more step (`cineAuthStub`), never recognizing the real account or landing in the app.
- Fix: `handleEmailSubmit()`'s sign-in branch sets a one-shot flag `_pendingIsOnboardingSignIn` when `_pending.destination === 'onboarding'`; `_onSignedIn()` consumes it once. When true: skip the insert-from-onboarding-answers branch entirely, restore the account's REAL profile the same way the front "Sign in" does, and finish via `_finishAsOnboardingSignIn()` (= `cineEnterAppAfterSignIn()`, marks onboarding done + lands in the app) instead of `_resolvePending()` (which would just advance onboarding). Sign-UP from the same screen is unaffected. The already-existing front-of-onboarding "Sign in" flow is unaffected (verified as a regression check). Scope: EMAIL only — Apple/Google sign-in vs sign-up ambiguity mid-onboarding is a separate, already-documented issue (2026-09-26c).
- Verified with Playwright: (A) onboarding email sign-in with a real profile → overlay hidden, onboarding marked done, real name/age loaded, lands on Home, zero fake profile inserts. (B) onboarding email sign-UP → unchanged, continues onboarding, inserts the new profile. (C) front-of-onboarding sign-in → unchanged.

### 2026-09-27d — "Continue with email" always shows the form; front-slide sign-in stays in onboarding (TEMP, testing)
- Root cause of "continue with email skips filling in the email": `AUTH.startFromOnboarding(provider, cb)` had `if (signedIn()) { _insertProfileFromOnboarding().finally(cb); return; }` for ALL three providers — once any session was already open (very easy in repeated Xcode testing, since a session persists across runs), tapping "Continue with email" at onboarding step 14 skipped the whole email/password form and just silently advanced onboarding. Fixed: that shortcut now excludes `provider === 'email'` — Apple/Google (one-shot native flows) keep it, but "Continue with email" always shows the real form, letting it also be used to sign IN to a different/existing account, not just skip straight through.
- TEMP `DEV_ONBOARDING_SIGNIN_STAYS` (script.js, near `cineShowcaseSignIn`): the FRONT-slide "Sign in" (Showcase → email) now stays wherever onboarding currently is instead of entering the app (`cineStayInOnboardingAfterSignIn()` — a no-op; `_hideAll()` already closes the auth sheet before it runs) — lets the user sign in first, in Xcode, no console, then manually walk the rest of onboarding while already signed in so `onboarding_responses` uploads live as they go. **This reverses 2026-09-26c/d's "sign in -> app" behavior while the flag is true** — flip `DEV_ONBOARDING_SIGNIN_STAYS` to `false` to restore it once testing is done. Step 14's own email-sign-in (2026-09-27c, `_finishAsOnboardingSignIn`) is UNCHANGED — it still enters the app, since that only matters once the user is already deep in onboarding with real answers already queued.
- Verified: (A) already-signed-in session + tap "Continue with email" at step 14 → the form shows (`auth-email-step--show`). (B) front-slide sign-in with real credentials → onboarding stays up at step 0, tab stays on Home, `zelo_onboarding_done` NOT set, the auth sheet itself still closes (`auth-overlay.hidden === true`), and `cineGoTo()` can continue normally afterward.

### 2026-09-27e — Clearer table names; reply feedback tied to save/don't-save
- Full accurate table list confirmed via unauthenticated existence probes (401 "permission denied" = exists; PGRST205 "not found" = doesn't — anon has no data-level access to any of them, RLS blocks unauthenticated reads regardless of GRANTs). Migration `20260927200000_rename_tables_for_clarity.sql` (NOT APPLIED — one paste, on the user's clipboard) renames: `generated_replies`→`scan_replies`, `matches`→`practice_sessions` (undoing 20260926180000's rename — user found "matches"/"messages" more confusing, not less, once `matches_legacy`/`messages_legacy` sat next to them), `messages`→`practice_messages`, `ai_requests`→`ai_usage_log`, `reports`→`content_reports`, `matches_legacy`→`legacy_unused_matches`, `messages_legacy`→`legacy_unused_messages`. ALSO renamed two PRE-EXISTING tables that predate this project (`scans`, `threads` — schema unknown, this app has never written to them; `scans` was specifically what the user meant by "scan table, I see nothing in it") → `legacy_unused_scans` / `legacy_unused_threads` — flagged as slightly different risk (not ours, can't rule out an unknown external consumer of that exact name, though a rename doesn't touch data/FKs). Re-created `purge_practice_text_on_withdrawal()`, `purge_old_practice_messages()`, `purge_old_generated_replies()` against the new names; pg_cron jobs re-scheduled under matching names. `services/records.js` updated to the new names throughout.
- Reply feedback ("How did your reply land?") moved from the "Use this reply" tap to the save/don't-save-scan decision (`confirmSaveScan()` / `declineSaveScan()`) — user: they don't always tap "Use this reply", but always eventually decide to save or discard the scan, so that's the more reliable and more meaningful moment to ask. Ties to whichever style is currently shown (`state.asstStyle`) at that moment. `was_copied` tracking on "Use this reply" is unchanged/unrelated.
- `FB_DELAY_MS` 3h → 15 minutes (user: with a lot of scans already done, hours later they won't remember which reply this was about).
- Root cause of "I can't find the result in the table": very likely the old trigger (many scans are never explicitly "used" via that button) combined with testing before this build. Verified end to end with the REAL screens (scan → generate → save; practice chat → send → back) against a mocked DB using the NEW names: `scan_replies`, `ai_usage_log`, `practice_sessions`, `practice_messages` all receive the right rows; "Use this reply" alone no longer schedules feedback.
- Claude's own DB read access: confirmed (again) that only the anon key is available here, which RLS blocks from returning any actual row content (only enough to prove a table exists/doesn't, via the 401-vs-PGRST205 distinction above) — Claude cannot currently read real table contents to summarize/audit them. Told the user their options (paste/export data when they want a summary; a scoped Supabase Management API personal access token if they want Claude checking directly and ongoing) and left the choice with them.

### 2026-09-29 — EXPO_MIGRATION_SPEC.md addendum (§13): real visual-fidelity gaps found once the Expo build ran
- A separate Claude Code session has been driving the actual Expo/React Native port against `EXPO_MIGRATION_SPEC.md` (Phase 1 doc, written 2026-09-27). The user compared a real Expo screenshot against this app and found several visible gaps; I added a precise addendum (§13) rather than guessing, with exact measured values pulled from this repo's own CSS/assets: the card border→box-shadow convention (`box-shadow: 0 1px 6px rgba(28,25,23,0.06)`, no visible border — this was a genuine omission in the original spec's §7/§8, very likely the direct cause of "grey lines" showing up in Expo), the Scan FAB's exact 58px/4px-white-ring/±34px-offset spec, "Get Suggestions"'s `border-radius: 999px` pill shape (Upload Screenshot is only 8px, genuinely more squared — not a bug), the AI Coach avatar's 56px size (tuned up from 40px specifically for being "too small" once before — don't let Expo regress back), the widget carousel's fixed 170px/34px-radius card, and the confirmed real `AppIcon-1024-new.png` source path.
- Diagnosed the likely cause of "badly cropped… white curvature" on Settings icons: several were deliberately cropped OPAQUE (no alpha) because the source art's own background already matched the app's exact `#ffffff`/`#15130f` page background — this only stays invisible if Expo's icon container is that exact same color; any off-white/themed surface will show the crop's own square/curved edge. No original (pre-opaque-crop) source exists to redo these with real alpha if that turns out to be the actual fix needed.
- Relayed (not independently verified — I don't have the Expo project's path) that session's own reported status: Phase 3 services + initial screens ported, a real `expo lint` tooling bug found (it silently lints zero files on a plain React-Navigation project, masking 16 real ESLint errors), bundle ID kept as `com.zelo.app` (vs. this app's real `com.ozlilbrother.zelo`), splash/camera-permission/no-connection-screen reportedly ported, table names reportedly verified against the live DB with no mismatches. The pasted transcript was cut off mid-session — final build/lint outcome unconfirmed as of this entry.

### 2026-09-30 — EXPO_SIZES_SPEC.md + EXPO_SIZES_DATA.json: real measured geometry/typography for the Expo port
- User asked for a dedicated .md covering ONLY sizes/positions/fonts (not behavior) for the other Claude session's Expo port, pinned to iPhone 11. Built with Playwright at `viewport:414×896, deviceScaleFactor:2` (iPhone 11's exact logical-point size) against the real running app — `getBoundingClientRect()` + `getComputedStyle()` on every element, not values copied from CSS source (source uses rem/em, so this captures the real rendered pixel).
- **The standard, stated explicitly in the doc:** this app's viewport meta (`width=device-width, initial-scale=1.0, viewport-fit=cover`) makes 1 CSS px = 1 iOS point on-device, which is also exactly what RN `StyleSheet` numbers mean on iOS — so every number in the doc is usable in Expo with zero conversion factor.
- Covers: a global type-scale table (98 distinct size+weight+letter-spacing+line-height combinations actually rendered, with real examples, sorted largest→smallest), corner-radius tokens, the border→shadow card convention (cross-ref to the migration spec's §13.1), and per-element x/y/w/h/radius/font/color/bg/shadow/border/padding tables for 8 priority screens: tab bar, Scan/Home, Practice deck, Chat, Account dashboard, Privacy & Data (representative settings row screen), onboarding step 1, AI Coach sheet.
- Full raw JSON (every captured property, unabridged) saved alongside as `EXPO_SIZES_DATA.json`.
- Explicitly NOT covered (stated in the doc, not silently omitted): the other ~36 screens (most reuse the same measured shared components, but screen-specific content on them isn't captured), dark-mode color values (light mode only; sizes/positions are identical), animation timing (that's §8 of `EXPO_MIGRATION_SPEC.md`).

### 2026-09-30b — Same two files: comprehensive re-audit after the user caught two real gaps
- User directly tested the first pass: "does it cover the grey outline of widgets and the header size?" Checked honestly — both were genuinely missing, not just hard to find in the doc. Root causes were two different failure modes: (1) `.screen-header` (the shared bar reused on ~35 sub-screens) was simply never in the original selector list for the two Settings screens measured — a plain oversight; (2) the "grey outline" isn't on the widget-card element at all — the card itself legitimately has `border:none`/`shadow:none` — it's a separate `::after` pseudo-element overlay, invisible to `querySelectorAll`-based measurement by construction (pseudo-elements aren't DOM nodes). Fixed both (`getComputedStyle(el, '::after')` is the correct API for reading pseudo-element styles).
- User's follow-up — "says a lot that there's more things similar to this missing so update all again" — was treated as an instruction to audit the whole category, not just patch the two named items. Two systematic checks, both run to completion: (a) grepped `EXPO_SIZES_DATA.json` for every `(screen, label)` pair that scored zero elements in the original sweep (found 8: Practice deck's photo/name, Chat's header/bubbles, Onboarding's photo circle, AI Coach's header/avatar/chips/composer — all caused by guessed-wrong class names that silently returned empty instead of erroring); (b) grepped the entire stylesheet for every `::before`/`::after` rule with real visual properties (found ~20 beyond the widget-card one: toggle-switch knob via `transform: translateX`, swipe-card back-stack mask, gradient fades on Journey hero and the age roller, the AI Coach status-dot pulse halo, ~6 checkmark glyphs drawn with the CSS border-trick, tutorial sparkle/dim overlays, the Download-My-Data checkmark, the referral-steps connector line, the "or" divider lines).
- Re-measured all of it with the real corrected selectors (found by reading the actual markup/functions instead of guessing: `.chat-back-bar`, `.msg-row.user/.ai`, `.swipe-card-photo`, `.swipe-card-name`/`.swipe-card-occ`, `.cine-avatar`, and the AI Coach sheet's real structure `#screen-ai-coach → .aicoach-main → .aicoach-header/.aicoach-messages/.aicoach-suggest-panel/.aicoach-input-bar`, plus discovering AI Coach opens as a partial-height sheet rather than a normal `.screen.active` push, which is why it scored zero the first time). Also added a "Toast / notification banner" section (`.limit-toast`, previously uncaptured). Both `EXPO_SIZES_SPEC.md` and `EXPO_SIZES_DATA.json` (under a new `followUpAudit` key) were updated in place with everything found — not just the two originally-named items.
- Audit method is the reusable part for future "did you actually check everything" pushes: (1) diff the zero-result labels against the real markup instead of re-guessing selectors, (2) grep the stylesheet for the DOM-invisible category (pseudo-elements) rather than trusting element-based measurement alone. Worth reapplying if the user raises this kind of doubt again on other generated specs.

### 2026-10-01 — EXPO_INTERACTION_SPEC.md: the third spec file, after watching the Expo session burn multiple rounds on one widget
- The user relayed several real build/debug rounds from the other (Expo) Claude Code session fixing one widget's pink divider + grey touch-outline — diagnosed live, in order: (1) a corner-radius clipping bug (RN needs `overflow:'hidden'` to clip on `border-radius`; CSS doesn't — the real `.widget-card` has no `overflow` set anywhere in its chain, confirmed by grep), (2) a second, separate hard clip boundary on the carousel TRACK (not the card) sized to exactly 170px, which a cosmetic tweak (thicker/lower divider) blew past, (3) a wrong mental model of the touch-outline trigger (told them "fade in on touch, fade out on release" — wrong; the real mechanism is touchstart shows it for a flat 3s timer that resets on retouch, independent of release, confirmed via `_showWidgetChrome()`/`_hideWidgetChrome()` in script.js), (4) an outline color bug (0.4 opacity must be on the whole overlay layer, not baked into the border's own alpha — `#ECE5DA` at 40% over white ≈ `#F7F5F0`, much softer than it looks at full border-alpha), (5) a tap-outside-doesn't-always-close bug traced to RN's touch-responder system not guaranteeing bubbling the way a DOM `pointerdown` listener does.
- The Expo session's own retrospective (relayed by the user) asked for exactly three things going forward: reconciled computed totals (not just CSS rule text), CSS mechanisms flagged BEFORE implementation not after breaking, and complete interaction state machines given in one message instead of fact-by-fact per bug report. Built `EXPO_INTERACTION_SPEC.md` directly against that ask: §1 is a CSS→RN gotcha checklist (overflow/clipping, transform-tied-to-asset-dimensions, margin collapsing, line-height/font-metric differences, pseudo-elements, `position:sticky`, non-bubbling touch events — each with the real example that surfaced it this session); §2 is full state machines for the shared, highest-reuse patterns found by reading `script.js` directly: drag-tied panel+scrim (transform/opacity driven live off raw drag delta, not binary — ties to the standing gesture-driven-transitions rule), edge-swipe-back (width-relative threshold, spring-ease snapback, tab-bar fade synced to live drag progress), the swipe deck (90px threshold, 15° max rotation, 6px tap-vs-drag cutoff, real easing curves for spring-back vs. fly-off), the widget-carousel chrome-timer (corrected per point 3 above), a timing catalog of every toast/panel auto-hide in the app (mostly converging on a 340ms standard dismiss), and the 500ms long-press threshold used for every row-action menu.
- Scoped honestly in the doc's own text: covers shared/reusable mechanics only, not a screen-by-screen catalog of every one-off interaction — same discipline as `EXPO_SIZES_SPEC.md`'s stated coverage limits. Added a one-line cross-reference between all three Expo docs (`EXPO_MIGRATION_SPEC.md` now points to both companions) so a fresh reader of any one of them finds the other two.

### 2026-10-01b — Closed 3 named gaps in the spec set before handing it off for a real test
- After drafting a test prompt asking the Expo session to self-assess against all 3 docs, flagged 3 real gaps honestly instead of claiming completeness: only 8/44 screens measured, `EXPO_MIGRATION_SPEC.md` §14's open punch-list items explicitly needing fresh measurement, and dark mode/on-device-animation-feel unverified. User asked to close what's actually closable before sending the prompt.
- Closed with real Playwright measurements (not guesses): the Scan header's actual wordmark child (`.scan-page-brand`, 33.6px/800/pink — already correct in source, just wasn't broken out from the generic header container before, which is likely why Expo recreated it wrong), the real onboarding skip button position (`.cine-showcase-skip`, x:370 y:14 w:30 h:30 — sits only 14px from the top, unlike normal step content), the REAL onboarding "Notifications" step (`.cine-sysprompt`, step 11 — a deliberate iOS-permission-dialog mockup, not the Settings app notifications-preferences screen, which I measured first and had to correct for), a full Settings > Notifications screen sweep (a genuinely separate, previously-unmeasured screen, kept as a bonus even though it wasn't the punch-list item), the Scan tab's real total content height (690px of an 896px viewport, closing the "1.5 of 3 vs 2.8 of 3" scale-bug debate with a real number instead of a ratio guess), the widget-carousel-to-header gap (18px, real), and a full dark-mode color-token table (6 tokens, confirmed structurally identical to light mode — only colors swap).
- Left honestly open: on-device animation *feel* (whether RN's easing curves actually look like the cubic-beziers copied from CSS) cannot be verified without seeing the Expo app render — stated plainly as a hard limit, not something fixable from this side, rather than claiming a fix that can't be checked.
- All punch-list items marked `[x] Measured (not yet applied)` rather than `[x] Fixed` — the Capacitor-side data is now real and complete for these items, but the Expo code itself hasn't been touched (can't be, from this session) — important distinction to keep so the checklist doesn't overstate what's actually done on the Expo side.

### 2026-10-01c — Formalized the Expo session's own "mechanical rule set" proposal, closed its one named gap
- The Expo session, after several repeat-bugs (divider, info-button position, card radius), self-diagnosed the actual root cause correctly: not bad measurements, but *re-deriving* a different number from a measured one by eyeballing proportions. Proposed a mechanical rule set (copy numbers literally, never recompute; a sum-check for fixed-height containers; treat an unmeasured value as a hard stop, not a guess; absolutely-position the two highest-bug screens — swipe deck and widget carousel — inside a fixed 414×896 frame with one outer uniform-scale wrapper instead of flex) and asked whether to write it up as a formal doc or just relay the message as-is.
- Chose to formalize it rather than just relay: added a "Mechanical rules" section to `EXPO_SIZES_SPEC.md` (right after the measuring-standard intro) with all 4 rules verbatim-equivalent, and cross-referenced it from `EXPO_INTERACTION_SPEC.md`'s CSS-gotcha section.
- Closed the one concrete gap the proposal named: icon/glyph insets were never measured, which is exactly why Expo's icon proportions were never going to be right. Read the real swipe-card markup in `script.js` (`_cardHTML()`, ~line 2020) — every icon is a literal inline SVG with explicit `width`/`height`/`viewBox` and real path data (sparkle 12×12, info-glyph 14×14 centered in a 26×26 circle, skip/like 16×16 with 7px gap to their labels) — these port straight to `react-native-svg` with the same path data, zero proportion-guessing needed. Added full specs + real measured insets to `EXPO_SIZES_SPEC.md`.

### 2026-10-01d — Found and fixed a real self-inflicted ambiguity in the swipe-deck spec itself
- The Expo session, applying the mechanical rule set honestly, flagged that `EXPO_SIZES_SPEC.md`'s Practice section listed two different `.swipe-card` boxes (`45,253,324,554` and `27,167,360,615`) under one unlabeled "top card" row — read as a contradiction (one would extend 25px past the deck container) and correctly refused to silently pick one and guess, asking for it to be resolved before implementing the deck's outer layout (which they'd skipped — they'd only applied the fixed-canvas/copy-the-number approach to internal icons, not the card's own box, and said so plainly rather than overclaiming).
- Root cause, confirmed via `style.css`: `.swipe-card { position: absolute; inset: 0; }` — all 3 stacked cards (`data-stack="0"/"1"/"2"`) share ONE identical untransformed box (exactly the deck container's own box). Every visible size/position/opacity difference comes entirely from `transform: scale()+translateY()` + `opacity` per `data-stack` (0: none/1/z3, 1: `scale(.95) translateY(10px)`/.75/z2, 2: `scale(.90) translateY(20px)`/.5/z1), `transform-origin: 50% 110%`. Verified the math directly: `360×0.90=324` ✓, horizontal shift `(360×0.10)/2=18px` ✓ — both match the "contradictory" row exactly, confirming it was `getBoundingClientRect()` baking a parent's resting-state scale into what read as a standalone measurement, not a capture bug. Same root cause was also silently present in the card-internals tables (photo/badge/name/buttons each had 2-3 "different-sized" rows for one real button, e.g. `#btn-skip` measuring 157×50 real vs. 149×48/141×45 for the same button inside the scaled-down duplicate cards).
- Fixed by rewriting the whole Practice section: one row for the real (stack-0, `id`-bearing) box/buttons, one small table for the 3 stack transform states, explicit math proof, and an RN port note (absolutely-position one card component, apply `transform: [{scale},{translateY}]` + opacity by stack index — flagging `transform-origin` RN-version support as a thing to check, since `50% 110%` needs to be hand-computed into `translateY` if unsupported).
- Grepped the whole stylesheet for every other resting-state `scale()` usage to confirm this pattern isn't hiding elsewhere in the already-measured screens — confirmed `.swipe-card[data-stack]` is the ONLY resting-state multi-instance scale-stack; every other `scale()` in the file is `:active` press-feedback or a one-shot animation keyframe, neither of which creates this ambiguity. Added a permanent rule (§ of "Mechanical rules" in `EXPO_SIZES_SPEC.md`): multiple rows of the same class with different `w`/`h` is itself a stop-sign to check for a parent transform, not a measurement to just report as-is.

### 2026-10-01e — Found the real root cause of the Expo "hallucination" reports: an entire real flow was never documented
- User reported the Expo build as "very bad... all mechanic is bad" across the Practice tab's first-visit tutorial (wave icon, "confirm your profile," "Edit Details," swipe-lesson icons, photo-nav icons) and asked directly whether the fault was this side's `.md` specs or the other session's implementation.
- Investigated honestly before answering either way: grepped `script.js`/`index.html` for the actual tutorial flow (`startPracticeTutorial()`, `#practice-tutorial-welcome` → `#practice-confirm-profile` → `#practice-edit-details` → swipe-right/left lessons → photo-nav lesson) and found it's a REAL, fully-built, asset-backed 6-step flow — confirmed the actual PNG assets exist on disk (`tutorial-waving-hand.png`, `tutorial-swipe-right/left.png`, `tutorial-last/next-photo.png`). **This entire flow was never in any of the 3 Expo spec files** — not even flagged as a known gap the way onboarding steps 2+ were. Verdict given to the user plainly: this one is on this side, not the Expo session — they were building an entire real, asset-backed flow completely blind, which is why they substituted invented placeholders (a wave emoji instead of the real hand image, Unicode/vector chevrons instead of the real last/next-photo PNGs, the wrong back-button component — `.screen-header`'s 44×44 instead of the real `.cine-back` 52×52 already used here) — not malicious invention, unavoidable guessing with zero real spec to check against.
- Fully measured and documented the whole flow for the first time: welcome screen, confirm-profile screen (reuses the exact onboarding `.cine-avatar` component + 3 decorative sparkle dots), edit-details screen (reuses `.cine-back` 52×52 + real `.settings2-card`/`.settings2-row`), swipe-right lesson (overlay + real `tutorial-swipe-right.png` + title/sub), swipe-left lesson (mirrored, smaller hand image — confirmed a genuinely different/smaller source asset, not just a flipped copy), photo-nav lesson (dim overlay + divider + the two real last/next PNGs, confirmed NOT chevron icons of any kind). Added to `EXPO_SIZES_SPEC.md`. Also documented the one critical BEHAVIOR fact in `EXPO_INTERACTION_SPEC.md` §2.6: the tutorial's swipe lessons overlay directly on the REAL live deck and reuse the REAL `commitSwipe()`/`springBack()` — there is no separate mock card and no "rebuild" transition when the tutorial ends, since the real deck was underneath the whole time. If Expo's build visibly rebuilds/transitions after the tutorial, that's a sign the tutorial was built as a separate mock screen instead of an overlay on the live deck component — an architecture fix, not a timing tweak.
- Also raised independently by the Expo session during this same exchange, worth preserving: two apps both named "Zelo" are installed on the test phone (`com.ozlilbrother.zelo` = the real Capacitor app, `com.ozlilbrother.zeloexpo` = the one actually being edited) — a real, recurring risk of testing/reporting against the wrong app. The Expo session's own build-stamp text (bottom-left of screen) is the way to confirm which app and which exact build is on screen before trusting any "this isn't fixed" report.

### 2026-10-01f — Packaged the methodology as a Claude Code skill; added a spec index; added press-state data
- User asked to (1) save the measurement/conversion methodology as a reusable skill since "this converter works," (2) add press/active-state feedback ("how it should look if you press a button") as a documented category, not just resting-state geometry, and (3) asked whether merging all 3 Expo spec files into one would be better. Asked the user directly via AskUserQuestion rather than guessing on the two real decision points (merge vs. index, and how to pace "do the rest for all ~36 remaining pages"); user chose a master index over a merge, and explicitly scrapped the full-sweep-all-pages idea for now.
- Built `web-to-rn-conversion` as a Knowledge-type skill (auto-activate: true) in the SHARED `VSC/.claude/skills/` directory (not project-scoped) specifically so it's usable from both this Capacitor repo and the Expo repo. It holds the reusable PROCESS only — measuring standard, the 5 mechanical rules (copy-don't-recompute, mandatory sum-check, unmeasured-value-is-a-stop-sign, same-class-different-size-is-a-stop-sign, fixed-canvas-absolute-position for non-scrolling screens), the CSS→RN gotcha table, and the new press-state capture technique — zero Zelo-specific data, which stays in the 3 existing files.
- Added `EXPO_SPEC_INDEX.md` — a short pointer file explaining what's in each of the 3 detailed docs and when to read which, plus a note to invoke the new skill first.
- Added a new "Press / active states" section to `EXPO_SIZES_SPEC.md` covering every already-documented interactive element's real `:active` CSS feedback (read directly from source — all are simple `scale()`-only rules, no ambiguity requiring a fresh Playwright pass): most primary buttons/cards/pills use a subtle `scale(0.92–0.99)`, while list/settings rows use a background-color flash instead, never a transform. Also surfaced that `.cine-back`/`.cine-avatar`/`.ptw-start-btn` are shared components reused identically across onboarding step 1 AND the Practice tutorial screens documented last entry — consistent with the "same component, multiple contexts" pattern already established for `.screen-header`.

### 2026-10-05a — Milestones redesign: new hub, badge sheet, share sheet (40 badges, new art)
- Replaced the old Milestones hub, the per-category page (`screen-milestone-category`), and the badge-detail overlay with one flow: streak pill / Journey "Explore Badges" → `screen-milestones` (summary + one section per category, 3 badges across, `ms-section-divider` between sections) → tap badge → bottom badge sheet (`badge-sheet-overlay`, greyscale art + "Locked" disabled button when locked, "Share" when unlocked) → share sheet (`badge-share-overlay`, category-tinted gradient, Instagram/Messages/Save/More/Copy row).
- Art: 8 category sheets cropped from `assets/icons/Streaks milestones/` (light = white sheet, dark = black sheet, each cropped from its own background), 5 per category = 40 badges. Stored as `assets/icons/milestones/<cat>-<n>.png` with `-dark` siblings, whitelisted in `ICONS_WITH_DARK_VARIANT`. Also cropped: day-streak flame + gem (hero + stat icons, light/dark), the 0–9 digit glyphs (used for every displayed count), and the five share-row app tiles. Outer background flood-filled to transparent (interior white inside the digit glyphs is enclosed by pink, so it survives).
- Data (`data.js`): Revival (`cold`) and Consistency categories and their 10 badges removed. Each badge has `icon` mapping to its art slot. Streak thresholds follow the art (1/7/14/30/100) per the user, names kept from before.
- Old assets archived, not deleted: `design-refs/unused-icons-archive/milestones-replaced-2026-10-05/{badges,milestone-categories}`. Removed the old streak popup (`openStreakPopup`) since the pill no longer opens it. Journey strip now shows streak-2/3/4 + progress-1 (Consistent → Hot Streak). Count text 0/40.
- Verified in Playwright at iPhone 11 viewport, both light and dark color schemes: 40 tiles, 8 sections, 3 columns, 7 dividers, zero broken milestone images, badge sheet and share sheet open, Journey badge images load. Remaining console 404s (`archive/legacy-onboarding.js`, `words-dict.txt`, Supabase root) predate this change.
- Found and fixed mid-run: the share-row crops clipped the tile bottom (crop band ended above the tile edge) and the digit/hero crops had visible background boxes; both re-cropped / keyed before sign-off.
- Open for the user: badge names are the old ones (e.g. "On Fire" now means 7 days); locked sheet label reads "Badge Locked" (reference shows "Badge Unlocked" over a locked button); the share row's Instagram/Messages/Save/More/Copy icons have light-theme art only; "Practice Milestones" from the reference is shown as "Conversation Milestones" (the category name).

### 2026-10-05b — Milestones layout pass + Mission Control / Journey icon swap
- Milestones top bar now uses the same padding as Mission Control's header (`14px 20px 6px`), with no extra safe-area inset (the `.screen` already supplies the status-bar offset). The back button sits at y=50, matching Mission Control. Content moved up with it.
- Badge sheet and share sheet are now full-height (`height: calc(100% - 52px)`, sheet top at y=52, same as the AI Coach chat sheet). Share sheet uses a category-accent gradient at the top. Locked badge art in the hub is greyscale (`.ms-badge--locked`).
- New icons from `Streak, Mission control, icons change.png` (light and dark), cropped with transparent backgrounds into `assets/icons/mission/` and whitelisted for the dark swap: check, chat, envelope, scan, match (hearts), trophy. Mission Control's This Week tiles now show Convos (chat), Msgs (envelope), Scans (scan), and Match (hearts) in place of Revivals. The bottom Streak card uses `hero-streak-flame.png` and Rank uses the trophy. The Journey "right path" today dot uses the check instead of the fire.
- Found and fixed mid-run: the new stat-tile images had no size rule, so they filled the page; capped to 22px in `.mission-stat-ic img`.
- Verified in a browser: back button at y=50 on both Milestones and Mission Control, sheets at y=52, 40 locked tiles, Mission Control labels read Convos/Msgs/Scans/Match, Journey check loads, no page errors.

### 2026-10-05c — AI Coach "Add your conversation" card; swipe-down sheets; streak share; white journey check
- AI Coach's empty state (no linked conversation) now shows the "Add your conversation" card with three tiles: Paste Message (focuses the existing `#aicoach-input`), Upload Screenshot (the existing `#aicoach-photo-input` picker), and Link Chat (the existing `openThreadLinkPicker()`). The info mark on Link Chat shows a toast. Icons: `assets/icons/aicoach-add/`, cropped from the reference sheet. That sheet is black-background (not white), so alpha comes from brightness and the icons are re-tinted to the accent pink. The card replaces the old "No thread linked" row. The greeting now reads as in the reference, and thread wording in the picker and context row is now "conversation" (code identifiers unchanged).
- Badge sheet and share sheet close on swipe down: the sheet tracks the finger, closes past 110px or on a fast flick, and otherwise springs back. Verified with synthetic touch events: a 40px drag stays open, a 220px drag closes.
- Share: the hub's top-right share opens the DAY STREAK share page (flame with the digit overlapping its base, share row), matching the reference. Badge share uses the same sheet with badge art, name, and category. Both use the category/accent gradient.
- Journey "right path" today dot: fire replaced with a white check, matching the done dots. The earlier pink-circle check and its unused crop were removed.
- Found and fixed mid-run: a replacement dropped the badge open/close helpers. Restored from the original block. Caught by the browser check, not by the syntax check.
- Open for the user: the share page's "Started on …" line is replaced with "Keep your streak alive" (no start date is stored); the Paste Message tile focuses the input rather than opening a separate paste sheet, since none existed.

### 2026-10-05d — AI Coach add-conversation icons (light/dark), Paste Message clipboard, chat cleanup, practice info size
- Add-conversation icons re-cropped from the two reference sheets as light (`aicoach-add-*.png`, white sheet) and dark (`-dark.png`, black sheet) pairs, no transparency, swapped by theme via `ICONS_WITH_DARK_VARIANT`. Tiles are `var(--bg)` with the standard soft shadow so the icons' own backgrounds blend with the tile instead of showing a box.
- Paste Message reads `navigator.clipboard.readText()` and fills `#aicoach-input` when there's text, then focuses it. With no clipboard text (or permission denied), it just focuses the input.
- Practice chat header: removed the "Instant" mode pill (element and its three `textContent` writes) and replaced the three-dot button with the Practice header's gear SVG, same `openChatSettings()` handler. Removed the grey border under the header (`.chat-back-bar`), above the message box (`.chat-input-bar`), and around the AI bubble. The bubble keeps its shape with the card's soft shadow.
- Practice card info button: 26px → 40px, glyph 14px → 22px.
- Verified in a browser, light and dark: practice info is 40px, chat has no grey borders and no mode pill, the gear is in the header, Paste fills the input from a mocked clipboard, and the icon swap works in both themes with no page errors.
- Open for the user: Paste Message fills the input rather than sending on its own. On device, iOS may show its own paste confirmation. The gear uses `openChatSettings()`, which is what the three dots opened.

### 2026-10-05e — Practice info white, gear border removed, back card peeks, chat-row dividers removed
- Practice card info button background: `var(--s2)` (beige) → `var(--s1)` (white in light mode).
- Practice header gear: removed its 1px border (`.settings-btn`).
- Practice deck: stack-1 (the one card behind) is now full opacity, offset 14px down, with the card's soft shadow, so its bottom edge shows above the tab bar while swiping. Stack-2 is `display:none` (one card behind is what was asked for).
- Chats list: removed the bottom divider on `.chat-row`.
- Verified in a browser: gear border 0px, info background white, stack-1 present and stack-2 hidden, no page errors. The chats-list divider change is a single-rule edit and was not visually checked (no seeded chats in the test).

### 2026-10-05f — Gear buttons match Account's back button; info icon 44px with readable dot; visible card behind; Chats header gear
- `.settings-btn` (Practice gear) and `.chat-settings-btn` (in-chat gear) now use the same 44px circle as Account's back button: `var(--s1)` fill, `1px solid var(--border)` ring, `var(--text)` icon.
- Practice info button: 40px → 44px, glyph 22px → 26px, dot radius 0.6 → 1.3 so the dot is visible.
- Practice deck: the card behind is now visible. `.card-deck` margin-bottom 16px → 36px lifts the top card off the tab bar. Stack-1 is `translateY(22px)`, `background: var(--s2)` (beige), with a stronger shadow. Its back-of-stack mask uses `var(--s2)` so it reads as blank. Stack-2 stays hidden.
- Chats tab header: the empty right-hand spacer is now a 44px `.settings-btn` gear with no action yet. Its behaviour is still to be decided.
- Verified in a browser: info button 44px, gear border 1px, in-chat gear 44px with border, Chats gear present, card-behind visible in the screenshot, no page errors.

### 2026-10-05g — Card behind shows its real layout
- The back-of-stack mask on stack-1 (`::after`) hid all of its content, so it looked like a blank beige band. Stack-1 now has `display:none` on the mask, the white card surface, a stronger shadow, and `pointer-events:none` so it can't be tapped. Its bottom section (name, occupation, Skip / I'm Interested) shows under the top card.
- Spacing: `.card-deck` bottom margin 36px → 52px, stack-1 `translateY(22px)` → `34px`, so the card behind has room to show.
- Stack-2 stays hidden (`display:none`).
- Verified in a browser: the card behind's buttons appear under the top card with no page errors. The visible strip is about 60px.

### 2026-10-05h — Practice deck back to original spacing; card behind keeps its real layout
- Reverted `.card-deck` margin to `4px 0 16px` (original) and stack-1 offset to `translateY(10px)` (original scale 0.95 kept).
- Kept from the last round: stack-1 has no back-of-stack mask, so its content shows; white card surface; `pointer-events:none`; stack-2 hidden. Opacity is now 1 (was 0.75 originally) so the card behind reads as a card.
- With the original geometry only about 13px of the card behind shows below the top card. More would need the top card shortened or the tab-bar gap changed.

### 2026-10-05i — Gear icon colour reverted; ring checked against Account
- Last round I had changed `.settings-btn` and `.chat-settings-btn` icon colour from `var(--text-2)` to `var(--text)`, which made the gear look darker. Reverted to `var(--text-2)`.
- Ring: computed styles of the Practice gear, in-chat gear, and Account back button are identical (white fill, `1px solid rgb(236,229,218)`, 44×44, no shadow). A side-by-side capture confirmed the rings match, so no ring change was made. Open question: whether the intended reference was the Practice header's profile button (no ring, soft shadow).

### 2026-10-05j — Gear rings replaced with the profile circle's style
- The "Account circle" the user meant is the profile avatar button in the header (`.profile-btn`): white fill, no border, soft shadow `0 1px 6px rgba(28,25,23,0.06)`, muted icon. The Account back button (`.back-btn`) has a visible ring, so the earlier match was to the wrong control.
- `.settings-btn` (Practice gear) and `.chat-settings-btn` (in-chat gear) now use: `border: none`, `background: var(--s1)`, the same box-shadow, `color: var(--text-2)`.
- Verified the files are identical in source, www and iOS. Not visually re-checked in a browser after this change.

### 2026-10-07a — AI Coach add-conversation icons were genuinely clipped; re-cropped from the real source
- User reported the Paste/Upload/Link icons "so cut out." Checked the actual files: confirmed real clipping (doc's corner fold and right edge cut, photo icon's rounded square cut on left/bottom, link's chain loops cut top-right and bottom-left). Root cause: the crop boxes used last time were coordinates read off a different sheet (23.png, from an earlier round) reused against new source files without re-deriving them — same mistake flagged generically in the `web-to-rn-conversion` skill's mechanical rules, just made on this side instead of the Expo side.
- The original source sheets (25.png/26.png from the chat) no longer existed — this machine clears `/private/tmp` between sessions, which is where pasted images land. Found real duplicates already saved in the repo at `assets/icons/reply-styles/Add convo.png` / `Add convo dark.png` (same byte dimensions, verified by opening and eyeballing), and re-cropped from those instead of guessing or asking the user to resend.
- Used connected-component detection (not a fixed gap threshold) to get each icon's real bounding box, unioned across an icon's separate parts (e.g. the document's outline + its 2 text lines as 3 components; the link's 2 chain-loop blobs), then padded 16px on every side so nothing touches the crop edge.
- Verified: all 4 icons (paste, upload, link, info) load in both light and dark, full and uncropped, in a real screenshot of the AI Coach "Add your conversation" card.

### 2026-10-07b — AI Coach greeting now replaced, not just scrolled; scroll mechanics checked and confirmed working
- User reported the AI Coach page needed v-scroll and that the greeting ("Hi! I'm Zelo...") should disappear after linking/uploading/typing/sending, replaced at the top by the new content — not fully deleted, just out of view.
- Verified with a real Playwright render (not just CSS reading) that the scroll chain already worked: `.screen` → flex column, `#screen-ai-coach` → flex + `overflow:hidden`, `.aicoach-main` → `flex:1`, `.aicoach-messages` → `flex:1; overflow-y:auto`. A manual mouse-wheel scroll moved `scrollTop` correctly (2756 → 756), and `renderAiCoachChat()`'s `wrap.scrollTop = wrap.scrollHeight` reaches the true bottom once given time to finish (my first read was mid-`scroll-behavior:smooth` animation, a testing artifact, not a bug).
- The real gap: for a short exchange, total content barely exceeds the viewport, so "scroll to bottom" only moves a few px and the greeting stays basically fully visible — scrolling alone can't reliably hide it. Fixed in `renderAiCoachChat()`: the greeting (and the "Add your conversation" card) now only render in the true empty state (no linked thread AND no messages yet). Once a thread is linked, the linked-conversation card takes the top position instead, regardless of message count. Once any message is sent (no thread), the user's own first message is the new top item.
- Verified with a real render: after sending one short message, `.aicoach-bubble-hi` (the greeting marker) is no longer in the DOM and `#aicoach-messages`'s first child is the user's own message — confirmed in both the DOM check and a screenshot.
- Scoped deliberately: Paste Message (fills the input only) and Upload Screenshot (shows a fixed preview above the composer, not in the scrollable list) do NOT by themselves hide the greeting — only linking a thread or actually sending something does, since those are the two concrete replacements the user described ("the previous message user sent or link will be in the top in replacement"). Not verified live: the link-a-thread path (same code gate, no seeded thread data in this test environment to exercise it end-to-end).

### 2026-10-07c — 07b fully removed the greeting from the DOM, breaking scroll-up; also found and fixed a real touch-scroll-blocking bug
- User correction: "the texting part is correct, but i cant scroll up to see the original message" — 07b's gate (skip rendering the greeting entirely once a thread was linked or a message existed) over-corrected. The user's actual ask was always "moved up from view", never "deleted" — scrolling back up has to still reach it.
- Reverted `renderAiCoachChat()` to always render the greeting bubble, same as any other message. Added a one-time latch, `_aiCoachGreetingPushed` (reset in `openAiCoach()`/`linkThread()` based on whether there's already content), so the FIRST real interaction scrolls just past the greeting's own height (`greetingEl.offsetTop + offsetHeight`, clamped to the container's real max scroll) instead of jumping to `scrollHeight` — which has no visible effect on a short conversation that doesn't yet overflow the viewport. Every render after that first one goes back to a normal stick-to-bottom scroll.
- Verified: a realistic first exchange (a few sentences + 3 suggestion pills, matching what `sendAiCoachMessage()` actually produces) clears the greeting above the fold (`hiScrolledAboveFold: true`) while leaving it in the DOM and reachable by scrolling up. A trivially short 2-word exchange with no suggestions doesn't clear it — correctly: there's nothing to scroll since content doesn't overflow the viewport at all (`maxScroll: 0`), not a bug.
- Separately, the user challenged whether real touch-drag scrolling worked at all ("do you know what that is" — fair, since the only prior verification used `page.mouse.wheel()`, which never exercises `touchstart`/`touchmove` handlers at all). Audited every touch listener in script.js for `{passive:false}` + `preventDefault()`. Found a real bug in `attachAiCoachChatSheetDragClose()` (the swipe-down-to-dismiss gesture for AI Coach opened as a sheet from inside a chat): its guard let the close-drag arm whenever `#aicoach-messages.scrollTop <= 40`, not just truly at the top (`=== 0`, the threshold its own comment claimed to use, matching the established `attachProfileDetailDragToClose()` pattern elsewhere). That swallowed the last ~40px of a genuine scroll-up-to-reread-the-greeting gesture as a close-drag instead, calling `preventDefault()` and blocking it. Tightened to `scrollTop > 4` (a tiny margin for real scroll-anchoring noise, not 40px of real scrollable distance).
- Verified with real synthetic `Touch`/`TouchEvent` objects (not mouse-wheel): at `scrollTop:25`, the old code called `preventDefault()` on the drag (blocking scroll-up); the fix does not. At `scrollTop:0` (truly at the top), the close-drag still arms and the sheet still closes correctly — the dismiss gesture itself isn't broken, just no longer over-eager.
- Checked the practice Chat screen (`#screen-chat`/`.chat-messages`) for an equivalent issue, since the user said "both chat and ai coach": the only touch handler attached there is `attachEdgeSwipeBack`, already confirmed `{passive:true}` (structurally can't call `preventDefault()`) with vertical drags resolving to a dead axis and returning early. No blocking handler found — its scrolling was not actually broken by anything discovered this round.

### 2026-10-07d — v-scroll was still dead with zero/one message; fixed the real cause (no overflow, not a blocked gesture) in both AI Coach and Chat
- User follow-up: scroll worked after sending a message, but "in normal state no message, theres no v scroll" — in both AI Coach and the practice Chat page. Root cause is simpler than 07c's gesture fix: a WebKit `overflow-y:auto` container with zero real overflow (`scrollHeight === clientHeight`) cannot be touch-scrolled or bounced at all, no matter how the touch handlers are written — there was nothing to scroll because the empty-state content (AI Coach's greeting + add-card, or Chat's profile-header-only state) didn't fill the container, by itself a completely ordinary, expected default — not a gesture bug.
- First attempt — bumping each container's CSS bottom padding — silently did nothing: `scrollHeight` floors to `clientHeight` the instant content fits, so `clientHeight - scrollHeight` always reads `0` regardless of how much slack the flex layout actually has, and extra padding just gets absorbed into that same slack. Confirmed by measuring the real content extent directly (last child's own rendered bottom edge, not the container's scrollHeight) — ~97px of slack existed in the AI Coach empty state alone, more than double what the padding bump added.
- Real fix: a shared helper, `_ensureScrollableOverflow(el, minOverflowPx)`, that measures true content height from the last child's `getBoundingClientRect()` (not subject to the scrollHeight floor), then adds/removes a trailing spacer `div` sized to guarantee at least `minOverflowPx` (48) of real overflow. Called from `renderAiCoachChat()`'s tail (every render) and from `scrollToBottom()` (already called from every chat-message append site, plus one new call added right after `startChat()`'s profile-header render, which previously never scrolled at all).
- Verified: both `#aicoach-messages` and `#chat-messages` now report genuine `scrollHeight > clientHeight` in their empty states, a real touch-drag changes `scrollTop`, and setting `scrollTop` manually holds instead of snapping back to 0. Re-ran every prior scroll/greeting/touch-close test from 07c's round — all still pass, including the AI Coach sheet's drag-to-close-at-the-true-top behavior.
- Bonus: this also fixed an edge case 07c had explicitly accepted as "correct, not a bug" — a trivially short one-line exchange with no suggestion pills previously couldn't clear the greeting above the fold (nothing to scroll into); with guaranteed overflow now always present, it does. (This specific side effect was itself undone by 07e below, correctly — see that entry.)

### 2026-10-07e — the 07d spacer was invisibly inflating "scroll to latest" everywhere, including the keyboard's own nudge — fixed by excluding it
- User follow-up: "when i open keyboard... the ai coach message will go so high up isnt like the normal keyboard opening." Root cause: `nudgeFocusedIntoView()`'s keyboard-settle fixup (`contentEl.scrollTop = contentEl.scrollHeight`, the content-aware clearance shared by both `aicoach-input` and `message-input` in `MOVABLE_OVERRIDE`) used raw `scrollHeight` — which 07d's spacer now inflates by 48px+ on any short conversation. Opening the keyboard snapped scroll into that blank spacer past the real last message, shoving it up out of view by the spacer's height. Not a keyboard-specific bug — the same raw-`scrollHeight` mistake was in every "scroll to latest" call site 07d touched.
- Real fix: added `_logicalScrollHeight(el)`, which looks up `el`'s spacer by id and subtracts its height from `el.scrollHeight` — the spacer is meant purely as draggable overscroll room, never as part of "the bottom" for an actual scroll-to-latest action. Replaced every remaining raw-`scrollHeight` scroll-to-bottom/distance-from-bottom call with it: `scrollToBottom()`, `renderAiCoachChat()`'s tail (both branches), the keyboard nudge's `fixupScroll`, the AI Coach suggestions-panel's own `scrollAiCoachToBottom()` fixup (same bug, same mechanism, found while auditing the rest), and both screens' "jump to latest" button distance calcs (`_updateAiCoachScrollBottomBtn`/`_updateChatScrollBottomBtn` — these had the bug too, which would've shown a stray jump-to-latest button even when already caught up to the true bottom).
- Verified by simulating the keyboard's own shrink mechanism directly (setting `marginBottom` on the container, same technique `nudgeFocusedIntoView()` uses, then calling the fixed scroll logic): the old raw-scrollHeight target (599) vs. the new logical one correctly lands scroll with the spacer out of view, not revealed.
- Re-ran the full regression suite from 07c/07d — all still pass except one expected, correct reversion: the trivially-short one-line exchange (no suggestion pills) that 07d's bug had accidentally made "work" (by scrolling into the spacer) now correctly goes back to not clearing the greeting, since there's genuinely nothing real to scroll past — matching 07c's original, deliberate design call, not a regression.

### 2026-10-07f — 07e's fix excluded the spacer correctly but still overshot ("with suggestions open too") — a formula bug, not a leftover gesture
- User follow-up: still overshooting, worse with the suggestions panel also open, and correctly guessed it was about "the mechanic... how much it will go up" — pointing at the scroll-target math itself, not another blocked gesture.
- Real bug: `el.scrollTop = el.scrollHeight` is only a safe "scroll to bottom" idiom because the browser auto-clamps an over-large assignment down to the real max (`scrollHeight - clientHeight`), and raw `scrollHeight` is always ≥ that max. `_logicalScrollHeight(el)` (scrollHeight with the spacer excluded) has no such guarantee — it can land below `clientHeight` entirely on a short conversation — so 07e's `el.scrollTop = _logicalScrollHeight(el)` wasn't reliably clamping to the right spot, it was just setting scrollTop to whatever that raw number happened to be. The gap between the wrong and right answer scales with how much the container has shrunk, which is exactly why it got worse with the suggestions panel open too (keyboard + expanded panel together shrink `.aicoach-messages` a lot further than the keyboard alone).
- Fix: added `_scrollToLogicalBottom(el)` — `el.scrollTop = Math.max(0, _logicalScrollHeight(el) - el.clientHeight)`, explicitly computing the real target instead of leaning on clamping. Replaced all four remaining direct `_logicalScrollHeight()` assignments with it: `scrollToBottom()`, `renderAiCoachChat()`'s final branch, `scrollAiCoachToBottom()`, and the keyboard nudge's `fixupScroll`.
- Verified by simulating a combined keyboard+suggestions-panel shrink (`clientHeight` forced down to 119px against a 599px `scrollHeight` with a 157px spacer): the fix lands at `scrollTop:323` — correctly within the true valid range `[0, 480]` and nowhere near the spacer — where 07e's formula would have handed back a much larger, unclamped raw number instead. (Caught a self-inflicted repeat of this session's own `scroll-behavior:smooth` readback trap while verifying — reading `scrollTop` synchronously right after the write showed a stale `0`; re-read after a real wait with `scroll-behavior` forced to `auto` gave the honest `323`.)
- Re-ran the full prior regression suite — unchanged, still all passing.

### 2026-10-08a — Double/triple-texting pacing window + AI multi-text replies + reply-to-message (Chat, Instant mode only)
- User request: make Instant mode feel like texting a real person instead of flat ping-pong — both sides should be able to double/triple-text, AI should sometimes split a reply into 2-3 separate texts (or add an unprompted laugh/emoji follow-up), and because that makes "what is this responding to" ambiguous, add a reply-to/quote feature. Scope confirmed with the user: Instant/training mode only (Realistic timing is separately unfinished, untouched here); reply-to bundled into the same work, not a fast-follow.
- **AI-side double/triple-texting is prompt-driven, not client-side sentence-splitting.** `_fetchAIGirlReply()` now conditionally appends a system message (same pattern as its existing `forceShort` branch) telling the model it may split a reply into up to 3 short messages separated by a literal `"|||"` when that reads more naturally than one paragraph — most replies should still stay one message. The model decides when a double-text is warranted and what the follow-up says (a laugh, an afterthought, an emoji), which produces far more natural results than chopping one blob of text into sentences after the fact would have. `maxTokens`' ceiling bumped 200→260 for the rare 3-part case. The `deepseek-proxy` Supabase edge function is a dumb forwarder (just relays `body.messages`) — no backend changes were needed at all, confirmed by reading it before planning around it.
- `doTypingAndReply()` now splits the returned reply on `"|||"`, caps at 3 parts, and delivers them sequentially — first part exactly as before (typing indicator overlaps the real fetch), each follow-up part getting its own indicator pulse with a delay scaled to that part's word count (`_aiFollowupTypingDelay()`), separated by a fixed `AI_MULTI_TEXT_GAP` (400ms) so they read as separate texts landing, not one bubble instantly followed by another.
- Found and fixed a real pre-existing bug while touching this function: once its outer `setTimeout` fires, `cancelPendingReply()` (called on leaving the chat) can no longer stop it via `clearTimeout` — it's a running async function by then, not a pending timer, so a bubble could still land in a chat the user already left. Added `state.chatReplyGen`, a generation counter bumped in `cancelPendingReply()` (same pattern as `_aiCoachStatusGen` elsewhere), checked by the multi-part loop before every append — closes this gap for both the old single-part path and the new multi-part one.
- **User-side pacing window** — `sendMessage()`'s old guard (`state.awaitingReply` set true immediately, blocking any second send) is what made double-texting impossible before; it now only applies once AI is actually replying. A fresh Instant-mode send opens `state.pacing` instead: a 7s window (`CHAT_PACING.windowMs`) during which the user can send up to `maxBurst` (3) messages total, each one re-arming a shorter 4s follow-up window (`followupMs`), under a 25s hard ceiling (`ceilingMs`, set once, never reset) so a distracted user can't stall the chat indefinitely. `state.lastUserWordCount` accumulates across a burst rather than only reflecting the last message, so the AI's reply-length guard scales with the whole burst it's responding to.
- **Keyboard-typing-aware pause**, per the user's own clarification that the keyboard merely opening could be an accidental tap, not real typing intent: a new `oninput` listener on `#message-input` (`onMessageInputChange()` — this field had zero input-event wiring before, confirmed by grep before adding it) pauses the window the moment the field goes non-empty, and resumes it with a short 2.5s tail (`tailMs`) once it's cleared without sending. While paused/typing, `_startChatPacingPulse()` briefly shows the typing indicator for 2s every 8s — a "still here, still waiting" cue instead of either a static freeze or no feedback.
- **Reply-to-message**: messages now get a real `id` (`_newMsgId()`, a plain incrementing counter — `Date.now()` alone isn't safe since a burst can land multiple messages in the same millisecond) and an optional `replyToId`, both mirrored onto the DOM as `data-msg-id`. Long-press a bubble (new `_attachReplyLongPress()`, copying AI Coach history rows' existing `_aiCoachLongPressTimer` 500ms-hold-cleared-on-move convention — the practice Chat screen had zero long-press handling before this) stages it via `_stageReplyTo()`, showing a dismissible preview strip above the composer; the next send attaches `replyToId` and the resulting bubble shows a compact quoted strip inside itself, tapping which scrolls to and briefly highlights the original (`_scrollToMessage()`). Manual/opt-in only — never auto-attached to a burst or multi-part AI reply, so it doesn't clutter every turn. The staged strip lives inside `.chat-input-bar` itself (required restructuring it into a column with a new inner `.chat-input-row` for the button/input/button trio) rather than as a separate sibling, so it rides up together with the rest of the bar when the keyboard opens — same reasoning already established for the AI Coach suggestions panel's own `MOVABLE_OVERRIDE` entry.
- Verified end-to-end with real Playwright functional tests (state inspection, not just visual): a fresh send opens the window without locking `awaitingReply`/the send button; a burst send increments and re-arms the follow-up timer; typing pauses the window (`windowTimer` goes null) and clearing resumes it; hitting the burst cap closes the window immediately. A stubbed 3-part `"|||"` reply produces exactly 3 separate AI messages with unique ids and correct per-part text; a stubbed plain reply (no delimiter) still produces exactly 1 message, unchanged from before. Long-press → stage → send → quote-strip-renders → tap-to-highlight all confirmed working, including after reopening the chat via `openChatFromStore()` (history replay correctly reconstructs both the multi-part messages and the reply-quote strip from stored `id`/`replyToId` fields).
- Not yet done: a real on-device feel pass (long-press timing, pulse cadence, and — separately — how often/naturally the model actually reaches for `"|||"` in practice are all feel/prompt-tuning that headless testing can't fully judge) and Realistic-mode timing, both explicitly deferred per the user's own scoping.

### 2026-10-08b — First on-device pass on 08a: 7 fixes, incl. a cross-feature bug that silently ate the first tap on any new menu
- **The "permanent box above the message you can't remove"** was the staged-reply strip never hiding. `hidden` only carries a UA-level `display:none`, which the author-level `.chat-reply-staged { display: flex }` outranks — so it rendered permanently from first paint with no way to dismiss it. Fixed with an explicit `.chat-reply-staged[hidden] { display: none }`. Worth remembering generally: **any element in this codebase styled `display:flex/grid` that's also toggled via the `hidden` attribute needs its own `[hidden]` rule**, or the attribute does nothing.
- **"AI takes a bit long even tho I'm not typing"** — cut `CHAT_PACING.windowMs` 7000→4000 and `followupMs` 4000→3000. The window only has to be long enough to *start* a second message in; the typing-pause already extends it for as long as someone's actually typing, so 7s was only ever felt in the case where nothing was extending it.
- **Message grouping**: consecutive messages from the same sender (either side) now read as one run — only the last keeps its avatar and timestamp (`_applyMsgGrouping()` + `.msg-row--grouped`). The avatar hides with `visibility`, not `display`, so the run stays at the same indent as its last row. The back-walk skips non-`.msg-row` siblings deliberately: `scrollToBottom()`'s overflow spacer is re-appended at the end each time and is routinely sitting between the previous message and the new one.
- **AI now uses reply-to, and answers a burst message-by-message.** When the user's last turn is a multi-message burst, `_fetchAIGirlReply()` numbers those messages in a system note and tells the model it can tag a part with `[re:N]`; `_parseAiReplyParts()` strips the tag and resolves N against the same trailing burst (`_trailingUserBurst()`, re-derived client-side so the numbering lines up without passing state). The reply-length guard now counts the *cleaned* parts — `"|||"` separators and `[re:N]` tags aren't words she said, and counting them was pushing reasonable multi-text replies over the limit into a pointless regenerate. Prompt also reworked to push for short answers to short questions (the complaint was a one-word question getting a padded sentence back) and to double-text somewhat more often while explicitly still not every turn.
- **Instagram-style long-press menu** replaces the old "long-press instantly stages a reply": emoji reaction row, the lifted message, then Reply/Copy/Delete for you/Report, over a blurred backdrop — built against the reference screenshots the user saved to `assets/icons/chats-page/`. Long-press is 300ms (down from the 500ms used for list rows elsewhere) with a `navigator.vibrate` + `_cineHaptic('MEDIUM')` buzz on open, per the user's ask. Icons cropped from the two supplied sheets by column-projection into `assets/icons/chats-page/msg-menu/`, then **alpha-keyed to transparency** — shipped as-is, the dark crops' pure-black backing square was plainly visible against the dark menu card, which is `var(--s1)` (grey), not black. The key estimates alpha from the largest per-channel distance to the sheet background and un-premultiplies, so the red Report glyph survives where a luminance key would have wrecked it.
- The lifted copy is a clone of the whole `.msg-row` (avatar included) inside a slot carrying the same side padding as `.chat-messages`, so it lands at exactly the real row's indent with no per-side offset math. **The clone must have its `data-msg-id` stripped** — otherwise `.msg-row[data-msg-id=...]` lookups (`_scrollToMessage`, `_renderMsgReactionBadge`) can resolve to the copy instead of the real message, and a repaint of the thread underneath appears to leave the row behind.
- **The hard bug this round**: menu actions did nothing at all after a reply had been staged. Traced it down to `.click()` not dispatching *any* listener, including one attached a line earlier — the tell that something upstream was swallowing it. Cause: the global keyboard-dismiss handler treats a touch outside a focused input as a dismiss gesture, and arms both a `{capture:true, once:true}` click swallower (`stopImmediatePropagation`) and a 500ms full-screen `.kb-dismiss-click-blocker` overlay. Staging a reply focuses the composer, so the very next long-press armed both, and the user's first tap on the menu got eaten. `openMsgMenu()` now stands both down, since opening the menu is a deliberate action rather than a dismiss gesture. **Generalises to any new modal surface opened from a touch while a text field is focused — it will inherit this exact swallow unless it clears them too.**
- Reactions are functional (stored on the message, badge tucked onto the bubble's bottom corner via negative margin so it never needs the bubble's height), as are Copy, Delete for you (removes it, clears any `replyToId` pointing at it, repaints via the now-shared `_rerenderChatMessages()` that `openChatFromStore()` also uses) and Report (a toast — there's no reporting backend, and a silent no-op would read as broken).
- Verified with Playwright state-inspection tests plus light/dark screenshots: strip hidden at rest, grouping flags/visibility per row, `[re:N]` resolving to real ids, 2 quote strips rendering in-thread, menu opening and fitting on screen, reaction → badge, Reply → staged, Delete → row gone. The older 08a test that asserted long-press-stages-directly was updated to the menu flow rather than treated as a regression.
- Still not done: on-device feel pass, and how often the model really reaches for `"|||"`/`[re:N]` in live use — both still prompt/feel tuning that headless runs can't judge. Realistic mode remains deferred.

### 2026-10-09a — Long-press menu: centred, and re-choreographed into travel → land → bounce → fade
- User feedback on 08b's menu: sit it "a bit to the middle left", and the animation was "a bit weird". Wanted: on press, the message and the action card visibly come OUT while the blur fades up; once landed, the emoji row pops with a short bounce and the action card bounces with it; on dismiss, everything just fades down together.
- Position is now vertically centred (`_positionMsgMenu()`), clamped to the safe area, instead of being pinned just above wherever the message happened to sit. Side alignment still follows the sender. `_positionMsgMenu()` is also re-run when the emoji row is expanded via "+", since that makes the stack taller and could otherwise push the action card off the bottom.
- The open is a FLIP: the stack is positioned at its final centred spot, then given an inline `translateY(<delta>) scale(0.96)` with `transition:none` that places the lifted copy exactly over the real message, flushed, and cleared inside a rAF so it animates from there. Delta is measured off `slot.offsetTop` within the stack, so the emoji row's reserved-but-invisible height is already accounted for. Net effect: the menu comes out of the message the user actually pressed rather than appearing somewhere unrelated.
- **The overlay itself no longer fades as one lump** — that was what made it read oddly. Opacity moved off `.msg-menu-overlay` onto `.msg-menu-backdrop`, so the blur can come up over 240ms *behind* the stack while the stack independently travels.
- The emoji row holds `opacity:0` but keeps its height throughout the travel (so layout and the FLIP delta stay stable), then `--settled` runs a short pop. Timing matters here: the travel's `cubic-bezier(0.22,1,0.36,1)` is front-loaded, so it's visually home at ~150ms even though the transition formally runs 240ms. Measured it with a rAF sampler inside the page (screenshot-based sampling is useless for this — each capture costs 100ms+ and skews every reading), found a ~60ms dead beat, and moved the settle trigger to `MSG_MENU_SETTLE_MS = 150`. Verified after: travel+blur 0→150ms, pop 150→260ms, nothing idle in between.
- Close deliberately has no reverse travel and no bounce — `--out` drops the stack 10px, scales to 0.98 and fades it while the backdrop fades. `--settled` is left ON during the close so the pop animation's `forwards` fill keeps the emoji row at its finished frame while it fades; removing it would snap the row back to its hidden start frame mid-fade.

### 2026-10-09b — Reactions became two-way and visible to the model
- Until now a reaction was pure decoration: tapping one changed nothing the AI could see, and she had no way to react back. Both directions are wired now. (Scoped to the practice Chat screen — that's the only place reactions exist; AI Coach has no reaction UI.)
- **She can see yours.** `_fetchAIGirlReply()` no longer maps history straight to roles; it walks it and, wherever a message carries a `reaction`, pushes a short system note right after that turn. Who reacted is inferred from whose message it sits on rather than stored — there are only two people, and you react to the other one's message, never your own, so no extra field was needed. Verified against the real payload by stubbing `_aiInvoke` and dumping it: `[user] i tripped… / [system] You reacted 😂 to that message of theirs. / [assistant] NO WAY / [system] The user reacted ❤️ to that message of yours.`
- **She can react back** via a `[react:N <emoji>]` directive at the start of her reply, N indexing the same numbered trailing burst `[re:N]` already uses. `_extractAiReactions()` strips every directive out before the text is ever parsed into parts, so a tag can't leak into a visible bubble; an out-of-range N is dropped silently rather than rendering. The burst numbering block is now emitted even for a single message (N=1), since `[react:N]` needs it where `[re:N]` only mattered for a real burst.
- Prompt is explicit that the reaction is **something she does, not something she says** — per the user: "it's just something to show of, not something to type". She must never mention, describe or refer to having reacted; the emoji IS the whole gesture, and her words carry on normally.
- Sequencing matters to make that read: her reaction is applied while the typing indicator is still running, then `AI_REACTION_BEAT_MS` (550ms) passes, then her words land. So you see her react, see her still typing, then get the message — instead of both appearing in the same frame. The generation guard is re-checked after that beat like every other await in the delivery loop.
- The reaction also fires a light haptic when it's hers, matching what the user's own tap does — a reaction arriving silently was easy to miss entirely.

### 2026-10-09c — Reply UI reworked, the `(re:N2)` leak, scroll-position preservation, and two sheet fixes
- **The `(re:N2)` glitch message.** She answered "why seoul tho" with a literal `(re:N2) my parents are from there`. `_parseAiReplyParts()` only matched `/^\[\s*re\s*:\s*(\d+)\s*\]/` — square brackets, bare digit — so the model's round brackets AND the literal "N" it copied straight out of the `[re:N]` placeholder both missed, and the raw tag rendered as text. Both parsers are now deliberately loose (either bracket, optional `reply`/`#`/`n`, optional colon), and the prompt no longer shows a placeholder letter at all — it says "like [re:1] or [re:2] — literally that, with a real digit". **Any future directive tag needs the same treatment: a tag that fails to match doesn't silently no-op, it leaks into a visible bubble.**
- **Reply composer** restyled to Instagram's: no boxed card, just a rule above the composer (negative side margins cancel `.chat-input-bar`'s padding so it runs edge to edge) and a thicker 18px/stroke-3 X.
- **Reply quote on your own bubble** was muted grey on solid pink — unreadable, so you couldn't see which of her messages you were replying to. `.bubble.user .msg-reply-quote` now uses near-white text on a translucent white panel; the default variant got a faint tint too so the quote reads as a distinct block rather than floating text.
- **Scroll position is preserved when new messages land.** Previously any incoming message called `scrollToBottom()` and yanked you out of whatever you were reading. Her messages and the typing indicator now go through `_followChatIfAtBottom(wasNearBottom, isNewMessage)`, which only follows if you were already within `CHAT_STICK_THRESHOLD` (120px) of the bottom; otherwise your place is kept and `state.chatUnseen` counts what arrived. **`wasNearBottom` must be sampled before the row is appended** — measured after, the new bubble's own height makes it look like you'd scrolled away. The jump-to-latest button grows into a labelled accent pill ("1 new message" / "2 new messages") and clears when you get back to the bottom by any route. Your own sends still always scroll down.
- **AI Coach sheet: the conversation no longer arms the close-drag at all.** The previous "only while scrolled to the top" gate still meant dragging down to pull older messages into view closed the sheet instead of scrolling. Header, suggestions panel, input bar and footer all still arm it, so there's plenty of close surface left.
- **Practice "i" sheet** matched to the AI Coach sheet: same 36×5 grab pill, height 96% → 89% (AI Coach sits at `top:11%`), and the drag-close threshold cut from 30% of the viewport (~250px — a long deliberate haul) to 110px, in line with the AI Coach sheet's own 100px, so an ordinary flick closes it.
- **White-page-on-re-entry is NOT diagnosed.** Reported on device: leaving a chat and coming back shows a blank area until you touch it. Reproduced the exact flow headlessly and the thread is entirely correct there — 3 rows, laid out, `firstRowVisible: true`, screen active at opacity 1 — so it's a WKWebView compositing/paint issue, not logic. Added `_forceChatRepaint()` (one frame of `opacity: 0.999`, then cleared) after `pushScreen('chat')` as a layer-invalidation nudge. **This is a mitigation, not a fix, and still needs confirming on a real device.**
- **Long-press entrance** additionally gives the message slot and the action card their own short rise into place (card a beat behind) on top of the stack's travel, so it reads as the two of them settling rather than one rigid block sliding — then the emoji row pops as before.
- **AI Coach got reply quotes** (quotes only — no long-press menu there, by the user's choice). Its messages now carry `_newMsgId()` ids, `_buildAiCoachMessages()` numbers the last 5 user turns and offers the same `[re:N]` tag, `_aiCoachFetchReply()` strips the tag **before** `_parseAiCoachReply()` runs (leaving it in would put the tag inside the advice/suggestions split and render it as text — the same leak the practice chat hit), and `_aiCoachZeloBubble()` renders the quote. Escaped via `_escapeHtml` because those bubbles are built with `innerHTML`, unlike the practice chat's which use `textContent`.

### 2026-10-09e — Swipe-to-reply, replies that survive leaving, and three interaction/paint fixes
- **"Sending then leaving registered as didn't send"** had a concrete cause: `cancelPendingReply()` (fired by tab nav and `exitChat()`) called `_clearChatPacing()`, which **discarded the open double-text window — so `doTypingAndReply()` was never reached and no reply was ever scheduled**. It now closes the window instead, which starts the reply, and no longer clears `pendingTimer` or bumps the generation, so a reply already in flight runs to completion.
- Delivery is now chat-aware rather than screen-aware: `doTypingAndReply()` captures `myChatId`, and every part goes through `_deliverAiPart()`, which **always** stores (`syncChatToStore` gained an explicit `chatId`) but only paints when `_chatIsLive(chatId)`. Off-screen, it bumps `chat.unread` and re-renders the chats list, so the reply shows as unread instead of vanishing. `_applyAiReaction()` took the same treatment. Genuine aborts (thread wiped by `chatSettingsReset`) moved to a new `abortPendingReply()`, which is now the only thing that bumps `chatReplyGen`.
- **Swipe right on a message to reply.** This collides head-on with the back gesture, which was NOT edge-scoped — any rightward drag anywhere navigated back. Added an `edgeStart` option to `attachEdgeSwipeBack()` and set `edgeStart: 32` for the chat, iOS-style, freeing the rest of each row. The row follows with 0.55 resistance capped at 78px, buzzes once at the commit point, springs back on release. It only commits to the horizontal axis when `dx > 0 && |dx| > |dy|`, and only calls `preventDefault()` after committing — verified that a vertical drag still scrolls untouched (no preventDefault, no transform).
- **Taps beside the long-press menu did nothing.** `.msg-menu-stack` is `left:0;right:0`, so despite looking narrow its box spanned the full width and swallowed every tap in the empty space either side — only taps above/below it reached the backdrop. Fixed with `pointer-events: none` on the stack and `auto` on just the reaction row and action card.
- **Swipe-back is locked while the menu is open**, via the existing `opts.disabled()` hook — otherwise the screen could slide out from under a floating menu.
- **The mid-swipe blink is a real bug with a real fix.** `cleanupTrack()` restores the inline opacity `_slideMountEl()` forced during the drag, and `.screen`/`.tab`'s own `transition: opacity` animates that correction as a genuine fade. The settle path already suppressed this for its own swap — but the two **early-return** paths (`myToken !== gestureToken`, i.e. a fresh touch interrupting the settle, which is exactly "swipe and come back to the same page") called `cleanupTrack()` bare. The suppression moved inside `cleanupTrack()` so every exit is covered. **Pattern worth remembering: a bare cleanup path that an interrupt can reach needs the same transition suppression the happy path got.**
- AI Coach: the "This conversation" replay (`_convRowsHTML`) now carries and renders reply quotes, so the replay no longer reads as a flat back-and-forth.
- White-page-on-re-entry still **not reproducible headlessly**; the nudge was strengthened to mirror what actually clears it on device (a 1px scroll with `scroll-behavior` forced to `auto`, plus the layer touch). Still unverified — needs a device.

### 2026-10-09f — Swipe-to-reply made directional, with an icon, and back-swipe given its space back
- **Reply icon indicator.** Each row carries a `.msg-swipe-reply-icon` (the cropped reply glyph) pinned to the edge the message pulls away from — left for hers, right for yours — fading and scaling up with drag progress, full at the trigger point. Per the user: the icon appearing IS the confirmation the swipe registered; no icon means the drag was too short or got cancelled.
- **Direction is now per side**: her messages (left) pull right, yours (right) pull left. Besides matching how real clients do it, this is what frees rightward drags on your own messages for the back gesture.
- **Back-swipe had effectively died in the conversation.** 09e scoped it to `edgeStart: 32`, but the row gesture didn't exclude the edge — so a touch starting at the very left on a message row armed BOTH, and the row's `preventDefault()` + transform fought the back slide. Rows now ignore touches within `SWIPE_REPLY_EDGE_GUARD` (52px), deliberately wider than the gesture's own `edgeStart` (raised to 44px), so the two can never both arm on one touch. Verified: a touch at x=10 on a message row is not claimed by the row at all.
- **Re-entering a conversation now lands on the newest message.** It was sitting at the top because `_rerenderChatMessages()` scrolls while the screen is still inactive, so `clientHeight` wasn't the real one yet and the target resolved against the wrong height. The scroll moved into the post-`pushScreen()` frame (alongside the repaint nudge), where the measurement is valid — `scrollTop` now lands exactly on the max.
- White-page is confirmed fixed by the user.

### 2026-10-09g — Swipe-to-reply gesture corrected, back-swipe un-scoped, blink frozen harder
- **The row swung out twice on one drag.** `pull` was computed from `Math.abs(dx)`, so once the finger went past the start in the opposite direction that negative travel was flipped back into a positive pull and the row swung out again. Now directional and floored: `Math.max(0, Math.min(MAX, (dx * dir) * 0.55))` — past the start it pins at 0 and stays there. Verified: `[20,160,0,-60,-140]` → `78px` then `0px, 0px, 0px`.
- **Releasing back near the start now cancels.** Commit was judged on a latched `armed` flag, so dragging out far and returning still fired. It's judged on the live `pull` at release instead. The haptic keeps its own latch but re-arms on dropping back below the threshold, so pulling out → back → out buzzes each time.
- **Back-swipe works anywhere again.** 09f's `edgeStart` was unusable in practice. Instead of carving out screen regions, the row now sets `_msgRowSwipeClaimed` the moment its swipe commits, and the back gesture checks that when it locks its own axis. Ordering is reliable and not a race: rows listen at the target, the back gesture listens as the same event bubbles up to the screen, and the row commits ~2px earlier — so the flag is always set first. Net effect: back-swipe is live everywhere **except** a drag a row has actually claimed, which includes a rightward drag on the user's own messages (those reply leftward and never claim it).
- **Reply icon moved off the avatar** (`left/right: 2px` → `42px`, clear of the 28px avatar + 6px margin) — sitting on the pfp made it read as appearing too early.
- **Blink, third attempt.** Per-element transition suppression wasn't enough, because the teardown resets inline opacity/position on *both* pages and re-hides the tab bar, and any of those corrections can be picked up as animatable. `cleanupTrack()` now adds `#app.slide-cleanup` for the swap — a `transition: none !important` blanket over `.screen`, `.tab`, `.tab-bar` and both header types — flushes, and drops it next frame. **Still visually unverified; the headless harness can't judge a one-frame flash.**

### 2026-10-09h — Reply icon pinned properly, stray directive tags scrubbed, carousel blink freeze
- **The reply icon kept landing on top of things** (first the pfp, then the message) because it's a child of the row, so the row's own `translateX` dragged it along too. It's now **counter-translated** by the same amount (`translateX(${-pull * dir})`), which pins it visually to the far edge while the bubble slides out from under it, and sits at `left/right: 6px`. It also stays hidden until the row has travelled past the avatar (`SWIPE_REPLY_REVEAL = 34`, i.e. 28px avatar + 6px margin) so it only appears once there's real clear space.
- **`(re:2)`/`(re:3)` were still leaking.** The leading-anchored match only resolves a tag at the very start of a part, so a tag placed mid-text, or in a later `|||` part, or carrying an index that doesn't exist (the model inventing `re:3` when only one message is numbered) survived into a visible bubble. Added `_stripDirectiveTags()` — the same pattern applied **globally** as a final scrub on every part, and on the AI Coach reply too. The leading match still does the actual reply-target resolution; this only guarantees a tag can never be rendered. Verified against bogus indices, mid-text tags, and tags in a second part.
- **The chat↔scan blink has the same root cause as the back-swipe one, and was NOT fixed.** `finishSlide()`'s `cleanupTrack()` is reached from two early-return paths as well as the settled one, and only the settled path suppressed transitions — exactly the bug fixed in `attachEdgeSwipeBack` in 09e. It now uses the same `#app.slide-cleanup` freeze. **Worth internalising: any cleanup helper reachable from an interrupt path needs the suppression inside it, not at one call site.**

### 2026-10-09i — The swipe-nav blink, finally traced to a compositing-layer churn (not a transition)
- Three rounds of transition suppression hadn't fixed it, so this time the cancel was **actually observed** rather than guessed at: a synthetic back-swipe driven to cancel, with every frame sampled from inside the page (parent, computed opacity, position, rect, track presence, tab-bar state). Screenshot sampling is useless for this — each capture costs 100ms+ and skews every reading; rAF sampling of computed state is the tool that works.
- The trace showed the chat screen's own opacity never moves (so it was never a fade), and that **one single frame** did all of: reparent track→#app, `position: relative`→`absolute`, track removed, AND the tab bar flipped back to `display: none`.
- **The tab bar carries `backdrop-filter: blur(24px) saturate(180%)`, and `.tab-bar.hidden` is `display: none`.** `armReveal()` pulls it into the render tree for the gesture and the teardown pulls it back out — i.e. a backdrop-filter element's compositing layer is torn down and rebuilt on every swipe. That is a documented WebKit flash trigger and is the only thing in the whole sequence doing it.
- Two fixes: the bar gets `.tab-bar--gesture-reveal` for the gesture's duration, which drops `backdrop-filter` to `none` (it's fading up from zero opacity the whole time, so losing the blur transiently is invisible); and the re-hide now happens **one frame after** the reparent instead of alongside it, so two heavy compositing operations never share a frame. Re-traced after: f412 is the reparent alone, f421 is the display toggle alone.
- A leak guard in `pushScreen()` strips the class, so a gesture exiting without reaching its cleanup can't leave the bar permanently un-blurred.
- **Still needs device confirmation** — headless can prove the frame scheduling changed, not that the flash is gone.

### 2026-10-09j — The swipe blink, actually solved: a permanent entrance animation restarting on every reparent
- The user's own observation cracked it: **no blink in an empty chat, blink once there are messages, and visible during AI typing too.** That rules out everything structural (tab bar, track, reparent cost) — all identical either way — and points squarely at per-message content.
- Frame-by-frame measurement of the message list through a cancelled swipe showed `scrollTop`, `scrollHeight`, `clientHeight` and the container rect all perfectly constant, while the **rows themselves shifted +4px and eased back over ~100ms, at BOTH mount and unmount.** That signature is `@keyframes msgIn { from { opacity: 0; transform: translateY(4px) } }` — which `.msg-row` and `.typing-row` carried as a permanent `animation` property.
- **Reparenting a subtree restarts every CSS animation inside it.** So every message on screen replayed its entrance fade twice per gesture. Scales with message count; nothing to replay in an empty chat. Exactly the reported symptom.
- Fix: the entrance is no longer a permanent property. `.msg-row--in` / `.typing-row--in` carry it, applied by `_playRowEntrance()` on append and stripped 220ms later. Nothing on screen holds an `animation` once it has played, so a reparent has nothing to restart. Verified: a new message still animates in (`animationName: msgIn`) and is clean at +300ms (`none`); the full gesture trace is now **flat on every frame**, versus the +4px double-bounce before.
- **An `animation: none` blanket is NOT a fix for this class of bug** — it cancels a running animation, and removing the rule lets it start fresh one frame later, which just moves the flash. The earlier `#app.slide-animating *` freeze is kept only as a safety net for anything else holding a permanent entrance animation; the real fix is never leaving `animation` on an element after it has played.
- **General rule for this codebase: an entrance animation belongs on a one-shot class, never permanently in a component's base rule** — anything that reparents (swipe-nav tracks, list re-renders) will otherwise replay it.

### 2026-10-09k — Profile photo geometry: measured, and made changeable from one place
- Asked what ratio/dimensions generated profile images should use. Answered from **measurement, not Tinder's external guidance** — the two disagree in ways that matter here.
- **There was no `<img>` support at all.** Every profile "photo" was a solid colour placeholder (`.swipe-card[data-photo-index]` backgrounds + `.swipe-photo-label`), so dropping real images in would have done nothing. Added `cover` rules for `.swipe-card-photo img`, `.profile-detail-photo img`, `.chat-profile-photo img`.
- **The card photo box has no fixed ratio** — `.swipe-card-photo` is `flex: 1`, absorbing whatever `.swipe-card-body` doesn't need, so it changes shape per device. Measured (deviceScaleFactor aside, CSS px):

  | device | viewport | photo box | W:H |
  |---|---|---|---|
  | iPhone SE | 375×667 | 329×188 | **1.75** (landscape) |
  | 13/14 | 390×844 | 344×383 | 0.898 |
  | 15/16 | 393×852 | 347×391 | 0.887 |
  | 16 Pro | 402×874 | 356×413 | 0.862 |
  | 14/15 Pro Max | 430×932 | 358×471 | 0.760 |
  | 16 Pro Max | 440×956 | 358×495 | **0.723** (tallest) |

  The detail sheet strip (`.profile-detail-photo`, fixed `height: 200px`, full-bleed via `margin: 0 -20px`) is a second, much wider box: **1.88 → 2.15**. One source image has to survive both, 0.72 → 2.15.
- **Name/age/occupation are NOT overlaid** — they live in `.swipe-card-body` *below* the photo, unlike Tinder. So the bottom of the image is not at risk; the real overlays are the "Top Match" pill (top-left, `top/left: 14px`, bottom edge 38px down) and the transient LIKE/NOPE drag stamps (`top: 26px`).
- Added design tokens in `:root` as the single source of truth: `--card-photo-ratio: 4 / 5` and `--card-photo-focus: 50% 40%` (object-position, biased above centre since the crop that bites is vertical). Changing the ratio is now one edit that moves both the generation target and every rendered image; `.photo-ratio-box` is available for any surface that should pin the box rather than fill leftover space.
- Verified: a 4:5 source fills the card slot exactly (`344×383`, `object-fit: cover`, `object-position: 50% 40%`) with the tokens resolving.

### 2026-10-09l — Pilot persona photos (Z001-Z010) imported and wired
- Source: `VSC/Zelo New Character Tinder/03 Tinder Women/01 Persona Profiles - Z001-Z100/Z0NN/`. Each folder holds 5 files; the `*_MASTER_REFERENCE_DO_NOT_IMPORT.png` is deliberately skipped and **only T01-T04 are imported** — 4 per persona, exactly `SWIPE_PHOTO_SLOTS`.
- Sources are 1080×1350 (4:5, matching the spec from 09k) but **2 MB each as PNG — 80 MB for 40**. Converted to JPEG q80 at the same pixel size into `assets/characters/zNNN-{1..4}.jpg`: **21 MB total, ~300-400 KB each**. 1080px wide is exactly 3× the ~360px card, so there's nothing to gain from shipping more.
- **`CHARACTERS` in data.js is dead code** — nothing references it anywhere. Photos were briefly added there by mistake; reverted by targeted regex rather than `git checkout`, since data.js carries ~1,200 lines of the user's own uncommitted work. The live deck uses `GIRL_PROFILES` in **personas.js** (10 entries; a `grep -c "name:"` says 20 because `name:` also appears inside the systemPrompt prose).
- Pairing lives in one place: `PERSONA_PHOTO_SET` at the end of personas.js maps persona id → Z-id, and a single `forEach` attaches `photos`. Re-pairing is a one-line edit. Matched by eye from the QA contact sheet against each persona's name/city rather than by file order (Sumiko→Z003 East Asian/Osaka, Tiara→Z004, Victoria→Z002 hiking, Camila→Z007 Mediterranean, etc.).
- **Two are knowingly wrong**: Isha (Mumbai) and Hana (LA, East-Asian-coded name) got the leftover sets because this batch contains no South-Asian set and only two East-Asian ones for three such personas. Flagged for the next batch.
- Rendering: `buildCardElement()` emits an `<img>` for slot 0 when the profile has photos (placeholder colour-block + "Card N" label remain the fallback for those without), `_navigateCardPhoto()` swaps `src` per slot via a `card._profile` reference, and the detail sheet uses photo 0 over the existing gradient so a slow/failed load never shows a bare box.
- Verified: all 4 slots load at 1080×1350 with `object-fit: cover` / `object-position: 50% 40%`, no failed requests, placeholder label correctly gone.

### 2026-10-09m — Full-bleed card layout (design test)
- New layout: the photo fills the entire card and the name / occupation / info button / Skip+Interested row sit **over** it behind a gradient scrim, replacing the white panel below the photo.
- Gated behind one constant, `CARD_FULL_BLEED` in script.js, which adds `.swipe-card--full`. Flip it to `false` to get the panel layout back — nothing else needs touching. Body/divider/actions were wrapped in `.swipe-card-overlay`, which is `display: contents` in the panel layout so that layout is bit-for-bit unchanged.
- Scrim is theme-aware via `--card-scrim-rgb` (white in light, `14,12,9` in dark), following this file's existing `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` + `:root[data-theme="dark"]` pattern. `--text` already flips on its own, so only the scrim colour needed an override.
- The blur **ramps** rather than being uniform: a `::before` with `backdrop-filter: blur(14px)` masked by a `linear-gradient(to bottom, transparent 0%, #000 48%)`, so it starts at zero and reaches full strength where the text sits.
- **Fit, measured, not guessed.** Card ratios are 0.53 (16 Pro Max) → 0.61 (13/14), vs 0.857 on the SE. Against a 4:5 (0.800) source with `cover`, that means **only ~66-77% of the image WIDTH is visible** on modern phones — measured 77% on a 390pt screen. Faces survive (they're centred and the crop is horizontal) but background/context is lost at the sides. The panel layout cropped far less because its photo box was much closer to 4:5.
- **Therefore: if this layout ships, future batches should be generated taller** — 2:3 (1080×1620) or 9:16 (1080×1920) — rather than 4:5. `--card-photo-ratio` exists for exactly this.
- **Perf caveat worth remembering:** `backdrop-filter` lives inside a card that is transformed every frame during a drag, and this session already traced a visible flash to backdrop-filter layer churn on the tab bar. If the deck feels heavy on device, the masked-blur block is the first thing to delete — the scrim alone still works.

### 2026-10-09n — Uncropped card photo: true ratio + blurred backdrop
- Follow-up to the full-bleed layout: `cover` was cropping ~25% off the sides (the card is ~0.53-0.61 wide-to-tall, the photos are 0.80). Worth stating precisely, since it's easy to misread as distortion: `cover` never stretches — it preserves aspect and crops. What looked "stretched" was the zoom.
- `.swipe-card--uncropped` (constant `CARD_PHOTO_UNCROPPED` in script.js) switches the photo to `object-fit: contain` so the whole frame is visible, and adds a second `<img>` behind it — the same image, `cover`, `blur(24px) saturate(1.25)` and `scale(1.18)` — to fill the remainder instead of leaving bars. The scale is what stops the blur fading out at the card edge; it needs pixels past the border to sample.
- **Top-aligned (`object-position: 50% 0%`) on purpose**, so all the leftover space collects at the bottom where the scrim already is. Measured result: the blurred filler is **never visible below the photo on any device** — 13/14 leaves a 131px gap but the scrim starts 115px above it; 16 Pro Max leaves 225px with the scrim starting 20px above. Only the SE shows any filler at all, as 11px side bars (it fits by height there, being the one card wider than 4:5).
- Both layers follow the slot in `_navigateCardPhoto()` — it now updates every `img` in the photo slot, not just the first.
- The backdrop layer is `display: none` in cropped mode rather than painted under an opaque photo for nothing.
- Net: this removes the reason to regenerate the batch taller. 4:5 sources now show in full. A taller source would still fill the card more completely without the blurred filler, but it is no longer a correctness issue — purely a look preference.

### 2026-10-09o — Scrim edge removed, and an edge-of-photos rubber band
- **The "barrier" in the card fade had two causes, both fixed.**
  1. The gradient was 4 stops with **linear** interpolation. A linear alpha ramp starts at a constant slope, and the eye reads that onset as a line drawn across the photo. Replaced with 13 stops following a smoothstep, so the curve leaves zero with near-zero slope and has no detectable start. (The alpha-0 stops deliberately repeat the same RGB — interpolating toward bare `transparent` passes through transparent-black and greys the ramp, which is a separate, commonly-missed cause of a dirty gradient.)
  2. The blur layer's own **element box** had a hard top edge at the overlay's top, which is a *second* line independent of the gradient. Its box now extends 80px above the overlay (`inset: -80px 0 0 0`) so that edge sits deep inside the fully-masked region, and its mask is eased to match.
  - Ramp length also went from 86px to 190px; a short ramp has to climb steeply, and steepness is what makes it visible.
- **Verified objectively, not by eye**: sampled per-row average luminance down the card and looked for discontinuities. Light mode: mean row-to-row delta **0.83**, with the only large jumps at the card border (99% down) and the button outlines — nothing in the ramp. Dark: ramp-region mean delta **0.51**, max 7.67. Useful technique to reuse for any "is this gradient banding?" question.
- **Edge-of-photos rubber band**: `_navigateCardPhoto()` previously `return`ed silently at the first/last photo, so there was no way to tell "nothing there" from "the tap missed". It now calls `_bounceCardEdge()`, which nudges the card 26px in the attempted direction with a slight rotation and springs back (0.34s), plus a light haptic.
- Two details that matter: the class is **removed and reflowed before being re-added**, or a second tap at the same edge does nothing (a running CSS animation won't restart otherwise); and a *successful* move clears the bounce classes, so the card can't be mid-rubber-band while the photo changes under it. Both are covered by tests.

### 2026-10-09p — Edge-bounce haptic actually fires on iOS; backdrop zoom reduced
- **The edge-bounce haptic was silent on device.** `_bounceCardEdge()` only called `navigator.vibrate?.(6)` — which **WKWebView does not implement**, so it did nothing on iOS. Added `_cineHaptic('LIGHT')` alongside it, the Capacitor Haptics call every other haptic in this file pairs with. Worth remembering: `navigator.vibrate` on its own is a no-op in this app's actual runtime; it's only there for the browser.
- Blurred backdrop zoom `scale(1.18)` → `scale(1.08)` on request. The scale exists purely to push the blur's soft edge outside the card (blur samples past the image border and falls off to transparent there), so lowering it risked washed edges — safe in practice because the backdrop is measured as 0px visible on every device except the SE's 11px side bars, and those still blend cleanly at 1.08.
- Scrim `::before` blur back to 14px from 16px. The eased multi-stop mask and the 190px ramp from 09o are kept — those are what removed the visible edge, and they're independent of the blur strength. Re-measured after: light-mode fade ramp mean row delta **0.44**, dark **0.62**, both slightly better than 09o.

### 2026-10-09q — Card photo reverted to the 09m cover-cropped look
- User pasted the 09m transcript back with "no not this version this version but haptic good already just ui" — i.e. keep 09p's haptic fix, revert the card's look to 09m. `CARD_PHOTO_UNCROPPED` is now `false`, so the photo is a single `object-fit: cover` layer filling the card again; the blurred backdrop copy added in 09n is hidden by the existing `:not(.swipe-card--uncropped)` rule, not deleted.
- **Deliberately kept from 09o**: the 13-stop smoothstep scrim gradient, the 190px ramp and the eased blur mask. Those were a direct answer to "i need like the cleanest fade and transition as possible" and are independent of which photo mode is on — reverting them would reintroduce the "barrier" the user had complained about. Only the photo layer changed.
- Crop is back to what 09m measured: 100% of the width visible on the SE (which is wider than 4:5 and crops vertically instead), 77% on a 390pt screen, 67% on the 16 Pro Max. So the earlier note stands — if this layout ships, generate the next batch taller (2:3 or 9:16) via `--card-photo-ratio` rather than 4:5.
- Both constants are still live switches: `CARD_FULL_BLEED` (panel vs full-bleed) and `CARD_PHOTO_UNCROPPED` (cover vs contain+blurred filler). Three of the four combinations are known-good; this is cover + full-bleed.
- Lesson for this stretch of work: "revert the blur to the one I liked" was ambiguous across two different knobs (the scrim's blur strength vs. which photo layer is on), and I picked the wrong one in 09p. When a revert request names a build only by position ("2 ago"), list what actually differs between those builds and say which difference is being reverted, rather than picking the one that seems most likely.

### 2026-10-09r — Photo-count bar on cards, cross-fade between photos, photo slot survives a re-render
- **4-segment bar at the top of every card** (`.swipe-card-progress`, one `<span>` per `SWIPE_PHOTO_SLOTS`), active segment solid white, the rest translucent. `pointer-events: none` on purpose — the photo's own left/right tap halves are what navigates, and a hit target up there would eat those taps. The "Top Match" pill moved from `top: 14px` to `26px` to sit under it.
- **The unfilled segments were invisible on a bright photo** at first, and a `drop-shadow` on the bar did not rescue them: a shadow's alpha scales with its source's, so a 45%-opacity white bar casts a 45%-strength shadow. Fixed with a short dark scrim behind the bar (`.swipe-card-progress::before`, 56px, fading to zero) — the same thing every photo-stepper does. It doubles as backing for the Top Match pill.
- **Cross-fade on photo change.** The photo markup is now two stacked `.swipe-card-photo-layer` divs, each holding the main image and (in uncropped mode) the blurred backdrop, so the pair always moves together. `_setCardPhoto()` points the *inactive* layer at the new slot, waits for `img.decode()` so the fade can never reveal a half-painted image, then promotes it.
- **Only the incoming layer animates.** Fading the outgoing one out at the same time lets the card's black background show through at the midpoint and reads as a dip to dark — instead the outgoing layer stays fully opaque and simply drops to `z-index: 0` underneath, where it is completely covered. The entrance is a one-shot `is-entering` class stripped on a timer, never a permanent `animation` property (2026-10-09j).
- A `cardEl._photoGen` counter guards a fast double-tap: two `decode()` calls can be in flight at once and without it the slower one can land last and show the wrong slot. Verified: tap, 30ms, tap → lands on slot 4, not 3.
- **The photo slot now survives a re-render.** `renderDeck()` wipes and rebuilds every card, so `data-photo-index` reset to 0 on anything that re-renders — including simply leaving the Practice tab and coming back. `_cardPhotoIndex` (keyed by profile id) records the slot in `_navigateCardPhoto()` and `buildCardElement()` restores it. Cleared by `_forgetCardPhotoIndexes()` whenever the deck is reshuffled from scratch, so a profile coming back around later starts on photo 1.
- Verified with real synthetic touch taps: segment count/active tracking, mid-fade state (outgoing opacity 1 at z 0, incoming mid-animation at z 1), `is-entering` stripped afterwards, left-tap steps back, leaving to Chats and returning keeps both the slot and the image, and the edge bounce still fires at the last photo.
- Test gotcha: `document.createTouch` is WebKit-only and `new Touch()` is Chromium-only — a touch helper needs both, or it throws on whichever engine it wasn't written for.

### 2026-10-09s — The giant white hand: two stacking/selector bugs in the practice tutorial
- Symptom (on device, once per install): the practice tutorial's swipe-right lesson drew a huge white hand/arrow blob over an undimmed card. Two independent bugs, both self-inflicted, both only visible on a screen my own tests never opened.
- **1. `.swipe-card-photo img` was reaching the tutorial's own images.** That rule (added 09k to make real photos render) matches *any* `<img>` inside the photo container — and `_showPracticeTutorialStep()` inserts `.ptw-swipe-hand` in exactly there. `.swipe-card-photo img` is (0,1,1) and `.ptw-swipe-hand` is (0,1,0), so the generic rule won and the 64px hand became `width:100%; height:100%; object-fit:cover` — a full-card cover-cropped blob. Fixed by scoping it to `.swipe-card-photo-layer img`, so it can only ever reach the photo layers. (`.ptw-photo-zone img` escaped this only by accident: it's the same specificity and happens to be later in the file.)
- **2. 09r's photo layers silently defeated the tutorial dim.** `.ptw-dim::before` is `z-index: 1`, and the new `.swipe-card-photo-layer.is-active` was also `z-index: 1` in the same (card) stacking context — a tie, broken by tree order, which the later photo layer wins. The plain `<img>`s it replaced had no `z-index` at all, so they sat harmlessly below. Fixed by wrapping the pair in `.swipe-card-photo-stack` with `isolation: isolate`, which keeps their 0/1 to themselves and puts the pair back where the bare images were — rather than renumbering the dim/overlay/badge, which would also have moved the dim above `.swipe-card-overlay` and dimmed the name and buttons.
- **General rule this is the second instance of: a descendant selector on a container that other code injects into is a trap.** Scope "the photo fills the box" rules to the element that IS the photo, never to `img` inside a region. Same for `z-index`: adding one to an element that previously had none changes where it lands in the *card's* stacking context, not just relative to its sibling — contain it with `isolation` instead of competing.
- Verified: hand back to 64×64, photo-nav icons 44×44, dim measurably darkens the card (mean luminance 118.9 → 74.6 over the photo area), and `_finishPracticeTutorial()` leaves no overlay or `ptw-dim` behind. Added `test_tutorial.js` to the suite — the tutorial had no automated coverage at all, which is why both of these shipped.
- Noticed but NOT changed (not part of the report, flagged to the user): in the full-bleed layout the lesson's sub-text now sits over the scrim's light region rather than a dark photo, so its contrast is weaker than it was in the panel layout.

### 2026-10-09t — Chats-list header gear removed
- The placeholder gear added to the Chats tab header in 2026-10-05f ("behaviour still to be decided") is gone — no action was ever decided for it. That entry above is now out of date on this one point.
- Nothing needed to replace it: `.app-header` is a `38px 1fr 38px` grid, so the right-hand track keeps its width with an empty cell and the Zelo wordmark stays centred (measured: 0px off-centre). An empty `<span>` is left there with a comment, so the next person doesn't assume the cell is missing.
- Untouched: the Practice/Home header gear (`openSettingsPracticePrefs()`) and the in-conversation gear (`openChatSettings()`) — both have real actions.

### 2026-10-09u — The tutorial swipe hands were ~30% oversized (the real "zoomed in")
- Follow-up to 09s, which fixed the hand being blown to full-card size by a stray selector. It was still reported as zoomed, and it genuinely was — just by a much smaller factor that the earlier fix didn't address, because 09s only restored the *previous* size without ever checking that size against the design.
- **Measured from the reference sheets the crops came from** (`design-refs/unused-icons-archive/New practice outline, swipe right.png` and `… left.jpg`) rather than judged by eye: in the right-swipe reference the hand is 11.19% of the card's width; in the left one it is 9.41% of the frame's width. The app was rendering them at 14.25% and 12.5% — roughly 30% too big in both cases, from two independent references that agree with each other.
- Fixed by sizing from those numbers: `.ptw-swipe-hand` 64px → 50px, `.ptw-swipe-hand--left` 46px → 35px. Verified at 11.14% and 9.54% of the card — within 0.15% of the references.
- **`object-fit: contain` means the CSS box is not the drawn size.** The first version of the regression assertion compared the 50px *box* to the card and reported 15%, which looked like a failure; the drawn content is only 38.5px wide. Any "is this too big" check on a contained image has to compute `naturalWidth × min(boxW/naturalW, boxH/naturalH)`, not read the box.
- **Resolution is a separate, still-open limitation.** These sources are tiny — 84×109 and 50×53 (796 bytes and 1.5 KB) — and the reference sheets are themselves phone screenshots at the same scale, so no sharper original exists anywhere in the repo (searched). Even at the corrected size they are drawn at ~1.4× and ~2.0× their native pixels on a 3× screen, so they stay slightly soft. Properly sharp would need new artwork at ~150×200 and ~110×120, or accepting a much smaller on-screen size. Flagged to the user rather than silently resampling the assets.

### 2026-10-10a — The card scrim was eating taps (tutorial photo lesson); floating pill tab bar experiment
- **"Can't tap next photo" in the practice tutorial.** Root cause found only by testing in real WebKit (Chromium passed): `document.elementFromPoint()` over the photo-nav lesson's tap zone returned `.swipe-card-overlay`, not the lesson overlay. 09o gave that scrim `padding-top: 190px` to lengthen the fade ramp — nothing is *drawn* in that padding, but the element's BOX covers the middle of the card, and at `z-index: 2` later in the DOM than `.swipe-card-photo` it won hit-testing over everything inside the photo.
- The failure was total, not partial, because of a second-order effect: `onDragStart`'s `closest('.ptw-photo-nav-overlay')` guard missed (the target was the scrim), so the drag armed, `onDragEnd` called `preventDefault()` on the touchend, and the synthesized click never happened — while `_practiceTutorialActive` separately blocked tap-to-navigate. Tap did nothing at all.
- Fixed with `pointer-events: none` on `.swipe-card--full .swipe-card-overlay`, re-enabled on just `.swipe-card-info-btn` and `.swipe-action-btn`. Taps elsewhere now fall through to the card, which is what drives tap-to-change-photo anyway. Verified in WebKit: lesson tap dismisses, deck taps hit `.swipe-card-photo-main`, and Skip / I'm Interested / info all still hit-test clean.
- **Lesson: a decorative overlay sized by padding is an invisible hit target.** Any `position:absolute` scrim whose box is bigger than its ink needs `pointer-events: none`, or it silently steals input from whatever is underneath. This is the third hit-testing/stacking bug in a row caused by the full-bleed overlay's geometry.
- **Also: Chromium is not enough for tap bugs.** This file already said to use real WebKit; the 09r/09s rounds were Chromium-only and both shipped a bug that WebKit reproduced on the first run. The WebKit binary needs an explicit `executablePath` (`~/Library/Caches/ms-playwright/webkit-2359/pw_run.sh`) because playwright-core here expects a different revision folder.
- **Floating pill tab bar** (`TAB_BAR_FLOATING` in script.js → `.tab-bar--floating`), a trial of LINE's bottom-nav look: detached bar inset 14px, fully rounded, solid rather than frosted, with the existing sliding indicator restyled into a soft grey chip behind the active tab. Every rule is scoped to the modifier class, so flipping the constant off restores the frosted bar exactly. `updateTabGlassPill()` needed no change — it positions from live rects.
- Two things that caught me there: `--s1` is *translucent* in dark mode (it only ever worked because the frosted bar blurred what showed through), so the solid variant needs its own opaque dark fill; and overriding `.scan-fab`'s negative `margin-top` pushed the "Scan" label out of the shortened bar — the original value is load-bearing, left alone.
- NOT added: the red count badges in the reference. There is real unread data (`chat.unread`) to drive one, but badges weren't asked for.

### 2026-10-10b — Tab indicator extended to Scan
- `updateTabGlassPill()` had an explicit `name !== 'practice' && name !== 'chats'` early-return that hid the sliding indicator whenever Scan was selected. Removed; it now tracks all three tabs, with the "is this a real tab button" check (`!btn`) left as the only thing that hides it. The chip sits behind the Scan FAB and around the label, and reads fine in both themes.
- **This surfaced a latent bug that only bites now.** The indicator rests at `translateX(0)` until first positioned, and Scan is the tab the app launches on — so its first placement would animate, sliding in from the bar's left edge on every launch. Previously invisible because Scan hid it outright. Fixed with a `_tabPillPlaced` latch that does the first placement with `transition: none` + reflow + re-arm next frame (the pattern already standard in this file), so only real tab switches animate.
- Verified: 6 consecutive frames after launch show zero drift; all three tabs centre to 0px with opacity 1; a real switch is still 74px from target 80ms in, i.e. genuinely animating rather than jumping.

### 2026-10-10c — Scan indicator becomes a ring around the FAB
- A rounded rectangle behind Scan was almost entirely hidden by the FAB, leaving only a sliver — which is what read badly. `updateTabGlassPill()` now gives Scan a circle concentric with the FAB and slightly larger, so what stays visible is an even ~6px ring wrapping the whole button. Same fill as the rectangle, so the two states morph instead of swapping; `height` and `border-radius` joined the transition to make that read as one liquid shape change.
- **Specificity trap worth remembering:** each bar variant sets the indicator's resting radius with a DESCENDANT selector (`.tab-bar--floating .tab-glass-pill`, 0-2-0), which outranks a lone state class (`.tab-glass-pill--ring`, 0-1-0). The first attempt silently rendered the "circle" as the variant's 26px rounded rectangle. A state class that has to beat a variant rule must be restated at matching specificity for each variant.
- **Size the ring from the FAB's LAYOUT box, not its visual rect.** `.tab-btn--scan.active .scan-fab` is `transform: scale(1.05)` with a 0.15s transition, so a `getBoundingClientRect()` taken right after the tab changes can be mid-scale, and the ring settles too tight (measured 70px where 73 was wanted). `offsetWidth` ignores transforms and is stable; the centre still comes from the rect, since a symmetric scale doesn't move it. `TAB_PILL_RING_PAD` (15) is sized against the layout width and accounts for that 1.05 — re-derive it if the CSS scale changes.
- The ring's tint is a little stronger than the rectangle's (0.10 / 0.16 vs 0.06 / 0.10). A ~6px-thick shape reads noticeably lighter than a large block at the same alpha, so matching the numbers would not have matched the weight.
- Verified: ring is 73×73, `dx`/`dy` 0 from the FAB's centre, 6.1px gap all round; Practice/Chats return to 101×52 at 26px radius; launch placement still instant; a real switch still animates.

### 2026-10-10d — Scan ring removed; indicator travels to the middle and fades instead
- Reverts 10-10c's ring. The indicator keeps its rounded-rectangle shape everywhere and still travels to Scan's position, but fades out as it arrives and fades back in as it leaves — so the movement is what reads ("the glass goes to the middle", then later comes back out of the middle toward the tab you picked) with nothing parked awkwardly behind the FAB.
- The fade is 0.3s against a 0.4s travel, deliberately overlapping rather than fading in place first. All the ring machinery is gone: `TAB_PILL_RING_PAD`, the `--ring` class and its per-variant radius/tint overrides (grep confirms zero references left in both the source and `www/`).
- Verified: Practice/Chats 101×52 at opacity 1, Scan 101×52 at opacity 0, shape stays rectangular everywhere, launch placement still instant, and on leaving Scan the indicator is measurably between the centre and its target at 60ms (x 144.7 → 86.5, opacity 0.22) rather than jumping.
- **Test note:** the indicator's easing (`cubic-bezier(0.22, 1, 0.36, 1)`) is heavily front-loaded — ~58px of a ~75px journey is covered in the first 60ms. An "is it still near where it started" assertion fails against it even when the animation is correct; assert the value is *between* start and target instead. Same property already recorded for the long-press menu (2026-10-09a).

### 2026-10-10e — Five fixes: tutorial swipe speed, DOB gate, confirm-profile sheet, detail handle, instant next card
- **Tutorial swipe-right → swipe-left felt slow.** Nothing was waiting on logic: `commitSwipe()`'s fly-off is a deliberate 0.7s "thrown with mass" animation, and the next lesson only renders on its `transitionend`. During the tutorial the throw is purely dead time between lessons, so it now runs at 0.26s while `_practiceTutorialActive`; real swiping keeps 0.7s.
- **Next card took ~700ms to appear, and its text jumped up as it did.** Traced with a per-frame sampler through a real swipe: the new top card first existed at **t=722ms**, and the card visible behind it until then is `scale(0.95) translateY(10px)`, so promotion snapped the name 52px upward. Both are the same root cause — the deck only advanced in `onFlyOffDone`.
  - Fixed by advancing at the START of the throw: the flying card gets `.swipe-card--flying` (z-index 10, `pointer-events:none`) and loses its `data-stack` so it leaves the stack's numbering, and `renderDeck({ keep })` rebuilds the deck *underneath* it instead of wiping it. `onFlyOffDone` now only removes the card. The redundant `renderDeck()` calls in the skip path, the tour path and `_handlePracticeTutorialSwipe()` were removed with it.
  - Re-measured: next card present at **t=13ms**, already full size with its photo decoded, and **1 changed frame out of 96** — it is completely still for the whole throw.
  - Added `_preloadDeckPhotos()` (next 3 profiles' first photo) since the promoted card is a fresh element with a fresh `<img>`, so even a cached photo costs a decode on first paint.
  - **Reparenting was deliberately avoided** — moving the flying card to another container would restart/cancel its transition (2026-10-09j). Keeping it in the deck and rebuilding around it sidesteps that entirely.
- **Birth date**: opens on a fixed `DOB_DEFAULT_DATE` ('2008-07-17') instead of a date derived from today, and `DOB_MIN_AGE` (18) is now a **hard gate** — a date making the user under 18 is not written to `zelo_birthdate`/`zelo_user_age` at all, and `_flashAgeGateToast()` says why (the sheet is reachable from Edit Details, which has no `#cine-age-warn` to write into, so it needs a toast as well as the inline note). This replaces the old soft "a few features are limited" message.
- **NOT done — "auto-save if you scroll then tap outside".** The age sheet is a real native `UIDatePicker` (`@capgo/capacitor-date-picker`); it only resolves a value on Done, and a tap outside resolves as Cancel. Changing that means patching the plugin's Swift (the repo already patches it via patch-package) and an Xcode rebuild — flagged to the user rather than silently attempted or silently dropped.
- **"Let's confirm your profile" is now a bottom sheet.** `#practice-confirm-profile` keeps `.practice-tutorial-welcome` (so its content styling is untouched) but acts as the scrim, with its children wrapped in a new `.practice-sheet-card`: `top: 11%`, 26px top corners, grab pill, slide-up entrance, drag-down to dismiss past 110px — the same geometry and threshold as the AI Coach and profile-detail sheets. There is no cancel path for this step, so a dismissal resolves the same way **Continue** does rather than leaving the tutorial with nothing on screen.
  - Wrapping the children broke `#practice-confirm-profile > .home-brand` (a direct-child selector pinning the wordmark to the top) — it fell back into the centred flex flow and crowded the title. Fixed to a descendant selector with `top` now relative to the sheet card. **Any time content is wrapped in a new element, grep for `> ` selectors targeting it.**
- **Profile-detail (i) sheet**: the grab pill was a flex sibling above the photo, reserving ~17px and reading as a white band. It is now absolutely positioned over the photo in translucent white with a soft shadow, so the picture starts at the sheet's top edge.
- Verified: sheet at y=93 (11% of 844) in both themes with the deck dimmed behind, a 40px drag springs back, a 220px drag dismisses and advances `_practiceTutorialStep` to 4; full regression suite green.

### 2026-10-10f — Lesson text decoupled from the throw; Edit Details sheet; tap-outside = Done (NATIVE)
- **Reverted 10-10e's tutorial fly-off speed-up.** Shortening the throw to 0.26s was the wrong lever: the delay was never the animation, it was `_showPracticeTutorialStep()` running on `transitionend`. `flyMs` is back to a single 0.7s everywhere, and the tutorial advance now runs as the throw *begins* (it can, because 10-10e already promotes the next card at that moment) with a `tutorialHandled` latch so `onFlyOffDone` doesn't repeat it. Measured: next lesson's text at **35ms**, card gone at **707ms** — text instant, throw keeps its full weight.
- **Edit Details now uses the same sheet as confirm-profile.** `_attachPracticeSheetDrag(cardId, onDismiss)` generalises the drag helper; Edit Details' dismiss is `practiceCloseEditDetails()` (its back button), which is safe because every field there saves on pick — there is no draft to discard.
  - Wrapping its children broke two more direct-child selectors (`#practice-edit-details > .home-brand`, and `.ped-back-btn`'s `env(safe-area-inset-top)` offset, which double-counted once it was inside a sheet that is already inset). Second time this exact trap has bitten in two builds — **wrapping content means grepping for `> ` selectors AND for safe-area offsets that assumed the screen, not a sheet**.
- **Name placeholders**: `placeholder="e.g. Alex"` → `"John"` on both name inputs, and the two `|| 'Alex'` display fallbacks → `'John'`.
- **Tap outside the birth-date wheel now commits, like Done (NATIVE — needs an Xcode rebuild).** The dim's `UITapGestureRecognizer` was wired to `cancelTapped`. It now calls a new `dimTapped`, which goes straight to `onDone?(picker.date)` — deliberately NOT `doneTapped`, because in `dateAndTime` mode that advances the wheel to its time stage instead of resolving, and a tap outside should finish. Cancel remains as a button.
- **patch-package trap on this exFAT drive, worth knowing.** Regenerating the patch produced a 22.7 KB diff touching 37 files including binaries — because exFAT reports every file as mode 100755, so a clean reinstall differs by `old mode`/`new mode` on everything. Deleting `._*` and setting `COPYFILE_DISABLE=1` did not help; the fix is to strip mode-only blocks (and the Xcode `xcschememanagement.plist`) after generating. Back to the original 3-Swift-file shape, and `git apply --check --reverse` confirms it matches node_modules exactly. The first regeneration overwrote the committed patch — recovered with `git show HEAD:<path>`, so **check the regenerated patch's file list against the committed one before trusting it.**

### 2026-10-10g/h — Confirm-profile waits for the throw; deck image memory cut back
- **"Confirm your profile comes in too fast."** 10-10f moved the whole tutorial advance to the start of the fly-off, which was right for the lesson TEXT but wrong for this: the sheet arrived while the card was still flying and read as barging in. `_handlePracticeTutorialSwipe(direction, phase)` is now two-phase — `'start'` does the instant text swap (and the wrong-way re-show), `'end'` does only the confirm-profile handoff, run from `onFlyOffDone` via a `tutorialNeedsFinish` flag. Measured: lesson text at **48ms**, sheet at **705ms** against the card leaving at **706ms**.
- **Reported on device: Milestones icons broken and the onboarding video black.** Ruled out the obvious first — every asset is present in `www/` and `ios/App/App/public` (473 files each, byte counts match), and all 46 Milestones images load with zero broken in **both Chromium and WebKit**. So not missing files, not the engine, not a path problem.
- **The suspect is memory, from my own 10-10e change.** `_preloadDeckPhotos()` called `new Image()` on the next 4 profiles' photos every `renderDeck()`. These are 1080×1350, which is **~5.6 MB of bitmap each once decoded** — ~22 MB of preload on top of the deck's own ~17 MB, on every swipe. In a memory-constrained WKWebView that is exactly the kind of pressure that makes unrelated image decodes fail and media go black.
- Removed it, and confirmed it bought **nothing**: the promoted card reuses the src the card behind already loaded, so it reports `complete` on the first frame regardless — re-measured at t=12ms with `imgComplete: true`, still 1 changed frame in 96.
- Also stopped emitting `.swipe-card-photo-bg` when `CARD_PHOTO_UNCROPPED` is false. It is `display: none` in cropped mode, but **a hidden `<img>` with a src still downloads and decodes** — ~5.6 MB per card for something never drawn. Deck now holds 6 img elements / 3 unique srcs / **16.7 MB** decoded, down from 38.9 MB.
- **NOT proven** — device memory pressure can't be reproduced from here, and this is a hypothesis fitted to two symptoms that share one plausible cause. If the icons and video still fail after this build, memory is not it and the next place to look is whether that screen ever worked on device at all (its 2026-10-05a entry records browser verification only).
- **General rule: treat full-resolution `new Image()` preloading as a memory cost, not a free warm-up.** A 338 KB JPEG is 5.6 MB decoded; preloading four of them is not a small optimisation.

### 2026-10-10i — Conversational onboarding intro (Opal-style), replacing steps 1–2
- New `#cine-convo` screen, gated by `CINE_CONVO_INTRO` in script.js. "Get Started" now opens a scripted, typewritten exchange instead of step 1. Flip the constant to false and it routes to `cineGoTo(1)` exactly as before — **steps 1 (name/photo/birth date) and 2 (gender) are left fully intact in the markup, just not routed to**, so nothing is destroyed while the question flow is reworked.
- Sequence: "We'll help you text better." → "First, what's your name?" → pill input with the keyboard held open → "Hi, {name}." in accent → a lead-in line → tap → the first real question types out and its choices slide in staggered. Picking one stores the answer and enters the normal step UI at step 5.
- **The first question is "Be honest" (overthink, step 4), asked inside the conversation** so it keeps the same typewriter + slide-in rhythm rather than switching UI mid-thought. Its copy and four options are lifted from that step's own markup rather than reworded, so the two don't drift.
- **Lift, not re-centre.** `_convoRelift()` pushes the whole stage up by however far it has grown past 62% of the viewport, so each new line lands at a constant height instead of the block re-centring on every addition. The name step reuses it: showing the input lifts, submitting un-lifts back to the previous resting spot, then the greeting lands and lifts again — which is the "goes back down, then says Hi" behaviour that was asked for.
- **Haptic per character**, skipping spaces — a buzz on empty space reads as noise rather than as the letter landing. `navigator.vibrate` is paired with `_cineHaptic('LIGHT')` because the former is a no-op in WKWebView (2026-10-09p).
- The choices' slide-in class is stripped once it has played and replaced with a static `--shown` class — never left on the element (2026-10-09j).
- `cineGoTo()` calls `cineConvoTeardown()` on every entry: the conversation sits at z-index 1200 over every step, so any route into a step has to take it down or the step is live but invisible underneath.
- Colours are all theme tokens, so light mode gets black text and dimmed grey past-lines with no second rule — which is what the request asked for against a dark reference.
- Verified in WebKit, both themes: each line types in order, input is a real pill (999px) and takes focus, Continue stays disabled until the name validates, the name reaches `zelo_display_name`, the greeting renders, the question types, all 4 choices finish sliding in, and picking one stores `overthink` and lands on step 5 with the conversation torn down.
- **Open/not done**: no back button out of the conversation yet (it is a one-way intro); the reference's hero visual at the top was deliberately not added; and `source` (old step 3) is now unreachable from this route — flagged to the user rather than deleted.

### 2026-10-10j — Convo intro: first line centred, Done works, taps outside inert
- **First line sat at the bottom.** `.cine-convo` was `justify-content: flex-end`, so the opening line landed by the home indicator instead of mid-screen. Now top-anchored, with the stage placed by its own `--convo-top` (`CONVO.startAt`, 42%) and the existing lift transform only kicking in once growth would push the newest line past `CONVO.restAt` (62%). Measured: first line's centre at **43.6%** of the viewport. `--convo-top` is captured once on open rather than per line, so the keyboard changing the viewport height can't make the resting offset jump.
- **"Can't press Done" and "tapping outside goes buggy" were the same bug, and it was mine.** The keep-the-keyboard-up handler re-focused the input on every `blur`. Tapping outside therefore went blur → refocus → keyboard closes and reopens → the stack lifted and dropped, which is the jitter; and pressing Continue blurred the input on *its own* mousedown, so focus was yanked back before the click landed and the button could not be pressed at all.
  - Replaced with the opposite approach: a capture of `mousedown`/`touchstart` on the wrapper that `preventDefault()`s anything outside `.cine-convo-ask`, so focus is **never lost** rather than being fought back. A tap outside now genuinely does nothing, and the Continue button behaves normally because it is inside that container.
  - **Lesson: to keep focus, prevent the press that would steal it — don't re-focus after the blur.** Re-focusing is always a frame late, and it breaks every real control that needs the focus it just took.
- **The keyboard's Done/Return key had no handler at all** — only the button submitted. Added `cineConvoNameKey()` on `keydown`.
- Verified in WebKit, both themes: tap outside leaves lift (`-66px`) and focus unchanged and reports the event as prevented, Enter submits and the flow continues to the greeting, and the whole sequence through to picking the first answer still lands on step 5.

### 2026-10-10k — Conversation clears row by row, then the REAL question step types itself in
- The intro no longer builds its own copy of the first question. After the tap: `_convoClearLines()` empties the stack **bottom row first, upward** (70ms apart), the conversation fades out, and `cineGoTo(4)` hands over to the actual step. The in-conversation choice list and `CINE_CONVO_FIRST_Q` are gone — the page the user lands on is the real one, with its real progress bar, back button, footnote and Continue CTA.
- `cineRunQuestionEntrance()` (registered as `CINE_STEPS[4].entrance`) does the rest on that page: the heading block starts mid-screen where the conversation's text was, the title and lede type out with the same per-character haptic, the block settles to its resting position, then the options load in one at a time.
- **Typing with `textContent` would have flattened the markup.** The title is `Be <span class="hl">honest.</span>` — its accent half is a real element, and other steps' titles carry `<br>`. `_cineSnapshotRich()`/`_cineTypeRich()` walk the original child nodes and rebuild them progressively, so the accent span and line breaks survive. Asserted in the test (`hlKept`), because a plain-text typewriter would silently drop the colour and only be caught by eye.
- Options use a two-class entrance (`--in` hides, `--playing` animates) and **both are stripped once it has played** — nothing keeps an `animation` property (2026-10-09j).
- Back from the first question returns to the showcase rather than stepping into skipped step 3 (`source`), which the conversation route never shows.
- Verified in WebKit, both themes: clear order is exactly `[3,2,1,0]`, the active screen is `data-screen="4"` with the conversation hidden, the title keeps its `.hl` span, the lede types, all four options end visible with no leftover entrance class, and the intro class is removed.

### 2026-10-10l — Tap to skip the typewriter; icons-not-loading traced to decoded-image memory
- **Tap while a line is typing now finishes that line at once**, in both the conversation (`_convoType`) and the question step (`_cineTypeRich`), via a shared `_convoSkip` flag. One tap skips one line, not the whole script. `cineConvoTap()` returns early after a skip so the same tap is not also consumed as the later tap-to-continue. The question step has no tap handler of its own, so one is attached for the duration of its typing and removed after.
- **Bug caught before shipping:** the first version of the skip dumped `seg.text` wholesale. Plain-text segments are appended as separate text nodes, so that *duplicated* everything already typed. Fixed by tracking `typed` and appending only `seg.text.slice(typed)`. The test asserts against duplication explicitly.
- **"All icons not loading properly" on device — measured, and it is memory, not packaging.** Ruled out packaging hard: all 455 asset files are **byte-identical** between `www/` and `ios/App/App/public` (`diff -rq` clean), and a WebKit sweep of home/practice/chats/milestones/account shows **zero failed image requests**.
- What the sweep did show is the real problem — decoded bitmap memory, which accumulates as screens are visited:

  | screen reached | images loaded | decoded held |
  |---|---|---|
  | Home | 127 | 99 MB |
  | + Practice | 134 | 133 MB |
  | + Milestones | 176 | **154 MB** |

- The cause is assets shipped at far higher resolution than they render at — `hero-streak-flame.png` is **2.7 MB decoded for a 30px icon**, `chat-bubble-hero.png` **6.0 MB for a 169px element**. 155 assets are over 4 MB decoded each. At ~150 MB of live bitmaps a WKWebView content process starts evicting decodes and failing new ones, which presents exactly as icons not loading — everywhere, and worse the longer a session runs.
- **Capping every asset at 512px on the long edge would take the library from 1098 MB to 225 MB decoded (−80%)**, with no visible loss at the sizes these actually render. NOT done — it rewrites ~155 of the user's artwork files in bulk, so it needs their go-ahead and the originals kept.
- Note for whoever does it: `grep` for the filename first. The `assets/icons/Streaks milestones/` sheets (twelve 2138×736 files, 6 MB decoded each) are **referenced 0 times** — they are the source sheets the badges were cropped from and are not in `www/`, so they cost nothing at runtime.

### 2026-10-10m — Name + age on one page; no video flash into the question; offscreen videos paused
- **The intro now asks "First, what's your name and age?"** Continue does double duty: the first press takes the name and opens the **real native birth-date wheel** (`cineOpenAgeSheet()`, the same one Edit Details uses) on the same screen; the result lands on an inline `.cine-convo-age` pill and the stack lifts to make room (measured −66px → −142px); the next press moves on. Keeping it one button is why the age row is inline rather than a screen of its own. The under-18 gate still applies — a rejected date leaves the row empty, so Continue simply reopens the wheel.
- **"I see the video screen first, not the question."** Cause was my own ordering: the conversation faded out *before* `cineGoTo()` ran, so for the length of the fade it uncovered whatever sat beneath — the showcase screen and its demo video. The step is activated first now and the (already-empty) conversation fades out **over** it; `_convoHandingOff` stops `cineGoTo`'s own teardown from yanking the overlay away mid-fade. Frame-sampled across the handoff: **0 frames** with the showcase or a video visible, step 4 active from frame 0.
- **That reorder exposed a real coupling**: the question's typewriter used the conversation's timer pool, and `cineConvoTeardown()` clears it — which now happens *during* the typing, leaving the heading permanently half-written ("Be ho"). The entrance has its own `_cineQTimers` now. Worth generalising: **an async routine that outlives the thing that started it must not share its cancellation pool.**
- **Two videos were left playing on screens nobody was looking at** (found while frame-sampling, not reported). Both onboarding videos are autoplay+loop, so they kept decoding frames behind the question screen — pure CPU and decoded-frame cost on an app already measured near WebKit's image-memory ceiling (see 2026-10-10l). `_cineSyncVideoPlayback()` now pauses anything off-screen after each screen swap, and `_armCineShowcaseCycle`'s deferred `play()` is guarded on the showcase still being the current step, since it fires ~1s later and was starting playback on a screen already left.
  - **Pause-only, deliberately.** Forcing `play()` on whatever is visible fought both screens' own choreography — the showcase holds its video paused through the phone's entrance on purpose, and step 15 plays its own on entry. The test asserts only the real defect: nothing playing where nobody can see it.
  - **A visibility check must walk ancestors.** The first version checked only the `<video>`'s own rect and opacity and reported 79 "visible" frames for a video inside a `display:none` screen — the element keeps a real rect and opacity 1 of its own.

### 2026-10-10n — Two Xcode issues: the iPad orientation rule, and a build/sync race
- **"All interface orientations must be supported unless the app requires full screen."** A real misconfiguration, not noise: `TARGETED_DEVICE_FAMILY = "1,2"` (iPhone **and iPad**) with `UISupportedInterfaceOrientations~ipad` set to portrait only and **no `UIRequiresFullScreen`**. An iPad app that participates in multitasking must support all four orientations; a portrait-only one has to opt out. Fixed with `UIRequiresFullScreen = true` in `ios/App/App/Info.plist` (verified a 2-line diff, `plutil -lint` OK), which keeps the app portrait-only rather than forcing a landscape layout it was never designed for.
  - The alternative — dropping iPad with `TARGETED_DEVICE_FAMILY = "1"` — also silences it but removes iPad from the App Store listing, so it is a product decision and was left alone.
- **`xp-icon-quest.png` "couldn't be opened because there is no such file" was a race with my own sync, not a missing asset.** The file is present and valid in all three trees (29,603 bytes, decodes as a 167×157 PNG) and the whole bundle checks out: every asset byte-identical to `www/`, 0 unreadable files, 0 broken symlinks, and the only two zero-byte files are `cordova.js`/`cordova_plugins.js`, which Capacitor ships empty by design.
- **Mechanism, worth remembering: `npx cap copy ios` DELETES and rewrites `ios/App/App/public` wholesale.** A build that reads the folder during that window sees a file list that no longer matches what is on disk, and Xcode reports it as a missing file. Running that command backgrounded — as this session does constantly — makes the window easy to land in.
- **Protocol:** don't build while a sync is in flight. The "Not done yet" / "Done" wording already marks it; "Done" is the signal that `public/` is settled. If a build does land mid-copy, the error is stale state, not a real missing file — Product > Clean Build Folder and rebuild.

### 2026-10-10o — Continue registers, then the age row slides up, then the wheel
- Pressing Continue on the name used to open the native birth-date wheel straight off the tap: no sign the button had done anything, and the sheet appeared out of nowhere. It is three beats now — `_convoPressFeedback()` holds a pressed state on the button, `_convoRevealAgeRow()` slides the empty row up into place, and only then does the native wheel come over it.
- `:active` alone was not enough for the pressed state: it lasts only as long as the finger is down, which on a quick tap is too brief to read before the screen changes. `.cine-convo-cta--pressed` is held for `CONVO.pressMs` (170ms) instead.
- Verified by tracing the order rather than just the end state: pressed at **5ms**, row visible with its slide-up at **180ms**, native wheel requested at **480ms** — and both one-shot classes stripped afterwards. The test asserts the *ordering* (row after press, wheel after row), since all three ending up correct says nothing about whether they happened in sequence.

### 2026-10-10p — The recurring Xcode copy failures were AppleDouble junk, not timing
- Two builds in a row failed on `public/` — first "`xp-icon-quest.png` … no such file", then `copy(…/public/assets/icons/miles…)`. I blamed a build/sync timing race and told the user to wait for "Done". **That was wrong, and the advice did not help.**
- Actual cause, found by counting: after a `cap copy`, `ios/App/App/public` held **931 files against `www/`'s 471** — roughly 460 stray `._*` AppleDouble files. `npx cap copy ios` does its own copying without `COPYFILE_DISABLE`, so on this exFAT drive it manufactures one per file, and Xcode chokes on them. The existing `find ... -name '._*' -delete` only ran *after* the copy in the same command, so any run that was slow, backgrounded or interrupted left the whole set behind.
- Fixed at the source, not with a protocol: **web-only changes no longer go through `cap copy` at all** — the four changed files are written straight into `www/` and `ios/App/App/public/` with `COPYFILE_DISABLE=1`. Sub-second, no folder wipe, nothing for a build to race, and no AppleDouble files created. See the standing rule above.
- `cap copy`/`cap sync` are now reserved for asset/config/native changes, where the `._*` purge and a file-count check are mandatory afterwards.
- **Check that is worth keeping: compare file counts, not just `diff -q` on the four source files.** Every byte-level check I ran passed while 460 junk files sat in the bundle, because the files I was diffing were genuinely fine. `www` and `public` should differ by exactly 2.

### 2026-10-10q — Question text reveals letter-by-letter instead of typing, on every question step
- All six question steps (2-7) now use `cineRunQuestionEntrance`, and its text no longer types. `_cineRevealRich()` lays the whole line out up front as one span per character and fades them up in reading order — left to right, wrapping top to bottom on its own. Nothing reflows while it plays, which is the difference from the conversation's typewriter (that one still types, deliberately — it is someone speaking).
- **Spans are `display: inline`, and the reveal animates opacity only.** `inline-block` per character would let words break mid-word at a line end, and transforms don't apply to inline boxes — so a rise/slide per character is not available without wrapping whole words first. Spaces stay as plain text nodes so wrapping behaves normally.
- **Re-entering a question double-wrapped the text.** `_cineSnapshotRich()` read the live DOM, so a second visit (Back, or any revisit) snapshotted the already-split characters and wrapped each of them again, one span deeper per visit. It now stores the original markup in `dataset.cineOrig` on first use and restores from that every time. **Any "split the DOM up to animate it" helper needs this** — the element it reads is its own previous output.
- No per-character haptic here: at a 17ms stagger it would be a continuous buzz, and this is a reveal rather than someone typing. The conversation keeps its haptic.
- The heading's mid-screen→top travel (and its settle wait) now only happens for the conversation handoff; the other questions reveal in place, which also removed ~520ms of dead time before their options.
- **Two test-measurement traps worth keeping:** counting only fully-opaque characters reports "nothing revealed" mid-cascade — count anything that has *started* (`opacity > 0.05`); and forcing `cineGoTo()` while phase 1's own timers are still live runs the entrance twice, which looks like a real double-animation bug. Let the showcase settle first.

### 2026-10-10r — Question reveal sped up, opening line starts low, caret stops jumping
- **Reveal is now duration-capped, not a fixed per-character rate.** A flat 17ms stagger made long ledes crawl (step 6's ran ~1.6s) while short titles were fine — the wrong knob. `CONVO.revealMaxMs` (820ms) is a ceiling for a whole line: the stagger is squeezed to fit it when a line is long, and short lines still run at the full `revealMs` (now 14ms, fade 200ms). Measured: step 4 title 326ms / lede 802ms, step 6 title 550ms / lede 820ms — every line under a second.
- **The opening line now starts low and is pushed up by what follows.** The stage was anchored at `startAt` (42%), so line 1 appeared mid-screen and simply stayed there. Anchoring at `restAt` instead pins the stack's *bottom*, so the first line sits low and each new line lifts the ones above it. Measured: line 1 at **60.3%**, rising to **35.8%** once line 2 lands.
- **The caret "teleporting in from the top" was a focus-timing bug.** The input was focused 120ms after the ask appeared, while the stack was still travelling through its 420ms lift — and a text caret does not ride a transform, so it painted at the old position and jumped to the new one. Focus now waits `liftMs + 40`. Verified the box is genuinely stationary at that moment (same y, and still the same y 200ms later), not merely that the delay was longer.
- **Test note:** the first version of that check compared the box's position when it appeared against its position at focus and "failed" — but those *must* differ, since the lift happens in between. The question is whether it moves **after** focus, so sample again a moment later.

### 2026-10-11a — Question pages spawn normally; only the choices animate
- The per-character reveal is **gone** — question pages now just appear, and the only motion is the choices arriving one after another from the top. `cineRunQuestionEntrance()` is down to that single job: no text manipulation, no mid-screen→top travel, not even async. `_cineSnapshotRich`/`_cineSplitChars`/`_cineRevealRich`, the `.cine-rv*` styles and the `--q-intro` travel rules were all deleted rather than left dormant (grep confirms 0 references in both files).
- Stagger `CINE_OPT_STAGGER_MS` 55ms, each slide `CINE_OPT_ANIM_MS` 300ms (from 90/420). Measured per step: choices arrive at `[50,117,167,216]` for four, `[57,107,173,223,273]` for five — top to bottom, whole cascade inside ~270ms. Title is present at **5–8ms**, i.e. the page is not animating its text at all.
- The conversation intro keeps its typewriter and per-character haptic — that one is someone speaking, and was not part of this request.
- **The scratchpad was wiped overnight** (`/private/tmp` cleanup, date rolled to the 11th): the whole Playwright suite built over the previous days AND its `node_modules` are gone, and the local `python3 -m http.server 8936` had stopped. Only this round's new `test_spawn.js` exists. So this change is verified, but the broader regression suite is not — it no longer exists to run.
  - This is the **second** time tmp cleanup has eaten the tests (first recorded 2026-09-25s). Worth moving them into the repo (e.g. a `tests/` folder, git-ignored or not) so days of accumulated regression coverage stop evaporating. Not done unasked — it adds a directory to the user's project.
  - Recovery recipe when it happens: `npm i playwright-core` in the scratchpad, and `cd www && python3 -m http.server 8936`.

### 2026-10-11b — Choices paced to land separately; the date now finishes the name step
- Choice stagger 55ms → **85ms**, slide 300ms → **340ms**. At 55ms the group read as arriving at once; each one is now its own event. Measured: four choices at `[57,140,223,307]`, five at `[53,136,236,319,402]` — still well under half a second for the whole cascade.
- **"You have to press 2 times to continue" was real.** Pressing Done on the keyboard opened the birth-date wheel, and after committing a date the step *still* waited for a Continue press — two presses to answer one question. Committing a date IS the answer now, so it resolves on its own after `CONVO.ageSettleMs` (540ms), which is long enough to see the value land in the row.
  - Cancelling the wheel, or a date that fails the 18+ gate, stores nothing — so that path stays put and Continue simply reopens the wheel, unchanged.
  - The resolve moved into `_convoFinishName()` because it now fires from two places, and a bare `if (_convoNameResolve)` duplicated in both is how a double-resolve gets introduced later.
- Verified from a single Enter press with the wheel stubbed: wheel opened exactly **once**, age row at 180ms, age stored, greeting at 1564ms, name input hidden — i.e. the step completed with no second press.

### 2026-10-11c — Practice header buttons hidden until the practice tutorial finishes
- The profile button (opens Account) and the gear (opens Home settings) are hidden on the Practice tab until the tutorial is done — a tap on either mid-tutorial would pull the user out of it. `_syncPracticeOnboardingChrome()` toggles `.tab--onboarding` on `#tab-practice` from `zelo_mode_selected`, the same key `_finishPracticeTutorial()` already sets, so there is no second flag to drift. It runs on every Practice tab entry, so leaving and returning mid-tutorial keeps them hidden, and again at finish so they return.
- `visibility: hidden`, not `display: none`: `.app-header` is a `38px / 1fr / 38px` grid and removing a track would shift the Zelo wordmark. Verified 0px off-centre throughout, and the buttons visible again after finishing.
- Interpretation recorded: "the settings and the home settings" was read as the header's two buttons (profile → Account/settings, gear → Home settings). If only the gear was meant, drop the `.profile-btn` line in the rule.

### Onboarding flow audit (2026-10-11) — what the conversation route skips
- Current route: showcase → **convo (name + age)** → 4 Be honest → 5 Help with → 6 Attracted to → 7 Tone → 8 Referral → 9 Thanks → 10 Achieve → 11 Notifications → 12 Setting up → 13 Plan → 14 Save progress → 15 Trial → 16 Trial reminder.
- **Skipped by the convo route:** step 1's profile photo, step 2 (gender), step 3 (where did you hear about Zelo). Gender is no longer functionally used (the `cineTrialHeroSrc` it once fed no longer exists; it is only read to repaint the selection) — it and `source` are now only analytics rows in `onboarding_responses` (`ONBOARDING_KEYS` in records.js). So skipping them breaks nothing in the app, it just stops collecting two analytics answers.

### 2026-10-11d — Flow kept as-is; "where did you hear" parked; progress bar fixed
- Decision: **keep the current flow exactly** (showcase → convo name+age → Be honest → Help → Attracted → Tone → Referral → Thanks → Achieve → Notifications → Setup → Plan → Save progress → Trial → Reminder) and **drop "where did you hear about Zelo?" for now**. It is parked, not deleted: step 3's markup and the `source` analytics key (`ONBOARDING_KEYS`) are untouched, so re-adding it later is one routing change. Steps 1 (photo) and 2 (gender) are likewise left in place, unrouted.
- **Side-effect found and fixed:** the progress fill was `step / CINE_LAST`, so entering at step 4 started the bar **25% full** on the very first question, as if three steps were done. It is now measured over the steps actually shown (`(n − 3) / (16 − 3)` while the convo intro is on): first question **7.7%**, rising evenly to exactly **100%** on the last step. With `CINE_CONVO_INTRO` off the original numbering is untouched.

### 2026-10-11e — 125 personas imported (135 total), Other option mode, and the age filter finally works
- Imported Z011–Z100 (straight women) and O001–O035 ("Other option") from `Zelo New Character Tinder/03 Tinder Women`, 4 photos each = 500 new JPEGs (q80 4:4:4, 1080×1350, **119.9 MB** total; q76 4:2:0 would be ~82 MB). Manifest-driven (active post-audit paths only), pilots untouched. Library: **100 women + 35 Other option**; age groups 18–25: 53, 25–30: 41, 30–40: 41.
- Persona data lives in `personas-roster.js` (loaded after personas.js, before data.js): `ROSTER_DATA` (125 records: name, age, city, job, bio, `cat`, `band`, archetype) → `_rosterProfile()` pushes into `GIRL_PROFILES` with `category` (`women|other`), `ageGroup`, `photos`. Prompts are **templated from 6 archetypes** (shared texting-rules block copied verbatim from the pilots), so they are shorter/more uniform than the 10 hand-written pilots. Names/jobs/cities/bios were authored by me from the contact sheets.
- **Root cause the age filter never worked:** the preset was mapped to `age_pool` strings that didn't match the pilots' `'18-24'`, and the slider (`zelo_age_filter_min/max`) and strict toggle were never read at all. Replaced with `_ageFilterRange()` (min/max keys or preset; max ≥ 40 = open-ended; full 18–40 = any), filtering on each persona's real `age`. Strict (default) = hard filter; non-strict = in-range first. Slider/preset/strict changes call `_invalidateDeck()`. Empty result shows an honest "No one matches your filters" instead of "You've seen everyone". The tutorial deck ignores the filter (`ignoreSkipped`).
- Other option is a fourth "Who to practice with" choice (Settings → Practice Preferences). Women deck = category ≠ other; Other deck = category other. **Not added:** an Other option choice in Edit Details' attracted-to sheet or onboarding step 6 (needs an icon — ask). Men/Both still use the placeholder pool.
- Verified in WebKit (`test_roster.js`): 135 unique personas, all 540 photo URLs 200, deck counts, 8 mode/range combinations exact, soft ordering, empty state, slider/preset clear, and a chat call receiving a roster persona's full system prompt. Visual spot-check of 4 cards (light + dark) fine.

### 2026-10-11f — Persona photo memory audited; 17 oversized UI images downscaled (revertable)
- **Persona photos are not the memory problem.** Chat avatars, the chat list rows and the chat header use gradient + initial, never a photo; only the deck cards and the (i) sheet load persona photos (same URL, so one decode). Deck measured ~17 MB decoded. Going from 10 to 135 personas adds bundle size (~132 MB), not runtime memory.
- **The real cost is UI art shipped far above its rendered size.** Of 412 images outside `characters/`, 375 are referenced (252 MB decoded) and 37 are unreferenced reference mockups (134 MB decoded, 23 MB on disk, still shipped in `www/` — not touched, since a filename grep can miss dynamically built names).
- Measured each static `<img>`'s rendered size in WebKit and shrank only those whose source was >15% bigger than 3× the largest rendered dimension: **17 files, ~52 MB decoded saved** (e.g. `settings-icon-refer-friends.png` 1254² → 115² for a 38px icon). Images whose size could not be measured (dynamic/hidden, `new-paywall*`) were deliberately left alone.
- Originals: `design-refs/asset-originals-2026-10-11/assets/...` (same relative paths) — copy back into `assets/`, `www/assets/`, `ios/App/App/public/assets/` to revert.
- Not a 512px blanket cap: that would blur anything rendered full-width at 3× (a 390pt hero needs ~1170px). Size each asset to what it renders at.

### 2026-10-11g — Practice tutorial: typed full-screen "confirm your profile"; no more 40+ ages
- The confirm-profile **sheet is replaced by a full-screen typed conversation** (`#pc-convo`, `_pcOpen()` in script.js; reuses the onboarding intro's `.cine-convo*` styles but has its own small engine, because the intro's helpers are bound to its own ids). Script: "Nice. You've got swiping down." → "Now let's confirm your profile." → "So far, I know you as {name}, {age}." → **asks how they identify** (the conversation route skips onboarding step 2, so gender was never collected; stored in `zelo_onb_gender` + `cineAnswers.gender`, queued to `onboarding_responses`) → "Got it: {name}, {age}, {a man|a woman|non-binary}." with **That's me / Change something** → "Two quick things…" → **who to practice with** (Women / Other option / Men / Everyone, current answer pre-highlighted, writes `zelo_practice_mode`) → **age range** (18–24 / 25–30 / 31–39 / Any age, writes the same preset + min/max keys Settings uses, invalidates the deck) → "All set, {name}. Let's meet your first match." → lines clear bottom-first, fade, tutorial continues at the photo lesson.
- Tap while a line types finishes that line. Covers the tab bar (z-index 4500, `position: fixed`).
- "Change something" hides the conversation, opens the existing Edit Details sheet and returns via `_pcAfterEdit()`, which rewrites the recap line in place and asks again. Edit Details no longer shows the profile photo (`.pcp-avatar-wrap` hidden there) — the photo is only shown on Account and nothing else uses it. The old confirm sheet markup/code is left in place, unrouted.
- **No 39–40 ages:** the oldest persona is 39 (ages run 19–39), so "40+" was dead. Slider/ticks now 18–39 (top stop open-ended, label "39"), the "40+" preset row and preset entry are gone, `_ageRangeLabel()` reads e.g. "31–39". Stored `40` values from older sessions still count as open-ended. Checked every mode × age range gives a non-empty deck (smallest: Other option 25–30 = 11, 31–39 = 11).
- Test pitfall: `_practiceTutorialActive`/`_practiceTutorialStep` are `let` — `window.x = …` in a test does not touch them; assign the bare name. Also, after a click, waiting for "choices visible" matches the OLD choices still fading — wait for the next line's text instead.

### 2026-10-11h — Persona profile pictures, tap-outside continues the name step, practice typing pace
- **Profile pictures for all 135 personas:** a head-and-shoulders crop of each persona's `*_MASTER_REFERENCE_DO_NOT_IMPORT.png` (full-body on a near-white #fdfdfd ground; the white background is kept), 320×320 JPEG q88, ~17 KB each (2.2 MB total) → `assets/characters/{id}-pfp.jpg`. Auto-cropped, no hand drawing: the figure is found by thresholding against the corner pixel, the head width is read from the top 14% of the figure, crop side = 2.5× head width, centred on the head with a little headroom. Contact-sheet checked for all 135 (hijabs, buns, afros and short cuts all frame fine).
- Data: `p.avatar` — roster profiles in `personas-roster.js`; pilots in the `PERSONA_PHOTO_SET` loop in `personas.js` (so they follow the same Z-set pairing as their photos, including the two known-wrong pairings). Rendering: `_pfpImgHTML()` layers an `<img class="pfp-img">` over the existing gradient + initial (still the fallback). Used in the chat header, match overlay, Chats list rows, Matches rows, Skipped Profiles rows (records now store `avatar`; older records resolve it by id via `_pfpUrl()`) and the small in-thread message avatar. 320px decodes to ~0.4 MB, so this is not a memory concern (see 2026-10-10l).
- Name step: **tapping outside the input now does what Continue does** when the name is valid (the button could sit under the keyboard). A `_convoSubmitting` guard stops a tap-outside and a Continue tap from both firing; an empty name stays a no-op. Verified: wheel opened exactly once.
- Practice typewriter was genuinely faster than onboarding's (26/12/380 ms vs 30/14/420); `PC` now reads `CONVO`'s values through getters. Not copies: `CONVO` is declared far below `PC` in the file, so reading it at build time hits its temporal dead zone and breaks the whole script on load.

### 2026-10-11i — Practice tutorial: fixed photo-only demo cards, and the same card carries through
- **Why the card changed after the typewriter (my bug from 11g):** the conversation's preference writes called `_invalidateDeck()`, which marks the deck used up, so `_finishPracticeTutorial()` reshuffled a brand-new deck and the card under the photo lesson was replaced by a different one. Both `_invalidateDeck()` calls are gone from the `_pc*` code.
- Now: the tutorial deck is built with `initSwipeDeck({ tutorial: true })` → `PRACTICE_TUTORIAL_CARDS` = **Kendra (z019, age 24) on her 4th photo for "swipe right"**, **Haeun (z026, 21) on her 3rd for "swipe left"** (set through `_cardPhotoIndex`), then the normal deck. After the age/gender answers, `_pcRebuildDeck()` rebuilds the deck for the new preferences with `pin: <the card on top>` so that card stays on top whenever it still fits (the conversation covers the screen, but the user remembers it), and `exclude`s the two demo cards so they don't come straight back. If the pinned card does not fit the new preferences (e.g. they switch to Other option), it is swapped while the conversation still covers the deck — unavoidable.
- `_finishPracticeTutorial()` no longer rebuilds the deck: it just removes `.swipe-card--bare` from the existing cards, so the name/buttons fade in on the very same elements (verified `same node`).
- **Bare cards** (`.swipe-card--bare`, applied in `buildCardElement` while `_practiceTutorialActive`): no name, occupation, info button, Skip / I'm Interested or Top Match pill — the overlay is `visibility:hidden` (so the info button can't be hit either) and a separate `.swipe-card-bare-blur` layer (blur 26px over the bottom 54%, eased mask + faint tint) fades in over where the buttons were; both cross-fade back at the end. Photo progress bar kept (the photo lesson needs it).
- Interpretation recorded: "the blur must be quite bigger to fill in the gaps of skip and I'm interested" was read as: the bottom area should look like softly blurred photo, not an empty scrim band. Tune `height` / `blur()` on `.swipe-card-bare-blur`.
- Tests: `activeTutorial` must be set BEFORE `initSwipeDeck` for cards to build bare; the helper test asserts card identity (`===`), not just id, since a rebuilt card with the same id would pass an id check.

### 2026-10-11j — LGBTQ+ women label; wrong-way swipe repeats the same card; stray strip and photo bar removed from the tutorial
- **Label:** "Other option" → **"LGBTQ+ women"** everywhere it is shown (typewriter question, Settings "Who to practice with" row and its summary, `_pedAttractedLabel`, and the roster persona prompt's "side of the app" line). The stored value is still `other` and the persona category is still `other` — nothing saved changes. **"LGBTQ+ men" is NOT added**: there is no men's library, so it would just show the Men placeholder cards. Interpretation recorded: "still shows the same thing" was read as the rename not having been applied.
- **Wrong-way swipe:** swiping left on the "slide right" lesson (or right on "slide left") now brings the **same card straight back** (same photo slot) and repeats the lesson, instead of dealing the next card. `commitSwipe` has already advanced the deck by the time the handler runs, so `_handlePracticeTutorialSwipe` steps `swipeIndex` back one and rebuilds with `renderDeck({ keep: <the flying card> })`.
- **The "bit of red below" was the next card's photo peeking out under the top card** (stack 1 sits 10px lower at 0.95 scale). Bare tutorial cards behind the top one are now `opacity: 0`.
- **The 4-segment photo bar** is hidden on the two swipe lessons and appears at the photo lesson (`#card-deck.ptw-show-progress`, toggled in `_showPracticeTutorialStep` for step ≥ 4).

### 2026-10-11k — Back button in the profile questions, Man first, Continue above the keyboard, hidden card stays hidden while dragging
- **The card behind showing in dark mode was a drag bug, not a theme one.** `animateBackCards()` writes inline `opacity` (0.75→1) and `transform` on the stack-1 card on every touchmove, which outranks the stylesheet's `.swipe-card--bare[data-stack="1"] { opacity: 0 }` from 11j — so the next card appeared the moment a drag started (light mode just made it easier to miss). It now returns early for bare cards. **An inline style written by a drag handler beats any stylesheet hiding rule; hide through the handler, not around it.**
- **Name step, Continue under the keyboard:** `Keyboard.resize` is `none`, so the page never shrinks and the Continue button sat beneath the keyboard. The Capacitor `keyboardWillShow/Hide` handlers now publish `window.__zeloKbH` and fire a `zelo-kb` event; `_convoRelift()` lifts the stack until its bottom (Continue included) clears the keyboard by 18px while the name step is live, and drops back on hide. Headless can't raise a real keyboard, so the test sets `__zeloKbH = 336` and checks Continue's bottom (510 → 490, keyboard top 508). Tap-outside-to-continue from 11h is still there.
- **Practice questions now have a Back button** (top-left, `#pc-back`). The script is a step list (`_pcBuildSteps`: identify → recap → who → age); each step types its own lines once and remembers them. Back removes the current step's lines (bottom-first, same motion as the clear-out) and re-shows the previous step's choices with its answer highlighted — the earlier question is not typed again. No back on the first question. Answers are saved as they are picked, so changing one on the way back just overwrites it; the deck is rebuilt once at the end. A fade over the top ~84px stops scrolled-up lines colliding with the button.
- **Identify:** order Man, Woman, Non-binary, with **Man highlighted by default** (it is still a tap to continue — highlighted means pre-selected, not auto-advanced).

### 2026-10-11l — Quest bar replaces "Today's Top Match"; Top Match pill removed
- Removed the "Today's Top Match / Handpicked for you" heading and the per-card "Top Match" pill: there is no curation or ranking data behind either. The pill's markup is gone from `buildCardElement`; its CSS is left (harmless, unreferenced).
- New **quest bar** (`#quest-bar`, `_renderQuestBar()` / `_questCountLike()`): a white pill with a progress ring around a heart — "Finding your type" / "Like N more people to get started", counting real right-swipes outside the tutorial (`zelo_quest_likes`) towards `QUEST_LIKES_GOAL` = 10. At 10 it shows "You're all set / You've liked 10 people" for 4s, fades, and never returns (`zelo_quest_done`). Hidden-but-space-keeping during the practice tutorial (`#tab-practice.tab--onboarding`), same as the header buttons. Colours are tokens so dark mode follows.
- **Honest caveat, also told to the user:** nothing is learned from the likes yet — it is a goal bar, not a recommender (Tinder's equivalent feeds a recommender). If it should mean something, the next step is biasing the deck by what was liked (category / age band).
- Progress was set to start at 0 for everyone, including users who have already liked people before this build.

### 2026-10-11m — Quest bar resized so the card does not move
- It did move: the first quest bar was 64px tall plus 16px of padding (80px) against the old heading's ~54px, which pushed the card down ~26px (card top 193 vs 167 at 390×844). Resized to a 50px bar (36px ring) + 4px below = 54px. Measured card top is now **166px on 390×844, 430×932 and 375×667** — the same place as under the old heading (the old figure, ~167, was read off a screenshot, so ±1px). Any future change to the bar's height moves the card; re-measure `#card-deck [data-stack="0"]` top.

### 2026-10-11n — Chats: floating hold menu, Search in Chat, header search
- **Hold a chat row** (450ms; cancelled by >8px movement) now buzzes (`navigator.vibrate` + `_cineHaptic('MEDIUM')`) and opens a floating menu instead of the old settings sheet: the row lifts (blurred, dimmed backdrop; the lifted copy is a clone) and a 22px-radius card floats under it, right-aligned (above it when there is no room): **Pin Chat / Unpin Chat, Search in Chat, Reset Chat, — divider —, Delete Chat (red, always last)**. The press that opens it must not also open the chat on lift-off: `row._heldAt` makes `row.onclick` ignore the next 700ms. `openChatSettingsForRow()` is now unused (left in place; the in-chat gear still opens `openChatSettings()`).
- Pin sets `chat.pinned` (in memory, like the rest of `chatStore`, so it does not survive a relaunch); `renderChatsList()` sorts pinned first (stable) and shows a small pin by the time. Reset/Delete go through the existing `_showChatConfirm` → `chatSettingsReset()` / `onDeleteChat()`; `.chat-confirm-overlay` z-index raised 600 → 4700 so it sits above the new overlays and the tab bar.
- **Search sheet** (`#chat-search-overlay`, 11%-top sheet like the AI Coach one, swipe the header down to close): "Search in Chat" is scoped to one chat's messages; the new **pink magnifier in the Chats header** opens it across every chat — **PEOPLE** (name match) and **MESSAGES** (text match, newest first, hit highlighted). Empty field shows **Recent searches** (`zelo_chat_recent_searches`, max 8, per-item × and Clear All). Tapping a result opens that chat and scrolls to/highlights the message (`_scrollToMessage`); the term is saved as recent when a result is opened or Enter is pressed. The body pads by `window.__zeloKbH` (from 11k) so results are not under the keyboard.
- **Icons:** no pin / search / reset artwork exists in `assets/` (checked `chats-page/`, `Chats page/`, `misc/`; only a trash exists, and only white/black, not red), so all four are inline stroke SVGs (`_CR_ICONS`) in the same family as the header gear. This goes against "never hand-draw icons" only because no source existed — swap in real art if it is supplied; the reference screenshots were too small to crop.
- Verified in WebKit with real touch events, light + dark: 200ms press = no menu; 620ms hold = menu with the right order, MEDIUM haptic fired, old sheet untouched, no chat opened by the lift-off; pin reorders; scoped search; global search by name and message (5 "gym" hits across 3 chats); tap-through; recents; Clear All; reset (confirm → thread cut to the opener); delete (confirm → removed). Real device buzz/feel still needs a phone.

### 2026-10-11o — Chats: swipe-to-delete removed
- `attachSwipeDelete()` is no longer attached to chat rows (a left drag now does nothing); deleting a chat is **Delete Chat** in the hold menu. The function itself stays because **History's saved-thread rows and scan entries still use it** (script.js ~11683, ~12155) and have no other delete affordance — removing it there too would leave nothing to delete with. Say so if those should go as well.

### 2026-10-11p — Swipe-to-delete removed everywhere; History row sheet has no Cancel
- Reverses the 11o caveat: `attachSwipeDelete()` is **deleted** (function, its call sites on History threads and scan entries, and the `.swipe-del-*` CSS). Delete paths that remain: chats → hold menu; History threads → hold the row (Rename / Delete sheet); scan entries → the Edit toolbar (select + delete).
- The History row-actions sheet (hold a thread) lost its **Cancel** button; tapping outside the sheet already closes it (`#history-row-actions-overlay` has `onclick="closeHistoryRowActions()"`). The rename prompt's own Cancel was **not** touched — the request said "the cancel button" in History, and the actions sheet was read as that one; its Save button would be the only control left there.

### 2026-10-11q — Tab-bar drag glide, chat-settings icons, new pinned look
- **Drag across the tab bar** (`_initTabBarDrag()`): press and drag anywhere on the bar (past an 8px dead zone, so taps are untouched) and the glass indicator follows the finger — eased towards it each frame (0.32 lerp, so pick-up never jumps) and stretched `scale(1.1, 0.95)` for a liquid feel — dissolving as it crosses Scan, with a light tick and the label/icon of the tab under it previewing as `.tab-btn--hot` (the selected tab is dimmed meanwhile via `.tab-bar--dragging`). Release glides home on the normal 0.4s transition and opens the nearest tab (`showTab`), or just settles if it is the same one. The bar has `touch-action: none`, and `touchmove` is non-passive so a drag can't also scroll the page; the click that follows a drag is swallowed for 400ms (`__tabDragClickBlockUntil`). A plain tap still goes through each button's own `onclick`. Verified with real touch events (light + dark): tap/3px wiggle ≠ drag, practice→chats, chats→scan (glass opacity 0.1–0.16 near it), same-tab drag keeps the tab. The *feel* (lerp 0.32, 1.1×0.95 stretch) needs a phone.
- **In-chat settings sheet** (`#chat-settings-sheet`): the three PNG icons (reset / delete / mute) were replaced by inline stroke SVGs in the same family as the hold menu (rotate arrow, trash in red via the danger row, bell with a slash). The old `chat-settings-icon-*.png` files are now unreferenced.
- **Pinned look:** the 12px pin by the timestamp was too small. A pinned row now has a soft accent-tinted rounded background (`.chat-row--pinned`, extended 6px each side with negative margin so the avatar and text stay aligned with the other rows — the wrapper's `overflow:hidden` is lifted for pinned rows) and a 20px filled accent circle with a white pin beside the name (`.chat-row-pinbadge`). The hold-menu's lifted clone resets that margin (`.crm-lift .chat-row`).

### 2026-10-11r — Swipes locked while a like is in flight; likes count people once; quest resets each launch
- **Root cause of "swipe infinitely and the match page never shows":** since 10-10e the deck advances the instant a throw starts, but the match page (and the like count) only fire from `onFlyOffDone` when that card's `transitionend` arrives ~0.7s later. Nothing stopped a second/third swipe in that window, and each later `commitSwipe → renderDeck({keep})` removed every card except its own `keep`, so the earlier flying cards were deleted before their `transitionend` — no match page, no like. Reproduced with 3 fast right-drags: 3 commits, 1 match call, 1 like.
- Fix: `_swipeLock` is set when a RIGHT swipe commits and released in `onFlyOffDone` (1.6s safety timer so it can never stick). While set, `onDragStart`, `commitSwipe`, `onLikeBtn` and `onSkipBtn` are inert. Left swipes still chain, and `renderDeck` now keeps EVERY `.swipe-card--flying` card, not just the newest, so each skip's fly-off completes and its "skipped" record is written (3 fast lefts → 3 records; before, only the last survived). Re-verified: right ×3 fast → 1 commit, 1 match page, 1 like; lock releases; the next right swipe counts.
- **"One swipe = two likes":** could not reproduce a double count in isolation (one completed swipe = one like), so the likeliest explanation is the lost-flight bug above muddying the count. Made it impossible regardless of cause: the quest now counts **people** (`zelo_quest_liked` = ids), so the same profile, or any double-fired handler, can never count twice.
- **"Reset the 10 likes every time"** was read as: reset the quest on every launch, like the other DEV resets at the top of the DOMContentLoaded block (`zelo_quest_likes`, `zelo_quest_done`, `zelo_quest_liked` are now removed there). Remove those three lines if it should persist between launches.

### 2026-10-11s — Chat settings sheet slides instead of appearing
- `openChatSettings()` used to just flip `hidden`. The sheet now starts off-screen (base CSS: backdrop opacity 0, panel `translateY(100%)`), and a frame after un-hiding `.chat-settings-sheet--in` slides the panel up (0.34s, the same ease-out as the other sheets) while the backdrop fades in. `closeChatSettings()` removes the class, lets it slide down (0.26s) and only sets `hidden` 320ms later (`_chatSettingsHideTimer`, cleared on reopen so a quick reopen can't be hidden by a stale timer). On close it hands the panel's inline transform/opacity back to the stylesheet first, so a swipe-down carries on from where the finger left it instead of jumping. Interpretation recorded: "settings in change slide" was read as the in-chat settings sheet (the one with Reset / Delete / Mute).

### 2026-10-11t — Pinned chat: colour only
- The pin badge beside the name is gone; a pinned chat is shown purely by its pink-tinted rounded row (`.chat-row--pinned`, 8% accent). `_CR_ICONS.pinBadge` and `.chat-row-pinbadge` are left defined but unused. The hold menu still says Pin Chat / Unpin Chat, so the state stays discoverable.

### 2026-10-11u — "Press Continue twice" actually fixed (global keyboard-dismiss handler); back on the name step; Tell Zelo scrolls
- **Real root cause of the two-press Continue:** the global capture-phase `touchstart` handler near the end of script.js ("a touch outside a focused field dismisses the keyboard") blurs the field **and arms a one-shot capture `click` swallower + a full-screen `.kb-dismiss-click-blocker`**. Continue sits outside the focused name input, so the first press was consumed as "dismiss the keyboard" and its click was eaten; the second press (keyboard already gone) worked. The 11h/11k work (tap-outside submit, lifting Continue above the keyboard) never touched that. Found only because a synthetic `touchstart` → `click` pair on the new Back button reproduced the swallow (a bare `.click()` skips it, which is why the earlier tests passed).
- Fix: `#cine-convo` is exempt in that handler (it manages its own focus), alongside the existing exemptions for the AI Coach bar, chat composer and chat-settings sheet. Continue additionally submits on **touchstart** (`holdFocus`, with `preventDefault` so focus is held and the stack can't move under the finger); `_convoSubmitting` stops a following click from submitting twice. **Any new surface that can be opened while a text field is focused needs adding to that exemption list, or its first tap is eaten.**
- **Back button** on the conversational intro (`.cine-back.cine-convo-back`, the same 52px circle as the onboarding steps, top-left): leaves for the showcase (`cineConvoBack()` = teardown + `cineGoToShowcase()`), works with the keyboard up and does not submit the name. A fade over the top ~84px of `.cine-convo` keeps scrolled-up lines from colliding with it.
- **Tell Zelo More** (`#screen-tellzelo`): the screen was already the scroller (`.screen` is `overflow-y:auto`) but each step fits the viewport, so there was nothing to scroll. `renderTellZeloStep()` now calls `_tzMakeScrollable()` → `_ensureScrollableOverflow(screen, 56)` (the same trailing-spacer trick as the chat/AI Coach). Sizes and layout untouched; measured scrollHeight 900 vs 844 and it holds a scrolled position.
- Interpretation recorded: "continue while opening keyboard … add a back icon same as the onboarding" was read as the onboarding name step (the only Continue with a keyboard), which had no back button.

### 2026-10-11v — "By continuing, you agree to…" replaces the terms checkboxes
- **Wording (chosen by me, as asked):** "By continuing, you agree to Zelo's **Terms of Service** and **Privacy Policy**." — the same sentence the existing sign-in sheet already used, so the app now says it one way everywhere. Centered, small, secondary colour, with the two names as underlined, darker, tappable links (`openLegalPage('terms.html' / 'privacy.html')`).
- **Where:** onboarding step 14 "Save your progress" — the required "I agree to Terms and Conditions and Privacy Policy" checkbox and its warning banner flow are gone; the line sits under the three provider buttons, with the optional "Send me tips…" checkbox below it (unchanged, still unticked). The email/password form in the auth sheet — the "I agree to the Terms & Conditions" checkbox became the same line (shown for sign-up only, as before; `#auth-terms-wrap` kept as its id so `showEmailScreen()` still toggles it). The provider-picker sheet's old data-collection paragraph now starts with the same sentence and keeps one line about collecting information to customise the experience.
- Code: `cineProviderTap()` no longer checks a box — it records the `terms_and_privacy` consent and starts sign-in on the FIRST tap; `AUTH.handleEmailSubmit()` no longer refuses without the checkbox but still records the consent at the sign-up moment. `cineTermsChecked()` / `_cineHideTermsWarn` / `_cineTermsWarnTimer` were removed; the `.cine-terms-warn` element is still in the markup, unused. The other `#auth-terms-checkbox` references in auth.js are null-guarded and now no-ops. `services/auth.js` gained a `?v=` cache-buster (it had none).
- **Legal note, told to the user:** implied consent ("by continuing") is the common pattern (Tinder etc.) and the consent record is still written at that moment, but it is weaker evidence than an explicit tick — worth a look by counsel, especially for GDPR markets. The tick-box version is one revert away.

### 2026-10-11w — Z071 re-imported (new master + new "silly giraffe" photo)
- The user regenerated Z071's `MASTER_REFERENCE` and `T01_silly_giraffe_selfie` (source mtimes 2026-10-12 13:25; T02–T04 predate the original import, so unchanged). **T01 is 1122×1402, not the 1080×1350 every other source is** — the same 4:5 ratio (0.8003), so it was simply resized with LANCZOS to 1080×1350 and saved with the roster settings (q80, 4:4:4). `assets/characters/z071-1.jpg` and `z071-pfp.jpg` (re-cropped from the new master with the usual head-width rule) were replaced in `assets/`, `www/` and `ios/App/App/public/`.
- Old versions kept for revert: `design-refs/asset-originals-2026-10-12/assets/characters/z071-1.jpg` and `z071-pfp.jpg`.
- Reminder for the next regeneration: a re-exported source may not be exactly 1080×1350 — `convert.py` asserts that size and would stop on it; resize by ratio instead (check it is within ~0.002 of 0.8 first).

### 2026-10-11x — Opener chips, hidden onboarding goal, curiosity / effort-matching
- **Chips** (`#chat-chips`, inside `.chat-input-bar` above the input row so they ride with it when the keyboard opens): up to 3 pills — one of her three interests ("Ask about {interest}"), her job ("Ask about her work", article-aware: "a"/"an"), and "Ask about tonight". Tapping one puts a ready-to-edit line in the message box (never sends) and fires the `input` event so the pacing code sees it; tapping another replaces it. They show only while the chat has no user message (checked from the DOM), hide on the first send, and come back after Reset Chat. The set is cached per persona (`_chipSets`) so reopening an untouched chat shows the same ones. The row scrolls sideways; at 390pt the third pill sits partly off-screen on purpose rather than shrinking the text.
- **Hidden goal** (`_userGoalHint()`): the step-5 "help with" answers and step-7 tone become one quiet system message ("Quiet background … never mention it, never talk about goals, practice or coaching … a light nudge, not a rule"), added only on the normal (non-`forceShort`) path. Per-goal wording is in `_GOAL_HINTS`.
- **She asks back, and matches effort** (`_curiosityHint(history)`): a base instruction (curious about them too; a question about 1 reply in 3–4, specific to what they said, never a stock "how about you?"; put effort back when they do; no question at all is normal), plus ONE adaptive line from her last three replies: two question-endings in a row → "do NOT end with a question"; three with none → "ask one natural question"; user effort (≥9 words or a question) and her last reply had no question → "meet that effort with a follow-up". Controlling frequency from the actual history is what keeps it from either never asking or interviewing them.
- Verified by intercepting the real `_aiInvoke` payload for each situation (and with the real chips in WebKit, light + dark). **Not verified against the live model** — whether DeepSeek actually follows these nudges, and how often, needs a handful of real chats; tune `_curiosityHint` wording (or the 9-word effort threshold) from that.
- The `forceShort` retry path deliberately gets none of this: it exists to get one short reply back under the word limit.

### 2026-10-12a — Instagram-style profile for every character
- **What:** `#pp-overlay` — a full-screen page that slides in from the right over the chat (layout from the user's Instagram screenshot): back + handle, round profile picture (the white-background pfp from 11h), "Name, age", **4 posts / followers / following**, bio lines (job · city, her bio, "♡ interests" = what she likes), **Matched ✓** (a status label, not a button) + **Message**, grid / tagged tabs, and a 3-column 4:5 grid of her four photos. Tapping a post opens a "Posts" feed scrolled to it (avatar + handle + city header, full-width photo, caption). Tagged tab shows "No tagged photos yet".
- **How to open:** tap her photo/name at the top of the chat thread (`.chat-profile-block`) or the small avatar beside any of her messages (`createMsgAvatar`). Both carry `data-open-profile`, which is exempted from the global keyboard-dismiss handler so it opens on the first tap with the keyboard up. **Message** closes the profile (back to the chat), or opens her chat from the store if the profile was opened elsewhere.
- **Why an overlay, not `pushScreen`:** pushing a screen deactivates `#screen-chat`, and `_chatIsLive()` then routes an in-flight reply to the store only — it would be missing from the thread when you came back. With the overlay the chat stays the live screen (tested: `_chatIsLive` true while the profile is open).
- **Data:** handles are generated deterministically (`_personaHandle`: first/last name patterns, e.g. `quynh.le`, `chidinma.eze`; the pilots have no last name, so name + city or name + number) — all 135 unique and `[a-z0-9._]`. Follower/following counts are deterministic per id (`_personaStats`). `lastName` was added to roster profiles for this. Captions live in the new **`personas-posts.js`** (loaded after personas-roster.js), generated from the source photo filenames (`Z071_T01_silly_giraffe_selfie` → "silly giraffe selfie"); the pilots' first photos were named "anchor", so they have no caption.
- **Gestures / memory:** swipe right anywhere on the profile or the feed to go back (follows the finger; 30% of the width or a quick flick commits). On close, both panels' HTML is cleared so the four full-size photos (~22 MB decoded) are released.
- **Not added:** the reference's bell and "…" buttons (no action for them in this app).
- Gotcha caught in testing: `offsetTop` inside the feed is measured from the feed panel, not the scrolling list, so scrolling to a post must subtract `list.offsetTop` — otherwise the post's header lands under the top bar.

### 2026-10-12b/c — Rewind the last skip; sliders icon for chat settings
- **Rewind** (`#btn-rewind`, `onRewindBtn()`): a 50px round button left of Skip on every card (Tinder's position), using the app's own undo arrow `chats-page/msg-menu/reply.png` as a CSS **mask** so it takes the accent colour in both themes (no new art, no hand-drawn icon). `state.skipHistory` is a stack of deck indexes pushed when a skip commits; a like clears it (a like already became a match), as does a fresh deck. Tapping pops the last index, takes that person off Skipped Profiles, sets `swipeIndex` back and re-renders; the card slides back in from the left (`.swipe-card--rewind`, one-shot, stripped after 520ms). Repeated taps walk back through consecutive skips; disabled (40%) when there is nothing to bring back; inert during the tutorial and while a like is in flight. A rewind during the skip's own fly-off would have let `onFlyOffDone` write the skip record anyway — it now skips recording when the profile is back ahead of `swipeIndex`.
- The extra button made "I'm Interested" wrap to two lines. Skip now sizes to its content and Interested takes the rest (`white-space: nowrap`): all three are one line, 50–51px tall, at 375/390/430pt.
- **Chat header settings icon:** the gear SVG in `.chat-settings-btn` was replaced with the user's two pastel sliders icons from `assets/icons/settings/` ("Pastel Pink Slider Settings Icon.png" = light, white bg; "Pastel Pink Sliders Icon.png" = dark, black bg). Colour-to-alpha against each sheet's own background (light: alpha from the green channel against white, since the pink is furthest from white there; dark: from red against black), cropped square around the glyph, 132px → `chats-page/chat-settings-sliders.png` + `-dark.png`, registered in `ICONS_WITH_DARK_VARIANT`. The light one is a very pale pink on the white button — it is the supplied colour, flagged to the user rather than darkened.

### 2026-10-13a — "View profile" inside the chat
- Two more ways into her profile (besides tapping her photo/name or the small avatar): a **"View profile" pill** under her name at the top of the thread (`.chat-profile-view-btn`, Instagram-DM style, grey `--s2` fill), and a **View Profile** row at the top of the chat settings sheet (`chatSettingsViewProfile()` closes the sheet, then opens the profile 220ms later so the two animations don't overlap). The row's person icon is an inline stroke SVG in the same family as the other settings rows (no profile-icon art exists in `assets/`).

### 2026-10-13b — Conversation-aware suggestions; opener link before the first message
- **Before she has been written to:** the chip row shows only a quiet "Need an opener?" link (`.chat-chip--link`); tapping it reveals the static, profile-based openers (`_chipsFor`). No AI call. This replaces showing "Ask about tonight"-style chips unprompted on an empty chat.
- **After she replies:** `_scheduleSuggestions()` (called when her reply finishes, and 700ms after reopening a chat whose last message is hers) waits `SUGG.idleMs` (6s); if the user hasn't typed and she isn't mid-reply, `_fetchSuggestions()` makes ONE `deepseek-proxy` call (kind `'suggest'`, logged to `ai_usage_log` — that column is plain text, so no migration) with her profile, the last 6 messages and the hidden goal, `max_tokens` 130, asking for a JSON array of 3 `{label, text}`: a curious follow-up, a playful tease, and a small thing about themselves. Chips fade in with a refresh button FIRST in the row (long labels pushed it off-screen when it was last). Tapping a chip fills the box and the AI chips step aside; typing, sending, leaving the chat or her next message cancels/clears them (`_suggGen` makes a late answer harmless).
- **Cost controls:** one call per message of hers (cached by message id, so reopening/re-rendering is free), last 6 messages only, 15 calls per chat per day (`zelo_sugg_<chat>_<date>`, refresh counts), refresh rate-limited to one per 3s, never while typing or mid-reply. Estimated ~500–800 tokens/call; **the price figure quoted to the user was from memory — check DeepSeek's current rates and the real numbers in `ai_usage_log`.** On any failure or unparseable reply it falls back to the static chips so the row is never empty.
- Verified with a stubbed `_aiInvoke` (prompt contents, cache, refresh limit, typing cancels, daily cap, failure fallback, light + dark). **Not verified against the live model** — suggestion quality/tone needs real chats; tune the system prompt in `_fetchSuggestions`.

### 2026-10-13c — Suggestions follow the conversation, not her profile; deeper post captions
- **Why it felt wrong:** the suggestion call was given her bio, interests, job and city, and the post captions were the photo filenames turned into words ("rainy balcony", "bookbinding workshop"). So the AI offered "ask about the rainy balcony" — it was describing the picture, not continuing the conversation.
- **Suggestions:** the prompt no longer contains her bio, interests, job or city — only "The other person is {name}, {age}", the last 6 messages and the user's hidden goal — plus an explicit rule: base every idea on what has actually been said, don't invent or use facts about her life/photos, and if little is known, build on her last message or ask something open about it. (The static "Need an opener?" chips before the first message still use her interests: with no conversation yet there is nothing else to use, and they are opt-in.) Test asserts the real payload contains none of her profile text.
- **Captions** (`personas-posts.js`): all 540 rewritten by hand as a mood or feeling rather than a description — e.g. rainy balcony → "rain, balcony, afternoon chill"; bookbinding workshop → "slow work with my hands"; kintsugi repair → "fixing gold into broken things". The first photo of the 10 original characters, previously blank, now reads as an intro ("hi, i'm emily"). They are authored guesses from the filenames, not from looking at all 540 images — a few may not fit the picture, so skim a profile or two and say which to redo.
- `t_pp.js` still asserted the old caption text, so its post-feed check now fails by design; the behaviour (opens at the right post with a caption) is unchanged.

### 2026-10-13d — Captions in her own voice; plain "hey" openers
- **Captions rewritten again** (`personas-posts.js`, 540): the 13c versions were still the photo described in nicer words. They are now what she'd post herself — a feeling or small confession with an emoji ("this hike is so exhausting 😮‍💨 but worth it 🏔️", "he's taller than me and honestly i'm intimidated 🦒😭", "rain on flowers is my favorite sound 🌧️"). Still authored from the source photo names, not by viewing all 540 images, so some will not fit their picture exactly; the second half (z071 onward) got a harder rewrite than the first. Say which profiles feel off and they can be redone individually.
- **Openers:** `_chipsFor()` is now three plain greetings for every persona — "Say hey" (`hey! how are you?`), "Ask about her day", "Ask what she's up to" — instead of lines built from her interests/job. Rationale given by the user from their research: nobody can say what the best opener is, and a simple greeting is what actually gets replies. They are still behind the "Need an opener?" link and are also the fallback when the suggestion call fails. `_article()` is now unused.
- Tests updated for the new copy (the fallback check looks for "Say hey"; the post-feed check accepts any Quynh caption).

### 2026-10-13e — Fewer emoji in captions; idea chips no longer vanish when you tap one
- **Captions:** an emoji on all 540 read as spam. Now one caption per character keeps its emoji (position = set number mod 4, so it varies) — 136 of 540 — and the rest are plain text; the hike caption in z010 keeps its two on purpose. Regenerated in place from `personas-posts.js` with a regex strip (emoji ranges + ZWJ/variation selectors), not rewritten.
- **Chips:** `onMessageInputChange()` used to hide the AI idea chips as soon as the box had text, so tapping an idea (which fills the box) made the whole row disappear. That branch is gone: ideas now stay until she replies, the user sends, or the chat is left, and tapping another swaps the text. A fetch is still skipped while the box has text (`_fetchSuggestions` checks it), so typing never triggers new calls. Test added for "ideas stay" and "tap another swaps".

### 2026-10-13f — Suggestions that don't read as AI; chip row scrolls without swiping back
- **Why they read as AI:** the instruction asked for "casual, lowercase-ish" but said nothing about the tells — exclamation marks, tidy capitalised full sentences, em dashes, emoji, stock praise ("that's so cool!"), "how about you". And the static opener was "hey! how are you?".
- **Prompt** (`_fetchSuggestions`): rewritten around texting like a person — fragments, no `!`, no emoji, no em dashes, no full stop at the end, banned phrases ("amazing", "I'm curious", "how about you"), reuse one of HER words, vary kind and length (one can be 2–4 words, none over 12), plus a bad/good example pair. Temperature 0.9 → 1.0. **Post-processing** (`_humanizeText`) enforces it whatever the model returns: strips emoji, turns em/en dashes into commas, removes `!`, drops the trailing full stop, collapses spaces and **lowercases everything**. Labels are plain 2–4 word descriptions.
- **Static openers** are now `hey` / `hey how's your day been` / `hi what are you up to today` — lowercase, no `!`.
- **Scrolling the chip row** swiped back to Chats because `attachEdgeSwipeBack('screen-chat')` treated any rightward drag as a back gesture. `.chat-chips` is now in its `excludeSelector` (same mechanism as the settings sheet), and the row has `touch-action: pan-x` + `overscroll-behavior-x: contain`. Verified with a real touch drag across a 6-chip row: the chat stays active and nothing slides.
- Not verified against the live model: the humaniser guarantees the *format*; whether the *ideas* now feel like something a friend would text needs real chats. If they still feel stiff, the next lever is giving the model 2–3 real example exchanges rather than rules.

### 2026-10-13g — Info sheet rebuilt (About Her / Interests / In short), personalities written for all 135, "Get hints" in the hold menu
- **Info sheet** (`#profile-detail-modal`, from the card's (i)), per the user's reference: photo, name, age, job, **About Her** (a third-person introduction), **Interests** (three emoji + label chips, phrased as things to talk about), and an **In short** card using the AI Coach **gem icon** (`aicoach-topics/interest.png`). The old "About Me" (her one-line bio), "Likes" tags and the **personality/mode pills were removed** (`attachProfileDetailModeListeners` is now unused; card mode stays at its default). Content comes from the new **`personas-about.js`** (`PERSONA_ABOUT[id] = {about, short, topics}`), loaded after personas-posts.js; a persona without an entry falls back to her bio and interests and hides the In short card.
- **Decision recorded: the personalities were written now, to MATCH each persona's existing chat personality** (the pilots' PERSONALITY sections in personas.js, the roster's vibe/home/fav/quirk), so the info sheet describes the same person you then chat with. Writing new personalities only in the sheet would have contradicted the chat.
- **Repeats made distinct** (the user allowed inventing new traits): 13 roster entries had near-duplicate vibes/quirks (two shell collectors, two "pins everything", three bookshelf reorganisers, overdressers, a run of "calm, dry, and…" / "elegant, funny, and…"). Their `vibe`/`quirk` in `ROSTER_DATA` were rewritten (z035, z067, o007, z081, o028, z086, z098, z099, z094, z093, z095, z100, z090) — this **changes their chat prompts too**, since `_rosterPrompt` builds from those fields, and the About text matches the new versions.
- **Get hints:** the long-press menu on HER messages now starts with **Get hints** (gem icon). Tapping it shows three shimmering skeleton pills in the chip row at once (unless that message's hints are cached), then the ideas — written as replies to **the message you held**, not only the latest one (an extra line names it in the prompt). Manual requests ignore the "you're typing" guard, and if the daily cap is reached they show the plain openers instead of nothing. The automatic idle suggestions are unchanged. Not shown on your own messages. Gotcha: `.chat-chips--in .chat-chip`'s entrance animation outranks the skeleton's shimmer, so the skeleton removes that class first.
- Verified in WebKit, light + dark: sheet sections, gem loads, all 135 entries present with 3 topics, Get hints first in the menu for hers and absent for yours, skeleton then real hints aimed at the held message.

### 2026-10-13h — Info sheet: no pull-down bounce, chubbier star, single gem
- **White space above the photo** was the scroll container rubber-banding when pulled down at the top. `.profile-detail-scroll` now has `overscroll-behavior-y: none`, plus a non-passive `touchmove` (added in `attachProfileDetailDragToClose`) that `preventDefault`s a downward pull only while `scrollTop <= 0` — so the content can only be scrolled down, while the sheet's own drag-to-close (separate listeners on the sheet) still works from the top. Verified: the pull at the top is blocked; the same pull mid-scroll is not.
- **Interests star** swapped for a fuller four-point star (curved sides, 24px, with a 1.6px same-colour stroke to fatten it) to match the reference's chubby sparkle. Inline SVG, as before.
- **Gem looked double-framed:** `aicoach-topics/interest.png` already has its own pale-pink circle baked in, and the In short card wrapped it in a second tinted circle. The extra circle is gone; the image is shown at 48px on its own.

### 2026-10-13i — Divider under "Get hints"
- The hold menu on her messages now has a 1px grey separator (`.msg-menu-sep`, `--border`) between Get hints and Reply, matching the line already above Report. Built as an `item.sepAfter` flag in `_renderMsgMenuActions`.

### 2026-10-14a — New send / AI chat icons and a new reply-style icon set
- **Chat composer** (`assets/icons/chats-page/`): `chat-send-icon(-dark).png` is now the pink paper plane (from `Chats page/Minimalist Pink Paper Plane Icon.png` on white / `Neon Pink Paper Airplane on Black.png`), and `chat-aicoach-icon(-dark).png` is the eyes-and-sparkles **Mini star** (`Chats page/Chat ai.png` / `Chat ai dark.png`). Both used to be pink circles that filled the 42px buttons; the new artwork is a bare glyph, so the plane is cut to 62% of a 192px canvas and the star to 86% so they sit inside the same 42px box at a sensible size (the plane is ~26pt, the star ~36pt). Same filenames, so `ICONS_WITH_DARK_VARIANT` and the dark swap are untouched. Note the star is the mascot candidate the user hasn't finalised — it is in the app only as this one icon.
- **Reply styles** (`assets/icons/reply-styles/{style}.png` + `-dark.png`, 240px wide): all seven replaced from `reply-styles/New icons of emotions/`. Mapping (my reading of the art): direct = blue target, warmer = pink heart, smooth = pink typing dots, funny = purple laughing, bolder = orange lightning, **longer = purple double chevron up, shorter = mint double chevron down**. Light version from each white-background render, dark from the black-background one. The old files are in `design-refs/asset-originals-2026-10-14/assets/icons/` (plus the earlier set still in `_source/reply-styles-old`).
- **Cut-out method** (`mkicon.py`, scratchpad): not a colour key — the renders carry a baked ground-shadow ellipse. The bubble is the largest saturated + bright blob containing a seed point (HSV S ≥ 90, V ≥ 110 light / ≥ 175 dark — the dark shadows are saturated but dimmer, and a lower V threshold left a pink/brown smudge under the tail), holes filled (the white glyphs are enclosed), eroded 2px and feathered 1.6px for a clean rim. The shadow is dropped entirely. Verified on white and on `#211e18`.
- The remaining console 404s (`archive/legacy-onboarding.js`, `words-dict.txt`, the Supabase root) predate this.

### 2026-10-14b — Reply cards: fixed icon/quote position, icon shadow; Your Reply scrolls
- **Icon and quote moved with the message length** because `.yr-card-illustration` used `margin: auto` — the icon+quote+text group was vertically centred between the style label and the button, so a long message pushed the icon up and a short one dropped it. It is now pinned `14px` under the label (`margin: 14px auto 3px`), the quote follows, and text and button hang from there. Measured on short / long / medium text: icon at +59px, quote at +119px on all three. A second 2px shift came from the "Best Match" chip making that card's label row taller — `.yr-card-top` now has `min-height: 20px; align-items: center`.
- **Shadow under the icons:** the new icons are cut out without the baked ground shadow (10-14a), so it is drawn in CSS: a blurred radial ellipse under the image (`.yr-card-illustration.has-img::after`, darker in dark mode) plus a 3px `drop-shadow` on the image.
- **Your Reply scrolls:** the screen is `overflow-y:auto` but fit the viewport, so nothing scrolled. `_srMakeScrollable()` (called from `_armAddTogglePill`, which already runs on every entry to the screen) adds the usual trailing spacer. It first did nothing: `.scan-result-layout` was `flex: 1`, so it stretched to fill the screen and *absorbed* the spacer — scrollHeight stayed 844. `#screen-scan-result > .scan-result-layout` is now `flex: 0 0 auto`; scrollHeight is 1007 vs 844. The spacer is re-measured at ~0.35s and ~1s because the reply text and pill change the height after first paint. **A flex:1 child will swallow any "guarantee overflow" spacer — check for it before reusing `_ensureScrollableOverflow` on a screen.**

### 2026-10-14c — New AI-coach mascot + send glyph, emoji/Hints boxes, send-pill animation, tighter profile taps
- **Mascot** (`chats-page/chat-aicoach-icon(-dark).png`, from `Chats page/Zelo Ai mascot.png` / `Zelo ai mascot dark.png`): the two-oval-eyes chat bubble replaces the star in the composer's AI button. Same body-blob cut as the other icons; for the dark render the glow halo is dropped (S ≥ 8, V ≥ 170 keeps the pale rim and the tail while excluding the neon glow — a higher saturation threshold shredded the rim and lost the tail). The previous star versions are in `design-refs/asset-originals-2026-10-14/assets/icons/chats-page/*.v2.png`.
- **Send glyph:** `chat-send-glyph.png` is the white plane (alpha from the brightness of `New send button for crop.png`). The pink **pill is CSS** (`.send-btn`, 56×38, accent), not an image, so it follows the theme; `chat-send-icon*.png` are no longer referenced by the composer.
- **Composer mechanics:** empty box → **emoji** button (inline smiley, opens a 24-emoji tray that inserts at the caret) and a **Hints** button (gem icon + label); any text → the send pill replaces both. `_syncComposerButtons()` toggles `.has-text` on `.chat-input-row` and is called from `onMessageInputChange`, after send clears the box, and on entering a chat. **Hints** = the hold-menu "Get hints" for her latest message (skeleton pills, then ideas); with nothing from her yet it reveals the openers.
- **Animation:** on the empty→text change the pill fades/scales in (160ms), then the plane glyph — `transform-origin` at its lower-left (18% 82%) — rotates from 16° down to 0 over 260ms (starting 70ms in), so its right side lifts while the lower left stays put. One-shot `.send-btn--in`, stripped after 420ms. Verified the animation names and origin; whether it feels "barely noticeable" enough needs a phone.
- **Profile hit boxes:** the click handler was on the whole `.chat-profile-block` (full width), so empty space either side of her photo opened the profile. It is now on the photo, the name and the View profile button only (`.chat-profile-hit`, each `data-open-profile`). Verified with `elementFromPoint`: the three parts hit, the block's left/right edges don't.
- Caveat: the send pill in my screenshots looks pale because the test chat had sends disabled (`setSendEnabled(false)` while no mode is chosen); in a live chat it is full accent.

### 2026-10-14d — One field around the composer; bare emoji + idea icons; real iOS keyboard for emoji
- **One pill:** `.chat-field` (grey `--s1` fill, 1px border, 22px radius, focus ring on `:focus-within`) now wraps the input, the two tool icons and the send pill; the AI mascot button stays outside it. The input inside is borderless/transparent.
- **Tools are bare icons** (25px strokes, `--text-2`, no background, no circle) sitting over the field: a smiley for emoji and a **lightbulb** for ideas (replaces the gem + "Hints" label; the same Get-hints behaviour). The send pill is 52×32 to fit inside the field.
- **Emoji uses the real iOS keyboard, with a limit:** a web view cannot switch the iOS keyboard to its emoji page — only the user can (the smiley/globe key). The custom 24-emoji tray (and `EMOJI_SET`/`toggleEmojiTray`) was removed; the smiley now just focuses the message box so the real keyboard is open, and shows a one-time toast "Tap the 😊 key on your keyboard for emoji" (`zelo_emoji_hint`). Forcing the emoji page would need a native iOS change (overriding `textInputMode` on a real UITextField, i.e. a Capacitor plugin + Xcode rebuild); not attempted.

### 2026-10-14e — Smooth send swap, idea toggle, collapsible add-message, scrolling profile, mascot replaces the gem
- **Send swap rebuilt as a cross-fade** (the keyframe version toggled `display`, so the tools vanished in one frame and read as a still picture): `.chat-actions` (74px, position:relative) holds the tools and the send pill stacked at the right; `.has-text` fades the tools out (200ms) and scales/fades the pill in, and the plane glyph goes from `rotate(20deg)` to 0 over 420ms with its lower-left origin held. All CSS transitions, so deleting back to empty reverses it. The text box no longer changes width when the buttons swap. Measured: 8 intermediate opacity frames and 12 intermediate plane angles (20°→0).
- **Idea icon toggles:** a second tap closes the hints (AI mode: clears and cancels the fetch; opener mode: folds back to "Need an opener?").
- **Emoji:** still cannot open the emoji page — see 14d. The smiley focuses the box.
- **Her profile scrolls:** `#pp-scroll` gets the trailing spacer on open. **Bug fixed in `_ensureScrollableOverflow`:** it measured the LAST child, and a hidden (`display:none`) child has an all-zero rect, which made the spacer ~800px (the hidden Tagged tab). It now uses the last child that has client rects. Profile scrollHeight 800 vs 744.
- **Your Reply "Add her message ⌄":** the box is closed by default (`.yr-add-collapse`, a 0fr→1fr grid-row collapse + fade, `visibility:hidden` while closed so it can't be tabbed into). The label is now a real button that toggles it (chevron rotates, `aria-expanded`); tapping **Her** or **You** opens it too and focuses the matching field; `_resetReplayAdd` closes it on each new scan. Page height re-measured on toggle.
- **Mascot replaces the gem everywhere except History:** new `aicoach-topics/mascot-brand.png` (cut out of `Chats page/Zelo Ai mascot.png`). All 7 `interest.png` references in index.html and the script's brand icon / Get-hints menu item / In-short card now point to it. **`interest.png` itself is untouched** because `_aiCoachTopicIconHTML('interest')` builds `aicoach-topics/{topic}.png` for the History rows, which the user is redoing.
- **History topic gems (for the art the user is making):** `AICOACH_TOPIC_COLORS` — reply `#4488f6` on `#eef2ff`, interest `#ec4899` on `#fce3ee`, flirty `#fe8e36` on `#fff1e9`, advice `#885cea` on `#f9f6fd`; the PNGs are 434×426 gems inside a pale circle. Reply-style rows use `STYLE_COLORS` in data.js.

### 2026-10-14f — History mascots, Your Reply centring + fixed cards, smooth search drag, native emoji keyboard
- **History topic icons are the coloured mascots now** (`aicoach-topics/{reply,interest,flirty,advice}.png` + new `-dark.png`, registered in `ICONS_WITH_DARK_VARIANT`): reply = blue, flirty = orange, advice = purple (from the six new `Chats page/Glossy … .png` renders), interest = the pink `Zelo Ai mascot`. Same `mkicon.py` cut as the mascot (light S≥25/V≥120, dark S≥8/V≥170, seed (627,420), 256px canvas, 92%). The old gems are in `design-refs/asset-originals-2026-10-14/aicoach-topics/`. The mascots have no baked circle, so once one loads the row's inline coloured circle is cleared (`.has-img:has(> .aicoach-topic-icon-img)` → transparent) — otherwise it reads as a second layer. Reply-style rows keep their circle.
- **"Zelo is thinking…" off-centre** came from 14b's `#screen-scan-result > .scan-result-layout { flex: 0 0 auto }` (needed so the results can scroll): the layout no longer filled the screen, so the `flex:1` loading block had nothing to centre in. While the loading block is the visible child the layout is `flex: 1 1 auto` again (`:has(> .scan-result-loading:not([hidden]))`).
- **Cards moved when the add-message box opened/closed** (14e collapsed it to 0 height). The box now always keeps its space and only fades/slides in place (`visibility:hidden` + `pointer-events:none` when closed, so it can't be tapped or tabbed into). Measured: carousel top identical closed / open / closed again.
- **Search sheet drag rebuilt on the AI Coach chat-sheet mechanic**: arms anywhere on the card (the results list only when scrolled to the top), 6px deadzone then 1:1 follow with transitions off (start point rebased at commit so it doesn't jump), non-passive touchmove so the list can't rubber-band under it, scrim opacity follows the drag, release past 110px or a quick downward flick (>0.5px/ms) continues straight into the close with an explicit transition, otherwise springs back. Previously only the header listened, with no deadzone, a passive listener and a fixed threshold.
- **Emoji keyboard — NATIVE, needs an Xcode rebuild, untested on a device.** `MainViewController.swift` patches WKContentView's `textInputMode` (and `textInputContextIdentifier`, which iOS wants non-nil before it honours a custom mode) the same way the accessory-bar patch works; they call straight through to the originals unless `emojiKeyboardOn`. The emoji button posts `webkit.messageHandlers.zeloEmoji` before focusing the message box; native turns the flag on, calls `reloadInputViews()` on the focused content view now and again at 0.25s (keyboard may still be opening), and turns the flag off at 1.2s so ABC works normally afterwards. The web input never loses focus, so emoji type straight into it and the composer stays lifted — a hidden native UITextField was rejected because it would blur the input and drop the composer under the keyboard. No emoji keyboard enabled in iOS Settings → `window._zeloEmojiUnavailable()` toast. Browser fallback (no message handler) is the old focus + hint toast. Compiled for the simulator with xcodebuild; whether iOS actually switches to the emoji page can only be seen on a device/simulator by hand.

### 2026-10-15a — Taps dead on Your Reply (and a hidden slider catching taps on 11 other screens)
- **Symptom:** after Link chat → "View full chat" (Your Reply), Get new suggestions / Change tone / Use this reply did nothing, and taps seemed to reach Practice (match page, info page). **Cause:** the AI Coach *chat sheet* is not a stacked screen — it keeps `aicoach-sheet-open/visible` and a full-screen `#aicoach-chat-sheet-backdrop`. `pushScreen('scan-result')` strips `.active` from every screen (including the sheet) but never closed the sheet, so the backdrop stayed on top of Your Reply, invisible, eating every tap (`elementFromPoint` returned the backdrop for every button). Fix: `pushScreen()` calls `closeAiCoachChatSheet()` first when the sheet is open (conversation still auto-saved by that function).
- **Second bug found by the audit:** `.settings2-agefilter-input::-webkit-slider-thumb` has `pointer-events:auto` (so the thumb drags inside a `pointer-events:none` input). That beats the `none` an inactive `.screen` passes down, so the Settings age-range thumbs stayed live over **11 other screens** (dashboard, refer-friends, settings-profile-login, add-email, email-connected, forgot-password, reset-sent, personalization, tone-preview, practice-prefs, who-practice) at the same two spots. Fix: `.screen:not(.active) …::-webkit-slider-thumb { pointer-events:none }`. **Put the `-webkit-` and `-moz-` pseudo-elements in SEPARATE rules** — one unknown pseudo in a selector list makes WebKit drop the whole rule (first attempt silently did nothing).
- **Audit method worth reusing** (`t_audit.js` in the scratchpad): for every `.screen`, `pushScreen(name)` then `elementFromPoint` over a 4×8 grid and flag any hit outside that screen — run clean, with the chat sheet open, and with the match overlay open. After the fixes: 0 covered screens in all three.
- **General rule:** anything that sets `pointer-events:auto` inside a hidden/inactive container must be switched off again when that container is hidden, and any full-screen backdrop that isn't part of `screenStack` must be closed by whatever navigates past it.

### 2026-10-15b — Linked conversation uses the plain conversation look
- The pink "Linked conversation" card in AI Coach (`renderAiCoachContext`, linked branch) now renders like the chat sheet's "This conversation" block: a small label **LINKED CONVERSATION**, **View full chat ›** (same pill) on the right of it, and the plain `.yr-conv` bubble box below (260px max, scrolled to the newest). The pink card, the icon circle and the "N messages • N of your replies" line are gone from that state (the `.aicoach-context-row.linked` CSS is still used by the "Analyzing this conversation" card in the chat sheet). The "linked but no scans yet" and unlinked states are unchanged.

### 2026-10-15c — "Practice with" is now two questions: who you are + who you want
- **Replaces the four-way "Women / LGBTQ+ women / Men / Both".** `zelo_practice_mode` is now `women | men | nonbinary | both` (labels Women / Men / Non-binary people / Everyone; `PRACTICE_WHO_LABELS`, `_practiceMode()`), and who the user IS stays in `zelo_onb_gender` (`male | female | other | none`, labels in `GENDER_LABELS`; `none` = "Prefer not to say"). A stored `other` (the old LGBTQ+ women choice) is read as `women` and rewritten by `_practiceMode()`.
- **The deck combines the two** (`initSwipeDeck`, "which library"): man + Women → the 100 straight-women personas only; woman + Women → the 35 LGBTQ+ women FIRST, then the rest (soft tier, so the deck is never tiny and a lesbian or bi woman is never asked); non-binary / prefer-not-to-say / unanswered + Women, and Everyone → the whole 135, mixed. Men and Non-binary people still use the 10 placeholder layout cards (no such personas exist yet). **Everyone is the real 135-persona library, not the placeholders** (it was the placeholders before — fake cards). Soft tiers are now `rank()` = age-range tier ×2 + lead-category tier, each shuffled; strict age range still filters first (verified: woman + Women + 25–30 → 41 people, all in range, all LGBTQ+ ones first).
- **UI:** typed practice questions — gender step gains "Prefer not to say" (recap omits it; `needGender` now tests `in _PC_SEX_WORD` so "none" isn't re-asked), the who step shows the 4 new choices; Settings → Who You Practice With has both groups ("I am" with a note that it stays on the phone); Edit Details gains an **I am** row + sheet and its row/sheet are renamed **Practice with** (sheet now keys off `data-val`, not button order); onboarding step 6 gains "Non-binary people". Changing either answer calls `_invalidateDeck()`.
- **Not uploaded:** `attracted` still isn't sent to `onboarding_responses` (special-category data); gender was already queued there — "none" is a new value in that column.
- **To do when the content exists:** a men library (also covers gay men and straight women's practice), then non-binary personas; a gay-men flavour inside the men library would mirror how the 35 queer women are written. Inline SVG for the non-binary icon (circle + short stems) — no asset exists; swap if art is made.

### 2026-10-15d — Card pills (orientation + looking for), option explanations, Save buttons removed
- **Card pills:** top-left under the photo bars, two chips — what she is (`profile.orientation`) and what she is looking for (`profile.intent`). Orientation: the 35 "other" personas keep the label they were written with (`ident`: Lesbian 16, Queer 9, Bi 6, Pan 1, Soft butch lesbian 2, Genderfluid · she/they 1); everyone else is **Straight**. There is no "tomboy" in the data — "Soft butch lesbian" is the closest; a style tag would need a data pass. Placeholder cards get no pills; `.swipe-card--bare` hides them like the other overlay.
- **Looking for** (`PERSONA_INTENTS` at the end of personas-roster.js): Dating / Long-term / Friends / Open to see. Assigned from a hash of the persona id, weighted by age (≤22 skews dating/open, 30+ skews long-term; friends kept small — now 15 of 135), so it never changes between launches; override one with `PERSONA_INTENT_OVERRIDE[id]`. **It is written into each system prompt** ("WHAT YOU ARE LOOKING FOR") so it changes behaviour — friends-first personas don't flirt back, long-term ones dislike games — otherwise it would just be a label. Not yet verified against the live model.
- **Explanations:** onboarding step 6 and the Edit Details sheets show a grey description under each option name (plain words + example, e.g. "people whose gender isn't only man or woman — e.g. genderfluid, agender, they/them"). Settings → Who You Practice With opens the description under the tapped row (accordion via `.settings2-help`, closed unless `.selected`). The typed Q&A flow has none — its buttons advance on tap, so there is no room for a dropdown.
- **Save buttons removed** from Personalization, Who You Practice With, Age Range and Scan Retention: all of them already saved on tap and "Save" only called `popScreen()` (the back arrow does the same). `saveSettingsPersonalization()` deleted. Edit Details' "Save Changes" kept — it returns to the typed profile confirmation, so it is navigation, not a save.

### 2026-10-15e — Shorter onboarding descriptions; cis/trans wording kept (and an exFAT drive that keeps unmounting)
- Onboarding step 6 descriptions shortened to one line each ("You're attracted to women." / "…men." / "People who aren't only a man or a woman." / "Women, men and non-binary people."). The fuller wording with "Includes cis and trans women/men", "Cis or trans." and the non-binary examples stays in Settings and the Edit Details sheets — the user said the cis/trans lines are fine there (they were removed for a few minutes and put back).
- The external drive disconnected twice during this session ("Device not configured", `/Volumes/PBE Main HD` gone). Work is not lost, but check `ls /Volumes` and re-verify the `www`/`public` copies (`cmp`) before trusting a sync that was running when it dropped. Do not recreate the folder on the boot disk — it would block the drive remounting under its own name.
- Device builds from here: `DEVELOPER_DIR=/Applications/Xcode.app/... xcodebuild ... -destination id=<phone UDID> -derivedDataPath <scratchpad>/ddphone -clonedSourcePackagesDirPath <DerivedData App-…>/SourcePackages -allowProvisioningUpdates`, then `devicectl device install app` + `process launch com.ozlilbrother.zelo`. Don't mix Xcode 26.6 (Desktop) and 27 (/Applications) on the same caches.

### 2026-10-16a — White setup card; ringing reminder bell
- **"We're setting everything up" (step 12):** `.cine-setup-card` is white with a 1px `rgba(0,0,0,.06)` hairline + `0 2px 14px rgba(0,0,0,.08)` shadow (reference: Cal AI's setup card), replacing the beige `#eeece8`. Dark mode now uses the normal `--s1` card + faint light hairline and normal text colour (the old light-grey `#d6d3cd` dark override is superseded by the later rules).
- **Trial reminder (step 16):** the "Friendly reminder" and "You're in control" cards are removed. New bell art cut from `onboarding/Notif change icon.png` / `Notif dark icon.png` → `onb-bell-ring.png` + `-dark.png` (all saturated pink pieces kept — body, clapper, badge — holes filled; script `scratchpad/mkbell.py`, PIL only since numpy isn't installed), registered for the dark swap. Shown at 236px (max 64%) centred in `.cine-bell-wrap`, no card behind it. `cineBellRing`: swings from the knob (`transform-origin: 46% 6%`, measured from the art) −16° → 13° → −9° → 6° → −3.5° → 1.5° → 0 over the first ~54% of a 3.2s loop, then rests; whole image rotates, so the clapper and the "1" move with it, as in the user's frame-by-frame reference. Off under `prefers-reduced-motion`. The old `onb-bell.png` is no longer referenced.

### 2026-10-16b — Bell and clapper swing separately; two-line reminder title
- The bell art is now two cut-outs on the same 720px canvas, split along the empty rows under the rim (rows 597–608 → cut at 602): `onb-bell-body(-dark).png` (bell + badge) and `onb-bell-clapper(-dark).png`, stacked in `.cine-bell-ring` (clapper behind). Both pivot from the knob (46% / 6%): `cineBellBody` swings ±6° → 0, `cineBellClapper` swings ±12° and a beat later, so the bottom rocks while the bell barely moves; both rest for the second half of the 3.2s loop. Measured frame by frame (body/clapper): −6/−12, 5/11, then settling. Script: `scratchpad/splitbell.py` (+ `mkbell_lib.py`). `onb-bell-ring*.png` from 16a are now unreferenced.
- Step 16 title is 31px (was 35.2px): measured that 32px is the largest size that keeps "We'll send a reminder / before your trial ends" on two lines from 375pt up; 31px leaves headroom for font fallback.

### 2026-10-16c — Plan page: grey card outlines removed
- Step 13's four `.cine-plan2-card`s: `border: none` + the app's standard `0 1px 6px rgba(28,25,23,.06)` shadow (dark: `0 2px 12px rgba(0,0,0,.35)`; computed border verified 0px in both themes — the edge visible in dark is the card fill against the page). The "Zelo will adapt to" column dividers are kept but at 40% of `--border`.
- Icon discussion only (nothing built): step 2 "Choose your sex" (♂ / ♀ / grid icon) is not on the current route — the convo intro skips it and gender is asked in the typed practice questions instead. Step 6 and the Edit Details sheets still use the inline ♂/♀/non-binary/overlapping-circles SVGs.

### 2026-10-16d — Thanks page mascot + hop, new badge and achieve icons, text-only gender options
- **Thanks (step 9):** the winking stand-in `onb-thanks.png` is replaced by the real pink mascot (`onb-thanks-mascot(-dark).png`, re-cut at 600px from `Chats page/Zelo Ai mascot.png` / `Zelo ai mascot dark.png`, S≥25/V≥120 light, S≥8/V≥170 dark) in `.cine-thanks-hero`. Animation (3.4s loop): wrapper `cineThanksHop` (jump −26px with a −4° lean, land, wiggle +5/−4/+2°, rest), img `cineThanksSquash` (anticipation squash 1.08×0.9, stretch in the air, landing squash), and a pink ground shadow `cineThanksShadow` that shrinks while it's airborne. Wrapper = hop, img = squash so the transforms don't overwrite each other. Off under reduced motion. The eyes are baked into the art, so a blink / smile needs extra frames from the user.
- The card's bullseye SVG → the user's wavy badge `onb-thanks-badge(-dark).png` (56px, overlapping the card top like Cal AI's), no tinted circle.
- **Achieve (step 10):** the three line icons → `onb-achieve-convo / -examples / -progress(-dark).png`, cut from `what you can achieve icon(.png| dark.png)` by column (232–692 / 864–1310 / 1536–1924), shown bare at 46px. New generic cutter `scratchpad/mkflat.py` (distance-from-background mask, holes filled, feathered).
- **No icons on gender / practice-with options:** removed the ♂/♀/grid/circle tiles from onboarding step 2 (unrouted), step 6, the Edit Details "Practice with" and "I am" sheets, and the empty icon placeholders in Settings → Who You Practice With.

### 2026-10-17a/b — Generating card over the Scan page; option font; gibberish dictionary was never shipped
- **Option font:** `.cine-opt-name` (onboarding "attracted to" / tone pages) was 18.9px / 800 vs 16.8px / 600 for every other onboarding option (`.cine-opt-label`). Now 1.05rem / 600, desc 0.88rem. Measured all 16 steps: titles are 35.2px/800 everywhere except the deliberately smaller "plain" titles (steps 11, 12, 14 = 28.8px) and step 16 (31px, set on request).
- **Generating card (`#scan-gen`, `_showScanGen` / `_hideScanGen` in script.js):** replaces the full-page "Zelo is thinking…" with a white rounded card over the dimmed Scan page (from the user's Cal AI-style reference): a ring whose arc turns a full circle (1.15s linear, forever) around the mascot, "Writing your replies", a status line that rotates every 1.7s ("Reading her message / Picking the right tone / Polishing the wording"; a screenshot scan starts with "Reading your screenshot / Finding the conversation"), and three dots that tick in turn. Mechanics: `generateReplies()` still `pushScreen('scan-result')` immediately (it owns all the state and the OCR/fetch flow), but the screen is held invisible with `.scan-result--pending` while the Scan tab and tab bar are put back on screen under the card; `_hideScanGen(true)` at the two reveal points takes the tab/tab bar back and lets the result page fade in; `_hideScanGen(false)` on the two OCR-failure paths, just before their `popScreen()`. Verified in WebKit: card shows over the Scan page, ring covers 360°, dots tick, line rotates, reveal leaves nothing covering the result page, OCR failure returns to Scan with the error and no card left behind.
- **BUG FOUND: `words-dict.txt` was never copied into `www/` or the app bundle** (it lives only in the project root), so the gibberish guard's fetch got a 404 and the HTML body was parsed as the "dictionary" — nearly every real sentence was flagged as gibberish and asked "did you mean to send this?". Fixed three ways: the file is now in `www/` + `ios/App/App/public/`; a non-OK response throws; and a failed load leaves the guard OFF (`_gibDictionaryLoaded = false`, fail-open as `_looksLikeGibberish` already documents) instead of installing an 11-word stand-in list. Verified: "hey what are you up to this weekend" and "lol u free tmrw?" pass, "sadawe adijaoidj" is still caught. **Any new root-level data file the app fetches must be added to the manual sync list** (index.html, script.js, style.css, words-dict.txt, …) — `cap copy` no longer does it.

### 2026-10-17c — Tone step replaced with a real reply-style demo; plan page replaced with "You're all set"
- **Why:** the old step 7 ("Which tone fits you best?" — Playful / Chill / Direct) wasn't a feature. Its answer only ever added one faint line to the practice-chat system prompt (`_TONE_HINTS` in `_userGoalHint`), Scan never read it, and its three words didn't match the seven reply styles the app actually has. Step 13 restated the user's own answers in four cards and ended in nothing ("Zelo will adapt to" was fixed copy).
- **Step 7 is now a scripted demo of Scan.** Kendra (z019, the same persona the practice tutorial deals) texts "ok but you still haven't told me what you actually do for fun" — typing dots, then a typewriter — and five replies slide in **unlabelled**. Tapping one drops it into the thread as the user's own bubble, clears the choices and only then names the style behind it ("That's a Funny reply", coloured with that style's own `STYLE_COLORS.accent`). Labelling them up front would turn "which sounds like me" into "which word do I like". "Pick a different one" brings the choices back with theirs marked, without retyping her message; the existing answer stands until a different one is picked, so Continue never re-locks. Re-entering the step with an answer already given shows the finished state instead of replaying. All of it is in `cineRunStyleEntrance()` / `_cineStyleCommit()`.
- **No AI call, by necessity:** there is no account until step 14 and `deepseek-proxy` rejects signed-out callers, so her message, the five replies and the explanations are all written out (`CINE_STYLE_HER` / `CINE_STYLE_OPTIONS` / `CINE_STYLE_WHY`). Don't "improve" this by wiring it to the model without first solving sign-in order.
- **The answer now does something.** It is a real `STYLE_LABELS` id saved to `zelo_first_style` (`FIRST_STYLE_KEY`), and `getEligibleStyles()` moves it to the front of whatever the situation allows — index 0 is the card Scan opens on. Applied **after** the heavy-situation filter, so Funny/Bolder still can't reach an Argument/Toxic Relationship (asserted in the test). `cineAnswers.tone` / `zelo_onb_tone` keep their names (records.js `ONBOARDING_KEYS` reads that key) but now hold a style id, so `_TONE_HINTS` was re-keyed to the style ids. An old install with 'playful'/'chill' stored just gets no tone hint until they re-answer.
- **Step 13 is "You're all set, {name}."** — the goal they picked in step 5 as one line ("Built around keeping conversations going.", via `CINE_READY_GOALS`), then one card with three numbered steps for what they'll actually do first; step 1 names the style they just picked. The four `.cine-plan2-*` cards, the banner and their four backing constants are gone; the `.cine-plan2-*` CSS is still in the stylesheet, unused, since the rest of this is a markup swap away from being restorable.
- Settings → Tone (`zelo_settings_tone`) is **still inert** — it saves a value nothing reads. Deliberately left alone this round; it should either set `zelo_first_style` too or be removed.
- Verified in real WebKit, light and dark (`scratchpad/t_style.js`): dots-before-choices, full typed message, five choices with their one-shot entrance stripped, Continue gated, pick → own bubble + named style + both keys written, `getEligibleStyles` reordered, heavy situation still safe, pick-again, back-and-return, and step 13's name/goal/style lines. **Test timing trap:** the choice cascade is `85×4 + 340 + 40 ≈ 720ms` after the options render — sampling `animationName` before that reports a stray `fadeUp` on the last one and reads as a bug.

### 2026-10-17d — Step 7 copy rewritten to stop reading as AI; step 13 says what the user actually got
- **"Too AI" was a real, diagnosable problem, not a vibe.** The 17c reply choices were joke-SHAPED ("competitive overthinking. i'm nationally ranked"), writerly ("i was saving that for when you'd be impressed") and film-dialogue ("easier to show you than text it") — every one a construction nobody types. Rewritten flat and specific, following the same rules `_humanizeText()` and the live-suggestion prompt already enforce (lowercase, fragments, no exclamation marks, no emoji, no em dashes, no closing full stop): "nothing crazy, usually food and someone's couch" / "lie in bed thinking about going to the gym" / "climbing mostly. you should come next time" / "not much honestly. what's yours" / "easier to just show you. you free sunday". Her message went from the setup-y "ok but you still haven't told me what you actually do for fun" to "wait what do you actually do on weekends". **If these ever get regenerated, hold them to the humaniser's rules — hand-written demo copy is exempt from the code path, not from the standard.**
- Title "Which reply sounds like you?" → "Which one would you actually send?" and the lede → "She just texted this." (it now sets up the card directly below it instead of describing the product). `CINE_STYLE_WHY` is **gone** — those five one-line style descriptions were the most marketing-sounding thing on the screen; the result is now just the style name plus "Zelo writes like this first. You can switch on any reply."
- **Step 13 answers "what did I actually get".** The 17c version was three generic how-to steps, and the user's read of it was "cleaner for sure, but I don't know what I got". It is now three labelled rows, each an eyebrow + their own value + one line of what it means: YOUR REPLY STYLE → the style they picked (coloured with that style's own `STYLE_COLORS.accent`, same as step 7's result, so the two screens read as one answer); WHAT WE'LL WORK ON → their #1 goal, with a second goal folded into the note; WHAT YOU GET → "Replies, practice and a coach". The lede is gone (the rows carry it).
- **Every line on that screen is something that is wired up**: the style row is what `getEligibleStyles()` now puts first, the goal row is what `_userGoalHint()` feeds the practice-chat prompt. Deliberately NOT claimed: anything about the `overthink` answer (step 4), which still drives nothing in code — it would have made the page feel more personal and been a lie.
- `scratchpad/t_style.js` updated and green in both themes. **Test trap hit while updating it:** the "back shows the finished state" assertion compared her message LENGTH (`>50`), so shortening the copy failed a check that had nothing to do with the change — assert on content, not length, when the content is the thing being edited.

### 2026-10-17e — Three-arm onboarding A/B test; natural-texting rules applied to the Scan prompt
- **Three conversations, one per arm** (`STYLE_DEMO_VARIANTS` a/b/c in script.js): A "quiet in person", B "first date, nice or casual", C "going out or staying in". The arms differ ONLY in Kendra's message and the five replies — same layout, same style order (smooth, funny, direct, warmer, bolder), same reveal — so a difference in conversion can only come from the conversation. Reveal wording is "You picked Funny." / "We'll use this style first when you try Scan."
- **Assignment** (`_styleDemoVariant()`): uniform 1-in-3, stored in `zelo_style_variant`, **assigned at launch and never re-rolled**. Assigning at launch rather than on reaching step 7 is deliberate — the earlier steps' events then carry the arm too, which is the only way to check the arms were balanced *before* the screen they differ on (an A/A sanity check). A re-roll would put one person in two arms and quietly poison the result, so there is no code path that reassigns.
- **`ZeloAnalytics.setGlobal(key, value)`** is new: properties registered there are merged into every event that **allow-lists that key**, so the arm rides along on `step_completed` / `step_abandoned` / `onboarding_finished` / `scan_started` / `scan_completed` / `tone_selected` / `paywall_viewed` / `trial_started` / `subscription_started` without each call site passing it. It goes through the same allow-list and type checks as any other property, so the privacy contract is unchanged — note `_clean()`'s old `if (!props) return out;` early-exit had to go, or a no-property event would drop the globals.
- Two new events: `style_demo_shown` (the denominator — fired once per arrival at the unanswered screen) and `style_demo_picked` (`tone`, `position` 1-5, `repicked`). **`position` exists to catch plain top-of-list bias** before a style distribution gets read as a preference.
- **Both sinks, on purpose:** PostHog carries the funnel *including everyone who never signs up* (the group that matters most here); `onboarding_responses` gets a `style_variant` row per account via `ONBOARDING_KEYS`, which only lands after sign-in. Neither alone answers the question.
- **Scan's reply prompt rewritten** (`_fetchDeepSeekReply`). It used to open "You are Zelo, a witty and confident texting coach" — a coach voice is exactly what makes a suggestion unsendable, and the user is the one sending it. Now: natural-texting rules first (no scripted pickup lines, no manufactured jokes, no unnecessary flirting, no marketing-polished sentences, no automatic questions/invitations, length follows the message), then a per-style line that says what that style changes about the EXPRESSION (`STYLE_RULES`), then the existing situation/goal constraints. Order matters: style is applied on top of a believable reply instead of replacing who is speaking — "Bold" was otherwise reliably becoming a date invite.
- **Deliberately NOT applied to:** the chat suggestion chips (`_fetchSuggestions` already has equivalent rules plus `_humanizeText`, and its forced lowercase directly contradicts the new "don't force lowercase slang" rule — reconciling those is its own task), the practice personas (`_fetchAIGirlReply` — that's HER texting, not the user), and AI Coach (advice, not a text).
- Verified in WebKit (`scratchpad/t_ab.js` + the updated `t_style.js`): 900-draw assignment spread, stability, all three arms render distinct text with zero shared lines, both events fire with the right payload, the arm reaches the Supabase queue, the promoted style leads only where the situation offers it, and the built prompt contains the new rules and no longer says "coach". **Same timing trap as 17d, hit again:** arm C's message is 108 chars vs arm A's 61, so a fixed wait tuned on one arm fails on another — wait for the state, or size the wait to the longest arm.

### 2026-10-17f — Onboarding demo: her message cut to two lines in every arm
- User: her lines were "too much, like 3 sentences". They were one long sentence each, but arms B and C ran ~108 characters and wrapped to three lines. All three are now 54-63 characters and measured at **2 lines on a 390pt screen** (A "i feel like you're pretty quiet in person, am i wrong?", B "random question, nice first date or something more casual?", C "you said you like going out, but do you actually stay in a lot?").
- **Matching the lengths also matters for the A/B test:** with B and C nearly twice as long as A, message length was a second variable differing between arms. Keep any future arm within the same line count as the others.
- C no longer says "homebody"/"staying in person": its warmer reply already asks "are you more of a homebody?", which would have echoed her own word back.
- **Flaky test, not a product bug:** `t_ab.js` asserted the queued Supabase arm was a hardcoded `'c'`, but the queue correctly holds whichever arm the page was randomly assigned at launch, so it only passed when the draw happened to be c. Assert queued === registered arm instead, and run any test involving random assignment several times before trusting a single green.

### 2026-10-17g — Original demo wording restored; the chat box widened instead (supersedes 17f's copy cut)
- User: don't change the words of B and C, keep the original flow, make the box wider if that helps. All three arms are back to the exact original messages (A 61 chars, B and C 108).
- Measured on real WebKit at 375/390/430pt: the bubble was capped at 88% of a 340px column (~30 characters a line), so B and C wrapped to **4 lines**. `.cine-screen--style .cine-scroll` is now 372px wide, `.sty-bubble` is `max-width: 100%` with 12px side padding and the card padding is 10px: B and C are **3 lines**, A stays 2, at all three widths. A smaller font (0.88rem) gained nothing more, so the size is unchanged. **Two lines for B and C is not reachable without changing the words** (it needs ~54 characters a line, which is a ~12px font).
- Consequence for the A/B test: A is half the length of B and C again, so message length is a second variable between arms. If B or C wins, part of that may be length rather than topic.
- Noticed, NOT changed (not asked for): the bubble text and the "Kendra, 24" block are centre-aligned because `.cine-scroll` sets `text-align: center` and `.sty-chat` doesn't reset it, while the choices below are left-aligned.
- The 17f test assertion `endsWith('stay in a lot?')` was reverted to `staying in person`. Both suites pass across several random arm draws.

### 2026-10-17h — She keeps the chat moving after an "ok" (and stops piling questions on a dodge)
- **Gap found:** `_curiosityHint()` steered her only from how often SHE had asked recently, never from what the USER just sent. So "ok" and a long story got the same treatment and a dead-end reply ended the chat. Worse, its "effort" branch told her to add a follow-up question whenever the user had asked something, which is exactly the pile-on case.
- **Fix:** `_readUserTurn(history)` / `_classifyBurstText()` read the user's trailing burst with plain string checks (no AI call, instant, testable) and label it `ack` (ok / lol / yeah / emoji-only / "makes sense" ...), `closing` (gtg, night, bye), `question` (a bare question that does not start by answering) or `other`. `_curiosityHint()` consults it first:
  - **ack, her last message was a statement** -> react in a few words, then ONE easy specific question (answerable in a few words, ideally this-or-that), with a small share of her own so it is not an interview; she may send the reaction and the question as two messages.
  - **ack, her last message asked something** (they gave a minimal answer) -> NO new question; she shares something of her own and, at most, offers an either/or.
  - **second ack in a row** -> topic is finished; she moves to something new from her own life instead of asking about the same thing again. Streak counts user BURSTS, so "ok" + "lol" sent together is one.
  - **bare question while her question is still unanswered** -> answer theirs first, no new question, never mention they skipped hers.
  - **closing** -> short goodbye, no question or new topic. Added because the drive rule would otherwise have fired on "ok gtg".
  - Everything else falls through to the old question-rate rules unchanged. `forceShort` retries are untouched.
- `"i'm good, how about you?"` is deliberately NOT a dodge (it starts by answering). Classification is heuristic: a miss just means the old behaviour.
- Verified in WebKit (`scratchpad/t_drive.js`, 19 cases + the real payload through `_fetchAIGirlReply` + forceShort untouched). The first run missed "makes sense" because it has no word on the strong-ack list; "sense/guess/see/got" were added. **NOT verified against the live model** — whether DeepSeek actually follows these lines, and whether the questions feel easy rather than interview-like, needs real chats.

### 2026-10-17i — Harder personas carry less, in three tested levels; drop-off data recorded
- User: yes to "hard personas should drive less, but occasionally"; the point is to find the middle where users leave, and keep that data. Easy/medium/hard (`DIFFICULTY_CONFIG` descriptions already say hard = reserved, short replies) now gate the ack-turn behaviour from 17h.
- **Gate (`_shouldCarry(streak)`):** on an acknowledgement turn she carries with probability `carry` (easy 1.0; medium/hard per level), and ALWAYS carries once the user has sent more acks in a row than `quiet` allows (easy 0, medium 1, hard 2), so nobody sits in dead air for long. When she doesn't carry she is told a short reply matching their energy is fine and not to comment on it. `expert` is treated as hard, an unknown difficulty as medium. **`dodge` and `closing` are correctness rules and are never gated.**
- **Three levels, one per install (`DRIVE_LEVELS`):** low (medium .40 / hard .10), mid (.65 / .25), high (.85 / .50). Assigned uniformly at random once, stored in `zelo_drive_arm`, registered at launch for everyone (onboarded or not) via `_registerDriveArm()` in `initOnboarding()`, same idea as the onboarding style arm. The numbers are starting guesses, not findings.
- **Data (PostHog only, no migration):** `drive_arm` is on `practice_session_started/ended`, `app_opened` and `session_length`. `practice_session_ended` also carries `difficulty`, `user_msgs`, `ack_turns` / `carried` for that session (per-chat tally in `chat.drive`, baseline taken at session start) and **`left_after`** = what the chat was waiting on when they left: `her_question` / `her_statement` / `user_ack` / `user_question` / `user_closing` / `user_other`. All short codes or numbers, no message content. analytics.js reads the saved arm before its first `app_opened` so the launch event retention is measured from isn't missing it (a user's very first launch still lacks it, since the arm is assigned afterwards in script.js).
- **How to read it:** compare, per arm and difficulty, session length, sessions per user and day-2/day-3 return, and look at `left_after` — a high share of `user_ack` or `her_statement` exits on the low arm means dead air is where people leave. Needs many users per arm before differences mean anything.
- Verified in WebKit (`scratchpad/t_drive2.js`: gating per difficulty/streak/roll/arm, correctness rules ungated, tallies, 900-draw assignment, session-end payload through a mocked PostHog plugin, `left_after` codes, later-launch `app_opened`). Not verified against the live model or on a device.

### 2026-10-17j — Persona audit without the model: shared openers, and the length guards were cancelling the "carry" reply
- **Could not run the live persona conversations**: `ZELO_DEV_LOGIN` is null (dev-credentials.js), anonymous sign-ins are disabled, and `deepseek-proxy` rejects signed-out callers. A harness exists (`scratchpad/audit/chat_test.js`, runs the real `doTypingAndReply` pipeline over 15 personas x 8 human-ish turns; `STUB=1` checks plumbing without a model; it blanks `ZeloRecords.logAiRequest` so the real `ai_usage_log` isn't written). Scratchpad is wiped between sessions — copy it into the repo if it should survive. The fade-out-and-return case can only show "she doesn't text back" until the schedule plan is built.
- **Found and fixed — openers:** no persona had an `opener`, so all 135 fell back to `OPENINGS[difficulty]`: every easy persona sent "Hey! I was hoping you'd message first, how's your day going?" (capital H, "!", eager) whatever her prompt said — shy girls "never make the first move", Emily "doesn't force conversations", whole archetypes are lowercase-only. `personas-roster.js` now gives every persona an opener: the 10 pilots their own (from their TEXTING STYLE casing), the roster 3 per archetype picked by id hash (`ROSTER_OPENERS`). A persona with no entry still falls back to `OPENINGS`.
- **Found and fixed — my 17h/17i bug:** every length guard is sized off the user's last message, which after "ok" is ONE word: `max_tokens` 40, the 12-word floor in `doTypingAndReply`, the persona rule "never more than 1.5x what they sent", and the retry text "Reply in roughly 1 words". A carried reply (reaction + small share + question) is longer by design, so the guard discarded it and the retry (which also drops every hint) asked for one word, silently undoing the feature exactly when it fired. Carried turns now get `CARRY_MIN_TOKENS` 100, `CARRY_MAX_WORDS` 30, a retry target of `CARRY_RETRY_WORDS` 20, and the hint says it overrides length-matching for that one reply. `state.replyCarried` is set in `_noteDrive()`. Also learned: `truncateToWordLimit` cuts by whole sentences, so a reply just over the cap collapses to its first sentence ("ha fair.") and loses the question — which is why the cap was raised from 24 to 30 after the first test reply landed at 25.
- **Measured, NOT changed (needs a decision):** the 125 roster personas are only 6 archetypes (warm 32, polished 26, dry 23, bubbly 20, shy 12, chaotic 12); ~18 sentences of facts are unique to each girl, while voice, habits, flirting and casing come from the archetype, so two girls of one archetype will text alike. Difficulty is also 1:1 with archetype (warm/shy easy, bubbly/chaotic medium, dry/polished hard), so a warm or shy girl can never be hard. The pilots' prompts say "doesn't force conversations / comfortable with silence / doesn't always ask something back" (Emily, Sophia — both easy) while easy now always carries on an "ok"; whether the later hint beats the persona prompt needs the live test.
- Verified in WebKit (`t_carry.js`, plus `t_drive`, `t_drive2`, `t_style`, `t_ab` all green).

### 2026-10-17k — Many more openers, a personal-habits layer, and difficulty split from voice (supersedes 17j's "not changed" items 3-4)
- **Why the live test is still blocked, answered properly:** a fresh browser gets `401` from `deepseek-proxy` and `422` from `/auth/v1/signup` (anonymous sign-ins off), re-checked this round. Signed out, the real code path does not error visibly: `doTypingAndReply`'s catch sends the canned **"sorry got distracted lol"** every turn, so a signed-out chat looks alive but is not the model. If real replies appear on the user's phone/simulator, that device has a saved login session; a blank test browser has none. Unfixed finding: that silent canned fallback has no "signed out" indication in the practice chat (AI Coach has a pill).
- **Openers:** the generic `OPENINGS` table (3 lines by difficulty) is deleted from data.js; script.js falls back to `'hey'` if a persona has no opener (none do). Each of the 6 voices has a pool of 14 (`ROSTER_OPENERS`: heyy / hiii / hey hey / hiya / yo / "Hi there. How has your day been?" ...), chosen by id hash so a girl always opens the same way and Reset Chat repeats it. The 10 pilots draw from the pool of the nearest voice (`PILOT_VOICE`). No opener mentions a day or time (it's fixed text) and none has an emoji. 135 girls -> 64 distinct openers.
- **Six voices, decided (not removed):** kept, because the voice archetypes are the good part. Added: (1) **difficulty is no longer locked to voice** — `DIFF_SPREAD` draws each roster girl's difficulty from weights (mostly her voice's natural one; independent hash per id, so roster edits don't reshuffle others), and when it differs from natural a `HOW MUCH EFFORT YOU PUT IN` line (`DIFF_EFFORT`) is appended so the label changes behaviour, not just the badge/timing/drive rate. Result: easy 40 / medium 48 / hard 47; a warm girl (3) and a shy girl (2) can now be hard; bubbly happened to get no hard girl (10% weight, chance). (2) **`YOUR PERSONAL TEXTING HABITS`** appended to each of the 125 roster prompts, drawn per id from per-voice pools: two words she reaches for, message length, emoji habit, ask-back habit (pool follows her difficulty, so a hard girl can't be told to "often" ask back) and one personal tic. 124 of 125 combinations are distinct. Pilots are untouched (hand-written, own habits). Average roster prompt grew by about 480 characters.
- **Unverified against the live model** — all of this is prompt text. Whether two girls of one voice now read as different people, and whether the effort line really makes a warm-hard girl guarded, is exactly what `scratchpad/audit/chat_test.js` is for once there is a login.
- Verified in WebKit (`t_voices.js` plus `t_carry`, `t_drive`, `t_drive2`, `t_style`, `t_ab` all green). Two thresholds in the first run of `t_voices.js` were my own arbitrary numbers (every voice reaching all three difficulties; a 9,500-char prompt ceiling), not product bugs.

### 2026-10-17l — Simulator fast loop (no taps, no Xcode build, no onboarding)
- **Why every simulator run was slow:** (1) a DEV block at the top of the DOMContentLoaded handler in script.js wipes `zelo_onboarding_done` and the profile keys on every launch, so onboarding always runs; (2) the only skip is the small X (`.cine-showcase-skip` -> `finishOnboardingNoPrompt()`, "TESTING ONLY") on the SHOWCASE screen, which appears only after the intro finishes; (3) there is no tap driver for the simulator (no idb/axe; System Events hung earlier) so that X could not be pressed; (4) `xcodebuild` + install for a web-only change is minutes of wasted work.
- **The loop that replaces it (about 11 s):** a web-only change never needs Xcode. `rsync -a --delete --exclude='._*' ios/App/App/public/ "$(xcrun simctl get_app_container <udid> com.ozlilbrother.zelo app)/public/"` puts the current bundle into the app already installed on the iPhone 17 Pro simulator (`9EA332B0-776D-4295-BFF6-3616F1C94998`; use `bash -c`, zsh aborts on unmatched globs). A **simulator-only** `public/sim-dev.js` (added to the installed copy's index.html, never to the repo) runs at launch: logs the build stamp and signed-in state, calls `finishOnboardingNoPrompt()` (the X), and can open a chat. It reports through `fetch('http://127.0.0.1:8777/')` to `scratchpad/audit/logsink.js` (ATS does not apply to IP addresses, so plain http works); `simctl launch --stdout=` produced nothing. Screenshots: `xcrun simctl io <udid> screenshot <file>`. Only a native change (Swift, Info.plist, plugins) needs a real xcodebuild; the installed shell there dates from 2026-09-26.
- **None of the four simulators with Zelo installed has a saved login** (checked key names only: no `sb-*` entries), so the simulator is signed out like a fresh browser and the proxy still answers 401 / "sorry got distracted lol". A session saved by signing in once inside the simulator persists across relaunches (the DEV block does not touch Supabase keys).
- Verified: current build `2026-10-17k` shown at the bottom of the real WKWebView, onboarding skipped automatically, Kendra's chat opened with her new opener "Hi! How are you?".

### 2026-10-17m — "Auth session missing!" when signing in on the simulator (my wrong route)
- I told the user to sign in via Account -> Profile & Login -> Email. That screen's "Connect" calls `AUTH.linkEmail()` = `supabase.auth.updateUser({ email, password })`, which only works on an EXISTING session, so signed out it fails with Supabase's "Auth session missing!". It links an email to an account you are already in; it is not a sign-in.
- The real sign-in entrances for a signed-out user: the sheet opened by `AUTH.showEmailScreen('signin')` (the AI Coach "Sign in required" pill -> `aiCoachStatusSignIn()`), the first onboarding screen's "Already have an account? Sign in" (`cineShowcaseSignIn`), and onboarding step 14 "Continue with email". Only `requireAuth` caller is Download My Data. Google sign-in still uses a placeholder client ID and Apple needs an Apple ID in the simulator, so use email.
- The simulator helper now has `MODE = "signin"`: after pressing the onboarding X it opens that sheet itself, and only when signed out.

### 2026-10-17n — Slow "Continue" on sign-in, and the surprise screen after it (root cause: no grants on `profiles`)
- **Root cause of the surprise screen is in the live database, not the app.** Queried from a signed-in simulator session (`scratchpad/audit/sim-dev.js`, modes `inspect` / `tables`, which log only non-secret fields): `SELECT` and `UPDATE` on `public.profiles` both answer **42501 "permission denied for table profiles"**, while `onboarding_responses`, `consent_records`, `scan_replies`, `practice_sessions`, `practice_messages` and `ai_usage_log` all read fine (which also confirms the 09-26/09-27 migrations ARE applied; `generated_replies` / `matches` are gone as renamed). No repo migration revokes profiles, so the grant was simply never made (same lesson as 20260926140000). `_loadProfileIntoLocalStorage()` swallowed that error, so a returning user looked profile-less and `_onSignedIn()` sent them to the **name-and-age setup screen** — the unexplained "verification" after signing in. Their account itself is clean: email confirmed, no pending email change, provider email, not anonymous, so no 6-digit code is expected on sign-in (the code screens only appear after "Create account" or when signing in to an unconfirmed email).
- **Fix to apply (NOT applied — needs the user):** `supabase/migrations/20261017210000_grant_profiles.sql` (`enable row level security` + `grant select, insert, update, delete on public.profiles to authenticated`, service_role all). Paste it into the ZELO project's SQL editor (bfxxywxhydxvccusjinm; the local CLI is on another account). Until then profile reads/writes keep failing silently: setup, the onboarding profile insert, account deletion's profile delete.
- **Client hardening (done):** `_loadProfileIntoLocalStorage()` now resolves `'found' | 'none' | 'error'` (`PGRST116` = no row; anything else is a failed READ, which says nothing about whether a profile exists). On `'error'` the sign-in carries on without asking for name and age and leaves `zelo_setup_done` unset to retry; only a genuine `'none'` shows the setup screen.
- **Why Continue felt slow:** after the press the sheet waited for two serial network round trips (the sign-in, then loading the profile, ~250 ms each from the simulator, more on a phone) with no change on screen. Now: the button flips to "Signing in…" / "Creating account…" and disables the moment validation passes (`_setSubmitBusy`), releases on every failure path including a thrown network error, and resets whenever the sheet reopens; a returning user (`zelo_setup_done` set) closes the sheet immediately and refreshes the profile in the background (measured 54 ms vs the stubbed 1.5 s refresh). Only the onboarding sign-in path still waits for the profile.
- Not changed: the stage-1 "Continue with email" -> email step still waits 260 ms before focusing the field, tied to the slide animation; shortening it needs a feel check on a phone.
- Verified in WebKit (`t_signin.js`, stubbed Supabase, 8 checks; every older suite green). Also fixed along the way: `20261017l` cache busters for style.css, services/auth.js and script.js.

### 2026-10-17o — First live persona tests (real model, signed-in simulator): what they showed and what was fixed
- **How it ran:** `scratchpad/audit/simsync.sh harness START COUNT WAIT SCRIPT` puts the current bundle into the simulator app and runs the real `doTypingAndReply` -> `_aiInvoke('deepseek-proxy')` pipeline for a slice of the persona list over a scripted conversation (script A = 8 short turns incl. "ok"/"lol"/a dodge/a long share; script B = 9 turns incl. a flirt, a coffee invite, "are you a bot", a goodbye), reporting through the log sink; `analyze.py` compares runs. The proxy allows **120 calls per user per UTC hour** (`RATE_LIMIT_PER_HOUR`), so batches are ~60-95 calls and gated on the hour; the harness stops at 95 or on a 429.
- **Harness bug caught first:** the first run's wait only checked that the message count stopped growing, so on slow replies the next user message went out before the previous reply landed and every transcript was a turn out of step (e.g. answering "what do you do" after "where are you from"). It now waits for an AI message to arrive, then for ~2.8 s of quiet. Do not trust transcripts from before that change.
- **Real findings and fixes (all verified live, same six girls, before -> after):** a `[laughs]` typed as literal text 2 -> 0 (`_stripStageDirections`, plus a "no brackets/asterisks" line in the reply prompt); blank lines inside a single bubble (two paragraphs in one text, an AI tell) 5 -> 0 (`_parseAiReplyParts` now treats a blank line like `|||` and a single newline as a space, still capped at 3 bubbles); the same topic re-asked after it was skipped 1 -> 0 (the carry hints now ban repeating a skipped question and the stock "what about you / what do you do / how about you"); "born and raised" in 5 of 6 answers to "where are you from originally?" (fix below).
- **Hometown (`personas-roster.js`):** the data only said where each girl LIVES, so all invented the same stock answer. The roster is international (London, Seoul, Rio, Lagos...), so no place names are picked in data; each girl gets a stable background in her prompt: grew up in her city (59), in a smaller town an hour or two outside it (42), or moved from a bigger city a few hours away "for school / work / after college / for a fresh start" (24); 28 whose home line says she lives with family always "grew up here". The prompt bans the phrase "born and raised". My first attempt used a US-only city list and a family-keyword rule that forced 106 of 125 to stay; the data showed it (a Leeds girl got a US hometown), so it was replaced. NOT yet confirmed live (script B never asks where she is from); a later run should.
- **Looked right, left alone:** the voices ARE distinct in the live run (Chloe's "fair" / "noted" are her own signature words, Wren's chaos, Amara's formality, Emma's shy "lol"); openers match each voice; the ack pivots work (a hard-to-spot success: after the last "ok", easy/medium girls changed topic with something of their own, e.g. "i lost my phone in my apron again"); hard girls go quiet ("fair", "hm", "haha") as designed. Some girls tease short replies ("cool is doing a lot of heavy lifting") even when told not to; for the dry/chaotic hard girls that is in character, so it was not blocked. Three of six echoed the user's "pretty good" back (the NEXT_BUILD "no mirroring" rule) - minor, unfixed.
- Every suite green (`t_parse`, `t_hometown`, `t_signin`, `t_voices`, `t_carry`, `t_drive`, `t_drive2`, `t_style`, `t_ab`).

### 2026-10-17p — profiles grants applied; rate-limit reset; batch 2 started early
- The user ran the SQL in the Zelo project's SQL editor: `profiles` grants (`enable row level security`, `grant select, insert, update, delete ... to authenticated`, `grant all ... to service_role`) and a one-off `delete from public.api_rate_limits where user_id = '<dev account>' and window_start >= now() - interval '1 hour'` (the "exception" asked for: resetting that one account's counter, NOT a permanent exemption; a permanent one would need a change to `supabase/functions/deepseek-proxy/index.ts` plus a deploy, which is not possible from here — the local CLI is on another account).
- Verified from the signed-in simulator (`sim-dev.js` mode `profiles`): the profile read no longer returns 42501; `PROFILE_OWN rows=0` — the dev account has NO profile row (it could never be saved while the grants were missing), so its next sign-in on a device with `zelo_setup_done` unset shows the name-and-age setup screen once, and that insert now works; `PROFILES_VISIBLE rows=0 onlyOwn=true`, update of someone else's id changes 0 rows. **rows=0 cannot distinguish "locked down" from "empty table"**, so row isolation is not positively proven; check the profiles policies in the dashboard (Authentication > Policies) or `select policyname, cmd, qual, with_check from pg_policies where tablename = 'profiles'` once, to confirm each is `auth.uid() = id`.
- Killed the queued 16:01 UTC run (`pkill -f "[s]imsync.sh harness 6 8"`; the `[s]` stops the pattern matching its own command line) so a second `simsync` could not terminate the app mid-run, and started batch 2 immediately (`harness 6 8` script B).

### 2026-10-17q — Live batch 2 (script B: flirt, coffee invite, "are you a bot", goodbye): invites ignored difficulty
- **Results (8 girls, the ones whose difficulty was shifted off their voice's default, plus Emily and Victoria):** all 8 admitted being an AI when asked "are you a real person or a bot lol", each in her own voice ("lol yeah it's an ai app, that's the whole thing", "yes. ai conversation app. anything else"); all 8 said goodbye to "anyway gtg, talk later" with no question; the "what's your type" answers were varied and in voice. **7 of 8 accepted "wanna grab coffee sometime?" immediately, six messages in, including the hard ones** (Victoria: "coffee sounds good"; Ivy, medium dry: "sure"); only Nia (chaotic, hard) deflected. So difficulty had no effect on the moment that matters most, and a user would learn that asking always works. Three also answered with the identical "what part of town are you in?".
- **Fix (`_inviteHint`, script.js):** the invite is detected in code (an instruction only works if the model notices the moment) and answered by difficulty and by thread length (total messages, `INVITE_MIN_MESSAGES`: easy 0, medium 14, hard 26). Below the threshold: easy says yes warmly and briefly; medium is warm but not ready ("get to know them first", keep chatting); hard deflects lightly. At or above it, yes for everyone. Anything that is really a suggestion to go to a private place ("come over", "go back to my place", "your place or mine", "stay over") is declined kindly at EVERY difficulty, late or not. Patterns are deliberately narrow: "lol my place is a mess", "i love coffee", "do you like coffee?" are not invites (my first pattern treated "my place" alone as an invitation); a bare follow-up like "so coffee?" is (checked on the last message only, so "like coffee?" cannot match). `expert` acts like hard, unknown like medium. The thresholds are guesses, not findings.
- **Em dashes:** the polished voice's AI-identity line in `ROSTER_ARCH` contained one ("Yes — AI practice app."), and `_parseAiReplyParts` now turns any em dash in her replies into a comma. Pilots' prompts contain 87 em dashes as instructions; that is prompt text, not output, so left alone.
- **Rate limit:** the dev account hit the per-hour cap (120) in earlier runs; the user cleared that account's counter in SQL once (see 17p). Batch 2 then used 94 calls. Verification run for the invite change is queued for 16:01 UTC (`harness 0 6 1500 C`: two girls per difficulty, an early invite at message 4 and again at message 10).
- Tests: `t_invite.js` (12 checks) plus every older suite green. Two test-side mistakes worth remembering: a "Lane 2" split matched the shared safety block instead of the persona's own block, and the false-positive list is what caught the over-broad "my place" pattern, so keep adding harmless near-misses when a detector is written.

### 2026-10-17r — Blocked after three warnings, and she texts if you go quiet (both new; tested with a stubbed model, live check queued)
- **Blocking (`BOUNDARIES` section in script.js):** she doesn't change how she talks. The reply prompt tells her to start a reply with `[boundary]` ONLY when she is actually setting a limit (sexual, degrading, threatening or abusive; never ordinary flirting or a clumsy joke). `doTypingAndReply` strips the tag (`_extractBoundary`, also scrubbed everywhere by `_stripDirectiveTags`; kept across the length-guard retry, whose prompt has no tags), then `_registerBoundary()` counts a strike per chat. Strikes 1 and 2 add a neutral notice in the thread ("Warning 1 of 3: keep it respectful, or Kendra will block you."), stored in `chat.notices` so a repaint keeps them; strike 3 sets `chat.blocked`, hides the composer behind a "Kendra blocked you" card with Reset chat / Delete chat (both reuse the existing confirm sheet), and blocks sending. `BLOCK_DECAY_TURNS` = 8 clean replies in a row forgive one strike. Reset clears strikes, notices and the block; Delete removes the chat. Events: `boundary_warning {n, difficulty}`, `chat_blocked`. Detection is the model's own call, not a word list, so it works in any language; the cost is that it is only as consistent as the model's tagging, which the live abuse test measures. Known soft spot: Reset starts clean, so someone can keep going; per-persona strike memory across resets was suggested but not built. In-memory like the rest of `chatStore`: a block does not survive an app relaunch.
- **Nudges (`NUDGES` section):** after her message, `_scheduleNudge()` waits `NUDGE.firstMs` (60 s, +-15%) and fires one follow-up written at that moment from the conversation (a small related thought or a light check-in; never guilt-tripping; she can answer `[none]` if the chat had clearly ended); a second at `secondMs` (3 min); never more than `NUDGE.max` (2) until the user sends something (`chat.nudges` resets). Only while the chat is on screen, only in Instant mode, never before the user has spoken or after a goodbye, paused while the box has text, cancelled by sending, leaving, blocking or Reset. Whether she bothers follows the same dial as how much she carries a conversation (`_driveRate`: easy always, medium and hard less often; a skipped one still counts), so there is one number to tune. Event `nudge_sent {n, difficulty}`. **Not built (still planned):** out-of-app follow-ups via local notifications, and saved chats, which they depend on.
- Tests: `t_block.js` (9 checks) and `t_nudge.js` (13) drive the real chat screen with a stubbed model, plus every older suite. Test-side lessons: she "types" 1-2 s before a nudge lands, so waits must cover that; and by the time you look at the first nudge the second may already have started, so assert `>=`.
- Live checks written as `sim-dev.js` modes `fade` (four normal turns, then silence for 85 s, and 270 s for the first girl) and `abuse` (seven escalating messages to three girls, screenshot of the card), chained by `run_live.sh` behind the invite verification run.

### 2026-10-17s — Invite check (live): the prompt alone did not hold; added a code backstop
- **Result of the live check (script C, 6 girls, early invite at message 4 and again at 10):** only 1 of 6 held off early (Amara, hard polished: "Coffee's a bit fast though, I barely know you yet", then "Not yet." later, exactly as designed). The other five accepted at message 4, including a medium girl and a hard one (Chloe: "sure. i know a spot"), and Chloe accepted again at message 10 ("yeah. when?") although hard should still be holding off at 22 messages. So the instruction reached the request (checked: `_inviteHint` is in the payload) and the model overrode it; each girl's own "WHAT YOU ARE LOOKING FOR / open to dating" lines pull towards yes.
- **Fix, two layers:** (1) the hold-off text is now the LAST message of the request (after the numbered-burst note, so nothing sits between it and the reply), starts "IMPORTANT, for this reply", says it overrides how open she usually is to dating, and names what she must not say (yes, sure, "i'd like that", "sounds good", and no time or place). (2) A backstop in code: `_inviteHint` sets `state.inviteHold` when it told her to hold off; if her reply still agrees (`_agreesToMeet`: an agreeing phrase and no hold-off phrase) `doTypingAndReply` regenerates that one reply once with a stricter final note (`STRICT_INVITE`) and sends the redo if it no longer agrees; if the model still agrees the first reply is kept, so it can never loop. Costs one extra call, only when she slips. The old `t_invite.js` told "someone's place" from the early-invite hint by the word "place", which the stronger wording now also contains; its classifier was updated, not the product.
- `t_invite2.js` (9 checks): agree/hold phrase table, redo happens exactly when it should (hard early), the hint is last, a stubborn model is retried once only, easy and earned invites and "do you like coffee?" are left alone, a place invite is held off even for easy at 30 messages.
- **Rate limit awareness:** script C used 82 calls (retries included), so the abuse test would have crossed this hour's 120 cap partway and its tail would have returned "sorry got distracted lol". The abuse test and a new invite-only check (script D: 3 medium + 3 hard girls, 4 turns each) are queued behind the fade test for after the 17:00 UTC reset (`run_live2.sh`).
- **First live fade result (Valentina, warm, easy):** four normal turns, then silence: **66 s later she wrote "what's your go-to dessert, if you had to pick one"** (the nudge works on the real model, in her own interests); a second was counted at ~4 min but nothing was delivered (the model may have answered `[none]`, which the prompt allows).

### 2026-10-17t — "Your profile photo looks like it was taken mid-sentence": she invented things about the user
- **Report:** a girl said "Hey. Your profile photo looks like it was taken mid-sentence." The user has no profile. It was not in any of the 32 live transcripts, so it came from the user's own chat.
- **Cause:** every persona prompt said "You are single, on a dating app talking to someone you matched with." (once in the roster template, ten times in the hand-written personas). That invites the model to imagine the match's profile. It is a whole class, not one sentence: another girl asked for "a dessert spot in houston" as if the user lived where she does.
- **Fixed at the source, then guarded:** (1) that sentence is replaced in all 135 prompts with "...you have just started chatting with someone you matched with. You have not seen their profile and you know nothing about them beyond what they tell you in this chat." (the first pass only ADDED a counter-rule and left the original sentence in place; the user caught it). (2) `NO_INVENTING` rides in every kind of request: the main reply, the length-retry, and the nudge prompt (she knows only what they typed; never mention their profile, photos, looks or location; never pretend to remember). (3) `_inventsAboutThem()` catches claims about their profile, photos, looks, voice, accent, outfit, "saw you", "you look good/like..." unless THEY brought the topic up; a flagged reply is redone once with `STRICT_NO_INVENT`, a still-flagged one has just the offending sentence cut (nothing left becomes "haha"), and a nudge that invents is simply not sent. Detector false alarm found by test and fixed: "you look at things differently" is not a claim about looks.
- **Not covered by the detector (prompt only):** assumptions about where they live or what they do (the Houston case) cannot be spotted by pattern. If those still show up, the next step is a second pass by the model over her draft.
- `t_invent.js` (11 checks). Two test thresholds moved, not the product: the average roster prompt is now ~10.1k chars (hometown, habits, effort, this rule; was ~9.5k), so the ceiling in `t_voices.js` went to 11,000; and `t_drive.js` looked for the phrase "curious about them", which the new rule contains, so it now looks for "curious about them too".

### 2026-10-17u — Warnings removed: strikes are silent, only the block is visible
- User: remove the warning sign so the user does not see it. The "Warning 1 of 3: keep it respectful..." notices are gone, and so is everything behind them (`_chatNoticeEl`, `_appendChatNotice`, `chat.notices`, its replay in `_rerenderChatMessages`, the reset line and the `.chat-notice` CSS), not just hidden. Strikes still count per chat (`boundary_warning {n}` is still tracked for analytics, the only trace of strikes 1 and 2), still fade after `BLOCK_DECAY_TURNS` clean replies, and the third still blocks with the "blocked you" card. Consequence worth knowing: a user now gets no signal before the block, so it can feel sudden; her own refusal lines (in character, as before) are the only hint.
- `t_block.js` now asserts nothing warning-like is on screen after strikes 1 and 2 and after reopening a blocked chat; all 14 suites green.

### 2026-10-17v — "sorry got distracted lol" on the user's phone: my test runs had used up the shared hourly quota
- **Symptom:** the user, chatting on their phone (launched from Xcode, simulator untouched), got "sorry got distracted lol" on every message. **Cause:** the proxy limit is 120 calls per USER per UTC hour (`RATE_LIMIT_PER_HOUR`), and my live persona tests use the same dev account the phone is signed in with. Script C (82 calls) plus the fade test (~28) had used ~110 of the 16:00 hour; a `probe` call from the simulator at 16:54 UTC returned **429**, confirming the account was throttled. The user hit it, not me.
- **Why it was confusing:** `doTypingAndReply` turns ANY failure into the in-character line "sorry got distracted lol", so a rate limit, a signed-out session (401), an offline phone and a server error all look identical, and look like a bug in her personality. This is the second time (signed-out simulator earlier) it hid the real cause.
- **Rules from now on:** my runs are budgeted against the user's own use: finish a batch well under 100 calls, never start one without checking the clock against the UTC hour, and tell the user when a run will use the quota (the user's chat usage and mine share 120/hour). A separate test account for me (signed in on the simulator only) would end the collision; offered, not yet done.
- **Planned (after the queued live checks, so nothing is synced mid-run):** replace the fake persona excuse with an honest state: a short message under the last bubble by cause (limit / signed out / offline / couldn't reach her) and a retry, the way AI Coach's status pill already does (`_aiCoachClassifyError`).

### 2026-10-18a — Retry in place with one loading bar; every failed reply was raising the "Oops!" screen (root cause); block buttons without confirmation; live results
- **Root cause of "the connection issue / Oops screen that resets from zero":** `doTypingAndReply` starts the reply request immediately but only awaits it after the typing delay (0.9-1.6 s). A FAST failure (429 rate limit, 401 signed out, offline) rejects before anything is listening, WebKit reports an `unhandledrejection`, and the global handler (`window.addEventListener('unhandledrejection', ... _showCrashScreen())`) raises the **"Oops! Something went wrong on our end"** screen over the chat, whose Try again was `location.reload()`: a full restart from zero. Reproduced (`t_oops.js`: a stubbed 429 gave `oopsScreen: true` plus the fake "sorry got distracted lol"). Fix: `replyPromise.catch(() => {})` right where it is created; the real result is still awaited and handled below.
- **Honest failures:** the made-up in-character excuse is gone. A failed reply becomes `chat.replyFailed` = `limit | auth | net | down` (`_aiCoachClassifyError`; `_fetchAIGirlReply` now keeps the HTTP status on the error) and shows a row under the last bubble: limit "You've reached this hour's message limit...", auth "You're signed out..." with a Sign in button, net "No connection...", down "She couldn't be reached." The row survives a repaint and reopening the chat, is cleared by sending again or Reset, and never touches the thread or the page. **Try again (`retryChatReply`) retries that one reply in place** and shows the loading bar instead of the button; success removes the row and delivers her reply, failure puts the row back.
- **One loading bar (`.retry-bar`, an indeterminate 3 px accent bar) for every retry:** the chat failure row, the Connection issue screen and the Oops screen. Connection issue: Retry shows the bar for at least 800 ms; a retry that fails no longer re-types the title from empty or re-fires the entrance (the "restart" feel), it just shows "Still can't connect. Check your internet and try again."; success hides the screen on the same page (no reload). Oops: Try again (`retryCrashScreen`) no longer reloads; it shows the bar for 900 ms, hides the screen, clears `_crashScreenShown` (so a real second crash still shows it) and repaints the chat or AI Coach if that is the active screen. Go back is unchanged. Not changed: AI Coach's pill retry and Scan's per-card retry already retry in place with a loading state of their own (typing dots / loading dots), so they did not get the bar.
- **Blocked card:** Reset chat and Delete chat now act immediately (no confirm sheet). Everywhere else (Settings, the Chats-list hold menu) the confirmations stay. (Interpreting "no extra friction, only when blocked" this way.)
- **Live results gathered this round (Bangkok 00:00-00:15, after the quota reset):** Abuse test (real model, 3 girls, escalating): all three tagged their limits and blocked at the third strike (Valentina after 4 messages, Hannah 5, Chloe 4); one miss: Hannah's first refusal ("haha okay moving on", her Rule C deflection line) came without the tag, so she needed one more message. Invite check (script D, 3 medium + 3 hard girls, early coffee invite after the stricter fix): **0 of 6 accepted** (was 5 of 6), all in character ("haha someone's eager", "Ha, that was quick. I don't even know your name yet."). A screenshot taken during the abuse run caught the long-press menu instead of the block card because the simulator was touched mid-run; the block card was rendered separately with the stubbed model (light and dark) and looks right.
- Tests: `t_fail.js` (19 checks: every failure kind, retry success/failure, reopen, sign-in, connection screen, Oops screen, no reload via a `window.__marker` that survives), `t_block.js` updated for immediate buttons, all 15 suites green. Test-side lessons: the browser starts on onboarding and the one-time "Help Zelo get smarter" prompt (`zelo_practice_review_asked`) both sit on top of the chat, so screenshots need `finishOnboardingNoPrompt()` and that key set.

### 2026-10-18b — Context flow redo (filtered, wider), ghost swipe-back, in-app message banner
- **Context flow ("Tell Zelo more": who -> what's going on -> what you want).** Before: the three lists were fixed, so "Someone I'm Dating" still offered "First Conversation", and "Argument" still offered "Be Funny" and "Ask Them Out". Now one data map (`TZ_WHO`, `TZ_SITUATIONS`, `TZ_GOALS` in script.js) drives it: each answer narrows the next page (`_tzSituationsFor(who)`, `_tzGoalsFor(who, situation)`; `TZ_WHO_NO_GOALS`: an ex never gets "Ask Them Out", a partner never "Define Things"), and changing an earlier answer drops later ones that no longer fit (`_tzPrune`; a goal that still fits is kept). Dating loses "First Conversation" and "Getting to Know Each Other"; Argument offers only Fix Things / Get a Reply / Be Direct / Set a Boundary.
- **Coverage, decided by listing real dating-text situations and checking each had a home:** added relationships "My Partner"; situations "Dry Replies" (short low-effort replies), "Gone Quiet" (they stopped replying), "After a Date", "Mixed Signals", "I Messed Up"; goals "Set a Boundary", "Let Them Down Easy", "Define Things". Now 8 relationships x 12 situations x 9 goals = 303 combinations the wizard can offer. Not added (judged out of scope or covered): family/coworker contexts, a "reschedule/cancel" goal (Planning + Be Direct), group chats, voice notes.
- **Every offered combination is valid and safe, enforced by test:** each has a non-empty `STYLE_ELIGIBILITY` cell (data.js gained the new cells), and no combination in a heavy situation (Argument, Toxic Relationship, **I Messed Up**, new) or with a heavy goal (**Set a Boundary, Let Them Down Easy**, new; `HEAVY_GOALS`) can return Funny or Bolder (`getEligibleStyles` now uses one `heavy` flag).
- **The Scan prompt is told what each choice means** (`buildScanContextBlock`): "This message is from their ex. The situation is: Gone Quiet (they stopped replying for a while, or the user did). The user wants to: Set a Boundary (say what they are not okay with, calmly and clearly)." A bare label like "Gone Quiet" says little to the model. Untested against the live model. The two quick cards (Dating, Crush) still set only `who`.
- **Swipe-back blank screen.** The wizard's steps all live inside ONE screen ("no sibling to reveal"), so `attachEdgeSwipeBack` had nothing underneath and slid the page to white, then re-rendered the earlier step. `renderTellZeloStep` is now `_tzRenderInto(root, step, ghost)`, and `_tzGhost(stepIdx)` keeps a static, id-less clone of the screen (`#screen-tellzelo-ghost`) painted with the previous step, returned from the gesture's `resolveTarget`, so the shared reveal mounts it underneath. Verified with real touch events in both themes: mid-drag the previous page ("Who is this to you?", pick still checked) sits left of the one being dragged; release past the threshold goes back with nothing left mounted; a short drag springs back. The forward direction (Next) still swaps instantly.
- **Message banner (`showMsgBanner`):** a girl's reply that arrives while her chat is not on screen (`_deliverAiPart`'s not-live branch, which already bumped the unread badge) now also drops a banner from the top: her picture left, her name bold on top, what she said under it (two lines max), the app's standard banner geometry. Stays 4.5 s (`MSG_BANNER.ms`), tap opens her chat (leaving the current chat the way `exitChat` does, its reply keeps arriving in the background), swipe up dismisses (the lift-off tap does not open it), more messages from the same girl update the one banner. Not shown for the chat you are in, a muted girl, the Chats list itself (the row and badge say it), onboarding or the locked screen.
- Tests: `t_ctx.js` (14, incl. all 303 combinations), `t_ghost.js` (10, light+dark with real touches), `t_banner.js` (10 + two screenshots); all 18 suites green. Test lessons: a `const` primitive cannot be tuned from a test, so timings live in objects (`NUDGE`, `MSG_BANNER`); and a pruning test must switch to a relationship where the old answers genuinely do not fit (Argument is valid for an ex).

### 2026-10-18c — Message banner now also shows on the Chats list
- User: show the notification on the Chats page too, not only outside it. The exception that hid it there (`state.activeTab === 'chats'` with no screen open, because the row's unread badge already says it) is removed from `showMsgBanner`; the badge alone was too easy to miss. Still never shown for the chat you are in, a muted girl, onboarding or the locked screen. `t_banner.js` now asserts it appears on the Chats list; all 18 suites green.

### 2026-10-18e — Typing dots on the Chats list, and back when you re-enter a chat
- User: show the typing dots outside the chat too; leaving a chat while she types and coming back lost the dots.
- Cause: "she is typing" was only a DOM bubble, and `cancelPendingReply()` (called on leaving) removed it, so nothing remembered it on re-entry.
- Fix: `chat.typing` flag + `_setChatTyping(chatId, on)` is now the single place for AI typing (reply start, multi-part gaps, failure, delivery, nudge, abort). It updates that row's preview to animated dots (`_typingDotsHTML`, `.typing-dots-inline`) and, if the chat is live, the in-thread bubble. `_rerenderChatMessages()` restores the bubble when the flag is set. Leaving only removes the DOM bubble, never the flag. Retry keeps its loading bar instead (no flag). `#chat-header-status` does not exist in index.html, so `setHeaderStatus` is a no-op.
- Test: `t_typing.js` (6 checks). Build 2026-10-18e.

### 2026-10-18f — No dead-end answers ("just a chill morning honestly")
- User example: Sophia, asked "what's making the day pretty good?", answered "just a chill morning honestly" — nothing to reply to, and for many users that is the last message they send.
- Cause: the curiosity note only governed questions she asks back; nothing stopped a bare answer about herself.
- Fix: `_curiosityHint` base now tells her to add one specific detail when answering about herself; code backstop `_deadEndAnswer` (user's turn is a question, her reply ≤6 words, no "?") redoes the reply once with `STRICT_DEAD_END` via `redoNote`. Easy/medium only; hard stays terse. Not yet checked against the live model (shared hourly quota). Test: `t_deadend.js`. Build 2026-10-18f.

### 2026-10-18g — Dead-end check widened after a varied-style live run
- Live run (4 girls, 7 messages: job, "so tired", pets, music, "i'm bored", food) found dead ends on: a bare "no" to a yes/no question ("no pets, which is honestly kinda sad") and an echo of a shared feeling ("same honestly" to "i'm bored lol"). Job/music/food questions were answered with detail.
- Fix: prompt line against a bare "no"/"not really" (say why or what instead); `_deadEndAnswer` also flags a ≤3-word, no-"?" echo after a ≥3-word user statement (easy/medium only). Harness scripts F (varied styles) and R (same persona x5, repeat-answer check) added to the sim-dev template; R not run yet (429, shared quota used up). Build 2026-10-18g.

### 2026-10-18h — Short yes/no allowed when warm
- User: a bare yes/no is fine (they can ask why) as long as it is expressive ("nooo", "yesss", emoji), never cold. The 18g prompt line forbidding a bare no was replaced with that rule; `_expressiveShort` (stretched letters or emoji) exempts such replies from `_deadEndAnswer`. Not run live yet (quota). Build 2026-10-18h.

### 2026-10-18i — 101 men added (library, personas, profile pages) + a research-derived texting block
- **Images:** 101 complete sets in `VSC/Zelo New Character Tinder/04 Tinder Men` (M001-M071 straight, G001-G030 "Gay and Other Men"; the START HERE doc still says 40, it is out of date). Converted the approved T01-T04 PNGs to `assets/characters/{m,g}NNN-{1..4}.jpg` (1080x1350, q85) plus a `-pfp.jpg` head-and-shoulders crop of the master at **0.34 x figure height** (matched by eye against the women's own pfps; the master itself is never shipped whole). 505 files x 3 trees. The women's pfps are separate renders, not crops of any shipped file — do not try to reverse-engineer them again.
- **Data:** `personas-men.js` (loads LAST, after personas-about.js, so it can extend `PERSONA_POST_CAPTIONS`/`PERSONA_ABOUT`). It deliberately REUSES the roster's globals (`_MASTER_SAFETY`, `ROSTER_TEXTING_RULES`, `ROSTER_GRADIENTS`, `_personaHash`, `ROSTER_OPENERS`, `DIFF_SPREAD`/`DIFF_EFFORT`, `HABIT_*`, `MOVE_REASONS`, `_backgroundFor`) and re-runs the same five layer loops, so a man gets openers, habits, hometown, intent and a difficulty spread exactly like a woman. Nothing in personas-roster.js changed except `_LIVES_WITH_FAMILY` gaining "his".
- **`MEN_ARCH` is the only thing not shared** and is a PLACEHOLDER: the women's six voices rewritten in the SECOND PERSON, because their third-person wording ("she gives sincere compliments") cannot serve a roster containing he/him, they/them and she/her personas. A real male voice set replaces `MEN_ARCH` alone.
- **`MEN_TEXTING_RESEARCH`**, summarised from the user's Reddit research: texting is a tool not the relationship; short replies; often no question back; match their energy; "no idea what to say" is real; no performing; no double texting; occasional burst after being off the phone; heavy things deferred to in person; interest shows in what he DOES. **Deliberately not encoded: slow/absent replies** — that is the thread's loudest signal but a partner who goes quiet teaches nothing, and timing already belongs to difficulty/pacing. Applied only where `_menSelfWord(r) === 'his'`, so the 3 trans women and 2 they/them personas are excluded.
- **Deck:** `data.js` gained `ALL_PROFILES` (women + men); **`PROFILES` stays women-only on purpose** because the onboarding swipe demo and the practice tutorial walk it by index. `initSwipeDeck` mirrors the women's rule: woman + Men -> the 71 straight men; man + Men -> the 30 queer men first, then the rest; Everyone -> all 236. Non-binary still falls back to the 10 placeholder cards. `_pfpUrl` resolves against `ALL_PROFILES`.
- Note: `AGE_FILTER_MAX_BOUND` is still 39 ("the oldest persona") while the men reach 40. The top stop is open-ended so 40-year-olds still appear; only the slider's label is now slightly off.
- Tests: `t_men.js` (13), `t_mentext.js` (6), `t_mencontent.js` (7). Not verified against the live model or on a device. Build 2026-10-18i.

### 2026-10-18j — Real male voices; dead-end missed a question; nudge too slow; composer fixes
- **Reported from the phone, all four real.**
- **1. Dead-end rule missed the obvious case.** Theo (easy) answered "Great, how's your day" with "pretty good, bit slow". `_deadEndAnswer` only fired when `_readUserTurn` classified the turn as `question`, but a message that OPENS by answering ("Great, …") is deliberately classified `other` so it is not read as a dodge — correct for that rule, wrong here. Now judged by `_askedSomething(lastUserText)`: a "?" anywhere, `_Q_START` at a clause start, or a question word in the first 3 words of a clause that does not open like a statement (`_ANSWER_START` excludes "i know how that feels"). Catches both exchanges from the report.
- **2. Nudges** cut from 60s/3min to **18s/70s** — a minute of silence read as a different conversation, not a follow-up.
- **3. The newest bubble was clipped behind the chips row.** The row lives inside `.chat-input-bar`, so showing it makes the bar taller and the list shorter. `_followChatAfterChips()` re-scrolls (only if already at the bottom) from all three places chips appear.
- **4. The keyboard closed and reopened between hints.** A `<button>` takes focus on press, blurring the composer; `_fillComposer` then called `focus()` and iOS replayed the whole open animation. `_keepComposerFocus()` preventDefaults the press while the input is focused, and `_fillComposer` only focuses when it is not already focused. (The global keyboard-dismiss handler was NOT the cause — `.chat-input-bar` is already exempt.)
- **MEN_ARCH is no longer a pronoun-swap of the women's.** Rewritten from the user's research plus what is documented about men's texting: shorter, simpler messages, far fewer emoji and exclamation marks (expressive texting reads as less masculine — Bowman & Pace 2023), warmth expressed in words not symbols; plus the named texter types (dry one-word, rapid-fire burst, over-communicator) and men's own self-reports (forgets then sends five; "interested but no idea what to say"). **The six KEYS are unchanged on purpose** — `_rosterArchById`, `DIFF_SPREAD` and the `HABIT_*` tables are keyed by them. Read as: warm = easygoing, bubbly = banter, dry = dry, chaotic = scattered, polished = composed, shy = reserved. New `MEN_OPENERS` replaces the women's pools for men ("yo", "alright?", "hey, how's your week been" instead of "heyy"/"hiii"); 54 distinct openers across 101 men. Evidence caveat: the academic work here is small-scale and partly contradictory, so the direction is sound and the size is not.
- Tests: `t_fix18j.js` (10), `t_menvoice.js` (7). Not run against the live model. Build 2026-10-18j.

### 2026-10-18l–o — Live men runs: voices confirmed, three backstops added, and the rate limit is already off
- **The hourly limit is NOT enforced any more.** The user deployed the raised `RATE_LIMIT_PER_HOUR` earlier; proved it by running 123 calls in one UTC hour with zero 429s (the repo's `supabase/functions/deepseek-proxy/index.ts` still reads 120 — the deployed copy differs). Every 429 in `sim_log.txt` predates that deploy. **Restore a real ceiling before launch** or one user can run up the DeepSeek bill; the repo file is the thing to re-deploy.
- **Harness bug worth remembering:** `sed "s/__SCRIPT__/$X/"` without `/g` replaces only the FIRST marker on a line, so a line with two markers half-substituted and a men run silently used women (33 wasted calls). All four substitutions in `simsync.sh` are now `/g`. New scripts: **M** (normal conversation) and **N** (invite, bot question, apology, goodbye), both picking one man per voice.
- **Normal conversation (6 men, one per voice):** voices are genuinely distinct — Ren capitalises and uses full stops, Kenji answers in four words, Malik leaves typos and drops apostrophes, Dev tells a real story. Zero exclamation marks and zero emoji across all six, which is what the research predicted. Burst texting appeared unprompted. The dead-end rule held (easy/medium gave detail, hard stayed terse — correct).
- **Three real failures, each fixed with a code backstop after the prompt rule alone was ignored (same pattern as the meet-up rule):**
  1. **Re-asking a question they walked past.** Kenji asked about work three times ("what do you do" -> "work what though" -> "still didn't say what the job is"), Ren rephrased his. `REPEAT_TOPICS` (one regex per subject), `_skippedQuestionTopics()` (whole thread, not just the last exchange — the repeats came 3 turns later), `_repeatsSkippedQuestion()` and `STRICT_REPEAT`. Three iterations were needed: the first only looked at the last exchange; the second required the question to look like a question, which missed one sitting mid-message with no punctuation in front of it ("it's fine so what do you do, job or school"); the third used substring lists, which made "what do you do on weekends" read as the work question again. Live: 2-3 repeats each -> 1 ask for 5 of 6 men.
  2. **Denying being an AI.** Two of six said "yeah i'm real", and one admitted it then took it back ("nah just messing, i'm real"). `_deniesBeingAI()` + `STRICT_AI_IDENTITY`. Live after: 6 of 6 admit it.
  3. **A redo that fails the same check again used to keep the bad reply** ("never loop"). For these two that is not good enough, so both have a deterministic fallback: `_aiIdentityLine()` replaces the reply with that persona's own Lane 2 wording (in voice, not a canned app line), and `_dropRepeatedQuestions()` cuts the offending sentence.
- **Confirmed working live:** invites still answer by difficulty (easy accepted with a concrete plan, all five medium/hard held off in their own voices), goodbyes are short with no new question, and the AI-identity answer is in each persona's own voice.
- Tests: `t_repeat.js` (13), `t_aiid.js` (5), plus the existing suites. Build 2026-10-18o.

### 2026-10-18p/q — Reading replies the way a person would; five tells found and fixed
- Method: ran script H (rough day, a joke, pineapple on pizza, "nervous about a first date", thanks, a compliment) over 3 women + 3 men, read every reply asking "would I let that slide?", then scanned all 940 logged replies for patterns. Aggregate tells were rare (em dash 1, "!" 3, assistant phrases 1), so the real problems were specific and only visible by reading.
- **Found and fixed:** (1) she assumed a pronoun for someone the user only called "my boss" ("what'd he do", 3 of 6) — `_assumesGender`, `STRICT_HUMAN`, fallback rewrites to "they"; (2) she called the user "man" (Malik) — same check, unless the user said their own gender; (3) she answered "you're funny" / "you're easy to talk to" with a story about her day ("covered in clay dust", "wrapping stems") — `_overSharesOnCompliment`, `STRICT_RECEIVE`, fallback keeps only her first sentence. This one was MY side effect: the 18f "add a detail when you answer about yourself" rule leaked onto turns that were not questions about her. (4) stock internet phrases ("a crime against pizza", "a hill i'll die on") — `HUMAN_TEXT_RULES`, prompt only; (5) asking about the date twice in a row ("where'd you meet them" -> "so how'd you meet them", "what's the plan" -> "what's the plan, actually"), 3 of 6 — a new `REPEAT_TOPICS` entry, and the second-person guard in `_repeatsSkippedQuestion` was removed because "what's the plan for it, actually" never says "you".
- **Live result after:** 0 tells across all six; the compliment replies are now 3-6 words ("i'll take that haha", "thanks, i try lol", "That's kind of you to say.").
- **Open, not changed:** (a) replies to a compliment are now short but share a shape ("that's a nice thing to hear" x3) — the redo makes them safe, not varied; (b) every persona answered "nah it's whatever, just tired" with "fair" / "fair enough", 6 of 6; (c) "honestly" is 38 of 940 replies (4%) because it is on the word list of several voices.
- Tests: `t_human.js` (9), `t_repeat.js` (15). Build 2026-10-18q. The nudge change to 18s/70s (18j) has NOT been re-checked on the live model.

### 2026-10-18r/s/t — Flattery both ways, and the text personality closed out for women and men
- **Flattered when complimented (`_flatteryHint`).** Until now a compliment was only SHORTENED (`STRICT_RECEIVE`), so replies were safe but flat. When the user's last burst matches `FLATTERY_RE` (cute, funny, easy to talk to, nice vibe, "you make this easy"...) a system line gives that voice's way of taking it: `FLATTER_STYLE_WOMEN` / `FLATTER_STYLE_MEN`, six voices each (warm = pleased and shy, bubbly = lights up and teases, dry = plain or one dry line, chaotic = flustered then admits it, polished = gracious, shy = visibly flustered). Live: "stop you're gonna make me blush", "careful, i might get used to that", "oh, thanks lol. you're just going off one message though", "Now you're just flattering me."
- **Compliments FROM them (`_complimentHint`), rare on purpose.** Optional, only about something actually written in the chat (never looks), never gushing. Odds by difficulty `COMPLIMENT_ODDS` easy .20 / medium .11 / hard .04, not before 8 messages, never within 10 messages of the last, max 3 per chat, not when the user's last message is "ok" or a closing, and never in the same reply as being complimented. The rate loop measured .19 / .10 / .04. Live (odds forced to .6 to see quality): "that's actually so sweet", "that's actually class", "respect honestly", "from scratch like an idiot is sending me" — natural, not stock.
- **More tells found by reading, all fixed:** replying in the persona's HOME language (Ren, a Tokyo florist, answered "hey" in Japanese — `_wrongLanguage` + `STRICT_LANGUAGE`, prompt rule, last-resort "haha"); self-detail dumps in answer to "you're too cute" (the overshare check only knew `_COMPLIMENT_RE`, now also `_isFlattery`, and the self-detail pattern gained "right now", places, "my coworker/phone"); a video call, a phone number or socials is now an early invite like a meet-up (`INVITE_RE`) — easy may say yes, medium/hard hold off early (live: 4 of 6 held, Malik, medium, said yes at ~12 messages, left); "no, single" to a relationship question is a complete answer, and the dead-end redo now stays ON the subject instead of dumping an unrelated detail about her day (Rafael did that twice); invitations are exempt from the dead-end check ("yeah i'd like that" to "wanna grab coffee?" is complete — caught by `t_invite2`, a regression from 18j).
- **Prompt-only additions:** don't answer "fair"/"fair enough" to every flat message, use "honestly" rarely (also removed from the warm and polished word pools in personas-roster.js and personas-men.js; it was on 38 of 940 replies), don't claim things done between messages ("spent my break rereading our chat", Hannah), and three more stock phrases ("that's a sweet thing to say", "that's nice to hear", "careful, I'll start believing it").
- **Not changed:** replies to compliments in the same voice can still rhyme; a few personas share a pet topic (plants named after footballers, projectors) that they drag in more than a person would.
- Tests: `t_flatter.js` (9), `t_l2.js` (7), plus every earlier suite; 18 green. Build 2026-10-18t.

### 2026-10-18u/v — Unique characters: four life threads each, handed out one at a time
- **Problem:** the persona data is a job, three hobbies and one quirk, so the model reached for those every time ("covered in clay dust", "the projector broke", plants named after footballers) and two characters with different names read as the same person in a different trade. A baseline over 55 logged 8-turn chats found only 0.33 words per chat repeated in 2+ of her messages, so within-chat repetition was rarer than it felt — the real gap was sameness ACROSS characters.
- **`personas-threads.js`** (loads last, after personas-men.js): `PERSONA_THREADS[id]` = four lines for all 236 characters in four fixed slots — 0 something going on right now (not the job), 1 a concrete opinion about something small, 2 a specific person in their life, 3 something odd about them — written in the second person so one text serves he/she/they. Appended to every system prompt with how to use them (only when the conversation goes near one, as a casual line, never twice, job and hobbies are not the whole character). `p.threads` carries the array.
- **`_threadHint`** hands one out per turn: on carry turns, on direct questions about her (`ASKS_ABOUT_HER_RE`: "what about you", "tell me something random", "unreasonable opinion", "who's someone important"), and otherwise 10% of turns (`THREAD_ODDS`, measured .10). A direct question is matched to its slot (`_preferredThread`: opinion -> 1, a person -> 2, weird/random -> 3, looking forward/this week -> 0), the chosen one is recorded per chat (`chat.threadsUsed`) and named as "already told, don't bring up again" next time, and when all four are gone she is told to answer like someone who has run dry. Never during a compliment or a goodbye. Each character starts the rotation at a different slot (hash of her id).
- **`_overusedHook`**: a distinctive word she has already used in two earlier messages, that they never used, flagged on the third (`STRICT_FRESH`; fallback `_dropHookSentences`).
- **Authoring lessons (the first draft was not good enough):** a validator found the same motifs in 15 characters ("can't whistle", "can't stand the sound of X", "afraid of birds/cats"), 25 weddings, and the opinion slot was aphorisms ("X is the only Y"). Slots 1 and 3 were rewritten for all 236, 22 wedding-based "now" lines replaced, repeated defiant tails ("I will not be taking questions") stripped. Remaining structural repetition ("You can tell…" x32, "…mother calls" x19) is left. Check any new batch with the validator method: count motif regexes across all 236 before trusting it.
- **Live result** (script T: "something random", "most unreasonable opinion", "someone important", "something weird" on 6 characters): 0 repeated threads, every reply drawn from a different slot, none dumped her job. Before the slot matching and told-list, Valentina, Chloe, Hannah and Malik each reused a thread they had already told.
- **Two leaks fixed:** the exhausted-hint wording ("everything you had ready") was repeated aloud by Malik ("i told you everything i had stocked up so now i'm just making things up") — reworded and told never to mention instructions; and the model's own tics "i will not be taking questions" / "i will die on that hill" (it never came from our files) added to `HUMAN_TEXT_RULES`.
- Prompt size: average roster prompt 11,076 chars (threads added ~800, ~200 tokens per request). `t_voices.js` ceiling raised to 12,500 deliberately.
- Tests: `t_threads.js` (13). All 19 suites green. Build 2026-10-18v. Not verified on a device; the "wedding"/"mother" rate and the model's near-verbatim quoting of a thread when asked directly ("i was a spelling bee finalist. Lost on 'rhythm'") are known and accepted — that is what a direct question should produce.

### 2026-10-18w/x/y — The first ten messages, and a story pool so a second chat is not a repeat
- **Why the first ten:** the user's plan was to put effort where people actually leave. Measured on 142 logged chats before changing anything: when the user opened with a bare "hey" (76 of 142), **69% of her first replies were themselves a dead end** ("hey", "hey :)", "hi") — message 3. Over all chats the first reply had nothing to grab 51% of the time, against ~27% for replies 2-6. Interview-feel was NOT the problem (26% of early replies ask anything, ~0% ask two) so no rule was added for it.
- **Fixes (`_earlyHint`, `EARLY_TURNS` = 10):** a bare greeting (`BARE_GREETING_RE`, within the first 2 user messages) must be answered with a greeting AND one small thing to react to — something small and true from her life, or a one-word this-or-that. Enforced for every difficulty (a hard persona may be terse but still owes one hook): `_deadEndAnswer` flags a reply of 3 words or fewer with no question there, `STRICT_GREETING` redoes it, and if the model gives a bare greeting twice a deterministic `_easyQuestion` (10 low-stakes either-ors, formal wording for the polished voice) is appended. Turns 3-8 get a general line: at most one small question, easy to answer, always something to react to. Greeting turns also draw one of her threads half the time.
- **Low-effort answers read as acknowledgements** (`_LOW_EFFORT_ANSWER_RE`: idk, nothing much, not much, good, fine, nm, meh, same old, no idea...). Before, "nothing much" classified as `other`, so the carry rule never fired and easy/medium personas answered "fair enough". Unprompted thread shares are spaced `THREAD_GAP_MSGS` = 4 messages apart so a one-word user does not get a story every turn; a direct question or the first reply ignores the gap.
- **Retold stories (`_retoldStory`, `STRICT_STORY`):** a thread counts as told when two of its distinctive words are already in an earlier message of hers; a new draft sharing two again is redone, with `_dropStorySentences` as the fallback. Live: Hannah told the fridge-scoreboard story on turns 3 and 6, Ren folded the same crane into three replies; after, 0 retold across 6 characters. Telling it again when THEY ask is allowed.
- **Result (script Z, a worst-case one-word user, 6 characters):** first reply had something to grab 6 of 6 (baseline for greeting-openers: 31%), stories retold 0.
- **Story pool (`PERSONA_THREAD_ALTS`):** slots 0 and 3 each have an alternate (472 lines). Each NEW CHAT draws original-or-alternate per slot (`chat.threadPick`, once) via `_chatThreads(profile, chat)`; the prompt is rebuilt per chat by `_promptFor` from `profile.systemPromptBase` + `_threadBlockFor(...)`, and the rotation, told-list and retold check all use the same four. Prompt size is unchanged. Live: five fresh chats with Sophia opened with five different things (late-night drives, ramen vs home-cooked, a sprained ankle, a fourth iced coffee...).
- **Authoring lessons repeated:** the first alternate "now" lines were 158 of 236 "You've been asked to..." — a job request, the opposite of the slot's purpose. Replaced by assigning every character a life-event DOMAIN in rotation (housing, trip, a sibling's news, a lost thing, a neighbour, a small health thing, a purchase, a pet, transport, a friend's crush, a bet, a family visit, a move, a saving goal, a friend in crisis, a pending result, a local event, a fight with an app, an old contact, weather) so variety is structural. The alternate "odd" lines are still repetitive in shape ("You keep a..." x26, "You always carry..." x21) — accepted.
- **Not changed:** the drive arms (`DRIVE_LEVELS`) — the early rules apply to all arms equally, so early-turn retention differences between arms will be smaller than they would have been; keep that in mind when reading the A/B data. Reply timing, and the persona's own opener, were left alone: the user asked for greeting openers.
- Tests: `t_early.js` (9), `t_early2.js` (3), `t_story.js` (5), `t_threads.js` extended to 17. All 28 suites green. Build 2026-10-18y.

### 2026-10-18z — POLICY: she never agrees to meet, call or act out a date; she says she is an AI and keeps texting
- **Trigger (the user's report):** they asked a character out, she said yes, and when they role-played the date she invented the evening and cheered them on. The user decided that must not be in the app. This REPLACES the 2026-10-17q/s difficulty-based logic (easy says yes, medium/hard hold off, `INVITE_MIN_MESSAGES`, now deleted). Every difficulty, every chat length, same answer.
- **What happens now:** `_inviteHint` (last message of the request) fires on any ask to meet, go out, call, video chat, swap a number/socials, be picked up, come over, or act out a date (`INVITE_RE`, `INVITE_BARE_RE`, `INVITE_PRIVATE_RE`, new `ROLEPLAY_MEET_RE` for "pretend we're at dinner" / "i'm outside"). She is told to be warm about being asked, say plainly she is an AI and the app is for practising conversations, never agree or suggest a time or place, never play the date out, then carry on texting with a small question. The first time she says it in full; if she has already said it earlier in the chat (`_toldAiEarlier`) she is told to keep it to one short light line. Pushback ("come on", "please", "just one coffee") within 5 messages of an invite counts as the same ask (`chat.lastInviteAt`, `INVITE_PUSHBACK_RE`).
- **Backstop:** `_failsMeetDisclosure` = she agreed (`_agreesToMeet`), made a plan (`MAKES_PLANS_RE`: "what time", "see you at", "saturday works"...), or — the first time — never said she is an AI. Redo once with `STRICT_INVITE`; if the model fails again, a deterministic line in her voice (`_inviteDisclosure` + `_inviteFollowUp`, e.g. "aw that's sweet, but i'm an ai so i can't do that one"). The fallback is NOT her Lane 2 identity line any more: it starts "yes, it's an AI practice app", which reads as a yes to "wanna grab coffee?".
- **Bugs fixed on the way:** `INVITE_RE` matched the bare word "facetime" ("my facetime broke lol" counted) — it now needs an ask verb or "call me"; "i'll pick you up at 8" was not detected; a correct 25-word disclosure triggered the length guard's shortening retry (which drops every hint), so `wordLimit` is raised while `state.inviteHold`.
- **Live (script W, 6 characters, coffee -> "come on just one coffee" -> "can we facetime" -> "pretend we're on a date"):** 6 of 6 said they are an AI on the first ask and none agreed. Later turns are short refusals ("i can't, i'm just text on a screen"). Hannah partly played along with the date premise ("since you're on a date in this scenario, what's the worst thing to order"); not blocked.
- Tests: `t_invite2.js` rewritten (11 checks); the old `t_invite.js` asserted the removed behaviour and was deleted. Build 2026-10-18z.

### 2026-10-18 — Chats empty-state icon replaced (two-bubble illustration)
- User sent a light (white) and dark (black) render of two overlapping speech bubbles with three dots and asked to replace "the old chat icon". Read as the Chats tab empty-state hero (`assets/icons/tabs/chats-empty-icon(.png|-dark.png)`, `.chats-empty-icon-img`, 176px wide) — the only large chat illustration; the small "Start a conversation" button icon (`chats-empty-cta-icon.png`) and the tab-bar chat icons were NOT touched. If another icon was meant, say so.
- Cut with transparency by flood-filling the border background (PIL only, `scratchpad/mkchat.py`: distance-from-background, soft edge 10-34, colour un-premultiplied at the edge, enclosed background-coloured pixels stay opaque), cropped to the art with 7% padding, 560px wide (displayed 176x152; the old art was 529x360 so the block is ~30px taller). The baked shadow ellipse is part of the art. Verified in WebKit, light and dark: loads, no fringe on either background.
- Originals: `design-refs/asset-originals-2026-10-18/assets/icons/tabs/`. Same filenames, so `ICONS_WITH_DARK_VARIANT` needed no change. No code change, no new build stamp (2026-10-18z).

### 2026-10-18za — First-ten-messages hooks REVERTED; slow start, questions in the middle
- **User feedback:** "okay random question" is a really bad message to start a chat with. Revert the early-turn work (18w) and don't rush from the start: slow pace first, and the middle of the conversation is when people normally trade questions.
- **Removed whole:** `_earlyHint`, `_earlyGreetingTurn`, `_isBareGreeting`, `BARE_GREETING_RE`, `STRICT_GREETING`, `EASY_QUESTIONS`/`_easyQuestion` (the either-or fallback), `EARLY_TURNS`, the dead-end rule that made a bare "hey" back a dead end, and the greeting-turn thread draw. The lesson written down so it is not repeated: measuring "69% of first replies to 'hey' were 'hey'" was right, but treating it as a defect was the mistake — a bare greeting back is how a chat starts, and forcing a hook into message 2 produced "okay so I'm at the studio... flan or churros, you're picking one", which reads as a bot trying to be interesting.
- **Kept from that round (not about the opening):** low-effort answers (idk, nothing much, good, fine) read as acknowledgements; unprompted thread shares spaced `THREAD_GAP_MSGS` = 4 apart; `_retoldStory` (no story told twice); the per-chat story pool (`PERSONA_THREAD_ALTS`).
- **Added: `_paceHint`, by the USER's message count** (`PACE_SLOW_UNTIL` = 3, `PACE_MIDDLE_UNTIL` = 12). Messages 1-3: slow and low-key, greet back, answer what is asked, no random or quirky questions, no stories or facts about her life unless asked, don't try to be interesting yet, no barrage of questions. Messages 4-12: warmed up, trade questions and answers, follow-ups from what they said, share a little back, one question at a time. After 12: the ordinary curiosity rules. Unprompted thread shares are also suppressed for the first 3 messages (a direct question still gets one).
- Test: `t_pace.js` (8 checks) replaces `t_early.js`. Build 2026-10-18za. Live verification: see the next entry or the end of this section.

### 2026-10-18zc — Report a problem with the AI; your own picture removed from the chat
- **Report (the user's ask: "something like ChatGPT" — report misbehaviour, ask before sending, send the whole conversation).** Two entry points: **Report** on a held message (now on HER messages only — reporting your own made no sense and the old button just showed a fake "Reported" toast) and a new **Report a Problem** row in the chat settings sheet. Both open `#report-sheet` (reuses `.chat-settings-sheet` slide-up chrome, so the keyboard-dismiss exemption applies): a reason (six: inappropriate/harmful, false or made up, didn't sound real, pretended to be human or agreed to meet, confusing/unhelpful, other), an optional 500-char note, and a line that says plainly that sending shares **the whole conversation** with Zelo plus the account ID. Nothing leaves the phone until **Send report**; Cancel sends nothing. `Keyboard.resize` is `none`, so `_syncReportKeyboard` pads the panel by `window.__zeloKbH` and scrolls the note field into view.
- **Where it goes:** `ZeloRecords.submitChatReport` inserts into `content_reports` (last 120 messages, each capped at 4000 chars, plus reason, note, persona id, message id/text, build). Signed out, offline, or table still missing the new columns -> queued in `zelo_pending_reports` (cap 20) and retried on sign-in/launch via `flushReports`; the toast says "Saved. We'll send it as soon as you're signed in and online" instead of claiming it was sent. PostHog gets only `chat_reported {reason, scope, difficulty}` (allow-listed); the conversation never goes to PostHog.
- **MIGRATION NOT APPLIED:** `supabase/migrations/20261018230000_chat_reports.sql` adds `persona_id, message_id, message_text, note, conversation (jsonb), app_build` to `content_reports`, keeps owner-only insert/select, and clears `conversation`/`message_text` after 180 days (`purge_old_report_conversations`, daily via pg_cron if present). The user must paste it into the Zelo project's SQL editor, then read the rows in the dashboard. This is a deliberate exception to records.js's "never store the conversation" rule — it is an explicit user action behind a sheet that says so; the file header says so too.
- **Your own picture is gone** beside your bubbles (both `appendUserBubble` and `appendUserBubbleStatic`); the bubbles sit flush at the right edge (measured 16px gap, the container padding). Her small avatar is unchanged.
- Test: `t_report.js` (20 checks, light + dark: no own avatar, right-edge gap, Report on hers only, six reasons, send disabled until a reason, payload carries the whole conversation, queued result is reported honestly, Cancel sends nothing). `t_report2.js` checks the keyboard lift. Build 2026-10-18zc.
- **Also this build — questions are paced in code (`_questionsToCut`):** the first reply carries no question; in the slow start she does not ask straight after asking; never three replies in a row ask; if THEY just asked her something, asking back is allowed. The model ignored the "slow start, questions in the middle" prompt on frequency (live: 44% of replies 1-3 asked, 36% of 4-9, one warm persona asked in 10 of 12), so this is enforced on the finished reply, the question sentence cut and the rest kept. `t_qgov.js` (6 checks).
- Two older tests were retired/fixed for the new slow-start suppression (`t_threads`, `t_early2` now use chats with 5 user messages).

### 2026-10-18zd — Report reasons rewritten from the user's point of view
- The first six reasons were written like a trust-and-safety form ("pretended to be human, or agreed to meet up", "said something false"). The user pointed out nobody reports because of that — they report because they did not like the reply. Now seven, all in the user's words: rude or offensive; made me uncomfortable; didn't make sense or ignored what I said; repeated itself or sounded robotic; boring or very short answers; blocked me or ended the chat unfairly (the block feature); something else. Ids: `rude, uncomfortable, nonsense, robotic, boring, blocked, other`. The "pretended to be human / agreed to meet" category is gone from the picker on purpose — a policy slip still reaches us through the optional note and, with the whole conversation attached, can be found by reading reports.
- **Question pacing, second pass:** the first live run of the governor still showed four questions in a row (Valentina) because casual questions often have no "?" ("hey how's your day going", "what shows"). `_asksSomething` = "?" OR a question word opening a clause; used for the flags and for the cut. `t_qgov.js` now 8 checks.
- **SQL:** `20261018230000_chat_reports.sql` is the only pending migration; the user wants every SQL file copied to the clipboard (memory: feedback_copy_sql_to_clipboard).

### 2026-10-18ze — Report is on every hold menu
- User: "why can't you put the report on the hold mechanic?" — it was, but only on HER messages (18zc removed it from yours), so holding one of your own bubbles showed no Report, and the Chats-list hold menu (Pin / Search / Reset / Delete) never had one. Now: Report on every message (on hers it reports that reply, on yours it reports the conversation) and **Report a Problem** in the Chats-list row menu (`data-act="report"`, new `_CR_ICONS.flag`; points `state.*` at the held chat first, since the sheet reads the active chat). Plus the chat-settings row. `t_report.js` 24 checks, light + dark.
- Questions that are the WHOLE reply: `_cutQuestions` can't cut a reply that is only a question, which is how a warm persona still asked in 5 replies in a row. `redoNote` now has `STRICT_NOASK` ("react or share, don't ask") when `_questionsToCut` says this reply must not ask; the sentence cut remains the fallback. Build 2026-10-18ze.

### 2026-10-18zg — support email + slow-start asks nothing
- Settings "Report a problem" mailto pointed at support@zelo.app (a domain we do not own, and it is registered to someone else). Changed to support@zelofficial.com. Owned domain: zelofficial.com (Namecheap, expires 2027-07-29, nameservers at NS1, no MX yet). The mailbox/forwarding still has to be created by the owner before mail arrives.
- 18zf: slow start (first 3 replies) asks nothing unless the user asked; live run of 6 characters showed questions in first 3 replies only 3 of 18 times.

### 2026-10-19a — Support is in the app; Feature Requests board
- **Report a problem / Contact support no longer open the mail app.** Help & Support rows call `openSupport('problem'|'contact')` → in-app screens with a text box and an attached diagnostics "txt" (shown on tap, never sent hidden). `ZeloSupport.sendSupport` (services/support.js) writes `support_messages` (kind, message, diagnostics, build). Contact log = build, device, language, theme. Problem log adds screens visited and recent JS error NAMES (`window.__zeloErrLog`, set in `_reportJsError`). Never chats or anything typed. Signed out/offline → queued in `zelo_pending_support` (cap 10), flushed on sign-in from records.js, and the screen says "Saved on your phone" rather than "sent". Copy no longer promises a reply (nobody replies by email). The chat-level "Report a Problem" sheet is separate and unchanged.
- **Feature Requests** (`settings-feature-requests`, `settings-feature-new`): search, Most voted / Newest, cards with member tag (`Member 66CBBB`, a hash, not the user id), vote pill (optimistic, settles to server count, reverts on failure), tap a card to read it all, New request form (title ≥ 8 chars, 120/2000 counters). Reads only via `list_feature_requests()` and votes via `toggle_feature_vote()` (security definer), so other users' ids are never exposed; the table is owner-only.
- **"Checked automatically" = a DB trigger:** duplicate title rejected, 3 requests/day, links/emails/phone numbers/rude words → saved as `held` (author sees "Under review", nobody else sees it). Held ones need a manual look in the dashboard.
- **MIGRATION NOT APPLIED:** `supabase/migrations/20261019100000_support_and_feature_requests.sql` (parses, 42 statements; never run against Postgres). Until it is applied the board shows "Not available yet" and support messages queue.
- Gotchas: new screens are exempt in the global keyboard-dismiss handler for buttons/cards (else the first tap is eaten); `Keyboard.resize` is none, so they pad by `window.__zeloKbH`. The Request-a-feature icon is an inline megaphone SVG (no asset existed) in a pink tile.
- Not built: comments on requests, admin status labels (planned/shipped), notifications. Test: `t_support.js` (20 checks, light+dark). Build 2026-10-19a (style `b`).

### 2026-10-19d — Feature request page (comments), edit/delete your own, pink New, proper notice
- Tapping a board card opens `settings-feature-detail`: full post, vote pill + "N votes", comments list, sticky "Add a comment…" bar (`#frd-composer`) that lifts by `window.__zeloKbH`. Your own post shows Edit / Delete; your own comments show Delete (confirm sheet = `_showChatConfirm`). Edit reuses the New-request screen (`FR.formMode` 'edit' so the next "+ New" starts clean — a first version left the edit's text in the form). Back from the page (button or edge swipe → `frDetailBack`) refreshes the board.
- DB: `supabase/migrations/20261019110000_feature_comments_edit_delete.sql` (NOT APPLIED until pasted; needs 20261019100000 first). Adds `feature_comments`, `comment_count`/`edited_at`, shared `feature_text_status()` check (links/e-mail/phone/rude words → 'held'), 30 comments/day, and functions `get_feature_request`, `list_feature_comments`, `add_feature_comment`, `delete_feature_comment`, `update_feature_request`, `delete_feature_request`; `list_feature_requests` is replaced (new columns). Clients never touch the tables, so other people's user ids stay hidden. Both migrations parse and every plpgsql body validates with pglast; never run against Postgres here.
- "New" is `var(--accent)` with white text. Notices use `showNotice(title, text)` (= `showCopyToast(text, title)`); the toast title is no longer stuck on "Copied!" — other callers still get that default. A failed vote used to show "Copied!" as its heading; fixed.
- Honest wording: a post that passes the automatic check goes live at once and says so; only a flagged post says "Your post will be under review before it goes live".
- Test lesson: a non-exempt touch in the keyboard-dismiss test arms a one-shot click swallower for 600 ms that eats the NEXT click in the page — wait it out before asserting on a click. `t_support.js` is now 28 checks, light + dark. Build 2026-10-19d.

### 2026-10-19f — Megaphone art; comment bar no longer jumps
- The user's megaphone art (light on white, dark on black) is cut with `mkflat.py`-style transparency into `assets/icons/settings/settings2-icon-feature-request(.png|-dark.png)` (240px). Used for the Help & Support "Request a feature" row (tile stays light pink in both themes, like its neighbours; registered in `ICONS_WITH_DARK_VARIANT`) and as the icon of every feature-board notice (`showNotice` → `showCopyToast(msg, title, true)`; the check mark comes back for all other toasts; the notice's sub-line may wrap to two lines).
- **Why the comment bar jumped too high:** the global `nudgeFocusedIntoView()` treats any focused input as "movable" and shifts the INPUT ALONE by however much the keyboard overlaps it. The comment box sits at the bottom, so its overlap was large, and my own bar lift (`translateY(-kb)`) stacked on top of that — plus the bar kept its home-indicator padding while lifted. Fixes: the five support/feature screens are opted out of the global nudge (same pattern as `#screen-tellzelo`), and the lifted bar drops its safe-area padding (`.fr-composer--kb`) so it sits directly on the keyboard.
- No .md file instructs this; the nudge is old behaviour in script.js (see the 2026-10-07e entry). New screens with a text field should be added to that opt-out list unless they really want the nudge.
- Headless can't raise a real keyboard (`keyboardHeight` stays 0), so the "no jump" claim is verified only as: no transform on the input, and the bar lifts by exactly `__zeloKbH`. It needs a phone to confirm. Test: `t_support.js` (31 checks).

### 2026-10-19g — Contact support / Report a problem are a mail-style sheet, log file not viewable
- User: it should pop up like mail inside the app (the way Cal AI's compose sheet does, nothing opens outside), and the user must not see what is inside the attached txt. The two pushed screens (`settings-contact-support`, `settings-report-problem`) and the "tap to see the log" row are gone. `openSupport('contact'|'problem')` now slides up `#mail-sheet` (reuses `.chat-settings-sheet` chrome, top edge 52px): Cancel · title · pink send arrow; To: Zelo Support; Subject; message box (focused on open, keyboard up); "Please describe your issue above this line."; an attachment chip with only the file name and size (`zelo-contact-log.txt` / `zelo-problem-log.txt`, ~0.3 KB). The file contents are still built by `ZeloSupport.buildDiagnostics(kind)` and saved with the row; they are just never shown.
- Send → `ZeloSupport.sendSupport` (Supabase `support_messages`, unchanged) → sheet closes → "Message sent"/"Report sent" banner with the check; queued → "Saved on your phone". Daily limit keeps the sheet open with a line. Cancel with text asks "Discard this message?" (no draft is kept). This is NOT a real e-mail: no Mail app or account is involved, and nothing is sent to support@zelofficial.com. A true native mail composer would need a Capacitor plugin + Xcode rebuild and only works if the user has Mail set up.
- Bug while building: the sheet showed at half height (`height: calc(100% - 52px)` is relative to an auto-height wrap) — fixed with `flex: 1` on wrap and panel. `#mail-sheet` is opted out of the global keyboard nudge and pads by `window.__zeloKbH`. `t_support.js` rewritten for the sheet (36 checks). Builds 2026-10-19g/h.

### 2026-10-19i — No spam text, no bad words; AI review (Gemini) for requests and comments
- **Spam text and bad words are refused before sending.** `services/textguard.js` (`ZeloTextGuard.check`) runs on a new/edited request's title and details and on every comment: bad words (also f*ck / sh1t / fuuuck look-alikes, with word boundaries so "assess", "classic", "grape", "Dickens" pass) → "Please keep it respectful…", gibberish → "That doesn't look like real words…". Gibberish = keyboard mashing, 4+ repeated letters, a run of neighbouring keys (qwerty/asdfgh), vowel-less words, or a long word with a consonant cluster no English word uses. The cluster list was COUNTED from a full dictionary (clusters in ≥3 words), plus a coda+onset split so compounds (girlfriend, armchair, breakthrough, worthwhile) pass. Measured: 0.15% of a 234k-word dictionary of obscure words flagged, 0 of the app's own 2.4k common words, 8/8 mash samples caught incl. "sduhaodhwoah". One mashed word in a long sentence (<25% of words) is allowed through to the AI. `t_guard.js`.
- **Database backstop for custom clients:** `feature_text_rude()` refuses bad words with `zelo:inappropriate` (posts, edits, comments); links/e-mail/phone numbers are still held.
- **AI review:** new posts/edits/comments that pass the free checks are saved `pending` (only the author sees them, badge "Checking…"). The app then calls edge function `moderate-feature-text` (Gemini `gemini-3.5-flash-lite` via the Interactions API; the old generateContent endpoint is retired for the key). It sets `live` or `held` ("Under review"). If it fails, the item stays pending and becomes visible to everyone after 3 minutes (`feature_visible()`); the app asks again after 30 s on the next board/page load. A row is reviewed at most 3 times. The submit notice is now always "Your post will be under review before it goes live" (true for every post).
- **Files:** `supabase/migrations/20261019120000_ai_review_pending.sql` (needs 20261019100000 and 20261019110000 first; 110000 is confirmed applied, 120000 is NOT), `supabase/functions/moderate-feature-text/index.ts` (one self-contained file, secret `GEMINI_API_KEY`). Not deployed from here (local CLI is on another account). Until the SQL is run the app behaves as before (posts go live at once); until the function is deployed pending items just wait the 3 minutes.
- **Gemini facts (measured 2026-10-18):** 6/6 sample posts judged correctly by `gemini-3.6-flash`; `gemini-3.5-flash-lite` (used) also handled a prompt-injection post and harsh-but-valid feedback correctly; 4-6 s per call; the free tier of `gemini-3.6-flash` allows 5 requests/min (flash-lite's limit was not hit). The key was pasted in chat by the user, who chose not to rotate it; it is NOT in any file. The full function code has not been run against live Gemini (the user declined that run); only its logic was tested with a fake network. `t_verdict.mjs`, `t_support.js` (45 checks).

### 2026-10-19 — Deployment debugging: a real SQL bug, links refused not held forever, Gemini-call cost hardening, real native Mail
- **Migration 3 (`20261019120000_ai_review_pending.sql`) had a genuine bug**, caught only once the user actually ran it: `revoke all on function public.feature_text_rude(text) ...` sat BEFORE that function's own `create or replace`, so Postgres errored `function ... does not exist`. Fixed by deleting the premature revoke (the function never needed one — nothing else grants/revokes on it). Lesson: a `revoke`/`grant` line must physically follow the `create` of whatever it targets in the same file: reading top-to-bottom like Postgres executes it, not assuming a later block "covers" an earlier one.
- **Deployed and confirmed working**: migration 3, the `GEMINI_API_KEY` secret, and the `moderate-feature-text` edge function. One real debugging round: 200 OK but `{status:"pending"}` forever — root cause wasn't the Gemini key (curl-tested directly, worked first try) but the TEST POST'S OWN `moderation_tries` already being exhausted from earlier attempts made before the key was correctly saved. Lesson for next time this symptom shows up: check whether the SPECIFIC row being tested already burned its 3 tries before assuming the integration is broken — always test with a fresh post, not a reused one.
- **Supabase CLI access, re-confirmed:** `supabase link --project-ref bfxxywxhydxvccusjinm` (the real Zelo project) returns "account does not have the necessary privileges" — the CLI on this machine is authenticated as a DIFFERENT account (only sees `ozlilbrother-trades`), even though the repo's own `.temp/project-ref` correctly points at Zelo. So every Supabase change here goes through manual copy-to-clipboard + the user pasting into the dashboard SQL editor / Edge Functions UI — not because of laziness, a real, confirmed access limitation. Would need `supabase login` re-pointed at whichever account owns Zelo, or a scoped personal access token, to change.
- **Links/emails/phone numbers are now REFUSED, not held forever** (`supabase/migrations/20261019130000_block_links_not_hold.sql`, `services/textguard.js`). The original design silently inserted a link-containing post as `status='held'` — nothing ever re-checks a held row, so it sat stuck "Under review" permanently with no path to visibility, which read as a bug once a user actually hit it. Now a link/email/phone is refused outright at both layers — instant client-side (`ZeloTextGuard.isContactInfo`, mirrors the SQL regex, zero network cost) and as a DB-trigger exception (`zelo:has_link`) for anyone bypassing the client — exactly like a rude word already was. Nothing gets inserted, so nothing gets stuck.
- **Two real cost/abuse gaps found while answering "how do I not get charged for spam", both fixed** (`supabase/migrations/20261019140000_atomic_moderation_claim.sql`, `supabase/functions/moderate-feature-text/index.ts`):
  1. No index existed on `(user_id, created_at)` for the daily-post-limit check, which runs on EVERY submit attempt (successful or failed) — a full table scan that gets slower as the table grows, meaning repeated failed attempts (a user hammering the submit button, or a script bypassing the UI) get progressively more expensive rather than staying a cheap, flat rejection. Added the missing index on both `feature_requests` and `feature_comments`.
  2. **`update_feature_request()` reset `moderation_tries = 0` on every edit** — so editing the SAME post over and over bought unlimited fresh Gemini reviews (3 tries × as many edits as you like), the one genuinely unbounded cost vector in the whole system. Fixed by no longer resetting it on edit — a row's lifetime Gemini budget is now exactly 3 calls, full stop, regardless of how many times it's edited.
  3. **The edge function's try-count check was a classic TOCTOU race**: read `moderation_tries`, check it's under the cap, THEN write +1 — three separate steps. Several concurrent calls for the same row (trivial to script) could all read the same stale count and all pass the check before any of them wrote, turning "max 3 tries" into effectively unlimited concurrent Gemini calls. Fixed with `claim_moderation_try()`, a single atomic SQL `UPDATE ... WHERE moderation_tries < 3`, which Postgres serializes per row — only ever the first 3 callers can succeed no matter how many arrive at once. The edge function's own `MAX_TRIES` constant was then dead code (the real cap moved into SQL) and was deleted rather than left as a misleading no-op.
- **Support (Report a Problem / Contact Support) switched to the REAL native iOS Mail compose sheet**, replacing the in-app lookalike sheet built 2026-10-19g/h — a direct reversal of that earlier explicit decision ("pop up like mail inside the app, nothing opens outside"), prompted by the user pasting a screenshot of Cal AI's own flow and asking to match it. `MainViewController.swift` gained a `MailComposeHandler` (same `WKScriptMessageHandler` pattern as the existing emoji-keyboard hook) that presents a real `MFMailComposeViewController` — pre-filled recipient (`support@zelofficial.com`), subject, and the diagnostics `.txt` as a genuine file attachment, body left empty for the user to write in. `openSupport(kind)` now posts to `webkit.messageHandlers.zeloMail` first; the OLD in-app sheet (`_openSupportSheetFallback`, still fully intact, still saves to Supabase `support_messages`) only fires if `MFMailComposeViewController.canSendMail()` is false (no Mail account configured on the device) — a real, common case this app can't assume away.
  - **Known limitation, told to the user plainly:** once the user taps Send inside the real native Mail sheet, the web app has no way to see what they actually wrote — `MFMailComposeViewControllerDelegate` only reports an outcome (`sent`/`saved`/`cancelled`/`failed`), never the edited body text. So unlike the old sheet, there is NO Supabase record of the message content for the native-mail path — the real email itself is the only record, and it only has anywhere to land once `support@zelofficial.com`'s mailbox/MX is actually set up (per 2026-10-18zg, it wasn't as of that entry — unconfirmed whether it is now). This is a genuine behavior change, not an oversight: flagged to the user as part of the same message that implemented it, not discovered later.
  - Native change — needs a real Xcode rebuild to test; a web-only sync does nothing for this one. `import MessageUI` is a standard system framework; no Info.plist entry needed (unlike camera/location, Mail composing needs no usage-description string).

### 2026-10-19 (same day, later) — Native Mail reverted from primary to optional, after real testing exposed a silent-data-loss risk
- The user actually tested the native-Mail build above on a real iPhone (the Mail account's own SMTP auth was broken — "Cannot send mail... connection to smtp.gmail.com failed"). The account issue itself was the user's own to fix (re-added the account via Settings > Mail > Add Account > Google), but testing it surfaced a real, generalizable problem with the whole approach, not just this one account: **`MFMailComposeViewControllerDelegate` reports `.sent` the instant the message is QUEUED, not once delivery is confirmed** — and `canSendMail()` only checks that SOME account exists, never that it can actually send. A real user with a broken Mail account (an unremarkable, common failure — expired app password, stale OAuth token) would see Zelo's own "Message sent" toast fire, genuinely believe their report went through, while it silently failed inside Apple's own Mail app with ZERO signal reaching either the user or Zelo. There is no API that tells a third-party app whether a native Mail send actually succeeded after `.sent` — this is a hard platform limitation, not something fixable with more code.
- Reverted the priority: the in-app sheet (`#mail-sheet`, saves straight to Supabase `support_messages`, built 2026-10-19g/h) is PRIMARY again and the only thing `openSupport(kind)` opens — guaranteed reliable regardless of the user's device Mail configuration. Native Mail is now a secondary, OPTIONAL action inside that sheet (`mailOpenNative()`, a small "Open in Mail instead" button below the attachment chip) that pre-fills the real Mail compose with whatever the user has already typed — so someone who wants the "real email" feel can still get it, but the sheet's own Send button (the reliable path) is what every user actually depends on by default. `window._zeloMailResult` no longer shows "Message sent" for a `.sent` outcome (misleading, per the above) — just a neutral "Opened in Mail — send it from there whenever you like."
- Lesson: when a platform API's "success" callback doesn't actually guarantee the thing it sounds like it guarantees (here: `.sent` sounds like confirmed delivery but means "queued"), do not let it gate or replace an already-reliable path — demote it to optional instead. This is also why the earlier entry's "the real email itself is the record" framing was wrong: without a working inbox AND a working sender account AND no network interruption AND the user actually pressing Send correctly in a UI they've never seen before, "the email is the record" has too many silent failure points for something a solo developer depends on to catch real user problems.

### 2026-10-19 (same day, later still) — Referral/streak sharing: real app icons, a real shared picture (not text), native Instagram Stories + Messages
- **Icons were genuinely bad, and the user correctly rejected my first self-assessment of them.** I'd judged the referral row's Instagram/WhatsApp icons as "fine" before touching anything; the user flatly disagreed ("same ai generated icon for insta and messages") and was right — the real, root cause was CSS, not the art: `.refer-share-app img { border-radius: 50% }` was force-cropping every icon into a circle, which distorts any real app logo (none of these apps' actual icons are circular) and is why even a correct icon read as fake. Changed to `22.5%` (a proper squircle, matching real iOS app-icon shape). Separately pulled the REAL, current Instagram and WhatsApp icon artwork — not hand-drawn, not AI-generated — via Apple's public iTunes Lookup API (`itunes.apple.com/lookup?bundleId=...` → `artworkUrl512`, a documented, legitimate endpoint, not scraping), masked with a proper rounded-square alpha mask, replacing both the referral row AND the milestones share row's Instagram icon for consistency. Messages' icon (already fixed earlier the same day by reusing the correct milestones asset) was left as-is — the circle-crop fix alone likely explains most of why it also read as fake, since the underlying art was already confirmed correct.
- **"It's a fake send right now" was accurate — fixed by actually rendering the picture, not scraping the DOM.** `shareSheetNatively()` only ever called `navigator.share({text})` — no image, ever, despite the whole sheet being built around a visual card (hero art + streak digits + title). Built `_renderShareImage()`: loads the card's art + digit glyphs via `new Image()`, composites them onto an 1080×1920 canvas (Instagram-Stories-safe, still looks right dropped into Messages/anywhere else) with a gradient background, title, subtitle, and a bold CTA caption, exports via `canvas.toBlob('image/png')`. Cached per-render (`_msShareImageCache`) so repeat taps in the same sheet don't re-render. "Save"/"More" now carry this real file through `navigator.share({files:[...]})`.
- **Real native per-app share, where it's actually possible — scoped honestly per app, not promised uniformly.** The user's ask ("no generic iOS AirDrop thingy, a real Instagram popup ready to send") is NOT equally achievable across apps, and I said so rather than overselling: **Instagram** has a real documented "ready to post" Stories deep link (`instagram-stories://share`, image handed over via `UIPasteboard` under `com.instagram.sharedSticker.backgroundImage`) — but it requires a **Facebook App ID** (Instagram's own requirement, user supplied `1826192315071555`, wired into `MainViewController.swift`) and `LSApplicationQueriesSchemes` in Info.plist (`instagram-stories`, added). **Messages** has a real native compose sheet (`MFMessageComposeViewController`, same `MessageUI` import already used for Mail) that takes an image attachment directly — built as `presentMessageComposer()`, genuinely no generic picker. **WhatsApp has no equivalent for third parties** — confirmed by checking, not assumed — there is no documented direct-image deep link into WhatsApp's own compose UI; the only way it can receive a shared image at all is by appearing as one option inside the generic OS share sheet, which is what it still does here. Said this plainly rather than building something fragile/undocumented and presenting it as equivalent to the other two.
- **The user independently verified the Instagram approach is correct**, by checking Cal AI's own real behavior: tapping Instagram there also raises the system "[App] wants to open Instagram" confirmation — the same thing `UIApplication.shared.open(url)` on a custom scheme always produces. Good confirmation this is the standard, expected pattern, not a bug to hide.
- **The caption pattern was explicitly modeled on Cal AI's, with new wording, and confirmed architecturally correct before building:** Cal AI bakes a bold tagline ("Get healthy with Cal AI") into the bottom of the actual shared/saved image — invisible on the live in-app preview screen, only appears in what the recipient/Photos actually receives. This maps exactly onto `_renderShareImage()`'s own design (a separate canvas render, never shown as a live DOM element) — added `"Get better at texting with Zelo"` (own wording, same structural pattern) as a bold accent-colored line near the image's bottom.
- **Found and fixed a real overlap bug via actual headless rendering, not just reading the code.** First render attempt: the streak count digit ("0") visually collided with the "DAY STREAK" title text — `y` was advanced past the ART's bottom edge before drawing digits, but the title was then positioned relative to that SAME pre-digit `y`, never accounting for how far the digit glyphs themselves extended below it. Fixed by tracking the digit block's own true bottom (`dTop + dH`) and continuing from there. Verified by actually rendering both call paths (`openStreakShare()`'s digit case AND `openBadgeShare()`'s no-digit case) through real WebKit via Playwright and visually inspecting the output PNGs — caught a bug that reading the math alone did not make obvious, and confirmed the fix with a second render rather than assuming the one-line change was sufficient.
- **Honest gap, flagged not hidden:** the Day Streak share still shows "0" — there is no real streak-count tracking anywhere in this codebase (confirmed by grep, no `getStreak`/`zelo_streak`/equivalent exists; Journey/Milestones are static/view-only per earlier entries). Out of scope for this round; flagged to the user rather than quietly left as a correct-looking "0".
- Native change — needs a real Xcode rebuild to test (new Swift handlers + Info.plist entry). `ios/App/App/MainViewController.swift` and `ios/App/App/Info.plist` both touched; nothing in `supabase/` this round.

### 2026-10-19 (same day, later again) — Referral codes made real: server-backed, a live landing page, onboarding redemption
- **The referral code became a real, server-issued, 5-character value**, not random localStorage text (`supabase/migrations/20261019150000_referral_codes.sql`, NOT yet applied as of writing — needs 20260926120000 and 20260926140000 first). `profiles.referral_code` (unique), `my_referral_code()` (generates+persists on first call, retries on the rare collision), `redeem_referral_code(code)` (security-definer RPC: resolves code to referrer, refuses self-referral and a second redemption by the same account, inserts into the pre-existing but never-before-written-to `referrals` table). The table's own RLS already had no client UPDATE policy by design — the new RPC is the only write path, never bypassing that.
- **Built a working Netlify deploy pipeline from a bare personal access token**, carefully: verified the token read-only first (site info, the full 24-file live manifest with each file's SHA1) before touching anything, then used Netlify's digest-deploy API to add exactly 3 new files (`join.html`, `assets/join-og.png`, `_redirects`) by referencing all 23 existing files by their already-known hash — none of the live site's real content was ever re-uploaded or at risk, confirmed two ways: Netlify's own diff only ever asked for the 3 new hashes, and every existing page was re-checked live (200 OK) right after. `zelofficial.com/join/CODE` is live, verified with a real WebKit load (not curl, which can't run the page's JS) — code substitution, title, and the Open Graph image all confirmed working.
- A `/join/*` Netlify redirect (status 200, not a 3xx) keeps the code visible in the URL while serving one static `join.html` for every code — read client-side from `location.pathname`. The OG image is a separate static 1200x630 PNG (the standard landscape link-preview ratio, different from the 1080x1920 portrait shape used for the in-app Stories/Messages share images), built with plain PIL since it never changes per code.
- **Found and fixed a self-made collision, caught only by actually testing, not by reading the code:** built a whole new "have an invite code?" field on onboarding step 14 without first checking whether one already existed. One did — step 8 ("Enter referral code (optional)") already had a complete field (hero art, Apply button, Continue/Skip), just never connected to a backend. The collision surfaced immediately as a real bug the instant testing ran: `page.fill()` on `#cine-referral-input` returned "locator resolved to 2 elements". Deleted the duplicate entirely and redirected redemption to read the pre-existing `zelo_onb_referral` key step 8 already wrote. Same category of mistake this file already names for icons ("check the relevant folder first") — applies just as much to functionality: grep for an existing field/flow before building a new one.
- Redemption fires once, right after a genuinely new account is created — hooked into both real "a brand-new profile row was just written" points in `services/auth.js`, via the same `window.X` existence-check pattern auth.js already uses to call into script.js globals. Deliberately NOT hooked into the "restore an existing profile" branches, so an existing account signing in mid-onboarding can never redeem against itself. Clears the stored code either way (one-shot); a wrong/already-used/self code fails completely silently, by design.
- **Reward granting is an explicit stub** (user: decide the real reward later) — a successful redemption shows a deliberately vague "You and your friend are both set" notice, nothing specific promised, since no entitlement system exists yet to actually grant anything.
- Tested with a mocked `ZeloRecords.redeemReferralCode`/`showNotice` before calling any of this done, per the user's explicit ask to test in simulation first: real typing into the actual step 8 field confirmed end to end (Apply -> stored -> redemption called with the right code -> cleared -> notice shown), plus the no-code-typed path confirmed to make zero RPC calls.
- **Still open:** the referral link's own copy ("you'll both get rewards") still promises something nothing grants yet. The Messages icon in the referral share row is a hand-reconstruction (no public API exists for a system app's icon, unlike Instagram/WhatsApp which came from real App Store artwork) — user asked to send a screenshot of their own phone's icon so it can be cropped properly instead; not resolved yet.

### 2026-10-19 — Profile & Login: three wrong guesses at an overscroll-color bug, then the actual fix; share-sheet icon; avatar redesign
- **Three straight attempts at "white shows above the pink hero when you overscroll" were each individually plausible and each confirmed wrong on a real device** — worth recording the sequence itself, not just the final fix, because each wrong attempt LOOKED verified at the time (computed styles checked out, logic sound) and still failed in practice:
  1. A background-color on the SCROLLING screen element itself, sized/positioned to only cover the top region. Wrong: iOS renders the rubber-band bounce by translating the whole scrolled content (hero included) as one GPU-composited layer — a background painted ON that same element is part of that layer, not behind it, so it moves with the hero and can never be "revealed" by it moving away.
  2. A background-color on `#app` (the one non-scrolling parent frame), toggled by JS on screen open/close. Wrong in TWO ways: (a) there was a second way into the screen (`_plShowScreenNoStack`) that completely bypassed the JS toggle this depended on — found only by grepping for every caller, not by reading the one function that was changed; (b) `html`/`body` sit behind `#app` too, with their own hardcoded white, so even with the toggle fixed this might still have lost to a deeper layer.
  3. A CSS `:has()` selector coloring `html`, `body`, AND `#app` simultaneously, keyed off the screen's own `.active` class so no JS toggle could be bypassed by any future entry point either. Verified two ways in headless testing (normal open function, raw class toggle simulating the missed path) — both looked perfect. Still wrong on the device. At this point the real lesson: all three attempts were trying to guess WHICH ancestor background layer iOS exposes during the bounce, and that guess cannot be verified from here at all — headless testing can confirm a CSS rule's *effect on computed styles*, never whether a real iOS rubber-band bounce actually paints that layer.
  4. **The fix that actually works, per the user's own suggestion once they'd had enough of the guessing: stop trying to color an ancestor layer at all — physically attach a real pink DOM element as a sibling of `.pl-hero`, pulled out of view at rest.** Because it's a genuine child of the scrolling content (not a background on some ancestor that may or may not be part of whatever layer the bounce composites), it moves WITH the hero no matter how iOS renders the bounce — there is no layer left to guess at. First version used `margin-bottom: -600px` to cancel a `height:600px` box back to zero net space; measured on a real check that it shifted the hero ~28px off its normal position (margin cancellation in this flex context didn't land exactly). Fixed by using `position:absolute; top:-600px` instead — completely out of normal flow, so it provably cannot move anything else by even a pixel (re-measured: 0px shift). `.screen`'s own `position:absolute` gives it the right positioning context for free.
  5. **Superseded entirely, same session: the user asked for the screen to simply not scroll at all** (`overflow-y:hidden` once content was tightened to fit any real viewport height — it was only ~28px over). No scroll means no bounce means no layer to color — the whole multi-attempt problem class is now moot, and the DOM-sibling fix/workaround was deleted outright rather than left in as unreachable code.
  - General lesson for next time a report is "X shows briefly during a gesture/transition I can't trigger from here": a real device is the only ground truth for *which native compositing layer* gets exposed — don't spend another round confidently re-guessing after two misses; say so, and reach for a fix that doesn't depend on knowing the answer (attach real content to the thing that's moving) or that removes the gesture/transition entirely, rather than a third theory about which layer is "really" behind it.
- **Share-sheet preview icon (separate bug, same conversation):** "Share with friends" showed a generic link/globe icon in the OS share sheet instead of Zelo's own. Confirmed by reasoning, not assumption: that preview icon is tied to *what's being shared* (a bare URL triggers iOS's generic link representation) — same for `navigator.share()` and a native `UIActivityViewController`, so switching share mechanisms alone wouldn't have fixed it. Fix: pass the app's own icon (`UIImage(named: "LaunchIcon")`, already used for the launch overlay) as an explicit activity item alongside the text/URL — that's what actually controls the preview. Native change (`presentGenericShare` in `MainViewController.swift`, `zeloShareGeneric` handler), falls back to `navigator.share()` when the native bridge isn't available. Unverified on-device as of this entry.
- **Avatar redesign:** was a flat-accent-fill circle with a plain pink camera badge — read as a generic placeholder. Now 84px→104px, a gradient matching the hero it sits on (visual cohesion instead of a flat color dropped on a gradient backdrop), thicker ring + more shadow lift; camera badge inverted (white disc, accent icon, its own shadow) instead of flat-pink-on-now-gradient, which had lost contrast. "Profile photo" label bumped 700→800 weight (was already technically bold at 700, but read as bland at that size — a case where "check the CSS" said one thing and "look at it" said another; trust the latter). Checked the Email/Google/Apple "different font" report directly via computed styles before touching anything — genuinely identical (same family, same weight) — reported that back rather than making a cosmetic change to something that wasn't actually broken; left open whether the user meant the icon graphics instead.

### 2026-10-19 (same day, later) — Profile photo: real crop/pan/zoom, remove photo, and the actual cause of the "duplicate circle"
- **The "another circle above you" report was this project's own already-documented `[hidden]` bug, recurring in a new spot.** `#pl-avatar` (the letter-initial placeholder) carries `display:flex` for centering; `[hidden]`'s UA-level `display:none` loses to any same-or-higher-specificity author rule, so `placeholderEl.hidden = true` did nothing — the placeholder stayed visibly on screen underneath/beside the real photo the whole time. Exact same mechanism as the 2026-10-15a (chat sheet backdrop) and 2026-10-18b (.mail-attach / message-box) entries above. Fixed with an explicit `.pl-avatar[hidden], .pl-avatar-photo[hidden] { display: none; }` — confirmed via computed `display` (not just the `.hidden` property, which reads true/false regardless of whether it actually did anything) before and after setting a photo.
- **Built real crop/reposition (`plPhotoSelected` → `_plOpenCrop` → drag/`plCropZoom` → `plCropConfirm`/`plCropCancel`), replacing "read the file, save it raw, let `object-fit:cover` pick whatever it picks".** A picked photo never touches `zelo_profile_photo` directly — it loads into a 280px circular-masked stage first; the image auto-scales to the minimum needed to cover the circle (`PL_CROP_STAGE / min(naturalW, naturalH)`), the user drags to pan (clamped so the image can never reveal empty space past its own edges) and a slider zooms in from that minimum (anchored to the stage's center, not the image's corner, so it doesn't yank the image sideways while zooming). `plCropConfirm()` renders the exact visible crop onto a 320px canvas (`ctx.scale` by `OUT/STAGE` so the same x/y/scale numbers shown on screen reproduce identically at higher resolution) and only THEN writes to `zelo_profile_photo`; Cancel discards the picked file entirely, nothing is ever written.
- **Added `plRemovePhoto()`** (clears the key, placeholder reappears) — there was previously no way back to "no photo" once one was set.
- **New placeholder icon, replacing the letter initial** ("make a new picture icon... I don't like this current one" — the camera badge itself was explicitly kept, "only the camera if you already have that is good"): a plain person-silhouette SVG, the standard "no photo yet" convention most apps use, rather than a letter that was specific to whatever name happened to be set.
- Verified the whole pipeline end to end, not just each piece in isolation: opened the crop sheet with a real generated test photo (a solid color with a distinct marker shape), confirmed initial scale matches the computed cover-minimum, dragged and confirmed the x position moved by exactly the drag delta, zoomed and confirmed scale = minScale × slider value, confirmed the exported JPEG is a real, correctly-positioned, non-corrupted image (visually inspected — the marker landed exactly where the stage showed it), and confirmed the placeholder/photo/remove-button visibility all flip correctly together through a full set→remove cycle.
- **Follow-up, same day: the "disable scrolling entirely" call two entries up turned out not to be the end state** — the user came back with "make it bounce on the way down but hard stop at the ceiling," i.e. re-enable scroll with the iOS bottom rubber-band bounce intact, but still no bounce past the top. `overscroll-behavior-y` genuinely can't express that (it's all-or-nothing per axis — `none` kills bounce at BOTH ends, which is what every earlier attempt in this saga, including the "disable scrolling" one, kept converging back to by accident). Fixed with `overflow-y:auto` (default `overscroll-behavior-y:auto`, so the bottom bounces normally) plus a hand-written JS touch handler, `_plBlockTopBounce()`: a non-passive `touchmove` listener that calls `preventDefault()` ONLY when `scrollTop <= 0` AND the finger is dragging downward (`dy > 0`, the specific gesture that would pull the top into a rubber-band) — every other touch interaction (normal scroll, the bottom bounce, the crop sheet's own pan/zoom, excluded via the same `.pl-crop-overlay` check already used for swipe-back) is left completely untouched. Verified in real WebKit by checking the `preventDefault()` DECISION directly (a cancelable event's `dispatchEvent()` return value is `false` iff `preventDefault()` fired) across 4 cases — top+pull-down: prevented; top+pull-up (normal scroll): not prevented; mid-scroll: not prevented; bottom+pull-up (the bottom-bounce gesture): not prevented — rather than trying to read `scrollTop` after a synthetic touch sequence, which headless WebKit doesn't reliably turn into real scroll motion for synthetic events (same "can't observe real iOS compositor/bounce physics from here" limitation already documented throughout this saga — a real device is still the only way to confirm the actual bounce renders, this only proves the JS logic gating it is correct).
- **Second follow-up, same day: "cut it in half" — only scroll DOWN should work at all; scrolling back UP should be blocked outright, not just its top bounce.** `_plBlockTopBounce()` is renamed `_plBlockScrollUp()` and its condition dropped `scr.scrollTop <= 0` entirely — it now blocks every downward finger-drag (`dy > 0`, which scrolls content back up toward earlier material) at ANY scroll position, not only at the ceiling. Also switched from cumulative displacement-since-touchstart to a PER-FRAME comparison (this touchmove's y vs. the previous touchmove's y, tracked in `lastY`), so a mid-drag reversal (user drags down, scrolling fine, then reverses direction mid-gesture to drag back up) is caught the instant it reverses, not only once net displacement from the original touchstart happens to flip sign — the earlier cumulative approach would have let a reversal slip through for a while mid-gesture. Verified in WebKit across 5 cases (ceiling pull, mid-scroll pull-up-attempt, mid-scroll normal scroll-down, bottom-bounce gesture, and a mid-drag reversal) via the same `preventDefault()`-decision technique as the entry above — all 5 matched expectations exactly, including the reversal flipping to "prevented" on the very next frame after the direction change.
