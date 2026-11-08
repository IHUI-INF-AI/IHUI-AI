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
  /** 支付成功时刻(订单 paidAt)。权益起算与到期都锚定它,重放不会因“当前时间”漂移。 */
  paidAt?: Date
}): Promise<DeveloperSubscription | null> {
  const startTime = input.paidAt ?? new Date()
  const days = input.period === 'yearly' ? 365 : 30
  const endTime = new Date(startTime.getTime() + days * 86400_000)
  // F-689:同一订单只发一条订阅。唯一约束 + ON CONFLICT DO NOTHING 让并发/回调重放幂等。
  const rows = await db
    .insert(developerSubscriptions)
    .values({
      userId: input.userId,
      pricingId: input.pricingId,
      period: input.period,
      startTime,
      endTime,
      status: 1,
      orderId: input.orderId,
    })
    .onConflictDoNothing({ target: developerSubscriptions.orderId })
    .returning()
  // 冲突说明该订单已激活过(回调重放/并发),按幂等成功处理。
  return rows[0] ?? null
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
