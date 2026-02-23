require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { classifyTabs } = require('./classifier');
const { renderSummaryPage } = require('./renderers/summaryRenderer');
const { renderMapPage } = require('./renderers/mapRenderer');
const { renderTabsPage } = require('./renderers/tabsRenderer');
const { renderAnalysisPage } = require('./renderers/analysisRenderer');
const { renderHistoryPage } = require('./renderers/historyRenderer');
const { saveSession, readSession, listSessions, searchSessions } = require('./memory');
const { loadContext } = require('./contextLoader');
const { processVisualExtractionTabs } = require('./pdfExtractor');
const { renderLaunchpadPage } = require('./launchpad');
const { appendDisposition, appendBatchDisposition, getSessionWithDispositions, getSessionWithDispositionsApplied } = require('./dispositions');
const { getLockStatus, clearLock, acquireLock, updateResumeState } = require('./lockManager');
const { getMirrorInsight } = require('./mirror');
const { getTopTask, getAllCandidateTasks, getAttentionStats } = require('./taskGenerator');
const { enrichTopTask, getFallbackInsight, getFallbackActions } = require('./taskEnricher');
const { getRecentEntries: getRecentTaskEntries, getStats: getTaskLogStats } = require('./taskLog');
const { executeAction: executeTaskAction, skipTask } = require('./taskActions');
const { renderTaskPickerPage, renderCompletionPage } = require('./renderers/taskPickerRenderer');
const { renderWorkbenchPage } = require('./renderers/workbenchRenderer');
const { renderRulesPage } = require('./renderers/rulesRenderer');
const { renderPreferencesPage } = require('./renderers/preferencesRenderer');
const { renderDevDashboardPage } = require('./renderers/devDashboardRenderer');
const { renderDashboardPage } = require('./renderers/dashboardRenderer');
const { runModel, getEngineInfo } = require('./models');
const { getAllRules, approveRule, rejectRule, getCorrectionStats } = require('./correctionAnalyzer');
const { createEffort, getEfforts, completeEffort, deferEffort } = require('./effortManager');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// GET /dev - Development dashboard (sprint tracking, feature inventory, route inventory)
app.get('/dev', async (req, res) => {
  try {
    res.send(await renderDevDashboardPage());
  } catch (error) {
    console.error('Dev dashboard error:', error);
    res.status(500).send('<html><body><h1>Error loading dev dashboard</h1><p>' + error.message + '</p></body></html>');
  }
});

// GET / - Main dashboard (navigation hub)
app.get('/', async (req, res) => {
  try {
    // Gather all dashboard data in parallel
    const [lockStatus, preferences, taskStats, recentSessions] = await Promise.all([
      getLockStatus(),
      getAllRules(),
      getAttentionStats(),
      listSessions().then(sessions => sessions.slice(0, 5))
    ]);

    res.send(renderDashboardPage({
      lockStatus,
      preferences,
      taskStats,
      recentSessions
    }));
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('<html><body><h1>Error loading dashboard</h1><p>' + error.message + '</p></body></html>');
  }
});

// GET /history - Browse all sessions
app.get('/history', async (req, res) => {
  try {
    const query = req.query.q || null;
    const page = parseInt(req.query.page, 10) || 1;
    const sessions = query ? await searchSessions(query) : await listSessions();
    res.send(renderHistoryPage(sessions, query, page));
  } catch (error) {
    console.error('History page error:', error);
    res.status(500).send('<html><body><h1>Error loading history</h1></body></html>');
  }
});

