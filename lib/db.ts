/**
 * Web3 Builder Hub - Database Utils (Phase 1 ORM version)
 * Refactored using Drizzle ORM
 */

import { sql as vercelSql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql, eq, desc, sql as drizzleSql } from 'drizzle-orm';
import { projects, apiLogs } from '@/db/schema';
import type { Project, ProjectStatus, DeepDiveResult } from '@/types/project';

// Initialize Drizzle ORM instance
export const db = drizzle(vercelSql);

// ==================== API Logs ====================

export async function logApiCall(data: {
  apiName: string;
  status: 'success' | 'error';
  durationMs: number;
  found?: number;
  inserted?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(apiLogs).values({
      apiName: data.apiName,
      status: data.status,
      durationMs: data.durationMs,
      found: data.found || 0,
      inserted: data.inserted || 0,
      errorMessage: data.errorMessage || null,
    });
  } catch (error) {
    console.error('Log API call error:', error);
  }
}

// ==================== Project CRUD ====================

export async function insertProject(
  project: Omit<Project, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const existing = await db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.url, project.url))
      .limit(1);
    
    if (existing.length > 0) {
      return { success: false, error: 'URL already exists' };
    }

    const result = await db.insert(projects).values({
      title: project.title,
      url: project.url,
      summary: project.summary,
      source: project.source,
      discoveredAt: project.discoveredAt ? new Date(project.discoveredAt) : undefined,
      deadline: project.deadline ? new Date(project.deadline) : null,
      prizePool: project.prizePool,
      status: project.status,
      score: project.score,
      deepDiveResult: project.deepDiveResult,
    }).returning({ id: projects.id });

    return { success: true, id: result[0].id };
  } catch (error) {
    console.error('Insert project error:', error);
    return { success: false, error: String(error) };
  }
}

export async function insertProjectsBatch(
  projectsList: Omit<Project, 'id' | 'createdAt'>[]
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (const project of projectsList) {
    const result = await insertProject(project);
    if (result.success) {
      results.inserted++;
    } else if (result.error === 'URL already exists') {
      results.skipped++;
    } else {
      results.errors.push(`${project.title}: ${result.error}`);
    }
  }

  return results;
}

export async function getPendingDeepDiveProjects(limitNum: number = 10): Promise<Project[]> {
  const result = await db.select()
    .from(projects)
    .where(eq(projects.status, 'pending_deep_dive'))
    .orderBy(desc(projects.discoveredAt))
    .limit(limitNum);

  return result.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary || '',
    source: row.source || '',
    discoveredAt: row.discoveredAt?.toISOString() || new Date().toISOString(),
    deadline: row.deadline?.toISOString() || null,
    prizePool: row.prizePool || null,
    status: row.status as ProjectStatus,
    score: row.score as any,
    deepDiveResult: row.deepDiveResult as any,
    createdAt: row.createdAt?.toISOString(),
  }));
}

export async function getScoredProjects(
  minScore: number = 8.0,
  limitNum: number = 5
): Promise<Project[]> {
  // Due to JSONB casting requirements, using raw sql for complex JSONB filtering is safer
  const result = await db.execute(sql`
    SELECT * FROM projects 
    WHERE status = 'scored' 
      AND score IS NOT NULL
      AND (score->>'total_score')::float >= ${minScore}
    ORDER BY (score->>'total_score')::float DESC
    LIMIT ${limitNum}
  `);

  return result.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    source: row.source,
    discoveredAt: row.discovered_at?.toISOString(),
    deadline: row.deadline?.toISOString(),
    prizePool: row.prize_pool,
    status: row.status as ProjectStatus,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at?.toISOString(),
  }));
}

export async function updateProjectStatus(
  id: number, 
  status: ProjectStatus,
  deepDiveResult?: DeepDiveResult
): Promise<boolean> {
  try {
    if (deepDiveResult) {
      await db.update(projects)
        .set({ 
          status,
          deepDiveResult: deepDiveResult,
          score: deepDiveResult.score || null
        })
        .where(eq(projects.id, id));
    } else {
      await db.update(projects)
        .set({ status })
        .where(eq(projects.id, id));
    }
    return true;
  } catch (error) {
    console.error('Update project status error:', error);
    return false;
  }
}

export async function getProjectStats(): Promise<{
  total: number;
  new: number;
  pendingDeepDive: number;
  scored: number;
  highScore: number;
}> {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_count,
      COUNT(*) FILTER (WHERE status = 'pending_deep_dive') as pending_count,
      COUNT(*) FILTER (WHERE status = 'scored') as scored_count,
      COUNT(*) FILTER (WHERE status = 'scored' AND score IS NOT NULL AND (score->>'total_score')::float >= 8) as high_score_count
    FROM projects
  `);

  return {
    total: parseInt(result.rows[0].total as string),
    new: parseInt(result.rows[0].new_count as string),
    pendingDeepDive: parseInt(result.rows[0].pending_count as string),
    scored: parseInt(result.rows[0].scored_count as string),
    highScore: parseInt(result.rows[0].high_score_count as string),
  };
}

// ==================== End of Project CRUD ====================
