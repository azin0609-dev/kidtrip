/** 車程大數字：60 分以下取到 5 分鐘（最少 5 分），以上以 0.5 小時為單位。 */
export function formatDrive(mins: number): { value: string; unit: string } {
  if (mins < 60) return { value: String(Math.max(5, Math.round(mins / 5) * 5)), unit: '分' };
  const hours = Math.round((mins / 60) * 2) / 2;
  return { value: String(hours), unit: '小時' };
}

/** 畫面文字：「約 25 分（粗估）」、「約 1.5 小時（粗估）」。 */
export function formatEstimate(mins: number): string {
  const d = formatDrive(mins);
  return `約 ${d.value} ${d.unit}（粗估）`;
}

/** 資料整理日期：取所有資料中最新的 last_verified。 */
export function latestVerified(items: readonly { last_verified: string }[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    if (latest === null || item.last_verified > latest) latest = item.last_verified;
  }
  return latest;
}

/** 「新北市林口區」→「林口區」；「目前位置（…附近）」→「目前位置」。 */
export function shortOriginLabel(label: string): string {
  if (label.startsWith('目前位置')) return '目前位置';
  const m = /^.{2}[縣市](.+)$/.exec(label);
  return m?.[1] ?? label;
}
