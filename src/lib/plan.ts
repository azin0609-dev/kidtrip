/** 午睡友善的出發時間（PRD 2-3）與出門清單。純函式。 */
import type { Spot } from '../data/schema.ts';
import { formatDrive } from './format.ts';

export interface Nap {
  /** HH:MM */
  start: string;
  end: string;
}

/** 單程超過這個分鐘數就建議住一晚（PRD 2-3）。 */
export const OVERNIGHT_MINS = 90;
/** 最早幾點出門（分鐘）：07:30。 */
const EARLIEST_LEAVE = 7 * 60 + 30;
/** 最早幾點到（分鐘）：09:00，多數景點 9–10 點才開。 */
const EARLIEST_ARRIVE = 9 * 60;
/** 至少要能玩多久才值得上午去（分鐘）。 */
const MIN_STAY = 75;

function toMins(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** 分鐘 → 「9:35」，四捨五入到 5 分鐘。 */
export function formatClock(mins: number): string {
  const r = Math.round(mins / 5) * 5;
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}

export interface NapPlan {
  kind: 'morning' | 'afternoon' | 'overnight';
  /** 給家長看的一句話 */
  text: string;
  /** 幾點出門（分鐘），住一晚時沒有 */
  leaveHome?: number;
  /** 幾點上車回家（分鐘） */
  leaveSpot?: number;
}

/**
 * 依車程、建議停留時間、午睡時段排時間：
 * - 單程超過 90 分 → 建議住一晚。
 * - 上午去：午睡開始時上車，回程在車上睡。出門時間 = 午睡開始 − 停留 − 車程，
 *   太早（07:30 前出門、或 09:00 前就到）就晚一點出門、少玩一點。
 * - 連少玩都不到 75 分鐘 → 改成午睡起來再出發。
 */
export function napPlan(driveMins: number, stayHours: number, nap: Nap): NapPlan | null {
  const napStart = toMins(nap.start);
  const napEnd = toMins(nap.end);
  if (napStart === null || napEnd === null || napEnd <= napStart || driveMins <= 0 || stayHours <= 0) return null;

  if (driveMins > OVERNIGHT_MINS) {
    const d = formatDrive(driveMins);
    return { kind: 'overnight', text: `單程約 ${d.value} ${d.unit}，當天來回小孩會太累，建議住一晚` };
  }

  const wantStay = stayHours * 60;
  const leaveHome = Math.max(EARLIEST_LEAVE, EARLIEST_ARRIVE - driveMins, napStart - wantStay - driveMins);
  const arrive = leaveHome + driveMins;
  const stay = napStart - arrive;

  if (stay >= MIN_STAY) {
    const shorter = stay < wantStay - 20;
    return {
      kind: 'morning',
      leaveHome,
      leaveSpot: napStart,
      text: `${formatClock(leaveHome)} 出門，${formatClock(arrive)} 到，玩到 ${formatClock(napStart)} 上車，回程剛好睡午覺${
        shorter ? '（時間比較趕，挑重點玩）' : ''
      }`,
    };
  }

  const leaveAfterNap = napEnd + 15;
  const arriveAfterNap = leaveAfterNap + driveMins;
  return {
    kind: 'afternoon',
    leaveHome: leaveAfterNap,
    leaveSpot: arriveAfterNap + Math.min(wantStay, 150),
    text: `上午去時間太趕，建議午睡起來 ${formatClock(leaveAfterNap)} 出門，${formatClock(arriveAfterNap)} 到，玩到傍晚`,
  };
}

/** 出門要帶什麼：依景點類型、室內外、推車、月份列出。固定項目排前面，不重複。 */
export function packingList(
  spot: Pick<Spot, 'types' | 'env' | 'stroller_ok' | 'facilities'>,
  month: number,
): string[] {
  const items = ['水壺', '濕紙巾', '替換衣物'];
  const add = (...xs: string[]) => {
    for (const x of xs) if (!items.includes(x)) items.push(x);
  };
  const outdoor = spot.env === 'out' || spot.env === 'mix';
  const hot = month >= 5 && month <= 10;
  const cold = month === 12 || month <= 2;

  if (spot.types.includes('water')) add('泳衣', '毛巾', '防滑拖鞋');
  if (spot.types.includes('park')) add('挖沙工具');
  if (spot.types.includes('farm') || spot.types.includes('zoo')) add('防蚊液', '乾洗手');
  if (spot.types.includes('indoorplay')) add('襪子（遊戲區通常要穿）');
  if (spot.env === 'in') add('薄外套（冷氣房）');
  if (outdoor && hot) add('帽子', '防曬乳', '防蚊液');
  if (outdoor && cold) add('保暖外套');
  if (outdoor) add('雨衣或折傘');
  if (!spot.stroller_ok) add('揹巾（推車不好推）');
  if (spot.facilities?.includes('picnic')) add('野餐墊');
  if (!spot.facilities?.includes('food')) add('小點心');
  return items;
}
