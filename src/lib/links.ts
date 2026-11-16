import type { Hotel, Spot } from '../data/schema.ts';

/** 「新北市林口區（青埔）」→「新北市林口區」，括號補充不放進搜尋字串。 */
export function stripParens(text: string): string {
  return text.replace(/[（(][^）)]*[）)]/g, '').trim();
}

/** Google Maps 免費的搜尋／導航連結（AGENTS.md 指定格式）。 */
export function googleMapsUrl(place: Pick<Spot | Hotel, 'name' | 'city' | 'google_place_id'>): string {
  const params = new URLSearchParams({ api: '1', query: `${place.name} ${stripParens(place.city)}` });
  if (place.google_place_id) params.set('query_place_id', place.google_place_id);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/** 查房價：Google 旅遊的飯店搜尋，不帶任何推薦碼。 */
export function hotelPriceUrl(hotel: Pick<Hotel, 'name' | 'city'>): string {
  const params = new URLSearchParams({ q: `${hotel.name} ${stripParens(hotel.city)}` });
  return `https://www.google.com/travel/search?${params.toString()}`;
}
