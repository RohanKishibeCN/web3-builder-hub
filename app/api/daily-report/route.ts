import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    })
  });
  return res.json();
}

export async function GET() {
  try {
    // 获取 Top 3 项目
    const { rows: projects } = await sql`
      SELECT * FROM projects 
      WHERE score IS NOT NULL 
      ORDER BY (score->>'total_score')::float DESC 
      LIMIT 3
    `;

    // 生成报告
    let report = '🦞 <b>Web3 Builder 每日情报</b>\n\n';
    report += `<b>今日 Top 3 推荐：</b>\n\n`;

    projects.forEach((p: any, i: number) => {
      report += `${i + 1}. <b>${p.title}</b>\n`;
      report += `   评分: ${p.score?.total_score}/10\n`;
      report += `   奖金: ${p.prize_pool || '待定'}\n`;
      report += `   截止: ${p.deadline ? new Date(p.deadline).toLocaleDateString('zh-CN') : '待定'}\n`;
      report += `   <a href="${p.url}">查看详情</a>\n\n`;
    });

    report += `\n📊 更多项目: https://web3-builder-hub.vercel.app/`;

    // 发送 Telegram
    await sendTelegramMessage(report);

    return NextResponse.json({ 
      success: true, 
      message: '日报已发送',
      projects: projects.length 
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
