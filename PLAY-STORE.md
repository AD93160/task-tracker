# Kewa — Guide de publication Google Play

> État du repo au moment de la rédaction : `apps/mobile/` est vide (placeholder), aucun
> `.aab` n'existe encore, aucune politique de confidentialité n'est publiée.
> Ce document couvre **la console Play** (ce qui peut être rempli tout de suite) et
> **les bloquants techniques** (ce qu'il faut produire avant de pouvoir envoyer une version).

---

## 0. Bloquants identifiés

| # | Bloquant | Où ça bloque dans la console | État |
|---|---|---|---|
| 1 | **Aucun `.aab`** | Onglet *Versions* : rien à envoyer | ✅ projet Capacitor + workflow `build-android.yml` — reste à fournir keystore et `google-services.json` |
| 2 | **Pas de politique de confidentialité** en ligne | *Contenu de l'application → Règles de confidentialité* (URL obligatoire) | ✅ `public/privacy.html` |
| 3 | **Pas d'URL de suppression de compte** | *Sécurité des données* (obligatoire dès qu'il y a des comptes) | ✅ `public/delete-account.html` + Cloud Function `deleteAccount` — reste l'adresse de contact à renseigner |
| 4 | **Icônes PNG absentes** — `public/manifest.json` ne déclare qu'un SVG | Icône Play 512×512 PNG + requis pour un build TWA | ✅ `store-assets/play-icon-512.png` |
| 5 | **Compte de test à fournir** — l'app est derrière un login Firebase | *Accès à l'application* | ⚠️ à créer |
| 6 | **Nom « Kewa »** — vérifier qu'aucune app/marque ne le porte déjà | Fiche Play Store | ⚠️ à vérifier |

---

## 1. Compte développeur (à faire avant tout le reste)

- Frais d'inscription : **25 $ une fois**, non remboursables.
- **Type de compte** : personnel ou organisation. Une organisation exige un **numéro D-U-N-S**
  (gratuit, mais 5 à 30 jours de délai). Un compte personnel n'en a pas besoin → si tu es en
  personnel, reste en personnel, le changement de type après coup est pénible.
- **Vérification d'identité** : pièce d'identité + adresse. Google peut envoyer un courrier
  postal de vérification. À lancer immédiatement, c'est le poste le plus lent.
- **Adresse e-mail et numéro de contact publics** : ils seront visibles sur ta fiche Play Store.
  Utilise une adresse dédiée (`contact@…`), pas ton adresse perso principale.
- **Test fermé obligatoire (comptes personnels)** : un compte personnel doit faire tourner un
  **test fermé avec 12 testeurs opt-in pendant 14 jours consécutifs** avant de pouvoir demander
  l'accès à la production. Le compteur ne démarre que quand les 12 testeurs sont réellement
  inscrits — commence à recruter maintenant (famille, amis, collègues), c'est 2 semaines de
  délai incompressible.
  > La console affiche l'exigence exacte qui s'applique à ton compte dans
  > *Tests → Test fermé → Accès à la production*. Fie-toi à ce qu'elle affiche.

---

## 2. Créer l'application

*Toutes les applications → Créer une application*

