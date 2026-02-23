/**
 * E2E Tests: Focus Mode Conversion
 * Tests the Results → Launchpad conversion flow via Focus Mode button
 */

const { chromium } = require('playwright');
const {
  BACKEND_URL,
  getLockStatus,
  cleanupSessions,
  assert,
  assertEqual,
  colors
} = require('./test-helpers');

const results = { passed: 0, failed: 0 };
const sessionsToCleanup = [];

function test(name, fn) {
  return async () => {
    process.stdout.write(`  Testing: ${name}...`);
    try {
      await fn();
      console.log(colors.green('    PASS'));
      results.passed++;
    } catch (err) {
      console.log(colors.red(`    FAIL: ${err.message}`));
      results.failed++;
    }
  };
}

async function runTests() {
  console.log(colors.blue('\n=== Test 5: Focus Mode Conversion ===\n'));

  // Setup: Force clear any existing lock
  await fetch(`${BACKEND_URL}/api/lock/force-clear`, { method: 'POST' });

  let browser;
  let sessionId;

  try {
    // Create a test session via Results mode (classifyAndRender)
    console.log('  Setting up test session...');
    const response = await fetch(`${BACKEND_URL}/classifyAndRender`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs: [
          { url: 'https://github.com/test', title: 'Test Repo', content: 'GitHub repository' },
          { url: 'https://docs.example.com/api', title: 'API Docs', content: 'Documentation' },
          { url: 'https://news.ycombinator.com', title: 'Hacker News', content: 'Tech news' }
        ]
      })
    });

    const html = await response.text();

    // Extract sessionId from the rendered HTML
    const sessionIdMatch = html.match(/SESSION_ID = '([^']+)'/);
    if (!sessionIdMatch) {
      throw new Error('Could not extract sessionId from Results page');
    }
    sessionId = sessionIdMatch[1];
    sessionsToCleanup.push(sessionId);
    console.log(`  Session created: ${sessionId}`);

    // Test 1: Focus Mode button appears in Results page
    await test('Focus Mode button appears in Results page', async () => {
      assert(html.includes('id="focus-mode-btn"'), 'Focus Mode button should be in HTML');
      assert(html.includes('Enter Focus Mode'), 'Button should have correct text');
    })();

    // Test 2: SessionId is embedded in Results page
    await test('SessionId embedded in Results page', async () => {
      assert(html.includes(`SESSION_ID = '${sessionId}'`), 'SessionId should be embedded in script');
    })();

    // Launch browser for interactive tests
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to Launchpad directly (simulating the redirect after Focus Mode click)
    // We can't test the actual button click from blob URL, but we can verify the flow works

    // Test 3: Launchpad page loads for the session
    await test('Launchpad page loads for session', async () => {
      await page.goto(`${BACKEND_URL}/launchpad/${sessionId}`);
      const title = await page.title();
      assert(title.includes('Launchpad'), 'Page title should include Launchpad');
    })();

    // Test 4: Session items appear in Launchpad
    await test('Session items appear in Launchpad', async () => {
      const items = await page.$$('.item');
      assert(items.length >= 3, `Expected at least 3 items, got ${items.length}`);
    })();

    // Test 5: Acquire lock manually and verify
    await test('Lock can be acquired for session', async () => {
      const lockRes = await fetch(`${BACKEND_URL}/api/acquire-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, itemsRemaining: 3 })
      });
      const lockResult = await lockRes.json();
      assert(lockResult.success, 'Lock acquisition should succeed');
    })();

    // Test 6: Lock status shows correct session
    await test('Lock status shows correct session', async () => {
      const status = await getLockStatus();
      assert(status.locked === true, 'Should be locked');
      assertEqual(status.sessionId, sessionId, 'SessionId should match');
    })();

    // Test 7: Second lock acquisition fails
    await test('Second lock acquisition blocked', async () => {
      const lockRes = await fetch(`${BACKEND_URL}/api/acquire-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'different-session', itemsRemaining: 1 })
      });
      const lockResult = await lockRes.json();
      assert(lockResult.success === false, 'Second lock should fail');
      assert(lockResult.message.toLowerCase().includes('already'), 'Message should explain lock exists');
    })();

  } catch (err) {
    console.error(colors.red(`\n  Setup error: ${err.message}`));
    results.failed++;
  } finally {
    // Cleanup
    if (browser) await browser.close();
    await fetch(`${BACKEND_URL}/api/lock/force-clear`, { method: 'POST' });
    await cleanupSessions(sessionsToCleanup);
  }

  // Summary
  console.log(`\n  Results: ${colors.green(`${results.passed} passed`)}, ${results.failed > 0 ? colors.red(`${results.failed} failed`) : '0 failed'}\n`);

  return results.failed === 0;
}

// Run if executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
