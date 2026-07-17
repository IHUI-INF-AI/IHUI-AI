import { eq, and, desc, sql } from 'drizzle-orm'
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
    .where(eq(videoGenerationTasks.id, Number(id)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error(`视频任务 ${id} 不存在`)
  return row
}
