/**
 * Agent 规则管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/agent-rule
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { agentRule } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const createAgentRuleSchema = z.object({
  agentId: z.string().min(1),
  ruleName: z.string().min(1),
  ruleCode: z.string().min(1),
  ruleType: z.string().max(32).optional(),
  priority: z.number().int().optional(),
  status: z.number().int().optional(),
  description: z.string().max(255).optional(),
})
const updateAgentRuleSchema = createAgentRuleSchema.partial()

export const agentRuleRoutes: FastifyPluginAsync = async (server) => {
  server.post('/admin/agent-rule', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentRuleSchema, request.body)
    const [row] = await db.insert(agentRule).values(body).returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/agent-rule/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateAgentRuleSchema, request.body)
    const [row] = await db
      .update(agentRule)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(agentRule.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(row))
  })
  server.delete('/admin/agent-rule/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    await db.delete(agentRule).where(eq(agentRule.id, id))
    return reply.send(success({ id, deleted: true }))
  })
}
