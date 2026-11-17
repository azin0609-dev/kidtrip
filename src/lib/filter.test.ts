import { describe, expect, it } from 'vitest';
import type { Restaurant } from '../data/schema.ts';
import { makeHotel, makeSpot } from '../test/fixtures.ts';
import {
  DEFAULT_FOOD_FILTERS,
  DEFAULT_HOTEL_FILTERS,
  DEFAULT_SPOT_FILTERS,
  filterHotels,
  filterRestaurants,
  countyOf,
  filterSpots,
  listCounties,
  matchesDrive,
  sortByDrive,
  tokenize,
  toggleInList,
} from './filter.ts';

const today = '2026-11-20';
const ctx = { today, been: [] as string[] };
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

const spots = [
  makeSpot({ id: 'spot-001', mins_from_linkou: 20, env: 'in', types: ['indoorplay'], cost_tier: '$$', name: '室內樂園' }),
  makeSpot({ id: 'spot-002', mins_from_linkou: 45, env: 'semi', types: ['museum', 'dino'], name: '恐龍館', city: '台北市士林區' }),
  makeSpot({ id: 'spot-003', mins_from_linkou: 100, env: 'out', types: ['farm'], stroller_ok: false, region: '中', name: '牧場' }),
  makeSpot({ id: 'spot-004', mins_from_linkou: 200, env: 'mix', types: ['zoo'], region: '南', name: '動物園', tip: '早上去看餵食' }),
  makeSpot({ id: 'spot-005', mins_from_linkou: 30, closes_on: '2026-11-01', name: '已熄燈' }),
];

describe('matchesDrive', () => {
  it.each([
    [30, '30', true],
    [31, '30', false],
    [60, '60', true],
    [120, '120', true],
    [120, 'overnight', false],
    [121, 'overnight', true],
    [999, 'all', true],
  ] as const)('%s 分 / %s → %s', (mins, drive, expected) => {
    expect(matchesDrive(mins, drive)).toBe(expected);
  });
});

describe('filterSpots', () => {
  it('預設全部顯示，但隱藏已熄燈', () => {
    expect(ids(filterSpots(spots, DEFAULT_SPOT_FILTERS, ctx))).toEqual(['spot-001', 'spot-002', 'spot-003', 'spot-004']);
  });
  it('車程', () => {
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, drive: '30' }, ctx))).toEqual(['spot-001']);
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, drive: 'overnight' }, ctx))).toEqual(['spot-004']);
  });
  it('地區', () => {
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, region: '中' }, ctx))).toEqual(['spot-003']);
  });
  it('下雨也能玩只留 in / semi', () => {
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, rainOk: true }, ctx))).toEqual(['spot-001', 'spot-002']);
  });
  it('免費、推車好推', () => {
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, free: true }, ctx))).toEqual(['spot-002', 'spot-003', 'spot-004']);
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, stroller: true }, ctx))).toEqual(['spot-001', 'spot-002', 'spot-004']);
  });
  it('隱藏去過的', () => {
    const result = filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, hideBeen: true }, { today, been: ['spot-001'] });
    expect(ids(result)).toEqual(['spot-002', 'spot-003', 'spot-004']);
  });
  it('類型多選：符合任一', () => {
    expect(ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, types: ['dino', 'zoo'] }, ctx))).toEqual(['spot-002', 'spot-004']);
  });
  it('條件可以疊加', () => {
    const f = { ...DEFAULT_SPOT_FILTERS, drive: '60' as const, rainOk: true, free: true };
    expect(ids(filterSpots(spots, f, ctx))).toEqual(['spot-002']);
  });
});

