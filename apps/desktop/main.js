const { app, BrowserWindow, shell, ipcMain, session } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

// User agent Chrome — requis pour que Google accepte l'OAuth (Electron est bloqué par Google)
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 820,
    minHeight: 600,
    title: "Task Tracker",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Pas de sandbox — nécessaire pour signInWithCredential après auth
    },
  });

  // Tous les liens externes s'ouvrent dans le navigateur système
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "www", "index.html"));
  }

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[Electron] Échec chargement (${code} ${desc}) : ${url}`);
  });
}

// Ouvre une fenêtre d'auth dédiée avec user agent Chrome et sans sandbox
ipcMain.handle("google-auth", (event) => {
  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 500,
      height: 650,
      title: "Connexion — Task Tracker",
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        // Pas de sandbox — postMessage entre popup et opener doit fonctionner
      },
    });

    authWin.webContents.setUserAgent(CHROME_UA);

    // Autoriser la popup Google OAuth depuis la fenêtre d'auth
    authWin.webContents.setWindowOpenHandler(({ url }) => {
      if (
        url.includes("accounts.google.com") ||
        url.includes("firebaseapp.com/__/auth")
      ) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 500,
            height: 650,
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
            },
          },
        };
      }
      shell.openExternal(url);
      return { action: "deny" };
    });

    const authUrl = isDev
      ? "http://localhost:5173/#electron-auth"
      : `file://${path.join(__dirname, "www", "index.html")}#electron-auth`;

    authWin.loadURL(authUrl);

    let settled = false;

    const onToken = (e, data) => {
      if (e.sender !== authWin.webContents) return;
      if (settled) return;
      settled = true;
      ipcMain.removeListener("auth-token", onToken);
      authWin.close();
      if (data.error) reject(new Error(data.error));
      else resolve(data.idToken);
    };
    ipcMain.on("auth-token", onToken);

    authWin.on("closed", () => {
      if (!settled) {
        settled = true;
        ipcMain.removeListener("auth-token", onToken);
        reject(new Error("auth/popup-closed-by-user"));
      }
    });
  });
});

app.whenReady().then(() => {
  // User agent Chrome pour toute la session (popups incluses)
  session.defaultSession.setUserAgent(CHROME_UA);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
