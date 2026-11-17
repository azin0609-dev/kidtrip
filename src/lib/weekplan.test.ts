import { describe, expect, it } from 'vitest';
import { buildPlanUrl, decodePlan, encodePlan, isCurrentPlan, makePlan, parsePlan, swapToBackup } from './weekplan.ts';

describe('這週要去', () => {
  const plan = makePlan('2026-11-19', 'spot-001', 'sat-am', 'spot-017');

  it('makePlan 記下這一週', () => {
    expect(plan).toEqual({ week: '2026-W47', spotId: 'spot-001', slot: 'sat-am', backupId: 'spot-017' });
    expect(makePlan('2026-11-19', 'spot-001', 'sun-pm', 'spot-001')).toEqual({ week: '2026-W47', spotId: 'spot-001', slot: 'sun-pm' });
    expect(makePlan('2026-11-19', 'spot-001', 'sun-pm', null).backupId).toBeUndefined();
  });

  it('週四選的，週六、週日都還在；下週一就過期', () => {
    expect(isCurrentPlan(plan, '2026-11-19')).toBe(true);
    expect(isCurrentPlan(plan, '2026-11-21')).toBe(true);
    expect(isCurrentPlan(plan, '2026-11-22')).toBe(true);
    expect(isCurrentPlan(plan, '2026-11-23')).toBe(false);
    expect(isCurrentPlan(undefined, '2026-11-19')).toBe(false);
  });

  it('parsePlan 擋掉格式不對的', () => {
    expect(parsePlan(plan)).toEqual(plan);
    expect(parsePlan({ ...plan, spotId: 'hotel-001' })).toBeNull();
    expect(parsePlan({ ...plan, slot: 'mon-am' })).toBeNull();
    expect(parsePlan({ ...plan, week: '2026-47' })).toBeNull();
    expect(parsePlan({ ...plan, backupId: '<script>' })).toEqual({ week: '2026-W47', spotId: 'spot-001', slot: 'sat-am' });
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan('x')).toBeNull();
  });

  it('下雨改去雨備：主行程和雨備對調', () => {
    expect(swapToBackup(plan)).toEqual({ week: '2026-W47', spotId: 'spot-017', slot: 'sat-am', backupId: 'spot-001' });
    const noBackup = makePlan('2026-11-19', 'spot-001', 'sat-am');
    expect(swapToBackup(noBackup)).toBe(noBackup);
  });

  it('行程連結：編碼解碼一致，只帶週、時段和景點 id', () => {
    const code = encodePlan(plan);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePlan(code)).toEqual(plan);
    expect(JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/')))).toEqual({ w: '2026-W47', t: 'sat-am', s: 'spot-001', b: 'spot-017' });
    const url = buildPlanUrl('https://example.com/kidtrip/?share=abc#favs', plan);
    expect(url.startsWith('https://example.com/kidtrip/?plan=')).toBe(true);
    expect(decodePlan(new URL(url).searchParams.get('plan')!)).toEqual(plan);
  });

  it('壞掉的連結回傳 null', () => {
    expect(decodePlan('%%%')).toBeNull();
    expect(decodePlan('bm90IGpzb24')).toBeNull();
    expect(decodePlan(btoa(JSON.stringify({ w: '2026-W47', t: 'sat-am', s: 'x' })))).toBeNull();
  });
});
