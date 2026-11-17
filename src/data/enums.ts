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
/**
 * 景點設施：哺乳室、尿布台、好停車、園內有吃的、可帶外食野餐、有遮蔭或室內可躲太陽、
 * 長輩好走（少樓梯、有地方坐）。
 */
export const FACILITIES = ['nursing', 'diaper', 'parking', 'food', 'picnic', 'shade', 'elder'] as const;
/** 餐廳特色：室內遊戲區、溜滑梯或球池、沙坑、戶外草地、可以看或餵動物、建議訂位、有低消或遊戲區另外收費。 */
export const FOOD_TAGS = ['play', 'slide', 'sand', 'outdoor', 'animal', 'reserve', 'fee'] as const;
/** 餐廳價位（每人）：$ 300 元以下、$$ 300–600 元、$$$ 600 元以上。 */
export const FOOD_PRICE_TIERS = ['$', '$$', '$$$'] as const;
/** 住宿類型：飯店、民宿。 */
export const HOTEL_KINDS = ['hotel', 'bnb'] as const;
export const BADGE_KINDS = ['new', 'end'] as const;

export type Region = (typeof REGIONS)[number];
export type SpotType = (typeof SPOT_TYPES)[number];
export type Env = (typeof ENVS)[number];
export type CostTier = (typeof COST_TIERS)[number];
export type PriceTier = (typeof PRICE_TIERS)[number];
export type HotelTag = (typeof HOTEL_TAGS)[number];
export type Facility = (typeof FACILITIES)[number];
export type FoodTag = (typeof FOOD_TAGS)[number];
export type FoodPriceTier = (typeof FOOD_PRICE_TIERS)[number];
export type HotelKind = (typeof HOTEL_KINDS)[number];
