import { useEffect, useId, useRef, useState } from 'react';
import { formatDrive } from '../lib/format.ts';
import { directionsUrl } from '../lib/links.ts';
import type { ScoredSpot } from '../lib/recommend.ts';
import { Dino } from './Dino.tsx';
import { TypeIcon } from './TypeIcon.tsx';
import { buttonBase } from './ui.tsx';

const TILE_COLORS = [
  'bg-rose-100 text-rose-950 dark:bg-rose-900 dark:text-rose-50',
  'bg-sky-100 text-sky-950 dark:bg-sky-900 dark:text-sky-50',
  'bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50',
];

/** 給小孩選：把這週推薦的三個地方用大圖顯示，讓小孩自己點一個。 */
export function KidPick({
  open,
  picks,
  onClose,
  onChoose,
}: {
  open: boolean;
  picks: ScoredSpot[];
  onClose: () => void;
  /** 小孩選好了：記成「這週要去」。 */
  onChoose: (pick: ScoredSpot) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = picks.find((p) => p.spot.id === chosenId) ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => {
    setChosenId(null);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={close}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-[#f6f9ec] p-0 text-stone-900 dark:bg-[#0f1a14] dark:text-stone-100"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="flex items-center gap-2 text-2xl font-extrabold text-emerald-900 dark:text-emerald-100">
            <Dino className="h-14 w-14" />
            {chosen ? '決定了！' : '想去哪裡？'}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="關閉"
            className={`${buttonBase} min-w-11 border border-stone-300 text-lg dark:border-stone-700`}
          >
            ×
          </button>
        </header>

        {chosen ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <TypeIcon type={chosen.spot.types[0] ?? 'park'} className="h-40 w-40" />
            <p className="text-3xl leading-snug font-extrabold">我們去{chosen.spot.name}！</p>
            <p className="text-base text-stone-700 dark:text-stone-300">已經記成「這週要去」，關掉也還在。</p>
            <div className="grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setChosenId(null)}
                className={`${buttonBase} min-h-14 border border-stone-300 text-base dark:border-stone-700`}
              >
                再選一次
              </button>
              <a
                href={directionsUrl(chosen.spot)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonBase} min-h-14 bg-emerald-700 text-base text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950`}
              >
                導航
              </a>
            </div>
          </div>
        ) : picks.length === 0 ? (
          <p className="flex-1 text-center text-lg">這週沒有推薦的地方，請爸爸媽媽調整一下條件。</p>
        ) : (
          <ul className="flex flex-1 flex-col gap-4">
            {picks.map((p, i) => {
              const d = formatDrive(p.mins);
              return (
                <li key={p.spot.id} className="flex flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setChosenId(p.spot.id);
                      onChoose(p);
                    }}
                    className={`flex min-h-36 w-full flex-1 items-center gap-4 rounded-[2rem] p-5 text-left shadow-md transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-95 ${TILE_COLORS[i % TILE_COLORS.length]}`}
                  >
                    <TypeIcon type={p.spot.types[0] ?? 'park'} className="h-24 w-24 shrink-0" />
                    <span className="min-w-0">
                      {p.spot.kid_label && <span className="block text-lg font-bold opacity-90">{p.spot.kid_label}</span>}
                      <span className="block text-2xl leading-snug font-extrabold break-words">{p.spot.name}</span>
                      <span className="mt-1 block text-base opacity-80">
                        坐車約 {d.value} {d.unit}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
