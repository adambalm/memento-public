#!/usr/bin/env node
/**
 * public-mirror.js — Create a clean single-commit mirror for public release.
 *
 * Exports the current HEAD's tracked files into ../memento-public
 * as a fresh git repo with exactly one commit and no history.
 *
 * Usage: node scripts/public-mirror.js
 *
 * Safety:
 *   - Refuses to overwrite an existing ../memento-public directory
 *   - Only includes git-tracked files (respects .gitignore)
 *   - Excludes dialogues/ directory (internal planning docs)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIRROR = path.resolve(ROOT, '..', 'memento-public');

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: opts.cwd || ROOT, stdio: opts.stdio || 'pipe' }).trim();
}

// Safety: refuse to overwrite
if (fs.existsSync(MIRROR)) {
  console.error(`ERROR: ${MIRROR} already exists. Remove it first if you want to re-mirror.`);
  console.error(`  rm -rf "${MIRROR}"`);
  process.exit(1);
}

// Directories to exclude from the public mirror
const EXCLUDE_DIRS = ['dialogues/'];

console.log('=== Creating public mirror ===');
console.log(`Source: ${ROOT}`);
console.log(`Target: ${MIRROR}\n`);

// Get tracked files
const allTracked = run('git ls-files').split('\n').filter(Boolean);
const tracked = allTracked.filter(f => !EXCLUDE_DIRS.some(d => f.startsWith(d)));
const excluded = allTracked.length - tracked.length;

console.log(`Tracked files: ${allTracked.length} total, ${excluded} excluded, ${tracked.length} to mirror`);

// Create mirror directory
fs.mkdirSync(MIRROR, { recursive: true });

// Copy files preserving directory structure
let copied = 0;
for (const file of tracked) {
  const src = path.join(ROOT, file);
  const dst = path.join(MIRROR, file);
  const dir = path.dirname(dst);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dst);
  copied++;
}

console.log(`Copied ${copied} files\n`);

// Initialize git repo with single commit
run('git init', { cwd: MIRROR });
run('git add -A', { cwd: MIRROR });

const commitMsg = 'Initial public release of Memento — browser session capture and classification';
run(`git commit -m "${commitMsg}"`, { cwd: MIRROR });

// Verify
const count = run('git rev-list --count HEAD', { cwd: MIRROR });
const log = run('git log --oneline -n 1', { cwd: MIRROR });

console.log('=== Mirror created ===');
console.log(`Location: ${MIRROR}`);
console.log(`History:  ${count} commit(s)`);
console.log(`HEAD:     ${log}`);

if (count !== '1') {
  console.error(`\nERROR: Expected 1 commit, got ${count}`);
  process.exit(1);
}

console.log('\nNext steps:');
console.log(`  cd "${MIRROR}"`);
console.log('  npm install && npm run preflight:public');
console.log('  gh repo create memento-public --public --source=. --remote=origin --push');
