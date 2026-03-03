/**
 * 统一 LLM 客户端
 * 支持 Kimi/OpenAI/Groq/Anthropic 等多种大模型提供商
 * 通过环境变量 LLM_PROVIDER 切换，LLM_API_KEY 统一配置
 */

export type LLMProvider = 'kimi' | 'openai' | 'groq' | 'anthropic';

interface LLMConfig {
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const PROVIDER_CONFIGS: Record<LLMProvider, LLMConfig> = {
  kimi: {
    baseURL: 'https://api.moonshot.ai/v1',
    model: process.env.KIMI_MODEL || 'kimi-k2-turbo-preview',
    maxTokens: 4096,
    temperature: 0.4,
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.4,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    maxTokens: 4096,
    temperature: 0.4,
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.4,
  },
};

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
 * 获取 LLM API Key
 * 优先使用 LLM_API_KEY，如果不存在则使用 provider 特定的 key
 */
function getApiKey(provider: LLMProvider): string | undefined {
  // 优先使用统一的 LLM_API_KEY
  if (process.env.LLM_API_KEY) {
    return process.env.LLM_API_KEY;
  }

  // 向后兼容：使用 provider 特定的 key
  switch (provider) {
    case 'kimi':
      return process.env.KIMI_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * 获取 LLM 配置信息
 */
export function getLLMInfo() {
  const provider = getCurrentProvider();
  const config = PROVIDER_CONFIGS[provider];
  return {
    provider,
    model: config.model,
    baseURL: config.baseURL,
  };
}

/**
 * 调用 LLM API
 * @param prompt 用户提示词
 * @param options 可选配置
 * @returns LLM 生成的文本
 */
export async function callLLM(prompt: string, options: CallLLMOptions = {}): Promise<string> {
  const provider = getCurrentProvider();
  const config = PROVIDER_CONFIGS[provider];
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${provider}. Please set LLM_API_KEY or ${provider.toUpperCase()}_API_KEY`);
  }

  const maxTokens = options.maxTokens || config.maxTokens;
  const temperature = options.temperature ?? config.temperature;
  const model = options.model || config.model;

  console.log(`[LLM] Using provider: ${provider}, model: ${model}`);

  // 构建请求体
  const requestBody: any = {
    model,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // Anthropic 使用不同的 API 格式
  if (provider === 'anthropic') {
    delete requestBody.messages;
    requestBody.system = options.systemPrompt || '';
    requestBody.messages = [{ role: 'user', content: prompt }];
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // Anthropic 使用 x-api-key 头
    if (provider === 'anthropic') {
      delete headers['Authorization'];
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error (${provider}): ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 提取生成的内容
    let content = '';
    if (provider === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }

    if (!content) {
      throw new Error(`Empty response from ${provider} API`);
    }

    return content;
  } catch (error) {
    console.error(`[LLM] Error calling ${provider}:`, error);
    throw error;
  }
}

/**
 * 从 LLM 响应中提取 JSON
 * @param content LLM 生成的文本
 * @returns 解析后的 JSON 对象
 */
export function extractJSON(content: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch {
    // 尝试从代码块中提取
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // 继续尝试其他方式
      }
    }

    // 尝试从文本中提取 JSON 对象
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // 继续尝试
      }
    }

    // 尝试从数组中提取
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // 失败
      }
    }

    throw new Error('Could not extract valid JSON from LLM response');
  }
}

/**
 * 调用 LLM 并返回 JSON 结果
 * @param prompt 用户提示词
 * @param options 可选配置
 * @returns 解析后的 JSON 对象
 */
export async function callLLMJSON(prompt: string, options: CallLLMOptions = {}): Promise<any> {
  const response = await callLLM(prompt, options);
  return extractJSON(response);
}

/**
 * 流式调用 LLM（用于长文本生成）
 * @param prompt 用户提示词
 * @param options 可选配置
 * @returns 生成的文本
 */
export async function callLLMStream(prompt: string, options: CallLLMOptions = {}): Promise<string> {
  // 目前先使用非流式，后续可以扩展为真正的流式
  return callLLM(prompt, options);
}
