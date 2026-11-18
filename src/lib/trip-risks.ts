/**
 * 出發前要先知道的風險：目的地天氣、熱、預約購票。純函式，給推薦卡用。
 * 不假造即時路況或停車等候時間，只用已有的預報和資料。
 */
import type { Spot } from '../data/schema.ts';
import type { SlotWeather } from './weather.ts';

/** 30 度以上算熱。 */
export const HOT_TEMP = 30;

export function isHot(w: SlotWeather | null): boolean {
  return w?.tempMax !== null && w?.tempMax !== undefined && w.tempMax >= HOT_TEMP;
}

/**
 * 目的地那個時段會不會下雨。出發地晴天、目的地下雨時也要提醒。
 * 回傳 null 代表沒有要提醒的；預報抓不到時回傳「不知道」的提醒，不當成晴天。
 */
export function destinationWeatherNote(spot: Spot, w: SlotWeather | null, far: boolean): string | null {
  if (!w) return far ? '目的地那時段還沒有預報，不代表不會下雨，出發前再看一次。' : null;
  if (w.rainy && spot.env !== 'in') {
    const p = w.rainProb !== null ? `降雨機率 ${w.rainProb}%` : '可能下雨';
    return spot.env === 'semi' ? `目的地那時段${p}，這裡有遮棚，小雨還可以。` : `目的地那時段${p}，這裡大部分在戶外，考慮換室內的。`;
  }
  if (isHot(w) && spot.env === 'out') {
    const shaded = spot.amenities?.shade === 'yes' || spot.facilities?.includes('shade');
    return `那時候約 ${w.tempMax} 度${shaded ? '，找有遮蔭的地方休息' : '，這裡遮蔭少'}，記得防曬、多喝水。`;
  }
  return null;
}

/** 預約、購票、場次：只看結構化的 booking 欄位，不從文字猜。不知道就不寫。 */
export function bookingNotice(spot: Spot): string | null {
  const b = spot.booking;
  if (!b) return null;
  const parts = [b.reservation === 'yes' && '要先預約', b.advance_ticket === 'yes' && '要先買票', b.timed_entry === 'yes' && '分時段入場'].filter(
    (x): x is string => Boolean(x),
  );
  return parts.length > 0 ? parts.join('、') : null;
}
