import { Pool } from '@neondatabase/serverless';
import { logger } from '../../utils/logger';

export const handler = async (event: any) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'; // Should be updated in Netlify env
  const requestOrigin = event.headers.origin || event.headers.Origin;

  // In a production environment, you should explicitly list allowed origins
  // For this fix, we'll allow the configured origin or default to '*' if not set (to avoid breaking current state while allowing for fix via env var)
  // However, the best practice is to match against a whitelist.

  const headers: { [key: string]: string } = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Vary': 'Origin'
  };

  if (allowedOrigin === '*' || allowedOrigin === requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin || '*';
  } else {
    // If not allowed, we can still set a default or just not include the header
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Use the environment variable injected by the Netlify Neon Extension
  const connectionString = process.env.NETLIFY_DATABASE_URL;

  if (!connectionString) {
    logger.error("Missing NETLIFY_DATABASE_URL");
    return { statusCode: 500, headers, body: "Database configuration missing" };
  }

  const pool = new Pool({ connectionString });

  try {
    // GET: Fetch all logs
    if (event.httpMethod === 'GET') {
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

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(logs)
        };
      } catch (err: any) {
        // Fallback for dummy database in local development
        if (connectionString.includes('dummy')) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify([])
          };
        }
        throw err;
      }
    }

    // POST: Create or Update (Upsert)
    if (event.httpMethod === 'POST') {
      const { id, exerciseId, timestamp, weight, reps, sets, notes } = JSON.parse(event.body || '{}');

      if (!id || !exerciseId) {
        return { statusCode: 400, headers, body: "Missing required fields" };
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

      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // DELETE: Remove a log OR all logs for an exercise
    if (event.httpMethod === 'DELETE') {
      const { id, exerciseId } = JSON.parse(event.body || '{}');
      
      if (exerciseId) {
        // Delete all logs for this exercise
        await pool.query('DELETE FROM workouts WHERE exercise_id = $1', [exerciseId]);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      if (id) {
        // Delete specific log
        await pool.query('DELETE FROM workouts WHERE id = $1', [id]);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      return { statusCode: 400, headers, body: "Missing ID or Exercise ID" };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };

  } catch (error: any) {
    logger.error('Database Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error", details: error.message })
    };
  }
};
