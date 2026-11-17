import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { type RecommendContext, recommendRound, weekSeed } from './recommend.ts';
import { buildShareUrl, countNew, decodeShare, encodeShare, mergeShare } from './share.ts';
import { formatReports, parseState } from './storage.ts';

const mine = { fav: ['spot-001'], been: ['spot-002'], beenAt: { 'spot-002': '2026-10-01' } };

describe('分享連結', () => {
  it('編碼再解碼內容不變，而且可以放進網址', () => {
    const code = encodeShare(mine);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(code)).toEqual(mine);
  });
  it('只帶收藏和去過，不帶出發地、孩子資料', () => {
    const state = { ...mine, origin: { label: 'x', lat: 1, lng: 2 }, kids: [{ nickname: '果果', birthYm: '2023-09' }] };
    const url = buildShareUrl('https://example.com/kidtrip/?a=1#favs', state);
    expect(url.startsWith('https://example.com/kidtrip/?share=')).toBe(true);
    const decoded = decodeShare(new URL(url).searchParams.get('share')!);
    expect(decoded).toEqual(mine);
    expect(JSON.stringify(decoded)).not.toContain('果果');
  });
  it('亂碼、格式不對回傳 null；奇怪的 id 會被濾掉', () => {
    expect(decodeShare('%%%')).toBeNull();
    expect(decodeShare('bm90IGpzb24')).toBeNull();
    const code = btoa(JSON.stringify({ f: ['spot-001', '<script>', 5], b: ['hotel-010'], d: { 'hotel-010': 'bad', 'spot-999': '2026-01-01' } }));
    expect(decodeShare(code)).toEqual({ fav: ['spot-001'], been: ['hotel-010'], beenAt: {} });
  });
  it('合併取聯集，日期留比較新的，不會刪掉原本的', () => {
    const state = { fav: ['spot-001'], been: ['spot-002'], beenAt: { 'spot-002': '2026-10-01' }, origin: { label: 'x', lat: 1, lng: 2 } };
    const incoming = { fav: ['spot-001', 'spot-005'], been: ['spot-002', 'spot-003'], beenAt: { 'spot-002': '2026-11-01', 'spot-003': '2026-09-01' } };
    expect(countNew(state, incoming)).toEqual({ fav: 1, been: 1 });
    const merged = mergeShare(state, incoming);
    expect(merged.fav).toEqual(['spot-001', 'spot-005']);
    expect(merged.been).toEqual(['spot-002', 'spot-003']);
    expect(merged.beenAt).toEqual({ 'spot-002': '2026-11-01', 'spot-003': '2026-09-01' });
    expect(merged.origin).toEqual(state.origin);
    const older = mergeShare(state, { fav: [], been: ['spot-002'], beenAt: { 'spot-002': '2026-01-01' } });
    expect(older.beenAt).toEqual({ 'spot-002': '2026-10-01' });
  });
});

describe('回報資料有誤', () => {
  it('存取與整理成文字', () => {
    const state = parseState(JSON.stringify({ fav: [], been: [], reports: [{ id: 'spot-001', note: '週一沒開', date: '2026-11-17' }, { id: 3 }] }));
    expect(state.reports).toEqual([{ id: 'spot-001', note: '週一沒開', date: '2026-11-17' }]);
    expect(formatReports(state.reports!, () => '測試公園')).toBe('2026-11-17｜測試公園（spot-001）：週一沒開');
  });
});

describe('換一組', () => {
  const linkou = { lat: 25.0775, lng: 121.3916 };
  const today = '2026-11-20';
  const ctx: RecommendContext = { today, minsOf: (s) => s.mins_from_linkou, fav: [], been: [], beenAt: {}, rainy: false, overnight: false };
  const types = ['park', 'zoo', 'farm', 'museum'] as const;
  const spots = Array.from({ length: 8 }, (_, i) =>
    makeSpot({ id: `spot-00${i + 1}`, types: [types[i % 4]!], mins_from_linkou: 20 + i * 5 }),
  );
  const seedFor = (n: number) => weekSeed(today, linkou, n);
  const ids = (round: number) => recommendRound(spots, ctx, seedFor, round).map((r) => r.spot.id);

  it('每按一次都換到沒看過的', () => {
    const a = ids(0);
    const b = ids(1);
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(b.some((id) => a.includes(id))).toBe(false);
  });
  it('全部看完會從頭再來，而且還是 3 個', () => {
    // 8 個景點：第 0、1 組各 3 個，剩 2 個不夠，第 2 組重新開始。
    expect(ids(2)).toHaveLength(3);
    expect(ids(5)).toHaveLength(3);
  });
  it('同樣的輸入結果固定', () => {
    expect(ids(1)).toEqual(ids(1));
    expect(ids(3)).toEqual(ids(3));
  });
});
