import type { Facility, Hotel, HotelKind, HotelTag, Region, Spot, SpotType } from '../data/schema.ts';
import { isSpotVisible } from './date.ts';
import { FACILITY_LABELS, HOTEL_KIND_LABELS, HOTEL_TAG_LABELS, TYPE_LABELS } from './labels.ts';

export type DriveFilter = 'all' | '30' | '60' | '120' | '240' | 'overnight';

export const DRIVE_OPTIONS: { value: DriveFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '30', label: '30 分內' },
  { value: '60', label: '1 小時內' },
  { value: '120', label: '2 小時內' },
  { value: '240', label: '4 小時內' },
  { value: 'overnight', label: '要住一晚' },
];

export interface SpotFilters {
  drive: DriveFilter;
  region: Region | 'all';
  /** 縣市（例如「宜蘭縣」），'all' 是不限。 */
  county: string;
  rainOk: boolean;
  free: boolean;
  stroller: boolean;
  hideBeen: boolean;
  /** 設施：選了的每一項都要有。 */
  facilities: Facility[];
  types: SpotType[];
  query: string;
}

export interface HotelFilters {
  drive: DriveFilter;
  region: Region | 'all';
  county: string;
  kind: HotelKind | 'all';
  tags: HotelTag[];
  query: string;
}

export const DEFAULT_SPOT_FILTERS: SpotFilters = {
  drive: 'all',
  region: 'all',
  county: 'all',
  rainOk: false,
  free: false,
  stroller: false,
  hideBeen: false,
  facilities: [],
  types: [],
  query: '',
};

export const DEFAULT_HOTEL_FILTERS: HotelFilters = {
  drive: 'all',
  region: 'all',
  county: 'all',
  kind: 'all',
  tags: [],
  query: '',
};

export function matchesDrive(mins: number, drive: DriveFilter): boolean {
  switch (drive) {
    case 'all':
      return true;
    case '30':
      return mins <= 30;
    case '60':
      return mins <= 60;
    case '120':
      return mins <= 120;
    case '240':
      return mins <= 240;
    case 'overnight':
      return mins > 120;
  }
}

/** 「臺東縣臺東市」→「台東縣」；「桃園市中壢區（青埔）」→「桃園市」。抓不到回傳 null。 */
export function countyOf(city: string): string | null {
  return /^(.{2}[縣市])/.exec(city.replace(/臺/g, '台'))?.[1] ?? null;
}

/** 資料裡出現過的縣市與筆數，依最近的車程由近到遠排（車程不明的排後面）。 */
export function listCounties<T extends { id: string; city: string; mins_from_linkou: number }>(
  items: readonly T[],
  minsOf: MinsOf = minsFromLinkou,
): { county: string; count: number }[] {
  const map = new Map<string, { count: number; nearest: number }>();
  for (const item of items) {
    const county = countyOf(item.city);
    if (!county) continue;
    const mins = minsOf(item) ?? Infinity;
    const cur = map.get(county);
    map.set(county, { count: (cur?.count ?? 0) + 1, nearest: Math.min(cur?.nearest ?? Infinity, mins) });
  }
  return [...map.entries()]
    .sort((a, b) => a[1].nearest - b[1].nearest || a[0].localeCompare(b[0]))
    .map(([county, v]) => ({ county, count: v.count }));
}

/** 空白（含全形空白）分隔關鍵字，轉小寫。 */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/) // \s 也包含全形空白
    .filter((t) => t !== '');
}

function matchesAllTokens(haystack: string[], tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const text = haystack.join('\n').toLowerCase();
  return tokens.every((t) => text.includes(t));
}

export function spotSearchText(spot: Spot): string[] {
  return [
    spot.name,
    spot.city,
    spot.tip,
    spot.transit ?? '',
    ...spot.types.map((t) => TYPE_LABELS[t]),
    ...(spot.facilities ?? []).map((f) => FACILITY_LABELS[f]),
  ];
}

export function hotelSearchText(hotel: Hotel): string[] {
  return [hotel.name, hotel.city, hotel.tip, HOTEL_KIND_LABELS[hotel.kind], ...hotel.features, ...hotel.tags.map((t) => HOTEL_TAG_LABELS[t])];
}

export function matchesSpotQuery(spot: Spot, query: string): boolean {
  return matchesAllTokens(spotSearchText(spot), tokenize(query));
}

export function matchesHotelQuery(hotel: Hotel, query: string): boolean {
  return matchesAllTokens(hotelSearchText(hotel), tokenize(query));
}

/** 取得某筆資料的車程分鐘數；算不出來（沒有座標）回傳 null。 */
export type MinsOf = (item: { id: string; mins_from_linkou: number }) => number | null;

/** 預設：從林口出發，用人工粗估的 mins_from_linkou。 */
export const minsFromLinkou: MinsOf = (item) => item.mins_from_linkou;

/** 車程不明時，只有「全部」會顯示。 */
function matchesDriveOrUnknown(mins: number | null, drive: DriveFilter): boolean {
  return mins === null ? drive === 'all' : matchesDrive(mins, drive);
}

export function filterSpots(
  spots: readonly Spot[],
  filters: SpotFilters,
  ctx: { today: string; been: readonly string[]; minsOf?: MinsOf },
): Spot[] {
  const been = new Set(ctx.been);
  const minsOf = ctx.minsOf ?? minsFromLinkou;
  return spots.filter(
    (s) =>
      isSpotVisible(s, ctx.today) &&
      matchesDriveOrUnknown(minsOf(s), filters.drive) &&
      (filters.region === 'all' || s.region === filters.region) &&
      (filters.county === 'all' || countyOf(s.city) === filters.county) &&
      (!filters.rainOk || s.env === 'in' || s.env === 'semi') &&
      (!filters.free || s.cost_tier === 'free') &&
      (!filters.stroller || s.stroller_ok) &&
      (!filters.hideBeen || !been.has(s.id)) &&
      filters.facilities.every((f) => s.facilities?.includes(f)) &&
      (filters.types.length === 0 || s.types.some((t) => filters.types.includes(t))) &&
      matchesSpotQuery(s, filters.query),
  );
}

export function filterHotels(hotels: readonly Hotel[], filters: HotelFilters, minsOf: MinsOf = minsFromLinkou): Hotel[] {
  return hotels.filter(
    (h) =>
      matchesDriveOrUnknown(minsOf(h), filters.drive) &&
      (filters.region === 'all' || h.region === filters.region) &&
      (filters.county === 'all' || countyOf(h.city) === filters.county) &&
      (filters.kind === 'all' || h.kind === filters.kind) &&
      (filters.tags.length === 0 || h.tags.some((t) => filters.tags.includes(t))) &&
      matchesHotelQuery(h, filters.query),
  );
}

/** 依車程由近到遠；車程不明的排最後；一樣近就照 id，結果穩定。不改動原陣列。 */
export function sortByDrive<T extends { id: string; mins_from_linkou: number }>(
  items: readonly T[],
  minsOf: MinsOf = minsFromLinkou,
): T[] {
  const key = (x: T) => minsOf(x) ?? Infinity;
  return [...items].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
}

export function toggleInList<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
