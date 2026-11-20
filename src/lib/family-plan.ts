/**
 * 親子放電計畫：「幫我排半日遊」。全部是純函式。
 *
 * 1. 挑景點：沿用 rankCandidates／scoreSpot 的規則（休館、還沒開幕、高風險資料、低分、最近去過、
 *    推車、車程上限都會排除），再加上這個功能自己的限制：完全室內只收 env === 'in'、
 *    主要遊玩的孩子要在建議年齡內（未滿 2 歲、還不到適齡的寶寶算陪同）。
 * 2. 排時間軸：
 *    - 上午＋回家睡：從午睡開始時間往回推（安頓 → 回家吃午餐 → 回程 → 遊玩 → 停車 → 去程）。
 *    - 上午＋車上睡：沿用 napPlan 的原則，午睡開始時上車，回程在車上睡。
 *    - 下午：午睡起來再出門。
 *    排不出合理的遊玩時間就回報「時間不足」，不硬排；車程算不出來就不排時間。
 * 3. 時間表不存起來：每次都用目前的出發地、午睡、孩子年齡重算，所以改了設定就會跟著更新。
 *    存起來的只有這次挑的條件（FamilyPlanAddon），跟原本的 WeekPlan 用 week／slot／spotId 對應。
 */
import type { Spot } from '../data/schema.ts';
import type { MinsOf } from './filter.ts';
import { formatDrive } from './format.ts';
import { ARRIVE_BUFFER, EARLIEST_ARRIVE, EARLIEST_LEAVE, type Nap, formatClock, toMins } from './plan.ts';
import { type KidInfo, type RecommendContext, type ScoredSpot, rankCandidates, splitKids } from './recommend.ts';
import { bookingNotice } from './trip-risks.ts';
import { spotDateStatus } from './date.ts';
import { RISK_LABELS, type Verification, isRecommendable, verificationOf } from './verification.ts';
import { type Slot, SLOT_LABELS, isSlot, slotDate } from './weather.ts';
import type { WeekPlan } from './weekplan.ts';

// ---------- 型別 ----------

export type NapMode = 'home' | 'car';
export type EnvMode = 'indoor' | 'any';

/** 可以選的單程車程上限（分鐘）。 */
export const FAMILY_DRIVE_OPTIONS = [30, 45, 60, 120] as const;

export interface FamilyPlanOptions {
  slot: Slot;
  /** indoor：完全室內（只收 env === 'in'）；any：一般。 */
  envMode: EnvMode;
  maxDrive: number;
  stroller: boolean;
  napMode: NapMode;
}

/**
 * 存在 localStorage 的附加條件（StoredState.familyPlan）。不存時間表、不存出發地、不存孩子資料。
 * 跟 WeekPlan 用 week、slot、spotId 對應；任何一個對不上，就代表時間表已經不適用。
 */
export interface FamilyPlanAddon extends Omit<FamilyPlanOptions, 'slot'> {
  week: string;
  slot: Slot;
  spotId: string;
}

export type FamilyPlanStepKind = 'leave' | 'drive' | 'park' | 'play' | 'lunch' | 'rest' | 'nap' | 'home' | 'transfer';

export interface FamilyPlanStep {
  kind: FamilyPlanStepKind;
  /** 從午夜起算的分鐘數 */
  start: number;
  /** 沒有結束時間的是一個時間點（出門、到家、午睡開始） */
  end?: number;
  label: string;
}

