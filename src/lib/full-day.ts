/**
 * 全日放電計畫。全部是純函式。
 *
 * - 模式 A「親子輕鬆玩」：一個主要景點＋午餐＋午睡或休息＋下午再玩一下或回家。
 * - 模式 B「親子探索日」：上午景點 A＋午餐＋下午景點 B＋回家。排不出合理的雙景點，就明說並改給單景點方案，不硬湊。
 *
 * 規則：
 * - 挑景點沿用 familyCandidates（休館、高風險、低分、最近去過、推車、車程上限、年齡、完全室內都照半日遊的規則）。
 *   雨天完全室內時，兩個景點都要是 env === 'in'。
 * - 兩個景點之間的車程，用兩地座標估算（直線距離 × 道路係數），標示「粗估」；
 *   任一邊沒有精確座標（只有鄉鎮中心點）就算「無法確認」，不排雙景點，不拿各自從家裡出發的車程代替。
 * - 有 3 歲以下的孩子或有午睡設定時，預設要排午睡；選「不睡」會提醒，不會自動假設可以整天不睡。
 * - 營業時間只用 open_note 讀得到的部分避開開門前、關門後，並寫明查證過沒有；資料寫那天休息就不排。
 * - 餐廳一律只當「參考」，資料不足不能當成已確認可用。
 */
import type { Restaurant, Spot } from '../data/schema.ts';
import {
  type EnvMode,
  FAMILY_DRIVE_OPTIONS,
  type FamilyPlanStep,
  type WeekendHours,
  ageNote,
  departureChecks,
  facilityNotes,
  familyCandidates,
  hoursNote,
  minPlay,
  spotProblems,
  validateSteps,
  weekendHours,
} from './family-plan.ts';
import { formatDrive } from './format.ts';
import { estimateDriveMins, isEastLabel } from './geo.ts';
import { ARRIVE_BUFFER, type Nap, formatClock, toMins } from './plan.ts';
import type { RecommendContext, ScoredSpot } from './recommend.ts';
import { type Verification, canClaimOpen, isRecommendable, verificationOf } from './verification.ts';
import { type Slot, isSlot, slotDate, slotLabelWithDate } from './weather.ts';
import type { WeekPlan } from './weekplan.ts';

// ---------- 型別 ----------

export type DayStyle = 'easy' | 'explore';
/** stroller：在景點推車上睡；car：移動時在車上睡；none：不睡（有 3 歲以下會提醒）。 */
export type DayNapMode = 'stroller' | 'car' | 'none';
/** packed：自備午餐；nearby：在景點附近找（餐廳只當參考）。 */
export type LunchMode = 'packed' | 'nearby';

export interface FullDayOptions {
  day: 'sat' | 'sun';
  /** 上午幾點出門（分鐘） */
  departAt: number;
  /** 最晚幾點到家（分鐘） */
  latestHome: number;
  style: DayStyle;
  napMode: DayNapMode;
  lunch: LunchMode;
  envMode: EnvMode;
  maxDrive: number;
  stroller: boolean;
}

export const DEPART_OPTIONS = [8 * 60 + 30, 9 * 60, 9 * 60 + 30, 10 * 60] as const;
export const LATEST_HOME_OPTIONS = [17 * 60, 18 * 60, 19 * 60] as const;
/** 在外面吃午餐（含找位子、排隊）。 */
export const OUT_LUNCH_MINS = 45;
/** 不睡午覺時，午餐後休息一下。 */
export const AFTER_LUNCH_REST = 15;
/** 午睡起來，至少要能再玩 30 分鐘才排下午活動，不然就直接回家。 */
export const MIN_AFTERNOON = 30;
/** 不睡午覺時，最早 11:30 吃午餐。 */
export const EARLIEST_LUNCH = 11 * 60 + 30;
/** 兩個景點之間最多開多久（分鐘，粗估）；太遠就不排成同一天。 */
export const MAX_TRANSFER = 40;
/** 車上睡至少要開這麼久，才算睡得到。 */
export const MIN_CAR_NAP = 30;
/** 下午（午睡起來或第二個景點）最多玩多久，避免排成一整天待不住。 */
export const MAX_AFTERNOON = 120;

/** 下午還可以玩多久：最多 2 小時；景點有建議停留時間的話，一整天合計不超過建議停留＋1 小時。 */
export function afternoonCap(spot: Pick<Spot, 'stay_hours'>, morningMins: number): number {
  const total = spot.stay_hours ? spot.stay_hours * 60 + 60 : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(MAX_AFTERNOON, total - morningMins));
}

/**
 * 午餐在哪裡吃：
 * - inside：景點裡面（資料標示有賣吃的；自備則是標示可帶便當）。資料還沒逐項查證。
 * - outside：要出場到附近吃（有整理過的附近餐廳，但沒有距離資料）。
 * - unknown：不知道在哪裡吃。
 */
export type LunchWhere = 'inside' | 'outside' | 'unknown';

export function lunchWhere(spot: Spot, mode: LunchMode, restaurants: readonly Restaurant[]): LunchWhere {
  const f = spot.facilities ?? [];
  if (mode === 'packed') return f.includes('picnic') ? 'inside' : 'unknown';
  if (f.includes('food')) return 'inside';
  return restaurants.some((r) => r.near_spot_ids.includes(spot.id) && isRecommendable(r)) ? 'outside' : 'unknown';
}

/** 出場吃飯的移動緩衝（單程，分鐘）。沒有距離資料，這是保守預留的時間，不是實際距離。 */
export const LUNCH_MOVE = { outside: 15, unknown: 20 } as const;

/** 出場吃飯再回來，要先問能不能重新入場：要門票或費用不明的地方。 */
export function needsReentryCheck(spot: Spot): boolean {
  return spot.cost_tier !== 'free';
}

