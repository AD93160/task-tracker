/**
 * Génère les visuels de la fiche Google Play à partir de l'app réelle.
 *
 *   node scripts/generate-screenshots.mjs
 *
 * Lance un serveur Vite avec les mocks Firebase (vite.config.test.js), injecte
 * un jeu de données de démo, puis capture les écrans clés.
 *
 * Sorties dans store-assets/ :
 *   phone-*.jpg    1080×1820 — captures téléphone, min. 2 exigées
 *   tablet-*.jpg   1640×2256 — captures tablette, requises pour être mis en
 *                              avant par Google
 *   (Google demande 320–3840 px, la plus grande dimension ne dépassant pas
 *    le double de la plus petite : les deux formats sont conformes.)
 *   feature-graphic.jpg 1024×500     — image de présentation, obligatoire
 *
 * Format JPEG volontaire : Google exige un PNG 24 bits sans canal alpha, or
 * Chromium produit du RGBA. Le JPEG évite le rejet et reste accepté partout.
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT  = resolve(ROOT, "store-assets");
const PORT = 5177;
const BASE = `http://localhost:${PORT}`;
const EXEC = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

mkdirSync(OUT, { recursive: true });

/* ── Données de démo ─────────────────────────────────────────────── */

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = day(0), TOMORROW = day(1);

const task = (id, num, title, priority, status, due, notes = "") =>
  ({ id, num, title, priority, status, due, notes, notify: true, recurrence: "none", completion: null, attachments: [] });

const DEMO = {
  "users/test-uid-123": {
    pseudo: "Camille",
    allTeamIds: ["team-1"],
    teamId: "team-1",
    blockedUsers: [],
    taskCounter: 8,
    locale: "fr-FR",
    tasks: [
      task(1, 1, "Finaliser la maquette du dashboard", "Haute",   "En cours", TODAY, "Revoir la hiérarchie visuelle"),
      task(2, 2, "Appeler le comptable",               "Moyenne", "À faire",  TODAY),
      task(3, 3, "Relire le contrat de prestation",    "Haute",   "À faire",  TOMORROW),
      task(4, 4, "Préparer la réunion hebdomadaire",   "Moyenne", "À faire",  TOMORROW),
      task(5, 5, "Envoyer la facture 2026-08",         "Haute",   "À faire",  day(2)),
      task(6, 6, "Commander les fournitures",          "Basse",   "À faire",  day(5)),
      task(7, 7, "Mettre à jour le portfolio",         "Moyenne", "À faire",  ""),
      { ...task(8, 8, "Sauvegarder les projets", "Basse", "Terminé", day(-1)),
        completion: { doneAt: Date.now(), doneDate: day(-1), color: "#6bcb77", deltaMin: -120, deltaLabel: "2 h d'avance" } },
    ],
    todayIds: [1, 2],
    todayDates: { 1: TODAY, 2: TODAY },
    tomorrowIds: [{ id: 3, addedDate: TODAY }, { id: 4, addedDate: TODAY }],
    scheduledIds: [],
    highlighted: [],
  },
  "teams/team-1": {
    name: "Studio Nord",
    adminUid: "test-uid-123",
    adminEmail: "camille@studionord.fr",
    coAdminUids: ["uid-lea"],
    taskCounter: 4,
    members: [
      { uid: "test-uid-123", email: "camille@studionord.fr", displayName: "Camille" },
      { uid: "uid-lea",      email: "lea@studionord.fr",     displayName: "Léa"     },
      { uid: "uid-marc",     email: "marc@studionord.fr",    displayName: "Marc"    },
    ],
  },
  "teams/team-1/tasks": [
    { id: "t1", num: 1, title: "Livrer les visuels du client Aurore", priority: "Haute",   status: "En cours", due: TODAY,    notes: "", createdBy: "test-uid-123", createdByEmail: "camille@studionord.fr", memberVisible: true, attachments: [] },
    { id: "t2", num: 2, title: "Valider la charte typographique",     priority: "Moyenne", status: "À faire",  due: TOMORROW, notes: "", createdBy: "uid-lea",      createdByEmail: "lea@studionord.fr",     memberVisible: true, attachments: [] },
    { id: "t3", num: 3, title: "Devis refonte site vitrine",          priority: "Haute",   status: "À faire",  due: day(3),   notes: "", createdBy: "test-uid-123", createdByEmail: "camille@studionord.fr", memberVisible: true, attachments: [] },
    { id: "t4", num: 4, title: "Archiver les projets du trimestre",   priority: "Basse",   status: "Terminé",  due: day(-2),  notes: "", createdBy: "uid-marc",     createdByEmail: "marc@studionord.fr",    memberVisible: true, attachments: [] },
  ],
  "teams/team-1/pendingChanges": [],
  "teams/team-1/deletedTasks": [],
  "teams/team-1/messages": [
    { id: "m1", text: "Les visuels Aurore partent ce soir 👌", authorUid: "uid-lea",      authorName: "Léa",     authorEmail: "lea@studionord.fr" },
    { id: "m2", text: "Parfait. Marc, tu as le retour sur la typo ?", authorUid: "test-uid-123", authorName: "Camille", authorEmail: "camille@studionord.fr" },
    { id: "m3", text: "Oui, ils valident la Playfair pour les titres.", authorUid: "uid-marc", authorName: "Marc",    authorEmail: "marc@studionord.fr" },
    { id: "m4", text: "Nickel, je bascule la maquette dessus.", authorUid: "test-uid-123", authorName: "Camille", authorEmail: "camille@studionord.fr" },
    { id: "m5", text: "J'ai ajouté la tâche pour le devis Aurore, échéance lundi.", authorUid: "uid-lea", authorName: "Léa", authorEmail: "lea@studionord.fr" },
    { id: "m6", text: "Vu, je m'en occupe demain matin.", authorUid: "uid-marc", authorName: "Marc", authorEmail: "marc@studionord.fr" },
    { id: "m7", text: "Pensez à cocher vos tâches en fin de journée 🙂", authorUid: "test-uid-123", authorName: "Camille", authorEmail: "camille@studionord.fr" },
    { id: "m8", text: "Toujours 💪", authorUid: "uid-lea", authorName: "Léa", authorEmail: "lea@studionord.fr" },
    { id: "m9", text: "La refonte du site vitrine, on la cale en septembre ?", authorUid: "uid-marc", authorName: "Marc", authorEmail: "marc@studionord.fr" },
    { id: "m10", text: "Oui, je bloque une demi-journée la semaine prochaine pour le cadrage.", authorUid: "test-uid-123", authorName: "Camille", authorEmail: "camille@studionord.fr" },
  ],
};

