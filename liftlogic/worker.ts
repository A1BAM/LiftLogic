import { Pool } from '@neondatabase/serverless';
import { timingSafeEqual } from './utils/security';
import { validateExercise } from './utils/exercise';
import { DEFINITION_ID } from './constants';
import type { ExerciseDef } from './types';

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

async function deleteLogById(pool: Pool, id: string, headers: Record<string, string>): Promise<Response> {
  // "def_<id>" is how the app has always named an exercise; it lives in its
  // own table now.
  if (id.startsWith(DEFINITION_ROW_PREFIX)) {
    await pool.query('DELETE FROM exercises WHERE id = $1', [id.slice(DEFINITION_ROW_PREFIX.length)]);
  } else {
    await pool.query('DELETE FROM workouts WHERE id = $1', [id]);
  }
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
  const { id, exerciseId } = (body as Record<string, unknown>);

  if (exerciseId !== undefined) {
    if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid exerciseId" }), { status: 400, headers });
    }
    return await deleteLogsByExercise(pool, exerciseId, headers);
  }

  if (id !== undefined) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 50) {
      return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400, headers });
    }
    return await deleteLogById(pool, id, headers);
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
const DEFINITION_ROW_PREFIX = 'def_';

/** Splits a validated payload into exercises and sets. Returns an error string for a bad exercise. */
function splitPayload(items: unknown[]): { exercises: ExerciseDef[]; sets: Record<string, unknown>[] } | string {
  const exercises: ExerciseDef[] = [];
  const sets: Record<string, unknown>[] = [];
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    if (item.exerciseId !== DEFINITION_ID) {
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

let cachedTargetHash: string | null = null;
let cachedPasswordForHash: string | null = null;

async function getTargetHash(env: Env): Promise<string | null> {
  if (env.TARGET_HASH) return env.TARGET_HASH;
  if (env.PASSWORD) {
    if (cachedTargetHash !== null && cachedPasswordForHash !== null && await timingSafeEqual(cachedPasswordForHash, env.PASSWORD)) {
      return cachedTargetHash;
    }
    const msgBuffer = new TextEncoder().encode(env.PASSWORD);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    cachedTargetHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    cachedPasswordForHash = env.PASSWORD;
    return cachedTargetHash;
  }
  return null;
}

/**
 * Sessions.
 *
 * The cookie used to BE the password hash: the one permanent credential, kept
 * on every phone that had ever logged in, valid for ever, and accepted on
 * every endpoint. Now the hash is only ever presented to /login, and what the
 * browser holds is a signed token that says nothing but "logged in until
 * <time>". It cannot be turned back into the password, it expires, and
 * changing the password invalidates every one of them at once.
 */
const SESSION_COOKIE = 'liftlogic_auth_token';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * The signing key. A dedicated SESSION_SECRET is used when one is configured;
 * otherwise the key is derived from the password hash, which needs no setup
 * and still rotates with the password.
 */
async function sessionKey(env: Pick<Env, 'SESSION_SECRET'>, targetHash: string): Promise<CryptoKey> {
  const material = env.SESSION_SECRET || `liftlogic-session-v1:${targetHash}`;
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function mintSession(
  env: Pick<Env, 'SESSION_SECRET'>,
  targetHash: string,
  now = Date.now()
): Promise<string> {
  const payload = `v1.${now + SESSION_TTL_MS}`;
  const key = await sessionKey(env, targetHash);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(signature)}`;
}

async function verifySession(
  token: string,
  env: Pick<Env, 'SESSION_SECRET'>,
  targetHash: string,
  now = Date.now()
): Promise<boolean> {
  // Shape first, so garbage costs nothing: v1.<expiry ms>.<64 hex>
  const match = /^v1\.(\d{10,16})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  if (Number(match[1]) <= now) return false;

  const signature = new Uint8Array(32);
  for (let i = 0; i < 32; i++) signature[i] = parseInt(match[2].slice(i * 2, i * 2 + 2), 16);
  const key = await sessionKey(env, targetHash);
  // subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(`v1.${match[1]}`));
}

const sessionCookie = (token: string, maxAgeSeconds: number) =>
  `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;

async function getRateLimitKey(request: Request, scope: 'login' | 'api'): Promise<string> {
  const clientAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientAddress));
  const digestHex = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${scope}:${digestHex}`;
}

export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
  TARGET_HASH?: string;
  PASSWORD?: string;
  /** Optional. Signs session cookies; falls back to a key derived from the password hash. */
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

// Security check: a signed session cookie, and nothing else. The password
    // hash is not accepted here in any form — only /login takes it.
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookieMatch = cookieHeader.match(/(?:^|;\s*)liftlogic_auth_token=([^;]*)/);
    const sessionToken = cookieMatch ? cookieMatch[1] : '';

    const isLoginEndpoint = request.method === 'POST' && (url.pathname === '/gym-api/login' || url.pathname === '/gym-api/login/');
    const isLogoutEndpoint = request.method === 'POST' && (url.pathname === '/gym-api/logout' || url.pathname === '/gym-api/logout/');

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

    if (request.method !== 'OPTIONS' && !isLoginEndpoint && !isLogoutEndpoint) {
      const targetHash = await getTargetHash(env);
      if (!targetHash) {
        logger.error("TARGET_HASH or PASSWORD not set. Refusing to serve requests without authentication.");
        return new Response(JSON.stringify({ error: "Server Configuration Error" }), {
          status: 500,
          headers: headers
        });
      }

      if (!sessionToken || sessionToken.length > 200 || !await verifySession(sessionToken, env, targetHash)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: headers
        });
      }
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    // Session probe. Everything above already rejected an unauthenticated
    // request, so reaching here is the answer. Deliberately placed before the
    // database pool is opened: the app asks this on every load purely to find
    // out whether it is logged in, and that question costs no query.
    if (request.method === 'GET' && (url.pathname === '/gym-api/session' || url.pathname === '/gym-api/session/')) {
      // Asked on every app load, so this is also where the session slides:
      // use the app at least once in ninety days and it never asks again.
      const targetHash = await getTargetHash(env);
      const resHeaders = new Headers(headers);
      if (targetHash) {
        resHeaders.set('Set-Cookie', sessionCookie(await mintSession(env, targetHash), SESSION_TTL_MS / 1000));
      }
      return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers: resHeaders });
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
      if (request.method === 'POST' || request.method === 'DELETE') {
        const contentType = request.headers.get('Content-Type') || '';
        if (contentType.includes('application/json') && !url.pathname.endsWith('/logout')) {
            const contentLength = request.headers.get('Content-Length');
            if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
              return new Response(JSON.stringify({ error: "Payload Too Large" }), { status: 413, headers });
            }
            const raw = await readBodyCapped(request, MAX_BODY_BYTES);
            if (raw === null) {
              return new Response(JSON.stringify({ error: "Payload Too Large" }), { status: 413, headers });
            }
            try {
              body = JSON.parse(raw);
            } catch (e) {
              return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
            }
        }
      }

      // Handle Login
      if (request.method === 'POST' && (url.pathname === '/gym-api/login' || url.pathname === '/gym-api/login/')) {
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

        const targetHash = await getTargetHash(env);
        const offered = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)));
        if (!targetHash || !await timingSafeEqual(offered, targetHash.toLowerCase())) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }

        const cookie = sessionCookie(await mintSession(env, targetHash), SESSION_TTL_MS / 1000);
        const resHeaders = new Headers(headers);
        resHeaders.set('Set-Cookie', cookie);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
      }

      // Handle Logout
      if (request.method === 'POST' && (url.pathname === '/gym-api/logout' || url.pathname === '/gym-api/logout/')) {
        const cookie = sessionCookie('', 0);
        const resHeaders = new Headers(headers);
        resHeaders.set('Set-Cookie', cookie);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
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
