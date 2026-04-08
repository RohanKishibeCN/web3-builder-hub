import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt, type, projectContext } = await req.json();

  const apiKey = process.env.LLM_API_KEY || process.env.KIMI_API_KEY;
  if (!apiKey) {
    return new Response('API Key not configured', { status: 500 });
  }

  // Define a custom fetch function that removes 'stream_options' from the request body
  // to avoid Kimi API's "Unrecognized stream_options" 400 error.
  const customFetch = async (url: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    if (init && init.body && typeof init.body === 'string') {
      try {
        const bodyObj = JSON.parse(init.body);
        if (bodyObj.stream_options) {
          delete bodyObj.stream_options;
        }
        init.body = JSON.stringify(bodyObj);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    return fetch(url, init);
  };

  const kimi = createOpenAI({
    baseURL: 'https://api.moonshot.ai/v1',
    apiKey,
    fetch: customFetch,
  });

  // 使用专门针对代码和前端优化的 kimi-k2-0905-preview 模型
  const model = kimi(process.env.KIMI_GENERATION_MODEL || 'kimi-k2-0905-preview');

  let systemMessage = '';
  
  if (type === 'proposal') {
    systemMessage = `你是一个资深的 Web3 全栈开发者兼黑客松参赛专家。
请根据用户提供的黑客松项目信息，撰写一份高质量的、极客风格的参赛提案（Proposal/Pitch）。
包含：团队背景、解决的痛点、如何切入该赛道、以及技术栈优势。语言要简洁、专业、有煽动性。`;
  } else if (type === 'code') {
    systemMessage = `你是一个资深的 Web3 全栈开发者 (擅长 Next.js, Solidity, Wagmi)。
请根据用户提供的黑客松 MVP 计划，生成一份初始化代码骨架（Code Skeleton）。
包含：1. 目录结构树；2. 核心智能合约的接口定义（无需实现全量逻辑）；3. 前端与合约交互的关键 Hook 示例。
输出必须是纯粹的 Markdown 格式，代码块要标注语言。`;
  }

  const fullPrompt = `项目背景信息：\n${projectContext}\n\n请开始生成：`;

  try {
    const result = await streamText({
      model,
      system: systemMessage,
      prompt: fullPrompt,
      temperature: 0.7,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Stream generation failed:', error);
    return new Response(`Stream generation failed: ${error.message}`, { status: 500 });
  }
}
