// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, desc, asc, ilike, sql, or, isNull, lte, type SQL } from 'drizzle-orm'
import { db } from './index.js'
import {
  eduAnnouncements,
  eduMessages,
  type EduAnnouncement,
  type EduMessage,
} from '@ihui/database'

// =============================================================================
// Announcements（公告）
// =============================================================================

export interface FindAnnouncementsOpts {
  page: number
  pageSize: number
  title?: string
  isPublished?: boolean
  status?: number
  publishedOnly?: boolean
}

/**
 * 构造公告列表查询的过滤条件与排序（纯函数，便于单测固定顺序/可见性口径）。
 * - 对外(publishedOnly): 仅已发布启用，且 publishTime 为空或已到点（未来定时公告不提前可见）。
 * - 后台: 不加上界过滤，未来公告仍需可见；sort 与对外同一排序。
 */
export function buildAnnouncementListQuery(
  opts: FindAnnouncementsOpts,
  now: Date = new Date(),
): { conditions: SQL[]; orderBy: SQL[] } {
  const { title, isPublished, status, publishedOnly } = opts
  const conditions: SQL[] = []
  if (publishedOnly) {
    conditions.push(eq(eduAnnouncements.isPublished, true), eq(eduAnnouncements.status, 1))
    const publishWindow = or(
      isNull(eduAnnouncements.publishTime),
      lte(eduAnnouncements.publishTime, now),
    )
    if (publishWindow) conditions.push(publishWindow)
  } else {
    if (isPublished !== undefined) conditions.push(eq(eduAnnouncements.isPublished, isPublished))
    if (status !== undefined) conditions.push(eq(eduAnnouncements.status, status))
  }
  if (title) conditions.push(ilike(eduAnnouncements.title, `%${title}%`))

  const orderBy: SQL[] = [
    desc(eduAnnouncements.isTop),
    asc(eduAnnouncements.sort),
    desc(eduAnnouncements.publishTime),
    desc(eduAnnouncements.id),
  ]
  return { conditions, orderBy }
}

export async function findAnnouncements(
  opts: FindAnnouncementsOpts,
): Promise<{ list: EduAnnouncement[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize } = opts
  const { conditions, orderBy } = buildAnnouncementListQuery(opts)
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(eduAnnouncements)
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduAnnouncements)
    .where(where)
  const total = countRows[0]?.count ?? 0

  return { list: rows, total, page, pageSize }
}

export async function findAnnouncementById(id: string): Promise<EduAnnouncement | undefined> {
  const rows = await db.select().from(eduAnnouncements).where(eq(eduAnnouncements.id, id)).limit(1)
  return rows[0]
}

export interface CreateAnnouncementInput {
  title: string
  content?: string | null
  isPublished?: boolean
  isTop?: boolean
  publishTime?: Date | null
  sort?: number
  status?: number
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
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建公告失败')
  return row
}

export interface UpdateAnnouncementInput {
  title?: string
  content?: string | null
  isPublished?: boolean
  isTop?: boolean
  publishTime?: Date | null
  sort?: number
  status?: number
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
    .returning()
  return rows[0]
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await db.delete(eduAnnouncements).where(eq(eduAnnouncements.id, id))
}

// =============================================================================
// 站内消息（edu_messages）
// =============================================================================

export interface FindEduMessagesOpts {
  page: number
  pageSize: number
  memberId?: string
  msgType?: string
  isRead?: boolean
}

export async function findEduMessages(
  opts: FindEduMessagesOpts,
): Promise<{ list: EduMessage[]; total: number; page: number; pageSize: number }> {
  const { page, pageSize, memberId, msgType, isRead } = opts
  const conds = []
  if (memberId) conds.push(eq(eduMessages.memberId, memberId))
  if (msgType) conds.push(eq(eduMessages.msgType, msgType))
  if (isRead !== undefined) conds.push(eq(eduMessages.isRead, isRead))

  const rows = await db
    .select()
    .from(eduMessages)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(eduMessages.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduMessages)
    .where(conds.length ? and(...conds) : undefined)
  const total = countRows[0]?.count ?? 0

  return { list: rows, total, page, pageSize }
}

export async function findEduMessageById(id: string): Promise<EduMessage | undefined> {
  const rows = await db.select().from(eduMessages).where(eq(eduMessages.id, id)).limit(1)
  return rows[0]
}

/** 标记消息已读，返回更新后的记录。 */
export async function markEduMessageRead(id: string): Promise<EduMessage | undefined> {
  const rows = await db
    .update(eduMessages)
    .set({ isRead: true })
    .where(eq(eduMessages.id, id))
    .returning()
  return rows[0]
}

/** 统计用户未读消息数。 */
export async function countUnreadEduMessages(memberId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eduMessages)
    .where(and(eq(eduMessages.memberId, memberId), eq(eduMessages.isRead, false)))
  return rows[0]?.count ?? 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
