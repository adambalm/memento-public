# Memento Design Principles

## Core Principle: Attention UI + Agent Launcher

Memento is not a dashboard. It is not a mirror. It is not a therapist.

Memento surfaces attention patterns **and offers agents to act on them**.

The insight is the trigger. The agent is the value.

---

## The Problem with "Insights"

Traditional analytics tools show you what happened:
- "You spent 4 hours on YouTube"
- "You opened this paper 48 times"
- "You have 200 tabs open"

This is useless. You already feel bad about it. Showing you the data doesn't change behavior. It just adds guilt to paralysis.

---

## The Shift: From Observation to Agency

Every pattern Memento surfaces should come with an agent that resolves the underlying need.

| Pattern | Bad Response | Good Response |
|---------|--------------|---------------|
| Resume opened 48x | "You keep opening this. Finish it or let go." | "You're job hunting. Want me to find 5 jobs you can apply to right now?" |
| arxiv paper opened 48x | "This is a ghost tab." | "Want me to summarize this so you can decide if it's worth reading?" |
| Project untouched 12 days | "PREY is neglected." | "Want me to draft your next commit message?" |
| 200 tabs open 7+ days | "You have tab debt." | "I picked 5 worth keeping. Close the rest?" |
| Recipe opened 12x | "You keep looking at this." | "Want me to add these ingredients to your shopping list?" |
| Bank statement checked daily | "You're anxious about money." | "Want me to set up an alert so you don't have to keep checking?" |

The left column describes. The right column acts.

---

## Implications for Architecture

### 1. Classification Must Be Semantic, Not Categorical

Knowing a tab is "Research" is not enough. The system must understand:
- **What kind of document is this?** (resume, paper, recipe, statement)
- **What behavior does the pattern suggest?** (job search, procrastination, meal planning, financial anxiety)
- **What underlying need does this reveal?** (employment, knowledge, food, security)

The same behavioral pattern (48 opens) means completely different things depending on document type.

### 2. Actions Are Agent Invocations, Not Dispositions

Current model:
```
[ Read it now ] [ Let it go ] [ Come back later ]
```

These are dispositions - ways to categorize your relationship to the item. They change metadata, not reality.

New model:
```
[ Find matching jobs ] [ Update my resume ] [ Check back next week ]
```

These are agent actions - they do something in the world on your behalf.

### 3. The Task Picker Is an Agent Launchpad

The "One Thing" interface should not ask "what do you want to do with this tab?"

It should ask "what do you need, and can I help you get it?"

The task picker becomes a dispatch center for agents that:
- Search for jobs
- Summarize documents
- Draft content
- Make purchases
- Set up automations
- Block distractions
- Schedule reminders

### 4. Insights Without Actions Are Failures

If the system surfaces a pattern but can't offer an agent to act on it, that's a design failure. Either:
- We shouldn't surface that pattern yet, or
- We need to build the agent that resolves it

"Here's an uncomfortable truth about your behavior, good luck" is not a product.

---

## The Competitive Insight

Google has your attention data. They use it to sell you to advertisers.

Memento uses your attention data to act on your behalf.

The data is the same. The agency is inverted.

---

## What This Means for Development

### Short-term
- Task actions should invoke capabilities, not just log dispositions
- "Let it go" should close the loop (blocklist), not just record a feeling
- "Engage" should do the next step, not just open a URL

### Medium-term
- Build agent capabilities: job search, document summarization, shopping list generation
- Connect to external services: job boards, calendars, todo apps, shopping APIs
- Let users define their own agent responses to patterns

### Long-term
- Memento becomes the orchestration layer between attention patterns and life management
- The browser is the sensor, the agents are the actuators
- Your attention patterns become inputs to systems that handle your life

---

## Summary

**Don't show people their problems. Solve them.**

The insight tells you what someone needs. The agent gets it for them.

Attention UI + Agent Launcher. That's the product.