export type FamilyPlanResult =
  | {
      status: 'ok';
      spot: Spot;
      mins: number;
      steps: FamilyPlanStep[];
      /** 實際能玩幾分鐘 */
      playMins: number;
      leaveHome: number;
      homeAt: number;
      /** 時間比較趕、開門時間要先確認之類的提醒 */
      notes: string[];
      /** 出發前要確認的事（資料不完整的地方） */
      checks: string[];
      /** 設施提示（推車、尿布台、廁所），寫明資料來源的可信度 */
      facilities: string[];
      ageNote: string | null;
      verification: Verification;
    }
  | { status: 'no-time'; spot: Spot; mins: number; reason: string }
  | { status: 'unknown-drive'; spot: Spot; reason: string }
  /** 資料寫那天休息。 */
  | { status: 'closed'; spot: Spot; reason: string }
  /** 已保存的計畫，不再符合當初的硬性條件（出發地、孩子年齡、推車改了之類）。 */
  | { status: 'invalid'; spot: Spot; reason: string }
  | { status: 'past'; reason: string };

// ---------- 時間常數（分鐘） ----------

/** 回家後安頓、洗手換衣服，到午睡開始。 */
export const SETTLE_MINS = 20;
/** 回家吃午餐。 */
export const LUNCH_MINS = 35;
/** 車上睡模式：上車前在景點簡單吃午餐（自備或附近，地點要自己確認）。 */
export const CAR_LUNCH_MINS = 30;
/** 午睡起床到出門。 */
export const WAKE_BUFFER = 15;
/** 下午場最晚幾點到家：18:30。 */
export const LATEST_HOME = 18 * 60 + 30;
/** 遊玩目標：90–120 分鐘；景點建議停留比較短就照建議。 */
export const TARGET_PLAY_MIN = 90;
export const TARGET_PLAY_MAX = 120;
/** 至少要能玩多久才值得去：75 分鐘（建議停留明確比較短的地方，以建議停留為準）。 */
export const MIN_PLAY = 75;

/** 目標遊玩時間：景點建議停留在 90–120 之間就照建議；超過 120 取 120；沒資料用 90；比 90 短就照建議。 */
export function targetPlay(spot: Pick<Spot, 'stay_hours'>): number {
  if (!spot.stay_hours) return TARGET_PLAY_MIN;
  const want = Math.round(spot.stay_hours * 60);
  return Math.min(TARGET_PLAY_MAX, want);
}

/** 至少要玩多久：75 分鐘；景點有明確比較短的建議停留時間才例外。 */
export function minPlay(spot: Pick<Spot, 'stay_hours'>): number {
  return Math.min(MIN_PLAY, spot.stay_hours ? Math.round(spot.stay_hours * 60) : MIN_PLAY);
}

// ---------- 營業時間 ----------

const hm = (h: string, m: string) => Number(h) * 60 + Number(m);

/**
 * 從景點的開放說明（open_note）讀出週末幾點開、幾點關，例如「平日 09:00–17:00，週末到 18:00」
 * 「平日 11:30–18:00，週末 10:00–18:30」「10:00–18:00，週六到 20:00」。
 * 只用來避免排在開門前到、關門後還在玩；讀不到就回傳 null（不知道），不猜。實際以官方公告為準。
 */
export interface WeekendHours {
  open: number | null;
  close: number | null;
  /** 資料寫這天休息（週末公休、休園重整之類）。 */
  closed: boolean;
}

export function weekendHours(note: string | undefined, day: 'sat' | 'sun'): WeekendHours {
  if (!note) return { open: null, close: null, closed: false };
  const off = '(?:都)?(?:公休|休館|休園|休息|不開放)';
  const closedDay = day === 'sat' ? new RegExp(`(?:週末|假日|六日|週六)${off}`) : new RegExp(`(?:週末|假日|六日|週六日|週日)${off}`);
  if (closedDay.test(note) || /休園重整|暫停營業|暫時關閉|永久歇業|結束營業/.test(note)) return { open: null, close: null, closed: true };
  let open: number | null = null;
  let close: number | null = null;
  const base = /(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})/.exec(note);
  if (base) {
    open = hm(base[1]!, base[2]!);
    close = hm(base[3]!, base[4]!);
  }
  const weekend = /(?:週末|假日|週六日)\s*(\d{1,2}):(\d{2})–(\d{1,2}):(\d{2})/.exec(note);
  if (weekend) {
    open = hm(weekend[1]!, weekend[2]!);
    close = hm(weekend[3]!, weekend[4]!);
  }
  const lateWeekend = /(?:週末|假日)到\s*(\d{1,2}):(\d{2})/.exec(note);
  if (lateWeekend) close = hm(lateWeekend[1]!, lateWeekend[2]!);
  const lateSat = /週六到\s*(\d{1,2}):(\d{2})/.exec(note);
  if (day === 'sat' && lateSat) close = hm(lateSat[1]!, lateSat[2]!);
  // 讀出來的時間不合理（關門比開門早）就當成不知道，不用它排。
  if (open !== null && close !== null && close <= open) return { open: null, close: null, closed: false };
  return { open, close, closed: false };
}

