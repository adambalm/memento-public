/**
 * Domain Rules Module
 *
 * Extracts domain-level signal rules from user corrections in intentions.json.
 * Domains can be classified as "noise" (never interesting), "always-interesting",
 * or "contextual" (interesting depending on content).
 *
 * Rules are bootstrapped from existing feedback patterns and can be
 * explicitly set by the user via the UI.
 *
 * Storage: memory/domain-rules.json
 * Source: memory/intentions.json (read-only, for bootstrapping)
 */

const fs = require('fs').promises;
const path = require('path');

const RULES_FILE = path.join(__dirname, '..', 'memory', 'domain-rules.json');

/**
 * Extract hostname from URL, stripping www. prefix
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Load saved domain rules from disk
 */
async function loadRulesFile() {
  try {
    const data = await fs.readFile(RULES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return { rules: {}, bootstrapped: false };
    throw err;
  }
}

/**
 * Save domain rules to disk
 */
async function saveRulesFile(data) {
  await fs.writeFile(RULES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Bootstrap domain rules from existing correction feedback.
 *
 * Patterns detected:
 * - Dismissed tabs → domain is likely "noise"
 * - Multiple dismissals from same domain → strong noise signal
 * - User explicitly says "not a signal" → noise
 * - User says "always interesting" → always-interesting
 */
async function bootstrapFromFeedback(feedback) {
  const domainSignals = {};

  for (const entry of feedback) {
    const domain = extractDomain(entry.url);
    if (!domain) continue;

    if (!domainSignals[domain]) {
      domainSignals[domain] = { dismissCount: 0, correctCount: 0, confirmCount: 0, corrections: [] };
    }

    const sig = domainSignals[domain];

    if (entry.action === 'dismiss') {
      sig.dismissCount++;
    } else if (entry.action === 'correct') {
      sig.correctCount++;
      sig.corrections.push(entry.correctedIntent || '');
    } else if (entry.action === 'confirm') {
      sig.confirmCount++;
    }
  }

  const rules = {};

  for (const [domain, sig] of Object.entries(domainSignals)) {
    // Check corrections for explicit noise indicators
    const correctionText = sig.corrections.join(' ').toLowerCase();
    const isExplicitNoise = correctionText.includes('not a signal') ||
                            correctionText.includes('no deep signal') ||
                            correctionText.includes('carries no');
    const isExplicitInteresting = correctionText.includes('always') &&
                                  (correctionText.includes('interesting') || correctionText.includes('important'));

    if (isExplicitNoise || (sig.dismissCount >= 2 && sig.correctCount === 0 && sig.confirmCount === 0)) {
      rules[domain] = {
        signal: 'noise',
        reason: isExplicitNoise ? 'User stated not a signal' : `Dismissed ${sig.dismissCount} times`,
        source: 'bootstrapped',
        at: new Date().toISOString()
      };
    } else if (isExplicitInteresting) {
      rules[domain] = {
        signal: 'always-interesting',
        reason: 'User indicated always interesting',
        source: 'bootstrapped',
        at: new Date().toISOString()
      };
    }
  }

  return rules;
}

/**
 * Get all domain rules. Bootstraps from feedback if not yet done.
 * @param {Array} feedback - Optional feedback array (avoids re-reading)
 */
async function getDomainRules(feedback) {
  const stored = await loadRulesFile();

  // Bootstrap on first call if we have feedback
  if (!stored.bootstrapped && feedback && feedback.length > 0) {
    const bootstrapped = await bootstrapFromFeedback(feedback);
    // Merge: explicit user rules override bootstrapped
    for (const [domain, rule] of Object.entries(bootstrapped)) {
      if (!stored.rules[domain]) {
        stored.rules[domain] = rule;
      }
    }
    stored.bootstrapped = true;
    await saveRulesFile(stored);
  }

  return stored.rules;
}

/**
 * Add or update a domain rule
 * @param {string} domain - Domain name (e.g. "mail.google.com")
 * @param {string} signal - "noise" | "always-interesting" | "contextual"
 * @param {string} reason - Why this rule exists
 */
async function addDomainRule(domain, signal, reason) {
  const stored = await loadRulesFile();
  stored.rules[domain] = {
    signal,
    reason: reason || '',
    source: 'user',
    at: new Date().toISOString()
  };
  await saveRulesFile(stored);
  return stored.rules[domain];
}

/**
 * Remove a domain rule
 */
async function removeDomainRule(domain) {
  const stored = await loadRulesFile();
  delete stored.rules[domain];
  await saveRulesFile(stored);
}

/**
 * Apply domain filter to a list of tabs.
 * Returns tabs with noise domains removed and interesting domains boosted.
 * Each tab gets a `domainSignal` field: 'noise' | 'always-interesting' | 'contextual' | null
 *
 * @param {Array} tabs - Tabs with url field
 * @param {Object} rules - Domain rules map
 * @returns {Array} Filtered tabs with domainSignal added
 */
function applyDomainFilter(tabs, rules) {
  return tabs
    .map(tab => {
      const domain = extractDomain(tab.url);
      const rule = domain ? rules[domain] : null;
      return {
        ...tab,
        domain,
        domainSignal: rule?.signal || null
      };
    })
    .filter(tab => tab.domainSignal !== 'noise');
}

module.exports = {
  getDomainRules,
  addDomainRule,
  removeDomainRule,
  applyDomainFilter,
  extractDomain,
  bootstrapFromFeedback
};
