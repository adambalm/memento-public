/**
 * Rules Renderer - Learned Rules Management UI
 * Displays pending rule suggestions and approved rules
 * Allows users to approve/reject rules that will be injected into classification prompts
 */

const { escapeHtml } = require('./layout');

/**
 * Render the rules management page
 */
function renderRulesPage(rules, stats) {
  const { approved = [], pending = [] } = rules;

  const approvedHtml = approved.length > 0
    ? approved.map(rule => renderApprovedRule(rule)).join('')
    : '<p class="empty-message">No approved rules yet. Approve pending suggestions below.</p>';

  const pendingHtml = pending.length > 0
    ? pending.map(rule => renderPendingRule(rule)).join('')
    : '<p class="empty-message">No rule suggestions. Make some corrections in Launchpad to generate suggestions.</p>';

  const statsHtml = renderStats(stats);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Learned Rules — Memento</title>
  <style>
    :root {
      --bg-primary: #fffff8;
      --bg-secondary: #f9f9f5;
      --text-primary: #111111;
      --text-secondary: #454545;
      --text-muted: #6b6b6b;
      --accent-link: #a00000;
      --accent-blue: #2563eb;
      --accent-green: #166534;
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

    /* Navigation */
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
    .nav-brand a {
      font-size: 1.2em;
      font-weight: 600;
      font-style: italic;
      color: var(--text-primary);
      text-decoration: none;
    }
    .nav-links {
      display: flex;
      gap: 1em;
    }
    .nav-link {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.4em 0.8em;
      border-radius: 4px;
    }
    .nav-link:hover {
      background: rgba(0,0,0,0.05);
    }
    .nav-link.active {
      background: var(--text-primary);
      color: white;
    }

    /* Page content */
    .page-content {
      max-width: 55em;
      margin: 0 auto;
      padding: 2em;
    }

    h1 {
      font-weight: 400;
      font-style: italic;
      font-size: 1.8em;
      margin-bottom: 0.25em;
    }
    .subtitle {
      color: var(--text-muted);
      margin-bottom: 2em;
    }

    h2 {
      font-weight: 400;
      font-style: italic;
      font-size: 1.3em;
      margin-top: 2em;
      margin-bottom: 1em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid var(--border-light);
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

    /* Rule cards */
    .rule-card {
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.25em;
      margin-bottom: 1em;
    }
    .rule-card.approved {
      border-left: 4px solid var(--accent-green);
    }
    .rule-card.pending {
      border-left: 4px solid var(--accent-blue);
    }

    .rule-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75em;
    }
    .rule-domain {
      font-family: ui-monospace, monospace;
      font-size: 1em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .rule-meta {
      font-size: 0.8em;
      color: var(--text-muted);
    }

    .rule-text {
      background: var(--bg-secondary);
      padding: 0.75em 1em;
      border-radius: 4px;
      font-style: italic;
      margin-bottom: 1em;
      line-height: 1.6;
    }

    .rule-stats {
      display: flex;
      gap: 1.5em;
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .rule-stat {
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
      color: var(--accent-green);
      font-weight: 500;
    }

    .rule-actions {
      display: flex;
      gap: 0.5em;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      padding: 0.5em 1em;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
    }
    .btn-approve {
      background: #dcfce7;
      color: #166534;
    }
    .btn-approve:hover {
      background: #bbf7d0;
    }
    .btn-reject {
      background: #fee2e2;
      color: #991b1b;
    }
    .btn-reject:hover {
      background: #fecaca;
    }
    .btn-unapprove {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-light);
    }
    .btn-unapprove:hover {
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
  </style>
</head>
<body>
  <nav class="main-nav">
    <div class="nav-brand">
      <a href="/history">Memento</a>
    </div>
    <div class="nav-links">
      <a href="/history" class="nav-link">History</a>
      <a href="/tasks" class="nav-link">Tasks</a>
      <a href="/rules" class="nav-link active">Rules</a>
    </div>
  </nav>

  <div class="page-content">
    <h1>Learned Rules</h1>
    <p class="subtitle">Rules learned from your corrections. Approved rules are injected into classification prompts.</p>

    ${statsHtml}

    <h2>Approved Rules (${approved.length})</h2>
    <div class="approved-rules">
      ${approvedHtml}
    </div>

    <h2>Pending Suggestions (${pending.length})</h2>
    <div class="pending-rules">
      ${pendingHtml}
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function toggleCorrections(ruleId) {
      const list = document.getElementById('corrections-' + ruleId);
      list.classList.toggle('show');
    }

    async function approveRule(ruleId, ruleData) {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Approving...';

      try {
        const response = await fetch('/api/rules/' + encodeURIComponent(ruleId) + '/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData)
        });
        const result = await response.json();

        if (result.success) {
          showToast('Rule approved! It will be used in future classifications.');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('Error: ' + (result.message || 'Failed to approve'));
          btn.disabled = false;
          btn.textContent = 'Approve';
        }
      } catch (err) {
        showToast('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Approve';
      }
    }

    async function rejectRule(ruleId) {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Rejecting...';

      try {
        const response = await fetch('/api/rules/' + encodeURIComponent(ruleId) + '/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
          showToast('Rule rejected.');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('Error: ' + (result.message || 'Failed to reject'));
          btn.disabled = false;
          btn.textContent = 'Reject';
        }
      } catch (err) {
        showToast('Error: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Reject';
      }
    }

    async function unapproveRule(ruleId) {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Removing...';

      try {
        const response = await fetch('/api/rules/' + encodeURIComponent(ruleId) + '/unapprove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();

        if (result.success) {
          showToast('Rule removed from approved list.');
          setTimeout(() => location.reload(), 1000);
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
</body>
</html>`;
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
 * Render an approved rule card
 */
function renderApprovedRule(rule) {
  const approvedDate = rule.approvedAt ? new Date(rule.approvedAt).toLocaleDateString() : 'Unknown';

  return `
    <div class="rule-card approved">
      <div class="rule-header">
        <div class="rule-domain">${escapeHtml(rule.domain)}</div>
        <div class="rule-meta">Approved ${approvedDate}</div>
      </div>
      <div class="rule-text">${escapeHtml(rule.rule)}</div>
      <div class="rule-actions">
        <button class="btn btn-unapprove" onclick="unapproveRule('${escapeHtml(rule.id)}')">Remove</button>
      </div>
    </div>
  `;
}

/**
 * Render a pending rule suggestion card
 */
function renderPendingRule(rule) {
  const ruleDataJson = JSON.stringify({
    domain: rule.domain,
    rule: rule.rule,
    confidence: rule.confidence,
    stats: rule.stats,
    sourceCorrections: rule.sourceCorrections
  }).replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const corrections = rule.sourceCorrections || [];

  return `
    <div class="rule-card pending">
      <div class="rule-header">
        <div class="rule-domain">${escapeHtml(rule.domain)}</div>
        <div class="rule-meta">${rule.stats?.agreementRatio || '?'} confidence</div>
      </div>
      <div class="rule-text">${escapeHtml(rule.rule)}</div>
      <div class="rule-stats">
        <span class="rule-stat">${rule.stats?.totalCorrections || 0} corrections</span>
        <span class="rule-stat">from: ${Object.keys(rule.stats?.fromCategories || {}).join(', ') || 'various'}</span>
        <span class="rule-stat">to: ${Object.keys(rule.stats?.toCategories || {}).join(', ') || 'various'}</span>
      </div>
      ${corrections.length > 0 ? `
        <div class="corrections-preview">
          <div class="corrections-toggle" onclick="toggleCorrections('${escapeHtml(rule.id)}')">
            Show ${corrections.length} source correction${corrections.length > 1 ? 's' : ''}
          </div>
          <div id="corrections-${escapeHtml(rule.id)}" class="corrections-list">
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
      <div class="rule-actions">
        <button class="btn btn-approve" onclick="approveRule('${escapeHtml(rule.id)}', JSON.parse('${ruleDataJson}'))">Approve</button>
        <button class="btn btn-reject" onclick="rejectRule('${escapeHtml(rule.id)}')">Reject</button>
      </div>
    </div>
  `;
}

module.exports = {
  renderRulesPage
};