// ---------- 挑景點 ----------

/** 主要遊玩的孩子是不是都在建議年齡內（未滿 2 歲、還不到適齡的寶寶算陪同，不算）。沒設定孩子或景點沒年齡資料時回傳 null（不知道）。 */
export function agesFit(spot: Spot, kids: readonly KidInfo[]): boolean | null {
  if (kids.length === 0 || !spot.age_best) return null;
  const [min, max] = spot.age_best;
  const { players } = splitKids(kids, spot.age_best);
  return players.every((k) => {
    const age = Math.floor(k.age);
    return age >= min && (max >= 12 || age <= max);
  });
}

/**
 * 符合半日遊條件的景點，依既有推薦分數排序（同樣的 seed 一定得到同樣的順序）。
 * 不會為了湊結果放寬條件；沒有符合的就回傳空陣列。
 */
export function familyCandidates(spots: readonly Spot[], ctx: RecommendContext, options: FamilyPlanOptions, seed: string): ScoredSpot[] {
  const planCtx: RecommendContext = {
    ...ctx,
    // 完全室內自己嚴格判斷，不用「可能下雨」那套（那套會放半室內進來）。
    rainy: false,
    overnight: false,
    maxDrive: options.maxDrive,
    needStroller: options.stroller,
  };
  return rankCandidates(spots, planCtx, `${seed}|family`).filter((s) => {
    if (options.envMode === 'indoor' && s.spot.env !== 'in') return false;
    if (s.mins > options.maxDrive) return false;
    if (options.stroller && !s.spot.stroller_ok) return false;
    return agesFit(s.spot, ctx.kids ?? []) !== false;
  });
}

// ---------- 排時間 ----------

/** 檢查時間軸：時間不能是負的、不能倒退、前後不能重疊。 */
export function validateSteps(steps: readonly FamilyPlanStep[]): boolean {
  let cursor = 0;
  for (const s of steps) {
    if (!Number.isFinite(s.start) || s.start < 0 || s.start < cursor) return false;
    if (s.end !== undefined && (!Number.isFinite(s.end) || s.end < s.start)) return false;
    cursor = s.end ?? s.start;
  }
  return cursor < 24 * 60;
}

interface TimelineInput {
  spot: Spot;
  /** 單程車程（分鐘）；算不出來是 null */
  mins: number | null;
  slot: Slot;
  napMode: NapMode;
  nap: Nap;
  today: string;
  /** 現在幾點（分鐘），用來判斷今天的出門時間是不是已經過了；不給就不判斷 */
  nowMins?: number;
}

const clock = formatClock;

function driveLabel(mins: number): string {
  const d = formatDrive(mins);
  return `${d.value} ${d.unit}，粗估`;
}

