/**
 * Agent 任务管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/agent-task
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { agentTasks } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { withAuditBoth } from '../../utils/audit.js'
import { buildKanbanColumns } from '../agents-kanban.js'
import { idParamSchema } from './_shared.js'

const createAgentTaskSchema = z.object({
  agentId: z.string().uuid(),
  ruleId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
  priority: z.number().int().optional(),
  payload: z.record(z.unknown()).optional(),
  result: z.record(z.unknown()).optional(),
  scheduledAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  errorMessage: z.string().optional(),
})
const updateAgentTaskSchema = createAgentTaskSchema.partial()

export const agentTaskRoutes: FastifyPluginAsync = async (server) => {
  server.get('/admin/agent-task/kanban', { preHandler: requireAdmin }, async (_request, reply) => {
    const columns = await buildKanbanColumns()
    return reply.send(success(columns))
  })
  server.post('/admin/agent-task', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentTaskSchema, request.body)
    const [row] = await db
      .insert(agentTasks)
      .values(withAuditBoth({ ...body }, request.userId ?? null))
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateAgentTaskSchema, request.body)
    const [row] = await db
      .update(agentTasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(agentTasks.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success(row))
  })
  server.delete('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ id, deleted: true }))
  })
}
