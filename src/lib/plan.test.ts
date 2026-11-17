import { describe, expect, it } from 'vitest';
import { formatClock, napPlan, packingList } from './plan.ts';

const nap = { start: '13:00', end: '15:00' };

describe('formatClock', () => {
  it('四捨五入到 5 分鐘', () => {
    expect(formatClock(9 * 60 + 33)).toBe('9:35');
    expect(formatClock(13 * 60)).toBe('13:00');
    expect(formatClock(7 * 60 + 58)).toBe('8:00');
  });
});

describe('napPlan', () => {
  it('上午去：午睡開始時上車', () => {
    const p = napPlan(25, 2, nap)!; // 13:00 − 2h −（25 分車程＋10 分緩衝）= 10:25 出門
    expect(p.kind).toBe('morning');
    expect(p.leaveHome).toBe(10 * 60 + 25);
    expect(p.leaveSpot).toBe(13 * 60);
    expect(p.text).toBe('10:25 出門，11:00 到，玩到 13:00 上車，回程剛好睡午覺');
  });
  it('要玩很久的地方：最早 9:00 到，提醒挑重點玩', () => {
    const p = napPlan(60, 6, nap)!; // 7:50 出門，9:00 到，玩 4 小時
    expect(p.kind).toBe('morning');
    expect(p.leaveHome).toBe(7 * 60 + 50);
    expect(p.text).toContain('7:50 出門，9:00 到');
    expect(p.text).toContain('挑重點玩');
    expect(p.text).toContain('先確認幾點開門');
  });
  it('單程超過 90 分鐘建議住一晚', () => {
    expect(napPlan(91, 3, nap)?.kind).toBe('overnight');
    expect(napPlan(90, 3, nap)?.kind).toBe('morning');
    expect(napPlan(200, 3, nap)?.text).toBe('單程約 3.5 小時，當天來回小孩會太累，建議住一晚');
    // 車程再短也不會 7:30 前出門
    expect(napPlan(85, 6, nap)?.leaveHome).toBe(7 * 60 + 30);
  });
  it('午睡很早、上午玩不到 75 分鐘：改成午睡後出發', () => {
    const p = napPlan(60, 2, { start: '09:30', end: '11:00' })!; // 最早 9:00 到，只能玩 30 分
    expect(p.kind).toBe('afternoon');
    expect(p.leaveHome).toBe(11 * 60 + 15);
    expect(p.text).toContain('11:15 出門，12:25 到');
  });
  it('建議只待 1 小時的近公園，上午去不會被說太趕', () => {
    const p = napPlan(10, 1, nap)!; // 林口立功公園：車程 10 分、建議 1 小時
    expect(p.kind).toBe('morning');
    expect(p.text).toBe('11:40 出門，12:00 到，玩到 13:00 上車，回程剛好睡午覺');
  });
  it('午睡時段格式不對就不排', () => {
    expect(napPlan(30, 2, { start: 'x', end: '15:00' })).toBeNull();
    expect(napPlan(30, 2, { start: '15:00', end: '13:00' })).toBeNull();
    expect(napPlan(0, 2, nap)).toBeNull();
  });
});

describe('packingList', () => {
  it('玩水的戶外景點、夏天', () => {
    const list = packingList({ types: ['water', 'park'], env: 'out', stroller_ok: true, facilities: ['picnic'] }, 7);
    expect(list.slice(0, 3)).toEqual(['水壺', '濕紙巾', '替換衣物']);
    expect(list).toEqual(expect.arrayContaining(['泳衣', '毛巾', '挖沙工具', '帽子', '防曬乳', '防蚊液', '野餐墊', '小點心']));
    expect(list).not.toContain('保暖外套');
    expect(new Set(list).size).toBe(list.length);
  });
  it('室內遊戲場、冬天', () => {
    const list = packingList({ types: ['indoorplay'], env: 'in', stroller_ok: true, facilities: ['food'] }, 1);
    expect(list).toEqual(expect.arrayContaining(['襪子（遊戲區通常要穿）', '薄外套（冷氣房）']));
    expect(list).not.toContain('防曬乳');
    expect(list).not.toContain('小點心');
    expect(list).not.toContain('雨衣或折傘');
  });
  it('推車不好推、冬天的戶外', () => {
    const list = packingList({ types: ['farm'], env: 'out', stroller_ok: false }, 12);
    expect(list).toEqual(expect.arrayContaining(['揹巾（推車不好推）', '保暖外套', '乾洗手']));
  });
});
