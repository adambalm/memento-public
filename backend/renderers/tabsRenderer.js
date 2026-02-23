/**
 * Tabs Renderer - Grouped Tabs Screen
 * List view with filter, sort, and inline info
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Get category badge class
 */
function getCategoryBadgeClass(category) {
  const lower = category.toLowerCase();
  if (lower.includes('research') || lower.includes('academic')) return 'badge-research';
  if (lower.includes('development') || lower.includes('dev')) return 'badge-development';
  if (lower.includes('productivity') || lower.includes('work')) return 'badge-productivity';
  if (lower.includes('social') || lower.includes('media')) return 'badge-social';
  return 'badge-other';
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Render the tabs list page
 */
function renderTabsPage(sessionData, sessionId, filterCategory = null) {
  const { groups, totalTabs, timestamp, reasoning, _dispositions, _trashedItems, _completedItems } = sessionData;
  const perTabReasoning = reasoning?.perTab || {};

  // Get all categories for filter dropdown
  const categories = Object.keys(groups || {}).sort();

  // Filter groups if category specified
  const displayGroups = filterCategory
    ? { [filterCategory]: groups[filterCategory] || [] }
    : groups;

  // Count duplicates across session
  const urlCounts = {};
  Object.values(groups || {}).flat().forEach(tab => {
    if (tab.url) {
      urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
    }
  });

  const extraStyles = `
    .tabs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5em;
      flex-wrap: wrap;
      gap: 1em;
    }

    .filter-controls {
      display: flex;
      gap: 1em;
      align-items: center;
    }
    .filter-controls label {
      font-size: 0.9em;
      color: var(--text-muted);
    }
    .filter-controls select {
      padding: 0.4em 0.8em;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      background: white;
    }

    .category-section {
      margin-bottom: 2em;
    }
    .category-header {
      display: flex;
      align-items: center;
      gap: 0.75em;
      padding: 0.5em 0;
      border-bottom: 2px solid var(--border-light);
      margin-bottom: 0.5em;
      cursor: pointer;
    }
    .category-header:hover {
      color: var(--accent-link);
    }
    .category-name {
      font-size: 1.1em;
      font-weight: 500;
    }
    .category-toggle {
      color: var(--text-muted);
      font-size: 0.8em;
    }

    .tab-list {
      list-style: none;
    }
    .tab-item {
      padding: 0.75em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .tab-item:last-child {
      border-bottom: none;
    }

    .tab-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1em;
    }
    .tab-info {
      flex: 1;
      min-width: 0;
    }
    .tab-title {
      display: block;
      font-size: 1em;
      margin-bottom: 0.25em;
      word-break: break-word;
    }
    .tab-meta {
      display: flex;
      gap: 1em;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .tab-domain {
      color: var(--text-secondary);
    }
    .tab-duplicate {
      color: #b45309;
      font-weight: 500;
    }

    .tab-signals {
      flex-shrink: 0;
      text-align: right;
    }
    .confidence {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.8em;
      font-family: system-ui, sans-serif;
    }
    .confidence-high { background: #dcfce7; color: #166534; }
    .confidence-medium { background: #fef3c7; color: #92400e; }
    .confidence-low { background: #fee2e2; color: #991b1b; }
    .confidence-unknown { background: #f3f4f6; color: #6b7280; }

    .tab-reasoning {
      margin-top: 0.5em;
      padding: 0.5em 0.75em;
      background: var(--bg-secondary);
      border-radius: 4px;
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    .tab-reasoning summary {
      cursor: pointer;
      color: var(--text-muted);
    }

    .tab-regrouped {
      font-size: 0.8em;
      color: #2563eb;
      font-style: italic;
    }

    .resolved-section {
      margin-top: 2em;
      padding-top: 1.5em;
      border-top: 1px solid var(--border-light);
    }
    .resolved-section h2 {
      font-size: 1.1em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .resolved-tabs {
      opacity: 0.6;
    }
    .resolved-tabs .tab-item {
      padding: 0.5em 0;
    }
    .resolved-badge {
      font-size: 0.75em;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 0.5em;
    }
    .resolved-badge.completed { background: #dcfce7; color: #166534; }
    .resolved-badge.trashed { background: #fee2e2; color: #991b1b; }

    .stats-bar {
      display: flex;
      gap: 2em;
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .stat-item strong {
      color: var(--text-primary);
    }
  `;

  const extraScripts = `
    <script>
      function filterByCategory(category) {
        if (category) {
          window.location.href = '/results/${sessionId}/tabs?filter=' + encodeURIComponent(category);
        } else {
          window.location.href = '/results/${sessionId}/tabs';
        }
      }

      function toggleCategory(id) {
        const list = document.getElementById(id);
        const toggle = document.querySelector('[data-toggle="' + id + '"]');
        if (list.style.display === 'none') {
          list.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          list.style.display = 'none';
          toggle.textContent = '▶';
        }
      }
    </script>
  `;

  // Count stats
  const totalDisplayed = Object.values(displayGroups).reduce((sum, tabs) => sum + tabs.length, 0);
  const duplicateCount = Object.values(urlCounts).filter(c => c > 1).length;
  const domainCounts = {};
  Object.values(groups || {}).flat().forEach(tab => {
    const domain = extractDomain(tab.url);
    if (domain) domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });
  const topDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0];

  const content = `
    <div class="page-content">
      <div class="tabs-header">
        <h1>${filterCategory ? escapeHtml(filterCategory) : 'All Tabs'}</h1>
        <div class="filter-controls">
          <label>Filter:</label>
          <select onchange="filterByCategory(this.value)">
            <option value="">All Categories</option>
            ${categories.map(cat => `
              <option value="${escapeHtml(cat)}" ${filterCategory === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="stats-bar">
        <span class="stat-item"><strong>${totalDisplayed}</strong> tabs${filterCategory ? ` in ${escapeHtml(filterCategory)}` : ''}</span>
        ${duplicateCount > 0 ? `<span class="stat-item"><strong>${duplicateCount}</strong> duplicates</span>` : ''}
        ${topDomain ? `<span class="stat-item">Most common: <strong>${topDomain[0]}</strong> (${topDomain[1]})</span>` : ''}
      </div>

      ${Object.entries(displayGroups).map(([category, tabs]) => {
        const catId = 'cat-' + category.replace(/[^a-zA-Z0-9]/g, '-');
        return `
          <div class="category-section">
            <div class="category-header" onclick="toggleCategory('${catId}')">
              <span class="category-toggle" data-toggle="${catId}">▼</span>
              <span class="category-name">${escapeHtml(category)}</span>
              <span class="badge ${getCategoryBadgeClass(category)}">${tabs.length}</span>
            </div>
            <ul class="tab-list" id="${catId}">
              ${tabs.map(tab => {
                const r = perTabReasoning[tab.tabIndex] || {};
                const signals = r.signals || [];
                const confidence = r.confidence || 'unknown';
                const domain = extractDomain(tab.url);
                const isDuplicate = urlCounts[tab.url] > 1;

                return `
                  <li class="tab-item">
                    <div class="tab-main">
                      <div class="tab-info">
                        <a href="${escapeHtml(tab.url)}" target="_blank" class="tab-title">${escapeHtml(tab.title || 'Untitled')}</a>
                        <div class="tab-meta">
                          <span class="tab-domain">${escapeHtml(domain)}</span>
                          ${isDuplicate ? `<span class="tab-duplicate">open ${urlCounts[tab.url]}x</span>` : ''}
                          ${tab._regroupedFrom ? `<span class="tab-regrouped">moved from ${escapeHtml(tab._regroupedFrom)}</span>` : ''}
                        </div>
                      </div>
                      <div class="tab-signals">
                        <span class="confidence confidence-${confidence}">${confidence}</span>
                      </div>
                    </div>
                    ${signals.length > 0 ? `
                      <details class="tab-reasoning">
                        <summary>Why ${escapeHtml(category)}?</summary>
                        <p>${signals.map(s => escapeHtml(s)).join(', ')}</p>
                      </details>
                    ` : ''}
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        `;
      }).join('')}

      ${(_completedItems && _completedItems.length > 0) || (_trashedItems && _trashedItems.length > 0) ? `
        <details class="resolved-section">
          <summary style="cursor: pointer; color: var(--text-muted);">
            ${(_completedItems?.length || 0) + (_trashedItems?.length || 0)} resolved items
          </summary>

          ${_completedItems && _completedItems.length > 0 ? `
            <div class="resolved-tabs" style="margin-top: 1em;">
              <h3 style="font-size: 0.95em; color: #166534; margin-bottom: 0.5em;">Completed (${_completedItems.length})</h3>
              <ul class="tab-list">
                ${_completedItems.map(tab => `
                  <li class="tab-item">
                    <a href="${escapeHtml(tab.url)}" target="_blank" class="tab-title">${escapeHtml(tab.title || 'Untitled')}</a>
                    <span class="resolved-badge completed">completed</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${_trashedItems && _trashedItems.length > 0 ? `
            <div class="resolved-tabs" style="margin-top: 1em;">
              <h3 style="font-size: 0.95em; color: #991b1b; margin-bottom: 0.5em;">Trashed (${_trashedItems.length})</h3>
              <ul class="tab-list">
                ${_trashedItems.map(tab => `
                  <li class="tab-item">
                    <a href="${escapeHtml(tab.url)}" target="_blank" class="tab-title">${escapeHtml(tab.title || 'Untitled')}</a>
                    <span class="resolved-badge trashed">trashed</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </details>
      ` : ''}
    </div>
  `;

  return wrapInLayout(content, {
    sessionId,
    currentPage: 'tabs',
    title: filterCategory || 'All Tabs',
    sessionData: { totalTabs, timestamp },
    extraHead: extraStyles,
    extraScripts
  });
}

module.exports = { renderTabsPage };
