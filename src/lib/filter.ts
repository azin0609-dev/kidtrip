import type { Hotel, HotelTag, Region, Spot, SpotType } from '../data/schema.ts';
import { isSpotVisible } from './date.ts';
import { HOTEL_TAG_LABELS, TYPE_LABELS } from './labels.ts';

export type DriveFilter = 'all' | '30' | '60' | '120' | 'overnight';

export const DRIVE_OPTIONS: { value: DriveFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '30', label: '30 分內' },
  { value: '60', label: '1 小時內' },
  { value: '120', label: '2 小時內' },
  { value: 'overnight', label: '要住一晚' },
];

export interface SpotFilters {
  drive: DriveFilter;
  region: Region | 'all';
  rainOk: boolean;
  free: boolean;
  stroller: boolean;
  hideBeen: boolean;
  types: SpotType[];
  query: string;
}

export interface HotelFilters {
  drive: DriveFilter;
  region: Region | 'all';
  tags: HotelTag[];
  query: string;
}

export const DEFAULT_SPOT_FILTERS: SpotFilters = {
  drive: 'all',
  region: 'all',
  rainOk: false,
  free: false,
  stroller: false,
  hideBeen: false,
  types: [],
  query: '',
};

export const DEFAULT_HOTEL_FILTERS: HotelFilters = {
  drive: 'all',
  region: 'all',
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
    case 'overnight':
      return mins > 120;
  }
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
  return [spot.name, spot.city, spot.tip, ...spot.types.map((t) => TYPE_LABELS[t])];
}

export function hotelSearchText(hotel: Hotel): string[] {
  return [hotel.name, hotel.city, hotel.tip, ...hotel.features, ...hotel.tags.map((t) => HOTEL_TAG_LABELS[t])];
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
      (!filters.rainOk || s.env === 'in' || s.env === 'semi') &&
      (!filters.free || s.cost_tier === 'free') &&
      (!filters.stroller || s.stroller_ok) &&
      (!filters.hideBeen || !been.has(s.id)) &&
      (filters.types.length === 0 || s.types.some((t) => filters.types.includes(t))) &&
      matchesSpotQuery(s, filters.query),
  );
}

export function filterHotels(hotels: readonly Hotel[], filters: HotelFilters, minsOf: MinsOf = minsFromLinkou): Hotel[] {
  return hotels.filter(
    (h) =>
      matchesDriveOrUnknown(minsOf(h), filters.drive) &&
      (filters.region === 'all' || h.region === filters.region) &&
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
