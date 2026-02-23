# Memento — Project Explainer

*Local attention analysis using LLM classification pipelines on self-collected browsing data. An open-source experiment.*

*February 2026 — v2.0.0*

---

## Premise

For twenty years, corporations have run classification pipelines, longitudinal pattern detection, and intent inference on your browsing data. They cluster your visits, detect your purchase intent, build attention profiles across sessions, and sell the output. The analytical techniques are well-understood. The constraint was always access to the data and the cost of running inference.

Local LLMs remove the cost constraint. Browser extensions provide the data access. Memento tests whether these corporate analytical techniques, applied to data you collect about yourself, produce intelligence you can actually use.

The test domain is browser sessions. A Chrome extension captures your open tabs. A four-pass LLM pipeline classifies them, maps cross-category connections, and generates a structured session artifact. A longitudinal layer tracks patterns across sessions. A correction system feeds your disagreements back into future classification.

Whether these techniques transfer to other self-collected behavioral data — git commit patterns, communication logs, reading history — is an open question that motivated the architecture. The pipeline is designed to be domain-agnostic. Browser tabs are the first test case, not the point.

## The Classification Pipeline

When Memento sends 31 browser tabs to an LLM for classification, the LLM classifies 8 and stops. This was the first finding of the project: LLMs are trained to synthesize and compress, not to enumerate exhaustively. Claude Haiku, Qwen 2.5, Llama 3.2 — every model exhibited the same behavior. Coverage ranged from 0% to 26% on sessions with more than 10 tabs.

The fix required working against the model's summarization instinct. The output schema was simplified from nested JSON objects to a flat index-to-category map. The prompt was rewritten to demand explicit enumeration: "The assignments object MUST have EXACTLY N entries. DO NOT skip any tabs. DO NOT summarize." Token limits were raised from 2,000 to 8,000. A parser-level recovery step detects missing tab indices and assigns them to an Unclassified category. After these changes, coverage reached 95%+.

The current pipeline runs four passes:

**Pass 1 — Classification + Triage.** Each tab gets assigned to a category with explicit evidence ("signals") and a confidence level. Tabs flagged for deeper analysis go to Pass 2. The session gets a narrative summary and an intent hypothesis. Ambiguous classifications are listed as uncertainties for human review.

**Pass 2 — Deep Dive.** Tabs flagged in Pass 1 (typically technical documents, research papers, API docs) get individual analysis: summary, key entities, and a relevance assessment. This pass is conditional. Sessions with no flagged tabs skip it.

**Pass 3 — Visualization.** Generates a Mermaid diagram representing the session's structure. Categories become subgraphs. Cross-category connections surface as dotted edges.

**Pass 4 — Thematic Analysis.** Conditional on active projects existing in context.json. Maps tabs to declared projects, identifies cross-category connections that keyword matching would miss (a "Research" tab about authorship theory supporting a "Creative Writing" project), and proposes concrete 30-minute tasks. Generates an alternative narrative reframing the session through a thematic rather than categorical lens.

Every pass captures a full trace: the prompt sent to the LLM, the raw response, parsing decisions, and timing data. These traces persist in the session artifact and can be inspected, edited, and re-run through a workbench interface at `/workbench/:sessionId`. A developer can modify a classification prompt and see new output without re-running the full pipeline.

Cost per session with Claude Haiku: approximately $0.006. With local Ollama models: zero, but 3-4x slower.

## What Cross-Session Analysis Surfaces

Single sessions are mildly interesting. You see your tabs organized and narrated, which is useful in the moment but not much more than a tidy bookmark list. The value that surprised was in cross-session patterns.

### Ghost Tabs

Tabs that appear in multiple sessions but never receive a disposition (never marked complete, never deliberately closed). After 188 captured sessions, Memento identified tabs that appeared in 40+ sessions across months. The Google Cloud blog post on agent evaluation frameworks appeared in 43 sessions, always co-occurring with Memento development tabs. The system inferred the candidate intention: "learn agent evaluation by applying it to Memento." The user confirmed this was accurate — and had not articulated it to himself before.

### Project Health Decay

