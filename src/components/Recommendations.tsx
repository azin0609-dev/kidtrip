import { type ReactNode, useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { DRIVE_LABELS, conditionSummary } from '../lib/conditions.ts';
import { formatDrive } from '../lib/format.ts';
import { ENV_LABELS, FACILITY_LABELS, TYPE_LABELS } from '../lib/labels.ts';
import { MAX_DRIVE_OPTIONS, ROLE_LABELS, type RoundResult, type ScoredSpot } from '../lib/recommend.ts';
import { SLOTS, type Slot, type SlotWeather, formatSlotWeather, slotLabelWithDate } from '../lib/weather.ts';
import { Bolt, SleepySun } from './Brand.tsx';
import { SpotArt } from './SpotArt.tsx';
import { Chip, buttonBase } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';
const ghost = `${buttonBase} border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-card-dark dark:text-stone-200 dark:hover:bg-stone-800`;
const panel = 'rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-emerald-100 backdrop-blur dark:bg-card-dark/90 dark:ring-emerald-950';

/** 設施裡最影響帶小小孩出門的幾項，卡片上顯示第一個符合的（完整設施在「看詳細」）。 */
const KEY_FACILITIES = ['nursing', 'diaper', 'parking', 'shade'] as const;

export interface RecommendationsProps {
  today: string;
  round: RoundResult;
  slot: Slot;
  onSlot: (s: Slot) => void;
  /** 選定時段、出發地的天氣；抓不到是 null。 */
  weather: SlotWeather | null;
  maxDrive: number;
  onMaxDrive: (mins: number) => void;
  needStroller: boolean;
  onNeedStroller: (v: boolean) => void;
  rainy: boolean;
  /** 「可能下雨」是不是依預報自動決定的（還沒手動改過）。 */
  rainyIsAuto: boolean;
  onRainy: (v: boolean) => void;
  overnight: boolean;
  onOvernight: (v: boolean) => void;
  elders: boolean;
  onElders: (v: boolean) => void;
  onShuffle: () => void;
  onKidPick: () => void;
  /** 目前「這週放電計畫」的景點 id（有的話，那張卡會標示已選）。 */
  chosenId: string | null;
  onChoose: (spot: Spot) => void;
  /** 完整的景點卡（按「看詳細」才展開）。 */
  renderFull: (pick: ScoredSpot) => ReactNode;
}

/**
 * 推薦卡：只放會影響決定的資訊。
 * 第一張（本週首選）是完整大卡；手機上後面兩張用精簡版，桌面三張都用大卡並排。
 */
function PickCard({
  pick,
  compact,
  chosen,
  onChoose,
  children,
}: {
  pick: ScoredSpot;
  compact: boolean;
  chosen: boolean;
  onChoose: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { spot } = pick;
  const d = formatDrive(pick.mins);
  const canDo = spot.kid_label ?? spot.types.map((t) => TYPE_LABELS[t]).join('、');
  // 前兩個原因是車程和室內外，卡片上已經有了；只留後面會影響決定的。
  const why = pick.reasons.slice(2).join('・');
  const reminder = spot.open_note ?? spot.crowd_tip;
  const facilities = (spot.facilities ?? []).filter((f): f is (typeof KEY_FACILITIES)[number] =>
    (KEY_FACILITIES as readonly string[]).includes(f),
  );
  const facts = [
    ENV_LABELS[spot.env],
    spot.age_best && `建議 ${spot.age_best[0]}–${spot.age_best[1]}${spot.age_best[1] === 12 ? '+' : ''} 歲`,
    spot.stroller_ok ? '推車 OK' : '推車不方便',
    ...facilities.slice(0, 1).map((f) => FACILITY_LABELS[f]),
  ].filter((x): x is string => Boolean(x));

  return (
    <li
      className={`flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 dark:bg-card-dark ${
        chosen ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : 'ring-emerald-100 dark:ring-emerald-950'
      }`}
    >
      <div className={compact ? 'flex gap-3 p-3 pb-0 md:block md:p-0' : ''}>
        <div className={`relative shrink-0 ${compact ? 'md:w-full' : ''}`}>
          <SpotArt
            name={spot.name}
            type={spot.types[0] ?? 'park'}
            image={spot.image}
            className={compact ? 'h-20 w-20 rounded-2xl md:h-32 md:w-full md:rounded-none' : 'h-24 w-full md:h-32'}
            iconClassName={compact ? 'h-12 w-12 md:h-20 md:w-20' : 'h-16 w-16 md:h-20 md:w-20'}
          />
          {pick.role && (
            <span
              className={`absolute top-2 left-2 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm dark:bg-emerald-400 dark:text-stone-950 ${
                compact ? 'hidden md:inline-block' : ''
              }`}
            >
              {ROLE_LABELS[pick.role]}
            </span>
          )}
        </div>
        {compact && (
          <div className="min-w-0 flex-1 md:hidden">
            {pick.role && <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{ROLE_LABELS[pick.role]}</p>}
            <h3 className="text-base leading-snug font-bold break-words">{spot.name}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {spot.city}・約 {d.value} {d.unit}
              <span className="text-xs">（粗估）</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
        <div className={`flex items-start justify-between gap-3 ${compact ? 'hidden md:flex' : ''}`}>
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-bold break-words">{spot.name}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-2xl leading-none font-black text-emerald-800 dark:text-emerald-300">
              <span className="mr-0.5 text-sm font-normal">約</span>
              {d.value}
              <span className="ml-0.5 text-sm font-normal">{d.unit}</span>
            </div>
            <div className="mt-1 text-[11px] text-stone-600 dark:text-stone-400">車程粗估</div>
          </div>
        </div>

        <ul className="flex flex-wrap gap-1.5" aria-label="重點">
          {facts.map((f) => (
            <li key={f} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              {f}
            </li>
          ))}
        </ul>

        <p className="text-sm text-stone-800 dark:text-stone-200">
          <span className="font-bold">可以玩：</span>
          {canDo}
          {why && <span className="text-stone-600 dark:text-stone-400">・{why}</span>}
        </p>

        {reminder && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2f2614] dark:text-amber-100 dark:ring-amber-900">
            <span className="font-bold">出發前先知道：</span>
            {reminder}
          </p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            aria-pressed={chosen}
            onClick={onChoose}
            className={`${buttonBase} ${
              chosen
                ? 'border border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100'
                : 'bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300'
            }`}
          >
            {chosen ? '已選這裡' : '就去這裡'}
          </button>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={ghost}>
            {open ? '收起詳細' : '看詳細'}
          </button>
        </div>

        {open && <div className="mt-1">{children}</div>}
      </div>
    </li>
  );
}

export function Recommendations(props: RecommendationsProps) {
  const { today, round, slot, weather, maxDrive, rainy, overnight, elders, needStroller, chosenId } = props;
  const { picks, status } = round;
  const summary = conditionSummary({ maxDrive, overnight, needStroller, rainy, elders });

  return (
    <section aria-labelledby="recommend-title" className="mb-8">
      <div className={panel}>
        <h2 id="recommend-title" className="text-2xl font-black text-emerald-900 dark:text-emerald-50">
          本週放電提案
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">幫你挑好 3 個適合全家的地方</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">什麼時候去</span>
            <select
              value={slot}
              onChange={(e) => props.onSlot(e.target.value as Slot)}
              className={`min-h-11 rounded-full border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-900 dark:border-emerald-800 dark:bg-card-dark-2 dark:text-emerald-50 ${focus}`}
            >
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {slotLabelWithDate(today, s)}
                </option>
              ))}
            </select>
          </label>
          <p
            className={`rounded-full px-3 py-1.5 text-sm ${
              weather?.rainy
                ? 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100'
                : weather
                  ? 'bg-amber-50 text-amber-950 dark:bg-[#2f2614] dark:text-amber-100'
                  : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
            }`}
          >
            {(weather && formatSlotWeather(weather)) || '還沒有預報（不代表不會下雨）'}
          </p>
        </div>

        <details className="group mt-2">
          <summary
            className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 text-sm dark:bg-card-dark-2 [&::-webkit-details-marker]:hidden ${focus}`}
          >
            <span className="min-w-0">
              <span className="font-bold text-emerald-900 dark:text-emerald-100">條件：</span>
              <span className="text-stone-700 dark:text-stone-300">{summary}</span>
            </span>
            <span className="shrink-0 font-bold text-emerald-800 dark:text-emerald-300">
              調整
              <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-90">
                ›
              </span>
            </span>
          </summary>
          <div className="mt-2 flex flex-col gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="單程最多開多久">
              <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">單程最多（車程是粗估）</span>
              {MAX_DRIVE_OPTIONS.map((m) => (
                <Chip key={m} pressed={!overnight && maxDrive === m} onClick={() => props.onMaxDrive(m)}>
                  {DRIVE_LABELS[m]}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="出門狀況">
              <span className="w-full text-xs font-medium text-stone-600 dark:text-stone-400">出門狀況</span>
              <Chip pressed={needStroller} onClick={() => props.onNeedStroller(!needStroller)}>
                帶推車
              </Chip>
              <Chip pressed={rainy} onClick={() => props.onRainy(!rainy)}>
                可能下雨
              </Chip>
              <Chip pressed={elders} onClick={() => props.onElders(!elders)}>
                長輩同行
              </Chip>
              <Chip pressed={overnight} onClick={() => props.onOvernight(!overnight)}>
                這週要住一晚
              </Chip>
            </div>
            {overnight && (
              <p className="text-xs text-stone-600 dark:text-stone-400">住一晚時只推車程 1 小時以上、附近有整理好住宿的地方。</p>
            )}
          </div>
        </details>
        {weather?.rainy && props.rainyIsAuto && rainy && (
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            那個時段降雨機率高，已自動打開「可能下雨」，只推室內或有遮棚的；想去戶外可以在「調整」裡關掉。
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 md:max-w-md">
          <button type="button" onClick={props.onShuffle} disabled={picks.length === 0} className={`${ghost} disabled:opacity-50`}>
            <Bolt className="h-4 w-4 text-amber-400" />
            再找一組
          </button>
          <button
            type="button"
            onClick={props.onKidPick}
            disabled={picks.length === 0}
            className={`${buttonBase} bg-amber-400 text-stone-950 hover:bg-amber-300 disabled:opacity-50`}
          >
            換我決定！
          </button>
        </div>
      </div>

      {status === 'last' && (
        <p role="status" className={`${panel} mt-3 text-sm text-stone-700 dark:text-stone-300`}>
          符合條件的只剩這{picks.length === 1 ? '一個' : '幾個'}沒看過。再按「再找一組」會從頭開始。
        </p>
      )}
      {status === 'restarted' && (
        <p role="status" className={`${panel} mt-3 text-sm text-stone-700 dark:text-stone-300`}>
          符合條件的都看過了，這一組是從頭再來的。想看更多可以把「單程最多」調遠一點。
        </p>
      )}

      {picks.length === 0 ? (
        <div className={`${panel} mt-3 flex flex-col items-center gap-2 text-center`}>
          <SleepySun className="h-16 w-24" />
          <p className="text-sm text-stone-700 dark:text-stone-300">
            這些條件下沒有適合的地方。試試把「單程最多」調遠一點，或關掉幾個條件。太久沒確認的景點也不會推薦，如果一直是空的，代表資料該更新了。
          </p>
        </div>
      ) : (
        <>
          {picks.length < 3 && status === 'ok' && (
            <p className={`${panel} mt-3 text-sm text-stone-700 dark:text-stone-300`}>
              符合條件的只有 {picks.length} 個。想多看幾個可以把「單程最多」調遠一點。
            </p>
          )}
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" aria-live="polite">
            {picks.map((p, i) => (
              <PickCard
                key={p.spot.id}
                pick={p}
                compact={i > 0}
                chosen={chosenId === p.spot.id}
                onChoose={() => props.onChoose(p.spot)}
              >
                {props.renderFull(p)}
              </PickCard>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
