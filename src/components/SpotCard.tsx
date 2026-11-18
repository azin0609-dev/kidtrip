import type { Hotel, Restaurant, Spot } from '../data/schema.ts';
import { spotBadges } from '../lib/date.ts';
import { formatDrive, formatEstimate } from '../lib/format.ts';
import { ageBestLabel, stayLabel } from '../lib/details.ts';
import { COST_LABELS, ENV_LABELS, FACILITY_LABELS, TYPE_LABELS } from '../lib/labels.ts';
import { freshnessNote } from '../lib/freshness.ts';
import { VERIFIED_SOURCE_LABELS } from '../lib/labels.ts';
import { directionsUrl, officialInfoUrl } from '../lib/links.ts';
import { type Nap, napPlan, packingList } from '../lib/plan.ts';
import { RATING_TAGS, RATING_TAG_LABELS, type Rating, type RatingTag } from '../lib/ratings.ts';
import { PlacePhoto } from './SpotArt.tsx';
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
  /** 自家評分（去過之後才會顯示評分區）。 */
  rating?: Rating;
  onStars?: (stars: number) => void;
  onRatingTag?: (tag: RatingTag) => void;
  /** 去過之後寫的一句回憶。 */
  memo?: string;
  onMemo?: (text: string) => void;
  /** 午睡時段，用來排出門時間。 */
  nap?: Nap;
}

export function DriveBadge({
  mins,
  originLabel,
  areaOnly = false,
}: {
  mins: number | null;
  originLabel: string;
  /** 座標只到鄉鎮，而且車程是用公式算的：誤差會比較大。 */
  areaOnly?: boolean;
}) {
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
        <span className="sr-only">{formatEstimate(mins)}，</span>從{originLabel}・{areaOnly ? '只知道在哪一區' : '粗估'}
      </div>
    </div>
  );
}

export function SpotCard({ spot, today, mins, originLabel, nearHotels, nearFood = [], isFav, isBeen, onToggleFav, onToggleBeen, onReport, highlight, reason, kidNote, rating, onStars, onRatingTag, nap, memo, onMemo }: SpotCardProps) {
  const badges = spotBadges(spot, today);
  const facts = [spot.age_best && ageBestLabel(spot.age_best), spot.stay_hours && stayLabel(spot.stay_hours)].filter(Boolean);
  const plan = nap && mins !== null && spot.stay_hours ? napPlan(mins, spot.stay_hours, nap) : null;
  const packing = packingList(spot, Number(today.slice(5, 7)));
  return (
    <article
      className={`flex min-w-0 flex-col gap-3 overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 dark:bg-card-dark ${
        highlight ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : 'ring-emerald-100 dark:ring-emerald-950'
      }`}
    >
      <PlacePhoto name={spot.name} image={spot.image} />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{spot.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
        </div>
        <DriveBadge mins={mins} originLabel={originLabel} areaOnly={spot.coord_area && originLabel !== '林口區'} />
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

      {freshnessNote(spot, 'spot', today) && (
        <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-800 dark:bg-stone-800 dark:text-stone-200">
          {freshnessNote(spot, 'spot', today)}
        </p>
      )}

      {spot.open_note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-bold">出發前注意：</span>
          {spot.open_note}
        </p>
      )}

      {plan && (
        <p className="text-sm text-stone-700 dark:text-stone-300">
          <span className="font-medium text-stone-900 dark:text-stone-100">配合午睡：</span>
          {plan.text}
        </p>
      )}

      <details className="group text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg font-medium text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
            設施、交通、要帶什麼
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
            <p>
              <span className="font-medium">要帶：</span>
              {packing.join('、')}
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              {spot.verified
                ? `${spot.verified.date} 查過（${VERIFIED_SOURCE_LABELS[spot.verified.source]}）：${spot.verified.fields.join('、')}。${spot.verified.note ?? ''}其他項目還沒逐一確認。`
                : '這筆資料還沒逐項查證，開放時間、票價請以官方公告為準。'}{' '}
              <a href={officialInfoUrl(spot)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {spot.official_url ? '官方網站' : '查官方資訊'}
              </a>
            </p>
          </div>
      </details>

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
          href={directionsUrl(spot)}
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
      {isBeen && onStars && (
        <div className="rounded-2xl bg-amber-50 p-2 dark:bg-amber-950/40">
          <div className="flex items-center gap-1" role="group" aria-label="給這裡幾顆星">
            <span className="mr-1 shrink-0 text-sm font-medium text-amber-950 dark:text-amber-100">好玩嗎？</span>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = (rating?.stars ?? 0) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} 顆星`}
                  aria-pressed={rating?.stars === n}
                  onClick={() => onStars(n)}
                  className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                    <path
                      d="M12 2.500l2.900 6.100 6.600.900-4.800 4.700 1.200 6.600L12 17.600 6.100 20.800l1.200-6.600L2.500 9.500l6.600-.900z"
                      fill={on ? '#f59e0b' : 'none'}
                      stroke={on ? '#f59e0b' : '#a8a29e'}
                      strokeWidth="1.500"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
          {rating && onRatingTag && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {RATING_TAGS.map((t) => {
                const on = rating.tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onRatingTag(t)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                      on
                        ? 'border-amber-600 bg-amber-500 text-stone-950'
                        : 'border-stone-300 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200'
                    }`}
                  >
                    {RATING_TAG_LABELS[t]}
                  </button>
                );
              })}
            </div>
          )}
          {onMemo && (
            <label className="mt-2 block text-xs text-amber-950 dark:text-amber-100">
              寫一句回憶（只存在這支手機）
              <input
                key={memo ?? ''}
                defaultValue={memo ?? ''}
                maxLength={200}
                placeholder="例如：果果第一次餵長頸鹿"
                onBlur={(e) => {
                  if (e.target.value.trim() !== (memo ?? '')) onMemo(e.target.value);
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              />
            </label>
          )}
        </div>
      )}

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
