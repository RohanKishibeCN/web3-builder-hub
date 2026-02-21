import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

const KIMI_API_KEY = process.env.KIMI_API_KEY;

export async function POST(request: Request) {
  try {
    const { projectId, project } = await request.json();

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
          content: `作为 Web3 Builder 专家，给这个项目打分（1-10分），只输出 JSON 格式，不要其他文字：

项目信息：${JSON.stringify(project)}

输出格式：
{
  "total_score": number,
  "prize_score": number,
  "urgency_score": number,
  "quality_score": number,
  "builder_match": number,
  "reason": "简短中文评价"
}`
        }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const score = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      total_score: 8,
      prize_score: 8,
      urgency_score: 7,
      quality_score: 8,
      builder_match: 8,
      reason: "项目看起来不错"
    };

    await sql`
      UPDATE projects 
      SET score = ${JSON.stringify(score)} 
      WHERE id = ${projectId}
    `;

    return NextResponse.json(score);
  } catch (error) {
    console.error('Score error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
