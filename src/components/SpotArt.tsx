import { useState } from 'react';
import type { PlaceImage, SpotType } from '../data/schema.ts';
import { TYPE_LABELS } from '../lib/labels.ts';
import { imageSrc } from '../lib/links.ts';
import { TypeIcon } from './TypeIcon.tsx';

/** 每種景點的插圖底色（淺色、深色）。顏色刻意淡，跟真的照片一眼就分得出來。 */
const TINTS: Record<SpotType, string> = {
  park: 'from-emerald-50 to-stone-100 dark:from-[#1f2b25] dark:to-card-dark-2',
  zoo: 'from-amber-50 to-stone-100 dark:from-[#2b2719] dark:to-card-dark-2',
  farm: 'from-coral-100 to-stone-100 dark:from-[#2e231d] dark:to-card-dark-2',
  theme: 'from-violet-50 to-coral-100 dark:from-[#26223a] dark:to-card-dark-2',
  sea: 'from-sky-50 to-stone-100 dark:from-[#18283a] dark:to-card-dark-2',
  museum: 'from-stone-200 to-stone-100 dark:from-[#262a28] dark:to-card-dark-2',
  indoorplay: 'from-amber-50 to-coral-100 dark:from-[#2d261b] dark:to-card-dark-2',
  train: 'from-coral-100 to-sky-50 dark:from-[#2e221e] dark:to-card-dark-2',
  dino: 'from-emerald-50 to-amber-50 dark:from-[#1f2b25] dark:to-card-dark-2',
  water: 'from-sky-50 to-emerald-50 dark:from-[#18283a] dark:to-card-dark-2',
};

/** 照片出處：授權要求標示，所以每個顯示照片的地方都要有。 */
function Credit({ image, small }: { image: PlaceImage; small?: boolean }) {
  return (
    <figcaption
      className={`absolute right-1.5 bottom-1.5 max-w-[92%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-white ${small ? 'text-[9px]' : 'text-[10px]'}`}
    >
      照片：{image.credit}（{image.license}）
    </figcaption>
  );
}

/**
 * 景點主圖：有合法照片就顯示照片和出處；沒有就用原創的類型插圖，並標明「示意圖」，
 * 不拿別處的照片冒充。插圖是裝飾，螢幕閱讀器略過；照片有替代文字。
 */
export function SpotArt({
  name,
  type,
  image,
  className = '',
  iconClassName = 'h-16 w-16',
  small = false,
}: {
  name: string;
  type: SpotType;
  image?: PlaceImage;
  className?: string;
  iconClassName?: string;
  /** 縮圖：出處和示意標籤用更小的字。 */
  small?: boolean;
}) {
  // 照片載入失敗（檔案不見、離線又沒快取）時，改用示意圖。
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <figure className={`relative overflow-hidden bg-stone-200 dark:bg-card-dark-2 ${className}`}>
        <img
          src={imageSrc(image.url, import.meta.env.BASE_URL)}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
        <Credit image={image} small={small} />
      </figure>
    );
  }
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${TINTS[type]} ${className}`}>
      {/* 背景的小太陽和虛線路線，跟品牌同一套語彙。 */}
      <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full opacity-60">
        <path
          d="M-4 48 C24 36 44 54 70 44 S108 30 124 38"
          fill="none"
          stroke="#2e8b6e"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="0.5 4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <TypeIcon type={type} className={`relative opacity-90 ${iconClassName}`} />
      <span
        className={`absolute rounded-md bg-white/80 text-stone-600 dark:bg-black/40 dark:text-stone-300 ${
          small ? 'right-1 bottom-1 px-1 text-[9px]' : 'right-2 bottom-2 px-1.5 py-0.5 text-[10px]'
        }`}
      >
        {small ? '示意' : `${TYPE_LABELS[type]}示意圖・還沒有照片`}
      </span>
    </div>
  );
}

/** 住宿、餐廳的照片：只有資料裡有合法照片才顯示，沒有就什麼都不放。比例統一 16:9。 */
export function PlacePhoto({ name, image }: { name: string; image?: PlaceImage }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;
  return (
    <figure className="relative -mx-4 -mt-4 aspect-video overflow-hidden bg-stone-200 dark:bg-card-dark-2">
      <img
        src={imageSrc(image.url, import.meta.env.BASE_URL)}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      <Credit image={image} />
    </figure>
  );
}
