/** 「這週放電計畫」：週四選好的行程，留到週末還找得到，也可以傳給另一半。純函式。 */
import { isoWeek } from './recommend.ts';
import { type Slot, isSlot } from './weather.ts';

export const PLAN_PARAM = 'plan';

export interface WeekPlan {
  /** 這個行程屬於哪一週（ISO 週，例如 2026-W47）；過了那一週就不再顯示。 */
  week: string;
  /** 主行程的景點 id */
  spotId: string;
  /** 雨天備案的景點 id */
  backupId?: string;
  slot: Slot;
}

const SPOT_ID = /^spot-\d{3,}$/;
const WEEK = /^\d{4}-W\d{2}$/;

/** 檢查存下來或從連結解出來的行程；格式不對回傳 null。 */
export function parsePlan(v: unknown): WeekPlan | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.week !== 'string' || !WEEK.test(o.week)) return null;
  if (typeof o.spotId !== 'string' || !SPOT_ID.test(o.spotId)) return null;
  if (!isSlot(o.slot)) return null;
  const plan: WeekPlan = { week: o.week, spotId: o.spotId, slot: o.slot };
  if (typeof o.backupId === 'string' && SPOT_ID.test(o.backupId) && o.backupId !== o.spotId) plan.backupId = o.backupId;
  return plan;
}

/** 這個行程是不是這一週的（週一到週日算同一週）。 */
export function isCurrentPlan(plan: WeekPlan | null | undefined, today: string): plan is WeekPlan {
  return !!plan && plan.week === isoWeek(today);
}

export function makePlan(today: string, spotId: string, slot: Slot, backupId?: string | null): WeekPlan {
  const plan: WeekPlan = { week: isoWeek(today), spotId, slot };
  if (backupId && backupId !== spotId) plan.backupId = backupId;
  return plan;
}

/** 主行程和雨備對調（下雨時改去雨備）。沒有雨備就原樣回傳。 */
export function swapToBackup(plan: WeekPlan): WeekPlan {
  return plan.backupId ? { ...plan, spotId: plan.backupId, backupId: plan.spotId } : plan;
}

function toBase64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

/** 行程連結只帶：哪一週、時段、主行程 id、雨備 id。不帶任何個人資料。 */
export function encodePlan(plan: WeekPlan): string {
  return toBase64Url(JSON.stringify({ w: plan.week, t: plan.slot, s: plan.spotId, ...(plan.backupId ? { b: plan.backupId } : {}) }));
}

export function decodePlan(code: string): WeekPlan | null {
  try {
    const o = JSON.parse(fromBase64Url(code)) as Record<string, unknown>;
    return parsePlan({ week: o.w, slot: o.t, spotId: o.s, backupId: o.b });
  } catch {
    return null;
  }
}

export function buildPlanUrl(baseUrl: string, plan: WeekPlan): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PLAN_PARAM, encodePlan(plan));
  return url.toString();
}
