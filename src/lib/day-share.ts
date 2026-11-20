/**
 * 全日遊分享連結（版本化）：另一半打開就看得到兩個景點和行程條件，不是只有第一站。
 *
 * 網址同時帶舊的 `?plan=`（WeekPlan，格式不變）和新的 `?day=`：
 * - 舊版 App 只認得 `plan`，照樣看得到第一站；
 * - 新版看到 `day` 而且跟 `plan` 對得上，就顯示整份全日行程。
 *
 * `day` 只帶 DayPlanAddon 的欄位（哪一週、時段、景點 id、條件），不帶孩子名字、生日、出發地或住址。
 * 純函式。
 */
import { type DayPlanAddon, dayAddonMatches, parseDayPlan } from './full-day.ts';
import { PLAN_PARAM, type WeekPlan, decodePlan, encodePlan } from './weekplan.ts';

export const DAY_PARAM = 'day';
/** 分享連結的格式版本；看不懂的版本就當成沒有 `day`，只用 `plan`。 */
export const DAY_SHARE_VERSION = 1;

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

/** 全日行程 → `day` 參數。短鍵名讓網址短一點。 */
export function encodeDayShare(addon: DayPlanAddon): string {
  return toBase64Url(
    JSON.stringify({
      v: DAY_SHARE_VERSION,
      w: addon.week,
      t: addon.slot,
      s: addon.spotId,
      ...(addon.secondId ? { s2: addon.secondId } : {}),
      y: addon.style,
      d: addon.departAt,
      h: addon.latestHome,
      n: addon.napMode,
      l: addon.lunch,
      e: addon.envMode,
      m: addon.maxDrive,
      r: addon.stroller ? 1 : 0,
    }),
  );
}

/** `day` 參數 → 全日行程；版本不對、格式壞掉都回傳 null。 */
export function decodeDayShare(code: string): DayPlanAddon | null {
  try {
    const o = JSON.parse(fromBase64Url(code)) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || o.v !== DAY_SHARE_VERSION) return null;
    if (o.r !== 0 && o.r !== 1) return null;
    return parseDayPlan({
      v: 1,
      week: o.w,
      slot: o.t,
      spotId: o.s,
      secondId: o.s2,
      style: o.y,
      departAt: o.d,
      latestHome: o.h,
      napMode: o.n,
      lunch: o.l,
      envMode: o.e,
      maxDrive: o.m,
      stroller: o.r === 1,
    });
  } catch {
    return null;
  }
}

/** 全日遊分享網址：`plan`（舊格式，相容舊版）＋ `day`（完整行程）。 */
export function buildDayShareUrl(baseUrl: string, plan: WeekPlan, addon: DayPlanAddon): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PLAN_PARAM, encodePlan(plan));
  url.searchParams.set(DAY_PARAM, encodeDayShare(addon));
  return url.toString();
}

/**
 * 讀網址上的行程參數。
 * - 只有 `plan`（舊連結）：照舊，day 是 null。
 * - `plan` 和 `day` 都有、而且是同一份行程：兩個都回傳。
 * - `day` 跟 `plan` 對不上：不信 `day`，只用 `plan`。
 * - 只有 `day`：從 `day` 補出 WeekPlan（沒有雨備）。
 */
export function readShareParams(search: string): { plan: WeekPlan | null; day: DayPlanAddon | null } {
  const params = new URLSearchParams(search);
  const planCode = params.get(PLAN_PARAM);
  const dayCode = params.get(DAY_PARAM);
  const plan = planCode ? decodePlan(planCode) : null;
  const day = dayCode ? decodeDayShare(dayCode) : null;
  if (!day) return { plan, day: null };
  if (plan) return dayAddonMatches(day, plan) ? { plan, day } : { plan, day: null };
  return { plan: { week: day.week, spotId: day.spotId, slot: day.slot }, day };
}
