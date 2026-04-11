const endpoints = [
  {
    name: '1. CryptoFundraising',
    url: 'https://crypto-fundraising.info/deal-flow/', 
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  },
  {
    name: '2. GitHub Search API',
    url: 'https://api.github.com/search/repositories?q=web3+grant+bounty&sort=updated&order=desc',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  },
  {
    name: '3. DoraHacks API',
    url: 'https://dorahacks.io/api/v1/hackathon/list?page=1&size=20&status=active',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  },
  {
    name: '4. Devfolio API',
    url: 'https://api.devfolio.co/api/search/hackathons?filter=open',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  },
  {
    name: '5. Gitcoin/Allo GraphQL',
    url: 'https://indexer.allo.gitcoin.co/graphql',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      query: `query { rounds(first: 5, orderBy: CREATED_AT_DESC) { id roundMetadata } }`
    })
  }
];

async function testEndpoints() {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: endpoint.headers,
        body: endpoint.body
      });
      const text = await response.text();
      console.log(`${endpoint.name}: HTTP ${response.status}, len: ${text.length}`);
    } catch (error) {
      console.log(`${endpoint.name} ERROR: ${error.message}`);
    }
  }
}

testEndpoints();
