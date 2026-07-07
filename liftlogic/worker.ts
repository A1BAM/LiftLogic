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

async function handleDeleteRequest(body: any, pool: Pool, headers: Record<string, string>): Promise<Response> {
  const { id, exerciseId } = body || {};

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

export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
  TARGET_HASH?: string;
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
    };

    // Handle static assets
    if (!url.pathname.startsWith('/gym-api')) {
      const response = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(securityHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      // Asset specific CSP: allows tailwind CDN and esm.sh for React/Lucide
      newHeaders.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; img-src 'self' data:; connect-src 'self' https://esm.sh; frame-ancestors 'none';");

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
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';"
    };

    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes('*')) {
        headers['Access-Control-Allow-Origin'] = '*';
      } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      } else {
        headers['Access-Control-Allow-Origin'] = allowedOrigins[0];
      }
    }

    // Security Check: Verify Bearer Token
    const authHeader = request.headers.get('Authorization');
    if (env.TARGET_HASH && request.method !== 'OPTIONS') {
      if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${env.TARGET_HASH}`)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: headers
        });
      }
    } else if (!env.TARGET_HASH) {
      logger.warn("TARGET_HASH not set. API is running without authentication.");
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    // Use the environment variable for Cloudflare
    const connectionString = env.DATABASE_URL;

    if (!connectionString) {
      logger.error("Missing DATABASE_URL");
      return new Response("Database configuration missing", { status: 500, headers });
    }

    const pool = new Pool({ connectionString });

    try {
      let body: any = null;
      if (request.method === 'POST' || request.method === 'DELETE') {
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
      }


      // GET Profile
      if (request.method === 'GET' && url.pathname.endsWith('/profile')) {
        try {
          const { rows } = await pool.query('SELECT * FROM user_profile LIMIT 1');
          if (rows.length === 0) {
            return new Response(JSON.stringify(null), { status: 200, headers });
          }
          return new Response(JSON.stringify({
            id: rows[0].id,
            heightCm: Number(rows[0].height_cm),
            weightLbs: Number(rows[0].weight_lbs)
          }), { status: 200, headers });
        } catch (err: any) {
          if (connectionString.includes('dummy')) {
            return new Response(JSON.stringify(null), { status: 200, headers });
          }
          throw err;
        }
      }

      // POST Profile
      if (request.method === 'POST' && url.pathname.endsWith('/profile')) {
        const { heightCm, weightLbs } = body || {};

        if (typeof heightCm !== 'number' || isNaN(heightCm) || heightCm <= 0) {
          return new Response(JSON.stringify({ error: "Invalid heightCm" }), { status: 400, headers });
        }
        if (typeof weightLbs !== 'number' || isNaN(weightLbs) || weightLbs <= 0) {
          return new Response(JSON.stringify({ error: "Invalid weightLbs" }), { status: 400, headers });
        }

        const id = "global_user"; // Single user setup
        const query = `
          INSERT INTO user_profile (id, height_cm, weight_lbs)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET
            height_cm = EXCLUDED.height_cm,
            weight_lbs = EXCLUDED.weight_lbs;
        `;

        await pool.query(query, [id, heightCm, weightLbs]);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      }

      // GET: Fetch all logs
      if (request.method === 'GET') {
        try {
          const { rows } = await pool.query('SELECT * FROM workouts ORDER BY timestamp DESC');

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
        } catch (err: any) {
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

      // POST: Bulk Create or Update
      if (request.method === 'POST' && url.pathname.endsWith('/bulk')) {
        if (!Array.isArray(body)) {
          return new Response(JSON.stringify({ error: "Expected an array of logs" }), { status: 400, headers });
        }

        // Return success early if empty array
        if (body.length === 0) {
           return new Response(JSON.stringify({ success: true, count: 0 }), { status: 200, headers });
        }

        // Validate all logs before inserting
        for (const log of body) {
          const { id, exerciseId, timestamp, weight, reps, sets, notes } = log;
          if (typeof id !== 'string' || id.length === 0 || id.length > 50) return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400, headers });
          if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 50) return new Response(JSON.stringify({ error: "Invalid exerciseId" }), { status: 400, headers });
          if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) return new Response(JSON.stringify({ error: "Invalid timestamp" }), { status: 400, headers });
          if (typeof weight !== 'number' || isNaN(weight) || weight < 0) return new Response(JSON.stringify({ error: "Invalid weight" }), { status: 400, headers });
          if (typeof reps !== 'number' || isNaN(reps) || reps < 0) return new Response(JSON.stringify({ error: "Invalid reps" }), { status: 400, headers });
          if (sets !== undefined && (typeof sets !== 'number' || isNaN(sets) || sets < 0)) return new Response(JSON.stringify({ error: "Invalid sets" }), { status: 400, headers });
          if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) return new Response(JSON.stringify({ error: "Invalid notes" }), { status: 400, headers });
        }

        // Batch inserts in chunks to avoid parameter limits (PostgreSQL has a max of 65535 parameters)
        // 7 parameters per row = max 9362 rows per chunk. Let's use 1000 for safety.
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < body.length; i += CHUNK_SIZE) {
          const chunk = body.slice(i, i + CHUNK_SIZE);
          const values: any[] = [];
          const placeholders: string[] = [];

          chunk.forEach((log, index) => {
            const offset = index * 7;
            placeholders.push(`($\${offset + 1}, $\${offset + 2}, $\${offset + 3}, $\${offset + 4}, $\${offset + 5}, $\${offset + 6}, $\${offset + 7})`);
            values.push(
              log.id,
              log.exerciseId,
              log.timestamp,
              log.weight,
              log.reps,
              log.sets || 1,
              log.notes || null
            );
          });

          const query = `
            INSERT INTO workouts (id, exercise_id, timestamp, weight, reps, sets, notes)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (id) DO UPDATE SET
              weight = EXCLUDED.weight,
              reps = EXCLUDED.reps,
              sets = EXCLUDED.sets,
              notes = EXCLUDED.notes;
          `;

          await pool.query(query, values);
        }

        return new Response(JSON.stringify({ success: true, count: body.length }), { status: 200, headers });
      }

      // POST: Create or Update (Upsert)
      if (request.method === 'POST') {
        const { id, exerciseId, timestamp, weight, reps, sets, notes } = body || {};

        // Validation
        if (typeof id !== 'string' || id.length === 0 || id.length > 50) {
          return new Response(JSON.stringify({ error: "Invalid id" }), { status: 400, headers });
        }
        if (typeof exerciseId !== 'string' || exerciseId.length === 0 || exerciseId.length > 50) {
          return new Response(JSON.stringify({ error: "Invalid exerciseId" }), { status: 400, headers });
        }
        if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
          return new Response(JSON.stringify({ error: "Invalid timestamp" }), { status: 400, headers });
        }
        if (typeof weight !== 'number' || isNaN(weight) || weight < 0) {
          return new Response(JSON.stringify({ error: "Invalid weight" }), { status: 400, headers });
        }
        if (typeof reps !== 'number' || isNaN(reps) || reps < 0) {
          return new Response(JSON.stringify({ error: "Invalid reps" }), { status: 400, headers });
        }
        if (sets !== undefined && (typeof sets !== 'number' || isNaN(sets) || sets < 0)) {
          return new Response(JSON.stringify({ error: "Invalid sets" }), { status: 400, headers });
        }
        if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 500)) {
          return new Response(JSON.stringify({ error: "Invalid notes" }), { status: 400, headers });
        }

        const query = `
          INSERT INTO workouts (id, exercise_id, timestamp, weight, reps, sets, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            weight = EXCLUDED.weight,
            reps = EXCLUDED.reps,
            sets = EXCLUDED.sets,
            notes = EXCLUDED.notes;
        `;

        await pool.query(query, [id, exerciseId, timestamp, weight, reps, sets || 1, notes || null]);

        return new Response(JSON.stringify({ success: true }), { status: 200, headers });
      }

      // DELETE: Remove a log OR all logs for an exercise
      if (request.method === 'DELETE') {
        return await handleDeleteRequest(body, pool, headers);
      }

      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers });

    } catch (error: any) {
      logger.error('Database Error:', error);
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
