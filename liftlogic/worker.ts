import { Pool } from '@neondatabase/serverless';
import { timingSafeEqual } from './utils/security';
import { validateExercise } from './utils/exercise';
import { DEFINITION_ID, DEFINITION_ROW_PREFIX } from './constants';
import { accessSession, getTargetHash, isSessionToken, newSessionToken, sha256 } from './sessions';
import type { ExerciseDef } from './types';

export { SessionStore } from './sessions';

/**
 * The shared logger goes quiet in production, which is right for the browser
 * and wrong here: wrangler builds the Worker with NODE_ENV=production, so
 * every server error was being dropped before it reached the dashboard. Only
 * messages and error text are logged, never request bodies or credentials.
 */
const logger = {
  error: (message: string, ...args: unknown[]) => console.error(`[ERROR] ${message}`, ...args)
};

/** Largest JSON body the API will read. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Reads a body as text, giving up once it passes the limit. Content-Length
 * cannot be trusted for this: a chunked request does not send one, and the
 * login endpoint parses its body before anyone has authenticated.
 */
async function readBodyCapped(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function deleteLogsByExercise(pool: Pool, exerciseId: string, headers: Record<string, string>): Promise<Response> {
  await pool.query('DELETE FROM workouts WHERE exercise_id = $1', [exerciseId]);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

function validateWorkoutItem(item: unknown, inArray = false): string | null {
  const suffix = inArray ? " in array" : "";
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return `Invalid payload${suffix}`;
  }
  const { id, exerciseId, timestamp, weight, reps, sets, notes } = (item as Record<string, unknown>);
  if (typeof id !== 'string' || id.length === 0 || id.length > 50) {
    return `Invalid id${suffix}`;
  }
  if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 50) {
    return `Invalid exerciseId${suffix}`;
  }
  // Stored as bigint / integer: a fraction or an Infinity would otherwise
  // surface as a 500 from the database instead of a 400 from here.
  if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return `Invalid timestamp${suffix}`;
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 2000) {
    return `Invalid weight${suffix}`;
  }
  if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 0 || reps > 1000) {
    return `Invalid reps${suffix}`;
  }
  if (sets !== undefined && (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 0 || sets > 100)) {
    return `Invalid sets${suffix}`;
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) {
    return `Invalid notes${suffix}`;
  }
  return null;
}

function validateWorkoutLogs(items: unknown[], inArray = false): string | null {
  for (const item of items) {
    const errorString = validateWorkoutItem(item, inArray);
    if (errorString) return errorString;
  }
  return null;
}

async function handleDeleteRequest(body: unknown, pool: Pool, headers: Record<string, string>): Promise<Response> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
  }
  const { id, setId, definitionId, exerciseId } = body as Record<string, unknown>;
  if ([id, setId, definitionId, exerciseId].filter(value => value !== undefined).length > 1) {
    return new Response(JSON.stringify({ error: "Choose one delete target" }), { status: 400, headers });
  }
  if (exerciseId !== undefined) {
    if (typeof exerciseId !== 'string' || !exerciseId.length || exerciseId.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid exerciseId" }), { status: 400, headers });
    }
    return deleteLogsByExercise(pool, exerciseId, headers);
  }
  if (definitionId !== undefined) {
    if (typeof definitionId !== 'string' || !definitionId.length || definitionId.length > 46) {
      return new Response(JSON.stringify({ error: "Invalid definitionId" }), { status: 400, headers });
    }
    await pool.query('DELETE FROM exercises WHERE id = $1', [definitionId]);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }
  if (id !== undefined || setId !== undefined) {
    const target = setId === undefined ? id : setId;
    if (typeof target !== 'string' || !target.length || target.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400, headers });
    }
    if (id !== undefined && target.startsWith(DEFINITION_ROW_PREFIX)) {
      // An older client could mean either table, even on a retried delete.
      return new Response(JSON.stringify({ error: "Refresh LiftLogic to delete this item" }), { status: 409, headers });
    }
    await pool.query('DELETE FROM workouts WHERE id = $1', [target]);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "Missing ID or Exercise ID" }), { status: 400, headers });
}



