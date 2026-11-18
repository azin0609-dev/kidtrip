import type { Trip } from '../data/schema.ts';
import { googleMapsUrl } from '../lib/links.ts';
import { Tag, buttonBase, cardBase, primaryButton } from './ui.tsx';

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-400';

export function TripCard({ trip, isFav, onToggleFav }: { trip: Trip; isFav: boolean; onToggleFav: () => void }) {
  return (
    <article className={`${cardBase} flex min-w-0 flex-col gap-3 p-4`}>
      {/* 目的地視覺：用文字和路線圖形表現目的地，不放冒充的風景照。 */}
      <div aria-hidden="true" className="relative -mx-4 -mt-4 h-28 overflow-hidden bg-gradient-to-br from-sky-50 via-stone-50 to-amber-50 dark:from-[#18283a] dark:via-card-dark dark:to-card-dark-2">
        <svg viewBox="0 0 320 112" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M-10 92 C60 60 110 100 170 70 S260 30 330 46" fill="none" stroke="#2e8b6e" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg viewBox="0 0 24 24" className="absolute top-4 right-16 h-7 w-7 -rotate-12 text-sky-700 dark:text-sky-300" fill="currentColor">
          <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
        </svg>
        <div className="absolute bottom-3 left-4">
          <p className="text-xs font-bold text-stone-600 dark:text-stone-400">{trip.country}</p>
          <p className="text-2xl leading-tight font-black text-stone-900 dark:text-stone-50">{trip.region}</p>
        </div>
        <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-sm font-black text-stone-900 shadow-sm dark:bg-black/40 dark:text-stone-50">
          {trip.days} 天
        </span>
      </div>

      <header className="min-w-0">
        <h3 className="text-lg leading-snug font-bold break-words">{trip.title}</h3>
        <p className="text-sm text-stone-600 dark:text-stone-400">住 {trip.base_cities.join('、')}</p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Tag tone="good">適合：{trip.age_hint}</Tag>
        {trip.best_seasons.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">{trip.summary}</p>

      <details className="group">
        <summary
          className={`${primaryButton} w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
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
              <li key={day.day} className="rounded-2xl bg-stone-100 p-3 dark:bg-card-dark-2">
                <h4 className="font-bold text-stone-900 dark:text-stone-50">
                  第 {day.day} 天・{day.title}
                </h4>
                {day.stay && <p className="text-xs text-stone-600 dark:text-stone-400">住：{day.stay}</p>}
                <ul className="mt-2 flex flex-col gap-2">
                  {day.stops.map((stop) => (
                    <li key={stop.name} className="rounded-xl bg-white p-3 dark:bg-card-dark">
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
            : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-card-dark dark:text-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        {isFav ? '已收藏這個行程' : '收藏這個行程'}
      </button>
    </article>
  );
}
