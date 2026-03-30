// @ts-check
import { test, expect } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Block external resources and wait for the app to load.
 * External fonts/AdSense would block the load event; blocking them allows
 * domcontentloaded to fire quickly.
 */
async function waitForApp(page) {
  await page.route('https://pagead2.googlesyndication.com/**', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible({ timeout: 15000 });
}

/**
 * Clear localStorage before each test so tests are independent.
 */
async function clearStorage(page) {
  await page.addInitScript(() => {
    [
      'tt_tasks', 'tt_todayIds', 'tt_todayDates', 'tt_tomorrowIds',
      'tt_scheduledIds', 'tt_highlighted', 'tt_counter',
      'tt_locale', 'tt_dailyNotif', 'tt_dailyNotifTime', 'tt_lastDailyNotif',
    ].forEach(k => localStorage.removeItem(k));
  });
}

/**
 * Open the "+ Ajouter" form and fill in the title.
 */
async function openNewTaskForm(page, title) {
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  await page.getByPlaceholder('Titre...').fill(title);
}

/**
 * Complete task creation: submit step 1 and click "Ne pas planifier" in step 2.
 * Returns after the task is visible in the list.
 */
async function createTask(page, title) {
  await openNewTaskForm(page, title);
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();
  await expect(page.getByText(title)).toBeVisible();
}

/**
 * Get the task row locator for a given title.
 */
function taskRow(page, title) {
  return page.locator('.row').filter({ hasText: title });
}

/**
 * Get the status dot button (first button in a task row).
 */
function statusBtn(page, title) {
  return taskRow(page, title).locator('button').first();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

// ─── 1. App loads ─────────────────────────────────────────────────────────────

test('shows main UI after auth', async ({ page }) => {
  await waitForApp(page);
  await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible();
  await expect(page.getByText("AUJOURD'HUI")).toBeVisible();
  await expect(page.getByText('DEMAIN')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Ajouter' })).toBeVisible();
});

// ─── 2. Create tasks ──────────────────────────────────────────────────────────

test('creates a basic task', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Ma première tâche');
  await expect(taskRow(page, 'Ma première tâche')).toBeVisible();
});

test('cannot create a task with empty title', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  // Try to submit without a title — clicking "Suivant →" does nothing
  await page.getByRole('button', { name: 'Suivant →' }).click();
  // Form stays open at step 1
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
});

test('creates a task with high priority', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Tâche urgente');

  // Open priority dropdown and select "Haute"
  await page.getByText('PRIORITÉ').locator('..').locator('div').nth(1).click();
  await page.getByText('Haute', { exact: false }).last().click();

  await page.getByRole('button', { name: 'Suivant →' }).click();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();

  await expect(taskRow(page, 'Tâche urgente')).toBeVisible();
  await expect(page.getByText('HAUTE')).toBeVisible();
});

test('creates a task scheduled for today', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, "Tâche aujourd'hui");
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  await page.getByRole('button', { name: /Aujourd'hui/ }).click();
  await expect(page.getByText("Tâche aujourd'hui")).toBeVisible();
  // Today panel should show 1 tâche
  await expect(page.locator('text=1 tâche').first()).toBeVisible();
});

test('creates a task scheduled for tomorrow', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Tâche demain');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  // Click the "Demain" scheduling button (contains text "Demain" and sub-text)
  await page.getByRole('button', { name: /Demain/ }).first().click();
  await expect(page.getByText('Tâche demain')).toBeVisible();
  await expect(page.locator('text=1 tâche').first()).toBeVisible();
});

test('creates a task with a due date via step 2', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Tâche avec date');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();

  // Fill in the date picker that is visible in step 2
  await page.locator('input[type="date"]').fill('2026-04-15');
  await page.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByText('Tâche avec date')).toBeVisible();
  await expect(taskRow(page, 'Tâche avec date').locator('span').filter({ hasText: '📅' })).toBeVisible();
});

test('step 2 shows all scheduling options', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Test planification');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  await expect(page.getByRole('button', { name: /Aujourd'hui/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Demain/ }).first()).toBeVisible();
  await expect(page.getByText('Choisir une date')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ne pas planifier/ })).toBeVisible();
});

