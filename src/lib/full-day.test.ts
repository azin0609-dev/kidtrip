import { describe, expect, it } from 'vitest';
import type { Restaurant, Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import { makeAddon, parseFamilyPlan } from './family-plan.ts';
import {
  type FullDayOptions,
  bestOrder,
  checkSavedDay,
  dayAddonMatches,
  dayShareText,
  defaultNapMode,
  lunchInfo,
  makeDayAddon,
  napWarning,
  parseDayPlan,
  planFullDay,
  planPair,
  planSingle,
  transferMins,
} from './full-day.ts';
import { validateSteps } from './family-plan.ts';
import type { RecommendContext } from './recommend.ts';
import { parseState } from './storage.ts';
import { decodePlan, encodePlan, makePlan } from './weekplan.ts';

const today = '2026-11-18'; // 週三
const nap = { start: '13:00', end: '15:00' };
const kids = [
  { name: '果果', age: 3 },
  { name: '核桃', age: 1 },
];

// 林口附近：A、B 各自離家都約 20 分，但兩地之間約 30 多分鐘
const A = makeSpot({ id: 'spot-301', name: '甲館', env: 'in', age_best: [1, 8], stroller_ok: true, lat: 25.07, lng: 121.39, mins_from_linkou: 20, stay_hours: 2 });
const B = makeSpot({ id: 'spot-302', name: '乙館', env: 'in', age_best: [1, 8], stroller_ok: true, lat: 24.96, lng: 121.22, mins_from_linkou: 20, stay_hours: 2 });
const NEAR = makeSpot({ id: 'spot-303', name: '丙館', env: 'in', age_best: [1, 8], stroller_ok: true, lat: 25.06, lng: 121.37, mins_from_linkou: 15 });
const AREA = makeSpot({ id: 'spot-304', name: '只知道鄉鎮', env: 'in', age_best: [1, 8], lat: 25.0, lng: 121.3, coord_area: true, mins_from_linkou: 20 });
const SEMI = makeSpot({ id: 'spot-305', name: '半室內', env: 'semi', age_best: [1, 8], lat: 25.05, lng: 121.36, mins_from_linkou: 15 });

function rec(over: Partial<RecommendContext> = {}): RecommendContext {
  return { today, minsOf: (s) => s.mins_from_linkou, fav: [], been: [], beenAt: {}, rainy: false, overnight: false, maxDrive: 120, kids, ...over };
}
const ctx = (over: Partial<RecommendContext> = {}) => {
  const r = rec(over);
  return { minsOf: r.minsOf, kids: r.kids, today: r.today, nap, restaurants: [] as Restaurant[] };
};
const opts = (over: Partial<FullDayOptions> = {}): FullDayOptions => ({
  day: 'sat',
  departAt: 9 * 60,
  latestHome: 18 * 60,
  style: 'explore',
  napMode: 'car',
  lunch: 'nearby',
  envMode: 'indoor',
  maxDrive: 45,
  stroller: true,
  ...over,
});

describe('景點之間的車程', () => {
  it('用兩地座標估算，不是拿各自從家裡出發的車程', () => {
    const t = transferMins(A, B)!;
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).not.toBe(A.mins_from_linkou + B.mins_from_linkou);
    expect(t).not.toBe(Math.abs(A.mins_from_linkou - B.mins_from_linkou));
  });
  it('任一邊座標只到鄉鎮（或沒有座標）：無法確認，不排雙景點', () => {
    expect(transferMins(A, AREA)).toBeNull();
    expect(transferMins(A, makeSpot({ lat: null, lng: null }))).toBeNull();
    const r = planPair(A, AREA, opts(), ctx());
    expect(r.status === 'fail' && r.reason).toContain('無法確認');
  });
  it('時間軸上標示是粗估', () => {
    const r = planPair(A, B, opts(), ctx());
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.transfer).toBe(transferMins(A, B));
    expect(r.steps.some((s) => s.label.includes('兩地座標粗估'))).toBe(true);
    expect(validateSteps(r.steps)).toBe(true);
    expect(r.homeAt).toBeLessThanOrEqual(18 * 60);
  });
});

