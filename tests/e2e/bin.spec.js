import { test, expect } from '@playwright/test';

const DESKTOP = { width: 1280, height: 720 };
const MOBILE  = { width: 390,  height: 844 };

async function waitForApp(page) {
  await page.route('https://pagead2.googlesyndication.com/**', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible({ timeout: 15000 });
}

function clearStorage(page) {
  return page.addInitScript(() => {
    ['tt_tasks','tt_todayIds','tt_todayDates','tt_tomorrowIds',
     'tt_scheduledIds','tt_highlighted','tt_counter','tt_deleted',
     'tt_locale','tt_dailyNotif','tt_dailyNotifTime','tt_lastDailyNotif',
    ].forEach(k => localStorage.removeItem(k));
  });
}

async function createTask(page, title) {
  await page.getByRole('button', { name: '+ Ajouter' }).first().click();
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  await page.getByPlaceholder('Titre...').fill(title);
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 5000 });
}

function taskRow(page, title) {
  return page.locator('.row').filter({ hasText: title });
}

async function openStats(page) {
  await page.locator('button').filter({ hasText: '📊' }).first().click();
  await expect(page.getByText('STATISTIQUES')).toBeVisible({ timeout: 5000 });
}

const TEAM_ADMIN_DATA = {
  'users/test-uid-123': { teamId: 'team-1', teamRole: 'admin', allTeamIds: ['team-1'] },
  'teams/team-1': {
    name: 'Test Team', adminEmail: 'test@test.com', adminUid: 'test-uid-123',
    members: [{ uid: 'test-uid-123', email: 'test@test.com', displayName: 'Test User' }],
    coAdmins: [], taskCounter: 1
  },
  'teams/team-1/tasks': [
    { id: 'task-team-1', title: 'Tâche équipe bin', priority: 'Haute', status: 'À faire', num: 1,
      due: '', notes: '', notify: true, recurrence: 'none', completion: null,
      createdBy: 'test-uid-123', createdByEmail: 'test@test.com' }
  ],
  'teams/team-1/pendingChanges': [],
  'teams/team-1/deletedTasks': [],
};

// ── Desktop — Corbeille perso ─────────────────────────────────────────

