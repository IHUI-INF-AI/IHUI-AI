import { and, asc, desc, eq, ilike, isNotNull, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  aiWorldCategories,
  aiWorldItems,
  aiWorldRankings,
  aiWorldSyncLog,
  type AiWorldCategory,
  type AiWorldItem,
  type AiWorldRanking,
  type AiWorldSyncLog as SyncLogRow,
} from '@ihui/database'

export type ItemKind = 'news' | 'paper' | 'project' | 'tool' | 'app'

export async function findAiWorldCategories(): Promise<AiWorldCategory[]> {
  return db
    .select()
    .from(aiWorldCategories)
    .where(eq(aiWorldCategories.status, 1))
    .orderBy(asc(aiWorldCategories.sort), asc(aiWorldCategories.id))
}

export async function findAiWorldCategoryBySlug(slug: string): Promise<AiWorldCategory | undefined> {
  const rows = await db
    .select()
    .from(aiWorldCategories)
    .where(eq(aiWorldCategories.slug, slug))
    .limit(1)
  return rows[0]
}

export async function findAiWorldItemById(id: string): Promise<AiWorldItem | undefined> {
  const rows = await db.select().from(aiWorldItems).where(eq(aiWorldItems.id, id)).limit(1)
  return rows[0]
}

export interface ListItemsOptions {
  kind?: ItemKind
  categorySlug?: string
  limit?: number
  offset?: number
  search?: string
  orderBy?: 'latest' | 'hot' | 'published' | 'trending'
}

export async function listAiWorldItems(opts: ListItemsOptions = {}): Promise<AiWorldItem[]> {
  const limit = Math.min(opts.limit ?? 30, 100)
  const offset = Math.max(opts.offset ?? 0, 0)
  const conditions = [eq(aiWorldItems.status, 1)]

  if (opts.kind) conditions.push(eq(aiWorldItems.kind, opts.kind))

  if (opts.categorySlug) {
    const cat = await findAiWorldCategoryBySlug(opts.categorySlug)
    if (cat) conditions.push(eq(aiWorldItems.categoryId, cat.id))
  }

  if (opts.search) {
    conditions.push(
      sql`(${aiWorldItems.title} ILIKE ${`%${opts.search}%`} OR ${aiWorldItems.summary} ILIKE ${`%${opts.search}%`})`,
    )
  }

  const order = opts.orderBy === 'hot'
    ? desc(aiWorldItems.likeCount)
    : opts.orderBy === 'published'
      ? desc(aiWorldItems.publishedAt)
      : opts.orderBy === 'trending'
        ? desc(aiWorldItems.trendingScore)
        : desc(aiWorldItems.fetchedAt)

  return db
    .select()
    .from(aiWorldItems)
    .where(and(...conditions))
    .orderBy(order)
    .limit(limit)
    .offset(offset)
}

export async function countAiWorldItems(opts: Pick<ListItemsOptions, 'kind' | 'categorySlug' | 'search'> = {}): Promise<number> {
  const conditions = [eq(aiWorldItems.status, 1)]
  if (opts.kind) conditions.push(eq(aiWorldItems.kind, opts.kind))
  if (opts.categorySlug) {
    const cat = await findAiWorldCategoryBySlug(opts.categorySlug)
    if (cat) conditions.push(eq(aiWorldItems.categoryId, cat.id))
  }
  if (opts.search) {
    conditions.push(ilike(aiWorldItems.title, `%${opts.search}%`))
  }
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiWorldItems)
    .where(and(...conditions))
  return rows[0]?.count ?? 0
}

export async function findAiWorldHotItems(kind: ItemKind, limit = 10): Promise<AiWorldItem[]> {
  return db
    .select()
    .from(aiWorldItems)
    .where(and(eq(aiWorldItems.kind, kind), eq(aiWorldItems.status, 1)))
    .orderBy(desc(aiWorldItems.likeCount), desc(aiWorldItems.viewCount), desc(aiWorldItems.fetchedAt))
    .limit(limit)
}

