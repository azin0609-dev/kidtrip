import { useState } from 'react';
import type { FullDayOk } from '../lib/full-day.ts';
import { formatDrive } from '../lib/format.ts';
import { directionsUrl } from '../lib/links.ts';
import { formatClock } from '../lib/plan.ts';
import { VERIFICATION_LABELS } from '../lib/verification.ts';
import { TimelineSteps } from './FamilyPlanTimeline.tsx';
import { SpotArt } from './SpotArt.tsx';
import { buttonBase, cardBase, primaryButton, secondaryButton } from './ui.tsx';

const dl = (m: number) => `${formatDrive(m).value} ${formatDrive(m).unit}`;

/**
 * 全日行程結果：景點（一個或兩個）、車程摘要（都標粗估）、時間軸、午餐參考、每個景點的設施和出發前確認、
 * 資料查證狀態，加上導航、保存、分享、換一組。
 */
export function DayTimeline({
  plan,
  whenLabel,
  onSave,
  saved = false,
  onShare,
  onReplan,
  replanLabel = '重新安排',
}: {
  plan: FullDayOk;
  /** 「週六 11/21」 */
  whenLabel: string;
  onSave?: () => void;
  saved?: boolean;
  onShare?: () => Promise<string>;
  onReplan?: () => void;
  replanLabel?: string;
}) {
  const [msg, setMsg] = useState('');
  const names = plan.spots.map((s) => s.spot.name);
  const two = plan.spots.length === 2;
  // 提前結束的原因已經在上面的提醒框，備註裡不重複。
  const notes = plan.notes.filter((n) => n !== plan.earlyReason);

  return (
    <article className={`${cardBase} flex flex-col`} aria-label={`${whenLabel}全日遊：${names.join('、')}`}>
      <div className={`grid ${two ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'}`}>
        {plan.spots.map((s) => (
          <SpotArt key={s.spot.id} name={s.spot.name} type={s.spot.types[0] ?? 'park'} image={s.spot.image} small={two} className={two ? 'h-28 w-full' : 'h-36 w-full'} iconClassName={two ? 'h-12 w-12' : 'h-16 w-16'} />
        ))}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            {whenLabel}・全日遊・{plan.style === 'explore' ? '親子探索日' : '親子輕鬆玩'}
          </p>
          <h3 className="text-xl leading-snug font-black break-words">{names.join(' → ')}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            去程約 {dl(plan.toFirst)}
            {plan.transfer !== null && `・兩地之間約 ${dl(plan.transfer)}`}・回程約 {dl(plan.backHome)}
            <span className="text-xs">（都是粗估）</span>
          </p>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            {formatClock(plan.leaveHome)} 出門，約 <span className="font-bold">{formatClock(plan.homeAt)}</span> 到家
          </p>
        </div>

        {plan.endsEarly && (
          <div role="note" className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950 ring-1 ring-sky-200 dark:bg-[#17252e] dark:text-sky-100 dark:ring-sky-900/60">
            <p className="font-bold">這是提前結束的安排，約 {formatClock(plan.homeAt)} 就到家</p>
            {plan.earlyReason && <p className="mt-0.5">{plan.earlyReason}</p>}
          </div>
        )}

        {plan.spots.some((s) => s.ageNote) && (
          <ul className="text-sm text-stone-700 dark:text-stone-300">
            {plan.spots.map((s) => s.ageNote && <li key={s.spot.id}>{two ? `${s.spot.name}：` : ''}{s.ageNote}</li>)}
          </ul>
        )}

        <TimelineSteps steps={plan.steps} />

        {notes.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-stone-700 dark:text-stone-300">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <div className="rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-card-dark-2">
          <p className="font-bold">午餐</p>
          <p className="text-stone-700 dark:text-stone-300">{plan.lunch.text}</p>
          {plan.lunch.refs.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-stone-700 dark:text-stone-300">
              {plan.lunch.refs.map((r) => (
                <li key={r.name}>
                  {r.name}：{r.note}
                </li>
              ))}
            </ul>
          )}
        </div>

        {plan.spots.map((s) => (
          <details key={s.spot.id} className="group rounded-xl bg-stone-100 px-3 py-2 text-sm dark:bg-card-dark-2" open={!two}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-bold [&::-webkit-details-marker]:hidden">
              <span>{two ? `${s.spot.name}：設施與出發前確認` : '推車、設施與出發前確認'}</span>
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <ul className="list-disc pl-4 text-stone-700 dark:text-stone-300">
              {s.facilities.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {s.checks.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-950 ring-1 ring-amber-200 dark:bg-[#2b2719] dark:text-amber-100 dark:ring-amber-900/60">
                <p className="font-bold">出發前先確認</p>
                <ul className="mt-0.5 list-disc pl-4">
                  {s.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
              資料狀態：{VERIFICATION_LABELS[s.verification.status]}
              {s.verification.verifiedAt ? `（${s.verification.verifiedAt} 查過）` : `（資料整理於 ${s.verification.lastUpdated}）`}
            </p>
          </details>
        ))}

        <p className="text-xs text-stone-600 dark:text-stone-400">時間是依你的出發地、午睡和條件算的；車程都是粗估，以導航為準。</p>

        <div className="grid grid-cols-2 gap-2">
          {plan.spots.map((s) => (
            <a key={s.spot.id} href={directionsUrl(s.spot)} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
              {two ? `導航到${s.spot.name.length > 6 ? `${s.spot.name.slice(0, 6)}…` : s.spot.name}` : 'Google 地圖導航'}
            </a>
          ))}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              aria-pressed={saved}
              className={saved ? `${buttonBase} border border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100` : primaryButton}
            >
              {saved ? '已保存' : '保存行程'}
            </button>
          )}
          {onShare && (
            <button type="button" onClick={() => void onShare().then(setMsg)} className={onSave ? secondaryButton : primaryButton}>
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
