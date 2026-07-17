import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findAgentsList, findAgentById } from '../db/agents-queries.js'
import { findCategoryList } from '../db/agents-queries.js'
import { db } from '../db/index.js'
import { zhsUserAgentContext } from '@ihui/database'

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

export const agenticServiceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /zhsAgent/list - 智能体列表
  server.get('/zhsAgent/list', async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().optional().default(1),
        pageSize: z.coerce.number().optional().default(20),
        search: z.string().optional(),
      })
      .parse(request.query)
    const { list, total } = await findAgentsList({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.search,
    })
    return reply.send(success({ list, total }))
  })

  // GET /zhsAgent/:agentId - 智能体详情
  server.get('/zhsAgent/:agentId', async (request, reply) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.params)
    const agent = await findAgentById(agentId)
    if (!agent) return reply.status(404).send(error(404, 'Agent not found'))
    return reply.send(success(agent))
  })

  // GET /categories - 智能体分类
  server.get('/categories', async (_request, reply) => {
    const { list, total } = await findCategoryList({})
    return reply.send(success({ list, total }))
  })

  const fieldParamSchema = z.object({ field: z.string().min(1).max(200) })

  // GET /context/:field - 获取当前用户某个会话字段值（按 fieldName 查最新一条）
  server.get('/context/:field', async (request, reply) => {
    const parsed = fieldParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 field 参数'))
    const userUuid = request.userId
    if (!userUuid) return reply.status(401).send(error(401, 'Authentication required'))
    try {
      const rows = await db
        .select()
        .from(zhsUserAgentContext)
        .where(
          and(
            eq(zhsUserAgentContext.userUuid, userUuid),
            eq(zhsUserAgentContext.fieldName, parsed.data.field),
          ),
        )
        .orderBy(desc(zhsUserAgentContext.id))
        .limit(1)
      const row = rows[0]
      if (!row) return reply.status(404).send(error(404, '字段不存在'))
      return reply.send(
        success({ field: parsed.data.field, value: row.contextValue ?? row.content ?? null }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询会话字段失败'))
    }
  })

  // DELETE /context/:field - 删除当前用户某个会话字段的所有记录
  server.delete('/context/:field', async (request, reply) => {
    const parsed = fieldParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 field 参数'))
    const userUuid = request.userId
    if (!userUuid) return reply.status(401).send(error(401, 'Authentication required'))
    try {
      const deleted = await db
        .delete(zhsUserAgentContext)
        .where(
          and(
            eq(zhsUserAgentContext.userUuid, userUuid),
            eq(zhsUserAgentContext.fieldName, parsed.data.field),
          ),
        )
        .returning({ id: zhsUserAgentContext.id })
      return reply.send(success({ success: true, deleted: deleted.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除会话字段失败'))
    }
  })
}
