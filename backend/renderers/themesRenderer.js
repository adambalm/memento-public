/**
 * Themes Renderer — Resolution Actions Model
 *
 * Default view for /intentions page. Shows theme-grouped intent proposals
 * with resolution-oriented actions: Save as Note, Open All, Archive,
 * Keep Watching, Rename.
 *
 * The key insight: every action either produces an artifact, enables
 * resumption, or closes the loop. No action exists solely to train the
 * system — each one does something tangible for the user.
 *
 * Legacy tab view accessible via ?view=tabs query param.
 */

const { escapeHtml, wrapInLayout } = require('./layout');

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const pageCSS = `
    /* Stats bar — actionable, not vanity */
    .stats-bar {
      display: flex;
      gap: 1em;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 1.5em;
      padding: 0.75em 1em;
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      font-size: 0.9em;
      font-family: system-ui, sans-serif;
    }
    .stats-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.85em;
    }
    .stats-badge-save { background: #dbeafe; color: #1e40af; }
    .stats-badge-idle { background: #fef3c7; color: #92400e; }
    .stats-badge-archived { background: #f3f4f6; color: #6b7280; }
    .stats-badge-saved { background: #dcfce7; color: #166534; }
    .stats-badge-memory { background: #ede9fe; color: #5b21b6; }

    /* View toggle */
    .view-toggle {
      display: flex;
      gap: 0.25em;
      margin-bottom: 1.5em;
    }
    .view-toggle a {
      padding: 0.4em 1em;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-size: 0.85em;
      font-family: system-ui, sans-serif;
      color: var(--text-secondary);
      text-decoration: none;
    }
    .view-toggle a:hover {
      background: var(--bg-secondary);
      text-decoration: none;
    }
    .view-toggle a.active {
      background: var(--text-primary);
      color: white;
      border-color: var(--text-primary);
    }

    /* Theme cards */
    .theme-card {
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      margin-bottom: 1em;
      transition: opacity 0.4s ease, max-height 0.4s ease;
      overflow: hidden;
    }
    .theme-card.fading {
      opacity: 0;
      max-height: 0;
      margin-bottom: 0;
      border-width: 0;
      padding: 0;
    }
    .theme-card.saved {
      border-left: 3px solid #166534;
    }
    .theme-card.archived {
      opacity: 0.6;
      border-left: 3px solid #9ca3af;
    }
    .theme-card.watching {
      border-left: 3px solid #2563eb;
    }

    .theme-top {
      padding: 1.25em;
    }
    .theme-label-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1em;
    }
    .theme-label {
      font-weight: 600;
      font-size: 1.1em;
      margin-bottom: 0.25em;
      flex: 1;
    }
    .theme-badges {
      display: flex;
      gap: 0.4em;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .theme-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-family: system-ui, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-muted);
    }
    .theme-badge-score { background: #dbeafe; color: #1e40af; }
    .theme-badge-memory { background: #ede9fe; color: #5b21b6; }
    .theme-badge-interesting { background: #dcfce7; color: #166534; }

    .theme-description {
      font-size: 0.9em;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-top: 0.25em;
    }
    .theme-intent {
      font-style: italic;
      color: var(--text-secondary);
      padding-left: 0.75em;
      border-left: 2px solid var(--border-light);
      margin-top: 0.5em;
      font-size: 0.95em;
      line-height: 1.5;
    }

    /* Memory connections — visible by default, not hidden */
    .memory-connections {
      margin-top: 0.75em;
      padding: 0.75em;
      background: #f5f3ff;
      border-radius: 6px;
      font-size: 0.9em;
    }
    .memory-connections-title {
      font-weight: 500;
      color: #5b21b6;
      margin-bottom: 0.25em;
    }
    .memory-match {
      color: var(--text-secondary);
      font-size: 0.85em;
    }
    .memory-match-keywords {
      color: #7c3aed;
      font-style: italic;
    }

    /* User corrections display */
    .user-corrections {
      margin-top: 0.75em;
      padding: 0.75em;
      background: #fffbeb;
      border-radius: 6px;
      font-size: 0.85em;
    }
    .user-corrections-title {
      font-weight: 500;
      color: #92400e;
      margin-bottom: 0.25em;
    }
    .user-correction-item {
      color: var(--text-secondary);
      margin-bottom: 0.25em;
      line-height: 1.5;
      padding-left: 0.5em;
      border-left: 2px solid #fbbf24;
    }

    /* Resolution actions — prominent, not buried */
    .theme-actions {
      display: flex;
      gap: 0.5em;
      margin-top: 1em;
      flex-wrap: wrap;
      align-items: center;
    }
    .theme-btn {
      padding: 0.5em 1.2em;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .theme-btn-save {
      background: #166534;
      color: white;
      border: 1px solid #166534;
      font-weight: 500;
    }
    .theme-btn-save:hover { background: #15803d; }
    .theme-btn-open {
      border: 1px solid #2563eb;
      color: #2563eb;
      background: transparent;
    }
    .theme-btn-open:hover { background: #eff6ff; }
    .theme-btn-archive {
      border: 1px solid #6b7280;
      color: #6b7280;
      background: transparent;
    }
    .theme-btn-archive:hover { background: #f3f4f6; }
    .theme-btn-watch {
      border: 1px solid #2563eb;
      color: #2563eb;
      background: transparent;
    }
    .theme-btn-watch:hover { background: #eff6ff; }
    .theme-btn-rename {
      border: 1px solid #92400e;
      color: #92400e;
      background: transparent;
      font-size: 0.85em;
    }
    .theme-btn-rename:hover { background: #fffbeb; }
    .theme-actions-sep {
      width: 1px;
      height: 1.5em;
      background: var(--border-light);
    }

    /* Rename input row */
    .theme-rename-row {
      display: none;
      gap: 0.5em;
      margin-top: 0.5em;
      align-items: center;
    }
    .theme-rename-row.visible {
      display: flex;
    }
    .theme-rename-input {
      flex: 1;
      padding: 0.4em 0.75em;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
    }
    .theme-rename-input:focus {
      outline: none;
      border-color: #92400e;
    }
    .theme-rename-submit {
      padding: 0.4em 1em;
      background: #92400e;
      color: white;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
    }
    .theme-rename-submit:hover { background: #78350f; }

    /* Tabs section — expandable detail */
    .theme-tabs-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      margin-top: 0.75em;
      padding: 0.3em 0;
      font-size: 0.85em;
      color: var(--text-muted);
      cursor: pointer;
      border: none;
      background: none;
      font-family: inherit;
    }
    .theme-tabs-toggle:hover { color: var(--text-secondary); }
    .theme-tabs-toggle-icon {
      transition: transform 0.2s ease;
      font-size: 0.9em;
    }
    .theme-tabs-toggle.open .theme-tabs-toggle-icon {
      transform: rotate(90deg);
    }
    .theme-tabs-list {
      display: none;
      margin-top: 0.25em;
      padding-top: 0.5em;
      border-top: 1px solid #f0eee8;
    }
    .theme-tabs-list.open {
      display: block;
    }
    .theme-tab-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0.4em 0;
      border-bottom: 1px solid #f0eee8;
      font-size: 0.9em;
    }
    .theme-tab-item:last-child {
      border-bottom: none;
    }
    .theme-tab-link {
      color: var(--text-primary);
      text-decoration: none;
      flex: 1;
      margin-right: 1em;
    }
    .theme-tab-link:hover {
      color: var(--accent-link);
      text-decoration: underline;
    }
    .theme-tab-meta {
      font-size: 0.8em;
      color: var(--text-muted);
      font-family: system-ui, sans-serif;
      white-space: nowrap;
    }

    /* Save result banner */
    .save-result {
      display: none;
      margin-top: 0.75em;
      padding: 0.75em;
      background: #dcfce7;
      border-radius: 6px;
      font-size: 0.9em;
      color: #166534;
    }
    .save-result.visible {
      display: block;
    }
    .save-result a {
      color: #166534;
      font-weight: 500;
    }

    /* How it works */
    .how-it-works {
      margin-bottom: 1.5em;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 0.25em 1em;
    }
    .how-it-works summary {
      cursor: pointer;
      font-size: 0.9em;
      color: var(--text-muted);
      padding: 0.5em 0;
    }
    .how-it-works summary:hover { color: var(--text-secondary); }
    .how-it-works-content {
      padding-bottom: 0.75em;
    }
    .how-it-works-content p {
      font-size: 0.9em;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0.5em 0;
    }

    /* Toast */
    .themes-toast {
      position: fixed;
      bottom: 2em;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: var(--text-primary);
      color: white;
      padding: 0.75em 1.5em;
      border-radius: 8px;
      font-size: 0.95em;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1000;
      pointer-events: none;
      max-width: 90vw;
    }
    .themes-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Meta line */
    .meta-line {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 3em;
      color: var(--text-muted);
    }

    @media (max-width: 600px) {
      .theme-actions { flex-direction: column; }
      .theme-btn { text-align: center; }
      .theme-rename-row { flex-direction: column; }
      .stats-bar { flex-direction: column; align-items: flex-start; }
      .view-toggle { flex-wrap: wrap; }
    }
`;

