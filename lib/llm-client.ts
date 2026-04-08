/**
 * 统一 LLM 客户端 (Phase 1 优化版)
 * 接入 Vercel AI SDK 和 Zod，彻底解决 JSON 解析不稳定性。
 * 移除了不再使用的 Anthropic 和 Groq，专注 Kimi (及兼容 OpenAI 格式的模型)。
 */

import { generateText, generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

type MessageRole = 'system' | 'user' | 'assistant';
type BasicMessage = { role: MessageRole; content: string };

export type LLMProvider = 'kimi' | 'openai';

interface CallLLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPrompt?: string;
}

/**
 * 获取当前配置的 LLM 提供商
 */
export function getCurrentProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER as LLMProvider) || 'kimi';
}

/**
 * 获取对应的 Vercel AI SDK 模型实例
 */
function getLanguageModel(options: CallLLMOptions = {}) {
  const provider = getCurrentProvider();
  
  if (provider === 'kimi') {
    const apiKey = process.env.LLM_API_KEY || process.env.KIMI_API_KEY;
    if (!apiKey) throw new Error('KIMI_API_KEY or LLM_API_KEY is not set');
    
    // 使用 Kimi 国际版 API 端点
    const kimi = createOpenAI({
      baseURL: 'https://api.moonshot.ai/v1',
      apiKey,
    });
    
    // 如果没有传入模型，默认使用 kimi-k2.5 (最智能的旗舰模型)
    return kimi(options.model || process.env.KIMI_MODEL || 'kimi-k2.5');
  } 
  
  // 默认回退或显式指定 openai
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY or LLM_API_KEY is not set');
  
  const openai = createOpenAI({
    apiKey,
  });
  
  return openai(options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini');
}

/**
 * 调用 LLM API (纯文本)
 * @param prompt 用户提示词
 * @param options 可选配置
 * @returns LLM 生成的文本
 */
export async function callLLM(prompt: string, options: CallLLMOptions = {}): Promise<string> {
  const model = getLanguageModel(options);
  
  const messages: BasicMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const { text } = await generateText({
    model,
    messages,
    temperature: options.temperature ?? 0.4,
    maxOutputTokens: options.maxTokens ?? 4096,
  });

  return text;
}

/**
 * 从 LLM 响应中提取 JSON (向后兼容，已推荐直接使用 callLLMObject)
 */
export function extractJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {}
    }
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {}
    }
    throw new Error('Could not extract valid JSON from LLM response');
  }
}

/**
 * 调用 LLM 返回非结构化的 JSON (通过旧版 API 兼容)
 */
export async function callLLMJSON(prompt: string, options: CallLLMOptions = {}): Promise<any> {
  const response = await callLLM(prompt, options);
  return extractJSON(response);
}

/**
 * 调用 LLM 并返回强类型结构化对象 (基于 Zod)
 * @param prompt 用户提示词
 * @param schema Zod Schema
 * @param options 可选配置
 */
export async function callLLMObject<T>(
  prompt: string, 
  schema: any, // ZodSchema 
  options: CallLLMOptions = {}
): Promise<T> {
  const model = getLanguageModel(options);

  const messages: BasicMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const { object } = await generateObject({
    model,
    messages,
    schema,
    temperature: options.temperature ?? 0.4,
    maxOutputTokens: options.maxTokens ?? 4096,
  });

  return object as T;
}

/**
 * 流式调用 LLM（预留）
 */
export async function callLLMStream(prompt: string, options: CallLLMOptions = {}): Promise<string> {
  return callLLM(prompt, options);
}
