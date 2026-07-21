/**
 * 知识库 RAG 服务。
 * 迁移自 v1.0.2-sealed: server/app/services/knowledge_service.py
 *
 * 提供:
 * - ingestText:  文本切片 + EmbeddingProvider 向量化 + 入库
 * - search:      语义检索 (cosine 相似度, embedding 不可用时降级为关键词)
 * - getRagContext: 生成标准化 RAG 上下文文本, 供 LLM prompt 直接拼接
 * - listDocs / getDocDetail / getDocChunks / deleteDoc / batchDeleteDocs
 *
 * 环境变量 (按优先级, 任意一个即可启用真 embedding):
 * - DASHSCOPE_API_KEY: 阿里云 DashScope text-embedding-v2
 * - OPENAI_API_KEY:    OpenAI text-embedding-3-small
 * - MINIMAX_API_KEY:   MiniMax 内部 embo-01
 * 留空时降级为关键词匹配, 由 embedding-provider 抽象层管理
 */

import { createHash } from 'node:crypto'
import { desc, eq, and, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { knowledgeDoc, knowledgeChunk } from '@ihui/database'
import { getEmbeddingProvider } from './embedding-provider.js'
import { parseDocument } from './document-parser.js'

/** 文本切片: 500 字符, 50 字符重叠, 优先在分隔符处断开 */
function splitText(text: string, chunkSize = 500, overlap = 50): string[] {
  const cleaned = text.trim()
  if (!cleaned) return []
  if (cleaned.length <= chunkSize) return [cleaned]

  const chunks: string[] = []
  let start = 0
  const seps = ['\n', '。', '!', '?', '.', '!', '?']
  while (start < cleaned.length) {
    let end = start + chunkSize
    if (end < cleaned.length) {
      // lastIndexOf(searchValue, fromIndex) 的 fromIndex 表示从该位置向前查找
      for (const sep of seps) {
        const pos = cleaned.lastIndexOf(sep, end)
        if (pos > start) {
          end = pos + sep.length
          break
        }
      }
    }
    const chunk = cleaned.slice(start, end).trim()
    if (chunk) chunks.push(chunk)
    start = end - overlap > start ? end - overlap : end
  }
  return chunks
}

/**
 * 调用当前 EmbeddingProvider 生成 embedding.
 * 失败或未配置时返回 null, 触发降级 (关键词匹配).
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  const provider = getEmbeddingProvider()
  if (!provider) return null
  try {
    const results = await provider.embed([text])
    return results[0] ?? null
  } catch {
    return null
  }
}

const WORD_RE = /[\w\u4e00-\u9fff]+/g
function keywordScore(query: string, content: string): number {
  const qSet = new Set(query.toLowerCase().match(WORD_RE) ?? [])
  const cSet = new Set(content.toLowerCase().match(WORD_RE) ?? [])
  if (qSet.size === 0 || cSet.size === 0) return 0
  let overlap = 0
  for (const w of qSet) if (cSet.has(w)) overlap++
  return overlap / qSet.size
}

export interface SearchHit {
  id: number
  docId: number
  content: string
  score: number
  chunkIndex: number
}

export interface DocSummary {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

export interface DocDetail extends DocSummary {
  sourcePath: string | null
  contentHash: string | null
}

class KnowledgeRagService {
  /** 文本入库, 返回切片数量 */
  async ingestText(opts: {
    ownerUuid: string
    title: string
    text: string
    collectionName?: string
  }): Promise<number> {
    const { ownerUuid, title, text, collectionName = 'default' } = opts
    if (!text || !text.trim()) return 0
    const chunks = splitText(text)
    if (chunks.length === 0) return 0

    const contentHash = createHash('md5').update(text, 'utf8').digest('hex')
    const [doc] = await db
      .insert(knowledgeDoc)
      .values({
        ownerUuid,
        collectionName,
        title,
        sourceType: 'text',
        contentHash,
        chunkCount: chunks.length,
        status: 'active',
      })
      .returning({ id: knowledgeDoc.id })
    if (!doc) throw new Error('Failed to insert knowledge doc')

    const chunkRows = await Promise.all(
      chunks.map(async (content, i) => {
        const embedding = await getEmbedding(content)
        return {
          docId: doc.id,
          collectionName,
          ownerUuid,
          chunkIndex: i,
          content,
          // vector1536 customType toDriver 自动序列化为 '[...]',NULL 走 fallback
          embedding: embedding && embedding.length === 1536 ? embedding : null,
        }
      }),
    )
    await db.insert(knowledgeChunk).values(chunkRows)
    return chunks.length
  }

  /** 文件入库:解析多格式文件 → 走 ingestText 切片 + embedding
   *
   * 设计:
   * - 复用 ingestText 全部逻辑(切片 / embedding / 入库),仅前置文件解析
   * - 错误透传 UnsupportedFormatError / FileTooLargeError(由路由层转 400)
   * - 解析后空文本 → 返回 0(与 ingestText 行为一致)
   */
  async ingestFile(opts: {
    ownerUuid: string
    title: string
    buffer: Buffer
    mimeType: string
    filename: string
    collectionName?: string
  }): Promise<{ docId: number; chunkCount: number }> {
    const { ownerUuid, title, buffer, mimeType, filename, collectionName = 'default' } = opts
    const text = await parseDocument({ buffer, mimeType, filename })
    if (!text || !text.trim()) {
      return { docId: 0, chunkCount: 0 }
    }
    // sourceType 用 mimeType 简化值:pdf/docx/markdown/text/html
    const sourceType = mimeType?.startsWith('application/pdf')
      ? 'pdf'
      : mimeType?.includes('wordprocessingml')
        ? 'docx'
        : mimeType === 'text/markdown'
          ? 'markdown'
          : mimeType === 'text/html'
            ? 'html'
            : 'file'

    // 复用 ingestText 入库(切片 + embedding + 写入 knowledge_doc + knowledge_chunk)
    const chunkCount = await this.ingestText({ ownerUuid, title, text, collectionName })
    // 拿到刚插入的 docId(ingestText 已用 contentHash 唯一标识,但同名文件重新上传会创建新 doc)
    const [latest] = await db
      .select({ id: knowledgeDoc.id, sourceType: knowledgeDoc.sourceType })
      .from(knowledgeDoc)
      .where(and(eq(knowledgeDoc.ownerUuid, ownerUuid), eq(knowledgeDoc.title, title)))
      .orderBy(desc(knowledgeDoc.createdAt))
      .limit(1)
    if (latest) {
      // 覆盖 sourceType(text → file/具体类型),保持入库即所见即所得
      await db
        .update(knowledgeDoc)
        .set({ sourceType, updatedAt: new Date() })
        .where(eq(knowledgeDoc.id, latest.id))
      return { docId: latest.id, chunkCount }
    }
    return { docId: 0, chunkCount }
  }

  /** 语义检索 (pgvector ANN)
   *
   * 流程:
   * 1. 调 EmbeddingProvider 生成 query embedding
   * 2. SQL 端用 pgvector `<=>` 距离运算符检索 top-K
   *    - 1 - (embedding <=> query) 作为 score(0~1 越接近 1 越相似)
   * 3. 当 query embedding 不可用(provider 未配置 / 失败)时
   *    走关键词 fallback 拉全表 Node cosine
   */
  async search(opts: {
    query: string
    collectionName?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string
  }): Promise<SearchHit[]> {
    const { query, collectionName = 'default', topK = 5, scoreThreshold = 0, ownerUuid = '' } = opts
    const queryEmbedding = await getEmbedding(query)

    // 主路径:pgvector SQL 端 ANN 检索
    if (queryEmbedding && queryEmbedding.length === 1536) {
      try {
        const vectorLiteral = `[${queryEmbedding.join(',')}]`
        // 条件用 drizzle sql template,ownerUuid 可选
        const whereParts = [
          sql`"collection_name" = ${collectionName}`,
          sql`"embedding" IS NOT NULL`,
        ]
        if (ownerUuid) whereParts.push(sql`"owner_uuid" = ${ownerUuid}`)

        // 1 - (embedding <=> query) 作为 cosine 相似度 score
        const rows = (await db.execute(sql`
          SELECT
            "id",
            "doc_id",
            "content",
            "chunk_index",
            1 - ("embedding" <=> ${vectorLiteral}::vector) AS "score"
          FROM "zhs_knowledge_chunk"
          WHERE ${sql.join(whereParts, sql` AND `)}
          ORDER BY "embedding" <=> ${vectorLiteral}::vector
          LIMIT ${topK * 2}
        `)) as Array<{
          id: number
          doc_id: number
          content: string
          chunk_index: number
          score: number
        }>

        const results: SearchHit[] = []
        for (const row of rows) {
          const score = Number(row.score) || 0
          if (score >= scoreThreshold) {
            results.push({
              id: row.id,
              docId: row.doc_id,
              content: row.content,
              score,
              chunkIndex: row.chunk_index,
            })
          }
        }
        return results.slice(0, topK)
      } catch (e) {
        // pgvector 不可用(扩展未启用 / SQL 执行错误)→ 降级到关键词路径
        console.warn(
          '[knowledge-rag-service.search] pgvector query failed, fallback to keyword:',
          (e as Error).message,
        )
      }
    }

    // 降级路径:无 query embedding 时走关键词检索
    return this._searchByKeyword(query, collectionName, topK, scoreThreshold, ownerUuid)
  }

  /** 关键词 fallback:拉全表 + Node 端简单词集重合打分 */
  private async _searchByKeyword(
    query: string,
    collectionName: string,
    topK: number,
    scoreThreshold: number,
    ownerUuid: string,
  ): Promise<SearchHit[]> {
    const conditions = [eq(knowledgeChunk.collectionName, collectionName)]
    if (ownerUuid) conditions.push(eq(knowledgeChunk.ownerUuid, ownerUuid))
    const rows = await db
      .select({
        id: knowledgeChunk.id,
        docId: knowledgeChunk.docId,
        content: knowledgeChunk.content,
        chunkIndex: knowledgeChunk.chunkIndex,
      })
      .from(knowledgeChunk)
      .where(and(...conditions))

    const results: SearchHit[] = []
    for (const chunk of rows) {
      const score = keywordScore(query, chunk.content)
      if (score >= scoreThreshold) {
        results.push({
          id: chunk.id,
          docId: chunk.docId,
          content: chunk.content,
          score,
          chunkIndex: chunk.chunkIndex,
        })
      }
    }
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  /** 生成 RAG 上下文文本 */
  async getRagContext(opts: {
    query: string
    collectionName?: string
    topK?: number
    ownerUuid?: string
  }): Promise<string> {
    const results = await this.search(opts)
    if (results.length === 0) return ''
    return results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')
  }

  /** 列出文档 */
  async listDocs(ownerUuid: string): Promise<DocSummary[]> {
    const rows = await db
      .select()
      .from(knowledgeDoc)
      .where(and(eq(knowledgeDoc.ownerUuid, ownerUuid), eq(knowledgeDoc.status, 'active')))
      .orderBy(desc(knowledgeDoc.createdAt))
    return rows.map((d) => ({
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    }))
  }

  /** 文档详情 */
  async getDocDetail(docId: number, ownerUuid: string): Promise<DocDetail | null> {
    const rows = await db
      .select()
      .from(knowledgeDoc)
      .where(
        and(
          eq(knowledgeDoc.id, docId),
          eq(knowledgeDoc.ownerUuid, ownerUuid),
          eq(knowledgeDoc.status, 'active'),
        ),
      )
      .limit(1)
    const d = rows[0]
    if (!d) return null
    return {
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      sourcePath: d.sourcePath,
      contentHash: d.contentHash,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    }
  }

  /** 文档切片预览 */
  async getDocChunks(
    docId: number,
    ownerUuid: string,
    limit = 10,
  ): Promise<Array<{ id: number; chunkIndex: number; content: string }>> {
    const docRows = await db
      .select({ id: knowledgeDoc.id })
      .from(knowledgeDoc)
      .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
      .limit(1)
    if (docRows.length === 0) return []

    const rows = await db
      .select({
        id: knowledgeChunk.id,
        chunkIndex: knowledgeChunk.chunkIndex,
        content: knowledgeChunk.content,
      })
      .from(knowledgeChunk)
      .where(eq(knowledgeChunk.docId, docId))
      .orderBy(knowledgeChunk.chunkIndex)
      .limit(limit)
    return rows
  }

  /** 软删除文档 */
  async deleteDoc(docId: number, ownerUuid: string): Promise<boolean> {
    const rows = await db
      .select({ id: knowledgeDoc.id })
      .from(knowledgeDoc)
      .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
      .limit(1)
    if (rows.length === 0) return false
    await db
      .update(knowledgeDoc)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(knowledgeDoc.id, docId))
    await db.delete(knowledgeChunk).where(eq(knowledgeChunk.docId, docId))
    return true
  }

  /** 批量删除 */
  async batchDeleteDocs(
    docIds: number[],
    ownerUuid: string,
  ): Promise<{ success: number[]; failed: number[] }> {
    const success: number[] = []
    const failed: number[] = []
    for (const id of docIds) {
      if (await this.deleteDoc(id, ownerUuid)) success.push(id)
      else failed.push(id)
    }
    return { success, failed }
  }
}

export const knowledgeRagService = new KnowledgeRagService()
