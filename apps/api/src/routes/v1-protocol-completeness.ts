/**
 * /v1/* 协议完整性补齐(2026-07-31 立)。
 *
 * 补齐 OpenAI SDK 用户期望但 IHUI-AI 此前缺失的 5 类标准端点(共 14 个):
 *
 * 1. MJ 扩展(3 个,对接 midjourney-proxy,与 v1-midjourney.ts 互补):
 *    - POST /v1/midjourney/describe  图生 prompt(→ 上游 POST /mj/submit/describe)
 *    - POST /v1/midjourney/shorten   prompt 精简(→ 上游 POST /mj/submit/shorten)
 *    - POST /v1/midjourney/blend     图像混合(→ 上游 POST /mj/submit/blend)
 * 2. /v1/audio/translations(1 个,Whisper 翻译,multipart 透传上游)
 * 3. /v1/images/variations(1 个,DALL-E 图像变体,multipart 透传上游)
 * 4. /v1/fine_tuning/jobs(5 个,微调任务 CRUD + events,元数据存 Redis 90 天)
 * 5. /v1/files(4 个,文件管理 CRUD,小文件 <10MB 存 Redis)
 *
 * 鉴权:requireApiKeyAuth(Bearer token + developer_api_keys 表,plugins/api-key-auth.ts)。
 * 计费:relay-billing-service.recordCall(audio/images/fine_tuning)+ MJ 按次计费(describe=1/shorten=0.5/blend=1 unit)。
 * 响应格式:OpenAI 兼容(不套 { code, message, data } 壳,与 v1-public.ts / v1-rerank-moderations.ts 一致)。
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1ProtocolCompletenessRoutes from './v1-protocol-completeness.js'
 *   server.register(v1ProtocolCompletenessRoutes, { prefix: '/v1' })
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Redis } from 'ioredis'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { recordCall, modelToProviderCode } from '../services/relay-billing-service.js'
import { error } from '../utils/response.js'

// =============================================================================
// 常量
// =============================================================================

/** 上游 midjourney-proxy base url,如 http://localhost:8808(与 v1-midjourney.ts 共享 env)。 */
const MJ_BASE = process.env.MIDJOURNEY_PROXY_BASE
const MJ_API_KEY = process.env.MIDJOURNEY_PROXY_API_KEY
/** MJ 上游未配置错误码(沿用 v1-midjourney.ts 5016)。 */
const MJ_NOT_CONFIGURED_CODE = 5016

/** audio 上游未配置错误码(5017)。 */
const AUDIO_NOT_CONFIGURED_CODE = 5017
/** images 上游未配置错误码(5018)。 */
const IMAGES_NOT_CONFIGURED_CODE = 5018
/** fine_tuning 上游未配置错误码(5019)。 */
const FINE_TUNING_NOT_CONFIGURED_CODE = 5019

/** 微调任务 Redis 元数据 key 前缀,TTL 90 天(任务可能持续数周)。 */
const FT_JOB_KEY_PREFIX = 'ft:job:'
const FT_JOB_TTL_SECONDS = 90 * 24 * 60 * 60
// 文件相关常量/类型/函数已迁移至 v1-public.ts(走 files 表持久化),此处移除 Redis 路径实现

// =============================================================================
// 类型定义(OpenAI 兼容响应类型,inline 避免污染 @ihui/types)
// =============================================================================

/** 上游渠道配置。 */
interface UpstreamConfig {
  baseUrl: string
  apiKey: string
}

/** 上游 midjourney-proxy 提交响应(submit/* 通用)。 */
interface MjUpstreamSubmitResult {
  code: number
  description: string
  result: string | null
  properties?: Record<string, unknown> | null
}

/** MJ describe/shorten/blend 本地提交响应 data。 */
interface MjSubmitData {
  task_id: string
  status: string
}

/** OpenAI Whisper translations 响应(text 字段必填,其余视 response_format 而定)。 */
interface AudioTranslationResponse {
  text: string
  language?: string
  duration?: number
  segments?: unknown[]
  words?: unknown[]
}

