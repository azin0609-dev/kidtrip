import type { Restaurant, Spot } from '../data/schema.ts';
import { DRIVE_LABELS } from '../lib/conditions.ts';
import { type DayPlanAddon, checkSavedDay, dayLabel } from '../lib/full-day.ts';
import { type Nap, formatClock } from '../lib/plan.ts';
import type { RecommendContext } from '../lib/recommend.ts';
import { TimelineSteps } from './FamilyPlanTimeline.tsx';
import { buttonBase } from './ui.tsx';

const ghost = `${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`;
const primary = `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`;

const NAP_TEXT = { stroller: '推車上睡', car: '車上睡', none: '不睡午覺' } as const;
const LUNCH_TEXT = { nearby: '午餐在景點附近找', packed: '自備午餐' } as const;

/**
 * 另一半傳來的全日遊連結：先預覽兩個景點和行程條件，再問要不要存。
 * 時間表用這支手機的出發地、孩子年齡、午睡時間重新排（連結裡不帶這些資料），所以可能跟對方看到的不一樣。
 */
export function IncomingDayPlan({
  addon,
  spots,
  ctx,
  nap,
  restaurants,
  nowMins,
  expired,
  onAccept,
  onDecline,
}: {
  addon: DayPlanAddon;
  spots: readonly Spot[];
  ctx: RecommendContext;
  nap: Nap;
  restaurants: readonly Restaurant[];
  nowMins: number;
  /** 行程不是這一週的 */
  expired: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const first = spots.find((s) => s.id === addon.spotId);
  const second = addon.secondId ? spots.find((s) => s.id === addon.secondId) : undefined;
  const names = [first?.name ?? '（已經不在資料裡的景點）', ...(addon.secondId ? [second?.name ?? '（已經不在資料裡的景點）'] : [])];
  const when = `${dayLabel(ctx.today, addon.slot === 'sun-am' ? 'sun' : 'sat')}・全日遊`;
  const result = expired ? null : checkSavedDay(addon, spots, ctx, nap, restaurants, nowMins);
  const conditions = [
    `${formatClock(addon.departAt)} 出門，最晚 ${formatClock(addon.latestHome)} 到家`,
    NAP_TEXT[addon.napMode],
    LUNCH_TEXT[addon.lunch],
    addon.envMode === 'indoor' ? '景點都在室內' : '室內外都可以',
    addon.stroller ? '帶推車' : '不帶推車',
    `單程最多 ${DRIVE_LABELS[addon.maxDrive] ?? `${addon.maxDrive} 分`}`,
  ];

  return (
    <section role="dialog" aria-labelledby="incoming-day-title" className="mb-6 rounded-3xl bg-amber-100 p-4 text-amber-950 ring-2 ring-amber-400 dark:bg-amber-950 dark:text-amber-50">
      <h2 id="incoming-day-title" className="text-lg font-extrabold">
        {expired ? '這個全日遊連結已經過期' : '收到這週的全日行程'}
      </h2>
      <p className="mt-1 text-sm font-bold">{when}</p>
      <p className="text-lg leading-snug font-extrabold break-words">
        {names.length > 1 && <span className="mr-1.5 inline-block rounded-full bg-amber-400 px-2 py-0.5 align-middle text-xs font-bold text-stone-950">兩站</span>}
        {names.join(' → ')}
      </p>
      {expired ? (
        <p className="mt-1 text-sm">這是之前某一週的行程，不會存下來。</p>
      ) : (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="行程條件">
            {conditions.map((c) => (
              <li key={c} className="rounded-full bg-white/70 px-2 py-1 dark:bg-white/10">
                {c}
              </li>
            ))}
          </ul>
          {result?.status === 'ok' ? (
            <details className="mt-2 text-sm">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold underline underline-offset-2">
                看時間表（約 {formatClock(result.leaveHome)} 出門、{formatClock(result.homeAt)} 到家）
              </summary>
              <div className="mt-1 rounded-2xl bg-white p-3 text-stone-900 dark:bg-card-dark dark:text-stone-100">
                {result.draft && <p className="mb-2 text-sm font-bold text-amber-900 dark:text-amber-200">待確認草案：{result.draftReasons.join(' ')}</p>}
                <TimelineSteps steps={result.steps} />
              </div>
            </details>
          ) : (
            result && <p className="mt-2 text-sm">用這支手機的設定排不出來：{result.reason}還是可以先存下來，之後再重新安排。</p>
          )}
          <p className="mt-2 text-xs">時間表用這支手機的出發地、孩子年齡和午睡時間重新排，跟對方看到的可能不一樣。連結裡沒有孩子的名字、生日或住址。</p>
        </>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onDecline} className={ghost}>
          {expired ? '關閉' : '先不要'}
        </button>
        {!expired && (
          <button type="button" onClick={onAccept} className={primary}>
            存到這支手機
          </button>
        )}
      </div>
    </section>
  );
}
