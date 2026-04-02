// @ts-check
import { test, expect } from '@playwright/test';

// ─── Viewports ────────────────────────────────────────────────────────────────

const DESKTOP = { width: 1280, height: 720 };
const TABLET  = { width: 820,  height: 1180 }; // 820 > 768 → layout desktop
const MOBILE  = { width: 390,  height: 844  }; // 390 ≤ 768 → layout mobile

// ─── Helpers partagés ────────────────────────────────────────────────────────

async function waitForApp(page) {
  await page.route('https://pagead2.googlesyndication.com/**', r => r.abort());
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible({ timeout: 15000 });
}

async function clearStorage(page) {
  await page.addInitScript(() => {
    [
      'tt_tasks', 'tt_todayIds', 'tt_todayDates', 'tt_tomorrowIds',
      'tt_scheduledIds', 'tt_highlighted', 'tt_counter',
      'tt_locale', 'tt_dailyNotif', 'tt_dailyNotifTime', 'tt_lastDailyNotif',
    ].forEach(k => localStorage.removeItem(k));
  });
}

async function openNewTaskForm(page, title) {
  await page.getByRole('button', { name: '+ Ajouter' }).first().click();
  await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  await page.getByPlaceholder('Titre...').fill(title);
}

async function createTask(page, title) {
  await openNewTaskForm(page, title);
  await page.getByRole('button', { name: 'Suivant →' }).click();
  await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
  await page.getByRole('button', { name: /Ne pas planifier/ }).click();
  await expect(page.getByText(title)).toBeVisible();
}

function taskRow(page, title) {
  return page.locator('.row').filter({ hasText: title });
}

function statusBtn(page, title) {
  return taskRow(page, title).locator('button').first();
}

// ─── Données mock équipe ──────────────────────────────────────────────────────

const TEAM_ADMIN_DATA = {
  'users/test-uid-123': {
    teamId: 'team-1',
    teamRole: 'admin',
    allTeamIds: ['team-1'],
  },
  'teams/team-1': {
    name: 'Test Team',
    adminEmail: 'test@test.com',
    adminUid: 'test-uid-123',
    members: [{ uid: 'test-uid-123', email: 'test@test.com', displayName: 'Test User' }],
    coAdmins: [],
    taskCounter: 1,
  },
  'teams/team-1/tasks': [
    {
      id: 'task-team-1',
      title: 'Tâche équipe',
      priority: 'Haute',
      status: 'À faire',
      num: 1,
      createdBy: 'test-uid-123',
      createdByEmail: 'test@test.com',
      scheduledFor: null,
      due: '',
      notes: '',
      attachments: [],
    },
  ],
  'teams/team-1/pendingChanges': [],
};

const TEAM_MEMBER_DATA = {
  'users/test-uid-123': {
    teamId: 'team-1',
    teamRole: 'member',
    allTeamIds: ['team-1'],
  },
  'teams/team-1': {
    name: 'Test Team',
    adminEmail: 'admin@test.com',
    adminUid: 'other-uid',
    members: [
      { uid: 'other-uid',     email: 'admin@test.com', displayName: 'Admin User' },
      { uid: 'test-uid-123',  email: 'test@test.com',  displayName: 'Test User'  },
    ],
    coAdmins: [],
    taskCounter: 1,
  },
  'teams/team-1/tasks': [
    {
      id: 'task-team-1',
      title: 'Tâche équipe',
      priority: 'Haute',
      status: 'À faire',
      num: 1,
      createdBy: 'other-uid',
      createdByEmail: 'admin@test.com',
      scheduledFor: null,
      due: '',
      notes: '',
      attachments: [],
    },
  ],
  'teams/team-1/pendingChanges': [],
};

async function setupTeamData(page, data) {
  await page.addInitScript(d => { window.__testFirestoreData = d; }, data);
}

