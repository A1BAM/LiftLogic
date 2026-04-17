import { Pool } from '@neondatabase/serverless';
import { logger } from './utils/logger';

export interface Env {
  DATABASE_URL: string;
  ALLOWED_ORIGIN?: string;
  TARGET_HASH?: string;
  ASSETS: { fetch: typeof fetch };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Only handle /gym-api routes
    if (!url.pathname.startsWith('/gym-api')) {
      return env.ASSETS.fetch(request);
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const requestOrigin = request.headers.get('origin');

    const headers: { [key: string]: string } = {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer'
    };

    if (allowedOrigin === '*' || allowedOrigin === requestOrigin) {
      headers['Access-Control-Allow-Origin'] = requestOrigin || '*';
    } else {
      headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }

    // Security Check: Verify Bearer Token
    const authHeader = request.headers.get('Authorization');
    if (env.TARGET_HASH && request.method !== 'OPTIONS') {
      if (!authHeader || authHeader !== `Bearer ${env.TARGET_HASH}`) {
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
      return new Response(JSON.stringify({ error: "Database configuration missing" }), {
        status: 500,
        headers
      });
    }

    const pool = new Pool({ connectionString });

    try {
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

      // POST: Create or Update (Upsert)
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json() as any;
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }

        const { id, exerciseId, timestamp, weight, reps, sets, notes } = body || {};

        // Validation
        if (!id || typeof id !== 'string' || id.length > 100) {
          return new Response(JSON.stringify({ error: "Invalid or missing ID" }), { status: 400, headers });
        }
        if (!exerciseId || typeof exerciseId !== 'string' || exerciseId.length > 100) {
          return new Response(JSON.stringify({ error: "Invalid or missing Exercise ID" }), { status: 400, headers });
        }
        if (typeof timestamp !== 'number' || timestamp < 0) {
          return new Response(JSON.stringify({ error: "Invalid timestamp" }), { status: 400, headers });
        }
        if (typeof weight !== 'number' || weight < 0) {
          return new Response(JSON.stringify({ error: "Invalid weight" }), { status: 400, headers });
        }
        if (typeof reps !== 'number' || reps < 0) {
          return new Response(JSON.stringify({ error: "Invalid reps" }), { status: 400, headers });
        }
        if (typeof sets !== 'number' || sets < 0) {
          return new Response(JSON.stringify({ error: "Invalid sets" }), { status: 400, headers });
        }
        if (notes && (typeof notes !== 'string' || notes.length > 1000)) {
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
        let body;
        try {
          body = await request.json() as any;
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }

        const { id, exerciseId } = body || {};

        if (exerciseId) {
          if (typeof exerciseId !== 'string' || exerciseId.length > 100) {
            return new Response(JSON.stringify({ error: "Invalid Exercise ID" }), { status: 400, headers });
          }
          // Delete all logs for this exercise
          await pool.query('DELETE FROM workouts WHERE exercise_id = $1', [exerciseId]);
          return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        if (id) {
          if (typeof id !== 'string' || id.length > 100) {
            return new Response(JSON.stringify({ error: "Invalid ID" }), { status: 400, headers });
          }
          // Delete specific log
          await pool.query('DELETE FROM workouts WHERE id = $1', [id]);
          return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: "Missing ID or Exercise ID" }), { status: 400, headers });
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
