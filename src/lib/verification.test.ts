import { describe, expect, it } from 'vitest';
import { canClaimOpen, isRecommendable, verificationOf } from './verification.ts';

describe('查證狀態', () => {
  const base = { last_verified: '2026-11-18', needs_verify: [] as string[] };
  it('剛整理進來、沒查過：待確認，不能說查過還在營業', () => {
    const v = verificationOf({ ...base, needs_verify: ['mins_from_linkou'] });
    expect(v.status).toBe('unverified');
    expect(v.lastUpdated).toBe('2026-11-18');
    expect(v.verifiedAt).toBeNull();
    expect(canClaimOpen({ ...base })).toBe(false);
  });
  it('查過一部分：部分確認；全部確認且沒有風險：已確認', () => {
    const verified = { date: '2026-11-17', fields: ['營業中'] };
    expect(verificationOf({ ...base, verified, needs_verify: ['price_tier'] }).status).toBe('partial');
    expect(verificationOf({ ...base, verified }).status).toBe('verified');
    expect(verificationOf({ ...base, verified }).verifiedFields).toEqual(['營業中']);
  });
  it('來源互相矛盾：不能說還在營業，也不推薦', () => {
    const item = { ...base, verified: { date: '2026-11-17', fields: ['營業中'] }, risk_flags: ['status_conflict'] as const };
    expect(verificationOf(item).status).toBe('conflict');
    expect(canClaimOpen(item)).toBe(false);
    expect(isRecommendable(item)).toBe(false);
  });
  it('只有一般欄位待確認不影響推薦；有高風險項目才暫停', () => {
    expect(isRecommendable({})).toBe(true);
    expect(isRecommendable({ risk_flags: ['access_unknown'] })).toBe(false);
  });
});
