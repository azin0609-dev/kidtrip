/** 小恐龍吉祥物與裝飾（自己畫的 SVG，純裝飾，螢幕閱讀器會略過）。 */

const BODY = '#5fbf6b';
const DARK = '#2f8f4e';
const BELLY = '#e3f6c9';
const INK = '#1f3b2a';

export function Dino({ className = '', mood = 'happy' }: { className?: string; mood?: 'happy' | 'sleepy' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      {/* 背上的刺 */}
      <g fill={DARK}>
        <path d="M58 20 l9 -12 l7 13z" />
        <path d="M42 34 l3 -15 l12 10z" />
        <path d="M28 54 l-1 -15 l13 8z" />
        <path d="M18 76 l-5 -14 l14 5z" />
      </g>
      {/* 尾巴 */}
      <path d="M34 92 C12 98 2 82 8 66 C13 78 24 80 36 72z" fill={BODY} />
      {/* 身體、頭 */}
      <ellipse cx="56" cy="80" rx="30" ry="27" fill={BODY} />
      <ellipse cx="78" cy="44" rx="28" ry="24" fill={BODY} />
      <path d="M52 40 h30 v30 h-36z" fill={BODY} />
      {/* 肚子 */}
      <ellipse cx="62" cy="86" rx="18" ry="17" fill={BELLY} />
      {/* 腳、手 */}
      <rect x="38" y="98" width="15" height="14" rx="7" fill={DARK} />
      <rect x="62" y="98" width="15" height="14" rx="7" fill={DARK} />
      <ellipse cx="84" cy="76" rx="8" ry="5" fill={DARK} transform="rotate(-20 84 76)" />
      {/* 臉 */}
      {mood === 'sleepy' ? (
        <path d="M82 40 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="87" cy="39" r="5" fill={INK} />
          <circle cx="88.8" cy="37.2" r="1.7" fill="#fff" />
        </>
      )}
      <circle cx="101" cy="40" r="1.3" fill={INK} />
      <ellipse cx="93" cy="51" rx="5.5" ry="3.2" fill="#ff9aa8" opacity="0.75" />
      <path d="M84 55 q8 6 15 -1" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** 恐龍蛋：用在「幫我抽一個」。 */
export function DinoEgg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2.5c4 0 7.5 6 7.5 11a7.5 7.5 0 0 1-15 0c0-5 3.500-11 7.5-11z" fill="#fff8e1" stroke={INK} strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.6" fill={BODY} />
      <circle cx="14.5" cy="13.500" r="2" fill={BODY} />
      <circle cx="10" cy="16.500" r="1.3" fill={BODY} />
    </svg>
  );
}

/** 一排恐龍腳印，當分隔線。 */
export function Footprints({ className = '' }: { className?: string }) {
  const print = (x: number, flip: boolean) => (
    <g key={x} transform={`translate(${x} ${flip ? 2 : 10}) rotate(${flip ? 12 : -12} 8 8)`}>
      <ellipse cx="8" cy="11" rx="4.500" ry="5" />
      <circle cx="3" cy="4.500" r="1.800" />
      <circle cx="8" cy="2.500" r="1.900" />
      <circle cx="13" cy="4.500" r="1.800" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 28" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => print(6 + i * 28, i % 2 === 0))}
    </svg>
  );
}
