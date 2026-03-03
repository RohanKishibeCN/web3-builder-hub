/**
 * Web3 Builder Hub - 申请文案生成 API（Phase 3）
 * 根据项目信息生成完整的申请文案
 * 
 * POST /api/generate-proposal
 * Body: { projectId: number }
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Project } from '@/types/project';

function getKimiKey(): string {
  const key = process.env.KIMI_API_KEY;
  if (!key) throw new Error('KIMI_API_KEY not configured');
  return key;
}

async function getProjectById(id: number): Promise<Project | null> {
  const result = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    source: row.source,
    discoveredAt: row.discovered_at,
    deadline: row.deadline,
    prizePool: row.prize_pool,
    status: row.status,
    score: row.score,
    deepDiveResult: row.deep_dive_result,
    createdAt: row.created_at,
  };
}

async function generateProposalWithKimi(project: Project): Promise<string> {
  const KIMI_API_KEY = getKimiKey();
  
  const deepDive = project.deepDiveResult;
  
  const prompt = `作为 Web3 Builder，为以下项目生成一份专业的申请文案。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 赛道: ${deepDive?.suggestedTrack || 'Web3'}
- 建议技术栈: ${deepDive?.suggestedTechStack?.join(', ') || 'Solidity, React'}

深度分析:
- 赛道潜力: ${deepDive?.trackPotential || ''}
- 差异化点: ${deepDive?.differentiation || ''}
- 参与计划: ${deepDive?.participationPlan?.slice(0, 500) || ''}

请生成一份完整的申请文案，包含:
1. 项目概述（100字）
2. 技术方案（200字）
3. 团队介绍（100字）
4. 预期成果（100字）
5. 为什么适合这个赛道（100字）

文案风格：专业、简洁、有说服力。直接输出文案内容，不要加标题。`;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'kimi-k2-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing projectId' },
        { status: 400 }
      );
    }

    // 获取项目信息
    const project = await getProjectById(projectId);
    
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // 生成申请文案
    const proposal = await generateProposalWithKimi(project);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      projectId,
      projectTitle: project.title,
      proposal,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Generate proposal error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = parseInt(url.searchParams.get('projectId') || '0');
  
  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'Missing projectId' },
      { status: 400 }
    );
  }

  return POST(new Request(request.url, {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  }));
}
