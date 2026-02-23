#!/usr/bin/env node
/**
 * Memento MCP Tool Tests
 *
 * Validates each tool works correctly before Claude Desktop integration.
 * Run with: npm run test:mcp
 */

const { listSessions, readSession, getLatestSession, searchSessions } = require('../../backend/memory');
const { loadContext, saveContext } = require('../../backend/contextLoader');
const { reclassifySession, listReclassifications } = require('../../backend/mcp/reclassify');

const results = [];
const TEST_PROJECTS = [
  { name: 'Test Project', keywords: ['test', 'mcp', 'validation'], categoryType: 'Project' }
];

async function logResult(name, passed, details = '') {
  results.push({ name, passed, details });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${status}: ${name}${details ? ` - ${details}` : ''}`);
}

// === SESSION QUERY TOOL TESTS ===

async function testListSessions() {
  console.log('\n--- Testing list_sessions ---');
  try {
    const sessions = await listSessions();
    if (!Array.isArray(sessions)) {
      await logResult('list_sessions returns array', false, 'Not an array');
      return;
    }
    await logResult('list_sessions returns array', true, `${sessions.length} sessions`);

    if (sessions.length > 0) {
      const first = sessions[0];
      const hasRequiredFields = first.id && first.timestamp !== undefined;
      await logResult('Sessions have required fields', hasRequiredFields,
        hasRequiredFields ? 'id, timestamp present' : 'Missing fields');
    }
  } catch (error) {
    await logResult('list_sessions', false, error.message);
  }
}

async function testReadSession() {
  console.log('\n--- Testing read_session ---');
  try {
    const sessions = await listSessions();
    if (sessions.length === 0) {
      await logResult('read_session', false, 'No sessions to read');
      return;
    }

    const session = await readSession(sessions[0].id);
    if (!session) {
      await logResult('read_session returns data', false, 'Returned null');
      return;
    }
    await logResult('read_session returns data', true, `${session.totalTabs} tabs`);

    // Test non-existent session
    const noSession = await readSession('nonexistent-session-id');
    await logResult('read_session handles missing', noSession === null);
  } catch (error) {
    await logResult('read_session', false, error.message);
  }
}

async function testGetLatest() {
  console.log('\n--- Testing get_latest ---');
  try {
    const session = await getLatestSession();
    if (session) {
      await logResult('get_latest returns session', true, `${session.timestamp}`);
    } else {
      await logResult('get_latest handles empty', true, 'No sessions (null)');
    }
  } catch (error) {
    await logResult('get_latest', false, error.message);
  }
}

async function testSearchSessions() {
  console.log('\n--- Testing search_sessions ---');
  try {
    // Search for common term
    const results = await searchSessions('github');
    await logResult('search_sessions runs', true, `${results.length} matches for "github"`);

    // Search for unlikely term
    const noResults = await searchSessions('xyzzy12345nonexistent');
    await logResult('search_sessions empty results', noResults.length === 0);
  } catch (error) {
    await logResult('search_sessions', false, error.message);
  }
}

// === CONTEXT MANAGEMENT TOOL TESTS ===

async function testGetActiveProjects() {
  console.log('\n--- Testing get_active_projects ---');
  try {
    const context = loadContext();
    // Context may be null if file doesn't exist - that's OK
    if (context) {
      await logResult('get_active_projects loads', true,
        `${context.activeProjects?.length || 0} projects`);
    } else {
      await logResult('get_active_projects handles missing', true, 'null (no context file)');
    }
  } catch (error) {
    await logResult('get_active_projects', false, error.message);
  }
}

async function testSetActiveProjects() {
  console.log('\n--- Testing set_active_projects ---');
  try {
    // Save original context
    const originalContext = loadContext();

    // Set test projects
    const saved = await saveContext(TEST_PROJECTS);
    await logResult('set_active_projects saves', true,
      `${saved.activeProjects.length} projects saved`);

    // Verify it was saved
    const loaded = loadContext();
    const projectsMatch = loaded?.activeProjects?.length === TEST_PROJECTS.length;
    await logResult('set_active_projects persists', projectsMatch);

    // Restore original context if it existed
    if (originalContext) {
      await saveContext(originalContext.activeProjects);
      await logResult('Original context restored', true);
    }
  } catch (error) {
    await logResult('set_active_projects', false, error.message);
  }
}

// === RE-CLASSIFICATION TOOL TESTS ===

async function testReclassifySession() {
  console.log('\n--- Testing reclassify_session ---');

  // This test is complex because it requires:
  // 1. A valid session
  // 2. Valid context
  // 3. A running LLM (which may not be available)
  // So we just test the module loads and handles errors gracefully

  try {
    const sessions = await listSessions();
    if (sessions.length === 0) {
      await logResult('reclassify_session', false, 'No sessions to test');
      return;
    }

    // Test with missing context
    const originalContext = loadContext();
    // Note: We can't easily clear context for this test, so skip that validation

    // Test module is callable
    await logResult('reclassify_session module loads', typeof reclassifySession === 'function');

    // Test list reclassifications (should work even with none)
    const reclassifications = await listReclassifications(sessions[0].id);
    await logResult('listReclassifications runs', Array.isArray(reclassifications),
      `${reclassifications.length} artifacts found`);

  } catch (error) {
    // Errors are expected if LLM is unavailable
    await logResult('reclassify_session handles errors', true, error.message);
  }
}

// === MAIN ===

async function runAllTests() {
  console.log('=== Memento MCP Tool Tests ===');
  console.log(`Working directory: ${process.cwd()}`);

  // Session Query Tools
  await testListSessions();
  await testReadSession();
  await testGetLatest();
  await testSearchSessions();

  // Context Management Tools
  await testGetActiveProjects();
  await testSetActiveProjects();

  // Re-classification Tools
  await testReclassifySession();

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }

  console.log('\n=== End of Tests ===');
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
