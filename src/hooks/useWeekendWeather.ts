import { useEffect, useMemo, useState } from 'react';
import { type HourForecast, type WeatherCacheEntry, isCacheFresh, parseForecast, weatherCacheKey, weatherUrl } from '../lib/weather.ts';

const CACHE_KEY = 'kidtrip.weather.v2';
/** 最多留幾個地點的預報（出發地＋幾個目的地）。 */
const MAX_ENTRIES = 6;

type Cache = Record<string, WeatherCacheEntry>;

function readCache(): Cache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: Cache = {};
    for (const [key, v] of Object.entries(data as Record<string, unknown>)) {
      const e = v as Partial<WeatherCacheEntry> | null;
      if (e && typeof e.fetchedAt === 'number' && Array.isArray(e.forecast)) out[key] = e as WeatherCacheEntry;
    }
    return out;
  } catch {
    return {};
  }
}

function writeCache(key: string, entry: WeatherCacheEntry) {
  try {
    const cache = { ...readCache(), [key]: entry };
    const keep = Object.entries(cache)
      .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
      .slice(0, MAX_ENTRIES);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    // 存不了就算了，下次再抓
  }
}

/**
 * 某個地點未來幾天的逐時預報。快取 1 小時；抓不到（離線、服務掛掉）時用舊快取，
 * 連舊快取都沒有就回傳 null，畫面照常運作。point 給 null 就不抓。
 */
export function useForecast(point: { lat: number; lng: number } | null): HourForecast[] | null {
  const key = point ? weatherCacheKey(point) : null;
  const [state, setState] = useState<{ key: string; forecast: HourForecast[] } | null>(null);
  // 換地點時先用快取裡的資料（就算有點舊），抓到新的再換掉。
  const cached = useMemo(() => (key ? (readCache()[key]?.forecast ?? null) : null), [key]);

  useEffect(() => {
    if (!key || !point) return;
    if (isCacheFresh(readCache()[key], Date.now())) return;
    const controller = new AbortController();
    fetch(weatherUrl(point), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: unknown) => {
        const forecast = parseForecast(json);
        if (forecast.length === 0) return;
        writeCache(key, { fetchedAt: Date.now(), forecast });
        setState({ key, forecast });
      })
      .catch(() => {
        // 離線或失敗：保留原本的狀態
      });
    return () => controller.abort();
    // 精確座標變了但四捨五入後一樣時不用重抓
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state && state.key === key ? state.forecast : cached;
}
