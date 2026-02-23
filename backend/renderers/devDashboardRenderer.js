/**
 * Dev Dashboard Renderer
 * Sprint tracking, feature inventory, and LIVE route inventory for Memento development
 *
 * CRITICAL: The route inventory is the source of truth for what pages exist.
 * Developers can click any route to test it directly.
 */

const { escapeHtml, wrapInLayout } = require('./layout');
const { listSessions } = require('../memory');

// Route inventory - organized by purpose
// KEEP THIS IN SYNC WITH server.js - this is the living documentation
const ROUTES = {
  product: [
    { method: 'GET', path: '/', description: 'Main dashboard - navigation hub', group: 'Core' },
    { method: 'GET', path: '/history', description: 'Browse all sessions', group: 'Core' },
    { method: 'GET', path: '/launchpad/:sessionId', description: 'Launchpad UI - forced completion triage', group: 'Core' },
    { method: 'GET', path: '/preferences', description: 'Learned preferences management', group: 'Core' },
    { method: 'GET', path: '/tasks', description: 'Task-driven attention system', group: 'Core' },
    { method: 'GET', path: '/results/:sessionId', description: 'Session summary - hub screen', group: 'Session Views' },
    { method: 'GET', path: '/results/:sessionId/tabs', description: 'Browse grouped tabs', group: 'Session Views' },
    { method: 'GET', path: '/review/:sessionId', description: 'Review mode (no lock)', group: 'Session Views' },
  ],
  developer: [
    { method: 'GET', path: '/dev', description: 'THIS PAGE - sprint tracking + routes', group: 'Dev Tools' },
    { method: 'GET', path: '/workbench/:sessionId', description: 'Prompt inspection and editing', group: 'Dev Tools' },
    { method: 'GET', path: '/results/:sessionId/analysis', description: 'Multi-pass classification breakdown', group: 'Dev Tools' },
    { method: 'GET', path: '/results/:sessionId/map', description: 'Mermaid visualization (demote candidate)', group: 'Dev Tools' },
  ],
  api: [
    { method: 'POST', path: '/classifyBrowserContext', description: 'Main classification endpoint', group: 'Classification' },
    { method: 'POST', path: '/classifyAndRender', description: 'Classify and return HTML', group: 'Classification' },
    { method: 'GET', path: '/api/lock-status', description: 'Current lock status', group: 'Lock' },
    { method: 'POST', path: '/api/acquire-lock', description: 'Acquire session lock', group: 'Lock' },
    { method: 'POST', path: '/api/lock/force-clear', description: 'Force clear lock (dev)', group: 'Lock' },
    { method: 'GET', path: '/api/launchpad/:sessionId/state', description: 'Session state with dispositions', group: 'Launchpad' },
    { method: 'POST', path: '/api/launchpad/:sessionId/disposition', description: 'Record user action', group: 'Launchpad' },
    { method: 'POST', path: '/api/launchpad/:sessionId/batch-disposition', description: 'Batch actions', group: 'Launchpad' },
    { method: 'POST', path: '/api/launchpad/:sessionId/clear-lock', description: 'Clear lock when complete', group: 'Launchpad' },
    { method: 'GET', path: '/api/tasks/candidates', description: 'Raw task candidates', group: 'Tasks' },
    { method: 'GET', path: '/api/tasks/stats', description: 'Attention stats', group: 'Tasks' },
    { method: 'GET', path: '/api/tasks/log', description: 'Task action log', group: 'Tasks' },
    { method: 'POST', path: '/api/tasks/:taskId/action', description: 'Execute task action', group: 'Tasks' },
    { method: 'GET', path: '/api/preferences', description: 'All preferences (JSON)', group: 'Preferences' },
    { method: 'POST', path: '/api/preferences/:prefId/approve', description: 'Confirm preference', group: 'Preferences' },
    { method: 'POST', path: '/api/preferences/:prefId/reject', description: 'Dismiss preference', group: 'Preferences' },
    { method: 'POST', path: '/api/workbench/rerun', description: 'Re-run pass with modified prompt', group: 'Workbench' },
  ],
  deprecated: [
    { method: 'GET', path: '/rules', description: 'Redirects to /preferences', group: 'Redirects' },
    { method: 'GET', path: '/api/rules', description: 'Alias for /api/preferences', group: 'Redirects' },
    { method: 'GET', path: '/results', description: 'Redirects to /history', group: 'Redirects' },
  ]
};

