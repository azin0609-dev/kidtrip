/** 推薦條件的顯示文字。純函式。 */

export const DRIVE_LABELS: Record<number, string> = { 30: '30 分', 45: '45 分', 60: '1 小時', 120: '2 小時' };

export interface ConditionState {
  maxDrive: number;
  overnight: boolean;
  needStroller: boolean;
  rainy: boolean;
  elders: boolean;
}

/** 條件摘要：「單程 45 分內・帶推車・可能下雨」。條件區收起來時也看得到目前選了什麼。 */
export function conditionSummary(c: ConditionState): string {
  return [
    c.overnight ? '住一晚（附近有住宿）' : `單程 ${DRIVE_LABELS[c.maxDrive] ?? `${c.maxDrive} 分`}內`,
    c.needStroller && '帶推車',
    c.rainy && '可能下雨',
    c.elders && '長輩同行',
  ]
    .filter(Boolean)
    .join('・');
}
