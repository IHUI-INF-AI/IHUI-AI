// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库对话上下文取数层 (2026-09-16 新增,P1 #26 知识库默认注入主聊天)
 *
 * 聊天主链路(ai-chat-stream / chat-resume)在转发请求前,取末尾 user 消息文本(截 500 字符)
 * 作 query,调用 knowledgeRagService.search 检索 top-k 知识条目,截断后拼为
 * 【知识库检索结果】块,由 ai-chat-stream 折叠进 system_prompt 注入 LLM,
 * 让 AI 回答时自动引用用户私有知识库。
 *
 * 设计要点(与 loadRepoWikiContext 对齐):
 * - loadKnowledgeContext 全程 try/catch:任何异常(DB 抖动/检索失败)一律 warn 并返回 null,
 *   绝不把异常抛给聊天主链路。
 * - userId 为 null 时 ownerUuid 用空串(匹配全局知识,等同 loadRepoWikiContext 行为)。
 * - 每条内容超长按 KNOWLEDGE_CHUNK_MAX 截断,块整体不超过 KNOWLEDGE_MAX_CHARS,
 *   与 wiki_context 合计由调用方限制在 20000 字符内防撑爆上下文窗口。
 */

import { inArray } from 'drizzle-orm'
import { knowledgeDoc } from '@ihui/database'
import type { CitationEntry } from '@ihui/types'
import { db } from '../db/index.js'
import { knowledgeRagService } from './knowledge-rag-service.js'
import { logger } from './clawdbot/logger.js'

/** 检索 query 截断上限(末尾 user 消息文本超长截断,防 embedding/SQL 负担) */
export const KNOWLEDGE_QUERY_MAX = 500
/** 默认注入条数 */
export const KNOWLEDGE_TOP_K = 3
/** 单条知识内容截断上限 */
export const KNOWLEDGE_CHUNK_MAX = 1200
/** 知识块整体字符上限(调用方再与 wiki 合计限制在 20000 内) */
export const KNOWLEDGE_MAX_CHARS = 20000
/** 知识块标题行 */
const KNOWLEDGE_HEADER = '【知识库检索结果】'
/** 单条截断提示 */
const CHUNK_TRUNCATED_HINT = '\n…（已截断）'

export interface KnowledgeContextResult {
  /** 拼装好的知识块文本(直接拼进 system prompt 末尾) */
  block: string
  /** 命中条数 */
  hitCount: number
  /** P1 #26(2026-09-16 立):结构化引用(按文档去重,source='rag')。
   *  网关据此在流首合成 citations SSE 事件下发,前端 CitationBar 渲染知识库来源标签。 */
  citations: CitationEntry[]
}

/**
 * 按末尾 user 消息检索并拼装知识库上下文块。
 *
 * @param userId 当前用户 ID(null = 只匹配全局知识,ownerUuid 用空串)
 * @param query 末尾 user 消息文本(调用方已截断到 500 字符;为空返回 null)
 * @returns 命中返回 {block, hitCount};未命中 / 检索失败 / 入参为空 → null
 */
export async function loadKnowledgeContext(
  userId: string | null,
  query: string | null,
): Promise<KnowledgeContextResult | null> {
  if (!query || !query.trim()) return null
  const trimmedQuery = query.trim().slice(0, KNOWLEDGE_QUERY_MAX)
  let hits: Array<{ id: number; docId: number; content: string; score: number; chunkIndex: number }>
  try {
    hits = await knowledgeRagService.search({
      query: trimmedQuery,
      ownerUuid: userId ?? '',
      topK: KNOWLEDGE_TOP_K,
    })
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, queryLen: trimmedQuery.length },
      '[KnowledgeContext] 知识库检索失败,降级为不注入',
    )
    return null
  }
  if (!hits || hits.length === 0) return null

  // 批量取 doc 标题用于来源标注(命中可能来自多个文档)
  const docIds = Array.from(new Set(hits.map((h) => h.docId)))
  const titleMap = new Map<number, string>()
  try {
    const docs = await db
      .select({ id: knowledgeDoc.id, title: knowledgeDoc.title })
      .from(knowledgeDoc)
      .where(inArray(knowledgeDoc.id, docIds))
    for (const d of docs) titleMap.set(d.id, d.title)
  } catch {
    /* 标题缺失时降级为匿名来源标注 */
  }

  const parts: string[] = [KNOWLEDGE_HEADER]
  // P1 #26:按文档去重构建结构化引用(同文档多条命中只展示一个来源标签),
  // 供网关在流首合成 citations SSE 事件,前端 CitationBar 渲染 rag 来源。
  const citations: CitationEntry[] = []
  const seenDocIds = new Set<number>()
  hits.forEach((hit, i) => {
    const title = titleMap.get(hit.docId) ?? `条目 ${hit.id}`
    if (!seenDocIds.has(hit.docId)) {
      seenDocIds.add(hit.docId)
      citations.push({ source: 'rag', label: title })
    }
    const content =
      hit.content.length > KNOWLEDGE_CHUNK_MAX
        ? hit.content.slice(0, KNOWLEDGE_CHUNK_MAX) + CHUNK_TRUNCATED_HINT
        : hit.content
    parts.push(`[来源 ${i + 1}] ${title}\n${content}`)
  })

  let block = parts.join('\n\n')
  if (block.length > KNOWLEDGE_MAX_CHARS) block = block.slice(0, KNOWLEDGE_MAX_CHARS)
  return { block, hitCount: hits.length, citations }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