// POST /classifyBrowserContext - Main endpoint for tab classification
app.post('/classifyBrowserContext', async (req, res) => {
  try {
    const { tabs, engine, context: requestContext, debugMode } = req.body;

    if (!tabs || !Array.isArray(tabs)) {
      return res.status(400).json({ error: 'Invalid request: tabs array required' });
    }

    // Check for tabs needing visual extraction (PDFs, etc.)
    const visualExtractionCount = tabs.filter(t => t.needsVisualExtraction).length;
    console.log(`Received ${tabs.length} tabs for classification via ${engine || 'default'}${debugMode ? ' (debug mode)' : ''}${visualExtractionCount > 0 ? ` (${visualExtractionCount} PDFs to extract)` : ''}`);

    // Process PDFs and other visual content first
    let processedTabs = tabs;
    if (visualExtractionCount > 0) {
      console.log(`[Pass 0] Extracting content from ${visualExtractionCount} PDF(s)...`);
      processedTabs = await processVisualExtractionTabs(tabs);
    }

    // Load context: request context > file context > none
    const context = requestContext || loadContext();

    // Call LLM classifier with specified engine, context, and debugMode (default: true for trace capture)
    const classification = await classifyTabs(processedTabs, engine, context, debugMode ?? true);

    // Save to memory and get session ID
    const sessionId = await saveSession(classification);

    // Return JSON response with session ID
    res.json({
      ...classification,
      meta: {
        ...classification.meta,
        sessionId
      }
    });
  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({ error: 'Classification failed' });
  }
});

// GET /results - Render results as HTML page (legacy route, redirects to session-based)
app.get('/results', (req, res) => {
  // Redirect to history if no data - this route is deprecated
  res.redirect('/history');
});

// GET /results/:sessionId - View saved session results (Summary hub screen)
app.get('/results/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Use dispositions-applied version to show current state (after user corrections)
    const sessionData = await getSessionWithDispositionsApplied(sessionId);
    if (!sessionData) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }
    // Get mirror insight for confrontational reflection
    const mirrorInsight = await getMirrorInsight();
    res.send(renderSummaryPage(sessionData, sessionId, mirrorInsight));
  } catch (error) {
    console.error('Results view error:', error);
    res.status(500).send('<html><body><h1>Error loading results</h1></body></html>');
  }
});

// GET /results/:sessionId/map - Session visualization (Mermaid diagram)
app.get('/results/:sessionId/map', async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Map uses original session data (visualization reflects original analysis)
    const sessionData = await readSession(sessionId);
    if (!sessionData) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }
    res.send(renderMapPage(sessionData, sessionId));
  } catch (error) {
    console.error('Map view error:', error);
    res.status(500).send('<html><body><h1>Error loading map</h1></body></html>');
  }
});

// GET /results/:sessionId/tabs - Grouped tabs list view
app.get('/results/:sessionId/tabs', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const filterCategory = req.query.filter || null;
    // Use dispositions-applied version to show current state
    const sessionData = await getSessionWithDispositionsApplied(sessionId);
    if (!sessionData) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }
    res.send(renderTabsPage(sessionData, sessionId, filterCategory));
  } catch (error) {
    console.error('Tabs view error:', error);
    res.status(500).send('<html><body><h1>Error loading tabs</h1></body></html>');
  }
});

// GET /results/:sessionId/analysis - Deep analysis view
app.get('/results/:sessionId/analysis', async (req, res) => {
  try {
    const { sessionId } = req.params;
    // Analysis uses original session data (shows what AI analyzed)
    const sessionData = await readSession(sessionId);
    if (!sessionData) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }
    res.send(renderAnalysisPage(sessionData, sessionId));
  } catch (error) {
    console.error('Analysis view error:', error);
    res.status(500).send('<html><body><h1>Error loading analysis</h1></body></html>');
  }
});

