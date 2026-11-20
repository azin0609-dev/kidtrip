import { describe, expect, it } from 'vitest';
import type { Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import {
  type FamilyPlanOptions,
  addonMatches,
  checkSavedPlan,
  minPlay,
  buildTimeline,
  facilityNotes,
  familyCandidates,
  makeAddon,
  parseFamilyPlan,
  planHalfDay,
  shareText,
  timelineFor,
  validateSteps,
} from './family-plan.ts';
import { formatClock } from './plan.ts';
import { type RecommendContext, scoreSpot } from './recommend.ts';
import { STORAGE_KEY, parseState } from './storage.ts';
import { decodePlan, encodePlan, makePlan, swapToBackup } from './weekplan.ts';

const today = '2026-11-18'; // 週三，週六是 11/21
const nap = { start: '13:00', end: '15:00' };
// 預設測試情境：3 歲＋1 歲，兩個大人；不代表所有使用者的預設值。
const kids = [
  { name: '果果', age: 3 },
  { name: '核桃', age: 1 },
];

function ctx(over: Partial<RecommendContext> = {}): RecommendContext {
  return { today, minsOf: (s) => s.mins_from_linkou, fav: [], been: [], beenAt: {}, rainy: false, overnight: false, maxDrive: 120, kids, ...over };
}
const opts = (over: Partial<FamilyPlanOptions> = {}): FamilyPlanOptions => ({
  slot: 'sat-am',
  envMode: 'indoor',
  maxDrive: 45,
  stroller: true,
  napMode: 'home',
  ...over,
});
const ids = (xs: { spot: Spot }[]) => xs.map((x) => x.spot.id).sort();
const clocks = (r: ReturnType<typeof buildTimeline>) => (r.status === 'ok' ? r.steps.map((s) => `${formatClock(s.start)}${s.end !== undefined ? `-${formatClock(s.end)}` : ''}`) : []);

const indoor = makeSpot({ id: 'spot-001', env: 'in', mins_from_linkou: 35, age_best: [1, 8], stay_hours: 1.5 });
const semi = makeSpot({ id: 'spot-002', env: 'semi', mins_from_linkou: 20, age_best: [1, 8] });
const mix = makeSpot({ id: 'spot-003', env: 'mix', mins_from_linkou: 20, age_best: [1, 8] });
const out = makeSpot({ id: 'spot-004', env: 'out', mins_from_linkou: 20, age_best: [1, 8] });
const noStroller = makeSpot({ id: 'spot-005', env: 'in', stroller_ok: false, mins_from_linkou: 20, age_best: [1, 8] });
const tooFar = makeSpot({ id: 'spot-006', env: 'in', mins_from_linkou: 60, age_best: [1, 8] });
const risky = makeSpot({ id: 'spot-007', env: 'in', mins_from_linkou: 20, age_best: [1, 8], risk_flags: ['access_unknown'] });
const forOlder = makeSpot({ id: 'spot-008', env: 'in', mins_from_linkou: 20, age_best: [6, 12] });
const closed = makeSpot({ id: 'spot-009', env: 'in', mins_from_linkou: 20, closes_on: '2026-11-01' });
const all = [indoor, semi, mix, out, noStroller, tooFar, risky, forOlder, closed];

describe('挑景點', () => {
  it('雨天完全室內只推 env === in，半室內、室內＋戶外、戶外都不混入', () => {
    const r = familyCandidates(all, ctx({ rainy: true }), opts(), 's');
    expect(r.every((x) => x.spot.env === 'in')).toBe(true);
    expect(ids(r)).toEqual(['spot-001']);
  });
  it('一般模式不限室內外，但其他條件一樣嚴格', () => {
    expect(ids(familyCandidates(all, ctx(), opts({ envMode: 'any' }), 's'))).toEqual(['spot-001', 'spot-002', 'spot-003', 'spot-004']);
  });
  it('需要推車時排除推車不友善的；不需要時可以出現', () => {
    expect(ids(familyCandidates(all, ctx(), opts(), 's'))).not.toContain('spot-005');
    expect(ids(familyCandidates(all, ctx(), opts({ stroller: false }), 's'))).toContain('spot-005');
  });
  it('超過車程上限排除', () => {
    expect(ids(familyCandidates(all, ctx(), opts({ maxDrive: 30 }), 's'))).toEqual([]);
    expect(ids(familyCandidates(all, ctx(), opts({ maxDrive: 60 }), 's'))).toContain('spot-006');
  });
  it('高風險資料、已熄燈的排除', () => {
    const r = ids(familyCandidates(all, ctx(), opts({ maxDrive: 120 }), 's'));
    expect(r).not.toContain('spot-007');
    expect(r).not.toContain('spot-009');
  });
  it('主要遊玩的孩子不在建議年齡內就排除；1 歲寶寶算陪同，不擋 3 歲的', () => {
    expect(ids(familyCandidates(all, ctx(), opts({ maxDrive: 120 }), 's'))).not.toContain('spot-008');
    const for3up = makeSpot({ id: 'spot-010', env: 'in', mins_from_linkou: 20, age_best: [3, 10] });
    expect(ids(familyCandidates([for3up], ctx(), opts(), 's'))).toEqual(['spot-010']);
  });
  it('自家評 2 顆星以下的排除；8 週內去過的照既有規則排除', () => {
    expect(familyCandidates([indoor], ctx({ ratings: { 'spot-001': { stars: 2, tags: [] } } }), opts(), 's')).toEqual([]);
    expect(familyCandidates([indoor], ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-11-01' } }), opts(), 's')).toEqual([]);
    expect(familyCandidates([indoor], ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-08-01' } }), opts(), 's')).toHaveLength(1);
  });
  it('沒有符合的景點：回傳空的，不放寬條件', () => {
    const r = planHalfDay([semi, out], ctx({ rainy: true }), opts(), nap, 's');
    expect(r.candidates).toEqual([]);
    expect(r.result).toBeNull();
  });
  it('同樣的條件，結果一樣', () => {
    const many = Array.from({ length: 8 }, (_, i) => makeSpot({ id: `spot-${100 + i}`, env: 'in', mins_from_linkou: 20 + i, age_best: [1, 8] }));
    expect(ids(familyCandidates(many, ctx(), opts(), 'seed-a'))).toEqual(ids(familyCandidates(many, ctx(), opts(), 'seed-a')));
    expect(familyCandidates(many, ctx(), opts(), 'seed-a').map((x) => x.spot.id)).toEqual(familyCandidates(many, ctx(), opts(), 'seed-a').map((x) => x.spot.id));
  });
});

describe('排時間：上午回家睡', () => {
  it('單程 35 分、玩 90 分、13:00 午睡：9:15 出門，到家吃午餐、安頓，13:00 睡', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    expect(clocks(r)).toEqual(['9:15', '9:15-9:50', '9:50-10:00', '10:00-11:30', '11:30-12:05', '12:05-12:40', '12:40-13:00', '13:00']);
    expect(validateSteps(r.status === 'ok' ? r.steps : [])).toBe(true);
  });
  it('午睡改成 13:30：全部往後半小時', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap: { start: '13:30', end: '15:30' }, today });
    expect(clocks(r)[0]).toBe('9:45');
    expect(clocks(r).at(-1)).toBe('13:30');
  });
  it('午睡太早（11:30），扣掉車程、午餐、安頓後玩不到 60 分：時間不足，不硬排', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap: { start: '11:30', end: '13:30' }, today });
    expect(r.status).toBe('no-time');
  });
  it('建議停留比較短的地方，照建議停留排', () => {
    const short = makeSpot({ env: 'in', stay_hours: 1 });
    const r = buildTimeline({ spot: short, mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status === 'ok' && r.playMins).toBe(60);
  });
});

