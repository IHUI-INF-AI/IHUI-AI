// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, ne, gt, gte, desc, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { vipLevels, userVips, users } from '@ihui/database'

// ============================================================================
// VIP Levels
// ============================================================================

export async function listVipLevels(activeOnly = false) {
  const where = activeOnly ? eq(vipLevels.status, 1) : undefined
  const query = db.select().from(vipLevels).orderBy(vipLevels.sortOrder)
  return where ? query.where(where) : query
}

export async function findVipLevel(id: string) {
  const rows = await db.select().from(vipLevels).where(eq(vipLevels.id, id)).limit(1)
  return rows[0]
}

export async function createVipLevel(input: {
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: unknown[]
}) {
  const [level] = await db
    .insert(vipLevels)
    .values({
      levelName: input.levelName,
      levelValue: input.levelValue,
      price: input.price,
      durationDays: input.durationDays,
      benefits: input.benefits,
      status: 1,
    })
    .returning()
  return level
}

export async function updateVipLevel(
  id: string,
  input: Partial<{
    levelName: string
    price: number
    durationDays: number
    status: number
  }>,
) {
  const [existing] = await dbRead.select().from(vipLevels).where(eq(vipLevels.id, id)).limit(1)
  if (!existing) return { updated: false }
  const changed = Object.fromEntries(
    Object.entries(input).filter(
      ([k, v]) => v !== undefined && (existing as Record<string, unknown>)[k] !== v,
    ),
  )
  if (Object.keys(changed).length === 0) return { updated: false }
  const rows = await db
    .update(vipLevels)
    .set({ ...changed, updatedAt: new Date() })
    .where(eq(vipLevels.id, id))
    .returning({ id: vipLevels.id })
  return { updated: rows.length > 0 }
}

// 2026-09-27 布尔删除 ack 清账:旧版未标注返回类型且调用方拿不到命中集
// (原 `await db.delete(...)` 丢弃返回值,路由层只能回 deleted:true 常量)。
// 现回报 RETURNING 命中集合,路由层据此派生 deleted。
export async function deleteVipLevel(id: string): Promise<string[]> {
  const rows = await db
    .delete(vipLevels)
    .where(eq(vipLevels.id, id))
    .returning({ id: vipLevels.id })
  return rows.map((r) => r.id)
}

// ============================================================================
// User VIP
// ============================================================================

export async function getMyVip(userId: string) {
  const rows = await db
    .select({
      userVip: userVips,
      levelName: vipLevels.levelName,
    })
    .from(userVips)
    .leftJoin(vipLevels, eq(userVips.vipLevelId, vipLevels.id))
    .where(
      and(eq(userVips.userId, userId), eq(userVips.status, 1), gte(userVips.endTime, new Date())),
    )
    .orderBy(desc(userVips.createdAt))
    .limit(1)
  return rows[0]
}

/** VIP 单笔订单可购买的最大期数(与下单入口 zod 上限同源,F-148)。 */
export const VIP_MAX_QUANTITY = 99

export async function purchaseVip(input: {
  userId: string
  vipLevelId: string
  orderId?: string
  /** 支付成功时刻(订单 paidAt)。权益起算与到期都锚定它,重放不会因“当前时间”漂移。 */
  paidAt?: Date
  /**
   * 购买期数(默认 1)。F-148:下单按 quantity 乘价计费,履约必须同乘时长,
   * 否则买 N 份只发 1 期(=超收)。多期合并为同一张卡,到期时间 = 起算 + durationDays*quantity;
   * orderId 唯一约束继续保证「同一订单只发一次」,不因多期破坏回调重放幂等。
   */
  quantity?: number
}): Promise<boolean> {
  const level = await findVipLevel(input.vipLevelId)
  if (!level) throw new Error('VIP 等级不存在')
  const quantity = input.quantity ?? 1
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > VIP_MAX_QUANTITY) {
    throw new Error('VIP 购买数量非法')
  }
  const startTime = input.paidAt ?? new Date()
  const endTime = new Date(startTime.getTime() + level.durationDays * quantity * 86400_000)
  // F-689:同一订单只发一张卡。唯一约束 + ON CONFLICT DO NOTHING 让并发/回调重放幂等。
  const rows = await db
    .insert(userVips)
    .values({
      userId: input.userId,
      vipLevelId: input.vipLevelId,
      levelValue: level.levelValue,
      startTime,
      endTime,
      status: 1,
      orderId: input.orderId,
    })
    .onConflictDoNothing({ target: userVips.orderId })
    .returning({ id: userVips.id })
  if (rows.length === 0) return false
  // 更新 users.isVip(仅首次落卡时执行,重放不重复写)
  await db.update(users).set({ isVip: level.levelValue }).where(eq(users.id, input.userId))
  return true
}

