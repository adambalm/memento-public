/**
 * Longitudinal Query Module
 *
 * Implements cross-dimensional queries on the Attention Data Cube.
 * Uses aggregator.js for data loading.
 *
 * Priority Queries:
 * 1. Recurring Unfinished - Topic × Time × Disposition
 * 2. Project Health - Project × Time × Disposition
 * 3. Distraction Signature - Topic × Mode × Time
 *
 * @see ../docs/plans/clever-snacking-boole.md for design context
 */

const aggregator = require('./aggregator');

/**
 * Query 1: Recurring Unfinished
 *
 * Find tabs that appear in 2+ sessions but never get completed.
 * Dimensions: Topic × Time × Disposition
 *
 * @param {Object} options
 * @param {number} options.minOccurrences - Minimum appearances (default: 2)
 * @param {string} options.timeRange - ISO date range 'start/end' or 'all' (default: 'all')
 * @returns {Promise<Array>} Recurring unfinished tabs
 */
async function getRecurringUnfinished(options = {}) {
  const { minOccurrences = 2, timeRange = 'all' } = options;

  // Get sessions (filtered by time range if specified)
  let sessions;
  if (timeRange === 'all') {
    sessions = await aggregator.getAllSessions();
  } else {
    const [start, end] = timeRange.split('/');
    sessions = await aggregator.getSessionsInRange(start, end);
  }

  // Group by URL
  const urlMap = new Map();
  const tabs = await aggregator.extractAllTabs(sessions);

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('blob:')) continue;

    if (!urlMap.has(tab.url)) {
      urlMap.set(tab.url, {
        url: tab.url,
        title: tab.title,
        occurrences: [],
        dispositions: new Set(),
        categories: new Set()
      });
    }

    const entry = urlMap.get(tab.url);
    entry.occurrences.push({
      sessionId: tab.sessionId,
      timestamp: tab.sessionTimestamp,
      category: tab.category
    });

    if (tab.disposition) {
      entry.dispositions.add(tab.disposition);
    }
    if (tab.category) {
      entry.categories.add(tab.category);
    }
  }

  // Filter: 2+ occurrences AND no 'complete' disposition
  const recurring = [];

  for (const [url, data] of urlMap) {
    if (data.occurrences.length < minOccurrences) continue;
    if (data.dispositions.has('complete')) continue;

    // Sort occurrences by time
    data.occurrences.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Calculate gap pattern
    const gaps = [];
    for (let i = 1; i < data.occurrences.length; i++) {
      const prev = new Date(data.occurrences[i - 1].timestamp);
      const curr = new Date(data.occurrences[i].timestamp);
      gaps.push(Math.round((curr - prev) / (1000 * 60 * 60 * 24))); // days
    }

    const avgGap = gaps.length > 0
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : null;

    recurring.push({
      url: data.url,
      title: data.title,
      timesSeen: data.occurrences.length,
      firstSeen: data.occurrences[0].timestamp,
      lastSeen: data.occurrences[data.occurrences.length - 1].timestamp,
      lastSessionId: data.occurrences[data.occurrences.length - 1].sessionId,
      categories: Array.from(data.categories),
      lastDisposition: data.dispositions.size > 0
        ? Array.from(data.dispositions).pop()
        : null,
      gapPattern: {
        avgDaysBetween: avgGap,
        gaps: gaps
      }
    });
  }

  // Sort by times seen descending
  return recurring.sort((a, b) => b.timesSeen - a.timesSeen);
}

/**
 * Query 2: Project Health
 *
 * Get health status of all tracked projects.
 * Dimensions: Project × Time × Disposition
 *
 * @param {Object} options
 * @param {boolean} options.includeAbandoned - Include projects >30 days inactive (default: true)
 * @returns {Promise<Array>} Project health reports
 */
async function getProjectHealth(options = {}) {
  const { includeAbandoned = true } = options;

  const projectMap = await aggregator.groupByProject();
  const sessions = await aggregator.getAllSessions();

  const now = new Date();
  const reports = [];

  for (const [name, project] of projectMap) {
    const daysSinceActive = Math.round(
      (now - new Date(project.lastSeen)) / (1000 * 60 * 60 * 24)
    );

    // Determine status
    let status;
    if (daysSinceActive <= 3) {
      status = 'active';
    } else if (daysSinceActive <= 14) {
      status = 'cooling';
    } else if (daysSinceActive <= 30) {
      status = 'neglected';
    } else {
      status = 'abandoned';
    }

    // Skip abandoned if not requested
    if (status === 'abandoned' && !includeAbandoned) continue;

    // Calculate disposition breakdown for this project's tabs
    // This requires loading full session data - simplified for now
    const dispositionBreakdown = {
      complete: 0,
      trash: 0,
      promote: 0,
      defer: 0,
      pending: project.totalTabs // Assume all pending if no disposition data
    };

    reports.push({
      project: name,
      status,
      daysSinceActive,
      lastActive: project.lastSeen,
      firstSeen: project.firstSeen,
      totalSessions: project.sessions.length,
      totalTabs: project.totalTabs,
      dispositionBreakdown
    });
  }

  // Sort by days since active ascending (most active first)
  return reports.sort((a, b) => a.daysSinceActive - b.daysSinceActive);
}

