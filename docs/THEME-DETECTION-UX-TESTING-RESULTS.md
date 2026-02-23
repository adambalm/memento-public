# Theme Detection UX Testing — Team Deliberation Results

**Date:** 2026-02-18
**Method:** 3-agent team (ed-proxy, ux-expert, team-lead) testing theme-based intent detection
**Data:** 15 synthetic corrections written to `memory/intentions.json` under `themeFeedback` key, all tagged `[ED-PROXY-SYNTHETIC]`

---

## Core Diagnosis (Both Agents Converge)

The system detects patterns but provides no resolution mechanism. Detection without resolution is just another dashboard to look at.

**Ed-proxy verdict:** "The system inventories tabs by keyword co-occurrence when it should be mapping intellectual threads by semantic connection — and it cannot yet distinguish between 'things Ed is thinking about' and 'things Ed has to do for work.'"

**UX-expert verdict:** "The actions are metacognitive labor disguised as value. They ask the user to do work for the system (training it), not work for themselves (closing the tab-hoarding loop)."

---

## Key Findings

### 1. Wrong Actions (UX Expert)

Current: Confirm / Correct / Dismiss — these train the system but produce no artifact.

Proposed: **Save as Note / Open All Tabs / Archive / Keep Watching / Rename** — every action either produces an artifact, enables resumption, or closes the loop.

### 2. Keyword Clustering ≠ Intellectual Thread Detection (Ed-Proxy)

Pierre Menard (Wikipedia) + Emily Dickinson (Poetry Foundation) + Rise and Fall of the Author (varnelis.net) + psychometric evaluation of LLMs (Nature) = **PREY/Null Provenance**. These tabs share ZERO keywords but form Ed's deepest intellectual thread. Only semantic understanding or user-declared thread seeds can surface this.

### 3. No Work/Inquiry Distinction (Ed-Proxy)

Cognia accreditation spreadsheets ≠ arxiv papers on agent evaluation. The system treats operational work (Gradelink admin, Google Workspace, deployment) identically to intellectual pursuits. Needs activity type taxonomy.

### 4. Basic Memory Connections Are Display-Only (UX Expert)

5 of 10 themes have BM connections but the system only shows a badge. Should enable: one-click save as BM note cross-linked to existing notes.

### 5. Keyword Matching Too Loose (Ed-Proxy)

5 of 15 themes match "Agent Engineering" as top BM connection. When everything matches, nothing is distinguished.

### 6. Data Quality Issues (Ed-Proxy)
- Test fixtures from Memento's own test suite contaminate real data
- Google Search tabs are navigational noise, not intellectual signals
- Same content across domains (edoconnell.org, vercel, github.io, localhost) = duplicate inflation
- NotebookLM appears as both tool-being-used and topic-being-studied

---

## Proposed Resolution Model

A theme is "done" when ONE of these happens:
1. **Saved** — BM note created. Tabs become disposable.
2. **Archived** — User declares "I'm done with this."
3. **Opened** — Tabs reopened for active work.

"Keep watching" = explicit deferral, not resolution. 30+ days deferred should escalate.

---

## Priority Implementation Order

1. "Save to Basic Memory" as primary action (closes the original tab-hoarding loop)
2. Resolution actions replace validation actions
3. LLM-generated human-readable labels (not keyword salad)
4. Activity type taxonomy (work vs. research vs. creative project)
5. Declared themes as clustering seeds (use Ed's corrections)
6. Data quality: deduplication, test fixture filter, search tab filter

---

## The Different Questions the UI Should Ask

Instead of "What keywords recur?" the system should ask:

1. **"What threads connect across domains?"** — Pierre Menard + Emily Dickinson + authorship theory share zero keywords but form one thread. Needs semantic or user-seeded clustering.

2. **"Is this work or inquiry?"** — Cognia spreadsheets are obligations. arxiv papers are intellectual fuel.

3. **"Is this a tool being used or a topic being studied?"** — NotebookLM in Cognia cluster = tool. NotebookLM in research cluster = topic.

4. **"What's the user's OWN project?"** — Tabs related to building/deploying memento/sca-website/portfolio should link to the project, not cluster by keyword.

5. **"What has the user already told me?"** — Declared threads from corrections should seed future clustering.
