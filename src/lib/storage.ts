/** 本機儲存，key 為 kidtrip.v1（PRD 第 7 節）。讀寫都不丟例外。 */
import { type Ratings, parseRatings } from './ratings.ts';

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

export interface StoredReport {
  /** 景點或飯店的 id */
  id: string;
  note: string;
  /** YYYY-MM-DD */
  date: string;
}

export const DEFAULT_NAP: StoredNap = { start: '13:00', end: '15:00' };

function parseReports(v: unknown): StoredReport[] | null {
  if (!Array.isArray(v)) return null;
  return v.flatMap((r) =>
    r && typeof r === 'object' && typeof r.id === 'string' && typeof r.note === 'string' && typeof r.date === 'string'
      ? [{ id: r.id as string, note: (r.note as string).slice(0, 500), date: r.date as string }]
      : [],
  );
}

export const MEMO_MAX = 200;

function parseMemos(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [id, text] of Object.entries(v as Record<string, unknown>)) {
    if (typeof text === 'string' && text.trim() !== '') out[id] = text.slice(0, MEMO_MAX);
  }
  return out;
}

/** 寫入或清掉一則回憶（空白就刪掉）。 */
export function setMemo(state: StoredState, id: string, text: string): StoredState {
  const memos = { ...state.memos };
  const clean = text.trim().slice(0, MEMO_MAX);
  if (clean === '') delete memos[id];
  else memos[id] = clean;
  return { ...state, memos };
}

export interface MemoryItem {
  id: string;
  name: string;
  /** 沒有記錄日期時是 null */
  date: string | null;
  text: string;
}

/** 回憶清單：新的排前面，沒有日期的排最後。 */
export function listMemories(
  memos: Readonly<Record<string, string>>,
  beenAt: Readonly<Record<string, string>>,
  nameOf: (id: string) => string,
): MemoryItem[] {
  return Object.entries(memos)
    .map(([id, text]) => ({ id, name: nameOf(id), date: beenAt[id] ?? null, text }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id));
}

/** 把回報整理成可以貼給別人的文字。 */
export function formatReports(reports: readonly StoredReport[], nameOf: (id: string) => string): string {
  return reports.map((r) => `${r.date}｜${nameOf(r.id)}（${r.id}）：${r.note}`).join('\n');
}

export interface StoredState {
  fav: string[];
  been: string[];
  /** id → 去過的日期（YYYY-MM-DD）。任務 1-5 加入；舊資料沒有這欄，視為日期不明。 */
  beenAt?: Record<string, string>;
  origin?: StoredOrigin;
  kids?: StoredKid[];
  nap?: StoredNap;
  /** 使用者回報「資料有誤」的紀錄，只存在本機，可以在設定裡複製出來。 */
  reports?: StoredReport[];
  /** 去過之後寫的一句回憶：id → 文字（最多 200 字）。只存本機，分享連結不會帶。 */
  memos?: Record<string, string>;
  /** 去過之後的自家評分：id → { stars, tags }。 */
  ratings?: Ratings;
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
    const reports = parseReports(obj.reports);
    if (reports) state.reports = reports;
    else delete state.reports;
    const memos = parseMemos(obj.memos);
    if (memos) state.memos = memos;
    else delete state.memos;
    const ratings = parseRatings(obj.ratings);
    if (ratings) state.ratings = ratings;
    else delete state.ratings;
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