// ─── 3. Edit tasks ────────────────────────────────────────────────────────────

test('edits an existing task title', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Titre original');

  // Click task row to open edit form
  await taskRow(page, 'Titre original').click();
  await expect(page.getByText('MODIFIER').first()).toBeVisible();

  await page.getByPlaceholder('Titre...').fill('Titre modifié');
  await page.getByRole('button', { name: 'Modifier' }).click();

  await expect(page.getByText('Titre modifié')).toBeVisible();
  await expect(page.getByText('Titre original')).not.toBeVisible();
});

test('adds a due date via edit form', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche sans date');

  // Open edit form
  await taskRow(page, 'Tâche sans date').click();
  await expect(page.getByText('MODIFIER').first()).toBeVisible();

  // Fill in the ÉCHÉANCE date input (visible in edit mode)
  await page.locator('input[type="date"]').fill('2026-05-10');
  await page.getByRole('button', { name: 'Modifier' }).click();

  // Date should appear in the task row
  await expect(taskRow(page, 'Tâche sans date').locator('span').filter({ hasText: '📅' })).toBeVisible();
});

test('closes edit form by clicking outside', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche fermer form');

  await taskRow(page, 'Tâche fermer form').click();
  await expect(page.getByText('MODIFIER').first()).toBeVisible();

  // Click outside the form overlay
  await page.mouse.click(10, 10);
  await expect(page.getByText('MODIFIER')).not.toBeVisible();
});

test('closes the form with the Annuler button', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText('NOUVELLE TÂCHE')).not.toBeVisible();
});

test('edits task notes', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche avec notes');

  await taskRow(page, 'Tâche avec notes').click();
  await page.getByPlaceholder('Notes...').fill('Note de test importante');
  await page.getByRole('button', { name: 'Modifier' }).click();

  await expect(page.getByText('Note de test importante')).toBeVisible();
});

// ─── 4. Delete tasks ──────────────────────────────────────────────────────────

test('deletes a task', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche à supprimer');

  await taskRow(page, 'Tâche à supprimer').locator('button.delbtn').click();

  await expect(page.getByText('Tâche à supprimer')).not.toBeVisible();
});

// ─── 5. Cycle task status ─────────────────────────────────────────────────────

test('cycles status from À faire to En cours', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche cycle once');

  // One click: À faire → En cours
  await statusBtn(page, 'Tâche cycle once').click();

  // Task still visible in list (only "Terminé" is hidden)
  await expect(taskRow(page, 'Tâche cycle once')).toBeVisible();
});

test('marks a task as done by cycling status twice', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche à finir');

  // Two clicks: À faire → En cours → Terminé
  await statusBtn(page, 'Tâche à finir').click();
  await statusBtn(page, 'Tâche à finir').click();

  // Task disappears from the main list (completed tasks are filtered out)
  await expect(page.getByText('Tâche à finir')).not.toBeVisible();

  // Task should be accessible via Stats → Terminées
  await page.getByRole('button', { name: /📊/ }).click();
  await page.getByText('Terminées →').click();
  await expect(page.getByText('TÂCHES TERMINÉES')).toBeVisible();
  await expect(page.getByText('Tâche à finir')).toBeVisible();
});

// ─── 6. Duplicate task ────────────────────────────────────────────────────────

test('duplicates a task', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche à dupliquer');

  await taskRow(page, 'Tâche à dupliquer').getByTitle('Dupliquer').click();

  // Two rows with same title
  await expect(page.locator('.row').filter({ hasText: 'Tâche à dupliquer' })).toHaveCount(2);
});

// ─── 7. Completed tasks panel ─────────────────────────────────────────────────

test('shows completed tasks panel via stats', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche finie');

  // Mark as done (2 status cycles)
  await statusBtn(page, 'Tâche finie').click();
  await statusBtn(page, 'Tâche finie').click();

  // Open stats → click Terminées
  await page.getByRole('button', { name: /📊/ }).click();
  await page.getByText('Terminées →').click();

  await expect(page.getByText('TÂCHES TERMINÉES')).toBeVisible();
  await expect(page.getByText('Tâche finie')).toBeVisible();

  // Close
  await page.locator('button').filter({ hasText: '✕' }).last().click();
  await expect(page.getByText('TÂCHES TERMINÉES')).not.toBeVisible();
});