interface LunchArgs {
  spot: Spot;
  playStart: number;
  /** 照原本安排幾點吃（場內吃就這時候開始吃；出場吃就這時候離場） */
  lunchStart: number;
  close: number;
  mode: LunchMode;
  where: LunchWhere;
  /** 吃完要回到這個景點（下午再玩、推車上睡） */
  wantReturn: boolean;
  /** 場內吃：景點要開到幾點，才不會把午餐、休息排在關門後 */
  stayUntil: number;
  /** 這一段（含休息、回到景點）最晚幾點結束，例如午睡開始時間 */
  doneBy?: number;
  /** 吃完在原地休息幾分鐘 */
  restMins?: number;
}

interface LunchPart {
  steps: FamilyPlanStep[];
  playEnd: number;
  lunchEnd: number;
  /** 這一段結束的時間（吃完、休息完，要回去的話是回到景點的時間） */
  doneAt: number;
  /** 這一段結束時人在景點裡（場內吃，或出場吃完回來了） */
  atVenue: boolean;
  /** 因為關門被迫離場、不能再回去 */
  closedOut: boolean;
  /** 出場吃再回來，要先確認能不能重新入場 */
  reentry: boolean;
  /** 出場吃飯的單程移動緩衝；場內吃是 0 */
  move: number;
  /** 午餐地點不確定 */
  unsure: boolean;
}

/**
 * 上午玩＋午餐。
 * 場內吃（資料標示有賣吃的／可帶便當）而且不會吃到關門後：照原本時間在裡面吃。
 * 其他情況（出場吃、地點不知道、景點午餐前後就關門）：預留離場、移動的時間；要回來的話也預留回程，
 * 要門票的地方標示「能不能重新入場要先問」。不會把午餐、休息排在關門後的景點裡。
 */
function lunchPart(a: LunchArgs): LunchPart {
  const { spot, playStart, close, mode } = a;
  const rest = a.restMins ?? 0;
  const restStep = (start: number, label: string): FamilyPlanStep[] => (rest > 0 ? [{ kind: 'rest', start, end: start + rest, label }] : []);

  if (a.where === 'inside' && close >= a.stayUntil) {
    const lunchStart = a.doneBy !== undefined ? Math.min(a.lunchStart, a.doneBy - OUT_LUNCH_MINS - rest) : a.lunchStart;
    const end = lunchStart + OUT_LUNCH_MINS;
    return {
      steps: [
        { kind: 'play', start: playStart, end: lunchStart, label: `在${spot.name}玩 ${lunchStart - playStart} 分鐘` },
        {
          kind: 'lunch',
          start: lunchStart,
          end,
          label:
            mode === 'packed'
              ? `在${spot.name}吃自備的午餐（資料標示可帶便當，還沒查證；座位要先確認）`
              : `在${spot.name}裡面吃午餐（資料標示有賣吃的，還沒查證；營業時間、座位要確認）`,
        },
        ...restStep(end, '休息一下、上廁所、換尿布'),
      ],
      playEnd: lunchStart,
      lunchEnd: end,
      doneAt: end + rest,
      atVenue: true,
      closedOut: false,
      reentry: false,
      move: 0,
      unsure: false,
    };
  }

  // 出場吃。場內吃但會吃到關門後的，也改成關門前出場（這時吃飯地點不知道）。
  const forced = a.where === 'inside';
  const place = a.where === 'outside' ? 'outside' : 'unknown';
  const move = LUNCH_MOVE[place];
  const latest = (ret: boolean) => (a.doneBy !== undefined ? a.doneBy - (ret ? move : 0) - rest - OUT_LUNCH_MINS - move : Number.POSITIVE_INFINITY);
  let ret = a.wantReturn && !forced;
  let playEnd = Math.min(a.lunchStart, latest(ret), close);
  // 回來的時候已經關門：不回去。
  if (ret && close < playEnd + move + OUT_LUNCH_MINS + rest + move) {
    ret = false;
    playEnd = Math.min(a.lunchStart, latest(false), close);
  }
  const closedOut = forced || (a.wantReturn && !ret) || close < a.lunchStart;
  const lunchStart = playEnd + move;
  const lunchEnd = lunchStart + OUT_LUNCH_MINS;
  const restEnd = lunchEnd + rest;
  const reentry = ret && needsReentryCheck(spot);
  const outLabel = closedOut
    ? `關門前離場，移動到吃飯的地方（地點要自己確認，先預留 ${move} 分）`
    : place === 'outside'
      ? `離場，到附近吃飯（距離沒有資料，先預留 ${move} 分）`
      : `離場，找地方吃飯（地點還沒確認，先預留 ${move} 分）`;
  const lunchLabel =
    mode === 'packed'
      ? '找地方吃自備的午餐（公園、車上等，地點要自己確認）'
      : place === 'outside'
        ? `在${spot.name}附近吃午餐（參考下面的餐廳；營業時間、座位要自己確認）`
        : '在附近找地方吃午餐（地點、營業時間要自己確認）';
  const steps: FamilyPlanStep[] = [
    { kind: 'play', start: playStart, end: playEnd, label: `在${spot.name}玩 ${playEnd - playStart} 分鐘${playEnd === close ? `（資料寫 ${clock(close)} 關門）` : ''}` },
    { kind: 'transfer', start: playEnd, end: lunchStart, label: outLabel },
    { kind: 'lunch', start: lunchStart, end: lunchEnd, label: lunchLabel },
    ...restStep(lunchEnd, '在吃飯的地方休息一下、上廁所、換尿布'),
  ];
  if (ret) {
    steps.push({
      kind: 'transfer',
      start: restEnd,
      end: restEnd + move,
      label: `回到${spot.name}${reentry ? '、重新入場（能不能出場再進來要先問）' : ''}（先預留 ${move} 分）`,
    });
  }
  return { steps, playEnd, lunchEnd, doneAt: ret ? restEnd + move : restEnd, atVenue: ret, closedOut, reentry, move, unsure: place === 'unknown' };
}

