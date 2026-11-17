import type { CostTier, Env, Facility, FoodPriceTier, FoodTag, HotelKind, HotelTag, PriceTier, Region, SpotType } from '../data/schema.ts';

// 介面文字對照表（不是景點資料）。

export const TYPE_LABELS: Record<SpotType, string> = {
  park: '公園',
  zoo: '動物園',
  farm: '農場',
  theme: '主題樂園',
  sea: '海洋・水族',
  museum: '博物館',
  indoorplay: '室內遊戲',
  train: '火車',
  dino: '恐龍',
  water: '玩水',
};

export const ENV_LABELS: Record<Env, string> = {
  in: '室內',
  semi: '半室內',
  mix: '室內＋戶外',
  out: '戶外',
};

export const COST_LABELS: Record<CostTier, string> = {
  free: '免費',
  $: '$',
  $$: '$$',
  $$$: '$$$',
  '?': '票價待查',
};

export const PRICE_LABELS: Record<PriceTier, string> = {
  $$: '$$',
  $$$: '$$$',
  $$$$: '$$$$',
};

export const HOTEL_TAG_LABELS: Record<HotelTag, string> = {
  play: '遊戲室',
  slide: '溜滑梯',
  pool: '泳池',
  spa: '溫泉',
  park: '戶外遊戲區',
  animal: '動物',
};

export const FACILITY_LABELS: Record<Facility, string> = {
  nursing: '哺乳室',
  diaper: '尿布台',
  parking: '好停車',
  food: '有賣吃的',
  picnic: '可帶便當',
  shade: '有遮蔭',
  elder: '長輩好走',
};

export const FOOD_TAG_LABELS: Record<FoodTag, string> = {
  play: '室內遊戲區',
  slide: '溜滑梯球池',
  sand: '沙坑',
  outdoor: '戶外草地',
  animal: '有動物',
  reserve: '建議訂位',
  fee: '有低消或入場費',
};

export const FOOD_PRICE_LABELS: Record<FoodPriceTier, string> = {
  $: '$',
  $$: '$$',
  $$$: '$$$',
};

export const VERIFIED_SOURCE_LABELS: Record<'official' | 'media' | 'blog', string> = {
  official: '官方資料',
  media: '新聞報導',
  blog: '旅遊部落格',
};

export const HOTEL_KIND_LABELS: Record<HotelKind, string> = {
  hotel: '飯店',
  bnb: '民宿',
};

export const REGION_OPTIONS: Region[] = ['北', '中', '南', '東'];
