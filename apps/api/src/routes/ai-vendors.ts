/**
 * R4 AI 厂商专属多模态后端路由。
 *
 * 代理层:将请求转发到外部 AI 厂商 API(通义/豆包/Gemini/Suno/Sora2/Coze/百炼/即梦/n8n/腾讯/火山引擎 等)。
 * 不依赖本地数据库表;异步任务、AIGC 记录、音色、用量统计使用进程内内存存储。
 *
 * 环境变量:
 * - DASHSCOPE_API_KEY / DOUBAO_API_KEY / GEMINI_API_KEY
 * - SUNO_API_KEY / SORA2_API_KEY / COZE_API_KEY
 * - BAILIAN_API_KEY / BAILIAN_APP_ID
 * - JIMENG4_API_KEY / JIMENG4_SECRET_KEY
 * - N8N_API_KEY / N8N_BASE_URL
 * - TENCENT_SECRET_ID / TENCENT_SECRET_KEY
 * - VOLCENGINE_API_KEY / VOLCENGINE_SECRET_KEY
 *
 * 注册(server.ts):
 *   server.register(aiVendorRoutes, { prefix: '/api/ai' })
 *   server.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })
 */
import { createHmac, createHash } from 'node:crypto'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { verifyAccessToken } from '@ihui/auth'
import { success, error } from '../utils/response.js'

// ============================================================================
// 鉴权
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

// ============================================================================
// 通用工具
// ============================================================================

/** 带超时的 fetch,默认 30s(同步请求)。 */
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

interface VendorConfig {
  name: string
  keyEnv: string
  secretKeyEnv?: string
  baseUrl: string
  authHeader: (key: string) => Record<string, string>
}

/** 各厂商配置:名称、环境变量、Base URL、鉴权头构造。 */
const VENDORS: Record<string, VendorConfig> = {
  dashscope: {
    name: 'Dashscope(阿里通义)',
    keyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  doubao: {
    name: 'Doubao(豆包/字节)',
    keyEnv: 'DOUBAO_API_KEY',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gemini: {
    name: 'Gemini(Google)',
    keyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authHeader: (key) => ({ 'x-goog-api-key': key }),
  },
  suno: {
    name: 'Suno(音乐生成)',
    keyEnv: 'SUNO_API_KEY',
    baseUrl: 'https://api.suno.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  sora2: {
    name: 'Sora2(OpenAI 视频)',
    keyEnv: 'SORA2_API_KEY',
    baseUrl: 'https://api.openai.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  coze: {
    name: 'Coze(扣子)',
    keyEnv: 'COZE_API_KEY',
    baseUrl: 'https://api.coze.cn',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  bailian: {
    name: 'Bailian(百炼/阿里云)',
    keyEnv: 'BAILIAN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  jimeng4: {
    name: 'JiMeng4(即梦/字节AI绘画)',
    keyEnv: 'JIMENG4_API_KEY',
    secretKeyEnv: 'JIMENG4_SECRET_KEY',
    baseUrl: 'https://visual.volcengineapi.com',
    authHeader: () => ({}),
  },
  n8n: {
    name: 'N8N(工作流平台)',
    keyEnv: 'N8N_API_KEY',
    baseUrl: '',
    authHeader: (key) => ({ 'X-N8N-API-KEY': key }),
  },
  tencent: {
    name: 'Tencent(腾讯混元/ARC)',
    keyEnv: 'TENCENT_SECRET_ID',
    secretKeyEnv: 'TENCENT_SECRET_KEY',
    baseUrl: 'https://ai3d.tencentcloudapi.com',
    authHeader: () => ({}),
  },
  volcengine: {
    name: 'Volcengine(火山引擎/字节豆包企业版)',
    keyEnv: 'VOLCENGINE_API_KEY',
    secretKeyEnv: 'VOLCENGINE_SECRET_KEY',
    baseUrl: 'https://visual.volcengineapi.com',
    authHeader: () => ({}),
  },
}

/**
 * 校验厂商 API Key 是否已配置。
 * 返回 key 字符串;未配置时发送 503 响应并返回 null。
 */
function requireVendorKey(vendor: string, reply: FastifyReply): string | null {
  const cfg = VENDORS[vendor]
  if (!cfg) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return null
  }
  const key = process.env[cfg.keyEnv]
  if (!key) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return null
  }
  return key
}

/** 校验双密钥厂商(AK/SK)是否已配置。 */
function requireVendorKeys(
  vendor: string,
  reply: FastifyReply,
): { key: string; secret: string } | null {
  const cfg = VENDORS[vendor]
  if (!cfg || !cfg.secretKeyEnv) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return null
  }
  const key = process.env[cfg.keyEnv]
  const secret = process.env[cfg.secretKeyEnv]
  if (!key || !secret) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return null
  }
  return { key, secret }
}

/** Tencent Cloud TC3-HMAC-SHA256 签名。 */
function buildTencentHeaders(
  action: string,
  payload: string,
  secretId: string,
  secretKey: string,
): Record<string, string> {
  const service = 'ai3d'
  const algorithm = 'TC3-HMAC-SHA256'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const host = 'ai3d.tencentcloudapi.com'
  const contentType = 'application/json; charset=utf-8'
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedPayload = createHash('sha256').update(payload).digest('hex')
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedRequest = createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedRequest}`
  const secretDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return {
    'Content-Type': contentType,
    'X-TC-Action': action,
    'X-TC-Version': '2025-05-13',
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': 'ap-guangzhou',
    Authorization: authorization,
  }
}

/** Volcengine HMAC-SHA256 V4 签名。 */
function volcengineSign(
  queryParams: Record<string, string>,
  body: unknown,
  accessKey: string,
  secretKey: string,
): { url: string; headers: Record<string, string>; body: string } {
  const host = 'visual.volcengineapi.com'
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const datestamp = ts.slice(0, 8)
  const payloadStr = JSON.stringify(body)
  const payloadHash = createHash('sha256').update(payloadStr).digest('hex')
  const canonicalQs = Object.keys(queryParams)
    .sort()
    .map((k) => `${k}=${queryParams[k]}`)
    .join('&')
  const signedHeaders = 'content-type;host;x-content-sha256;x-date'
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${payloadHash}\nx-date:${ts}\n`
  const canonicalRequest = `POST\n/\n${canonicalQs}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const algorithm = 'HMAC-SHA256'
  const credentialScope = `${datestamp}/cn-north-1/cv/request`
  const stringToSign = `${algorithm}\n${ts}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`
  const kDate = createHmac('sha256', secretKey).update(datestamp).digest()
  const kRegion = createHmac('sha256', kDate).update('cn-north-1').digest()
  const kService = createHmac('sha256', kRegion).update('cv').digest()
  const kSigning = createHmac('sha256', kService).update('request').digest()
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return {
    url: `https://${host}?${canonicalQs}`,
    headers: {
      'X-Date': ts,
      Authorization: authorization,
      'X-Content-Sha256': payloadHash,
      'Content-Type': 'application/json',
    },
    body: payloadStr,
  }
}

