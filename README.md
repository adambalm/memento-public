# Memento

Memento captures your browser sessions, classifies each tab through a four-pass LLM pipeline, and tracks patterns across sessions over time. It is an open-source experiment in applying analytical techniques — classification, longitudinal pattern detection, semantic clustering, correction-based learning — to locally-collected browsing data.

The project has been in active development since December 2025. It has captured 188+ sessions and is still finding its shape. For the full story of what has been tried, what works, what failed, and what remains open, see [`docs/EXPLAINER.md`](docs/EXPLAINER.md).

## Quick Start

```bash
npm install
npm start
# Server runs at http://localhost:3000
```

Load the Chrome extension:

1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and select the `extension/` folder
4. Click the Memento icon in the toolbar to capture a session

## What It Does

A Chrome extension captures your open tabs (URL, title, first 8000 characters of page content). The backend runs a four-pass LLM classification:

1. **Classification** — Assigns each tab to a category with evidence and confidence levels
2. **Deep Dive** — Extracts entities and summaries from flagged technical documents
3. **Visualization** — Generates a Mermaid diagram of the session structure
4. **Thematic Analysis** — Maps cross-category connections to declared projects

Session artifacts are saved as JSON to `memory/sessions/`. A longitudinal layer analyzes patterns across sessions: recurring unfinished tabs, project health decay, distraction signatures by time of day.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — navigation hub, lock status, recent sessions |
| `/history` | Browse and search all captured sessions |
| `/results/:id` | Session summary with mirror insight, narrative, confidence badges |
| `/results/:id/map` | Mermaid visualization of session structure |
| `/results/:id/tabs` | Grouped tab list with category filtering |
| `/results/:id/analysis` | Deep dive analysis for flagged tabs |
| `/launchpad/:id` | Forced-completion mode — resolve every tab before capturing again |
| `/review/:id` | Like Launchpad but without the lock |
| `/tasks` | Surfaces one high-signal unresolved item from longitudinal analysis |
| `/intentions` | Theme detection — recurring tab clusters with feedback actions |
| `/workbench/:id` | Inspect, edit, and re-run LLM prompts for any session pass |
| `/preferences` | Manage learned classification rules from user corrections |
| `/dev` | Development dashboard — route inventory, feature status |

## LLM Engines

| Engine | Config | Notes |
|--------|--------|-------|
| Ollama (local) | `OLLAMA_ENDPOINT`, `OLLAMA_MODEL` in `.env` | Default: `http://localhost:11434/api/generate`, `qwen2.5-coder` |
| Anthropic | `ANTHROPIC_API_KEY` in `.env` | Claude 3.5 Haiku. ~$0.006/session |

Set the engine per-capture in the extension popup, or change `DEFAULT_ENGINE` in `classifier.js`.

## MCP Server

Exposes 18 tools to Claude Desktop and Claude.ai:

```bash
node backend/mcp-server.js
```

| Group | Tools |
|-------|-------|
| Session | `list_sessions`, `read_session`, `get_latest`, `search_sessions` |
| Context | `get_active_projects`, `set_active_projects` |
| Reclassify | `reclassify_session` (pass4 only or full 4-pass) |
| Lock | `get_lock_status`, `clear_lock` |
| Longitudinal | `longitudinal_stats`, `longitudinal_recurring_unfinished`, `longitudinal_project_health`, `longitudinal_distraction_signature`, `sync_attention_to_memory` |
| Corrections | `correction_stats`, `correction_suggestions`, `add_extractor`, `get_extractors` |

## Project Structure

