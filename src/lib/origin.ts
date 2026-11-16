import type { Region } from '../data/enums.ts';
import { type DriveParams, DEFAULT_DRIVE_PARAMS, type LatLng, distanceKm, estimateDriveMins, isEastLabel } from './geo.ts';
import type { MinsOf } from './filter.ts';

export interface Origin {
  label: string;
  lat: number;
  lng: number;
}

export interface OriginPoint {
  name: string;
  lat: number | null;
  lng: number | null;
}
export interface OriginCounty extends OriginPoint {
  towns: OriginPoint[];
}
export interface OriginsFile {
  source: string;
  generated: string | null;
  counties: OriginCounty[];
}

export const DEFAULT_ORIGIN_LABEL = '新北市林口區';

/** origins.json 還沒產生座標時的備用值（林口區公所附近）。 */
const LINKOU_FALLBACK: LatLng = { lat: 25.0775, lng: 121.3916 };

export function findTown(origins: OriginsFile, county: string, town: string): Origin | null {
  const c = origins.counties.find((x) => x.name === county);
  const t = c?.towns.find((x) => x.name === town);
  if (!t || t.lat === null || t.lng === null) return null;
  return { label: county + town, lat: t.lat, lng: t.lng };
}

export function defaultOrigin(origins: OriginsFile): Origin {
  return findTown(origins, '新北市', '林口區') ?? { label: DEFAULT_ORIGIN_LABEL, ...LINKOU_FALLBACK };
}

/** 林口出發時，用人工粗估的 mins_from_linkou（比公式準）。 */
export function isLinkou(origin: Origin): boolean {
  return origin.label === DEFAULT_ORIGIN_LABEL;
}

/** 找最近的鄉鎮市區（給「用目前位置」顯示名稱用）。 */
export function nearestTown(origins: OriginsFile, point: LatLng): { county: string; town: string; km: number } | null {
  let best: { county: string; town: string; km: number } | null = null;
  for (const c of origins.counties) {
    for (const t of c.towns) {
      if (t.lat === null || t.lng === null) continue;
      const km = distanceKm(point, { lat: t.lat, lng: t.lng });
      if (!best || km < best.km) best = { county: c.name, town: t.name, km };
    }
  }
  return best;
}

type Placeable = { id: string; mins_from_linkou: number; lat: number | null; lng: number | null; region: Region };

/**
 * 依出發地算車程：
 * - 林口 → mins_from_linkou
 * - 其他 → 公式粗估；目的地在東部、出發地不在東部時套東部係數
 * - 沒有座標 → null（畫面顯示「車程未知」）
 */
export function makeMinsOf(origin: Origin, params: DriveParams = DEFAULT_DRIVE_PARAMS): MinsOf {
  if (isLinkou(origin)) return (item) => item.mins_from_linkou;
  const originEast = isEastLabel(origin.label);
  const cache = new Map<string, number | null>();
  return (item) => {
    const cached = cache.get(item.id);
    if (cached !== undefined) return cached;
    const p = item as Placeable;
    const mins =
      p.lat === null || p.lng === null || p.lat === undefined || p.lng === undefined
        ? null
        : estimateDriveMins(origin, { lat: p.lat, lng: p.lng }, p.region === '東' && !originEast, params);
    cache.set(item.id, mins);
    return mins;
  };
}

/** 出生年月（YYYY-MM）→「3 歲 2 個月」。 */
export function ageLabel(birthYm: string, today: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(birthYm);
  if (!m) return null;
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const months = (ty - Number(m[1])) * 12 + (tm - Number(m[2]));
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const r = months % 12;
  if (y === 0) return `${r} 個月`;
  return r === 0 ? `${y} 歲` : `${y} 歲 ${r} 個月`;
}
