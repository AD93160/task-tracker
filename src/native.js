/**
 * Passerelle vers les fonctionnalités natives Android (Capacitor).
 *
 * Deux mécanismes du web ne fonctionnent pas dans une WebView native :
 *   - `signInWithPopup` : pas de fenêtre popup, Google la refuse de toute façon
 *   - FCM web (service worker + clé VAPID) : pas de service worker exploitable
 *
 * Ce module fournit l'équivalent natif des deux. Les plugins sont chargés en
 * import dynamique : sur le web, rien n'est téléchargé.
 */

import { Capacitor } from "@capacitor/core";

/** true dans l'app Android empaquetée, false sur le web et dans Electron. */
export const isNativeApp = () => Capacitor.isNativePlatform();

/** "android" | "ios" | "web" */
export const nativePlatform = () => Capacitor.getPlatform();

let socialLoginReady = false;

/**
 * Ouvre la fenêtre Google native et renvoie l'idToken.
 * L'appelant le convertit en credential Firebase, exactement comme le fait
 * déjà le chemin Electron — l'instance Firebase JS reste la seule source de
 * vérité pour la session.
 */
export async function nativeGoogleIdToken() {
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error("VITE_GOOGLE_WEB_CLIENT_ID manquant : connexion Google indisponible.");
  }

  const { SocialLogin } = await import("@capgo/capacitor-social-login");

  if (!socialLoginReady) {
    // Le client web OAuth est celui du projet Firebase : c'est lui qui permet
    // à Firebase d'accepter l'idToken émis côté Android.
    await SocialLogin.initialize({ google: { webClientId } });
    socialLoginReady = true;
  }

  const res = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"] },
  });

  const idToken = res?.result?.idToken;
  if (!idToken) throw new Error("Connexion Google annulée.");
  return idToken;
}

/**
 * Enregistre l'appareil auprès de FCM et remonte le jeton.
 * Le jeton a le même format que celui du web : les Cloud Functions d'envoi
 * n'ont pas besoin d'être modifiées.
 *
 * @param {(token: string) => void} onToken
 * @param {(title: string, body: string, tag: string) => void} onForeground
 * @returns {Promise<() => void>} fonction de nettoyage
 */
export async function setupNativePush(onToken, onForeground) {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return () => {};

  const handles = [
    await PushNotifications.addListener("registration", ({ value }) => {
      if (value) onToken(value);
    }),
    await PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error:", err);
    }),
    // Notification reçue app au premier plan : Android ne l'affiche pas seul
    await PushNotifications.addListener("pushNotificationReceived", (notif) => {
      const { title, body, data } = notif || {};
      if (title) onForeground(title, body || "", data?.tag || "fcm");
    }),
  ];

  await PushNotifications.register();

  return () => { handles.forEach(h => h.remove()); };
}
