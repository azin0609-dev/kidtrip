import type { Hotel, Restaurant, Spot } from '../data/schema.ts';
import { spotBadges } from '../lib/date.ts';
import { formatDrive, formatEstimate } from '../lib/format.ts';
import { ageBestLabel, stayLabel } from '../lib/details.ts';
import { COST_LABELS, ENV_LABELS, FACILITY_LABELS, TYPE_LABELS } from '../lib/labels.ts';
import { googleMapsUrl } from '../lib/links.ts';
import { Tag, buttonBase } from './ui.tsx';

export interface SpotCardProps {
  spot: Spot;
  today: string;
  /** 從目前出發地的車程；null 代表算不出來。 */
  mins: number | null;
  originLabel: string;
  nearHotels: Hotel[];
  nearFood?: Restaurant[];
  isFav: boolean;
  isBeen: boolean;
  onToggleFav: () => void;
  onToggleBeen: () => void;
  onReport: () => void;
  highlight?: boolean;
  /** 推薦原因，例如「離家約 25 分・室內・還沒去過」。 */
  reason?: string;
  /** 依孩子年齡的提醒，例如「核桃（1 歲）可能還太小」。 */
  kidNote?: string | null;
}

export function DriveBadge({ mins, originLabel }: { mins: number | null; originLabel: string }) {
  if (mins === null) {
    return (
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-stone-700 dark:text-stone-300">車程未知</div>
        <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">還沒有座標</div>
      </div>
    );
  }
  const d = formatDrive(mins);
  return (
    <div className="shrink-0 text-right" title={formatEstimate(mins)}>
      <div className="text-2xl leading-none font-bold text-stone-900 dark:text-stone-50">
        <span className="mr-0.5 text-sm font-normal">約</span>
        {d.value}
        <span className="ml-0.5 text-sm font-normal">{d.unit}</span>
      </div>
      <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">
        <span className="sr-only">{formatEstimate(mins)}，</span>從{originLabel}・粗估
      </div>
    </div>
  );
}

export function SpotCard({ spot, today, mins, originLabel, nearHotels, nearFood = [], isFav, isBeen, onToggleFav, onToggleBeen, onReport, highlight, reason, kidNote }: SpotCardProps) {
  const badges = spotBadges(spot, today);
  const facts = [spot.age_best && ageBestLabel(spot.age_best), spot.stay_hours && stayLabel(spot.stay_hours)].filter(Boolean);
  const hasMore = (spot.facilities?.length ?? 0) > 0 || spot.transit || spot.crowd_tip;
  return (
    <article
      className={`flex min-w-0 flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 dark:bg-[#16241c] ${
        highlight ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : 'ring-emerald-100 dark:ring-emerald-950'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{spot.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
        </div>
        <DriveBadge mins={mins} originLabel={originLabel} />
      </header>

      {reason && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{reason}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <Tag key={b.kind + b.label} tone={b.kind}>
            {b.label}
          </Tag>
        ))}
        <Tag>{ENV_LABELS[spot.env]}</Tag>
        <Tag tone={spot.cost_tier === 'free' ? 'good' : 'plain'}>{COST_LABELS[spot.cost_tier]}</Tag>
        {spot.stroller_ok && <Tag tone="good">推車好推</Tag>}
        {spot.types.map((t) => (
          <Tag key={t}>{TYPE_LABELS[t]}</Tag>
        ))}
        {isBeen && <Tag>去過了</Tag>}
      </div>

      <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">{spot.tip}</p>

      {facts.length > 0 && <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">{facts.join('・')}</p>}

      {kidNote && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:bg-sky-950 dark:text-sky-100">{kidNote}</p>
      )}

      {spot.open_note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-bold">出發前注意：</span>
          {spot.open_note}
        </p>
      )}

      {hasMore && (
        <details className="group text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg font-medium text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
            設施、交通、人潮
          </summary>
          <div className="flex flex-col gap-2 pb-1 text-stone-700 dark:text-stone-300">
            {(spot.facilities?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {spot.facilities?.map((f) => (
                  <Tag key={f} tone="good">
                    {FACILITY_LABELS[f]}
                  </Tag>
                ))}
              </div>
            )}
            {spot.transit && (
              <p>
                <span className="font-medium">不開車：</span>
                {spot.transit}
              </p>
            )}
            {spot.crowd_tip && (
              <p>
                <span className="font-medium">人潮：</span>
                {spot.crowd_tip}
              </p>
            )}
          </div>
        </details>
      )}

      {nearFood.length > 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">附近吃飯：</span>
          {nearFood.map((r) => r.name).join('、')}
        </p>
      )}

      {nearHotels.length > 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-300">附近可住：</span>
          {nearHotels.map((h) => h.name).join('、')}
        </p>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2">
        <a
          href={googleMapsUrl(spot)}
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
        <button
          type="button"
          aria-pressed={isBeen}
          onClick={onToggleBeen}
          className={`${buttonBase} border ${
            isBeen
              ? 'border-stone-400 bg-stone-200 text-stone-900 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-100'
              : 'border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800'
          }`}
        >
          {isBeen ? '去過了' : '去過'}
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
