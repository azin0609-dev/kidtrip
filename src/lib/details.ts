/** 景點的適合年齡、停留時間等說明文字。純函式。 */
import type { Spot } from '../data/schema.ts';

export interface Kid {
  nickname: string;
  /** YYYY-MM */
  birthYm: string;
}

/** 出生年月 → 幾歲（足歲，可以有小數）；格式不對或還沒出生回傳 null。 */
export function ageYears(birthYm: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(birthYm);
  if (!m) return null;
  const [ty, tm] = today.split('-').map(Number) as [number, number];
  const months = (ty - Number(m[1])) * 12 + (tm - Number(m[2]));
  return months < 0 ? null : months / 12;
}

/** 「最適合 2–6 歲」；上限 12 歲以上寫成「2 歲以上」。 */
export function ageBestLabel(range: readonly [number, number]): string {
  const [min, max] = range;
  if (max >= 12) return min <= 0 ? '各年齡都適合' : `最適合 ${min} 歲以上`;
  return `最適合 ${min}–${max} 歲`;
}

/** 「約 1.5 小時」「可以玩半天」「可以玩一整天」。 */
export function stayLabel(hours: number): string {
  if (hours >= 5) return '可以玩一整天';
  if (hours >= 3) return `可以玩半天（約 ${hours} 小時）`;
  return `建議待 ${hours} 小時`;
}

/**
 * 依設定裡的孩子年齡給提醒：
 * - 有孩子比建議年齡小 → 「核桃（1 歲）可能還太小，能玩的不多」
 * - 所有孩子都超過建議年齡 → 「果果（9 歲）可能會覺得太幼稚」
 * 沒有設定孩子、或景點沒有年齡資料 → null。
 */
export function kidAgeNote(spot: Pick<Spot, 'age_best'>, kids: readonly Kid[], today: string): string | null {
  if (!spot.age_best) return null;
  const [min, max] = spot.age_best;
  const aged = kids
    .map((k) => ({ name: k.nickname.trim() || '孩子', age: ageYears(k.birthYm, today) }))
    .filter((k): k is { name: string; age: number } => k.age !== null);
  if (aged.length === 0) return null;

  const show = (k: { name: string; age: number }) =>
    `${k.name}（${k.age < 1 ? `${Math.round(k.age * 12)} 個月` : `${Math.floor(k.age)} 歲`}）`;

  const tooYoung = aged.filter((k) => Math.floor(k.age) < min);
  if (tooYoung.length === aged.length) return `${tooYoung.map(show).join('、')}可能還太小，能玩的不多`;
  if (tooYoung.length > 0) return `${tooYoung.map(show).join('、')}可能還太小，要有大人陪在旁邊`;
  if (max < 12 && aged.every((k) => Math.floor(k.age) > max)) return `${aged.map(show).join('、')}可能會覺得太幼稚`;
  return null;
}