export async function listUserVips(page: number, limit: number, filterUserId?: string) {
  const where = filterUserId ? eq(userVips.userId, filterUserId) : undefined
  const query = db
    .select()
    .from(userVips)
    .orderBy(desc(userVips.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const rows = where ? await query.where(where) : await query
  const countQuery = db.select({ count: sql<number>`count(*)::int` }).from(userVips)
  const countRows = where ? await countQuery.where(where) : await countQuery
  const count = countRows[0]?.count ?? 0
  return { items: rows, total: count }
}

/**
 * F-248:取消单笔 VIP 后是否应把 users.isVip 清 0 的纯函数镜像(离线可断言,不碰 DB)。
 *
 * 判据与 F-232 到期降级同源 —— 只有「本次确实取消了这张仍有效的卡」且「该用户已无其它
 * 有效 VIP(status=1 且 end_time > now)」才降级;仍持有其它有效卡的用户不得被降级。
 *
 * - cancelledVip 为空:目标不存在,0 命中、不降级;
 * - 记录已非 status=1:本次是幂等重放/已过期,条件 UPDATE 不会打字,0 命中、不降级;
 * - 命中 1 张但用户仍有其它有效 VIP:不降级。
 *
 * 生产实现由 `cancelUserVip` 的同一事务落地,两者语义必须一致;该函数只用于回归测试
 * 锁定判据,不参与线上写路径。
 */
export function planVipCancelDowngrade(
  cancelledVip: { userId: string; status: number } | null | undefined,
  otherActiveVipCount: number,
): { hits: number; downgrade: boolean } {
  if (!cancelledVip || cancelledVip.status !== 1) return { hits: 0, downgrade: false }
  return { hits: 1, downgrade: otherActiveVipCount <= 0 }
}

export async function cancelUserVip(id: string): Promise<number> {
  // F-248:取消 VIP 同时回写 users.isVip —— 只在同一事务内确认该用户已无其它有效 VIP 时清零,
  // 避免「只改 user_vips.status」导致被取消用户仍享 VIP 权益(agent-service / token-balance-service
  // / commission-queries 仍按 users.isVip 判定)。返回实际命中数,0 行变更对调用方可见。
  const now = new Date()
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ userId: userVips.userId, status: userVips.status })
      .from(userVips)
      .where(eq(userVips.id, id))
      .limit(1)
    if (!target) return 0

    // 其它有效 VIP 计数:排除本次取消的这张卡,判据与 F-232 到期降级一致(未过期)
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userVips)
      .where(
        and(
          eq(userVips.userId, target.userId),
          ne(userVips.id, id),
          eq(userVips.status, 1),
          gt(userVips.endTime, now),
        ),
      )
    const plan = planVipCancelDowngrade(target, countRow?.count ?? 0)
    if (plan.hits === 0) return 0

    const cancelledRows = await tx
      .update(userVips)
      .set({ status: 2, updatedAt: now })
      .where(and(eq(userVips.id, id), eq(userVips.status, 1)))
      .returning({ id: userVips.id })
    if (cancelledRows.length === 0) return 0

    if (plan.downgrade) {
      await tx.update(users).set({ isVip: 0 }).where(eq(users.id, target.userId))
    }
    return cancelledRows.length
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
