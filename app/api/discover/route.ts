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
  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'kimi-k2-turbo-preview',
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

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  const startIdx = content.indexOf('[');
  const endIdx = content.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return JSON.parse(content.substring(startIdx, endIdx + 1));
  }
  
  return [];
}

async function scoreProject(project: any) {
  console.log('Calling scoreProject for:', project.title);
  
  try {
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'kimi-k2-turbo-preview',
        messages: [{
          role: 'user',
          content: `作为 Web3 Builder 专家，给这个项目打分（1-10分），只输出纯 JSON，不要 markdown 代码块，不要其他文字：
          
项目标题：${project.title}
项目描述：${project.summary}
奖金：${project.prize_pool || '无'}
截止日期：${project.deadline || '无'}

输出格式：
{"total_score":8,"prize_score":8,"urgency_score":7,"quality_score":8,"builder_match":8,"reason":"评价"}`
        }],
        temperature: 0.1
      })
    });

    console.log('Kimi score API status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kimi score API error:', errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log('Raw content:', content);
    
    if (!content) {
      console.error('No content');
      return null;
    }
    
    // 清理 content（去除 markdown 代码块）
    let cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    console.log('Clean content:', cleanContent);
    
    // 直接解析
    try {
      const score = JSON.parse(cleanContent);
      console.log('Parsed score:', score);
      return score;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content was:', cleanContent);
      return null;
    }
  } catch (e) {
    console.error('Score project error:', e);
    return null;
  }
}

export async function GET() {
  try {
    const queries = [
      'web3 hackathon 2026',
      'ethereum builder program 2026', 
      'solana grant 2026'
    ];

    const allResults: any[] = [];
    for (const q of queries) {
      try {
        const data = await braveSearch(q);
        const results = data?.web?.results || [];
        allResults.push(...results);
      } catch (e) {
        console.error(`Search failed for "${q}":`, e);
      }
    }

    if (allResults.length === 0) {
      return NextResponse.json({ 
        success: true, 
        count: 0,
        projects: [],
        message: 'No search results'
      });
    }

    const projects = await extractProjects(allResults.slice(0, 15));
    console.log('Extracted projects:', projects.length);

    let scoredCount = 0;
    for (const p of projects) {
      try {
        const result = await sql`
          INSERT INTO projects (title, url, deadline, prize_pool, summary, source)
          VALUES (${p.title}, ${p.url}, ${p.deadline}, ${p.prize_pool}, ${p.summary}, ${p.source || 'Brave Search'})
          ON CONFLICT (url) DO NOTHING
          RETURNING id;
        `;
        
        let projectId;
        if (result.rows[0]) {
          projectId = result.rows[0].id;
          console.log('New project:', projectId);
        } else {
          const existing = await sql`SELECT id FROM projects WHERE url = ${p.url}`;
          projectId = existing.rows[0]?.id;
          console.log('Existing project:', projectId);
        }
        
        if (projectId) {
          const check = await sql`SELECT score FROM projects WHERE id = ${projectId}`;
          if (!check.rows[0]?.score) {
            console.log('Scoring project:', projectId);
            const score = await scoreProject(p);
            if (score) {
              await sql`UPDATE projects SET score = ${JSON.stringify(score)} WHERE id = ${projectId}`;
              scoredCount++;
              console.log('Score saved:', projectId);
            }
          } else {
            console.log('Already scored:', projectId);
          }
        }
      } catch (e) {
        console.error('Error:', e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: projects.length,
      scored: scoredCount,
      message: 'Projects discovered and scored'
    });
  } catch (error) {
    console.error('Discover error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
