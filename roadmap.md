# Task Tracker — Roadmap

## ✅ Fait

### Core
- App déployée sur Vercel
- PWA installable sur iPhone
- localStorage — tâches persistantes par appareil
- Tâches de démo supprimées
- Formulaire bottom sheet mobile / modale centrée desktop
- Clic sur tâche = ouvre modification
- Icône calendrier adaptée au thème sombre/clair
- Nom app : Task Tracker
- inputs fontSize 16px (no zoom iOS)
- Dupliquer une tâche ⧉
- Corbeille — suppression logique + restauration
- Numérotation dynamique et permanente

### Récurrence
- Récurrence quotidienne (`daily`)
- Récurrence hebdomadaire (`weekly-N`, N = 1-7)
- Récurrence mensuelle jour fixe (`monthly-day-N`)
- Récurrence mensuelle jour ordinal (`monthly-ordinal-N-N`, ex : 2e mercredi)
- Génération automatique de la prochaine occurrence à la complétion

### Tri
- Tri par : date d'ajout / priorité / date d'échéance / retard / statut
- Ordre croissant ou décroissant
- Tâches sans date = fin de liste

### Tâches terminées
- Section dédiée accessible depuis les stats ("Terminées")
- `showDone` — les tâches terminées sont masquées de la liste principale par défaut

### Export / Import
- Export agenda .ics 📅 — compatible Apple Calendar / Google Calendar

### Auth & Compte
- Firebase Auth Google 🔑
- Connexion email/mot de passe (login + register + reset)
- Avatar utilisateur — photo stockée Firebase Storage, éditable
- Pseudo utilisateur — éditable
- Affichage initiale dans le cercle utilisateur
- Déconnexion via clic sur avatar → menu déroulant
- Connexion Apple via Firebase Auth (code prêt, config externe manquante)
- Connexion Facebook via Firebase Auth (code prêt, config externe manquante)

### Sync & Persistance
- Firestore sync 🔄 — temps réel multi-appareils
- Règles de sécurité Firestore — lecture/écriture limitée à l'utilisateur authentifié

### Pièces jointes
- Upload pièces jointes sur tâches perso (Firebase Storage)
- Upload pièces jointes sur tâches équipe (Firebase Storage)
- Suppression avec confirmation

### Notifications
- Firebase Cloud Messaging — service worker enregistré, token FCM généré
- Notification quotidienne — heure configurable (`dailyNotifEnabled` + `dailyNotifTime`)
- Handler foreground (`onMessage`)

### Mode équipe
- Création d'équipe
- Invitation par email
- Rôles : admin / co-admin / membre
- Gestion membres (promouvoir, rétrograder, expulser)
- Dissolution et renommage d'équipe
- Tâches équipe (Firestore temps réel)
- Modifications en attente (non-admin → admin valide)
- Tâches masquables aux membres (`memberVisible`)
- Statistiques équipe et par membre
- Chat équipe (groupe + DMs privés, réponses, édition, suppression, upload fichiers, non-lus)

### Design & Thèmes
- 12 thèmes : 6 dark (Nuit, Forêt, Braise, Océan, Encre, Améthyste) + 6 light (Cognac, Papier, Sauge, Terracotta, Ciel, Lavande)
- 5 polices texte (Inter, DM Mono, Space Mono, Courier, Roboto Mono)
- 7 polices titre (Playfair Display, Cormorant, Syne, Bebas Neue, Oswald, Rajdhani, Orbitron)
- Logo — favicon.svg personnalisé (3 bulles + coche, fond dégradé orange) + PWA icon

### Layout & UX
- Layout mobile responsive — header 2 lignes, panels en colonne, scroll indépendant
- Header mobile — boutons toujours visibles (pas d'empilage)
- Drag & drop souris + touch (long press 250ms)
- Ghost circulaire immédiat dès le début du glissement
- Tâche future glissée dans Aujourd'hui → couleur dorée immédiate

### Monétisation
- Bandeau pub AdSense placeholder (728×90) — remplacer `ADSENSE_CLIENT` et `ADSENSE_SLOT` dans App.jsx dès approbation du compte

### Infrastructure
- Monorepo (npm workspaces + Turborepo)
- Package `@task-tracker/shared` — constantes + utilitaires partagés
- Structure app Electron (apps/desktop) en place
- Tests E2E Playwright — 114 tests (Desktop, Tablet, Mobile, Perso, Équipe)

---

## 🔜 À faire — Web App

### 📱 Mobile
- [ ] **Scroll sans drag** — augmenter le long press (actuellement 250ms) pour mieux différencier scroll et drag
- [ ] **Boutons Supprimer / Dupliquer** — agrandir les zones tactiles, trop petites actuellement

### 📱🖥️ Les deux
- [ ] **Charte graphique** — formaliser (base : thème Cognac, Playfair Display, DM Mono)
- [ ] **Refonte UI récurrence** — supprimer "chaque année le" ; hebdo → sélecteur jour semaine ; mensuel → deux sélecteurs indépendants (jour semaine + date mois)
- [ ] **Bouton "Ajouter" figé** — rester visible en haut du bloc tâches pendant le scroll
- [ ] **Configurer Auth Apple** — developer.apple.com → Sign In with Apple + activer dans console Firebase
- [ ] **Configurer Auth Facebook** — developers.facebook.com → Facebook Login + activer dans console Firebase

### Fonctionnalités futures
- [ ] Autres langues (EN, ES, etc.) — fichier de traductions + sélecteur dans paramètres
- [ ] Assignation de tâche à un autre membre de l'équipe
- [ ] Modèle freemium — gratuit avec pub, abonnement pour supprimer pub + features pro (features pro à définir)

---

## 🖥️ À faire — App Desktop (Electron)
- [ ] Finaliser le build Electron (`apps/desktop`)
- [ ] Auto-updater
- [ ] Distribution macOS + Windows

---

## 📱 À faire — App Native

- [ ] Alarme système — déclencher une vraie alarme via l'horloge du téléphone
- [ ] Sync agenda automatique — suppression dans Apple/Google Calendar quand tâche supprimée ou terminée
- [ ] Notification par mail — Resend (~20€/mois pour 50k mails)
- [ ] Vrai bandeau pub AdMob — remplacer le placeholder
- [ ] Outlook / Microsoft To Do — intégration via Microsoft Graph API + Azure
- [ ] Soumission App Store (compte Apple 99€/an)
- [ ] Soumission Play Store (compte Google 25€ unique) — voir [PLAY-STORE.md](PLAY-STORE.md) pour la checklist complète de la console

---

## 💡 Notes techniques
- Stack : React 18 + Vite + Firebase + Vercel
- PWA : manifest.json + service worker
- Auth : Firebase Auth (Google + Email actifs ; Apple + Facebook prêts)
- DB : Firestore (sync temps réel actif)
- Storage : Firebase Storage (avatars + pièces jointes)
- Messaging : Firebase Cloud Messaging (notifications push)
- URL : task-tracker-alpha-teal.vercel.app
- Clé API Firebase restreinte aux APIs nécessaires + domaines autorisés configurés
- Mail future : Resend
- Pub : Google AdSense (web) / AdMob (natif)
