import { describe, expect, it } from 'vitest';
import { MEMO_MAX, STORAGE_KEY, listMemories, loadState, parseState, saveState, setMemo, toggleBeen } from './storage.ts';

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
  it('出發地、孩子、午睡：格式對才保留', () => {
    const good = parseState(
      JSON.stringify({
        fav: [],
        been: [],
        origin: { label: '高雄市鳳山區', lat: 22.63, lng: 120.36 },
        kids: [{ nickname: '果果', birthYm: '2023-09' }, { nickname: '核桃', birthYm: 'bad' }, 'x'],
        nap: { start: '13:00', end: '15:00' },
      }),
    );
    expect(good.origin).toEqual({ label: '高雄市鳳山區', lat: 22.63, lng: 120.36 });
    expect(good.kids).toEqual([{ nickname: '果果', birthYm: '2023-09' }, { nickname: '核桃', birthYm: '' }]);
    expect(good.nap).toEqual({ start: '13:00', end: '15:00' });

    const bad = parseState(JSON.stringify({ origin: { label: 'x', lat: 'a' }, kids: 'no', nap: { start: '25:00', end: '1' } }));
    expect(bad).toEqual({ fav: [], been: [] });
  });
  it('beenAt：舊資料（沒有 beenAt）照常讀得到', () => {
    const old = parseState('{"fav":["spot-001"],"been":["spot-002"]}');
    expect(old).toEqual({ fav: ['spot-001'], been: ['spot-002'] });
    expect(old.beenAt).toBeUndefined();
  });
  it('beenAt：只留合法日期、而且還在 been 裡的', () => {
    const s = parseState(
      JSON.stringify({ fav: [], been: ['spot-001', 'spot-002'], beenAt: { 'spot-001': '2026-10-01', 'spot-002': 'yesterday', 'spot-009': '2026-10-01' } }),
    );
    expect(s.beenAt).toEqual({ 'spot-001': '2026-10-01' });
  });
  it('toggleBeen 記下日期，取消時刪掉', () => {
    const on = toggleBeen({ fav: [], been: ['spot-002'] }, 'spot-001', '2026-11-16');
    expect(on.been).toEqual(['spot-002', 'spot-001']);
    expect(on.beenAt).toEqual({ 'spot-001': '2026-11-16' });
    const off = toggleBeen(on, 'spot-001', '2026-11-20');
    expect(off.been).toEqual(['spot-002']);
    expect(off.beenAt).toEqual({});
  });
  it('localStorage 丟例外或不存在時不會出錯', () => {
    expect(loadState(throwing)).toEqual({ fav: [], been: [] });
    expect(saveState(throwing, { fav: [], been: [] })).toBe(false);
    expect(loadState(null)).toEqual({ fav: [], been: [] });
    expect(saveState(null, { fav: [], been: [] })).toBe(false);
  });
});

describe('回憶', () => {
  it('寫入、清掉、限制長度', () => {
    const a = setMemo({ fav: [], been: ['spot-001'] }, 'spot-001', '  第一次餵長頸鹿  ');
    expect(a.memos).toEqual({ 'spot-001': '第一次餵長頸鹿' });
    expect(setMemo(a, 'spot-001', '   ').memos).toEqual({});
    expect(setMemo(a, 'spot-002', 'x'.repeat(500)).memos?.['spot-002']).toHaveLength(MEMO_MAX);
  });
  it('讀取：只留文字', () => {
    const s = parseState(JSON.stringify({ fav: [], been: [], memos: { 'spot-001': '好玩', 'spot-002': 5, 'spot-003': '' } }));
    expect(s.memos).toEqual({ 'spot-001': '好玩' });
    expect(parseState(JSON.stringify({ fav: [], been: [], memos: 'x' })).memos).toBeUndefined();
  });
  it('清單：新的在前，沒日期的在最後', () => {
    const list = listMemories(
      { 'spot-001': 'a', 'spot-002': 'b', 'spot-003': 'c' },
      { 'spot-001': '2026-03-01', 'spot-002': '2026-10-01' },
      (id) => `名稱${id}`,
    );
    expect(list.map((m) => m.id)).toEqual(['spot-002', 'spot-001', 'spot-003']);
    expect(list[0]).toEqual({ id: 'spot-002', name: '名稱spot-002', date: '2026-10-01', text: 'b' });
  });
});
