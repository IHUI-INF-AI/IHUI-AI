/**
 * 开发者续费 API 路由
 *
 * D 盘源: coze_zhs_py/api/agent_developer.py
 * 路径前缀: /cozeZhsApi/agent-developer
 * G 盘 schema: zhsAgentDeveloper (packages/database/src/schema/zhs-full.ts:73-98)
 *
 * 端点 (1:1 迁移 D 盘):
 *  POST /cozeZhsApi/agent-developer/create            创建开发者续费记录
 *  GET  /cozeZhsApi/agent-developer/list              续费记录列表(分页+筛选)
 *  GET  /cozeZhsApi/agent-developer/:id                续费记录详情
 *  GET  /cozeZhsApi/agent-developer/order/:order_no   根据订单号查询
 *  POST /cozeZhsApi/agent-developer/generate-order-no 生成续费订单号(测试)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, asc, sql, and, like } from 'drizzle-orm'
import { db, dbRead, returningOne } from '../db/index.js'
import { zhsAgentDeveloper } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

const PREFIX = '/cozeZhsApi/agent-developer'

// ==================== Zod schemas ====================

const createDeveloperSchema = z.object({
  uuid: z.string().min(1, 'uuid 必填').max(36),
  user_name: z.string().max(128).optional(),
  creator_id: z.string().max(128).optional(),
  creator_name: z.string().max(128).optional(),
  type: z.string().refine((v) => ['0', '1'].includes(v), 'type 必须是 0=月 或 1=年'),
  count: z.number().int().min(1, 'count 必须 >= 1'),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  uuid: z.string().optional(),
  user_name: z.string().optional(),
  creator_id: z.string().optional(),
  type: z.string().optional(),
  order_no: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_by: z.string().default('bugTime'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

// ==================== Helpers ====================

function genOrderNo(): string {
  const now = new Date()
  const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  // 6 位自增随机数(测试场景下不保证唯一,生产应使用序列)
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `WXK${yyyymmdd}${rand}`
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ==================== Routes ====================

export const agentDeveloperRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(sc).send(error(sc, (e as Error).message || 'Authentication required'))
    }
  })

  // 1. POST /cozeZhsApi/agent-developer/create
  server.post(`${PREFIX}/create`, async (request, reply) => {
    try {
      const parsed = createDeveloperSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { uuid, user_name, creator_id, creator_name, type, count } = parsed.data
      const bugTime = new Date()
      const days = type === '0' ? 30 * count : 365 * count
      const expirationDate = new Date(bugTime.getTime() + days * 24 * 60 * 60 * 1000)
      const orderNo = genOrderNo()

      const created = await returningOne(
        db
          .insert(zhsAgentDeveloper)
          .values({
            agentId: uuid, // D 盘: agentDeveloper.agent_id 默认等于 uuid
            userId: creator_id ?? uuid,
            uuid,
            userName: user_name ?? null,
            creatorId: creator_id ?? null,
            creatorName: creator_name ?? null,
            bugTime,
            orderNo,
            status: 1,
            type,
            count,
            expirationDate,
          })
          .returning(),
        '创建续费记录失败',
      )

      return reply.send(
        success({
          id: created.id,
          uuid: created.uuid,
          order_no: created.orderNo,
          type: created.type,
          count: created.count,
          expiration_date: toIsoOrNull(created.expirationDate),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. GET /cozeZhsApi/agent-developer/list
  server.get(`${PREFIX}/list`, async (request, reply) => {
    try {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const q = parsed.data
      const conds: ReturnType<typeof eq>[] = []
      if (q.uuid) conds.push(eq(zhsAgentDeveloper.uuid, q.uuid))
      if (q.user_name) conds.push(like(zhsAgentDeveloper.userName, `%${q.user_name}%`))
      if (q.creator_id) conds.push(eq(zhsAgentDeveloper.creatorId, q.creator_id))
      if (q.type) conds.push(eq(zhsAgentDeveloper.type, q.type))
      if (q.order_no) conds.push(eq(zhsAgentDeveloper.orderNo, q.order_no))
      if (q.start_date) {
        const d = new Date(q.start_date)
        if (!Number.isNaN(d.getTime())) conds.push(sql`${zhsAgentDeveloper.bugTime} >= ${d}`)
      }
      if (q.end_date) {
        const d = new Date(q.end_date)
        if (!Number.isNaN(d.getTime())) conds.push(sql`${zhsAgentDeveloper.bugTime} <= ${d}`)
      }
      const where = conds.length > 0 ? and(...conds) : undefined

      const countRows = (await dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsAgentDeveloper)
        .where(where)) as Array<{ count: number }>
      const count = countRows[0]?.count ?? 0

      const orderCol = (zhsAgentDeveloper as unknown as Record<string, unknown>)[q.sort_by] as
        Parameters<typeof asc>[0] | undefined
      const orderFn = q.sort_order === 'asc' ? asc : desc
      const orderBy = orderCol ? orderFn(orderCol) : desc(zhsAgentDeveloper.bugTime)

      const rows = await dbRead
        .select()
        .from(zhsAgentDeveloper)
        .where(where)
        .orderBy(orderBy)
        .limit(q.page_size)
        .offset((q.page - 1) * q.page_size)

      return reply.send(
        success({
          list: rows.map((r) => ({
            id: r.id,
            uuid: r.uuid,
            user_name: r.userName,
            creator_id: r.creatorId,
            creator_name: r.creatorName,
            type: r.type,
            count: r.count,
            order_no: r.orderNo,
            status: r.status,
            bug_time: toIsoOrNull(r.bugTime),
            expiration_date: toIsoOrNull(r.expirationDate),
          })),
          total: Number(count),
          page: q.page,
          page_size: q.page_size,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 3. GET /cozeZhsApi/agent-developer/:id
  server.get(`${PREFIX}/:id`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const idNum = Number(id)
      if (!Number.isInteger(idNum)) {
        return reply.status(400).send(error(400, 'id 必须是整数'))
      }
      const [row] = await dbRead
        .select()
        .from(zhsAgentDeveloper)
        .where(eq(zhsAgentDeveloper.id, idNum))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '续费记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 4. GET /cozeZhsApi/agent-developer/order/:order_no
  server.get(`${PREFIX}/order/:order_no`, async (request, reply) => {
    try {
      const { order_no } = request.params as { order_no: string }
      // 订单号格式: WXK + 8位日期 + 6位数字
      if (!/^WXK\d{8}\d{6}$/.test(order_no)) {
        return reply.status(400).send(error(400, '订单号格式不正确'))
      }
      const [row] = await dbRead
        .select()
        .from(zhsAgentDeveloper)
        .where(eq(zhsAgentDeveloper.orderNo, order_no))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '订单不存在'))
      return reply.send(success(row))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 5. POST /cozeZhsApi/agent-developer/generate-order-no
  server.post(`${PREFIX}/generate-order-no`, async (_request, reply) => {
    try {
      const orderNo = genOrderNo()
      return reply.send(
        success({
          order_no: orderNo,
          format: 'WXK + 年月日 + 6位数自增',
          example: 'WXK20250811000001',
          generated_at: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })
}

export default agentDeveloperRoutes
