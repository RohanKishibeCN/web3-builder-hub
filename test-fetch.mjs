import { sql } from '@vercel/postgres';

async function main() {
  try {
    const { rows } = await sql`SELECT * FROM projects`;
    console.log('Projects:', rows);
  } catch (error) {
    console.error('Error:', error);
  }
}
main();
