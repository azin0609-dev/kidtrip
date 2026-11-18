import type { Trip } from '../data/schema.ts';
import { googleMapsUrl } from '../lib/links.ts';
import { Tag, buttonBase } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';

export function TripCard({ trip, isFav, onToggleFav }: { trip: Trip; isFav: boolean; onToggleFav: () => void }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 dark:bg-card-dark dark:ring-emerald-950">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-snug font-bold break-words">{trip.title}</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {trip.country}・{trip.region}・住 {trip.base_cities.join('、')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl leading-none font-bold">
            {trip.days}
            <span className="ml-0.5 text-sm font-normal">天</span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Tag tone="good">{trip.age_hint}</Tag>
        {trip.best_seasons.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">{trip.summary}</p>

      <details className="group">
        <summary
          className={`${buttonBase} w-full cursor-pointer list-none bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-stone-950 dark:hover:bg-emerald-300 [&::-webkit-details-marker]:hidden`}
        >
          <span className="group-open:hidden">看每天的行程</span>
          <span className="hidden group-open:inline">收起行程</span>
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <section className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
            <h4 className="font-bold">出發前先知道</h4>
            <ul className="mt-1 list-disc pl-5">
              {trip.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>

          <ol className="flex flex-col gap-3">
            {trip.itinerary.map((day) => (
              <li key={day.day} className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
                <h4 className="font-bold text-emerald-950 dark:text-emerald-100">
                  第 {day.day} 天・{day.title}
                </h4>
                {day.stay && <p className="text-xs text-stone-600 dark:text-stone-400">住：{day.stay}</p>}
                <ul className="mt-2 flex flex-col gap-2">
                  {day.stops.map((stop) => (
                    <li key={stop.name} className="rounded-xl bg-white p-3 dark:bg-stone-900">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{stop.name}</p>
                          <p className="text-xs text-stone-600 dark:text-stone-400">
                            {stop.area}・{stop.indoor ? '室內' : '戶外'}
                          </p>
                        </div>
                        <a
                          href={googleMapsUrl({ name: stop.query ?? stop.name, city: '', google_place_id: null })}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`在 Google Maps 看${stop.name}`}
                          className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 px-3 text-sm font-bold text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800 ${focus}`}
                        >
                          地圖
                        </a>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-stone-800 dark:text-stone-200">{stop.tip}</p>
                      {stop.booking && (
                        <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                          <span className="font-bold">要先訂：</span>
                          {stop.booking}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            整理日期 {trip.last_verified}。還沒完全確認的項目：{trip.needs_verify.join('、')}。營業時間、票價、預約方式以官方公告為準。
          </p>
        </div>
      </details>

      <button
        type="button"
        aria-pressed={isFav}
        onClick={onToggleFav}
        className={`${buttonBase} border ${
          isFav
            ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
            : 'border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800'
        }`}
      >
        {isFav ? '已收藏這個行程' : '收藏這個行程'}
      </button>
    </article>
  );
}
