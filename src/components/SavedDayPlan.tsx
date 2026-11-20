import type { Restaurant, Spot } from '../data/schema.ts';
import { type DayPlanAddon, type FullDayOk, type FullDayOptions, checkSavedDay, dayLabel, dayOptionsOf } from '../lib/full-day.ts';
import type { Nap } from '../lib/plan.ts';
import type { RecommendContext } from '../lib/recommend.ts';
import { DayTimeline } from './DayTimeline.tsx';

/**
 * 首頁上已保存的全日遊：每次都用目前的出發地、孩子年齡、推車設定重新檢查兩個景點的硬性條件，再重排時間。
 * 不符合就顯示需要重新安排。
 */
export function SavedDayPlan({
  addon,
  spots,
  ctx,
  nap,
  restaurants,
  nowMins,
  onShare,
  onReplan,
}: {
  addon: DayPlanAddon;
  spots: readonly Spot[];
  ctx: RecommendContext;
  nap: Nap;
  restaurants: readonly Restaurant[];
  nowMins: number;
  onShare: (plan: FullDayOk, whenLabel: string, opts: FullDayOptions) => Promise<string>;
  onReplan: () => void;
}) {
  const result = checkSavedDay(addon, spots, ctx, nap, restaurants, nowMins);
  const when = dayLabel(ctx.today, addon.slot.startsWith('sat') ? 'sat' : 'sun');
  if (result.status === 'ok') {
    return (
      <div className="mb-6">
        <DayTimeline plan={result} whenLabel={when} onShare={() => onShare(result, when, dayOptionsOf(addon))} onReplan={onReplan} />
      </div>
    );
  }
  return (
    <p role="status" className="mb-6 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2b2719] dark:text-amber-100 dark:ring-amber-900/60">
      這份全日遊需要重新安排：{result.reason}
      <button type="button" onClick={onReplan} className="ml-1 inline-flex min-h-11 items-center font-bold underline underline-offset-2">
        重新安排
      </button>
    </p>
  );
}
