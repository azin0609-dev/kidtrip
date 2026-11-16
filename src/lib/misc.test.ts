import { describe, expect, it } from 'vitest';
import { makeHotel, makeSpot } from '../test/fixtures.ts';
import { formatDrive, latestVerified } from './format.ts';
import { googleMapsUrl, hotelPriceUrl, stripParens } from './links.ts';
import { tabFromHash } from './tabs.ts';

describe('links', () => {
  it('去掉括號補充', () => {
    expect(stripParens('桃園市中壢區（青埔）')).toBe('桃園市中壢區');
  });
  it('Google Maps 搜尋連結', () => {
    const url = new URL(googleMapsUrl(makeSpot({ name: '恐龍館', city: '台北市（士林）' })));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe('恐龍館 台北市');
    expect(url.searchParams.has('query_place_id')).toBe(false);
  });
  it('有 place_id 就帶上', () => {
    const url = new URL(googleMapsUrl(makeSpot({ google_place_id: 'ChIJabc' })));
    expect(url.searchParams.get('query_place_id')).toBe('ChIJabc');
  });
  it('查房價連結', () => {
    const url = new URL(hotelPriceUrl(makeHotel({ name: '親子飯店', city: '宜蘭縣礁溪鄉' })));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('q')).toBe('親子飯店 宜蘭縣礁溪鄉');
  });
});

describe('format', () => {
  it('車程顯示', () => {
    expect(formatDrive(25)).toEqual({ value: '25', unit: '分' });
    expect(formatDrive(60)).toEqual({ value: '1', unit: '小時' });
    expect(formatDrive(100)).toEqual({ value: '1.5', unit: '小時' });
    expect(formatDrive(200)).toEqual({ value: '3.5', unit: '小時' });
  });
  it('資料整理日期取最新', () => {
    expect(latestVerified([{ last_verified: '2026-11-01' }, { last_verified: '2026-11-16' }])).toBe('2026-11-16');
    expect(latestVerified([])).toBeNull();
  });
});

describe('tabFromHash', () => {
  it.each([
    ['', 'spots'],
    ['#hotels', 'hotels'],
    ['#/favs', 'favs'],
    ['#nope', 'spots'],
  ])('%s → %s', (hash, tab) => {
    expect(tabFromHash(hash)).toBe(tab);
  });
});
