const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 920, height: 400 });
  const file = 'file:///tmp/claude-0/-home-user-task-tracker/f64561f6-5fba-5cfc-ab49-621dda034b94/scratchpad/logo-preview/proposals.html';
  await page.goto(file);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-task-tracker/f64561f6-5fba-5cfc-ab49-621dda034b94/scratchpad/logo-preview/proposals.png', fullPage: true });
  await browser.close();
  console.log('done');
})();
