/**
 * Task Picker Renderer
 *
 * Renders the "One Thing" interface - a single task with LLM-enriched content.
 * The core of the Task-Driven Attention System.
 *
 * Key elements:
 * 1. Insight - The confrontational observation
 * 2. Why This Matters - LLM-derived context connecting to user's goals
 * 3. The Question - The derived goal framed as a question
 * 4. Actions - Generated based on the specific situation
 *
 * @see ../docs/plans/task-driven-attention.md for design context
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Dark theme CSS overrides for the task picker
 * Overrides layout.js defaults to achieve the dark centered aesthetic
 */
const darkThemeCSS = `
    /* Dark theme overrides */
    :root {
      --bg-primary: #0d0d0d;
      --bg-secondary: #1a1a1a;
      --bg-card: #1a1a1a;
      --text-primary: #f5f5f5;
      --text-secondary: #a0a0a0;
      --text-muted: #666666;
      --accent-link: #4a9eff;
      --accent-blue: #4a9eff;
      --accent-green: #4ade80;
      --accent-red: #f87171;
      --border-light: #2a2a2a;
      --border-subtle: #2a2a2a;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    /* Nav dark overrides */
    .main-nav {
      background: var(--bg-secondary);
      border-bottom-color: var(--border-light);
    }
    .nav-brand a { color: var(--text-primary); }
    .nav-link { color: var(--text-secondary); }
    .nav-link:hover { background: rgba(255,255,255,0.05); }
    .nav-link.active { background: var(--accent-blue); color: white; }
    .nav-btn { background: var(--accent-blue); }
    .nav-btn:hover { background: #3a8eef; }
    .dev-toggle-btn { color: var(--text-muted); border-color: var(--border-light); }
    .dev-toggle-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
    .session-nav { background: var(--bg-secondary); border-bottom-color: var(--border-light); }

    /* Centered container layout */
    .page-content {
      max-width: 600px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: calc(100vh - 4em);
      padding: 2em;
    }
    .task-container {
      max-width: 600px;
      width: 100%;
    }

    /* Header */
    .task-header {
      text-align: center;
      margin-bottom: 2em;
    }

    /* Insight Section */
    .insight-section {
      text-align: center;
      margin-bottom: 2em;
    }
    .insight-text {
      font-size: 1.8em;
      font-weight: 300;
      line-height: 1.4;
      margin-bottom: 1em;
    }
    .insight-text strong {
      color: var(--accent-blue);
      font-weight: 400;
    }

    /* Item Card */
    .item-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 1.25em;
      margin-bottom: 1.5em;
    }
    .item-title {
      font-size: 1.1em;
      font-weight: 500;
      font-style: normal;
      margin-bottom: 0.25em;
      color: var(--text-primary);
    }
    .item-title a {
      color: var(--text-primary);
      text-decoration: none;
    }
    .item-title a:hover {
      color: var(--accent-blue);
    }
    .item-subtitle {
      font-size: 0.9em;
      color: var(--text-muted);
    }
    .item-meta {
      display: flex;
      gap: 1em;
      margin-top: 0.75em;
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    .item-meta-badge {
      background: var(--border-subtle);
      padding: 2px 8px;
      border-radius: 4px;
    }

    /* Why This Matters */
    .why-section {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-left: 3px solid var(--accent-blue);
      border-radius: 0 12px 12px 0;
      padding: 1.25em;
      margin-bottom: 1.5em;
    }
    .why-header {
      font-size: 0.75em;
      font-style: normal;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-blue);
      margin-bottom: 0.75em;
    }
    .why-text {
      font-size: 1em;
      line-height: 1.6;
      color: var(--text-secondary);
    }
    .the-question {
      margin-top: 1em;
      padding-top: 1em;
      border-top: 1px solid var(--border-subtle);
      font-style: italic;
      color: var(--text-primary);
      font-size: 1.05em;
    }

    /* Actions */
    .actions-section {
      margin-bottom: 2em;
    }
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75em;
    }
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.25em 1em;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 0.95em;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .action-btn:hover {
      background: #252525;
      border-color: var(--text-muted);
      transform: translateY(-2px);
    }
    .action-btn.primary {
      background: var(--accent-blue);
      border-color: var(--accent-blue);
      color: white;
    }
    .action-btn.primary:hover {
      background: #3a8eef;
    }
    .action-btn.release {
      border-color: var(--accent-red);
    }
    .action-btn.release:hover {
      background: rgba(248, 113, 113, 0.1);
    }
    .action-icon {
      font-size: 1.5em;
      margin-bottom: 0.5em;
    }
    .action-label {
      text-align: center;
      line-height: 1.3;
    }
    .action-desc {
      text-align: center;
      font-size: 0.75em;
      color: var(--text-muted);
      margin-top: 0.4em;
      line-height: 1.3;
    }
    .action-btn.primary .action-desc {
      color: rgba(255,255,255,0.7);
    }
    .action-btn.stub {
      border-style: dashed;
      opacity: 0.7;
    }
    .action-btn.stub .action-label::after {
      content: ' (coming soon)';
      font-size: 0.8em;
      color: var(--text-muted);
    }

    /* Skip link */
    .skip-section {
      text-align: center;
      margin-top: 1em;
    }
    .skip-link {
      color: var(--text-muted);
      font-size: 0.9em;
      text-decoration: none;
      cursor: pointer;
      border: none;
      background: none;
      font-family: inherit;
    }
    .skip-link:hover {
      color: var(--text-secondary);
    }

    /* Loading state for buttons */
    .action-btn.loading {
      opacity: 0.7;
      pointer-events: none;
    }
    .action-btn .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Completion toast */
    .completion-toast {
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: rgba(74, 222, 128, 0.95);
      color: #000;
      padding: 1em 2em;
      border-radius: 12px;
      font-size: 1.5em;
      font-weight: 500;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1000;
    }
    .completion-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .completion-toast.release {
      background: rgba(248, 113, 113, 0.95);
    }
    .completion-toast.defer {
      background: rgba(251, 191, 36, 0.95);
    }
    .toast-icon {
      font-size: 1.2em;
      margin-right: 0.3em;
    }

    /* Confirmation modal */
    .confirm-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .confirm-modal.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .confirm-content {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 16px;
      padding: 2em;
      max-width: 400px;
      text-align: center;
    }
    .confirm-icon {
      font-size: 2.5em;
      margin-bottom: 0.5em;
    }
    .confirm-title {
      font-size: 1.3em;
      font-style: normal;
      margin-bottom: 0.5em;
    }
    .confirm-message {
      color: var(--text-secondary);
      margin-bottom: 1.5em;
      line-height: 1.5;
    }
    .confirm-actions {
      display: flex;
      gap: 1em;
      justify-content: center;
    }
    .confirm-btn {
      padding: 0.75em 1.5em;
      border-radius: 8px;
      font-family: inherit;
      font-size: 1em;
      cursor: pointer;
      border: 1px solid var(--border-subtle);
    }
    .confirm-btn.cancel {
      background: var(--bg-card);
      color: var(--text-secondary);
    }
    .confirm-btn.cancel:hover {
      background: #252525;
    }
    .confirm-btn.confirm {
      background: var(--accent-red);
      border-color: var(--accent-red);
      color: white;
    }
    .confirm-btn.confirm:hover {
      background: #e85555;
    }

    /* Stats footer */
    .stats-footer {
      text-align: center;
      padding-top: 2em;
      border-top: 1px solid var(--border-subtle);
      margin-top: 2em;
      color: var(--text-muted);
      font-size: 0.85em;
    }
    .stats-footer a {
      color: var(--text-secondary);
      text-decoration: none;
    }
    .stats-footer a:hover {
      color: var(--accent-blue);
    }

    /* Task type badge */
    .task-type-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1em;
    }
    .task-type-ghost_tab {
      background: rgba(74, 158, 255, 0.2);
      color: var(--accent-blue);
    }
    .task-type-project_revival {
      background: rgba(74, 222, 128, 0.2);
      color: var(--accent-green);
    }
    .task-type-tab_bankruptcy {
      background: rgba(248, 113, 113, 0.2);
      color: var(--accent-red);
    }

    /* Enrichment loading indicator */
    .enrichment-status {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85em;
      margin-bottom: 1.5em;
      transition: opacity 0.4s ease;
    }
    .enrichment-status.hidden {
      opacity: 0;
      pointer-events: none;
    }
    .enrichment-shimmer {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid transparent;
      border-top-color: var(--text-muted);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 0.4em;
    }

    /* Fade-in for enriched content */
    .enrichment-fade {
      animation: enrichFadeIn 0.4s ease;
    }
    @keyframes enrichFadeIn {
      from { opacity: 0.5; }
      to { opacity: 1; }
    }

    /* Intent panel (dev-only) */
    .intent-panel {
      margin-top: 1.5em;
      border-top: 1px solid var(--border-subtle);
      padding-top: 1em;
    }
    .intent-toggle {
      background: none;
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 6px 14px;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.8em;
      cursor: pointer;
      width: 100%;
    }
    .intent-toggle:hover {
      color: var(--text-secondary);
      border-color: var(--text-muted);
    }
    .intent-body {
      margin-top: 1em;
    }
    .intent-section {
      margin-bottom: 1.25em;
    }
    .intent-section h4 {
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-blue);
      margin-bottom: 0.5em;
    }
    .intent-text {
      font-size: 0.85em;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .intent-elements {
      display: flex;
      flex-direction: column;
      gap: 0.4em;
    }
    .intent-element-row {
      display: flex;
      align-items: center;
      gap: 0.5em;
      font-size: 0.8em;
      color: var(--text-secondary);
      padding: 4px 0;
    }
    .intent-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .intent-status.working { background: var(--accent-green); }
    .intent-status.stub { background: #fbbf24; }
    .intent-status.broken { background: var(--accent-red); }
    .intent-el-label {
      font-weight: 500;
      color: var(--text-primary);
      min-width: 100px;
    }
    .intent-el-desc {
      color: var(--text-muted);
      font-size: 0.9em;
    }
    .intent-notes {
      width: 100%;
      min-height: 60px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 8px;
      font-family: inherit;
      font-size: 0.85em;
      resize: vertical;
    }
    .intent-notes:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .intent-save {
      margin-top: 0.5em;
      background: var(--bg-secondary);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      padding: 5px 14px;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.8em;
      cursor: pointer;
    }
    .intent-save:hover {
      border-color: var(--accent-blue);
      color: var(--accent-blue);
    }
    #intent-save-status {
      font-size: 0.8em;
      color: var(--accent-green);
      margin-left: 0.5em;
    }

    /* Conversation prompts (hidden in MVP) */
    .conversation-section {
      display: none; /* Hidden in MVP Phase 1 */
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 1em;
      margin-bottom: 1.5em;
    }
    .conversation-header {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 0.75em;
    }
    .conversation-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5em;
    }
    .prompt-chip {
      background: var(--border-subtle);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .prompt-chip:hover {
      background: #333;
      color: var(--text-primary);
    }
`;

