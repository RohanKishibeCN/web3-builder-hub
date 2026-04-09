const { createOpenAI } = require('@ai-sdk/openai');
const kimi = createOpenAI({ apiKey: '123' });
console.log(kimi('kimi-k2.5'));
