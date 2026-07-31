/**
 * 中转站用户对话会话历史 service(2026-08-01 立,B 端协作场景)。
 *
 * 职责:
 * - getOrCreateConversation:按 conversation_id 查/建会话(校验 userId 归属)
 * - appendMessage:写消息 + 事务更新会话统计(message_count/total_tokens/cost/last_message_at)
 * - listConversations:分页列用户的会话(按 last_message_at DESC,可按 apiKeyId 筛选)
 * - getConversationMessages:校验归属后分页查消息(按 created_at ASC)
 * - deleteConversation:校验归属后硬删(CASCADE 删 messages)
 * - updateConversationTitle:校验归属后改 title
 *
 * 读写分离:写用 db,读用 dbRead(参照现有 service 模式)。
 */
import { randomUUID } from 'node:crypto'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
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
      .orderBy(desc(relayConversations.lastMessageAt))
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
      .orderBy(asc(relayMessages.createdAt))
      .limit(limit)
      .offset(offset),
    dbRead.select({ c: sql<number>`count(*)::int` }).from(relayMessages).where(where),
  ])

  return { items, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 5. deleteConversation(校验归属后硬删,CASCADE 删 messages)
// =============================================================================

export async function deleteConversation(
  conversationId: string,
  userId: string,
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

  await db.delete(relayConversations).where(eq(relayConversations.id, conv.id))
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
