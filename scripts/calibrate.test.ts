import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type CalibrationSpot, calibrate, evaluate } from './calibrate-lib.ts';

const linkou = { lat: 25.0775, lng: 121.3916 };

describe('calibrate（合成資料）', () => {
  // 用公式本身產生「人工估計」，校正應該找回原本的係數。
  const spots: CalibrationSpot[] = [
    { id: 'a', name: 'a', region: '北', mins_from_linkou: 0, lat: 25.03, lng: 121.56 },
    { id: 'b', name: 'b', region: '中', mins_from_linkou: 0, lat: 24.15, lng: 120.67 },
    { id: 'c', name: 'c', region: '東', mins_from_linkou: 0, lat: 23.99, lng: 121.6 },
    { id: 'd', name: 'd', region: '東', mins_from_linkou: 0, lat: 22.76, lng: 121.14 },
    { id: 'e', name: 'e', region: '南', mins_from_linkou: 0, lat: 22.63, lng: 120.3 },
  ];
  it('完全符合時 100% 在誤差內', () => {
    const truth = spots.map((s) => ({ ...s, mins_from_linkou: evaluate([s], linkou).rows[0]?.estimate ?? 1 }));
    expect(evaluate(truth, linkou).withinRatio).toBe(1);
    expect(calibrate(truth, linkou).withinRatio).toBe(1);
  });
  it('沒有座標的不列入', () => {
    expect(evaluate([{ ...spots[0]!, lat: null }], linkou).count).toBe(0);
  });
});

// 驗收標準：以林口為出發地，至少 80% 景點的公式車程跟 mins_from_linkou 誤差在 ±35% 內。
// 需要正式資料而且已經跑過 npm run geocode；座標不足 20 筆時這個測試會標成 skipped。
const root = fileURLToPath(new URL('../', import.meta.url));
const realSpots = JSON.parse(readFileSync(`${root}data/spots.json`, 'utf8')) as CalibrationSpot[];
const withCoords = realSpots.filter((s) => s.lat !== null && s.lng !== null).length;

describe('車程公式準確度（正式資料）', () => {
  it.skipIf(withCoords < 20)(`至少 80% 景點誤差在 ±35% 內（目前有座標 ${withCoords} 筆）`, () => {
    const result = evaluate(realSpots, linkou);
    expect(result.withinRatio).toBeGreaterThanOrEqual(0.8);
  });
});
