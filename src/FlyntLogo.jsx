/**
 * Logo Flynt.
 *
 * `square` : couleur du carré de fond. Accepte soit une couleur unique
 *            ("#4FC287"), soit deux bornes (["#3DAA6B","#86EFAC"]) — dans ce
 *            cas le carré est rempli d'un dégradé gauche→droite, comme le
 *            dégradé signature de l'app.
 * `mark`   : couleur du F ET de la coche — l'accent de la famille de thème
 *            opposée, ce qui donne au logo son inversion bicolore. Accepte
 *            aussi deux bornes. Son dégradé est appliqué en sens INVERSE de
 *            celui du carré : le côté clair de la marque tombe ainsi sur le
 *            côté sombre du carré, et le contraste tient sur toute la largeur.
 *
 * Les valeurs par défaut correspondent à l'identité canonique (carré vert,
 * marque orange) — celle du favicon et de l'icône PWA, fichiers statiques
 * qui ne peuvent pas suivre le thème choisi.
 */
export default function FlyntLogo({
  width, height, style,
  square = ["#3DAA6B", "#86EFAC"],
  mark = ["#F5C9A8", "#C9713F"],
}) {
  const RATIO = 730 / 780;
  const w = width  || (height ? Math.round(height * RATIO) : 200);
  const h = height || Math.round(w / RATIO);

  const [sqFrom, sqTo] = Array.isArray(square) ? square : [square, square];
  const [mkFrom, mkTo] = Array.isArray(mark)   ? mark   : [mark, mark];

  // Les id SVG sont globaux au document : deux logos de couleurs différentes
  // affichés en même temps (ex. le sélecteur de thème) se voleraient leur
  // dégradé. On les dérive donc des couleurs pour qu'ils restent distincts.
  const uid      = `${sqFrom}${sqTo}${mkFrom}${mkTo}`.replace(/[^a-zA-Z0-9]/g, "");
  const squareId = `fl-sq-${uid}`;
  const markId   = `fl-mk-${uid}`;
  const gradId   = `fl-g-${uid}`;
  const shadowId = `fl-s-${uid}`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="55 150 730 780" width={w} height={h} style={style}>
      <defs>
        {/* Dégradé du carré — même sens que le dégradé signature de l'app. */}
        <linearGradient id={squareId} gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="770" y2="0">
          <stop offset="0%"   stopColor={sqFrom}/>
          <stop offset="100%" stopColor={sqTo}/>
        </linearGradient>
        {/* Marque (F + coche) — sens inverse du carré, cf. commentaire d'en-tête. */}
        <linearGradient id={markId} gradientUnits="userSpaceOnUse" x1="770" y1="0" x2="60" y2="0">
          <stop offset="0%"   stopColor={mkFrom}/>
          <stop offset="100%" stopColor={mkTo}/>
        </linearGradient>
        {/* Le mot « lynt » va du blanc vers la couleur de marque, pour rester
            lisible quelle que soit la teinte du carré sous lui. */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="320" y1="0" x2="685" y2="0">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor={mkTo}/>
        </linearGradient>
        <filter id={shadowId} x="-5%" y="-8%" width="118%" height="130%">
          <feDropShadow dx="5" dy="8" stdDeviation="9" floodColor="#000000" floodOpacity="0.22"/>
        </filter>
      </defs>
      <rect x="60" y="155" width="710" height="770" rx="60" fill={`url(#${squareId})`}/>
      <path
        d="M 220,345 A 45,45 0,0,1 265,300 L 606,300 A 45,45 0,0,1 651,345
           L 651,355 A 45,45 0,0,1 606,400 L 342,400 A 22,22 0,0,0 320,422
           L 320,779 A 45,45 0,0,1 275,824 L 265,824 A 45,45 0,0,1 220,779 Z"
        fill={`url(#${markId})`} filter={`url(#${shadowId})`}
      />
      <path
        d="M 138,582 L 270,646 L 477,496"
        stroke={`url(#${markId})`} strokeWidth="88" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <text x="320" y="824" fontFamily="'Open Sans', sans-serif" fontSize="177"
        fill={`url(#${gradId})`} filter={`url(#${shadowId})`}>lynt</text>
    </svg>
  );
}
