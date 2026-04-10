import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { migrate } from 'drizzle-orm/vercel-postgres/migrator';

const db = drizzle(sql);

async function main() {
  console.log('⏳ Running production database migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Database migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

main();
