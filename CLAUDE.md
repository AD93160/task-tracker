# Task Tracker Pro — Contexte projet

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
- Features : `claude/fix-mobile-layout-6KpTy` (à merger dans main quand terminé)
