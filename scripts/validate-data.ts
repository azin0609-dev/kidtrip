import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type FreshKind, freshness, lastChecked } from '../src/lib/freshness.ts';
import { todayInTaipei } from '../src/lib/date.ts';
import { formatIssues, validateData, validateOrigins, validateRestaurants, validateTrips } from '../src/data/validate.ts';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));

function readJson(name: string): unknown {
  const path = `${dataDir}${name}`;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    console.error(`✗ 讀不到或無法解析 data/${name}：${(error as Error).message}`);
    process.exit(1);
  }
}

const spots = readJson('spots.json');
const hotels = readJson('hotels.json');
const origins = readJson('origins.json');
const restaurants = readJson('restaurants.json');
const trips = readJson('trips.json');
const issues = [
  ...validateData(spots, hotels),
  ...validateRestaurants(restaurants, spots),
  ...validateTrips(trips),
  ...validateOrigins(origins),
];

if (issues.length > 0) {
  console.error(formatIssues(issues));
  console.error(`\n資料檢查失敗：共 ${issues.length} 個問題。`);
  process.exit(1);
}

// 新鮮度：只是提醒，不會讓檢查失敗。
const today = todayInTaipei();
const stale: string[] = [];
const checkFresh = (file: string, list: unknown, kindOf: (x: Record<string, unknown>) => FreshKind) => {
  if (!Array.isArray(list)) return;
  for (const x of list as Record<string, unknown>[]) {
    const item = x as { id: string; name: string; last_verified: string; verified?: { date: string } };
    const f = freshness(item, kindOf(x), today);
    if (f !== 'fresh') stale.push(`${file} ${item.id} ${item.name}：${lastChecked(item)} 之後沒再確認（${f === 'expired' ? '已不推薦' : '快過期'}）`);
  }
};
checkFresh('spots.json', spots, () => 'spot');
checkFresh('hotels.json', hotels, (x) => (x.kind === 'bnb' ? 'bnb' : 'hotel'));
checkFresh('restaurants.json', restaurants, () => 'food');
if (stale.length > 0) {
  console.warn(`⚠ ${stale.length} 筆資料該重新確認了：`);
  for (const line of stale) console.warn(`  ${line}`);
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
console.log(`資料檢查通過：景點 ${count(spots)} 個、住宿 ${count(hotels)} 間、餐廳 ${count(restaurants)} 間、出國行程 ${count(trips)} 套。`);
