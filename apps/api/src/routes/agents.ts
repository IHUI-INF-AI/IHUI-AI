import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID, randomBytes } from 'crypto'
import { eq, and, desc, sql } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import { zhsAgentBuy, agentSettlements, zhsAgentNeedTask } from '@ihui/database'
import {
  getAgentDetail,
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
} from '../services/agent-service.js'
import {
  findCategoryList,
  findCategoryById,
  findCategoriesByIds,
  findCategoryByAgentId,
  createCategory,
  updateCategory,
  deleteCategory,
  findSettlementList,
  findSettlementSummary,
  findSettlementByOrder,
  createSettlement,
  settleSettlement,
  deleteSettlements,
  findExamineList,
  findExamineStats,
  findExamineById,
  createExamine,
  updateExamine,
  deleteExamine,
  approveExamine,
  rejectExamine,
  type UpdateAgentInput,
  type UpdateCategoryInput,
  type CreateSettlementInput,
  type UpdateExamineInput,
} from '../db/agents-queries.js'
import { listOAuthApps, findAuditLogList, findAuditLogStats } from '../db/oauth-queries.js'
import {
  findOAuthAppByClientId,
  createOAuthApp,
  updateOAuthApp,
  deleteOAuthApp,
  regenerateOAuthAppSecret,
  listActiveScopeMeta,
} from '../db/oauth-queries.js'

// =============================================================================
// 鉴权辅助
// =============================================================================

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

function toInt(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? undefined : n
}

// =============================================================================
// Zod schemas（M-63 补建端点）
// =============================================================================

const createOAuthAppSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).optional(),
  redirectUris: z.array(z.string().url()).min(1).max(20),
  scopes: z.array(z.string().max(64)).optional(),
  icon: z.string().max(512).optional(),
})

const updateOAuthAppSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  redirectUris: z.array(z.string().url()).min(1).max(20).optional(),
  scopes: z.array(z.string().max(64)).optional(),
  icon: z.string().max(512).optional(),
  isActive: z.number().int().min(0).max(1).optional(),
})

const updateSettlementSchema = z.object({
  status: z.string().max(20).optional(),
  commissionRate: z.number().min(0).optional(),
  commissionAmount: z.number().int().min(0).optional(),
})

const createNeedTaskSchema = z.object({
  agentId: z.string().max(64).default(''),
  taskName: z.string().trim().min(1).max(128),
  taskDesc: z.string().max(5000).optional(),
  rewardTokens: z.number().int().min(0).default(0),
  deadline: z.string().datetime().optional(),
})

const updateNeedTaskSchema = z.object({
  taskName: z.string().trim().min(1).max(128).optional(),
  taskDesc: z.string().max(5000).optional(),
  rewardTokens: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
  deadline: z.string().datetime().optional(),
  acceptUserId: z.string().max(64).optional(),
})

// =============================================================================
// 代理管理路由（挂载于 /api）
// 包含：agents CRUD / categories 分类 / settlement 结算 / examine 审核 / oauth-apps
// =============================================================================

