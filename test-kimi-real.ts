const { generateText, generateObject, streamText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

let key = process.env.KIMI_API_KEY || process.env.LLM_API_KEY;

if (!key) {
  console.log('No Kimi API key found to test.');
  process.exit(0);
}

const customFetch = async (url, init) => {
  if (init && init.body && typeof init.body === 'string') {
    try {
      const bodyObj = JSON.parse(init.body);
      if (bodyObj.stream_options) {
        delete bodyObj.stream_options;
      }
      init.body = JSON.stringify(bodyObj);
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  return fetch(url, init);
};

const kimi = createOpenAI({
  baseURL: 'https://api.moonshot.ai/v1',
  apiKey: key,
  fetch: customFetch,
});

async function run() {
  try {
    console.log('Testing generateText with kimi-k2.5...');
    const { text } = await generateText({
      model: kimi('kimi-k2.5'),
      prompt: 'Hello',
    });
    console.log('generateText success:', text.slice(0, 50));
  } catch (e) {
    console.error('generateText failed:', e.message);
  }
}
run();
