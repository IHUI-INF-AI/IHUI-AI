/**
 * Chat 多模型直连端点（迁移自旧架构 server/app/api/v1/chat/）。
 *
 * 9 个模型直连模块：
 *   deepseek / deepseek_ws / kling / multi / qwen / qwen_omni / zhipu / history / coze
 *
 * 注册(server.ts):
 *   server.register(chatModelRoutes, { prefix: '/api/chat' })
 *
 * 环境变量:
 *   DEEPSEEK_API_KEY / DASHSCOPE_API_KEY(或 QWEN_API_KEY) / ZHIPU_API_KEY
 *   KLING_ACCESS_KEY + KLING_SECRET_KEY
 *   COZE_API_KEY(或 COZE_PRIVATE_KEY) / COZE_API_BASE
 *   OPENROUTER_API_KEY / LUYALA_API_KEY / FREELLMAPI_BASE_URL / FREELLMAPI_API_KEY 等(multi)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { SignJWT } from 'jose'
import { authenticate } from '../plugins/auth.js'
import { verifyAccessToken } from '@ihui/auth'
import { success, error } from '../utils/response.js'
import { degradedMode, getBulkhead } from '../plugins/resilience-extended.js'

// ============================================================================
// 鉴权辅助
// ============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

/** 校验环境变量是否配置,返回 key 或发送 503 并返回 null。 */
function requireKey(envName: string, serviceName: string, reply: FastifyReply): string | null {
  const key = process.env[envName]
  if (!key) {
    reply.status(503).send(error(503, `${serviceName} 服务未配置`))
    return null
  }
  return key
}

/** WebSocket 鉴权:从 token 验证并返回 userId,失败时调用 onFail 并返回 null。 */
async function wsAuth(
  token: string | undefined,
  onFail: (code: number, reason: string) => void,
): Promise<string | null> {
  if (!token) {
    onFail(4001, '缺少 token')
    return null
  }
  try {
    const payload = await verifyAccessToken(token)
    return payload.userId
  } catch {
    onFail(4003, 'token 无效')
    return null
  }
}

// ============================================================================
// HTTP 辅助
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** SSE 流式代理:向上游发起 POST,逐行转发为 SSE 事件到客户端。 */
async function streamSSE(
  reply: FastifyReply,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 60_000,
): Promise<void> {
  reply.hijack()
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '')
      reply.raw.write(
        `data: ${JSON.stringify({ error: `upstream ${resp.status}: ${errText.slice(0, 200)}` })}\n\n`,
      )
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) reply.raw.write(`data: ${line}\n\n`)
      }
    }
    if (buffer.trim()) reply.raw.write(`data: ${buffer}\n\n`)
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
  } finally {
    reply.raw.end()
  }
}

/** 同步 JSON 代理:POST 上游并返回 JSON。失败时发送错误响应并返回 null。 */
async function proxyJSON(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  reply: FastifyReply,
  timeoutMs = 30_000,
): Promise<unknown | null> {
  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      },
      timeoutMs,
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(error(502, `upstream ${resp.status}: ${JSON.stringify(data).slice(0, 500)}`))
      return null
    }
    // FreeLLMAPI 等 OpenAI 兼容代理在 200 + 内部 error 时返回 data.error
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const err = (data as Record<string, unknown>).error
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : String(err)
      reply.status(502).send(error(502, `上游返回错误: ${msg.slice(0, 200)}`))
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `调用异常: ${msg}`))
    return null
  }
}

/** GET JSON 代理:GET 上游并返回 JSON。 */
async function proxyGetJSON(
  url: string,
  headers: Record<string, string>,
  reply: FastifyReply,
  timeoutMs = 15_000,
): Promise<unknown | null> {
  try {
    const resp = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs)
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(error(502, `upstream ${resp.status}: ${JSON.stringify(data).slice(0, 500)}`))
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `调用异常: ${msg}`))
    return null
  }
}

/** 合并 query + body,兼容旧前端 query 传参与新前端 body 传参。 */
function mergeQueryBody(request: FastifyRequest): Record<string, unknown> {
  return {
    ...(request.query as Record<string, unknown>),
    ...((request.body as Record<string, unknown> | null) ?? {}),
  }
}

// ============================================================================
// Kling JWT 辅助
// ============================================================================

