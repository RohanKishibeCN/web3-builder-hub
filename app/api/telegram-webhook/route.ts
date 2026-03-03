/**
 * Web3 Builder Hub - Telegram Webhook API（Phase 3 优化版）
 * 处理 Telegram 消息回复
 * 
 * POST /api/telegram-webhook
 * 
 * 优化点：直接使用内部函数调用 LLM，避免 HTTP 超时问题
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { callLLM, extractJSON } from '@/lib/llm-client';
import type { Project } from '@/types/project';

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

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Send reply error:', error);
  }
}

/**
 * 从数据库获取项目
 */
async function getProjectById(id: number): Promise<Project | null> {
  const result = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    source: row.source,
    discoveredAt: row.discovered_at,
    deadline: row.deadline,
    prizePool: row.prize_pool,
    status: row.status,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at,
  };
}

/**
 * 生成申请文案（直接使用 LLM 客户端）
 */
async function generateProposal(projectId: number): Promise<string> {
  try {
    const project = await getProjectById(projectId);
    
    if (!project) {
      return `❌ 项目不存在 (ID: ${projectId})`;
    }

    const deepDive = project.deepDiveResult;
    
    const prompt = `作为 Web3 Builder，为以下项目生成一份专业的申请文案。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 赛道: ${deepDive?.suggestedTrack || 'Web3'}
- 建议技术栈: ${deepDive?.suggestedTechStack?.join(', ') || 'Solidity, React'}

深度分析:
- 赛道潜力: ${deepDive?.trackPotential || ''}
- 差异化点: ${deepDive?.differentiation || ''}
- 参与计划: ${deepDive?.participationPlan?.slice(0, 500) || ''}

请生成一份完整的申请文案，包含:
1. 项目概述（100字）
2. 技术方案（200字）
3. 团队介绍（100字）
4. 预期成果（100字）
5. 为什么适合这个赛道（100字）

文案风格：专业、简洁、有说服力。直接输出文案内容，不要加标题。`;

    const proposal = await callLLM(prompt, { temperature: 0.7 });

    // 截断过长的文案
    const maxLength = 3500;
    const displayProposal = proposal.length > maxLength 
      ? proposal.slice(0, maxLength) + '\n\n...(内容已截断)' 
      : proposal;

    return `✅ <b>申请文案已生成</b>

<b>项目:</b> ${project.title}
<b>赛道:</b> ${deepDive?.suggestedTrack || 'Web3'}
<b>胜率:</b> ${deepDive?.winProbability || 'N/A'}%

${displayProposal}`;
  } catch (error) {
    console.error('Generate proposal error:', error);
    return `❌ 生成失败: ${error}`;
  }
}

/**
 * 生成代码模板（直接使用 LLM 客户端）
 */
async function generateTemplate(projectId: number): Promise<string> {
  try {
    const project = await getProjectById(projectId);
    
    if (!project) {
      return `❌ 项目不存在 (ID: ${projectId})`;
    }

    const deepDive = project.deepDiveResult;
    const stack = deepDive?.suggestedTechStack || ['Solidity', 'React', 'Ethers.js'];
    
    const prompt = `作为 Web3 开发者，为以下项目生成一个 starter code 模板。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 赛道: ${deepDive?.suggestedTrack || 'Web3'}
- 技术栈: ${stack.join(', ')}

MVP 计划:
- Day 1: ${deepDive?.mvpTimeline?.day1 || 'Setup'}
- Day 2: ${deepDive?.mvpTimeline?.day2 || 'Core features'}
- Day 3: ${deepDive?.mvpTimeline?.day3 || 'Polish'}

请生成:
1. README.md 内容（包含项目介绍、安装步骤、使用说明）
2. 文件结构列表
3. 核心文件代码（contract、frontend config、test 等）

输出格式（严格的 JSON）:
{
  "readme": "# 项目名称...",
  "fileStructure": ["contracts/", "frontend/", "README.md"],
  "keyFiles": [
    { "path": "contracts/Main.sol", "content": "// SPDX-License-Identifier: MIT..." },
    { "path": "frontend/package.json", "content": '{"name": "..."}' }
  ]
}

只输出 JSON，不要其他文字。`;

    const response = await callLLM(prompt, { temperature: 0.5 });
    const template = extractJSON(response);

    const files = template.keyFiles?.map((f: any) => `• ${f.path}`).join('\n') || '暂无文件';
    
    return `✅ <b>代码模板已生成</b>

<b>项目:</b> ${project.title}
<b>技术栈:</b> ${stack.join(', ')}

<b>文件结构：</b>
${files}

<b>README 预览：</b>
<pre>${template.readme?.slice(0, 500) || 'N/A'}...</pre>

<i>完整代码请查看 API 响应</i>`;
  } catch (error) {
    console.error('Generate template error:', error);
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

    console.log(`[Telegram Webhook] Received command: ${command.command} ${command.projectId}`);

    // 发送处理中消息
    await sendReply(chatId, '⏳ 正在生成，请稍候...');

    // 执行指令（直接调用内部函数，避免 HTTP 超时）
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
    usage: 'Set this URL in your Telegram Bot webhook settings',
    commands: [
      'GO <projectId> - 生成申请文案',
      'CODE <projectId> - 生成代码模板',
    ],
  });
}
