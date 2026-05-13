const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  // Lance la fenêtre d'auth Google dédiée, retourne l'idToken Firebase
  startGoogleAuth: () => ipcRenderer.invoke("google-auth"),
  // Appelé par la fenêtre d'auth pour renvoyer le token au processus principal
  sendAuthToken: (data) => ipcRenderer.send("auth-token", data),
  // Notifie le renderer quand une mise à jour est disponible
  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
  // Ouvre une URL dans le navigateur système
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
