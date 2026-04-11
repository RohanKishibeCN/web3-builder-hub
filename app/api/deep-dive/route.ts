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
import { extractContentWaterfall } from '@/lib/extractor';
import { z } from 'zod';
import type { Project, DeepDiveResult, DeepDiveResponse } from '@/types/project';
import { getPendingDeepDiveProjects, updateProjectStatus, logApiCall } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for deep dives

// ==================== 网页内容提取 ====================

async function extractContent(url: string): Promise<string> {
  return await extractContentWaterfall(url, { maxLength: 12000 });
}

// ==================== LLM 分析 ====================

const DeepDiveSchema = z.object({
  score: z.object({
    total_score: z.coerce.number().min(1).max(10).describe('综合总分(1-10)'),
    prize_score: z.coerce.number().min(1).max(10).describe('奖金吸引力(1-10)'),
    time_roi_score: z.coerce.number().min(1).max(10).describe('时间性价比(1-10)'),
    competition_score: z.coerce.number().min(1).max(10).describe('竞争烈度估算(1-10)'),
    trend_score: z.coerce.number().min(1).max(10).describe('赛道风口(1-10)'),
    clarity_score: z.coerce.number().min(1).max(10).describe('规则清晰度(1-10)'),
    reason: z.string().describe('简短中文评价(50字内)')
  }).describe('评分结果对象'),
  trackPotential: z.string().describe('赛道潜力分析(50字内)'),
  suggestedTrack: z.string().describe('建议参与的具体赛道'),
  winProbability: z.coerce.number().min(0).max(100).describe('预计获奖率(0-100)'),
  participationPlan: z.string().describe('500字参与计划'),
  suggestedTechStack: z.array(z.string()).describe('推荐技术栈'),
  differentiation: z.string().describe('差异化点(100字内)'),
  mvpTimeline: z.object({
    day1: z.string().describe('第一天的计划'),
    day2: z.string().describe('第二天的计划'),
    day3: z.string().describe('第三天的计划')
  }).describe('3天MVP开发时间线，字段名必须严格为 day1, day2, day3'),
  projectIdeas: z.array(z.object({
    name: z.string().describe('项目创意名称 (如: Solana Pay 自动分账插件)'),
    description: z.string().describe('一句话说明产品形态'),
    whyItWins: z.string().describe('为什么这个点子容易拿奖')
  })).optional().describe('3个极具竞争力的具体项目创意'),
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
7. 简短中文评价 (reason): 对该项目的整体评价(50字内)。

除打分外，你必须提供以下关键分析信息：
- 赛道潜力分析 (trackPotential): 50字以内。
- 建议参与的具体赛道 (suggestedTrack): 简明扼要。
- 预计获奖率 (winProbability): 0到100的数字。
- 500字参与计划 (participationPlan): 详细方案。
- 推荐技术栈 (suggestedTechStack): 字符串数组。
- 差异化点 (differentiation): 100字以内说明为何与众不同。
- 3天MVP开发时间线 (mvpTimeline): 必须包含 day1, day2, day3 三个键名。

最后，请额外充当资深 Web3 产品经理，结合项目要求，提供 3 个极具竞争力的具体项目创意 (projectIdeas)。
每个创意必须包含：名称 (name)、产品形态 (description) 和获胜理由 (whyItWins)。

注意：所有分数 (score.*) 和获奖率 (winProbability) 字段必须输出纯数字（例如 8 或 80），严禁包含“分”、“%”等任何单位或符号。`;

  try {
    const parsed = await callLLMObject<DeepDiveResult>(
      prompt, 
      DeepDiveSchema, 
      { 
        temperature: 1, // Kimi k2.5 MUST use temperature 1
        model: process.env.DEEP_DIVE_MODEL || 'kimi-k2.5' // 使用最高推理能力模型处理复杂研判
      }
    );
    return parsed;
  } catch (error: any) {
    console.error('LLM Analysis Error:', error);
    throw new Error(error.message || String(error));
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
    let analysis;
    try {
      analysis = await analyzeWithLLM(
        project, 
        content || `项目名称: ${project.title}\n简介: ${project.summary}`
      );
    } catch (e: any) {
      return { success: false, error: e.message || 'Unknown LLM Error' };
    }

    if (!analysis) {
      return { success: false, error: 'LLM analysis returned null' };
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
        retryCount: row.retry_count || 0,
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
        const currentRetry = project.retryCount || 0;
        if (currentRetry >= 3) {
          await updateProjectStatus(project.id, 'archived', undefined, currentRetry + 1);
        } else {
          await updateProjectStatus(project.id, 'pending_deep_dive', undefined, currentRetry + 1);
        }
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
      inserted: 0,
      updated: result.successCount, // 正确：将成功更新的数量记录在专属字段
      errorMessage: result.failed > 0 ? `Failed: ${result.failed}` : undefined
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
