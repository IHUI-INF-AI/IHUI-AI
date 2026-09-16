// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1/* 对外开放 API — 多模态类路由(2026-07-22 立)。
 *
 * 所有端点统一 requireApiKeyAuth + requireApiKeyPermission + requireApiKeyQuota 三重 preHandler。
 * 响应格式 OpenAI 兼容(不套 { code, message, data } 壳,camelCase 字段)。
 * 鉴权由 plugins/api-key-auth.ts 提供,契约类型由 @ihui/types 提供。
 *
 * 转发策略:fetch 转发到内部 /api/* 路由(base url http://localhost:${PORT||8802})。
 * 内部 /api/* 路由使用 JWT 鉴权(plugins/auth.ts authenticate),本文件用 signAccessToken
 * 从 request.apiKey.userId 签发短期内部 JWT,作为 Bearer 透传,保持 API Key 鉴权隔离不混用用户 JWT。
 * 内部成功响应 { code:0, message:'success', data } 自动拆壳返回 data;错误响应透传 HTTP 状态码。
 *
 * 端点清单(21 个):
 * 1.  GET    /v1/audio/voices              — 音色列表(audio:read)
 * 2.  POST   /v1/audio/speech              — TTS 语音合成(audio:write)
 * 3.  POST   /v1/audio/transcriptions      — ASR 语音识别(audio:write)
 * 4.  POST   /v1/audio/chat                — 语音对话(audio:write)
 * 5.  GET    /v1/audio/speakers            — 声纹列表(audio:read)
 * 6.  POST   /v1/audio/speakers            — 声纹注册(audio:write)
 * 7.  POST   /v1/audio/speakers/compare    — 声纹比对(audio:read)
 * 8.  POST   /v1/audio/music               — 音乐生成(audio:write)
 * 9.  POST   /v1/images/generations        — 文生图(images:write,按 vendor 路由)
 * 10. POST   /v1/images/edits              — 图片编辑(images:write,按 vendor 路由)
 * 11. POST   /v1/images/inpaint            — 图片修复(images:write)
 * 12. POST   /v1/images/style-transfer     — 风格迁移(images:write)
 * 13. POST   /v1/images/virtual-try-on     — 虚拟试穿(images:write)
 * 14. POST   /v1/images/background         — 背景生成(images:write)
 * 15. POST   /v1/videos/generations        — 视频生成(videos:write,按 vendor 路由)
 * 16. GET    /v1/videos/tasks/:id          — 视频任务查询(videos:read,sora2→jimeng4 回退)
 * 17. POST   /v1/videos/compose            — 视频编排(videos:write)
 * 18. POST   /v1/3d/generations            — 3D 模型生成(threed:write)
 * 19. POST   /v1/generation/enqueue        — 生成队列入队(generation:write)
 * 20. GET    /v1/generation/status/:id     — 生成队列状态(generation:write)
 * 21. POST   /v1/generation/cancel/:id     — 生成队列取消(generation:write)
 * 22. POST   /v1/images/generations/async  — 异步文生图(任务编排骨架,202 + task id)(images:write)
 * 23. GET    /v1/images/generations/async/:id — 异步图片任务状态轮询(images:read)
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type {
  V1AudioVoicesResponse,
  V1AudioTranscriptionsResponse,
  V1AudioChatResponse,
  V1CompareSpeakersResponse,
  V1MusicGenerationsResponse,
  V1VideoGenerationsResponse,
  V1VideoTaskResponse,
  V1VideoComposeResponse,
  V1ThreeDGenerationsResponse,
  V1GenerationEnqueueResponse,
  V1GenerationStatusResponse,
} from '@ihui/types'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import type { Redis } from 'ioredis'
import { error } from '../utils/response.js'
import { getUserId, mintInternalJwt, jsonInit, asObj } from './v1-shared.js'
import { recordCall, refundTaskCall } from '../services/relay-billing-service.js'
import { forwardToChannel, type SelectedChannelKey } from '../services/relay-upstream-forwarder.js'

// =============================================================================
// 常量
// =============================================================================

/** 内部 /api/* 路由 base url(保持 API Key 鉴权隔离,不混用用户 JWT)。 */
const INTERNAL_BASE = `http://localhost:${process.env.PORT || 8802}`

// =============================================================================
// 多模态计费挂钩(2026-09-13 立)
// -----------------------------------------------------------------------------
// 生图按张 / 生视频按次(或按秒) / 按次计费模型,定价行在 ai_pricing(billing_mode):
//   per_image  → 分/张 × 张数
//   per_video  → 分/次 或 分/秒(video_unit)
//   per_call   → 三档价按上下文(chat 端点场景,这里不涉及)
// 无定价行的模型 calculateCost 回退 0(免费),不阻断调用。
// 计费时机:提交/返回成功即扣(乐观计费,防漏损);任务查询发现 failed 时
// refundTaskCall 按 costCents 全额退款(幂等,refunded 标记防重)。
// =============================================================================

/** 取鉴权后的 API Key 上下文(计费需要 apiKeyId)。 */
function apiKeyOf(request: Parameters<typeof getUserId>[0]): { id: string; userId: string } | null {
  const apiKey = (request as FastifyRequest & { apiKey?: { id: string; userId: string } }).apiKey
  return apiKey ?? null
}

/**
 * 多模态调用计费(fire-and-forget,失败只 log 不影响主链路)。
 * units:image=张数;video=次数或秒数(按定价行 videoUnit)。
 * channel:relay 直连成功时传入(渠道审计进流水 provider_code/config_id/key_pool_id)。
 */
function chargeMultimodal(
  request: Parameters<typeof getUserId>[0],
  args: {
    model: string
    callType: 'image' | 'video'
    units: number
    prompt: string
    taskId?: string
    channel?: Pick<SelectedChannelKey, 'keyPoolId' | 'providerCode' | 'configId'> | null
  },
): void {
  const apiKey = apiKeyOf(request)
  if (!apiKey) return
  void recordCall({
    apiKeyId: apiKey.id,
    userId: apiKey.userId,
    model: args.model,
    prompt: args.prompt,
    response: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    latencyMs: 0,
    status: 'success',
    callType: args.callType,
    billingUnits: Math.max(1, Math.ceil(args.units || 1)),
    providerCode: args.channel?.providerCode,
    configId: args.channel?.configId,
    keyPoolId: args.channel?.keyPoolId,
    metadata: {
      endpoint: `v1_${args.callType === 'image' ? 'images' : 'videos'}_generations`,
      ...(args.channel ? { relayDirect: true } : {}),
      ...(args.taskId ? { task_id: args.taskId } : {}),
    },
  })
}

