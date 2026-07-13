import { eq, asc } from 'drizzle-orm'
import { db } from './index.js'
import {
  aiWorldCategories,
  aiWorldItems,
  type AiWorldCategory,
  type AiWorldItem,
} from '@ihui/database'

export async function findAiWorldCategories(): Promise<AiWorldCategory[]> {
  return db
    .select()
    .from(aiWorldCategories)
    .where(eq(aiWorldCategories.status, 1))
    .orderBy(asc(aiWorldCategories.sort), asc(aiWorldCategories.id))
}

export async function findAiWorldItemById(id: string): Promise<AiWorldItem | undefined> {
  const rows = await db.select().from(aiWorldItems).where(eq(aiWorldItems.id, id)).limit(1)
  return rows[0]
}
