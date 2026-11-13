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
import { getEmbeddingProvider, type EmbeddingProvider } from './embedding-provider.js'
import { parseDocument } from './document-parser.js'
import { logger } from '../utils/logger.js'

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

/** embedding 统一维度(OpenAI 标准),维度不符即视为生成失败,不得写 NULL 冒充成功 */
const EMBEDDING_DIM = 1536

/**
 * F-526:embedding 生成失败(上游抛错 / 应答缺项 / 维度不符)。
 *
 * 旧实现在 catch 里 `return null`,随后把 NULL 向量当合法值写库并照常返回成功 ——
 * key 失效、配额耗尽、上游 5xx、超时都表现为"入库成功",全库静默失去语义检索,
 * 排查只能翻库看 `embedding IS NULL`。现在失败必须显式上抛,错误体携带失败块数,
 * 调用方日志/响应都能看到 failed 计数。
 */
export class EmbeddingGenerationError extends Error {
  readonly code = 'EMBEDDING_GENERATION_FAILED'
  readonly provider: string
  readonly failedChunks: number
  readonly totalChunks: number

  constructor(provider: string, failedChunks: number, totalChunks: number, reason: string) {
    super(
      `embedding 生成失败(${provider}):${failedChunks}/${totalChunks} 块未取得 ` +
        `${EMBEDDING_DIM} 维向量,本次整批不入库(failed=${failedChunks}):${reason}`,
    )
    this.name = 'EmbeddingGenerationError'
    this.provider = provider
    this.failedChunks = failedChunks
    this.totalChunks = totalChunks
  }
}

/**
 * 检索侧 query embedding:失败/未配置返回 null 触发关键词降级(F-526:降级必须留日志)。
 *
 * 与入库侧不同,检索降级不会污染数据(只影响本次召回质量),故仍返回 null 走关键词路,
 * 但绝不再空 catch —— 失败原因结构化落日志,避免"检索静默变笨"无从排查。
 */
async function getQueryEmbedding(text: string): Promise<number[] | null> {
  const provider = getEmbeddingProvider()
  if (!provider) return null
  try {
    const results = await provider.embed([text])
    return results[0] ?? null
  } catch (err) {
    logger.warn('[knowledge-rag-service] query embedding 生成失败,降级关键词检索(F-526)', {
      provider: provider.name,
      error: err,
    })
    return null
  }
}

/**
 * F-139:入库并发闸 + 单条 insert 行数上限。
 *
 * 一次上传 5MB 文本 ≈ 1.1 万切片,原实现 `chunks.map(getEmbedding)` 会同时发起
 * 上万次 embedding 请求、再以单个 `insert().values(1.1万行)` 落库 —— PostgreSQL
 * 单语句参数上限 65535,必抛 "too many parameters";doc 已先提交,留下 chunkCount
 * 虚高的空壳文档。这里把 embedding 并发收敛到 8,insert 按 500 行一批,并把 doc 与
 * chunk 包进同一事务:任一步失败整体回滚,不再产生半截知识库。
 */
const EMBED_CONCURRENCY = 8
const CHUNK_INSERT_BATCH = 500

/**
 * F-526:入库侧单块 embedding —— 失败/维度不符一律抛错,绝不返回 null 让调用方当成功落库。
 */
async function embedForIngest(text: string, provider: EmbeddingProvider): Promise<number[]> {
  const results = await provider.embed([text])
  const vec = results[0]
  if (!vec) throw new Error('provider 未返回该条向量')
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(`向量维度 ${vec.length} ≠ ${EMBEDDING_DIM}`)
  }
  return vec
}

/**
 * 受控并发生成 embedding(顺序与输入一一对应)。
 *
 * F-526:失败不再吞成 null —— 逐块收集失败原因,由 `_ingestChunks` 决定整批失败,
 * 保证 NULL 向量不会以"成功入库"的形态落库。provider 未配置仍按既有降级语义返回
 * 空向量集(仅关键词可检索),但会留一条 warn 日志说明降级。
 */
