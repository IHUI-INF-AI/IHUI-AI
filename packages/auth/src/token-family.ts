import { randomUUID } from 'node:crypto';

/**
 * 创建新的 token family ID（用于 refresh token 重放检测）。
 * 每次 login / register 时生成新的 family_id，refresh 轮转时保持同 family。
 */
export function createFamilyId(): string {
  return randomUUID();
}

/**
 * 校验 family_id 格式是否合法（UUID v4）。
 * 当前为骨架实现，仅做基础格式检查。
 */
export function validateFamilyId(familyId: string): boolean {
  if (!familyId || typeof familyId !== 'string') {
    return false;
  }
  // UUID v4 基本格式校验
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(familyId);
}
