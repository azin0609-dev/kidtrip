import { describe, expect, it } from 'vitest';
import { KIDPICK_INITIAL, type KidPickAction, type KidPickState, kidPickStep } from './kidpick.ts';

/** 依序跑完一串動作，回傳最後狀態和過程中所有要存的 id。 */
function run(actions: KidPickAction[], start: KidPickState = KIDPICK_INITIAL) {
  let state = start;
  const commits: string[] = [];
  for (const a of actions) {
    const step = kidPickStep(state, a);
    state = step.state;
    if (step.commit) commits.push(step.commit);
  }
  return { state, commits };
}

describe('換我決定！的確認流程', () => {
  it('小孩點了只是暫選，不會存', () => {
    const r = run([{ type: 'select', id: 'spot-001' }]);
    expect(r.state).toEqual({ selectedId: 'spot-001', confirmed: false });
    expect(r.commits).toEqual([]);
  });

  it('家長確認才存，而且只存一次', () => {
    const r = run([{ type: 'select', id: 'spot-001' }, { type: 'confirm' }, { type: 'confirm' }]);
    expect(r.commits).toEqual(['spot-001']);
    expect(r.state.confirmed).toBe(true);
  });

  it('暫選後關掉或再選一次，原本的計畫不動', () => {
    expect(run([{ type: 'select', id: 'spot-001' }, { type: 'close' }]).commits).toEqual([]);
    const r = run([{ type: 'select', id: 'spot-001' }, { type: 'reselect' }, { type: 'select', id: 'spot-002' }, { type: 'confirm' }]);
    expect(r.commits).toEqual(['spot-002']);
  });

  it('還沒選就按確認，什麼都不做', () => {
    expect(run([{ type: 'confirm' }]).commits).toEqual([]);
  });

  it('確認之後誤觸別張卡，不會換掉', () => {
    const r = run([{ type: 'select', id: 'spot-001' }, { type: 'confirm' }, { type: 'select', id: 'spot-003' }]);
    expect(r.state.selectedId).toBe('spot-001');
    expect(r.commits).toEqual(['spot-001']);
  });

  it('關掉後重新打開是乾淨的狀態', () => {
    const r = run([{ type: 'select', id: 'spot-001' }, { type: 'confirm' }, { type: 'close' }]);
    expect(r.state).toEqual(KIDPICK_INITIAL);
  });
});