async function embedWithConcurrency(chunks: string[]): Promise<{
  embeddings: number[][]
  failures: string[]
  providerName: string | null
}> {
  const provider = getEmbeddingProvider()
  const embeddings = new Array<number[]>(chunks.length)
  const failures: string[] = []
  if (!provider) {
    logger.warn(
      '[knowledge-rag-service] embedding provider 未配置,切片将以 NULL 向量入库且仅可关键词检索(F-526)',
      { chunkCount: chunks.length },
    )
    return { embeddings, failures, providerName: null }
  }
  let next = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++
      if (i >= chunks.length) return
      try {
        embeddings[i] = await embedForIngest(chunks[i]!, provider)
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err))
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(EMBED_CONCURRENCY, chunks.length) }, () => worker()),
  )
  return { embeddings, failures, providerName: provider.name }
}

/**
 * F-140:关键词兜底的候选上限。
 *
 * 降级路径原本 `SELECT` 该 owner+collection 的全部 chunk 到 Node 端逐条打分,
 * 知识库越大内存与 DB 压力越高,数十并发聊天即可打爆进程。这里在 SQL 侧加
 * LIMIT(仍保留 Node 端打分/排序语义),把单次候选集封顶到 2000 条。
 */
const KEYWORD_CANDIDATE_LIMIT = 2000

/**
 * F-145:检索侧「只召回 status='active' 文档」的谓词。
 *
 * 删除文档 = 软删 `knowledge_doc.status` + 物理删 `knowledge_chunk` 两步。修复前两步
 * 各自提交,第二步失败会留下「doc 已 deleted、chunk 仍在」的孤儿切片;而 search 只查
 * chunk 表、从不看 doc.status ⇒ 已删内容继续被注入聊天 prompt(隐私/合规)。向量路与
 * 关键词路都拼上本谓词后,即便历史数据里残留孤儿 chunk 或删除事务尚未提交,也不会被召回。
 *
 * 手写 SQL 而非 drizzle join:向量路本来就是手写 SQL;关键词路沿用同一谓词,不必给
 * select 增加 join、也不改变既有列投影。
 */
export const KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL = `EXISTS (
  SELECT 1 FROM "zhs_knowledge_doc" AS "d"
  WHERE "d"."id" = "zhs_knowledge_chunk"."doc_id"
    AND "d"."status" = 'active'
)`

/**
 * 导入会话的 knowledge_doc.source_type 取值(2026-10-03 立)。
 *
 * 为什么不复用 'text':会话不是纯文本,是带发言人/时间轴/来源归属的结构化记录。
 * 全仓 grep 坐实 knowledge_doc.source_type 无任何消费点按值分支(其余 sourceType
 * 命中全属 registry 域),该列是 varchar(20) 且无 CHECK 枚举约束 ⇒ 新增取值零迁移。
 * 写成 'text' 的话,将来无法把"用户导入的群聊"与"用户手打的纯文本"区分开。
 */
export const CONVERSATION_IMPORT_SOURCE_TYPE = 'conversation_import'

/** F-141:会话入库的幂等键前缀(advisory lock 键与同进程单飞键共用同一份取值,不另造第二套)。 */
const CONVERSATION_INGEST_DEDUPE_PREFIX = 'knowledge_ingest'

/**
 * F-141:同进程单飞表(键 = 幂等键)。
 *
 * 双击「加入知识库」/ 前端重试会把两条一模一样的请求几乎同时打到同一个实例;只靠写库前的
 * 复查,两条请求都会先把 embedding 跑完(钱已经花掉)。这里让后到者复用在途 Promise,
 * 整条 embedding + 写库只跑一次。条目在 task 落定时按身份比对删除,不会随请求数增长。
 */
const inFlightConversationIngest = new Map<
  string,
  Promise<{ docId: number; chunkCount: number; deduped: boolean }>
>()

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
    const ts =
      m.createdAt instanceof Date && !Number.isNaN(m.createdAt.getTime())
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

