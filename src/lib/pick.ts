import type { Spot } from '../data/schema.ts';
import { spotDateStatus } from './date.ts';

/**
 * 「幫我抽一個」：從目前清單隨機抽。
 * - 排除還沒開幕（和已熄燈）的。
 * - 優先排除去過的；全部都去過才從去過的裡面抽。
 * - 不要跟上一次抽到同一個（只剩一個時例外）。
 */
export function pickSpot(
  candidates: readonly Spot[],
  ctx: { today: string; been: readonly string[]; lastId: string | null },
  random: () => number = Math.random,
): Spot | null {
  const open = candidates.filter((s) => {
    const st = spotDateStatus(s, ctx.today);
    return !st.closed && !st.notYetOpen;
  });
  if (open.length === 0) return null;

  const been = new Set(ctx.been);
  const fresh = open.filter((s) => !been.has(s.id));
  let pool = fresh.length > 0 ? fresh : open;

  if (pool.length > 1 && ctx.lastId !== null) {
    pool = pool.filter((s) => s.id !== ctx.lastId);
  } else if (pool.length === 1 && pool[0]?.id === ctx.lastId && open.length > 1) {
    // 沒去過的只剩上次那一個：改從其他（去過的）抽，避免連續同一個。
    pool = open.filter((s) => s.id !== ctx.lastId);
  }

  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] ?? null;
}
