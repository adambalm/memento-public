/**
 * Theme Detection Module
 *
 * Clusters recurring tabs into thematic threads rather than showing
 * flat per-tab proposals. Uses domain co-occurrence, title keyword
 * extraction, and Basic Memory enrichment.
 *
 * The user explicitly rejected shallow tab-level proposals ("no duh, I know
 * I visit arxiv"). This module surfaces higher-level patterns like
 * "PREY / Null Provenance research" or "AI Healthcare evaluation".
 *
 * ===== API =====
 *
 * getThemeProposals(options) → { themes: Theme[], meta }
 *
 * Theme shape:
 * {
 *   themeId: string,          // hash of sorted constituent URLs
 *   label: string,            // e.g. "PREY / Null Provenance"
 *   description: string,      // "Tabs exploring authorship, Borges, Dickinson..."
 *   tabs: TabEntry[],         // constituent tabs with recurrence data
 *   signalScore: number,      // aggregate score
 *   memoryConnections: [],    // matched Basic Memory research interests
 *   candidateIntent: string,  // theme-level hypothesis
 *   status: 'active'|'dismissed'|'confirmed'
 * }
 */

const crypto = require('crypto');
const aggregator = require('./aggregator');
const intentDetection = require('./intentDetection');
const { getDomainRules, applyDomainFilter } = require('./domainRules');
const { getResearchInterests, matchThemeToInterests } = require('./basicMemoryBridge');

// --- Stop words for keyword extraction ---

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'its', 'this', 'that', 'was',
  'are', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did',
  'not', 'no', 'nor', 'as', 'if', 'how', 'what', 'when', 'where', 'which',
  'who', 'will', 'can', 'may', 'just', 'about', 'into', 'than', 'then',
  'also', 'more', 'some', 'such', 'only', 'other', 'new', 'your', 'our',
  'all', 'any', 'each', 'much', 'most', 'very', 'over', 'out', 'get',
  // Web-specific noise
  'page', 'home', 'www', 'com', 'org', 'net', 'http', 'https', 'html',
  'google', 'docs', 'edit', 'tab', 'view', 'blog', 'post', 'article',
  'medium', 'reddit', 'linkedin', 'github', 'wikipedia', 'youtube',
  'untitled', 'document', 'null', 'undefined',
  // Tech-generic terms that don't distinguish themes
  'use', 'using', 'used', 'api', 'app', 'apps', 'cloud', 'data',
  'help', 'guide', 'tutorial', 'introduction', 'overview', 'getting',
  'started', 'create', 'build', 'make', 'update', 'learn', 'free',
  'best', 'top', 'list', 'part', 'step', 'way', 'work', 'works',
  'tool', 'tools', 'service', 'services', 'platform', 'system',
]);

// --- Helpers ---

function generateThemeId(urls) {
  const sorted = [...urls].sort();
  return crypto.createHash('md5').update(sorted.join('|')).digest('hex').slice(0, 12);
}

/**
 * Extract meaningful keywords from a tab title.
 * Filters stop words and very short tokens.
 */
function extractTitleKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .map(w => w.replace(/-/g, ''));
}

/**
 * Extract a domain label from URL (for display)
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Build per-tab recurrence data from all sessions
 */
function buildTabRecurrence(tabs) {
  const urlMap = new Map();

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('blob:') || tab.url.startsWith('chrome')) continue;

    if (!urlMap.has(tab.url)) {
      urlMap.set(tab.url, {
        url: tab.url,
        title: tab.title,
        domain: extractDomain(tab.url),
        sessions: new Set(),
        days: new Set(),
        categories: new Set(),
        keywords: extractTitleKeywords(tab.title),
        firstSeen: tab.sessionTimestamp,
        lastSeen: tab.sessionTimestamp
      });
    }

    const entry = urlMap.get(tab.url);
    entry.sessions.add(tab.sessionId);
    if (tab.category) entry.categories.add(tab.category);

    try {
      entry.days.add(tab.sessionTimestamp.split('T')[0]);
    } catch {}

    if (tab.sessionTimestamp < entry.firstSeen) entry.firstSeen = tab.sessionTimestamp;
    if (tab.sessionTimestamp > entry.lastSeen) entry.lastSeen = tab.sessionTimestamp;
  }

  return urlMap;
}

/**
 * Build co-occurrence matrix: for each pair of URLs, how many sessions contain both?
 */
