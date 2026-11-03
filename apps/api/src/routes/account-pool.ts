// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 个人号池用户态 API(2026-10-23 立)。
 *
 * 双池并存的用户侧半边:运营池仍是 admin 专属(ai_relay_account_pool.owner_user_id IS NULL),
 * 这里只服务当前登录用户自己的行(owner_user_id = request.userId),跨用户一律 404。
 * 与签到助手共用同一批账号(反向同步建立 pool_account_id 链接),Web / 移动端 / 小程序
 * 三端复用本组端点,数据天然互通。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { aiRelayAccountPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { RELAY_PROVIDERS, isRelayProviderCode } from '../services/relay-account-format.js'
import { importAccounts } from '../services/relay-account-pool-service.js'
import {
  checkinPlatformFor,
  fetchPoolStatus,
  markCheckinSyncPending,
  postPoolRun,
  pushPoolState,
  type PoolAccountState,
} from '../services/relay-account-pool-checkin-sync.js'

const createBodySchema = z.object({
  providerCode: z.enum(RELAY_PROVIDERS),
  name: z.string().min(1).max(128),
  token: z.string().min(1).max(8192),
  refreshToken: z.string().max(8192).optional(),
  cookies: z.array(z.unknown()).max(200).optional(),
  deviceId: z.string().max(128).optional(),
  machineId: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
})

const updateBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  isEnabled: z.boolean().optional(),
})

const idParamSchema = z.object({ id: z.string().uuid() })

/** 用户可见投影:绝不含 *Enc / proxyUrl(可能带账密) / cosy(设备凭据) */
const userProjection = {
  id: aiRelayAccountPool.id,
  providerCode: aiRelayAccountPool.providerCode,
  uid: aiRelayAccountPool.uid,
  name: aiRelayAccountPool.name,
  isEnabled: aiRelayAccountPool.isEnabled,
  healthStatus: aiRelayAccountPool.healthStatus,
  tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
  totalCalls: aiRelayAccountPool.totalCalls,
  lastUsedAt: aiRelayAccountPool.lastUsedAt,
  createdAt: aiRelayAccountPool.createdAt,
  checkinPending:
    sql<boolean>`coalesce((${aiRelayAccountPool.extraMetadata}->'checkinSync'->>'pending')::boolean, false)`.as(
      'checkin_pending',
    ),
  checkinSyncedAt: sql<
    string | null
  >`${aiRelayAccountPool.extraMetadata}->'checkinSync'->>'lastSyncedAt'`.as('checkin_synced_at'),
}

function requireUser(request: FastifyRequest, reply: FastifyReply): string | null {
  const userId = request.userId
  if (!userId) {
    reply.status(401).send(error(401, '未登录'))
    return null
  }
  if (userId === 'system:relay-pool') {
    reply.status(403).send(error(403, '非法账号'))
    return null
  }
  return userId
}

const accountPoolRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    await authenticate(request)
    if (!request.userId) {
      return reply.status(401).send(error(401, '未登录'))
    }
  })

  // ===== 1. GET /api/account-pool — 我的个人号池列表 =====
  server.get('/api/account-pool', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const q = z
      .object({
        provider: z.string().max(32).optional(),
        enabled: z.enum(['true', 'false']).optional(),
      })
      .safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const conds = [eq(aiRelayAccountPool.ownerUserId, userId)]
    if (q.data.provider && isRelayProviderCode(q.data.provider)) {
      conds.push(eq(aiRelayAccountPool.providerCode, q.data.provider))
    }
    if (q.data.enabled === 'true') conds.push(eq(aiRelayAccountPool.isEnabled, true))
    if (q.data.enabled === 'false') conds.push(eq(aiRelayAccountPool.isEnabled, false))
    const rows = await dbRead
      .select(userProjection)
      .from(aiRelayAccountPool)
      .where(and(...conds))
      .orderBy(aiRelayAccountPool.providerCode, desc(aiRelayAccountPool.createdAt))
    return reply.send(success({ list: rows, total: rows.length }))
  })

  // ===== 2. POST /api/account-pool — 添加账号(手动凭证;等价签到助手录入) =====
  server.post('/api/account-pool', async (request, reply) => {
    const userId = requireUser(request, reply)
    if (!userId) return
    const parsed = createBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data
    try {
      const result = await importAccounts(
        body.providerCode,
        [
          {
            name: body.name,
            token: body.token,
            refreshToken: body.refreshToken,
            cookies: body.cookies,
            deviceId: body.deviceId,
            machineId: body.machineId,
            enabled: body.enabled,
          },
        ],
        userId,
      )
      const item = result.items[0]
      if (!item || item.status === 'failed') {
        return reply.status(400).send(error(400, item?.reason ?? '添加账号失败'))
      }
      return reply.send(
        success({ uid: item.uid, status: item.status, checkinSync: result.checkinSync }),
      )
    } catch (e) {
      request.log.error(e, '[account-pool] 添加个人账号失败')
      return reply.status(500).send(error(500, '添加账号失败'))
    }
  })

  // ===== 3. PATCH /api/account-pool/:id — 改名/启停 =====
  server.patch('/api/account-pool/:id', async (request, reply) => {
    const userId = requireUser(request, reply)
    if (!userId) return
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const body = updateBodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [row] = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
        name: aiRelayAccountPool.name,
        isEnabled: aiRelayAccountPool.isEnabled,
      })
      .from(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.id, p.data.id), eq(aiRelayAccountPool.ownerUserId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '账号不存在'))
    // 只写真实变化:与现值按键比较,无变化不发 UPDATE、不盖 updatedAt(增量读不被同值空写污染)
    const changed: { name?: string; isEnabled?: boolean } = {}
    if (body.data.name !== undefined && body.data.name !== row.name) changed.name = body.data.name
    if (body.data.isEnabled !== undefined && body.data.isEnabled !== row.isEnabled)
      changed.isEnabled = body.data.isEnabled
    if (changed.name !== undefined || changed.isEnabled !== undefined) {
      await db
        .update(aiRelayAccountPool)
        .set({ ...changed, updatedAt: new Date() })
        .where(eq(aiRelayAccountPool.id, row.id))
    }
    // 启用态联动签到侧(与 admin toggle 同一语义)
    const platform = checkinPlatformFor(row.providerCode)
    if (platform && changed.isEnabled !== undefined) {
      const nextState: PoolAccountState = changed.isEnabled ? 'enabled' : 'disabled'
      const push = await pushPoolState(
        platform,
        { poolAccountId: row.id, ownerUserId: userId, uid: row.uid },
        nextState,
      )
      if (!push.ok) {
        await markCheckinSyncPending([row.id], 'state', nextState, push.error ?? '未知错误')
      }
    }
    return reply.send(success({ id: row.id, ...body.data }))
  })

  // ===== 4. DELETE /api/account-pool/:id — 删除个人池账号 =====
  server.delete('/api/account-pool/:id', async (request, reply) => {
    const userId = requireUser(request, reply)
    if (!userId) return
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const deleted = await db
      .delete(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.id, p.data.id), eq(aiRelayAccountPool.ownerUserId, userId)))
      .returning({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
      })
    const removed = deleted[0]
    if (!removed) return reply.status(404).send(error(404, '账号不存在'))
    const platform = checkinPlatformFor(removed.providerCode)
    if (platform) {
      await pushPoolState(
        platform,
        { poolAccountId: removed.id, ownerUserId: userId, uid: removed.uid },
        'pool_deleted',
      ).catch(() => undefined)
    }
    return reply.send(success({ id: removed.id }))
  })

  // ===== 5. POST /api/account-pool/:id/checkin — 立即签到 =====
  server.post('/api/account-pool/:id/checkin', async (request, reply) => {
    const userId = requireUser(request, reply)
    if (!userId) return
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const [row] = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
      })
      .from(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.id, p.data.id), eq(aiRelayAccountPool.ownerUserId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '账号不存在'))
    const platform = checkinPlatformFor(row.providerCode)
    if (!platform) {
      return reply.status(400).send(error(400, `平台 ${row.providerCode} 无签到引擎`))
    }
    const r = await postPoolRun(platform, {
      poolAccountId: row.id,
      ownerUserId: userId,
      uid: row.uid,
    })
    if (r.ok) return reply.send(success({ record: r.record }))
    const status = r.httpStatus === 404 || r.httpStatus === 429 ? r.httpStatus : 502
    return reply.status(status).send(error(status, r.error ?? '触发签到失败'))
  })

  // ===== 6. GET /api/account-pool/:id/status — 签到状态点查 =====
  server.get('/api/account-pool/:id/status', async (request, reply) => {
    const userId = requireUser(request, reply)
    if (!userId) return
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, 'id 非法'))
    const [row] = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
      })
      .from(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.id, p.data.id), eq(aiRelayAccountPool.ownerUserId, userId)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '账号不存在'))
    const platform = checkinPlatformFor(row.providerCode)
    if (!platform) return reply.send(success({ found: false, noEngine: true }))
    return reply.send(
      success(await fetchPoolStatus(platform, { poolAccountId: row.id, uid: row.uid })),
    )
  })

  // ===== 7. GET /api/account-pool/summary — 个人池概览(移动端首页/角标) =====
  server.get('/api/account-pool/summary', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const [agg] = await dbRead
      .select({
        total: sql<number>`count(*)::int`,
        enabled: sql<number>`count(*) filter (where ${aiRelayAccountPool.isEnabled})::int`,
      })
      .from(aiRelayAccountPool)
      .where(and(eq(aiRelayAccountPool.ownerUserId, userId), isNotNull(aiRelayAccountPool.uid)))
    return reply.send(success({ total: agg?.total ?? 0, enabled: agg?.enabled ?? 0 }))
  })
}

// 刻意不用 fastify-plugin:本文件的 preHandler 必须留在插件作用域内,
// 否则会把登录校验提升为全局钩子,连 /api/internal/* 机器端点都被要求 JWT。
export default accountPoolRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
