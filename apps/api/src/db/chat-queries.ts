// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  eq,
  and,
  or,
  desc,
  asc,
  ilike,
  sql,
  lt,
  gt,
  gte,
  lte,
  isNull,
  isNotNull,
  inArray,
  count,
  type SQL,
} from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db, dbRead } from './index.js'
import {
  chatConversations,
  chatMessages,
  chatFavorites,
  chatMessageFeedbacks,
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

  const [rows, totalRows] = await Promise.all([
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
        historyProjectionState: chatConversations.historyProjectionState,
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

  // 2026-09-06 P0:消除 messageCount / favorite 两个"每行相关子查询"(曾造成 N+1 全表扫)。
  // 改为一次性聚合:对本页会话 id 一条 GROUP BY 取 count + 一条 IN 查收藏。
  const pageIds = rows.map((r) => r.id)
  const [countRows, favRows] = await Promise.all([
    pageIds.length
      ? db
          .select({
            conversationId: chatMessages.conversationId,
            messageCount: count(chatMessages.id),
          })
          .from(chatMessages)
          .where(inArray(chatMessages.conversationId, pageIds))
          .groupBy(chatMessages.conversationId)
      : Promise.resolve([] as { conversationId: string; messageCount: number }[]),
    pageIds.length
      ? db
          .select({ id: chatFavorites.conversationId })
          .from(chatFavorites)
          .where(
            and(eq(chatFavorites.userId, userId), inArray(chatFavorites.conversationId, pageIds)),
          )
      : Promise.resolve([] as { id: string }[]),
  ])
  const countMap = new Map(countRows.map((r) => [r.conversationId, Number(r.messageCount)]))
  const favSet = new Set(favRows.map((r) => r.id))

  const list = rows.map((r) => ({
    ...r,
    messageCount: countMap.get(r.id) ?? 0,
    favorite: favSet.has(r.id),
  }))

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
 * 仅更新对话标题(2026-09-15 立,四竞品对标 V2 #15 会话标题自动生成):
 * 带 ownership 校验(非本人对话返回 undefined),供 /conversations/:id/auto-title 使用。
 * 与 updateConversation 的区别:updateConversation 无属主校验(内部端点用),
 * 本函数先校验 userId 再 update,防越权改标题。
 */
export async function updateConversationTitle(
  id: string,
  userId: string,
  title: string,
): Promise<ChatConversation | undefined> {
  const owned = await db
    .select({ userId: chatConversations.userId })
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  const row = owned[0]
  if (!row || row.userId !== userId) return undefined

  const rows = await db
    .update(chatConversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
    .returning()
  return rows[0]
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
/**
 * 把"这次对话绑在哪个工作区"记到会话 metadata(幂等)。
 *
 * 为什么需要:AI 回答是**异步回调**落库的(ai-callback → aiCallback worker),
 * 那条链路手里只有 conversationId/userId,不知道工作区,于是"这条回答是在哪一档
 * 权限下生成的"服务端永远无法自证 —— web 的档位徽章只能活在内存里(刷新即丢,
 * 小程序/RN 完全看不到)。这里在流式入口处顺手记一笔,回调侧就能自己查权限表盖章。
 *
 * 幂等:值相同就不写(流式入口每条消息都会调一次,避免每消息多一次 DB 写)。
 * 返回 true 表示本次真的写了。
 */
export async function bindConversationWorkspace(
  id: string,
  userId: string,
  workspacePath: string,
): Promise<boolean> {
  const rows = await db
    .select({ metadata: chatConversations.metadata, owner: chatConversations.userId })
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1)
  const row = rows[0]
  // 不属主 / 找不到 → 不写(调用方是流式主链路,绝不能因此报错打断对话)
  if (!row || row.owner !== userId) return false
  const meta = (row.metadata as Record<string, unknown> | null) ?? {}
  if (meta.workspacePath === workspacePath) return false
  await db
    .update(chatConversations)
    .set({ metadata: { ...meta, workspacePath }, updatedAt: new Date() })
    .where(eq(chatConversations.id, id))
  return true
}

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

// =============================================================================
// P1 #24(2026-09-16):消息 keyset 复合游标分页
// 复合游标 (createdAt, id) 严格 keyset,解决 createdAt 相同时 offset/单键游标分页
// 会重复或遗漏的问题。旧 findMessages 的 before/after/page 模式保持不变(向后兼容)。
// =============================================================================

/** keyset 游标:续传起点 = 已读取的"最旧一条"消息的 (createdAt, id)。
 * createdAt 为 ISO 字符串(便于 JSON 序列化与 base64 传输),id 为消息 UUID。 */
export interface MessageCursor {
  createdAt: string
  id: string
}

export interface FindMessagesCursorOpts {
  /** 续传游标;initial 方向可省略(取最新一页) */
  cursor?: MessageCursor | null
  /** 单页条数(1..100) */
  limit: number
  /** initial=取最新 N 条(反转成时间正序);older=在 cursor 之前取更早的 N 条 */
  direction: 'initial' | 'older'
}

export interface FindMessagesCursorResult {
  /** 时间正序的消息列表 */
  messages: ChatMessage[]
  /** 下一页续传游标(本页最旧一条的 createdAt+id);无更多时为 null */
  nextCursor: MessageCursor | null
  /** 是否还有更早的消息 */
  hasMore: boolean
}

/**
 * 将游标序列化为前端安全的字符串(base64url(JSON))。
 * 客户端透传此字符串,无需理解内部结构;服务端 decodeMessageCursor 还原。
 */
export function encodeMessageCursor(cursor: MessageCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

/**
 * 从 base64url(JSON) 还原游标;格式非法返回 null(路由层转 400)。
 * 严格校验 createdAt/id 均为字符串,防注入/越权读取。
 */
export function decodeMessageCursor(raw: string): MessageCursor | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).createdAt === 'string' &&
      typeof (parsed as Record<string, unknown>).id === 'string'
    ) {
      const obj = parsed as Record<string, unknown>
      return { createdAt: obj.createdAt as string, id: obj.id as string }
    }
  } catch {
    return null
  }
  return null
}

/**
 * keyset 复合游标分页:
 * - initial:WHERE conversation_id = ? ORDER BY created_at DESC LIMIT limit+1,
 *   取回后反转成时间正序;nextCursor = 本页最旧一条(供 older 续传)。
 * - older:严格 keyset WHERE (created_at, id) < (cursor.createdAt, cursor.id),
 *   即 created_at < c.createdAt OR (created_at = c.createdAt AND id < c.id),
 *   ORDER BY created_at DESC LIMIT limit+1,反转成时间正序。
 * - hasMore 用 limit+1 模式判定(多取 1 条)。
 */
export async function findMessagesCursor(
  conversationId: string,
  opts: FindMessagesCursorOpts,
): Promise<FindMessagesCursorResult> {
  const where = eq(chatMessages.conversationId, conversationId)
  const limit = Math.min(Math.max(opts.limit, 1), 100)

  let condition: SQL<unknown> = where
  if (opts.direction === 'older' && opts.cursor) {
    const cCreated = new Date(opts.cursor.createdAt)
    const cId = opts.cursor.id
    // 严格 keyset:(created_at, id) < (cCreated, cId);and/or 入参恒非空,返回值可安全收窄
    const combined = and(
      where,
      or(
        lt(chatMessages.createdAt, cCreated),
        and(eq(chatMessages.createdAt, cCreated), lt(chatMessages.id, cId)),
      ),
    )
    if (!combined) throw new Error('unreachable: keyset condition builder')
    condition = combined
  }

  const rows = await db
    .select()
    .from(chatMessages)
    .where(condition)
    // 复合排序:created_at DESC + id DESC(同时间戳用 id 字典序决胜,保证 keyset 切分稳定)
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  // 取前 limit 条(反转前先切片),反转成时间正序
  const slice = hasMore ? rows.slice(0, limit) : rows
  const messages = slice.reverse()

  let nextCursor: MessageCursor | null = null
  const oldest = messages.at(0)
  if (hasMore && oldest) {
    nextCursor = { createdAt: oldest.createdAt.toISOString(), id: oldest.id }
  }

  return { messages, nextCursor, hasMore }
}

// =============================================================================
// D35 长会话 turn 分片拉取(第一段数据面)
// =============================================================================

export interface FindHistoryTurnPageOpts {
  /** 每页 turn 数;路由层已夹取,这里再兜底夹取 */
  limit: number
  /** 回放断点(turn 序号);direction=newest 时忽略 */
  cursorTurnOrdinal?: number | null
  /** newest=取最新 N turn;older=断点之前(上翻);newer=断点之后(增量续读) */
  direction: 'newest' | 'older' | 'newer'
}

export interface HistoryTurnGroup {
  turnOrdinal: number
  messages: ChatMessage[]
}

export interface FindHistoryTurnPageResult {
  /** turnOrdinal 升序 */
  turns: HistoryTurnGroup[]
  nextCursor: { turnOrdinal: number } | null
  hasMore: boolean
}

/**
 * turn 分片 keyset 分页(D35 第一段):
 * 1. 先用 DISTINCT turn_ordinal 的 keyset 窗口选出本页的 turn 集合(limit+1 判 hasMore);
 * 2. 再按 (turn_ordinal, created_at, id) 一次性取回这批 turn 的全部消息行,内存分组
 *    —— 两条轻查询,无 N+1;消息行数 = 响应体本身,不拉全量。
 * turn_ordinal 为 NULL 的存量行不可见(回填在第二段);分片语义与共享层
 * projectHistoryPage 同构(@ihui/shared/chat/history-projection)。
 */
export async function findHistoryTurnPage(
  conversationId: string,
  opts: FindHistoryTurnPageOpts,
): Promise<FindHistoryTurnPageResult> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit) || 1, 1), 100)
  const convEq = eq(chatMessages.conversationId, conversationId)
  const turnNotNull = isNotNull(chatMessages.turnOrdinal)

  // ---- 第一步:选出本页 turn 集合 ----
  let turnRows: { turnOrdinal: number }[]
  let hasMore: boolean
  if (opts.direction === 'newer') {
    // 增量续读:断点之后的最小 N 个 turn(升序)
    const ahead = await db
      .selectDistinct({ turnOrdinal: chatMessages.turnOrdinal })
      .from(chatMessages)
      .where(
        // eslint eqeqeq:!= null(含 undefined)改显式双判,语义不变
        opts.cursorTurnOrdinal !== null && opts.cursorTurnOrdinal !== undefined
          ? and(convEq, turnNotNull, gt(chatMessages.turnOrdinal, opts.cursorTurnOrdinal))
          : and(convEq, turnNotNull),
      )
      .orderBy(asc(chatMessages.turnOrdinal))
      .limit(limit + 1)
    hasMore = ahead.length > limit
    turnRows = (hasMore ? ahead.slice(0, limit) : ahead).map((r) => ({
      turnOrdinal: Number(r.turnOrdinal),
    }))
  } else {
    // newest / older:取尾部窗口(降序取 limit+1,反转成升序)
    const where =
      opts.direction === 'older' &&
      opts.cursorTurnOrdinal !== null &&
      opts.cursorTurnOrdinal !== undefined
        ? and(convEq, turnNotNull, lt(chatMessages.turnOrdinal, opts.cursorTurnOrdinal))
        : and(convEq, turnNotNull)
    const behind = await db
      .selectDistinct({ turnOrdinal: chatMessages.turnOrdinal })
      .from(chatMessages)
      .where(where)
      .orderBy(desc(chatMessages.turnOrdinal))
      .limit(limit + 1)
    hasMore = behind.length > limit
    turnRows = (hasMore ? behind.slice(0, limit) : behind)
      .map((r) => ({ turnOrdinal: Number(r.turnOrdinal) }))
      .reverse()
  }

  if (turnRows.length === 0) {
    return { turns: [], nextCursor: null, hasMore: false }
  }

  // ---- 第二步:一次取回本页 turn 的全部消息,按 turn 分组 ----
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        convEq,
        inArray(
          chatMessages.turnOrdinal,
          turnRows.map((t) => t.turnOrdinal),
        ),
      ),
    )
    // 与消息级分页同款决胜:(created_at, id) 保证同轮内顺序稳定
    .orderBy(asc(chatMessages.turnOrdinal), asc(chatMessages.createdAt), asc(chatMessages.id))

  const byTurn = new Map<number, ChatMessage[]>()
  for (const row of rows) {
    // eslint eqeqeq:== null(含 undefined)改显式双判,语义不变
    if (row.turnOrdinal === null || row.turnOrdinal === undefined) continue
    const list = byTurn.get(row.turnOrdinal)
    if (list) list.push(row)
    else byTurn.set(row.turnOrdinal, [row])
  }
  const turns: HistoryTurnGroup[] = turnRows
    .map((t) => ({ turnOrdinal: t.turnOrdinal, messages: byTurn.get(t.turnOrdinal) ?? [] }))
    .filter((g) => g.messages.length > 0)

  let nextCursor: { turnOrdinal: number } | null = null
  if (hasMore && turns.length > 0) {
    // newest/older → 页内最小 turn(供 older 上翻);newer → 页内最大 turn(供继续续读)
    const first = turns[0]
    const last = turns[turns.length - 1]
    if (first && last) {
      nextCursor = {
        turnOrdinal: opts.direction === 'newer' ? last.turnOrdinal : first.turnOrdinal,
      }
    }
  }

  return { turns, nextCursor, hasMore }
}