```
memento-mvp/
├── backend/
│   ├── server.js              # Express routes (~50 endpoints)
│   ├── classifier.js          # 4-pass LLM classification pipeline
│   ├── longitudinal.js        # Cross-session pattern queries
│   ├── aggregator.js          # Session loading and indexing
│   ├── mirror.js              # Confrontational single-insight generation
│   ├── themeDetection.js      # Recurring tab cluster detection
│   ├── intentDetection.js     # Tab-level intent proposals
│   ├── correctionAnalyzer.js  # User correction → rule learning
│   ├── domainRules.js         # Domain-specific classification rules
│   ├── lockManager.js         # Session lock for forced-completion
│   ├── dispositions.js        # Append-only action tracking
│   ├── effortManager.js       # User-created tab groupings
│   ├── taskGenerator.js       # Longitudinal attention task surfacing
│   ├── taskEnricher.js        # LLM enrichment of surfaced tasks
│   ├── taskActions.js         # Task action handlers
│   ├── taskLog.js             # Action history
│   ├── attention-sync.js      # Export analysis to Basic Memory markdown
│   ├── basicMemoryBridge.js   # Basic Memory KB connection queries
│   ├── themeSaver.js          # Save themes as Basic Memory notes
│   ├── memory.js              # Session file read/write
│   ├── contextLoader.js       # User project context from context.json
│   ├── pdfExtractor.js        # Playwright PDF content extraction
│   ├── mcp-server.js          # MCP server (stdio, 18 tools)
│   ├── models/
│   │   ├── index.js           # Engine dispatch
│   │   ├── localOllama.js     # Ollama driver
│   │   └── anthropic.js       # Anthropic API driver
│   ├── mcp/
│   │   └── reclassify.js      # Reclassification logic
│   ├── prompts/
│   │   └── learned-rules.json # Accumulated classification rules
│   ├── evals/
│   │   └── eval-log.md        # Evaluation tracking
│   └── renderers/
│       ├── layout.js              # Shared layout utilities
│       ├── summaryRenderer.js     # Results summary page
│       ├── mapRenderer.js         # Mermaid visualization
│       ├── tabsRenderer.js        # Grouped tabs list
│       ├── analysisRenderer.js    # Deep dive analysis
│       ├── historyRenderer.js     # Session history browser
│       ├── dashboardRenderer.js   # Main dashboard
│       ├── devDashboardRenderer.js # Dev sprint tracker
│       ├── workbenchRenderer.js   # Prompt inspection/editing
│       ├── taskPickerRenderer.js  # Task surfacing UI
│       ├── preferencesRenderer.js # Learned rules management
│       ├── rulesRenderer.js       # Legacy rules page
│       ├── intentionsRenderer.js  # Tab-level intent proposals
│       └── themesRenderer.js      # Theme cluster view
├── extension/
│   ├── manifest.json          # Chrome Manifest V3
│   ├── popup.html             # Extension popup
│   └── popup.js               # Capture logic and mode selection
├── memory/
│   └── sessions/              # JSON session artifacts
├── docs/
│   ├── EXPLAINER.md           # Full project explainer
│   ├── DESIGN-PRINCIPLES.md
│   ├── HOW-MEMENTO-WORKS.md
│   ├── SESSION-ARTIFACT-INVARIANTS.md
│   ├── TASK-ACTIONS-SPEC.md
│   ├── TASK-PICKER-UX-REMEDIATION.md
│   └── THEME-DETECTION-UX-TESTING-RESULTS.md
├── tests/
│   ├── e2e/                   # Playwright end-to-end tests
│   └── mcp/                   # MCP server tests
├── CLAUDE.md                  # Instructions for Claude Code
├── TODO.md                    # Task tracking (partially stale)
└── package.json
```

## Session Schema (v1.3.0)

Each capture produces a timestamped JSON file in `memory/sessions/`:

```json
{
  "timestamp": "2026-01-15T09:25:08.048Z",
  "totalTabs": 24,
  "narrative": "...",
  "groups": { "Development": [...], "Research": [...] },
  "tasks": [...],
  "deepDiveResults": [...],
  "visualization": { "mermaid": "graph TB..." },
  "thematicAnalysis": {
    "projectSupport": {},
    "suggestedActions": [...],
    "sessionPattern": { "type": "research-focused" }
  },
  "reasoning": { "overallConfidence": "high", "perTab": {...} },
  "trace": { "pass1": {...}, "pass2": [...], "pass3": {...}, "pass4": {...} },
  "dispositions": [],
  "meta": {
    "schemaVersion": "1.3.0",
    "engine": "anthropic",
    "model": "claude-3-5-haiku-20241022",
    "timing": { "pass1": 2340, "pass2": 1200, "pass3": 890, "pass4": 1100 },
    "cost": { "totalCost": "0.005892" }
  }
}
```

Capture-time fields are frozen. Only the `dispositions` array grows (append-only). See `docs/SESSION-ARTIFACT-INVARIANTS.md`.

## License

MIT
