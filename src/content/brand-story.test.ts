import { describe, expect, it } from 'vitest';
import { ABOUT_HASH, isAboutHash, tabFromHash } from '../lib/tabs.ts';
import { BRAND_SUBLINE, BRAND_TAGLINE, STORY, STORY_TEASER } from './brand-story.ts';

const allText = [
  STORY.title,
  STORY.lead,
  ...STORY.blocks.flatMap((b): string[] => (b.kind === 'list' ? [...b.items] : b.kind === 'break' ? [] : [b.text])),
  STORY.note,
  ...Object.values(STORY_TEASER),
  BRAND_TAGLINE,
  ...BRAND_SUBLINE,
].join('\n');

describe('品牌故事文案', () => {
  it('主標語、輔助標語、入口按鈕、結尾按鈕都在', () => {
    expect(BRAND_TAGLINE).toBe('十分鐘做決定，剩下的時間，留給孩子。');
    expect(BRAND_SUBLINE.join('')).toBe('孩子負責放電，爸爸媽媽負責陪伴。規劃的事，交給放電研究所。');
    expect(STORY_TEASER.button).toBe('看看我們的故事');
    expect(STORY.cta).toBe('開始規劃這週末');
    expect(STORY.blocks.at(-1)).toEqual({ kind: 'quote', text: BRAND_TAGLINE });
  });
  it('不放孩子名字，不寫使用人數、媒體報導、得獎這類沒有根據的說法', () => {
    expect(allText).not.toMatch(/果果|核桃/);
    expect(allText).not.toMatch(/使用者突破|萬人|媒體|報導|獲獎|得獎|榮獲/);
  });
  it('有說明對話是情境描述，不是逐字紀錄', () => {
    expect(STORY.note).toContain('不是逐字紀錄');
  });
  it('不用 emoji 當標題符號', () => {
    expect(`${STORY.title}${STORY.eyebrow}${STORY.signature}${STORY_TEASER.title}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('故事頁網址', () => {
  it('#about 是故事頁，底下分頁維持「去放電」', () => {
    expect(isAboutHash(`#${ABOUT_HASH}`)).toBe(true);
    expect(isAboutHash('#/about')).toBe(true);
    expect(isAboutHash('#spots')).toBe(false);
    expect(isAboutHash('')).toBe(false);
    expect(tabFromHash('#about')).toBe('spots');
  });
});
