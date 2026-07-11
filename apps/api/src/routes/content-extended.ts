import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { zhsUserAgentImage } from '@ihui/database'
import { success, error } from '../utils/response.js'

const idParamSchema = z.object({ id: z.string().min(1) })

// =============================================================================
// 通用 raw SQL 辅助（适用于尚未迁移到 Drizzle schema 的旧表）
// =============================================================================

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

async function rawList(
  table: string,
  opts: { page: number; pageSize: number; conds?: SQL[]; orderBy?: string },
) {
  const where =
    opts.conds && opts.conds.length > 0 ? sql`WHERE ${sql.join(opts.conds, sql` AND `)}` : sql``
  const order = opts.orderBy ?? '"id" DESC'
  const offset = (opts.page - 1) * opts.pageSize
  const rows = await db.execute(
    sql`SELECT * FROM ${sql.raw(`"${table}"`)} ${where} ORDER BY ${sql.raw(order)} LIMIT ${opts.pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM ${sql.raw(`"${table}"`)} ${where}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: rows as Record<string, unknown>[],
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}

async function rawById(table: string, id: string) {
  const rows = await db.execute(
    sql`SELECT * FROM ${sql.raw(`"${table}"`)} WHERE "id"::text = ${id} LIMIT 1`,
  )
  return (rows as Record<string, unknown>[])[0]
}

async function rawInsert(table: string, columns: string[], body: Record<string, unknown>) {
  const cols: string[] = []
  const vals: unknown[] = []
  for (const c of columns) {
    if (body[c] !== undefined) {
      cols.push(c)
      vals.push(body[c])
    }
  }
  if (cols.length === 0) throw new Error('无可写入字段')
  const colList = sql.join(
    cols.map((c) => sql.raw(`"${c}"`)),
    sql`, `,
  )
  const valList = sql.join(
    vals.map((v) => sql`${v}`),
    sql`, `,
  )
  const rows = await db.execute(
    sql`INSERT INTO ${sql.raw(`"${table}"`)} (${colList}) VALUES (${valList}) RETURNING *`,
  )
  return (rows as Record<string, unknown>[])[0]
}

async function rawUpdate(
  table: string,
  columns: string[],
  id: string,
  body: Record<string, unknown>,
) {
  const sets: SQL[] = []
  for (const c of columns) {
    if (body[c] !== undefined) sets.push(sql`${sql.raw(`"${c}"`)} = ${body[c]}`)
  }
  if (sets.length === 0) return undefined
  const rows = await db.execute(
    sql`UPDATE ${sql.raw(`"${table}"`)} SET ${sql.join(sets, sql`, `)} WHERE "id"::text = ${id} RETURNING *`,
  )
  return (rows as Record<string, unknown>[])[0]
}

async function rawDelete(table: string, id: string) {
  await db.execute(sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE "id"::text = ${id}`)
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // advertise — 广告管理（表 advertise，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  // 广告位列表（静态路由须先于 /advertise/:id 注册）
  server.get('/advertise/position/list', async (_req, reply) => {
    try {
      const rows = await db.execute(
        sql`SELECT id, name, code, description, width, height FROM advertise_position WHERE status = 1 ORDER BY id ASC`,
      )
      return reply.send(success(rows as Record<string, unknown>[]))
    } catch (e) {
      _req.log.error(e)
      return reply.status(500).send(error(500, '查询广告位失败'))
    }
  })

  // 新增广告位
  server.post('/advertise/position', async (req, reply) => {
    const body = req.body as {
      name?: string
      code?: string
      description?: string
      width?: number
      height?: number
    }
    if (!body.name || !body.code) {
      return reply.status(400).send(error(400, 'name 和 code 不能为空'))
    }
    try {
      const rows = await db.execute(
        sql`INSERT INTO advertise_position (name, code, description, width, height, status) VALUES (${body.name}, ${body.code}, ${body.description ?? null}, ${body.width ?? 0}, ${body.height ?? 0}, 1) RETURNING id`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建广告位失败'))
    }
  })

  const advertiseCols = [
    'title',
    'image',
    'url',
    'position_id',
    'type',
    'content',
    'start_time',
    'end_time',
    'status',
    'sort_order',
    'click_num',
    'view_num',
    'target_user',
  ]
  server.get('/advertise/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      position_id?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.position_id) conds.push(sql`"position_id" = ${Number(q.position_id)}`)
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    try {
      const result = await rawList('advertise', {
        page,
        pageSize,
        conds,
        orderBy: '"sort_order" ASC, "id" DESC',
      })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询广告失败'))
    }
  })
  server.get('/advertise/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('advertise', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '广告不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询广告失败'))
    }
  })
  server.post('/advertise', async (req, reply) => {
    try {
      const row = await rawInsert('advertise', advertiseCols, req.body as Record<string, unknown>)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建广告失败'))
    }
  })
  server.put('/advertise/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'advertise',
        advertiseCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新广告失败'))
    }
  })
  server.delete('/advertise/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('advertise', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除广告失败'))
    }
  })

  // 广告点击记录（click_num + 1）
  server.post('/advertise/:id/click', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.execute(
        sql`UPDATE advertise SET click_num = click_num + 1 WHERE "id"::text = ${parsed.data.id} RETURNING id, click_num`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '广告不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '记录广告点击失败'))
    }
  })

  // -------------------------------------------------------------------------
  // video — 视频管理
  // NOTE: 旧架构 video.py 为基于文件/Redis 的 HLS 预读与转码，无独立 DB 表；
  // 视频管理尚未迁移，此处保持合理默认值。
  // -------------------------------------------------------------------------
  server.get('/video/list', async (_req, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/video/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id }))
  })
  server.post('/video', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }))
  })
  server.put('/video/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete('/video/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // -------------------------------------------------------------------------
  // video_preload — 视频预加载（表 video_preload，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const videoPreloadCols = [
    'user_id',
    'video_id',
    'video_url',
    'start_time',
    'end_time',
    'preload_size',
    'completed',
    'is_chunked',
  ]
  server.get('/video-preload/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      user_id?: string
      video_id?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.video_id) conds.push(sql`"video_id" = ${Number(q.video_id)}`)
    try {
      const result = await rawList('video_preload', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频预加载记录失败'))
    }
  })
  server.get('/video-preload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('video_preload', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '视频预加载记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频预加载记录失败'))
    }
  })
  server.post('/video-preload', async (req, reply) => {
    try {
      const row = await rawInsert(
        'video_preload',
        videoPreloadCols,
        req.body as Record<string, unknown>,
      )
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建视频预加载记录失败'))
    }
  })
  server.put('/video-preload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'video_preload',
        videoPreloadCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新视频预加载记录失败'))
    }
  })
  server.delete('/video-preload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('video_preload', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除视频预加载记录失败'))
    }
  })

  // -------------------------------------------------------------------------
  // user_video_comment — 视频评论追踪（表 user_video_comment，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const userVideoCommentCols = [
    'user_id',
    'user_name',
    'user_avatar',
    'video_id',
    'content',
    'pid',
    'reply_user_id',
    'reply_user_name',
    'like_num',
    'status',
  ]
  server.get('/user-video-comment/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      video_id?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.video_id) conds.push(sql`"video_id" = ${Number(q.video_id)}`)
    conds.push(sql`"status" = ${q.status !== undefined ? Number(q.status) : 1}`)
    try {
      const result = await rawList('user_video_comment', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频评论失败'))
    }
  })
  server.get('/user-video-comment/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('user_video_comment', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '视频评论不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频评论失败'))
    }
  })
  server.post('/user-video-comment', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('user_video_comment', userVideoCommentCols, body)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建视频评论失败'))
    }
  })
  server.put('/user-video-comment/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'user_video_comment',
        userVideoCommentCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新视频评论失败'))
    }
  })
  server.delete('/user-video-comment/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('user_video_comment', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除视频评论失败'))
    }
  })

  // -------------------------------------------------------------------------
  // user_video_log — 视频日志追踪（表 user_video_log，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const userVideoLogCols = [
    'user_id',
    'user_name',
    'video_id',
    'video_title',
    'duration',
    'watched',
    'progress',
    'device',
    'ip',
    'is_completed',
    'is_finished',
  ]
  server.get('/user-video-log/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      user_id?: string
      video_id?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.video_id) conds.push(sql`"video_id" = ${Number(q.video_id)}`)
    try {
      const result = await rawList('user_video_log', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频日志失败'))
    }
  })
  server.get('/user-video-log/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('user_video_log', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '视频日志不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频日志失败'))
    }
  })
  server.post('/user-video-log', async (req, reply) => {
    try {
      const row = await rawInsert(
        'user_video_log',
        userVideoLogCols,
        req.body as Record<string, unknown>,
      )
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建视频日志失败'))
    }
  })
  server.put('/user-video-log/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'user_video_log',
        userVideoLogCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新视频日志失败'))
    }
  })
  server.delete('/user-video-log/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('user_video_log', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除视频日志失败'))
    }
  })

  // -------------------------------------------------------------------------
  // user_agent_image — 用户 Agent 图片（Drizzle schema: zhs_user_agent_image）
  // -------------------------------------------------------------------------
  server.get('/user-agent-image/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      userUuid?: string
      userId?: string
      agentId?: string
      imageType?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds = []
    if (q.userUuid) conds.push(eq(zhsUserAgentImage.userUuid, q.userUuid))
    if (q.userId) conds.push(eq(zhsUserAgentImage.userId, q.userId))
    if (q.agentId) conds.push(eq(zhsUserAgentImage.agentId, q.agentId))
    if (q.imageType) conds.push(eq(zhsUserAgentImage.imageType, q.imageType))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(zhsUserAgentImage)
          .where(where)
          .orderBy(desc(zhsUserAgentImage.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(zhsUserAgentImage)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 图片失败'))
    }
  })
  server.get('/user-agent-image/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .select()
        .from(zhsUserAgentImage)
        .where(eq(zhsUserAgentImage.id, numId))
        .limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '图片记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 图片失败'))
    }
  })
  server.post('/user-agent-image', async (req, reply) => {
    try {
      const rows = await db
        .insert(zhsUserAgentImage)
        .values(req.body as typeof zhsUserAgentImage.$inferInsert)
        .returning()
      return reply.status(201).send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建用户 Agent 图片失败'))
    }
  })
  server.put('/user-agent-image/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .update(zhsUserAgentImage)
        .set(req.body as Partial<typeof zhsUserAgentImage.$inferInsert>)
        .where(eq(zhsUserAgentImage.id, numId))
        .returning()
      if (!rows[0]) return reply.status(404).send(error(404, '图片记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新用户 Agent 图片失败'))
    }
  })
  server.delete('/user-agent-image/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.delete(zhsUserAgentImage).where(eq(zhsUserAgentImage.id, numId))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除用户 Agent 图片失败'))
    }
  })
}

export default plugin
