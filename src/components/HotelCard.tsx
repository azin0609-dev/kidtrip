import type { Hotel, Spot } from '../data/schema.ts';
import { HOTEL_KIND_LABELS, HOTEL_TAG_LABELS, PRICE_LABELS } from '../lib/labels.ts';
import { googleMapsUrl, hotelPriceUrl } from '../lib/links.ts';
import { DriveBadge } from './SpotCard.tsx';
import { Tag, buttonBase } from './ui.tsx';

export interface HotelCardProps {
  hotel: Hotel;
  mins: number | null;
  originLabel: string;
  nearSpots: Spot[];
  isFav: boolean;
  onToggleFav: () => void;
  onReport: () => void;
}

export function HotelCard({ hotel, mins, originLabel, nearSpots, isFav, onToggleFav, onReport }: HotelCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-[#16241c] dark:ring-stone-800">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{hotel.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{hotel.city}</p>
        </div>
        <DriveBadge mins={mins} originLabel={originLabel} />
      </header>

      <div className="flex flex-wrap gap-1.5">
        {hotel.kind !== 'hotel' && <Tag tone="new">{HOTEL_KIND_LABELS[hotel.kind]}</Tag>}
        <Tag>{PRICE_LABELS[hotel.price_tier]}</Tag>
        {hotel.tags.map((t) => (
          <Tag key={t} tone="good">
            {HOTEL_TAG_LABELS[t]}
          </Tag>
        ))}
      </div>

      {hotel.features.length > 0 && (
        <p className="text-sm text-stone-700 dark:text-stone-300">{hotel.features.join('・')}</p>
      )}

      <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">{hotel.tip}</p>

      {nearSpots.length > 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">順遊：</span>
          {nearSpots.map((s) => s.name).join('、')}
        </p>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2">
        <a
          href={googleMapsUrl(hotel)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`}
        >
          導航
        </a>
        <a
          href={hotelPriceUrl(hotel)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`}
        >
          查房價
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
