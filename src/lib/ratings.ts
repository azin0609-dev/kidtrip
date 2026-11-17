/** 去過之後的自家評分。純函式。 */
import type { Spot, SpotType } from '../data/schema.ts';

export const RATING_TAGS = ['again', 'kidlove', 'crowded', 'stroller_hard', 'parking_hard'] as const;
export type RatingTag = (typeof RATING_TAGS)[number];

export const RATING_TAG_LABELS: Record<RatingTag, string> = {
  again: '會再來',
  kidlove: '小孩超愛',
  crowded: '人太多',
  stroller_hard: '推車難推',
  parking_hard: '難停車',
};

export interface Rating {
  /** 1–5 顆星 */
  stars: number;
  tags: RatingTag[];
}

export type Ratings = Record<string, Rating>;

/** 解析存下來的評分；格式不對的項目丟掉。 */
export function parseRatings(v: unknown): Ratings | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Ratings = {};
  for (const [id, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const { stars, tags } = raw as { stars?: unknown; tags?: unknown };
    if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) continue;
    const cleanTags = Array.isArray(tags)
      ? [...new Set(tags.filter((t): t is RatingTag => (RATING_TAGS as readonly string[]).includes(t as string)))]
      : [];
    out[id] = { stars, tags: cleanTags };
  }
  return out;
}

/** 設定星數；再點一次同樣的星數就取消評分。 */
export function setStars(ratings: Ratings, id: string, stars: number): Ratings {
  const next = { ...ratings };
  if (next[id]?.stars === stars) delete next[id];
  else next[id] = { stars, tags: next[id]?.tags ?? [] };
  return next;
}

/** 切換標籤；還沒給星數時不能加標籤。 */
export function toggleRatingTag(ratings: Ratings, id: string, tag: RatingTag): Ratings {
  const cur = ratings[id];
  if (!cur) return ratings;
  const tags = cur.tags.includes(tag) ? cur.tags.filter((t) => t !== tag) : [...cur.tags, tag];
  return { ...ratings, [id]: { ...cur, tags } };
}

/**
 * 各類型的喜好分數：把評過分的景點依類型平均，3 顆星是 0，5 顆星是 +2，1 顆星是 −2。
 * 沒評過的類型不在結果裡。
 */
export function typePreference(spots: readonly Spot[], ratings: Ratings): Partial<Record<SpotType, number>> {
  const sum: Partial<Record<SpotType, { total: number; n: number }>> = {};
  for (const spot of spots) {
    const r = ratings[spot.id];
    if (!r) continue;
    for (const t of spot.types) {
      const cur = sum[t] ?? { total: 0, n: 0 };
      sum[t] = { total: cur.total + (r.stars - 3), n: cur.n + 1 };
    }
  }
  const out: Partial<Record<SpotType, number>> = {};
  for (const [t, v] of Object.entries(sum) as [SpotType, { total: number; n: number }][]) out[t] = v.total / v.n;
  return out;
}

/** 一個景點依類型喜好得到的加減分（−2 到 +2）：取它各類型喜好的平均。 */
export function preferenceFor(spot: Pick<Spot, 'types'>, pref: Partial<Record<SpotType, number>>): number {
  const known = spot.types.map((t) => pref[t]).filter((x): x is number => x !== undefined);
  return known.length === 0 ? 0 : known.reduce((a, b) => a + b, 0) / known.length;
}
