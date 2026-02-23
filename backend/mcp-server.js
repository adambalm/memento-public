#!/usr/bin/env node
/**
 * Memento MCP Server
 *
 * Exposes session data and context management to Claude Desktop via MCP protocol.
 * Part of the Context Sage pipeline: CAPTURE (Memento) → ORGANIZE (Basic Memory)
 *
 * Architecture: Claude Desktop is the sole orchestrator. Memento never knows about Basic Memory.
 * See: dialogues/memento-mcp-architecture.md
 */

// MCP SDK imports
// Note: Using direct paths because package.json exports with Node CommonJS can be problematic
const path = require('path');
const sdkPath = path.join(__dirname, '..', 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'server');
const { McpServer } = require(path.join(sdkPath, 'mcp.js'));
const { StdioServerTransport } = require(path.join(sdkPath, 'stdio.js'));
const { z } = require('zod');

const { listSessions, readSession, getLatestSession, searchSessions } = require('./memory');
const { loadContext, saveContext } = require('./contextLoader');
const { reclassifySession } = require('./mcp/reclassify');
const { getLockStatus, clearLock } = require('./lockManager');
const { getRecurringUnfinished, getProjectHealth, getDistractionSignature } = require('./longitudinal');
const aggregator = require('./aggregator');
const attentionSync = require('./attention-sync');
const correctionAnalyzer = require('./correctionAnalyzer');

// Create the MCP server
const server = new McpServer({
  name: 'memento',
  version: '1.0.0'
});

// === SESSION QUERY TOOLS ===

server.tool(
  'list_sessions',
  'List all captured browsing sessions with summary metadata (id, timestamp, tabCount, narrative, sessionPattern)',
  {},
  async () => {
    const sessions = await listSessions();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(sessions, null, 2)
      }]
    };
  }
);

server.tool(
  'read_session',
  'Read the full JSON content of a specific session by ID',
  {
    id: z.string().describe('Session ID (timestamp-based, e.g., 2026-01-01T08-36-28)')
  },
  async ({ id }) => {
    const session = await readSession(id);
    if (!session) {
      return {
        content: [{
          type: 'text',
          text: `Session not found: ${id}`
        }],
        isError: true
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(session, null, 2)
      }]
    };
  }
);

server.tool(
  'get_latest',
  'Get the most recent browsing session',
  {},
  async () => {
    const session = await getLatestSession();
    if (!session) {
      return {
        content: [{
          type: 'text',
          text: 'No sessions found'
        }]
      };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(session, null, 2)
      }]
    };
  }
);

server.tool(
  'search_sessions',
  'Search sessions for matching keywords. Returns sessions containing the query string.',
  {
    query: z.string().describe('Search query to match against session content')
  },
  async ({ query }) => {
    const results = await searchSessions(query);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          matchCount: results.length,
          results
        }, null, 2)
      }]
    };
  }
);

// === CONTEXT MANAGEMENT TOOLS ===

server.tool(
  'get_active_projects',
  'Get current active projects from context.json. Returns null if no context file exists.',
  {},
  async () => {
    const context = loadContext();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(context, null, 2)
      }]
    };
  }
);

