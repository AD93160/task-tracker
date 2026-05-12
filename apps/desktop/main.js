const { app, BrowserWindow, shell, ipcMain, session, protocol, net } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Doit être appelé AVANT app.whenReady()
// Enregistre app:// comme un scheme standard+sécurisé pour la fenêtre principale.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const isDev = !app.isPackaged;

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

// Démarre un serveur HTTP local sur un port aléatoire pour servir l'app
// depuis http://localhost:PORT — scheme http accepté par Firebase Auth.
function startLocalAuthServer() {
  const wwwPath = path.resolve(path.join(__dirname, "www"));
  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript",
    ".css":  "text/css",
    ".json": "application/json",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".woff2":"font/woff2",
    ".woff": "font/woff",
    ".ttf":  "font/ttf",
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = new URL(req.url, "http://localhost").pathname;
      let filePath = path.resolve(path.join(wwwPath, urlPath));

      // Sécurité : empêcher path traversal
      if (!filePath.startsWith(wwwPath + path.sep) && filePath !== wwwPath) {
        res.writeHead(403); res.end("Forbidden"); return;
      }

      // SPA fallback : tout chemin inexistant → index.html
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(wwwPath, "index.html");
      } catch {
        filePath = path.join(wwwPath, "index.html");
      }

      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(500); res.end("Internal Error"); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port });
    });
    server.on("error", reject);
  });
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

ipcMain.handle("google-auth", async () => {
  // En production, démarre un serveur HTTP local pour que Firebase Auth accepte
  // le scheme http://localhost (le scheme app:// est rejeté par le handler Firebase).
  let localServer = null;
  let authUrl;

  if (isDev) {
    authUrl = "http://localhost:5173/#electron-auth";
  } else {
    const { server, port } = await startLocalAuthServer();
    localServer = server;
    authUrl = `http://localhost:${port}/#electron-auth`;
  }

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

    // Flux redirect : authWin navigue directement vers Google (pas de popup Firebase).
    // Les éventuels window.open() sont ouverts dans le navigateur système.
    authWin.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    authWin.loadURL(authUrl);

    let settled = false;

    const cleanup = () => {
      if (localServer) { localServer.close(); localServer = null; }
    };

    const onToken = (e, data) => {
      if (e.sender !== authWin.webContents) return;
      if (settled) return;
      settled = true;
      ipcMain.removeListener("auth-token", onToken);
      cleanup();
      authWin.close();
      if (data.error) reject(new Error(data.error));
      else resolve({ idToken: data.idToken, accessToken: data.accessToken });
    };
    ipcMain.on("auth-token", onToken);

    authWin.on("closed", () => {
      if (!settled) {
        settled = true;
        ipcMain.removeListener("auth-token", onToken);
        cleanup();
        reject(new Error("auth/popup-closed-by-user"));
      }
    });
  });
});

app.whenReady().then(() => {
  // Sert les fichiers locaux via app://localhost/ pour la fenêtre principale.
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