/** D35:turn 游标序列化(base64url JSON {turnOrdinal}),与 encodeMessageCursor 同形态 */
export function encodeHistoryCursor(cursor: { turnOrdinal: number }): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

/** D35:turn 游标还原;格式非法(含非整数序号)返回 null,路由层转 400 */
export function decodeHistoryCursor(raw: string): { turnOrdinal: number } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Number.isInteger((parsed as Record<string, unknown>).turnOrdinal)
    ) {
      return { turnOrdinal: (parsed as { turnOrdinal: number }).turnOrdinal }
    }
  } catch {
    return null
  }
  return null
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
    // D35(2026-09-24):turn 序号补齐 —— user 消息开启新轮(会话内 max+1),
    // assistant/system 沿用当前轮(无轮时归 turn 1)。并发容忍:同会话并发写
    // 可能读到同一 max 导致 turn 边界重叠,第一段按尽力而为处理,严格串行化
    // (行锁/重试)待增量回放段落接线时评估。
    const turnRows = await tx
      .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, input.conversationId))
    const maxTurn = Number(turnRows[0]?.maxTurn ?? 0)
    const role = input.role ?? 'user'
    const turnOrdinal = role === 'user' ? maxTurn + 1 : Math.max(maxTurn, 1)

    const rows = await tx
      .insert(chatMessages)
      .values({
        conversationId: input.conversationId,
        role,
        content: input.content,
        reasoning: input.reasoning,
        tokens: input.tokens,
        metadata: input.metadata as Record<string, unknown> | null,
        turnOrdinal,
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
 * 编辑重跑(2026-09-12 立,四竞品对标 P0-1,对标 Cursor/Trae 消息编辑):
 * 事务内完成两步 —— ① 更新目标用户消息的 content;
 * ② 删除该用户消息之后的所有消息(AI 回复及后续轮次全部作废)。
 * 前端随后以新内容复用 sendMessage(regenerate 模式)重新流式生成回复。
 * 校验:消息必须存在、属于该对话、且 role 为 user(只允许编辑用户消息)。
 * 返回更新后的消息;校验失败抛错由路由层转 400/404。
 */
export async function editMessageAndTruncateAfter(
  conversationId: string,
  messageId: string,
  content: string,
): Promise<ChatMessage> {
  const target = await findMessageById(messageId)
  if (!target || target.conversationId !== conversationId) {
    throw new Error('消息不存在或不属于该对话')
  }
  if (target.role !== 'user') {
    throw new Error('只能编辑用户消息')
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(chatMessages)
      .set({ content })
      .where(eq(chatMessages.id, messageId))
      .returning()
    const message = updated[0]
    if (!message) throw new Error('消息更新失败')

    // 删除该用户消息之后的所有消息(createdAt > target.createdAt,严格大于保留自身)
    await tx
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          gt(chatMessages.createdAt, target.createdAt),
        ),
      )

    // 同步 lastMessageAt 到最后一条剩余消息(编辑消息自身必在,故非 null;仍按剩余最大值取)
    const last = await tx
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)
    await tx
      .update(chatConversations)
      .set({ lastMessageAt: last[0]?.createdAt ?? null, updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId))

    return message
  })
}

