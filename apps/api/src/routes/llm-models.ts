// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { config } from '../config/index.js'
import { db } from '../db/index.js'
import { zhsAiModelInfo } from '@ihui/database'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { inferPointsMultiplier } from './ai-vendors/proxy-llm.js'
import { isSystemAdminUser } from '../db/queries.js'
import { fetchWithinDeadline, isDeadlineAbort } from '../utils/fetch-deadline.js'
import { ErrorCode, type ErrorCodeKey } from '../errors/codes.js'
import { mapUpstreamOutbound, UPSTREAM_AUTH_FAILED_MESSAGE } from '../errors/upstream-status.js'
import {
  fetchProviderHealth,
  resolveProviderAvailability,
  inferProviderCode,
} from '../lib/llm-provider-health.js'

/**
 * 受限模型(2026-08-05 安全红线):生产真实 LLM API key(stepfun/agnes/groq/deepseek)
 * 的模型仅系统内置管理员(users.is_system_admin=true)可见/可用,普通用户过滤。
 * 与 ai-service llm.py 的 _ensure_restricted_model_access 双端一致。
 * 2026-08-06 扩展:新增 nvidia_nim/siliconflow/zhipu/bailian/openai 真实 key。
 */
// 受限模型 id 前缀(nvidia/→nvidia_nim;siliconcloud/与 siliconflow/→siliconflow;
// bailian/→阿里百炼;glm-→zhipu,与 llm_gateway._model_to_provider_code 一致)
const RESTRICTED_PREFIXES = [
  'stepfun/',
  'agnes/',
  'groq/',
  'nvidia/',
  'siliconcloud/',
  'siliconflow/',
  'bailian/',
  'glm-',
]
const RESTRICTED_MODEL_IDS = new Set([
  'deepseek-chat',
  'deepseek-reasoner',
  'gpt-4o',
  'gpt-4o-mini',
])

function isRestrictedModel(id: string): boolean {
  return RESTRICTED_MODEL_IDS.has(id) || RESTRICTED_PREFIXES.some((p) => id.startsWith(p))
}

/**
 * 特殊 UUID 列表:这些用户可见额外模型(如内部测试模型)。
 * 等价自旧架构 SPECIAL_UUIDS,以环境变量覆盖。
 */
const SPECIAL_UUIDS = (process.env.SPECIAL_UUIDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * 从请求中读取用户 UUID。
 * 身份的唯一写入点是 plugins/auth.ts 的 authenticate()（`request.userId`）；
 * 旧实现读 `request.user`，那个字段本仓无人赋值，于是恒返空串。
 */
function getUserUuid(request: FastifyRequest): string {
  return request.userId ?? ''
}

/** 从请求头读取课程平台标识(用于 COURSE-PLATFORM=wechat 过滤) */
function getCoursePlatform(request: FastifyRequest): string {
  const h = request.headers['x-course-platform']
  if (!h) return ''
  return Array.isArray(h) ? (h[0] ?? '') : h
}

/**
 * 模型列表条目(前端 AIModelInfo[] 兼容格式,20 字段映射)
 * 等价自旧架构 server/app/api/v1/llm/models_unify.py 返回结构
 */
export interface AiModelInfoItem {
  id: number
  name: string
  code: string | null
  type: number
  modelCode: string | null
  source: string | null
  icon: string | null
  description: string | null
  manufacturer: string | null
  questType: string | null
  variables: string | null
  openDesc: string | null
  modelDesc: string | null
  grassRoots: boolean
  isGratis: boolean
  isNew: boolean
  isTop: boolean
  isHot: boolean
  coursePlatform: string | null
  sort: number
  status: number
  createdAt: string | null
  updatedAt: string | null
  /** 积分消耗倍数(由 modelCode/code/name 推断:0x 免费 / 1x 经济 / 3x 标准 / 10x 高级 / 30x 旗舰) */
  pointsMultiplier: number
  /** 是否可用(best-effort:由 ai-service provider 健康推导;空健康度或缺省 → 视为可用) */
  available?: boolean
}

/** 为 ai-service 返回的模型列表安全附加 points_multiplier(兼容数组 / {models|data|items: []}) */
function attachPointsMultiplier(data: unknown): unknown {
  const withMultiplier = (m: unknown): unknown => {
    if (typeof m !== 'object' || m === null) return m
    const obj = m as Record<string, unknown>
    const id =
      typeof obj.id === 'string'
        ? obj.id
        : typeof obj.model === 'string'
          ? obj.model
          : typeof obj.name === 'string'
            ? obj.name
            : ''
    return { ...obj, points_multiplier: inferPointsMultiplier(id) }
  }
  if (Array.isArray(data)) return data.map(withMultiplier)
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    for (const key of ['models', 'data', 'items'] as const) {
      if (Array.isArray(obj[key])) {
        return { ...obj, [key]: (obj[key] as unknown[]).map(withMultiplier) }
      }
    }
  }
  return data
}