/** 排一個景點的半日時間軸。 */
export function buildTimeline(input: TimelineInput): FamilyPlanResult {
  const { spot, mins, slot, napMode, nap, today, nowMins } = input;
  const date = slotDate(today, slot);
  if (date < today) return { status: 'past', reason: `${SLOT_LABELS[slot]}已經過了，請改選還沒到的時段。` };
  if (mins === null || mins <= 0) {
    return { status: 'unknown-drive', spot, reason: '這個地方算不出車程，沒辦法排時間。出發前用導航看要開多久。' };
  }
  const napStart = toMins(nap.start);
  const napEnd = toMins(nap.end);
  if (napStart === null || napEnd === null || napEnd <= napStart) {
    return { status: 'no-time', spot, mins, reason: '午睡時間設定有問題，請到設定確認。' };
  }

  const target = targetPlay(spot);
  const least = minPlay(spot);
  const going = mins + ARRIVE_BUFFER;
  const notes: string[] = [];
  const hours = weekendHours(spot.open_note, slot.startsWith('sat') ? 'sat' : 'sun');
  if (hours.closed) {
    return { status: 'closed', spot, reason: `資料寫${SLOT_LABELS[slot].slice(0, 2)}沒有開（${spot.open_note}），換一個地方或改天。` };
  }
  // 資料有寫幾點開門：最早在開門時開始玩（停車、走到入口算在開門前）。
  const openGate = hours.open !== null ? hours.open - going : 0;
  const close = hours.close ?? Number.POSITIVE_INFINITY;
  let steps: FamilyPlanStep[];
  let leaveHome: number;
  let homeAt: number;
  let playMins: number;

  if (slot.endsWith('-am')) {
    if (napMode === 'home') {
      // 從午睡往回推：安頓 → 午餐 → 回程 → 遊玩。資料寫的關門時間比較早，就玩到關門、早點回家。
      const leaveSpot = Math.min(napStart - SETTLE_MINS - LUNCH_MINS - mins, close);
      homeAt = leaveSpot + mins;
      const lunchStart = homeAt;
      leaveHome = Math.max(EARLIEST_LEAVE, EARLIEST_ARRIVE - mins, openGate, leaveSpot - target - going);
      const playStart = leaveHome + going;
      playMins = leaveSpot - playStart;
      if (playMins < least) {
        return {
          status: 'no-time',
          spot,
          mins,
          reason: `回家睡的話，扣掉來回車程、午餐和安頓，只剩 ${Math.max(0, playMins)} 分鐘可以玩，時間不足。建議改成車上睡、選近一點的地方，或改下午去。`,
        };
      }
      steps = [
        { kind: 'leave', start: leaveHome, label: '從家裡出發' },
        { kind: 'drive', start: leaveHome, end: leaveHome + mins, label: `開車前往（約 ${driveLabel(mins)}）` },
        { kind: 'park', start: leaveHome + mins, end: playStart, label: '停車、準備推車、走到入口' },
        { kind: 'play', start: playStart, end: leaveSpot, label: `玩 ${playMins} 分鐘` },
        { kind: 'drive', start: leaveSpot, end: homeAt, label: `開車回家（約 ${driveLabel(mins)}）` },
        { kind: 'lunch', start: lunchStart, end: lunchStart + LUNCH_MINS, label: '回家吃午餐' },
        { kind: 'rest', start: lunchStart + LUNCH_MINS, end: napStart, label: '洗手、換衣服、安頓' },
        { kind: 'nap', start: napStart, label: '午睡' },
      ];
    } else {
      // 車上睡：午睡開始時上車，回程在車上睡（同 napPlan 的原則）；上車前簡單吃午餐。
      const leaveSpot = napStart;
      homeAt = napStart + mins;
      const lunchStart = leaveSpot - CAR_LUNCH_MINS;
      if (close < lunchStart) {
        return { status: 'no-time', spot, mins, reason: `資料寫 ${clock(close)} 關門，比午睡早，車上睡排不起來。可以改成回家睡。` };
      }
      leaveHome = Math.max(EARLIEST_LEAVE, EARLIEST_ARRIVE - mins, openGate, lunchStart - target - going);
      const playStart = leaveHome + going;
      playMins = lunchStart - playStart;
      if (playMins < least) {
        return { status: 'no-time', spot, mins, reason: `扣掉車程和午餐只剩 ${Math.max(0, playMins)} 分鐘可以玩，時間不足。建議選近一點的地方，或改下午去。` };
      }
      steps = [
        { kind: 'leave', start: leaveHome, label: '從家裡出發' },
        { kind: 'drive', start: leaveHome, end: leaveHome + mins, label: `開車前往（約 ${driveLabel(mins)}）` },
        { kind: 'park', start: leaveHome + mins, end: playStart, label: '停車、準備推車、走到入口' },
        { kind: 'play', start: playStart, end: lunchStart, label: `玩 ${playMins} 分鐘` },
        { kind: 'lunch', start: lunchStart, end: leaveSpot, label: '吃午餐（自備或附近，地點和營業時間要自己確認）' },
        { kind: 'nap', start: leaveSpot, end: homeAt, label: `上車回家，小孩在車上睡（約 ${driveLabel(mins)}）` },
        { kind: 'home', start: homeAt, label: '到家' },
      ];
    }
  } else {
    // 下午：午睡在家睡完再出門；資料寫的開門時間比較晚，就晚一點出門。
    leaveHome = Math.max(napEnd + WAKE_BUFFER, openGate);
    const playStart = leaveHome + going;
    // 資料有寫幾點關門：玩到關門為止；也要在 18:30 前到家。
    const latestLeaveSpot = Math.min(LATEST_HOME - mins, close);
    const leaveSpot = Math.min(playStart + target, latestLeaveSpot);
    playMins = leaveSpot - playStart;
    homeAt = leaveSpot + mins;
    if (playMins < least) {
      return { status: 'no-time', spot, mins, reason: `午睡起來再出門，${clock(LATEST_HOME)} 前要到家的話只剩 ${Math.max(0, playMins)} 分鐘可以玩，時間不足。建議改上午去，或選近一點的地方。` };
    }
    steps = [
      { kind: 'nap', start: napStart, end: napEnd, label: '在家午睡' },
      { kind: 'leave', start: leaveHome, label: '睡醒出發' },
      { kind: 'drive', start: leaveHome, end: leaveHome + mins, label: `開車前往（約 ${driveLabel(mins)}）` },
      { kind: 'park', start: leaveHome + mins, end: playStart, label: '停車、準備推車、走到入口' },
      { kind: 'play', start: playStart, end: leaveSpot, label: `玩 ${playMins} 分鐘` },
      { kind: 'drive', start: leaveSpot, end: homeAt, label: `開車回家（約 ${driveLabel(mins)}）` },
      { kind: 'home', start: homeAt, label: '到家' },
    ];
    if (hours.close === null) notes.push('下午場：傍晚可能已經接近關門時間。');
  }

  if (!validateSteps(steps)) {
    return { status: 'no-time', spot, mins, reason: '這個條件排不出合理的時間，建議更改條件。' };
  }
  const arrive = leaveHome + mins;
  // 今天的出門時間已經過了：不當成可行的行程。
  if (nowMins !== undefined && date === today && nowMins > leaveHome) {
    return { status: 'past', reason: `今天建議 ${clock(leaveHome)} 出門，已經過了。可以改下午或其他天。` };
  }
  const v = verificationOf(spot);
  notes.push(hoursNote(spot, hours));
  if (hours.open === null && hours.close === null && slot.endsWith('-am') && arrive < 9 * 60 + 30) notes.push(`${clock(arrive)} 就到了，先確認幾點開門。`);
  if (playMins < target - 15) notes.push('時間比較趕，挑重點玩。');

  return {
    status: 'ok',
    spot,
    mins,
    steps,
    playMins,
    leaveHome,
    homeAt,
    notes,
    checks: departureChecks(spot),
    facilities: facilityNotes(spot),
    ageNote: null,
    verification: v,
  };
}

