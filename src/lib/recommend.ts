/**
 * 這週推薦（PRD 任務 1-5；2026-11-17 依產品檢視改版）。全部是純函式。
 *
 * 先判斷「這次能不能成行」（車程上限、下雨、推車、長輩），再算分數：
 * 車程 35、兩個孩子的適配 35、到場便利 20，其餘是新鮮感與喜好。
 */
import type { Spot, SpotType } from '../data/schema.ts';
import { daysBetween, spotBadges, spotDateStatus } from './date.ts';
import type { MinsOf } from './filter.ts';
import { formatDrive } from './format.ts';
import { freshness } from './freshness.ts';
import { distanceKm } from './geo.ts';
import { ENV_LABELS } from './labels.ts';
import { type Ratings, preferenceFor, typePreference } from './ratings.ts';
import { isRecommendable } from './verification.ts';

/** 8 週內去過的不推（除非評分時點了「會再來」）。 */
export const RECENT_VISIT_DAYS = 56;
/** 當天來回預設單程最多幾分鐘。 */
export const DEFAULT_MAX_DRIVE = 45;
/** 可以選的車程上限（分鐘）。 */
export const MAX_DRIVE_OPTIONS = [30, 45, 60, 120] as const;

export interface KidInfo {
  /** 暱稱；沒填就是空字串 */
  name: string;
  /** 幾歲（可以有小數） */
  age: number;
}

export interface RecommendContext {
  today: string;
  /** 實際出遊日期（YYYY-MM-DD）：用來判斷那天開幕了沒、熄燈了沒；沒給就用 today。 */
  visitDate?: string;
  minsOf: MinsOf;
  fav: readonly string[];
  been: readonly string[];
  /** id → 去過的日期（YYYY-MM-DD）。舊資料可能只有 been 沒有日期。 */
  beenAt: Readonly<Record<string, string>>;
  /** 可能下雨：只推室內（下大雨也行）或半室內（有遮棚、小雨可玩），室內優先。 */
  rainy: boolean;
  /** 這週要住一晚：只推附近有整理好住宿的地方；車程近也可以，只是稍微少一點分。 */
  overnight: boolean;
  /** 那個時段很熱（最高溫 30 度以上）：有冷氣、遮蔭的加分，沒遮蔭的戶外扣分。 */
  hot?: boolean;
  /** 當天來回時單程最多幾分鐘，沒給用 DEFAULT_MAX_DRIVE。住一晚時不看這個。 */
  maxDrive?: number;
  /** 帶推車：只推推車好推的。 */
  needStroller?: boolean;
  /** 孩子的年齡，用來算「兩個孩子都能玩嗎」。 */
  kids?: readonly KidInfo[];
  /** 這個景點附近有沒有整理好的住宿（住一晚時用）。沒給視為都沒有。 */
  hasStay?: (spot: Spot) => boolean;
  /** 自家評分：2 顆星以下不再推；評過高分的類型會多推。 */
  ratings?: Ratings;
  /** 各類型喜好（由 typePreference 算出）；recommend 會自動算。 */
  typePref?: Partial<Record<SpotType, number>>;
  /** 長輩一起去：只推少樓梯、有地方坐的地方。 */
  elders?: boolean;
}

/** 三張推薦卡各自的角色。 */
export type PickRole = 'best' | 'nearest' | 'backup' | 'other';

export const ROLE_LABELS: Record<PickRole, string> = {
  best: '本週首選',
  nearest: '最近最好玩',
  backup: '下雨不掃興',
  other: '再一個選擇',
};

