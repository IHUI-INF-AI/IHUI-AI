import { eq, and, asc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { cozeChatHistory, type CozeChatHistory } from '@ihui/database'

/**
 * 查询某 Coze bot + 会话的聊天历史（按时间正序，分页）。
 */
export async function findCozeChatHistory(
  botId: string,
  conversationId: string,
  page: number,
  pageSize: number,
): Promise<{ list: CozeChatHistory[]; total: number; page: number; pageSize: number }> {
  const where = and(
    eq(cozeChatHistory.botId, botId),
    eq(cozeChatHistory.conversationId, conversationId),
  )
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(cozeChatHistory)
      .where(where)
      .orderBy(asc(cozeChatHistory.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(cozeChatHistory)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}