/**
 * GET /models 的上游错误分类(票 B67,2026-10-30)。
 *
 * 立因(一手证据):`api_logs` 里 2026-10-30 06:29:25 与 06:42:48 两次同签名
 * `GET /api/llm/models -> 502`,耗时分别 11ms / 34ms;而 ai-service 正常返回这份
 * 507KB 清单要 0.5–1.2s,连接被拒只需 ~1ms,ai-service 回 401 约 7–10ms —— 说明两次
 * 都是"上游根本没给成功响应",但旧实现把**三类完全不同的失败压成同一个 502**:
 *   ① fetch 抛错(进程不在/端口没听 = 上游不可达)
 *   ② 上游回非 2xx(401/403 凭据、5xx、限流…)
 *   ③ 本仓自己的逻辑抛错(isSystemAdminUser 查库失败、解析分支缺陷…)
 * 于是 api_logs 里只剩一行状态码,事后无法归因(中间件只对 onError 追加摘要,
 * 路由自己 reply.send 的 5xx 不带任何摘要)。本层按"谁该负责"分档,并各给稳定 errorCode:
 *   - 超时(deadline)        → 504 GATEWAY_TIMEOUT(等上游)
 *   - 连不上(传输层报错)    → 503 SERVICE_UNAVAILABLE(看进程/端口)
 *   - 上游 401/403           → 502 UPSTREAM_AUTH_FAILED(凭据,复用 L7648 单一映射)
 *   - 上游其余非 2xx         → 502 UPSTREAM_FAILURE(带上游状态码与前 200 字)
 *   - 上游 2xx 但不是 JSON   → 502 UPSTREAM_FAILURE(契约破坏)
 *   - 本仓自身缺陷           → 不在此捕获,交全局 errorHandler 记 500 INTERNAL_ERROR
 * 刻意不再在路由里兜住第 ③ 类:把它盖成"AI service unavailable"是本票要治的那一型
 * (错把本仓缺陷记到上游账上,下一个人只能凭 502 猜)。
 */
const DEFAULT_UPSTREAM_TIMEOUT_MS = 15_000

/**
 * 上游 deadline(毫秒)。`LLM_MODELS_UPSTREAM_TIMEOUT_MS` 是排障/测试用的收紧口:
 * 用例要真跑"超时"这一档就必须能把 15s 压到几十毫秒,否则只能手搓一个假的 deadline
 * 错误对象,那测的是分类函数而不是 deadline 真的会触发。非法值回落默认(不静默变 0)。
 */