/**
 * Storage.
 *
 * `workouts` holds one row per set: id, exercise, time, weight, reps.
 * `exercises` holds one row per exercise.
 *
 * The app still speaks the original wire format, in which an exercise travels
 * as a "definition row" — exerciseId "__DEFINITION__", id "def_<exercise id>",
 * the exercise as JSON in `notes`. That shape is translated here, at the edge,
 * so the database no longer has to carry it, and a phone still running an
 * older copy of the app keeps working against the new tables.
 */

/** Splits a validated payload into exercises and sets. Returns an error string for a bad exercise. */
function splitPayload(items: unknown[]): { exercises: ExerciseDef[]; sets: Record<string, unknown>[] } | string {
  const exercises: ExerciseDef[] = [];
  const sets: Record<string, unknown>[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    if (item.exerciseId !== DEFINITION_ID) {
      if ((item.id as string).startsWith(DEFINITION_ROW_PREFIX)) return 'Reserved workout id';
      sets.push(item);
      continue;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(item.notes ?? ''));
    } catch {
      // falls through to the error below
    }
    const exercise = validateExercise(parsed);
    if (!exercise || item.id !== `${DEFINITION_ROW_PREFIX}${exercise.id}`) {
      return 'Invalid exercise definition';
    }
    exercises.push(exercise);
  }
  return { exercises, sets };
}

async function saveExercises(pool: Pool, exercises: ExerciseDef[]): Promise<void> {
  if (exercises.length === 0) return;
  const col = <T>(f: (e: ExerciseDef) => T) => exercises.map(f);
  await pool.query(
    `INSERT INTO exercises
       (id, name, muscle_group, day_type, default_weight, increment, target_reps, is_custom, is_archived, is_slot_choice)
     SELECT * FROM UNNEST ($1::text[], $2::text[], $3::text[], $4::text[], $5::numeric[], $6::numeric[], $7::integer[], $8::boolean[], $9::boolean[], $10::boolean[])
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       muscle_group = EXCLUDED.muscle_group,
       day_type = EXCLUDED.day_type,
       default_weight = EXCLUDED.default_weight,
       increment = EXCLUDED.increment,
       target_reps = EXCLUDED.target_reps,
       is_custom = EXCLUDED.is_custom,
       is_archived = EXCLUDED.is_archived,
       is_slot_choice = EXCLUDED.is_slot_choice,
       updated_at = now()`,
    [
      col(e => e.id), col(e => e.name), col(e => e.muscleGroup), col(e => e.dayType),
      col(e => e.defaultWeight), col(e => e.increment), col(e => e.targetReps),
      col(e => !!e.isCustom), col(e => !!e.isArchived), col(e => !!e.isSlotChoice)
    ]
  );
}

async function saveSets(pool: Pool, sets: Record<string, unknown>[]): Promise<void> {
  if (sets.length === 0) return;
  const col = (key: string) => sets.map(s => s[key]);
  await pool.query(
    `INSERT INTO workouts (id, exercise_id, timestamp, weight, reps)
     SELECT * FROM UNNEST ($1::text[], $2::text[], $3::bigint[], $4::numeric[], $5::integer[])
     ON CONFLICT (id) DO UPDATE SET
       weight = EXCLUDED.weight,
       reps = EXCLUDED.reps`,
    [col('id'), col('exerciseId'), col('timestamp'), col('weight'), col('reps')]
  );
}

/** Validates, splits and stores a payload. Returns an error string, or null once saved. */
async function savePayload(pool: Pool, items: unknown[], inArray: boolean): Promise<string | null> {
  const invalid = validateWorkoutLogs(items, inArray);
  if (invalid) return invalid;
  const split = splitPayload(items);
  if (typeof split === 'string') return split;
  // Exercises first, so a set is never stored ahead of the exercise it names.
  await saveExercises(pool, split.exercises);
  await saveSets(pool, split.sets);
  return null;
}

