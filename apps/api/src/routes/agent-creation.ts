import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { agents, zhsAgentCategory } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'

/**
 * 智能体创作核心接口(迁移自旧项目 aiModels.js)
 * 补齐 4 类端点:
 *   1. POST /api/agent/creation/my/:type  — 按类型查询我的创作
 *   2. GET  /api/cozeZhsApi/agent-category/agent/:id — 查询 agent 收费配置
 *   3. POST/PUT/DELETE /api/cozeZhsApi/agent-category — 收费配置 CRUD
 *   4. POST /api/cozeZhsApi/search/model/workflow/run — 模型工作流搜索
 *
 * 路由使用绝对路径注册(无 prefix),与旧前端 apiClient 路径直接对齐。
 */
const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // 1. POST /api/agent/creation/my/:type — 按类型查询我的创作
  //    旧 aiModels.js getMyCreation(data, type)
  //    type: 'agent' | 'workflow' | 'plugin'
  //    body: { userId?, page?, pageSize?, keyword? }
  // -------------------------------------------------------------------------
  const creationTypeParam = z.object({
    type: z.enum(['agent', 'workflow', 'plugin']),
  })
  const creationBody = z.object({
    userId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    keyword: z.string().optional(),
  })

  server.post(
    '/api/agent/creation/my/:type',
    { preHandler: requireAuth },
    async (req, reply) => {
      const paramParsed = creationTypeParam.safeParse(req.params)
      if (!paramParsed.success) {
        return reply.status(400).send(error(400, '无效的 type,允许:agent|workflow|plugin'))
      }
      const bodyParsed = creationBody.safeParse(req.body ?? {})
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { type, ...rest } = { type: paramParsed.data.type, ...bodyParsed.data }
      const userId = rest.userId ?? req.userId
      if (!userId) {
        return reply.status(401).send(error(401, '需要登录后查询'))
      }
      const page = rest.page
      const pageSize = rest.pageSize
      const offset = (page - 1) * pageSize

      try {
        if (type === 'agent') {
          const conditions: SQL[] = [eq(agents.userId, userId)]
          if (rest.keyword) {
            conditions.push(sql`${agents.name} ILIKE ${`%${rest.keyword}%`}`)
          }
          const where = sql.join(conditions, sql` AND `)
          const list = await db
            .select()
            .from(agents)
            .where(where)
            .orderBy(desc(agents.createdAt))
            .limit(pageSize)
            .offset(offset)
          const totalRows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(agents)
            .where(where)
          return reply.send(
            success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }),
          )
        }
        // workflow / plugin:当前无对应表,返回空列表
        // 缺表记录:.trae-cn/tmp/p0-4-db-needed.txt
        return reply.send(success({ list: [], total: 0, page, pageSize }))
      } catch (e) {
        req.log.error(e)
        return reply.status(500).send(error(500, '查询我的创作失败'))
      }
    },
  )

  // -------------------------------------------------------------------------
  // 2. GET /api/cozeZhsApi/agent-category/agent/:id — 查询某 agent 的收费配置
  //    旧 aiModels.js getChargeInfoById(id)
  //    id = agent_id
  // -------------------------------------------------------------------------
  const agentIdParam = z.object({ id: z.string().min(1) })

  server.get(
    '/api/cozeZhsApi/agent-category/agent/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = agentIdParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
      try {
        const rows = await db
          .select()
          .from(zhsAgentCategory)
          .where(eq(zhsAgentCategory.agentId, parsed.data.id))
          .limit(1)
        const row = rows[0]
        if (!row) return reply.status(404).send(error(404, '收费配置不存在'))
        // 映射旧契约字段名(agent_id / price / charge_type)
        return reply.send(
          success({
            ...row,
            agent_id: row.agentId,
            price: row.account ?? 0,
            charge_type: String(row.group ?? 0),
          }),
        )
      } catch (e) {
        req.log.error(e)
        return reply.status(500).send(error(500, '查询收费配置失败'))
      }
    },
  )

  // -------------------------------------------------------------------------
  // 3. 收费配置 CRUD
  //    POST   /api/cozeZhsApi/agent-category/create        — 创建
  //    PUT    /api/cozeZhsApi/agent-category/:agent_id     — 更新
  //    DELETE /api/cozeZhsApi/agent-category/:id           — 删除
  //    旧 aiModels.js createZntCharge / putZntCharge / deleteZntCharge
  // -------------------------------------------------------------------------

  // 创建收费配置
  const createChargeBody = z.object({
    agent_id: z.string().min(1),
    agent_name: z.string().optional(),
    create_uuid: z.string().optional(),
    create_name: z.string().optional(),
    agent_main_category: z.string().optional(),
    agent_category: z.string().optional(),
    price: z.coerce.number().optional(),
    charge_type: z.string().optional(),
    group: z.coerce.number().int().optional(),
    type: z.string().optional(),
    type_child: z.string().optional(),
    limit_free: z.string().optional(),
    prologue: z.string().optional(),
    discount_month: z.string().optional(),
  })

  server.post(
    '/api/cozeZhsApi/agent-category/create',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const bodyParsed = createChargeBody.safeParse(req.body ?? {})
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const b = bodyParsed.data
      try {
        const [row] = await db
          .insert(zhsAgentCategory)
          .values({
            agentId: b.agent_id,
            agentName: b.agent_name,
            createUuid: b.create_uuid,
            createName: b.create_name,
            agentMainCategory: b.agent_main_category,
            agentCategory: b.agent_category,
            account: b.price ?? 0,
            group: b.group ?? (b.charge_type ? Number(b.charge_type) : 2),
            type: b.type ?? '1',
            typeChild: b.type_child ?? '1',
            limitFree: b.limit_free,
            prologue: b.prologue,
            discountMonth: b.discount_month,
            createTime: new Date(),
          })
          .returning()
        return reply.status(201).send(success(row))
      } catch (e) {
        req.log.error(e)
        return reply.status(500).send(error(500, '创建收费配置失败'))
      }
    },
  )

  // 更新收费配置(按 agent_id)
  const updateChargeParam = z.object({ agent_id: z.string().min(1) })
  const updateChargeBody = z.object({
    agent_name: z.string().optional(),
    create_uuid: z.string().optional(),
    create_name: z.string().optional(),
    agent_main_category: z.string().optional(),
    agent_category: z.string().optional(),
    price: z.coerce.number().optional(),
    charge_type: z.string().optional(),
    group: z.coerce.number().int().optional(),
    type: z.string().optional(),
    type_child: z.string().optional(),
    limit_free: z.string().optional(),
    prologue: z.string().optional(),
    discount_month: z.string().optional(),
  })

  server.put(
    '/api/cozeZhsApi/agent-category/:agent_id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const paramParsed = updateChargeParam.safeParse(req.params)
      if (!paramParsed.success) {
        return reply.status(400).send(error(400, '无效的 agent_id'))
      }
      const bodyParsed = updateChargeBody.safeParse(req.body ?? {})
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const b = bodyParsed.data
      const sets: Record<string, unknown> = { updatedAt: new Date() }
      if (b.agent_name !== undefined) sets.agentName = b.agent_name
      if (b.create_uuid !== undefined) sets.createUuid = b.create_uuid
      if (b.create_name !== undefined) sets.createName = b.create_name
      if (b.agent_main_category !== undefined) sets.agentMainCategory = b.agent_main_category
      if (b.agent_category !== undefined) sets.agentCategory = b.agent_category
      if (b.price !== undefined) sets.account = b.price
      if (b.charge_type !== undefined) sets.group = Number(b.charge_type)
      if (b.group !== undefined) sets.group = b.group
      if (b.type !== undefined) sets.type = b.type
      if (b.type_child !== undefined) sets.typeChild = b.type_child
      if (b.limit_free !== undefined) sets.limitFree = b.limit_free
      if (b.prologue !== undefined) sets.prologue = b.prologue
      if (b.discount_month !== undefined) sets.discountMonth = b.discount_month

      try {
        const [row] = await db
          .update(zhsAgentCategory)
          .set(sets)
          .where(eq(zhsAgentCategory.agentId, paramParsed.data.agent_id))
          .returning()
        if (!row) return reply.status(404).send(error(404, '收费配置不存在'))
        return reply.send(success(row))
      } catch (e) {
        req.log.error(e)
        return reply.status(500).send(error(500, '更新收费配置失败'))
      }
    },
  )

  // 删除收费配置(按 id)
  const deleteChargeParam = z.object({ id: z.string().min(1) })

  server.delete(
    '/api/cozeZhsApi/agent-category/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const parsed = deleteChargeParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
      try {
        // 先确认存在(按 id 主键)
        const idNum = Number(parsed.data.id)
        if (Number.isNaN(idNum)) {
          return reply.status(400).send(error(400, 'ID 必须为数字'))
        }
        const existing = await db
          .select({ id: zhsAgentCategory.id })
          .from(zhsAgentCategory)
          .where(eq(zhsAgentCategory.id, idNum))
          .limit(1)
        if (!existing[0]) return reply.status(404).send(error(404, '收费配置不存在'))
        await db.delete(zhsAgentCategory).where(eq(zhsAgentCategory.id, idNum))
        return reply.send(success({ id: parsed.data.id, deleted: true }))
      } catch (e) {
        req.log.error(e)
        return reply.status(500).send(error(500, '删除收费配置失败'))
      }
    },
  )

  // -------------------------------------------------------------------------
  // 4. POST /api/cozeZhsApi/search/model/workflow/run — 模型工作流搜索
  //    旧 aiModels.js searchModelWorkflowRun(data)
  //    body: { query, model_id?, workflow_id? }
  //    当前无 workflow_run 表,返回空 results(记录到 db-needed.txt)
  // -------------------------------------------------------------------------
  const searchWorkflowBody = z.object({
    query: z.string().optional(),
    model_id: z.string().optional(),
    workflow_id: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  server.post(
    '/api/cozeZhsApi/search/model/workflow/run',
    { preHandler: requireAuth },
    async (req, reply) => {
      const bodyParsed = searchWorkflowBody.safeParse(req.body ?? {})
      if (!bodyParsed.success) {
        return reply
          .status(400)
          .send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 无 workflow_run 专表,返回空 results
      // 缺表记录:.trae-cn/tmp/p0-4-db-needed.txt
      return reply.send(
        success({
          results: [],
          total: 0,
          page: bodyParsed.data.page,
          pageSize: bodyParsed.data.pageSize,
          query: bodyParsed.data.query ?? '',
          modelId: bodyParsed.data.model_id,
          workflowId: bodyParsed.data.workflow_id,
        }),
      )
    },
  )
}

export default plugin
