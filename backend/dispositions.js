/**
 * Dispositions Module
 *
 * Enforces the append-only dispositions invariant.
 * See: docs/SESSION-ARTIFACT-INVARIANTS.md
 *
 * INVARIANT: Disposition entries are append-only.
 * This module provides the ONLY path to modify the dispositions array.
 * No function exists to edit or delete existing entries.
 */

const fs = require('fs').promises;
const path = require('path');
const { resolveSessionPath } = require('./sessionPath');

const MEMORY_DIR = path.join(__dirname, '..', 'memory', 'sessions');

/**
 * Valid disposition actions
 */
const VALID_ACTIONS = ['trash', 'complete', 'regroup', 'reprioritize', 'promote', 'defer', 'later', 'undo'];

/**
 * Get the file path for a session
 */
function sessionPath(sessionId) {
  return resolveSessionPath(MEMORY_DIR, sessionId);
}

/**
 * Append a disposition to a session's dispositions array.
 *
 * This is the ONLY function that modifies the dispositions array.
 * It enforces append-only semantics.
 *
 * @param {string} sessionId - Session ID (filename without .json)
 * @param {Object} disposition - The disposition to append
 * @param {string} disposition.action - One of: trash, complete, regroup, reprioritize, promote
 * @param {string} disposition.itemId - The tab/item ID affected
 * @param {string} [disposition.from] - For regroup: original category
 * @param {string} [disposition.to] - For regroup: new category
 * @param {string} [disposition.target] - For promote: destination URI
 * @param {number} [disposition.priority] - For reprioritize: new priority
 * @returns {Promise<{success: boolean, message: string, disposition?: Object}>}
 */
async function appendDisposition(sessionId, disposition) {
  // Validate action
  if (!disposition.action || !VALID_ACTIONS.includes(disposition.action)) {
    return {
      success: false,
      message: `Invalid action: ${disposition.action}. Must be one of: ${VALID_ACTIONS.join(', ')}`
    };
  }

  // Validate itemId
  if (!disposition.itemId) {
    return {
      success: false,
      message: 'Missing required field: itemId'
    };
  }

  // Action-specific validation
  if (disposition.action === 'regroup') {
    if (!disposition.from || !disposition.to) {
      return {
        success: false,
        message: 'regroup action requires "from" and "to" fields'
      };
    }
  }

  if (disposition.action === 'promote') {
    if (!disposition.target) {
      return {
        success: false,
        message: 'promote action requires "target" field'
      };
    }
  }

  if (disposition.action === 'undo') {
    if (!disposition.undoes) {
      return {
        success: false,
        message: 'undo action requires "undoes" field specifying which action to undo'
      };
    }
  }

  try {
    // Read current session
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    // Build the disposition entry with timestamp
    const entry = {
      action: disposition.action,
      itemId: disposition.itemId,
      at: new Date().toISOString()
    };

    // Add action-specific fields
    if (disposition.from) entry.from = disposition.from;
    if (disposition.to) entry.to = disposition.to;
    if (disposition.target) entry.target = disposition.target;
    if (disposition.priority !== undefined) entry.priority = disposition.priority;
    if (disposition.undoes) entry.undoes = disposition.undoes;

    // Ensure dispositions array exists
    if (!session.dispositions) {
      session.dispositions = [];
    }

    // APPEND ONLY — this is the invariant
    session.dispositions.push(entry);

    // Write back
    await fs.writeFile(filepath, JSON.stringify(session, null, 2));

    console.error(`Disposition appended: ${disposition.action} on ${disposition.itemId} in session ${sessionId}`);

    return {
      success: true,
      message: `Appended ${disposition.action} disposition`,
      disposition: entry
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: `Session not found: ${sessionId}`
      };
    }
    console.error(`Failed to append disposition: ${error.message}`);
    return {
      success: false,
      message: `Failed to append disposition: ${error.message}`
    };
  }
}

/**
 * Get all dispositions for a session
 *
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of disposition entries (empty if none)
 */
