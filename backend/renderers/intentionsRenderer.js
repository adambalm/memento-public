/**
 * Intentions Renderer
 *
 * Renders the Intentions page — recurring tabs that Memento has detected
 * as potential user intentions. Users can confirm, correct, or dismiss
 * each detected intention to improve future classification.
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Extract domain from a URL
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Format a date string for display
 */
function formatShortDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const pageCSS = `
    /* Stats bar */
    .stats-bar {
      display: flex;
      gap: 1em;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 2em;
      padding: 0.75em 1em;
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      font-size: 0.9em;
    }
    .stats-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.85em;
      font-family: system-ui, sans-serif;
    }
    .stats-badge-confirmed {
      background: #dcfce7;
      color: #166534;
    }
    .stats-badge-corrected {
      background: #fef3c7;
      color: #92400e;
    }
    .stats-badge-dismissed {
      background: #f3f4f6;
      color: #4b5563;
    }
    .stats-accuracy {
      margin-left: auto;
      color: var(--text-muted);
    }

    /* Meta line */
    .meta-line {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1.5em;
    }

    /* Proposal cards */
    .proposal-card {
      background: white;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.25em;
      margin-bottom: 1em;
      transition: opacity 0.4s ease, max-height 0.4s ease, padding 0.4s ease, margin 0.4s ease;
      overflow: hidden;
    }
    .proposal-card.fading {
      opacity: 0;
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      margin-bottom: 0;
      border-width: 0;
    }
    .proposal-title {
      font-weight: 600;
      font-size: 1em;
      margin-bottom: 0.15em;
    }
    .proposal-title a {
      color: var(--text-primary);
      text-decoration: none;
    }
    .proposal-title a:hover {
      color: var(--accent-link);
      text-decoration: underline;
    }
    .proposal-domain {
      font-size: 0.85em;
      color: var(--text-muted);
      font-family: ui-monospace, monospace;
      margin-bottom: 0.5em;
    }
    .proposal-recurrence {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8em;
      font-family: system-ui, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-muted);
      margin-bottom: 0.75em;
    }
    .proposal-intent {
      font-style: italic;
      color: var(--text-secondary);
      padding-left: 0.75em;
      border-left: 2px solid var(--border-light);
      margin-bottom: 0.75em;
      line-height: 1.5;
    }
    .proposal-cooccurring {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 0.75em;
      line-height: 1.5;
    }
    .proposal-cooccurring strong {
      font-weight: 500;
    }

    /* Alternative intents */
    .proposal-alternatives summary {
      font-size: 0.85em;
      color: var(--text-muted);
      cursor: pointer;
      margin-bottom: 0.5em;
    }
    .proposal-alternatives summary:hover {
      color: var(--text-secondary);
    }
    .alt-list {
      list-style: disc;
      padding-left: 1.5em;
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    .alt-list li {
      margin-bottom: 0.25em;
    }

    /* Action buttons */
    .proposal-actions {
      display: flex;
      gap: 0.5em;
      margin-top: 0.75em;
      flex-wrap: wrap;
    }
    .intent-btn {
      padding: 0.4em 1em;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
      background: transparent;
    }
    .intent-btn-confirm {
      border: 1px solid #166534;
      color: #166534;
    }
    .intent-btn-confirm:hover {
      background: #dcfce7;
    }
    .intent-btn-correct {
      border: 1px solid #92400e;
      color: #92400e;
    }
    .intent-btn-correct:hover {
      background: #fef3c7;
    }
    .intent-btn-dismiss {
      border: 1px solid #6b7280;
      color: #6b7280;
    }
    .intent-btn-dismiss:hover {
      background: #f3f4f6;
    }

    /* Correct input */
    .correct-input-row {
      display: none;
      gap: 0.5em;
      margin-top: 0.5em;
      align-items: center;
    }
    .correct-input-row.visible {
      display: flex;
    }
    .correct-input {
      flex: 1;
      padding: 0.4em 0.75em;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
    }
    .correct-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .correct-submit {
      padding: 0.4em 1em;
      background: #92400e;
      color: white;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9em;
      cursor: pointer;
    }
    .correct-submit:hover {
      background: #78350f;
    }

    /* Resolved section */
    .resolved-section {
      margin-top: 2em;
    }
    .resolved-section summary {
      font-size: 1.1em;
      font-style: italic;
      cursor: pointer;
      color: var(--text-secondary);
      margin-bottom: 1em;
    }
    .resolved-section summary:hover {
      color: var(--text-primary);
    }
    .resolved-group h3 {
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-top: 1em;
      margin-bottom: 0.5em;
      font-style: normal;
      font-weight: 600;
    }
    .resolved-item {
      padding: 0.5em 0;
      border-bottom: 1px solid var(--border-light);
      font-size: 0.9em;
    }
    .resolved-item:last-child {
      border-bottom: none;
    }
    .resolved-item-title {
      font-weight: 500;
    }
    .resolved-item-intent {
      color: var(--text-secondary);
      font-style: italic;
    }
    .resolved-item-date {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .resolved-correction {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-top: 0.25em;
    }
    .resolved-correction .original {
      text-decoration: line-through;
    }
    .resolved-loading {
      color: var(--text-muted);
      font-style: italic;
      padding: 1em 0;
    }

    /* Toast */
    .intentions-toast {
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
    }
    .intentions-toast.visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
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
    .how-it-works summary:hover {
      color: var(--text-secondary);
    }
    .how-it-works-content {
      padding-bottom: 0.75em;
    }
    .how-it-works-content p {
      font-size: 0.9em;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0.5em 0;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 3em;
      color: var(--text-muted);
    }

    @media (max-width: 600px) {
      .proposal-actions {
        flex-direction: column;
      }
      .intent-btn {
        text-align: center;
      }
      .correct-input-row {
        flex-direction: column;
      }
      .stats-bar {
        flex-direction: column;
        align-items: flex-start;
      }
      .stats-accuracy {
        margin-left: 0;
      }
    }
`;

