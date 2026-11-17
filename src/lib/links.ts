import type { Hotel } from '../data/schema.ts';

/** 「新北市林口區（青埔）」→「新北市林口區」，括號補充不放進搜尋字串。 */
export function stripParens(text: string): string {
  return text.replace(/[（(][^）)]*[）)]/g, '').trim();
}

/** Google Maps 免費的搜尋／導航連結（AGENTS.md 指定格式）。 */
export function googleMapsUrl(place: { name: string; city: string; google_place_id: string | null }): string {
  const params = new URLSearchParams({ api: '1', query: `${place.name} ${stripParens(place.city)}`.trim() });
  if (place.google_place_id) params.set('query_place_id', place.google_place_id);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Google Maps 的路線連結（免金鑰）：從使用者目前位置導航到目的地。
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function directionsUrl(place: { name: string; city: string; google_place_id: string | null }): string {
  const params = new URLSearchParams({ api: '1', destination: `${place.name} ${stripParens(place.city)}`.trim() });
  if (place.google_place_id) params.set('destination_place_id', place.google_place_id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** 找官方資訊：有官方網址就直接連，沒有就用 Google 搜尋景點名稱。 */
export function officialInfoUrl(spot: { name: string; official_url?: string }): string {
  return spot.official_url ?? `https://www.google.com/search?${new URLSearchParams({ q: `${spot.name} 官方 開放時間` }).toString()}`;
}

/** 查房價：Google 旅遊的飯店搜尋，不帶任何推薦碼。 */
export function hotelPriceUrl(hotel: Pick<Hotel, 'name' | 'city'>): string {
  const params = new URLSearchParams({ q: `${hotel.name} ${stripParens(hotel.city)}` });
  return `https://www.google.com/travel/search?${params.toString()}`;
}
