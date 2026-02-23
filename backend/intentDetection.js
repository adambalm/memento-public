/**
 * Intent Detection Module
 *
 * Analyzes longitudinal browsing data to detect unresolved intentions
 * and solicits user feedback (confirm/correct/dismiss) to build an
 * eval dataset over time.
 *
 * @see Basic Memory: projects/memento/memento-intent-detection-ui-reorganization-spec
 *
 * ===== API CONTRACT =====
 *
 * GET /api/intentions
 *   Returns top high-signal tabs with candidate intents.
 *   Response: {
 *     proposals: IntentProposal[],
 *     meta: { sessionsAnalyzed: number, tabsAnalyzed: number, feedbackCount: number }
 *   }
 *
 * POST /api/intentions/:tabHash/feedback
 *   Records user feedback on a proposed intent.
 *   Body: { action: 'confirm' | 'correct' | 'dismiss', correctedIntent?: string }
 *   Response: { ok: true, feedback: IntentFeedback }
 *
 * GET /api/intentions/resolved
 *   Returns all intents that have received feedback.
 *   Response: {
 *     confirmed: IntentFeedback[],
 *     corrected: IntentFeedback[],
 *     dismissed: IntentFeedback[]
 *   }
 *
 * GET /api/intentions/stats
 *   Returns running accuracy metrics.
 *   Response: IntentStats
 *
 * GET /intentions
 *   Page route — renders the intentions HTML page via intentionsRenderer.js
 *
 * ===== DATA SHAPES =====
 *
 * IntentProposal: {
 *   tabHash: string,           // MD5 of URL (stable identifier)
 *   url: string,
 *   title: string,
 *   recurrenceCount: number,   // Total sessions this URL appeared in
 *   distinctDays: number,      // Number of distinct calendar days
 *   firstSeen: string,         // ISO timestamp
 *   lastSeen: string,          // ISO timestamp
 *   sessionIds: string[],      // Which sessions contain this URL
 *   coOccurring: [{            // Top 5 tabs that frequently co-occur
 *     url: string,
 *     title: string,
 *     coCount: number,         // How many shared sessions
 *     category: string         // Most frequent category for this tab
 *   }],
 *   categories: string[],      // All categories this tab was classified as
 *   candidateIntent: string,   // Plain-language hypothesis: "You may want to..."
 *   alternativeIntents: string[], // 1-2 alternatives if ambiguous
 *   signalScore: number        // Composite score for ranking (higher = stronger signal)
 * }
 *
 * IntentFeedback: {
 *   tabHash: string,
 *   url: string,
 *   title: string,
 *   candidateIntent: string,   // What the system proposed
 *   action: 'confirm' | 'correct' | 'dismiss',
 *   correctedIntent: string | null, // User's actual intent (only for 'correct')
 *   at: string                 // ISO timestamp
 * }
 *
 * IntentStats: {
 *   total: number,
 *   confirmed: number,
 *   corrected: number,
 *   dismissed: number,
 *   accuracy: number           // confirmed / (confirmed + corrected + dismissed)
 * }
 *
 * ===== STORAGE =====
 *
 * Feedback is stored append-only in: memory/intentions.json
 * Format: { feedback: IntentFeedback[] }
 *
 * Intent proposals are computed on-demand from session data (not cached).
 *
 * ===== SIGNAL COMPUTATION =====
 *
 * signalScore = (recurrenceCount * 10) + (distinctDays * 15) + (categorySpread * 20)
 *   where categorySpread = number of distinct categories (instability = worth asking about)
 *
 * Thresholds (starting heuristics, refine based on feedback):
 *   - minOccurrences: 3 (appear in 3+ sessions)
 *   - minDistinctDays: 2 (appear across 2+ calendar days)
 *   - Exclude: tabs with existing feedback, tabs dispositioned as 'complete'
 *
 * candidateIntent generation (template-based, v1):
 *   - Extract the dominant co-occurring category
 *   - Template: "You may want to [verb] [domain context] — this keeps appearing
 *     alongside your [category] tabs"
 *   - Verb selection: Research→"deep-dive into", Development→"integrate",
 *     Financial→"review", Academic→"study"
 *
 * ===== IMPLEMENTATION =====
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const aggregator = require('./aggregator');

const INTENTIONS_FILE = path.join(__dirname, '..', 'memory', 'intentions.json');

// --- Helpers ---

function tabHash(url) {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

async function loadFeedback() {
  try {
    const data = await fs.readFile(INTENTIONS_FILE, 'utf8');
    return JSON.parse(data).feedback || [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function loadFullFile() {
  try {
    const data = await fs.readFile(INTENTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function saveFullFile(data) {
  await fs.writeFile(INTENTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function saveFeedback(entry) {
  const data = await loadFullFile();
  if (!data.feedback) data.feedback = [];
  data.feedback.push(entry);
  await saveFullFile(data);
  return entry;
}

/**
 * Save theme-level feedback.
 * Stored under `themeFeedback` key in intentions.json, keyed by themeId.
 *
 * @param {string} themeId - Theme identifier
 * @param {string} action - 'confirm' | 'correct' | 'dismiss'
 * @param {string|null} correctedIntent - User's correction text (for 'correct')
 */
