/**
 * Web3 Builder Hub - Discover API (Phase 2)
 * 采用 Apify (apidojo/tweet-scraper) 作为情报源
 * 获取最新的 Web3 黑客松/开发者活动推文，并交由 LLM 提取。
 */

import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { z } from 'zod';
import { insertProjectsBatch, logApiCall } from '@/lib/db';
import { callLLMObject } from '@/lib/llm-client';
import type { ExtractedProject } from '@/types/project';

function getApifyClient() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN is not configured');
  return new ApifyClient({ token });
}

// 提取推文为结构化项目的 Schema
const ExtractedProjectsSchema = z.object({
  projects: z.array(
    z.object({
      title: z.string().describe('项目/活动名称'),
      url: z.string().describe('活动链接 (推文里的外链)'),
      deadline: z.string().nullable().describe('截止日期 YYYY-MM-DD，如果没有则为 null'),
      prize_pool: z.string().nullable().describe('奖金描述，如果没有则为 null'),
      summary: z.string().describe('一句话简短描述'),
      source: z.string().describe('来源推特账号')
    })
  )
});

/**
 * 步骤 1: 调用 Apify 获取热门推文
 */
async function fetchTweetsFromApify(maxItems = 30) {
  console.log('Fetching tweets from Apify...');
  const client = getApifyClient();

  // 构建高级搜索词：寻找近期热度较高的 Web3 活动
  const searchTerms = [
    '("hackathon" OR "grant" OR "bounty" OR "builder program") AND ("web3" OR "crypto" OR "blockchain" OR "solana" OR "ethereum") min_faves:10 -filter:replies'
  ];

  const input = {
    searchTerms,
    maxItems,
    sort: "Latest", // 按最新排序
    tweetLanguage: "en"
  };

  // 调用 apidojo/tweet-scraper
  const run = await client.actor("apidojo/tweet-scraper").call(input);
  console.log(`Apify run finished with ID: ${run.id}`);

  // 获取结果数据集
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

/**
 * 步骤 2: 将推文列表合并，交给 Kimi 提取出具体项目
 */
async function extractProjectsFromTweets(tweets: any[]): Promise<ExtractedProject[]> {
  console.log(`Extracting projects from ${tweets.length} tweets using LLM...`);
  
  if (tweets.length === 0) return [];

  // 将推文浓缩为文本，减少 Token 消耗
  const tweetsContext = tweets.map((t, i) => {
    const author = t.twitterHandle || (t.author && t.author.userName) || 'unknown';
    const text = t.text || t.full_text || '';
    // 提取推文中的所有外链
    const urls = (t.entities?.urls || []).map((u: any) => u.expanded_url).join(', ');
    
    return `[${i+1}] @${author}: ${text}\nLinks: ${urls}\nTweet URL: ${t.url || t.twitterUrl}`;
  }).join('\n\n');

  const prompt = `你是一个专业的 Web3 开发者情报分析师。我提供了一批近期关于 Web3 Hackathon / Grant / Bounty 的推文。
请从这些推文中提取出**真实有效**的开发者活动项目。

要求：
1. 必须是给开发者参与的活动（黑客松、资助、赏金）。排除纯粹的空投炒作或毫无意义的闲聊。
2. 提取活动的名称、简介、截止日期和奖金。
3. "url" 字段必须优先使用推文里包含的**活动官网/报名外链**。如果没有外链，才使用推文本身的 URL。
4. "source" 字段填推文的作者账号（如 @ETHGlobal）。

推文内容如下：
${tweetsContext.slice(0, 15000)}

请严格返回符合 Schema 的 JSON 数据。`;

  try {
    const result = await callLLMObject<{ projects: ExtractedProject[] }>(
      prompt, 
      ExtractedProjectsSchema, 
      { 
        temperature: 0.2,
        model: 'kimi-k2-turbo-preview' // 高速版本，处理大量短文本推文抽取
      }
    );
    return result.projects;
  } catch (error) {
    console.error('LLM Extraction Error:', error);
    return [];
  }
}

/**
 * 主执行流程
 */
async function runDiscovery() {
  const errors: string[] = [];
  
  // 1. 获取推文
  let tweets: any[] = [];
  try {
    tweets = await fetchTweetsFromApify(50);
    console.log(`Successfully fetched ${tweets.length} tweets.`);
  } catch (error) {
    console.error('Apify fetch error:', error);
    errors.push(`Apify Error: ${error}`);
    return { success: false, found: 0, inserted: 0, skipped: 0, errors };
  }

  // 2. LLM 提取项目
  // 为了防止 Token 超限，分批提取（每 25 条推文一批）
  const extracted: ExtractedProject[] = [];
  for (let i = 0; i < tweets.length; i += 25) {
    const batch = tweets.slice(i, i + 25);
    const batchExtracted = await extractProjectsFromTweets(batch);
    extracted.push(...batchExtracted);
  }

  console.log(`LLM extracted ${extracted.length} potential projects.`);

  // 3. 入库
  const toInsert = extracted.map(p => ({
    title: p.title,
    url: p.url,
    summary: p.summary,
    source: p.source,
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
    errors: [...errors, ...result.errors],
  };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 安全修复：移除基于 Host 头的开发环境判断，防止伪造 Host 绕过鉴权
  // 开发环境下如果不配置 CRON_SECRET 则跳过验证，如果配置了则必须验证
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('=== Discover V2 (Apify) Started ===', new Date().toISOString());

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

    if (result.inserted > 0) {
      console.log(`发现完成\n新项目: ${result.inserted} 个`);
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

    return NextResponse.json(
      { success: false, error: String(error), duration, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

export const POST = GET;