/** 午餐這一段要放進「待確認」或備註的事。 */
function lunchFlags(part: LunchPart, spot: Spot, draft: string[], notes: string[]): void {
  if (part.unsure) draft.push(`${spot.name}：午餐地點還沒確認，離場、移動先各抓 ${part.move} 分。`);
  else if (part.move > 0) notes.push(`${spot.name}附近餐廳的距離沒有資料，移動時間先各抓 ${part.move} 分。`);
  if (part.reentry) draft.push(`${spot.name}要門票（或費用不明）：出場吃飯後能不能再進來，要先問。`);
}

/** 最多拿前幾名的景點配對。 */
const PAIR_POOL = 10;

export interface LunchRef {
  name: string;
  /** 永遠不是「已確認可用」：checked-open 代表查過還在營業，但當天營業時間、座位還沒確認 */
  status: 'checked-open' | 'unconfirmed';
  note: string;
}

export interface LunchInfo {
  mode: LunchMode;
  /** 場內、場外或不知道（見 lunchWhere） */
  where: LunchWhere;
  /** 在哪個景點附近吃 */
  near: string;
  text: string;
  refs: LunchRef[];
}

export interface SpotInfo {
  spot: Spot;
  facilities: string[];
  checks: string[];
  ageNote: string | null;
  verification: Verification;
}

export type FullDayOk = {
  status: 'ok';
  style: DayStyle;
  spots: SpotInfo[];
  steps: FamilyPlanStep[];
  /** 家裡到第一個景點（分鐘，粗估） */
  toFirst: number;
  /** 最後一個景點回家（分鐘，粗估） */
  backHome: number;
  /** 兩個景點之間（分鐘，粗估）；單景點是 null */
  transfer: number | null;
  leaveHome: number;
  homeAt: number;
  notes: string[];
  lunch: LunchInfo;
  /** 提前結束（午睡時就回家、關門太早、下午時間不夠）：沒有排到傍晚 */
  endsEarly: boolean;
  /** 提前結束的原因（給畫面顯示） */
  earlyReason: string | null;
  /** 待確認草案：午餐地點不確定、出場後能不能重新入場還不知道 */
  draft: boolean;
  draftReasons: string[];
};

export type FullDayFail = { status: 'fail'; reason: string };

export interface FullDayPlans {
  /** 符合硬性條件的景點 */
  candidates: ScoredSpot[];
  /** 排得出來的方案（雙景點優先；排不出雙景點時是單景點） */
  plans: FullDayOk[];
  /** 想要雙景點但排不出來時的原因（這時 plans 是單景點方案） */
  fallbackReason: string | null;
  /** 全部排不出來時的原因 */
  failReason: string | null;
  /** 有 3 歲以下又選了不睡的提醒 */
  napWarning: string | null;
}

const clock = formatClock;
const dl = (m: number) => `${formatDrive(m).value} ${formatDrive(m).unit}`;

// ---------- 景點間車程 ----------

/** 兩個景點之間的車程（粗估）。任一邊沒有精確座標（只知道鄉鎮）就回傳 null（無法確認）。 */
export function transferMins(a: Spot, b: Spot): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  if (a.coord_area || b.coord_area) return null;
  const cross = isEastLabel(a.city) !== isEastLabel(b.city);
  return estimateDriveMins({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, cross);
}

// ---------- 午餐 ----------

/** 附近吃飯的參考：只列整理過、沒有疑問的餐廳，而且一律不算「已確認可用」。 */
export function lunchInfo(spot: Spot, mode: LunchMode, restaurants: readonly Restaurant[]): LunchInfo {
  const where = lunchWhere(spot, mode, restaurants);
  if (mode === 'packed') {
    const picnic = spot.facilities?.includes('picnic');
    return {
      mode,
      where,
      near: spot.name,
      text: picnic ? '自備午餐：資料標示可以帶便當（還沒逐項查證），找可以坐的地方吃。' : '自備午餐：能不能帶外食、有沒有座位要先確認。',
      refs: [],
    };
  }
  const refs: LunchRef[] = restaurants
    .filter((r) => r.near_spot_ids.includes(spot.id) && isRecommendable(r))
    .slice(0, 3)
    .map((r) => ({
      name: r.name,
      status: canClaimOpen(r) ? 'checked-open' : 'unconfirmed',
      note: canClaimOpen(r)
        ? `${r.verified!.date} 查過還在營業；當天營業時間、座位、兒童椅還要確認`
        : '營業狀態、營業時間、座位都還沒確認',
    }));
  const inside = where === 'inside' ? `資料標示${spot.name}裡面有賣吃的（還沒查證，營業時間、座位要確認）。` : '';
  return {
    mode,
    where,
    near: spot.name,
    text:
      refs.length > 0
        ? `${inside}在${spot.name}附近吃。下面的餐廳只是參考，都還沒確認當天可以用，距離也沒有資料。`
        : inside
          ? `${inside}附近沒有整理好的餐廳，裡面的吃的不適合的話要自己找，或改成自備。`
          : `在${spot.name}附近找吃的：這裡附近沒有整理好的餐廳，要自己找，或改成自備。`,
    refs,
  };
}

// ---------- 排時間 ----------

interface Ctx {
  minsOf: RecommendContext['minsOf'];
  kids: RecommendContext['kids'];
  today: string;
  nap: Nap;
  restaurants: readonly Restaurant[];
  nowMins?: number;
}

function hoursFor(spot: Spot, day: 'sat' | 'sun'): WeekendHours {
  return weekendHours(spot.open_note, day);
}

function spotInfo(spot: Spot, ctx: Ctx): SpotInfo {
  return { spot, facilities: facilityNotes(spot), checks: departureChecks(spot), ageNote: ageNote(spot, ctx.kids ?? []), verification: verificationOf(spot) };
}

