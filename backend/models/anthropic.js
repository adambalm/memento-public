/**
 * Anthropic Claude model driver
 */

const CONFIG = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 180000,  // 3 minutes for exhaustive classification
  maxRetries: 2,
  maxTokens: 8000   // More tokens for full tab listing
};

function getConfig() {
  return {
    engine: 'anthropic',
    model: CONFIG.model,
    endpoint: CONFIG.endpoint
  };
}

async function run(prompt, attempt = 1) {
  if (!CONFIG.apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

  try {
    const response = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic HTTP ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    // Extract text from the response
    if (data.content && data.content.length > 0) {
      const text = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Return both text and usage data
      return {
        text,
        usage: data.usage || null,  // { input_tokens, output_tokens }
        model: data.model
      };
    }

    throw new Error('No text content in Anthropic response');
  } catch (error) {
    clearTimeout(timeoutId);

    if (attempt < CONFIG.maxRetries) {
      console.log(`Anthropic attempt ${attempt} failed: ${error.message}. Retrying...`);
      return run(prompt, attempt + 1);
    }

    throw error;
  }
}

module.exports = { run, getConfig };