/** 鉴权后注入 request 的 API Key 上下文(与 AuthenticatedApiKey 结构一致)。 */

// =============================================================================
// Zod schemas
// =============================================================================

const audioSpeechSchema = z.object({
  model: z.string().min(1),
  input: z.string().min(1),
  voice: z.string().min(1),
  responseFormat: z.string().optional(),
  speed: z.number().optional(),
})

const audioTranscriptionsSchema = z.object({
  model: z.string().min(1),
  audio: z.string().min(1),
  language: z.string().optional(),
  prompt: z.string().optional(),
})

const audioChatSchema = z.object({
  audio: z.string().min(1),
  model: z.string().min(1),
  sessionId: z.string().optional(),
})

const registerSpeakerSchema = z.object({
  name: z.string().min(1),
  audio: z.string().min(1),
})

const compareSpeakersSchema = z.object({
  speakerId: z.string().min(1),
  audio: z.string().min(1),
})

const musicSchema = z.object({
  prompt: z.string().min(1),
  lyrics: z.string().optional(),
  duration: z.number().optional(),
})

const imageGenerationsSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
  quality: z.string().optional(),
  style: z.string().optional(),
  vendor: z.string().optional(),
})

/**
 * 异步图片生成任务(2026-09-16 立):入参 { model, prompt, n?, size? }。
 * 与同步 /images/generations 解耦:此端点仅落地任务编排骨架(pending),
 * 不真正调用上游生图(上游调用由既有同步端点 / 调用方体系负责,worker 消费任务后推进状态)。
 */
const imageAsyncGenerationsSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
})

const imageEditsSchema = z.object({
  model: z.string().min(1),
  image: z.string().min(1),
  prompt: z.string().min(1),
  mask: z.string().optional(),
  n: z.number().int().positive().optional(),
  size: z.string().optional(),
  vendor: z.string().optional(),
})

const imageInpaintSchema = z.object({
  model: z.string().min(1),
  image: z.string().min(1),
  mask: z.string().min(1),
  prompt: z.string().min(1),
})

const styleTransferSchema = z.object({
  model: z.string().min(1),
  image: z.string().min(1),
  style: z.string().min(1),
})

const virtualTryOnSchema = z.object({
  model: z.string().min(1),
  personImage: z.string().min(1),
  garmentImage: z.string().min(1),
})

const backgroundSchema = z.object({
  model: z.string().min(1),
  foreground: z.string().min(1),
  prompt: z.string().min(1),
})

const videoGenerationsSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  image: z.string().optional(),
  duration: z.number().optional(),
  resolution: z.string().optional(),
  vendor: z.string().optional(),
})

const videoComposeSchema = z.object({
  scenes: z
    .array(
      z.object({
        text: z.string().min(1),
        duration: z.number().optional(),
        imagePrompt: z.string().optional(),
      }),
    )
    .min(1),
  bgmUrl: z.string().optional(),
})

const threeDGenerationsSchema = z.object({
  model: z.string().min(1),
  input: z.string().min(1),
  format: z.string().optional(),
})

const generationEnqueueSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  priority: z.union([z.string(), z.number()]).optional(),
})

// =============================================================================
// Fastify OpenAPI schemas(共享)
// =============================================================================

const errorResponseSchema = {
  type: 'object',
  properties: { code: { type: 'number' }, message: { type: 'string' } },
}

// =============================================================================
// 辅助函数
// =============================================================================

/** 从 apiKey 上下文取 userId,失败 reply 401。 */

/** 用 apiKey.userId 签发短期内部 JWT,模拟内部调用满足 /api/* 的 JWT 鉴权。 */

/** 构造 JSON 请求 init。 */

interface InternalResult {
  ok: boolean
  status: number
  code: number
  message: string
  data: unknown
  isBinary: boolean
  buffer: Buffer | null
  contentType: string
}

/** 调用内部 /api/* 路由,自动附加内部 JWT Bearer。 */
async function callInternal(
  path: string,
  init: RequestInit,
  userId: string,
): Promise<InternalResult> {
  const token = await mintInternalJwt(userId)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(`${INTERNAL_BASE}${path}`, { ...init, headers })
  const contentType = resp.headers.get('content-type') ?? ''

  // 二进制音频/图片直返
  if (
    contentType.includes('audio') ||
    contentType.includes('octet-stream') ||
    contentType.includes('image')
  ) {
    const buffer = Buffer.from(await resp.arrayBuffer())
    return {
      ok: resp.ok,
      status: resp.status,
      code: resp.ok ? 0 : resp.status,
      message: '',
      data: null,
      isBinary: true,
      buffer,
      contentType,
    }
  }

  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null

  // 拆壳 { code, message, data }
  if (json && typeof json === 'object' && 'code' in json) {
    const code = (json as { code: number }).code
    if (code === 0) {
      return {
        ok: true,
        status: resp.status,
        code: 0,
        message: '',
        data: (json as { data: unknown }).data,
        isBinary: false,
        buffer: null,
        contentType,
      }
    }
    return {
      ok: false,
      status: resp.status,
      code,
      message: (json as { message?: string }).message ?? '',
      data: null,
      isBinary: false,
      buffer: null,
      contentType,
    }
  }

  // 未包装的直接对象
  return {
    ok: resp.ok,
    status: resp.status,
    code: resp.ok ? 0 : resp.status,
    message: '',
    data: json,
    isBinary: false,
    buffer: null,
    contentType,
  }
}

/**
 * 通用内部转发(JSON 请求 + JSON/二进制响应)。
 * 成功返回 mapper(data) 或 data;失败返回 reply.status(httpStatus).send(error(...))。
 */
async function forwardInternal(
  reply: FastifyReply,
  path: string,
  init: RequestInit,
  userId: string,
  mapper?: (data: unknown) => unknown,
): Promise<void> {
  try {
    const result = await callInternal(path, init, userId)
    if (result.isBinary && result.buffer) {
      reply.header('Content-Type', result.contentType)
      return reply.send(result.buffer)
    }
    if (!result.ok) {
      const httpStatus = result.status >= 400 && result.status < 600 ? result.status : 502
      return reply
        .status(httpStatus)
        .send(error(httpStatus, result.message || `Internal service error (${result.status})`))
    }
    return reply.send(mapper ? mapper(result.data) : result.data)
  } catch (e) {
    return reply
      .status(503)
      .send(error(503, (e as Error).message || 'Internal service unavailable'))
  }
}

