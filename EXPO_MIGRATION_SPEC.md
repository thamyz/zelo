# Zelo — Extraction Spec for the Expo/React Native Migration

**Phase 1 deliverable.** This is the checklist Phases 2–6 get verified against. If the
Expo rewrite doesn't match something described here, that's a regression — not a
matter of taste — unless this doc is explicitly updated first.

**Source of truth right now:** a Capacitor iOS app — vanilla HTML/CSS/JS, no framework,
no bundler. `index.html` (~4,700 lines) + `script.js` (~12,900 lines) + `style.css`
(~12,900 lines), plus `services/*.js`, `data.js`, `personas.js`. Backend is Supabase
(Postgres + Auth + Edge Functions) and PostHog for analytics.

**Companion files, same repo root:** `EXPO_SIZES_SPEC.md`/`EXPO_SIZES_DATA.json` (real measured
x/y/w/h/font/color for every element — geometry this doc doesn't repeat) and
`EXPO_INTERACTION_SPEC.md` (gesture/timer/animation state machines + the CSS mechanisms that don't
translate 1:1 to React Native — behavior this doc doesn't repeat either).

**Companion document:** `CLAUDE.md` in this repo. It's a running case log of every
UI/UX bug that took more than one attempt to fix, with root cause and the actual fix —
most of "known bugs/edge cases that must not regress" (section 7 below) is a curated
pull from it, but it has far more detail per case. Read it before touching gesture,
animation, scroll, or dark-mode code — the same categories of bug have recurred
multiple times and the lessons are there.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Navigation model](#2-navigation-model)
3. [Screen inventory](#3-screen-inventory)
4. [Business logic](#4-business-logic)
5. [Backend: Supabase schema + Edge Functions](#5-backend-supabase-schema--edge-functions)
6. [Analytics: PostHog](#6-analytics-posthog)
7. [Known bugs / edge cases that must NOT regress](#7-known-bugs--edge-cases-that-must-not-regress)
8. [Animations catalog](#8-animations-catalog)
9. [Swipe deck mechanics](#9-swipe-deck-mechanics)
10. [Data model: localStorage key catalog](#10-data-model-localstorage-key-catalog)
11. [Dev/test flags currently live](#11-devtest-flags-currently-live-must-be-resolved-before-a-real-release)
12. [Things that are NOT real yet](#12-things-that-are-not-real-yet-dont-invent-logic-for-these)

---

## 1. Architecture overview

- **Client:** one HTML page, one JS file, one CSS file. No components, no virtual DOM —
  every "screen" is a `<div>` toggled visible/hidden via a shared JS screen-stack
  system (see §2). No build step; `index.html` loads `script.js`/`style.css` with a
  `?v=` cache-busting query string bumped on every change.
- **Native wrapper:** Capacitor (`capacitor.config.json`, `appId: com.zelo.app`,
  `webDir: www`). Native plugins in use: `@capacitor/browser` (in-app Safari for
  legal pages), `@capacitor/haptics`, `@capacitor/keyboard` (`resize: "none"` —
  native keyboard resize is OFF; all keyboard-avoidance is hand-built JS, see §7),
  `@capacitor/local-notifications`, `@capgo/capacitor-date-picker` (native
  `UIDatePicker` for birthdate), `@capgo/capacitor-social-login` (Apple/Google),
  `capacitor-plugin-app-tracking-transparency`, `@capawesome/capacitor-posthog`.
- **Backend:** Supabase project `bfxxywxhydxvccusjinm` (ap-southeast-2). Auth
  (email/password + Apple/Google), Postgres with RLS on every table, two Edge
  Functions (`deepseek-proxy`, `openai-proxy`) that proxy paid AI calls so API keys
  never reach the client.
- **AI:** DeepSeek (`deepseek-chat`) for reply generation and AI Coach chat; OpenAI
  (vision) for OCR'ing pasted screenshot conversations. Both go through the
  Edge Functions, never called directly from the client.
- **Analytics:** PostHog, native iOS SDK via the Capawesome plugin. Behavior events
  only, hard allow-listed client-side — see §6.
- **State:** one big in-memory `state` object (`character`, `activeScreen`,
  `screenStack`, `asstMessage`, `asstCurrentSet`, swipe-deck state, etc.) plus
  `localStorage` for anything that must survive a reload (see §10) plus Supabase for
  anything server-side (see §5).
- **No Redux/MobX/etc.** — this is worth stating explicitly for the rewrite: there is
  no existing state-management pattern to "port," just a global mutable object and a
  pile of functions that read/write it directly.

---

## 2. Navigation model

Three **tabs** (bottom tab bar, always one active): `practice`, `assistant` (labelled
**Scan** — this is Home/the default tab), `chats`.

On top of tabs, a **screen stack** for everything else:

- `pushScreen(name)` — hides all tabs/screens, shows `#screen-{name}`, hides the tab
  bar, remembers the previous screen on `state.screenStack` (skips the push if
  already on that screen, so re-entering doesn't corrupt the "back" chain).
- `popScreen()` — pops the stack; if empty, falls back to `showTab(state.activeTab)`.
- `showTab(name)` — hides everything, shows the tab, shows the tab bar.
- `_replaceActiveScreen(name)` — like `pushScreen` but does NOT push onto the stack
  (used for screens that sit "on top of" whatever was active without becoming part
  of the back chain — e.g. the paywall, the locked screen, trial-start).
- **Edge-swipe-back**: `attachEdgeSwipeBack(screenId, backFn, opts)` — a real
  finger-drag-from-left-edge gesture (not just a tap target) that reveals the
  destination screen underneath as you drag, with a spring settle if released short
  of the threshold. `opts.willNavigate(el)` (default `true`) tells it whether the
  commit will actually leave the screen — critical for Scan Result, where leaving
  might instead pop up "Save this scan?" (see §7, "edge-swipe-back slid away then
  snapped back").
- **41 screens total** pushed/popped this way (full inventory in §3) plus 3 tabs.

**Locked-app gating (Cal AI style, "subscription expired"):** `subscriptionExpired()`
is the single hook for a real entitlement check later (today it's a dev toggle —
see §11). When true, `showTab()` (any tab but Scan) and `pushScreen()` (anything not
in an explicit allow-list: Account/Settings, Journey, Milestones, the paywall itself)
redirect to `#screen-locked` (a screen-recording video + "Continue" → the onboarding
paywall) instead. `generateReplies()`/`openHistory()` check the same gate before
doing anything. `awardXP()` returns 0 while locked. **The Expo rewrite needs this as
a first-class routing concern**, not an afterthought bolted onto individual screens —
in the current app it's centralized in exactly two functions (`showTab`, `pushScreen`)
plus a handful of explicit gate calls; keep it that centralized.

---

## 3. Screen inventory

### Tabs (always exactly one active)

| Tab | Purpose |
|---|---|
| `practice` | The swipe-deck "Practice" tab — Tinder-style card deck of AI personas to chat with. Empty/loading state: none really — deck reshuffles from a fixed local `PROFILES` pool (`data.js`), see §9. |
| `assistant` | **Scan** — Home/default tab. Paste text or a screenshot of a conversation; Zelo generates a reply. Widget carousel (Streak/Activity/Leaderboard cards) at the top. |
| `chats` | List of ongoing practice conversations (`chatStore`, in-memory + not persisted to Supabase — see §12). Empty state exists (illustrated icon + CTA). |

### Onboarding (`#cine-onboarding`, a single full-screen overlay with 16 numbered
steps + a "showcase" pre-step + a handful of standalone `.screen`s it hands off to)

This is its own state machine, `cineStep` (`0 | 'showcase' | 1..16`), driven by
`CINE_STEPS[n]` (label/enabled-fn/entrance-animation per step) and `cineGoTo(n)` /
`cineNext()` / `cineBack()`. Steps:

| # | What it asks / shows | Notes |
|---|---|---|
| 0 / showcase | Phase 1 word-morph intro ("Confidence / Connection / Conversations"), then a phone-mockup showcase video with "Get Started" / "Already have an account? Sign in" | Sign in here uses `AUTH.startSignIn()` — see §4 Auth |
| 1 | Name + photo + age (native date picker) | `cineIntroReady()` gates Continue on name valid + age set |
| 2 | Gender | |
| 3 | "Where did you hear about Zelo?" | uploaded to `onboarding_responses.source` |
| 4 | "How often do you overthink messages?" | → `onboarding_responses.overthink`; also feeds the Plan screen's "Your challenge" card (step 13) |
| 5 | "What do you want help with?" (multi-select) | → `onboarding_responses.help` (JSON array) |
| 6 | "Who are you attracted to?" | writes `zelo_practice_mode` directly (shared with the swipe deck's dating-pool pref and Settings' "Who to Practice With"); **NOT uploaded to Supabase** — treated as sexual-orientation-adjacent special-category data, waiting on an explicit consent screen (see §12) |
| 7 | Preferred tone | → `onboarding_responses.tone` |
| 8 | Referral code (optional, own Continue/Skip) | `zelo_onb_referral` local only, no consumer yet |
| 9–10 | Filler/marketing steps | |
| 11 | Notification permission (real native prompt) | no shared CTA |
| 12 | "Setting everything up" loading screen | auto-advances, no back |
| 13 | "Zelo Plan" summary screen | Your Focus / Challenge / tone+goals+practice-level cards, built FROM the answers above |
| 14 | "Save your progress" — Apple/Google/email sign-up | terms checkbox required; see §4 Auth for the sign-in-vs-sign-up branching here, it's non-trivial |
| 15 | "Try Zelo for free" — phone-mockup demo video, trial CTA | no back button at all (dead end going backward) |
| 16 | "We'll send a reminder before your trial ends" | |

After 16: `cineFinishPhase2()` → `#screen-trial-start` (3-day trial paywall UI, no
real purchase logic — see §12) → optionally a one-time discount offer screen → a
branded loading beat (`#cine-landing-loader`, 1.2s) → lands on the Scan tab.

### Account / Settings (`screen-dashboard` is the entry point, ~25 sub-screens)

`screen-dashboard`, `screen-refer-friends`, `screen-settings-profile-login`,
`screen-settings-add-email`, `screen-settings-email-connected`,
`screen-settings-forgot-password`, `screen-settings-reset-sent`,
`screen-settings-personalization`, `screen-settings-tone-preview`,
`screen-settings-practice-prefs`, `screen-settings-who-practice`,
`screen-settings-age-range`, `screen-settings-skipped-profiles`,
`screen-settings-notifications`, `screen-settings-zelo-pro`,
`screen-settings-privacy-data`, `screen-settings-scan-retention`,
`screen-settings-download-data`, `screen-settings-help-smarter`,
`screen-settings-delete-account`, `screen-settings-ai-transparency`,
`screen-settings-help-support`, `screen-settings-contact-support`,
`screen-settings-about`, `screen-settings-terms`, `screen-settings-privacy-policy`.

Notable ones with real multi-state logic (not just static text):

- **`screen-settings-download-data`** — a 5-state flow in ONE screen (not 5 separate
  screens): request → confirm (masked account email, or type a one-off destination
  email for just this request) → preparing → submitted → a 24h-then-15min cooldown
  state → "your data is ready". See §12 — no email is actually sent yet.
- **`screen-settings-help-smarter`** — the "Help Zelo get smarter" practice-chat
  consent screen (toggle + 3 bullet points + an "off" confirmation state). Paired
  with a one-time modal shown on the user's first practice chat (`#practice-review-modal`).
- **`screen-settings-forgot-password`** — real Supabase `resetPasswordForEmail`,
  with a specific "no account found with this email" vs generic error split (see §4).
- **`screen-settings-age-range`** — a dual-handle range slider AND a 4-preset radio
  list that stay in sync (picking a preset moves the slider; there's no default
  preset — tapping the selected one again clears it back to "Any").

### Scan flow

`screen-scan-type`, `screen-scan-upload`, `screen-scan-result`, `screen-tellzelo`.

- Paste text or upload a screenshot → optional "Who/Situation/Goal" context wizard
  (`screen-tellzelo`, called "Tell Zelo") → loading → `screen-scan-result`, a
  horizontally-swipeable carousel of reply-style cards (native scroll-snap, not a
  custom drag — see §9 for the difference from the Practice deck's drag mechanics).
  Each card: tone label, generated text, Copy / Use this reply / Change tone /
  Explain why (asks the real AI Coach a follow-up about that specific card).
- **Two layouts share this one screen**, toggled by a class:
  - fresh scan (`:not(.is-replay)`) — has an editable "Add her/your message"
    composer (Her/You segmented toggle, sliding pill) that can regenerate the
    reply live.
  - replay (`.is-replay`, opened from a saved thread/History) — same composer,
    tighter layout, persists every change straight back into the saved thread.
- Leaving without having saved/skipped yet triggers "Save this scan?" (bottom
  sheet) rather than just navigating away — see §7's edge-swipe-back entry.

### Chat (practice conversation)

`screen-match` ("It's a Match!" reveal after a right-swipe) → `screen-chat`.

- On first open: a "Set the pace" modal (Instant vs Realistic-timing replies) — one
  time per chat, not per app.
- Right after that (once, ever, per user): the "Help Zelo get smarter" consent
  modal — see §4/§5.
- Composer sends into a scripted persona reply engine (`REPLIES[difficulty]`,
  cycling through canned lines, not live AI — see §4).
- AI Coach entry point in the composer bar opens a bottom sheet with a read-only
  replay of the live chat, backed by real DeepSeek calls.

### Other

`screen-history` isn't in the plain screen list above — it's `openHistory()`, an
overlay that keeps the tab bar visible, with Threads/Matches sub-tabs.
`screen-thread-detail`, `screen-paywall` (History's own upgrade entry — separate
UI from onboarding's trial-start), `screen-ai-coach`, `screen-leaderboard`,
`screen-journey` ("Your Streak" detail + badges — static, see §12),
`screen-mission-control` ("Level up" hub — Level card, weekly stat tiles, daily
missions — also static, see §12), `screen-milestones` / `screen-milestone-category`
(badge browser, all `progress: 0` — see §12), `screen-locked` (§2).

---

## 4. Business logic

### 4.1 XP / Levels

```
XP_SOURCES = { message: {xp:2, dailyCap:20}, scan: {xp:5, dailyCap:10}, conversation: {xp:10, dailyCap:5} }
XP_MAX_LEVEL = 20
XP_LEVEL_RATES: levels 1-5 = 200 XP/level, 6-10 = 400, 11-15 = 700, 16-19 = 1200, 20 = 1500 (a ceiling, no level 21)
```
`getLevelForXP(xp)` walks a cumulative-threshold table built from the rates above.
`awardXP(source)` respects the per-source daily cap (tracked in `zelo_xp_daily`,
resets when the stored date ≠ today), shows a count-up XP panel, and — if the level
just changed — a separate Level-Up panel 1.9s later (never simultaneous). **Currently
suppressed app-wide** by `SUPPRESS_XP_LEVEL_NOTIFS = true` (a real flag, not
finished/undecided product direction — check with the user before assuming it
should be on in the rewrite).

### 4.2 Streak — NOT REAL LOGIC, presentation only

**Important:** there is no streak-increment mechanic anywhere in this codebase.
`showStreakNotif()` exists and is fully built (UI, animation, week-dot rendering)
but nothing calls it from a real trigger — it's preview/demo-only. The Journey
screen's "days in a row" always shows a static value. Milestone badges in the
`streak` category (`data.js`) all have `progress: 0` hardcoded. **Do not invent a
streak formula during the rewrite** — this needs a real product decision + a real
implementation, in the current app or in Expo, whichever comes first; it isn't
something to "port," because there's nothing working to port.

### 4.3 Tone/reply-style selection (a previously-fixed bug — do not regress)

`getEligibleStyles(situation, goal)` in `script.js`, tables in `data.js`:

- `STYLE_ELIGIBILITY[situation][goal]` → ordered array of eligible tones (first =
  auto-generated default card). Situations: First Conversation / Getting to Know
  Each Other / Planning Something / Flirting / (+ more — see `data.js`). Goals: Get
  a Reply / Keep Things Going / Ask Them Out / Fix Things / Be Funny / Be Direct.
- **Hard safety rule, enforced in CODE, not just the table:**
  `HEAVY_SITUATIONS = {Argument, Toxic Relationship}` → Funny and Bolder tones are
  filtered OUT regardless of what the table says or what Goal was picked. If that
  filtering empties the list, fall back to `SAFE_FALLBACK_STYLES = [direct, shorter]`.
- No situation/goal selected at all → `NO_CONTEXT_DEFAULT_STYLES = [smooth, direct, shorter, longer]`.
- 7 real tones total: smooth, direct, shorter, funny, warmer, bolder, longer (+
  `playful`, demo-recording-only, never reachable from a real scan).
- Each tone has a fixed color pair (`STYLE_COLORS`) used for the card
  background/accent/icon theming — sampled from the real cropped 3D icon set, not
  arbitrary — carry the same hex values over.

### 4.4 Free-tier limits (`data.js: FREE_LIMITS`)

```
scansPerDay: 10 (shared cap: Scan + AI feedback together)
bonusScansPerAd: 3, maxAdsPerDay: 1
historyDays: 7
maxMatches: 3 (lifetime chat-starts, not concurrent — deleting a chat does NOT free a slot)
trialDays: 7 (superseded by the onboarding paywall's 3-day copy — see §12, there are two competing trial concepts, only one is live UI)
```
`isPaidUser()` is currently hard-coded to return `true` (**everything unlocked**) —
paywall gates are wired in the code (`subscriptionGate()`, the locked-screen system
in §2) but there is no real purchase system driving them yet.

### 4.5 Auth (see `services/auth.js`)

- Email/password + Apple + Google, via Supabase Auth. Email confirmation is
  disabled on this project (session issued immediately on sign-up).
- **`_onSignedIn()` is the single most important piece of auth logic to port
  faithfully** — it branches on: is this a fresh signup with onboarding
  answers already collected locally (insert a `profiles` row from them) vs. an
  existing account signing in (restore their real profile, skip local answers
  entirely) vs. a brand-new Apple/Google identity with no profile row yet (route to
  onboarding). Two near-identical "sign in" entry points exist (the front-of-
  onboarding Showcase screen, and onboarding step 14's email form toggled to
  "sign in" instead of "sign up") and BOTH must resolve to the same outcome for the
  same underlying case — this took multiple rounds to get right (see `CLAUDE.md`
  2026-09-26c/d, 2026-09-27c/d for the exact failure modes already hit and fixed).
- Specific, human error messages (not Supabase's raw ones): "No account found with
  this email" / "Wrong password" / bad-format / offline / rate-limited /
  "already registered" / weak password — backed by a `public.email_exists(email)`
  RPC (a deliberate, product-approved account-enumeration trade-off — flagged, not
  hidden, in the migration file).
- Forgot-password is a real 2-state flow (form → "reset link sent" with a 60s
  resend timer), not a single inline message.
- `deleteAccount()` calls a `delete_my_account()` Postgres RPC that walks every
  public table with a `user_id` column and deletes the caller's rows, then deletes
  the `auth.users` row itself — this used to only delete the `profiles` row and
  silently leave everything else behind; that was a real, shipped bug, fixed once
  discovered during an audit. **Port the "delete literally everything" intent, not
  just the one table it started as.**

### 4.6 Free/scripted persona chat (Practice tab)

Practice chat replies are **NOT live AI** — they cycle through a fixed
`REPLIES[difficulty]` array of canned lines per difficulty (easy/medium/hard),
picked by a rotating index, with a timed typing-indicator delay before each one
appears (delay differs for "Instant" vs "Realistic" pace mode). This is
deliberately separate from AI Coach (which IS live DeepSeek) and from Scan (also
live DeepSeek) — don't conflate the three when planning the AI-integration piece
of the rewrite; only 2 of the 3 conversational surfaces are real AI.

### 4.7 Data collection / consent (built over 2026-09-26/27, all documented in `CLAUDE.md`)

- **`consent_records`** (Postgres, append-only): every consent decision, whenever
  made, with a policy version stamp. Consent given before an account exists
  (onboarding's terms checkbox) is queued in `localStorage` and flushed the moment
  a session appears.
- **`scan_replies`** (was `generated_replies`): the AI-generated reply text + tone +
  input source (text/screenshot) + a 👍/👎 "did it help" outcome — never the user's
  pasted input.
- **Practice-chat sharing ("Help Zelo get smarter")**: opt-in, asked once via a
  modal on the first practice chat. Session METADATA (`practice_sessions`: persona,
  difficulty, times, message count, finished/abandoned) is always saved. Chat TEXT
  (`practice_messages`) is only saved if opted in — enforced server-side by RLS, not
  just client-side. Opting out **deletes previously-shared text** via a Postgres
  trigger (can't be skipped by a failed client call). 90-day retention on both
  `scan_replies` and `practice_messages` via `pg_cron`.
- **Reply feedback** ("How did your reply land?" 👍/👎): asked ~15 minutes after the
  user decides to save-or-not-save a scan (not after "Use this reply" — that was
  tried first and rejected as too rare a trigger). Delivered as one local
  notification per day max (only if permission was already granted elsewhere —
  never prompts for it itself) with an in-app fallback card.
- **AI cost/reliability log** (`ai_usage_log`, was `ai_requests`): model, token
  counts, latency, pass/fail + a coarse error category — never a prompt or a reply.
- **Onboarding answers** upload once signed in (see §3's onboarding table for which
  fields; "attracted to" is deliberately withheld pending a proper consent screen).
- **Analytics consent screen**: drafted, not yet built/approved as of this writing
  — analytics currently runs by default with no opt-in screen. Flag this to
  whoever picks this up; it's a real compliance gap, not a design choice.

---

## 5. Backend: Supabase schema + Edge Functions

Full DDL lives in `supabase/migrations/*.sql` (10 files, chronological, each
individually idempotent) — read those directly for exact columns/RLS policies
rather than trusting a paraphrase here. Current table names (as of the last
migration, `20260927200000`):

| Table | Purpose | Written by |
|---|---|---|
| `profiles` | display name + age, keyed by `auth.users.id` | client, on signup/onboarding |
| `scan_replies` | AI reply text, tone, source, 👍/👎 outcome | client, on every real scan |
| `onboarding_responses` | onboarding Q&A (gender/source/overthink/help/tone) | client, on sign-in |
| `consent_records` | append-only consent audit trail | client |
| `practice_sessions` | practice chat metadata (always) | client, on chat exit/background |
| `practice_messages` | practice chat TEXT (opt-in only) | client, gated by RLS on latest consent |
| `ai_usage_log` | AI cost/reliability, no content | client, wrapping every AI call |
| `referrals`, `content_reports`, `account_deletions` | built, RLS'd, **not yet wired to any UI** | — |
| `api_rate_limits` | per-user/per-fn rate limiting for the Edge Functions | service_role only, via `increment_rate_limit()` RPC |
| `legacy_unused_matches`, `legacy_unused_messages`, `legacy_unused_scans`, `legacy_unused_threads` | pre-existing, never used by this app, kept only so nothing is silently deleted | — (empty) |

Every table has RLS on, `auth.uid() = user_id` policies, and anon has no grants at
all — reads/writes only work for a signed-in user, on their own rows.

**Edge Functions** (`supabase/functions/deepseek-proxy`, `openai-proxy`, Deno):
proxy DeepSeek/OpenAI so API keys never ship to the client. Both enforce (a) a real
signed-in user (`requireUser()` — a bare anon key is rejected), (b) a per-user
hourly rate limit via `increment_rate_limit()`, (c) only the exact fields the
client is expected to send are forwarded (no arbitrary passthrough to a paid
third-party API). **Port this security model as-is** — it replaced an earlier,
genuinely vulnerable version that forwarded the whole client body with no auth
check at all (see the comment block at the top of `deepseek-proxy/index.ts`).

---

## 6. Analytics: PostHog

Native iOS SDK via `@capawesome/capacitor-posthog`. Autocapture and session replay
are OFF (verified against the SDK's actual config, not assumed). Every event is
hard allow-listed client-side in `services/analytics.js` — an event not on the list
is silently dropped, and every property on an allowed event is checked against a
per-event allow-list of keys, restricted to numbers/booleans/short strings.
**No content ever leaves the device** — verified with canary-string testing (private
text planted in prompts/replies/error messages never showed up in a captured
event). No `identify()` call — PostHog's own anonymous ID only, pending the
analytics-consent screen (§4.7) before any user-linking happens.

Full current event list: `step_completed`, `step_abandoned`, `onboarding_finished`,
`scan_started`, `scan_completed`, `tone_selected`, `reply_regenerated`,
`persona_selected`, `practice_session_started`, `practice_session_ended`,
`xp_earned`, `level_up`, `paywall_viewed`, `restore_purchase_tapped`, `ad_watched`,
`referral_link_shared`, `app_opened`, `app_backgrounded`, `session_length`,
`ai_request`, `reply_feedback`, `app_error`. (Several agreed events —
`reply_favorited`, `streak_incremented`, `trial_started`, `subscription_started`,
etc. — are allow-listed but not wired, because the underlying feature doesn't
exist yet; see §12.)

---

## 7. Known bugs / edge cases that must NOT regress

This is a curated top set. **`CLAUDE.md`'s Case Log has the full, much longer list**
— every entry there was a real user-reported bug that took ≥1 wasted round to fix
correctly the first time, with the wrong turn(s) taken and the actual root cause.
Read it before assuming any of these categories "should just work" in Expo.

1. **Swipe/drag "instant" or "frozen" bugs are almost always one of these four
   causes**, in this order of likelihood: (a) something left `transition: none` set
   and never re-armed a real transition; (b) a `transitionend`/`animationend`
   listener didn't filter `event.target`/`propertyName`, and a shorter transition
   on a *descendant* satisfied it early (these events bubble); (c) a fast/extreme
   input made the animation's start value already equal its end value before the
   code even ran, so nothing was left to interpolate; (d) the transition-enable and
   the value-change landed in the same paint with no forced reflow between them.
   In Reanimated terms: watch for the equivalent race — starting a `withTiming`/
   `withSpring` from a value that a fast gesture has already reached.
2. **A fast, real flick must not look instant.** The card deck's drag position is
   deliberately speed-capped via exponential smoothing (§9) so a fast flick can't
   outrun the fly-off animation's own fixed travel distance — without this, a fast
   swipe visually "teleports" before the animation the code triggers even starts.
3. **Reparenting/position-changing a scrolled element resets its scroll position**
   (confirmed on real WebKit, not reproducible in a plain browser dev server) — any
   screen-transition mechanism that moves scrolled content between containers
   (a shared "drag track" for swipe-back, in the current app) must explicitly
   capture and restore `scrollTop`/`scrollLeft` for the element AND every scrolled
   descendant, not just the one element the bug was first noticed on.
4. **A CSS entrance animation starting an element at `opacity:0`/heavily
   transformed can silently pause `autoplay` video inside it** — if a screen has
   both, explicitly re-trigger playback (`currentTime = 0; .play()`) when the step
   becomes active rather than trusting the attribute.
5. **First-launch flash-of-unstyled-content is a parse-timing race, not a logic
   bug**, whenever a default-visible element sits (in document order) before the
   JS that's supposed to hide it — the fix pattern here was a plain CSS rule in
   `<head>` (`html:not(.app-ready) #app { visibility: hidden }`) flipped by the
   very first line of app init, so nothing can paint before JS has decided what to
   show, regardless of how slowly the rest of the document parses.
6. **Any 100+ image asset list needs lazy-loading discipline, but naively lazy-
   loading EVERYTHING breaks a hero image with a choreographed entrance
   animation** — the one asset ~100% of sessions see within the first few seconds
   should stay eager; only genuinely optional/rarely-visited screens should defer.
7. **Edge-swipe-back must know whether committing will actually navigate.** On
   Scan Result specifically, leaving before the scan is saved/skipped shows a
   "Save this scan?" prompt instead of navigating — the gesture's "no reveal
   target" branch must settle back to rest, not fly the screen fully off and snap
   back, when the commit isn't actually going to leave.
8. **The two-part dark-mode pattern must always be copied as a matched pair.** Every
   dark-mode override in this codebase is `@media (prefers-color-scheme: dark) {
   :root:not([data-theme="light"]) SEL {...} }` PLUS a separate, unconditional
   `:root[data-theme="dark"] SEL {...}` outside any media query (for the in-app
   explicit override, independent of OS setting). Writing only one half is a
   real, repeated bug (a stray bare `:root:not([data-theme="light"])` selector
   with no media-query wrapper matches almost always, leaking dark styling into
   light mode). In Expo this becomes a themed-styles/Appearance-API concern, but
   the underlying requirement — every themed value must be verified in BOTH
   effective modes, not just the one being actively tested — is the same.
9. **Tone/reply-style eligibility (§4.3) has a hard safety rule enforced in code**,
   not just a data table — Funny/Bolder must never reach the user during an
   Argument or Toxic Relationship situation, regardless of what Goal was picked.
   This must be a code-level filter in the rewrite too, not something that could
   silently regress if the eligibility table is ever edited without re-reading the
   filter logic.
10. **`AUTH` (the auth module) is a top-level `const`, never `window.AUTH`** — a
    stray `window.AUTH && …` guard anywhere is always falsy and silently no-ops.
    Not directly portable advice for Expo, but the underlying lesson — verify a
    module-existence guard against how the module is ACTUALLY exposed, don't
    assume — is worth restating for whatever module system Expo ends up using.
11. **A locked/paywalled state must reset which tab is "active" before showing the
    paywall**, or `closePaywall() → popScreen() → showTab(activeTab)` loops the
    user right back into another paywall (since `activeTab` was never Scan/Home,
    the one tab that's always allowed).

---

## 8. Animations catalog

32 named `@keyframes` in `style.css` plus JS-driven transitions (spring easing via
inline `style.transition` strings, computed per-interaction rather than fixed CSS
classes in several places — card fly-off, sheet drag-to-close, etc.). Full list
with exact timing/easing:

**Onboarding:**
- `cineP1Morph` 0.62s ease — word-morph text swap (Confidence/Connection/Conversations)
- `cineP1LogoIn` 0.6s `cubic-bezier(0.34,1.56,0.64,1)` — logo pop-in
- `cineP1SparkIn` 0.6s same easing, 0.28s delay — sparkle accent
- `cinePhoneFly` 10.35s `cubic-bezier(0.45,0,0.15,1)` infinite — showcase phone drift
- `cineTrialPhoneFlyIn` 1.5s `cubic-bezier(0.45,0,0.15,1)` — trial-start phone fly-in
- `sysPromptHandBob` 1.1s ease-in-out infinite — "tap here" hand cue
- `ptwWave` 2.4s ease-in-out infinite

**Swipe deck / cards** (see §9 for the JS drag mechanics these complement):
- Fly-off (JS, not a keyframe): 0.7s `cubic-bezier(0.4,0,0.2,1)` — "material
  standard" curve, deliberately weightier than a simple ease-out
- Spring-back (JS): 0.45s `cubic-bezier(0.175,0.885,0.32,1.275)` — overshoot bounce
- `cardDotPulse` 1s ease-in-out infinite — loading dots on generating cards
- `matchFadeUp`/`matchSlideIn`/`matchPop` 0.4–0.5s, several with the same
  `cubic-bezier(0.34,1.56,0.64,1)` overshoot bounce — "It's a Match!" reveal

**Sheets/modals:**
- `modalPop` 0.22–0.24s `cubic-bezier(0.175,0.885,0.32,1.275)`
- `yrSheetUp` 0.32s `cubic-bezier(0.22,0.9,0.3,1)` — Change Tone / thread-link sheets
- `prPop` 0.3s `cubic-bezier(0.22,0.9,0.3,1)` — the practice-review consent modal
- `yrBubblePop` 0.34s `cubic-bezier(0.2,0.9,0.3,1.25)` — a message bubble popping
  into the conversation card
- Generic drag-to-close sheets (Link a Thread, Change Tone, AI Coach): live 1:1
  finger-follow while dragging (`transition:none`), a spring settle
  (`cubic-bezier(0.175,0.885,0.32,1.275)`, ~0.3s) on release below threshold

**Notifications/banners** (one shared visual language — streak, XP, level-up, the
generic limit-toast, the terms warning — all normalized to the same fixed-top,
16px-inset, 20px-radius card):
- `streakNotifNumIn`/`Out` 0.45s, asymmetric bezier per direction
  (`cubic-bezier(0,0.55,0.45,1)` in / `cubic-bezier(0.55,0,1,0.45)` out)
- `xpConfettiFall` 0.9–1.1s ease-in, staggered 0–0.18s per piece
- Hide timers: 340ms (tuned up from an original 220ms specifically to outlast the
  slide-out — don't regress this to a shorter value without re-checking the visual)

**Misc:** `inputCardShake`/`lockedShake` 0.26–0.35s ease (invalid-input feedback),
`aicoachStatusPulse` 1.8s, `sparklePulse` 1.3s, `typeBounce` 1.3s infinite (typing
indicator), `dd-spin` 0.9s linear infinite (Download-My-Data spinner),
`paywallCheckmarkPop` 0.14s / `paywallYearlyBounce` 0.55s (both
`cubic-bezier(0.34,1.56,0.64,1)`).

**Standard "instant, no visible motion" pattern used throughout** when a change
must NOT animate: set `transition: none`, make the change, force a reflow
(`void el.offsetHeight`), then re-arm the normal transition on the next frame.
Skipping the forced reflow is a real, recurring bug (the transition can still
apply to the very change you just made).

---

## 9. Swipe deck mechanics (Practice tab)

```
SWIPE_THRESHOLD = 90        // px from center to commit
MAX_ROTATION    = 15        // degrees of tilt while dragging
DRAG_FOLLOW_RESISTANCE = 0.8 // visible position = 80% of raw finger delta
TAP_MAX_MOVEMENT = 6        // px — below this, a release is a tap not a drag
```

- **Rendered position lags the raw finger delta via exponential smoothing** (0.3
  factor per frame, via `requestAnimationFrame`) — this is deliberate, not a
  performance shortcut: a fast/long real flick could otherwise carry the visible
  card past its fly-off target before the fly-off animation even starts, reading
  as "the swipe is instant." Rotation and the LIKE/NOPE stamp opacity + the two
  back-card peek transforms all track the RAW (unsmoothed) delta instead, so how
  quickly a drag counts toward the threshold doesn't change — only how fast the
  card visually travels once moving is capped.
- Back-card stack (2 visible cards behind the top one) scale/translate/fade based
  on `absRatio = min(1, |delta| / SWIPE_THRESHOLD)` — card 1: scale 0.95→1.0,
  translateY 10→0, opacity 0.75→1.0; card 2: scale 0.90→0.95, translateY 20→10,
  opacity 0.5→0.75.
- On commit: `commitSwipe(cardEl, direction)` — fly-off to `±1.6× viewport width`,
  rotate `±30°`, then either the next card or (right-swipe) the match reveal. A
  light haptic (`navigator.vibrate(10)` + native haptic) fires on a right-swipe
  commit only, not left.
- **Practice tutorial** (first-visit-only 3-step guided walkthrough: swipe right,
  swipe left, photo-nav) runs on the REAL deck (`initSwipeDeck({fresh:true,
  ignoreSkipped:true})` — it must always get the full profile pool regardless of
  how many the user has actually skipped before, or it can silently end early once
  fewer than 3 cards remain).
- Deck pool: `data.js`'s fixed `PROFILES` array (10 real personas + a
  `TEST_LAYOUT_PROFILES` placeholder set used when practice-mode is `men`/`both`,
  since no real male personas exist yet), reshuffled once exhausted. A separate
  `skippedProfileIds` set (Skipped Profiles feature) filters the pool unless
  explicitly bypassed. Age-range preference maps onto profile pools via
  `AGE_RANGE_TO_POOLS` (a best-effort, non-1:1 mapping between onboarding's 4 age
  pills and the profiles' own 3 age buckets).
- **Scan Result's carousel is a different mechanic** — native CSS scroll-snap
  (horizontal), not a custom drag. Don't conflate the two when planning gesture
  work; only the Practice deck needs hand-rolled pan-gesture physics.

---

## 10. Data model: localStorage key catalog

Every key the app currently persists client-side (this is the full grep — nothing
paraphrased). Each needs an equivalent (AsyncStorage/SecureStore/MMKV, per
sensitivity) in the Expo rewrite, or an explicit decision that it's obsolete:

```
chat_muted_{id}            zelo_ad_used_today          zelo_age_filter_max
zelo_age_filter_min        zelo_age_filter_strict      zelo_age_range
zelo_ai_coach_thread       zelo_att_status             zelo_birthdate
zelo_deleted_matches       zelo_dev_subscription       zelo_display_name
zelo_do_not_sell           zelo_gib_reports            zelo_history_retention_days
zelo_match_count           zelo_match_slots            zelo_mode_selected
zelo_notif_permission      zelo_offer_shown            zelo_onb_{field}
zelo_onb_referral          zelo_onboarding_done        zelo_practice_mode
zelo_practice_review       zelo_practice_review_asked  zelo_profile_photo
zelo_referral_code         zelo_scan_count             zelo_scan_date
zelo_scan_exhausted        zelo_scans                  zelo_settings_difficulty
zelo_settings_help_with    zelo_settings_tone          zelo_settings_topics
zelo_setup_done            zelo_thread_count           zelo_threads
zelo_trial_start           zelo_user_age               zelo_xp
zelo_xp_daily
```

Plus two dedicated queue keys for offline-safe consent/data upload (`records.js`):
`zelo_pending_consents`, `zelo_pending_onboarding` — both are flushed to Supabase
the moment a session exists, and both are designed so a retry after a lost
response can never double-write (client-generated UUIDs + `upsert(...,
{ignoreDuplicates:true})`, or a simple "does the local snapshot still match what
was just sent" check). **Port this offline-queue pattern**, not just the fact that
these two things eventually get uploaded — the retry-safety is the actual design
requirement, not a nice-to-have.

`zelo_threads` and `zelo_scans` (History's thread/scan storage) and `chatStore`
(practice chat message history) are **entirely local, never synced to Supabase** —
see §12, this is a real product gap (no cross-device sync for chat history) that
predates this migration and isn't something the Expo rewrite needs to silently
"fix" unless asked to.

---

## 11. Dev/test flags currently live (must be resolved before a real release)

These are real, currently-active switches in `script.js` — check each one's
current value before assuming production behavior, and decide explicitly whether
each survives into the Expo build or gets removed:

- `SHOW_BUILD_STAMP` — shows the build name (and, temporarily, live DB-write
  status) at the bottom of every screen.
- `SUPPRESS_XP_LEVEL_NOTIFS` — currently `true`, XP/level-up popups are globally
  off.
- `DEV_AUTO_SIGN_IN` — attempts a silent sign-in on launch (falls back to
  anonymous, which is disabled on this Supabase project, so currently a no-op
  unless `dev-credentials.js` — gitignored — is filled in).
- `DEV_ALWAYS_SHOW_PRACTICE_REVIEW` — makes the once-only "Help Zelo get smarter"
  modal show every time, for UI review. Currently `false`.
- `DEV_ONBOARDING_SIGNIN_STAYS` — front-of-onboarding "Sign in" currently stays in
  onboarding instead of entering the app, specifically so real accounts can be
  created/tested without leaving Xcode. **This actively reverses the intended
  "sign in → enter the app" product behavior while true** — currently `true`.
- `DEV_SHOW_SUBSCRIPTION_SWITCH` / `zelo_dev_subscription` — a manual toggle
  (Settings → Zelo Pro) to simulate an expired subscription, since there's no real
  purchase system yet to trigger it for real.
- `FORCE_DEMO_SCAN_FOR_RECORDING`, `FORCE_SCAN_ERROR_CARD`, `FORCE_NO_CONNECTION_SCREEN`,
  `SUPPRESS_GIBBERISH_CHECK` — screen-recording/QA aids, all should be `false` for
  a real build.
- A DOMContentLoaded block wipes several onboarding-related localStorage keys on
  every load (dev convenience, so onboarding always "looks fresh") — this
  deliberately makes the dev build behave differently from what a real installed
  app would do; don't extrapolate real-user behavior from dev-build testing
  without accounting for this.

---

## 12. Things that are NOT real yet (don't invent logic for these)

- **Streak mechanic** — UI/animations exist, no increment logic exists anywhere (§4.2).
- **Purchases/subscriptions** — `isPaidUser()` hard-coded `true`; no StoreKit, no
  RevenueCat, no server-side entitlement. The onboarding trial UI and the locked-
  app screen are both fully built but neither is wired to a real purchase.
  (RevenueCat integration was being prepared separately as of this writing —
  check current status before assuming it's still not started.)
- **Cross-device data sync** — Threads/Scans (History) and practice chat message
  history (`chatStore`) are local-only; nothing round-trips them through Supabase.
  Only metadata (via `practice_sessions`/`scan_replies`) reaches the server.
- **Referrals, content reports** — tables exist with real RLS, nothing in the UI
  writes to them yet.
- **Analytics consent screen** — analytics runs by default today; a consent-first
  version was drafted, not approved/built as of this writing.
- **Email delivery for Download My Data** — the full 5-state UI flow is built and
  wired; no email is actually sent (there's no backend function for it yet — the
  "preparing" step is a simulated delay).
- **Real streak/badge progress** — every milestone badge in `data.js` starts (and
  stays) at `progress: 0`; the "Zelo Legend" dynamic badge is defined as "unlocked
  once every other badge is" but nothing else ever becomes unlocked to trigger it.

---

## 13. Addendum (2026-09-29) — visual-fidelity gaps found once the Expo build was
running, and one real omission in this spec's own §7/§8

A separate Claude Code session has been doing Phases 2–6 against this spec, working
directly in the Expo project (not this one — I don't have that project's path or
have touched its code). Comparing a real screenshot of the Expo Scan/Home screen
against the Capacitor original surfaced several concrete, fixable gaps — some are
things this spec under-specified, one is a real miss on my part. Exact values below
so the fix is a measurement, not a re-guess.

### 13.1 Card styling: border → shadow, never both (this spec never said this — it should have)

**Every card/row surface in this app uses `box-shadow`, never a visible `border`.**
This is a deliberate, repeated convention (`CLAUDE.md` 2026-09-25f/g/r), not an
oversight, and I missed stating it plainly in §7/§8 above — that's very likely why
the Expo screenshot shows visible grey outlines ("the grey lines") the Capacitor
original doesn't have.

```css
/* The ONE pattern, used everywhere — .settings2-card, .input-card, .dash-stat,
   .journey-stats-card, .mission-level-card, non-active .lb-cat-card, etc.: */
background: var(--s1);           /* light: #ffffff · dark: #201c17 */
border: none;                     /* or omit border entirely */
box-shadow: 0 1px 6px rgba(28, 25, 23, 0.06);
border-radius: var(--r-lg);       /* 20px — the app's standard card radius */
```
In React Native terms: this is `shadowColor/shadowOffset/shadowOpacity/shadowRadius`
(iOS) + `elevation` (Android, if this ever ships there) — a genuine shadow, not a
1px border approximation. A `borderWidth: 1` outline is the visibly-wrong result if
this gets ported as "add a border for definition" instead.

**Deliberate exceptions — these DO keep a real, visible border, don't strip them:**
active/selected states that need to color in without a 1px size jump (keep
`border: 1px solid transparent` at rest, e.g. `.lb-cat-card.active`, `.yr-tone`,
focused inputs), the accent-pink "my rank" bar, XP pills, and a short list of
dark-mode-only card outlines on imagery/dark-on-dark surfaces where a shadow alone
is genuinely invisible (`.journey-progress-card`, `.lb-settings-panel`, a couple of
headers) — see `CLAUDE.md` 2026-09-25r for the exact list.

**Radius tokens:** `--r-sm: 8px`, `--r-md: 14px`, `--r-lg: 20px` (the default for
cards). The Home widget carousel cards specifically use `34px` (a deliberate local
bump, not the shared `--r-lg`).

### 13.2 Exact sizes/shapes for the elements called out as wrong

| Element | Exact spec |
|---|---|
| Bottom nav "Scan" circle (the raised pink FAB) | `58×58px` circle, `border-radius: 50%`, `4px solid #ffffff` outer ring, floats `-34px` above the tab bar's top edge (i.e. it overlaps upward, docked-FAB look), `box-shadow: 0 8px 24px rgba(236,72,153,0.45), 0 2px 8px rgba(0,0,0,0.2)` |
| "Get Suggestions" button | **A full pill, not a rounded rectangle** — `border-radius: 999px`, `padding: 10px 18px`, gradient background `linear-gradient(135deg, #FF4FA0, #EC4899)`, white text, a small 14×14 sparkle icon after the label |
| "Upload Screenshot" row | Plain text + icon, `border-radius: var(--r-sm)` (8px) — genuinely closer to squared than the Get Suggestions pill, but still an 8px radius, not 0 |
| AI Coach card's gem icon (Home screen) | `56×56px` circle, `#FFE1F0` background (pink tint), the real 3D gem icon inset — was previously tuned UP from 40px specifically because 40px "read as small/undersized" next to its title+subtitle text; don't let the Expo port regress back to a small icon here |
| Home widget carousel cards | Fixed `170px` tall, `34px` border-radius, `background: var(--s1)`, no visible border (§13.1) — if Expo's version reads smaller/plainer, check both the fixed height and that the real cropped illustration assets are being used at their real size, not a placeholder/shrunk substitute |
| App icon (launch/home-screen icon) | Confirmed real asset: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024-new.png` (the 1024px master) — point Expo's `app.json` `icon`/`ios.icon` field straight at this same file (copy it into the Expo project's `assets/` folder) rather than re-exporting from a different source. |
| Launch/loading screen icon | Real asset + exact spec already exists: `ios/App/App/Assets.xcassets/LaunchIcon.imageset` (`launch-icon@1x/2x/3x.png`), squircle-masked with alpha, centered, **120pt wide**, on `LaunchBackground` color (`#ffffff` light / `#15130f` dark — i.e. the app's own `--bg` token, so there's no color jump at handoff). Full native launch-screen work is documented in `CLAUDE.md` 2026-09-24c. |

### 13.3 "Badly cropped… white curvature" in Settings icons — likely cause, and the fix

Several of this app's icons (Settings row icons especially) were cropped as **plain
opaque crops with no alpha channel**, deliberately, because the source reference art
already sat on a background that matched the app's own light-mode page background
almost exactly (`#ffffff` / near-white) — see `CLAUDE.md`'s "Chats-tab empty state"
entry for the exact reasoning: a flood-fill/alpha-transparency approach was tried
first and produced worse artifacts (a noisy hole through a near-white highlight)
than just leaving the crop fully opaque, since an opaque near-white square sitting
on a genuinely `#ffffff` page has no visible edge either way.

**This only works if the surface the icon sits on in Expo is the exact same
`#ffffff`/`#15130f` as the source PNG's own background.** If Expo's icon container
uses a slightly different white (an off-white token, a themed surface color, a
default RN `View` background, antialiasing against a non-pure-white parent, etc.),
the crop's own flat background square becomes visible as a faint square/curved edge
— almost certainly the "white curvature" being seen. **Fix path:** either (a) make
the icon's containing surface exactly `#ffffff` in light mode, matching the source
crop, or (b) if that's not practical, re-crop the specific icon(s) in question with
real alpha transparency instead of an opaque background (the *original* source
image is needed to redo this — not the already-opaque-cropped PNG, which has no
alpha data left to recover). Given real device screenshots are what actually
surfaces this (not a Simulator/preview render — see `CLAUDE.md`'s several
"off-center once actually installed" entries), verify any re-crop on-device, not
just in a Storybook-style preview.

### 13.4 "Get rid of all the one-time-seeing things… give me full access every time,
temporarily" — a dev-bypass pattern to add, not a product change

This Capacitor app has exactly this kind of testing aid already, several times over
(see §11): a `DOMContentLoaded` block that wipes onboarding-related keys on every
load, `DEV_AUTO_SIGN_IN`, `DEV_ALWAYS_SHOW_PRACTICE_REVIEW`, etc. — all clearly
name-flagged as dev-only and explicitly called out as things to resolve/remove
before a real release (§11's whole point). The Expo session should add an
equivalent, equally explicit flag (e.g. `__DEV_SKIP_ONBOARDING__`, gated on `__DEV__`
so it can never ship in a release build) rather than deleting/disabling the
onboarding gate outright — the gate itself is real product behavior (§2's locked-
app routing depends on the same kind of gating concept) and must still exist,
correctly, for the actual release.

### 13.5 Status note — what the separate Expo-migration session has reported so far

*(Relayed from that session's own summaries as pasted into this conversation — I
have not independently verified any of this by reading the Expo project myself,
and the transcript I was given was cut off mid-session, so I don't know its final
outcome. Treat this as "what was reported," not "what I confirmed.")*

- Phase 3 services + Phase 4 initial screens reportedly ported and passing
  `tsc --noEmit`.
- A real tooling bug was reportedly found: `npx expo lint` was silently linting
  **zero files** (likely because this is a plain React Navigation app, not an
  Expo Router `app/`-directory project, so `expo lint`'s default file-matching
  found nothing) — `eslint .` directly, against the project's own
  `eslint.config.js`, found 16 real errors + 20 warnings that a "clean" `expo lint`
  run had been hiding. **If true, `package.json`'s `lint` script should point at
  `eslint .`, not `expo lint`, going forward** — worth confirming directly rather
  than trusting a green CI check on this project.
- Bundle ID: reportedly kept as `com.zelo.app` (this repo's Capacitor app ships as
  `com.ozlilbrother.zelo` — a deliberate, known mismatch per that session, not
  something for me to reconcile from this side).
- Reported as ported: the native launch/splash screen (per §13.2's spec above),
  the camera permission removed from the image picker config (nothing in the app
  uses the camera — only the photo library), and the app-level "no connection"
  screen (this repo's real one — see the launch-connectivity-gate work referenced
  throughout `CLAUDE.md`'s Case Log).
- Table names: that session ran its own read-only existence probe against the live
  Supabase project and reported all Expo-side table references matching the
  current live names in §5 above (`scan_replies`, `practice_sessions`,
  `practice_messages`, etc.) — consistent with this repo's own migration history,
  and consistent with the direct database read I did on 2026-09-27 (see this
  repo's own case log / the earlier part of this conversation).
- Two items were reportedly deferred, matching §12 above: locked/expired-
  subscription routing (real purchases don't exist yet, so there's nothing real to
  gate) and streak-related logic (§4.2 — nothing to port, because nothing real
  exists here either).

---

## 14. Addendum (2026-09-30) — real on-device punch list, first full walkthrough
of the Expo build (Release, on a physical iPhone, `com.ozlilbrother.zeloexpo`)

Written from the user's own on-device testing notes, verbatim observations kept
so nothing gets lost. Self-assessed as "better than before, 1 point, not much" —
i.e. still far from parity. Explicit direction: **fix page by page from here**,
not everything at once. Grouped by screen; each item still needs a real
side-by-side against the live Capacitor app (real screenshots — see the note
at the end about NOT reusing old raw source PNGs for re-crops).

### 14.1 Onboarding
- [x] Onboarding could only be seen once (persisted `zelo_onboarding_done`);
  needed every-launch reset for repeat testing. **Fixed** (this session):
  `App.tsx`'s `__DEV_SKIP_ONBOARDING__` flag (added by the Expo session,
  gated on `__DEV__` — dead on a Release build, which is why it never did
  anything on-device) replaced with `__DEV_RESET_ONBOARDING__`, a plain
  boolean (not `__DEV__`-gated, so it works in the Release build actually
  being tested) that calls a new `resetOnboarding()` (`services/onboarding.ts`)
  before every launch's `isOnboardingDone()` check. Flip to `false` before a
  real release — flagged the same way as this repo's own `DEV_*` flags.
- [x] **Measured** (not yet applied in Expo): the X/skip button on onboarding
  page 1 — real class `.cine-showcase-skip`, real position `x:370, y:14, w:30,
  h:30`, `color: rgba(28,25,23,.45)`, `bg: rgba(28,25,23,.08)` — see
  `EXPO_SIZES_SPEC.md`'s onboarding section. It sits only 14px from the very
  top (above where normal step content starts), which may be exactly why it
  reads as "too high" if Expo placed it using the same top offset as other
  steps' content instead of this step's own near-top-edge position.
- [x] **Measured** (not yet applied): the "Notifications" step (step 11,
  `.cine-sysprompt`) is a DELIBERATE stylized mockup of iOS's native
  permission dialog, not a bug — but its real dimensions/colors are now in
  `EXPO_SIZES_SPEC.md` (340×152 card, `20px` radius, `#f3ede4` background,
  two pill buttons at `99px` radius). If Expo's version still "reads as a
  hand-built mockup," compare against these exact values rather than the
  general look.
- [ ] "When were you born" date step shows the **Thai/Buddhist calendar**
  instead of Gregorian/English (e.g. showing 2569 instead of 2026) — this is
  `@react-native-community/datetimepicker` picking up the device's regional
  calendar. Fix: force the picker's locale (e.g. `locale="en-US"` /
  `android.calendar` prop, whichever this library's current API exposes) so
  it's not implicitly following system region — same class of bug as the
  Capacitor app's own iOS-native-picker dark-mode fix in `CLAUDE.md`
  ("native plugin call 'looking right' for one piece doesn't mean the whole
  dialog is themed" — same lesson: a native picker's *locale* is a separate
  explicit option too, not something that follows from the rest of the app).
- [ ] AI Coach / gem icon "not big enough yet" (recurring complaint — see
  §13.2, which already gives the exact fix: **56×56px circle, `#FFE1F0`
  background**, real 3D gem icon inset). If it's still small after that spec
  was supposedly applied, the Expo side likely never actually picked up
  §13.2's number — worth a direct measurement on-device, not just re-reading
  the prop value in code.

### 14.2 Scan (Home) screen
- [x] **Measured** (not yet applied): the real target for the "1.5 of 3 vs
  2.8 of 3" scale bug is a concrete number now, not a vague ratio — the Scan
  tab's real content (header through end of the AI Coach banner) is exactly
  **690px tall inside an 896px viewport** (`scrollHeight === clientHeight`,
  no scroll needed) — content should fill **~77%** of screen height. Cross-
  check Expo's version against the per-element `y` values in
  `EXPO_SIZES_SPEC.md`'s Scan/Home section rather than applying one global
  scale multiplier — a single compressed margin/padding somewhere in the
  stack is more likely than a uniform scale error.
- [x] **Measured** (not yet applied): the "Zelo" wordmark is a SEPARATE child
  (`.scan-page-brand`) from the header container, already real size/color in
  source — **33.6px, weight 800, `rgb(236,72,153)` (pink)** — plus a
  `.scan-spark` accent icon (18×18, same pink) right next to it. If Expo's
  version is small/default-colored, it likely styled the header CONTAINER
  text instead of this specific child — see `EXPO_SIZES_SPEC.md`'s corrected
  "header" table for the full breakdown (avatar, wordmark, spark, streak
  pill, history button, all with real x/y/w/h now).
- [x] **Measured** (not yet applied): widget carousel's gap above it is
  exactly **18px** from the header's bottom edge (header bottom y:108,
  carousel top y:126). If Expo's gap is bigger than that, that's the "sits
  lower" bug — likely the same root cause as the 690px scale fact above, not
  a separate issue.
- [ ] "Upload Screenshot" row text/icon reads **thin** in Expo vs. **bold**
  in Capacitor — needs a real font-weight bump (§13.2 gives this row's shape
  — plain text + icon, 8px radius — but not its weight; measure the real
  Capacitor row's `font-weight` value directly rather than guessing).
- [ ] Bottom tab bar reads smaller than Capacitor's — needs to be bigger
  overall (height/icon/label scale), not just the raised Scan FAB (which
  §13.2 already fully specs at 58×58px/4px ring/-34px float — that part may
  already be correct; it's the *rest* of the tab bar that's undersized).

### 14.3 Practice
- [ ] Tapping into Practice mode shows the **onboarding practice-tutorial
  screen's content** instead of the real practice/swipe-deck screen with the
  "wave hand" first card — this reads like a routing bug (tutorial-mode
  taking over where the real deck should render), not a styling issue.
  `screens/practice/PracticeTutorial.tsx` has a preserved
  `DEV_START_STEP = 'edit-details'` TEMP override from the original source
  (kept verbatim per this migration's own "port what's there" rule) — check
  whether that override, or a missing "tutorial already completed" gate, is
  what's forcing tutorial mode to show unconditionally instead of falling
  through to `PracticeScreen`'s real swipe deck.

### 14.4 Chats
- [ ] First time entering the Chats tab shows an existing person/conversation
  that shouldn't be there on a fresh account ("why is there someone in my
  app") — almost certainly leftover demo/seed chat data. Find wherever a
  demo/mock thread gets created (onboarding's demo scan, a dev-seed helper,
  etc.) and make sure it's gated behind an explicit condition, not always
  inserted.

### 14.5 Chat UI (the actual practice/AI-coach conversation screen)
Called out as the single worst-fidelity area right now — "looks very bad,"
mechanics wrong, not just styling:
- [ ] The bottom-left AI Coach entry point should open **Zelo's own custom
  AI Coach sheet** (the real app's purpose-built card/sheet UI — see
  `CLAUDE.md`'s AI Coach entries, e.g. 2026-09-25b's real gem-icon sheet), not
  a generic/"traditional" modal.
- [ ] Message input box background is **grey** in Expo — the real app never
  uses grey for this (§13.1's border→shadow convention: real surfaces are
  `--s1`/`--s2` tokens with a soft shadow, never a flat grey fill/border).
  Check what background color/token the RN `TextInput`'s container is
  actually using.
- [ ] AI Coach button and the Send button both need the real **custom pink
  UI** treatment (icons + colors) — currently reading as generic/default
  controls instead of the app's own branded buttons.
- [ ] "Your Reply" / AI Coach suggestions render as **plain text, no cards**
  — Capacitor's real "Zelo Suggests" UI is a styled card (see this spec's
  own §7/§8 + `CLAUDE.md`'s many "Your Reply" entries, e.g. 2026-09-24i
  onward) with icon, tone label, shadow (§13.1), not bare text. This is
  probably the highest-value single fix in this whole list — the reply
  screen is central to the app and currently looks nothing like the source.

### 14.6 Account / Settings
- [ ] Cannot scroll down at all on the Account/Settings screen — likely a
  `ScrollView`/flex-height bug (missing `flex: 1` somewhere in the chain, or
  content wrapped in a fixed-height container) rather than a content issue.

### 14.7 Cross-cutting, applies to every page
- [ ] **Top header** (whichever screen): font color, shape, and size must
  match Capacitor's real header exactly — treat as a per-page checklist item
  wherever a header exists, not a one-time global fix (14.2 already flags
  the Scan header specifically as bigger + pink).
- [ ] **Icons generally look cropped/off** — acknowledged as possibly
  unfixable for some (source-asset limitation, see §13.3's opaque-crop
  explanation) — but **when a re-crop is genuinely needed, crop fresh from
  real screenshots of the ACTUAL Capacitor app as it renders today, not from
  the old raw source icon files** (`assets/icons/**` in this repo) — those
  raw files can predate final in-app styling/effects (glow, tint, dark-mode
  reprocessing — see `CLAUDE.md`'s several icon-reprocessing entries) and
  won't match what's actually on screen. Screenshot the live app, then crop.
- [ ] **Message box styling** must match everywhere it appears (Chat, AI
  Coach, Your Reply) — same grey-vs-real-surface issue as §14.5, likely one
  shared root cause across all three.
- [ ] **Mechanics**, not just visuals, must be accurate — several items
  above (14.3's practice routing, 14.4's phantom chat, 14.5's AI Coach entry
  point) are behavior bugs, not style bugs; don't treat this whole list as a
  pure CSS-equivalent pass.

**Working order going forward, per explicit instruction: page by page, not
all at once.** Suggested sequence (first blocking, then most-visible, then
the rest) — confirm with the user before assuming this order is final:
Onboarding (14.1) → Scan/Home (14.2) → Chat UI/Your-Reply-cards (14.5, likely
the single biggest visual-fidelity win) → Practice routing (14.3) → Chats
phantom data (14.4) → Account/Settings scroll (14.6) → cross-cutting sweep
(14.7) once individual pages are done.

---

*End of Phase 1 extraction. Next: Phase 2 (fresh Expo/TypeScript project scaffold)
— see the migration plan for the full 6-phase sequence.*
