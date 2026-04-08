/**
 * Web3 Builder Hub - 数据库工具（Phase 1 优化版）
 * 添加监控日志功能
 */

import { sql } from '@vercel/postgres';
import type { Project, ProjectStatus, DeepDiveResult } from '@/types/project';

// ==================== 数据库初始化 ====================

export async function initDB(): Promise<{ success: boolean; message: string }> {
  try {
    // 检查 projects 表是否存在
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'projects'
      );
    `;

    if (!tableExists.rows[0].exists) {
      // 创建 projects 表
      await sql`
        CREATE TABLE projects (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT UNIQUE NOT NULL,
          summary TEXT,
          source TEXT,
          discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deadline TIMESTAMP,
          prize_pool TEXT,
          status TEXT DEFAULT 'new',
          score JSONB,
          deep_dive_result JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 创建索引
      await sql`CREATE INDEX idx_projects_status ON projects(status);`;
      await sql`CREATE INDEX idx_projects_score ON projects(((score->>'total_score')::float));`;
      await sql`CREATE INDEX idx_projects_discovered_at ON projects(discovered_at);`;
    }

    // 检查并添加新字段（兼容旧表）
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects';
    `;
    
    const existingColumns = columns.rows.map(r => r.column_name);
    
    if (!existingColumns.includes('status')) {
      await sql`ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'new';`;
    }
    
    if (!existingColumns.includes('deep_dive_result')) {
      await sql`ALTER TABLE projects ADD COLUMN deep_dive_result JSONB;`;
    }

    // 检查 api_logs 表是否存在
    const logsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'api_logs'
      );
    `;

    if (!logsTableExists.rows[0].exists) {
      // 创建 API 日志表（用于监控）
      await sql`
        CREATE TABLE api_logs (
          id SERIAL PRIMARY KEY,
          api_name TEXT NOT NULL,
          status TEXT NOT NULL,
          duration_ms INTEGER,
          found INTEGER DEFAULT 0,
          inserted INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await sql`CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);`;
      await sql`CREATE INDEX idx_api_logs_api_name ON api_logs(api_name);`;
    }

    return { success: true, message: '数据库初始化完成' };
  } catch (error) {
    console.error('Init DB error:', error);
    throw error;
  }
}

// ==================== 监控日志 ====================

export async function logApiCall(data: {
  apiName: string;
  status: 'success' | 'error';
  durationMs: number;
  found?: number;
  inserted?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO api_logs (api_name, status, duration_ms, found, inserted, error_message)
      VALUES (${data.apiName}, ${data.status}, ${data.durationMs}, ${data.found || 0}, ${data.inserted || 0}, ${data.errorMessage || null})
    `;
  } catch (error) {
    console.error('Log API call error:', error);
  }
}

export async function getApiStats(hours: number = 24): Promise<{
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgDuration: number;
}> {
  const result = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'success') as success,
      COUNT(*) FILTER (WHERE status = 'error') as error,
      AVG(duration_ms) as avg_duration
    FROM api_logs
    WHERE created_at > NOW() - INTERVAL '${hours} hours'
  `;

  return {
    totalCalls: parseInt(result.rows[0].total),
    successCalls: parseInt(result.rows[0].success),
    errorCalls: parseInt(result.rows[0].error),
    avgDuration: Math.round(parseFloat(result.rows[0].avg_duration) || 0),
  };
}

// ==================== 项目 CRUD ====================

export async function insertProject(
  project: Omit<Project, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const existing = await sql`
      SELECT id FROM projects WHERE url = ${project.url} LIMIT 1
    `;
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'URL already exists' };
    }

    const result = await sql`
      INSERT INTO projects (
        title, url, summary, source, 
        discovered_at, deadline, prize_pool, 
        status, score, deep_dive_result
      ) VALUES (
        ${project.title}, 
        ${project.url}, 
        ${project.summary}, 
        ${project.source},
        ${project.discoveredAt}, 
        ${project.deadline}, 
        ${project.prizePool},
        ${project.status},
        ${project.score ? JSON.stringify(project.score) : null},
        ${project.deepDiveResult ? JSON.stringify(project.deepDiveResult) : null}
      )
      RETURNING id
    `;

    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Insert project error:', error);
    return { success: false, error: String(error) };
  }
}

export async function insertProjectsBatch(
  projects: Omit<Project, 'id' | 'createdAt'>[]
): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const results = { inserted: 0, skipped: 0, errors: [] as string[] };

  for (const project of projects) {
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

export async function getPendingDeepDiveProjects(limit: number = 10): Promise<Project[]> {
  const result = await sql`
    SELECT * FROM projects 
    WHERE status = 'pending_deep_dive'
    ORDER BY discovered_at DESC
    LIMIT ${limit}
  `;

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    source: row.source,
    discoveredAt: row.discovered_at,
    deadline: row.deadline,
    prizePool: row.prize_pool,
    status: row.status as ProjectStatus,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at,
  }));
}

export async function getScoredProjects(
  minScore: number = 8.0,
  limit: number = 5
): Promise<Project[]> {
  const result = await sql`
    SELECT * FROM projects 
    WHERE status = 'scored' 
      AND score IS NOT NULL
      AND (score->>'total_score')::float >= ${minScore}
    ORDER BY (score->>'total_score')::float DESC
    LIMIT ${limit}
  `;

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    source: row.source,
    discoveredAt: row.discovered_at,
    deadline: row.deadline,
    prizePool: row.prize_pool,
    status: row.status as ProjectStatus,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at,
  }));
}

export async function updateProjectStatus(
  id: number, 
  status: ProjectStatus,
  deepDiveResult?: DeepDiveResult
): Promise<boolean> {
  try {
    if (deepDiveResult) {
      await sql`
        UPDATE projects 
        SET status = ${status}, 
            deep_dive_result = ${JSON.stringify(deepDiveResult)},
            score = ${deepDiveResult.score ? JSON.stringify(deepDiveResult.score) : null}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE projects 
        SET status = ${status}
        WHERE id = ${id}
      `;
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
  const result = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_count,
      COUNT(*) FILTER (WHERE status = 'pending_deep_dive') as pending_count,
      COUNT(*) FILTER (WHERE status = 'scored') as scored_count,
      COUNT(*) FILTER (WHERE status = 'scored' AND score IS NOT NULL AND (score->>'total_score')::float >= 8) as high_score_count
    FROM projects
  `;

  return {
    total: parseInt(result.rows[0].total),
    new: parseInt(result.rows[0].new_count),
    pendingDeepDive: parseInt(result.rows[0].pending_count),
    scored: parseInt(result.rows[0].scored_count),
    highScore: parseInt(result.rows[0].high_score_count),
  };
}

