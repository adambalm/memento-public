# Task Picker UX Remediation Plan

## Executive Summary

**Problem:** Users click buttons and nothing visibly happens. The page eventually changes but there's no feedback, no confirmation, and no sense of progress.

**Evidence:**
- Playwright test: 11 seconds between click and redirect, zero visual feedback
- Button state: `disabled=null` before AND after click
- Screenshot comparison: Identical UI during entire wait period
- `renderCompletionPage()` exists but is never called (dead code)

---

## Issues Found

### CRITICAL: No Click Feedback

| What happens | What should happen |
|--------------|-------------------|
| User clicks button | Button should immediately show "clicked" state |
| Nothing visible for 10+ seconds | Spinner or "Processing..." should appear |
| Page suddenly changes | Smooth transition with confirmation |
| New task appears (confusing) | "Done!" message THEN new task |

**Screenshot proof:** `tasks-03-clicked.png` is identical to `tasks-01-initial.png`

### CRITICAL: Dead Code - Completion Page Never Shown

```javascript
// This function EXISTS in taskPickerRenderer.js (lines 639-688)
// But is NEVER CALLED
function renderCompletionPage(action, nextTask = null) {
  const messages = {
    engage: { icon: '⚡', title: 'On it!', message: 'Good. Now do the thing.' },
    release: { icon: '🌊', title: 'Let go', message: 'That open loop is closed.' },
    // ... beautiful feedback that users never see
  };
}
```

### HIGH: HTML Entity Escaping Bug

The insight text shows `They&#39;re` instead of `They're`

**Location:** `taskPickerRenderer.js` line 476 - `formatInsight()` double-escapes

### HIGH: Skip = Permanent Action (Semantic Mismatch)

- User thinks "skip" = "show me another" (browsing action)
- System treats "skip" = permanent log entry
- Result: Task log fills with meaningless "skip" actions

### MEDIUM: No Destructive Action Confirmation

"Declare bankruptcy" (🔥) wipes 213 tabs with ONE CLICK. No confirmation.

---

## Remediation Plan

### Phase 1: Immediate Feedback (CRITICAL)

**File:** `backend/renderers/taskPickerRenderer.js`

#### 1.1 Add loading state to buttons

```javascript
// BEFORE (current)
async function recordAction(taskId, action) {
  try {
    const response = await fetch('/api/tasks/' + taskId + '/action', { ... });
    // NO FEEDBACK HERE
    if (result.success) {
      window.location.href = '/tasks?completed=' + action;
    }
  }
}

// AFTER (fixed)
async function recordAction(taskId, action) {
  // Immediately show feedback
  const clickedBtn = event.target.closest('.action-btn');
  if (clickedBtn) {
    clickedBtn.disabled = true;
    clickedBtn.classList.add('loading');
    clickedBtn.innerHTML = '<span class="spinner"></span> Recording...';
  }

  try {
    const response = await fetch('/api/tasks/' + taskId + '/action', { ... });

    if (result.success) {
      // Show completion feedback BEFORE redirect
      showCompletionToast(action);
      await delay(1500);
      window.location.href = '/tasks?completed=' + action;
    }
  } catch (error) {
    // Restore button on error
    if (clickedBtn) {
      clickedBtn.disabled = false;
      clickedBtn.classList.remove('loading');
      // Restore original content
    }
    showErrorToast(error.message);
  }
}
```

#### 1.2 Add CSS for loading state

```css
.action-btn.loading {
  opacity: 0.7;
  pointer-events: none;
}

.action-btn .spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

#### 1.3 Add toast notification component

```javascript
function showCompletionToast(action) {
  const messages = {
    engage: { icon: '⚡', text: 'On it!' },
    release: { icon: '🌊', text: 'Let go' },
    defer: { icon: '⏰', text: 'Saved for later' },
    skip: { icon: '➡️', text: 'Skipping...' },
    triage: { icon: '🎯', text: 'Triaging...' },
    detailed: { icon: '📋', text: 'Opening review...' },
    release_all: { icon: '🔥', text: 'Cleared!' }
  };

  const msg = messages[action] || { icon: '✓', text: 'Done' };

  const toast = document.createElement('div');
  toast.className = 'completion-toast';
  toast.innerHTML = `<span class="toast-icon">${msg.icon}</span> ${msg.text}`;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('visible'));
}
```

```css
.completion-toast {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background: rgba(74, 222, 128, 0.95);
  color: #000;
  padding: 1em 2em;
  border-radius: 12px;
  font-size: 1.5em;
  font-weight: 500;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
}

.completion-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-icon {
  font-size: 1.3em;
  margin-right: 0.3em;
}
```

---

### Phase 2: Wire Up Completion Page (HIGH)

**File:** `backend/server.js`

Change the `/tasks` route to use the completion page:

```javascript
// BEFORE (current - line 381-410)
app.get('/tasks', async (req, res) => {
  const { completed } = req.query;
  if (completed) {
    console.error(`[Tasks] Action completed: ${completed}`);  // Just logs!
  }
  // ... renders next task immediately
});

