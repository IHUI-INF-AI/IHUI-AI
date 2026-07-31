/**
 * /v1/mcp/* MCP 网关对外暴露端点(2026-07-31 立,补齐 New API 已有的扩展能力)。
 *
 * 新增能力:让外部客户端(IDE / Agent SDK)通过 Bearer API Key 鉴权,
 * 经 API 层转发到 ai-service 的 MCP 端点,获取工具列表 / 调用工具 / 读取资源。
 *
 * 端点清单:
 * 1. GET  /v1/mcp/tools          — 列出全部 MCP 工具
 * 2. POST /v1/mcp/tools/call     — 调用指定 MCP 工具(带计费)
 * 3. POST /v1/mcp/resources/read — 读取指定 URI 的 MCP 资源
 *
 * 待主 agent 在 routes/index.ts 注册:v1McpGatewayRoutes
 *
 * 鉴权:Bearer API Key(api-key-auth 插件 requireApiKeyAuth)
 * 转发:fetch 到 ai-service,附加 X-Internal-Auth 头(从 process.env.AI_SERVICE_INTERNAL_TOKEN 读,
 *       回退到 config.AI_CALLBACK_SECRET)
 * 计费:tools/call 走 relay-billing-service(model=mcp-tool-{name})
 *
 * 错误码:
 * - 401:API Key 无效
 * - 1003:模型不在白名单(需用户添加 mcp-* 到 allowedModels)
 * - 5015:ai-service 不可用(网络错误 / 连接超时)
 * - 502:ai-service 返回错误(非 2xx 响应)
 *
 * ai-service MCP 端点(参考 apps/ai-service/app/routers/mcp.py):
 * - GET  /mcp/tools              → {tools: [...], count: N}
 * - POST /mcp/tools/call         → body {name, arguments} → result
 * - GET  /mcp/resources/{uri}    → resource content(本网关用 POST + body {uri} 转发)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { config } from '../config/index.js'
import { requireApiKeyAuth, modelInList } from '../plugins/api-key-auth.js'
import { recordCall } from '../services/relay-billing-service.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// 配置:ai-service 内部调用 token
// =============================================================================

/** 内部服务认证 token:优先 AI_SERVICE_INTERNAL_TOKEN,回退 AI_CALLBACK_SECRET */
const INTERNAL_TOKEN: string = process.env.AI_SERVICE_INTERNAL_TOKEN || config.AI_CALLBACK_SECRET

// =============================================================================
// 类型定义
// =============================================================================

/** 转发结果:成功返回 data,失败返回错误码 + HTTP 状态 + 消息 */
type ForwardResult =
  { ok: true; data: unknown } | { ok: false; code: number; httpStatus: number; message: string }

// =============================================================================
// Zod schema:请求体校验
// =============================================================================

const toolCallBodySchema = z.object({
  name: z.string().min(1).max(200),
  arguments: z.record(z.unknown()).default({}),
})

const resourceReadBodySchema = z.object({
  uri: z.string().min(1).max(2000),
})

// =============================================================================
// 内部辅助:转发到 ai-service
// =============================================================================

/**
 * 转发请求到 ai-service MCP 端点。
 *
 * @param path     ai-service 路径(如 /mcp/tools)
 * @param method   HTTP 方法
 * @param body     请求体(POST 时传入,GET 时传 undefined)
 * @param userId   用户 ID(透传给 ai-service 做 user 上下文)
 * @returns ForwardResult:成功 {ok:true, data} / 失败 {ok:false, code, httpStatus, message}
 */
