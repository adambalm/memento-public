/**
 * Shared Layout Module
 * Common HTML structure, CSS, and navigation for all screens
 *
 * Navigation tiers:
 * - Global links: always shown (Dashboard, History, Tasks, Preferences)
 * - Session links: shown when sessionId present (Summary, Map, Tabs, Analysis)
 * - Dev-only links: shown when dev mode enabled (Dev, Workbench)
 */

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the navigation header with two tiers
 * @param {Object} options
 * @param {string|null} options.sessionId - Session ID for session-scoped links
 * @param {string} options.currentPage - Active page identifier for highlighting
 * @param {Object} options.sessionData - Session metadata (totalTabs, timestamp)
 */
function renderNav({ sessionId = null, currentPage = '', sessionData = {} } = {}) {
  const globalLinks = [
    { id: 'dashboard', label: 'Dashboard', path: '/' },
    { id: 'history', label: 'History', path: '/history' },
    { id: 'tasks', label: 'Tasks', path: '/tasks' },
    { id: 'intentions', label: 'Intentions', path: '/intentions' },
    { id: 'preferences', label: 'Preferences', path: '/preferences' },
  ];

  const sessionLinks = sessionId ? [
    { id: 'summary', label: 'Summary', path: `/results/${sessionId}` },
    { id: 'map', label: 'Map', path: `/results/${sessionId}/map` },
    { id: 'tabs', label: 'Tabs', path: `/results/${sessionId}/tabs` },
    { id: 'analysis', label: 'Analysis', path: `/results/${sessionId}/analysis` },
  ] : [];

  const devLinks = [
    { id: 'dev', label: 'Dev', path: '/dev' },
  ];
  if (sessionId) {
    devLinks.push({ id: 'workbench', label: 'Workbench', path: `/workbench/${sessionId}` });
  }

  const sessionInfoHtml = sessionId && sessionData.totalTabs
    ? `<span class="nav-session-info">${sessionData.totalTabs || '?'} tabs · ${formatDate(sessionData.timestamp)}</span>`
    : '';

  return `
    <nav class="main-nav">
      <div class="nav-brand">
        <a href="/">Memento</a>
        ${sessionInfoHtml}
      </div>
      <div class="nav-links">
        ${globalLinks.map(p => `
          <a href="${p.path}" class="nav-link ${currentPage === p.id ? 'active' : ''}">${p.label}</a>
        `).join('')}
        ${devLinks.map(p => `
          <a href="${p.path}" class="nav-link dev-only ${currentPage === p.id ? 'active' : ''}">${p.label}</a>
        `).join('')}
      </div>
      <div class="nav-actions">
        ${sessionId ? `<a href="/launchpad/${sessionId}" class="nav-btn">Launchpad</a>` : ''}
        <button class="dev-toggle-btn" onclick="toggleDevMode()" title="Toggle Developer Mode">&#9881;</button>
      </div>
    </nav>
    ${sessionLinks.length > 0 ? `
    <nav class="session-nav">
      <div class="session-nav-links">
        ${sessionLinks.map(p => `
          <a href="${p.path}" class="nav-link ${currentPage === p.id ? 'active' : ''}">${p.label}</a>
        `).join('')}
      </div>
    </nav>
    ` : ''}
  `;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Wrap content in the standard page layout
 *
 * Backward-compatible: accepts either:
 *   wrapInLayout(content, { sessionId, currentPage, ... })
 *   wrapInLayout(content, sessionId)  // legacy string form
 */
function wrapInLayout(content, optionsOrSessionId) {
  // Backward compatibility: detect string second arg (legacy call pattern)
  let options;
  if (typeof optionsOrSessionId === 'string') {
    options = { sessionId: optionsOrSessionId };
  } else {
    options = optionsOrSessionId || {};
  }

  const {
    sessionId = null,
    currentPage = '',
    title = 'Memento',
    sessionData = {},
    extraHead = '',
    extraScripts = '',
    fullWidth = false
  } = options;

  const contentClass = fullWidth ? 'page-content full-width' : 'page-content';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Memento</title>
  <style>
    :root {
      --bg-primary: #fffff8;
      --bg-secondary: #f9f9f5;
      --text-primary: #111111;
      --text-secondary: #454545;
      --text-muted: #6b6b6b;
      --accent-link: #a00000;
      --accent-blue: #2563eb;
      --border-light: #e0ddd5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Palatino, "Palatino Linotype", Georgia, serif;
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-primary);
      background: var(--bg-primary);
    }

    /* Navigation - Primary */
    .main-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75em 2em;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-light);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .nav-brand {
      display: flex;
      align-items: baseline;
      gap: 1em;
    }
    .nav-brand a {
      font-size: 1.2em;
      font-weight: 600;
      font-style: italic;
      color: var(--text-primary);
      text-decoration: none;
    }
    .nav-session-info {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .nav-links {
      display: flex;
      gap: 0.25em;
    }
    .nav-link {
      padding: 0.4em 0.8em;
      color: var(--text-secondary);
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .nav-link:hover {
      background: rgba(0,0,0,0.05);
    }
    .nav-link.active {
      background: var(--text-primary);
      color: white;
    }
    .nav-actions {
      display: flex;
      gap: 0.5em;
      align-items: center;
    }
    .nav-btn {
      padding: 0.4em 1em;
      background: var(--text-primary);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .nav-btn:hover {
      background: #333;
    }

    /* Dev mode toggle button */
    .dev-toggle-btn {
      background: none;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      padding: 0.3em 0.5em;
      font-size: 1em;
      cursor: pointer;
      color: var(--text-muted);
      line-height: 1;
    }
    .dev-toggle-btn:hover {
      background: rgba(0,0,0,0.05);
      color: var(--text-secondary);
    }
    body.dev-mode .dev-toggle-btn {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    /* Navigation - Session tier */
    .session-nav {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-light);
      padding: 0 2em;
      position: sticky;
      top: 3em;
      z-index: 99;
    }
    .session-nav-links {
      display: flex;
      gap: 0.25em;
      padding: 0.25em 0 0.5em 0;
    }

    /* Developer mode visibility */
    .dev-only { display: none; }
    body.dev-mode .dev-only { display: inline; }
    .dev-only-block { display: none; }
    body.dev-mode .dev-only-block { display: block; }
    .dev-only-flex { display: none; }
    body.dev-mode .dev-only-flex { display: flex; }

    /* Main content area */
    .page-content {
      max-width: 55em;
      margin: 0 auto;
      padding: 2em;
    }
    .page-content.full-width {
      max-width: none;
      padding: 1em 2em;
    }

    /* Page subtitle */
    .page-subtitle {
      color: var(--text-muted);
      font-size: 0.95em;
      margin-top: -0.25em;
      margin-bottom: 1.5em;
    }

    /* Common elements */
    h1 {
      font-weight: 400;
      font-style: italic;
      font-size: 1.8em;
      margin-bottom: 0.5em;
    }
    h2 {
      font-weight: 400;
      font-style: italic;
      font-size: 1.4em;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    h3 {
      font-weight: 400;
      font-style: italic;
      font-size: 1.1em;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    a { color: var(--accent-link); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Cards */
    .card {
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.25em;
      margin-bottom: 1em;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75em;
    }
    .card-title {
      font-weight: 600;
      font-size: 1em;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8em;
      font-family: system-ui, sans-serif;
    }
    .badge-count {
      background: var(--bg-secondary);
      color: var(--text-muted);
    }
    .badge-research { background: #dbeafe; color: #1e40af; }
    .badge-development { background: #dcfce7; color: #166534; }
    .badge-productivity { background: #fef3c7; color: #92400e; }
    .badge-social { background: #fce7f3; color: #9d174d; }
    .badge-other { background: #f3f4f6; color: #4b5563; }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4em;
      padding: 0.5em 1em;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-primary {
      background: var(--text-primary);
      color: white;
    }
    .btn-primary:hover {
      background: #333;
      text-decoration: none;
    }
    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-light);
    }
    .btn-secondary:hover {
      background: #eee;
      text-decoration: none;
    }

    /* Empty states */
    .empty-state {
      text-align: center;
      padding: 3em;
      color: var(--text-muted);
    }
    .empty-state-icon {
      font-size: 2em;
      margin-bottom: 0.5em;
    }

    ${extraHead}
  </style>
</head>
<body>
  ${renderNav({ sessionId, currentPage, sessionData })}
  ${content}
  ${extraScripts}
  <script>
    // Developer Mode infrastructure
    (function() {
      var params = new URLSearchParams(window.location.search);
      if (params.get('devMode') === '1') {
        localStorage.setItem('memento-dev-mode', 'true');
      } else if (params.get('devMode') === '0') {
        localStorage.removeItem('memento-dev-mode');
      }
      if (localStorage.getItem('memento-dev-mode') === 'true') {
        document.body.classList.add('dev-mode');
      }
    })();
    function toggleDevMode() {
      if (localStorage.getItem('memento-dev-mode') === 'true') {
        localStorage.removeItem('memento-dev-mode');
      } else {
        localStorage.setItem('memento-dev-mode', 'true');
      }
      location.reload();
    }
  </script>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderNav,
  wrapInLayout,
  formatDate
};
