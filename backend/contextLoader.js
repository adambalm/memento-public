/**
 * Context Loader
 * Loads user context from ~/.memento/context.json if available.
 * Returns null if file doesn't exist - Memento works fine without it.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Context file location (user-level, shared across projects)
const CONTEXT_PATH = path.join(os.homedir(), '.memento', 'context.json');

// Maximum age before context is considered stale (24 hours)
const MAX_CONTEXT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Check if context is stale based on generated timestamp
 */
function isStale(generated, maxAgeMs = MAX_CONTEXT_AGE_MS) {
  if (!generated) return true;

  try {
    const generatedDate = new Date(generated);
    const ageMs = Date.now() - generatedDate.getTime();
    return ageMs > maxAgeMs;
  } catch {
    return true;
  }
}

/**
 * Load context from ~/.memento/context.json
 * Returns null if:
 * - File doesn't exist
 * - File is invalid JSON
 * - Context is stale (>24h old)
 */
function loadContext() {
  try {
    if (!fs.existsSync(CONTEXT_PATH)) {
      // No context file - this is fine, Memento works without it
      return null;
    }

    const raw = fs.readFileSync(CONTEXT_PATH, 'utf-8');
    const context = JSON.parse(raw);

    // Validate required fields
    if (!context.version || !context.activeProjects) {
      console.warn('[Context] Invalid context file: missing required fields');
      return null;
    }

    // Check staleness
    if (isStale(context.generated)) {
      console.error('[Context] Context file is stale (>24h), ignoring');
      return null;
    }

    console.error(`[Context] Loaded ${context.activeProjects.length} active project(s) from context.json`);
    return context;
  } catch (error) {
    // File doesn't exist or is invalid - this is fine
    if (error.code !== 'ENOENT') {
      console.warn(`[Context] Error loading context: ${error.message}`);
    }
    return null;
  }
}

/**
 * Get the path where context.json should be stored
 * Useful for the triage skill to know where to write
 */
function getContextPath() {
  return CONTEXT_PATH;
}

/**
 * Save context to ~/.memento/context.json
 * @param {Object} data - Object with activeProjects array or {activeProjects: [...]}
 * @returns {Promise<Object>} The saved context object
 */
async function saveContext(data) {
  const contextDir = path.dirname(CONTEXT_PATH);

  // Ensure directory exists
  await fs.promises.mkdir(contextDir, { recursive: true });

  // Normalize input - accept either {activeProjects: [...]} or just [...]
  const activeProjects = Array.isArray(data) ? data : (data.activeProjects || []);

  const contextData = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    activeProjects: activeProjects.map(p => ({
      name: p.name,
      keywords: p.keywords || [],
      categoryType: p.categoryType || 'Project'
    }))
  };

  await fs.promises.writeFile(CONTEXT_PATH, JSON.stringify(contextData, null, 2));
  console.error(`[Context] Saved ${activeProjects.length} active project(s) to context.json`);

  return contextData;
}

module.exports = { loadContext, getContextPath, isStale, saveContext };
