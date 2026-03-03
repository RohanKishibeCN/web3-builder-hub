/**
 * Web3 Builder Hub - Lark (飞书) 推送模块
 * 支持文本消息和卡片消息推送
 */

import type { Project } from '@/types/project';

const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL;

interface LarkMessageResponse {
  code: number;
  msg: string;
  data?: any;
}

/**
 * 发送纯文本消息到 Lark
 */
export async function sendLarkMessage(text: string): Promise<{ success: boolean; error?: string }> {
  if (!LARK_WEBHOOK_URL) {
    console.log('[Lark] LARK_WEBHOOK_URL not configured, skipping');
    return { success: true };
  }

  try {
    const response = await fetch(LARK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'text',
        content: {
          text,
        },
      }),
    });

    const data: LarkMessageResponse = await response.json();

    if (data.code !== 0) {
      console.error('[Lark] Send message failed:', data);
      return { success: false, error: data.msg };
    }

    console.log('[Lark] Message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[Lark] Send message error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 发送卡片消息到 Lark
 */
export async function sendLarkCard(card: any): Promise<{ success: boolean; error?: string }> {
  if (!LARK_WEBHOOK_URL) {
    console.log('[Lark] LARK_WEBHOOK_URL not configured, skipping');
    return { success: true };
  }

  try {
    const response = await fetch(LARK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_type: 'interactive',
        card,
      }),
    });

    const data: LarkMessageResponse = await response.json();

    if (data.code !== 0) {
      console.error('[Lark] Send card failed:', data);
      return { success: false, error: data.msg };
    }

    console.log('[Lark] Card sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[Lark] Send card error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 格式化项目卡片
 */
export function formatLarkProjectCard(project: {
  id: number;
  title: string;
  url: string;
  score?: any;
  deepDiveResult?: any;
  deadline?: string;
  prizePool?: string;
}): any {
  const score = project.score?.total_score || 0;
  const scoreColor = score >= 9 ? 'red' : score >= 8 ? 'orange' : 'blue';
  
  const track = project.deepDiveResult?.suggestedTrack || 'Web3';
  const winProb = project.deepDiveResult?.winProbability || 0;
  
  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: '🎯 ' + project.title,
      },
      subtitle: {
        tag: 'plain_text',
        content: `${track} · 评分: ${score}/10 · 胜率: ${winProb}%`,
      },
      template: scoreColor,
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**赛道潜力:** ${project.deepDiveResult?.trackPotential || 'N/A'}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**差异化:** ${project.deepDiveResult?.differentiation || 'N/A'}`,
        },
      },
      ...(project.deadline ? [{
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**截止:** ${project.deadline}`,
        },
      }] : []),
      ...(project.prizePool ? [{
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**奖金:** ${project.prizePool}`,
        },
      }] : []),
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '查看详情',
            },
            type: 'primary',
            url: project.url,
          },
        ],
      },
    ],
  };
}

/**
 * 发送每日报告到 Lark
 */
export async function sendLarkDailyReport(projects: any[]): Promise<boolean> {
  if (!LARK_WEBHOOK_URL || projects.length === 0) {
    return true;
  }

  try {
    // 发送标题
    await sendLarkMessage(`📊 Web3 Builder Hub 每日精选\n共 ${projects.length} 个高分项目`);

    // 发送每个项目的卡片
    for (const project of projects) {
      const card = formatLarkProjectCard(project);
      await sendLarkCard(card);
      await new Promise(r => setTimeout(r, 200)); // 避免频率限制
    }

    return true;
  } catch (error) {
    console.error('[Lark] Send daily report error:', error);
    return false;
  }
}

/**
 * 发送系统通知到 Lark
 */
export async function sendLarkNotification(
  type: 'success' | 'error' | 'warning',
  message: string
): Promise<boolean> {
  if (!LARK_WEBHOOK_URL) {
    return true;
  }

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

  try {
    const card = {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: `${icons[type]} ${titles[type]}`,
        },
        template: type === 'success' ? 'green' : type === 'error' ? 'red' : 'yellow',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: message,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `时间: ${new Date().toLocaleString('zh-CN')}`,
          },
        },
      ],
    };

    const result = await sendLarkCard(card);
    return result.success;
  } catch (error) {
    console.error('[Lark] Send notification error:', error);
    return false;
  }
}

/**
 * 发送候选域名确认通知到 Lark
 */
export async function sendLarkCandidateNotification(candidate: {
  id: number;
  domain: string;
  name: string;
  track: string;
  score: number;
  reasons: string[];
  foundOn: string;
}): Promise<boolean> {
  if (!LARK_WEBHOOK_URL) {
    return true;
  }

  try {
    const card = {
      config: {
        wide_screen_mode: true,
      },
      header: {
        title: {
          tag: 'plain_text',
          content: '🔍 发现新域名',
        },
        subtitle: {
          tag: 'plain_text',
          content: `${candidate.name} (${candidate.domain})`,
        },
        template: 'blue',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**赛道:** ${candidate.track}\n**评分:** ${candidate.score}/100`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**评估理由:**\n${candidate.reasons.map(r => `- ${r}`).join('\n')}`,
          },
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**发现来源:** ${candidate.foundOn}`,
          },
        },
        {
          tag: 'hr',
        },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: '请在 Telegram 中回复 **CONFIRM ' + candidate.id + '** 确认加入白名单',
          },
        },
      ],
    };

    const result = await sendLarkCard(card);
    return result.success;
  } catch (error) {
    console.error('[Lark] Send candidate notification error:', error);
    return false;
  }
}