function napTimes(nap: Nap): { start: number; end: number } | null {
  const start = toMins(nap.start);
  const end = toMins(nap.end);
  return start === null || end === null || end <= start ? null : { start, end };
}

function finish(
  base: Omit<FullDayOk, 'status' | 'spots' | 'lunch' | 'endsEarly' | 'earlyReason' | 'draft' | 'draftReasons'> & { earlyReason?: string | null; draftReasons?: string[] },
  spots: Spot[],
  lunchSpot: Spot,
  opts: FullDayOptions,
  ctx: Ctx,
): FullDayOk | FullDayFail {
  if (!validateSteps(base.steps)) return { status: 'fail', reason: '這個條件排不出合理的時間，建議更改條件。' };
  if (base.homeAt > opts.latestHome) return { status: 'fail', reason: `會在 ${clock(base.homeAt)} 才到家，比設定的 ${clock(opts.latestHome)} 晚。` };
  const date = slotDate(ctx.today, `${opts.day}-am`);
  if (ctx.nowMins !== undefined && date === ctx.today && ctx.nowMins > base.leaveHome) {
    return { status: 'fail', reason: `今天建議 ${clock(base.leaveHome)} 出門，已經過了。` };
  }
  const notes = [...base.notes];
  const earlyReason = base.earlyReason ?? null;
  // 提前結束的原因也放進備註，分享文字和舊的顯示方式都看得到。
  if (earlyReason !== null) notes.push(earlyReason);
  if (opts.envMode === 'indoor') {
    notes.push(
      `雨天提醒：只確認${spots.length > 1 ? '兩個景點' : '景點'}本身是室內。午餐地點、午睡的地方${opts.napMode === 'stroller' ? '（推車上睡需要的安靜空間）' : ''}、停車場到入口有沒有遮雨，都還沒確認。`,
    );
  }
  const draftReasons = base.draftReasons ?? [];
  return { ...base, notes, endsEarly: earlyReason !== null, earlyReason, draft: draftReasons.length > 0, draftReasons, status: 'ok', spots: spots.map((s) => spotInfo(s, ctx)), lunch: lunchInfo(lunchSpot, opts.lunch, ctx.restaurants) };
}

/** 單一景點的全日行程（模式 A）。 */
export function planSingle(spot: Spot, opts: FullDayOptions, ctx: Ctx): FullDayOk | FullDayFail {
  const m = ctx.minsOf(spot);
  if (m === null || m <= 0) return { status: 'fail', reason: `${spot.name}算不出車程。` };
  const hours = hoursFor(spot, opts.day);
  if (hours.closed) return { status: 'fail', reason: `資料寫${spot.name}那天沒有開。` };
  const nap = napTimes(ctx.nap);
  if (!nap && opts.napMode !== 'none') return { status: 'fail', reason: '午睡時間設定有問題，請到設定確認。' };
  const close = hours.close ?? Number.POSITIVE_INFINITY;
  const least = minPlay(spot);
  const notes: string[] = [];
  const going = m + ARRIVE_BUFFER;
  const leaveHome = Math.max(opts.departAt, hours.open !== null ? hours.open - going : 0);
  if (leaveHome > opts.departAt) notes.push(`資料寫 ${clock(hours.open!)} 開門，建議 ${clock(leaveHome)} 再出門（比你設定的晚一點）。`);
  const playStart = leaveHome + going;
  const steps: FamilyPlanStep[] = [
    { kind: 'leave', start: leaveHome, label: '從家裡出發' },
    { kind: 'drive', start: leaveHome, end: leaveHome + m, label: `開車前往${spot.name}（約 ${dl(m)}，粗估）` },
    { kind: 'park', start: leaveHome + m, end: playStart, label: '停車、準備推車、走到入口' },
  ];
  let homeAt: number;
  let earlyReason: string | null = null;
  const draft: string[] = [];
  const where = lunchWhere(spot, opts.lunch, ctx.restaurants);
  const base = { spot, playStart, close, mode: opts.lunch, where };

  if (opts.napMode === 'none') {
    const lunchStart = Math.max(EARLIEST_LUNCH, playStart + least);
    const args = { ...base, lunchStart, stayUntil: lunchStart + OUT_LUNCH_MINS + AFTER_LUNCH_REST, restMins: AFTER_LUNCH_REST };
    let part = lunchPart({ ...args, wantReturn: true });
    const afternoonEnd = (p: LunchPart) => Math.min(opts.latestHome - m, close, p.doneAt + afternoonCap(spot, p.playEnd - playStart));
    // 出場吃完回來，下午卻玩不到多久：不回去，吃完休息就回家。
    if (part.atVenue && part.move > 0 && afternoonEnd(part) - part.doneAt < MIN_AFTERNOON) part = lunchPart({ ...args, wantReturn: false });
    if (part.playEnd - playStart < least) {
      return { status: 'fail', reason: part.closedOut ? `資料寫${spot.name} ${clock(close)} 關門，玩不到 ${least} 分鐘。` : `午餐前在${spot.name}玩不到 ${least} 分鐘。` };
    }
    steps.push(...part.steps);
    lunchFlags(part, spot, draft, notes);
    const leaveSpot = afternoonEnd(part);
    if (part.atVenue && leaveSpot - part.doneAt >= MIN_AFTERNOON) {
      steps.push({ kind: 'play', start: part.doneAt, end: leaveSpot, label: `下午再回${spot.name}玩 ${leaveSpot - part.doneAt} 分鐘` });
      homeAt = leaveSpot + m;
    } else {
      homeAt = part.doneAt + m;
      earlyReason = part.closedOut ? `資料寫${spot.name} ${clock(close)} 就關門，下午不能再回去，吃完休息就回家。` : '下午時間不夠再玩，吃完休息就回家。';
      if (!part.atVenue) notes.push('回家的車程是從景點算的，吃飯的地方如果比較遠，時間要再抓寬一點。');
    }
    steps.push({ kind: 'drive', start: homeAt - m, end: homeAt, label: `開車回家（約 ${dl(m)}，粗估）` });
  } else {
    const n = nap!;
    if (opts.napMode === 'stroller') {
      if (!spot.stroller_ok || !opts.stroller) return { status: 'fail', reason: `${spot.name}推車不好推（或沒帶推車），沒辦法在推車上睡。可以改車上睡。` };
      if (close < n.end) return { status: 'fail', reason: `資料寫${spot.name} ${clock(close)} 關門，在推車上睡到 ${clock(n.end)} 會超過關門時間。可以改車上睡。` };
    }
    const stroller = opts.napMode === 'stroller';
    const part = lunchPart({ ...base, lunchStart: n.start - OUT_LUNCH_MINS, wantReturn: stroller, stayUntil: n.start, doneBy: n.start });
    if (part.playEnd - playStart < least) {
      return { status: 'fail', reason: `${clock(leaveHome)} 出門的話，午睡前在${spot.name}只能玩 ${Math.max(0, part.playEnd - playStart)} 分鐘，不到 ${least} 分鐘。` };
    }
    if (stroller && !part.atVenue) return { status: 'fail', reason: `吃完回不了${spot.name}，沒辦法在推車上睡。可以改車上睡。` };
    steps.push(...part.steps);
    lunchFlags(part, spot, draft, notes);
    if (part.doneAt < n.start) steps.push({ kind: 'rest', start: part.doneAt, end: n.start, label: part.atVenue ? '休息、準備午睡' : '在吃飯的地方休息、準備午睡' });
    if (stroller) {
      steps.push({ kind: 'nap', start: n.start, end: n.end, label: `在${spot.name}推車上午睡（找安靜的地方，大人輪流休息）` });
      const leaveSpot = Math.min(opts.latestHome - m, close, n.end + afternoonCap(spot, part.playEnd - playStart));
      if (leaveSpot - n.end >= MIN_AFTERNOON) {
        steps.push({ kind: 'play', start: n.end, end: leaveSpot, label: `睡醒再玩 ${leaveSpot - n.end} 分鐘` });
        homeAt = leaveSpot + m;
      } else {
        homeAt = n.end + m;
        earlyReason = '睡醒就回家，下午不排活動。';
      }
      steps.push({ kind: 'drive', start: homeAt - m, end: homeAt, label: `開車回家（約 ${dl(m)}，粗估）` });
    } else {
      homeAt = n.start + m;
      steps.push({ kind: 'nap', start: n.start, end: homeAt, label: `提前結束：上車回家，小孩在車上睡（約 ${dl(m)}，粗估）` });
      earlyReason = `車上睡的單景點行程：午睡時就上車回家，下午沒有安排活動，約 ${clock(homeAt)} 到家。`;
      if (m < MIN_CAR_NAP) notes.push(`回家只要 ${dl(m)}，車上睡不夠，到家要繼續睡。`);
      if (!part.atVenue) notes.push('出場吃飯的話，走回停車的地方也要時間；車程是從景點算的粗估。');
    }
  }
  steps.push({ kind: 'home', start: homeAt, label: '到家' });
  notes.push(hoursNote(spot, hours));
  return finish({ style: 'easy', steps, toFirst: m, backHome: m, transfer: null, leaveHome, homeAt, notes, earlyReason, draftReasons: draft }, [spot], spot, opts, ctx);
}

