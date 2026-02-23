/**
 * Theme Saver
 *
 * Generates a Basic Memory research note from a detected theme and writes
 * it directly to the BM filesystem. Basic Memory indexes from the filesystem,
 * so writing a properly-formatted markdown file is sufficient.
 *
 * This is the primary resolution action — the thing that makes tabs disposable
 * by extracting their value into a durable artifact.
 */

const fs = require('fs').promises;
const path = require('path');

const BM_BASE = 'C:/Users/Guest1/basic-memory';
const THEMES_DIR = path.join(BM_BASE, 'projects', 'memento', 'themes');

/**
 * Generate a markdown research note from a theme.
 *
 * The note contains:
 * - Theme label as title
 * - Candidate intent as summary
 * - All constituent tabs with URLs, titles, recurrence data
 * - Basic Memory connections as wiki-links
 * - User corrections if any (the most valuable semantic content)
 * - Frontmatter for BM indexing
 */
function generateNote(theme) {
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  // Build a readable label — clean up keyword-salad if needed
  const title = theme.label;
  const permalink = 'projects/memento/themes/' + title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Frontmatter
  const frontmatter = [
    '---',
    `title: "${title}"`,
    'type: research-note',
    `permalink: ${permalink}`,
    'status: active',
    'temporal_type: dynamic',
    `valid_from: "${dateStr}"`,
    `last_verified: "${dateStr}"`,
    'detection_source: memento-theme-detection',
    `generated_at: "${now}"`,
    'tags:',
    '- memento-generated',
    '- research-thread',
    '- theme-detection',
    '---',
  ].join('\n');

  // Body sections
  const sections = [];

  sections.push(`# ${title}\n`);
  sections.push(`**Generated:** ${dateStr} by Memento theme detection`);
  sections.push(`**Signal Score:** ${theme.signalScore} | **Tabs:** ${theme.tabs.length}\n`);

  // Intent / synthesis
  if (theme.candidateIntent) {
    sections.push(`## Summary\n\n${theme.candidateIntent}\n`);
  }

  if (theme.description) {
    sections.push(`${theme.description}\n`);
  }

  // User corrections — these are the richest semantic content
  if (theme.userCorrections && theme.userCorrections.length > 0) {
    sections.push(`## User Context\n`);
    sections.push(`*These are Ed's own words about what these tabs mean:*\n`);
    for (const correction of theme.userCorrections) {
      // Strip synthetic markers for the note
      const clean = correction.replace(/\[ED-PROXY-SYNTHETIC\]\s*/g, '');
      sections.push(`> ${clean}\n`);
    }
  }

  // Basic Memory connections
  if (theme.memoryConnections && theme.memoryConnections.length > 0) {
    sections.push(`## Connected Research Interests\n`);
    for (const conn of theme.memoryConnections) {
      const keywords = conn.matchedKeywords ? conn.matchedKeywords.slice(0, 5).join(', ') : '';
      sections.push(`- [[${conn.name}]]${keywords ? ` (via: ${keywords})` : ''}`);
    }
    sections.push('');
  }

  // Constituent tabs
  sections.push(`## Tabs in This Thread\n`);
  sections.push('| Title | Domain | Seen | Days |');
  sections.push('|-------|--------|------|------|');
  for (const tab of theme.tabs) {
    const domain = tab.domain || '';
    const title = (tab.title || tab.url || '').replace(/\|/g, '\\|');
    const link = `[${title}](${tab.url})`;
    sections.push(`| ${link} | ${domain} | ${tab.recurrenceCount}x | ${tab.distinctDays}d |`);
  }
  sections.push('');

  // Categories observed
  const allCategories = new Set();
  for (const tab of theme.tabs) {
    if (tab.categories) tab.categories.forEach(c => allCategories.add(c));
  }
  if (allCategories.size > 0) {
    sections.push(`## Categories Observed\n\n${Array.from(allCategories).join(', ')}\n`);
  }

  // Relations
  sections.push(`## Relations\n`);
  sections.push(`- generated_by [[Memento - Project Index]]`);
  if (theme.memoryConnections) {
    for (const conn of theme.memoryConnections.slice(0, 3)) {
      sections.push(`- relates_to [[${conn.name}]]`);
    }
  }

  return frontmatter + '\n\n' + sections.join('\n');
}

/**
 * Save a theme as a Basic Memory research note.
 *
 * @param {Object} theme - Full theme object from themeDetection
 * @returns {{ success: boolean, filePath: string, permalink: string, title: string }}
 */
async function saveThemeAsNote(theme) {
  // Ensure directory exists
  await fs.mkdir(THEMES_DIR, { recursive: true });

  const note = generateNote(theme);

  // Filename from label
  const filename = theme.label.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    + '.md';

  const filePath = path.join(THEMES_DIR, filename);

  await fs.writeFile(filePath, note, 'utf8');

  return {
    success: true,
    filePath,
    filename,
    title: theme.label,
    permalink: 'projects/memento/themes/' + filename.replace('.md', '')
  };
}

module.exports = {
  saveThemeAsNote,
  generateNote
};
