/**
 * Logo Kewa.
 *
 * `square` : remplissage du carré de fond.
 *            - une couleur (défaut "#4FC287") : aplat — identité canonique,
 *              identique au favicon et à l'icône Play Store.
 *            - deux bornes (["#3DAA6B","#86EFAC"]) : dégradé gauche→droite.
 *            - `null` : le carré n'est pas peint. Le fond de la page passe au
 *              travers et seuls le K et « ewa » se détachent — c'est le rendu
 *              utilisé dans l'app, où le header porte déjà le dégradé du thème.
 * `mark`   : couleurs du K (hampe + deux flèches) et de « ewa ». Deux bornes :
 *            la première colore la hampe et la flèche basse, la seconde la
 *            flèche haute — ce qui conserve le contraste entre les deux bras.
 *            Dans l'app on passe theme.logoMark, qui contraste avec le fond
 *            de chaque famille × mode.
 */
export default function KewaLogo({
  width, height, style,
  square = "#4FC287",
  mark = ["#FFFFFF", "#86EFAC"],
}) {
  const RATIO = 730 / 780;
  const w = width  || (height ? Math.round(height * RATIO) : 200);
  const h = height || Math.round(w / RATIO);

  const [sqFrom, sqTo] = Array.isArray(square) ? square : [square, square];
  const filled = square != null;
  const [mkMain, mkAlt] = Array.isArray(mark) ? mark : [mark, mark];

  // Les id SVG sont globaux au document : deux logos de couleurs différentes
  // affichés en même temps (ex. le sélecteur de thème) se voleraient leur
  // dégradé. On les dérive donc des couleurs pour qu'ils restent distincts.
  const uid      = `${sqFrom}${sqTo}${mkMain}${mkAlt}`.replace(/[^a-zA-Z0-9]/g, "");
  const squareId = `kw-sq-${uid}`;
  const textId   = `kw-g-${uid}`;
  const shadowId = `kw-s-${uid}`;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="55 150 730 780" width={w} height={h} style={style}
         role="img" aria-label="Kewa">
      <defs>
        {filled && (
          <linearGradient id={squareId} gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="770" y2="0">
            <stop offset="0%"   stopColor={sqFrom}/>
            <stop offset="100%" stopColor={sqTo}/>
          </linearGradient>
        )}
        <linearGradient id={textId} gradientUnits="userSpaceOnUse" x1="320" y1="0" x2="685" y2="0">
          <stop offset="0%"   stopColor={mkMain}/>
          <stop offset="100%" stopColor={mkAlt}/>
        </linearGradient>
        <filter id={shadowId} x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="4" dy="7" stdDeviation="8" floodColor="#000000" floodOpacity="0.20"/>
        </filter>
      </defs>
      {filled && <rect x="60" y="155" width="710" height="770" rx="60" fill={`url(#${squareId})`}/>}
      {/* Hampe du K */}
      <rect x="214" y="229" width="72" height="507" rx="36" fill={mkMain} filter={`url(#${shadowId})`}/>
      {/* Bras haut : flèche */}
      <path d="M 263,482 L 405,338 L 530,338" stroke={mkAlt} strokeWidth="72"
            strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#${shadowId})`}/>
      <path d="M 675,338 L 522,258 L 522,418 Z" fill={mkAlt} filter={`url(#${shadowId})`}/>
      {/* Bras bas : flèche */}
      <path d="M 263,482 L 405,626 L 530,626" stroke={mkMain} strokeWidth="72"
            strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#${shadowId})`}/>
      <path d="M 675,626 L 522,546 L 522,706 Z" fill={mkMain} filter={`url(#${shadowId})`}/>
      <text x="330" y="860" fontFamily="'Open Sans', sans-serif" fontSize="160"
        fill={`url(#${textId})`} filter={`url(#${shadowId})`}>ewa</text>
    </svg>
  );
}
