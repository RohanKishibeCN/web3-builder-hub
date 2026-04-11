'use server';

import { db } from '@/lib/db';
import { projects, apiLogs } from '@/db/schema';
import { desc, sql, eq, or, gt, count } from 'drizzle-orm';
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

// ==========================================
// DATA DASHBOARD ACTIONS (/data)
// ==========================================

export async function fetchSystemLogs() {
  noStore();
  try {
    return await db.select()
      .from(apiLogs)
      .orderBy(desc(apiLogs.createdAt))
      .limit(50);
  } catch (error) {
    console.error('Failed to fetch system logs:', error);
    return [];
  }
}

export async function fetchStorageStats() {
  noStore();
  try {
    const totalCount = await db.select({ value: count() }).from(projects);
    const todayCount = await db.select({ value: count() })
      .from(projects)
      .where(sql`${projects.createdAt} >= CURRENT_DATE`);
    
    const sourceDistribution = await db.select({
      source: projects.source,
      count: count()
    })
    .from(projects)
    .groupBy(projects.source);

    const anomalies = await db.select()
      .from(projects)
      .where(or(
        sql`${projects.url} IS NULL OR ${projects.url} = ''`,
        sql`${projects.summary} IS NULL OR ${projects.summary} = ''`
      ))
      .limit(10);

    return {
      total: totalCount[0].value,
      today: todayCount[0].value,
      sources: sourceDistribution,
      anomalies
    };
  } catch (error) {
    console.error('Failed to fetch storage stats:', error);
    return { total: 0, today: 0, sources: [], anomalies: [] };
  }
}

export async function fetchAnalysisQueue() {
  noStore();
  try {
    const statusCounts = await db.select({
      status: projects.status,
      count: count()
    })
    .from(projects)
    .groupBy(projects.status);

    const deadLetters = await db.select()
      .from(projects)
      .where(gt(projects.retryCount, 0))
      .orderBy(desc(projects.retryCount))
      .limit(20);

    return {
      statusDistribution: statusCounts,
      deadLetters
    };
  } catch (error) {
    console.error('Failed to fetch analysis queue:', error);
    return { statusDistribution: [], deadLetters: [] };
  }
}

export async function triggerApi(endpoint: string) {
  noStore();
  try {
    // Determine the base URL based on the environment
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
      
    const response = await fetch(`${baseUrl}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      }
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error(`Failed to trigger ${endpoint}:`, error);
    return { success: false, error: String(error) };
  }
}
