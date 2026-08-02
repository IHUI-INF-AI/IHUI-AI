/**
 * 模型广场 / AI 资讯 API 客户端
 *
 * 目标:把 /models 页面从"helpers.ts 写死数据"升级为"消费 seed 2026-07 真实数据"
 * 同时为后续 backend 路由补全预留 fetch 接口,带 graceful fallback。
 *
 * 后端路由(2026-07 当前可用):
 *   - GET /api/llm/models                 已存在(需 auth,代理 ai-service,旧 fetchModels 走它)
 *   - GET /api/llm/list                   已存在(DB 驱动,20 字段格式)
 *   - GET /api/news/articles/pinned       已存在(公开,置顶资讯)
 *   - GET /api/news/articles/recommended  已存在(公开,推荐资讯)
 *   - GET /api/models/market              已存在(公开,DB 驱动 zhsAiModelInfo status=1)
 *   - GET /api/news/feed                  已存在(公开,合并置顶+推荐+最新发布)
 *
 * 行为约定:
 *   - fetch 失败/超时/404 → 返回空数组 + console.warn
 *   - 永远不抛出,调用方不需要 try-catch
 *   - 严格使用 apps/web/src/lib/api 的统一鉴权
 */

import { fetchApi } from './api'
import { logger } from './logger'
import {
  fetchAiServiceJson,
  fetchProvidersHealthLite,
  fetchProvidersHealth as fetchProvidersHealthShared,
  fetchProvidersAvailability,
} from '@ihui/api-client'
import type { LlmModel, ProviderHealth } from '@ihui/api-client'
import type { Model } from '../../app/(main)/models/types'

// Provider 健康状态类型(Phase C+D,从共享层 re-export,供模型选择器消费)
export type { ProviderHealth } from '@ihui/api-client'

// ============================================================================
// 类型定义
// ============================================================================

/** /llm/models 动态拉取返回的模型项(带积分倍数,后端非标准格式直接解析) */
export interface SelectorModel extends LlmModel {
  /** 积分消耗倍数(0=免费/1=经济/3=标准/10=高级/30=旗舰,后端 free_provider_registry 推断) */
  points_multiplier?: number
}

/**
 * 拉取可用模型列表(模型选择器数据源)。
 *
 * 2026-08-02 修复:ai-service /llm/models 返回**非标准格式**
 * `{"models":[...], "default":"...", "stub_mode":false}`(无 {code,data} 包装),
 * 共享层 fetchApi 要求 `json.code === 0` 才算成功,缺失 code 字段会被误判为业务失败
 * (success=false)→ fetchModels() throw → 模型选择器降级到 FALLBACK_MODELS(仅 3 个模型)。
 * 故改用 fetchAiServiceJson(直接把响应 body 当作 data,不校验 code 包装)。
 * 失败/空 → 返回空数组(调用方按 fallback 渲染),永不抛出。
 */
export async function fetchSelectorModels(): Promise<SelectorModel[]> {
  try {
    const res = await fetchAiServiceJson<{ models: SelectorModel[] }>('/llm/models', {
      method: 'GET',
    })
    if (!res.success) {
      if (typeof window !== 'undefined') {
        logger.warn('[models-api] fetchSelectorModels 失败', res.error)
      }
      return []
    }
    return res.data?.models ?? []
  } catch (err) {
    if (typeof window !== 'undefined') {
      logger.warn('[models-api] fetchSelectorModels 异常,返回空数组', err)
    }
    return []
  }
}

/** AI 资讯条目(从 newsArticles schema 派生的前端展示型) */
export interface AiNewsItem {
  id: string
  title: string
  summary: string
  cover: string | null
  author: string
  category: string | null
  publishedAt: string | null
  /** 资讯中提到的模型 id 列表(用于在 /models 页面交叉跳转) */
  relatedModelIds: string[]
  /** 资讯来源(用于展示品牌/媒体可信度) */
  source: 'seed-2026-07' | 'api'
}

// ============================================================================
// 模型市场 API(走 /api/models/market 公开路由)
// ============================================================================

/**
 * 拉取模型市场列表(从真实数据源)
 * 优先级:
 *   1. /api/models/market(公开路由,DB 驱动 zhsAiModelInfo)
 *   2. 空数组(让调用方 fallback 到 FALLBACK_MODELS)
 */
