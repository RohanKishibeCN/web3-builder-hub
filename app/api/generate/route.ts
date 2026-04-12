import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { kimiCustomFetch } from '@/lib/utils';

// Allow streaming responses up to 60 seconds (Hobby limit) or higher if Pro
export const maxDuration = 60;
// CRITICAL FIX: Use Edge Runtime to bypass Vercel Serverless Function strict 60s streaming cutoff
export const runtime = 'edge';

// --- In-Memory Rate Limiter ---
// These variables persist in the memory of a single V8 Isolate.
// NOTE: Vercel may spin up multiple isolates, so this is a best-effort per-isolate limit, not a strict global limit.
let generateRequestCount = 0;
let generateWindowStartTime = Date.now();
const WINDOW_SIZE_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 2; // Allow 2 requests per minute per isolate

export async function POST(req: Request) {
  // --- Rate Limiting Logic ---
  const now = Date.now();
  if (now - generateWindowStartTime > WINDOW_SIZE_MS) {
    // Time window passed, reset counter
    generateRequestCount = 0;
    generateWindowStartTime = now;
  }

  if (generateRequestCount >= MAX_REQUESTS_PER_WINDOW) {
    return new Response(
      JSON.stringify({ 
        error: 'Too Many Requests', 
        message: 'Rate limit exceeded: You can only generate 2 proposals/codes per minute to protect API limits.' 
      }), 
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Increment counter for this request
  generateRequestCount++;
  // ---------------------------

  const { prompt, type, projectContext } = await req.json();

  const apiKey = process.env.LLM_API_KEY || process.env.KIMI_API_KEY;
  if (!apiKey) {
    return new Response('API Key not configured', { status: 500 });
  }

  const kimi = createOpenAI({
    baseURL: 'https://api.moonshot.ai/v1',
    apiKey,
    fetch: kimiCustomFetch,
  });

  // 使用针对代码生成和前端优化的 kimi-k2-0905-preview 模型
  // CRITICAL FIX: Use .chat() to force /v1/chat/completions endpoint
  const model = kimi.chat(process.env.KIMI_GENERATION_MODEL || 'kimi-k2-0905-preview');

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
      temperature: 1, // Kimi k2.5 requires temperature 1
    });

    // CRITICAL FIX: Use toDataStreamResponse() instead of toTextStreamResponse()
    // This matches the default protocol expected by useCompletion() in Vercel AI SDK 3.x
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error('Stream generation failed:', error);
    return new Response(`Stream generation failed: ${error.message}`, { status: 500 });
  }
}
