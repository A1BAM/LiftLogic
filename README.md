# LiftLogic

A minimalist workout tracker that calculates progressive overload. Log sets
against an exercise, and each card recommends the next session's weight and
reps based on your previous session.

## Architecture

Single Cloudflare Worker serving both the API and the built React app.

```
Browser ──> Cloudflare Worker (liftlogic) ──> Neon (serverless Postgres)
              │
              ├── /gym-api/*  handled by the Worker
              └── everything else served from liftlogic/dist as static assets
```

- **Frontend** — React 19 + Vite + Tailwind, built to `liftlogic/dist`.
- **Worker** — `liftlogic/worker.ts`. Routes under `/gym-api` hit the
  database; all other paths fall through to the static assets binding with
  SPA fallback.
- **Database** — Neon serverless Postgres, reached over `DATABASE_URL`.

Routing is configured in `wrangler.jsonc`: `run_worker_first` lists the
`/gym-api` prefixes, and `not_found_handling` is set to
`single-page-application` so client-side routes resolve.

## API

| Route | Purpose |
|---|---|
| `POST /gym-api/login` · `POST /gym-api/logout` | Session auth |
| `GET /gym-api` | Fetch all workout rows |
| `POST /gym-api/bulk` | Upsert many rows in one call |
| `GET` · `POST /gym-api/profile` | Height, weight, age |

Exercise definitions are stored in the same `workouts` table as rows whose
`exercise_id` is the sentinel `DEFINITION_ID`, with the definition JSON in
`notes`.

## Database schema

Two tables, as used by `worker.ts`:

```sql
CREATE TABLE workouts (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT    NOT NULL,
  timestamp   BIGINT  NOT NULL,
  weight      NUMERIC NOT NULL,
  reps        INTEGER NOT NULL,
  sets        INTEGER NOT NULL,
  notes       TEXT
);

CREATE TABLE user_profile (
  id         TEXT PRIMARY KEY,
  height_cm  NUMERIC,
  weight_lbs NUMERIC,
  age        INTEGER
);
```

## Worker configuration

Set as secrets in the Cloudflare dashboard, never in `wrangler.jsonc`:

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `TARGET_HASH` | Hash of the login password |
| `PASSWORD` | Login password |
| `ALLOWED_ORIGIN` | Exact origin allowed by CORS |

Two bindings come from `wrangler.jsonc` rather than secrets: `ASSETS`
(static files) and `LOGIN_RATE_LIMITER`.

If `TARGET_HASH` is missing the Worker fails closed with a 500 rather than
degrading to unauthenticated access.

## Development

```bash
cd liftlogic
npm install
npm run dev      # Vite dev server
npm test         # vitest
npm run build    # tsc && vite build
```

`npm run build` typechecks before bundling, so a type error fails the
build. CI runs the same three steps on every pull request.

## Deployment

Cloudflare Workers Builds deploys this repo automatically. `wrangler.jsonc`
runs `cd liftlogic && npm install && npm run build`, then serves
`liftlogic/dist`. Because the bundle is rebuilt on every deploy, `dist/` is
not committed.