async function klingJWT(reply: FastifyReply): Promise<string | null> {
  const ak = process.env.KLING_ACCESS_KEY
  const sk = process.env.KLING_SECRET_KEY
  if (!ak || !sk) {
    reply.status(503).send(error(503, 'KLING_ACCESS_KEY/KLING_SECRET_KEY not configured'))
    return null
  }
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', kid: ak })
    .setIssuer(ak)
    .setExpirationTime(now + 1800)
    .setNotBefore(now - 5)
    .sign(new TextEncoder().encode(sk))
}

async function klingHeaders(reply: FastifyReply): Promise<Record<string, string> | null> {
  try {
    const token = await klingJWT(reply)
    if (!token) return null
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  } catch {
    reply.status(503).send(error(503, 'Kling 服务未配置'))
    return null
  }
}

/** Kling API 调用:检查 code===0,返回 data 字段。 */
async function klingCall(
  url: string,
  body: unknown,
  reply: FastifyReply,
  method: 'GET' | 'POST' = 'POST',
  timeoutMs = 60_000,
): Promise<unknown | null> {
  const headers = await klingHeaders(reply)
  if (!headers) return null
  try {
    const resp = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      },
      timeoutMs,
    )
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    if (!resp.ok || data.code !== 0) {
      const msg =
        typeof data.message === 'string' ? data.message : `Kling API error: ${resp.status}`
      reply.status(502).send(error(502, msg))
      return null
    }
    return data.data ?? {}
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `Kling 调用异常: ${msg}`))
    return null
  }
}

// ============================================================================
// Multi vendor 配置
// ============================================================================

interface VendorCfg {
  base: string
  chatPath: string
  keyEnv: string
  serviceName: string
  authHeader: (key: string) => Record<string, string>
  buildPayload: (model: string, message: string) => unknown
  streamable: boolean
}

const VENDOR_CONFIGS: Record<string, VendorCfg> = {
  zhipu: {
    base: 'https://open.bigmodel.cn/api/paas/v4',
    chatPath: '/chat/completions',
    keyEnv: 'ZHIPU_API_KEY',
    serviceName: 'Zhipu',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({ model, messages: [{ role: 'user', content: message }] }),
    streamable: true,
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    serviceName: 'OpenRouter',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({ model, messages: [{ role: 'user', content: message }] }),
    streamable: true,
  },
  freellmapi: {
    base: process.env.FREELLMAPI_BASE_URL ?? '',
    chatPath: '/chat/completions',
    keyEnv: 'FREELLMAPI_API_KEY',
    serviceName: 'FreeLLMAPI',
    authHeader: (key) => (key ? { Authorization: `Bearer ${key}` } : {}) as Record<string, string>,
    buildPayload: (model, message) => ({ model, messages: [{ role: 'user', content: message }] }),
    streamable: true,
  },
  luyala: {
    base: 'https://api.luyala.cn/v1',
    chatPath: '/chat/completions',
    keyEnv: 'LUYALA_API_KEY',
    serviceName: 'Luyala',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({ model, messages: [{ role: 'user', content: message }] }),
    streamable: true,
  },
  bailian: {
    base: 'https://dashscope.aliyuncs.com/api/v1',
    chatPath: '/services/aigc/text-generation/generation',
    keyEnv: 'DASHSCOPE_API_KEY',
    serviceName: 'Bailian',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({
      model,
      input: { messages: [{ role: 'user', content: message }] },
      parameters: { result_format: 'message' },
    }),
    streamable: false,
  },
  n8n: {
    base: process.env.N8N_BASE_URL ?? '',
    chatPath: process.env.N8N_WEBHOOK_PATH ?? '/webhook/chat',
    keyEnv: 'N8N_API_KEY',
    serviceName: 'N8N',
    authHeader: (key) => (key ? { 'X-N8N-API-KEY': key } : {}) as Record<string, string>,
    buildPayload: (model, message) => ({ query: message, model }),
    streamable: false,
  },
  coze_workflow: {
    base: process.env.COZE_API_BASE ?? 'https://api.coze.cn',
    chatPath: '/v1/workflow/run',
    keyEnv: 'COZE_API_KEY',
    serviceName: 'Coze Workflow',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({ workflow_id: model, parameters: { query: message } }),
    streamable: false,
  },
  langchain: {
    base: process.env.LANGCHAIN_BASE_URL ?? '',
    chatPath: '/chat',
    keyEnv: 'LANGCHAIN_API_KEY',
    serviceName: 'LangChain',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    buildPayload: (model, message) => ({ model, input: message }),
    streamable: false,
  },
}

