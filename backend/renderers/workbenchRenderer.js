/**
 * Workbench Renderer
 *
 * Renders an inspector UI for exploring and editing the generative lineage
 * of a classification session. Shows prompts, raw responses, and rendered
 * outputs for each pass.
 */

const { escapeHtml, wrapInLayout } = require('./layout');

function escapeForTextarea(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a collapsible section for a single pass
 */
function renderPassSection(passName, passNumber, trace, rendered, isOpen = false) {
  if (!trace) {
    return `
      <section class="pass-section pass-${passNumber}">
        <div class="pass-header">
          <span class="pass-badge">Pass ${passNumber}</span>
          <span class="pass-name">${escapeHtml(passName)}</span>
          <span class="pass-status missing">No trace data</span>
        </div>
      </section>
    `;
  }

  const prompt = trace.prompt || '';
  const rawResponse = trace.rawResponse || '';
  const openAttr = isOpen ? 'open' : '';

  return `
    <section class="pass-section pass-${passNumber}">
      <details ${openAttr}>
        <summary class="pass-header">
          <span class="pass-badge">Pass ${passNumber}</span>
          <span class="pass-name">${escapeHtml(passName)}</span>
          <span class="pass-status">Trace captured</span>
        </summary>

        <div class="pass-content">
          <div class="trace-block">
            <div class="trace-label">
              <span>PROMPT</span>
              <button class="copy-btn" onclick="copyToClipboard('prompt-${passNumber}')">Copy</button>
            </div>
            <textarea id="prompt-${passNumber}" class="prompt-editor" rows="12">${escapeForTextarea(prompt)}</textarea>
          </div>

          <div class="trace-block">
            <div class="trace-label">
              <span>RAW RESPONSE</span>
              <button class="copy-btn" onclick="copyToClipboard('response-${passNumber}')">Copy</button>
            </div>
            <textarea id="response-${passNumber}" class="response-view" rows="12" readonly>${escapeForTextarea(rawResponse)}</textarea>
          </div>

          ${rendered ? `
          <div class="trace-block">
            <div class="trace-label">
              <span>RENDERED OUTPUT</span>
            </div>
            <div class="rendered-view">${rendered}</div>
          </div>
          ` : ''}

          <div class="pass-actions">
            <button class="rerun-btn" onclick="rerunPass(${passNumber})">
              &#9654; Re-run Pass ${passNumber}
            </button>
          </div>
        </div>
      </details>
    </section>
  `;
}

/**
 * Render the main workbench page
 */
function renderWorkbenchPage(session, sessionId) {
  const trace = session.trace || {};

  // Extract rendered outputs for each pass
  const pass1Rendered = session.narrative ?
    `<p><strong>Narrative:</strong> ${escapeHtml(session.narrative)}</p>
     <p><strong>Session Intent:</strong> ${escapeHtml(session.sessionIntent || 'Not specified')}</p>
     <p><strong>Overall Confidence:</strong> ${escapeHtml(session.reasoning?.overallConfidence || 'unknown')}</p>` : '';

  const pass3Rendered = session.visualization?.mermaid ?
    `<pre class="mermaid-source">${escapeHtml(session.visualization.mermaid)}</pre>` : '';

  const pass4Rendered = session.thematicAnalysis ?
    `<p><strong>Alternative Narrative:</strong> ${escapeHtml(session.thematicAnalysis.alternativeNarrative || 'None')}</p>
     <p><strong>Session Pattern:</strong> ${escapeHtml(session.thematicAnalysis.sessionPattern?.type || 'unknown')}</p>
     <p><strong>Recommendation:</strong> ${escapeHtml(session.thematicAnalysis.sessionPattern?.recommendation || 'None')}</p>` : '';

  // Build deep dive sections if present
  let pass2Sections = '';
  if (trace.pass2 && trace.pass2.length > 0) {
    pass2Sections = trace.pass2.map((dive, i) => {
      const diveRendered = session.deepDiveResults?.[i]?.analysis ?
        `<p><strong>Summary:</strong> ${escapeHtml(session.deepDiveResults[i].analysis.summary)}</p>` : '';
      return `
        <div class="deep-dive-item">
          <h4>Tab: ${escapeHtml(dive.title || `Tab ${dive.tabIndex}`)}</h4>
          <div class="trace-block">
            <div class="trace-label"><span>PROMPT</span></div>
            <textarea class="prompt-editor" rows="8" readonly>${escapeForTextarea(dive.prompt)}</textarea>
          </div>
          <div class="trace-block">
            <div class="trace-label"><span>RESPONSE</span></div>
            <textarea class="response-view" rows="6" readonly>${escapeForTextarea(dive.rawResponse)}</textarea>
          </div>
          ${diveRendered ? `<div class="trace-block"><div class="trace-label"><span>RENDERED</span></div><div class="rendered-view">${diveRendered}</div></div>` : ''}
        </div>
      `;
    }).join('');
  }

  const pageCSS = `
    /* Workbench dark theme overrides */
    :root {
      --bg-primary: #1a1a2e;
      --bg-secondary: #16213e;
      --bg-tertiary: #0f0f23;
      --text-primary: #eee;
      --text-secondary: #aaa;
      --text-muted: #666;
      --accent-link: #4a9eff;
      --accent-1: #4a9eff;
      --accent-2: #a855f7;
      --accent-3: #22c55e;
      --accent-4: #f59e0b;
      --border: #333;
      --border-light: #333;
    }

    body {
      font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      background: var(--bg-primary);
      color: var(--text-primary);
    }

    /* Nav dark overrides */
    .main-nav {
      background: var(--bg-tertiary);
      border-bottom-color: var(--border);
    }
    .nav-brand a { color: var(--text-primary); }
    .nav-link { color: var(--text-secondary); }
    .nav-link:hover { background: rgba(255,255,255,0.05); }
    .nav-link.active { background: var(--accent-1); color: white; }
    .session-nav { background: var(--bg-tertiary); border-bottom-color: var(--border); }
    .dev-toggle-btn { border-color: var(--border); color: var(--text-muted); }
    .dev-toggle-btn:hover { background: rgba(255,255,255,0.05); color: var(--text-secondary); }

    .breadcrumb {
      padding: 0.75em 0;
      font-size: 0.9em;
      margin-bottom: 1em;
    }
    .breadcrumb a {
      color: var(--accent-1);
      text-decoration: none;
    }
    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .workbench-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .overview {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }

    .overview h2 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: var(--text-secondary);
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .overview-item {
      background: var(--bg-tertiary);
      padding: 1rem;
      border-radius: 4px;
    }

    .overview-item label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }

    .overview-item value {
      display: block;
      font-size: 1rem;
    }

    .pass-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }

    .pass-section.pass-1 { border-left: 4px solid var(--accent-1); }
    .pass-section.pass-2 { border-left: 4px solid var(--accent-2); }
    .pass-section.pass-3 { border-left: 4px solid var(--accent-3); }
    .pass-section.pass-4 { border-left: 4px solid var(--accent-4); }

    .pass-header {
      padding: 1rem 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 1rem;
      list-style: none;
    }

    .pass-header::-webkit-details-marker { display: none; }

    .pass-badge {
      background: var(--bg-tertiary);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .pass-1 .pass-badge { color: var(--accent-1); }
    .pass-2 .pass-badge { color: var(--accent-2); }
    .pass-3 .pass-badge { color: var(--accent-3); }
    .pass-4 .pass-badge { color: var(--accent-4); }

    .pass-name {
      flex: 1;
      font-weight: 500;
    }

    .pass-status {
      font-size: 0.8rem;
      color: var(--accent-3);
    }

    .pass-status.missing {
      color: var(--text-muted);
    }

    .pass-content {
      padding: 0 1.5rem 1.5rem;
    }

    .trace-block {
      margin-bottom: 1.5rem;
    }

    .trace-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .trace-label span {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .copy-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      border-radius: 4px;
      cursor: pointer;
    }

    .copy-btn:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .prompt-editor, .response-view {
      width: 100%;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      color: var(--text-primary);
      font-family: inherit;
      font-size: 0.9rem;
      resize: vertical;
    }

    .prompt-editor:focus {
      outline: none;
      border-color: var(--accent-1);
    }

    .response-view {
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .rendered-view {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
    }

    .rendered-view p {
      margin-bottom: 0.5rem;
    }

    .mermaid-source {
      background: var(--bg-primary);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.85rem;
    }

    .pass-actions {
      display: flex;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .rerun-btn {
      background: var(--accent-1);
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }

    .rerun-btn:hover {
      filter: brightness(1.1);
    }

    .deep-dive-item {
      background: var(--bg-tertiary);
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .deep-dive-item h4 {
      font-size: 0.9rem;
      margin-bottom: 1rem;
      color: var(--accent-2);
    }

    .per-tab-section {
      margin-top: 2rem;
    }

    .per-tab-section h3 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: var(--text-secondary);
    }

    .tab-reasoning {
      background: var(--bg-tertiary);
      border-radius: 4px;
      padding: 1rem;
      margin-bottom: 0.5rem;
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 1rem;
      align-items: center;
    }

    .tab-index {
      background: var(--bg-primary);
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .tab-title {
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tab-category {
      background: var(--bg-secondary);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .tab-confidence {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .tab-confidence.high { color: var(--accent-3); }
    .tab-confidence.medium { color: var(--accent-4); }
    .tab-confidence.low { color: #ef4444; }

    .no-trace-warning {
      background: #7c2d12;
      border: 1px solid #ea580c;
      color: #fed7aa;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 2rem;
    }
  `;

  const bodyContent = `
    <div class="dev-only-block">
      <div class="workbench-container">
        <div class="breadcrumb">
          <a href="/results/${escapeHtml(sessionId)}">&larr; Back to Results</a>
        </div>

        <h1>Prompt Workbench</h1>
        <p class="page-subtitle">Inspect and iterate on the prompts behind this classification</p>

        ${!trace.pass1 ? `
        <div class="no-trace-warning">
          <strong>Warning:</strong> This session was captured without trace data.
          Re-classify with debugMode enabled to capture prompts and responses.
        </div>
        ` : ''}

        <div class="overview">
          <h2>Session Overview</h2>
          <div class="overview-grid">
            <div class="overview-item">
              <label>Total Tabs</label>
              <value>${session.totalTabs || 0}</value>
            </div>
            <div class="overview-item">
              <label>Categories</label>
              <value>${session.summary?.categories?.length || 0}</value>
            </div>
            <div class="overview-item">
              <label>Engine</label>
              <value>${escapeHtml(session.meta?.engine || 'unknown')}</value>
            </div>
            <div class="overview-item">
              <label>Model</label>
              <value>${escapeHtml(session.meta?.model || 'unknown')}</value>
            </div>
            <div class="overview-item">
              <label>Passes</label>
              <value>${session.meta?.passes || 1}</value>
            </div>
            <div class="overview-item">
              <label>Total Time</label>
              <value>${session.meta?.timing?.total ? session.meta.timing.total + 'ms' : 'N/A'}</value>
            </div>
          </div>
        </div>

        ${renderPassSection('Initial Classification', 1, trace.pass1, pass1Rendered, true)}

        ${trace.pass2 && trace.pass2.length > 0 ? `
        <section class="pass-section pass-2">
          <details>
            <summary class="pass-header">
              <span class="pass-badge">Pass 2</span>
              <span class="pass-name">Deep Dive Analysis</span>
              <span class="pass-status">${trace.pass2.length} tab(s) analyzed</span>
            </summary>
            <div class="pass-content">
              ${pass2Sections}
            </div>
          </details>
        </section>
        ` : renderPassSection('Deep Dive Analysis', 2, null, '')}

        ${renderPassSection('Visualization', 3, trace.pass3, pass3Rendered)}

        ${renderPassSection('Thematic Analysis', 4, trace.pass4, pass4Rendered)}

        ${session.reasoning?.perTab ? `
        <section class="per-tab-section">
          <h3>Per-Tab Reasoning (Pass 1)</h3>
          ${Object.entries(session.reasoning.perTab).map(([idx, r]) => `
            <div class="tab-reasoning">
              <div class="tab-index">${idx}</div>
              <div class="tab-title" title="${escapeHtml(r.url)}">${escapeHtml(r.title)}</div>
              <div class="tab-category">${escapeHtml(r.category)}</div>
              <div class="tab-confidence ${r.confidence}">${escapeHtml(r.confidence)}</div>
            </div>
          `).join('')}
        </section>
        ` : ''}
      </div>
    </div>
    <div class="page-content" style="display: block;">
      <noscript>
        <p style="color: var(--text-muted); text-align: center; padding: 3em;">
          Enable JavaScript to use the Workbench.
        </p>
      </noscript>
    </div>
    <script>
      // Hide the noscript fallback container when dev-mode is active
      (function() {
        var containers = document.querySelectorAll('.page-content');
        if (containers.length > 1) {
          containers[containers.length - 1].style.display = 'none';
        }
      })();
    </script>
  `;

  const extraScripts = `
    <script>
      var sessionId = '${escapeHtml(sessionId)}';

      function copyToClipboard(elementId) {
        var el = document.getElementById(elementId);
        if (el) {
          navigator.clipboard.writeText(el.value);
          var btn = el.parentElement.querySelector('.copy-btn');
          if (btn) {
            var orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function() { btn.textContent = orig; }, 1000);
          }
        }
      }

      async function rerunPass(passNumber) {
        var promptEl = document.getElementById('prompt-' + passNumber);
        if (!promptEl) {
          alert('Could not find prompt editor for pass ' + passNumber);
          return;
        }

        var prompt = promptEl.value;

        try {
          var res = await fetch('/api/workbench/rerun', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessionId,
              pass: passNumber,
              prompt: prompt
            })
          });

          if (!res.ok) {
            throw new Error('Rerun failed: ' + res.status);
          }

          var result = await res.json();

          var responseEl = document.getElementById('response-' + passNumber);
          if (responseEl && result.rawResponse) {
            responseEl.value = result.rawResponse;
          }

          alert('Pass ' + passNumber + ' re-run complete. Check the response panel.');
        } catch (err) {
          alert('Error: ' + err.message);
        }
      }
    </script>
  `;

  return wrapInLayout(bodyContent, {
    sessionId,
    currentPage: 'workbench',
    title: 'Workbench - ' + sessionId,
    sessionData: { totalTabs: session.totalTabs, timestamp: session.timestamp },
    extraHead: pageCSS,
    extraScripts: extraScripts,
    fullWidth: true
  });
}

module.exports = {
  renderWorkbenchPage
};
