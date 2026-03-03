import { NextResponse } from 'next/server';
import { 
  insertProjectsBatch, 
  logApiCall, 
  addCandidateDomain,
  getDynamicWhitelist 
} from '@/lib/db';
import { sendSystemNotification, sendCandidateForConfirmation } from '@/lib/telegram';
import { sendLarkNotification, sendLarkCandidateNotification } from '@/lib/lark';
import { evaluateDomain, quickEvaluate } from '@/lib/domain-evaluator';
import { callLLM, extractJSON } from '@/lib/llm-client';
import { 
  CHAIN_WHITELIST, 
  INSTITUTION_WHITELIST,
  STATIC_WHITELIST,
  validateProjectBasic,
  getSearchQueries,
  detectTrack,
} from '@/lib/whitelist';
import type { ExtractedProject, BraveSearchResult } from '@/types/project';

function getBraveKey(): string {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error('BRAVE_SEARCH_API_KEY not configured');
  return key;
}

async function braveSearch(query: string, count: number = 10): Promise<BraveSearchResult[]> {
  const BRAVE_API_KEY = getBraveKey();

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        'X-Subscription-Token': BRAVE_API_KEY,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) throw new Error(`Brave API: ${response.status}`);

  const data = await response.json();
  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

/**
 * 使用统一 LLM 客户端提取项目
 */
async function extractWithLLM(results: BraveSearchResult[]): Promise<ExtractedProject[]> {
  const prompt = `从以下搜索结果中提取 Web3 Hackathon / Builder Program / Grant 项目。

要求:
- 奖金 >= $5000
- 截止日期 >= 7 天后（或滚动申请）
- 排除包含诈骗关键词的项目

搜索结果:
${JSON.stringify(results, null, 2)}

输出 JSON 数组格式:
[{
  "title": "项目名称",
  "url": "项目链接",
  "deadline": "YYYY-MM-DD 或 null",
  "prize_pool": "奖金描述 或 null",
  "summary": "一句话描述",
  "source": "来源域名"
}]

只输出 JSON 数组，不要其他文字。`;

  const response = await callLLM(prompt, { temperature: 0.3 });
  
  try {
    return extractJSON(response);
  } catch {
    console.log('LLM extract failed, returning empty array');
    return [];
  }
}

async function searchFixedWhitelist(): Promise<BraveSearchResult[]> {
  console.log('Searching fixed whitelist...');
  const results: BraveSearchResult[] = [];
  const queries = getSearchQueries();
  
  for (const query of queries) {
    try {
      const batch = await braveSearch(query, 5);
      results.push(...batch);
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`Search error for "${query}":`, e);
    }
  }
  
  return results;
}