export async function getMarketModels(): Promise<Model[]> {
  try {
    const result = await fetchApi<{ models?: Model[]; items?: Model[] }>(
      '/api/models/market?limit=200',
      { next: { revalidate: 300 } } as RequestInit & { next: { revalidate: number } },
    )
    if (result.success) {
      return result.data?.models ?? result.data?.items ?? []
    }
    return []
  } catch (err) {
    if (typeof window !== 'undefined') {
      logger.warn('[models-api] getMarketModels fetch 失败,使用 fallback', err)
    }
    return []
  }
}

// ============================================================================
// AI 资讯 feed(从 newsArticles / pinned / recommended 派生)
// ============================================================================

/**
 * 拉取 AI 资讯(模型广场页顶部"AI 资讯条带"使用)
 * - 优先 /api/news/feed(公开路由,合并置顶+推荐+最新发布)
 * - fallback /api/news/articles/pinned + recommended(已存在,公开)
 * - 全失败 → 返回空数组
 */
export async function getAiNewsFeed(limit = 6): Promise<AiNewsItem[]> {
  // 主路由:合并 feed
  try {
    const r = await fetchApi<{ items: AiNewsItem[] }>(`/api/news/feed?limit=${limit}`, {
      next: { revalidate: 300 },
    } as RequestInit & { next: { revalidate: number } })
    if (r.success && Array.isArray(r.data?.items) && r.data.items.length > 0) {
      return r.data.items
    }
  } catch {
    // 静默
  }

  // fallback:分别拉 pinned + recommended(取并集去重)
  const out: AiNewsItem[] = []
  try {
    const [pinned, recommended] = await Promise.all([
      fetchApi<{ list: Array<ApiArticle> }>('/api/news/articles/pinned', {
        next: { revalidate: 300 },
      } as RequestInit & { next: { revalidate: number } }).catch(() => null),
      fetchApi<{ list: Array<ApiArticle> }>('/api/news/articles/recommended', {
        next: { revalidate: 300 },
      } as RequestInit & { next: { revalidate: number } }).catch(() => null),
    ])

    const map = new Map<string, ApiArticle>()
    if (pinned && pinned.success && pinned.data) {
      for (const a of pinned.data.list ?? []) map.set(String(a.id), a)
    }
    if (recommended && recommended.success && recommended.data) {
      for (const a of recommended.data.list ?? []) map.set(String(a.id), a)
    }

    for (const a of Array.from(map.values()).slice(0, limit)) {
      out.push(toAiNewsItem(a))
    }
  } catch (err) {
    if (typeof window !== 'undefined') {
      logger.warn('[models-api] getAiNewsFeed fallback 失败', err)
    }
  }
  return out
}

// ============================================================================
// 内部:newsArticles schema → AiNewsItem 映射
// ============================================================================

interface ApiArticle {
  id: string | number
  title: string
  summary?: string | null
  coverImage?: string | null
  authorName?: string | null
  categoryName?: string | null
  category?: { name?: string | null } | null
  publishedAt?: string | null
  createdAt?: string | null
}

/** 资讯标题 → 关联模型 id 列表(从 seed 2026-07 真实新闻中提取) */
const TITLE_TO_MODEL_IDS: Array<{ pattern: RegExp; ids: string[] }> = [
  { pattern: /GPT-?5\.6/i, ids: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] },
  { pattern: /Claude Sonnet 5/i, ids: ['claude-sonnet-5'] },
  { pattern: /Kimi K3/i, ids: ['kimi-k3'] },
  { pattern: /Gemini 3\.5 Pro/i, ids: ['gemini-3.5-pro'] },
  { pattern: /Grok 4\.5/i, ids: ['grok-4.5'] },
  { pattern: /DeepSeek V4/i, ids: ['deepseek-v4-pro', 'deepseek-v4-flash'] },
  { pattern: /混元 Hy3/i, ids: ['hunyuan-hy3'] },
  { pattern: /GLM-?5\.2/i, ids: ['glm-5.2'] },
  { pattern: /Qwen3\.7-?Max/i, ids: ['qwen3.7-max'] },
  { pattern: /Ornith-?1\.0/i, ids: ['ornith-1.0'] },
  { pattern: /CodeBrain/i, ids: ['codebrain-1'] },
  { pattern: /MAI-?Thinking/i, ids: ['mai-thinking-1'] },
  { pattern: /Claude Opus 4\.8/i, ids: ['claude-opus-4.8'] },
  { pattern: /GPT-?Red/i, ids: ['gpt-red'] },
]

