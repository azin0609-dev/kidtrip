import type { SpotType } from '../data/schema.ts';
import { Dino } from './Dino.tsx';

/** 景點類型的小圖示（自己畫的 SVG，給小孩看的大圖模式和集章用）。純裝飾。 */
export function TypeIcon({ type, className = '' }: { type: SpotType; className?: string }) {
  if (type === 'dino') return <Dino className={className} />;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {ICONS[type]}
    </svg>
  );
}

const INK = '#1f3b2a';

const ICONS: Record<Exclude<SpotType, 'dino'>, React.ReactNode> = {
  park: (
    <>
      <rect x="21" y="28" width="6" height="14" rx="2" fill="#a16207" />
      <circle cx="24" cy="19" r="13" fill="#4ade80" />
      <circle cx="17" cy="23" r="7" fill="#22c55e" />
      <circle cx="31" cy="22" r="8" fill="#22c55e" />
    </>
  ),
  zoo: (
    <g fill="#f59e0b">
      <ellipse cx="24" cy="31" rx="11" ry="9" />
      <circle cx="10" cy="21" r="4.5" />
      <circle cx="19" cy="12" r="4.5" />
      <circle cx="29" cy="12" r="4.5" />
      <circle cx="38" cy="21" r="4.5" />
    </g>
  ),
  farm: (
    <>
      <path d="M6 22 L24 8 L42 22z" fill="#b91c1c" />
      <rect x="9" y="22" width="30" height="19" fill="#ef4444" />
      <rect x="19" y="28" width="10" height="13" fill="#fff7ed" />
      <path d="M19 28 L29 41 M29 28 L19 41" stroke="#b91c1c" strokeWidth="1.5" />
    </>
  ),
  theme: (
    <>
      <path d="M24 24 L14 43 h20z" fill="#a78bfa" />
      <circle cx="24" cy="22" r="15" fill="none" stroke="#7c3aed" strokeWidth="3" />
      <path d="M24 7 v30 M9 22 h30 M13.500 11.500 l21 21 M34.500 11.500 l-21 21" stroke="#7c3aed" strokeWidth="1.5" />
      <g fill="#f472b6">
        <circle cx="24" cy="7" r="3.500" />
        <circle cx="39" cy="22" r="3.500" />
        <circle cx="9" cy="22" r="3.500" />
        <circle cx="24" cy="37" r="3.500" />
      </g>
    </>
  ),
  sea: (
    <>
      <path d="M33 24 L45 14 v20z" fill="#0ea5e9" />
      <ellipse cx="21" cy="24" rx="16" ry="11" fill="#38bdf8" />
      <circle cx="13" cy="21" r="2.500" fill={INK} />
      <path d="M20 17 q6 7 0 14" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  museum: (
    <g fill="#94a3b8">
      <path d="M4 18 L24 6 L44 18z" fill="#64748b" />
      <rect x="8" y="20" width="6" height="16" />
      <rect x="21" y="20" width="6" height="16" />
      <rect x="34" y="20" width="6" height="16" />
      <rect x="4" y="37" width="40" height="5" fill="#64748b" />
    </g>
  ),
  indoorplay: (
    <>
      <circle cx="15" cy="30" r="10" fill="#f87171" />
      <circle cx="32" cy="31" r="9" fill="#60a5fa" />
      <circle cx="24" cy="16" r="9" fill="#facc15" />
    </>
  ),
  train: (
    <>
      <rect x="6" y="12" width="36" height="22" rx="6" fill="#f97316" />
      <rect x="11" y="17" width="10" height="8" rx="1.500" fill="#e0f2fe" />
      <rect x="27" y="17" width="10" height="8" rx="1.500" fill="#e0f2fe" />
      <circle cx="15" cy="38" r="4.500" fill={INK} />
      <circle cx="33" cy="38" r="4.500" fill={INK} />
    </>
  ),
  water: (
    <g fill="#38bdf8">
      <path d="M24 5 c7 9 11 14 11 20 a11 11 0 0 1 -22 0 c0 -6 4 -11 11 -20z" />
      <path d="M9 24 c3 4 5 6 5 9 a5 5 0 0 1 -10 0 c0 -3 2 -5 5 -9z" fill="#7dd3fc" />
      <path d="M40 27 c2.500 3.500 4 5 4 7.500 a4 4 0 0 1 -8 0 c0 -2.500 1.500 -4 4 -7.500z" fill="#7dd3fc" />
    </g>
  ),
};
