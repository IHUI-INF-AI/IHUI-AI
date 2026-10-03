// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 导入会话的 knowledge_doc.source_type 取值(2026-10-03 立)。
 *
 * 为什么不复用 'text':会话不是纯文本,是带发言人/时间轴/来源归属的结构化记录。
 * 全仓 grep 坐实 knowledge_doc.source_type 无任何消费点按值分支(其余 sourceType
 * 命中全属 registry 域),该列是 varchar(20) 且无 CHECK 枚举约束 ⇒ 新增取值零迁移。
 * 写成 'text' 的话,将来无法把"用户导入的群聊"与"用户手打的纯文本"区分开。
 */
export const CONVERSATION_IMPORT_SOURCE_TYPE = 'conversation_import'

/**
 * 把会话消息拼成一份可入库的转录文本。
 *
 * 逐条 `[时间] 发言人：正文`,微信来源的发言人已由解析器写进正文前缀
 * (`昵称：正文`,wechat.py 定稿不改),这里原样保留,不去二次解析 ——
 * 二次解析等于把"发言人是谁"这件事在两个正则实现之间再漂一次。
 *
 * 时间戳缺失时省略该前缀(而不是塞 Import 时刻 —— 那等于往知识库里写假时间)。
 */
export function buildConversationTranscript(
  messages: Array<{ role: string; content: string; createdAt?: Date | null }>,
): string {
  const lines: string[] = []
  for (const m of messages) {
    const content = m.content?.trim()
    if (!content) continue
    const ts = m.createdAt instanceof Date && !Number.isNaN(m.createdAt.getTime())
      ? m.createdAt.toISOString()
      : ''
    lines.push(ts ? `[${ts}] ${content}` : content)
  }
  return lines.join('\n')
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
  /**
   * 文本入库的**唯一实现**(切片 + embedding + 写 knowledge_doc + knowledge_chunk)。
   *
   * 2026-10-03:原先这段逻辑直接写在 `ingestText` 里,现下沉为 `_ingestChunks` 私有出口,
   * `ingestText` / `ingestConversation` 两个公开入口都走它 —— 新增来源(导入会话)
   * 复用同一条分块/向量化/入库路径,而不是另写一套再漂移。
   *
   * @param opts.sourceType 落到 knowledge_doc.source_type 的取值
   * @param opts.sourcePath 可选来源路径(溯源用,如 `conversation:<id>`)
   * @param opts.metadataJson 可选元数据(JSON 字符串,存 conversationId 等回溯信息)
   * @returns 新建的 docId 与切片数
   */
  private async _ingestChunks(opts: {
    ownerUuid: string
    title: string
    text: string
    sourceType: string
    collectionName?: string
    sourcePath?: string | null
    metadataJson?: string | null
  }): Promise<{ docId: number; chunkCount: number }> {
    const {
      ownerUuid,
      title,
      text,
      sourceType,
      collectionName = 'default',
      sourcePath = null,
      metadataJson = null,
    } = opts
    if (!text || !text.trim()) return { docId: 0, chunkCount: 0 }
    const chunks = splitText(text)
    if (chunks.length === 0) return { docId: 0, chunkCount: 0 }

    const contentHash = createHash('md5').update(text, 'utf8').digest('hex')
    const [doc] = await db
      .insert(knowledgeDoc)
      .values({
        ownerUuid,
        collectionName,
        title,
        sourceType,
        sourcePath,
        contentHash,
        chunkCount: chunks.length,
        status: 'active',
        metadataJson,
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
    return { docId: doc.id, chunkCount: chunks.length }
  }

  /** 文本入库, 返回切片数量 */
  async ingestText(opts: {
    ownerUuid: string
    title: string
    text: string
    collectionName?: string
  }): Promise<number> {
    const { ownerUuid, title, text, collectionName = 'default' } = opts
    const { chunkCount } = await this._ingestChunks({
      ownerUuid,
      title,
      text,
      sourceType: 'text',
      collectionName,
    })
    return chunkCount
  }

  /**
   * 外部导入会话入库(2026-10-03 立,"导入的会话进知识库、可被 RAG 检索"那一层)。
   *
   * 背景:导入管道只把会话落进 chat_conversations + chat_messages,知识库入库路径
   * (ingestText / ingestFile)只认文件与纯文本 ⇒ 用户导一堆微信群聊记录进来,内容躺在
   * 会话表里,`knowledgeRagService.search` 永远召不回,等于死文字。本方法补这条缺口。
   *
   * 设计要点:
   * - **复用 `_ingestChunks`**(与文件/纯文本入库同一条分块 + embedding + 写库路径),
   *   不另写一套入库。
   * - **sourceType 用 `conversation_import`** 而非 `text`:会话不是纯文本,是带
   *   发言人/时间轴/来源归属的结构化记录。全仓 grep 坐实 knowledge_doc.source_type
   *   没有任何消费点按值分支(其余 sourceType 命中全属 registry 域),且该列是
   *   varchar(20) 无 CHECK 枚举约束 ⇒ 新增取值零迁移、零破坏。将来要按来源过滤/展示
   *   时这个值就是唯一抓手;若图省事写 `text`,事后无法与"用户手打的纯文本"区分。
   * - **幂等靠 contentHash**:`content_hash` 列早就在(ingestText 一直在写),但**没有**
   *   唯一索引,重复入库不会被 DB 挡住 ⇒ 这里显式"先查后写"。查的是
   *   (ownerUuid, contentHash, sourceType, status='active') 四元组:同会话重复点
   *   「加入知识库」直接命中已有 doc 返回,不产生第二批重复 chunk;会话内容变了
   *   (hash 变)则视为新知识追加一篇,符合"重新导入更新知识"的直觉。
   * - **失败向上抛**,由路由层写 conversation_imports 留痕(见 conversation-knowledge.ts),
   *   绝不在此静默吞掉。
   */
  async ingestConversation(opts: {
    ownerUuid: string
    conversationId: string
    title: string
    source: string
    /** 按时间升序的会话消息 */
    messages: Array<{ role: string; content: string; createdAt?: Date | null }>
    collectionName?: string
  }): Promise<{ docId: number; chunkCount: number; deduped: boolean }> {
    const { ownerUuid, conversationId, title, source, messages, collectionName = 'default' } = opts
    const text = buildConversationTranscript(messages)
    if (!text) return { docId: 0, chunkCount: 0, deduped: false }

    // 幂等:同 owner + 同内容指纹 + 同来源类型已入库 → 直接复用,不重复切 chunk
    const contentHash = createHash('md5').update(text, 'utf8').digest('hex')
    const existing = await db
      .select({ id: knowledgeDoc.id, chunkCount: knowledgeDoc.chunkCount })
      .from(knowledgeDoc)
      .where(
        and(
          eq(knowledgeDoc.ownerUuid, ownerUuid),
          eq(knowledgeDoc.contentHash, contentHash),
          eq(knowledgeDoc.sourceType, CONVERSATION_IMPORT_SOURCE_TYPE),
          eq(knowledgeDoc.status, 'active'),
        ),
      )
      .limit(1)
    if (existing[0]) {
      return { docId: existing[0].id, chunkCount: existing[0].chunkCount, deduped: true }
    }

    const { docId, chunkCount } = await this._ingestChunks({
      ownerUuid,
      title,
      text,
      sourceType: CONVERSATION_IMPORT_SOURCE_TYPE,
      collectionName,
      // 溯源:一眼看出这篇知识来自哪个会话(与 source_type 配合,便于回溯与人工清理)
      sourcePath: `conversation:${conversationId}`,
      metadataJson: JSON.stringify({
        conversationId,
        importedFrom: source,
        messageCount: messages.length,
        ingestedVia: 'conversation-import',
      }),
    })
    return { docId, chunkCount, deduped: false }
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
    // sourceType 用 mimeType 简化值:pdf/docx/markdown/text/html/xlsx/xls/csv
    const sourceType = mimeType?.startsWith('application/pdf')
      ? 'pdf'
      : mimeType?.includes('wordprocessingml')
        ? 'docx'
        : mimeType === 'text/markdown'
          ? 'markdown'
          : mimeType === 'text/html'
            ? 'html'
            : mimeType?.includes('spreadsheetml') || mimeType?.includes('macroEnabled.12')
              ? 'xlsx'
              : mimeType === 'application/vnd.ms-excel'
                ? 'xls'
                : mimeType === 'text/csv'
                  ? 'csv'
                  : mimeType === 'text/plain'
                    ? 'text'
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
