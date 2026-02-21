import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { updateProjectScore } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { projectId, project } = await request.json();

    const { text } = await generateText({
      model: anthropic('claude-3-sonnet-20240229'),
      prompt: `作为 Web3 Builder 专家，给这个项目打分（1-10分）：
      
项目：${JSON.stringify(project)}

请输出严格 JSON 格式：
{
  "total_score": number,
  "prize_score": number,
  "urgency_score": number,
  "quality_score": number,
  "builder_match": number,
  "reason": "简短中文评价"
}`
    });

    const score = JSON.parse(text);
    await updateProjectScore(projectId, score);

    return NextResponse.json(score);
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
