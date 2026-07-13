import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { aiFeedPosts, type AiFeedPost } from '@ihui/database'

export async function findAiFeedPosts(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: AiFeedPost[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(aiFeedPosts.isPublished, true), eq(aiFeedPosts.status, 1)]
  if (opts.search) conds.push(ilike(aiFeedPosts.title, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(aiFeedPosts)
      .where(where)
      .orderBy(desc(aiFeedPosts.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiFeedPosts)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findAiFeedPostById(id: string): Promise<AiFeedPost | undefined> {
  const rows = await db.select().from(aiFeedPosts).where(eq(aiFeedPosts.id, id)).limit(1)
  return rows[0]
}
