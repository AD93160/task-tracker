const { app, BrowserWindow, shell, ipcMain, session, protocol, net } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Doit être appelé AVANT app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const isDev = !app.isPackaged;

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function serveLocal(request) {
  const url = new URL(request.url);
  const wwwPath = path.resolve(path.join(__dirname, "www"));
  const resolved = path.resolve(path.join(wwwPath, url.pathname));
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

// ─── OAuth via navigateur système ────────────────────────────────────────────
// Google bloque le flux OAuth dans les fenêtres Electron embarquées.
// Solution : ouvrir le navigateur système + serveur HTTP local pour le callback.

function startCallbackServer() {
  let resolveCallback, rejectCallback;
  const callbackPromise = new Promise((res, rej) => {
    resolveCallback = res;
    rejectCallback = rej;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/callback") {
      // Page qui lit l'URL complète (fragment inclus) et la renvoie via POST
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Task Tracker — Connexion</title>
        <style>body{font-family:sans-serif;display:flex;align-items:center;
          justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff;
          flex-direction:column;gap:12px}</style>
      </head><body>
        <p id="s">Connexion en cours…</p>
        <script>
          fetch('/done',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({url:location.href})})
            .then(()=>document.getElementById('s').textContent='✓ Connecté ! Vous pouvez fermer cet onglet.')
            .catch(()=>document.getElementById('s').textContent='Erreur — réessayez.');
        </script>
      </body></html>`);
      return;
    }

    if (url.pathname === "/done" && req.method === "POST") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        try {
          const { url: callbackUrl } = JSON.parse(body);
          resolveCallback(callbackUrl);
          res.writeHead(200); res.end("OK");
        } catch (e) {
          rejectCallback(e);
          res.writeHead(500); res.end("Error");
        }
      });
      return;
    }

    res.writeHead(404); res.end("Not Found");
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port, callbackPromise });
    });
    server.on("error", reject);
  });
}

async function createAuthUri(apiKey, continueUri) {
  const resp = await net.fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "google.com",
        continueUri,
        providerId: "google.com",
        oauthScopes: "email profile openid",
      }),
    }
  );
  const data = await resp.json();
  if (!data.authUri) throw new Error(data.error?.message || "createAuthUri a échoué");
  return { authUri: data.authUri, sessionId: data.sessionId };
}

async function signInWithIdp(apiKey, requestUri, sessionId) {
  const resp = await net.fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestUri,
        sessionId,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return {
    idToken: data.oauthIdToken || null,
    accessToken: data.oauthAccessToken || null,
  };
}

// Timeout de 10 min — libère les ressources si l'utilisateur abandonne
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

ipcMain.handle("google-auth", async (_event, { apiKey }) => {
  const { server, port, callbackPromise } = await startCallbackServer();

  try {
    const continueUri = `http://localhost:${port}/callback`;
    const { authUri, sessionId } = await createAuthUri(apiKey, continueUri);

    // Ouvre le navigateur système — pas de détection Electron par Google
    shell.openExternal(authUri);

    // Attend le callback ou timeout
    const callbackUrl = await Promise.race([
      callbackPromise,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("auth/timeout")), AUTH_TIMEOUT_MS)
      ),
    ]);

    return await signInWithIdp(apiKey, callbackUrl, sessionId);
  } finally {
    server.close();
  }
});

app.whenReady().then(() => {
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
