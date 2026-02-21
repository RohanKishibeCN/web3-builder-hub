import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT * FROM projects 
      WHERE score IS NOT NULL 
      ORDER BY (score->>'total_score')::float DESC 
      LIMIT 3
    `;
    
    console.log('✅ 每日报告 Top 3:', rows);
    
    // TODO: 发送 Telegram 通知
    // await sendTelegramNotification(rows);
    
    return NextResponse.json({ success: true, projects: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
