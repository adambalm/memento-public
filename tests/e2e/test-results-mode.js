/**
 * Test 1: Results Mode API
 *
 * Tests the basic classification flow in Results mode:
 * - POST /classifyAndRender returns HTML
 * - Session is saved to disk
 * - No lock is acquired
 */

const {
  BACKEND_URL,
  createMockTabs,
  getLockStatus,
  forceCleanupLock,
  cleanupSessions,
  assert,
  colors
} = require('./test-helpers');

const testSessionIds = [];

async function test_resultsMode_returnsHtml() {
  console.log('  Testing: POST /classifyAndRender returns HTML...');

  const tabs = createMockTabs(3);
  const response = await fetch(`${BACKEND_URL}/classifyAndRender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabs })
  });

  assert(response.ok, `Expected 200, got ${response.status}`);

  const contentType = response.headers.get('content-type');
  assert(contentType.includes('text/html'), `Expected HTML, got ${contentType}`);

  const html = await response.text();
  assert(html.includes('<!DOCTYPE html>'), 'Response should be HTML document');
  assert(html.includes('Memento'), 'HTML should contain Memento branding');

  console.log(colors.green('    PASS'));
}

async function test_resultsMode_savesSession() {
  console.log('  Testing: Session saved to disk...');

  const tabs = createMockTabs(2);
  const response = await fetch(`${BACKEND_URL}/classifyBrowserContext`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabs })
  });

  assert(response.ok, `Expected 200, got ${response.status}`);

  const data = await response.json();
  assert(data.timestamp, 'Response should have timestamp');
  assert(data.groups, 'Response should have groups');
  assert(data.totalTabs === 2, `Expected 2 tabs, got ${data.totalTabs}`);

  // Track for cleanup
  const sessionId = data.timestamp.replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
  testSessionIds.push(sessionId);

  console.log(colors.green('    PASS'));
}

async function test_resultsMode_noLockAcquired() {
  console.log('  Testing: No lock acquired in Results mode...');

  // Clear any existing lock first
  await forceCleanupLock();

  const tabs = createMockTabs(2);
  await fetch(`${BACKEND_URL}/classifyAndRender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabs })
  });

  const lockStatus = await getLockStatus();
  assert(!lockStatus.locked, 'Lock should not be acquired in Results mode');

  console.log(colors.green('    PASS'));
}

async function runTests() {
  console.log(colors.blue('\n=== Test 1: Results Mode API ===\n'));

  let passed = 0;
  let failed = 0;

  const tests = [
    test_resultsMode_returnsHtml,
    test_resultsMode_savesSession,
    test_resultsMode_noLockAcquired
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      console.log(colors.red(`    FAIL: ${err.message}`));
      failed++;
    }
  }

  // Cleanup
  if (testSessionIds.length > 0) {
    await cleanupSessions(testSessionIds);
  }

  console.log(`\n  Results: ${colors.green(passed + ' passed')}, ${failed > 0 ? colors.red(failed + ' failed') : '0 failed'}\n`);

  return { passed, failed };
}

module.exports = { runTests };

// Run directly if executed as main
if (require.main === module) {
  runTests().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
