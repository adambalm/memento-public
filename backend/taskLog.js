/**
 * Task Log Module
 *
 * Append-only log of task actions for the Task-Driven Attention System.
 * Follows the same pattern as dispositions.js.
 *
 * INVARIANT: Log entries are append-only.
 * This module provides the ONLY path to modify the task log.
 * No function exists to edit or delete existing entries.
 *
 * @see ../docs/SESSION-ARTIFACT-INVARIANTS.md for invariant context
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Task log location (user-level, shared across sessions)
const MEMENTO_DIR = path.join(os.homedir(), '.memento');
const TASK_LOG_PATH = path.join(MEMENTO_DIR, 'task-log.json');

/**
 * Valid task action types
 */
const VALID_ACTIONS = [
  'engage',      // User chose to engage with the item
  'release',     // User chose to let go of the item
  'defer',       // User chose to come back later
  'pause',       // User chose to pause a project
  'triage',      // User chose to triage (keep some, release rest)
  'detailed',    // User chose to review each item
  'release_all', // User chose to release all (bankruptcy)
  'explore',     // User chose to explore/talk about it
  'skip',        // User skipped this task (show me something else)
  'dismiss'      // User dismissed without action
];

/**
 * Ensure the log file exists
 */
async function ensureLogFile() {
  try {
    await fs.mkdir(MEMENTO_DIR, { recursive: true });

    try {
      await fs.access(TASK_LOG_PATH);
    } catch (e) {
      // File doesn't exist, create it
      await fs.writeFile(TASK_LOG_PATH, JSON.stringify({
        version: '1.0.0',
        created: new Date().toISOString(),
        entries: []
      }, null, 2));
    }
  } catch (error) {
    console.error(`[TaskLog] Failed to ensure log file: ${error.message}`);
  }
}

/**
 * Read the task log
 */
async function readLog() {
  await ensureLogFile();

  try {
    const content = await fs.readFile(TASK_LOG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[TaskLog] Failed to read log: ${error.message}`);
    return { version: '1.0.0', created: new Date().toISOString(), entries: [] };
  }
}

/**
 * Append an action to the task log
 *
 * This is the ONLY function that modifies the task log.
 * It enforces append-only semantics.
 *
 * @param {Object} entry - The log entry to append
 * @param {string} entry.taskId - The task ID
 * @param {string} entry.taskType - The task type (ghost_tab, project_revival, tab_bankruptcy)
 * @param {string} entry.action - One of VALID_ACTIONS
 * @param {Object} entry.task - Snapshot of the task at action time
 * @param {string} [entry.userReflection] - Optional user comment
 * @param {Array} [entry.conversation] - Optional chat history
 * @returns {Promise<{success: boolean, message: string, entry?: Object}>}
 */
async function appendAction(entry) {
  // Validate action
  if (!entry.action || !VALID_ACTIONS.includes(entry.action)) {
    return {
      success: false,
      message: `Invalid action: ${entry.action}. Must be one of: ${VALID_ACTIONS.join(', ')}`
    };
  }

  // Validate taskId
  if (!entry.taskId) {
    return {
      success: false,
      message: 'Missing required field: taskId'
    };
  }

  try {
    const log = await readLog();

    // Build the log entry with timestamp
    const logEntry = {
      taskId: entry.taskId,
      taskType: entry.taskType || 'unknown',
      action: entry.action,
      at: new Date().toISOString(),

      // Snapshot of task context
      task: {
        title: entry.task?.title || entry.task?.projectName,
        url: entry.task?.url,
        type: entry.task?.type,
        score: entry.task?.score,
        insight: entry.task?.insight,
        theQuestion: entry.task?.theQuestion
      },

      // Optional fields
      ...(entry.userReflection && { userReflection: entry.userReflection }),
      ...(entry.conversation && { conversation: entry.conversation }),
      ...(entry.derivedGoal && { derivedGoal: entry.derivedGoal })
    };

    // APPEND ONLY - this is the invariant
    log.entries.push(logEntry);

    // Write back
    await fs.writeFile(TASK_LOG_PATH, JSON.stringify(log, null, 2));

    console.error(`[TaskLog] Action logged: ${entry.action} on ${entry.taskId}`);

    return {
      success: true,
      message: `Logged ${entry.action} action`,
      entry: logEntry
    };

  } catch (error) {
    console.error(`[TaskLog] Failed to append action: ${error.message}`);
    return {
      success: false,
      message: `Failed to append action: ${error.message}`
    };
  }
}

/**
 * Get all log entries
 *
 * @returns {Promise<Array>} Array of log entries
 */
async function getEntries() {
  const log = await readLog();
  return log.entries || [];
}

/**
 * Get entries for a specific task
 *
 * @param {string} taskId - Task ID to filter by
 * @returns {Promise<Array>} Filtered entries
 */
async function getEntriesForTask(taskId) {
  const entries = await getEntries();
  return entries.filter(e => e.taskId === taskId);
}

/**
 * Get recent entries
 *
 * @param {number} limit - Max entries to return (default: 20)
 * @returns {Promise<Array>} Recent entries, newest first
 */
async function getRecentEntries(limit = 20) {
  const entries = await getEntries();
  return entries
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .slice(0, limit);
}

/**
 * Get action statistics
 *
 * @returns {Promise<Object>} Action counts and patterns
 */
async function getStats() {
  const entries = await getEntries();

  const actionCounts = {};
  const taskTypeCounts = {};
  let totalActions = 0;

  for (const entry of entries) {
    totalActions++;

    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    taskTypeCounts[entry.taskType] = (taskTypeCounts[entry.taskType] || 0) + 1;
  }

  // Calculate engagement rate (engage actions vs release/defer)
  const engageCount = actionCounts['engage'] || 0;
  const releaseCount = (actionCounts['release'] || 0) + (actionCounts['release_all'] || 0);
  const deferCount = (actionCounts['defer'] || 0) + (actionCounts['pause'] || 0);

  const decisionCount = engageCount + releaseCount + deferCount;
  const engagementRate = decisionCount > 0
    ? Math.round((engageCount / decisionCount) * 100)
    : 0;

  return {
    totalActions,
    actionCounts,
    taskTypeCounts,
    engagementRate,
    firstEntry: entries.length > 0 ? entries[0].at : null,
    lastEntry: entries.length > 0 ? entries[entries.length - 1].at : null
  };
}

/**
 * Check if a task was recently dismissed (to avoid showing again)
 *
 * @param {string} taskId - Task ID
 * @param {number} hoursAgo - Hours to look back (default: 24)
 * @returns {Promise<boolean>} True if recently dismissed
 */
async function wasRecentlyDismissed(taskId, hoursAgo = 24) {
  const entries = await getEntriesForTask(taskId);
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

  return entries.some(e =>
    (e.action === 'dismiss' || e.action === 'skip' || e.action === 'defer') &&
    e.at > cutoff
  );
}

/**
 * Get tasks that were engaged with but may need follow-up
 *
 * @param {number} daysAgo - Days to look back (default: 7)
 * @returns {Promise<Array>} Tasks that were engaged with
 */
async function getEngagedTasks(daysAgo = 7) {
  const entries = await getEntries();
  const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  return entries
    .filter(e => e.action === 'engage' && e.at > cutoff)
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

module.exports = {
  appendAction,
  getEntries,
  getEntriesForTask,
  getRecentEntries,
  getStats,
  wasRecentlyDismissed,
  getEngagedTasks,
  VALID_ACTIONS
};
