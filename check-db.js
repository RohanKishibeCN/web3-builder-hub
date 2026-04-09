const { sql } = require('@vercel/postgres');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function run() {
  try {
    const result = await sql`SELECT title, deep_dive_result FROM projects LIMIT 5`;
    for (const row of result.rows) {
      if (row.deep_dive_result && row.deep_dive_result.score) {
        console.log(`Title: ${row.title}`);
        console.log('Score keys:', Object.keys(row.deep_dive_result.score));
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
