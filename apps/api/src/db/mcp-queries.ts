import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { mcpServers, type McpServer } from '@ihui/database'

export async function findMcpServers(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: McpServer[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(mcpServers.status, 1)]
  if (opts.search) conds.push(ilike(mcpServers.name, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(mcpServers)
      .where(where)
      .orderBy(desc(mcpServers.createdAt))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpServers)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findMcpServerById(id: string): Promise<McpServer | undefined> {
  const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1)
  return rows[0]
}
