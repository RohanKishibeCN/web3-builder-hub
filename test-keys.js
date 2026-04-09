const { createOpenAI } = require('@ai-sdk/openai');
const kimi = createOpenAI({ apiKey: '123' });
console.log(Object.keys(kimi));
