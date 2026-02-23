/**
 * Task Actions Module
 *
 * Handles REAL actions for the Task-Driven Attention System.
 * These actions actually modify data - they connect to dispositions,
 * blocklists, and deferrals.
 *
 * This is the bridge between "Tasks" (longitudinal analysis) and
 * "Sessions" (captured tab data with dispositions).
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { appendDisposition } = require('./dispositions');
const { appendAction: logTaskAction } = require('./taskLog');
const aggregator = require('./aggregator');

const MEMENTO_DIR = path.join(os.homedir(), '.memento');
const RELEASED_URLS_PATH = path.join(MEMENTO_DIR, 'released-urls.json');
const DEFERRED_TASKS_PATH = path.join(MEMENTO_DIR, 'deferred-tasks.json');
const PAUSED_PROJECTS_PATH = path.join(MEMENTO_DIR, 'paused-projects.json');

// ============================================================
// BLOCKLIST MANAGEMENT (Released URLs)
// ============================================================

/**
 * Load the released URLs blocklist
 */
async function loadReleasedUrls() {
  try {
    await fs.mkdir(MEMENTO_DIR, { recursive: true });
    const content = await fs.readFile(RELEASED_URLS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { version: '1.0.0', urls: [] };
  }
}

/**
 * Add a URL to the blocklist
 */
async function addToBlocklist(url, source = 'task-picker', reason = 'user-released') {
  const blocklist = await loadReleasedUrls();

  // Check if already blocked
  if (blocklist.urls.some(u => u.url === url)) {
    return { alreadyBlocked: true };
  }

  blocklist.urls.push({
    url,
    releasedAt: new Date().toISOString(),
    source,
    reason
  });

  await fs.writeFile(RELEASED_URLS_PATH, JSON.stringify(blocklist, null, 2));
  console.error(`[TaskActions] Added to blocklist: ${url}`);

  return { success: true, totalBlocked: blocklist.urls.length };
}

/**
 * Check if a URL is blocklisted
 */
async function isUrlBlocked(url) {
  const blocklist = await loadReleasedUrls();
  return blocklist.urls.some(u => u.url === url);
}

/**
 * Get all blocked URLs
 */
async function getBlockedUrls() {
  const blocklist = await loadReleasedUrls();
  return blocklist.urls.map(u => u.url);
}

// ============================================================
// DEFERRAL MANAGEMENT
// ============================================================

/**
 * Load deferred tasks
 */
async function loadDeferredTasks() {
  try {
    await fs.mkdir(MEMENTO_DIR, { recursive: true });
    const content = await fs.readFile(DEFERRED_TASKS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { version: '1.0.0', tasks: [] };
  }
}

/**
 * Defer a task for a specified duration
 */
async function deferTask(taskId, taskType, identifier, hours = 24) {
  const deferred = await loadDeferredTasks();

  const deferUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // Remove existing deferral for this identifier if any
  deferred.tasks = deferred.tasks.filter(t =>
    !(t.taskType === taskType && t.identifier === identifier)
  );

  deferred.tasks.push({
    taskId,
    taskType,
    identifier, // URL for ghost tabs, project name for projects
    deferredAt: new Date().toISOString(),
    deferUntil,
    hours
  });

  await fs.writeFile(DEFERRED_TASKS_PATH, JSON.stringify(deferred, null, 2));
  console.error(`[TaskActions] Deferred task for ${hours}h: ${identifier}`);

  return { success: true, deferUntil };
}

/**
 * Check if a task identifier is currently deferred
 */
async function isDeferred(taskType, identifier) {
  const deferred = await loadDeferredTasks();
  const now = new Date().toISOString();

  return deferred.tasks.some(t =>
    t.taskType === taskType &&
    t.identifier === identifier &&
    t.deferUntil > now
  );
}

/**
 * Get all active deferrals
 */
async function getActiveDeferrals() {
  const deferred = await loadDeferredTasks();
  const now = new Date().toISOString();

  return deferred.tasks.filter(t => t.deferUntil > now);
}

/**
 * Clean up expired deferrals
 */
async function cleanExpiredDeferrals() {
  const deferred = await loadDeferredTasks();
  const now = new Date().toISOString();

  const before = deferred.tasks.length;
  deferred.tasks = deferred.tasks.filter(t => t.deferUntil > now);
  const after = deferred.tasks.length;

  if (before !== after) {
    await fs.writeFile(DEFERRED_TASKS_PATH, JSON.stringify(deferred, null, 2));
    console.error(`[TaskActions] Cleaned ${before - after} expired deferrals`);
  }

  return { cleaned: before - after };
}

// ============================================================
// PAUSED PROJECTS
// ============================================================

/**
 * Load paused projects
 */
async function loadPausedProjects() {
  try {
    await fs.mkdir(MEMENTO_DIR, { recursive: true });
    const content = await fs.readFile(PAUSED_PROJECTS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { version: '1.0.0', projects: [] };
  }
}

/**
 * Pause a project
 */
async function pauseProject(projectName, resumeAfterDays = null) {
  const paused = await loadPausedProjects();

  // Remove existing pause for this project if any
  paused.projects = paused.projects.filter(p => p.name !== projectName);

  const resumeAfter = resumeAfterDays
    ? new Date(Date.now() + resumeAfterDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  paused.projects.push({
    name: projectName,
    pausedAt: new Date().toISOString(),
    resumeAfter
  });

  await fs.writeFile(PAUSED_PROJECTS_PATH, JSON.stringify(paused, null, 2));
  console.error(`[TaskActions] Paused project: ${projectName}`);

  return { success: true, resumeAfter };
}

/**
 * Check if a project is paused
 */
async function isProjectPaused(projectName) {
  const paused = await loadPausedProjects();
  const now = new Date().toISOString();

  return paused.projects.some(p =>
    p.name === projectName &&
    (!p.resumeAfter || p.resumeAfter > now)
  );
}

// ============================================================
// GHOST TAB ACTIONS
// ============================================================

/**
 * Release a ghost tab - marks it as "let go" across all sessions
 */
async function releaseGhostTab(task) {
  const url = task.url;
  if (!url) {
    return { success: false, message: 'No URL in task' };
  }

  console.error(`[TaskActions] Releasing ghost tab: ${url}`);

  // 1. Find all sessions containing this URL
  const sessions = await aggregator.getAllSessions();
  const affectedSessions = [];

  for (const session of sessions) {
    if (!session.groups) continue;

    // Check if this URL is in the session
    const groups = Array.isArray(session.groups)
      ? session.groups
      : Object.entries(session.groups);

    for (const entry of groups) {
      const [category, items] = Array.isArray(entry) ? entry : [entry.name, entry.items];
      if (!Array.isArray(items)) continue;

      const hasUrl = items.some(item => item.url === url);
      if (hasUrl) {
        affectedSessions.push(session._id);
        break;
      }
    }
  }

  console.error(`[TaskActions] Found ${affectedSessions.length} sessions with this URL`);

  // 2. Add disposition to each affected session
  const dispositionResults = [];
  for (const sessionId of affectedSessions) {
    try {
      const result = await appendDisposition(sessionId, {
        action: 'trash',
        url: url,
        source: 'task-picker',
        reason: 'ghost-tab-released'
      });
      dispositionResults.push({ sessionId, success: result.success });
    } catch (e) {
      dispositionResults.push({ sessionId, success: false, error: e.message });
    }
  }

  // 3. Add to blocklist so it won't appear again
  const blockResult = await addToBlocklist(url, 'task-picker', 'ghost-tab-released');

  // 4. Log the action
  await logTaskAction({
    taskId: task.id,
    taskType: 'ghost_tab',
    action: 'release',
    task: {
      title: task.title,
      url: task.url,
      openCount: task.openCount
    },
    outcome: {
      sessionsAffected: affectedSessions.length,
      addedToBlocklist: !blockResult.alreadyBlocked
    }
  });

  // Extract domain for display
  let displayDomain = '';
  try {
    displayDomain = new URL(url).hostname;
  } catch (e) {
    displayDomain = task.domain || 'this URL';
  }

  return {
    success: true,
    message: `Released "${task.title}" from ${affectedSessions.length} sessions`,
    toastMessage: `Blocked ${displayDomain}`,
    sessionsAffected: affectedSessions.length,
    addedToBlocklist: !blockResult.alreadyBlocked,
    dispositionResults
  };
}

/**
 * Engage with a ghost tab - marks it as being dealt with
 */
async function engageGhostTab(task) {
  const url = task.url;
  if (!url) {
    return { success: false, message: 'No URL in task' };
  }

  console.error(`[TaskActions] Engaging ghost tab: ${url}`);

  // 1. Find most recent session containing this URL
  const sessions = await aggregator.getAllSessions();
  let mostRecentSession = null;

  for (const session of sessions) {
    if (!session.groups) continue;

    const groups = Array.isArray(session.groups)
      ? session.groups
      : Object.entries(session.groups);

    for (const entry of groups) {
      const [category, items] = Array.isArray(entry) ? entry : [entry.name, entry.items];
      if (!Array.isArray(items)) continue;

      if (items.some(item => item.url === url)) {
        mostRecentSession = session._id;
        break;
      }
    }
    if (mostRecentSession) break; // Sessions are sorted newest first
  }

  // 2. Add disposition to most recent session
  if (mostRecentSession) {
    await appendDisposition(mostRecentSession, {
      action: 'complete',
      url: url,
      source: 'task-picker',
      reason: 'ghost-tab-engaged'
    });
  }

  // 3. Defer for 24 hours (give user time to actually deal with it)
  await deferTask(task.id, 'ghost_tab', url, 24);

  // 4. Log the action
  await logTaskAction({
    taskId: task.id,
    taskType: 'ghost_tab',
    action: 'engage',
    task: {
      title: task.title,
      url: task.url,
      openCount: task.openCount
    },
    outcome: {
      sessionMarked: mostRecentSession,
      deferredHours: 24
    }
  });

  return {
    success: true,
    message: `Opening "${task.title}" - marked as engaged`,
    toastMessage: 'Marked as engaged - go for it!',
    url: url,
    openInNewTab: true,
    deferredUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

/**
 * Defer a ghost tab
 */
async function deferGhostTab(task, hours = 24) {
  const url = task.url;
  if (!url) {
    return { success: false, message: 'No URL in task' };
  }

  await deferTask(task.id, 'ghost_tab', url, hours);

  await logTaskAction({
    taskId: task.id,
    taskType: 'ghost_tab',
    action: 'defer',
    task: {
      title: task.title,
      url: task.url
    },
    outcome: { deferredHours: hours }
  });

  return {
    success: true,
    message: `Deferred for ${hours} hours`,
    toastMessage: `Coming back in ${hours}h`,
    deferredUntil: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  };
}

// ============================================================
// PROJECT REVIVAL ACTIONS
// ============================================================

/**
 * Engage with a neglected project
 */
async function engageProject(task) {
  const projectName = task.projectName;
  if (!projectName) {
    return { success: false, message: 'No project name in task' };
  }

  console.error(`[TaskActions] Engaging project: ${projectName}`);

  // Find most recent session with this project
  const sessions = await aggregator.getAllSessions();
  let targetSession = null;

  for (const session of sessions) {
    const projectSupport = session.thematicAnalysis?.projectSupport;
    if (projectSupport && projectSupport[projectName]) {
      targetSession = session._id;
      break;
    }
  }

  await logTaskAction({
    taskId: task.id,
    taskType: 'project_revival',
    action: 'engage',
    task: {
      projectName: task.projectName,
      daysSinceActive: task.daysSinceActive
    },
    outcome: { targetSession }
  });

  return {
    success: true,
    message: `Opening ${projectName} in Launchpad`,
    toastMessage: `Opening ${projectName}...`,
    redirectTo: targetSession ? `/launchpad/${targetSession}` : '/history',
    projectName
  };
}

/**
 * Pause a project
 */
async function pauseProjectTask(task, days = 30) {
  const projectName = task.projectName;
  if (!projectName) {
    return { success: false, message: 'No project name in task' };
  }

  await pauseProject(projectName, days);

  await logTaskAction({
    taskId: task.id,
    taskType: 'project_revival',
    action: 'pause',
    task: {
      projectName: task.projectName,
      daysSinceActive: task.daysSinceActive
    },
    outcome: { pausedDays: days }
  });

  return {
    success: true,
    message: `Paused "${projectName}" for ${days} days`,
    toastMessage: `${projectName} paused for ${days} days`,
    resumeAfter: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  };
}

// ============================================================
// TAB BANKRUPTCY ACTIONS
// ============================================================

/**
 * Declare tab bankruptcy - release ALL stale tabs
 */
async function declareBankruptcy(task) {
  const staleTabs = task.staleTabs || [];

  if (staleTabs.length === 0) {
    return { success: false, message: 'No stale tabs to release' };
  }

  console.error(`[TaskActions] Declaring bankruptcy on ${staleTabs.length} tabs`);

  let released = 0;
  let errors = 0;

  for (const tab of staleTabs) {
    try {
      // Add each URL to blocklist
      await addToBlocklist(tab.url, 'task-picker', 'bankruptcy');
      released++;
    } catch (e) {
      errors++;
    }
  }

  await logTaskAction({
    taskId: task.id,
    taskType: 'tab_bankruptcy',
    action: 'release_all',
    task: {
      affectedCount: task.affectedCount,
      avgDaysStale: task.avgDaysStale
    },
    outcome: { released, errors }
  });

  return {
    success: true,
    message: `Declared bankruptcy: ${released} tabs released`,
    toastMessage: `Cleared ${released} stale tabs!`,
    released,
    errors
  };
}

/**
 * Start detailed review of stale tabs
 */
async function startDetailedReview(task) {
  await logTaskAction({
    taskId: task.id,
    taskType: 'tab_bankruptcy',
    action: 'detailed',
    task: {
      affectedCount: task.affectedCount
    },
    outcome: { action: 'stub-no-review-ui' }
  });

  return {
    success: true,
    message: 'Detailed review UI not built yet',
    isStub: true
  };
}

/**
 * Start triage (keep 5, release rest)
 */
async function startTriage(task) {
  await logTaskAction({
    taskId: task.id,
    taskType: 'tab_bankruptcy',
    action: 'triage',
    task: {
      affectedCount: task.affectedCount
    },
    outcome: { action: 'stub-no-triage-ui' }
  });

  return {
    success: true,
    message: 'Triage UI not built yet',
    isStub: true
  };
}

// ============================================================
// MAIN ACTION DISPATCHER
// ============================================================

/**
 * Execute a task action
 *
 * @param {Object} task - The enriched task
 * @param {string} action - The action to take
 * @returns {Promise<Object>} Result of the action
 */
async function executeAction(task, action) {
  console.error(`[TaskActions] Executing ${action} on ${task.type}`);

  // Clean up expired deferrals first
  await cleanExpiredDeferrals();

  switch (task.type) {
    case 'ghost_tab':
      switch (action) {
        case 'engage':
          return engageGhostTab(task);
        case 'release':
          return releaseGhostTab(task);
        case 'defer':
          return deferGhostTab(task);
        default:
          return { success: false, message: `Unknown action for ghost_tab: ${action}` };
      }

    case 'project_revival':
      switch (action) {
        case 'engage':
          return engageProject(task);
        case 'pause':
          return pauseProjectTask(task);
        case 'explore':
          // Future: open chat UI. No conversation mode built yet.
          await logTaskAction({
            taskId: task.id,
            taskType: 'project_revival',
            action: 'explore',
            task: { projectName: task.projectName }
          });
          return { success: true, message: 'Conversation mode not built yet', isStub: true };
        default:
          return { success: false, message: `Unknown action for project_revival: ${action}` };
      }

    case 'tab_bankruptcy':
      switch (action) {
        case 'triage':
          return startTriage(task);
        case 'detailed':
          return startDetailedReview(task);
        case 'release_all':
          return declareBankruptcy(task);
        default:
          return { success: false, message: `Unknown action for tab_bankruptcy: ${action}` };
      }

    default:
      return { success: false, message: `Unknown task type: ${task.type}` };
  }
}

/**
 * Skip a task (just defer for a short time, don't log as permanent action)
 */
async function skipTask(task) {
  // Defer for 1 hour so user sees different task
  const identifier = task.url || task.projectName || task.id;
  await deferTask(task.id, task.type, identifier, 1);

  return {
    success: true,
    message: 'Skipped - will reappear in 1 hour',
    deferredHours: 1
  };
}

module.exports = {
  // Main dispatcher
  executeAction,
  skipTask,

  // Blocklist management
  loadReleasedUrls,
  addToBlocklist,
  isUrlBlocked,
  getBlockedUrls,

  // Deferral management
  loadDeferredTasks,
  deferTask,
  isDeferred,
  getActiveDeferrals,
  cleanExpiredDeferrals,

  // Project pausing
  loadPausedProjects,
  pauseProject,
  isProjectPaused
};
