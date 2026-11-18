import { useRef, useState } from 'react';
import { type Origin, type OriginsFile, findTown, nearestTown } from '../lib/origin.ts';
import { buttonBase, secondaryButton } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';
const field = `min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`;

type GeoStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

/** 選出發地：用目前位置，或從縣市、鄉鎮選。設定和第一次打開的歡迎畫面共用。 */
export function OriginPicker({ origins, onPick, big = false }: { origins: OriginsFile; onPick: (o: Origin) => void; big?: boolean }) {
  const [geo, setGeo] = useState<GeoStatus>({ kind: 'idle' });
  const [county, setCounty] = useState('');
  const countyRef = useRef<HTMLSelectElement>(null);
  const countyData = origins.counties.find((c) => c.name === county);
  const usableCounties = origins.counties.filter((c) => c.towns.some((t) => t.lat !== null));

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'error', message: '這個瀏覽器不能定位，請從下面的縣市、鄉鎮選單選出發地。' });
      countyRef.current?.focus();
      return;
    }
    setGeo({ kind: 'loading' });
    // 只有使用者按下按鈕才要求定位權限；位置只用來找最近的鄉鎮，不會上傳。
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = nearestTown(origins, point);
        onPick({ label: near ? `目前位置（${near.county}${near.town}附近）` : '目前位置', ...point });
        setGeo({ kind: 'idle' });
      },
      (err) => {
        setGeo({
          kind: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? '沒有拿到定位權限。可以從下面的縣市、鄉鎮選單選出發地，或到瀏覽器設定打開定位。'
              : '暫時抓不到位置，請從下面的縣市、鄉鎮選單選出發地。',
        });
        countyRef.current?.focus();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={geo.kind === 'loading'}
        className={big ? `${buttonBase} min-h-12 bg-emerald-700 text-base text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950` : `${secondaryButton} self-start`}
      >
        {geo.kind === 'loading' ? '定位中…' : '用目前位置'}
      </button>
      {geo.kind === 'error' && (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {geo.message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
          縣市
          <select ref={countyRef} value={county} onChange={(e) => setCounty(e.target.value)} className={field}>
            <option value="">請選擇</option>
            {usableCounties.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
          鄉鎮市區
          <select
            value=""
            disabled={!countyData}
            onChange={(e) => {
              const o = findTown(origins, county, e.target.value);
              if (o) onPick(o);
            }}
            className={`${field} disabled:opacity-50`}
          >
            <option value="">{countyData ? '請選擇' : '先選縣市'}</option>
            {countyData?.towns
              .filter((t) => t.lat !== null)
              .map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}
