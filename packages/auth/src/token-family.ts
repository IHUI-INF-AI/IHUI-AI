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
 */
export function validateFamilyId(familyId: string): boolean {
  if (!familyId || typeof familyId !== 'string') {
    return false;
  }
  // UUID v4 基本格式校验
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(familyId);
}

/**
 * Family 撤销器接口。
 *
 * 2026-07-22 鲁棒性加固:RFC 6749 §10.4 强制的 "refresh token rotation with reuse detection"。
 * packages/auth 不依赖 database(架构反向),通过此接口让 apps/api 注入实际撤销逻辑。
 *
 * 当 refreshAccessToken 检测到 token 已被 revoked(reuse 攻击),应调用注入的 revoker
 * 立即撤销整个 family 的所有活跃 token,迫使合法用户重新登录。
 *
 * apps/api 实现示例:
 *   const revoker: FamilyRevoker = {
 *     async revoke(familyId) {
 *       await revokeRefreshTokenFamily(familyId)  // SQL: UPDATE refresh_tokens SET revokedAt = NOW() WHERE familyId = $1 AND revokedAt IS NULL
 *     }
 *   }
 */
export interface FamilyRevoker {
  /** 撤销指定 family 下所有未吊销的 refresh token */
  revoke(familyId: string): Promise<void>;
}

/** No-op 实现(默认,保持向后兼容) */
export const noopFamilyRevoker: FamilyRevoker = {
  async revoke() {
    // no-op:调用方未注入 revoker 时不做 family 撤销
  },
};
