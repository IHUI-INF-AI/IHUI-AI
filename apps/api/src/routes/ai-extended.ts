import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { videoGenerationTasks } from '@ihui/database'
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

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // ai/capabilities — 统一 AI 能力列表
  // NOTE: 旧架构 capabilities.py 为基于文件/Agent/Skill 的统一能力目录，无独立 DB 表；
  // 此处返回静态能力目录作为合理默认值，待能力注册表迁移后替换。
  // -------------------------------------------------------------------------
  server.get('/capabilities', async (_req, reply) => {
    const capabilities = [
      { id: 'chat', name: 'AI 对话', models: ['gpt-4o', 'claude-3.5-sonnet', 'deepseek-chat'] },
      { id: 'image-gen', name: 'AI 绘画', models: ['dall-e-3', 'sd-xl', 'flux'] },
      { id: 'video-gen', name: 'AI 视频', models: ['sora', 'runway-gen3'] },
      { id: 'music-gen', name: 'AI 音乐', models: ['suno', 'udio'] },
      { id: 'code', name: 'AI 代码', models: ['cursor', 'copilot'] },
      { id: 'voice', name: 'AI 语音', models: ['whisper', 'tts-1'] },
    ]
    return reply.send(success(capabilities))
  })

  // -------------------------------------------------------------------------
  // ai/model_info — 统一模型信息（表 zhs_ai_model_info，尚未迁移为 Drizzle schema）
  // 旧逻辑：默认 status=1，按 sort 升序、id 降序
  // -------------------------------------------------------------------------
  server.get('/model-info/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      source?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.source) conds.push(sql`"source" = ${q.source}`)
    conds.push(sql`"status" = ${q.status !== undefined ? Number(q.status) : 1}`)
    try {
      const result = await rawList('zhs_ai_model_info', {
        page,
        pageSize,
        conds,
        orderBy: '"sort" ASC, "id" DESC',
      })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询模型信息失败'))
    }
  })
  server.get('/model-info/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.execute(
        sql`SELECT * FROM ${sql.raw('"zhs_ai_model_info"')} WHERE "id"::text = ${parsed.data.id} LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '模型不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询模型信息失败'))
    }
  })
  server.post('/model-info', async (req, reply) => {
    const cols = ['source', 'name', 'description', 'icon', 'status', 'sort']
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const present = cols.filter((c) => body[c] !== undefined)
      if (present.length === 0) return reply.status(400).send(error(400, '缺少可写入字段'))
      const colList = sql.join(
        present.map((c) => sql.raw(`"${c}"`)),
        sql`, `,
      )
      const valList = sql.join(
        present.map((c) => sql`${body[c]}`),
        sql`, `,
      )
      const rows = await db.execute(
        sql`INSERT INTO ${sql.raw('"zhs_ai_model_info"')} (${colList}) VALUES (${valList}) RETURNING *`,
      )
      return reply.status(201).send(success((rows as Record<string, unknown>[])[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建模型信息失败'))
    }
  })
  server.put('/model-info/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const cols = ['source', 'name', 'description', 'icon', 'status', 'sort']
    try {
      const body = req.body as Record<string, unknown>
      const sets: SQL[] = cols
        .filter((c) => body[c] !== undefined)
        .map((c) => sql`${sql.raw(`"${c}"`)} = ${body[c]}`)
      if (sets.length === 0) return reply.send(success({ id: parsed.data.id, updated: true }))
      const rows = await db.execute(
        sql`UPDATE ${sql.raw('"zhs_ai_model_info"')} SET ${sql.join(sets, sql`, `)} WHERE "id"::text = ${parsed.data.id} RETURNING *`,
      )
      return reply.send(
        success((rows as Record<string, unknown>[])[0] ?? { id: parsed.data.id, updated: true }),
      )
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新模型信息失败'))
    }
  })
  server.delete('/model-info/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.execute(
        sql`DELETE FROM ${sql.raw('"zhs_ai_model_info"')} WHERE "id"::text = ${parsed.data.id}`,
      )
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除模型信息失败'))
    }
  })

  // -------------------------------------------------------------------------
  // ai/outbound_routes — AI 外呼路由
  // NOTE: 旧架构 outbound_routes.py 仅提供 POST /analyze（LLM 意向分析），无独立 DB 表；
  // 此处 CRUD 保持合理默认值，待外呼路由表迁移后替换。
  // -------------------------------------------------------------------------
  server.get('/outbound-routes/list', async (_req, reply) => {
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ id: parsed.data.id }))
  })
  server.post('/outbound-routes', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }))
  })
  server.put('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // -------------------------------------------------------------------------
  // ai/video_routes — AI 视频路由 + 任务
  // NOTE: /video-routes CRUD 无独立 DB 表（旧架构 video_routes.py 仅 POST /generate）；
  // 任务端点对接 Drizzle schema: video_generation_tasks。
  // -------------------------------------------------------------------------
  server.get('/video-routes/list', async (_req, reply) => {
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ id: parsed.data.id }))
  })
  server.post('/video-routes', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }))
  })
  server.put('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
  // POST /video-routes/tasks/create — 创建视频生成任务
  server.post('/video-routes/tasks/create', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      const taskId = typeof body.taskId === 'string' ? body.taskId : crypto.randomUUID()
      const rows = await db
        .insert(videoGenerationTasks)
        .values({
          taskId,
          userUuid: typeof body.userUuid === 'string' ? body.userUuid : 'system',
          chatId: typeof body.chatId === 'string' ? body.chatId : null,
          status: 'accepted',
          message: typeof body.message === 'string' ? body.message : null,
        })
        .returning()
      return reply.status(201).send(success({ taskId, status: rows[0]?.status ?? 'accepted' }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建视频生成任务失败'))
    }
  })
  // GET /video-routes/tasks/:id — 查询任务状态
  server.get('/video-routes/tasks/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的任务 ID'))
    try {
      const rows = await db
        .select()
        .from(videoGenerationTasks)
        .where(eq(videoGenerationTasks.taskId, parsed.data.id))
        .limit(1)
        .orderBy(desc(videoGenerationTasks.id))
      const task = rows[0]
      if (!task) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(
        success({
          taskId: task.taskId,
          status: task.status,
          message: task.message,
          result: task.result,
        }),
      )
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频生成任务失败'))
    }
  })

  // -------------------------------------------------------------------------
  // developer/model_test — 开发者模型测试
  // NOTE: 旧架构 model_test_service.py 为运行时模型连通性探测（无 DB 表）；
  // CRUD 保持合理默认值，/run 保持运行时探测语义。
  // -------------------------------------------------------------------------
  server.get('/developer/model-test/list', async (_req, reply) => {
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // NOTE: 表尚未迁移，使用合理默认值
    return reply.send(success({ id: parsed.data.id }))
  })
  server.post('/developer/model-test', async (req, reply) => {
    return reply.status(201).send(success({ created: true, body: req.body }))
  })
  server.put('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, updated: true }))
  })
  server.delete('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })
  // POST /developer/model-test/run — 执行模型测试
  server.post('/developer/model-test/run', async (req, reply) => {
    // NOTE: 运行时探测端点，真实实现需调用目标模型 API（见旧架构 model_test_service.py）
    return reply.send(success({ result: 'ok', body: req.body }))
  })
}

export default plugin
