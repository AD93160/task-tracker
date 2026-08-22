/**
 * Firebase Cloud Functions — Task Tracker Pro
 *
 * Envoie des push notifications FCM quand l'app est fermée :
 *   - onNewPendingChange : notifie les admins/co-admins quand un membre soumet une proposition
 *   - onNewTeamTask      : notifie les membres quand une nouvelle tâche équipe est créée
 *
 * Déploiement :
 *   firebase deploy --only functions --project task-tracker-2ea82
 *
 * Prérequis : plan Firebase Blaze (pay-as-you-go)
 */

const { onDocumentCreated }       = require("firebase-functions/v2/firestore");
const { onCall, HttpsError }      = require("firebase-functions/v2/https");
const { initializeApp }           = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth }                 = require("firebase-admin/auth");
const { getStorage }              = require("firebase-admin/storage");
const { getMessaging }            = require("firebase-admin/messaging");

initializeApp();

const REGION = "us-central1";

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

/** Récupère le FCM token d'un utilisateur depuis Firestore. */
async function getFcmToken(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? (snap.data().fcmToken || null) : null;
}

/** Envoie un multicast FCM. Ignore les tokens invalides (erreurs non bloquantes). */
async function sendMulticast(tokens, notification, data = {}) {
  if (!tokens.length) return;
  const messaging = getMessaging();
  await messaging.sendEachForMulticast({
    tokens,
    notification,
    data,
    webpush: { fcmOptions: { link: "/" } },
  });
}

/* ─────────────────────────────────────────────────────────────
   1) Nouvelle proposition d'un membre → notifie admins/co-admins
───────────────────────────────────────────────────────────── */

exports.onNewPendingChange = onDocumentCreated(
  { document: "teams/{teamId}/pendingChanges/{changeId}", region: REGION },
  async (event) => {
    const db = getFirestore();
    const change   = event.data.data();
    const { teamId } = event.params;

    // Récupère le document équipe
    const teamSnap = await db.collection("teams").doc(teamId).get();
    if (!teamSnap.exists) return;
    const team = teamSnap.data();

    // UIDs des admins/co-admins, sauf le proposant
    const recipientUids = [
      team.adminUid,
      ...(team.coAdminUids || []),
    ].filter(uid => uid && uid !== change.proposedBy);

    if (!recipientUids.length) return;

    // Collecte les FCM tokens
    const tokens = (
      await Promise.all(recipientUids.map(uid => getFcmToken(db, uid)))
    ).filter(Boolean);

    if (!tokens.length) return;

    const proposer  = change.proposedByEmail || "Un membre";
    const teamName  = team.name || "l'équipe";

    await sendMulticast(
      tokens,
      {
        title: "Modification proposée 🔔",
        body:  `${proposer} a soumis une proposition pour ${teamName}.`,
        icon:  "/favicon.svg",
      },
      { tag: "team-pending", teamId }
    );
  }
);

/* ─────────────────────────────────────────────────────────────
   2) Nouvelle tâche équipe créée → notifie les membres
───────────────────────────────────────────────────────────── */

exports.onNewTeamTask = onDocumentCreated(
  { document: "teams/{teamId}/tasks/{taskId}", region: REGION },
  async (event) => {
    const db = getFirestore();
    const task     = event.data.data();
    const { teamId } = event.params;

    // Récupère le document équipe
    const teamSnap = await db.collection("teams").doc(teamId).get();
    if (!teamSnap.exists) return;
    const team = teamSnap.data();

    // Réunit admins, co-admins et membres sans doublons
    const memberUids = (team.members || []).map(m => m.uid);
    const adminUids  = [
      team.adminUid,
      ...(team.coAdminUids || []),
    ].filter(Boolean);
    const allUids = [...new Set([...adminUids, ...memberUids])];

    if (!allUids.length) return;

    // Collecte les FCM tokens (respecte notifyUsers si défini)
    const tokens = (
      await Promise.all(
        allUids.map(async uid => {
          if (task.notifyUsers && task.notifyUsers[uid] === false) return null;
          return getFcmToken(db, uid);
        })
      )
    ).filter(Boolean);

    if (!tokens.length) return;

    const teamName = team.name || "l'équipe";

    await sendMulticast(
      tokens,
      {
        title: "Nouvelle tâche équipe 📋",
        body:  `${task.title || "Nouvelle tâche"} — ${teamName}`,
        icon:  "/favicon.svg",
      },
      { tag: "team-task", teamId }
    );
  }
);

/* ─────────────────────────────────────────────────────────────
   3) Envoi d'email d'invitation via EmailJS (clés côté serveur)
   Variables d'environnement requises (functions/.env ou Firebase Console) :
     EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, APP_URL
───────────────────────────────────────────────────────────── */

