import { useState } from 'react';
import type { Spot } from '../data/schema.ts';
import { formatDrive } from '../lib/format.ts';
import { directionsUrl, officialInfoUrl } from '../lib/links.ts';
import { type SlotWeather, formatSlotWeather } from '../lib/weather.ts';
import { Flag } from './Brand.tsx';
import { buttonBase } from './ui.tsx';

const ghost = `${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`;
const primary = `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`;

export interface WeekPlanCardProps {
  spot: Spot;
  backup: Spot | null;
  /** 「週六上午 11/21」；保存了全日遊是「週六 11/21・全日遊」 */
  when: string;
  /** 全日遊的第二站（兩站行程才有）；WeekPlan 本身只記第一站。 */
  nextStop?: Spot | null;
  mins: number | null;
  /** 目的地那個時段的天氣；抓不到是 null。 */
  weather: SlotWeather | null;
  /** 配合午睡的出門建議。 */
  napText: string | null;
  onSwapToBackup: () => void;
  onClear: () => void;
  /** 產生行程連結並分享；回傳要顯示的訊息。 */
  onShare: () => Promise<string>;
}

/** 首頁置頂的「這週放電計畫」：選好之後，週末打開還在（只存在這支手機）。 */
export function WeekPlanCard({ spot, backup: rawBackup, when, nextStop = null, mins, weather, napText, onSwapToBackup, onClear, onShare }: WeekPlanCardProps) {
  const [msg, setMsg] = useState('');
  // 雨備剛好就是全日遊的第二站：不重複列。
  const backup = rawBackup && nextStop && rawBackup.id === nextStop.id ? null : rawBackup;
  const d = mins === null ? null : formatDrive(mins);
  const rainRisk = weather?.rainy && spot.env !== 'in';
  const nextRain = weather?.rainy && nextStop !== null && nextStop.env !== 'in';

  return (
    <section
      aria-labelledby="weekplan-title"
      className="mb-6 rounded-3xl bg-emerald-700 p-4 text-white shadow-md dark:bg-card-dark-2 dark:ring-1 dark:ring-emerald-800"
    >
      <div className="flex items-center gap-2">
        <Flag className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <h2 id="weekplan-title" className="text-sm font-bold text-emerald-100">
            這週放電計畫・{when}
          </h2>
          {nextStop ? (
            <p className="text-xl leading-snug font-extrabold break-words">
              <span className="mr-1.5 inline-block rounded-full bg-amber-400 px-2 py-0.5 align-middle text-xs font-bold text-stone-950">兩站</span>
              {spot.name} → {nextStop.name}
            </p>
          ) : (
            <p className="text-xl leading-snug font-extrabold break-words">{spot.name}</p>
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1 text-sm text-emerald-50">
        <li>
          {nextStop && '第一站：'}
          {spot.city}
          {d && `・車程約 ${d.value} ${d.unit}（粗估，以導航為準）`}
        </li>
        {nextStop && (
          <li>
            第二站：{nextStop.name}（{nextStop.city}）
          </li>
        )}
        {nextRain && <li className="font-bold text-amber-200">第二站{nextStop.env === 'semi' ? '有遮棚，雨大要注意' : '大部分在戶外'}，那時候可能下雨。</li>}
        {weather && <li>目的地那時候：{formatSlotWeather(weather) || '還沒有預報'}</li>}
        {napText && <li>{napText}</li>}
        {spot.open_note && <li className="font-bold text-amber-200">先知道：{spot.open_note}</li>}
        {backup && <li>下雨不掃興：{backup.name}</li>}
      </ul>

      {rainRisk && (
        <div className="mt-3 rounded-2xl bg-white/15 p-3 text-sm">
          <p>那個時段降雨機率高，{spot.env === 'semi' ? '這裡有遮棚、小雨還可以' : '這裡大部分在戶外'}。</p>
          {backup && (
            <button type="button" onClick={onSwapToBackup} className={`${buttonBase} mt-2 bg-white text-emerald-900 hover:bg-emerald-50`}>
              改去雨備：{backup.name}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer" className={`${buttonBase} bg-white text-emerald-900 hover:bg-emerald-50`}>
          {nextStop ? '看第一站路線' : '看路線'}
        </a>
        <button type="button" onClick={() => void onShare().then(setMsg)} className={`${buttonBase} bg-amber-400 text-stone-950 hover:bg-amber-300`}>
          傳給另一半
        </button>
        <a
          href={officialInfoUrl(spot)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBase} border border-white/50 text-white hover:bg-white/10`}
        >
          {spot.official_url ? '官方資訊' : '查官方資訊'}
        </a>
        <button type="button" onClick={onClear} className={`${buttonBase} border border-white/50 text-white hover:bg-white/10`}>
          取消這週行程
        </button>
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm text-emerald-50">
          {msg}
        </p>
      )}
    </section>
  );
}

/** 另一半傳來的行程連結：問要不要存到這支手機。 */
export function IncomingPlan({
  spotName,
  backupName,
  when,
  expired,
  onAccept,
  onDecline,
}: {
  spotName: string;
  backupName: string | null;
  when: string;
  /** 行程不是這一週的 */
  expired: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <section role="dialog" aria-labelledby="incoming-plan-title" className="mb-6 rounded-3xl bg-amber-100 p-4 text-amber-950 ring-2 ring-amber-400 dark:bg-amber-950 dark:text-amber-50">
      <h2 id="incoming-plan-title" className="text-lg font-extrabold">
        {expired ? '這個行程連結已經過期' : '收到這週的行程'}
      </h2>
      {expired ? (
        <p className="mt-1 text-sm">這是之前某一週的行程（{spotName}），不會存下來。</p>
      ) : (
        <p className="mt-1 text-sm">
          {when}去 <span className="font-bold">{spotName}</span>
          {backupName && `，下雨改去 ${backupName}`}。
        </p>
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