describe('排時間：上午車上睡、下午', () => {
  it('車上睡：午睡開始時上車，回程在車上睡，跟回家睡不一樣', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'car', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const napStep = r.steps.find((s) => s.kind === 'nap')!;
    expect(formatClock(napStep.start)).toBe('13:00');
    expect(napStep.end).toBe(13 * 60 + 35);
    expect(r.steps.some((s) => s.kind === 'rest')).toBe(false);
    // 13:00 上車 ← 30 分午餐 ← 玩 90 分 ← 停車 10 分 ← 車程 35 分 = 10:15 出門
    expect(formatClock(r.leaveHome)).toBe('10:15');
  });
  it('下午場：午睡起來 15:15 出門，傍晚到家', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-pm', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(formatClock(r.leaveHome)).toBe('15:15');
    expect(r.homeAt).toBeLessThanOrEqual(18 * 60 + 30);
    expect(r.notes.join()).toContain('關門');
  });
  it('下午、午睡很晚又很遠：時間不足', () => {
    const r = buildTimeline({ spot: indoor, mins: 110, slot: 'sat-pm', napMode: 'home', nap: { start: '14:00', end: '16:00' }, today });
    expect(r.status).toBe('no-time');
  });
  it('去回程、停車、遊玩、午餐都不重疊，時間不倒退也不是負的', () => {
    for (const mins of [10, 25, 35, 45, 60]) {
      for (const slot of ['sat-am', 'sun-am', 'sat-pm'] as const) {
        for (const napMode of ['home', 'car'] as const) {
          const r = buildTimeline({ spot: indoor, mins, slot, napMode, nap, today });
          if (r.status === 'ok') expect(validateSteps(r.steps)).toBe(true);
        }
      }
    }
    expect(validateSteps([{ kind: 'play', start: 600, end: 590, label: 'x' }])).toBe(false);
    expect(validateSteps([{ kind: 'drive', start: 600, end: 660, label: 'x' }, { kind: 'play', start: 650, end: 700, label: 'y' }])).toBe(false);
  });
  it('已經過去的時段：週日看週六', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap, today: '2026-11-22' });
    expect(r.status).toBe('past');
    expect(planHalfDay([indoor], ctx({ today: '2026-11-22' }), opts(), nap, 's').result?.status).toBe('past');
  });
  it('車程算不出來：不排時間，請用導航看', () => {
    const r = timelineFor(indoor, () => null, ctx(), opts(), nap);
    expect(r.status).toBe('unknown-drive');
  });
  it('今天的出門時間已經過了：不算有效行程', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap, today: '2026-11-21', nowMins: 10 * 60 });
    expect(r.status).toBe('past');
    expect(r.status === 'past' && r.reason).toContain('已經過了');
    // 還沒到出門時間就照常
    expect(buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap, today: '2026-11-21', nowMins: 8 * 60 }).status).toBe('ok');
  });
});

