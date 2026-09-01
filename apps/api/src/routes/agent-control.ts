// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 自动控制路由(2026-07-22 立,跨端:ai-service ↔ api ↔ extension/desktop)
 *
 * 设计:
 *  - extension/desktop 启动时上报能力(POST /capability)
 *  - ai-service MCP tool 调用 POST /execute,api 通过 WebSocket 推送给 extension/desktop
 *  - extension/desktop 执行后通过 POST /result 回传结果
 *  - api 用 pending Map 等待结果,超时 30s
 *
 * 端点:
 *  - POST   /capability   上报端能力(extension/desktop 启动时调用)
 *  - POST   /execute      执行控制指令(ai-service 调用)
 *  - POST   /result       回传执行结果(extension/desktop 调用)
 *  - GET    /status       查询已注册的端(管理/调试用)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import type { AgentActionRequest, AgentActionResponse, AgentControlCapability } from '@ihui/types'
import { authenticate, checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { toUserFriendlyMessage } from '@ihui/shared'

/**
 * 校验 Authorization: Bearer 是否等于内部服务密钥(时序安全比较)。
 * 长度不一致直接 false(避免 timingSafeEqual 抛错)。
 */
function isInternalSecret(authHeader: string | undefined): boolean {
  const internalSecret = process.env.AGENT_CONTROL_INTERNAL_SECRET ?? ''
  if (!internalSecret || !authHeader?.startsWith('Bearer ')) return false
  const bearer = authHeader.slice(7).trim()
  if (bearer.length === 0 || bearer.length !== internalSecret.length) return false
  return timingSafeEqual(Buffer.from(bearer, 'utf-8'), Buffer.from(internalSecret, 'utf-8'))
}

// ---------------------------------------------------------------------------
// 状态:已注册的端 + pending requests
// ---------------------------------------------------------------------------

interface RegisteredEndpoint {
  capability: AgentControlCapability
  userId: string
  lastSeen: number
}

/** instanceId → RegisteredEndpoint */
const _endpoints = new Map<string, RegisteredEndpoint>()

interface PendingRequest {
  resolve: (response: AgentActionResponse) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
  startedAt: number
}

/** requestId → PendingRequest */
const _pending = new Map<string, PendingRequest>()

/** 清理超过 5 分钟未上报的端 */
const ENDPOINT_TTL_MS = 5 * 60 * 1000

function cleanupStaleEndpoints(): void {
  const now = Date.now()
  for (const [id, ep] of _endpoints) {
    if (now - ep.lastSeen > ENDPOINT_TTL_MS) {
      _endpoints.delete(id)
    }
  }
}

/** 根据 category 找到最近活跃的端 */
function findEndpointByCategory(
  category: 'browser' | 'computer',
  userId?: string,
): RegisteredEndpoint | null {
  cleanupStaleEndpoints()
  const targetEndpoint = category === 'browser' ? 'extension' : 'desktop'
  let best: RegisteredEndpoint | null = null
  for (const ep of _endpoints.values()) {
    if (ep.capability.endpoint !== targetEndpoint) continue
    // 2026-08-16 修复:多用户隔离——指令带 userId 时只匹配该用户的端点,
    // 避免同一 api 实例上 LLM 指令被推送到其他用户的 desktop/extension。
    if (userId && ep.userId !== userId) continue
    if (!best || ep.lastSeen > best.lastSeen) {
      best = ep
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const capabilitySchema = z.object({
  endpoint: z.enum(['extension', 'desktop']),
  instanceId: z.string().min(1).max(100),
  browserActions: z.array(z.string()).max(100).optional(),
  computerActions: z.array(z.string()).max(100).optional(),
  version: z.string().optional(),
  reportedAt: z.string(),
})

const executeSchema = z.object({
  requestId: z.string().min(1).max(100),
  category: z.enum(['browser', 'computer']),
  action: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).default({}),
  toolCallId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  timeout: z.number().int().min(1000).max(120000).default(30000),
})

const resultSchema = z.object({
  requestId: z.string().min(1).max(100),
  success: z.boolean(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number(),
  executedBy: z.enum(['extension', 'desktop', 'unknown']),
})

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

export const agentControlRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /capability - 上报端能力
  // -------------------------------------------------------------------------
  server.post('/capability', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const result = capabilitySchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, '控制指令参数无效'))
    }
    const cap = result.data as AgentControlCapability

    _endpoints.set(cap.instanceId, {
      capability: cap,
      userId,
      lastSeen: Date.now(),
    })

    return reply.send(success({ registered: true, instanceId: cap.instanceId }))
  })

  // -------------------------------------------------------------------------
  // POST /execute - 执行控制指令(ai-service 调用)
  // -------------------------------------------------------------------------
  server.post('/execute', async (request, reply) => {
    // fail-closed 认证(2026-09-01 安全修复):此前 authenticate 失败即放行 +
    // userId 取自请求体,任何可达 8802 的进程可伪造 userId 越权控制已连接端。
    // 现要求:① Authorization: Bearer == AGENT_CONTROL_INTERNAL_SECRET(ai-service
    // 内部调用,ai-service 侧已带该 header);② 或携带合法用户 JWT(兼容历史)。
    // 两者皆无 → 401 拒绝。api 侧未配置密钥时仅 JWT 路径可用。
    let authed = isInternalSecret(request.headers.authorization)
    if (!authed) {
      try {
        await authenticate(request)
        authed = true
      } catch {
        authed = false
      }
    }
    if (!authed) {
      return reply.status(401).send(error(401, '未授权:缺少有效的内部密钥'))
    }

    const result = executeSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, '执行参数无效'))
    }
    const req = result.data as AgentActionRequest

    // 找到对应类型的端(带 userId 过滤,2026-08-16 多用户隔离)
    const ep = findEndpointByCategory(req.category, req.userId)
    if (!ep) {
      const response: AgentActionResponse = {
        requestId: req.requestId,
        success: false,
        error: `${req.category === 'browser' ? '浏览器扩展' : '桌面端'}未连接`,
        errorCode: 'TARGET_NOT_CONNECTED',
        durationMs: 0,
        executedBy: 'unknown',
      }
      return reply.send(success(response))
    }

    // 通过 WebSocket 推送给端
    const payload = {
      type: 'agent.action',
      request: req,
    }
    try {
      server.pushNotification(ep.userId, payload)
    } catch (err) {
      const response: AgentActionResponse = {
        requestId: req.requestId,
        success: false,
        error: `Failed to push notification: ${toUserFriendlyMessage(err)}`,
        errorCode: 'EXECUTION_FAILED',
        durationMs: 0,
        executedBy: 'unknown',
      }
      return reply.send(success(response))
    }

    // 等待结果(用 pending Map + Promise + 超时)
    const timeoutMs = req.timeout ?? 30000
    const responsePromise = new Promise<AgentActionResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (_pending.has(req.requestId)) {
          _pending.delete(req.requestId)
          resolve({
            requestId: req.requestId,
            success: false,
            error: `执行超时(${timeoutMs} 毫秒)`,
            errorCode: 'TIMEOUT',
            durationMs: timeoutMs,
            executedBy: 'unknown',
          })
        }
      }, timeoutMs)

      _pending.set(req.requestId, {
        resolve,
        reject,
        timer,
        startedAt: Date.now(),
      })
    })

    try {
      const response = await responsePromise
      return reply.send(success(response))
    } catch (err) {
      return reply.status(500).send(error(500, toUserFriendlyMessage(err)))
    }
  })

  // -------------------------------------------------------------------------
  // POST /result - 回传执行结果(extension/desktop 调用)
  // -------------------------------------------------------------------------
  server.post('/result', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

    const result = resultSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send(error(400, 'Invalid result payload'))
    }
    const res = result.data as AgentActionResponse

    const pending = _pending.get(res.requestId)
    if (!pending) {
      // 已经超时或已被处理,静默丢弃
      return reply.send(success({ accepted: false, reason: 'request not found or timed out' }))
    }

    clearTimeout(pending.timer)
    _pending.delete(res.requestId)
    pending.resolve(res)

    return reply.send(success({ accepted: true }))
  })

  // -------------------------------------------------------------------------
  // GET /status - 查询已注册的端(管理/调试用)
  // -------------------------------------------------------------------------
  server.get('/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return

    cleanupStaleEndpoints()
    const endpoints = Array.from(_endpoints.values()).map((ep) => ({
      endpoint: ep.capability.endpoint,
      instanceId: ep.capability.instanceId,
      version: ep.capability.version,
      lastSeen: new Date(ep.lastSeen).toISOString(),
      browserActions: ep.capability.browserActions?.length ?? 0,
      computerActions: ep.capability.computerActions?.length ?? 0,
    }))

    return reply.send(
      success({
        endpoints,
        pendingRequests: _pending.size,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
