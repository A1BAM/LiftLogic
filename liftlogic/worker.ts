import { Pool } from '@neondatabase/serverless';
import { logger } from './utils/logger';
import { timingSafeEqual } from './utils/security';

async function deleteLogsByExercise(pool: Pool, exerciseId: string, headers: Record<string, string>): Promise<Response> {
  await pool.query('DELETE FROM workouts WHERE exercise_id = $1', [exerciseId]);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

async function deleteLogById(pool: Pool, id: string, headers: Record<string, string>): Promise<Response> {
  await pool.query('DELETE FROM workouts WHERE id = $1', [id]);
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
  if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
    return `Invalid timestamp${suffix}`;
  }
  if (typeof weight !== 'number' || isNaN(weight) || weight < 0 || weight > 2000) {
    return `Invalid weight${suffix}`;
  }
  if (typeof reps !== 'number' || isNaN(reps) || reps < 0 || reps > 1000) {
    return `Invalid reps${suffix}`;
  }
  if (sets !== undefined && (typeof sets !== 'number' || isNaN(sets) || sets < 0 || sets > 100)) {
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



async function executeBulkInsert(pool: Pool, items: unknown[]): Promise<void> {
  if (items.length === 0) return;

  const ids: string[] = [];
  const exerciseIds: string[] = [];
  const timestamps: number[] = [];
  const weights: number[] = [];
  const reps: number[] = [];
  const sets: number[] = [];
  const notes: (string | null)[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = (items[i] as Record<string, unknown>) || {};
    ids.push(item.id as string);
    exerciseIds.push(item.exerciseId as string);
    timestamps.push(item.timestamp as number);
    weights.push(item.weight as number);
    reps.push(item.reps as number);
    sets.push((item.sets as number) || 1);
    notes.push((item.notes as string) || null);
  }

  const query = `
    INSERT INTO workouts (id, exercise_id, timestamp, weight, reps, sets, notes)
    SELECT * FROM UNNEST ($1::text[], $2::text[], $3::bigint[], $4::numeric[], $5::integer[], $6::integer[], $7::text[])
    AS t(id, exercise_id, timestamp, weight, reps, sets, notes)
    ON CONFLICT (id) DO UPDATE SET
      weight = EXCLUDED.weight,
      reps = EXCLUDED.reps,
      sets = EXCLUDED.sets,
      notes = EXCLUDED.notes;
  `;

  await pool.query(query, [ids, exerciseIds, timestamps, weights, reps, sets, notes]);
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

async function getLoginRateLimitKey(request: Request): Promise<string> {
  const clientAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clientAddress));
  const digestHex = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `login:${digestHex}`;
}

export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
  TARGET_HASH?: string;
  PASSWORD?: string;
  LOGIN_RATE_LIMITER?: RateLimit;
  ASSETS: { fetch: typeof fetch };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Default security headers for all responses
    const securityHeaders: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    };

    // Handle static assets
    if (!url.pathname.startsWith('/gym-api')) {
      const response = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(securityHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      // Asset specific CSP: application JavaScript and styles are bundled locally.
      newHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    const allowedOrigins = env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(',').map(o => o.trim()) : [];
    const requestOrigin = request.headers.get('origin');

    const headers: { [key: string]: string } = {
      ...securityHeaders,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
    };

    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes('*')) {
        headers['Access-Control-Allow-Origin'] = '*';
        delete headers['Access-Control-Allow-Credentials'];
      } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      }
    }

