import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { videoGenerationTasks } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { listDiscovered } from '../services/ai/ai-capability-discovery.js'

const idParamSchema = z.object({ id: z.string().min(1) })

const routeBodySchema = z.object({ name: z.string().min(1) }).passthrough()
const modelTestBodySchema = z
  .object({ name: z.string().min(1), modelId: z.string().optional() })
  .passthrough()
const modelTestRunSchema = z
  .object({
    modelId: z.string().min(1),
    prompt: z.string().default('你好'),
    temperature: z.number().min(0).max(2).optional(),
  })
  .passthrough()

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

// =============================================================================
// system_configs JSON 存储辅助（用于无独立表的资源 CRUD，按 category 区分）
// =============================================================================

function parseJSONValue(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try {
    const v = JSON.parse(s)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rowToConfig(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...parseJSONValue(r.value),
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

async function configList(
  category: string,
  page: number,
  pageSize: number,
): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "category" = ${category} ORDER BY "created_at" DESC LIMIT ${pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM "system_configs" WHERE "category" = ${category}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: (rows as Record<string, unknown>[]).map(rowToConfig),
    total,
    page,
    pageSize,
  }
}

async function configById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "id"::text = ${id} LIMIT 1`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

async function configCreate(
  category: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = crypto.randomUUID()
  const value = JSON.stringify(body)
  const rows = await db.execute(
    sql`INSERT INTO "system_configs" (id, key, value, type, category) VALUES (${id}, ${id}, ${value}, ${'json'}, ${category}) RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  if (!r) return { id, ...body }
  return rowToConfig(r)
}

async function configUpdate(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const existing = await db.execute(
    sql`SELECT value FROM "system_configs" WHERE "id"::text = ${id} LIMIT 1`,
  )
  const exRow = (existing as Record<string, unknown>[])[0]
  if (!exRow) return null
  const merged = { ...parseJSONValue(exRow.value), ...body }
  const rows = await db.execute(
    sql`UPDATE "system_configs" SET "value" = ${JSON.stringify(merged)}, "updated_at" = NOW() WHERE "id"::text = ${id} RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

async function configDelete(id: string): Promise<boolean> {
  const rows = await db.execute(
    sql`DELETE FROM "system_configs" WHERE "id"::text = ${id} RETURNING id`,
  )
  return (rows as Record<string, unknown>[]).length > 0
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // ai/capabilities — 统一 AI 能力列表
  // 优先查询 ai_capabilities 表（已注册能力），为空时 fallback 到静态能力目录。
  // -------------------------------------------------------------------------
  server.get('/capabilities', async (req, reply) => {
    const fallback = [
      { id: 'chat', name: 'AI 对话', models: ['gpt-4o', 'claude-3.5-sonnet', 'deepseek-chat'] },
      { id: 'image-gen', name: 'AI 绘画', models: ['dall-e-3', 'sd-xl', 'flux'] },
      { id: 'video-gen', name: 'AI 视频', models: ['sora', 'runway-gen3'] },
      { id: 'music-gen', name: 'AI 音乐', models: ['suno', 'udio'] },
      { id: 'code', name: 'AI 代码', models: ['cursor', 'copilot'] },
      { id: 'voice', name: 'AI 语音', models: ['whisper', 'tts-1'] },
    ]
    try {
      const discovered = await listDiscovered()
      if (discovered.length > 0) {
        const capabilities = discovered.map((c) => ({
          id: c.id,
          name: c.displayName || c.name,
          category: c.category,
          provider: c.provider,
          version: c.version,
          status: c.status,
          enabled: c.enabled,
          reachable: c.reachable,
        }))
        return reply.send(success(capabilities))
      }
    } catch (e) {
      req.log.error(e)
    }
    return reply.send(success(fallback))
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
  // ai/outbound_routes — AI 外呼路由（存入 system_configs，category='outbound_route'）
  // -------------------------------------------------------------------------
  server.get('/outbound-routes/list', async (req, reply) => {
    const q = req.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('outbound_route', page, pageSize)
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询外呼路由失败'))
    }
  })
  server.get('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await configById(parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '外呼路由不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询外呼路由失败'))
    }
  })
  server.post('/outbound-routes', async (req, reply) => {
    const parsed = routeBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('outbound_route', parsed.data)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建外呼路由失败'))
    }
  })
  server.put('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = (req.body as Record<string, unknown>) ?? {}
    try {
      const row = await configUpdate(parsed.data.id, body)
      if (!row) return reply.status(404).send(error(404, '外呼路由不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新外呼路由失败'))
    }
  })
  server.delete('/outbound-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const deleted = await configDelete(parsed.data.id)
      if (!deleted) return reply.status(404).send(error(404, '外呼路由不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除外呼路由失败'))
    }
  })

  // -------------------------------------------------------------------------
  // ai/outbound_routes/callback — 外呼回调
  // 接收外呼平台回调,若有通话转录文本则调用 AI_SERVICE_URL/llm/complete 分析意向;
  // 仅有录音 URL 时返回 202 待转录;无 AI_SERVICE_URL 时返回 503。
  // -------------------------------------------------------------------------
  server.post('/outbound-routes/callback', async (req, reply) => {
    const body = req.body as {
      phone?: string
      callId?: string
      duration?: number
      recordingUrl?: string
      transcript?: string
    }
    const duration = typeof body?.duration === 'number' ? body.duration : 0
    const aiServiceUrl = process.env.AI_SERVICE_URL
    if (!aiServiceUrl) {
      return reply.status(503).send(error(503, 'AI 服务未配置(AI_SERVICE_URL)'))
    }

    // 有转录文本:调用 LLM 分析意向
    if (body?.transcript && body.transcript.trim().length > 0) {
      try {
        const llmResp = await fetch(`${aiServiceUrl}/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt:
              '分析以下外呼通话转录文本,判断客户意向。只返回一个 JSON: {"intent":"high|normal|low","reason":"简要原因"}。high=高意向(积极询问/愿意了解),normal=中等意向(态度中立/未明确拒绝),low=低意向(拒绝/挂断/无兴趣)。',
            text: body.transcript,
          }),
        })
        if (!llmResp.ok) {
          req.log.error({ status: llmResp.status }, 'LLM 意向分析失败')
          return reply.status(502).send(error(502, `LLM 意向分析失败: ${llmResp.status}`))
        }
        const llmData = (await llmResp.json().catch(() => ({}))) as {
          text?: string
          content?: string
          result?: string
        }
        const rawText = llmData.text ?? llmData.content ?? llmData.result ?? ''
        let intent = 'normal'
        let reason = ''
        // 尝试从 LLM 输出中解析 JSON
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as { intent?: string; reason?: string }
            if (['high', 'normal', 'low'].includes(parsed.intent ?? '')) {
              intent = parsed.intent!
            }
            reason = parsed.reason ?? ''
          } catch {
            /* JSON 解析失败,使用默认值 */
          }
        }
        // duration 作为辅助判断
        if (intent === 'normal' && duration < 15) intent = 'low'
        const action = intent === 'high' ? 'transfer' : intent === 'normal' ? 'continue' : 'end'
        return reply.send(
          success({
            action,
            intent,
            reason,
            phone: body?.phone ?? '',
            callId: body?.callId ?? '',
            duration,
            recordingUrl: body?.recordingUrl ?? '',
            message: '意向分析完成',
          }),
        )
      } catch (e) {
        req.log.error(e)
        return reply.status(502).send(error(502, `LLM 意向分析异常: ${(e as Error).message}`))
      }
    }

    // 仅有录音 URL,无转录:返回 202 待处理
    if (body?.recordingUrl) {
      return reply.status(202).send(
        success({
          action: 'pending',
          intent: 'unknown',
          phone: body?.phone ?? '',
          callId: body?.callId ?? '',
          duration,
          recordingUrl: body.recordingUrl,
          message: '需先转录录音,请补充 transcript 字段后重新提交',
        }),
      )
    }

    // 无转录也无录音:以 duration 做辅助判断
    const intent = duration > 60 ? 'high' : duration > 15 ? 'normal' : 'low'
    const action = intent === 'high' ? 'transfer' : intent === 'normal' ? 'continue' : 'end'
    return reply.send(
      success({
        action,
        intent,
        phone: body?.phone ?? '',
        callId: body?.callId ?? '',
        duration,
        recordingUrl: body?.recordingUrl ?? '',
        message: '回调已接收(无转录文本,按时长辅助判断)',
      }),
    )
  })

  // -------------------------------------------------------------------------
  // ai/video_routes — AI 视频路由（存入 system_configs，category='video_route'）
  // 任务端点对接 Drizzle schema: video_generation_tasks。
  // -------------------------------------------------------------------------
  server.get('/video-routes/list', async (req, reply) => {
    const q = req.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('video_route', page, pageSize)
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频路由失败'))
    }
  })
  server.get('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await configById(parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '视频路由不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询视频路由失败'))
    }
  })
  server.post('/video-routes', async (req, reply) => {
    const parsed = routeBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('video_route', parsed.data)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建视频路由失败'))
    }
  })
  server.put('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = (req.body as Record<string, unknown>) ?? {}
    try {
      const row = await configUpdate(parsed.data.id, body)
      if (!row) return reply.status(404).send(error(404, '视频路由不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新视频路由失败'))
    }
  })
  server.delete('/video-routes/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const deleted = await configDelete(parsed.data.id)
      if (!deleted) return reply.status(404).send(error(404, '视频路由不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除视频路由失败'))
    }
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
  // developer/model_test — 开发者模型测试（存入 system_configs，category='model_test_task'）
  // /run 调用 AI_SERVICE_URL/llm/complete 执行真实探测，未配置时返回 mock。
  // -------------------------------------------------------------------------
  server.get('/developer/model-test/list', async (req, reply) => {
    const q = req.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('model_test_task', page, pageSize)
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询模型测试任务失败'))
    }
  })
  server.get('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await configById(parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '模型测试任务不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询模型测试任务失败'))
    }
  })
  server.post('/developer/model-test', async (req, reply) => {
    const parsed = modelTestBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('model_test_task', parsed.data)
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建模型测试任务失败'))
    }
  })
  server.put('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const body = (req.body as Record<string, unknown>) ?? {}
    try {
      const row = await configUpdate(parsed.data.id, body)
      if (!row) return reply.status(404).send(error(404, '模型测试任务不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新模型测试任务失败'))
    }
  })
  server.delete('/developer/model-test/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const deleted = await configDelete(parsed.data.id)
      if (!deleted) return reply.status(404).send(error(404, '模型测试任务不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除模型测试任务失败'))
    }
  })
  // POST /developer/model-test/run — 执行模型测试
  server.post('/developer/model-test/run', async (req, reply) => {
    const parsed = modelTestRunSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'modelId 为必填项'))
    const { modelId, prompt, temperature } = parsed.data
    const aiServiceUrl = process.env.AI_SERVICE_URL
    const started = Date.now()
    if (!aiServiceUrl) {
      return reply.send(
        success({
          result: 'success',
          modelId,
          response: `[mock] ${prompt}`,
          latency: Date.now() - started,
          mock: true,
        }),
      )
    }
    try {
      const llmResp = await fetch(`${aiServiceUrl}/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt, temperature }),
      })
      const latency = Date.now() - started
      if (!llmResp.ok) {
        req.log.error({ status: llmResp.status }, '模型测试调用失败')
        return reply.status(502).send(error(502, `模型测试调用失败: ${llmResp.status}`))
      }
      const data = (await llmResp.json().catch(() => ({}))) as {
        text?: string
        content?: string
        result?: string
      }
      const response = data.text ?? data.content ?? data.result ?? ''
      return reply.send(success({ result: 'success', modelId, response, latency }))
    } catch (e) {
      req.log.error(e)
      return reply.status(502).send(error(502, `模型测试异常: ${(e as Error).message}`))
    }
  })
}

export default plugin
