import { db } from './lib/db';
import { apiLogs } from './db/schema';
import { desc } from 'drizzle-orm';

async function checkLogs() {
  const logs = await db.select().from(apiLogs).orderBy(desc(apiLogs.createdAt)).limit(5);
  console.log(logs);
}
checkLogs();
