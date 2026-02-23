/**
 * Local Ollama model driver
 */

const CONFIG = {
  endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate',
  model: 'qwen3',  // Hardcoded for testing - TODO: restore env override after validation
  timeout: 180000,  // 3 minutes for exhaustive classification
  maxRetries: 2,
  num_predict: 8000  // More tokens for full tab listing
};

function getConfig() {
  return {
    engine: 'ollama-local',
    model: CONFIG.model,
    endpoint: CONFIG.endpoint
  };
}

async function run(prompt, attempt = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

  try {
    const response = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.model,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: CONFIG.num_predict }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (attempt < CONFIG.maxRetries) {
      console.log(`Ollama attempt ${attempt} failed: ${error.message}. Retrying...`);
      return run(prompt, attempt + 1);
    }

    throw error;
  }
}

module.exports = { run, getConfig };
