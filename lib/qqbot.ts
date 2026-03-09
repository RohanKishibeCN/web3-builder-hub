/**
 * Web3 Builder Hub - QQ Bot 模块
 * 使用 QQ 官方 Bot API
 * 
 * 文档: https://bot.q.qq.com/wiki/
 */

// QQ Bot 配置
const APP_ID = process.env.QQ_APP_ID;
const APP_SECRET = process.env.QQ_APP_SECRET;
const USE_SANDBOX = process.env.QQ_USE_SANDBOX === 'true';

// API 基础地址
const API_BASE = USE_SANDBOX 
  ? 'https://sandbox.api.sgroup.qq.com' 
  : 'https://api.sgroup.qq.com';

// 缓存的 access token
let accessToken: string | null = null;
let tokenExpireTime = 0;

interface QQAccessToken {
  access_token: string;
  expires_in: number;
}

interface QQMessage {
  id: string;
  channel_id?: string;
  guild_id?: string;
  author?: {
    id: string;
    username: string;
  };
  content: string;
  timestamp: string;
}

interface QQGroupMessage {
  id: string;
  group_id: string;
  author?: {
    id: string;
    member_openid?: string;
  };
  content: string;
  timestamp: string;
}

/**
 * 获取 QQ Bot Access Token
 */
async function getAccessToken(): Promise<string> {
  // 如果 token 还有效，直接返回
  if (accessToken && Date.now() < tokenExpireTime - 60000) {
    return accessToken;
  }

  if (!APP_ID || !APP_SECRET) {
    throw new Error('QQ_APP_ID or QQ_APP_SECRET not configured');
  }

  try {
    const response = await fetch('https://bots.qq.com/app/getAppAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId: APP_ID,
        clientSecret: APP_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error(`Get access token failed: ${response.status}`);
    }

    const data: QQAccessToken = await response.json();
    accessToken = data.access_token;
    tokenExpireTime = Date.now() + data.expires_in * 1000;

    console.log('[QQ Bot] Access token refreshed');
    return accessToken;
  } catch (error) {
    console.error('[QQ Bot] Get access token error:', error);
    throw error;
  }
}

/**
 * 发送频道消息
 */
export async function sendChannelMessage(
  channelId: string,
  content: string,
  msgId?: string
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const body: any = {
      content,
      msg_type: 0, // 文本消息
    };

    // 如果是回复消息，需要引用原消息
    if (msgId) {
      body.msg_id = msgId;
    }

    const response = await fetch(
      `${API_BASE}/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `QQBot ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[QQ Bot] Send channel message failed:', error);
      return false;
    }

    console.log('[QQ Bot] Channel message sent');
    return true;
  } catch (error) {
    console.error('[QQ Bot] Send channel message error:', error);
    return false;
  }
}

/**
 * 发送群消息
 */
export async function sendGroupMessage(
  groupId: string,
  content: string,
  msgId?: string,
  msgSeq?: number
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const body: any = {
      content,
      msg_type: 0, // 文本消息
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (msgId) {
      body.msg_id = msgId;
    }
    if (msgSeq) {
      body.msg_seq = msgSeq;
    }

    const response = await fetch(
      `${API_BASE}/v2/groups/${groupId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `QQBot ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[QQ Bot] Send group message failed:', error);
      return false;
    }

    console.log('[QQ Bot] Group message sent');
    return true;
  } catch (error) {
    console.error('[QQ Bot] Send group message error:', error);
    return false;
  }
}

/**
 * 发送 C2C (私聊) 消息
 */
