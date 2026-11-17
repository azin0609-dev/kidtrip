import { describe, expect, it } from 'vitest';
import { freshness, freshnessNote, lastChecked } from './freshness.ts';

describe('資料新鮮度', () => {
  const item = { last_verified: '2026-01-01' };

  it('有查證紀錄而且比較新，就用查證日期', () => {
    expect(lastChecked({ last_verified: '2026-01-01', verified: { date: '2026-11-17' } })).toBe('2026-11-17');
    expect(lastChecked({ last_verified: '2026-11-20', verified: { date: '2026-11-17' } })).toBe('2026-11-20');
    expect(lastChecked(item)).toBe('2026-01-01');
  });

  it('餐廳、民宿 90 天、景點與飯店 180 天', () => {
    expect(freshness(item, 'food', '2026-04-01')).toBe('fresh'); // 90 天
    expect(freshness(item, 'food', '2026-04-02')).toBe('stale'); // 91 天
    expect(freshness(item, 'bnb', '2026-04-02')).toBe('stale');
    expect(freshness(item, 'spot', '2026-04-02')).toBe('fresh');
    expect(freshness(item, 'spot', '2026-06-30')).toBe('fresh'); // 剛好 180 天
    expect(freshness(item, 'spot', '2026-07-01')).toBe('stale'); // 181 天
    expect(freshness(item, 'hotel', '2026-07-01')).toBe('stale');
  });

  it('超過兩倍期限就是 expired', () => {
    expect(freshness(item, 'food', '2026-07-01')).toBe('expired'); // 181 天
    expect(freshness(item, 'spot', '2026-12-31')).toBe('expired'); // 364 天
  });

  it('提醒文字', () => {
    expect(freshnessNote(item, 'food', '2026-02-01')).toBeNull();
    expect(freshnessNote(item, 'food', '2026-04-15')).toContain('有點舊了');
    expect(freshnessNote(item, 'food', '2026-08-01')).toContain('可能已經改變');
  });
});
