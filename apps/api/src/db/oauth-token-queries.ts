// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:OAuth 令牌端点专用查询(2026-09-21 立)。
 *
 * 为什么单独成文件而不加进 `queries.ts`:那两个方法的核心价值是**原子性**,
 * 与既有 `findRefreshToken` → `revokeRefreshToken` 的"读-判-写"三段式并存会让人误以为
 * 两条路都安全;独立命名 + 独立文件让"轮换必须走 claimRefreshToken"这件事无法被绕过。
 *
 * 断层说明:既有 `rotateRefreshTokenFlow`(routes/auth-extended.ts)是
 *   findRefreshToken(token) → 判 revokedAt → revokeRefreshToken(token)
 * 两个并发请求都能读到 `revokedAt IS NULL`,于是都通过校验、都签出新 token,
 * 旧 token 被 revoke 两次(第二次是空操作)—— RFC 6749 §10.4 要求的
 * "refresh token 轮换一次性"因此不成立,重用检测也永远不会触发。
 * 下面 `claimRefreshToken` 用单条条件 UPDATE + RETURNING 把"判断"和"占位"合并进
 * 同一条语句,由 PostgreSQL 的行锁保证并发下只有一个返回行。
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from './index.js'
import { oauthSessions, refreshTokens } from '@ihui/database'

/** 条件 UPDATE 成功占位后回读的最小记录。 */
export interface ClaimedRefreshToken {
  userId: string | null
  familyId: string | null
  expiresAt: Date | null
}

/**
 * 原子占位:仅当该 refresh token 尚未吊销时置 revoked_at。
 *
 * @returns 本次真正完成占位 → 返回占位前的行快照;
 *          行不存在 / 已被并发请求占走 → 返回 null(调用方必须按 invalid_grant 处理)
 */
export async function claimRefreshToken(token: string): Promise<ClaimedRefreshToken | null> {
  if (!token) return null
  const rows = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.token, token), isNull(refreshTokens.revokedAt)))
    .returning({
      userId: refreshTokens.userId,
      familyId: refreshTokens.familyId,
      expiresAt: refreshTokens.expiresAt,
    })
  const row = rows[0]
  if (!row) return null
  return { userId: row.userId ?? null, familyId: row.familyId ?? null, expiresAt: row.expiresAt ?? null }
}

/**
 * 撤销整个 token family(RFC 6749 §10.4 重用检测的"重放即全族失效")。
 *
 * 与 `queries.ts:revokeRefreshTokenFamily` 同一语义、同一实现路径 —— 这里只是把
 * "按 familyId 撤销"包成返回条数的形态供 revoke 端点回报,不新写第二套 family 逻辑。
 */
export async function revokeFamilyByFamilyId(familyId: string): Promise<number> {
  if (!familyId) return 0
  const rows = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id })
  return rows.length
}

/**
 * 按 familyId 查该 family 下仍活跃的行数(用于 revoke 响应可观测 + 单测断言)。
 * 只做只读计数,不返回任何 token 明文。
 */
export async function countActiveTokensInFamily(familyId: string): Promise<number> {
  if (!familyId) return 0
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
    .limit(1)
  return rows[0]?.count ?? 0
}

/** 授权码原子消费后回读的行(不含 challenge 之外的敏感列)。 */
export interface ClaimedAuthorizationCode {
  clientId: string
  userId: string
  state: string | null
  scope: string | null
  codeChallenge: string | null
  codeChallengeMethod: string | null
  expiresAt: Date
}

/**
 * 授权码一次性消费(条件 UPDATE ... WHERE is_used = FALSE RETURNING)。
 *
 * 与既有 `findSessionByCode` + `markSessionUsed` 的两步写法区别:并发下两个请求
 * 都能读到 `is_used = false`,于是同一个 code 能换出两份 token。这里把"判 is_used"
 * 与"置 is_used"合并成一条语句,第二个并发请求拿到 0 行 → 调用方按 invalid_grant 处理。
 * 返回 null 的三种情况统一按 RFC 语义回 `invalid_grant`(不区分,防授权码枚举)。
 */
export async function claimAuthorizationCode(
  code: string,
): Promise<ClaimedAuthorizationCode | null> {
  if (!code) return null
  const rows = await db
    .update(oauthSessions)
    .set({ isUsed: true })
    .where(and(eq(oauthSessions.code, code), eq(oauthSessions.isUsed, false)))
    .returning({
      clientId: oauthSessions.clientId,
      userId: oauthSessions.userId,
      state: oauthSessions.state,
      scope: oauthSessions.scope,
      codeChallenge: oauthSessions.codeChallenge,
      codeChallengeMethod: oauthSessions.codeChallengeMethod,
      expiresAt: oauthSessions.expiresAt,
    })
  const row = rows[0]
  if (!row) return null
  return {
    clientId: row.clientId,
    userId: row.userId,
    state: row.state ?? null,
    scope: row.scope ?? null,
    codeChallenge: row.codeChallenge ?? null,
    codeChallengeMethod: row.codeChallengeMethod ?? null,
    expiresAt: row.expiresAt,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