test('restores a completed task to active', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche à restaurer');

  // Mark done
  await statusBtn(page, 'Tâche à restaurer').click();
  await statusBtn(page, 'Tâche à restaurer').click();

  // Open completed panel
  await page.getByRole('button', { name: /📊/ }).click();
  await page.getByText('Terminées →').click();
  await expect(page.getByText('TÂCHES TERMINÉES')).toBeVisible();

  // Click restore ↩
  await page.locator('button').filter({ hasText: '↩' }).click();

  // Close panel
  await page.locator('button').filter({ hasText: '✕' }).last().click();

  // Task should be back in the active list
  await expect(taskRow(page, 'Tâche à restaurer')).toBeVisible();
});

// ─── 8. Remove due date ───────────────────────────────────────────────────────

test('removes due date from a task row', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche date supprimable');

  // Set a due date via edit
  await taskRow(page, 'Tâche date supprimable').click();
  await page.locator('input[type="date"]').fill('2026-06-01');
  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(taskRow(page, 'Tâche date supprimable').locator('span').filter({ hasText: '📅' })).toBeVisible();

  // Click the ✕ button next to the date in the task row.
  // The date removal ✕ is a tiny <button> with text '✕' that has NO class (unlike delbtn)
  const row = taskRow(page, 'Tâche date supprimable');
  await row.locator('button:not(.delbtn)').filter({ hasText: '✕' }).click();

  await expect(taskRow(page, 'Tâche date supprimable').locator('span').filter({ hasText: '📅' })).not.toBeVisible();
});

// ─── 9. Notification toggle ───────────────────────────────────────────────────

test('toggles notification bell in task row', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Tâche notif');

  const row = taskRow(page, 'Tâche notif');
  // Bell starts as 🔔
  await expect(row.locator('span').filter({ hasText: '🔔' })).toBeVisible();

  // Click to toggle off
  await row.locator('span').filter({ hasText: '🔔' }).click();
  await expect(row.locator('span').filter({ hasText: '🔕' })).toBeVisible();
});

// ─── 10. Statistics panel ─────────────────────────────────────────────────────

test('opens and closes the statistics panel', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: /📊/ }).click();
  await expect(page.getByText('STATISTIQUES')).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByText('STATISTIQUES')).not.toBeVisible();
});

test('statistics show task count after creating tasks', async ({ page }) => {
  await waitForApp(page);
  await createTask(page, 'Stats Tâche 1');
  await createTask(page, 'Stats Tâche 2');

  await page.getByRole('button', { name: /📊/ }).click();
  await expect(page.getByText('STATISTIQUES')).toBeVisible();
  // Terminées stat shows "done/total" — with 0 done and 2 total: "0/2"
  await expect(page.getByText('0/2')).toBeVisible();
});

// ─── 11. Theme / Appearance ───────────────────────────────────────────────────

test('opens the theme panel', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: /⚙️/ }).click();
  await expect(page.getByText('APPARENCE')).toBeVisible();
});

test('switches to dark mode', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: /⚙️/ }).click();
  await expect(page.getByText('APPARENCE')).toBeVisible();
  await page.getByRole('button', { name: /🌙 Sombre/ }).click();
  // Dark theme: bg #0d0d1a = rgb(13, 13, 26)
  await expect(page.locator('#root > div').first()).toHaveCSS('background-color', 'rgb(13, 13, 26)');
});

test('switches to light mode', async ({ page }) => {
  await waitForApp(page);
  // Open theme panel and switch to dark
  await page.getByRole('button', { name: /⚙️/ }).click();
  await page.getByRole('button', { name: /🌙 Sombre/ }).click();
  // Panel is still open — switch back to light
  await page.getByRole('button', { name: /☀️ Clair/ }).click();
  // Cognac light theme: bg #FDF6EC = rgb(253, 246, 236)
  await expect(page.locator('#root > div').first()).toHaveCSS('background-color', 'rgb(253, 246, 236)');
});

test('closes theme panel by clicking outside', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: /⚙️/ }).click();
  await expect(page.getByText('APPARENCE')).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByText('APPARENCE')).not.toBeVisible();
});

