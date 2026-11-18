import type { ReactNode } from 'react';
import type { Tab } from '../lib/tabs.ts';

/** 放電研究所的品牌圖形（自己畫的幾何 SVG：閃電、路線、旗子、陽光）。純裝飾，螢幕閱讀器會略過。 */

const GREEN = '#176B57';
const YELLOW = '#F3C66D';
const CORAL = '#EF9E83';

/**
 * Logo：「閃電 × 旅行路線 × 終點」。一條從起點（黃點）出發、折成閃電形狀的路線，終點插著旗子。
 * 線條粗、元素少，24px 的分頁圖示和 48px 的 App 圖示都看得清楚。
 */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="13" fill={GREEN} />
      <path d="M12 37.5 L26.5 24.5 L19.5 21.5 L31 12.5" fill="none" stroke="#FFF5DD" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="37.5" r="3.6" fill={YELLOW} />
      <path d="M31 13 V5.5" stroke="#FFF5DD" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 5.5 h8.5 l-2.4 3.2 l2.4 3.2 h-8.5z" fill={CORAL} />
    </svg>
  );
}

/** 小閃電：放在按鈕裡（再找一組、幫我抽一個）。 */
export function Bolt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M13.5 2 L5 13.5 h5.5 L9 22 l9-12.5 h-5.8z" fill="currentColor" />
    </svg>
  );
}

/** 小旗子：用在「這週放電計畫」和空狀態。 */
export function Flag({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill="#FFF5DD" />
      <path d="M17 38 V10" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
      <path d="M18 11 h16 l-4 6 l4 6 h-16z" fill={CORAL} />
      <circle cx="17" cy="39" r="2.5" fill="none" stroke={GREEN} strokeWidth="2" />
    </svg>
  );
}

/** 一段虛線路線＋終點旗，當分隔線。 */
export function RouteLine({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 28" className={className} aria-hidden="true" focusable="false">
      <path d="M4 20 C40 4 70 26 104 14 S160 6 176 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 7" />
      <circle cx="4" cy="20" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M182 22 V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M183 5 h12 l-3 4 l3 4 h-12z" fill={CORAL} />
    </svg>
  );
}

/** 空狀態插圖：太陽躲在雲後面。 */
export function SleepySun({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 72" className={className} aria-hidden="true" focusable="false">
      <circle cx="58" cy="30" r="20" fill={YELLOW} />
      <g stroke={YELLOW} strokeWidth="3" strokeLinecap="round">
        <path d="M58 3 v4 M83 30 h4 M76 12 l3 -3 M40 12 l-3 -3" />
      </g>
      <path d="M20 60 a12 12 0 0 1 4 -23 a16 16 0 0 1 30 -2 a11 11 0 0 1 14 11 a8 8 0 0 1 -2 14z" fill="#FFFFFF" stroke="#C3D1C9" strokeWidth="1.5" />
    </svg>
  );
}

/** 分頁圖示（線條風，跟著文字顏色）。 */
export function TabIcon({ tab, className = '' }: { tab: Tab; className?: string }) {
  const paths: Record<Tab, ReactNode> = {
    // 去放電：跟 Logo 同一條閃電路線＋終點旗
    spots: (
      <>
        <path d="M4.5 20 L13 12.5 L9 10.5 L15.5 5" />
        <path d="M15.5 5.5 V2.5 h5 l-1.300 1.700 1.300 1.700 h-5" />
        <circle cx="4.5" cy="20" r="1.4" fill="currentColor" />
      </>
    ),
    // 住一晚：房子
    hotels: (
      <>
        <path d="M3.5 11 L12 4 l8.5 7" />
        <path d="M6 9.5 V20 h12 V9.5" />
        <path d="M10 20 v-5 h4 v5" />
      </>
    ),
    // 吃好料：叉子湯匙
    food: (
      <>
        <path d="M7 3 v6 a2 2 0 0 0 4 0 V3 M9 3 v18" />
        <path d="M16.5 3 c-2 0 -3 2.5 -3 5.5 s1.300 4 3 4 s3 -1 3 -4 S18.500 3 16.500 3z M16.500 12.500 V21" />
      </>
    ),
    // 飛出國：飛機
    trips: <path d="M2.5 13.5 l19-8 -6 15 -3.500-5.500z M12 15 l9.500-9.500" />,
    // 我的：旗子
    favs: (
      <>
        <path d="M6 21 V3.5" />
        <path d="M6.500 4 h11 l-2.500 4 2.500 4 h-11" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[tab]}
    </svg>
  );
}

/** 定位圖示：用在出發地按鈕。 */
export function Pin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7z" fill="currentColor" />
      <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
    </svg>
  );
}