/** 兩個景點的全日行程（模式 B），照 first → second 的順序。 */
export function planPair(first: Spot, second: Spot, opts: FullDayOptions, ctx: Ctx): FullDayOk | FullDayFail {
  const m1 = ctx.minsOf(first);
  const m2 = ctx.minsOf(second);
  if (m1 === null || m2 === null) return { status: 'fail', reason: '有一個地方算不出車程。' };
  const t = transferMins(first, second);
  if (t === null) return { status: 'fail', reason: `${first.name}和${second.name}之間的車程無法確認（座標只到鄉鎮），不排成同一天。` };
  if (t > MAX_TRANSFER) return { status: 'fail', reason: `${first.name}和${second.name}之間約 ${dl(t)}（粗估），太遠。` };
  const h1 = hoursFor(first, opts.day);
  const h2 = hoursFor(second, opts.day);
  if (h1.closed) return { status: 'fail', reason: `資料寫${first.name}那天沒有開。` };
  if (h2.closed) return { status: 'fail', reason: `資料寫${second.name}那天沒有開。` };
  const close1 = h1.close ?? Number.POSITIVE_INFINITY;
  const close2 = h2.close ?? Number.POSITIVE_INFINITY;
  const nap = napTimes(ctx.nap);
  if (!nap && opts.napMode !== 'none') return { status: 'fail', reason: '午睡時間設定有問題，請到設定確認。' };
  const least1 = minPlay(first);
  const least2 = minPlay(second);
  const notes: string[] = [];
  const going = m1 + ARRIVE_BUFFER;
  const leaveHome = Math.max(opts.departAt, h1.open !== null ? h1.open - going : 0);
  if (leaveHome > opts.departAt) notes.push(`資料寫${first.name} ${clock(h1.open!)} 開門，建議 ${clock(leaveHome)} 再出門。`);
  const play1Start = leaveHome + going;
  const steps: FamilyPlanStep[] = [
    { kind: 'leave', start: leaveHome, label: '從家裡出發' },
    { kind: 'drive', start: leaveHome, end: leaveHome + m1, label: `開車前往${first.name}（約 ${dl(m1)}，粗估）` },
    { kind: 'park', start: leaveHome + m1, end: play1Start, label: '停車、準備推車、走到入口' },
  ];
  let leave1: number;
  let play2Start: number;
  const draft: string[] = [];
  const base = { spot: first, playStart: play1Start, close: close1, mode: opts.lunch, where: lunchWhere(first, opts.lunch, ctx.restaurants) };
  let part: LunchPart;

  if (opts.napMode === 'none') {
    const lunchStart = Math.max(EARLIEST_LUNCH, play1Start + least1);
    part = lunchPart({ ...base, lunchStart, wantReturn: false, stayUntil: lunchStart + OUT_LUNCH_MINS });
    if (part.playEnd - play1Start < least1) return { status: 'fail', reason: `資料寫${first.name} ${clock(close1)} 關門，午餐前玩不夠。` };
    steps.push(...part.steps);
    leave1 = part.doneAt;
    steps.push({ kind: 'transfer', start: leave1, end: leave1 + t, label: `${part.atVenue ? '' : '吃完'}開車到${second.name}（約 ${dl(t)}，兩地座標粗估）` });
    play2Start = leave1 + t + ARRIVE_BUFFER;
    steps.push({ kind: 'park', start: leave1 + t, end: play2Start, label: '停車、準備推車' });
  } else {
    const n = nap!;
    const stroller = opts.napMode === 'stroller';
    if (stroller) {
      if (!first.stroller_ok || !opts.stroller) return { status: 'fail', reason: `${first.name}推車不好推（或沒帶推車），沒辦法在推車上睡。` };
      if (close1 < n.end) return { status: 'fail', reason: `資料寫${first.name} ${clock(close1)} 關門，午睡會超過關門時間。` };
    }
    part = lunchPart({ ...base, lunchStart: n.start - OUT_LUNCH_MINS, wantReturn: stroller, stayUntil: n.start, doneBy: n.start });
    if (part.playEnd - play1Start < least1) return { status: 'fail', reason: `午睡前在${first.name}只能玩 ${Math.max(0, part.playEnd - play1Start)} 分鐘，不夠。` };
    if (stroller && !part.atVenue) return { status: 'fail', reason: `吃完回不了${first.name}，沒辦法在推車上睡。` };
    steps.push(...part.steps);
    if (part.doneAt < n.start) steps.push({ kind: 'rest', start: part.doneAt, end: n.start, label: part.atVenue ? '休息、準備午睡' : '在吃飯的地方休息、準備午睡' });
    if (stroller) {
      steps.push({ kind: 'nap', start: n.start, end: n.end, label: `在${first.name}推車上午睡` });
      leave1 = n.end;
      steps.push({ kind: 'transfer', start: leave1, end: leave1 + t, label: `睡醒開車到${second.name}（約 ${dl(t)}，兩地座標粗估）` });
      play2Start = leave1 + t + ARRIVE_BUFFER;
      steps.push({ kind: 'park', start: leave1 + t, end: play2Start, label: '停車、準備推車' });
    } else {
      // 車上睡：午睡時間開車去下一個地方；車程太短睡不夠，就不排雙景點。
      if (t < MIN_CAR_NAP) return { status: 'fail', reason: `${first.name}到${second.name}只要約 ${dl(t)}，車上睡不夠，會被叫醒。` };
      leave1 = n.start;
      steps.push({ kind: 'nap', start: leave1, end: leave1 + t, label: `開車到${second.name}，小孩在車上睡（約 ${dl(t)}，兩地座標粗估）` });
      const arrive2 = leave1 + t;
      if (arrive2 < n.end && second.stroller_ok && opts.stroller) {
        steps.push({ kind: 'nap', start: arrive2, end: n.end, label: '到了換到推車上繼續睡' });
        play2Start = n.end;
      } else {
        play2Start = arrive2 + ARRIVE_BUFFER;
        steps.push({ kind: 'park', start: arrive2, end: play2Start, label: '停車、準備推車' });
        if (arrive2 < n.end) notes.push(`午睡只睡到車上那 ${dl(t)}，比平常短。`);
      }
    }
  }
  lunchFlags(part, first, draft, notes);
  if (!part.atVenue) notes.push(`到${second.name}的車程是從${first.name}算的，吃飯的地方如果比較遠，時間要再抓寬一點。`);
  if (h2.open !== null && play2Start < h2.open) return { status: 'fail', reason: `資料寫${second.name} ${clock(h2.open)} 才開，到的時候還沒開。` };
  const leave2 = Math.min(opts.latestHome - m2, close2, play2Start + Math.min(MAX_AFTERNOON, second.stay_hours ? Math.max(second.stay_hours * 60, minPlay(second)) : MAX_AFTERNOON));
  if (leave2 - play2Start < least2) return { status: 'fail', reason: `下午在${second.name}只能玩 ${Math.max(0, leave2 - play2Start)} 分鐘，不夠。` };
  steps.push({ kind: 'play', start: play2Start, end: leave2, label: `在${second.name}玩 ${leave2 - play2Start} 分鐘` });
  const homeAt = leave2 + m2;
  steps.push({ kind: 'drive', start: leave2, end: homeAt, label: `開車回家（約 ${dl(m2)}，粗估）` });
  steps.push({ kind: 'home', start: homeAt, label: '到家' });
  notes.push(hoursNote(first, h1, `${first.name}：`), hoursNote(second, h2, `${second.name}：`));
  return finish({ style: 'explore', steps, toFirst: m1, backHome: m2, transfer: t, leaveHome, homeAt, notes, draftReasons: draft }, [first, second], first, opts, ctx);
}

