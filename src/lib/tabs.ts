export type Tab = 'spots' | 'hotels' | 'food' | 'favs';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'spots', label: '景點' },
  { id: 'hotels', label: '住宿' },
  { id: 'food', label: '餐廳' },
  { id: 'favs', label: '我的' },
];

/** 網址 hash → 分頁，認不得就回到景點。 */
export function tabFromHash(hash: string): Tab {
  const id = hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'spots';
}
