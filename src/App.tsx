import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImportDialog, ReportDialog } from './components/Dialogs.tsx';
import { Dino, DinoEgg } from './components/Dino.tsx';
import { Footer } from './components/Footer.tsx';
import { HotelCard } from './components/HotelCard.tsx';
import { HotelFiltersPanel, SpotFiltersPanel } from './components/Filters.tsx';
import { Recommendations } from './components/Recommendations.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import { SpotCard } from './components/SpotCard.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { buttonBase } from './components/ui.tsx';
import { type Hotel, type Spot, hotels, origins, spots } from './data/index.ts';
import { useHashTab } from './hooks/useHashTab.ts';
import { useStoredState } from './hooks/useStoredState.ts';
import { useWeekendWeather } from './hooks/useWeekendWeather.ts';
import { isSpotVisible, todayInTaipei } from './lib/date.ts';
import {
  DEFAULT_HOTEL_FILTERS,
  DEFAULT_SPOT_FILTERS,
  filterHotels,
  filterSpots,
  listCounties,
  sortByDrive,
  toggleInList,
} from './lib/filter.ts';
import { kidAgeNote } from './lib/details.ts';
import { latestVerified, shortOriginLabel } from './lib/format.ts';
import { defaultOrigin, makeMinsOf } from './lib/origin.ts';
import { pickSpot } from './lib/pick.ts';
import { recommendRound, weekSeed } from './lib/recommend.ts';
import { SHARE_PARAM, type SharePayload, buildShareUrl, countNew, decodeShare, mergeShare } from './lib/share.ts';
import { formatReports, toggleBeen as toggleBeenState } from './lib/storage.ts';
import { TABS } from './lib/tabs.ts';

export default function App() {
  const today = useMemo(() => todayInTaipei(), []);
  const [tab, goTab] = useHashTab();
  const [stored, update] = useStoredState();
  const [spotFilters, setSpotFilters] = useState(DEFAULT_SPOT_FILTERS);
  const [hotelFilters, setHotelFilters] = useState(DEFAULT_HOTEL_FILTERS);
  const [picked, setPicked] = useState<{ id: string | null; empty: boolean }>({ id: null, empty: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // null = 還沒手動改過，跟著天氣預報；按過開關就以使用者的選擇為準。
  const [rainyOverride, setRainyOverride] = useState<boolean | null>(null);
  const [overnight, setOvernight] = useState(false);
  const [elders, setElders] = useState(false);
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
    (id: string) => spots.find((s) => s.id === id)?.name ?? hotels.find((h) => h.id === id)?.name ?? id,
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

  const spotCounties = useMemo(() => listCounties(visibleSpots, minsOf), [visibleSpots, minsOf]);
  const hotelCounties = useMemo(() => listCounties(hotels, minsOf), [minsOf]);

  const favSet = new Set(stored.fav);
  const beenSet = new Set(stored.been);
  const favSpots = sortByDrive(visibleSpots.filter((s) => favSet.has(s.id)), minsOf);
  const favHotels = sortByDrive(hotels.filter((h) => favSet.has(h.id)), minsOf);
  const verifiedOn = latestVerified([...spots, ...hotels]);

  const toggleFav = (id: string) => update((s) => ({ ...s, fav: toggleInList(s.fav, id) }));
  const toggleBeen = (id: string) => update((s) => toggleBeenState(s, id, today));

  const picks = useMemo(
    () =>
      recommendRound(
        spots,
        { today, minsOf, fav: stored.fav, been: stored.been, beenAt: stored.beenAt ?? {}, rainy, overnight, elders },
        (round) => weekSeed(today, origin, round),
        shuffle,
      ),
    [today, minsOf, stored.fav, stored.been, stored.beenAt, rainy, overnight, elders, origin, shuffle],
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
      isFav={favSet.has(spot.id)}
      isBeen={beenSet.has(spot.id)}
      onToggleFav={() => toggleFav(spot.id)}
      onToggleBeen={() => toggleBeen(spot.id)}
      onReport={() => setReportFor({ id: spot.id, name: spot.name })}
      highlight={highlight}
      reason={reason}
      kidNote={kidAgeNote(spot, stored.kids ?? [], today)}
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
