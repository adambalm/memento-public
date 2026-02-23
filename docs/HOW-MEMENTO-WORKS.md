# How Memento Works (Simple Guide)

## What Is Memento?

Memento is a tool that looks at all your browser tabs and helps you make sense of them. It's like having someone organize your messy desk and ask "do you actually need all this stuff?"

---

## The Three Ways To Use Memento

### 1. Results Mode (Just Looking)
**What it does:** Takes a snapshot of your tabs, organizes them by category, and shows you patterns.

**How to use it:**
1. Click the Memento extension icon in Chrome
2. Click "Capture Session"
3. A new page opens showing your tabs organized

**What you see:**
- Your tabs grouped into categories (Research, Development, Shopping, etc.)
- A story about what you seem to be doing
- A diagram showing how things connect
- Suggestions for what to do next

**You can't change anything here - it's just for looking.**

---

### 2. Launchpad Mode (Taking Action)
**What it does:** Forces you to decide what to do with every single tab. You can't capture more tabs until you're done.

**How to use it:**
1. Click the Memento extension icon
2. Click "Capture → Launchpad"
3. A page opens with all your tabs listed

**For each tab, you pick one:**
| Button | What it means |
|--------|--------------|
| 🗑️ **Trash** | "I don't need this" |
| ⏰ **Later** | "Not now, but save it" |
| ✅ **Done** | "I finished this" |
| 📤 **Promote** | "This is important, save it somewhere special" |

**When you've decided on every tab:**
- Click "Complete Session"
- Now you can capture more tabs again

---

### 3. Tasks Mode (One Thing)
**What it does:** Looks at ALL your past sessions and finds the ONE thing you should focus on right now.

**How to use it:**
1. Go to `http://localhost:3000/tasks`
2. See one task with a question like "You've opened this 48 times. Are you ever going to finish it?"

**You pick one:**
| Button | What it means |
|--------|--------------|
| ⚡ **Do it now** | "I'll handle this right now" |
| 🌊 **Let it go** | "I'm giving up on this" |
| ⏰ **Come back later** | "Not today" |

---

## All The Pages

| Page | URL | What's There |
|------|-----|--------------|
| **Summary** | `/results/SESSION-ID` | Overview of one capture |
| **Map** | `/results/SESSION-ID/map` | Diagram of how tabs connect |
| **Tabs List** | `/results/SESSION-ID/tabs` | All tabs in a list |
| **Analysis** | `/results/SESSION-ID/analysis` | The AI's thinking process |
| **Launchpad** | `/launchpad/SESSION-ID` | Action mode - decide on each tab |
| **Review** | `/review/SESSION-ID` | Like Launchpad but no lock |
| **Tasks** | `/tasks` | "One thing" you should do now |
| **History** | `/history` | Browse all past sessions |

---

## The Lock System

When you use **Launchpad Mode**, Memento "locks" your session. This means:
- You MUST finish deciding on all tabs
- You CAN'T capture new tabs until you're done
- This forces you to actually deal with your tab mess

**If you're stuck:** There's an emergency "Force Clear Lock" button at the bottom of Launchpad.

---

## What Happens To Your Data

Everything gets saved to files:
- **Sessions** → `memory/sessions/DATE-TIME.json`
- **Task log** → `~/.memento/task-log.json`
- **Lock status** → `~/.memento/lock.json`
- **Your projects** → `~/.memento/context.json`

Nothing goes to the cloud. It all stays on your computer.

---

## Quick Start

### Just want to see what's in your tabs?
```
1. Click extension → "Capture Session"
2. Browse the results
```

### Want to clean up your tabs?
```
1. Click extension → "Capture → Launchpad"
2. Go through each tab: Trash / Later / Done
3. Click "Complete Session" when finished
```

### Want to know what you should focus on?
```
1. Go to http://localhost:3000/tasks
2. See the one thing Memento thinks you should do
3. Take action or skip it
```

### Want to see your history?
```
1. Go to http://localhost:3000/history
2. Click on any past session to review it
```

---

## Common Questions

**Q: Why can't I capture new tabs?**
A: You're in Launchpad mode and haven't finished. Go to the Launchpad page and complete your session, or force-clear the lock.

**Q: What's the difference between Results and Launchpad?**
A: Results = just looking. Launchpad = taking action and being forced to decide.

**Q: Where do "Promoted" items go?**
A: Right now, nowhere special - it just records that you promoted it. Future feature will create notes/bookmarks.

**Q: What does the AI actually do?**
A: It reads your tab titles and URLs, groups them into categories, and writes a summary of what you seem to be working on.

**Q: Can I undo something?**
A: Yes! After you trash/complete/promote something, an "Undo" button appears for 10 seconds.

---

## The Buttons Cheat Sheet

### In Launchpad:
| Button | Keyboard | What Happens |
|--------|----------|--------------|
| Trash | - | Tab marked as "don't need" |
| Later | - | Tab moved to "Later" pile |
| Done | - | Tab marked as "finished" |
| Promote | - | Tab marked as "important" |
| Undo | - | Reverses last action |
| Complete Session | - | Clears lock, you're done |

### In Tasks:
| Button | What Happens |
|--------|--------------|
| First action button | Records "engage" + opens URL |
| Second action button | Records "release" (let go) |
| "Show me something else" | Skips this task |

### In Results:
All buttons just navigate to other pages. No actions are recorded.

---

## System Status

To check if everything is working:
- **Server running?** → `http://localhost:3000/history` should load
- **Lock status?** → `http://localhost:3000/api/lock-status`
- **Task stats?** → `http://localhost:3000/api/tasks/stats`

---

## Summary

1. **Capture** your tabs using the Chrome extension
2. **Choose** Results (just look) or Launchpad (take action)
3. **Browse** your organized tabs and insights
4. **Decide** what to do with each tab (in Launchpad)
5. **Review** past sessions in History
6. **Focus** on one thing using the Tasks page