/** 兩個景點，試兩種順序，選排得出來、而且先去的那個比較早開門的。 */
export function bestOrder(a: Spot, b: Spot, opts: FullDayOptions, ctx: Ctx): FullDayOk | FullDayFail {
  const ab = planPair(a, b, opts, ctx);
  const ba = planPair(b, a, opts, ctx);
  if (ab.status === 'ok' && ba.status === 'ok') {
    const openA = hoursFor(a, opts.day).open ?? 0;
    const openB = hoursFor(b, opts.day).open ?? 0;
    return openB < openA ? ba : ab;
  }
  if (ab.status === 'ok') return ab;
  if (ba.status === 'ok') return ba;
  return ab;
}

/** 有 3 歲以下的孩子（或還沒設定孩子），而且選了不睡：提醒。 */
export function napWarning(opts: Pick<FullDayOptions, 'napMode'>, kids: RecommendContext['kids']): string | null {
  if (opts.napMode !== 'none') return null;
  const list = kids ?? [];
  if (list.length > 0 && list.every((k) => k.age >= 3)) return null;
  return list.length === 0
    ? '還沒設定孩子年齡，又選了不睡午覺。如果有 3 歲以下的孩子，整天不睡容易累，建議改成推車上睡或車上睡。'
    : '有 3 歲以下的孩子，你選了不睡午覺。整天不睡容易累、哭鬧，建議改成推車上睡或車上睡。';
}