const pageJS = `
  <script>
    function showToast(message) {
      var existing = document.querySelector('.intentions-toast');
      if (existing) existing.remove();

      var toast = document.createElement('div');
      toast.className = 'intentions-toast';
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

    function fadeOutCard(tabHash) {
      var card = document.getElementById('card-' + tabHash);
      if (!card) return;
      card.style.maxHeight = card.scrollHeight + 'px';
      requestAnimationFrame(function() {
        card.classList.add('fading');
      });
      setTimeout(function() { card.remove(); }, 450);
    }

    function sendFeedback(tabHash, action, extra) {
      extra = extra || {};
      var card = document.getElementById('card-' + tabHash);
      if (!card) return;

      var candidateIntent = card.getAttribute('data-candidate-intent');
      var url = card.getAttribute('data-url');
      var title = card.getAttribute('data-title');

      var body = {
        action: action,
        candidateIntent: candidateIntent,
        url: url,
        title: title
      };
      if (extra.correctedIntent) {
        body.correctedIntent = extra.correctedIntent;
      }

      fetch('/api/intentions/' + encodeURIComponent(tabHash) + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(result) {
        if (result.ok) {
          var messages = {
            confirm: 'Intent confirmed \\u2014 Memento will track this',
            correct: 'Correction recorded \\u2014 this teaches the system',
            dismiss: 'Dismissed \\u2014 won\\u0027t ask about this again'
          };
          showToast(messages[action] || 'Got it');
          fadeOutCard(tabHash);
          updateResolvedCount(1);
          updateStats(action);
        } else {
          showToast('Error: ' + (result.error || 'Unknown error'));
        }
      })
      .catch(function(err) {
        console.error('Feedback failed:', err);
        showToast('Something went wrong');
      });
    }

    function confirmIntent(tabHash) {
      sendFeedback(tabHash, 'confirm');
    }

    function showCorrectInput(tabHash) {
      var row = document.getElementById('correct-row-' + tabHash);
      if (row) {
        row.classList.add('visible');
        var input = row.querySelector('.correct-input');
        if (input) input.focus();
      }
    }

    function submitCorrection(tabHash) {
      var row = document.getElementById('correct-row-' + tabHash);
      if (!row) return;
      var input = row.querySelector('.correct-input');
      var correctedIntent = input ? input.value.trim() : '';
      if (!correctedIntent) {
        input.focus();
        return;
      }
      sendFeedback(tabHash, 'correct', { correctedIntent: correctedIntent });
    }

    function dismissIntent(tabHash) {
      sendFeedback(tabHash, 'dismiss');
    }

    function updateResolvedCount(increment) {
      var summary = document.querySelector('#resolved-details > summary');
      if (!summary) return;
      var match = summary.textContent.match(/\\((\\d+)\\)/);
      var current = match ? parseInt(match[1]) : 0;
      summary.textContent = 'Resolved intentions (' + (current + increment) + ')';
      // Mark as stale so it reloads on next expand
      resolvedLoaded = false;
    }

    function updateStats(action) {
      var bar = document.querySelector('.stats-bar');
      if (!bar) {
        // Create stats bar if it doesn't exist yet
        var metaLine = document.querySelector('.meta-line');
        if (!metaLine) return;
        bar = document.createElement('div');
        bar.className = 'stats-bar';
        bar.innerHTML = '<span class="stats-badge stats-badge-confirmed" id="stat-confirmed">0 confirmed</span>'
          + '<span class="stats-badge stats-badge-corrected" id="stat-corrected">0 corrected</span>'
          + '<span class="stats-badge stats-badge-dismissed" id="stat-dismissed">0 dismissed</span>'
          + '<span class="stats-accuracy" id="stat-accuracy"></span>';
        metaLine.after(bar);
      }
      // Update the count for the specific action
      var badge = bar.querySelector('#stat-' + action);
      if (!badge) {
        var badgeId = 'stat-' + action;
        badge = bar.querySelector('.stats-badge-' + action);
      }
      if (badge) {
        var num = parseInt(badge.textContent) || 0;
        badge.textContent = (num + 1) + ' ' + action;
      }
      // Update accuracy
      var allBadges = bar.querySelectorAll('.stats-badge');
      var total = 0, confirmed = 0;
      allBadges.forEach(function(b) {
        var n = parseInt(b.textContent) || 0;
        total += n;
        if (b.classList.contains('stats-badge-confirmed')) confirmed = n;
      });
      var accEl = bar.querySelector('.stats-accuracy');
      if (accEl && total > 0) {
        accEl.textContent = Math.round((confirmed / total) * 100) + '% accuracy';
      }
    }

    // Load resolved intentions when details element is opened
    var resolvedDetails = document.getElementById('resolved-details');
    var resolvedLoaded = false;
    if (resolvedDetails) {
      resolvedDetails.addEventListener('toggle', function() {
        if (resolvedDetails.open && !resolvedLoaded) {
          resolvedLoaded = true;
          loadResolved();
        }
      });
    }

    function loadResolved() {
      var container = document.getElementById('resolved-content');
      if (!container) return;

      fetch('/api/intentions/resolved')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var groups = {
            confirmed: data.confirmed || [],
            corrected: data.corrected || [],
            dismissed: data.dismissed || []
          };
          if (groups.confirmed.length + groups.corrected.length + groups.dismissed.length === 0) {
            container.innerHTML = '<p class="resolved-loading">No resolved intentions yet.</p>';
            return;
          }

          var html = '';

          if (groups.confirmed.length > 0) {
            html += '<div class="resolved-group"><h3>Confirmed</h3>';
            groups.confirmed.forEach(function(item) {
              html += renderResolvedItem(item);
            });
            html += '</div>';
          }

          if (groups.corrected.length > 0) {
            html += '<div class="resolved-group"><h3>Corrected</h3>';
            groups.corrected.forEach(function(item) {
              html += renderResolvedItem(item, true);
            });
            html += '</div>';
          }

          if (groups.dismissed.length > 0) {
            html += '<div class="resolved-group"><h3>Dismissed</h3>';
            groups.dismissed.forEach(function(item) {
              html += renderResolvedItem(item);
            });
            html += '</div>';
          }

          container.innerHTML = html;
        })
        .catch(function(err) {
          console.error('Failed to load resolved:', err);
          container.innerHTML = '<p class="resolved-loading">Failed to load resolved intentions.</p>';
        });
    }

    function esc(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function renderResolvedItem(item, showCorrection) {
      var dateStr = '';
      if (item.at) {
        var d = new Date(item.at);
        dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      var html = '<div class="resolved-item">';
      html += '<span class="resolved-item-title">' + esc(item.title || item.url || 'Unknown') + '</span>';
      html += ' <span class="resolved-item-intent">' + esc(item.candidateIntent || '') + '</span>';
      if (dateStr) {
        html += ' <span class="resolved-item-date">' + dateStr + '</span>';
      }
      if (showCorrection && item.correctedIntent) {
        html += '<div class="resolved-correction">';
        html += 'System thought: <span class="original">' + esc(item.candidateIntent) + '</span>';
        html += ' &rarr; Actually: ' + esc(item.correctedIntent);
        html += '</div>';
      }
      html += '</div>';
      return html;
    }
  </script>
`;

