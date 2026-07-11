import { eq, desc, sql } from 'drizzle-orm'
import { dbRead } from './index.js'
import { messagePrivateLetter, users } from '@ihui/database'

export interface PrivateLetterAdminRow {
  id: number
  senderId: string
  senderName: string | null
  receiverId: string
  receiverName: string | null
  content: string
  isRead: boolean
  createdAt: Date
}

export interface PrivateLetterAdminListResult {
  list: PrivateLetterAdminRow[]
  total: number
}

/**
 * 管理端私信列表查询（联表 users 获取发送者/接收者名称）
 */
export async function findPrivateLettersForAdmin(params: {
  page?: number
  pageSize?: number
}): Promise<PrivateLetterAdminListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const list = await dbRead
    .select({
      id: messagePrivateLetter.id,
      senderId: messagePrivateLetter.senderId,
      senderName: users.nickname,
      receiverId: messagePrivateLetter.receiverId,
      receiverName: sql<string | null>`u2.nickname`,
      content: messagePrivateLetter.content,
      isRead: messagePrivateLetter.isRead,
      createdAt: messagePrivateLetter.createdAt,
    })
    .from(messagePrivateLetter)
    .leftJoin(users, eq(users.id, messagePrivateLetter.senderId))
    .leftJoin(sql`users u2`, eq(sql`u2.id`, messagePrivateLetter.receiverId))
    .orderBy(desc(messagePrivateLetter.createdAt))
    .limit(pageSize)
    .offset(offset)

  const countResult = await dbRead
    .select({ count: sql<number>`count(*)::int` })
    .from(messagePrivateLetter)

  return { list, total: countResult[0]?.count ?? 0 }
}
