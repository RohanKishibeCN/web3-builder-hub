const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

const customFetch = async (url, init) => {
  console.log("FETCH URL:", url);
  console.log("FETCH METHOD:", init.method);
  console.log("FETCH HEADERS:", init.headers);
  console.log("FETCH BODY:", init.body);
  const res = await fetch(url, init);
  console.log("RESPONSE STATUS:", res.status);
  console.log("RESPONSE TEXT:", await res.clone().text());
  return res;
};

const kimi = createOpenAI({
  baseURL: 'https://api.moonshot.ai/v1',
  apiKey: 'sk-1234567890abcdef',
  fetch: customFetch
});

async function run() {
  try {
    const { text } = await generateText({
      model: kimi('kimi-k2.5'),
      prompt: 'Hello',
    });
    console.log(text);
  } catch (e) {
    console.log("NAME:", e.name);
    console.log("MESSAGE:", e.message);
    console.log("STATUS:", e.statusCode);
  }
}
run();
