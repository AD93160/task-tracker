# Task Tracker Pro — Contexte projet

## Règles de travail

1. **Profil** : Tu es un développeur senior spécialisé en apps mobiles et web apps. Tu ne prends jamais de raccourcis et tu penses toujours à la sécurité et à la gestion d'erreurs.

2. **Avant de coder** : Propose un plan détaillé et pose toutes les questions nécessaires avant de commencer à écrire du code.

3. **Après chaque changement** : Vérifie que rien n'est cassé. Ne marque jamais une tâche comme terminée sans avoir testé.
4. Ne jamais lancer les tests (npx playwright test, npm test, etc.) sauf si l'utilisateur le demande explicitement.
5. **Avant toute modification de doc ou config** : Explorer la structure complète du repo pour identifier tous les fichiers concernés (ex : CLAUDE.md ET NOMENCLATURE.txt pour la nomenclature). Ne jamais modifier un seul fichier sans avoir vérifié qu'il n'en existe pas d'autres liés.

## Stack
- React 18 + Vite
- Firebase Auth (Google + Email/Password, Apple/Facebook prêts mais config externe manquante)
- Firestore (sync temps réel)
- Firebase Storage (avatars + pièces jointes)
- Firebase Cloud Messaging (notifications push + daily notif)
- Firebase Functions (httpsCallable)
- Déployé sur Vercel depuis la branche `main`
- Monorepo (npm workspaces + Turborepo)

## Structure
```
src/
  App.jsx         # Composant principal (~3654 lignes), toute la logique
  TeamChat.jsx    # Messagerie équipe (groupe + DMs), ~734 lignes
  main.jsx        # Point d'entrée, monte ErrorBoundary + App
  firebase.js     # Config Firebase (Auth, Firestore, Storage, Messaging, Functions)
  mocks/
    firebase-auth.js       # Mock Firebase Auth pour les tests E2E
    firebase-firestore.js  # Mock Firestore pour les tests E2E

packages/
  shared/
    src/
      constants.js   # PRIORITIES, STATUSES, STATUS_DOT, PRIO_COLOR, GREEN/GOLD/ORANGE/RED
      taskUtils.js   # taskColor(), buildCompletion(), isAdminRole(), teamTaskColor(), todayStr()

apps/
  desktop/           # App Electron (structure en place, build en cours)
  mobile/            # Placeholder app native
```

## Schéma d'une tâche personnelle
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
  attachments,  // [{ name, url, type, size, uploadedBy, storagePath }] | []
}
```

## Schéma d'une tâche équipe
```js
{
  id,             // string (Firestore doc ID)
  title, priority, status, due, notes, recurrence,
  createdBy,      // uid
  createdByEmail, // string
  scheduledFor,   // "today" | "tomorrow" | "none" | "YYYY-MM-DD"
  memberVisible,  // boolean — admin peut masquer aux membres
  attachments,    // [{ name, url, type, size, uploadedBy, storagePath }]
}
```

## Constantes clés (dans @task-tracker/shared)
```js
STATUSES   = ["À faire", "En cours", "Terminé"]
PRIORITIES = ["Haute", "Moyenne", "Basse"]
STATUS_DOT = { "À faire":"#4a4a8a", "En cours":"#40a040", "Terminé":"#a040a0" }
PRIO_COLOR = { "Haute":"#ff6b6b", "Moyenne":"#ffd93d", "Basse":"#6bcb77" }
GREEN = "#6bcb77", GOLD = "#ffd93d", ORANGE = "#ffaa33", RED = "#ff6b6b"
```

## État principal (useState) — sélection
```js
// Tâches
tasks, todayIds, todayDates, tomorrowIds, scheduledIds, highlighted
numberingMode     // "dynamic" | "permanent"
taskCounter       // int, compteur numérotation permanente

// UI panneaux
showForm, editingId, formStep, form
showDone          // bool — affiche section tâches terminées
showBin           // bool — affiche la corbeille
showStats, showTheme
modal             // id tâche ouverte en modal (bulles aujourd'hui/demain)

// Tri
sortBy            // null | "added" | "priority" | "due" | "delay" | "status"
sortDir           // "asc" | "desc"

