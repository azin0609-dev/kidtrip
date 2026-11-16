import { useCallback, useEffect, useState } from 'react';
import { type StoredState, getBrowserStorage, loadState, saveState } from '../lib/storage.ts';

/** 讀寫 localStorage「kidtrip.v1」。寫入失敗時只留在記憶體，畫面照常運作。 */
export function useStoredState() {
  const [state, setState] = useState<StoredState>(() => loadState(getBrowserStorage()));

  useEffect(() => {
    saveState(getBrowserStorage(), state);
  }, [state]);

  const update = useCallback((fn: (prev: StoredState) => StoredState) => setState(fn), []);
  return [state, update] as const;
}
