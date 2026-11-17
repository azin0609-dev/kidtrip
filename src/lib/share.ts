/** 用連結分享收藏與去過紀錄（不需要帳號或後端）。純函式。 */
import { type Ratings, parseRatings } from './ratings.ts';
import type { StoredState } from './storage.ts';

export const SHARE_PARAM = 'share';

export interface SharePayload {
  fav: string[];
  been: string[];
  beenAt: Record<string, string>;
  ratings: Ratings;
}

const ID_PATTERN = /^(spot|hotel|food)-\d{3,}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** 只分享收藏、去過；出發地、孩子資料不會放進連結。 */
export function encodeShare(state: Pick<StoredState, 'fav' | 'been' | 'beenAt' | 'ratings'>): string {
  const beenAt: Record<string, string> = {};
  for (const id of state.been) {
    const date = state.beenAt?.[id];
    if (date) beenAt[id] = date;
  }
  const ratings = state.ratings && Object.keys(state.ratings).length > 0 ? { r: state.ratings } : {};
  return toBase64Url(JSON.stringify({ v: 1, f: state.fav, b: state.been, d: beenAt, ...ratings }));
}

/** 解不開或格式不對回傳 null。不認得的 id 會被濾掉。 */
export function decodeShare(code: string): SharePayload | null {
  try {
    const data: unknown = JSON.parse(fromBase64Url(code));
    if (!data || typeof data !== 'object') return null;
    const obj = data as { f?: unknown; b?: unknown; d?: unknown; r?: unknown };
    const ids = (v: unknown) =>
      Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ID_PATTERN.test(x)))].slice(0, 500) : [];
    const fav = ids(obj.f);
    const been = ids(obj.b);
    const beenAt: Record<string, string> = {};
    if (obj.d && typeof obj.d === 'object') {
      for (const [id, date] of Object.entries(obj.d as Record<string, unknown>)) {
        if (been.includes(id) && typeof date === 'string' && DATE_PATTERN.test(date)) beenAt[id] = date;
      }
    }
    const ratings: Ratings = {};
    for (const [id, r] of Object.entries(parseRatings(obj.r) ?? {})) {
      if (ID_PATTERN.test(id)) ratings[id] = r;
    }
    return { fav, been, beenAt, ratings };
  } catch {
    return null;
  }
}

/** 合併：兩邊的收藏、去過取聯集；同一個地方兩邊都有日期時留比較新的。不會刪掉原本的東西。 */
export function mergeShare(state: StoredState, incoming: SharePayload): StoredState {
  const beenAt = { ...state.beenAt };
  for (const [id, date] of Object.entries(incoming.beenAt)) {
    const mine = beenAt[id];
    if (!mine || date > mine) beenAt[id] = date;
  }
  return {
    ...state,
    fav: [...new Set([...state.fav, ...incoming.fav])],
    been: [...new Set([...state.been, ...incoming.been])],
    beenAt,
    // 評分：自己評過的以自己的為準，沒評過的才用對方的。
    ratings: { ...incoming.ratings, ...state.ratings },
  };
}

/** 合併後會多出幾個收藏、幾個去過。 */
export function countNew(state: StoredState, incoming: SharePayload): { fav: number; been: number } {
  return {
    fav: incoming.fav.filter((id) => !state.fav.includes(id)).length,
    been: incoming.been.filter((id) => !state.been.includes(id)).length,
  };
}

export function buildShareUrl(baseUrl: string, state: Pick<StoredState, 'fav' | 'been' | 'beenAt' | 'ratings'>): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(SHARE_PARAM, encodeShare(state));
  return url.toString();
}
