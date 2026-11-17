import { Footprints } from './Dino.tsx';

export function Footer({ verifiedOn, originLabel }: { verifiedOn: string | null; originLabel: string }) {
  return (
    <footer className="mt-10 pt-2 pb-24 text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:text-stone-400">
      <Footprints className="mb-3 h-6 w-44 text-emerald-300 dark:text-emerald-800" />
      {verifiedOn && <p>資料整理日期：{verifiedOn}</p>}
      <p>開放時間與票價以官方公告為準。</p>
      <p>車程是從「{originLabel}」出發的粗估，實際依路況而定。</p>
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
    </footer>
  );
}
