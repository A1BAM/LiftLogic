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
| `GET /gym-api/session` | Check and renew the current session |
| `GET /gym-api` | Fetch all workout rows |
| `POST /gym-api/bulk` | Upsert many rows in one call |
| `DELETE /gym-api` | Delete a set by `setId`, an exercise definition by `definitionId`, or an exercise’s sets by `exerciseId` |

On the wire the app still sends an exercise as a "definition row" (exercise
id `__DEFINITION__`, row id `def_<id>`, the exercise as JSON in `notes`). The
Worker translates that to and from the `exercises` table, so older copies of
the app keep working.

## Database schema

Two tables, as used by `worker.ts`:

```sql
-- One row per logged set.
CREATE TABLE workouts (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT    NOT NULL,
  timestamp   BIGINT  NOT NULL,   -- ms since epoch
  weight      NUMERIC NOT NULL,
  reps        INTEGER NOT NULL
);

-- One row per exercise: the built-ins you have changed, and your own.
CREATE TABLE exercises (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  muscle_group   TEXT NOT NULL DEFAULT '',
  day_type       TEXT NOT NULL CHECK (day_type IN ('PUSH', 'PULL', 'LEGS')),
  default_weight NUMERIC NOT NULL,
  increment      NUMERIC NOT NULL,
  target_reps    INTEGER NOT NULL,
  is_custom      BOOLEAN NOT NULL DEFAULT false,
  is_archived    BOOLEAN NOT NULL DEFAULT false,
  is_slot_choice BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Worker configuration

Configure secrets in the Cloudflare dashboard.

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string for the `liftlogic_app` role (read/write on `public` only) |
| `TARGET_HASH` | SHA-256 of the login password, as hex. Takes precedence when both password settings are present |
| `PASSWORD` | Login password when `TARGET_HASH` is unset |
| `ALLOWED_ORIGIN` | Optional comma-separated list of additional trusted origins. The app's own origin is allowed automatically |
| `SESSION_SECRET` | Optional. Rotating this secret invalidates current sessions |

Wrangler provisions the `SESSIONS` Durable Object alongside the static asset
and rate-limiter bindings. Its SQLite storage holds a digest of each random
session ID, its expiration times, and a version of the effective credentials.
The first deployment of this version requires one fresh login on each device.

Opening the app renews the 90-day idle timeout, up to 180 days from login.
Logout revokes the current session, clears private browser state, and locks
other open tabs on that browser. Changing the effective password invalidates
all sessions. If an older installation still uses the password previously
embedded as a hash in the frontend, rotate the effective login credential in
Cloudflare as well.

Browser writes require JSON and a trusted origin. Older clients using an
ambiguous prefixed ID to delete an item must reload to send a typed delete.

The page and its files are served by Cloudflare without running the Worker,
so their security and caching headers live in `liftlogic/public/_headers`.

Configure at least one of `TARGET_HASH` and `PASSWORD` to enable login.

## Development

```bash
cd liftlogic
pnpm install
pnpm dev      # Vite dev server
pnpm build    # tsc && vite build
pnpm test     # vitest
pnpm check    # build followed by the complete test suite
```

`pnpm build` typechecks before bundling, so a type error fails the
build. CI runs the same three steps on every pull request.

## Deployment

Cloudflare Workers Builds deploys this repo automatically. `wrangler.jsonc`
runs `cd liftlogic && pnpm install && pnpm run build`, then serves
`liftlogic/dist`. Because the bundle is rebuilt on every deploy, `dist/` is
not committed.