describe('午睡', () => {
  it('車上睡：景點間車程太短睡不夠，不排雙景點', () => {
    const r = planPair(A, NEAR, opts({ napMode: 'car' }), ctx());
    expect(r.status === 'fail' && r.reason).toContain('車上睡不夠');
  });
  it('探索日排不出雙景點時，明講原因並改給單景點方案，不硬湊', () => {
    const r = planFullDay([A, NEAR], rec(), opts({ napMode: 'car' }), nap, [], 's');
    expect(r.fallbackReason).toContain('排不出合理的雙景點');
    expect(r.plans.length).toBeGreaterThan(0);
    expect(r.plans.every((p) => p.spots.length === 1 && p.style === 'easy')).toBe(true);
  });
  it('推車上睡：景點推車不好推就不行', () => {
    const bumpy = makeSpot({ ...A, id: 'spot-310', stroller_ok: false });
    expect(planSingle(bumpy, opts({ style: 'easy', napMode: 'stroller' }), ctx()).status).toBe('fail');
    expect(planSingle(A, opts({ style: 'easy', napMode: 'stroller' }), ctx()).status).toBe('ok');
  });
  it('有 3 歲以下：預設要睡；選不睡會提醒；孩子都大了才預設不睡', () => {
    expect(defaultNapMode(kids, true)).toBe('stroller');
    expect(defaultNapMode(kids, false)).toBe('car');
    expect(defaultNapMode([], true)).toBe('stroller');
    expect(defaultNapMode([{ name: '', age: 5 }], true)).toBe('none');
    expect(napWarning({ napMode: 'none' }, kids)).toContain('3 歲以下');
    expect(napWarning({ napMode: 'none' }, [{ name: '', age: 5 }])).toBeNull();
    expect(napWarning({ napMode: 'stroller' }, kids)).toBeNull();
  });
  it('午睡前玩不到 75 分鐘（出門太晚）：排不出來', () => {
    expect(planSingle(A, opts({ style: 'easy', departAt: 10 * 60 + 45, napMode: 'stroller' }), ctx()).status).toBe('fail');
  });
});

describe('營業時間與休館', () => {
  it('資料寫那天休館：不排', () => {
    const closed = makeSpot({ ...A, id: 'spot-320', open_note: '09:00–17:00，週六休館' });
    expect(planSingle(closed, opts({ style: 'easy' }), ctx()).status).toBe('fail');
    expect(planPair(closed, B, opts(), ctx()).status).toBe('fail');
    expect(planSingle(closed, opts({ style: 'easy', day: 'sun' }), ctx()).status).toBe('ok');
  });
  it('第二個地方到的時候還沒開：換順序，先去早開門的', () => {
    const late = makeSpot({ ...B, open_note: '平日 13:00–20:00，週末 13:00–20:00' });
    const r = bestOrder(late, A, opts({ napMode: 'none' }), ctx());
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.spots[0]!.spot.id).toBe('spot-301');
  });
  it('第一個地方 10 點才開：出門時間往後調，並說明', () => {
    const tenAm = makeSpot({ ...A, open_note: '10:00–18:00' });
    const r = planSingle(tenAm, opts({ style: 'easy', departAt: 8 * 60 + 30 }), ctx());
    expect(r.status === 'ok' && r.leaveHome).toBe(10 * 60 - 30);
    expect(r.status === 'ok' && r.notes.join()).toContain('建議 9:30 再出門');
  });
  it('會晚於最晚到家時間：排不出來', () => {
    const far = makeSpot({ ...A, mins_from_linkou: 45 });
    const r = planSingle(far, opts({ style: 'easy', napMode: 'car', latestHome: 13 * 60 + 30 }), ctx());
    expect(r.status === 'fail' && r.reason).toContain('才到家');
  });
});

describe('雨天完全室內', () => {
  it('兩個景點都要是完全室內，半室內不混入', () => {
    const r = planFullDay([A, B, SEMI], rec({ rainy: true }), opts(), nap, [], 's');
    expect(r.candidates.every((c) => c.spot.env === 'in')).toBe(true);
    expect(r.plans.every((p) => p.spots.every((s) => s.spot.env === 'in'))).toBe(true);
  });
  it('不適合孩子年齡的不會為了湊雙景點加進來', () => {
    const older = makeSpot({ ...B, id: 'spot-330', age_best: [8, 12] });
    const r = planFullDay([A, older], rec(), opts(), nap, [], 's');
    expect(r.candidates.map((c) => c.spot.id)).toEqual(['spot-301']);
    expect(r.fallbackReason).toContain('不到兩個');
  });
});

describe('午餐', () => {
  const near = (o: Partial<Restaurant>): Restaurant =>
    ({ id: 'food-901', name: '親子餐廳', city: '新北市林口區', region: '北', cuisine: '簡餐', price_tier: '$$', tags: [], mins_from_linkou: 10, tip: 'x', near_spot_ids: ['spot-301'], lat: null, lng: null, google_place_id: null, needs_verify: [], last_verified: '2026-11-18', ...o }) as Restaurant;
  it('餐廳資料不足：只列參考，標「還沒確認」，不會當成可用', () => {
    const info = lunchInfo(A, 'nearby', [near({})]);
    expect(info.refs[0]!.status).toBe('unconfirmed');
    expect(info.text).toContain('都還沒確認當天可以用');
  });
  it('查過營業中的餐廳：也只說查過還在營業，營業時間和座位仍要確認', () => {
    const info = lunchInfo(A, 'nearby', [near({ verified: { date: '2026-11-18', fields: ['營業中'], source: 'google_maps' } })]);
    expect(info.refs[0]!.status).toBe('checked-open');
    expect(info.refs[0]!.note).toContain('座位');
  });
  it('有疑問的餐廳不列；附近沒有整理好的餐廳就請自己找', () => {
    expect(lunchInfo(A, 'nearby', [near({ risk_flags: ['status_conflict'] })]).refs).toEqual([]);
    expect(lunchInfo(A, 'nearby', []).text).toContain('要自己找');
    expect(lunchInfo(A, 'packed', []).text).toContain('自備');
  });
});

