import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { callLLMObject } from '@/lib/llm-client';
import { insertProjectsBatch, logApiCall } from '@/lib/db';
import { z } from 'zod';
import type { Project } from '@/types/project';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 mins

// ==================== 抓取：CryptoFundraising ====================
async function fetchCryptoFundraising() {
  const items: any[] = [];
  try {
    const response = await fetch('https://crypto-fundraising.info/deal-flow/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return items;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $('tr').slice(1, 31).each((_, el) => {
      const name = $(el).find('td:nth-child(2) a').text().trim();
      const url = $(el).find('td:nth-child(2) a').attr('href') || '';
      const round = $(el).find('td:nth-child(5)').text().trim().toLowerCase();
      const desc = $(el).find('td:nth-child(4)').text().trim();
      
      if (name && (round.includes('seed') || round.includes('pre'))) {
        items.push({
          title: `[Seed] ${name}`,
          url: url || `https://crypto-fundraising.info/project/${name.toLowerCase()}`,
          summary: desc || 'Early stage Web3 project recently funded',
          source: 'CryptoFundraising'
        });
      }
    });
  } catch (error) {
    console.error('Fetch CryptoFundraising error:', error);
  }
  return items;
}

// ==================== 抓取：GitHub API ====================
async function fetchGithubBounties() {
  const items: any[] = [];
  try {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateStr = lastWeek.toISOString().split('T')[0];
    
    const q = encodeURIComponent(`"web3" AND ("grant" OR "bounty" OR "hackathon") created:>${dateStr}`);
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Web3-Builder-Hub'
    };

    if (process.env.GITHUB_PAT) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`;
    }
    
    const response = await fetch(`https://api.github.com/search/repositories?q=${q}&sort=updated&order=desc`, {
      headers
    });
    
    if (!response.ok) return items;
    
    const data = await response.json();
    
    (data.items || []).slice(0, 20).forEach((repo: any) => {
      items.push({
        title: `[GitHub] ${repo.full_name}`,
        url: repo.html_url,
        summary: repo.description || 'GitHub Web3 Repository',
        source: 'GitHub Search'
      });
    });
  } catch (error) {
    console.error('Fetch GitHub error:', error);
  }
  return items;
}

