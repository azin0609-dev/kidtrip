import { useEffect, useId, useRef, useState } from 'react';
import { formatDrive } from '../lib/format.ts';
import { KIDPICK_INITIAL, type KidPickAction, kidPickStep } from '../lib/kidpick.ts';
import { directionsUrl } from '../lib/links.ts';
import type { ScoredSpot } from '../lib/recommend.ts';
import { Flag } from './Brand.tsx';
import { SpotArt } from './SpotArt.tsx';
import { buttonBase } from './ui.tsx';

const RINGS = ['ring-coral-300', 'ring-sky-300', 'ring-amber-300'];

/**
 * 換我決定！：把這週推薦的三個地方做成大圖卡，讓小孩自己點一個。
 * 小孩點完只是暫選；家長按「確認這個地方」才存成這週放電計畫，關掉不會動到原本的計畫。
 */
export function KidPick({
  open,
  picks,
  currentPlanName,
  onClose,
  onChoose,
}: {
  open: boolean;
  picks: ScoredSpot[];
  /** 目前已經有的這週計畫（確認時會被取代）；沒有是 null。 */
  currentPlanName: string | null;
  onClose: () => void;
  /** 家長確認了：記成「這週放電計畫」。 */
  onChoose: (pick: ScoredSpot) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState(KIDPICK_INITIAL);
  const selected = picks.find((p) => p.spot.id === state.selectedId) ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const dispatch = (action: KidPickAction) => {
    const step = kidPickStep(state, action);
    setState(step.state);
    if (step.commit) {
      const pick = picks.find((p) => p.spot.id === step.commit);
      if (pick) onChoose(pick);
    }
  };

  const close = () => {
    dispatch({ type: 'close' });
    onClose();
  };

  const replacing = currentPlanName && selected && currentPlanName !== selected.spot.name ? currentPlanName : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={close}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-amber-50 p-0 text-stone-900 dark:bg-ink dark:text-stone-50"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col gap-4 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Flag className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <h2 id={titleId} className="text-2xl font-black text-emerald-900 dark:text-emerald-50">
                {state.confirmed ? '決定了！' : selected ? '就是這裡嗎？' : '換我決定！'}
              </h2>
              {!selected && <p className="text-base text-stone-700 dark:text-stone-300">想去哪裡放電？點一張</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="關閉"
            className={`${buttonBase} min-w-11 border border-stone-300 bg-white text-lg dark:border-stone-700 dark:bg-card-dark`}
          >
            ×
          </button>
        </header>

        {selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <SpotArt
              name={selected.spot.name}
              type={selected.spot.types[0] ?? 'park'}
              image={selected.spot.image}
              className="h-52 w-full rounded-[2rem]"
              iconClassName="h-32 w-32"
            />
            <p className="text-3xl leading-snug font-black">我們去{selected.spot.name}！</p>

            {state.confirmed ? (
              <>
                <p role="status" className="text-base text-stone-700 dark:text-stone-300">
                  存好了，已經記成「這週放電計畫」，關掉也還在。
                </p>
                <div className="grid w-full grid-cols-2 gap-3">
                  <button type="button" onClick={close} className={`${buttonBase} min-h-14 border border-stone-300 bg-white text-base dark:border-stone-700 dark:bg-card-dark`}>
                    完成
                  </button>
                  <a
                    href={directionsUrl(selected.spot)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${buttonBase} min-h-14 bg-emerald-700 text-base text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950`}
                  >
                    看路線
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-base text-amber-950 ring-1 ring-amber-200 dark:bg-[#2f2614] dark:text-amber-100 dark:ring-amber-900">
                  請爸爸媽媽確認，按了才會存下來。
                  {replacing && (
                    <>
                      <br />
                      會取代原本的「{replacing}」。
                    </>
                  )}
                </p>
                <div className="grid w-full grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'reselect' })}
                    className={`${buttonBase} min-h-14 border border-stone-300 bg-white text-base dark:border-stone-700 dark:bg-card-dark`}
                  >
                    再選一次
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'confirm' })}
                    className={`${buttonBase} min-h-14 bg-emerald-700 text-base text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950`}
                  >
                    確認這個地方
                  </button>
                </div>
              </>
            )}
          </div>
        ) : picks.length === 0 ? (
          <p className="flex-1 text-center text-lg">這週沒有推薦的地方，請爸爸媽媽調整一下條件。</p>
        ) : (
          <ul className="flex flex-1 flex-col gap-4">
            {picks.map((p, i) => {
              const d = formatDrive(p.mins);
              return (
                <li key={p.spot.id} className="flex">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'select', id: p.spot.id })}
                    className={`flex w-full flex-col overflow-hidden rounded-[2rem] bg-white text-left shadow-md ring-4 transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] dark:bg-card-dark ${RINGS[i % RINGS.length]}`}
                  >
                    <SpotArt
                      name={p.spot.name}
                      type={p.spot.types[0] ?? 'park'}
                      image={p.spot.image}
                      className="h-32 w-full shrink-0 sm:h-40"
                      iconClassName="h-20 w-20"
                    />
                    <span className="flex items-end justify-between gap-3 px-5 py-3">
                      <span className="min-w-0">
                        {p.spot.kid_label && <span className="block text-xl font-black text-emerald-800 dark:text-emerald-300">{p.spot.kid_label}</span>}
                        <span className="block text-lg leading-snug font-bold break-words">{p.spot.name}</span>
                      </span>
                      <span className="shrink-0 text-base text-stone-600 dark:text-stone-400">
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
