import { describe, expect, it } from 'vitest';
import type { Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import { type RecommendContext, isoWeek, recommend, scoreSpot, seededRandom, typesAllSame, weekSeed } from './recommend.ts';

const today = '2026-11-20';
const linkou = { lat: 25.0775, lng: 121.3916 };

function ctx(overrides: Partial<RecommendContext> = {}): RecommendContext {
  return {
    today,
    minsOf: (s) => s.mins_from_linkou,
    fav: [],
    been: [],
    beenAt: {},
    rainy: false,
    overnight: false,
    ...overrides,
  };
}

// 12 個景點：各種類型、車程、室內外。
const spots: Spot[] = [
  makeSpot({ id: 'spot-001', types: ['park'], env: 'out', mins_from_linkou: 20 }),
  makeSpot({ id: 'spot-002', types: ['park'], env: 'out', mins_from_linkou: 25 }),
  makeSpot({ id: 'spot-003', types: ['park'], env: 'out', mins_from_linkou: 30 }),
  makeSpot({ id: 'spot-004', types: ['museum', 'dino'], env: 'in', mins_from_linkou: 45 }),
  makeSpot({ id: 'spot-005', types: ['indoorplay'], env: 'in', mins_from_linkou: 35 }),
  makeSpot({ id: 'spot-006', types: ['zoo'], env: 'mix', mins_from_linkou: 50 }),
  makeSpot({ id: 'spot-007', types: ['farm'], env: 'semi', mins_from_linkou: 80 }),
  makeSpot({ id: 'spot-008', types: ['theme'], env: 'mix', mins_from_linkou: 100 }),
  makeSpot({ id: 'spot-009', types: ['sea'], env: 'out', mins_from_linkou: 150 }),
  makeSpot({ id: 'spot-010', types: ['train'], env: 'semi', mins_from_linkou: 200 }),
  makeSpot({ id: 'spot-011', types: ['water'], env: 'out', mins_from_linkou: 40 }),
  makeSpot({ id: 'spot-012', types: ['indoorplay'], env: 'in', mins_from_linkou: 55 }),
];
const ids = (xs: { spot: { id: string } }[]) => xs.map((x) => x.spot.id);

describe('isoWeek / seed', () => {
  it.each([
    ['2026-11-16', '2026-W47'], // 週一
    ['2026-11-22', '2026-W47'], // 週日
    ['2026-11-23', '2026-W48'],
    ['2027-01-01', '2026-W53'], // 2026 有 53 週
    ['2027-01-04', '2027-W01'],
    ['2024-12-30', '2025-W01'],
  ])('%s → %s', (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
  it('同一週同出發地的種子一樣', () => {
    expect(weekSeed('2026-11-19', linkou)).toBe(weekSeed('2026-11-21', linkou));
    expect(weekSeed('2026-11-19', linkou)).not.toBe(weekSeed('2026-11-26', linkou));
    expect(weekSeed('2026-11-19', linkou)).not.toBe(weekSeed('2026-11-19', { lat: 22.6266, lng: 120.3563 }));
    expect(weekSeed('2026-11-19', linkou, 1)).not.toBe(weekSeed('2026-11-19', linkou));
  });
  it('seededRandom 可重現、落在 0–1', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('scoreSpot 排除條件', () => {
  it('已熄燈、還沒開幕不推', () => {
    expect(scoreSpot(makeSpot({ closes_on: '2026-11-19' }), ctx())).toBeNull();
    expect(scoreSpot(makeSpot({ opens_on: '2026-11-24' }), ctx())).toBeNull();
  });
  it('8 週內去過不推，8 週以上可以', () => {
    const s = makeSpot({ id: 'spot-001' });
    expect(scoreSpot(s, ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-09-26' } }))).toBeNull(); // 55 天
    expect(scoreSpot(s, ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-09-25' } }))).not.toBeNull(); // 56 天
  });
  it('舊資料沒有日期：不排除，但分數比沒去過低', () => {
    const s = makeSpot({ id: 'spot-001' });
    const unknown = scoreSpot(s, ctx({ been: ['spot-001'] }));
    expect(unknown?.reasons).toContain('去過，有一陣子了');
    expect(unknown!.score).toBeLessThan(scoreSpot(s, ctx())!.score);
  });
  it('超過 120 分只在要住一晚時推', () => {
    const far = makeSpot({ mins_from_linkou: 150 });
    expect(scoreSpot(far, ctx())).toBeNull();
    expect(scoreSpot(far, ctx({ overnight: true }))).not.toBeNull();
  });
  it('下雨只推室內、半室內', () => {
    expect(scoreSpot(makeSpot({ env: 'out' }), ctx({ rainy: true }))).toBeNull();
    expect(scoreSpot(makeSpot({ env: 'mix' }), ctx({ rainy: true }))).toBeNull();
    expect(scoreSpot(makeSpot({ env: 'in' }), ctx({ rainy: true }))).not.toBeNull();
    expect(scoreSpot(makeSpot({ env: 'semi' }), ctx({ rainy: true }))).not.toBeNull();
  });
  it('車程算不出來不推', () => {
    expect(scoreSpot(makeSpot(), ctx({ minsOf: () => null }))).toBeNull();
  });
});

describe('scoreSpot 加分', () => {
  const base = (o: Partial<Spot> = {}, c: Partial<RecommendContext> = {}) => scoreSpot(makeSpot(o), ctx(c))!.score;
  it('車程：60 分內 > 60–120 分 > 超過 120 分', () => {
    expect(base({ mins_from_linkou: 50 })).toBeGreaterThan(base({ mins_from_linkou: 90 }));
    expect(base({ mins_from_linkou: 90 })).toBeGreaterThan(base({ mins_from_linkou: 150 }, { overnight: true }));
  });
  it('去過越久加越多', () => {
    const at = (date: string) => base({ id: 'spot-001' }, { been: ['spot-001'], beenAt: { 'spot-001': date } });
    expect(at('2025-11-01')).toBeGreaterThan(at('2026-08-01'));
  });
  it('新開幕加分；21 天內熄燈加更多', () => {
    const plain = base();
    const fresh = base({ badge: { kind: 'new', label: '新開幕' } });
    const ending = base({ closes_on: '2026-12-05' });
    expect(fresh).toBeGreaterThan(plain);
    expect(ending - plain).toBeGreaterThan(fresh - plain);
  });
  it('收藏加分', () => {
    expect(base({ id: 'spot-001' }, { fav: ['spot-001'] })).toBeGreaterThan(base({ id: 'spot-001' }));
  });
  it('推薦原因', () => {
    const r = scoreSpot(
      makeSpot({ id: 'spot-001', env: 'in', mins_from_linkou: 23 }),
      ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-09-11' }, fav: ['spot-001'] }),
    )!;
    expect(r.reasons).toEqual(['離家約 25 分', '室內', '上次去是 10 週前', '收藏過']);
    expect(scoreSpot(makeSpot({ closes_on: '2026-11-30' }), ctx())!.reasons).toContain('11/30 熄燈，最後機會');
  });
});

describe('recommend 組合', () => {
  const seed = weekSeed(today, linkou);

  it('推 3 個，同週結果固定', () => {
    const a = recommend(spots, ctx(), seed);
    expect(a).toHaveLength(3);
    expect(ids(recommend(spots, ctx(), weekSeed('2026-11-22', linkou)))).toEqual(ids(a));
    // 資料順序不同也一樣
    expect(ids(recommend([...spots].reverse(), ctx(), seed))).toEqual(ids(a));
  });

  it('換一組（種子 +1）結果不同', () => {
    const results = new Set(
      Array.from({ length: 6 }, (_, i) => ids(recommend(spots, ctx(), weekSeed(today, linkou, i))).join(',')),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('三個類型不全相同', () => {
    // 公園分數刻意拉高（收藏＋最近），仍然不會三個都是公園。
    const c = ctx({ fav: ['spot-001', 'spot-002', 'spot-003'] });
    for (let i = 0; i < 20; i++) {
      const r = recommend(spots, c, weekSeed(today, linkou, i));
      expect(typesAllSame(r)).toBe(false);
    }
  });

  it('至少一個在 60 分內', () => {
    // 遠的景點都收藏，仍然要有一個近的。
    const c = ctx({ overnight: true, fav: ['spot-007', 'spot-008', 'spot-009', 'spot-010'] });
    for (let i = 0; i < 20; i++) {
      expect(recommend(spots, c, weekSeed(today, linkou, i)).some((r) => r.mins <= 60)).toBe(true);
    }
  });

  it('8 週內去過的不會出現', () => {
    const c = ctx({ been: ['spot-001', 'spot-005'], beenAt: { 'spot-001': '2026-11-01', 'spot-005': '2026-10-20' } });
    for (let i = 0; i < 20; i++) {
      const r = ids(recommend(spots, c, weekSeed(today, linkou, i)));
      expect(r).not.toContain('spot-001');
      expect(r).not.toContain('spot-005');
    }
  });

  it('下雨時三個都是室內或半室內', () => {
    for (let i = 0; i < 20; i++) {
      const r = recommend(spots, ctx({ rainy: true }), weekSeed(today, linkou, i));
      expect(r).toHaveLength(3);
      expect(r.every((x) => x.spot.env === 'in' || x.spot.env === 'semi')).toBe(true);
    }
  });

  it('不推還沒開幕、已熄燈的', () => {
    const extra = [
      ...spots,
      makeSpot({ id: 'spot-090', opens_on: '2026-11-24', mins_from_linkou: 10 }),
      makeSpot({ id: 'spot-091', closes_on: '2026-11-01', mins_from_linkou: 10 }),
    ];
    for (let i = 0; i < 20; i++) {
      const r = ids(recommend(extra, ctx(), weekSeed(today, linkou, i)));
      expect(r).not.toContain('spot-090');
      expect(r).not.toContain('spot-091');
    }
  });

  it('候選不夠時有幾個給幾個；條件滿足不了時放寬', () => {
    expect(recommend([], ctx(), seed)).toEqual([]);
    const onlyParks = spots.slice(0, 3);
    expect(recommend(onlyParks, ctx(), seed)).toHaveLength(3); // 只有公園，放寬類型
    expect(recommend(spots.slice(0, 2), ctx(), seed)).toHaveLength(2);
  });
});

describe('typesAllSame', () => {
  const s = (types: Spot['types']) => ({ spot: makeSpot({ types }), mins: 10, score: 0, reasons: [] });
  it('有共同類型才算全相同', () => {
    expect(typesAllSame([s(['park']), s(['park', 'zoo']), s(['park'])])).toBe(true);
    expect(typesAllSame([s(['park']), s(['zoo']), s(['park'])])).toBe(false);
    expect(typesAllSame([s(['park'])])).toBe(false);
  });
});
