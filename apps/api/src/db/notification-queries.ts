import { eq, and, or, desc, asc, sql } from 'drizzle-orm';
import { db } from './index.js';
import { notifications, messages, users, type Notification, type Message } from '@ihui/database';

// =============================================================================
// Notifications
// =============================================================================

export async function findNotificationsByUser(
  userId: string,
  opts: { page: number; pageSize: number; type?: string; unreadOnly?: boolean },
): Promise<{ list: Notification[]; total: number }> {
  const conds = [eq(notifications.userId, userId)];
  if (opts.type) conds.push(eq(notifications.type, opts.type));
  if (opts.unreadOnly) conds.push(eq(notifications.isRead, false));
  const where = and(...conds);

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * 创建单条通知。
 * data 字段为可选的 JSON 附加数据（存入 jsonb 列）。
 */
export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  content?: string;
  data?: Record<string, unknown>;
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
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建通知失败');
  return row;
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(rows[0]?.count ?? 0);
}

export async function markAsRead(id: string, userId: string): Promise<Notification | undefined> {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return rows[0];
}

export async function markAllAsRead(userId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning();
  return rows.length;
}

export async function deleteNotification(id: string, userId: string): Promise<Notification | undefined> {
  const rows = await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return rows[0];
}

// =============================================================================
// Messages / Conversations
// =============================================================================

export interface ConversationRow {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  otherUserId: string;
  otherNickname: string | null;
  otherAvatar: string | null;
}

/**
 * 查询当前用户的会话列表：每个对话对方取最近一条消息，按最后消息时间倒序。
 * 使用 DISTINCT ON 子查询取每个会话最近一条，再 join users 取对方信息。
 */
export async function findConversations(
  userId: string,
  page: number,
  pageSize: number,
): Promise<{ list: ConversationRow[]; total: number }> {
  const otherExpr = sql<string>`CASE WHEN ${messages.senderId} = ${userId} THEN ${messages.receiverId} ELSE ${messages.senderId} END`;

  // 子查询：每个 other_id 取最近一条消息
  const latest = db
    .selectDistinctOn([otherExpr], {
      id: messages.id,
      senderId: messages.senderId,
      receiverId: messages.receiverId,
      content: messages.content,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
      otherUserId: otherExpr,
    })
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
    .orderBy(otherExpr, desc(messages.createdAt))
    .as('latest');

  const involvedWhere = or(eq(messages.senderId, userId), eq(messages.receiverId, userId));

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
      .orderBy(desc(latest.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(DISTINCT ${otherExpr})` }).from(messages).where(involvedWhere),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
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
  );

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(where)
      .orderBy(asc(messages.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(messages).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

export async function createMessage(
  senderId: string,
  receiverId: string,
  content: string,
): Promise<Message> {
  const rows = await db.insert(messages).values({ senderId, receiverId, content }).returning();
  const row = rows[0];
  if (!row) {
    throw new Error('创建消息失败');
  }
  return row;
}

// =============================================================================
// Admin
// =============================================================================

export async function findAllNotificationsForAdmin(
  page: number,
  pageSize: number,
  opts: { type?: string; userId?: string },
): Promise<{ list: Notification[]; total: number }> {
  const conds = [];
  if (opts.type) conds.push(eq(notifications.type, opts.type));
  if (opts.userId) conds.push(eq(notifications.userId, opts.userId));
  const where = conds.length > 0 ? and(...conds) : undefined;

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(where),
  ]);

  return { list, total: Number(totalRows[0]?.count ?? 0) };
}

/**
 * 群发系统通知给所有用户。
 * 返回创建的通知列表（含 userId，便于路由层逐条推送 WebSocket）。
 */
export async function broadcastNotification(input: {
  title: string;
  content: string;
  type: string;
}): Promise<Notification[]> {
  const allUsers = await db.select({ id: users.id }).from(users);
  if (allUsers.length === 0) return [];

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
    .returning();
  return rows;
}