/* ── Utilitaires de capture ──────────────────────────────────────── */

async function newPage(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.route("https://pagead2.googlesyndication.com/**", r => r.abort());
  await page.route("https://fonts.googleapis.com/**", r => r.abort());
  await page.route("https://fonts.gstatic.com/**", r => r.abort());
  await page.addInitScript(d => {
    window.__testFirestoreData = d;
    // Évite la bannière « App desktop disponible » par-dessus les captures
    localStorage.setItem("tt_dl_done", "true");
  }, DEMO);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await hideAdSlot(page);
  return page;
}

/** Rend invisible le cadre « ESPACE PUBLICITAIRE » : aucune annonce n'est
 *  diffusée, l'afficher dans une capture Store serait trompeur autant
 *  qu'inesthétique. `visibility` et non `display` : le bandeau occupe 50 px en
 *  bas de page, le retirer du flux décale toute la mise en page. */
async function hideAdSlot(page) {
  await page.evaluate(() => {
    document.querySelectorAll("span").forEach(s => {
      if (s.textContent.trim() === "ESPACE PUBLICITAIRE") {
        const box = s.closest("div");
        if (box) box.style.visibility = "hidden";
      }
    });
  });
}

/**
 * Capture en s'arrêtant juste au-dessus du bandeau publicitaire.
 * Il occupe 50 px en bas de page, n'affiche rien en production, et l'app y
 * repeint un double du header en largeur tablette — rien de tout cela n'a sa
 * place sur une fiche Store.
 */
async function shot(page, name) {
  await hideAdSlot(page);
  await page.waitForTimeout(250);
  const cut = await page.evaluate(() => {
    const span = [...document.querySelectorAll("span")]
      .find(s => s.textContent.trim() === "ESPACE PUBLICITAIRE");
    const box = span?.closest("div");
    return box ? Math.round(box.getBoundingClientRect().top) : window.innerHeight;
  });
  const { width } = page.viewportSize();
  await page.screenshot({
    path: resolve(OUT, `${name}.jpg`),
    type: "jpeg",
    quality: 92,
    clip: { x: 0, y: 0, width, height: cut },
  });
  console.log(`✓ ${name}.jpg — ${width * 2}×${cut * 2}`);
}

const goTeam  = (page) => page.locator("button").filter({ hasText: "Studio" }).first().click({ force: true });
const goPerso = (page) => page.locator("button").filter({ hasText: "Camille" }).first().click({ force: true });

/* ── Image de présentation ───────────────────────────────────────── */