/**
 * Render a single proposal card
 */
function renderProposalCard(proposal) {
  const {
    tabHash,
    url,
    title,
    recurrenceCount,
    distinctDays,
    coOccurring,
    candidateIntent,
    alternativeIntents,
  } = proposal;

  const domain = extractDomain(url);
  const safeTabHash = escapeHtml(tabHash);
  const safeTitle = escapeHtml(title || url);
  const safeUrl = escapeHtml(url);
  const safeIntent = escapeHtml(candidateIntent);

  const coTabs = (coOccurring || []).slice(0, 3);
  const coHtml = coTabs.length > 0
    ? `<p class="proposal-cooccurring"><strong>Often appears with:</strong> ${coTabs.map(c => escapeHtml(c.title || c.url)).join(', ')}</p>`
    : '';

  const altHtml = (alternativeIntents && alternativeIntents.length > 0)
    ? `<details class="proposal-alternatives">
        <summary>Other possibilities...</summary>
        <ul class="alt-list">
          ${alternativeIntents.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
      </details>`
    : '';

  return `
    <div class="proposal-card" id="card-${safeTabHash}"
         data-candidate-intent="${safeIntent}"
         data-url="${safeUrl}"
         data-title="${safeTitle}">
      <div class="proposal-title">
        <a href="${safeUrl}" target="_blank">${safeTitle}</a>
      </div>
      <div class="proposal-domain">${escapeHtml(domain)}</div>
      <span class="proposal-recurrence">Seen ${recurrenceCount || 0} times over ${distinctDays || 0} days</span>
      <div class="proposal-intent">${safeIntent}</div>
      ${coHtml}
      ${altHtml}
      <div class="proposal-actions">
        <button class="intent-btn intent-btn-confirm" onclick="confirmIntent('${safeTabHash}')">Confirm</button>
        <button class="intent-btn intent-btn-correct" onclick="showCorrectInput('${safeTabHash}')">Correct</button>
        <button class="intent-btn intent-btn-dismiss" onclick="dismissIntent('${safeTabHash}')">Dismiss</button>
      </div>
      <div class="correct-input-row" id="correct-row-${safeTabHash}">
        <input type="text" class="correct-input" placeholder="What do you actually want to do?"
               onkeydown="if(event.key==='Enter')submitCorrection('${safeTabHash}')">
        <button class="correct-submit" onclick="submitCorrection('${safeTabHash}')">Submit</button>
      </div>
    </div>
  `;
}

