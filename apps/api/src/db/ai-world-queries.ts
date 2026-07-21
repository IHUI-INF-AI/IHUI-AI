import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from './index.js'
import {
  aiWorldCategories,
  aiWorldItems,
  aiWorldSyncLog,
  type AiWorldCategory,
  type AiWorldItem,
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
  orderBy?: 'latest' | 'hot' | 'published'
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
