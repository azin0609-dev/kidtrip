import spotsJson from '../../data/spots.json';
import hotelsJson from '../../data/hotels.json';
import originsJson from '../../data/origins.json';
import type { OriginsFile } from '../lib/origin.ts';
import type { Hotel, Spot } from './schema.ts';

// 資料內容由 `npm run validate:data`（CI 必跑）用 zod 檢查，
// 這裡只做型別轉換，不在使用者端重複驗證。
export const spots = spotsJson as unknown as Spot[];
export const hotels = hotelsJson as unknown as Hotel[];
export const origins = originsJson as OriginsFile;

export type { Hotel, Spot } from './schema.ts';
