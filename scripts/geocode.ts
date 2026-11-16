/**
 * 座標補齊腳本（只在開發時跑）。
 *
 *   GEOCODE_CONTACT=you@example.com npm run geocode            # 補 spots / hotels 的 lat、lng
 *   GEOCODE_CONTACT=you@example.com npm run geocode -- --origins   # 產生 data/origins.json
 *   npm run geocode -- --dry-run                               # 只列出要查哪些，不連網
 *
 * 規則（PRD 任務 1-4、AGENTS.md）：
 * - OpenStreetMap Nominatim，每秒最多 1 次請求，User-Agent 帶專案名稱與聯絡方式。
 * - 已經有座標的不覆蓋。每查完一筆就寫回檔案，中斷後再跑會接著做。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type GeocodeOutcome,
  type NominatimResult,
  annotateDistance,
  buildReport,
  nameSimilarity,
  parseCity,
  pickResult,
} from './geocode-lib.ts';
import { TAIWAN_TOWNS } from './taiwan-towns.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const path = (p: string) => `${root}${p}`;
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const ORIGINS = args.has('--origins');

const MIN_INTERVAL_MS = 1100; // 每秒最多 1 次，多留 0.1 秒緩衝
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const pkg = JSON.parse(readFileSync(path('package.json'), 'utf8')) as { name: string; version: string };
const contact = process.env.GEOCODE_CONTACT?.trim();
if (!DRY_RUN && !contact) {
  console.error('請設定聯絡方式（Email 或網址），Nominatim 規定 User-Agent 要能聯絡到你：');
  console.error('  GEOCODE_CONTACT=you@example.com npm run geocode');
  process.exit(1);
}
const USER_AGENT = `${pkg.name}/${pkg.version} (${contact ?? 'dry-run'})`;

let lastRequestAt = 0;
async function nominatim(query: string): Promise<NominatimResult[]> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'tw', limit: '5', 'accept-language': 'zh-TW' });
  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (res.status === 429 || res.status === 403) {
    throw new Error(`Nominatim 拒絕請求（HTTP ${res.status}），請稍後再試，不要連續重跑`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as NominatimResult[];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function writeJson(file: string, data: unknown) {
  writeFileSync(path(file), JSON.stringify(data, null, 2) + '\n');
}

// ---------- origins.json ----------

interface OriginPoint {
  name: string;
  lat: number | null;
  lng: number | null;
}
interface OriginCounty extends OriginPoint {
  towns: OriginPoint[];
}
interface OriginsFile {
  source: string;
  generated: string | null;
  counties: OriginCounty[];
}

function loadOrigins(): OriginsFile | null {
  try {
    return JSON.parse(readFileSync(path('data/origins.json'), 'utf8')) as OriginsFile;
  } catch {
    return null;
  }
}

async function buildOrigins() {
  const existing = loadOrigins();
  const file: OriginsFile = {
    source: '© OpenStreetMap contributors（Nominatim），各縣市、鄉鎮市區的代表座標',
    generated: existing?.generated ?? null,
    counties: Object.entries(TAIWAN_TOWNS).map(([county, towns]) => {
      const old = existing?.counties.find((c) => c.name === county);
      return {
        name: county,
        lat: old?.lat ?? null,
        lng: old?.lng ?? null,
        towns: towns.map((t) => {
          const o = old?.towns.find((x) => x.name === t);
          return { name: t, lat: o?.lat ?? null, lng: o?.lng ?? null };
        }),
      };
    }),
  };

  const todo: { label: string; query: string; target: OriginPoint; county: string }[] = [];
  for (const c of file.counties) {
    if (c.lat === null) todo.push({ label: c.name, query: c.name, target: c, county: c.name });
    for (const t of c.towns) {
      if (t.lat === null) todo.push({ label: c.name + t.name, query: `${t.name}, ${c.name}`, target: t, county: c.name });
    }
  }
  const total = file.counties.reduce((n, c) => n + 1 + c.towns.length, 0);
  console.log(`origins：共 ${total} 筆，要查 ${todo.length} 筆（約 ${Math.ceil((todo.length * MIN_INTERVAL_MS) / 60000)} 分鐘）`);
  if (DRY_RUN) {
    if (!existing) writeJson('data/origins.json', file);
    return;
  }

  const failed: string[] = [];
  for (const [i, item] of todo.entries()) {
    try {
      const picked = pickResult(await nominatim(item.query), item.county);
      if (picked && picked.countyMatched) {
        item.target.lat = round6(Number(picked.result.lat));
        item.target.lng = round6(Number(picked.result.lon));
        file.generated = new Date().toISOString().slice(0, 10);
        writeJson('data/origins.json', file);
        console.log(`[${i + 1}/${todo.length}] ✓ ${item.label}`);
      } else {
        failed.push(item.label);
        console.log(`[${i + 1}/${todo.length}] ✗ ${item.label}`);
      }
    } catch (error) {
      failed.push(item.label);
      console.error(`[${i + 1}/${todo.length}] ✗ ${item.label}：${(error as Error).message}`);
      if ((error as Error).message.includes('拒絕')) break;
    }
  }
  writeJson('data/origins.json', file);
  if (failed.length > 0) {
    console.log(`\n查不到 ${failed.length} 筆，請手動補座標：${failed.join('、')}`);
    process.exitCode = 1;
  }
}

// ---------- spots / hotels ----------

interface Place {
  id: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

async function geocodePlaces() {
  const files = ['data/spots.json', 'data/hotels.json'] as const;
  const data = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(path(f), 'utf8')) as Place[]]));
  const todo = files.flatMap((f) => (data[f] ?? []).filter((p) => p.lat === null || p.lng === null).map((p) => ({ file: f, place: p })));
  console.log(`要查 ${todo.length} 筆（約 ${Math.ceil((todo.length * MIN_INTERVAL_MS * 2) / 60000)} 分鐘內）`);
  for (const t of todo) console.log(`  ${t.place.id} ${t.place.name}`);
  if (DRY_RUN) return;

  const origins = loadOrigins();
  const countyCenters = new Map<string, { lat: number; lng: number }>();
  for (const c of origins?.counties ?? []) if (c.lat !== null && c.lng !== null) countyCenters.set(c.name, { lat: c.lat, lng: c.lng });

  const outcomes: GeocodeOutcome[] = [];
  let stop = false;
  for (const [i, { file, place }] of todo.entries()) {
    if (stop) break;
    const { county, town } = parseCity(place.city);
    const area = [county, town].filter(Boolean).join('');
    const queries = [`${place.name} ${area}`, place.name];
    const base = { file, id: place.id, name: place.name, city: place.city };
    let outcome: GeocodeOutcome = { ...base, query: queries[0] ?? place.name, status: 'not_found' };

    for (const query of queries) {
      try {
        const picked = pickResult(await nominatim(query), county);
        if (!picked) continue;
        const { result, countyMatched } = picked;
        const resultName = result.name || result.display_name.split(',')[0] || '';
        outcome = {
          ...base,
          query,
          status: 'ok',
          lat: round6(Number(result.lat)),
          lng: round6(Number(result.lon)),
          resultName: result.display_name,
          countyMatched,
          similarity: Math.round(nameSimilarity(place.name, resultName) * 100) / 100,
        };
        // 縣市不符時試下一個查詢字串，還是不符才採用。
        if (countyMatched) break;
      } catch (error) {
        outcome = { ...base, query, status: 'error', error: (error as Error).message };
        if ((error as Error).message.includes('拒絕')) stop = true;
        break;
      }
    }

    outcome = annotateDistance(outcome, countyCenters);
    outcomes.push(outcome);
    if (outcome.status === 'ok' && outcome.lat !== undefined && outcome.lng !== undefined) {
      place.lat = outcome.lat;
      place.lng = outcome.lng;
      writeJson(file, data[file]);
    }
    console.log(`[${i + 1}/${todo.length}] ${outcome.status === 'ok' ? '✓' : '✗'} ${place.id} ${place.name}`);
  }

  writeFileSync(path('data/geocode-report.md'), buildReport(outcomes, new Date().toISOString(), countyCenters.size > 0));
  console.log('\n已產生 data/geocode-report.md，請人工檢查。');
}

await (ORIGINS ? buildOrigins() : geocodePlaces());