// ==================== 动态白名单管理 ====================

export interface DynamicWhitelistItem {
  id?: number;
  domain: string;
  name: string;
  track: string;
  priority: number;
  source: 'manual' | 'auto-discovered';
  status: 'active' | 'pending' | 'rejected';
  discoveredAt: string;
  confirmedAt?: string;
}

/**
 * 添加候选域名（等待确认）
 */
export async function addCandidateDomain(data: {
  domain: string;
  name: string;
  track: string;
  priority: number;
  sourceUrl: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    // 检查是否已存在
    const existing = await sql`
      SELECT id FROM dynamic_whitelist WHERE domain = ${data.domain} LIMIT 1
    `;
    
    if (existing.rows.length > 0) {
      return { success: false, error: 'Domain already exists' };
    }

    const result = await sql`
      INSERT INTO dynamic_whitelist (domain, name, track, priority, source, status, discovered_at, source_url)
      VALUES (${data.domain}, ${data.name}, ${data.track}, ${data.priority}, 'auto-discovered', 'pending', ${new Date().toISOString()}, ${data.sourceUrl})
      RETURNING id
    `;

    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Add candidate domain error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 获取待确认的候选域名
 */
export async function getPendingCandidates(): Promise<DynamicWhitelistItem[]> {
  const result = await sql`
    SELECT * FROM dynamic_whitelist 
    WHERE status = 'pending'
    ORDER BY priority ASC, discovered_at DESC
  `;

  return result.rows.map(row => ({
    id: row.id,
    domain: row.domain,
    name: row.name,
    track: row.track,
    priority: row.priority,
    source: row.source,
    status: row.status,
    discoveredAt: row.discovered_at,
    confirmedAt: row.confirmed_at,
  }));
}

/**
 * 确认或拒绝候选域名
 */
export async function confirmCandidate(
  id: number, 
  action: 'confirm' | 'reject'
): Promise<boolean> {
  try {
    if (action === 'confirm') {
      await sql`
        UPDATE dynamic_whitelist 
        SET status = 'active', confirmed_at = ${new Date().toISOString()}
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE dynamic_whitelist 
        SET status = 'rejected'
        WHERE id = ${id}
      `;
    }
    return true;
  } catch (error) {
    console.error('Confirm candidate error:', error);
    return false;
  }
}

/**
 * 获取动态白名单（已确认的）
 */
export async function getDynamicWhitelist(): Promise<string[]> {
  const result = await sql`
    SELECT domain FROM dynamic_whitelist 
    WHERE status = 'active'
    ORDER BY priority ASC
  `;

  return result.rows.map(r => r.domain);
}

/**
 * 清理长期无活动的动态白名单
 */
export async function cleanupInactiveDomains(days: number = 90): Promise<number> {
  const result = await sql`
    DELETE FROM dynamic_whitelist 
    WHERE status = 'active' 
      AND confirmed_at < NOW() - INTERVAL '${days} days'
      AND domain NOT IN (
        SELECT DISTINCT source FROM projects 
        WHERE discovered_at > NOW() - INTERVAL '${days} days'
      )
    RETURNING id
  `;
  return result.rows.length;
}
