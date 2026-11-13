// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** ElasticSearch 全文检索服务 - 大数据量表启用 ES 索引,PostgreSQL 兜底(迁移自 edu service search-service) */

import { and, asc, desc, eq, gt, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { searchContents } from '@ihui/database'
import { logger } from '../utils/logger.js'

// =============================================================================
// 类型定义
// =============================================================================

export type SearchTable = 'articles' | 'news' | 'resources' | 'asks' | 'all'

export interface SearchOptions {
  query: string
  table?: SearchTable
  page?: number
  pageSize?: number
  filters?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  table: string
  title: string
  content: string
  score: number
  highlights?: string[]
}

export interface SearchResponse {
  total: number
  results: SearchResult[]
  source: 'elasticsearch' | 'postgres'
  took_ms: number
}

// =============================================================================
// 表名 ↔ searchContents.topicType 映射(articles/news/resources/asks 对应枚举值)
// =============================================================================

const TABLE_TO_TOPIC_TYPE: Record<
  Exclude<SearchTable, 'all'>,
  'article' | 'news' | 'question' | 'resource'
> = {
  articles: 'article',
  news: 'news',
  resources: 'resource',
  asks: 'question',
}

const TOPIC_TYPE_TO_TABLE: Record<'article' | 'news' | 'question' | 'resource' | 'lesson', string> =
  {
    article: 'articles',
    news: 'news',
    question: 'asks',
    resource: 'resources',
    lesson: 'lessons',
  }

// =============================================================================
// ES 索引配置
// =============================================================================

const ES_INDEX_NAME = process.env.ELASTICSEARCH_INDEX ?? 'ihui-search-contents'
const ES_DOC_TYPE = 'search_content'
const REINDEX_BATCH_SIZE = 500

// @elastic/elasticsearch 为可选依赖(未安装时降级到 PostgreSQL),
// 此处定义最小接口描摹供类型检查,避免使用 any
interface EsSearchHits {
  total?: { value?: number } | number
  hits?: Array<Record<string, unknown>>
}
interface EsClient {
  ping(): Promise<unknown>
  search(params: {
    index: string
    body: unknown
  }): Promise<{ body?: { hits?: EsSearchHits }; hits?: EsSearchHits }>
  index(params: { index: string; id: string; body: unknown }): Promise<unknown>
  bulk(params: { body: unknown[] }): Promise<{ body?: { errors?: boolean }; errors?: boolean }>
  count(params: { index: string }): Promise<{ body?: { count?: number }; count?: number }>
  indices: {
    delete(params: { index: string; ignore_unavailable?: boolean }): Promise<unknown>
    create(params: { index: string; body?: unknown }): Promise<unknown>
    refresh(params: { index: string }): Promise<unknown>
    exists(params: { index: string }): Promise<boolean>
    existsAlias(params: { name: string }): Promise<boolean>
    getAlias(params: { name: string }): Promise<unknown>
    updateAliases(params: { body: { actions: Array<Record<string, unknown>> } }): Promise<unknown>
  }
}

// =============================================================================
// SearchEsService 单例
// =============================================================================

export class SearchEsService {
  /** ES 客户端实例(动态 import,失败为 null) */
  private esClient: EsClient | null = null
  /** ES 客户端初始化 Promise(避免并发重复初始化) */
  private esClientInitPromise: Promise<void> | null = null
  /** 是否启用 ES(基于 ELASTICSEARCH_URL 环境变量) */
  private enabled: boolean

  constructor() {
    this.enabled = !!process.env.ELASTICSEARCH_URL
    if (this.enabled) {
      // 异步初始化(不阻塞构造,后台进行)
      this.esClientInitPromise = this.initEsClient()
    }
  }

  /** 动态 import @elastic/elasticsearch,失败降级(不强制依赖) */
  private async initEsClient(): Promise<void> {
    try {
      // @ts-expect-error - @elastic/elasticsearch 为可选依赖,未安装时运行时 try/catch 降级到 PostgreSQL
      const mod = await import('@elastic/elasticsearch')
      const Client = mod.Client ?? mod.default?.Client
      if (!Client) throw new Error('@elastic/elasticsearch Client not found')
      // Basic Auth 可选:两个键都填才生效(留空则按无认证连接,或由 URL 内嵌凭据)
      const esUsername = process.env.ELASTICSEARCH_USERNAME
      const esPassword = process.env.ELASTICSEARCH_PASSWORD
      this.esClient = new Client({
        node: process.env.ELASTICSEARCH_URL,
        ...(esUsername && esPassword
          ? { auth: { username: esUsername, password: esPassword } }
          : {}),
        requestTimeout: 5000,
        maxRetries: 3,
      })
      // 探活:失败则置 null 降级
      await this.esClient!.ping()
    } catch {
      this.esClient = null
    }
  }

  /** 等待 ES 客户端初始化完成(若进行中) */
  private async ensureClientReady(): Promise<void> {
    if (this.esClientInitPromise) await this.esClientInitPromise
  }

  /** ES 是否真实可用(已配置 + 客户端已就绪) */
  isEsEnabled(): boolean {
    return this.enabled && this.esClient !== null
  }

  /** 配置层是否启用(env 标志位,与客户端就绪无关) */
  isEsConfigured(): boolean {
    return this.enabled
  }

  // ===========================================================================
  // 主入口:搜索
  // ===========================================================================

  async search(opts: SearchOptions): Promise<SearchResponse> {
    const start = Date.now()
    await this.ensureClientReady()

    if (this.isEsEnabled()) {
      try {
        return await this.searchEs(opts, start)
      } catch {
        // ES 查询失败 → 降级到 PostgreSQL
      }
    }
    return await this.searchPostgres(opts, start)
  }

  // ===========================================================================
  // ES 检索:multi_match + highlight + filter
  // ===========================================================================

  private async searchEs(opts: SearchOptions, start: number): Promise<SearchResponse> {
    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20))
    const from = (page - 1) * pageSize

    const filter: Array<Record<string, unknown>> = []
    if (opts.table && opts.table !== 'all') {
      const topicType = TABLE_TO_TOPIC_TYPE[opts.table]
      if (topicType) filter.push({ term: { topicType } })
    }
    // 额外 filters(预留扩展:authorId / viewCount 等)
    if (opts.filters && typeof opts.filters === 'object') {
      for (const [k, v] of Object.entries(opts.filters)) {
        if (v !== undefined && v !== null) filter.push({ term: { [k]: v } })
      }
    }

    const body = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: opts.query,
                fields: ['topicTitle^3', 'topicSummary^2', 'searchText'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
          filter: filter.length > 0 ? filter : undefined,
        },
      },
      highlight: {
        fields: {
          topicTitle: { number_of_fragments: 1, fragment_size: 120 },
          topicSummary: { number_of_fragments: 1, fragment_size: 200 },
          searchText: { number_of_fragments: 2, fragment_size: 200 },
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      },
      from,
      size: pageSize,
      sort: [{ _score: 'desc' }, { viewCount: 'desc' }],
    }

    const resp = await this.esClient!.search({
      index: ES_INDEX_NAME,
      body,
    })

    const hits = resp?.body?.hits ?? resp?.hits ?? { total: { value: 0 }, hits: [] }
    const t = hits.total
    const total: number = t === undefined ? 0 : typeof t === 'number' ? t : (t.value ?? 0)
    const rows: Array<Record<string, unknown>> = hits.hits ?? []

    const results: SearchResult[] = rows.map((row) => {
      const src = (row._source ?? {}) as Record<string, unknown>
      const hl = (row.highlight ?? {}) as Record<string, string[]>
      const topicType = (src.topicType as string) ?? 'article'
      return {
        id: String(src.topicId ?? src.id ?? row._id ?? ''),
        table:
          TOPIC_TYPE_TO_TABLE[
            topicType as 'article' | 'news' | 'question' | 'resource' | 'lesson'
          ] ?? topicType,
        title: String(src.topicTitle ?? ''),
        content: String(src.topicSummary ?? src.searchText ?? ''),
        score: Number(row._score ?? 0),
        highlights: [
          ...(hl.topicTitle ?? []),
          ...(hl.topicSummary ?? []),
          ...(hl.searchText ?? []),
        ],
      }
    })

    return {
      total,
      results,
      source: 'elasticsearch',
      took_ms: Date.now() - start,
    }
  }

  // ===========================================================================
  // PostgreSQL 兜底:复用现有 searchContents ILIKE 查询
  // ===========================================================================

  private async searchPostgres(opts: SearchOptions, start: number): Promise<SearchResponse> {
    const page = Math.max(1, opts.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20))
    const offset = (page - 1) * pageSize

    const conditions = [sql`${searchContents.searchText} ILIKE ${'%' + opts.query + '%'}`]
    if (opts.table && opts.table !== 'all') {
      const topicType = TABLE_TO_TOPIC_TYPE[opts.table]
      if (topicType) conditions.push(eq(searchContents.topicType, topicType))
    }
    const where = and(...conditions)

    const [list, countRow] = await Promise.all([
      db
        .select()
        .from(searchContents)
        .where(where)
        .orderBy(desc(searchContents.viewCount))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(searchContents)
        .where(where),
    ])

    const results: SearchResult[] = list.map((row) => ({
      id: String(row.topicId ?? row.id),
      table: TOPIC_TYPE_TO_TABLE[row.topicType] ?? row.topicType,
      title: row.topicTitle,
      content: row.topicSummary ?? row.searchText,
      score: Number(row.viewCount ?? 0),
    }))

    return {
      total: countRow[0]?.count ?? 0,
      results,
      source: 'postgres',
      took_ms: Date.now() - start,
    }
  }

  // ===========================================================================
  // 索引管理:写入单条 / 全量重建
  // ===========================================================================

  /** 索引单个文档(写入 ES) */
  async indexDocument(
    table: string,
    doc: { id: string; title: string; content: string; summary?: string; authorId?: string },
  ): Promise<void> {
    await this.ensureClientReady()
    if (!this.isEsEnabled()) return

    const topicType = TABLE_TO_TOPIC_TYPE[table as Exclude<SearchTable, 'all'>] ?? table
    await this.esClient!.index({
      index: ES_INDEX_NAME,
      id: `${topicType}:${doc.id}`,
      body: {
        topicId: doc.id,
        topicType,
        topicTitle: doc.title,
        topicSummary: doc.summary ?? '',
        searchText: doc.content,
        authorId: doc.authorId ?? null,
        docType: ES_DOC_TYPE,
      },
    })
  }

  /**
   * 把线上别名(与旧物理索引同名)原子切到新索引,返回切换前别名指向的旧索引名。
   * 若别名尚不存在(新集群 / 旧版具名物理索引),先让出索引名再建别名。
   */
  private async switchAliasTo(newIndex: string): Promise<string[]> {
    const client = this.esClient!
    const aliasExists = await client.indices.existsAlias({ name: ES_INDEX_NAME })
    if (aliasExists) {
      const raw = await client.indices.getAlias({ name: ES_INDEX_NAME })
      const body = (((raw as { body?: unknown })?.body ?? raw) ?? {}) as Record<string, unknown>
      const oldIndices = Object.keys(body)
      const actions: Array<Record<string, unknown>> = [
        ...oldIndices.map((index) => ({ remove: { index, alias: ES_INDEX_NAME } })),
        { add: { index: newIndex, alias: ES_INDEX_NAME } },
      ]
      await client.indices.updateAliases({ body: { actions } })
      return oldIndices
    }

    // 旧版把物理索引直接命名为 ES_INDEX_NAME,而 ES 不允许索引与别名同名:
    // 此时新索引已全量就绪,先删旧物理索引让出名字,再挂别名(数据以 PostgreSQL 为准)。
    const legacyExists = await client.indices.exists({ index: ES_INDEX_NAME })
    if (legacyExists) {
      await client.indices.delete({ index: ES_INDEX_NAME, ignore_unavailable: true })
    }
    await client.indices.updateAliases({
      body: { actions: [{ add: { index: newIndex, alias: ES_INDEX_NAME } }] },
    })
    return []
  }

  /** 全量重建索引(从 PostgreSQL 拉所有 searchContents 批量写入 ES) */
  async reindexAll(): Promise<{ indexed: number; table: string }> {
    await this.ensureClientReady()
    if (!this.isEsEnabled()) {
      return { indexed: 0, table: 'disabled' }
    }

    // 先建临时物理索引灌数据,成功后再切别名:任何中途失败都不会动线上索引
    const physicalIndex = `${ES_INDEX_NAME}_v${Date.now()}`
    await this.esClient!.indices.create({
      index: physicalIndex,
      body: {
        mappings: {
          properties: {
            topicId: { type: 'keyword' },
            topicType: { type: 'keyword' },
            topicTitle: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            topicSummary: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            searchText: { type: 'text', analyzer: 'ik_max_word', search_analyzer: 'ik_smart' },
            authorId: { type: 'keyword' },
            viewCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            commentCount: { type: 'integer' },
            docType: { type: 'keyword' },
          },
        },
      },
    })

    // 分批拉取 PostgreSQL 数据(keyset 分页:createdAt + id 唯一 tie-break,避免漏/重)
    let lastCreatedAt: Date | null = null
    let lastId: string | null = null
    let total = 0
    let drained = false
    try {
      while (true) {
        const cursor: SQL | undefined =
          lastCreatedAt !== null && lastId !== null
            ? or(
                gt(searchContents.createdAt, lastCreatedAt),
                and(eq(searchContents.createdAt, lastCreatedAt), gt(searchContents.id, lastId)),
              )
            : undefined
        const batch: Array<typeof searchContents.$inferSelect> = await db
          .select()
          .from(searchContents)
          .where(cursor)
          .orderBy(asc(searchContents.createdAt), asc(searchContents.id))
          .limit(REINDEX_BATCH_SIZE)
        if (batch.length === 0) break

        const operations: Array<Record<string, unknown>> = []
        for (const row of batch) {
          operations.push({
            index: { _index: physicalIndex, _id: `${row.topicType}:${row.topicId}` },
          })
          operations.push({
            topicId: row.topicId,
            topicType: row.topicType,
            topicTitle: row.topicTitle,
            topicSummary: row.topicSummary ?? '',
            searchText: row.searchText,
            authorId: row.authorId ?? null,
            viewCount: row.viewCount,
            likeCount: row.likeCount,
            commentCount: row.commentCount,
            docType: ES_DOC_TYPE,
          })
        }
        const bulkResp = await this.esClient!.bulk({ body: operations })
        if (bulkResp?.errors) {
          throw new Error(`ES bulk index partial failure after ${total} docs`)
        }
        total += batch.length
        const lastRow: typeof searchContents.$inferSelect = batch[batch.length - 1]!
        lastCreatedAt = lastRow.createdAt
        lastId = lastRow.id
        if (batch.length < REINDEX_BATCH_SIZE) break
      }

      await this.esClient!.indices.refresh({ index: physicalIndex })

      const oldIndices = await this.switchAliasTo(physicalIndex)
      drained = true
      // 别名已指向新索引,旧物理索引删除失败不致命
      for (const oldIndex of oldIndices) {
        try {
          await this.esClient!.indices.delete({ index: oldIndex, ignore_unavailable: true })
        } catch (e) {
          logger.warn('[search-es] 删除旧索引失败', { index: oldIndex, error: e })
        }
      }
      return { indexed: total, table: ES_INDEX_NAME }
    } catch (e) {
      // 数据未灌完 / 别名切换失败 ⇒ 新索引不可用,清理掉避免残留(别名始终未动)
      if (!drained) {
        try {
          await this.esClient!.indices.delete({ index: physicalIndex, ignore_unavailable: true })
        } catch {
          /* best-effort 清理 */
        }
      }
      throw e
    }
  }

  /** 统计 ES 索引文档数 */
  async getIndexCount(): Promise<number> {
    await this.ensureClientReady()
    if (!this.isEsEnabled()) return 0
    try {
      const resp = await this.esClient!.count({ index: ES_INDEX_NAME })
      return Number(resp?.body?.count ?? resp?.count ?? 0)
    } catch {
      return 0
    }
  }
}

// =============================================================================
// 单例
// =============================================================================

let instance: SearchEsService | null = null

export function getSearchEsService(): SearchEsService {
  if (!instance) instance = new SearchEsService()
  return instance
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
