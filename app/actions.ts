'use server';

import { db } from '@/lib/db';
import { projects } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { unstable_noStore as noStore } from 'next/cache';

export async function fetchProjects() {
  noStore();
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
        CASE WHEN score IS NOT NULL THEN ((score->>'total_score')::float) ELSE 0 END DESC,
        discovered_at DESC
      LIMIT 100
    `);

    return rows.rows.map((p: any) => ({
      id: p.id,
      title: p.title,
      url: p.url,
      summary: p.summary,
      source: p.source,
      discovered_at: p.discovered_at,
      deadline: p.deadline,
      prize_pool: p.prize_pool,
      score: typeof p.score === 'string' ? JSON.parse(p.score) : p.score,
      deep_dive_result: typeof p.deep_dive_result === 'string' ? JSON.parse(p.deep_dive_result) : p.deep_dive_result,
    }));
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
}
