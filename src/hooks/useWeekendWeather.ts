import { useEffect, useState } from 'react';
import {
  type DayForecast,
  type WeatherCache,
  type WeekendWeather,
  isCacheFresh,
  parseForecast,
  weatherCacheKey,
  weatherUrl,
  weekendWeather,
} from '../lib/weather.ts';

const CACHE_KEY = 'kidtrip.weather.v1';

function readCache(): WeatherCache | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<WeatherCache>;
    if (typeof data.key !== 'string' || typeof data.fetchedAt !== 'number' || !Array.isArray(data.forecast)) return null;
    return data as WeatherCache;
  } catch {
    return null;
  }
}

function writeCache(cache: WeatherCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 存不了就算了，下次再抓
  }
}

/**
 * 這個週末的天氣。快取 1 小時；抓不到（離線、服務掛掉）時用舊快取，
 * 連舊快取都沒有就回傳 null，畫面照常運作、改用手動開關。
 */
export function useWeekendWeather(origin: { lat: number; lng: number }, today: string): WeekendWeather | null {
  const key = weatherCacheKey(origin);
  const [state, setState] = useState<{ key: string; forecast: DayForecast[] } | null>(() => {
    const cache = readCache();
    return cache && cache.key === key ? { key, forecast: cache.forecast } : null;
  });

  useEffect(() => {
    if (isCacheFresh(readCache(), key, Date.now())) return;
    const controller = new AbortController();
    fetch(weatherUrl(origin), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: unknown) => {
        const forecast = parseForecast(json);
        if (forecast.length === 0) return;
        writeCache({ key, fetchedAt: Date.now(), forecast });
        setState({ key, forecast });
      })
      .catch(() => {
        // 離線或失敗：保留原本的狀態
      });
    return () => controller.abort();
    // origin 的精確座標變了但四捨五入後一樣時不用重抓
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state && state.key === key ? weekendWeather(state.forecast, today) : null;
}
