import Parser from 'rss-parser';

const parser = new Parser();

async function testRssSource(name, url) {
  try {
    const feed = await parser.parseURL(url);
    console.log(`[+] ${name} (${url})`);
    console.log(`    - 成功拉取! 发现文章数: ${feed.items.length}`);
    if (feed.items.length > 0) {
      console.log(`    - 最新文章: "${feed.items[0].title}"`);
    }
    console.log('');
  } catch (error) {
    console.error(`[-] ${name} (${url}) FAILED: ${error.message}\n`);
  }
}

async function main() {
  console.log(`=== Testing Paragraph.xyz Sources ===\n`);
  await testRssSource('Base Official', 'https://paragraph.xyz/@base/rss');
  await testRssSource('Gitcoin', 'https://paragraph.xyz/@gitcoin/rss');
  await testRssSource('Farcaster', 'https://paragraph.xyz/@farcaster/rss');
}

main();