function buildCoOccurrence(tabs) {
  // Index: sessionId → Set<url>
  const sessionIndex = new Map();
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('blob:')) continue;
    if (!sessionIndex.has(tab.sessionId)) {
      sessionIndex.set(tab.sessionId, new Set());
    }
    sessionIndex.get(tab.sessionId).add(tab.url);
  }

  // Count co-occurrences
  const coMap = new Map(); // "url1|url2" → count
  for (const urls of sessionIndex.values()) {
    const urlArr = Array.from(urls);
    for (let i = 0; i < urlArr.length; i++) {
      for (let j = i + 1; j < urlArr.length; j++) {
        const key = [urlArr[i], urlArr[j]].sort().join('|');
        coMap.set(key, (coMap.get(key) || 0) + 1);
      }
    }
  }

  return { coMap, sessionIndex };
}

/**
 * Build keyword → URL index for clustering
 */
function buildKeywordIndex(tabRecurrence) {
  const kwIndex = new Map(); // keyword → Set<url>

  for (const [url, data] of tabRecurrence) {
    for (const kw of data.keywords) {
      if (!kwIndex.has(kw)) {
        kwIndex.set(kw, new Set());
      }
      kwIndex.get(kw).add(url);
    }
  }

  return kwIndex;
}

/**
 * Core clustering: group tabs into themes using keyword overlap + co-occurrence.
 *
 * Algorithm:
 * 1. Build keyword → URL index
 * 2. Find keyword groups where 2+ tabs share a non-generic keyword
 * 3. Score each keyword by specificity (fewer URLs = more specific)
 * 4. Greedily build clusters starting from most specific keywords
 * 5. Merge clusters with high co-occurrence overlap
 */
function clusterTabs(tabRecurrence, coMap, minClusterSize = 2) {
  const kwIndex = buildKeywordIndex(tabRecurrence);

  // Score keywords by specificity: shared by 2+ but not too many tabs
  const keywordScores = [];
  for (const [kw, urls] of kwIndex) {
    if (urls.size >= minClusterSize && urls.size <= 20) {
      // Specificity: smaller groups of related tabs score higher
      const specificity = 1 / Math.log2(urls.size + 1);
      keywordScores.push({ keyword: kw, urls: Array.from(urls), specificity });
    }
  }

  // Sort by specificity (most specific first)
  keywordScores.sort((a, b) => b.specificity - a.specificity);

  // Greedy clustering
  const assigned = new Set(); // URLs already in a cluster
  const clusters = [];

  for (const { keyword, urls } of keywordScores) {
    // Find unassigned URLs from this keyword group
    const available = urls.filter(u => !assigned.has(u));
    if (available.length < minClusterSize) continue;

    // Check co-occurrence: do these tabs actually appear together?
    let coScore = 0;
    let coPairs = 0;
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const key = [available[i], available[j]].sort().join('|');
        const count = coMap.get(key) || 0;
        if (count > 0) {
          coScore += count;
          coPairs++;
        }
      }
    }

    // Require at least some co-occurrence for the cluster to be meaningful
    // But be lenient — even 1 shared session between some pairs is fine
    const totalPairs = (available.length * (available.length - 1)) / 2;
    const coRatio = totalPairs > 0 ? coPairs / totalPairs : 0;

    // Accept cluster if: decent co-occurrence OR very specific keyword
    if (coRatio >= 0.1 || available.length <= 3) {
      // Look for additional related tabs via co-occurrence
      const expanded = new Set(available);
      for (const url of available) {
        for (const [coUrl, data] of tabRecurrence) {
          if (expanded.has(coUrl) || assigned.has(coUrl)) continue;
          // Check if this tab co-occurs frequently with cluster members
          let sharedSessions = 0;
          for (const clusterUrl of available) {
            const key = [coUrl, clusterUrl].sort().join('|');
            sharedSessions += coMap.get(key) || 0;
          }
          // Also check keyword overlap
          const sharedKeywords = data.keywords.filter(kw => {
            const kwUrls = kwIndex.get(kw);
            return kwUrls && available.some(u => kwUrls.has(u));
          });
          if (sharedSessions >= 2 && sharedKeywords.length >= 1) {
            expanded.add(coUrl);
          }
        }
      }

      const clusterUrls = Array.from(expanded);
      clusterUrls.forEach(u => assigned.add(u));

      // Collect all keywords for this cluster
      const clusterKeywords = new Map(); // keyword → count
      for (const url of clusterUrls) {
        const data = tabRecurrence.get(url);
        if (!data) continue;
        for (const kw of data.keywords) {
          clusterKeywords.set(kw, (clusterKeywords.get(kw) || 0) + 1);
        }
      }

      clusters.push({
        seedKeyword: keyword,
        urls: clusterUrls,
        keywords: clusterKeywords,
        coScore
      });
    }
  }

  return clusters;
}

/**
 * Generate a human-readable label for a theme cluster.
 * Uses the most distinctive shared keywords.
 */
