import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { DAY_PARAM, buildDayShareUrl, decodeDayShare, encodeDayShare, readShareParams } from './day-share.ts';
import { type DayPlanAddon, parseDayPlan } from './full-day.ts';
import { routeUrl } from './links.ts';
import { PLAN_PARAM, buildPlanUrl, makePlan } from './weekplan.ts';

const today = '2026-11-18';
const plan = makePlan(today, 'spot-301', 'sat-am', 'spot-017');
const addon: DayPlanAddon = {
  v: 1,
  week: plan.week,
  slot: 'sat-am',
  spotId: 'spot-301',
  secondId: 'spot-302',
  style: 'explore',
  departAt: 540,
  latestHome: 1080,
  napMode: 'car',
  lunch: 'nearby',
  envMode: 'indoor',
  maxDrive: 45,
  stroller: true,
};
const base = 'https://example.github.io/kidtrip/?tab=spots#x';

describe('全日遊分享連結（版本化）', () => {
  it('編碼再解碼，兩站和條件都一樣', () => {
    expect(decodeDayShare(encodeDayShare(addon))).toEqual(addon);
    const single = { ...addon, style: 'easy' as const, secondId: undefined };
    delete single.secondId;
    expect(decodeDayShare(encodeDayShare(single))).toEqual(single);
  });
  it('網址同時帶舊的 plan 和新的 day；打開後兩個都讀得到', () => {
    const url = new URL(buildDayShareUrl(base, plan, addon));
    expect(url.searchParams.has(PLAN_PARAM)).toBe(true);
    expect(url.searchParams.has(DAY_PARAM)).toBe(true);
    expect(url.hash).toBe('');
    const read = readShareParams(url.search);
    expect(read.plan).toEqual(plan);
    expect(read.day).toEqual(addon);
  });
  it('不帶孩子姓名、生日、住址或出發地', () => {
    const url = buildDayShareUrl(base, plan, addon);
    const payload = atob(new URL(url).searchParams.get(DAY_PARAM)!.replace(/-/g, '+').replace(/_/g, '/'));
    const keys = Object.keys(JSON.parse(payload) as object);
    expect(keys.sort()).toEqual(['d', 'e', 'h', 'l', 'm', 'n', 'r', 's', 's2', 't', 'v', 'w', 'y']);
    expect(payload).not.toMatch(/果果|核桃|birth|nickname|lat|lng|origin|林口/);
  });
  it('舊版 ?plan= 連結照舊：沒有 day', () => {
    const old = new URL(buildPlanUrl(base, plan));
    expect(readShareParams(old.search)).toEqual({ plan, day: null });
  });
  it('day 跟 plan 對不上、版本看不懂、格式壞掉：只用 plan', () => {
    const other = new URL(buildDayShareUrl(base, makePlan(today, 'spot-999', 'sat-am'), addon));
    expect(readShareParams(other.search).day).toBeNull();
    expect(readShareParams(other.search).plan?.spotId).toBe('spot-999');
    const v2 = btoa(JSON.stringify({ v: 2, w: plan.week })).replace(/=+$/, '');
    expect(decodeDayShare(v2)).toBeNull();
    expect(decodeDayShare('!!!')).toBeNull();
    const broken = new URL(buildPlanUrl(base, plan));
    broken.searchParams.set(DAY_PARAM, 'abc');
    expect(readShareParams(broken.search)).toEqual({ plan, day: null });
  });
  it('只有 day（沒有 plan）：從 day 補出 WeekPlan', () => {
    const url = new URL(base);
    url.search = '';
    url.searchParams.set(DAY_PARAM, encodeDayShare(addon));
    expect(readShareParams(url.search).plan).toEqual({ week: plan.week, spotId: 'spot-301', slot: 'sat-am' });
  });
  it('解出來的一定通過 dayPlan 的格式檢查（跟 localStorage 用同一套）', () => {
    expect(parseDayPlan(decodeDayShare(encodeDayShare(addon)))).toEqual(addon);
  });
});

describe('雙景點依序導航', () => {
  const a = makeSpot({ name: '甲館', city: '新北市（林口）', google_place_id: 'ChIJa' });
  const b = makeSpot({ name: '乙館', city: '桃園市中壢區（青埔）', google_place_id: 'ChIJb' });
  it('第一站是途經點、第二站是目的地，用名稱和 place_id，不帶出發地也不用座標', () => {
    const u = new URL(routeUrl([a, b]));
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('waypoints')).toBe('甲館 新北市');
    expect(u.searchParams.get('waypoint_place_ids')).toBe('ChIJa');
    expect(u.searchParams.get('destination')).toBe('乙館 桃園市中壢區');
    expect(u.searchParams.get('destination_place_id')).toBe('ChIJb');
    expect(u.searchParams.get('travelmode')).toBe('driving');
    expect(u.searchParams.has('origin')).toBe(false);
    expect(u.toString()).not.toMatch(/\d+\.\d{3,}/); // 沒有座標
  });
  it('順序反過來，途經點和目的地也跟著換', () => {
    const u = new URL(routeUrl([b, a]));
    expect(u.searchParams.get('waypoints')).toBe('乙館 桃園市中壢區');
    expect(u.searchParams.get('destination')).toBe('甲館 新北市');
  });
  it('途經點沒有 place_id：不帶 waypoint_place_ids（避免對不上），只用名稱', () => {
    const u = new URL(routeUrl([makeSpot({ ...a, google_place_id: null }), b]));
    expect(u.searchParams.has('waypoint_place_ids')).toBe(false);
    expect(u.searchParams.get('waypoints')).toBe('甲館 新北市');
  });
  it('只有一站時跟單站導航一樣（單站導航保留當備案）', () => {
    const u = new URL(routeUrl([a]));
    expect(u.searchParams.has('waypoints')).toBe(false);
    expect(u.searchParams.get('destination')).toBe('甲館 新北市');
  });
});
