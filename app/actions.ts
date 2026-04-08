'use server';

import { sql } from '@vercel/postgres';
import { unstable_noStore as noStore } from 'next/cache';

export async function fetchProjects() {
  noStore();
  try {
    const { rows } = await sql`
      SELECT 
        id,
        title,
        url,
        summary,
        source,
        discovered_at,
        deadline,
        prize_pool,
        score::text as score_text,
        deep_dive_result::text as deep_dive_result_text
      FROM projects 
      ORDER BY 
        CASE WHEN score IS NOT NULL THEN ((score->>'total_score')::float) ELSE 0 END DESC,
        discovered_at DESC 
      LIMIT 100
    `;

    return rows.map((p: any) => ({
      id: p.id,
      title: p.title,
      url: p.url,
      summary: p.summary,
      source: p.source,
      discovered_at: p.discovered_at,
      deadline: p.deadline,
      prize_pool: p.prize_pool,
      score: p.score_text ? JSON.parse(p.score_text) : null,
      deep_dive_result: p.deep_dive_result_text ? JSON.parse(p.deep_dive_result_text) : null,
    }));
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
}
