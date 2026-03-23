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

---

## 🔜 À faire — Web App (prochaines sessions)

### Fonctionnalités
- [ ] **1. Dupliquer une tâche** — rouvre formulaire pré-rempli (nom/priorité/statut), nouvelle échéance à choisir
- [ ] **2. Récurrence** — quotidien / hebdo / mensuel, recrée la tâche automatiquement une fois terminée
- [ ] **4. Export agenda (.ics)** — bouton "Ajouter à l'agenda" sur chaque tâche avec date, génère un fichier .ics compatible Apple Calendar / Google Calendar

### Compte utilisateur & sync
- [ ] Firebase Auth — connexion Google / Apple / Facebook
- [ ] Firestore — base de données, sync multi-appareils
- [ ] Chaque utilisateur a ses propres tâches

### Monétisation
- [ ] Modèle freemium — gratuit avec pub, abonnement pour supprimer pub + features pro
- [ ] Définir les features pro (à préciser)

---

## 📱 À faire — App Native (Capacitor — après validation web app)

- [ ] **3. Alarme système** — déclencher une vraie alarme via l'horloge du téléphone
- [ ] **4. Sync agenda** — suppression automatique dans Apple/Google Calendar quand tâche supprimée ou terminée
- [ ] **5. Notification par mail** — EmailJS ou Resend, l'utilisateur entre son adresse mail (Resend recommandé pour scale)
- [ ] **Vrai bandeau pub AdMob** — remplacer le placeholder par Google AdMob
- [ ] Soumission App Store (compte Apple 99€/an)
- [ ] Soumission Play Store (compte Google 25€ unique)

---

## 💡 Notes techniques
- Stack : React + Vite + Vercel
- PWA : manifest.json + service worker
- Auth future : Firebase Auth
- DB future : Firestore
- Mail future : Resend (~20€/mois pour 50k mails)
- Pub : Google AdMob (intégration Capacitor)
