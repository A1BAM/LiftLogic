const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function test() {
  const client = await pool.connect();
  try {
    // Ensure the table schema accepts age
    await client.query('ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS age integer');
    const query = `
      INSERT INTO user_profile (id, height_cm, weight_lbs, age)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        height_cm = EXCLUDED.height_cm,
        weight_lbs = EXCLUDED.weight_lbs,
        age = EXCLUDED.age;
    `;
    await client.query(query, ['global_user', 180, 170, 30]);
    console.log('Test successful');
  } catch(e) {
    console.error('Test failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}
test();