describe('搜尋', () => {
  it('空白分隔、含全形空白', () => {
    expect(tokenize('  恐龍\u3000士林  ')).toEqual(['恐龍', '士林']);
  });
  it('比對名稱、城市、說明、類型名稱', () => {
    const q = (query: string) => ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, query }, ctx));
    expect(q('恐龍')).toEqual(['spot-002']);
    expect(q('士林')).toEqual(['spot-002']);
    expect(q('餵食')).toEqual(['spot-004']);
    expect(q('博物館')).toEqual(['spot-002']); // 類型名稱
    expect(q('農場')).toEqual(['spot-003']);
  });
  it('多個關鍵字全部都要符合', () => {
    const q = (query: string) => ids(filterSpots(spots, { ...DEFAULT_SPOT_FILTERS, query }, ctx));
    expect(q('恐龍 士林')).toEqual(['spot-002']);
    expect(q('恐龍 牧場')).toEqual([]);
  });
  it('飯店比對特色與設施', () => {
    const hotels = [
      makeHotel({ id: 'hotel-001', features: ['室內溜滑梯'], tags: ['slide'] }),
      makeHotel({ id: 'hotel-002', name: '海景飯店', features: ['無邊際泳池'], tags: ['pool'], city: '花蓮縣' }),
    ];
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, query: '溜滑梯' }))).toEqual(['hotel-001']);
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, query: '花蓮 泳池' }))).toEqual(['hotel-002']);
  });
  it('英文不分大小寫', () => {
    const s = [makeSpot({ name: 'KidZania 兒童職業體驗' })];
    expect(filterSpots(s, { ...DEFAULT_SPOT_FILTERS, query: 'kidzania' }, ctx)).toHaveLength(1);
  });
});

describe('filterHotels', () => {
  const hotels = [
    makeHotel({ id: 'hotel-001', mins_from_linkou: 50, tags: ['pool', 'play'] }),
    makeHotel({ id: 'hotel-002', mins_from_linkou: 150, tags: ['spa'], region: '東' }),
    makeHotel({ id: 'hotel-003', mins_from_linkou: 90, tags: ['animal'] }),
  ];
  it('車程、地區、設施（符合任一）', () => {
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, drive: '60' }))).toEqual(['hotel-001']);
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, region: '東' }))).toEqual(['hotel-002']);
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, tags: ['play', 'animal'] }))).toEqual(['hotel-001', 'hotel-003']);
  });
});

describe('sortByDrive', () => {
  it('由近到遠，同分照 id，不改原陣列', () => {
    const input = [
      makeSpot({ id: 'spot-003', mins_from_linkou: 50 }),
      makeSpot({ id: 'spot-002', mins_from_linkou: 10 }),
      makeSpot({ id: 'spot-001', mins_from_linkou: 50 }),
    ];
    expect(ids(sortByDrive(input))).toEqual(['spot-002', 'spot-001', 'spot-003']);
    expect(ids(input)).toEqual(['spot-003', 'spot-002', 'spot-001']);
  });
});

describe('toggleInList', () => {
  it('有就拿掉、沒有就加上', () => {
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('4 小時內、縣市、住宿類型', () => {
  it('4 小時內是 240 分以內', () => {
    expect(matchesDrive(240, '240')).toBe(true);
    expect(matchesDrive(241, '240')).toBe(false);
    expect(matchesDrive(200, 'overnight')).toBe(true);
  });
  it('countyOf：台／臺統一、去掉鄉鎮與括號', () => {
    expect(countyOf('臺東縣臺東市')).toBe('台東縣');
    expect(countyOf('桃園市中壢區（青埔）')).toBe('桃園市');
    expect(countyOf('宜蘭縣')).toBe('宜蘭縣');
    expect(countyOf('不明')).toBeNull();
  });
  it('listCounties：算筆數、近的排前面', () => {
    const items = [
      makeSpot({ id: 'spot-001', city: '宜蘭縣礁溪鄉', mins_from_linkou: 70 }),
      makeSpot({ id: 'spot-002', city: '宜蘭縣冬山鄉', mins_from_linkou: 90 }),
      makeSpot({ id: 'spot-003', city: '新北市林口區', mins_from_linkou: 10 }),
      makeSpot({ id: 'spot-004', city: '台東縣卑南鄉', mins_from_linkou: 320 }),
    ];
    expect(listCounties(items)).toEqual([
      { county: '新北市', count: 1 },
      { county: '宜蘭縣', count: 2 },
      { county: '台東縣', count: 1 },
    ]);
  });
  it('選縣市只留那個縣市', () => {
    const list = [
      makeSpot({ id: 'spot-001', city: '宜蘭縣礁溪鄉' }),
      makeSpot({ id: 'spot-002', city: '新北市林口區' }),
    ];
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, county: '宜蘭縣' }, ctx))).toEqual(['spot-001']);
    const hotels = [
      makeHotel({ id: 'hotel-001', city: '宜蘭縣礁溪鄉' }),
      makeHotel({ id: 'hotel-002', city: '宜蘭縣冬山鄉', kind: 'bnb' }),
      makeHotel({ id: 'hotel-003', city: '台東縣卑南鄉', kind: 'bnb' }),
    ];
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, county: '宜蘭縣' }))).toEqual(['hotel-001', 'hotel-002']);
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, county: '宜蘭縣', kind: 'bnb' }))).toEqual(['hotel-002']);
    expect(ids(filterHotels(hotels, { ...DEFAULT_HOTEL_FILTERS, query: '民宿' }))).toEqual(['hotel-002', 'hotel-003']);
  });
});