/** Attend que le switcher d'espace (Perso / 👥 Test Team) soit visible. */
async function waitForTeamSwitcher(page) {
  await expect(
    page.locator('button').filter({ hasText: 'Test Tea' }).first()
  ).toBeVisible({ timeout: 8000 });
}

/** Bascule sur l'espace équipe et attend le titre de section. */
async function switchToTeamSpace(page) {
  await waitForTeamSwitcher(page);
  await page.locator('button').filter({ hasText: 'Test Tea' }).first().click();
  await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible({ timeout: 5000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP — Page perso
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Desktop — Page perso', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  // ── 1. Chargement ────────────────────────────────────────────────────────

  test('affiche l\'UI principale après auth', async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible();
    await expect(page.getByText("AUJOURD'HUI")).toBeVisible();
    await expect(page.getByText('DEMAIN')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Ajouter' })).toBeVisible();
  });

  // ── 2. Création de tâches ─────────────────────────────────────────────

  test('crée une tâche basique', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Ma première tâche');
    await expect(taskRow(page, 'Ma première tâche')).toBeVisible();
  });

  test('ne crée pas de tâche avec titre vide', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
  });

  test('crée une tâche avec priorité Haute', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Tâche urgente');
    await page.getByText('PRIORITÉ').locator('..').locator('div').nth(1).click();
    await page.getByText('Haute', { exact: false }).last().click();
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.getByRole('button', { name: /Ne pas planifier/ }).click();
    await expect(taskRow(page, 'Tâche urgente')).toBeVisible();
    await expect(page.getByText('HAUTE')).toBeVisible();
  });

  test('crée une tâche planifiée aujourd\'hui', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, "Tâche aujourd'hui");
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.getByRole('button', { name: /Aujourd'hui/ }).click();
    await expect(page.getByText("Tâche aujourd'hui")).toBeVisible();
    await expect(page.locator('text=1 tâche').first()).toBeVisible();
  });

  test('crée une tâche planifiée demain', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Tâche demain');
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.getByRole('button', { name: /Demain/ }).first().click();
    await expect(page.getByText('Tâche demain')).toBeVisible();
    await expect(page.locator('text=1 tâche').first()).toBeVisible();
  });

  test('crée une tâche avec date d\'échéance', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Tâche avec date');
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.locator('input[type="date"]').fill('2026-04-15');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Tâche avec date')).toBeVisible();
    await expect(taskRow(page, 'Tâche avec date').locator('span').filter({ hasText: '📅' })).toBeVisible();
  });

  test('l\'étape 2 affiche toutes les options de planification', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Test planification');
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
    await expect(page.getByRole('button', { name: /Aujourd'hui/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Demain/ }).first()).toBeVisible();
    await expect(page.getByText('Choisir une date')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ne pas planifier/ })).toBeVisible();
  });

  // ── 3. Édition ────────────────────────────────────────────────────────

  test('édite le titre d\'une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Titre original');
    await taskRow(page, 'Titre original').click();
    await expect(page.getByText('MODIFIER').first()).toBeVisible();
    await page.getByPlaceholder('Titre...').fill('Titre modifié');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(page.getByText('Titre modifié')).toBeVisible();
    await expect(page.getByText('Titre original')).not.toBeVisible();
  });

  test('ajoute une date d\'échéance via le formulaire', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche sans date');
    await taskRow(page, 'Tâche sans date').click();
    await expect(page.getByText('MODIFIER').first()).toBeVisible();
    await page.locator('input[type="date"]').fill('2026-05-10');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(taskRow(page, 'Tâche sans date').locator('span').filter({ hasText: '📅' })).toBeVisible();
  });

  test('ferme le formulaire en cliquant en dehors', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche fermer form');
    await taskRow(page, 'Tâche fermer form').click();
    await expect(page.getByText('MODIFIER').first()).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('MODIFIER')).not.toBeVisible();
  });

  test('ferme le formulaire avec Annuler', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).not.toBeVisible();
  });

  test('édite les notes d\'une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche avec notes');
    await taskRow(page, 'Tâche avec notes').click();
    await page.getByPlaceholder('Notes...').fill('Note de test importante');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(page.getByText('Note de test importante')).toBeVisible();
  });

  // ── 4. Suppression ────────────────────────────────────────────────────

  test('supprime une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche à supprimer');
    await taskRow(page, 'Tâche à supprimer').locator('button.delbtn').click();
    await expect(page.getByText('Tâche à supprimer')).not.toBeVisible();
  });

  // ── 5. Cycle de statut ────────────────────────────────────────────────

  test('cycle statut : À faire → En cours', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche cycle once');
    await statusBtn(page, 'Tâche cycle once').click();
    await expect(taskRow(page, 'Tâche cycle once')).toBeVisible();
  });

  test('marque une tâche comme terminée (2 cycles)', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche à finir');
    await statusBtn(page, 'Tâche à finir').click();
    await statusBtn(page, 'Tâche à finir').click();
    await expect(page.getByText('Tâche à finir')).not.toBeVisible();
    await page.getByRole('button', { name: /📊/ }).click();
    await page.getByText('Terminées →').click();
    await expect(page.getByText('TÂCHES TERMINÉES')).toBeVisible();
    await expect(page.getByText('Tâche à finir')).toBeVisible();
  });

  // ── 6. Duplication ────────────────────────────────────────────────────

  test('duplique une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche à dupliquer');
    await taskRow(page, 'Tâche à dupliquer').getByTitle('Dupliquer').click();
    await expect(page.locator('.row').filter({ hasText: 'Tâche à dupliquer' })).toHaveCount(2);
  });

  // ── 7. Panneau tâches terminées ───────────────────────────────────────

  test('affiche et ferme le panneau des tâches terminées', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche finie');
    await statusBtn(page, 'Tâche finie').click();
    await statusBtn(page, 'Tâche finie').click();
    await page.getByRole('button', { name: /📊/ }).click();
    await page.getByText('Terminées →').click();
    await expect(page.getByText('TÂCHES TERMINÉES')).toBeVisible();
    await expect(page.getByText('Tâche finie')).toBeVisible();
    await page.locator('button').filter({ hasText: '✕' }).last().click();
    await expect(page.getByText('TÂCHES TERMINÉES')).not.toBeVisible();
  });

  test('restaure une tâche terminée', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche à restaurer');
    await statusBtn(page, 'Tâche à restaurer').click();
    await statusBtn(page, 'Tâche à restaurer').click();
    await page.getByRole('button', { name: /📊/ }).click();
    await page.getByText('Terminées →').click();
    await page.locator('button').filter({ hasText: '↩' }).click();
    await page.locator('button').filter({ hasText: '✕' }).last().click();
    await expect(taskRow(page, 'Tâche à restaurer')).toBeVisible();
  });

  // ── 8. Suppression de la date ─────────────────────────────────────────

  test('supprime la date d\'échéance d\'une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche date supprimable');
    await taskRow(page, 'Tâche date supprimable').click();
    await page.locator('input[type="date"]').fill('2026-06-01');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(taskRow(page, 'Tâche date supprimable').locator('span').filter({ hasText: '📅' })).toBeVisible();
    const row = taskRow(page, 'Tâche date supprimable');
    await row.locator('button:not(.delbtn)').filter({ hasText: '✕' }).click();
    await expect(taskRow(page, 'Tâche date supprimable').locator('span').filter({ hasText: '📅' })).not.toBeVisible();
  });

  // ── 9. Notification ───────────────────────────────────────────────────

  test('bascule la cloche de notification dans la ligne de tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche notif');
    const row = taskRow(page, 'Tâche notif');
    await expect(row.locator('span').filter({ hasText: '🔔' })).toBeVisible();
    await row.locator('span').filter({ hasText: '🔔' }).click();
    await expect(row.locator('span').filter({ hasText: '🔕' })).toBeVisible();
  });

  // ── 10. Statistiques ──────────────────────────────────────────────────

  test('ouvre et ferme le panneau statistiques', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /📊/ }).click();
    await expect(page.getByText('STATISTIQUES')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('STATISTIQUES')).not.toBeVisible();
  });

  test('les statistiques affichent le bon compteur', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Stats Tâche 1');
    await createTask(page, 'Stats Tâche 2');
    await page.getByRole('button', { name: /📊/ }).click();
    await expect(page.getByText('0/2')).toBeVisible();
  });

  // ── 11. Thème / Apparence ─────────────────────────────────────────────

  test('ouvre le panneau d\'apparence', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await expect(page.getByText('APPARENCE')).toBeVisible();
  });

  test('passe en mode sombre', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await page.getByRole('button', { name: /🌙 Sombre/ }).click();
    await expect(page.locator('#root > div').first()).toHaveCSS('background-color', 'rgb(13, 13, 26)');
  });

  test('passe en mode clair', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await page.getByRole('button', { name: /🌙 Sombre/ }).click();
    await page.getByRole('button', { name: /☀️ Clair/ }).click();
    await expect(page.locator('#root > div').first()).toHaveCSS('background-color', 'rgb(253, 246, 236)');
  });

  test('ferme le panneau thème en cliquant en dehors', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await expect(page.getByText('APPARENCE')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('APPARENCE')).not.toBeVisible();
  });

  // ── 12. Dropdowns priorité / statut ───────────────────────────────────

  test('change la priorité en Basse dans le formulaire', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await page.getByText('PRIORITÉ').locator('..').locator('div').nth(1).click();
    await page.locator('text=Basse').click();
    const dropdown = page.getByText('PRIORITÉ').locator('..').locator('div').nth(1);
    await expect(dropdown.locator('span').first()).toHaveText('B');
  });

  test('change le statut en En cours dans le formulaire', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Tâche en cours');
    await page.getByText('STATUT').locator('..').locator('div').nth(1).click();
    await page.locator('text=En cours').last().click();
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.getByRole('button', { name: /Ne pas planifier/ }).click();
    await expect(taskRow(page, 'Tâche en cours')).toBeVisible();
  });

  // ── 13. Récurrence ────────────────────────────────────────────────────

  test('affiche les boutons de récurrence dans le formulaire', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await expect(page.getByText('RÉCURRENCE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quotidien' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hebdo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mensuel' })).toBeVisible();
  });

  test('configure une récurrence quotidienne', async ({ page }) => {
    await waitForApp(page);
    await openNewTaskForm(page, 'Tâche quotidienne');
    await page.getByRole('button', { name: 'Quotidien' }).click();
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await page.getByRole('button', { name: /Ne pas planifier/ }).click();
    await expect(taskRow(page, 'Tâche quotidienne').filter({ hasText: '🔁' })).toBeVisible();
  });

  // ── 14. Tri ───────────────────────────────────────────────────────────

  test('trie par priorité et affiche l\'indicateur de direction', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tri');
    await page.getByRole('button', { name: 'Priorité' }).first().click();
    await expect(page.getByRole('button', { name: /Priorité ↑/ })).toBeVisible();
    await page.getByRole('button', { name: /Priorité ↑/ }).click();
    await expect(page.getByRole('button', { name: /Priorité ↓/ })).toBeVisible();
  });

  test('efface le tri avec le bouton ✕', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tri effacer');
    await page.getByRole('button', { name: 'Priorité' }).first().click();
    await expect(page.getByRole('button', { name: /Priorité ↑/ })).toBeVisible();
    // Le bouton ✕ de la barre de tri (pas delbtn)
    await page.locator('.row').first().locator('..').locator('button').filter({ hasText: '✕' }).first().click();
    await expect(page.getByRole('button', { name: 'Priorité' })).toBeVisible();
  });

  // ── 15. Menu utilisateur ──────────────────────────────────────────────

  test('affiche le menu utilisateur avec l\'option déconnexion', async ({ page }) => {
    await waitForApp(page);
    await page.locator('div').filter({ hasText: /^T$/ }).last().click();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  });

  test('affiche l\'option changer l\'avatar dans le menu', async ({ page }) => {
    await waitForApp(page);
    await page.locator('div').filter({ hasText: /^T$/ }).last().click();
    await expect(page.getByText('🖼️ Changer l\'avatar')).toBeVisible();
  });

  // ── 16. Panneau équipe (bouton 👥) ────────────────────────────────────

  test('ouvre le panneau équipe via le bouton 👥', async ({ page }) => {
    await waitForApp(page);
    // Le bouton standalone 👥 (pas le switcher) ouvre le panneau
    await page.locator('button').filter({ hasText: /^👥/ }).click();
    await expect(page.getByText('MES ÉQUIPES').first()).toBeVisible({ timeout: 5000 });
  });

  // ── 17. Cycle complet ─────────────────────────────────────────────────

  test('cycle complet : créer → éditer → dupliquer → supprimer', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Lifecycle Task');
    await taskRow(page, 'Lifecycle Task').click();
    await page.getByPlaceholder('Titre...').fill('Lifecycle Task Edited');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(taskRow(page, 'Lifecycle Task Edited')).toBeVisible();
    await statusBtn(page, 'Lifecycle Task Edited').click();
    await taskRow(page, 'Lifecycle Task Edited').getByTitle('Dupliquer').click();
    await expect(page.locator('.row').filter({ hasText: 'Lifecycle Task Edited' })).toHaveCount(2);
    await page.locator('.row').filter({ hasText: 'Lifecycle Task Edited' }).last().locator('button.delbtn').click();
    await taskRow(page, 'Lifecycle Task Edited').locator('button.delbtn').click();
    await expect(page.getByText('Lifecycle Task Edited')).not.toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TABLET — Page perso (820×1180 — layout desktop actif)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Tablet — Page perso', () => {
  test.use({ viewport: TABLET });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('affiche l\'UI principale', async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible();
    await expect(page.getByText("AUJOURD'HUI")).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Ajouter' })).toBeVisible();
  });

  test('crée une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet');
    await expect(taskRow(page, 'Tâche tablet')).toBeVisible();
  });

  test('édite une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet edit');
    await taskRow(page, 'Tâche tablet edit').click();
    await page.getByPlaceholder('Titre...').fill('Tâche tablet modifiée');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(page.getByText('Tâche tablet modifiée')).toBeVisible();
  });

  test('supprime une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet del');
    await taskRow(page, 'Tâche tablet del').locator('button.delbtn').click();
    await expect(page.getByText('Tâche tablet del')).not.toBeVisible();
  });

  test('cycle le statut d\'une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet cycle');
    await statusBtn(page, 'Tâche tablet cycle').click();
    await expect(taskRow(page, 'Tâche tablet cycle')).toBeVisible();
  });

  test('duplique une tâche', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet dup');
    await taskRow(page, 'Tâche tablet dup').getByTitle('Dupliquer').click();
    await expect(page.locator('.row').filter({ hasText: 'Tâche tablet dup' })).toHaveCount(2);
  });

  test('ouvre les statistiques', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /📊/ }).click();
    await expect(page.getByText('STATISTIQUES')).toBeVisible();
  });

  test('ouvre le panneau thème', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await expect(page.getByText('APPARENCE')).toBeVisible();
  });

  test('trie par statut', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche tablet tri');
    await page.getByRole('button', { name: 'Statut' }).first().click();
    await expect(page.getByRole('button', { name: /Statut ↑/ })).toBeVisible();
  });

  test('affiche le menu utilisateur', async ({ page }) => {
    await waitForApp(page);
    await page.locator('div').filter({ hasText: /^T$/ }).last().click();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE — Page perso (390×844 — layout mobile actif)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Mobile — Page perso', () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('affiche l\'UI principale en mobile', async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByText('TASK TRACKER PRO').first()).toBeVisible();
    await expect(page.getByText("AUJOURD'HUI")).toBeVisible();
    await expect(page.getByText('DEMAIN')).toBeVisible();
  });

  test('le bouton + Ajouter est visible en mobile (panneau gauche)', async ({ page }) => {
    await waitForApp(page);
    // Sur mobile, le bouton est dans le panneau gauche sous les sections aujourd'hui/demain
    await expect(page.getByRole('button', { name: '+ Ajouter' }).first()).toBeVisible();
  });

  test('crée une tâche en mobile', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche mobile');
    await expect(page.getByText('Tâche mobile')).toBeVisible();
  });

  test('édite une tâche en mobile', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche mobile edit');
    await taskRow(page, 'Tâche mobile edit').click();
    await expect(page.getByText('MODIFIER').first()).toBeVisible();
    await page.getByPlaceholder('Titre...').fill('Tâche mobile modifiée');
    await page.getByRole('button', { name: 'Modifier' }).click();
    await expect(page.getByText('Tâche mobile modifiée')).toBeVisible();
  });

  test('supprime une tâche en mobile', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche mobile del');
    await taskRow(page, 'Tâche mobile del').locator('button.delbtn').click();
    await expect(page.getByText('Tâche mobile del')).not.toBeVisible();
  });

  test('cycle le statut en mobile', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche mobile cycle');
    await statusBtn(page, 'Tâche mobile cycle').click();
    await expect(taskRow(page, 'Tâche mobile cycle')).toBeVisible();
  });

  test('ouvre les statistiques via le bouton 📊 mobile', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /📊/ }).click();
    await expect(page.getByText('STATISTIQUES')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('STATISTIQUES')).not.toBeVisible();
  });

  test('ouvre le panneau thème via le bouton ⚙️ mobile', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await expect(page.getByText('APPARENCE')).toBeVisible();
  });

  test('passe en mode sombre en mobile', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: /⚙️/ }).click();
    await page.getByRole('button', { name: /🌙 Sombre/ }).click();
    await expect(page.locator('#root > div').first()).toHaveCSS('background-color', 'rgb(13, 13, 26)');
  });

  test('affiche le menu utilisateur en mobile', async ({ page }) => {
    await waitForApp(page);
    // Avatar dans la ligne 1 du header mobile
    await page.locator('div').filter({ hasText: /^T$/ }).last().click();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  });

  test('ferme le formulaire avec Annuler en mobile', async ({ page }) => {
    await waitForApp(page);
    await page.getByRole('button', { name: '+ Ajouter' }).first().click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).not.toBeVisible();
  });

  test('duplique une tâche en mobile', async ({ page }) => {
    await waitForApp(page);
    await createTask(page, 'Tâche mobile dup');
    await taskRow(page, 'Tâche mobile dup').getByTitle('Dupliquer').click();
    await expect(page.locator('.row').filter({ hasText: 'Tâche mobile dup' })).toHaveCount(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP — Page équipe (admin)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Desktop — Page équipe (admin)', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await setupTeamData(page, TEAM_ADMIN_DATA);
  });

  test('le switcher Perso / 👥 Team est visible', async ({ page }) => {
    await waitForApp(page);
    await waitForTeamSwitcher(page);
    await expect(page.getByRole('button', { name: 'Perso' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Test Tea' }).first()).toBeVisible();
  });

  test('bascule sur l\'espace équipe', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible();
  });

  test('la tâche équipe est visible dans la liste', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.locator('.row').filter({ hasText: 'Tâche équipe' })).toBeVisible();
  });

  test('la cloche 🔔 admin est visible', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    // La cloche admin est dans le header de la section tâches équipe
    await expect(page.locator('button').filter({ hasText: '🔔' }).first()).toBeVisible();
  });

  test('la cloche admin ouvre le panneau MODIFICATIONS EN ATTENTE', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('button').filter({ hasText: '🔔' }).first().click();
    await expect(page.getByText('MODIFICATIONS EN ATTENTE')).toBeVisible();
    await expect(page.getByText('Aucune modification en attente.')).toBeVisible();
    // Fermer en cliquant en dehors
    await page.mouse.click(10, 10);
    await expect(page.getByText('MODIFICATIONS EN ATTENTE')).not.toBeVisible();
  });

  test('les boutons de tri équipe sont visibles', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByRole('button', { name: 'N°' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Priorité' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Échéance' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Statut' }).last()).toBeVisible();
  });

  test('le tri par N° affiche l\'indicateur de direction', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: 'N°' }).click();
    await expect(page.getByRole('button', { name: /N° ↑/ })).toBeVisible();
    await page.getByRole('button', { name: /N° ↑/ }).click();
    await expect(page.getByRole('button', { name: /N° ↓/ })).toBeVisible();
  });

  test('cliquer sur une tâche équipe ouvre la modale', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByText('COMMENTAIRES (0)')).toBeVisible();
    await expect(page.getByText('PIÈCES JOINTES (0)')).toBeVisible();
    await expect(page.getByRole('button', { name: /✎ Modifier/ })).toBeVisible();
  });

  test('la modale équipe se ferme avec le bouton ✕', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByText('COMMENTAIRES (0)')).toBeVisible();
    await page.locator('button').filter({ hasText: '✕' }).last().click();
    await expect(page.getByText('COMMENTAIRES (0)')).not.toBeVisible();
  });

  test('la modale équipe se ferme en cliquant en dehors', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByText('COMMENTAIRES (0)')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('COMMENTAIRES (0)')).not.toBeVisible();
  });

  test('le bouton + Ajouter est visible pour l\'admin', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByRole('button', { name: '+ Ajouter' })).toBeVisible();
  });

  test('l\'admin peut ouvrir le formulaire de création de tâche équipe', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).not.toBeVisible();
  });

  test('l\'admin peut créer une tâche équipe (formulaire complet)', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: '+ Ajouter' }).click();
    await page.getByPlaceholder('Titre...').fill('Nouvelle tâche admin');
    await page.getByRole('button', { name: 'Suivant →' }).click();
    await expect(page.getByText('QUAND PLANIFIER ?')).toBeVisible();
    await page.getByRole('button', { name: /Ne pas planifier/ }).click();
    // Le formulaire se ferme sans erreur
    await expect(page.getByText('NOUVELLE TÂCHE')).not.toBeVisible();
  });

  test('le bouton ✕ de suppression est visible sur la tâche équipe', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(
      page.locator('.row').filter({ hasText: 'Tâche équipe' }).locator('button.delbtn')
    ).toBeVisible();
  });

  test('le dot de statut est cliquable pour l\'admin', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    const row = page.locator('.row').filter({ hasText: 'Tâche équipe' });
    // Le premier bouton dans la ligne (après le numéro) est le dot de statut
    await expect(row.locator('button').first()).toBeVisible();
    await row.locator('button').first().click();
    // Pas d'erreur — le updateDoc du mock réussit silencieusement
  });

  test('les statistiques équipe s\'ouvrent depuis l\'espace équipe', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: /📊/ }).click();
    await expect(page.getByText('STATISTIQUES').first()).toBeVisible();
  });

  test('retour à l\'espace perso via le switcher', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: 'Perso' }).first().click();
    await expect(page.getByText('TÂCHES — TEST TEAM')).not.toBeVisible();
    await expect(page.getByRole('button', { name: '+ Ajouter' })).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DESKTOP — Page équipe (membre)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Desktop — Page équipe (membre)', () => {
  test.use({ viewport: DESKTOP });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await setupTeamData(page, TEAM_MEMBER_DATA);
  });

  test('bascule sur l\'espace équipe en tant que membre', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible();
  });

  test('le bouton affiche "+ Proposer" pour un membre', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByRole('button', { name: '+ Proposer' })).toBeVisible();
  });

  test('le badge "proposer" est visible sur la tâche équipe', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    // Sur desktop, le badge "proposer" est un span à droite de la ligne
    await expect(
      page.locator('.row').filter({ hasText: 'Tâche équipe' }).getByText('proposer')
    ).toBeVisible();
  });

  test('la cloche 🔔 membre ouvre le panneau MES PROPOSITIONS', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('button').filter({ hasText: '🔔' }).first().click();
    await expect(page.getByText('MES PROPOSITIONS EN ATTENTE')).toBeVisible();
    await expect(page.getByText('Aucune proposition en attente.')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByText('MES PROPOSITIONS EN ATTENTE')).not.toBeVisible();
  });

  test('le membre peut ouvrir le formulaire de proposition', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: '+ Proposer' }).click();
    await expect(page.getByText('NOUVELLE TÂCHE')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
  });

  test('cliquer sur une tâche équipe ouvre la modale avec "Proposer une modification"', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByRole('button', { name: /✎ Proposer une modification/ })).toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TABLET — Page équipe
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Tablet — Page équipe', () => {
  test.use({ viewport: TABLET });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await setupTeamData(page, TEAM_ADMIN_DATA);
  });

  test('bascule sur l\'espace équipe en tablet', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible();
  });

  test('la tâche équipe est visible en tablet', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.locator('.row').filter({ hasText: 'Tâche équipe' })).toBeVisible();
  });

  test('la cloche 🔔 admin est visible en tablet', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.locator('button').filter({ hasText: '🔔' }).first()).toBeVisible();
  });

  test('ouvre la modale de tâche équipe en tablet', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByText('COMMENTAIRES (0)')).toBeVisible();
    await page.mouse.click(10, 10);
  });

  test('retour à la page perso en tablet', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: 'Perso' }).first().click();
    await expect(page.getByText('TÂCHES — TEST TEAM')).not.toBeVisible();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MOBILE — Page équipe
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Mobile — Page équipe', () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await setupTeamData(page, TEAM_ADMIN_DATA);
  });

  test('le switcher mobile est visible (Perso / 👥 Test Tea…)', async ({ page }) => {
    await waitForApp(page);
    await waitForTeamSwitcher(page);
    await expect(page.getByRole('button', { name: 'Perso' }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Test Tea' }).first()).toBeVisible();
  });

  test('bascule sur l\'espace équipe en mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.getByText('TÂCHES — TEST TEAM')).toBeVisible();
  });

  test('la tâche équipe est visible en mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.locator('.row').filter({ hasText: 'Tâche équipe' })).toBeVisible();
  });

  test('le bouton + Ajouter est visible pour l\'admin en mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    // Sur mobile, le bouton est dans le header de section tâches
    await expect(page.locator('button').filter({ hasText: '+ Ajouter' }).last()).toBeVisible();
  });

  test('la cloche 🔔 est visible en mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await expect(page.locator('button').filter({ hasText: '🔔' }).first()).toBeVisible();
  });

  test('ouvre la modale de tâche équipe en mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.locator('.row').filter({ hasText: 'Tâche équipe' }).click();
    await expect(page.getByText('COMMENTAIRES (0)')).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(page.getByText('COMMENTAIRES (0)')).not.toBeVisible();
  });

  test('retour à la page perso via le switcher mobile', async ({ page }) => {
    await waitForApp(page);
    await switchToTeamSpace(page);
    await page.getByRole('button', { name: 'Perso' }).first().click();
    await expect(page.getByText('TÂCHES — TEST TEAM')).not.toBeVisible();
  });
});
