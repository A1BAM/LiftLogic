import { Pool } from '@neondatabase/serverless';

export default async (req, context) => {
  // 1. Setup CORS headers so the frontend can talk to this function
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  };

  // 2. Handle Preflight Options request (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // 3. Connect to Database
  const connectionString = process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    console.error("Missing NETLIFY_DATABASE_URL environment variable");
    return new Response("Database configuration missing", { status: 500, headers });
  }

  const pool = new Pool({ connectionString });

  try {
    // 4. Handle GET Requests (Fetch History)
    if (req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM workouts ORDER BY timestamp DESC');
      
      // Convert database snake_case to frontend camelCase
      const logs = rows.map(row => ({
        id: row.id,
        exerciseId: row.exercise_id,
        timestamp: Number(row.timestamp), // Convert BigInt to Number
        weight: Number(row.weight),
        reps: row.reps,
        sets: row.sets,
        notes: row.notes
      }));

      return new Response(JSON.stringify(logs), { 
        status: 200, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      });
    }

    // 5. Handle POST Requests (Create or Update)
    if (req.method === 'POST') {
      const body = await req.json();
      const { id, exerciseId, timestamp, weight, reps, sets, notes } = body;

      if (!id || !exerciseId) {
        return new Response("Missing required fields", { status: 400, headers });
      }

      // Upsert: Insert, but if ID exists, update the values (Edit functionality)
      const query = `
        INSERT INTO workouts (id, exercise_id, timestamp, weight, reps, sets, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          weight = EXCLUDED.weight,
          reps = EXCLUDED.reps,
          sets = EXCLUDED.sets,
          notes = EXCLUDED.notes;
      `;

      await pool.query(query, [id, exerciseId, timestamp, weight, reps, sets || 3, notes || null]);

      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      });
    }

    // 6. Handle DELETE Requests
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { id } = body;

      if (!id) {
        return new Response("Missing ID", { status: 400, headers });
      }

      await pool.query('DELETE FROM workouts WHERE id = $1', [id]);

      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers });

  } catch (error) {
    console.error("Database Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
};