describe('設施篩選', () => {
  const list = [
    makeSpot({ id: 'spot-001', facilities: ['nursing', 'parking', 'elder'], transit: '捷運圓山站走路 3 分' }),
    makeSpot({ id: 'spot-002', facilities: ['parking'] }),
    makeSpot({ id: 'spot-003' }),
  ];
  it('選了的每一項都要有', () => {
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, facilities: ['parking'] }, ctx))).toEqual(['spot-001', 'spot-002']);
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, facilities: ['parking', 'nursing'] }, ctx))).toEqual(['spot-001']);
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, facilities: ['elder'] }, ctx))).toEqual(['spot-001']);
  });
  it('可以搜尋設施名稱和大眾運輸', () => {
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, query: '哺乳室' }, ctx))).toEqual(['spot-001']);
    expect(ids(filterSpots(list, { ...DEFAULT_SPOT_FILTERS, query: '圓山' }, ctx))).toEqual(['spot-001']);
  });
});

describe('餐廳篩選', () => {
  const food = (o: Partial<Restaurant>): Restaurant => ({
    id: 'food-001',
    name: '測試餐廳',
    city: '宜蘭縣礁溪鄉',
    region: '北',
    cuisine: '簡餐',
    price_tier: '$$',
    tags: ['play'],
    mins_from_linkou: 70,
    tip: '有遊戲區。',
    near_spot_ids: [],
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-17',
    ...o,
  });
  const list = [
    food({ id: 'food-001', tags: ['play', 'sand'] }),
    food({ id: 'food-002', city: '新北市林口區', mins_from_linkou: 10, tags: ['play'], cuisine: '日式料理' }),
    food({ id: 'food-003', tags: ['outdoor'], mins_from_linkou: 90 }),
  ];
  it('車程、縣市、特色（都要有）、搜尋', () => {
    expect(ids(filterRestaurants(list, DEFAULT_FOOD_FILTERS))).toEqual(['food-001', 'food-002', 'food-003']);
    expect(ids(filterRestaurants(list, { ...DEFAULT_FOOD_FILTERS, drive: '30' }))).toEqual(['food-002']);
    expect(ids(filterRestaurants(list, { ...DEFAULT_FOOD_FILTERS, county: '宜蘭縣' }))).toEqual(['food-001', 'food-003']);
    expect(ids(filterRestaurants(list, { ...DEFAULT_FOOD_FILTERS, tags: ['play', 'sand'] }))).toEqual(['food-001']);
    expect(ids(filterRestaurants(list, { ...DEFAULT_FOOD_FILTERS, query: '沙坑' }))).toEqual(['food-001']);
    expect(ids(filterRestaurants(list, { ...DEFAULT_FOOD_FILTERS, query: '日式' }))).toEqual(['food-002']);
  });
});
