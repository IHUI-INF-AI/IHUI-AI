import { eq, and, desc, ilike, sql } from 'drizzle-orm';
import { db } from './index.js';
import {
  eduAnnouncements,
  eduMessages,
  type EduAnnouncement,
  type EduMessage,
} from '@ihui/database';

// =============================================================================
// Announcements（公告）
// =============================================================================

export interface FindAnnouncementsOpts {
  page: number;
  pageSize: number;
  title?: string;
  isPublished?: boolean;
  status?: number;
  publishedOnly?: boolean;
}

export async function findAnnouncements(
  opts: FindAnnouncementsOpts,
): Promise<{ list: EduAnnouncement[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, title, isPublished, status, publishedOnly } = opts;
  const conds = [];
  if (publishedOnly) {
    conds.push(eq(eduAnnouncements.isPublished, true), eq(eduAnnouncements.status, 1));
  } else {
    if (isPublished !== undefined) conds.push(eq(eduAnnouncements.isPublished, isPublished));
    if (status !== undefined) conds.push(eq(eduAnnouncements.status, status));
  }
  if (title) conds.push(ilike(eduAnnouncements.title, `%${title}%`));

  const rows = await db
    .select()
    .from(eduAnnouncements)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduAnnouncements.isTop), desc(eduAnnouncements.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduAnnouncements)
    .where(conds.length ? and(...conds) : undefined);
  const total = countRows[0]?.count ?? 0;

  return { list: rows, total, page, pageSize };
}

export async function findAnnouncementById(id: string): Promise<EduAnnouncement | undefined> {
  const rows = await db.select().from(eduAnnouncements).where(eq(eduAnnouncements.id, id)).limit(1);
  return rows[0];
}

export interface CreateAnnouncementInput {
  title: string;
  content?: string | null;
  isPublished?: boolean;
  isTop?: boolean;
  publishTime?: Date | null;
  sort?: number;
  status?: number;
}

export async function createAnnouncement(data: CreateAnnouncementInput): Promise<EduAnnouncement> {
  const rows = await db
    .insert(eduAnnouncements)
    .values({
      title: data.title,
      content: data.content,
      isPublished: data.isPublished,
      isTop: data.isTop,
      publishTime: data.publishTime,
      sort: data.sort,
      status: data.status,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建公告失败');
  return row;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string | null;
  isPublished?: boolean;
  isTop?: boolean;
  publishTime?: Date | null;
  sort?: number;
  status?: number;
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput,
): Promise<EduAnnouncement | undefined> {
  const rows = await db
    .update(eduAnnouncements)
    .set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      ...(data.isTop !== undefined ? { isTop: data.isTop } : {}),
      ...(data.publishTime !== undefined ? { publishTime: data.publishTime } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(eduAnnouncements.id, id))
    .returning();
  return rows[0];
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await db.delete(eduAnnouncements).where(eq(eduAnnouncements.id, id));
}

// =============================================================================
// 站内消息（edu_messages）
// =============================================================================

export interface FindEduMessagesOpts {
  page: number;
  pageSize: number;
  memberId?: string;
  msgType?: string;
  isRead?: boolean;
}

export async function findEduMessages(
  opts: FindEduMessagesOpts,
): Promise<{ list: EduMessage[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, memberId, msgType, isRead } = opts;
  const conds = [];
  if (memberId) conds.push(eq(eduMessages.memberId, memberId));
  if (msgType) conds.push(eq(eduMessages.msgType, msgType));
  if (isRead !== undefined) conds.push(eq(eduMessages.isRead, isRead));

  const rows = await db
    .select()
    .from(eduMessages)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduMessages.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduMessages)
    .where(conds.length ? and(...conds) : undefined);
  const total = countRows[0]?.count ?? 0;

  return { list: rows, total, page, pageSize };
}

export async function findEduMessageById(id: string): Promise<EduMessage | undefined> {
  const rows = await db.select().from(eduMessages).where(eq(eduMessages.id, id)).limit(1);
  return rows[0];
}

/** 标记消息已读，返回更新后的记录。 */
export async function markEduMessageRead(id: string): Promise<EduMessage | undefined> {
  const rows = await db
    .update(eduMessages)
    .set({ isRead: true })
    .where(eq(eduMessages.id, id))
    .returning();
  return rows[0];
}

/** 统计用户未读消息数。 */
export async function countUnreadEduMessages(memberId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduMessages)
    .where(and(eq(eduMessages.memberId, memberId), eq(eduMessages.isRead, false)));
  return rows[0]?.count ?? 0;
}
