/**
 * Launchpad Renderer
 *
 * Generates the Launchpad UI for forced-completion mode.
 * Unlike Results (read-only), Launchpad allows user actions:
 * - Trash (discard as noise)
 * - Complete (mark as done)
 * - Promote (create KB artifact)
 * - Regroup (move to different category via drag/drop)
 *
 * See: docs/SESSION-ARTIFACT-INVARIANTS.md
 */

/**
 * Render the Launchpad page for a session
 * @param {string} sessionId - Session ID
 * @param {Object} sessionState - Session with dispositions applied
 * @param {Object} lockStatus - Current lock status with resume state
 * @param {boolean} reviewMode - If true, renders in review mode (no lock)
 * @param {number} preferenceCount - Number of active learned preferences
 * @param {Array} efforts - Array of user-created efforts
 * @returns {string} HTML page
 */
function renderLaunchpadPage(sessionId, sessionState, lockStatus = {}, reviewMode = false, preferenceCount = 0, efforts = []) {
  const { originalGroups, itemStates, itemCategories, unresolvedCount, capturedAt } = sessionState;
  const resumeState = lockStatus.resumeState || {};
  const pageTitle = reviewMode ? 'Review' : 'Launchpad';

  // Calculate progress
  const totalItems = Object.keys(itemStates).length;
  const resolvedCount = totalItems - unresolvedCount;
  const percentComplete = totalItems > 0 ? Math.round((resolvedCount / totalItems) * 100) : 0;


  // Build items by current category (after regrouping)
  const categorizedItems = new Map();

  // Handle both object format { "Category": [...] } and array format [{ category, items }]
  const groups = originalGroups || {};
  const isObjectFormat = !Array.isArray(groups);

  if (isObjectFormat) {
    // Object format: { "Research": [...], "Development": [...] }
    for (const [category, items] of Object.entries(groups)) {
      for (const item of (items || [])) {
        const itemId = item.url || item.id;
        const currentCategory = itemCategories[itemId] || category;
        const state = itemStates[itemId] || { status: 'pending' };

        if (!categorizedItems.has(currentCategory)) {
          categorizedItems.set(currentCategory, []);
        }

        categorizedItems.get(currentCategory).push({
          ...item,
          itemId,
          state
        });
      }
    }
  } else {
    // Array format: [{ category: "Research", items: [...] }]
    for (const group of groups) {
      for (const item of (group.items || [])) {
        const itemId = item.url || item.id;
        const currentCategory = itemCategories[itemId] || group.category;
        const state = itemStates[itemId] || { status: 'pending' };

        if (!categorizedItems.has(currentCategory)) {
          categorizedItems.set(currentCategory, []);
        }

        categorizedItems.get(currentCategory).push({
          ...item,
          itemId,
          state
        });
      }
    }
  }

  // Collect all category names for the move dropdown
  const allCategories = Array.from(categorizedItems.keys());

  // Get items that are in efforts (to hide them from category view)
  const itemsInEfforts = new Set();
  for (const effort of efforts) {
    for (const item of effort.items) {
      itemsInEfforts.add(item.itemId);
    }
  }

  // Generate efforts section (if any efforts exist)
  const effortsSectionHtml = efforts.length > 0 ? renderEffortsSection(efforts) : '';

  // Generate category sections (hiding items that are in efforts)
  const categorySections = Array.from(categorizedItems.entries())
    .map(([category, items]) => {
      const visibleItems = items.filter(item => !itemsInEfforts.has(item.itemId));
      return renderCategorySection(category, visibleItems, allCategories);
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle} - ${unresolvedCount} items remaining</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 0;
    }

    /* Minimal top bar for Launchpad */
    .launchpad-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6em 2em;
      background: #141414;
      border-bottom: 1px solid #333;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .topbar-brand {
      font-size: 1.1em;
      font-weight: 600;
      font-style: italic;
      color: #e0e0e0;
      text-decoration: none;
    }
    .topbar-brand:hover { color: #fff; text-decoration: none; }
    .topbar-center {
      display: flex;
      align-items: center;
      gap: 1em;
      flex: 1;
      max-width: 400px;
      margin: 0 2em;
    }
    .topbar-progress {
      flex: 1;
      height: 6px;
      background: #333;
      border-radius: 3px;
      overflow: hidden;
    }
    .topbar-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #10b981);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .topbar-progress-text {
      font-size: 0.8em;
      color: #888;
      white-space: nowrap;
    }
    .topbar-progress-text .resolved { color: #10b981; font-weight: 600; }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 1em;
    }
    .topbar-pause {
      padding: 0.35em 0.8em;
      background: transparent;
      color: #888;
      border: 1px solid #444;
      border-radius: 4px;
      font-size: 0.85em;
      cursor: pointer;
      text-decoration: none;
      font-family: inherit;
    }
    .topbar-pause:hover {
      color: #e0e0e0;
      border-color: #666;
      background: rgba(255,255,255,0.05);
      text-decoration: none;
    }
    .topbar-subtitle {
      font-size: 0.8em;
      color: #666;
    }

    /* Developer mode visibility */
    .dev-only { display: none; }
    body.dev-mode .dev-only { display: inline; }
    .dev-only-block { display: none; }
    body.dev-mode .dev-only-block { display: block; }

    .main-content {
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #333;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }

    .header .status {
      font-size: 14px;
      color: #888;
    }

    .header .status .count {
      color: #f59e0b;
      font-weight: 600;
    }

    .header .status.complete .count {
      color: #10b981;
    }

    .progress-container {
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #333;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #f59e0b, #10b981);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 13px;
      color: #888;
      min-width: 120px;
    }

    .progress-text .resolved {
      color: #10b981;
      font-weight: 600;
    }

    .progress-text .total {
      color: #666;
    }


    .category {
      margin-bottom: 24px;
      background: #141414;
      border-radius: 8px;
      overflow: hidden;
    }

    .category-header {
      padding: 12px 16px;
      background: #1a1a1a;
      font-weight: 600;
      font-size: 14px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
    }

    .category.protected .category-header {
      background: #422006;
      color: #fbbf24;
    }

    .category.protected {
      border: 1px solid #854d0e;
    }

    .category.synthesis .category-header {
      background: #1e3a5f;
      color: #7dd3fc;
    }

    .category.synthesis {
      border: 1px solid #0369a1;
    }

    .category-header .item-count {
      color: #666;
    }

    .item {
      padding: 12px 16px;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.15s, opacity 0.3s;
    }

    .item:last-child { border-bottom: none; }

    .item:hover { background: #1a1a1a; }

    .item.trashed {
      opacity: 0.4;
      text-decoration: line-through;
    }

    .item.completed {
      opacity: 0.6;
    }

    .item.completed .item-title::before {
      content: '✓ ';
      color: #10b981;
    }

    .item.promoted {
      opacity: 0.6;
    }

    .item.promoted .item-title::before {
      content: '↗ ';
      color: #3b82f6;
    }

    .item.deferred {
      opacity: 0.6;
    }

    .item.deferred .item-title::before {
      content: '⏸ ';
      color: #a855f7;
    }

    .item.later {
      opacity: 0.6;
    }

    .item.later .item-title::before {
      content: '⏱ ';
      color: #f59e0b;
    }

    .item-content {
      flex: 1;
      min-width: 0;
    }

    .item-title {
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-title a {
      color: #60a5fa;
      text-decoration: none;
    }

    .item-title a:hover { text-decoration: underline; }

    .item-url {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .item-actions {
      display: flex;
      gap: 8px;
      opacity: 0.7;
      transition: opacity 0.15s;
    }

    .item:hover .item-actions,
    .item-actions:focus-within {
      opacity: 1;
    }

    .item.trashed .item-actions,
    .item.completed .item-actions,
    .item.promoted .item-actions,
    .item.deferred .item-actions,
    .item.later .item-actions {
      display: none;
    }

    .action-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .action-btn.trash {
      background: #7f1d1d;
      color: #fca5a5;
    }
    .action-btn.trash:hover { background: #991b1b; }

    .action-btn.complete {
      background: #14532d;
      color: #86efac;
    }
    .action-btn.complete:hover { background: #166534; }

    .action-btn.promote {
      background: #1e3a8a;
      color: #93c5fd;
    }
    .action-btn.promote:hover { background: #1e40af; }

    .action-btn.defer {
      background: #581c87;
      color: #d8b4fe;
    }
    .action-btn.defer:hover { background: #6b21a8; }

    .action-btn.later {
      background: #78350f;
      color: #fcd34d;
    }
    .action-btn.later:hover { background: #92400e; }

    .action-btn.undo {
      background: #374151;
      color: #d1d5db;
    }
    .action-btn.undo:hover { background: #4b5563; }

    /* Move dropdown */
    .move-select {
      padding: 4px 8px;
      background: #1e3a5f;
      color: #7dd3fc;
      border: 1px solid #3b82f6;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='%237dd3fc' d='M0 2l4 4 4-4z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 6px center;
      padding-right: 20px;
    }
    .move-select:hover {
      background-color: #1e4a7f;
    }
    .move-select:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
    }

    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-info {
      font-size: 12px;
      color: #666;
    }

    .clear-lock-btn {
      padding: 8px 16px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      opacity: 0.5;
      pointer-events: none;
    }

    .clear-lock-btn.enabled {
      opacity: 1;
      pointer-events: auto;
    }

    .dev-clear-btn {
      margin-left: 12px;
      padding: 4px 8px;
      background: transparent;
      color: #f59e0b;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
    }
    .dev-clear-btn:hover {
      opacity: 1;
      background: rgba(245, 158, 11, 0.1);
    }

    .clear-lock-btn.enabled:hover {
      background: #059669;
    }

    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #1f2937;
      border-radius: 8px;
      font-size: 14px;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    .toast.error { border-left: 3px solid #ef4444; }
    .toast.success { border-left: 3px solid #10b981; }

    /* Batch Actions */
    .batch-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1f2937;
      border-top: 1px solid #374151;
      padding: 12px 20px;
      display: none;
      align-items: center;
      gap: 16px;
      z-index: 100;
    }

    .batch-bar.visible {
      display: flex;
    }

    .batch-count {
      font-size: 14px;
      color: #9ca3af;
    }

    .batch-count strong {
      color: #f59e0b;
    }

    .batch-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .batch-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .batch-btn.later {
      background: #78350f;
      color: #fcd34d;
    }
    .batch-btn.later:hover { background: #92400e; }

    .batch-btn.done {
      background: #14532d;
      color: #86efac;
    }
    .batch-btn.done:hover { background: #166534; }

    .batch-btn.trash {
      background: #7f1d1d;
      color: #fca5a5;
    }
    .batch-btn.trash:hover { background: #991b1b; }

    .batch-btn.cancel {
      background: #374151;
      color: #d1d5db;
    }
    .batch-btn.cancel:hover { background: #4b5563; }

    .batch-btn.effort {
      background: #7c3aed;
      color: #ddd6fe;
    }
    .batch-btn.effort:hover { background: #8b5cf6; }

    .batch-move {
      margin-right: auto;
    }

    .item-checkbox {
      width: 18px;
      height: 18px;
      accent-color: #f59e0b;
      cursor: pointer;
      flex-shrink: 0;
    }

    .item.trashed .item-checkbox,
    .item.completed .item-checkbox,
    .item.promoted .item-checkbox,
    .item.deferred .item-checkbox,
    .item.later .item-checkbox {
      display: none;
    }

    /* Confirmation Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
    }

    .modal-overlay.visible {
      display: flex;
    }

    .modal {
      background: #1f2937;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
    }

    .modal h3 {
      font-size: 18px;
      margin-bottom: 12px;
      color: #ef4444;
    }

    .modal p {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 20px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .modal-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .modal-btn.cancel {
      background: #374151;
      color: #d1d5db;
    }

    .modal-btn.confirm {
      background: #991b1b;
      color: #fca5a5;
    }

    .modal-btn.create {
      background: #7c3aed;
      color: white;
    }
    .modal-btn.create:hover {
      background: #8b5cf6;
    }

    /* Effort Modal Styles */
    .effort-modal {
      max-width: 450px;
    }
    .effort-modal h3 {
      color: #7c3aed;
      font-size: 20px;
    }
    .modal-subtitle {
      font-size: 14px;
      color: #9ca3af;
      margin-bottom: 1.25em;
    }
    .effort-form {
      margin-bottom: 1.5em;
    }
    .effort-form label {
      display: block;
      font-size: 14px;
      color: #d1d5db;
      margin-bottom: 0.5em;
    }
    .effort-form input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #374151;
      border-radius: 6px;
      background: #111827;
      color: #fff;
      font-size: 14px;
    }
    .effort-form input:focus {
      outline: none;
      border-color: #7c3aed;
      box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
    }

    /* Effort Section Styles */
    .efforts-container {
      margin-bottom: 24px;
    }
    .efforts-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(90deg, #7c3aed, #6d28d9);
      color: white;
      font-weight: 600;
      font-size: 14px;
      border-radius: 8px 8px 0 0;
    }
    .effort-card {
      background: #1a1a2e;
      border: 1px solid #7c3aed;
      border-top: none;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .effort-card:last-child {
      margin-bottom: 0;
    }
    .effort-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #16213e;
      cursor: pointer;
    }
    .effort-header:hover {
      background: #1e3a5f;
    }
    .effort-name {
      font-weight: 600;
      color: #ddd6fe;
    }
    .effort-count {
      font-size: 13px;
      color: #9ca3af;
      margin-left: 8px;
    }
    .effort-actions {
      display: flex;
      gap: 8px;
    }
    .effort-btn {
      padding: 4px 10px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    .effort-btn.done {
      background: #14532d;
      color: #86efac;
    }
    .effort-btn.done:hover { background: #166534; }
    .effort-btn.defer {
      background: #78350f;
      color: #fcd34d;
    }
    .effort-btn.defer:hover { background: #92400e; }
    .effort-items {
      padding: 8px 0;
      display: none;
    }
    .effort-items.expanded {
      display: block;
    }
    .effort-item {
      padding: 8px 16px;
      border-bottom: 1px solid #2a2a4a;
      font-size: 13px;
    }
    .effort-item:last-child {
      border-bottom: none;
    }
    .effort-item a {
      color: #60a5fa;
      text-decoration: none;
    }
    .effort-item a:hover {
      text-decoration: underline;
    }
    .effort-completed {
      opacity: 0.5;
    }
    .effort-completed .effort-name::before {
      content: '✓ ';
      color: #10b981;
    }

    /* Review Mode */
    .review-banner {
      background: linear-gradient(90deg, #7c3aed, #4f46e5);
      color: white;
      padding: 10px 20px;
      text-align: center;
      font-size: 14px;
      margin-bottom: 16px;
      border-radius: 8px;
    }

    .review-banner strong {
      margin-right: 8px;
    }

    body.review-mode .clear-lock-btn {
      display: none;
    }

    body.review-mode .footer {
      justify-content: center;
    }

    /* Preference Indicator */
    .preference-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: #7dd3fc;
      margin-left: 12px;
    }

    .preference-indicator a {
      color: #7dd3fc;
      text-decoration: none;
    }

    .preference-indicator a:hover {
      text-decoration: underline;
    }

    /* Learning indicator in completion screen */
    .learning-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 8px;
      font-size: 14px;
      color: #6ee7b7;
      margin-top: 1em;
    }
  </style>
</head>
<body class="${reviewMode ? 'review-mode' : ''}">
  <div class="launchpad-topbar">
    <a href="/" class="topbar-brand">Memento</a>
    <div class="topbar-center">
      <div class="topbar-progress">
        <div class="topbar-progress-fill" id="topbar-progress-fill" style="width: ${percentComplete}%"></div>
      </div>
      <span class="topbar-progress-text"><span class="resolved" id="topbar-resolved">${resolvedCount}</span>/${totalItems}</span>
    </div>
    <div class="topbar-actions">
      <span class="topbar-subtitle">Triage every tab before moving on</span>
      <button class="topbar-pause" onclick="pauseToDashboard()">Pause &rarr; Dashboard</button>
    </div>
  </div>
  <div class="main-content">
  ${reviewMode ? `
  <div class="review-banner">
    <strong>Review Mode</strong> You're reviewing a past session. Actions are recorded but no lock is held.
  </div>
  ` : ''}
  <div class="header">
    <div>
      <h1>${pageTitle}${preferenceCount > 0 ? `
        <span class="preference-indicator">
          &#129504; Using ${preferenceCount} learned preference${preferenceCount !== 1 ? 's' : ''}
          <a href="/preferences">(manage)</a>
        </span>
      ` : ''}</h1>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill" style="width: ${percentComplete}%"></div>
        </div>
        <div class="progress-text">
          <span class="resolved" id="resolved-count">${resolvedCount}</span> of <span class="total" id="total-count">${totalItems}</span> resolved
        </div>
      </div>
    </div>
    <div class="status ${unresolvedCount === 0 ? 'complete' : ''}">
      <span class="count" id="unresolved-count">${unresolvedCount}</span> items remaining
      <span style="color: #666; margin-left: 8px;">Captured: ${formatTimestamp(capturedAt)}</span>
    </div>
  </div>


  ${effortsSectionHtml}

  <div id="categories">
    ${categorySections}
  </div>

  <div class="footer">
    <div class="footer-info">
      Session: ${sessionId}
      <button class="dev-clear-btn dev-only" onclick="forceClearLock()" title="Development only: Force clear lock without resolving all items">
        Force Clear Lock (Dev)
      </button>
    </div>
    <button id="clear-lock-btn" class="clear-lock-btn ${unresolvedCount === 0 ? 'enabled' : ''}"
            onclick="clearLock()" ${unresolvedCount > 0 ? 'disabled' : ''}>
      ${unresolvedCount === 0 ? 'Complete Session' : 'Resolve all items to unlock'}
    </button>
  </div>

  <div id="toast" class="toast"></div>

  <!-- Batch Actions Bar -->
  <div id="batch-bar" class="batch-bar">
    <div class="batch-count"><strong id="batch-count">0</strong> items selected</div>
    <div class="batch-actions">
      <select id="batch-move-select" class="move-select batch-move" onchange="batchMove(this.value)">
        <option value="">Move to...</option>
        ${allCategories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('')}
      </select>
      <button class="batch-btn effort" onclick="showCreateEffortModal()">Create Effort</button>
      <button class="batch-btn cancel" onclick="clearSelection()">Cancel</button>
      <button class="batch-btn later" onclick="batchAction('later')">Later All</button>
      <button class="batch-btn done" onclick="batchAction('complete')">Done All</button>
      <button class="batch-btn trash" onclick="confirmBatchTrash()">Trash All</button>
    </div>
  </div>

  <!-- Confirmation Modal -->
  <div id="confirm-modal" class="modal-overlay">
    <div class="modal">
      <h3>Confirm Batch Trash</h3>
      <p id="confirm-message">Are you sure you want to trash <strong>0</strong> items? This action cannot be undone for batches.</p>
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closeModal()">Cancel</button>
        <button class="modal-btn confirm" onclick="executeBatchTrash()">Trash All</button>
      </div>
    </div>
  </div>

  <!-- Create Effort Modal -->
  <div id="effort-modal" class="modal-overlay">
    <div class="modal effort-modal">
      <h3>Create Effort</h3>
      <p class="modal-subtitle">Group <strong id="effort-item-count">0</strong> selected tabs into a named effort.</p>
      <div class="effort-form">
        <label for="effort-name">What are you working on?</label>
        <input type="text" id="effort-name" placeholder="e.g., Google Flow Debugging" maxlength="100" autofocus />
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closeEffortModal()">Cancel</button>
        <button class="modal-btn create" onclick="createEffort()">Create Effort</button>
      </div>
    </div>
  </div>

  <script>
    const SESSION_ID = '${sessionId}';
    let unresolvedCount = ${unresolvedCount};
    const totalItems = ${totalItems};
    let resolvedCount = ${resolvedCount};
    const lastActions = new Map(); // Track last action per item for undo
    const ALL_CATEGORIES = ${JSON.stringify(allCategories)}; // All category names for bulk move

    function updateProgress() {
      const percent = totalItems > 0 ? Math.round((resolvedCount / totalItems) * 100) : 0;
      document.getElementById('progress-fill').style.width = percent + '%';
      document.getElementById('resolved-count').textContent = resolvedCount;
    }

    async function recordDisposition(itemId, action, extra = {}) {
      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, itemId, ...extra })
        });

        const result = await response.json();

        if (result.success) {
          // Update UI
          const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
          if (itemEl) {
            const statusClass = action === 'trash' ? 'trashed' : action === 'complete' ? 'completed' : action === 'defer' ? 'deferred' : action === 'later' ? 'later' : 'promoted';
            itemEl.classList.add(statusClass);

            // Track action for undo and show undo button
            lastActions.set(itemId, action);
            showUndoButton(itemEl, itemId, action);
          }

          // Update counts and progress
          unresolvedCount--;
          resolvedCount++;
          document.getElementById('unresolved-count').textContent = unresolvedCount;
          updateProgress();

          // Enable clear button if all resolved
          if (unresolvedCount === 0) {
            const btn = document.getElementById('clear-lock-btn');
            btn.classList.add('enabled');
            btn.disabled = false;
            btn.textContent = 'Complete Session';
            document.querySelector('.status').classList.add('complete');
          }

          showToast('Item ' + action + (action === 'trash' ? 'ed' : 'd'), 'success');
        } else {
          showToast(result.message || 'Failed', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    function showUndoButton(itemEl, itemId, lastAction) {
      // Remove existing undo button if any
      const existingUndo = itemEl.querySelector('.undo-container');
      if (existingUndo) existingUndo.remove();

      // Create undo container
      const undoContainer = document.createElement('div');
      undoContainer.className = 'undo-container';
      undoContainer.style.cssText = 'display: flex; gap: 8px; margin-left: auto;';

      const undoBtn = document.createElement('button');
      undoBtn.className = 'action-btn undo';
      undoBtn.textContent = 'Undo';
      undoBtn.onclick = () => undoDisposition(itemId, lastAction);

      undoContainer.appendChild(undoBtn);
      itemEl.appendChild(undoContainer);

      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (undoContainer.parentNode) {
          undoContainer.remove();
        }
      }, 10000);
    }

    async function undoDisposition(itemId, undoneAction) {
      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'undo', itemId, undoes: undoneAction })
        });

        const result = await response.json();

        if (result.success) {
          // Update UI - restore to pending
          const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
          if (itemEl) {
            itemEl.classList.remove('trashed', 'completed', 'promoted', 'deferred', 'later');

            // Remove undo button
            const undoContainer = itemEl.querySelector('.undo-container');
            if (undoContainer) undoContainer.remove();
          }

          // Update counts and progress
          unresolvedCount++;
          resolvedCount--;
          document.getElementById('unresolved-count').textContent = unresolvedCount;
          updateProgress();

          // Disable clear button if items now pending
          if (unresolvedCount > 0) {
            const btn = document.getElementById('clear-lock-btn');
            btn.classList.remove('enabled');
            btn.disabled = true;
            btn.textContent = 'Resolve all items to unlock';
            document.querySelector('.status').classList.remove('complete');
          }

          lastActions.delete(itemId);
          showToast('Action undone', 'success');
        } else {
          showToast(result.message || 'Failed to undo', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    // Move item to a different category (regroup)
    async function moveToCategory(itemId, newCategory, oldCategory) {
      if (!newCategory || newCategory === oldCategory) return;

      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'regroup',
            itemId: itemId,
            from: oldCategory,
            to: newCategory
          })
        });

        const result = await response.json();

        if (result.success) {
          // Move item visually to new category
          const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
          if (itemEl) {
            // Find the target category section
            const categories = document.querySelectorAll('.category');
            let targetCategory = null;
            for (const cat of categories) {
              const header = cat.querySelector('.category-header span');
              if (header && header.textContent === newCategory) {
                targetCategory = cat;
                break;
              }
            }

            if (targetCategory) {
              // Remove from old category
              const oldParent = itemEl.parentElement;
              itemEl.remove();

              // Update the dropdown to reflect new position
              const dropdown = itemEl.querySelector('.move-select');
              if (dropdown) {
                dropdown.setAttribute('onchange', "moveToCategory('" + escapeJsAttr(itemId) + "', this.value, '" + escapeJsAttr(newCategory) + "')");
                // Update options: disable current category, enable old one
                Array.from(dropdown.options).forEach(opt => {
                  opt.disabled = (opt.value === newCategory);
                });
              }

              // Insert into new category (before the closing of items)
              targetCategory.appendChild(itemEl);

              // Update item counts in both categories
              updateCategoryCounts();
            }
          }

          // Extract domain for learning feedback
          let domain = '';
          try {
            domain = new URL(itemId).hostname;
          } catch (e) {
            domain = itemId.substring(0, 30);
          }

          showToast('Moved to ' + newCategory + '. I\\'ll remember ' + domain + ' → ' + newCategory, 'success');
        } else {
          showToast(result.message || 'Failed to move item', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }

      // Reset the dropdown
      event.target.selectedIndex = 0;
    }

    // Update category item counts after move
    function updateCategoryCounts() {
      document.querySelectorAll('.category').forEach(cat => {
        const items = cat.querySelectorAll('.item:not(.trashed):not(.completed):not(.promoted):not(.deferred):not(.later)');
        const totalItems = cat.querySelectorAll('.item').length;
        const pendingCount = items.length;
        const countEl = cat.querySelector('.item-count');
        if (countEl) {
          countEl.textContent = pendingCount + ' pending / ' + totalItems + ' total';
        }
      });
    }

    // Escape for JS attributes
    function escapeJsAttr(str) {
      return String(str).replace(/'/g, "\\\\'").replace(/"/g, '\\\\"');
    }

    async function clearLock() {
      if (unresolvedCount > 0) return;

      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/clear-lock', {
          method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
          // Show completion overlay
          showCompletionScreen();

          // Try to close window (may fail due to browser security)
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          showToast(result.message || 'Failed to clear lock', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    function showCompletionScreen() {
      // Count how many corrections were made this session (regroups)
      // Note: In current implementation, regroups aren't surfaced in UI
      // but we track resolved count as a proxy for triage effort
      const triageCount = resolvedCount;

      const overlay = document.createElement('div');
      overlay.style.cssText = \`
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      \`;
      overlay.innerHTML = \`
        <div style="text-align: center; color: #fff;">
          <div style="font-size: 4em; margin-bottom: 0.3em;">✨</div>
          <h1 style="font-size: 2.5em; font-weight: 300; margin-bottom: 0.3em; color: #4ade80;">Session Complete</h1>
          <p style="font-size: 1.2em; color: #a0a0a0; margin-bottom: 0.5em;">All \${triageCount} items resolved. Lock cleared.</p>
          <div class="learning-badge" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; font-size: 14px; color: #6ee7b7; margin: 1em 0;">
            🧠 Your corrections help Memento learn
          </div>
          <p style="font-size: 0.95em; color: #666; margin-bottom: 2em;">Each action trains better classification over time.</p>
          <div style="margin-top: 1em;">
            <a href="/" style="color: #4a9eff; text-decoration: none; margin-right: 2em;">← Dashboard</a>
            <a href="/tasks" style="color: #4a9eff; text-decoration: none;">Next Task →</a>
          </div>
        </div>
      \`;
      document.body.appendChild(overlay);
    }

    // Development helper: Force clear lock without resolving all items
    async function forceClearLock() {
      if (!confirm('Force clear the lock? This is for development only.')) return;

      try {
        const response = await fetch('/api/lock/force-clear', {
          method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
          showToast('Lock force-cleared (dev mode)', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          showToast(result.message || 'Failed to clear lock', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast ' + type + ' show';
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // Batch Actions
    const selectedItems = new Set();

    function toggleItemSelection(itemId, checkbox) {
      if (checkbox.checked) {
        selectedItems.add(itemId);
      } else {
        selectedItems.delete(itemId);
      }
      updateBatchBar();
    }

    function updateBatchBar() {
      const batchBar = document.getElementById('batch-bar');
      const batchCount = document.getElementById('batch-count');
      batchCount.textContent = selectedItems.size;

      if (selectedItems.size > 0) {
        batchBar.classList.add('visible');
      } else {
        batchBar.classList.remove('visible');
      }
    }

    function clearSelection() {
      selectedItems.clear();
      document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = false);
      updateBatchBar();
    }

    async function batchAction(action) {
      if (selectedItems.size === 0) return;

      const dispositions = Array.from(selectedItems).map(itemId => ({
        action,
        itemId
      }));

      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/batch-disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispositions })
        });

        const result = await response.json();

        if (result.success) {
          // Update UI for each item
          const statusClass = action === 'trash' ? 'trashed' : action === 'complete' ? 'completed' : action === 'later' ? 'later' : 'promoted';

          selectedItems.forEach(itemId => {
            const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
            if (itemEl) {
              itemEl.classList.add(statusClass);
              const checkbox = itemEl.querySelector('.item-checkbox');
              if (checkbox) checkbox.checked = false;
            }
          });

          // Update counts
          const count = selectedItems.size;
          unresolvedCount -= count;
          resolvedCount += count;
          document.getElementById('unresolved-count').textContent = unresolvedCount;
          updateProgress();

          // Check if all resolved
          if (unresolvedCount === 0) {
            const btn = document.getElementById('clear-lock-btn');
            btn.classList.add('enabled');
            btn.disabled = false;
            btn.textContent = 'Complete Session';
            document.querySelector('.status').classList.add('complete');
          }

          clearSelection();
          showToast(count + ' items ' + (action === 'trash' ? 'trashed' : action === 'complete' ? 'completed' : 'marked later'), 'success');
        } else {
          showToast(result.message || 'Batch action failed', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    function confirmBatchTrash() {
      if (selectedItems.size === 0) return;

      const modal = document.getElementById('confirm-modal');
      const message = document.getElementById('confirm-message');
      message.innerHTML = 'Are you sure you want to trash <strong>' + selectedItems.size + '</strong> items? This action cannot be undone for batches.';
      modal.classList.add('visible');
    }

    function closeModal() {
      document.getElementById('confirm-modal').classList.remove('visible');
    }

    function executeBatchTrash() {
      closeModal();
      batchAction('trash');
    }

    // Batch move - move multiple items to a new category
    async function batchMove(newCategory) {
      if (!newCategory || selectedItems.size === 0) return;

      // Build dispositions for all selected items
      const dispositions = [];
      for (const itemId of selectedItems) {
        const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
        const oldCategory = itemEl ? itemEl.getAttribute('data-category') : 'Unknown';
        dispositions.push({
          action: 'regroup',
          itemId: itemId,
          from: oldCategory,
          to: newCategory
        });
      }

      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/batch-disposition', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispositions })
        });

        const result = await response.json();

        if (result.success) {
          // Move each item visually
          const categories = document.querySelectorAll('.category');
          let targetCategory = null;
          for (const cat of categories) {
            const header = cat.querySelector('.category-header span');
            if (header && header.textContent === newCategory) {
              targetCategory = cat;
              break;
            }
          }

          if (targetCategory) {
            selectedItems.forEach(itemId => {
              const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
              if (itemEl) {
                // Update data-category attribute
                itemEl.setAttribute('data-category', newCategory);

                // Update the move dropdown
                const dropdown = itemEl.querySelector('.move-select');
                if (dropdown) {
                  dropdown.setAttribute('onchange', "moveToCategory('" + escapeJsAttr(itemId) + "', this.value, '" + escapeJsAttr(newCategory) + "')");
                }

                // Move the element
                itemEl.remove();
                targetCategory.appendChild(itemEl);

                // Uncheck the checkbox
                const checkbox = itemEl.querySelector('.item-checkbox');
                if (checkbox) checkbox.checked = false;
              }
            });

            updateCategoryCounts();
          }

          const count = selectedItems.size;
          clearSelection();
          showToast(count + ' items moved to ' + newCategory, 'success');
        } else {
          showToast(result.message || 'Batch move failed', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }

      // Reset the dropdown
      document.getElementById('batch-move-select').selectedIndex = 0;
    }

    // Create Effort functions
    function showCreateEffortModal() {
      if (selectedItems.size === 0) {
        showToast('Select some items first', 'error');
        return;
      }

      document.getElementById('effort-item-count').textContent = selectedItems.size;
      document.getElementById('effort-name').value = '';
      document.getElementById('effort-modal').classList.add('visible');
      document.getElementById('effort-name').focus();
    }

    function closeEffortModal() {
      document.getElementById('effort-modal').classList.remove('visible');
    }

    async function createEffort() {
      const nameInput = document.getElementById('effort-name');
      const name = nameInput.value.trim();

      if (!name) {
        nameInput.focus();
        return;
      }

      if (selectedItems.size === 0) {
        showToast('No items selected', 'error');
        closeEffortModal();
        return;
      }

      // Gather item data for the effort
      const itemIds = Array.from(selectedItems);
      const items = [];
      for (const itemId of itemIds) {
        const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
        if (itemEl) {
          const title = itemEl.querySelector('.item-title a')?.textContent || itemId;
          const url = itemEl.querySelector('.item-title a')?.href || itemId;
          const category = itemEl.getAttribute('data-category') || 'Unknown';
          items.push({ itemId, title, url, category });
        }
      }

      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/effort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            items: items
          })
        });

        const result = await response.json();

        if (result.success) {
          closeEffortModal();

          // Hide the items from the category view (they're now in the effort)
          itemIds.forEach(itemId => {
            const itemEl = document.querySelector('[data-item-id="' + CSS.escape(itemId) + '"]');
            if (itemEl) {
              itemEl.style.display = 'none';
              itemEl.classList.add('in-effort');
              itemEl.setAttribute('data-effort-id', result.effort.id);
            }
          });

          // Add the effort to the UI
          addEffortToUI(result.effort);

          // Update category counts
          updateCategoryCounts();

          clearSelection();
          showToast('Effort "' + name + '" created with ' + items.length + ' tabs', 'success');
        } else {
          showToast(result.message || 'Failed to create effort', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    // Add an effort card to the UI
    function addEffortToUI(effort) {
      let container = document.getElementById('efforts-container');
      if (!container) {
        // Create efforts container if it doesn't exist
        container = document.createElement('div');
        container.id = 'efforts-container';
        container.className = 'efforts-container';
        container.innerHTML = '<div class="efforts-header">EFFORTS</div>';
        document.getElementById('categories').insertBefore(container, document.getElementById('categories').firstChild);
      }

      const effortCard = document.createElement('div');
      effortCard.className = 'effort-card';
      effortCard.id = 'effort-' + effort.id;
      effortCard.innerHTML = \`
        <div class="effort-header" onclick="toggleEffort('\${effort.id}')">
          <div>
            <span class="effort-name">\${escapeHtmlClient(effort.name)}</span>
            <span class="effort-count">(\${effort.items.length} tabs)</span>
          </div>
          <div class="effort-actions" onclick="event.stopPropagation()">
            <button class="effort-btn done" onclick="completeEffort('\${effort.id}')">Mark Done</button>
            <button class="effort-btn defer" onclick="deferEffort('\${effort.id}')">Defer</button>
          </div>
        </div>
        <div class="effort-items" id="effort-items-\${effort.id}">
          \${effort.items.map(item => \`
            <div class="effort-item">
              <a href="\${escapeHtmlClient(item.url)}" target="_blank">\${escapeHtmlClient(item.title)}</a>
            </div>
          \`).join('')}
        </div>
      \`;

      container.appendChild(effortCard);
    }

    function toggleEffort(effortId) {
      const items = document.getElementById('effort-items-' + effortId);
      if (items) {
        items.classList.toggle('expanded');
      }
    }

    async function completeEffort(effortId) {
      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/effort/' + effortId + '/complete', {
          method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
          const card = document.getElementById('effort-' + effortId);
          if (card) {
            card.classList.add('effort-completed');
            card.querySelector('.effort-actions').innerHTML = '<span style="color: #10b981">Completed</span>';
          }

          // Update counts
          unresolvedCount -= result.completedCount || 0;
          resolvedCount += result.completedCount || 0;
          document.getElementById('unresolved-count').textContent = unresolvedCount;
          updateProgress();

          // Check if all resolved
          if (unresolvedCount === 0) {
            const btn = document.getElementById('clear-lock-btn');
            btn.classList.add('enabled');
            btn.disabled = false;
            btn.textContent = 'Complete Session';
            document.querySelector('.status').classList.add('complete');
          }

          showToast('Effort completed!', 'success');
        } else {
          showToast(result.message || 'Failed to complete effort', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    async function deferEffort(effortId) {
      try {
        const response = await fetch('/api/launchpad/' + SESSION_ID + '/effort/' + effortId + '/defer', {
          method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
          const card = document.getElementById('effort-' + effortId);
          if (card) {
            card.classList.add('effort-completed');
            card.querySelector('.effort-actions').innerHTML = '<span style="color: #fcd34d">Deferred</span>';
          }

          // Update counts
          unresolvedCount -= result.deferredCount || 0;
          resolvedCount += result.deferredCount || 0;
          document.getElementById('unresolved-count').textContent = unresolvedCount;
          updateProgress();

          // Check if all resolved
          if (unresolvedCount === 0) {
            const btn = document.getElementById('clear-lock-btn');
            btn.classList.add('enabled');
            btn.disabled = false;
            btn.textContent = 'Complete Session';
            document.querySelector('.status').classList.add('complete');
          }

          showToast('Effort deferred', 'success');
        } else {
          showToast(result.message || 'Failed to defer effort', 'error');
        }
      } catch (error) {
        showToast('Error: ' + error.message, 'error');
      }
    }

    // Client-side HTML escaping
    function escapeHtmlClient(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Handle Enter key in effort name input
    document.addEventListener('DOMContentLoaded', function() {
      const effortInput = document.getElementById('effort-name');
      if (effortInput) {
        effortInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            createEffort();
          }
        });
      }
    });

    // Pause to Dashboard with confirmation
    function pauseToDashboard() {
      if (unresolvedCount > 0) {
        if (!confirm('You have ' + unresolvedCount + ' unresolved items. Leave triage and return to Dashboard?')) {
          return;
        }
      }
      window.location.href = '/';
    }

    // Also update the top bar progress when counts change
    var origUpdateProgress = updateProgress;
    updateProgress = function() {
      origUpdateProgress();
      var percent = totalItems > 0 ? Math.round((resolvedCount / totalItems) * 100) : 0;
      var topbarFill = document.getElementById('topbar-progress-fill');
      if (topbarFill) topbarFill.style.width = percent + '%';
      var topbarResolved = document.getElementById('topbar-resolved');
      if (topbarResolved) topbarResolved.textContent = resolvedCount;
    };

  </script>
  </div><!-- /.main-content -->
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
  </script>
</body>
</html>`;
}

/**
 * Render a category section with its items
 * @param {string} category - The category name
 * @param {Array} items - Items in this category
 * @param {Array} allCategories - All available categories (for move dropdown)
 */
function renderCategorySection(category, items, allCategories = []) {
  const pendingCount = items.filter(i => i.state.status === 'pending').length;

  // Determine special category classes
  // Protected categories have (Protected) suffix - these get no Trash button
  const isProtected = category.toLowerCase().includes('protected');
  const isSynthesis = category.toLowerCase().includes('synthesis') || category.toLowerCase().includes('academic');
  const categoryClass = isProtected ? 'protected' : (isSynthesis ? 'synthesis' : '');

  // Build move dropdown options (exclude current category)
  const moveOptions = allCategories
    .filter(cat => cat !== category)
    .map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  const itemHtml = items.map(item => `
    <div class="item ${item.state.status}" data-item-id="${escapeHtml(item.itemId)}" data-category="${escapeHtml(category)}">
      <input type="checkbox" class="item-checkbox" onchange="toggleItemSelection('${escapeJs(item.itemId)}', this)" />
      <div class="item-content">
        <div class="item-title">
          <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title || item.url)}</a>
        </div>
        <div class="item-url">${escapeHtml(item.url)}</div>
      </div>
      <div class="item-actions">
        <select class="move-select" onchange="moveToCategory('${escapeJs(item.itemId)}', this.value, '${escapeJs(category)}')">
          <option value="">Move to...</option>
          ${moveOptions}
        </select>
        ${isProtected ? `<button class="action-btn defer" onclick="recordDisposition('${escapeJs(item.itemId)}', 'defer')">Defer</button>` : `<button class="action-btn trash" onclick="recordDisposition('${escapeJs(item.itemId)}', 'trash')">Trash</button>`}
        <button class="action-btn later" onclick="recordDisposition('${escapeJs(item.itemId)}', 'later')">Later</button>
        <button class="action-btn complete" onclick="recordDisposition('${escapeJs(item.itemId)}', 'complete')">Done</button>
        <button class="action-btn promote" onclick="recordDisposition('${escapeJs(item.itemId)}', 'promote', {target: 'basic-memory://notes/promoted'})">${isSynthesis ? 'Synthesize' : 'Promote'}</button>
      </div>
    </div>
  `).join('\n');

  return `
    <div class="category ${categoryClass}">
      <div class="category-header">
        <span>${escapeHtml(category)}</span>
        <span class="item-count">${pendingCount} pending / ${items.length} total</span>
      </div>
      ${itemHtml}
    </div>
  `;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape for JavaScript string
 */
function escapeJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Render the efforts section
 * @param {Array} efforts - Array of effort objects
 * @returns {string} HTML for efforts section
 */
function renderEffortsSection(efforts) {
  if (!efforts || efforts.length === 0) return '';

  const effortCards = efforts.map(effort => {
    const isCompleted = effort.status === 'completed';
    const isDeferred = effort.status === 'deferred';
    const statusClass = isCompleted ? 'effort-completed' : (isDeferred ? 'effort-completed' : '');
    const statusLabel = isCompleted ? '<span style="color: #10b981">Completed</span>' :
                        isDeferred ? '<span style="color: #fcd34d">Deferred</span>' :
                        `<button class="effort-btn done" onclick="completeEffort('${escapeJs(effort.id)}')">Mark Done</button>
                         <button class="effort-btn defer" onclick="deferEffort('${escapeJs(effort.id)}')">Defer</button>`;

    const itemsHtml = effort.items.map(item => `
      <div class="effort-item">
        <a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.title)}</a>
      </div>
    `).join('');

    return `
      <div class="effort-card ${statusClass}" id="effort-${escapeHtml(effort.id)}">
        <div class="effort-header" onclick="toggleEffort('${escapeJs(effort.id)}')">
          <div>
            <span class="effort-name">${escapeHtml(effort.name)}</span>
            <span class="effort-count">(${effort.items.length} tabs)</span>
          </div>
          <div class="effort-actions" onclick="event.stopPropagation()">
            ${statusLabel}
          </div>
        </div>
        <div class="effort-items" id="effort-items-${escapeHtml(effort.id)}">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="efforts-container" class="efforts-container">
      <div class="efforts-header">EFFORTS</div>
      ${effortCards}
    </div>
  `;
}

module.exports = {
  renderLaunchpadPage
};
