# Task Actions Specification

## What Each Button Should Actually Do

### Ghost Tab Actions

| Action | Button Label | What Happens |
|--------|--------------|--------------|
| `engage` | "Read it now" | Opens URL in new tab, marks URL as "engaged" in all sessions |
| `release` | "Let it go" | Marks URL as "trashed" in all sessions containing it, adds to blocklist |
| `defer` | "Come back later" | Records deferral, hides task for 24 hours |

**Data changes for `release`:**
1. Find all sessions containing this URL
2. Add disposition `{ action: 'trash', url: X, source: 'task-picker' }` to each
3. Add URL to `~/.memento/released-urls.json` blocklist
4. Future ghost tab queries filter out blocklisted URLs

**Data changes for `engage`:**
1. Open the URL in a new browser tab
2. Add disposition `{ action: 'complete', url: X, source: 'task-picker' }` to most recent session
3. Log engagement in task-log.json for analytics

**Data changes for `defer`:**
1. Add to `~/.memento/deferred-tasks.json` with expiry timestamp
2. Task generator filters out deferred tasks until expiry

---

### Project Revival Actions

| Action | Button Label | What Happens |
|--------|--------------|--------------|
| `engage` | "Work on it" | Opens most recent session with that project in Launchpad |
| `pause` | "Put on hold" | Marks project as "paused" until user-specified date |
| `explore` | "Talk about why" | (Future: opens chat) For now, links to project's sessions |

**Data changes for `pause`:**
1. Add to `~/.memento/paused-projects.json` with optional resume date
2. Project health queries filter out paused projects

**Data changes for `engage`:**
1. Find most recent session with this project
2. Redirect to `/launchpad/{sessionId}?focus={projectName}`

---

### Tab Bankruptcy Actions

| Action | Button Label | What Happens |
|--------|--------------|--------------|
| `triage` | "Keep 5, release rest" | Opens triage interface to pick keepers |
| `detailed` | "Review each one" | Opens stale tabs list to review individually |
| `release_all` | "Declare bankruptcy" | Marks ALL stale tabs as trashed across all sessions |

**Data changes for `release_all`:**
1. Get all stale tabs (7+ days, 2+ occurrences)
2. For each URL, add `{ action: 'trash', source: 'bankruptcy' }` to all sessions
3. Add all URLs to blocklist
4. This is destructive - requires confirmation

**Data changes for `triage`:**
1. Redirect to `/tasks/triage` with list of stale tabs
2. User selects which to keep
3. Everything else gets `release_all` treatment

**Data changes for `detailed`:**
1. Redirect to `/tasks/review` showing each stale tab
2. User can engage/release/defer each one individually

---

## New Files Needed

### `~/.memento/released-urls.json`
```json
{
  "version": "1.0.0",
  "urls": [
    {
      "url": "https://arxiv.org/...",
      "releasedAt": "2026-01-16T...",
      "source": "task-picker",
      "reason": "ghost-tab-release"
    }
  ]
}
```

### `~/.memento/deferred-tasks.json`
```json
{
  "version": "1.0.0",
  "tasks": [
    {
      "taskId": "ghost-tab-xxx",
      "type": "ghost_tab",
      "url": "https://...",
      "deferredAt": "2026-01-16T...",
      "deferUntil": "2026-01-17T...",
      "reason": "user-deferred"
    }
  ]
}
```

### `~/.memento/paused-projects.json`
```json
{
  "version": "1.0.0",
  "projects": [
    {
      "name": "PREY/Null Provenance",
      "pausedAt": "2026-01-16T...",
      "resumeAfter": "2026-02-01T...",
      "reason": "user-paused"
    }
  ]
}
```

---

## Implementation Order

1. **Create `backend/taskActions.js`** - Core action handlers
2. **Create blocklist/deferral management** - Read/write helper functions
3. **Update `taskGenerator.js`** - Filter out blocked/deferred items
4. **Update `server.js`** - Route to real action handlers
5. **Update `taskPickerRenderer.js`** - Show feedback, open URLs
6. **Add triage/review pages** - For tab bankruptcy flow