/** 轮询 Volcengine 异步任务直到完成。 */
async function pollVolcengineTask(
  accessKey: string,
  secretKey: string,
  reqKey: string,
  taskId: string,
  maxPolls = 60,
  intervalMs = 5000,
): Promise<Record<string, unknown>> {
  const pollParams = { Action: 'CVSync2AsyncGetResult', Version: '2022-08-31' }
  const pollBody = { req_key: reqKey, task_id: taskId }
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const signed = volcengineSign(pollParams, pollBody, accessKey, secretKey)
    const resp = await fetchWithTimeout(
      signed.url,
      { method: 'POST', headers: signed.headers, body: signed.body },
      60_000,
    )
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    const dataBlock = data.data as Record<string, unknown> | undefined
    if (dataBlock?.status === 'done') return data
  }
  throw new Error('异步任务轮询超时')
}

/** 通用:调用外部同步 API 并返回 JSON。失败时发送 502。 */
async function callVendor(
  vendor: string,
  url: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<unknown | null> {
  const key = requireVendorKey(vendor, reply)
  if (!key) return null
  const cfg = VENDORS[vendor]!
  try {
    const resp = await fetchWithTimeout(
      url,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...cfg.authHeader(key),
          ...(options.headers ?? {}),
        },
      },
      timeoutMs,
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(
          error(502, `${cfg.name} 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
        )
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `${cfg.name} 调用异常: ${msg}`))
    return null
  }
}

// ============================================================================
// 内存存储(异步任务 / AIGC 记录 / 音色 / 用量)
// ============================================================================

interface AsyncTask {
  taskId: string
  userId: string
  vendor: string
  type: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
  createdAt: number
  updatedAt: number
}

interface AigcRecord {
  recordId: string
  userId: string
  type: string
  vendor: string
  prompt: string
  resultUrl?: string
  createdAt: number
}

interface Timbre {
  timbreId: string
  userId: string
  voiceName: string
  audioUrl: string
  vendor: string
  status: 'training' | 'ready' | 'failed'
  createdAt: number
}

interface UsageStat {
  userId: string
  vendor: string
  calls: number
  lastCallAt: number
}

const taskStore = new Map<string, AsyncTask>()
const aigcStore = new Map<string, AigcRecord>()
const timbreStore = new Map<string, Timbre>()
const usageStore = new Map<string, UsageStat>()
const n8nAgentStore = new Map<string, Record<string, unknown>>()
const tencentActiveJobs = new Map<string, Record<string, unknown>>()

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function recordUsage(userId: string, vendor: string): void {
  const k = `${userId}:${vendor}`
  const cur = usageStore.get(k)
  const now = Date.now()
  if (cur) {
    cur.calls += 1
    cur.lastCallAt = now
  } else {
    usageStore.set(k, { userId, vendor, calls: 1, lastCallAt: now })
  }
}

function createTask(userId: string, vendor: string, type: string, payload?: unknown): AsyncTask {
  const now = Date.now()
  const task: AsyncTask = {
    taskId: genId('task'),
    userId,
    vendor,
    type,
    status: 'pending',
    result: payload,
    createdAt: now,
    updatedAt: now,
  }
  taskStore.set(task.taskId, task)
  return task
}

// ============================================================================
// 主路由:AI 厂商代理端点
// ============================================================================

/**
 * 通过 vendor API 克隆音色（不依赖 FastifyReply，可供 WebSocket 端点复用）。
 * 成功返回 { timbre }，失败返回 { error }。
 */
export async function cloneTimbre(
  userId: string,
  voiceName: string,
  audioUrl: string,
  vendor = 'doubao',
): Promise<{ timbre?: Timbre; error?: string }> {
  const vendorCfg = VENDORS[vendor]
  if (!vendorCfg) return { error: `不支持的厂商: ${vendor}` }
  const key = process.env[vendorCfg.keyEnv]
  if (!key) return { error: `${vendorCfg.name} 服务未配置` }
  try {
    const resp = await fetchWithTimeout(`${vendorCfg.baseUrl}/v1/voice/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vendorCfg.authHeader(key) },
      body: JSON.stringify({ voice_name: voiceName, audio_url: audioUrl }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok)
      return {
        error: `${vendorCfg.name} 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 200)}`,
      }
    const timbre: Timbre = {
      timbreId: genId('timbre'),
      userId,
      voiceName,
      audioUrl,
      vendor,
      status: 'ready',
      createdAt: Date.now(),
    }
    timbreStore.set(timbre.timbreId, timbre)
    return { timbre }
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    return { error: `${vendorCfg.name} 调用异常: ${msg}` }
  }
}

export const aiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // WebSocket 路由在 handler 内部通过 query token 鉴权
    if (request.headers.upgrade === 'websocket') return
    if (!(await requireAuth(request, reply))) return
  })

  // ==========================================================================
  // 1. Dashscope(阿里通义)— 10 端点
  // ==========================================================================

  // POST /dashscope/chat — 通义千问对话
  server.post('/dashscope/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string; temperature?: number }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // POST /dashscope/image — 通义万相文生图(异步)
  server.post('/dashscope/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'image', data)
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // POST /dashscope/image-edit — 图片编辑
  server.post('/dashscope/image-edit', async (request, reply) => {
    const body = request.body as { prompt?: string; imageUrl?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // POST /dashscope/tts — 语音合成
  server.post('/dashscope/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/text-to-audio',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // POST /dashscope/asr — 语音识别
  server.post('/dashscope/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // GET /dashscope/models — 可用模型列表
  server.get('/dashscope/models', async (_request, reply) => {
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /dashscope/video — 视频生成(异步)
  server.post('/dashscope/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'video', data)
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // POST /dashscope/embedding — 文本向量化
  server.post('/dashscope/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // POST /dashscope/multimodal — 多模态对话
  server.post('/dashscope/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // POST /dashscope/agent — 智能体调用
  server.post('/dashscope/agent', async (request, reply) => {
    const body = request.body as { agentId?: string; messages?: unknown[] }
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/agents/generation',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'dashscope')
    return reply.send(success(data))
  })

  // ==========================================================================
  // 2. Doubao(豆包/字节)— 8 端点
  // ==========================================================================

  // POST /doubao/chat — 对话
  server.post('/doubao/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string; temperature?: number }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // POST /doubao/image — 文生图
  server.post('/doubao/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // POST /doubao/image-edit — 豆包图片编辑（图生图，doubao-seededit-3-0-i2i）
  server.post('/doubao/image-edit', async (request, reply) => {
    const body = request.body as {
      prompt?: string
      image?: string
      model?: string
      size?: string
      strength?: number
    }
    if (!body.prompt || !body.image) {
      return reply.status(400).send(error(400, 'prompt 和 image 为必填'))
    }
    // 豆包 SeedEdit 图生图：复用 images/generations 端点，指定 i2i 模型
    const payload = {
      model: body.model ?? 'doubao-seededit-3-0-i2i',
      prompt: body.prompt,
      image: body.image,
      ...(body.size ? { size: body.size } : {}),
      ...(body.strength !== undefined ? { strength: body.strength } : {}),
    }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      reply,
      { method: 'POST', body: JSON.stringify(payload) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // POST /doubao/tts — 语音合成
  server.post('/doubao/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string }
    const data = await callVendor('doubao', 'https://openspeech.bytedance.com/api/v1/tts', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // POST /doubao/asr — 语音识别
  server.post('/doubao/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string }
    const data = await callVendor('doubao', 'https://openspeech.bytedance.com/api/v1/asr', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // GET /doubao/models — 模型列表
  server.get('/doubao/models', async (_request, reply) => {
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /doubao/video — 视频生成(异步)
  server.post('/doubao/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'doubao', 'video', data)
    recordUsage(request.userId!, 'doubao')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // POST /doubao/embedding — 向量化
  server.post('/doubao/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/embeddings',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // POST /doubao/multimodal — 多模态
  server.post('/doubao/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string }
    const data = await callVendor(
      'doubao',
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'doubao')
    return reply.send(success(data))
  })

  // ==========================================================================
  // 3. Gemini(Google)— 8 端点
  // ==========================================================================

  // POST /gemini/chat — 对话
  server.post('/gemini/chat', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string }
    const model = body.model ?? 'gemini-2.0-flash'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // POST /gemini/image — 文生图(Imagen)
  server.post('/gemini/image', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; size?: string }
    const model = body.model ?? 'imagen-3.0-generate-002'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`,
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          instances: [{ prompt: body.prompt }],
          parameters: { sampleCount: 1 },
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // POST /gemini/tts — 语音合成
  server.post('/gemini/tts', async (request, reply) => {
    const body = request.body as { text?: string; model?: string; voice?: string }
    const data = await callVendor(
      'gemini',
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          input: { text: body.text },
          voice: { languageCode: 'zh-CN', name: body.voice },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // POST /gemini/asr — 语音识别
  server.post('/gemini/asr', async (request, reply) => {
    const body = request.body as { audioUrl?: string; model?: string }
    const data = await callVendor(
      'gemini',
      'https://speech.googleapis.com/v1/speech:recognize',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // GET /gemini/models — 模型列表
  server.get('/gemini/models', async (_request, reply) => {
    const data = await callVendor(
      'gemini',
      'https://generativelanguage.googleapis.com/v1beta/models',
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /gemini/video — 视频生成(Veo,异步)
  server.post('/gemini/video', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string }
    const model = body.model ?? 'veo-3.0-generate-preview'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`,
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          instances: [{ prompt: body.prompt }],
          parameters: { sampleCount: 1 },
        }),
      },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'gemini', 'video', data)
    recordUsage(request.userId!, 'gemini')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // POST /gemini/embedding — 向量化
  server.post('/gemini/embedding', async (request, reply) => {
    const body = request.body as { text?: string; model?: string }
    const model = body.model ?? 'text-embedding-004'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`,
      reply,
      { method: 'POST', body: JSON.stringify({ content: { parts: [{ text: body.text }] } }) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // POST /gemini/multimodal — 多模态
  server.post('/gemini/multimodal', async (request, reply) => {
    const body = request.body as { messages?: unknown[]; model?: string }
    const model = body.model ?? 'gemini-2.0-flash'
    const data = await callVendor(
      'gemini',
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'gemini')
    return reply.send(success(data))
  })

  // ==========================================================================
  // 4. Suno(音乐生成)— 5 端点
  // ==========================================================================

  // POST /suno/generate — 生成音乐(异步)
  server.post('/suno/generate', async (request, reply) => {
    const body = request.body as { prompt?: string; model?: string; duration?: number }
    const data = await callVendor('suno', 'https://api.suno.ai/v1/music/generations', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    const task = createTask(request.userId!, 'suno', 'music', data)
    recordUsage(request.userId!, 'suno')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // GET /suno/tasks — 任务列表
  server.get('/suno/tasks', async (request, reply) => {
    const key = requireVendorKey('suno', reply)
    if (!key) return
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (t.vendor === 'suno' && t.userId === request.userId) list.push(t)
    }
    return reply.send(success(list))
  })

  // GET /suno/tasks/:taskId — 任务详情
  server.get('/suno/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const task = taskStore.get(taskId)
    if (!task || task.vendor !== 'suno') {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    // 尝试从上游拉取最新状态
    const upstream = await callVendor(
      'suno',
      `https://api.suno.ai/v1/music/generations/${encodeURIComponent(taskId)}`,
      reply,
      { method: 'GET' },
    )
    if (upstream) task.result = upstream
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })

  // POST /suno/lyrics — 歌词生成
  server.post('/suno/lyrics', async (request, reply) => {
    const body = request.body as { prompt?: string }
    const data = await callVendor('suno', 'https://api.suno.ai/v1/lyrics/generations', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'suno')
    return reply.send(success(data))
  })

  // GET /suno/models — 模型列表
  server.get('/suno/models', async (_request, reply) => {
    const data = await callVendor('suno', 'https://api.suno.ai/v1/models', reply, { method: 'GET' })
    if (data === null) return
    return reply.send(success(data))
  })

  // ==========================================================================
  // 5. Sora2(OpenAI 视频)— 4 端点
  // ==========================================================================

  // POST /sora2/generate — 生成视频(异步)
  server.post('/sora2/generate', async (request, reply) => {
    const body = request.body as {
      prompt?: string
      model?: string
      duration?: number
      size?: string
    }
    const data = await callVendor('sora2', 'https://api.openai.com/v1/videos/generations', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    const task = createTask(request.userId!, 'sora2', 'video', data)
    recordUsage(request.userId!, 'sora2')
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // GET /sora2/tasks — 任务列表
  server.get('/sora2/tasks', async (request, reply) => {
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (t.vendor === 'sora2' && t.userId === request.userId) list.push(t)
    }
    return reply.send(success(list))
  })

  // GET /sora2/tasks/:taskId — 任务详情
  server.get('/sora2/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const task = taskStore.get(taskId)
    if (!task || task.vendor !== 'sora2') {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    const upstream = await callVendor(
      'sora2',
      `https://api.openai.com/v1/videos/generations/${encodeURIComponent(taskId)}`,
      reply,
      { method: 'GET' },
    )
    if (upstream) task.result = upstream
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })

  // GET /sora2/models — 模型列表
  server.get('/sora2/models', async (_request, reply) => {
    const data = await callVendor('sora2', 'https://api.openai.com/v1/models', reply, {
      method: 'GET',
    })
    if (data === null) return
    return reply.send(success(data))
  })

  // ==========================================================================
  // 6. Coze(扣子)— 8 端点
  // ==========================================================================

  // POST /coze/chat — 对话
  server.post('/coze/chat', async (request, reply) => {
    const body = request.body as { botId?: string; messages?: unknown[] }
    const data = await callVendor('coze', 'https://api.coze.cn/v1/chat', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'coze')
    return reply.send(success(data))
  })

  // POST /coze/bot/create — 创建机器人
  server.post('/coze/bot/create', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const data = await callVendor('coze', 'https://api.coze.cn/v1/bot/create', reply, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (data === null) return
    recordUsage(request.userId!, 'coze')
    return reply.send(success(data))
  })

  // GET /coze/bots — 机器人列表
  server.get('/coze/bots', async (request, reply) => {
    const query = request.query as { page_size?: string }
    const data = await callVendor(
      'coze',
      `https://api.coze.cn/v1/bots/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`,
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // GET /coze/bots/:botId — 机器人详情
  server.get('/coze/bots/:botId', async (request, reply) => {
    const { botId } = request.params as { botId: string }
    const data = await callVendor(
      'coze',
      `https://api.coze.cn/v1/bot/get_online_info?bot_id=${encodeURIComponent(botId)}`,
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /coze/workflow/run — 运行工作流
  server.post('/coze/workflow/run', async (request, reply) => {
    const body = request.body as { workflowId?: string; parameters?: Record<string, unknown> }
    const data = await callVendor('coze', 'https://api.coze.cn/v1/workflow/run', reply, {
      method: 'POST',
      body: JSON.stringify({ workflow_id: body.workflowId, parameters: body.parameters }),
    })
    if (data === null) return
    recordUsage(request.userId!, 'coze')
    return reply.send(success(data))
  })

  // GET /coze/workflows — 工作流列表
  server.get('/coze/workflows', async (_request, reply) => {
    const data = await callVendor('coze', 'https://api.coze.cn/v1/workflows/list', reply, {
      method: 'GET',
    })
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /coze/knowledge/upload — 知识库上传
  server.post('/coze/knowledge/upload', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const data = await callVendor(
      'coze',
      'https://api.coze.cn/v1/knowledge/document/create',
      reply,
      { method: 'POST', body: JSON.stringify(body) },
    )
    if (data === null) return
    recordUsage(request.userId!, 'coze')
    return reply.send(success(data))
  })

  // GET /coze/knowledge/list — 知识库列表
  server.get('/coze/knowledge/list', async (request, reply) => {
    const query = request.query as { page_size?: string }
    const data = await callVendor(
      'coze',
      `https://api.coze.cn/v1/knowledge/list?${new URLSearchParams({ page_size: query.page_size ?? '20' })}`,
      reply,
      { method: 'GET' },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // ==========================================================================
  // 7. Bailian(百炼/阿里云)— 2 端点
  // ==========================================================================

  // POST /bailian/chat — 百炼应用对话(HTTP,支持流式收集)
  server.post('/bailian/chat', async (request, reply) => {
    const body = request.body as {
      prompt?: string
      appId?: string
      sessionId?: string
      stream?: boolean
    }
    if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
    const key = requireVendorKey('bailian', reply)
    if (!key) return
    const appId = body.appId ?? process.env.BAILIAN_APP_ID
    if (!appId) return reply.status(400).send(error(400, '百炼应用ID 未配置(BAILIAN_APP_ID)'))
    const input: Record<string, unknown> = { prompt: body.prompt }
    if (body.sessionId) input.session_id = body.sessionId
    const payload: Record<string, unknown> = {
      model: appId,
      input,
      parameters: { incremental_output: true },
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }
    if (body.stream) {
      headers['X-DashScope-SSE'] = 'enable'
      payload.stream = true
    }
    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        { method: 'POST', headers, body: JSON.stringify(payload) },
        120_000,
      )
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        return reply
          .status(502)
          .send(error(502, `百炼调用失败: ${resp.status} ${JSON.stringify(errData).slice(0, 500)}`))
      }
      if (body.stream && resp.headers.get('content-type')?.includes('text/event-stream')) {
        const text = await resp.text()
        const chunks: string[] = []
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            const chunk = JSON.parse(line.slice(5).trim())?.output?.text ?? ''
            if (chunk) chunks.push(chunk)
          } catch {
            /* skip */
          }
        }
        recordUsage(request.userId!, 'bailian')
        return reply.send(success({ reply: chunks.join(''), chunks, appId }))
      }
      const data = (await resp.json()) as Record<string, unknown>
      const output = data.output as Record<string, unknown> | undefined
      recordUsage(request.userId!, 'bailian')
      return reply.send(
        success({
          reply: output?.text ?? '',
          sessionId: output?.session_id ?? body.sessionId,
          appId,
          usage: data.usage ?? {},
        }),
      )
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `百炼调用异常: ${msg}`))
    }
  })

  // WS /bailian/ws — 百炼应用流式对话(WebSocket)
  server.get('/bailian/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token
    if (!token) {
      socket.close(4001, '缺少 token')
      return
    }
    void (async () => {
      let userId: string
      try {
        userId = (await verifyAccessToken(token)).userId
      } catch {
        socket.close(4003, 'token 无效')
        return
      }
      socket.on('message', async (data: Buffer) => {
        try {
          const req = JSON.parse(data.toString()) as {
            app_id?: string
            prompt?: string
            session_id?: string
          }
          const appId = req.app_id ?? process.env.BAILIAN_APP_ID
          if (!appId) {
            socket.send(JSON.stringify({ event: 'error', message: '缺少 app_id' }))
            return
          }
          if (!req.prompt) {
            socket.send(JSON.stringify({ event: 'error', message: '缺少 prompt' }))
            return
          }
          const key = process.env.BAILIAN_API_KEY ?? process.env.DASHSCOPE_API_KEY
          if (!key) {
            socket.send(JSON.stringify({ event: 'error', message: 'API Key 未配置' }))
            return
          }
          const input: Record<string, unknown> = { prompt: req.prompt }
          if (req.session_id) input.session_id = req.session_id
          const resp = await fetchWithTimeout(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
                'X-DashScope-SSE': 'enable',
              },
              body: JSON.stringify({
                model: appId,
                input,
                parameters: { incremental_output: true },
                stream: true,
              }),
            },
            120_000,
          )
          if (!resp.ok) {
            socket.send(JSON.stringify({ event: 'error', message: `百炼调用失败: ${resp.status}` }))
            return
          }
          const text = await resp.text()
          let fullText = ''
          let sessionId = req.session_id
          for (const line of text.split('\n')) {
            if (!line.startsWith('data:')) continue
            try {
              const obj = JSON.parse(line.slice(5).trim())
              const chunk = obj?.output?.text ?? ''
              if (chunk) {
                fullText += chunk
                socket.send(JSON.stringify({ event: 'chunk', data: chunk }))
              }
              if (obj?.output?.session_id) sessionId = obj.output.session_id
            } catch {
              /* skip */
            }
          }
          recordUsage(userId, 'bailian')
          socket.send(
            JSON.stringify({ event: 'completed', full_text: fullText, session_id: sessionId }),
          )
        } catch (e) {
          socket.send(JSON.stringify({ event: 'error', message: (e as Error).message }))
        }
      })
    })()
  })

  // ==========================================================================
  // 8. JiMeng4(即梦/字节AI绘画)— 1 端点
  // ==========================================================================

  // POST /jimeng4/image — 即梦4.0 文生图(异步提交+轮询)
  server.post('/jimeng4/image', async (request, reply) => {
    const body = request.body as { prompt?: string; width?: number; height?: number; seed?: number }
    if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
    const keys = requireVendorKeys('jimeng4', reply)
    if (!keys) return
    const submitBody: Record<string, unknown> = {
      req_key: 'jimeng_t2i_v40',
      prompt: body.prompt,
      return_url: true,
    }
    if (body.width) submitBody.width = body.width
    if (body.height) submitBody.height = body.height
    if (body.seed !== null && body.seed !== undefined) submitBody.seed = body.seed
    try {
      const signed = volcengineSign(
        { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
        submitBody,
        keys.key,
        keys.secret,
      )
      const resp = await fetchWithTimeout(
        signed.url,
        { method: 'POST', headers: signed.headers, body: signed.body },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok)
        return reply
          .status(502)
          .send(error(502, `即梦调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`))
      const dataBlock = data.data as Record<string, unknown> | undefined
      const taskId = dataBlock?.task_id as string | undefined
      if (!taskId) return reply.status(502).send(error(502, '即梦未返回 task_id'))
      const final = await pollVolcengineTask(keys.key, keys.secret, 'jimeng_t2i_v40', taskId)
      const finalData = final.data as Record<string, unknown> | undefined
      const imageUrls: string[] = Array.isArray(finalData?.image_urls)
        ? (finalData!.image_urls as string[])
        : []
      recordUsage(request.userId!, 'jimeng4')
      return reply.send(success({ image_urls: imageUrls, request_id: data.request_id }))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `即梦调用异常: ${msg}`))
    }
  })

  // ==========================================================================
  // 9. N8N(工作流平台)— 3 端点
  // ==========================================================================

  // POST /n8n/workflows — 查询N8N工作流列表(凭据从请求体传入)
  server.post('/n8n/workflows', async (request, reply) => {
    const body = request.body as { n8nDomain?: string; apiKey?: string }
    if (!body.n8nDomain || !body.apiKey)
      return reply.status(400).send(error(400, 'n8nDomain 和 apiKey 为必填'))
    try {
      const resp = await fetchWithTimeout(
        `https://${body.n8nDomain}/api/v1/workflows?active=true`,
        { method: 'GET', headers: { 'X-N8N-API-KEY': body.apiKey } },
        30_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) return reply.status(502).send(error(502, `N8N 调用失败: ${resp.status}`))
      const items = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : []
      const formatted = items.map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt ?? null,
        updatedAt: item.updatedAt ?? null,
      }))
      return reply.send(success(formatted))
    } catch (e) {
      return reply.status(502).send(error(502, `N8N 调用异常: ${(e as Error).message}`))
    }
  })

  // POST /n8n/workflow/run — 运行N8N工作流
  server.post('/n8n/workflow/run', async (request, reply) => {
    const body = request.body as {
      workflowId?: string
      webhookPath?: string
      inputData?: Record<string, unknown>
    }
    const baseUrl = process.env.N8N_BASE_URL
    if (!baseUrl) return reply.status(503).send(error(503, 'N8N_BASE_URL 未配置'))
    const key = requireVendorKey('n8n', reply)
    if (!key) return
    const url = body.workflowId
      ? `${baseUrl.replace(/\/$/, '')}/api/v1/workflows/${encodeURIComponent(body.workflowId)}/activate`
      : `${baseUrl.replace(/\/$/, '')}${body.webhookPath ?? '/webhook'}`
    try {
      const resp = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': key },
          body: JSON.stringify(body.inputData ?? {}),
        },
        120_000,
      )
      const data = (await resp.json().catch(() => ({ raw_response: '' }))) as unknown
      if (!resp.ok) return reply.status(502).send(error(502, `N8N 调用失败: ${resp.status}`))
      recordUsage(request.userId!, 'n8n')
      return reply.send(success(data))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `N8N 调用异常: ${msg}`))
    }
  })

  // POST /n8n/addAgent — 通过N8N新增智能体(内存存储)
  server.post('/n8n/addAgent', async (request, reply) => {
    const body = request.body as {
      agentName?: string
      agentDescription?: string
      connectorUserId?: string
      agentVariables?: Record<string, unknown>
      agentModel?: string
      agentAvatar?: string
    }
    if (!body.agentName || !body.connectorUserId)
      return reply.status(400).send(error(400, 'agentName 和 connectorUserId 为必填'))
    const agentId = `n8n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const agent: Record<string, unknown> = {
      agentId,
      agentName: body.agentName,
      agentDescription: body.agentDescription ?? '',
      connectorUserId: body.connectorUserId,
      agentVariables: body.agentVariables ?? {},
      agentModel: body.agentModel ?? '',
      agentAvatar: body.agentAvatar ?? '',
      source: 'n8n',
      publishStatus: 'pending',
      createdAt: Date.now(),
    }
    n8nAgentStore.set(agentId, agent)
    recordUsage(request.userId!, 'n8n')
    return reply.send(success({ agent_id: agentId }))
  })

  // ==========================================================================
  // 10. Tencent(腾讯混元/ARC)— 4 端点
  // ==========================================================================

  // POST /tencent/hunyuan3d/submit — 提交混元3D任务
  server.post('/tencent/hunyuan3d/submit', async (request, reply) => {
    const body = request.body as {
      Prompt?: string
      ImageBase64?: string
      ImageUrl?: string
      ResultFormat?: string
      EnablePBR?: boolean
    }
    if (!body.Prompt && !body.ImageBase64 && !body.ImageUrl)
      return reply.status(400).send(error(400, 'Prompt / ImageBase64 / ImageUrl 至少提供一个'))
    const keys = requireVendorKeys('tencent', reply)
    if (!keys) return
    const params: Record<string, unknown> = {}
    if (body.Prompt) params.Prompt = body.Prompt
    if (body.ImageBase64) params.ImageBase64 = body.ImageBase64
    if (body.ImageUrl) params.ImageUrl = body.ImageUrl
    if (body.ResultFormat) params.ResultFormat = body.ResultFormat
    if (body.EnablePBR !== null && body.EnablePBR !== undefined) params.EnablePBR = body.EnablePBR
    try {
      const payloadStr = JSON.stringify(params)
      const headers = buildTencentHeaders('SubmitHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
      const resp = await fetchWithTimeout(
        'https://ai3d.tencentcloudapi.com',
        { method: 'POST', headers, body: payloadStr },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok)
        return reply
          .status(502)
          .send(error(502, `腾讯云调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`))
      const respData = (data.Response ?? {}) as Record<string, unknown>
      const jobId = respData.JobId as string | undefined
      if (!jobId)
        return reply
          .status(502)
          .send(
            error(
              502,
              `提交任务失败: ${(respData.Error as Record<string, unknown>)?.Message ?? '未知错误'}`,
            ),
          )
      const task = createTask(request.userId!, 'tencent', 'hunyuan3d', { jobId })
      tencentActiveJobs.set(jobId, {
        userId: request.userId,
        prompt: body.Prompt ?? '',
        imageUrl: body.ImageUrl ?? '',
        submitTime: Date.now(),
        status: 'PENDING',
      })
      recordUsage(request.userId!, 'tencent')
      return reply.send(success({ JobId: jobId, taskId: task.taskId }))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `腾讯云调用异常: ${msg}`))
    }
  })

  // POST /tencent/hunyuan3d/query — 查询混元3D任务状态
  server.post('/tencent/hunyuan3d/query', async (request, reply) => {
    const body = request.body as { JobId?: string }
    if (!body.JobId) return reply.status(400).send(error(400, 'JobId 为必填'))
    const keys = requireVendorKeys('tencent', reply)
    if (!keys) return
    try {
      const payloadStr = JSON.stringify({ JobId: body.JobId })
      const headers = buildTencentHeaders('QueryHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
      const resp = await fetchWithTimeout(
        'https://ai3d.tencentcloudapi.com',
        { method: 'POST', headers, body: payloadStr },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) return reply.status(502).send(error(502, `腾讯云调用失败: ${resp.status}`))
      return reply.send(success(data.Response ?? data))
    } catch (e) {
      return reply.status(502).send(error(502, `腾讯云调用异常: ${(e as Error).message}`))
    }
  })

  // GET /tencent/hunyuan3d/task/:taskId — 按路径参数查询任务
  server.get('/tencent/hunyuan3d/task/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const keys = requireVendorKeys('tencent', reply)
    if (!keys) return
    try {
      const payloadStr = JSON.stringify({ JobId: taskId })
      const headers = buildTencentHeaders('QueryHunyuanTo3DJob', payloadStr, keys.key, keys.secret)
      const resp = await fetchWithTimeout(
        'https://ai3d.tencentcloudapi.com',
        { method: 'POST', headers, body: payloadStr },
        60_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) return reply.status(502).send(error(502, `腾讯云调用失败: ${resp.status}`))
      return reply.send(success(data.Response ?? data))
    } catch (e) {
      return reply.status(502).send(error(502, `腾讯云调用异常: ${(e as Error).message}`))
    }
  })

  // GET /tencent/hunyuan3d/active-jobs — 查看活跃任务
  server.get('/tencent/hunyuan3d/active-jobs', async (_request, reply) => {
    const jobs: Record<string, unknown> = {}
    for (const [jid, info] of tencentActiveJobs) {
      jobs[jid] = {
        ...info,
        waitMinutes: Math.round((Date.now() - (info.submitTime as number)) / 60000),
      }
    }
    return reply.send(success({ activeCount: tencentActiveJobs.size, jobs }))
  })

  // ==========================================================================
  // 11. Volcengine(火山引擎)— 5 端点
  // ==========================================================================

  // GET /volcengine/ping — 健康检查
  server.get('/volcengine/ping', async (_request, reply) => {
    return reply.send(success({ ok: true, module: 'volcengine' }))
  })

  // POST /volcengine/jimeng/image — 即梦4.0 文生图(异步提交+轮询)
  server.post('/volcengine/jimeng/image', async (request, reply) => {
    const body = request.body as { prompt?: string; width?: number; height?: number; seed?: number }
    if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
    const keys = requireVendorKeys('volcengine', reply)
    if (!keys) return
    const submitBody: Record<string, unknown> = {
      req_key: 'jimeng_t2i_v40',
      prompt: body.prompt,
      return_url: true,
    }
    if (body.width) submitBody.width = body.width
    if (body.height) submitBody.height = body.height
    if (body.seed !== null && body.seed !== undefined) submitBody.seed = body.seed
    try {
      const signed = volcengineSign(
        { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
        submitBody,
        keys.key,
        keys.secret,
      )
      const resp = await fetchWithTimeout(
        signed.url,
        { method: 'POST', headers: signed.headers, body: signed.body },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok)
        return reply
          .status(502)
          .send(
            error(502, `火山引擎调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
          )
      const dataBlock = data.data as Record<string, unknown> | undefined
      const taskId = dataBlock?.task_id as string | undefined
      if (!taskId) return reply.status(502).send(error(502, '未返回 task_id'))
      const final = await pollVolcengineTask(keys.key, keys.secret, 'jimeng_t2i_v40', taskId)
      const finalData = final.data as Record<string, unknown> | undefined
      const imageUrls: string[] = Array.isArray(finalData?.image_urls)
        ? (finalData!.image_urls as string[])
        : []
      recordUsage(request.userId!, 'volcengine')
      return reply.send(success({ image_urls: imageUrls, request_id: data.request_id }))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `火山引擎调用异常: ${msg}`))
    }
  })

  // POST /volcengine/jimeng/generate — 即梦3.1 生成
  server.post('/volcengine/jimeng/generate', async (request, reply) => {
    const body = request.body as { prompt?: string }
    if (!body.prompt) return reply.status(400).send(error(400, 'prompt 为必填'))
    const keys = requireVendorKeys('volcengine', reply)
    if (!keys) return
    try {
      const signed = volcengineSign(
        { Action: 'CVProcess', Version: '2022-08-31' },
        { req_key: 'jimeng_t2i_v31', prompt: body.prompt },
        keys.key,
        keys.secret,
      )
      const resp = await fetchWithTimeout(
        signed.url,
        { method: 'POST', headers: signed.headers, body: signed.body },
        120_000,
      )
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
      recordUsage(request.userId!, 'volcengine')
      return reply.send(success(data))
    } catch (e) {
      return reply.status(502).send(error(502, `火山引擎调用异常: ${(e as Error).message}`))
    }
  })

  // POST /volcengine/visual/:reqKey — 火山视觉通用代理(异步提交+轮询)
  server.post('/volcengine/visual/:reqKey', async (request, reply) => {
    const { reqKey } = request.params as { reqKey: string }
    const body = request.body as { prompt?: string; images?: string[]; [key: string]: unknown }
    const keys = requireVendorKeys('volcengine', reply)
    if (!keys) return
    const submitBody: Record<string, unknown> = {
      req_key: reqKey,
      prompt: body.prompt ?? '',
      image_urls: body.images ?? [],
    }
    for (const [k, v] of Object.entries(body)) {
      if (!['prompt', 'images'].includes(k)) submitBody[k] = v
    }
    try {
      const signed = volcengineSign(
        { Action: 'CVSync2AsyncSubmitTask', Version: '2022-08-31' },
        submitBody,
        keys.key,
        keys.secret,
      )
      const resp = await fetchWithTimeout(
        signed.url,
        { method: 'POST', headers: signed.headers, body: signed.body },
        120_000,
      )
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
      if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
      const dataBlock = data.data as Record<string, unknown> | undefined
      const taskId = dataBlock?.task_id as string | undefined
      if (!taskId) return reply.status(502).send(error(502, '未返回 task_id'))
      const final = await pollVolcengineTask(keys.key, keys.secret, reqKey, taskId)
      const finalData = final.data as Record<string, unknown> | undefined
      recordUsage(request.userId!, 'volcengine')
      return reply.send(
        success({ video_url: finalData?.video_url ?? '', request_id: data.request_id }),
      )
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `火山引擎调用异常: ${msg}`))
    }
  })

  // POST /volcengine/jimeng4/process — 即梦4.0 CVProcess 通用转发
  server.post('/volcengine/jimeng4/process', async (request, reply) => {
    const body = request.body as { req_key?: string; [key: string]: unknown }
    if (!body.req_key) return reply.status(400).send(error(400, 'req_key 为必填'))
    const keys = requireVendorKeys('volcengine', reply)
    if (!keys) return
    try {
      const signed = volcengineSign(
        { Action: 'CVProcess', Version: '2022-08-31' },
        body,
        keys.key,
        keys.secret,
      )
      const resp = await fetchWithTimeout(
        signed.url,
        { method: 'POST', headers: signed.headers, body: signed.body },
        120_000,
      )
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) return reply.status(502).send(error(502, `火山引擎调用失败: ${resp.status}`))
      recordUsage(request.userId!, 'volcengine')
      return reply.send(success(data))
    } catch (e) {
      return reply.status(502).send(error(502, `火山引擎调用异常: ${(e as Error).message}`))
    }
  })

  // ==========================================================================
  // 12. 通用工具端点 — 17 端点
  // ==========================================================================

  // GET /vendors — 支持的厂商列表
  server.get('/vendors', async (_request, reply) => {
    const list = Object.entries(VENDORS).map(([key, cfg]) => ({
      vendor: key,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
    }))
    return reply.send(success(list))
  })

  // GET /vendors/:vendor/models — 指定厂商模型列表
  server.get('/vendors/:vendor/models', async (request, reply) => {
    const { vendor } = request.params as { vendor: string }
    const cfg = VENDORS[vendor]
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    // 复用各厂商的 models 端点
    const modelEndpoints: Record<string, string> = {
      dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3/models',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
      suno: 'https://api.suno.ai/v1/models',
      sora2: 'https://api.openai.com/v1/models',
      coze: 'https://api.coze.cn/v1/models',
      volcengine: 'https://visual.volcengineapi.com/',
      jimeng4: 'https://visual.volcengineapi.com/',
    }
    const data = await callVendor(vendor, modelEndpoints[vendor] ?? cfg.baseUrl, reply, {
      method: 'GET',
    })
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /proxy — 通用代理
  server.post('/proxy', async (request, reply) => {
    const body = request.body as { vendor?: string; endpoint?: string; payload?: unknown }
    if (!body.vendor || !body.endpoint) {
      return reply.status(400).send(error(400, 'vendor 和 endpoint 为必填'))
    }
    const cfg = VENDORS[body.vendor]
    if (!cfg) return reply.status(400).send(error(400, `不支持的厂商: ${body.vendor}`))
    const url = body.endpoint.startsWith('http') ? body.endpoint : `${cfg.baseUrl}${body.endpoint}`
    const data = await callVendor(body.vendor, url, reply, {
      method: 'POST',
      body: JSON.stringify(body.payload ?? {}),
    })
    if (data === null) return
    recordUsage(request.userId!, body.vendor)
    return reply.send(success(data))
  })

  // GET /tasks — 异步任务列表(跨厂商,当前用户)
  server.get('/tasks', async (request, reply) => {
    const query = request.query as { vendor?: string; status?: string }
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (t.userId !== request.userId) continue
      if (query.vendor && t.vendor !== query.vendor) continue
      if (query.status && t.status !== query.status) continue
      list.push(t)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // GET /tasks/:taskId — 异步任务详情
  server.get('/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const task = taskStore.get(taskId)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    return reply.send(success(task))
  })

  // DELETE /tasks/:taskId — 取消任务
  server.delete('/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const task = taskStore.get(taskId)
    if (!task) return reply.status(404).send(error(404, '任务不存在'))
    if (task.userId !== request.userId) return reply.status(403).send(error(403, '无权访问该任务'))
    if (task.status === 'succeeded' || task.status === 'failed') {
      return reply.status(400).send(error(400, `任务已处于终态: ${task.status}`))
    }
    task.status = 'failed'
    task.error = '用户取消'
    task.updatedAt = Date.now()
    return reply.send(success(task))
  })

  // POST /timbre/clone — 音色克隆
  server.post('/timbre/clone', async (request, reply) => {
    const body = request.body as { voiceName?: string; audioUrl?: string; vendor?: string }
    if (!body.voiceName || !body.audioUrl) {
      return reply.status(400).send(error(400, 'voiceName 和 audioUrl 为必填'))
    }
    const vendor = body.vendor ?? 'doubao'
    const vendorCfg = VENDORS[vendor]
    if (!vendorCfg) return reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    const data = await callVendor(vendor, `${vendorCfg.baseUrl}/v1/voice/clone`, reply, {
      method: 'POST',
      body: JSON.stringify({ voice_name: body.voiceName, audio_url: body.audioUrl }),
    })
    if (data === null) return
    const timbre: Timbre = {
      timbreId: genId('timbre'),
      userId: request.userId!,
      voiceName: body.voiceName,
      audioUrl: body.audioUrl,
      vendor,
      status: 'training',
      createdAt: Date.now(),
    }
    timbreStore.set(timbre.timbreId, timbre)
    return reply.send(success(timbre))
  })

  // GET /timbre/list — 音色列表
  server.get('/timbre/list', async (request, reply) => {
    const list: Timbre[] = []
    for (const t of timbreStore.values()) {
      if (t.userId === request.userId) list.push(t)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // DELETE /timbre/:timbreId — 删除音色
  server.delete('/timbre/:timbreId', async (request, reply) => {
    const { timbreId } = request.params as { timbreId: string }
    const timbre = timbreStore.get(timbreId)
    if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
    if (timbre.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除该音色'))
    timbreStore.delete(timbreId)
    return reply.send(success({ timbreId, deleted: true }))
  })

  // PUT /timbre/:timbreId — 更新音色（voiceName / audioUrl / status）
  server.put('/timbre/:timbreId', async (request, reply) => {
    const { timbreId } = request.params as { timbreId: string }
    const body = request.body as {
      voiceName?: string
      audioUrl?: string
      status?: Timbre['status']
    }
    const timbre = timbreStore.get(timbreId)
    if (!timbre) return reply.status(404).send(error(404, '音色不存在'))
    if (timbre.userId !== request.userId)
      return reply.status(403).send(error(403, '无权修改该音色'))
    if (body.voiceName !== undefined) timbre.voiceName = body.voiceName
    if (body.audioUrl !== undefined) timbre.audioUrl = body.audioUrl
    if (body.status !== undefined) timbre.status = body.status
    return reply.send(success(timbre))
  })

  // POST /watermark/image — 图片水印
  server.post('/watermark/image', async (request, reply) => {
    const body = request.body as { imageUrl?: string; text?: string; position?: string }
    if (!body.imageUrl) return reply.status(400).send(error(400, 'imageUrl 为必填'))
    // 委托给通义图片编辑(若无配置则返回提示)
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-outpainting/image-synthesis',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          image_url: body.imageUrl,
          text: body.text,
          position: body.position ?? 'bottom-right',
        }),
      },
    )
    if (data === null) return
    return reply.send(success(data))
  })

  // POST /watermark/video — 视频水印
  server.post('/watermark/video', async (request, reply) => {
    const body = request.body as { videoUrl?: string; text?: string; position?: string }
    if (!body.videoUrl) return reply.status(400).send(error(400, 'videoUrl 为必填'))
    const data = await callVendor(
      'dashscope',
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      reply,
      {
        method: 'POST',
        body: JSON.stringify({
          video_url: body.videoUrl,
          text: body.text,
          position: body.position ?? 'bottom-right',
        }),
      },
    )
    if (data === null) return
    const task = createTask(request.userId!, 'dashscope', 'watermark-video', data)
    return reply.send(success({ taskId: task.taskId, status: task.status, raw: data }))
  })

  // GET /usage — 用量统计(当前用户)
  server.get('/usage', async (request, reply) => {
    const list: UsageStat[] = []
    for (const u of usageStore.values()) {
      if (u.userId === request.userId) list.push(u)
    }
    const total = list.reduce((sum, u) => sum + u.calls, 0)
    return reply.send(success({ total, vendors: list }))
  })

  // GET /usage/:vendor — 指定厂商用量
  server.get('/usage/:vendor', async (request, reply) => {
    const { vendor } = request.params as { vendor: string }
    const u = usageStore.get(`${request.userId}:${vendor}`)
    if (!u) return reply.send(success({ userId: request.userId, vendor, calls: 0 }))
    return reply.send(success(u))
  })

  // POST /aigc/record — 记录 AIGC 生成
  server.post('/aigc/record', async (request, reply) => {
    const body = request.body as {
      type?: string
      vendor?: string
      prompt?: string
      resultUrl?: string
    }
    if (!body.type || !body.vendor) {
      return reply.status(400).send(error(400, 'type 和 vendor 为必填'))
    }
    const record: AigcRecord = {
      recordId: genId('aigc'),
      userId: request.userId!,
      type: body.type,
      vendor: body.vendor,
      prompt: body.prompt ?? '',
      resultUrl: body.resultUrl,
      createdAt: Date.now(),
    }
    aigcStore.set(record.recordId, record)
    return reply.send(success(record))
  })

  // GET /aigc/records — AIGC 记录列表
  server.get('/aigc/records', async (request, reply) => {
    const query = request.query as { type?: string; vendor?: string }
    const list: AigcRecord[] = []
    for (const r of aigcStore.values()) {
      if (r.userId !== request.userId) continue
      if (query.type && r.type !== query.type) continue
      if (query.vendor && r.vendor !== query.vendor) continue
      list.push(r)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // DELETE /aigc/records/:recordId — 删除 AIGC 记录
  server.delete('/aigc/records/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string }
    const record = aigcStore.get(recordId)
    if (!record) return reply.status(404).send(error(404, '记录不存在'))
    if (record.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除该记录'))
    aigcStore.delete(recordId)
    return reply.send(success({ recordId, deleted: true }))
  })

  // GET /aigc/records/stats — AIGC 统计
  server.get('/aigc/records/stats', async (request, reply) => {
    let total = 0
    const byType: Record<string, number> = {}
    const byVendor: Record<string, number> = {}
    for (const r of aigcStore.values()) {
      if (r.userId !== request.userId) continue
      total += 1
      byType[r.type] = (byType[r.type] ?? 0) + 1
      byVendor[r.vendor] = (byVendor[r.vendor] ?? 0) + 1
    }
    return reply.send(success({ total, byType, byVendor }))
  })
}

// ============================================================================
// 管理端点:AI 厂商配置管理(可选,需登录)
// ============================================================================

export const adminAiVendorRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // GET /vendors — 厂商配置状态
  server.get('/vendors', async (_request, reply) => {
    const list = Object.entries(VENDORS).map(([key, cfg]) => ({
      vendor: key,
      name: cfg.name,
      configured: Boolean(process.env[cfg.keyEnv]),
      baseUrl: cfg.baseUrl,
    }))
    return reply.send(success(list))
  })

  // GET /vendors/:vendor — 厂商详情
  server.get('/vendors/:vendor', async (request, reply) => {
    const { vendor } = request.params as { vendor: string }
    const cfg = VENDORS[vendor]
    if (!cfg) return reply.status(404).send(error(404, '厂商不存在'))
    return reply.send(
      success({
        vendor,
        name: cfg.name,
        configured: Boolean(process.env[cfg.keyEnv]),
        baseUrl: cfg.baseUrl,
        keyEnv: cfg.keyEnv,
      }),
    )
  })

  // POST /vendors/:vendor/test — 测试厂商连通性
  server.post('/vendors/:vendor/test', async (request, reply) => {
    const { vendor } = request.params as { vendor: string }
    const cfg = VENDORS[vendor]
    if (!cfg) return reply.status(404).send(error(404, '厂商不存在'))
    const key = process.env[cfg.keyEnv]
    if (!key) return reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    try {
      const resp = await fetchWithTimeout(
        cfg.baseUrl,
        {
          method: 'GET',
          headers: { ...cfg.authHeader(key) },
        },
        10_000,
      )
      return reply.send(
        success({
          vendor,
          reachable: resp.status < 500,
          statusCode: resp.status,
        }),
      )
    } catch (e) {
      return reply.send(success({ vendor, reachable: false, error: (e as Error).message }))
    }
  })

  // GET /tasks — 全部异步任务(管理视角)
  server.get('/tasks', async (request, reply) => {
    const query = request.query as { vendor?: string; status?: string }
    const list: AsyncTask[] = []
    for (const t of taskStore.values()) {
      if (query.vendor && t.vendor !== query.vendor) continue
      if (query.status && t.status !== query.status) continue
      list.push(t)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)
    return reply.send(success(list))
  })

  // GET /usage — 全厂商用量
  server.get('/usage', async (_request, reply) => {
    const byVendor: Record<string, number> = {}
    let total = 0
    for (const u of usageStore.values()) {
      byVendor[u.vendor] = (byVendor[u.vendor] ?? 0) + u.calls
      total += u.calls
    }
    return reply.send(success({ total, byVendor }))
  })
}
