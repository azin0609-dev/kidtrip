import { describe, expect, it } from 'vitest';
import { makeHotel, makeSpot } from '../test/fixtures.ts';
import { sortByDrive } from './filter.ts';
import { estimateDriveMins } from './geo.ts';
import { type OriginsFile, ageLabel, defaultOrigin, findTown, makeMinsOf, nearestTown } from './origin.ts';

// 測試用的縣市座標（約略位置）。
const origins: OriginsFile = {
  source: 'test',
  generated: '2026-11-16',
  counties: [
    { name: '新北市', lat: 25.01, lng: 121.46, towns: [{ name: '林口區', lat: 25.0775, lng: 121.3916 }] },
    { name: '高雄市', lat: 22.63, lng: 120.3, towns: [{ name: '鳳山區', lat: 22.6266, lng: 120.3563 }, { name: '那瑪夏區', lat: null, lng: null }] },
    { name: '花蓮縣', lat: 23.99, lng: 121.6, towns: [{ name: '花蓮市', lat: 23.9769, lng: 121.6044 }] },
  ],
};

describe('origin', () => {
  it('預設林口', () => {
    expect(defaultOrigin(origins)).toEqual({ label: '新北市林口區', lat: 25.0775, lng: 121.3916 });
    expect(defaultOrigin({ ...origins, counties: [] }).label).toBe('新北市林口區');
  });
  it('findTown：沒座標的找不到', () => {
    expect(findTown(origins, '高雄市', '鳳山區')?.label).toBe('高雄市鳳山區');
    expect(findTown(origins, '高雄市', '那瑪夏區')).toBeNull();
  });
  it('nearestTown', () => {
    expect(nearestTown(origins, { lat: 22.62, lng: 120.35 })).toMatchObject({ county: '高雄市', town: '鳳山區' });
  });
});

describe('makeMinsOf', () => {
  const linkou = defaultOrigin(origins);
  const fengshan = findTown(origins, '高雄市', '鳳山區')!;
  const kaohsiungPark = makeSpot({ id: 'spot-k', region: '南', mins_from_linkou: 240, lat: 22.65, lng: 120.33 });
  const taipeiPark = makeSpot({ id: 'spot-t', region: '北', mins_from_linkou: 35, lat: 25.04, lng: 121.56 });
  const noCoords = makeSpot({ id: 'spot-n', mins_from_linkou: 50 });

  it('林口出發用 mins_from_linkou', () => {
    const minsOf = makeMinsOf(linkou);
    expect(minsOf(kaohsiungPark)).toBe(240);
    expect(minsOf(noCoords)).toBe(50);
  });
  it('其他出發地用公式，沒座標回傳 null', () => {
    const minsOf = makeMinsOf(fengshan);
    expect(minsOf(kaohsiungPark)).toBe(estimateDriveMins(fengshan, { lat: 22.65, lng: 120.33 }));
    expect(minsOf(noCoords)).toBeNull();
  });
  it('換成高雄鳳山出發，高雄的景點排在前面，沒座標的排最後', () => {
    const sorted = sortByDrive([taipeiPark, noCoords, kaohsiungPark], makeMinsOf(fengshan));
    expect(sorted.map((s) => s.id)).toEqual(['spot-k', 'spot-t', 'spot-n']);
  });
  it('西部去東部套東部係數；東部出發不用', () => {
    const hualienSpot = makeHotel({ id: 'hotel-h', region: '東', lat: 23.99, lng: 121.62 });
    const fromWest = makeMinsOf({ label: '臺中市西屯區', lat: 24.18, lng: 120.62 })(hualienSpot)!;
    const plain = estimateDriveMins({ lat: 24.18, lng: 120.62 }, { lat: 23.99, lng: 121.62 });
    expect(fromWest).toBeGreaterThan(plain);
    const fromEast = makeMinsOf({ label: '花蓮縣花蓮市', lat: 23.9769, lng: 121.6044 })(hualienSpot)!;
    expect(fromEast).toBe(estimateDriveMins({ lat: 23.9769, lng: 121.6044 }, { lat: 23.99, lng: 121.62 }));
  });
});

describe('ageLabel', () => {
  it.each([
    ['2023-09', '2026-11-16', '3 歲 2 個月'],
    ['2023-11', '2026-11-16', '3 歲'],
    ['2026-05', '2026-11-16', '6 個月'],
    ['2027-01', '2026-11-16', null],
    ['', '2026-11-16', null],
  ])('%s → %s', (birth, today, label) => {
    expect(ageLabel(birth, today)).toBe(label);
  });
});
