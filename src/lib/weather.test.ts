import { describe, expect, it } from 'vitest';
import {
  WEATHER_TTL_MS,
  availableSlots,
  defaultSlot,
  normalizeSlot,
  formatSlotWeather,
  isCacheFresh,
  isSlot,
  parseForecast,
  slotDate,
  slotLabelWithDate,
  slotWeather,
  weatherCacheKey,
  weatherUrl,
} from './weather.ts';

// Open-Meteo 逐時回應的格式（只放需要的幾個小時）
function hourly(rows: [string, number | null, number | null][]) {
  return {
    hourly: {
      time: rows.map((r) => r[0]),
      precipitation_probability: rows.map((r) => r[1]),
      temperature_2m: rows.map((r) => r[2]),
    },
  };
}
const sample = hourly([
  ['2026-11-21T08:00', 90, 15],
  ['2026-11-21T09:00', 20, 16.2],
  ['2026-11-21T10:00', 70, 17.8],
  ['2026-11-21T11:00', 40, 19.6],
  ['2026-11-21T14:00', 10, 21],
  ['2026-11-21T15:00', 5, 21],
  ['2026-11-21T16:00', null, 20],
  ['2026-11-22T09:00', 59, 18],
  ['2026-11-22T10:00', 30, 19],
  ['2026-11-22T11:00', 30, 20],
]);

describe('時段', () => {
  it.each([
    ['2026-11-16', 'sat-am', '2026-11-21'], // 週一
    ['2026-11-19', 'sun-pm', '2026-11-22'], // 週四
    ['2026-11-21', 'sat-pm', '2026-11-21'], // 週六當天
    ['2026-11-22', 'sun-am', '2026-11-22'], // 週日當天
    ['2026-11-22', 'sat-am', '2026-11-21'], // 週日選週六 → 昨天
    ['2026-12-31', 'sat-am', '2027-01-02'], // 跨年
  ] as const)('%s 的 %s 是 %s', (today, slot, date) => {
    expect(slotDate(today, slot)).toBe(date);
  });
  it('預設時段與標籤', () => {
    expect(defaultSlot('2026-11-19')).toBe('sat-am');
    expect(defaultSlot('2026-11-21')).toBe('sat-am');
    expect(defaultSlot('2026-11-22')).toBe('sun-am');
    expect(slotLabelWithDate('2026-11-19', 'sat-am')).toBe('週六上午 11/21');
    expect(isSlot('sun-pm')).toBe(true);
    expect(isSlot('mon-am')).toBe(false);
  });
});

describe('parseForecast', () => {
  it('解析逐時資料', () => {
    const f = parseForecast(sample);
    expect(f).toHaveLength(10);
    expect(f[2]).toEqual({ date: '2026-11-21', hour: 10, rainProb: 70, temp: 17.8 });
    expect(f[6]?.rainProb).toBeNull();
  });
  it('格式不對回傳空陣列', () => {
    expect(parseForecast(null)).toEqual([]);
    expect(parseForecast({})).toEqual([]);
    expect(parseForecast({ hourly: { time: 'x' } })).toEqual([]);
    expect(parseForecast({ daily: { time: ['2026-11-21'] } })).toEqual([]);
    expect(parseForecast({ error: true, reason: 'bad' })).toEqual([]);
  });
});

describe('slotWeather', () => {
  const forecast = parseForecast(sample);
  it('只看那個時段的幾個小時（上午 9–12 點），取最高降雨機率', () => {
    const w = slotWeather(forecast, '2026-11-19', 'sat-am');
    // 8 點的 90% 不算
    expect(w).toMatchObject({ date: '2026-11-21', rainProb: 70, tempMin: 16.2, tempMax: 19.6, rainy: true });
  });
  it('同一天下午可以是晴天', () => {
    const w = slotWeather(forecast, '2026-11-19', 'sat-pm');
    expect(w).toMatchObject({ rainProb: 10, rainy: false });
  });
  it('59% 不算下雨，60% 算', () => {
    expect(slotWeather(forecast, '2026-11-19', 'sun-am')?.rainy).toBe(false);
    const sixty = parseForecast(hourly([['2026-11-22T09:00', 60, 18]]));
    expect(slotWeather(sixty, '2026-11-19', 'sun-am')?.rainy).toBe(true);
  });
  it('預報裡沒有那個時段回傳 null', () => {
    expect(slotWeather(forecast, '2026-11-19', 'sun-pm')).toBeNull();
    expect(slotWeather(forecast, '2026-12-01', 'sat-am')).toBeNull();
    expect(slotWeather([], '2026-11-19', 'sat-am')).toBeNull();
  });
});

describe('顯示與網址', () => {
  it('formatSlotWeather', () => {
    const w = slotWeather(parseForecast(sample), '2026-11-19', 'sat-am')!;
    expect(formatSlotWeather(w)).toBe('降雨 70%・16–20°C');
  });
  it('座標只送到小數 1 位，要的是逐時資料', () => {
    const url = new URL(weatherUrl({ lat: 25.07753, lng: 121.39164 }));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('25.1');
    expect(url.searchParams.get('longitude')).toBe('121.4');
    expect(url.searchParams.get('hourly')).toContain('precipitation_probability');
    expect(url.searchParams.get('timezone')).toBe('Asia/Taipei');
    expect(weatherCacheKey({ lat: 25.07753, lng: 121.39164 })).toBe('25.1,121.4');
  });
});

describe('isCacheFresh', () => {
  const entry = { fetchedAt: 1_000_000, forecast: [] };
  it('1 小時內才算新', () => {
    expect(isCacheFresh(entry, 1_000_000 + WEATHER_TTL_MS - 1)).toBe(true);
    expect(isCacheFresh(entry, 1_000_000 + WEATHER_TTL_MS)).toBe(false);
    expect(isCacheFresh(null, 1_000_001)).toBe(false);
    expect(isCacheFresh(undefined, 1_000_001)).toBe(false);
  });
});

describe('8. 星期日切換出遊日期', () => {
  it('週日只能選週日的時段，不會選到已經過去的週六', () => {
    expect(availableSlots('2026-11-22')).toEqual(['sun-am', 'sun-pm']); // 週日
    expect(availableSlots('2026-11-21')).toEqual(['sat-am', 'sat-pm', 'sun-am', 'sun-pm']); // 週六
    expect(availableSlots('2026-11-18')).toHaveLength(4); // 週三
  });
  it('週六選好的時段，到了週日自動換成週日上午', () => {
    expect(normalizeSlot('2026-11-22', 'sat-pm')).toBe('sun-am');
    expect(normalizeSlot('2026-11-22', 'sun-pm')).toBe('sun-pm');
    expect(normalizeSlot('2026-11-18', 'sat-pm')).toBe('sat-pm');
  });
});
