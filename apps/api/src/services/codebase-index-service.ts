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
 * - 知识库按 owner_uuid 隔离,本服务按 **owner_uuid + repo_id** 双重隔离
 *   (2026-10-03 数据出域合规整改:此前只有 repo_id,而它只是路径 hash 不是用户
 *    身份,且检索时 repoId 可选 ⇒ 跨用户可检索。见本文件 _ownerScope 注释)
 * - embedding 生成委托给 ai-service 的 codebase_indexer(Python tree-sitter),
 *   本服务只负责存储 + 检索(embedding 由调用方传入)
 *
 * 环境变量(通过 embedding-provider.ts 间接使用):
 * - DASHSCOPE_API_KEY / OPENAI_API_KEY / MINIMAX_API_KEY
 */

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
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

/**
 * 2026-10-03 数据出域合规整改:代码索引默认保留期(天)。
 *
 * 取 90 天而非"永久":本表存的是**用户代码明文 + 向量**,且 embedding 由外部
 * 服务计算(出域面之一)。默认给上限而非下限 —— 用户可显式选长期保留,但
 * "什么都不做"必须是有限期,否则新增的每一条索引都默认永久留存。
 * 改这一个常量即可全局调整;清理任务按 expires_at 回收。
 */
export const CODE_INDEX_RETENTION_DAYS = 90

/**
 * 计算一条索引切片的过期时刻。
 *
 * 抽成函数而不让各调用方各算一次:expires_at 写成 `NOW() + interval` 的字面量
 * SQL 与 JS 侧算出的时间会漂(两个时钟来源),而漂移的方向不可控。这里统一在
 * JS 侧取一次,写库与读库判过期用的是同一套时间基准。
 *
 * days 不传即用 CODE_INDEX_RETENTION_DAYS。传 0 也会得到"当前时刻"(即写完
 * 立刻算过期)—— 这是合法输入(用户主动要求不保留),故不做下限夹取。
 */
