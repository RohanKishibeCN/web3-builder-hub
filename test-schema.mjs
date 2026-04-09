import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

const DeepDiveSchema = z.object({
  score: z.object({
    total_score: z.number().min(1).max(10).describe('综合总分(1-10)'),
    prize_score: z.number().min(1).max(10).describe('奖金吸引力(1-10)'),
    time_roi_score: z.number().min(1).max(10).describe('时间性价比(1-10)'),
    competition_score: z.number().min(1).max(10).describe('竞争烈度估算(1-10)'),
    trend_score: z.number().min(1).max(10).describe('赛道风口(1-10)'),
    clarity_score: z.number().min(1).max(10).describe('规则清晰度(1-10)'),
    reason: z.string().describe('简短中文评价(50字内)')
  }),
  trackPotential: z.string().describe('赛道潜力分析(50字内)'),
  suggestedTrack: z.string().describe('建议参与的具体赛道'),
  winProbability: z.number().min(0).max(100).describe('预计获奖率(0-100)'),
  participationPlan: z.string().describe('500字参与计划'),
  suggestedTechStack: z.array(z.string()).describe('推荐技术栈'),
  differentiation: z.string().describe('差异化点(100字内)'),
  mvpTimeline: z.object({
    day1: z.string(),
    day2: z.string(),
    day3: z.string()
  }),
  projectIdeas: z.array(z.object({
    name: z.string().describe('项目创意名称 (如: Solana Pay 自动分账插件)'),
    description: z.string().describe('一句话说明产品形态'),
    whyItWins: z.string().describe('为什么这个点子容易拿奖')
  })).optional(),
  riskFlags: z.array(z.string()).optional(),
  isSuspicious: z.boolean().optional(),
  suspicionReason: z.string().optional()
});

console.log(JSON.stringify(zodToJsonSchema(DeepDiveSchema), null, 2));
