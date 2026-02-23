/**
 * E2E Test Helpers
 * Shared utilities for end-to-end testing
 */

const fs = require('fs').promises;
const path = require('path');

const BACKEND_URL = 'http://localhost:3000';
const MEMORY_DIR = path.join(__dirname, '..', '..', 'memory', 'sessions');
const LOCK_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.memento', 'lock.json');

/**
 * Generate mock tab data for testing
 * @param {number} count - Number of tabs to generate
 * @returns {Array} Mock tab data
 */
function createMockTabs(count = 3) {
  const categories = ['github.com', 'stackoverflow.com', 'docs.example.com', 'amazon.com', 'news.ycombinator.com'];
  const tabs = [];

  for (let i = 0; i < count; i++) {
    const domain = categories[i % categories.length];
    tabs.push({
      url: `https://${domain}/page-${i}`,
      title: `Test Page ${i} - ${domain}`,
      content: `This is test content for page ${i}. It contains some text to help with classification.`
    });
  }

  return tabs;
}

/**
 * Create a test session via the backend API
 * @param {Object} options - Options
 * @param {number} options.tabCount - Number of mock tabs
 * @param {string} options.mode - 'results' or 'launchpad'
 * @returns {Promise<{sessionId: string, response: Object}>}
 */
async function createTestSession(options = {}) {
  const { tabCount = 3, mode = 'results' } = options;
  const tabs = createMockTabs(tabCount);

  const response = await fetch(`${BACKEND_URL}/classifyBrowserContext`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabs, mode })
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`);
  }

  const data = await response.json();

  // Use sessionId from meta (preferred) or extract from timestamp (fallback)
  const sessionId = data.meta?.sessionId ||
    data.timestamp?.replace(/:/g, '-').replace(/\.\d{3}Z$/, '');

  return { sessionId, response: data };
}

/**
 * Acquire a lock for a session
 * @param {string} sessionId
 * @param {number} itemsRemaining
 * @returns {Promise<Object>}
 */
async function acquireLock(sessionId, itemsRemaining = 0) {
  const response = await fetch(`${BACKEND_URL}/api/acquire-lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, itemsRemaining })
  });
  return response.json();
}

/**
 * Get current lock status
 * @returns {Promise<Object>}
 */
async function getLockStatus() {
  const response = await fetch(`${BACKEND_URL}/api/lock-status`);
  return response.json();
}

/**
 * Clear any existing lock
 * @param {string} sessionId - Optional session ID
 * @param {boolean} override - Force clear regardless of session
 * @returns {Promise<Object>}
 */
async function clearLock(sessionId = 'test-cleanup', override = true) {
  const response = await fetch(`${BACKEND_URL}/api/launchpad/${sessionId}/clear-lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ override })
  });
  return response.json();
}

/**
 * Force cleanup lock file directly
 */
async function forceCleanupLock() {
  try {
    await fs.unlink(LOCK_FILE);
  } catch (err) {
    // Ignore if file doesn't exist
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Record a disposition for a session item
 * @param {string} sessionId
 * @param {string} action - 'trash', 'complete', 'promote'
 * @param {string} itemId
 * @param {Object} extra - Additional fields (target, etc.)
 * @returns {Promise<Object>}
 */
async function recordDisposition(sessionId, action, itemId, extra = {}) {
  const response = await fetch(`${BACKEND_URL}/api/launchpad/${sessionId}/disposition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, itemId, ...extra })
  });
  return response.json();
}

/**
 * Get session state with dispositions applied
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
async function getSessionState(sessionId) {
  const response = await fetch(`${BACKEND_URL}/api/launchpad/${sessionId}/state`);
  if (!response.ok) {
    throw new Error(`Failed to get session state: ${response.status}`);
  }
  return response.json();
}

/**
 * Read a session file directly from disk
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
async function readSessionFile(sessionId) {
  const filepath = path.join(MEMORY_DIR, `${sessionId}.json`);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Clean up test sessions from disk
 * @param {string[]} sessionIds - Session IDs to remove
 */
async function cleanupSessions(sessionIds) {
  for (const sessionId of sessionIds) {
    try {
      await fs.unlink(path.join(MEMORY_DIR, `${sessionId}.json`));
    } catch (err) {
      // Ignore if file doesn't exist
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

/**
 * Simple assertion helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equality
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Assert object has property
 */
function assertHas(obj, prop, message) {
  if (!(prop in obj)) {
    throw new Error(`${message}: missing property '${prop}'`);
  }
}

/**
 * Wait for a condition with timeout
 * @param {Function} conditionFn - Returns true when condition met
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {number} intervalMs - Check interval
 */
async function waitFor(conditionFn, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await conditionFn()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Colors for console output
 */
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`
};

module.exports = {
  BACKEND_URL,
  MEMORY_DIR,
  createMockTabs,
  createTestSession,
  acquireLock,
  getLockStatus,
  clearLock,
  forceCleanupLock,
  recordDisposition,
  getSessionState,
  readSessionFile,
  cleanupSessions,
  assert,
  assertEqual,
  assertHas,
  waitFor,
  colors
};
