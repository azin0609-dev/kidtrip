import { z } from 'zod';

// 錯誤訊息用繁體中文。
z.config(z.locales.zhTW());

/** 依 docs/PRD.md 第 7 節定義的資料格式。 */

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

export type Region = (typeof REGIONS)[number];
export type SpotType = (typeof SPOT_TYPES)[number];
export type Env = (typeof ENVS)[number];
export type CostTier = (typeof COST_TIERS)[number];
export type PriceTier = (typeof PRICE_TIERS)[number];
export type HotelTag = (typeof HOTEL_TAGS)[number];
export type Badge = z.infer<typeof badgeSchema>;
export type Spot = z.infer<typeof spotSchema>;
export type Hotel = z.infer<typeof hotelSchema>;