const SESSION_COOKIE = '__Host-liftlogic_session';
const sessionCookie = (name: string, token: string, maxAgeSeconds: number) =>
  `${name}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;

async function getRateLimitKey(request: Request, scope: 'login' | 'api'): Promise<string> {
  const clientAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
  return `${scope}:${await sha256(clientAddress)}`;
}

export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
  TARGET_HASH?: string;
  PASSWORD?: string;
  SESSIONS: DurableObjectNamespace;
  /** An optional additional credential that can be rotated to invalidate sessions. */
  SESSION_SECRET?: string;
  LOGIN_RATE_LIMITER?: RateLimit;
  API_RATE_LIMITER?: RateLimit;
  ASSETS: { fetch: typeof fetch };
}

export default {
  // ctx is part of the Workers fetch signature; nothing here defers work to it.
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Security headers for every API response
    const securityHeaders: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    };

    // Not an API request. Cloudflare serves the page and its files itself,
    // without running this Worker, and public/_headers is what puts the
    // security headers on them. Anything that does land here is handed
    // straight to the same asset store, so it gets the same treatment.
    if (!url.pathname.startsWith('/gym-api')) {
      return env.ASSETS.fetch(request);
    }

    const allowedOrigins = env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(',').map(o => o.trim()) : [];
    const requestOrigin = request.headers.get('origin');

    const headers: { [key: string]: string } = {
      ...securityHeaders,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
      // Workout history is private: it must not sit in a browser or proxy
      // cache, or come back out of the page cache after logging out.
      'Cache-Control': 'no-store',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };

    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes('*')) {
        headers['Access-Control-Allow-Origin'] = '*';
        delete headers['Access-Control-Allow-Credentials'];
      } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      }
    }

    const isMutation = request.method === 'POST' || request.method === 'DELETE';
    const path = url.pathname.replace(/\/$/, '');
    const isLoginEndpoint = request.method === 'POST' && path === '/gym-api/login';
    const isLogoutEndpoint = request.method === 'POST' && path === '/gym-api/logout';
    const isSessionProbe = request.method === 'GET' && path === '/gym-api/session';
    if (isMutation) {
      const site = request.headers.get('Sec-Fetch-Site');
      const trustedOrigin = requestOrigin === url.origin ||
        (!!requestOrigin && requestOrigin !== 'null' && requestOrigin !== '*' && allowedOrigins.includes(requestOrigin));
      // A native client may omit Origin. Browser requests with a suppressed
      // origin must either be same-origin or pass the JSON preflight boundary.
      const trustedSource = requestOrigin === null
        ? !site || site === 'same-origin'
        : trustedOrigin || (requestOrigin === 'null' && site === 'same-origin');
      if (!trustedSource) {
        return new Response(JSON.stringify({ error: "Untrusted origin" }), { status: 403, headers });
      }
      const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        return new Response(JSON.stringify({ error: "Expected application/json" }), { status: 415, headers });
      }
    }

    const cookieHeader = request.headers.get('Cookie') || '';
    const cookie = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + '='));
    const sessionToken = cookie?.slice(SESSION_COOKIE.length + 1) ?? '';

    // Every credential check is a password guess to someone who does not have
    // the password, and until this was here only /login was limited: the same
    // guess could be sent to any other endpoint as fast as the network allowed.
    // The ceiling is far above anything the app does (a page load is two
    // requests, a set is one), so it only ever bites a script.
    if (request.method !== 'OPTIONS' && env.API_RATE_LIMITER) {
      let allowed = true;
      try {
        ({ success: allowed } = await env.API_RATE_LIMITER.limit({
          key: await getRateLimitKey(request, 'api')
        }));
      } catch (error) {
        // Failing open here keeps the app usable through a limiter outage;
        // login still fails closed on its own, stricter limiter.
        logger.error('API_RATE_LIMITER failed', error instanceof Error ? error.message : String(error));
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { ...headers, 'Retry-After': '60' }
        });
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    const targetHash = await getTargetHash(env);
    const sessionUnavailable = () => new Response(JSON.stringify({ error: "Session service unavailable" }), { status: 503, headers });
    const cookieResponse = (body: object, token: string, expiresAt: number) => {
      const maxAge = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      const responseHeaders = new Headers(headers);
      responseHeaders.append('Set-Cookie', sessionCookie(SESSION_COOKIE, token, maxAge));
      if (/(?:^|;\s*)liftlogic_auth_token=/.test(cookieHeader)) {
        responseHeaders.append('Set-Cookie', sessionCookie('liftlogic_auth_token', '', 0));
      }
      return new Response(JSON.stringify(body), { headers: responseHeaders });
    };

    if (isLogoutEndpoint) {
      try {
        if (isSessionToken(sessionToken)) await accessSession(env, 'revoke', sessionToken, targetHash ?? '');
        return cookieResponse({ success: true }, '', 0);
      } catch {
        return sessionUnavailable();
      }
    }
    if (!targetHash) {
      logger.error("TARGET_HASH or PASSWORD not set.");
      return new Response(JSON.stringify({ error: "Server Configuration Error" }), { status: 500, headers });
    }
    if (!isLoginEndpoint) {
      let expiresAt = 0;
      try {
        if (isSessionToken(sessionToken)) {
          expiresAt = await accessSession(env, isSessionProbe ? 'renew' : 'check', sessionToken, targetHash);
        }
      } catch {
        return sessionUnavailable();
      }
      if (!expiresAt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
      if (isSessionProbe) return cookieResponse({ authenticated: true }, sessionToken, expiresAt);
    }

    // Use the environment variable for Cloudflare
    const connectionString = env.DATABASE_URL;

    if (!connectionString) {
      logger.error("Missing DATABASE_URL");
      return new Response("Database configuration missing", { status: 500, headers });
    }

    const pool = new Pool({ connectionString });

    try {
      let body: unknown = null;
      if (isMutation) {
        const contentLength = request.headers.get('Content-Length');
        if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
          return new Response(JSON.stringify({ error: "Payload Too Large" }), { status: 413, headers });
        }
        const raw = await readBodyCapped(request, MAX_BODY_BYTES);
        if (raw === null) {
          return new Response(JSON.stringify({ error: "Payload Too Large" }), { status: 413, headers });
        }
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
      }

      // Handle Login
      if (isLoginEndpoint) {
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
        // The password itself, hashed HERE. The browser used to hash it and
        // send the result, which made the stored hash a password in its own
        // right: anyone who ever saw it could log in without knowing the word
        // behind it. A hash offered as a login is now just a wrong password.
        const { password } = (body as Record<string, unknown>);
        if (typeof password !== 'string' || password.length === 0 || password.length > 200) {
          return new Response(JSON.stringify({ error: "Invalid password" }), { status: 400, headers });
        }

        if (!env.LOGIN_RATE_LIMITER) {
          logger.error("LOGIN_RATE_LIMITER binding not set. Refusing login without rate limiting.");
          return new Response(JSON.stringify({ error: "Server Configuration Error" }), { status: 500, headers });
        }

        try {
          const { success } = await env.LOGIN_RATE_LIMITER.limit({
            key: await getRateLimitKey(request, 'login')
          });
          if (!success) {
            const rateLimitHeaders = new Headers(headers);
            rateLimitHeaders.set('Retry-After', '60');
            return new Response(JSON.stringify({ error: "Too many login attempts" }), {
              status: 429,
              headers: rateLimitHeaders
            });
          }
        } catch (error) {
          logger.error("LOGIN_RATE_LIMITER failed. Refusing login while rate limiting is unavailable.", error);
          return new Response(JSON.stringify({ error: "Login temporarily unavailable" }), { status: 503, headers });
        }

        const offered = await sha256(password);
        if (!await timingSafeEqual(offered, targetHash)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }

        const token = newSessionToken();
        try {
          const expiresAt = await accessSession(env, 'create', token, targetHash);
          return cookieResponse({ success: true }, token, expiresAt);
        } catch {
          return sessionUnavailable();
        }
      }

      // GET: Fetch all logs
      if (request.method === 'GET' && (url.pathname === '/gym-api' || url.pathname === '/gym-api/')) {
        try {
          const [{ rows }, { rows: exerciseRows }] = await Promise.all([
            pool.query('SELECT id, exercise_id, timestamp, weight, reps FROM workouts ORDER BY timestamp DESC'),
            pool.query(
              'SELECT id, name, muscle_group, day_type, default_weight, increment, target_reps, is_custom, is_archived, is_slot_choice FROM exercises'
            )
          ]);

          // Every row is one set: the app logs them one at a time.
          const logs: unknown[] = rows.map((row: any) => ({
            id: row.id,
            exerciseId: row.exercise_id,
            timestamp: Number(row.timestamp),
            weight: Number(row.weight),
            reps: row.reps,
            sets: 1
          }));
          for (const row of exerciseRows as any[]) {
            const exercise: ExerciseDef = {
              id: row.id,
              name: row.name,
              muscleGroup: row.muscle_group,
              defaultWeight: Number(row.default_weight),
              increment: Number(row.increment),
              targetReps: row.target_reps,
              dayType: row.day_type
            };
            if (row.is_custom) exercise.isCustom = true;
            if (row.is_archived) exercise.isArchived = true;
            if (row.is_slot_choice) exercise.isSlotChoice = true;
            logs.push({
              id: `${DEFINITION_ROW_PREFIX}${row.id}`,
              exerciseId: DEFINITION_ID,
              timestamp: 0,
              weight: 0,
              reps: 0,
              sets: 0,
              notes: JSON.stringify(exercise)
            });
          }

          return new Response(JSON.stringify(logs), {
            status: 200,
            headers
          });
        } catch (err: unknown) {
          // Fallback for dummy database in local development
          if (connectionString.includes('dummy')) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers
            });
          }
          throw err;
        }
      }


      // POST: Bulk Create
      if (request.method === 'POST' && (url.pathname === '/gym-api/bulk' || url.pathname === '/gym-api/bulk/')) {
        if (!Array.isArray(body)) {
          return new Response(JSON.stringify({ error: "Invalid payload: must be an array" }), { status: 400, headers });
        }

        if (body.length > 10000) {
          return new Response(JSON.stringify({ error: "Payload too large: max 10,000 items" }), { status: 400, headers });
        }

        if (body.length === 0) {
           return new Response(JSON.stringify({ success: true, count: 0 }), { status: 200, headers });
        }

        const bulkError = await savePayload(pool, body, true);
        if (bulkError) return new Response(JSON.stringify({ error: bulkError }), { status: 400, headers });


        return new Response(JSON.stringify({ success: true, count: body.length }), { status: 200, headers });
      }

      // POST: Create or Update (Upsert)
      if (request.method === 'POST' && (url.pathname === '/gym-api' || url.pathname === '/gym-api/')) {
        const items = Array.isArray(body) ? body : [(body || {}) as Record<string, unknown>];

        if (items.length > 10000) {
          return new Response(JSON.stringify({ error: "Payload too large: max 10,000 items" }), { status: 400, headers });
        }

        if (items.length === 0) {
          return new Response(JSON.stringify({ success: true, count: 0 }), { status: 200, headers });
        }

        const upsertError = await savePayload(pool, items, false);
        if (upsertError) return new Response(JSON.stringify({ error: upsertError }), { status: 400, headers });


        return new Response(JSON.stringify({ success: true, count: items.length }), { status: 200, headers });
      }

      // DELETE: Remove a log OR all logs for an exercise
      if (request.method === 'DELETE' && (url.pathname === '/gym-api' || url.pathname === '/gym-api/')) {
        return await handleDeleteRequest(body, pool, headers);
      }

      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error: unknown) {
      logger.error('Database Error:', error instanceof Error ? error.message : String(error));
      // Security: Do not leak error details to the client
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers
      });
    } finally {
      await pool.end();
    }
  }
};