async function saveThemeFeedback(themeId, action, correctedIntent) {
  const validActions = ['confirm', 'correct', 'dismiss', 'save', 'archive', 'keep-watching', 'rename'];
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
  }

  const data = await loadFullFile();
  if (!data.themeFeedback) data.themeFeedback = {};

  data.themeFeedback[themeId] = {
    action,
    correctedIntent: (action === 'correct' || action === 'rename') ? correctedIntent : null,
    at: new Date().toISOString()
  };

  await saveFullFile(data);
  return data.themeFeedback[themeId];
}

// --- Intent verb templates by category ---

const CATEGORY_VERBS = {
  'Research': 'deep-dive into',
  'Development': 'integrate or apply',
  'Development & Tools': 'integrate or apply',
  'Financial': 'review or act on',
  'Financial (Protected)': 'review or act on',
  'Academic': 'study',
  'Academic (Synthesis)': 'synthesize notes on',
  'Entertainment': 'make time for',
  'Shopping': 'decide on purchasing',
  'Communication': 'follow up on',
  'Social Media': 'engage with',
  'News': 'process or respond to',
  'Reference': 'reference while working on',
  'AI & Machine Learning': 'experiment with',
  'AI Tools': 'experiment with',
  'Cloud & Infrastructure': 'set up or configure',
};

