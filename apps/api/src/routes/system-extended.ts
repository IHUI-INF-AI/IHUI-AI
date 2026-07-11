import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, asc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { aibotSites } from '@ihui/database'
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
  // category_dictionary — 分类字典管理（表 zhs_category_dictionary）
  // 旧逻辑：列表仅返回 is_show=true，按 sort_order 升序
  // -------------------------------------------------------------------------
  const categoryDictCols = [
    'dict_type',
    'code',
    'label',
    'value',
    'sort_order',
    'is_show',
    'description',
    'parent_id',
    'extra',
  ]
  server.get('/category-dictionary/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      dict_type?: string
      showAll?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.dict_type) conds.push(sql`"dict_type" = ${q.dict_type}`)
    if (q.showAll !== '1' && q.showAll !== 'true') conds.push(sql`"is_show" = true`)
    try {
      const result = await rawList('zhs_category_dictionary', {
        page,
        pageSize,
        conds,
        orderBy: '"sort_order" ASC, "id" ASC',
      })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询分类字典失败'))
    }
  })
  server.get('/category-dictionary/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_category_dictionary', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '字典项不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询分类字典失败'))
    }
  })
  server.post('/category-dictionary', async (req, reply) => {
    try {
      const row = await rawInsert(
        'zhs_category_dictionary',
        categoryDictCols,
        req.body as Record<string, unknown>,
      )
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建字典项失败'))
    }
  })
  server.put('/category-dictionary/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_category_dictionary',
        categoryDictCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新字典项失败'))
    }
  })
  server.delete('/category-dictionary/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('zhs_category_dictionary', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除字典项失败'))
    }
  })

  // -------------------------------------------------------------------------
  // bot_sites — Bot 站点配置（Drizzle schema: aibot_sites）
  // -------------------------------------------------------------------------
  server.get('/bot-sites/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      section?: string
      subSection?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.section) conds.push(eq(aibotSites.section, q.section))
    if (q.subSection) conds.push(eq(aibotSites.subSection, q.subSection))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(aibotSites)
          .where(where)
          .orderBy(asc(aibotSites.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(aibotSites)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询 Bot 站点失败'))
    }
  })
  server.get('/bot-sites/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.select().from(aibotSites).where(eq(aibotSites.id, numId)).limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, 'Bot 站点不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询 Bot 站点失败'))
    }
  })
  server.post('/bot-sites', async (req, reply) => {
    try {
      const rows = await db
        .insert(aibotSites)
        .values(req.body as typeof aibotSites.$inferInsert)
        .returning()
      return reply.status(201).send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建 Bot 站点失败'))
    }
  })
  server.put('/bot-sites/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .update(aibotSites)
        .set(req.body as Partial<typeof aibotSites.$inferInsert>)
        .where(eq(aibotSites.id, numId))
        .returning()
      if (!rows[0]) return reply.status(404).send(error(404, 'Bot 站点不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新 Bot 站点失败'))
    }
  })
  server.delete('/bot-sites/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.delete(aibotSites).where(eq(aibotSites.id, numId))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除 Bot 站点失败'))
    }
  })

  // -------------------------------------------------------------------------
  // ws_admin — WebSocket 管理
  // NOTE: 连接信息来自内存中的 WS connection_manager（非持久化），无 DB 表；
  // 待接入 WS 插件后由其提供实时连接列表。
  // -------------------------------------------------------------------------
  server.get('/ws-admin/connections', async (_req, reply) => {
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/ws-admin/connections/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ id: parsed.data.id }))
  })
  server.delete('/ws-admin/connections/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ id: parsed.data.id, closed: true }))
  })

  // -------------------------------------------------------------------------
  // compat_routes — 兼容性路由（旧 API 路径）
  // NOTE: 兼容端点，对旧 API 路径统一返回 410 废弃提示，无 DB 操作。
  // -------------------------------------------------------------------------
  server.get('/compat/*', async (_req, reply) => {
    return reply
      .status(410)
      .send(success({ deprecated: true, message: '此 API 已废弃，请使用新版本' }))
  })
}

export default plugin
