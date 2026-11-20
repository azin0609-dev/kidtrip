import { RouteLine } from './Brand.tsx';

export function Footer({ verifiedOn, originLabel, onAbout }: { verifiedOn: string | null; originLabel: string; onAbout?: () => void }) {
  return (
    <footer className="mt-10 mb-28 rounded-3xl bg-white/85 p-4 text-xs leading-relaxed text-stone-600 ring-1 ring-stone-200 backdrop-blur md:mb-24 dark:bg-card-dark/85 dark:text-stone-400 dark:ring-stone-800">
      <RouteLine className="mb-3 h-7 w-48 text-emerald-600 dark:text-emerald-400" />
      <p className="mb-2 font-bold text-stone-700 dark:text-stone-300">放電研究所：孩子負責放電，我們負責找地方。</p>
      {onAbout && (
        <p className="mb-1">
          <button
            type="button"
            onClick={onAbout}
            className="inline-flex min-h-11 items-center font-bold text-emerald-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-300"
          >
            關於放電研究所：我們的故事
          </button>
        </p>
      )}
      {verifiedOn && <p>資料整理日期：{verifiedOn}</p>}
      <p>開放時間與票價以官方公告為準。</p>
      <p>車程是從「{originLabel}」出發的粗估，不是即時路況，以導航為準。</p>
      <p>收藏、去過紀錄和行程只存在這支手機；分享連結是把資料帶過去，不會自動同步。</p>
      <p>
        座標資料：
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100"
        >
          © OpenStreetMap contributors
        </a>
      </p>
      <p>
        天氣預報：
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100"
        >
          Open-Meteo
        </a>
        （只送出大約 10 公里範圍的位置）
      </p>
    </footer>
  );
}