export async function findRecentSyncLogs(limit = 20): Promise<SyncLogRow[]> {
  return db
    .select()
    .from(aiWorldSyncLog)
    .orderBy(desc(aiWorldSyncLog.startedAt))
    .limit(limit)
}

/** 增加浏览数(详情页调用) */
export async function incrementViewCount(id: string): Promise<void> {
  await db
    .update(aiWorldItems)
    .set({ viewCount: sql`${aiWorldItems.viewCount} + 1` })
    .where(eq(aiWorldItems.id, id))
}

// ===== 模型排行榜查询(2026-07-22 新增) =====

export interface ListRankingsOptions {
  leaderboard?: string
  category?: string
  limit?: number
  offset?: number
}

/** 查询排行榜列表(按 rank asc 排序) */
export async function listAiWorldRankings(opts: ListRankingsOptions = {}): Promise<AiWorldRanking[]> {
  const limit = Math.min(opts.limit ?? 30, 100)
  const offset = Math.max(opts.offset ?? 0, 0)
  const conditions = []

  if (opts.leaderboard) conditions.push(eq(aiWorldRankings.leaderboard, opts.leaderboard))
  if (opts.category) conditions.push(eq(aiWorldRankings.category, opts.category))

  const query = db
    .select()
    .from(aiWorldRankings)
    .orderBy(asc(aiWorldRankings.leaderboard), asc(aiWorldRankings.category), asc(aiWorldRankings.rank))
    .limit(limit)
    .offset(offset)

  return conditions.length > 0 ? query.where(and(...conditions)) : query
}

/** 计数排行榜条目 */
export async function countAiWorldRankings(opts: ListRankingsOptions = {}): Promise<number> {
  const conditions = []
  if (opts.leaderboard) conditions.push(eq(aiWorldRankings.leaderboard, opts.leaderboard))
  if (opts.category) conditions.push(eq(aiWorldRankings.category, opts.category))

  const query = db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiWorldRankings)

  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query
  return rows[0]?.count ?? 0
}

/** 可用榜单列表(去重 leaderboard 字段,聚合 categories) */
export async function listLeaderboards(): Promise<Array<{ leaderboard: string; categories: string[] }>> {
  const rows = await db
    .select({
      leaderboard: aiWorldRankings.leaderboard,
      categories: sql<string[]>`array_agg(distinct ${aiWorldRankings.category})`,
    })
    .from(aiWorldRankings)
    .groupBy(aiWorldRankings.leaderboard)
    .orderBy(asc(aiWorldRankings.leaderboard))
  return rows.map((r) => ({
    leaderboard: r.leaderboard,
    categories: Array.isArray(r.categories) ? r.categories : [],
  }))
}

// ===== 热度排行查询(2026-07-22 新增) =====

export interface ListTrendingOptions {
  kind?: ItemKind
  limit?: number
  offset?: number
}

/** 热度排行(按 trendingScore desc,过滤 trendingScore IS NOT NULL) */
export async function listTrendingItems(opts: ListTrendingOptions = {}): Promise<AiWorldItem[]> {
  const limit = Math.min(opts.limit ?? 30, 100)
  const offset = Math.max(opts.offset ?? 0, 0)
  const conditions = [eq(aiWorldItems.status, 1), isNotNull(aiWorldItems.trendingScore)]

  if (opts.kind) conditions.push(eq(aiWorldItems.kind, opts.kind))

  return db
    .select()
    .from(aiWorldItems)
    .where(and(...conditions))
    .orderBy(desc(aiWorldItems.trendingScore), desc(aiWorldItems.fetchedAt))
    .limit(limit)
    .offset(offset)
}

/** 热度排行计数(过滤 trendingScore IS NOT NULL) */
export async function countTrendingItems(opts: ListTrendingOptions = {}): Promise<number> {
  const conditions = [eq(aiWorldItems.status, 1), isNotNull(aiWorldItems.trendingScore)]
  if (opts.kind) conditions.push(eq(aiWorldItems.kind, opts.kind))

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiWorldItems)
    .where(and(...conditions))
  return rows[0]?.count ?? 0
}
