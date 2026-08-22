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
        <filter id="kw-s" x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="4" dy="7" stdDeviation="8" floodColor="#000000" floodOpacity="0.20"/>
        </filter>
      </defs>
      <rect x="60" y="155" width="710" height="770" rx="60" fill="#4FC287"/>
      {/* Hampe du K */}
      <rect x="214" y="229" width="72" height="507" rx="36" fill="white" filter="url(#kw-s)"/>
      {/* Bras haut : flèche */}
      <path d="M 263,482 L 405,338 L 530,338" stroke="#86EFAC" strokeWidth="72"
            strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#kw-s)"/>
      <path d="M 675,338 L 522,258 L 522,418 Z" fill="#86EFAC" filter="url(#kw-s)"/>
      {/* Bras bas : flèche */}
      <path d="M 263,482 L 405,626 L 530,626" stroke="white" strokeWidth="72"
            strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#kw-s)"/>
      <path d="M 675,626 L 522,546 L 522,706 Z" fill="white" filter="url(#kw-s)"/>
      <text x="330" y="860" fontFamily="'Open Sans', sans-serif" fontSize="160"
        fill="url(#kw-g)" filter="url(#kw-s)">ewa</text>
    </svg>
  );
}
