import { useCallback, useEffect, useState } from 'react';
import { type Tab, tabFromHash } from '../lib/tabs.ts';

export function useHashTab() {
  const [tab, setTab] = useState<Tab>(() => tabFromHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((next: Tab) => {
    window.location.hash = next;
  }, []);

  return [tab, go] as const;
}
