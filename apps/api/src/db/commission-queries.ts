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
import { withAudit, withAuditBoth } from '../utils/audit.js'

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
  await ensureMargin(userId)
  // P0 并发竞态修复(2026-08-01):原代码事务外 SELECT 旧余额 + 计算新余额 + 事务内 UPDATE,
  // 两个并发充值(不同 orderNo,绕过幂等索引)会丢失更新。改为事务内原子 UPDATE + RETURNING。
  try {
    const newBalance = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(userMargins)
        .set({ tokenQuantity: sql`token_quantity + ${quantity}`, updatedAt: new Date() })
        .where(eq(userMargins.userId, userId))
        .returning()
      const balanceAfter = updated?.tokenQuantity ?? quantity
      await tx.insert(tokenFlows).values({
        userId,
        opType: 0,
        quantity,
        balanceAfter,
        remark: remark ?? '充值',
        relatedOrderNo: orderNo,
      })
      // P0-2 + P0-4 幂等:(related_order_no, op_type) unique 索引拦截重复回调,事务自动回滚
      return balanceAfter
    })
    return newBalance
  } catch (e: unknown) {
    // PostgreSQL unique_violation (23505):幂等命中,重复充值被拦截,返回当前余额不重复加
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505' && orderNo) {
      const margin = await ensureMargin(userId)
      return margin.tokenQuantity
    }
    throw e
  }
}

export async function deductToken(
  userId: string,
  quantity: number,
  remark?: string,
): Promise<number> {
  await ensureMargin(userId)
  // P1-1 行锁原子 UPDATE:WHERE 条件内联 token_quantity >= quantity,消除 SELECT→UPDATE 跨事务 TOCTOU
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(userMargins)
      .set({ tokenQuantity: sql`token_quantity - ${quantity}`, updatedAt: new Date() })
      .where(and(eq(userMargins.userId, userId), sql`token_quantity >= ${quantity}`))
      .returning()
    if (!updated) throw new Error('Token 余额不足')
    await tx.insert(tokenFlows).values({
      userId,
      opType: 1,
      quantity,
      balanceAfter: updated.tokenQuantity,
      remark: remark ?? '扣减',
    })
    return updated.tokenQuantity
  })
  return result
}

export async function refundToken(
  userId: string,
  quantity: number,
  orderNo: string,
  remark?: string,
): Promise<number> {
  // P1 幂等修复(2026-08-02 Bug A5):原签名 orderNo 缺失,rechargeToken 收到 undefined
  // 后 PostgreSQL unique 索引允许多个 NULL,导致重复退款不被拦截。
  // 改为强制 orderNo 必传,作为幂等键下推到 rechargeToken 的 related_order_no。
  if (!orderNo) throw new Error('ORDER_NO_REQUIRED_FOR_REFUND')
  return rechargeToken(userId, quantity, orderNo, remark ?? `退款:${orderNo}`)
}

export async function expireToken(
  userId: string,
  quantity: number,
  source?: string,
): Promise<number> {
  await ensureMargin(userId)
  // P0 并发竞态修复(2026-08-01):原代码事务外 SELECT 旧余额 + 计算扣减量 + 事务内 UPDATE,
  // 并发到期清零会丢失更新。改为事务内 SELECT FOR UPDATE 锁定行 + 精确计算扣减量 + UPDATE,
  // 行锁保证并发安全,且流水 quantity 准确反映实际扣减量。
  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .for('update')
      .limit(1)
    if (!locked) return 0
    const actualDeductQty = Math.min(locked.tokenQuantity, quantity)
    if (actualDeductQty <= 0) return locked.tokenQuantity
    const newBalance = locked.tokenQuantity - actualDeductQty
    await tx
      .update(userMargins)
      .set({ tokenQuantity: newBalance, updatedAt: new Date() })
      .where(eq(userMargins.userId, userId))
    await tx.insert(tokenFlows).values({
      userId,
      opType: 2,
      quantity: actualDeductQty,
      balanceAfter: newBalance,
      remark: source ?? '到期清零',
    })
    return newBalance
  })
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