function verbForCategory(category) {
  if (!category) return 'follow up on';
  for (const [key, verb] of Object.entries(CATEGORY_VERBS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return verb;
  }
  return 'follow up on';
}

function generateCandidateIntent(tab, coOccurring) {
  const domain = (() => {
    try { return new URL(tab.url).hostname.replace('www.', ''); }
    catch { return 'this page'; }
  })();

  // Find the dominant co-occurring category (what context is this tab appearing in?)
  const coCategoryCounts = {};
  for (const co of coOccurring) {
    if (co.category) {
      coCategoryCounts[co.category] = (coCategoryCounts[co.category] || 0) + co.coCount;
    }
  }
  const dominantCoCategory = Object.entries(coCategoryCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const verb = verbForCategory(dominantCoCategory || tab.categories[0]);
  const context = dominantCoCategory
    ? `alongside your ${dominantCoCategory} tabs`
    : `across multiple sessions`;

  return `You may want to ${verb} ${domain} — it keeps appearing ${context}`;
}

function generateAlternativeIntents(tab, coOccurring) {
  const alts = [];
  const categories = tab.categories || [];

  if (categories.length > 1) {
    alts.push(`This might be a reference resource you return to for ${categories[0]} work`);
  }
  if (tab.recurrenceCount > 10) {
    alts.push(`This could be a pinned/habitual tab rather than an unresolved intention`);
  }
  return alts.slice(0, 2);
}

// --- Core: Compute intent proposals ---

async function getIntentProposals(options = {}) {
  const { minOccurrences = 3, minDistinctDays = 2, limit = 10 } = options;

  const sessions = await aggregator.getAllSessions();
  const tabs = await aggregator.extractAllTabs(sessions);
  const feedback = await loadFeedback();
  const feedbackHashes = new Set(feedback.map(f => f.tabHash));

  // Group by URL
  const urlMap = new Map();

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('blob:') || tab.url.startsWith('chrome')) continue;

    const hash = tabHash(tab.url);
    if (feedbackHashes.has(hash)) continue; // Already has feedback

    if (!urlMap.has(tab.url)) {
      urlMap.set(tab.url, {
        url: tab.url,
        title: tab.title,
        hash,
        sessions: new Map(), // sessionId -> { timestamp, category }
        categories: new Set(),
        dispositions: new Set(),
        days: new Set()
      });
    }

    const entry = urlMap.get(tab.url);
    entry.sessions.set(tab.sessionId, {
      timestamp: tab.sessionTimestamp,
      category: tab.category
    });
    if (tab.category) entry.categories.add(tab.category);
    if (tab.disposition) entry.dispositions.add(tab.disposition);

    // Track distinct calendar days
    try {
      const day = tab.sessionTimestamp.split('T')[0];
      entry.days.add(day);
    } catch {}
  }

  // Build co-occurrence index (which tabs appear together in sessions)
  const sessionTabIndex = new Map(); // sessionId -> Set<url>
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('blob:')) continue;
    if (!sessionTabIndex.has(tab.sessionId)) {
      sessionTabIndex.set(tab.sessionId, new Set());
    }
    sessionTabIndex.get(tab.sessionId).add(tab.url);
  }

  // Filter and score
  const proposals = [];

  for (const [url, data] of urlMap) {
    if (data.sessions.size < minOccurrences) continue;
    if (data.days.size < minDistinctDays) continue;
    if (data.dispositions.has('complete')) continue;

    const sessionIds = Array.from(data.sessions.keys());
    const timestamps = Array.from(data.sessions.values()).map(s => s.timestamp).sort();
    const categories = Array.from(data.categories);

    // Compute co-occurring tabs
    const coMap = new Map();
    for (const sid of sessionIds) {
      const sessionTabs = sessionTabIndex.get(sid);
      if (!sessionTabs) continue;
      for (const coUrl of sessionTabs) {
        if (coUrl === url) continue;
        if (!coMap.has(coUrl)) {
          // Find title and category for this co-occurring tab
          const coTab = tabs.find(t => t.url === coUrl && t.sessionId === sid);
          coMap.set(coUrl, {
            url: coUrl,
            title: coTab?.title || coUrl,
            coCount: 0,
            category: coTab?.category || null
          });
        }
        coMap.get(coUrl).coCount++;
      }
    }

    const coOccurring = Array.from(coMap.values())
      .sort((a, b) => b.coCount - a.coCount)
      .slice(0, 5);

    const categorySpread = categories.length;
    const signalScore = (data.sessions.size * 10) + (data.days.size * 15) + (categorySpread * 20);

    const proposal = {
      tabHash: data.hash,
      url,
      title: data.title,
      recurrenceCount: data.sessions.size,
      distinctDays: data.days.size,
      firstSeen: timestamps[0],
      lastSeen: timestamps[timestamps.length - 1],
      sessionIds,
      coOccurring,
      categories,
      candidateIntent: '', // filled below
      alternativeIntents: [],
      signalScore
    };

    proposal.candidateIntent = generateCandidateIntent(proposal, coOccurring);
    proposal.alternativeIntents = generateAlternativeIntents(proposal, coOccurring);

    proposals.push(proposal);
  }

  proposals.sort((a, b) => b.signalScore - a.signalScore);

  return {
    proposals: proposals.slice(0, limit),
    meta: {
      sessionsAnalyzed: sessions.length,
      tabsAnalyzed: tabs.length,
      feedbackCount: feedback.length
    }
  };
}

// --- Feedback endpoints ---

async function recordFeedback(hash, action, candidateIntent, url, title, correctedIntent) {
  if (!['confirm', 'correct', 'dismiss'].includes(action)) {
    throw new Error(`Invalid action: ${action}. Must be confirm, correct, or dismiss.`);
  }

  const entry = {
    tabHash: hash,
    url: url || null,
    title: title || null,
    candidateIntent: candidateIntent || null,
    action,
    correctedIntent: action === 'correct' ? correctedIntent : null,
    at: new Date().toISOString()
  };

  return saveFeedback(entry);
}

async function getResolvedIntentions() {
  const feedback = await loadFeedback();
  return {
    confirmed: feedback.filter(f => f.action === 'confirm'),
    corrected: feedback.filter(f => f.action === 'correct'),
    dismissed: feedback.filter(f => f.action === 'dismiss')
  };
}

async function getStats() {
  const feedback = await loadFeedback();
  const confirmed = feedback.filter(f => f.action === 'confirm').length;
  const corrected = feedback.filter(f => f.action === 'correct').length;
  const dismissed = feedback.filter(f => f.action === 'dismiss').length;
  const total = feedback.length;

  return {
    total,
    confirmed,
    corrected,
    dismissed,
    accuracy: total > 0 ? Math.round((confirmed / total) * 100) / 100 : null
  };
}

module.exports = {
  tabHash,
  getIntentProposals,
  recordFeedback,
  getResolvedIntentions,
  getStats,
  loadFeedback,
  saveThemeFeedback
};
