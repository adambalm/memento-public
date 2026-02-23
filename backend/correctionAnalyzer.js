/**
 * Correction Analyzer Module
 *
 * Extracts learning signals from user disposition corrections to improve
 * future classification. Analyzes regroup actions to identify domains
 * that need better content extraction.
 *
 * Part of the learnable domain extractor system.
 */

const fs = require('fs').promises;
const path = require('path');
const { getAllSessions } = require('./aggregator');

const EXTRACTORS_PATH = path.join(__dirname, 'extractors.json');

// Default extractors for known problematic domains
const DEFAULT_EXTRACTORS = {
  domains: {
    'arxiv.org': {
      selectors: ['meta[name="citation_abstract"]', 'meta[name="citation_title"]', 'meta[name="citation_author"]'],
      expectedCategory: 'Academic',
      notes: 'Academic preprints - use citation metadata'
    },
    'scholar.google.com': {
      selectors: ['.gs_rs', '.gs_rt'],
      expectedCategory: 'Academic',
      notes: 'Google Scholar search results'
    },
    'github.com': {
      selectors: ['meta[name="description"]', '.f4.my-3', '.repository-content'],
      expectedCategory: null, // Can be many things
      notes: 'Repositories - check for README content'
    },
    'medium.com': {
      selectors: ['meta[name="description"]', 'article h1', 'article section'],
      expectedCategory: null,
      notes: 'Articles - paywall may limit extraction'
    }
  },
  version: '1.0.0',
  lastUpdated: null
};

/**
 * Load extractors config from disk, or return defaults
 */