function generateThemeLabel(cluster, tabRecurrence) {
  const { keywords, urls } = cluster;

  // Sort keywords by frequency in this cluster (descending), then filter generic ones
  const ranked = Array.from(keywords.entries())
    .filter(([kw, count]) => count >= Math.max(2, urls.length * 0.3))
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    // Fallback: use most common domain
    const domains = urls.map(u => tabRecurrence.get(u)?.domain).filter(Boolean);
    const domainCounts = {};
    domains.forEach(d => { domainCounts[d] = (domainCounts[d] || 0) + 1; });
    const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0];
    return topDomain ? `${topDomain[0]} cluster` : 'Unnamed theme';
  }

  // Take top 2-3 keywords, capitalize
  const labelWords = ranked.slice(0, 3).map(([kw]) =>
    kw.charAt(0).toUpperCase() + kw.slice(1)
  );

  return labelWords.join(' / ');
}

/**
 * Generate a description for a theme.
 */
function generateThemeDescription(cluster, tabRecurrence) {
  const titles = cluster.urls
    .map(u => tabRecurrence.get(u)?.title)
    .filter(Boolean)
    .slice(0, 5);

  if (titles.length === 0) return '';

  const titleList = titles.length <= 3
    ? titles.join(', ')
    : titles.slice(0, 3).join(', ') + ` and ${titles.length - 3} more`;

  const days = new Set();
  for (const url of cluster.urls) {
    const data = tabRecurrence.get(url);
    if (data) data.days.forEach(d => days.add(d));
  }

  return `${cluster.urls.length} tabs across ${days.size} days including: ${titleList}`;
}

/**
 * Generate a theme-level candidate intent using richer templates.
 */
function generateThemeIntent(theme, memoryConnections) {
  const tabCount = theme.tabs.length;
  const days = new Set();
  theme.tabs.forEach(t => {
    if (t.days) t.days.forEach(d => days.add(d));
  });
  const dayCount = days.size;

  // If we have Basic Memory connections, use them
  if (memoryConnections && memoryConnections.length > 0) {
    const bmName = memoryConnections[0].name;
    return `These ${tabCount} tabs suggest ongoing research into ${theme.label} — connected to your "${bmName}" notes`;
  }

  // Use activity patterns for richer templates
  if (dayCount > 5) {
    return `This cluster of ${tabCount} tabs across ${dayCount} days looks like sustained ${theme.label.toLowerCase()} activity — what's the goal?`;
  }

  if (tabCount > 5) {
    return `${tabCount} tabs converging on ${theme.label.toLowerCase()} — this looks like an active investigation`;
  }

  return `These tabs suggest a thread around ${theme.label.toLowerCase()} — is this an active pursuit?`;
}

/**
 * Compute aggregate signal score for a theme.
 */
function computeThemeScore(cluster, tabRecurrence) {
  let totalRecurrence = 0;
  let totalDays = 0;
  const allCategories = new Set();

  for (const url of cluster.urls) {
    const data = tabRecurrence.get(url);
    if (!data) continue;
    totalRecurrence += data.sessions.size;
    totalDays += data.days.size;
    data.categories.forEach(c => allCategories.add(c));
  }

  // Theme score factors:
  // - More tabs in cluster = stronger signal
  // - Higher recurrence across tabs = stronger
  // - Category spread across tabs = more interesting (cross-domain theme)
  // - Co-occurrence score from clustering
  const tabCountBonus = cluster.urls.length * 15;
  const recurrenceScore = totalRecurrence * 5;
  const dayScore = totalDays * 8;
  const categorySpread = allCategories.size * 10;
  const coBonus = cluster.coScore * 3;

  return tabCountBonus + recurrenceScore + dayScore + categorySpread + coBonus;
}

/**
 * Enrich user feedback to learn confirmed themes.
 * If users have corrected tab-level intents with thematic language,
 * those corrections can inform theme labels.
 */
function enrichFromFeedback(clusters, tabRecurrence, feedback) {
  if (!feedback || feedback.length === 0) return;

  // Build URL → correction map
  const corrections = new Map();
  for (const entry of feedback) {
    if (entry.action === 'correct' && entry.correctedIntent) {
      corrections.set(entry.url, entry.correctedIntent);
    }
  }

  // For each cluster, check if any tabs have corrections that reveal the true theme
  for (const cluster of clusters) {
    const clusterCorrections = [];
    for (const url of cluster.urls) {
      const correction = corrections.get(url);
      if (correction) {
        clusterCorrections.push(correction);
      }
    }

    if (clusterCorrections.length > 0) {
      cluster.userCorrections = clusterCorrections;
    }
  }
}

// --- Main API ---

