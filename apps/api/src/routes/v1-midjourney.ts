// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1/midjourney/* — Midjourney-Proxy 标准接口对接(2026-07-31 立)。
 *
 * 对标 New API 已有的 MJ 渠道能力,对接 midjourney-proxy 项目(novicezk/midjourney-proxy)。
 * 上游配置:process.env.MIDJOURNEY_PROXY_BASE + MIDJOURNEY_PROXY_API_KEY
 *
 * 端点清单(4 个):
 * 1. POST /v1/midjourney/imagine        — 文生图提交(→ 上游 POST /mj/submit/imagine)
 * 2. GET  /v1/midjourney/tasks/:taskId  — 任务状态查询(→ 上游 GET  /mj/task/:id)
 * 3. POST /v1/midjourney/action         — 通用操作:upscale/variation/reroll(→ 上游 POST /mj/submit/action)
 * 4. POST /v1/midjourney/upscale        — 单图放大(→ 上游 POST /mj/submit/upscale)
 *
 * 鉴权:requireApiKeyAuth(plugins/api-key-auth.ts,Bearer token + developer_api_keys 表)。
 * 计费:按次计费(imagine=1 unit,upscale=0.5 unit,variation/reroll=1 unit),model='midjourney-v6',
 *      通过 relay-billing-service.recordCall 写入 llm_call_logs + 扣减余额。
 *
 * 响应格式统一 { code, message, data },code=0 成功。
 * 上游未配置时返回 5016 "Midjourney-Proxy 渠道未配置"。
 */
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify'
import type { Redis } from 'ioredis'
import { z } from 'zod'
import type { AuthenticatedApiKey } from '@ihui/types'
import { requireApiKeyAuth, requireApiKeyQuota } from '../plugins/api-key-auth.js'
import { requireCapabilityRules } from '../utils/capability-guard.js'
import { success, error } from '../utils/response.js'
import { recordCall } from '../services/relay-billing-service.js'

// =============================================================================
// 常量
// =============================================================================

/** 上游 midjourney-proxy base url,如 http://localhost:8808 */
const MJ_BASE = process.env.MIDJOURNEY_PROXY_BASE
/** 上游 midjourney-proxy api key */
const MJ_API_KEY = process.env.MIDJOURNEY_PROXY_API_KEY
/** 上游未配置错误码 */
const MJ_NOT_CONFIGURED_CODE = 5016

/** MJ 操作计费单位(1 unit = 1 次基准调用) */
type MjBillingUnits = {
  imagine: 1
  upscale: 0.5
  variation: 1
  reroll: 1
  action: 1
}
type MjOpType = keyof MjBillingUnits

// =============================================================================
// 类型定义(上游响应 + 本地响应)
// =============================================================================

/** 上游 midjourney-proxy 提交响应(submit/imagine, submit/action, submit/upscale 通用) */
interface MjUpstreamSubmitResult {
  code: number
  description: string
  result: string | null
  properties?: Record<string, unknown> | null
}

/** 上游 midjourney-proxy 任务详情(task/:id 返回) */
interface MjUpstreamTask {
  id: string
  status: string
  imageUrl?: string
  progress?: string
  failReason?: string | null
  action?: string
  prompt?: string
  submitTime?: number
  startTime?: number
  finishTime?: number
}

/** 本地提交响应 data */
interface MjSubmitData {
  task_id: string
  status: string
}

/** 本地任务详情响应 data */
interface MjTaskDetailData {
  task_id: string
  status: string
  image_url: string | null
  progress: string
  fail_reason: string | null
}

// =============================================================================
// 上游代理工具
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

/** 上游 MJ 状态 → 本地状态(小写化,保持 midjourney-proxy 原始语义) */
function mapStatus(upstream: string): string {
  return upstream.toLowerCase()
}

/** 上游 MJ 请求超时(F-277):上游挂起时不再无限占用连接。 */
const MJ_UPSTREAM_TIMEOUT_MS = 60_000

