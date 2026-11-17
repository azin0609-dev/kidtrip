import { type ReactNode, useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { formatDrive } from '../lib/format.ts';
import { TYPE_LABELS } from '../lib/labels.ts';
import { MAX_DRIVE_OPTIONS, ROLE_LABELS, type RoundResult, type ScoredSpot } from '../lib/recommend.ts';
import { SLOTS, type Slot, type SlotWeather, formatSlotWeather, slotLabelWithDate } from '../lib/weather.ts';
import { Dino } from './Dino.tsx';
import { Chip, buttonBase } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';
const ghost = `${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`;

const DRIVE_LABELS: Record<number, string> = { 30: '30 分', 45: '45 分', 60: '1 小時', 120: '2 小時' };

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
  /** 目前「這週要去」的景點 id（有的話，那張卡會標示已選）。 */
  chosenId: string | null;
  onChoose: (spot: Spot) => void;
  /** 完整的景點卡（按「看詳細」才展開）。 */
  renderFull: (pick: ScoredSpot) => ReactNode;
}

/** 推薦短卡：只放會影響決定的資訊。 */
function PickCard({
  pick,
  chosen,
  onChoose,
  children,
}: {
  pick: ScoredSpot;
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

  return (
    <li
      className={`flex min-w-0 flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 dark:bg-[#16241c] ${
        chosen ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : 'ring-emerald-100 dark:ring-emerald-950'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {pick.role && (
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{ROLE_LABELS[pick.role]}</p>
          )}
          <h3 className="text-lg leading-snug font-bold break-words">{spot.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl leading-none font-bold">
            <span className="mr-0.5 text-sm font-normal">約</span>
            {d.value}
            <span className="ml-0.5 text-sm font-normal">{d.unit}</span>
          </div>
          <div className="mt-1 text-xs text-stone-600 dark:text-stone-400">{pick.reasons[1]}</div>
        </div>
      </div>

      <p className="text-sm text-stone-800 dark:text-stone-200">
        <span className="font-medium">可以玩：</span>
        {canDo}
        {why && <span className="text-stone-600 dark:text-stone-400">・{why}</span>}
      </p>

      {reminder && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-bold">先知道：</span>
          {reminder}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
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
    </li>
  );
}

export function Recommendations(props: RecommendationsProps) {
  const { today, round, slot, weather, maxDrive, rainy, overnight, elders, needStroller, chosenId } = props;
  const { picks, status } = round;
  const moreActive = (overnight ? 1 : 0) + (elders ? 1 : 0);

  return (
    <section aria-labelledby="recommend-title" className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recommend-title" className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
          小恐龍的這週推薦
        </h2>
        <button type="button" onClick={props.onShuffle} disabled={picks.length === 0} className={`${ghost} disabled:opacity-50`}>
          換一組
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">什麼時候去</span>
          <select
            value={slot}
            onChange={(e) => props.onSlot(e.target.value as Slot)}
            className={`min-h-11 rounded-full border border-stone-300 bg-white px-3 text-sm font-bold text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`}
          >
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {slotLabelWithDate(today, s)}
              </option>
            ))}
          </select>
        </label>
        <p
          className={`rounded-full px-3 py-2 text-sm ${
            weather?.rainy
              ? 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100'
              : 'bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100'
          }`}
        >
          {weather ? formatSlotWeather(weather) || '這個時段還沒有預報' : '這個時段還沒有預報'}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="單程最多開多久">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">單程最多</span>
        {MAX_DRIVE_OPTIONS.map((m) => (
          <Chip key={m} pressed={!overnight && maxDrive === m} onClick={() => props.onMaxDrive(m)}>
            {DRIVE_LABELS[m]}
          </Chip>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Chip pressed={needStroller} onClick={() => props.onNeedStroller(!needStroller)}>
          帶推車
        </Chip>
        <Chip pressed={rainy} onClick={() => props.onRainy(!rainy)}>
          可能下雨
        </Chip>
      </div>
      {weather?.rainy && props.rainyIsAuto && rainy && (
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
          那個時段降雨機率高，「可能下雨」已自動打開，只推室內或有遮棚的；想去戶外可以按一下關掉。
        </p>
      )}

      <details className="group mt-1" open={moreActive > 0 || undefined}>
        <summary
          className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-medium text-emerald-800 dark:text-emerald-300 [&::-webkit-details-marker]:hidden ${focus}`}
        >
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
            ›
          </span>
          更多條件{moreActive > 0 && `（已選 ${moreActive}）`}
        </summary>
        <div className="mt-1 flex flex-wrap gap-2">
          <Chip pressed={overnight} onClick={() => props.onOvernight(!overnight)}>
            這週要住一晚
          </Chip>
          <Chip pressed={elders} onClick={() => props.onElders(!elders)}>
            長輩一起去
          </Chip>
        </div>
        {overnight && (
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">住一晚時只推車程 1 小時以上、附近有整理好住宿的地方。</p>
        )}
      </details>

      {status === 'last' && (
        <p role="status" className="mt-3 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300">
          符合條件的只剩這{picks.length === 1 ? '一個' : '幾個'}沒看過。再按「換一組」會從頭開始。
        </p>
      )}
      {status === 'restarted' && (
        <p role="status" className="mt-3 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300">
          符合條件的都看過了，這一組是從頭再來的。想看更多可以把「單程最多」調遠一點。
        </p>
      )}

      {picks.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-3xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
          <Dino mood="sleepy" className="h-20 w-20" />
          <p className="text-sm text-stone-700 dark:text-stone-300">
            這些條件下沒有適合的地方。試試把「單程最多」調遠一點，或關掉幾個條件。
          </p>
        </div>
      ) : (
        <>
          {picks.length < 3 && status === 'ok' && (
            <p className="mt-3 text-sm text-stone-700 dark:text-stone-300">
              符合條件的只有 {picks.length} 個。想多看幾個可以把「單程最多」調遠一點。
            </p>
          )}
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" aria-live="polite">
            {picks.map((p) => (
              <PickCard key={p.spot.id} pick={p} chosen={chosenId === p.spot.id} onChoose={() => props.onChoose(p.spot)}>
                {props.renderFull(p)}
              </PickCard>
            ))}
          </ul>
          <button type="button" onClick={props.onKidPick} className={`${buttonBase} mt-3 w-full bg-amber-400 text-stone-950 hover:bg-amber-300`}>
            <Dino className="h-7 w-7" />
            給小孩選（大圖模式）
          </button>
        </>
      )}
    </section>
  );
}