/**
 * Render the intentions page
 *
 * @param {Object} data - { proposals: IntentProposal[], meta: { sessionsAnalyzed, tabsAnalyzed, feedbackCount } }
 * @param {Object} stats - { total, confirmed, corrected, dismissed, accuracy }
 * @returns {string} HTML page
 */
function renderIntentionsPage(data, stats) {
  const proposals = data?.proposals || [];
  const meta = data?.meta || {};
  const { total = 0, confirmed = 0, corrected = 0, dismissed = 0, accuracy = 0 } = stats || {};

  // Stats bar (only show if there's history)
  const statsBarHtml = total > 0
    ? `<div class="stats-bar">
        <span class="stats-badge stats-badge-confirmed">${confirmed} confirmed</span>
        <span class="stats-badge stats-badge-corrected">${corrected} corrected</span>
        <span class="stats-badge stats-badge-dismissed">${dismissed} dismissed</span>
        <span class="stats-accuracy">${accuracy !== null ? Math.round(accuracy * 100) : '—'}% accuracy</span>
      </div>`
    : '';

  // Meta line
  const sessionsAnalyzed = meta.sessionsAnalyzed || 0;
  const tabsAnalyzed = meta.tabsAnalyzed || 0;
  const metaHtml = `<p class="meta-line">Analyzed ${sessionsAnalyzed} sessions, ${tabsAnalyzed} tabs</p>`;

  // Proposal cards or empty state
  const cardsHtml = proposals.length > 0
    ? proposals.map(p => renderProposalCard(p)).join('')
    : `<div class="empty-state">
        <p>No unresolved intentions detected. Keep browsing &mdash; Memento is learning your patterns.</p>
      </div>`;

  // Resolved section
  const resolvedCount = confirmed + corrected + dismissed;
  const resolvedHtml = `
    <div class="resolved-section">
      <details id="resolved-details">
        <summary>Resolved intentions (${resolvedCount})</summary>
        <div id="resolved-content">
          <p class="resolved-loading">Loading...</p>
        </div>
      </details>
    </div>
  `;

  const bodyContent = `
    <div class="page-content">
      <h1>Intentions</h1>
      <p class="page-subtitle">Tabs that keep appearing &mdash; what do you actually want to do about them?</p>
      <div style="display:flex;gap:0.25em;margin-bottom:1.5em">
        <a href="/intentions" style="padding:0.4em 1em;border:1px solid var(--border-light);border-radius:4px;font-size:0.85em;font-family:system-ui,sans-serif;color:var(--text-secondary);text-decoration:none">Themes</a>
        <a href="/intentions?view=tabs" style="padding:0.4em 1em;border:1px solid var(--text-primary);border-radius:4px;font-size:0.85em;font-family:system-ui,sans-serif;background:var(--text-primary);color:white;text-decoration:none">Tabs</a>
      </div>
      <details class="how-it-works">
        <summary>How this works</summary>
        <div class="how-it-works-content">
          <p>Memento scans your ${meta.sessionsAnalyzed || 0} sessions for tabs that recur across multiple days but were never resolved. Each card below is a hypothesis about what you might want to do.</p>
          <p><strong>Confirm</strong> &mdash; "Yes, that's my intent." The system records it and can track whether you've acted on it.</p>
          <p><strong>Correct</strong> &mdash; "Wrong guess, here's the real reason." This is the most valuable feedback &mdash; it teaches the system where its inference fails and why.</p>
          <p><strong>Dismiss</strong> &mdash; "I don't care about this." Removes it from future proposals so you don't see noise again.</p>
          <p>Every response is a labeled data point. Over time, the accuracy stat tells you whether Memento is getting smarter at reading your browsing patterns.</p>
        </div>
      </details>
      ${metaHtml}
      ${statsBarHtml}
      ${cardsHtml}
      ${resolvedHtml}
    </div>
  `;

  return wrapInLayout(bodyContent, {
    currentPage: 'intentions',
    title: 'Intentions',
    extraHead: pageCSS,
    extraScripts: pageJS
  });
}

module.exports = { renderIntentionsPage };
