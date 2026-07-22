/**
 * Context Engine 服务 — 多维 @ 提及检索后端核心。
 *
 * 职责:
 * 1. symbol 检索:复用 in-process codebaseIndexService(pgvector 语义搜索)→ 返回符号定位
 * 2. database schema 查询:用 drizzle db.execute 查 information_schema(表清单 + 列定义)
 * 3. folder 扫描:用 node:fs 扫描工作区目录(限深度 2 层防爆炸)
 * 4. file 检索:委托 file-queries.findRecentFiles(按 q 过滤)
 * 5. enrich:两层集成(@ 提及 + RAG 检索),委托 ai-service /api/context/enrich(2026-07-22 立)
 * 6. sources:查询可用上下文源类型 + 预算分配,委托 ai-service /api/context/sources
 *
 * 性能:检索结果带 LRU 缓存(Map<key, {ts, data}>,TTL 60s,容量 100 条)。
 *
 * 跨服务说明:task 约定 "调 ai-service /v1/codebase/search",但该路由实际由
 * apps/api 自身承载(v1-codebase-search.ts),ai-service codebase_indexer 反向调用本服务。
 * 因此 symbol 检索直接复用 in-process codebaseIndexService,避免 HTTP 自调用回环。
 *
 * 降级:enrich/getSources 调 ai-service 失败时,退化为本地逻辑(仅 @ 提及内容 / 内置源定义)。
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { codebaseIndexService } from './codebase-index-service.js'
import { findRecentFiles } from '../db/file-queries.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import type {
  ContextMention,
  DatabaseColumn,
  DatabaseSchemaResult,
  FolderEntry,
  MentionType,
  SymbolSearchItem,
} from '@ihui/types'

/** 上下文源类型(history/codebase/mention/web/database,2026-07-22 立) */
export type ContextSourceType = 'history' | 'codebase' | 'mention' | 'web' | 'database'

/** 单条上下文源定义(供前端展示源类型 + 预算占比) */
export interface ContextSource {
  type: ContextSourceType
  label: string
  budgetRatio: number
  description: string
}

/** 增强后的上下文条目(由 ai-service /api/context/enrich 返回) */
export interface EnrichedContextSource {
  type: string
  content: string
  relevance: number
  source: string
  metadata?: Record<string, unknown>
  /** 行为 boost 加成(2026-07-22 深化立,可选) */
  behavior_boost?: number
}

/** enrich 方法返回结构 */
export interface EnrichedContext {
  /** 拼接后的上下文文本(供 LLM 注入) */
  enrichedContext: string
  /** enrichedContext 的 token 数 */
  tokenCount: number
  /** 各源条目明细(供前端展示) */
  sources: EnrichedContextSource[]
  /** 会话 ID */
  conversationId: string
  /** 检测到的任务类型(2026-07-22 深化立:code/chat/data/default) */
  taskType?: string
}

/** getSources 方法返回结构 */
export interface ContextSourcesResult {
  sources: ContextSource[]
  defaultBudget: number
}

/** enrich 方法请求参数 */
export interface EnrichOptions {
  /** 用户当前消息(作为 RAG 检索 query,空字符串时跳过 RAG) */
  userMessage: string
  /** 会话 ID */
  conversationId: string
  /** 当前 @ 提及结果列表 */
  mentions: ContextMention[]
  /** 当前会话消息历史(可选,提供时启用 history RAG) */
  messages?: Array<{ role: string; content: string }>
  /** 总 token 预算(默认 8000) */
  totalBudget?: number
  /** 用户 ID(2026-07-22 深化立,行为学习 + 偏好持久化 key) */
  userId?: string
}

/** token 可视化饼图单项(2026-07-22 深化立) */
export interface VisualizationPieItem {
  source: string
  tokens: number
}

/** token 可视化历史趋势点(2026-07-22 深化立) */
export interface VisualizationTrendPoint {
  timestamp: number
  total_tokens: number
  history_tokens: number
  codebase_tokens: number
  mention_tokens: number
  web_tokens: number
  database_tokens: number
}

