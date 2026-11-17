import type { ReactNode } from 'react';
import type { ScoredSpot } from '../lib/recommend.ts';
import { type WeekendWeather, formatDay } from '../lib/weather.ts';
import { Dino } from './Dino.tsx';
import { Chip, buttonBase } from './ui.tsx';

export interface RecommendationsProps {
  picks: ScoredSpot[];
  rainy: boolean;
  /** 「這週可能下雨」是不是依天氣預報自動決定的（使用者還沒手動改過）。 */
  rainyIsAuto: boolean;
  weather: WeekendWeather | null;
  overnight: boolean;
  elders: boolean;
  onElders: (v: boolean) => void;
  onRainy: (v: boolean) => void;
  onOvernight: (v: boolean) => void;
  onShuffle: () => void;
  renderCard: (pick: ScoredSpot) => ReactNode;
}

export function Recommendations({
  picks,
  rainy,
  rainyIsAuto,
  weather,
  overnight,
  elders,
  onElders,
  onRainy,
  onOvernight,
  onShuffle,
  renderCard,
}: RecommendationsProps) {
  return (
    <section aria-labelledby="recommend-title" className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recommend-title" className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
          小恐龍的這週推薦
        </h2>
        <button
          type="button"
          onClick={onShuffle}
          disabled={picks.length === 0}
          className={`${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`}
        >
          換一組
        </button>
      </div>

      {weather && (
        <div
          className={`mt-2 rounded-2xl px-3 py-2 text-sm ${
            weather.rainy
              ? 'bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100'
              : 'bg-amber-50 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100'
          }`}
        >
          <p className="font-bold">{weather.rainy ? '週末可能下雨，先幫你挑室內的' : '週末天氣看起來可以出門'}</p>
          <ul className="mt-0.5">
            {weather.days.map((d) => (
              <li key={d.date}>{formatDay(d)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <Chip pressed={rainy} onClick={() => onRainy(!rainy)}>
          這週可能下雨
        </Chip>
        <Chip pressed={overnight} onClick={() => onOvernight(!overnight)}>
          這週要住一晚
        </Chip>
        <Chip pressed={elders} onClick={() => onElders(!elders)}>
          長輩一起去
        </Chip>
      </div>
      {weather && rainyIsAuto && rainy && (
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
          「這週可能下雨」是依預報自動打開的，想去戶外可以按一下關掉。
        </p>
      )}

      {picks.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-3xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
          <Dino mood="sleepy" className="h-20 w-20" />
          <p className="text-sm text-stone-700 dark:text-stone-300">
            這週沒有適合推薦的地方。試試打開「這週要住一晚」，或關掉「這週可能下雨」「長輩一起去」。
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" aria-live="polite">
          {picks.map((p) => renderCard(p))}
        </div>
      )}
    </section>
  );
}