// POST /classifyAndRender - Classify and return HTML directly
app.post('/classifyAndRender', async (req, res) => {
  try {
    const { tabs, engine, context: requestContext, debugMode } = req.body;

    if (!tabs || !Array.isArray(tabs)) {
      return res.status(400).send('<html><body><h1>Error: Invalid request</h1></body></html>');
    }

    // Check for tabs needing visual extraction (PDFs, etc.)
    const visualExtractionCount = tabs.filter(t => t.needsVisualExtraction).length;
    console.log(`Received ${tabs.length} tabs for classification via ${engine || 'default'}${debugMode ? ' (debug mode)' : ''}${visualExtractionCount > 0 ? ` (${visualExtractionCount} PDFs to extract)` : ''}`);

    // Process PDFs and other visual content first
    let processedTabs = tabs;
    if (visualExtractionCount > 0) {
      console.log(`[Pass 0] Extracting content from ${visualExtractionCount} PDF(s)...`);
      processedTabs = await processVisualExtractionTabs(tabs);
    }

    // Load context: request context > file context > none
    const context = requestContext || loadContext();

    // debugMode defaults to true for trace capture
    const classification = await classifyTabs(processedTabs, engine, context, debugMode ?? true);
    const sessionId = await saveSession(classification);
    // Get mirror insight for confrontational reflection
    const mirrorInsight = await getMirrorInsight();
    res.send(renderSummaryPage(classification, sessionId, mirrorInsight));
  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).send('<html><body><h1>Error: Classification failed</h1></body></html>');
  }
});

// ═══════════════════════════════════════════════════════════════
// LAUNCHPAD ROUTES - Nuclear Option forced-completion mode
// See: docs/SESSION-ARTIFACT-INVARIANTS.md
// ═══════════════════════════════════════════════════════════════

// GET /launchpad/:sessionId - Render Launchpad UI
app.get('/launchpad/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [sessionState, lockStatus, preferences, efforts] = await Promise.all([
      getSessionWithDispositions(sessionId),
      getLockStatus(),
      getAllRules(),
      getEfforts(sessionId)
    ]);

    if (!sessionState) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }

    // Count active preferences for display
    const preferenceCount = preferences?.approved?.length || 0;

    res.send(renderLaunchpadPage(sessionId, sessionState, lockStatus, false, preferenceCount, efforts));
  } catch (error) {
    console.error('Launchpad error:', error);
    res.status(500).send('<html><body><h1>Error loading Launchpad</h1></body></html>');
  }
});

// GET /review/:sessionId - Review Mode (no lock required)
app.get('/review/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionState = await getSessionWithDispositions(sessionId);

    if (!sessionState) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }

    // Review mode - no lock status needed
    res.send(renderLaunchpadPage(sessionId, sessionState, {}, true));
  } catch (error) {
    console.error('Review mode error:', error);
    res.status(500).send('<html><body><h1>Error loading Review</h1></body></html>');
  }
});

// GET /api/launchpad/:sessionId/state - Get session state with dispositions
app.get('/api/launchpad/:sessionId/state', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionState = await getSessionWithDispositions(sessionId);

    if (!sessionState) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(sessionState);
  } catch (error) {
    console.error('State fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch session state' });
  }
});

// POST /api/launchpad/:sessionId/disposition - Record a user action
app.post('/api/launchpad/:sessionId/disposition', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, itemId, from, to, target, priority, undoes } = req.body;

    const result = await appendDisposition(sessionId, {
      action,
      itemId,
      from,
      to,
      target,
      priority,
      undoes
    });

    res.json(result);
  } catch (error) {
    console.error('Disposition error:', error);
    res.status(500).json({ success: false, message: 'Failed to record disposition' });
  }
});

// POST /api/launchpad/:sessionId/batch-disposition - Record multiple actions atomically
app.post('/api/launchpad/:sessionId/batch-disposition', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { dispositions } = req.body;

    if (!Array.isArray(dispositions)) {
      return res.status(400).json({ success: false, message: 'dispositions array required' });
    }

    const result = await appendBatchDisposition(sessionId, dispositions);
    res.json(result);
  } catch (error) {
    console.error('Batch disposition error:', error);
    res.status(500).json({ success: false, message: 'Failed to record batch disposition' });
  }
});

