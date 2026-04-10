// Service Worker Firebase Cloud Messaging
// Gère les notifications push quand l'app est fermée ou en arrière-plan.
// Doit rester à la racine /public (servi sur /firebase-messaging-sw.js).

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

let messaging = null;

// La config Firebase est transmise depuis App.jsx via postMessage
self.addEventListener("message", (event) => {
  if (event.data?.type !== "FIREBASE_CONFIG") return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(event.data.config);
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon } = payload.notification || {};
      self.registration.showNotification(title || "Task Tracker", {
        body: body || "",
        icon: icon || "/favicon.svg",
        badge: "/favicon.svg",
        tag: payload.data?.tag || "task-tracker",
      });
    });
  } catch(e) { console.warn("[SW] Firebase init:", e); }
});

// Clic notification → focus ou ouvre l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type:"window", includeUncontrolled:true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
      }
      return clients.openWindow(self.location.origin);
    })
  );
});
