import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { zhsOrganization } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const orgSchema = z.object({
  orgName: z.string().min(1).max(200),
  orgType: z.string().max(50).optional(),
  parentId: z.coerce.number().int().min(0).default(0),
  status: z.coerce.number().int().default(1),
})

const updateSchema = orgSchema.partial()

const zhsOrganizationRoutes: FastifyPluginAsync = async (server) => {
  // 列表(分页 + parentId/status 筛选)
  server.get('/', async (request, reply) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        parentId: z.coerce.number().int().optional(),
        status: z.coerce.number().int().optional(),
        keyword: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, parentId, status, keyword } = parsed.data
    const conditions = []
    if (parentId !== undefined) conditions.push(eq(zhsOrganization.parentId, parentId))
    if (status !== undefined) conditions.push(eq(zhsOrganization.status, status))
    if (keyword) conditions.push(sql`${zhsOrganization.orgName} ILIKE ${`%${keyword}%`}`)
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const offset = (page - 1) * pageSize
    const list = await db
      .select()
      .from(zhsOrganization)
      .where(where)
      .orderBy(desc(zhsOrganization.createdAt))
      .limit(pageSize)
      .offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsOrganization)
      .where(where)
    return reply.send(success({ list, total: total[0]?.count ?? 0, page, pageSize }))
  })

  // 树形结构(递归构建,最多 5 层)
  server.get('/tree', async (_request, reply) => {
    const all = await db
      .select()
      .from(zhsOrganization)
      .where(eq(zhsOrganization.status, 1))
      .orderBy(desc(zhsOrganization.createdAt))
    type OrgNode = (typeof all)[number] & { children: OrgNode[] }
    const buildTree = (parentId: number): OrgNode[] =>
      all.filter((o) => o.parentId === parentId).map((o) => ({ ...o, children: buildTree(o.id) }))
    const tree = buildTree(0)
    return reply.send(success({ tree }))
  })

  // 详情
  server.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const [org] = await db.select().from(zhsOrganization).where(eq(zhsOrganization.id, id)).limit(1)
    if (!org) return reply.status(404).send(error(404, '组织不存在'))
    return reply.send(success(org))
  })

  // 创建
  server.post('/', async (request, reply) => {
    const body = orgSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(zhsOrganization)
      .values({
        orgName: body.data.orgName,
        orgType: body.data.orgType,
        parentId: body.data.parentId,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success(created))
  })

  // 更新
  server.put('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const body = updateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [updated] = await db
      .update(zhsOrganization)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(zhsOrganization.id, id))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '组织不存在'))
    return reply.send(success(updated))
  })

  // 删除(检查子节点)
  server.delete('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const children = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsOrganization)
      .where(eq(zhsOrganization.parentId, id))
    if ((children[0]?.count ?? 0) > 0) {
      return reply.status(409).send(error(409, '存在子组织,无法删除'))
    }
    const [deleted] = await db.delete(zhsOrganization).where(eq(zhsOrganization.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '组织不存在'))
    return reply.send(success({ success: true }))
  })
}

// 管理员路由(添加 requireAdmin 钩子)
const adminZhsOrganizationRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.register(zhsOrganizationRoutes)
}

export { zhsOrganizationRoutes, adminZhsOrganizationRoutes }
