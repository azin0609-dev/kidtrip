import type { z } from 'zod';
import { hotelSchema, isValidIsoDate, spotSchema } from './schema.ts';

export interface DataIssue {
  file: 'spots.json' | 'hotels.json';
  /** 該筆的 id；id 本身缺漏時用「#索引」表示。 */
  id: string;
  /** 出錯的欄位路徑，例如 region、types[1]。 */
  field: string;
  message: string;
}

function recordLabel(record: unknown, index: number): string {
  if (record && typeof record === 'object' && 'id' in record) {
    const id = (record as { id: unknown }).id;
    if (typeof id === 'string' && id.trim() !== '') return id;
  }
  return `#${index}`;
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join('');
}

function checkList(
  file: DataIssue['file'],
  data: unknown,
  schema: z.ZodType,
): { issues: DataIssue[]; ids: Set<string> } {
  const issues: DataIssue[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(data)) {
    issues.push({ file, id: '(整個檔案)', field: '', message: '最外層必須是陣列' });
    return { issues, ids };
  }

  if (data.length === 0) {
    issues.push({ file, id: '(整個檔案)', field: '', message: '沒有任何資料' });
  }

  data.forEach((record, index) => {
    const label = recordLabel(record, index);
    const result = schema.safeParse(record);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({ file, id: label, field: formatPath(issue.path) || '(整筆)', message: issue.message });
      }
    }

    if (!label.startsWith('#')) {
      if (ids.has(label)) {
        issues.push({ file, id: label, field: 'id', message: 'id 重複' });
      }
      ids.add(label);
    }
  });

  return { issues, ids };
}

/** 檢查景點與飯店資料，回傳所有問題；空陣列代表全部通過。 */
export function validateData(spots: unknown, hotels: unknown): DataIssue[] {
  const spotResult = checkList('spots.json', spots, spotSchema);
  const hotelResult = checkList('hotels.json', hotels, hotelSchema);
  const issues = [...spotResult.issues, ...hotelResult.issues];

  if (Array.isArray(hotels)) {
    hotels.forEach((hotel, index) => {
      const nearIds: unknown = hotel && typeof hotel === 'object' ? (hotel as { near_spot_ids?: unknown }).near_spot_ids : undefined;
      if (!Array.isArray(nearIds)) return;
      nearIds.forEach((spotId, i) => {
        if (typeof spotId === 'string' && !spotResult.ids.has(spotId)) {
          issues.push({
            file: 'hotels.json',
            id: recordLabel(hotel, index),
            field: `near_spot_ids[${i}]`,
            message: `找不到景點 ${spotId}`,
          });
        }
      });
    });
  }

  if (Array.isArray(spots)) {
    spots.forEach((spot, index) => {
      if (!spot || typeof spot !== 'object') return;
      const { opens_on, closes_on } = spot as { opens_on?: unknown; closes_on?: unknown };
      if (
        typeof opens_on === 'string' &&
        typeof closes_on === 'string' &&
        isValidIsoDate(opens_on) &&
        isValidIsoDate(closes_on) &&
        opens_on > closes_on
      ) {
        issues.push({
          file: 'spots.json',
          id: recordLabel(spot, index),
          field: 'closes_on',
          message: `熄燈日 ${closes_on} 早於開幕日 ${opens_on}`,
        });
      }
    });
  }

  return issues;
}

export function formatIssues(issues: DataIssue[]): string {
  return issues.map((i) => `✗ ${i.file}  ${i.id}  ${i.field}：${i.message}`).join('\n');
}
