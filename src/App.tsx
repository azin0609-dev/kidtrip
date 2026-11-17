import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImportDialog, ReportDialog } from './components/Dialogs.tsx';
import { Dino, DinoEgg } from './components/Dino.tsx';
import { Footer } from './components/Footer.tsx';
import { HotelCard } from './components/HotelCard.tsx';
import { FoodFiltersPanel, HotelFiltersPanel, SpotFiltersPanel } from './components/Filters.tsx';
import { KidPick } from './components/KidPick.tsx';
import { Memories, Passport, YearReviewCard } from './components/Passport.tsx';
import { RestaurantCard } from './components/RestaurantCard.tsx';
import { Recommendations } from './components/Recommendations.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { SpotCard } from './components/SpotCard.tsx';
import { TripCard } from './components/TripCard.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { buttonBase } from './components/ui.tsx';
import { type Hotel, type Restaurant, type Spot, hotels, origins, restaurants, spots, trips } from './data/index.ts';
import { useHashTab } from './hooks/useHashTab.ts';
import { useStoredState } from './hooks/useStoredState.ts';
import { useWeekendWeather } from './hooks/useWeekendWeather.ts';
import { isSpotVisible, todayInTaipei } from './lib/date.ts';
import {
  DEFAULT_FOOD_FILTERS,
  DEFAULT_HOTEL_FILTERS,
  DEFAULT_SPOT_FILTERS,
  filterHotels,
  filterRestaurants,
  filterSpots,
  listCounties,
  sortByDrive,
  toggleInList,
} from './lib/filter.ts';
import { kidAgeNote } from './lib/details.ts';
import { latestVerified, shortOriginLabel } from './lib/format.ts';
import { defaultOrigin, makeMinsOf } from './lib/origin.ts';
import { passportProgress, yearReview } from './lib/passport.ts';
import { pickSpot } from './lib/pick.ts';
import { setStars, toggleRatingTag } from './lib/ratings.ts';
import { recommendRound, weekSeed } from './lib/recommend.ts';
import { SHARE_PARAM, type SharePayload, buildShareUrl, countNew, decodeShare, mergeShare } from './lib/share.ts';
import { DEFAULT_NAP, formatReports, listMemories, setMemo, toggleBeen as toggleBeenState } from './lib/storage.ts';
import { TABS } from './lib/tabs.ts';