/** 将内部任务状态字符串映射为 v1 camelCase 状态。 */
function mapJobStatus(s: unknown): 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' {
  const v = typeof s === 'string' ? s.toLowerCase() : ''
  if (v === 'waiting' || v === 'delayed' || v === 'pending') return 'queued'
  if (v === 'active' || v === 'processing' || v === 'running') return 'processing'
  if (v === 'succeeded' || v === 'completed' || v === 'success') return 'completed'
  if (v === 'failed' || v === 'error') return 'failed'
  if (v === 'cancelled' || v === 'canceled') return 'cancelled'
  return 'queued'
}

/**
 * 轮询内部任务状态,直到 completed/failed 或超时。
 * 默认 30s 超时,1s 间隔。返回 {completed, result}。
 */
async function pollInternalJob(
  taskId: string,
  userId: string,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<{ completed: boolean; result?: unknown }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      const status = await callInternal(
        `/api/ai/generation/${encodeURIComponent(taskId)}/status`,
        { method: 'GET' },
        userId,
      )
      if (!status.ok) continue
      const d = asObj(status.data)
      const s = mapJobStatus(d.status)
      if (s === 'completed') return { completed: true, result: d.returnvalue ?? d.result ?? d }
      if (s === 'failed') return { completed: false, result: d }
    } catch {
      // 继续轮询
    }
  }
  return { completed: false }
}

// =============================================================================
// 异步图片生成任务编排(2026-09-16 立)
// -----------------------------------------------------------------------------
// 对标 OpenAI /images/generations/async + 轮询。本模块只落地任务编排骨架:
//   POST /v1/images/generations/async    → 创建任务,返回 202 { id, status:'pending' }
//   GET  /v1/images/generations/async/:id → 查询任务状态
// 状态推进(worker 消费上游生图结果后置 succeeded/failed)由 completeImageTask /
// failImageTask 提供 —— 本端点内部不自动推进状态。
//
// 存储:优先 Redis(key `imgtask:{id}`, JSON, TTL 24h);Redis 不可用(未连接 / 命令异常)
// 降级进程内 Map(单进程内存,重启即丢,跨进程不可见 —— 仅作骨架降级,非生产多实例方案)。
// 金额 / 计费不在本任务范围(OpenAI 异步图片的计费随既有同步链路 /images/generations 走)。
// =============================================================================

/** 任务状态(与 OpenAI images 异步约定一致)。 */
type ImageTaskStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

/** 异步图片任务记录(Redis value / 内存结构一致)。 */
interface ImageTask {
  id: string
  status: ImageTaskStatus
  model: string
  prompt: string
  /** 发起任务的下游用户(异步 worker 调上游计费链路需要) */
  userId?: string
  createdAt: string
  /** 生图结果:图片 URL / base64 数组(仅 succeeded 时存在)。 */
  result?: string[]
  /** 失败原因(仅 failed 时存在)。 */
  error?: string
}

const IMG_TASK_PREFIX = 'imgtask:'
const IMG_TASK_TTL_SECONDS = 24 * 60 * 60

/** Redis 客户端(插件注册时捕获);为 null 或命令异常时降级进程内 Map。 */
let imageTaskRedis: Redis | null = null

/** 进程内降级存储(Redis 不可用时的兜底)。 */
const inMemoryImageTasks = new Map<string, ImageTask>()

/** 解析 Redis 原始串为 ImageTask(结构非法返回 null)。 */
function parseImageTask(raw: string | null): ImageTask | null {
  if (!raw) return null
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (typeof o.id !== 'string') return null
  const status = o.status
  if (
    status !== 'pending' &&
    status !== 'processing' &&
    status !== 'succeeded' &&
    status !== 'failed'
  ) {
    return null
  }
  const result = Array.isArray(o.result)
    ? (o.result.filter((x): x is string => typeof x === 'string') as string[])
    : undefined
  return {
    id: o.id,
    status,
    model: typeof o.model === 'string' ? o.model : '',
    prompt: typeof o.prompt === 'string' ? o.prompt : '',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    ...(result && result.length > 0 ? { result } : {}),
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  }
}

/** 落盘任务(Redis 优先,失败降级进程内 Map)。 */
async function saveImageTask(task: ImageTask): Promise<void> {
  const key = `${IMG_TASK_PREFIX}${task.id}`
  const value = JSON.stringify(task)
  if (imageTaskRedis) {
    try {
      // ioredis SET key value EX seconds(覆盖写,天然续期 TTL)。
      await imageTaskRedis.set(key, value, 'EX', IMG_TASK_TTL_SECONDS)
      return
    } catch {
      // Redis 不可用 → 降级进程内 Map(注释:单进程内存,重启即丢)。
    }
  }
  inMemoryImageTasks.set(task.id, task)
}

/** 查询任务(Redis 优先,异常/缺失降级进程内 Map)。 */
export async function getImageTask(id: string): Promise<ImageTask | null> {
  const key = `${IMG_TASK_PREFIX}${id}`
  if (imageTaskRedis) {
    try {
      const raw = await imageTaskRedis.get(key)
      const parsed = parseImageTask(raw)
      if (parsed) return parsed
    } catch {
      // Redis 不可用 → 试图从进程内 Map 取。
    }
  }
  return inMemoryImageTasks.get(id) ?? null
}

/**
 * 推进任务为 succeeded(供未来 worker 调用:消费上游生图结果后置)。
 * 保留既有 model/prompt/createdAt;result 为图片 URL/base64 数组。
 * 任务不存在时仍写入一条 succeeded 记录(id + result,model/prompt 留空)。
 */
export async function completeImageTask(id: string, result: string[]): Promise<void> {
  const existing = await getImageTask(id)
  const task: ImageTask = {
    id,
    status: 'succeeded',
    model: existing?.model ?? '',
    prompt: existing?.prompt ?? '',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    result: Array.isArray(result) ? result : [],
  }
  await saveImageTask(task)
}

/**
 * 推进任务为 failed(供未来 worker 调用:上游生图失败 / 超时后置)。
 * 保留既有 model/prompt/createdAt,附 error 原因。
 * 任务不存在时仍写入一条 failed 记录(id + error,model/prompt 留空)。
 */
