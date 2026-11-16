import type { ReactNode } from 'react';
import type { ScoredSpot } from '../lib/recommend.ts';
import { Chip, buttonBase } from './ui.tsx';

export interface RecommendationsProps {
  picks: ScoredSpot[];
  rainy: boolean;
  overnight: boolean;
  onRainy: (v: boolean) => void;
  onOvernight: (v: boolean) => void;
  onShuffle: () => void;
  renderCard: (pick: ScoredSpot) => ReactNode;
}

export function Recommendations({ picks, rainy, overnight, onRainy, onOvernight, onShuffle, renderCard }: RecommendationsProps) {
  return (
    <section aria-labelledby="recommend-title" className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recommend-title" className="text-lg font-bold">
          這週推薦
        </h2>
        <button
          type="button"
          onClick={onShuffle}
          disabled={picks.length === 0}
          className={`${buttonBase} border border-stone-300 text-stone-800 hover:bg-stone-100 disabled:opacity-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`}
        >
          換一組
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip pressed={rainy} onClick={() => onRainy(!rainy)}>
          這週可能下雨
        </Chip>
        <Chip pressed={overnight} onClick={() => onOvernight(!overnight)}>
          這週要住一晚
        </Chip>
      </div>
      {picks.length === 0 ? (
        <p className="mt-3 rounded-xl bg-stone-100 p-4 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300">
          這週沒有適合推薦的地方。試試打開「這週要住一晚」，或關掉「這週可能下雨」。
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" aria-live="polite">
          {picks.map((p) => renderCard(p))}
        </div>
      )}
    </section>
  );
}