export const agentsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // -------------------------------------------------------------------------
  // agents CRUD
  // -------------------------------------------------------------------------

  // GET /agents/list - 代理列表
  server.get('/agents/list', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      status?: string
      categoryId?: string
      userId?: string
      keyword?: string
    }
    const result = await listAgents({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      status: q.status,
      categoryId: q.categoryId,
      userId: q.userId,
      keyword: q.keyword,
    })
    return reply.send(success(result))
  })

  // GET /agents/:agentId - 代理详情
  server.get('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const detail = await getAgentDetail(agentId)
    if (!detail) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success(detail.agent))
  })

  // POST /agents/create - 创建代理
  server.post('/agents/create', async (request, reply) => {
    const body = request.body as {
      name?: string
      description?: string | null
      avatar?: string | null
      cover?: string | null
      categoryId?: string | null
      workspaceId?: string | null
      status?: string
      price?: number
      isFree?: boolean
      sort?: number
      remark?: string | null
    }
    if (!body?.name) return reply.status(400).send(error(400, 'name 为必填项'))
    const agent = await createAgent({
      name: body.name,
      description: body.description,
      avatar: body.avatar,
      cover: body.cover,
      categoryId: body.categoryId,
      userId: request.userId,
      workspaceId: body.workspaceId,
      status: body.status,
      price: body.price,
      isFree: body.isFree,
      sort: body.sort,
      remark: body.remark,
    })
    return reply.send(success(agent))
  })

  // PUT /agents/:agentId - 更新代理
  server.put('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const body = request.body as UpdateAgentInput
    const agent = await updateAgent(agentId, body)
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success(agent))
  })

  // DELETE /agents/:agentId - 删除代理
  server.delete('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const agent = await deleteAgent(agentId)
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success({ deleted: true }))
  })

  // -------------------------------------------------------------------------
  // categories 代理分类
  // -------------------------------------------------------------------------

  // GET /categories/list - 分类列表
  server.get('/categories/list', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      status?: string
      isPaid?: string
      keyword?: string
    }
    const result = await findCategoryList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      status: q.status,
      isPaid: q.isPaid !== undefined ? q.isPaid === 'true' : undefined,
      keyword: q.keyword,
    })
    return reply.send(success(result))
  })

  // POST /categories/create - 创建分类
  server.post('/categories/create', async (request, reply) => {
    const body = request.body as {
      name?: string
      description?: string | null
      icon?: string | null
      sort?: number
      status?: string
      isPaid?: boolean
    }
    if (!body?.name) return reply.status(400).send(error(400, 'name 为必填项'))
    const category = await createCategory({
      name: body.name,
      description: body.description,
      icon: body.icon,
      sort: body.sort,
      status: body.status,
      isPaid: body.isPaid,
    })
    return reply.send(success(category))
  })

  // POST /categories/batch-query - 批量查询
  server.post('/categories/batch-query', async (request, reply) => {
    const body = request.body as { ids?: string[] }
    const ids = body?.ids ?? []
    const list = await findCategoriesByIds(ids)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /categories/ids/:idList - 按 ID 列表查询
  server.get('/categories/ids/:idList', async (request, reply) => {
    const { idList } = request.params as { idList: string }
    const ids = idList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const list = await findCategoriesByIds(ids)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /categories/stats/summary - 分类统计
  server.get('/categories/stats/summary', async (_request, reply) => {
    const { list } = await findCategoryList({ page: 1, pageSize: 1000 })
    const summary = {
      total: list.length,
      enabled: list.filter((c) => c.status === '1').length,
      paid: list.filter((c) => c.isPaid).length,
    }
    return reply.send(success(summary))
  })

  // GET /categories/agent/:agentId - 按智能体 ID 查分类
  server.get('/categories/agent/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const category = await findCategoryByAgentId(agentId)
    const list = category ? [category] : []
    return reply.send(success({ list, total: list.length }))
  })

  // GET /categories/:categoryId - 分类详情
  server.get('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const category = await findCategoryById(categoryId)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // PUT /categories/:categoryId - 更新分类
  server.put('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const body = request.body as UpdateCategoryInput
    const category = await updateCategory(categoryId, body)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // DELETE /categories/:categoryId - 删除分类
  server.delete('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const category = await deleteCategory(categoryId)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success({ deleted: true }))
  })

  // POST /categories/:categoryId/enable - 启用付费
  server.post('/categories/:categoryId/enable', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const category = await updateCategory(categoryId, { isPaid: true })
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // POST /categories/:categoryId/disable - 禁用付费
  server.post('/categories/:categoryId/disable', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string }
    const category = await updateCategory(categoryId, { isPaid: false })
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // -------------------------------------------------------------------------
  // settlement 结算
  // -------------------------------------------------------------------------

  // GET /settlement/list - 结算列表
  server.get('/settlement/list', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      agentId?: string
      status?: string
      orderNo?: string
    }
    const result = await findSettlementList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      status: q.status,
      orderNo: q.orderNo,
    })
    return reply.send(success(result))
  })

  // GET /settlement/summary - 结算汇总
  server.get('/settlement/summary', async (_request, reply) => {
    const summary = await findSettlementSummary()
    return reply.send(success(summary))
  })

  // POST /settlement/settle - 触发结算
  server.post('/settlement/settle', async (request, reply) => {
    const body = request.body as { id?: string }
    if (!body?.id) return reply.status(400).send(error(400, 'id 为必填项'))
    const record = await settleSettlement(body.id)
    if (!record) return reply.status(404).send(error(404, '结算记录不存在'))
    return reply.send(success(record))
  })

  // GET /settlement/unsettled - 未结算记录
  server.get('/settlement/unsettled', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      agentId?: string
    }
    const result = await findSettlementList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      status: 'unsettled',
    })
    return reply.send(success(result))
  })

  // GET /settlement/cache/info - 缓存信息
  server.get('/settlement/cache/info', async (request, reply) => {
    const redis = request.server.redis
    const key = 'settlement:summary'
    const exists = await redis.exists(key)
    const ttl = exists ? await redis.ttl(key) : -2
    return reply.send(
      success({
        cached: exists === 1,
        ttlSeconds: ttl,
        key,
      }),
    )
  })

  // POST /settlement/cache/force-check - 强制检查缓存
  server.post('/settlement/cache/force-check', async (request, reply) => {
    const redis = request.server.redis
    const key = 'settlement:summary'
    const exists = await redis.exists(key)
    return reply.send(success({ cached: exists === 1, checked: true }))
  })

  // POST /settlement/cache/force-refresh - 强制刷新缓存
  server.post('/settlement/cache/force-refresh', async (request, reply) => {
    const redis = request.server.redis
    const summary = await findSettlementSummary()
    const key = 'settlement:summary'
    await redis.set(key, JSON.stringify(summary), 'EX', 300)
    return reply.send(success({ refreshed: true, summary }))
  })

  // POST /settlement/create - 创建结算记录
  server.post('/settlement/create', async (request, reply) => {
    const body = request.body as CreateSettlementInput
    const record = await createSettlement(body)
    return reply.send(success(record))
  })

  // POST /settlement/sync-existing - 批量同步购买记录到结算表
  server.post('/settlement/sync-existing', async (_request, reply) => {
    const activeBuys = await dbRead
      .select({ id: zhsAgentBuy.id, agentId: zhsAgentBuy.agentId, price: zhsAgentBuy.price })
      .from(zhsAgentBuy)
      .where(eq(zhsAgentBuy.status, 'active'))

    const existing = await dbRead
      .select({ buyRecordId: agentSettlements.buyRecordId })
      .from(agentSettlements)
      .where(sql`${agentSettlements.buyRecordId} IS NOT NULL`)

    const existingIds = new Set(existing.map((s) => s.buyRecordId))
    const missing = activeBuys.filter((b) => !existingIds.has(b.id))

    if (missing.length === 0) {
      return reply.send(success({ synced: 0 }))
    }

    await db.insert(agentSettlements).values(
      missing.map((b) => ({
        agentId: b.agentId,
        buyRecordId: b.id,
        amount: Math.round(parseFloat(b.price) * 100),
        status: 'unsettled',
      })),
    )
    return reply.send(success({ synced: missing.length }))
  })

  // POST /settlement/sync-single/:buyRecordId - 同步单条购买记录到结算表
  server.post('/settlement/sync-single/:buyRecordId', async (request, reply) => {
    const { buyRecordId } = request.params as { buyRecordId: string }

    const already = await dbRead
      .select({ id: agentSettlements.id })
      .from(agentSettlements)
      .where(eq(agentSettlements.buyRecordId, buyRecordId))
      .limit(1)
    if (already.length > 0) {
      return reply.send(success({ synced: false, message: '结算记录已存在' }))
    }

    const buyRecord = await dbRead
      .select()
      .from(zhsAgentBuy)
      .where(eq(zhsAgentBuy.id, buyRecordId))
      .limit(1)
    if (!buyRecord[0]) {
      return reply.status(404).send(error(404, '购买记录不存在'))
    }

    await db.insert(agentSettlements).values({
      agentId: buyRecord[0].agentId,
      buyRecordId: buyRecord[0].id,
      amount: Math.round(parseFloat(buyRecord[0].price) * 100),
      status: 'unsettled',
    })
    return reply.send(success({ synced: true }))
  })

  // POST /settlement/batch-delete - 批量删除
  server.post('/settlement/batch-delete', async (request, reply) => {
    const body = request.body as { ids?: string[] }
    const ids = body?.ids ?? []
    const deleted = await deleteSettlements(ids)
    return reply.send(success({ deleted }))
  })

  // GET /settlement/order/:orderNo/summary - 订单结算汇总
  server.get('/settlement/order/:orderNo/summary', async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string }
    const summary = await findSettlementByOrder(orderNo)
    return reply.send(success(summary))
  })

  // GET /settlement/stats/income-overview - 收入概览
  server.get('/settlement/stats/income-overview', async (_request, reply) => {
    const summary = await findSettlementSummary()
    return reply.send(success(summary))
  })

  // -------------------------------------------------------------------------
  // examine 审核
  // -------------------------------------------------------------------------

  // GET /examine/list - 审核列表
  server.get('/examine/list', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      agentId?: string
      userId?: string
      status?: string
    }
    const result = await findExamineList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      userId: q.userId,
      status: q.status,
    })
    return reply.send(success(result))
  })

  // GET /examine/stats/summary - 审核统计
  server.get('/examine/stats/summary', async (_request, reply) => {
    const stats = await findExamineStats()
    return reply.send(success(stats))
  })

  // POST /examine/submit - 提交审核
  server.post('/examine/submit', async (request, reply) => {
    const body = request.body as {
      agentId?: string
      reason?: string | null
      status?: string
    }
    if (!body?.agentId) return reply.status(400).send(error(400, 'agentId 为必填项'))
    const record = await createExamine({
      agentId: body.agentId,
      userId: request.userId,
      status: body.status ?? 'pending',
      reason: body.reason,
    })
    return reply.send(success(record))
  })

  // GET /examine/:recordId - 审核详情
  server.get('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const record = await findExamineById(recordId)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // PUT /examine/:recordId - 更新审核记录
  server.put('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const body = request.body as UpdateExamineInput
    const record = await updateExamine(recordId, body)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // DELETE /examine/:recordId - 删除审核记录
  server.delete('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const record = await deleteExamine(recordId)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success({ deleted: true }))
  })

  // PUT /examine/:recordId/approve - 批准
  server.put('/examine/:recordId/approve', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const record = await approveExamine(recordId, request.userId!)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // PUT /examine/:recordId/reject - 拒绝
  server.put('/examine/:recordId/reject', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const body = request.body as { reason?: string }
    if (!body?.reason) return reply.status(400).send(error(400, 'reason 为必填项'))
    const record = await rejectExamine(recordId, request.userId!, body.reason)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // -------------------------------------------------------------------------
  // oauth-apps OAuth 应用
  // -------------------------------------------------------------------------

  // GET /oauth-apps/list - OAuth 应用列表
  server.get('/oauth-apps/list', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string }
    const page = toInt(q.page) ?? 1
    const limit = toInt(q.limit) ?? 20
    const result = await listOAuthApps(request.userId!, page, limit)
    return reply.send(success({ list: result.items, total: result.total }))
  })

  // GET /oauth-apps/audit-logs/stats - 聚合统计
  server.get('/oauth-apps/audit-logs/stats', async (_request, reply) => {
    const stats = await findAuditLogStats()
    return reply.send(success(stats))
  })

  // GET /oauth-apps/audit-logs/export - CSV 导出
  server.get('/oauth-apps/audit-logs/export', async (_request, reply) => {
    const { items } = await findAuditLogList({ page: 1, limit: 10000 })
    const headers = ['id', 'event', 'clientId', 'userId', 'ip', 'status', 'detail', 'createdAt']
    const escapeCsv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const rows = items.map((item) =>
      [
        item.id,
        item.event,
        item.clientId ?? '',
        item.userId ?? '',
        item.ip ?? '',
        item.status ?? '',
        item.detail ?? '',
        item.createdAt.toISOString(),
      ]
        .map((v) => escapeCsv(String(v)))
        .join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="oauth-audit-logs-${Date.now()}.csv"`)
    return reply.send(csv)
  })

  // GET /oauth-apps/audit-logs - 审计日志查询
  server.get('/oauth-apps/audit-logs', async (request, reply) => {
    const q = request.query as {
      page?: string
      limit?: string
      clientId?: string
      event?: string
      status?: string
    }
    const { items, total } = await findAuditLogList({
      page: toInt(q.page) ?? 1,
      limit: toInt(q.limit) ?? 20,
      clientId: q.clientId,
      event: q.event,
      status: q.status,
    })
    return reply.send(success({ list: items, total }))
  })

  // -------------------------------------------------------------------------
  // oauth-apps CRUD（M-63 补建）
  // -------------------------------------------------------------------------

  // GET /oauth-apps/scopes - 可用 scope 列表
  server.get('/oauth-apps/scopes', async (_request, reply) => {
    const list = await listActiveScopeMeta()
    return reply.send(success({ list }))
  })

  // GET /oauth-apps/:clientId - OAuth 应用详情
  server.get('/oauth-apps/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const app = await findOAuthAppByClientId(clientId)
    if (!app) return reply.status(404).send(error(404, 'OAuth 应用不存在'))
    if (app.ownerUuid !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权查看此应用'))
    }
    return reply.send(success(app))
  })

  // POST /oauth-apps - 创建 OAuth 应用
  server.post('/oauth-apps', async (request, reply) => {
    const parsed = createOAuthAppSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const clientId = randomUUID().replace(/-/g, '')
    const clientSecret = randomBytes(32).toString('hex')
    const app = await createOAuthApp({
      clientId,
      clientSecret,
      name: parsed.data.name,
      description: parsed.data.description,
      redirectUris: parsed.data.redirectUris,
      scopes: parsed.data.scopes,
      icon: parsed.data.icon,
      ownerUuid: request.userId!,
    })
    return reply.status(201).send(success(app))
  })

  // PUT /oauth-apps/:clientId - 更新 OAuth 应用
  server.put('/oauth-apps/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const parsed = updateOAuthAppSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findOAuthAppByClientId(clientId)
    if (!existing) return reply.status(404).send(error(404, 'OAuth 应用不存在'))
    if (existing.ownerUuid !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权修改此应用'))
    }
    const app = await updateOAuthApp(clientId, existing.ownerUuid!, parsed.data)
    return reply.send(success(app))
  })

  // DELETE /oauth-apps/:clientId - 删除 OAuth 应用
  server.delete('/oauth-apps/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const existing = await findOAuthAppByClientId(clientId)
    if (!existing) return reply.status(404).send(error(404, 'OAuth 应用不存在'))
    if (existing.ownerUuid !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权删除此应用'))
    }
    await deleteOAuthApp(clientId, existing.ownerUuid!)
    return reply.send(success({ clientId, deleted: true }))
  })

  // POST /oauth-apps/:clientId/regenerate-secret - 重新生成密钥
  server.post('/oauth-apps/:clientId/regenerate-secret', async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const existing = await findOAuthAppByClientId(clientId)
    if (!existing) return reply.status(404).send(error(404, 'OAuth 应用不存在'))
    if (existing.ownerUuid !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权操作此应用'))
    }
    const newSecret = randomBytes(32).toString('hex')
    const app = await regenerateOAuthAppSecret(clientId, existing.ownerUuid!, newSecret)
    return reply.send(success(app))
  })

  // -------------------------------------------------------------------------
  // settlement 补建（M-63）
  // -------------------------------------------------------------------------

  // GET /settlement/:id - 结算详情
  server.get('/settlement/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rows = await dbRead
      .select()
      .from(agentSettlements)
      .where(eq(agentSettlements.id, id))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '结算记录不存在'))
    return reply.send(success(rows[0]))
  })

  // PUT /settlement/:id - 更新结算记录
  server.put('/settlement/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateSettlementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .update(agentSettlements)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(agentSettlements.id, id))
      .returning()
    if (!rows[0]) return reply.status(404).send(error(404, '结算记录不存在'))
    return reply.send(success(rows[0]))
  })

  // -------------------------------------------------------------------------
  // agent need task 需求任务（M-63 补建）
  // -------------------------------------------------------------------------

  // GET /agents/need-tasks - 需求任务列表
  server.get('/agents/need-tasks', async (request, reply) => {
    const q = request.query as {
      page?: string
      pageSize?: string
      agentId?: string
      status?: string
    }
    const page = toInt(q.page) ?? 1
    const pageSize = toInt(q.pageSize) ?? 20
    const conds = []
    if (q.agentId) conds.push(eq(zhsAgentNeedTask.agentId, q.agentId))
    if (q.status !== undefined) {
      const statusNum = toInt(q.status)
      if (statusNum !== undefined) conds.push(eq(zhsAgentNeedTask.status, statusNum))
    }
    const where = conds.length ? and(...conds) : undefined
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsAgentNeedTask)
        .where(where)
        .orderBy(desc(zhsAgentNeedTask.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsAgentNeedTask)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /agents/need-tasks/:id - 需求任务详情
  server.get('/agents/need-tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rows = await dbRead
      .select()
      .from(zhsAgentNeedTask)
      .where(eq(zhsAgentNeedTask.id, parseInt(id, 10)))
      .limit(1)
    if (!rows[0]) return reply.status(404).send(error(404, '需求任务不存在'))
    return reply.send(success(rows[0]))
  })

  // POST /agents/need-tasks - 创建需求任务
  server.post('/agents/need-tasks', async (request, reply) => {
    const parsed = createNeedTaskSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const rows = await db
      .insert(zhsAgentNeedTask)
      .values({
        userId: request.userId!,
        agentId: parsed.data.agentId,
        taskName: parsed.data.taskName,
        taskDesc: parsed.data.taskDesc,
        rewardTokens: parsed.data.rewardTokens,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      })
      .returning()
    return reply.status(201).send(success(rows[0]))
  })

  // PUT /agents/need-tasks/:id - 更新需求任务
  server.put('/agents/need-tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateNeedTaskSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.taskName !== undefined) updateData.taskName = parsed.data.taskName
    if (parsed.data.taskDesc !== undefined) updateData.taskDesc = parsed.data.taskDesc
    if (parsed.data.rewardTokens !== undefined) updateData.rewardTokens = parsed.data.rewardTokens
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.acceptUserId !== undefined) updateData.acceptUserId = parsed.data.acceptUserId
    if (parsed.data.deadline !== undefined) {
      updateData.deadline = new Date(parsed.data.deadline)
    }
    const rows = await db
      .update(zhsAgentNeedTask)
      .set(updateData)
      .where(eq(zhsAgentNeedTask.id, parseInt(id, 10)))
      .returning()
    if (!rows[0]) return reply.status(404).send(error(404, '需求任务不存在'))
    return reply.send(success(rows[0]))
  })

  // DELETE /agents/need-tasks/:id - 删除需求任务
  server.delete('/agents/need-tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const rows = await db
      .delete(zhsAgentNeedTask)
      .where(eq(zhsAgentNeedTask.id, parseInt(id, 10)))
      .returning()
    if (!rows[0]) return reply.status(404).send(error(404, '需求任务不存在'))
    return reply.send(success({ id, deleted: true }))
  })
}
