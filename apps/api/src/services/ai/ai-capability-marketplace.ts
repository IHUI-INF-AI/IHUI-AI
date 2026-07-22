/**
 * AI 能力市场服务。
 *
 * 提供能力"市场"视图（类比 App Store）：
 * - 发布：将能力推到市场（status=production + enabled=true）
 * - 检索：按 category / tag / 关键词搜索
 * - 排行：按使用量/评分/最新发布排序
 * - 收藏：用户可收藏能力（DB 持久化到 user_preferences 表,group=ai_marketplace_favorites）
 */

import { eq, and, ilike, desc, sql, or, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { aiCapabilities, userPreferences, type AiCapability } from '@ihui/database'

export interface MarketSearchRequest {
  keyword?: string
  category?: string
  provider?: string
  sortBy?: 'newest' | 'popular' | 'rating' | 'name'
  limit?: number
  offset?: number
}

export interface MarketSearchResult {
  items: AiCapability[]
  total: number
  limit: number
  offset: number
}

const FAVORITES_GROUP = 'ai_marketplace_favorites'

/** 用户收藏能力(DB 持久化到 user_preferences 表,group=ai_marketplace_favorites)。 */
export async function addFavorite(userId: string, capabilityId: string): Promise<void> {
  await db
    .insert(userPreferences)
    .values({
      userId,
      group: FAVORITES_GROUP,
      key: capabilityId,
      value: String(Date.now()),
    })
    .onConflictDoNothing()
}

/** 取消收藏。 */
export async function removeFavorite(userId: string, capabilityId: string): Promise<void> {
  await db
    .delete(userPreferences)
    .where(
      and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.group, FAVORITES_GROUP),
        eq(userPreferences.key, capabilityId),
      ),
    )
}

/** 列出用户收藏。 */
export async function listFavorites(userId: string): Promise<AiCapability[]> {
  const favRows = await db
    .select({ key: userPreferences.key })
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.group, FAVORITES_GROUP),
      ),
    )
  const ids = favRows.map((r) => r.key)
  if (ids.length === 0) return []
  return db.select().from(aiCapabilities).where(inArray(aiCapabilities.id, ids))
}

/** 是否已收藏。 */
export async function isFavorite(userId: string, capabilityId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userPreferences.id })
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.userId, userId),
        eq(userPreferences.group, FAVORITES_GROUP),
        eq(userPreferences.key, capabilityId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/** 搜索市场。 */
export async function searchMarket(req: MarketSearchRequest): Promise<MarketSearchResult> {
  const limit = req.limit ?? 20
  const offset = req.offset ?? 0
  const conds = [eq(aiCapabilities.enabled, true), eq(aiCapabilities.status, 'production')]
  if (req.category) conds.push(eq(aiCapabilities.category, req.category))
  if (req.provider) conds.push(eq(aiCapabilities.provider, req.provider))
  if (req.keyword) {
    conds.push(
      or(
        ilike(aiCapabilities.name, `%${req.keyword}%`),
        ilike(aiCapabilities.displayName, `%${req.keyword}%`),
        ilike(aiCapabilities.description, `%${req.keyword}%`),
      )!,
    )
  }

  let query = db
    .select()
    .from(aiCapabilities)
    .where(and(...conds))

  switch (req.sortBy) {
    case 'popular':
      query = query.orderBy(desc(aiCapabilities.qualityScore)) as typeof query
      break
    case 'rating':
      query = query.orderBy(desc(aiCapabilities.qualityScore)) as typeof query
      break
    case 'name':
      query = query.orderBy(aiCapabilities.displayName) as typeof query
      break
    case 'newest':
    default:
      query = query.orderBy(desc(aiCapabilities.createdAt)) as typeof query
  }

  const [items, totalRows] = await Promise.all([
    query.limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiCapabilities)
      .where(and(...conds)),
  ])

  return {
    items,
    total: totalRows[0]?.count ?? 0,
    limit,
    offset,
  }
}

/** 获取市场首页推荐（按 category 取 top N）。 */
export async function getMarketHomepage(
  topN = 5,
): Promise<Array<{ category: string; items: AiCapability[] }>> {
  const categories = await db
    .select({ category: aiCapabilities.category })
    .from(aiCapabilities)
    .where(and(eq(aiCapabilities.enabled, true), eq(aiCapabilities.status, 'production')))
    .groupBy(aiCapabilities.category)
  const result: Array<{ category: string; items: AiCapability[] }> = []
  for (const { category } of categories) {
    const items = await db
      .select()
      .from(aiCapabilities)
      .where(
        and(
          eq(aiCapabilities.enabled, true),
          eq(aiCapabilities.status, 'production'),
          eq(aiCapabilities.category, category),
        ),
      )
      .orderBy(desc(aiCapabilities.qualityScore))
      .limit(topN)
    result.push({ category, items })
  }
  return result
}

/** 发布到市场。 */
export async function publishToMarket(capabilityId: string): Promise<AiCapability> {
  const [updated] = await db
    .update(aiCapabilities)
    .set({ status: 'production', enabled: true, updatedAt: new Date() })
    .where(eq(aiCapabilities.id, capabilityId))
    .returning()
  if (!updated) throw new Error(`能力 ${capabilityId} 不存在`)
  return updated
}

/** 从市场下架。 */
export async function unpublishFromMarket(capabilityId: string): Promise<AiCapability> {
  const [updated] = await db
    .update(aiCapabilities)
    .set({ status: 'staging', enabled: false, updatedAt: new Date() })
    .where(eq(aiCapabilities.id, capabilityId))
    .returning()
  if (!updated) throw new Error(`能力 ${capabilityId} 不存在`)
  return updated
}

/** 热门能力（按 qualityScore + 简化热度算法）。 */
export async function getTopDownloaded(limit = 10): Promise<AiCapability[]> {
  return db
    .select()
    .from(aiCapabilities)
    .where(and(eq(aiCapabilities.enabled, true), eq(aiCapabilities.status, 'production')))
    .orderBy(desc(aiCapabilities.qualityScore))
    .limit(limit)
}
