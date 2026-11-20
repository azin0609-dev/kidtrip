import { useState } from 'react';
import type { FamilyPlanResult, FamilyPlanStepKind } from '../lib/family-plan.ts';
import { formatDrive } from '../lib/format.ts';
import { directionsUrl } from '../lib/links.ts';
import { formatClock } from '../lib/plan.ts';
import { VERIFICATION_LABELS } from '../lib/verification.ts';
import { SpotArt } from './SpotArt.tsx';
import { buttonBase, cardBase, primaryButton, secondaryButton } from './ui.tsx';

type OkResult = Extract<FamilyPlanResult, { status: 'ok' }>;

/** 時間軸每一步的小圓點顏色：玩、睡、吃用不同顏色，開車和準備用中性色。 */
const DOT: Record<FamilyPlanStepKind, string> = {
  leave: 'bg-emerald-700 dark:bg-emerald-400',
  drive: 'bg-stone-400 dark:bg-stone-500',
  park: 'bg-stone-400 dark:bg-stone-500',
  play: 'bg-amber-400',
  lunch: 'bg-coral-400',
  rest: 'bg-stone-400 dark:bg-stone-500',
  nap: 'bg-sky-500 dark:bg-sky-400',
  home: 'bg-emerald-700 dark:bg-emerald-400',
};

/**
 * 半日遊的結果：景點、為什麼適合、年齡、設施、時間軸、出發前確認、資料查證狀態，加上導航、保存、分享。
 * 時間都是依目前的設定算出來的，車程是粗估。
 */
export function FamilyPlanTimeline({
  result,
  whenLabel,
  reason,
  onSave,
  saved = false,
  onShare,
  onReplan,
  replanLabel = '重新安排',
}: {
  result: OkResult;
  /** 「週六上午 11/21」 */
  whenLabel: string;
  /** 推薦原因（兩句以內）；從已存的計畫顯示時可以不給 */
  reason?: string;
  onSave?: () => void;
  saved?: boolean;
  onShare?: () => Promise<string>;
  onReplan?: () => void;
  replanLabel?: string;
}) {
  const [msg, setMsg] = useState('');
  const { spot } = result;
  const d = formatDrive(result.mins);

  return (
    <article className={`${cardBase} flex flex-col`} aria-label={`${whenLabel}半日遊：${spot.name}`}>
      <SpotArt name={spot.name} type={spot.types[0] ?? 'park'} image={spot.image} className="h-36 w-full" iconClassName="h-16 w-16" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{whenLabel}・半日遊</p>
            <h3 className="text-xl leading-snug font-black break-words">{spot.name}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p>
              單程約 <span className="font-bold">{d.value} {d.unit}</span>
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">去回都是粗估</p>
          </div>
        </div>

        {reason && (
          <p className="text-[15px] leading-relaxed">
            <span className="font-bold">為什麼適合：</span>
            {reason}
          </p>
        )}
        {result.ageNote && <p className="text-sm text-stone-700 dark:text-stone-300">{result.ageNote}</p>}

        {/* 時間軸 */}
        <ol className="flex flex-col" aria-label="時間安排">
          {result.steps.map((s, i) => (
            <li key={`${s.kind}-${i}`} className="relative flex gap-3 pb-3 last:pb-0">
              {i < result.steps.length - 1 && <span aria-hidden="true" className="absolute top-3 left-[3.6rem] h-full w-px bg-stone-200 dark:bg-stone-700" />}
              <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-stone-900 dark:text-stone-100">{formatClock(s.start)}</span>
              <span aria-hidden="true" className={`relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[s.kind]}`} />
              <span className="min-w-0 text-sm text-stone-800 dark:text-stone-200">
                {s.label}
                {s.end !== undefined && <span className="text-stone-500 dark:text-stone-400">（到 {formatClock(s.end)}）</span>}
              </span>
            </li>
          ))}
        </ol>

        {result.notes.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-stone-700 dark:text-stone-300">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <div className="rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-card-dark-2">
          <p className="font-bold">推車與設施</p>
          <ul className="mt-0.5 list-disc pl-4 text-stone-700 dark:text-stone-300">
            {result.facilities.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        {result.checks.length > 0 && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2b2719] dark:text-amber-100 dark:ring-amber-900/60">
            <p className="font-bold">出發前先確認</p>
            <ul className="mt-0.5 list-disc pl-4">
              {result.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-stone-600 dark:text-stone-400">
          資料狀態：{VERIFICATION_LABELS[result.verification.status]}
          {result.verification.verifiedAt ? `（${result.verification.verifiedAt} 查過）` : `（資料整理於 ${result.verification.lastUpdated}）`}。時間是依你的出發地和午睡設定算的，車程以導航為準。
        </p>

        <div className="grid grid-cols-2 gap-2">
          <a href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
            Google 地圖導航
          </a>
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              aria-pressed={saved}
              className={saved ? `${buttonBase} border border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100` : primaryButton}
            >
              {saved ? '已保存' : '保存行程'}
            </button>
          ) : (
            onShare && (
              <button type="button" onClick={() => void onShare().then(setMsg)} className={primaryButton}>
                分享給另一半
              </button>
            )
          )}
          {onSave && onShare && (
            <button type="button" onClick={() => void onShare().then(setMsg)} className={secondaryButton}>
              分享給另一半
            </button>
          )}
          {onReplan && (
            <button type="button" onClick={onReplan} className={secondaryButton}>
              {replanLabel}
            </button>
          )}
        </div>
        {msg && (
          <p role="status" className="text-sm text-stone-700 dark:text-stone-300">
            {msg}
          </p>
        )}
      </div>
    </article>
  );
}
