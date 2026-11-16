import { hotels, spots } from './data/index.ts';

export default function App() {
  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-10 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">這週去哪玩</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">資料讀取測試</p>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <dt className="text-sm text-stone-600 dark:text-stone-400">景點</dt>
            <dd className="mt-1 text-3xl font-bold" data-testid="spot-count">
              {spots.length} <span className="text-base font-normal">個</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            <dt className="text-sm text-stone-600 dark:text-stone-400">飯店</dt>
            <dd className="mt-1 text-3xl font-bold" data-testid="hotel-count">
              {hotels.length} <span className="text-base font-normal">間</span>
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
