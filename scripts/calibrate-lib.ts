import { type DriveParams, DEFAULT_DRIVE_PARAMS, estimateDriveMins, relativeError } from '../src/lib/geo.ts';

export interface CalibrationSpot {
  id: string;
  name: string;
  region: string;
  mins_from_linkou: number;
  lat: number | null;
  lng: number | null;
}

export interface CalibrationResult {
  params: DriveParams;
  count: number;
  withinRatio: number;
  medianError: number;
  rows: { id: string; name: string; actual: number; estimate: number; error: number }[];
}

/** 以林口為出發地，算出公式和 mins_from_linkou 的誤差。 */
export function evaluate(
  spots: readonly CalibrationSpot[],
  origin: { lat: number; lng: number },
  params: DriveParams = DEFAULT_DRIVE_PARAMS,
  tolerance = 0.35,
): CalibrationResult {
  const rows = spots
    .filter((s): s is CalibrationSpot & { lat: number; lng: number } => s.lat !== null && s.lng !== null)
    .map((s) => {
      const estimate = estimateDriveMins(origin, { lat: s.lat, lng: s.lng }, s.region === '東', params);
      return { id: s.id, name: s.name, actual: s.mins_from_linkou, estimate, error: relativeError(estimate, s.mins_from_linkou) };
    });
  const errors = rows.map((r) => r.error).sort((a, b) => a - b);
  return {
    params,
    count: rows.length,
    withinRatio: rows.length === 0 ? 0 : rows.filter((r) => r.error <= tolerance).length / rows.length,
    medianError: errors.length === 0 ? 0 : (errors[Math.floor(errors.length / 2)] ?? 0),
    rows,
  };
}

/** 格點搜尋道路係數與東部係數：先求 ±35% 內比例最高，再求中位數誤差最小。 */
export function calibrate(spots: readonly CalibrationSpot[], origin: { lat: number; lng: number }): CalibrationResult {
  let best = evaluate(spots, origin);
  for (let road = 1.15; road <= 1.701; road += 0.05) {
    for (let east = 1.0; east <= 2.201; east += 0.1) {
      const params = { ...DEFAULT_DRIVE_PARAMS, roadFactor: Math.round(road * 100) / 100, eastFactor: Math.round(east * 10) / 10 };
      const r = evaluate(spots, origin, params);
      if (r.withinRatio > best.withinRatio || (r.withinRatio === best.withinRatio && r.medianError < best.medianError)) best = r;
    }
  }
  return best;
}
