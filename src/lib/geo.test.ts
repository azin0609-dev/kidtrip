import { describe, expect, it } from 'vitest';
import { formatEstimate } from './format.ts';
import { distanceKm, estimateDriveMins, isEastLabel, speedFor } from './geo.ts';

const linkou = { lat: 25.0775, lng: 121.3916 };
const taipei101 = { lat: 25.0339, lng: 121.5645 };

describe('distanceKm', () => {
  it('林口到台北 101 約 18 km', () => {
    expect(distanceKm(linkou, taipei101)).toBeGreaterThan(16);
    expect(distanceKm(linkou, taipei101)).toBeLessThan(20);
  });
  it('同一點是 0', () => {
    expect(distanceKm(linkou, linkou)).toBe(0);
  });
});

describe('estimateDriveMins', () => {
  it('依道路距離套不同速度', () => {
    expect(speedFor(10)).toBe(30);
    expect(speedFor(15)).toBe(30);
    expect(speedFor(40)).toBe(55);
    expect(speedFor(100)).toBe(75);
    expect(speedFor(300)).toBe(95);
  });
  it('套用 PRD 公式：直線 × 1.35 ÷ 速度 + 5 分', () => {
    const km = distanceKm(linkou, taipei101) * 1.35;
    expect(estimateDriveMins(linkou, taipei101)).toBe(Math.round((km / 55) * 60 + 5));
  });
  it('原地出發也有 5 分鐘', () => {
    expect(estimateDriveMins(linkou, linkou)).toBe(5);
  });
  it('去東部比同距離的西部久', () => {
    const hualien = { lat: 23.9871, lng: 121.6015 };
    expect(estimateDriveMins(linkou, hualien, true)).toBeGreaterThan(estimateDriveMins(linkou, hualien, false));
  });
});

describe('isEastLabel', () => {
  it('花東是東部，宜蘭不算', () => {
    expect(isEastLabel('花蓮縣吉安鄉')).toBe(true);
    expect(isEastLabel('台東縣臺東市')).toBe(true);
    expect(isEastLabel('宜蘭縣礁溪鄉')).toBe(false);
  });
});

describe('formatEstimate', () => {
  it.each([
    [3, '約 5 分（粗估）'],
    [23, '約 25 分（粗估）'],
    [59, '約 60 分（粗估）'],
    [60, '約 1 小時（粗估）'],
    [100, '約 1.5 小時（粗估）'],
    [130, '約 2 小時（粗估）'],
  ])('%s 分 → %s', (mins, text) => {
    expect(formatEstimate(mins)).toBe(text);
  });
});
