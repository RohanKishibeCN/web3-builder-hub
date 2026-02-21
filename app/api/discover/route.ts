import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY;
const KIMI_API_KEY = process.env.KIMI_API_KEY;

async function braveSearch(query: string) {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
    { 
      headers: { 
        'X-Subscription-Token': BRAVE_KEY!, 
        'Accept': 'application/json' 
      } 
    }
  );
  if (!res.ok) throw new Error(`Brave API: ${res.status}`);
  return res.json();
}

async function extractProjects(searchResults: any[]) {
  const response = await fetch('https://api.kimi.com/coding/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'k2p5',
      messages: [{
        role: 'user',
        content: `从以下搜索结果中提取所有 Web3 Hackathon/Builder Program/Grant 项目，输出 JSON 数组格式：

${JSON.stringify(searchResults)}

每个项目包含：title, url, deadline(YYYY-MM-DD或null), prize_pool, summary, source

只输出 JSON 数组，不要其他文字。`
      }],
      temperature: 0.3
    })
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const jsonMatch = content.match(/\