/** 預設的午睡方式：有 3 歲以下（或不知道年齡）就要睡，有帶推車睡推車、沒帶睡車上；都 3 歲以上才預設不睡。 */
export function defaultNapMode(kids: RecommendContext['kids'], stroller: boolean): DayNapMode {
  const list = kids ?? [];
  if (list.length > 0 && list.every((k) => k.age >= 3)) return 'none';
  return stroller ? 'stroller' : 'car';
}

/**
 * 一次算完全日方案。
 * - 輕鬆玩：符合條件的景點，排得出來的依推薦分數列出。
 * - 探索日：前幾名兩兩配對（分數加總高、景點間車程短的優先），排得出來的列出；
 *   一組都排不出來就說明原因，改列單景點方案。
 */
export function planFullDay(
  spots: readonly Spot[],
  recCtx: RecommendContext,
  opts: FullDayOptions,
  nap: Nap,
  restaurants: readonly Restaurant[],
  seed: string,
  nowMins?: number,
): FullDayPlans {
  const ctx: Ctx = { minsOf: recCtx.minsOf, kids: recCtx.kids, today: recCtx.today, nap, restaurants, nowMins };
  const candidates = familyCandidates(spots, recCtx, { slot: `${opts.day}-am`, envMode: opts.envMode, maxDrive: opts.maxDrive, stroller: opts.stroller, napMode: 'home' }, `${seed}|full`);
  const warning = napWarning(opts, recCtx.kids);
  const singles: FullDayOk[] = [];
  let firstSingleFail: string | null = null;
  for (const c of candidates) {
    const r = planSingle(c.spot, opts, ctx);
    if (r.status === 'ok') singles.push(r);
    else firstSingleFail ??= `${c.spot.name}：${r.reason}`;
  }
  if (opts.style === 'easy') {
    return {
      candidates,
      plans: singles,
      fallbackReason: null,
      failReason: candidates.length === 0 ? null : singles.length === 0 ? (firstSingleFail ?? '排不出合理的時間。') : null,
      napWarning: warning,
    };
  }
  const pool = candidates.slice(0, PAIR_POOL);
  const pairs: { a: ScoredSpot; b: ScoredSpot; rank: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!;
      const b = pool[j]!;
      const t = transferMins(a.spot, b.spot);
      pairs.push({ a, b, rank: a.score + b.score - (t ?? 999) * 0.5 });
    }
  }
  pairs.sort((x, y) => y.rank - x.rank || x.a.spot.id.localeCompare(y.a.spot.id) || x.b.spot.id.localeCompare(y.b.spot.id));
  const doubles: FullDayOk[] = [];
  let firstPairFail: string | null = null;
  for (const p of pairs) {
    const r = bestOrder(p.a.spot, p.b.spot, opts, ctx);
    if (r.status === 'ok') doubles.push(r);
    else firstPairFail ??= r.reason;
  }
  if (doubles.length > 0) return { candidates, plans: doubles, fallbackReason: null, failReason: null, napWarning: warning };
  const why =
    candidates.length < 2
      ? '符合條件的地方不到兩個，排不出雙景點。'
      : `排不出合理的雙景點行程（例如：${firstPairFail ?? '移動、午睡或營業時間對不上'}）。`;
  return {
    candidates,
    plans: singles,
    fallbackReason: `${why}先給你單景點的輕鬆玩方案。`,
    failReason: candidates.length === 0 ? null : singles.length === 0 ? (firstSingleFail ?? '排不出合理的時間。') : null,
    napWarning: warning,
  };
}

/** 「週六 11/21」：全日遊不分上下午。 */
export function dayLabel(today: string, day: 'sat' | 'sun'): string {
  return slotLabelWithDate(today, `${day}-am`).replace('上午', '');
}

/**
 * 首頁「這週放電計畫」卡片用的標題：保存了全日遊時，日期用那天（不分上午下午）並標「全日遊」，
 * 兩站行程把第二站也帶出來。WeekPlan 本身不變（還是只有第一站），第二站從 dayPlan.secondId 找。
 */
export interface DayHeading {
  when: string;
  first: Spot;
  second: Spot | null;
}

export function dayPlanHeading(addon: DayPlanAddon, today: string, spotById: ReadonlyMap<string, Spot>): DayHeading | null {
  const first = spotById.get(addon.spotId);
  if (!first) return null;
  const second = addon.secondId ? spotById.get(addon.secondId) : undefined;
  if (addon.secondId && !second) return null;
  const day = addon.slot === 'sun-am' ? 'sun' : 'sat';
  return { when: `${dayLabel(today, day)}・全日遊`, first, second: second ?? null };
}

// ---------- 儲存（版本化） ----------

/**
 * 全日行程存在 StoredState.dayPlan，跟半日遊的 familyPlan 分開，舊版 familyPlan 不受影響。
 * 用 v 標版本；看不懂的版本或格式壞掉就丟掉這一欄，不影響其他資料。
 * 跟 WeekPlan 對應：week、slot（週六或週日上午）、spotId（第一個景點）。
 */
