/**
 * Re-classification Module
 *
 * Creates new linked artifacts, never overwrites originals.
 * Supports two scopes:
 *   - 'pass4': Re-run only thematic analysis (default, cheaper)
 *   - 'full': Re-run all 4 classification passes
 *
 * Original sessions are immutable per Lanesborough Protocol.
 */

const fs = require('fs').promises;
const path = require('path');
const { readSession } = require('../memory');
const { loadContext } = require('../contextLoader');
const {
  classifyWithLLM,
  analyzeThematicRelationships,
  DEFAULT_ENGINE
} = require('../classifier');
const { getEngineInfo } = require('../models');

const RECLASSIFICATIONS_DIR = path.join(__dirname, '../../memory/reclassifications');

/**
 * Ensure reclassifications directory exists
 */
async function ensureReclassificationsDir() {
  await fs.mkdir(RECLASSIFICATIONS_DIR, { recursive: true });
}

/**
 * Reconstruct tabs array from session groups
 * Note: Original content is not preserved in sessions, so tabs will have empty content
 */
function reconstructTabsFromSession(session) {
  const tabs = [];

  // Flatten groups back into tabs array
  for (const [category, categoryTabs] of Object.entries(session.groups || {})) {
    for (const tab of categoryTabs) {
      // tabIndex is 1-based in sessions
      tabs[tab.tabIndex - 1] = {
        title: tab.title,
        url: tab.url,
        content: ''  // Content not preserved in session storage
      };
    }
  }

  // Filter out any undefined slots and return
  return tabs.filter(Boolean);
}

/**
 * Generate artifact filename
 * Format: {original_session_id}--{reclassified_timestamp}.json
 */
function generateArtifactFilename(sessionId) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
  return `${sessionId}--${timestamp}.json`;
}

/**
 * Re-classify an existing session with current context
 *
 * @param {string} sessionId - Original session ID
 * @param {string} scope - 'pass4' (default) or 'full'
 * @param {string} engine - LLM engine to use
 * @returns {Object} Re-classification result with artifact ID
 */
async function reclassifySession(sessionId, scope = 'pass4', engine = DEFAULT_ENGINE) {
  // 1. Load original session (immutable - never modified)
  const originalSession = await readSession(sessionId);
  if (!originalSession) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // 2. Load current context
  const context = loadContext();
  if (!context) {
    throw new Error('No context.json found. Set active projects first using set_active_projects.');
  }

  // 3. Get engine info
  const engineInfo = getEngineInfo(engine);

  // 4. Reconstruct tabs from original session
  const tabs = reconstructTabsFromSession(originalSession);
  if (tabs.length === 0) {
    throw new Error('No tabs found in session to reclassify');
  }

  console.error(`[Reclassify] Starting ${scope} reclassification of ${sessionId} with ${tabs.length} tabs`);

  // 5. Run classification based on scope
  let newAnalysis;
  const startTime = Date.now();

  if (scope === 'pass4') {
    // Pass 4 only - thematic analysis
    // Uses original session result as base, runs Pass 4 with new context
    newAnalysis = await analyzeThematicRelationships(
      originalSession,  // Use original classification as base
      tabs,
      context,
      engine,
      false  // debugMode
    );

    if (!newAnalysis) {
      throw new Error('Thematic analysis returned null - context may be invalid');
    }
  } else if (scope === 'full') {
    // Full re-classification - all 4 passes
    // Note: Content is not available for re-classification, only URL/title
    console.error('[Reclassify] Running full 4-pass reclassification (note: content not available)');
    newAnalysis = await classifyWithLLM(tabs, engine, context, false);
  } else {
    throw new Error(`Invalid scope: ${scope}. Must be 'pass4' or 'full'.`);
  }

  const elapsed = Date.now() - startTime;

  // 6. Create reclassification artifact
  const artifactFilename = generateArtifactFilename(sessionId);
  const artifact = {
    derivedFrom: sessionId,
    reclassifiedAt: new Date().toISOString(),
    reclassifiedBy: 'memento-mcp',  // Could be parameterized for different agents
    scope,
    contextVersion: context.generated || null,
    contextUsed: {
      projectCount: context.activeProjects?.length || 0,
      projects: context.activeProjects?.map(p => p.name) || []
    },
    // Include the new analysis
    ...(scope === 'pass4' ? { thematicAnalysis: newAnalysis } : newAnalysis),
    meta: {
      originalTabCount: tabs.length,
      engine: engineInfo.engine,
      model: engineInfo.model,
      timing: {
        reclassificationMs: elapsed
      }
    }
  };

  // 7. Save artifact
  await ensureReclassificationsDir();
  const artifactPath = path.join(RECLASSIFICATIONS_DIR, artifactFilename);
  await fs.writeFile(artifactPath, JSON.stringify(artifact, null, 2));

  console.error(`[Reclassify] Created artifact: ${artifactFilename}`);

  return {
    success: true,
    artifactId: artifactFilename.replace('.json', ''),
    derivedFrom: sessionId,
    scope,
    projectsUsed: context.activeProjects?.length || 0,
    newActionsCount: scope === 'pass4'
      ? (newAnalysis?.suggestedActions?.length || 0)
      : (newAnalysis?.thematicAnalysis?.suggestedActions?.length || 0),
    timing: {
      reclassificationMs: elapsed
    }
  };
}

/**
 * List all reclassification artifacts for a session
 */
async function listReclassifications(sessionId) {
  try {
    await ensureReclassificationsDir();
    const files = await fs.readdir(RECLASSIFICATIONS_DIR);
    const prefix = `${sessionId}--`;
    return files
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error) {
    return [];
  }
}

/**
 * Read a specific reclassification artifact
 */
async function readReclassification(artifactId) {
  try {
    const filepath = path.join(RECLASSIFICATIONS_DIR, `${artifactId}.json`);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

module.exports = {
  reclassifySession,
  listReclassifications,
  readReclassification,
  RECLASSIFICATIONS_DIR
};
