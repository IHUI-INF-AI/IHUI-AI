import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { carousels, aiGcContent } from '@ihui/database'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().min(1) })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

const createActivitySchema = z.object({
  title: z.string().min(1, '标题不能为空').max(255),
  description: z.string().max(5000).optional(),
  cover: z.string().max(512).optional(),
  content: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.number().int().min(0).max(2).optional(),
  sort: z.number().int().optional(),
})

const updateActivitySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  cover: z.string().max(512).optional(),
  content: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: z.number().int().min(0).max(2).optional(),
  sort: z.number().int().optional(),
})

const updateContactSchema = z.object({
  type: z.string().max(32).optional(),
  label: z.string().max(100).optional(),
  value: z.string().max(500).optional(),
  icon: z.string().max(255).optional(),
  sort: z.number().int().optional(),
  status: z.number().int().optional(),
})

const createAigcSchema = z.object({
  agentId: z.string().max(64).optional(),
  gcType: z.string().max(32).default('text'),
  content: z.string().optional(),
  status: z.number().int().optional(),
})

const updateBannerSchema = z.object({
  title: z.string().max(255).optional(),
  imageUrl: z.string().max(512).optional(),
  linkUrl: z.string().max(512).optional(),
  position: z.string().max(64).optional(),
  description: z.string().optional(),
  sort: z.number().int().optional(),
  status: z.number().int().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
})

// =============================================================================
// 路由
// =============================================================================