exports.sendInviteEmail = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }

  const { toEmail, teamName, invitedBy } = request.data;

  if (!toEmail || typeof toEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(toEmail)) {
    throw new HttpsError("invalid-argument", "Adresse email invalide.");
  }
  if (!teamName || typeof teamName !== "string" || teamName.length > 50) {
    throw new HttpsError("invalid-argument", "Nom d'équipe invalide.");
  }
  if (!invitedBy || typeof invitedBy !== "string" || invitedBy.length > 200) {
    throw new HttpsError("invalid-argument", "Expéditeur invalide.");
  }

  const serviceId  = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  const appUrl     = process.env.APP_URL || "https://task-tracker-2ea82.web.app/?join=true";

  if (!serviceId || !templateId || !publicKey) {
    throw new HttpsError("internal", "Configuration email manquante.");
  }
  // EmailJS bloque les appels hors navigateur : la clé privée (accessToken) est
  // obligatoire pour les appels serveur (Cloud Functions), sinon réponse 403.
  if (!privateKey) {
    throw new HttpsError("internal", "Clé privée EmailJS manquante (EMAILJS_PRIVATE_KEY).");
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:  serviceId,
      template_id: templateId,
      user_id:     publicKey,
      accessToken: privateKey,
      template_params: {
        to_email:   toEmail,
        team_name:  teamName.slice(0, 50),
        invited_by: invitedBy.slice(0, 100),
        app_url:    appUrl,
      },
    }),
  });

  if (!res.ok) {
    // Remonter le détail EmailJS dans les logs pour faciliter le diagnostic.
    const detail = await res.text().catch(() => "");
    console.error("EmailJS send failed:", res.status, detail);
    throw new HttpsError("internal", `Erreur lors de l'envoi de l'email (EmailJS ${res.status}).`);
  }

  return { success: true };
});

/* ─────────────────────────────────────────────────────────────
   4) Suppression de compte (RGPD + exigence Google Play)

   Google Play impose un parcours de suppression de compte accessible
   depuis l'app ET depuis une URL publique. Cette fonction fait la partie
   serveur : elle a besoin des droits Admin pour supprimer le compte Auth
   et pour toucher aux documents d'équipe que le client n'a pas le droit
   de modifier.

   Politique appliquée :
     - données personnelles (profil, tâches, corbeille, avatar, PJ perso) → suppression
     - contenu d'équipe (tâches, commentaires, messages) → anonymisation,
       pour ne pas trouer l'historique des autres membres
     - équipe dont le partant est le seul admin → transfert automatique,
       ou dissolution s'il était le dernier membre
───────────────────────────────────────────────────────────── */

const ANON_NAME = "Utilisateur supprimé";
/** Un compte laissé ouvert sur un appareil partagé ne doit pas pouvoir être supprimé. */
const REAUTH_MAX_AGE_S = 10 * 60;

/** Exécute des écritures Firestore par lots (limite dure : 500 opérations par lot). */
async function commitInBatches(db, ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 400)) {
      if (op.del) batch.delete(op.ref);
      else batch.update(op.ref, op.patch);
    }
    await batch.commit();
  }
}

/**
 * Anonymise les messages d'un fil de discussion (chat de groupe ou DM).
 * Les citations (`replyTo`) embarquent le nom de l'auteur cité mais pas son uid :
 * on les retrouve via l'id du message d'origine.
 */
async function anonymizeMessages(db, colRef, uid) {
  const snap = await colRef.get();
  if (snap.empty) return 0;

  const mine = new Set(snap.docs.filter((d) => d.data().authorUid === uid).map((d) => d.id));
  const ops = [];

  for (const d of snap.docs) {
    const m = d.data();
    const patch = {};
    if (m.authorUid === uid) {
      patch.authorUid   = null;
      patch.authorName  = ANON_NAME;
      patch.authorEmail = "";
    }
    if (m.replyTo && mine.has(m.replyTo.id)) {
      patch["replyTo.authorName"] = ANON_NAME;
    }
    if (Object.keys(patch).length) ops.push({ ref: d.ref, patch });
  }

  await commitInBatches(db, ops);
  return ops.length;
}

/**
 * Anonymise les tâches d'équipe créées par l'utilisateur.
 * L'UI affiche `members.find(uid === createdBy)?.displayName || createdByEmail`,
 * donc mettre `createdBy` à null et `createdByEmail` au libellé anonyme suffit
 * à afficher « Utilisateur supprimé » sans toucher au composant.
 */
async function anonymizeTasks(db, colRef, uid) {
  const snap = await colRef.where("createdBy", "==", uid).get();
  if (snap.empty) return 0;
  await commitInBatches(
    db,
    snap.docs.map((d) => ({
      ref: d.ref,
      patch: {
        createdBy: null,
        createdByEmail: ANON_NAME,
        ...(d.data().hiddenBy === uid ? { hiddenBy: null } : {}),
      },
    }))
  );
  return snap.size;
}

