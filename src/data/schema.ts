import { z } from 'zod';

// 錯誤訊息用繁體中文。
z.config(z.locales.zhTW());

/** 依 docs/PRD.md 第 7 節定義的資料格式。 */

import {
  BADGE_KINDS,
  COST_TIERS,
  ENVS,
  FACILITIES,
  FOOD_PRICE_TIERS,
  FOOD_TAGS,
  HOTEL_KINDS,
  HOTEL_TAGS,
  PRICE_TIERS,
  REGIONS,
  SPOT_TYPES,
} from './enums.ts';

export * from './enums.ts';

/** YYYY-MM-DD，而且必須是真實存在的日期（例如 2026-02-30 不行）。 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: '必須是合法日期，格式 YYYY-MM-DD' });

const nonEmpty = z.string().trim().min(1, { message: '不可為空字串' });

const coordinate = z.number().finite().nullable();

const minsFromLinkou = z
  .number({ message: '必須是數字' })
  .int({ message: '必須是正整數' })
  .positive({ message: '必須是正整數' });

export const badgeSchema = z.object({
  kind: z.enum(BADGE_KINDS),
  label: nonEmpty,
});

export const spotSchema = z.object({
  id: z.string().regex(/^spot-\d{3,}$/, { message: 'id 格式必須是 spot-001' }),
  name: nonEmpty,
  city: nonEmpty,
  region: z.enum(REGIONS),
  types: z.array(z.enum(SPOT_TYPES)).min(1, { message: '至少要有一個類型' }),
  env: z.enum(ENVS),
  cost_tier: z.enum(COST_TIERS),
  stroller_ok: z.boolean(),
  mins_from_linkou: minsFromLinkou,
  tip: nonEmpty,
  badge: badgeSchema.optional(),
  opens_on: isoDate.optional(),
  closes_on: isoDate.optional(),
  /** 選填：公休日、要不要預約之類的一句提醒，例如「週一公休」。 */
  open_note: nonEmpty.optional(),
  /** 選填：最適合的年齡範圍 [最小, 最大]（歲）；最大 12 代表「以上都可以」。 */
  age_best: z
    .tuple([z.number().int().min(0).max(12), z.number().int().min(0).max(12)])
    .refine(([min, max]) => min <= max, { message: '年齡範圍的最小值不能大於最大值' })
    .optional(),
  /** 選填：建議停留幾小時。 */
  stay_hours: z.number().positive().max(12).optional(),
  /** 選填：設施。 */
  facilities: z.array(z.enum(FACILITIES)).optional(),
  /** 選填：大眾運輸怎麼到，例如「捷運圓山站走路 3 分」。 */
  transit: nonEmpty.optional(),
  /** 選填：人潮、時段建議。 */
  crowd_tip: nonEmpty.optional(),
  /** 選填：特別適合去的月份（1–12）。 */
  best_months: z.array(z.number().int().min(1).max(12)).optional(),
  lat: coordinate,
  lng: coordinate,
  google_place_id: z.string().nullable(),
  needs_verify: z.array(z.string()),
  last_verified: isoDate,
});

export const hotelSchema = z.object({
  id: z.string().regex(/^hotel-\d{3,}$/, { message: 'id 格式必須是 hotel-001' }),
  name: nonEmpty,
  city: nonEmpty,
  region: z.enum(REGIONS),
  kind: z.enum(HOTEL_KINDS),
  price_tier: z.enum(PRICE_TIERS),
  tags: z.array(z.enum(HOTEL_TAGS)),
  features: z.array(z.string()),
  mins_from_linkou: minsFromLinkou,
  tip: nonEmpty,
  near_spot_ids: z.array(z.string()),
  lat: coordinate,
  lng: coordinate,
  google_place_id: z.string().nullable(),
  needs_verify: z.array(z.string()),
  last_verified: isoDate,
});

export const restaurantSchema = z.object({
  id: z.string().regex(/^food-\d{3,}$/, { message: 'id 格式必須是 food-001' }),
  name: nonEmpty,
  city: nonEmpty,
  region: z.enum(REGIONS),
  /** 料理類型，例如「義式」「日式」「簡餐」。 */
  cuisine: nonEmpty,
  price_tier: z.enum(FOOD_PRICE_TIERS),
  tags: z.array(z.enum(FOOD_TAGS)),
  mins_from_linkou: minsFromLinkou,
  tip: nonEmpty,
  open_note: nonEmpty.optional(),
  near_spot_ids: z.array(z.string()),
  lat: coordinate,
  lng: coordinate,
  google_place_id: z.string().nullable(),
  needs_verify: z.array(z.string()),
  last_verified: isoDate,
});

const tripStop = z.object({
  name: nonEmpty,
  /** 選填：Google Maps 搜尋用的當地名稱（日文原名比較找得到）。 */
  query: nonEmpty.optional(),
  area: nonEmpty,
  indoor: z.boolean(),
  tip: nonEmpty,
  /** 選填：需要事先預約或買票的說明。 */
  booking: nonEmpty.optional(),
});

/** 出國行程（大方向的行程骨架，不像台灣景點那麼細）。 */
export const tripSchema = z.object({
  id: z.string().regex(/^trip-[a-z0-9-]+$/, { message: 'id 格式必須是 trip-xxx（小寫英數與 -）' }),
  title: nonEmpty,
  country: nonEmpty,
  region: nonEmpty,
  days: z.number().int().positive().max(30),
  best_seasons: z.array(nonEmpty).min(1),
  age_hint: nonEmpty,
  base_cities: z.array(nonEmpty).min(1),
  summary: nonEmpty,
  tips: z.array(nonEmpty),
  itinerary: z
    .array(
      z.object({
        day: z.number().int().positive(),
        title: nonEmpty,
        stay: nonEmpty.optional(),
        stops: z.array(tripStop).min(1),
      }),
    )
    .min(1),
  needs_verify: z.array(z.string()),
  last_verified: isoDate,
});

const originPoint = z.object({
  name: nonEmpty,
  lat: z.number().min(21).max(27).nullable(),
  lng: z.number().min(118).max(123).nullable(),
});

export const originsSchema = z.object({
  source: nonEmpty,
  generated: isoDate.nullable(),
  counties: z
    .array(originPoint.extend({ towns: z.array(originPoint).min(1) }))
    .length(22, { message: '必須是 22 個縣市' }),
});

export type Badge = z.infer<typeof badgeSchema>;
export type Spot = z.infer<typeof spotSchema>;
export type Hotel = z.infer<typeof hotelSchema>;
export type Restaurant = z.infer<typeof restaurantSchema>;
export type Trip = z.infer<typeof tripSchema>;
