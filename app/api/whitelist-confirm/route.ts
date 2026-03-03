/**
 * Web3 Builder Hub - 白名单确认 API
 * 处理 Telegram 确认/拒绝回复
 * 
 * POST /api/whitelist-confirm
 * Body: { action: 'confirm' | 'reject', id: number }
 */

import { NextResponse } from 'next/server';
import { confirmCandidate } from '@/lib/db';
import { sendWhitelistUpdateNotification } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id } = body;

    if (!action || !id || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    // 获取候选信息（这里简化处理，实际需要查询数据库获取名称）
    // 实际使用时，你可能需要先从数据库查询候选信息
    
    // 确认或拒绝
    const success = await confirmCandidate(id, action);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update candidate' },
        { status: 500 }
      );
    }

    // 发送通知
    // 注意：这里需要查询数据库获取 domain 和 name
    // await sendWhitelistUpdateNotification(action, domain, name);

    return NextResponse.json({
      success: true,
      action,
      id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Whitelist confirm error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