export const contentExtendedRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // activities — 活动管理（表 activities，尚未迁移为 Drizzle schema）
  // ==========================================================================

  // GET /content/activities/list - 活动列表
  server.get('/content/activities/list', async (request, reply) => {
    await authenticate(request)
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        status: z.string().optional(),
        keyword: z.string().optional(),
      })
      .parse(request.query)
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    if (q.keyword) conds.push(sql`"title" ILIKE ${`%${q.keyword}%`}`)
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT id, title, description, cover, content, start_time, end_time, status, sort, created_at, updated_at
            FROM activities
            ${where}
            ORDER BY "sort" ASC, "created_at" DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM activities ${where}`,
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
      return reply.status(500).send(error(500, '查询活动列表失败'))
    }
  })

  // POST /content/activities - 创建活动
  server.post('/content/activities', async (request, reply) => {
    await authenticate(request)
    const parsed = createActivitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { title, description, cover, content, startTime, endTime, status, sort } = parsed.data
    try {
      const rows = await db.execute(
        sql`INSERT INTO activities (title, description, cover, content, start_time, end_time, status, sort, created_at, updated_at)
            VALUES (${title}, ${description ?? null}, ${cover ?? null}, ${content ?? null},
                    ${startTime ?? null}, ${endTime ?? null}, ${status ?? 0}, ${sort ?? 0}, NOW(), NOW())
            RETURNING id, title, description, cover, content, start_time, end_time, status, sort, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建活动失败'))
    }
  })

  // PUT /content/activities/:id - 修改活动
  server.put('/content/activities/:id', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateActivitySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const body = parsed.data
    const sets: SQL[] = []
    if (body.title !== undefined) sets.push(sql`"title" = ${body.title}`)
    if (body.description !== undefined) sets.push(sql`"description" = ${body.description}`)
    if (body.cover !== undefined) sets.push(sql`"cover" = ${body.cover}`)
    if (body.content !== undefined) sets.push(sql`"content" = ${body.content}`)
    if (body.startTime !== undefined) sets.push(sql`"start_time" = ${body.startTime}`)
    if (body.endTime !== undefined) sets.push(sql`"end_time" = ${body.endTime}`)
    if (body.status !== undefined) sets.push(sql`"status" = ${body.status}`)
    if (body.sort !== undefined) sets.push(sql`"sort" = ${body.sort}`)
    if (sets.length === 0) return reply.status(400).send(error(400, '无更新字段'))
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`UPDATE activities
            SET ${sql.join(sets, sql`, `)}
            WHERE "id"::text = ${id}
            RETURNING id, title, description, cover, content, start_time, end_time, status, sort, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '活动不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新活动失败'))
    }
  })

  // DELETE /content/activities/:id - 删除活动
  server.delete('/content/activities/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db.execute(
        sql`DELETE FROM activities WHERE "id"::text = ${id} RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '活动不存在'))
      }
      return reply.send(success({ id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除活动失败'))
    }
  })

  // ==========================================================================
  // contacts — 联系方式管理（表 content_contacts，尚未迁移为 Drizzle schema）
  // ==========================================================================

  // GET /content/contacts/list - 联系方式列表
  server.get('/content/contacts/list', async (request, reply) => {
    await authenticate(request)
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT id, type, label, value, icon, sort, status, created_at, updated_at
            FROM content_contacts
            ${where}
            ORDER BY "sort" ASC, "id" ASC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM content_contacts ${where}`,
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
      return reply.status(500).send(error(500, '查询联系方式列表失败'))
    }
  })

  // PUT /content/contacts/:id - 修改联系方式
  server.put('/content/contacts/:id', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateContactSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const body = parsed.data
    const sets: SQL[] = []
    if (body.type !== undefined) sets.push(sql`"type" = ${body.type}`)
    if (body.label !== undefined) sets.push(sql`"label" = ${body.label}`)
    if (body.value !== undefined) sets.push(sql`"value" = ${body.value}`)
    if (body.icon !== undefined) sets.push(sql`"icon" = ${body.icon}`)
    if (body.sort !== undefined) sets.push(sql`"sort" = ${body.sort}`)
    if (body.status !== undefined) sets.push(sql`"status" = ${body.status}`)
    if (sets.length === 0) return reply.status(400).send(error(400, '无更新字段'))
    sets.push(sql`"updated_at" = NOW()`)
    try {
      const rows = await db.execute(
        sql`UPDATE content_contacts
            SET ${sql.join(sets, sql`, `)}
            WHERE "id"::text = ${id}
            RETURNING id, type, label, value, icon, sort, status, created_at, updated_at`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '联系方式不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新联系方式失败'))
    }
  })

  // ==========================================================================
  // file-storage — 文件存储管理（表 content_file_storage，尚未迁移为 Drizzle schema）
  // ==========================================================================

  // GET /content/file-storage/list - 文件存储列表
  server.get('/content/file-storage/list', async (request, reply) => {
    await authenticate(request)
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        type: z.string().optional(),
        userId: z.string().optional(),
      })
      .parse(request.query)
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds: SQL[] = []
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.userId) conds.push(sql`"user_id" = ${q.userId}`)
    const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, filename, original_name, file_path, file_url, file_size, mime_type, type, created_at
            FROM content_file_storage
            ${where}
            ORDER BY "created_at" DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM content_file_storage ${where}`,
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
      return reply.status(500).send(error(500, '查询文件存储列表失败'))
    }
  })

  // DELETE /content/file-storage/:id - 删除文件
  server.delete('/content/file-storage/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db.execute(
        sql`DELETE FROM content_file_storage WHERE "id"::text = ${id} RETURNING id, file_path, file_url`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '文件不存在'))
      return reply.send(success({ id, deleted: true, ...row }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除文件失败'))
    }
  })

  // ==========================================================================
  // aigc — AIGC 内容管理（使用 Drizzle schema: aiGcContent）
  // ==========================================================================

  // GET /content/aigc/list - AIGC 内容列表
  server.get('/content/aigc/list', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object(paginationQuery).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const offset = (page - 1) * pageSize
    try {
      const list = await db
        .select()
        .from(aiGcContent)
        .where(eq(aiGcContent.userUuid, request.userId!))
        .orderBy(desc(aiGcContent.createdAt))
        .limit(pageSize)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(eq(aiGcContent.userUuid, request.userId!))

      const total = countResult[0]?.count ?? 0
      return reply.send(
        success({
          list,
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 AIGC 内容列表失败'))
    }
  })

  // POST /content/aigc - 创建 AIGC 内容
  server.post('/content/aigc', async (request, reply) => {
    await authenticate(request)
    const parsed = createAigcSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { agentId, gcType, content, status } = parsed.data
    try {
      const [row] = await db
        .insert(aiGcContent)
        .values({
          userUuid: request.userId!,
          agentId: agentId ?? null,
          gcType: gcType ?? 'text',
          content: content ?? null,
          status: status ?? 1,
        })
        .returning()
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 AIGC 内容失败'))
    }
  })

  // ==========================================================================
  // banners — 横幅管理（使用 Drizzle schema: carousels）
  // ==========================================================================

  // GET /content/banners/list - 横幅列表
  server.get('/content/banners/list', async (request, reply) => {
    await authenticate(request)
    const q = z
      .object({
        page: z.string().optional(),
        pageSize: z.string().optional(),
        position: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conditions = []
    if (q.position) conditions.push(eq(carousels.position, q.position))
    if (q.status !== undefined) conditions.push(eq(carousels.status, Number(q.status)))
    try {
      const list = await db
        .select()
        .from(carousels)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(carousels.sort), desc(carousels.createdAt))
        .limit(pageSize)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(carousels)
        .where(conditions.length > 0 ? and(...conditions) : undefined)

      const total = countResult[0]?.count ?? 0
      return reply.send(
        success({
          list,
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询横幅列表失败'))
    }
  })

  // PUT /content/banners/:id - 修改横幅
  server.put('/content/banners/:id', async (request, reply) => {
    await authenticate(request)
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const parsed = updateBannerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = paramParsed.data
    const body = parsed.data
    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl
    if (body.linkUrl !== undefined) updateData.linkUrl = body.linkUrl
    if (body.position !== undefined) updateData.position = body.position
    if (body.description !== undefined) updateData.description = body.description
    if (body.sort !== undefined) updateData.sort = body.sort
    if (body.status !== undefined) updateData.status = body.status
    if (body.startAt !== undefined) updateData.startAt = new Date(body.startAt)
    if (body.endAt !== undefined) updateData.endAt = new Date(body.endAt)
    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send(error(400, '无更新字段'))
    }
    try {
      const [row] = await db
        .update(carousels)
        .set(updateData)
        .where(eq(carousels.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '横幅不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新横幅失败'))
    }
  })
}
