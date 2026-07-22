/**
 * Subagent 派单 + Swarm 拓扑 Fastify 路由(2026-07-22 立,2026-07-22 深化 v2,2026-07-23 超越 v3)。
 *
 * 路径(server.ts 用 prefix:'/api' 注册 → 最终 /api/subagents/*):
 *  - POST   /subagents/dispatch       创建派单(调 ai-service agent_orchestrator)
 *  - GET    /subagents/active         列出 pending/running 派单
 *  - POST   /subagents/:id/cancel     取消派单
 *  - POST   /subagents/:id/resume     从 checkpoint 恢复(深化 v2 新增)
 *  - GET    /subagents/topology       Swarm 拓扑(节点 + 边)
 *  - GET    /subagents/stats          全局统计(深化新增)
 *  - GET    /subagents/:id/stats      单个 dispatch 资源统计(深化新增)
 *  - GET    /subagents/:id/dag        DAG 可视化数据(深化 v2 新增)
 *  - GET    /subagents/queue          优先级调度队列(深化 v2 新增)
 *  - GET    /subagents/:id/quotas     资源配额使用情况(深化 v2 新增)
 *  - GET    /subagents/:id/messages   with_communication 消息列表(深化 v2 新增)
 *
 * 超越 v3(自演化 + 拓扑自优化 + 角色自动生成 + 协作协议增强):
 *  - POST   /subagents/auto-plan                      LLM 推荐编排模式 + DAG
 *  - POST   /subagents/roles/auto-generate            LLM 根据任务生成定制角色
 *  - GET    /subagents/roles/custom                   列出所有自定义角色
 *  - POST   /subagents/roles/custom                   创建自定义角色
 *  - PUT    /subagents/roles/custom/:id               更新自定义角色
 *  - DELETE /subagents/roles/custom/:id               删除自定义角色
 *  - GET    /subagents/agents/:role/evolution-history 查看 agent 演化历史
 *  - POST   /subagents/agents/:role/evolve            触发 prompt 演化分析
 *  - POST   /subagents/agents/:role/apply-evolution   应用 prompt 补丁(需用户确认)
 *  - GET    /subagents/:id/collaboration              获取协作记录(9 种协作消息)
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
import type {
  AutoPlanRequest,
  CustomRoleInput,
  AutoGenerateRoleRequest,
  PromptPatch,
  CollaborationMessageType,
} from '../services/subagent-dispatch-service.js'

export const subagentDispatchRoutes: FastifyPluginAsync = async (server) => {
  // 注入 Redis 客户端(fastify.decorate 挂载后,服务初始化时从 app 拿取)
  try {
    await subagentDispatchService.setRedisClient(server.redis ?? null)
  } catch {
    // Redis 初始化失败 → 降级内存,不阻塞路由注册
  }

  // 鉴权 helper
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

  const quotasSchema = z.object({
    timeoutMs: z.number().int().min(1000).max(3_600_000).default(300_000),
    tokenQuota: z.number().int().min(1000).max(1_000_000).default(50_000),
    maxRetries: z.number().int().min(0).max(3).default(2),
  })

  const dagNodeSchema = z.object({
    id: z.string().min(1),
    agentRole: z.enum(['researcher', 'coder', 'reviewer', 'architect', 'debugger']),
    task: z.string().min(1),
  })

  const dagEdgeSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    condition: z.string().optional(),
  })

  const dagSchema = z.object({
    nodes: z.array(dagNodeSchema).min(1),
    edges: z.array(dagEdgeSchema).default([]),
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
    dag: dagSchema.optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    quotas: quotasSchema.optional(),
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

      // DAG 循环依赖 → 400
      if (result.outcome === 'cyclic_dependency') {
        return reply.status(400).send(
          error(400, result.error ?? 'DAG 存在循环依赖'),
        )
      }

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

  // ---------- POST /subagents/:id/resume(深化 v2 新增) ----------

  server.post('/subagents/:id/resume', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    try {
      const result = await subagentDispatchService.resume(id)
      if (!result.resumed) {
        return reply.status(400).send(error(400, result.error ?? '无法恢复'))
      }
      return reply.send(success(result))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/topology ----------

  server.get('/subagents/topology', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const topology = subagentDispatchService.getTopology()
    return reply.send(success({ topology }))
  })

  // ---------- GET /subagents/stats(全局统计) ----------

  server.get('/subagents/stats', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const stats = subagentDispatchService.getStats()
    return reply.send(success(stats))
  })

  // ---------- GET /subagents/queue(优先级调度队列,深化 v2 新增) ----------
  // 注意:此路由必须在 /:id/stats 之前注册,否则 'queue' 会被当作 :id

  server.get('/subagents/queue', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const queue = subagentDispatchService.getQueue()
    return reply.send(success({ queue }))
  })

  // ---------- GET /subagents/:id/stats(单个 dispatch 资源统计) ----------

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

  // ---------- GET /subagents/:id/dag(DAG 可视化数据,深化 v2 新增) ----------

  server.get('/subagents/:id/dag', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const dag = subagentDispatchService.getDag(id)
    if (!dag) {
      return reply.status(404).send(error(404, '派单不存在或无 DAG 配置'))
    }
    return reply.send(success(dag))
  })

  // ---------- GET /subagents/:id/quotas(资源配额使用情况,深化 v2 新增) ----------

  server.get('/subagents/:id/quotas', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const quotas = subagentDispatchService.getQuotas(id)
    if (!quotas) {
      return reply.status(404).send(error(404, '派单不存在'))
    }
    return reply.send(success(quotas))
  })

  // ---------- GET /subagents/:id/messages(with_communication 消息列表,深化 v2 新增) ----------

  server.get('/subagents/:id/messages', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const messages = subagentDispatchService.getMessages(id)
    return reply.send(success({ messages }))
  })

  // ===========================================================================
  // 超越 v3:自演化 + 拓扑自优化 + 角色自动生成 + 协作协议增强
  // ===========================================================================

  // ---------- POST /subagents/auto-plan(LLM 推荐编排模式 + DAG) ----------

  const autoPlanSchema = z.object({
    task: z.string().min(1, '任务描述不能为空'),
    constraints: z
      .object({
        maxAgents: z.number().int().min(1).max(20).optional(),
        maxDuration: z.number().int().min(1000).optional(),
      })
      .optional(),
  })

  server.post('/subagents/auto-plan', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoPlanSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await subagentDispatchService.autoPlan(parsed.data as AutoPlanRequest)
      return reply.send(success(result))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- POST /subagents/roles/auto-generate(LLM 根据任务生成定制角色) ----------

  const autoGenerateRoleSchema = z.object({
    task: z.string().min(1, '任务描述不能为空'),
    existingRoles: z.array(z.string()).optional(),
  })

  server.post('/subagents/roles/auto-generate', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = autoGenerateRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const result = await subagentDispatchService.autoGenerateRole(
        parsed.data as AutoGenerateRoleRequest,
      )
      return reply.send(success(result))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/roles/custom(列出所有自定义角色) ----------

  server.get('/subagents/roles/custom', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    try {
      const roles = await subagentDispatchService.listCustomRoles()
      return reply.send(success({ roles }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- POST /subagents/roles/custom(创建自定义角色) ----------

  const createCustomRoleSchema = z.object({
    role: z.string().min(1, '角色技术名不能为空'),
    displayName: z.string().min(1, '显示名不能为空'),
    systemPrompt: z.string().min(1, 'systemPrompt 不能为空'),
    skills: z.array(z.string()).optional(),
    recommendedTasks: z.array(z.string()).optional(),
  })

  server.post('/subagents/roles/custom', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = createCustomRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const role = await subagentDispatchService.createCustomRole(
        parsed.data as CustomRoleInput,
      )
      return reply.send(success({ role }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- PUT /subagents/roles/custom/:id(更新自定义角色) ----------

  const updateCustomRoleSchema = z.object({
    role: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    systemPrompt: z.string().min(1).optional(),
    skills: z.array(z.string()).optional(),
    recommendedTasks: z.array(z.string()).optional(),
  })

  server.put('/subagents/roles/custom/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '角色 ID 不能为空'))
    }

    const parsed = updateCustomRoleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const role = await subagentDispatchService.updateCustomRole(
        id,
        parsed.data as Partial<CustomRoleInput>,
      )
      if (!role) {
        return reply.status(404).send(error(404, '自定义角色不存在'))
      }
      return reply.send(success({ role }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- DELETE /subagents/roles/custom/:id(删除自定义角色) ----------

  server.delete('/subagents/roles/custom/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '角色 ID 不能为空'))
    }

    try {
      const deleted = await subagentDispatchService.deleteCustomRole(id)
      return reply.send(success({ deleted }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/agents/:role/evolution-history(查看 agent 演化历史) ----------

  server.get('/subagents/agents/:role/evolution-history', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }
    if (!role) {
      return reply.status(400).send(error(400, '角色名不能为空'))
    }

    try {
      const history = await subagentDispatchService.getEvolutionHistory(role)
      return reply.send(success(history))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- POST /subagents/agents/:role/evolve(触发 prompt 演化分析) ----------

  server.post('/subagents/agents/:role/evolve', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }
    if (!role) {
      return reply.status(400).send(error(400, '角色名不能为空'))
    }

    try {
      const analysis = await subagentDispatchService.evolveAgentPrompt(role)
      return reply.send(success(analysis))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- POST /subagents/agents/:role/apply-evolution(应用 prompt 补丁,需用户确认) ----------

  const applyEvolutionSchema = z.object({
    patches: z
      .array(
        z.object({
          originalText: z.string().min(1),
          suggestedReplacement: z.string(),
          reason: z.string(),
        }),
      )
      .min(1, '至少一个补丁'),
  })

  server.post('/subagents/agents/:role/apply-evolution', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { role } = request.params as { role: string }
    if (!role) {
      return reply.status(400).send(error(400, '角色名不能为空'))
    }

    const parsed = applyEvolutionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const version = await subagentDispatchService.applyEvolution(
        role,
        parsed.data.patches as PromptPatch[],
      )
      return reply.send(success({ version }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- GET /subagents/:id/collaboration(获取协作记录) ----------

  server.get('/subagents/:id/collaboration', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    try {
      const record = await subagentDispatchService.getCollaboration(id)
      if (!record) {
        return reply.status(404).send(error(404, '无协作记录'))
      }
      return reply.send(success(record))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // ---------- POST /subagents/:id/collaboration(发送协作消息,扩展 with_communication) ----------

  const collaborationMessageSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    collaborationType: z.enum([
      'question',
      'answer',
      'result',
      'request_help',
      'propose_plan',
      'object',
      'accept',
      'delegate',
      'share_context',
    ]),
    content: z.string().min(1),
    planId: z.string().optional(),
    delegatedTo: z.string().optional(),
  })

  server.post('/subagents/:id/collaboration', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = request.params as { id: string }
    if (!id) {
      return reply.status(400).send(error(400, '派单 ID 不能为空'))
    }

    const parsed = collaborationMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    try {
      const msg = await subagentDispatchService.recordCollaboration(id, {
        ...parsed.data,
        type: 'result', // 基础类型(CommunicationMessage.type),扩展类型在 collaborationType
        collaborationType: parsed.data.collaborationType as CollaborationMessageType,
      })
      return reply.send(success({ message: msg }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })
}

export default subagentDispatchRoutes
