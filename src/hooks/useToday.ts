import { useEffect, useState } from 'react';
import { todayInTaipei } from '../lib/date.ts';

/**
 * 今天的日期（Asia/Taipei）。App 開著不關也會跨日更新：
 * 每分鐘檢查一次，切回 App 時也檢查。
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayInTaipei());
  useEffect(() => {
    const check = () => setToday((prev) => {
      const now = todayInTaipei();
      return now === prev ? prev : now;
    });
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
