# Session Artifact Invariants

**Status:** Canonical
**Approved:** 2026-01-02
**Origin:** Dialogue - Nuclear Option Memento Convergence (HO approval)

---

## Overview

This document defines the immutability guarantees for Memento session artifacts. These invariants are **non-negotiable** and must be enforced in all code paths.

---

## Definition: Semantic Immutability

Memento uses **semantic immutability**, not file-level immutability.

**Meaning:**
- Capture-time fields are frozen at creation and never modified
- Post-capture fields (dispositions) are append-only
- Both live in the same file for operational simplicity

**Why not file-level immutability:**
- Separate files add join complexity without security benefit
- File-level immutability doesn't prevent tampering (anyone with write access can edit)
- The forensic question ("what was open at capture time?") is always answerable from capture-time fields

---

## Session Artifact Structure

```javascript
{
  // ═══════════════════════════════════════════════════════════════
  // CAPTURE-TIME FIELDS — Frozen at creation, NEVER modified
  // ═══════════════════════════════════════════════════════════════

  "meta": {
    "schemaVersion": "1.1.0",
    "capturedAt": "2026-01-02T10:00:00.000Z",
    "engine": "ollama-local",
    "model": "qwen2.5-coder",
    "endpoint": "http://localhost:11434/api/generate",
    "mode": "results"  // or "launchpad"
  },

  "tabs": [
    // Raw tab data exactly as captured
    { "url": "...", "title": "...", "content": "..." }
  ],

  "groups": [
    // LLM classification results
    { "category": "Development", "items": [...] }
  ],

  "narrative": "User was researching...",

  "thematicAnalysis": {
    "sessionPattern": { "type": "..." },
    "clusters": [...]
  },

  // ═══════════════════════════════════════════════════════════════
  // POST-CAPTURE FIELDS — Append-only, grows as user interacts
  // ═══════════════════════════════════════════════════════════════

  "dispositions": [
    // Each entry is immutable once written
    // New entries are appended, never inserted or modified
    {
      "action": "regroup",
      "itemId": "tab-3",
      "from": "Research",
      "to": "Development",
      "at": "2026-01-02T10:05:00.000Z"
    },
    {
      "action": "trash",
      "itemId": "tab-7",
      "at": "2026-01-02T10:06:00.000Z"
    },
    {
      "action": "complete",
      "itemId": "tab-2",
      "at": "2026-01-02T10:07:00.000Z"
    },
    {
      "action": "promote",
      "itemId": "tab-5",
      "target": "basic-memory://notes/research/healthcare-ai",
      "at": "2026-01-02T10:08:00.000Z"
    }
  ]
}
```

---

## The Invariants

### Invariant 1: Capture-Time Immutability

**Fields:** `meta`, `tabs`, `groups`, `narrative`, `thematicAnalysis`

**Rule:** These fields are written once at session creation and NEVER modified afterward.

**Enforcement:**
- `saveSession()` is the only function that writes these fields
- `saveSession()` is only called during initial capture
- No update function exists for these fields

**Violation detection:**
- If `meta.capturedAt` differs from file creation time, something is wrong
- Git history can audit any unauthorized changes

---

### Invariant 2: Append-Only Dispositions

**Field:** `dispositions`

**Rule:** New disposition entries are appended to the array. Existing entries are never modified or removed.

**Enforcement:**
- `appendDisposition(sessionId, disposition)` is the only function that modifies dispositions
- It reads the file, pushes to the array, writes the file
- No function exists to edit or delete disposition entries

**Disposition schema:**
```javascript
{
  action: "trash" | "complete" | "regroup" | "reprioritize" | "promote",
  itemId: string,        // Which tab/item was affected
  at: ISO8601 timestamp, // When the action occurred

  // Action-specific fields:
  from?: string,         // regroup: original category
  to?: string,           // regroup: new category
  target?: string,       // promote: destination URI
  priority?: number      // reprioritize: new priority value
}
```

---

### Invariant 3: No Silent Mutations

**Rule:** Every user action that changes the logical state of a session MUST be recorded as a disposition.

**Covered actions:**
- `trash` — User discards an item as noise
- `complete` — User marks an item as done/handled
- `regroup` — User moves an item to a different category
- `reprioritize` — User changes item priority/order
- `promote` — User creates a KB artifact from an item

**Why:** These signals feed the learning loop. Trashed items indicate classifier noise. Regrouped items indicate misclassification. This data improves future classification.

---

## Code Enforcement

### memory.js — Capture Path

```javascript
// ONLY creates new sessions, never modifies existing
async function saveSession(data) {
  const filename = getSessionFilename();  // Timestamp-based, unique
  const session = {
    ...data,
    dispositions: []  // Always starts empty
  };
  await fs.writeFile(filepath, JSON.stringify(session, null, 2));
}
```

### dispositions.js — User Action Path

```javascript
// ONLY appends to dispositions array, never modifies capture-time fields
async function appendDisposition(sessionId, disposition) {
  const session = await readSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // Ensure disposition has timestamp
  const entry = {
    ...disposition,
    at: disposition.at || new Date().toISOString()
  };

  // Append only
  session.dispositions = session.dispositions || [];
  session.dispositions.push(entry);

  // Write back — only dispositions array changed
  await fs.writeFile(sessionPath(sessionId), JSON.stringify(session, null, 2));
}
```

---

## Forensic Integrity

**The forensic question:** "What tabs were open and how were they classified at capture time?"

**How to answer:** Read `meta`, `tabs`, `groups` fields. Ignore `dispositions`.

**Guarantee:** These fields are never modified after creation. The answer is always available and accurate.

**Dispositions are separate:** They record what the user *did* with the captured data, not what was captured.

---

## Session Lock Integration

When operating in Launchpad mode:

1. Session is captured with `meta.mode = "launchpad"`
2. Lock is acquired: `~/.memento/lock.json`
3. User resolves items in Launchpad, creating disposition entries
4. When all items resolved (or override), lock clears
5. New capture allowed

The lock state is **globally visible** — switching to Results mode does not hide unresolved Launchpad sessions.

---

## Schema Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-20 | Initial schema (meta, groups, narrative) |
| 1.1.0 | 2026-01-02 | Added dispositions array, mode field |

---

## Related Documents

- [Dialogue - Nuclear Option Memento Convergence](../../../basic-memory/dialogues/Dialogue%20-%20Nuclear%20Option%20Memento%20Convergence.md)
- [Context Sage - Project Index](../../../basic-memory/projects/context-sage/Context%20Sage%20-%20Project%20Index.md)
