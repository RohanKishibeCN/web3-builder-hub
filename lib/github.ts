/**
 * Web3 Builder Hub - GitHub 操作工具类
 */
import { Octokit } from '@octokit/rest';

export async function writeDailyReportToGithub(markdownContent: string): Promise<boolean> {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    console.error('GITHUB_PAT not configured, skip writing to github.');
    return false;
  }

  // 您提供的仓库地址为 https://github.com/RohanKishibeCN/web3-builder-hub
  const owner = 'RohanKishibeCN';
  const repo = 'web3-builder-hub';
  const path = 'dailyreport.md';

  const octokit = new Octokit({ auth: token });

  try {
    let sha: string | undefined;

    // 先尝试获取现有的文件以获取 sha
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (data && !Array.isArray(data) && 'sha' in data) {
        sha = data.sha;
      }
    } catch (e: any) {
      // 404 表示文件不存在，正常情况，继续创建
      if (e.status !== 404) {
        throw e;
      }
    }

    // 格式化当前时间为北京时间
    const dateStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    // 添加标题和时间戳
    const finalContent = `# Web3 Builder Daily Report
_Last updated: ${dateStr}_\n\n${markdownContent}`;

    // 使用 Base64 编码
    const contentEncoded = Buffer.from(finalContent, 'utf-8').toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `docs: update daily report [skip ci]`,
      content: contentEncoded,
      sha,
    });

    console.log(`Successfully wrote dailyreport.md to GitHub.`);
    return true;
  } catch (error) {
    console.error('Failed to write daily report to GitHub:', error);
    return false;
  }
}
