import type { ReactNode } from 'react';

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';

export const buttonBase = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-3 text-sm font-bold transition-colors ${focus}`;

/** 全站統一的按鈕和卡片樣式：主要按鈕（森林綠實心）、次要按鈕（白底框線）、卡片外框。 */
export const primaryButton = `${buttonBase} bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300`;
export const secondaryButton = `${buttonBase} border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-card-dark dark:text-stone-100 dark:hover:bg-stone-800`;
export const cardBase = 'overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200 dark:bg-card-dark dark:ring-stone-800';

export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-colors ${focus} ${
        pressed
          ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-stone-950'
          : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function Tag({ tone = 'plain', children }: { tone?: 'plain' | 'new' | 'end' | 'good'; children: ReactNode }) {
  const tones = {
    plain: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    good: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    new: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
    end: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  };
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">搜尋</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 text-base text-stone-900 placeholder:text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 ${focus}`}
      />
    </label>
  );
}