// Sprint definitions
const SPRINTS = [
  {
    id: 0, name: 'Dev Dashboard', description: 'Track development progress',
    tasks: [
      { id: '0.1', title: 'Create /dev dashboard page', status: 'completed' },
      { id: '0.2', title: 'Add feature inventory', status: 'completed' },
      { id: '0.3', title: 'Add sprint tracking', status: 'completed' },
    ]
  },
  {
    id: 1, name: 'Close the Feedback Loops', description: 'Make preference application and task actions visible to users',
    tasks: [
      { id: '1.1', title: 'Track which preferences are applied during classification', status: 'completed' },
      { id: '1.2', title: 'Show "Applied X preferences" on results summary', status: 'completed' },
      { id: '1.3', title: 'Rename rules to preferences throughout codebase', status: 'completed' },
      { id: '1.4', title: 'Track preference application counts', status: 'completed' },
      { id: '1.5', title: 'Add toast feedback for task actions', status: 'completed' },
    ]
  },
  {
    id: 2, name: 'Central Dashboard', description: 'Navigation hub showing system state',
    tasks: [
      { id: '2.1', title: 'Create dashboard page at /', status: 'completed' },
      { id: '2.2', title: 'Show lock status with resume link', status: 'completed' },
      { id: '2.3', title: 'Show active preferences summary', status: 'completed' },
      { id: '2.4', title: 'Show pending tasks count', status: 'completed' },
      { id: '2.5', title: 'Show recent sessions list', status: 'completed' },
    ]
  },
  {
    id: 3, name: 'Goal Tracking', description: 'Make goals influence system behavior',
    tasks: [
      { id: '3.1', title: 'Persist goals separately from lock', status: 'pending' },
      { id: '3.2', title: 'Pass goal to task generation', status: 'pending' },
      { id: '3.3', title: 'Show goal context in task picker', status: 'pending' },
      { id: '3.4', title: 'Goal completion flow', status: 'pending' },
    ]
  },
  {
    id: 4, name: 'Tab Annotation', description: 'Let users share intelligence about tabs',
    tasks: [
      { id: '4.1', title: 'Add annotation UI in Launchpad', status: 'pending' },
      { id: '4.2', title: 'Display annotations in tabs view', status: 'pending' },
    ]
  },
  {
    id: 5, name: 'Workbench Integration', description: 'Save prompt experiments as preferences',
    tasks: [
      { id: '5.1', title: 'Add "Save as preference" button after rerun', status: 'pending' },
      { id: '5.2', title: 'Before/after comparison view', status: 'pending' },
    ]
  },
];

// Feature inventory
const FEATURES = {
  working: [
    { name: 'Tab capture (extension)', file: 'extension/popup.js' },
    { name: 'LLM classification (4-pass)', file: 'backend/classifier.js' },
    { name: 'Session storage', file: 'backend/memory.js' },
    { name: 'Results pages (Summary, Map, Tabs, Analysis)', file: 'backend/renderers/' },
    { name: 'Launchpad forced-completion', file: 'backend/launchpad.js' },
    { name: 'Disposition tracking (append-only)', file: 'backend/dispositions.js' },
    { name: 'Lock manager', file: 'backend/lockManager.js' },
    { name: 'Task generation', file: 'backend/taskGenerator.js' },
    { name: 'Task enrichment (LLM)', file: 'backend/taskEnricher.js' },
    { name: 'Task actions with toast feedback', file: 'backend/taskActions.js' },
    { name: 'Preference injection + visibility', file: 'backend/classifier.js' },
    { name: 'Preference suggestions + management', file: 'backend/renderers/preferencesRenderer.js' },
    { name: 'Preference application tracking', file: 'backend/correctionAnalyzer.js' },
    { name: 'Workbench prompt inspection', file: 'backend/renderers/workbenchRenderer.js' },
    { name: 'Session history browsing', file: 'backend/renderers/historyRenderer.js' },
    { name: 'Central dashboard', file: 'backend/renderers/dashboardRenderer.js' },
    { name: 'MCP server integration', file: 'backend/mcp-server.js' },
  ],
  partial: [
    { name: 'Goal tracking', issue: 'Saved in lock, but never influences task generation' },
    { name: 'Mirror insights', issue: 'Displays insights, but action buttons are stubs' },
    { name: 'Tab annotation', issue: 'Disposition type exists, no UI to create annotations' },
    { name: 'Project context', issue: 'Works but requires manual JSON editing' },
  ],
  stubbed: [
    { name: 'Mirror "Block It" button', location: 'mirror.js:94' },
    { name: 'Mirror "Accept It" button', location: 'mirror.js:95' },
    { name: 'Task "Explore" action', location: 'taskActions.js:619' },
    { name: 'OpenAI model driver', location: 'models/index.js:13' },
  ]
};