export interface ScoredSpot {
  spot: Spot;
  mins: number;
  score: number;
  reasons: string[];
  role?: PickRole;
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
  /** 車程滿分（20 分鐘內）。 */
  drive: 35,
  /** 孩子適配滿分。 */
  family: 35,
  /** 到場便利滿分。 */
  convenience: 20,
  neverBeen: 6,
  beenUnknownDate: 2,
  /** 去過越久加越多：每週 0.1 分，最多 5。 */
  beenPerWeek: 0.1,
  beenMax: 5,
  /** 8 週內去過但點過「會再來」：可以再推，但扣分。 */
  recentAgain: -12,
  newBadge: 3,
  closingSoon: 8,
  fav: 4,
  ratedHigh: 3,
  /** 類型喜好：每 1 分喜好（−2 到 +2）乘上這個數字。 */
  typePref: 2,
  /** 現在是特別適合的月份加分；有標月份但現在不是，扣一樣的分。 */
  season: 4,
  /** 下雨時，完全室內的比半室內多加的分。 */
  fullIndoorInRain: 8,
  /** 每週隨機加 0–6 分，讓每週組合不一樣，又不會蓋過車程差距。 */
  jitter: 6,
} as const;

/** 車程分數：當天來回 20 分鐘內滿分，之後逐步遞減；住一晚時 1–3 小時最好。 */
export function driveScore(mins: number, overnight = false): number {
  if (overnight) {
    // 住一晚不排除近的，但 45 分內的通常當天來回就好，少一點分。
    if (mins < 45) return WEIGHTS.drive - 8;
    return mins <= 180 ? WEIGHTS.drive : Math.max(15, WEIGHTS.drive - (mins - 180) * 0.1);
  }
  if (mins <= 20) return WEIGHTS.drive;
  if (mins <= 45) return WEIGHTS.drive - (mins - 20) * 0.6; // 45 分 → 20
  return Math.max(5, 20 - (mins - 45) * 0.2); // 120 分 → 5
}

/** 嬰幼兒是「陪同」還是「一起玩」：未滿 2 歲、還不到這裡的適齡範圍，就是陪同（推車跟著，不算年齡分）。 */
export function splitKids(kids: readonly KidInfo[], ageBest: readonly [number, number]): { players: KidInfo[]; companions: KidInfo[] } {
  const [min, max] = ageBest;
  const fits = (age: number) => age >= min && (max >= 12 || age <= max);
  const companions = kids.filter((k) => k.age < 2 && !fits(Math.floor(k.age)));
  const players = kids.filter((k) => !companions.includes(k));
  // 全部都是小嬰兒時，還是用他們來算年齡。
  return players.length > 0 ? { players, companions } : { players: [...kids], companions: [] };
}

/**
 * 孩子適配：主要遊玩的孩子年齡合不合（25）＋有小小孩時推車與換尿布、哺乳方不方便（10）。
 * 陪同的嬰兒不拉低哥哥姊姊的年齡分，只看推車和換尿布。回傳分數和一句原因。
 */
export function familyFit(spot: Spot, kids: readonly KidInfo[] = []): { score: number; reason: string | null } {
  if (kids.length === 0 || !spot.age_best) return { score: 17, reason: null };
  const [min, max] = spot.age_best;
  const { players, companions } = splitKids(kids, spot.age_best);
  let fit = 0;
  for (const k of players) {
    const age = Math.floor(k.age);
    if (age >= min && (max >= 12 || age <= max)) fit += 1;
    else if (age > max) fit += 0.5; // 太大只是比較無聊，還是能去
  }
  const allFit = fit === players.length;
  let score = 25 * (fit / players.length);
  const hasLittle = kids.some((k) => k.age < 3);
  const a = spot.amenities;
  const canChange =
    spot.facilities?.includes('diaper') || spot.facilities?.includes('nursing') || a?.diaper === 'yes' || a?.nursing === 'yes';
  if (hasLittle) score += (spot.stroller_ok ? 5 : 0) + (canChange ? 5 : 0);
  else score += 10;

  let reason: string | null = null;
  if (allFit) {
    const names = players.map((k) => k.name.trim()).filter(Boolean);
    if (players.length === 1) reason = names[0] ? `適合${names[0]}的年紀` : '適合孩子的年紀';
    else reason = names.length === players.length ? `${names.join('、')}都能玩` : '孩子們都能玩';
    if (companions.length > 0 && spot.stroller_ok) {
      const babyNames = companions.map((k) => k.name.trim()).filter(Boolean);
      reason += `，${babyNames.length === companions.length ? babyNames.join('、') : '小寶寶'}坐推車跟著`;
    }
    if (hasLittle && spot.stroller_ok && canChange) reason += '、有地方換尿布';
  }
  return { score, reason };
}

