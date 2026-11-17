import { describe, expect, it } from 'vitest';
import {
  WEATHER_TTL_MS,
  formatDay,
  isCacheFresh,
  parseForecast,
  upcomingWeekend,
  weatherCacheKey,
  weatherUrl,
  weekendWeather,
} from './weather.ts';

// Open-Meteo 的回應格式
const sample = {
  latitude: 25.1,
  longitude: 121.4,
  timezone: 'Asia/Taipei',
  daily: {
    time: ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'],
    precipitation_probability_max: [10, 30, 70, 45, null],
    temperature_2m_max: [24.1, 23.5, 20.2, 21.8, 22],
    temperature_2m_min: [18.3, 18, 16.9, 17.2, 17],
  },
};

describe('upcomingWeekend', () => {
  it.each([
    ['2026-11-16', ['2026-11-21', '2026-11-22']], // 週一
    ['2026-11-19', ['2026-11-21', '2026-11-22']], // 週四
    ['2026-11-21', ['2026-11-21', '2026-11-22']], // 週六
    ['2026-11-22', ['2026-11-22']], // 週日
    ['2026-12-31', ['2027-01-02', '2027-01-03']], // 跨年
  ])('%s → %j', (today, dates) => {
    expect(upcomingWeekend(today)).toEqual(dates);
  });
});

describe('parseForecast', () => {
  it('解析每天的降雨機率與溫度', () => {
    const f = parseForecast(sample);
    expect(f).toHaveLength(5);
    expect(f[2]).toEqual({ date: '2026-11-21', rainProb: 70, tempMax: 20.2, tempMin: 16.9 });
    expect(f[4]?.rainProb).toBeNull();
  });
  it('格式不對回傳空陣列', () => {
    expect(parseForecast(null)).toEqual([]);
    expect(parseForecast({})).toEqual([]);
    expect(parseForecast({ daily: { time: 'x' } })).toEqual([]);
    expect(parseForecast({ error: true, reason: 'bad' })).toEqual([]);
  });
});

describe('weekendWeather', () => {
  const forecast = parseForecast(sample);
  it('取週末兩天較高的降雨機率，60% 以上算下雨', () => {
    const w = weekendWeather(forecast, '2026-11-19');
    expect(w?.days.map((d) => d.date)).toEqual(['2026-11-21', '2026-11-22']);
    expect(w?.maxRainProb).toBe(70);
    expect(w?.rainy).toBe(true);
  });
  it('週日只看當天', () => {
    const w = weekendWeather(forecast, '2026-11-22');
    expect(w?.maxRainProb).toBe(45);
    expect(w?.rainy).toBe(false);
  });
  it('剛好 60% 算下雨；沒有機率資料不算', () => {
    const at = (p: number | null) =>
      weekendWeather([{ date: '2026-11-21', rainProb: p, tempMax: null, tempMin: null }], '2026-11-19');
    expect(at(60)?.rainy).toBe(true);
    expect(at(59)?.rainy).toBe(false);
    expect(at(null)?.rainy).toBe(false);
  });
  it('預報裡沒有週末回傳 null', () => {
    expect(weekendWeather(forecast, '2026-12-01')).toBeNull();
    expect(weekendWeather([], '2026-11-19')).toBeNull();
  });
});

describe('顯示與網址', () => {
  it('formatDay', () => {
    expect(formatDay({ date: '2026-11-21', rainProb: 70, tempMax: 20.2, tempMin: 16.9 })).toBe('週六 11/21・降雨 70%・17–20°C');
    expect(formatDay({ date: '2026-11-22', rainProb: null, tempMax: null, tempMin: null })).toBe('週日 11/22');
  });
  it('座標只送到小數 1 位', () => {
    const url = new URL(weatherUrl({ lat: 25.07753, lng: 121.39164 }));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('25.1');
    expect(url.searchParams.get('longitude')).toBe('121.4');
    expect(url.searchParams.get('timezone')).toBe('Asia/Taipei');
    expect(weatherCacheKey({ lat: 25.07753, lng: 121.39164 })).toBe('25.1,121.4');
  });
});

describe('isCacheFresh', () => {
  const cache = { key: '25.1,121.4', fetchedAt: 1_000_000, forecast: [] };
  it('同位置、1 小時內才算新', () => {
    expect(isCacheFresh(cache, '25.1,121.4', 1_000_000 + WEATHER_TTL_MS - 1)).toBe(true);
    expect(isCacheFresh(cache, '25.1,121.4', 1_000_000 + WEATHER_TTL_MS)).toBe(false);
    expect(isCacheFresh(cache, '22.6,120.4', 1_000_001)).toBe(false);
    expect(isCacheFresh(null, '25.1,121.4', 1_000_001)).toBe(false);
  });
});
