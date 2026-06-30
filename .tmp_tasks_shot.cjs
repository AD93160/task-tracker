const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 860, height: 520 });
  await page.goto('file:///tmp/claude-0/-home-user-task-tracker/f64561f6-5fba-5cfc-ab49-621dda034b94/scratchpad/logo-preview/tasks-preview.html');
  await page.waitForTimeout(400);
  await page.screenshot({
    path: '/tmp/claude-0/-home-user-task-tracker/f64561f6-5fba-5cfc-ab49-621dda034b94/scratchpad/logo-preview/tasks-preview.png',
    fullPage: true
  });
  await browser.close();
  console.log('done');
})();
