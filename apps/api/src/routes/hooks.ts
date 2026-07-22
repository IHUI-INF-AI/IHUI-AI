/**
 * Hooks 路由 — Fastify 转发层(2026-07-22 立)。
 *
 * 端点清单(全部 JWT 鉴权):
 *  1. GET    /hooks                       — 列出全部 Hook(可选 ?event=)
 *  2. POST   /hooks                       — 创建 Hook(支持 depends_on/schedule)
 *  3. GET    /hooks/:id                   — 获取详情
 *  4. PATCH  /hooks/:id                   — 更新
 *  5. DELETE /hooks/:id                   — 删除
 *  6. POST   /hooks/:id/toggle            — 启用/禁用
 *  7. POST   /hooks/:id/test              — 测试(模拟触发)
 *  8. GET    /hooks/:id/logs              — 查询日志(支持 event/success/duration/时间范围过滤)
 *  9. GET    /hooks/logs                  — 查询全部日志(支持过滤)
 * 10. POST   /hooks/batch/toggle          — 批量启用/禁用(2026-07-22 立)
 * 11. GET    /hooks/stats                 — Hook 执行统计(2026-07-22 立)
 * 12. GET    /hooks/dag                   — DAG 可视化(?event=xxx,2026-07-22 立)
 * 13. GET    /hooks/health                — 所有 Hook 健康状态(2026-07-22 立)
 * 14. POST   /hooks/:id/replay            — 重放指定日志(2026-07-22 立)
 * 15. POST   /hooks/:id/replay-all        — 批量重放时间范围内触发(2026-07-22 立)
 * 16. GET    /hooks/:id/dlq               — 查询 DLQ 列表(2026-07-22 立)
 * 17. POST   /hooks/:id/dlq/:entry_id/reprocess — 从 DLQ 重新处理(2026-07-22 立)
 * 18. DELETE /hooks/:id/dlq               — 清空 DLQ(2026-07-22 立)
 * 19. POST   /hooks/:id/health-check      — 手动触发健康检查(2026-07-22 立)
 *
 * 路径前缀:在 server.ts 用 prefix:'/api' 注册 → /api/hooks/*
 * 全部转发到 ai-service /api/hooks/*,自身不存状态。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { wsAuth } from '../plugins/ws-helpers.js'
import { success, error } from '../utils/response.js'
import {
  autoOrchestrateHooks,
  batchToggleHooks,
  clearHookDlq,
  createAbTest,
  createHook,
  deleteHook,
  getAbTest,
  getExecutionTimeline,
  getHook,
  getHookDag,
  getHookHealthForecast,
  getHookStats,
  getHooksHealth,
  instantiateHookTemplate,
  listAbTests,
  listAllHookLogs,
  listHookDlq,
  listHookLogs,
  listHookTemplates,
  listHooks,
  replayAllHookLogs,
  replayHookLog,
  reprocessDlqEntry,
  stopAbTest,
  testHook,
  toggleHook,
  triggerHookHealthCheck,
  updateHook,
} from '../services/hooks-service.js'
import type { HookLogsFilter } from '../services/hooks-service.js'

const HOOK_EVENTS_ENUM = z.enum([
  'tool.before',
  'tool.after',
  'message.send',
  'message.receive',
  'session.start',
  'session.end',
  'error',
  'schedule.trigger', // cron 定时触发(2026-07-22 立)
])

const HOOK_ACTION_TYPES_ENUM = z.enum(['webhook', 'script', 'log', 'notify'])

const actionConfigSchema = z.object({
  url: z.string().max(2048).optional(),
  method: z.enum(['GET', 'POST', 'PUT']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().max(8192).optional(),
  command: z.string().max(2048).optional(),
  channel: z.enum(['toast', 'notification', 'email', 'webhook']).optional(),
  message: z.string().max(2048).optional(),
  // HMAC-SHA256 签名密钥(webhook + notify webhook 渠道,2026-07-22 立)
  // secret 为空时不签名(向后兼容)
  secret: z.string().max(2048).optional(),
  // 失败重试配置(webhook + script,2026-07-22 立)
  // retry_count: 默认 0,最大 3;retry_delay: 指数退避 base(秒)
  retry_count: z.number().int().min(0).max(3).optional(),
  retry_delay: z.number().min(0).max(60).optional(),
  // email 通知字段(notify channel=email,2026-07-22 立)
  to: z.string().max(512).optional(),
  email: z.string().max(512).optional(),
  subject: z.string().max(512).optional(),
})

const actionSchema = z.object({
  type: HOOK_ACTION_TYPES_ENUM,
  config: actionConfigSchema.default({}),
})

const createHookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  event: HOOK_EVENTS_ENUM,
  condition: z.string().max(8192).nullable().optional(),
  action: actionSchema,
  enabled: z.boolean().optional(),
  // DAG 依赖(2026-07-22 立):依赖的其他 hook_id 列表,被依赖的先执行
  depends_on: z.array(z.string().min(1).max(64)).max(50).optional(),
  // cron 定时表达式(2026-07-22 立):如 "0 */6 * * *" 每 6 小时
  schedule: z.string().max(120).nullable().optional(),
})

const updateHookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  event: HOOK_EVENTS_ENUM.optional(),
  condition: z.string().max(8192).nullable().optional(),
  action: actionSchema.optional(),
  enabled: z.boolean().optional(),
  depends_on: z.array(z.string().min(1).max(64)).max(50).optional(),
  schedule: z.string().max(120).nullable().optional(),
})

const toggleHookSchema = z.object({
  enabled: z.boolean(),
})

const testHookSchema = z.object({
  event: HOOK_EVENTS_ENUM,
  context: z.record(z.string(), z.unknown()).default({}),
})

/** 重放日志请求体(2026-07-22 立) */
const replayLogSchema = z.object({
  logId: z.string().min(1).max(64),
})

/** 批量启用/禁用请求体(2026-07-22 立) */
const batchToggleSchema = z.object({
  hookIds: z.array(z.string().min(1)).min(1, 'hookIds 不能为空').max(100),
  enabled: z.boolean(),
})

const idParamSchema = z.object({ id: z.string().min(1) })

// ---------- P3 Hook 超越创新 schema(2026-07-23 立)----------

/** Hook 智能编排请求体 */
const autoOrchestrateSchema = z.object({
  intent: z.string().min(1).max(4000, '意图描述过长'),
  events: z.array(z.string().min(1).max(64)).max(20).optional(),
})

/** A/B 测试创建请求体 */
const createAbTestSchema = z.object({
  event: HOOK_EVENTS_ENUM,
  variants: z.array(z.string().min(1).max(64)).min(2, '至少 2 个变体').max(5),
  trafficSplit: z.array(z.number().min(0).max(1)).min(2).max(5),
  metrics: z.array(z.string().min(1).max(32)).max(10).optional(),
  description: z.string().max(500).optional(),
})

/** 模板实例化请求体(覆盖字段,全部可选) */
const instantiateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  event: HOOK_EVENTS_ENUM.optional(),
  condition: z.string().max(8192).nullable().optional(),
  action: z
    .object({
      type: HOOK_ACTION_TYPES_ENUM,
      config: actionConfigSchema.default({}),
    })
    .optional(),
  enabled: z.boolean().optional(),
})

/** ab-test / template 路径参数(复用 id 字段) */
const abTestIdParamSchema = z.object({ id: z.string().min(1).max(64) })
const templateIdParamSchema = z.object({ id: z.string().min(1).max(64) })

/**
 * 从 query string 解析日志过滤参数(2026-07-22 立)。
 *
 * 所有参数可选,无任何过滤条件时返回 undefined(避免传空对象)。
 */
function parseLogsFilter(query: Record<string, string | undefined>): HookLogsFilter | undefined {
  const filter: HookLogsFilter = {}
  if (query.event) filter.event = query.event
  if (query.success !== undefined) filter.success = query.success === 'true'
  if (query.durationMin !== undefined) filter.durationMin = Number(query.durationMin)
  if (query.durationMax !== undefined) filter.durationMax = Number(query.durationMax)
  if (query.since) filter.since = query.since
  if (query.until) filter.until = query.until
  return Object.keys(filter).length > 0 ? filter : undefined
}