function resolveUpstreamTimeoutMs(): number {
  const raw = Number(process.env.LLM_MODELS_UPSTREAM_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UPSTREAM_TIMEOUT_MS
}

interface UpstreamFailure {
  status: number
  errorCode: ErrorCodeKey
  message: string
}

/** 传输层异常 → 分类(超时与"连不上"必须分开,前者等上游、后者看进程)。 */
function classifyUpstreamThrow(err: unknown, timeoutMs: number): UpstreamFailure {
  if (isDeadlineAbort(err)) {
    return {
      status: ErrorCode.GATEWAY_TIMEOUT.status,
      errorCode: 'GATEWAY_TIMEOUT',
      message: `AI service timeout: no response within ${timeoutMs}ms`,
    }
  }
  const detail = err instanceof Error ? err.message : String(err ?? '')
  return {
    status: ErrorCode.SERVICE_UNAVAILABLE.status,
    errorCode: 'SERVICE_UNAVAILABLE',
    message: `AI service unreachable: ${detail || 'fetch failed'}`,
  }
}

/** 上游非 2xx → 分类(凭据类改判复用 errors/upstream-status.ts 的单一实现)。 */
function classifyUpstreamStatus(upstreamStatus: number, bodyText: string): UpstreamFailure {
  if (mapUpstreamOutbound(upstreamStatus).remapped) {
    return {
      status: ErrorCode.UPSTREAM_AUTH_FAILED.status,
      errorCode: 'UPSTREAM_AUTH_FAILED',
      message: UPSTREAM_AUTH_FAILED_MESSAGE,
    }
  }
  // 非凭据类沿用既有 502 契约(网关口径),但不再是"unavailable"三字包打天下:
  // 上游状态码与响应片段必须进响应与日志,否则又会回到"只能凭状态码猜"。
  return {
    status: ErrorCode.UPSTREAM_FAILURE.status,
    errorCode: 'UPSTREAM_FAILURE',
    message: `AI service error: ${upstreamStatus} ${bodyText.slice(0, 200)}`.trim(),
  }
}

export const llmModelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  /**
   * GET /models — 代理到 ai-service /api/llm/models(保持原行为)
   * 返回 LLM 网关可用模型列表(用于实际 LLM 调用)
   *
   * B67(2026-10-30):上游失败按"谁该负责"分档出栈(见 classifyUpstream*),
   * 并补了出站 deadline —— 旧写法没有超时,上游"连上但不回话"会把这条请求挂到客户端放弃。
   */
  server.get('/models', async (request, reply) => {
    const timeoutMs = resolveUpstreamTimeoutMs()
    let resp: Response
    try {
      resp = await fetchWithinDeadline(
        `${config.AI_SERVICE_URL}/api/llm/models`,
        {
          method: 'GET',
          headers: {
            Authorization: request.headers.authorization ?? '',
          },
        },
        { timeoutMs, label: 'llm-models.upstream' },
      )
    } catch (e) {
      const failure = classifyUpstreamThrow(e, timeoutMs)
      // 结构化留痕:api_logs 只存状态码,真正的原因必须在 stdout 有一行可查(B67 的直接诉求)。
      request.log.warn(
        { kind: failure.errorCode, upstream: 'ai-service', err: e },
        '[llm-models] 上游取模型清单失败',
      )
      return reply
        .status(failure.status)
        .send(error(failure.status, failure.message, failure.errorCode))
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      const failure = classifyUpstreamStatus(resp.status, text)
      request.log.warn(
        { kind: failure.errorCode, upstream: 'ai-service', upstreamStatus: resp.status },
        '[llm-models] 上游取模型清单失败',
      )
      return reply
        .status(failure.status)
        .send(error(failure.status, failure.message, failure.errorCode))
    }

    let data: unknown
    try {
      data = await resp.json()
    } catch (e) {
      request.log.warn(
        { kind: 'UPSTREAM_FAILURE', upstream: 'ai-service', err: e },
        '[llm-models] 上游响应不是合法 JSON',
      )
      return reply
        .status(ErrorCode.UPSTREAM_FAILURE.status)
        .send(
          error(
            ErrorCode.UPSTREAM_FAILURE.status,
            'AI service returned invalid JSON payload',
            'UPSTREAM_FAILURE',
          ),
        )
    }

    // 以下全部是本仓自己的逻辑:任何异常都是本仓缺陷,交全局 errorHandler 记 500 INTERNAL_ERROR,
    // 不再像旧实现那样盖成 502 "AI service unavailable"(B67:别把本仓缺陷记到上游账上)。
    // 2026-08-05 安全红线:非系统内置管理员过滤受限模型(真实付费 key 模型)
    // 2026-10-31 补:判定改为 fail-closed —— 身份取不到时同样过滤。
    // 原写法 `if (userUuid && ...)` 让"身份缺失"落到不过滤分支,等于把受限清单发给任何人。
    const userUuid = getUserUuid(request)
    if (!userUuid || !(await isSystemAdminUser(userUuid))) {
      const raw = data as { models?: Array<{ id?: string }> }
      if (Array.isArray(raw.models)) {
        raw.models = raw.models.filter((m) => !m.id || !isRestrictedModel(m.id))
      }
    }
    return reply.send(success(attachPointsMultiplier(data)))
  })

  /**
   * GET /list — DB 驱动的模型列表(前端展示用)
   *
   * 等价自旧架构 GET /llm/models-unify,实现复杂排序:
   * 1. status=1 过滤(可用模型)
   * 2. COURSE-PLATFORM=wechat 过滤:course_platform 为空或等于 'wechat' 的模型可见
   *    (其他平台如 'web'/'app' 的模型在 wechat 课程平台下隐藏)
   * 3. SPECIAL_UUIDS 处理:特殊用户可见 type=99 的内部测试模型
   * 4. 排序:type=1 优先 → is_top=true 优先 → is_hot=true 优先 → is_new=true 优先 → sort 升序
   *
   * 返回 AiModelInfoItem[](20 字段,前端 AIModelInfo[] 兼容格式)
   */
  server.get('/list', async (request, reply) => {
    try {
      const userUuid = getUserUuid(request)
      const coursePlatform = getCoursePlatform(request)
      const isSpecialUser = SPECIAL_UUIDS.includes(userUuid)

      // 单次请求内拉取 ai-service provider 健康度(best-effort)。
      // G-726(2026-09-29):失败不再塌缩成"空 Map ⇒ 全部可用",而是显式 known:false。
      const health = await fetchProviderHealth()

      // 基础条件:status=1(可用)
      const conditions = [eq(zhsAiModelInfo.status, 1)]

      // COURSE-PLATFORM=wechat 过滤:课程平台为 wechat 时,只显示 course_platform 为空或 'wechat' 的模型
      if (coursePlatform === 'wechat') {
        // 注意:NULL 表示全平台可见,'' 也表示全平台可见
        // 这里用 OR 逻辑,但 drizzle 不便组合 OR,改为查询后过滤
      }

      const rows = await db
        .select()
        .from(zhsAiModelInfo)
        .where(and(...conditions))

      // 应用 COURSE-PLATFORM 过滤(内存中,因为涉及 NULL 处理)
      let filtered = rows
      if (coursePlatform === 'wechat') {
        filtered = rows.filter((m) => {
          const cp = m.coursePlatform
          // course_platform 为空/NULL 表示全平台可见
          if (!cp || cp === '') return true
          // 等于 'wechat' 表示微信课程平台可见
          if (cp === 'wechat') return true
          // 其他值(web/app/miniapp)在 wechat 课程平台下隐藏
          return false
        })
      }

      // SPECIAL_UUIDS 处理:非特殊用户隐藏 type=99 的内部测试模型
      if (!isSpecialUser) {
        filtered = filtered.filter((m) => m.type !== 99)
      }

      // 复杂排序:type=1 优先 → is_top → is_hot → is_new → sort 升序
      const sorted = filtered.sort((a, b) => {
        // type=1 优先(降序:type=1 排前,type=其他排后)
        const aTypePriority = a.type === 1 ? 1 : 0
        const bTypePriority = b.type === 1 ? 1 : 0
        if (aTypePriority !== bTypePriority) return bTypePriority - aTypePriority

        // is_top 优先
        if (a.isTop !== b.isTop) return a.isTop ? -1 : 1

        // is_hot 优先
        if (a.isHot !== b.isHot) return a.isHot ? -1 : 1

        // is_new 优先
        if (a.isNew !== b.isNew) return a.isNew ? -1 : 1

        // sort 升序
        return a.sort - b.sort
      })

      // 映射为前端兼容格式
      const items: AiModelInfoItem[] = sorted.map((m) => {
        // G-726(2026-09-29):三态判定。'unknown' = 本轮未取到健康度 ⇒ **省略 available 字段**,
        // 既不显示"可用"也不显示"不可用";另两态照旧给布尔(与改动前同形)。
        const availability = resolveProviderAvailability(
          inferProviderCode(m.modelCode, m.code, m.name),
          health,
        )
        return {
          id: m.id,
          name: m.name,
          code: m.code,
          type: m.type,
          modelCode: m.modelCode,
          source: m.source,
          icon: m.icon,
          description: m.description,
          manufacturer: m.manufacturer,
          questType: m.questType,
          variables: m.variables,
          openDesc: m.openDesc,
          modelDesc: m.modelDesc,
          grassRoots: m.grassRoots,
          isGratis: m.isGratis,
          isNew: m.isNew,
          isTop: m.isTop,
          isHot: m.isHot,
          coursePlatform: m.coursePlatform,
          sort: m.sort,
          status: m.status,
          createdAt: m.createdAt ? m.createdAt.toISOString() : null,
          updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
          pointsMultiplier: inferPointsMultiplier(m.modelCode ?? m.code ?? m.name),
          ...(availability === 'unknown' ? {} : { available: availability === 'available' }),
        }
      })

      // 铁律:仅展示可用且有额度的模型。硬死模型移除;
      // G-726:known:false(本轮没问到)⇒ 保留全部 —— 与改动前"空 Map ⇒ 宽松保留全部"逐字同形,
      // 刻意不改严(改它会改变现网列表放行行为,属另票)。
      const filteredItems = health.known ? items.filter((i) => i.available !== false) : items

      return reply.send(success({ items: filteredItems, total: filteredItems.length }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to list models'))
    }
  })

  /**
   * GET /list/:id — 单个模型详情(前端模型卡片展示用)
   */
  server.get('/list/:id', async (request, reply) => {
    try {
      const id = parseInt((request.params as { id: string }).id, 10)
      if (!Number.isFinite(id) || id <= 0) {
        return reply.status(400).send(error(400, 'Invalid id'))
      }

      const rows = await db.select().from(zhsAiModelInfo).where(eq(zhsAiModelInfo.id, id)).limit(1)

      const m = rows[0]
      if (!m) {
        return reply.status(404).send(error(404, 'Model not found'))
      }

      const item: AiModelInfoItem = {
        id: m.id,
        name: m.name,
        code: m.code,
        type: m.type,
        modelCode: m.modelCode,
        source: m.source,
        icon: m.icon,
        description: m.description,
        manufacturer: m.manufacturer,
        questType: m.questType,
        variables: m.variables,
        openDesc: m.openDesc,
        modelDesc: m.modelDesc,
        grassRoots: m.grassRoots,
        isGratis: m.isGratis,
        isNew: m.isNew,
        isTop: m.isTop,
        isHot: m.isHot,
        coursePlatform: m.coursePlatform,
        sort: m.sort,
        status: m.status,
        createdAt: m.createdAt ? m.createdAt.toISOString() : null,
        updatedAt: m.updatedAt ? m.updatedAt.toISOString() : null,
        pointsMultiplier: inferPointsMultiplier(m.modelCode ?? m.code ?? m.name),
      }

      return reply.send(success(item))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to get model'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
