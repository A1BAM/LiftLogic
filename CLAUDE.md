# LiftLogic

A single-user workout tracker. React 19 + TypeScript + Vite, served by a Cloudflare
Worker that also fronts the API; workout data lives in Neon Postgres.

## Standing authorization: ship it

**Push and merge without asking.** For any work in this repository, the owner has
given blanket approval for the whole GitHub flow: commit, push, open the pull
request, and merge it once CI is green. Do not stop to ask "shall I merge?" —
that permission is already granted, here and in every future session.

The one thing that still gates a merge is CI. Wait for the checks to pass, fix
anything that goes red, and merge on green. If a change turns out to be genuinely
risky or ambiguous, say so — but say it while shipping the rest, not instead of
shipping.

**Poll the PR every 45 seconds.** This repository's checks finish in well under
a minute, and the completion webhook does not reliably arrive, so waiting on a
notification leaves a green PR sitting unmerged for minutes. After opening a
pull request, sleep 45 seconds in the background, re-read the check runs, and
repeat until the PR is merged or something goes red. Scheduled check-ins have a
one-minute floor and are too slow for this; use the background sleep.

Poll only while a pull request of yours is actually open and unmerged. Never run
a standing timer outside that window.

Practicalities:

- Work on the branch the session is assigned; open the PR against `main`.
- Open the PR as a draft, then mark it ready and merge once green.
- If the PR for the assigned branch is already merged, restart the branch from
  the latest `main` rather than stacking onto merged history.

This authorization covers GitHub. It does not extend to destructive database
work: Neon is read-only unless the owner asks otherwise, and destructive Neon
MCP tools are never invoked autonomously.

## Layout

- `liftlogic/App.tsx` — the whole UI shell: auth gate, day selection, workout view.
- `liftlogic/workoutPlan.ts` — the fixed Push/Pull running order, keyed on
  exercise IDs (never names, so renaming a lift cannot detach its history).
- `liftlogic/progression.ts` — what to put on the bar next: pure arithmetic on
  logged sets (Epley e1RM, time-off decay, loadable steps). No network, no
  model. The header comment is the spec; change the two together.
- `liftlogic/worker.ts` — the Cloudflare Worker: auth, CORS, and the `/gym-api`
  endpoints over Neon.
- `liftlogic/hooks/` — data fetching, log and exercise state.
- `liftlogic/components/` — screens and dialogs. Dialogs share the shell in
  `Modal.tsx`; `LockScreen` and `HomeScreen` are the two screens outside a
  workout.

## Checks before pushing

Run all three from `liftlogic/`:

```
npx tsc --noEmit
npm run build
npm test
```

CI runs the same thing. Dependencies are pnpm; CI installs with
`--frozen-lockfile`, so commit `pnpm-lock.yaml` whenever `package.json` changes.

## Look and feel

Warm dark, not neutral dark. The page is `ink-950`, a near-black with a little
brown in it — still dark enough for an OLED phone at 6am, but it reads as a room
with a lamp on rather than an instrument panel. A panel is one step up
(`ink-900`) with an `ink-700` hairline. No gradients, no glass, no blur, no
shadows — those were tried twice and they read as glare in a dim gym.

Text is `cream`, not white: `cream-50` for headlines and numbers, `cream-200`
for body, `cream-400` for anything secondary. `cream-600` is for rules and
disabled glyphs only, never for text.

Two faces. `font-sans` is the UI voice; `.display` (a system serif — Iowan,
Palatino, Georgia) carries the personal things: the greeting, day and lift
names, and the weight on the bar. Every face ships with the OS, so there is
nothing to download and nothing to reflow when it arrives.

- `.panel` holds content. `.well` is a field you type into.
- `.btn-primary` is `cream-50` on dark: the brightest thing the screen draws,
  so only one per screen. `.btn-quiet` is everything else.
- Two colours, each with one job. `ember` is what is happening now — the day
  the screen suggests, the progress line, the pip for the set you are on.
  `sage` is what is finished — a completed pip, a row's tick, the closing line.
- Micro-labels are uppercase and tracked at 13px; body copy is 14–16px.
  Numbers use `.nums` so columns line up.

## Feeling like an iPhone app

- Motion is `transform` and `opacity` only, defined once at the bottom of
  `index.css` (`.sheet-in`, `.pop-in`, `.backdrop-in`, `.screen-in`) and
  switched off under `prefers-reduced-motion`. There is no Tailwind animation
  plugin: an `animate-in` class does nothing.
- The back gesture must work. Anything that opens over the page — a workout
  day, a dialog — goes through `hooks/useBackToClose.ts`, so swiping back
  closes it instead of leaving the site.
- A dialog locks the page behind it (`Modal.tsx`) and keeps its own scrolling
  to itself.
- Long lists render a page at a time. The journal builds 14 days, not the
  whole history.
- `theme-color` in `index.html` must equal `ink-950`.
- Never `confirm()`, `alert()` or `prompt()`. From the Home Screen they can
  return without ever being drawn, which is how "delete does nothing"
  happened. Use `confirmDialog` / `notify` from `components/dialogs.tsx`, or
  `DeleteButton` for a row.
- Never `<input type="number">`. Safari validates it itself and put up
  "Enter a valid value" over 27.5 even with `step="any"`. Use `type="text"`
  with `inputMode` and the cleaners in `utils/number.ts`.

## Readability

This is the thing that has been got wrong twice, in both directions — once too
dim, once too bright. The rule now: **nothing dimmer than `cream-400`.**

`cream-400` (`#b9afa1`) measures around 8:1 on a panel and still reads as
clearly secondary; the step below it fails the 4.5:1 target on both the page
and a panel, which is why it is barred from text. Primary text is `cream-50`.
Never put an alpha on text.

Verify it rather than trusting it: render the screens and walk every text node,
comparing its computed colour against what is actually painted behind it. The
same pass should check that no tap target is under 44px.

## Conventions

- Comments explain *why*, not what. Match the density already in the file.
- Never skip, disable, or weaken a test to get green.
- When a change is visual, render it and look at it — a screenshot at iPhone
  width (393×852) has caught bugs that reading the code did not.
