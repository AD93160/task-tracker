/**
 * Génère les icônes PNG à partir de public/favicon.svg via Chromium (Playwright).
 *
 *   node scripts/generate-icons.mjs
 *
 * Sorties :
 *   public/icon-192.png            — PWA, coins arrondis (purpose "any")
 *   public/icon-512.png            — PWA, coins arrondis (purpose "any")
 *   public/icon-maskable-512.png   — PWA, plein cadre + zone de sécurité 80 % (purpose "maskable")
 *   store-assets/play-icon-512.png — Google Play : carré plein, Play applique lui-même le masque
 */

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = resolve(ROOT, "public/favicon.svg");

const base = readFileSync(SRC, "utf8");

/** Retire l'habillage <svg …> pour ne garder que le contenu. */
const inner = base.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
/** Contenu sans le fond, pour la variante maskable (le fond est redessiné plein cadre). */
const innerNoBg = inner.replace(/<rect width="1024" height="1024"[^>]*\/>/, "");
/** Le <defs> doit rester hors du groupe transformé pour que les filtres restent référençables. */
const defs = (inner.match(/<defs>[\s\S]*?<\/defs>/) || [""])[0];
const innerNoBgNoDefs = innerNoBg.replace(/<defs>[\s\S]*?<\/defs>/, "");

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${body}</svg>`;

/** Coins arrondis d'origine (rx=230). */
const rounded = wrap(inner);
/** Carré plein : Google Play arrondit lui-même, une icône pré-arrondie serait rognée deux fois. */
const square  = wrap(inner.replace(/(<rect width="1024" height="1024"[^>]*?)rx="230"/, "$1"));
/**
 * Variante recentrée : le tracé d'origine occupe x ∈ [94, 650] sur un canvas de 1024,
 * soit ~370 px de vide à droite. Un décalage de +140 px recentre la composition.
 * Proposition à comparer avec la version d'origine, la charte n'est pas modifiée.
 */
const centered = wrap(
  `${defs}<rect width="1024" height="1024" fill="#4FC287"/>` +
  `<g transform="translate(140,0)">${innerNoBgNoDefs}</g>`
);
/** Maskable : fond plein cadre + contenu réduit à 80 % (zone de sécurité Android). */
const maskable = wrap(
  `${defs}<rect width="1024" height="1024" fill="#4FC287"/>` +
  `<g transform="translate(102.4,102.4) scale(0.8)">${innerNoBgNoDefs}</g>`
);

const TARGETS = [
  { svg: rounded,  size: 192, out: "public/icon-192.png" },
  { svg: rounded,  size: 512, out: "public/icon-512.png" },
  { svg: maskable, size: 512, out: "public/icon-maskable-512.png" },
  { svg: square,   size: 512, out: "store-assets/play-icon-512.png" },
  { svg: centered, size: 512, out: "store-assets/play-icon-512-centered.png" },
];

// Le binaire Chromium fourni par l'environnement peut ne pas correspondre à la révision
// attendue par Playwright : PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH permet de le pointer
// explicitement (même variable que les scripts de test du repo).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page    = await browser.newPage();

for (const { svg, size, out } of TARGETS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;padding:0;background:transparent">
       <div style="width:${size}px;height:${size}px">${svg.replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`)}</div>
     </body></html>`,
    { waitUntil: "load" }
  );
  const buf  = await page.screenshot({ omitBackground: true, type: "png" });
  const dest = resolve(ROOT, out);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log(`✓ ${out} — ${size}×${size} — ${(buf.length / 1024).toFixed(1)} Ko`);
}

await browser.close();
