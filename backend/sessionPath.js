const path = require('path');

/**
 * Resolve a session file path safely under a base directory.
 * Prevents directory traversal and malformed session IDs.
 *
 * @param {string} baseDir
 * @param {string} sessionId
 * @returns {string}
 */
function resolveSessionPath(baseDir, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('Invalid session ID: must be a non-empty string');
  }

  if (/[/\\]/.test(sessionId) || sessionId.includes('..')) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  if (!/^[A-Za-z0-9._-]+$/.test(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  const filename = `${sessionId}.json`;
  const resolved = path.resolve(baseDir, filename);
  const resolvedBase = path.resolve(baseDir);

  if (!resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  return resolved;
}

module.exports = {
  resolveSessionPath
};
