import { eq, and, desc, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { sensitiveWords, type SensitiveWord, type NewSensitiveWord } from '@ihui/database'

export interface SensitiveWordListResult {
  list: SensitiveWord[]
  total: number
}

export async function findSensitiveWords(params: {
  page?: number
  pageSize?: number
  category?: string
  status?: number
}): Promise<SensitiveWordListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize

  const conditions = []
  if (params.category) conditions.push(eq(sensitiveWords.category, params.category))
  if (params.status !== undefined) conditions.push(eq(sensitiveWords.status, params.status))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [list, countResult] = await Promise.all([
    dbRead
      .select()
      .from(sensitiveWords)
      .where(where)
      .orderBy(desc(sensitiveWords.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(sensitiveWords)
      .where(where),
  ])

  return { list, total: countResult[0]?.count ?? 0 }
}

export async function findSensitiveWordById(id: string): Promise<SensitiveWord | null> {
  const rows = await dbRead.select().from(sensitiveWords).where(eq(sensitiveWords.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createSensitiveWord(data: NewSensitiveWord): Promise<SensitiveWord> {
  const rows = await db.insert(sensitiveWords).values(data).returning()
  return rows[0]!
}

export async function updateSensitiveWord(
  id: string,
  data: Partial<NewSensitiveWord>,
): Promise<SensitiveWord | null> {
  const rows = await db
    .update(sensitiveWords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sensitiveWords.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteSensitiveWord(id: string): Promise<boolean> {
  const rows = await db.delete(sensitiveWords).where(eq(sensitiveWords.id, id)).returning()
  return rows.length > 0
}

export async function findActiveSensitiveWords(): Promise<SensitiveWord[]> {
  return dbRead
    .select()
    .from(sensitiveWords)
    .where(eq(sensitiveWords.status, 1))
    .orderBy(desc(sensitiveWords.level))
}

/**
 * 过滤文本中的敏感词
 * @returns { filtered: string, hit: boolean, hits: Array<{ word, category, level }> }
 */
export async function filterSensitiveContent(text: string): Promise<{
  filtered: string
  hit: boolean
  hits: Array<{ word: string; category: string; level: number }>
}> {
  const words = await findActiveSensitiveWords()
  let filtered = text
  const hits: Array<{ word: string; category: string; level: number }> = []

  for (const sw of words) {
    if (text.includes(sw.word)) {
      hits.push({ word: sw.word, category: sw.category, level: sw.level })
      if (sw.level === 1) {
        filtered = filtered.split(sw.word).join(sw.replacement ?? '***')
      }
    }
  }

  return { filtered, hit: hits.length > 0, hits }
}
