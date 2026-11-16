/**
 * 車程公式校正：npm run calibrate
 * 以林口為出發地，比較公式和 data/spots.json 的 mins_from_linkou，
 * 印出目前參數的準確度和建議參數。要套用就改 src/lib/geo.ts 的 DEFAULT_DRIVE_PARAMS。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type CalibrationSpot, calibrate, evaluate } from './calibrate-lib.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const spots = JSON.parse(readFileSync(`${root}data/spots.json`, 'utf8')) as CalibrationSpot[];
const origins = JSON.parse(readFileSync(`${root}data/origins.json`, 'utf8')) as {
  counties: { name: string; towns: { name: string; lat: number | null; lng: number | null }[] }[];
};
const linkou = origins.counties.find((c) => c.name === '新北市')?.towns.find((t) => t.name === '林口區');
const origin = linkou?.lat != null && linkou.lng != null ? { lat: linkou.lat, lng: linkou.lng } : { lat: 25.0775, lng: 121.3916 };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const now = evaluate(spots, origin);
console.log(`有座標的景點：${now.count} / ${spots.length}`);
if (now.count === 0) {
  console.log('還沒有座標，先跑 npm run geocode。');
  process.exit(0);
}
console.log(`目前參數：道路係數 ${now.params.roadFactor}、東部係數 ${now.params.eastFactor}`);
console.log(`  ±35% 內：${pct(now.withinRatio)}，誤差中位數 ${pct(now.medianError)}`);
const best = calibrate(spots, origin);
console.log(`建議參數：道路係數 ${best.params.roadFactor}、東部係數 ${best.params.eastFactor}`);
console.log(`  ±35% 內：${pct(best.withinRatio)}，誤差中位數 ${pct(best.medianError)}`);
console.log('\n誤差最大的 10 個（目前參數）：');
for (const r of [...now.rows].sort((a, b) => b.error - a.error).slice(0, 10)) {
  console.log(`  ${r.id} ${r.name}：人工 ${r.actual} 分、公式 ${r.estimate} 分（${pct(r.error)}）`);
}
