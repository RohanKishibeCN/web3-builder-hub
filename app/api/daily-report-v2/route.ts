/**
 * Web3 Builder Hub - Daily Report V2 API（优化版）
 * 每日精选推送 - 只推送高质量项目（score >= 8.0）
 * 
 * GET /api/daily-report-v2 - 手动触发
 * Cron: 每天 08:00
 * 
 * 优化点：添加 Lark 推送
 */

import { NextResponse } from 'next/server';
import { getScoredProjects, getProjectStats } from '@/lib/db';
import { sendDailyReport } from '@/lib/telegram';
import { sendLarkDailyReport, sendLarkNotification } from '@/lib/lark';
import type { DailyReportResponse } from '@/types/project';

const MIN_SCORE = 8.0;
const MAX_PROJECTS = 5;

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

  console.log('=== Daily Report V2 Started ===', new Date().toISOString());

  try {
    // 获取统计
    const stats = await getProjectStats();
    console.log('Stats:', stats);

    // 获取高分项目
    const projects = await getScoredProjects(MIN_SCORE, MAX_PROJECTS);
    console.log(`Found ${projects.length} high-score projects`);

    // 格式化为 Telegram 格式
    const telegramProjects = projects.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      score: p.score!,
      deepDiveResult: p.deepDiveResult || undefined,
      deadline: p.deadline || undefined,
      prizePool: p.prizePool || undefined,
    }));

    // 发送 Telegram 推送
    const telegramSent = await sendDailyReport(telegramProjects);
    
    // 发送 Lark 推送
    const larkSent = await sendLarkDailyReport(telegramProjects);
    
    // 如果 Lark 推送失败，发送通知
    if (!larkSent) {
      await sendLarkNotification('warning', '每日报告 Lark 推送失败，请检查配置');
    }

    console.log('=== Daily Report V2 Completed ===', { 
      telegramSent, 
      larkSent, 
      count: projects.length 
    });

    const response: DailyReportResponse = {
      success: true,
      sent: telegramSent,
      count: projects.length,
      stats,
    };

    return NextResponse.json({
      ...response,
      telegramSent,
      larkSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily Report V2 error:', error);
    
    // 发送错误通知到 Lark
    await sendLarkNotification('error', `每日报告失败: ${error}`);

    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
