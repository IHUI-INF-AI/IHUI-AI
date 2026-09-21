// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码库语义索引服务。
 *
 * 提供:
 * - indexChunks:   批量写入代码切片(含 embedding)→ 增量更新(先删旧后插新)
 * - search:        语义检索(query embedding → pgvector ANN → top-K)
 * - deleteByRepo:  按仓库删除所有切片
 * - deleteByFile:  按仓库+文件删除切片(增量更新前清理)
 * - getStats:      索引统计(切片数 / 文件数 / 已向量化数)
 *
 * 与 knowledge-rag-service 的区别:
 * - 知识库存文档(按字符数切片),本服务存代码(按 AST 符号切片)
 * - 知识库按 owner_uuid 隔离,本服务按 repo_id 隔离(代码库无 owner 概念)
 * - embedding 生成委托给 ai-service 的 codebase_indexer(Python tree-sitter),
 *   本服务只负责存储 + 检索(embedding 由调用方传入)
 *
 * 环境变量(通过 embedding-provider.ts 间接使用):
 * - DASHSCOPE_API_KEY / OPENAI_API_KEY / MINIMAX_API_KEY
 */

import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { codebaseChunks } from '@ihui/database'
import { getEmbeddingProvider } from './embedding-provider.js'
import { logger } from '../utils/logger.js'

export interface ChunkInput {
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  language?: string
  symbolName?: string
  symbolType?: string
  embedding?: number[] | null
}

export interface SearchResult {
  id: string
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  language: string | null
  symbolName: string | null
  symbolType: string | null
  score: number
}

export interface IndexStats {
  totalChunks: number
  totalFiles: number
  vectorizedChunks: number
}

class CodebaseIndexService {
  /**
   * 批量写入代码切片(增量更新模式)。
   *
   * 流程:
   * 1. 按 repoId + filePath 删除该文件的所有旧切片
   * 2. 为缺少 embedding 的切片生成向量(批量,复用 embedding-provider)
   * 3. 批量插入新切片
   *
   * 注意:调用方(ai-service codebase_indexer)也可自行生成 embedding 后传入,
   * 此时本服务跳过 embedding 生成步骤(以调用方传入为准)。
   */
  async indexChunks(
    repoId: string,
    chunks: ChunkInput[],
  ): Promise<{
    indexed: number
    vectorized: number
  }> {
    if (chunks.length === 0) return { indexed: 0, vectorized: 0 }

    // 1. 收集所有涉及文件,删除旧切片(增量更新)
    const filePaths = [...new Set(chunks.map((c) => c.filePath))]
    for (const filePath of filePaths) {
      await db
        .delete(codebaseChunks)
        .where(and(eq(codebaseChunks.repoId, repoId), eq(codebaseChunks.filePath, filePath)))
    }

    // 2. 为缺少 embedding 的切片批量生成向量
    const provider = getEmbeddingProvider()
    const needEmbedding = chunks.filter((c) => !c.embedding || c.embedding.length !== 1536)
    let vectorized = 0
    if (provider && needEmbedding.length > 0) {
      try {
        // 批量 embedding(provider.embed 接受文本数组)
        const texts = needEmbedding.map((c) => c.content.slice(0, 8000))
        const embeddings = await provider.embed(texts)
        for (let i = 0; i < needEmbedding.length; i++) {
          const chunk = needEmbedding[i]
          if (!chunk) continue
          const emb = embeddings[i]
          if (emb && emb.length === 1536) {
            chunk.embedding = emb
            vectorized++
          }
        }
      } catch (e) {
        logger.warn(
          '[codebase-index-service.indexChunks] batch embedding failed, chunks stored without vector:',
          { err: e as Error },
        )
      }
    }

    // 3. 批量插入
    const rows = chunks.map((c) => ({
      repoId,
      filePath: c.filePath,
      lineStart: c.lineStart,
      lineEnd: c.lineEnd,
      content: c.content,
      embedding: c.embedding && c.embedding.length === 1536 ? c.embedding : null,
      language: c.language ?? null,
      symbolName: c.symbolName ?? null,
      symbolType: c.symbolType ?? null,
    }))

    // 分批插入(每批 100 条,防单次 SQL 过大)
    const BATCH_SIZE = 100
    let indexed = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      await db.insert(codebaseChunks).values(batch)
      indexed += batch.length
    }

