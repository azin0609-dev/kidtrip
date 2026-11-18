/** 照片授權判斷。純函式，scripts/photos.ts 和 validate-data 共用。 */

/**
 * 可以用的授權：CC BY、CC BY-SA（任何版本）、CC0、公有領域、Commons 的「Attribution」，
 * 以及自己拍的或官方授權。NC（禁止商業）、ND（禁止改作）一律不收。
 */
export function isAllowedPhotoLicense(license: string): boolean {
  const l = license.trim();
  if (/\b(NC|ND)\b/i.test(l)) return false;
  return (
    /^CC BY(-SA)? \d(\.\d)?( [a-z]{2})?$/i.test(l) ||
    /^CC0( 1\.0)?$/i.test(l) ||
    /^(Public domain|PD)\b/i.test(l) ||
    /^Attribution$/i.test(l) ||
    /^(自己拍的|官方授權使用)$/.test(l)
  );
}