// ============================================================================
// History 内存存储（增强版：支持 mark 文本搜索）
// ============================================================================

interface HistoryRecord {
  id: number
  userId: string
  modelName: string
  mark: string | null
  createTime: number
}

const historyStore = new Map<number, HistoryRecord>()
let historyIdCounter = 0

// ============================================================================
// Zod schemas
// ============================================================================

const chatQuerySchema = z.object({
  model: z.string().max(64).optional(),
  message: z.string().min(1, 'message is required'),
})

const multiChatSchema = z.object({
  vendors: z.string().min(1),
  model: z.string().max(64).optional(),
  message: z.string().min(1),
})

const cozeMessageSchema = z.object({
  bot_id: z.string().min(1),
  message: z.string().min(1),
  conversation_id: z.string().optional(),
})

const klingVideoSchema = z.object({
  prompt: z.string().min(1),
  model_name: z.string().optional(),
  duration: z.string().optional(),
  mode: z.string().optional(),
  aspect_ratio: z.string().optional(),
  cfg_scale: z.number().optional(),
  negative_prompt: z.string().optional(),
  camera_control: z.record(z.string(), z.unknown()).optional(),
})

const klingI2VSchema = z.object({
  image: z.string().min(1),
  model_name: z.string().optional(),
  prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  duration: z.string().optional(),
  mode: z.string().optional(),
  cfg_scale: z.number().optional(),
})

const klingImageSchema = z.object({
  prompt: z.string().min(1),
  model_name: z.string().optional(),
  n: z.number().int().min(1).max(10).optional(),
  aspect_ratio: z.string().optional(),
  negative_prompt: z.string().optional(),
})

const historyCreateSchema = z.object({
  model_name: z.string().min(1),
  mark: z.string().max(500).optional(),
})

