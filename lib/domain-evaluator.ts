/**
 * Web3 Builder Hub - 域名质量评估器
 * 使用大模型自动评估新发现的域名
 */

import { detectTrack, getTrackPriorityScore, TRACKS } from './whitelist';

export interface DomainEvaluation {
  domain: string;
  name: string;
  track: string;
  priority: number;
  score: number;
  reasons: string[];
  shouldAdd: boolean;
}

function getKimiKey(): string {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error('KIMI_API_KEY not configured');
  return key;
}

export async function evaluateDomain(
  domain: string,
  context?: {
    title?: string;
    description?: string;
    foundOn?: string;
  }
): Promise<DomainEvaluation | null> {
  const KIMI_API_KEY = getKimiKey();

  const prompt = `评估以下 Web3 项目域名是否值得加入白名单。

域名: ${domain}
${context?.title ? `标题: ${context.title}` : ''}
${context?.description ? `描述: ${context.description}` : ''}
${context?.foundOn ? `发现来源: ${context.foundOn}` : ''}

请从以下维度评估:
1. 项目知名度 (是否有大量用户/开发者)
2. 团队背景 (是否有知名投资人/创始人)
3. 技术实力 (GitHub 活跃度、代码质量)
4. 社区活跃度 (Twitter/X 粉丝数、互动率)
5. 生态价值 (是否对 Web3 有重要贡献)

输出严格的 JSON 格式:
{
  "name": "项目中文名",
  "track": "赛道 (AI/Infra/DeFi/Gaming/Social/Other)",
  "priority": 1-3,
  "score": 0-100,
  "reasons": ["理由1", "理由2"],
  "shouldAdd": true/false
}

评分标准:
- score >= 80: 强烈推荐加入
- score 60-79: 可以考虑加入
- score < 60: 不推荐加入

只输出 JSON，不要其他文字。`;

  try {
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'kimi-k2-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kimi API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.log('Kimi response:', content);
      return null;
    }

    const parsed = JSON.parse(content.slice(startIdx, endIdx + 1));

    let adjustedPriority = parsed.priority;
    if (parsed.track === 'AI' || parsed.track === 'Infra') {
      adjustedPriority = Math.max(1, adjustedPriority - 1);
    }

    return {
      domain,
      name: parsed.name || domain,
      track: parsed.track || 'Other',
      priority: adjustedPriority,
      score: parsed.score || 0,
      reasons: parsed.reasons || [],
      shouldAdd: parsed.shouldAdd || false,
    };
  } catch (error) {
    console.error('Evaluate domain error:', error);
    return null;
  }
}

export async function evaluateDomainsBatch(
  domains: Array<{
    domain: string;
    title?: string;
    description?: string;
    foundOn?: string;
  }>
): Promise<DomainEvaluation[]> {
  const results: DomainEvaluation[] = [];

  for (const item of domains) {
    const evaluation = await evaluateDomain(item.domain, {
      title: item.title,
      description: item.description,
      foundOn: item.foundOn,
    });

    if (evaluation) {
      results.push(evaluation);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

export function quickEvaluate(domain: string, text: string): {
  track: string;
  priority: number;
  shouldConsider: boolean;
} {
  const tracks = detectTrack(text);
  const track = tracks.length > 0 ? tracks[0] : 'Other';
  
  const trackPriority = getTrackPriorityScore(tracks);
  
  const shouldConsider = trackPriority <= 2;

  return {
    track,
    priority: trackPriority,
    shouldConsider,
  };
}
