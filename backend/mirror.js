/**
 * Mirror Module
 *
 * Generates single, confrontational insights from longitudinal data.
 * "Don't show data. Provoke reflection."
 *
 * @see ../docs/plans/clever-snacking-boole.md for design context
 */

const { getRecurringUnfinished, getProjectHealth, getDistractionSignature } = require('./longitudinal');

/**
 * Get the single most impactful "mirror" insight
 * Rotates through insight types for variety
 *
 * @returns {Promise<Object|null>} Mirror insight object
 */
async function getMirrorInsight() {
  const insights = [];

  // Insight Type 1: Ghost Tabs (recurring unfinished)
  try {
    const recurring = await getRecurringUnfinished({ minOccurrences: 3 });
    if (recurring.length > 0) {
      const ghost = recurring[0]; // Most seen
      insights.push({
        type: 'ghost_tab',
        severity: ghost.timesSeen >= 10 ? 'high' : ghost.timesSeen >= 5 ? 'medium' : 'low',
        headline: `This keeps coming back.`,
        subhead: `${ghost.timesSeen} visits. Still unresolved.`,
        detail: truncate(ghost.title, 80),
        url: ghost.url,
        meta: {
          firstSeen: ghost.firstSeen,
          lastSeen: ghost.lastSeen,
          avgGap: ghost.gapPattern?.avgDaysBetween
        },
        actions: [
          { label: 'Finish It', action: 'complete', icon: '✓' },
          { label: 'Let Go', action: 'trash', icon: '×' }
        ]
      });
    }
  } catch (err) {
    console.error('Mirror: ghost tabs failed:', err.message);
  }

  // Insight Type 2: Abandoned Projects
  try {
    const projects = await getProjectHealth({ includeAbandoned: true });
    const neglected = projects.filter(p => p.status === 'neglected' || p.status === 'abandoned');
    if (neglected.length > 0) {
      const abandoned = neglected[0];
      insights.push({
        type: 'abandoned_project',
        severity: abandoned.daysSinceActive >= 30 ? 'high' : 'medium',
        headline: `${abandoned.project}`,
        subhead: `${abandoned.daysSinceActive} days quiet. Ready to pick it back up?`,
        detail: `Last active: ${abandoned.lastActive?.split('T')[0]}`,
        meta: {
          lastActive: abandoned.lastActive,
          totalSessions: abandoned.totalSessions,
          totalTabs: abandoned.totalTabs
        },
        actions: [
          { label: 'Revive', action: 'revive', icon: '↻' },
          { label: 'Archive', action: 'archive', icon: '📦' }
        ]
      });
    }
  } catch (err) {
    console.error('Mirror: project health failed:', err.message);
  }

  // Insight Type 3: Distraction Pattern
  try {
    const distraction = await getDistractionSignature();
    if (distraction.totalDistractionTabs >= 10 && distraction.topDistractionDomains.length > 0) {
      const topDomain = distraction.topDistractionDomains[0];
      const peakTime = distraction.timeVulnerability;

      insights.push({
        type: 'distraction_pattern',
        severity: distraction.totalDistractionTabs >= 50 ? 'high' : 'medium',
        headline: `${peakTime.peakDay}. ${peakTime.peakHour}:00. ${topDomain.domain}.`,
        subhead: `Every week.`,
        detail: `${distraction.totalDistractionTabs} distraction tabs across ${distraction.totalSessionsAnalyzed} sessions`,
        meta: {
          peakHour: peakTime.peakHour,
          peakDay: peakTime.peakDay,
          topDomain: topDomain.domain,
          count: distraction.totalDistractionTabs
        },
        actions: [
          { label: 'Block It', action: 'block', icon: '🚫' },
          { label: 'Accept It', action: 'accept', icon: '🤷' }
        ]
      });
    }
  } catch (err) {
    console.error('Mirror: distraction signature failed:', err.message);
  }

  // Return highest severity insight, or null if none
  if (insights.length === 0) return null;

  // Sort by severity: high > medium > low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  return insights[0];
}

/**
 * Get all available insights (for a deep dive view)
 * @returns {Promise<Array>} All insights sorted by severity
 */
async function getAllInsights() {
  const insights = [];

  try {
    // Ghost tabs
    const recurring = await getRecurringUnfinished({ minOccurrences: 2 });
    for (const ghost of recurring.slice(0, 10)) {
      insights.push({
        type: 'ghost_tab',
        severity: ghost.timesSeen >= 10 ? 'high' : ghost.timesSeen >= 5 ? 'medium' : 'low',
        headline: `Opened ${ghost.timesSeen} times, never finished`,
        detail: truncate(ghost.title, 60),
        url: ghost.url,
        meta: { timesSeen: ghost.timesSeen, firstSeen: ghost.firstSeen }
      });
    }
  } catch (err) {}

  try {
    // Abandoned projects
    const projects = await getProjectHealth({ includeAbandoned: true });
    for (const p of projects.filter(x => x.status !== 'active')) {
      insights.push({
        type: 'abandoned_project',
        severity: p.status === 'abandoned' ? 'high' : p.status === 'neglected' ? 'medium' : 'low',
        headline: `${p.project} - ${p.status}`,
        detail: `${p.daysSinceActive} days since active`,
        meta: { project: p.project, status: p.status, daysSinceActive: p.daysSinceActive }
      });
    }
  } catch (err) {}

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));
}

// Helper
function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len - 3) + '...' : str;
}

module.exports = {
  getMirrorInsight,
  getAllInsights
};