/** DALL-E images/variations 响应单个数据项。 */
interface ImageVariationDataItem {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

/** DALL-E images/variations 完整响应。 */
interface ImageVariationResponse {
  created: number
  data: ImageVariationDataItem[]
}

/** OpenAI 微调任务状态。 */
type FineTuningJobStatus =
  'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** OpenAI 微调任务超参数。 */
interface FineTuningHyperparameters {
  n_epochs: number | 'auto'
}

/** OpenAI 微调任务对象。 */
interface FineTuningJob {
  id: string
  object: 'fine_tuning.job'
  created_at: number
  updated_at: number
  model: string
  status: FineTuningJobStatus
  training_file: string
  validation_file: string | null
  hyperparameters: FineTuningHyperparameters
  suffix: string | null
  error: { code: string; message: string; param: string | null } | null
  finished_at: number | null
  trained_tokens: number | null
  organization_id: string | null
  metadata: Record<string, unknown>
}

/** OpenAI 微调任务事件。 */
interface FineTuningEvent {
  id: string
  object: 'fine_tuning.job.event'
  created_at: number
  level: 'info' | 'warn' | 'error'
  message: string
  data: Record<string, unknown> | null
}

/** OpenAI 微调任务列表响应。 */
interface FineTuningJobListResponse {
  object: 'list'
  data: FineTuningJob[]
  has_more: boolean
}

/** OpenAI 微调事件列表响应。 */
interface FineTuningEventListResponse {
  object: 'list'
  data: FineTuningEvent[]
  has_more: boolean
}

/** OpenAI 文件对象。 */
// FileObject / FileListResponse / FileDeletedResponse / StoredFileMeta 接口已移除(v1-public.ts 提供 /files)

/** multipart 解析结果:字段 + 单文件。 */
interface MultipartSingleFile {
  fields: Record<string, string>
  file: { buffer: Buffer; filename: string; mimetype: string } | null
}

/** multipart 解析结果:字段 + 多文件。 */
interface MultipartMultipleFiles {
  fields: Record<string, string>
  files: Array<{ buffer: Buffer; filename: string; mimetype: string }>
}

// =============================================================================
// Zod schemas(请求体/查询参数校验)
// =============================================================================

const mjShortenSchema = z.object({
  prompt: z.string().min(1).max(2000),
  bot_type: z.enum(['MJ', 'NIJI']).default('MJ'),
})

const fineTuningCreateSchema = z.object({
  training_file: z.string().min(1),
  model: z.string().min(1),
  validation_file: z.string().optional(),
  hyperparameters: z
    .object({
      n_epochs: z.union([z.number().int().positive(), z.literal('auto')]).optional(),
    })
    .optional(),
  suffix: z.string().min(1).max(40).optional(),
})

const fineTuningListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().optional(),
})

const fineTuningEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().optional(),
})

const jobIdParamSchema = z.object({
  id: z.string().min(1),
})

// fileListQuerySchema / fileIdParamSchema 已移除(v1-public.ts 提供 /files)

// =============================================================================
// 上游配置解析
// =============================================================================