// 1024×500. Google recadre et superpose des éléments sur certains emplacements :
// le contenu utile reste loin des bords.
const FEATURE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1024px; height:500px; overflow:hidden;
    background: radial-gradient(120% 140% at 12% 0%, #5FD097 0%, #4FC287 42%, #35996A 100%);
    font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display:flex; align-items:center; gap:52px; padding:0 88px; position:relative;
  }
  /* Coches en filigrane, très discrètes */
  .veil { position:absolute; inset:0; opacity:0.07; }
  .mark { width:168px; height:168px; flex-shrink:0; filter:drop-shadow(0 10px 26px rgba(0,0,0,0.22)); position:relative; }
  .copy { position:relative; }
  h1 { font-size:82px; font-weight:800; color:#fff; letter-spacing:-2.5px; line-height:1;
       text-shadow:0 3px 16px rgba(0,0,0,0.16); }
  p  { font-size:29px; color:#f2fbf6; margin-top:16px; font-weight:500; letter-spacing:-0.3px;
       text-shadow:0 2px 10px rgba(0,0,0,0.14); }
  .tags { display:flex; gap:11px; margin-top:26px; }
  .tag { font-size:16px; color:#fff; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.34);
         padding:7px 15px; border-radius:999px; font-weight:600; backdrop-filter:blur(2px); }
</style></head><body>
  <svg class="veil" viewBox="0 0 1024 500" preserveAspectRatio="none">
    <g stroke="#fff" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 812,92 L 840,116 L 892,64"/>
      <path d="M 916,232 L 944,256 L 996,204"/>
      <path d="M 762,372 L 790,396 L 842,344"/>
    </g>
  </svg>
  <svg class="mark" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="230" fill="#ffffff"/>
    <path d="M 268,210 L 268,814" stroke="#35996A" stroke-width="78" stroke-linecap="round" fill="none"/>
    <path d="M 282,512 L 440,330 L 585,330" stroke="#4FC287" stroke-width="78"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M 745,330 L 578,242 L 578,418 Z" fill="#4FC287"/>
    <path d="M 282,512 L 440,694 L 585,694" stroke="#35996A" stroke-width="78"
          stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M 745,694 L 578,606 L 578,782 Z" fill="#35996A"/>
  </svg>
  <div class="copy">
    <h1>Kewa</h1>
    <p>Vos tâches, seul ou en équipe.</p>
    <div class="tags">
      <span class="tag">Sync temps réel</span>
      <span class="tag">Équipes &amp; chat</span>
      <span class="tag">12 thèmes</span>
    </div>
  </div>
</body></html>`;

/* ── Serveur de développement ────────────────────────────────────── */

const server = spawn("npx", ["vite", "--config", "vite.config.test.js", "--port", String(PORT)],
  { cwd: ROOT, stdio: "ignore" });

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`Le serveur Vite n'a pas démarré sur ${BASE}`);
}

/* ── Captures ────────────────────────────────────────────────────── */

try {
  await waitForServer();
  const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});

  // Téléphone — 540×960 @2x, recadré au-dessus du bandeau pub.
  // Une page neuve par capture : fermer un panneau laisse un voile qui
  // assombrit l'écran suivant et intercepte les clics.
  const PHONE = [540, 960], TABLET = [820, 1180];

  const shots = [
    ["phone-1-perso",      PHONE,  async () => {}],
    ["phone-2-formulaire", PHONE,  async (page) => {
      await page.getByRole("button", { name: /Ajouter/ }).first().click({ force: true });
      await page.waitForTimeout(700);
      await page.getByPlaceholder("Titre...").fill("Préparer le brief client");
      await page.waitForTimeout(200);
    }],
    ["phone-3-equipe",     PHONE,  async (page) => { await goTeam(page); await page.waitForTimeout(1400); }],
    ["phone-4-chat",       PHONE,  async (page) => {
      await goTeam(page);
      await page.waitForTimeout(1400);
      await page.locator("button[title='Messagerie équipe']").first().click({ force: true });
      await page.waitForTimeout(1400);
    }],
    ["phone-5-stats",      PHONE,  async (page) => {
      await page.getByRole("button", { name: "📊" }).first().click({ force: true });
      await page.waitForTimeout(800);
    }],
    ["phone-6-themes",     PHONE,  async (page) => {
      await page.getByRole("button", { name: "⚙️" }).first().click({ force: true });
      await page.waitForTimeout(800);
    }],
    ["tablet-1-perso",     TABLET, async () => {}],
    ["tablet-2-equipe",    TABLET, async (page) => { await goTeam(page); await page.waitForTimeout(1400); }],
  ];

  for (const [name, [w, h], setup] of shots) {
    const page = await newPage(browser, w, h);
    await setup(page);
    await shot(page, name);
    await page.close();
  }

  // Image de présentation — 1024×500, obligatoire sur la fiche
  {
    const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 2 });
    await page.setContent(FEATURE_HTML, { waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(OUT, "feature-graphic.jpg"), type: "jpeg", quality: 95 });
    console.log("✓ feature-graphic.jpg");
    await page.close();
  }

  await browser.close();
  console.log(`\nVisuels écrits dans store-assets/`);
} finally {
  server.kill();
}
