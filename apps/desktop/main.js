const { app, BrowserWindow, shell, ipcMain, session, protocol, net } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Doit être appelé AVANT app.whenReady()
// Enregistre app:// comme un scheme standard+sécurisé : les pages chargées sur
// app://localhost/ ont l'hostname "localhost", accepté par Firebase Auth.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const isDev = !app.isPackaged;

const MIME = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff",
};

// Démarre un serveur HTTP local sur un port aléatoire pour servir le dossier www.
// Nécessaire pour que Firebase Auth accepte l'origine (http://localhost est autorisé,
// app://localhost ne l'est pas pour signInWithPopup).
function startLocalServer() {
  const wwwPath = path.resolve(__dirname, "www");
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0].split("#")[0];
      const resolved = path.resolve(path.join(wwwPath, urlPath));
      if (!resolved.startsWith(wwwPath + path.sep) && resolved !== wwwPath) {
        res.writeHead(403); res.end(); return;
      }
      fs.readFile(resolved, (err, data) => {
        if (err) {
          fs.readFile(path.join(wwwPath, "index.html"), (err2, html) => {
            if (err2) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
          });
          return;
        }
        const mime = MIME[path.extname(resolved)] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function serveLocal(request) {
  const url = new URL(request.url);
  const wwwPath = path.resolve(path.join(__dirname, "www"));
  const resolved = path.resolve(path.join(wwwPath, url.pathname));
  // Sécurité : empêcher les path traversal (../../etc)
  if (!resolved.startsWith(wwwPath + path.sep) && resolved !== wwwPath) {
    return new Response("Forbidden", { status: 403 });
  }
  return net.fetch("file://" + resolved).catch(() =>
    net.fetch("file://" + path.join(wwwPath, "index.html"))
  );
}

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
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadURL("app://localhost/index.html");
  }

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[Electron] Échec chargement (${code} ${desc}) : ${url}`);
  });
}

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
      },
    });

    authWin.webContents.setUserAgent(CHROME_UA);

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
      : "app://localhost/index.html#electron-auth";

    authWin.loadURL(authUrl);

    let settled = false;

    const onToken = (e, data) => {
      if (e.sender !== authWin.webContents) return;
      if (settled) return;
      settled = true;
      ipcMain.removeListener("auth-token", onToken);
      authWin.close();
      if (data.error) reject(new Error(data.error));
      else resolve({ idToken: data.idToken, accessToken: data.accessToken });
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
  // Sert les fichiers locaux via app://localhost/ pour que Firebase Auth
  // voie l'hostname "localhost" (domaine autorisé par défaut dans Firebase)
  protocol.handle("app", serveLocal);

  session.defaultSession.setUserAgent(CHROME_UA);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