| Champ | Valeur pour Kewa |
|---|---|
| Nom de l'application | `Kewa` (30 caractères max) |
| Langue par défaut | Français (France) |
| App ou jeu | **Application** |
| Gratuite ou payante | **Gratuite** — ⚠️ passer de gratuit à payant est **impossible** après publication (l'inverse est possible) |
| Déclarations | Cocher règles du programme + lois US export |

**Nom du package** (défini dans le build, pas dans la console, et **définitif à vie**) :
`com.kewa.app` — cohérent avec l'appId Electron `com.kewa.desktop` déjà utilisé dans
`apps/desktop/electron-builder.yml`.

---

## 3. Configurer votre application (checklist du tableau de bord)

### 3.1 Règles de confidentialité — ❌ bloquant
URL publique, accessible sans login, sur un domaine que tu contrôles.
Prévu : `https://<domaine-kewa>/privacy.html`.
Elle doit nommer explicitement : Firebase Auth, Firestore, Firebase Storage, Firebase Cloud
Messaging, les Cloud Functions, EmailJS (utilisé dans `functions/index.js`) et, le jour où la
pub est activée, AdMob/AdSense.

### 3.2 Accès à l'application — ⚠️
Kewa est **intégralement derrière un login** : sans identifiants, le relecteur Google voit un
écran de connexion et **rejette la version**.
→ Choisir « *Un accès restreint est nécessaire* » et fournir un compte de démo :

```
Nom des identifiants : Compte de test Kewa
E-mail    : review@<domaine>            (compte email/mot de passe Firebase)
Mot de passe : <mot de passe dédié>
Instructions : Se connecter avec e-mail/mot de passe. Le bouton Google n'est pas
               utilisable par le relecteur. Le mode Équipe est accessible via le
               switcher Perso/Équipe du header.
```
Pré-remplis ce compte avec quelques tâches et une équipe de démo, sinon le relecteur tombe sur
une app vide.

### 3.3 Annonces
Le placeholder AdSense (`ADSENSE_CLIENT` dans `src/App.jsx`) n'affiche rien, et la balise
script qui contactait Google à chaque visite a été retirée de `index.html`.
→ Aujourd'hui : **« Non, mon application ne contient pas d'annonces »**.
→ ⚠️ À rebasculer sur « Oui » **le jour même** où tu actives AdMob/AdSense — une déclaration
fausse est un motif de suspension.

### 3.4 Classification du contenu (questionnaire IARC)
Catégorie : **Utilitaire / Productivité / Communication**.
Réponses attendues pour Kewa : pas de violence, pas de contenu sexuel, pas de drogue, pas de
jeu d'argent.
⚠️ **Point sensible** : Kewa contient un **chat d'équipe** (`src/TeamChat.jsx`, groupe + DM +
upload de fichiers). Le questionnaire demande si les utilisateurs peuvent **interagir /
échanger du contenu** → répondre **Oui**. Le nier est un motif de suspension immédiate.
Réponds aussi « oui » au partage de fichiers entre utilisateurs.

### 3.5 Public cible et contenu
- Tranche d'âge : **18 ans et plus** (ou 13+ minimum). N'inclus **pas** les moins de 13 ans :
  ça déclencherait la *Families Policy*, incompatible avec un chat libre et de la pub.
- « Votre application attire-t-elle les enfants ? » → **Non**.

### 3.6 Contenu généré par les utilisateurs (UGC)
Le chat + les pièces jointes = UGC. Google exige alors :
- un **moyen de signaler** un contenu ou un utilisateur abusif,
- un **moyen de bloquer** un utilisateur,
- une **modération** (au minimum : suppression sur signalement).

✅ **En place** : le menu contextuel d'un message propose « Signaler » (4 motifs, écrit dans la
collection `reports`) et « Bloquer ». Un auteur bloqué voit ses messages remplacés par
« Message masqué », et les DM avec lui sont impossibles. La modération se fait depuis la
console Firebase — pense à consulter la collection `reports` régulièrement, Google peut
demander comment tu traites les signalements.

### 3.7 Les autres déclarations
| Déclaration | Réponse |
|---|---|
| Application d'actualités | Non |
| Applications gouvernementales | Non |
| Produits financiers | Non |
| Santé | Non |
| Applications de rencontre | Non |

---

## 4. Sécurité des données (Data safety) — le gros morceau

Section *Contenu de l'application → Sécurité des données*. Elle doit correspondre **exactement**
au code, Google audite. Voici la grille pour Kewa telle que le code se comporte aujourd'hui.

