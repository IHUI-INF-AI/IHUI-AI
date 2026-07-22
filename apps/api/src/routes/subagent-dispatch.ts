/**
 * Subagent 派单 + Swarm 拓扑 Fastify 路由(2026-07-22 立,2026-07-22 深化)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/dispatch       创建派单(调 ai-service agent_orchestrator)
 *  - GET    /subagents/active         列出 pending/running 派单
 *  - POST   /subagents/:id/cancel     取消派单
 *  - GET    /subagents/topology       Swarm 拓扑(节点 + 边)
 *  - GET    /subagents/stats          全局统计(深化新增)
 *  - GET    /subagents/:id/stats      单个 dispatch 资源统计(深化新增)
 *
 * 深化:
 *  - 路由注册时注入 fastify.redis 到 service(Redis 持久化)
 *  - Zod schema 支持 retry 配置(maxAttempts + delayMs)
 *  - 并发超限时返回 429 concurrent_limit
 *
 * 鉴权:复用 packages/auth 的 authenticate(同 v1-apply-diff.ts 模式)
 * 校验:Zod
 * 响应:{ code: 0, message: 'success', data: ... }
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'

export const subagentDispatchRoutes: FastifyPluginAsync = async (server) => {
  // 注入 Redis 客户端(fastify.decorate 挂载后,服务初始化时从 app 拿取)
  // Redis 不可用时传 null,服务降级为内存 Map
  try {
    await subagentDispatchService.setRedisClient(server.redis ?? null)
  } catch {
    // Redis 初始化失败 → 降级内存,不阻塞路由注册
  }

  // 鉴权 helper(同 v1-apply-diff.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // ---------- Zod schemas ----------

  const retrySchema = z.object({
    maxAttempts: z.number().int().min(1).max(3).default(1),
    delayMs: z.number().int().min(0).default(1000),
  })

  const dispatchSchema = z.object({
    goal: z.string().min(1, '任务目标不能为空'),
    affectedFiles: z.array(z.string().min(1)).min(1, '至少一个受影响文件'),
    forbidden: z.array(z.string()).optional(),
    verifyCommands: z.array(z.string()).default([]),
    constraints: z.string().min(1, '约束边界不能为空'),
    deliverables: z.string().min(1, '交付物不能为空'),
    agentRole: z
      .enum(['researcher', 'coder', 'reviewer', 'architect', 'debugger'])
      .optional(),
    orchestration: z
      .enum([
        'pipeline',
        'parallel',
        'debate',
        'vote',
        'critique',
        'decomposed',
        'with_communication',
      ])
      .optional(),
    retry: retrySchema.optional(),
  })

  // ---------- POST /subagents/dispatch ----------

  server.post('/subagents/dispatch', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = dispatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    try {
      const result = await subagentDispatchService.dispatch(input)

      // 并发超限 → 429
      if (result.outcome === 'concurrent_limit') {
        return reply.status(429).send(
          error(429, result.error ?? '并发派单数已达上限'),
        )
      }

      // dispatch 仍创建(状态 pending → 异步转 running/completed/failed),
      // 这里返回创建成功的响应,前端通过 GET /active 或拓扑观察状态变化
      return reply.send(success({ dispatch: result.dispatch }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/active ----------

  server.get('/subagents/active', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const dispatches = subagentDispatchService.listActive()
    return reply.send(success({ dispatches }))
  })

  // ---------- POST /subagents/:id/cancel ----------

  server.post('/subagents/:id/cancel', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const cancelled = subagentDispatchService.cancel(id)
    if (!cancelled) {
      return reply
        .status(404)
        .send(error(404, '派单不存在或已结束(无法取消)'))
    }
    return reply.send(success({ cancelled: true }))
  })

  // ---------- GET /subagents/topology ----------

  server.get('/subagents/topology', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const topology = subagentDispatchService.getTopology()
    return reply.send(success({ topology }))
  })

  // ---------- GET /subagents/stats(全局统计,深化新增) ----------

  server.get('/subagents/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const stats = subagentDispatchService.getStats()
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/:id/stats(单个 dispatch 资源统计,深化新增) ----------

  server.get('/subagents/:id/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const stats = subagentDispatchService.getDispatchStats(id)
    if (!stats) {
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success(stats))
  })
}

export default subagentDispatchRoutes
