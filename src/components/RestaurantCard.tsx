import type { Restaurant, Spot } from '../data/schema.ts';
import { freshnessNote } from '../lib/freshness.ts';
import { FOOD_PRICE_LABELS, FOOD_TAG_LABELS, VERIFIED_SOURCE_LABELS } from '../lib/labels.ts';
import { directionsUrl } from '../lib/links.ts';
import { DriveBadge } from './SpotCard.tsx';
import { RISK_LABELS, canClaimOpen } from '../lib/verification.ts';
import { PlacePhoto } from './SpotArt.tsx';
import { Tag, buttonBase, cardBase, primaryButton } from './ui.tsx';

export interface RestaurantCardProps {
  restaurant: Restaurant;
  today: string;
  mins: number | null;
  originLabel: string;
  nearSpots: Spot[];
  isFav: boolean;
  onToggleFav: () => void;
  onReport: () => void;
}

export function RestaurantCard({ restaurant: r, today, mins, originLabel, nearSpots, isFav, onToggleFav, onReport }: RestaurantCardProps) {
  return (
    <article className={`${cardBase} flex min-w-0 flex-col gap-3 p-4`}>
      <PlacePhoto name={r.name} image={r.image} />
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

      <p className="text-xs text-stone-600 dark:text-stone-400">
        {r.risk_flags?.includes('status_conflict')
          ? '營業狀態的資料互相矛盾（有來源說還在營業、有來源說暫停），待再次確認，'
          : (r.risk_flags ?? []).length > 0
            ? `${(r.risk_flags ?? []).map((f) => RISK_LABELS[f]).join('、')}，`
          : canClaimOpen(r) && r.verified
            ? `${r.verified.date} 查過還在營業（${r.verified.note ?? VERIFIED_SOURCE_LABELS[r.verified.source]}），`
            : `資料整理於 ${r.last_verified}，還沒實際查證，`}
        {freshnessNote(r, 'food', today) ?? '親子餐廳常改時間或歇業，出發前在 Google 地圖或電話確認一下。'}
      </p>

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
          className={`${primaryButton}`}
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
              : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-card-dark dark:text-stone-100 dark:hover:bg-stone-800'
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
        資料有誤？告訴研究所
      </button>
    </article>
  );
}