/** 營業時間怎麼來的：查證過、沒查證（只用來避開時間）、不知道。半日遊、全日遊共用。 */
export function hoursNote(spot: Spot, hours: WeekendHours, prefix = ''): string {
  const v = verificationOf(spot);
  const hoursVerified = v.status !== 'conflict' && v.verifiedFields.some((f) => /營業時間|開放時間/.test(f));
  if (hours.open !== null || hours.close !== null) {
    const span = `${hours.open !== null ? `${clock(hours.open)} 開` : ''}${hours.open !== null && hours.close !== null ? '、' : ''}${hours.close !== null ? `${clock(hours.close)} 關` : ''}`;
    return hoursVerified
      ? `${prefix}依查證過的營業時間（${span}）排的，出發前還是看一下官方公告。`
      : `${prefix}營業時間是還沒查證的資料（${span}），只用來避開開門前和關門後，不代表當天一定有開，出發前一定要確認。`;
  }
  return `${prefix}不知道幾點開、幾點關，這份時間表沒有考慮營業時間，出發前一定要確認。`;
}

/** 出發前要確認的事：資料沒查證或不知道的地方，直接寫出來，不假設。 */
export function departureChecks(spot: Spot): string[] {
  const out: string[] = [];
  const v = verificationOf(spot);
  if (!v.verifiedFields.some((f) => /營業時間|開放時間/.test(f))) out.push('營業時間還沒查證，出發前看官網或 Google 地圖。');
  const booking = bookingNotice(spot);
  if (booking) out.push(`${booking}，出發前先處理。`);
  else if (!spot.booking || [spot.booking.reservation, spot.booking.advance_ticket].includes('unknown')) out.push('要不要預約或先買票還不知道，出發前確認。');
  if (spot.open_note) out.push(spot.open_note);
  if (spot.amenities?.maintenance_note) out.push(`維修或休館：${spot.amenities.maintenance_note}`);
  return out;
}

