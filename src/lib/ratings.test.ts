import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { passportProgress, passportTitle, stampsToNextTitle, yearReview } from './passport.ts';
import { parseRatings, preferenceFor, setStars, toggleRatingTag, typePreference } from './ratings.ts';
import { type RecommendContext, recommend, scoreSpot, weekSeed } from './recommend.ts';
import { decodeShare, encodeShare, mergeShare } from './share.ts';
import { parseState } from './storage.ts';

describe('評分', () => {
  it('parseRatings 丟掉格式不對的', () => {
    expect(parseRatings({ 'spot-001': { stars: 5, tags: ['again', 'x', 'again'] }, 'spot-002': { stars: 9 }, 'spot-003': 'no' })).toEqual({
      'spot-001': { stars: 5, tags: ['again'] },
    });
    expect(parseRatings('x')).toBeNull();
  });
  it('存取：壞資料不影響其他欄位', () => {
    const s = parseState(JSON.stringify({ fav: [], been: ['spot-001'], ratings: { 'spot-001': { stars: 4, tags: [] } } }));
    expect(s.ratings).toEqual({ 'spot-001': { stars: 4, tags: [] } });
    expect(parseState(JSON.stringify({ fav: [], been: [], ratings: 5 })).ratings).toBeUndefined();
  });
  it('setStars：再點一次取消；toggleRatingTag 要先有星數', () => {
    const a = setStars({}, 'spot-001', 4);
    expect(a).toEqual({ 'spot-001': { stars: 4, tags: [] } });
    expect(toggleRatingTag({}, 'spot-001', 'again')).toEqual({});
    const b = toggleRatingTag(a, 'spot-001', 'kidlove');
    expect(b['spot-001']?.tags).toEqual(['kidlove']);
    expect(setStars(b, 'spot-001', 5)['spot-001']).toEqual({ stars: 5, tags: ['kidlove'] });
    expect(setStars(b, 'spot-001', 4)).toEqual({});
  });
  it('類型喜好', () => {
    const spots = [
      makeSpot({ id: 'spot-001', types: ['zoo'] }),
      makeSpot({ id: 'spot-002', types: ['zoo', 'farm'] }),
      makeSpot({ id: 'spot-003', types: ['museum'] }),
    ];
    const pref = typePreference(spots, { 'spot-001': { stars: 5, tags: [] }, 'spot-002': { stars: 4, tags: [] }, 'spot-003': { stars: 1, tags: [] } });
    expect(pref).toEqual({ zoo: 1.5, farm: 1, museum: -2 });
    expect(preferenceFor({ types: ['zoo', 'park'] }, pref)).toBe(1.5);
    expect(preferenceFor({ types: ['park'] }, pref)).toBe(0);
  });
});

describe('評分影響推薦', () => {
  const today = '2026-11-20';
  const ctx = (o: Partial<RecommendContext> = {}): RecommendContext => ({
    today,
    minsOf: (s) => s.mins_from_linkou,
    fav: [],
    been: [],
    beenAt: {},
    rainy: false,
    overnight: false,
    ...o,
  });
  it('2 顆星以下不再推', () => {
    const s = makeSpot({ id: 'spot-001' });
    expect(scoreSpot(s, ctx({ ratings: { 'spot-001': { stars: 2, tags: [] } } }))).toBeNull();
    expect(scoreSpot(s, ctx({ ratings: { 'spot-001': { stars: 3, tags: [] } } }))).not.toBeNull();
  });
  it('給過高分加分並寫在原因', () => {
    const s = makeSpot({ id: 'spot-001' });
    const base = scoreSpot(s, ctx({ been: ['spot-001'] }))!;
    const rated = scoreSpot(s, ctx({ been: ['spot-001'], ratings: { 'spot-001': { stars: 5, tags: [] } } }))!;
    expect(rated.score).toBeGreaterThan(base.score);
    expect(rated.reasons).toContain('你們給過 5 顆星');
  });
  it('喜歡的類型多推、不喜歡的少推', () => {
    const spots = [
      makeSpot({ id: 'spot-001', types: ['zoo'] }),
      makeSpot({ id: 'spot-002', types: ['museum'] }),
      makeSpot({ id: 'spot-003', types: ['zoo'] }),
      makeSpot({ id: 'spot-004', types: ['museum'] }),
    ];
    const ratings = { 'spot-001': { stars: 5, tags: [] }, 'spot-002': { stars: 1, tags: [] } };
    const r = recommend(spots, ctx({ been: ['spot-001', 'spot-002'], ratings }), weekSeed(today, { lat: 25, lng: 121 }));
    const zoo = r.find((x) => x.spot.id === 'spot-003')!;
    const museum = r.find((x) => x.spot.id === 'spot-004');
    expect(zoo.reasons).toContain('你們喜歡這一類');
    expect(r.some((x) => x.spot.id === 'spot-002')).toBe(false);
    if (museum) expect(zoo.score).toBeGreaterThan(museum.score - 15); // 隨機分最多 15
  });
});

