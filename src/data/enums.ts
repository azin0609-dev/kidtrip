// 資料欄位允許的值（PRD 第 7 節）。不依賴 zod，畫面可以直接 import。

export const REGIONS = ['北', '中', '南', '東'] as const;
export const SPOT_TYPES = [
  'park',
  'zoo',
  'farm',
  'theme',
  'sea',
  'museum',
  'indoorplay',
  'train',
  'dino',
  'water',
] as const;
export const ENVS = ['in', 'semi', 'mix', 'out'] as const;
export const COST_TIERS = ['free', '$', '$$', '$$$', '?'] as const;
export const PRICE_TIERS = ['$$', '$$$', '$$$$'] as const;
export const HOTEL_TAGS = ['play', 'slide', 'pool', 'spa', 'park', 'animal'] as const;
export const BADGE_KINDS = ['new', 'end'] as const;

export type Region = (typeof REGIONS)[number];
export type SpotType = (typeof SPOT_TYPES)[number];
export type Env = (typeof ENVS)[number];
export type CostTier = (typeof COST_TIERS)[number];
export type PriceTier = (typeof PRICE_TIERS)[number];
export type HotelTag = (typeof HOTEL_TAGS)[number];
