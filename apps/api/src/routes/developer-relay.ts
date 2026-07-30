/**
 * /api/developer/relay 中转站用户侧端点(P0-5f 配套,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET   /developer/relay/keys     — 当前用户的 API Key 列表(含 tokenBalance/costBalanceCents 余额)
 * 2. POST  /developer/relay/keys     — 创建 API Key(P0-7 支持 4 安全字段)
 * 3. PATCH /developer/relay/keys/:id — 更新 API Key(P0-7 支持 4 安全字段)
 * 4. GET   /developer/relay/usage    — 当前用户的用量明细(按模型/按日 聚合)
 * 5. GET   /developer/relay/logs     — 当前用户的调用日志(分页)
 * 6. POST  /developer/relay/keys/:id/recharge — 充值(用钱包余额充值 API Key 余额,生产环境需接支付)
 * 7. POST  /developer/relay/redeem   — 兑换码充值
 *
 * 复用 developerApiKeys + llmCallLogs 表。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql, like, type SQL } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { developerApiKeys, llmCallLogs } from '@ihui/database'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { paginationSchema } from './admin/_shared.js'
import { adjustBalance } from '../services/relay-billing-service.js'
import { createMapping, listMappings } from '../services/model-mapping-service.js'
import { redeemCode } from '../services/redemption-code-service.js'
import { idParamSchema } from './admin/_shared.js'
import { createKey, updateKey } from '../services/developer-api-keys-service.js'

const usageQuerySchema = z.object({
  /** 起始日期 YYYY-MM-DD(默认近 30 天) */
  startDate: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 分组维度:model / day(默认 model) */
  groupBy: z.enum(['model', 'day']).default('model'),
  /** 调用模式筛选:all=全部 / relay=中转站 / byok=BYOK(默认 all) */
  mode: z.enum(['all', 'relay', 'byok']).default('all'),
})

const logsQuerySchema = paginationSchema.extend({
  model: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['success', 'error']).optional()),
  /** API Key 筛选(仅当前用户名下的 Key)*/
  apiKeyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  /** 渠道筛选,精确匹配 provider_code */
  provider: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  /** 客户端 IP 筛选,支持 LIKE 通配符(如 '192.168.%')*/
  clientIp: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
  /** 最小耗时毫秒,筛选 latency_ms >= minLatency(慢调用分析)*/
  minLatency: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** 最大耗时毫秒 */
  maxLatency: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** HTTP 状态码筛选(如 429 限流/500 错误专项)*/
  httpStatus: z.preprocess(emptyToUndefined, z.coerce.number().int().min(100).max(599).optional()),
  /** 最小成本分 */
  minCost: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
  /** 最大成本分 */
  maxCost: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional()),
})

const rechargeBodySchema = z.object({
  /** 充值 token 数(与 costCentsCents 二选一,或都填) */
  tokenDelta: z.number().int().optional(),
  /** 充值成本额度(分) */
  costDeltaCents: z.number().int().optional(),
}).refine(
  (d) => (d.tokenDelta !== undefined && d.tokenDelta !== 0) || (d.costDeltaCents !== undefined && d.costDeltaCents !== 0),
  { message: 'tokenDelta 或 costDeltaCents 至少填一个且非 0' },
)

/** 兑换码兑换 body(P0-5 刮刮卡式裂变充值,2026-07-31 立) */
const redeemBodySchema = z.object({
  /** 兑换码(IHUI-XXXX-XXXX-XXXX,自动 normalize 去空格/转大写) */
  code: z.string().min(1, '兑换码不能为空').max(64),
  /** 可选:指定充值到哪个 API Key;未传则用用户最新 active Key */
  apiKeyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

// --- P0-7 安全字段 schema 片段(创建/更新共用)---
const securityFieldsSchema = {
  /** 过期时间(ISO 字符串,null = 永不过期) */
  expiresAt: z.string().nullable().optional(),
  /** IP 白名单(null/空 = 不限制),支持 CIDR */
  allowedIps: z.array(z.string()).nullable().optional(),
  /** 模型白名单(null/空 = 不限制),支持通配符 gpt-4* */
  allowedModels: z.array(z.string()).nullable().optional(),
  /** 单次请求 token 上限(null = 不限制) */
  maxTokensPerReq: z.number().int().positive().nullable().optional(),
}

/** 创建 API Key body(P0-7 支持安全字段) */
const createKeyBodySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  ...securityFieldsSchema,
})

/** 更新 API Key body(P0-7 支持安全字段,所有字段可选) */
const updateKeyBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'revoked']).optional(),
  ...securityFieldsSchema,
})

const developerRelayRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAuth)

  // ===== 1. GET /developer/relay/keys — API Key 列表(含余额,脱敏 secret) =====
  server.get('/developer/relay/keys', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    try {
      const rows = await dbRead
        .select({
          id: developerApiKeys.id,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          permissions: developerApiKeys.permissions,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          tokenBalance: developerApiKeys.tokenBalance,
          costBalanceCents: developerApiKeys.costBalanceCents,
          tokenUsedTotal: developerApiKeys.tokenUsedTotal,
          costUsedTotalCents: developerApiKeys.costUsedTotalCents,
          // P0-7 安全粒度字段
          expiresAt: developerApiKeys.expiresAt,
          allowedIps: developerApiKeys.allowedIps,
          allowedModels: developerApiKeys.allowedModels,
          maxTokensPerReq: developerApiKeys.maxTokensPerReq,
          lastUsedAt: developerApiKeys.lastUsedAt,
          createdAt: developerApiKeys.createdAt,
          updatedAt: developerApiKeys.updatedAt,
        })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.userId, userId))
        .orderBy(desc(developerApiKeys.createdAt))
      return reply.send(success({ list: rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 API Key 列表失败'))
    }
  })

  // ===== 1b. POST /developer/relay/keys — 创建 API Key(P0-7 支持安全字段) =====
  server.post('/developer/relay/keys', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = createKeyBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const d = parsed.data
      const result = await createKey(userId, {
        name: d.name,
        permissions: d.permissions,
        rateLimit: d.rateLimit,
        // ISO 字符串 → Date;null → null(永不过期);undefined → undefined(默认)
        expiresAt: typeof d.expiresAt === 'string' ? new Date(d.expiresAt) : d.expiresAt,
        allowedIps: d.allowedIps,
        allowedModels: d.allowedModels,
        maxTokensPerReq: d.maxTokensPerReq,
      })
      // 脱敏:不返回 secret 哈希,仅返回明文 secret(仅此一次)
      const { secret: _s, ...safe } = result.apiKey
      return reply.status(201).send(success({ apiKey: safe, secret: result.secret }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 API Key 失败'))
    }
  })

  // ===== 1c. PATCH /developer/relay/keys/:id — 更新 API Key(P0-7 支持安全字段) =====
  server.patch('/developer/relay/keys/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = updateKeyBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const d = parsed.data
      const updated = await updateKey(p.data.id, userId, {
        name: d.name,
        permissions: d.permissions,
        rateLimit: d.rateLimit,
        status: d.status,
        expiresAt: typeof d.expiresAt === 'string' ? new Date(d.expiresAt) : d.expiresAt,
        allowedIps: d.allowedIps,
        allowedModels: d.allowedModels,
        maxTokensPerReq: d.maxTokensPerReq,
      })
      if (!updated) return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))
      // 脱敏:不返回 secret 哈希
      const { secret: _s, ...safe } = updated
      return reply.send(success(safe))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新 API Key 失败'))
    }
  })

  // ===== 2. GET /developer/relay/usage — 用量明细(按模型/按日 聚合) =====
  server.get('/developer/relay/usage', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = usageQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, groupBy, mode } = q.data

    const conds: ReturnType<typeof eq>[] = [eq(llmCallLogs.userId, userId)]
    if (startDate) {
      conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    } else {
      // 默认近 30 天
      conds.push(gte(llmCallLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
    }
    // BYOK 模式筛选:byokMode=true 表示 BYOK 调用,其余为中转站调用
    if (mode === 'byok') {
      conds.push(sql`${llmCallLogs.metadata}->>'byokMode' = 'true'`)
    } else if (mode === 'relay') {
      conds.push(sql`${llmCallLogs.metadata}->>'byokMode' IS NULL OR ${llmCallLogs.metadata}->>'byokMode' != 'true'`)
    }
    const where = and(...conds)

    try {
      const groupCol =
        groupBy === 'day'
          ? sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`
          : sql<string>`${llmCallLogs.model}`

      const rows = await dbRead
        .select({
          groupKey: groupCol.as('group_key'),
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
          successCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'success')::int`,
          errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
          // BYOK 调用次数(metadata->>'byokMode'='true')
          byokCallCount: sql<number>`count(*) filter (where ${llmCallLogs.metadata}->>'byokMode' = 'true')::int`,
          // 中转站调用次数
          relayCallCount: sql<number>`count(*) filter (where ${llmCallLogs.metadata}->>'byokMode' IS NULL OR ${llmCallLogs.metadata}->>'byokMode' != 'true')::int`,
          // BYOK 上游成本合计(分)
          upstreamCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'upstreamCostCents')::numeric)::bigint), 0)::bigint::int`,
          // BYOK 平台服务费合计(分)
          platformFeeCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'platformFeeCents')::numeric)::bigint), 0)::bigint::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(groupCol)
        .orderBy(desc(sql`count(*)::int`))
        .limit(100)

      // 汇总
      const [summary] = await dbRead
        .select({
          totalCalls: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
          byokCallCount: sql<number>`count(*) filter (where ${llmCallLogs.metadata}->>'byokMode' = 'true')::int`,
          relayCallCount: sql<number>`count(*) filter (where ${llmCallLogs.metadata}->>'byokMode' IS NULL OR ${llmCallLogs.metadata}->>'byokMode' != 'true')::int`,
          upstreamCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'upstreamCostCents')::numeric)::bigint), 0)::bigint::int`,
          platformFeeCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'platformFeeCents')::numeric)::bigint), 0)::bigint::int`,
        })
        .from(llmCallLogs)
        .where(where)

      return reply.send(
        success({
          groupBy,
          mode,
          rows,
          summary: {
            totalCalls: summary?.totalCalls ?? 0,
            totalTokens: summary?.totalTokens ?? 0,
            totalCostCents: summary?.totalCostCents ?? 0,
            byokCallCount: summary?.byokCallCount ?? 0,
            relayCallCount: summary?.relayCallCount ?? 0,
            upstreamCostCents: summary?.upstreamCostCents ?? 0,
            platformFeeCents: summary?.platformFeeCents ?? 0,
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询用量明细失败'))
    }
  })

  // ===== 3. GET /developer/relay/logs — 调用日志(分页) =====
  server.get('/developer/relay/logs', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = logsQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const {
      page,
      pageSize,
      model,
      status,
      apiKeyId,
      provider,
      clientIp,
      minLatency,
      maxLatency,
      httpStatus,
      minCost,
      maxCost,
    } = q.data

    // 强制 userId 隔离:用户只能查自己的日志
    const conds: SQL[] = [eq(llmCallLogs.userId, userId)]
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    if (apiKeyId) conds.push(eq(llmCallLogs.apiKeyId, apiKeyId))
    if (provider) conds.push(eq(llmCallLogs.providerCode, provider))
    if (clientIp) conds.push(like(llmCallLogs.clientIp, clientIp))
    if (minLatency !== undefined) conds.push(gte(llmCallLogs.latencyMs, minLatency))
    if (maxLatency !== undefined) conds.push(lte(llmCallLogs.latencyMs, maxLatency))
    if (httpStatus !== undefined) conds.push(eq(llmCallLogs.httpStatus, httpStatus))
    if (minCost !== undefined) conds.push(gte(llmCallLogs.costCents, minCost))
    if (maxCost !== undefined) conds.push(lte(llmCallLogs.costCents, maxCost))
    const where = and(...conds)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: llmCallLogs.id,
            model: llmCallLogs.model,
            promptTokens: llmCallLogs.promptTokens,
            completionTokens: llmCallLogs.completionTokens,
            totalTokens: llmCallLogs.totalTokens,
            latencyMs: llmCallLogs.latencyMs,
            status: llmCallLogs.status,
            errorMessage: llmCallLogs.errorMessage,
            metadata: llmCallLogs.metadata,
            createdAt: llmCallLogs.createdAt,
            // 高级筛选配套返回字段(字段由 schema subagent 同步添加)
            apiKeyId: llmCallLogs.apiKeyId,
            providerCode: llmCallLogs.providerCode,
            clientIp: llmCallLogs.clientIp,
            costCents: llmCallLogs.costCents,
            httpStatus: llmCallLogs.httpStatus,
            ttftMs: llmCallLogs.ttftMs,
          })
          .from(llmCallLogs)
          .where(where)
          .orderBy(desc(llmCallLogs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(llmCallLogs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志失败'))
    }
  })

  // ===== 4. POST /developer/relay/keys/:id/recharge — 充值 API Key 余额 =====
  server.post('/developer/relay/keys/:id/recharge', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = rechargeBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    // 校验 Key 归属权
    const [existing] = await dbRead
      .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, p.data.id))
      .limit(1)
    if (!existing || existing.userId !== userId)
      return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))

    try {
      const result = await adjustBalance(
        p.data.id,
        parsed.data.tokenDelta ?? 0,
        parsed.data.costDeltaCents ?? 0,
      )
      if (!result) return reply.status(404).send(error(404, 'API Key 不存在'))
      return reply.send(success({ id: p.data.id, ...result }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '充值失败'))
    }
  })

  // ===== 5. POST /developer/relay/redeem — 兑换码充值(P0-5 刮刮卡式裂变充值) =====
  server.post('/developer/relay/redeem', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = redeemBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await redeemCode(parsed.data.code, userId, parsed.data.apiKeyId)
      if (!result.success) {
        // 兑换失败:根据 reason 返回不同状态码
        const reasonMap: Record<string, { status: number; msg: string }> = {
          code_not_found: { status: 404, msg: '兑换码不存在' },
          already_used: { status: 409, msg: '兑换码已被使用' },
          expired: { status: 410, msg: '兑换码已过期' },
          disabled: { status: 403, msg: '兑换码已被禁用' },
          not_unused: { status: 409, msg: '兑换码状态异常' },
          no_active_key: { status: 404, msg: '您还没有可用的 API Key,请先创建' },
          key_not_found: { status: 404, msg: '指定的 API Key 不存在' },
        }
        const mapped = reasonMap[result.reason ?? ''] ?? { status: 400, msg: result.reason ?? '兑换失败' }
        return reply.status(mapped.status).send(error(mapped.status, mapped.msg))
      }
      return reply.send(
        success({
          tokenAmount: result.tokenAmount,
          newTokenBalance: result.newTokenBalance,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '兑换失败'))
    }
  })

  // ===== P0-4 模型映射端点(2026-07-31 立,降本神器:用户配 gpt-4o → deepseek-chat)=====

  const createMappingBodySchema = z.object({
    /** 指定则创建 Key 级映射,不指定则创建用户级映射(userId 自动取当前用户) */
    apiKeyId: z.string().uuid().nullable().optional(),
    sourceModel: z.string().min(1, 'source_model 不能为空').max(128),
    targetModel: z.string().min(1, 'target_model 不能为空').max(128),
    priority: z.number().int().optional(),
    enabled: z.boolean().optional(),
  })

  // 5. GET /developer/relay/model-mappings — 当前用户的模型映射列表(含全局映射)
  server.get('/developer/relay/model-mappings', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    // 返回当前用户级 + Key 级 + 全局映射(用户能看到全局映射以便了解生效规则)
    const [userMappings, globalMappings] = await Promise.all([
      listMappings({ userId }),
      listMappings({ userId: null, apiKeyId: null }),
    ])
    return reply.send(
      success({
        list: [...userMappings, ...globalMappings],
        total: userMappings.length + globalMappings.length,
      }),
    )
  })

  // 6. POST /developer/relay/model-mappings — 创建用户级或 Key 级映射
  server.post('/developer/relay/model-mappings', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = createMappingBodySchema.safeParse(request.body ?? {})
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { apiKeyId, sourceModel, targetModel, priority, enabled } = parsed.data

    // 如果指定 apiKeyId,校验 Key 归属权
    if (apiKeyId) {
      const [existing] = await dbRead
        .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.id, apiKeyId))
        .limit(1)
      if (!existing || existing.userId !== userId)
        return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))
    }

    try {
      const row = await createMapping({
        userId,
        apiKeyId: apiKeyId ?? null,
        sourceModel,
        targetModel,
        priority: priority ?? 0,
        enabled: enabled ?? true,
      })
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      const msg = e instanceof Error ? e.message : '创建失败'
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('冲突')) {
        return reply.status(409).send(error(409, '该作用域内 source_model 已存在映射'))
      }
      return reply.status(500).send(error(500, msg))
    }
  })

  // 7. DELETE /developer/relay/model-mappings/:id — 删除映射(ownership 校验)
  server.delete('/developer/relay/model-mappings/:id', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))

    // 查映射行 + ownership 校验
    const [existing] = await dbRead
      .select()
      .from(aiModelMappings)
      .where(eq(aiModelMappings.id, p.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '映射不存在'))

    // ownership:映射 userId === 当前用户,或映射 apiKeyId 属于当前用户
    if (existing.userId !== userId) {
      if (existing.apiKeyId) {
        const [key] = await dbRead
          .select({ userId: developerApiKeys.userId })
          .from(developerApiKeys)
          .where(eq(developerApiKeys.id, existing.apiKeyId))
          .limit(1)
        if (!key || key.userId !== userId)
          return reply.status(403).send(error(403, '无权删除该映射'))
      } else {
        // 全局映射或他人的用户级映射,用户无权删
        return reply.status(403).send(error(403, '无权删除全局或其他用户的映射'))
      }
    }

    const [deleted] = await db
      .delete(aiModelMappings)
      .where(eq(aiModelMappings.id, p.data.id))
      .returning({ id: aiModelMappings.id })
    if (!deleted) return reply.status(404).send(error(404, '映射不存在'))
    return reply.send(success({ id: deleted.id }))
  })
}

export default developerRelayRoutes
