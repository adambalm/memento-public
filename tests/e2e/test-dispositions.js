/**
 * Test 3: Disposition Recording
 *
 * Tests that user actions are correctly recorded:
 * - Trash action recorded
 * - Complete action recorded
 * - Dispositions persisted to session file
 * - Session state reflects dispositions
 */

const {
  BACKEND_URL,
  createTestSession,
  acquireLock,
  recordDisposition,
  getSessionState,
  readSessionFile,
  forceCleanupLock,
  cleanupSessions,
  assert,
  assertEqual,
  colors
} = require('./test-helpers');

const testSessionIds = [];

async function test_dispositions_trashRecorded(sessionId, itemId) {
  console.log('  Testing: Trash disposition recorded...');

  const result = await recordDisposition(sessionId, 'trash', itemId);

  assert(result.success, `Trash should succeed: ${result.message}`);

  // Verify in session file
  const session = await readSessionFile(sessionId);
  assert(session.dispositions, 'Session should have dispositions array');
  assert(session.dispositions.length >= 1, 'Should have at least 1 disposition');

  const trashDisp = session.dispositions.find(d => d.action === 'trash' && d.itemId === itemId);
  assert(trashDisp, 'Trash disposition should exist');
  assert(trashDisp.at, 'Disposition should have timestamp');

  console.log(colors.green('    PASS'));
}

async function test_dispositions_completeRecorded(sessionId, itemId) {
  console.log('  Testing: Complete disposition recorded...');

  const result = await recordDisposition(sessionId, 'complete', itemId);

  assert(result.success, `Complete should succeed: ${result.message}`);

  // Verify in session file
  const session = await readSessionFile(sessionId);
  const completeDisp = session.dispositions.find(d => d.action === 'complete' && d.itemId === itemId);
  assert(completeDisp, 'Complete disposition should exist');

  console.log(colors.green('    PASS'));
}

async function test_dispositions_stateReflects(sessionId) {
  console.log('  Testing: Session state reflects dispositions...');

  const state = await getSessionState(sessionId);

  assert(state.itemStates, 'State should have itemStates');
  assert(state.unresolvedCount !== undefined, 'State should have unresolvedCount');

  // Should have 2 resolved items (trash + complete)
  const resolvedCount = Object.values(state.itemStates).filter(s => s.status !== 'pending').length;
  assert(resolvedCount >= 2, `Expected at least 2 resolved items, got ${resolvedCount}`);

  console.log(colors.green('    PASS'));
}

async function test_dispositions_promoteRecorded(sessionId, itemId) {
  console.log('  Testing: Promote disposition recorded with target...');

  const result = await recordDisposition(sessionId, 'promote', itemId, {
    target: 'basic-memory://notes/test'
  });

  assert(result.success, `Promote should succeed: ${result.message}`);

  // Verify in session file
  const session = await readSessionFile(sessionId);
  const promoteDisp = session.dispositions.find(d => d.action === 'promote' && d.itemId === itemId);
  assert(promoteDisp, 'Promote disposition should exist');
  assertEqual(promoteDisp.target, 'basic-memory://notes/test', 'Promote should have target');

  console.log(colors.green('    PASS'));
}

async function test_dispositions_undoRestoresPending(sessionId, itemId) {
  console.log('  Testing: Undo disposition restores item to pending...');

  // First trash the item
  const trashResult = await recordDisposition(sessionId, 'trash', itemId);
  assert(trashResult.success, `Trash should succeed: ${trashResult.message}`);

  // Check it's trashed
  let state = await getSessionState(sessionId);
  assertEqual(state.itemStates[itemId].status, 'trashed', 'Item should be trashed');

  // Now undo
  const undoResult = await recordDisposition(sessionId, 'undo', itemId, { undoes: 'trash' });
  assert(undoResult.success, `Undo should succeed: ${undoResult.message}`);

  // Check it's back to pending
  state = await getSessionState(sessionId);
  assertEqual(state.itemStates[itemId].status, 'pending', 'Item should be pending after undo');

  // Verify undo disposition in file
  const session = await readSessionFile(sessionId);
  const undoDisp = session.dispositions.find(d => d.action === 'undo' && d.itemId === itemId);
  assert(undoDisp, 'Undo disposition should exist');
  assertEqual(undoDisp.undoes, 'trash', 'Undo should reference the undone action');

  console.log(colors.green('    PASS'));
}

async function runTests() {
  console.log(colors.blue('\n=== Test 3: Disposition Recording ===\n'));

  let passed = 0;
  let failed = 0;

  // Clean state
  await forceCleanupLock();

  try {
    // Create test session with enough items
    const { sessionId, response } = await createTestSession({ tabCount: 5 });
    testSessionIds.push(sessionId);

    // Get item IDs from the session
    const groups = response.groups || {};
    const allItems = [];
    for (const [category, items] of Object.entries(groups)) {
      for (const item of items || []) {
        allItems.push(item.url || item.id);
      }
    }

    if (allItems.length < 4) {
      throw new Error(`Not enough items in session: ${allItems.length}`);
    }

    // Acquire lock for the session
    await acquireLock(sessionId, allItems.length);

    // Test 1: Trash
    await test_dispositions_trashRecorded(sessionId, allItems[0]);
    passed++;

    // Test 2: Complete
    await test_dispositions_completeRecorded(sessionId, allItems[1]);
    passed++;

    // Test 3: State reflects
    await test_dispositions_stateReflects(sessionId);
    passed++;

    // Test 4: Promote
    await test_dispositions_promoteRecorded(sessionId, allItems[2]);
    passed++;

    // Test 5: Undo
    await test_dispositions_undoRestoresPending(sessionId, allItems[3]);
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
