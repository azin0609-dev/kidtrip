/** 車程粗估（PRD 任務 1-4）。純函式，不呼叫任何 API。 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 兩點直線距離（公里，haversine）。 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface DriveParams {
  /** 道路係數：直線距離 × 這個數字 ≈ 實際道路距離。 */
  roadFactor: number;
  /** 從西部去東部（花東）時，道路係數再乘上這個數字（山路、蘇花、南迴）。 */
  eastFactor: number;
  /** [距離上限 km, 平均時速 km/h]，依序比對。 */
  speedBands: readonly (readonly [number, number])[];
  /** 停車、找路的固定時間。 */
  extraMins: number;
}

/**
 * 依 PRD 初版公式。eastFactor 是以林口出發、對 mins_from_linkou 校正的結果；
 * 拿到有座標的正式資料後，用 `npm run calibrate` 重新算一次。
 */
export const DEFAULT_DRIVE_PARAMS: DriveParams = {
  roadFactor: 1.35,
  eastFactor: 1.5,
  speedBands: [
    [15, 30],
    [60, 55],
    [150, 75],
    [Infinity, 95],
  ],
  extraMins: 5,
};

export function speedFor(roadKm: number, params: DriveParams = DEFAULT_DRIVE_PARAMS): number {
  for (const [maxKm, speed] of params.speedBands) {
    if (roadKm <= maxKm) return speed;
  }
  return params.speedBands[params.speedBands.length - 1]?.[1] ?? 60;
}

/**
 * 粗估開車分鐘數。
 * @param crossToEast 目的地在東部、出發地在西部時為 true。
 */
export function estimateDriveMins(
  from: LatLng,
  to: LatLng,
  crossToEast = false,
  params: DriveParams = DEFAULT_DRIVE_PARAMS,
): number {
  const factor = params.roadFactor * (crossToEast ? params.eastFactor : 1);
  const roadKm = distanceKm(from, to) * factor;
  return Math.round((roadKm / speedFor(roadKm, params)) * 60 + params.extraMins);
}

/** 花蓮、臺東是東部；宜蘭在資料裡算北部，走國五不用加係數。 */
const EAST_COUNTIES = ['花蓮縣', '臺東縣'];

export function normalizeTai(text: string): string {
  return text.replace(/台/g, '臺');
}

export function isEastLabel(label: string): boolean {
  const t = normalizeTai(label);
  return EAST_COUNTIES.some((c) => t.includes(c));
}

/** 誤差比例：|估計 − 實際| ÷ 實際。 */
export function relativeError(estimate: number, actual: number): number {
  return Math.abs(estimate - actual) / actual;
}
