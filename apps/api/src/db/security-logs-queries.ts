// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { securityLogs, type SecurityLog } from '@ihui/database'

/** 分页查询用户安全日志,按创建时间倒序。 */
export async function findSecurityLogs(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: SecurityLog[]; total: number; page: number; pageSize: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(securityLogs)
      .where(eq(securityLogs.userId, userId))
      .orderBy(desc(securityLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(securityLogs)
      .where(eq(securityLogs.userId, userId)),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 记录一条安全日志。 */
export async function createSecurityLog(
  data: Omit<SecurityLog, 'id' | 'createdAt'> & { id?: string; createdAt?: Date },
): Promise<SecurityLog> {
  const rows = await db.insert(securityLogs).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('创建安全日志失败')
  return row
}

/**
 * 带请求归因的安全事件写入口 —— 本表此前**零调用方**（`createSecurityLog` 造好没装车），
 * 于是 /settings/security-logs 与其消费端（web 设置页安全日志、RN 安全中心）永远只能说"暂无"。
 * ip / UA 的取法与 plugins/audit-logger.ts:343,368-369 逐字同形（含 512 截断，对齐列宽），
 * 不在这里另起一套口径；写失败只报一行、绝不把业务请求带崩（安全事件是旁路账）。
 *
 * `options.principalUserId` 给的是**登录前**那一格：那时 checkAuth 还没跑、request.userId 恒空，
 * 而本表 user_id notNull —— 认证不等于授权，主体只能由承载层把"刚验证过凭据的那个 userId"
 * 显式传进来，绝不从被操作记录反推、更不读客户端可写的 body/query/header。
 */
export async function recordSecurityEvent(
  request: {
    ip: string
    headers: Record<string, string | string[] | undefined>
    userId?: string
  },
  action: string,
  metadata?: Record<string, unknown>,
  options?: { principalUserId?: string },
): Promise<void> {
  const userId = options?.principalUserId ?? request.userId
  if (!userId) return // 表上 user_id notNull：无主事件不写，不拿 null 去撞约束
  const rawUA = request.headers['user-agent']
  const userAgent = typeof rawUA === 'string' ? rawUA.slice(0, 512) : null
  try {
    await createSecurityLog({
      userId,
      action,
      ip: request.ip ?? null,
      userAgent,
      metadata: metadata ?? {},
    })
  } catch (e) {
    console.error('[security-logs] 写入失败（不影响本次请求）:', (e as Error).message)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