**Questions générales**
- Votre application collecte-t-elle des données utilisateur ? → **Oui**
- Toutes les données sont-elles **chiffrées en transit** ? → **Oui** (HTTPS/TLS partout via Firebase)
- Les utilisateurs peuvent-ils **demander la suppression de leurs données** ? → **Oui**
  → une **URL de suppression de compte** est alors obligatoire (bloquant n°3)

**Types de données à déclarer**

| Type | Pourquoi | Collectée | Partagée | Obligatoire | Finalité |
|---|---|---|---|---|---|
| Nom | `userPseudo` | Oui | Non | Facultatif | Fonctionnalité, Gestion du compte |
| Adresse e-mail | Firebase Auth, invitations d'équipe | Oui | Non | Obligatoire | Fonctionnalité, Gestion du compte |
| Photos | avatar (`userPhotoURL`) + pièces jointes images | Oui | Non | Facultatif | Fonctionnalité |
| Fichiers et documents | pièces jointes tâches perso/équipe | Oui | Non | Facultatif | Fonctionnalité |
| Messages in-app | chat équipe (groupe + DM) | Oui | Non | Facultatif | Fonctionnalité |
| Autres actions utilisateur | tâches, notes, échéances (Firestore) | Oui | Non | Facultatif | Fonctionnalité |
| ID de l'appareil | jeton FCM (notifications push) | Oui | Non | Facultatif | Fonctionnalité (notifications) |