server.tool(
  'set_active_projects',
  'Update active projects in context.json. This is the authoritative config for classification.',
  {
    projects: z.array(z.object({
      name: z.string().describe('Project name'),
      keywords: z.array(z.string()).optional().describe('Keywords for matching'),
      categoryType: z.string().optional().describe('Category type (e.g., Project, Development, Creative Writing)')
    })).describe('Array of project objects')
  },
  async ({ projects }) => {
    try {
      const saved = await saveContext(projects);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Saved ${projects.length} active project(s)`,
            saved
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to save context: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// === RE-CLASSIFICATION TOOLS ===

server.tool(
  'reclassify_session',
  'Re-run classification on an existing session with current context. Creates a new artifact, never overwrites original.',
  {
    session_id: z.string().describe('Session ID to reclassify'),
    scope: z.enum(['pass4', 'full']).default('pass4').describe('pass4 = thematic analysis only (default), full = all 4 passes')
  },
  async ({ session_id, scope }) => {
    try {
      const result = await reclassifySession(session_id, scope);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Re-classification failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// === SESSION LOCK TOOLS ===
// Part of Nuclear Option / Launchpad convergence
// See: dialogues/Dialogue - Nuclear Option Memento Convergence.md

server.tool(
  'get_lock_status',
  'Get current session lock status. When locked, new captures are blocked until user resolves pending items in launchpad.',
  {},
  async () => {
    const status = await getLockStatus();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(status, null, 2)
      }]
    };
  }
);

server.tool(
  'clear_lock',
  'Clear session lock. Requires matching session ID unless override=true (HO emergency use).',
  {
    session_id: z.string().describe('Session ID to clear (must match locked session)'),
    override: z.boolean().default(false).describe('If true, clear regardless of session ID match (emergency use)')
  },
  async ({ session_id, override }) => {
    const result = await clearLock(session_id, override);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }],
      isError: !result.success
    };
  }
);

// === LONGITUDINAL ANALYSIS TOOLS ===
// Cross-dimensional queries on the Attention Data Cube
// See: plans/clever-snacking-boole.md for design context

server.tool(
  'longitudinal_stats',
  'Get aggregate statistics across all sessions (total sessions, tabs, unique URLs, categories, date range)',
  {},
  async () => {
    const stats = await aggregator.getStats();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
);

server.tool(
  'longitudinal_recurring_unfinished',
  'Find tabs that appear in 2+ sessions but never get completed. Reveals persistent unfinished work.',
  {
    minOccurrences: z.number().default(2).describe('Minimum number of appearances (default: 2)'),
    timeRange: z.string().default('all').describe('ISO date range "start/end" or "all" (default: all)')
  },
  async ({ minOccurrences, timeRange }) => {
    const results = await getRecurringUnfinished({ minOccurrences, timeRange });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: 'recurring_unfinished',
          params: { minOccurrences, timeRange },
          count: results.length,
          results: results.slice(0, 20) // Limit to top 20
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'longitudinal_project_health',
  'Get health status of all tracked projects. Shows active, cooling, neglected, and abandoned projects.',
  {
    includeAbandoned: z.boolean().default(true).describe('Include projects >30 days inactive (default: true)')
  },
  async ({ includeAbandoned }) => {
    const results = await getProjectHealth({ includeAbandoned });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: 'project_health',
          params: { includeAbandoned },
          count: results.length,
          results
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'longitudinal_distraction_signature',
  'Identify distraction patterns: top distraction domains, time-of-day vulnerability, mode correlation.',
  {
    timeRange: z.string().default('all').describe('ISO date range "start/end" or "all" (default: all)'),
    modeFilter: z.string().optional().describe('Filter to specific mode (research-heavy, output-focused, etc.)')
  },
  async ({ timeRange, modeFilter }) => {
    const results = await getDistractionSignature({ timeRange, modeFilter });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: 'distraction_signature',
          params: { timeRange, modeFilter },
          results
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'sync_attention_to_memory',
  'Generate attention insights as markdown notes for basic-memory. Returns { title, folder, content, tags } that can be passed to basic-memory write_note.',
  {
    report: z.enum(['weekly', 'project_health', 'recurring', 'distraction', 'all']).describe('Which report to generate'),
    weekId: z.string().optional().describe('Week ID for weekly summary (e.g., 2026-W02). Defaults to current week.')
  },
  async ({ report, weekId }) => {
    const results = [];

    if (report === 'weekly' || report === 'all') {
      results.push(await attentionSync.generateWeeklySummary(weekId));
    }
    if (report === 'project_health' || report === 'all') {
      results.push(await attentionSync.generateProjectHealthReport());
    }
    if (report === 'recurring' || report === 'all') {
      results.push(await attentionSync.generateRecurringUnfinished());
    }
    if (report === 'distraction' || report === 'all') {
      results.push(await attentionSync.generateDistractionSignature());
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          action: 'sync_attention_to_memory',
          report,
          noteCount: results.length,
          notes: results,
          instructions: 'Pass each note to basic-memory write_note with: title, folder, content, tags'
        }, null, 2)
      }]
    };
  }
);

// === CORRECTION ANALYSIS TOOLS ===
// Learn from user corrections to improve classification
// See: correctionAnalyzer.js

server.tool(
  'correction_stats',
  'Get summary statistics about user corrections (regroup actions). Shows how often AI classifications are corrected and common patterns.',
  {},
  async () => {
    const stats = await correctionAnalyzer.getCorrectionStats();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }
);

server.tool(
  'correction_suggestions',
  'Get suggestions for domains that need better content extractors based on user correction patterns.',
  {
    minCorrections: z.number().default(2).describe('Minimum corrections to flag (default: 2)'),
    minRate: z.number().default(0.3).describe('Minimum correction rate to flag (default: 0.3 = 30%)')
  },
  async ({ minCorrections, minRate }) => {
    const suggestions = await correctionAnalyzer.suggestExtractors(minCorrections, minRate);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query: 'correction_suggestions',
          params: { minCorrections, minRate },
          count: suggestions.length,
          suggestions
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'add_extractor',
  'Add a domain to the extractors config for better content extraction.',
  {
    domain: z.string().describe('Domain name (e.g., arxiv.org)'),
    selectors: z.array(z.string()).optional().describe('CSS selectors for content extraction'),
    expectedCategory: z.string().optional().describe('Expected category for this domain (if consistent)'),
    notes: z.string().optional().describe('Notes about extraction strategy')
  },
  async ({ domain, selectors, expectedCategory, notes }) => {
    const result = await correctionAnalyzer.addExtractor(domain, {
      selectors,
      expectedCategory,
      notes
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Added extractor for ${domain}`,
          extractors: result
        }, null, 2)
      }]
    };
  }
);

server.tool(
  'get_extractors',
  'Get the current domain extractors configuration.',
  {},
  async () => {
    const extractors = await correctionAnalyzer.loadExtractors();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(extractors, null, 2)
      }]
    };
  }
);

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('Memento MCP server running on stdio');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
