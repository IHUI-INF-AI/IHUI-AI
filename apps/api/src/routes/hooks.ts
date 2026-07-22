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
 * 20. POST   /hooks/auto-orchestrate      — 智能编排(LLM 生成 Hook+DAG,2026-07-23 立)
 * 21. POST   /hooks/ab-test               — 创建 A/B 测试(2026-07-23 立)
 * 22. GET    /hooks/ab-tests              — 列出所有 A/B 测试(2026-07-23 立)
 * 23. GET    /hooks/ab-test/:id           — A/B 测试详情(2026-07-23 立)
 * 24. POST   /hooks/ab-test/:id/stop      — 停止 A/B 测试(2026-07-23 立)
 * 25. GET    /hooks/templates             — 列出 5 个预置模板(2026-07-23 立)
 * 26. POST   /hooks/templates/:id/instantiate — 用模板创建 hook(2026-07-23 立)
 * 27. GET    /hooks/:id/execution-timeline — Gantt 可视化数据(2026-07-23 立)
 * 28. GET    /hooks/:id/health-forecast   — 健康预测(LLM+线性回归,2026-07-23 立)
 *
 * 路径前缀:在 server.ts 用 prefix:'/api' 注册 → /api/hooks/*
 * 全部转发到 ai-service /api/hooks/*,自身不存状态。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  autoOrchestrateHooks,
  batchToggleHooks,
  clearHookDlq,
  createAbTest,
  createHook,
  deleteHook,
  getAbTest,
  getHook,
  getHookDag,
  getHookExecutionTimeline,
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

/** 智能编排请求体(2026-07-23 立,超越创新功能) */
const autoOrchestrateSchema = z.object({
  requirement: z.string().min(1, 'requirement 不能为空').max(4000),
  event: z.string().max(100).optional(),
})

/** 创建 A/B 测试请求体(2026-07-23 立) */
const createAbTestSchema = z.object({
  hook_a_id: z.string().min(1).max(64),
  hook_b_id: z.string().min(1).max(64),
  traffic_split: z.number().min(0).max(1),
  user_bucketing: z.enum(['hash', 'random', 'sticky']).optional(),
})

/** 实例化模板请求体(2026-07-23 立) */
const instantiateTemplateSchema = z.object({
  overrides: z.record(z.string(), z.unknown()).default({}),
})

const idParamSchema = z.object({ id: z.string().min(1) })

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

  // ===== 超越创新功能(2026-07-23 立)=====
  // 以下静态路径必须在 /:id 之前注册,否则 'auto-orchestrate'/'ab-test'/'templates'
  // 被当作 hook_id

  // 21. POST /hooks/auto-orchestrate — 智能编排(LLM 生成 Hook + DAG)
  server.post('/hooks/auto-orchestrate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = autoOrchestrateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await autoOrchestrateHooks(request, parsed.data.requirement, parsed.data.event)
    return reply.send(success(result))
  })

  // 22. POST /hooks/ab-test — 创建 A/B 测试
  server.post('/hooks/ab-test', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const parsed = createAbTestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await createAbTest(request, parsed.data)
    return reply.send(success(result))
  })

  // 23. GET /hooks/ab-tests — 列出所有 A/B 测试
  server.get('/hooks/ab-tests', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const tests = await listAbTests(request)
    return reply.send(success({ tests, count: tests.length }))
  })

  // 24. GET /hooks/ab-test/:id — A/B 测试详情
  //     注:此路径在 /ab-test/ 前缀下,不与 /hooks/:id 冲突(2 段 vs 1 段)
  server.get('/hooks/ab-test/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 A/B 测试 ID'))
    }
    const test = await getAbTest(request, params.data.id)
    return reply.send(success(test))
  })

  // 25. POST /hooks/ab-test/:id/stop — 停止 A/B 测试
  server.post('/hooks/ab-test/:id/stop', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 A/B 测试 ID'))
    }
    const result = await stopAbTest(request, params.data.id)
    return reply.send(success(result))
  })

  // 26. GET /hooks/templates — 列出 5 个预置模板
  server.get('/hooks/templates', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const templates = await listHookTemplates(request)
    return reply.send(success({ templates, count: templates.length }))
  })

  // 27. POST /hooks/templates/:id/instantiate — 用模板创建 hook
  //      注:此路径在 /templates/ 前缀下,不与 /hooks/:id 冲突
  server.post('/hooks/templates/:id/instantiate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的模板 ID'))
    }
    const parsed = instantiateTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const hook = await instantiateHookTemplate(request, params.data.id, parsed.data.overrides)
    return reply.send(success(hook))
  })

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

  // ===== 超越创新功能:动态子路径(2026-07-23 立)=====

  // 28. GET /hooks/:id/execution-timeline — Gantt 可视化数据(?since=ISO)
  server.get('/hooks/:id/execution-timeline', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const since = (request.query as { since?: string }).since
    const timeline = await getHookExecutionTimeline(request, params.data.id, since)
    return reply.send(success({ timeline, count: timeline.length }))
  })

  // 29. GET /hooks/:id/health-forecast — 健康预测(?days=7)
  server.get('/hooks/:id/health-forecast', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const params = idParamSchema.safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, '无效的 Hook ID'))
    }
    const daysQuery = (request.query as { days?: string }).days
    const days = daysQuery ? Math.min(30, Math.max(1, Number(daysQuery) || 7)) : 7
    const forecast = await getHookHealthForecast(request, params.data.id, days)
    return reply.send(success(forecast))
  })
}

export default hooksRoutes
