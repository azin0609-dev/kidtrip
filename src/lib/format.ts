/** 車程大數字：60 分以下顯示分鐘，以上以 0.5 小時為單位。 */
export function formatDrive(mins: number): { value: string; unit: string } {
  if (mins < 60) return { value: String(Math.round(mins)), unit: '分' };
  const hours = Math.round((mins / 60) * 2) / 2;
  return { value: String(hours), unit: '小時' };
}

/** 資料整理日期：取所有資料中最新的 last_verified。 */
export function latestVerified(items: readonly { last_verified: string }[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    if (latest === null || item.last_verified > latest) latest = item.last_verified;
  }
  return latest;
}
