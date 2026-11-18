/** 週末天氣（Open-Meteo，免金鑰）。看的是「選定時段」的逐時預報。解析與判斷都是純函式。 */

/** 降雨機率到這個數字，推薦就自動偏向室內（PRD 2-2）。 */
export const RAINY_THRESHOLD = 60;
/** 快取 1 小時。 */
export const WEATHER_TTL_MS = 60 * 60 * 1000;

/** 出門時段：週六或週日、上午或下午。 */
export const SLOTS = ['sat-am', 'sat-pm', 'sun-am', 'sun-pm'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  'sat-am': '週六上午',
  'sat-pm': '週六下午',
  'sun-am': '週日上午',
  'sun-pm': '週日下午',
};

/** 各時段看哪幾個小時的預報：上午 9–12 點、下午 14–17 點。 */
const SLOT_HOURS: Record<'am' | 'pm', number[]> = { am: [9, 10, 11], pm: [14, 15, 16] };

export function isSlot(v: unknown): v is Slot {
  return typeof v === 'string' && (SLOTS as readonly string[]).includes(v);
}

export interface HourForecast {
  /** YYYY-MM-DD（Asia/Taipei） */
  date: string;
  /** 0–23 */
  hour: number;
  /** 降雨機率 0–100；沒有資料是 null */
  rainProb: number | null;
  temp: number | null;
}

/** 座標取到小數 1 位（約 10 公里）再送出：天氣夠準，也不會把精確位置傳給外部服務。 */
export function roundForWeather(n: number): number {
  return Math.round(n * 10) / 10;
}

export function weatherUrl(point: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    latitude: String(roundForWeather(point.lat)),
    longitude: String(roundForWeather(point.lng)),
    hourly: 'precipitation_probability,temperature_2m',
    timezone: 'Asia/Taipei',
    forecast_days: '8',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** 同一個（四捨五入後的）位置共用快取。 */
export function weatherCacheKey(point: { lat: number; lng: number }): string {
  return `${roundForWeather(point.lat)},${roundForWeather(point.lng)}`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 解析 Open-Meteo 的逐時回應；格式不對回傳空陣列。 */
export function parseForecast(json: unknown): HourForecast[] {
  if (!json || typeof json !== 'object') return [];
  const hourly = (json as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== 'object') return [];
  const h = hourly as Record<string, unknown>;
  const time = h.time;
  if (!Array.isArray(time)) return [];
  const col = (key: string) => (Array.isArray(h[key]) ? (h[key] as unknown[]) : []);
  const rain = col('precipitation_probability');
  const temp = col('temperature_2m');
  return time.flatMap((t, i) => {
    const m = typeof t === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):/.exec(t) : null;
    return m ? [{ date: m[1]!, hour: Number(m[2]), rainProb: num(rain[i]), temp: num(temp[i]) }] : [];
  });
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = 週日
}

/** 這一週（週一到週日）的週六或週日是哪一天。週日當天選「週六」會得到昨天。 */
export function slotDate(today: string, slot: Slot): string {
  const dow = dayOfWeek(today) || 7; // 週一 = 1 … 週日 = 7
  return addDays(today, (slot.startsWith('sat') ? 6 : 7) - dow);
}

/** 預設時段：平日和週六 → 週六上午；週日 → 週日上午。 */
export function defaultSlot(today: string): Slot {
  return dayOfWeek(today) === 0 ? 'sun-am' : 'sat-am';
}

/** 可以選的時段：週日只剩週日（週六已經過了）；其他天四個都能選。 */
export function availableSlots(today: string): Slot[] {
  return dayOfWeek(today) === 0 ? ['sun-am', 'sun-pm'] : [...SLOTS];
}

/** 選過的時段如果已經過了（例如週六選的，週日再打開），換成預設時段。 */
export function normalizeSlot(today: string, slot: Slot): Slot {
  return availableSlots(today).includes(slot) ? slot : defaultSlot(today);
}

/** 「週六上午 11/21」 */
export function slotLabelWithDate(today: string, slot: Slot): string {
  const [, m, d] = slotDate(today, slot).split('-').map(Number) as [number, number, number];
  return `${SLOT_LABELS[slot]} ${m}/${d}`;
}

export interface SlotWeather {
  slot: Slot;
  date: string;
  /** 這個時段幾個小時裡最高的降雨機率 */
  rainProb: number | null;
  tempMin: number | null;
  tempMax: number | null;
  rainy: boolean;
}

/** 選定時段的天氣；預報裡沒有那個時段（已經過了、或太遠）回傳 null。 */
export function slotWeather(forecast: readonly HourForecast[], today: string, slot: Slot): SlotWeather | null {
  const date = slotDate(today, slot);
  const hours = SLOT_HOURS[slot.endsWith('am') ? 'am' : 'pm'];
  const rows = forecast.filter((f) => f.date === date && hours.includes(f.hour));
  if (rows.length === 0) return null;
  const probs = rows.map((r) => r.rainProb).filter((p): p is number => p !== null);
  const temps = rows.map((r) => r.temp).filter((t): t is number => t !== null);
  const rainProb = probs.length > 0 ? Math.max(...probs) : null;
  return {
    slot,
    date,
    rainProb,
    tempMin: temps.length > 0 ? Math.min(...temps) : null,
    tempMax: temps.length > 0 ? Math.max(...temps) : null,
    rainy: rainProb !== null && rainProb >= RAINY_THRESHOLD,
  };
}

/** 「降雨 70%・17–20°C」 */
export function formatSlotWeather(w: SlotWeather): string {
  const parts: string[] = [];
  if (w.rainProb !== null) parts.push(`降雨 ${Math.round(w.rainProb)}%`);
  if (w.tempMin !== null && w.tempMax !== null) {
    const lo = Math.round(w.tempMin);
    const hi = Math.round(w.tempMax);
    parts.push(lo === hi ? `${lo}°C` : `${lo}–${hi}°C`);
  }
  return parts.join('・');
}

export interface WeatherCacheEntry {
  fetchedAt: number;
  forecast: HourForecast[];
}

/** 快取還能不能用：在 1 小時內。 */
export function isCacheFresh(entry: WeatherCacheEntry | null | undefined, now: number): boolean {
  return !!entry && now - entry.fetchedAt < WEATHER_TTL_MS && now >= entry.fetchedAt;
}
