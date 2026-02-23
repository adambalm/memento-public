/**
 * Task Enricher Module
 *
 * Uses LLM to enrich raw task candidates with:
 * - Confrontational insight ("You've opened this 48 times...")
 * - Why This Matters (connecting to user goals)
 * - The Question (derived goal framed as a question)
 * - Context-appropriate actions (not generic)
 * - Conversation prompts for exploration
 *
 * @see ../docs/plans/task-driven-attention.md for design context
 */

const { runModel, getEngineInfo } = require('./models');
const { loadContext } = require('./contextLoader');

const DEFAULT_ENGINE = 'ollama-local';

/**
 * Strip ANSI escape codes from text
 */
function stripAnsiCodes(text) {
  if (!text) return text;
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Build the enrichment prompt for a ghost tab task
 */
function buildGhostTabPrompt(task, userContext) {
  const contextStr = userContext?.activeProjects?.length > 0
    ? userContext.activeProjects.map(p => `- ${p.name}${p.keywords?.length ? ` (${p.keywords.join(', ')})` : ''}`).join('\n')
    : 'No active projects defined';

  return `You are analyzing a user's attention pattern to help them make a decision.

BEHAVIORAL DATA:
- Item: "${task.title}" (${task.url})
- Domain: ${task.domain}
- Category: ${task.categories?.join(', ') || 'Unknown'}
- Opened ${task.openCount} times since ${task.firstSeen}
- Last seen: ${task.lastSeen}
- Average gap between visits: ${task.gapPattern?.avgDaysBetween || 'unknown'} days

USER'S ACTIVE PROJECTS:
${contextStr}

TASK:
1. Write a confrontational insight (1 sentence, direct, specific to this item)
2. Explain WHY THIS MATTERS - connect to their goals (2-3 sentences)
3. Frame THE QUESTION they need to answer (1 sentence)
4. Generate 2-3 context-appropriate actions (not generic - specific to this situation)
5. Suggest 2-3 conversation prompts if they want to explore

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "insight": "You've opened this 48 times. You've never finished it.",
  "whyThisMatters": "This paper keeps appearing alongside your PREY novel tabs...",
  "theQuestion": "Is this serving your creative work, or replacing it?",
  "actions": [
    {"label": "Read the abstract now", "type": "engage", "icon": "📖"},
    {"label": "Let this one go", "type": "release", "icon": "🌊"},
    {"label": "Add to reading list", "type": "defer", "icon": "📋"}
  ],
  "conversationPrompts": [
    "Why do I keep coming back to this?",
    "Is this actually useful for my work?",
    "What would happen if I just let it go?"
  ]
}

RULES:
- Be DIRECT and CONFRONTATIONAL, not gentle
- The insight should provoke reflection, not just describe data
- Connect to their stated goals/projects when possible
- Actions should be specific to THIS item, not generic
- If it's an arxiv paper, suggest reading the abstract
- If it's documentation, suggest bookmarking or completing the task
- If it's entertainment, challenge whether it serves them`;
}

/**
 * Build the enrichment prompt for a project revival task
 */
function buildProjectRevivalPrompt(task, userContext) {
  const contextStr = userContext?.activeProjects?.length > 0
    ? userContext.activeProjects.map(p => `- ${p.name}${p.keywords?.length ? ` (${p.keywords.join(', ')})` : ''}`).join('\n')
    : 'No active projects defined';

  return `You are analyzing a user's attention pattern to help them reconnect with a neglected project.

BEHAVIORAL DATA:
- Project: "${task.projectName}"
- Days since last activity: ${task.daysSinceActive}
- Last active: ${task.lastActive}
- First seen: ${task.firstSeen}
- Total sessions with this project: ${task.totalSessions}
- Total tabs related to project: ${task.totalTabs}
- Status: ${task.status}

USER'S ACTIVE PROJECTS:
${contextStr}

TASK:
1. Write a confrontational insight about the neglect
2. Explain WHY THIS MATTERS - what might be lost?
3. Frame THE QUESTION about whether to revive or consciously pause
4. Generate 2-3 context-appropriate actions
5. Suggest 2-3 conversation prompts

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "insight": "This project hasn't been touched in 12 days. It's starting to fade.",
  "whyThisMatters": "You spent significant time on this...",
  "theQuestion": "Do you want to keep this momentum, or consciously put it aside?",
  "actions": [
    {"label": "Work on it for 10 minutes", "type": "engage", "icon": "⚡"},
    {"label": "Put on hold until next month", "type": "pause", "icon": "⏸️"},
    {"label": "Talk about why I stopped", "type": "explore", "icon": "💬"}
  ],
  "conversationPrompts": [
    "Why did I stop working on this?",
    "What would finishing this mean?",
    "Is this still important to me?"
  ]
}

RULES:
- Be DIRECT about the neglect, not apologetic
- Acknowledge the investment they've already made
- Actions should include both revival and conscious pause options
- Don't assume they should always continue - sometimes pausing is right`;
}

/**
 * Build the enrichment prompt for a tab bankruptcy task
 */
function buildTabBankruptcyPrompt(task, userContext) {
  const sampleTitles = (task.staleTabs || [])
    .slice(0, 5)
    .map(t => `- "${t.title}"`)
    .join('\n');

  return `You are analyzing a user's attention debt to help them achieve cognitive relief.

BEHAVIORAL DATA:
- Stale tabs count: ${task.affectedCount}
- Average days stale: ${task.avgDaysStale}
- Sample of stale tabs:
${sampleTitles}

TASK:
1. Write a confrontational insight about the cognitive load
2. Explain WHY THIS MATTERS - the cost of open loops
3. Frame THE QUESTION about how to handle this debt
4. Generate 2-3 context-appropriate actions
5. Suggest 2-3 conversation prompts

RESPOND WITH ONLY THIS JSON (no markdown, no explanation):
{
  "insight": "${task.affectedCount} tabs have been waiting. They're not going anywhere.",
  "whyThisMatters": "Each open tab is a small cognitive burden...",
  "theQuestion": "Are you ready to clear this debt, or keep carrying it?",
  "actions": [
    {"label": "Keep 5, release rest", "type": "triage", "icon": "🎯"},
    {"label": "Review each one", "type": "detailed", "icon": "📋"},
    {"label": "Declare bankruptcy", "type": "release_all", "icon": "🔥"}
  ],
  "conversationPrompts": [
    "What am I afraid of losing?",
    "Which 5 really matter?",
    "What's the cost of keeping these open?"
  ]
}

RULES:
- Be DIRECT about the cognitive cost
- Acknowledge that letting go is hard but necessary
- Triage option should be the default recommendation
- Make bankruptcy feel acceptable, not shameful`;
}

/**
 * Parse LLM response into enriched task data
 */
function parseEnrichmentResponse(responseText) {
  // Clean the response
  let cleanedText = stripAnsiCodes(responseText).trim();

  // Handle markdown code blocks
  const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleanedText = jsonMatch[1].trim();
  }

  // Find JSON object boundaries
  const startIdx = cleanedText.indexOf('{');
  const endIdx = cleanedText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1) {
    cleanedText = cleanedText.slice(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(cleanedText);

  return {
    insight: parsed.insight || '',
    whyThisMatters: parsed.whyThisMatters || '',
    theQuestion: parsed.theQuestion || '',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    conversationPrompts: Array.isArray(parsed.conversationPrompts) ? parsed.conversationPrompts : []
  };
}

/**
 * Enrich a single task with LLM analysis
 *
 * @param {Object} task - Raw task from taskGenerator
 * @param {string} engine - LLM engine to use
 * @returns {Promise<Object>} Enriched task
 */
async function enrichTask(task, engine = DEFAULT_ENGINE) {
  const engineInfo = getEngineInfo(engine);
  const userContext = loadContext();

  // Build prompt based on task type
  let prompt;
  switch (task.type) {
    case 'ghost_tab':
      prompt = buildGhostTabPrompt(task, userContext);
      break;
    case 'project_revival':
      prompt = buildProjectRevivalPrompt(task, userContext);
      break;
    case 'tab_bankruptcy':
      prompt = buildTabBankruptcyPrompt(task, userContext);
      break;
    default:
      throw new Error(`Unknown task type: ${task.type}`);
  }

  console.error(`[TaskEnricher] Enriching ${task.type} task via ${engineInfo.engine}...`);
  const startTime = Date.now();

  try {
    const response = await runModel(engine, prompt);
    const duration = Date.now() - startTime;
    console.error(`[TaskEnricher] Enrichment completed in ${duration}ms`);

    const enrichment = parseEnrichmentResponse(response.text);

    return {
      ...task,
      ...enrichment,
      enrichedAt: new Date().toISOString(),
      meta: {
        engine: engineInfo.engine,
        model: engineInfo.model,
        duration
      }
    };
  } catch (error) {
    console.error(`[TaskEnricher] Enrichment failed: ${error.message}`);

    // Return task with fallback enrichment
    return {
      ...task,
      insight: getFallbackInsight(task),
      whyThisMatters: 'This pattern in your browsing suggests an open loop that may be worth addressing.',
      theQuestion: 'What do you want to do about this?',
      actions: getFallbackActions(task),
      conversationPrompts: ['Why does this keep appearing?', 'Is this still relevant?', 'What would help?'],
      enrichedAt: new Date().toISOString(),
      meta: {
        engine: 'fallback',
        model: null,
        error: error.message
      }
    };
  }
}

/**
 * Get fallback insight when LLM fails
 */
function getFallbackInsight(task) {
  switch (task.type) {
    case 'ghost_tab':
      return `You've opened this ${task.openCount} times. It keeps coming back.`;
    case 'project_revival':
      return `${task.projectName} hasn't been touched in ${task.daysSinceActive} days.`;
    case 'tab_bankruptcy':
      return `${task.affectedCount} tabs have been sitting there for over a week.`;
    default:
      return 'This pattern needs your attention.';
  }
}

/**
 * Get fallback actions when LLM fails
 */
function getFallbackActions(task) {
  switch (task.type) {
    case 'ghost_tab':
      return [
        { label: 'Deal with it now', type: 'engage', icon: '⚡' },
        { label: 'Let it go', type: 'release', icon: '🌊' },
        { label: 'Come back later', type: 'defer', icon: '⏰' }
      ];
    case 'project_revival':
      return [
        { label: 'Touch it briefly', type: 'engage', icon: '⚡' },
        { label: 'Put on hold', type: 'pause', icon: '⏸️' },
        { label: 'Think about it', type: 'explore', icon: '💭' }
      ];
    case 'tab_bankruptcy':
      return [
        { label: 'Keep 5, release rest', type: 'triage', icon: '🎯' },
        { label: 'Review each', type: 'detailed', icon: '📋' },
        { label: 'Release all', type: 'release_all', icon: '🔥' }
      ];
    default:
      return [
        { label: 'Engage', type: 'engage', icon: '⚡' },
        { label: 'Defer', type: 'defer', icon: '⏰' },
        { label: 'Release', type: 'release', icon: '🌊' }
      ];
  }
}

/**
 * Enrich the top task
 *
 * @param {Object} task - Task from getTopTask()
 * @param {string} engine - LLM engine to use
 * @returns {Promise<Object>} Enriched task
 */
async function enrichTopTask(task, engine = DEFAULT_ENGINE) {
  if (!task) return null;
  return enrichTask(task, engine);
}

/**
 * Generate a chat response for a task conversation
 *
 * @param {Object} enrichedTask - The enriched task
 * @param {string} userMessage - User's question/message
 * @param {Array} conversationHistory - Previous messages (optional)
 * @param {string} engine - LLM engine to use
 * @returns {Promise<string>} LLM response
 */
async function chatAboutTask(enrichedTask, userMessage, conversationHistory = [], engine = DEFAULT_ENGINE) {
  const userContext = loadContext();

  const contextStr = userContext?.activeProjects?.length > 0
    ? userContext.activeProjects.map(p => `- ${p.name}`).join('\n')
    : 'No active projects defined';

  // Build conversation context
  const historyStr = conversationHistory.length > 0
    ? conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')
    : '';

  const prompt = `You are helping a user understand their attention patterns. Be direct, insightful, possibly confrontational.

CONTEXT:
- Item: "${enrichedTask.title || enrichedTask.projectName || 'this pattern'}"
- Type: ${enrichedTask.type}
- Insight: "${enrichedTask.insight}"
- The Question: "${enrichedTask.theQuestion}"

USER'S PROJECTS:
${contextStr}

${historyStr ? `CONVERSATION SO FAR:\n${historyStr}\n` : ''}

USER'S MESSAGE: ${userMessage}

Respond directly and helpfully. Be concise (2-4 sentences). Don't be preachy or lecture them.
Connect observations to their stated goals when relevant.
If they're resisting, acknowledge it but gently push back if you think they're avoiding something.`;

  try {
    const response = await runModel(engine, prompt);
    let text = stripAnsiCodes(response.text).trim();

    // Remove any JSON wrapping if present
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        text = parsed.response || parsed.message || text;
      } catch (e) {
        // Not JSON, use as-is
      }
    }

    return text;
  } catch (error) {
    console.error(`[TaskEnricher] Chat failed: ${error.message}`);
    return "I'm having trouble thinking about this right now. Try asking differently, or just make a decision.";
  }
}

module.exports = {
  enrichTask,
  enrichTopTask,
  chatAboutTask,
  getFallbackInsight,
  getFallbackActions,
  DEFAULT_ENGINE
};
