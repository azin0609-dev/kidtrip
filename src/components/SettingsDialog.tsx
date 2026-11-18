import { useEffect, useId, useRef, useState } from 'react';
import { ageLabel, findTown, nearestTown, type Origin, type OriginsFile } from '../lib/origin.ts';
import { DEFAULT_NAP, type StoredKid, type StoredNap, type StoredReport } from '../lib/storage.ts';
import { buttonBase } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';
const field = `min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`;
const ghost = `${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`;

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  origins: OriginsFile;
  origin: Origin;
  defaultOrigin: Origin;
  onOriginChange: (o: Origin) => void;
  kids: StoredKid[];
  onKidsChange: (k: StoredKid[]) => void;
  nap: StoredNap | undefined;
  onNapChange: (n: StoredNap) => void;
  today: string;
  /** 產生分享連結；回傳要顯示的結果訊息。 */
  onShare: () => Promise<string>;
  reports: StoredReport[];
  nameOf: (id: string) => string;
  onCopyReports: () => Promise<string>;
  onClearReports: () => void;
}

type GeoStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

export function SettingsDialog(props: SettingsDialogProps) {
  const { open, onClose, origins, origin, defaultOrigin, onOriginChange, kids, onKidsChange, nap, onNapChange, today, onShare, reports, nameOf, onCopyReports, onClearReports } = props;
  const [shareMsg, setShareMsg] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const ref = useRef<HTMLDialogElement>(null);
  const countyRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const [geo, setGeo] = useState<GeoStatus>({ kind: 'idle' });
  const [county, setCounty] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const countyData = origins.counties.find((c) => c.name === county);
  const usableCounties = origins.counties.filter((c) => c.towns.some((t) => t.lat !== null));

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'error', message: '這個瀏覽器不能定位，請從下面的縣市、鄉鎮選單選出發地。' });
      countyRef.current?.focus();
      return;
    }
    setGeo({ kind: 'loading' });
    // 只有使用者按下按鈕才要求定位權限。
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const near = nearestTown(origins, point);
        onOriginChange({ label: near ? `目前位置（${near.county}${near.town}附近）` : '目前位置', ...point });
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

  const currentNap = nap ?? DEFAULT_NAP;
  const updateKid = (i: number, patch: Partial<StoredKid>) => onKidsChange(kids.map((k, j) => (i === j ? { ...k, ...patch } : k)));

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-stone-50 p-0 text-stone-900 backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl dark:bg-stone-950 dark:text-stone-100"
    >
      <div className="flex flex-col gap-6 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold">
            設定
          </h2>
          <button type="button" onClick={onClose} aria-label="關閉設定" className={`${ghost} min-w-11 text-lg`}>
            ×
          </button>
        </header>

        <section className="flex flex-col gap-3">
          <h3 className="font-bold">出發地</h3>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            目前：<span className="font-medium">{origin.label}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useMyLocation} disabled={geo.kind === 'loading'} className={ghost}>
              {geo.kind === 'loading' ? '定位中…' : '用目前位置'}
            </button>
            {origin.label !== defaultOrigin.label && (
              <button type="button" onClick={() => onOriginChange(defaultOrigin)} className={ghost}>
                改回{defaultOrigin.label}
              </button>
            )}
          </div>
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
                  if (o) onOriginChange(o);
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
          {usableCounties.length === 0 && (
            <p className="text-sm text-stone-600 dark:text-stone-400">鄉鎮座標還沒產生（要先跑 npm run geocode -- --origins）。</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-bold">孩子</h3>
          {kids.length === 0 && <p className="text-sm text-stone-600 dark:text-stone-400">還沒有設定。只要暱稱和出生年月就好。</p>}
          {kids.map((kid, i) => {
            const age = ageLabel(kid.birthYm, today);
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="flex min-w-0 flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
                  暱稱
                  <input
                    value={kid.nickname}
                    onChange={(e) => updateKid(i, { nickname: e.target.value })}
                    placeholder={i === 0 ? '例如：果果' : '例如：核桃'}
                    maxLength={20}
                    className={field}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
                  出生年月
                  <input
                    type="month"
                    value={kid.birthYm}
                    max={today.slice(0, 7)}
                    onChange={(e) => updateKid(i, { birthYm: e.target.value })}
                    className={field}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`刪除${kid.nickname || '這個孩子'}`}
                  onClick={() => onKidsChange(kids.filter((_, j) => j !== i))}
                  className={`${ghost} min-w-11`}
                >
                  ×
                </button>
                {age && (
                  <p className="col-span-3 -mt-1 text-xs text-stone-700 dark:text-stone-300">
                    {kid.nickname || '孩子'}現在 {age}
                  </p>
                )}
              </div>
            );
          })}
          <div>
            <button type="button" onClick={() => onKidsChange([...kids, { nickname: '', birthYm: '' }])} className={ghost}>
              加一個孩子
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-bold">午睡時段</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
              開始
              <input
                type="time"
                value={currentNap.start}
                onChange={(e) => e.target.value && onNapChange({ ...currentNap, start: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
              結束
              <input
                type="time"
                value={currentNap.end}
                onChange={(e) => e.target.value && onNapChange({ ...currentNap, end: e.target.value })}
                className={field}
              />
            </label>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400">之後會用來建議出發時間。</p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-bold">把收藏與紀錄傳到另一支手機</h3>
          <p className="text-sm text-stone-700 dark:text-stone-300">
            把連結傳給另一半，對方打開後按「加進來」，你的收藏、去過紀錄和評分就會合併到對方手機。這是一次性的匯入，不會自動同步；之後有新增要再傳一次。
          </p>
          <div>
            <button type="button" onClick={() => void onShare().then(setShareMsg)} className={ghost}>
              產生匯入連結
            </button>
          </div>
          {shareMsg && (
            <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
              {shareMsg}
            </p>
          )}
          <p className="text-xs text-stone-600 dark:text-stone-400">
            連結會帶：收藏、去過的地方與日期、你給的星星和標籤。不會帶：出發地、孩子資料、寫的回憶、回報紀錄。
            同一個地方兩邊都評過分時，各自保留自己的評分。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-bold">回報的資料問題（{reports.length}）</h3>
          {reports.length === 0 ? (
            <p className="text-sm text-stone-600 dark:text-stone-400">還沒有。卡片下方按「資料有誤？」就會記在這裡。</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 text-sm">
                {reports.map((r, i) => (
                  <li key={i} className="rounded-xl bg-white p-3 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
                    <span className="font-medium">{nameOf(r.id)}</span>
                    <span className="text-stone-500 dark:text-stone-400">・{r.date}</span>
                    <br />
                    {r.note}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void onCopyReports().then(setReportMsg)} className={ghost}>
                  全部複製
                </button>
                <a
                  href={`mailto:?${new URLSearchParams({ subject: '放電研究所：資料回報', body: reports.map((r) => `${r.date}｜${nameOf(r.id)}（${r.id}）${r.kind ? `｜${r.kind}` : ''}：${r.note}`).join('\n') }).toString().replace(/\+/g, '%20')}`}
                  className={ghost}
                >
                  用 Email 寄出
                </a>
                <button type="button" onClick={onClearReports} className={ghost}>
                  清空
                </button>
              </div>
              {reportMsg && (
                <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
                  {reportMsg}
                </p>
              )}
            </>
          )}
        </section>

        <p className="text-xs text-stone-600 dark:text-stone-400">這些設定只存在這支手機，不會上傳。</p>
      </div>
    </dialog>
  );
}