describe('資料不完整時不假設', () => {
  it('沒有營業時間、預約資料：列在出發前確認', () => {
    const r = timelineFor(indoor, ctx().minsOf, ctx(), opts(), nap);
    expect(r.status === 'ok' && r.checks.join()).toContain('營業時間還沒查證');
    expect(r.status === 'ok' && r.checks.join()).toContain('要不要預約或先買票還不知道');
  });
  it('設施沒資料寫「沒有資料」，資料標示寫「還沒逐項查證」，查證過寫來源', () => {
    expect(facilityNotes(makeSpot({ facilities: [] })).join()).toContain('尿布台：沒有資料');
    expect(facilityNotes(makeSpot({ facilities: ['diaper'] })).join()).toContain('尿布台：資料標示有');
    const checked = makeSpot({ amenities: { diaper: 'yes', toilet: 'no', source: 'Google 地圖', checked_at: '2026-11-18' } });
    expect(facilityNotes(checked)).toContain('尿布台：有（Google 地圖）');
    expect(facilityNotes(checked)).toContain('廁所：沒有（Google 地圖）');
  });
  it('年齡說明：誰主要玩、誰坐推車陪同', () => {
    const r = timelineFor(makeSpot({ env: 'in', age_best: [3, 10] }), ctx().minsOf, ctx(), opts(), nap);
    expect(r.status === 'ok' && r.ageNote).toBe('建議 3–10 歲，果果可以玩；核桃坐推車陪同');
  });
});

