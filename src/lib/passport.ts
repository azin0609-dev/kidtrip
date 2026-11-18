/** 放電護照（集章）與年度回顧。純函式。 */
import type { Region, Spot, SpotType } from '../data/schema.ts';
import type { Ratings } from './ratings.ts';

export interface RegionProgress {
  region: Region;
  total: number;
  visited: Spot[];
  /** 這一區全部去過了 */
  complete: boolean;
}

const REGION_ORDER: Region[] = ['北', '中', '南', '東'];

/**
 * 各區的集章進度。已經熄燈的景點如果去過還是算一個章，沒去過就不列入總數
 * （不然永遠集不滿）。
 */
export function passportProgress(
  spots: readonly Spot[],
  been: readonly string[],
  isOpen: (spot: Spot) => boolean,
): RegionProgress[] {
  const beenSet = new Set(been);
  return REGION_ORDER.map((region) => {
    const inRegion = spots.filter((s) => s.region === region);
    const visited = inRegion.filter((s) => beenSet.has(s.id));
    const total = inRegion.filter((s) => beenSet.has(s.id) || isOpen(s)).length;
    return { region, total, visited, complete: total > 0 && visited.length === total };
  });
}

/** 集章稱號：依總共去過幾個地方。 */
export function passportTitle(count: number): string {
  if (count >= 50) return '放電研究員';
  if (count >= 25) return '放電探險家';
  if (count >= 10) return '放電隊長';
  if (count >= 3) return '放電小隊';
  if (count >= 1) return '放電新手';
  return '準備出發';
}

/** 離下一個稱號還差幾個章；已經是最高級回傳 null。 */
export function stampsToNextTitle(count: number): number | null {
  for (const step of [1, 3, 10, 25, 50]) if (count < step) return step - count;
  return null;
}

export interface YearReview {
  year: number;
  /** 這一年有記錄日期的去過次數 */
  count: number;
  /** 去最多的地區 */
  topRegion: Region | null;
  /** 去最多的類型 */
  topType: SpotType | null;
  /** 離家最遠的一次（依 mins） */
  farthest: Spot | null;
  /** 這一年去過的地方的平均星數（有評分的才算），四捨五入到小數 1 位 */
  avgStars: number | null;
  /** 5 顆星的地方 */
  favorites: Spot[];
  /** 每個月去了幾個地方（index 0 = 1 月） */
  byMonth: number[];
}

function topKey<K extends string>(counts: Map<K, number>): K | null {
  let best: K | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** 年度回顧：只算 beenAt 落在那一年的紀錄（舊資料沒有日期的不算）。 */
export function yearReview(
  spots: readonly Spot[],
  beenAt: Readonly<Record<string, string>>,
  ratings: Ratings,
  year: number,
  minsOf: (spot: Spot) => number | null = (s) => s.mins_from_linkou,
): YearReview {
  const prefix = `${year}-`;
  const visited = spots.filter((s) => beenAt[s.id]?.startsWith(prefix));
  const regions = new Map<Region, number>();
  const types = new Map<SpotType, number>();
  const byMonth = Array.from({ length: 12 }, () => 0);
  let farthest: Spot | null = null;
  let farMins = -1;
  for (const s of visited) {
    regions.set(s.region, (regions.get(s.region) ?? 0) + 1);
    for (const t of s.types) types.set(t, (types.get(t) ?? 0) + 1);
    const month = Number(beenAt[s.id]?.slice(5, 7));
    if (month >= 1 && month <= 12) byMonth[month - 1] = (byMonth[month - 1] ?? 0) + 1;
    const mins = minsOf(s) ?? -1;
    if (mins > farMins) {
      farMins = mins;
      farthest = s;
    }
  }
  const stars = visited.map((s) => ratings[s.id]?.stars).filter((x): x is number => x !== undefined);
  return {
    year,
    count: visited.length,
    topRegion: topKey(regions),
    topType: topKey(types),
    farthest,
    avgStars: stars.length === 0 ? null : Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10,
    favorites: visited.filter((s) => ratings[s.id]?.stars === 5),
    byMonth,
  };
}