By tracking which project-associated tabs appear across sessions and when they stop appearing, the system detects project neglect. A project with tabs appearing in 12 sessions over two weeks, then zero sessions for 30 days, gets flagged as abandoned. The signal is absence, not activity.

### Distraction Signatures

Time-of-day and day-of-week patterns in non-work browsing. The system can surface patterns like repeated YouTube sessions at 4am on Wednesdays. These patterns are invisible in any single session and only emerge from longitudinal aggregation.

### Protected Category Semantics

An early classification error: chase.com was always categorized as "Financial." But reading a credit card rewards article on chase.com is Research. Managing your account balance on chase.com is a Transaction that should be protected from accidental closure. The system now distinguishes by URL path patterns and content keywords. The category "Transaction (Protected)" means "you have an active session with state you could lose," not "this website involves money."

## What Didn't Work

Three significant approaches were tried and either abandoned or remain partially solved. Each produced findings worth preserving.

### Tab-Level Intent Detection

The first attempt at intent detection worked per-tab: "you opened this URL, therefore you intend X." Users (tested via 3-agent proxy deliberation) rejected per-tab proposals as too shallow. Opening a Wikipedia article about Pierre Menard doesn't mean you intend to learn about Pierre Menard. It means you're working on something that Pierre Menard is one data point within. The intent lives at the thread level, not the tab level. This led to theme detection as a replacement approach.

### Keyword-Based Theme Clustering

Theme detection groups tabs that recur together across sessions. The current implementation uses keyword co-occurrence: tabs that share terms get clustered. This works for surface-level groupings (all your React docs cluster together) but fails on the cases that matter most.

A concrete failure: tabs open during one session included a Wikipedia article on Pierre Menard, a Poetry Foundation page on Emily Dickinson, an essay on the death of the author from varnelis.net, and a Nature paper on psychometric evaluation of LLMs. These share zero keywords. They are the same intellectual thread. Keyword clustering cannot find it. Semantic embedding or user-declared thread seeds might, but neither is implemented.

A second problem: when 5 of 10 detected themes all match "Agent Engineering" as their top Basic Memory connection, the matching is too loose to be informative. Everything matching is the same as nothing matching.

### Detection Without Resolution

The UX testing produced a diagnosis that applies beyond Memento: detection without a resolution mechanism is just another dashboard to look at. The initial theme detection UI offered Confirm / Correct / Dismiss actions. These train the system but produce nothing for the user. The 3-agent test concluded that every action should either produce an artifact (save as a note), enable resumption (reopen the tabs), or close the loop (archive the thread). Training the classifier is a side effect, not a primary action.

This remains unresolved. The resolution actions (Save to Basic Memory, Open All Tabs, Archive, Keep Watching) have been specified but not built.

## The Feedback Loop

When the classifier assigns a tab to the wrong category, you can correct it. The correction is stored. The correction analyzer examines accumulated corrections for patterns: if you've corrected "stackoverflow.com/questions about Python" from Research to Development three times, the system extracts a rule and injects it into future classification prompts.

The pipeline: user correction → pattern detection → rule suggestion → learned rule file (JSON) → prompt injection on subsequent classifications. The rules accumulate in `backend/prompts/learned-rules.json` and are loaded into the classification prompt at Pass 1.

The architecture is the interesting part. Each correction is a human label on a machine prediction. Confirm = true positive. Correct = false positive with ground truth provided. Dismiss = false positive. Over time, this dataset enables measuring whether classification accuracy improves. Precision and recall can be computed from the correction log without a separate evaluation harness.

Honest status: the pipeline exists and functions. It has not accumulated enough corrections to evaluate whether classification actually improves over time. The 188 captured sessions have produced a small number of corrections, concentrated in domain-ambiguity cases (stackoverflow as Development vs. Research, YouTube as Entertainment vs. Learning). Whether the learned rules generalize or overfit to specific URL patterns is unknown.

The intent detection spec extends this pattern. If the system proposes an intention ("you keep opening this tab because you want to learn agent evaluation") and the user confirms, corrects, or dismisses the proposal, that's the same feedback structure applied at a higher level of abstraction. Confirm/correct/dismiss on intents rather than categories.

