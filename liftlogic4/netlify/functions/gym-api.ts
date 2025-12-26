import { Pool } from '@neondatabase/serverless';

export const handler = async (event: any) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Use the environment variable injected by the Netlify Neon Extension
  const connectionString = process.env.NETLIFY_DATABASE_URL;

  if (!connectionString) {
    console.error("Missing NETLIFY_DATABASE_URL");
    return { statusCode: 500, headers, body: "Database configuration missing" };
  }

  const pool = new Pool({ connectionString });

  try {
    // GET: Fetch all logs
    if (event.httpMethod === 'GET') {
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

    // DELETE: Remove a log
    if (event.httpMethod === 'DELETE') {
      const { id } = JSON.parse(event.body || '{}');
      
      if (!id) {
        return { statusCode: 400, headers, body: "Missing ID" };
      }

      await pool.query('DELETE FROM workouts WHERE id = $1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };

  } catch (error: any) {
    console.error('Database Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error", details: error.message })
    };
  }
};