**À ne surtout pas déclarer** (l'app ne les touche pas) : position, contacts, agenda, SMS,
santé, données financières, historique de navigation, données d'installation d'apps.

**À ajouter le jour où la pub s'active** : *ID publicitaire* → collecté **et partagé** avec
Google, finalité **Publicité ou marketing**. Et repasser la section 3.3 sur « Oui ».

**Aucune analytics** n'est branchée (pas de `getAnalytics` dans `src/firebase.js`) → ne déclare
aucune finalité « Analyses ». Si tu ajoutes Firebase Analytics plus tard, la grille change.

---

## 5. Fiche Play Store principale

| Élément | Contrainte | À produire |
|---|---|---|
| Nom | 30 caractères | `Kewa` |
| Description courte | 80 caractères | ex. « Vos tâches, seul ou en équipe. Simple, rapide, synchronisé. » |
| Description complète | 4 000 caractères | tâches, récurrence, corbeille, équipe, chat, PJ, 12 thèmes, sync temps réel |
| Icône | **512 × 512 PNG 32 bits**, avec alpha, < 1 Mo | ✅ `store-assets/play-icon-512.png` |
| Image de présentation | **1024 × 500 PNG/JPG**, obligatoire | ✅ `store-assets/feature-graphic.jpg` |
| Captures téléphone | **min. 2**, max. 8 · côté 320–3840 px | ✅ 6 captures 1080×1816 dans `store-assets/` |
| Captures tablette 7" et 10" | facultatives, mais **requises pour être mis en avant** par Google | ✅ 2 captures 1640×2256 |
| Vidéo YouTube | facultative | non |

Les visuels sont régénérables à volonté : `node scripts/generate-screenshots.mjs` relance
l'app avec un jeu de démo et réécrit tout `store-assets/`. Modifie les données de démo en tête
du script pour changer ce qui apparaît à l'écran.

⚠️ **Pas de mots interdits** dans le titre ni la description courte : ni « n°1 », ni « meilleur »,
ni « gratuit », ni emoji dans le titre, ni mention d'une autre marque (Google Tasks, Todoist…).

---

## 6. Parcours des versions

```
Test interne  →  Test fermé  →  Test ouvert  →  Production
(instantané)     (12 testeurs      (facultatif)    (après validation
                  / 14 jours)                       de l'accès prod)
```

1. **Test interne** — jusqu'à 100 testeurs, disponible en quelques minutes. C'est là qu'on
   valide que le build fonctionne, avant de brûler les 14 jours du test fermé.
2. **Test fermé** — les fameux 12 testeurs / 14 jours pour un compte personnel. Crée une liste
   d'e-mails dans *Tests → Test fermé → Testeurs*. Chaque testeur doit **accepter l'invitation
   et installer l'app**, sinon il ne compte pas.
3. **Accès à la production** — formulaire à remplir une fois les 14 jours écoulés (Google
   demande ce que les testeurs ont remonté et comment tu en as tenu compte).
4. **Production** — déploiement progressif possible (20 % → 50 % → 100 %).

**Signature** : laisse **Play App Signing** activé (par défaut). Google conserve la clé de
signature ; tu ne fournis qu'une clé d'upload. Sauvegarde ton keystore d'upload **hors du
repo** — s'il est perdu, il faut demander une réinitialisation à Google.

**Format** : `.aab` (Android App Bundle) obligatoire, l'`.apk` est refusé pour une nouvelle app.

**Target API level** : Google impose un niveau d'API minimum pour toute nouvelle app, relevé
chaque 31 août. Vérifie la valeur exigée dans la console avant de builder — un `targetSdk`
trop bas fait rejeter l'upload immédiatement.

---

## 7. Produire le `.aab` — les deux voies

`apps/mobile/` est vide, il faut choisir.

### Voie A — TWA (Trusted Web Activity) via Bubblewrap / PWABuilder
Emballe la PWA déjà en ligne dans une coquille Android.

- ✅ Quelques heures de travail, une seule base de code, mises à jour instantanées (tu déploies
  sur Vercel, l'app est à jour sans passer par Google)
- ❌ Zéro accès natif : pas d'alarme système, pas d'AdMob, pas de sync agenda — soit
  **tout le bloc « À faire — App Native » de la roadmap reste hors de portée**
- ⚠️ Prérequis : `assetlinks.json` servi sur `https://<domaine>/.well-known/assetlinks.json`,
  manifest PWA complet avec icônes PNG 192 et 512, service worker avec fallback hors-ligne
- ⚠️ Un simple wrapper de site web sans valeur ajoutée est refusé par Google ; une vraie PWA
  installable passe, mais mieux vaut un **domaine propre** qu'une URL `*.vercel.app`

### Voie B — Capacitor
Coquille native avec accès aux plugins Android.

- ✅ Débloque AdMob, notifications locales/alarmes, partage natif, accès agenda → toute la
  roadmap native
- ✅ Réutilise le même build Vite (`npx cap add android`, `npx cap sync`)
- ❌ Plus de travail : Android Studio, gestion du projet natif, un build à refaire et
  re-soumettre à chaque mise à jour
- ⚠️ Firebase Auth Google exige la configuration du SHA-1/SHA-256 de la clé de signature dans
  la console Firebase, sinon la connexion Google échoue dans l'app native

**Recommandation** : vu la roadmap (alarme système, AdMob, sync agenda), **Capacitor**. La voie
TWA est le bon choix uniquement si l'objectif est d'être sur le Store le plus vite possible et
que les fonctions natives peuvent attendre une v2 — mais changer de voie après coup impose de
garder le même nom de package et de gérer la migration.

---

## 7 bis. Produire l'AAB — mode d'emploi

Le projet Capacitor est en place (`apps/mobile/android`, appId `com.kewa.app`,
targetSdk 36). Il reste quatre choses à fournir, qui ne peuvent venir que de toi.

### 1. Déclarer l'app Android dans Firebase
Console Firebase → ⚙️ *Paramètres du projet* → *Tes applications* → **Ajouter une app Android**
- Nom du package : `com.kewa.app` (exactement, il est définitif)
- Télécharge le `google-services.json` produit

### 2. Créer le keystore d'upload
```bash
keytool -genkeypair -v -keystore kewa-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias kewa
```
⚠️ **Sauvegarde ce fichier et son mot de passe hors du dépôt.** Il est gitignoré, et
le perdre impose une demande de réinitialisation auprès de Google.

Récupère ensuite ses empreintes et **colle-les dans la console Firebase** (app Android →
*Empreintes de certificat SHA*), sinon la connexion Google échouera sur mobile :
```bash
keytool -list -v -keystore kewa-upload.jks -alias kewa | grep -E "SHA1|SHA256"
```

### 3. Le client OAuth « Web »
La connexion Google native a besoin de l'ID client **Web** du projet (pas l'Android) :
console Google Cloud → *API et services* → *Identifiants* → client OAuth de type
« Application Web ». C'est le secret `VITE_GOOGLE_WEB_CLIENT_ID`.

### 4. Les secrets GitHub
*Settings → Secrets and variables → Actions* :

| Secret | Contenu |
|---|---|
| `VITE_GOOGLE_WEB_CLIENT_ID` | l'ID client Web ci-dessus |
| `ANDROID_GOOGLE_SERVICES_JSON` | `base64 -w0 google-services.json` |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 kewa-upload.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `kewa` |
| `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Les six secrets `VITE_FIREBASE_*` existent déjà pour le build Electron.

### 5. Lancer le build
Onglet *Actions* → **Build Android** → *Run workflow*, en saisissant la version affichée
(`1.0.0`) et le version code (`1`). L'AAB signé est déposé en artefact du run.

⚠️ Le **version code** doit être un entier strictement croissant à chaque envoi sur la
Play Console. Un renvoi avec le même code est refusé.

---

## 8. Ordre de travail conseillé

**En parallèle, dès maintenant (délais externes) :**
1. Lancer la vérification d'identité du compte développeur
2. Recruter les 12 testeurs du test fermé
3. Réserver un nom de domaine propre (utile pour la politique de confidentialité, les
   assetlinks TWA et la crédibilité de la fiche)

**À faire pendant que ça mûrit (aucune dépendance) :**
4. Politique de confidentialité + page de suppression de compte, déployées
5. Icône 512×512, image de présentation 1024×500, captures d'écran
6. Fiche Play Store, classification du contenu, public cible, sécurité des données
7. Compte de test pour le relecteur + données de démo

**Ensuite, le chemin critique :**
8. Choisir la voie de packaging (§7) et produire le premier `.aab`
9. Test interne → vérifier login Google, push FCM, upload de PJ sur appareil réel
10. Test fermé 14 jours → demande d'accès à la production → publication

---

## 9. Ce qui manque encore côté code

- [x] Icônes PNG 192 / 512 / maskable + icône Play 512 + `public/manifest.json` complété
- [x] Suppression de compte : Cloud Function `deleteAccount` (perso supprimé, contenu d'équipe
      anonymisé, transfert d'admin automatique) + parcours in-app + `public/delete-account.html`
- [x] Éditeur et adresse de contact renseignés (Adrien Scognamillo · tasktpro.2026@gmail.com)
- [ ] **Créer la boîte `tasktpro.2026@gmail.com`** — l'adresse est déjà publiée dans les deux pages
- [ ] Déployer sur Vercel pour que `/privacy.html` et `/delete-account.html` soient en ligne
- [ ] Déployer la Cloud Function : `firebase deploy --only functions --project task-tracker-2ea82`
- [x] `public/privacy.html` — politique de confidentialité + liens légaux dans les Paramètres
- [x] Signalement / blocage d'utilisateur dans `TeamChat.jsx` (exigence UGC, §3.6)
- [ ] Déployer les règles Firestore : `firebase deploy --only firestore:rules --project task-tracker-2ea82`
- [x] `apps/mobile/` — projet Capacitor Android (Capacitor 8, targetSdk 36)
- [ ] Générer le keystore d'upload et le stocker hors du dépôt
- [ ] SHA-1 / SHA-256 de la clé d'upload ajoutés dans la console Firebase
- [ ] Télécharger `google-services.json` depuis Firebase (app Android `com.kewa.app`)
- [ ] Renseigner les 5 secrets GitHub du workflow Android
