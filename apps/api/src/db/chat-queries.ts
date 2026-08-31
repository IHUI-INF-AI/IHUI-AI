// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, asc, ilike, sql, lt, gt, gte, lte, isNull, inArray } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db, dbRead } from './index.js'
import {
  chatConversations,
  chatMessages,
  chatFavorites,
  type ChatConversation,
  type ChatMessage,
} from '@ihui/database'

// =============================================================================
// 对话
// =============================================================================

export interface CreateConversationInput {
  userId: string
  title?: string
  model?: string
  systemPrompt?: string
  metadata?: unknown
}

export async function createConversation(
  input: CreateConversationInput,
): Promise<ChatConversation> {
  const rows = await db
    .insert(chatConversations)
    .values({
      userId: input.userId,
      title: input.title,
      model: input.model,
      systemPrompt: input.systemPrompt,
      metadata: input.metadata as Record<string, unknown> | null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建对话失败')
  return row
}

export interface ListConversationsOpts {
  page: number
  pageSize: number
  search?: string
  includeArchived?: boolean
}

export async function findConversationsByUser(
  userId: string,
  opts: ListConversationsOpts,
): Promise<{
  list: (ChatConversation & { messageCount: number; favorite: boolean })[]
  total: number
}> {
  const conds = [eq(chatConversations.userId, userId)]
  if (opts.search) conds.push(ilike(chatConversations.title, `%${opts.search}%`))
  if (!opts.includeArchived) conds.push(isNull(chatConversations.archivedAt))
  const where = and(...conds)

  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: chatConversations.id,
        userId: chatConversations.userId,
        title: chatConversations.title,
        model: chatConversations.model,
        systemPrompt: chatConversations.systemPrompt,
        metadata: chatConversations.metadata,
        lastMessageAt: chatConversations.lastMessageAt,
        lastReadAt: chatConversations.lastReadAt,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
        archivedAt: chatConversations.archivedAt,
        compressedAt: chatConversations.compressedAt,
        compressedContext: chatConversations.compressedContext,
        shareToken: chatConversations.shareToken,
        pinned: chatConversations.pinned,
        pinnedAt: chatConversations.pinnedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${chatMessages} WHERE ${chatMessages.conversationId} = ${sql.raw('chat_conversations.id')}
        )`,
        favorite: sql<boolean>`EXISTS(
          SELECT 1 FROM ${chatFavorites}
          WHERE ${chatFavorites.userId} = ${userId}
            AND ${chatFavorites.conversationId} = ${sql.raw('chat_conversations.id')}
        )`,
      })
      .from(chatConversations)
      .where(where)
      // 2026-08-30 置顶排序:pinned=true 的置顶会话按 pinnedAt 倒序排最前;
      // 非置顶会话 pinnedAt 为 null 不影响,保持原有 lastMessageAt/updatedAt 排序(向后兼容)。
      .orderBy(
        desc(chatConversations.pinned),
        desc(chatConversations.pinnedAt),
        desc(chatConversations.lastMessageAt),
        desc(chatConversations.updatedAt),
      )
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatConversations)
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findConversationById(id: string): Promise<ChatConversation | undefined> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  return rows[0]
}

export interface UpdateConversationInput {
  title?: string
  model?: string
  systemPrompt?: string
  metadata?: unknown
  pinned?: boolean
}

export async function updateConversation(
  id: string,
  data: UpdateConversationInput,
): Promise<ChatConversation> {
  const rows = await db
    .update(chatConversations)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.model !== undefined && { model: data.model }),
      ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
      ...(data.metadata !== undefined && {
        metadata: data.metadata as Record<string, unknown> | null,
      }),
      // 置顶/取消置顶:pinned=true 记录 pinnedAt 用于置顶排序,false 清空 pinnedAt
      ...(data.pinned !== undefined && {
        pinned: data.pinned,
        pinnedAt: data.pinned ? new Date() : null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('更新对话失败')
  return row
}

/**
 * 仅更新对话的 metadata 字段(merge 模式,不覆盖未传入的 key)。
 * 用于 AI 主动提问挂起状态持久化:在 chat_conversations.metadata.pendingQuestion 写入/清除挂起状态。
 *
 * 设计权衡(2026-07-21):
 * - 用 conversation.metadata 而非 message.metadata,因为前端 onQuestion 时 assistantMessageId
 *   是前端 UUID(占位),DB id 要等 ai-callback 完成后才落地,无法立即持久化到 message.metadata
 * - conversation.metadata 是对话级挂起状态,语义"该对话当前有未回答的提问"
 * - 用户回答后 /chat/answer 清除 pendingQuestion(merge 模式,不动其他 key)
 *
 * 与 updateConversation 的区别:
 * - updateConversation 是覆盖模式(metadata 整体替换)
 * - patchConversationMetadata 是 merge 模式(只更新传入的 key,保留其他 key)
 *
 * userId 用于 ownership 校验,防止越权修改他人对话的 metadata。
 * 返回更新后的对话;若对话不存在或不属于该用户则返回 undefined。
 */
export async function patchConversationMetadata(
  id: string,
  userId: string,
  metadataMerge: Record<string, unknown>,
): Promise<ChatConversation | undefined> {
  // 先校验对话属于该用户(ownership check)
  const existing = await db
    .select({ metadata: chatConversations.metadata, userId: chatConversations.userId })
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  const row = existing[0]
  if (!row || row.userId !== userId) return undefined

  const existingMeta = (row.metadata as Record<string, unknown> | null) ?? {}
  const mergedMetadata = { ...existingMeta, ...metadataMerge }

  const updated = await db
    .update(chatConversations)
    .set({ metadata: mergedMetadata, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  return updated[0]
}

export async function deleteConversation(id: string): Promise<void> {
  await db.delete(chatConversations).where(eq(chatConversations.id, id))
}

// =============================================================================
// 批量操作(2026-07-31 立,对话历史批量删除/收藏/归档)
// 统一用 userId + inArray(ids) 一次过滤,防越权操作他人对话
// =============================================================================

/** 批量删除对话(级联删除消息 + 收藏,由 schema onDelete: cascade 保证) */
export async function deleteConversationsBatch(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .delete(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
    .returning({ id: chatConversations.id })
  return rows.length
}

/** 批量收藏对话(只收藏属于自己的对话,onConflictDoNothing 防重复) */
export async function favoriteConversationsBatch(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  // 先过滤属于自己的 ids,防止收藏他人对话
  const owned = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
  if (owned.length === 0) return 0
  await db
    .insert(chatFavorites)
    .values(owned.map((r) => ({ userId, conversationId: r.id })))
    .onConflictDoNothing({ target: [chatFavorites.userId, chatFavorites.conversationId] })
  return owned.length
}

/** 批量取消收藏(只删自己的 favorites 行,安全) */
export async function unfavoriteConversationsBatch(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .delete(chatFavorites)
    .where(and(eq(chatFavorites.userId, userId), inArray(chatFavorites.conversationId, ids)))
    .returning({ id: chatFavorites.id })
  return rows.length
}

/** 批量归档/取消归档对话(只更新自己的对话) */
export async function setConversationsArchivedBatch(
  userId: string,
  ids: string[],
  archived: boolean,
): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .update(chatConversations)
    .set({ archivedAt: archived ? sql`now()` : null, updatedAt: new Date() })
    .where(and(eq(chatConversations.userId, userId), inArray(chatConversations.id, ids)))
    .returning({ id: chatConversations.id })
  return rows.length
}

export async function archiveConversation(id: string): Promise<ChatConversation> {
  const rows = await db
    .update(chatConversations)
    .set({ archivedAt: sql`now()`, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('归档对话失败')
  return row
}

export async function unarchiveConversation(id: string): Promise<ChatConversation> {
  const rows = await db
    .update(chatConversations)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('取消归档失败')
  return row
}

export async function findMessagesForExport(id: string): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.createdAt))
}

export async function saveCompressedContext(
  id: string,
  compressedContext: string,
): Promise<ChatConversation> {
  const rows = await db
    .update(chatConversations)
    .set({ compressedContext, compressedAt: sql`now()`, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('保存压缩上下文失败')
  return row
}

// =============================================================================
// 消息
// =============================================================================

export interface ListMessagesOpts {
  page: number
  pageSize: number
  before?: string // 游标:返回此 message id 之前的消息(用于加载更早的历史)
  after?: string // 游标:返回此 message id 之后的消息(用于加载新消息)
}

export async function findMessages(
  conversationId: string,
  opts: ListMessagesOpts,
): Promise<{ list: ChatMessage[]; total: number; hasMore: boolean; nextCursor: string | null }> {
  const where = eq(chatMessages.conversationId, conversationId)
  const limit = Math.min(opts.pageSize, 100) // 上限 100

  let list: ChatMessage[]
  let hasMore = false
  let total = 0

  if (opts.before) {
    // 游标模式(before):不需要 total,仅用 hasMore 判断
    const cursorMsg = await findMessageById(opts.before)
    if (!cursorMsg) {
      return { list: [], total: 0, hasMore: false, nextCursor: null }
    }
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(where, lt(chatMessages.createdAt, cursorMsg.createdAt)))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit + 1)
    hasMore = rows.length > limit
    list = hasMore ? rows.slice(0, limit) : rows
    list.reverse()
  } else if (opts.after) {
    // 游标模式(after):不需要 total
    const cursorMsg = await findMessageById(opts.after)
    if (!cursorMsg) {
      return { list: [], total: 0, hasMore: false, nextCursor: null }
    }
    const rows = await db
      .select()
      .from(chatMessages)
      .where(and(where, gt(chatMessages.createdAt, cursorMsg.createdAt)))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit + 1)
    hasMore = rows.length > limit
    list = hasMore ? rows.slice(0, limit) : rows
  } else {
    // offset 分页:按 createdAt desc 取页 + reverse 成正序,page=1 = 最新页(聊天 UI 行业惯例)
    // nextCursor = list[0]?.id(本页最旧一条),供前端 before 续传加载更早历史
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(chatMessages)
        .where(where)
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
        .offset((opts.page - 1) * opts.pageSize),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chatMessages)
        .where(where),
    ])
    list = rows.reverse()
    total = Number(totalRows[0]?.count ?? 0)
    hasMore = opts.page * opts.pageSize < total
  }

  // 计算 nextCursor(供前端 before 续传加载更早历史)
  let nextCursor: string | null = null
  if (hasMore) {
    // before / offset 模式:list[0] 是当前页最旧一条,作为下次 before 的 cursor
    // after 模式:list[length-1] 是当前页最新一条,作为下次 after 的 cursor
    if (opts.after) {
      nextCursor = list[list.length - 1]?.id ?? null
    } else {
      nextCursor = list[0]?.id ?? null
    }
  }

  return { list, total, hasMore, nextCursor }
}

/** 分享页面专用：走只读副本，无数量上限 */
export async function findMessagesForShare(id: string): Promise<ChatMessage[]> {
  return dbRead
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.createdAt))
}

export interface CreateMessageInput {
  conversationId: string
  role?: string
  content: string
  reasoning?: string
  tokens?: number
  metadata?: unknown
}

/**
 * 创建消息并同步更新 conversation.lastMessageAt / updatedAt。
 * 使用 DB 事务包裹，保证消息插入与对话时间更新原子性。
 */
export async function createMessage(input: CreateMessageInput): Promise<ChatMessage> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(chatMessages)
      .values({
        conversationId: input.conversationId,
        role: input.role ?? 'user',
        content: input.content,
        reasoning: input.reasoning,
        tokens: input.tokens,
        metadata: input.metadata as Record<string, unknown> | null,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('创建消息失败')

    // 同步最近消息时间(仅当新消息时间晚于现有 lastMessageAt,避免并发倒置)
    // 注意: 必须用 lt() 运算符而非 sql`... ${date}` 模板
    // sql 模板绕过 Drizzle mapToDriverValue, 直接传 Date 给 postgres-js Bind,
    // 而 driver.js transparentParser 覆盖了 timestamp serializer 导致 Date 原样到达
    // Buffer.byteLength 报 ERR_INVALID_ARG_TYPE; lt() 会经过 mapToDriverValue 正确转换
    await tx
      .update(chatConversations)
      .set({ lastMessageAt: row.createdAt, updatedAt: new Date() })
      .where(
        and(
          eq(chatConversations.id, input.conversationId),
          lt(chatConversations.lastMessageAt, row.createdAt),
        ),
      )

    return row
  })
}

export async function findMessageById(id: string): Promise<ChatMessage | undefined> {
  const rows = await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1)
  return rows[0]
}

/**
 * 更新消息内容(用于 AI 回调填充占位 assistant 消息)。
 * userId 用于权限校验(确保只能更新自己会话的消息)。
 * 返回更新后的消息,若消息不存在或不属于该用户则返回 undefined。
 */
export async function updateMessage(
  id: string,
  userId: string,
  patch: { content: string; reasoning?: string; tokens?: number; metadata?: unknown },
): Promise<ChatMessage | undefined> {
  // 先校验消息所属会话属于该用户(通过 join conversations)
  const target = await db
    .select({ messageId: chatMessages.id, conversationId: chatMessages.conversationId })
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .limit(1)
  const row = target[0]
  if (!row) return undefined

  const conv = await db
    .select({ userId: chatConversations.userId })
    .from(chatConversations)
    .where(eq(chatConversations.id, row.conversationId))
    .limit(1)
  if (!conv[0] || conv[0].userId !== userId) return undefined

  const updated = await db
    .update(chatMessages)
    .set({
      content: patch.content,
      ...(patch.reasoning !== undefined && { reasoning: patch.reasoning }),
      tokens: patch.tokens ?? null,
      metadata: patch.metadata as Record<string, unknown> | null,
    })
    .where(eq(chatMessages.id, id))
    .returning()
  return updated[0]
}

export async function deleteMessage(id: string): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.id, id))
}

/**
 * 清空对话所有消息，但保留对话记录本身。
 * 事务化:删除消息 + 同步将 conversation.lastMessageAt 置 null,保证状态一致。
 */
export async function clearMessages(conversationId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId))
    await tx
      .update(chatConversations)
      .set({ lastMessageAt: null, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))
  })
}

// =============================================================================
// 重新生成 / 分支(2026-08-30 立,AI 对话 4 项交互能力之二/三)
// =============================================================================

/**
 * 重新生成:删除指定 AI 消息及其之后的所有消息(事务)。
 * 保留该 AI 消息之前的所有消息,供前端"截断到该消息之前 + 重新发送前一条用户问题"。
 * 同步更新 conversation.lastMessageAt 为剩余消息中最晚一条(无则置 null)。
 * 返回 { regeneratedFrom: messageId, remainingCount } 由路由层包装。
 */
export async function regenerateConversationMessages(
  conversationId: string,
  messageId: string,
): Promise<{ regeneratedFrom: string; remainingCount: number }> {
  const target = await findMessageById(messageId)
  if (!target || target.conversationId !== conversationId) {
    throw new Error('消息不存在或不属于该对话')
  }

  return db.transaction(async (tx) => {
    // 删除目标消息及之后的所有消息(createdAt >= target.createdAt)
    await tx
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          gte(chatMessages.createdAt, target.createdAt),
        ),
      )

    // 同步 lastMessageAt 到最后一条剩余消息(或 null)
    const last = await tx
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
    const lastMessageAt = last[0]?.createdAt ?? null
    await tx
      .update(chatConversations)
      .set({ lastMessageAt, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))

    const remaining = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
    return { regeneratedFrom: messageId, remainingCount: Number(remaining[0]?.count ?? 0) }
  })
}

/**
 * 分支:基于指定消息(含该消息)之前的所有消息创建新会话(事务)。
 * - 新会话复制源会话的 title/model/systemPrompt
 * - 消息逐条复制到新会话(生成新 UUID 避免主键冲突,保留 createdAt 时间线)
 * - metadata 写入 originalConversationId 供溯源
 * 返回新创建的会话。
 */
export async function branchConversationFrom(
  conversationId: string,
  messageId: string,
  input: { userId: string; title?: string; model?: string; systemPrompt?: string },
): Promise<ChatConversation> {
  const target = await findMessageById(messageId)
  if (!target || target.conversationId !== conversationId) {
    throw new Error('消息不存在或不属于该对话')
  }
  const source = await findConversationById(conversationId)
  if (!source) throw new Error('对话不存在')

  return db.transaction(async (tx) => {
    const sourceMeta = (source.metadata as Record<string, unknown> | null) ?? {}
    const created = await tx
      .insert(chatConversations)
      .values({
        userId: input.userId,
        title: input.title ?? source.title,
        model: input.model ?? source.model,
        systemPrompt: input.systemPrompt !== undefined ? input.systemPrompt : source.systemPrompt,
        metadata: { ...sourceMeta, originalConversationId: conversationId },
      })
      .returning()
    const conv = created[0]
    if (!conv) throw new Error('创建分支对话失败')

    // 复制目标消息及之前的所有消息(时间正序)
    const history = await tx
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          lte(chatMessages.createdAt, target.createdAt),
        ),
      )
      .orderBy(asc(chatMessages.createdAt))
    if (history.length > 0) {
      await tx.insert(chatMessages).values(
        history.map((m) => ({
          conversationId: conv.id,
          role: m.role,
          content: m.content,
          reasoning: m.reasoning ?? undefined,
          tokens: m.tokens,
          metadata: m.metadata as Record<string, unknown> | null,
          createdAt: m.createdAt,
        })),
      )
    }
    return conv
  })
}

/**
 * 原子性地替换对话的所有消息(用于自动压缩后持久化压缩结果)。
 * 事务化:删除旧消息 + 批量插入新消息,保证前后一致。
 */
export async function replaceMessages(
  conversationId: string,
  messages: Array<{
    id?: string
    role: string
    content: string
    reasoning?: string | null
    createdAt?: Date | string
    tokens?: number | null
    metadata?: Record<string, unknown> | null
  }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(chatMessages).where(eq(chatMessages.conversationId, conversationId))
    if (messages.length > 0) {
      await tx.insert(chatMessages).values(
        messages.map((m) => ({
          id: m.id ?? crypto.randomUUID(),
          conversationId,
          role: m.role,
          content: m.content,
          reasoning: m.reasoning ?? undefined,
          tokens: m.tokens ?? null,
          metadata: m.metadata ?? null,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        })),
      )
    }
  })
}

// =============================================================================
// 收藏
// =============================================================================

/**
 * 收藏对话。幂等：已收藏则返回 false(未实际插入),新收藏返回 true。
 * 使用 ON CONFLICT DO NOTHING 依赖 (user_id, conversation_id) 唯一约束,消除 check-then-act 竞态。
 */
export async function favoriteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const rows = await db
    .insert(chatFavorites)
    .values({ userId, conversationId })
    .onConflictDoNothing({
      target: [chatFavorites.userId, chatFavorites.conversationId],
    })
    .returning()
  return rows.length > 0
}

export async function unfavoriteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const rows = await db
    .delete(chatFavorites)
    .where(and(eq(chatFavorites.userId, userId), eq(chatFavorites.conversationId, conversationId)))
    .returning()
  return rows.length > 0
}

export async function findFavoriteConversations(
  userId: string,
  opts: { page: number; pageSize: number },
): Promise<{
  list: (ChatConversation & {
    messageCount: number
    favorite: boolean
    favoriteId: string
    favoriteCreatedAt: Date
  })[]
  total: number
}> {
  const where = and(eq(chatFavorites.userId, userId), eq(chatConversations.userId, userId))

  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: chatConversations.id,
        userId: chatConversations.userId,
        title: chatConversations.title,
        model: chatConversations.model,
        systemPrompt: chatConversations.systemPrompt,
        metadata: chatConversations.metadata,
        lastMessageAt: chatConversations.lastMessageAt,
        lastReadAt: chatConversations.lastReadAt,
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
        archivedAt: chatConversations.archivedAt,
        compressedAt: chatConversations.compressedAt,
        compressedContext: chatConversations.compressedContext,
        shareToken: chatConversations.shareToken,
        pinned: chatConversations.pinned,
        pinnedAt: chatConversations.pinnedAt,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${chatMessages} WHERE ${chatMessages.conversationId} = ${sql.raw('chat_conversations.id')}
        )`,
        favorite: sql<boolean>`TRUE`,
        favoriteId: chatFavorites.id,
        favoriteCreatedAt: chatFavorites.createdAt,
      })
      .from(chatFavorites)
      .innerJoin(chatConversations, eq(chatFavorites.conversationId, chatConversations.id))
      .where(where)
      .orderBy(desc(chatFavorites.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(chatFavorites)
      .innerJoin(chatConversations, eq(chatFavorites.conversationId, chatConversations.id))
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function setConversationShareToken(
  id: string,
  userId: string,
): Promise<{ conversation: ChatConversation; token: string }> {
  const existing = await findConversationById(id)
  if (!existing) throw new Error('对话不存在')
  if (existing.userId !== userId) throw new Error('无权操作该对话')
  // 强制生成新的随机 token，不复用已有的 shareToken
  const token = randomBytes(8).toString('hex')
  const rows = await db
    .update(chatConversations)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('设置分享 token 失败')
  return { conversation: row, token }
}

export async function findConversationByShareToken(
  token: string,
): Promise<ChatConversation | undefined> {
  const rows = await dbRead
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.shareToken, token))
    .limit(1)
  return rows[0]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