export default function App() {
  const today = useMemo(() => todayInTaipei(), []);
  const [tab, goTab] = useHashTab();
  const [stored, update] = useStoredState();
  const [spotFilters, setSpotFilters] = useState(DEFAULT_SPOT_FILTERS);
  const [hotelFilters, setHotelFilters] = useState(DEFAULT_HOTEL_FILTERS);
  const [foodFilters, setFoodFilters] = useState(DEFAULT_FOOD_FILTERS);
  const [picked, setPicked] = useState<{ id: string | null; empty: boolean }>({ id: null, empty: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // null = 還沒手動改過，跟著天氣預報；按過開關就以使用者的選擇為準。
  const [rainyOverride, setRainyOverride] = useState<boolean | null>(null);
  const [overnight, setOvernight] = useState(false);
  const [elders, setElders] = useState(false);
  const [kidPickOpen, setKidPickOpen] = useState(false);
  const [shuffle, setShuffle] = useState(0);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);
  // 打開的是分享連結（?share=...）：先問要不要合併，並把參數從網址拿掉。
  const [incoming, setIncoming] = useState<SharePayload | null>(() => {
    const code = new URL(window.location.href).searchParams.get(SHARE_PARAM);
    return code ? decodeShare(code) : null;
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SHARE_PARAM)) return;
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(null, '', url.toString());
  }, []);

  const nameOf = useCallback(
    (id: string) =>
      spots.find((s) => s.id === id)?.name ??
      hotels.find((h) => h.id === id)?.name ??
      restaurants.find((r) => r.id === id)?.name ??
      trips.find((t) => t.id === id)?.title ??
      id,
    [],
  );
  const copyText = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return done;
    } catch {
      return `沒辦法自動複製，請手動複製：${text}`;
    }
  };
  const shareList = async () => {
    const url = buildShareUrl(window.location.href, stored);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '這週去哪玩', text: '我的收藏清單', url });
        return '已經打開分享選單。';
      } catch {
        // 使用者取消或不支援，改用複製
      }
    }
    return copyText(url, '連結已複製，貼給另一半就可以了。');
  };

  const fallbackOrigin = useMemo(() => defaultOrigin(origins), []);
  const origin = stored.origin ?? fallbackOrigin;
  const minsOf = useMemo(() => makeMinsOf(origin), [origin]);
  const originShort = shortOriginLabel(origin.label);
  const weather = useWeekendWeather(origin, today);
  const rainy = rainyOverride ?? weather?.rainy ?? false;

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

  const foodBySpot = useMemo(() => {
    const map = new Map<string, Restaurant[]>();
    for (const r of sortByDrive(restaurants, minsOf)) {
      for (const id of r.near_spot_ids) map.set(id, [...(map.get(id) ?? []), r]);
    }
    return map;
  }, [minsOf]);
  const foodResults = useMemo(
    () => sortByDrive(filterRestaurants(restaurants, foodFilters, minsOf), minsOf),
    [foodFilters, minsOf],
  );
  const foodCounties = useMemo(() => listCounties(restaurants, minsOf), [minsOf]);
  const spotCounties = useMemo(() => listCounties(visibleSpots, minsOf), [visibleSpots, minsOf]);
  const hotelCounties = useMemo(() => listCounties(hotels, minsOf), [minsOf]);

  const favSet = new Set(stored.fav);
  const beenSet = new Set(stored.been);
  const favSpots = sortByDrive(visibleSpots.filter((s) => favSet.has(s.id)), minsOf);
  const favHotels = sortByDrive(hotels.filter((h) => favSet.has(h.id)), minsOf);
  const favTrips = trips.filter((t) => favSet.has(t.id));
  const favFood = sortByDrive(restaurants.filter((r) => favSet.has(r.id)), minsOf);
  const verifiedOn = latestVerified([...spots, ...hotels, ...restaurants]);

  const toggleFav = (id: string) => update((s) => ({ ...s, fav: toggleInList(s.fav, id) }));
  const toggleBeen = (id: string) => update((s) => toggleBeenState(s, id, today));

  const picks = useMemo(
    () =>
      recommendRound(
        spots,
        { today, minsOf, fav: stored.fav, been: stored.been, beenAt: stored.beenAt ?? {}, rainy, overnight, elders, ratings: stored.ratings },
        (round) => weekSeed(today, origin, round),
        shuffle,
      ),
    [today, minsOf, stored.fav, stored.been, stored.beenAt, rainy, overnight, elders, origin, shuffle, stored.ratings],
  );

  const pickedSpot = picked.id ? spotById.get(picked.id) : undefined;
  const doPick = () => {
    const result = pickSpot(spotResults, { today, been: stored.been, lastId: picked.id });
    setPicked({ id: result?.id ?? picked.id, empty: result === null });
    requestAnimationFrame(() =>
      document.getElementById('pick-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
    );
  };

  const renderSpot = (spot: Spot, highlight = false, reason?: string) => (
    <SpotCard
      key={spot.id}
      spot={spot}
      today={today}
      mins={minsOf(spot)}
      originLabel={originShort}
      nearHotels={hotelsBySpot.get(spot.id) ?? []}
      nearFood={foodBySpot.get(spot.id) ?? []}
      isFav={favSet.has(spot.id)}
      isBeen={beenSet.has(spot.id)}
      onToggleFav={() => toggleFav(spot.id)}
      onToggleBeen={() => toggleBeen(spot.id)}
      onReport={() => setReportFor({ id: spot.id, name: spot.name })}
      highlight={highlight}
      reason={reason}
      kidNote={kidAgeNote(spot, stored.kids ?? [], today)}
      nap={stored.nap ?? DEFAULT_NAP}
      memo={stored.memos?.[spot.id]}
      onMemo={(text) => update((s) => setMemo(s, spot.id, text))}
      rating={stored.ratings?.[spot.id]}
      onStars={(n) => update((s) => ({ ...s, ratings: setStars(s.ratings ?? {}, spot.id, n) }))}
      onRatingTag={(t) => update((s) => ({ ...s, ratings: toggleRatingTag(s.ratings ?? {}, spot.id, t) }))}
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
      onReport={() => setReportFor({ id: hotel.id, name: hotel.name })}
    />
  );

  const renderFood = (r: Restaurant) => (
    <RestaurantCard
      key={r.id}
      restaurant={r}
      mins={minsOf(r)}
      originLabel={originShort}
      nearSpots={r.near_spot_ids.flatMap((id) => spotById.get(id) ?? [])}
      isFav={favSet.has(r.id)}
      onToggleFav={() => toggleFav(r.id)}
      onReport={() => setReportFor({ id: r.id, name: r.name })}
    />
  );

  const grid = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="min-h-dvh bg-[#f6f9ec] text-stone-900 dark:bg-[#0f1a14] dark:text-stone-100">
      <header className="sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)] border-stone-200 bg-[#f6f9ec]/95 backdrop-blur dark:border-emerald-950 dark:bg-[#0f1a14]/95">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex min-w-0 items-center gap-1.5 text-xl font-extrabold tracking-wide text-emerald-900 dark:text-emerald-100">
              <Dino className="h-10 w-10 shrink-0" />
              <span className="truncate">這週去哪玩</span>
            </h1>
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
                className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 sm:flex-none sm:px-5 ${
                  tab === t.id
                    ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300'
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
            <Recommendations
              picks={picks}
              rainy={rainy}
              overnight={overnight}
              elders={elders}
              onElders={setElders}
              rainyIsAuto={rainyOverride === null}
              weather={weather}
              onRainy={setRainyOverride}
              onOvernight={setOvernight}
              onShuffle={() => setShuffle((n) => n + 1)}
              onKidPick={() => setKidPickOpen(true)}
              renderCard={(p) => renderSpot(p.spot, false, p.reasons.join('・'))}
            />
            <h2 className="mb-3 text-lg font-bold">全部景點</h2>
            <SpotFiltersPanel value={spotFilters} onChange={setSpotFilters} counties={spotCounties} />
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
                共 {spotResults.length} 個，依車程由近到遠
              </p>
              <button
                type="button"
                onClick={doPick}
                className={`${buttonBase} bg-amber-400 text-stone-950 hover:bg-amber-300`}
              >
                <DinoEgg className="h-5 w-5" />
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
                      <p className="mb-2 flex items-center gap-1 text-sm font-bold">
                        <Dino className="h-8 w-8" />
                        小恐龍選好了，這週就去這裡吧
                      </p>
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
            <HotelFiltersPanel value={hotelFilters} onChange={setHotelFilters} counties={hotelCounties} />
            <p className="mt-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
              共 {hotelResults.length} 間，依車程由近到遠
            </p>
            <div className={`mt-4 ${grid}`}>{hotelResults.map(renderHotel)}</div>
            {hotelResults.length === 0 && <EmptyState text="沒有符合的住宿，試試少選幾個條件。" />}
          </>
        )}

        {tab === 'food' && (
          <>
            <FoodFiltersPanel value={foodFilters} onChange={setFoodFilters} counties={foodCounties} />
            <p className="mt-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
              共 {foodResults.length} 間，依車程由近到遠
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              親子餐廳開開關關很常見，出發前先打電話或看粉專確認有沒有營業。
            </p>
            <div className={`mt-4 ${grid}`}>{foodResults.map(renderFood)}</div>
            {foodResults.length === 0 && <EmptyState text="沒有符合的餐廳，試試少選幾個條件。" />}
          </>
        )}

        {tab === 'trips' && (
          <>
            <h2 className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">帶小孩出國玩</h2>
            <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
              給 3–6 歲小孩的行程骨架：每天只排兩三個點，留時間午睡。是大方向，細節出發前再查官方資訊。
            </p>
            <div className={`mt-4 ${grid}`}>
              {trips.map((t) => (
                <TripCard key={t.id} trip={t} isFav={favSet.has(t.id)} onToggleFav={() => toggleFav(t.id)} />
              ))}
            </div>
            {trips.length === 0 && <EmptyState text="還沒有整理出國行程。" />}
          </>
        )}

        {tab === 'favs' && (
          <>
            <div className="mb-6 flex flex-col gap-4">
              <Passport progress={passportProgress(spots, stored.been, (s) => isSpotVisible(s, today))} beenAt={stored.beenAt ?? {}} />
              <Memories items={listMemories(stored.memos ?? {}, stored.beenAt ?? {}, nameOf)} />
              <YearReviewCard review={yearReview(spots, stored.beenAt ?? {}, stored.ratings ?? {}, Number(today.slice(0, 4)), minsOf)} />
            </div>
            <h2 className="mb-3 text-lg font-bold">我的收藏</h2>
            {favSpots.length === 0 && favHotels.length === 0 && favFood.length === 0 && favTrips.length === 0 && (
              <EmptyState text="還沒有收藏。看到喜歡的景點、住宿或餐廳，按「收藏」就會出現在這裡。" />
            )}
            {favSpots.length > 0 && (
              <section>
                <h2 className="mb-3 text-base font-bold">景點（{favSpots.length}）</h2>
                <div className={grid}>{favSpots.map((s) => renderSpot(s))}</div>
              </section>
            )}
            {favHotels.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-base font-bold">住宿（{favHotels.length}）</h2>
                <div className={grid}>{favHotels.map(renderHotel)}</div>
              </section>
            )}
            {favTrips.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 text-base font-bold">出國行程（{favTrips.length}）</h2>
                <div className={grid}>
                  {favTrips.map((t) => (
                    <TripCard key={t.id} trip={t} isFav onToggleFav={() => toggleFav(t.id)} />
                  ))}
                </div>
              </section>
            )}
            {favFood.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-base font-bold">餐廳（{favFood.length}）</h2>
                <div className={grid}>{favFood.map(renderFood)}</div>
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
        onShare={shareList}
        reports={stored.reports ?? []}
        nameOf={nameOf}
        onCopyReports={() => copyText(formatReports(stored.reports ?? [], nameOf), '已複製，可以貼給負責改資料的人。')}
        onClearReports={() => update((s) => ({ ...s, reports: [] }))}
      />
      <ReportDialog
        target={reportFor}
        onClose={() => setReportFor(null)}
        onSubmit={(note) => {
          const id = reportFor?.id;
          if (id) update((s) => ({ ...s, reports: [...(s.reports ?? []), { id, note, date: today }] }));
          setReportFor(null);
        }}
      />
      <ImportDialog
        incoming={incoming ? countNew(stored, incoming) : null}
        onAccept={() => {
          if (incoming) update((s) => mergeShare(s, incoming));
          setIncoming(null);
        }}
        onDecline={() => setIncoming(null)}
      />
      <KidPick open={kidPickOpen} picks={picks} onClose={() => setKidPickOpen(false)} />
      <UpdatePrompt />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
      <Dino mood="sleepy" className="h-24 w-24" />
      <p className="text-sm text-stone-700 dark:text-stone-300">{text}</p>
    </div>
  );
}
