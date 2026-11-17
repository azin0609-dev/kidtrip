/** 這週推薦 3 個（PRD 任務 1-5）。全部是純函式。 */
import type { Spot } from '../data/schema.ts';
import { daysBetween, spotBadges, spotDateStatus } from './date.ts';
import type { MinsOf } from './filter.ts';
import { formatDrive } from './format.ts';
import { ENV_LABELS } from './labels.ts';
import { type Ratings, preferenceFor, typePreference } from './ratings.ts';
import type { SpotType } from '../data/schema.ts';

/** 8 週內去過的不推。 */
export const RECENT_VISIT_DAYS = 56;

export interface RecommendContext {
  today: string;
  minsOf: MinsOf;
  fav: readonly string[];
  been: readonly string[];
  /** id → 去過的日期（YYYY-MM-DD）。舊資料可能只有 been 沒有日期。 */
  beenAt: Readonly<Record<string, string>>;
  /** 「這週可能下雨」：只推 env 為 in 或 semi。 */
  rainy: boolean;
  /** 「這週要住一晚」：才會推超過 120 分的。 */
  overnight: boolean;
  /** 自家評分：2 顆星以下不再推；評過高分的類型會多推。沒給視為沒有評分。 */
  ratings?: Ratings;
  /** 各類型喜好（由 typePreference 算出）；recommend 會自動算，單獨呼叫 scoreSpot 時可以不給。 */
  typePref?: Partial<Record<SpotType, number>>;
  /** 「長輩一起去」：只推少樓梯、有地方坐的地方。沒給視為 false。 */
  elders?: boolean;
}

export interface ScoredSpot {
  spot: Spot;
  mins: number;
  score: number;
  reasons: string[];
}

// ---------- 亂數 ----------

/** ISO 8601 週數，例如 2026-11-16 → 「2026-W47」。 */
export function isoWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // 週一 = 1 … 週日 = 7
  date.setUTCDate(date.getUTCDate() + 4 - day); // 移到同週的週四
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** 亂數種子：ISO 週數＋出發地（座標取到小數 3 位，約 100 公尺）＋「換一組」次數。 */
export function weekSeed(today: string, origin: { lat: number; lng: number }, offset = 0): string {
  return `${isoWeek(today)}|${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${offset}`;
}

/** 字串 → 32 位元雜湊（FNV-1a）。 */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 可重現的亂數（mulberry32），回傳 0–1。 */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 評分 ----------

export const WEIGHTS = {
  driveNear: 40, // 60 分內
  driveMid: 20, // 60–120 分
  driveFar: 10, // 超過 120 分（只在要住一晚時）
  neverBeen: 25,
  beenUnknownDate: 10,
  /** 去過越久加越多：每週 0.4 分，最多 20。 */
  beenPerWeek: 0.4,
  beenMax: 20,
  newBadge: 10,
  closingSoon: 20,
  fav: 15,
  /** 現在是特別適合的月份加分；有標月份但現在不是，扣一樣的分。 */
  season: 8,
  /** 自己給 4 顆星以上。 */
  ratedHigh: 6,
  /** 類型喜好：每 1 分喜好（−2 到 +2）乘上這個數字。 */
  typePref: 4,
  /** 每週隨機加 0–15 分，讓每週組合不一樣。 */
  jitter: 15,
} as const;

/** 回傳 null 代表這週不推。 */
export function scoreSpot(spot: Spot, ctx: RecommendContext): ScoredSpot | null {
  const status = spotDateStatus(spot, ctx.today);
  if (status.closed || status.notYetOpen) return null;

  const beenDate = ctx.beenAt[spot.id];
  const isBeen = ctx.been.includes(spot.id);
  const daysSince = isBeen && beenDate ? daysBetween(beenDate, ctx.today) : null;
  if (daysSince !== null && daysSince < RECENT_VISIT_DAYS) return null;

  if (ctx.rainy && spot.env !== 'in' && spot.env !== 'semi') return null;
  if (ctx.elders && !spot.facilities?.includes('elder')) return null;

  const myRating = ctx.ratings?.[spot.id];
  if (myRating && myRating.stars <= 2) return null;

  const mins = ctx.minsOf(spot);
  if (mins === null) return null;
  if (mins > 120 && !ctx.overnight) return null;

  let score = 0;
  const reasons: string[] = [];
  const d = formatDrive(mins);
  reasons.push(`離家約 ${d.value} ${d.unit}`);
  score += mins <= 60 ? WEIGHTS.driveNear : mins <= 120 ? WEIGHTS.driveMid : WEIGHTS.driveFar;

  reasons.push(ENV_LABELS[spot.env]);

  if (!isBeen) {
    score += WEIGHTS.neverBeen;
    reasons.push('還沒去過');
  } else if (daysSince === null) {
    score += WEIGHTS.beenUnknownDate;
    reasons.push('去過，有一陣子了');
  } else {
    const weeks = Math.floor(daysSince / 7);
    score += Math.min(WEIGHTS.beenMax, weeks * WEIGHTS.beenPerWeek);
    reasons.push(`上次去是 ${weeks} 週前`);
  }

  for (const b of spotBadges(spot, ctx.today)) {
    if (b.kind === 'end' && status.closingSoon) {
      score += WEIGHTS.closingSoon;
      reasons.push(`${b.label}，最後機會`);
    } else if (b.kind === 'new') {
      score += WEIGHTS.newBadge;
      reasons.push(b.label);
    }
  }

  if (spot.best_months && spot.best_months.length > 0) {
    const month = Number(ctx.today.slice(5, 7));
    if (spot.best_months.includes(month)) {
      score += WEIGHTS.season;
      reasons.push('這個季節正適合');
    } else {
      score -= WEIGHTS.season;
    }
  }

  if (ctx.elders) reasons.push('長輩好走');

  if (myRating && myRating.stars >= 4) {
    score += WEIGHTS.ratedHigh;
    reasons.push(`你們給過 ${myRating.stars} 顆星`);
  }
  if (ctx.typePref) {
    const pref = preferenceFor(spot, ctx.typePref);
    score += pref * WEIGHTS.typePref;
    if (pref >= 1 && !myRating) reasons.push('你們喜歡這一類');
  }

  if (ctx.fav.includes(spot.id)) {
    score += WEIGHTS.fav;
    reasons.push('收藏過');
  }

  return { spot, mins, score, reasons };
}

