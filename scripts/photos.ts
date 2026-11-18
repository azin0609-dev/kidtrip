/**
 * 景點照片：從 Wikimedia Commons 加一張有授權的照片（只在開發時跑）。
 *
 *   node scripts/photos.ts spot-017 "File:Interior of Xpark- 05.2024-06-11.jpg"
 *   node scripts/photos.ts --list            # 列出哪些景點已經有照片
 *
 * 規則（AGENTS.md、docs/PHOTOS.md）：
 * - 只收 CC BY、CC BY-SA、CC0、公有領域（不收 NC、ND）。
 * - 照片一定要是這個地方本身；挑之前先在 Commons 看清楚說明和拍攝地點。
 * - 會縮成最長邊 960px 存到 public/photos/<id>.jpg，並把作者、授權、出處寫進 data/spots.json 的 image 欄位。
 * - 需要網路連到 commons.wikimedia.org 和 thumb.wikimedia.org；Node 要設 NODE_USE_ENV_PROXY=1 才會走代理。
 * - 自己拍的照片不用這個腳本：直接放進 public/photos/，在 JSON 填 image（license 寫「自己拍的」）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAllowedPhotoLicense } from './photos-lib.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const UA = 'kidtrip/0.2 (https://github.com/azin0609-dev/kidtrip)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const strip = (h = '') => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

type SpotRow = { id: string; name: string; image?: { url: string; credit: string; license: string; source_url?: string }; [k: string]: unknown };
const spotsPath = `${root}data/spots.json`;
const spots = JSON.parse(readFileSync(spotsPath, 'utf8')) as SpotRow[];

if (process.argv[2] === '--list') {
  const withPhoto = spots.filter((s) => s.image);
  console.log(`有照片：${withPhoto.length} / ${spots.length}`);
  for (const s of withPhoto) console.log(`  ${s.id} ${s.name}｜${s.image?.credit}｜${s.image?.license}`);
  process.exit(0);
}

const [id, title] = process.argv.slice(2);
if (!id || !title?.startsWith('File:')) {
  console.error('用法：node scripts/photos.ts <spot-id> "File:<Commons 檔名>"');
  process.exit(1);
}
const spot = spots.find((s) => s.id === id);
if (!spot) {
  console.error(`找不到 ${id}`);
  process.exit(1);
}

/** Commons 對共用 IP 常回 429，耐心等。 */
async function get(url: string): Promise<Response> {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (r.status !== 429) return r;
    console.error('Commons 請求太頻繁，等 30 秒再試…');
    await sleep(Math.max(Number(r.headers.get('retry-after') ?? 0) * 1000, 30_000));
  }
  throw new Error(`一直被限流：${url}`);
}

const params = new URLSearchParams({ action: 'query', format: 'json', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '960' });
const j = (await (await get(`https://commons.wikimedia.org/w/api.php?${params}`)).json()) as {
  query: { pages: Record<string, { imageinfo?: { url: string; thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[] }> };
};
const info = Object.values(j.query.pages)[0]?.imageinfo?.[0];
if (!info) {
  console.error(`Commons 上找不到 ${title}`);
  process.exit(1);
}
const license = info.extmetadata.LicenseShortName?.value ?? '';
if (!isAllowedPhotoLicense(license)) {
  console.error(`授權「${license}」不能用（只收 CC BY、CC BY-SA、CC0、公有領域）`);
  process.exit(1);
}

let img = await get(info.thumburl);
if (!img.ok) img = await get(info.url);
if (!img.ok) throw new Error(`下載失敗 HTTP ${img.status}`);
const raw = `${root}public/photos/.${id}.download`;
const out = `${root}public/photos/${id}.jpg`;
writeFileSync(raw, Buffer.from(await img.arrayBuffer()));
// 用 ImageMagick 縮圖、去掉 EXIF（包含 GPS）；沒有就原樣存。
try {
  execFileSync('convert', [raw, '-auto-orient', '-resize', '960x960>', '-strip', '-interlace', 'Plane', '-quality', '78', out]);
} catch {
  writeFileSync(out, readFileSync(raw));
  console.warn('找不到 ImageMagick，照片沒有縮圖，檔案可能比較大');
}
execFileSync('rm', ['-f', raw]);

spot.image = {
  url: `photos/${id}.jpg`,
  credit: `${strip(info.extmetadata.Artist?.value) || '佚名'}／Wikimedia Commons`,
  license,
  source_url: info.descriptionurl,
};
writeFileSync(spotsPath, `${JSON.stringify(spots, null, 2)}\n`);
console.log(`${id} ${spot.name}：已加上照片（${spot.image.credit}，${license}）`);
