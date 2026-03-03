/**
 * Web3 Builder Hub - 网页内容提取器
 * 使用 Jina AI Reader（免费，无需 API Key）
 */

export interface ExtractedContent {
  title: string;
  content: string;
  url: string;
  success: boolean;
  error?: string;
}

export async function extractWithJina(url: string): Promise<ExtractedContent> {
  try {
    const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
    
    const response = await fetch(jinaUrl, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const backupResponse = await fetch(`https://r.jina.ai/${url}`);
      if (!backupResponse.ok) {
        throw new Error(`Jina AI error: ${response.status}`);
      }
      
      const data = await backupResponse.json();
      return {
        title: data.title || '',
        content: data.content || '',
        url,
        success: true,
      };
    }

    const data = await response.json();
    return {
      title: data.title || '',
      content: data.content || '',
      url,
      success: true,
    };
  } catch (error) {
    console.error(`Extract content error for ${url}:`, error);
    return {
      title: '',
      content: '',
      url,
      success: false,
      error: String(error),
    };
  }
}