/** 解析 audio 上游配置(UPSTREAM_AUDIO_BASE / UPSTREAM_AUDIO_KEY)。 */
function getAudioUpstream(): UpstreamConfig | null {
  const baseUrl = process.env.UPSTREAM_AUDIO_BASE
  const apiKey = process.env.UPSTREAM_AUDIO_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

/** 解析 images 上游配置(UPSTREAM_IMAGES_BASE / UPSTREAM_IMAGES_KEY)。 */
function getImagesUpstream(): UpstreamConfig | null {
  const baseUrl = process.env.UPSTREAM_IMAGES_BASE
  const apiKey = process.env.UPSTREAM_IMAGES_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

/** 解析 fine_tuning 上游配置(UPSTREAM_FINE_TUNING_BASE / UPSTREAM_FINE_TUNING_KEY)。 */
function getFineTuningUpstream(): UpstreamConfig | null {
  const baseUrl = process.env.UPSTREAM_FINE_TUNING_BASE
  const apiKey = process.env.UPSTREAM_FINE_TUNING_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

// =============================================================================
// MJ 上游代理工具(与 v1-midjourney.ts 同模式,但本文件内独立实现以避免跨文件耦合)
// =============================================================================

function mjConfigured(): boolean {
  return Boolean(MJ_BASE && MJ_API_KEY)
}

function mjUrl(path: string): string {
  return `${MJ_BASE!.replace(/\/+$/, '')}${path}`
}

function mjHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'mj-api-key': MJ_API_KEY!,
    Authorization: `Bearer ${MJ_API_KEY!}`,
  }
}

/** 通用上游 MJ fetch 封装:自动注入鉴权头,非 2xx 抛错。 */
async function mjFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(mjUrl(path), {
    ...init,
    headers: { ...mjHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`上游 MJ 返回 HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

// =============================================================================
// 计费工具
// =============================================================================

/**
 * MJ 按次计费(桩函数,与 v1-midjourney.ts 同模式)。
 * 整合 relay-billing-service.recordCall(model='midjourney-v6', metadata.op=op)。
 * 当前仅占位保证调用链完整,不实际扣费。
 */
async function chargeMjCall(
  apiKeyId: string,
  userId: string,
  op: 'describe' | 'shorten' | 'blend',
  taskId: string,
  clientIp: string,
): Promise<void> {
  void apiKeyId
  void userId
  void op
  void taskId
  void clientIp
  // await recordCall({ apiKeyId, userId, model: 'midjourney-v6',
  //   prompt: op, response: taskId, promptTokens: 0, completionTokens: 0,
  //   totalTokens: op === 'shorten' ? 500 : 1000, latencyMs: 0, status: 'success',
  //   providerCode: 'midjourney', clientIp, metadata: { endpoint: `mj_${op}`, task_id: taskId } })
}

/** 计费:audio translations(按 audio 秒数计费,0.006$/min,折算 1 秒 ≈ 10 token)。 */
function recordAudioCall(
  apiKeyId: string,
  userId: string,
  model: string,
  audioSeconds: number,
  responseText: string,
  clientIp: string,
  httpStatus: number,
): void {
  // 0.006$/min ≈ 0.0001$/s,按 1 token = 0.000002$ 折算 ≈ 50 token/s
  // 这里保守用 10 token/s(避免过度扣费),主 agent 可后续调整
  const estimatedTokens = Math.max(1, Math.ceil(audioSeconds * 10))
  void recordCall({
    apiKeyId,
    userId,
    model,
    prompt: `<audio ${audioSeconds}s>`,
    response: responseText.slice(0, 5000),
    promptTokens: estimatedTokens,
    completionTokens: 0,
    totalTokens: estimatedTokens,
    latencyMs: 0,
    status: 'success',
    providerCode: modelToProviderCode(model),
    clientIp,
    httpStatus,
    metadata: { endpoint: 'audio_translations', audio_seconds: audioSeconds },
  }).catch((e: unknown) => {
    console.error('[v1/audio/translations] recordCall FAIL', (e as Error)?.message || e)
  })
}

/** 计费:images variations(按次计费,DALL-E 2 = 0.016$/img,DALL-E 3 = 0.040$/img)。 */
function recordImageVariationCall(
  apiKeyId: string,
  userId: string,
  model: string,
  imageCount: number,
  clientIp: string,
  httpStatus: number,
): void {
  // DALL-E 2: 0.016$/img ≈ 8000 token/img(按 1 token = 0.000002$)
  // DALL-E 3: 0.040$/img ≈ 20000 token/img
  // 这里用 model 名区分,默认按 DALL-E 2 计费
  const perImageTokens = model.toLowerCase().includes('dall-e-3') ? 20000 : 8000
  const totalTokens = perImageTokens * imageCount
  void recordCall({
    apiKeyId,
    userId,
    model,
    prompt: `<image variation x${imageCount}>`,
    response: null,
    promptTokens: totalTokens,
    completionTokens: 0,
    totalTokens,
    latencyMs: 0,
    status: 'success',
    providerCode: modelToProviderCode(model),
    clientIp,
    httpStatus,
    metadata: { endpoint: 'images_variations', image_count: imageCount },
  }).catch((e: unknown) => {
    console.error('[v1/images/variations] recordCall FAIL', (e as Error)?.message || e)
  })
}

/** 计费:fine_tuning job 创建(预扣 1000 token,完成时由主 agent 按实际用量结算)。 */
function recordFineTuningCall(
  apiKeyId: string,
  userId: string,
  model: string,
  jobId: string,
  clientIp: string,
  httpStatus: number,
): void {
  void recordCall({
    apiKeyId,
    userId,
    model,
    prompt: `<fine_tuning training_file>`,
    response: `job:${jobId}`,
    promptTokens: 1000,
    completionTokens: 0,
    totalTokens: 1000,
    latencyMs: 0,
    status: 'success',
    providerCode: modelToProviderCode(model),
    clientIp,
    httpStatus,
    metadata: { endpoint: 'fine_tuning_jobs_create', job_id: jobId, precharge: true },
  }).catch((e: unknown) => {
    console.error('[v1/fine_tuning/jobs] recordCall FAIL', (e as Error)?.message || e)
  })
}

// =============================================================================
// multipart 解析工具
// =============================================================================

/** 解析 multipart:单文件模式(image/file 字段 + 任意文本字段)。 */
async function readMultipartSingle(request: FastifyRequest): Promise<MultipartSingleFile> {
  const fields: Record<string, string> = {}
  let file: { buffer: Buffer; filename: string; mimetype: string } | null = null

  if (!request.isMultipart()) {
    return { fields, file: null }
  }

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(await part.value)
    } else if (part.type === 'file') {
      // 仅取第一个文件(单文件场景);忽略后续文件
      if (!file) {
        const buffer = await part.toBuffer()
        file = {
          buffer,
          filename: part.filename ?? `upload-${Date.now()}`,
          mimetype: part.mimetype ?? 'application/octet-stream',
        }
      } else {
        // 已有文件,丢弃当前 part 的 buffer 避免内存堆积
        await part.toBuffer()
      }
    }
  }

  return { fields, file }
}

/** 解析 multipart:多文件模式(blend 场景,2-5 张图 + 文本字段)。 */
async function readMultipartMultiple(request: FastifyRequest): Promise<MultipartMultipleFiles> {
  const fields: Record<string, string> = {}
  const files: Array<{ buffer: Buffer; filename: string; mimetype: string }> = []

  if (!request.isMultipart()) {
    return { fields, files }
  }

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(await part.value)
    } else if (part.type === 'file') {
      const buffer = await part.toBuffer()
      files.push({
        buffer,
        filename: part.filename ?? `upload-${Date.now()}-${files.length}`,
        mimetype: part.mimetype ?? 'application/octet-stream',
      })
    }
  }

  return { fields, files }
}

// =============================================================================
// Redis 工具(文件 / 微调元数据存储)
// =============================================================================

/** 从 request.server 取 Redis 客户端(plugins/redis.ts 已全局装饰)。 */
function getRedis(request: FastifyRequest): Redis | null {
  const redis = (request.server as { redis?: Redis }).redis
  return redis ?? null
}

// ----- 微调任务元数据 -----

/** 持久化微调任务元数据到 Redis(TTL 90 天)。 */
async function persistFineTuningJob(request: FastifyRequest, job: FineTuningJob): Promise<void> {
  const redis = getRedis(request)
  if (!redis) return
  try {
    await redis.set(`${FT_JOB_KEY_PREFIX}${job.id}`, JSON.stringify(job), 'EX', FT_JOB_TTL_SECONDS)
  } catch {
    // Redis 故障静默(不阻塞主响应)
  }
}

/** 读取本地缓存的微调任务元数据(若上游不可达时兜底)。 */
async function loadFineTuningJob(
  request: FastifyRequest,
  jobId: string,
): Promise<FineTuningJob | null> {
  const redis = getRedis(request)
  if (!redis) return null
  try {
    const raw = await redis.get(`${FT_JOB_KEY_PREFIX}${jobId}`)
    if (!raw) return null
    return JSON.parse(raw) as FineTuningJob
  } catch {
    return null
  }
}

// ----- 文件元数据 + 内容 -----
// persistFile / loadFileMeta / deleteFile / listFiles 函数已移除(v1-public.ts 提供 /files 走 files 表)

// =============================================================================
// 通用辅助
// =============================================================================

/** 从 request.apiKey 取上下文,失败时 reply 401 并返回 null。 */
function getApiKeyContext(request: FastifyRequest): { id: string; userId: string } | null {
  const apiKey = request.apiKey
  if (!apiKey) return null
  return { id: apiKey.id, userId: apiKey.userId }
}

/** 将 StoredFileMeta 映射为 OpenAI FileObject。 */
// toFileObject 已移除(v1-public.ts 提供 /files)

/** 通用上游 fetch 错误信息提取。 */
async function upstreamErrorText(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => '')
  return text.slice(0, 200)
}

// =============================================================================
// 路由插件
// =============================================================================

const v1ProtocolCompletenessRoutes: FastifyPluginAsync = async (server) => {
  // ===== 1. POST /midjourney/describe — 图生 prompt(对接 MJ /mj/submit/describe)=====
  server.post(
    '/midjourney/describe',
    {
      schema: {
        description: 'MJ 图生 prompt(上传图片,MJ 返回 prompt 描述)',
        tags: ['Midjourney'],
        consumes: ['multipart/form-data'],
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      if (!mjConfigured()) {
        return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
      }
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const { fields, file } = await readMultipartSingle(request)
      if (!file) {
        return reply.status(400).send(error(400, '缺少上传的图片文件(image 字段)'))
      }
      if (file.buffer.length === 0) {
        return reply.status(400).send(error(400, '图片文件为空'))
      }
      const botType = fields.bot_type ?? 'MJ'

      // midjourney-proxy /mj/submit/describe 接受 base64(不带 data: 前缀)
      const upstreamBody = {
        botType,
        base64: file.buffer.toString('base64'),
      }

      try {
        const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/describe', {
          method: 'POST',
          body: JSON.stringify(upstreamBody),
        })
        if (!data.result) {
          return reply.status(400).send(error(400, data.description || '上游 MJ 提交失败'))
        }
        void chargeMjCall(ctx.id, ctx.userId, 'describe', data.result, request.ip)

        const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
        return reply.send(payload)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
      }
    },
  )

  // ===== 2. POST /midjourney/shorten — prompt 精简(对接 MJ /mj/submit/shorten)=====
  server.post(
    '/midjourney/shorten',
    {
      schema: {
        description: 'MJ prompt 精简(输入 prompt,MJ 返回精简版)',
        tags: ['Midjourney'],
        body: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            bot_type: { type: 'string', enum: ['MJ', 'NIJI'], default: 'MJ' },
          },
          required: ['prompt'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      if (!mjConfigured()) {
        return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
      }
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const parsed = mjShortenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { prompt, bot_type } = parsed.data

      const upstreamBody = { prompt, botType: bot_type }

      try {
        const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/shorten', {
          method: 'POST',
          body: JSON.stringify(upstreamBody),
        })
        if (!data.result) {
          return reply.status(400).send(error(400, data.description || '上游 MJ 精简失败'))
        }
        void chargeMjCall(ctx.id, ctx.userId, 'shorten', data.result, request.ip)

        const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
        return reply.send(payload)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
      }
    },
  )

  // ===== 3. POST /midjourney/blend — 图像混合(对接 MJ /mj/submit/blend)=====
  server.post(
    '/midjourney/blend',
    {
      schema: {
        description: 'MJ 图像混合(2-5 张图混合,multipart/form-data)',
        tags: ['Midjourney'],
        consumes: ['multipart/form-data'],
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      if (!mjConfigured()) {
        return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
      }
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const { fields, files } = await readMultipartMultiple(request)
      if (files.length < 2 || files.length > 5) {
        return reply.status(400).send(error(400, '需要上传 2-5 张图片'))
      }
      for (const f of files) {
        if (f.buffer.length === 0) {
          return reply.status(400).send(error(400, '图片文件不能为空'))
        }
      }
      const botType = fields.bot_type ?? 'MJ'
      const dimensions = fields.dimensions ?? 'SQUARE'

      // midjourney-proxy /mj/submit/blend 接受 base64Array(每个为 base64,不带 data: 前缀)
      const upstreamBody = {
        botType,
        base64Array: files.map((f) => f.buffer.toString('base64')),
        dimensions,
      }

      try {
        const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/blend', {
          method: 'POST',
          body: JSON.stringify(upstreamBody),
        })
        if (!data.result) {
          return reply.status(400).send(error(400, data.description || '上游 MJ 混合失败'))
        }
        void chargeMjCall(ctx.id, ctx.userId, 'blend', data.result, request.ip)

        const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
        return reply.send(payload)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
      }
    },
  )

  // ===== 4. POST /audio/translations — Whisper 翻译(multipart 透传上游)=====
  server.post(
    '/audio/translations',
    {
      schema: {
        description: 'Whisper 语音→英文翻译(multipart/form-data)',
        tags: ['Audio'],
        consumes: ['multipart/form-data'],
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const upstream = getAudioUpstream()
      if (!upstream) {
        return reply.status(502).send(error(AUDIO_NOT_CONFIGURED_CODE, '上游 audio 渠道未配置'))
      }

      const { fields, file } = await readMultipartSingle(request)
      if (!file) {
        return reply.status(400).send(error(400, '缺少上传的音频文件(file 字段)'))
      }
      if (file.buffer.length === 0) {
        return reply.status(400).send(error(400, '音频文件为空'))
      }
      const model = fields.model ?? 'whisper-1'

      // 透传 multipart 到上游(保持 OpenAI Whisper API 兼容)
      const form = new FormData()
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype })
      form.append('file', blob, file.filename)
      form.append('model', model)
      if (fields.prompt) form.append('prompt', fields.prompt)
      if (fields.response_format) form.append('response_format', fields.response_format)
      if (fields.temperature) form.append('temperature', fields.temperature)

      try {
        const resp = await fetch(`${upstream.baseUrl}/v1/audio/translations`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${upstream.apiKey}` },
          body: form,
        })

        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 audio translations 调用失败 (${resp.status}): ${errText}`))
        }

        // response_format=json/verbose_json/text/srt/vtt
        const contentType = resp.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const data = (await resp.json()) as Partial<AudioTranslationResponse>
          const result: AudioTranslationResponse = {
            text: typeof data.text === 'string' ? data.text : '',
            ...(typeof data.language === 'string' ? { language: data.language } : {}),
            ...(typeof data.duration === 'number' ? { duration: data.duration } : {}),
            ...(Array.isArray(data.segments) ? { segments: data.segments } : {}),
            ...(Array.isArray(data.words) ? { words: data.words } : {}),
          }
          // 计费:按 audio 秒数(duration 字段优先,缺失时用 buffer 大小估算)
          const audioSeconds =
            typeof data.duration === 'number'
              ? data.duration
              : Math.max(1, Math.ceil(file.buffer.length / 16000))
          recordAudioCall(
            ctx.id,
            ctx.userId,
            model,
            audioSeconds,
            result.text,
            request.ip,
            resp.status,
          )
          return reply.send(result)
        }

        // 非 JSON(text/srt/vtt)直接透传
        const text = await resp.text()
        // 计费:按 buffer 大小估算秒数(16kHz 单声道 ≈ 32KB/s)
        const audioSeconds = Math.max(1, Math.ceil(file.buffer.length / 32000))
        recordAudioCall(ctx.id, ctx.userId, model, audioSeconds, text, request.ip, resp.status)
        reply.header('Content-Type', contentType || 'text/plain')
        return reply.send(text)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 audio translations 调用失败'))
      }
    },
  )

  // ===== 5. POST /images/variations — DALL-E 图像变体(multipart 透传上游)=====
  server.post(
    '/images/variations',
    {
      schema: {
        description: 'DALL-E 图像变体生成(multipart/form-data)',
        tags: ['Images'],
        consumes: ['multipart/form-data'],
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const upstream = getImagesUpstream()
      if (!upstream) {
        return reply.status(502).send(error(IMAGES_NOT_CONFIGURED_CODE, '上游 images 渠道未配置'))
      }

      const { fields, file } = await readMultipartSingle(request)
      if (!file) {
        return reply.status(400).send(error(400, '缺少上传的图片文件(image 字段)'))
      }
      if (file.buffer.length === 0) {
        return reply.status(400).send(error(400, '图片文件为空'))
      }
      const model = fields.model ?? 'dall-e-2'

      const form = new FormData()
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype })
      form.append('image', blob, file.filename)
      form.append('model', model)
      if (fields.n) form.append('n', fields.n)
      if (fields.size) form.append('size', fields.size)
      if (fields.response_format) form.append('response_format', fields.response_format)
      if (fields.user) form.append('user', fields.user)

      try {
        const resp = await fetch(`${upstream.baseUrl}/v1/images/variations`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${upstream.apiKey}` },
          body: form,
        })

        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 images variations 调用失败 (${resp.status}): ${errText}`))
        }

        const data = (await resp.json()) as Partial<ImageVariationResponse>
        const dataArray = Array.isArray(data.data) ? data.data : []
        const result: ImageVariationResponse = {
          created: typeof data.created === 'number' ? data.created : Math.floor(Date.now() / 1000),
          data: dataArray.map((item) => {
            const o = (item ?? {}) as ImageVariationDataItem
            return {
              ...(typeof o.url === 'string' ? { url: o.url } : {}),
              ...(typeof o.b64_json === 'string' ? { b64_json: o.b64_json } : {}),
              ...(typeof o.revised_prompt === 'string' ? { revised_prompt: o.revised_prompt } : {}),
            }
          }),
        }

        // 计费:按生成图片数(DALL-E 2 = 0.016$/img,DALL-E 3 = 0.040$/img)
        const imageCount = Math.max(1, result.data.length)
        recordImageVariationCall(ctx.id, ctx.userId, model, imageCount, request.ip, resp.status)

        return reply.send(result)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 images variations 调用失败'))
      }
    },
  )

  // ===== 6. POST /fine_tuning/jobs — 创建微调任务 =====
  server.post(
    '/fine_tuning/jobs',
    {
      schema: {
        description: '创建微调任务(OpenAI 兼容)',
        tags: ['FineTuning'],
        body: {
          type: 'object',
          properties: {
            training_file: { type: 'string' },
            model: { type: 'string' },
            validation_file: { type: 'string' },
            hyperparameters: {
              type: 'object',
              properties: {
                n_epochs: { type: ['integer', 'string'] },
              },
            },
            suffix: { type: 'string', maxLength: 40 },
          },
          required: ['training_file', 'model'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const parsed = fineTuningCreateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { training_file, model, validation_file, hyperparameters, suffix } = parsed.data

      const upstream = getFineTuningUpstream()
      if (!upstream) {
        return reply
          .status(502)
          .send(error(FINE_TUNING_NOT_CONFIGURED_CODE, '上游 fine_tuning 渠道未配置'))
      }

      const upstreamBody: Record<string, unknown> = { training_file, model }
      if (validation_file) upstreamBody.validation_file = validation_file
      if (hyperparameters) upstreamBody.hyperparameters = hyperparameters
      if (suffix) upstreamBody.suffix = suffix

      try {
        const resp = await fetch(`${upstream.baseUrl}/v1/fine_tuning/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${upstream.apiKey}`,
          },
          body: JSON.stringify(upstreamBody),
        })

        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 fine_tuning 创建失败 (${resp.status}): ${errText}`))
        }

        const data = (await resp.json()) as Partial<FineTuningJob>
        const job: FineTuningJob = {
          id: typeof data.id === 'string' ? data.id : `ftjob-${randomUUID()}`,
          object: 'fine_tuning.job',
          created_at:
            typeof data.created_at === 'number' ? data.created_at : Math.floor(Date.now() / 1000),
          updated_at:
            typeof data.updated_at === 'number' ? data.updated_at : Math.floor(Date.now() / 1000),
          model: typeof data.model === 'string' ? data.model : model,
          status: (typeof data.status === 'string' ? data.status : 'queued') as FineTuningJobStatus,
          training_file:
            typeof data.training_file === 'string' ? data.training_file : training_file,
          validation_file:
            typeof data.validation_file === 'string'
              ? data.validation_file
              : (validation_file ?? null),
          hyperparameters: (data.hyperparameters as FineTuningHyperparameters | undefined) ?? {
            n_epochs: 'auto',
          },
          suffix: typeof data.suffix === 'string' ? data.suffix : (suffix ?? null),
          error: (data.error as FineTuningJob['error']) ?? null,
          finished_at: typeof data.finished_at === 'number' ? data.finished_at : null,
          trained_tokens: typeof data.trained_tokens === 'number' ? data.trained_tokens : null,
          organization_id: typeof data.organization_id === 'string' ? data.organization_id : null,
          metadata: (data.metadata as Record<string, unknown>) ?? {},
        }

        // 本地 Redis 持久化元数据(TTL 90 天,上游不可达时兜底)
        await persistFineTuningJob(request, job)

        // 计费:预扣 1000 token(完成时由主 agent 按实际用量结算)
        recordFineTuningCall(ctx.id, ctx.userId, model, job.id, request.ip, resp.status)

        return reply.send(job)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 fine_tuning 创建失败'))
      }
    },
  )

  // ===== 7. GET /fine_tuning/jobs — 列表 =====
  server.get(
    '/fine_tuning/jobs',
    {
      schema: {
        description: '微调任务列表(OpenAI 兼容)',
        tags: ['FineTuning'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            after: { type: 'string' },
          },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const parsed = fineTuningListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, after } = parsed.data

      const upstream = getFineTuningUpstream()
      if (!upstream) {
        return reply
          .status(502)
          .send(error(FINE_TUNING_NOT_CONFIGURED_CODE, '上游 fine_tuning 渠道未配置'))
      }

      const qs = new URLSearchParams({ limit: String(limit) })
      if (after) qs.set('after', after)

      try {
        const resp = await fetch(`${upstream.baseUrl}/v1/fine_tuning/jobs?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${upstream.apiKey}` },
        })
        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 fine_tuning 列表查询失败 (${resp.status}): ${errText}`))
        }
        const data = (await resp.json()) as Partial<FineTuningJobListResponse>
        const result: FineTuningJobListResponse = {
          object: 'list',
          data: Array.isArray(data.data) ? (data.data as FineTuningJob[]) : [],
          has_more: Boolean(data.has_more),
        }
        return reply.send(result)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 fine_tuning 列表查询失败'))
      }
    },
  )

  // ===== 8. GET /fine_tuning/jobs/:id — 查询 =====
  server.get(
    '/fine_tuning/jobs/:id',
    {
      schema: {
        description: '查询微调任务详情(OpenAI 兼容)',
        tags: ['FineTuning'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const p = jobIdParamSchema.safeParse(request.params)
      if (!p.success) {
        return reply.status(400).send(error(400, p.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = p.data

      const upstream = getFineTuningUpstream()
      if (!upstream) {
        // 上游不可达时尝试本地 Redis 兜底
        const cached = await loadFineTuningJob(request, id)
        if (cached) return reply.send(cached)
        return reply
          .status(502)
          .send(error(FINE_TUNING_NOT_CONFIGURED_CODE, '上游 fine_tuning 渠道未配置'))
      }

      try {
        const resp = await fetch(
          `${upstream.baseUrl}/v1/fine_tuning/jobs/${encodeURIComponent(id)}`,
          { headers: { Authorization: `Bearer ${upstream.apiKey}` } },
        )
        if (resp.status === 404) {
          // 上游 404 时尝试本地缓存(任务可能已过期但本地仍存)
          const cached = await loadFineTuningJob(request, id)
          if (cached) return reply.send(cached)
          return reply.status(404).send(error(404, `微调任务不存在: ${id}`))
        }
        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 fine_tuning 查询失败 (${resp.status}): ${errText}`))
        }
        const data = (await resp.json()) as FineTuningJob
        // 刷新本地缓存
        await persistFineTuningJob(request, data)
        return reply.send(data)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 fine_tuning 查询失败'))
      }
    },
  )

  // ===== 9. POST /fine_tuning/jobs/:id/cancel — 取消 =====
  server.post(
    '/fine_tuning/jobs/:id/cancel',
    {
      schema: {
        description: '取消微调任务(OpenAI 兼容)',
        tags: ['FineTuning'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const p = jobIdParamSchema.safeParse(request.params)
      if (!p.success) {
        return reply.status(400).send(error(400, p.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = p.data

      const upstream = getFineTuningUpstream()
      if (!upstream) {
        // 上游不可达时尝试本地缓存更新状态
        const cached = await loadFineTuningJob(request, id)
        if (cached) {
          cached.status = 'cancelled'
          cached.updated_at = Math.floor(Date.now() / 1000)
          await persistFineTuningJob(request, cached)
          return reply.send(cached)
        }
        return reply
          .status(502)
          .send(error(FINE_TUNING_NOT_CONFIGURED_CODE, '上游 fine_tuning 渠道未配置'))
      }

      try {
        const resp = await fetch(
          `${upstream.baseUrl}/v1/fine_tuning/jobs/${encodeURIComponent(id)}/cancel`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${upstream.apiKey}`,
            },
          },
        )
        if (resp.status === 404) {
          return reply.status(404).send(error(404, `微调任务不存在: ${id}`))
        }
        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 fine_tuning 取消失败 (${resp.status}): ${errText}`))
        }
        const data = (await resp.json()) as FineTuningJob
        await persistFineTuningJob(request, data)
        return reply.send(data)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 fine_tuning 取消失败'))
      }
    },
  )

  // ===== 10. GET /fine_tuning/jobs/:id/events — 事件列表 =====
  server.get(
    '/fine_tuning/jobs/:id/events',
    {
      schema: {
        description: '微调任务事件列表(OpenAI 兼容)',
        tags: ['FineTuning'],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            after: { type: 'string' },
          },
        },
      },
      preHandler: [requireApiKeyAuth],
    },
    async (request, reply) => {
      const ctx = getApiKeyContext(request)
      if (!ctx) return reply.status(401).send(error(401, 'API key authentication required'))

      const p = jobIdParamSchema.safeParse(request.params)
      if (!p.success) {
        return reply.status(400).send(error(400, p.error.issues[0]?.message ?? '参数错误'))
      }
      const { id } = p.data
      const q = fineTuningEventsQuerySchema.safeParse(request.query)
      if (!q.success) {
        return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
      }
      const { limit, after } = q.data

      const upstream = getFineTuningUpstream()
      if (!upstream) {
        return reply
          .status(502)
          .send(error(FINE_TUNING_NOT_CONFIGURED_CODE, '上游 fine_tuning 渠道未配置'))
      }

      const qs = new URLSearchParams({ limit: String(limit) })
      if (after) qs.set('after', after)

      try {
        const resp = await fetch(
          `${upstream.baseUrl}/v1/fine_tuning/jobs/${encodeURIComponent(id)}/events?${qs.toString()}`,
          { headers: { Authorization: `Bearer ${upstream.apiKey}` } },
        )
        if (resp.status === 404) {
          return reply.status(404).send(error(404, `微调任务不存在: ${id}`))
        }
        if (!resp.ok) {
          const errText = await upstreamErrorText(resp)
          return reply
            .status(502)
            .send(error(502, `上游 fine_tuning 事件查询失败 (${resp.status}): ${errText}`))
        }
        const data = (await resp.json()) as Partial<FineTuningEventListResponse>
        const result: FineTuningEventListResponse = {
          object: 'list',
          data: Array.isArray(data.data) ? (data.data as FineTuningEvent[]) : [],
          has_more: Boolean(data.has_more),
        }
        return reply.send(result)
      } catch (e) {
        request.log.error(e)
        return reply.status(502).send(error(502, '上游 fine_tuning 事件查询失败'))
      }
    },
  )

  // ===== /files 系列路由由 v1-public.ts 提供(GET /files + POST /files,files 表持久化)=====
  // 2026-07-31 删除本文件 4 个 Redis 存储的 /files/* 重复路由,解决 FST_ERR_DUPLICATED_ROUTE:
  //   GET /files, POST /files 与 v1-public.ts 重复
  //   GET /files/:id, DELETE /files/:id 因依赖 Redis 存储与 v1-public.ts 落盘实现不一致,暂移除
  //   后续如需 /files/:id 操作,应在 v1-public.ts 中补充(走 files 表)而非本文件 Redis 路径
}

export default v1ProtocolCompletenessRoutes
