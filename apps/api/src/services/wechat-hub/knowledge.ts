// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联知识库：按账号隔离 collection，复用仓内 knowledge-rag-service。
 * 不新建向量表，也不另写一套切片逻辑；删除/检索/入库都走同一个服务。
 */

import { and, desc, eq } from 'drizzle-orm'
import { knowledgeChunk, knowledgeDoc } from '@ihui/database'
import type { WechatKnowledgeDocView, WechatKnowledgeHit } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { knowledgeRagService } from '../knowledge-rag-service.js'
import { assertAccountForUser } from './guards.js'

export function knowledgeCollection(accountId: string): string {
  return `wechat-hub:${accountId}`
}

export async function listKnowledgeDocs(
  userId: string,
  accountId: string,
): Promise<WechatKnowledgeDocView[]> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select({
      id: knowledgeDoc.id,
      title: knowledgeDoc.title,
      chunkCount: knowledgeDoc.chunkCount,
      createdAt: knowledgeDoc.createdAt,
    })
    .from(knowledgeDoc)
    .where(
      and(
        eq(knowledgeDoc.ownerUuid, userId),
        eq(knowledgeDoc.collectionName, knowledgeCollection(accountId)),
        eq(knowledgeDoc.status, 'active'),
      ),
    )
    .orderBy(desc(knowledgeDoc.createdAt))
    .limit(100)
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }))
}

export async function ingestKnowledge(
  userId: string,
  accountId: string,
  title: string,
  text: string,
): Promise<{ chunkCount: number }> {
  await assertAccountForUser(userId, accountId)
  const chunkCount = await knowledgeRagService.ingestText({
    ownerUuid: userId,
    title,
    text,
    collectionName: knowledgeCollection(accountId),
  })
  return { chunkCount }
}

export async function deleteKnowledge(
  userId: string,
  accountId: string,
  docId: number,
): Promise<{ deleted: boolean }> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select({ id: knowledgeDoc.id })
    .from(knowledgeDoc)
    .where(
      and(
        eq(knowledgeDoc.id, docId),
        eq(knowledgeDoc.ownerUuid, userId),
        eq(knowledgeDoc.collectionName, knowledgeCollection(accountId)),
      ),
    )
    .limit(1)
  if (!rows[0]) return { deleted: false }
  return { deleted: await knowledgeRagService.deleteDoc(docId, userId) }
}

/** 中文按双字滑窗打分；英文/数字仍按长度 2 的片段也可近似命中。 */
function bigrams(text: string): Set<string> {
  const cleaned = text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
  const grams = new Set<string>()
  for (let i = 0; i + 2 <= cleaned.length; i += 1) grams.add(cleaned.slice(i, i + 2))
  return grams
}

function fallbackScore(query: string, content: string): number {
  const normalized = query.trim().toLowerCase()
  if (normalized && content.toLowerCase().includes(normalized)) return 1
  const queryGrams = bigrams(query)
  if (queryGrams.size === 0) {
    const single = normalized.replace(/[\s\p{P}\p{S}]/gu, '')
    return single.length === 1 && content.toLowerCase().includes(single) ? 1 : 0
  }
  let hit = 0
  for (const gram of queryGrams) if (content.toLowerCase().includes(gram)) hit += 1
  return hit / queryGrams.size
}

/**
 * RAG 服务的关键词降级按整词切分，中文整句会被当成一个词而召回为空。
 * 这里补一层中文双字滑窗兜底：只在主检索零命中时跑，仍按 active 文档过滤。
 */
async function searchFallback(
  userId: string,
  accountId: string,
  query: string,
  topK: number,
): Promise<WechatKnowledgeHit[]> {
  const rows = await dbRead
    .select({
      id: knowledgeChunk.id,
      docId: knowledgeChunk.docId,
      content: knowledgeChunk.content,
      chunkIndex: knowledgeChunk.chunkIndex,
    })
    .from(knowledgeChunk)
    .innerJoin(knowledgeDoc, eq(knowledgeChunk.docId, knowledgeDoc.id))
    .where(
      and(
        eq(knowledgeChunk.collectionName, knowledgeCollection(accountId)),
        eq(knowledgeChunk.ownerUuid, userId),
        eq(knowledgeDoc.status, 'active'),
      ),
    )
    .limit(1000)
  return rows
    .map((row) => ({
      docId: row.docId,
      content: row.content,
      score: Number(fallbackScore(query, row.content).toFixed(4)),
      chunkIndex: row.chunkIndex,
    }))
    .filter((hit) => hit.score >= 0.05)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
}

export async function searchKnowledge(
  userId: string,
  accountId: string,
  query: string,
  topK = 5,
): Promise<WechatKnowledgeHit[]> {
  await assertAccountForUser(userId, accountId)
  const hits = await knowledgeRagService.search({
    query,
    collectionName: knowledgeCollection(accountId),
    topK: Math.min(Math.max(topK, 1), 20),
    scoreThreshold: 0.05,
    ownerUuid: userId,
  })
  if (hits.length > 0) {
    return hits.map((hit) => ({
      docId: hit.docId,
      content: hit.content,
      score: hit.score,
      chunkIndex: hit.chunkIndex,
    }))
  }
  return searchFallback(userId, accountId, query, Math.min(Math.max(topK, 1), 20))
}

/** 自动回复里 {{knowledge}} 的唯一替换口；没有命中返回空串，由调用方兜底。 */
export async function knowledgeReply(
  userId: string,
  accountId: string,
  query: string,
  topK = 3,
): Promise<string> {
  const hits = await searchKnowledge(userId, accountId, query, topK)
  return hits.map((hit) => hit.content).join('\n\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
