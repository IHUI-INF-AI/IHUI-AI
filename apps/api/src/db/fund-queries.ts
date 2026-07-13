import { eq, and, desc, asc, sql, ilike } from 'drizzle-orm'
import { db } from './index.js'
import { funds, fundNetValues, type Fund, type FundNetValue } from '@ihui/database'

export async function findFunds(opts: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ list: Fund[]; total: number; page: number; pageSize: number }> {
  const conds = [eq(funds.status, 1)]
  if (opts.search) conds.push(ilike(funds.name, `%${opts.search}%`))
  const where = and(...conds)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(funds)
      .where(where)
      .orderBy(asc(funds.code))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(funds)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}

export async function findFundByCode(code: string): Promise<Fund | undefined> {
  const rows = await db.select().from(funds).where(eq(funds.code, code)).limit(1)
  return rows[0]
}

export async function findFundNetValues(
  fundId: string,
  opts: { page: number; pageSize: number },
): Promise<{ list: FundNetValue[]; total: number; page: number; pageSize: number }> {
  const where = eq(fundNetValues.fundId, fundId)
  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(fundNetValues)
      .where(where)
      .orderBy(desc(fundNetValues.date))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(fundNetValues)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page: opts.page, pageSize: opts.pageSize }
}
