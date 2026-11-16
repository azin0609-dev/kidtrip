import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { daysBetween, formatMonthDay, isSpotVisible, spotBadges, spotDateStatus, todayInTaipei } from './date.ts';

describe('todayInTaipei', () => {
  it('UTC 16:00 已經是台北隔天', () => {
    expect(todayInTaipei(new Date('2026-11-30T16:00:00Z'))).toBe('2026-12-01');
    expect(todayInTaipei(new Date('2026-11-30T15:59:59Z'))).toBe('2026-11-30');
  });
});

describe('daysBetween / formatMonthDay', () => {
  it('跨月、跨年', () => {
    expect(daysBetween('2026-11-20', '2026-11-24')).toBe(4);
    expect(daysBetween('2026-12-25', '2027-01-15')).toBe(21);
    expect(daysBetween('2026-11-24', '2026-11-20')).toBe(-4);
  });
  it('去掉前面的 0', () => {
    expect(formatMonthDay('2026-01-05')).toBe('1/5');
    expect(formatMonthDay('2026-11-24')).toBe('11/24');
  });
});

describe('spotDateStatus', () => {
  const today = '2026-12-01';
  it('closes_on 已過 → 隱藏；當天還看得到', () => {
    expect(isSpotVisible(makeSpot({ closes_on: '2026-11-30' }), today)).toBe(false);
    expect(isSpotVisible(makeSpot({ closes_on: '2026-12-01' }), today)).toBe(true);
    expect(isSpotVisible(makeSpot(), today)).toBe(true);
  });
  it('21 天內熄燈', () => {
    expect(spotDateStatus(makeSpot({ closes_on: '2026-12-22' }), today).closingSoon).toBe(true);
    expect(spotDateStatus(makeSpot({ closes_on: '2026-12-23' }), today).closingSoon).toBe(false);
  });
  it('還沒開幕；開幕當天就算開了', () => {
    expect(spotDateStatus(makeSpot({ opens_on: '2026-12-02' }), today).notYetOpen).toBe(true);
    expect(spotDateStatus(makeSpot({ opens_on: '2026-12-01' }), today).notYetOpen).toBe(false);
  });
});

describe('spotBadges', () => {
  it('11/20 看 11/24 開幕的景點', () => {
    const spot = makeSpot({ opens_on: '2026-11-24', badge: { kind: 'new', label: '11/24 開幕' } });
    expect(spotBadges(spot, '2026-11-20')).toEqual([{ kind: 'new', label: '11/24 開幕' }]);
  });
  it('開幕後改顯示資料裡的 badge', () => {
    const spot = makeSpot({ opens_on: '2026-11-24', badge: { kind: 'new', label: '新開幕' } });
    expect(spotBadges(spot, '2026-12-01')).toEqual([{ kind: 'new', label: '新開幕' }]);
  });
  it('熄燈超過 21 天不顯示，21 天內顯示日期', () => {
    const spot = makeSpot({ closes_on: '2027-01-31', badge: { kind: 'end', label: '即將熄燈' } });
    expect(spotBadges(spot, '2026-12-01')).toEqual([]);
    expect(spotBadges(spot, '2027-01-20')).toEqual([{ kind: 'end', label: '1/31 熄燈' }]);
  });
  it('沒有日期的 badge 照資料顯示', () => {
    expect(spotBadges(makeSpot({ badge: { kind: 'end', label: '最後一季' } }), '2026-12-01')).toEqual([
      { kind: 'end', label: '最後一季' },
    ]);
  });
});
