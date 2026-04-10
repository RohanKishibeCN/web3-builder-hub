import { sql } from '@vercel/postgres';

async function main() {
  try {
    console.log('Checking if table needs manual truncation to bypass Drizzle CI bug...');
    
    // Only truncate if the table exists
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'projects'
        ) THEN
          TRUNCATE TABLE projects RESTART IDENTITY CASCADE;
        END IF;
      END $$;
    `;
    console.log('Database reset successfully. Drizzle push can now proceed without interactive prompts.');
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
}

main();
