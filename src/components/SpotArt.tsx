import type { PlaceImage, SpotType } from '../data/schema.ts';
import { imageSrc } from '../lib/links.ts';
import { TypeIcon } from './TypeIcon.tsx';

/** 每種景點的插圖底色（淺色、深色）。 */
const TINTS: Record<SpotType, string> = {
  park: 'from-emerald-100 to-emerald-50 dark:from-emerald-950 dark:to-card-dark-2',
  zoo: 'from-amber-100 to-amber-50 dark:from-[#2f2614] dark:to-card-dark-2',
  farm: 'from-coral-100 to-amber-50 dark:from-[#33211a] dark:to-card-dark-2',
  theme: 'from-violet-100 to-coral-100 dark:from-[#28203a] dark:to-card-dark-2',
  sea: 'from-sky-100 to-cyan-50 dark:from-[#12293a] dark:to-card-dark-2',
  museum: 'from-stone-200 to-stone-100 dark:from-[#1f2b2a] dark:to-card-dark-2',
  indoorplay: 'from-amber-100 to-coral-100 dark:from-[#30261a] dark:to-card-dark-2',
  train: 'from-coral-100 to-sky-50 dark:from-[#30201c] dark:to-card-dark-2',
  dino: 'from-emerald-100 to-amber-50 dark:from-emerald-950 dark:to-card-dark-2',
  water: 'from-sky-100 to-emerald-50 dark:from-[#12293a] dark:to-card-dark-2',
};

/**
 * 景點主圖：有合法照片就顯示照片和出處；沒有就用原創的類型插圖（不拿別處的照片冒充）。
 * 插圖是裝飾，螢幕閱讀器略過；照片有替代文字。
 */
export function SpotArt({
  name,
  type,
  image,
  className = '',
  iconClassName = 'h-16 w-16',
}: {
  name: string;
  type: SpotType;
  image?: PlaceImage;
  className?: string;
  iconClassName?: string;
}) {
  if (image) {
    return (
      <figure className={`relative overflow-hidden bg-stone-100 dark:bg-card-dark-2 ${className}`}>
        <img src={imageSrc(image.url, import.meta.env.BASE_URL)} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {/* 授權要求標示出處，所以每個顯示照片的地方都要有。 */}
        <figcaption className="absolute right-1.5 bottom-1.5 max-w-[90%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
          照片：{image.credit}（{image.license}）
        </figcaption>
      </figure>
    );
  }
  return (
    <div aria-hidden="true" className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${TINTS[type]} ${className}`}>
      {/* 背景的小太陽和虛線路線，跟品牌背板同一套語彙。 */}
      <svg viewBox="0 0 120 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-70">
        <path d="M-4 48 C24 36 44 54 70 44 S108 30 124 38" fill="none" stroke="#2e8b6e" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="0.5 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute top-2 right-3 h-5 w-5 rounded-full bg-amber-400/70" />
      <TypeIcon type={type} className={`relative drop-shadow-sm ${iconClassName}`} />
    </div>
  );
}

/** 住宿、餐廳的照片：只有資料裡有合法照片才顯示，沒有就什麼都不放。 */
export function PlacePhoto({ name, image }: { name: string; image?: PlaceImage }) {
  if (!image) return null;
  return (
    <figure className="relative -mx-4 -mt-4 h-36 overflow-hidden bg-stone-100 dark:bg-card-dark-2">
      <img src={imageSrc(image.url, import.meta.env.BASE_URL)} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      <figcaption className="absolute right-1.5 bottom-1.5 max-w-[90%] truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
        照片：{image.credit}（{image.license}）
      </figcaption>
    </figure>
  );
}
