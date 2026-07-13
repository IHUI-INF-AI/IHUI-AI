import { eq, and, desc, asc, sql, ilike, inArray } from 'drizzle-orm'
import { db } from './index.js'
import { newsCategories, newsArticles, type NewsCategory, type NewsArticle } from '@ihui/database'

// =============================================================================
// Categories
// =============================================================================

export async function findPublishedNewsCategories(): Promise<NewsCategory[]> {
  return db
    .select()
    .from(newsCategories)
    .where(eq(newsCategories.status, 1))
    .orderBy(asc(newsCategories.sort), asc(newsCategories.createdAt))
}

export async function findAllNewsCategories(): Promise<NewsCategory[]> {
  return db
    .select()
    .from(newsCategories)
    .orderBy(asc(newsCategories.sort), asc(newsCategories.createdAt))
}

export async function findNewsCategoryById(id: string): Promise<NewsCategory | undefined> {
  const rows = await db.select().from(newsCategories).where(eq(newsCategories.id, id)).limit(1)
  return rows[0]
}

export interface CreateNewsCategoryInput {
  name: string
  sort?: number
  status?: number
}

export async function createNewsCategory(data: CreateNewsCategoryInput): Promise<NewsCategory> {
  const rows = await db
    .insert(newsCategories)
    .values({ name: data.name, sort: data.sort, status: data.status })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资讯分类失败')
  return row
}

export interface UpdateNewsCategoryInput {
  name?: string
  sort?: number
  status?: number
}

export async function updateNewsCategory(
  id: string,
  data: UpdateNewsCategoryInput,
): Promise<NewsCategory | undefined> {
  const rows = await db
    .update(newsCategories)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sort !== undefined ? { sort: data.sort } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    })
    .where(eq(newsCategories.id, id))
    .returning()
  return rows[0]
}

export async function deleteNewsCategory(id: string): Promise<void> {
  await db.delete(newsCategories).where(eq(newsCategories.id, id))
}

// =============================================================================
// Articles
// =============================================================================

export interface ArticleWithCategory extends NewsArticle {
  categoryName: string | null
}

