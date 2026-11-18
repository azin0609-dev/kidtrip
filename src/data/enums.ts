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
/** 查證來源：官方、新聞媒體、旅遊部落格、Google 地圖（只記「哪天看過、看了什麼」，不存 Google 的內容）。 */
export const VERIFY_SOURCES = ['official', 'media', 'blog', 'google_maps'] as const;
/**
 * 高風險的未確認項目：有任何一項，景點就暫停自動推薦（資料保留，等查證）。
 * access_unknown 外人能不能進去不確定；location_unknown 實際位置或停車不確定；
 * facility_unknown 主要設施還在不在不確定；status_conflict 營業狀態的來源互相矛盾。
 */
export const RISK_FLAGS = ['access_unknown', 'location_unknown', 'facility_unknown', 'status_conflict'] as const;
/** 有、沒有、還不知道。 */
export const TRI_STATES = ['yes', 'no', 'unknown'] as const;

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
export type VerifySource = (typeof VERIFY_SOURCES)[number];
export type RiskFlag = (typeof RISK_FLAGS)[number];
export type TriState = (typeof TRI_STATES)[number];
