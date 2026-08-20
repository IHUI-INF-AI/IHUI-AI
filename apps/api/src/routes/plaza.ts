import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { zhsDemandSquare } from '@ihui/database'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'

// =============================================================================
// 查询参数
// =============================================================================

const queryArray = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
  z.array(z.string().max(50)).max(20).optional(),
)

const plazaListQuerySchema = z.object({
  status: z.string().max(20).optional(),
  search: z.string().max(200).optional(),
  creator: z.string().max(64).optional(),
  types: queryArray,
  categories: queryArray,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createPlazaSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(10000),
  lowestPrice: z.number().positive().optional(),
  peakPrice: z.number().positive().optional(),
  contact: z.string().trim().max(200).optional(),
  cycle: z.string().trim().max(50).optional(),
  cycleUnit: z.string().trim().max(20).optional(),
  closingTime: z.iso.datetime().optional(),
  types: z.array(z.string().max(50)).max(20).optional(),
  categories: z.array(z.string().max(50)).max(20).optional(),
})

// =============================================================================
// 需求广场路由（挂载于 /api/plaza）
// =============================================================================

export const plazaRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /list - 广场智能体列表
  server.get('/list', async (request, reply) => {
    const parsed = plazaListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { status, search, creator, types, categories, page, pageSize } = parsed.data
    const conditions = []
    if (status) conditions.push(eq(zhsDemandSquare.status, status))
    if (creator) conditions.push(eq(zhsDemandSquare.userId, creator))
    if (types?.length) {
      conditions.push(sql`${zhsDemandSquare.types} ?| array[${sql.join(types.map((value) => sql`${value}`), sql`, `)}]`)
    }
    if (categories?.length) {
      conditions.push(sql`${zhsDemandSquare.categories} ?| array[${sql.join(categories.map((value) => sql`${value}`), sql`, `)}]`)
    }
    if (search) {
      const keyword = `%${search}%`
      conditions.push(
        sql`(${ilike(zhsDemandSquare.title, keyword)} OR ${ilike(zhsDemandSquare.description, keyword)})`,
      )
    }
    const where = conditions.length ? and(...conditions) : undefined
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(zhsDemandSquare)
        .where(where)
        .orderBy(desc(zhsDemandSquare.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsDemandSquare)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  server.post('/', async (request, reply) => {
    const parsed = createPlazaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data
    if (
      input.lowestPrice !== undefined &&
      input.peakPrice !== undefined &&
      input.lowestPrice > input.peakPrice
    ) {
      return reply.status(400).send(error(400, '起步价不能高于最高价'))
    }
    const [created] = await db
      .insert(zhsDemandSquare)
      .values({
        userId: request.userId!,
        type: input.types?.[0] ?? 'general',
        title: input.title,
        description: input.description,
        lowestPrice: input.lowestPrice?.toFixed(2),
        peakPrice: input.peakPrice?.toFixed(2),
        contact: input.contact,
        cycle: input.cycle,
        cycleUnit: input.cycleUnit,
        closingTime: input.closingTime ? new Date(input.closingTime) : undefined,
        types: input.types,
        categories: input.categories,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '发布需求失败'))
    return reply.status(201).send(success(created))
  })

  server.get('/:id', async (request, reply) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的广场条目 ID'))
    const [item] = await db
      .select()
      .from(zhsDemandSquare)
      .where(eq(zhsDemandSquare.id, parsed.data.id))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '广场条目不存在'))
    return reply.send(success(item))
  })
}