/**
 * F-387:文件解析结果为空/全空白。
 *
 * 旧实现把它当成功返回 `{ docId: 0, chunkCount: 0 }`,文档在列表里显示"已索引"却零切片,
 * 排障时无法区分"解析失败"与"真的没内容"。空内容必须作为失败上抛,由路由返回明确错误码。
 */
export class EmptyDocumentTextError extends Error {
  readonly code = 'EMPTY_DOCUMENT_TEXT'
  constructor() {
    super('文件解析结果为空,未写入知识库')
    this.name = 'EmptyDocumentTextError'
  }
}

/** F-387:目标 docId 不属于调用者或已删除 —— 不得把切片挂到他人/已删文档上。 */
export class KnowledgeDocNotFoundError extends Error {
  readonly code = 'KNOWLEDGE_DOC_NOT_FOUND'
  constructor(docId: number) {
    super(`知识文档不存在或无权访问: ${docId}`)
    this.name = 'KnowledgeDocNotFoundError'
  }
}

/** F-387:按标题反查命中多篇 —— 标题不是唯一键,必须报歧义,不得随机取一条。 */
export class AmbiguousDocTitleError extends Error {
  readonly code = 'DOC_TITLE_AMBIGUOUS'
  constructor(title: string, count: number) {
    super(`同名知识文档 ${count} 篇,无法按标题确定 docId: ${title}`)
    this.name = 'AmbiguousDocTitleError'
  }
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
    /**
     * F-141:幂等键。给定后写库事务先取 `pg_advisory_xact_lock` 串行化同键写入,
     * 锁内再查一次同键 active 文档;命中则放弃本次插入、返回既有 doc(deduped=true)。
     * 传 undefined 时行为与修复前逐字节一致(纯文本/文件入库路径不受影响)。
     */
    dedupeKey?: string
    /**
     * F-387:调用方已确定的文档主键。给定时直接把切片挂到该 doc 上(事务内校验
     * 归属与 status),不再插入新 doc,更不按标题反查 —— 标题不是唯一键。
     */
    docId?: number
  }): Promise<{ docId: number; chunkCount: number; deduped: boolean }> {
    const {
      ownerUuid,
      title,
      text,
      sourceType,
      collectionName = 'default',
      sourcePath = null,
      metadataJson = null,
      dedupeKey,
      docId,
    } = opts
    if (!text || !text.trim()) return { docId: 0, chunkCount: 0, deduped: false }
    const chunks = splitText(text)
    if (chunks.length === 0) return { docId: 0, chunkCount: 0, deduped: false }

    const contentHash = createHash('md5').update(text, 'utf8').digest('hex')
    // embedding 在事务外生成:外部 HTTP 调用不应占住数据库连接/事务。
    const { embeddings, failures, providerName } = await embedWithConcurrency(chunks)
    // F-526:任何一块没拿到 1536 维向量 ⇒ 整批失败,不写 NULL 向量冒充成功。
    // 事务尚未开始,因此不会留下半截 doc/chunk;已有 doc(ingestFile 续写)则显式标 failed。
    if (failures.length > 0) {
      logger.error('[knowledge-rag-service] embedding 生成失败,整批拒绝入库(F-526)', {
        provider: providerName,
        ownerUuid,
        docId: docId ?? null,
        collectionName,
        totalChunks: chunks.length,
        failedChunks: failures.length,
        failureSamples: failures.slice(0, 3),
      })
      if (docId !== undefined) {
        try {
          await db
            .update(knowledgeDoc)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
        } catch (markErr) {
          logger.error('[knowledge-rag-service] embedding 失败后回写 status=failed 也失败', {
            docId,
            ownerUuid,
            error: markErr,
          })
        }
      }
      throw new EmbeddingGenerationError(
        providerName ?? 'unknown',
        failures.length,
        chunks.length,
        failures[0] ?? 'unknown',
      )
    }
    const chunkRows = chunks.map((content, i) => ({
      docId: 0, // 事务内插入 doc 后回填
      collectionName,
      ownerUuid,
      chunkIndex: i,
      content,
      // vector1536 customType toDriver 自动序列化为 '[...]';仅 provider 未配置的降级路径为 NULL
      embedding: embeddings[i] ?? null,
    }))

    // F-387:调用方已带 docId ⇒ 直接挂到该 doc(唯一键路径),不插入新 doc、不反查标题。
    if (docId !== undefined) {
      return db.transaction(async (tx) => {
        const [target] = await tx
          .select({ id: knowledgeDoc.id })
          .from(knowledgeDoc)
          .where(
            and(
              eq(knowledgeDoc.id, docId),
              eq(knowledgeDoc.ownerUuid, ownerUuid),
              eq(knowledgeDoc.status, 'active'),
            ),
          )
          .limit(1)
        if (!target) throw new KnowledgeDocNotFoundError(docId)

        // 续写已有切片时接在最大 chunkIndex 之后,避免序号与既有切片重叠。
        const [last] = await tx
          .select({ chunkIndex: knowledgeChunk.chunkIndex })
          .from(knowledgeChunk)
          .where(eq(knowledgeChunk.docId, docId))
          .orderBy(desc(knowledgeChunk.chunkIndex))
          .limit(1)
        const offset = last ? last.chunkIndex + 1 : 0

        for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
          const batch = chunkRows.slice(i, i + CHUNK_INSERT_BATCH).map((row, j) => ({
            ...row,
            docId,
            chunkIndex: offset + i + j,
          }))
          await tx.insert(knowledgeChunk).values(batch)
        }
        await tx
          .update(knowledgeDoc)
          .set({
            collectionName,
            sourceType,
            contentHash,
            chunkCount: offset + chunks.length,
            updatedAt: new Date(),
          })
          .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
        return { docId, chunkCount: chunks.length, deduped: false }
      })
    }

    const result = await db.transaction(async (tx) => {
      if (dedupeKey) {
        // F-141:先查后写这段在多实例/多请求下必然双写 —— 两边 pre-check 都查不到对方,
        // 各自插入一份 doc + 一整套 chunk。事务级 advisory lock 把「复查 + 插入」收成
        // 一段互斥临界区:xact 锁随事务提交释放,后到者拿到锁时前者必已提交,复查必命中。
        // 用 hashtext 而非自增 id:锁键只需同键互斥,32 位哈希偶发碰撞的代价只是多串行一次。
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${dedupeKey}))`)
        const [dup] = await tx
          .select({ id: knowledgeDoc.id, chunkCount: knowledgeDoc.chunkCount })
          .from(knowledgeDoc)
          .where(
            and(
              eq(knowledgeDoc.ownerUuid, ownerUuid),
              eq(knowledgeDoc.contentHash, contentHash),
              eq(knowledgeDoc.sourceType, sourceType),
              eq(knowledgeDoc.collectionName, collectionName),
              eq(knowledgeDoc.status, 'active'),
            ),
          )
          .limit(1)
        if (dup) return { docId: dup.id, chunkCount: dup.chunkCount, deduped: true }
      }

      const [doc] = await tx
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

      for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
        const batch = chunkRows.slice(i, i + CHUNK_INSERT_BATCH).map((row) => ({
          ...row,
          docId: doc.id,
        }))
        await tx.insert(knowledgeChunk).values(batch)
      }
      return { docId: doc.id, chunkCount: chunks.length, deduped: false }
    })
    return result
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
   * - **幂等靠 contentHash + 两段闸(F-141)**:`content_hash` 列早就在(ingestText
   *   一直在写),但**没有**唯一索引,重复入库不会被 DB 挡住。原先只做一次"先查后写" ——
   *   并发双请求两边都查不到对方,各自入库,doc/chunk 双份、embedding 收两遍钱。
   *   现在:① 同进程内按幂等键单飞,并发第二个请求直接复用第一个的 Promise(不重复 embedding);
   *   ② 写库事务里 `pg_advisory_xact_lock` + 锁内复查,跨实例也不会产出第二份 doc/chunk。
   *   查的是 (ownerUuid, contentHash, sourceType, collectionName, status='active') 五元组:
   *   同会话重复点「加入知识库」直接命中已有 doc 返回;会话内容变了(hash 变)则视为新知识
   *   追加一篇,符合"重新导入更新知识"的直觉。
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
          // F-525:写入与检索都按 collection 分区,去重也必须带上集合,否则换集合导入被静默判重。
          eq(knowledgeDoc.collectionName, collectionName),
          eq(knowledgeDoc.status, 'active'),
        ),
      )
      .limit(1)
    if (existing[0]) {
      return { docId: existing[0].id, chunkCount: existing[0].chunkCount, deduped: true }
    }

    // F-141:两段闸。① 同进程单飞 —— 并发的第二个请求复用在途 Promise,embedding 只跑一遍;
    // ② dedupeKey 透给 _ingestChunks,由事务内 advisory lock + 锁内复查兜住跨实例并发。
    const dedupeKey = `${CONVERSATION_INGEST_DEDUPE_PREFIX}:${ownerUuid}:${collectionName}:${contentHash}`
    const running = inFlightConversationIngest.get(dedupeKey)
    // 搭车者没有新建任何东西 ⇒ 对它而言这次是判重,deduped 如实置 true。
    if (running) return running.then((r) => ({ ...r, deduped: true }))

    const task = this._ingestChunks({
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
      dedupeKey,
    })
    inFlightConversationIngest.set(dedupeKey, task)
    try {
      return await task
    } finally {
      // 只删自己那一条:期间可能有同键的新一轮请求已经把它覆盖掉。
      if (inFlightConversationIngest.get(dedupeKey) === task) {
        inFlightConversationIngest.delete(dedupeKey)
      }
    }
  }

  /**
   * F-387:按标题反查 docId 的唯一合法出口。
   *
   * 标题不是唯一键,命中多篇时无法确定切片该挂给谁 —— 旧实现在 ingestFile 里
   * `orderBy(desc(createdAt)).limit(1)` 随机取最新一条,同名文档会互相串档。
   * 因此这里一旦发现重名就抛 {@link AmbiguousDocTitleError},由调用方要求显式 docId。
   */
  async resolveDocIdByTitle(ownerUuid: string, title: string): Promise<number | null> {
    const rows = await db
      .select({ id: knowledgeDoc.id })
      .from(knowledgeDoc)
      .where(
        and(
          eq(knowledgeDoc.ownerUuid, ownerUuid),
          eq(knowledgeDoc.title, title),
          eq(knowledgeDoc.status, 'active'),
        ),
      )
      .limit(2)
    if (rows.length > 1) throw new AmbiguousDocTitleError(title, rows.length)
    return rows[0]?.id ?? null
  }

  /** 文件入库:解析多格式文件 → 切片 + embedding + 写入 knowledge_doc/knowledge_chunk
   *
   * F-387 修复要点:
   * - **docId 主键贯穿**:调用方已有 docId 就直接挂到该 doc(事务内校验归属),
   *   不再用标题反查结果定位文档;没有 docId 时由 `_ingestChunks` 插入并**返回**新 docId,
   *   彻底移除 `where(title)` + `orderBy(createdAt)` 这段非唯一键反查。
   * - **空文本即失败**:解析结果为空/全空白时抛 {@link EmptyDocumentTextError},
   *   不再返回 `{ docId: 0, chunkCount: 0 }` 的伪成功。
   * - 错误透传 UnsupportedFormatError / FileTooLargeError(由路由层转 400)。
   */
  async ingestFile(opts: {
    ownerUuid: string
    title: string
    buffer: Buffer
    mimeType: string
    filename: string
    collectionName?: string
    /** F-387:调用方已确定的文档主键;给定即直接使用,不再按标题反查。 */
    docId?: number
  }): Promise<{ docId: number; chunkCount: number }> {
    const {
      ownerUuid,
      title,
      buffer,
      mimeType,
      filename,
      collectionName = 'default',
      docId,
    } = opts
    const text = await parseDocument({ buffer, mimeType, filename })
    if (!text || !text.trim()) {
      // 目标文档已存在时把"入库失败"如实回写,避免列表里继续显示已索引但零切片。
      if (docId !== undefined) {
        await db
          .update(knowledgeDoc)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
      }
      throw new EmptyDocumentTextError()
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

    // 切片/embedding/写库与 ingestText 共用同一条路径;docId 由该方法返回或直接沿用。
    const result = await this._ingestChunks({
      ownerUuid,
      title,
      text,
      sourceType,
      collectionName,
      docId,
    })
    return { docId: result.docId, chunkCount: result.chunkCount }
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
    /** 必填：检索范围只允许是调用者本人的知识库 */
    ownerUuid: string
  }): Promise<SearchHit[]> {
    const { query, collectionName = 'default', topK = 5, scoreThreshold = 0, ownerUuid } = opts
    const queryEmbedding = await getQueryEmbedding(query)

    // 主路径:pgvector SQL 端 ANN 检索
    if (queryEmbedding && queryEmbedding.length === 1536) {
      try {
        const vectorLiteral = `[${queryEmbedding.join(',')}]`
        const whereParts = [
          sql`"collection_name" = ${collectionName}`,
          sql`"embedding" IS NOT NULL`,
          sql`"owner_uuid" = ${ownerUuid}`,
          // F-145:只召回 active 文档的切片(已删文档的残留 chunk 不得进入 RAG)
          sql.raw(KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL),
        ]

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
    const conditions = [
      eq(knowledgeChunk.collectionName, collectionName),
      eq(knowledgeChunk.ownerUuid, ownerUuid),
      // F-145:与向量路同口径,已删文档的残留 chunk 不得被关键词路召回
      sql.raw(KNOWLEDGE_ACTIVE_DOC_EXISTS_SQL),
    ]
    const rows = await db
      .select({
        id: knowledgeChunk.id,
        docId: knowledgeChunk.docId,
        content: knowledgeChunk.content,
        chunkIndex: knowledgeChunk.chunkIndex,
      })
      .from(knowledgeChunk)
      .where(and(...conditions))
      .limit(KEYWORD_CANDIDATE_LIMIT)

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
    /** 必填：上下文只允许取自调用者本人的知识库 */
    ownerUuid: string
  }): Promise<string> {
    const results = await this.search(opts)
    if (results.length === 0) return ''
    return results.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n')
  }

  /** 列出文档(F-534:分页 + 稳定排序,避免全量返回与非唯一键翻页丢行) */
  async listDocs(
    ownerUuid: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<DocSummary[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200)
    const offset = Math.max(opts.offset ?? 0, 0)
    const rows = await db
      .select()
      .from(knowledgeDoc)
      .where(and(eq(knowledgeDoc.ownerUuid, ownerUuid), eq(knowledgeDoc.status, 'active')))
      .orderBy(desc(knowledgeDoc.createdAt), desc(knowledgeDoc.id))
      .limit(limit)
      .offset(offset)
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

  /** 软删除文档(F-145:软删状态与物理删 chunk 必须在同一事务内完成) */
  async deleteDoc(docId: number, ownerUuid: string): Promise<boolean> {
    // F-145:两步原为各自独立的 `db.update` / `db.delete`,delete(chunk) 失败时 status
    // 已在库中变成 'deleted'(列表页看不到),但 chunk 仍在 ⇒ 聊天 RAG 继续召回已删内容。
    // 现在读取 + 两条写操作同事务:任一步失败整体回滚,不会出现半删状态。
    return db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: knowledgeDoc.id })
        .from(knowledgeDoc)
        .where(and(eq(knowledgeDoc.id, docId), eq(knowledgeDoc.ownerUuid, ownerUuid)))
        .limit(1)
      if (rows.length === 0) return false
      await tx
        .update(knowledgeDoc)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(eq(knowledgeDoc.id, docId))
      await tx.delete(knowledgeChunk).where(eq(knowledgeChunk.docId, docId))
      return true
    })
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