    return { indexed, vectorized }
  }

  /**
   * 语义检索 (pgvector ANN)。
   *
   * 流程:
   * 1. 调 EmbeddingProvider 生成 query embedding
   * 2. SQL 端用 pgvector `<=>` 距离运算符检索 top-K
   *    - score = 1 - (embedding <=> query),范围 0~1,越大越相似
   * 3. 当 query embedding 不可用时返回空结果(调用方应 fallback 到 regex 搜索)
   *
   * 可选过滤:repoId(限定仓库)、language(限定语言)
   */
  async search(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
    scoreThreshold?: number
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10, scoreThreshold = 0 } = opts

    const queryEmbedding = await this._getEmbedding(query)
    if (!queryEmbedding || queryEmbedding.length !== 1536) {
      // 无法生成 embedding → 返回空(调用方应 fallback 到 regex)
      return []
    }

    try {
      const vectorLiteral = `[${queryEmbedding.join(',')}]`
      const whereParts = [sql`"embedding" IS NOT NULL`]
      if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
      if (language) whereParts.push(sql`"language" = ${language}`)

      const rows = (await db.execute(sql`
        SELECT
          "id",
          "file_path",
          "line_start",
          "line_end",
          "content",
          "language",
          "symbol_name",
          "symbol_type",
          1 - ("embedding" <=> ${vectorLiteral}::vector) AS "score"
        FROM "codebase_chunks"
        WHERE ${sql.join(whereParts, sql` AND `)}
        ORDER BY "embedding" <=> ${vectorLiteral}::vector
        LIMIT ${topK * 2}
      `)) as Array<{
        id: string
        file_path: string
        line_start: number
        line_end: number
        content: string
        language: string | null
        symbol_name: string | null
        symbol_type: string | null
        score: number
      }>

      const results: SearchResult[] = []
      for (const row of rows) {
        const score = Number(row.score) || 0
        if (score >= scoreThreshold) {
          results.push({
            id: row.id,
            filePath: row.file_path,
            lineStart: row.line_start,
            lineEnd: row.line_end,
            content: row.content,
            language: row.language,
            symbolName: row.symbol_name,
            symbolType: row.symbol_type,
            score,
          })
        }
      }
      return results.slice(0, topK)
    } catch (e) {
      logger.warn('[codebase-index-service.search] pgvector query failed:', { err: e as Error })
      return []
    }
  }

  /**
   * 关键词检索(Postgres 全文检索,2026-09-07 立)。
   *
   * BM25 风格词法通道:tsquery 匹配 content + symbol_name + file_path,
   * ts_rank 排序。与向量通道互补——精确符号名/文件名/标识符查询
   * (如"getUserById")在词法通道命中率远高于语义通道。
   * 无需迁移:tsvector 查询时计算(切片表规模 <10万行时成本可接受)。
   */
  async keywordSearch(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10 } = opts
    try {
      const whereParts = [
        sql`to_tsvector('simple', "content" || ' ' || coalesce("symbol_name", '') || ' ' || "file_path") @@ websearch_to_tsquery('simple', ${query})`,
      ]
      if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
      if (language) whereParts.push(sql`"language" = ${language}`)

      const rows = (await db.execute(sql`
        SELECT
          "id",
          "file_path",
          "line_start",
          "line_end",
          "content",
          "language",
          "symbol_name",
          "symbol_type",
          ts_rank(
            to_tsvector('simple', "content" || ' ' || coalesce("symbol_name", '') || ' ' || "file_path"),
            websearch_to_tsquery('simple', ${query})
          ) AS "score"
        FROM "codebase_chunks"
        WHERE ${sql.join(whereParts, sql` AND `)}
        ORDER BY "score" DESC
        LIMIT ${topK * 2}
      `)) as Array<{
        id: string
        file_path: string
        line_start: number
        line_end: number
        content: string
        language: string | null
        symbol_name: string | null
        symbol_type: string | null
        score: number
      }>

      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        content: row.content,
        language: row.language,
        symbolName: row.symbol_name,
        symbolType: row.symbol_type,
        score: Number(row.score) || 0,
      }))
    } catch (e) {
      logger.warn('[codebase-index-service.keywordSearch] FTS query failed:', { err: e as Error })
      return []
    }
  }

  /**
   * 混合检索(向量 + 关键词 RRF 融合,2026-09-07 立)。
   *
   * 双通道并行 → Reciprocal Rank Fusion(k=60)→ 符号/路径精确匹配加权。
   * 向量通道失败(embedding 不可用)时自动降级为纯关键词通道;
   * 关键词通道失败(FTS 异常)时退化为纯向量。两通道都空才返回空。
   */
  async hybridSearch(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
    scoreThreshold?: number
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10, scoreThreshold = 0 } = opts

    const [vectorResults, keywordResults] = await Promise.all([
      this.search({ query, repoId, language, topK, scoreThreshold }).catch(
        () => [] as SearchResult[],
      ),
      this.keywordSearch({ query, repoId, language, topK }).catch(() => [] as SearchResult[]),
    ])

    if (vectorResults.length === 0 && keywordResults.length === 0) return []

    const fused = reciprocalRankFusion(vectorResults, keywordResults, 60, topK * 2)
    return applyLexicalBoost(fused, query).slice(0, topK)
  }

  /** 按仓库删除所有切片 */
  async deleteByRepo(repoId: string): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(eq(codebaseChunks.repoId, repoId))
      .returning({ id: codebaseChunks.id })
    return result.length
  }

  /** 按仓库+文件删除切片(增量更新前清理) */
  async deleteByFile(repoId: string, filePath: string): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(and(eq(codebaseChunks.repoId, repoId), eq(codebaseChunks.filePath, filePath)))
      .returning({ id: codebaseChunks.id })
    return result.length
  }

  /**
   * 批量按文件删除切片(Merkle 增量同步专用,2026-09-07 立)。
   * 处理"源文件已删除"场景:文件消失后其旧切片必须同步清除,
   * 否则语义搜索会持续召回幽灵文件的过期内容。
   */
  async deleteByFiles(repoId: string, filePaths: string[]): Promise<number> {
    if (filePaths.length === 0) return 0
    let deleted = 0
    // 分批 in 查询(每批 200,防 SQL 参数过多)
    const BATCH = 200
    for (let i = 0; i < filePaths.length; i += BATCH) {
      const batch = filePaths.slice(i, i + BATCH)
      const result = await db
        .delete(codebaseChunks)
        .where(and(eq(codebaseChunks.repoId, repoId), inArray(codebaseChunks.filePath, batch)))
        .returning({ id: codebaseChunks.id })
      deleted += result.length
    }
    return deleted
  }

  /** 索引统计 */
  async getStats(repoId?: string): Promise<IndexStats> {
    const whereCondition = repoId ? sql`WHERE "repo_id" = ${repoId}` : sql``
    const rows = (await db.execute(sql`
      SELECT
        COUNT(*) AS "total",
        COUNT(DISTINCT "file_path") AS "files",
        COUNT("embedding") AS "vectorized"
      FROM "codebase_chunks"
      ${whereCondition}
    `)) as Array<{
      total: string | number
      files: string | number
      vectorized: string | number
    }>
    const row = rows[0] ?? { total: 0, files: 0, vectorized: 0 }
    return {
      totalChunks: Number(row.total) || 0,
      totalFiles: Number(row.files) || 0,
      vectorizedChunks: Number(row.vectorized) || 0,
    }
  }

  /**
   * 调用当前 EmbeddingProvider 生成 embedding。
   * 失败或未配置时返回 null,触发降级(返回空结果,调用方 fallback 到 regex)。
   */
  private async _getEmbedding(text: string): Promise<number[] | null> {
    const provider = getEmbeddingProvider()
    if (!provider) return null
    try {
      const results = await provider.embed([text])
      return results[0] ?? null
    } catch {
      return null
    }
  }
}

