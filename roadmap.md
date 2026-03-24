# Task Tracker — Roadmap

## ✅ Fait
- App déployée sur Vercel
- PWA installable sur iPhone
- localStorage — tâches persistantes par appareil
- Bandeau pub placeholder (728×90)
- Tâches de démo supprimées
- Formulaire bottom sheet mobile / modale centrée desktop
- Clic sur tâche = ouvre modification
- Icône calendrier adaptée au thème sombre/clair
- Nom app : Task Tracker
- inputs fontSize 16px (no zoom iOS)
- Dupliquer une tâche ⧉
- Récurrence — quotidien / hebdo / mensuel / jour fixe du mois / date fixe annuelle 🔁
- Export agenda .ics 📅 — compatible Apple Calendar / Google Calendar
- Thème Hermès + mode clair par défaut
- Firebase Auth Google 🔑
- Firestore sync 🔄 — temps réel multi-appareils
- Layout mobile responsive — header empilé, panels en colonne, scroll indépendant
- Règles de sécurité Firestore — lecture/écriture limitée à l'utilisateur authentifié
- Nettoyage des fichiers dupliqués et obsolètes à la racine
- Logo de l'app — favicon.svg personnalisé + PWA icon
- Boutons Connexion retravaillés — logos Google / Apple / Facebook + icône 🚪 déconnexion
- Renommer le thème "Hermès" → "Cognac"
- Drag → bulle immédiate — ghost circulaire dès le début du glissement
- Tâche future glissée dans Aujourd'hui → couleur dorée immédiate
- Connexion Apple via Firebase Auth
- Connexion Facebook via Firebase Auth
- Connexion email/mot de passe

---

## 🔜 À faire — Prochaine session

### 📱 Mobile uniquement
- [ ] **Scroll sans drag** — allonger la durée de pression (long press) pour différencier scroll et drag & drop
- [ ] **Boutons Supprimer / Dupliquer** — agrandir, trop petits sur mobile
- [ ] **Header mobile** — garder les boutons Connexion, Stats et Réglages à droite (ne pas les empiler)

### 🖥️ Desktop uniquement
_(rien)_

### 📱🖥️ Les deux

- [ ] **Création logo App** — identité visuelle de l'application
- [ ] **Charte graphique** — définir couleurs et polices officielles de l'app
- [ ] **Monétiser le bandeau pub** — intégrer Google AdSense ou AdMob web
- [ ] **Tâches terminées** — les faire disparaître de la liste principale + section dédiée accessible via "Terminées" dans les stats, triables par numéro de bulle (défaut) ou date de réalisation
- [ ] **Système de tri des tâches** (bloc droit) — trier par : date d'ajout / priorité / date d'échéance (si dans aujourd'hui ou demain sans date = pris en compte) / retard / statut — ordre croissant ou décroissant — tâches sans date et non planifiées = fin de liste
- [ ] **Déconnexion via nom utilisateur** — supprimer le bouton 🚪, remplacer par un clic sur le nom utilisateur → menu avec "Se déconnecter"
- [ ] **Afficher uniquement l'initiale** dans le cercle utilisateur (au lieu du nom complet) — comme le comportement Google
- [ ] **Configurer Auth Apple et Facebook** — activer dans la console Firebase + configurer les app IDs
- [ ] **Refonte récurrence** — supprimer "tous les X du mois" et "chaque année le" et le bouton "Aucune" — Hebdo → menu déroulant jours de la semaine — Mensuel → deux menus : jour de la semaine + date du mois (indépendants, remise à zéro possible) — gérer "3e mercredi du mois" (semaine ordinale + jour)
- [ ] **Bouton "Ajouter" figé** — rester visible en haut du bloc tâches pendant le scroll

---

## 🔜 À faire — Web App (sessions suivantes)

### Fonctionnalités
- [ ] Autres langues (EN, ES, etc.) — fichier de traductions + sélecteur dans paramètres
- [ ] Notifications push programmées à une heure précise
- [ ] Assignation de tâche à un autre utilisateur (mode collaboratif)

### Monétisation
- [ ] Modèle freemium — gratuit avec pub, abonnement pour supprimer pub + features pro
- [ ] Définir les features pro (à préciser)

---

## 📱 À faire — App Native (Capacitor — après validation web app)

- [ ] Alarme système — déclencher une vraie alarme via l'horloge du téléphone
- [ ] Sync agenda automatique — suppression dans Apple/Google Calendar quand tâche supprimée ou terminée
- [ ] Notification par mail — Resend (~20€/mois pour 50k mails)
- [ ] Vrai bandeau pub AdMob — remplacer le placeholder
- [ ] Outlook / Microsoft To Do — intégration via Microsoft Graph API + Azure
- [ ] Soumission App Store (compte Apple 99€/an)
- [ ] Soumission Play Store (compte Google 25€ unique)

---

## 💡 Notes techniques
- Stack : React + Vite + Vercel
- PWA : manifest.json + service worker
- Auth : Firebase Auth (Google actif)
- DB : Firestore (sync temps réel actif)
- URL : task-tracker-alpha-teal.vercel.app
- Clé API Firebase restreinte aux APIs nécessaires + domaines autorisés configurés
- Mail future : Resend
- Pub : Google AdMob (intégration Capacitor)
