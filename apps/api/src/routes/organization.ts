import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().min(1) })

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

const createOrgSchema = z.object({
  name: z.string().min(1, '组织名称不能为空').max(200),
  description: z.string().max(2000).optional(),
  logo: z.string().max(512).optional(),
  parentId: z.string().optional(),
  status: z.number().int().min(0).max(1).optional(),
  sort: z.number().int().optional(),
})

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  logo: z.string().max(512).optional(),
  parentId: z.string().optional(),
  status: z.number().int().min(0).max(1).optional(),
  sort: z.number().int().optional(),
})

const addMemberSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
  role: z.string().max(64).default('member'),
  title: z.string().max(100).optional(),
  department: z.string().max(200).optional(),
})

const updateMemberRoleSchema = z.object({
  role: z.string().min(1, '角色不能为空').max(64),
  title: z.string().max(100).optional(),
  department: z.string().max(200).optional(),
})

// =============================================================================
// 路由
// =============================================================================

export const organizationRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET /organizations/list - 组织列表
  // -------------------------------------------------------------------------
  server.get('/organizations/list', async (request, reply) => {
    await authenticate(request)
    const q = request.query as {
      page?: string
      pageSize?: string
      keyword?: string
      status?: string
      parentId?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (q.keyword) conds.push(sql`o."name" ILIKE ${`%${q.keyword}%`}`)
    if (q.status !== undefined) conds.push(sql`o."status" = ${Number(q.status)}`)
    if (q.parentId) conds.push(sql`o."parent_id"::text = ${q.parentId}`)
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT o.id, o.name, o.description, o.logo, o.parent_id, o.status, o.sort,
                   o.created_at, o.updated_at,
                   (SELECT count(*)::int FROM organization_members om WHERE om.org_id::text = o.id::text) AS member_count
            FROM organizations o
            ${where}
            ORDER BY o."sort" ASC, o."created_at" DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM organizations o ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询组织列表失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /organizations - 创建组织
  // -------------------------------------------------------------------------
  server.post('/organizations', async (request, reply) => {
    await authenticate(request)
    const parsed = createOrgSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, description, logo, parentId, status, sort } = parsed.data
    try {
      const rows = await db.execute(
        sql`INSERT INTO organizations (name, description, logo, parent_id, status, sort, created_by, created_at, updated_at)
            VALUES (${name}, ${description ?? null}, ${logo ?? null},
                    ${parentId ?? null}, ${status ?? 1}, ${sort ?? 0},
                    ${request.userId!}, NOW(), NOW())
            RETURNING id, name, description, logo, parent_id, status, sort, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) {
        return reply.status(500).send(error(500, '创建组织失败'))
      }
      // 创建者自动成为组织 owner
      await db.execute(
        sql`INSERT INTO organization_members (org_id, user_id, role, status, joined_at, created_at, updated_at)
            VALUES (${row.id}, ${request.userId!}, 'owner', 1, NOW(), NOW(), NOW())`,
      )
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建组织失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /organizations/:id - 修改组织
  // -------------------------------------------------------------------------
  server.put('/organizations/:id', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateOrgSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const body = parsed.data
    const sets: SQL[] = []
    if (body.name !== undefined) sets.push(sql`"name" = ${body.name}`)
    if (body.description !== undefined) sets.push(sql`"description" = ${body.description}`)
    if (body.logo !== undefined) sets.push(sql`"logo" = ${body.logo}`)
    if (body.parentId !== undefined) sets.push(sql`"parent_id" = ${body.parentId}`)
    if (body.status !== undefined) sets.push(sql`"status" = ${body.status}`)
    if (body.sort !== undefined) sets.push(sql`"sort" = ${body.sort}`)
    if (sets.length === 0) return reply.status(400).send(error(400, '无更新字段'))
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`UPDATE organizations
            SET ${sql.join(sets, sql`, `)}
            WHERE "id"::text = ${id}
            RETURNING id, name, description, logo, parent_id, status, sort, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '组织不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新组织失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /organizations/:id - 删除组织
  // -------------------------------------------------------------------------
  server.delete('/organizations/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      // 先删除组织成员
      await db.execute(sql`DELETE FROM organization_members WHERE org_id::text = ${id}`)
      // 再删除组织
      const rows = await db.execute(
        sql`DELETE FROM organizations WHERE "id"::text = ${id} RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '组织不存在'))
      }
      return reply.send(success({ id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除组织失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /organizations/:id/members - 组织成员列表
  // -------------------------------------------------------------------------
  server.get('/organizations/:id/members', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = paramParsed.data
    const q = request.query as {
      page?: string
      pageSize?: string
      role?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = [sql`om."org_id"::text = ${id}`]
    if (q.role) conds.push(sql`om."role" = ${q.role}`)
    if (q.status !== undefined) conds.push(sql`om."status" = ${Number(q.status)}`)
    const where = sql`WHERE ${sql.join(conds, sql` AND `)}`
    try {
      const rows = await db.execute(
        sql`SELECT om.id, om.org_id, om.user_id, om.role, om.title, om.department, om.status,
                   om.joined_at, om.created_at, om.updated_at,
                   u.username, u.nickname, u.avatar, u.email, u.phone
            FROM organization_members om
            LEFT JOIN users u ON u.id::text = om.user_id::text
            ${where}
            ORDER BY om."joined_at" DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM organization_members om ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询组织成员列表失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /organizations/:id/members - 添加成员
  // -------------------------------------------------------------------------
  server.post('/organizations/:id/members', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的组织 ID'))
    }
    const parsed = addMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const { userId, role, title, department } = parsed.data
    try {
      // 检查组织是否存在
      const orgRows = await db.execute(
        sql`SELECT id FROM organizations WHERE "id"::text = ${id} LIMIT 1`,
      )
      if ((orgRows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '组织不存在'))
      }
      // 检查是否已是成员
      const existing = await db.execute(
        sql`SELECT id FROM organization_members
            WHERE org_id::text = ${id} AND user_id::text = ${userId} LIMIT 1`,
      )
      if ((existing as Record<string, unknown>[]).length > 0) {
        return reply.status(409).send(error(409, '该用户已是组织成员'))
      }
      const rows = await db.execute(
        sql`INSERT INTO organization_members (org_id, user_id, role, title, department, status, joined_at, created_at, updated_at)
            VALUES (${id}, ${userId}, ${role}, ${title ?? null}, ${department ?? null}, 1, NOW(), NOW(), NOW())
            RETURNING id, org_id, user_id, role, title, department, status, joined_at, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '添加成员失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /organizations/:id/members/:userId - 移除成员
  // -------------------------------------------------------------------------
  server.delete('/organizations/:id/members/:userId', async (request, reply) => {
    await authenticate(request)
    const params = request.params as { id: string; userId: string }
    if (!params.id || !params.userId) {
      return reply.status(400).send(error(400, '组织 ID 和用户 ID 不能为空'))
    }
    try {
      const rows = await db.execute(
        sql`DELETE FROM organization_members
            WHERE org_id::text = ${params.id} AND user_id::text = ${params.userId}
            RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '成员不存在'))
      }
      return reply.send(success({ userId: params.userId, removed: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '移除成员失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /organizations/:id/tree - 组织架构树
  // -------------------------------------------------------------------------
  server.get('/organizations/:id/tree', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = paramParsed.data
    try {
      // 递归查询子组织（使用 WITH RECURSIVE）
      const rows = await db.execute(
        sql`WITH RECURSIVE org_tree AS (
              SELECT id, name, description, logo, parent_id, status, sort, 0 AS depth
              FROM organizations
              WHERE "id"::text = ${id}
              UNION ALL
              SELECT o.id, o.name, o.description, o.logo, o.parent_id, o.status, o.sort, ot.depth + 1
              FROM organizations o
              INNER JOIN org_tree ot ON o.parent_id::text = ot.id::text
            )
            SELECT ot.id, ot.name, ot.description, ot.logo, ot.parent_id, ot.status, ot.sort, ot.depth,
                   (SELECT count(*)::int FROM organization_members om WHERE om.org_id::text = ot.id::text) AS member_count
            FROM org_tree ot
            ORDER BY ot.depth ASC, ot.sort ASC, ot.name ASC`,
      )
      const tree = rows as Record<string, unknown>[]
      if (tree.length === 0) {
        return reply.status(404).send(error(404, '组织不存在'))
      }
      // 构建树形结构
      const nodeMap = new Map<string, Record<string, unknown>>()
      for (const node of tree) {
        nodeMap.set(node.id as string, { ...node, children: [] })
      }
      let rootNode: Record<string, unknown> | null = null
      for (const node of tree) {
        const tree_node = nodeMap.get(node.id as string)!
        if (node.parent_id && nodeMap.has(node.parent_id as string)) {
          ;(nodeMap.get(node.parent_id as string)!.children as Record<string, unknown>[]).push(
            tree_node,
          )
        } else if (rootNode === null) {
          rootNode = tree_node
        }
      }
      return reply.send(success(rootNode ?? tree[0]))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询组织架构树失败'))
    }
  })

  // -------------------------------------------------------------------------
  // PUT /organizations/:id/members/:userId/role - 修改成员角色
  // -------------------------------------------------------------------------
  server.put('/organizations/:id/members/:userId/role', async (request, reply) => {
    await authenticate(request)
    const params = request.params as { id: string; userId: string }
    if (!params.id || !params.userId) {
      return reply.status(400).send(error(400, '组织 ID 和用户 ID 不能为空'))
    }
    const parsed = updateMemberRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { role, title, department } = parsed.data
    const sets: SQL[] = [sql`"role" = ${role}`]
    if (title !== undefined) sets.push(sql`"title" = ${title}`)
    if (department !== undefined) sets.push(sql`"department" = ${department}`)
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`UPDATE organization_members
            SET ${sql.join(sets, sql`, `)}
            WHERE org_id::text = ${params.id} AND user_id::text = ${params.userId}
            RETURNING id, org_id, user_id, role, title, department, status, joined_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '成员不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '修改成员角色失败'))
    }
  })
}
