/**
 * Session Aggregator Module
 *
 * Loads and indexes all Memento sessions for longitudinal analysis.
 * Part of the Attention Data Cube implementation.
 *
 * @see ../docs/plans/clever-snacking-boole.md for design context
 */

const fs = require('fs').promises;
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory', 'sessions');

/**
 * Load all sessions from disk
 * @returns {Promise<Array<Object>>} Array of full session objects with id added
 */
async function getAllSessions() {
  try {
    const files = await fs.readdir(MEMORY_DIR);
    const sessions = [];

    for (const file of files.filter(f => f.endsWith('.json') && !f.includes('schema'))) {
      try {
        const filepath = path.join(MEMORY_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const session = JSON.parse(content);
        session._id = file.replace('.json', '');
        session._filename = file;
        sessions.push(session);
      } catch (err) {
        // Skip malformed files
        console.warn(`Skipping malformed session: ${file}`);
      }
    }

    // Sort by timestamp descending
    return sessions.sort((a, b) =>
      (b.timestamp || '').localeCompare(a.timestamp || '')
    );
  } catch (error) {
    console.error('Failed to load sessions:', error.message);
    return [];
  }
}

/**
 * Get sessions within a time range
 * @param {string|Date} start - Start date (inclusive)
 * @param {string|Date} end - End date (inclusive)
 * @returns {Promise<Array<Object>>} Filtered sessions
 */
async function getSessionsInRange(start, end) {
  const sessions = await getAllSessions();
  const startDate = new Date(start);
  const endDate = new Date(end);

  return sessions.filter(s => {
    if (!s.timestamp) return false;
    const sessionDate = new Date(s.timestamp);
    return sessionDate >= startDate && sessionDate <= endDate;
  });
}

/**
 * Extract all tabs from all sessions, flattened
 * @param {Array<Object>} sessions - Sessions to extract from (or all if not provided)
 * @returns {Promise<Array<Object>>} All tabs with session context
 */
async function extractAllTabs(sessions = null) {
  if (!sessions) {
    sessions = await getAllSessions();
  }

  const tabs = [];

  for (const session of sessions) {
    if (!session.groups) continue;

    // Handle both object and array group formats
    const groups = Array.isArray(session.groups)
      ? session.groups
      : Object.entries(session.groups);

    for (const entry of groups) {
      const [category, items] = Array.isArray(entry)
        ? entry
        : [entry.name, entry.items];

      if (!Array.isArray(items)) continue;

      for (const tab of items) {
        tabs.push({
          url: tab.url,
          title: tab.title,
          category,
          sessionId: session._id,
          sessionTimestamp: session.timestamp,
          sessionMode: session.thematicAnalysis?.sessionPattern?.type || null,
          // Find disposition for this tab if any
          disposition: findDisposition(session, tab)
        });
      }
    }
  }

  return tabs;
}

/**
 * Find disposition for a specific tab in a session
 */
function findDisposition(session, tab) {
  if (!session.dispositions || !Array.isArray(session.dispositions)) {
    return null;
  }

  // Dispositions reference items by various identifiers
  const disposition = session.dispositions.find(d =>
    d.itemId === tab.tabIndex ||
    d.url === tab.url ||
    d.title === tab.title
  );

  return disposition ? disposition.action : null;
}

/**
 * Group tabs by URL across all sessions (exact match)
 * @returns {Promise<Map<string, Array<Object>>>} URL -> array of occurrences
 */
async function groupByUrl() {
  const tabs = await extractAllTabs();
  const urlMap = new Map();

  for (const tab of tabs) {
    if (!tab.url) continue;

    // Skip blob URLs (Memento's own output pages)
    if (tab.url.startsWith('blob:')) continue;

    if (!urlMap.has(tab.url)) {
      urlMap.set(tab.url, []);
    }
    urlMap.get(tab.url).push(tab);
  }

  return urlMap;
}

/**
 * Group tabs by domain
 * @returns {Promise<Map<string, Array<Object>>>} Domain -> array of tabs
 */
async function groupByDomain() {
  const tabs = await extractAllTabs();
  const domainMap = new Map();

  for (const tab of tabs) {
    if (!tab.url) continue;

    try {
      const url = new URL(tab.url);
      const domain = url.hostname;

      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain).push(tab);
    } catch (err) {
      // Skip invalid URLs
    }
  }

  return domainMap;
}

/**
 * Group tabs by category across all sessions
 * @returns {Promise<Map<string, Array<Object>>>} Category -> array of tabs
 */
async function groupByCategory() {
  const tabs = await extractAllTabs();
  const categoryMap = new Map();

  for (const tab of tabs) {
    const category = tab.category || 'Unknown';

    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push(tab);
  }

  return categoryMap;
}

/**
 * Extract projects from thematicAnalysis across all sessions
 * @returns {Promise<Map<string, Object>>} Project name -> aggregated info
 */
async function groupByProject() {
  const sessions = await getAllSessions();
  const projectMap = new Map();

  for (const session of sessions) {
    const projectSupport = session.thematicAnalysis?.projectSupport;
    if (!projectSupport) continue;

    // projectSupport is an object: { projectName: { explicit: [], implicit: [] } }
    for (const [projectName, support] of Object.entries(projectSupport)) {
      if (!projectMap.has(projectName)) {
        projectMap.set(projectName, {
          name: projectName,
          sessions: [],
          totalTabs: 0,
          firstSeen: session.timestamp,
          lastSeen: session.timestamp
        });
      }

      const project = projectMap.get(projectName);
      project.sessions.push(session._id);
      project.totalTabs += (support.explicit?.length || 0) + (support.implicit?.length || 0);

      // Update first/last seen
      if (session.timestamp < project.firstSeen) {
        project.firstSeen = session.timestamp;
      }
      if (session.timestamp > project.lastSeen) {
        project.lastSeen = session.timestamp;
      }
    }
  }

  return projectMap;
}

/**
 * Get session statistics
 * @returns {Promise<Object>} Aggregate statistics
 */
async function getStats() {
  const sessions = await getAllSessions();
  const tabs = await extractAllTabs(sessions);

  const categories = new Set();
  const domains = new Set();

  for (const tab of tabs) {
    if (tab.category) categories.add(tab.category);
    try {
      const domain = new URL(tab.url).hostname;
      domains.add(domain);
    } catch (err) {}
  }

  // Disposition counts
  const dispositionCounts = {};
  for (const tab of tabs) {
    if (tab.disposition) {
      dispositionCounts[tab.disposition] = (dispositionCounts[tab.disposition] || 0) + 1;
    }
  }

  return {
    totalSessions: sessions.length,
    totalTabs: tabs.length,
    uniqueUrls: new Set(tabs.map(t => t.url)).size,
    uniqueDomains: domains.size,
    uniqueCategories: categories.size,
    categories: Array.from(categories).sort(),
    dateRange: {
      earliest: sessions[sessions.length - 1]?.timestamp || null,
      latest: sessions[0]?.timestamp || null
    },
    dispositions: dispositionCounts
  };
}

module.exports = {
  getAllSessions,
  getSessionsInRange,
  extractAllTabs,
  groupByUrl,
  groupByDomain,
  groupByCategory,
  groupByProject,
  getStats
};
