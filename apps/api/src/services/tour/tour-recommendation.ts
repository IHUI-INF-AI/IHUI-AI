/**
 * 旅游推荐算法服务。
 *
 * 多策略推荐：
 * - hot: 按热度（viewCount + likeCount）排序
 * - nearby: 按目的地匹配
 * - similar_user: 相似用户也看过（基于协同过滤，简化版）
 * - content_based: 基于标签相似度（TF-IDF + cosine）
 *
 * 推荐结果写入 tour_recommendations 表，前端可直接读取。
 */

import { and, eq, ne, desc, sql, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { tourContent, tourRecommendations } from '@ihui/database'

export type RecommendationStrategy = 'hot' | 'nearby' | 'similar_user' | 'content_based'

export interface RecommendationRequest {
  userId: string
  limit?: number
  strategy?: RecommendationStrategy
  excludeContentIds?: string[]
  destination?: string
}

export interface RecommendationItem {
  contentId: string
  score: number
  reason: string[]
  strategy: RecommendationStrategy
}

const DEFAULT_LIMIT = 20

/** 热度推荐：按 viewCount * 0.6 + likeCount * 4 综合排序。 */
export async function recommendHot(limit = DEFAULT_LIMIT): Promise<RecommendationItem[]> {
  const rows = await db
    .select({
      id: tourContent.id,
      title: tourContent.title,
      views: tourContent.viewCount,
      likes: tourContent.likeCount,
    })
    .from(tourContent)
    .where(eq(tourContent.status, 'published'))
    .orderBy(desc(sql`${tourContent.viewCount} * 0.6 + ${tourContent.likeCount} * 4`))
    .limit(limit)

  const maxScore = rows[0] ? rows[0].views * 0.6 + rows[0].likes * 4 : 1
  return rows.map((r) => ({
    contentId: r.id,
    score: maxScore > 0 ? (r.views * 0.6 + r.likes * 4) / maxScore : 0,
    reason: ['hot'],
    strategy: 'hot' as const,
  }))
}

/** 附近推荐：按目的地匹配。 */
export async function recommendNearby(
  destination: string,
  limit = DEFAULT_LIMIT,
): Promise<RecommendationItem[]> {
  const rows = await db
    .select({ id: tourContent.id, views: tourContent.viewCount })
    .from(tourContent)
    .where(and(eq(tourContent.status, 'published'), eq(tourContent.destination, destination)))
    .orderBy(desc(tourContent.viewCount))
    .limit(limit)
  return rows.map((r) => ({
    contentId: r.id,
    score: 0.7,
    reason: ['nearby', `destination:${destination}`],
    strategy: 'nearby' as const,
  }))
}

/** 基于标签的内容相似度推荐（TF-IDF + cosine 简化版）。 */
export async function recommendContentBased(
  seedContentId: string,
  limit = DEFAULT_LIMIT,
): Promise<RecommendationItem[]> {
  const [seed] = await db.select().from(tourContent).where(eq(tourContent.id, seedContentId))
  if (!seed) return []
  const seedTags = (seed.tags as string[]) ?? []
  if (seedTags.length === 0) return []

  const candidates = await db
    .select({ id: tourContent.id, tags: tourContent.tags })
    .from(tourContent)
    .where(and(eq(tourContent.status, 'published'), ne(tourContent.id, seedContentId)))
    .limit(200)

  return candidates
    .map((c) => {
      const tags = (c.tags as string[]) ?? []
      const intersection = tags.filter((t) => seedTags.includes(t))
      const union = Array.from(new Set([...tags, ...seedTags]))
      const score = union.length > 0 ? intersection.length / union.length : 0
      return {
        contentId: c.id,
        score,
        reason: [`similar_to:${seedContentId}`, `tags:${intersection.join(',')}`],
        strategy: 'content_based' as const,
      }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** 相似用户推荐：找到看过同内容的其他用户，推荐他们看过但当前用户未看过的。 */
export async function recommendSimilarUser(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<RecommendationItem[]> {
  // 当前用户已看过的内容
  const myContent = await db
    .select({ contentId: tourRecommendations.contentId })
    .from(tourRecommendations)
    .where(eq(tourRecommendations.userId, userId))
  const myIds = myContent.map((r) => r.contentId)
  if (myIds.length === 0) return []

  // 其他用户也看过这些内容的记录
  const otherRows = await db
    .select({
      otherUser: tourRecommendations.userId,
      contentId: tourRecommendations.contentId,
    })
    .from(tourRecommendations)
    .where(inArray(tourRecommendations.contentId, myIds))
    .limit(500)

  // 找出"相似用户"（与当前用户看过相同内容 ≥ 1 的其他用户）
  const similarUsers = new Set<string>()
  for (const r of otherRows) {
    if (r.otherUser !== userId) similarUsers.add(r.otherUser)
  }
  if (similarUsers.size === 0) return []

  // 这些相似用户看过、但当前用户未看过的内容
  const candidateRows = await db
    .select({
      contentId: tourRecommendations.contentId,
      count: sql<number>`count(*)::int`,
    })
    .from(tourRecommendations)
    .where(inArray(tourRecommendations.userId, Array.from(similarUsers)))
    .groupBy(tourRecommendations.contentId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit * 2)

  const filtered = candidateRows.filter((r) => !myIds.includes(r.contentId))
  const maxCount = filtered[0]?.count ?? 1
  return filtered.slice(0, limit).map((r) => ({
    contentId: r.contentId,
    score: r.count / maxCount,
    reason: ['similar_user'],
    strategy: 'similar_user' as const,
  }))
}

/** 主推荐入口：根据 strategy 路由到具体算法，结果写入 DB。 */
export async function recommend(req: RecommendationRequest): Promise<RecommendationItem[]> {
  const limit = req.limit ?? DEFAULT_LIMIT
  const strategy = req.strategy ?? 'hot'
  let items: RecommendationItem[] = []
  if (strategy === 'hot') items = await recommendHot(limit)
  else if (strategy === 'nearby' && req.destination) {
    items = await recommendNearby(req.destination, limit)
  } else if (strategy === 'similar_user') {
    items = await recommendSimilarUser(req.userId, limit)
  } else if (strategy === 'content_based') {
    items = await recommendContentBased(req.excludeContentIds?.[0] ?? '', limit)
  }

  // 排除黑名单
  if (req.excludeContentIds?.length) {
    items = items.filter((i) => !req.excludeContentIds!.includes(i.contentId))
  }

  // 持久化到 tour_recommendations
  if (items.length > 0) {
    await db.insert(tourRecommendations).values(
      items.map((i) => ({
        userId: req.userId,
        contentId: i.contentId,
        score: i.score,
        reason: i.reason,
        strategy: i.strategy,
        clicked: false,
        dismissed: false,
      })),
    )
  }
  return items
}

/** 标记推荐被点击（用于 CTR 统计）。 */
export async function markClicked(userId: string, contentId: string): Promise<void> {
  await db
    .update(tourRecommendations)
    .set({ clicked: true })
    .where(
      and(eq(tourRecommendations.userId, userId), eq(tourRecommendations.contentId, contentId)),
    )
}

/** 标记推荐被忽略。 */
export async function markDismissed(userId: string, contentId: string): Promise<void> {
  await db
    .update(tourRecommendations)
    .set({ dismissed: true })
    .where(
      and(eq(tourRecommendations.userId, userId), eq(tourRecommendations.contentId, contentId)),
    )
}
