/**
 * Web3 Builder Hub - Telegram Webhook API（Phase 3）
 * 处理 Telegram 消息回复
 * 
 * POST /api/telegram-webhook
 */

import { NextResponse } from 'next/server';

interface TelegramMessage {
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
    };
    text?: string;
    date: number;
  };
}

/**
 * 解析用户指令
 */
function parseCommand(text: string): { command: string; projectId: number } | null {
  // 匹配 "GO 123" 或 "CODE 123" 格式
  const match = text.trim().match(/^(GO|CODE)\s+(\d+)$/i);
  
  if (!match) return null;
  
  return {
    command: match[1].toUpperCase(),
    projectId: parseInt(match[2]),
  };
}

/**
 * 发送回复消息
 */
async function sendReply(chatId: number, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

/**
 * 生成申请文案
 */
async function generateProposal(projectId: number): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/generate-proposal?projectId=${projectId}`);
    const data = await response.json();
    
    if (!data.success) {
      return `❌ 生成失败: ${data.error}`;
    }
    
    return `✅ <b>申请文案已生成</b>\n\n项目: ${data.projectTitle}\n\n${data.proposal.slice(0, 1000)}...\n\n<i>完整文案请查看 API 响应</i>`;
  } catch (error) {
    return `❌ 生成失败: ${error}`;
  }
}

/**
 * 生成代码模板
 */
async function generateTemplate(projectId: number): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/generate-template?projectId=${projectId}`);
    const data = await response.json();
    
    if (!data.success) {
      return `❌ 生成失败: ${data.error}`;
    }
    
    const files = data.keyFiles?.map((f: any) => `• ${f.path}`).join('\n') || '暂无文件';
    
    return `✅ <b>代码模板已生成</b>\n\n项目: ${data.projectTitle}\n\n<b>文件结构：</b>\n${files}\n\n<i>完整代码请查看 API 响应</i>`;
  } catch (error) {
    return `❌ 生成失败: ${error}`;
  }
}

export async function POST(request: Request) {
  try {
    const body: TelegramMessage = await request.json();
    
    const message = body.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // 解析指令
    const command = parseCommand(text);
    
    if (!command) {
      // 不是有效指令，忽略
      return NextResponse.json({ ok: true });
    }

    // 发送处理中消息
    await sendReply(chatId, '⏳ 正在生成，请稍候...');

    // 执行指令
    let replyText = '';
    
    if (command.command === 'GO') {
      replyText = await generateProposal(command.projectId);
    } else if (command.command === 'CODE') {
      replyText = await generateTemplate(command.projectId);
    }

    // 发送结果
    await sendReply(chatId, replyText);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Telegram Webhook is running',
    usage: 'Set this URL in your Telegram Bot webhook settings'
  });
}
