import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
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
  // agent_need_task — Agent 需求任务市场（表 zhs_agent_need_task，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const needTaskCols = [
    'user_id',
    'user_name',
    'agent_id',
    'agent_name',
    'title',
    'description',
    'type',
    'priority',
    'budget',
    'deadline',
    'status',
    'developer_id',
    'developer_name',
    'accept_time',
    'complete_time',
    'deliverable',
    'remark',
  ]
  server.get('/need-task/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      status?: string
      type?: string
      user_id?: string
      developer_id?: string
      keyword?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.developer_id) conds.push(sql`"developer_id" = ${q.developer_id}`)
    if (q.keyword) conds.push(sql`"title" ILIKE ${`%${q.keyword}%`}`)
    try {
      const result = await rawList('zhs_agent_need_task', {
        page,
        pageSize,
        conds,
        orderBy: '"priority" DESC, "id" DESC',
      })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询需求任务失败'))
    }
  })
  server.get('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_agent_need_task', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '需求任务不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询需求任务失败'))
    }
  })
  server.post('/need-task', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 0
      const row = await rawInsert('zhs_agent_need_task', needTaskCols, body)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建需求任务失败'))
    }
  })
  server.put('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_agent_need_task',
        needTaskCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新需求任务失败'))
    }
  })
  server.delete('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('zhs_agent_need_task', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除需求任务失败'))
    }
  })

  // -------------------------------------------------------------------------
  // agent_upload — Agent 资源上传管理（表 agent_upload，尚未迁移为 Drizzle schema）
  // 旧逻辑：删除为软删除（status=0），列表仅返回 status=1
  // -------------------------------------------------------------------------
  const uploadCols = [
    'user_id',
    'user_name',
    'agent_id',
    'agent_name',
    'file_name',
    'file_url',
    'file_type',
    'file_size',
    'mime_type',
    'ext',
    'biz_type',
    'status',
  ]
  server.get('/upload/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agent_id?: string
      biz_type?: string
      file_type?: string
      user_id?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = [sql`"status" = 1`]
    if (q.agent_id) conds.push(sql`"agent_id" = ${q.agent_id}`)
    if (q.biz_type) conds.push(sql`"biz_type" = ${q.biz_type}`)
    if (q.file_type) conds.push(sql`"file_type" = ${q.file_type}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    try {
      const result = await rawList('agent_upload', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询上传记录失败'))
    }
  })
  server.get('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('agent_upload', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '上传记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询上传记录失败'))
    }
  })
  server.post('/upload', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('agent_upload', uploadCols, body)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建上传记录失败'))
    }
  })
  server.put('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'agent_upload',
        uploadCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新上传记录失败'))
    }
  })
  server.delete('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      // 软删除：status=0（与旧架构一致）
      await db.execute(
        sql`UPDATE ${sql.raw('"agent_upload"')} SET "status" = 0 WHERE "id"::text = ${parsed.data.id}`,
      )
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除上传记录失败'))
    }
  })

  // -------------------------------------------------------------------------
  // agent_usedetail — 代理商使用明细（表 zhs_agent_usedetail，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const usedetailCols = [
    'agent_id',
    'agent_name',
    'user_id',
    'user_name',
    'type',
    'model',
    'tokens',
    'amount',
    'cost',
    'profit',
    'request_id',
    'status',
    'remark',
  ]
  server.get('/usedetail/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agent_id?: string
      user_id?: string
      type?: string
      start_date?: string
      end_date?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.agent_id) conds.push(sql`"agent_id" = ${q.agent_id}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.start_date) conds.push(sql`"created_at" >= ${q.start_date}::timestamp`)
    if (q.end_date) conds.push(sql`"created_at" <= ${`${q.end_date} 23:59:59`}::timestamp`)
    try {
      const result = await rawList('zhs_agent_usedetail', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询使用明细失败'))
    }
  })
  server.get('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_agent_usedetail', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '使用明细不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询使用明细失败'))
    }
  })
  server.post('/usedetail', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('zhs_agent_usedetail', usedetailCols, body)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建使用明细失败'))
    }
  })
  server.put('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_agent_usedetail',
        usedetailCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新使用明细失败'))
    }
  })
  server.delete('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('zhs_agent_usedetail', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除使用明细失败'))
    }
  })
}

export default plugin
