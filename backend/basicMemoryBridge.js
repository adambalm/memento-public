/**
 * Basic Memory Bridge
 *
 * Reads Basic Memory research interests directly from the filesystem.
 * No MCP dependency — pure filesystem read with graceful fallback.
 *
 * Looks for markdown files in the research-interests folder and extracts
 * topic keywords from frontmatter and content to match against themes.
 */

const fs = require('fs').promises;
const path = require('path');

// Basic Memory lives here on this machine
const BM_BASE = 'C:/Users/Guest1/basic-memory';
const RESEARCH_DIR = path.join(BM_BASE, 'research-interests');

// Fallback: also check common alternative paths
const ALTERNATIVE_PATHS = [
  path.join(BM_BASE, 'research'),
  path.join(BM_BASE, 'interests'),
  path.join(BM_BASE, 'projects'),
];

/**
 * Find the research interests directory, checking alternatives
 */
async function findResearchDir() {
  for (const dir of [RESEARCH_DIR, ...ALTERNATIVE_PATHS]) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Parse simple YAML frontmatter from a markdown file.
 * Returns { frontmatter: {}, content: string }
 */
function parseFrontmatter(text) {
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, content: text };

  const fm = {};
  const lines = fmMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      // Handle simple arrays: "- item1, item2" or "[item1, item2]"
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }
      fm[key] = value;
    }
  }

  return { frontmatter: fm, content: fmMatch[2] };
}

/**
 * Extract keywords from a markdown file's title, frontmatter tags, and content.
 */
function extractKeywords(filename, frontmatter, content) {
  const keywords = new Set();

  // From filename (remove .md, split on hyphens/underscores/spaces)
  const nameTokens = filename.replace(/\.md$/i, '')
    .split(/[-_\s]+/)
    .map(t => t.toLowerCase())
    .filter(t => t.length > 2);
  nameTokens.forEach(t => keywords.add(t));

  // From frontmatter tags
  const tags = frontmatter.tags || frontmatter.topics || frontmatter.keywords;
  if (Array.isArray(tags)) {
    tags.forEach(t => keywords.add(t.toLowerCase().trim()));
  } else if (typeof tags === 'string') {
    tags.split(',').forEach(t => keywords.add(t.toLowerCase().trim()));
  }

  // From frontmatter title
  if (frontmatter.title) {
    frontmatter.title.split(/\s+/)
      .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length > 3)
      .forEach(t => keywords.add(t));
  }

  // From content: extract heading text and bold text as higher-signal keywords
  const headings = content.match(/^#{1,3}\s+(.+)$/gm) || [];
  for (const h of headings) {
    h.replace(/^#+\s*/, '').split(/\s+/)
      .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length > 3)
      .forEach(t => keywords.add(t));
  }

  const boldText = content.match(/\*\*([^*]+)\*\*/g) || [];
  for (const b of boldText) {
    b.replace(/\*\*/g, '').split(/\s+/)
      .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length > 3)
      .forEach(t => keywords.add(t));
  }

  return Array.from(keywords);
}

/**
 * Load all research interest files and return structured data.
 * Falls back gracefully if directory not found.
 *
 * @returns {Array<{name: string, keywords: string[], content: string, path: string}>}
 */
async function getResearchInterests() {
  const dir = await findResearchDir();
  if (!dir) return [];

  try {
    const files = await fs.readdir(dir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const interests = [];

    for (const file of mdFiles) {
      try {
        const filePath = path.join(dir, file);
        const text = await fs.readFile(filePath, 'utf8');
        const { frontmatter, content } = parseFrontmatter(text);
        const keywords = extractKeywords(file, frontmatter, content);

        interests.push({
          name: frontmatter.title || file.replace(/\.md$/i, '').replace(/[-_]/g, ' '),
          keywords,
          content: content.slice(0, 500), // First 500 chars for matching context
          path: filePath
        });
      } catch (err) {
        // Skip unreadable files
        console.warn(`[BasicMemoryBridge] Skipping ${file}: ${err.message}`);
      }
    }

    return interests;
  } catch (err) {
    console.warn(`[BasicMemoryBridge] Cannot read research dir: ${err.message}`);
    return [];
  }
}

/**
 * Match a theme against research interests.
 * Returns matching interests sorted by relevance.
 *
 * @param {Object} theme - Theme with tabs array (each tab has url, title)
 * @param {Array} interests - From getResearchInterests()
 * @returns {Array<{name: string, matchScore: number, matchedKeywords: string[]}>}
 */
function matchThemeToInterests(theme, interests) {
  if (!interests || interests.length === 0) return [];

  // Collect all keywords from theme tabs
  const themeText = theme.tabs
    .map(t => `${t.title || ''} ${t.url || ''}`)
    .join(' ')
    .toLowerCase();

  const matches = [];

  for (const interest of interests) {
    const matchedKeywords = interest.keywords.filter(kw =>
      kw.length > 3 && themeText.includes(kw)
    );

    if (matchedKeywords.length > 0) {
      matches.push({
        name: interest.name,
        matchScore: matchedKeywords.length,
        matchedKeywords
      });
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  getResearchInterests,
  matchThemeToInterests
};
