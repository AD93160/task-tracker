const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  // Lance la fenêtre d'auth Google dédiée, retourne l'idToken Firebase
  startGoogleAuth: () => ipcRenderer.invoke("google-auth"),
  // Appelé par la fenêtre d'auth pour renvoyer le token au processus principal
  sendAuthToken: (data) => ipcRenderer.send("auth-token", data),
});
