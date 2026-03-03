/**
 * Web3 Builder Hub - 代码模板生成 API（Phase 3 优化版）
 * 根据项目类型生成 starter code
 * 
 * POST /api/generate-template
 * Body: { projectId: number, techStack?: string[] }
 * 
 * 优化点：使用统一 LLM 客户端和 extractJSON
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { callLLM, extractJSON } from '@/lib/llm-client';
import type { Project } from '@/types/project';

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

async function generateTemplateWithLLM(
  project: Project,
  techStack?: string[]
): Promise<{
  readme: string;
  fileStructure: string[];
  keyFiles: Array<{ path: string; content: string }>;
}> {
  const deepDive = project.deepDiveResult;
  const stack = techStack || deepDive?.suggestedTechStack || ['Solidity', 'React', 'Ethers.js'];
  
  const prompt = `作为 Web3 开发者，为以下项目生成一个 starter code 模板。

项目信息:
- 名称: ${project.title}
- 简介: ${project.summary}
- 赛道: ${deepDive?.suggestedTrack || 'Web3'}
- 技术栈: ${stack.join(', ')}

MVP 计划:
- Day 1: ${deepDive?.mvpTimeline?.day1 || 'Setup'}
- Day 2: ${deepDive?.mvpTimeline?.day2 || 'Core features'}
- Day 3: ${deepDive?.mvpTimeline?.day3 || 'Polish'}

请生成:
1. README.md 内容（包含项目介绍、安装步骤、使用说明）
2. 文件结构列表
3. 核心文件代码（contract、frontend config、test 等）

输出格式（严格的 JSON）:
{
  "readme": "# 项目名称...",
  "fileStructure": ["contracts/", "frontend/", "README.md"],
  "keyFiles": [
    { "path": "contracts/Main.sol", "content": "// SPDX-License-Identifier: MIT..." },
    { "path": "frontend/package.json", "content": '{"name": "..."}' }
  ]
}

只输出 JSON，不要其他文字。`;

  const response = await callLLM(prompt, { temperature: 0.5 });
  
  try {
    return extractJSON(response);
  } catch {
    // 返回默认模板
    return {
      readme: `# ${project.title}\n\n${project.summary}\n\n## Setup\n\n\`\`\`bash\nnpm install\n\`\`\``, 
      fileStructure: ['README.md'],
      keyFiles: [],
    };
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { projectId, techStack } = body;

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

    // 生成代码模板
    const template = await generateTemplateWithLLM(project, techStack);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      projectId,
      projectTitle: project.title,
      ...template,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Generate template error:', error);
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
