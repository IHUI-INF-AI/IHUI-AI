import { eq, desc, sql } from 'drizzle-orm'
import { db } from './index.js'
import { agentReviews, users, type AgentReview } from '@ihui/database'

export interface AgentReviewWithUser extends AgentReview {
  userNickname: string | null
  userAvatar: string | null
}

/**
 * 查询某智能体的评价列表（含用户昵称/头像，按时间倒序，分页）。
 */
export async function findAgentReviews(
  agentId: string,
  page: number,
  pageSize: number,
): Promise<{ list: AgentReviewWithUser[]; total: number; page: number; pageSize: number }> {
  const where = eq(agentReviews.agentId, agentId)
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        review: agentReviews,
        userNickname: users.nickname,
        userAvatar: users.avatar,
      })
      .from(agentReviews)
      .leftJoin(users, eq(agentReviews.userId, users.id))
      .where(where)
      .orderBy(desc(agentReviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentReviews)
      .where(where),
  ])
  const list: AgentReviewWithUser[] = rows.map((r) => ({
    ...r.review,
    userNickname: r.userNickname,
    userAvatar: r.userAvatar,
  }))
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/**
 * 创建智能体评价。
 */
export async function createAgentReview(input: {
  agentId: string
  userId: string
  rating: number
  content?: string | null
}): Promise<AgentReview> {
  const rows = await db
    .insert(agentReviews)
    .values({
      agentId: input.agentId,
      userId: input.userId,
      rating: input.rating,
      content: input.content ?? null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建评价失败')
  return row
}

/**
 * 智能体平均评分（1-5 星）。
 */
export async function getAgentReviewStats(agentId: string): Promise<{
  avgRating: number
  total: number
}> {
  const rows = await db
    .select({
      avgRating: sql<number>`COALESCE(avg(${agentReviews.rating})::numeric(3,2), 0)::float8`,
      total: sql<number>`count(*)::int`,
    })
    .from(agentReviews)
    .where(eq(agentReviews.agentId, agentId))
  return { avgRating: rows[0]?.avgRating ?? 0, total: rows[0]?.total ?? 0 }
}
