/** geocode 腳本用到的純函式（可單元測試，不連網）。 */
import { distanceKm, normalizeTai } from '../src/lib/geo.ts';

export interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

/** 「新北市林口區（青埔）」→ { county: '新北市', town: '林口區' } */
export function parseCity(city: string): { county: string | null; town: string | null } {
  const text = normalizeTai(city.replace(/[（(][^）)]*[）)]/g, '').replace(/\s/g, ''));
  const county = /^(.{2}[縣市])/.exec(text)?.[1] ?? null;
  const rest = county ? text.slice(county.length) : text;
  const town = /^(.{1,3}?[區鄉鎮市])/.exec(rest)?.[1] ?? null;
  return { county, town };
}

function normalizeName(text: string): string {
  return normalizeTai(text)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s・·,，、\-－_()（）「」]/g, '');
}

function bigrams(text: string): string[] {
  const chars = [...text];
  if (chars.length < 2) return chars;
  return chars.slice(1).map((c, i) => chars[i] + c);
}

/** 名稱相似度（字元 bigram Dice 係數，0–1）。其中一方包含另一方時視為 1。 */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x.includes(y) || y.includes(x)) return 1;
  const bx = bigrams(x);
  const by = bigrams(y);
  const pool = [...by];
  let hit = 0;
  for (const g of bx) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (bx.length + by.length);
}

/** 優先選地址裡有同縣市的結果；都沒有就回傳第一筆並標示縣市不符。 */
export function pickResult(
  results: readonly NominatimResult[],
  county: string | null,
): { result: NominatimResult; countyMatched: boolean } | null {
  const first = results[0];
  if (!first) return null;
  if (!county) return { result: first, countyMatched: true };
  const match = results.find((r) => normalizeTai(r.display_name).includes(county));
  return match ? { result: match, countyMatched: true } : { result: first, countyMatched: false };
}

export interface GeocodeOutcome {
  file: string;
  id: string;
  name: string;
  city: string;
  query: string;
  status: 'ok' | 'not_found' | 'error';
  lat?: number;
  lng?: number;
  resultName?: string;
  countyMatched?: boolean;
  /** 跟所屬縣市代表座標的距離（km）。 */
  kmFromCounty?: number;
  similarity?: number;
  error?: string;
}

/** 超過這個距離（km）就列入人工檢查。台灣最長的縣（花蓮、臺東、屏東）約 150 km，取一半。 */
export const FAR_FROM_COUNTY_KM = 60;
/** 名稱相似度低於這個值就列入人工檢查。 */
export const LOW_SIMILARITY = 0.35;

export function annotateDistance(
  outcome: GeocodeOutcome,
  countyCenters: ReadonlyMap<string, { lat: number; lng: number }>,
): GeocodeOutcome {
  if (outcome.lat === undefined || outcome.lng === undefined) return outcome;
  const { county } = parseCity(outcome.city);
  const center = county ? countyCenters.get(county) : undefined;
  if (!center) return outcome;
  return { ...outcome, kmFromCounty: Math.round(distanceKm(center, { lat: outcome.lat, lng: outcome.lng })) };
}

const mdEscape = (s: string) => s.replace(/\|/g, '\\|');

export function buildReport(outcomes: readonly GeocodeOutcome[], generatedAt: string, hasCountyCenters: boolean): string {
  const notFound = outcomes.filter((o) => o.status !== 'ok');
  const far = outcomes.filter(
    (o) => o.status === 'ok' && ((o.kmFromCounty ?? 0) > FAR_FROM_COUNTY_KM || o.countyMatched === false),
  );
  const unlike = outcomes.filter((o) => o.status === 'ok' && (o.similarity ?? 1) < LOW_SIMILARITY);
  const ok = outcomes.filter((o) => o.status === 'ok');

  const lines: string[] = [
    '# 座標補齊報告',
    '',
    `產生時間：${generatedAt}｜資料來源：© OpenStreetMap contributors（Nominatim）`,
    '',
    `這次查詢 ${outcomes.length} 筆：成功 ${ok.length}、查不到 ${notFound.length}、離縣市太遠 ${far.length}、名稱不像 ${unlike.length}。`,
    '',
    '請人工檢查下面列出的項目。修正方式：直接在 JSON 改 lat / lng；要重查就把 lat、lng 改回 null 再跑一次。',
    '',
    '## 查不到',
    '',
  ];
  if (notFound.length === 0) lines.push('（無）');
  else {
    lines.push('| id | 名稱 | 城市 | 查詢字串 | 原因 |', '|---|---|---|---|---|');
    for (const o of notFound)
      lines.push(`| ${o.id} | ${mdEscape(o.name)} | ${mdEscape(o.city)} | ${mdEscape(o.query)} | ${o.status === 'error' ? mdEscape(o.error ?? '錯誤') : '沒有結果'} |`);
  }

  lines.push('', `## 離所屬縣市中心太遠（> ${FAR_FROM_COUNTY_KM} km，或地址不在同縣市）`, '');
  if (!hasCountyCenters) lines.push('（data/origins.json 還沒有縣市座標，這項先只看地址是否同縣市）', '');
  if (far.length === 0) lines.push('（無）');
  else {
    lines.push('| id | 名稱 | 城市 | 距離 | 同縣市 | OSM 結果 | 座標 |', '|---|---|---|---|---|---|---|');
    for (const o of far)
      lines.push(
        `| ${o.id} | ${mdEscape(o.name)} | ${mdEscape(o.city)} | ${o.kmFromCounty ?? '—'} km | ${o.countyMatched ? '是' : '否'} | ${mdEscape(o.resultName ?? '')} | ${o.lat}, ${o.lng} |`,
      );
  }

  lines.push('', `## 名稱比對不像（相似度 < ${LOW_SIMILARITY}）`, '');
  if (unlike.length === 0) lines.push('（無）');
  else {
    lines.push('| id | 名稱 | OSM 結果 | 相似度 | 座標 |', '|---|---|---|---|---|');
    for (const o of unlike)
      lines.push(`| ${o.id} | ${mdEscape(o.name)} | ${mdEscape(o.resultName ?? '')} | ${(o.similarity ?? 0).toFixed(2)} | ${o.lat}, ${o.lng} |`);
  }

  lines.push('', '## 全部結果', '');
  if (outcomes.length === 0) lines.push('（這次沒有需要查的資料，全部都已經有座標）');
  else {
    lines.push('| id | 名稱 | 狀態 | 座標 | OSM 結果 |', '|---|---|---|---|---|');
    for (const o of outcomes)
      lines.push(
        `| ${o.id} | ${mdEscape(o.name)} | ${o.status === 'ok' ? '成功' : '查不到'} | ${o.lat ?? ''}${o.lat !== undefined ? ', ' : ''}${o.lng ?? ''} | ${mdEscape(o.resultName ?? '')} |`,
      );
  }
  return lines.join('\n') + '\n';
}