/** 通用上游 fetch 封装:自动注入鉴权头,非 2xx 抛错。 */
async function mjFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(mjUrl(path), {
    ...init,
    // F-277:上游无响应时按超时失败,而不是让请求永远挂着
    signal: init?.signal ?? AbortSignal.timeout(MJ_UPSTREAM_TIMEOUT_MS),
    headers: { ...mjHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`上游 MJ 返回 HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

// =============================================================================
// 计费
// =============================================================================

/** MJ 操作计费单位(1 unit = 1000 totalTokens 基准) */
const MJ_BILLING_UNITS: Record<MjOpType, number> = {
  imagine: 1,
  upscale: 0.5,
  variation: 1,
  reroll: 1,
  action: 1,
}

/**
 * MJ 按次计费。调用 relay-billing-service.recordCall 写入 llm_call_logs + 扣减余额。
 * 计费失败不阻塞主链路(void + .catch)。
 */
async function chargeMjCall(
  apiKey: AuthenticatedApiKey,
  op: MjOpType,
  taskId: string,
): Promise<void> {
  // F-277:计费失败必须留痕。此前 `void recordCall(...).catch(() => {})` 把失败彻底吃掉,
  // 上游已出图却扣不到钱(静默欠费)。这里等待结算并把失败降级为告警日志。
  await recordCall({
    apiKeyId: apiKey.id,
    userId: apiKey.userId,
    model: 'midjourney-v6',
    prompt: op,
    response: taskId,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: Math.round(1000 * MJ_BILLING_UNITS[op]),
    latencyMs: 0,
    status: 'success',
    providerCode: 'midjourney',
    clientIp: '',
    metadata: { endpoint: `mj_${op}`, task_id: taskId },
  }).catch((err: unknown) => {
    console.warn('[v1/midjourney] charge failed', {
      taskId,
      op,
      error: err instanceof Error ? err.message : String(err),
    })
  })
}

// =============================================================================
// F-92 任务归属映射
// =============================================================================

/**
 * F-92(2026-11-13 修):任务 ID 归属映射。
 *
 * 上游任务 ID 全局可枚举,而 tasks/action/upscale 都以**平台** MJ Key 向上游发起。
 * 不建归属映射 = 任意 API Key 可读他人 prompt/图片 URL,也可对他人任务做 upscale。
 *
 * 落点:既有 Redis(与 F-48 的 `imgtask:*`、BullMQ job.data 同一条持久面),提交成功
 * 即写 `taskId → { userId, apiKeyId, op }`,查询/操作前先读。
 *
 * 判据按 **userId**(同一用户轮换 API Key 后继续轮询同一任务不应失效),不比
 * apiKeyId 更严;apiKeyId 仅留档排障。`NX` 写入:上游若对相同 prompt 去重返回同一
 * taskId,后来者不能把归属改到自己名下。
 *
 * 无映射(上线前的历史任务 / 映射过期 / Redis 不可用)一律 fail-closed 404。
 */
const MJ_TASK_OWNER_PREFIX = 'ihui:mj:task-owner:'
/** 归属保留 30 天:远长于上游任务可查询期,过期后按无映射处理。 */
const MJ_TASK_OWNER_TTL_SEC = 30 * 24 * 60 * 60

interface MjTaskOwner {
  userId: string
  apiKeyId: string
  op: MjOpType
}

function taskOwnerKey(taskId: string): string {
  return `${MJ_TASK_OWNER_PREFIX}${taskId}`
}

/** 写入任务归属。失败只留痕不阻断:上游已出图且已计费,不能让归属写入反向毁掉结果。 */
async function bindTaskOwner(
  redis: Redis,
  taskId: string,
  apiKey: AuthenticatedApiKey,
  op: MjOpType,
  log: FastifyBaseLogger,
): Promise<void> {
  const record: MjTaskOwner = { userId: apiKey.userId, apiKeyId: apiKey.id, op }
  try {
    await redis.set(taskOwnerKey(taskId), JSON.stringify(record), 'EX', MJ_TASK_OWNER_TTL_SEC, 'NX')
  } catch (err: unknown) {
    log.error({ taskId, op, err }, '[v1/midjourney] 任务归属写入失败')
  }
}

/** 读取任务归属;无映射 / 脏数据 / Redis 异常都返回 null(fail-closed)。 */
async function readTaskOwner(
  redis: Redis,
  taskId: string,
  log: FastifyBaseLogger,
): Promise<MjTaskOwner | null> {
  try {
    const raw = await redis.get(taskOwnerKey(taskId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MjTaskOwner> | null
    if (!parsed || typeof parsed.userId !== 'string' || parsed.userId.length === 0) return null
    return {
      userId: parsed.userId,
      apiKeyId: typeof parsed.apiKeyId === 'string' ? parsed.apiKeyId : '',
      op: parsed.op ?? 'imagine',
    }
  } catch (err: unknown) {
    log.error({ taskId, err }, '[v1/midjourney] 任务归属读取失败(fail-closed)')
    return null
  }
}

// =============================================================================
// Zod 请求体 schemas
// =============================================================================

const imagineSchema = z.object({
  model: z.string().default('mj-v6'),
  prompt: z.string().min(1).max(2000),
  aspect_ratio: z.string().optional(),
  process_mode: z.enum(['fast', 'turbo', 'relax']).default('fast'),
  bot_type: z.enum(['MJ', 'NIJI']).default('MJ'),
})

const actionSchema = z.object({
  task_id: z.string().min(1),
  action_type: z.enum(['upscale', 'variation', 'reroll']),
  index: z.number().int().min(1).max(4).optional(),
  custom_id: z.string().optional(),
})

const upscaleSchema = z.object({
  task_id: z.string().min(1),
  index: z.number().int().min(1).max(4),
  custom_id: z.string().optional(),
})

const taskIdParamSchema = z.object({
  taskId: z.string().min(1),
})

// =============================================================================
// 路由
// =============================================================================

const midjourneyRoutes: FastifyPluginAsync = async (server) => {
  // 共享 API Key 鉴权 preHandler(所有 MJ 路由共享)
  server.addHook('preHandler', requireApiKeyAuth)
  // O3 能力闸:生成动作→images:write,任务状态查询→generation:write
  server.addHook(
    'preHandler',
    requireCapabilityRules([
      { methods: ['GET'], pattern: /^\/v1\/midjourney\/tasks\//, scope: 'generation:write' },
      { methods: ['POST'], pattern: /^\/v1\/midjourney\//, scope: 'images:write' },
    ]),
  )
  // F-277:生成类端点(最贵的一档)必须过 ApiKeyQuota —— 只挂鉴权 + 能力闸时,
  // 单 Key 可以无限消耗平台 MJ 额度且先执行后扣费(欠费)。
  const quotaGate = requireApiKeyQuota()
  server.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST') return
    return quotaGate.call(server, request, reply)
  })

  // ===== 1. POST /v1/midjourney/imagine — 文生图提交 =====
  server.post('/v1/midjourney/imagine', async (request, reply) => {
    if (!mjConfigured()) {
      return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
    }
    const parsed = imagineSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data

    // 构造上游 prompt:追加 --ar / --fast / --turbo / --relax
    const promptParts: string[] = [b.prompt]
    if (b.aspect_ratio) promptParts.push(`--ar ${b.aspect_ratio}`)
    if (b.process_mode === 'turbo') promptParts.push('--turbo')
    else if (b.process_mode === 'relax') promptParts.push('--relax')
    else promptParts.push('--fast')

    const upstreamBody = {
      botType: b.bot_type,
      prompt: promptParts.join(' '),
      state: JSON.stringify({
        model: b.model,
        orig_prompt: b.prompt,
        process_mode: b.process_mode,
      }),
    }

    try {
      const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/imagine', {
        method: 'POST',
        body: JSON.stringify(upstreamBody),
      })
      if (!data.result) {
        return reply.status(400).send(error(400, data.description || '上游 MJ 提交失败'))
      }
      // F-92:先把 taskId 绑定到调用者,后续查询才有归属可校验
      const apiKey = request.apiKey!
      await bindTaskOwner(server.redis, data.result, apiKey, 'imagine', request.log)
      // 计费(桩)
      await chargeMjCall(apiKey, 'imagine', data.result)

      const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
    }
  })

  // ===== 2. GET /v1/midjourney/tasks/:taskId — 任务状态查询 =====
  server.get('/v1/midjourney/tasks/:taskId', async (request, reply) => {
    if (!mjConfigured()) {
      return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
    }
    const p = taskIdParamSchema.safeParse(request.params)
    if (!p.success) {
      return reply.status(400).send(error(400, p.error.issues[0]?.message ?? '参数错误'))
    }

    // F-92:先校验归属,非本人(含无映射的历史任务)一律 404,不触达上游
    const owner = await readTaskOwner(server.redis, p.data.taskId, request.log)
    if (!owner || owner.userId !== request.apiKey!.userId) {
      return reply.status(404).send(error(404, '任务不存在'))
    }

    try {
      const task = await mjFetch<MjUpstreamTask>(`/mj/task/${encodeURIComponent(p.data.taskId)}`)
      if (!task || !task.id) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const payload: MjTaskDetailData = {
        task_id: task.id,
        status: mapStatus(task.status),
        image_url: task.imageUrl ?? null,
        progress: task.progress ?? '',
        fail_reason: task.failReason ?? null,
      }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
    }
  })

  // ===== 3. POST /v1/midjourney/action — 通用操作(upscale/variation/reroll) =====
  server.post('/v1/midjourney/action', async (request, reply) => {
    if (!mjConfigured()) {
      return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
    }
    const parsed = actionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data

    // F-92:只能操作自己的任务(parent task);非本人一律 404
    const owner = await readTaskOwner(server.redis, b.task_id, request.log)
    if (!owner || owner.userId !== request.apiKey!.userId) {
      return reply.status(404).send(error(404, '任务不存在'))
    }

    const upstreamBody = {
      customId: b.custom_id ?? '',
      taskId: b.task_id,
      index: b.index ?? 1,
    }

    try {
      const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/action', {
        method: 'POST',
        body: JSON.stringify(upstreamBody),
      })
      if (!data.result) {
        return reply.status(400).send(error(400, data.description || '上游 MJ 操作失败'))
      }
      // F-92:新子任务同样绑定到调用者,否则本人后续查询会被 fail-closed
      const apiKey = request.apiKey!
      await bindTaskOwner(server.redis, data.result, apiKey, b.action_type, request.log)
      // 计费:按 action_type 折算 unit(upscale=0.5, variation/reroll=1)
      await chargeMjCall(apiKey, b.action_type, data.result)

      const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
    }
  })

  // ===== 4. POST /v1/midjourney/upscale — 单图放大 =====
  server.post('/v1/midjourney/upscale', async (request, reply) => {
    if (!mjConfigured()) {
      return reply.status(501).send(error(MJ_NOT_CONFIGURED_CODE, 'Midjourney-Proxy 渠道未配置'))
    }
    const parsed = upscaleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data

    // F-92:只能放大自己的任务;非本人一律 404
    const owner = await readTaskOwner(server.redis, b.task_id, request.log)
    if (!owner || owner.userId !== request.apiKey!.userId) {
      return reply.status(404).send(error(404, '任务不存在'))
    }

    const upstreamBody = {
      customId: b.custom_id ?? '',
      taskId: b.task_id,
      index: b.index,
    }

    try {
      const data = await mjFetch<MjUpstreamSubmitResult>('/mj/submit/upscale', {
        method: 'POST',
        body: JSON.stringify(upstreamBody),
      })
      if (!data.result) {
        return reply.status(400).send(error(400, data.description || '上游 MJ 放大失败'))
      }
      // F-92:新子任务绑定到调用者
      const apiKey = request.apiKey!
      await bindTaskOwner(server.redis, data.result, apiKey, 'upscale', request.log)
      // 计费:upscale = 0.5 unit
      await chargeMjCall(apiKey, 'upscale', data.result)

      const payload: MjSubmitData = { task_id: data.result, status: 'submitted' }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '上游 Midjourney-Proxy 调用失败'))
    }
  })
}

export default midjourneyRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
