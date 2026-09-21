// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Task Messages API(D25 统一任务运行时看板)。
 *
 * 端点(挂载于 /api):
 *   GET  /task-messages?taskId=&limit=&offset= — 任务消息时间线(旧→新)
 *   POST /task-messages                       — 发消息(fromType=user,支持 @任务引用)
 *
 * 可见性对齐 kanban(P0-4):非本人团队的任务消息 → 404(不泄露存在性)。
 * @任务引用:POST 时应用层校验存在性;DB 不设 FK,读时宽容展示。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agentTasks, taskMessages } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { canViewTaskTeam } from './agents-kanban.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  taskId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const mentionSchema = z.object({
  type: z.literal('task'),
  taskId: z.uuid(),
  name: z.string().max(200).optional(),
})

const createMessageSchema = z.object({
  taskId: z.uuid(),
  content: z.string().min(1).max(8000),
  mentions: z.array(mentionSchema).max(20).default([]),
})

// ---------------------------------------------------------------------------
// 路由插件
// ---------------------------------------------------------------------------
export const taskMessagesRoutes: FastifyPluginAsync = async (server) => {
  // 插件级 preHandler:所有路由要求登录(等价 requireAuth)
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /task-messages — 任务消息时间线
  server.get('/task-messages', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { taskId, limit, offset } = parsed.data
    // 任务可见性对齐 kanban:非本人团队任务 → 404(不泄露存在性)
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, taskId)).limit(1)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (!(await canViewTaskTeam(request, task))) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    const rows = await db
      .select()
      .from(taskMessages)
      .where(eq(taskMessages.taskId, taskId))
      .orderBy(desc(taskMessages.createdAt), desc(taskMessages.id))
      .limit(limit)
      .offset(offset)
    // 时间线展示顺序:旧 → 新;hasMore 供前端继续分页
    const hasMore = rows.length === limit
    return reply.send(success({ taskId, messages: rows.reverse(), hasMore }))
  })

  // POST /task-messages — 发消息(fromType=user,支持 @任务引用)
  server.post('/task-messages', async (request, reply) => {
    const body = parseOrThrow(createMessageSchema, request.body)
    // 消息归属任务必须存在且可见
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, body.taskId)).limit(1)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (!(await canViewTaskTeam(request, task))) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    // @任务引用存在性校验(应用层;DB 不设 FK,读时宽容)
    if (body.mentions.length > 0) {
      const mentionIds = [...new Set(body.mentions.map((m) => m.taskId))]
      const found = await db
        .select({ id: agentTasks.id })
        .from(agentTasks)
        .where(inArray(agentTasks.id, mentionIds))
      if (found.length !== mentionIds.length) {
        return reply.status(400).send(error(400, '存在无效的 @任务引用'))
      }
    }
    const [row] = await db
      .insert(taskMessages)
      .values({
        taskId: body.taskId,
        fromType: 'user',
        fromId: request.userId ?? null,
        content: body.content,
        mentions: body.mentions,
        createdBy: request.userId ?? null,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '发送消息失败'))
    return reply.status(201).send(success(row))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