## The Commitment Device

Launchpad mode locks new session captures until you resolve every tab in the current session. Each tab requires a disposition: complete, trash, defer, promote, regroup. Financial and transactional tabs cannot be trashed. A 10-second undo window follows each action. The session unlock happens only when every item has a disposition.

The design draws from Ariely and Wertenbroch's work on commitment devices: voluntary constraints that create immediate consequences for present-biased behavior. You choose to enter Launchpad mode. Once in, the lock creates a cost for not resolving your session. The hypothesis: forced confrontation with your open tabs produces better attention hygiene than voluntary review.

The data does not support the hypothesis yet. Across 188 captured sessions, the disposition count is zero. Launchpad mode has been used for testing but not adopted as a regular workflow. Several interpretations are possible: the friction is too high for a single developer using the tool (no external accountability). The all-or-nothing lock is too coarse — a Review Mode was added later (view and resolve without locking, progress saves) but usage data on it is thin. The per-tab resolution granularity may be wrong; resolving 30 individual tabs is tedious in a way that resolving 5 themes would not be.

The commitment device concept may be sound while the UX is wrong. Or the concept may not transfer from its origin contexts (savings accounts, gym memberships) to browser session management. The experiment hasn't run long enough to distinguish these possibilities.

## Open Questions

These are unresolved and would benefit from outside input.

### Session-Level vs. Intention-Level Organization

The current UI organizes around captured sessions: each capture is a timestamped artifact containing classified tabs. The intent detection spec proposes reorganizing around inferred intentions: recurring unresolved items, sorted by signal strength, with the session history demoted to a data layer underneath. These are different products. The session view is an archive. The intention view is a to-do list generated from behavioral patterns. Which one the project should be is unclear.

### Keyword Clustering vs. Semantic Thread Detection

The Pierre Menard / Dickinson / LLM psychometrics problem. Tabs that form a coherent intellectual thread but share no surface-level terms. Possible approaches: embedding-based similarity (expensive to run locally), user-declared thread seeds that anchor future clustering, or Basic Memory connections as a bridge (tabs linking to the same KB note are likely related regardless of keywords). None are implemented.

### Discoverability of the Codebase Itself

At 20,600 lines across 57 files, the project contains capabilities its builder has forgotten exist. The prompt workbench — full trace capture, inline inspection, re-run from the browser — was documented only after its existence came into question during a session. The dev intent panel, designed to let AI and human negotiate UI purpose through the interface itself, has no documentation outside a session transcript. Whether a project built through iterative AI collaboration can maintain self-knowledge without conventional engineering discipline (ADRs, sprint reviews, changelogs) is an open question this project is inadvertently testing.

### Generalization Beyond Browsing

The four-pass classification pipeline, the correction-to-learning loop, and the longitudinal pattern detection are not browser-specific in their architecture. They operate on timestamped collections of items with metadata. Git commits, email threads, file system snapshots, and reading logs all fit the same shape. Whether the specific prompt engineering and schema design transfer, or whether each new domain requires equivalent iteration, determines whether Memento is a tool or a case study.

## Technical Profile

| Metric | Value |
|--------|-------|
| Lines of code | ~20,600 |
| Backend files | 43 |
| Renderer files | 14 |
| MCP tools | 18 |
| Schema version | v1.3.0 |
| Captured sessions | 188+ |
| Cost/session (Haiku) | ~$0.006 |
| Cost/session (Ollama) | $0.00 |

**Stack:** Node.js, Express, Chrome Manifest V3, Anthropic Claude 3.5 Haiku, Ollama (Qwen 2.5 Coder, Llama 3.2), RTX 5060 Ti 16GB, Tailscale, MCP protocol, Basic Memory (Obsidian-backed), JSON session artifacts on disk.

**Source:** [github.com/adambalm/memento](https://github.com/adambalm/memento)

---

*Built by Ed O'Connell. Developed iteratively with Claude (Anthropic) across 100+ collaboration sessions. Previous explainer version: v1.0.0, 2026-01-05.*
