/**
 * Summary Renderer - Hub Screen
 * Bird's eye view of the session with paths to deeper information
 *
 * INLINE INSPECTION: LLM-generated elements are marked with .inspectable
 * Click to see the prompt that generated them
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Get category badge class based on category name
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
 * Wrap content in an inspectable span
 */
function inspectable(content, pass, field) {
  return `<span class="inspectable" data-pass="${pass}" data-field="${field}">${content}</span>`;
}

/**
 * Render the summary page
 */
function renderSummaryPage(sessionData, sessionId, mirrorInsight = null) {
  const { narrative, groups, tasks, totalTabs, timestamp, thematicAnalysis, visualization, trace, _dispositions, _trashedItems, _completedItems, appliedPreferences, meta } = sessionData;

  // Calculate category counts
  const categoryCounts = Object.entries(groups || {}).map(([name, tabs]) => ({
    name,
    count: tabs.length,
    badgeClass: getCategoryBadgeClass(name)
  })).sort((a, b) => b.count - a.count);

  // Get session pattern
  const sessionPattern = thematicAnalysis?.sessionPattern;
  const alternativeNarrative = thematicAnalysis?.alternativeNarrative;
  const hiddenConnection = thematicAnalysis?.hiddenConnection;

  // Get suggested actions (top 3)
  const suggestedActions = (thematicAnalysis?.suggestedActions || []).slice(0, 3);

  // Get applied preferences info
  const preferencesApplied = appliedPreferences || [];
  const totalPreferences = meta?.preferencesTotal || 0;
  const hasPreferences = preferencesApplied.length > 0 || totalPreferences > 0;

  const extraStyles = `
    .summary-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5em;
      margin-top: 1.5em;
    }
    @media (max-width: 800px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }
    }

    .narrative-section {
      font-size: 1.1em;
      line-height: 1.8;
      margin-bottom: 1em;
    }

    .insight-card {
      background: linear-gradient(135deg, #f8f7f2 0%, #f0efe8 100%);
      border-left: 4px solid var(--accent-blue);
      padding: 1em 1.25em;
      margin-bottom: 1em;
      border-radius: 0 6px 6px 0;
    }
    .insight-card h4 {
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    .insight-card p {
      font-style: italic;
      margin: 0;
    }

    .category-list {
      list-style: none;
    }
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .category-item:last-child {
      border-bottom: none;
    }
    .category-item a {
      color: var(--text-primary);
      text-decoration: none;
    }
    .category-item a:hover {
      color: var(--accent-link);
    }

    .action-list {
      list-style: none;
    }
    .action-item {
      padding: 0.75em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .action-item:last-child {
      border-bottom: none;
    }
    .action-text {
      font-weight: 500;
      margin-bottom: 0.25em;
    }
    .action-reason {
      font-size: 0.9em;
      color: var(--text-muted);
    }
    .action-priority {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 0.75em;
      font-family: system-ui, sans-serif;
      text-transform: uppercase;
      margin-right: 0.5em;
    }
    .action-priority.high { background: #dcfce7; color: #166534; }
    .action-priority.medium { background: #fef3c7; color: #92400e; }
    .action-priority.low { background: #f3f4f6; color: #6b7280; }

    .pattern-badge {
      display: inline-block;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-radius: 20px;
      font-size: 0.85em;
      color: var(--text-secondary);
      margin-top: 0.5em;
    }

    .quick-actions {
      display: flex;
      gap: 0.75em;
      margin-top: 1.5em;
      flex-wrap: wrap;
    }

    .disposition-stats {
      display: flex;
      gap: 1.5em;
      padding: 0.75em 1em;
      background: var(--bg-secondary);
      border-radius: 6px;
      font-size: 0.9em;
      margin-bottom: 1.5em;
    }
    .disposition-stat {
      display: flex;
      align-items: center;
      gap: 0.4em;
    }
    .disposition-stat .icon {
      font-size: 1.1em;
    }
    .disposition-stat.trashed .icon { color: #dc2626; }
    .disposition-stat.completed .icon { color: #16a34a; }
    .disposition-stat.regrouped .icon { color: #2563eb; }

    /* Preferences indicator */
    .preferences-indicator {
      display: flex;
      align-items: center;
      gap: 0.75em;
      padding: 0.75em 1em;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #bae6fd;
      border-radius: 6px;
      margin-bottom: 1.5em;
      font-size: 0.9em;
    }
    .preferences-indicator .icon {
      font-size: 1.2em;
    }
    .preferences-indicator a {
      color: #0369a1;
      text-decoration: none;
    }
    .preferences-indicator a:hover {
      text-decoration: underline;
    }
    .preferences-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25em 0.5em;
      color: #0369a1;
      font-size: 0.85em;
    }
    .preferences-toggle:hover {
      text-decoration: underline;
    }
    .preferences-details {
      display: none;
      margin-top: 0.75em;
      padding-top: 0.75em;
      border-top: 1px solid #bae6fd;
    }
    .preferences-details.expanded {
      display: block;
    }
    .preference-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.4em 0;
      font-size: 0.9em;
    }
    .preference-domain {
      font-weight: 500;
      color: #0369a1;
    }
    .preference-matches {
      color: var(--text-muted);
      font-size: 0.85em;
    }

    .mirror-banner {
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #f5f5f5;
      padding: 1.5em;
      margin: -2em -2em 1.5em -2em;
      text-align: center;
    }
    .mirror-banner p {
      font-size: 1.2em;
      margin: 0;
    }
    .mirror-banner .detail {
      font-size: 0.9em;
      opacity: 0.8;
      margin-top: 0.5em;
    }
    .mirror-banner .actions {
      margin-top: 1em;
      display: flex;
      justify-content: center;
      gap: 1em;
    }
    .mirror-banner .btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
    }
    .mirror-banner .btn:hover {
      background: rgba(255,255,255,0.1);
    }

    /* Inspectable elements */
    .inspectable {
      border-bottom: 1px dotted rgba(37, 99, 235, 0.4);
      cursor: help;
      transition: all 0.15s ease;
    }
    .inspectable:hover {
      border-bottom-color: rgba(37, 99, 235, 0.8);
      background: rgba(37, 99, 235, 0.05);
    }

    /* Inspection popover */
    .inspect-popover {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      background: #1a1a2e;
      color: #eee;
      border-radius: 8px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: none;
      flex-direction: column;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 13px;
    }
    .inspect-popover.visible {
      display: flex;
    }
    .inspect-popover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75em 1em;
      border-bottom: 1px solid #333;
      background: #16213e;
      border-radius: 8px 8px 0 0;
    }
    .inspect-popover-header h3 {
      margin: 0;
      font-size: 0.9em;
      font-weight: 500;
      font-style: normal;
    }
    .inspect-popover-close {
      background: none;
      border: none;
      color: #888;
      font-size: 1.5em;
      cursor: pointer;
      line-height: 1;
    }
    .inspect-popover-close:hover {
      color: #fff;
    }
    .inspect-popover-body {
      padding: 1em;
      overflow-y: auto;
      flex: 1;
    }
    .inspect-popover-section {
      margin-bottom: 1em;
    }
    .inspect-popover-section:last-child {
      margin-bottom: 0;
    }
    .inspect-popover-label {
      font-size: 0.7em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 0.5em;
    }
    .inspect-popover-prompt {
      background: #0f0f23;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 0.75em;
      white-space: pre-wrap;
      font-size: 0.85em;
      line-height: 1.5;
      max-height: 200px;
      overflow-y: auto;
    }
    .inspect-popover-prompt.editable {
      background: #1a1a2e;
      border-color: #4a9eff;
    }
    .inspect-popover-prompt textarea {
      width: 100%;
      background: transparent;
      border: none;
      color: inherit;
      font: inherit;
      resize: vertical;
      min-height: 150px;
    }
    .inspect-popover-prompt textarea:focus {
      outline: none;
    }
    .inspect-popover-output {
      background: #0f0f23;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 0.75em;
      font-size: 0.9em;
    }
    .inspect-popover-footer {
      display: flex;
      justify-content: space-between;
      gap: 0.5em;
      padding: 0.75em 1em;
      border-top: 1px solid #333;
      background: #16213e;
      border-radius: 0 0 8px 8px;
    }
    .inspect-popover-footer button {
      padding: 0.5em 1em;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.85em;
      cursor: pointer;
    }
    .inspect-btn-copy {
      background: #333;
      color: #eee;
    }
    .inspect-btn-copy:hover {
      background: #444;
    }
    .inspect-btn-rerun {
      background: #4a9eff;
      color: #fff;
    }
    .inspect-btn-rerun:hover {
      background: #3b8eef;
    }
    .inspect-btn-rerun:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .inspect-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999;
      display: none;
    }
    .inspect-overlay.visible {
      display: block;
    }
    .no-trace-msg {
      color: #f59e0b;
      font-style: italic;
    }

    /* Dev-mode inspection hint */
    .inspection-hint {
      margin-top: 1em;
      padding: 0.75em 1em;
      background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
      border: 1px solid #c7d2fe;
      border-radius: 6px;
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    .inspectable-demo {
      border-bottom: 1px dotted rgba(37, 99, 235, 0.6);
      cursor: help;
    }
    .pass-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-left: 0.5em;
    }
    .pass-badge.pass-1 { background: #1e3a5f; color: #4a9eff; }
    .pass-badge.pass-4 { background: #3d2f1e; color: #f59e0b; }

    /* NotebookLM Export Button */
    .btn-notebooklm {
      background: linear-gradient(135deg, #ea4335 0%, #ff6d5a 100%);
      color: white;
      border: none;
    }
    .btn-notebooklm:hover {
      background: linear-gradient(135deg, #d93025 0%, #ea4335 100%);
      text-decoration: none;
    }

    /* NotebookLM Modal */
    .nlm-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: none;
    }
    .nlm-modal-overlay.visible { display: block; }

    .nlm-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 550px;
      max-height: 85vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      z-index: 1001;
      display: none;
      flex-direction: column;
    }
    .nlm-modal.visible { display: flex; }

    .nlm-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1em 1.25em;
      border-bottom: 1px solid var(--border-light);
    }
    .nlm-modal-header h3 {
      margin: 0;
      font-size: 1.1em;
      font-weight: 600;
      font-style: normal;
    }
    .nlm-close {
      background: none;
      border: none;
      font-size: 1.5em;
      color: var(--text-muted);
      cursor: pointer;
      line-height: 1;
    }
    .nlm-close:hover { color: var(--text-primary); }

    .nlm-modal-body {
      padding: 1.25em;
      overflow-y: auto;
      flex: 1;
    }

    .nlm-intro {
      font-size: 0.9em;
      color: var(--text-muted);
      margin: 0 0 1em 0;
    }

    .nlm-options {
      margin-bottom: 1em;
    }

    .nlm-option {
      display: flex;
      align-items: center;
      padding: 0.5em 0.75em;
      margin: 0.25em 0;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .nlm-option:hover {
      background: var(--bg-secondary);
    }
    .nlm-option input[type="radio"] {
      margin-right: 0.75em;
      accent-color: #ea4335;
    }
    .nlm-option-label {
      flex: 1;
      font-size: 0.95em;
    }
    .nlm-option-count {
      font-size: 0.85em;
      color: var(--text-muted);
      background: var(--bg-secondary);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .nlm-option-header {
      font-size: 0.8em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 1em 0 0.5em 0;
      padding-left: 0.75em;
    }

    .nlm-category-options,
    .nlm-theme-options {
      border-left: 2px solid var(--border-light);
      margin-left: 1em;
      padding-left: 0.5em;
    }

    .nlm-preview {
      margin-top: 1em;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      overflow: hidden;
    }
    .nlm-preview-header {
      display: flex;
      justify-content: space-between;
      padding: 0.5em 0.75em;
      background: var(--bg-secondary);
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .nlm-preview-count {
      font-family: system-ui, sans-serif;
    }
    #nlm-preview-text {
      width: 100%;
      height: 120px;
      padding: 0.75em;
      border: none;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.8em;
      resize: none;
      background: #fafafa;
    }

    .nlm-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75em;
      padding: 1em 1.25em;
      border-top: 1px solid var(--border-light);
    }

    /* Toast notification */
    .nlm-toast {
      position: fixed;
      bottom: 2em;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1a1a1a;
      color: white;
      padding: 0.75em 1.5em;
      border-radius: 8px;
      font-size: 0.95em;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1002;
    }
    .nlm-toast.visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  `;

  const content = `
    <div class="page-content">
      ${mirrorInsight ? `
        <div class="mirror-banner">
          <p>"${escapeHtml(mirrorInsight.headline)}<br>${escapeHtml(mirrorInsight.subhead)}"</p>
          ${mirrorInsight.detail ? `<p class="detail">${escapeHtml(mirrorInsight.detail)}</p>` : ''}
          <div class="actions">
            ${(mirrorInsight.actions || []).map(a => `
              <button class="btn">${a.icon || ''} ${escapeHtml(a.label)}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <h1>Session Summary</h1>
      <p class="page-subtitle">What your session reveals</p>

      ${_dispositions && _dispositions.count > 0 ? `
        <div class="disposition-stats">
          ${_dispositions.completedCount > 0 ? `
            <span class="disposition-stat completed">
              <span class="icon">&#10003;</span>
              <span>${_dispositions.completedCount} completed</span>
            </span>
          ` : ''}
          ${_dispositions.trashedCount > 0 ? `
            <span class="disposition-stat trashed">
              <span class="icon">&#10005;</span>
              <span>${_dispositions.trashedCount} trashed</span>
            </span>
          ` : ''}
          ${_dispositions.regroupedCount > 0 ? `
            <span class="disposition-stat regrouped">
              <span class="icon">&#8644;</span>
              <span>${_dispositions.regroupedCount} moved</span>
            </span>
          ` : ''}
        </div>
      ` : ''}

      ${hasPreferences ? `
        <div class="preferences-indicator">
          <span class="icon">🧠</span>
          <span>
            ${preferencesApplied.length > 0
              ? `Applied ${preferencesApplied.length} learned preference${preferencesApplied.length !== 1 ? 's' : ''} to ${preferencesApplied.reduce((sum, p) => sum + p.matchedTabs.length, 0)} tab${preferencesApplied.reduce((sum, p) => sum + p.matchedTabs.length, 0) !== 1 ? 's' : ''}`
              : `${totalPreferences} preference${totalPreferences !== 1 ? 's' : ''} active (none matched this session)`
            }
          </span>
          <a href="/preferences">Manage</a>
          ${preferencesApplied.length > 0 ? `
            <button class="preferences-toggle" onclick="document.getElementById('prefs-details').classList.toggle('expanded'); this.textContent = this.textContent === 'Show' ? 'Hide' : 'Show'">Show</button>
          ` : ''}
        </div>
        ${preferencesApplied.length > 0 ? `
          <div class="preferences-details" id="prefs-details">
            ${preferencesApplied.map(p => `
              <div class="preference-item">
                <span class="preference-domain">${escapeHtml(p.domain)}</span>
                <span class="preference-matches">${p.matchedTabs.length} tab${p.matchedTabs.length !== 1 ? 's' : ''} matched</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      ` : ''}

      <p class="narrative-section">${inspectable(escapeHtml(narrative), 1, 'narrative')}</p>

      ${sessionPattern ? `
        <span class="pattern-badge">${inspectable(escapeHtml(sessionPattern.type || 'mixed'), 4, 'sessionPattern')} session</span>
      ` : ''}

      <div class="summary-grid">
        <div class="main-column">
          ${alternativeNarrative ? `
            <div class="insight-card">
              <h4>Another Way to See This</h4>
              <p>${inspectable(escapeHtml(alternativeNarrative), 4, 'alternativeNarrative')}</p>
            </div>
          ` : ''}

          ${hiddenConnection ? `
            <div class="insight-card">
              <h4>Something You Might Not See</h4>
              <p>${inspectable(escapeHtml(hiddenConnection), 4, 'hiddenConnection')}</p>
            </div>
          ` : ''}

          ${suggestedActions.length > 0 ? `
            <div class="card">
              <div class="card-header">
                <span class="card-title">Suggested Actions</span>
              </div>
              <ul class="action-list">
                ${suggestedActions.map(action => `
                  <li class="action-item">
                    <div class="action-text">
                      <span class="action-priority ${action.priority || 'medium'}">${action.priority || 'medium'}</span>
                      ${escapeHtml(action.action)}
                    </div>
                    ${action.reason ? `<div class="action-reason">${escapeHtml(action.reason)}</div>` : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="quick-actions">
            <a href="/results/${sessionId}/map" class="btn btn-secondary">View Map</a>
            <a href="/results/${sessionId}/tabs" class="btn btn-secondary">Browse All Tabs</a>
            <a href="/results/${sessionId}/analysis" class="btn btn-secondary">Deep Analysis</a>
            <a href="/workbench/${sessionId}" class="btn btn-secondary dev-only">Inspect Prompts</a>
            <button class="btn btn-notebooklm" id="notebooklm-btn">Copy for NotebookLM</button>
          </div>

          <div class="dev-only-block inspection-hint">
            <p>Click any <span class="inspectable-demo">dotted-underlined text</span> above to inspect the prompt that generated it.</p>
          </div>

          <!-- NotebookLM Export Modal -->
          <div class="nlm-modal-overlay" id="nlm-overlay"></div>
          <div class="nlm-modal" id="nlm-modal">
            <div class="nlm-modal-header">
              <h3>Export to NotebookLM</h3>
              <button class="nlm-close" id="nlm-close">&times;</button>
            </div>
            <div class="nlm-modal-body">
              <p class="nlm-intro">Copy URLs to paste into NotebookLM's "Add sources" dialog. NotebookLM accepts newline-separated URLs.</p>

              <div class="nlm-options">
                <label class="nlm-option">
                  <input type="radio" name="nlm-scope" value="all" checked>
                  <span class="nlm-option-label">All URLs</span>
                  <span class="nlm-option-count">${totalTabs} sources</span>
                </label>

                <div class="nlm-category-options">
                  <div class="nlm-option-header">By Category:</div>
                  ${categoryCounts.map(cat => `
                    <label class="nlm-option nlm-option-category">
                      <input type="radio" name="nlm-scope" value="category:${escapeHtml(cat.name)}">
                      <span class="nlm-option-label">${escapeHtml(cat.name)}</span>
                      <span class="nlm-option-count">${cat.count}</span>
                    </label>
                  `).join('')}
                </div>

                ${thematicAnalysis?.thematicThroughlines?.length > 0 ? `
                  <div class="nlm-theme-options">
                    <div class="nlm-option-header">By Theme:</div>
                    ${thematicAnalysis.thematicThroughlines.map((t, i) => `
                      <label class="nlm-option nlm-option-theme">
                        <input type="radio" name="nlm-scope" value="theme:${i}">
                        <span class="nlm-option-label">${escapeHtml(t.theme)}</span>
                        <span class="nlm-option-count">${(t.tabs || []).length}</span>
                      </label>
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              <div class="nlm-preview">
                <div class="nlm-preview-header">
                  <span>Preview</span>
                  <span class="nlm-preview-count" id="nlm-preview-count">0 URLs</span>
                </div>
                <textarea id="nlm-preview-text" readonly></textarea>
              </div>
            </div>
            <div class="nlm-modal-footer">
              <button class="btn btn-secondary" id="nlm-cancel">Cancel</button>
              <button class="btn btn-primary" id="nlm-copy">Copy to Clipboard</button>
            </div>
          </div>

          <!-- Toast notification -->
          <div class="nlm-toast" id="nlm-toast">Copied to clipboard!</div>
        </div>

        <div class="side-column">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Categories</span>
              <span class="badge badge-count">${totalTabs} tabs</span>
            </div>
            <ul class="category-list">
              ${categoryCounts.map(cat => `
                <li class="category-item">
                  <a href="/results/${sessionId}/tabs?filter=${encodeURIComponent(cat.name)}">${escapeHtml(cat.name)}</a>
                  <span class="badge ${cat.badgeClass}">${cat.count}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          ${tasks && tasks.length > 0 ? `
            <div class="card">
              <div class="card-header">
                <span class="card-title">Inferred Tasks</span>
              </div>
              <ul class="action-list">
                ${tasks.slice(0, 3).map(task => `
                  <li class="action-item">
                    <div class="action-text">${escapeHtml(task.description)}</div>
                    <div class="action-reason">${escapeHtml(task.suggestedAction)}</div>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Inspection Popover -->
    <div class="inspect-overlay" id="inspect-overlay"></div>
    <div class="inspect-popover" id="inspect-popover">
      <div class="inspect-popover-header">
        <h3><span id="inspect-title">Inspect</span><span id="inspect-pass-badge" class="pass-badge"></span></h3>
        <button class="inspect-popover-close" id="inspect-close">&times;</button>
      </div>
      <div class="inspect-popover-body">
        <div class="inspect-popover-section">
          <div class="inspect-popover-label">Prompt</div>
          <div class="inspect-popover-prompt editable">
            <textarea id="inspect-prompt" placeholder="No trace data available"></textarea>
          </div>
        </div>
        <div class="inspect-popover-section">
          <div class="inspect-popover-label">Current Output</div>
          <div class="inspect-popover-output" id="inspect-output"></div>
        </div>
      </div>
      <div class="inspect-popover-footer">
        <button class="inspect-btn-copy" id="inspect-copy">Copy Prompt</button>
        <button class="inspect-btn-rerun" id="inspect-rerun">▶ Re-run</button>
      </div>
    </div>
  `;

  // Prepare trace data for embedding
  const traceJson = trace ? JSON.stringify({
    pass1: trace.pass1 ? { prompt: trace.pass1.prompt, rawResponse: trace.pass1.rawResponse } : null,
    pass4: trace.pass4 ? { prompt: trace.pass4.prompt, rawResponse: trace.pass4.rawResponse } : null
  }) : 'null';

  // Prepare groups data for NotebookLM export
  const groupsJson = JSON.stringify(groups || {});
  const themesJson = JSON.stringify(thematicAnalysis?.thematicThroughlines || []);

  const extraScripts = `
    <script>
      const sessionId = '${sessionId}';
      const traceData = ${traceJson};

      // NotebookLM export data
      const nlmGroups = ${groupsJson};
      const nlmThemes = ${themesJson};

      const fieldLabels = {
        narrative: 'Narrative',
        sessionPattern: 'Session Pattern',
        alternativeNarrative: 'Alternative Narrative',
        hiddenConnection: 'Hidden Connection'
      };

      const popover = document.getElementById('inspect-popover');
      const overlay = document.getElementById('inspect-overlay');
      const promptTextarea = document.getElementById('inspect-prompt');
      const outputDiv = document.getElementById('inspect-output');
      const titleSpan = document.getElementById('inspect-title');
      const passBadge = document.getElementById('inspect-pass-badge');
      const closeBtn = document.getElementById('inspect-close');
      const copyBtn = document.getElementById('inspect-copy');
      const rerunBtn = document.getElementById('inspect-rerun');

      let currentElement = null;
      let currentPass = null;
      let currentField = null;

      function openInspector(el) {
        currentElement = el;
        currentPass = el.dataset.pass;
        currentField = el.dataset.field;

        titleSpan.textContent = fieldLabels[currentField] || currentField;
        passBadge.textContent = 'Pass ' + currentPass;
        passBadge.className = 'pass-badge pass-' + currentPass;

        outputDiv.textContent = el.textContent;

        const passKey = 'pass' + currentPass;
        if (traceData && traceData[passKey] && traceData[passKey].prompt) {
          promptTextarea.value = traceData[passKey].prompt;
          promptTextarea.disabled = false;
          rerunBtn.disabled = false;
        } else {
          promptTextarea.value = 'No trace data captured for this session.\\n\\nRun a new classification to capture prompts.';
          promptTextarea.disabled = true;
          rerunBtn.disabled = true;
        }

        popover.classList.add('visible');
        overlay.classList.add('visible');
      }

      function closeInspector() {
        popover.classList.remove('visible');
        overlay.classList.remove('visible');
        currentElement = null;
      }

      // Click handlers for inspectable elements
      document.querySelectorAll('.inspectable').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          openInspector(el);
        });
      });

      closeBtn.addEventListener('click', closeInspector);
      overlay.addEventListener('click', closeInspector);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeInspector();
      });

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(promptTextarea.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy Prompt', 1500);
      });

      rerunBtn.addEventListener('click', async () => {
        if (!currentPass || promptTextarea.disabled) return;

        rerunBtn.disabled = true;
        rerunBtn.textContent = 'Running...';

        try {
          const res = await fetch('/api/workbench/rerun', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              pass: parseInt(currentPass),
              prompt: promptTextarea.value
            })
          });

          if (!res.ok) throw new Error('Rerun failed');

          const result = await res.json();

          // Try to parse and extract the relevant field
          try {
            const parsed = JSON.parse(result.rawResponse);
            let newValue = result.rawResponse;

            if (currentField === 'narrative' && parsed.narrative) {
              newValue = parsed.narrative;
            } else if (currentField === 'alternativeNarrative' && parsed.alternativeNarrative) {
              newValue = parsed.alternativeNarrative;
            } else if (currentField === 'sessionPattern' && parsed.sessionPattern?.type) {
              newValue = parsed.sessionPattern.type;
            } else if (currentField === 'hiddenConnection') {
              newValue = parsed.hiddenConnection || parsed.thematicThroughlines?.[0] || result.rawResponse;
            }

            // Update the element on the page
            if (currentElement) {
              currentElement.textContent = newValue;
              outputDiv.textContent = newValue;
            }
          } catch (parseErr) {
            // Show raw response if can't parse
            outputDiv.textContent = result.rawResponse;
          }

          rerunBtn.textContent = '✓ Done';
          setTimeout(() => rerunBtn.textContent = '▶ Re-run', 2000);
        } catch (err) {
          alert('Error: ' + err.message);
          rerunBtn.textContent = '▶ Re-run';
        } finally {
          rerunBtn.disabled = false;
        }
      });

      // ============================================
      // NotebookLM Export Modal
      // ============================================
      const nlmBtn = document.getElementById('notebooklm-btn');
      const nlmModal = document.getElementById('nlm-modal');
      const nlmOverlay = document.getElementById('nlm-overlay');
      const nlmClose = document.getElementById('nlm-close');
      const nlmCancel = document.getElementById('nlm-cancel');
      const nlmCopy = document.getElementById('nlm-copy');
      const nlmPreviewText = document.getElementById('nlm-preview-text');
      const nlmPreviewCount = document.getElementById('nlm-preview-count');
      const nlmToast = document.getElementById('nlm-toast');

      // Get all URLs from groups
      function getAllUrls() {
        const urls = [];
        Object.values(nlmGroups).forEach(tabs => {
          tabs.forEach(tab => {
            if (tab.url) urls.push(tab.url);
          });
        });
        return urls;
      }

      // Get URLs for a specific category
      function getCategoryUrls(categoryName) {
        const tabs = nlmGroups[categoryName] || [];
        return tabs.map(tab => tab.url).filter(Boolean);
      }

      // Get URLs for a specific theme (by tab indices)
      function getThemeUrls(themeIndex) {
        const theme = nlmThemes[themeIndex];
        if (!theme || !theme.tabs) return [];

        const tabIndices = theme.tabs;
        const urls = [];

        // Build a map of tabIndex to URL
        Object.values(nlmGroups).forEach(tabs => {
          tabs.forEach(tab => {
            if (tabIndices.includes(tab.tabIndex) && tab.url) {
              urls.push(tab.url);
            }
          });
        });

        return urls;
      }

      // Update preview based on selection
      function updatePreview() {
        const selected = document.querySelector('input[name="nlm-scope"]:checked');
        if (!selected) return;

        let urls = [];
        const value = selected.value;

        if (value === 'all') {
          urls = getAllUrls();
        } else if (value.startsWith('category:')) {
          const categoryName = value.replace('category:', '');
          urls = getCategoryUrls(categoryName);
        } else if (value.startsWith('theme:')) {
          const themeIndex = parseInt(value.replace('theme:', ''));
          urls = getThemeUrls(themeIndex);
        }

        // NotebookLM has 50 source limit
        const limited = urls.slice(0, 50);
        const warning = urls.length > 50 ? '\\n\\n# Note: NotebookLM has a 50 source limit. ' + (urls.length - 50) + ' URLs truncated.' : '';

        nlmPreviewText.value = limited.join('\\n') + warning;
        nlmPreviewCount.textContent = limited.length + ' URLs' + (urls.length > 50 ? ' (50 max)' : '');
      }

      // Open modal
      function openNlmModal() {
        nlmModal.classList.add('visible');
        nlmOverlay.classList.add('visible');
        updatePreview();
      }

      // Close modal
      function closeNlmModal() {
        nlmModal.classList.remove('visible');
        nlmOverlay.classList.remove('visible');
      }

      // Show toast
      function showToast(message) {
        nlmToast.textContent = message || 'Copied to clipboard!';
        nlmToast.classList.add('visible');
        setTimeout(() => nlmToast.classList.remove('visible'), 2500);
      }

      // Copy to clipboard
      async function copyToClipboard() {
        const text = nlmPreviewText.value.split('\\n# Note:')[0]; // Remove warning note
        try {
          await navigator.clipboard.writeText(text);
          showToast('Copied ' + text.split('\\n').filter(Boolean).length + ' URLs to clipboard!');
          closeNlmModal();
        } catch (err) {
          // Fallback for older browsers
          nlmPreviewText.select();
          document.execCommand('copy');
          showToast('Copied to clipboard!');
          closeNlmModal();
        }
      }

      // Event listeners
      nlmBtn.addEventListener('click', openNlmModal);
      nlmClose.addEventListener('click', closeNlmModal);
      nlmCancel.addEventListener('click', closeNlmModal);
      nlmOverlay.addEventListener('click', closeNlmModal);
      nlmCopy.addEventListener('click', copyToClipboard);

      // Update preview when selection changes
      document.querySelectorAll('input[name="nlm-scope"]').forEach(radio => {
        radio.addEventListener('change', updatePreview);
      });

      // Close on Escape (combined with inspector)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeNlmModal();
        }
      });
    </script>
  `;

  return wrapInLayout(content, {
    sessionId,
    currentPage: 'summary',
    title: 'Session Summary',
    sessionData: { totalTabs, timestamp },
    extraHead: extraStyles,
    extraScripts: extraScripts
  });
}

module.exports = { renderSummaryPage };