/** 推車、尿布台、廁所：有查證寫「查過」，只有一般資料寫「資料標示」，沒有就寫「沒有資料」。 */
export function facilityNotes(spot: Spot): string[] {
  const a = spot.amenities;
  const say = (name: string, checked: 'yes' | 'no' | 'unknown' | undefined, listed: boolean) => {
    if (checked === 'yes') return `${name}：有（${a?.source ?? '查證過'}）`;
    if (checked === 'no') return `${name}：沒有（${a?.source ?? '查證過'}）`;
    if (listed) return `${name}：資料標示有，還沒逐項查證`;
    return `${name}：沒有資料，出發前確認`;
  };
  return [
    a?.stroller_path === 'yes' || a?.stroller_path === 'no'
      ? say('推車通道', a.stroller_path, false)
      : spot.stroller_ok
        ? '推車：資料標示好推，還沒逐項查證'
        : '推車：資料標示不好推，建議帶揹巾',
    say('尿布台', a?.diaper, !!spot.facilities?.includes('diaper')),
    say('哺乳室', a?.nursing, !!spot.facilities?.includes('nursing')),
    say('廁所', a?.toilet, false),
  ];
}

/** 年齡說明：誰是主要玩的、誰是陪同的寶寶。 */
export function ageNote(spot: Spot, kids: readonly KidInfo[]): string | null {
  if (!spot.age_best) return '這裡沒有建議年齡的資料。';
  const range = `建議 ${spot.age_best[0]}–${spot.age_best[1]}${spot.age_best[1] === 12 ? '+' : ''} 歲`;
  if (kids.length === 0) return range;
  const { players, companions } = splitKids(kids, spot.age_best);
  const name = (k: KidInfo, i: number) => k.name.trim() || `孩子${i + 1}`;
  const parts = [`${range}，${players.map(name).join('、')}可以玩`];
  if (companions.length > 0) parts.push(`${companions.map(name).join('、')}坐推車陪同`);
  return parts.join('；');
}