export const codebaseIndexService = new CodebaseIndexService()

/**
 * Reciprocal Rank Fusion(纯函数,2026-09-07 立)。
 *
 * score(d) = Σ_channels 1 / (k + rank_i(d)),k=60 为论文推荐值。
 * 输入各通道已按相关性降序的结果列表;按 id 去重合并。
 * 返回按融合分降序、截断 limit 的结果(融合分写入 score 字段)。
 */
export function reciprocalRankFusion(...channels: Array<SearchResult[] | number>): SearchResult[] {
  const nums = channels.filter((c): c is number => typeof c === 'number')
  const lists = channels.filter((c): c is SearchResult[] => Array.isArray(c))
  const k = nums[0] ?? 60
  const limit = nums[1] ?? Number.MAX_SAFE_INTEGER
  if (lists.length === 0) return []

  const byId = new Map<string, SearchResult>()
  const scores = new Map<string, number>()
  for (const list of lists) {
    list.forEach((item, idx) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + idx + 1))
      if (!byId.has(item.id)) byId.set(item.id, item)
    })
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, rrfScore]) => ({ ...byId.get(id)!, score: rrfScore }))
}

/**
 * 词法精确匹配加权(纯函数,2026-09-07 立)。
 * symbol_name 完整包含查询 token → +0.05;file_path 包含 → +0.03。
 * 让"getUserById"这类精确标识符查询稳定排到语义近似结果之前。
 */
export function applyLexicalBoost(results: SearchResult[], query: string): SearchResult[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 3)
  if (tokens.length === 0) return results
  return results.map((r) => {
    let boost = 0
    const sym = (r.symbolName ?? '').toLowerCase()
    const path = r.filePath.toLowerCase()
    if (sym && tokens.some((t) => sym.includes(t))) boost += 0.05
    if (tokens.some((t) => path.includes(t))) boost += 0.03
    return boost === 0 ? r : { ...r, score: r.score + boost }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