const pageJS = `
  <script>
    function showToast(message) {
      var existing = document.querySelector('.themes-toast');
      if (existing) existing.remove();

      var toast = document.createElement('div');
      toast.className = 'themes-toast';
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(function() {
        toast.classList.add('visible');
      });
      setTimeout(function() {
        toast.classList.remove('visible');
        setTimeout(function() { toast.remove(); }, 300);
      }, 3000);
    }

    function fadeOutTheme(themeId) {
      var card = document.getElementById('theme-' + themeId);
      if (!card) return;
      card.style.maxHeight = card.scrollHeight + 'px';
      requestAnimationFrame(function() {
        card.classList.add('fading');
      });
      setTimeout(function() { card.remove(); }, 450);
    }

    function toggleTabs(themeId) {
      var btn = document.getElementById('tabs-toggle-' + themeId);
      var list = document.getElementById('tabs-list-' + themeId);
      if (btn && list) {
        btn.classList.toggle('open');
        list.classList.toggle('open');
      }
    }

    // --- Resolution Actions ---

    function saveTheme(themeId) {
      var btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Saving...';

      fetch('/api/intentions/themes/' + encodeURIComponent(themeId) + '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.ok) {
          var card = document.getElementById('theme-' + themeId);
          if (card) card.classList.add('saved');
          btn.textContent = 'Saved';

          // Show result banner with file info
          var banner = document.getElementById('save-result-' + themeId);
          if (banner) {
            banner.innerHTML = 'Saved to Basic Memory as <strong>' + (result.title || 'note') + '</strong>. Tabs are now disposable.';
            banner.classList.add('visible');
          }

          showToast('Saved to Basic Memory — tabs are now disposable');
        } else {
          btn.disabled = false;
          btn.textContent = 'Save as Note';
          showToast('Error: ' + (result.error || 'Save failed'));
        }
      })
      .catch(function(err) {
        console.error('Save failed:', err);
        btn.disabled = false;
        btn.textContent = 'Save as Note';
        showToast('Something went wrong');
      });
    }

    function openAllTabs(themeId) {
      var card = document.getElementById('theme-' + themeId);
      if (!card) return;
      var links = card.querySelectorAll('.theme-tab-link');
      var opened = 0;
      links.forEach(function(link) {
        window.open(link.href, '_blank');
        opened++;
      });
      showToast('Opened ' + opened + ' tabs');
    }

    function archiveTheme(themeId) {
      sendThemeAction(themeId, 'archive', function() {
        fadeOutTheme(themeId);
        showToast('Archived — removed from view');
      });
    }

    function keepWatching(themeId) {
      sendThemeAction(themeId, 'keep-watching', function() {
        var card = document.getElementById('theme-' + themeId);
        if (card) card.classList.add('watching');
        showToast('Watching — will resurface if pattern continues');
      });
    }

    function showRenameInput(themeId) {
      var row = document.getElementById('theme-rename-' + themeId);
      if (row) {
        row.classList.add('visible');
        var input = row.querySelector('.theme-rename-input');
        if (input) input.focus();
      }
    }

    function submitRename(themeId) {
      var row = document.getElementById('theme-rename-' + themeId);
      if (!row) return;
      var input = row.querySelector('.theme-rename-input');
      var newName = input ? input.value.trim() : '';
      if (!newName) {
        input.focus();
        return;
      }
      sendThemeAction(themeId, 'rename', function() {
        var labelEl = document.querySelector('#theme-' + themeId + ' .theme-label');
        if (labelEl) labelEl.textContent = newName;
        row.classList.remove('visible');
        showToast('Renamed to "' + newName + '"');
      }, newName);
    }

    function sendThemeAction(themeId, action, onSuccess, correctedIntent) {
      var body = { action: action };
      if (correctedIntent) body.correctedIntent = correctedIntent;

      fetch('/api/intentions/themes/' + encodeURIComponent(themeId) + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.ok) {
          if (onSuccess) onSuccess();
        } else {
          showToast('Error: ' + (result.error || 'Unknown error'));
        }
      })
      .catch(function(err) {
        console.error('Action failed:', err);
        showToast('Something went wrong');
      });
    }
  </script>
`;

