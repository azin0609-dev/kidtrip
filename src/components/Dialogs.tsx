import { useEffect, useId, useRef } from 'react';
import { REPORT_KINDS } from '../lib/storage.ts';
import type { Origin, OriginsFile } from '../lib/origin.ts';
import { BrandMark, Flag } from './Brand.tsx';
import { OriginPicker } from './OriginPicker.tsx';
import { buttonBase } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';
const primary = `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`;
const ghost = `${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`;
const sheet =
  'm-0 mt-auto w-full max-w-none rounded-t-3xl bg-paper p-0 text-stone-900 backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl dark:bg-ink dark:text-stone-100';

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

/** 回報「資料有誤」：寫一句話，存在本機。 */
export function ReportDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  /** copy 為 true 時，記下來之後順便把這一則複製到剪貼簿。 */
  onSubmit: (note: string, kind: string, copy: boolean) => void;
}) {
  const ref = useDialog(target !== null);
  const titleId = useId();

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className={sheet}>
      <form
        className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const note = String(data.get('note') ?? '').trim();
          if (!note) return;
          const kind = String(data.get('kind') ?? '其他');
          const copy = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-copy') === '1';
          form.reset();
          onSubmit(note, kind, copy);
        }}
      >
        <h2 id={titleId} className="text-lg font-bold">
          哪裡不對？
        </h2>
        <p className="text-sm text-stone-700 dark:text-stone-300">{target?.name}</p>
        <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
          是哪一種問題？
          <select
            name="kind"
            defaultValue={REPORT_KINDS[0]}
            className={`min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`}
          >
            {REPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-400">
          寫一句就好，例如「週一沒開」「票價變了」「推車在入口那段要搬」
          <textarea
            name="note"
            rows={3}
            maxLength={300}
            required
            className={`rounded-xl border border-stone-300 bg-white p-3 text-base text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 ${focus}`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.form?.reset();
              onClose();
            }}
            className={ghost}
          >
            取消
          </button>
          <button type="submit" className={primary}>
            記下來
          </button>
        </div>
        <button type="submit" data-copy="1" className={ghost}>
          記下來，並複製這一則（可以貼到 LINE）
        </button>
        <p className="text-xs text-stone-600 dark:text-stone-400">會先記在這支手機，到「設定」可以一次複製出來。</p>
      </form>
    </dialog>
  );
}

/** 打開分享連結時，問要不要把對方的收藏加進來。 */
export function ImportDialog({
  incoming,
  onAccept,
  onDecline,
}: {
  incoming: { fav: number; been: number } | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const ref = useDialog(incoming !== null);
  const titleId = useId();
  const nothingNew = incoming !== null && incoming.fav === 0 && incoming.been === 0;
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onDecline} className={sheet}>
      <div className="flex flex-col items-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <Flag className="h-16 w-16" />
        <h2 id={titleId} className="text-lg font-bold">
          收到一份收藏與紀錄
        </h2>
        <p className="text-sm text-stone-700 dark:text-stone-300">
          {nothingNew
            ? '裡面的收藏和去過紀錄，這支手機都已經有了。'
            : `加進來會多 ${incoming?.fav ?? 0} 個收藏、${incoming?.been ?? 0} 個去過紀錄，還有對方的評分（你評過的以你的為準）。原本的不會被刪掉。`}
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <button type="button" onClick={onDecline} className={ghost}>
            {nothingNew ? '關閉' : '先不要'}
          </button>
          {!nothingNew && (
            <button type="button" onClick={onAccept} className={primary}>
              加進來
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

/**
 * 第一次打開：先選出發地，車程和推薦才會準（不然有人會以為只適用林口）。
 * 出發地只存在這支手機。可以先用預設的林口試試看。
 */
export function WelcomeDialog({
  open,
  origins,
  defaultLabel,
  onPick,
  onSkip,
}: {
  open: boolean;
  origins: OriginsFile;
  defaultLabel: string;
  onPick: (o: Origin) => void;
  onSkip: () => void;
}) {
  const ref = useDialog(open);
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onSkip} className={sheet}>
      <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <BrandMark className="h-12 w-12 shrink-0" />
          <div>
            <h2 id={titleId} className="text-xl font-black">
              歡迎來到放電研究所
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">孩子負責放電，我們負責找地方。</p>
          </div>
        </div>
        <p className="text-base text-stone-800 dark:text-stone-200">
          先告訴我們你從哪裡出發，車程和每週推薦才會準。<span className="text-stone-600 dark:text-stone-400">全台灣都可以選。</span>
        </p>
        <OriginPicker origins={origins} onPick={onPick} big />
        <p className="text-xs text-stone-600 dark:text-stone-400">出發地只存在這支手機，不會上傳；之後可以在右上角改。</p>
        <button type="button" onClick={onSkip} className={`${ghost} self-center`}>
          先用{defaultLabel}試試看
        </button>
      </div>
    </dialog>
  );
}
