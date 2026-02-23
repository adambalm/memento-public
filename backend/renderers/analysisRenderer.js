/**
 * Analysis Renderer - Deep Analysis Screen
 * Shows detailed reasoning, deep dives, thematic analysis, and actions
 */

const { escapeHtml, wrapInLayout } = require('./layout');

/**
 * Render the deep analysis page
 */
function renderAnalysisPage(sessionData, sessionId) {
  const {
    deepDiveResults,
    deepDive,
    thematicAnalysis,
    totalTabs,
    timestamp,
    trace,
    meta,
    reasoning
  } = sessionData;

  const timing = meta?.timing || {};
  const usage = meta?.usage || null;
  const hasTrace = trace && (trace.pass1?.prompt || trace.pass2?.length > 0);

  const extraStyles = `
    .analysis-intro {
      font-size: 1.05em;
      color: var(--text-secondary);
      margin-bottom: 2em;
    }

    /* Flow trace - what happened */
    .flow-trace {
      background: var(--bg-secondary);
      padding: 1.5em;
      border-radius: 8px;
      margin-bottom: 2em;
    }
    .flow-trace h2 { margin-top: 0; }
    .flow-stage {
      margin: 1.5em 0;
      padding-left: 1em;
      border-left: 3px solid var(--border-light);
    }
    .flow-stage h3 {
      margin-top: 0;
      color: var(--text-secondary);
    }
    .flow-desc {
      color: var(--text-secondary);
      font-size: 0.95em;
      margin-bottom: 0.75em;
    }

    /* Deep dive trace */
    .deep-dive-trace {
      margin-top: 0.75em;
    }
    .dive-trace-item {
      display: flex;
      align-items: flex-start;
      padding: 0.5em 0;
      border-bottom: 1px solid var(--border-light);
    }
    .dive-trace-item:last-child { border-bottom: none; }
    .dive-trace-item.failed { opacity: 0.7; }
    .trace-num {
      font-family: system-ui, sans-serif;
      background: var(--border-light);
      width: 1.5em;
      height: 1.5em;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 0.8em;
      margin-right: 0.75em;
      flex-shrink: 0;
    }
    .trace-content { flex: 1; }
    .trace-title {
      font-size: 0.9em;
      margin: 0;
    }
    .trace-result {
      font-size: 0.85em;
      color: var(--text-muted);
      margin: 0.25em 0 0 0;
    }
    .trace-error {
      font-size: 0.85em;
      color: var(--accent-link);
      margin: 0.25em 0 0 0;
    }

    /* Deep dive detail */
    .deep-dive {
      margin-bottom: 1.5em;
      padding-bottom: 1.5em;
      border-bottom: 1px solid var(--border-light);
    }
    .deep-dive:last-child { border-bottom: none; }
    .deep-dive h3 { margin-top: 0; }
    .deep-dive h4 {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 1em 0 0.25em 0;
      font-style: normal;
    }
    .analysis-summary, .analysis-keypoints, .analysis-entities, .analysis-relevance {
      margin-bottom: 0.75em;
    }
    .analysis-entities dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25em 1em;
      margin: 0;
      font-size: 0.9em;
    }
    .analysis-entities dt {
      font-weight: 600;
      color: var(--text-secondary);
    }
    .analysis-entities dd { margin: 0; }
    .deep-dive ul { margin-left: 1.5em; margin-top: 0.5em; }
    .deep-dive li { margin-bottom: 0.25em; }
    .error { color: var(--accent-link); font-style: italic; }

    /* Thematic Analysis */
    .thematic-section {
      background: linear-gradient(135deg, #f8f7f2 0%, #f5f4ef 100%);
      padding: 1.5em;
      margin: 2em 0;
      border-radius: 8px;
      border: 1px solid var(--border-light);
    }
    .thematic-section h2 {
      margin-top: 0;
      color: #4a4a4a;
    }

    .alternative-narrative {
      background: #fff8e6;
      padding: 1em;
      margin-bottom: 1.5em;
      border-left: 4px solid #f0ad4e;
      border-radius: 0 6px 6px 0;
    }
    .alternative-narrative h3 {
      margin-top: 0;
      font-size: 1em;
      color: #856404;
    }
    .alternative-narrative p {
      margin: 0;
      font-style: italic;
    }

    .hidden-connection {
      background: #e8f4f8;
      padding: 1em;
      margin-bottom: 1.5em;
      border-left: 4px solid #5bc0de;
      border-radius: 0 6px 6px 0;
    }
    .hidden-connection h3 {
      margin-top: 0;
      font-size: 1em;
      color: #31708f;
    }
    .hidden-connection p {
      margin: 0;
      font-style: italic;
    }

    .project-support, .thematic-throughlines, .session-pattern-section {
      margin-bottom: 1.5em;
    }
    .project-support-item, .throughline-item {
      background: var(--bg-primary);
      padding: 0.75em 1em;
      margin: 0.5em 0;
      border-radius: 4px;
      border-left: 3px solid var(--text-muted);
    }
    .project-support-item h4, .throughline-item h4 {
      margin: 0 0 0.5em 0;
      font-size: 1em;
      color: var(--text-secondary);
    }
    .support-evidence {
      margin: 0.5em 0 0 0;
      padding-left: 1.5em;
      font-size: 0.9em;
    }
    .support-evidence li {
      margin: 0.25em 0;
    }
    .tab-ref {
      font-family: system-ui, sans-serif;
      background: var(--bg-secondary);
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 0.9em;
    }
    .throughline-tabs, .throughline-projects {
      font-size: 0.9em;
      color: var(--text-muted);
      margin: 0.25em 0;
    }
    .throughline-insight {
      font-style: italic;
      margin: 0.5em 0 0 0;
    }

    .session-pattern {
      background: var(--bg-primary);
      padding: 1em;
      border-radius: 4px;
    }
    .session-pattern h3 { margin-top: 0; }
    .pattern-details {
      display: flex;
      gap: 1em;
      align-items: center;
      margin-bottom: 0.5em;
    }
    .pattern-type {
      font-family: system-ui, sans-serif;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.85em;
      background: var(--bg-secondary);
    }
    .pattern-research-heavy { background: #fff3cd; color: #856404; }
    .pattern-output-focused { background: #d4edda; color: #155724; }
    .pattern-balanced { background: #cce5ff; color: #004085; }
    .pattern-scattered { background: #f8d7da; color: #721c24; }
    .risk-flags {
      font-size: 0.9em;
      color: #856404;
      margin: 0.5em 0;
    }
    .pattern-recommendation {
      font-weight: 500;
      margin: 0.5em 0 0 0;
    }

    /* Action Cards */
    .action-cards {
      display: grid;
      gap: 1em;
      margin-top: 1em;
    }
    .action-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-light);
      border-radius: 8px;
      padding: 1.25em;
    }
    .action-card.priority-high {
      border-left: 4px solid #28a745;
    }
    .action-card.priority-medium {
      border-left: 4px solid #ffc107;
    }
    .action-card.priority-low {
      border-left: 4px solid #6c757d;
    }
    .action-header {
      display: flex;
      gap: 0.75em;
      align-items: center;
      margin-bottom: 0.5em;
    }
    .priority-badge {
      font-family: system-ui, sans-serif;
      font-size: 0.75em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--bg-secondary);
      color: var(--text-muted);
    }
    .priority-high .priority-badge { background: #d4edda; color: #155724; }
    .priority-medium .priority-badge { background: #fff3cd; color: #856404; }
    .project-tag {
      font-size: 0.85em;
      color: var(--text-secondary);
      font-style: italic;
    }
    .action-text {
      font-size: 1.05em;
      font-weight: 500;
      margin: 0 0 0.25em 0;
    }
    .action-reason {
      font-size: 0.9em;
      color: var(--text-muted);
      margin: 0;
    }

    /* Timing */
    .timing-section {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1px solid var(--border-light);
    }
    .timing-table {
      border-collapse: collapse;
      font-size: 0.9em;
    }
    .timing-table td {
      padding: 0.25em 1em 0.25em 0;
    }
    .timing-table .timing-value {
      font-family: system-ui, sans-serif;
      text-align: right;
    }
    .timing-table .total td {
      font-weight: 600;
      border-top: 1px solid var(--border-light);
      padding-top: 0.5em;
    }

    /* Debug trace */
    .trace-section {
      background: #f5f5f0;
      border: 1px solid var(--border-light);
      padding: 1.5em;
      margin: 2em 0;
      border-radius: 8px;
    }
    .trace-section h2 {
      margin-top: 0;
      color: var(--text-secondary);
    }
    .trace-intro {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 1em;
    }
    .trace-panel {
      margin: 1em 0;
      border-left: 3px solid var(--text-muted);
      background: var(--bg-primary);
    }
    .trace-panel summary {
      cursor: pointer;
      padding: 0.75em 1em;
      font-weight: 600;
      color: var(--text-secondary);
      background: var(--bg-secondary);
    }
    .trace-panel summary:hover {
      background: #e8e8e0;
    }
    .trace-panel[open] summary {
      border-bottom: 1px solid var(--border-light);
    }
    .trace-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1em;
      padding: 1em;
    }
    @media (min-width: 1000px) {
      .trace-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    .trace-prompt, .trace-response {
      background: var(--bg-secondary);
      padding: 0.75em;
      border-radius: 4px;
    }
    .trace-prompt h4, .trace-response h4 {
      margin: 0 0 0.5em 0;
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-secondary);
    }
    .trace-code {
      max-height: 300px;
      overflow: auto;
      font-family: Consolas, monospace;
      font-size: 0.8em;
      background: white;
      padding: 0.75em;
      border: 1px solid var(--border-light);
      border-radius: 3px;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  `;

  // Build the "What Happened" flow
  const triageDecisions = deepDive || [];
  const flowHtml = `
    <div class="flow-trace">
      <h2>What Happened</h2>

      <div class="flow-stage">
        <h3>Step 1: Quick Sort</h3>
        <p class="flow-desc">Looked at all ${totalTabs} tabs and put them into categories based on their titles and URLs. ${triageDecisions.length > 0 ? `Found ${triageDecisions.length} that seemed worth reading more carefully.` : 'Nothing stood out as needing special attention.'}</p>
      </div>

      ${deepDiveResults && deepDiveResults.length > 0 ? `
        <div class="flow-stage">
          <h3>Step 2: Closer Look</h3>
          <p class="flow-desc">Read through these ${deepDiveResults.length} tabs to understand what they're really about:</p>
          <div class="deep-dive-trace">
            ${deepDiveResults.map((dive, i) => `
              <div class="dive-trace-item ${dive.error ? 'failed' : ''}">
                <span class="trace-num">${i + 1}</span>
                <div class="trace-content">
                  <p class="trace-title">${escapeHtml(dive.title || 'Unknown')}</p>
                  ${dive.analysis?.summary ? `
                    <p class="trace-result">${escapeHtml(dive.analysis.summary)}</p>
                  ` : dive.error ? `<p class="trace-error">Couldn't access this page</p>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="flow-stage">
        <h3>Step 3: Big Picture</h3>
        <p class="flow-desc">Drew a map showing how your tabs connect to each other (see the Map view).</p>
      </div>

      ${thematicAnalysis ? `
        <div class="flow-stage">
          <h3>Step 4: Hidden Patterns</h3>
          <p class="flow-desc">Looked for connections you might not notice—themes that cut across categories, or things that might be related even though they look separate.</p>
          ${thematicAnalysis.sessionPattern?.observation || thematicAnalysis.sessionPattern?.recommendation ? `
            <p class="flow-desc"><strong>Overall vibe:</strong> ${escapeHtml(thematicAnalysis.sessionPattern.observation || thematicAnalysis.sessionPattern.recommendation || '')}</p>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;

  // Deep dive detail (full results)
  const deepDiveHtml = (deepDiveResults && deepDiveResults.length > 0) ? `
    <section>
      <h2>Deep Analysis Detail</h2>
      ${deepDiveResults.map(dive => `
        <article class="deep-dive">
          <h3><a href="${escapeHtml(dive.url)}" target="_blank">${escapeHtml(dive.title)}</a></h3>
          ${dive.analysis ? `
            <div class="analysis-summary">
              <h4>Summary</h4>
              <p>${escapeHtml(dive.analysis.summary || 'No summary available')}</p>
            </div>
            ${dive.analysis.keyPoints && dive.analysis.keyPoints.length > 0 ? `
              <div class="analysis-keypoints">
                <h4>Key Points</h4>
                <ul>
                  ${dive.analysis.keyPoints.map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${dive.analysis.entities && (
              (dive.analysis.entities.authors && dive.analysis.entities.authors.length > 0) ||
              (dive.analysis.entities.organizations && dive.analysis.entities.organizations.length > 0) ||
              (dive.analysis.entities.technologies && dive.analysis.entities.technologies.length > 0)
            ) ? `
              <div class="analysis-entities">
                <h4>People and Things Mentioned</h4>
                <dl>
                  ${dive.analysis.entities.authors?.length > 0 ? `<dt>Authors</dt><dd>${dive.analysis.entities.authors.map(e => escapeHtml(e)).join(', ')}</dd>` : ''}
                  ${dive.analysis.entities.organizations?.length > 0 ? `<dt>Organizations</dt><dd>${dive.analysis.entities.organizations.map(e => escapeHtml(e)).join(', ')}</dd>` : ''}
                  ${dive.analysis.entities.technologies?.length > 0 ? `<dt>Technologies</dt><dd>${dive.analysis.entities.technologies.map(e => escapeHtml(e)).join(', ')}</dd>` : ''}
                </dl>
              </div>
            ` : ''}
            ${dive.analysis.relevance ? `
              <div class="analysis-relevance">
                <h4>Why This Matters</h4>
                <p>${escapeHtml(dive.analysis.relevance)}</p>
              </div>
            ` : ''}
          ` : '<p class="error">Analysis failed</p>'}
        </article>
      `).join('')}
    </section>
  ` : '';

  // Thematic analysis
  const thematicHtml = thematicAnalysis ? renderThematicSection(thematicAnalysis) : '';

  // Action cards
  const actionsHtml = thematicAnalysis?.suggestedActions?.length > 0 ? `
    <section>
      <h2>What To Do Now</h2>
      <div class="action-cards">
        ${thematicAnalysis.suggestedActions.map(action => `
          <div class="action-card priority-${action.priority || 'medium'}">
            <div class="action-header">
              <span class="priority-badge">${escapeHtml(action.priority || 'medium')}</span>
              ${action.project ? `<span class="project-tag">${escapeHtml(action.project)}</span>` : ''}
            </div>
            <p class="action-text">${escapeHtml(action.action)}</p>
            ${action.reason ? `<p class="action-reason">${escapeHtml(action.reason)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  // Timing
  const totalTime = timing.total || (timing.pass1 || 0) + (timing.pass2 || 0) + (timing.pass3 || 0) + (timing.pass4 || 0);
  const timingHtml = totalTime ? `
    <section class="timing-section">
      <h2>Timing</h2>
      <table class="timing-table">
        <tr><td>Step 1 (Quick Sort)</td><td class="timing-value">${((timing.pass1 || 0) / 1000).toFixed(1)}s</td></tr>
        <tr><td>Step 2 (Closer Look)</td><td class="timing-value">${((timing.pass2 || 0) / 1000).toFixed(1)}s</td></tr>
        <tr><td>Step 3 (Big Picture)</td><td class="timing-value">${((timing.pass3 || 0) / 1000).toFixed(1)}s</td></tr>
        ${timing.pass4 ? `<tr><td>Step 4 (Hidden Patterns)</td><td class="timing-value">${((timing.pass4 || 0) / 1000).toFixed(1)}s</td></tr>` : ''}
        <tr class="total"><td>Total</td><td class="timing-value">${(totalTime / 1000).toFixed(1)}s</td></tr>
      </table>
    </section>
  ` : '';

  // Debug trace (collapsed by default)
  const traceHtml = hasTrace ? `
    <section class="trace-section">
      <h2>Debug Trace</h2>
      <p class="trace-intro">Technical details about what was sent to and received from the AI.</p>

      ${trace.pass1?.prompt ? `
        <details class="trace-panel">
          <summary>Step 1: Classification${usage?.pass1?.input_tokens ? ` (${usage.pass1.input_tokens.toLocaleString()} tokens)` : ''}</summary>
          <div class="trace-grid">
            <div class="trace-prompt">
              <h4>Prompt Sent</h4>
              <pre class="trace-code">${escapeHtml(trace.pass1.prompt)}</pre>
            </div>
            <div class="trace-response">
              <h4>Response Received</h4>
              <pre class="trace-code">${escapeHtml(trace.pass1.rawResponse || '(no response)')}</pre>
            </div>
          </div>
        </details>
      ` : ''}

      ${trace.pass3?.prompt ? `
        <details class="trace-panel">
          <summary>Step 3: Visualization</summary>
          <div class="trace-grid">
            <div class="trace-prompt">
              <h4>Prompt Sent</h4>
              <pre class="trace-code">${escapeHtml(trace.pass3.prompt)}</pre>
            </div>
            <div class="trace-response">
              <h4>Response Received</h4>
              <pre class="trace-code">${escapeHtml(trace.pass3.rawResponse || '(no response)')}</pre>
            </div>
          </div>
        </details>
      ` : ''}

      ${trace.pass4?.prompt ? `
        <details class="trace-panel">
          <summary>Step 4: Thematic Analysis</summary>
          <div class="trace-grid">
            <div class="trace-prompt">
              <h4>Prompt Sent</h4>
              <pre class="trace-code">${escapeHtml(trace.pass4.prompt)}</pre>
            </div>
            <div class="trace-response">
              <h4>Response Received</h4>
              <pre class="trace-code">${escapeHtml(trace.pass4.rawResponse || '(no response)')}</pre>
            </div>
          </div>
        </details>
      ` : ''}
    </section>
  ` : '';

  const content = `
    <div class="page-content">
      <h1>Deep Analysis</h1>
      <p class="analysis-intro">A detailed look at how this session was analyzed and what patterns emerged.</p>

      ${flowHtml}
      ${deepDiveHtml}
      ${thematicHtml}
      ${actionsHtml}
      ${timingHtml}
      ${traceHtml}
    </div>
  `;

  return wrapInLayout(content, {
    sessionId,
    currentPage: 'analysis',
    title: 'Deep Analysis',
    sessionData: { totalTabs, timestamp },
    extraHead: extraStyles
  });
}

/**
 * Render the thematic analysis section
 */
function renderThematicSection(thematicAnalysis) {
  const { projectSupport, thematicThroughlines, alternativeNarrative, hiddenConnection, sessionPattern } = thematicAnalysis;

  // Project support section
  const projectSupportHtml = Object.keys(projectSupport || {}).length > 0 ? `
    <div class="project-support">
      <h3>How Tabs Support Your Projects</h3>
      ${Object.entries(projectSupport).map(([project, support]) => `
        <div class="project-support-item">
          <h4>${escapeHtml(project)}</h4>
          ${support.directTabs?.length > 0 ? `
            <p><strong>Directly related:</strong> tabs ${support.directTabs.join(', ')}</p>
          ` : ''}
          ${support.supportingTabs?.length > 0 ? `
            <p><strong>Supporting:</strong> tabs ${support.supportingTabs.join(', ')}</p>
          ` : ''}
          ${support.supportingEvidence?.length > 0 ? `
            <ul class="support-evidence">
              ${support.supportingEvidence.map(e => `
                <li><span class="tab-ref">Tab ${e.tabIndex}</span> ${escapeHtml(e.reason)}</li>
              `).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Thematic throughlines section
  const throughlinesHtml = thematicThroughlines?.length > 0 ? `
    <div class="thematic-throughlines">
      <h3>Themes Across Categories</h3>
      ${thematicThroughlines.map(t => `
        <div class="throughline-item">
          <h4>${escapeHtml(t.theme)}</h4>
          <p class="throughline-tabs">Tabs: ${(t.tabs || []).join(', ')}</p>
          ${t.projects?.length > 0 ? `<p class="throughline-projects">Projects: ${t.projects.map(p => escapeHtml(p)).join(', ')}</p>` : ''}
          ${t.insight ? `<p class="throughline-insight">${escapeHtml(t.insight)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  // Session pattern section
  const sessionPatternHtml = sessionPattern ? `
    <div class="session-pattern-section">
      <h3>Session Pattern</h3>
      <div class="session-pattern">
        <div class="pattern-details">
          <span class="pattern-type pattern-${(sessionPattern.type || 'unknown').replace(/[^a-zA-Z]/g, '-')}">${escapeHtml(sessionPattern.type || 'Unknown')}</span>
          ${sessionPattern.intakeVsOutput ? `<span>${escapeHtml(sessionPattern.intakeVsOutput)}</span>` : ''}
        </div>
        ${sessionPattern.riskFlags?.length > 0 ? `
          <p class="risk-flags"><strong>Watch out for:</strong> ${sessionPattern.riskFlags.map(f => escapeHtml(f)).join(', ')}</p>
        ` : ''}
        ${sessionPattern.recommendation ? `
          <p class="pattern-recommendation">${escapeHtml(sessionPattern.recommendation)}</p>
        ` : ''}
      </div>
    </div>
  ` : '';

  // Alternative narrative
  const altNarrativeHtml = alternativeNarrative ? `
    <div class="alternative-narrative">
      <h3>Another Way to See This</h3>
      <p>${escapeHtml(alternativeNarrative)}</p>
    </div>
  ` : '';

  // Hidden connection
  const hiddenConnectionHtml = hiddenConnection ? `
    <div class="hidden-connection">
      <h3>Something You Might Not See</h3>
      <p>${escapeHtml(hiddenConnection)}</p>
    </div>
  ` : '';

  return `
    <section class="thematic-section">
      <h2>Looking Deeper</h2>
      ${altNarrativeHtml}
      ${hiddenConnectionHtml}
      ${throughlinesHtml}
      ${projectSupportHtml}
      ${sessionPatternHtml}
    </section>
  `;
}

module.exports = { renderAnalysisPage };
