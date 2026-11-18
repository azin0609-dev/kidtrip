import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ImportDialog, ReportDialog } from './components/Dialogs.tsx';
import { BrandMark, Bolt, Pin, SleepySun, TabIcon } from './components/Brand.tsx';
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
import { IncomingPlan, WeekPlanCard } from './components/WeekPlanCard.tsx';
import { Chip, buttonBase } from './components/ui.tsx';
import { type Hotel, type Restaurant, type Spot, hotels, origins, restaurants, spots, trips } from './data/index.ts';
import { useHashTab } from './hooks/useHashTab.ts';
import { useStoredState } from './hooks/useStoredState.ts';
import { useForecast } from './hooks/useWeekendWeather.ts';
import { isSpotVisible } from './lib/date.ts';
import { useToday } from './hooks/useToday.ts';
import { isHot } from './lib/trip-risks.ts';
import { isRecommendable } from './lib/verification.ts';
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
import { ageYears, kidAgeNote } from './lib/details.ts';
import { latestVerified, shortOriginLabel } from './lib/format.ts';
import { defaultOrigin, makeMinsOf } from './lib/origin.ts';
import { passportProgress, yearReview } from './lib/passport.ts';
import { pickSpot } from './lib/pick.ts';
import { setStars, toggleRatingTag } from './lib/ratings.ts';
import { napPlan } from './lib/plan.ts';
import { DEFAULT_MAX_DRIVE, type RecommendContext, pickBackup, recommendRound, weekSeed } from './lib/recommend.ts';
import { type Slot, availableSlots, normalizeSlot, defaultSlot, slotLabelWithDate, slotWeather } from './lib/weather.ts';
import { PLAN_PARAM, type WeekPlan, buildPlanUrl, decodePlan, isCurrentPlan, makePlan, swapToBackup } from './lib/weekplan.ts';
import { SHARE_PARAM, type SharePayload, buildShareUrl, countNew, decodeShare, mergeShare } from './lib/share.ts';
import { DEFAULT_NAP, formatReports, listMemories, setMemo, toggleBeen as toggleBeenState } from './lib/storage.ts';
import { TABS } from './lib/tabs.ts';

