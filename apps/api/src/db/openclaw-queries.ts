import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { openclawItems, type OpenclawItem } from '@ihui/database'

export async function findOpenclawItems(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: OpenclawItem[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(openclawItems.status, 1)]
  if (opts.search) conds.push(ilike(openclawItems.title, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(openclawItems)
      .where(where)
      .orderBy(desc(openclawItems.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(openclawItems)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findOpenclawItemById(id: string): Promise<OpenclawItem | undefined> {
  const rows = await db.select().from(openclawItems).where(eq(openclawItems.id, id)).limit(1)
  return rows[0]
}
