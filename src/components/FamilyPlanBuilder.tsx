import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { DRIVE_LABELS } from '../lib/conditions.ts';
import { explainPick } from '../lib/explain.ts';
import { FAMILY_DRIVE_OPTIONS, type FamilyPlanOptions, type FamilyPlanResult, planHalfDay } from '../lib/family-plan.ts';
import type { Nap } from '../lib/plan.ts';
import type { RecommendContext } from '../lib/recommend.ts';
import { type Slot, slotLabelWithDate } from '../lib/weather.ts';
import { SleepySun } from './Brand.tsx';
import { FamilyPlanTimeline } from './FamilyPlanTimeline.tsx';
import { Chip, cardBase, secondaryButton } from './ui.tsx';

type OkResult = Extract<FamilyPlanResult, { status: 'ok' }>;

/**
 * 幫我排半日遊：先選條件，再自動挑景點、排時間軸。
 * 條件預設沿用首頁和設定（出發地、孩子年齡、午睡），使用者可以改；不會為了有結果自動放寬條件。
 */
export function FamilyPlanBuilder({
  open,
  onClose,
  spots,
  ctx,
  seed,
  nap,
  slots,
  defaults,
  originLabel,
  kidsLabel,
  nowMins,
  onSave,
  onShare,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  spots: readonly Spot[];
  ctx: RecommendContext;
  seed: string;
  nap: Nap;
  /** 可以選的時段（週日沒有週六） */
  slots: readonly Slot[];
  defaults: FamilyPlanOptions;
  originLabel: string;
  /** 「果果 3 歲、核桃 1 歲」；沒設定是 null */
  kidsLabel: string | null;
  nowMins: number;
  onSave: (result: OkResult, options: FamilyPlanOptions) => void;
  onShare: (result: OkResult, whenLabel: string, slot: Slot) => Promise<string>;
  onOpenSettings: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [options, setOptions] = useState<FamilyPlanOptions>(defaults);
  const [index, setIndex] = useState(0);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // 每次打開都從目前首頁的條件開始。
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const reset = () => {
    setOptions(defaults);
    setIndex(0);
    setSavedKey(null);
  };

  const set = (patch: Partial<FamilyPlanOptions>) => {
    setOptions((o) => ({ ...o, ...patch }));
    setIndex(0);
    setSavedKey(null);
  };

  const { candidates, plans, skipped, result } = useMemo(
    () => planHalfDay(spots, ctx, options, nap, seed, index, nowMins),
    [spots, ctx, options, nap, seed, index, nowMins],
  );
  // 只在排得出合理時間的地方裡輪；第一名排不出來時已經自動往下找。
  const pick = plans.length > 0 ? plans[index % plans.length]!.pick : undefined;
  const shown = plans.length > 0 ? (index % plans.length) + 1 : 0;
  const whenLabel = slotLabelWithDate(ctx.today, options.slot);
  const day = options.slot.startsWith('sat') ? 'sat' : 'sun';
  const part = options.slot.endsWith('am') ? 'am' : 'pm';
  const slotOf = (d: string, p: string) => `${d}-${p}` as Slot;
  const resultKey = pick ? `${pick.spot.id}|${options.slot}|${options.napMode}` : null;
  const next = () => {
    setIndex((i) => (plans.length > 0 ? (i + 1) % plans.length : 0));
    setSavedKey(null);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        reset();
        onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-paper p-0 text-stone-900 dark:bg-ink dark:text-stone-50"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-2xl font-black">
              幫我排半日遊
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">幾點出門、玩多久、幾點回家睡午覺，一次排好。</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="關閉" className={`${secondaryButton} min-w-11 text-lg`}>
            ×
          </button>
        </header>

        {/* 條件 */}
        <section className={`${cardBase} flex flex-col gap-3 p-4`} aria-label="條件">
          <p className="text-sm text-stone-700 dark:text-stone-300">
            從<span className="font-bold">{originLabel}</span>出發・{kidsLabel ?? '還沒設定孩子年齡'}・午睡 {nap.start}–{nap.end}
            <button type="button" onClick={onOpenSettings} className="ml-1 inline-flex min-h-11 items-center font-bold text-emerald-800 underline underline-offset-2 dark:text-emerald-300">
              改設定
            </button>
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="哪一天">
            {(['sat', 'sun'] as const)
              .filter((d) => slots.includes(slotOf(d, part)) || slots.includes(slotOf(d, 'am')))
              .map((d) => (
                <Chip key={d} pressed={day === d} onClick={() => set({ slot: slots.includes(slotOf(d, part)) ? slotOf(d, part) : slotOf(d, 'am') })}>
                  {d === 'sat' ? '週六' : '週日'}
                </Chip>
              ))}
            <span className="mx-1 w-px self-stretch bg-stone-200 dark:bg-stone-700" aria-hidden="true" />
            {(['am', 'pm'] as const).map((p) => (
              <Chip key={p} pressed={part === p} onClick={() => set({ slot: slotOf(day, p) })}>
                {p === 'am' ? '上午' : '下午'}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="室內外">
            <Chip pressed={options.envMode === 'indoor'} onClick={() => set({ envMode: 'indoor' })}>
              完全室內
            </Chip>
            <Chip pressed={options.envMode === 'any'} onClick={() => set({ envMode: 'any' })}>
              室內外都可以
            </Chip>
            <Chip pressed={options.stroller} onClick={() => set({ stroller: !options.stroller })}>
              帶推車
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="單程最多">
            <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">單程最多（車程是粗估）</span>
            {FAMILY_DRIVE_OPTIONS.map((m) => (
              <Chip key={m} pressed={options.maxDrive === m} onClick={() => set({ maxDrive: m })}>
                {DRIVE_LABELS[m]}
              </Chip>
            ))}
          </div>
          {part === 'am' && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="午睡方式">
              <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">午睡</span>
              <Chip pressed={options.napMode === 'home'} onClick={() => set({ napMode: 'home' })}>
                回家吃飯、回家睡
              </Chip>
              <Chip pressed={options.napMode === 'car'} onClick={() => set({ napMode: 'car' })}>
                回程在車上睡
              </Chip>
            </div>
          )}
        </section>

        {/* 結果 */}
        {result === null ? (
          <div className={`${cardBase} flex flex-col items-center gap-2 p-6 text-center`} role="status">
            <SleepySun className="h-16 w-24" />
            {candidates.length === 0 ? (
              <>
                <p className="font-bold">這些條件下沒有適合的地方</p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  我們不會自動放寬條件。可以試試把「單程最多」調遠一點、改成「室內外都可以」，或確認孩子的年齡設定。
                </p>
              </>
            ) : (
              <>
                <p className="font-bold">符合條件的 {candidates.length} 個地方，都排不出合理的時間</p>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  例如{skipped[0]?.pick.spot.name}：{skipped[0]?.result.reason}
                </p>
                <p className="text-sm text-stone-700 dark:text-stone-300">可以試試改成車上睡、改下午，或把「單程最多」調短一點選近的地方。</p>
              </>
            )}
          </div>
        ) : result.status === 'ok' ? (
          <>
            <FamilyPlanTimeline
              result={result}
              whenLabel={whenLabel}
              reason={pick ? explainPick(pick, originLabel) : undefined}
              saved={savedKey === resultKey}
              onSave={() => {
                onSave(result, options);
                setSavedKey(resultKey);
              }}
              onShare={() => onShare(result, whenLabel, options.slot)}
              onReplan={plans.length > 1 ? next : undefined}
              replanLabel={`換一個地方（${shown}/${plans.length}）`}
            />
            {savedKey === resultKey && (
              <p role="status" className="text-center text-sm text-stone-700 dark:text-stone-300">
                已保存成這週放電計畫，首頁最上面看得到。
              </p>
            )}
          </>
        ) : (
          <div className={`${cardBase} flex flex-col gap-2 p-4`} role="status">
            {'spot' in result && <p className="font-bold">{result.spot.name}</p>}
            <p className="text-sm text-stone-800 dark:text-stone-200">{result.status === 'no-time' ? `時間不足，建議更改條件。${result.reason}` : result.reason}</p>

          </div>
        )}
      </div>
    </dialog>
  );
}