async function getDispositions(sessionId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);
    return session.dispositions || [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get the current state of a session with dispositions applied.
 *
 * Returns items organized by their CURRENT category (after regrouping),
 * with disposition status (trashed, completed, promoted) indicated.
 *
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Session with dispositions applied as a view layer
 */
async function getSessionWithDispositions(sessionId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    // Build a map of item states from dispositions
    const itemStates = new Map();
    const itemCategories = new Map();

    // Initialize from original groups
    // Groups can be either an object { "Category": [...items] } or array [{ category, items }]
    const groups = session.groups || {};
    const isObjectFormat = !Array.isArray(groups);

    if (isObjectFormat) {
      // Object format: { "Research": [...], "Development": [...] }
      for (const [category, items] of Object.entries(groups)) {
        for (const item of (items || [])) {
          const itemId = item.url || item.id;
          itemCategories.set(itemId, category);
          itemStates.set(itemId, { status: 'pending' });
        }
      }
    } else {
      // Array format: [{ category: "Research", items: [...] }]
      for (const group of groups) {
        for (const item of (group.items || [])) {
          const itemId = item.url || item.id;
          itemCategories.set(itemId, group.category);
          itemStates.set(itemId, { status: 'pending' });
        }
      }
    }

    // Apply dispositions in order
    for (const disp of (session.dispositions || [])) {
      const current = itemStates.get(disp.itemId) || { status: 'pending' };

      switch (disp.action) {
        case 'trash':
          current.status = 'trashed';
          current.trashedAt = disp.at;
          break;
        case 'complete':
          current.status = 'completed';
          current.completedAt = disp.at;
          break;
        case 'promote':
          current.status = 'promoted';
          current.promotedAt = disp.at;
          current.promotedTo = disp.target;
          break;
        case 'regroup':
          itemCategories.set(disp.itemId, disp.to);
          break;
        case 'reprioritize':
          current.priority = disp.priority;
          break;
        case 'defer':
          current.status = 'deferred';
          current.deferredAt = disp.at;
          break;
        case 'later':
          current.status = 'later';
          current.laterAt = disp.at;
          break;
        case 'undo':
          // Restore item to pending status
          current.status = 'pending';
          current.undoneAt = disp.at;
          current.undoneAction = disp.undoes;
          // Clear previous action timestamps
          delete current.trashedAt;
          delete current.completedAt;
          delete current.promotedAt;
          delete current.promotedTo;
          delete current.deferredAt;
          delete current.laterAt;
          break;
      }

      itemStates.set(disp.itemId, current);
    }

    // Count unresolved items (not trashed, completed, or promoted)
    let unresolvedCount = 0;
    for (const [itemId, state] of itemStates) {
      if (state.status === 'pending') {
        unresolvedCount++;
      }
    }

    return {
      sessionId,
      capturedAt: session.meta?.capturedAt || session.timestamp,
      originalGroups: session.groups,
      itemStates: Object.fromEntries(itemStates),
      itemCategories: Object.fromEntries(itemCategories),
      dispositionCount: (session.dispositions || []).length,
      unresolvedCount,
      allResolved: unresolvedCount === 0
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Append multiple dispositions atomically.
 *
 * Used for batch operations. Maintains append-only invariant.
 * All dispositions are written in a single file operation.
 *
 * @param {string} sessionId - Session ID
 * @param {Array<Object>} dispositions - Array of disposition objects
 * @returns {Promise<{success: boolean, message: string, count: number}>}
 */
async function appendBatchDisposition(sessionId, dispositions) {
  if (!Array.isArray(dispositions) || dispositions.length === 0) {
    return {
      success: false,
      message: 'dispositions must be a non-empty array'
    };
  }

  // Validate all dispositions first
  for (const disposition of dispositions) {
    if (!disposition.action || !VALID_ACTIONS.includes(disposition.action)) {
      return {
        success: false,
        message: `Invalid action: ${disposition.action}. Must be one of: ${VALID_ACTIONS.join(', ')}`
      };
    }
    if (!disposition.itemId) {
      return {
        success: false,
        message: 'Missing required field: itemId in one or more dispositions'
      };
    }
  }

  try {
    // Read current session
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    // Ensure dispositions array exists
    if (!session.dispositions) {
      session.dispositions = [];
    }

    const timestamp = new Date().toISOString();
    const entries = [];

    // Build all entries
    for (const disposition of dispositions) {
      const entry = {
        action: disposition.action,
        itemId: disposition.itemId,
        at: timestamp,
        batch: true // Mark as batch operation for audit trail
      };

      // Add action-specific fields
      if (disposition.from) entry.from = disposition.from;
      if (disposition.to) entry.to = disposition.to;
      if (disposition.target) entry.target = disposition.target;
      if (disposition.priority !== undefined) entry.priority = disposition.priority;
      if (disposition.undoes) entry.undoes = disposition.undoes;

      entries.push(entry);
    }

    // APPEND ALL — single atomic operation
    session.dispositions.push(...entries);

    // Write back
    await fs.writeFile(filepath, JSON.stringify(session, null, 2));

    console.error(`Batch disposition appended: ${entries.length} items in session ${sessionId}`);

    return {
      success: true,
      message: `Appended ${entries.length} dispositions`,
      count: entries.length,
      dispositions: entries
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: `Session not found: ${sessionId}`
      };
    }
    console.error(`Failed to append batch disposition: ${error.message}`);
    return {
      success: false,
      message: `Failed to append batch disposition: ${error.message}`
    };
  }
}

/**
 * Get the full session data with dispositions applied.
 *
 * Returns the complete session object with groups reorganized
 * according to user dispositions (regroups, trashes, completions).
 *
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Full session with modified groups, or null if not found
 */
async function getSessionWithDispositionsApplied(sessionId) {
  try {
    const filepath = sessionPath(sessionId);
    const content = await fs.readFile(filepath, 'utf-8');
    const session = JSON.parse(content);

    const dispositions = session.dispositions || [];
    if (dispositions.length === 0) {
      // No dispositions, return as-is with disposition metadata
      return {
        ...session,
        _dispositions: {
          count: 0,
          trashedCount: 0,
          completedCount: 0,
          regroupedCount: 0
        }
      };
    }

    // Build item state map
    const itemStates = new Map(); // itemId -> { status, currentCategory }
    const groups = session.groups || {};

    // Initialize from original groups (object format)
    for (const [category, items] of Object.entries(groups)) {
      for (const item of (items || [])) {
        const itemId = item.url || `tab-${item.tabIndex}`;
        itemStates.set(itemId, {
          status: 'pending',
          originalCategory: category,
          currentCategory: category,
          item
        });
      }
    }

    // Apply dispositions
    let trashedCount = 0;
    let completedCount = 0;
    let regroupedCount = 0;

    for (const disp of dispositions) {
      const state = itemStates.get(disp.itemId);
      if (!state) continue;

      switch (disp.action) {
        case 'trash':
          state.status = 'trashed';
          trashedCount++;
          break;
        case 'complete':
          state.status = 'completed';
          completedCount++;
          break;
        case 'regroup':
          state.currentCategory = disp.to;
          state.regroupedFrom = disp.from;
          regroupedCount++;
          break;
        case 'later':
          state.status = 'later';
          break;
        case 'defer':
          state.status = 'deferred';
          break;
        case 'undo':
          state.status = 'pending';
          // If it was a regroup undo, restore original category
          if (disp.undoes === 'regroup') {
            state.currentCategory = state.originalCategory;
            delete state.regroupedFrom;
          }
          break;
      }

      itemStates.set(disp.itemId, state);
    }

    // Rebuild groups based on current state
    const newGroups = {};
    const trashedItems = [];
    const completedItems = [];
    const laterItems = [];

    for (const [itemId, state] of itemStates) {
      if (state.status === 'trashed') {
        trashedItems.push({ ...state.item, _dispositionStatus: 'trashed' });
      } else if (state.status === 'completed') {
        completedItems.push({ ...state.item, _dispositionStatus: 'completed' });
      } else if (state.status === 'later') {
        laterItems.push({ ...state.item, _dispositionStatus: 'later' });
      } else {
        // Active item - put in current category
        const cat = state.currentCategory;
        if (!newGroups[cat]) newGroups[cat] = [];
        const itemWithMeta = { ...state.item };
        if (state.regroupedFrom) {
          itemWithMeta._regroupedFrom = state.regroupedFrom;
        }
        newGroups[cat].push(itemWithMeta);
      }
    }

    return {
      ...session,
      groups: newGroups,
      _trashedItems: trashedItems,
      _completedItems: completedItems,
      _laterItems: laterItems,
      _dispositions: {
        count: dispositions.length,
        trashedCount,
        completedCount,
        regroupedCount,
        laterCount: laterItems.length
      }
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

module.exports = {
  appendDisposition,
  appendBatchDisposition,
  getDispositions,
  getSessionWithDispositions,
  getSessionWithDispositionsApplied,
  VALID_ACTIONS
};
