import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { knowledgeBase, type KnowledgeBase } from '@ihui/database'

export async function findPublishedKnowledge(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: KnowledgeBase[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(knowledgeBase.isPublished, true), eq(knowledgeBase.status, 1)]
  if (opts.search) conds.push(ilike(knowledgeBase.title, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(knowledgeBase)
      .where(where)
      .orderBy(desc(knowledgeBase.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeBase)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findKnowledgeById(id: string): Promise<KnowledgeBase | undefined> {
  const rows = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1)
  return rows[0]
}

export interface CreateKnowledgeInput {
  title: string
  summary?: string | null
  content?: string | null
  coverImage?: string | null
  categoryId?: string | null
  authorId?: string | null
  isPublished?: boolean
  status?: number
}

export async function createKnowledge(data: CreateKnowledgeInput): Promise<KnowledgeBase> {
  const rows = await db
    .insert(knowledgeBase)
    .values({
      title: data.title,
      summary: data.summary,
      content: data.content,
      coverImage: data.coverImage,
      categoryId: data.categoryId,
      authorId: data.authorId,
      isPublished: data.isPublished,
      status: data.status,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建知识库失败')
  return row
}

export interface UpdateKnowledgeInput {
  title?: string
  summary?: string | null
  content?: string | null
  coverImage?: string | null
  categoryId?: string | null
  isPublished?: boolean
  status?: number
}

export async function updateKnowledge(
  id: string,
  data: UpdateKnowledgeInput,
): Promise<KnowledgeBase | undefined> {
  const set: Record<string, unknown> = {}
  if (data.title !== undefined) set.title = data.title
  if (data.summary !== undefined) set.summary = data.summary
  if (data.content !== undefined) set.content = data.content
  if (data.coverImage !== undefined) set.coverImage = data.coverImage
  if (data.categoryId !== undefined) set.categoryId = data.categoryId
  if (data.isPublished !== undefined) set.isPublished = data.isPublished
  if (data.status !== undefined) set.status = data.status
  set.updatedAt = new Date()
  const rows = await db.update(knowledgeBase).set(set).where(eq(knowledgeBase.id, id)).returning()
  return rows[0]
}

export async function deleteKnowledge(id: string): Promise<void> {
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id))
}
