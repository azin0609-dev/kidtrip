export type Tab = 'spots' | 'hotels' | 'favs';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'spots', label: '親子景點' },
  { id: 'hotels', label: '親子飯店' },
  { id: 'favs', label: '我的收藏' },
];

/** 網址 hash → 分頁，認不得就回到景點。 */
export function tabFromHash(hash: string): Tab {
  const id = hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'spots';
}
