/** 週末天氣（Open-Meteo，免金鑰）。解析與判斷都是純函式。 */

/** 降雨機率到這個數字，推薦就自動偏向室內（PRD 2-2）。 */
export const RAINY_THRESHOLD = 60;
/** 快取 1 小時。 */
export const WEATHER_TTL_MS = 60 * 60 * 1000;

export interface DayForecast {
  /** YYYY-MM-DD（Asia/Taipei） */
  date: string;
  /** 降雨機率 0–100；沒有資料是 null */
  rainProb: number | null;
  tempMax: number | null;
  tempMin: number | null;
}

/** 座標取到小數 1 位（約 10 公里）再送出：天氣夠準，也不會把精確位置傳給外部服務。 */
export function roundForWeather(n: number): number {
  return Math.round(n * 10) / 10;
}

export function weatherUrl(origin: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    latitude: String(roundForWeather(origin.lat)),
    longitude: String(roundForWeather(origin.lng)),
    daily: 'precipitation_probability_max,temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Taipei',
    forecast_days: '8',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** 同一個（四捨五入後的）位置共用快取。 */
export function weatherCacheKey(origin: { lat: number; lng: number }): string {
  return `${roundForWeather(origin.lat)},${roundForWeather(origin.lng)}`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 解析 Open-Meteo 的回應；格式不對回傳空陣列。 */
export function parseForecast(json: unknown): DayForecast[] {
  if (!json || typeof json !== 'object') return [];
  const daily = (json as { daily?: unknown }).daily;
  if (!daily || typeof daily !== 'object') return [];
  const d = daily as Record<string, unknown>;
  const time = d.time;
  if (!Array.isArray(time)) return [];
  const col = (key: string) => (Array.isArray(d[key]) ? (d[key] as unknown[]) : []);
  const rain = col('precipitation_probability_max');
  const max = col('temperature_2m_max');
  const min = col('temperature_2m_min');
  return time.flatMap((date, i) =>
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? [{ date, rainProb: num(rain[i]), tempMax: num(max[i]), tempMin: num(min[i]) }]
      : [],
  );
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 這個週末的日期：週一到週六 → 這週六、日；週日 → 只有今天。 */
export function upcomingWeekend(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = 週日
  if (dow === 0) return [today];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}

export interface WeekendWeather {
  days: DayForecast[];
  /** 週末兩天中較高的降雨機率 */
  maxRainProb: number | null;
  rainy: boolean;
}

export function weekendWeather(forecast: readonly DayForecast[], today: string): WeekendWeather | null {
  const dates = upcomingWeekend(today);
  const days = forecast.filter((f) => dates.includes(f.date));
  if (days.length === 0) return null;
  const probs = days.map((x) => x.rainProb).filter((p): p is number => p !== null);
  const maxRainProb = probs.length > 0 ? Math.max(...probs) : null;
  return { days, maxRainProb, rainy: maxRainProb !== null && maxRainProb >= RAINY_THRESHOLD };
}

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

/** 「週六 11/21・降雨 70%・18–24°C」 */
export function formatDay(day: DayForecast): string {
  const [y, m, d] = day.date.split('-').map(Number) as [number, number, number];
  const name = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const parts = [`${name} ${m}/${d}`];
  if (day.rainProb !== null) parts.push(`降雨 ${Math.round(day.rainProb)}%`);
  if (day.tempMin !== null && day.tempMax !== null) parts.push(`${Math.round(day.tempMin)}–${Math.round(day.tempMax)}°C`);
  return parts.join('・');
}

export interface WeatherCache {
  key: string;
  fetchedAt: number;
  forecast: DayForecast[];
}

/** 快取還能不能用：同一個位置、而且在 1 小時內。 */
export function isCacheFresh(cache: WeatherCache | null, key: string, now: number): boolean {
  return cache !== null && cache.key === key && now - cache.fetchedAt < WEATHER_TTL_MS && now >= cache.fetchedAt;
}