describe('分享連結帶評分', () => {
  it('編碼解碼、合併時自己的優先', () => {
    const state = { fav: [], been: ['spot-001', 'spot-002'], beenAt: {}, ratings: { 'spot-001': { stars: 5, tags: ['again' as const] } } };
    const decoded = decodeShare(encodeShare(state))!;
    expect(decoded.ratings).toEqual(state.ratings);
    const merged = mergeShare(
      { fav: [], been: ['spot-001'], ratings: { 'spot-001': { stars: 3, tags: [] } } },
      { fav: [], been: ['spot-002'], beenAt: {}, ratings: { 'spot-001': { stars: 5, tags: [] }, 'spot-002': { stars: 4, tags: [] } } },
    );
    expect(merged.ratings).toEqual({ 'spot-001': { stars: 3, tags: [] }, 'spot-002': { stars: 4, tags: [] } });
  });
});

describe('集章護照', () => {
  const spots = [
    makeSpot({ id: 'spot-001', region: '北' }),
    makeSpot({ id: 'spot-002', region: '北' }),
    makeSpot({ id: 'spot-003', region: '北', closes_on: '2026-01-01' }),
    makeSpot({ id: 'spot-004', region: '東' }),
  ];
  const isOpen = (s: { closes_on?: string }) => !s.closes_on;
  it('各區進度；已熄燈沒去過的不算進總數', () => {
    const p = passportProgress(spots, ['spot-001'], isOpen);
    expect(p.map((x) => [x.region, x.visited.length, x.total, x.complete])).toEqual([
      ['北', 1, 2, false],
      ['中', 0, 0, false],
      ['南', 0, 0, false],
      ['東', 0, 1, false],
    ]);
    expect(passportProgress(spots, ['spot-001', 'spot-002'], isOpen)[0]?.complete).toBe(true);
    // 熄燈前去過的還是一個章
    expect(passportProgress(spots, ['spot-003'], isOpen)[0]).toMatchObject({ total: 3 });
  });
  it('稱號', () => {
    expect(passportTitle(0)).toBe('恐龍蛋');
    expect(passportTitle(1)).toBe('剛破殼的小恐龍');
    expect(passportTitle(10)).toBe('小恐龍冒險王');
    expect(stampsToNextTitle(0)).toBe(1);
    expect(stampsToNextTitle(4)).toBe(6);
    expect(stampsToNextTitle(60)).toBeNull();
  });
});

describe('年度回顧', () => {
  const spots = [
    makeSpot({ id: 'spot-001', region: '北', types: ['zoo'], mins_from_linkou: 45 }),
    makeSpot({ id: 'spot-002', region: '北', types: ['zoo', 'farm'], mins_from_linkou: 90 }),
    makeSpot({ id: 'spot-003', region: '南', types: ['museum'], mins_from_linkou: 240 }),
    makeSpot({ id: 'spot-004', region: '東', types: ['sea'], mins_from_linkou: 300 }),
  ];
  const beenAt = { 'spot-001': '2026-03-05', 'spot-002': '2026-03-20', 'spot-003': '2026-11-01', 'spot-004': '2025-08-01' };
  const ratings = { 'spot-001': { stars: 5, tags: [] }, 'spot-003': { stars: 4, tags: [] } };
  it('只算那一年', () => {
    const r = yearReview(spots, beenAt, ratings, 2026);
    expect(r.count).toBe(3);
    expect(r.topRegion).toBe('北');
    expect(r.topType).toBe('zoo');
    expect(r.farthest?.id).toBe('spot-003');
    expect(r.avgStars).toBe(4.5);
    expect(r.favorites.map((s) => s.id)).toEqual(['spot-001']);
    expect(r.byMonth[2]).toBe(2);
    expect(r.byMonth[10]).toBe(1);
  });
  it('沒有紀錄', () => {
    const r = yearReview(spots, {}, {}, 2026);
    expect(r).toMatchObject({ count: 0, topRegion: null, topType: null, farthest: null, avgStars: null });
  });
});