/**
 * Query 3: Distraction Signature
 *
 * Identify distraction patterns across sessions.
 * Dimensions: Topic × Mode × Time
 *
 * @param {Object} options
 * @param {string} options.timeRange - ISO date range 'start/end' or 'all' (default: 'all')
 * @param {string} options.modeFilter - Filter to specific mode (default: null = all)
 * @returns {Promise<Object>} Distraction profile
 */
async function getDistractionSignature(options = {}) {
  const { timeRange = 'all', modeFilter = null } = options;

  // Distraction categories
  const distractionCategories = new Set([
    'Entertainment',
    'Entertainment & Media',
    'Entertainment & Learning',
    'Social Media',
    'Social Media & Communication',
    'Social Media & Entertainment',
    'Social Media and Networking',
    'Shopping',
    'News',
    'News & Information',
    'News & Technology',
    'News & Updates',
    'News and Updates'
  ]);

  // Get sessions
  let sessions;
  if (timeRange === 'all') {
    sessions = await aggregator.getAllSessions();
  } else {
    const [start, end] = timeRange.split('/');
    sessions = await aggregator.getSessionsInRange(start, end);
  }

  // Filter by mode if specified
  if (modeFilter) {
    sessions = sessions.filter(s =>
      s.thematicAnalysis?.sessionPattern?.type === modeFilter
    );
  }

  // Extract distraction tabs
  const tabs = await aggregator.extractAllTabs(sessions);
  const distractionTabs = tabs.filter(t =>
    distractionCategories.has(t.category)
  );

  // Aggregate by domain
  const domainStats = new Map();
  for (const tab of distractionTabs) {
    try {
      const domain = new URL(tab.url).hostname;

      if (!domainStats.has(domain)) {
        domainStats.set(domain, {
          domain,
          count: 0,
          categories: new Set(),
          hourDistribution: new Array(24).fill(0),
          dayDistribution: new Array(7).fill(0), // 0=Sun, 6=Sat
          modeDistribution: {}
        });
      }

      const stats = domainStats.get(domain);
      stats.count++;
      stats.categories.add(tab.category);

      // Time distribution
      const timestamp = new Date(tab.sessionTimestamp);
      stats.hourDistribution[timestamp.getHours()]++;
      stats.dayDistribution[timestamp.getDay()]++;

      // Mode distribution
      const mode = tab.sessionMode || 'unknown';
      stats.modeDistribution[mode] = (stats.modeDistribution[mode] || 0) + 1;

    } catch (err) {
      // Skip invalid URLs
    }
  }

  // Find peak times
  const topDomains = Array.from(domainStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(d => ({
      domain: d.domain,
      count: d.count,
      categories: Array.from(d.categories),
      peakHour: d.hourDistribution.indexOf(Math.max(...d.hourDistribution)),
      peakDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
        d.dayDistribution.indexOf(Math.max(...d.dayDistribution))
      ],
      modeBreakdown: d.modeDistribution
    }));

  // Overall time vulnerability
  const overallHours = new Array(24).fill(0);
  const overallDays = new Array(7).fill(0);

  for (const stats of domainStats.values()) {
    for (let i = 0; i < 24; i++) overallHours[i] += stats.hourDistribution[i];
    for (let i = 0; i < 7; i++) overallDays[i] += stats.dayDistribution[i];
  }

  const peakVulnerabilityHour = overallHours.indexOf(Math.max(...overallHours));
  const peakVulnerabilityDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    overallDays.indexOf(Math.max(...overallDays))
  ];

  return {
    totalDistractionTabs: distractionTabs.length,
    totalSessionsAnalyzed: sessions.length,
    topDistractionDomains: topDomains,
    timeVulnerability: {
      peakHour: peakVulnerabilityHour,
      peakHourLabel: `${peakVulnerabilityHour}:00 - ${peakVulnerabilityHour + 1}:00`,
      peakDay: peakVulnerabilityDay,
      hourDistribution: overallHours,
      dayDistribution: {
        Sun: overallDays[0],
        Mon: overallDays[1],
        Tue: overallDays[2],
        Wed: overallDays[3],
        Thu: overallDays[4],
        Fri: overallDays[5],
        Sat: overallDays[6]
      }
    },
    modeFilter: modeFilter || 'all',
    timeRange: timeRange
  };
}

module.exports = {
  getRecurringUnfinished,
  getProjectHealth,
  getDistractionSignature
};