/**
 * 分支:基于指定消息(含该消息)之前的所有消息创建新会话(事务)。
 * - 新会话复制源会话的 title/model/systemPrompt
 * - 消息逐条复制到新会话(生成新 UUID 避免主键冲突,保留 createdAt 时间线)
 * - metadata 写入 originalConversationId 供溯源
 * - W17(2026-09-14):metadata 额外写入 forkedFromMessageId(分叉点消息)、
 *   forkedFromMessageCount(复制的历史条数)、forkedAt(分叉时间),
 *   供前端会话列表「分支来源」标注与分支树溯源
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
          // D35:分支复制保留源消息的 turn 序号(分叉后的 turn 结构与源一致)
          turnOrdinal: m.turnOrdinal,
        })),
      )
    }
    // W17(2026-09-14):补写分叉点元数据(分叉点消息 id / 复制条数 / 分叉时间)
    await tx
      .update(chatConversations)
      .set({
        metadata: {
          ...sourceMeta,
          originalConversationId: conversationId,
          forkedFromMessageId: messageId,
          forkedFromMessageCount: history.length,
          forkedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, conv.id))
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
      // D35(2026-09-24):重插流按 role 重算 turn 序号 —— user 消息开启新轮,
      // assistant/system 沿用当前轮;压缩摘要(通常 system/user 开头)自然归入 turn 1。
      let turnCounter = 0
      await tx.insert(chatMessages).values(
        messages.map((m) => {
          if (m.role === 'user') turnCounter += 1
          return {
            id: m.id ?? crypto.randomUUID(),
            conversationId,
            role: m.role,
            content: m.content,
            reasoning: m.reasoning ?? undefined,
            tokens: m.tokens ?? null,
            metadata: m.metadata ?? null,
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            turnOrdinal: m.role === 'user' ? turnCounter : Math.max(turnCounter, 1),
          }
        }),
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

/**
 * D49①(2026-09-23):消息点赞/点踩落库 —— upsert 语义(一人一消息一票,改票覆盖)。
 * 归属校验前置:消息必须存在且其会话属于该用户,否则 not-found(不区分不存在/无权)。
 *
 * D64⑤(2026-09-26):反馈问卷化扩展 —— reason(五类原因)/comment(≤500)结构化落库。
 * 零迁移硬约束:chat_message_feedbacks 无对应列,packages/database 本票禁改,
 * 故借 chat_messages.metadata jsonb(既有可写字段)单语句 `||` 原子合并写入
 * `feedbackSurvey` 键(不读改写,不覆盖他人键;重复提交按键覆盖 = 最新一票为准)。
 * 残余边界:updateMessage(patch.metadata) 是整体替换式写 metadata,流式刚结束的
 * 短窗口内理论上可覆盖本键;评分行(chat_message_feedbacks)不受影响,仅问卷附言可能丢。
 */
