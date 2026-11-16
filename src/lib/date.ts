import type { Spot } from '../data/schema.ts';

/** 21 天內要熄燈就顯示 badge。 */
export const CLOSING_SOON_DAYS = 21;

const taipeiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 以 Asia/Taipei 時區取得「今天」，格式 YYYY-MM-DD。 */
export function todayInTaipei(now: Date = new Date()): string {
  return taipeiFormatter.format(now);
}

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** from 到 to 相差幾天（to 較晚為正數）。 */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** 2026-11-24 → 11/24 */
export function formatMonthDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return `${m}/${d}`;
}

export interface SpotDateStatus {
  /** closes_on 已過，不顯示。 */
  closed: boolean;
  /** opens_on 還沒到，抽籤時排除。 */
  notYetOpen: boolean;
  /** 21 天內熄燈。 */
  closingSoon: boolean;
}

type DatedSpot = Pick<Spot, 'opens_on' | 'closes_on'>;

export function spotDateStatus(spot: DatedSpot, today: string): SpotDateStatus {
  const closed = spot.closes_on !== undefined && spot.closes_on < today;
  const notYetOpen = spot.opens_on !== undefined && spot.opens_on > today;
  const closingSoon =
    !closed && spot.closes_on !== undefined && daysBetween(today, spot.closes_on) <= CLOSING_SOON_DAYS;
  return { closed, notYetOpen, closingSoon };
}

export function isSpotVisible(spot: DatedSpot, today: string): boolean {
  return !spotDateStatus(spot, today).closed;
}

export interface DisplayBadge {
  kind: 'new' | 'end';
  label: string;
}

/**
 * 卡片上要顯示的 badge。
 * - opens_on 還沒到 → 「X/X 開幕」
 * - closes_on 在 21 天內 → 「X/X 熄燈」
 * - 資料裡的 badge：同類型已經由日期算出就不重複；end 類有 closes_on 但還不到 21 天就不顯示；
 *   其他情況照資料顯示。
 */
export function spotBadges(spot: DatedSpot & Pick<Spot, 'badge'>, today: string): DisplayBadge[] {
  const status = spotDateStatus(spot, today);
  const badges: DisplayBadge[] = [];
  if (status.notYetOpen && spot.opens_on) {
    badges.push({ kind: 'new', label: `${formatMonthDay(spot.opens_on)} 開幕` });
  }
  if (status.closingSoon && spot.closes_on) {
    badges.push({ kind: 'end', label: `${formatMonthDay(spot.closes_on)} 熄燈` });
  }
  const data = spot.badge;
  if (data && !badges.some((b) => b.kind === data.kind)) {
    const hiddenEnd = data.kind === 'end' && spot.closes_on !== undefined;
    if (!hiddenEnd) badges.push({ kind: data.kind, label: data.label });
  }
  return badges;
}