type OkPlan = Extract<FamilyPlanResult, { status: 'ok' }>;

export interface HalfDayPlans {
  /** 符合硬性條件的景點（依推薦分數排序） */
  candidates: ScoredSpot[];
  /** 真的排得出合理時間的（依推薦分數排序） */
  plans: { pick: ScoredSpot; result: OkPlan }[];
  /** 符合條件但排不出時間的，和原因 */
  skipped: { pick: ScoredSpot; result: Exclude<FamilyPlanResult, { status: 'ok' }> }[];
  /** 要顯示的：第 index 個排得出來的；全部排不出來時是 null，時段已經過了是 past */
  result: FamilyPlanResult | null;
}

/**
 * 一次算完：挑出符合條件的景點，依推薦分數往下檢查，只留下真的排得出合理時間的。
 * 第一名排不出來就自動看下一個；全部都排不出來才回傳 null。index 是在「排得出來的」裡面輪。
 */
export function planHalfDay(
  spots: readonly Spot[],
  ctx: RecommendContext,
  options: FamilyPlanOptions,
  nap: Nap,
  seed: string,
  index = 0,
  nowMins?: number,
): HalfDayPlans {
  if (slotDate(ctx.today, options.slot) < ctx.today) {
    return { candidates: [], plans: [], skipped: [], result: { status: 'past', reason: `${SLOT_LABELS[options.slot]}已經過了，請改選還沒到的時段。` } };
  }
  const candidates = familyCandidates(spots, ctx, options, seed);
  const plans: HalfDayPlans['plans'] = [];
  const skipped: HalfDayPlans['skipped'] = [];
  for (const pick of candidates) {
    const result = timelineFor(pick.spot, ctx.minsOf, ctx, options, nap, nowMins);
    if (result.status === 'ok') plans.push({ pick, result });
    else skipped.push({ pick, result });
  }
  const chosen = plans.length > 0 ? plans[((index % plans.length) + plans.length) % plans.length] : undefined;
  // 今天的出門時間都過了：直接說時段來不及，不要說「沒有適合的地方」。
  const allLate = plans.length === 0 && skipped.length > 0 && skipped.every((s) => s.result.status === 'past');
  return { candidates, plans, skipped, result: chosen?.result ?? (allLate ? skipped[0]!.result : null) };
}

/**
 * 已保存的半日遊還能不能用：用目前的出發地、孩子年齡、推車設定，重新檢查當初的硬性條件。
 * 不符合就回傳 invalid（要重新安排），符合才重排時間軸。
 */
export function checkSavedPlan(spot: Spot, addon: FamilyPlanAddon, ctx: RecommendContext, nap: Nap, nowMins?: number): FamilyPlanResult {
  const problems = spotProblems(spot, addon, ctx);
  if (problems.length > 0) return { status: 'invalid', spot, reason: `${problems.join('；')}。` };
  return timelineFor(spot, ctx.minsOf, ctx, addon, nap, nowMins);
}

/** 一個景點還符不符合當初的硬性條件（半日遊、全日遊保存後的重新檢查共用）。回傳不符合的原因。 */
export function spotProblems(
  spot: Spot,
  addon: Pick<FamilyPlanOptions, 'slot' | 'envMode' | 'stroller' | 'maxDrive'>,
  ctx: RecommendContext,
): string[] {
  const problems: string[] = [];
  if (!isRecommendable(spot)) problems.push(`資料有疑問（${(spot.risk_flags ?? []).map((r) => RISK_LABELS[r]).join('、')}）`);
  const date = spotDateStatus(spot, slotDate(ctx.today, addon.slot));
  if (date.closed) problems.push('那天已經熄燈');
  if (date.notYetOpen) problems.push('那天還沒開幕');
  const rating = ctx.ratings?.[spot.id];
  if (rating && rating.stars <= 2) problems.push(`你們給過 ${rating.stars} 顆星`);
  if (addon.envMode === 'indoor' && spot.env !== 'in') problems.push('不是完全室內');
  if ((addon.stroller || ctx.needStroller) && !spot.stroller_ok) problems.push('現在設定要帶推車，這裡推車不好推');
  const mins = ctx.minsOf(spot);
  if (mins === null) problems.push('從目前的出發地算不出車程');
  else if (mins > addon.maxDrive) problems.push(`從目前的出發地單程約 ${formatDrive(mins).value} ${formatDrive(mins).unit}，超過當初設定的 ${addon.maxDrive} 分鐘`);
  if (agesFit(spot, ctx.kids ?? []) === false) problems.push('孩子的年齡設定改了，不在這裡的建議年齡內');
  return problems;
}