export interface DayPlanAddon {
  v: 1;
  week: string;
  slot: Slot;
  spotId: string;
  secondId?: string;
  style: DayStyle;
  departAt: number;
  latestHome: number;
  napMode: DayNapMode;
  lunch: LunchMode;
  envMode: EnvMode;
  maxDrive: number;
  stroller: boolean;
}

export function makeDayAddon(week: string, plan: FullDayOk, opts: FullDayOptions): DayPlanAddon {
  const [first, second] = plan.spots;
  return {
    v: 1,
    week,
    slot: `${opts.day}-am`,
    spotId: first!.spot.id,
    ...(second ? { secondId: second.spot.id } : {}),
    style: plan.style,
    departAt: opts.departAt,
    latestHome: opts.latestHome,
    napMode: opts.napMode,
    lunch: opts.lunch,
    envMode: opts.envMode,
    maxDrive: opts.maxDrive,
    stroller: opts.stroller,
  };
}

const minsOk = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

export function parseDayPlan(v: unknown): DayPlanAddon | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.week !== 'string' || !/^\d{4}-W\d{2}$/.test(o.week)) return null;
  if (!isSlot(o.slot) || !o.slot.endsWith('-am')) return null;
  const id = /^spot-\d{3,}$/;
  if (typeof o.spotId !== 'string' || !id.test(o.spotId)) return null;
  if (o.secondId !== undefined && (typeof o.secondId !== 'string' || !id.test(o.secondId) || o.secondId === o.spotId)) return null;
  if (o.style !== 'easy' && o.style !== 'explore') return null;
  if (o.style === 'explore' && o.secondId === undefined) return null;
  if (!minsOk(o.departAt, 6 * 60, 12 * 60) || !minsOk(o.latestHome, 12 * 60, 22 * 60)) return null;
  if (o.napMode !== 'stroller' && o.napMode !== 'car' && o.napMode !== 'none') return null;
  if (o.lunch !== 'packed' && o.lunch !== 'nearby') return null;
  if (o.envMode !== 'indoor' && o.envMode !== 'any') return null;
  if (typeof o.maxDrive !== 'number' || !(FAMILY_DRIVE_OPTIONS as readonly number[]).includes(o.maxDrive)) return null;
  if (typeof o.stroller !== 'boolean') return null;
  return {
    v: 1,
    week: o.week,
    slot: o.slot,
    spotId: o.spotId,
    ...(o.secondId ? { secondId: o.secondId as string } : {}),
    style: o.style,
    departAt: o.departAt,
    latestHome: o.latestHome,
    napMode: o.napMode,
    lunch: o.lunch,
    envMode: o.envMode,
    maxDrive: o.maxDrive,
    stroller: o.stroller,
  };
}

export function dayAddonMatches(addon: DayPlanAddon | null | undefined, plan: WeekPlan | null | undefined): addon is DayPlanAddon {
  return !!addon && !!plan && addon.week === plan.week && addon.slot === plan.slot && addon.spotId === plan.spotId;
}

export function dayOptionsOf(addon: DayPlanAddon): FullDayOptions {
  return {
    day: addon.slot.startsWith('sat') ? 'sat' : 'sun',
    departAt: addon.departAt,
    latestHome: addon.latestHome,
    style: addon.style,
    napMode: addon.napMode,
    lunch: addon.lunch,
    envMode: addon.envMode,
    maxDrive: addon.maxDrive,
    stroller: addon.stroller,
  };
}

/**
 * 已保存的全日行程還能不能用：兩個景點都重新檢查硬性條件（出發地、孩子年齡、推車、資料風險、評分、熄燈），
 * 再重排時間。不符合就回傳 fail 和原因。
 */
export function checkSavedDay(
  addon: DayPlanAddon,
  spots: readonly Spot[],
  recCtx: RecommendContext,
  nap: Nap,
  restaurants: readonly Restaurant[],
  nowMins?: number,
): FullDayOk | FullDayFail {
  const first = spots.find((s) => s.id === addon.spotId);
  const second = addon.secondId ? spots.find((s) => s.id === addon.secondId) : undefined;
  if (!first || (addon.secondId && !second)) return { status: 'fail', reason: '行程裡的景點已經不在資料裡了。' };
  const cons = { slot: addon.slot, envMode: addon.envMode, stroller: addon.stroller, maxDrive: addon.maxDrive };
  const problems = [first, ...(second ? [second] : [])].flatMap((s) => spotProblems(s, cons, recCtx).map((p) => `${s.name}：${p}`));
  if (problems.length > 0) return { status: 'fail', reason: `${problems.join('；')}。` };
  const ctx: Ctx = { minsOf: recCtx.minsOf, kids: recCtx.kids, today: recCtx.today, nap, restaurants, nowMins };
  const opts = dayOptionsOf(addon);
  return second ? planPair(first, second, opts, ctx) : planSingle(first, opts, ctx);
}

/** 分享文字：不帶孩子名字、生日、出發地；說明連結只會看到第一個景點。 */
export function dayShareText(plan: FullDayOk, whenLabel: string): string {
  const names = plan.spots.map((s) => s.spot.name).join(' → ');
  const lines = plan.steps.map((s) => `${clock(s.start)}${s.end !== undefined ? `–${clock(s.end)}` : ''} ${s.label}`);
  const early = plan.endsEarly ? [`提前結束：約 ${clock(plan.homeAt)} 就到家，下午沒有排活動。`] : [];
  const draft = plan.draft ? ['待確認：', ...plan.draftReasons.map((r) => `・${r}`)] : [];
  return [`${whenLabel}全日遊：${names}`, ...lines, ...early, ...draft, '（車程都是粗估；打開連結看得到兩站和條件，時間表會用對方手機的出發地重新排）'].join('\n');
}