// POST /api/launchpad/:sessionId/clear-lock - Clear session lock when complete
app.post('/api/launchpad/:sessionId/clear-lock', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify all items are resolved
    const sessionState = await getSessionWithDispositions(sessionId);
    if (!sessionState) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (sessionState.unresolvedCount > 0) {
      return res.json({
        success: false,
        message: `Cannot clear lock: ${sessionState.unresolvedCount} items still unresolved`
      });
    }

    // Clear the lock
    const result = await clearLock(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Clear lock error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear lock' });
  }
});

// GET /api/lock-status - Get current lock status (for extension/Results page)
app.get('/api/lock-status', async (req, res) => {
  try {
    const status = await getLockStatus();
    res.json(status);
  } catch (error) {
    console.error('Lock status error:', error);
    res.status(500).json({ error: 'Failed to get lock status' });
  }
});

// POST /api/acquire-lock - Acquire session lock (for Launchpad mode)
app.post('/api/acquire-lock', async (req, res) => {
  try {
    const { sessionId, itemsRemaining } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'sessionId required' });
    }

    const result = await acquireLock(sessionId, itemsRemaining || 0);
    res.json(result);
  } catch (error) {
    console.error('Acquire lock error:', error);
    res.status(500).json({ success: false, message: 'Failed to acquire lock' });
  }
});

// POST /api/launchpad/:sessionId/resume-state - Update resume state for task resumption
app.post('/api/launchpad/:sessionId/resume-state', async (req, res) => {
  try {
    const { goal, focusCategory } = req.body;

    const result = await updateResumeState({ goal, focusCategory });
    res.json(result);
  } catch (error) {
    console.error('Resume state error:', error);
    res.status(500).json({ success: false, message: 'Failed to update resume state' });
  }
});

// POST /api/lock/force-clear - Force clear lock (testing/emergency override)
app.post('/api/lock/force-clear', async (req, res) => {
  try {
    const result = await clearLock(null, true); // override=true bypasses session check
    console.error('Force clear lock requested');
    res.json(result);
  } catch (error) {
    console.error('Force clear lock error:', error);
    res.status(500).json({ success: false, message: 'Failed to force clear lock' });
  }
});

// ═══════════════════════════════════════════════════════════════
// EFFORT ROUTES - User-created tab groupings
// Allows grouping scattered tabs into named efforts
// ═══════════════════════════════════════════════════════════════

// POST /api/launchpad/:sessionId/effort - Create a new effort
app.post('/api/launchpad/:sessionId/effort', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, items } = req.body;

    if (!name || !items) {
      return res.status(400).json({ success: false, message: 'name and items required' });
    }

    const result = await createEffort(sessionId, name, items);
    res.json(result);
  } catch (error) {
    console.error('Create effort error:', error);
    res.status(500).json({ success: false, message: 'Failed to create effort' });
  }
});

// GET /api/launchpad/:sessionId/efforts - Get all efforts for a session
app.get('/api/launchpad/:sessionId/efforts', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const efforts = await getEfforts(sessionId);
    res.json({ success: true, efforts });
  } catch (error) {
    console.error('Get efforts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get efforts' });
  }
});

// POST /api/launchpad/:sessionId/effort/:effortId/complete - Complete an effort
app.post('/api/launchpad/:sessionId/effort/:effortId/complete', async (req, res) => {
  try {
    const { sessionId, effortId } = req.params;
    const result = await completeEffort(sessionId, effortId);
    res.json(result);
  } catch (error) {
    console.error('Complete effort error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete effort' });
  }
});