const historyQuerySchema = z.object({
  model_name: z.string().optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const historyMarkSchema = z.object({
  mark: z.string().max(500),
})

const cozeWorkflowSchema = z.object({
  workflow_id: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).default({}),
})

const cozeWorkflowResumeSchema = z.object({
  workflow_id: z.string().min(1),
  event_id: z.string().min(1),
  resume_data: z.record(z.string(), z.unknown()).default({}),
  interrupt_type: z.string().min(1),
})

const cozeWorkflowHistorySchema = z.object({
  workflow_id: z.string().min(1),
  execute_id: z.string().min(1),
})

const cozeConversationListSchema = z.object({
  bot_id: z.string().min(1),
  user_id: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

const cozeMessageListSchema = z.object({
  conversation_id: z.string().min(1),
  bot_id: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

const cozeFeedbackSchema = z.object({
  message_id: z.string().min(1),
  conversation_id: z.string().min(1),
  feedback_type: z.string().min(1),
  content: z.string().optional(),
})

// ============================================================================
// 常量
// ============================================================================

const DEEPSEEK_URL = `${process.env.DEEPSEEK_API_BASE ?? 'https://api.deepseek.com'}/chat/completions`
const QWEN_URL = `${process.env.DASHSCOPE_BASE ?? 'https://dashscope.aliyuncs.com/api/v1'}/services/aigc/text-generation/generation`
const KLING_T2V = 'https://api.klingai.com/v1/videos/text2video'
const KLING_I2V = 'https://api.klingai.com/v1/videos/image2video'
const KLING_T2I = 'https://api.klingai.com/v1/images/generations'
const COZE_BASE = () => process.env.COZE_API_BASE ?? 'https://api.coze.cn'
const COZE_KEY = () => process.env.COZE_API_KEY ?? process.env.COZE_PRIVATE_KEY ?? ''
const QWEN_KEY = () => process.env.DASHSCOPE_API_KEY ?? process.env.QWEN_API_KEY ?? ''

// ============================================================================
// 路由
// ============================================================================

export const chatModelRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. DeepSeek — POST /deepseek/chat, POST /deepseek/chat/stream
  // ==========================================================================

  server.post('/deepseek/chat', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = chatQuerySchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const key = requireKey('DEEPSEEK_API_KEY', 'DeepSeek', reply)
    if (!key) return
    const { model = 'deepseek-chat', message } = parsed.data
    const data = await degradedMode(
      () =>
        getBulkhead('ai-call', 10, 50).execute(() =>
          proxyJSON(
            DEEPSEEK_URL,
            { Authorization: `Bearer ${key}` },
            {
              model,
              messages: [{ role: 'user', content: message }],
              stream: false,
            },
            reply,
          ),
        ),
      null,
      () => reply.send(success({ degraded: true, message: 'AI 服务暂时不可用,请稍后重试' })),
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/deepseek/chat/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = chatQuerySchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const key = requireKey('DEEPSEEK_API_KEY', 'DeepSeek', reply)
    if (!key) return
    const { model = 'deepseek-chat', message } = parsed.data
    return streamSSE(
      reply,
      DEEPSEEK_URL,
      { Authorization: `Bearer ${key}` },
      {
        model,
        messages: [{ role: 'user', content: message }],
        stream: true,
      },
    )
  })

  // ==========================================================================
  // 2. DeepSeek WebSocket — GET /ws/deepseek
  //    客户端 WS → DeepSeek HTTP SSE 逐行转发
  // ==========================================================================

  server.get('/ws/deepseek', { websocket: true }, (socket, request) => {
    const { token, model: qModel, api_key } = (request.query as Record<string, string>) ?? {}
    const model = qModel || 'deepseek-chat'
    const key = api_key || process.env.DEEPSEEK_API_KEY

    ;(async () => {
      if (!key) {
        socket.close(4001, 'Missing DEEPSEEK_API_KEY')
        return
      }
      const userId = await wsAuth(token, (c, r) => socket.close(c, r))
      if (!userId) return

      socket.on('message', async (data: Buffer) => {
        const raw = data.toString()
        let body: Record<string, unknown>
        try {
          const msg = JSON.parse(raw) as Record<string, unknown>
          if (msg.messages) {
            body = { ...msg, model: msg.model ?? model, stream: true }
          } else {
            body = {
              model,
              messages: [{ role: 'user', content: msg.content ?? raw }],
              stream: true,
            }
          }
        } catch {
          body = { model, messages: [{ role: 'user', content: raw }], stream: true }
        }

        try {
          const resp = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body),
          })
          if (!resp.ok || !resp.body) {
            const errText = await resp.text().catch(() => '')
            socket.send(
              JSON.stringify({
                type: 'error',
                data: {
                  message: `DeepSeek API error: ${resp.status}`,
                  detail: errText.slice(0, 200),
                },
              }),
            )
            return
          }
          const reader = resp.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.trim()) socket.send(line)
            }
          }
          if (buffer.trim()) socket.send(buffer)
        } catch (e) {
          socket.send(JSON.stringify({ type: 'error', data: { message: (e as Error).message } }))
        }
      })
    })()
  })

  // ==========================================================================
  // 3. Kling — POST /kling/video/generate, /kling/video/image-to-video,
  //            POST /kling/image/generate, GET /kling/task/:taskId
  // ==========================================================================

  server.post('/kling/video/generate', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = klingVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const {
      prompt,
      model_name = 'kling-v1',
      duration = '5',
      mode = 'std',
      aspect_ratio = '16:9',
      cfg_scale = 0.5,
      negative_prompt,
      camera_control,
    } = parsed.data
    const payload: Record<string, unknown> = {
      model_name,
      prompt,
      duration,
      mode,
      aspect_ratio,
      cfg_scale,
    }
    if (negative_prompt) payload.negative_prompt = negative_prompt
    if (camera_control) payload.camera_control = camera_control
    const data = await klingCall(KLING_T2V, payload, reply)
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/kling/video/image-to-video', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = klingI2VSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const {
      image,
      model_name = 'kling-v1',
      prompt,
      negative_prompt,
      duration = '5',
      mode = 'std',
      cfg_scale = 0.5,
    } = parsed.data
    const payload: Record<string, unknown> = { model_name, image, duration, mode, cfg_scale }
    if (prompt) payload.prompt = prompt
    if (negative_prompt) payload.negative_prompt = negative_prompt
    const data = await klingCall(KLING_I2V, payload, reply)
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/kling/image/generate', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = klingImageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const {
      prompt,
      model_name = 'kling-v1',
      n = 1,
      aspect_ratio = '1:1',
      negative_prompt,
    } = parsed.data
    const payload: Record<string, unknown> = { model_name, prompt, n, aspect_ratio }
    if (negative_prompt) payload.negative_prompt = negative_prompt
    const data = await klingCall(KLING_T2I, payload, reply)
    if (data === null) return
    return reply.send(success(data))
  })

  server.get('/kling/task/:taskId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { taskId } = request.params as { taskId: string }
    const { task_type: taskType = 'video' } = request.query as { task_type?: string }
    const base = taskType === 'image' ? KLING_T2I : KLING_T2V
    const data = await klingCall(`${base}/${taskId}`, undefined, reply, 'GET', 30_000)
    if (data === null) return
    return reply.send(success(data))
  })

  // ==========================================================================
  // 4. Multi — GET /multi/vendors, POST /multi/:vendor/chat,
  //            POST /multi/:vendor/chat/stream, POST /multi/multi
  // ==========================================================================

  server.get('/multi/vendors', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    return reply.send(success({ vendors: Object.keys(VENDOR_CONFIGS) }))
  })

  server.post('/multi/:vendor/chat', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { vendor } = request.params as { vendor: string }
    const parsed = multiChatSchema.omit({ vendors: true }).safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cfg = VENDOR_CONFIGS[vendor]
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    if (!cfg.base) return reply.status(503).send(error(503, `${cfg.serviceName} 服务未配置`))
    const key = process.env[cfg.keyEnv] ?? ''
    if (cfg.keyEnv !== 'FREELLMAPI_API_KEY' && cfg.keyEnv !== 'N8N_API_KEY' && !key) {
      return reply.status(503).send(error(503, `${cfg.serviceName} 服务未配置`))
    }
    const { model = 'gpt-3.5-turbo', message } = parsed.data
    const url = `${cfg.base}${cfg.chatPath}`
    const headers = { ...cfg.authHeader(key) }
    const data = await proxyJSON(url, headers, cfg.buildPayload(model, message), reply)
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/multi/:vendor/chat/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { vendor } = request.params as { vendor: string }
    const parsed = multiChatSchema.omit({ vendors: true }).safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const cfg = VENDOR_CONFIGS[vendor]
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    if (!cfg.streamable) return reply.status(400).send(error(400, `${cfg.serviceName} 不支持流式`))
    if (!cfg.base) return reply.status(503).send(error(503, `${cfg.serviceName} 服务未配置`))
    const key = process.env[cfg.keyEnv] ?? ''
    if (cfg.keyEnv !== 'FREELLMAPI_API_KEY' && !key) {
      return reply.status(503).send(error(503, `${cfg.serviceName} 服务未配置`))
    }
    const { model = 'gpt-3.5-turbo', message } = parsed.data
    const url = `${cfg.base}${cfg.chatPath}`
    const headers = { ...cfg.authHeader(key) }
    const body = cfg.buildPayload(model, message) as Record<string, unknown>
    body.stream = true
    return streamSSE(reply, url, headers, body)
  })

  server.post('/multi/multi', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = multiChatSchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { vendors, model = 'gpt-3.5-turbo', message } = parsed.data
    const vendorList = vendors
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

    const results: Array<Record<string, unknown>> = []
    for (const v of vendorList) {
      const cfg = VENDOR_CONFIGS[v]
      if (!cfg || !cfg.base) {
        results.push({ vendor: v, ok: false, error: 'unsupported or not configured' })
        continue
      }
      const key = process.env[cfg.keyEnv] ?? ''
      if (cfg.keyEnv !== 'FREELLMAPI_API_KEY' && cfg.keyEnv !== 'N8N_API_KEY' && !key) {
        results.push({ vendor: v, ok: false, error: 'not configured' })
        continue
      }
      try {
        const resp = await fetchWithTimeout(
          `${cfg.base}${cfg.chatPath}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...cfg.authHeader(key) },
            body: JSON.stringify(cfg.buildPayload(model, message)),
          },
          30_000,
        )
        const payload = await resp.json().catch(() => ({}))
        if (typeof payload === 'object' && payload !== null && 'error' in payload) {
          const err = (payload as Record<string, unknown>).error
          const msg =
            typeof err === 'object' && err !== null && 'message' in err
              ? String((err as Record<string, unknown>).message)
              : String(err)
          results.push({ vendor: v, ok: false, error: `upstream:${msg.slice(0, 200)}` })
        } else {
          results.push({ vendor: v, ok: true, data: payload })
        }
      } catch (e) {
        results.push({ vendor: v, ok: false, error: (e as Error).message })
      }
    }
    return reply.send(success({ results }))
  })

  // ==========================================================================
  // 5. Qwen — POST /qwen/chat, POST /qwen/chat/stream
  // ==========================================================================

  server.post('/qwen/chat', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = chatQuerySchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const key = requireKey('DASHSCOPE_API_KEY', 'Qwen', reply)
    if (!key) return
    const { model = 'qwen-turbo', message } = parsed.data
    const data = await degradedMode(
      () =>
        getBulkhead('ai-call', 10, 50).execute(() =>
          proxyJSON(
            QWEN_URL,
            { Authorization: `Bearer ${key}` },
            {
              model,
              input: { messages: [{ role: 'user', content: message }] },
              parameters: { result_format: 'message' },
            },
            reply,
          ),
        ),
      null,
      () => reply.send(success({ degraded: true, message: 'AI 服务暂时不可用,请稍后重试' })),
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/qwen/chat/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = chatQuerySchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const key = requireKey('DASHSCOPE_API_KEY', 'Qwen', reply)
    if (!key) return
    const { model = 'qwen-turbo', message } = parsed.data
    return streamSSE(
      reply,
      QWEN_URL,
      { Authorization: `Bearer ${key}` },
      {
        model,
        input: { messages: [{ role: 'user', content: message }] },
        parameters: { result_format: 'message', incremental_output: true },
      },
    )
  })

  // ==========================================================================
  // 6. Qwen Omni WebSocket — GET /ws/qwen-omni
  //    双向 WS 转发:客户端 ↔ DashScope Omni realtime WS
  // ==========================================================================

  server.get('/ws/qwen-omni', { websocket: true }, (socket, request) => {
    const { token, model: qModel, api_key } = (request.query as Record<string, string>) ?? {}
    const model = qModel || 'qwen-omni'
    const key = api_key || QWEN_KEY()

    ;(async () => {
      if (!key) {
        socket.close(4001, 'Missing DASHSCOPE_API_KEY')
        return
      }
      const userId = await wsAuth(token, (c, r) => socket.close(c, r))
      if (!userId) return

      const wsUrl = `wss://dashscope.aliyuncs.com/api-ws/v1/realtime/?model=${encodeURIComponent(model)}`
      const upstream = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${key}` } })
      upstream.binaryType = 'arraybuffer'

      upstream.onopen = () => {
        upstream.send(
          JSON.stringify({
            header: { action: 'session.updated' },
            payload: {
              session_configuration: {
                modalities: ['text', 'audio'],
                voice: 'longxiaochun',
              },
            },
          }),
        )
        socket.on('message', (data: Buffer) => {
          try {
            upstream.send(data)
          } catch {
            /* upstream closed */
          }
        })
      }

      upstream.onmessage = (event) => {
        if (typeof event.data === 'string') {
          socket.send(event.data)
        } else if (event.data instanceof ArrayBuffer) {
          socket.send(Buffer.from(event.data))
        }
      }

      upstream.onerror = () => {
        try {
          socket.close(4002, 'upstream error')
        } catch {
          /* already closed */
        }
      }

      upstream.onclose = () => {
        try {
          socket.close()
        } catch {
          /* already closed */
        }
      }

      socket.on('close', () => {
        try {
          upstream.close()
        } catch {
          /* already closed */
        }
      })
    })()
  })

  // ==========================================================================
  // 7. Zhipu WebSocket — GET /ws/zhipu
  //    双向 WS 转发:客户端 ↔ 智谱 GLM WS
  // ==========================================================================

  server.get('/ws/zhipu', { websocket: true }, (socket, request) => {
    const { token, model: qModel, api_key } = (request.query as Record<string, string>) ?? {}
    const model = qModel || 'glm-4'
    const key = api_key || process.env.ZHIPU_API_KEY

    ;(async () => {
      if (!key) {
        socket.close(4001, 'Missing ZHIPU_API_KEY')
        return
      }
      const userId = await wsAuth(token, (c, r) => socket.close(c, r))
      if (!userId) return

      const wsUrl = 'wss://open.bigmodel.cn/api/paas/v4/chat/completions'
      const upstream = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      })

      upstream.onopen = () => {
        upstream.send(JSON.stringify({ model, stream: true }))
        socket.on('message', (data: Buffer) => {
          const raw = data.toString()
          try {
            const msg = JSON.parse(raw) as Record<string, unknown>
            if (!msg.messages) {
              msg.messages = [{ role: 'user', content: msg.content ?? raw }]
            }
            msg.model = model
            msg.stream = true
            upstream.send(JSON.stringify(msg))
          } catch {
            upstream.send(
              JSON.stringify({ model, messages: [{ role: 'user', content: raw }], stream: true }),
            )
          }
        })
      }

      upstream.onmessage = (event) => {
        socket.send(typeof event.data === 'string' ? event.data : String(event.data))
      }

      upstream.onerror = () => {
        try {
          socket.close(4002, 'upstream error')
        } catch {
          /* already closed */
        }
      }

      upstream.onclose = () => {
        try {
          socket.close()
        } catch {
          /* already closed */
        }
      }

      socket.on('close', () => {
        try {
          upstream.close()
        } catch {
          /* already closed */
        }
      })
    })()
  })

  // ==========================================================================
  // 8. History — POST /history/create, POST /history/query,
  //              PUT /history/:chatId/mark, DELETE /history/:chatId
  //    增强版:支持 mark 文本搜索
  // ==========================================================================

  server.post('/history/create', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = historyCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const id = ++historyIdCounter
    const record: HistoryRecord = {
      id,
      userId: request.userId!,
      modelName: parsed.data.model_name,
      mark: parsed.data.mark ?? null,
      createTime: Date.now(),
    }
    historyStore.set(id, record)
    return reply.status(201).send(
      success({
        id: record.id,
        user_uuid: record.userId,
        model_name: record.modelName,
        mark: record.mark,
        create_time: new Date(record.createTime).toISOString(),
      }),
    )
  })

  server.post('/history/query', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = historyQuerySchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { model_name, search, page, limit } = parsed.data
    let items = Array.from(historyStore.values()).filter((r) => r.userId === request.userId)
    if (model_name) items = items.filter((r) => r.modelName === model_name)
    if (search) items = items.filter((r) => r.mark?.includes(search))
    items.sort((a, b) => b.createTime - a.createTime)
    const total = items.length
    const paged = items.slice((page - 1) * limit, page * limit)
    const data = paged.map((r) => ({
      id: r.id,
      user_uuid: r.userId,
      model_name: r.modelName,
      mark: r.mark,
      create_time: new Date(r.createTime).toISOString(),
    }))
    return reply.send({ ...success(data), total })
  })

  server.put('/history/:chatId/mark', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const chatId = Number((request.params as { chatId: string }).chatId)
    if (!Number.isInteger(chatId)) {
      return reply.status(400).send(error(400, 'chatId must be integer'))
    }
    const parsed = historyMarkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const record = historyStore.get(chatId)
    if (!record || record.userId !== request.userId) {
      return reply.status(404).send(error(404, 'Chat record not found'))
    }
    record.mark = parsed.data.mark
    return reply.send(
      success({
        id: record.id,
        user_uuid: record.userId,
        model_name: record.modelName,
        mark: record.mark,
        create_time: new Date(record.createTime).toISOString(),
      }),
    )
  })

  server.delete('/history/:chatId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const chatId = Number((request.params as { chatId: string }).chatId)
    if (!Number.isInteger(chatId)) {
      return reply.status(400).send(error(400, 'chatId must be integer'))
    }
    const record = historyStore.get(chatId)
    if (!record || record.userId !== request.userId) {
      return reply.status(404).send(error(404, 'Chat record not found'))
    }
    historyStore.delete(chatId)
    return reply.send(success({ deleted: chatId }))
  })

  // ==========================================================================
  // 9. Coze — 聊天直连 / 工作流 / 对话管理
  // ==========================================================================

  server.post('/coze/message', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeMessageSchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const { bot_id, message, conversation_id } = parsed.data
    const body: Record<string, unknown> = {
      bot_id,
      user_id: request.userId,
      additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
    }
    if (conversation_id) body.conversation_id = conversation_id
    const data = await degradedMode(
      () =>
        getBulkhead('ai-call', 10, 50).execute(() =>
          proxyJSON(
            `${COZE_BASE()}/v3/chat`,
            { Authorization: `Bearer ${COZE_KEY()}` },
            body,
            reply,
          ),
        ),
      null,
      () => reply.send(success({ degraded: true, message: 'AI 服务暂时不可用,请稍后重试' })),
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/message/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeMessageSchema.safeParse(mergeQueryBody(request))
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const { bot_id, message, conversation_id } = parsed.data
    const body: Record<string, unknown> = {
      bot_id,
      user_id: request.userId,
      additional_messages: [{ role: 'user', content: message, content_type: 'text' }],
      stream: true,
    }
    if (conversation_id) body.conversation_id = conversation_id
    return streamSSE(
      reply,
      `${COZE_BASE()}/v3/chat`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      body,
      60_000,
    )
  })

  server.post('/coze/conversation/create', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { bot_id } = request.body as { bot_id?: string }
    if (!bot_id) return reply.status(400).send(error(400, 'bot_id is required'))
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const data = await proxyJSON(
      `${COZE_BASE()}/v1/conversation/create`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      {
        bot_id,
        user_id: request.userId,
      },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/workflow/run', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeWorkflowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const data = await proxyJSON(
      `${COZE_BASE()}/v1/workflow/run`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      { workflow_id: parsed.data.workflow_id, parameters: parsed.data.parameters },
      reply,
      60_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/workflow/run/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeWorkflowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    return streamSSE(
      reply,
      `${COZE_BASE()}/v1/workflow/run`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      { workflow_id: parsed.data.workflow_id, parameters: parsed.data.parameters },
      120_000,
    )
  })

  server.post('/coze/workflow/run/resume', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeWorkflowResumeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const data = await proxyJSON(
      `${COZE_BASE()}/v1/workflow/run/resume`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      {
        workflow_id: parsed.data.workflow_id,
        event_id: parsed.data.event_id,
        resume_data: parsed.data.resume_data,
        interrupt_type: parsed.data.interrupt_type,
      },
      reply,
      120_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/workflow/run/resume/stream', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeWorkflowResumeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    return streamSSE(
      reply,
      `${COZE_BASE()}/v1/workflow/run/resume`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      {
        workflow_id: parsed.data.workflow_id,
        event_id: parsed.data.event_id,
        resume_data: parsed.data.resume_data,
        interrupt_type: parsed.data.interrupt_type,
      },
      120_000,
    )
  })

  server.post('/coze/workflow/run/history', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeWorkflowHistorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const qs = new URLSearchParams({
      workflow_id: parsed.data.workflow_id,
      execute_id: parsed.data.execute_id,
    }).toString()
    const data = await proxyGetJSON(
      `${COZE_BASE()}/v1/workflow/run/history?${qs}`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/conversations/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeConversationListSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const qs = new URLSearchParams({
      bot_id: parsed.data.bot_id,
      user_id: parsed.data.user_id,
      page_index: String(parsed.data.page),
      page_size: String(parsed.data.size),
    }).toString()
    const data = await proxyGetJSON(
      `${COZE_BASE()}/v1/conversation/list?${qs}`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/conversations/retrieve', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { conversation_id } = request.body as { conversation_id?: string }
    if (!conversation_id) return reply.status(400).send(error(400, 'conversation_id is required'))
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const data = await proxyGetJSON(
      `${COZE_BASE()}/v1/conversation/retrieve?conversation_id=${encodeURIComponent(conversation_id)}`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/messages/list', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeMessageListSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const params: Record<string, string> = {
      conversation_id: parsed.data.conversation_id,
      page_index: String(parsed.data.page),
      page_size: String(parsed.data.size),
    }
    if (parsed.data.bot_id) params.bot_id = parsed.data.bot_id
    const qs = new URLSearchParams(params).toString()
    const data = await proxyGetJSON(
      `${COZE_BASE()}/v1/conversation/message/list?${qs}`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })

  server.post('/coze/messages/feedback', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = cozeFeedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (!COZE_KEY()) return reply.status(503).send(error(503, 'Coze 服务未配置'))
    const data = await proxyJSON(
      `${COZE_BASE()}/v1/conversation/message/feedback`,
      { Authorization: `Bearer ${COZE_KEY()}` },
      {
        message_id: parsed.data.message_id,
        conversation_id: parsed.data.conversation_id,
        feedback_type: parsed.data.feedback_type,
        content: parsed.data.content ?? '',
      },
      reply,
      15_000,
    )
    if (data === null) return
    return reply.send(success(data))
  })
}
