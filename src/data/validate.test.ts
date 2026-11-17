import { describe, expect, it } from 'vitest';
import { isValidIsoDate } from './schema.ts';
import { validateData, validateOrigins, validateRestaurants } from './validate.ts';

// 測試用的假資料，只用來驗證檢查邏輯，不會出現在畫面上。
function makeSpot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spot-001',
    name: '測試公園',
    city: '新北市林口區',
    region: '北',
    types: ['park'],
    env: 'out',
    cost_tier: 'free',
    stroller_ok: true,
    mins_from_linkou: 10,
    tip: '帶果果去跑跑。',
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-16',
    ...overrides,
  };
}

function makeHotel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hotel-001',
    name: '測試飯店',
    city: '宜蘭縣礁溪鄉',
    region: '北',
    kind: 'hotel',
    price_tier: '$$$',
    tags: ['pool'],
    features: ['遊戲室'],
    mins_from_linkou: 70,
    tip: '核桃可以借嬰兒床。',
    near_spot_ids: ['spot-001'],
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-16',
    ...overrides,
  };
}

describe('validateData', () => {
  it('合法資料沒有問題', () => {
    expect(validateData([makeSpot()], [makeHotel()])).toEqual([]);
  });

  it('接受選填的 badge、opens_on、closes_on', () => {
    const spot = makeSpot({
      badge: { kind: 'new', label: '11/24 開幕' },
      opens_on: '2026-11-24',
      closes_on: '2027-01-31',
    });
    expect(validateData([spot], [makeHotel()])).toEqual([]);
  });

  it('region 不合法時指出是哪一筆', () => {
    const issues = validateData([makeSpot(), makeSpot({ id: 'spot-002', region: '西' })], [makeHotel()]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'spots.json', id: 'spot-002', field: 'region' });
  });

  it('檢查各個 enum 欄位', () => {
    const issues = validateData(
      [makeSpot({ types: ['park', 'castle'], env: 'inside', cost_tier: '$$$$' })],
      [makeHotel({ price_tier: '$', tags: ['gym'] })],
    );
    const fields = issues.map((i) => `${i.file}:${i.field}`);
    expect(fields).toEqual(
      expect.arrayContaining([
        'spots.json:types[1]',
        'spots.json:env',
        'spots.json:cost_tier',
        'hotels.json:price_tier',
        'hotels.json:tags[0]',
      ]),
    );
  });

  it('缺少必填欄位', () => {
    const spot: Record<string, unknown> = makeSpot();
    delete spot.tip;
    delete spot.stroller_ok;
    const issues = validateData([spot], [makeHotel()]);
    expect(issues.map((i) => i.field).sort()).toEqual(['stroller_ok', 'tip']);
  });

  it('id 重複', () => {
    const issues = validateData([makeSpot(), makeSpot()], [makeHotel(), makeHotel()]);
    expect(issues.filter((i) => i.message === 'id 重複')).toHaveLength(2);
  });

  it('id 格式錯誤', () => {
    const issues = validateData([makeSpot({ id: 'spot1' })], [makeHotel({ id: 'h-1', near_spot_ids: [] })]);
    expect(issues.map((i) => `${i.id}:${i.field}`)).toEqual(['spot1:id', 'h-1:id']);
  });

  it('near_spot_ids 找不到景點', () => {
    const issues = validateData([makeSpot()], [makeHotel({ near_spot_ids: ['spot-001', 'spot-999'] })]);
    expect(issues).toEqual([
      { file: 'hotels.json', id: 'hotel-001', field: 'near_spot_ids[1]', message: '找不到景點 spot-999' },
    ]);
  });

  it('opens_on、closes_on、last_verified 必須是合法日期', () => {
    const issues = validateData(
      [makeSpot({ opens_on: '2026/11/24', closes_on: '2026-02-30', last_verified: '2026-13-01' })],
      [makeHotel()],
    );
    expect(issues.map((i) => i.field).sort()).toEqual(['closes_on', 'last_verified', 'opens_on']);
  });

  it('熄燈日早於開幕日', () => {
    const issues = validateData([makeSpot({ opens_on: '2026-12-01', closes_on: '2026-11-01' })], [makeHotel()]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('closes_on');
  });

  it.each([0, -10, 12.5, '30', null])('mins_from_linkou = %s 不合法', (value) => {
    const issues = validateData([makeSpot({ mins_from_linkou: value })], [makeHotel()]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe('mins_from_linkou');
  });

  it('沒有 id 的資料用索引標示', () => {
    const spot: Record<string, unknown> = makeSpot();
    delete spot.id;
    const issues = validateData([makeSpot(), spot], [makeHotel()]);
    expect(issues[0]).toMatchObject({ id: '#1', field: 'id' });
  });

  it('空陣列視為錯誤', () => {
    const issues = validateData([], [makeHotel({ near_spot_ids: [] })]);
    expect(issues).toEqual([{ file: 'spots.json', id: '(整個檔案)', field: '', message: '沒有任何資料' }]);
  });

  it('最外層不是陣列', () => {
    const issues = validateData({}, [makeHotel({ near_spot_ids: [] })]);
    expect(issues[0]?.message).toBe('最外層必須是陣列');
  });
});

describe('isValidIsoDate', () => {
  it.each([
    ['2026-11-24', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-1-5', false],
    ['20261124', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidIsoDate(value)).toBe(expected);
  });
});

describe('validateOrigins', () => {
  const county = (name: string, towns: number) => ({
    name,
    lat: null,
    lng: null,
    towns: Array.from({ length: towns }, (_, i) => ({ name: `區${i}`, lat: 25, lng: 121.5 })),
  });
  const make = (counts: number[]) => ({
    source: 'OSM',
    generated: null,
    counties: counts.map((n, i) => county(`縣${i}`, n)),
  });
  const ok = [...Array(21).fill(17), 11] as number[]; // 21×17 + 11 = 368

  it('22 縣市 368 鄉鎮通過', () => {
    expect(validateOrigins(make(ok))).toEqual([]);
  });
  it('數量不對', () => {
    expect(validateOrigins(make([...ok.slice(0, 21), 10]))[0]?.message).toContain('367');
    expect(validateOrigins(make(ok.slice(0, 21)))[0]?.message).toContain('22');
  });
  it('座標超出台灣範圍', () => {
    const data = make(ok);
    data.counties[0]!.towns[0]!.lat = 35;
    expect(validateOrigins(data)).toHaveLength(1);
  });
});

describe('validateRestaurants', () => {
  const food = (o: Record<string, unknown> = {}) => ({
    id: 'food-001',
    name: '測試餐廳',
    city: '新北市林口區',
    region: '北',
    cuisine: '簡餐',
    price_tier: '$$',
    tags: ['play'],
    mins_from_linkou: 10,
    tip: '有遊戲區。',
    near_spot_ids: ['spot-001'],
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-17',
    ...o,
  });
  it('合法資料、空陣列都通過', () => {
    expect(validateRestaurants([food()], [makeSpot()])).toEqual([]);
    expect(validateRestaurants([], [makeSpot()])).toEqual([]);
  });
  it('enum、id 格式、重複、找不到景點', () => {
    const issues = validateRestaurants(
      [food({ tags: ['pool'] }), food(), food({ id: 'rest-1', near_spot_ids: ['spot-999'] })],
      [makeSpot()],
    );
    const text = issues.map((i) => `${i.id}:${i.field}:${i.message}`).join('|');
    expect(text).toContain('food-001:tags[0]');
    expect(text).toContain('food-001:id:id 重複');
    expect(text).toContain('rest-1:id');
    expect(text).toContain('找不到景點 spot-999');
  });
});
