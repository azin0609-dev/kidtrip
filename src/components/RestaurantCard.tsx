import type { Restaurant, Spot } from '../data/schema.ts';
import { FOOD_PRICE_LABELS, FOOD_TAG_LABELS } from '../lib/labels.ts';
import { directionsUrl } from '../lib/links.ts';
import { DriveBadge } from './SpotCard.tsx';
import { Tag, buttonBase } from './ui.tsx';

export interface RestaurantCardProps {
  restaurant: Restaurant;
  mins: number | null;
  originLabel: string;
  nearSpots: Spot[];
  isFav: boolean;
  onToggleFav: () => void;
  onReport: () => void;
}

export function RestaurantCard({ restaurant: r, mins, originLabel, nearSpots, isFav, onToggleFav, onReport }: RestaurantCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 dark:bg-[#16241c] dark:ring-emerald-950">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{r.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {r.city}・{r.cuisine}
          </p>
        </div>
        <DriveBadge mins={mins} originLabel={originLabel} areaOnly={r.coord_area && originLabel !== '林口區'} />
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Tag>{FOOD_PRICE_LABELS[r.price_tier]}</Tag>
        {r.tags.map((t) => (
          <Tag key={t} tone={t === 'reserve' || t === 'fee' ? 'end' : 'good'}>
            {FOOD_TAG_LABELS[t]}
          </Tag>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">{r.tip}</p>

      {r.open_note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-bold">出發前注意：</span>
          {r.open_note}
        </p>
      )}

      {r.needs_verify.includes('single_source') && (
        <p className="text-xs text-stone-600 dark:text-stone-400">這間只有一個來源提到，去之前先確認有沒有開。</p>
      )}

      {nearSpots.length > 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">附近可以玩：</span>
          {nearSpots.map((s) => s.name).join('、')}
        </p>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <a
          href={directionsUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`}
        >
          導航
        </a>
        <button
          type="button"
          aria-pressed={isFav}
          onClick={onToggleFav}
          className={`${buttonBase} border ${
            isFav
              ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
              : 'border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          {isFav ? '已收藏' : '收藏'}
        </button>
      </div>
      <button
        type="button"
        onClick={onReport}
        className="-mt-1 inline-flex min-h-11 items-center self-start rounded-lg text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-stone-400 dark:hover:text-stone-100"
      >
        資料有誤？告訴小恐龍
      </button>
    </article>
  );
}
