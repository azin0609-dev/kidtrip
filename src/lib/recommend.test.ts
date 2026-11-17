import { describe, expect, it } from 'vitest';
import type { Spot } from '../data/schema.ts';
import { makeSpot } from '../test/fixtures.ts';
import {
  type RecommendContext,
  convenienceScore,
  driveScore,
  familyFit,
  isoWeek,
  pickBackup,
  recommend,
  recommendRound,
  scoreSpot,
  seededRandom,
  typesAllSame,
  weekSeed,
} from './recommend.ts';

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
    maxDrive: 120,
    ...overrides,
  };
}

// 12 個景點：各種類型、車程、室內外。
const spots: Spot[] = [
  makeSpot({ id: 'spot-001', types: ['park'], env: 'out', mins_from_linkou: 10 }),
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
const seeds = Array.from({ length: 20 }, (_, i) => weekSeed(today, linkou, i));

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

describe('先判斷能不能成行', () => {
  it('已熄燈、還沒開幕不推', () => {
    expect(scoreSpot(makeSpot({ closes_on: '2026-11-19' }), ctx())).toBeNull();
    expect(scoreSpot(makeSpot({ opens_on: '2026-11-24' }), ctx())).toBeNull();
  });
  it('8 週內去過不推，8 週以上可以', () => {
    const s = makeSpot({ id: 'spot-001' });
    expect(scoreSpot(s, ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-09-26' } }))).toBeNull(); // 55 天
    expect(scoreSpot(s, ctx({ been: ['spot-001'], beenAt: { 'spot-001': '2026-09-25' } }))).not.toBeNull(); // 56 天
  });
  it('8 週內去過但點過「會再來」：可以再推，只是分數比較低', () => {
    const s = makeSpot({ id: 'spot-001' });
    const base = { been: ['spot-001'], beenAt: { 'spot-001': '2026-11-01' } };
    const again = scoreSpot(s, ctx({ ...base, ratings: { 'spot-001': { stars: 5, tags: ['again'] } } }));
    expect(again?.reasons).toContain('你們說會再來');
    expect(again!.score).toBeLessThan(scoreSpot(s, ctx())!.score);
    expect(scoreSpot(s, ctx({ ...base, ratings: { 'spot-001': { stars: 5, tags: [] } } }))).toBeNull();
  });
  it('舊資料沒有日期：不排除，但分數比沒去過低', () => {
    const s = makeSpot({ id: 'spot-001' });
    const unknown = scoreSpot(s, ctx({ been: ['spot-001'] }));
    expect(unknown?.reasons).toContain('去過，有一陣子了');
    expect(unknown!.score).toBeLessThan(scoreSpot(s, ctx())!.score);
  });
  it('超過車程上限不推；沒給上限時預設 45 分', () => {
    const s = makeSpot({ mins_from_linkou: 50 });
    expect(scoreSpot(s, ctx({ maxDrive: 45 }))).toBeNull();
    expect(scoreSpot(s, ctx({ maxDrive: 60 }))).not.toBeNull();
    expect(scoreSpot(s, { ...ctx(), maxDrive: undefined })).toBeNull();
    expect(scoreSpot(makeSpot({ mins_from_linkou: 45 }), { ...ctx(), maxDrive: undefined })).not.toBeNull();
  });
  it('下雨只推室內、半室內，並說清楚是哪一種', () => {
    expect(scoreSpot(makeSpot({ env: 'out' }), ctx({ rainy: true }))).toBeNull();
    expect(scoreSpot(makeSpot({ env: 'mix' }), ctx({ rainy: true }))).toBeNull();
    const indoor = scoreSpot(makeSpot({ env: 'in' }), ctx({ rainy: true }))!;
    const semi = scoreSpot(makeSpot({ env: 'semi' }), ctx({ rainy: true }))!;
    expect(indoor.reasons).toContain('室內，下大雨也能玩');
    expect(semi.reasons).toContain('有遮棚，小雨可玩');
    expect(indoor.score).toBeGreaterThan(semi.score);
  });
  it('帶推車：只推推車好推的', () => {
    expect(scoreSpot(makeSpot({ stroller_ok: false }), ctx({ needStroller: true }))).toBeNull();
    expect(scoreSpot(makeSpot({ stroller_ok: false }), ctx())).not.toBeNull();
  });
  it('車程算不出來不推', () => {
    expect(scoreSpot(makeSpot(), ctx({ minsOf: () => null }))).toBeNull();
  });
  it('2 顆星以下不再推', () => {
    const s = makeSpot({ id: 'spot-001' });
    expect(scoreSpot(s, ctx({ ratings: { 'spot-001': { stars: 2, tags: [] } } }))).toBeNull();
    expect(scoreSpot(s, ctx({ ratings: { 'spot-001': { stars: 3, tags: [] } } }))).not.toBeNull();
  });
});

describe('這週要住一晚', () => {
  const far = makeSpot({ id: 'spot-009', mins_from_linkou: 150 });
  const near = makeSpot({ id: 'spot-001', mins_from_linkou: 30 });
  it('只推一小時以上、而且附近有住宿的地方', () => {
    const hasStay = (s: Spot) => s.id === 'spot-009';
    expect(scoreSpot(far, ctx({ overnight: true, hasStay }))?.reasons).toContain('附近有住宿');
    expect(scoreSpot(near, ctx({ overnight: true, hasStay: () => true }))).toBeNull(); // 太近不用住
    expect(scoreSpot(far, ctx({ overnight: true, hasStay: () => false }))).toBeNull(); // 沒有住宿
    expect(scoreSpot(far, ctx({ overnight: true }))).toBeNull();
  });
  it('住一晚時不受車程上限限制', () => {
    expect(scoreSpot(far, ctx({ overnight: true, maxDrive: 30, hasStay: () => true }))).not.toBeNull();
  });
});

describe('分數', () => {
  it('車程：20 分內滿分，之後逐步遞減', () => {
    expect(driveScore(10)).toBe(35);
    expect(driveScore(20)).toBe(35);
    expect(driveScore(35)).toBeCloseTo(26);
    expect(driveScore(45)).toBeCloseTo(20);
    expect(driveScore(120)).toBeCloseTo(5);
    expect(driveScore(10)).toBeGreaterThan(driveScore(35));
    expect(driveScore(35)).toBeGreaterThan(driveScore(60));
    expect(driveScore(150, true)).toBe(35);
  });
  it('10 分鐘的公園一定排在 35 分鐘的同類公園前面（隨機分蓋不過車程）', () => {
    const a = makeSpot({ id: 'spot-001', mins_from_linkou: 10 });
    const b = makeSpot({ id: 'spot-002', mins_from_linkou: 35 });
    for (const seed of seeds) {
      expect(recommend([a, b], ctx(), seed)[0]?.spot.id).toBe('spot-001');
    }
  });
  it('兩個孩子的適配：都在年齡範圍內分數最高，並寫出原因', () => {
    const kids = [
      { name: '果果', age: 3.2 },
      { name: '核桃', age: 1.3 },
    ];
    const both = familyFit(makeSpot({ age_best: [1, 8], stroller_ok: true, facilities: ['diaper'] }), kids);
    const onlyOlder = familyFit(makeSpot({ age_best: [3, 10], stroller_ok: true, facilities: ['diaper'] }), kids);
    const neither = familyFit(makeSpot({ age_best: [4, 12], stroller_ok: false }), kids);
    expect(both.score).toBe(35);
    expect(both.reason).toBe('果果、核桃都能玩、有地方換尿布');
    expect(onlyOlder.score).toBeLessThan(both.score);
    expect(onlyOlder.reason).toBeNull();
    expect(neither.score).toBe(0);
  });
  it('沒設定孩子或景點沒有年齡資料：給中間分數，不寫原因', () => {
    expect(familyFit(makeSpot({ age_best: [1, 8] }), [])).toEqual({ score: 17, reason: null });
    expect(familyFit(makeSpot(), [{ name: '', age: 3 }])).toEqual({ score: 17, reason: null });
  });
  it('單一孩子的原因', () => {
    expect(familyFit(makeSpot({ age_best: [2, 6] }), [{ name: '果果', age: 3 }]).reason).toBe('適合果果的年紀');
    expect(familyFit(makeSpot({ age_best: [2, 6] }), [{ name: '', age: 3 }]).reason).toBe('適合孩子的年紀');
  });
  it('到場便利：好停車、有賣吃的等加分，要先預約的少一點', () => {
    const easy = makeSpot({ facilities: ['parking', 'food', 'shade'], stroller_ok: true, transit: '捷運站旁' });
    const hard = makeSpot({ facilities: [], stroller_ok: false, open_note: '要先預約' });
    expect(convenienceScore(easy)).toBe(20);
    expect(convenienceScore(hard)).toBe(0);
  });
  it('新開幕、快熄燈、收藏、季節、高分都會加分並寫在原因', () => {
    const base = (o: Partial<Spot> = {}, c: Partial<RecommendContext> = {}) => scoreSpot(makeSpot(o), ctx(c))!;
    const plain = base().score;
    expect(base({ badge: { kind: 'new', label: '新開幕' } }).score).toBeGreaterThan(plain);
    expect(base({ closes_on: '2026-12-05' }).reasons).toContain('12/5 熄燈，最後機會');
    expect(base({ id: 'spot-001' }, { fav: ['spot-001'] }).score).toBeGreaterThan(base({ id: 'spot-001' }).score);
    expect(base({ best_months: [10, 11, 12] }).reasons).toContain('這個季節正適合');
    expect(base({ best_months: [6, 7, 8] }).score).toBeLessThan(plain);
  });
  it('長輩一起去：只推長輩好走的', () => {
    expect(scoreSpot(makeSpot(), ctx({ elders: true }))).toBeNull();
    expect(scoreSpot(makeSpot({ facilities: ['elder'] }), ctx({ elders: true }))?.reasons).toContain('長輩好走');
  });
});

describe('三張推薦卡的角色', () => {
  const seed = seeds[0]!;

  it('第一張是分數最高的「最適合這次」', () => {
    const r = recommend(spots, ctx(), seed);
    expect(r).toHaveLength(3);
    expect(r[0]?.role).toBe('best');
    expect(r[0]!.score).toBeGreaterThanOrEqual(r[1]!.score);
  });

  it('「車程最短」一定比第一張近；第一張已經最近時改標「再一個選擇」', () => {
    for (const s of seeds) {
      const r = recommend(spots, ctx(), s);
      if (r[1]?.role === 'nearest') expect(r[1].mins).toBeLessThan(r[0]!.mins);
      if (r[1]?.role === 'other') expect(r[1].mins).toBeGreaterThanOrEqual(r[0]!.mins);
    }
    // 最近的那個收藏起來變成第一名，第二張就不能叫「車程最短」
    const r = recommend(spots, ctx({ fav: ['spot-001'] }), seed);
    expect(r[0]?.spot.id).toBe('spot-001');
    expect(r[1]?.role).toBe('other');
  });

  it('第三張是完全室內的「雨天備案」', () => {
    for (const s of seeds) {
      const r = recommend(spots, ctx(), s);
      const backup = r.find((x) => x.role === 'backup');
      expect(backup?.spot.env).toBe('in');
    }
  });

  it('沒有室內景點時，第三張是「再一個選擇」', () => {
    const outdoor = spots.filter((s) => s.env !== 'in');
    const r = recommend(outdoor, ctx(), seed);
    expect(r).toHaveLength(3);
    expect(r.some((x) => x.role === 'backup')).toBe(false);
  });

  it('下雨模式三個都是室內或半室內，不再另外標雨天備案', () => {
    for (const s of seeds) {
      const r = recommend(spots, ctx({ rainy: true }), s);
      expect(r).toHaveLength(3);
      expect(r.every((x) => x.spot.env === 'in' || x.spot.env === 'semi')).toBe(true);
      expect(r.some((x) => x.role === 'backup')).toBe(false);
    }
  });

  it('三個類型不全相同', () => {
    // 公園都收藏、分數拉高，仍然不會三個都是公園。
    const c = ctx({ fav: ['spot-001', 'spot-002', 'spot-003'] });
    for (const s of seeds) expect(typesAllSame(recommend(spots, c, s))).toBe(false);
  });

  it('同週結果固定，跟資料順序無關', () => {
    const a = recommend(spots, ctx(), seed);
    expect(ids(recommend(spots, ctx(), weekSeed('2026-11-22', linkou)))).toEqual(ids(a));
    expect(ids(recommend([...spots].reverse(), ctx(), seed))).toEqual(ids(a));
  });

  it('8 週內去過、還沒開幕、已熄燈的不會出現', () => {
    const extra = [
      ...spots,
      makeSpot({ id: 'spot-090', opens_on: '2026-11-24', mins_from_linkou: 10 }),
      makeSpot({ id: 'spot-091', closes_on: '2026-11-01', mins_from_linkou: 10 }),
    ];
    const c = ctx({ been: ['spot-001', 'spot-005'], beenAt: { 'spot-001': '2026-11-01', 'spot-005': '2026-10-20' } });
    for (const s of seeds) {
      const r = ids(recommend(extra, c, s));
      for (const id of ['spot-001', 'spot-005', 'spot-090', 'spot-091']) expect(r).not.toContain(id);
    }
  });

  it('符合的不到 3 個就有幾個給幾個，不會為了湊數放寬車程', () => {
    expect(recommend([], ctx(), seed)).toEqual([]);
    const r = recommend(spots, ctx({ maxDrive: 25 }), seed);
    expect(ids(r).sort()).toEqual(['spot-001', 'spot-002']);
    expect(recommend(spots.slice(0, 3), ctx(), seed)).toHaveLength(3); // 只有公園也照給
  });
});

describe('換一組', () => {
  const seedFor = (n: number) => weekSeed(today, linkou, n);
  const eight = spots.slice(0, 8);

  it('每按一次都換到沒看過的', () => {
    const a = recommendRound(eight, ctx(), seedFor, 0);
    const b = recommendRound(eight, ctx(), seedFor, 1);
    expect(a.status).toBe('ok');
    expect(b.status).toBe('ok');
    expect(b.picks).toHaveLength(3);
    expect(ids(b.picks).some((id) => ids(a.picks).includes(id))).toBe(false);
  });

  it('新的不夠一組：先給剩下的並標 last，再按才從頭來並標 restarted', () => {
    // 8 個：第 0、1 組各 3 個，第 2 組只剩 2 個新的，第 3 組從頭再來
    const third = recommendRound(eight, ctx(), seedFor, 2);
    expect(third.status).toBe('last');
    expect(third.picks).toHaveLength(2);
    const seen = [...ids(recommendRound(eight, ctx(), seedFor, 0).picks), ...ids(recommendRound(eight, ctx(), seedFor, 1).picks)];
    expect(ids(third.picks).some((id) => seen.includes(id))).toBe(false);

    const fourth = recommendRound(eight, ctx(), seedFor, 3);
    expect(fourth.status).toBe('restarted');
    expect(fourth.picks).toHaveLength(3);
  });

  it('同樣的輸入結果固定', () => {
    expect(ids(recommendRound(eight, ctx(), seedFor, 2).picks)).toEqual(ids(recommendRound(eight, ctx(), seedFor, 2).picks));
  });

  it('本來就不到 3 個時是 ok，不算看完', () => {
    const r = recommendRound(spots.slice(0, 2), ctx(), seedFor, 0);
    expect(r).toMatchObject({ status: 'ok' });
    expect(r.picks).toHaveLength(2);
  });
});

describe('pickBackup', () => {
  it('幫主行程挑分數最高的完全室內景點，不會挑到自己', () => {
    const b = pickBackup(spots, ctx(), seeds[0]!, 'spot-005');
    expect(b?.spot.env).toBe('in');
    expect(b?.spot.id).not.toBe('spot-005');
  });
  it('沒有室內景點回傳 null', () => {
    expect(pickBackup(spots.filter((s) => s.env !== 'in'), ctx(), seeds[0]!, 'spot-001')).toBeNull();
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
