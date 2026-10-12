// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { zhsDemandSquare } from '@ihui/database'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db } from '../db/index.js'

// =============================================================================
// 查询参数
// =============================================================================

const queryArray = z
  .string()
  .optional()
  .transform((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v))
  .pipe(z.array(z.string().max(50)).max(20).optional())

// zod 4 的默认 message 是英文原文,而 error(400, issues[0].message) 会把它原样当
// 用户可见文案(G-1105302,广场首屏 400 取证顺带量到)⇒ 每个约束显式给中文 message,
// 与全仓 schema 惯例同形(message 跟着字段走,不做集中映射)。
const plazaListQuerySchema = z.object({
  status: z.string().max(20, 'status 过长').optional(),
  taskStatus: z.string().max(20, 'taskStatus 过长').optional(),
  search: z.string().max(200, '搜索词过长').optional(),
  creator: z.string().max(64, 'creator 过长').optional(),
  types: queryArray,
  categories: queryArray,
  page: z.coerce.number().int('page 必须是整数').min(1, 'page 至少为 1').default(1),
  pageSize: z.coerce
    .number()
    .int('pageSize 必须是整数')
    .min(1, 'pageSize 至少为 1')
    .max(100, 'pageSize 最多为 100')
    .default(20),
})

const createPlazaSchema = z.object({
  title: z.string().trim().min(2, '标题至少 2 个字').max(200, '标题最多 200 字'),
  description: z
    .string()
    .trim()
    .min(10, '描述至少 10 个字')
    .max(10000, '描述最多 10000 字'),
  lowestPrice: z.number().positive('价格必须大于 0').optional(),
  peakPrice: z.number().positive('价格必须大于 0').optional(),
  contact: z.string().trim().max(200, '联系方式最多 200 字').optional(),
  cycle: z.string().trim().max(50, '周期最多 50 字').optional(),
  cycleUnit: z.string().trim().max(20, '周期单位最多 20 字').optional(),
  closingTime: z.iso.datetime('截止时间格式不正确').optional(),
  types: z.array(z.string().max(50, '单个类型最多 50 字')).max(20, '类型最多 20 个').optional(),
  categories: z.array(z.string().max(50, '单个分类最多 50 字')).max(20, '分类最多 20 个').optional(),
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
    const { status, taskStatus, search, creator, types, categories, page, pageSize } = parsed.data
    const conditions = [inArray(zhsDemandSquare.status, ['approved', 'featured'])]
    if (status && (status === 'approved' || status === 'featured')) {
      conditions.push(eq(zhsDemandSquare.status, status))
    }
    if (taskStatus) conditions.push(eq(zhsDemandSquare.taskStatus, taskStatus))
    if (creator) conditions.push(eq(zhsDemandSquare.userId, creator))
    if (types?.length) {
      conditions.push(
        sql`${zhsDemandSquare.types} ?| array[${sql.join(
          types.map((value) => sql`${value}`),
          sql`, `,
        )}]`,
      )
    }
    if (categories?.length) {
      conditions.push(
        sql`${zhsDemandSquare.categories} ?| array[${sql.join(
          categories.map((value) => sql`${value}`),
          sql`, `,
        )}]`,
      )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
