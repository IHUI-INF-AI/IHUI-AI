// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转站用户对话会话历史 service(2026-08-01 立,B 端协作场景)。
 *
 * 职责:
 * - getOrCreateConversation:按 conversation_id 查/建会话(校验 userId 归属)
 * - appendMessage:写消息 + 事务更新会话统计(message_count/total_tokens/cost/last_message_at)
 * - listConversations:分页列用户的会话(按 last_message_at DESC,可按 apiKeyId 筛选)
 * - getConversationMessages:校验归属后分页查消息(按 created_at ASC)
 * - deleteConversation:校验归属后硬删(CASCADE 删 messages),返回库确认已删除的行 id 集合
 * - updateConversationTitle:校验归属后改 title
 *
 * 读写分离:写用 db,读用 dbRead(参照现有 service 模式)。
 */
import { randomUUID, createHash } from 'node:crypto'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { logger } from '../utils/logger.js'
import {
  relayConversations,
  relayMessages,
  type RelayConversation,
  type RelayMessage,
} from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface GetOrCreateConversationInput {
  /** 用户传入的 conversation_id;未传则自动生成 conv_<uuid16> */
  conversationId?: string
  userId: string
  apiKeyId: string
  model: string
  /** 首条 user message(用于提取 title 前 50 字符) */
  firstUserMessage: string
}

export interface AppendMessageInput {
  /** relay_conversations.id(UUID 主键) */
  conversationDbId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  logId?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  costCents?: number
  latencyMs?: number
  status?: 'success' | 'error'
  errorMessage?: string
  metadata?: Record<string, unknown>
}

export interface ListConversationsOptions {
  limit?: number
  offset?: number
  apiKeyId?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
}

// =============================================================================
// 辅助函数
// =============================================================================

/** 从首条消息提取 title(前 50 字符,trim) */
function extractTitle(message: string): string {
  return message.slice(0, 50).trim() || '新会话'
}

// =============================================================================
// 1. getOrCreateConversation
// =============================================================================

export async function getOrCreateConversation(
  input: GetOrCreateConversationInput,
): Promise<RelayConversation> {
  const { conversationId, userId, apiKeyId, model, firstUserMessage } = input

  // 若传入 conversationId,先查现有(校验 userId 归属)
  if (conversationId) {
    const [existing] = await dbRead
      .select()
      .from(relayConversations)
      .where(eq(relayConversations.conversationId, conversationId))
      .limit(1)

    if (existing) {
      if (existing.userId !== userId) {
        throw new Error('conversation_id 已被其他用户占用')
      }
      return existing
    }
  }

  // 未传入或未找到 → 创建新会话
  const newConversationId = conversationId ?? `conv_${randomUUID().slice(0, 16)}`
  const title = extractTitle(firstUserMessage)

  const [created] = await db
    .insert(relayConversations)
    .values({
      conversationId: newConversationId,
      userId,
      apiKeyId,
      title,
      model,
    })
    .returning()

  if (!created) throw new Error('创建会话失败')
  return created
}

// =============================================================================
// 2. appendMessage(事务:写消息 + 更新会话统计)
// =============================================================================

export async function appendMessage(input: AppendMessageInput): Promise<RelayMessage> {
  const {
    conversationDbId,
    role,
    content,
    model,
    logId,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    costCents = 0,
    latencyMs,
    status = 'success',
    errorMessage,
    metadata,
  } = input

  return db.transaction(async (tx) => {
    // F-538 幂等:同一调用日志的同一角色只落一条 —— 上游重试/链路重放会让
    // recordCall 之后的写入被重复触发,靠 logId + role 去重避免统计重复累加。
    if (logId) {
      const [existing] = await tx
        .select()
        .from(relayMessages)
        .where(and(eq(relayMessages.logId, logId), eq(relayMessages.role, role)))
        .limit(1)
      if (existing) return existing
    }

    // 写消息
    const [message] = await tx
      .insert(relayMessages)
      .values({
        conversationId: conversationDbId,
        role,
        content,
        model,
        logId,
        promptTokens,
        completionTokens,
        totalTokens,
        costCents,
        latencyMs,
        status,
        errorMessage,
        metadata: metadata ?? {},
      })
      .returning()

    if (!message) throw new Error('写入消息失败')

    // 同步更新会话统计(message_count + 1,累加 tokens/cost,刷新 last_message_at/updated_at/model)
    await tx
      .update(relayConversations)
      .set({
        messageCount: sql`${relayConversations.messageCount} + 1`,
        totalTokens: sql`${relayConversations.totalTokens} + ${totalTokens}`,
        totalCostCents: sql`${relayConversations.totalCostCents} + ${costCents}`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        ...(model ? { model } : {}),
      })
      .where(eq(relayConversations.id, conversationDbId))

    return message
  })
}

// =============================================================================
// 2b. relay 完成链路写入口(F-538)
// =============================================================================

/**
 * 中转站会话 id 派生:写入方是 /v1/chat/completions 这类无客户端会话标识的代理链路,
 * 因此按「userId + model」复用同一条会话(稳定键,不会跨用户串号)。
 */
export function deriveRelayConversationId(userId: string, model: string): string {
  return `conv_${createHash('sha1').update(`${userId}:${model}`).digest('hex').slice(0, 32)}`
}

export interface RecordRelayTurnInput {
  userId: string
  apiKeyId: string
  model: string
  /** 本轮发给上游的完整 prompt(与 recordCall.prompt 同源) */
  promptText: string
  /** 上游返回的正文 */
  responseText: string
  /** llm_call_logs.id,幂等键 */
  logId: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  costCents?: number
  latencyMs?: number
  errorMessage?: string
}

