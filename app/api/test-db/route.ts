import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db.execute(sql`
      SELECT
        id,
        title,
        url,
        summary,
        source,
        discovered_at,
        deadline,
        prize_pool,
        score,
        deep_dive_result
      FROM projects
      ORDER BY
        COALESCE((score->>'total_score')::float, 0) DESC,
        discovered_at DESC
      LIMIT 100
    `);
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack });
  }
}
