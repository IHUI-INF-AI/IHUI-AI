// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userAgentFreeTimes } from '@ihui/database'
import { requireAdmin, requireAuth, isSystemAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const freeTimesSchema = z.object({
  userUuid: z.string().min(1).max(64),
  agentId: z.string().min(1).max(64),
  freeTimes: z.number().int().min(0).default(0),
})

/**
 * 归属主体判定(AGENTS §5「认证不等于授权」「身份不得住客户端可整写字段」)。
 *
 * 立因:本插件被挂在两处 —— `/api/admin/agent-free-times`(经 adminUserAgentFreeTimesRoutes
 * 包一层 requireAdmin,并由 onRoute 注入内网+mTLS)与 **`/api/agent-free-times`(裸挂载,
 * 零鉴权)**。后者使五个端点全部匿名可达:GET / 翻全员配额、POST / 给任意 userUuid 自助发放
 * 次数、POST /consume 烧别人次数、POST /reset 空 body 时 where 退化成 sql`TRUE` ⇒ **清零整表
 * 并把全表记录逐条返回给匿名调用方**、DELETE /:id 删任意行。
 * 全仓(web / miniapp / RN / ai-service / api-client)对 `/api/agent-free-times` 零调用方。
 *
 * 口径:管理员(只认人用 JWT,与 admin 面同一档位)可按 userUuid 代操作 —— 那是 admin 挂载的
 * 既有语义,必须逐字保持不变;其余主体一律用令牌身份,客户端参数不参与主体选择。
 */
function subjectOf(request: FastifyRequest, clientSupplied?: string): string {
  if (isSystemAdmin(request, { includeInternalChannel: false }))
    return clientSupplied || (request.userId as string)
  return request.userId as string
}

const userAgentFreeTimesRoutes: FastifyPluginAsync = async (server) => {
  // 五个端点一律先过鉴权(此前匿名可达 = 本票根因);发放/删除两档另加管理员闸门。
  server.addHook('preHandler', requireAuth)
  const ADMIN_ONLY = { preHandler: [requireAdmin] }
  // 列表(分页 + userUuid/agentId 筛选)
  server.get('/', async (request, reply) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        userUuid: z.string().optional(),
        agentId: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, agentId } = parsed.data
    // 档位分离(不是 ?? 链):管理员不传 userUuid = 看全员,那是 admin 挂载的既有语义;
    // 其余主体的过滤条件恒等于自己的令牌身份,客户端参数不参与。
    const isAdmin = isSystemAdmin(request, { includeInternalChannel: false })
    const userUuid = isAdmin ? parsed.data.userUuid : (request.userId as string)
    const conditions = []
    if (userUuid) conditions.push(eq(userAgentFreeTimes.userUuid, userUuid))
    if (agentId) conditions.push(eq(userAgentFreeTimes.agentId, agentId))
    // requireAuth 已在 preHandler 钉住身份 ⇒ 非管理员这一支恒有过滤,退化成全表的
    // 只剩"管理员主动不填"这一种刻意语义。
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const offset = (page - 1) * pageSize
    const list = await db
      .select()
      .from(userAgentFreeTimes)
      .where(where)
      .orderBy(desc(userAgentFreeTimes.createdAt))
      .limit(pageSize)
      .offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAgentFreeTimes)
      .where(where)
    return reply.send(success({ list, total: total[0]?.count ?? 0, page, pageSize }))
  })

  // 查询当前用户某 agent 的剩余免费次数(upsert 语义)
  server.get('/remaining', async (request, reply) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.query)
    const userUuid = subjectOf(request, (request.query as { userUuid?: string }).userUuid)
    const [record] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(eq(userAgentFreeTimes.userUuid, userUuid), eq(userAgentFreeTimes.agentId, agentId)),
      )
      .limit(1)
    if (!record) {
      return reply.send(success({ freeTimes: 0, usedTimes: 0, remaining: 0, lastResetAt: null }))
    }
    return reply.send(
      success({
        freeTimes: record.freeTimes,
        usedTimes: record.usedTimes,
        remaining: Math.max(0, record.freeTimes - record.usedTimes),
        lastResetAt: record.lastResetAt,
      }),
    )
  })

  // 设置/更新免费次数(upsert)—— 这是"发放额度",普通登录主体不得自助加额,管理员能力
  server.post('/', ADMIN_ONLY, async (request, reply) => {
    const body = freeTimesSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(
          eq(userAgentFreeTimes.userUuid, body.data.userUuid),
          eq(userAgentFreeTimes.agentId, body.data.agentId),
        ),
      )
      .limit(1)
    if (existing) {
      const [updated] = await db
        .update(userAgentFreeTimes)
        .set({ freeTimes: body.data.freeTimes, updatedAt: new Date() })
        .where(eq(userAgentFreeTimes.id, existing.id))
        .returning()
      return reply.send(success(updated))
    }
    const [created] = await db
      .insert(userAgentFreeTimes)
      .values({
        userUuid: body.data.userUuid,
        agentId: body.data.agentId,
        freeTimes: body.data.freeTimes,
      })
      .returning()
    return reply.status(201).send(success(created))
  })

  // 消耗一次免费次数(原子操作,返回剩余)
  server.post('/consume', async (request, reply) => {
    const body = z
      .object({ userUuid: z.string().optional(), agentId: z.string() })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userUuid = subjectOf(request, body.data.userUuid)
    const [record] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(and(eq(userAgentFreeTimes.userUuid, userUuid), eq(userAgentFreeTimes.agentId, body.data.agentId)))
      .limit(1)
    if (!record) {
      return reply.status(404).send(error(404, '免费次数记录不存在'))
    }
    // 扣减走单条条件 UPDATE:余量判定与自增落在同一条语句里,并发两笔不会都读到同一个
    // usedTimes(旧实现"先读后写",注释却自称原子操作 ⇒ 并发下少计次数、免费额度被白刷)。
    // .returning() 给出实际影响行:空集即"这一笔没扣上"(额度不足或被抢先),据此回 409,
    // 不把请求侧读数当成已扣(§批量写计数诚实性同口径)。
    const [updated] = await db
      .update(userAgentFreeTimes)
      .set({ usedTimes: sql`${userAgentFreeTimes.usedTimes} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(userAgentFreeTimes.id, record.id),
          sql`${userAgentFreeTimes.usedTimes} < ${userAgentFreeTimes.freeTimes}`,
        ),
      )
      .returning()
    if (!updated) return reply.status(409).send(error(409, '免费次数已用完'))
    return reply.send(
      success({
        consumed: true,
        remaining: Math.max(0, updated.freeTimes - updated.usedTimes),
        record: updated,
      }),
    )
  })

  // 重置已用次数(管理员/定时任务调用)
  server.post('/reset', async (request, reply) => {
    const body = z
      .object({
        userUuid: z.string().optional(),
        agentId: z.string().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const conditions = []
    // 档位分离:管理员不填 userUuid = 整表重置(头注写明的"定时任务/管理员"那一档,
    // 经 /api/admin 前缀时另受内网+mTLS 约束);其余主体恒被钉到自己那一行 ——
    // 匿名/普通用户拿到 sql`TRUE` 那一支,就是"空 body 清零整表"的成因。
    const isAdmin = isSystemAdmin(request, { includeInternalChannel: false })
    const resetUserUuid = isAdmin ? body.data.userUuid : (request.userId as string)
    if (resetUserUuid) conditions.push(eq(userAgentFreeTimes.userUuid, resetUserUuid))
    if (body.data.agentId) conditions.push(eq(userAgentFreeTimes.agentId, body.data.agentId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const result = await db
      .update(userAgentFreeTimes)
      .set({ usedTimes: 0, lastResetAt: new Date(), updatedAt: new Date() })
      .where(where)
      .returning()
    return reply.send(success({ reset: result.length, records: result }))
  })

  // 删除记录 —— 删任意行属管理员能力(普通主体无"按 id 删他人配额行"的合法用途)
  server.delete('/:id', ADMIN_ONLY, async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const [deleted] = await db
      .delete(userAgentFreeTimes)
      .where(eq(userAgentFreeTimes.id, id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success({ success: true }))
  })
}

// 管理员路由
const adminUserAgentFreeTimesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.register(userAgentFreeTimesRoutes)
}

export { userAgentFreeTimesRoutes, adminUserAgentFreeTimesRoutes }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
