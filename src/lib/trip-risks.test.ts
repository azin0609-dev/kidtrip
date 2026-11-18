import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { bookingNotice, destinationWeatherNote, isHot } from './trip-risks.ts';
import type { SlotWeather } from './weather.ts';

const w = (o: Partial<SlotWeather>): SlotWeather => ({ slot: 'sat-am', date: '2026-11-21', rainProb: 10, tempMin: 20, tempMax: 25, rainy: false, ...o });

describe('出發前的風險提醒', () => {
  it('2. 出發地晴天、目的地下雨：戶外景點要提醒', () => {
    const outdoor = makeSpot({ env: 'out' });
    expect(destinationWeatherNote(outdoor, w({ rainy: true, rainProb: 80 }), true)).toBe('目的地那時段降雨機率 80%，這裡大部分在戶外，考慮換室內的。');
    expect(destinationWeatherNote(makeSpot({ env: 'semi' }), w({ rainy: true, rainProb: 70 }), true)).toContain('有遮棚');
    expect(destinationWeatherNote(makeSpot({ env: 'in' }), w({ rainy: true }), true)).toBeNull();
    expect(destinationWeatherNote(outdoor, w({}), true)).toBeNull();
  });
  it('預報抓不到：遠的地方提醒「不代表不會下雨」，不當成晴天', () => {
    expect(destinationWeatherNote(makeSpot({ env: 'out' }), null, true)).toContain('不代表不會下雨');
    expect(destinationWeatherNote(makeSpot({ env: 'out' }), null, false)).toBeNull();
  });
  it('3. 很熱又沒遮蔭的戶外：提醒防曬', () => {
    expect(isHot(w({ tempMax: 32 }))).toBe(true);
    expect(isHot(w({ tempMax: null }))).toBe(false);
    expect(destinationWeatherNote(makeSpot({ env: 'out', facilities: [] }), w({ tempMax: 33 }), false)).toBe('那時候約 33 度，這裡遮蔭少，記得防曬、多喝水。');
  });
  it('預約和購票只看結構化資料', () => {
    expect(bookingNotice(makeSpot({ open_note: '要先預約' }))).toBeNull();
    expect(bookingNotice(makeSpot({ booking: { reservation: 'unknown', advance_ticket: 'yes', timed_entry: 'yes', source: 'x' } }))).toBe('要先買票、分時段入場');
  });
});
