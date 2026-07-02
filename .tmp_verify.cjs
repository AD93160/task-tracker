const { chromium } = require('playwright');
const fs = require('fs');
const SCRATCHPAD = '/tmp/claude-0/-home-user-task-tracker/f64561f6-5fba-5cfc-ab49-621dda034b94/scratchpad';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Inject test tasks covering all 4 urgency states
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const tasks = [
    { id: 1000, title: "Rapport Q2 en retard", priority: "Haute",   status: "À faire", due: yesterday, notes: "", notify: true, recurrence: "none", completion: null, num: 1, attachments: [] },
    { id: 1001, title: "Appel client Martin",  priority: "Haute",   status: "À faire", due: today,     notes: "", notify: true, recurrence: "none", completion: null, num: 2, attachments: [] },
    { id: 1002, title: "Préparer la démo",     priority: "Moyenne", status: "En cours", due: tomorrow,  notes: "", notify: true, recurrence: "none", completion: null, num: 3, attachments: [] },
    { id: 1003, title: "Revoir la roadmap",    priority: "Basse",   status: "À faire", due: nextWeek,  notes: "", notify: true, recurrence: "none", completion: null, num: 4, attachments: [] },
  ];
  const todayIds = [1001];

  await page.addInitScript(({ tasks, todayIds }) => {
    localStorage.setItem('tt_tasks', JSON.stringify(tasks));
    localStorage.setItem('tt_todayIds', JSON.stringify(todayIds));
    localStorage.setItem('tt_tomorrowIds', JSON.stringify([]));
    localStorage.setItem('tt_todayDates', JSON.stringify({ 1001: new Date().toISOString().split('T')[0] }));
    localStorage.setItem('tt_numberingMode', 'permanent');
    localStorage.setItem('tt_taskCounter', '4');
  }, { tasks, todayIds });

  await page.goto('http://localhost:5173');
  // Wait for login page — skip auth by forcing logged-in state won't work directly,
  // so let's screenshot the login page first to confirm the app loads
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCRATCHPAD}/verify-login.png` });

  // Check if there's a login form or if we can see tasks
  const hasLoginForm = await page.$('input[type="email"], input[type="text"][placeholder*="mail"]');
  if (hasLoginForm) {
    console.log('Login page visible — app loads correctly');
    // Can't inject tasks past auth — take a screenshot to show the app is running
  } else {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCRATCHPAD}/verify-tasks.png`, fullPage: true });
    console.log('Task list visible');
  }

  await browser.close();
  console.log('done');
})();
