/**
 * Task Generator Module
 *
 * Mines behavioral data from longitudinal queries to generate candidate tasks.
 * Part of the Task-Driven Attention System.
 *
 * Task Types:
 * 1. Ghost Tab Resolution - "You've opened this 48 times. Finish it or let it go."
 * 2. Project Revival - "PREY hasn't been touched in 12 days."
 * 3. Tab Bankruptcy - "47 tabs have been open for 7+ days unread."
 *
 * @see ../docs/plans/task-driven-attention.md for design context
 */

const longitudinal = require('./longitudinal');
const aggregator = require('./aggregator');
const {
  getBlockedUrls,
  isDeferred,
  isProjectPaused,
  cleanExpiredDeferrals
} = require('./taskActions');

/**
 * Score a task for priority ranking
 *
 * @param {Object} task - Task candidate
 * @returns {number} Priority score (higher = more important)
 */
function scoreTask(task) {
  let score = 0;

  switch (task.type) {
    case 'ghost_tab':
      // Recurrence weight - more visits = higher priority
      score += (task.openCount || 0) * 10;
      // Staleness - longer since first seen = more open loop
      const daysSinceFirst = task.firstSeen
        ? Math.round((Date.now() - new Date(task.firstSeen).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      score += daysSinceFirst * 2;
      break;

    case 'project_revival':
      // Days neglected = priority
      score += (task.daysSinceActive || 0) * 5;
      // More tabs = more invested = higher priority
      score += (task.totalTabs || 0) * 2;
      break;

    case 'tab_bankruptcy':
      // Volume weight - more tabs = more cognitive load
      score += (task.affectedCount || 0) * 3;
      // Average staleness
      score += (task.avgDaysStale || 0) * 2;
      break;
  }

  return Math.round(score);
}

/**
 * Generate Ghost Tab tasks from recurring unfinished items
 *
 * A ghost tab is one that appears in 2+ sessions but never gets completed.
 * The user keeps returning to it but never finishes it.
 *
 * @param {Object} options
 * @param {number} options.minOccurrences - Minimum times seen (default: 3)
 * @param {number} options.limit - Max tasks to return (default: 5)
 * @returns {Promise<Array>} Ghost tab task candidates
 */
async function generateGhostTabTasks(options = {}) {
  const { minOccurrences = 3, limit = 5 } = options;

  // Clean up expired deferrals first
  await cleanExpiredDeferrals();

  const recurring = await longitudinal.getRecurringUnfinished({
    minOccurrences
  });

  // Get blocked URLs to filter out
  const blockedUrls = await getBlockedUrls();
  const blockedSet = new Set(blockedUrls);

  // Filter out blocked and deferred URLs
  const filteredRecurring = [];
  for (const item of recurring) {
    // Skip if URL is blocked (user released it)
    if (blockedSet.has(item.url)) {
      continue;
    }

    // Skip if deferred (user said "come back later")
    if (await isDeferred('ghost_tab', item.url)) {
      continue;
    }

    filteredRecurring.push(item);
  }

  // Transform into task format
  const tasks = filteredRecurring.slice(0, limit * 2).map(item => {
    // Extract domain for display
    let domain = '';
    try {
      domain = new URL(item.url).hostname;
    } catch (e) {}

    const task = {
      id: `ghost-tab-${Buffer.from(item.url).toString('base64').slice(0, 16)}`,
      type: 'ghost_tab',

      // Core data
      url: item.url,
      title: item.title,
      domain,
      openCount: item.timesSeen,
      firstSeen: item.firstSeen,
      lastSeen: item.lastSeen,
      sourceSessionId: item.lastSessionId,
      categories: item.categories,
      lastDisposition: item.lastDisposition,
      gapPattern: item.gapPattern,

      // Computed
      score: 0
    };

    task.score = scoreTask(task);
    return task;
  });

  // Sort by score descending and limit
  return tasks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Generate Project Revival tasks from neglected projects
 *
 * A neglected project is one that hasn't been touched in 7+ days
 * but has prior activity showing the user cares about it.
 *
 * @param {Object} options
 * @param {number} options.minDaysInactive - Days to consider neglected (default: 7)
 * @param {number} options.limit - Max tasks to return (default: 3)
 * @returns {Promise<Array>} Project revival task candidates
 */
async function generateProjectRevivalTasks(options = {}) {
  const { minDaysInactive = 7, limit = 3 } = options;

  const projectHealth = await longitudinal.getProjectHealth({
    includeAbandoned: false
  });

  // Filter to neglected/cooling projects
  const neglected = projectHealth.filter(p =>
    p.daysSinceActive >= minDaysInactive &&
    (p.status === 'neglected' || p.status === 'cooling')
  );

  // Filter out paused projects
  const filteredNeglected = [];
  for (const project of neglected) {
    if (await isProjectPaused(project.project)) {
      continue;
    }
    filteredNeglected.push(project);
  }

  const tasks = filteredNeglected.slice(0, limit * 2).map(project => {
    const task = {
      id: `project-revival-${project.project.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'project_revival',

      // Core data
      projectName: project.project,
      daysSinceActive: project.daysSinceActive,
      lastActive: project.lastActive,
      firstSeen: project.firstSeen,
      totalSessions: project.totalSessions,
      totalTabs: project.totalTabs,
      status: project.status,

      // Computed
      score: 0
    };

    task.score = scoreTask(task);
    return task;
  });

  return tasks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Generate Tab Bankruptcy task if there's significant tab debt
 *
 * Tab bankruptcy is when there are many tabs that have been open
 * across multiple sessions but never acted on.
 *
 * @param {Object} options
 * @param {number} options.minTabs - Minimum tabs to trigger bankruptcy (default: 20)
 * @param {number} options.minDaysStale - Days to consider stale (default: 7)
 * @returns {Promise<Object|null>} Tab bankruptcy task or null
 */
async function generateTabBankruptcyTask(options = {}) {
  const { minTabs = 20, minDaysStale = 7 } = options;

  const recurring = await longitudinal.getRecurringUnfinished({
    minOccurrences: 2
  });

  // Get blocked URLs to filter out
  const blockedUrls = await getBlockedUrls();
  const blockedSet = new Set(blockedUrls);

  const now = new Date();
  const staleTabs = recurring.filter(item => {
    // Skip blocked URLs
    if (blockedSet.has(item.url)) return false;
    if (!item.firstSeen) return false;
    const daysSinceFirst = Math.round(
      (now - new Date(item.firstSeen)) / (1000 * 60 * 60 * 24)
    );
    return daysSinceFirst >= minDaysStale;
  });

  if (staleTabs.length < minTabs) {
    return null;
  }

  // Calculate average staleness
  const totalDays = staleTabs.reduce((sum, item) => {
    const days = Math.round(
      (now - new Date(item.firstSeen)) / (1000 * 60 * 60 * 24)
    );
    return sum + days;
  }, 0);
  const avgDaysStale = Math.round(totalDays / staleTabs.length);

  const task = {
    id: `tab-bankruptcy-${Date.now()}`,
    type: 'tab_bankruptcy',

    // Core data
    affectedCount: staleTabs.length,
    avgDaysStale,
    oldestTab: staleTabs.reduce((oldest, item) =>
      !oldest || item.firstSeen < oldest.firstSeen ? item : oldest
    , null),
    staleTabs: staleTabs.slice(0, 10), // Sample for display

    // Computed
    score: 0
  };

  task.score = scoreTask(task);
  return task;
}

/**
 * Get all candidate tasks, sorted by score
 *
 * @param {Object} options
 * @param {number} options.limit - Max tasks to return (default: 5)
 * @returns {Promise<Array>} All candidate tasks sorted by score
 */
async function getAllCandidateTasks(options = {}) {
  const { limit = 5 } = options;

  // Generate all task types in parallel
  const [ghostTabs, projectRevivals, tabBankruptcy] = await Promise.all([
    generateGhostTabTasks({ limit: 3 }),
    generateProjectRevivalTasks({ limit: 2 }),
    generateTabBankruptcyTask()
  ]);

  // Combine all tasks
  const allTasks = [
    ...ghostTabs,
    ...projectRevivals,
    ...(tabBankruptcy ? [tabBankruptcy] : [])
  ];

  // Sort by score and limit
  return allTasks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get the top task - the ONE thing to focus on
 *
 * @returns {Promise<Object|null>} The highest-scored task, or null if no tasks
 */
async function getTopTask() {
  const tasks = await getAllCandidateTasks({ limit: 1 });
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Get aggregate stats about attention patterns
 *
 * @returns {Promise<Object>} Stats object
 */
async function getAttentionStats() {
  const stats = await aggregator.getStats();
  const recurring = await longitudinal.getRecurringUnfinished({ minOccurrences: 2 });
  const projectHealth = await longitudinal.getProjectHealth();

  const neglectedProjects = projectHealth.filter(p =>
    p.status === 'neglected' || p.status === 'abandoned'
  );

  return {
    totalSessions: stats.totalSessions,
    totalTabs: stats.totalTabs,
    uniqueUrls: stats.uniqueUrls,
    dateRange: stats.dateRange,
    ghostTabCount: recurring.length,
    topGhostTab: recurring[0] || null,
    neglectedProjectCount: neglectedProjects.length,
    dispositions: stats.dispositions
  };
}

module.exports = {
  generateGhostTabTasks,
  generateProjectRevivalTasks,
  generateTabBankruptcyTask,
  getAllCandidateTasks,
  getTopTask,
  getAttentionStats,
  scoreTask
};
