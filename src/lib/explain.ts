/**
 * 推薦理由：最多兩句，回答「孩子可以玩什麼、為什麼適合我們家」和「去一趟要多久、有什麼好處」。
 * 不把分數原因一串接起來。純函式。
 */
import { formatDrive } from './format.ts';
import { ENV_LABELS, TYPE_LABELS } from './labels.ts';
import type { ScoredSpot } from './recommend.ts';

/** scoreSpot 產生的原因裡，哪些適合放進第二句（依重要性）。 */
const HIGHLIGHTS = [/最後機會$/, /^你們說會再來$/, /^你們給過/, /^這個季節正適合$/, /不怕熱$|不用曬太陽$|有遮蔭/, /^新開幕|^新/, /^還沒去過$/, /^收藏過$/];

export function explainPick(pick: ScoredSpot, originLabel: string): string {
  const { spot, reasons } = pick;
  const play = spot.kid_label ? `可以${spot.kid_label}` : `${spot.types.map((t) => TYPE_LABELS[t]).join('、')}類的景點`;
  const fit = reasons.find((r) => /年紀|都能玩/.test(r));
  const first = `${play}${fit ? `，${fit}` : ''}。`;

  const d = formatDrive(pick.mins);
  const env = spot.env === 'in' ? '全程室內' : ENV_LABELS[spot.env];
  const extra = HIGHLIGHTS.map((re) => reasons.find((r) => re.test(r))).find(Boolean);
  const second = `從${originLabel}約 ${d.value} ${d.unit}（粗估），${env}${extra ? `，${extra}` : ''}。`;
  return first + second;
}
