import { eq, and, gte, desc, sql, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  userMargins,
  tokenFlows,
  commissionFlows,
  withdrawalFlows,
  identityProportions,
  users,
  type UserMargin,
  type CommissionFlow,
  type WithdrawalFlow,
} from '@ihui/database'

// ============================================================================
// Token 钱包
// ============================================================================

export async function getBalance(userId: string): Promise<number> {
  const rows = await db.select().from(userMargins).where(eq(userMargins.userId, userId)).limit(1)
  return rows[0]?.tokenQuantity ?? 0
}

export async function ensureMargin(userId: string): Promise<UserMargin> {
  const existing = await db
    .select()
    .from(userMargins)
    .where(eq(userMargins.userId, userId))
    .limit(1)
  if (existing[0]) return existing[0]
  const [created] = await db
    .insert(userMargins)
    .values({ userId, tokenQuantity: 0, frozenQuantity: 0 })
    .returning()
  return created!
}

export async function rechargeToken(
  userId: string,
  quantity: number,
  orderNo?: string,
  remark?: string,
): Promise<number> {
  const margin = await ensureMargin(userId)
  const newBalance = margin.tokenQuantity + quantity
  await db.transaction(async (tx) => {
    await tx
      .update(userMargins)
      .set({ tokenQuantity: newBalance, updatedAt: new Date() })
      .where(eq(userMargins.userId, userId))
    await tx.insert(tokenFlows).values({
      userId,
      opType: 0,
      quantity,
      balanceAfter: newBalance,
      remark: remark ?? '充值',
      relatedOrderNo: orderNo,
    })
  })
  return newBalance
}

export async function deductToken(
  userId: string,
  quantity: number,
  remark?: string,
): Promise<number> {
  const margin = await ensureMargin(userId)
  if (margin.tokenQuantity < quantity) throw new Error('Token 余额不足')
  const newBalance = margin.tokenQuantity - quantity
  await db.transaction(async (tx) => {
    await tx
      .update(userMargins)
      .set({ tokenQuantity: newBalance, updatedAt: new Date() })
      .where(eq(userMargins.userId, userId))
    await tx.insert(tokenFlows).values({
      userId,
      opType: 1,
      quantity,
      balanceAfter: newBalance,
      remark: remark ?? '扣减',
    })
  })
  return newBalance
}

export async function refundToken(
  userId: string,
  quantity: number,
  remark?: string,
): Promise<number> {
  return rechargeToken(userId, quantity, undefined, remark ?? '退款')
}

export async function expireToken(
  userId: string,
  quantity: number,
  source?: string,
): Promise<number> {
  const margin = await ensureMargin(userId)
  const deductQty = Math.min(margin.tokenQuantity, quantity)
  const newBalance = margin.tokenQuantity - deductQty
  await db.transaction(async (tx) => {
    await tx
      .update(userMargins)
      .set({ tokenQuantity: newBalance, updatedAt: new Date() })
      .where(eq(userMargins.userId, userId))
    await tx.insert(tokenFlows).values({
      userId,
      opType: 2,
      quantity: deductQty,
      balanceAfter: newBalance,
      remark: source ?? '到期清零',
    })
  })
  return newBalance
}