/**
 * Render the task picker page
 *
 * @param {Object} enrichedTask - Task enriched with LLM content, or null
 * @param {Object} stats - Attention stats from taskGenerator
 * @returns {string} HTML page
 */
function renderTaskPickerPage(enrichedTask, stats = {}, options = {}) {
  if (!enrichedTask) {
    return renderEmptyState(stats);
  }

  const {
    id,
    type,
    title,
    url,
    domain,
    projectName,
    openCount,
    daysSinceActive,
    affectedCount,
    insight,
    whyThisMatters,
    theQuestion,
    actions,
    conversationPrompts,
    categories,
    score,
    sourceSessionId
  } = enrichedTask;

  // Get the display title based on task type
  const displayTitle = title || projectName || 'This pattern';
  const displaySubtitle = type === 'ghost_tab' ? domain :
                          type === 'project_revival' ? `${daysSinceActive} days dormant` :
                          type === 'tab_bankruptcy' ? `${affectedCount} tabs` : '';

  const bodyContent = `
  <div class="page-content">
    <div class="task-container">
      <header class="task-header">
        <span class="task-type-badge task-type-${escapeHtml(type)}">${formatTaskType(type)}</span>
      </header>

      <section class="insight-section">
        <p id="enrichment-insight" class="insight-text">${formatInsight(insight)}</p>
        <div id="enrichment-status" class="enrichment-status">
          <span class="enrichment-shimmer"></span> Thinking deeper...
        </div>
      </section>

      <div class="item-card">
        <h2 class="item-title">
          ${url ? `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(displayTitle)}</a>` : escapeHtml(displayTitle)}
        </h2>
        <p class="item-subtitle">${escapeHtml(displaySubtitle)}</p>
        ${renderItemMeta(enrichedTask)}
      </div>

      <section class="why-section">
        <h3 class="why-header">Why This Matters</h3>
        <p id="enrichment-why" class="why-text">${escapeHtml(whyThisMatters)}</p>
        <p id="enrichment-question" class="the-question" ${theQuestion ? '' : 'style="display:none"'}>${theQuestion ? escapeHtml(theQuestion) : ''}</p>
      </section>

      <section class="actions-section">
        <div id="enrichment-actions" class="actions-grid">
          ${renderActions(actions, id)}
        </div>
      </section>

      <div class="skip-section">
        <button class="skip-link" onclick="skipTask()">
          Show me something else
        </button>
        <span style="font-size: 0.8em; color: var(--text-muted); margin-left: 0.5em;">(won't be recorded)</span>
      </div>

      <!-- Confirmation Modal -->
      <div id="confirm-modal" class="confirm-modal">
        <div class="confirm-content">
          <div id="confirm-icon" class="confirm-icon">&#127754;</div>
          <h3 id="confirm-title" class="confirm-title">Let this go?</h3>
          <p id="confirm-message" class="confirm-message">This will mark the item as released across all sessions.</p>
          <div class="confirm-actions">
            <button class="confirm-btn cancel" onclick="cancelConfirm()">Cancel</button>
            <button id="confirm-proceed" class="confirm-btn confirm" onclick="proceedConfirm()">Yes, let it go</button>
          </div>
        </div>
      </div>

      <footer class="stats-footer">
        ${stats.ghostTabCount ? `${stats.ghostTabCount} ghost tabs` : ''}
        ${stats.neglectedProjectCount ? ` &middot; ${stats.neglectedProjectCount} neglected projects` : ''}
        ${stats.totalSessions ? ` &middot; ${stats.totalSessions} sessions analyzed` : ''}
        <br>
        ${sourceSessionId ? `<a href="/results/${escapeHtml(sourceSessionId)}">View source session</a> &middot; ` : ''}
        <a href="/history">Browse all sessions</a>
      </footer>

      <div class="dev-only-block">
        <div class="intent-panel">
          <button class="intent-toggle" onclick="toggleIntentPanel()">
            Intent &amp; Feedback
          </button>
          <div id="intent-panel-body" class="intent-body" style="display:none">
            <div class="intent-section">
              <h4>Page Intent</h4>
              <div id="intent-description" class="intent-text"></div>
            </div>
            <div class="intent-section">
              <h4>Element Map</h4>
              <div id="intent-elements" class="intent-elements"></div>
            </div>
            <div class="intent-section">
              <h4>Your Notes</h4>
              <textarea id="intent-notes" class="intent-notes"
                        placeholder="What's broken, confusing, or missing?"></textarea>
              <button class="intent-save" onclick="saveIntentNotes()">Save</button>
              <span id="intent-save-status"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const extraScripts = `
  <script>
    const taskId = '${escapeHtml(id)}';
    const taskData = ${JSON.stringify({
      id,
      type,
      title: displayTitle,
      url,
      score,
      insight,
      theQuestion
    })};

    let currentClickedBtn = null;
    let pendingAction = null;

    // Toast messages for each action
    const toastMessages = {
      engage: { icon: '\\u26A1', text: 'On it!', class: '' },
      release: { icon: '\\uD83C\\uDF0A', text: 'Let go', class: 'release' },
      defer: { icon: '\\u23F0', text: 'Saved for later', class: 'defer' },
      skip: { icon: '\\u27A1\\uFE0F', text: 'Skipping...', class: '' },
      triage: { icon: '\\uD83C\\uDFAF', text: 'Opening triage...', class: '' },
      detailed: { icon: '\\uD83D\\uDCCB', text: 'Opening review...', class: '' },
      release_all: { icon: '\\uD83D\\uDD25', text: 'Cleared!', class: 'release' },
      pause: { icon: '\\u23F8\\uFE0F', text: 'Project paused', class: 'defer' }
    };

    // Confirmation details for destructive actions
    const confirmDetails = {
      release: {
        icon: '\\uD83C\\uDF0A',
        title: 'Let this go?',
        message: 'This will mark the item as released and it won\\'t appear again.',
        button: 'Yes, let it go'
      },
      release_all: {
        icon: '\\uD83D\\uDD25',
        title: 'Declare tab bankruptcy?',
        message: 'This will clear ALL stale tabs across all sessions. This cannot be undone.',
        button: 'Yes, clear everything'
      }
    };

    function showToast(action, serverMessage) {
      serverMessage = serverMessage || null;
      var msg = toastMessages[action] || { icon: '\\u2713', text: 'Done', class: '' };
      var displayText = serverMessage || msg.text;
      var toast = document.createElement('div');
      toast.className = 'completion-toast ' + msg.class;
      toast.innerHTML = '<span class="toast-icon">' + msg.icon + '</span> ' + displayText;
      document.body.appendChild(toast);
      requestAnimationFrame(function() { toast.classList.add('visible'); });
      return toast;
    }

    function setButtonLoading(btn, loading) {
      if (!btn) return;
      if (loading) {
        btn.disabled = true;
        btn.classList.add('loading');
        btn._originalContent = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span>';
      } else {
        btn.disabled = false;
        btn.classList.remove('loading');
        if (btn._originalContent) {
          btn.innerHTML = btn._originalContent;
        }
      }
    }

    function showConfirmModal(action) {
      var details = confirmDetails[action];
      if (!details) return false;

      document.getElementById('confirm-icon').textContent = details.icon;
      document.getElementById('confirm-title').textContent = details.title;
      document.getElementById('confirm-message').textContent = details.message;
      document.getElementById('confirm-proceed').textContent = details.button;

      pendingAction = action;
      document.getElementById('confirm-modal').classList.add('visible');
      return true;
    }

    function cancelConfirm() {
      document.getElementById('confirm-modal').classList.remove('visible');
      if (currentClickedBtn) {
        setButtonLoading(currentClickedBtn, false);
        currentClickedBtn = null;
      }
      pendingAction = null;
    }

    function proceedConfirm() {
      document.getElementById('confirm-modal').classList.remove('visible');
      if (pendingAction) {
        executeAction(pendingAction);
      }
    }

    function recordAction(taskId, action, event) {
      // Get the clicked button
      if (event && event.target) {
        currentClickedBtn = event.target.closest('.action-btn');
      }

      // Check if this action needs confirmation
      if (confirmDetails[action]) {
        if (showConfirmModal(action)) {
          return;
        }
      }

      executeAction(action);
    }

    function executeAction(action) {
      // Show loading state
      setButtonLoading(currentClickedBtn, true);

      fetch('/api/tasks/' + taskId + '/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          taskType: '${escapeHtml(type)}',
          action: action,
          task: taskData
        })
      })
      .then(function(response) { return response.json(); })
      .then(function(result) {
        if (result.success) {
          showToast(action, result.toastMessage || result.message);

          // Stub actions stay on page; real actions navigate away
          if (!result.isStub) {
            setTimeout(function() {
              window.location.href = result.redirectTo || '/tasks?completed=' + action;
            }, 1500);
          } else {
            setButtonLoading(currentClickedBtn, false);
          }
        } else {
          setButtonLoading(currentClickedBtn, false);
          alert('Failed: ' + result.message);
        }
      })
      .catch(function(error) {
        console.error('Action failed:', error);
        setButtonLoading(currentClickedBtn, false);
        alert('Something went wrong. Please try again.');
      });
    }

    function skipTask() {
      // Skip doesn't record - just shows the next task
      window.location.href = '/tasks';
    }

    function openUrl(url, event) {
      window.open(url, '_blank');
      // Record engage silently -- don't navigate away
      fetch('/api/tasks/' + taskId + '/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          taskType: taskData.type,
          action: 'engage',
          task: taskData
        })
      }).then(function(r) { return r.json(); }).then(function(result) {
        if (result.success) {
          showToast('engage', result.toastMessage || result.message);
        }
      }).catch(function() {});
    }

    // --- Async LLM Enrichment ---
    ${options.rawTask ? `
    var rawTask = ${JSON.stringify(options.rawTask)};

    function formatInsightClient(text) {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/(\\d+)/g, '<strong>$1</strong>');
    }

    function escapeHtmlClient(text) {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function buildActionsHtml(actions) {
      var descriptions = {
        engage: 'Opens in new tab, records it',
        release: 'Closes this open loop for good',
        defer: 'Hides this for a while',
        triage: 'Pick what to keep, drop the rest',
        detailed: 'Walk through items one by one',
        release_all: 'Clear everything, start fresh',
        pause: 'Put this on hold',
        explore: 'Talk through what to do next'
      };
      var stubs = { triage: true, detailed: true, explore: true };
      if (!actions || actions.length === 0) return '';
      return actions.filter(function(action) { return !stubs[action.type]; }).map(function(action, i) {
        var isPrimary = i === 0;
        var isRelease = action.type === 'release' || action.type === 'release_all';
        var classes = ['action-btn'];
        if (isPrimary) classes.push('primary');
        if (isRelease) classes.push('release');
        var desc = descriptions[action.type] || '';
        var onclick = action.type === 'engage' && actions[0] && actions[0].url
          ? "openUrl('" + escapeHtmlClient(actions[0].url) + "', event)"
          : "recordAction('" + escapeHtmlClient(taskId) + "', '" + escapeHtmlClient(action.type) + "', event)";
        return '<button class="' + classes.join(' ') + '" onclick="' + onclick + '">'
          + '<span class="action-icon">' + (action.icon || '&#9889;') + '</span>'
          + '<span class="action-label">' + escapeHtmlClient(action.label) + '</span>'
          + (desc ? '<span class="action-desc">' + escapeHtmlClient(desc) + '</span>' : '')
          + '</button>';
      }).join('');
    }

    (function fetchEnrichment() {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 60000);

      fetch('/api/tasks/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: rawTask }),
        signal: controller.signal
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        clearTimeout(timeoutId);
        var statusEl = document.getElementById('enrichment-status');
        if (!data.success || !data.enrichment) {
          if (statusEl) statusEl.classList.add('hidden');
          return;
        }
        var e = data.enrichment;

        // Update insight
        var insightEl = document.getElementById('enrichment-insight');
        if (insightEl && e.insight) {
          insightEl.innerHTML = formatInsightClient(e.insight);
          insightEl.classList.add('enrichment-fade');
        }

        // Update why this matters
        var whyEl = document.getElementById('enrichment-why');
        if (whyEl && e.whyThisMatters) {
          whyEl.textContent = e.whyThisMatters;
          whyEl.classList.add('enrichment-fade');
        }

        // Update the question
        var questionEl = document.getElementById('enrichment-question');
        if (questionEl) {
          if (e.theQuestion) {
            questionEl.textContent = e.theQuestion;
            questionEl.style.display = '';
            questionEl.classList.add('enrichment-fade');
          }
        }

        // Update actions
        var actionsEl = document.getElementById('enrichment-actions');
        if (actionsEl && e.actions && e.actions.length > 0) {
          actionsEl.innerHTML = buildActionsHtml(e.actions);
          actionsEl.classList.add('enrichment-fade');
        }

        // Update taskData so action dispatches include enriched info
        if (e.insight) taskData.insight = e.insight;
        if (e.theQuestion) taskData.theQuestion = e.theQuestion;

        // Hide loading indicator
        if (statusEl) statusEl.classList.add('hidden');
      })
      .catch(function() {
        clearTimeout(timeoutId);
        var statusEl = document.getElementById('enrichment-status');
        if (statusEl) statusEl.classList.add('hidden');
      });
    })();
    ` : `
    // No rawTask - hide loading indicator
    (function() {
      var statusEl = document.getElementById('enrichment-status');
      if (statusEl) statusEl.classList.add('hidden');
    })();
    `}

    // --- Intent Panel ---
    var intentDoc = {
      page: '/tasks',
      purpose: 'Surface one attention pattern. Force a decision. Move on.',
      taskType: '${escapeHtml(type)}',
      elements: [
        { id: 'insight', label: 'Insight text', intent: 'Confrontational observation from LLM. Should provoke, not describe.', status: 'working' },
        { id: 'item-card', label: 'Item card', intent: 'The thing demanding attention. Clickable title opens it.', status: 'working' },
        { id: 'why-section', label: 'Why This Matters', intent: 'LLM connects this pattern to user goals. Fallback is generic.', status: 'working' },
        { id: 'the-question', label: 'The Question', intent: 'Reframes the task as a question the user needs to answer.', status: 'working' },
        ${generateActionIntentsJS(type)}
        { id: 'skip', label: 'Skip button', intent: 'Shows next task without recording anything. No penalty.', status: 'working' }
      ]
    };

    function toggleIntentPanel() {
      var body = document.getElementById('intent-panel-body');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        renderIntentPanel();
      } else {
        body.style.display = 'none';
      }
    }

    function renderIntentPanel() {
      // Description
      var descEl = document.getElementById('intent-description');
      if (descEl) {
        descEl.textContent = intentDoc.purpose + ' (Task type: ' + intentDoc.taskType + ')';
      }

      // Element map
      var elContainer = document.getElementById('intent-elements');
      if (elContainer) {
        elContainer.innerHTML = intentDoc.elements.map(function(el) {
          return '<div class="intent-element-row">'
            + '<span class="intent-status ' + el.status + '"></span>'
            + '<span class="intent-el-label">' + el.label + '</span>'
            + '<span class="intent-el-desc">' + el.intent + '</span>'
            + '</div>';
        }).join('');
      }

      // Load saved notes
      fetch('/api/dev/intent-notes?page=tasks&taskType=' + intentDoc.taskType)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.notes) {
            document.getElementById('intent-notes').value = data.notes;
          }
        })
        .catch(function() {});
    }

    function saveIntentNotes() {
      var notes = document.getElementById('intent-notes').value;
      fetch('/api/dev/intent-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'tasks', taskType: intentDoc.taskType, notes: notes })
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.success) {
          var status = document.getElementById('intent-save-status');
          status.textContent = 'Saved';
          setTimeout(function() { status.textContent = ''; }, 2000);
        }
      })
      .catch(function() {});
    }
  </script>`;

  return wrapInLayout(bodyContent, {
    currentPage: 'tasks',
    title: 'One Thing',
    extraHead: darkThemeCSS,
    extraScripts
  });
}

/**
 * Format task type for display
 */
function formatTaskType(type) {
  switch (type) {
    case 'ghost_tab': return 'Ghost Tab';
    case 'project_revival': return 'Neglected Project';
    case 'tab_bankruptcy': return 'Tab Debt';
    default: return type;
  }
}

/**
 * Format insight with emphasis
 * Note: We escape HTML but preserve apostrophes for readability
 */
function formatInsight(insight) {
  if (!insight) return '';

  // Escape HTML characters but preserve apostrophes (they're safe in content)
  let formatted = insight
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Don't escape apostrophes - they display fine and &#39; looks ugly

  // Bold numbers in the insight
  formatted = formatted.replace(/(\d+)/g, '<strong>$1</strong>');

  return formatted;
}

/**
 * Render item metadata based on task type
 */
function renderItemMeta(task) {
  const badges = [];

  if (task.openCount) {
    badges.push(`Opened ${task.openCount}x`);
  }
  if (task.categories && task.categories.length > 0) {
    badges.push(task.categories[0]);
  }
  if (task.daysSinceActive) {
    badges.push(`${task.daysSinceActive} days`);
  }
  if (task.totalSessions) {
    badges.push(`${task.totalSessions} sessions`);
  }
  if (task.affectedCount) {
    badges.push(`${task.affectedCount} items`);
  }

  if (badges.length === 0) return '';

  return `
    <div class="item-meta">
      ${badges.map(b => `<span class="item-meta-badge">${escapeHtml(b)}</span>`).join('')}
    </div>
  `;
}

/**
 * Generate action intent entries as JS literal strings for the intent panel.
 * Varies by task type.
 */
function generateActionIntentsJS(type) {
  switch (type) {
    case 'ghost_tab':
      return `
        { id: 'engage', label: 'Engage button', intent: 'Opens URL in new tab, records action silently.', status: 'working' },
        { id: 'release', label: 'Release button', intent: 'Blocks URL across all sessions. Permanent.', status: 'working' },
        { id: 'defer', label: 'Defer button', intent: 'Hides task for 24h then resurfaces.', status: 'working' },`;
    case 'project_revival':
      return `
        { id: 'engage', label: 'Engage button', intent: 'Opens project in Launchpad or history.', status: 'working' },
        { id: 'pause', label: 'Pause button', intent: 'Pauses project for 30 days. No guilt.', status: 'working' },
        { id: 'explore', label: 'Think about it', intent: 'Should open conversation UI. Not built yet.', status: 'stub' },`;
    case 'tab_bankruptcy':
      return `
        { id: 'triage', label: 'Triage button', intent: 'Should open keep-5-release-rest UI. Not built yet.', status: 'stub' },
        { id: 'detailed', label: 'Detailed review', intent: 'Should open one-by-one review UI. Not built yet.', status: 'stub' },
        { id: 'release_all', label: 'Release all', intent: 'Declares bankruptcy, blocks all stale tabs.', status: 'working' },`;
    default:
      return '';
  }
}

/**
 * Render action buttons
 */
function renderActions(actions, taskId) {
  // Visible descriptions for each action type
  const descriptions = {
    engage: 'Opens in new tab, records it',
    release: 'Closes this open loop for good',
    defer: 'Hides this for a while',
    triage: 'Pick what to keep, drop the rest',
    detailed: 'Walk through items one by one',
    release_all: 'Clear everything, start fresh',
    pause: 'Put this on hold',
    explore: 'Talk through what to do next'
  };
  // Actions that aren't wired up yet
  const stubs = new Set(['triage', 'detailed', 'explore']);

  if (!actions || actions.length === 0) {
    return `
      <button class="action-btn primary" onclick="recordAction('${escapeHtml(taskId)}', 'engage', event)">
        <span class="action-icon">&#9889;</span>
        <span class="action-label">Deal with it</span>
        <span class="action-desc">${descriptions.engage}</span>
      </button>
      <button class="action-btn release" onclick="recordAction('${escapeHtml(taskId)}', 'release', event)">
        <span class="action-icon">&#127754;</span>
        <span class="action-label">Let it go</span>
        <span class="action-desc">${descriptions.release}</span>
      </button>
    `;
  }

  return actions.filter(action => !stubs.has(action.type)).map((action, i) => {
    const isPrimary = i === 0;
    const isRelease = action.type === 'release' || action.type === 'release_all';
    const btnClass = [
      isPrimary ? 'primary' : '',
      isRelease ? 'release' : ''
    ].filter(Boolean).join(' ');
    const desc = descriptions[action.type] || '';

    return `
      <button class="action-btn ${btnClass}"
              onclick="${action.type === 'engage' && actions[0]?.url ?
                `openUrl('${escapeHtml(actions[0].url)}', event)` :
                `recordAction('${escapeHtml(taskId)}', '${escapeHtml(action.type)}', event)`}">
        <span class="action-icon">${action.icon || '&#9889;'}</span>
        <span class="action-label">${escapeHtml(action.label)}</span>
        ${desc ? `<span class="action-desc">${escapeHtml(desc)}</span>` : ''}
      </button>
    `;
  }).join('');
}

/**
 * Render empty state when no tasks
 */
function renderEmptyState(stats) {
  const emptyCSS = darkThemeCSS + `
    .empty-container {
      max-width: 500px;
      width: 100%;
      text-align: center;
    }
    .empty-icon {
      font-size: 4em;
      margin-bottom: 0.5em;
    }
    .empty-container h1 {
      font-size: 2em;
      font-weight: 300;
      font-style: normal;
      margin-bottom: 0.5em;
      color: var(--accent-green);
    }
    .empty-message {
      color: var(--text-secondary);
      font-size: 1.1em;
      line-height: 1.6;
      margin-bottom: 2em;
    }
    .empty-stats {
      color: var(--text-muted);
      font-size: 0.9em;
      margin-bottom: 2em;
    }
    .action-link {
      display: inline-block;
      padding: 0.75em 1.5em;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.2s;
    }
    .action-link:hover {
      background: #252525;
      color: var(--text-primary);
      text-decoration: none;
    }
  `;

  const bodyContent = `
  <div class="page-content">
    <div class="empty-container">
      <div class="empty-icon">&#10024;</div>
      <h1>Nothing Urgent</h1>
      <p class="empty-message">
        No attention patterns need your immediate focus.
        ${stats.totalSessions ? `I've analyzed ${stats.totalSessions} sessions and ${stats.totalTabs || 0} tabs.` : ''}
        Come back after your next browsing session.
      </p>
      ${stats.ghostTabCount || stats.neglectedProjectCount ? `
        <p class="empty-stats">
          ${stats.ghostTabCount ? `${stats.ghostTabCount} recurring tabs tracked` : ''}
          ${stats.neglectedProjectCount ? ` &middot; ${stats.neglectedProjectCount} projects monitored` : ''}
        </p>
      ` : ''}
      <a href="/history" class="action-link">Browse session history</a>
    </div>
  </div>`;

  return wrapInLayout(bodyContent, {
    currentPage: 'tasks',
    title: 'All Clear',
    extraHead: emptyCSS
  });
}

/**
 * Render completion feedback page
 */
function renderCompletionPage(action, nextTask = null) {
  const messages = {
    engage: { icon: '&#9889;', title: 'On it!', message: 'Good. Now do the thing.' },
    release: { icon: '&#127754;', title: 'Let go', message: 'That open loop is closed.' },
    defer: { icon: '&#9200;', title: 'Later', message: "I'll remind you." },
    pause: { icon: '&#9208;&#65039;', title: 'Paused', message: 'Project on hold. No guilt.' },
    skip: { icon: '&#10145;&#65039;', title: 'Skipped', message: 'Moving on.' },
    triage: { icon: '&#127919;', title: 'Triaged', message: 'Keep what matters.' },
    release_all: { icon: '&#128293;', title: 'Cleared', message: 'Fresh start.' }
  };

  const msg = messages[action] || messages.engage;

  if (nextTask) {
    // Auto-redirect to next task
    return renderTaskPickerPage(nextTask, {});
  }

  const completionCSS = darkThemeCSS + `
    .completion-container {
      text-align: center;
    }
    .completion-icon {
      font-size: 4em;
      margin-bottom: 0.25em;
    }
    .completion-container h1 {
      font-weight: 300;
      font-style: normal;
      font-size: 2em;
      margin-bottom: 0.5em;
    }
    .completion-container p {
      color: var(--text-secondary);
    }
  `;

  const bodyContent = `
  <div class="page-content">
    <div class="completion-container">
      <div class="completion-icon">${msg.icon}</div>
      <h1>${escapeHtml(msg.title)}</h1>
      <p>${escapeHtml(msg.message)}</p>
    </div>
  </div>`;

  const extraScripts = `
  <script>
    // Auto-redirect after 2 seconds
    setTimeout(function() { window.location.href = '/tasks'; }, 2000);
  </script>`;

  return wrapInLayout(bodyContent, {
    currentPage: 'tasks',
    title: 'Done',
    extraHead: completionCSS,
    extraScripts
  });
}

module.exports = {
  renderTaskPickerPage,
  renderEmptyState,
  renderCompletionPage
};
