#!/usr/bin/env node
/**
 * E2E Test Orchestrator
 *
 * Runs all end-to-end tests in sequence and reports results.
 * Assumes backend server is already running on localhost:3000
 */

const { forceCleanupLock, colors } = require('./test-helpers');

// Test modules
const testResultsMode = require('./test-results-mode');
const testLaunchpadMode = require('./test-launchpad-mode');
const testDispositions = require('./test-dispositions');
const testLockClearing = require('./test-lock-clearing');
const testLaunchpadUI = require('./test-launchpad-ui');

async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:3000/api/lock-status');
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log(colors.blue('\n========================================'));
  console.log(colors.blue('  Memento E2E Test Suite'));
  console.log(colors.blue('========================================\n'));

  // Check server is running
  console.log('Checking backend server...');
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.log(colors.red('\nERROR: Backend server not running!'));
    console.log('Start the server first: npm start\n');
    process.exit(1);
  }
  console.log(colors.green('Server is running.\n'));

  // Clean state before tests
  console.log('Cleaning up any existing lock...');
  await forceCleanupLock();
  console.log('Done.\n');

  // Run tests
  const results = {
    total: { passed: 0, failed: 0 },
    suites: []
  };

  const testSuites = [
    { name: 'Results Mode API', run: testResultsMode.runTests },
    { name: 'Launchpad Mode API + Lock', run: testLaunchpadMode.runTests },
    { name: 'Disposition Recording', run: testDispositions.runTests },
    { name: 'Lock Clearing Flow', run: testLockClearing.runTests },
    { name: 'Launchpad UI (Browser)', run: testLaunchpadUI.runTests }
  ];

  for (const suite of testSuites) {
    try {
      const { passed, failed } = await suite.run();
      results.total.passed += passed;
      results.total.failed += failed;
      results.suites.push({ name: suite.name, passed, failed });
    } catch (err) {
      console.log(colors.red(`\nSuite "${suite.name}" crashed: ${err.message}\n`));
      results.total.failed++;
      results.suites.push({ name: suite.name, passed: 0, failed: 1, error: err.message });
    }
  }

  // Final cleanup
  await forceCleanupLock();

  // Summary
  console.log(colors.blue('\n========================================'));
  console.log(colors.blue('  Test Summary'));
  console.log(colors.blue('========================================\n'));

  for (const suite of results.suites) {
    const status = suite.failed === 0 ? colors.green('PASS') : colors.red('FAIL');
    console.log(`  ${status} ${suite.name}: ${suite.passed} passed, ${suite.failed} failed`);
  }

  console.log(colors.blue('\n----------------------------------------'));
  const totalStatus = results.total.failed === 0 ? colors.green('ALL TESTS PASSED') : colors.red('SOME TESTS FAILED');
  console.log(`  ${totalStatus}`);
  console.log(`  Total: ${results.total.passed} passed, ${results.total.failed} failed`);
  console.log(colors.blue('----------------------------------------\n'));

  process.exit(results.total.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(colors.red(`\nFatal error: ${err.message}\n`));
  process.exit(1);
});
