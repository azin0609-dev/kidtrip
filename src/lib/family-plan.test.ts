import { describe, expect, it } from 'vitest';
import type { Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import {
  type FamilyPlanOptions,
  addonMatches,
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
import type { RecommendContext } from './recommend.ts';
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
  it('今天的出門時間已經過了，會提醒', () => {
    const r = buildTimeline({ spot: indoor, mins: 35, slot: 'sat-am', napMode: 'home', nap, today: '2026-11-21', nowMins: 10 * 60 });
    expect(r.status === 'ok' && r.notes.join()).toContain('已經過了');
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
    expect(weekendHours('10:00–18:00，週六到 20:00；分時段入場', 'sat')).toEqual({ open: 600, close: 1200 });
    expect(weekendHours('10:00–18:00，週六到 20:00；分時段入場', 'sun')).toEqual({ open: 600, close: 1080 });
    expect(weekendHours('平日 11:30–18:00，週末 10:00–18:30；先線上買票', 'sun')).toEqual({ open: 600, close: 1110 });
    expect(weekendHours('平日 09:00–17:00，週末到 18:00；週一公休', 'sat')).toEqual({ open: 540, close: 1080 });
    expect(weekendHours('週一休館', 'sat')).toEqual({ open: null, close: null });
    expect(weekendHours(undefined, 'sat')).toEqual({ open: null, close: null });
  });
  it('10 點才開門：不會排在開門前就開始玩', () => {
    const xpark = makeSpot({ env: 'in', open_note: '10:00–18:00，週六到 20:00', stay_hours: 3 });
    const r = buildTimeline({ spot: xpark, mins: 20, slot: 'sat-am', napMode: 'home', nap, today });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const play = r.steps.find((s) => s.kind === 'play')!;
    expect(play.start).toBeGreaterThanOrEqual(10 * 60);
    expect(r.notes.join()).toContain('依資料的營業時間');
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
