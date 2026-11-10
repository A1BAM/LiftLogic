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

White on black, and almost nothing else. The page is true black (`ink-950`),
which an OLED phone simply turns off; a panel is one step up (`ink-900`) with
an `ink-700` hairline around it. No gradients, no glass, no blur, no shadows —
those were tried and they read as glare in a dim gym.

- `.panel` holds content. `.well` is a field you type into.
- `.btn-primary` is white on black: the brightest thing the screen can draw,
  so only one per screen. `.btn-secondary` is its outlined twin for an action
  that is no longer the point. `.btn-quiet` is everything else.
- `done` (a soft green) is the only colour, and only for what is finished:
  the sets-done dots, a completed row's tick, the day's progress line.
- Micro-labels are uppercase and tracked at 13px; body copy is 14–16px.
  Numbers use `.nums` so columns line up.

## Readability

This is the thing that has been got wrong twice, in both directions — once too
dim, once too bright. The rule now: **nothing dimmer than `zinc-400`.**

`zinc-500` measures 3.93:1 on a panel and 4.35:1 on black, both under the 4.5:1
target; `zinc-400` is around 8:1 and still reads as clearly secondary. Primary
text is plain `white`. Never put an alpha on text.

Verify it rather than trusting it: render the screens and walk every text node,
comparing its computed colour against what is actually painted behind it. The
same pass should check that no tap target is under 44px.

## Conventions

- Comments explain *why*, not what. Match the density already in the file.
- Never skip, disable, or weaken a test to get green.
- When a change is visual, render it and look at it — a screenshot at iPhone
  width (393×852) has caught bugs that reading the code did not.
