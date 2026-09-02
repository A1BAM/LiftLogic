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
- `liftlogic/components/` — dialogs share the shell in `Modal.tsx`.
- `liftlogic/formviewer/` + `liftlogic/data/animations/` — the 3D form guide.
  Animations are files in the repo, keyed on the exercise's primary key. They
  are never stored in or written to the database.

## Checks before pushing

Run all three from `liftlogic/`:

```
npx tsc --noEmit
npm run build
npm test
```

CI runs the same thing. Dependencies are pnpm; CI installs with
`--frozen-lockfile`, so commit `pnpm-lock.yaml` whenever `package.json` changes.

## Conventions

- Comments explain *why*, not what. Match the density already in the file.
- Never skip, disable, or weaken a test to get green.
- When a change is visual, render it and look at it — a screenshot at iPhone
  width (393×852) has caught bugs that reading the code did not.
