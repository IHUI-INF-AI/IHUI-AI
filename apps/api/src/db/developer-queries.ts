import { eq, desc, asc } from 'drizzle-orm'
import { db } from './index.js'
import {
  developerApplications,
  developerPricing,
  type DeveloperApplication,
  type DeveloperPricing,
} from '@ihui/database'

export async function findDeveloperInfo(userId: string): Promise<DeveloperApplication | undefined> {
  const rows = await db
    .select()
    .from(developerApplications)
    .where(eq(developerApplications.userId, userId))
    .orderBy(desc(developerApplications.createdAt))
    .limit(1)
  return rows[0]
}

export async function findDeveloperPricing(): Promise<DeveloperPricing[]> {
  return db
    .select()
    .from(developerPricing)
    .where(eq(developerPricing.status, 1))
    .orderBy(asc(developerPricing.sort), asc(developerPricing.createdAt))
}

export async function createDeveloperApplication(data: {
  userId: string
  name: string
  description?: string | null
}): Promise<DeveloperApplication> {
  const rows = await db
    .insert(developerApplications)
    .values({
      userId: data.userId,
      name: data.name,
      description: data.description,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建开发者申请失败')
  return row
}

export async function updateDeveloperApplicationStatus(
  id: string,
  status: number,
): Promise<DeveloperApplication | undefined> {
  const rows = await db
    .update(developerApplications)
    .set({ status, updatedAt: new Date() })
    .where(eq(developerApplications.id, id))
    .returning()
  return rows[0]
}
