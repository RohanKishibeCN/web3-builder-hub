/**
 * Web3 Builder Hub - TypeScript 类型定义
 * 统一所有类型
 */

// ==================== 项目状态 ====================

export type ProjectStatus = 
  | 'new'           // 刚发现
  | 'pending_deep_dive'  // 待深度研判
  | 'scored'        // 已评分
  | 'archived';     // 已归档

// ==================== 评分相关 ====================

export interface BaseScore {
  total_score: number;
  prize_score: number;      // 奖金吸引力
  time_roi_score: number;   // 时间性价比
  competition_score: number;// 竞争烈度估算
  trend_score: number;      // 赛道风口
  clarity_score: number;    // 规则清晰度
  reason: string;
}

// ==================== 深度研判结果 ====================

export interface DeepDiveResult {
  // 升级评分
  score: BaseScore;
  
  // 赛道分析
  trackPotential: string;      // 赛道潜力描述
  suggestedTrack: string;      // 建议参与的具体赛道
  
  // 胜率评估
  winProbability: number;      // 预计获奖率 (0-100)
  
  // 参与计划
  participationPlan: string;   // 详细的参与计划
  
  // 技术栈建议
  suggestedTechStack: string[];
  
  // 差异化点
  differentiation: string;
  
  // MVP 路线
  mvpTimeline: {
    day1: string;
    day2: string;
    day3: string;
  };
  
  // 具体的项目创意建议
  projectIdeas?: {
    name: string;
    description: string;
    whyItWins: string;
  }[];
  
  // 风险提示
  riskFlags?: string[];
  
  // 是否可疑
  isSuspicious?: boolean;
  suspicionReason?: string;
}

// ==================== 项目数据结构 ====================

export interface Project {
  id: number;
  title: string;
  url: string;
  summary: string;
  source: string;
  discoveredAt: string;
  deadline: string | null;
  prizePool: string | null;
  status: ProjectStatus;
  score: BaseScore | null;
  deepDiveResult: DeepDiveResult | null;
  createdAt?: string;
}

// ==================== 搜索相关 ====================

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

// ==================== Kimi 提取结果 ====================

export interface ExtractedProject {
  title: string;
  url: string;
  deadline: string | null;  // YYYY-MM-DD 或 null
  prize_pool: string | null;
  summary: string;
  source: string;
}

// ==================== API 响应 ====================

export interface DiscoverResponse {
  success: boolean;
  found: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface DeepDiveResponse {
  success: boolean;
  processed: number;
  successCount: number;
  failed: number;
  highScore: number;
  errors: string[];
}

export interface DailyReportResponse {
  success: boolean;
  sent: boolean;
  count: number;
  stats: {
    total: number;
    new: number;
    pendingDeepDive: number;
    scored: number;
    highScore: number;
  };
}

// ==================== 域名评估 ====================

export interface DomainEvaluation {
  domain: string;
  name: string;
  track: string;
  priority: number;
  score: number;
  reasons: string[];
  shouldAdd: boolean;
}
