export type Tab = 'spots' | 'hotels' | 'food' | 'trips' | 'favs';

/** 分頁：id 和網址 hash 維持不變（舊的分享網址要能開），只改顯示名稱。 */
export const TABS: { id: Tab; label: string }[] = [
  { id: 'spots', label: '去放電' },
  { id: 'hotels', label: '住一晚' },
  { id: 'food', label: '吃好料' },
  { id: 'trips', label: '飛出國' },
  { id: 'favs', label: '我的' },
];

/** 網址 hash → 分頁，認不得就回到景點。 */
export function tabFromHash(hash: string): Tab {
  const id = hash.replace(/^#\/?/, '');
  return TABS.some((t) => t.id === id) ? (id as Tab) : 'spots';
}

/** 品牌故事頁的網址 hash（#about）。不是分頁：底下的分頁維持原樣，返回時回到原本的位置。 */
export const ABOUT_HASH = 'about';

export function isAboutHash(hash: string): boolean {
  return hash.replace(/^#\/?/, '') === ABOUT_HASH;
}
