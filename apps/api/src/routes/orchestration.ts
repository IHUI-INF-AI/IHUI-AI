/**
 * 跨支柱编排中枢路由 — Fastify 转发层(2026-07-23 立)。
 *
 * 端点清单(全部 JWT 鉴权):
 *  编排中枢:
 *   1. GET    /orchestration/status           — 中枢状态
 *   2. GET    /orchestration/dashboard        — 编排仪表盘
 *   3. GET    /orchestration/events            — 事件流(?limit=&pillar=&event_type=)
 *   4. POST   /orchestration/events/emit      — 发射事件
 *   5. GET    /orchestration/events/stats      — 事件统计
 *   6. GET    /orchestration/playbooks         — 列出 playbook
 *   7. POST   /orchestration/playbooks/:id/toggle — 启用/禁用
 *   8. GET    /orchestration/decisions         — 决策历史
 *
 *  LLM 预算治理:
 *   9. POST   /orchestration/budget/record     — 记录用量
 *  10. POST   /orchestration/budget/check       — 检查预算
 *  11. GET    /orchestration/budget/summary     — 用量汇总
 *  12. GET    /orchestration/budget/trend       — 用量趋势
 *  13. GET    /orchestration/budget/pillar/:pillar — 支柱预算
 *  14. POST   /orchestration/budget/pillar/:pillar/reset — 重置降级
 *  15. PATCH  /orchestration/budget/config     — 更新配置
 *  16. GET    /orchestration/budget/cost-breakdown — 成本分解
 *
 *  统一遥测:
 *  17. GET    /orchestration/telemetry/metrics  — metrics(?format=json|prometheus)
 *  18. GET    /orchestration/telemetry/health   — 各支柱健康
 *  19. GET    /orchestration/telemetry/dashboard — 遥测仪表盘
 *  20. GET    /orchestration/telemetry/traces    — 最近 traces
 *  21. GET    /orchestration/telemetry/traces/:trace_id — trace 详情
 *
 * 路径前缀:在 server.ts 用 prefix:'/api' 注册 → /api/orchestration/*
 * 全部转发到 ai-service /api/orchestration/*
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  getHubStatus,
  getHubDashboard,
  getEventFeed,
  emitEvent,
  getEventStats,
  getPlaybooks,
  togglePlaybook,
  getDecisions,
  recordBudgetUsage,
  checkBudget,
  getBudgetSummary,
  getBudgetTrend,
  getPillarBudget,
  resetPillarDegradation,
  updateBudgetConfig,
  getCostBreakdown,
  getMetrics,
  getTelemetryHealth,
  getTelemetryDashboard,
  getRecentTraces,
  getTraceDetail,
} from '../services/orchestration-service.js'

const PILLAR_VALUES = [
  'rules',
  'hook',
  'spec',
  'context',
  'subagent',
  'terminal',
  'budget',
] as const

const SEVERITY_VALUES = ['info', 'warning', 'critical'] as const

const PILLAR_EVENT_TYPE_VALUES = [
  'rules.matched',
  'rules.violated',
  'rules.conflict_resolved',
  'rules.auto_generated',
  'hook.emitted',
  'hook.failed',
  'hook.health_degraded',
  'hook.ab_test_completed',
  'spec.generated',
  'spec.approved',
  'spec.rejected',
  'spec.task_split',
  'spec.patch_applied',
  'context.compressed',
  'context.enriched',
  'context.behavior_recorded',
  'subagent.dispatched',
  'subagent.completed',
  'subagent.failed',
  'subagent.evolved',
  'terminal.command_failed',
  'terminal.command_succeeded',
  'terminal.ai_diagnosed',
  'terminal.recording_completed',
  'budget.exceeded',
  'budget.warning',
] as const

const emitEventSchema = z.object({
  event_type: z.enum(PILLAR_EVENT_TYPE_VALUES),
  source_pillar: z.enum(PILLAR_VALUES),
  payload: z.record(z.unknown()).default({}),
  severity: z.enum(SEVERITY_VALUES).default('info'),
})

const togglePlaybookSchema = z.object({
  enabled: z.boolean(),
})

const recordUsageSchema = z.object({
  pillar: z.enum(PILLAR_VALUES),
  model: z.string().min(1),
  input_tokens: z.number().int().min(0).default(0),
  output_tokens: z.number().int().min(0).default(0),
  action: z.string().default(''),
  request_id: z.string().optional().default(''),
})

const checkBudgetSchema = z.object({
  pillar: z.enum(PILLAR_VALUES),
  estimated_tokens: z.number().int().min(0).default(0),
})

const budgetConfigSchema = z.object({
  daily_token_limit: z.number().int().positive().optional(),
  daily_cost_limit_usd: z.number().positive().optional(),
  hourly_token_limit: z.number().int().positive().optional(),
  warning_threshold: z.number().min(0).max(1).optional(),
  critical_threshold: z.number().min(0).max(1).optional(),
  auto_degrade_at: z.number().min(0).max(1).optional(),
  hard_stop_at: z.number().min(0).max(1).optional(),
})

export const orchestrationRoutes: FastifyPluginAsync = async (server) => {
  // -----------------------------------------------------------------------
  // 编排中枢
  // -----------------------------------------------------------------------

  server.get('/orchestration/status', { preHandler: authenticate }, async (req, reply) => {
    const data = await getHubStatus(req)
    if (!data) return reply.status(503).send(error(503, '编排中枢不可用'))
    return reply.send(success(data))
  })

  server.get(
    '/orchestration/dashboard',
    { preHandler: authenticate },
    async (req, reply) => {
      const data = await getHubDashboard(req)
      if (!data) return reply.status(503).send(error(503, '编排仪表盘不可用'))
      return reply.send(success(data))
    },
  )

  server.get('/orchestration/events', { preHandler: authenticate }, async (req, reply) => {
    const { limit, pillar, event_type } = req.query as {
      limit?: string
      pillar?: string
      event_type?: string
    }
    const data = await getEventFeed(
      req,
      limit ? Math.min(parseInt(limit, 10) || 50, 500) : 50,
      pillar,
      event_type,
    )
    return reply.send(success(data ?? []))
  })

  server.post(
    '/orchestration/events/emit',
    { preHandler: authenticate },
    async (req, reply) => {
      const parsed = emitEventSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = await emitEvent(req, parsed.data)
      if (!data) return reply.status(503).send(error(503, '事件发射失败'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/events/stats',
    { preHandler: authenticate },
    async (req, reply) => {
      const { window_hours } = req.query as { window_hours?: string }
      const data = await getEventStats(
        req,
        window_hours ? Math.min(parseInt(window_hours, 10) || 24, 168) : 24,
      )
      return reply.send(success(data ?? {}))
    },
  )

  server.get(
    '/orchestration/playbooks',
    { preHandler: authenticate },
    async (req, reply) => {
      const data = await getPlaybooks(req)
      return reply.send(success(data ?? []))
    },
  )

  server.post(
    '/orchestration/playbooks/:id/toggle',
    { preHandler: authenticate },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const parsed = togglePlaybookSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = await togglePlaybook(req, id, parsed.data.enabled)
      if (!data) return reply.status(404).send(error(404, 'playbook 不存在'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/decisions',
    { preHandler: authenticate },
    async (req, reply) => {
      const { limit } = req.query as { limit?: string }
      const data = await getDecisions(
        req,
        limit ? Math.min(parseInt(limit, 10) || 50, 500) : 50,
      )
      return reply.send(success(data ?? []))
    },
  )

  // -----------------------------------------------------------------------
  // LLM 预算治理
  // -----------------------------------------------------------------------

  server.post(
    '/orchestration/budget/record',
    { preHandler: authenticate },
    async (req, reply) => {
      const parsed = recordUsageSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = await recordBudgetUsage(req, parsed.data)
      if (!data) return reply.status(503).send(error(503, '用量记录失败'))
      return reply.send(success(data))
    },
  )

  server.post(
    '/orchestration/budget/check',
    { preHandler: authenticate },
    async (req, reply) => {
      const parsed = checkBudgetSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = await checkBudget(req, parsed.data.pillar, parsed.data.estimated_tokens)
      if (!data) return reply.status(503).send(error(503, '预算检查失败'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/budget/summary',
    { preHandler: authenticate },
    async (req, reply) => {
      const { period } = req.query as { period?: string }
      const data = await getBudgetSummary(req, period ?? 'today')
      if (!data) return reply.status(503).send(error(503, '用量汇总不可用'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/budget/trend',
    { preHandler: authenticate },
    async (req, reply) => {
      const { days } = req.query as { days?: string }
      const data = await getBudgetTrend(req, days ? parseInt(days, 10) || 7 : 7)
      return reply.send(success(data ?? []))
    },
  )

  server.get(
    '/orchestration/budget/pillar/:pillar',
    { preHandler: authenticate },
    async (req, reply) => {
      const { pillar } = req.params as { pillar: string }
      const data = await getPillarBudget(req, pillar)
      if (!data) return reply.status(503).send(error(503, '支柱预算不可用'))
      return reply.send(success(data))
    },
  )

  server.post(
    '/orchestration/budget/pillar/:pillar/reset',
    { preHandler: authenticate },
    async (req, reply) => {
      const { pillar } = req.params as { pillar: string }
      const data = await resetPillarDegradation(req, pillar)
      if (!data) return reply.status(503).send(error(503, '重置失败'))
      return reply.send(success(data))
    },
  )

  server.patch(
    '/orchestration/budget/config',
    { preHandler: authenticate },
    async (req, reply) => {
      const parsed = budgetConfigSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const data = await updateBudgetConfig(req, parsed.data)
      if (!data) return reply.status(503).send(error(503, '配置更新失败'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/budget/cost-breakdown',
    { preHandler: authenticate },
    async (req, reply) => {
      const { period } = req.query as { period?: string }
      const data = await getCostBreakdown(req, period ?? 'today')
      if (!data) return reply.status(503).send(error(503, '成本分解不可用'))
      return reply.send(success(data))
    },
  )

  // -----------------------------------------------------------------------
  // 统一遥测
  // -----------------------------------------------------------------------

  server.get(
    '/orchestration/telemetry/metrics',
    { preHandler: authenticate },
    async (req, reply) => {
      const { format } = req.query as { format?: string }
      const data = await getMetrics(req, format ?? 'json')
      if (!data) return reply.status(503).send(error(503, 'metrics 不可用'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/telemetry/health',
    { preHandler: authenticate },
    async (req, reply) => {
      const data = await getTelemetryHealth(req)
      return reply.send(success(data ?? {}))
    },
  )

  server.get(
    '/orchestration/telemetry/dashboard',
    { preHandler: authenticate },
    async (req, reply) => {
      const data = await getTelemetryDashboard(req)
      if (!data) return reply.status(503).send(error(503, '遥测仪表盘不可用'))
      return reply.send(success(data))
    },
  )

  server.get(
    '/orchestration/telemetry/traces',
    { preHandler: authenticate },
    async (req, reply) => {
      const { limit } = req.query as { limit?: string }
      const data = await getRecentTraces(
        req,
        limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
      )
      return reply.send(success(data ?? []))
    },
  )

  server.get(
    '/orchestration/telemetry/traces/:trace_id',
    { preHandler: authenticate },
    async (req, reply) => {
      const { trace_id } = req.params as { trace_id: string }
      const data = await getTraceDetail(req, trace_id)
      return reply.send(success(data ?? []))
    },
  )
}
