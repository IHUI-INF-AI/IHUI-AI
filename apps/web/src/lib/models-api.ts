/**
 * 模型广场 / AI 资讯 API 客户端
 *
 * 目标:把 /models 页面从"helpers.ts 写死数据"升级为"消费 seed 2026-07 真实数据"
 * 同时为后续 backend 路由补全预留 fetch 接口,带 graceful fallback。
 *
 * 后端路由(2026-07 当前可用 / 计划):
 *   - GET /api/llm/models                 已存在(需 auth,代理 ai-service,旧 fetchModels 走它)
 *   - GET /api/llm/list                   已存在(DB 驱动,20 字段格式)
 *   - GET /api/news/articles/pinned       已存在(公开,置顶资讯)
 *   - GET /api/news/articles/recommended  已存在(公开,推荐资讯)
 *   - GET /api/models/market              TODO:后端尚未实现,后续 backend 任务补
 *   - GET /api/news/feed                  TODO:后端尚未实现,后续 backend 任务补
 *
 * 行为约定:
 *   - fetch 失败/超时/404 → 返回空数组 + console.warn
 *   - 永远不抛出,调用方不需要 try-catch
 *   - 严格使用 apps/web/src/lib/api 的统一鉴权
 */

import { fetchApi } from './api'
import type { Model } from '../../app/(main)/models/types'

// ============================================================================
// 类型定义
// ============================================================================

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
// 模型市场 API(主要走现有 /api/llm/models;预留 /api/models/market 未来升级)
// ============================================================================

/**
 * 拉取模型市场列表(从真实数据源)
 * 优先级:
 *   1. /api/models/market(2026 计划路由,后端尚未实现)
 *   2. /api/llm/models(现有路由,需要 auth,失败率高)
 *   3. 空数组(让调用方 fallback 到 FALLBACK_MODELS)
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
    // 后端 404 路由不存在 → 静默失败,返回空让调用方 fallback
    return []
  } catch (err) {
    // console.warn 而非 console.error:API 尚未实现属预期内,不需要污染日志
    if (typeof window !== 'undefined') {
      console.warn('[models-api] getMarketModels /api/models/market 尚未实现,使用 fallback', err)
    }
    return []
  }
}

// ============================================================================
// AI 资讯 feed(从 newsArticles / pinned / recommended 派生)
// ============================================================================

/**
 * 拉取 AI 资讯(模型广场页顶部"AI 资讯条带"使用)
 * - 优先 /api/news/feed(计划路由,2026 后续 backend 任务)
 * - fallback /api/news/articles/pinned + recommended(已存在,公开)
 * - 全失败 → 返回空数组
 */
export async function getAiNewsFeed(limit = 6): Promise<AiNewsItem[]> {
  // 计划路由
  try {
    const r = await fetchApi<{ items: AiNewsItem[] }>(
      `/api/news/feed?limit=${limit}`,
      { next: { revalidate: 300 } } as RequestInit & { next: { revalidate: number } },
    )
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
      console.warn('[models-api] getAiNewsFeed fallback 失败', err)
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
