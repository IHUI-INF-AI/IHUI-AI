// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多智能体 Crew 路由。
 * 迁移自 v1.0.2-sealed: server/app/api/v1/crew/__init__.py (13 端点)
 *
 * 端点(注册前缀 /api/crew):
 * - GET  /health                健康检查
 * - GET  /agents                角色列表
 * - GET  /models                可用模型列表 (代理 clawdbot/models)
 * - POST /sessions              创建会话
 * - GET  /sessions              会话列表
 * - GET  /sessions/:id          会话详情
 * - GET  /sessions/:id/tasks    会话任务列表
 * - GET  /sessions/:id/messages 会话消息日志
 * - POST /sessions/:id/runs     触发同步执行
 * - GET  /runs/:id              获取运行状态 (复用 sessionId)
 * - GET  /runs/:id/stream       SSE 流式执行
 * - GET  /runs/:id/artifacts    运行产物列表
 * - POST /runs/:id/artifacts    手动添加产物
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { crewOrchestrator } from '../services/crew-orchestrator.js'
import { agentRegistry } from '../services/crew-agent-registry.js'
import { getModelManager } from '../services/clawdbot/index.js'
import { requireAuth, isSystemAdmin } from '../plugins/require-permission.js'

const createSessionSchema = z.object({
  /** 客户端自报的 userId 不再参与主体选择(身份唯一出口=令牌主体);保留键位仅为兼容既有调用方。 */
  userId: z.string().optional(),
  inputMessage: z.string().min(1),
  title: z.string().optional(),
  config: z
    .object({
      modelId: z.string().optional(),
      collectionName: z.string().optional(),
      maxRetries: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
})

const createArtifactSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().default('text'),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * 令牌主体的唯一出口。
 *
 * 立因:此前读 req.user —— @fastify/jwt 把该字段 decorateRequest 成 null,而本仓
 * authenticate() 走 jose 只写 request.userId(全仓对 req.user 零赋值点)⇒ 恒 undefined,
 * 于是 13 个端点全部退化为"采信客户端自报 userId",等于匿名越权。
 */
function requireAuthUser(req: FastifyRequest): string | undefined {
  return req.userId
}

/** admin 特权档:只认人用 JWT(internal 通道不得抬升,见 require-permission.ts O13b-③)。 */
const ADMIN_JWT_ONLY = { includeInternalChannel: false } as const

/**
 * 会话可达性:属主本人或系统管理员可见,其余一律按「不存在」回应(不留枚举面)。
 */
async function accessibleSession(req: FastifyRequest, sessionId: string) {
  const session = await crewOrchestrator.getSession(sessionId)
  if (!session) return null
  const principal = requireAuthUser(req)
  if (!principal) return null
  if (session.userId === principal) return session
  return isSystemAdmin(req, ADMIN_JWT_ONLY) ? session : null
}

export const crewRoutes: FastifyPluginAsync = async (server) => {
  // GET /health
  server.get('/health', async (_req, reply) => {
    return reply.send(success({ status: 'ok', service: 'crew-orchestrator' }))
  })

  // GET /agents - 角色列表
  server.get('/agents', async (_req, reply) => {
    return reply.send(success(agentRegistry.listRoles()))
  })

  // GET /models - 可用模型列表
  // 2026-10-27 安全加固(P0):原实现**完全无鉴权**,且原样返回 ModelConfig ——
  // 其中 apiKey 是平台上游密钥明文,匿名一次 GET 即可全部取走。现要求登录 + 脱敏视图。
  server.get('/models', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mm = getModelManager()
    return reply.send(success(mm.listPublic()))
  })

  // POST /sessions - 创建会话
  server.post('/sessions', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = createSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    const authUser = requireAuthUser(req)
    if (!authUser) {
      return reply.status(401).send(error(401, '未登录'))
    }
    try {
      const sessionId = await crewOrchestrator.createSession({
        userId: authUser,
        inputMessage: b.inputMessage,
        title: b.title,
        config: b.config,
      })
      return reply.send(success({ sessionId }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建会话失败'))
    }
  })

  // GET /sessions - 会话列表
  server.get('/sessions', { preHandler: [requireAuth] }, async (req, reply) => {
    const q = (req.query as { userId?: string; limit?: string }) ?? {}
    const limit = q.limit ? Math.max(1, Math.min(100, Number(q.limit))) : 20
    const authUser = requireAuthUser(req)
    if (!authUser) return reply.status(401).send(error(401, '未登录'))
    // 管理员可按 userId 审查(缺省=全量,与既有 admin/crew 页口径一致);
    // 普通用户只看自己的 —— 客户端参数不再参与主体选择。
    const userId = isSystemAdmin(req, ADMIN_JWT_ONLY) ? q.userId || '' : authUser
    try {
      const sessions = await crewOrchestrator.listSessions(userId, limit)
      return reply.send(success(sessions))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // GET /sessions/:id - 会话详情
  server.get('/sessions/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      const session = await accessibleSession(req, id)
      if (!session) return reply.status(404).send(error(404, '会话不存在'))
      return reply.send(success(session))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // GET /sessions/:id/tasks - 会话任务列表
  server.get('/sessions/:id/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      if (!(await accessibleSession(req, id)))
        return reply.status(404).send(error(404, '会话不存在'))
      const tasks = await crewOrchestrator.listTasks(id)
      return reply.send(success(tasks))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // GET /sessions/:id/messages - 会话消息日志
  server.get('/sessions/:id/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      if (!(await accessibleSession(req, id)))
        return reply.status(404).send(error(404, '会话不存在'))
      const messages = await crewOrchestrator.listMessages(id)
      return reply.send(success(messages))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // POST /sessions/:id/runs - 触发同步执行 (runId == sessionId)
  server.post('/sessions/:id/runs', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      if (!(await accessibleSession(req, id)))
        return reply.status(404).send(error(404, '会话不存在'))
      const result = await crewOrchestrator.executeSession(id)
      // G7: 集中扣费(幂等键 crew:<sessionId>,重复执行不重复扣)
      if (result.success && result.usage && result.usage.totalTokens > 0 && result.userId) {
        try {
          await server.tokenBalance.deductTokens(
            result.userId,
            result.usage.totalTokens,
            `crew_session:${id}`,
            `crew:${id}`,
          )
        } catch (e) {
          req.log.error({ err: e }, '[crew] 扣费失败(不阻塞响应)')
        }
      }
      if (!result.success) {
        return reply.status(400).send(error(400, result.error ?? '执行失败'))
      }
      return reply.send(success({ runId: id, result: result.result, usage: result.usage }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '执行失败'))
    }
  })

  // GET /runs/:id - 获取运行状态
  server.get('/runs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      const session = await accessibleSession(req, id)
      if (!session) return reply.status(404).send(error(404, '运行不存在'))
      return reply.send(success({ runId: id, status: session.status, session }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // GET /runs/:id/stream - SSE 流式执行
  server.get('/runs/:id/stream', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    if (!(await accessibleSession(req, id))) return reply.status(404).send(error(404, '会话不存在'))

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`)
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // 心跳保活
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(':heartbeat\n\n')
      } catch {
        /* client gone */
      }
    }, 15000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      // G9: 客户端断开时通知 orchestrator 中止 LLM 流,避免 _sessionUsage 泄漏 + session 永远 'running'
      crewOrchestrator.cancel(id)
    })

    try {
      for await (const evt of crewOrchestrator.executeSessionStreaming(id)) {
        send(evt.type, evt)
        // G7: complete 事件集中扣费(幂等键 crew:<sessionId>,重连不重复扣)
        if (evt.type === 'complete' && evt.usage && evt.usage.totalTokens > 0 && evt.userId) {
          try {
            await server.tokenBalance.deductTokens(
              evt.userId,
              evt.usage.totalTokens,
              `crew_session:${id}`,
              `crew:${id}`,
            )
          } catch (e) {
            req.log.error({ err: e }, '[crew] 流式扣费失败(不阻塞)')
          }
        }
        if (evt.type === 'complete' || evt.type === 'error') break
      }
    } catch (e) {
      send('error', {
        type: 'error',
        content: e instanceof Error ? e.message : String(e),
      })
    } finally {
      clearInterval(heartbeat)
      reply.raw.end()
    }
  })

  // GET /runs/:id/artifacts - 运行产物列表
  server.get('/runs/:id/artifacts', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    try {
      if (!(await accessibleSession(req, id)))
        return reply.status(404).send(error(404, '会话不存在'))
      const artifacts = await crewOrchestrator.listArtifacts(id)
      return reply.send(success(artifacts))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询失败'))
    }
  })

  // POST /runs/:id/artifacts - 手动添加产物
  server.post('/runs/:id/artifacts', { preHandler: [requireAuth] }, async (req, reply) => {
    const id = (req.params as { id: string }).id
    const parsed = createArtifactSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      if (!(await accessibleSession(req, id)))
        return reply.status(404).send(error(404, '会话不存在'))
      await crewOrchestrator.saveArtifact(id, b.name, b.type, b.content, b.metadata)
      return reply.send(success({ saved: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '保存失败'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
