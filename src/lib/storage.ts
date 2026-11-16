/** 本機儲存，key 為 kidtrip.v1（PRD 第 7 節）。讀寫都不丟例外。 */

export const STORAGE_KEY = 'kidtrip.v1';

export interface StoredState {
  fav: string[];
  been: string[];
  /** 其他欄位（origin、kids…之後的任務才用）原樣保留。 */
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
    return { ...obj, fav: stringList(obj.fav), been: stringList(obj.been) };
  } catch {
    return emptyState();
  }
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
