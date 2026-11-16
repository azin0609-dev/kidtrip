import type { Hotel, Spot } from '../data/schema.ts';
import { HOTEL_TAG_LABELS, PRICE_LABELS } from '../lib/labels.ts';
import { googleMapsUrl, hotelPriceUrl } from '../lib/links.ts';
import { DriveBadge } from './SpotCard.tsx';
import { Tag, buttonBase } from './ui.tsx';

export interface HotelCardProps {
  hotel: Hotel;
  nearSpots: Spot[];
  isFav: boolean;
  onToggleFav: () => void;
}

export function HotelCard({ hotel, nearSpots, isFav, onToggleFav }: HotelCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{hotel.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{hotel.city}</p>
        </div>
        <DriveBadge mins={hotel.mins_from_linkou} />
      </header>

      <div className="flex flex-wrap gap-1.5">
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
          className={`${buttonBase} bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-400 dark:text-stone-950 dark:hover:bg-teal-300`}
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
    </article>
  );
}
