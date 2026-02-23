/**
 * Dashboard Renderer - Central Navigation Hub
 * Shows system state at a glance: lock status, preferences, tasks, recent sessions
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Format relative time
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Render the main dashboard page
 */
function renderDashboardPage({ lockStatus, preferences, taskStats, recentSessions }) {
  const hasActiveLock = lockStatus && lockStatus.locked;
  const approvedPrefs = preferences?.approved || [];
  const pendingPrefs = preferences?.pending || [];
  const topTasks = taskStats?.ghostTabCount || 0;

  const pageCSS = `
    .welcome-text {
      color: var(--text-muted);
      margin-bottom: 2em;
    }

    /* Dashboard grid */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5em;
    }
    @media (max-width: 700px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Cards - dashboard overrides */
    .card .card-header {
      padding-bottom: 0.75em;
      border-bottom: 1px solid var(--border-light);
      margin-bottom: 1em;
    }
    .card-title {
      display: flex;
      align-items: center;
      gap: 0.5em;
      font-weight: 600;
      font-size: 0.95em;
    }
    .card-title .icon {
      font-size: 1.2em;
    }
    .card-action {
      font-size: 0.85em;
      color: var(--accent-link);
      text-decoration: none;
    }
    .card-action:hover {
      text-decoration: underline;
    }

    /* Lock status card */
    .lock-card.active {
      border-left: 4px solid #dc2626;
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    }
    .lock-info {
      display: flex;
      flex-direction: column;
      gap: 0.5em;
    }
    .lock-session {
      font-weight: 500;
    }
    .lock-time {
      font-size: 0.9em;
      color: var(--text-muted);
    }
    .lock-goal {
      font-style: italic;
      color: var(--text-secondary);
      margin-top: 0.5em;
      padding: 0.5em;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
    }
    .resume-btn {
      display: inline-block;
      margin-top: 1em;
      padding: 0.6em 1.2em;
      background: #dc2626;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .resume-btn:hover {
      background: #b91c1c;
    }
    .no-lock {
      color: var(--text-muted);
      font-style: italic;
    }

    /* Preferences card */
    .pref-list {
      list-style: none;
    }
    .pref-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .pref-item:last-child {
      border-bottom: none;
    }
    .pref-domain {
      font-family: ui-monospace, monospace;
      font-size: 0.9em;
    }
    .pref-usage {
      font-size: 0.8em;
      color: #166534;
      background: #dcfce7;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .pending-badge {
      background: #fef3c7;
      color: #ca8a04;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
    }

    /* Tasks card */
    .task-stats {
      display: flex;
      gap: 1.5em;
      margin-bottom: 1em;
    }
    .task-stat {
      text-align: center;
    }
    .task-stat-value {
      font-size: 1.8em;
      font-weight: 600;
      color: var(--accent-blue);
    }
    .task-stat-label {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .start-tasks-btn {
      display: block;
      text-align: center;
      padding: 0.75em;
      background: var(--text-primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }
    .start-tasks-btn:hover {
      background: #333;
    }

    /* Sessions card */
    .session-list {
      list-style: none;
    }
    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .session-item:last-child {
      border-bottom: none;
    }
    .session-info {
      display: flex;
      flex-direction: column;
    }
    .session-time {
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    .session-tabs {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .session-link {
      font-size: 0.85em;
      color: var(--accent-link);
      text-decoration: none;
    }
    .session-link:hover {
      text-decoration: underline;
    }

    /* Full width cards */
    .card.full-width {
      grid-column: 1 / -1;
    }

    /* Ghost Tabs Card */
    .ghost-tabs-card.has-ghosts {
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-color: #fca5a5;
      border-left: 4px solid #ef4444;
    }
    .ghost-highlight {
      display: flex;
      align-items: baseline;
      gap: 0.75em;
      margin-bottom: 0.75em;
    }
    .ghost-count {
      font-size: 3em;
      font-weight: 700;
      color: #dc2626;
      line-height: 1;
    }
    .ghost-label {
      font-size: 1.1em;
      color: #991b1b;
      font-weight: 500;
    }
    .ghost-hint {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .ghost-action {
      background: #dc2626 !important;
    }
    .ghost-action:hover {
      background: #b91c1c !important;
    }
    .ghost-clear {
      display: flex;
      align-items: center;
      gap: 0.75em;
      color: #166534;
    }
    .ghost-clear-icon {
      font-size: 1.5em;
    }
    .ghost-clear p {
      margin: 0;
      color: var(--text-muted);
    }

`;

  const bodyContent = `
    <div class="page-content full-width" style="max-width: 55em;">
      <h1>Welcome Back</h1>
      <p class="page-subtitle">Your attention at a glance</p>

      <div class="dashboard-grid">
        <!-- Lock Status Card -->
        <div class="card lock-card ${hasActiveLock ? 'active' : ''}">
          <div class="card-header">
            <span class="card-title">
              <span class="icon">${hasActiveLock ? '&#128274;' : '&#128275;'}</span>
              Session Lock
            </span>
          </div>
          ${hasActiveLock ? `
            <div class="lock-info">
              <span class="lock-session">Active session in progress</span>
              <span class="lock-time">Started ${formatRelativeTime(lockStatus.lockedAt)}</span>
              ${lockStatus.resumeState?.goal ? `
                <div class="lock-goal">"${escapeHtml(lockStatus.resumeState.goal)}"</div>
              ` : ''}
              <a href="/launchpad/${escapeHtml(lockStatus.sessionId)}" class="resume-btn">Resume Launchpad</a>
            </div>
          ` : `
            <p class="no-lock">No active session lock. Capture new tabs to start.</p>
          `}
        </div>

        <!-- Preferences Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <span class="icon">&#129504;</span>
              Learned Preferences
            </span>
            <a href="/preferences" class="card-action">Manage</a>
          </div>
          ${approvedPrefs.length > 0 || pendingPrefs.length > 0 ? `
            <ul class="pref-list">
              ${approvedPrefs.slice(0, 3).map(p => `
                <li class="pref-item">
                  <span class="pref-domain">${escapeHtml(p.domain)}</span>
                  ${p.applicationCount ? `<span class="pref-usage">${p.applicationCount} uses</span>` : ''}
                </li>
              `).join('')}
              ${pendingPrefs.length > 0 ? `
                <li class="pref-item">
                  <span class="pref-domain">${pendingPrefs.length} suggestion${pendingPrefs.length !== 1 ? 's' : ''} waiting</span>
                  <span class="pending-badge">Review</span>
                </li>
              ` : ''}
            </ul>
            ${approvedPrefs.length > 3 ? `
              <p style="font-size: 0.85em; color: var(--text-muted); margin-top: 0.5em;">
                +${approvedPrefs.length - 3} more preferences
              </p>
            ` : ''}
          ` : `
            <p class="no-lock">No preferences yet. Make corrections in Launchpad to teach Memento.</p>
          `}
        </div>

        <!-- Ghost Tabs Card -->
        <div class="card ghost-tabs-card ${(taskStats?.ghostTabCount || 0) > 0 ? 'has-ghosts' : ''}">
          <div class="card-header">
            <span class="card-title">
              <span class="icon">&#128123;</span>
              Ghost Tabs
            </span>
            ${(taskStats?.ghostTabCount || 0) > 0 ? `
              <a href="/tasks" class="card-action">Address them</a>
            ` : ''}
          </div>
          ${(taskStats?.ghostTabCount || 0) > 0 ? `
            <div class="ghost-highlight">
              <div class="ghost-count">${taskStats.ghostTabCount}</div>
              <div class="ghost-label">tabs you keep avoiding</div>
            </div>
            <p class="ghost-hint">These tabs have appeared in multiple sessions but never been acted on.</p>
            <a href="/tasks" class="start-tasks-btn ghost-action">See What You're Avoiding</a>
          ` : `
            <div class="ghost-clear">
              <span class="ghost-clear-icon">&#10003;</span>
              <p>No ghost tabs. You're addressing things promptly!</p>
            </div>
          `}
        </div>

        <!-- Other Tasks Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <span class="icon">&#9889;</span>
              Other Attention Items
            </span>
          </div>
          <div class="task-stats">
            <div class="task-stat">
              <div class="task-stat-value">${taskStats?.neglectedProjectCount || 0}</div>
              <div class="task-stat-label">Neglected Projects</div>
            </div>
            <div class="task-stat">
              <div class="task-stat-value">${taskStats?.totalSessions || 0}</div>
              <div class="task-stat-label">Sessions Analyzed</div>
            </div>
          </div>
          ${(taskStats?.neglectedProjectCount || 0) > 0 ? `
            <a href="/tasks" class="start-tasks-btn">Start Task Flow</a>
          ` : `
            <p class="no-lock">All caught up!</p>
          `}
        </div>

        <!-- Recent Sessions Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <span class="icon">&#128202;</span>
              Recent Sessions
            </span>
            <a href="/history" class="card-action">View All</a>
          </div>
          ${recentSessions && recentSessions.length > 0 ? `
            <ul class="session-list">
              ${recentSessions.slice(0, 4).map(s => `
                <li class="session-item">
                  <div class="session-info">
                    <span class="session-time">${formatDate(s.timestamp)}</span>
                    <span class="session-tabs">${s.tabCount || '?'} tabs</span>
                  </div>
                  <a href="/results/${escapeHtml(s.id)}" class="session-link">View</a>
                </li>
              `).join('')}
            </ul>
          ` : `
            <p class="no-lock">No sessions yet. Capture your first set of tabs to start!</p>
          `}
        </div>
      </div>

    </div>
  `;

  return wrapInLayout(bodyContent, {
    sessionId: null,
    currentPage: 'dashboard',
    title: 'Dashboard',
    fullWidth: true,
    extraHead: pageCSS
  });
}

module.exports = { renderDashboardPage };
