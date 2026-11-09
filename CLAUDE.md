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

Frutiger Aero: bright, wet and glossy, never dark. The page is a fixed
sky-to-meadow gradient (`index.css`), and everything that holds content floats
on it as frosted glass (`.glass`, `.glass-solid` for dialogs) rather than
sitting in a box.

Two colours: `aero-*` for water and `leaf-*` for growth. Text is the dark end
of the water ramp (`aero-900`/`aero-700`), never grey. The one control you came
to press is a gel capsule (`.btn-gel`, `.btn-gel-leaf` when it means done) with
the light catching its top half; everything else is `.btn-quiet`. Numbers you
type into sit in a `.well`. Sets done, checkboxes and completion read as little
gel bubbles.

`Bubbles` is background only: keep it out from behind text. Numbers use `.nums`
so columns line up.

## Conventions

- Comments explain *why*, not what. Match the density already in the file.
- Never skip, disable, or weaken a test to get green.
- When a change is visual, render it and look at it — a screenshot at iPhone
  width (393×852) has caught bugs that reading the code did not.