describe('儲存與相容', () => {
  const plan = makePlan(today, 'spot-001', 'sat-am', 'spot-002');
  const addon = makeAddon(plan.week, 'spot-001', opts());

  it('附加資料跟這週計畫對應；換景點、改去雨備、換時段都會失效', () => {
    expect(addonMatches(addon, plan)).toBe(true);
    expect(addonMatches(addon, swapToBackup(plan))).toBe(false);
    expect(addonMatches(addon, makePlan(today, 'spot-003', 'sat-am'))).toBe(false);
    expect(addonMatches(addon, makePlan(today, 'spot-001', 'sun-am'))).toBe(false);
    expect(addonMatches(addon, null)).toBe(false);
  });
  it('舊版儲存資料（沒有 familyPlan）照常讀；familyPlan 壞掉只丟掉它，其他資料不受影響', () => {
    const legacy = { fav: ['spot-017'], been: ['spot-092'], beenAt: { 'spot-092': '2026-10-03' }, plan, ratings: { 'spot-092': { stars: 5, tags: [] } } };
    const ok = parseState(JSON.stringify(legacy));
    expect(ok.plan).toEqual(plan);
    expect(ok.familyPlan).toBeUndefined();
    const broken = parseState(JSON.stringify({ ...legacy, familyPlan: { week: 'x', spotId: 'spot-001', napMode: 'sofa' } }));
    expect(broken.familyPlan).toBeUndefined();
    expect(broken.fav).toEqual(['spot-017']);
    expect(broken.been).toEqual(['spot-092']);
    expect(broken.ratings).toEqual(legacy.ratings);
    expect(broken.plan).toEqual(plan);
    expect(parseState(JSON.stringify({ ...legacy, familyPlan: addon })).familyPlan).toEqual(addon);
    expect(STORAGE_KEY).toBe('kidtrip.v1');
  });
  it('parseFamilyPlan 只收合法的值', () => {
    expect(parseFamilyPlan(addon)).toEqual(addon);
    expect(parseFamilyPlan({ ...addon, maxDrive: 50 })).toBeNull();
    expect(parseFamilyPlan({ ...addon, envMode: 'outdoor' })).toBeNull();
    expect(parseFamilyPlan(null)).toBeNull();
  });
  it('舊版 WeekPlan 與分享連結照常解析（格式沒變）', () => {
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
    // 舊版連結：w／t／s／b 四個欄位
    const old = btoa(JSON.stringify({ w: plan.week, t: 'sat-am', s: 'spot-001', b: 'spot-002' })).replace(/=+$/, '');
    expect(decodePlan(old)).toEqual(plan);
  });
  it('出發地改了（車程變）：時間表跟著重算', () => {
    const near = timelineFor(indoor, () => 20, ctx(), opts(), nap);
    const far = timelineFor(indoor, () => 40, ctx(), opts(), nap);
    expect(near.status === 'ok' && far.status === 'ok' && far.leaveHome).toBeLessThan(near.status === 'ok' ? near.leaveHome : 0);
  });
  it('分享文字不帶孩子名字、出發地，並說明連結只會看到景點', () => {
    const r = timelineFor(indoor, ctx().minsOf, ctx(), opts(), nap);
    if (r.status !== 'ok') throw new Error('should be ok');
    const text = shareText(r, '週六上午 11/21');
    expect(text).not.toContain('果果');
    expect(text).not.toContain('核桃');
    expect(text).not.toContain('林口');
    expect(text).toContain('打開連結只會看到景點');
  });
});

