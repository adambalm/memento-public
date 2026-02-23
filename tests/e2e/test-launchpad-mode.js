/**
 * Test 2: Launchpad Mode API + Lock
 *
 * Tests the Launchpad mode flow:
 * - Session creation
 * - Lock acquisition
 * - Lock status verification
 * - Second lock blocked
 * - Launchpad page renders
 */

const {
  BACKEND_URL,
  createTestSession,
  acquireLock,
  getLockStatus,
  forceCleanupLock,
  cleanupSessions,
  assert,
  assertEqual,
  colors
} = require('./test-helpers');

const testSessionIds = [];

async function test_launchpadMode_createsSession() {
  console.log('  Testing: Launchpad mode creates session...');

  const { sessionId, response } = await createTestSession({ tabCount: 3, mode: 'launchpad' });

  assert(sessionId, 'Should return session ID');
  assert(response.totalTabs === 3, `Expected 3 tabs, got ${response.totalTabs}`);
  assert(response.groups, 'Response should have groups');

  testSessionIds.push(sessionId);

  console.log(colors.green('    PASS'));
  return sessionId;
}

async function test_launchpadMode_acquiresLock(sessionId) {
  console.log('  Testing: Lock acquisition...');

  const result = await acquireLock(sessionId, 3);

  assert(result.success, `Lock acquisition should succeed: ${result.message}`);

  const status = await getLockStatus();
  assert(status.locked, 'Lock should be active');
  assertEqual(status.sessionId, sessionId, 'Lock session ID should match');
  assertEqual(status.itemsRemaining, 3, 'Items remaining should be 3');

  console.log(colors.green('    PASS'));
}

async function test_launchpadMode_blocksSecondLock() {
  console.log('  Testing: Second lock acquisition blocked...');

  // Create another session
  const { sessionId: secondSessionId } = await createTestSession({ tabCount: 2, mode: 'launchpad' });
  testSessionIds.push(secondSessionId);

  // Try to acquire lock
  const result = await acquireLock(secondSessionId, 2);

  assert(!result.success, 'Second lock should be blocked');
  assert(result.message.includes('already locked') || result.message.includes('locked'), 'Message should indicate lock exists');

  console.log(colors.green('    PASS'));
}

async function test_launchpadMode_pageRenders(sessionId) {
  console.log('  Testing: Launchpad page renders...');

  const response = await fetch(`${BACKEND_URL}/launchpad/${sessionId}`);

  assert(response.ok, `Expected 200, got ${response.status}`);

  const html = await response.text();
  assert(html.includes('<!DOCTYPE html>'), 'Should return HTML');
  assert(html.includes('Launchpad'), 'Should contain Launchpad title');
  assert(html.includes(sessionId), 'Should contain session ID');

  console.log(colors.green('    PASS'));
}

async function runTests() {
  console.log(colors.blue('\n=== Test 2: Launchpad Mode API + Lock ===\n'));

  let passed = 0;
  let failed = 0;

  // Clean state
  await forceCleanupLock();

  try {
    // Test 1: Create session
    const sessionId = await test_launchpadMode_createsSession();
    passed++;

    // Test 2: Acquire lock
    await test_launchpadMode_acquiresLock(sessionId);
    passed++;

    // Test 3: Block second lock
    await test_launchpadMode_blocksSecondLock();
    passed++;

    // Test 4: Page renders
    await test_launchpadMode_pageRenders(sessionId);
    passed++;

  } catch (err) {
    console.log(colors.red(`    FAIL: ${err.message}`));
    failed++;
  }

  // Cleanup
  await forceCleanupLock();
  if (testSessionIds.length > 0) {
    await cleanupSessions(testSessionIds);
  }

  console.log(`\n  Results: ${colors.green(passed + ' passed')}, ${failed > 0 ? colors.red(failed + ' failed') : '0 failed'}\n`);

  return { passed, failed };
}

module.exports = { runTests };

if (require.main === module) {
  runTests().then(({ failed }) => process.exit(failed > 0 ? 1 : 0));
}