function inferRelatedModelIds(title: string): string[] {
  const ids = new Set<string>()
  for (const { pattern, ids: list } of TITLE_TO_MODEL_IDS) {
    if (pattern.test(title)) {
      for (const id of list) ids.add(id)
    }
  }
  return Array.from(ids)
}

function toAiNewsItem(a: ApiArticle): AiNewsItem {
  const title = a.title ?? ''
  const categoryName = a.categoryName ?? a.category?.name ?? null
  const publishedAt = a.publishedAt ?? a.createdAt ?? null
  return {
    id: String(a.id),
    title,
    summary: a.summary ?? '',
    cover: a.coverImage ?? null,
    author: a.authorName ?? '',
    category: categoryName,
    publishedAt,
    relatedModelIds: inferRelatedModelIds(title),
    source: 'api',
  }
}

// ============================================================================
// Provider 健康状态(Phase C+D 模型选择器三态徽章)
// ============================================================================

const PROVIDERS_HEALTH_TTL = 30_000 // 30s 缓存,避免模型选择器每次 mount 都打后端
let providersHealthCache: { data: ProviderHealth[]; ts: number } | null = null

/**
 * 拉取 Provider 健康状态(带 30s 缓存,Phase C+D 模型选择器三态徽章用)
 * - 调共享层 fetchProvidersHealthLite(GET /llm/providers/health)
 * - 30s 内复用缓存,避免频繁请求
 * - 失败/超时 → 返回空数组(调用方按"无徽章"渲染,不阻塞选择器)
 */
export async function fetchProvidersHealth(force = false): Promise<ProviderHealth[]> {
  const now = Date.now()
  if (!force && providersHealthCache && now - providersHealthCache.ts < PROVIDERS_HEALTH_TTL) {
    return providersHealthCache.data
  }
  try {
    const data = await fetchProvidersHealthLite()
    providersHealthCache = { data, ts: now }
    return data
  } catch (err) {
    if (typeof window !== 'undefined') {
      logger.warn('[models-api] fetchProvidersHealth 失败,返回空数组', err)
    }
    return []
  }
}

// ============================================================================
// H4 Phase B:Provider 健康状态汇总(模型广场页头 + 网关 Dashboard 消费)
// 4 态:ok / invalid_key / unreachable / not_configured
// 主端点 GET /llm/providers/health(主动预检),降级 GET /llm/providers/availability
// ============================================================================

/** Provider 健康状态(4 态,H4 Phase B) */
export type ProviderHealthStatus = 'ok' | 'invalid_key' | 'unreachable' | 'not_configured'

/** 单个 Provider 的健康信息(H4 Phase B,模型广场页头 + 网关 Dashboard 消费)
 *  基础字段(主端点 + 降级端点都返回):provider/status/latency_ms/model_count
 *  富字段(仅主端点 /llm/providers/health 返回,降级端点缺失):display_name/category/free_quota 等 */
export interface ProviderHealthInfo {
  provider: string
  status: ProviderHealthStatus
  latency_ms?: number
  model_count?: number
  error?: string
  /** 最后检测时间(ISO 字符串) */
  last_check?: string
  // 富字段(可选,仅主端点返回)
  display_name?: string
  category?: 'domestic' | 'international' | 'local' | 'credits'
  free_quota?: string
  is_in_cooldown?: boolean
  consecutive_failures?: number
}

/** Provider 健康状态汇总响应(H4 Phase B) */
export interface ProvidersHealthResponse {
  providers: ProviderHealthInfo[]
  total: number
  healthy_count: number
  /** 最后检测时间(ISO 字符串,取 providers 中最新的 last_check 或后端 checked_at) */
  checked_at: string
}

const PROVIDERS_HEALTH_SUMMARY_TTL = 30_000 // 30s SWR 缓存
let providersHealthSummaryCache: { data: ProvidersHealthResponse; ts: number } | null = null

/** 10s 超时包装(共享层 fetchProvidersHealth 不接受 AbortSignal,用 Promise.race 兜底) */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** 把 ProviderAvailabilityStatus(7 态)归并到 ProviderHealthStatus(4 态) */
function mapAvailabilityStatus(status: string, errorType: string): ProviderHealthStatus {
  if (
    status === 'healthy' ||
    status === 'degraded' ||
    status === 'local' ||
    status === 'zero_cost'
  ) {
    return 'ok'
  }
  if (status === 'not_configured' || status === 'pending') {
    return 'not_configured'
  }
  if (errorType === 'invalid_key' || errorType === 'forbidden') {
    return 'invalid_key'
  }
  if (status === 'down') {
    return errorType === 'invalid_key' || errorType === 'forbidden' ? 'invalid_key' : 'unreachable'
  }
  return 'unreachable'
}

