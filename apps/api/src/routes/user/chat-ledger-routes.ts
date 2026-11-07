// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 3 账本查询面(2026-11-06):上下文七类账本 / 预算停止证据 / 压缩边界。
 *
 * 归属纪律(与 DELETE /ai/chat/conversations/:id 同一条):
 *  - 路径里的 id 是 `chat_conversations.id`(账本三表的外键对象),不是 `ai_conversations`;
 *  - 不属于当前用户一律 **404**(不是 403):"别人的会话"与"不存在"必须不可区分,
 *    否则本端点就成了会话 id 的存在性探针;
 *  - 非 UUID 直接 404,不把非法串交给 PG(避免 22P02 变 500,也避免错误回显泄露语法)。
 *
 * limit:默认 20/10/20,上限 50。非法值(非数字/≤0)回落默认,超上限按 50 截断 ——
 * "上限"与"非法回落"是两条规则,不合并成 400(查询面不为难客户端)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { error, success } from '../../utils/response.js'
import { findConversationById } from '../../db/chat-queries.js'
import {
  listBudgetStops,
  listCompactionBoundaries,
  listContextLedgers,
} from '../../services/chat-ledger-store.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LIMIT = 50

const ledgerQuerySchema = {
  type: 'object',
  properties: { limit: { type: 'string' } },
  additionalProperties: false,
} as const

const ledgerParamsSchema = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
  additionalProperties: false,
} as const

function parseLimit(raw: unknown, fallback: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, MAX_LIMIT)
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value)
}

const chatLedgerRoutes: FastifyPluginAsync = async (server) => {
  /** 归属 + 存在性合并判定:不通过就 404,调用方直接 return。 */
  async function ownedConversationId(id: string, userId: string): Promise<string | null> {
    if (!UUID_RE.test(id)) return null
    const conversation = await findConversationById(id)
    if (!conversation || conversation.userId !== userId) return null
    return conversation.id
  }

  server.get(
    '/ai/chat/conversations/:id/context-ledger',
    { schema: { params: ledgerParamsSchema, querystring: ledgerQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const conversationId = await ownedConversationId(id, request.userId!)
      if (!conversationId) return reply.status(404).send(error(404, '会话不存在'))

      const limit = parseLimit((request.query as { limit?: unknown }).limit, 20)
      const rows = await listContextLedgers(conversationId, limit)
      return reply.send(
        success({
          items: rows.map((row) => ({
            id: row.id,
            conversationId: row.conversationId,
            messageId: row.messageId,
            turnIndex: row.turnIndex,
            model: row.model,
            contextLimit: row.contextLimit,
            usedTokens: row.usedTokens,
            percentage: numberOrNull(row.percentage),
            categories: row.categories,
            tokenizer: row.tokenizer,
            compacted: row.compacted,
            createdAt: iso(row.createdAt),
          })),
        }),
      )
    },
  )

  server.get(
    '/ai/chat/conversations/:id/budget-stops',
    { schema: { params: ledgerParamsSchema, querystring: ledgerQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const conversationId = await ownedConversationId(id, request.userId!)
      if (!conversationId) return reply.status(404).send(error(404, '会话不存在'))

      const limit = parseLimit((request.query as { limit?: unknown }).limit, 10)
      const rows = await listBudgetStops(conversationId, limit)
      return reply.send(
        success({
          items: rows.map((row) => ({
            id: row.id,
            conversationId: row.conversationId,
            messageId: row.messageId,
            level: row.level,
            reasonCode: row.reasonCode,
            scope: row.scope,
            pillar: row.pillar,
            usedTokens: row.usedTokens,
            limitTokens: row.limitTokens,
            usagePercent: numberOrNull(row.usagePercent),
            remainingTokens: row.remainingTokens,
            stoppedAtIteration: row.stoppedAtIteration,
            createdAt: iso(row.createdAt),
          })),
        }),
      )
    },
  )

  server.get(
    '/ai/chat/conversations/:id/compaction-boundaries',
    { schema: { params: ledgerParamsSchema, querystring: ledgerQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const conversationId = await ownedConversationId(id, request.userId!)
      if (!conversationId) return reply.status(404).send(error(404, '会话不存在'))

      const limit = parseLimit((request.query as { limit?: unknown }).limit, 20)
      const rows = await listCompactionBoundaries(conversationId, limit)
      return reply.send(
        success({
          items: rows.map((row) => ({
            id: row.id,
            conversationId: row.conversationId,
            messageId: row.messageId,
            trigger: row.trigger,
            tokensBefore: row.tokensBefore,
            tokensAfter: row.tokensAfter,
            messagesSummarized: row.messagesSummarized,
            durationMs: row.durationMs,
            preservedSegment: row.preservedSegment,
            removedRange: row.removedRange,
            createdAt: iso(row.createdAt),
          })),
        }),
      )
    },
  )
}

export default chatLedgerRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