async function forwardToAiService(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
  userId?: string,
): Promise<ForwardResult> {
  const url = `${config.AI_SERVICE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (INTERNAL_TOKEN) {
    headers['X-Internal-Auth'] = INTERNAL_TOKEN
  }
  if (userId) {
    headers['X-User-Id'] = userId
  }

  let resp: Response
  try {
    resp = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // 网络错误 / 连接超时 → ai-service 不可用
    return { ok: false, code: 5015, httpStatus: 503, message: 'ai-service 不可用' }
  }

  if (!resp.ok) {
    // ai-service 返回非 2xx → 502 网关错误
    const errText = await resp.text().catch(() => '')
    const snippet = errText.slice(0, 300) || `HTTP ${resp.status}`
    return {
      ok: false,
      code: 502,
      httpStatus: 502,
      message: `ai-service 返回错误: ${snippet}`,
    }
  }

  try {
    const data = await resp.json()
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      code: 502,
      httpStatus: 502,
      message: 'ai-service 返回了无效的 JSON',
    }
  }
}

/**
 * 检查 API Key 的 allowedModels 是否允许 mcp-tools。
 * allowedModels 为 null/空数组 = 不限制;非空时需包含 mcp-* 或 mcp-tools。
 *
 * @returns true=允许 / false=不在白名单
 */
function isMcpToolsAllowed(allowedModels: string[] | null): boolean {
  if (!allowedModels || allowedModels.length === 0) return true
  return modelInList('mcp-tools', allowedModels)
}

// =============================================================================
// Fastify 路由插件
// =============================================================================

const v1McpGatewayRoutes: FastifyPluginAsync = async (server) => {
  // 所有 /v1/mcp/* 端点统一走 API Key 鉴权
  server.addHook('preHandler', requireApiKeyAuth)

  // ===== 1. GET /v1/mcp/tools — 列出全部 MCP 工具 =====
  server.get('/v1/mcp/tools', async (request, reply) => {
    const apiKey = request.apiKey
    if (!apiKey) {
      return reply.status(401).send(error(401, 'API key authentication required'))
    }

    // 模型白名单检查:mcp-tools 默认不在白名单,需用户添加 mcp-*
    if (!isMcpToolsAllowed(apiKey.allowedModels)) {
      return reply
        .status(403)
        .send(error(1003, '模型不在白名单,请添加 mcp-* 到 API Key 的 allowedModels'))
    }

    const result = await forwardToAiService('/mcp/tools', 'GET', undefined, apiKey.userId)
    if (!result.ok) {
      return reply.status(result.httpStatus).send(error(result.code, result.message))
    }
    return reply.send(success(result.data))
  })

  // ===== 2. POST /v1/mcp/tools/call — 调用指定 MCP 工具 =====
  server.post('/v1/mcp/tools/call', async (request, reply) => {
    const apiKey = request.apiKey
    if (!apiKey) {
      return reply.status(401).send(error(401, 'API key authentication required'))
    }

    // 模型白名单检查
    if (!isMcpToolsAllowed(apiKey.allowedModels)) {
      return reply
        .status(403)
        .send(error(1003, '模型不在白名单,请添加 mcp-* 到 API Key 的 allowedModels'))
    }

    // 校验请求体
    const parsed = toolCallBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, arguments: args } = parsed.data
    const startTime = Date.now()

    // 转发到 ai-service
    const result = await forwardToAiService(
      '/mcp/tools/call',
      'POST',
      { name, arguments: args },
      apiKey.userId,
    )

    if (!result.ok) {
      // 记录失败调用(计费 TODO:由主 agent 后续整合按 tool 调用次数计费逻辑)
      // TODO(主 agent):MCP tool 计费整合 — 目前按 0 token 记录,model=mcp-tool-{name},
      // 后续需接入 per-tool 定价表(部分 tool 可能按调用次数收费,而非 token)
      void recordCall({
        apiKeyId: apiKey.id,
        userId: apiKey.userId,
        model: `mcp-tool-${name}`,
        prompt: JSON.stringify({ name, arguments: args }),
        response: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - startTime,
        status: 'error',
        errorMessage: result.message,
        metadata: { protocol: 'mcp-gateway', toolName: name },
        clientIp: request.ip,
      }).catch(() => {})
      return reply.status(result.httpStatus).send(error(result.code, result.message))
    }

    // 记录成功调用(计费 TODO:同上)
    void recordCall({
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      model: `mcp-tool-${name}`,
      prompt: JSON.stringify({ name, arguments: args }),
      response: JSON.stringify(result.data).slice(0, 2000),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: Date.now() - startTime,
      status: 'success',
      metadata: { protocol: 'mcp-gateway', toolName: name },
      clientIp: request.ip,
    }).catch(() => {})

    return reply.send(success(result.data))
  })

  // ===== 3. POST /v1/mcp/resources/read — 读取指定 URI 的 MCP 资源 =====
  server.post('/v1/mcp/resources/read', async (request, reply) => {
    const apiKey = request.apiKey
    if (!apiKey) {
      return reply.status(401).send(error(401, 'API key authentication required'))
    }

    // 模型白名单检查
    if (!isMcpToolsAllowed(apiKey.allowedModels)) {
      return reply
        .status(403)
        .send(error(1003, '模型不在白名单,请添加 mcp-* 到 API Key 的 allowedModels'))
    }

    // 校验请求体
    const parsed = resourceReadBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { uri } = parsed.data

    // ai-service 用 GET /mcp/resources/{uri:path} 读取资源
    // 本网关接受 POST + body {uri},转发时转为 GET + path 参数
    const encodedUri = encodeURIComponent(uri)
    const result = await forwardToAiService(
      `/mcp/resources/${encodedUri}`,
      'GET',
      undefined,
      apiKey.userId,
    )

    if (!result.ok) {
      return reply.status(result.httpStatus).send(error(result.code, result.message))
    }
    return reply.send(success(result.data))
  })
}

export default v1McpGatewayRoutes