describe('輕鬆玩方案', () => {
  it('推車上睡：上午玩、午餐、推車上睡、睡醒再玩、回家', () => {
    const big = makeSpot({ ...A, stay_hours: 4 });
    const r = planSingle(big, opts({ style: 'easy', napMode: 'stroller' }), ctx());
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.steps.map((s) => s.kind)).toEqual(['leave', 'drive', 'park', 'play', 'lunch', 'nap', 'play', 'drive', 'home']);
    expect(validateSteps(r.steps)).toBe(true);
  });
  it('一整天待同一個地方：下午最多 2 小時，合計不超過建議停留＋1 小時，不夠就睡醒回家', () => {
    const r = planSingle(A, opts({ style: 'easy', napMode: 'stroller' }), ctx()); // 建議停留 2 小時，上午已玩 165 分
    expect(r.status === 'ok' && r.steps.map((s) => s.kind)).toEqual(['leave', 'drive', 'park', 'play', 'lunch', 'nap', 'drive', 'home']);
    expect(r.status === 'ok' && r.notes.join()).toContain('睡醒就回家');
    const noStay = makeSpot({ ...A, stay_hours: undefined });
    const r2 = planSingle(noStay, opts({ style: 'easy', napMode: 'stroller' }), ctx());
    const afternoon = r2.status === 'ok' ? r2.steps.filter((s) => s.kind === 'play')[1]! : null;
    expect(afternoon && afternoon.end! - afternoon.start).toBeLessThanOrEqual(120);
  });
  it('不睡（孩子都 3 歲以上）：11:30 以後吃午餐，休息後下午再玩', () => {
    const r = planSingle(A, opts({ style: 'easy', napMode: 'none' }), { ...ctx(), kids: [{ name: '', age: 5 }] });
    expect(r.status === 'ok' && r.steps.find((s) => s.kind === 'lunch')!.start).toBeGreaterThanOrEqual(11 * 60 + 30);
  });
});

describe('儲存與相容', () => {
  const plan = makePlan(today, 'spot-301', 'sat-am');
  it('全日行程有版本號，存在 dayPlan，跟 WeekPlan 對應', () => {
    const r = planPair(A, B, opts(), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const addon = makeDayAddon(plan.week, r, opts());
    expect(addon.v).toBe(1);
    expect(parseDayPlan(addon)).toEqual(addon);
    expect(dayAddonMatches(addon, plan)).toBe(true);
    expect(dayAddonMatches(addon, makePlan(today, 'spot-302', 'sat-am'))).toBe(false);
  });
  it('看不懂的版本、壞掉的格式：只丟掉 dayPlan，其他資料和舊版 familyPlan 不受影響', () => {
    const half = makeAddon(plan.week, 'spot-301', { slot: 'sat-am', envMode: 'indoor', maxDrive: 45, stroller: true, napMode: 'home' });
    const raw = { fav: ['spot-017'], been: ['spot-092'], ratings: { 'spot-092': { stars: 5, tags: [] } }, plan, familyPlan: half, dayPlan: { v: 2, week: plan.week } };
    const s = parseState(JSON.stringify(raw));
    expect(s.dayPlan).toBeUndefined();
    expect(s.familyPlan).toEqual(half);
    expect(parseFamilyPlan(half)).toEqual(half);
    expect(s.fav).toEqual(['spot-017']);
    expect(s.been).toEqual(['spot-092']);
    expect(s.ratings).toEqual(raw.ratings);
    expect(s.plan).toEqual(plan);
    expect(parseDayPlan({ v: 1, week: plan.week, slot: 'sat-am', spotId: 'spot-301', style: 'explore' })).toBeNull(); // 探索日一定要有第二個景點
  });
  it('WeekPlan 分享格式不變', () => {
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });
  it('已保存後出發地改了、第二個景點超過車程上限：要重新安排', () => {
    const r = planPair(A, B, opts(), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const addon = makeDayAddon(plan.week, r, opts());
    expect(checkSavedDay(addon, [A, B], rec(), nap, []).status).toBe('ok');
    const moved = checkSavedDay(addon, [A, B], rec({ minsOf: (s) => (s.id === 'spot-302' ? 70 : 20) }), nap, []);
    expect(moved.status === 'fail' && moved.reason).toContain('乙館');
  });
  it('分享文字不帶孩子名字和出發地', () => {
    const r = planPair(A, B, opts(), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const text = dayShareText(r, '週六 11/21');
    expect(text).toContain('甲館 → 乙館');
    expect(text).not.toContain('果果');
    expect(text).not.toContain('林口');
  });
});

describe('其他', () => {
  it('同樣條件結果一樣', () => {
    const list: Spot[] = [A, B, NEAR];
    const a = planFullDay(list, rec(), opts(), nap, [], 's').plans.map((p) => p.spots.map((s) => s.spot.id).join('+'));
    const b = planFullDay(list, rec(), opts(), nap, [], 's').plans.map((p) => p.spots.map((s) => s.spot.id).join('+'));
    expect(a).toEqual(b);
  });
});
