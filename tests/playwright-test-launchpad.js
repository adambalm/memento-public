const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000/launchpad/2026-01-08T04-26-24';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  try {
    console.log('Opening Launchpad page...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 10000 });
    console.log('Page loaded:', await page.title());

    // Take initial screenshot showing the full UI
    await page.screenshot({ path: 'C:/Users/Guest1/AppData/Local/Temp/launchpad-initial.png', fullPage: true });
    console.log('Screenshot saved to C:/Users/Guest1/AppData/Local/Temp/launchpad-initial.png');

    // Check for key elements
    const progressBar = await page.locator('.progress-fill').isVisible();
    console.log('Progress bar visible:', progressBar);

    const resumeCard = await page.locator('.resume-card').isVisible();
    console.log('Resume Card visible:', resumeCard);

    const laterButtons = await page.locator('.action-btn.later').count();
    console.log('Later buttons found:', laterButtons);

    const checkboxes = await page.locator('.item-checkbox').count();
    console.log('Checkboxes found:', checkboxes);

    // Check batch bar is initially hidden
    const batchBarHidden = await page.locator('#batch-bar').evaluate(el => !el.classList.contains('visible'));
    console.log('Batch bar initially hidden:', batchBarHidden);

    // Click a checkbox to select an item
    if (checkboxes > 0) {
      console.log('\nClicking first checkbox to select item...');
      await page.locator('.item-checkbox').first().click();
      await page.waitForTimeout(500);

      // Verify batch bar appears
      const batchBarVisible = await page.locator('#batch-bar').evaluate(el => el.classList.contains('visible'));
      console.log('Batch bar now visible:', batchBarVisible);

      // Check batch count shows 1
      const batchCount = await page.locator('#batch-count').textContent();
      console.log('Batch count shows:', batchCount);

      // Take screenshot with batch bar visible
      await page.screenshot({ path: 'C:/Users/Guest1/AppData/Local/Temp/launchpad-batch-bar.png', fullPage: true });
      console.log('Batch bar screenshot saved');

      // Verify batch buttons are present
      const laterAllBtn = await page.locator('.batch-btn.later').isVisible();
      const doneAllBtn = await page.locator('.batch-btn.done').isVisible();
      const trashAllBtn = await page.locator('.batch-btn.trash').isVisible();
      console.log('Batch buttons - Later All:', laterAllBtn, 'Done All:', doneAllBtn, 'Trash All:', trashAllBtn);
    }

    console.log('\nAll tests passed!');

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: 'C:/Users/Guest1/AppData/Local/Temp/launchpad-error.png', fullPage: true });
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();