/**
 * Render a single theme card with resolution actions
 */
function renderThemeCard(theme) {
  const {
    themeId,
    label,
    description,
    tabs,
    signalScore,
    memoryConnections,
    candidateIntent,
    userCorrections,
    status
  } = theme;

  const safeId = escapeHtml(themeId);
  const safeLabel = escapeHtml(label);
  const safeDesc = escapeHtml(description);
  const safeIntent = escapeHtml(candidateIntent);

  // Badges
  const badges = [];
  badges.push(`<span class="theme-badge">${tabs.length} tabs</span>`);
  badges.push(`<span class="theme-badge theme-badge-score">score: ${signalScore}</span>`);

  if (memoryConnections && memoryConnections.length > 0) {
    badges.push(`<span class="theme-badge theme-badge-memory">BM connected</span>`);
  }

  const hasInteresting = tabs.some(t => t.domainSignal === 'always-interesting');
  if (hasInteresting) {
    badges.push(`<span class="theme-badge theme-badge-interesting">high-signal</span>`);
  }

  // Memory connections section — visible by default
  let memoryHtml = '';
  if (memoryConnections && memoryConnections.length > 0) {
    const connItems = memoryConnections.slice(0, 3).map(c =>
      `<div class="memory-match">${escapeHtml(c.name)} <span class="memory-match-keywords">(${c.matchedKeywords.slice(0, 4).join(', ')})</span></div>`
    ).join('');
    memoryHtml = `
      <div class="memory-connections">
        <div class="memory-connections-title">Basic Memory connections</div>
        ${connItems}
      </div>
    `;
  }

  // User corrections — visible by default
  let correctionsHtml = '';
  if (userCorrections && userCorrections.length > 0) {
    const corrItems = userCorrections.slice(0, 3).map(c =>
      `<div class="user-correction-item">${escapeHtml(c)}</div>`
    ).join('');
    correctionsHtml = `
      <div class="user-corrections">
        <div class="user-corrections-title">Your previous notes on these tabs</div>
        ${corrItems}
      </div>
    `;
  }

  // Tab list — expandable detail
  const tabItems = tabs.map(t => {
    const domain = escapeHtml(t.domain || extractDomain(t.url));
    const tabTitle = escapeHtml(t.title || t.url);
    const meta = `${t.recurrenceCount}x / ${t.distinctDays}d`;
    return `
      <div class="theme-tab-item">
        <a class="theme-tab-link" href="${escapeHtml(t.url)}" target="_blank" title="${domain}">${tabTitle}</a>
        <span class="theme-tab-meta">${meta}</span>
      </div>
    `;
  }).join('');

  const statusClass = status === 'saved' ? ' saved' : status === 'archived' ? ' archived' : status === 'keep-watching' ? ' watching' : '';

  return `
    <div class="theme-card${statusClass}" id="theme-${safeId}">
      <div class="theme-top">
        <div class="theme-label-row">
          <div class="theme-label">${safeLabel}</div>
          <div class="theme-badges">${badges.join('')}</div>
        </div>
        <div class="theme-description">${safeDesc}</div>
        ${safeIntent ? `<div class="theme-intent">${safeIntent}</div>` : ''}
        ${memoryHtml}
        ${correctionsHtml}

        <div class="theme-actions">
          <button class="theme-btn theme-btn-save" onclick="saveTheme('${safeId}')">Save as Note</button>
          <button class="theme-btn theme-btn-open" onclick="openAllTabs('${safeId}')">Open All</button>
          <span class="theme-actions-sep"></span>
          <button class="theme-btn theme-btn-archive" onclick="archiveTheme('${safeId}')">Archive</button>
          <button class="theme-btn theme-btn-watch" onclick="keepWatching('${safeId}')">Keep Watching</button>
          <button class="theme-btn theme-btn-rename" onclick="showRenameInput('${safeId}')">Rename</button>
        </div>
        <div class="theme-rename-row" id="theme-rename-${safeId}">
          <input type="text" class="theme-rename-input" placeholder="New name for this thread"
                 value="${safeLabel}"
                 onkeydown="if(event.key==='Enter')submitRename('${safeId}')">
          <button class="theme-rename-submit" onclick="submitRename('${safeId}')">Rename</button>
        </div>

        <div class="save-result" id="save-result-${safeId}"></div>

        <button class="theme-tabs-toggle" id="tabs-toggle-${safeId}" onclick="toggleTabs('${safeId}')">
          <span class="theme-tabs-toggle-icon">&#9656;</span> ${tabs.length} constituent tabs
        </button>
        <div class="theme-tabs-list" id="tabs-list-${safeId}">
          ${tabItems}
        </div>
      </div>
    </div>
  `;
}

