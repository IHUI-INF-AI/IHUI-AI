import { eq, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { exportTasks, type ExportTask } from '@ihui/database'

/** 创建一个导出任务,初始 status=0(pending)。 */
export async function createExportTask(userId: string, type: string): Promise<ExportTask> {
  const rows = await db.insert(exportTasks).values({ userId, type }).returning()
  const row = rows[0]
  if (!row) throw new Error('创建导出任务失败')
  return row
}

/** 分页查询用户导出任务,按创建时间倒序。 */
export async function findExportTasks(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: ExportTask[]; total: number; page: number; pageSize: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(exportTasks)
      .where(eq(exportTasks.userId, userId))
      .orderBy(desc(exportTasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(exportTasks)
      .where(eq(exportTasks.userId, userId)),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}