export function codeIndexExpiresAt(now: Date = new Date(), days?: number): Date {
  return new Date(now.getTime() + (days ?? CODE_INDEX_RETENTION_DAYS) * 24 * 60 * 60 * 1000)
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

/**
 * 归属 + 未过期 谓词(2026-10-03 数据出域合规整改的**唯一判据**)。
 *
 * 为什么不用 RLS:两条读写通道都没有 `app.user_id` 会话变量(ai-service 走
 * `X-User-Id` 内部服务头 + api 自身 drizzle 直连),套 RLS 会让全部读写静默
 * 0 行 —— "功能坏了但不报错"。理由与迁移文件头同源,改判据时两处一起改。
 *
 * 为什么必须带 expiresAt:不排除过期行,过期切片在被清理任务回收前那段窗口里
 * 仍会被检索到 —— 那等于"设了保留期却不遵守",比没有保留期更糟(用户会以为
 * 到期即失效)。清理任务只是最终回收手段,读面过滤才是生效点。
 *
 * ⚠ 所有读写方法都必须经这个函数取谓词,不要就地手写 `owner_uuid = ...`:
 *   漏一处就是一处跨用户读面,而这种漏检在测试里往往看不出来(单用户场景
 *   下两种写法结果相同)。
 */
function _ownerScope(ownerUuid: string | null | undefined) {
  if (!ownerUuid) {
    // 无归属 ⇒ 不返回任何行(而非"不过滤")。这是 fail-closed:
    // 忘记传 ownerUuid 的调用方拿到的是空结果,而不是别人的全部代码。
    return sql`1 = 0`
  }
  return and(
    eq(codebaseChunks.ownerUuid, ownerUuid),
    or(isNull(codebaseChunks.expiresAt), sql`"codebase_chunks"."expires_at" > NOW()`),
  )
}

class CodebaseIndexService {
  /**
   * 批量写入代码切片(增量更新模式)。
   *
   * 流程:
   * 1. 按 ownerUuid + repoId + filePath 删除该文件的所有旧切片
   * 2. 为缺少 embedding 的切片生成向量(批量,复用 embedding-provider)
   * 3. 批量插入新切片(带 ownerUuid + expiresAt 默认保留期)
   *
   * 注意:调用方(ai-service codebase_indexer)也可自行生成 embedding 后传入,
   * 此时本服务跳过 embedding 生成步骤(以调用方传入为准)。
   *
   * ownerUuid(2026-10-03 新增,**必填**):不传时拒绝写入 —— 本表存的是用户
   * 代码明文,写无主行等于制造一处"归属不明但长期留存"的外泄面(正是本次整改
   * 要消除的东西)。存量无主行由迁移标记过期待清理,不在这里再造新的。
   * retentionDays:显式指定保留期;不传用 CODE_INDEX_RETENTION_DAYS 默认上限。
   * 传 null 表示"永不失效"(仅供用户显式选择长期保留)。
   */
  async indexChunks(
    repoId: string,
    chunks: ChunkInput[],
    ownerUuid?: string | null,
    retentionDays?: number | null,
  ): Promise<{
    indexed: number
    vectorized: number
  }> {
    if (chunks.length === 0) return { indexed: 0, vectorized: 0 }
    // 归属强制在**任何 DB 操作之前**:本表存用户代码明文,写无主行等于制造一处
    // "归属不明但长期留存"的外泄面 —— 正是本次整改要消除的东西。存量无主行由
    // 迁移标记过期待清理,不在这里再造新的。缺 ownerUuid 即抛错(而非静默跳过),
    // 让接线漏了当场暴露。
    if (!ownerUuid) {
      throw new Error('indexChunks 缺少 ownerUuid:拒绝写入无归属的代码索引')
    }

    // 1. 收集所有涉及文件,删除旧切片(增量更新)
    const filePaths = [...new Set(chunks.map((c) => c.filePath))]
    for (const filePath of filePaths) {
      await db
        .delete(codebaseChunks)
        .where(
          and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId), eq(codebaseChunks.filePath, filePath)),
        )
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

    // 3. 批量插入(2026-10-03:每行强制带 ownerUuid + expiresAt)
    // expiresAt 在**写入时一次算定**并落库,而不是查询时才判断 —— 保留期是一个
    // 可被审计的客观事实(这行数据什么时候失效),不是随查询时刻漂移的窗口。
    // retentionDays === null ⇒ 永不过期(用户显式选择长期保留);
    // 传数字 ⇒ 相对该批写入时刻的保留期;不传 ⇒ CODE_INDEX_RETENTION_DAYS。
    const expiresAt =
      retentionDays === null ? null : codeIndexExpiresAt(undefined, retentionDays ?? undefined)
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
      ownerUuid,
      expiresAt,
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
   *
   * ownerUuid(2026-10-03 新增,**必填**):不传即返回空(fail-closed)。整改前
   * repoId 是可选的,不传就跨全部仓库检索 —— 本表存的是用户代码明文,那等于
   * 任何登录用户都能检索到别人的代码。归属过滤是**无条件**的,不因调用方
   * "只想搜自己"而省略。
   */
  async search(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10, scoreThreshold = 0, ownerUuid } = opts

    const queryEmbedding = await this._getEmbedding(query)
    if (!queryEmbedding || queryEmbedding.length !== 1536) {
      // 无法生成 embedding → 返回空(调用方应 fallback 到 regex)
      return []
    }

    try {
      const vectorLiteral = `[${queryEmbedding.join(',')}]`
      const whereParts = [sql`"embedding" IS NOT NULL`, _ownerScope(ownerUuid)]
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
   *
   * ownerUuid(2026-10-03 新增,**必填**):与 search() 同一纪律。词法通道同样
   * 返回 content 明文,不隔离它就是一条完整的跨用户读取面。
   */
  async keywordSearch(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10, ownerUuid } = opts
    try {
      const whereParts = [
        sql`to_tsvector('simple', "content" || ' ' || coalesce("symbol_name", '') || ' ' || "file_path") @@ websearch_to_tsquery('simple', ${query})`,
        _ownerScope(ownerUuid),
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
   *
   * ownerUuid(2026-10-03 新增,**必填**):向下透传给两个子通道,任一子通道漏传
   * 都会让 hybrid 变成跨用户读面(RRF 只融合排名,不隔离内容)。
   */
  async hybridSearch(opts: {
    query: string
    repoId?: string
    language?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, topK = 10, scoreThreshold = 0, ownerUuid } = opts

    const [vectorResults, keywordResults] = await Promise.all([
      this.search({ query, repoId, language, topK, scoreThreshold, ownerUuid }).catch(
        () => [] as SearchResult[],
      ),
      this.keywordSearch({ query, repoId, language, topK, ownerUuid }).catch(() => [] as SearchResult[]),
    ])

    if (vectorResults.length === 0 && keywordResults.length === 0) return []

    const fused = reciprocalRankFusion(vectorResults, keywordResults, 60, topK * 2)
    return applyLexicalBoost(fused, query).slice(0, topK)
  }

  /**
   * 按仓库删除所有切片。
   *
   * ownerUuid(2026-10-03 新增,**必填**):删除面与读取面同样要隔离 —— 否则
   * 用户 A 传别人的 repoId 就能把 B 的索引删掉(破坏性跨用户操作)。
   */
  async deleteByRepo(repoId: string, ownerUuid?: string | null): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId)))
      .returning({ id: codebaseChunks.id })
    return result.length
  }

  /** 按仓库+文件删除切片(增量更新前清理);ownerUuid 语义同 deleteByRepo。 */
  async deleteByFileScoped(
    repoId: string,
    filePath: string,
    ownerUuid?: string | null,
  ): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(
        and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId), eq(codebaseChunks.filePath, filePath)),
      )
      .returning({ id: codebaseChunks.id })
    return result.length
  }

  /** @deprecated 保留旧签名(deleteByFile);内部按无归属处理 ⇒ 命中 0 行(fail-closed)。 */
  async deleteByFile(repoId: string, filePath: string): Promise<number> {
    return this.deleteByFileScoped(repoId, filePath, null)
  }

  /**
   * 批量按文件删除切片(Merkle 增量同步专用,2026-09-07 立)。
   * 处理"源文件已删除"场景:文件消失后其旧切片必须同步清除,
   * 否则语义搜索会持续召回幽灵文件的过期内容。
   */
  async deleteByFiles(
    repoId: string,
    filePaths: string[],
    ownerUuid?: string | null,
  ): Promise<number> {
    if (filePaths.length === 0) return 0
    let deleted = 0
    // 分批 in 查询(每批 200,防 SQL 参数过多)
    const BATCH = 200
    for (let i = 0; i < filePaths.length; i += BATCH) {
      const batch = filePaths.slice(i, i + BATCH)
      const result = await db
        .delete(codebaseChunks)
        .where(and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId), inArray(codebaseChunks.filePath, batch)))
        .returning({ id: codebaseChunks.id })
      deleted += result.length
    }
    return deleted
  }

  /**
   * 索引统计。
   *
   * ownerUuid(2026-10-03 新增,**必填**):统计数字本身也是信息泄露面 ——
   * 不隔离时用户能通过"总切片数"推断出别人仓库的规模与活跃度,故一并隔离。
   */
  async getStats(repoId?: string, ownerUuid?: string | null): Promise<IndexStats> {
    const whereParts = [_ownerScope(ownerUuid)]
    if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
    const whereCondition = sql`WHERE ${sql.join(whereParts, sql` AND `)}`
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
   * 回收已过期的代码索引切片(2026-10-03 数据出域合规整改立,由调度器每日调用)。
   *
   * 为什么必须有这一步:读面已按 expires_at 过滤(见 _ownerScope),所以"过期即
   * 不可见"已经成立;本方法负责的是**物理删除** —— 让用户的代码明文不会因为
   * "一直没人查它"而在库里无限期躺着(留存面的终点是删除,不是不可见)。
   *
   * 分批删除(默认 1000 行/批):单次大 DELETE 会长时间持锁,在一张可能已有
   * 数十万行的表上尤其明显。循环直到没有到期行为止,与 llm_call_logs 清除器
   * 的分批形态一致。
   *
   * 不设"最大批数"上限:宁可多跑几轮,也不要让到期行长期滞留 —— 限轮次等于
   * 给"清理不及时"留了合法出口,而这个任务没有任何实时性要求(延迟一天无害)。
   *
   * 返回值:本轮删掉的行数,供调度器记日志/指标。
   */
  async purgeExpired(limitPerBatch = 1000): Promise<number> {
    let total = 0
    // 守卫:批大小为 0 或负数会让循环永远"删 0 行"却继续转 —— 直接拒绝而不是
    // 静默空转(这类死循环在调度器里表现为"任务永远在跑")。
    if (limitPerBatch <= 0) {
      throw new Error(`purgeExpired 需要正数批大小,收到 ${limitPerBatch}`)
    }
    for (;;) {
      const rows = (await db.execute(sql`
        DELETE FROM "codebase_chunks"
        WHERE "id" IN (
          SELECT "id" FROM "codebase_chunks"
          WHERE "expires_at" IS NOT NULL AND "expires_at" <= NOW()
          LIMIT ${limitPerBatch}
        )
        RETURNING "id"
      `)) as Array<{ id: string }>
      const deleted = rows.length
      total += deleted
      if (deleted < limitPerBatch) return total
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
