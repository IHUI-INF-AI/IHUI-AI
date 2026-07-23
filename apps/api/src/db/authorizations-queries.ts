import { eq, and, isNull, gt, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { refreshTokens } from '@ihui/database'

/** 活跃会话信息(不含 token 字段,避免泄露 refresh token)。 */
export interface SessionInfo {
  id: string
  createdAt: Date | null
  expiresAt: Date | null
  familyId: string | null
}

/**
 * 分页查询用户活跃会话(未撤销且未过期的 refresh tokens),按创建时间倒序。
 * 不返回 token 字段(安全考虑)。
 */
export async function findActiveSessions(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: SessionInfo[]; total: number; page: number; pageSize: number }> {
  const activeCondition = and(
    eq(refreshTokens.userId, userId),
    isNull(refreshTokens.revokedAt),
    gt(refreshTokens.expiresAt, new Date()),
  )
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: refreshTokens.id,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
        familyId: refreshTokens.familyId,
      })
      .from(refreshTokens)
      .where(activeCondition)
      .orderBy(desc(refreshTokens.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(refreshTokens)
      .where(activeCondition),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 撤销指定会话(设置 revokedAt = NOW())。只能撤销自己的会话。返回是否成功。 */
export async function revokeSession(userId: string, tokenId: string): Promise<boolean> {
  const rows = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.id, tokenId),
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .returning({ id: refreshTokens.id })
  return rows.length > 0
}