/** 压缩事件(2026-07-22 深化立) */
export interface CompressionEvent {
  timestamp: number
  conversation_id: string
  tokens_before: number
  tokens_after: number
  compression_ratio: number
  quality_score: number
  removed_count: number
}

/** GET /visualization 返回结构(2026-07-22 深化立) */
export interface VisualizationResult {
  /** 最新一条的源分布饼图 */
  pie: VisualizationPieItem[]
  /** 历史趋势(时间正序) */
  trend: VisualizationTrendPoint[]
  /** 最近 10 次压缩事件 */
  compressions: CompressionEvent[]
}

/** POST /visualization/track 请求参数(2026-07-22 深化立) */
export interface TrackVisualizationOptions {
  conversationId: string
  totalTokens: number
  historyTokens: number
  codebaseTokens: number
  mentionTokens: number
  webTokens: number
  databaseTokens: number
}

/** GET /compression-stats 返回结构(2026-07-22 深化立) */
export interface CompressionStatsResult {
  totalEvents: number
  avgCompressionRatio: number
  avgQualityScore: number
  recentEvents: CompressionEvent[]
}

/** 用户偏好单项(2026-07-22 深化立) */
export interface UserPreferenceItem {
  key: string
  count: number
}

/** GET /memory 返回结构(2026-07-22 深化立) */
export interface SessionMemoryResult {
  conversationId: string
  summary: string
  preferences: UserPreferenceItem[]
}

/** DELETE /memory 返回结构(2026-07-22 深化立) */
export interface ClearMemoryResult {
  cleared: boolean
}

/** LRU 缓存条目 */
interface CacheEntry<T> {
  ts: number
  data: T
}

const CACHE_TTL_MS = 60_000
const CACHE_MAX = 100

class LRUCache<K, V> {
  private map = new Map<K, CacheEntry<V>>()

  get(key: K): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      this.map.delete(key)
      return undefined
    }
    // 重插到末尾(LRU 顺序)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.data
  }

  set(key: K, value: V): void {
    if (this.map.size >= CACHE_MAX) {
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
    this.map.set(key, { ts: Date.now(), data: value })
  }
}

/** 数据库表清单行(information_schema.tables) */
interface TableRow {
  table_name: string
}

/** 数据库列定义行(information_schema.columns) */
interface ColumnRow {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  'dist',
  'build',
  '.vite',
  '.cache',
  'venv',
  '.venv',
  'env',
  '.env',
  '$RECYCLE.BIN',
  '.next',
  '.turbo',
  'coverage',
])

class ContextEngineService {
  private cache = new LRUCache<string, unknown>()

