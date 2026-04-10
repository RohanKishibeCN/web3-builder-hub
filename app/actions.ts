'use server';

import { db } from '@/lib/db';
import { projects } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { unstable_noStore as noStore } from 'next/cache';

export async function fetchProjects() {
  noStore();
  try {
    const results = await db.select({
      id: projects.id,
      title: projects.title,
      url: projects.url,
      summary: projects.summary,
      source: projects.source,
      discovered_at: projects.discoveredAt,
      deadline: projects.deadline,
      prize_pool: projects.prizePool,
      score: projects.score,
      deep_dive_result: projects.deepDiveResult,
    })
    .from(projects)
    .orderBy(
      desc(sql`COALESCE((score->>'total_score')::float, 0)`),
      desc(projects.discoveredAt)
    )
    .limit(100);

    return results.map((p: any) => ({
      id: p.id,
      title: p.title,
      url: p.url,
      summary: p.summary,
      source: p.source,
      discovered_at: p.discovered_at ? new Date(p.discovered_at).toISOString() : null,
      deadline: p.deadline ? new Date(p.deadline).toISOString() : null,
      prize_pool: p.prize_pool,
      score: typeof p.score === 'string' ? JSON.parse(p.score) : p.score,
      deep_dive_result: typeof p.deep_dive_result === 'string' ? JSON.parse(p.deep_dive_result) : p.deep_dive_result,
    }));
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
}