// ==================== 抓取：ETHGlobal ====================
async function fetchETHGlobal() {
  const items: any[] = [];
  try {
    const response = await fetch('https://ethglobal.com/events', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return items;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $('a[href^="/events/"]').each((_, el) => {
      const url = $(el).attr('href');
      const name = $(el).text().replace(/\s+/g, ' ').trim();
      
      if (name && url && url !== '/events/' && name.length > 5) {
        const fullUrl = url.startsWith('http') ? url : `https://ethglobal.com${url}`;
        if (!items.find(i => i.url === fullUrl)) {
          items.push({
            title: `[ETHGlobal] ${name}`,
            url: fullUrl,
            summary: 'ETHGlobal Hackathon / Builder Event',
            source: 'ETHGlobal'
          });
        }
      }
    });
  } catch (error) {
    console.error('Fetch ETHGlobal error:', error);
  }
  return items.slice(0, 20);
}

// ==================== 抓取：Questbook ====================
async function fetchQuestbook() {
  const items: any[] = [];
  try {
    const query = `
      query GetWorkspaces {
        workspaces(first: 20, orderBy: createdAt, orderDirection: desc) {
          id
          title
          description
          createdAt
        }
      }
    `;
    
    const response = await fetch('https://api.thegraph.com/subgraphs/name/questbook/questbook-polygon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) return items;
    
    const data = await response.json();
    const workspaces = data.data?.workspaces || [];
    
    workspaces.forEach((w: any) => {
      if (w.title) {
        items.push({
          title: `[Questbook] ${w.title}`,
          url: `https://questbook.app/workspace/${w.id}`,
          summary: w.description || 'Questbook Grant Program',
          source: 'Questbook'
        });
      }
    });
  } catch (error) {
    console.error('Fetch Questbook error:', error);
  }
  return items;
}

// ==================== 抓取：Taikai ====================
async function fetchTaikai() {
  const items: any[] = [];
  try {
    const response = await fetch('https://api.taikai.network/v1/hackathons?status=published&limit=20', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return items;
    
    const data = await response.json();
    const hackathons = Array.isArray(data) ? data : (data.data || []);
    
    hackathons.forEach((h: any) => {
      if (h.name) {
        items.push({
          title: `[Taikai] ${h.name}`,
          url: `https://taikai.network/hackathon/${h.slug || h.id}`,
          summary: h.short_description || h.description || 'Taikai Web3 Hackathon',
          source: 'Taikai'
        });
      }
    });
  } catch (error) {
    console.error('Fetch Taikai error:', error);
  }
  return items;
}

// ==================== LLM 初筛漏斗 ====================

const FilterSchema = z.object({
  results: z.array(z.object({
    url: z.string(),
    isRelevant: z.boolean().describe('是否是面向开发者的Hackathon/Grant/Bounty'),
    reason: z.string().describe('判断理由，过滤掉Airdrop、营销、抽奖')
  }))
});

async function filterWithLLM(items: any[]) {
  if (items.length === 0) return [];
  
  // 分批处理，每批 20 个
  const batchSize = 20;
  const relevantItems: any[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const prompt = `
请判断以下列表中的 Web3 项目是否包含面向开发者的机会（如 Hackathon, Grant, Developer Bounty, Builder Program）。
注意：请严格剔除普通用户的空投(Airdrop)、抽奖(Giveaway)、营销活动(Marketing Campaign)。

项目列表：
${JSON.stringify(batch.map(b => ({ title: b.title, summary: b.summary, url: b.url })), null, 2)}
`;

    try {
      const parsed = await callLLMObject<{ results: { url: string, isRelevant: boolean }[] }>(
        prompt, 
        FilterSchema, 
        { 
          model: process.env.KIMI_MODEL || 'kimi-k2-turbo-preview', // 使用标准的低成本大模型进行初筛
          temperature: 0.2
        }
      );
      
      const relevantUrls = new Set(
        parsed.results
          .filter(r => r.isRelevant)
          .map(r => r.url)
      );
      
      relevantItems.push(...batch.filter(item => relevantUrls.has(item.url)));
    } catch (error) {
      console.error('LLM Filter error for batch:', error);
      // 兜底策略：如果大模型初筛报错（比如触发限流、模型名错误），为了不丢失数据，我们默认放行这批数据，交给后续的 Deep Dive 环节去深度鉴别
      console.log(`[Alpha Hound] ⚠️ LLM 初筛失败，兜底放行本批次 ${batch.length} 条数据`);
      relevantItems.push(...batch);
    }
  }
  
  return relevantItems;
}

// ==================== 主路由 ====================

export async function GET(request: Request) {
  const startTime = Date.now();
  
  // Cron 验证
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('=== Alpha Hound Started ===');
  
  try {
    // 1. 并行抓取所有 5 个 Alpha 源
    const [fundraisingItems, githubItems, ethglobalItems, questbookItems, taikaiItems] = await Promise.all([
      fetchCryptoFundraising(),
      fetchGithubBounties(),
      fetchETHGlobal(),
      fetchQuestbook(),
      fetchTaikai()
    ]);
    
    const allItems = [...fundraisingItems, ...githubItems, ...ethglobalItems, ...questbookItems, ...taikaiItems];
    console.log(`[Alpha Hound] 抓取到原始数据 ${allItems.length} 条`);
    
    // 2. LLM 初筛 (漏斗 1)
    const relevantItems = await filterWithLLM(allItems);
    console.log(`[Alpha Hound] 初筛后剩余高潜项目 ${relevantItems.length} 条`);
    
    // 3. 准备入库
    const projectsToInsert: Omit<Project, 'id' | 'createdAt'>[] = relevantItems.map(item => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
      source: item.source,
      discoveredAt: new Date().toISOString(),
      deadline: null,
      prizePool: null,
      status: 'pending_deep_dive',
      score: null,
      deepDiveResult: null,
      retryCount: 0
    }));

    let totalInserted = 0;
    let totalSkipped = 0;
    if (projectsToInsert.length > 0) {
      const dbResult = await insertProjectsBatch(projectsToInsert);
      totalInserted = dbResult.inserted;
      totalSkipped = dbResult.skipped;
      console.log(`[Alpha Hound] 成功入库: ${totalInserted}, 跳过(重复): ${totalSkipped}`);
    }

    const durationMs = Date.now() - startTime;
    
    await logApiCall({
      apiName: 'discover-alpha',
      status: 'success',
      durationMs,
      found: allItems.length, // 透传原始抓取量
      inserted: totalInserted,
      skipped: totalSkipped,
      errorMessage: `Filtered: ${relevantItems.length} passed LLM` // 借用 err 字段展示次级过滤数据
    });

    return NextResponse.json({
      success: true,
      foundRaw: allItems.length,
      filteredRelevant: relevantItems.length,
      inserted: totalInserted,
      durationMs,
    });

  } catch (error: any) {
    console.error('Alpha Hound Error:', error);
    
    await logApiCall({
      apiName: 'discover-alpha',
      status: 'error',
      durationMs: Date.now() - startTime,
      errorMessage: error.message,
    });

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const POST = GET;