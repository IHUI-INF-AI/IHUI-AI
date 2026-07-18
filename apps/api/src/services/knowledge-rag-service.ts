/**
 * 知识库 RAG 服务。
 * 迁移自 v1.0.2-sealed: server/app/services/knowledge_service.py
 *
 * 提供:
 * - ingestText:  文本切片 + DashScope embedding + 入库
 * - search:      语义检索 (cosine 相似度, embedding 不可用时降级为关键词)
 * - getRagContext: 生成标准化 RAG 上下文文本, 供 LLM prompt 直接拼接
 * - listDocs / getDocDetail / getDocChunks / deleteDoc / batchDeleteDocs
 *
 * 环境变量:
 * - DASHSCOPE_API_KEY: 阿里云 DashScope API Key (留空时降级为关键词匹配)
 */

import { createHash } from 'node:crypto'
import { desc, eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { knowledgeDoc, knowledgeChunk } from '@ihui/database'

const DASHSCOPE_EMBEDDING_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
const EMBEDDING_MODEL = 'text-embedding-v2'
const EMBEDDING_MAX_INPUT = 2048

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

interface EmbeddingResponse {
  output?: { embeddings?: Array<{ embedding?: number[] }> }
}

/** 调用 DashScope 生成 embedding;失败/无 key 时返回 null,触发降级 */
async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch(DASHSCOPE_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: { texts: [text.slice(0, EMBEDDING_MAX_INPUT)] },
      }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as EmbeddingResponse
    return data.output?.embeddings?.[0]?.embedding ?? null
  } catch {
    return null
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
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
          embedding: embedding ? JSON.stringify(embedding) : null,
        }
      }),
    )
    await db.insert(knowledgeChunk).values(chunkRows)
    return chunks.length
  }

  /** 语义检索 */
  async search(opts: {
    query: string
    collectionName?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string
  }): Promise<SearchHit[]> {
    const { query, collectionName = 'default', topK = 5, scoreThreshold = 0, ownerUuid = '' } = opts
    const queryEmbedding = await getEmbedding(query)

    const conditions = [eq(knowledgeChunk.collectionName, collectionName)]
    if (ownerUuid) conditions.push(eq(knowledgeChunk.ownerUuid, ownerUuid))
    const rows = await db
      .select()
      .from(knowledgeChunk)
      .where(and(...conditions))

    const results: SearchHit[] = []
    for (const chunk of rows) {
      let score = 0
      if (queryEmbedding && chunk.embedding) {
        try {
          const chunkEmbedding = JSON.parse(chunk.embedding) as number[]
          score = cosineSimilarity(queryEmbedding, chunkEmbedding)
        } catch {
          score = keywordScore(query, chunk.content)
        }
      } else {
        score = keywordScore(query, chunk.content)
      }
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
