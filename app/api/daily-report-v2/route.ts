/**
 * Web3 Builder Hub - Daily Report V2 API（优化版）
 * 每日精选推送 - 只推送高质量项目（score >= 8.0）
 * 
 * GET /api/daily-report-v2 - 手动触发
 * Cron: 每天 08:00
 * 
 * 优化点：添加 Lark 推送、QQ Bot 推送
 */

import { NextResponse } from 'next/server';
import { getScoredProjects, getProjectStats } from '@/lib/db';
import { sendDailyReport } from '@/lib/telegram';
import { sendLarkDailyReport, sendLarkNotification } from '@/lib/lark';
import { sendQQDailyReport } from '@/lib/qqbot';
import type { DailyReportResponse } from '@/types/project';

const MIN_SCORE = 8.0;
const MAX_PROJECTS = 5;

// QQ Bot 配置
const QQ_TARGET_ID = process.env.QQ_TARGET_ID;
const QQ_TARGET_TYPE = (process.env.QQ_TARGET_TYPE || 'group') as 'channel' | 'group' | 'c2c';

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

    // 发送 Telegram 推送（如果配置了）
    let telegramSent = false;
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      telegramSent = await sendDailyReport(formattedProjects);
    }

    // 发送 Lark 推送（如果配置了）
    let larkSent = false;
    if (process.env.LARK_WEBHOOK_URL) {
      larkSent = await sendLarkDailyReport(formattedProjects);
      if (!larkSent) {
        await sendLarkNotification('warning', '每日报告 Lark 推送失败，请检查配置');
      }
    }

    // 发送 QQ Bot 推送（如果配置了）
    let qqSent = false;
    if (QQ_TARGET_ID) {
      qqSent = await sendQQDailyReport(QQ_TARGET_ID, QQ_TARGET_TYPE, formattedProjects);
    }

    console.log('=== Daily Report V2 Completed ===', { 
      telegramSent, 
      larkSent, 
      qqSent,
      count: projects.length 
    });

    const response: DailyReportResponse = {
      success: true,
      sent: telegramSent || larkSent || qqSent,
      count: projects.length,
      stats,
    };

    return NextResponse.json({
      ...response,
      telegramSent,
      larkSent,
      qqSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily Report V2 error:', error);

    // 发送错误通知到 Lark
    if (process.env.LARK_WEBHOOK_URL) {
      await sendLarkNotification('error', `每日报告失败: ${error}`);
    }

    return NextResponse.json(
      { success: false, error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
