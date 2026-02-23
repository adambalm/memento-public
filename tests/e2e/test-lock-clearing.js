/**
 * Test 4: Lock Clearing Flow
 *
 * Tests the full lock lifecycle:
 * - Lock blocks clear when items remain
 * - Lock clears when all items resolved
 * - Lock status reflects unlocked state
 */

const {
  BACKEND_URL,
  createTestSession,
  acquireLock,
  getLockStatus,
  recordDisposition,
  forceCleanupLock,
  cleanupSessions,
  assert,
  colors
} = require('./test-helpers');

const testSessionIds = [];

async function test_lockClearing_blockedWithRemaining(sessionId) {
  console.log('  Testing: Lock clear blocked with remaining items...');

  const response = await fetch(`${BACKEND_URL}/api/launchpad/${sessionId}/clear-lock`, {
    method: 'POST'
  });
  const result = await response.json();

  assert(!result.success, 'Clear should fail with remaining items');
  assert(result.message.includes('unresolved') || result.message.includes('remaining'),
    'Message should indicate items remaining');

  console.log(colors.green('    PASS'));
}

async function test_lockClearing_succeedsWhenAllResolved(sessionId, itemIds) {
  console.log('  Testing: Lock clears when all items resolved...');

  // Resolve all items
  for (const itemId of itemIds) {
    await recordDisposition(sessionId, 'complete', itemId);
  }

  // Now try to clear
  const response = await fetch(`${BACKEND_URL}/api/launchpad/${sessionId}/clear-lock`, {
    method: 'POST'
  });
  const result = await response.json();

  assert(result.success, `Clear should succeed: ${result.message}`);

  console.log(colors.green('    PASS'));
}

async function test_lockClearing_statusShowsUnlocked() {
  console.log('  Testing: Lock status shows unlocked...');

  const status = await getLockStatus();

  assert(!status.locked, 'Lock should be cleared');

  console.log(colors.green('    PASS'));
}

async function runTests() {
  console.log(colors.blue('\n=== Test 4: Lock Clearing Flow ===\n'));

  let passed = 0;
  let failed = 0;

  // Clean state
  await forceCleanupLock();

  try {
    // Create session with 2 items
    const { sessionId, response } = await createTestSession({ tabCount: 2 });
    testSessionIds.push(sessionId);

    // Get item IDs
    const groups = response.groups || {};
    const itemIds = [];
    for (const [category, items] of Object.entries(groups)) {
      for (const item of items || []) {
        itemIds.push(item.url || item.id);
      }
    }

    // Acquire lock
    await acquireLock(sessionId, itemIds.length);

    // Test 1: Clear blocked
    await test_lockClearing_blockedWithRemaining(sessionId);
    passed++;

    // Test 2: Clear succeeds after resolving all
    await test_lockClearing_succeedsWhenAllResolved(sessionId, itemIds);
    passed++;

    // Test 3: Status shows unlocked
    await test_lockClearing_statusShowsUnlocked();
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
