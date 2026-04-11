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
  updated?: number;
  skipped?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.insert(apiLogs).values({
      apiName: data.apiName,
      status: data.status,
      durationMs: data.durationMs,
      found: data.found || 0,
      inserted: data.inserted || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
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
  if (!projectsList || projectsList.length === 0) {
    return { inserted: 0, skipped: 0, errors: [] };
  }

  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  try {
    const formattedProjects = projectsList.map(project => ({
      title: project.title,
      url: project.url,
      summary: project.summary,
      source: project.source,
      discoveredAt: project.discoveredAt ? new Date(project.discoveredAt) : undefined,
      deadline: project.deadline ? new Date(project.deadline) : null,
      prizePool: project.prizePool,
      status: project.status,
      retryCount: project.retryCount || 0,
      score: project.score,
      deepDiveResult: project.deepDiveResult,
    }));

    const insertedRows = await db.insert(projects)
      .values(formattedProjects)
      .onConflictDoNothing({ target: projects.url })
      .returning({ id: projects.id });

    results.inserted = insertedRows.length;
    results.skipped = projectsList.length - insertedRows.length;
  } catch (error) {
    console.error('Batch insert error:', error);
    results.errors.push(`Batch insert failed: ${String(error)}`);
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
    retryCount: row.retryCount ?? 0,
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
    retryCount: row.retry_count ?? 0,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at?.toISOString(),
  }));
}

export async function updateProjectStatus(
  id: number, 
  status: ProjectStatus,
  deepDiveResult?: DeepDiveResult,
  retryCount?: number
): Promise<boolean> {
  try {
    const updateData: any = { status };
    if (deepDiveResult) {
      updateData.deepDiveResult = deepDiveResult;
      updateData.score = deepDiveResult.score || null;
    }
    if (retryCount !== undefined) {
      updateData.retryCount = retryCount;
    }

    await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id));
      
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
