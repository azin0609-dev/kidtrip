import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatIssues, validateData } from '../src/data/validate.ts';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));

function readJson(name: string): unknown {
  const path = `${dataDir}${name}`;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    console.error(`✗ 讀不到或無法解析 data/${name}：${(error as Error).message}`);
    process.exit(1);
  }
}

const spots = readJson('spots.json');
const hotels = readJson('hotels.json');
const issues = validateData(spots, hotels);

if (issues.length > 0) {
  console.error(formatIssues(issues));
  console.error(`\n資料檢查失敗：共 ${issues.length} 個問題。`);
  process.exit(1);
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
console.log(`資料檢查通過：景點 ${count(spots)} 個、飯店 ${count(hotels)} 間。`);
