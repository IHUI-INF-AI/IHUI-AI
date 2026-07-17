import { eq, and, desc, asc, ilike, sql, lt, gt, isNull } from 'drizzle-orm'
import { db } from './index.js'
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
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
        archivedAt: chatConversations.archivedAt,
        compressedAt: chatConversations.compressedAt,
        compressedContext: chatConversations.compressedContext,
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
      .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.updatedAt))
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
      updatedAt: new Date(),
    })
    .where(eq(chatConversations.id, id))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('更新对话失败')
  return row
}

export async function deleteConversation(id: string): Promise<void> {
  await db.delete(chatConversations).where(eq(chatConversations.id, id))
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
    // offset 分页:单次 Promise.all 获取 rows + total,不重复查询
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(chatMessages)
        .where(where)
        .orderBy(asc(chatMessages.createdAt))
        .limit(limit)
        .offset((opts.page - 1) * opts.pageSize),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(chatMessages)
        .where(where),
    ])
    list = rows
    total = Number(totalRows[0]?.count ?? 0)
    hasMore = opts.page * opts.pageSize < total
  }

  // 计算 nextCursor
  let nextCursor: string | null = null
  if (hasMore) {
    if (opts.before) {
      nextCursor = list[0]?.id ?? null
    } else {
      nextCursor = list[list.length - 1]?.id ?? null
    }
  }

  return { list, total, hasMore, nextCursor }
}

export interface CreateMessageInput {
  conversationId: string
  role?: string
  content: string
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
  patch: { content: string; tokens?: number; metadata?: unknown },
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
        createdAt: chatConversations.createdAt,
        updatedAt: chatConversations.updatedAt,
        archivedAt: chatConversations.archivedAt,
        compressedAt: chatConversations.compressedAt,
        compressedContext: chatConversations.compressedContext,
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