// ---------- 組合 ----------

/** 三個（或更少）的類型沒有共同的一項，才算「不全是同一類型」。 */
export function typesAllSame(picks: readonly ScoredSpot[]): boolean {
  if (picks.length < 2) return false;
  const [first, ...rest] = picks;
  return (first?.spot.types ?? []).some((t) => rest.every((p) => p.spot.types.includes(t)));
}

function hasNear(picks: readonly ScoredSpot[]): boolean {
  return picks.some((p) => p.mins <= 60);
}

function bestCombo(pool: readonly ScoredSpot[], size: number, valid: (c: ScoredSpot[]) => boolean): ScoredSpot[] | null {
  let best: ScoredSpot[] | null = null;
  let bestScore = -Infinity;
  const n = pool.length;
  const pick: ScoredSpot[] = [];
  const walk = (start: number) => {
    if (pick.length === size) {
      const total = pick.reduce((s, p) => s + p.score, 0);
      if (total > bestScore && valid(pick)) {
        bestScore = total;
        best = [...pick];
      }
      return;
    }
    for (let i = start; i <= n - (size - pick.length); i++) {
      pick.push(pool[i]!);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return best;
}

/**
 * 推薦 3 個：分數最高、而且
 * - 三個不全是同一類型
 * - 至少一個在 60 分內
 * 條件滿足不了時依序放寬（先放寬類型，再放寬 60 分），候選不到 3 個就有幾個給幾個。
 * 同樣的 seed 一定得到同樣的結果。
 */
export function recommend(
  spots: readonly Spot[],
  ctx: RecommendContext,
  seed: string,
  count = 3,
  /** 不要推薦的 id（「換一組」時排除已經看過的）。 */
  exclude: ReadonlySet<string> = new Set(),
): ScoredSpot[] {
  const random = seededRandom(seed);
  const fullCtx: RecommendContext = ctx.typePref || !ctx.ratings ? ctx : { ...ctx, typePref: typePreference(spots, ctx.ratings) };
  // 依 id 排序後再加隨機分，確保跟資料順序無關。
  const scored = [...spots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      const base = scoreSpot(s, fullCtx);
      const jitter = random() * WEIGHTS.jitter;
      return base ? { ...base, score: base.score + jitter } : null;
    })
    .filter((x): x is ScoredSpot => x !== null && !exclude.has(x.spot.id))
    .sort((a, b) => b.score - a.score || a.spot.id.localeCompare(b.spot.id));

  const size = Math.min(count, scored.length);
  if (size === 0) return [];

  // 先在前 15 名裡找，找不到再擴大到全部。
  const pools = scored.length > 15 ? [scored.slice(0, 15), scored] : [scored];
  const rules: ((c: ScoredSpot[]) => boolean)[] = [
    (c) => !typesAllSame(c) && hasNear(c),
    (c) => hasNear(c),
    () => true,
  ];
  for (const rule of rules) {
    for (const pool of pools) {
      const combo = bestCombo(pool, size, rule);
      if (combo) return combo.sort((a, b) => b.score - a.score);
    }
  }
  return scored.slice(0, size);
}

/**
 * 第 round 組推薦（0 是這週的第一組，按一次「換一組」加 1）。
 * 每一組都排除前面幾組出現過的景點，所以按「換一組」一定會換到新的；
 * 全部看完（剩下不到 count 個）就從頭再來。同樣的輸入一定得到同樣的結果。
 */
export function recommendRound(
  spots: readonly Spot[],
  ctx: RecommendContext,
  seedFor: (round: number) => string,
  round: number,
  count = 3,
): ScoredSpot[] {
  let seen = new Set<string>();
  let result: ScoredSpot[] = [];
  for (let i = 0; i <= Math.min(round, 200); i++) {
    result = recommend(spots, ctx, seedFor(i), count, seen);
    if (result.length < count && seen.size > 0) {
      seen = new Set();
      result = recommend(spots, ctx, seedFor(i), count, seen);
    }
    for (const r of result) seen.add(r.spot.id);
  }
  return result;
}
