import { describe, expect, it } from 'vitest';
import { makeSpot } from '../test/fixtures.ts';
import { explainPick } from './explain.ts';

describe('推薦理由', () => {
  it('兩句：能玩什麼、適合誰；車程、室內外、一個最重要的原因', () => {
    const spot = makeSpot({ kid_label: '看企鵝和水母', env: 'in' });
    const text = explainPick({ spot, mins: 20, score: 80, reasons: ['離家約 20 分', '室內', '適合果果的年紀，核桃坐推車跟著', '還沒去過', '收藏過'] }, '林口區');
    expect(text).toBe('可以看企鵝和水母，適合果果的年紀，核桃坐推車跟著。從林口區約 20 分（粗估），全程室內，還沒去過。');
    expect(text.split('。').filter(Boolean)).toHaveLength(2);
  });
  it('沒有短標籤時用類型；季節比「還沒去過」優先', () => {
    const spot = makeSpot({ types: ['farm'], env: 'out' });
    const text = explainPick({ spot, mins: 50, score: 60, reasons: ['離家約 50 分', '戶外', '還沒去過', '這個季節正適合'] }, '林口區');
    expect(text).toBe('農場類的景點。從林口區約 50 分（粗估），戶外，這個季節正適合。');
  });
});
