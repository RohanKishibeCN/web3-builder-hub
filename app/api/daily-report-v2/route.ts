/**
 * Web3 Builder Hub - Daily Report V2 API（优化版）
 * 每日精选 - 只过滤高质量项目（score >= 8.0）
 * 
 * GET /api/daily-report-v2 - 手动触发
 * Cron: 每天 08:00
 * 
 * 优化点：移除旧版推送，准备接入 Git Markdown 生成
 */

import { NextResponse } from 'next/server';
import { getScoredProjects, getProjectStats } from '@/lib/db';
import type { DailyReportResponse } from '@/types/project';
import { writeDailyReportToGithub } from '@/lib/github';

const MIN_SCORE = 8.0;
const MAX_PROJECTS = 5;

export async function GET(request: Request) {
  // 验证
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('=== Daily Report V2 Started ===', new Date().toISOString());

  try {
    // 获取统计
    const stats = await getProjectStats();
    console.log('Stats:', stats);

    // 获取高分项目
    const projects = await getScoredProjects(MIN_SCORE, MAX_PROJECTS);
    console.log(`Found ${projects.length} high-score projects`);

    // 格式化为推送格式
    const formattedProjects = projects.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      score: p.score!,
      deepDiveResult: p.deepDiveResult || undefined,
      deadline: p.deadline || undefined,
      prizePool: p.prizePool || undefined,
    }));

    // 将高分项目写入 Git Markdown
    let markdownContent = `## 🌟 精选高分项目 (Score >= 8.0)\n\n`;
    
    if (formattedProjects.length === 0) {
      markdownContent += `_今日暂无符合条件的高分项目。_\n`;
    } else {
      formattedProjects.forEach((p, idx) => {
        markdownContent += `### ${idx + 1}. [${p.title}](${p.url})\n`;
        markdownContent += `- **综合评分**: ${p.score.total_score} / 10\n`;
        markdownContent += `- **奖金 / 截止**: ${p.prizePool || '未明确'} / ${p.deadline || '滚动申请'}\n`;
        markdownContent += `- **赛道建议**: ${p.deepDiveResult?.suggestedTrack || '暂无'}\n`;
        markdownContent += `- **研判简评**: ${p.score.reason}\n\n`;
        
        if (p.deepDiveResult?.participationPlan) {
          markdownContent += `**🏆 参与计划与 MVP 建议**:\n`;
          markdownContent += `> ${p.deepDiveResult.participationPlan.replace(/\n/g, '\n> ')}\n\n`;
        }
        markdownContent += `---\n`;
      });
    }

    markdownContent += `\n\n## 📊 数据统计\n`;
    markdownContent += `- 追踪项目总数: ${stats.total}\n`;
    markdownContent += `- 待深度研判: ${stats.pendingDeepDive}\n`;
    markdownContent += `- 已评分项目: ${stats.scored}\n`;

    const githubSuccess = await writeDailyReportToGithub(markdownContent);

    console.log('=== Daily Report V2 Completed ===', { 
      count: projects.length 
    });

    const response: DailyReportResponse = {
      success: true,
      sent: githubSuccess,
      count: projects.length,
      stats,
    };

    return NextResponse.json({
      ...response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily Report V2 error:', error);

    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
