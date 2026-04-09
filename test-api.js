const https = require('https');

const data = JSON.stringify({
  model: 'kimi-k2.5',
  messages: [{ role: 'user', content: 'Hello' }]
});

const req = https.request({
  hostname: 'api.moonshot.ai',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test'
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { 
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    console.log(`BODY: ${body}`); 
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});
req.write(data);
req.end();
