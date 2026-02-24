/**
 * Effort Manager Module
 *
 * Manages user-created efforts (grouped tabs representing a single work focus).
 * Efforts allow users to group related tabs that the AI scattered across categories.
 *
 * Efforts are stored in the session JSON alongside dispositions.
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveSessionPath } = require('./sessionPath');
const { appendBatchDisposition } = require('./dispositions');

const MEMORY_DIR = path.join(__dirname, '..', 'memory', 'sessions');

/**
 * Get the file path for a session
 */
function sessionPath(sessionId) {
  return resolveSessionPath(MEMORY_DIR, sessionId);
}

/**
 * Create a new effort in a session
 * @param {string} sessionId - Session ID
 * @param {string} name - Effort name (e.g., "Google Flow Debugging")
 * @param {Array<Object>} items - Array of {itemId, title, url, category}
 * @returns {Promise<{success: boolean, effort?: Object, message?: string}>}
 */
async function createEffort(sessionId, name, items) {
  if (!name || !name.trim()) {
    return { success: false, message: 'Effort name is required' };
  }

  if (!items || items.length === 0) {
    return { success: false, message: 'At least one item is required' };
  }

  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    // Initialize efforts array if needed
    if (!session.efforts) {
      session.efforts = [];
    }

    // Generate effort ID
    const effortId = `effort-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const effort = {
      id: effortId,
      name: name.trim(),
      items: items.map(item => ({
        itemId: item.itemId,
        title: item.title,
        url: item.url,
        originalCategory: item.category
      })),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    session.efforts.push(effort);

    await fs.writeFile(filepath, JSON.stringify(session, null, 2));

    console.error(`[Effort] Created "${name}" with ${items.length} items in session ${sessionId}`);

    return {
      success: true,
      effort
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, message: `Session not found: ${sessionId}` };
    }
    console.error(`Failed to create effort: ${error.message}`);
    return { success: false, message: `Failed to create effort: ${error.message}` };
  }
}

/**
 * Get all efforts for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of efforts
 */
async function getEfforts(sessionId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);
    return session.efforts || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Complete an effort (mark all items as complete)
 * @param {string} sessionId - Session ID
 * @param {string} effortId - Effort ID
 * @returns {Promise<{success: boolean, completedCount?: number, message?: string}>}
 */
async function completeEffort(sessionId, effortId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    if (!session.efforts) {
      return { success: false, message: 'No efforts found' };
    }

    const effort = session.efforts.find(e => e.id === effortId);
    if (!effort) {
      return { success: false, message: 'Effort not found' };
    }

    if (effort.status !== 'pending') {
      return { success: false, message: 'Effort already resolved' };
    }

    // Mark effort as completed
    effort.status = 'completed';
    effort.completedAt = new Date().toISOString();

    // Create batch dispositions for all items in the effort
    const dispositions = effort.items.map(item => ({
      action: 'complete',
      itemId: item.itemId
    }));

    // Append dispositions
    await appendBatchDisposition(sessionId, dispositions);

    // Save updated session
    await fs.writeFile(filepath, JSON.stringify(session, null, 2));

    console.error(`[Effort] Completed "${effort.name}" with ${effort.items.length} items`);

    return {
      success: true,
      completedCount: effort.items.length
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, message: `Session not found: ${sessionId}` };
    }
    console.error(`Failed to complete effort: ${error.message}`);
    return { success: false, message: `Failed to complete effort: ${error.message}` };
  }
}

/**
 * Defer an effort (mark all items as later/deferred)
 * @param {string} sessionId - Session ID
 * @param {string} effortId - Effort ID
 * @returns {Promise<{success: boolean, deferredCount?: number, message?: string}>}
 */
async function deferEffort(sessionId, effortId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    if (!session.efforts) {
      return { success: false, message: 'No efforts found' };
    }

    const effort = session.efforts.find(e => e.id === effortId);
    if (!effort) {
      return { success: false, message: 'Effort not found' };
    }

    if (effort.status !== 'pending') {
      return { success: false, message: 'Effort already resolved' };
    }

    // Mark effort as deferred
    effort.status = 'deferred';
    effort.deferredAt = new Date().toISOString();

    // Create batch dispositions for all items in the effort
    const dispositions = effort.items.map(item => ({
      action: 'later',
      itemId: item.itemId
    }));

    // Append dispositions
    await appendBatchDisposition(sessionId, dispositions);

    // Save updated session
    await fs.writeFile(filepath, JSON.stringify(session, null, 2));

    console.error(`[Effort] Deferred "${effort.name}" with ${effort.items.length} items`);

    return {
      success: true,
      deferredCount: effort.items.length
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: false, message: `Session not found: ${sessionId}` };
    }
    console.error(`Failed to defer effort: ${error.message}`);
    return { success: false, message: `Failed to defer effort: ${error.message}` };
  }
}

/**
 * Get effort stats for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Stats object
 */
async function getEffortStats(sessionId) {
  const efforts = await getEfforts(sessionId);

  return {
    total: efforts.length,
    pending: efforts.filter(e => e.status === 'pending').length,
    completed: efforts.filter(e => e.status === 'completed').length,
    deferred: efforts.filter(e => e.status === 'deferred').length,
    totalItems: efforts.reduce((sum, e) => sum + e.items.length, 0)
  };
}

module.exports = {
  createEffort,
  getEfforts,
  completeEffort,
  deferEffort,
  getEffortStats
};
