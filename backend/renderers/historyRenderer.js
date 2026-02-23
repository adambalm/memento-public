/**
 * History Renderer - Session Browser
 * Lists all past sessions with search and quick stats
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown date';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * Get relative time (e.g., "2 hours ago", "3 days ago")
 */
function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

/**
 * Get pattern badge class
 */
function getPatternClass(pattern) {
  if (!pattern) return 'pattern-unknown';
  const p = pattern.toLowerCase();
  if (p.includes('research')) return 'pattern-research';
  if (p.includes('output') || p.includes('focused')) return 'pattern-focused';
  if (p.includes('balanced')) return 'pattern-balanced';
  if (p.includes('scattered')) return 'pattern-scattered';
  return 'pattern-other';
}

/**
 * Build pagination controls HTML
 */
function buildPagination(currentPage, totalPages, searchQuery) {
  const qParam = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
  const link = (p, label, extraClass = '') => {
    if (p < 1 || p > totalPages) return `<span class="disabled">${label}</span>`;
    if (p === currentPage) return `<span class="current">${label}</span>`;
    return `<a href="/history?page=${p}${qParam}"${extraClass ? ` class="${extraClass}"` : ''}>${label}</a>`;
  };

  const parts = [];
  parts.push(link(currentPage - 1, 'Prev'));

  // Show first, last, current, and neighbors
  const show = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  let prev = 0;
  for (const p of [...show].sort((a, b) => a - b)) {
    if (p < 1 || p > totalPages) continue;
    if (prev && p - prev > 1) parts.push('<span>...</span>');
    parts.push(link(p, String(p)));
    prev = p;
  }

  parts.push(link(currentPage + 1, 'Next'));
  return `<div class="pagination">${parts.join('')}</div>`;
}

/**
 * Render the history page
 * @param {Array} sessions - All sessions (already sorted newest-first)
 * @param {string|null} searchQuery - Active search query
 * @param {number} page - Current page (1-based)
 */
