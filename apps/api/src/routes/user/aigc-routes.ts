/**
 * AIGC 任务管理 /ai/aigc/records + /ai/aigc/tasks/:taskId/cancel(4 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { aiAigcTasks } from '@ihui/database'
import { authenticate } from '../../plugins/auth.js'
import { updateAiAigcTaskStatus } from '../../db/ai-modules-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const aigcTaskCreateSchema = z.object({
  type: z.string().min(1).max(50),
  prompt: z.string().min(1).max(10000),
  model: z.string().max(100).optional(),
  params: z.record(z.unknown()).optional(),
})

const aigcTaskStatusToInt: Record<'pending' | 'running' | 'succeeded' | 'failed', number> = {
  pending: 0,
  running: 1,
  succeeded: 2,
  failed: 3,
}

const aigcTaskStatusMap: Record<number, 'pending' | 'running' | 'succeeded' | 'failed'> = {
  0: 'pending',
  1: 'running',
  2: 'succeeded',
  3: 'failed',
}

function safeParseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function formatAigcTaskLocal(row: typeof aiAigcTasks.$inferSelect) {
  return {
    taskId: row.id,
    type: row.type,
    status: aigcTaskStatusMap[row.status] ?? 'pending',
    result: row.output ? safeParseJsonSafe(row.output) : null,
    input: row.input ? safeParseJsonSafe(row.input) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.completedAt ? row.completedAt.toISOString() : row.createdAt.toISOString(),
  }
}

const taskIdParam = z.object({ taskId: z.string() })

const aigcRoutes: FastifyPluginAsync = async (server) => {
  server.post('/ai/aigc/records', async (request, reply) => {
    await authenticate(request)
    const parsed = aigcTaskCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const d = parsed.data
    const [row] = await db
      .insert(aiAigcTasks)
      .values({
        userId: request.userId!,
        type: d.type,
        status: aigcTaskStatusToInt.pending,
        input: JSON.stringify({ prompt: d.prompt, model: d.model, params: d.params ?? {} }),
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建 AIGC 任务失败'))
    return reply.send(success(formatAigcTaskLocal(row)))
  })

  server.get('/ai/aigc/records', async (request, reply) => {
    await authenticate(request)
    const q = parsePagination(request, reply)
    if (!q) return
    const offset = (q.page - 1) * q.pageSize
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(aiAigcTasks)
        .where(eq(aiAigcTasks.userId, request.userId!))
        .orderBy(sql`${aiAigcTasks.createdAt} DESC`)
        .limit(q.pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiAigcTasks)
        .where(eq(aiAigcTasks.userId, request.userId!)),
    ])
    return reply.send(
      success({
        list: rows.map(formatAigcTaskLocal),
        total: Number(totalRows[0]?.count ?? 0),
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  })

  server.get('/ai/aigc/records/:taskId', async (request, reply) => {
    await authenticate(request)
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await db.select().from(aiAigcTasks).where(eq(aiAigcTasks.id, id)).limit(1)
    if (!row) return reply.status(404).send(error(404, 'AIGC 任务不存在'))
    if (row.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    return reply.send(success(formatAigcTaskLocal(row)))
  })

  server.post('/ai/aigc/tasks/:taskId/cancel', async (request, reply) => {
    const taskId = taskIdParam.parse(request.params).taskId
    if (!taskId) return reply.status(400).send(error(400, '参数错误'))
    const task = await updateAiAigcTaskStatus(taskId, request.userId!, 3)
    if (!task) return reply.status(404).send(error(404, '任务不存在或不可取消'))
    return reply.send(success({ success: true, task }))
  })
}

export default aigcRoutes