/**
 * Get theme proposals: clustered, enriched, scored.
 *
 * @param {Object} options
 * @param {number} options.minClusterSize - Min tabs per theme (default: 2)
 * @param {number} options.limit - Max themes to return (default: 10)
 * @returns {{ themes: Theme[], meta: Object }}
 */
async function getThemeProposals(options = {}) {
  const { minClusterSize = 2, limit = 10 } = options;

  // 1. Load all data in parallel
  const [sessions, feedback, researchInterests] = await Promise.all([
    aggregator.getAllSessions(),
    intentDetection.loadFeedback(),
    getResearchInterests()
  ]);

  const allTabs = await aggregator.extractAllTabs(sessions);

  // 2. Apply domain rules to filter noise
  const domainRules = await getDomainRules(feedback);
  const filteredTabs = applyDomainFilter(allTabs, domainRules);

  // 3. Build recurrence data and co-occurrence matrix
  const tabRecurrence = buildTabRecurrence(filteredTabs);
  const { coMap } = buildCoOccurrence(filteredTabs);

  // 4. Cluster tabs into themes
  const clusters = clusterTabs(tabRecurrence, coMap, minClusterSize);

  // 5. Enrich clusters from existing user feedback
  enrichFromFeedback(clusters, tabRecurrence, feedback);

  // 6. Build theme objects
  const themes = [];

  for (const cluster of clusters) {
    const urls = cluster.urls;
    const tabs = urls.map(url => {
      const data = tabRecurrence.get(url);
      if (!data) return null;
      return {
        url,
        title: data.title,
        domain: data.domain,
        recurrenceCount: data.sessions.size,
        distinctDays: data.days.size,
        days: Array.from(data.days),
        categories: Array.from(data.categories),
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
        domainSignal: filteredTabs.find(t => t.url === url)?.domainSignal || null
      };
    }).filter(Boolean);

    if (tabs.length < minClusterSize) continue;

    const label = generateThemeLabel(cluster, tabRecurrence);
    const description = generateThemeDescription(cluster, tabRecurrence);
    const signalScore = computeThemeScore(cluster, tabRecurrence);
    const themeId = generateThemeId(urls);

    // Match against Basic Memory research interests
    const themeForMatching = { tabs, label };
    const memoryConnections = matchThemeToInterests(themeForMatching, researchInterests);

    const candidateIntent = generateThemeIntent(
      { label, tabs, description },
      memoryConnections
    );

    themes.push({
      themeId,
      label,
      description,
      tabs,
      signalScore,
      memoryConnections,
      candidateIntent,
      status: 'active',
      // Include user corrections if any tabs in this theme were corrected
      userCorrections: cluster.userCorrections || []
    });
  }

  // Sort by signal score descending
  themes.sort((a, b) => b.signalScore - a.signalScore);

  // Load theme feedback to mark status
  const themeFeedback = await loadThemeFeedback();
  for (const theme of themes) {
    const fb = themeFeedback[theme.themeId];
    if (fb) {
      // Map action → status
      const statusMap = {
        'dismiss': 'dismissed',
        'archive': 'archived',
        'confirm': 'confirmed',
        'save': 'saved',
        'keep-watching': 'keep-watching',
        'rename': theme.status // rename doesn't change status
      };
      theme.status = statusMap[fb.action] || 'active';

      // If renamed, use the new label
      if (fb.action === 'rename' && fb.correctedIntent) {
        theme.label = fb.correctedIntent;
      }
    }
  }

  // Filter out dismissed and archived themes for the default view
  const activeThemes = themes.filter(t => t.status !== 'dismissed' && t.status !== 'archived');

  return {
    themes: activeThemes.slice(0, limit),
    allThemes: themes,
    meta: {
      sessionsAnalyzed: sessions.length,
      tabsAnalyzed: allTabs.length,
      tabsAfterFilter: filteredTabs.length,
      feedbackCount: feedback.length,
      themesFound: themes.length,
      activeThemes: activeThemes.length,
      domainRulesApplied: Object.keys(domainRules).length,
      researchInterestsLoaded: researchInterests.length,
      themeFeedback
    }
  };
}

// --- Theme feedback storage ---

const fs = require('fs').promises;
const path = require('path');
const INTENTIONS_FILE = path.join(__dirname, '..', 'memory', 'intentions.json');

async function loadThemeFeedback() {
  try {
    const data = await fs.readFile(INTENTIONS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.themeFeedback || {};
  } catch {
    return {};
  }
}

module.exports = {
  getThemeProposals,
  extractTitleKeywords,
  buildTabRecurrence,
  buildCoOccurrence,
  clusterTabs,
  loadThemeFeedback
};