function renderHistoryPage(sessions, searchQuery = null, page = 1) {
  const PAGE_SIZE = 30;
  const totalSessions = sessions.length;
  const totalTabs = sessions.reduce((sum, s) => sum + (s.tabCount || 0), 0);
  const totalPages = Math.ceil(totalSessions / PAGE_SIZE);
  const currentPage = Math.max(1, Math.min(page, totalPages || 1));

  // Paginate sessions
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const visibleSessions = sessions.slice(startIdx, startIdx + PAGE_SIZE);

  // Group visible sessions by date
  const groupedByDate = {};
  visibleSessions.forEach(session => {
    const date = session.timestamp ? new Date(session.timestamp).toDateString() : 'Unknown';
    if (!groupedByDate[date]) groupedByDate[date] = [];
    groupedByDate[date].push(session);
  });

  const pageCss = `
    .stats-summary {
      display: flex;
      gap: 2em;
      font-size: 0.95em;
      color: var(--text-muted);
      margin-bottom: 1.5em;
    }
    .stats-summary strong {
      color: var(--text-primary);
    }

    /* Search */
    .search-bar {
      margin-bottom: 2em;
    }
    .search-input {
      width: 100%;
      max-width: 400px;
      padding: 0.6em 1em;
      font-family: inherit;
      font-size: 1em;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      background: white;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--text-muted);
    }

    /* Date groups */
    .date-group {
      margin-bottom: 2em;
    }
    .date-header {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid var(--border-light);
      margin-bottom: 0.75em;
    }

    /* Session cards */
    .session-list {
      list-style: none;
    }
    .session-item {
      display: block;
      padding: 1em;
      margin-bottom: 0.75em;
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .session-item:hover {
      border-color: var(--text-muted);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      text-decoration: none;
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5em;
    }
    .session-time {
      font-size: 0.95em;
      color: var(--text-secondary);
    }
    .session-relative {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .session-meta {
      display: flex;
      gap: 0.75em;
      align-items: center;
    }
    .session-tabs {
      font-family: system-ui, sans-serif;
      font-size: 0.85em;
      background: var(--bg-secondary);
      padding: 2px 8px;
      border-radius: 10px;
      color: var(--text-muted);
    }
    .session-pattern {
      font-family: system-ui, sans-serif;
      font-size: 0.8em;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: lowercase;
    }
    .pattern-research { background: #dbeafe; color: #1e40af; }
    .pattern-focused { background: #dcfce7; color: #166534; }
    .pattern-balanced { background: #fef3c7; color: #92400e; }
    .pattern-scattered { background: #fee2e2; color: #991b1b; }
    .pattern-other { background: #f3f4f6; color: #4b5563; }
    .pattern-unknown { background: #f3f4f6; color: #9ca3af; }

    .session-narrative {
      font-size: 0.9em;
      color: var(--text-secondary);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 4em 2em;
      color: var(--text-muted);
    }
    .empty-state h2 {
      font-weight: 400;
      margin-bottom: 0.5em;
    }

    /* Search results */
    .search-results-info {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .clear-search {
      color: var(--accent-link);
      text-decoration: none;
      margin-left: 0.5em;
    }
    .clear-search:hover {
      text-decoration: underline;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5em;
      margin-top: 2em;
      padding-top: 1.5em;
      border-top: 1px solid var(--border-light);
      font-family: system-ui, sans-serif;
      font-size: 0.9em;
    }
    .pagination a, .pagination span {
      display: inline-block;
      padding: 0.4em 0.9em;
      border-radius: 4px;
      text-decoration: none;
    }
    .pagination a {
      border: 1px solid var(--border-light);
      color: var(--text-secondary);
    }
    .pagination a:hover {
      background: var(--bg-secondary);
      text-decoration: none;
    }
    .pagination .current {
      background: var(--text-primary);
      color: white;
      border: 1px solid var(--text-primary);
    }
    .pagination .disabled {
      color: var(--border-light);
      pointer-events: none;
    }
    .pagination-info {
      text-align: center;
      font-size: 0.85em;
      color: var(--text-muted);
      margin-top: 0.5em;
    }
  `;

  const bodyContent = sessions.length > 0 ? `
    <div class="page-content">
      <h1>Session History</h1>
      <p class="page-subtitle">All captured sessions</p>

      <div class="stats-summary">
        <span><strong>${totalSessions}</strong> sessions</span>
        <span><strong>${totalTabs.toLocaleString()}</strong> total tabs analyzed</span>
      </div>

      <div class="search-bar">
        <form action="/history" method="get">
          <input
            type="text"
            name="q"
            class="search-input"
            placeholder="Search sessions..."
            value="${escapeHtml(searchQuery || '')}"
          />
        </form>
      </div>

      ${searchQuery ? `
        <div class="search-results-info">
          Showing results for "${escapeHtml(searchQuery)}"
          <a href="/history" class="clear-search">Clear</a>
        </div>
      ` : ''}

      ${Object.entries(groupedByDate).map(([date, dateSessions]) => `
        <div class="date-group">
          <div class="date-header">${date}</div>
          <ul class="session-list">
            ${dateSessions.map(session => `
              <a href="/results/${escapeHtml(session.id)}" class="session-item">
                <div class="session-header">
                  <div>
                    <span class="session-time">${formatTimestamp(session.timestamp)}</span>
                    <span class="session-relative">${getRelativeTime(session.timestamp)}</span>
                  </div>
                  <div class="session-meta">
                    <span class="session-tabs">${session.tabCount} tabs</span>
                    ${session.sessionPattern ? `
                      <span class="session-pattern ${getPatternClass(session.sessionPattern)}">${escapeHtml(session.sessionPattern)}</span>
                    ` : ''}
                  </div>
                </div>
                ${session.narrative ? `
                  <div class="session-narrative">${escapeHtml(session.narrative)}</div>
                ` : ''}
              </a>
            `).join('')}
          </ul>
        </div>
      `).join('')}

      ${totalPages > 1 ? buildPagination(currentPage, totalPages, searchQuery) : ''}
      ${totalPages > 1 ? `<div class="pagination-info">Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalSessions)} of ${totalSessions} sessions</div>` : ''}
    </div>
  ` : `
    <div class="page-content">
      <h1>Session History</h1>
      <p class="page-subtitle">All captured sessions</p>
      <div class="empty-state">
        <h2>No sessions yet</h2>
        <p>Capture your first browser session using the Memento extension.</p>
      </div>
    </div>
  `;

  return wrapInLayout(bodyContent, {
    currentPage: 'history',
    title: 'Session History',
    extraHead: pageCss
  });
}

module.exports = { renderHistoryPage };
