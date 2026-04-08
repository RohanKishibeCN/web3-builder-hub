/**
 * Web3 Builder Hub - Deep Dive API（优化版）
 * 深度研判：网页内容提取 + LLM 智能分析
 * 
 * GET /api/deep-dive?limit=10 - 手动触发
 * Cron: 每天 23:00
 * 
 * 优化点：使用 Vercel AI SDK 强化 JSON 输出，调整评分维度。
 */

import { NextResponse } from 'next/server';
import { callLLMObject } from '@/lib/llm-client';
import { z } from 'zod';
import type { Project, DeepDiveResult, DeepDiveResponse } from '@/types/project';
import { getPendingDeepDiveProjects, updateProjectStatus, logApiCall } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for deep dives

// ==================== 网页内容提取 ====================

async function extractContent(url: string): Promise<string> {
  try {
    // 使用 Jina AI Reader（免费）
    const cleanUrl = url.replace(/^https?:\/\//, '');
    const response = await fetch(`https://r.jina.ai/http://${cleanUrl}`);
    
    if (!response.ok) throw new Error(`Jina AI: ${response.status}`);
    
    const data = await response.json();
    return data.content || '';
  } catch (error) {
    console.error(`Extract content error for ${url}:`, error);
    return '';
  }
}

// ==================== LLM 分析 ====================

const DeepDiveSchema = z.object({
  score: z.object({
    total_score: z.number().min(1).max(10).describe('综合总分(1-10)'),
    prize_score: z.number().min(1).max(10).describe('奖金吸引力(1-10)'),
    time_roi_score: z.number().min(1).max(10).describe('时间性价比(1-10)'),
    competition_score: z.number().min(1).max(10).describe('竞争烈度估算(1-10)'),
    trend_score: z.number().min(1).max(10).describe('赛道风口(1-10)'),
    clarity_score: z.number().min(1).max(10).describe('规则清晰度(1-10)'),
    reason: z.string().describe('简短中文评价(50字内)')
  }),
  trackPotential: z.string().describe('赛道潜力分析(50字内)'),
  suggestedTrack: z.string().describe('建议参与的具体赛道'),
  winProbability: z.number().min(0).max(100).describe('预计获奖率(0-100)'),
  participationPlan: z.string().describe('500字参与计划'),
  suggestedTechStack: z.array(z.string()).describe('推荐技术栈'),
  differentiation: z.string().describe('差异化点(100字内)'),
  mvpTimeline: z.object({
    day1: z.string(),
    day2: z.string(),
    day3: z.string()
  }),
  projectIdeas: z.array(z.object({
    name: z.string().describe('项目创意名称 (如: Solana Pay 自动分账插件)'),
    description: z.string().describe('一句话说明产品形态'),
    whyItWins: z.string().describe('为什么这个点子容易拿奖')
  })).optional(),
  riskFlags: z.array(z.string()).optional(),
  isSuspicious: z.boolean().optional(),
  suspicionReason: z.string().optional()
});

async function analyzeWithLLM(project: Project, content: string): Promise<DeepDiveResult | null> {
  const prompt = `作为 Web3 Agentic Coder 专家，深度分析以下黑客松/开发者资助项目。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 奖金: ${project.prizePool || '未明确'}
- 截止: ${project.deadline || '滚动申请'}

网页内容:
${content.slice(0, 15000)}

打分标准 (1-10分)，请务必将以下所有分数包裹在 "score" 对象内：
1. 综合总分 (total_score): 基于以下各项的综合评估，1-10分。
2. 奖金吸引力 (prize_score): 总奖池大、下限高、发放稳定币得分高。
3. 时间性价比 (time_roi_score): MVP开发周期短、提交门槛低、投入产出比高得分高。
4. 竞争烈度估算 (competition_score): 蓝海公链、冷门但有实力的项目得分高；卷王云集的头部赛事适度降分。
5. 赛道风口 (trend_score): 契合当前AI+Crypto, DePIN, Bitcoin L2等热门叙事得分高。
6. 规则清晰度 (clarity_score): 文档完备、规则清晰、利于Agent自动生成代码得分高。

请额外充当资深 Web3 产品经理，结合项目要求，提供 3 个极具竞争力的具体项目创意 (projectIdeas)。每个创意必须包含名称、产品形态和获胜理由。`;

  try {
    const parsed = await callLLMObject<DeepDiveResult>(
      prompt, 
      DeepDiveSchema, 
      { 
        temperature: 0.4,
        model: 'kimi-k2.5' // Kimi 最智能的模型，负责深度研判与 MVP 规划
      }
    );
    return parsed;
  } catch (error) {
    console.error('LLM Analysis Error:', error);
    return null;
  }
}

// ==================== 处理单个项目 ====================

async function processProject(project: Project): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  console.log(`Processing: ${project.title}`);

  try {
    // 提取网页内容
    const content = await extractContent(project.url);
    
    // LLM 分析
    const analysis = await analyzeWithLLM(
      project, 
      content || `项目名称: ${project.title}\n简介: ${project.summary}`
    );

    if (!analysis) {
      // 记录错误但继续，可能要增加一个 failed 状态或 retry 计数器
      return { success: false, error: 'LLM analysis failed' };
    }

    // 更新数据库
    const updated = await updateProjectStatus(project.id, 'scored', analysis);

    if (!updated) {
      return { success: false, error: 'Database update failed' };
    }

    console.log(`  Score: ${analysis.score.total_score}`);
    return { success: true, score: analysis.score.total_score };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ==================== 主流程 ====================

async function runDeepDive(limit: number, specificId?: number): Promise<DeepDiveResponse> {
  let projects: Project[] = [];
  
  if (specificId) {
    // 获取指定项目
    const { sql } = await import('@vercel/postgres');
    const result = await sql`SELECT * FROM projects WHERE id = ${specificId}`;
    if (result.rows.length > 0) {
      const row = result.rows[0];
      projects = [{
        id: row.id,
        title: row.title,
        url: row.url,
        summary: row.summary,
        source: row.source,
        discoveredAt: row.discovered_at,
        deadline: row.deadline,
        prizePool: row.prize_pool,
        status: row.status as any,
        score: row.score,
        deepDiveResult: row.deep_dive_result,
        createdAt: row.created_at,
      }];
    }
  } else {
    projects = await getPendingDeepDiveProjects(limit);
  }

  console.log(`Found ${projects.length} projects to process`);

  if (projects.length === 0) {
    return { success: true, processed: 0, successCount: 0, failed: 0, highScore: 0, errors: [] };
  }

  const result: DeepDiveResponse = {
    success: true,
    processed: 0,
    successCount: 0,
    failed: 0,
    highScore: 0,
    errors: [],
  };

  for (const project of projects) {
    const r = await processProject(project);
    result.processed++;

    if (r.success) {
      result.successCount++;
      if (r.score && r.score >= 8) result.highScore++;
    } else {
      result.failed++;
      result.errors.push(`${project.title}: ${r.error}`);
      // 仅当是批量任务且失败时，才标记为 archived 防死循环
      if (!specificId && project.status === 'pending_deep_dive') {
        await updateProjectStatus(project.id, 'archived');
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return result;
}

// ==================== API 路由 ====================

export async function GET(request: Request) {
  // 获取 limit 和 id 参数
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const idStr = url.searchParams.get('id');
  const specificId = idStr ? parseInt(idStr) : undefined;

  // 验证 (如果是通过 Vercel Cron 触发的批量任务，才需要验证 CRON_SECRET)
  if (!specificId) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  console.log('=== Deep Dive Started ===', new Date().toISOString(), specificId ? `(Target ID: ${specificId})` : '');

  try {
    const result = await runDeepDive(limit, specificId);
    console.log('=== Deep Dive Completed ===', result);

    await logApiCall({
      apiName: 'deep-dive',
      status: 'success',
      durationMs: 0, // 可以加上计时器
      found: result.processed,
      inserted: result.successCount,
    });

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Deep Dive error:', error);
    
    await logApiCall({
      apiName: 'deep-dive',
      status: 'error',
      durationMs: 0,
      errorMessage: String(error),
    });

    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
