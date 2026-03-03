/**
 * Web3 Builder Hub - 智能白名单系统
 * 
 * 设计理念：
 * - 固定白名单：公链 + 知名机构（高信任度）
 * - 动态白名单：热门项目（数据库持久化）
 * - 候选名单：新发现域名（等待确认）
 * - 大模型质量评估：自动研判是否值得加入
 */

// ==================== 固定白名单 ====================

/** Tier 1: 公链生态（最高优先级） */
export const CHAIN_WHITELIST = [
  'ethereum.foundation',
  'solana.com',
  'base.org',
  'sui.io',
  'avax.network',
  'polygon.technology',
  'arbitrum.io',
  'optimism.io',
  'zksync.io',
  'starknet.io',
  'mantle.xyz',
  'linea.build',
  'scroll.io',
] as const;

/** Tier 2: 知名机构（高优先级） */
export const INSTITUTION_WHITELIST = [
  'ethglobal.com',
  'dorahacks.io',
  'gitcoin.co',
  'encode.club',
  'devpost.com',
  'taikai.network',
  'devfolio.co',
  'superteam.fun',
  'colosseum.org',
] as const;

/** 所有固定白名单 */
export const STATIC_WHITELIST = [...CHAIN_WHITELIST, ...INSTITUTION_WHITELIST] as const;

// ==================== 赛道配置 ====================

/** 赛道定义 */
export const TRACKS = {
  AI: {
    keywords: ['ai', 'ai-agent', 'llm', 'ml', 'machine learning', 'prediction', 'automation', 'neural'],
    domains: ['bittensor.com', 'fetch.ai', 'oceanprotocol.com', 'ritual.net', 'akash.network', 'rendernetwork.com'],
    priority: 1, // 最高优先级
  },
  Infra: {
    keywords: ['oracle', 'bridge', 'storage', 'indexing', 'rpc', 'sequencer', 'middleware', 'data'],
    domains: ['chain.link', 'pyth.network', 'thegraph.com', 'ipfs.io', 'filecoin.io', 'arweave.org', 'ceramic.network'],
    priority: 1, // 最高优先级
  },
  DeFi: {
    keywords: ['dex', 'lending', 'yield', 'derivatives', 'amm', 'vault', 'liquidity', 'swap'],
    domains: ['uniswap.org', 'aave.com', 'lido.fi', 'curve.fi', 'compound.finance', 'makerdao.com'],
    priority: 2,
  },
  Gaming: {
    keywords: ['gamefi', 'gaming', 'nft-game', 'metaverse', 'play-to-earn', 'game'],
    domains: ['immutable.com', 'gala.games', 'axieinfinity.com', 'sandbox.game', 'decentraland.org'],
    priority: 3,
  },
  Social: {
    keywords: ['socialfi', 'social', 'dao', 'identity', 'reputation', 'community'],
    domains: ['lens.xyz', 'farcaster.xyz', 'cyberconnect.me', 'worldcoin.org'],
    priority: 3,
  },
} as const;

export type TrackType = keyof typeof TRACKS;

// ==================== 过滤配置 ====================

export const MIN_PRIZE_USD = 5000;
export const MIN_DAYS_LEFT = 7;

export const SCAM_KEYWORDS = [
  'guaranteed returns', 'get rich quick', '100% profit',
  'no risk investment', 'send crypto get double',
  'pump and dump', 'ponzi', 'pyramid', 'mlm',
  'guaranteed airdrop', 'instant withdrawal',
] as const;

// ==================== 工具函数 ====================

/**
 * 检查域名是否在固定白名单
 */
export function isStaticWhitelisted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return STATIC_WHITELIST.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * 获取域名的优先级
 * @returns 1-3, 0=不在白名单
 */
export function getDomainPriority(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (CHAIN_WHITELIST.some(d => hostname === d || hostname.endsWith(`.${d}`))) return 1;
    if (INSTITUTION_WHITELIST.some(d => hostname === d || hostname.endsWith(`.${d}`))) return 2;
    
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 识别赛道
 */
export function detectTrack(text: string): TrackType[] {
  const lowerText = text.toLowerCase();
  const tracks: TrackType[] = [];
  
  for (const [track, config] of Object.entries(TRACKS)) {
    if (config.keywords.some(k => lowerText.includes(k.toLowerCase()))) {
      tracks.push(track as TrackType);
    }
  }
  
  return tracks;
}

/**
 * 获取赛道优先级分数
 */
export function getTrackPriorityScore(tracks: TrackType[]): number {
  if (tracks.length === 0) return 0;
  
  // 取最高优先级
  const priorities = tracks.map(t => TRACKS[t].priority);
  return Math.min(...priorities);
}

/**
 * 验证项目基础信息
 */
export function validateProjectBasic(project: {
  title?: string;
  url?: string;
  summary?: string;
  deadline?: string | null;
}): { valid: boolean; reason?: string } {
  if (!project.title || !project.url) {
    return { valid: false, reason: 'Missing title or URL' };
  }

  try {
    new URL(project.url);
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }

  // 检查 scam 关键词
  const textToCheck = `${project.title} ${project.summary || ''}`.toLowerCase();
  for (const keyword of SCAM_KEYWORDS) {
    if (textToCheck.includes(keyword.toLowerCase())) {
      return { valid: false, reason: `Scam keyword: ${keyword}` };
    }
  }

  // 检查截止日期
  if (project.deadline) {
    const deadline = new Date(project.deadline);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + MIN_DAYS_LEFT);
    if (deadline < minDate) {
      return { valid: false, reason: 'Deadline too soon' };
    }
  }

  return { valid: true };
}

/**
 * 生成搜索查询（按优先级排序）
 */
export function getSearchQueries(): string[] {
  const queries: string[] = [];
  
  // 1. 公链生态（优先搜索）
  CHAIN_WHITELIST.forEach(domain => {
    queries.push(`site:${domain} hackathon 2026`);
    queries.push(`site:${domain} builder program`);
    queries.push(`site:${domain} grant`);
  });
  
  // 2. 知名机构
  INSTITUTION_WHITELIST.forEach(domain => {
    queries.push(`site:${domain} hackathon`);
    queries.push(`site:${domain} grant`);
  });
  
  // 3. AI 赛道关键词（你的偏好）
  queries.push('AI agent hackathon 2026');
  queries.push('Web3 AI builder program');
  queries.push('LLM blockchain grant');
  
  // 4. Infra 赛道关键词（你的偏好）
  queries.push('oracle hackathon 2026');
  queries.push('infrastructure grant Web3');
  queries.push('indexing protocol builder program');
  
  return queries;
}
