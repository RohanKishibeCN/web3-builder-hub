async function testDoraHacks() {
  try {
    const res = await fetch('https://dorahacks.io/api/v1/hackathon/list?page=1&size=20&status=active', {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`[DoraHacks] Status: ${res.status}`);
    const data = await res.json();
    console.log(` -> 找到 Hackathon 数量: ${data.data?.list?.length || 0}`);
  } catch (e) { console.error('[DoraHacks] Error:', e.message); }
}

async function testDevfolio() {
  try {
    const res = await fetch('https://api.devfolio.co/api/search/hackathons?filter=open', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log(`[Devfolio] Status: ${res.status}`);
    const data = await res.json();
    const list = data.hits?.[0]?.hits || data.data || data || [];
    console.log(` -> 找到 Hackathon 数量: ${list.length}`);
  } catch (e) { console.error('[Devfolio] Error:', e.message); }
}

async function testGitcoin() {
  const query = `query GetActiveRounds { rounds(first: 20, orderBy: CREATED_AT_DESC) { id roundMetadata } }`;
  try {
    const res = await fetch('https://indexer.allo.gitcoin.co/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ query })
    });
    console.log(`[Gitcoin] Status: ${res.status}`);
    const data = await res.json();
    console.log(` -> 找到 Rounds 数量: ${data.data?.rounds?.length || 0}`);
  } catch (e) { console.error('[Gitcoin] Error:', e.message); }
}

async function runAll() {
  await testDoraHacks();
  await testDevfolio();
  await testGitcoin();
}
runAll();
