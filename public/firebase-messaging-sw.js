// Service Worker Firebase Cloud Messaging
// Gère les notifications push quand l'app est fermée ou en arrière-plan.
// Doit rester à la racine /public (servi sur /firebase-messaging-sw.js).

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const CACHE = "tt-sw-cfg-v1";
const KEY   = "firebase-config";

// Reçoit la config Firebase depuis App.jsx et la met en cache.
// L'ancienne approche initialisait Firebase ici et enregistrait onBackgroundMessage,
// ce qui ne fonctionnait pas au redémarrage du SW (app fermée) car ce message
// n'arrivait jamais. Le push event est désormais géré directement ci-dessous.
self.addEventListener("message", event => {
  if (event.data?.type !== "FIREBASE_CONFIG") return;
  caches.open(CACHE)
    .then(c => c.put(KEY, new Response(JSON.stringify(event.data.config), {
      headers: { "Content-Type": "application/json" },
    })))
    .catch(() => {});
});

// Gère les push FCM quand l'app est fermée ou en arrière-plan.
// Le handler est enregistré de façon synchrone au démarrage du SW,
// donc il est toujours actif quelle que soit l'origine du réveil.
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};
    try { payload = event.data?.json() ?? {}; } catch (e) {}

    const n = payload.notification ?? {};
    const d = payload.data ?? {};

    await self.registration.showNotification(n.title || "Task Tracker", {
      body:  n.body  || "",
      icon:  n.icon  || "/favicon.svg",
      badge: "/favicon.svg",
      tag:   d.tag   || "task-tracker",
    });
  })());
});

// Clic notification → focus ou ouvre l'app
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
      }
      return clients.openWindow(self.location.origin);
    })
  );
});
