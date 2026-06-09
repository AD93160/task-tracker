export default function FlyntLogo({ width, height, style }) {
  const RATIO = 730 / 780;
  const w = width  || (height ? Math.round(height * RATIO) : 200);
  const h = height || Math.round(w / RATIO);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="55 150 730 780" width={w} height={h} style={style}>
      <defs>
        <linearGradient id="fl-g" gradientUnits="userSpaceOnUse" x1="320" y1="0" x2="651" y2="0">
          <stop offset="0%"   stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#86EFAC"/>
        </linearGradient>
        <filter id="fl-s" x="-5%" y="-8%" width="118%" height="130%">
          <feDropShadow dx="5" dy="8" stdDeviation="9" floodColor="#000000" floodOpacity="0.22"/>
        </filter>
      </defs>
      <rect x="60" y="155" width="710" height="770" rx="60" fill="#E8966A"/>
      <path
        d="M 220,345 A 45,45 0,0,1 265,300
           L 601,300 A 50,50 0,0,1 601,400
           L 342,400 A 22,22 0,0,0 320,422
           L 320,774 A 50,50 0,0,1 220,774 Z"
        fill="white" filter="url(#fl-s)"
      />
      <path
        d="M 138,582 L 270,646 L 477,496"
        stroke="#86EFAC" strokeWidth="88" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      <text x="320" y="824" fontFamily="'Open Sans', sans-serif" fontSize="177"
        fill="url(#fl-g)" filter="url(#fl-s)">lynt</text>
    </svg>
  );
}
