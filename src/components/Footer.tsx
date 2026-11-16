export function Footer({ verifiedOn }: { verifiedOn: string | null }) {
  return (
    <footer className="mt-10 border-t border-stone-200 pt-4 pb-8 text-xs leading-relaxed text-stone-600 dark:border-stone-800 dark:text-stone-400">
      {verifiedOn && <p>資料整理日期：{verifiedOn}</p>}
      <p>開放時間與票價以官方公告為準。</p>
      <p>車程是從新北市林口區出發的粗估，實際依路況而定。</p>
    </footer>
  );
}