/**
 * Render a route as a clickable link
 */
function renderRouteLink(route, sampleSessionId) {
  let testPath = route.path;
  if (route.path.includes(':sessionId') && sampleSessionId) {
    testPath = route.path.replace(':sessionId', sampleSessionId);
  } else if (route.path.includes(':sessionId')) {
    testPath = null;
  }
  if (route.path.includes(':prefId') || route.path.includes(':ruleId') || route.path.includes(':taskId')) {
    testPath = null;
  }

  const methodBadge = route.method === 'GET'
    ? '<span class="method-badge get">GET</span>'
    : '<span class="method-badge post">POST</span>';

  if (testPath && route.method === 'GET') {
    return `
      <div class="route-item">
        ${methodBadge}
        <a href="${testPath}" class="route-path" target="_blank">${escapeHtml(route.path)}</a>
        <span class="route-desc">${escapeHtml(route.description)}</span>
      </div>
    `;
  } else {
    return `
      <div class="route-item">
        ${methodBadge}
        <span class="route-path no-link">${escapeHtml(route.path)}</span>
        <span class="route-desc">${escapeHtml(route.description)}</span>
      </div>
    `;
  }
}

async function renderDevDashboardPage() {
  let recentSessions = [];
  try {
    recentSessions = await listSessions();
  } catch (e) {
    // Ignore
  }
  const sampleSessionId = recentSessions.length > 0 ? recentSessions[0]._id : null;

  const currentSprint = SPRINTS.find(s => s.tasks.some(t => t.status !== 'completed')) || SPRINTS[SPRINTS.length - 1];
  const completedInCurrent = currentSprint.tasks.filter(t => t.status === 'completed').length;
  const progressPct = Math.round((completedInCurrent / currentSprint.tasks.length) * 100);

  const pageCSS = `
    /* Dev dashboard dark theme overrides */
    :root {
      --bg-primary: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-card: #0f3460;
      --text-primary: #e8e8e8;
      --text-secondary: #a8a8a8;
      --text-muted: #6b6b6b;
      --accent-green: #00d26a;
      --accent-yellow: #ffc107;
      --accent-red: #ff5252;
      --accent-blue: #4a9eff;
      --accent-link: #4a9eff;
      --border-color: #2a2a4e;
      --border-light: #2a2a4e;
    }
    body {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
    }

    /* Nav dark overrides */
    .main-nav { background: var(--bg-secondary); border-bottom-color: var(--border-color); }
    .nav-brand a { color: var(--text-primary); }
    .nav-link { color: var(--text-secondary); }
    .nav-link:hover { background: rgba(255,255,255,0.05); }
    .nav-link.active { background: var(--accent-blue); color: white; }
    .dev-toggle-btn { border-color: var(--border-color); color: var(--text-muted); }

    /* Non-dev message */
    .non-dev-message {
      text-align: center;
      padding: 4em 2em;
      color: var(--text-muted);
    }
    .non-dev-message h2 {
      font-size: 1.3em;
      margin-bottom: 0.5em;
      color: var(--text-secondary);
    }
    .non-dev-message p {
      font-size: 0.95em;
    }

    /* Main content grid */
    .dev-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2em;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2em;
    }

    /* Cards */
    .dev-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5em;
    }
    .dev-card-title {
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }

    /* Current Sprint */
    .current-sprint { grid-column: 1 / -1; }
    .sprint-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5em; }
    .sprint-name { font-size: 1.3em; color: var(--accent-blue); }
    .sprint-progress { font-size: 0.9em; color: var(--accent-green); }
    .sprint-description { color: var(--text-secondary); margin-bottom: 1em; }
    .progress-bar { height: 8px; background: var(--bg-card); border-radius: 4px; overflow: hidden; margin-bottom: 1.5em; }
    .progress-fill { height: 100%; background: var(--accent-green); transition: width 0.3s ease; }

    /* Task list */
    .task-list { list-style: none; }
    .task-item { display: flex; align-items: center; gap: 0.75em; padding: 0.5em 0; border-bottom: 1px solid var(--border-color); }
    .task-item:last-child { border-bottom: none; }
    .task-status { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .task-status.completed { background: var(--accent-green); color: white; }
    .task-status.in-progress { background: var(--accent-yellow); color: black; }
    .task-status.pending { background: var(--bg-card); border: 2px solid var(--border-color); }
    .task-title { flex: 1; }
    .task-title.completed { text-decoration: line-through; color: var(--text-muted); }
    .task-id { font-size: 0.85em; color: var(--text-muted); }

    /* Feature inventory */
    .feature-section { margin-bottom: 1.5em; }
    .feature-section:last-child { margin-bottom: 0; }
    .feature-section-title { font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em; }
    .feature-section-title .count { background: var(--bg-card); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; color: var(--text-secondary); }
    .feature-section-title.working { color: var(--accent-green); }
    .feature-section-title.partial { color: var(--accent-yellow); }
    .feature-section-title.stubbed { color: var(--accent-red); }
    .feature-list { list-style: none; }
    .feature-item { padding: 0.4em 0; font-size: 0.9em; display: flex; justify-content: space-between; gap: 1em; }
    .feature-name { color: var(--text-primary); }
    .feature-location { color: var(--text-muted); font-size: 0.85em; }
    .feature-issue { color: var(--accent-yellow); font-size: 0.85em; font-style: italic; }

    /* All sprints */
    .sprint-list { list-style: none; }
    .sprint-item { padding: 0.75em 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
    .sprint-item:last-child { border-bottom: none; }
    .sprint-item-name { display: flex; align-items: center; gap: 0.5em; }
    .sprint-number { background: var(--bg-card); padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
    .sprint-item.current .sprint-number { background: var(--accent-blue); color: white; }
    .sprint-item.done .sprint-number { background: var(--accent-green); color: white; }
    .sprint-item-progress { font-size: 0.85em; color: var(--text-muted); }

    /* Quick links */
    .quick-links { display: flex; flex-wrap: wrap; gap: 0.75em; }
    .quick-link { display: inline-block; padding: 0.5em 1em; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-secondary); text-decoration: none; font-size: 0.9em; }
    .quick-link:hover { background: var(--accent-blue); color: white; border-color: var(--accent-blue); }

    /* Route Inventory */
    .route-section { margin-bottom: 1.5em; }
    .route-section-title { font-size: 1em; margin-bottom: 0.75em; display: flex; align-items: center; gap: 0.5em; }
    .route-section-title.product { color: var(--accent-green); }
    .route-section-title.developer { color: var(--accent-blue); }
    .route-section-title.api { color: var(--text-secondary); }
    .route-section-title.deprecated { color: var(--text-muted); }
    .route-section-title .count { background: var(--bg-card); padding: 2px 8px; border-radius: 12px; font-size: 0.85em; color: var(--text-secondary); }
    .route-item { display: flex; align-items: center; gap: 0.75em; padding: 0.4em 0; font-size: 0.9em; border-bottom: 1px solid var(--border-color); }
    .route-item:last-child { border-bottom: none; }
    .method-badge { font-size: 0.7em; padding: 2px 6px; border-radius: 3px; font-family: ui-monospace, monospace; font-weight: 600; width: 40px; text-align: center; }
    .method-badge.get { background: #14532d; color: #86efac; }
    .method-badge.post { background: #78350f; color: #fcd34d; }
    .route-path { font-family: ui-monospace, monospace; color: var(--accent-blue); text-decoration: none; flex-shrink: 0; min-width: 200px; }
    .route-path:hover { text-decoration: underline; }
    .route-path.no-link { color: var(--text-secondary); }
    .route-desc { color: var(--text-muted); font-size: 0.85em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sample-session-notice { font-size: 0.85em; color: var(--accent-yellow); margin-bottom: 1em; padding: 0.5em; background: rgba(245, 158, 11, 0.1); border-radius: 4px; }
    .workbench-links { margin-top: 1em; padding-top: 1em; border-top: 1px solid var(--border-color); }
    .workbench-links h4 { font-size: 0.85em; color: var(--text-muted); margin-bottom: 0.5em; }
    .workbench-session { display: flex; justify-content: space-between; align-items: center; padding: 0.4em 0; font-size: 0.9em; }
    .workbench-session-id { font-family: ui-monospace, monospace; color: var(--text-secondary); font-size: 0.85em; }
    .workbench-session a { color: var(--accent-blue); text-decoration: none; }
    .workbench-session a:hover { text-decoration: underline; }

    @media (max-width: 900px) {
      .dev-content { grid-template-columns: 1fr; }
      .current-sprint { grid-column: 1; }
    }
  `;

  const bodyContent = `
    <!-- Non-dev users see this message -->
    <div class="non-dev-message" style="display: block;">
      <h2>Developer Dashboard</h2>
      <p>Enable Developer Mode to view this page. Click the gear icon (&#9881;) in the navigation bar.</p>
    </div>
    <script>
      // Hide non-dev message when dev mode is active
      (function() {
        if (localStorage.getItem('memento-dev-mode') === 'true') {
          document.querySelector('.non-dev-message').style.display = 'none';
        }
      })();
    </script>

    <!-- Dev content -->
    <div class="dev-only-block">
      <div class="dev-content">
        <!-- Current Sprint -->
        <div class="dev-card current-sprint">
          <div class="dev-card-title">Current Sprint</div>
          <div class="sprint-header">
            <span class="sprint-name">Sprint ${currentSprint.id}: ${escapeHtml(currentSprint.name)}</span>
            <span class="sprint-progress">${progressPct}% complete</span>
          </div>
          <p class="sprint-description">${escapeHtml(currentSprint.description)}</p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPct}%"></div>
          </div>
          <ul class="task-list">
            ${currentSprint.tasks.map(task => `
              <li class="task-item">
                <span class="task-status ${task.status}">${task.status === 'completed' ? '&#10003;' : task.status === 'in-progress' ? '&#x27F3;' : ''}</span>
                <span class="task-title ${task.status}">${escapeHtml(task.title)}</span>
                <span class="task-id">${task.id}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- Feature Inventory -->
        <div class="dev-card">
          <div class="dev-card-title">Feature Inventory</div>
          <div class="feature-section">
            <div class="feature-section-title working">
              &#10003; Working <span class="count">${FEATURES.working.length}</span>
            </div>
            <ul class="feature-list">
              ${FEATURES.working.slice(0, 8).map(f => `
                <li class="feature-item">
                  <span class="feature-name">${escapeHtml(f.name)}</span>
                  <span class="feature-location">${escapeHtml(f.file)}</span>
                </li>
              `).join('')}
              ${FEATURES.working.length > 8 ? `<li class="feature-item"><span class="feature-name">... and ${FEATURES.working.length - 8} more</span></li>` : ''}
            </ul>
          </div>
          <div class="feature-section">
            <div class="feature-section-title partial">
              &#9888; Partial <span class="count">${FEATURES.partial.length}</span>
            </div>
            <ul class="feature-list">
              ${FEATURES.partial.map(f => `
                <li class="feature-item">
                  <span class="feature-name">${escapeHtml(f.name)}</span>
                  <span class="feature-issue">${escapeHtml(f.issue)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
          <div class="feature-section">
            <div class="feature-section-title stubbed">
              &#10005; Stubbed <span class="count">${FEATURES.stubbed.length}</span>
            </div>
            <ul class="feature-list">
              ${FEATURES.stubbed.map(f => `
                <li class="feature-item">
                  <span class="feature-name">${escapeHtml(f.name)}</span>
                  <span class="feature-location">${escapeHtml(f.location)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>

        <!-- All Sprints -->
        <div class="dev-card">
          <div class="dev-card-title">All Sprints</div>
          <ul class="sprint-list">
            ${SPRINTS.map(sprint => {
              const completed = sprint.tasks.filter(t => t.status === 'completed').length;
              const total = sprint.tasks.length;
              const isDone = completed === total;
              const isCurrent = sprint.id === currentSprint.id;
              return `
                <li class="sprint-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}">
                  <span class="sprint-item-name">
                    <span class="sprint-number">${sprint.id}</span>
                    ${escapeHtml(sprint.name)}
                  </span>
                  <span class="sprint-item-progress">${completed}/${total}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <!-- Route Inventory -->
        <div class="dev-card" style="grid-column: 1 / -1;">
          <div class="dev-card-title">Route Inventory</div>
          ${sampleSessionId ? `
            <div class="sample-session-notice">
              Using session <code>${sampleSessionId.slice(0, 20)}...</code> for test links.
              <a href="/history" style="color: var(--accent-blue);">Browse all sessions</a>
            </div>
          ` : `
            <div class="sample-session-notice" style="color: var(--accent-red);">
              No sessions found - capture some tabs first to test session routes.
            </div>
          `}

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2em;">
            <div>
              <div class="route-section">
                <div class="route-section-title product">
                  &#127919; Product Routes <span class="count">${ROUTES.product.length}</span>
                </div>
                ${ROUTES.product.map(r => renderRouteLink(r, sampleSessionId)).join('')}
              </div>
              <div class="route-section">
                <div class="route-section-title developer">
                  &#128295; Developer Routes <span class="count">${ROUTES.developer.length}</span>
                </div>
                ${ROUTES.developer.map(r => renderRouteLink(r, sampleSessionId)).join('')}
              </div>
            </div>
            <div>
              <div class="route-section">
                <div class="route-section-title api">
                  &#9889; API Endpoints <span class="count">${ROUTES.api.length}</span>
                </div>
                ${ROUTES.api.map(r => renderRouteLink(r, sampleSessionId)).join('')}
              </div>
              <div class="route-section">
                <div class="route-section-title deprecated">
                  &#9208; Deprecated/Redirects <span class="count">${ROUTES.deprecated.length}</span>
                </div>
                ${ROUTES.deprecated.map(r => renderRouteLink(r, sampleSessionId)).join('')}
              </div>
            </div>
          </div>

          ${recentSessions.length > 0 ? `
            <div class="workbench-links">
              <h4>&#128300; Recent Sessions for Workbench Testing</h4>
              ${recentSessions.slice(0, 3).map(s => `
                <div class="workbench-session">
                  <span class="workbench-session-id">${escapeHtml(s._id)}</span>
                  <span>
                    <a href="/workbench/${escapeHtml(s._id)}">Workbench</a> &middot;
                    <a href="/results/${escapeHtml(s._id)}">Summary</a> &middot;
                    <a href="/launchpad/${escapeHtml(s._id)}">Launchpad</a>
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Quick Links -->
        <div class="dev-card" style="grid-column: 1 / -1;">
          <div class="dev-card-title">Quick Links</div>
          <div class="quick-links">
            <a href="/" class="quick-link">&#127968; Dashboard</a>
            <a href="/history" class="quick-link">&#128220; Session History</a>
            <a href="/tasks" class="quick-link">&#9889; Task Picker</a>
            <a href="/preferences" class="quick-link">&#129504; Preferences</a>
            <a href="/api/lock-status" class="quick-link">&#128274; Lock Status (JSON)</a>
            <a href="/api/tasks/stats" class="quick-link">&#128202; Task Stats (JSON)</a>
            <a href="/api/preferences" class="quick-link">&#128203; Preferences API (JSON)</a>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapInLayout(bodyContent, {
    currentPage: 'dev',
    title: 'Dev Dashboard',
    fullWidth: true,
    extraHead: pageCSS
  });
}

module.exports = { renderDevDashboardPage };
