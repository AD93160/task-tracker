// Service Worker Firebase Cloud Messaging
// Ce fichier DOIT rester à la racine de /public (chemin /firebase-messaging-sw.js)
// Il gère les notifications push reçues quand l'app est fermée ou en arrière-plan.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// La config est injectée dynamiquement depuis App.jsx via postMessage après l'enregistrement.
// En attendant, on initialise avec des valeurs vides et on les met à jour à réception.
let messaging = null;

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(event.data.config);
      }
      messaging = firebase.messaging();

      // Gestionnaire des messages en arrière-plan
      messaging.onBackgroundMessage((payload) => {
        const { title, body, icon } = payload.notification || {};
        self.registration.showNotification(title || "Task Tracker", {
          body: body || "",
          icon: icon || "/favicon.svg",
          badge: "/favicon.svg",
          tag: payload.data?.tag || "task-tracker",
          requireInteraction: false,
          data: payload.data || {},
        });
      });
    } catch (e) {
      console.warn("[SW] Firebase init error:", e);
    }
  }
});

// Clic sur une notification : ouvre/focus l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(self.location.origin);
    })
  );
});
