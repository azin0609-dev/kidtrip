import type { ReactNode } from 'react';

const focus =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-400';

export const buttonBase = `inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 text-sm font-medium transition-colors ${focus}`;

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
          ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-stone-950'
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
    good: 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
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
