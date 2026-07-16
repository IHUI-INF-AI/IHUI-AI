import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  notifications,
  messages,
  users,
  comments,
  eduOrders,
  eduPointRecords,
  lessons,
  liveChannels,
  resources,
  examPapers,
  type Notification,
  type Message,
} from '@ihui/database'

// =============================================================================
// Notifications
// =============================================================================

export async function findNotificationsByUser(
  userId: string,
  opts: { page: number; pageSize: number; type?: string; unreadOnly?: boolean },
): Promise<{ list: Notification[]; total: number }> {
  const conds = [eq(notifications.userId, userId)]
  if (opts.type) conds.push(eq(notifications.type, opts.type))
  if (opts.unreadOnly) conds.push(eq(notifications.isRead, false))
  const where = and(...conds)

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/**
 * 创建单条通知。
 * data 字段为可选的 JSON 附加数据（存入 jsonb 列）。
 */
export async function createNotification(input: {
  userId: string
  type: string
  title: string
  content?: string
  data?: Record<string, unknown>
}): Promise<Notification> {
  const rows = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content ?? null,
      data: input.data ?? null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建通知失败')
  return row
}

export async function findNotificationById(id: string): Promise<Notification | undefined> {
  const rows = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1)
  return rows[0]
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
  return Number(rows[0]?.count ?? 0)
}

export async function markAsRead(id: string, userId: string): Promise<Notification | undefined> {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning()
  return rows[0]
}

export async function markAllAsRead(userId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning()
  return rows.length
}

export async function deleteNotification(
  id: string,
  userId: string,
): Promise<Notification | undefined> {
  const rows = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning()
  return rows[0]
}

// =============================================================================
// Messages / Conversations
// =============================================================================

export interface ConversationRow {
  id: string
  senderId: string
  receiverId: string
  content: string
  isRead: boolean
  createdAt: Date
  otherUserId: string
  otherNickname: string | null
  otherAvatar: string | null
}

/**
 * 查询当前用户的会话列表：每个对话对方取最近一条消息，按最后消息时间倒序。
 * 使用 ROW_NUMBER() 窗口函数取每个会话最近一条，再 join users 取对方信息。
 */
