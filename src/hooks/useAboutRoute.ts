import { useCallback, useEffect, useRef, useState } from 'react';
import { ABOUT_HASH, isAboutHash } from '../lib/tabs.ts';

/**
 * 品牌故事頁的開關：用網址 #about，手機的返回鍵、滑動返回都能關掉。
 * 從 App 裡打開的，關閉時用 history.back()，回到原本的分頁和捲動位置；
 * 直接打開 #about 連結的，關閉時回到「去放電」。
 */
export function useAboutRoute() {
  const [open, setOpen] = useState(() => isAboutHash(window.location.hash));
  const fromApp = useRef(false);

  useEffect(() => {
    const onChange = () => setOpen(isAboutHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const show = useCallback(() => {
    fromApp.current = true;
    window.location.hash = ABOUT_HASH;
  }, []);

  const hide = useCallback(() => {
    if (fromApp.current) {
      fromApp.current = false;
      window.history.back();
    } else {
      window.location.hash = 'spots';
    }
  }, []);

  /** 離開故事頁，直接去某個分頁（取代 #about 這一筆歷史，返回鍵不會再回到故事頁）。 */
  const leaveTo = useCallback((tab: string) => {
    fromApp.current = false;
    window.location.replace(`#${tab}`);
  }, []);

  return { open, show, hide, leaveTo };
}
