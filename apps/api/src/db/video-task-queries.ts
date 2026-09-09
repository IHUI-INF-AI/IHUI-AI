// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, sql, notInArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  videoGenerationTasks,
  type VideoGenerationTask,
  type NewVideoGenerationTask,
} from '@ihui/database'

export async function createVideoTask(input: NewVideoGenerationTask): Promise<VideoGenerationTask> {
  const rows = await db.insert(videoGenerationTasks).values(input).returning()
  const row = rows[0]
  if (!row) throw new Error('创建视频任务失败')
  return row
}

export async function findVideoTasksByUser(
  userUuid: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: VideoGenerationTask[]; total: number }> {
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(videoGenerationTasks)
      .where(eq(videoGenerationTasks.userUuid, userUuid))
      .orderBy(desc(videoGenerationTasks.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(videoGenerationTasks)
      .where(eq(videoGenerationTasks.userUuid, userUuid)),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findVideoTaskById(
  id: string,
  userUuid: string,
): Promise<VideoGenerationTask | null> {
  const rows = await db
    .select()
    .from(videoGenerationTasks)
    .where(
      and(eq(videoGenerationTasks.id, Number(id)), eq(videoGenerationTasks.userUuid, userUuid)),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function updateVideoTask(
  id: string,
  patch: { status?: string; message?: string; result?: string },
): Promise<VideoGenerationTask> {
  const rows = await db
    .update(videoGenerationTasks)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.message !== undefined && { message: patch.message }),
      ...(patch.result !== undefined && { result: patch.result }),
      updatedAt: new Date(),
    })
    // 2026-09-09 P2 竞态修复:终态(success/failed)不可被回写(如并发详情同步用
    // running 覆盖已 success 的终态)。当前调用方均有 scoped read 前置,但条件
    // 收紧到 SQL 层,未来任何新调用点也不会意外翻转终态。无行命中时抛错,由
    // 调用方 try/catch 降级为 warning 返回。
    .where(
      and(
        eq(videoGenerationTasks.id, Number(id)),
        notInArray(videoGenerationTasks.status, ['success', 'failed']),
      ),
    )
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`视频任务 ${id} 不存在或已终态`)
  return row
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
