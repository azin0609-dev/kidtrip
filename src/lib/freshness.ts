/** 資料新鮮度：多久沒確認營業就提醒、太舊就不推薦（docs/ROADMAP.md 1-2）。純函式。 */
import { daysBetween } from './date.ts';

export type FreshKind = 'spot' | 'hotel' | 'bnb' | 'food';

/** 幾天沒確認就算「有點舊了」。餐廳、民宿開關快，期限比較短。 */
export const STALE_DAYS: Record<FreshKind, number> = {
  food: 90,
  bnb: 90,
  hotel: 180,
  spot: 180,
};

export type Freshness = 'fresh' | 'stale' | 'expired';

interface Checkable {
  last_verified: string;
  verified?: { date: string };
}

/** 最後一次確認的日期：有逐筆查證紀錄就用查證日期，否則用整理日期。 */
export function lastChecked(item: Checkable): string {
  const v = item.verified?.date;
  return v && v > item.last_verified ? v : item.last_verified;
}

/** fresh：期限內；stale：超過期限，提醒出發前確認；expired：超過兩倍期限，不再推薦。 */
export function freshness(item: Checkable, kind: FreshKind, today: string): Freshness {
  const days = daysBetween(lastChecked(item), today);
  const limit = STALE_DAYS[kind];
  if (days > limit * 2) return 'expired';
  if (days > limit) return 'stale';
  return 'fresh';
}

/** 卡片上的提醒；fresh 時回傳 null。 */
export function freshnessNote(item: Checkable, kind: FreshKind, today: string): string | null {
  const f = freshness(item, kind, today);
  if (f === 'fresh') return null;
  const date = lastChecked(item);
  return f === 'expired'
    ? `這筆資料 ${date} 之後就沒再確認過，可能已經改變，請先查官方資訊或 Google 地圖。`
    : `這筆資料是 ${date} 確認的，有點舊了，出發前先確認一下。`;
}
