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
const { getFirestore }            = require("firebase-admin/firestore");
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
  const appUrl     = process.env.APP_URL || "https://task-tracker-2ea82.web.app/?join=true";

  if (!serviceId || !templateId || !publicKey) {
    throw new HttpsError("internal", "Configuration email manquante.");
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:  serviceId,
      template_id: templateId,
      user_id:     publicKey,
      template_params: {
        to_email:   toEmail,
        team_name:  teamName.slice(0, 50),
        invited_by: invitedBy.slice(0, 100),
        app_url:    appUrl,
      },
    }),
  });

  if (!res.ok) {
    throw new HttpsError("internal", "Erreur lors de l'envoi de l'email.");
  }

  return { success: true };
});
