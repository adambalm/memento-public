# Memento MVP - TODO

## Future Features

### Action Synthesis (Pass 4)
- [ ] **Start Writing action** - Open actual writing session instead of advisory alert
  - Clipboard copy: consolidate notes from supporting tabs, copy as markdown
  - Open URL: add `writingTarget` URL to project config, button opens it
  - Obsidian URI: `obsidian://new?vault=X&name=Y&content=Z`
  - VS Code: `vscode://file/path`
  - Requires: `context.json` extension with per-project writing targets

- [ ] **Close tabs action** - Programmatically close distraction tabs
  - Requires extension integration (message passing from results page)

- [ ] **Update context action** - Add missing keywords to context.json
  - Backend endpoint to update ~/.memento/context.json

### Classification
- [ ] Improve literary/thematic deep dive quality
- [ ] Handle tab groups (Chrome API may not enumerate collapsed groups correctly)
- [ ] Multi-window support verification

### UI/UX
- [ ] Session comparison (diff two sessions)
- [ ] Session history browser
- [ ] Export session as markdown

### MCP Server (Claude Desktop Integration)
- [ ] **Expose Memento as MCP server** - Let Claude Desktop query browsing context
  - `list_sessions` - list all saved sessions with timestamps and summaries
  - `read_session` - read a specific session's full classification
  - `get_latest` - get most recent session ("what was I just doing?")
  - `search_sessions` - find sessions mentioning keywords ("PREY", "healthcare API")
  - `get_project_activity` - all sessions touching a specific project
  - Server wraps `memory/sessions/*.json` data
  - Tab capture still requires Chrome extension, but history becomes queryable

### Infrastructure
- [ ] Tests (Playwright for UI, unit tests for classifier)
- [ ] Multiple LLM provider support (OpenAI, local Ollama)

---

## Known Issues

See `CLAUDE.md` for current known issues.
