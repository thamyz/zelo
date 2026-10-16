# Zelo Expo Port — Spec Index

Three detailed spec files live alongside this one, each covering a different concern. Read this
file first to find the right one — don't guess which file has what you need.

## The methodology (read this too, separately)

The reusable PROCESS behind all three files — how to measure a web app's real geometry with
Playwright, the mechanical rules for using those numbers without eyeballing, and the CSS→RN
mechanisms that don't translate 1:1 — is packaged as a Claude Code skill, not a file in this repo:
`web-to-rn-conversion`, in the shared `VSC/.claude/skills/` directory (so it's usable from either
this Capacitor project or the Expo project directly). Invoke it with `/web-to-rn-conversion` or let
it auto-activate when discussing a conversion/measurement task. It holds no Zelo-specific data —
only the three files below do.

## `EXPO_MIGRATION_SPEC.md` — architecture, business logic, screen inventory

Read this for: the 44-screen inventory, navigation model, business logic (XP formulas, streak
rules, tone-selection safety rules), Supabase schema, PostHog analytics scope, animations catalog
(high-level), localStorage key catalog, dev/test flags, what's NOT real yet, and the running
on-device punch list (§14) of specific reported bugs with their status.

## `EXPO_SIZES_SPEC.md` + `EXPO_SIZES_DATA.json` — static geometry & typography

Read this for: real measured `x/y/w/h/radius/font/color/background/shadow/border` for every
element on a given screen, the global type scale, corner-radius tokens, the card-surface
convention, the shared header bar, pseudo-element overlays, dark-mode color tokens, and exact
icon/glyph SVG specs. `EXPO_SIZES_DATA.json` is the full unabridged raw data behind the `.md`'s
summary tables — go there when a value got cut from a table for width.

**Coverage as of 2026-10-01:** Tab bar, Scan/Home, Practice (swipe deck + the first-visit tutorial
flow), Chat, Account dashboard, Privacy & Data, Settings > Notifications, Onboarding step 1 (+ the
skip button + the notification-permission mockup step), AI Coach sheet. Onboarding steps 2+ (~14-15
of them) are **not yet measured** — don't assume their placement is specified anywhere.

## `EXPO_INTERACTION_SPEC.md` — gestures, timers, state machines

Read this for: the CSS→RN gotcha checklist (condensed version — the skill above has the canonical
one), and full state machines for the shared/reusable mechanics: drag-tied panel+scrim close,
edge-swipe-back, the swipe deck's drag physics, the widget-carousel touch-reveal+3s-auto-hide
timer, the Practice tutorial's live-deck-reuse behavior, a toast/timer-duration catalog, and the
500ms long-press threshold used for row-action menus.

## How to use these together

1. Check the skill's mechanical rules before writing any conversion code at all.
2. Look up the screen/element's real geometry in `EXPO_SIZES_SPEC.md`.
3. Look up any gesture/timing/state-machine behavior for it in `EXPO_INTERACTION_SPEC.md`.
4. If it's not in either, it's a real gap — say so and ask for it to be measured, per the skill's
   Step 5. Don't guess.