export async function listTokenFlows(userId: string, page: number, limit: number, opType?: number) {
  const conditions = [eq(tokenFlows.userId, userId)]
  if (opType !== undefined) conditions.push(eq(tokenFlows.opType, opType))
  const where = conditions.length === 1 ? conditions[0] : and(...conditions)
  const rows = await db
    .select()
    .from(tokenFlows)
    .where(where)
    .orderBy(desc(tokenFlows.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tokenFlows)
    .where(where)
  const count = countRows[0]?.count ?? 0
  return { items: rows, total: count }
}

// ============================================================================
// 佣金
// ============================================================================

export async function listCommissionFlows(beneficiaryId: string, page: number, limit: number) {
  const where = eq(commissionFlows.beneficiaryId, beneficiaryId)
  const rows = await db
    .select()
    .from(commissionFlows)
    .where(where)
    .orderBy(desc(commissionFlows.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(commissionFlows)
    .where(where)
  const count = countRows[0]?.count ?? 0
  return { items: rows, total: count }
}

export async function commissionSummary(beneficiaryId: string, windowDays = 7) {
  const windowStart = new Date(Date.now() - windowDays * 86400_000)
  const rows = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)::int`,
      totalToken: sql<number>`coalesce(sum(${commissionFlows.token}), 0)::int`,
    })
    .from(commissionFlows)
    .where(
      and(
        eq(commissionFlows.beneficiaryId, beneficiaryId),
        eq(commissionFlows.status, 1),
        gte(commissionFlows.createdAt, windowStart),
      ),
    )
  return {
    totalAmount: rows[0]?.totalAmount ?? 0,
    totalToken: rows[0]?.totalToken ?? 0,
    commissionDay: windowDays,
  }
}

export async function createCommissionFlow(input: {
  beneficiaryId: string
  invitedUserId?: string
  orderId?: string
  amount: number
  token: number
  type: number
  remark?: string
}): Promise<CommissionFlow> {
  const [flow] = await db
    .insert(commissionFlows)
    .values({
      beneficiaryId: input.beneficiaryId,
      invitedUserId: input.invitedUserId,
      orderId: input.orderId,
      amount: input.amount,
      token: input.token,
      type: input.type,
      status: 1,
      remark: input.remark,
    })
    .returning()
  return flow!
}

/** 递归查父链（最多 2 级） */
export async function getParentUsers(
  userId: string,
): Promise<Array<{ userId: string; isVip: number; level: number }>> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user[0]?.parentId) return []
  const parent = await db.select().from(users).where(eq(users.id, user[0].parentId)).limit(1)
  if (!parent[0]) return []
  const result: Array<{ userId: string; isVip: number; level: number }> = [
    { userId: parent[0].id, isVip: parent[0].isVip, level: 1 },
  ]
  if (parent[0].parentId) {
    const grand = await db.select().from(users).where(eq(users.id, parent[0].parentId)).limit(1)
    if (grand[0] && grand[0].isVip === 2) {
      result.push({ userId: grand[0].id, isVip: grand[0].isVip, level: 2 })
    }
  }
  return result
}

export async function getActiveProportion() {
  const rows = await db
    .select()
    .from(identityProportions)
    .where(eq(identityProportions.status, 1))
    .limit(1)
  return rows[0]
}

// ============================================================================
// 提现
// ============================================================================

export async function applyWithdrawal(input: {
  userId: string
  amount: number
  method: string
  accountInfo: Record<string, unknown>
}): Promise<WithdrawalFlow> {
  const fee = Math.floor(input.amount * 0.02)
  const actualAmount = input.amount - fee
  const [flow] = await db
    .insert(withdrawalFlows)
    .values({
      userId: input.userId,
      amount: actualAmount,
      fee,
      originalAmount: input.amount,
      status: 0,
      method: input.method,
      accountInfo: input.accountInfo,
      partnerTradeNo: `WD${Date.now()}`,
    })
    .returning()
  return flow!
}

export async function listWithdrawals(userId: string, page: number, limit: number) {
  const where = eq(withdrawalFlows.userId, userId)
  const rows = await db
    .select()
    .from(withdrawalFlows)
    .where(where)
    .orderBy(desc(withdrawalFlows.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(withdrawalFlows)
    .where(where)
  const count = countRows[0]?.count ?? 0
  return { items: rows, total: count }
}

export async function getWithdrawalById(id: string): Promise<WithdrawalFlow | undefined> {
  const rows = await db.select().from(withdrawalFlows).where(eq(withdrawalFlows.id, id)).limit(1)
  return rows[0]
}

export async function approveWithdrawal(id: string): Promise<WithdrawalFlow | undefined> {
  const rows = await db
    .update(withdrawalFlows)
    .set({ status: 2, processedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 0)))
    .returning()
  return rows[0]
}

export async function rejectWithdrawal(
  id: string,
  reason: string,
): Promise<WithdrawalFlow | undefined> {
  const rows = await db
    .update(withdrawalFlows)
    .set({ status: 3, rejectReason: reason, processedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 0)))
    .returning()
  return rows[0]
}

export async function withdrawalSummary(userId: string) {
  const completed = await db
    .select({ total: sql<number>`coalesce(sum(${withdrawalFlows.amount}), 0)::int` })
    .from(withdrawalFlows)
    .where(and(eq(withdrawalFlows.userId, userId), eq(withdrawalFlows.status, 2)))
  const pending = await db
    .select({ total: sql<number>`coalesce(sum(${withdrawalFlows.amount}), 0)::int` })
    .from(withdrawalFlows)
    .where(and(eq(withdrawalFlows.userId, userId), inArray(withdrawalFlows.status, [0, 1])))
  return {
    totalWithdrawn: completed[0]?.total ?? 0,
    pendingAmount: pending[0]?.total ?? 0,
  }
}

export async function availableWithdrawal(userId: string): Promise<number> {
  const comm = await db
    .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)::int` })
    .from(commissionFlows)
    .where(and(eq(commissionFlows.beneficiaryId, userId), eq(commissionFlows.status, 1)))
  const wd = await withdrawalSummary(userId)
  const available = (comm[0]?.total ?? 0) - wd.totalWithdrawn - wd.pendingAmount
  return Math.max(0, available)
}

// ============================================================================
// 分销关系
// ============================================================================

export async function listSubordinates(userId: string, page: number, limit: number) {
  const where = eq(users.parentId, userId)
  const rows = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      avatar: users.avatar,
      isVip: users.isVip,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(where)
  const count = countRows[0]?.count ?? 0
  return { items: rows, total: count }
}

export async function teamCenter(userId: string) {
  const subs = await db.select({ isVip: users.isVip }).from(users).where(eq(users.parentId, userId))
  const totalInvitees = subs.length
  const vipInvitees = subs.filter((s) => s.isVip >= 1).length
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthNew = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.parentId, userId), gte(users.createdAt, monthStart)))
  const comm = await commissionSummary(userId, 30)
  const wd = await withdrawalSummary(userId)
  return {
    totalInvitees,
    vipInvitees,
    monthNew: monthNew[0]?.count ?? 0,
    commissionTotal: comm.totalAmount,
    withdrawalTotal: wd.totalWithdrawn,
  }
}
