import { useRegisterSW } from 'virtual:pwa-register/react';

/** 有新版本時跳出提示，點一下就換成新版並重新整理。 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // 開著不關的情況下，每小時檢查一次有沒有新版本。
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 pb-3 md:bottom-0 md:pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-md items-center gap-2 rounded-2xl bg-stone-900 p-2 pl-4 text-white shadow-lg dark:bg-stone-100 dark:text-stone-900">
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="min-h-11 flex-1 rounded-xl text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          有更新，點一下重新整理
        </button>
        <button
          type="button"
          aria-label="稍後再說"
          onClick={() => setNeedRefresh(false)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          ×
        </button>
      </div>
    </div>
  );
}
