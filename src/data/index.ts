import spotsJson from '../../data/spots.json';
import hotelsJson from '../../data/hotels.json';
import type { Hotel, Spot } from './schema.ts';

// 資料內容由 `npm run validate:data`（CI 必跑）用 zod 檢查，
// 這裡只做型別轉換，不在使用者端重複驗證。
export const spots = spotsJson as unknown as Spot[];
export const hotels = hotelsJson as unknown as Hotel[];

export type { Hotel, Spot } from './schema.ts';
