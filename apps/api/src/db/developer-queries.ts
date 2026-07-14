import { eq, desc, asc, and, gte } from 'drizzle-orm'
import { db } from './index.js'
import {
  developerApplications,
  developerPricing,
  developerSubscriptions,
  type DeveloperApplication,
  type DeveloperPricing,
  type DeveloperSubscription,
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

export async function findDeveloperPricingById(id: string): Promise<DeveloperPricing | undefined> {
  const rows = await db.select().from(developerPricing).where(eq(developerPricing.id, id)).limit(1)
  return rows[0]
}

export async function activateDeveloperSubscription(input: {
  userId: string
  pricingId: string
  period: string
  orderId: string
}): Promise<DeveloperSubscription> {
  const now = new Date()
  const days = input.period === 'yearly' ? 365 : 30
  const endTime = new Date(now.getTime() + days * 86400_000)
  const rows = await db
    .insert(developerSubscriptions)
    .values({
      userId: input.userId,
      pricingId: input.pricingId,
      period: input.period,
      startTime: now,
      endTime,
      status: 1,
      orderId: input.orderId,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建开发者订阅失败')
  return row
}

export async function getMyDeveloperSubscription(
  userId: string,
): Promise<DeveloperSubscription | undefined> {
  const rows = await db
    .select()
    .from(developerSubscriptions)
    .where(
      and(
        eq(developerSubscriptions.userId, userId),
        eq(developerSubscriptions.status, 1),
        gte(developerSubscriptions.endTime, new Date()),
      ),
    )
    .orderBy(desc(developerSubscriptions.createdAt))
    .limit(1)
  return rows[0]
}
