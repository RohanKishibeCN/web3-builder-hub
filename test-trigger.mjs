import fetch from 'node-fetch';

async function test() {
  const url = 'http://localhost:3000/api/discover-tier1';
  try {
    const res = await fetch(url, { method: 'POST' });
    const text = await res.text();
    console.log(res.status, text);
  } catch (err) {
    console.error(err);
  }
}
test();
