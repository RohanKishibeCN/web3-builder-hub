const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

const kimi = createOpenAI({
  baseURL: 'https://api.moonshot.ai/v1',
  apiKey: 'sk-1234567890abcdef',
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
