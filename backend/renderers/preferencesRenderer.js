/**
 * Preferences Renderer - Learned Preferences Management UI
 * Displays pending preference suggestions and confirmed preferences
 * Allows users to confirm/reject preferences that will be used in classification
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Render the preferences management page
 */
function renderPreferencesPage(preferences, stats) {
  const { approved = [], pending = [] } = preferences;

  const approvedHtml = approved.length > 0
    ? approved.map(pref => renderApprovedPreference(pref)).join('')
    : '<p class="empty-message">No confirmed preferences yet. Confirm suggestions below to teach Memento.</p>';

  const pendingHtml = pending.length > 0
    ? pending.map(pref => renderPendingPreference(pref)).join('')
    : '<p class="empty-message">No suggestions available. Make some corrections in Launchpad to generate suggestions.</p>';

  const statsHtml = renderStats(stats);

  const pageCSS = `
    .subtitle {
      color: var(--text-muted);
      margin-bottom: 2em;
    }

    /* Info banner */
    .info-banner {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 1em 1.25em;
      margin-bottom: 2em;
      font-size: 0.9em;
    }
    .info-banner strong {
      color: #0369a1;
    }

    /* Stats panel */
    .stats-panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1em;
      margin-bottom: 2em;
    }
    .stat-card {
      background: var(--bg-secondary);
      padding: 1em;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 1.8em;
      font-weight: 600;
      color: var(--accent-blue);
    }
    .stat-label {
      font-size: 0.85em;
      color: var(--text-muted);
    }

    /* Preference cards */
    .preference-card {
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.25em;
      margin-bottom: 1em;
    }
    .preference-card.confirmed {
      border-left: 4px solid #166534;
    }
    .preference-card.suggested {
      border-left: 4px solid var(--accent-blue);
    }

    .preference-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75em;
    }
    .preference-domain {
      font-family: ui-monospace, monospace;
      font-size: 1em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .preference-meta {
      font-size: 0.8em;
      color: var(--text-muted);
    }
    .preference-meta .usage-count {
      background: #dcfce7;
      color: #166534;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.85em;
    }

    .preference-text {
      background: var(--bg-secondary);
      padding: 0.75em 1em;
      border-radius: 4px;
      font-style: italic;
      margin-bottom: 1em;
      line-height: 1.6;
    }

    .preference-stats {
      display: flex;
      gap: 1.5em;
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .preference-stat {
      display: flex;
      align-items: center;
      gap: 0.3em;
    }

    .corrections-preview {
      margin-bottom: 1em;
    }
    .corrections-toggle {
      font-size: 0.85em;
      color: var(--accent-link);
      cursor: pointer;
      margin-bottom: 0.5em;
    }
    .corrections-list {
      display: none;
      font-size: 0.85em;
      background: var(--bg-secondary);
      border-radius: 4px;
      padding: 0.75em;
    }
    .corrections-list.show {
      display: block;
    }
    .correction-item {
      padding: 0.4em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .correction-item:last-child {
      border-bottom: none;
    }
    .correction-url {
      font-family: ui-monospace, monospace;
      font-size: 0.9em;
      color: var(--text-secondary);
      word-break: break-all;
    }
    .correction-transition {
      color: var(--text-muted);
    }
    .correction-from {
      text-decoration: line-through;
      color: #dc2626;
    }
    .correction-to {
      color: #166534;
      font-weight: 500;
    }

    .preference-actions {
      display: flex;
      gap: 0.5em;
    }

    /* Buttons */
    .btn-confirm {
      background: #dcfce7;
      color: #166534;
    }
    .btn-confirm:hover {
      background: #bbf7d0;
    }
    .btn-dismiss {
      background: #fee2e2;
      color: #991b1b;
    }
    .btn-dismiss:hover {
      background: #fecaca;
    }
    .btn-remove {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-light);
    }
    .btn-remove:hover {
      background: #eee;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-message {
      color: var(--text-muted);
      font-style: italic;
      padding: 1.5em;
      text-align: center;
      background: var(--bg-secondary);
      border-radius: 8px;
    }

    /* Feedback toast */
    .toast {
      position: fixed;
      bottom: 2em;
      right: 2em;
      padding: 1em 1.5em;
      background: var(--text-primary);
      color: white;
      border-radius: 8px;
      opacity: 0;
      transform: translateY(1em);
      transition: all 0.3s ease;
      z-index: 1000;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  const bodyContent = `
    <div class="page-content">
      <h1>What You've Taught Memento</h1>
      <p class="subtitle">These preferences were learned from your corrections. Confirmed preferences influence how tabs are classified.</p>

      <div class="info-banner">
        <strong>How it works:</strong> When you move a tab to a different category in Launchpad, Memento notices patterns.
        If you consistently move tabs from the same domain to the same category, Memento suggests a preference.
        Once confirmed, these preferences help classify similar tabs automatically.
      </div>

      ${statsHtml}

      <h2>Confirmed Preferences (${approved.length})</h2>
      <div class="confirmed-preferences">
        ${approvedHtml}
      </div>

      <h2>Suggested Preferences (${pending.length})</h2>
      <div class="suggested-preferences">
        ${pendingHtml}
      </div>

      <div style="margin-top: 2em; padding-top: 1.5em; border-top: 1px solid var(--border-light);">
        <a href="/tasks" style="color: var(--accent-link); text-decoration: none; font-size: 0.95em;">&larr; Back to Attention Items</a>
      </div>
    </div>

    <div id="toast" class="toast"></div>
  `;

  const extraScripts = `
    <script>
      function showToast(message) {
        var toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 3000);
      }

      function toggleCorrections(prefId) {
        var list = document.getElementById('corrections-' + prefId);
        list.classList.toggle('show');
      }

      async function confirmPreference(prefId, prefData) {
        var btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Confirming...';

        try {
          var response = await fetch('/api/preferences/' + encodeURIComponent(prefId) + '/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prefData)
          });
          var result = await response.json();

          if (result.success) {
            showToast('Preference confirmed! Memento will remember this.');
            setTimeout(function() { location.reload(); }, 1000);
          } else {
            showToast('Error: ' + (result.message || 'Failed to confirm'));
            btn.disabled = false;
            btn.textContent = 'Confirm';
          }
        } catch (err) {
          showToast('Error: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Confirm';
        }
      }

      async function dismissPreference(prefId) {
        var btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Dismissing...';

        try {
          var response = await fetch('/api/preferences/' + encodeURIComponent(prefId) + '/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          var result = await response.json();

          if (result.success) {
            showToast('Suggestion dismissed.');
            setTimeout(function() { location.reload(); }, 1000);
          } else {
            showToast('Error: ' + (result.message || 'Failed to dismiss'));
            btn.disabled = false;
            btn.textContent = 'Dismiss';
          }
        } catch (err) {
          showToast('Error: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Dismiss';
        }
      }

      async function removePreference(prefId) {
        var btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Removing...';

        try {
          var response = await fetch('/api/preferences/' + encodeURIComponent(prefId) + '/unapprove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          var result = await response.json();

          if (result.success) {
            showToast('Preference removed. Memento will forget this.');
            setTimeout(function() { location.reload(); }, 1000);
          } else {
            showToast('Error: ' + (result.message || 'Failed to remove'));
            btn.disabled = false;
            btn.textContent = 'Remove';
          }
        } catch (err) {
          showToast('Error: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'Remove';
        }
      }
    </script>
  `;

  return wrapInLayout(bodyContent, {
    currentPage: 'preferences',
    title: 'Learned Preferences',
    extraHead: pageCSS,
    extraScripts: extraScripts
  });
}

/**
 * Render stats panel
 */
function renderStats(stats) {
  if (!stats) return '';

  return `
    <div class="stats-panel">
      <div class="stat-card">
        <div class="stat-value">${stats.totalCorrections || 0}</div>
        <div class="stat-label">Total Corrections</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.uniqueDomainsCorrected || 0}</div>
        <div class="stat-label">Domains Corrected</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.suggestedExtractors || 0}</div>
        <div class="stat-label">Patterns Detected</div>
      </div>
    </div>
  `;
}

/**
 * Render a confirmed preference card
 */
function renderApprovedPreference(pref) {
  const confirmedDate = pref.approvedAt ? new Date(pref.approvedAt).toLocaleDateString() : 'Unknown';
  const usageCount = pref.applicationCount || 0;

  return `
    <div class="preference-card confirmed">
      <div class="preference-header">
        <div class="preference-domain">${escapeHtml(pref.domain)}</div>
        <div class="preference-meta">
          ${usageCount > 0 ? `<span class="usage-count">Used ${usageCount} time${usageCount !== 1 ? 's' : ''}</span>` : ''}
          Confirmed ${confirmedDate}
        </div>
      </div>
      <div class="preference-text">"You prefer ${escapeHtml(pref.domain)} tabs in ${escapeHtml(extractTargetCategory(pref.rule))}"</div>
      <div class="preference-actions">
        <button class="btn btn-remove" onclick="removePreference('${escapeHtml(pref.id)}')">Forget This</button>
      </div>
    </div>
  `;
}

/**
 * Extract target category from rule text
 */
function extractTargetCategory(ruleText) {
  const patterns = [
    /classified as ["']?([^"'\n.]+)["']?/i,
    /→\s*["']?([^"'\n.]+)["']?/i,
    /to\s+["']?([^"'\n.]+)["']?\s*$/i
  ];

  for (const pattern of patterns) {
    const match = ruleText.match(pattern);
    if (match) return match[1].trim();
  }

  return 'a specific category';
}

/**
 * Render a suggested preference card
 */
function renderPendingPreference(pref) {
  const prefDataJson = JSON.stringify({
    domain: pref.domain,
    rule: pref.rule,
    confidence: pref.confidence,
    stats: pref.stats,
    sourceCorrections: pref.sourceCorrections
  }).replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const corrections = pref.sourceCorrections || [];
  const targetCategory = extractTargetCategory(pref.rule);

  return `
    <div class="preference-card suggested">
      <div class="preference-header">
        <div class="preference-domain">${escapeHtml(pref.domain)}</div>
        <div class="preference-meta">${pref.stats?.agreementRatio || '?'} confidence</div>
      </div>
      <div class="preference-text">"You seem to prefer ${escapeHtml(pref.domain)} tabs in ${escapeHtml(targetCategory)}"</div>
      <div class="preference-stats">
        <span class="preference-stat">Based on ${pref.stats?.totalCorrections || 0} correction${(pref.stats?.totalCorrections || 0) !== 1 ? 's' : ''}</span>
        <span class="preference-stat">from: ${Object.keys(pref.stats?.fromCategories || {}).join(', ') || 'various'}</span>
        <span class="preference-stat">to: ${Object.keys(pref.stats?.toCategories || {}).join(', ') || 'various'}</span>
      </div>
      ${corrections.length > 0 ? `
        <div class="corrections-preview">
          <div class="corrections-toggle" onclick="toggleCorrections('${escapeHtml(pref.id)}')">
            Show ${corrections.length} correction${corrections.length > 1 ? 's' : ''} that led to this suggestion
          </div>
          <div id="corrections-${escapeHtml(pref.id)}" class="corrections-list">
            ${corrections.map(c => `
              <div class="correction-item">
                <div class="correction-url">${escapeHtml(c.title || c.url)}</div>
                <div class="correction-transition">
                  <span class="correction-from">${escapeHtml(c.from)}</span>
                  →
                  <span class="correction-to">${escapeHtml(c.to)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <div class="preference-actions">
        <button class="btn btn-confirm" onclick="confirmPreference('${escapeHtml(pref.id)}', JSON.parse('${prefDataJson}'))">Confirm</button>
        <button class="btn btn-dismiss" onclick="dismissPreference('${escapeHtml(pref.id)}')">Dismiss</button>
      </div>
    </div>
  `;
}

module.exports = {
  renderPreferencesPage
};
