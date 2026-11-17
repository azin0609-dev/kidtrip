import { useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { formatMonthDay } from '../lib/date.ts';
import { TYPE_LABELS } from '../lib/labels.ts';
import { type RegionProgress, type YearReview, passportTitle, stampsToNextTitle } from '../lib/passport.ts';
import { Dino } from './Dino.tsx';
import { TypeIcon } from './TypeIcon.tsx';
import { buttonBase } from './ui.tsx';

const REGION_NAMES = { 北: '北部', 中: '中部', 南: '南部', 東: '東部' } as const;
const STAMP_COLORS = [
  'border-emerald-600 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200',
  'border-rose-500 text-rose-800 dark:border-rose-400 dark:text-rose-200',
  'border-sky-600 text-sky-800 dark:border-sky-400 dark:text-sky-200',
  'border-amber-600 text-amber-800 dark:border-amber-400 dark:text-amber-200',
];

function Stamp({ spot, date, index, big }: { spot: Spot; date: string | undefined; index: number; big: boolean }) {
  return (
    <li
      className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-full border-[3px] border-double p-2 text-center ${
        STAMP_COLORS[index % STAMP_COLORS.length]
      } ${index % 2 === 0 ? '-rotate-3' : 'rotate-2'}`}
    >
      <TypeIcon type={spot.types[0] ?? 'park'} className={big ? 'h-14 w-14' : 'h-8 w-8'} />
      <span className={`line-clamp-2 leading-tight font-bold break-all ${big ? 'text-base' : 'text-[0.7rem]'}`}>{spot.name}</span>
      {date && <span className={big ? 'text-sm' : 'text-[0.65rem]'}>{formatMonthDay(date)}</span>}
    </li>
  );
}

export function Passport({
  progress,
  beenAt,
}: {
  progress: RegionProgress[];
  beenAt: Readonly<Record<string, string>>;
}) {
  const [big, setBig] = useState(false);
  const count = progress.reduce((n, p) => n + p.visited.length, 0);
  const toNext = stampsToNextTitle(count);

  return (
    <section aria-labelledby="passport-title" className="rounded-3xl bg-white p-4 ring-1 ring-emerald-100 dark:bg-[#16241c] dark:ring-emerald-950">
      <div className="flex items-center gap-3">
        <Dino className="h-16 w-16 shrink-0" mood={count === 0 ? 'sleepy' : 'happy'} />
        <div className="min-w-0 flex-1">
          <h2 id="passport-title" className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
            恐龍集章護照
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            {passportTitle(count)}・集到 {count} 個章
            {toNext !== null && `，再 ${toNext} 個升級`}
          </p>
        </div>
      </div>

      {count === 0 ? (
        <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">去過的景點按「去過」，這裡就會蓋一個章。</p>
      ) : (
        <button
          type="button"
          aria-pressed={big}
          onClick={() => setBig(!big)}
          className={`${buttonBase} mt-3 border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`}
        >
          {big ? '改回小圖' : '給小孩看（大圖）'}
        </button>
      )}

      {progress
        .filter((p) => p.total > 0)
        .map((p) => (
          <div key={p.region} className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-bold">
                {REGION_NAMES[p.region]}
                {p.complete && <span className="ml-2 text-sm text-emerald-700 dark:text-emerald-300">全部集滿了！</span>}
              </h3>
              <span className="text-sm text-stone-600 dark:text-stone-400">
                {p.visited.length} / {p.total}
              </span>
            </div>
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
              role="progressbar"
              aria-label={`${REGION_NAMES[p.region]}集章進度`}
              aria-valuemin={0}
              aria-valuemax={p.total}
              aria-valuenow={p.visited.length}
            >
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.visited.length / p.total) * 100}%` }} />
            </div>
            {p.visited.length > 0 && (
              <ul className={`mt-3 grid gap-3 ${big ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-5'}`}>
                {p.visited.map((s, i) => (
                  <Stamp key={s.id} spot={s} date={beenAt[s.id]} index={i} big={big} />
                ))}
              </ul>
            )}
          </div>
        ))}
    </section>
  );
}

export function YearReviewCard({ review }: { review: YearReview }) {
  if (review.count === 0) return null;
  const max = Math.max(1, ...review.byMonth);
  return (
    <section aria-labelledby="review-title" className="rounded-3xl bg-white p-4 ring-1 ring-emerald-100 dark:bg-[#16241c] dark:ring-emerald-950">
      <h2 id="review-title" className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
        {review.year} 年的出遊回顧
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-stone-800 dark:text-stone-200">
        <li>
          今年去了 <span className="text-lg font-extrabold">{review.count}</span> 個地方
        </li>
        {review.topRegion && <li>最常去：{REGION_NAMES[review.topRegion]}</li>}
        {review.topType && <li>最常玩的類型：{TYPE_LABELS[review.topType]}</li>}
        {review.farthest && <li>跑最遠的一次：{review.farthest.name}</li>}
        {review.avgStars !== null && <li>平均給 {review.avgStars} 顆星</li>}
        {review.favorites.length > 0 && <li>5 顆星的地方：{review.favorites.map((s) => s.name).join('、')}</li>}
      </ul>
      <div className="mt-3 flex h-20 items-end gap-1" role="img" aria-label="每個月去了幾個地方">
        {review.byMonth.map((n, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center gap-0.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${n > 0 ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-stone-800'}`}
                style={{ height: `${n > 0 ? Math.max(15, (n / max) * 100) : 5}%` }}
                title={`${i + 1} 月：${n} 個`}
              />
            </div>
            <span className="text-[0.65rem] text-stone-600 dark:text-stone-400">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">只計算有記錄日期的「去過」。</p>
    </section>
  );
}
