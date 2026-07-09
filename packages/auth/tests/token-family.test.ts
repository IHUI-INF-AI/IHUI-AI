import { describe, it, expect } from 'vitest';
import { createFamilyId, validateFamilyId } from '../src/token-family';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('token-family', () => {
  describe('createFamilyId', () => {
    it('返回 UUID 格式字符串', () => {
      const id = createFamilyId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(UUID_REGEX);
    });

    it('每次生成不同值', () => {
      expect(createFamilyId()).not.toBe(createFamilyId());
    });
  });

  describe('validateFamilyId', () => {
    it('接受合法 UUID', () => {
      expect(validateFamilyId('11111111-1111-1111-1111-111111111111')).toBe(true);
      expect(validateFamilyId(createFamilyId())).toBe(true);
    });

    it('拒绝非法格式', () => {
      expect(validateFamilyId('')).toBe(false);
      expect(validateFamilyId('not-a-uuid')).toBe(false);
      expect(validateFamilyId('11111111111111111111111111111111')).toBe(false);
      expect(validateFamilyId('gggggggg-gggg-gggg-gggg-gggggggggggg')).toBe(false);
    });

    it('拒绝非字符串输入', () => {
      expect(validateFamilyId(null as unknown as string)).toBe(false);
      expect(validateFamilyId(undefined as unknown as string)).toBe(false);
    });
  });
});
