export default function KewaLogo({ width, height, style }) {
  const RATIO = 730 / 780;
  const w = width  || (height ? Math.round(height * RATIO) : 200);
  const h = height || Math.round(w / RATIO);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="55 150 730 780" width={w} height={h} style={style}>
      <defs>
        <linearGradient id="kw-g" gradientUnits="userSpaceOnUse" x1="320" y1="0" x2="685" y2="0">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#86EFAC"/>
        </linearGradient>
        <filter id="kw-s" x="-5%" y="-8%" width="118%" height="130%">
          <feDropShadow dx="5" dy="8" stdDeviation="9" floodColor="#000000" floodOpacity="0.22"/>
        </filter>
      </defs>
      <rect x="60" y="155" width="710" height="770" rx="60" fill="#4FC287"/>
      {/* Hampe du K */}
      <rect x="240" y="285" width="100" height="470" rx="50" fill="white" filter="url(#kw-s)"/>
      {/* Jambe basse — s'arrête au-dessus du lettrage */}
      <path d="M 322,525 L 570,700" stroke="white" strokeWidth="100"
            strokeLinecap="round" fill="none" filter="url(#kw-s)"/>
      {/* Bras haut : la coche, dont la longue branche forme le bras du K */}
      <path d="M 160,455 L 284,570 L 610,285" stroke="#86EFAC" strokeWidth="88"
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <text x="352" y="835" fontFamily="'Open Sans', sans-serif" fontSize="177"
        fill="url(#kw-g)" filter="url(#kw-s)">ewa</text>
    </svg>
  );
}
