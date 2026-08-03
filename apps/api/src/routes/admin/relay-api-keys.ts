/**
 * /api/admin/relay/api-keys 管理员侧 API Key 安全管理(P0-7 配套,2026-07-31 立)。
 *
 * 端点清单:
 * 1. GET   /admin/relay/api-keys              — 全部 API Key 列表(跨用户,分页 + 筛选,支持 tenant_id 过滤)
 * 2. POST  /admin/relay/api-keys              — 管理员创建 API Key(可关联 tenant_id)
 * 3. GET   /admin/relay/api-keys/by-tenant    — 按 tenant 分组统计 Key 数量 + 用量
 * 4. GET   /admin/relay/api-keys/:id          — 单个 API Key 详情(含 tenant 关联信息)
 * 5. PATCH /admin/relay/api-keys/:id          — 管理员强制更新(可设过期/IP 白名单/模型白名单/token 上限/状态)
 *
 * 管理员可强制给任何用户的 Key 设过期或限制,用于安全审计/违规处置。
 * 多租户:API Key 可关联 tenant_id,实现组织级配额池(对标 New API)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, ilike, and, sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { developerApiKeys, tenants } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema, idParamSchema } from './_shared.js'
import { generateApiKey, hashSecret } from '../../utils/api-key-hash.js'

const listQuerySchema = paginationSchema.extend({
  /** 按用户 ID 筛选 */
  userId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  /** 按状态筛选:active / revoked */
  status: z.preprocess(emptyToUndefined, z.enum(['active', 'revoked']).optional()),
  /** 按租户 ID 筛选(多租户,2026-07-31 立) */
  tenantId: z.preprocess(emptyToUndefined, z.uuid().optional()),
})

/** 管理员更新 body(所有字段可选,可强制设过期/限制/状态) */
const adminUpdateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'revoked']).optional(),
  // --- P0-7 安全粒度字段 ---
  /** 过期时间(ISO 字符串,null = 清除过期限制=永不过期) */
  expiresAt: z.string().nullable().optional(),
  /** IP 白名单(null/空 = 清除限制) */
  allowedIps: z.array(z.string()).nullable().optional(),
  /** 模型白名单(null/空 = 清除限制) */
  allowedModels: z.array(z.string()).nullable().optional(),
  /** 单次请求 token 上限(null = 清除限制) */
  maxTokensPerReq: z.number().int().positive().nullable().optional(),
})

/** 管理员创建 API Key body(支持关联 tenant_id,2026-07-31 立) */
const createBodySchema = z.object({
  userId: z.uuid(),
  name: z.string().min(1).max(100),
  /** 关联租户 ID(可选,不传则为个人 Key) */
  tenantId: z.uuid().nullable().optional(),
  permissions: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  // --- P0-7 安全粒度字段 ---
  expiresAt: z.string().nullable().optional(),
  allowedIps: z.array(z.string()).nullable().optional(),
  allowedModels: z.array(z.string()).nullable().optional(),
  maxTokensPerReq: z.number().int().positive().nullable().optional(),
})

const relayApiKeysRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/api-keys — 全部 API Key 列表(跨用户,支持 tenant_id 过滤) =====
  server.get('/admin/relay/api-keys', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize, search, userId, status, tenantId } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(developerApiKeys.userId, userId))
    if (status) conds.push(eq(developerApiKeys.status, status))
    if (tenantId) conds.push(eq(developerApiKeys.tenantId, tenantId))
    const where = conds.length > 0 ? and(...conds) : undefined

    const searchCond = search ? ilike(developerApiKeys.name, `%${search}%`) : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: developerApiKeys.id,
            userId: developerApiKeys.userId,
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
            // 多租户关联字段
            tenantId: developerApiKeys.tenantId,
            lastUsedAt: developerApiKeys.lastUsedAt,
            createdAt: developerApiKeys.createdAt,
            updatedAt: developerApiKeys.updatedAt,
          })
          .from(developerApiKeys)
          .where(finalWhere)
          .orderBy(desc(developerApiKeys.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(developerApiKeys)
          .where(finalWhere),
      ])
      return reply.send(success({ list, total: totalRows[0]?.c ?? 0, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 API Key 列表失败'))
    }
  })

  // ===== 2. POST /admin/relay/api-keys — 管理员创建 API Key(可关联 tenant_id) =====
  server.post('/admin/relay/api-keys', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const b = parsed.data
    const { key, secret } = generateApiKey()
    const hashed = hashSecret(secret)
    try {
      const [record] = await db
        .insert(developerApiKeys)
        .values({
          userId: b.userId,
          name: b.name,
          key,
          secret: hashed,
          permissions: b.permissions ?? [],
          rateLimit: b.rateLimit ?? 60,
          tenantId: b.tenantId ?? null,
          expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
          allowedIps: b.allowedIps ?? null,
          allowedModels: b.allowedModels ?? null,
          maxTokensPerReq: b.maxTokensPerReq ?? null,
        })
        .returning({
          id: developerApiKeys.id,
          userId: developerApiKeys.userId,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          permissions: developerApiKeys.permissions,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          tenantId: developerApiKeys.tenantId,
          expiresAt: developerApiKeys.expiresAt,
          allowedIps: developerApiKeys.allowedIps,
          allowedModels: developerApiKeys.allowedModels,
          maxTokensPerReq: developerApiKeys.maxTokensPerReq,
          createdAt: developerApiKeys.createdAt,
        })
      if (!record) return reply.status(500).send(error(500, '创建 API Key 失败'))
      // secret 仅创建时返回一次,后续不可查询
      return reply.status(201).send(success({ ...record, secret }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 API Key 失败'))
    }
  })

  // ===== 3. GET /admin/relay/api-keys/by-tenant — 按 tenant 分组统计 Key 数量 + 用量 =====
  server.get('/admin/relay/api-keys/by-tenant', async (request, reply) => {
    try {
      const rows = await dbRead
        .select({
          tenantId: developerApiKeys.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          keyCount: sql<number>`count(*)::int`,
          tokenUsedTotal: sql<number>`coalesce(sum(${developerApiKeys.tokenUsedTotal}), 0)::float8`,
          costUsedTotalCents: sql<number>`coalesce(sum(${developerApiKeys.costUsedTotalCents}), 0)::int`,
        })
        .from(developerApiKeys)
        .leftJoin(tenants, eq(developerApiKeys.tenantId, tenants.id))
        .groupBy(developerApiKeys.tenantId, tenants.name, tenants.slug)
        .orderBy(desc(developerApiKeys.tenantId))
      return reply.send(success({ list: rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '按租户统计失败'))
    }
  })

  // ===== 4. GET /admin/relay/api-keys/:id — 单个 API Key 详情(含 tenant 关联信息) =====
  server.get('/admin/relay/api-keys/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [row] = await dbRead
        .select({
          id: developerApiKeys.id,
          userId: developerApiKeys.userId,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          permissions: developerApiKeys.permissions,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          tokenBalance: developerApiKeys.tokenBalance,
          costBalanceCents: developerApiKeys.costBalanceCents,
          tokenUsedTotal: developerApiKeys.tokenUsedTotal,
          costUsedTotalCents: developerApiKeys.costUsedTotalCents,
          expiresAt: developerApiKeys.expiresAt,
          allowedIps: developerApiKeys.allowedIps,
          allowedModels: developerApiKeys.allowedModels,
          maxTokensPerReq: developerApiKeys.maxTokensPerReq,
          // 多租户关联字段
          tenantId: developerApiKeys.tenantId,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          lastUsedAt: developerApiKeys.lastUsedAt,
          createdAt: developerApiKeys.createdAt,
          updatedAt: developerApiKeys.updatedAt,
        })
        .from(developerApiKeys)
        .leftJoin(tenants, eq(developerApiKeys.tenantId, tenants.id))
        .where(eq(developerApiKeys.id, p.data.id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, 'API Key 不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 API Key 失败'))
    }
  })

  // ===== 5. PATCH /admin/relay/api-keys/:id — 管理员强制更新 =====
  server.patch('/admin/relay/api-keys/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const parsed = adminUpdateBodySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const d = parsed.data
      const setData: Record<string, unknown> = { updatedAt: new Date() }
      if (d.name !== undefined) setData.name = d.name
      if (d.rateLimit !== undefined) setData.rateLimit = d.rateLimit
      if (d.status !== undefined) setData.status = d.status
      // P0-7 安全字段:undefined = 不修改,null = 清除限制
      if (d.expiresAt !== undefined) {
        setData.expiresAt = typeof d.expiresAt === 'string' ? new Date(d.expiresAt) : d.expiresAt
      }
      if (d.allowedIps !== undefined) setData.allowedIps = d.allowedIps
      if (d.allowedModels !== undefined) setData.allowedModels = d.allowedModels
      if (d.maxTokensPerReq !== undefined) setData.maxTokensPerReq = d.maxTokensPerReq

      const [updated] = await db
        .update(developerApiKeys)
        .set(setData)
        .where(eq(developerApiKeys.id, p.data.id))
        .returning({
          id: developerApiKeys.id,
          userId: developerApiKeys.userId,
          name: developerApiKeys.name,
          key: developerApiKeys.key,
          status: developerApiKeys.status,
          rateLimit: developerApiKeys.rateLimit,
          expiresAt: developerApiKeys.expiresAt,
          allowedIps: developerApiKeys.allowedIps,
          allowedModels: developerApiKeys.allowedModels,
          maxTokensPerReq: developerApiKeys.maxTokensPerReq,
          updatedAt: developerApiKeys.updatedAt,
        })
      if (!updated) return reply.status(404).send(error(404, 'API Key 不存在'))
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新 API Key 失败'))
    }
  })
}

export default relayApiKeysRoutes
