import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, loadState, parseState, saveState } from './storage.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('storage', () => {
  it('存了再讀回來', () => {
    const s = memoryStorage();
    expect(saveState(s, { fav: ['spot-001'], been: ['spot-002'] })).toBe(true);
    expect(Object.keys(s.data)).toEqual([STORAGE_KEY]);
    expect(loadState(s)).toEqual({ fav: ['spot-001'], been: ['spot-002'] });
  });
  it('沒有資料、資料壞掉都回到空白', () => {
    expect(loadState(memoryStorage())).toEqual({ fav: [], been: [] });
    expect(parseState('{not json')).toEqual({ fav: [], been: [] });
    expect(parseState('[1,2]')).toEqual({ fav: [], been: [] });
    expect(parseState('null')).toEqual({ fav: [], been: [] });
    expect(parseState('{"fav":"spot-001","been":[1,"spot-002","spot-002"]}')).toEqual({ fav: [], been: ['spot-002'] });
  });
  it('保留其他欄位', () => {
    const state = parseState('{"fav":[],"been":[],"origin":{"label":"林口","lat":25,"lng":121}}');
    expect(state.origin).toEqual({ label: '林口', lat: 25, lng: 121 });
  });
  it('localStorage 丟例外或不存在時不會出錯', () => {
    expect(loadState(throwing)).toEqual({ fav: [], been: [] });
    expect(saveState(throwing, { fav: [], been: [] })).toBe(false);
    expect(loadState(null)).toEqual({ fav: [], been: [] });
    expect(saveState(null, { fav: [], been: [] })).toBe(false);
  });
});
