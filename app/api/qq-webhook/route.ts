/**
 * Web3 Builder Hub - QQ Bot Webhook API
 * 处理 QQ 消息回调
 * 
 * POST /api/qq-webhook
 * 
 * 需要在 QQ 开放平台配置回调地址
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { callLLM, extractJSON } from '@/lib/llm-client';
import type { Project } from '@/types/project';

// QQ Bot 配置
const APP_ID = process.env.QQ_APP_ID;
const APP_SECRET = process.env.QQ_APP_SECRET;

// 目标配置（从哪里接收消息，发送到哪里）
const QQ_TARGET_ID = process.env.QQ_TARGET_ID; // 频道ID/群ID/用户ID
const QQ_TARGET_TYPE = (process.env.QQ_TARGET_TYPE || 'group') as 'channel' | 'group' | 'c2c';

interface QQWebhookPayload {
  op?: number;
  d?: {
    id?: string;
    content?: string;
    channel_id?: string;
    group_id?: string;
    author?: {
      id: string;
      username?: string;
    };
    member?: {
      openid?: string;
    };
  };
  t?: string; // 事件类型
}

/**
 * 验证签名（生产环境建议启用）
 */
function verifySignature(body: string, signature: string, timestamp: string): boolean {
  // QQ 官方验证逻辑
  // 参考: https://bot.q.qq.com/wiki/develop/api/openapi/http callback.html
  // 这里简化处理，生产环境需要实现完整验证
  return true;
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
 * 解析用户指令
 */
function parseCommand(text: string): { command: string; projectId: number } | null {
  const match = text.trim().match(/^(GO|CODE|CONFIRM|REJECT)\s+(\d+)$/i);

  if (!match) return null;

  return {
    command: match[1].toUpperCase(),
    projectId: parseInt(match[2]),
  };
}

/**
 * 获取 Access Token
 */
async function getAccessToken(): Promise<string> {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('QQ_APP_ID or QQ_APP_SECRET not configured');
  }

  const response = await fetch('https://bots.qq.com/app/getAppAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: APP_ID,
      clientSecret: APP_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Get access token failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * 发送 QQ 消息
 */
async function sendQQMessage(
  targetId: string,
  targetType: 'channel' | 'group' | 'c2c',
  content: string,
  msgId?: string
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const useSandbox = process.env.QQ_USE_SANDBOX === 'true';
    const apiBase = useSandbox 
      ? 'https://sandbox.api.sgroup.qq.com' 
      : 'https://api.sgroup.qq.com';

    let url: string;
    let body: any = {
      content,
      msg_type: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (msgId) {
      body.msg_id = msgId;
    }

    switch (targetType) {
      case 'channel':
        url = `${apiBase}/channels/${targetId}/messages`;
        break;
      case 'group':
        url = `${apiBase}/v2/groups/${targetId}/messages`;
        if (msgId) body.msg_seq = Date.now(); // 群消息需要 msg_seq
        break;
      case 'c2c':
        url = `${apiBase}/v2/users/${targetId}/messages`;
        if (msgId) body.msg_seq = Date.now();
        break;
      default:
        return false;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `QQBot ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[QQ Webhook] Send message failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[QQ Webhook] Send message error:', error);
    return false;
  }
}

/**
 * 生成申请文案
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
    const maxLength = 2000; // QQ 消息长度限制
    const displayProposal = proposal.length > maxLength 
      ? proposal.slice(0, maxLength) + '\n\n...(内容已截断)' 
      : proposal;

    return `✅ 申请文案已生成\n\n项目: ${project.title}\n赛道: ${deepDive?.suggestedTrack || 'Web3'}\n胜率: ${deepDive?.winProbability || 'N/A'}%\n\n${displayProposal}`;
  } catch (error) {
    console.error('Generate proposal error:', error);
    return `❌ 生成失败: ${error}`;
  }
}

/**
 * 生成代码模板
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
    { "path": "contracts/Main.sol", "content": "// SPDX-License-Identifier: MIT..." }
  ]
}

只输出 JSON，不要其他文字。`;

    const response = await callLLM(prompt, { temperature: 0.5 });
    const template = extractJSON(response);

    const files = template.keyFiles?.map((f: any) => `• ${f.path}`).join('\n') || '暂无文件';

    return `✅ 代码模板已生成\n\n项目: ${project.title}\n技术栈: ${stack.join(', ')}\n\n文件结构:\n${files}\n\nREADME 预览:\n${template.readme?.slice(0, 500) || 'N/A'}...`;
  } catch (error) {
    console.error('Generate template error:', error);
    return `❌ 生成失败: ${error}`;
  }
}

/**
 * 确认白名单
 */
async function confirmWhitelist(id: number, action: 'confirm' | 'reject'): Promise<string> {
  try {
    const result = await sql`
      UPDATE dynamic_whitelist 
      SET status = ${action === 'confirm' ? 'active' : 'rejected'}, 
          confirmed_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING domain, name
    `;

    if (result.rows.length === 0) {
      return `❌ 候选域名不存在 (ID: ${id})`;
    }

    const { domain, name } = result.rows[0];

    if (action === 'confirm') {
      return `✅ 已确认加入白名单\n\n名称: ${name}\n域名: ${domain}`;
    } else {
      return `❌ 已拒绝加入白名单\n\n名称: ${name}\n域名: ${domain}`;
    }
  } catch (error) {
    console.error('Confirm whitelist error:', error);
    return `❌ 操作失败: ${error}`;
  }
}

/**
 * 处理消息
 */
async function handleMessage(
  payload: QQWebhookPayload,
  targetId: string,
  targetType: 'channel' | 'group' | 'c2c'
): Promise<void> {
  const content = payload.d?.content || '';
  const msgId = payload.d?.id;

  console.log(`[QQ Webhook] Received: ${content}`);

  // 解析指令
  const command = parseCommand(content);

  if (!command) {
    // 不是有效指令，忽略
    return;
  }

  console.log(`[QQ Webhook] Command: ${command.command} ${command.projectId}`);

  // 发送处理中消息
  await sendQQMessage(targetId, targetType, '⏳ 正在生成，请稍候...', msgId);

  // 执行指令
  let replyText = '';

  switch (command.command) {
    case 'GO':
      replyText = await generateProposal(command.projectId);
      break;
    case 'CODE':
      replyText = await generateTemplate(command.projectId);
      break;
    case 'CONFIRM':
      replyText = await confirmWhitelist(command.projectId, 'confirm');
      break;
    case 'REJECT':
      replyText = await confirmWhitelist(command.projectId, 'reject');
      break;
    default:
      replyText = '❌ 未知指令';
  }

  // 发送结果
  await sendQQMessage(targetId, targetType, replyText, msgId);
}

export async function POST(request: Request) {
  try {
    // 验证签名（可选）
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');

    const body = await request.text();

    if (signature && timestamp) {
      const isValid = verifySignature(body, signature, timestamp);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload: QQWebhookPayload = JSON.parse(body);

    // 处理验证请求（QQ 首次配置回调时会发送验证请求）
    if (payload.op === 13) {
      // 返回 challenge 进行验证
      return NextResponse.json({ 
        plain_token: payload.d?.id 
      });
    }

    // 只处理消息事件
    if (payload.t !== 'MESSAGE_CREATE' && payload.t !== 'GROUP_AT_MESSAGE_CREATE' && payload.t !== 'C2C_MESSAGE_CREATE') {
      return NextResponse.json({ ok: true });
    }

    // 确定目标
    let targetId = QQ_TARGET_ID;
    let targetType = QQ_TARGET_TYPE;

    // 从消息中提取目标信息
    if (payload.d?.channel_id) {
      targetId = payload.d.channel_id;
      targetType = 'channel';
    } else if (payload.d?.group_id) {
      targetId = payload.d.group_id;
      targetType = 'group';
    } else if (payload.d?.author?.id) {
      targetId = payload.d.author.id;
      targetType = 'c2c';
    }

    if (!targetId) {
      console.error('[QQ Webhook] No target ID found');
      return NextResponse.json({ ok: false, error: 'No target' }, { status: 400 });
    }

    // 处理消息
    await handleMessage(payload, targetId, targetType);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[QQ Webhook] Error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'QQ Bot Webhook is running',
    usage: 'Configure this URL in QQ Open Platform',
    endpoints: {
      webhook: '/api/qq-webhook',
      methods: ['POST'],
    },
    commands: [
      'GO <projectId> - 生成申请文案',
      'CODE <projectId> - 生成代码模板',
      'CONFIRM <id> - 确认加入白名单',
      'REJECT <id> - 拒绝加入白名单',
    ],
  });
}
