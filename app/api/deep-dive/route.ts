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
  // 放宽至 40,000 字符，搭配 kimi-k2-turbo-preview 处理
  return await extractContentWaterfall(url, { maxLength: 40000 });
}

// ==================== LLM 分析 ====================

// Step 1: 轻量评估 Schema
const Step1ScoreSchema = z.object({
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
  riskFlags: z.array(z.string()).optional(),
  isSuspicious: z.boolean().optional(),
  suspicionReason: z.string().optional()
});

// Step 2: 深度发散 Schema
const Step2IdeationSchema = z.object({
  participationPlan: z.string().describe('300字参与计划'),
  suggestedTechStack: z.array(z.string()).describe('推荐技术栈'),
  differentiation: z.string().describe('差异化点(100字内)'),
  mvpTimeline: z.object({
    day1: z.string().describe('第一天的计划'),
    day2: z.string().describe('第二天的计划'),
    day3: z.string().describe('第三天的计划')
  }).describe('3天MVP开发时间线'),
  projectIdeas: z.array(z.object({
    name: z.string().describe('项目创意名称 (如: Solana Pay 自动分账插件)'),
    description: z.string().describe('一句话说明产品形态'),
    whyItWins: z.string().describe('为什么这个点子容易拿奖')
  })).describe('3个极具竞争力的具体项目创意')
});

async function analyzeWithLLM(project: Project, content: string): Promise<DeepDiveResult | null> {
  // === Step 1: 轻量评估 (kimi-k2-turbo-preview) ===
  const step1Prompt = `作为 Web3 赛事分析师，快速评估以下项目。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 奖金: ${project.prizePool || '未明确'}
- 截止: ${project.deadline || '滚动申请'}

网页原文:
${content.slice(0, 40000)}

打分标准 (1-10分)，请务必将分数包裹在 "score" 对象内：
1. 综合总分 (total_score): 综合评估。
2. 奖金吸引力 (prize_score): 奖池大、稳定币为主得分高。
3. 时间性价比 (time_roi_score): MVP周期短得分高。
4. 竞争烈度估算 (competition_score): 卷王少得分高。
5. 赛道风口 (trend_score): 契合热门叙事得分高。
6. 规则清晰度 (clarity_score): 文档完备得分高。
7. 简评 (reason): 50字内。

额外输出：
- 赛道潜力 (trackPotential)
- 建议赛道 (suggestedTrack)
- 预计获奖率 (winProbability, 0-100纯数字)

严格输出纯 JSON，不含格式。`;

  let step1Result;
  try {
    step1Result = await callLLMObject<z.infer<typeof Step1ScoreSchema>>(
      step1Prompt, 
      Step1ScoreSchema, 
      { 
        temperature: 0.3,
        model: 'kimi-k2-turbo-preview' // 使用更便宜快速的模型做初步打分
      }
    );
  } catch (error: any) {
    console.error('Step 1 LLM Analysis Error:', error);
    throw new Error(`Step 1 Failed: ${error.message || String(error)}`);
  }

  // 如果总分低于 8 分，直接返回，阻断进入高成本的 Step 2
  if (step1Result.score.total_score < 8) {
    console.log(`[Deep Dive] ${project.title} 得分 ${step1Result.score.total_score}，不满足 8 分阈值，跳过创意发散。`);
    return {
      ...step1Result,
      // 填充 Step 2 缺失的字段，保证类型兼容
      participationPlan: '分数未达标，暂未生成参与计划。',
      suggestedTechStack: [],
      differentiation: '',
      mvpTimeline: { day1: '', day2: '', day3: '' },
      projectIdeas: []
    } as DeepDiveResult;
  }

  console.log(`[Deep Dive] ${project.title} 得分 ${step1Result.score.total_score}，进入 Step 2 深度发散...`);

  // === Step 2: 深度发散 (kimi-k2.5) ===
  const step2Prompt = `作为资深 Web3 产品经理与 Hacker，基于以下信息，为一个高潜项目提供参赛策略。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 综合评分: ${step1Result.score.total_score} / 10
- 赛道潜力: ${step1Result.trackPotential}

请提供：
1. 300字参与计划 (participationPlan)。
2. 推荐技术栈 (suggestedTechStack) 字符串数组。
3. 差异化点 (differentiation) 100字内说明。
4. 3天MVP开发时间线 (mvpTimeline)，必须包含 day1, day2, day3。
5. 3个极具竞争力的具体项目创意 (projectIdeas)，包含：名称 (name)、产品形态 (description) 和获胜理由 (whyItWins)。

网页原文参考（截断）:
${content.slice(0, 10000)}

严格输出纯 JSON，不含格式。`;

  let step2Result;
  try {
    step2Result = await callLLMObject<z.infer<typeof Step2IdeationSchema>>(
      step2Prompt, 
      Step2IdeationSchema, 
      { 
        temperature: 0.8, // 创意发散需要适度的随机性
        model: process.env.DEEP_DIVE_MODEL || 'kimi-k2.5' // 仅对高分项目调用高配模型
      }
    );
  } catch (error: any) {
    console.error('Step 2 LLM Analysis Error:', error);
    // 如果 Step 2 失败，降级返回 Step 1 的结果，防止整体任务溃败
    return {
      ...step1Result,
      participationPlan: '创意发散生成失败',
      suggestedTechStack: [],
      differentiation: '',
      mvpTimeline: { day1: '', day2: '', day3: '' },
      projectIdeas: []
    } as DeepDiveResult;
  }

  // 合并两步结果
  return {
    ...step1Result,
    ...step2Result
  } as DeepDiveResult;
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
