/** Homepage illustration: a party checklist with balloons, a cake and confetti. Decorative only. Colors follow the theme (index.css). */
export function HeroArt({ className }: { className?: string }) {
  const done = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <circle cx={x} cy={y} r="11" fill="url(#ha-grad)" />
      <path d={`M${x - 5} ${y} l3.5 3.5 l6.5 -7`} stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
  const todo = (x: number, y: number) => <circle key={`${x}-${y}`} cx={x} cy={y} r="10" fill="var(--hero-card)" stroke="var(--hero-ring)" strokeWidth="2" />;
  const line = (x: number, y: number, w: number) => <rect key={`l${y}`} x={x} y={y} width={w} height="10" rx="5" fill="var(--hero-bar)" />;
  const balloon = (cx: number, cy: number, rx: number, ry: number, fill: string, knot: string, string: string) => (
    <g>
      <path d={string} stroke="var(--hero-string)" strokeWidth="1.6" fill="none" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />
      <path d={`M${cx - 6} ${cy + ry - 2} l6 9 l6 -9z`} fill={knot} />
      <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.38} rx={rx * 0.24} ry={ry * 0.3} fill="#fff" opacity=".35" />
    </g>
  );
  return (
    <svg viewBox="0 0 480 400" className={className} role="img" aria-label="A party checklist with balloons and a cake" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ha-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4f5bd5" /><stop offset="1" stopColor="#d63384" /></linearGradient>
        <linearGradient id="ha-blob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--hero-blob-a)" /><stop offset="1" stopColor="var(--hero-blob-b)" /></linearGradient>
        <linearGradient id="ha-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c8cf8" /><stop offset="1" stopColor="#4f5bd5" /></linearGradient>
        <linearGradient id="ha-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f58ab8" /><stop offset="1" stopColor="#d63384" /></linearGradient>
        <linearGradient id="ha-violet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b18cf2" /><stop offset="1" stopColor="#7a4fd6" /></linearGradient>
      </defs>
      <ellipse cx="250" cy="215" rx="215" ry="170" fill="url(#ha-blob)" />
      {/* confetti */}
      <g opacity=".9">
        <rect x="70" y="70" width="10" height="5" rx="2" fill="#d63384" transform="rotate(30 75 72)" />
        <rect x="410" y="90" width="12" height="5" rx="2" fill="#4f5bd5" transform="rotate(-25 416 92)" />
        <circle cx="120" cy="330" r="5" fill="#7a4fd6" />
        <circle cx="430" cy="300" r="4" fill="#d63384" />
        <rect x="380" y="350" width="10" height="5" rx="2" fill="#f2a93b" transform="rotate(50 385 352)" />
        <circle cx="95" cy="160" r="4" fill="#f2a93b" />
        <rect x="300" y="40" width="10" height="5" rx="2" fill="#7a4fd6" transform="rotate(-40 305 42)" />
      </g>
      {/* balloons */}
      {balloon(360, 120, 34, 42, 'url(#ha-pink)', '#d63384', 'M360 168 q-8 40 6 80 q10 30 -4 60')}
      {balloon(408, 150, 28, 35, 'url(#ha-blue)', '#4f5bd5', 'M408 190 q6 40 -10 70 q-14 26 -4 50')}
      {balloon(320, 172, 25, 31, 'url(#ha-violet)', '#7a4fd6', 'M320 205 q-10 30 4 60')}
      {/* checklist */}
      <g transform="rotate(-6 190 220)">
        <rect x="95" y="95" width="200" height="250" rx="22" fill="var(--hero-card)" stroke="var(--hero-ring)" strokeWidth="2" />
        <rect x="155" y="82" width="80" height="28" rx="12" fill="url(#ha-grad)" />
        <rect x="125" y="135" width="110" height="12" rx="6" fill="var(--hero-ink)" />
        {done(132, 180)}{line(152, 174, 110)}
        {done(132, 220)}{line(152, 214, 90)}
        {todo(132, 260)}{line(152, 254, 100)}
        {todo(132, 300)}{line(152, 294, 76)}
      </g>
      {/* cake */}
      <g transform="translate(250 280)">
        <rect x="0" y="30" width="96" height="46" rx="10" fill="url(#ha-pink)" />
        <rect x="0" y="30" width="96" height="14" rx="7" fill="#fff" opacity=".7" />
        <rect x="12" y="0" width="72" height="34" rx="9" fill="url(#ha-blue)" />
        <rect x="12" y="0" width="72" height="10" rx="5" fill="#fff" opacity=".7" />
        <rect x="46" y="-18" width="5" height="18" rx="2" fill="#f2a93b" />
        <ellipse cx="48.5" cy="-23" rx="4" ry="6" fill="#ffb84d" />
      </g>
    </svg>
  );
}