export const hooksRoutes: FastifyPluginAsync = async (server) => {
  // JWT 鉴权 hook(复用 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 1. GET /hooks — 列表
  server.get('/hooks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const event = (request.query as { event?: string }).event
    const data = await listHooks(request, event)
    return reply.send(success(data))
  })

  // 2. POST /hooks — 创建
  server.post('/hooks', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await createHook(request, parsed.data)
    if (hook === null) {
      return reply.status(503).send(error(503, 'Hook 引擎不可用(ai-service 无响应)'))
    }
    return reply.send(success(hook))
  })

  // 9. GET /hooks/logs — 全部日志(必须在 /:id 之前注册,否则被 /:id 截获)
  //    支持过滤参数:event/success/durationMin/durationMax/since/until(2026-07-22 立)
  server.get('/hooks/logs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const query = request.query as {
      limit?: string
      event?: string
      success?: string
      durationMin?: string
      durationMax?: string
      since?: string
      until?: string
    }
    const limit = Math.min(1000, Math.max(1, Number(query.limit) || 100))
    const filter = parseLogsFilter(query)
    const data = await listAllHookLogs(request, limit, filter)
    return reply.send(success(data))
  })

  // 11. POST /hooks/batch/toggle — 批量启用/禁用(2026-07-22 立)
  //     必须在 /:id 之前注册,否则 'batch' 被当作 hook_id
  server.post('/hooks/batch/toggle', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = batchToggleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await batchToggleHooks(request, parsed.data.hookIds, parsed.data.enabled)
    return reply.send(success(result))
  })

  // 12. GET /hooks/stats — Hook 执行统计(2026-07-22 立)
  //     必须在 /:id 之前注册,否则 'stats' 被当作 hook_id
  server.get('/hooks/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const hookId = (request.query as { hookId?: string }).hookId
    const stats = await getHookStats(request, hookId)
    return reply.send(success(stats))
  })

  // 13. GET /hooks/dag — DAG 可视化(2026-07-22 立)
  //     必须在 /:id 之前注册,否则 'dag' 被当作 hook_id
  server.get('/hooks/dag', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const event = (request.query as { event?: string }).event
    if (!event) {
      return reply.status(400).send(error(400, '缺少 event 参数'))
    }
    const dag = await getHookDag(request, event)
    return reply.send(success(dag))
  })

  // 14. GET /hooks/health — 所有 Hook 健康状态(2026-07-22 立)
  //     必须在 /:id 之前注册,否则 'health' 被当作 hook_id
  server.get('/hooks/health', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const health = await getHooksHealth(request)
    return reply.send(success(health))
  })

  // ---------- P3 Hook 超越创新(2026-07-23 立,对标 GitHub Actions / Zapier)----------
  // 所有静态路径必须先于 /hooks/:id 注册,避免 'auto-orchestrate' / 'ab-test' /
  // 'ab-tests' / 'templates' / 'execution-stream' 被当作 hook_id 截获。

  // P3-1. POST /hooks/auto-orchestrate — Hook 智能编排(LLM 自动生成 DAG)
  //       输入:{intent, events?} → LLM 解析意图生成节点 + 依赖关系 + Hook 草稿
  //       LLM 不可用时返回 503(由 ai-service 返回 {error: "llm_unavailable"})
  server.post('/hooks/auto-orchestrate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = autoOrchestrateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await autoOrchestrateHooks(request, parsed.data.intent, parsed.data.events)
    if (result === null) {
      return reply.status(503).send(error(503, 'Hook 引擎不可用(ai-service 无响应)'))
    }
    // ai-service 返回 {error: "llm_unavailable"} → api 层映射 503
    if (result.error === 'llm_unavailable') {
      return reply.status(503).send(error(503, 'LLM 服务不可用,无法生成 DAG'))
    }
    if (result.error === 'llm_parse_failed') {
      return reply.status(502).send(error(502, 'LLM 输出解析失败,请重试或简化意图描述'))
    }
    return reply.send(success(result))
  })

  // P3-2. POST /hooks/ab-test — 创建 A/B 测试
  //       输入:{event, variants, trafficSplit, metrics?, description?}
  server.post('/hooks/ab-test', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createAbTestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const abTest = await createAbTest(request, parsed.data)
    if (abTest === null) {
      return reply.status(503).send(error(503, 'Hook 引擎不可用(ai-service 无响应)'))
    }
    return reply.send(success(abTest))
  })

  // P3-3. GET /hooks/ab-tests — 列出所有 A/B 测试(可选 ?status=running|completed|stopped)
  //       必须先于 /hooks/:id 注册,否则 'ab-tests' 被当作 hook_id
  server.get('/hooks/ab-tests', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const status = (request.query as { status?: string }).status
    const data = await listAbTests(request, status)
    return reply.send(success(data))
  })

  // P3-4. GET /hooks/ab-test/:id — 获取 A/B 测试详情 + 实时结果(各变体指标对比)
  //       静态前缀 /hooks/ab-test/ 优先匹配,不会与 /hooks/:id 冲突
  server.get('/hooks/ab-test/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = abTestIdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 A/B 测试 ID'))
    }
    const data = await getAbTest(request, params.data.id)
    if (data === null) {
      return reply.status(404).send(error(404, 'A/B 测试不存在或服务不可用'))
    }
    return reply.send(success(data))
  })

  // P3-5. POST /hooks/ab-test/:id/stop — 停止 A/B 测试 + 选出最优变体
  server.post('/hooks/ab-test/:id/stop', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = abTestIdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 A/B 测试 ID'))
    }
    const result = await stopAbTest(request, params.data.id)
    if (result === null) {
      return reply.status(404).send(error(404, 'A/B 测试不存在或服务不可用'))
    }
    return reply.send(success(result))
  })

  // P3-6. GET /hooks/templates — 列出所有 Hook 模板(可选 ?tag=过滤)
  //       必须先于 /hooks/:id 注册,否则 'templates' 被当作 hook_id
  server.get('/hooks/templates', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const tag = (request.query as { tag?: string }).tag
    const data = await listHookTemplates(request, tag)
    return reply.send(success(data))
  })

  // P3-7. POST /hooks/templates/:id/instantiate — 从模板创建 Hook(可覆盖配置)
  server.post('/hooks/templates/:id/instantiate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = templateIdParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的模板 ID'))
    }
    const parsed = instantiateTemplateSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await instantiateHookTemplate(request, params.data.id, parsed.data)
    if (hook === null) {
      return reply.status(404).send(error(404, '模板不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // P3-8. GET /hooks/execution-stream — WebSocket 实时推送执行事件(start/end/error)
  //       复用 @fastify/websocket,JWT 鉴权 via wsAuth(token from query)
  //       必须先于 /hooks/:id 注册,否则 'execution-stream' 被当作 hook_id
  //       实现策略:ai-service 跨进程无法直接订阅,采用轮询 execution-timeline + diff 推送
  server.get(
    '/hooks/execution-stream',
    { websocket: true },
    async (socket: WebSocket, request) => {
      const query = request.query as { token?: string; hookId?: string }
      const userId = await wsAuth(socket, query.token)
      if (!userId) return // 鉴权失败已 close

      // 发送连接成功欢迎
      socket.send(
        JSON.stringify({
          type: 'connected',
          userId,
          ts: Date.now(),
        }),
      )

      // 轮询 ai-service 拉取 realtime 状态(1s 一次),diff 后推送
      // 注:ai-service 跨进程无法直接订阅 in-memory callback,采用轮询降级方案
      let lastStatus = ''
      const pollIntervalMs = 1000
      const poll = setInterval(() => {
        // 1 = WebSocket.OPEN,0=CONNECTING/2=CLOSING/3=CLOSED
        if (socket.readyState !== 1) {
          clearInterval(poll)
          return
        }
        void getExecutionTimeline(request, query.hookId ?? '').then(
          (timeline) => {
            if (socket.readyState !== 1) return
            if (!timeline) return
            const statusJson = JSON.stringify(timeline.realtimeStatus ?? {})
            if (statusJson === lastStatus) return
            lastStatus = statusJson
            try {
              socket.send(
                JSON.stringify({
                  type: 'status',
                  status: timeline.realtimeStatus,
                  ts: Date.now(),
                }),
              )
            } catch {
              // socket 已关闭或异常,停止轮询
              clearInterval(poll)
            }
          },
          () => {
            // 静默失败,继续轮询(ai-service 可能短暂不可用)
          },
        )
      }, pollIntervalMs)

      // 客户端断开 / 异常 → 清理
      socket.on('close', () => clearInterval(poll))
      socket.on('error', () => clearInterval(poll))
    },
  )

  // 3. GET /hooks/:id — 详情
  server.get('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const hook = await getHook(request, params.data.id)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 4. PATCH /hooks/:id — 更新
  server.patch('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = updateHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await updateHook(request, params.data.id, parsed.data)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 5. DELETE /hooks/:id — 删除
  server.delete('/hooks/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const ok = await deleteHook(request, params.data.id)
    if (!ok) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success({ deleted: true, id: params.data.id }))
  })

  // 6. POST /hooks/:id/toggle — 启用/禁用
  server.post('/hooks/:id/toggle', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = toggleHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await toggleHook(request, params.data.id, parsed.data.enabled)
    if (hook === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(hook))
  })

  // 7. POST /hooks/:id/test — 测试
  server.post('/hooks/:id/test', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = testHookSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await testHook(request, params.data.id, parsed.data)
    return reply.send(success(result))
  })

  // 8. GET /hooks/:id/logs — 日志(支持过滤参数,2026-07-22 立)
  server.get('/hooks/:id/logs', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const query = request.query as {
      limit?: string
      event?: string
      success?: string
      durationMin?: string
      durationMax?: string
      since?: string
      until?: string
    }
    const limit = Math.min(1000, Math.max(1, Number(query.limit) || 100))
    const filter = parseLogsFilter(query)
    const data = await listHookLogs(request, params.data.id, limit, filter)
    return reply.send(success(data))
  })

  // 15. POST /hooks/:id/replay — 重放指定日志(2026-07-22 立)
  server.post('/hooks/:id/replay', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const parsed = replayLogSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const log = await replayHookLog(request, params.data.id, parsed.data.logId)
    if (log === null) {
      return reply.status(404).send(error(404, '日志不存在或服务不可用'))
    }
    return reply.send(success(log))
  })

  // 16. POST /hooks/:id/replay-all — 批量重放时间范围内触发(2026-07-22 立)
  server.post('/hooks/:id/replay-all', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const query = request.query as { since?: string; until?: string }
    const logs = await replayAllHookLogs(request, params.data.id, query.since, query.until)
    return reply.send(success({ logs, count: logs.length }))
  })

  // 17. GET /hooks/:id/dlq — 查询 DLQ 列表(2026-07-22 立)
  server.get('/hooks/:id/dlq', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const data = await listHookDlq(request, params.data.id)
    return reply.send(success(data))
  })

  // 18. POST /hooks/:id/dlq/:entry_id/reprocess — 从 DLQ 重新处理(2026-07-22 立)
  server.post('/hooks/:id/dlq/:entry_id/reprocess', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = z.object({
      id: z.string().min(1),
      entry_id: z.string().min(1),
    }).safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的参数'))
    }
    const log = await reprocessDlqEntry(request, params.data.id, params.data.entry_id)
    if (log === null) {
      return reply.status(404).send(error(404, 'DLQ 条目不存在或服务不可用'))
    }
    return reply.send(success(log))
  })

  // 19. DELETE /hooks/:id/dlq — 清空 DLQ(2026-07-22 立)
  server.delete('/hooks/:id/dlq', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const cleared = await clearHookDlq(request, params.data.id)
    return reply.send(success({ cleared, hookId: params.data.id }))
  })

  // 20. POST /hooks/:id/health-check — 手动触发健康检查(2026-07-22 立)
  server.post('/hooks/:id/health-check', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const health = await triggerHookHealthCheck(request, params.data.id)
    if (health === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(health))
  })

  // ---------- P3 动态子路径路由(2026-07-23 立)----------
  // /hooks/:id/* 子路径路由,Fastify 路由匹配按完整路径长度优先,不与 /hooks/:id 冲突。

  // P3-9. GET /hooks/:id/execution-timeline — Hook 执行时间线
  //       返回:Gantt(执行时段)+ 依赖图 + 实时执行状态(currentlyRunning/queued)
  server.get('/hooks/:id/execution-timeline', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const data = await getExecutionTimeline(request, params.data.id)
    if (data === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(data))
  })

  // P3-10. GET /hooks/:id/health-forecast — Hook 健康预测
  //        基于 30 天历史数据 + LLM 趋势分析,返回 {forecast, trend, recommendation}
  //        LLM 不可用时降级为规则预测(成功率高 → 继续观察 / 低 → 建议禁用)
  server.get('/hooks/:id/health-forecast', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const data = await getHookHealthForecast(request, params.data.id)
    if (data === null) {
      return reply.status(404).send(error(404, 'Hook 不存在或服务不可用'))
    }
    return reply.send(success(data))
  })
}

export default hooksRoutes