/** 把 /llm/providers/availability 响应转换为 ProvidersHealthResponse */
function transformAvailabilityToHealth(
  avail: Awaited<ReturnType<typeof fetchProvidersAvailability>>,
): ProvidersHealthResponse {
  const providers: ProviderHealthInfo[] = avail.providers.map((p) => ({
    provider: p.provider_code,
    status: mapAvailabilityStatus(p.status, p.error_type),
    latency_ms: p.latency_ms,
    model_count: undefined, // availability 端点不返回 model_count
    error: p.error || undefined,
    last_check: p.last_check ? new Date(p.last_check * 1000).toISOString() : undefined,
  }))
  const healthyCount = providers.filter((p) => p.status === 'ok').length
  const checkedAt =
    providers
      .map((p) => p.last_check ?? '')
      .sort()
      .reverse()[0] || new Date().toISOString()
  return {
    providers,
    total: providers.length,
    healthy_count: healthyCount,
    checked_at: checkedAt,
  }
}

/** 把共享层 ProvidersHealthResult 转换为 ProvidersHealthResponse */
function transformHealthResultToResponse(
  result: Awaited<ReturnType<typeof fetchProvidersHealthShared>>,
): ProvidersHealthResponse {
  const providers: ProviderHealthInfo[] = result.providers.map((p) => ({
    provider: p.provider,
    status:
      p.status === 'ok' || p.status === 'invalid_key' || p.status === 'unreachable'
        ? p.status
        : 'not_configured',
    latency_ms: p.latency_ms,
    model_count: p.model_count,
    last_check: p.last_check,
    display_name: p.display_name,
    category: p.category,
    free_quota: p.free_quota,
    is_in_cooldown: p.is_in_cooldown,
    consecutive_failures: p.consecutive_failures,
  }))
  const checkedAt =
    providers
      .map((p) => p.last_check ?? '')
      .sort()
      .reverse()[0] || new Date().toISOString()
  return {
    providers,
    total: result.summary.total,
    healthy_count: result.summary.ok,
    checked_at: checkedAt,
  }
}

/**
 * 拉取 Provider 健康状态汇总(H4 Phase B,模型广场页头 + 网关 Dashboard 消费)
 * - 主端点 GET /llm/providers/health(主动预检,返回 4 态 + 富字段)
 * - 降级端点 GET /llm/providers/availability(余额/错误细分,转换为 4 态)
 * - 10s 超时(Promise.race 兜底,共享层不支持 AbortSignal)
 * - 30s stale-while-revalidate 缓存:命中缓存直接返回,失败时回退到 stale cache
 * - force=true 跳过缓存(手动"重新检测"按钮用)
 * - 两端点都失败且无缓存 → 抛错(调用方按"不可用"渲染)
 */
export async function fetchProvidersHealthSummary(force = false): Promise<ProvidersHealthResponse> {
  const now = Date.now()
  if (
    !force &&
    providersHealthSummaryCache &&
    now - providersHealthSummaryCache.ts < PROVIDERS_HEALTH_SUMMARY_TTL
  ) {
    return providersHealthSummaryCache.data
  }

  try {
    // 主端点:/llm/providers/health(共享层 fetchProvidersHealth,返回 ProvidersHealthResult)
    const result = await withTimeout(fetchProvidersHealthShared(), 10_000)
    const response = transformHealthResultToResponse(result)
    providersHealthSummaryCache = { data: response, ts: now }
    return response
  } catch (primaryErr) {
    if (typeof window !== 'undefined') {
      logger.warn(
        '[models-api] fetchProvidersHealthSummary 主端点失败,降级 availability',
        primaryErr,
      )
    }
    try {
      // 降级端点:/llm/providers/availability
      const avail = await withTimeout(fetchProvidersAvailability(), 10_000)
      const response = transformAvailabilityToHealth(avail)
      providersHealthSummaryCache = { data: response, ts: now }
      return response
    } catch (fallbackErr) {
      // 两端点都失败:返回 stale cache(如果有),否则抛错
      if (providersHealthSummaryCache) {
        if (typeof window !== 'undefined') {
          logger.warn(
            '[models-api] fetchProvidersHealthSummary 降级也失败,返回 stale cache',
            fallbackErr,
          )
        }
        return providersHealthSummaryCache.data
      }
      throw fallbackErr
    }
  }
}