async function loadExtractors() {
  try {
    const content = await fs.readFile(EXTRACTORS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    // Return defaults if file doesn't exist
    return { ...DEFAULT_EXTRACTORS };
  }
}

/**
 * Save extractors config to disk
 */
async function saveExtractors(extractors) {
  extractors.lastUpdated = new Date().toISOString();
  await fs.writeFile(EXTRACTORS_PATH, JSON.stringify(extractors, null, 2));
  return extractors;
}

/**
 * Extract all correction events (regroup dispositions) from sessions
 * @param {Array<Object>} sessions - Optional sessions array (loads all if not provided)
 * @returns {Array<Object>} Array of correction events with context
 */
async function getCorrections(sessions = null) {
  if (!sessions) {
    sessions = await getAllSessions();
  }

  const corrections = [];

  for (const session of sessions) {
    if (!session.dispositions || !Array.isArray(session.dispositions)) continue;

    // Get regroup actions (AI said X, user moved to Y)
    const regroups = session.dispositions.filter(d => d.action === 'regroup');

    for (const regroup of regroups) {
      // Find the tab this disposition refers to
      const tab = findTabByItemId(session, regroup.itemId);

      if (!tab) continue;

      let domain = null;
      try {
        domain = new URL(tab.url).hostname;
      } catch (err) {}

      corrections.push({
        sessionId: session._id,
        sessionTimestamp: session.timestamp,
        url: tab.url,
        domain,
        title: tab.title,
        from: regroup.from,      // AI's classification
        to: regroup.to,          // User's correction
        at: regroup.at,          // When correction happened
        itemId: regroup.itemId
      });
    }
  }

  return corrections;
}

/**
 * Find a tab in session by itemId
 * itemId format varies: could be index, url, or title
 */
function findTabByItemId(session, itemId) {
  if (!session.groups) return null;

  // Handle both object and array group formats
  const groups = Array.isArray(session.groups)
    ? session.groups
    : Object.entries(session.groups);

  let tabIndex = 0;
  for (const entry of groups) {
    const [category, items] = Array.isArray(entry)
      ? entry
      : [entry.name, entry.items];

    if (!Array.isArray(items)) continue;

    for (const tab of items) {
      // Match by various identifiers
      if (tabIndex === itemId ||
          tab.url === itemId ||
          tab.title === itemId ||
          tab.tabIndex === itemId) {
        return { ...tab, originalCategory: category };
      }
      tabIndex++;
    }
  }

  return null;
}

/**
 * Aggregate corrections by domain
 * @returns {Map<string, Object>} Domain -> correction stats
 */
async function aggregateByDomain() {
  const corrections = await getCorrections();
  const domainStats = new Map();

  for (const correction of corrections) {
    if (!correction.domain) continue;

    if (!domainStats.has(correction.domain)) {
      domainStats.set(correction.domain, {
        domain: correction.domain,
        totalCorrections: 0,
        corrections: [],
        fromCategories: {},
        toCategories: {}
      });
    }

    const stats = domainStats.get(correction.domain);
    stats.totalCorrections++;
    stats.corrections.push(correction);

    // Track category transitions
    stats.fromCategories[correction.from] = (stats.fromCategories[correction.from] || 0) + 1;
    stats.toCategories[correction.to] = (stats.toCategories[correction.to] || 0) + 1;
  }

  return domainStats;
}

/**
 * Calculate correction rate for each domain
 * Requires knowing total tabs per domain (not just corrections)
 */
async function getCorrectionRates() {
  const { groupByDomain } = require('./aggregator');

  const domainTabs = await groupByDomain();
  const corrections = await getCorrections();

  const rates = [];

  // Group corrections by domain
  const correctionsByDomain = new Map();
  for (const c of corrections) {
    if (!c.domain) continue;
    if (!correctionsByDomain.has(c.domain)) {
      correctionsByDomain.set(c.domain, []);
    }
    correctionsByDomain.get(c.domain).push(c);
  }

  // Calculate rate for each domain
  for (const [domain, tabs] of domainTabs) {
    const domainCorrections = correctionsByDomain.get(domain) || [];
    const totalTabs = tabs.length;
    const correctionCount = domainCorrections.length;
    const correctionRate = totalTabs > 0 ? correctionCount / totalTabs : 0;

    // Only include domains with at least 2 tabs
    if (totalTabs >= 2) {
      rates.push({
        domain,
        totalTabs,
        correctionCount,
        correctionRate,
        corrections: domainCorrections,
        // What categories does AI typically assign?
        aiCategories: [...new Set(domainCorrections.map(c => c.from))],
        // What do users correct to?
        userCategories: [...new Set(domainCorrections.map(c => c.to))]
      });
    }
  }

  // Sort by correction rate descending
  return rates.sort((a, b) => b.correctionRate - a.correctionRate);
}

/**
 * Suggest domains that need better extractors based on correction patterns
 * @param {number} minCorrections - Minimum corrections to consider (default: 2)
 * @param {number} minRate - Minimum correction rate to flag (default: 0.3 = 30%)
 */
async function suggestExtractors(minCorrections = 2, minRate = 0.3) {
  const rates = await getCorrectionRates();
  const extractors = await loadExtractors();

  const suggestions = [];

  for (const rate of rates) {
    // Skip if already has custom extractor
    if (extractors.domains[rate.domain]) continue;

    // Flag if high correction rate
    if (rate.correctionCount >= minCorrections && rate.correctionRate >= minRate) {
      // Determine most common user correction
      const categoryVotes = {};
      for (const c of rate.corrections) {
        categoryVotes[c.to] = (categoryVotes[c.to] || 0) + 1;
      }
      const topCategory = Object.entries(categoryVotes)
        .sort((a, b) => b[1] - a[1])[0];

      suggestions.push({
        domain: rate.domain,
        priority: rate.correctionRate * rate.correctionCount, // Higher = more urgent
        stats: {
          totalTabs: rate.totalTabs,
          corrections: rate.correctionCount,
          rate: Math.round(rate.correctionRate * 100) + '%'
        },
        pattern: {
          aiTypicallyClassifiesAs: rate.aiCategories,
          usersCorrectedTo: rate.userCategories,
          suggestedCategory: topCategory ? topCategory[0] : null
        },
        recommendation: generateRecommendation(rate)
      });
    }
  }

  // Sort by priority descending
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate a human-readable recommendation for a problematic domain
 */
function generateRecommendation(rate) {
  const { domain, correctionCount, aiCategories, userCategories } = rate;

  if (userCategories.length === 1) {
    // Consistent correction pattern
    return `Domain "${domain}" is consistently recategorized from ${aiCategories.join('/')} to ${userCategories[0]}. Consider adding a domain rule or better content extraction.`;
  } else {
    // Multiple corrections
    return `Domain "${domain}" has ${correctionCount} corrections across multiple categories (${userCategories.join(', ')}). May need context-aware classification or user-defined rules.`;
  }
}

/**
 * Add a domain to the extractors config
 * @param {string} domain - Domain name
 * @param {Object} config - Extractor configuration
 */
async function addExtractor(domain, config) {
  const extractors = await loadExtractors();

  extractors.domains[domain] = {
    selectors: config.selectors || [],
    expectedCategory: config.expectedCategory || null,
    notes: config.notes || `Added from correction analysis`,
    addedAt: new Date().toISOString()
  };

  return saveExtractors(extractors);
}

/**
 * Get extractors for a specific domain (if any)
 */
async function getExtractorForDomain(domain) {
  const extractors = await loadExtractors();
  return extractors.domains[domain] || null;
}

/**
 * Get summary statistics about corrections
 */
async function getCorrectionStats() {
  const corrections = await getCorrections();
  const extractors = await loadExtractors();
  const suggestions = await suggestExtractors();

  // Aggregate by from->to transitions
  const transitions = {};
  for (const c of corrections) {
    const key = `${c.from} → ${c.to}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }

  // Sort transitions by frequency
  const sortedTransitions = Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    totalCorrections: corrections.length,
    uniqueDomainsCorrected: new Set(corrections.map(c => c.domain).filter(Boolean)).size,
    configuredExtractors: Object.keys(extractors.domains).length,
    suggestedExtractors: suggestions.length,
    topTransitions: sortedTransitions.map(([transition, count]) => ({
      transition,
      count
    })),
    topSuggestions: suggestions.slice(0, 5)
  };
}

// ============================================================
// PROMPT RULE GENERATION
// ============================================================

const LEARNED_RULES_PATH = path.join(__dirname, 'prompts', 'learned-rules.json');

/**
 * Load learned rules from disk
 * @returns {Object} { rules: Array, version: string }
 */
async function loadLearnedRules() {
  try {
    const content = await fs.readFile(LEARNED_RULES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    // Return empty if file doesn't exist
    return { rules: [], version: '1.0.0', lastUpdated: null };
  }
}

/**
 * Save learned rules to disk
 */
async function saveLearnedRules(rulesData) {
  rulesData.lastUpdated = new Date().toISOString();
  // Ensure prompts directory exists
  const promptsDir = path.dirname(LEARNED_RULES_PATH);
  await fs.mkdir(promptsDir, { recursive: true });
  await fs.writeFile(LEARNED_RULES_PATH, JSON.stringify(rulesData, null, 2));
  return rulesData;
}

/**
 * Generate natural language rule suggestions from correction patterns
 * Analyzes aggregated corrections and creates rules suitable for prompt injection
 *
 * @param {number} minCorrections - Minimum corrections to trigger rule suggestion (default: 2)
 * @returns {Array<Object>} Array of rule suggestions with source corrections
 */
async function generateRuleSuggestions(minCorrections = 2) {
  const domainStats = await aggregateByDomain();
  const existingRules = await loadLearnedRules();
  const existingDomains = new Set(existingRules.rules.map(r => r.domain));

  const suggestions = [];

  for (const [domain, stats] of domainStats) {
    // Skip if we already have a rule for this domain
    if (existingDomains.has(domain)) continue;

    // Skip if not enough corrections
    if (stats.totalCorrections < minCorrections) continue;

    // Analyze the correction pattern
    const fromCategories = Object.entries(stats.fromCategories)
      .sort((a, b) => b[1] - a[1]);
    const toCategories = Object.entries(stats.toCategories)
      .sort((a, b) => b[1] - a[1]);

    // Only suggest if there's a clear pattern (dominant correction target)
    if (toCategories.length === 0) continue;

    const topTo = toCategories[0];
    const topToCategory = topTo[0];
    const topToCount = topTo[1];

    // Require majority agreement on target category
    const agreementRatio = topToCount / stats.totalCorrections;
    if (agreementRatio < 0.6) continue; // Need 60%+ agreement

    // Build the rule text
    const fromList = fromCategories.map(([cat]) => cat).join(', ');
    let ruleText = `URLs from ${domain} should be classified as "${topToCategory}"`;

    // Add context about what it was being misclassified as
    if (fromCategories.length === 1) {
      ruleText += ` (not "${fromCategories[0][0]}")`;
    } else if (fromCategories.length > 1) {
      ruleText += ` (often misclassified as ${fromList})`;
    }

    // Add any path-based exceptions we can detect
    const exceptions = detectPathExceptions(stats.corrections);
    if (exceptions.length > 0) {
      ruleText += `. Exception: paths containing ${exceptions.join(' or ')} may be other categories.`;
    }

    suggestions.push({
      id: `rule-${domain}-${Date.now()}`,
      domain,
      rule: ruleText,
      approved: false,
      confidence: agreementRatio,
      stats: {
        totalCorrections: stats.totalCorrections,
        fromCategories: Object.fromEntries(fromCategories),
        toCategories: Object.fromEntries(toCategories),
        agreementRatio: Math.round(agreementRatio * 100) + '%'
      },
      sourceCorrections: stats.corrections.slice(0, 5).map(c => ({
        url: c.url,
        title: c.title,
        from: c.from,
        to: c.to,
        at: c.at
      })),
      createdAt: new Date().toISOString()
    });
  }

  // Sort by confidence * corrections (higher = more reliable)
  return suggestions.sort((a, b) =>
    (b.confidence * b.stats.totalCorrections) - (a.confidence * a.stats.totalCorrections)
  );
}

/**
 * Detect path patterns that might be exceptions to a domain rule
 * E.g., github.com is usually Development, but /sponsors/ might be Shopping
 */
function detectPathExceptions(corrections) {
  const pathPatterns = {};

  for (const c of corrections) {
    try {
      const url = new URL(c.url);
      const pathParts = url.pathname.split('/').filter(p => p.length > 2);

      // Track which path parts appear with which target categories
      for (const part of pathParts.slice(0, 3)) { // First 3 path segments
        if (!pathPatterns[part]) {
          pathPatterns[part] = { targets: {} };
        }
        pathPatterns[part].targets[c.to] = (pathPatterns[part].targets[c.to] || 0) + 1;
      }
    } catch (err) {}
  }

  // Find path parts that consistently go to a different category than the majority
  const exceptions = [];
  const majorityTo = corrections.reduce((acc, c) => {
    acc[c.to] = (acc[c.to] || 0) + 1;
    return acc;
  }, {});
  const topCategory = Object.entries(majorityTo).sort((a, b) => b[1] - a[1])[0]?.[0];

  for (const [pathPart, data] of Object.entries(pathPatterns)) {
    const targetCats = Object.entries(data.targets);
    if (targetCats.length > 0) {
      const topTargetForPath = targetCats.sort((a, b) => b[1] - a[1])[0];
      if (topTargetForPath[0] !== topCategory && topTargetForPath[1] >= 2) {
        exceptions.push(`/${pathPart}/`);
      }
    }
  }

  return exceptions.slice(0, 3); // Max 3 exceptions
}

/**
 * Get all rules (approved + pending suggestions)
 */
async function getAllRules() {
  const existingRules = await loadLearnedRules();
  const suggestions = await generateRuleSuggestions();

  return {
    approved: existingRules.rules.filter(r => r.approved),
    pending: suggestions,
    version: existingRules.version
  };
}

/**
 * Approve a rule suggestion (adds to learned rules)
 * @param {string} ruleId - The rule ID to approve
 * @param {Object} ruleData - The rule data (domain, rule text, etc.)
 */
async function approveRule(ruleId, ruleData) {
  const rulesData = await loadLearnedRules();

  // Check if already exists
  const existingIndex = rulesData.rules.findIndex(r => r.id === ruleId);

  const approvedRule = {
    ...ruleData,
    id: ruleId,
    approved: true,
    approvedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    rulesData.rules[existingIndex] = approvedRule;
  } else {
    rulesData.rules.push(approvedRule);
  }

  return saveLearnedRules(rulesData);
}

/**
 * Reject/remove a rule
 * @param {string} ruleId - The rule ID to reject
 */
async function rejectRule(ruleId) {
  const rulesData = await loadLearnedRules();

  // Add to rejected list (so we don't re-suggest it)
  if (!rulesData.rejected) rulesData.rejected = [];
  rulesData.rejected.push({
    id: ruleId,
    rejectedAt: new Date().toISOString()
  });

  // Remove from approved rules if present
  rulesData.rules = rulesData.rules.filter(r => r.id !== ruleId);

  return saveLearnedRules(rulesData);
}

/**
 * Get only approved rules (for prompt injection)
 * @returns {Array<Object>} Array of approved rules
 */
async function getApprovedRules() {
  const rulesData = await loadLearnedRules();
  return rulesData.rules.filter(r => r.approved);
}

/**
 * Increment application count for preferences that were used
 * @param {Array<string>} preferenceIds - IDs of preferences that were applied
 * @returns {Promise<Object>} Update result
 */
async function incrementPreferenceApplications(preferenceIds) {
  if (!preferenceIds || preferenceIds.length === 0) {
    return { success: true, updated: 0 };
  }

  const rulesData = await loadLearnedRules();
  let updated = 0;

  for (const prefId of preferenceIds) {
    const rule = rulesData.rules.find(r => r.id === prefId);
    if (rule && rule.approved) {
      rule.applicationCount = (rule.applicationCount || 0) + 1;
      rule.lastAppliedAt = new Date().toISOString();
      updated++;
    }
  }

  if (updated > 0) {
    await saveLearnedRules(rulesData);
    console.error(`[Preferences] Updated application count for ${updated} preference(s)`);
  }

  return { success: true, updated };
}

module.exports = {
  loadExtractors,
  saveExtractors,
  getCorrections,
  aggregateByDomain,
  getCorrectionRates,
  suggestExtractors,
  addExtractor,
  getExtractorForDomain,
  getCorrectionStats,
  DEFAULT_EXTRACTORS,
  // New rule generation exports
  loadLearnedRules,
  saveLearnedRules,
  generateRuleSuggestions,
  getAllRules,
  approveRule,
  rejectRule,
  getApprovedRules,
  incrementPreferenceApplications
};
