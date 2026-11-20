import { describe, expect, it } from 'vitest';
import type { Restaurant, Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import { makeAddon, parseFamilyPlan } from './family-plan.ts';
import {
  type FullDayOptions,
  bestOrder,
  checkSavedDay,
  dayAddonMatches,
  dayPlanHeading,
  dayShareText,
  defaultNapMode,
  LUNCH_MOVE,
  lunchInfo,
  lunchWhere,
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

// 林口附近：A、B 各自離家都約 20 分，但兩地之間約 30 多分鐘。
// 兩館資料都標示裡面有賣吃的（場內午餐）；場外、地點不明的情境另外測。
const A = makeSpot({ id: 'spot-301', name: '甲館', env: 'in', age_best: [1, 8], stroller_ok: true, lat: 25.07, lng: 121.39, mins_from_linkou: 20, stay_hours: 2, facilities: ['food'] });
const B = makeSpot({ id: 'spot-302', name: '乙館', env: 'in', age_best: [1, 8], stroller_ok: true, lat: 24.96, lng: 121.22, mins_from_linkou: 20, stay_hours: 2, facilities: ['food'] });
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

// ---------- v1.2 最後一輪品質修正 ----------

const t = (h: number, m = 0) => h * 60 + m;
const bigKids = { ...ctx(), kids: [{ name: '', age: 5 }] };

describe('品質修正：全日遊用實際出遊那天判斷開幕、熄燈', () => {
  const opensSun = makeSpot({ ...A, id: 'spot-331', name: '週日開幕', opens_on: '2026-11-22' });
  const closesSat = makeSpot({ ...A, id: 'spot-332', name: '週六最後一天', closes_on: '2026-11-21' });
  const ids = (day: 'sat' | 'sun') =>
    planFullDay([opensSun, closesSat], rec(), opts({ style: 'easy', day }), nap, [], 's').candidates.map((c) => c.spot.id).sort();
  it('今天是週三：週六只排已開幕、還沒熄燈的；週日換成新開幕的', () => {
    expect(ids('sat')).toEqual(['spot-332']);
    expect(ids('sun')).toEqual(['spot-331']);
  });
  it('已保存的行程也用那天判斷', () => {
    const r = planSingle(opensSun, opts({ style: 'easy', day: 'sun' }), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const addon = makeDayAddon('2026-W47', r, opts({ style: 'easy', day: 'sun' }));
    expect(checkSavedDay(addon, [opensSun], rec(), nap, []).status).toBe('ok');
    const satAddon = { ...addon, slot: 'sat-am' as const };
    const sat = checkSavedDay(satAddon, [opensSun], rec(), nap, []);
    expect(sat.status === 'fail' && sat.reason).toContain('還沒開幕');
  });
});

describe('品質修正：景點提早關門，不把午餐、休息排在關門後的景點裡', () => {
  const early = makeSpot({ ...A, id: 'spot-340', name: '早關館', open_note: '09:00–11:30' });

  /** 關門後還待在景點裡的步驟（玩、在景點吃、在景點休息、推車上睡） */
  const insideAfterClose = (steps: readonly { kind: string; start: number; end?: number; label: string }[], close: number) =>
    steps.filter((s) => (s.end ?? s.start) > close && s.kind !== 'transfer' && s.kind !== 'drive' && (s.label.includes('早關館') || s.kind === 'play' && !s.label.includes('乙館')));

  it('11:30 關門、不睡午覺、自備午餐：玩到 11:30 離場，移動後找地方吃，不再回去', () => {
    const r = planSingle(early, opts({ style: 'easy', napMode: 'none', lunch: 'packed' }), bigKids);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(validateSteps(r.steps)).toBe(true);
    expect(r.steps.map((s) => s.kind)).toEqual(['leave', 'drive', 'park', 'play', 'transfer', 'lunch', 'rest', 'drive', 'home']);
    const play = r.steps.find((s) => s.kind === 'play')!;
    const move = r.steps.find((s) => s.kind === 'transfer')!;
    const lunch = r.steps.find((s) => s.kind === 'lunch')!;
    expect(play.start).toBe(t(9, 30));
    expect(play.end).toBe(t(11, 30));
    expect(move.start).toBe(t(11, 30));
    expect(move.label).toContain('離場');
    expect(move.end! - move.start).toBeGreaterThan(0);
    expect(lunch.start).toBe(move.end);
    expect(lunch.start).toBeGreaterThan(t(11, 30));
    expect(lunch.label).toContain('自備');
    expect(lunch.label).toContain('地點要自己確認');
    expect(insideAfterClose(r.steps, t(11, 30))).toEqual([]);
    expect(r.steps.filter((s) => s.kind === 'play')).toHaveLength(1); // 下午不回去
    expect(r.endsEarly).toBe(true);
    expect(r.earlyReason).toContain('11:30');
  });
  it('關門時間在飯後休息中間（12:30 關）也一樣先離場', () => {
    const r = planSingle(makeSpot({ ...early, open_note: '09:00–12:20' }), opts({ style: 'easy', napMode: 'none' }), bigKids);
    if (r.status !== 'ok') throw new Error('should be ok');
    expect(r.steps.some((s) => s.kind === 'transfer')).toBe(true);
    expect(insideAfterClose(r.steps, t(12, 20))).toEqual([]);
  });
  it('關門前玩不到最少時間：排不出來，不硬湊', () => {
    const r = planSingle(makeSpot({ ...early, open_note: '09:00–10:15' }), opts({ style: 'easy', napMode: 'none' }), bigKids);
    expect(r.status === 'fail' && r.reason).toContain('關門');
  });
  it('車上睡、12:00 關門：關門前離場吃飯，午睡前吃完再上車', () => {
    const r = planSingle(makeSpot({ ...early, open_note: '09:00–12:00' }), opts({ style: 'easy', napMode: 'car' }), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    expect(validateSteps(r.steps)).toBe(true);
    // 吃飯地點不知道：移動先抓 20 分，要在 13:00 午睡前吃完，所以 11:55 就離場（比關門早）。
    expect(r.steps.find((s) => s.kind === 'play')!.end).toBe(t(11, 55));
    expect(r.steps.find((s) => s.kind === 'transfer')!.start).toBe(t(11, 55));
    expect(r.steps.find((s) => s.kind === 'lunch')!.end).toBeLessThanOrEqual(t(13));
    expect(r.steps.find((s) => s.kind === 'nap')!.start).toBe(t(13));
    expect(insideAfterClose(r.steps, t(12))).toEqual([]);
  });
  it('推車上睡但景點午睡前就關門：排不出來', () => {
    const r = planSingle(makeSpot({ ...early, open_note: '09:00–12:00' }), opts({ style: 'easy', napMode: 'stroller' }), ctx());
    expect(r.status === 'fail' && r.reason).toContain('關門');
  });
  it('雙景點：第一站 11:30 關門，先離場去吃，吃完再開去第二站', () => {
    const r = planPair(early, B, opts({ napMode: 'none', lunch: 'packed' }), bigKids);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(validateSteps(r.steps)).toBe(true);
    const kinds = r.steps.map((s) => s.kind);
    expect(kinds.slice(0, 7)).toEqual(['leave', 'drive', 'park', 'play', 'transfer', 'lunch', 'transfer']);
    expect(r.steps[3]!.end).toBe(t(11, 30));
    expect(r.steps[4]!.label).toContain('離場');
    expect(insideAfterClose(r.steps, t(11, 30))).toEqual([]);
    expect(r.notes.join()).toContain('吃飯的地方如果比較遠');
  });
  it('沒有提早關門時，原本的安排不變', () => {
    const r = planSingle(A, opts({ style: 'easy', napMode: 'none' }), bigKids);
    expect(r.status === 'ok' && r.steps.some((s) => s.kind === 'transfer')).toBe(false);
    const p = planPair(A, B, opts({ napMode: 'none' }), bigKids);
    expect(p.status === 'ok' && p.steps.filter((s) => s.kind === 'transfer')).toHaveLength(1);
  });
});

describe('品質修正：雨天「景點都在室內」不保證午餐和午睡環境', () => {
  it('選室內時明講只確認景點本身，午餐、午睡、停車到入口都還沒確認', () => {
    const r = planPair(A, B, opts({ envMode: 'indoor' }), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const note = r.notes.find((n) => n.includes('雨天'))!;
    expect(note).toContain('只確認兩個景點本身是室內');
    expect(note).toContain('午餐地點');
    expect(note).toContain('午睡');
    expect(note).toContain('還沒確認');
    const single = planSingle(A, opts({ style: 'easy', envMode: 'indoor', napMode: 'stroller' }), ctx());
    expect(single.status === 'ok' && single.notes.join()).toContain('只確認景點本身是室內');
  });
  it('室內外都可以時不加這段', () => {
    const r = planPair(A, B, opts({ envMode: 'any' }), ctx());
    expect(r.status === 'ok' && r.notes.some((n) => n.includes('雨天提醒'))).toBe(false);
  });
});

describe('品質修正：車上睡的單景點全日遊是提前結束', () => {
  it('午睡時直接回家：標成提前結束，寫出幾點到家，分享文字也講', () => {
    const r = planSingle(A, opts({ style: 'easy', napMode: 'car' }), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    expect(r.endsEarly).toBe(true);
    expect(r.homeAt).toBe(t(13, 20));
    expect(r.earlyReason).toContain('午睡時就上車回家');
    expect(r.earlyReason).toContain('13:20');
    expect(r.steps.find((s) => s.kind === 'nap')!.label).toContain('提前結束');
    expect(dayShareText(r, '週六 11/21')).toContain('提前結束：約 13:20 就到家');
  });
  it('睡醒還有下午行程、雙景點：不是提前結束', () => {
    const big = makeSpot({ ...A, stay_hours: 4 });
    const r = planSingle(big, opts({ style: 'easy', napMode: 'stroller' }), ctx());
    expect(r.status === 'ok' && r.endsEarly).toBe(false);
    const p = planPair(A, B, opts(), ctx());
    expect(p.status === 'ok' && p.endsEarly).toBe(false);
    expect(p.status === 'ok' && dayShareText(p, '週六 11/21')).not.toContain('提前結束');
  });
  it('推車上睡、睡醒就回家：也標成提前結束', () => {
    const r = planSingle(A, opts({ style: 'easy', napMode: 'stroller' }), ctx());
    expect(r.status === 'ok' && r.endsEarly).toBe(true);
  });
});

describe('品質修正：首頁計畫卡片跟全日遊一致', () => {
  const byId = new Map([A, B].map((s) => [s.id, s]));
  it('雙景點：日期不分上午下午、標全日遊、帶出第二站；WeekPlan 格式不變', () => {
    const r = planPair(A, B, opts(), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const plan = makePlan(today, 'spot-301', 'sat-am');
    const addon = makeDayAddon(plan.week, r, opts());
    const h = dayPlanHeading(addon, today, byId)!;
    expect(h.when).toBe('週六 11/21・全日遊');
    expect(h.first.id).toBe('spot-301');
    expect(h.second?.id).toBe('spot-302');
    expect(Object.keys(plan).sort()).toEqual(['slot', 'spotId', 'week']);
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });
  it('單景點週日：只有一站', () => {
    const r = planSingle(A, opts({ style: 'easy', day: 'sun' }), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    const h = dayPlanHeading(makeDayAddon('2026-W47', r, opts({ style: 'easy', day: 'sun' })), today, byId)!;
    expect(h.when).toBe('週日 11/22・全日遊');
    expect(h.second).toBeNull();
  });
  it('第二站已經不在資料裡：不顯示全日遊標題（回到原本的卡片）', () => {
    const r = planPair(A, B, opts(), ctx());
    if (r.status !== 'ok') throw new Error('should be ok');
    expect(dayPlanHeading(makeDayAddon('2026-W47', r, opts()), today, new Map([[A.id, A]]))).toBeNull();
  });
});

// ---------- v1.2.2：午餐地點、移動時間與重新入場 ----------

describe('v1.2.2：午餐在場內、場外或地點不明', () => {
  const food = (o: Partial<Restaurant> = {}): Restaurant =>
    ({ id: 'food-951', name: '附近餐廳', city: '新北市林口區', region: '北', cuisine: '簡餐', price_tier: '$$', tags: [], mins_from_linkou: 10, tip: 'x', near_spot_ids: ['spot-350', 'spot-351'], lat: null, lng: null, google_place_id: null, needs_verify: [], last_verified: '2026-11-18', ...o }) as Restaurant;
  // 要門票、裡面沒賣吃的
  const PAID = makeSpot({ ...A, id: 'spot-350', name: '丁館', facilities: [], cost_tier: '$', stay_hours: 4 });
  // 免費、裡面沒賣吃的
  const FREE = makeSpot({ ...A, id: 'spot-351', name: '戊公園', facilities: [], cost_tier: 'free', stay_hours: 4 });
  const withFood = (over: Partial<RecommendContext> = {}) => ({ ...ctx(over), restaurants: [food()] });
  const kinds = (steps: readonly { kind: string }[]) => steps.map((s) => s.kind);
  /** 每一步都接在前一步後面，沒有重疊 */
  const noOverlap = (steps: readonly { start: number; end?: number }[]) => steps.every((s, i) => i === 0 || s.start >= (steps[i - 1]!.end ?? steps[i - 1]!.start));

  it('判斷午餐地點：有賣吃的＝場內；只有附近餐廳＝場外；都沒有＝不知道；自備看能不能帶便當', () => {
    expect(lunchWhere(A, 'nearby', [])).toBe('inside');
    expect(lunchWhere(PAID, 'nearby', [food()])).toBe('outside');
    expect(lunchWhere(PAID, 'nearby', [])).toBe('unknown');
    expect(lunchWhere(PAID, 'nearby', [food({ risk_flags: ['status_conflict'] })])).toBe('unknown');
    expect(lunchWhere(makeSpot({ ...PAID, facilities: ['picnic'] }), 'packed', [])).toBe('inside');
    expect(lunchWhere(A, 'packed', [])).toBe('unknown');
    expect(lunchInfo(A, 'nearby', []).where).toBe('inside');
  });

  it('場外吃、要門票、下午還要回去：預留離場和回場時間，標示重新入場要先問，列為待確認草案', () => {
    const r = planSingle(PAID, opts({ style: 'easy', napMode: 'none' }), { ...withFood(), kids: [{ name: '', age: 5 }] });
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(validateSteps(r.steps) && noOverlap(r.steps)).toBe(true);
    expect(kinds(r.steps)).toEqual(['leave', 'drive', 'park', 'play', 'transfer', 'lunch', 'rest', 'transfer', 'play', 'drive', 'home']);
    const [out, back] = r.steps.filter((s) => s.kind === 'transfer');
    const lunch = r.steps.find((s) => s.kind === 'lunch')!;
    const afternoon = r.steps.filter((s) => s.kind === 'play')[1]!;
    expect(out!.end! - out!.start).toBe(LUNCH_MOVE.outside);
    expect(lunch.start).toBe(out!.end);
    expect(back!.end! - back!.start).toBe(LUNCH_MOVE.outside);
    expect(afternoon.start).toBe(back!.end); // 回到場內之後才開始玩
    expect(back!.label).toContain('重新入場');
    expect(out!.label).toContain('先預留');
    expect(r.draft).toBe(true);
    expect(r.draftReasons.join()).toContain('能不能再進來');
    expect(r.notes.join()).toContain('距離沒有資料');
  });

  it('場外吃、免費的地方：一樣預留移動時間，但不用問重新入場', () => {
    const r = planSingle(FREE, opts({ style: 'easy', napMode: 'none' }), { ...withFood(), kids: [{ name: '', age: 5 }] });
    if (r.status !== 'ok') throw new Error(r.reason);
    const back = r.steps.filter((s) => s.kind === 'transfer')[1]!;
    expect(back.label).not.toContain('重新入場');
    expect(r.draft).toBe(false);
  });

  it('地點不知道：移動抓 20 分，標成待確認草案', () => {
    const r = planSingle(PAID, opts({ style: 'easy', napMode: 'car' }), ctx());
    if (r.status !== 'ok') throw new Error(r.reason);
    const out = r.steps.find((s) => s.kind === 'transfer')!;
    expect(out.end! - out.start).toBe(LUNCH_MOVE.unknown);
    expect(r.draft).toBe(true);
    expect(r.draftReasons.join()).toContain('午餐地點還沒確認');
    expect(r.lunch.text).toContain('要自己找');
    expect(dayShareText(r, '週六 11/21')).toContain('待確認');
  });

  it('車上睡：出場吃完直接上車，不排回場；午睡前吃完', () => {
    const r = planSingle(PAID, opts({ style: 'easy', napMode: 'car' }), withFood());
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(noOverlap(r.steps)).toBe(true);
    expect(r.steps.filter((s) => s.kind === 'transfer')).toHaveLength(1);
    expect(r.steps.find((s) => s.kind === 'lunch')!.end).toBeLessThanOrEqual(t(13));
    expect(r.steps.find((s) => s.kind === 'nap')!.start).toBe(t(13));
    expect(r.draftReasons.join()).not.toContain('能不能再進來');
  });

  it('推車上睡：吃完要先回到場內，回場結束不晚於午睡開始', () => {
    const r = planSingle(PAID, opts({ style: 'easy', napMode: 'stroller' }), withFood());
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(validateSteps(r.steps) && noOverlap(r.steps)).toBe(true);
    const back = r.steps.filter((s) => s.kind === 'transfer')[1]!;
    const napStep = r.steps.find((s) => s.kind === 'nap')!;
    expect(back.label).toContain('回到丁館');
    expect(back.end!).toBeLessThanOrEqual(napStep.start);
    expect(napStep.start).toBe(t(13));
  });

  it('下午玩不到多久：出場吃完不回去，直接回家（不排沒意義的回場）', () => {
    const r = planSingle(FREE, opts({ style: 'easy', napMode: 'none', latestHome: t(13, 30) }), { ...withFood(), kids: [{ name: '', age: 5 }] });
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.steps.some((s) => s.label.includes('回到'))).toBe(false);
    expect(r.endsEarly).toBe(true);
  });

  it('雙景點：第一站出場吃，吃完直接開去第二站，不回第一站', () => {
    const r = planPair(PAID, B, opts({ napMode: 'none' }), { ...withFood(), kids: [{ name: '', age: 5 }] });
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(validateSteps(r.steps) && noOverlap(r.steps)).toBe(true);
    expect(r.steps.some((s) => s.label.includes('回到丁館'))).toBe(false);
    const toSecond = r.steps.find((s) => s.label.includes('開車到乙館'))!;
    expect(toSecond.start).toBe(r.steps.find((s) => s.kind === 'lunch')!.end);
    expect(r.notes.join()).toContain('吃飯的地方如果比較遠');
  });

  it('自備午餐、資料標示可帶便當：在場內吃，不用移動', () => {
    const picnic = makeSpot({ ...PAID, facilities: ['picnic'] });
    const r = planSingle(picnic, opts({ style: 'easy', napMode: 'car', lunch: 'packed' }), ctx());
    if (r.status !== 'ok') throw new Error(r.reason);
    expect(r.steps.some((s) => s.kind === 'transfer')).toBe(false);
    expect(r.steps.find((s) => s.kind === 'lunch')!.label).toContain('可帶便當');
    expect(r.draft).toBe(false);
  });

  it('不捏造餐廳距離、營業時間、座位：時間都寫「預留」，餐廳只當參考', () => {
    const r = planSingle(PAID, opts({ style: 'easy', napMode: 'car' }), withFood());
    if (r.status !== 'ok') throw new Error(r.reason);
    const labels = r.steps.map((s) => s.label).join();
    expect(labels).toContain('距離沒有資料');
    expect(r.lunch.refs.every((x) => x.status !== ('confirmed' as string))).toBe(true);
    expect(r.lunch.text).toContain('距離也沒有資料');
  });
});
