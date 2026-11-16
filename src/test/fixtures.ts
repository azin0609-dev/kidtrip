import type { Hotel, Spot } from '../data/schema.ts';

// 測試用假資料，只給單元測試用。

export function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 'spot-001',
    name: '測試公園',
    city: '新北市林口區',
    region: '北',
    types: ['park'],
    env: 'out',
    cost_tier: 'free',
    stroller_ok: true,
    mins_from_linkou: 30,
    tip: '帶果果去跑跑。',
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-16',
    ...overrides,
  };
}

export function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  return {
    id: 'hotel-001',
    name: '測試飯店',
    city: '宜蘭縣礁溪鄉',
    region: '北',
    price_tier: '$$$',
    tags: ['pool'],
    features: ['遊戲室'],
    mins_from_linkou: 70,
    tip: '核桃可以借嬰兒床。',
    near_spot_ids: [],
    lat: null,
    lng: null,
    google_place_id: null,
    needs_verify: [],
    last_verified: '2026-11-16',
    ...overrides,
  };
}
