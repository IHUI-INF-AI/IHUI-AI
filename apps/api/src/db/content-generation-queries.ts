// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, sql } from 'drizzle-orm'
// O4b 数据闸接线(2026-09-20):`content_generation_tasks` 是用户自有数据,
// 读写一律走受控出口(唯一消费方 routes/other/v1-content-routes.ts 的能力为
// user:read = scoped-read,语句必须自带 user_id 归属谓词)。
// `content_generation_templates`(全站模板,status=1)无 owner 列且不是用户数据,
// 刻意保持原始出口 `db` —— 走受控出口会让该只读端点在 scoped 模式下恒 403。
import { db, dbScoped, dbReadScoped } from './index.js'
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
  const rows = await dbScoped
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
    dbReadScoped
      .select()
      .from(contentGenerationTasks)
      .where(eq(contentGenerationTasks.userId, userId))
      .orderBy(desc(contentGenerationTasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbReadScoped
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