async function searchDynamicWhitelist(): Promise<BraveSearchResult[]> {
  console.log('Searching dynamic whitelist...');
  const dynamicDomains = await getDynamicWhitelist();
  const results: BraveSearchResult[] = [];
  
  for (const domain of dynamicDomains.slice(0, 10)) {
    try {
      const queries = [
        `site:${domain} hackathon`,
        `site:${domain} builder program`,
        `site:${domain} grant`,
      ];
      
      for (const query of queries) {
        const batch = await braveSearch(query, 3);
        results.push(...batch);
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.error(`Dynamic search error for ${domain}:`, e);
    }
  }
  
  return results;
}

async function discoverNewDomains(allResults: BraveSearchResult[]): Promise<{
  newDomains: Array<{
    domain: string;
    title: string;
    description: string;
    sampleUrl: string;
  }>;
  evaluated: number;
}> {
  console.log('Discovering new domains...');
  
  const domainMap = new Map<string, { title: string; description: string; url: string }>();
  
  for (const result of allResults) {
    try {
      const hostname = new URL(result.url).hostname.toLowerCase();
      
      if (STATIC_WHITELIST.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        continue;
      }
      
      const dynamicWhitelist = await getDynamicWhitelist();
      if (dynamicWhitelist.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        continue;
      }
      
      if (!domainMap.has(hostname)) {
        domainMap.set(hostname, {
          title: result.title,
          description: result.description,
          url: result.url,
        });
      }
    } catch {
      // 无效 URL，跳过
    }
  }
  
  const newDomains = Array.from(domainMap.entries()).map(([domain, info]) => ({
    domain,
    title: info.title,
    description: info.description,
    sampleUrl: info.url,
  }));
  
  console.log(`Found ${newDomains.length} potential new domains`);
  
  const promisingDomains = newDomains.filter(d => {
    const eval_result = quickEvaluate(d.domain, `${d.title} ${d.description}`);
    return eval_result.shouldConsider || eval_result.track === 'AI' || eval_result.track === 'Infra';
  });
  
  console.log(`Promising domains after quick filter: ${promisingDomains.length}`);
  
  const toEvaluate = promisingDomains.slice(0, 5);
  let evaluated = 0;
  
  for (const item of toEvaluate) {
    try {
      const evaluation = await evaluateDomain(item.domain, {
        title: item.title,
        description: item.description,
        foundOn: item.sampleUrl,
      });
      
      if (evaluation && evaluation.shouldAdd && evaluation.score >= 60) {
        const result = await addCandidateDomain({
          domain: evaluation.domain,
          name: evaluation.name,
          track: evaluation.track,
          priority: evaluation.priority,
          sourceUrl: item.sampleUrl,
        });
        
        if (result.success) {
          // 发送 Telegram 通知
          await sendCandidateForConfirmation({
            id: result.id!,
            domain: evaluation.domain,
            name: evaluation.name,
            track: evaluation.track,
            score: evaluation.score,
            reasons: evaluation.reasons,
            foundOn: item.sampleUrl,
          });
          
          // 发送 Lark 通知
          await sendLarkCandidateNotification({
            id: result.id!,
            domain: evaluation.domain,
            name: evaluation.name,
            track: evaluation.track,
            score: evaluation.score,
            reasons: evaluation.reasons,
            foundOn: item.sampleUrl,
          });
          
          evaluated++;
        }
      }
      
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Evaluate domain error for ${item.domain}:`, e);
    }
  }
  
  return { newDomains, evaluated };
}

async function runDiscovery(): Promise<{
  success: boolean;
  found: number;
  inserted: number;
  skipped: number;
  newDomains: number;
  evaluated: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const fixedResults = await searchFixedWhitelist();
  console.log(`Fixed whitelist results: ${fixedResults.length}`);

  const dynamicResults = await searchDynamicWhitelist();
  console.log(`Dynamic whitelist results: ${dynamicResults.length}`);

  const allResults = [...fixedResults, ...dynamicResults];
  const unique = Array.from(new Map(allResults.map(r => [r.url, r])).values());
  console.log(`Unique results: ${unique.length}`);

  const { newDomains, evaluated } = await discoverNewDomains(unique);

  console.log('Extracting projects with LLM...');
  let extracted: ExtractedProject[] = [];
  const maxToExtract = Math.min(unique.length, 30);
  
  for (let i = 0; i < maxToExtract; i += 10) {
    try {
      const batch = unique.slice(i, i + 10);
      const projects = await extractWithLLM(batch);
      extracted.push(...projects);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      errors.push(`LLM batch ${i}: ${e}`);
    }
  }

  console.log(`Extracted: ${extracted.length}`);

  const valid = extracted.filter(p => {
    const result = validateProjectBasic(p);
    if (!result.valid) {
      console.log(`  Filtered: ${p.title} - ${result.reason}`);
    }
    return result.valid;
  });

  console.log(`Valid: ${valid.length}`);

  const toInsert = valid.map(p => ({
    title: p.title,
    url: p.url,
    summary: p.summary,
    source: p.source || new URL(p.url).hostname,
    discoveredAt: new Date().toISOString(),
    deadline: p.deadline,
    prizePool: p.prize_pool,
    status: 'pending_deep_dive' as const,
    score: null,
    deepDiveResult: null,
  }));

  const result = await insertProjectsBatch(toInsert);

  return {
    success: true,
    found: extracted.length,
    inserted: result.inserted,
    skipped: result.skipped,
    newDomains: newDomains.length,
    evaluated,
    errors: [...errors, ...result.errors],
  };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('=== Discover V2 Started ===', new Date().toISOString());

  try {
    const result = await runDiscovery();
    const duration = Date.now() - startTime;
    
    console.log('=== Discover V2 Completed ===', result, `Duration: ${duration}ms`);

    await logApiCall({
      apiName: 'discover-v2',
      status: result.success ? 'success' : 'error',
      durationMs: duration,
      found: result.found,
      inserted: result.inserted,
    });

    if (result.inserted > 0 || result.evaluated > 0) {
      const msg = `发现完成\n新项目: ${result.inserted} 个\n新域名: ${result.newDomains} 个\n待确认: ${result.evaluated} 个`;
      await sendSystemNotification('success', msg);
      await sendLarkNotification('success', msg);
    }

    return NextResponse.json({
      ...result,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Discover V2 error:', error);
    
    await logApiCall({
      apiName: 'discover-v2',
      status: 'error',
      durationMs: duration,
      errorMessage: String(error),
    });
    
    const msg = `发现任务失败: ${error}`;
    await sendSystemNotification('error', msg);
    await sendLarkNotification('error', msg);

    return NextResponse.json(
      { success: false, error: String(error), duration, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
