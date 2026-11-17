import { describe, expect, it } from 'vitest';
import { ageBestLabel, ageYears, kidAgeNote, stayLabel } from './details.ts';

const today = '2026-11-17';

describe('details', () => {
  it('ageYears', () => {
    expect(ageYears('2023-11', today)).toBe(3);
    expect(ageYears('2026-05', today)).toBe(0.5);
    expect(ageYears('2027-01', today)).toBeNull();
    expect(ageYears('', today)).toBeNull();
  });
  it('ageBestLabel', () => {
    expect(ageBestLabel([2, 6])).toBe('最適合 2–6 歲');
    expect(ageBestLabel([3, 12])).toBe('最適合 3 歲以上');
    expect(ageBestLabel([0, 12])).toBe('各年齡都適合');
  });
  it('stayLabel', () => {
    expect(stayLabel(1.5)).toBe('建議待 1.5 小時');
    expect(stayLabel(3)).toBe('可以玩半天（約 3 小時）');
    expect(stayLabel(6)).toBe('可以玩一整天');
  });
});

describe('kidAgeNote', () => {
  const guoguo = { nickname: '果果', birthYm: '2023-09' }; // 3 歲
  const hetao = { nickname: '核桃', birthYm: '2025-08' }; // 1 歲
  it('沒有孩子或沒有年齡資料就不提醒', () => {
    expect(kidAgeNote({ age_best: [2, 6] }, [], today)).toBeNull();
    expect(kidAgeNote({}, [guoguo], today)).toBeNull();
    expect(kidAgeNote({ age_best: [2, 6] }, [{ nickname: 'x', birthYm: '' }], today)).toBeNull();
  });
  it('年齡剛好適合不提醒', () => {
    expect(kidAgeNote({ age_best: [2, 6] }, [guoguo], today)).toBeNull();
    expect(kidAgeNote({ age_best: [1, 8] }, [guoguo, hetao], today)).toBeNull();
  });
  it('全部都太小', () => {
    expect(kidAgeNote({ age_best: [4, 12] }, [guoguo, hetao], today)).toBe('果果（3 歲）、核桃（1 歲）可能還太小，能玩的不多');
  });
  it('只有小的太小', () => {
    expect(kidAgeNote({ age_best: [2, 6] }, [guoguo, hetao], today)).toBe('核桃（1 歲）可能還太小，要有大人陪在旁邊');
  });
  it('未滿 1 歲顯示幾個月', () => {
    expect(kidAgeNote({ age_best: [2, 6] }, [{ nickname: '', birthYm: '2026-05' }], today)).toBe('孩子（6 個月）可能還太小，能玩的不多');
  });
  it('全部都太大', () => {
    expect(kidAgeNote({ age_best: [2, 6] }, [{ nickname: '哥哥', birthYm: '2017-01' }], today)).toBe('哥哥（9 歲）可能會覺得太幼稚');
    expect(kidAgeNote({ age_best: [2, 12] }, [{ nickname: '哥哥', birthYm: '2010-01' }], today)).toBeNull();
  });
});
