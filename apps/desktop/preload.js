const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  // apiKey transmis depuis le renderer pour éviter de stocker les vars d'env dans le process main
  startGoogleAuth: (apiKey) => ipcRenderer.invoke("google-auth", { apiKey }),
  // Conservé pour compatibilité (plus utilisé avec le flux navigateur système)
  sendAuthToken: (data) => ipcRenderer.send("auth-token", data),
});