// AFTER (fixed)
app.get('/tasks', async (req, res) => {
  const { completed } = req.query;

  // If just completed an action, show feedback page
  if (completed) {
    const topTask = await getTopTask();
    const stats = await getAttentionStats();
    let enrichedTask = null;

    if (topTask) {
      enrichedTask = await enrichTopTask(topTask);
    }

    // Show completion page with next task embedded
    res.send(renderCompletionPage(completed, enrichedTask, stats));
    return;
  }

  // Normal flow - show task picker
  const topTask = await getTopTask();
  // ... rest of existing code
});
```

**Update `renderCompletionPage` signature:**

```javascript
function renderCompletionPage(action, nextTask = null, stats = {}) {
  // ... existing code, but add auto-redirect after 2 seconds
  // OR show "Continue" button to manually advance
}
```

---

### Phase 3: Fix Escaping Bug (HIGH)

**File:** `backend/renderers/taskPickerRenderer.js`

```javascript
// BEFORE (line 476)
function formatInsight(insight) {
  if (!insight) return '';
  let formatted = escapeHtml(insight)  // Already escaped by LLM response
    .replace(/(\d+)/g, '<strong>$1</strong>');
  return formatted;
}

// AFTER
function formatInsight(insight) {
  if (!insight) return '';
  // Don't double-escape - insight comes from JSON which is already safe
  // Just add emphasis to numbers
  let formatted = insight
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\d+)/g, '<strong>$1</strong>');
  return formatted;
}
```

---

### Phase 4: Separate Skip from Actions (MEDIUM)

**Current problem:** Skip creates a permanent task log entry

**Option A: Don't log skips**
```javascript
// Skip just fetches next task without recording
function skipTask() {
  window.location.href = '/tasks?skip=true';  // No action recorded
}
```

**Option B: Make skip visually different**
```html
<div class="skip-section">
  <span class="skip-hint">Not this one?</span>
  <button class="skip-link" onclick="skipTask()">
    Show me something else
  </button>
  <span class="skip-note">(won't be recorded)</span>
</div>
```

**Recommendation:** Option A - skips shouldn't pollute the task log

---

### Phase 5: Confirm Destructive Actions (MEDIUM)

**File:** `backend/renderers/taskPickerRenderer.js`

Add confirmation modal for dangerous actions:

```javascript
function recordAction(taskId, action) {
  // Check if destructive
  const destructiveActions = ['release', 'release_all', 'triage'];
  if (destructiveActions.includes(action)) {
    if (!confirmDestructive(action)) {
      return;  // User cancelled
    }
  }

  // ... rest of existing code
}

function confirmDestructive(action) {
  const messages = {
    release: 'Let this go? This will be recorded.',
    release_all: 'Declare bankruptcy? This clears all items.',
    triage: 'Keep 5 and release the rest?'
  };

  return confirm(messages[action] || 'Are you sure?');
}
```

**Better UX:** Use a custom modal instead of `confirm()`:

```html
<div id="confirm-modal" class="modal hidden">
  <div class="modal-content">
    <p id="confirm-message"></p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="cancelAction()">Cancel</button>
      <button class="btn-confirm" onclick="proceedAction()">Yes, do it</button>
    </div>
  </div>
</div>
```

---

### Phase 6: Add Tooltips (LOW)

**File:** `backend/renderers/taskPickerRenderer.js`

In `renderActions()`, add title attributes:

```javascript
function renderActions(actions, taskId) {
  const tooltips = {
    engage: 'Open this and mark as handled',
    release: 'Let this go - closes the open loop',
    defer: 'Save for later - will remind you',
    triage: 'Keep the most important, release the rest',
    detailed: 'Review each item one by one',
    release_all: 'Clear everything and start fresh'
  };

  return actions.map((action, i) => {
    const tooltip = tooltips[action.type] || '';
    return `
      <button class="action-btn ${...}"
              title="${escapeHtml(tooltip)}"
              onclick="...">
        ...
      </button>
    `;
  }).join('');
}
```

---

## Implementation Priority

| Priority | Task | File | Effort |
|----------|------|------|--------|
| 🔴 P0 | Add button loading state | taskPickerRenderer.js | 30 min |
| 🔴 P0 | Add completion toast | taskPickerRenderer.js | 30 min |
| 🟠 P1 | Wire up renderCompletionPage | server.js | 20 min |
| 🟠 P1 | Fix HTML entity escaping | taskPickerRenderer.js | 10 min |
| 🟡 P2 | Separate skip from actions | taskPickerRenderer.js | 20 min |
| 🟡 P2 | Add destructive confirmations | taskPickerRenderer.js | 30 min |
| 🟢 P3 | Add tooltips | taskPickerRenderer.js | 15 min |

**Total estimated effort:** ~2.5 hours

---

## Success Criteria

After implementation, Playwright test should show:

1. ✅ Button disabled immediately on click
2. ✅ Spinner visible during network request
3. ✅ Toast appears saying "On it!" / "Let go" etc.
4. ✅ Completion page shows before next task
5. ✅ No HTML entities in insight text
6. ✅ Skip doesn't create task log entry
7. ✅ "Declare bankruptcy" requires confirmation

---

## Testing Checklist

```bash
# After implementing fixes, run:
cd $SKILL_DIR && node run.js /tmp/playwright-test-tasks.js

# Should show:
# - Pre-click: disabled=null
# - Post-click (100ms): disabled=true, class contains "loading"
# - Toast visible in screenshot
# - Completion page in screenshot before next task
```

---

## Files To Modify

| File | Changes |
|------|---------|
| `backend/renderers/taskPickerRenderer.js` | Add loading state, toast, fix escaping, add tooltips |
| `backend/server.js` | Wire up completion page route |

No new files needed - all fixes are to existing code.