export type MessageRating = 'like' | 'dislike'

/** D64⑤ 问卷结构化答案(均可选;reason 五类点踩细分,comment 用户补充说明) */
export interface MessageFeedbackSurvey {
  reason?: 'inaccurate' | 'incomplete' | 'offTopic' | 'style' | 'other'
  comment?: string
}

export async function rateChatMessage(
  userId: string,
  messageId: string,
  rating: MessageRating,
  survey?: MessageFeedbackSurvey,
): Promise<{ ok: boolean; reason?: 'not-found' }> {
  const owned = await db
    .select({ conversationId: chatMessages.conversationId })
    .from(chatMessages)
    .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
    .where(and(eq(chatMessages.id, messageId), eq(chatConversations.userId, userId)))
    .limit(1)
  const conv = owned[0]
  if (!conv) return { ok: false, reason: 'not-found' }
  await db
    .insert(chatMessageFeedbacks)
    .values({ userId, messageId, conversationId: conv.conversationId, rating })
    .onConflictDoUpdate({
      target: [chatMessageFeedbacks.userId, chatMessageFeedbacks.messageId],
      set: { rating, updatedAt: new Date() },
    })
  // D64⑤:只在确实带了结构化答案时追加写入(旧载荷零额外语句,行为与 D49① 逐字节一致)
  if (survey?.reason || survey?.comment) {
    const patch: Record<string, unknown> = { rating, answeredAt: new Date().toISOString() }
    if (survey.reason) patch.reason = survey.reason
    if (survey.comment) patch.comment = survey.comment
    await db
      .update(chatMessages)
      .set({
        metadata: sql`coalesce(${chatMessages.metadata}, '{}'::jsonb) || ${JSON.stringify({ feedbackSurvey: patch })}::jsonb`,
      })
      .where(eq(chatMessages.id, messageId))
  }
  return { ok: true }
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

  const [rows, totalRows] = await Promise.all([
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
        historyProjectionState: chatConversations.historyProjectionState,
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

  // 2026-09-06 P0:与 findConversationsByUser 一致,消除 messageCount 每行相关子查询(N+1),
  // 改对本页会话 id 一次性 GROUP BY 取 count。
  const pageIds = rows.map((r) => r.id)
  const countRows = pageIds.length
    ? await db
        .select({
          conversationId: chatMessages.conversationId,
          messageCount: count(chatMessages.id),
        })
        .from(chatMessages)
        .where(inArray(chatMessages.conversationId, pageIds))
        .groupBy(chatMessages.conversationId)
    : []
  const countMap = new Map(countRows.map((r) => [r.conversationId, Number(r.messageCount)]))

  const list = rows.map((r) => ({
    ...r,
    messageCount: countMap.get(r.id) ?? 0,
  }))

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