/**
 * Compute actionable stats from theme data and feedback
 */
function computeActionableStats(themes, themeFeedback) {
  let readyToSave = 0;
  let saved = 0;
  let archived = 0;
  let watching = 0;
  let withBM = 0;

  for (const t of themes) {
    const fb = themeFeedback && themeFeedback[t.themeId];
    if (fb) {
      if (fb.action === 'save') saved++;
      else if (fb.action === 'archive' || fb.action === 'dismiss') archived++;
      else if (fb.action === 'keep-watching') watching++;
    }

    if (t.memoryConnections && t.memoryConnections.length > 0) {
      withBM++;
      if (!fb || !['save', 'archive', 'dismiss'].includes(fb.action)) {
        readyToSave++;
      }
    }
  }

  return { readyToSave, saved, archived, watching, withBM, total: themes.length };
}

/**
 * Render the themes page.
 *
 * @param {Object} data - { themes, meta } from themeDetection.getThemeProposals()
 * @param {Object} stats - { total, confirmed, corrected, dismissed, accuracy } from intentDetection.getStats()
 * @returns {string} HTML page
 */
function renderThemesPage(data, stats) {
  const themes = data?.themes || [];
  const meta = data?.meta || {};
  const themeFeedback = data?.meta?.themeFeedback || {};

  const actionStats = computeActionableStats(themes, themeFeedback);

  // Stats bar — actionable counts
  const statsItems = [];
  statsItems.push(`<span class="stats-badge stats-badge-save">${actionStats.total} threads found</span>`);
  if (actionStats.readyToSave > 0) {
    statsItems.push(`<span class="stats-badge stats-badge-memory">${actionStats.readyToSave} ready to save</span>`);
  }
  if (actionStats.saved > 0) {
    statsItems.push(`<span class="stats-badge stats-badge-saved">${actionStats.saved} saved</span>`);
  }
  if (actionStats.watching > 0) {
    statsItems.push(`<span class="stats-badge stats-badge-idle">${actionStats.watching} watching</span>`);
  }
  if (actionStats.archived > 0) {
    statsItems.push(`<span class="stats-badge stats-badge-archived">${actionStats.archived} archived</span>`);
  }
  const statsBarHtml = `<div class="stats-bar">${statsItems.join('')}</div>`;

  // View toggle
  const viewToggleHtml = `
    <div class="view-toggle">
      <a href="/intentions" class="active">Themes</a>
      <a href="/intentions?view=tabs">Tabs</a>
    </div>
  `;

  // Meta line
  const metaHtml = `<p class="meta-line">Analyzed ${meta.sessionsAnalyzed || 0} sessions, ${meta.tabsAnalyzed || 0} tabs (${meta.tabsAfterFilter || 0} after filtering)</p>`;

  // Theme cards or empty state
  const cardsHtml = themes.length > 0
    ? themes.map(t => renderThemeCard(t)).join('')
    : `<div class="empty-state">
        <p>No themes detected yet. Memento needs more sessions to find patterns across your browsing.</p>
        <p style="margin-top: 0.5em; font-size: 0.9em;">Try capturing a few more sessions, or check the <a href="/intentions?view=tabs">tab view</a> for individual signals.</p>
      </div>`;

  const bodyContent = `
    <div class="page-content">
      <h1>Intentions</h1>
      <p class="page-subtitle">Thematic threads detected across your browsing sessions</p>
      ${viewToggleHtml}
      <details class="how-it-works">
        <summary>How this works</summary>
        <div class="how-it-works-content">
          <p>Instead of showing individual tabs, this view clusters your recurring tabs into <strong>themes</strong> &mdash; groups of related tabs that appear together across sessions and share keywords.</p>
          <p>Each theme represents an open thread in your browsing. The actions below help you <strong>close the loop</strong>:</p>
          <p><strong>Save as Note</strong> &mdash; Creates a Basic Memory research note from this thread. Once saved, the tabs are disposable &mdash; the knowledge lives in your notes.</p>
          <p><strong>Open All</strong> &mdash; Reopens all tabs from this thread for active work. Pick up where you left off.</p>
          <p><strong>Archive</strong> &mdash; "I'm done with this." Removes it permanently.</p>
          <p><strong>Keep Watching</strong> &mdash; Explicit deferral. Memento will track it and resurface if the pattern continues.</p>
          <p><strong>Rename</strong> &mdash; Change the label if the auto-detected name doesn't capture the thread.</p>
        </div>
      </details>
      ${metaHtml}
      ${statsBarHtml}
      ${cardsHtml}
    </div>
  `;

  return wrapInLayout(bodyContent, {
    currentPage: 'intentions',
    title: 'Intentions — Themes',
    extraHead: pageCSS,
    extraScripts: pageJS
  });
}

module.exports = { renderThemesPage };
