/**
 * Model dispatch layer
 * API: runModel(engine, prompt) → string
 *      getEngineInfo(engine) → { engine, model, endpoint }
 */

const localOllama = require('./localOllama');
const anthropic = require('./anthropic');

const engines = {
  'ollama-local': localOllama,
  'anthropic': anthropic,
  'openai': {
    run: async () => { throw new Error('openai: not implemented'); },
    getConfig: () => ({ engine: 'openai', model: null, endpoint: null })
  }
};

async function runModel(engine, prompt) {
  const driver = engines[engine];
  if (!driver) {
    throw new Error(`Unknown engine: ${engine}`);
  }
  const result = await driver.run(prompt);

  // Normalize response: always return { text, usage }
  if (typeof result === 'string') {
    return { text: result, usage: null };
  }
  return { text: result.text, usage: result.usage || null };
}

function getEngineInfo(engine) {
  const driver = engines[engine];
  if (!driver || !driver.getConfig) {
    return { engine, model: null, endpoint: null };
  }
  return driver.getConfig();
}

module.exports = { runModel, getEngineInfo };
