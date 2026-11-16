import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { pickSpot } from './pick.ts';

const today = '2026-11-20';
const a = makeSpot({ id: 'spot-001' });
const b = makeSpot({ id: 'spot-002' });
const c = makeSpot({ id: 'spot-003' });
const soon = makeSpot({ id: 'spot-009', opens_on: '2026-11-24' });

function pickMany(candidates: ReturnType<typeof makeSpot>[], been: string[] = [], lastId: string | null = null) {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const r = pickSpot(candidates, { today, been, lastId }, () => i / 50);
    if (r) seen.add(r.id);
  }
  return seen;
}

describe('pickSpot', () => {
  it('沒有候選回傳 null', () => {
    expect(pickSpot([], { today, been: [], lastId: null })).toBeNull();
    expect(pickSpot([soon], { today, been: [], lastId: null })).toBeNull();
  });
  it('永遠抽不到還沒開幕的', () => {
    expect(pickMany([a, soon])).toEqual(new Set(['spot-001']));
  });
  it('開幕後就可以抽', () => {
    expect(pickSpot([soon], { today: '2026-11-24', been: [], lastId: null })?.id).toBe('spot-009');
  });
  it('優先排除去過的', () => {
    expect(pickMany([a, b, c], ['spot-001', 'spot-002'])).toEqual(new Set(['spot-003']));
  });
  it('全部都去過還是抽得到', () => {
    expect(pickMany([a, b], ['spot-001', 'spot-002']).size).toBe(2);
  });
  it('不會連續抽到同一個', () => {
    expect(pickMany([a, b, c], [], 'spot-002')).toEqual(new Set(['spot-001', 'spot-003']));
  });
  it('沒去過的只剩上次那個時，改抽去過的', () => {
    expect(pickMany([a, b], ['spot-002'], 'spot-001')).toEqual(new Set(['spot-002']));
  });
  it('只有一個候選就抽它', () => {
    expect(pickSpot([a], { today, been: [], lastId: 'spot-001' }, () => 0.5)?.id).toBe('spot-001');
  });
});