/**
 * 记录佣金流水。
 *
 * P0 资金链路修复(2026-08-02 Bug A3):原实现只 INSERT commissionFlows,
 * 不更新 userMargins.tokenQuantity,导致 token 类佣金(普通用户父级返佣)
 * 账面余额与实际流水对不上,用户永远看不到佣金到账。
 * 改为事务内 INSERT commissionFlows + UPSERT userMargins(仅当 status=1 已发放
 * 且 token>0 时累加),事务保证原子性,异常自动回滚(配套 Bug A8)。
 *
 * @param operatorId 操作者 userId(用于 createdBy + updatedBy 审计)。route handler 传 request.userId ?? null;系统自动分佣传 null。
 */
export async function createCommissionFlow(
  input: {
    beneficiaryId: string
    invitedUserId?: string
    orderId?: string
    amount: number
    token: number
    type: number
    remark?: string
  },
  operatorId: string | null,
): Promise<CommissionFlow> {
  return db.transaction(async (tx) => {
    const [flow] = await tx
      .insert(commissionFlows)
      .values(
        withAuditBoth(
          {
            beneficiaryId: input.beneficiaryId,
            invitedUserId: input.invitedUserId,
            orderId: input.orderId,
            amount: input.amount,
            token: input.token,
            type: input.type,
            status: 1,
            remark: input.remark,
          },
          operatorId,
        ),
      )
      .returning()
    // 仅当佣金状态为"已发放"(status=1)且 token 数量 > 0 时,同步到 userMargins.tokenQuantity
    // amount 类佣金(现金)不入 token 钱包;token 类佣金(普通用户父级返佣)进 token 钱包
    if (flow && input.token > 0) {
      await tx
        .insert(userMargins)
        .values({
          userId: input.beneficiaryId,
          tokenQuantity: input.token,
          frozenQuantity: 0,
        })
        .onConflictDoUpdate({
          target: userMargins.userId,
          set: {
            tokenQuantity: sql`${userMargins.tokenQuantity} + ${input.token}`,
            updatedAt: new Date(),
          },
        })
    }
    return flow!
  })
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

/**
 * 申请提现。
 *
 * P0 资金安全(2026-08-02):原实现只插 withdrawalFlows 流水不动 userMargins,导致:
 * (1) getBalance 返回 tokenQuantity(不含 frozen),用户申请提现后余额未冻结可重复提现(资金超发);
 * (2) 上轮 payment-extended.ts 修复在提现失败时 frozen -= flow.amount,
 *     但 applyWithdrawal 未冻结过 → frozen_quantity 变负数。
 *
 * 修复:事务内原子冻结余额(token -= actualAmount, frozen += actualAmount),
 * DB 级 WHERE token_quantity >= actualAmount 检查防超发,0 行影响 = 余额不足或用户无 margin 记录。
 * 冻结量用 actualAmount(= flow.amount)而非 input.amount,与 payment-extended.ts 严格配套,
 * 避免 frozen 永久泄漏 fee(input.amount - actualAmount)。
 *
 * @param operatorId 操作者 userId(用于 createdBy + updatedBy 审计)。route handler 传 request.userId ?? null。
 * @throws {Error & { statusCode: 400 }} 余额不足或用户无 margin 记录时抛出,Fastify 自动转 400 响应。
 */
export async function applyWithdrawal(
  input: {
    userId: string
    amount: number
    method: string
    accountInfo: Record<string, unknown>
  },
  operatorId: string | null,
): Promise<WithdrawalFlow> {
  const fee = Math.floor(input.amount * 0.02)
  const actualAmount = input.amount - fee
  return await db.transaction(async (tx) => {
    // ① 原子冻结余额:DB 级 WHERE token_quantity >= actualAmount 防超发(绕过应用层竞态)
    const [updated] = await tx
      .update(userMargins)
      .set({
        tokenQuantity: sql`token_quantity - ${actualAmount}`,
        frozenQuantity: sql`frozen_quantity + ${actualAmount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(userMargins.userId, input.userId), sql`token_quantity >= ${actualAmount}`))
      .returning()

    if (!updated) {
      // 0 行影响 = 余额不足 OR 用户无 margin 记录 → 拒绝提现申请
      // 抛带 statusCode 的错误,与 finance.ts 既有模式一致,Fastify 自动转 400 响应,调用方无需改动
      throw Object.assign(new Error('可提现余额不足'), { statusCode: 400 })
    }

    // ② 插入提现流水(冻结成功后才插,事务保证一致性)
    const [flow] = await tx
      .insert(withdrawalFlows)
      .values(
        withAuditBoth(
          {
            userId: input.userId,
            amount: actualAmount,
            fee,
            originalAmount: input.amount,
            status: 0,
            method: input.method,
            accountInfo: input.accountInfo,
            partnerTradeNo: `WD${Date.now()}`,
          },
          operatorId,
        ),
      )
      .returning()
    return flow!
  })
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

/**
 * 审批通过提现。
 *
 * P0 状态机修复(2026-08-02 Bug A2):原实现 status 0→2(completed),
 * 跳过 1(processing),导致微信支付回调中的 "释放 frozen" 逻辑(status=1 时
 * 释放 frozen)永远不执行,frozen 永久沉淀。改为 status 0→1(processing),
 * 与 finance.ts 的 admin 审核路由一致;条件 UPDATE(status=0)防并发重复审批,
 * 0 行影响 = 已被处理或不存在,返回 undefined 让上层判断。
 *
 * @param operatorId 操作者 userId(用于 updatedBy 审计)。admin route handler 传 request.userId ?? null。
 */
export async function approveWithdrawal(
  id: string,
  operatorId: string | null,
): Promise<WithdrawalFlow | undefined> {
  const rows = await db
    .update(withdrawalFlows)
    .set(
      withAudit(
        {
          status: 1,
          updatedAt: new Date(),
        },
        operatorId,
      ),
    )
    .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 0)))
    .returning()
  return rows[0]
}

/**
 * 驳回提现。
 *
 * P0 资金链路修复(2026-08-02 Bug A1):原实现只更新 withdrawalFlows.status=3,
 * 不退还 applyWithdrawal 已冻结的 tokenQuantity(applyWithdrawal 在申请阶段
 * token -= actualAmount, frozen += actualAmount),导致驳回后用户的 token
 * 永久卡在 frozenQuantity,既不能提现也不能消费。
 * 改为事务内:① 条件 UPDATE status=0→3(只能驳回 pending,防并发)② 同时
 * tokenQuantity += flow.amount,frozenQuantity -= flow.amount 退还冻结。
 * 0 行影响 = 已被处理或不存在,返回 undefined 让上层判断。
 *
 * @param operatorId 操作者 userId(用于 updatedBy 审计)。admin route handler 传 request.userId ?? null。
 */
export async function rejectWithdrawal(
  id: string,
  reason: string,
  operatorId: string | null,
): Promise<WithdrawalFlow | undefined> {
  return db.transaction(async (tx) => {
    // ① 条件 UPDATE pending→failed,RETURNING 拿到 flow 数据(防并发重复驳回)
    const rows = await tx
      .update(withdrawalFlows)
      .set(
        withAudit(
          {
            status: 3,
            rejectReason: reason,
            processedAt: new Date(),
            updatedAt: new Date(),
          },
          operatorId,
        ),
      )
      .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 0)))
      .returning()
    const flow = rows[0]
    if (!flow) return undefined // 已被处理或不存在
    // ② 退还冻结余额到可用余额(tokenQuantity += amount, frozenQuantity -= amount)
    // flow.userId 可空(用户删除时 SET NULL),null 时无法退还(资金沉淀 frozen 等待人工处理)
    if (flow.userId) {
      await tx
        .update(userMargins)
        .set({
          tokenQuantity: sql`${userMargins.tokenQuantity} + ${flow.amount}`,
          frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(userMargins.userId, flow.userId))
    }
    return flow
  })
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
