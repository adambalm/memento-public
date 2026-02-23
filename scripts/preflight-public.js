#!/usr/bin/env node
/**
 * preflight-public.js — Pre-publish safety scan for public release.
 *
 * Scans git-tracked files for:
 *   1. API keys / tokens (sk-ant-, sk-proj-, ghp_, etc.)
 *   2. Hardcoded internal hostnames (adambalm)
 *   3. .env files that are tracked
 *   4. Sensitive directories that should be gitignored
 *
 * Exit 0 = clean, Exit 1 = findings reported.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const findings = [];

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// Get list of tracked files
const tracked = run('git ls-files').split('\n').filter(Boolean);

// 1. Secret patterns in file contents
const SECRET_PATTERNS = [
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, label: 'Anthropic API key' },
  { re: /sk-proj-[A-Za-z0-9_-]{20,}/, label: 'OpenAI API key' },
  { re: /ghp_[A-Za-z0-9]{36,}/, label: 'GitHub PAT' },
  { re: /glpat-[A-Za-z0-9_-]{20,}/, label: 'GitLab PAT' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
  { re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, label: 'Private key' },
];

for (const file of tracked) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  // Skip binary-looking files
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.zip'].includes(ext)) continue;

  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    continue;
  }

  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(content)) {
      findings.push(`SECRET: ${label} found in ${file}`);
    }
  }
}

// 2. Tracked .env files (should never be committed)
for (const file of tracked) {
  if (/^\.env($|\.)/.test(path.basename(file)) && path.basename(file) !== '.env.example') {
    findings.push(`TRACKED_ENV: ${file} is tracked by git (should be in .gitignore)`);
  }
}

// 3. Sensitive directories that should be excluded
const SENSITIVE_DIRS = ['.claude/', 'backend/evals/'];
for (const dir of SENSITIVE_DIRS) {
  const inDir = tracked.filter(f => f.startsWith(dir));
  if (inDir.length > 0) {
    findings.push(`SENSITIVE_DIR: ${inDir.length} files tracked under ${dir}`);
  }
}

// 4. Internal hostname in non-documentation files
//    Allow it in CLAUDE.md, README, docs/ — flag it in source code
const CODE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.json', '.mjs'];
for (const file of tracked) {
  const ext = path.extname(file).toLowerCase();
  if (!CODE_EXTENSIONS.includes(ext)) continue;
  if (file === 'package.json' || file === 'package-lock.json') continue;

  const abs = path.join(ROOT, file);
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch {
    continue;
  }

  // Match adambalm as a hostname (not as a GitHub username in URLs)
  if (/(?<!github\.com\/(?:users\/)?)adambalm(?!@)/.test(content) &&
      !content.includes('github.com/adambalm')) {
    // More targeted: look for it used as a hostname
    if (/adambalm:\d+/.test(content) || /\/\/adambalm[\/:]/.test(content)) {
      findings.push(`HOSTNAME: Internal hostname "adambalm" in ${file}`);
    }
  }
}

// Report
console.log('=== Memento Public Release Preflight ===');
console.log(`Scanned ${tracked.length} tracked files\n`);

if (findings.length === 0) {
  console.log('RESULT: CLEAN — no findings');
  process.exit(0);
} else {
  console.log(`RESULT: ${findings.length} FINDING(S)\n`);
  for (const f of findings) {
    console.log(`  ⚠  ${f}`);
  }
  console.log('\nFix these before publishing.');
  process.exit(1);
}
