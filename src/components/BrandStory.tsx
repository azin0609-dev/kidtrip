import { useEffect, useRef } from 'react';
import { BRAND_SUBLINE, STORY, STORY_TEASER, type StoryBlock } from '../content/brand-story.ts';
import { BrandMark, Flag } from './Brand.tsx';
import { buttonBase, primaryButton, secondaryButton } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';

/**
 * 首頁的小型故事入口：放在推薦卡片下面，不擋快速決定。
 * 小卡片、一個按鈕，沒有自動跳出。
 */
export function StoryTeaser({ onOpen }: { onOpen: () => void }) {
  return (
    <section
      aria-labelledby="story-teaser-title"
      className="mb-6 flex items-start gap-3 rounded-3xl bg-amber-50/90 p-4 md:max-w-2xl ring-1 ring-amber-200 dark:bg-[#26231a]/90 dark:ring-amber-900/50"
    >
      <Flag className="mt-0.5 h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="story-teaser-title" className="text-[15px] leading-snug font-black text-balance text-stone-900 dark:text-stone-50">
          {STORY_TEASER.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-700 dark:text-stone-300">{STORY_TEASER.body}</p>
        <p className="text-xs leading-relaxed text-pretty text-stone-600 dark:text-stone-400">{STORY_TEASER.note}</p>
        <button
          type="button"
          onClick={onOpen}
          className={`mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-bold text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-300 ${focus}`}
        >
          {STORY_TEASER.button}
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

function Block({ block }: { block: StoryBlock }) {
  switch (block.kind) {
    case 'p':
      return <p>{block.text}</p>;
    case 'say':
      return <p className="border-l-4 border-coral-300 pl-3 font-bold text-stone-900 dark:border-coral-400 dark:text-stone-50">{block.text}</p>;
    case 'list':
      return (
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-stone-100 px-4 py-3 text-[16px] dark:bg-card-dark-2">
          {block.items.map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden="true" className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      );
    case 'quote':
      return (
        <blockquote className="my-4 text-center text-xl leading-relaxed font-black text-balance text-emerald-800 md:text-2xl dark:text-emerald-300">
          {block.text}
        </blockquote>
      );
    case 'emph':
      return (
        <p className="font-bold text-stone-900 dark:text-stone-50">
          <span className="bg-[linear-gradient(transparent_62%,var(--color-amber-300)_62%)] dark:bg-[linear-gradient(transparent_62%,rgba(243,198,109,0.35)_62%)]">{block.text}</span>
        </p>
      );
    case 'break':
      return (
        <div aria-hidden="true" className="flex justify-center gap-2 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-coral-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        </div>
      );
  }
}

/**
 * 「關於放電研究所」全螢幕閱讀頁（網址 #about）。
 * 段落短、留白多；上方和最下面都有返回；最下面的「開始規劃這週末」回到首頁推薦區。
 */
export function AboutStory({ onClose, onStartPlanning }: { onClose: () => void; onStartPlanning: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    // 底下的首頁先不要捲動（返回時停在原本的位置）。
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="about-title" className="fixed inset-0 z-50 overflow-y-auto bg-paper text-stone-800 dark:bg-ink dark:text-stone-200">
      <div className="sticky top-0 z-10 border-b border-stone-200/80 bg-paper/90 backdrop-blur dark:border-stone-800 dark:bg-ink/90">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 py-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} className={`${buttonBase} px-3 text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800`}>
            <span aria-hidden="true" className="text-lg leading-none">‹</span>
            返回
          </button>
          <span className="text-sm font-bold text-stone-600 dark:text-stone-400">{STORY.eyebrow}</span>
        </div>
      </div>

      <article className="mx-auto max-w-xl px-5 pt-8 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <header className="mb-8">
          <BrandMark className="mb-4 h-12 w-12" />
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{STORY.eyebrow}</p>
          <h1 id="about-title" ref={titleRef} tabIndex={-1} className="mt-1 text-[1.7rem] leading-snug font-black text-stone-900 outline-none md:text-4xl dark:text-stone-50">
            {/* 在逗號後面斷行，不讓「的？」或「是」單獨掉到下一行。 */}
            {STORY.title.split(/(?<=，)/).map((part) => (
              <span key={part} className="inline-block">
                {part}
              </span>
            ))}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-stone-600 dark:text-stone-400">{STORY.lead}</p>
        </header>

        <div className="flex flex-col gap-4 text-[17px] leading-[1.9] text-pretty">
          {STORY.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </div>

        <footer className="mt-10 rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-stone-200 dark:bg-card-dark dark:ring-stone-800">
          <div className="flex items-center justify-center gap-2">
            <BrandMark className="h-8 w-8" />
            <p className="text-lg font-black text-stone-900 dark:text-stone-50">{STORY.signature}</p>
          </div>
          <p className="mt-3 leading-relaxed text-stone-700 dark:text-stone-300">
            {BRAND_SUBLINE[0]}
            <br />
            {BRAND_SUBLINE[1]}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button type="button" onClick={onStartPlanning} className={`${primaryButton} min-h-12 w-full text-base`}>
              {STORY.cta}
            </button>
            <button type="button" onClick={onClose} className={`${secondaryButton} w-full`}>
              返回
            </button>
          </div>
        </footer>
        <p className="mt-4 text-center text-xs leading-relaxed text-balance text-stone-500 dark:text-stone-400">{STORY.note}</p>
      </article>
    </div>
  );
}