export async function failImageTask(id: string, errMsg: string): Promise<void> {
  const existing = await getImageTask(id)
  const task: ImageTask = {
    id,
    status: 'failed',
    model: existing?.model ?? '',
    prompt: existing?.prompt ?? '',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    error: typeof errMsg === 'string' ? errMsg : String(errMsg),
  }
  await saveImageTask(task)
}

/**
 * 扫描全部 pending 任务(worker 消费用)。
 * Redis 优先:KEYS imgtask:* 后逐个解析;降级扫进程内 Map。
 */
export async function listPendingImageTasks(): Promise<ImageTask[]> {
  const out: ImageTask[] = []
  if (imageTaskRedis) {
    try {
      const keys = await imageTaskRedis.keys(IMG_TASK_PREFIX + '*')
      for (const k of keys) {
        const raw = await imageTaskRedis.get(k)
        const t = parseImageTask(raw)
        if (t && t.status === 'pending') out.push(t)
      }
      return out
    } catch {
      // 降级到 Map
    }
  }
  for (const t of inMemoryImageTasks.values()) {
    if (t.status === 'pending') out.push(t)
  }
  return out
}

// =============================================================================
// 路由插件
// =============================================================================

const v1MultimodalRoutes: FastifyPluginAsync = async (server) => {
  // 捕获 Redis 客户端供异步图片任务存储使用(为 null 时落到进程内 Map 降级)。
  imageTaskRedis = server.redis
  // ===== 1. GET /audio/voices — 音色列表 =====
  server.get(
    '/audio/voices',
    {
      schema: {
        description: '音色列表',
        tags: ['Multimodal'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    gender: { type: 'string' },
                    language: { type: 'string' },
                    preview: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      return forwardInternal(reply, '/api/ai/audio/voices', { method: 'GET' }, userId, (data) => {
        const d = asObj(data)
        const voices = Array.isArray(d.voices) ? d.voices : []
        const result: V1AudioVoicesResponse = {
          object: 'list',
          data: voices.map((v) => {
            const o = asObj(v)
            return {
              id:
                (typeof o.voice_id === 'string' && o.voice_id) ||
                (typeof o.id === 'string' && o.id) ||
                '',
              name: (typeof o.name === 'string' && o.name) || '',
              gender: (typeof o.gender === 'string' && o.gender) || '',
              language: (typeof o.language === 'string' && o.language) || '',
              preview: typeof o.description === 'string' ? o.description : undefined,
            }
          }),
        }
        return result
      })
    },
  )

  // ===== 2. POST /audio/speech — TTS 语音合成 =====
  server.post(
    '/audio/speech',
    {
      schema: {
        description: 'TTS 语音合成(返回二进制音频流)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            input: { type: 'string' },
            voice: { type: 'string' },
            responseFormat: { type: 'string' },
            speed: { type: 'number' },
          },
          required: ['model', 'input', 'voice'],
        },
        response: {
          200: { type: 'string' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = audioSpeechSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, input, voice, responseFormat, speed } = parsed.data
      // 内部 /api/ai/audio/speech 返回二进制音频流(OpenAI 兼容,透传二进制 body)。
      // 响应 Content-Type 由 forwardInternal 透传(通常为 audio/mpeg);为兼容内部未设置的情况,这里设默认值。
      // V1AudioSpeechResponse 类型(结构化 {audio,format,durationMs})不适用于此端点:OpenAI TTS 即返回二进制音频流,响应体本身就是 audio bytes。
      const body: Record<string, unknown> = {
        model,
        text: input,
        voice_id: voice,
        response_format: responseFormat ?? 'mp3',
      }
      if (speed !== undefined) body.rate = speed
      reply.header('Content-Type', `audio/${responseFormat ?? 'mp3'}`)
      return forwardInternal(reply, '/api/ai/audio/speech', jsonInit(body), userId)
    },
  )

  // ===== 3. POST /audio/transcriptions — ASR 语音识别 =====
  server.post(
    '/audio/transcriptions',
    {
      schema: {
        description: 'ASR 语音识别',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            audio: { type: 'string' },
            language: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['model', 'audio'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              language: { type: 'string' },
              duration: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = audioTranscriptionsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, audio, language } = parsed.data
      const body: Record<string, unknown> = { model, audio_base64: audio }
      if (language) body.language = language
      return forwardInternal(reply, '/api/ai/audio/recognize', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1AudioTranscriptionsResponse = {
          text:
            (typeof d.transcription === 'string' && d.transcription) ||
            (typeof d.text === 'string' && d.text) ||
            '',
          language: (typeof d.language === 'string' && d.language) || language || '',
          duration: typeof d.duration === 'number' ? d.duration : 0,
        }
        return result
      })
    },
  )

  // ===== 4. POST /audio/chat — 语音对话 =====
  server.post(
    '/audio/chat',
    {
      schema: {
        description: '语音对话',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            audio: { type: 'string' },
            model: { type: 'string' },
            sessionId: { type: 'string' },
          },
          required: ['audio', 'model'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              audio: { type: 'string' },
              sessionId: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = audioChatSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { audio, model, sessionId } = parsed.data
      const body: Record<string, unknown> = { audio_base64: audio, model }
      if (sessionId) body.session_id = sessionId
      return forwardInternal(reply, '/api/ai/audio/chat', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1AudioChatResponse = {
          text:
            (typeof d.text === 'string' && d.text) ||
            (typeof d.transcription === 'string' && d.transcription) ||
            (typeof d.reply === 'string' && d.reply) ||
            '',
          audio:
            (typeof d.audio === 'string' && d.audio) ||
            (typeof d.audio_base64 === 'string' && d.audio_base64) ||
            '',
          sessionId:
            (typeof d.session_id === 'string' && d.session_id) ||
            (typeof d.sessionId === 'string' && d.sessionId) ||
            sessionId ||
            '',
        }
        return result
      })
    },
  )

  // ===== 5. GET /audio/speakers — 声纹列表 =====
  server.get(
    '/audio/speakers',
    {
      schema: {
        description: '声纹列表',
        tags: ['Multimodal'],
        response: {
          200: {
            type: 'object',
            properties: {
              object: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    gender: { type: 'string' },
                    language: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      return forwardInternal(reply, '/api/ai/speaker/list', { method: 'GET' }, userId, (data) => {
        const d = asObj(data)
        const voices = Array.isArray(d.voices) ? d.voices : []
        return {
          object: 'list' as const,
          data: voices.map((v) => {
            const o = asObj(v)
            return {
              id:
                (typeof o.voice_id === 'string' && o.voice_id) ||
                (typeof o.id === 'string' && o.id) ||
                '',
              name:
                (typeof o.name === 'string' && o.name) ||
                (typeof o.voice_id === 'string' && o.voice_id) ||
                '',
              gender: (typeof o.gender === 'string' && o.gender) || '',
              language: (typeof o.language === 'string' && o.language) || '',
            }
          }),
        }
      })
    },
  )

  // ===== 6. POST /audio/speakers — 声纹注册 =====
  server.post(
    '/audio/speakers',
    {
      schema: {
        description: '声纹注册',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            audio: { type: 'string' },
          },
          required: ['name', 'audio'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = registerSpeakerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, audio } = parsed.data
      // v1 {name,audio} → 内部 {voice_id:name, audio_base64:audio}
      const body = { voice_id: name, audio_base64: audio }
      return forwardInternal(reply, '/api/ai/speaker/register', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        return {
          id: (typeof d.voice_id === 'string' && d.voice_id) || name,
          name,
          status: (typeof d.status === 'string' && d.status) || 'registered',
        }
      })
    },
  )

  // ===== 7. POST /audio/speakers/compare — 声纹比对 =====
  server.post(
    '/audio/speakers/compare',
    {
      schema: {
        description: '声纹比对',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            speakerId: { type: 'string' },
            audio: { type: 'string' },
          },
          required: ['speakerId', 'audio'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              matched: { type: 'boolean' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = compareSpeakersSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { speakerId, audio } = parsed.data
      const body = { voice_id: speakerId, audio_base64: audio }
      return forwardInternal(reply, '/api/ai/speaker/compare', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1CompareSpeakersResponse = {
          score:
            typeof d.confidence === 'number'
              ? d.confidence
              : typeof d.score === 'number'
                ? d.score
                : 0,
          matched: Boolean(d.matched ?? false),
        }
        return result
      })
    },
  )

  // ===== 8. POST /audio/music — 音乐生成 =====
  server.post(
    '/audio/music',
    {
      schema: {
        description: '音乐生成',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            lyrics: { type: 'string' },
            duration: { type: 'number' },
          },
          required: ['prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('audio:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = musicSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { prompt, lyrics, duration } = parsed.data
      const body: Record<string, unknown> = { prompt }
      if (lyrics) body.lyrics = lyrics
      if (duration !== undefined) body.duration = duration
      return forwardInternal(reply, '/api/ai/suno/generate', jsonInit(body), userId, (data) => {
        const d = asObj(data)
        const result: V1MusicGenerationsResponse = {
          taskId:
            (typeof d.taskId === 'string' && d.taskId) ||
            (typeof d.task_id === 'string' && d.task_id) ||
            '',
          status: (mapJobStatus(d.status) as 'pending' | 'processing' | 'completed') || 'pending',
        }
        return result
      })
    },
  )

  // ===== 9. POST /images/generations — 文生图(按 vendor 路由) =====
  server.post(
    '/images/generations',
    {
      schema: {
        description: '文生图(按 vendor 路由,同步或异步轮询)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            prompt: { type: 'string' },
            n: { type: 'number' },
            size: { type: 'string' },
            quality: { type: 'string' },
            style: { type: 'string' },
            vendor: { type: 'string' },
          },
          required: ['model', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          202: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = imageGenerationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, prompt, n, size, vendor } = parsed.data

      // 0. relay 渠道直连优先(2026-09-13):渠道目录上架的生图模型走 OpenAI 兼容
      //    /images/generations 直连(failover 由 forwarder 内置);fwd=null(目录无此模型)
      //    或直连失败/空产出 → 回落下方 vendor 内部实现,行为与改造前完全一致。
      {
        const relayBody: Record<string, unknown> = { model, prompt }
        if (n !== undefined) relayBody.n = n
        if (size !== undefined) relayBody.size = size
        if (parsed.data.quality !== undefined) relayBody.quality = parsed.data.quality
        if (parsed.data.style !== undefined) relayBody.style = parsed.data.style
        const fwd = await forwardToChannel({
          model,
          endpoint: 'images',
          stream: false,
          bodyOverride: relayBody,
          userId,
          affinityKey: apiKeyOf(request)?.id,
        })
        if (fwd && fwd.ok) {
          const upstream = (await fwd.response.json().catch(() => null)) as {
            data?: unknown[]
          } | null
          const arr = Array.isArray(upstream?.data) ? upstream.data : []
          if (arr.length > 0) {
            chargeMultimodal(request, {
              model,
              callType: 'image',
              units: arr.length,
              prompt,
              channel: fwd.channel,
            })
            return reply.send({
              created: Math.floor(Date.now() / 1000),
              data: arr.map((img) => {
                const o = asObj(img)
                return {
                  url: typeof o.url === 'string' ? o.url : undefined,
                  ...(typeof o.b64_json === 'string' ? { b64_json: o.b64_json } : {}),
                }
              }),
            })
          }
          // 上游 200 但空 data → 视为本次候选产出失败,继续回落内部实现
        }
        // fwd === null(渠道目录无此模型)或 ok:false(候选全败)→ 回落
      }

      const v = (vendor ?? 'tongyi').toLowerCase()
      let path: string
      let body: Record<string, unknown>
      if (v === 'dashscope') {
        path = '/api/ai/dashscope/image'
        body = { prompt, model, size }
      } else if (v === 'doubao') {
        path = '/api/ai/doubao/image'
        body = { prompt, model, size }
      } else if (v === 'gemini') {
        path = '/api/ai/gemini/image'
        body = { prompt, model }
      } else {
        // tongyi(默认)
        path = '/api/ai-image/tongyi/text-to-image'
        body = { prompt, model, n, size }
      }

      // 1. 提交生成任务(可能直接返回 images,也可能返回 taskId)
      const result = await callInternal(path, jsonInit(body), userId)
      if (!result.ok) {
        const httpStatus = result.status >= 400 && result.status < 600 ? result.status : 502
        return reply
          .status(httpStatus as 200 | 202 | 400 | 401 | 500 | 502 | 503)
          .send(error(httpStatus, result.message || `Internal service error (${result.status})`))
      }
      const d = asObj(result.data)

      // 2. 同步路径:已有 images → 直接返回 OpenAI 同步格式 data:[{url}]
      const imagesArray = Array.isArray(d.images) ? d.images : Array.isArray(d.data) ? d.data : null
      if (imagesArray && imagesArray.length > 0) {
        // 按张计费(2026-09-13):成功产出多少张扣多少张
        chargeMultimodal(request, {
          model,
          callType: 'image',
          units: imagesArray.length,
          prompt,
        })
        return reply.send({
          created: Math.floor(Date.now() / 1000),
          data: imagesArray.map((img) => {
            const o = asObj(img)
            return { url: typeof o.url === 'string' ? o.url : undefined }
          }),
        })
      }

      // 3. 异步路径:有 taskId → 30s 内轮询任务状态,完成则返回 OpenAI 同步格式
      const taskId =
        (typeof d.taskId === 'string' && d.taskId) ||
        (typeof d.task_id === 'string' && d.task_id) ||
        ''
      if (!taskId) {
        // 既无 images 也无 taskId → 返回空数据(避免误导客户端)
        return reply.send({ created: Math.floor(Date.now() / 1000), data: [] })
      }
      // 按张计费(2026-09-13):异步任务提交成功即扣(乐观计费防漏损),
      // 任务 failed 由 GET /v1/generation/status/:id 触发全额退款
      chargeMultimodal(request, {
        model,
        callType: 'image',
        units: n ?? 1,
        prompt,
        taskId,
      })
      const polled = await pollInternalJob(taskId, userId, 30_000)
      if (polled.completed && polled.result) {
        const r = asObj(polled.result)
        const urls: unknown[] = Array.isArray(r.images)
          ? r.images
          : Array.isArray(r.urls)
            ? r.urls
            : Array.isArray(r.data)
              ? r.data
              : Array.isArray(r)
                ? r
                : []
        return reply.send({
          created: Math.floor(Date.now() / 1000),
          data: urls.map((img) => {
            const o = asObj(img)
            return {
              url: typeof o.url === 'string' ? o.url : typeof o === 'string' ? o : undefined,
            }
          }),
        })
      }

      // 4. 30s 未完成 → 202 Accepted + 建议轮询 GET /v1/generation/status/:id
      return reply.status(202).send({
        taskId,
        status: 'processing',
        message: `Image generation in progress. Poll GET /v1/generation/status/${encodeURIComponent(taskId)} for final result.`,
      })
    },
  )

  // ===== 10. POST /images/edits — 图片编辑(按 vendor 路由) =====
  server.post(
    '/images/edits',
    {
      schema: {
        description: '图片编辑(按 vendor 路由)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            image: { type: 'string' },
            prompt: { type: 'string' },
            mask: { type: 'string' },
            n: { type: 'number' },
            size: { type: 'string' },
            vendor: { type: 'string' },
          },
          required: ['model', 'image', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = imageEditsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, image, prompt, mask, n, size, vendor } = parsed.data
      const v = (vendor ?? 'doubao').toLowerCase()
      const path = v === 'tongyi' ? '/api/ai-image/tongyi/edit' : '/api/ai-image/doubao/edit'
      const body: Record<string, unknown> = { model, image, prompt }
      if (mask) body.mask = mask
      if (n !== undefined) body.n = n
      if (size) body.size = size
      return forwardInternal(reply, path, jsonInit(body), userId)
    },
  )

  // ===== 11. POST /images/inpaint — 图片修复 =====
  server.post(
    '/images/inpaint',
    {
      schema: {
        description: '图片修复',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            image: { type: 'string' },
            mask: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['model', 'image', 'mask', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = imageInpaintSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, image, mask, prompt } = parsed.data
      return forwardInternal(
        reply,
        '/api/ai-image/doubao/inpaint',
        jsonInit({ model, image, mask, prompt }),
        userId,
      )
    },
  )

  // ===== 12. POST /images/style-transfer — 风格迁移 =====
  server.post(
    '/images/style-transfer',
    {
      schema: {
        description: '风格迁移',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            image: { type: 'string' },
            style: { type: 'string' },
          },
          required: ['model', 'image', 'style'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = styleTransferSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, image, style } = parsed.data
      return forwardInternal(
        reply,
        '/api/ai-image/tongyi/style-transfer',
        jsonInit({ model, image, style }),
        userId,
      )
    },
  )

  // ===== 13. POST /images/virtual-try-on — 虚拟试穿 =====
  server.post(
    '/images/virtual-try-on',
    {
      schema: {
        description: '虚拟试穿',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            personImage: { type: 'string' },
            garmentImage: { type: 'string' },
          },
          required: ['model', 'personImage', 'garmentImage'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = virtualTryOnSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, personImage, garmentImage } = parsed.data
      return forwardInternal(
        reply,
        '/api/ai-image/tongyi/virtual-try-on',
        jsonInit({ model, person_image: personImage, garment_image: garmentImage }),
        userId,
      )
    },
  )

  // ===== 14. POST /images/background — 背景生成 =====
  server.post(
    '/images/background',
    {
      schema: {
        description: '背景生成',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            foreground: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['model', 'foreground', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              created: { type: 'number' },
              data: { type: 'array' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = backgroundSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, foreground, prompt } = parsed.data
      return forwardInternal(
        reply,
        '/api/ai-image/tongyi/background-generation',
        jsonInit({ model, foreground, prompt }),
        userId,
      )
    },
  )

  // ===== 15. POST /videos/generations — 视频生成(按 vendor 路由) =====
  server.post(
    '/videos/generations',
    {
      schema: {
        description: '视频生成(按 vendor 路由,异步返回 taskId)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            prompt: { type: 'string' },
            image: { type: 'string' },
            duration: { type: 'number' },
            resolution: { type: 'string' },
            vendor: { type: 'string' },
          },
          required: ['model', 'prompt'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('videos:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = videoGenerationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, prompt, image, duration, vendor } = parsed.data
      const v = (vendor ?? 'sora2').toLowerCase()
      let path: string
      const body: Record<string, unknown> = { prompt, model }
      if (image) body.image = image
      if (duration) body.duration = duration
      if (v === 'dashscope') path = '/api/ai/dashscope/video'
      else if (v === 'doubao') path = '/api/ai/doubao/video'
      else if (v === 'gemini') path = '/api/ai/gemini/video'
      else path = '/api/ai/sora2/generate'
      // 视频计费(2026-09-13):提交成功即按次/按秒扣费(乐观计费防漏损),
      // 任务 failed 由 GET /v1/videos/tasks/:id 触发全额退款。
      // taskId 由 mapper 闭包捕获(forwardInternal 仅在提交成功时调用 mapper)。
      let submittedTaskId = ''
      const replyResult = await forwardInternal(reply, path, jsonInit(body), userId, (data) => {
        const d = asObj(data)
        submittedTaskId =
          (typeof d.taskId === 'string' && d.taskId) ||
          (typeof d.task_id === 'string' && d.task_id) ||
          ''
        const result: V1VideoGenerationsResponse = {
          taskId: submittedTaskId,
          status:
            (mapJobStatus(d.status) as 'pending' | 'processing' | 'completed' | 'failed') ||
            'pending',
        }
        return result
      })
      if (submittedTaskId) {
        chargeMultimodal(request, {
          model,
          callType: 'video',
          // videoUnit='second' 时按秒计价(units=duration);='call' 时按次(单位数恒 1,
          // calculateCost 内部对 per_video+call 会忽略 units,这里传 duration 无副作用)
          units: duration && duration > 0 ? duration : 1,
          prompt,
          taskId: submittedTaskId,
        })
      }
      return replyResult
    },
  )

  // ===== 16. GET /videos/tasks/:id — 视频任务查询(sora2→jimeng4 回退) =====
  server.get(
    '/videos/tasks/:id',
    {
      schema: {
        description: '视频任务查询(sora2→jimeng4 回退)',
        tags: ['Multimodal'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
              videoUrl: { type: 'string' },
              progress: { type: 'number' },
              error: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('videos:read'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      const tryMap = (data: unknown): V1VideoTaskResponse => {
        const d = asObj(data)
        const result = asObj(d.result ?? d)
        return {
          taskId:
            (typeof d.taskId === 'string' && d.taskId) ||
            (typeof d.task_id === 'string' && d.task_id) ||
            id,
          status:
            (mapJobStatus(d.status ?? result.status) as
              'pending' | 'processing' | 'completed' | 'failed') || 'pending',
          ...(typeof result.video_url === 'string' || typeof result.videoUrl === 'string'
            ? { videoUrl: (result.video_url as string) || (result.videoUrl as string) }
            : {}),
          ...(typeof d.progress === 'number' ? { progress: d.progress } : {}),
          ...(typeof result.error === 'string' ? { error: result.error } : {}),
          createdAt:
            (typeof d.createdAt === 'string' && d.createdAt) ||
            (typeof d.created_at === 'string' && d.created_at) ||
            new Date().toISOString(),
        }
      }
      try {
        const sora2 = await callInternal(
          `/api/ai/sora2/tasks/${encodeURIComponent(id)}`,
          { method: 'GET' },
          userId,
        )
        if (sora2.ok) {
          const mapped = tryMap(sora2.data)
          // 视频任务失败退款(2026-09-13):提交时已乐观扣费,失败全额退(幂等)
          if (mapped.status === 'failed') void refundTaskCall(id)
          return reply.send(mapped)
        }
        // sora2 404 → 回退 jimeng4
        if (sora2.status !== 404) {
          const httpStatus = sora2.status >= 400 && sora2.status < 600 ? sora2.status : 502
          return reply
            .status(httpStatus as 200 | 400 | 401 | 404 | 500 | 502 | 503)
            .send(error(httpStatus, sora2.message || `Internal service error (${sora2.status})`))
        }
        const jimeng4 = await callInternal(
          `/api/ai/jimeng4/video/tasks/${encodeURIComponent(id)}`,
          { method: 'GET' },
          userId,
        )
        if (jimeng4.ok) {
          const mapped = tryMap(jimeng4.data)
          // 视频任务失败退款(2026-09-13):同上,幂等
          if (mapped.status === 'failed') void refundTaskCall(id)
          return reply.send(mapped)
        }
        const httpStatus = jimeng4.status >= 400 && jimeng4.status < 600 ? jimeng4.status : 502
        if (jimeng4.status === 404) {
          return reply.status(404).send(error(404, `Video task not found: ${id}`))
        }
        return reply
          .status(httpStatus as 200 | 400 | 401 | 404 | 500 | 502 | 503)
          .send(error(httpStatus, jimeng4.message || `Internal service error (${jimeng4.status})`))
      } catch (e) {
        return reply
          .status(503)
          .send(error(503, (e as Error).message || 'Internal service unavailable'))
      }
    },
  )

  // ===== 17. POST /videos/compose — 视频编排 =====
  server.post(
    '/videos/compose',
    {
      schema: {
        description: '视频编排(多场景 + BGM)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            scenes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  duration: { type: 'number' },
                  imagePrompt: { type: 'string' },
                },
                required: ['text'],
              },
            },
            bgmUrl: { type: 'string' },
          },
          required: ['scenes'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              composeId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('videos:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = videoComposeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { scenes, bgmUrl } = parsed.data
      // 内部 /api/ai-video-compose 仅接受 {prompt,model} 作为生成参数。
      // scenes 折叠为 prompt 主文本(向后兼容),但保留结构化分镜 + bgmUrl 在 metadata 字段(供下游消费,不丢失信息)。
      const prompt = scenes.map((s) => s.text).join('\n')
      const metadata: Record<string, unknown> = { scenes }
      if (bgmUrl) metadata.bgmUrl = bgmUrl
      return forwardInternal(
        reply,
        '/api/ai-video-compose',
        jsonInit({ prompt, metadata }),
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1VideoComposeResponse = {
            composeId:
              (typeof d.id === 'string' && d.id) ||
              (typeof d.composeId === 'string' && d.composeId) ||
              '',
            status:
              d.status === 'succeeded'
                ? 'completed'
                : (mapJobStatus(d.status) as 'processing' | 'completed' | 'failed') || 'processing',
          }
          return result
        },
      )
    },
  )

  // ===== 18. POST /3d/generations — 3D 模型生成 =====
  server.post(
    '/3d/generations',
    {
      schema: {
        description: '3D 模型生成(腾讯混元 3D)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            input: { type: 'string' },
            format: { type: 'string' },
          },
          required: ['model', 'input'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('threed:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = threeDGenerationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, input, format } = parsed.data
      // v1 {model,input,format} → 内部 {user_uuid, Prompt, ResultFormat}
      const body: Record<string, unknown> = {
        user_uuid: userId,
        Prompt: input,
      }
      if (format) body.ResultFormat = format
      // model 暂透传(腾讯混元 3D 仅一种模型)
      body.model = model
      return forwardInternal(
        reply,
        '/api/tencent/hunyuan3d/submit',
        jsonInit(body),
        userId,
        (data) => {
          const d = asObj(data)
          const inner = asObj(d.data ?? data)
          const result: V1ThreeDGenerationsResponse = {
            taskId:
              (typeof inner.JobId === 'string' && inner.JobId) ||
              (typeof d.taskId === 'string' && d.taskId) ||
              '',
            status:
              (mapJobStatus(inner.Status ?? d.status) as 'pending' | 'processing' | 'completed') ||
              'pending',
          }
          return result
        },
      )
    },
  )

  // ===== 19. POST /generation/enqueue — 生成队列入队 =====
  server.post(
    '/generation/enqueue',
    {
      schema: {
        description: '生成队列入队',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            payload: { type: 'object' },
            priority: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          required: ['type', 'payload'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
              position: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('generation:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = generationEnqueueSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { type, payload, priority } = parsed.data
      // v1 {type,payload,priority} → 内部 /api/ai/generation/enqueue {type,data,priority,dedupeWindowMs}
      const body: Record<string, unknown> = { type, data: payload }
      if (priority !== undefined) body.priority = priority
      return forwardInternal(
        reply,
        '/api/ai/generation/enqueue',
        jsonInit(body),
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1GenerationEnqueueResponse = {
            jobId:
              (typeof d.jobId === 'string' && d.jobId) ||
              (typeof d.job_id === 'string' && d.job_id) ||
              '',
            status: 'queued',
            position: typeof d.position === 'number' ? d.position : 0,
          }
          return result
        },
      )
    },
  )

  // ===== 20. GET /generation/status/:id — 生成队列状态 =====
  server.get(
    '/generation/status/:id',
    {
      schema: {
        description: '生成队列状态查询',
        tags: ['Multimodal'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
              result: {},
              error: { type: 'string' },
              progress: { type: 'number' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('generation:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      const statusResult = await forwardInternal(
        reply,
        `/api/ai/generation/${encodeURIComponent(id)}/status`,
        { method: 'GET' },
        userId,
        (data) => {
          const d = asObj(data)
          const result: V1GenerationStatusResponse = {
            jobId:
              (typeof d.jobId === 'string' && d.jobId) || (typeof d.id === 'string' && d.id) || id,
            status: mapJobStatus(d.status),
            ...(d.returnvalue !== undefined || d.result !== undefined
              ? { result: d.returnvalue ?? d.result }
              : {}),
            ...(typeof d.failedReason === 'string' ? { error: d.failedReason } : {}),
            ...(typeof d.progress === 'number' ? { progress: d.progress } : {}),
          }
          // 多模态任务失败退款(2026-09-13):提交时已乐观扣费,失败全额退(幂等)。
          // 覆盖生图异步任务(202 轮询此端点);视频另有 videos/tasks 退款入口。
          if (result.status === 'failed') void refundTaskCall(id)
          return result
        },
      )
      return statusResult
    },
  )

  // ===== 21. POST /generation/cancel/:id — 生成队列取消 =====
  server.post(
    '/generation/cancel/:id',
    {
      schema: {
        description: '生成队列取消',
        tags: ['Multimodal'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('generation:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      // 内部取消路由为 DELETE /api/ai/generation/:jobId
      return forwardInternal(
        reply,
        `/api/ai/generation/${encodeURIComponent(id)}`,
        jsonInit({}, 'DELETE'),
        userId,
        (data) => {
          const d = asObj(data)
          return {
            jobId: (typeof d.jobId === 'string' && d.jobId) || id,
            status: 'cancelled' as const,
          }
        },
      )
    },
  )

  // ===== 22. POST /images/generations/async — 异步文生图(任务编排骨架) =====
  server.post(
    '/images/generations/async',
    {
      schema: {
        description: '异步文生图(创建任务,返回 202 + task id,供轮询)',
        tags: ['Multimodal'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            prompt: { type: 'string' },
            n: { type: 'number' },
            size: { type: 'string' },
          },
          required: ['model', 'prompt'],
        },
        response: {
          202: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const parsed = imageAsyncGenerationsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, prompt } = parsed.data
      // 计费不在本任务范围:OpenAI 异步图片的计费随既有同步链路 /images/generations 走。
      // 这里只落地任务编排骨架,先置 pending(乐观计费 / failed 退款由同步链路负责)。
      // n / size 已在 zod 中校验并接收,本骨架暂不持久化(预留给未来 worker 透传上游)。
      const task: ImageTask = {
        id: crypto.randomUUID(),
        status: 'pending',
        model,
        prompt,
        // 补强 60:记录发起用户,worker 消费时通过 forwardToChannel 传给选路/计费
        userId,
        createdAt: new Date().toISOString(),
      }
      await saveImageTask(task)
      // 扩展点:未来由 worker 消费上游生图(既有同步端点 / 调用方体系)后,
      // 调用 completeImageTask(id, result) / failImageTask(id, error) 推进状态。
      // 本端点内部不自动推进。
      return reply.status(202).send({ id: task.id, status: task.status })
    },
  )

  // ===== 23. GET /images/generations/async/:id — 异步任务状态查询 =====
  server.get(
    '/images/generations/async/:id',
    {
      schema: {
        description: '异步文生图任务状态查询(轮询)',
        tags: ['Multimodal'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              model: { type: 'string' },
              prompt: { type: 'string' },
              createdAt: { type: 'string' },
              result: { type: 'array', items: { type: 'string' } },
              error: { type: 'string' },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [
        requireApiKeyAuth,
        requireApiKeyPermission('images:write'),
        requireApiKeyQuota(),
      ],
    },
    async (request, reply) => {
      const userId = getUserId(request, reply)
      if (!userId) return
      const { id } = request.params as { id: string }
      const task = await getImageTask(id)
      if (!task) {
        return reply.status(404).send(error(404, `Image generation task not found: ${id}`))
      }
      // 直接返回任务记录(状态 pending/processing/succeeded/failed);
      // 不在本端点推进状态(result 仅 succeeded 时存在,error 仅 failed 时存在)。
      return reply.send({
        id: task.id,
        status: task.status,
        model: task.model,
        prompt: task.prompt,
        createdAt: task.createdAt,
        ...(Array.isArray(task.result) ? { result: task.result } : {}),
        ...(typeof task.error === 'string' ? { error: task.error } : {}),
      })
    },
  )
}

export default v1MultimodalRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
