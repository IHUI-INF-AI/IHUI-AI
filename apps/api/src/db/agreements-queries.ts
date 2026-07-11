import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { agreements, type Agreement, type NewAgreement } from '@ihui/database'

export interface AgreementListResult {
  list: Agreement[]
  total: number
}

export async function findAgreements(params: {
  page?: number
  pageSize?: number
  type?: string
  status?: number
}): Promise<AgreementListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions = []
  if (params.type) conditions.push(eq(agreements.type, params.type))
  if (params.status !== undefined) conditions.push(eq(agreements.status, params.status))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [list, countResult] = await Promise.all([
    dbRead
      .select()
      .from(agreements)
      .where(where)
      .orderBy(desc(agreements.effectiveDate))
      .limit(pageSize)
      .offset(offset),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agreements)
      .where(where),
  ])

  return { list, total: countResult[0]?.count ?? 0 }
}

export async function findAgreementById(id: string): Promise<Agreement | null> {
  const rows = await dbRead.select().from(agreements).where(eq(agreements.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * 查询当前生效的协议（按类型）
 */
export async function findCurrentAgreement(type: string): Promise<Agreement | null> {
  const rows = await dbRead
    .select()
    .from(agreements)
    .where(and(eq(agreements.type, type), eq(agreements.status, 1)))
    .orderBy(desc(agreements.effectiveDate))
    .limit(1)
  return rows[0] ?? null
}

export async function createAgreement(data: NewAgreement): Promise<Agreement> {
  const rows = await db.insert(agreements).values(data).returning()
  return rows[0]!
}

export async function updateAgreement(
  id: string,
  data: Partial<NewAgreement>,
): Promise<Agreement | null> {
  const rows = await db
    .update(agreements)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agreements.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteAgreement(id: string): Promise<boolean> {
  const rows = await db.delete(agreements).where(eq(agreements.id, id)).returning()
  return rows.length > 0
}
