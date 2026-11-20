import { type ReactNode, useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { DRIVE_LABELS, conditionSummary } from '../lib/conditions.ts';
import { formatDrive } from '../lib/format.ts';
import { ENV_LABELS, FACILITY_LABELS } from '../lib/labels.ts';
import { MAX_DRIVE_OPTIONS, ROLE_LABELS, type RoundResult, type ScoredSpot } from '../lib/recommend.ts';
import { explainPick } from '../lib/explain.ts';
import { bookingNotice, destinationWeatherNote } from '../lib/trip-risks.ts';
import { type Slot, type SlotWeather, formatSlotWeather, slotLabelWithDate, slotWeather } from '../lib/weather.ts';
import { useForecast } from '../hooks/useWeekendWeather.ts';
import { Bolt, SleepySun } from './Brand.tsx';
import { SpotArt } from './SpotArt.tsx';
import { Chip, buttonBase, cardBase, primaryButton, secondaryButton } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';

/** 設施裡最影響帶小小孩出門的幾項，卡片上顯示第一個符合的（完整設施在「看詳細」）。 */
const KEY_FACILITIES = ['nursing', 'diaper', 'parking', 'shade'] as const;

export interface RecommendationsProps {
  today: string;
  round: RoundResult;
  slot: Slot;
  /** 可以選的時段（週日不會有週六）。 */
  slots: readonly Slot[];
  onSlot: (s: Slot) => void;
  /** 出發地的短名稱，例如「林口區」。 */
  originLabel: string;
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
  /** 打開「幫我規劃出遊」（半日或全日）。 */
  onFamilyPlan: () => void;
  /** 目前「這週放電計畫」的景點 id（有的話，那張卡會標示已選）。 */
  chosenId: string | null;
  onChoose: (spot: Spot) => void;
  /** 完整的景點卡（按「看詳細」才展開）。 */
  renderFull: (pick: ScoredSpot) => ReactNode;
}

/** 卡片上的重點：建議年齡、推車、最重要的一個設施。 */
function factsOf(spot: Spot): string[] {
  const facility = (spot.facilities ?? []).find((f): f is (typeof KEY_FACILITIES)[number] => (KEY_FACILITIES as readonly string[]).includes(f));
  return [
    spot.age_best && `建議 ${spot.age_best[0]}–${spot.age_best[1]}${spot.age_best[1] === 12 ? '+' : ''} 歲`,
    spot.stroller_ok ? '推車 OK' : '推車不方便',
    facility && FACILITY_LABELS[facility],
  ].filter((x): x is string => Boolean(x));
}

/** 卡片要知道的時段：用來看目的地那時候的天氣。 */
interface When {
  today: string;
  slot: Slot;
}

/** 目的地那個時段的天氣提醒（遠的地方也要看目的地，不只看出發地）。 */
function useDestinationNote(spot: Spot, mins: number, when: When): string | null {
  const point = spot.lat !== null && spot.lng !== null ? { lat: spot.lat, lng: spot.lng } : null;
  const forecast = useForecast(point);
  const w = forecast ? slotWeather(forecast, when.today, when.slot) : null;
  return destinationWeatherNote(spot, w, mins > 45);
}

/** 出發前要先知道的事：預約購票（結構化）、開放規定、目的地天氣。重要的直接顯示，不藏進「看詳細」。 */
function checks(spot: Spot, weatherNote: string | null): string[] {
  const booking = bookingNotice(spot);
  return [booking && `${booking}。`, spot.open_note ?? spot.crowd_tip, weatherNote].filter((x): x is string => Boolean(x));
}

function Reminder({ items, small }: { items: string[]; small?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div
      className={`rounded-xl bg-amber-50 text-amber-950 ring-1 ring-amber-200 dark:bg-[#2b2719] dark:text-amber-100 dark:ring-amber-900/60 ${
        small ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      <p className="font-bold">出發前先確認</p>
      <ul className="mt-0.5 list-disc pl-4">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 「幫我規劃出遊」入口。不管推薦有幾個（0 也一樣）都看得到：規劃工具有自己的條件，推薦是空的時候也可能排得出來。
 * bar：細長一條，放在推薦卡上面（手機）或空狀態裡；block：桌面版放在右欄。
 */
function PlannerEntry({ onClick, variant, className = '' }: { onClick: () => void; variant: 'bar' | 'block'; className?: string }) {
  if (variant === 'block') {
    return (
      <button type="button" onClick={onClick} className={`${secondaryButton} min-h-14 w-full flex-col gap-0 rounded-2xl ${className}`}>
        <span className="text-base font-black">幫我規劃出遊</span>
        <span className="text-xs font-medium text-stone-600 dark:text-stone-400">半日或全日：幾點出門、玩多久、怎麼睡午覺</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buttonBase} min-h-12 w-full justify-between gap-3 rounded-2xl bg-white px-4 text-left shadow-sm ring-1 ring-stone-200 hover:bg-stone-50 dark:bg-card-dark dark:ring-stone-800 dark:hover:bg-card-dark-2 ${className}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-black text-stone-900 dark:text-stone-50">幫我規劃出遊</span>
        <span className="block text-xs font-medium text-stone-600 dark:text-stone-400">半日或全日，幫你排好時間和午睡</span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-lg font-bold text-emerald-800 dark:text-emerald-300">
        ›
      </span>
    </button>
  );
}

function ChooseButtons({ chosen, open, onChoose, onToggle, big }: { chosen: boolean; open: boolean; onChoose: () => void; onToggle: () => void; big?: boolean }) {
  return (
    <div className={`grid gap-2 ${big ? 'grid-cols-[1.6fr_1fr]' : 'grid-cols-2'}`}>
      <button
        type="button"
        aria-pressed={chosen}
        onClick={onChoose}
        className={`${
          chosen
            ? `${buttonBase} border border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100`
            : primaryButton
        } ${big ? 'min-h-12 text-base' : ''}`}
      >
        {chosen ? '已選這裡' : '就去這裡'}
      </button>
      <button type="button" aria-expanded={open} onClick={onToggle} className={`${secondaryButton} ${big ? 'min-h-12 text-base' : ''}`}>
        {open ? '收起詳細' : '看詳細'}
      </button>
    </div>
  );
}

/** 本週首選：大圖＋完整資訊，是這一區最顯眼的卡。 */
function HeroCard({ pick, chosen, onChoose, when, originLabel, children }: { pick: ScoredSpot; chosen: boolean; onChoose: () => void; when: When; originLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { spot } = pick;
  const d = formatDrive(pick.mins);
  const weatherNote = useDestinationNote(spot, pick.mins, when);
  const reminders = checks(spot, weatherNote);
  return (
    <article className={`${cardBase} shadow-md ${chosen ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : ''}`}>
      <div className="relative">
        <SpotArt
          name={spot.name}
          type={spot.types[0] ?? 'park'}
          image={spot.image}
          className="h-[180px] w-full md:h-[300px]"
          iconClassName="h-24 w-24 md:h-28 md:w-28"
        />
        {pick.role && (
          <span className="absolute top-3 left-3 rounded-full bg-amber-400 px-3 py-1 text-sm font-black text-stone-950 shadow">
            {ROLE_LABELS[pick.role]}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-4 md:gap-3 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl leading-snug font-black break-words md:text-2xl">{spot.name}</h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {spot.city}・{ENV_LABELS[spot.env]}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[1.75rem] leading-none font-black text-emerald-800 dark:text-emerald-300">
              <span className="mr-0.5 text-sm font-medium">約</span>
              {d.value}
              <span className="ml-0.5 text-sm font-medium">{d.unit}</span>
            </div>
            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">車程粗估</div>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="重點">
          {factsOf(spot).map((f) => (
            <li key={f} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800 dark:bg-stone-800 dark:text-stone-200">
              {f}
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-relaxed text-stone-800 dark:text-stone-200">
          <span className="font-bold">為什麼適合：</span>
          {explainPick(pick, originLabel)}
        </p>
        <Reminder items={reminders} />
        <ChooseButtons big chosen={chosen} open={open} onChoose={onChoose} onToggle={() => setOpen(!open)} />
        {open && <div>{children}</div>}
      </div>
    </article>
  );
}

/** 第二、三個選擇：縮圖＋重點，一樣有清楚的操作按鈕。 */
function CompactCard({ pick, chosen, onChoose, when, children }: { pick: ScoredSpot; chosen: boolean; onChoose: () => void; when: When; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { spot } = pick;
  const d = formatDrive(pick.mins);
  const weatherNote = useDestinationNote(spot, pick.mins, when);
  const reminders = checks(spot, weatherNote);
  const facts = factsOf(spot).slice(0, 2).join('・');
  return (
    <li className={`${cardBase} flex flex-col gap-2.5 p-3 ${chosen ? 'ring-2 ring-emerald-600 dark:ring-emerald-400' : ''}`}>
      <div className="flex gap-3">
        <SpotArt
          name={spot.name}
          type={spot.types[0] ?? 'park'}
          image={spot.image}
          small
          className="h-24 w-24 shrink-0 rounded-2xl"
          iconClassName="h-12 w-12"
        />
        <div className="min-w-0 flex-1">
          {pick.role && <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{ROLE_LABELS[pick.role]}</p>}
          <h3 className="leading-snug font-bold break-words">{spot.name}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">{spot.city}</p>
          <p className="mt-0.5 text-sm text-stone-800 dark:text-stone-200">
            <span className="font-bold">
              約 {d.value} {d.unit}
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">（粗估）</span>
            {facts && `・${facts}`}
          </p>
        </div>
      </div>
      <Reminder small items={reminders} />
      <ChooseButtons chosen={chosen} open={open} onChoose={onChoose} onToggle={() => setOpen(!open)} />
      {open && <div>{children}</div>}
    </li>
  );
}

export function Recommendations(props: RecommendationsProps) {
  const { today, round, slot, weather, maxDrive, rainy, overnight, elders, needStroller, chosenId } = props;
  const { picks, status } = round;
  const [hero, ...others] = picks;
  const summary = conditionSummary({ maxDrive, overnight, needStroller, rainy, elders });
  const weatherText = (weather && formatSlotWeather(weather)) || '還沒有預報，不代表不會下雨';
  const when: When = { today, slot };

  return (
    <section aria-labelledby="recommend-title" className="mb-8">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="recommend-title" className="text-2xl font-black text-stone-900 md:text-3xl dark:text-stone-50">
            本週放電提案
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {picks.length > 0 ? `幫你挑好 ${picks.length} 個適合全家的地方` : '這些條件下還沒找到適合的地方'}
          </p>
        </div>
        <button type="button" onClick={props.onShuffle} disabled={picks.length === 0} className={`${secondaryButton} shrink-0 disabled:opacity-50`}>
          <Bolt className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          再找一組
        </button>
      </div>

      {/* 日期和天氣排成一行。 */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-1 pr-3 shadow-sm ring-1 ring-stone-200 md:max-w-xl dark:bg-card-dark dark:ring-stone-800">
        <label className="shrink-0">
          <span className="sr-only">什麼時候去</span>
          <select
            value={slot}
            onChange={(e) => props.onSlot(e.target.value as Slot)}
            className={`min-h-11 rounded-xl bg-stone-100 px-2.5 text-sm font-bold text-stone-900 dark:bg-card-dark-2 dark:text-stone-50 ${focus}`}
          >
            {props.slots.map((s) => (
              <option key={s} value={s}>
                {slotLabelWithDate(today, s)}
              </option>
            ))}
          </select>
        </label>
        <p className={`min-w-0 text-[13px] leading-snug ${weather?.rainy ? 'font-bold text-sky-800 dark:text-sky-300' : 'text-stone-700 dark:text-stone-300'}`}>
          {weatherText}
        </p>
      </div>

      {/* 條件：收起來只有一行摘要，點開才調整。 */}
      <details className="group mt-2 md:max-w-xl">
        <summary
          className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-1 text-sm [&::-webkit-details-marker]:hidden ${focus}`}
        >
          <span className="shrink-0 font-bold text-stone-900 dark:text-stone-100">條件</span>
          <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-400">{summary}</span>
          <span className="shrink-0 font-bold text-emerald-800 dark:text-emerald-300">
            調整
            <span aria-hidden="true" className="ml-0.5 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
          </span>
        </summary>
        <div className={`${cardBase} mt-1 flex flex-col gap-3 p-4`}>
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
          {overnight && <p className="text-xs text-stone-600 dark:text-stone-400">住一晚時只推附近有整理好住宿的地方；當天來回就到得了的，分數會少一點。</p>}
        </div>
      </details>
      {weather?.rainy && props.rainyIsAuto && rainy && (
        <p className="px-1 text-xs text-stone-600 dark:text-stone-400">
          那個時段降雨機率高，已自動打開「可能下雨」，只推室內或有遮棚的；想去戶外可以在「調整」裡關掉。
        </p>
      )}

      {status === 'last' && (
        <p role="status" className="mt-2 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 dark:bg-card-dark dark:text-stone-300">
          符合條件的只剩這{picks.length === 1 ? '一個' : '幾個'}沒看過。再按「再找一組」會從頭開始。
        </p>
      )}
      {status === 'restarted' && (
        <p role="status" className="mt-2 rounded-xl bg-stone-100 p-3 text-sm text-stone-700 dark:bg-card-dark dark:text-stone-300">
          符合條件的都看過了，這一組是從頭再來的。想看更多可以把「單程最多」調遠一點。
        </p>
      )}

      {/* 手機：推薦卡上面就看得到規劃入口；沒有推薦時每種螢幕都顯示。 */}
      <PlannerEntry onClick={props.onFamilyPlan} variant="bar" className={hero ? 'mt-2 md:hidden' : 'mt-3'} />

      {!hero ? (
        <div className={`${cardBase} mt-3 flex flex-col items-center gap-2 p-6 text-center`}>
          <SleepySun className="h-16 w-24" />
          <p className="text-sm text-stone-700 dark:text-stone-300">
            這些條件下沒有適合的地方。試試把「單程最多」調遠一點，或關掉幾個條件。太久沒確認的景點也不會推薦，如果一直是空的，代表資料該更新了。
          </p>
          <p className="text-sm text-stone-700 dark:text-stone-300">也可以直接用上面的「幫我規劃出遊」，用自己的條件排排看。</p>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3" aria-live="polite">
          <div className="md:col-span-2">
            <HeroCard pick={hero} chosen={chosenId === hero.spot.id} onChoose={() => props.onChoose(hero.spot)} when={when} originLabel={props.originLabel}>
              {props.renderFull(hero)}
            </HeroCard>
          </div>
          <div className="flex flex-col gap-3">
            {others.length > 0 && (
              <>
                <h3 className="px-1 text-sm font-bold text-stone-600 dark:text-stone-400">也可以考慮</h3>
                <ul className="flex flex-col gap-3">
                  {others.map((p) => (
                    <CompactCard key={p.spot.id} pick={p} chosen={chosenId === p.spot.id} onChoose={() => props.onChoose(p.spot)} when={when}>
                      {props.renderFull(p)}
                    </CompactCard>
                  ))}
                </ul>
              </>
            )}
            {picks.length < 3 && status === 'ok' && (
              <p className="px-1 text-sm text-stone-600 dark:text-stone-400">
                符合條件的只有 {picks.length} 個。想多看幾個可以把「單程最多」調遠一點。
              </p>
            )}
            <button
              type="button"
              onClick={props.onKidPick}
              className={`${buttonBase} min-h-14 w-full flex-col gap-0 rounded-2xl bg-amber-400 text-stone-950 hover:bg-amber-300`}
            >
              <span className="text-base font-black">換我決定！</span>
              <span className="text-xs font-medium">讓小孩從這 {picks.length} 個裡挑一個</span>
            </button>
            {/* 桌面版放右欄；手機已經在推薦卡上面。 */}
            <div className="hidden md:block">
              <PlannerEntry onClick={props.onFamilyPlan} variant="block" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
