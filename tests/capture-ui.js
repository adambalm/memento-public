/**
 * Capture UI screenshots for visual inspection
 * Uses existing Playwright installation - no additional packages needed
 */

const { chromium } = require('playwright');
const path = require('path');

async function captureUI() {
  const htmlPath = path.join(__dirname, 'preview.html');
  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

  console.log(`Loading: ${fileUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();

  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  // Capture full page
  await page.screenshot({
    path: path.join(__dirname, 'ui-full.png'),
    fullPage: true
  });
  console.log('Captured: ui-full.png');

  // Expand Pass 1 trace and capture
  const tracePanels = page.locator('details.trace-panel');
  const count = await tracePanels.count();
  console.log(`Found ${count} trace panels`);

  if (count > 0) {
    await tracePanels.first().locator('summary').click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(__dirname, 'ui-pass1-expanded.png'),
      fullPage: true
    });
    console.log('Captured: ui-pass1-expanded.png');
  }

  // Capture at tablet width
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: path.join(__dirname, 'ui-tablet.png'),
    fullPage: true
  });
  console.log('Captured: ui-tablet.png');

  await browser.close();
  console.log('Done.');
}

captureUI().catch(console.error);
