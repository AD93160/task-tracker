/**
 * Génère les icônes de lanceur Android depuis le logo Flynt.
 *
 * L'app utilise le logo « en découpe » (carré non peint, le fond de la page
 * passe au travers). Une icône de lanceur n'a aucun fond derrière elle : on
 * emploie donc la variante à carré plein, la même que le favicon.
 *
 * Produit :
 *   - ic_launcher.png / ic_launcher_round.png  (icônes héritées)
 *   - ic_launcher_foreground.png               (couche avant des icônes
 *     adaptatives, marque seule sur fond transparent, cadrée dans la zone
 *     sûre des 66dp centraux sur 108dp)
 *
 * Usage : node scripts/gen-android-icons.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const RES = path.join(__dirname, "..", "apps", "mobile", "android", "app", "src", "main", "res");

// Identité canonique — cohérente avec public/favicon.svg et le défaut de FlyntLogo.
const SQUARE = ["#3DAA6B", "#86EFAC"];
const MARK   = ["#F5C9A8", "#C9713F"];

// Densités Android. Les icônes héritées font 48dp, les couches adaptatives 108dp.
const LEGACY = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const ADAPTIVE = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const MARK_PATHS = `
  <path d="M 220,345 A 45,45 0,0,1 265,300 L 606,300 A 45,45 0,0,1 651,345
           L 651,355 A 45,45 0,0,1 606,400 L 342,400 A 22,22 0,0,0 320,422
           L 320,779 A 45,45 0,0,1 275,824 L 265,824 A 45,45 0,0,1 220,779 Z"
        fill="url(#mk)"/>
  <path d="M 138,582 L 270,646 L 477,496" stroke="url(#mk)" stroke-width="88"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

const defs = `
  <linearGradient id="sq" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="770" y2="0">
    <stop offset="0%" stop-color="${SQUARE[0]}"/><stop offset="100%" stop-color="${SQUARE[1]}"/>
  </linearGradient>
  <linearGradient id="mk" gradientUnits="userSpaceOnUse" x1="770" y1="0" x2="60" y2="0">
    <stop offset="0%" stop-color="${MARK[0]}"/><stop offset="100%" stop-color="${MARK[1]}"/>
  </linearGradient>`;

/** Icône héritée : carré plein + marque, occupant toute la surface. */
const legacySvg = (round) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 150 730 780" width="512" height="512"
     preserveAspectRatio="xMidYMid slice">
  <defs>${defs}</defs>
  <rect x="60" y="155" width="710" height="770" rx="${round ? 385 : 150}" fill="url(#sq)"/>
  ${MARK_PATHS}
</svg>`;

/**
 * Couche avant adaptative : marque seule, réduite dans la zone sûre.
 * Android recadre et anime ces couches ; tout ce qui dépasse des 66dp
 * centraux sur 108 peut être rogné selon le masque du constructeur.
 */
const foregroundSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>${defs}</defs>
  <g transform="translate(540 540) scale(0.44) translate(-420 -562)">
    ${MARK_PATHS}
  </g>
</svg>`;

(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  let n = 0;

  const shoot = async (svg, size, outPath) => {
    const html = `<html><body style="margin:0;background:transparent">
      <div id="t" style="width:${size}px;height:${size}px">${svg}</div></body></html>`;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html);
    const el = await page.$("#t svg");
    await el.evaluate((e, s) => { e.setAttribute("width", s); e.setAttribute("height", s); }, size);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await (await page.$("#t")).screenshot({ path: outPath, omitBackground: true });
    n++;
  };

  for (const [dpi, size] of Object.entries(LEGACY)) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    await shoot(legacySvg(false), size, path.join(dir, "ic_launcher.png"));
    await shoot(legacySvg(true),  size, path.join(dir, "ic_launcher_round.png"));
  }
  for (const [dpi, size] of Object.entries(ADAPTIVE)) {
    await shoot(foregroundSvg(), size, path.join(RES, `mipmap-${dpi}`, "ic_launcher_foreground.png"));
  }

  await browser.close();
  console.log(`${n} icônes générées`);
})();