test.describe('Desktop — Corbeille perso', () => {
  test.use({ viewport: DESKTOP });
  test.beforeEach(async ({ page }) => { await clearStorage(page); });

  test('supprimer une tâche la retire de la liste', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille D1');
    await taskRow(page, 'Tâche corbeille D1').locator('button.delbtn').click();
    await expect(page.getByText('Tâche corbeille D1')).not.toBeVisible({ timeout: 3000 });
  });

  test('la ligne Corbeille apparaît dans les stats après suppression', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille D2');
    await taskRow(page, 'Tâche corbeille D2').locator('button.delbtn').click();
    await openStats(page);
    await expect(page.getByText(/Corbeille/)).toBeVisible({ timeout: 3000 });
  });

  test('cliquer sur Corbeille ouvre le panneau dédié', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille D3');
    await taskRow(page, 'Tâche corbeille D3').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await expect(page.getByText(/🗑️ CORBEILLE/)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Tâche corbeille D3')).toBeVisible();
  });

  test('restaurer une tâche depuis la corbeille la remet dans la liste', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche restaurer D');
    await taskRow(page, 'Tâche restaurer D').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await page.getByRole('button', { name: '↩ Restaurer' }).click();
    await expect(page.getByText('Tâche restaurer D')).toBeVisible({ timeout: 5000 });
  });

  test('suppression définitive retire la tâche de la corbeille', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche définitive D');
    await taskRow(page, 'Tâche définitive D').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await expect(page.getByText(/🗑️ CORBEILLE/)).toBeVisible({ timeout: 3000 });
    // Le bouton ✕ rouge dans le panneau corbeille
    await page.locator('button').filter({ hasText: '✕' }).last().click();
    await expect(page.getByText('Tâche définitive D')).not.toBeVisible({ timeout: 3000 });
  });

  test('le bouton Vider supprime toutes les tâches de la corbeille', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche vider D');
    await taskRow(page, 'Tâche vider D').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await expect(page.getByText(/🗑️ CORBEILLE/)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Tâche vider D')).toBeVisible();
    await page.getByRole('button', { name: 'Vider' }).click();
    await expect(page.getByText('Tâche vider D')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Mobile — Corbeille perso ──────────────────────────────────────────

test.describe('Mobile — Corbeille perso', () => {
  test.use({ viewport: MOBILE });
  test.beforeEach(async ({ page }) => { await clearStorage(page); });

  test('supprimer une tâche la retire de la liste', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille M1');
    await taskRow(page, 'Tâche corbeille M1').locator('button.delbtn').click();
    await expect(page.getByText('Tâche corbeille M1')).not.toBeVisible({ timeout: 3000 });
  });

  test('la ligne Corbeille apparaît dans les stats après suppression', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille M2');
    await taskRow(page, 'Tâche corbeille M2').locator('button.delbtn').click();
    await openStats(page);
    await expect(page.getByText(/Corbeille/)).toBeVisible({ timeout: 3000 });
  });

  test('cliquer sur Corbeille ouvre le panneau dédié', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche corbeille M3');
    await taskRow(page, 'Tâche corbeille M3').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await expect(page.getByText(/🗑️ CORBEILLE/)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Tâche corbeille M3')).toBeVisible();
  });

  test('restaurer une tâche depuis la corbeille la remet dans la liste', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche restaurer M');
    await taskRow(page, 'Tâche restaurer M').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await page.getByRole('button', { name: '↩ Restaurer' }).click();
    await expect(page.getByText('Tâche restaurer M')).toBeVisible({ timeout: 5000 });
  });

  test('le bouton Vider supprime toutes les tâches de la corbeille', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche vider M');
    await taskRow(page, 'Tâche vider M').locator('button.delbtn').click();
    await openStats(page);
    await page.getByText(/Corbeille/).click();
    await expect(page.getByText(/🗑️ CORBEILLE/)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Tâche vider M')).toBeVisible();
    await page.getByRole('button', { name: 'Vider' }).click();
    await expect(page.getByText('Tâche vider M')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Desktop — Corbeille équipe (admin) ───────────────────────────────

test.describe('Desktop — Corbeille équipe (admin)', () => {
  test.use({ viewport: DESKTOP });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(d => { window.__testFirestoreData = d; }, TEAM_ADMIN_DATA);
    await waitForApp(page);
    await page.locator('button').filter({ hasText: 'Test Tea' }).first().click();
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible({ timeout: 5000 });
  });

  test('supprimer une tâche équipe la retire de la liste', async ({ page }) => {
    await taskRow(page, 'Tâche équipe bin').locator('button.delbtn').click();
    await expect(page.getByText('Tâche équipe bin')).not.toBeVisible({ timeout: 3000 });
  });

  test('la corbeille équipe apparaît dans les stats admin', async ({ page }) => {
    await taskRow(page, 'Tâche équipe bin').locator('button.delbtn').click();
    await openStats(page);
    // teamSpace=true → openStats sets statsView="team" automatically
    await expect(page.getByText(/Corbeille équipe/)).toBeVisible({ timeout: 3000 });
  });
});

// ── Mobile — Corbeille équipe (admin) ────────────────────────────────

test.describe('Mobile — Corbeille équipe (admin)', () => {
  test.use({ viewport: MOBILE });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(d => { window.__testFirestoreData = d; }, TEAM_ADMIN_DATA);
    await waitForApp(page);
    await page.locator('button').filter({ hasText: 'Test Tea' }).first().click();
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible({ timeout: 5000 });
  });

  test('supprimer une tâche équipe la retire de la liste', async ({ page }) => {
    await taskRow(page, 'Tâche équipe bin').locator('button.delbtn').click();
    await expect(page.getByText('Tâche équipe bin')).not.toBeVisible({ timeout: 3000 });
  });

  test('la corbeille équipe apparaît dans les stats admin', async ({ page }) => {
    await taskRow(page, 'Tâche équipe bin').locator('button.delbtn').click();
    await openStats(page);
    const teamTab = page.getByRole('button', { name: /Test Team/ });
    if (await teamTab.isVisible()) await teamTab.click();
    await expect(page.getByText(/Corbeille équipe/)).toBeVisible({ timeout: 3000 });
  });
});