  /** 统一检索入口(按 type 分发) */
  async search(opts: {
    query: string
    type: MentionType
    userId: string
    workspacePath?: string
    limit?: number
  }): Promise<ContextMention[]> {
    const { query, type, userId, workspacePath, limit = 20 } = opts
    const cacheKey = `${type}:${userId}:${workspacePath ?? ''}:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached

    let result: ContextMention[]
    switch (type) {
      case 'file':
        result = await this.searchFiles(query, userId, limit)
        break
      case 'database':
        result = await this.searchDatabaseTables(query, limit)
        break
      case 'symbol': {
        const symbols = await this.searchSymbols(query, limit)
        result = symbols.map((s) => ({
          id: `symbol:${s.symbolName}:${s.filePath}:${s.lineStart ?? 0}`,
          type: 'symbol' as const,
          label: s.symbolName,
          detail: `${s.symbolType} · ${s.filePath}${s.lineStart ? `:${s.lineStart}` : ''}`,
          insertText: `@symbol:${s.symbolName}`,
          meta: {
            symbolName: s.symbolName,
            symbolType: s.symbolType as 'class' | 'function' | 'interface' | 'type' | 'variable',
            filePath: s.filePath,
            lineStart: s.lineStart,
            lineEnd: s.lineEnd,
          },
        }))
        break
      }
      case 'folder':
        result = await this.searchFolders(query, workspacePath, limit)
        break
      case 'web':
        // web 检索为可选项,不强求;返回空数组(前端可走浏览器侧 WebSearch)
        result = []
        break
      default:
        result = []
    }
    this.cache.set(cacheKey, result)
    return result
  }

  /** file 检索:查最近文件,按 q 过滤 */
  private async searchFiles(
    query: string,
    userId: string,
    limit: number,
  ): Promise<ContextMention[]> {
    try {
      const files = await findRecentFiles(userId, Math.max(limit * 3, 50))
      const q = query.trim().toLowerCase()
      const filtered = q
        ? files.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.path.toLowerCase().includes(q),
          )
        : files
      return filtered.slice(0, limit).map((f) => ({
        id: `file:${f.id}`,
        type: 'file' as const,
        label: f.name,
        detail: f.path,
        insertText: `@${f.path}`,
        meta: { path: f.path },
      }))
    } catch {
      return []
    }
  }

  /** database 检索:查 information_schema.tables,按 q 过滤表名 */
  async searchDatabaseTables(query: string, limit: number): Promise<ContextMention[]> {
    const q = query.trim().toLowerCase()
    const cacheKey = `db:tables:${q}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached
    try {
      const rows = (await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ${q ? sql`AND table_name ILIKE ${'%' + q + '%'}` : sql``}
        ORDER BY table_name
        LIMIT ${limit}
      `)) as unknown as TableRow[]
      const result: ContextMention[] = rows.map((r) => ({
        id: `database:${r.table_name}`,
        type: 'database' as const,
        label: r.table_name,
        detail: '数据表',
        insertText: `@table:${r.table_name}`,
        meta: { tableName: r.table_name },
      }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** database schema 查询:返回指定表的列定义 */
  async getTableSchema(tableName: string): Promise<DatabaseSchemaResult> {
    const cacheKey = `db:schema:${tableName}`
    const cached = this.cache.get(cacheKey) as DatabaseSchemaResult | undefined
    if (cached) return cached
    try {
      const rows = (await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${tableName}
        ORDER BY ordinal_position
      `)) as unknown as ColumnRow[]
      const columns: DatabaseColumn[] = rows.map((r) => ({
        columnName: r.column_name,
        dataType: r.data_type,
        isNullable: r.is_nullable === 'YES',
        columnDefault: r.column_default,
      }))
      const result: DatabaseSchemaResult = { tableName, columns }
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return { tableName, columns: [] }
    }
  }

  /** symbol 检索:复用 codebaseIndexService 语义搜索(pgvector ANN) */
  async searchSymbols(query: string, limit: number): Promise<SymbolSearchItem[]> {
    if (!query.trim()) return []
    const cacheKey = `symbol:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as SymbolSearchItem[] | undefined
    if (cached) return cached
    try {
      const chunks = await codebaseIndexService.search({
        query,
        topK: limit,
      })
      const result: SymbolSearchItem[] = chunks
        .filter((c) => c.symbolName)
        .map((c) => ({
          symbolName: c.symbolName ?? '',
          symbolType: c.symbolType ?? 'function',
          filePath: c.filePath,
          lineStart: c.lineStart,
          lineEnd: c.lineEnd,
          content: c.content,
          score: c.score,
        }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** folder 扫描:用 fs 扫描工作区目录(限深度 2 层防爆炸) */
  async searchFolders(
    query: string,
    workspacePath: string | undefined,
    limit: number,
  ): Promise<ContextMention[]> {
    if (!workspacePath) return []
    const cacheKey = `folder:${workspacePath}:${query}:${limit}`
    const cached = this.cache.get(cacheKey) as ContextMention[] | undefined
    if (cached) return cached
    try {
      const entries = this.scanFolders(workspacePath, 2)
      const q = query.trim().toLowerCase()
      const filtered = q
        ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q))
        : entries
      const result: ContextMention[] = filtered
        .slice(0, limit)
        .map((e) => ({
          id: `folder:${e.path}`,
          type: 'folder' as const,
          label: e.name,
          detail: relative(workspacePath, e.path).split(sep).join('/'),
          insertText: `@${relative(workspacePath, e.path).split(sep).join('/')}/`,
          meta: { path: e.path },
        }))
      this.cache.set(cacheKey, result)
      return result
    } catch {
      return []
    }
  }

  /** 递归扫描目录(限深度),只返回目录条目 */
  private scanFolders(root: string, maxDepth: number): FolderEntry[] {
    const result: FolderEntry[] = []
    const walk = (dir: string, depth: number) => {
      if (depth > maxDepth) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      for (const name of entries) {
        if (IGNORE_DIRS.has(name)) continue
        const full = join(dir, name)
        let st
        try {
          st = statSync(full)
        } catch {
          continue
        }
        if (st.isDirectory()) {
          result.push({ name, path: full, isDirectory: true })
          walk(full, depth + 1)
        }
      }
    }
    walk(root, 0)
    return result
  }

  /**
   * 两层集成入口:@ 提及结果 + RAG 检索(2026-07-22 立,2026-07-22 深化)。
   *
   * 委托 ai-service POST /api/context/enrich:
   * - mentions 作为额外 RAG 数据源注入检索池(relevance=1.0,用户显式选择)
   * - symbol 提及注入完整 AST 签名 + docstring(2026-07-22 深化立)
   * - @ 提及触发用户行为学习(_record_user_behavior,2026-07-22 深化立)
   * - ai-service 调 retrieve_and_enrich 检索 history + codebase 上下文
   * - _merge_context 多源融合(去重 + relevance DESC 排序 + token 截断 + behavior_boost)
   *
   * 降级:ai-service 不可用 / HTTP 错误 / 响应异常 → 退化为本地拼接
   *      (仅 @ 提及内容,无 RAG 检索),保证链路不报错。
   */
  async enrich(opts: EnrichOptions): Promise<EnrichedContext> {
    const {
      userMessage,
      conversationId,
      mentions,
      messages = [],
      totalBudget = 8000,
      userId = '',
    } = opts

    try {
      const resp = await aiServiceFetch(null, '/api/context/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mentions,
          conversationId,
          query: userMessage,
          messages,
          totalBudget,
          userId,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service /api/context/enrich HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as { code: number; data?: EnrichedContext }
      if (json.code === 0 && json.data) {
        return json.data
      }
      throw new Error(`ai-service /api/context/enrich 返回 code=${json.code}`)
    } catch {
      // 降级:仅用 @ 提及内容拼接(无 RAG 检索)
      return this._fallbackEnrich(mentions, conversationId)
    }
  }

  /**
   * 查询可用上下文源类型 + 预算分配(2026-07-22 立)。
   *
   * 委托 ai-service GET /api/context/sources:
   * - 返回 5 个源类型(history/codebase/mention/web/database)+ budgetRatio + description
   * - 返回 defaultBudget(默认 8000)
   *
   * 降级:ai-service 不可用时返回内置默认值(与 ai-service 端常量同步)。
   */
  async getSources(): Promise<ContextSourcesResult> {
    try {
      const resp = await aiServiceFetch(null, '/api/context/sources', {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service /api/context/sources HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as {
        code: number
        data?: ContextSourcesResult
      }
      if (json.code === 0 && json.data) {
        return json.data
      }
      throw new Error(`ai-service /api/context/sources 返回 code=${json.code}`)
    } catch {
      // 降级:返回内置默认值(与 ai-service SOURCE_BUDGET_RATIOS 同步)
      return {
        sources: [
          {
            type: 'history',
            label: '历史对话',
            budgetRatio: 0.4,
            description: '本会话 + 跨会话历史消息 RAG(embedding 相似度检索)',
          },
          {
            type: 'codebase',
            label: '代码库',
            budgetRatio: 0.3,
            description: 'codebase_indexer 语义检索代码 chunk(跨会话 RAG)',
          },
          {
            type: 'mention',
            label: '@ 提及',
            budgetRatio: 0.2,
            description: '用户显式 @ 提及的 file/database/symbol/folder/web',
          },
          {
            type: 'web',
            label: 'Web 搜索',
            budgetRatio: 0.05,
            description: '外部 Web 搜索结果(可选项)',
          },
          {
            type: 'database',
            label: 'DB Schema',
            budgetRatio: 0.05,
            description: '数据库表结构定义(information_schema)',
          },
        ],
        defaultBudget: 8000,
      }
    }
  }

  /** 降级:仅用 @ 提及内容拼接 enrichedContext(无 RAG 检索) */
  private _fallbackEnrich(
    mentions: ContextMention[],
    conversationId: string,
  ): EnrichedContext {
    const sources: EnrichedContextSource[] = mentions.map((m) => ({
      type: 'mention',
      content: this._mentionToText(m),
      relevance: 1.0,
      source: `mention:${m.type}`,
      metadata: {
        mention_type: m.type,
        label: m.label,
        insert_text: m.insertText,
      },
    }))
    const enrichedContext = sources
      .map((s) => `[${s.source}]\n${s.content}`)
      .join('\n\n')
    // 粗略 token 估算(中文 ~1.5 char/token,英文 ~4 char/token,取 3.5 折中)
    const tokenCount = Math.max(1, Math.ceil(enrichedContext.length / 3.5))
    return { enrichedContext, tokenCount, sources, conversationId }
  }

  /** @ 提及条目 → 可注入文本(降级路径专用,与 ai-service _mention_to_content 同构) */
  private _mentionToText(m: ContextMention): string {
    const meta = m.meta ?? {}
    switch (m.type) {
      case 'file':
        return `文件: ${m.label}\n路径: ${meta.path ?? m.detail ?? ''}`.trim()
      case 'folder':
        return `目录: ${m.label}\n路径: ${meta.path ?? m.detail ?? ''}`.trim()
      case 'database':
        return `数据表: ${meta.tableName ?? m.label}\n${m.detail ?? ''}`.trim()
      case 'symbol': {
        const symName = meta.symbolName ?? m.label
        const symType = meta.symbolType ?? ''
        const filePath = meta.filePath ?? ''
        const line = meta.lineStart ?? ''
        return `符号: ${symName}(${symType})\n文件: ${filePath}:${line}`.trim()
      }
      case 'web':
        return `Web: ${m.label}\nURL: ${meta.url ?? ''}`.trim()
      default:
        return `${m.type}: ${m.label}`.trim()
    }
  }

  /**
   * 记录当前会话 token 分布(2026-07-22 深化立)。
   *
   * 委托 ai-service POST /api/context/visualization/track:
   * - 前端定期调用,记录 history/codebase/mention/web/database 各源 token 占用
   * - ai-service 写入 Redis list "context:viz:{conversationId}"(LPUSH + LTRIM 100 条)
   *
   * 降级:ai-service 不可用时静默忽略(可视化数据非关键路径)。
   */
  async trackVisualization(opts: TrackVisualizationOptions): Promise<boolean> {
    try {
      const resp = await aiServiceFetch(null, '/api/context/visualization/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) return false
      const json = (await resp.json()) as { code: number }
      return json.code === 0
    } catch {
      return false
    }
  }

  /**
   * 获取可视化数据(2026-07-22 深化立)。
   *
   * 委托 ai-service GET /api/context/visualization:
   * - pie: 最新一条的源分布饼图(history/codebase/mention/web/database token 数)
   * - trend: 历史趋势(时间正序,最多 100 条)
   * - compressions: 最近 10 次压缩事件(timestamp/before/after/ratio/quality)
   *
   * 降级:ai-service 不可用时返回空结构。
   */
  async getVisualization(
    conversationId: string,
    userId: string = '',
  ): Promise<VisualizationResult> {
    try {
      const params = new URLSearchParams()
      if (conversationId) params.set('conversationId', conversationId)
      if (userId) params.set('userId', userId)
      const qs = params.toString()
      const path = `/api/context/visualization${qs ? `?${qs}` : ''}`
      const resp = await aiServiceFetch(null, path, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service /api/context/visualization HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as {
        code: number
        data?: VisualizationResult
      }
      if (json.code === 0 && json.data) {
        return json.data
      }
      throw new Error(`ai-service /api/context/visualization 返回 code=${json.code}`)
    } catch {
      return { pie: [], trend: [], compressions: [] }
    }
  }

  /**
   * 获取压缩统计(2026-07-22 深化立)。
   *
   * 委托 ai-service GET /api/context/compression-stats:
   * - totalEvents: 事件总数
   * - avgCompressionRatio: 平均压缩比
   * - avgQualityScore: 平均质量分(LLM 评估)
   * - recentEvents: 最近 10 次压缩详情
   *
   * 降级:ai-service 不可用时返回空统计。
   */
  async getCompressionStats(userId: string = ''): Promise<CompressionStatsResult> {
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ''
      const path = `/api/context/compression-stats${qs}`
      const resp = await aiServiceFetch(null, path, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service /api/context/compression-stats HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as {
        code: number
        data?: CompressionStatsResult
      }
      if (json.code === 0 && json.data) {
        return json.data
      }
      throw new Error(`ai-service /api/context/compression-stats 返回 code=${json.code}`)
    } catch {
      return {
        totalEvents: 0,
        avgCompressionRatio: 0,
        avgQualityScore: 0,
        recentEvents: [],
      }
    }
  }

  /**
   * 获取会话记忆(summary + 用户偏好,2026-07-22 深化立)。
   *
   * 委托 ai-service GET /api/context/memory:
   * - summary: 上次压缩的 summary(跨会话记忆)
   * - preferences: 用户长期偏好(常访问的文件/符号,按访问次数倒序)
   *
   * 降级:ai-service 不可用时返回空结构。
   */
  async getSessionMemory(
    conversationId: string,
    userId: string = '',
  ): Promise<SessionMemoryResult> {
    try {
      const params = new URLSearchParams()
      if (conversationId) params.set('conversationId', conversationId)
      if (userId) params.set('userId', userId)
      const qs = params.toString()
      const path = `/api/context/memory${qs ? `?${qs}` : ''}`
      const resp = await aiServiceFetch(null, path, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service /api/context/memory HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as {
        code: number
        data?: SessionMemoryResult
      }
      if (json.code === 0 && json.data) {
        return json.data
      }
      throw new Error(`ai-service /api/context/memory 返回 code=${json.code}`)
    } catch {
      return { conversationId, summary: '', preferences: [] }
    }
  }

  /**
   * 清除会话记忆(2026-07-22 深化立)。
   *
   * 委托 ai-service DELETE /api/context/memory:
   * - 删除 Redis hash "context:summary:{conversationId}"
   *
   * 降级:ai-service 不可用时返回 false。
   */
  async clearSessionMemory(conversationId: string): Promise<boolean> {
    try {
      const qs = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''
      const path = `/api/context/memory${qs}`
      const resp = await aiServiceFetch(null, path, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5_000),
      })
      if (!resp.ok) {
        throw new Error(`ai-service DELETE /api/context/memory HTTP ${resp.status}`)
      }
      const json = (await resp.json()) as { code: number; data?: ClearMemoryResult }
      if (json.code === 0 && json.data) {
        return json.data.cleared
      }
      return false
    } catch {
      return false
    }
  }
}

export const contextEngineService = new ContextEngineService()