export async function findConversations(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: ConversationRow[]; total: number }> {
  const otherExpr = sql<string>`CASE WHEN ${messages.senderId} = ${userId} THEN ${messages.receiverId} ELSE ${messages.senderId} END`

  // 子查询：用 ROW_NUMBER() 窗口函数取每个会话最近一条消息
  // raw SQL 字段必须用 .as() 声明别名，否则 Drizzle 子查询引用时会报错
  const latest = db
    .select({
      id: messages.id,
      senderId: messages.senderId,
      receiverId: messages.receiverId,
      content: messages.content,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
      otherUserId: otherExpr.as('otherUserId'),
      rn: sql<number>`row_number() over (partition by ${otherExpr} order by ${messages.createdAt} desc)`.as(
        'rn',
      ),
    })
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
    .as('latest')

  const involvedWhere = or(eq(messages.senderId, userId), eq(messages.receiverId, userId))

  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: latest.id,
        senderId: latest.senderId,
        receiverId: latest.receiverId,
        content: latest.content,
        isRead: latest.isRead,
        createdAt: latest.createdAt,
        otherUserId: latest.otherUserId,
        otherNickname: users.nickname,
        otherAvatar: users.avatar,
      })
      .from(latest)
      .leftJoin(users, eq(users.id, latest.otherUserId))
      .where(eq(latest.rn, 1))
      .orderBy(desc(latest.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${otherExpr})` })
      .from(messages)
      .where(involvedWhere),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/**
 * 查询当前用户与某用户的消息历史，按时间正序（分页）。
 */
export async function findMessagesBetween(
  userId: string,
  otherUserId: string,
  page: number,
  pageSize: number,
): Promise<{ list: Message[]; total: number }> {
  const where = or(
    and(eq(messages.senderId, userId), eq(messages.receiverId, otherUserId)),
    and(eq(messages.senderId, otherUserId), eq(messages.receiverId, userId)),
  )

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(asc(messages.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(messages)
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function createMessage(
  senderId: string,
  receiverId: string,
  content: string,
): Promise<Message> {
  const rows = await db.insert(messages).values({ senderId, receiverId, content }).returning()
  const row = rows[0]
  if (!row) {
    throw new Error('创建消息失败')
  }
  return row
}

// =============================================================================
// Admin
// =============================================================================

export async function findAllNotificationsForAdmin(
  page: number,
  pageSize: number,
  opts: { type?: string; userId?: string },
): Promise<{ list: Notification[]; total: number }> {
  const conds = []
  if (opts.type) conds.push(eq(notifications.type, opts.type))
  if (opts.userId) conds.push(eq(notifications.userId, opts.userId))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(where),
  ])

  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

/**
 * 群发系统通知给所有用户。
 * 返回创建的通知列表（含 userId，便于路由层逐条推送 WebSocket）。
 */
export async function broadcastNotification(input: {
  title: string
  content: string
  type: string
}): Promise<Notification[]> {
  const allUsers = await db.select({ id: users.id }).from(users)
  if (allUsers.length === 0) return []

  const rows = await db
    .insert(notifications)
    .values(
      allUsers.map((u) => ({
        userId: u.id,
        title: input.title,
        content: input.content,
        type: input.type,
      })),
    )
    .returning()
  return rows
}

// =============================================================================
// Topic Aggregation — 通知列表业务标题/图标聚合
// =============================================================================

/**
 * 支持业务聚合的通知类型联合。
 * 10 种业务映射：
 * - order → edu_orders.order_no
 * - follow → users.nickname
 * - comment → comments.content（摘要 50 字符）
 * - like → resources.title
 * - system → 无业务查询
 * - point → edu_point_records.description
 * - course → lessons.title
 * - live → live_channels.title
 * - resource → resources.title
 * - exam → exam_papers.title
 */
export type NotificationTopicType =
  | 'order'
  | 'follow'
  | 'comment'
  | 'like'
  | 'system'
  | 'point'
  | 'course'
  | 'live'
  | 'resource'
  | 'exam'

const TOPIC_ICONS: Record<NotificationTopicType, string> = {
  order: 'order',
  follow: 'user',
  comment: 'comment',
  like: 'like',
  system: 'system',
  point: 'point',
  course: 'course',
  live: 'live',
  resource: 'resource',
  exam: 'exam',
}

const TOPIC_SUMMARY_MAX = 50

export interface NotificationTopic {
  topicTitle: string | null
  topicIcon: string | null
}

/**
 * 从通知 data 字段提取业务对象 ID。
 * 兼容多种 key 命名：bizId / businessId / targetId / orderId / commentId / userId / courseId / lessonId / liveId / examId / paperId / pointId / resourceId。
 */
function extractBizId(n: Notification): string | null {
  if (!n.data) return null
  const data = n.data as Record<string, unknown>
  const keys = [
    'bizId',
    'businessId',
    'targetId',
    'orderId',
    'commentId',
    'userId',
    'courseId',
    'lessonId',
    'liveId',
    'examId',
    'paperId',
    'pointId',
    'resourceId',
  ]
  for (const k of keys) {
    const v = data[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function truncateSummary(text: string | null): string | null {
  if (text === null) return null
  return text.length > TOPIC_SUMMARY_MAX ? text.slice(0, TOPIC_SUMMARY_MAX) + '...' : text
}

/**
 * 批量查询辅助：执行 IN 查询并构造 id → title 映射。
 * 查询失败时优雅降级返回空 Map（不抛错）。
 */
async function batchQuery(
  ids: Set<string> | undefined,
  query: (ids: string[]) => Promise<{ id: string; title: string | null }[]>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!ids || ids.size === 0) return map
  try {
    const rows = await query([...ids])
    for (const r of rows) {
      const title = truncateSummary(r.title)
      if (title !== null) map.set(r.id, title)
    }
  } catch {
    // 优雅降级：业务记录被删除或查询失败时返回空 Map
  }
  return map
}

/**
 * 通知列表业务标题聚合（批量查询优化，避免 N+1）。
 *
 * 实现思路：
 * 1. 按 type 分组，从 data 字段提取业务 ID
 * 2. 对每种类型用 IN 批量查询对应业务表
 * 3. 内存映射回 notification.id → { topicTitle, topicIcon }
 * 4. 业务记录缺失时返回 null（优雅降级）
 *
 * @param list 通知列表
 * @returns Map<notificationId, NotificationTopic>
 */
export async function getTopicMap(list: Notification[]): Promise<Map<string, NotificationTopic>> {
  const topicMap = new Map<string, NotificationTopic>()
  if (list.length === 0) return topicMap

  // 按 type 分组业务 ID
  const idsByType: Partial<Record<NotificationTopicType, Set<string>>> = {}
  for (const n of list) {
    const icon = TOPIC_ICONS[n.type as NotificationTopicType]
    if (n.type === 'system') {
      topicMap.set(n.id, { topicTitle: null, topicIcon: icon ?? null })
      continue
    }
    if (!icon) {
      // 未知类型直接返回 null（向前兼容）
      topicMap.set(n.id, { topicTitle: null, topicIcon: null })
      continue
    }
    const bizId = extractBizId(n)
    if (!bizId) {
      topicMap.set(n.id, { topicTitle: null, topicIcon: icon })
      continue
    }
    const bucket = idsByType[n.type as NotificationTopicType]
    if (bucket) bucket.add(bizId)
    else idsByType[n.type as NotificationTopicType] = new Set([bizId])
  }

  // 各类型批量查询（并行执行，每类型仅 1 次 SQL，避免 N+1）
  const [
    orderMap,
    followMap,
    commentMap,
    likeMap,
    pointMap,
    courseMap,
    liveMap,
    resourceMap,
    examMap,
  ] = await Promise.all([
    batchQuery(idsByType.order, (ids) =>
      db
        .select({ id: eduOrders.id, title: eduOrders.orderNo })
        .from(eduOrders)
        .where(inArray(eduOrders.id, ids)),
    ),
    batchQuery(idsByType.follow, (ids) =>
      db.select({ id: users.id, title: users.nickname }).from(users).where(inArray(users.id, ids)),
    ),
    batchQuery(idsByType.comment, (ids) =>
      db
        .select({ id: comments.id, title: comments.content })
        .from(comments)
        .where(inArray(comments.id, ids)),
    ),
    batchQuery(idsByType.like, (ids) =>
      db
        .select({ id: resources.id, title: resources.title })
        .from(resources)
        .where(inArray(resources.id, ids)),
    ),
    batchQuery(idsByType.point, (ids) =>
      db
        .select({ id: eduPointRecords.id, title: eduPointRecords.description })
        .from(eduPointRecords)
        .where(inArray(eduPointRecords.id, ids)),
    ),
    batchQuery(idsByType.course, (ids) =>
      db
        .select({ id: lessons.id, title: lessons.title })
        .from(lessons)
        .where(inArray(lessons.id, ids)),
    ),
    batchQuery(idsByType.live, (ids) =>
      db
        .select({ id: liveChannels.id, title: liveChannels.title })
        .from(liveChannels)
        .where(inArray(liveChannels.id, ids)),
    ),
    batchQuery(idsByType.resource, (ids) =>
      db
        .select({ id: resources.id, title: resources.title })
        .from(resources)
        .where(inArray(resources.id, ids)),
    ),
    batchQuery(idsByType.exam, (ids) =>
      db
        .select({ id: examPapers.id, title: examPapers.title })
        .from(examPapers)
        .where(inArray(examPapers.id, ids)),
    ),
  ])

  const titleLookup: Partial<Record<NotificationTopicType, Map<string, string>>> = {
    order: orderMap,
    follow: followMap,
    comment: commentMap,
    like: likeMap,
    point: pointMap,
    course: courseMap,
    live: liveMap,
    resource: resourceMap,
    exam: examMap,
  }

  // 回填每条通知的 topicTitle（system 与缺 ID 已在首轮设置）
  for (const n of list) {
    if (topicMap.has(n.id)) continue
    const type = n.type as NotificationTopicType
    const icon = TOPIC_ICONS[type] ?? null
    const bizId = extractBizId(n)
    if (!bizId) {
      topicMap.set(n.id, { topicTitle: null, topicIcon: icon })
      continue
    }
    const titleMap = titleLookup[type]
    const title = titleMap ? (titleMap.get(bizId) ?? null) : null
    topicMap.set(n.id, { topicTitle: truncateSummary(title), topicIcon: icon })
  }

  return topicMap
}

/**
 * 将通知列表附加 topicTitle / topicIcon 字段（基于 getTopicMap）。
 * 返回新数组，不修改入参。
 */
export async function attachTopicToList<T extends Notification>(
  list: T[],
): Promise<(T & NotificationTopic)[]> {
  const topicMap = await getTopicMap(list)
  return list.map((n) => {
    const t = topicMap.get(n.id)
    return {
      ...n,
      topicTitle: t?.topicTitle ?? null,
      topicIcon: t?.topicIcon ?? null,
    }
  })
}