export default function App() {
  // App 開著不關也會跨日更新。
  const today = useToday();
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
  const [chosenSlot, setChosenSlot] = useState<Slot>(() => defaultSlot(today));
  // 選過的時段已經過了（例如週六選、週日才打開）就換成預設時段。
  const slot = normalizeSlot(today, chosenSlot);
  // 換日期時重新依預報判斷要不要下雨，不沿用先前手動關掉的設定。
  const setSlot = (s: Slot) => {
    setChosenSlot(s);
    setRainyOverride(null);
  };
  const [maxDrive, setMaxDriveState] = useState<number>(() => stored.prefs?.maxDrive ?? DEFAULT_MAX_DRIVE);
  // null = 還沒手動改過：有 3 歲以下的孩子就預設帶推車。
  const [strollerOverride, setStrollerState] = useState<boolean | null>(() => stored.prefs?.stroller ?? null);
  const setMaxDrive = (m: number) => {
    setMaxDriveState(m);
    update((s) => ({ ...s, prefs: { ...s.prefs, maxDrive: m } }));
  };
  const setStrollerOverride = (v: boolean) => {
    setStrollerState(v);
    update((s) => ({ ...s, prefs: { ...s.prefs, stroller: v } }));
  };
  // 打開的是行程連結（?plan=...）：先問要不要存，並把參數從網址拿掉。
  const [incomingPlan, setIncomingPlan] = useState<WeekPlan | null>(() => {
    const code = new URL(window.location.href).searchParams.get(PLAN_PARAM);
    return code ? decodePlan(code) : null;
  });
  const [elders, setElders] = useState(false);
  const [kidPickOpen, setKidPickOpen] = useState(false);
  const [tripCountry, setTripCountry] = useState('all');
  const tripCountries = useMemo(() => [...new Set(trips.map((t) => t.country))], []);
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
    if (!url.searchParams.has(SHARE_PARAM) && !url.searchParams.has(PLAN_PARAM)) return;
    url.searchParams.delete(SHARE_PARAM);
    url.searchParams.delete(PLAN_PARAM);
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
        await navigator.share({ title: '放電研究所', text: '我的收藏清單', url });
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
  const originForecast = useForecast(origin);
  const weather = originForecast ? slotWeather(originForecast, today, slot) : null;
  const rainy = rainyOverride ?? weather?.rainy ?? false;
  const hot = isHot(weather);
  const kidsInfo = useMemo(
    () =>
      (stored.kids ?? []).flatMap((k) => {
        const age = ageYears(k.birthYm, today);
        return age === null ? [] : [{ name: k.nickname, age }];
      }),
    [stored.kids, today],
  );
  const needStroller = strollerOverride ?? kidsInfo.some((k) => k.age < 3);

  const visibleSpots = useMemo(() => spots.filter((s) => isSpotVisible(s, today)), [today]);
  const spotById = useMemo(() => new Map(visibleSpots.map((s) => [s.id, s])), [visibleSpots]);
  const hotelsBySpot = useMemo(() => {
    const map = new Map<string, Hotel[]>();
    // 位置或營業狀態有疑問的住宿，不算「附近有住宿」。
    for (const h of sortByDrive(hotels.filter(isRecommendable), minsOf)) {
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
    // 位置確定的餐廳排前面，只知道在哪一區的排後面。
    const ordered = [...sortByDrive(restaurants, minsOf)].sort((a, b) => Number(!!a.coord_area) - Number(!!b.coord_area));
    for (const r of ordered) {
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

  const recommendCtx = useMemo<RecommendContext>(
    () => ({
      today,
      minsOf,
      fav: stored.fav,
      been: stored.been,
      beenAt: stored.beenAt ?? {},
      rainy,
      hot,
      overnight,
      maxDrive,
      needStroller,
      kids: kidsInfo,
      hasStay: (spot) => (hotelsBySpot.get(spot.id)?.length ?? 0) > 0,
      elders,
      ratings: stored.ratings,
    }),
    [today, minsOf, stored.fav, stored.been, stored.beenAt, rainy, hot, overnight, maxDrive, needStroller, kidsInfo, hotelsBySpot, elders, stored.ratings],
  );
  const round = useMemo(
    () => recommendRound(spots, recommendCtx, (n) => weekSeed(today, origin, n), shuffle),
    [recommendCtx, today, origin, shuffle],
  );
  const picks = round.picks;

  // ── 這週放電計畫 ──
  const plan = isCurrentPlan(stored.plan, today) ? stored.plan : null;
  const planSpot = plan ? spots.find((s) => s.id === plan.spotId) : undefined;
  const planBackup = plan?.backupId ? (spots.find((s) => s.id === plan.backupId) ?? null) : null;
  const planForecast = useForecast(planSpot && planSpot.lat !== null && planSpot.lng !== null ? { lat: planSpot.lat, lng: planSpot.lng } : null);
  const planWeather = plan && planForecast ? slotWeather(planForecast, today, plan.slot) : null;
  const planMins = planSpot ? minsOf(planSpot) : null;
  const choosePlan = (spot: Spot) => {
    const backup = pickBackup(spots, recommendCtx, weekSeed(today, origin, 0), spot.id);
    update((s) => ({ ...s, plan: makePlan(today, spot.id, slot, backup?.spot.id) }));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  const clearPlan = () =>
    update((s) => {
      const next = { ...s };
      delete next.plan;
      return next;
    });
  const sharePlan = async () => {
    if (!plan || !planSpot) return '';
    const url = buildPlanUrl(window.location.href, plan);
    const text = `${slotLabelWithDate(today, plan.slot)}去${planSpot.name}${planBackup ? `，下雨改去${planBackup.name}` : ''}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '放電研究所：這週放電計畫', text, url });
        return '已經打開分享選單。';
      } catch {
        // 使用者取消或不支援，改用複製
      }
    }
    return copyText(`${text}\n${url}`, '行程連結已複製，貼到 LINE 給另一半就可以了。');
  };
  const incomingSpot = incomingPlan ? spots.find((s) => s.id === incomingPlan.spotId) : undefined;

  const pickedSpot = picked.id ? spotById.get(picked.id) : undefined;
  // 有用篩選或搜尋時，「找其他地方」保持展開。
  const spotFiltersActive = JSON.stringify(spotFilters) !== JSON.stringify(DEFAULT_SPOT_FILTERS) || picked.id !== null;
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
      today={today}
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
      today={today}
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
    <div className="relative min-h-dvh text-stone-900 dark:text-stone-50">
      <div className="top-band" aria-hidden="true" />
      <header className="sticky top-0 z-10 bg-paper/85 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:bg-ink/85">
        <div className="mx-auto max-w-6xl px-4 py-2 md:pt-3 md:pb-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex min-w-0 items-center gap-2">
              <BrandMark className="h-8 w-8 shrink-0 md:h-9 md:w-9" />
              <span className="min-w-0">
                <span className="block truncate text-lg leading-tight font-black tracking-wide text-stone-900 dark:text-stone-50">放電研究所</span>
                <span className="hidden truncate text-xs leading-tight text-stone-600 md:block dark:text-stone-400">孩子負責放電，我們負責找地方。</span>
              </span>
            </h1>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={`設定，目前從${origin.label}出發`}
              className={`${buttonBase} min-w-0 shrink-0 gap-1 border border-stone-200 bg-white text-stone-800 shadow-sm hover:bg-stone-100 dark:border-stone-700 dark:bg-card-dark dark:text-stone-100 dark:hover:bg-card-dark-2`}
            >
              <Pin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span className="truncate">{originShort}出發</span>
              <span aria-hidden="true" className="text-stone-500">▾</span>
            </button>
          </div>
          {/* 桌面：分頁放在頂端。 */}
          <nav aria-label="分頁" className="mt-2 hidden md:flex">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  goTab(t.id);
                }}
                className={`flex min-h-11 items-center gap-1.5 border-b-2 px-5 text-sm font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 ${
                  tab === t.id
                    ? 'border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300'
                    : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                }`}
              >
                <TabIcon tab={t.id} className="h-5 w-5" />
                {t.label}
                {t.id === 'favs' && stored.fav.length > 0 && <span className="text-xs font-normal">({stored.fav.length})</span>}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* 手機：分頁固定在底部，大拇指好按。 */}
      <nav
        aria-label="分頁"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-stone-200 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-stone-800 dark:bg-ink/95"
      >
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTab(t.id);
              window.scrollTo({ top: 0 });
            }}
            className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-bold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-600 ${
              tab === t.id ? 'text-emerald-800 dark:text-emerald-300' : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-full ${tab === t.id ? 'bg-emerald-100 dark:bg-emerald-950' : ''}`}
            >
              <TabIcon tab={t.id} className="h-5 w-5" />
            </span>
            {t.label}
            {t.id === 'favs' && stored.fav.length > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-1.6rem)] min-w-5 rounded-full bg-coral-400 px-1 text-center text-[10px] leading-5 text-stone-950">
                {stored.fav.length}
              </span>
            )}
          </a>
        ))}
      </nav>

      <main className="relative mx-auto max-w-6xl px-4 pt-4">
        {tab === 'spots' && (
          <>
            {incomingPlan && incomingSpot && (
              <IncomingPlan
                spotName={incomingSpot.name}
                backupName={incomingPlan.backupId ? (spots.find((s) => s.id === incomingPlan.backupId)?.name ?? null) : null}
                when={slotLabelWithDate(today, incomingPlan.slot)}
                expired={!isCurrentPlan(incomingPlan, today)}
                onAccept={() => {
                  update((s) => ({ ...s, plan: incomingPlan }));
                  setIncomingPlan(null);
                }}
                onDecline={() => setIncomingPlan(null)}
              />
            )}
            {plan && planSpot && (
              <WeekPlanCard
                spot={planSpot}
                backup={planBackup}
                when={slotLabelWithDate(today, plan.slot)}
                mins={planMins}
                weather={planWeather}
                napText={
                  planMins !== null && planSpot.stay_hours
                    ? (napPlan(planMins, planSpot.stay_hours, stored.nap ?? DEFAULT_NAP)?.text ?? null)
                    : null
                }
                onSwapToBackup={() => update((s) => (s.plan ? { ...s, plan: swapToBackup(s.plan) } : s))}
                onClear={clearPlan}
                onShare={sharePlan}
              />
            )}
            <Recommendations
              today={today}
              round={round}
              slot={slot}
              slots={availableSlots(today)}
              originLabel={originShort}
              onSlot={setSlot}
              weather={weather}
              maxDrive={maxDrive}
              onMaxDrive={(m) => {
                setMaxDrive(m);
                setOvernight(false);
                setShuffle(0);
              }}
              needStroller={needStroller}
              onNeedStroller={(v) => {
                setStrollerOverride(v);
                setShuffle(0);
              }}
              rainy={rainy}
              rainyIsAuto={rainyOverride === null}
              onRainy={(v) => {
                setRainyOverride(v);
                setShuffle(0);
              }}
              overnight={overnight}
              onOvernight={(v) => {
                setOvernight(v);
                setShuffle(0);
              }}
              elders={elders}
              onElders={(v) => {
                setElders(v);
                setShuffle(0);
              }}
              onShuffle={() => setShuffle((n) => n + 1)}
              onKidPick={() => setKidPickOpen(true)}
              chosenId={plan?.spotId ?? null}
              onChoose={choosePlan}
              renderFull={(p) => renderSpot(p.spot)}
            />
            <details
              className="group rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-stone-200 backdrop-blur dark:bg-card-dark/90 dark:ring-stone-800"
              open={spotFiltersActive || undefined}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                <span>找其他地方</span>
                <span className="text-sm font-normal text-stone-600 dark:text-stone-400">
                  搜尋、篩選、全部 {visibleSpots.length} 個景點
                  <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              <div className="mt-3">
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
                <Bolt className="h-5 w-5" />
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
                        <Bolt className="h-5 w-5 text-amber-400" />
                        抽好了，這週就去這裡放電吧
                      </p>
                      {renderSpot(pickedSpot, true)}
                    </>
                  )
                )}
              </section>
            )}
            <div className={`mt-4 ${grid}`}>{spotResults.map((s) => renderSpot(s))}</div>
            {spotResults.length === 0 && <EmptyState text="沒有符合的景點，試試少選幾個條件。" />}
              </div>
            </details>
          </>
        )}

        {tab === 'hotels' && (
          <>
            <TabIntro title="住一晚" text="親子飯店和民宿，玩累了就住下來。" />
            <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2f2614] dark:text-amber-100 dark:ring-amber-900">
              {hotels.filter((h) => h.verified && isRecommendable(h)).length} 間（宜蘭、桃園為主）用 Google 地圖查過還在營業，其他還沒查。設施和房價都是粗估，訂房前先看官方網站或訂房網站；發現不對請按卡片上的「資料有誤？」。
            </p>
            <FilterBox active={JSON.stringify(hotelFilters) !== JSON.stringify(DEFAULT_HOTEL_FILTERS)}>
              <HotelFiltersPanel value={hotelFilters} onChange={setHotelFilters} counties={hotelCounties} />
            </FilterBox>
            <p className="mt-4 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
              共 {hotelResults.length} 間，依車程由近到遠
            </p>
            <div className={`mt-4 ${grid}`}>{hotelResults.map(renderHotel)}</div>
            {hotelResults.length === 0 && <EmptyState text="沒有符合的住宿，試試少選幾個條件。" />}
          </>
        )}

        {tab === 'food' && (
          <>
            <TabIntro title="吃好料" text="有遊戲區、不怕小孩吵的親子餐廳。" />
            <FilterBox active={JSON.stringify(foodFilters) !== JSON.stringify(DEFAULT_FOOD_FILTERS)}>
              <FoodFiltersPanel value={foodFilters} onChange={setFoodFilters} counties={foodCounties} />
            </FilterBox>
            <p className="mt-4 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
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
            <TabIntro title="飛出國" text="日本、韓國、香港、上海的親子行程骨架：每天只排兩三個點，留時間午睡。" />
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200 dark:bg-[#2f2614] dark:text-amber-100 dark:ring-amber-900">
              這些是「參考骨架」，景點的營業時間、票價、預約方式還沒逐項確認。真的要去時，請把那一套行程的每個點再查一次官方資訊。
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="篩選行程">
              {['all', 'disney', ...tripCountries].map((c) => (
                <Chip key={c} pressed={tripCountry === c} onClick={() => setTripCountry(c)}>
                  {c === 'all' ? '全部' : c === 'disney' ? '有迪士尼' : c}
                </Chip>
              ))}
            </div>
            <div className={`mt-4 ${grid}`}>
              {trips
                .filter((t) => tripCountry === 'all' || (tripCountry === 'disney' ? tripHasDisney(t) : t.country === tripCountry))
                .map((t) => (
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
            <h2 className="mb-3 text-lg font-black text-emerald-900 dark:text-emerald-50">我的收藏</h2>
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
        onOriginChange={(o) => {
          update((s) => ({ ...s, origin: o }));
          setRainyOverride(null);
        }}
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
        onSubmit={(note, kind, copy) => {
          const id = reportFor?.id;
          if (id) {
            const report = { id, note, date: today, kind };
            update((s) => ({ ...s, reports: [...(s.reports ?? []), report] }));
            if (copy) void copyText(formatReports([report], nameOf), '');
          }
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
      <KidPick
        open={kidPickOpen}
        picks={picks}
        currentPlanName={planSpot?.name ?? null}
        onClose={() => setKidPickOpen(false)}
        onChoose={(p) => choosePlan(p.spot)}
      />
      <UpdatePrompt />
    </div>
  );
}

/** 行程裡有沒有迪士尼樂園。 */
function tripHasDisney(trip: { itinerary: { stops: { name: string }[] }[] }): boolean {
  return trip.itinerary.some((d) => d.stops.some((s) => s.name.includes('迪士尼')));
}

/** 分頁開頭的標題和一句說明。 */
function TabIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-3 px-1">
      <h2 className="text-2xl font-black text-stone-900 md:text-3xl dark:text-stone-50">{title}</h2>
      <p className="text-sm text-stone-600 dark:text-stone-400">{text}</p>
    </div>
  );
}

/** 搜尋與篩選收成一塊，可以展開；有在用篩選時保持展開。 */
function FilterBox({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <details
      className="group rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-stone-200 backdrop-blur dark:bg-card-dark/90 dark:ring-stone-800"
      open={active || undefined}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
        <span>搜尋與篩選{active && <span className="ml-1 text-sm font-normal text-emerald-800 dark:text-emerald-300">（使用中）</span>}</span>
        <span className="text-sm font-normal text-stone-600 dark:text-stone-400">
          車程、縣市、特色
          <span aria-hidden="true" className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl bg-white/90 p-6 text-center ring-1 ring-stone-200 dark:bg-card-dark dark:ring-stone-800">
      <SleepySun className="h-16 w-24" />
      <p className="text-sm text-stone-700 dark:text-stone-300">{text}</p>
    </div>
  );
}
