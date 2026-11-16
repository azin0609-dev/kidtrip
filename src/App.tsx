import { useCallback, useMemo, useState } from 'react';
import { Footer } from './components/Footer.tsx';
import { HotelCard } from './components/HotelCard.tsx';
import { HotelFiltersPanel, SpotFiltersPanel } from './components/Filters.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { SpotCard } from './components/SpotCard.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { buttonBase } from './components/ui.tsx';
import { type Hotel, type Spot, hotels, origins, spots } from './data/index.ts';
import { useHashTab } from './hooks/useHashTab.ts';
import { useStoredState } from './hooks/useStoredState.ts';
import { isSpotVisible, todayInTaipei } from './lib/date.ts';
import {
  DEFAULT_HOTEL_FILTERS,
  DEFAULT_SPOT_FILTERS,
  filterHotels,
  filterSpots,
  sortByDrive,
  toggleInList,
} from './lib/filter.ts';
import { latestVerified, shortOriginLabel } from './lib/format.ts';
import { defaultOrigin, makeMinsOf } from './lib/origin.ts';
import { pickSpot } from './lib/pick.ts';
import { TABS } from './lib/tabs.ts';

export default function App() {
  const today = useMemo(() => todayInTaipei(), []);
  const [tab, goTab] = useHashTab();
  const [stored, update] = useStoredState();
  const [spotFilters, setSpotFilters] = useState(DEFAULT_SPOT_FILTERS);
  const [hotelFilters, setHotelFilters] = useState(DEFAULT_HOTEL_FILTERS);
  const [picked, setPicked] = useState<{ id: string | null; empty: boolean }>({ id: null, empty: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const fallbackOrigin = useMemo(() => defaultOrigin(origins), []);
  const origin = stored.origin ?? fallbackOrigin;
  const minsOf = useMemo(() => makeMinsOf(origin), [origin]);
  const originShort = shortOriginLabel(origin.label);

  const visibleSpots = useMemo(() => spots.filter((s) => isSpotVisible(s, today)), [today]);
  const spotById = useMemo(() => new Map(visibleSpots.map((s) => [s.id, s])), [visibleSpots]);
  const hotelsBySpot = useMemo(() => {
    const map = new Map<string, Hotel[]>();
    for (const h of sortByDrive(hotels, minsOf)) {
      for (const id of h.near_spot_ids) map.set(id, [...(map.get(id) ?? []), h]);
    }
    return map;
  }, [minsOf]);

  const spotResults = useMemo(
    () => sortByDrive(filterSpots(spots, spotFilters, { today, been: stored.been, minsOf }), minsOf),
    [spotFilters, today, stored.been, minsOf],
  );
  const hotelResults = useMemo(
    () => sortByDrive(filterHotels(hotels, hotelFilters, minsOf), minsOf),
    [hotelFilters, minsOf],
  );

  const favSet = new Set(stored.fav);
  const beenSet = new Set(stored.been);
  const favSpots = sortByDrive(visibleSpots.filter((s) => favSet.has(s.id)), minsOf);
  const favHotels = sortByDrive(hotels.filter((h) => favSet.has(h.id)), minsOf);
  const verifiedOn = latestVerified([...spots, ...hotels]);

  const toggleFav = (id: string) => update((s) => ({ ...s, fav: toggleInList(s.fav, id) }));
  const toggleBeen = (id: string) => update((s) => ({ ...s, been: toggleInList(s.been, id) }));

  const pickedSpot = picked.id ? spotById.get(picked.id) : undefined;
  const doPick = () => {
    const result = pickSpot(spotResults, { today, been: stored.been, lastId: picked.id });
    setPicked({ id: result?.id ?? picked.id, empty: result === null });
    requestAnimationFrame(() =>
      document.getElementById('pick-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  };

  const renderSpot = (spot: Spot, highlight = false) => (
    <SpotCard
      key={spot.id}
      spot={spot}
      today={today}
      mins={minsOf(spot)}
      originLabel={originShort}
      nearHotels={hotelsBySpot.get(spot.id) ?? []}
      isFav={favSet.has(spot.id)}
      isBeen={beenSet.has(spot.id)}
      onToggleFav={() => toggleFav(spot.id)}
      onToggleBeen={() => toggleBeen(spot.id)}
      highlight={highlight}
    />
  );
  const renderHotel = (hotel: Hotel) => (
    <HotelCard
      key={hotel.id}
      hotel={hotel}
      mins={minsOf(hotel)}
      originLabel={originShort}
      nearSpots={hotel.near_spot_ids.flatMap((id) => spotById.get(id) ?? [])}
      isFav={favSet.has(hotel.id)}
      onToggleFav={() => toggleFav(hotel.id)}
    />
  );

  const grid = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)] border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold">這週去哪玩</h1>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={`設定，目前從${origin.label}出發`}
              className={`${buttonBase} min-w-0 border border-stone-300 text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800`}
            >
              <span className="truncate">從{originShort}出發</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <nav aria-label="分頁" className="mt-2 flex">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  goTab(t.id);
                }}
                className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600 sm:flex-none sm:px-5 ${
                  tab === t.id
                    ? 'border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300'
                    : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                }`}
              >
                {t.label}
                {t.id === 'favs' && stored.fav.length > 0 && <span className="ml-1 text-xs">({stored.fav.length})</span>}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        {tab === 'spots' && (
          <>
            <SpotFiltersPanel value={spotFilters} onChange={setSpotFilters} />
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
                共 {spotResults.length} 個，依車程由近到遠
              </p>
              <button
                type="button"
                onClick={doPick}
                className={`${buttonBase} bg-amber-400 text-stone-950 hover:bg-amber-300`}
              >
                幫我抽一個
              </button>
            </div>
            {(pickedSpot || picked.empty) && (
              <section id="pick-result" aria-label="抽籤結果" aria-live="polite" className="mt-3 scroll-mt-32">
                {picked.empty ? (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    目前條件下沒有可以抽的景點，放寬一點篩選再試試。
                  </p>
                ) : (
                  pickedSpot && (
                    <>
                      <p className="mb-2 text-sm font-medium">這週就去這裡吧</p>
                      {renderSpot(pickedSpot, true)}
                    </>
                  )
                )}
              </section>
            )}
            <div className={`mt-4 ${grid}`}>{spotResults.map((s) => renderSpot(s))}</div>
            {spotResults.length === 0 && <EmptyState text="沒有符合的景點，試試少選幾個條件。" />}
          </>
        )}

        {tab === 'hotels' && (
          <>
            <HotelFiltersPanel value={hotelFilters} onChange={setHotelFilters} />
            <p className="mt-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
              共 {hotelResults.length} 間，依車程由近到遠
            </p>
            <div className={`mt-4 ${grid}`}>{hotelResults.map(renderHotel)}</div>
            {hotelResults.length === 0 && <EmptyState text="沒有符合的飯店，試試少選幾個條件。" />}
          </>
        )}

        {tab === 'favs' && (
          <>
            {favSpots.length === 0 && favHotels.length === 0 && (
              <EmptyState text="還沒有收藏。看到喜歡的景點或飯店，按「收藏」就會出現在這裡。" />
            )}
            {favSpots.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold">景點（{favSpots.length}）</h2>
                <div className={grid}>{favSpots.map((s) => renderSpot(s))}</div>
              </section>
            )}
            {favHotels.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-base font-bold">飯店（{favHotels.length}）</h2>
                <div className={grid}>{favHotels.map(renderHotel)}</div>
              </section>
            )}
          </>
        )}

        <Footer verifiedOn={verifiedOn} originLabel={origin.label} />
      </main>
      <SettingsDialog
        open={settingsOpen}
        onClose={closeSettings}
        origins={origins}
        origin={origin}
        defaultOrigin={fallbackOrigin}
        onOriginChange={(o) => update((s) => ({ ...s, origin: o }))}
        kids={stored.kids ?? []}
        onKidsChange={(kids) => update((s) => ({ ...s, kids }))}
        nap={stored.nap}
        onNapChange={(nap) => update((s) => ({ ...s, nap }))}
        today={today}
      />
      <UpdatePrompt />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-6 rounded-xl bg-stone-100 p-4 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300">{text}</p>;
}