describe('依資料的營業時間排', () => {
  it('讀出週末開關門時間；讀不到就是不知道', async () => {
    const { weekendHours } = await import('./family-plan.ts');
    expect(weekendHours('10:00–18:00，週六到 20:00；分時段入場', 'sat')).toEqual({ open: 600, close: 1200, closed: false });
    expect(weekendHours('10:00–18:00，週六到 20:00；分時段入場', 'sun')).toEqual({ open: 600, close: 1080, closed: false });
    expect(weekendHours('平日 11:30–18:00，週末 10:00–18:30；先線上買票', 'sun')).toEqual({ open: 600, close: 1110, closed: false });
    expect(weekendHours('平日 09:00–17:00，週末到 18:00；週一公休', 'sat')).toEqual({ open: 540, close: 1080, closed: false });
    expect(weekendHours('週一休館', 'sat')).toEqual({ open: null, close: null, closed: false });
    expect(weekendHours(undefined, 'sat')).toEqual({ open: null, close: null, closed: false });
  });
  it('10 點才開門：不會排在開門前就開始玩', () => {
    const xpark = makeSpot({ env: 'in', open_note: '10:00–18:00，週六到 20:00', stay_hours: 3 });
    const r = buildTimeline({ spot: xpark, mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const play = r.steps.find((s) => s.kind === 'play')!;
    expect(play.start).toBeGreaterThanOrEqual(10 * 60);
    // 沒有查證過營業時間：只用來避開開門前，並寫明不代表一定有開
    expect(r.notes.join()).toContain('還沒查證');
    expect(r.notes.join()).toContain('不代表當天一定有開');
  });
  it('下午：玩到資料寫的關門時間為止', () => {
    const early = makeSpot({ env: 'in', open_note: '09:30–17:00', stay_hours: 3 });
    const r = buildTimeline({ spot: early, mins: 20, slot: 'sun-pm', napMode: 'home', nap, today });
    expect(r.status === 'ok' && r.steps.find((s) => s.kind === 'play')!.end).toBeLessThanOrEqual(17 * 60);
  });
  it('關門太早、下午玩不到：時間不足', () => {
    const closesEarly = makeSpot({ env: 'in', open_note: '09:00–16:00' });
    expect(buildTimeline({ spot: closesEarly, mins: 30, slot: 'sat-pm', napMode: 'home', nap, today }).status).toBe('no-time');
  });
});

describe('審查修正：第一名排不出時間就往下找', () => {
  // 第一名分數最高但車程太遠、回家睡排不出 75 分鐘；第二名近一點排得出來
  const farBest = makeSpot({ id: 'spot-201', name: '很遠但最熱門', env: 'in', mins_from_linkou: 44, age_best: [1, 8], facilities: ['parking', 'food', 'diaper', 'nursing'], transit: '捷運', stay_hours: 3 });
  const nearOk = makeSpot({ id: 'spot-202', name: '近的室內館', env: 'in', mins_from_linkou: 15, age_best: [1, 8] });
  const earlyNap = { start: '11:50', end: '13:50' };
  // 遠的有收藏、設施多；近的去過（8 週以上），讓遠的確定是分數最高的。
  const rankCtx = () => ctx({ fav: ['spot-201'], been: ['spot-202'], beenAt: { 'spot-202': '2026-07-01' } });
  it('自動跳過排不出時間的，顯示第一個真的排得出來的', () => {
    const r = planHalfDay([farBest, nearOk], rankCtx(), opts(), earlyNap, 's');
    expect(r.candidates.map((c) => c.spot.id)[0]).toBe('spot-201'); // 分數最高的是遠的那個
    expect(r.skipped.map((x) => x.pick.spot.id)).toEqual(['spot-201']);
    expect(r.result?.status).toBe('ok');
    expect(r.result?.status === 'ok' && r.result.spot.id).toBe('spot-202');
    expect(r.plans).toHaveLength(1);
  });
  it('全部都排不出來才是沒有結果；符合條件的地方和原因都留著', () => {
    const r = planHalfDay([farBest], rankCtx(), opts(), earlyNap, 's');
    expect(r.result).toBeNull();
    expect(r.candidates).toHaveLength(1);
    expect(r.skipped[0]?.result.status).toBe('no-time');
  });
  it('今天的出門時間全都過了：說時段來不及，不說沒有地方', () => {
    const r = planHalfDay([nearOk], ctx({ today: '2026-11-21' }), opts(), nap, 's', 0, 12 * 60);
    expect(r.result?.status).toBe('past');
  });
  it('換一個地方只在排得出來的裡面輪', () => {
    const near2 = makeSpot({ id: 'spot-203', env: 'in', mins_from_linkou: 10, age_best: [1, 8] });
    const r0 = planHalfDay([farBest, nearOk, near2], ctx(), opts(), earlyNap, 's', 0);
    const r1 = planHalfDay([farBest, nearOk, near2], ctx(), opts(), earlyNap, 's', 1);
    const r2 = planHalfDay([farBest, nearOk, near2], ctx(), opts(), earlyNap, 's', 2);
    const id = (x: typeof r0) => (x.result?.status === 'ok' ? x.result.spot.id : null);
    expect(new Set([id(r0), id(r1)])).toEqual(new Set(['spot-202', 'spot-203']));
    expect(id(r2)).toBe(id(r0)); // 輪回第一個，不會出現排不出來的 spot-201
  });
});

describe('審查修正：已保存的計畫重新檢查硬性條件', () => {
  const plan = makePlan(today, 'spot-001', 'sat-am');
  const addon = makeAddon(plan.week, 'spot-001', opts());
  it('條件都沒變：照常重排時間', () => {
    expect(checkSavedPlan(indoor, addon, ctx(), nap).status).toBe('ok');
  });
  it('換了出發地、車程超過當初的上限：要重新安排', () => {
    const r = checkSavedPlan(indoor, addon, ctx({ minsOf: () => 70 }), nap);
    expect(r.status).toBe('invalid');
    expect(r.status === 'invalid' && r.reason).toContain('超過當初設定的 45 分鐘');
  });
  it('孩子年齡改了、不在建議年齡內：要重新安排', () => {
    const r = checkSavedPlan(indoor, addon, ctx({ kids: [{ name: '果果', age: 10 }] }), nap);
    expect(r.status === 'invalid' && r.reason).toContain('孩子的年齡');
  });
  it('現在要帶推車、這裡推車不好推：要重新安排', () => {
    const noStrollerSpot = makeSpot({ ...indoor, stroller_ok: false });
    const relaxed = makeAddon(plan.week, 'spot-001', opts({ stroller: false }));
    expect(checkSavedPlan(noStrollerSpot, relaxed, ctx({ needStroller: true }), nap).status).toBe('invalid');
    expect(checkSavedPlan(noStrollerSpot, relaxed, ctx({ needStroller: false }), nap).status).toBe('ok');
  });
  it('資料後來被標成有疑問、或自家評低分：要重新安排', () => {
    expect(checkSavedPlan(makeSpot({ ...indoor, risk_flags: ['status_conflict'] }), addon, ctx(), nap).status).toBe('invalid');
    expect(checkSavedPlan(indoor, addon, ctx({ ratings: { 'spot-001': { stars: 1, tags: [] } } }), nap).status).toBe('invalid');
  });
  it('完全室內的計畫，景點資料改成半室內：要重新安排', () => {
    expect(checkSavedPlan(makeSpot({ ...indoor, env: 'semi' }), addon, ctx(), nap).status).toBe('invalid');
  });
});

describe('審查修正：營業時間', () => {
  it('週末公休、休園重整：那天不排', async () => {
    const { weekendHours } = await import('./family-plan.ts');
    expect(weekendHours('09:00–17:00，週末公休', 'sat').closed).toBe(true);
    expect(weekendHours('09:00–17:00，週日休館', 'sun').closed).toBe(true);
    expect(weekendHours('09:00–17:00，週日休館', 'sat').closed).toBe(false);
    expect(weekendHours('2026-02-23 起休園重整', 'sat').closed).toBe(true);
    expect(weekendHours('09:00–17:00，週一休園', 'sat').closed).toBe(false);
    const r = buildTimeline({ spot: makeSpot({ env: 'in', open_note: '09:00–17:00，週日休館' }), mins: 20, slot: 'sun-am', napMode: 'home', nap, today });
    expect(r.status).toBe('closed');
  });
  it('讀不懂或不合理的時間：當成不知道，不用它排，也寫明沒考慮營業時間', async () => {
    const { weekendHours } = await import('./family-plan.ts');
    expect(weekendHours('18:00–09:00', 'sat')).toEqual({ open: null, close: null, closed: false });
    const r = buildTimeline({ spot: makeSpot({ env: 'in', open_note: '依官網公告' }), mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status === 'ok' && r.notes.join()).toContain('不知道幾點開、幾點關');
  });
  it('上午：資料寫的關門時間比較早，就玩到關門、早點回家，不會玩到關門後', () => {
    const r = buildTimeline({ spot: makeSpot({ env: 'in', open_note: '09:00–11:30' }), mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.steps.find((s) => s.kind === 'play')!.end).toBeLessThanOrEqual(11 * 60 + 30);
    expect(validateSteps(r.steps)).toBe(true);
    expect(r.steps.at(-1)?.start).toBe(13 * 60); // 午睡時間不變
  });
  it('上午車上睡：關門比午睡早，不硬排', () => {
    expect(buildTimeline({ spot: makeSpot({ env: 'in', open_note: '09:00–11:00' }), mins: 20, slot: 'sat-am', napMode: 'car', nap, today }).status).toBe('no-time');
  });
  it('下午：資料寫的開門時間比睡醒晚，就晚一點出門，不會在開門前到', () => {
    const r = buildTimeline({ spot: makeSpot({ env: 'in', open_note: '平日 10:00–18:00，週末 16:00–20:00' }), mins: 20, slot: 'sat-pm', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.steps.find((s) => s.kind === 'play')!.start).toBeGreaterThanOrEqual(16 * 60);
  });
  it('查證過的營業時間和沒查證的，寫法不一樣', () => {
    const verifiedSpot = makeSpot({ env: 'in', open_note: '10:00–18:00', verified: { date: '2026-11-18', fields: ['營業時間'], source: 'google_maps' } });
    const r = buildTimeline({ spot: verifiedSpot, mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status === 'ok' && r.notes.join()).toContain('依查證過的營業時間');
  });
});

describe('審查修正：最低遊玩時間 75 分鐘', () => {
  it('一般景點至少 75 分鐘；有明確比較短的建議停留才例外', () => {
    expect(minPlay(makeSpot())).toBe(75);
    expect(minPlay(makeSpot({ stay_hours: 3 }))).toBe(75);
    expect(minPlay(makeSpot({ stay_hours: 1 }))).toBe(60);
    expect(minPlay(makeSpot({ stay_hours: 0.5 }))).toBe(30);
  });
  it('只能玩 60–74 分鐘的一般景點：時間不足', () => {
    // 午睡 12:20：回家睡要 11:25 前到家 → 單程 20 分要 11:05 離開；最早 9:00 到、9:10 開始玩 → 115 分；
    // 改成午睡 11:30：10:15 離開，9:10 開始玩 → 65 分（< 75）
    const r = buildTimeline({ spot: makeSpot({ env: 'in' }), mins: 20, slot: 'sat-am', napMode: 'home', nap: { start: '11:30', end: '13:30' }, today });
    expect(r.status).toBe('no-time');
    const short = buildTimeline({ spot: makeSpot({ env: 'in', stay_hours: 1 }), mins: 20, slot: 'sat-am', napMode: 'home', nap: { start: '11:30', end: '13:30' }, today });
    expect(short.status).toBe('ok');
  });
});

describe('品質修正：用實際出遊日期判斷開幕、熄燈', () => {
  // 今天週三 11/18，排週六 11/21、週日 11/22
  const closesFri = makeSpot({ id: 'spot-401', env: 'in', mins_from_linkou: 20, age_best: [1, 8], closes_on: '2026-11-20' });
  const opensSat = makeSpot({ id: 'spot-402', env: 'in', mins_from_linkou: 20, age_best: [1, 8], opens_on: '2026-11-21' });
  const opensSun = makeSpot({ id: 'spot-403', env: 'in', mins_from_linkou: 20, age_best: [1, 8], opens_on: '2026-11-22' });
  const closesSat = makeSpot({ id: 'spot-404', env: 'in', mins_from_linkou: 20, age_best: [1, 8], closes_on: '2026-11-21' });
  const all = [closesFri, opensSat, opensSun, closesSat];
  it('週五熄燈的不排週六；週六才開幕的可以排週六（雖然今天還沒開）', () => {
    const r = familyCandidates(all, ctx(), opts({ slot: 'sat-am' }), 's').map((x) => x.spot.id).sort();
    expect(r).toEqual(['spot-402', 'spot-404']);
  });
  it('週日：週日開幕的可以排、週六熄燈的不行', () => {
    const r = familyCandidates(all, ctx(), opts({ slot: 'sun-am' }), 's').map((x) => x.spot.id).sort();
    expect(r).toEqual(['spot-402', 'spot-403']);
  });
  it('首頁推薦（沒給出遊日期）維持用今天判斷；給了出遊日期就用那天', () => {
    expect(scoreSpot(opensSat, ctx())).toBeNull();
    expect(scoreSpot(opensSat, ctx({ visitDate: '2026-11-21' }))).not.toBeNull();
    expect(scoreSpot(closesFri, ctx())).not.toBeNull();
    expect(scoreSpot(closesFri, ctx({ visitDate: '2026-11-21' }))).toBeNull();
  });
});
