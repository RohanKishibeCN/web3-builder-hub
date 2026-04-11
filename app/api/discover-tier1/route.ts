import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { insertProjectsBatch, logApiCall } from '@/lib/db';
import type { Project } from '@/types/project';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds is enough for RSS parsing

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'content']
  }
});

// Tier 1 RSS Sources
const TIER1_SOURCES = [
  { name: 'Ethereum Foundation', url: 'https://blog.ethereum.org/feed.xml' },
  { name: 'Sui Foundation', url: 'https://blog.sui.io/rss/' },
  { name: 'Avalanche', url: 'https://medium.com/feed/avalancheavax' },
  { name: 'Arbitrum', url: 'https://medium.com/feed/offchainlabs' },
  { name: 'BNB Chain', url: 'https://www.bnbchain.org/en/blog/rss.xml' }
];

// Keywords to filter for developer opportunities
const KEYWORDS_REGEX = /grant|hackathon|bounty|bounties|builder program|accelerator|incubator|developer program/i;

// Calculate the date 30 days ago
const THIRTY_DAYS_AGO = new Date();
THIRTY_DAYS_AGO.setDate(THIRTY_DAYS_AGO.getDate() - 30);

function isRecent(dateString: string | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date >= THIRTY_DAYS_AGO;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  let totalFound = 0;
  let totalInserted = 0;
  const errors: string[] = [];

  // Cron Job Authentication
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('=== Discover Tier 1 (RSS) Started ===');

  try {
    const projectsToInsert: Omit<Project, 'id' | 'createdAt'>[] = [];

    // Fetch and parse all RSS feeds in parallel
    const feedPromises = TIER1_SOURCES.map(async (source) => {
      try {
        console.log(`Fetching RSS from ${source.name}...`);
        // Use native fetch with AbortController for strict timeout (15s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(source.url, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const xml = await response.text();
        const feed = await parser.parseString(xml);
        
        // Filter items from the last 30 days
        const recentItems = feed.items.filter(item => isRecent(item.pubDate || item.isoDate));
        
        // Filter items containing developer keywords
        const relevantItems = recentItems.filter(item => {
          const textToSearch = `${item.title || ''} ${item.content || item['content:encoded'] || item.contentSnippet || ''}`.toLowerCase();
          return KEYWORDS_REGEX.test(textToSearch);
        });

        console.log(`[${source.name}] Found ${relevantItems.length} relevant items out of ${recentItems.length} recent items.`);
        
        relevantItems.forEach(item => {
          projectsToInsert.push({
            title: item.title || 'Untitled',
            url: item.link || '',
            summary: item.contentSnippet?.slice(0, 500) || item.title || '',
            source: source.name,
            discoveredAt: new Date().toISOString(),
            deadline: null, // RSS doesn't usually provide strict deadlines
            prizePool: null, // Will be extracted by Deep Dive LLM
            status: 'pending_deep_dive',
            score: null,
            deepDiveResult: null,
          });
        });
      } catch (err: any) {
        console.error(`Failed to fetch from ${source.name}: ${err.message}`);
        errors.push(`[${source.name}] ${err.message}`);
      }
    });

    await Promise.allSettled(feedPromises);

    totalFound = projectsToInsert.length;

    if (totalFound > 0) {
      console.log(`Attempting to insert ${totalFound} projects into DB...`);
      const dbResult = await insertProjectsBatch(projectsToInsert);
      totalInserted = dbResult.inserted;
      console.log(`Inserted: ${dbResult.inserted}, Skipped (Dup): ${dbResult.skipped}, Errors: ${dbResult.errors.length}`);
      if (dbResult.errors.length > 0) {
        errors.push(...dbResult.errors);
      }
    } else {
      console.log('No new relevant projects found across Tier 1 sources.');
    }

    const durationMs = Date.now() - startTime;
    
    // Log success
    await logApiCall({
      apiName: 'discover-tier1',
      status: 'success',
      durationMs,
      found: totalFound,
      inserted: totalInserted,
      skipped: totalFound - totalInserted,
      errorMessage: errors.length > 0 ? errors.join(' | ').substring(0, 255) : undefined,
    });

    return NextResponse.json({
      success: true,
      found: totalFound,
      inserted: totalInserted,
      errors: errors.length > 0 ? errors : undefined,
      durationMs,
    });

  } catch (error: any) {
    console.error('Discover Tier 1 Error:', error);
    
    await logApiCall({
      apiName: 'discover-tier1',
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