/**
 * 在 relay 完成链路落一轮会话历史(user message + assistant message)。
 *
 * 只由完成链路在拿到 logId 后调用;失败向上抛由调用方 fire-and-forget 告警,
 * 不影响已完成的补全响应。write 侧只写库,不参与计费。
 */
export async function recordRelayConversationTurn(input: RecordRelayTurnInput): Promise<void> {
  const conversation = await getOrCreateConversation({
    conversationId: deriveRelayConversationId(input.userId, input.model),
    userId: input.userId,
    apiKeyId: input.apiKeyId,
    model: input.model,
    firstUserMessage: input.promptText,
  })

  await appendMessage({
    conversationDbId: conversation.id,
    role: 'user',
    content: input.promptText,
    model: input.model,
    logId: input.logId,
  })
  await appendMessage({
    conversationDbId: conversation.id,
    role: 'assistant',
    content: input.responseText,
    model: input.model,
    logId: input.logId,
    promptTokens: input.promptTokens ?? 0,
    completionTokens: input.completionTokens ?? 0,
    totalTokens: input.totalTokens ?? 0,
    costCents: input.costCents ?? 0,
    latencyMs: input.latencyMs,
    status: input.errorMessage ? 'error' : 'success',
    errorMessage: input.errorMessage,
  })
}

/** fire-and-forget 包装:任何失败只 warn,绝不影响主链路。 */
export function recordRelayConversationTurnSafe(input: RecordRelayTurnInput): void {
  void recordRelayConversationTurn(input).catch((e: unknown) => {
    logger.warn('[relay-conversation] 会话历史写入失败', {
      err: e instanceof Error ? e : new Error(String(e)),
      conversationKey: `${input.userId}:${input.model}`,
      logId: input.logId,
    })
  })
}

// =============================================================================
// 3. listConversations(分页,按 last_message_at DESC)
// =============================================================================

export async function listConversations(
  userId: string,
  options: ListConversationsOptions = {},
): Promise<PaginatedResult<RelayConversation>> {
  const limit = options.limit ?? 20
  const offset = options.offset ?? 0

  const conds = [eq(relayConversations.userId, userId)]
  if (options.apiKeyId) {
    conds.push(eq(relayConversations.apiKeyId, options.apiKeyId))
  }
  const where = and(...conds)

  const [items, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(relayConversations)
      .where(where)
      // F-539:last_message_at 非唯一,翻页需要主键 tie-breaker 防边界丢行/重复。
      .orderBy(desc(relayConversations.lastMessageAt), asc(relayConversations.id))
      .limit(limit)
      .offset(offset),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(relayConversations)
      .where(where),
  ])

  return { items, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 4. getConversationMessages(校验归属,分页,按 created_at ASC)
// =============================================================================

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedResult<RelayMessage>> {
  const limit = options.limit ?? 50
  const offset = options.offset ?? 0

  // 先校验会话归属(conversationId 这里是用户可见的 string id,非 UUID 主键)
  const [conv] = await dbRead
    .select({ id: relayConversations.id })
    .from(relayConversations)
    .where(
      and(
        eq(relayConversations.conversationId, conversationId),
        eq(relayConversations.userId, userId),
      ),
    )
    .limit(1)

  if (!conv) {
    throw new Error('会话不存在或无权访问')
  }

  const where = eq(relayMessages.conversationId, conv.id)
  const [items, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(relayMessages)
      .where(where)
      // F-539:created_at 同毫秒时以主键破平,保证 offset 分页稳定。
      .orderBy(asc(relayMessages.createdAt), asc(relayMessages.id))
      .limit(limit)
      .offset(offset),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(relayMessages)
      .where(where),
  ])

  return { items, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 5. deleteConversation(校验归属后硬删,CASCADE 删 messages)
// =============================================================================

/**
 * 删除会话(校验归属后硬删,CASCADE 删 messages)。
 *
 * 归属不存在/不属于该用户 **仍按原契约 throw**(路由据此回 404,客户端契约不变);
 * throw 之外的另一格真相由返回值给:归属校验与 DELETE 之间那一行仍可能被别人删掉,
 * 所以返回**库确认已删除的行 id 集合**,让路由的 `deleted` 布尔有库侧依据。
 */
export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<string[]> {
  // 校验归属
  const [conv] = await dbRead
    .select({ id: relayConversations.id })
    .from(relayConversations)
    .where(
      and(
        eq(relayConversations.conversationId, conversationId),
        eq(relayConversations.userId, userId),
      ),
    )
    .limit(1)

  if (!conv) {
    throw new Error('会话不存在或无权访问')
  }

  const rows = await db
    .delete(relayConversations)
    .where(eq(relayConversations.id, conv.id))
    .returning({ id: relayConversations.id })
  return rows.map((r) => r.id)
}

// =============================================================================
// 6. updateConversationTitle(校验归属后改 title)
// =============================================================================

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string,
): Promise<void> {
  // 校验归属
  const [conv] = await dbRead
    .select({ id: relayConversations.id })
    .from(relayConversations)
    .where(
      and(
        eq(relayConversations.conversationId, conversationId),
        eq(relayConversations.userId, userId),
      ),
    )
    .limit(1)

  if (!conv) {
    throw new Error('会话不存在或无权访问')
  }

  await db
    .update(relayConversations)
    .set({ title: title.slice(0, 200), updatedAt: new Date() })
    .where(eq(relayConversations.id, conv.id))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
