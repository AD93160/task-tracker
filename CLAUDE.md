# Task Tracker Pro — Contexte projet

## Règles de travail
- Ne jamais lancer les tests (npx playwright test, npm test, etc.) sauf si l'utilisateur le demande explicitement.
- Lire et appliquer le skill `/mnt/skills/user/task-tracker/SKILL.md` au début de chaque session.

## Stack
- React 18 + Vite
- Firebase Auth + Firestore (sync temps réel)
- Déployé sur Vercel depuis la branche `main`

## Structure
```
src/
  App.jsx       # Composant principal (~1400 lignes), toute la logique
  main.jsx      # Point d'entrée, monte ErrorBoundary + App
  firebase.js   # Config Firebase
```

## Schéma d'une tâche
```js
{
  id,           // Date.now() (number)
  title,        // string
  priority,     // "Haute" | "Moyenne" | "Basse"  (peut être null sur vieilles données)
  status,       // "À faire" | "En cours" | "Terminé"
  due,          // "YYYY-MM-DD" ou ""
  notes,        // string
  notify,       // boolean
  recurrence,   // "none" | "daily" | "weekly-N" | "monthly-day-N" | "monthly-ordinal-N-N"
  completion,   // null ou { doneAt, doneDate, color, deltaMin, deltaLabel }
  num,          // number (mode permanent) | null (mode dynamique)
}
```

## Constantes clés
```js
STATUSES   = ["À faire", "En cours", "Terminé"]
PRIORITIES = ["Haute", "Moyenne", "Basse"]
STATUS_DOT = { "À faire":"#4a4a8a", "En cours":"#40a040", "Terminé":"#a040a0" }
PRIO_COLOR = { "Haute":"#ff6b6b", "Moyenne":"#ffd93d", "Basse":"#6bcb77" }
```

## État principal (useState)
```js
tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted
numberingMode  // "dynamic" | "permanent"
taskCounter    // int, compteur numérotation permanente
theme          // { mode, bg, bgLeft, bgCard, accent, text, textMuted, border, font, titleFont }
sortBy, sortDir
showForm, editingId, formStep, form
recurDay, recurMonthDay, recurError
modal          // id de la tâche ouverte en modal (bulles aujourd'hui/demain)
showDone, showStats, showTheme
isMobile       // bool, screen.width <= 768
user           // Firebase user
```

## Persistance
- **localStorage** : toutes les données (préfixe `tt_`)
- **Firestore** : sync auto sur chaque changement d'état (sauf si update vient de Firestore → `fromFirestore` ref)
- **Important** : Firestore rejette `undefined` → toujours utiliser `null`. Le save sanitise via `JSON.parse/stringify`

## Fonctions importantes
- `taskNum(id)` : retourne le numéro affiché selon le mode
- `taskColor(task)` : retourne RED/GOLD/GREEN selon échéance
- `duplicateTask(task)` : copie inline sans ouvrir le formulaire
- `cycleStatus(id)` : tourne le statut, crée une tâche récurrente si besoin
- `buildCompletion(task)` : génère l'objet completion avec delta temps
- `submitForm()` : valide et crée/modifie une tâche (2 étapes : formulaire → scheduling)

## Layout
- **Mobile** (`isMobile`): colonne — AUJOURD'HUI en haut, DEMAIN en dessous, liste en bas
- **Desktop**: ligne — panneau gauche (aujourd'hui/demain) + panneau droit (liste)
- Drag & drop souris + touch (long press 400ms)

## Pièges connus
- `task.priority` peut être `null` sur vieilles données Firestore → toujours `task.priority || "?"`
- `tomorrowIds` est un tableau d'objets `{id, addedDate}`, pas de simples IDs
- `todayIds` est un tableau d'IDs (numbers)
- Ne jamais stocker `undefined` dans les tâches → utiliser `null`
- `fromFirestore.current = true` avant `setTasks` depuis Firestore pour éviter boucle de sync

## Branche de travail
- Production : `main` → Vercel déploie automatiquement
- Features : `claude/continue-e2e-tests-90NL4` (branche active)

## Nomenclature des tickets

Format : `[SUPPORT][MODE][RÔLE] SECTION — description`

**Support**
- `M` = Mobile uniquement (390px, layout colonne)
- `D` = Desktop + Tablet (820px+, layout 2 panneaux)
- `A` = Tous les supports

**Mode**
- `P` = Page perso
- `E` = Page équipe
- `T` = Tous les modes

**Rôle**
- `AD` = Admin
- `CO` = Co-admin
- `MB` = Membre
- `TR` = Tous les rôles

**Sections — Page perso**
- `AUJOURD'HUI` — Zone bulles du jour (panneau gauche)
- `DEMAIN` — Zone bulles du lendemain (panneau gauche)
- `LISTE` — Liste principale des tâches (panneau droit)
- `FORMULAIRE` — Formulaire de création / édition
- `STATS-PERSO` — Panneau statistiques personnelles
- `THÈME` — Panneau apparence / réglages

**Sections — Page équipe**
- `LISTE-ÉQUIPE` — Liste des tâches d'équipe
- `MODAL-ÉQUIPE` — Modale détail d'une tâche (commentaires, PJ)
- `EN-ATTENTE` — Panneau modifications en attente (admin)
- `MES-PROPS` — Panneau mes propositions (membre)
- `STATS-ÉQUIPE` — Panneau statistiques équipe
- `PANNEAU-ÉQUIPE` — Panneau gestion équipe (membres, invitations)

**Sections — Global**
- `HEADER` — Barre de navigation
- `INVITATION` — Bannière invitation en attente

**Exemples**
```
[D][P][TR] LISTE          Liste perso desktop, tous rôles
[M][E][MB] LISTE-ÉQUIPE   Liste équipe mobile, membre
[A][E][AD] EN-ATTENTE     Panneau en attente, tous supports, admin
[M][T][TR] HEADER         Header mobile, tous modes et rôles
[D][E][CO] PANNEAU-ÉQUIPE Panneau équipe desktop, co-admin
```

## Tests E2E (Playwright)
- Fichiers : `tests/e2e/app.spec.js` + `tests/e2e/bin.spec.js` — 114 tests au total
- Mocks Firebase : `src/mocks/firebase-auth.js` et `src/mocks/firebase-firestore.js`
- Injection de données de test via `window.__testFirestoreData` (clés = chemins Firestore)
- Viewports testés : Desktop (1280×720), Tablet (820×1180), Mobile (390×844)
- Groupes de tests :
  - `Desktop — Page perso` (34 tests)
  - `Tablet — Page perso` (10 tests)
  - `Mobile — Page perso` (12 tests)
  - `Desktop — Page équipe (admin)` (16 tests)
  - `Desktop — Page équipe (membre)` (6 tests)
  - `Tablet — Page équipe` (5 tests)
  - `Mobile — Page équipe` (7 tests)
- Lancer les tests : `npx playwright test`
- Lancer en mode visuel : `npx playwright test --headed`

## Firebase Storage
- Projet : `task-tracker-2ea82`
- Bucket : `us-central1` (no-cost tier)
- Règles : `storage.rules` → déployées via `firebase deploy --only storage --project task-tracker-2ea82`
- Usage : avatars utilisateurs + pièces jointes de tâches
