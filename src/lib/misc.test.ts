import { describe, expect, it } from 'vitest';
import { makeHotel, makeSpot } from '../test/fixtures.ts';
import { formatDrive, latestVerified, shortOriginLabel } from './format.ts';
import { directionsUrl, googleMapsUrl, hotelPriceUrl, imageSrc, stripParens } from './links.ts';
import { TABS } from './tabs.ts';
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
  it('路線連結', () => {
    const url = new URL(directionsUrl(makeSpot({ name: '恐龍館', city: '台北市（士林）', google_place_id: 'ChIJabc' })));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('恐龍館 台北市');
    expect(url.searchParams.get('destination_place_id')).toBe('ChIJabc');
    expect(url.searchParams.has('origin')).toBe(false);
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
    expect(formatDrive(23)).toEqual({ value: '25', unit: '分' });
    expect(formatDrive(2)).toEqual({ value: '5', unit: '分' });
    expect(formatDrive(60)).toEqual({ value: '1', unit: '小時' });
    expect(formatDrive(100)).toEqual({ value: '1.5', unit: '小時' });
    expect(formatDrive(200)).toEqual({ value: '3.5', unit: '小時' });
  });
  it('出發地短名稱', () => {
    expect(shortOriginLabel('新北市林口區')).toBe('林口區');
    expect(shortOriginLabel('嘉義市東區')).toBe('東區');
    expect(shortOriginLabel('目前位置（新北市林口區附近）')).toBe('目前位置');
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

describe('imageSrc', () => {
  it('完整網址原樣使用', () => {
    expect(imageSrc('https://example.org/a.jpg', '/kidtrip/')).toBe('https://example.org/a.jpg');
  });
  it('相對路徑加上部署子路徑，不假設在網域根目錄', () => {
    expect(imageSrc('photos/spot-001.jpg', '/kidtrip/')).toBe('/kidtrip/photos/spot-001.jpg');
    expect(imageSrc('/photos/spot-001.jpg', '/kidtrip')).toBe('/kidtrip/photos/spot-001.jpg');
    expect(imageSrc('photos/a.jpg', '/')).toBe('/photos/a.jpg');
  });
});

describe('分頁改名', () => {
  it('只改顯示名稱，id 和 hash 不變', () => {
    expect(TABS.map((t) => t.id)).toEqual(['spots', 'hotels', 'food', 'trips', 'favs']);
    expect(TABS.map((t) => t.label)).toEqual(['去放電', '住一晚', '吃好料', '飛出國', '我的']);
    expect(tabFromHash('#hotels')).toBe('hotels');
    expect(tabFromHash('#/food')).toBe('food');
  });
});

describe('nowMinsInTaipei', () => {
  it('換算成台北時間的分鐘數', async () => {
    const { nowMinsInTaipei } = await import('./date.ts');
    expect(nowMinsInTaipei(new Date('2026-11-21T01:30:00Z'))).toBe(9 * 60 + 30); // UTC 01:30 = 台北 09:30
    expect(nowMinsInTaipei(new Date('2026-11-20T16:05:00Z'))).toBe(5); // 台北 00:05
  });
});