// ─── 12. Priority and status dropdowns ───────────────────────────────────────

test('changes task priority to Basse in form', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  // Open priority dropdown
  await page.getByText('PRIORITÉ').locator('..').locator('div').nth(1).click();
  await page.locator('text=Basse').click();
  // The dropdown should now show "B"
  const dropdown = page.getByText('PRIORITÉ').locator('..').locator('div').nth(1);
  await expect(dropdown.locator('span').first()).toHaveText('B');
});

test('changes task status to En cours in form', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Tâche en cours');
  // Open status dropdown
  await page.getByText('STATUT').locator('..').locator('div').nth(1).click();
  await page.locator('text=En cours').last().click();

  await page.getByRole('button', { name: 'Suivant →' }).click();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();
  await expect(taskRow(page, 'Tâche en cours')).toBeVisible();
});

// ─── 13. Recurrence ──────────────────────────────────────────────────────────

test('shows recurrence buttons in form', async ({ page }) => {
  await waitForApp(page);
  await page.getByRole('button', { name: '+ Ajouter' }).click();
  await expect(page.getByText('RÉCURRENCE')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quotidien' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hebdo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mensuel' })).toBeVisible();
});

test('sets daily recurrence on a task', async ({ page }) => {
  await waitForApp(page);
  await openNewTaskForm(page, 'Tâche quotidienne');
  await page.getByRole('button', { name: 'Quotidien' }).click();
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();

  // Task should show the recurrence badge "🔁 quotidien"
  await expect(taskRow(page, 'Tâche quotidienne').filter({ hasText: '🔁' })).toBeVisible();
  await expect(page.getByText(/quotidien/).first()).toBeVisible();
});

// ─── 14. Multiple tasks ───────────────────────────────────────────────────────

test('creates multiple tasks and shows all', async ({ page }) => {
  await waitForApp(page);
  for (const name of ['Alpha', 'Beta', 'Gamma']) {
    await createTask(page, name);
  }
  await expect(taskRow(page, 'Alpha')).toBeVisible();
  await expect(taskRow(page, 'Beta')).toBeVisible();
  await expect(taskRow(page, 'Gamma')).toBeVisible();
});

// ─── 15. User menu ────────────────────────────────────────────────────────────

test('shows user menu with logout option', async ({ page }) => {
  await waitForApp(page);
  // The avatar shows the first letter of displayName "Test User" → "T"
  await page.locator('div').filter({ hasText: /^T$/ }).last().click();
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
});

// ─── 16. Full lifecycle ───────────────────────────────────────────────────────

test('full task lifecycle: create → edit → cycle → duplicate → delete', async ({ page }) => {
  await waitForApp(page);

  // Create
  await createTask(page, 'Lifecycle Task');
  await expect(taskRow(page, 'Lifecycle Task')).toBeVisible();

  // Edit
  await taskRow(page, 'Lifecycle Task').click();
  await expect(page.getByText('MODIFIER').first()).toBeVisible();
  await page.getByPlaceholder('Titre...').fill('Lifecycle Task Edited');
  await page.getByRole('button', { name: 'Modifier' }).click();
  await expect(taskRow(page, 'Lifecycle Task Edited')).toBeVisible();

  // Cycle status once (À faire → En cours)
  await statusBtn(page, 'Lifecycle Task Edited').click();
  await expect(taskRow(page, 'Lifecycle Task Edited')).toBeVisible();

  // Duplicate
  await taskRow(page, 'Lifecycle Task Edited').getByTitle('Dupliquer').click();
  await expect(page.locator('.row').filter({ hasText: 'Lifecycle Task Edited' })).toHaveCount(2);

  // Delete duplicate
  await page.locator('.row').filter({ hasText: 'Lifecycle Task Edited' }).last().locator('button.delbtn').click();
  await expect(page.locator('.row').filter({ hasText: 'Lifecycle Task Edited' })).toHaveCount(1);

  // Delete original
  await taskRow(page, 'Lifecycle Task Edited').locator('button.delbtn').click();
  await expect(page.getByText('Lifecycle Task Edited')).not.toBeVisible();
});
