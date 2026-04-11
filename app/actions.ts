'use server';

import { db } from '@/lib/db';
import { projects, apiLogs } from '@/db/schema';
import { desc, sql, eq, or, gt, count } from 'drizzle-orm';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';

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

    const recentIngestions = await db.select({
      id: projects.id,
      title: projects.title,
      source: projects.source,
      status: projects.status,
      createdAt: projects.createdAt
    })
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .limit(10);

    return {
      total: totalCount[0].value,
      today: todayCount[0].value,
      sources: sourceDistribution,
      anomalies,
      recentIngestions
    };
  } catch (error) {
    console.error('Failed to fetch storage stats:', error);
    return { total: 0, today: 0, sources: [], anomalies: [], recentIngestions: [] };
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

    const pendingQueue = await db.select()
      .from(projects)
      .where(eq(projects.status, 'pending_deep_dive'))
      .orderBy(desc(projects.createdAt))
      .limit(20);

    const latestScored = await db.select()
      .from(projects)
      .where(sql`${projects.score} IS NOT NULL`)
      .orderBy(desc(projects.createdAt))
      .limit(3);

    return {
      statusDistribution: statusCounts,
      deadLetters,
      pendingQueue,
      latestScored
    };
  } catch (error) {
    console.error('Failed to fetch analysis queue:', error);
    return { statusDistribution: [], deadLetters: [], pendingQueue: [], latestScored: [] };
  }
}

export async function triggerApi(endpoint: string) {
  noStore();
  try {
    // 动态获取当前请求的真实 Host，避免本地端口非 3000 或 Vercel Preview 环境下的域名硬编码问题导致 404
    const headersList = headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
      
    const response = await fetch(`${baseUrl}/api/${endpoint}`, {
      method: 'POST', // 强制改用 POST，彻底绕过 Vercel 和 Next.js 的任何默认 GET 缓存
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
      },
      cache: 'no-store'
    });

    // 增加防御性校验：如果后端（如 404 或 500 HTML）返回的不是 JSON，拦截并抛出文本错误，避免 SyntaxError
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`[triggerApi] Non-JSON response from ${baseUrl}/api/${endpoint}:`, text.slice(0, 200));
      return { 
        success: false, 
        error: `Invalid response (HTTP ${response.status}). Expected JSON, got ${contentType || 'unknown'}. URL: ${baseUrl}/api/${endpoint}` 
      };
    }

    const data = await response.json();
    return { success: response.ok, data };
  } catch (error) {
    console.error(`Failed to trigger ${endpoint}:`, error);
    return { success: false, error: String(error) };
  }
}
