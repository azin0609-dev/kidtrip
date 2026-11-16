import { z } from 'zod';

// 錯誤訊息用繁體中文。
z.config(z.locales.zhTW());

/** 依 docs/PRD.md 第 7 節定義的資料格式。 */

import {
  BADGE_KINDS,
  COST_TIERS,
  ENVS,
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
