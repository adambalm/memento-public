/**
 * Render session to HTML file for direct viewing
 */

const fs = require('fs');
const path = require('path');
const { renderResultsPage } = require('../backend/renderer');

// Load most recent session with trace data
const sessionsDir = path.join(__dirname, '..', 'memory', 'sessions');
const files = fs.readdirSync(sessionsDir).sort().reverse();

let session = null;
for (const file of files) {
  const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
  const parsed = JSON.parse(content);
  if (parsed.trace) {
    session = parsed;
    console.log(`Using session: ${file}`);
    break;
  }
}

if (!session) {
  console.error('No session with trace data found');
  process.exit(1);
}

// Render to HTML
const html = renderResultsPage(session);
const outputPath = path.join(__dirname, 'preview.html');
fs.writeFileSync(outputPath, html);
console.log(`Rendered to: ${outputPath}`);
