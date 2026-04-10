import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

// 常见反爬拦截标识
const BLOCKED_INDICATORS = [
  'Just a moment...',
  'Checking your browser',
  'Please wait while we verify you are a real person',
  'cf-browser-verification',
  'cloudflare',
  'Access denied',
  '403 Forbidden',
];

/**
 * 判断网页内容是否被防爬虫拦截（如 Cloudflare）
 */
function isBlocked(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  return BLOCKED_INDICATORS.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
}

/**
 * 提取器配置
 */
interface ExtractorOptions {
  maxLength?: number;
}

/**
 * 瀑布流网页内容提取器
 * 1. 优先使用原生 Fetch + Readability.js 提取纯净正文（免费、快速）
 * 2. 如果被拦截或失败，自动降级使用 Jina AI API（付费兜底）
 */
export async function extractContentWaterfall(url: string, options: ExtractorOptions = {}): Promise<string> {
  const maxLength = options.maxLength || 12000;
  
  console.log(`[Extractor] 正在解析: ${url}`);
  
  try {
    // ==========================================
    // 第一层：原生 Fetch + Readability (Vercel 内存执行)
    // ==========================================
    console.log(`[Extractor] 尝试 Layer 1 (Fetch + Readability)...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const html = await response.text();
      
      // 检查是否遇到 CF 五秒盾或 403
      if (!isBlocked(html)) {
        // 使用 JSDOM 解析 HTML
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (article && article.textContent && article.textContent.trim().length > 100) {
          console.log(`[Extractor] Layer 1 成功提取 (${article.textContent.length} 字符)`);
          return article.textContent.trim().slice(0, maxLength);
        } else {
          console.log(`[Extractor] Layer 1 内容太短，尝试 fallback`);
        }
      } else {
        console.log(`[Extractor] Layer 1 遭遇防爬虫拦截`);
      }
    } else {
      console.log(`[Extractor] Layer 1 请求失败: HTTP ${response.status}`);
    }
  } catch (error: any) {
    console.log(`[Extractor] Layer 1 异常: ${error.message}`);
  }
  
  // ==========================================
  // 第二层：降级 Jina AI Reader API
  // ==========================================
  console.log(`[Extractor] 触发 Layer 2 (Jina AI)...`);
  try {
    const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!jinaResponse.ok) {
      throw new Error(`Jina AI: ${jinaResponse.status} ${jinaResponse.statusText}`);
    }
    
    const json = await jinaResponse.json();
    const content = json.data?.content || json.content || '';
    
    if (content) {
      console.log(`[Extractor] Layer 2 成功提取 (${content.length} 字符)`);
      return content.slice(0, maxLength);
    }
    
  } catch (error: any) {
    console.error(`[Extractor] Layer 2 彻底失败:`, error);
  }

  return '';
}
