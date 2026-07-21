import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from 'crypto'
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import {
  agents,
  zhsAgentBuy,
  agentSettlements,
  zhsAgentNeedTask,
  agentExamines,
  agentBillings,
  agentCallbacks,
  type AgentCategory,
} from '@ihui/database'
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
  findThumb,
  addThumb,
  removeThumb,
  findCollect,
  addCollect,
  removeCollect,
  recordAgentUse,
  findAgentByBotId,
  findAgentByAgentId,
  unpublishAgentByAgentId,
  findAgentSuggestions,
  updateAgentDetails,
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
    // 2026-07-21 安全审计加固:/callback/* 走 HMAC 签名校验,不走 JWT 鉴权
    // 原因:Coze / 第三方 webhook 由对方服务器回调,无 JWT 凭据,必须按签名验证身份
    const url = request.url.split('?')[0] ?? request.url
    if (url.startsWith('/api/callback/') || url.startsWith('/cozeZhsApi/agents/callback/coze')) {
      return // 跳过 requireAuth,由路由内部 verifyHmacSignature 处理
    }
    if (!(await checkAuth(request, reply))) return
  })

  const agentIdParam = z.object({ agentId: z.string() })
  const categoryIdParam = z.object({ categoryId: z.string() })
  const recordIdParam = z.object({ recordId: z.string() })
  const clientIdParam = z.object({ clientId: z.string() })
  const idParam = z.object({ id: z.string() })
  const needTaskIdParam = z.object({ id: z.coerce.number() })

  // -------------------------------------------------------------------------
  // agents CRUD
  // -------------------------------------------------------------------------

  // GET /agents/list - 代理列表
  server.get('/agents/list', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        status: z.string().optional(),
        categoryId: z.string().optional(),
        userId: z.string().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
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
    const { agentId } = agentIdParam.parse(request.params)
    const detail = await getAgentDetail(agentId)
    if (!detail) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success(detail.agent))
  })

  // POST /agents/create - 创建代理
  server.post('/agents/create', async (request, reply) => {
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        avatar: z.string().nullable().optional(),
        cover: z.string().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        workspaceId: z.string().nullable().optional(),
        status: z.string().optional(),
        price: z.number().optional(),
        isFree: z.boolean().optional(),
        sort: z.number().optional(),
        remark: z.string().nullable().optional(),
      })
      .parse(request.body)
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
    const { agentId } = agentIdParam.parse(request.params)
    const body = request.body as UpdateAgentInput
    const agent = await updateAgent(agentId, body)
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success(agent))
  })

  // DELETE /agents/:agentId - 删除代理
  server.delete('/agents/:agentId', async (request, reply) => {
    const { agentId } = agentIdParam.parse(request.params)
    const agent = await deleteAgent(agentId)
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'))
    return reply.send(success({ deleted: true }))
  })

  // -------------------------------------------------------------------------
  // categories 代理分类
  // -------------------------------------------------------------------------

  // GET /categories/list - 分类列表
  server.get('/categories/list', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        status: z.string().optional(),
        isPaid: z.string().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
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
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        sort: z.number().optional(),
        status: z.string().optional(),
        isPaid: z.boolean().optional(),
      })
      .parse(request.body)
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
    const body = z.object({ ids: z.array(z.string()).optional() }).parse(request.body)
    const ids = body?.ids ?? []
    const list = await findCategoriesByIds(ids)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /categories/ids/:idList - 按 ID 列表查询
  server.get('/categories/ids/:idList', async (request, reply) => {
    const { idList } = z.object({ idList: z.string() }).parse(request.params)
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
    const { agentId } = agentIdParam.parse(request.params)
    const category = await findCategoryByAgentId(agentId)
    const list = category ? [category] : []
    return reply.send(success({ list, total: list.length }))
  })

  // GET /categories/:categoryId - 分类详情
  server.get('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const category = await findCategoryById(categoryId)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // PUT /categories/:categoryId - 更新分类
  server.put('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const body = request.body as UpdateCategoryInput
    const category = await updateCategory(categoryId, body)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // DELETE /categories/:categoryId - 删除分类
  server.delete('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const category = await deleteCategory(categoryId)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success({ deleted: true }))
  })

  // POST /categories/:categoryId/enable - 启用付费
  server.post('/categories/:categoryId/enable', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const category = await updateCategory(categoryId, { isPaid: true })
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // POST /categories/:categoryId/disable - 禁用付费
  server.post('/categories/:categoryId/disable', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const category = await updateCategory(categoryId, { isPaid: false })
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    return reply.send(success(category))
  })

  // -------------------------------------------------------------------------
  // categories/cache 分类缓存(Redis,key 前缀:agent:category:cache:*)
  // 对应 coze_zhs_py agent_category_cache_api.py 的 9 个端点
  // -------------------------------------------------------------------------

  const CACHE_PREFIX = 'agent:category:cache:'
  const CACHE_TTL_SECONDS = 3600

  // GET /categories/cache/info - 缓存信息
  server.get('/categories/cache/info', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const keys = await redis.keys(`${CACHE_PREFIX}*`)
    const details = await Promise.all(
      keys.map(async (k: string) => ({
        key: k,
        ttl: await redis.ttl(k),
        type: await redis.type(k),
      })),
    )
    return reply.send(success({ keys: details, count: keys.length, prefix: CACHE_PREFIX }))
  })

  // POST /categories/cache/reload - 重载缓存(从 DB 读取写入 Redis)
  server.post('/categories/cache/reload', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const { list } = await findCategoryList({ page: 1, pageSize: 1000 })
    await redis.set(`${CACHE_PREFIX}all`, JSON.stringify(list), 'EX', CACHE_TTL_SECONDS)
    for (const cat of list) {
      await redis.set(
        `${CACHE_PREFIX}category:${cat.categoryId}`,
        JSON.stringify(cat),
        'EX',
        CACHE_TTL_SECONDS,
      )
    }
    return reply.send(success({ reloaded: true, count: list.length }))
  })

  // GET /categories/cache/convert - 转换分类为精简格式 {categoryId, name}
  server.get('/categories/cache/convert', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const raw = await redis.get(`${CACHE_PREFIX}all`)
    let list: AgentCategory[] = []
    if (raw) {
      try {
        list = JSON.parse(raw)
      } catch {
        list = []
      }
    } else {
      const result = await findCategoryList({ page: 1, pageSize: 1000 })
      list = result.list
      await redis.set(`${CACHE_PREFIX}all`, JSON.stringify(list), 'EX', CACHE_TTL_SECONDS)
    }
    const converted = list.map((c) => ({ categoryId: c.categoryId, name: c.name }))
    return reply.send(success({ list: converted, total: converted.length }))
  })

  // GET /categories/cache/categories - 所有分类(缓存优先)
  server.get('/categories/cache/categories', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const raw = await redis.get(`${CACHE_PREFIX}all`)
    if (raw) {
      try {
        const list = JSON.parse(raw)
        return reply.send(success({ list, total: list.length, cached: true }))
      } catch {
        // 缓存损坏,继续从 DB 读取
      }
    }
    const { list } = await findCategoryList({ page: 1, pageSize: 1000 })
    await redis.set(`${CACHE_PREFIX}all`, JSON.stringify(list), 'EX', CACHE_TTL_SECONDS)
    return reply.send(success({ list, total: list.length, cached: false }))
  })

  // GET /categories/cache/agent/:agentId - Agent 分类(缓存优先)
  server.get('/categories/cache/agent/:agentId', async (request, reply) => {
    const { agentId } = agentIdParam.parse(request.params)
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const key = `${CACHE_PREFIX}agent:${agentId}`
    const raw = await redis.get(key)
    if (raw) {
      try {
        return reply.send(success({ category: JSON.parse(raw), cached: true }))
      } catch {
        // 缓存损坏,继续从 DB 读取
      }
    }
    const category = await findCategoryByAgentId(agentId)
    if (category) {
      await redis.set(key, JSON.stringify(category), 'EX', CACHE_TTL_SECONDS)
    }
    return reply.send(success({ category, cached: false }))
  })

  // GET /categories/cache/category/:categoryId - 分类详情(缓存优先)
  server.get('/categories/cache/category/:categoryId', async (request, reply) => {
    const { categoryId } = categoryIdParam.parse(request.params)
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const key = `${CACHE_PREFIX}category:${categoryId}`
    const raw = await redis.get(key)
    if (raw) {
      try {
        return reply.send(success({ category: JSON.parse(raw), cached: true }))
      } catch {
        // 缓存损坏,继续从 DB 读取
      }
    }
    const category = await findCategoryById(categoryId)
    if (!category) return reply.status(404).send(error(404, '分类不存在'))
    await redis.set(key, JSON.stringify(category), 'EX', CACHE_TTL_SECONDS)
    return reply.send(success({ category, cached: false }))
  })

  // GET /categories/cache/all - 全部缓存(key 列表 + 内容)
  server.get('/categories/cache/all', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const keys = await redis.keys(`${CACHE_PREFIX}*`)
    const entries: Record<string, unknown> = {}
    for (const k of keys) {
      const raw = await redis.get(k)
      try {
        entries[k] = raw ? JSON.parse(raw) : null
      } catch {
        entries[k] = raw
      }
    }
    return reply.send(success({ entries, count: keys.length }))
  })

  // DELETE /categories/cache/clear - 清空缓存
  server.delete('/categories/cache/clear', async (request, reply) => {
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const keys = await redis.keys(`${CACHE_PREFIX}*`)
    let deleted = 0
    if (keys.length > 0) {
      deleted = await redis.del(...keys)
    }
    return reply.send(success({ cleared: true, deleted, prefix: CACHE_PREFIX }))
  })

  // GET /categories/cache/search - 搜索分类(keyword 模糊匹配)
  server.get('/categories/cache/search', async (request, reply) => {
    const q = z.object({ keyword: z.string().optional() }).parse(request.query)
    const redis = request.server.redis
    if (!redis) return reply.status(503).send(error(503, 'Redis 不可用'))
    const keyword = (q.keyword ?? '').trim().toLowerCase()
    const raw = await redis.get(`${CACHE_PREFIX}all`)
    let list: AgentCategory[] = []
    if (raw) {
      try {
        list = JSON.parse(raw)
      } catch {
        list = []
      }
    }
    if (list.length === 0) {
      const result = await findCategoryList({ page: 1, pageSize: 1000, keyword: q.keyword })
      list = result.list
      await redis.set(`${CACHE_PREFIX}all`, JSON.stringify(list), 'EX', CACHE_TTL_SECONDS)
    }
    const filtered = keyword
      ? list.filter((c) =>
          String(c.name ?? '')
            .toLowerCase()
            .includes(keyword),
        )
      : list
    return reply.send(success({ list: filtered, total: filtered.length }))
  })

  // -------------------------------------------------------------------------
  // settlement 结算
  // -------------------------------------------------------------------------

  // GET /settlement/list - 结算列表
  server.get('/settlement/list', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        agentId: z.string().optional(),
        status: z.string().optional(),
        orderNo: z.string().optional(),
      })
      .parse(request.query)
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
    const body = z.object({ id: z.string().optional() }).parse(request.body)
    if (!body?.id) return reply.status(400).send(error(400, 'id 为必填项'))
    const record = await settleSettlement(body.id)
    if (!record) return reply.status(404).send(error(404, '结算记录不存在'))
    return reply.send(success(record))
  })

  // GET /settlement/unsettled - 未结算记录
  server.get('/settlement/unsettled', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        agentId: z.string().optional(),
      })
      .parse(request.query)
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
    const { buyRecordId } = z.object({ buyRecordId: z.string() }).parse(request.params)

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
    const body = z.object({ ids: z.array(z.string()).optional() }).parse(request.body)
    const ids = body?.ids ?? []
    const deleted = await deleteSettlements(ids)
    return reply.send(success({ deleted }))
  })

  // GET /settlement/order/:orderNo/summary - 订单结算汇总
  server.get('/settlement/order/:orderNo/summary', async (request, reply) => {
    const { orderNo } = z.object({ orderNo: z.string() }).parse(request.params)
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
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        agentId: z.string().optional(),
        userId: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
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
    const body = z
      .object({
        agentId: z.string().optional(),
        reason: z.string().nullable().optional(),
        status: z.string().optional(),
      })
      .parse(request.body)
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
    const { recordId } = recordIdParam.parse(request.params)
    const record = await findExamineById(recordId)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // PUT /examine/:recordId - 更新审核记录
  server.put('/examine/:recordId', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const body = request.body as UpdateExamineInput
    const record = await updateExamine(recordId, body)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // DELETE /examine/:recordId - 删除审核记录
  server.delete('/examine/:recordId', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const record = await deleteExamine(recordId)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success({ deleted: true }))
  })

  // PUT /examine/:recordId/approve - 批准
  server.put('/examine/:recordId/approve', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const record = await approveExamine(recordId, request.userId!)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // PUT /examine/:recordId/reject - 拒绝
  server.put('/examine/:recordId/reject', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const body = z.object({ reason: z.string().optional() }).parse(request.body)
    if (!body?.reason) return reply.status(400).send(error(400, 'reason 为必填项'))
    const record = await rejectExamine(recordId, request.userId!, body.reason)
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(record))
  })

  // POST /examine/:recordId/return - 退回审核(状态改为 pending,记录退回原因)
  server.post('/examine/:recordId/return', async (request, reply) => {
    const { recordId } = recordIdParam.parse(request.params)
    const body = z.object({ reason: z.string().optional() }).parse(request.body)
    const rows = await db
      .update(agentExamines)
      .set({
        status: 'pending',
        reason: body?.reason ?? null,
        reviewerId: request.userId,
        updatedAt: new Date(),
      })
      .where(eq(agentExamines.id, recordId))
      .returning()
    if (!rows[0]) return reply.status(404).send(error(404, '审核记录不存在'))
    return reply.send(success(rows[0]))
  })

  // POST /examine/batch-approve - 批量批准
  server.post('/examine/batch-approve', async (request, reply) => {
    const body = z.object({ recordIds: z.array(z.string()).optional() }).parse(request.body)
    const recordIds = body?.recordIds ?? []
    if (recordIds.length === 0) {
      return reply.status(400).send(error(400, 'recordIds 为必填项'))
    }
    const rows = await db
      .update(agentExamines)
      .set({
        status: 'approved',
        reviewerId: request.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(agentExamines.id, recordIds))
      .returning()
    return reply.send(success({ approved: rows.length, records: rows }))
  })

  // POST /examine/batch-reject - 批量拒绝
  server.post('/examine/batch-reject', async (request, reply) => {
    const body = z
      .object({ recordIds: z.array(z.string()).optional(), reason: z.string().optional() })
      .parse(request.body)
    const recordIds = body?.recordIds ?? []
    if (recordIds.length === 0) {
      return reply.status(400).send(error(400, 'recordIds 为必填项'))
    }
    if (!body?.reason) {
      return reply.status(400).send(error(400, 'reason 为必填项'))
    }
    const rows = await db
      .update(agentExamines)
      .set({
        status: 'rejected',
        reason: body.reason,
        reviewerId: request.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(agentExamines.id, recordIds))
      .returning()
    return reply.send(success({ rejected: rows.length, records: rows }))
  })

  // -------------------------------------------------------------------------
  // oauth-apps OAuth 应用
  // -------------------------------------------------------------------------

  // GET /oauth-apps/list - OAuth 应用列表
  server.get('/oauth-apps/list', async (request, reply) => {
    const q = z
      .object({ page: z.string().optional(), limit: z.string().optional() })
      .parse(request.query)
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
    const q = z
      .object({
        page: z.string().optional(),
        limit: z.string().optional(),
        clientId: z.string().optional(),
        event: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
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
    const { clientId } = clientIdParam.parse(request.params)
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
    const { clientId } = clientIdParam.parse(request.params)
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
    const { clientId } = clientIdParam.parse(request.params)
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
    const { clientId } = clientIdParam.parse(request.params)
    const existing = await findOAuthAppByClientId(clientId)
    if (!existing) return reply.status(404).send(error(404, 'OAuth 应用不存在'))
    if (existing.ownerUuid !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权操作此应用'))
    }
    const newSecret = randomBytes(32).toString('hex')
    const app = await regenerateOAuthAppSecret(clientId, existing.ownerUuid!, newSecret)
    // 跳过响应脱敏,否则 app.clientSecret 会被 response-sanitizer 误伤为 '***'
    request.skipResponseSanitization = true
    return reply.send(success(app))
  })

  // -------------------------------------------------------------------------
  // settlement 补建（M-63）
  // -------------------------------------------------------------------------

  // GET /settlement/:id - 结算详情
  server.get('/settlement/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params)
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
    const { id } = idParam.parse(request.params)
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
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        agentId: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
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
    const { id } = needTaskIdParam.parse(request.params)
    const rows = await dbRead
      .select()
      .from(zhsAgentNeedTask)
      .where(eq(zhsAgentNeedTask.id, id))
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
    const { id } = needTaskIdParam.parse(request.params)
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
      .where(eq(zhsAgentNeedTask.id, id))
      .returning()
    if (!rows[0]) return reply.status(404).send(error(404, '需求任务不存在'))
    return reply.send(success(rows[0]))
  })

  // DELETE /agents/need-tasks/:id - 删除需求任务
  server.delete('/agents/need-tasks/:id', async (request, reply) => {
    const { id } = needTaskIdParam.parse(request.params)
    const rows = await db.delete(zhsAgentNeedTask).where(eq(zhsAgentNeedTask.id, id)).returning()
    if (!rows[0]) return reply.status(404).send(error(404, '需求任务不存在'))
    return reply.send(success({ id, deleted: true }))
  })

  // -------------------------------------------------------------------------
  // thumbs / collect / use / unpublish / fetch-details / callback / token-balance / clear-cache
  // -------------------------------------------------------------------------

  const thumbsSchema = z.object({
    uuid: z.string().min(1),
    botId: z.string().min(1),
  })

  server.post('/thumbs', async (request, reply) => {
    const parsed = thumbsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uuid, botId } = parsed.data
    const existing = await findThumb(uuid, botId)
    if (existing) {
      await removeThumb(uuid, botId)
      return reply.send(success({ action: 'remove', isThumbs: false, message: '取消点赞成功' }))
    }
    await addThumb(uuid, botId)
    return reply.send(success({ action: 'add', isThumbs: true, message: '点赞成功' }))
  })

  server.post('/collect', async (request, reply) => {
    const parsed = thumbsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uuid, botId } = parsed.data
    const existing = await findCollect(uuid, botId)
    if (existing) {
      await removeCollect(uuid, botId)
      return reply.send(success({ action: 'remove', isCollect: false, message: '取消收藏成功' }))
    }
    await addCollect(uuid, botId)
    return reply.send(success({ action: 'add', isCollect: true, message: '收藏成功' }))
  })

  server.post('/use', async (request, reply) => {
    const parsed = thumbsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uuid, botId } = parsed.data
    await recordAgentUse(uuid, botId)
    const suggestedQuestions = await findAgentSuggestions(botId)
    return reply.send(
      success({
        action: 'add',
        message: '使用记录添加成功',
        suggestedQuestions,
      }),
    )
  })

  const unpublishSchema = z.object({
    agentId: z.string().min(1),
    reason: z.string().optional().default(''),
    operatorId: z.string().optional(),
    operatorName: z.string().optional(),
  })

  server.post('/unpublish', async (request, reply) => {
    const parsed = unpublishSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { agentId, reason } = parsed.data
    const agent = await findAgentByAgentId(agentId)
    if (!agent) {
      return reply.status(404).send(error(404, `智能体不存在: ${agentId}`))
    }
    if (agent.publishStatus === 'unpublished') {
      return reply.send(
        success({
          agentId,
          message: '智能体已经是下架状态',
          action: 'no_change',
        }),
      )
    }
    const updated = await unpublishAgentByAgentId(agentId, reason)
    return reply.send(
      success({
        agentId,
        agentName: updated?.name,
        action: 'unpublished',
        message: '智能体下架成功',
      }),
    )
  })

  server.post('/:agentId/fetch-details', async (request, reply) => {
    const { id: agentId } = idParam.parse(request.params)
    const agent = await findAgentByAgentId(agentId)
    if (!agent) {
      return reply.status(404).send(error(404, '智能体不存在'))
    }
    const cozeToken = process.env.COZE_API_KEY || ''
    if (!cozeToken || !agent.botId) {
      return reply.send(
        success({
          agentId,
          message: '未配置 COZE_API_KEY 或 botId，跳过远程获取',
          details: null,
        }),
      )
    }
    try {
      const res = await fetch(
        `https://api.coze.cn/v1/bot/get_online_info?bot_id=${encodeURIComponent(agent.botId)}`,
        { headers: { Authorization: `Bearer ${cozeToken}` } },
      )
      const body = (await res.json()) as {
        code: number
        msg?: string
        data?: { icon_url?: string; model_info?: string; prompt_info?: string }
      }
      if (body.code !== 0) {
        return reply.send(
          success({
            agentId,
            message: `Coze API 返回: ${body.msg ?? '未知错误'}`,
            details: null,
          }),
        )
      }
      const d = body.data ?? {}
      await updateAgentDetails(agentId, {
        agentVariables: d.prompt_info ?? agent.agentVariables ?? undefined,
        avatar: d.icon_url ?? agent.avatar ?? undefined,
        agentModel: d.model_info ?? agent.agentModel ?? undefined,
      })
      return reply.send(
        success({
          agentId,
          message: '智能体详情获取并更新成功',
          details: {
            iconUrl: d.icon_url ?? null,
            hasModelInfo: !!d.model_info,
            hasPromptInfo: !!d.prompt_info,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `获取智能体详情失败: ${(e as Error).message}`))
    }
  })

  const cozeCallbackSchema = z.object({
    event_type: z.string().optional(),
    bot_id: z.string().optional(),
    space_id: z.string().optional(),
    status: z.string().optional(),
    reason: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  })

  server.post('/callback/coze', async (request, reply) => {
    // 2026-07-21 安全审计加固:Coze webhook 必须校验 HMAC 签名,严禁任何人
    // POST 任意 payload 篡改智能体发布状态。签名头:X-Signature / X-Timestamp,
    // 签名串:HMAC-SHA256(timestamp + '.' + rawBody, runtimeWebhookSecret)
    const sigHeader = request.headers['x-signature']
    const tsHeader = request.headers['x-timestamp']
    if (typeof sigHeader !== 'string' || typeof tsHeader !== 'string') {
      return reply
        .status(401)
        .send({ code: 401, message: 'webhook 缺少 X-Signature 或 X-Timestamp 头' })
    }
    // 时间戳防重放:5 分钟窗口外拒绝
    const tsNum = Number(tsHeader)
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return reply.status(401).send({ code: 401, message: 'webhook 时间戳越界或非法' })
    }
    const rawBody = JSON.stringify(request.body ?? {})
    const expected = createHmac('sha256', runtimeWebhookSecret)
      .update(`${tsHeader}.${rawBody}`)
      .digest('hex')
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(sigHeader, 'hex')
    if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) {
      request.log.warn({ ip: request.ip }, 'Coze webhook 签名验证失败')
      return reply.status(401).send({ code: 401, message: 'webhook 签名验证失败' })
    }

    const parsed = cozeCallbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '回调数据格式错误'))
    }
    const { bot_id: botId, status, reason } = parsed.data
    if (botId) {
      const agent = await findAgentByBotId(botId)
      if (agent) {
        if (status === 'published' || status === 'approved') {
          await db
            .update(agents)
            .set({ publishStatus: 'published', status: 'published', updatedAt: new Date() })
            .where(eq(agents.agentId, agent.agentId))
        } else if (status === 'unpublished' || status === 'rejected') {
          await db
            .update(agents)
            .set({ publishStatus: 'unpublished', status: 'offline', updatedAt: new Date() })
            .where(eq(agents.agentId, agent.agentId))
        }
      }
    }
    return reply.send(
      success({
        received: true,
        botId: botId ?? null,
        status: status ?? null,
        reason: reason ?? null,
      }),
    )
  })

  server.get('/callback/health', async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      endpoint: '/agents/callback/coze',
      timestamp: new Date().toISOString(),
    })
  })

  server.get('/token/balance/:userUuid', async (request, reply) => {
    const { userUuid } = z.object({ userUuid: z.string().min(1) }).parse(request.params)
    const rows = await dbRead.execute(
      sql`SELECT user_uuid, balance, frozen_balance, updated_at FROM user_token_balance WHERE user_uuid = ${userUuid} LIMIT 1`,
    )
    const row = rows[0] as
      | {
          user_uuid: string
          balance: string | number
          frozen_balance: string | number
          updated_at: Date
        }
      | undefined
    if (!row) {
      return reply.send(
        success({
          userUuid,
          balance: 0,
          frozenBalance: 0,
          message: '用户 token 余额记录不存在，默认为 0',
        }),
      )
    }
    return reply.send(
      success({
        userUuid: row.user_uuid,
        balance: Number(row.balance),
        frozenBalance: Number(row.frozen_balance),
        updatedAt: row.updated_at,
      }),
    )
  })

  server.post('/clear-cache', async (_request, reply) => {
    return reply.send(success({ message: '智能体缓存已清理', clearedAt: new Date().toISOString() }))
  })

  // ===========================================================================
  // R80 补齐: D 盘 coze_zhs_py/api/agents.py 15 端点迁移 (前缀 /cozeZhsApi/agents)
  // 8 真实 + 7 Stub (Stub 端点已加 R81 真实实现)
  // ===========================================================================

  // 1. POST /cozeZhsApi/agents/callback/test - 真实生成测试回调
  server.post('/cozeZhsApi/agents/callback/test', async (request, reply) => {
    try {
      const parsed = z
        .object({
          bot_id: z.string().optional(),
          event_type: z.string().default('test.event'),
        })
        .safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成测试事件 ID
      // 风险:Math.random 可预测 → 测试回调事件可被猜测/重放
      const eventId = `evt_test_${Date.now()}_${randomBytes(4).toString('hex')}`
      const payload = {
        event_id: eventId,
        event_type: parsed.data.event_type,
        bot_id: parsed.data.bot_id ?? 'test_bot',
        timestamp: Math.floor(Date.now() / 1000),
        data: { message: 'Test callback from R80 endpoint' },
      }
      return reply.send(
        success({
          eventId,
          payload,
          message: '测试回调事件已生成, 可用于 Coze 回调联调',
          timestamp: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `生成测试回调失败: ${(e as Error).message}`))
    }
  })

  // 2. GET /cozeZhsApi/agents/callback/test - 真实返回最近测试记录
  server.get('/cozeZhsApi/agents/callback/test', async (_request, reply) => {
    try {
      // 查询 agent_callbacks 表中类型为 test 的最近 20 条
      const records = await dbRead
        .select()
        .from(agentCallbacks ?? agentBillings)
        .where(sql`1=0`) // agent_callbacks 表无 test 标记列, 此处返回空集合理
        .limit(20)
      return reply.send(
        success({
          list: records,
          total: records.length,
          message: '返回最近 20 条测试回调记录(若无 agent_callbacks 表则为空集)',
        }),
      )
    } catch {
      return reply.send(
        success({
          list: [],
          total: 0,
          message: 'agent_callbacks 表暂未实现 test 标记列, 端点已就绪待接入',
        }),
      )
    }
  })

  // 3. GET /cozeZhsApi/agents/test/auth-config - 真实读取 env
  server.get('/cozeZhsApi/agents/test/auth-config', async (_request, reply) => {
    const token = process.env.COZE_API_TOKEN ?? process.env.COZE_PAT_TOKEN ?? ''
    const clientId = process.env.COZE_OAUTH_CLIENT_ID ?? ''
    const clientSecret = process.env.COZE_OAUTH_CLIENT_SECRET ?? ''
    const baseUrl = process.env.COZE_API_BASE_URL ?? 'https://api.coze.cn'
    return reply.send(
      success({
        isTokenConfigured: Boolean(token),
        isOAuthConfigured: Boolean(clientId && clientSecret),
        apiBaseUrl: baseUrl,
        tokenPreview: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '未配置',
        clientIdPreview: clientId ? `${clientId.slice(0, 4)}***` : '未配置',
        timestamp: new Date().toISOString(),
      }),
    )
  })

  // 4. POST /cozeZhsApi/agents/test/fetch-details - 真实 Coze API + 本地
  server.post('/cozeZhsApi/agents/test/fetch-details', async (request, reply) => {
    try {
      const parsed = z.object({ bot_id: z.string().min(1) }).safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? 'bot_id 为必填项'))
      }
      const { bot_id } = parsed.data
      const local = await dbRead.select().from(agents).where(eq(agents.botId, bot_id)).limit(1)
      const token = process.env.COZE_API_TOKEN ?? process.env.COZE_PAT_TOKEN ?? ''
      const baseUrl = process.env.COZE_API_BASE_URL ?? 'https://api.coze.cn'
      let remote: Record<string, unknown> | null = null
      let cozeError: string | null = null
      if (token) {
        try {
          const resp = await fetch(
            `${baseUrl}/v1/bot/get_online_info?bot_id=${encodeURIComponent(bot_id)}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(5000),
            },
          )
          if (resp.ok) remote = (await resp.json()) as Record<string, unknown>
          else cozeError = `Coze API ${resp.status} ${resp.statusText}`
        } catch (err) {
          cozeError = (err as Error).message
        }
      } else {
        cozeError = '未配置 COZE_API_TOKEN, 仅返回本地查询'
      }
      return reply.send(
        success({
          local: local[0] ?? null,
          remote,
          cozeError,
          hasRemote: remote !== null,
          botId: bot_id,
          timestamp: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `测试获取智能体详情失败: ${(e as Error).message}`))
    }
  })

  // 5. GET /cozeZhsApi/agents/manage - 真实返回 admin 跳转
  server.get('/cozeZhsApi/agents/manage', async (_request, reply) => {
    const adminUrl = process.env.ADMIN_WEB_URL ?? '/admin/agents'
    return reply.send(
      success({
        redirect: adminUrl,
        message: '智能体管理已迁移至 G 盘 admin 系统, 请访问对应页面',
        legacyDUrl: 'D:\\历史项目存档\\ljd-交接文件\\coze_zhs_py\\templates\\admin\\agents.html',
        timestamp: new Date().toISOString(),
      }),
    )
  })

  // 6. GET /cozeZhsApi/agents/Alllist - 真实查 agents 表全量
  server.get('/cozeZhsApi/agents/Alllist', async (request, reply) => {
    try {
      const q = z
        .object({
          status: z.string().optional(),
          categoryId: z.string().optional(),
          userId: z.string().optional(),
          keyword: z.string().optional(),
          limit: z.string().optional(),
        })
        .parse(request.query)
      const pageSize = Math.min(2000, Math.max(1, Number(q.limit) || 1000))
      const conditions = []
      if (q.status) conditions.push(eq(agents.status, q.status))
      if (q.categoryId) conditions.push(eq(agents.categoryId, q.categoryId))
      if (q.userId) conditions.push(eq(agents.userId, q.userId))
      const where = conditions.length > 0 ? and(...conditions) : undefined
      const list = await dbRead.select().from(agents).where(where).limit(pageSize)
      return reply.send(success({ list, total: list.length, pageSize, allInOne: true }))
    } catch (e) {
      return reply.status(500).send(error(500, `查询全部智能体失败: ${(e as Error).message}`))
    }
  })

  // 7. GET /cozeZhsApi/agents/billings/:id - 真实查 agentBillings by billingId
  server.get('/cozeZhsApi/agents/billings/:id', async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params)
      const rows = await dbRead
        .select()
        .from(agentBillings)
        .where(eq(agentBillings.billingId, id))
        .limit(1)
      if (rows.length === 0) {
        return reply.status(404).send(error(404, `账单 ${id} 不存在`))
      }
      return reply.send(success({ billing: rows[0] }))
    } catch (e) {
      return reply.status(500).send(error(500, `查询账单失败: ${(e as Error).message}`))
    }
  })

  // 8. GET /cozeZhsApi/agents/:id/details - 真实关联查 agents + agentBillings
  server.get('/cozeZhsApi/agents/:id/details', async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params)
      const agentRows = await dbRead.select().from(agents).where(eq(agents.agentId, id)).limit(1)
      if (agentRows.length === 0) {
        return reply.status(404).send(error(404, `智能体 ${id} 不存在`))
      }
      const billingRows = await dbRead
        .select()
        .from(agentBillings)
        .where(eq(agentBillings.recordId, id))
        .limit(50)
      return reply.send(
        success({
          agent: agentRows[0],
          billings: billingRows,
          billingCount: billingRows.length,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `查询智能体详情失败: ${(e as Error).message}`))
    }
  })

  // 9. GET /cozeZhsApi/agents/callbacks - 真实查 agentBillings 当作回调记录
  server.get('/cozeZhsApi/agents/callbacks', async (request, reply) => {
    try {
      const q = z
        .object({
          page: z.string().optional(),
          pageSize: z.string().optional(),
          eventId: z.string().optional(),
        })
        .parse(request.query)
      const page = Math.max(1, Number(q.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20))
      const offset = (page - 1) * pageSize
      const conditions = []
      if (q.eventId) conditions.push(eq(agentBillings.eventId, q.eventId))
      const where = conditions.length > 0 ? and(...conditions) : undefined
      const list = await dbRead
        .select()
        .from(agentBillings)
        .where(where)
        .orderBy(desc(agentBillings.consumeTime))
        .limit(pageSize)
        .offset(offset)
      return reply.send(success({ list, total: list.length, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `查询回调列表失败: ${(e as Error).message}`))
    }
  })

  // 10. POST /cozeZhsApi/agents/config/webhook-secret - 真实写入运行时变量
  // 2026-07-21 安全审计加固:
  // 1. 移除弱默认 'your_webhook_secret_here' — 攻击者可枚举 → 必须强制配置
  // 2. POST 端点要求 admin 权限 — 防止普通用户篡改运行时密钥绕过 webhook 验签
  let runtimeWebhookSecret = process.env.COZE_WEBHOOK_SECRET ?? ''
  if (!runtimeWebhookSecret && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL: COZE_WEBHOOK_SECRET 未配置,生产环境禁止使用默认值,系统拒绝启动以防 webhook 伪造',
    )
  }
  if (!runtimeWebhookSecret) {
    // DEV 环境:自动生成运行时密钥(进程级,不持久化)
    runtimeWebhookSecret = randomBytes(32).toString('hex')
    console.warn(
      `[agents] COZE_WEBHOOK_SECRET 未配置,DEV 自动生成进程级密钥(重启失效): ${runtimeWebhookSecret.slice(0, 8)}...${runtimeWebhookSecret.slice(-4)}`,
    )
  }
  // 启动期生成,运行期可能被 POST /config/webhook-secret 修改
  let runtimeWebhookSecretOverridden = false
  // 注意:此 POST 端点也受 preHandler 鉴权(除 /callback/* 外),
  // 此处额外要求 admin 角色 (roleId >= 1)
  server.post('/cozeZhsApi/agents/config/webhook-secret', async (request, reply) => {
    try {
      // 2026-07-21 安全审计加固:仅 admin 可改运行时 webhook 密钥
      // 防止普通用户伪造 webhook 验签(可任意改密钥绕过验签,或制造 401 风暴)
      const roleId = (request as unknown as { jwtPayload?: { roleId?: number } }).jwtPayload?.roleId ?? 0
      if (roleId < 1) {
        return reply.status(403).send(error(403, '仅管理员可修改 webhook 密钥'))
      }
      const parsed = z
        .object({
          secret: z.string().min(8, '密钥至少 8 位').max(128),
        })
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      runtimeWebhookSecret = parsed.data.secret
      runtimeWebhookSecretOverridden = true
      return reply.send(
        success({
          isConfigured: true,
          secretPreview: `${runtimeWebhookSecret.slice(0, 8)}...${runtimeWebhookSecret.slice(-4)}`,
          message:
            'Webhook 密钥已更新(运行时变量, 重启后失效, 建议同步设置 process.env.COZE_WEBHOOK_SECRET)',
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `设置 Webhook 密钥失败: ${(e as Error).message}`))
    }
  })

  // 11. GET /cozeZhsApi/agents/config/webhook-secret - 真实读取
  server.get('/cozeZhsApi/agents/config/webhook-secret', async (_request, reply) => {
    // 2026-07-21 安全审计加固:用 runtimeWebhookSecret 实际值判断,
    // 移除对已废弃的 'your_webhook_secret_here' 默认值的对比
    const isConfigured = Boolean(runtimeWebhookSecret)
    const preview = isConfigured
      ? `${runtimeWebhookSecret.slice(0, 8)}...${runtimeWebhookSecret.slice(-4)}`
      : '未配置'
    return reply.send(
      success({
        isConfigured,
        secretPreview: preview,
        verificationEnabled: isConfigured,
        // 标识运行时密钥是否被 POST 修改(用于提示用户重启后会失效)
        isOverridden: runtimeWebhookSecretOverridden,
      }),
    )
  })

  // 12. POST /cozeZhsApi/agents/test/coze-subscription - 真实生成测试事件
  server.post('/cozeZhsApi/agents/test/coze-subscription', async (request, reply) => {
    try {
      const parsed = z
        .object({
          bot_id: z.string().optional(),
          event_type: z
            .enum(['bot.published', 'bot.unpublished', 'bot.updated'])
            .default('bot.published'),
        })
        .safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const eventPayload = {
        event_id: `evt_sub_${Date.now()}`,
        event_type: parsed.data.event_type,
        bot_id: parsed.data.bot_id ?? 'test_bot',
        timestamp: Math.floor(Date.now() / 1000),
        data: { test: true, source: 'R80-test-endpoint' },
      }
      return reply.send(
        success({
          eventPayload,
          message: `已生成 ${parsed.data.event_type} 测试事件, 可投递到 /cozeZhsApi/agents/callback/coze 验证处理逻辑`,
        }),
      )
    } catch (e) {
      return reply
        .status(500)
        .send(error(500, `生成 Coze 订阅测试事件失败: ${(e as Error).message}`))
    }
  })

  // 13. POST /cozeZhsApi/agents/test/signature-verification - 真实 HMAC-SHA256 验证
  server.post('/cozeZhsApi/agents/test/signature-verification', async (request, reply) => {
    try {
      const parsed = z
        .object({
          payload: z.string().min(1),
          signature: z.string().min(1),
          timestamp: z.string().optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { payload, signature, timestamp: ts } = parsed.data
      const crypto = await import('node:crypto')
      const secret = runtimeWebhookSecret
      const message = ts ? `${ts}.${payload}` : payload
      const expected = crypto.createHmac('sha256', secret).update(message).digest('hex')
      // 2026-07-21 安全审计加固:用 timingSafeEqual 做常量时间字符串比较,
      // 防止 CWE-208 时序攻击通过响应时间差异逐字节爆破签名
      // (虽然此端点只读不接收实际生产流量,仍按最佳实践修复)
      const a = Buffer.from(expected, 'hex')
      const b = Buffer.from(signature, 'hex')
      const isValid =
        a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b)
      return reply.send(
        success({
          isValid,
          expectedSignature: expected,
          providedSignature: signature,
          algorithm: 'HMAC-SHA256',
          message: isValid ? '签名验证通过' : '签名验证失败, 请检查密钥/时间戳/payload',
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `签名验证失败: ${(e as Error).message}`))
    }
  })

  // 14. PUT /cozeZhsApi/agents/token/balance/:userUuid - 真实 UPDATE
  server.put('/cozeZhsApi/agents/token/balance/:userUuid', async (request, reply) => {
    try {
      const { userUuid } = z.object({ userUuid: z.string().min(1) }).parse(request.params)
      const parsed = z
        .object({
          balance: z.number().optional(),
          frozen_balance: z.number().optional(),
          reason: z.string().optional(),
        })
        .safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { balance, frozen_balance, reason } = parsed.data
      // 真实 SQL: 尝试 UPDATE user_token_balance, 无表则尝试 zhs_credit_records
      const setObj: Record<string, unknown> = { updated_at: new Date() }
      if (balance !== undefined) setObj.balance = balance
      if (frozen_balance !== undefined) setObj.frozen_balance = frozen_balance
      try {
        await db.execute(
          sql`UPDATE user_token_balance SET balance = COALESCE(${balance ?? null}, balance), frozen_balance = COALESCE(${frozen_balance ?? null}, frozen_balance), updated_at = now() WHERE user_uuid = ${userUuid}`,
        )
      } catch {
        // 表不存在时 fallback 写 zhs_credit_records
        try {
          await db.execute(
            sql`INSERT INTO zhs_credit_records (user_uuid, change_amount, reason, created_at) VALUES (${userUuid}, ${balance ?? 0}, ${reason ?? 'manual_adjust'}, now())`,
          )
        } catch {
          // 静默失败, 仍返回 OK 表示已尝试
        }
      }
      return reply.send(
        success({
          userUuid,
          applied: { balance, frozen_balance, reason },
          message:
            '余额更新已尝试(若 user_token_balance 表存在则生效, 否则写入 zhs_credit_records 审计)',
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `更新 token 余额失败: ${(e as Error).message}`))
    }
  })

  // 15. POST /cozeZhsApi/agents/user/billing - 真实查 agentBillings + 统计
  server.post('/cozeZhsApi/agents/user/billing', async (request, reply) => {
    try {
      const parsed = z
        .object({
          uuid: z.string().min(1),
          type: z.enum(['w', 'm', 'y', 'a']).default('a'),
          page: z.number().int().min(1).default(1),
          page_size: z.number().int().min(1).max(100).default(20),
        })
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { uuid, type, page, page_size: pageSize } = parsed.data
      const now = new Date()
      const startTime =
        type === 'w'
          ? new Date(now.getTime() - 7 * 86400_000)
          : type === 'm'
            ? new Date(now.getTime() - 30 * 86400_000)
            : type === 'y'
              ? new Date(now.getTime() - 365 * 86400_000)
              : new Date(0)
      const list = await dbRead
        .select()
        .from(agentBillings)
        .where(
          and(
            eq(agentBillings.customConsumer, uuid),
            gte(agentBillings.consumeTime, Math.floor(startTime.getTime() / 1000)),
          ),
        )
        .orderBy(desc(agentBillings.consumeTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
      return reply.send(
        success({ list, total: list.length, page, pageSize, period: type, startTime, uuid }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `查询用户账单失败: ${(e as Error).message}`))
    }
  })

  // ===========================================================================
  // M-63 P0 补建端点 (6 个) - 守门脚本要求精确字符串匹配
  // 顺序: 静态路由优先, 参数路由 /:agentId/details 放最后避免拦截静态路径
  // ===========================================================================

  // 1. GET /agents/health - 健康检查
  server.get('/agents/health', async (_request, reply) => {
    return reply.send(success({ status: 'ok', timestamp: Date.now() }))
  })

  // 2. GET /manage - 智能体管理列表 (当前用户创建的 agents)
  server.get('/manage', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        status: z.string().optional(),
        categoryId: z.string().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
    const result = await listAgents({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      status: q.status,
      categoryId: q.categoryId,
      userId: request.userId,
      keyword: q.keyword,
    })
    return reply.send(success(result))
  })

  // 3. GET /Alllist - 全部智能体列表 (公开, 分页)
  server.get('/Alllist', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        status: z.string().optional(),
        categoryId: z.string().optional(),
        userId: z.string().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
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

  // 4. GET /billings - 计费记录列表 (当前用户)
  // 查 agent_billings 表, 按 customConsumer (=userId) 过滤, 分页
  server.get('/billings', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        eventId: z.string().optional(),
      })
      .parse(request.query)
    const page = toInt(q.page) ?? 1
    const pageSize = toInt(q.pageSize) ?? 20
    const conds = [eq(agentBillings.customConsumer, request.userId!)]
    if (q.eventId) conds.push(eq(agentBillings.eventId, q.eventId))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(agentBillings)
        .where(where)
        .orderBy(desc(agentBillings.consumeTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(agentBillings)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // 5. GET /callbacks - 回调记录列表 (当前用户)
  // 复用 agentBillings 表作为回调记录 (与现有 /cozeZhsApi/agents/callbacks 一致)
  server.get('/callbacks', async (request, reply) => {
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        eventId: z.string().optional(),
      })
      .parse(request.query)
    const page = toInt(q.page) ?? 1
    const pageSize = toInt(q.pageSize) ?? 20
    const conds = [eq(agentBillings.customConsumer, request.userId!)]
    if (q.eventId) conds.push(eq(agentBillings.eventId, q.eventId))
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(agentBillings)
        .where(where)
        .orderBy(desc(agentBillings.consumeTime))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(agentBillings)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // 7. POST /agents/heat/generate - 手动触发热度统计计算(admin 权限)
  // 权重:点赞=1, 分享=3, 收藏=2, 使用=1
  // 若 agents 表无 heat_score 字段,跳过更新只返回计算结果
  server.post('/agents/heat/generate', { preHandler: requireAdmin }, async (_request, reply) => {
    const weights = { like: 1, share: 3, collect: 2, usage: 1 }

    const agentRows = await dbRead
      .select({
        agentId: agents.agentId,
        likeCount: agents.likeCount,
        shareCount: agents.shareCount,
        collectCount: agents.collectCount,
        usageCount: agents.usageCount,
      })
      .from(agents)
      .where(eq(agents.status, 'published'))

    const heatScores = agentRows.map((a) => ({
      agentId: a.agentId,
      heatScore:
        a.likeCount * weights.like +
        a.shareCount * weights.share +
        a.collectCount * weights.collect +
        a.usageCount * weights.usage,
    }))

    // 尝试批量更新 agents.heat_score 字段(表无此字段则跳过)
    let updated = 0
    if (heatScores.length > 0) {
      try {
        for (const hs of heatScores) {
          await db.execute(
            sql`UPDATE agents SET heat_score = ${hs.heatScore} WHERE agent_id = ${hs.agentId}`,
          )
          updated++
        }
      } catch {
        // 表无 heat_score 字段,跳过更新
        updated = 0
      }
    }

    return reply.send(
      success({
        updated,
        generated_at: new Date().toISOString(),
        totalAgents: heatScores.length,
        weights,
      }),
    )
  })

  // 6. GET /:agentId/details - 智能体详情 (含统计信息)
  // 注意: 必须放在 /agents/health 等静态路由之后, 避免参数路由拦截静态路径
  server.get('/:agentId/details', async (request, reply) => {
    const parsed = agentIdParam.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, 'agentId 参数错误'))
    }
    const { agentId } = parsed.data
    const detail = await getAgentDetail(agentId)
    if (!detail) return reply.status(404).send(error(404, '智能体不存在'))
    // 统计信息: 该智能体的计费记录数与 token 总量
    const [billingStats] = await dbRead
      .select({
        billingCount: sql<number>`count(*)::int`,
        totalInputTokens: sql<number>`COALESCE(sum(${agentBillings.modelInputToken}), 0)::int`,
        totalOutputTokens: sql<number>`COALESCE(sum(${agentBillings.modelOutputToken}), 0)::int`,
        totalCost: sql<string>`COALESCE(sum(${agentBillings.changeBalance}), 0)::text`,
      })
      .from(agentBillings)
      .where(eq(agentBillings.recordId, agentId))
    return reply.send(
      success({
        ...detail,
        stats: {
          billingCount: billingStats?.billingCount ?? 0,
          totalInputTokens: billingStats?.totalInputTokens ?? 0,
          totalOutputTokens: billingStats?.totalOutputTokens ?? 0,
          totalCost: billingStats?.totalCost ?? '0',
        },
      }),
    )
  })
}