/** 到場便利：好停車、有賣吃的、有遮蔭或室內、推車好推、大眾運輸到得了、確定不用先預約或買票。最多 20。 */
export function convenienceScore(spot: Spot): number {
  const f = spot.facilities ?? [];
  let score = 0;
  if (f.includes('parking')) score += 6;
  if (f.includes('food')) score += 4;
  if (f.includes('shade') || spot.env === 'in') score += 3;
  if (spot.stroller_ok) score += 3;
  if (spot.transit) score += 2;
  // 預約和購票只看結構化資料；沒資料或不知道，不當成不用預約。
  const b = spot.booking;
  if (b && b.reservation === 'no' && b.advance_ticket === 'no' && b.timed_entry !== 'yes') score += 2;
  return Math.min(WEIGHTS.convenience, score);
}

/** 回傳 null 代表這次不推。 */
export function scoreSpot(spot: Spot, ctx: RecommendContext): ScoredSpot | null {
  const status = spotDateStatus(spot, ctx.visitDate ?? ctx.today);
  if (status.closed || status.notYetOpen) return null;
  // 太久沒確認的資料不推薦（可能已經改變）。
  if (freshness(spot, 'spot', ctx.today) === 'expired') return null;
  // 順路停一下的小站（例如主題超商）留在清單裡，但不當成這週的目的地或雨備。
  if (spot.stopover) return null;
  // 外人能不能進去、位置、主要設施、營業狀態有疑問的，先不推（資料保留，等查證）。
  if (!isRecommendable(spot)) return null;

  const myRating = ctx.ratings?.[spot.id];
  if (myRating && myRating.stars <= 2) return null;

  const beenDate = ctx.beenAt[spot.id];
  const isBeen = ctx.been.includes(spot.id);
  const daysSince = isBeen && beenDate ? daysBetween(beenDate, ctx.today) : null;
  const recent = daysSince !== null && daysSince < RECENT_VISIT_DAYS;
  const wantsAgain = !!myRating?.tags.includes('again');
  if (recent && !wantsAgain) return null;

  if (ctx.rainy && spot.env !== 'in' && spot.env !== 'semi') return null;
  if (ctx.elders && !spot.facilities?.includes('elder')) return null;
  if (ctx.needStroller && !spot.stroller_ok) return null;

  const mins = ctx.minsOf(spot);
  if (mins === null) return null;
  if (ctx.overnight) {
    if (!ctx.hasStay?.(spot)) return null;
  } else if (mins > (ctx.maxDrive ?? DEFAULT_MAX_DRIVE)) {
    return null;
  }

  const reasons: string[] = [];
  const d = formatDrive(mins);
  reasons.push(`離家約 ${d.value} ${d.unit}`);
  let score = driveScore(mins, ctx.overnight);

  if (ctx.rainy) {
    if (spot.env === 'in') {
      score += WEIGHTS.fullIndoorInRain;
      reasons.push('室內，下大雨也能玩');
    } else {
      reasons.push('有遮棚，小雨可玩');
    }
  } else {
    reasons.push(ENV_LABELS[spot.env]);
  }

  const fit = familyFit(spot, ctx.kids);
  score += fit.score;
  if (fit.reason) reasons.push(fit.reason);

  score += convenienceScore(spot);

  if (ctx.hot) {
    const heat = heatAdjust(spot);
    score += heat.score;
    if (heat.reason) reasons.push(heat.reason);
  }

  if (!isBeen) {
    score += WEIGHTS.neverBeen;
    reasons.push('還沒去過');
  } else if (daysSince === null) {
    score += WEIGHTS.beenUnknownDate;
    reasons.push('去過，有一陣子了');
  } else if (recent) {
    score += WEIGHTS.recentAgain;
    reasons.push('你們說會再來');
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
  if (ctx.overnight) reasons.push('附近有住宿');

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

/** 天氣熱的時候：確定有冷氣 +6、室內 +3、戶外但有遮蔭 0、戶外沒有遮蔭 −8。 */
export function heatAdjust(spot: Spot): { score: number; reason: string | null } {
  const a = spot.amenities;
  if (a?.aircon === 'yes') return { score: 6, reason: '有冷氣，不怕熱' };
  if (spot.env === 'in') return { score: 3, reason: '室內，不用曬太陽' };
  const shaded = a?.shade === 'yes' || spot.facilities?.includes('shade');
  if (spot.env === 'out' && !shaded) return { score: -8, reason: null };
  return { score: 0, reason: shaded ? '有遮蔭可以休息' : null };
}

// ---------- 組合 ----------

/** 三個（或更少）的類型沒有共同的一項，才算「不全是同一類型」。 */
export function typesAllSame(picks: readonly ScoredSpot[]): boolean {
  if (picks.length < 2) return false;
  const [first, ...rest] = picks;
  return (first?.spot.types ?? []).some((t) => rest.every((p) => p.spot.types.includes(t)));
}

/** 所有符合條件的景點，依分數由高到低。同樣的 seed 一定得到同樣的順序。 */
export function rankCandidates(
  spots: readonly Spot[],
  ctx: RecommendContext,
  seed: string,
  exclude: ReadonlySet<string> = new Set(),
): ScoredSpot[] {
  const random = seededRandom(seed);
  const fullCtx: RecommendContext = ctx.typePref || !ctx.ratings ? ctx : { ...ctx, typePref: typePreference(spots, ctx.ratings) };
  // 依 id 排序後再加隨機分，確保跟資料順序無關。
  return [...spots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => {
      const base = scoreSpot(s, fullCtx);
      const jitter = random() * WEIGHTS.jitter;
      return base ? { ...base, score: base.score + jitter } : null;
    })
    .filter((x): x is ScoredSpot => x !== null && !exclude.has(x.spot.id))
    .sort((a, b) => b.score - a.score || a.spot.id.localeCompare(b.spot.id));
}

/** 「車程最短」只在分數沒有差太多的候選裡找，避免推一個很近但不適合的。 */
const NEAREST_SCORE_WINDOW = 30;

/**
 * 推薦 3 個，各有角色：
 * 1. 最適合這次：分數最高。
 * 2. 車程最短：其餘候選裡車程最短的（要比第一個近才這樣標，否則是「再一個選擇」）。
 * 3. 雨天備案：其餘候選裡分數最高的完全室內景點；已經是下雨模式、或沒有室內的，就是「再一個選擇」。
 * 三個盡量不要全是同一類型。候選不到 3 個就有幾個給幾個，不會為了湊數放寬條件。
 */
export function recommend(
  spots: readonly Spot[],
  ctx: RecommendContext,
  seed: string,
  count = 3,
  /** 不要推薦的 id（「換一組」時排除已經看過的）。 */
  exclude: ReadonlySet<string> = new Set(),
): ScoredSpot[] {
  const scored = rankCandidates(spots, ctx, seed, exclude);
  if (scored.length === 0 || count <= 0) return [];

  const best = scored[0]!;
  const picks: ScoredSpot[] = [{ ...best, role: 'best' }];
  const taken = new Set([best.spot.id]);
  const remaining = () => scored.filter((s) => !taken.has(s.spot.id));

  if (count >= 2) {
    const pool = remaining().filter((s) => s.score >= best.score - NEAREST_SCORE_WINDOW);
    const nearest = [...pool].sort((a, b) => a.mins - b.mins || b.score - a.score)[0] ?? remaining()[0];
    if (nearest) {
      picks.push({ ...nearest, role: nearest.mins < best.mins ? 'nearest' : 'other' });
      taken.add(nearest.spot.id);
    }
  }

  if (count >= 3) {
    const rest = remaining();
    const indoor = ctx.rainy ? undefined : rest.find((s) => s.spot.env === 'in');
    const breaksSameness = (s: ScoredSpot) => !typesAllSame([...picks, s]);
    const third = indoor ?? rest.find(breaksSameness) ?? rest[0];
    if (third) {
      picks.push({ ...third, role: indoor ? 'backup' : 'other' });
      taken.add(third.spot.id);
    }
  }

  // 三個全是同一類型時，把中間那個換成不同類型的（換得到才換）。
  if (picks.length === 3 && typesAllSame(picks)) {
    const swap = remaining().find((s) => !typesAllSame([picks[0]!, s, picks[2]!]));
    if (swap) picks[1] = { ...swap, role: swap.mins < best.mins ? 'nearest' : 'other' };
  }

  return picks.slice(0, count);
}

export interface RoundResult {
  picks: ScoredSpot[];
  /**
   * ok：正常的一組；last：新的只剩這幾個（不到一組）；
   * restarted：符合條件的都看過了，這一組是從頭再來的。
   */
  status: 'ok' | 'last' | 'restarted';
}

/**
 * 第 round 組推薦（0 是這週的第一組，按一次「換一組」加 1）。
 * 每一組都排除前面出現過的景點；新的不夠一組時先把剩下的給出來（last），
 * 再按一次才從頭再來（restarted）。同樣的輸入一定得到同樣的結果。
 */
export function recommendRound(
  spots: readonly Spot[],
  ctx: RecommendContext,
  seedFor: (round: number) => string,
  round: number,
  count = 3,
): RoundResult {
  let seen = new Set<string>();
  let result: RoundResult = { picks: [], status: 'ok' };
  for (let i = 0; i <= Math.min(round, 200); i++) {
    let picks = recommend(spots, ctx, seedFor(i), count, seen);
    let status: RoundResult['status'] = 'ok';
    if (picks.length === 0 && seen.size > 0) {
      seen = new Set();
      picks = recommend(spots, ctx, seedFor(i), count, seen);
      status = 'restarted';
    } else if (picks.length < count && seen.size > 0) {
      status = 'last';
    }
    for (const r of picks) seen.add(r.spot.id);
    result = { picks, status };
  }
  return result;
}

/** 住一晚時，雨天備案要在主景點附近（直線 30 公里內）。 */
export const OVERNIGHT_BACKUP_KM = 30;

/**
 * 幫選好的主行程挑一個雨天備案：完全室內的景點（不看「可能下雨」開關）。
 * 當天來回：從家裡出發、分數最高的。住一晚：離主景點最近的（人已經在那裡，不用再開回家附近）。找不到回傳 null。
 */
export function pickBackup(spots: readonly Spot[], ctx: RecommendContext, seed: string, mainId: string): ScoredSpot | null {
  const main = spots.find((s) => s.id === mainId);
  if (ctx.overnight && main && main.lat !== null && main.lng !== null) {
    const here = { lat: main.lat, lng: main.lng };
    const near = rankCandidates(spots, { ...ctx, rainy: false, overnight: false, maxDrive: Number.POSITIVE_INFINITY }, seed, new Set([mainId]))
      .filter((s) => s.spot.env === 'in' && s.spot.lat !== null && s.spot.lng !== null)
      .map((s) => ({ s, km: distanceKm(here, { lat: s.spot.lat!, lng: s.spot.lng! }) }))
      .filter((x) => x.km <= OVERNIGHT_BACKUP_KM)
      .sort((a, b) => a.km - b.km || b.s.score - a.s.score);
    return near[0]?.s ?? null;
  }
  const ranked = rankCandidates(spots, { ...ctx, rainy: false, overnight: false }, seed, new Set([mainId]));
  return ranked.find((s) => s.spot.env === 'in') ?? null;
}
