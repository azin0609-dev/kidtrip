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

/**
 * 按順序的多站路線（Google Maps URLs，免費、不用金鑰）。最後一站是目的地，前面的是途經點。
 * 不帶出發地：Google 地圖會用手機目前位置。每一站用「名稱＋縣市」和 place_id 指定，
 * 不用座標，避免把只到鄉鎮的座標當成景點入口。只有一站時跟 directionsUrl 一樣。
 */
export function routeUrl(stops: readonly { name: string; city: string; google_place_id: string | null }[]): string {
  const dest = stops[stops.length - 1];
  if (!dest) throw new Error('routeUrl 至少要一站');
  if (stops.length === 1) return directionsUrl(dest);
  const query = (p: { name: string; city: string }) => `${p.name} ${stripParens(p.city)}`.trim();
  const via = stops.slice(0, -1);
  const params = new URLSearchParams({ api: '1', destination: query(dest) });
  if (dest.google_place_id) params.set('destination_place_id', dest.google_place_id);
  params.set('waypoints', via.map(query).join('|'));
  // waypoint_place_ids 要跟 waypoints 一一對應，有缺就整個不帶（只用名稱）。
  const ids = via.map((p) => p.google_place_id);
  if (ids.every((id): id is string => !!id)) params.set('waypoint_place_ids', ids.join('|'));
  params.set('travelmode', 'driving');
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

/** 景點照片的網址：完整網址原樣使用；相對路徑放在 public/ 底下，要加上部署的子路徑（例如 /kidtrip/）。 */
export function imageSrc(url: string, base: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${base.endsWith('/') ? base : `${base}/`}${url.replace(/^\/+/, '')}`;
}
