import { describe, expect, it } from 'vitest';
import { isAllowedPhotoLicense } from './photos-lib.ts';

describe('照片授權', () => {
  it('收 CC BY、CC BY-SA、CC0、公有領域、自己拍的', () => {
    for (const l of ['CC BY 4.0', 'CC BY-SA 3.0', 'CC BY 2.0', 'CC BY-SA 2.5', 'CC0', 'Public domain', 'Attribution', '自己拍的', '官方授權使用', 'CC BY-SA 3.0 tw']) {
      expect(isAllowedPhotoLicense(l), l).toBe(true);
    }
  });
  it('不收禁止商業、禁止改作、看不懂的授權', () => {
    for (const l of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 2.0', 'All rights reserved', '', 'Fair use']) {
      expect(isAllowedPhotoLicense(l), l).toBe(false);
    }
  });
});
