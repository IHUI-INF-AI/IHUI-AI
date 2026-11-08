// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  // status-guard-exempt: 通用状态 setter——目标值由调用方传入,终态合法性由服务层/路由层裁决,非固定出向终态写点
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
  // F-689：支付回调重放时同一 orderId 会再次调用本函数。以 order_id 唯一索引兜底，
  // 冲突即 DO NOTHING，再回查既有订阅 —— 重放返回同一行，不重复授予权益、不冒泡 500。
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
    .onConflictDoNothing({ target: developerSubscriptions.orderId })
    .returning()
  const row = rows[0]
  if (row) return row

  const existing = await db
    .select()
    .from(developerSubscriptions)
    .where(eq(developerSubscriptions.orderId, input.orderId))
    .limit(1)
  const replayRow = existing[0]
  if (!replayRow) throw new Error(`开发者订阅幂等回查失败: orderId=${input.orderId}`)
  return replayRow
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
