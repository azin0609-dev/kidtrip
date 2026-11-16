/** 本機儲存，key 為 kidtrip.v1（PRD 第 7 節）。讀寫都不丟例外。 */

export const STORAGE_KEY = 'kidtrip.v1';

export interface StoredOrigin {
  label: string;
  lat: number;
  lng: number;
}
export interface StoredKid {
  nickname: string;
  /** YYYY-MM */
  birthYm: string;
}
export interface StoredNap {
  /** HH:MM */
  start: string;
  end: string;
}

export const DEFAULT_NAP: StoredNap = { start: '13:00', end: '15:00' };

export interface StoredState {
  fav: string[];
  been: string[];
  /** id → 去過的日期（YYYY-MM-DD）。任務 1-5 加入；舊資料沒有這欄，視為日期不明。 */
  beenAt?: Record<string, string>;
  origin?: StoredOrigin;
  kids?: StoredKid[];
  nap?: StoredNap;
  /** 不認得的欄位原樣保留，之後的版本可能會用到。 */
  [key: string]: unknown;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyState(): StoredState {
  return { fav: [], been: [] };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : [];
}

/** 解析存下來的字串；格式壞掉就回到空白狀態。 */
export function parseState(raw: string | null): StoredState {
  if (raw === null) return emptyState();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyState();
    const obj = data as Record<string, unknown>;
    const state: StoredState = { ...obj, fav: stringList(obj.fav), been: stringList(obj.been) };
    // 型別不對的欄位直接拿掉，不讓壞資料影響畫面。
    const beenAt = parseBeenAt(obj.beenAt, state.been);
    if (beenAt) state.beenAt = beenAt;
    else delete state.beenAt;
    const origin = parseOrigin(obj.origin);
    if (origin) state.origin = origin;
    else delete state.origin;
    const kids = parseKids(obj.kids);
    if (kids) state.kids = kids;
    else delete state.kids;
    const nap = parseNap(obj.nap);
    if (nap) state.nap = nap;
    else delete state.nap;
    return state;
  } catch {
    return emptyState();
  }
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 只保留合法日期、而且還在 been 裡的紀錄。 */
function parseBeenAt(v: unknown, been: readonly string[]): Record<string, string> | null {
  if (!isRecord(v)) return null;
  const out: Record<string, string> = {};
  for (const [id, date] of Object.entries(v)) {
    if (been.includes(id) && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) out[id] = date;
  }
  return out;
}

/** 切換「去過」：標成去過時記下今天；取消時一併刪掉日期。 */
export function toggleBeen(state: StoredState, id: string, today: string): StoredState {
  const beenAt = { ...state.beenAt };
  if (state.been.includes(id)) {
    delete beenAt[id];
    return { ...state, been: state.been.filter((x) => x !== id), beenAt };
  }
  beenAt[id] = today;
  return { ...state, been: [...state.been, id], beenAt };
}

function parseOrigin(v: unknown): StoredOrigin | null {
  if (!isRecord(v) || typeof v.label !== 'string' || !isFiniteNumber(v.lat) || !isFiniteNumber(v.lng)) return null;
  if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
  return { label: v.label, lat: v.lat, lng: v.lng };
}

function parseKids(v: unknown): StoredKid[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((k) =>
    isRecord(k) && typeof k.nickname === 'string' && typeof k.birthYm === 'string'
      ? [{ nickname: k.nickname, birthYm: /^\d{4}-\d{2}$/.test(k.birthYm) ? k.birthYm : '' }]
      : [],
  );
}

function parseNap(v: unknown): StoredNap | null {
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!isRecord(v) || typeof v.start !== 'string' || typeof v.end !== 'string') return null;
  if (!hhmm.test(v.start) || !hhmm.test(v.end)) return null;
  return { start: v.start, end: v.end };
}

/** 取得 localStorage；隱私模式或被封鎖時回傳 null。 */
export function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadState(storage: StorageLike | null): StoredState {
  if (!storage) return emptyState();
  try {
    return parseState(storage.getItem(STORAGE_KEY));
  } catch {
    return emptyState();
  }
}

/** 寫入成功回傳 true；失敗（空間滿、被封鎖）回傳 false，畫面照常運作。 */
export function saveState(storage: StorageLike | null, state: StoredState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
