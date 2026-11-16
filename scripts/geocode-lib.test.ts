import { describe, expect, it } from 'vitest';
import { annotateDistance, buildReport, nameSimilarity, parseCity, pickResult } from './geocode-lib.ts';
import { TAIWAN_TOWNS } from './taiwan-towns.ts';

describe('TAIWAN_TOWNS', () => {
  it('22 縣市、368 鄉鎮市區，同縣市內不重複', () => {
    expect(Object.keys(TAIWAN_TOWNS)).toHaveLength(22);
    expect(Object.values(TAIWAN_TOWNS).flat()).toHaveLength(368);
    for (const towns of Object.values(TAIWAN_TOWNS)) expect(new Set(towns).size).toBe(towns.length);
  });
});

describe('parseCity', () => {
  it.each([
    ['新北市林口區', '新北市', '林口區'],
    ['桃園市中壢區（青埔）', '桃園市', '中壢區'],
    ['台中市西屯區', '臺中市', '西屯區'],
    ['嘉義市東區', '嘉義市', '東區'],
    ['宜蘭縣礁溪鄉', '宜蘭縣', '礁溪鄉'],
    ['苗栗縣頭份市', '苗栗縣', '頭份市'],
    ['臺東縣太麻里鄉', '臺東縣', '太麻里鄉'],
    ['新北市', '新北市', null],
  ])('%s', (city, county, town) => {
    expect(parseCity(city)).toEqual({ county, town });
  });
});

describe('nameSimilarity', () => {
  it('包含關係視為 1', () => {
    expect(nameSimilarity('兒童新樂園', '臺北市立兒童新樂園')).toBe(1);
  });
  it('台／臺、括號不影響', () => {
    expect(nameSimilarity('台中科博館（恐龍廳）', '臺中科博館')).toBe(1);
  });
  it('完全不像接近 0', () => {
    expect(nameSimilarity('親子農場', '加油站')).toBe(0);
  });
});

describe('pickResult', () => {
  const r = (display_name: string) => ({ lat: '25', lon: '121', display_name });
  it('優先同縣市', () => {
    const picked = pickResult([r('某公園, 臺中市'), r('某公園, 林口區, 新北市')], '新北市');
    expect(picked?.result.display_name).toContain('新北市');
    expect(picked?.countyMatched).toBe(true);
  });
  it('都不同縣市就用第一筆並標示', () => {
    expect(pickResult([r('某公園, 臺中市')], '新北市')?.countyMatched).toBe(false);
  });
  it('沒有結果', () => {
    expect(pickResult([], '新北市')).toBeNull();
  });
});

describe('report', () => {
  const ok = { file: 'data/spots.json', id: 'spot-001', name: '測試公園', city: '新北市林口區', query: 'q', status: 'ok' as const };
  it('算出離縣市中心的距離', () => {
    const centers = new Map([['新北市', { lat: 25.0, lng: 121.5 }]]);
    const far = annotateDistance({ ...ok, lat: 23.0, lng: 120.2 }, centers);
    expect(far.kmFromCounty).toBeGreaterThan(200);
  });
  it('分類列出查不到、太遠、名稱不像', () => {
    const md = buildReport(
      [
        { ...ok, status: 'not_found' },
        { ...ok, id: 'spot-002', lat: 23, lng: 120, kmFromCounty: 250, countyMatched: true, similarity: 1 },
        { ...ok, id: 'spot-003', lat: 25, lng: 121, kmFromCounty: 3, countyMatched: true, similarity: 0.1, resultName: '加油站' },
      ],
      '2026-11-16T00:00:00Z',
      true,
    );
    const section = (title: string) => md.split('## ').find((s) => s.startsWith(title)) ?? '';
    expect(section('查不到')).toContain('spot-001');
    expect(section('離所屬縣市中心太遠')).toContain('spot-002');
    expect(section('離所屬縣市中心太遠')).not.toContain('spot-003');
    expect(section('名稱比對不像')).toContain('spot-003');
    expect(md).toContain('© OpenStreetMap contributors');
  });
});