// POST /api/launchpad/:sessionId/effort/:effortId/defer - Defer an effort
app.post('/api/launchpad/:sessionId/effort/:effortId/defer', async (req, res) => {
  try {
    const { sessionId, effortId } = req.params;
    const result = await deferEffort(sessionId, effortId);
    res.json(result);
  } catch (error) {
    console.error('Defer effort error:', error);
    res.status(500).json({ success: false, message: 'Failed to defer effort' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TASK ROUTES - Task-Driven Attention System
// "One Thing, One Goal" - surfaces the most important task
// ═══════════════════════════════════════════════════════════════

// GET /tasks - Task picker page (renders top task with LLM enrichment)
app.get('/tasks', async (req, res) => {
  try {
    const { completed } = req.query;

    // If just completed an action, show brief feedback then load next task
    if (completed) {
      console.error(`[Tasks] Action completed: ${completed}`);
    }

    // Get top task and enrich it
    const topTask = await getTopTask();
    const stats = await getAttentionStats();

    if (!topTask) {
      // No tasks to show
      res.send(renderTaskPickerPage(null, stats));
      return;
    }

    console.error(`[Tasks] Top task: ${topTask.type} (score: ${topTask.score})`);

    // Render immediately with fallback content (LLM enrichment happens async on client)
    const preEnriched = {
      ...topTask,
      insight: getFallbackInsight(topTask),
      whyThisMatters: 'This pattern in your browsing suggests an open loop worth addressing.',
      theQuestion: 'What do you want to do about this?',
      actions: getFallbackActions(topTask),
      conversationPrompts: [],
      meta: { engine: 'fallback' }
    };

    res.send(renderTaskPickerPage(preEnriched, stats, { rawTask: topTask }));
  } catch (error) {
    console.error('Tasks page error:', error);
    res.status(500).send('<html><body><h1>Error loading tasks</h1><p>' + error.message + '</p></body></html>');
  }
});

// GET /api/tasks/candidates - Get raw candidate tasks (before enrichment)
app.get('/api/tasks/candidates', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const candidates = await getAllCandidateTasks({ limit });
    res.json({ candidates });
  } catch (error) {
    console.error('Candidates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

// GET /api/tasks/stats - Get attention stats and task log stats
app.get('/api/tasks/stats', async (req, res) => {
  try {
    const [attentionStats, logStats] = await Promise.all([
      getAttentionStats(),
      getTaskLogStats()
    ]);
    res.json({
      attention: attentionStats,
      actions: logStats
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/tasks/log - Get recent task log entries
app.get('/api/tasks/log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const entries = await getRecentTaskEntries(limit);
    res.json({ entries });
  } catch (error) {
    console.error('Log fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

// POST /api/tasks/enrich - Async LLM enrichment for a task (called by client after page load)
app.post('/api/tasks/enrich', async (req, res) => {
  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({ success: false, message: 'task object required' });
    }

    console.error(`[Tasks] Async enrichment requested for ${task.type}`);
    const enriched = await enrichTopTask(task);

    if (!enriched) {
      return res.json({ success: false, message: 'Enrichment returned null' });
    }

    res.json({
      success: true,
      enrichment: {
        insight: enriched.insight,
        whyThisMatters: enriched.whyThisMatters,
        theQuestion: enriched.theQuestion,
        actions: enriched.actions,
        conversationPrompts: enriched.conversationPrompts,
        meta: enriched.meta
      }
    });
  } catch (error) {
    console.error('Task enrichment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Enrichment failed' });
  }
});

// POST /api/tasks/:taskId/action - Execute REAL task action
app.post('/api/tasks/:taskId/action', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, taskType, task } = req.body;

    console.error(`[Tasks] Action: ${action} on ${taskType} (${taskId})`);

    let result;

    // Skip is special - doesn't create permanent record
    if (action === 'skip') {
      result = await skipTask(task);
    } else {
      // Execute the real action (modifies dispositions, blocklists, etc.)
      result = await executeTaskAction(task, action);
    }

    res.json(result);
  } catch (error) {
    console.error('Task action error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to execute action' });
  }
});

// ═══════════════════════════════════════════════════════════════
// WORKBENCH ROUTES - Prompt inspection and editing
// ═══════════════════════════════════════════════════════════════

// GET /workbench/:sessionId - Inspect prompts and responses for a session
app.get('/workbench/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await readSession(sessionId);

    if (!session) {
      return res.status(404).send('<html><body><h1>Session not found</h1></body></html>');
    }

    res.send(renderWorkbenchPage(session, sessionId));
  } catch (error) {
    console.error('Workbench error:', error);
    res.status(500).send('<html><body><h1>Error loading workbench</h1></body></html>');
  }
});

// POST /api/workbench/rerun - Re-run a single pass with modified prompt
app.post('/api/workbench/rerun', async (req, res) => {
  try {
    const { sessionId, pass, prompt, engine } = req.body;

    if (!sessionId || !pass || !prompt) {
      return res.status(400).json({ error: 'sessionId, pass, and prompt required' });
    }

    // Load original session for context
    const session = await readSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Determine engine to use
    const useEngine = engine || session.meta?.engine || 'claude';
    const engineInfo = getEngineInfo(useEngine);

    console.log(`[Workbench] Re-running pass ${pass} for session ${sessionId} via ${useEngine}`);

    // Run the model with the modified prompt
    const response = await runModel(useEngine, prompt);

    res.json({
      success: true,
      pass,
      engine: engineInfo.engine,
      model: engineInfo.model,
      rawResponse: response.text,
      usage: response.usage || null
    });
  } catch (error) {
    console.error('Workbench rerun error:', error);
    res.status(500).json({ error: error.message || 'Rerun failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PREFERENCES ROUTES - Learned classification preferences
// Closes the feedback loop: corrections → preferences → better classification
// ═══════════════════════════════════════════════════════════════

// GET /preferences - Preferences management UI
app.get('/preferences', async (req, res) => {
  try {
    const preferences = await getAllRules();
    const stats = await getCorrectionStats();
    res.send(renderPreferencesPage(preferences, stats));
  } catch (error) {
    console.error('Preferences page error:', error);
    res.status(500).send('<html><body><h1>Error loading preferences</h1><p>' + error.message + '</p></body></html>');
  }
});

// GET /rules - Redirect to /preferences (backwards compatibility)
app.get('/rules', (req, res) => {
  res.redirect('/preferences');
});

// GET /api/preferences - Get all preferences (approved + pending suggestions)
app.get('/api/preferences', async (req, res) => {
  try {
    const preferences = await getAllRules();
    const stats = await getCorrectionStats();
    res.json({ ...preferences, stats });
  } catch (error) {
    console.error('Preferences fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// GET /api/rules - Alias for /api/preferences (backwards compatibility)
app.get('/api/rules', async (req, res) => {
  try {
    const rules = await getAllRules();
    const stats = await getCorrectionStats();
    res.json({ ...rules, stats });
  } catch (error) {
    console.error('Rules fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// POST /api/preferences/:prefId/approve - Confirm a pending preference
app.post('/api/preferences/:prefId/approve', async (req, res) => {
  try {
    const { prefId } = req.params;
    const prefData = req.body;

    if (!prefData || !prefData.domain || !prefData.rule) {
      return res.status(400).json({ success: false, message: 'Preference data required (domain, rule)' });
    }

    console.error(`[Preferences] Confirming preference: ${prefId} for domain ${prefData.domain}`);
    await approveRule(prefId, prefData);

    res.json({ success: true, message: `Preference confirmed: ${prefData.domain}` });
  } catch (error) {
    console.error('Preference confirmation error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm preference' });
  }
});

// POST /api/rules/:ruleId/approve - Alias for backwards compatibility
app.post('/api/rules/:ruleId/approve', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const ruleData = req.body;

    if (!ruleData || !ruleData.domain || !ruleData.rule) {
      return res.status(400).json({ success: false, message: 'Rule data required (domain, rule)' });
    }

    console.error(`[Preferences] Confirming preference: ${ruleId} for domain ${ruleData.domain}`);
    await approveRule(ruleId, ruleData);

    res.json({ success: true, message: `Rule approved: ${ruleData.domain}` });
  } catch (error) {
    console.error('Rule approval error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve rule' });
  }
});

// POST /api/preferences/:prefId/reject - Dismiss a pending preference
app.post('/api/preferences/:prefId/reject', async (req, res) => {
  try {
    const { prefId } = req.params;

    console.error(`[Preferences] Dismissing preference: ${prefId}`);
    await rejectRule(prefId);

    res.json({ success: true, message: 'Preference dismissed' });
  } catch (error) {
    console.error('Preference dismissal error:', error);
    res.status(500).json({ success: false, message: 'Failed to dismiss preference' });
  }
});

// POST /api/rules/:ruleId/reject - Alias for backwards compatibility
app.post('/api/rules/:ruleId/reject', async (req, res) => {
  try {
    const { ruleId } = req.params;

    console.error(`[Preferences] Dismissing preference: ${ruleId}`);
    await rejectRule(ruleId);

    res.json({ success: true, message: 'Rule rejected' });
  } catch (error) {
    console.error('Rule rejection error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject rule' });
  }
});

// POST /api/preferences/:prefId/unapprove - Remove a confirmed preference
app.post('/api/preferences/:prefId/unapprove', async (req, res) => {
  try {
    const { prefId } = req.params;

    console.error(`[Preferences] Removing preference: ${prefId}`);
    await rejectRule(prefId);

    res.json({ success: true, message: 'Preference removed' });
  } catch (error) {
    console.error('Preference removal error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove preference' });
  }
});

// POST /api/rules/:ruleId/unapprove - Alias for backwards compatibility
app.post('/api/rules/:ruleId/unapprove', async (req, res) => {
  try {
    const { ruleId } = req.params;

    console.error(`[Preferences] Removing preference: ${ruleId}`);
    await rejectRule(ruleId);

    res.json({ success: true, message: 'Rule unapproved' });
  } catch (error) {
    console.error('Rule unapproval error:', error);
    res.status(500).json({ success: false, message: 'Failed to unapprove rule' });
  }
});

// ═══════════════════════════════════════════════════════════════
// DEV FEEDBACK ROUTES - Intent notes persistence
// ═══════════════════════════════════════════════════════════════

const fsPromises = require('fs').promises;
const devFeedbackDir = require('path').join(__dirname, '..', 'memory', 'dev-feedback');

app.get('/api/dev/intent-notes', async (req, res) => {
  try {
    const { page, taskType } = req.query;
    if (!page) return res.json({ notes: '' });

    const filePath = require('path').join(devFeedbackDir, page + '.json');
    const content = await fsPromises.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const key = taskType ? page + ':' + taskType : page;
    res.json({ notes: data[key] || '' });
  } catch (e) {
    res.json({ notes: '' });
  }
});

app.post('/api/dev/intent-notes', async (req, res) => {
  try {
    const { page, taskType, notes } = req.body;
    if (!page) return res.status(400).json({ success: false, message: 'page required' });

    await fsPromises.mkdir(devFeedbackDir, { recursive: true });

    const filePath = require('path').join(devFeedbackDir, page + '.json');
    let data = {};
    try {
      const existing = await fsPromises.readFile(filePath, 'utf-8');
      data = JSON.parse(existing);
    } catch (e) { /* file doesn't exist yet */ }

    const key = taskType ? page + ':' + taskType : page;
    data[key] = notes;
    await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
    res.json({ success: true });
  } catch (e) {
    console.error('Intent notes save error:', e);
    res.status(500).json({ success: false, message: 'Failed to save notes' });
  }
});

// ═══════════════════════════════════════════════════════════════
// INTENT DETECTION ROUTES - Pattern-based intent proposals
// ═══════════════════════════════════════════════════════════════

const intentDetection = require('./intentDetection');
const intentionsRenderer = require('./renderers/intentionsRenderer');
const themeDetection = require('./themeDetection');
const { renderThemesPage } = require('./renderers/themesRenderer');
const { saveThemeAsNote } = require('./themeSaver');

// GET /intentions - Intentions page (themes view by default, ?view=tabs for legacy)
app.get('/intentions', async (req, res) => {
  try {
    const view = req.query.view || 'themes';
    const stats = await intentDetection.getStats();

    if (view === 'tabs') {
      const data = await intentDetection.getIntentProposals();
      res.send(intentionsRenderer.renderIntentionsPage(data, stats));
    } else {
      const data = await themeDetection.getThemeProposals();
      res.send(renderThemesPage(data, stats));
    }
  } catch (err) {
    console.error('Error rendering intentions:', err);
    res.status(500).send('Error loading intentions page');
  }
});

// API: Get intent proposals
app.get('/api/intentions', async (req, res) => {
  try {
    const data = await intentDetection.getIntentProposals();
    res.json(data);
  } catch (err) {
    console.error('Error getting intentions:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Record feedback on a proposed intent
app.post('/api/intentions/:tabHash/feedback', async (req, res) => {
  try {
    const { action, correctedIntent, candidateIntent, url, title } = req.body;
    const feedback = await intentDetection.recordFeedback(
      req.params.tabHash, action, candidateIntent, url, title, correctedIntent
    );
    res.json({ ok: true, feedback });
  } catch (err) {
    console.error('Error recording feedback:', err);
    res.status(400).json({ error: err.message });
  }
});

// API: Get resolved intentions
app.get('/api/intentions/resolved', async (req, res) => {
  try {
    const resolved = await intentDetection.getResolvedIntentions();
    res.json(resolved);
  } catch (err) {
    console.error('Error getting resolved intentions:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Get theme proposals
app.get('/api/intentions/themes', async (req, res) => {
  try {
    const data = await themeDetection.getThemeProposals();
    res.json(data);
  } catch (err) {
    console.error('Error getting themes:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Record theme-level feedback
app.post('/api/intentions/themes/:themeId/feedback', async (req, res) => {
  try {
    const { themeId } = req.params;
    const { action, correctedIntent } = req.body;
    const feedback = await intentDetection.saveThemeFeedback(themeId, action, correctedIntent);
    res.json({ ok: true, feedback });
  } catch (err) {
    console.error('Error recording theme feedback:', err);
    res.status(400).json({ error: err.message });
  }
});

// API: Save theme as Basic Memory note
app.post('/api/intentions/themes/:themeId/save', async (req, res) => {
  try {
    const { themeId } = req.params;

    // Get all themes and find the one matching this ID
    const data = await themeDetection.getThemeProposals();
    const theme = data.themes.find(t => t.themeId === themeId);

    if (!theme) {
      return res.status(404).json({ ok: false, error: 'Theme not found' });
    }

    // Save to Basic Memory filesystem
    const result = await saveThemeAsNote(theme);

    // Record as 'save' feedback so theme shows as resolved
    await intentDetection.saveThemeFeedback(themeId, 'save', null);

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error saving theme as note:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// API: Get accuracy stats
app.get('/api/intentions/stats', async (req, res) => {
  try {
    const stats = await intentDetection.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting intent stats:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Memento backend running at http://localhost:${PORT}`);
  console.log(`POST /classifyBrowserContext - Classify tabs and return JSON`);
  console.log(`POST /classifyAndRender - Classify tabs and return HTML page`);
  console.log(`GET  /launchpad/:sessionId - Launchpad UI (Nuclear Option mode)`);
  console.log(`GET  /tasks - Task-Driven Attention System (One Thing)`);
  console.log(`GET  /workbench/:sessionId - Prompt Workbench (inspect/edit traces)`);
  console.log(`GET  /preferences - Learned Preferences Management`);
});
