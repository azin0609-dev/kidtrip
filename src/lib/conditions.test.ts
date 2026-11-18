import { describe, expect, it } from 'vitest';
import { conditionSummary } from './conditions.ts';

describe('條件摘要', () => {
  const base = { maxDrive: 45, overnight: false, needStroller: false, rainy: false, elders: false };
  it('只有車程', () => {
    expect(conditionSummary(base)).toBe('單程 45 分內');
    expect(conditionSummary({ ...base, maxDrive: 120 })).toBe('單程 2 小時內');
  });
  it('列出打開的條件', () => {
    expect(conditionSummary({ ...base, needStroller: true, rainy: true, elders: true })).toBe('單程 45 分內・帶推車・可能下雨・長輩同行');
  });
  it('住一晚時不顯示單程上限', () => {
    expect(conditionSummary({ ...base, overnight: true })).toBe('住一晚（車程 1 小時以上）');
  });
});