/** 指定景點排時間（例如已經選好的這週計畫）。 */
export function timelineFor(
  spot: Spot,
  minsOf: MinsOf,
  ctx: Pick<RecommendContext, 'today' | 'kids'>,
  options: Pick<FamilyPlanOptions, 'slot' | 'napMode'>,
  nap: Nap,
  nowMins?: number,
): FamilyPlanResult {
  const r = buildTimeline({ spot, mins: minsOf(spot), slot: options.slot, napMode: options.napMode, nap, today: ctx.today, nowMins });
  return r.status === 'ok' ? { ...r, ageNote: ageNote(spot, ctx.kids ?? []) } : r;
}

// ---------- 儲存與對應 ----------

/** 從選好的條件做出要存的附加資料。 */
export function makeAddon(week: string, spotId: string, options: FamilyPlanOptions): FamilyPlanAddon {
  return { week, slot: options.slot, spotId, envMode: options.envMode, maxDrive: options.maxDrive, stroller: options.stroller, napMode: options.napMode };
}

/** 檢查存下來的附加資料；格式壞掉回傳 null（不影響其他資料）。 */
export function parseFamilyPlan(v: unknown): FamilyPlanAddon | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.week !== 'string' || !/^\d{4}-W\d{2}$/.test(o.week)) return null;
  if (typeof o.spotId !== 'string' || !/^spot-\d{3,}$/.test(o.spotId)) return null;
  if (!isSlot(o.slot)) return null;
  if (o.envMode !== 'indoor' && o.envMode !== 'any') return null;
  if (o.napMode !== 'home' && o.napMode !== 'car') return null;
  if (typeof o.maxDrive !== 'number' || !(FAMILY_DRIVE_OPTIONS as readonly number[]).includes(o.maxDrive)) return null;
  if (typeof o.stroller !== 'boolean') return null;
  return { week: o.week, slot: o.slot, spotId: o.spotId, envMode: o.envMode, napMode: o.napMode, maxDrive: o.maxDrive, stroller: o.stroller };
}

/** 附加資料還適不適用：要跟目前的這週計畫同一週、同時段、同一個景點（換了景點或改去雨備就失效）。 */
export function addonMatches(addon: FamilyPlanAddon | null | undefined, plan: WeekPlan | null | undefined): addon is FamilyPlanAddon {
  return !!addon && !!plan && addon.week === plan.week && addon.slot === plan.slot && addon.spotId === plan.spotId;
}

/**
 * 分享用的文字：不帶孩子名字、生日、出發地。
 * 連結打開只會看到景點（原本的行程連結），所以文字裡寫清楚時間表只在這則訊息裡。
 */
export function shareText(result: Extract<FamilyPlanResult, { status: 'ok' }>, whenLabel: string): string {
  const lines = result.steps.map((s) => `${clock(s.start)}${s.end !== undefined ? `–${clock(s.end)}` : ''} ${s.label}`);
  return [`${whenLabel}去${result.spot.name}`, ...lines, '（車程是粗估；時間表只在這則訊息，打開連結只會看到景點）'].join('\n');
}