exports.deleteAccount = onCall(
  { region: REGION, timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentification requise.");
    }

    const uid   = request.auth.uid;
    const email = (request.auth.token.email || "").toLowerCase();

    const authTime = Number(request.auth.token.auth_time || 0);
    if (!authTime || Math.floor(Date.now() / 1000) - authTime > REAUTH_MAX_AGE_S) {
      throw new HttpsError(
        "failed-precondition",
        "Pour des raisons de sécurité, reconnecte-toi avant de supprimer ton compte."
      );
    }

    const db      = getFirestore();
    const bucket  = getStorage().bucket();
    const summary = { teamsLeft: 0, teamsTransferred: 0, teamsDissolved: 0, docsAnonymized: 0 };

    const userRef  = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const teamIds  = userSnap.exists ? (userSnap.data().allTeamIds || []) : [];

    /* ── 1) Équipes ──────────────────────────────────────────── */
    for (const teamId of teamIds) {
      const teamRef  = db.collection("teams").doc(teamId);
      const teamSnap = await teamRef.get();
      if (!teamSnap.exists) continue;

      const team     = teamSnap.data();
      const members  = (team.members || []).filter((m) => m.uid !== uid);
      const coAdmins = (team.coAdminUids || []).filter((u) => u !== uid);
      const isAdmin  = team.adminUid === uid;

      // Seul admin et dernier membre → l'équipe n'a plus de raison d'exister
      if (isAdmin && members.length === 0) {
        await db.recursiveDelete(teamRef);
        await bucket.deleteFiles({ prefix: `teams/${teamId}/` }).catch((e) => {
          console.error(`Storage cleanup failed for team ${teamId}:`, e);
        });
        summary.teamsDissolved++;
        continue;
      }

      if (isAdmin) {
        // Promotion du premier co-admin encore présent, sinon du membre le plus ancien
        const promoted = members.find((m) => coAdmins.includes(m.uid)) || members[0];
        await teamRef.update({
          adminUid:    promoted.uid,
          adminEmail:  promoted.email || "",
          coAdminUids: coAdmins.filter((u) => u !== promoted.uid),
          members,
        });
        summary.teamsTransferred++;
      } else {
        await teamRef.update({ members, coAdminUids: coAdmins });
        summary.teamsLeft++;
      }

      await teamRef.collection("memberStats").doc(uid).delete().catch(() => {});

      // Les propositions en attente sont des brouillons, pas de l'historique → suppression
      const pending = await teamRef.collection("pendingChanges").where("proposedBy", "==", uid).get();
      await commitInBatches(db, pending.docs.map((d) => ({ ref: d.ref, del: true })));

      summary.docsAnonymized += await anonymizeTasks(db, teamRef.collection("tasks"), uid);
      summary.docsAnonymized += await anonymizeTasks(db, teamRef.collection("deletedTasks"), uid);

      // Commentaires : parcours tâche par tâche, une requête de groupe de collections
      // exigerait un index de portée « collection group » à provisionner à part.
      for (const taskRef of await teamRef.collection("tasks").listDocuments()) {
        const comments = await taskRef.collection("comments").where("authorUid", "==", uid).get();
        await commitInBatches(
          db,
          comments.docs.map((d) => ({
            ref: d.ref,
            patch: { authorUid: null, authorName: ANON_NAME, authorEmail: "" },
          }))
        );
        summary.docsAnonymized += comments.size;
      }

      summary.docsAnonymized += await anonymizeMessages(db, teamRef.collection("messages"), uid);

      // DM : le doc de conversation n'existe pas forcément, seule la sous-collection
      // `messages` est écrite — listDocuments() renvoie quand même la référence.
      for (const convRef of await teamRef.collection("dms").listDocuments()) {
        if (!convRef.id.split("_").includes(uid)) continue;
        summary.docsAnonymized += await anonymizeMessages(db, convRef.collection("messages"), uid);
      }

      // Retire l'utilisateur des notifications par tâche (map indexée par uid)
      const notified = await teamRef.collection("tasks").get();
      await commitInBatches(
        db,
        notified.docs
          .filter((d) => (d.data().notifyUsers || {})[uid] !== undefined)
          .map((d) => ({ ref: d.ref, patch: { [`notifyUsers.${uid}`]: FieldValue.delete() } }))
      );
    }

    /* ── 2) Invitation en attente adressée à cet email ───────── */
    if (email) {
      await db.collection("invitations").doc(email).delete().catch(() => {});
    }

    /* ── 3) Fichiers personnels (avatar + pièces jointes perso) ─ */
    await bucket.deleteFiles({ prefix: `users/${uid}/` }).catch((e) => {
      console.error(`Storage cleanup failed for user ${uid}:`, e);
    });

    /* ── 4) Profil (contient aussi tâches, corbeille, jeton FCM) ─ */
    await db.recursiveDelete(userRef);

    /* ── 5) Compte Auth — en dernier : tant qu'il existe, un échec
           intermédiaire laisse l'utilisateur relancer l'opération ── */
    await getAuth().deleteUser(uid);

    console.log(`Account ${uid} deleted:`, JSON.stringify(summary));
    return { success: true, ...summary };
  }
);
