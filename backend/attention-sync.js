/**
 * Attention Sync Module
 *
 * Generates markdown content for basic-memory from longitudinal queries.
 * Output can be written to basic-memory via MCP tools.
 *
 * This module does NOT directly write to basic-memory - it generates
 * formatted content that the MCP tool can pass to basic-memory's write_note.
 *
 * @see ../docs/plans/clever-snacking-boole.md for design context
 */

const { getRecurringUnfinished, getProjectHealth, getDistractionSignature } = require('./longitudinal');
const aggregator = require('./aggregator');

/**
 * Generate a weekly summary note
 * @param {string} weekId - Week identifier (e.g., '2026-W02')
 * @returns {Promise<Object>} { title, folder, content }
 */
async function generateWeeklySummary(weekId = null) {
  // Default to current week
  if (!weekId) {
    const now = new Date();
    const weekNum = getWeekNumber(now);
    weekId = `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  }

  const stats = await aggregator.getStats();
  const recurring = await getRecurringUnfinished({ minOccurrences: 3 });
  const projects = await getProjectHealth();
  const distractions = await getDistractionSignature();

  const content = `# Attention Summary: ${weekId}

## Overview

- [Total Sessions] ${stats.totalSessions}
- [Total Tabs Captured] ${stats.totalTabs}
- [Unique URLs] ${stats.uniqueUrls}
- [Date Range] ${stats.dateRange.earliest?.split('T')[0] || 'N/A'} to ${stats.dateRange.latest?.split('T')[0] || 'N/A'}

---

## Recurring Unfinished (Top 10)

Tabs appearing 3+ times without completion:

${recurring.slice(0, 10).map((r, i) => `${i + 1}. **${truncate(r.title, 60)}**
   - URL: ${r.url}
   - Seen ${r.timesSeen} times (first: ${r.firstSeen?.split('T')[0]})
   - Categories: ${r.categories.slice(0, 3).join(', ')}`).join('\n\n')}

---

## Project Health

${projects.map(p => `- **${p.project}** - ${p.status} (${p.daysSinceActive} days since active)
  - Last active: ${p.lastActive?.split('T')[0]}
  - Sessions: ${p.totalSessions}`).join('\n')}

---

## Distraction Profile

- [Total Distraction Tabs] ${distractions.totalDistractionTabs}
- [Peak Vulnerability Hour] ${distractions.timeVulnerability.peakHourLabel}
- [Peak Vulnerability Day] ${distractions.timeVulnerability.peakDay}

### Top Distraction Domains

${distractions.topDistractionDomains.slice(0, 5).map((d, i) =>
  `${i + 1}. **${d.domain}** (${d.count} occurrences) - Peak: ${d.peakDay} ${d.peakHour}:00`
).join('\n')}

---

## Generated

- [Generated At] ${new Date().toISOString()}
- [Source] Memento Longitudinal Analysis
- [Week] ${weekId}
`;

  return {
    title: `Attention Summary ${weekId}`,
    folder: 'attention/weekly',
    content,
    tags: ['attention', 'weekly', 'memento']
  };
}

/**
 * Generate a project health report
 * @returns {Promise<Object>} { title, folder, content }
 */
async function generateProjectHealthReport() {
  const projects = await getProjectHealth({ includeAbandoned: true });
  const now = new Date();

  const byStatus = {
    active: projects.filter(p => p.status === 'active'),
    cooling: projects.filter(p => p.status === 'cooling'),
    neglected: projects.filter(p => p.status === 'neglected'),
    abandoned: projects.filter(p => p.status === 'abandoned')
  };

  const content = `# Project Health Report

## Generated

- [Generated At] ${now.toISOString()}
- [Total Projects] ${projects.length}

---

## Status Summary

| Status | Count | Description |
|--------|-------|-------------|
| Active | ${byStatus.active.length} | Activity within 3 days |
| Cooling | ${byStatus.cooling.length} | Activity within 14 days |
| Neglected | ${byStatus.neglected.length} | Activity within 30 days |
| Abandoned | ${byStatus.abandoned.length} | No activity for 30+ days |

---

## Active Projects (${byStatus.active.length})

${byStatus.active.length > 0 ? byStatus.active.map(p => `### ${p.project}
- Last active: ${p.lastActive?.split('T')[0]}
- Sessions: ${p.totalSessions}
- Total tabs: ${p.totalTabs}`).join('\n\n') : '*No active projects*'}

---

## Cooling Projects (${byStatus.cooling.length})

${byStatus.cooling.length > 0 ? byStatus.cooling.map(p => `- **${p.project}** - ${p.daysSinceActive} days since active`).join('\n') : '*None*'}

---

## Neglected Projects (${byStatus.neglected.length})

${byStatus.neglected.length > 0 ? byStatus.neglected.map(p => `- **${p.project}** - ${p.daysSinceActive} days since active (consider revival or archive)`).join('\n') : '*None*'}

---

## Abandoned Projects (${byStatus.abandoned.length})

${byStatus.abandoned.length > 0 ? byStatus.abandoned.map(p => `- **${p.project}** - ${p.daysSinceActive} days since active`).join('\n') : '*None*'}

---

## Recommendations

${byStatus.neglected.length > 0 ? `- Review neglected projects: ${byStatus.neglected.map(p => p.project).join(', ')}` : '- All projects are in good health'}
${byStatus.abandoned.length > 0 ? `- Consider archiving: ${byStatus.abandoned.map(p => p.project).join(', ')}` : ''}
`;

  return {
    title: 'Project Health Report',
    folder: 'attention/projects',
    content,
    tags: ['attention', 'projects', 'health', 'memento']
  };
}

/**
 * Generate recurring unfinished patterns note
 * @returns {Promise<Object>} { title, folder, content }
 */
async function generateRecurringUnfinished() {
  const recurring = await getRecurringUnfinished({ minOccurrences: 2 });
  const now = new Date();

  // Group by domain
  const byDomain = new Map();
  for (const r of recurring) {
    try {
      const domain = new URL(r.url).hostname;
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain).push(r);
    } catch (err) {}
  }

  const sortedDomains = Array.from(byDomain.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  const content = `# Recurring Unfinished Tabs

## Generated

- [Generated At] ${now.toISOString()}
- [Total Recurring] ${recurring.length}
- [Criteria] Appeared 2+ times, never completed

---

## Top Recurring by Domain

${sortedDomains.map(([domain, tabs]) => `### ${domain} (${tabs.length} recurring)

${tabs.slice(0, 5).map(t => `- **${truncate(t.title, 50)}**
  - Seen ${t.timesSeen} times
  - URL: ${t.url}`).join('\n\n')}`).join('\n\n---\n\n')}

---

## Most Persistent (Top 10 by Occurrences)

${recurring.slice(0, 10).map((r, i) => `${i + 1}. **${truncate(r.title, 60)}** (${r.timesSeen}x)
   - First: ${r.firstSeen?.split('T')[0]} | Last: ${r.lastSeen?.split('T')[0]}
   - Avg gap: ${r.gapPattern.avgDaysBetween || 0} days`).join('\n\n')}

---

## Action Items

Consider for each recurring item:
1. **Complete it** - If still relevant, finish and mark done
2. **Consciously abandon** - If no longer relevant, trash it
3. **Promote to notes** - If it's reference material, extract value

`;

  return {
    title: 'Recurring Unfinished',
    folder: 'attention/patterns',
    content,
    tags: ['attention', 'patterns', 'recurring', 'memento']
  };
}

/**
 * Generate distraction signature note
 * @returns {Promise<Object>} { title, folder, content }
 */
async function generateDistractionSignature() {
  const sig = await getDistractionSignature();
  const now = new Date();

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayDist = sig.timeVulnerability.dayDistribution;

  const content = `# Distraction Signature

## Generated

- [Generated At] ${now.toISOString()}
- [Sessions Analyzed] ${sig.totalSessionsAnalyzed}
- [Distraction Tabs Found] ${sig.totalDistractionTabs}

---

## Time Vulnerability

### Peak Hours

- [Most Vulnerable Hour] ${sig.timeVulnerability.peakHourLabel}
- [Most Vulnerable Day] ${sig.timeVulnerability.peakDay}

### Day Distribution

| Day | Distraction Count |
|-----|------------------|
${dayNames.map(d => `| ${d} | ${dayDist[d]} |`).join('\n')}

---

## Top Distraction Domains

${sig.topDistractionDomains.map((d, i) => `### ${i + 1}. ${d.domain}

- [Occurrences] ${d.count}
- [Categories] ${d.categories.join(', ')}
- [Peak Time] ${d.peakDay} at ${d.peakHour}:00
- [Mode Breakdown] ${Object.entries(d.modeBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}`).join('\n\n')}

---

## Recommendations

1. **Block peak hours** - Consider website blockers during ${sig.timeVulnerability.peakHourLabel}
2. **${sig.timeVulnerability.peakDay} awareness** - Your most vulnerable day
3. **Top targets** - ${sig.topDistractionDomains.slice(0, 3).map(d => d.domain).join(', ')}

`;

  return {
    title: 'Distraction Signature',
    folder: 'attention/patterns',
    content,
    tags: ['attention', 'patterns', 'distractions', 'memento']
  };
}

// Helper functions

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len - 3) + '...' : str;
}

module.exports = {
  generateWeeklySummary,
  generateProjectHealthReport,
  generateRecurringUnfinished,
  generateDistractionSignature
};