// Récurrence (formulaire)
recurDay, recurMonthDay, recurError

// Thème
theme             // { mode, bg, bgLeft, bgCard, accent, text, textMuted, border, font, titleFont }

// Auth / User
user              // Firebase user
userPseudo        // string — pseudo éditable
userPhotoURL      // string — URL avatar Firebase Storage

// Notifications
dailyNotifEnabled // bool
dailyNotifTime    // "HH:MM"

// Équipe
teamSpace         // bool — mode équipe actif
activeTeamId      // string | null
team              // objet équipe courant
teamRole          // "admin" | "co-admin" | "member" | null
teamTasks         // tâches équipe (Firestore temps réel)
teamPending       // modifications en attente (membres non-admin)
allUserTeams      // toutes les équipes de l'utilisateur

// Layout
isMobile          // bool, screen.width <= 768
```

## Persistance
- **localStorage** : toutes les données perso (préfixe `tt_`)
- **Firestore** : sync auto sur chaque changement d'état (sauf si update vient de Firestore → `fromFirestore` ref)
- **Important** : Firestore rejette `undefined` → toujours utiliser `null`. Le save sanitise via `JSON.parse/stringify`

## Fonctions importantes
- `taskNum(id)` : retourne le numéro affiché selon le mode
- `taskColor(task)` : retourne RED/GOLD/GREEN selon échéance (dans @task-tracker/shared)
- `duplicateTask(task)` : copie inline sans ouvrir le formulaire
- `cycleStatus(id)` : tourne le statut, crée une tâche récurrente si besoin
- `buildCompletion(task)` : génère l'objet completion avec delta temps (dans @task-tracker/shared)
- `submitForm()` : valide et crée/modifie une tâche (2 étapes : formulaire → scheduling)
- `addToToday(id)` : glisse/planifie une tâche dans Aujourd'hui
- `isAdminRole(role)` : retourne true si "admin" ou "co-admin"

## Layout
- **Mobile** (`isMobile`): colonne — AUJOURD'HUI en haut, DEMAIN en dessous, liste en bas
  - Header 2 lignes : (1) Logo + Titre + Avatar + Sync ; (2) Switcher Perso/Équipe + boutons icônes
- **Desktop**: ligne — panneau gauche (aujourd'hui/demain) + panneau droit (liste)
  - Header 1 ligne
- Drag & drop souris + touch (long press **250ms** — `DRAG_DELAY = 250`)

## Pièges connus
- `task.priority` peut être `null` sur vieilles données Firestore → toujours `task.priority || "?"`
- `tomorrowIds` est un tableau d'objets `{id, addedDate}`, pas de simples IDs
- `todayIds` est un tableau d'IDs (numbers)
- Ne jamais stocker `undefined` dans les tâches → utiliser `null`
- `fromFirestore.current = true` avant `setTasks` depuis Firestore pour éviter boucle de sync
- Firebase Storage paths : `users/${uid}/attachments/...` et `teams/${teamId}/attachments/...`

## Branche de travail
- Production : `main` → Vercel déploie automatiquement
- Features : `claude/resume-work-ZxXiO` (branche active)

## Nomenclature des tickets

Format : `[PLATEFORME][SUPPORT][MODE][RÔLE] SECTION — description`

**Plateforme**
- `AP` = App web initiale (React + Vite + Vercel)
- `EL` = App Electron (desktop natif)
- `MO` = App mobile (natif, à venir)
- `ALL` = Les trois plateformes

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
- `CHAT` — Messagerie équipe (groupe + DMs)

**Sections — Global**
- `HEADER` — Barre de navigation
- `INVITATION` — Bannière invitation en attente

**Exemples**
```
[AP][D][P][TR] LISTE          Liste perso web desktop, tous rôles
[AP][M][E][MB] LISTE-ÉQUIPE   Liste équipe web mobile, membre
[ALL][A][E][AD] EN-ATTENTE    Panneau en attente, toutes plateformes
[EL][D][T][TR] HEADER         Header Electron, tous modes et rôles
[AP][D][E][CO] PANNEAU-ÉQUIPE Panneau équipe web desktop, co-admin
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
- Usage : avatars utilisateurs + pièces jointes de tâches (perso et équipe)