// Security Check: Verify Bearer Token or Cookie
    let authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('Cookie');
    if (!authHeader && cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)liftlogic_auth_token=([^;]*)/);
      if (match && match[1]) {
        authHeader = `Bearer ${match[1]}`;
      }
    }

    const isLoginEndpoint = request.method === 'POST' && (url.pathname === '/gym-api/login' || url.pathname === '/gym-api/login/');
    const isLogoutEndpoint = request.method === 'POST' && (url.pathname === '/gym-api/logout' || url.pathname === '/gym-api/logout/');

    if (request.method !== 'OPTIONS' && !isLoginEndpoint && !isLogoutEndpoint) {
      const targetHash = await getTargetHash(env);
      if (!targetHash) {
        logger.error("TARGET_HASH or PASSWORD not set. Refusing to serve requests without authentication.");
        return new Response(JSON.stringify({ error: "Server Configuration Error" }), {
          status: 500,
          headers: headers
        });
      }

      if (!authHeader || authHeader.length > 200 || !await timingSafeEqual(authHeader, `Bearer ${targetHash}`)) {
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
      return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers });
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
            if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) { // 1MB limit
              return new Response(JSON.stringify({ error: "Payload Too Large" }), { status: 413, headers });
            }
            try {
              body = await request.json();
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
        const { hash } = (body as Record<string, unknown>);
        if (typeof hash !== 'string' || hash.length === 0 || hash.length > 100) {
          return new Response(JSON.stringify({ error: "Invalid hash" }), { status: 400, headers });
        }

        if (!env.LOGIN_RATE_LIMITER) {
          logger.error("LOGIN_RATE_LIMITER binding not set. Refusing login without rate limiting.");
          return new Response(JSON.stringify({ error: "Server Configuration Error" }), { status: 500, headers });
        }

        try {
          const { success } = await env.LOGIN_RATE_LIMITER.limit({
            key: await getLoginRateLimitKey(request)
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
        if (!hash || !targetHash || !await timingSafeEqual(`Bearer ${hash}`, `Bearer ${targetHash}`)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }

        const cookie = `liftlogic_auth_token=${hash}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`;
        const resHeaders = new Headers(headers);
        resHeaders.set('Set-Cookie', cookie);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
      }

      // Handle Logout
      if (request.method === 'POST' && (url.pathname === '/gym-api/logout' || url.pathname === '/gym-api/logout/')) {
        const cookie = `liftlogic_auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
        const resHeaders = new Headers(headers);
        resHeaders.set('Set-Cookie', cookie);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: resHeaders });
      }

      // GET Profile
      if (request.method === 'GET' && (url.pathname === '/gym-api/profile' || url.pathname === '/gym-api/profile/')) {
        try {
          const { rows } = await pool.query('SELECT id, height_cm, weight_lbs, age FROM user_profile LIMIT 1');
          if (rows.length === 0) {
            return new Response(JSON.stringify(null), { status: 200, headers });
          }
          return new Response(JSON.stringify({
            id: rows[0].id,
            heightCm: Number(rows[0].height_cm),
            weightLbs: Number(rows[0].weight_lbs),
            age: rows[0].age ? Number(rows[0].age) : undefined
          }), { status: 200, headers });
        } catch (err: unknown) {
          if (connectionString.includes('dummy')) {
            return new Response(JSON.stringify(null), { status: 200, headers });
          }
          throw err;
        }
      }

      // POST Profile
      if (request.method === 'POST' && (url.pathname === '/gym-api/profile' || url.pathname === '/gym-api/profile/')) {
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
        const { heightCm, weightLbs, age } = (body as Record<string, unknown>);

        if (typeof heightCm !== 'number' || isNaN(heightCm) || heightCm <= 0 || heightCm > 300) {
          return new Response(JSON.stringify({ error: "Invalid heightCm" }), { status: 400, headers });
        }
        if (typeof weightLbs !== 'number' || isNaN(weightLbs) || weightLbs <= 0 || weightLbs > 1000) {
          return new Response(JSON.stringify({ error: "Invalid weightLbs" }), { status: 400, headers });
        }
        if (age !== undefined && age !== null && (typeof age !== 'number' || isNaN(age) || age < 0 || age > 150)) {
          return new Response(JSON.stringify({ error: "Invalid age" }), { status: 400, headers });
        }

        const id = "global_user"; // Single user setup
        const query = `
          INSERT INTO user_profile (id, height_cm, weight_lbs, age)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            height_cm = EXCLUDED.height_cm,
            weight_lbs = EXCLUDED.weight_lbs,
            age = EXCLUDED.age;
        `;

        await pool.query(query, [id, heightCm, weightLbs, age || null]);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      }

      // GET: Fetch all logs
      if (request.method === 'GET' && (url.pathname === '/gym-api' || url.pathname === '/gym-api/')) {
        try {
          const { rows } = await pool.query('SELECT id, exercise_id, timestamp, weight, reps, sets, notes FROM workouts ORDER BY timestamp DESC');

          const logs = rows.map((row: any) => ({
            id: row.id,
            exerciseId: row.exercise_id,
            timestamp: Number(row.timestamp),
            weight: Number(row.weight),
            reps: row.reps,
            sets: row.sets,
            notes: row.notes
          }));

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

        // Validate items
        const bulkError = validateWorkoutLogs(body, true);
        if (bulkError) return new Response(JSON.stringify({ error: bulkError }), { status: 400, headers });

        await executeBulkInsert(pool, body);


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

        // Validate all items before inserting
        const upsertError = validateWorkoutLogs(items, false);
        if (upsertError) return new Response(JSON.stringify({ error: upsertError }), { status: 400, headers });

        await executeBulkInsert(pool, items);


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
