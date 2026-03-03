/**
 * Web3 Builder Hub - Deep Dive API（优化版）
 * 深度研判：网页内容提取 + LLM 智能分析
 * 
 * GET /api/deep-dive?limit=10 - 手动触发
 * Cron: 每天 23:00
 * 
 * 优化点：使用统一 LLM 客户端，添加 Lark 通知
 */

import { NextResponse } from 'next/server';
import { sendSystemNotification } from '@/lib/telegram';
import { sendLarkNotification } from '@/lib/lark';
import { callLLM, extractJSON } from '@/lib/llm-client';
import type { Project, DeepDiveResult, DeepDiveResponse } from '@/types/project';
import { getPendingDeepDiveProjects, updateProjectStatus, logApiCall } from '@/lib/db';

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

async function analyzeWithLLM(project: Project, content: string): Promise<DeepDiveResult | null> {
  const prompt = `作为 Web3 Builder 专家，深度分析以下项目。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 奖金: ${project.prizePool || '未明确'}
- 截止: ${project.deadline || '滚动申请'}

网页内容:
${content.slice(0, 6000)}

输出严格的 JSON:
{
  "score": {
    "total_score": 1-10,
    "prize_score": 1-10,
    "urgency_score": 1-10,
    "quality_score": 1-10,
    "builder_match": 1-10,
    "reason": "简短中文评价"
  },
  "trackPotential": "赛道潜力（50字内）",
  "suggestedTrack": "建议赛道",
  "winProbability": 0-100,
  "participationPlan": "500字参与计划",
  "suggestedTechStack": ["技术1", "技术2"],
  "differentiation": "差异化点（100字内）",
  "mvpTimeline": {
    "day1": "第一天任务",
    "day2": "第二天任务",
    "day3": "第三天任务"
  },
  "riskFlags": ["风险1"],
  "isSuspicious": false,
  "suspicionReason": ""
}

只输出 JSON，不要其他文字。`;

  try {
    const response = await callLLM(prompt, { temperature: 0.4 });
    const parsed = extractJSON(response);
    
    return {
      score: parsed.score,
      trackPotential: parsed.trackPotential || '',
      suggestedTrack: parsed.suggestedTrack || '',
      winProbability: parsed.winProbability || 0,
      participationPlan: parsed.participationPlan || '',
      suggestedTechStack: parsed.suggestedTechStack || [],
      differentiation: parsed.differentiation || '',
      mvpTimeline: parsed.mvpTimeline || { day1: '', day2: '', day3: '' },
      riskFlags: parsed.riskFlags || [],
      isSuspicious: parsed.isSuspicious || false,
      suspicionReason: parsed.suspicionReason || '',
    };
  } catch {
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

async function runDeepDive(limit: number): Promise<DeepDiveResponse> {
  const projects = await getPendingDeepDiveProjects(limit);
  console.log(`Found ${projects.length} pending projects`);

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
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return result;
}

// ==================== API 路由 ====================

export async function GET(request: Request) {
  // 验证
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 获取 limit 参数
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');

  console.log('=== Deep Dive Started ===', new Date().toISOString());

  try {
    const result = await runDeepDive(limit);
    console.log('=== Deep Dive Completed ===', result);

    if (result.highScore > 0) {
      const msg = `深度研判完成\n处理: ${result.processed} 个\n高分: ${result.highScore} 个`;
      await sendSystemNotification('success', msg);
      await sendLarkNotification('success', msg);
    }

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Deep Dive error:', error);
    const msg = `深度研判失败: ${error}`;
    await sendSystemNotification('error', msg);
    await sendLarkNotification('error', msg);

    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
