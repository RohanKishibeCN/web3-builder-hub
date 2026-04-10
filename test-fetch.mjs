async function testFetch(url) {
  try {
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Length: ${text.length}`);
    console.log(`Snippet: ${text.slice(0, 100).replace(/\n/g, '')}\n`);
  } catch (e) {
    console.error(`Fetch failed for ${url}: ${e.message}\n`);
  }
}

async function run() {
  await testFetch('https://blog.sui.io/rss/');
  await testFetch('https://base.mirror.xyz/feed/atom');
  await testFetch('https://blog.ethereum.org/feed.xml');
}

run();
