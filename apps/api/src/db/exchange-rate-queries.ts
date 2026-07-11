import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { zhsExchangeRate } from '@ihui/database'

export interface ExchangeRateRow {
  id: number
  fromCurrency: string
  toCurrency: string
  rate: number
  status: number
  createdAt: Date
  updatedAt: Date
}

export interface ExchangeRateListResult {
  list: ExchangeRateRow[]
  total: number
}

export async function findExchangeRates(params: {
  page?: number
  pageSize?: number
  status?: number
}): Promise<ExchangeRateListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const where = params.status !== undefined ? eq(zhsExchangeRate.status, params.status) : undefined

  const [list, countResult] = await Promise.all([
    dbRead
      .select()
      .from(zhsExchangeRate)
      .where(where)
      .orderBy(desc(zhsExchangeRate.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsExchangeRate)
      .where(where),
  ])

  return { list: list as ExchangeRateRow[], total: countResult[0]?.count ?? 0 }
}

/**
 * 查询两个货币之间的汇率
 */
export async function findRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<ExchangeRateRow | null> {
  const rows = await dbRead
    .select()
    .from(zhsExchangeRate)
    .where(
      and(
        eq(zhsExchangeRate.fromCurrency, fromCurrency),
        eq(zhsExchangeRate.toCurrency, toCurrency),
        eq(zhsExchangeRate.status, 1),
      ),
    )
    .limit(1)
  return (rows[0] as ExchangeRateRow) ?? null
}

export async function createExchangeRate(data: {
  fromCurrency: string
  toCurrency: string
  rate: number
  status?: number
}): Promise<ExchangeRateRow> {
  const rows = await db.insert(zhsExchangeRate).values(data).returning()
  return rows[0]! as ExchangeRateRow
}

export async function updateExchangeRate(
  id: number,
  data: {
    fromCurrency?: string
    toCurrency?: string
    rate?: number
    status?: number
  },
): Promise<ExchangeRateRow | null> {
  const rows = await db
    .update(zhsExchangeRate)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(zhsExchangeRate.id, id))
    .returning()
  return (rows[0] as ExchangeRateRow) ?? null
}

export async function deleteExchangeRate(id: number): Promise<boolean> {
  const rows = await db.delete(zhsExchangeRate).where(eq(zhsExchangeRate.id, id)).returning()
  return rows.length > 0
}
