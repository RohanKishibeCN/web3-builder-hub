import Parser from 'rss-parser';

const THIRTY_DAYS_AGO = new Date();
THIRTY_DAYS_AGO.setDate(THIRTY_DAYS_AGO.getDate() - 30);

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'content']
  }
});

function isRecent(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date >= THIRTY_DAYS_AGO;
}

async function testRssSource(name, url) {
  try {
    const feed = await parser.parseURL(url);
    const recentItems = feed.items.filter(item => isRecent(item.pubDate || item.isoDate));
    
    // Count how many mention developer keywords
    const keywords = /grant|hackathon|bounty|builder|developer|accelerator|fund/i;
    const relevantItems = recentItems.filter(item => {
      const text = (item.title + ' ' + (item.content || item['content:encoded'] || item.contentSnippet || '')).toLowerCase();
      return keywords.test(text);
    });

    console.log(`[+] ${name} (${url})`);
    console.log(`    - Total items in feed: ${feed.items.length}`);
    console.log(`    - Items in last 30 days: ${recentItems.length}`);
    console.log(`    - Relevant dev items (last 30 days): ${relevantItems.length}`);
    if (relevantItems.length > 0) {
      console.log(`    - Sample hit: "${relevantItems[0].title}"`);
    }
    console.log('');
  } catch (error) {
    console.error(`[-] ${name} (${url}) FAILED: ${error.message}\n`);
  }
}

async function main() {
  console.log(`=== Testing Tier 1 RSS Sources ===\n`);
  
  await testRssSource('Sui Blog', 'https://blog.sui.io/rss/');
  await testRssSource('Base Mirror', 'https://base.mirror.xyz/feed/atom');
  await testRssSource('Optimism Mirror', 'https://optimism.mirror.xyz/feed/atom');
  await testRssSource('Arbitrum Foundation', 'https://arbitrum.foundation/blog/rss.xml'); // Arbitrum often uses Ghost or custom
  await testRssSource('Devfolio Blog', 'https://devfolio.co/blog/rss/');
  await testRssSource('Gitcoin Mirror', 'https://gitcoin.mirror.xyz/feed/atom');
  await testRssSource('Aave Grants Mirror', 'https://aavegrants.mirror.xyz/feed/atom');
  await testRssSource('Ethereum Foundation', 'https://blog.ethereum.org/feed.xml');
}

main();
