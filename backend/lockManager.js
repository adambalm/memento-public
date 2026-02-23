/**
 * Session Lock Manager
 *
 * Manages session lock state for Nuclear Option / Launchpad mode.
 * When locked, new captures are blocked until the user resolves pending items.
 *
 * Lock file location: ~/.memento/lock.json
 *
 * See: dialogues/Dialogue - Nuclear Option Memento Convergence.md
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const MEMENTO_DIR = path.join(os.homedir(), '.memento');
const LOCK_FILE = path.join(MEMENTO_DIR, 'lock.json');

/**
 * Ensure ~/.memento directory exists
 */
async function ensureDir() {
  await fs.mkdir(MEMENTO_DIR, { recursive: true });
}

/**
 * Get current lock status
 * @returns {Promise<{locked: boolean, sessionId: string|null, lockedAt: string|null, itemsRemaining: number, resumeState: Object|null}>}
 */
async function getLockStatus() {
  try {
    const content = await fs.readFile(LOCK_FILE, 'utf-8');
    const lock = JSON.parse(content);
    return {
      locked: true,
      sessionId: lock.sessionId,
      lockedAt: lock.lockedAt,
      itemsRemaining: lock.itemsRemaining || 0,
      resumeState: lock.resumeState || null
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // No lock file = not locked
      return {
        locked: false,
        sessionId: null,
        lockedAt: null,
        itemsRemaining: 0,
        resumeState: null
      };
    }
    // Log but return unlocked state for other errors
    console.error('Error reading lock file:', error.message);
    return {
      locked: false,
      sessionId: null,
      lockedAt: null,
      itemsRemaining: 0,
      resumeState: null
    };
  }
}

/**
 * Acquire a session lock (blocks new captures)
 * @param {string} sessionId - The session ID to lock
 * @param {number} itemsRemaining - Number of items requiring resolution
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function acquireLock(sessionId, itemsRemaining = 0) {
  try {
    const currentLock = await getLockStatus();
    if (currentLock.locked) {
      return {
        success: false,
        message: `Already locked by session ${currentLock.sessionId}. Clear existing lock first.`
      };
    }

    await ensureDir();
    const lock = {
      sessionId,
      lockedAt: new Date().toISOString(),
      itemsRemaining
    };
    await fs.writeFile(LOCK_FILE, JSON.stringify(lock, null, 2));
    console.error(`Session lock acquired: ${sessionId}`);

    return {
      success: true,
      message: `Lock acquired for session ${sessionId}`
    };
  } catch (error) {
    console.error('Failed to acquire lock:', error.message);
    return {
      success: false,
      message: `Failed to acquire lock: ${error.message}`
    };
  }
}

/**
 * Clear a session lock
 * @param {string} sessionId - The session ID that should be locked (for verification)
 * @param {boolean} override - If true, clear regardless of session ID (HO emergency use)
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function clearLock(sessionId, override = false) {
  try {
    const currentLock = await getLockStatus();

    if (!currentLock.locked) {
      return {
        success: true,
        message: 'No active lock to clear'
      };
    }

    // Verify session ID matches (unless override)
    if (!override && currentLock.sessionId !== sessionId) {
      return {
        success: false,
        message: `Session ID mismatch. Locked session: ${currentLock.sessionId}, requested: ${sessionId}. Use override=true for emergency clear.`
      };
    }

    // Remove lock file
    await fs.unlink(LOCK_FILE);
    console.error(`Session lock cleared: ${currentLock.sessionId}${override ? ' (override)' : ''}`);

    return {
      success: true,
      message: `Lock cleared for session ${currentLock.sessionId}${override ? ' (override)' : ''}`
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: true,
        message: 'No lock file to remove'
      };
    }
    console.error('Failed to clear lock:', error.message);
    return {
      success: false,
      message: `Failed to clear lock: ${error.message}`
    };
  }
}

/**
 * Update items remaining count (for launchpad progress)
 * @param {number} itemsRemaining - Updated count
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateItemsRemaining(itemsRemaining) {
  try {
    const currentLock = await getLockStatus();
    if (!currentLock.locked) {
      return {
        success: false,
        message: 'No active lock to update'
      };
    }

    const lock = {
      sessionId: currentLock.sessionId,
      lockedAt: currentLock.lockedAt,
      itemsRemaining
    };
    await fs.writeFile(LOCK_FILE, JSON.stringify(lock, null, 2));

    return {
      success: true,
      message: `Updated items remaining to ${itemsRemaining}`
    };
  } catch (error) {
    console.error('Failed to update lock:', error.message);
    return {
      success: false,
      message: `Failed to update lock: ${error.message}`
    };
  }
}

/**
 * Update resume state for task resumption cues
 * @param {Object} resumeState - Resume state object
 * @param {string} [resumeState.goal] - What the user is trying to accomplish
 * @param {string} [resumeState.lastActivity] - ISO timestamp of last activity
 * @param {string} [resumeState.focusCategory] - Category user was working on
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateResumeState(resumeState) {
  try {
    const currentLock = await getLockStatus();
    if (!currentLock.locked) {
      return {
        success: false,
        message: 'No active lock to update'
      };
    }

    const lock = {
      sessionId: currentLock.sessionId,
      lockedAt: currentLock.lockedAt,
      itemsRemaining: currentLock.itemsRemaining,
      resumeState: {
        ...currentLock.resumeState,
        ...resumeState,
        lastActivity: new Date().toISOString()
      }
    };
    await fs.writeFile(LOCK_FILE, JSON.stringify(lock, null, 2));

    return {
      success: true,
      message: 'Resume state updated'
    };
  } catch (error) {
    console.error('Failed to update resume state:', error.message);
    return {
      success: false,
      message: `Failed to update resume state: ${error.message}`
    };
  }
}

module.exports = {
  getLockStatus,
  acquireLock,
  clearLock,
  updateItemsRemaining,
  updateResumeState,
  MEMENTO_DIR,
  LOCK_FILE
};
