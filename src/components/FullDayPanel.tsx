import { useMemo, useState } from 'react';
import type { Restaurant, Spot } from '../data/schema.ts';
import { DRIVE_LABELS } from '../lib/conditions.ts';
import { FAMILY_DRIVE_OPTIONS } from '../lib/family-plan.ts';
import { DEPART_OPTIONS, type FullDayOk, type FullDayOptions, LATEST_HOME_OPTIONS, dayLabel, planFullDay } from '../lib/full-day.ts';
import { type Nap, formatClock } from '../lib/plan.ts';
import type { RecommendContext } from '../lib/recommend.ts';
import type { Slot } from '../lib/weather.ts';
import { SleepySun } from './Brand.tsx';
import { DayTimeline } from './DayTimeline.tsx';
import { Chip, cardBase } from './ui.tsx';

/** 全日遊的條件和結果（放在「幫我規劃出遊」裡，跟半日遊切換）。 */
export function FullDayPanel({
  spots,
  restaurants,
  ctx,
  seed,
  nap,
  slots,
  defaults,
  nowMins,
  onSave,
  onShare,
}: {
  spots: readonly Spot[];
  restaurants: readonly Restaurant[];
  ctx: RecommendContext;
  seed: string;
  nap: Nap;
  slots: readonly Slot[];
  defaults: FullDayOptions;
  nowMins: number;
  onSave: (plan: FullDayOk, opts: FullDayOptions) => void;
  onShare: (plan: FullDayOk, whenLabel: string, opts: FullDayOptions) => Promise<string>;
}) {
  const [opts, setOpts] = useState<FullDayOptions>(defaults);
  const [index, setIndex] = useState(0);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const set = (patch: Partial<FullDayOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setIndex(0);
    setSavedKey(null);
  };
  const r = useMemo(() => planFullDay(spots, ctx, opts, nap, restaurants, seed, nowMins), [spots, ctx, opts, nap, restaurants, seed, nowMins]);
  const plan = r.plans.length > 0 ? r.plans[index % r.plans.length]! : null;
  const shown = r.plans.length > 0 ? (index % r.plans.length) + 1 : 0;
  const key = plan ? `${plan.spots.map((s) => s.spot.id).join('+')}|${opts.day}|${opts.napMode}|${opts.departAt}` : null;
  const days = (['sat', 'sun'] as const).filter((d) => slots.includes(`${d}-am`));
  const whenLabel = dayLabel(ctx.today, opts.day);

  return (
    <>
      <section className={`${cardBase} flex flex-col gap-3 p-4`} aria-label="全日遊條件">
        <div className="flex flex-wrap gap-2" role="group" aria-label="哪一天">
          {days.map((d) => (
            <Chip key={d} pressed={opts.day === d} onClick={() => set({ day: d })}>
              {d === 'sat' ? '週六' : '週日'}
            </Chip>
          ))}
          <span className="mx-1 w-px self-stretch bg-stone-200 dark:bg-stone-700" aria-hidden="true" />
          <Chip pressed={opts.style === 'easy'} onClick={() => set({ style: 'easy' })}>
            一個地方輕鬆玩
          </Chip>
          <Chip pressed={opts.style === 'explore'} onClick={() => set({ style: 'explore' })}>
            兩個地方探索
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="上午幾點出門">
          <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">上午幾點出門</span>
          {DEPART_OPTIONS.map((t) => (
            <Chip key={t} pressed={opts.departAt === t} onClick={() => set({ departAt: t })}>
              {formatClock(t)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="最晚幾點到家">
          <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">最晚幾點到家</span>
          {LATEST_HOME_OPTIONS.map((t) => (
            <Chip key={t} pressed={opts.latestHome === t} onClick={() => set({ latestHome: t })}>
              {formatClock(t)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="午睡">
          <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">
            午睡（{nap.start}–{nap.end}）
          </span>
          <Chip pressed={opts.napMode === 'stroller'} onClick={() => set({ napMode: 'stroller' })}>
            推車上睡
          </Chip>
          <Chip pressed={opts.napMode === 'car'} onClick={() => set({ napMode: 'car' })}>
            車上睡
          </Chip>
          <Chip pressed={opts.napMode === 'none'} onClick={() => set({ napMode: 'none' })}>
            不睡
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="午餐">
          <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">午餐</span>
          <Chip pressed={opts.lunch === 'nearby'} onClick={() => set({ lunch: 'nearby' })}>
            景點附近找
          </Chip>
          <Chip pressed={opts.lunch === 'packed'} onClick={() => set({ lunch: 'packed' })}>
            自備
          </Chip>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="室內外與推車">
          <Chip pressed={opts.envMode === 'indoor'} onClick={() => set({ envMode: 'indoor' })}>
            景點都在室內
          </Chip>
          <Chip pressed={opts.envMode === 'any'} onClick={() => set({ envMode: 'any' })}>
            室內外都可以
          </Chip>
          <Chip pressed={opts.stroller} onClick={() => set({ stroller: !opts.stroller })}>
            帶推車
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="單程最多">
          <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">家裡到每個景點，單程最多（粗估）</span>
          {FAMILY_DRIVE_OPTIONS.map((m) => (
            <Chip key={m} pressed={opts.maxDrive === m} onClick={() => set({ maxDrive: m })}>
              {DRIVE_LABELS[m]}
            </Chip>
          ))}
        </div>
      </section>

      {r.napWarning && (
        <p role="note" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2b2719] dark:text-amber-100 dark:ring-amber-900/60">
          {r.napWarning}
        </p>
      )}
      {r.fallbackReason && plan && (
        <p role="status" className="rounded-2xl bg-stone-100 p-3 text-sm text-stone-800 dark:bg-card-dark dark:text-stone-200">
          {r.fallbackReason}
        </p>
      )}

      {plan ? (
        <>
          <DayTimeline
            plan={plan}
            whenLabel={whenLabel}
            saved={savedKey === key}
            onSave={() => {
              onSave(plan, opts);
              setSavedKey(key);
            }}
            onShare={() => onShare(plan, whenLabel, opts)}
            onReplan={
              r.plans.length > 1
                ? () => {
                    setIndex((i) => (i + 1) % r.plans.length);
                    setSavedKey(null);
                  }
                : undefined
            }
            replanLabel={`換一組（${shown}/${r.plans.length}）`}
          />
          {savedKey === key && (
            <p role="status" className="text-center text-sm text-stone-700 dark:text-stone-300">
              已保存成這週放電計畫，首頁最上面看得到。
            </p>
          )}
        </>
      ) : (
        <div className={`${cardBase} flex flex-col items-center gap-2 p-6 text-center`} role="status">
          <SleepySun className="h-16 w-24" />
          {r.candidates.length === 0 ? (
            <>
              <p className="font-bold">這些條件下沒有適合的地方</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">我們不會自動放寬條件。可以把「單程最多」調遠一點、改成「室內外都可以」，或確認孩子的年齡設定。</p>
            </>
          ) : (
            <>
              <p className="font-bold">排不出合理的全日行程</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">{r.failReason}</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">可以早點出門、晚點回家、換一種午睡方式，或改用半日遊。</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