export async function findPublishedArticles(opts: {
  page: number
  pageSize: number
  categoryId?: string
  search?: string
}): Promise<{ list: ArticleWithCategory[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(newsArticles.isPublished, true), eq(newsArticles.status, 1)]
  if (opts.categoryId) conds.push(eq(newsArticles.categoryId, opts.categoryId))
  if (opts.search) conds.push(ilike(newsArticles.title, `%${opts.search}%`))
  const where = and(...conds)
  const [rows, totalRows] = await Promise.all([
    db
      .select({ article: newsArticles, categoryName: newsCategories.name })
      .from(newsArticles)
      .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
      .where(where)
      .orderBy(
        desc(newsArticles.isPinned),
        desc(newsArticles.publishedAt),
        desc(newsArticles.createdAt),
      )
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsArticles)
      .where(where),
  ])
  const list: ArticleWithCategory[] = rows.map((r) => ({
    ...r.article,
    categoryName: r.categoryName,
  }))
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findAllArticles(opts: {
  page: number
  pageSize: number
  categoryId?: string
  search?: string
  status?: number
}): Promise<{ list: ArticleWithCategory[]; total: number; page: number; pageSize: number }> {
  const conds = []
  if (opts.categoryId) conds.push(eq(newsArticles.categoryId, opts.categoryId))
  if (opts.search) conds.push(ilike(newsArticles.title, `%${opts.search}%`))
  if (opts.status !== undefined) conds.push(eq(newsArticles.status, opts.status))
  const where = conds.length ? and(...conds) : undefined
  const [rows, totalRows] = await Promise.all([
    db
      .select({ article: newsArticles, categoryName: newsCategories.name })
      .from(newsArticles)
      .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
      .where(where)
      .orderBy(desc(newsArticles.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsArticles)
      .where(where),
  ])
  const list: ArticleWithCategory[] = rows.map((r) => ({
    ...r.article,
    categoryName: r.categoryName,
  }))
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findArticleById(id: string): Promise<ArticleWithCategory | undefined> {
  const rows = await db
    .select({ article: newsArticles, categoryName: newsCategories.name })
    .from(newsArticles)
    .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
    .where(eq(newsArticles.id, id))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  return { ...row.article, categoryName: row.categoryName }
}

export interface CreateArticleInput {
  title: string
  categoryId?: string | null
  summary?: string | null
  content: string
  coverImage?: string | null
  authorId?: string | null
  authorName?: string | null
  isPublished?: boolean
  isPinned?: boolean
  sort?: number
  status?: number
}

export async function createArticle(data: CreateArticleInput): Promise<NewsArticle> {
  const isPublished = data.isPublished ?? false
  const rows = await db
    .insert(newsArticles)
    .values({
      title: data.title,
      categoryId: data.categoryId,
      summary: data.summary,
      content: data.content,
      coverImage: data.coverImage,
      authorId: data.authorId,
      authorName: data.authorName,
      isPublished,
      isPinned: data.isPinned,
      sort: data.sort,
      status: data.status,
      publishedAt: isPublished ? new Date() : null,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建资讯失败')
  return row
}

export interface UpdateArticleInput {
  title?: string
  categoryId?: string | null
  summary?: string | null
  content?: string
  coverImage?: string | null
  authorId?: string | null
  authorName?: string | null
  isPublished?: boolean
  isPinned?: boolean
  sort?: number
  status?: number
}

export async function updateArticle(
  id: string,
  data: UpdateArticleInput,
): Promise<NewsArticle | undefined> {
  const set: Record<string, unknown> = {}
  if (data.title !== undefined) set.title = data.title
  if (data.categoryId !== undefined) set.categoryId = data.categoryId
  if (data.summary !== undefined) set.summary = data.summary
  if (data.content !== undefined) set.content = data.content
  if (data.coverImage !== undefined) set.coverImage = data.coverImage
  if (data.authorId !== undefined) set.authorId = data.authorId
  if (data.authorName !== undefined) set.authorName = data.authorName
  if (data.isPublished !== undefined) {
    set.isPublished = data.isPublished
    if (data.isPublished) set.publishedAt = new Date()
  }
  if (data.isPinned !== undefined) set.isPinned = data.isPinned
  if (data.sort !== undefined) set.sort = data.sort
  if (data.status !== undefined) set.status = data.status
  set.updatedAt = new Date()
  const rows = await db.update(newsArticles).set(set).where(eq(newsArticles.id, id)).returning()
  return rows[0]
}

export async function deleteArticle(id: string): Promise<void> {
  await db.delete(newsArticles).where(eq(newsArticles.id, id))
}

export async function incrementArticleViewCount(id: string): Promise<void> {
  await db
    .update(newsArticles)
    .set({ viewCount: sql<number>`${newsArticles.viewCount} + 1` })
    .where(eq(newsArticles.id, id))
}

export async function findArticlesByIds(ids: string[]): Promise<NewsArticle[]> {
  if (ids.length === 0) return []
  return db
    .select()
    .from(newsArticles)
    .where(and(inArray(newsArticles.id, ids), eq(newsArticles.isPublished, true)))
    .orderBy(desc(newsArticles.publishedAt))
}

export async function findMyArticles(
  authorId: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: ArticleWithCategory[]; total: number; page: number; pageSize: number }> {
  const where = eq(newsArticles.authorId, authorId)
  const [rows, totalRows] = await Promise.all([
    db
      .select({ article: newsArticles, categoryName: newsCategories.name })
      .from(newsArticles)
      .leftJoin(newsCategories, eq(newsArticles.categoryId, newsCategories.id))
      .where(where)
      .orderBy(desc(newsArticles.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsArticles)
      .where(where),
  ])
  const list: ArticleWithCategory[] = rows.map((r) => ({
    ...r.article,
    categoryName: r.categoryName,
  }))
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}
