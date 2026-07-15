/**
 * AI 厂商代理路由 - 共享定义。
 */
import { createHmac, createHash } from 'node:crypto'
import type { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../../plugins/auth.js'
import { error } from '../../utils/response.js'
import { z } from 'zod'

export type { FastifyRequest, FastifyReply, FastifyPluginAsync }

export const taskIdParam = z.object({ taskId: z.string() })
export const vendorParam = z.object({ vendor: z.string() })
export const botIdParam = z.object({ botId: z.string() })
export const reqKeyParam = z.object({ reqKey: z.string() })
export const timbreIdParam = z.object({ timbreId: z.string() })
export const recordIdParam = z.object({ recordId: z.string() })

export const pageSizeQuery = z.object({ page_size: z.string().optional() })
export const tasksQuery = z.object({ vendor: z.string().optional(), status: z.string().optional() })
export const aigcRecordsQuery = z.object({ type: z.string().optional(), vendor: z.string().optional() })
export const tokenQuery = z.object({ token: z.string().optional() })

export const chatBody = z.object({
  messages: z.array(z.unknown()).optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
})
export const imageBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
})
export const ttsBody = z.object({
  text: z.string().optional(),
  model: z.string().optional(),
  voice: z.string().optional(),
})
export const asrBody = z.object({ audioUrl: z.string().optional(), model: z.string().optional() })
export const promptModelBody = z.object({ prompt: z.string().optional(), model: z.string().optional() })
export const textModelBody = z.object({ text: z.string().optional(), model: z.string().optional() })
export const multimodalBody = z.object({
  messages: z.array(z.unknown()).optional(),
  model: z.string().optional(),
})
export const promptOnlyBody = z.object({ prompt: z.string().optional() })
export const jimengBody = z.object({
  prompt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  seed: z.number().optional(),
})

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
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

export async function fetchWithTimeout(
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

export interface VendorConfig {
  name: string
  keyEnv: string
  secretKeyEnv?: string
  baseUrl: string
  authHeader: (key: string) => Record<string, string>
}

export const VENDORS: Record<string, VendorConfig> = {
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

export function requireVendorKey(vendor: string, reply: FastifyReply): string | null {
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

export function requireVendorKeys(
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

export function buildTencentHeaders(
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

export function volcengineSign(
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

export async function pollVolcengineTask(
  accessKey: string,
  secretKey: string,
  reqKey: string,
  taskId: string,
  reply: FastifyReply,
  maxPolls = 60,
  intervalMs = 5000,
): Promise<Record<string, unknown> | null> {
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
  reply.status(504).send(error(504, '异步任务轮询超时'))
  return null
}

export async function callVendor(
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

export interface AsyncTask {
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

export interface AigcRecord {
  recordId: string
  userId: string
  type: string
  vendor: string
  prompt: string
  resultUrl?: string
  createdAt: number
}

export interface Timbre {
  timbreId: string
  userId: string
  voiceName: string
  audioUrl: string
  vendor: string
  status: 'training' | 'ready' | 'failed'
  createdAt: number
}

export interface UsageStat {
  userId: string
  vendor: string
  calls: number
  lastCallAt: number
}

export const taskStore = new Map<string, AsyncTask>()
export const aigcStore = new Map<string, AigcRecord>()
export const timbreStore = new Map<string, Timbre>()
export const usageStore = new Map<string, UsageStat>()
export const n8nAgentStore = new Map<string, Record<string, unknown>>()
export const tencentActiveJobs = new Map<string, Record<string, unknown>>()

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function recordUsage(userId: string, vendor: string): void {
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

export function createTask(userId: string, vendor: string, type: string, payload?: unknown): AsyncTask {
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
