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
