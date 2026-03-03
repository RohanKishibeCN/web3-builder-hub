/**
 * Web3 Builder Hub - Telegram 推送封装
 * 统一所有 Telegram 相关操作
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramMessageOptions {
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

// ==================== 基础发送方法 ====================

/**
 * 发送消息到 Telegram
 */
export async function sendTelegramMessage(
  options: TelegramMessageOptions
): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram credentials not configured');
    return { success: false, error: 'Missing Telegram credentials' };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: options.text,
          parse_mode: options.parseMode || 'HTML',
          disable_web_page_preview: options.disableWebPagePreview ?? true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || `HTTP ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Send Telegram message error:', error);
    return { success: false, error: String(error) };
  }
}

// ==================== 格式化方法 ====================

interface ProjectForTelegram {
  id: number;
  title: string;
  url: string;
  score: { total_score: number; reason: string };
  deepDiveResult?: {
    trackPotential: string;
    winProbability: number;
    participationPlan: string;
  };
  deadline?: string;
  prizePool?: string;
}

/**
 * 格式化单个项目消息
 */
export function formatProjectMessage(project: ProjectForTelegram): string {
  const scoreEmoji = project.score.total_score >= 9 ? '🔥' : 
                     project.score.total_score >= 8 ? '⭐' : '📌';
  
  const deadlineStr = project.deadline 
    ? `⏰ 截止: ${new Date(project.deadline).toLocaleDateString('zh-CN')}`
    : '⏰ 截止: 滚动申请';
  
  const prizeStr = project.prizePool ? `💰 ${project.prizePool}` : '';
  
  let message = `${scoreEmoji} <b>${escapeHtml(project.title)}</b>\n`;
  message += `━━━━━━━━━━━━━━\n`;
  message += `🆔 ID: ${project.id}\n`;
  message += `📊 评分: <b>${project.score.total_score}/10</b>\n`;
  message += `${deadlineStr}\n`;
  if (prizeStr) message += `${prizeStr}\n`;
  message += `\n`;
  
  if (project.deepDiveResult) {
    message += `🎯 赛道潜力: ${escapeHtml(project.deepDiveResult.trackPotential)}\n`;
    message += `🏆 预计胜率: ${project.deepDiveResult.winProbability}%\n`;
    message += `\n`;
    
    // 参与计划摘要（前200字）
    const planSummary = project.deepDiveResult.participationPlan.slice(0, 200);
    message += `📋 参与计划:\n${escapeHtml(planSummary)}...\n`;
    message += `\n`;
  }
  
  message += `💡 ${escapeHtml(project.score.reason)}\n`;
  message += `\n`;
  message += `🔗 <a href="${project.url}">查看详情</a>\n`;
  message += `\n`;
  message += `<b>💬 可用指令：</b>\n`;
  message += `<code>GO ${project.id}</code> - 生成申请文案\n`;
  message += `<code>CODE ${project.id}</code> - 生成代码模板\n`;

  return message;
}

/**
 * 发送每日报告
 */
export async function sendDailyReport(projects: ProjectForTelegram[]): Promise<boolean> {
  if (projects.length === 0) {
    await sendTelegramMessage({
      text: '📭 <b>今日无高质量项目</b>\n\n建议手动检查以下来源:\n• Solana Grizzlython\n• ETHGlobal\n• DoraHacks',
      parseMode: 'HTML',
    });
    return true;
  }

  // 发送标题
  await sendTelegramMessage({
    text: `🦞 <b>Web3 Builder Hub - 每日精选</b>\n📅 ${new Date().toLocaleDateString('zh-CN')}\n━━━━━━━━━━━━━━\n`,
    parseMode: 'HTML',
  });

  // 逐个发送项目
  for (const project of projects) {
    await sendTelegramMessage({
      text: formatProjectMessage(project),
      parseMode: 'HTML',
    });
  }

  // 发送总结
  await sendTelegramMessage({
    text: `━━━━━━━━━━━━━━\n<b>共 ${projects.length} 个高价值项目</b>\n<i>回复 "GO [项目名称]" 开始准备申请</i>`,
    parseMode: 'HTML',
  });

  return true;
}

/**
 * 发送系统通知
 */
export async function sendSystemNotification(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string
): Promise<boolean> {
  const emoji = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  }[type];
  
  const result = await sendTelegramMessage({
    text: `${emoji} <b>系统通知</b>\n\n${escapeHtml(message)}`,
    parseMode: 'HTML',
  });
  
  return result.success;
}

// ==================== 候选域名确认 ====================

export interface CandidateForTelegram {
  id: number;
  domain: string;
  name: string;
  track: string;
  score: number;
  reasons: string[];
  foundOn: string;
}

/**
 * 发送候选域名确认消息
 */
export async function sendCandidateForConfirmation(
  candidate: CandidateForTelegram
): Promise<boolean> {
  const trackEmoji: Record<string, string> = {
    'AI': '🤖',
    'Infra': '⚙️',
    'DeFi': '💰',
    'Gaming': '🎮',
    'Social': '👥',
    'Other': '📌',
  };

  const emoji = trackEmoji[candidate.track] || '📌';
  const priorityEmoji = candidate.score >= 80 ? '🔥' : candidate.score >= 60 ? '⭐' : '📌';

  let message = `${priorityEmoji} <b>发现新候选域名</b>\n\n`;
  message += `${emoji} <b>${escapeHtml(candidate.name)}</b>\n`;
  message += `🌐 ${candidate.domain}\n`;
  message += `🏷️ 赛道: ${candidate.track}\n`;
  message += `📊 评分: ${candidate.score}/100\n\n`;

  if (candidate.reasons.length > 0) {
    message += `💡 评估理由:\n`;
    candidate.reasons.forEach(r => {
      message += `  • ${escapeHtml(r)}\n`;
    });
    message += `\n`;
  }

  message += `🔗 发现来源: ${escapeHtml(candidate.foundOn)}\n\n`;
  message += `<i>回复 "CONFIRM ${candidate.id}" 确认加入白名单</i>\n`;
  message += `<i>回复 "REJECT ${candidate.id}" 拒绝</i>`;

  const result = await sendTelegramMessage({
    text: message,
    parseMode: 'HTML',
  });

  return result.success;
}

/**
 * 发送白名单更新通知
 */
export async function sendWhitelistUpdateNotification(
  action: 'confirmed' | 'rejected',
  domain: string,
  name: string
): Promise<boolean> {
  const emoji = action === 'confirmed' ? '✅' : '❌';
  const text = action === 'confirmed' ? '已加入白名单' : '已拒绝';

  const result = await sendTelegramMessage({
    text: `${emoji} <b>${escapeHtml(name)}</b> (${domain}) ${text}`,
    parseMode: 'HTML',
  });

  return result.success;
}

// ==================== 工具函数 ====================

/**
 * HTML 转义（防止 Telegram 解析错误）
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