export async function sendC2CMessage(
  openid: string,
  content: string,
  msgId?: string,
  msgSeq?: number
): Promise<boolean> {
  try {
    const token = await getAccessToken();

    const body: any = {
      content,
      msg_type: 0,
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (msgId) {
      body.msg_id = msgId;
    }
    if (msgSeq) {
      body.msg_seq = msgSeq;
    }

    const response = await fetch(
      `${API_BASE}/v2/users/${openid}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `QQBot ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[QQ Bot] Send C2C message failed:', error);
      return false;
    }

    console.log('[QQ Bot] C2C message sent');
    return true;
  } catch (error) {
    console.error('[QQ Bot] Send C2C message error:', error);
    return false;
  }
}

/**
 * 解析用户指令
 * 支持格式: GO 123, CODE 123
 */
export function parseCommand(text: string): { command: string; projectId: number } | null {
  // 匹配 "GO 123" 或 "CODE 123" 格式
  const match = text.trim().match(/^(GO|CODE)\s+(\d+)$/i);

  if (!match) return null;

  return {
    command: match[1].toUpperCase(),
    projectId: parseInt(match[2]),
  };
}

/**
 * 发送每日报告到 QQ
 */
export async function sendQQDailyReport(
  targetId: string,
  targetType: 'channel' | 'group' | 'c2c',
  projects: Array<{
    id: number;
    title: string;
    url: string;
    score?: any;
    deepDiveResult?: any;
    deadline?: string;
    prizePool?: string;
  }>
): Promise<boolean> {
  if (projects.length === 0) {
    return true;
  }

  // 构建消息内容
  let content = `📊 Web3 Builder Hub 每日精选\n`;
  content += `共 ${projects.length} 个高分项目\n`;
  content += `===================\n\n`;

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const score = p.score?.total_score || 0;
    const track = p.deepeDiveResult?.suggestedTrack || 'Web3';

    content += `${i + 1}. ${p.title}\n`;
    content += `   评分: ${score}/10 | 赛道: ${track}\n`;
    if (p.prizePool) {
      content += `   奖金: ${p.prizePool}\n`;
    }
    if (p.deadline) {
      content += `   截止: ${p.deadline}\n`;
    }
    content += `   链接: ${p.url}\n`;
    content += `   回复 \"GO ${p.id}\" 生成申请文案\n`;
    content += `   回复 \"CODE ${p.id}\" 生成代码模板\n\n`;
  }

  content += `===================\n`;
  content += `更多详情访问: https://web3-builder-hub.vercel.app`;

  // 发送消息
  switch (targetType) {
    case 'channel':
      return sendChannelMessage(targetId, content);
    case 'group':
      return sendGroupMessage(targetId, content);
    case 'c2c':
      return sendC2CMessage(targetId, content);
    default:
      return false;
  }
}

/**
 * 发送系统通知
 */
export async function sendQQNotification(
  targetId: string,
  targetType: 'channel' | 'group' | 'c2c',
  type: 'success' | 'error' | 'warning',
  message: string
): Promise<boolean> {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
  };

  const titles = {
    success: '任务完成',
    error: '任务失败',
    warning: '警告',
  };

  const content = `${icons[type]} ${titles[type]}\n\n${message}\n\n时间: ${new Date().toLocaleString('zh-CN')}`;

  switch (targetType) {
    case 'channel':
      return sendChannelMessage(targetId, content);
    case 'group':
      return sendGroupMessage(targetId, content);
    case 'c2c':
      return sendC2CMessage(targetId, content);
    default:
      return false;
  }
}

/**
 * 发送候选域名确认通知
 */
export async function sendQQCandidateNotification(
  targetId: string,
  targetType: 'channel' | 'group' | 'c2c',
  candidate: {
    id: number;
    domain: string;
    name: string;
    track: string;
    score: number;
    reasons: string[];
    foundOn: string;
  }
): Promise<boolean> {
  let content = `🔍 发现新域名\n`;
  content += `===================\n\n`;
  content += `名称: ${candidate.name}\n`;
  content += `域名: ${candidate.domain}\n`;
  content += `赛道: ${candidate.track}\n`;
  content += `评分: ${candidate.score}/100\n\n`;
  content += `评估理由:\n`;
  candidate.reasons.forEach(r => {
    content += `- ${r}\n`;
  });
  content += `\n发现来源: ${candidate.foundOn}\n\n`;
  content += `回复 \"CONFIRM ${candidate.id}\" 确认加入白名单\n`;
  content += `回复 \"REJECT ${candidate.id}\" 拒绝加入白名单`;

  switch (targetType) {
    case 'channel':
      return sendChannelMessage(targetId, content);
    case 'group':
      return sendGroupMessage(targetId, content);
    case 'c2c':
      return sendC2CMessage(targetId, content);
    default:
      return false;
  }
}
