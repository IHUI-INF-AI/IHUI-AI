import { eq, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  contentGenerationTasks,
  contentGenerationTemplates,
  type ContentGenerationTask,
  type ContentGenerationTemplate,
} from '@ihui/database'

/** 创建一条内容生成任务,初始 status=0(pending)。 */
export async function createGenerationTask(
  userId: string,
  input: string | null,
  templateId?: string | null,
): Promise<ContentGenerationTask> {
  const rows = await db
    .insert(contentGenerationTasks)
    .values({ userId, input, templateId: templateId ?? null })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建内容生成任务失败')
  return row
}

/** 分页查询用户内容生成历史,按创建时间倒序。 */
export async function findGenerationHistory(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: ContentGenerationTask[]; total: number; page: number; pageSize: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(contentGenerationTasks)
      .where(eq(contentGenerationTasks.userId, userId))
      .orderBy(desc(contentGenerationTasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentGenerationTasks)
      .where(eq(contentGenerationTasks.userId, userId)),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 查询所有启用的内容生成模板(status=1),按创建时间倒序。 */
export async function findGenerationTemplates(): Promise<ContentGenerationTemplate[]> {
  return db
    .select()
    .from(contentGenerationTemplates)
    .where(eq(contentGenerationTemplates.status, 1))
    .orderBy(desc(contentGenerationTemplates.createdAt))
}
