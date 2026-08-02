/**
 * 优惠券核心 service(2026-07-31 立,折扣券/满减券/裂变券三合一)。
 *
 * 职责:
 * 1. claimCoupon: 用户输入码领取券(含裂变券:被分享人领取后,分享人也得券/余额)
 * 2. redeemCoupon: 核销券(调用前预检,返回折扣金额,状态 unused → used)
 * 3. refundCoupon: 退券(调用失败时回滚核销,状态 used → unused)
 * 4. listUserCoupons: 查用户可用券
 * 5. getReferralStats: 裂变统计
 * 6. batchGenerateCoupons / listCoupons / getCouponStats / listUserCouponsByCoupon: admin 辅助
 *
 * 券码格式:IHUI-COUPON-XXXXXXXXXXXX(12 位随机,排除易混淆字符 0/O/I/L)。
 * 核销幂等:用 UPDATE WHERE status='unused' RETURNING 原子翻转状态。
 *
 * 注:表名 promo_coupons(避免与 promotions.ts 的 coupons 表冲突)。
 */
import { randomBytes } from 'crypto'
import { eq, and, sql, desc, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { promoCoupons, userCoupons, developerApiKeys } from '@ihui/database'
import type { PromoCoupon, UserCoupon, NewPromoCoupon } from '@ihui/database'

// =============================================================================
// 常量
// =============================================================================

/** 券码字符集(去除易混淆字符 0/O/I/L,共 31 个字符) */
const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** 券码随机部分长度(IHUI-COUPON- 后 12 位随机) */
const CODE_RANDOM_LENGTH = 12

/** 单次批量生成上限 */
const MAX_BATCH_COUNT = 1000

// =============================================================================
// 券码生成
// =============================================================================

/**
 * 生成单个券码:IHUI-COUPON-XXXXXXXXXXXX。
 * X 从 CODE_CHARSET(31 字符,去除易混淆字符)中随机选取。
 */
export function generateCouponCode(): string {
  const bytes = randomBytes(CODE_RANDOM_LENGTH)
  let random = ''
  for (let i = 0; i < CODE_RANDOM_LENGTH; i++) {
    const byte = bytes[i] ?? 0
    random += CODE_CHARSET.charAt(byte % CODE_CHARSET.length)
  }
  return `IHUI-COUPON-${random}`
}

/**
 * 规范化券码:去首尾空格 + 转大写 + 去内部空格。
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

// =============================================================================
// 1. claimCoupon — 领券(用户输入码领取)
// =============================================================================

export interface ClaimResult {
  success: boolean
  userCoupon?: UserCoupon & { coupon: PromoCoupon }
  reason?: string
}

/** drizzle 事务回调参数类型(供 rewardReferrerTx 复用,避免内联) */
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * 领券:用户输入码领取。
 *
 * P1 修复:整个领取流程(FOR UPDATE 锁券 + perUserLimit 校验 + issued_count 递增 +
 * user_coupons INSERT + 裂变奖励)包在单事务内,失败自动回滚,防 issued_count 递增后
 * user_coupons INSERT 失败导致库存泄漏。
 *
 * @param referrerUserCouponId 裂变券专属:分享人的 user_coupon.id(被分享人通过分享链接领取时传入)
 */
export async function claimCoupon(
  userId: string,
  code: string,
  referrerUserCouponId?: string,
): Promise<ClaimResult> {
  const normalized = normalizeCode(code)

  // 1. 查券(事务外预查,快速失败,减少事务持锁时间)
  const [coupon] = await dbRead
    .select()
    .from(promoCoupons)
    .where(eq(promoCoupons.code, normalized))
    .limit(1)

  if (!coupon) {
    return { success: false, reason: 'code_not_found' }
  }

  // 2. 校验启用/时间(事务外快速失败)
  const now = new Date()
  if (!coupon.enabled) {
    return { success: false, reason: 'disabled' }
  }
  if (coupon.startsAt > now) {
    return { success: false, reason: 'not_started' }
  }
  if (coupon.expiresAt < now) {
    return { success: false, reason: 'expired' }
  }

  // 3. 事务外预检库存(事务内会再次原子校验)
  if (coupon.totalQuota !== null && coupon.issuedCount >= coupon.totalQuota) {
    return { success: false, reason: 'sold_out' }
  }

  // 4. 裂变券:查 referrer 的 user_coupon(事务外预查,referrer 数据不参与事务一致性)
  let referrerUserId: string | null = null
  if (coupon.type === 'referral' && referrerUserCouponId) {
    const [referrerCoupon] = await dbRead
      .select()
      .from(userCoupons)
      .where(eq(userCoupons.id, referrerUserCouponId))
      .limit(1)
    if (referrerCoupon && referrerCoupon.couponId === coupon.id) {
      referrerUserId = referrerCoupon.userId
    }
  }

  // 5. 事务:FOR UPDATE 锁券 + perUserLimit 校验 + 原子递增 issued_count + INSERT user_coupons + rewardReferrer
  try {
    const userCoupon = await db.transaction(async (tx) => {
      // FOR UPDATE 锁定券行,防止并发领取读到相同 issuedCount
      const [lockedCoupon] = await tx
        .select()
        .from(promoCoupons)
        .where(eq(promoCoupons.id, coupon.id))
        .for('update')

      if (!lockedCoupon) {
        throw new ClaimError('code_not_found')
      }

      // 事务内 perUserLimit 校验(防 TOCTOU:检查时未超限,INSERT 前已被并发请求超限)
      if (lockedCoupon.perUserLimit > 0) {
        const userClaimed = await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(userCoupons)
          .where(and(eq(userCoupons.userId, userId), eq(userCoupons.couponId, lockedCoupon.id)))
        if ((userClaimed[0]?.c ?? 0) >= lockedCoupon.perUserLimit) {
          throw new ClaimError('per_user_limit_exceeded')
        }
      }

      // 原子递增 issued_count(条件 UPDATE,防超发)
      let incremented: { id: string } | null = null
      if (lockedCoupon.totalQuota !== null) {
        const rows = await tx
          .update(promoCoupons)
          .set({ issuedCount: sql`${promoCoupons.issuedCount} + 1` })
          .where(
            and(
              eq(promoCoupons.id, lockedCoupon.id),
              sql`${promoCoupons.issuedCount} < ${lockedCoupon.totalQuota}`,
            ),
          )
          .returning({ id: promoCoupons.id })
        incremented = rows[0] ?? null
      } else {
        const rows = await tx
          .update(promoCoupons)
          .set({ issuedCount: sql`${promoCoupons.issuedCount} + 1` })
          .where(eq(promoCoupons.id, lockedCoupon.id))
          .returning({ id: promoCoupons.id })
        incremented = rows[0] ?? null
      }

      if (!incremented) {
        throw new ClaimError('sold_out')
      }

      // INSERT user_coupons(事务内,失败回滚 issued_count 递增)
      const [userCoupon] = await tx
        .insert(userCoupons)
        .values({
          userId,
          couponId: lockedCoupon.id,
          status: 'unused',
          referrerUserId: referrerUserId ?? undefined,
          referredBy: referrerUserCouponId ?? undefined,
        })
        .returning()

      if (!userCoupon) {
        throw new ClaimError('insert_failed')
      }

      // 裂变券:给 referrer 发券或余额(同事务内,失败回滚整个领取)
      if (lockedCoupon.type === 'referral' && referrerUserId) {
        await rewardReferrerTx(tx, lockedCoupon, referrerUserId, userCoupon.id)
      }

      return userCoupon
    })

    return {
      success: true,
      userCoupon: { ...userCoupon, coupon },
    }
  } catch (err) {
    if (err instanceof ClaimError) {
      return { success: false, reason: err.reason }
    }
    throw err
  }
}

/** claimCoupon 事务内错误(携带 reason 字段,供 catch 块映射返回值) */
class ClaimError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.name = 'ClaimError'
    this.reason = reason
  }
}

/**
 * 裂变券:奖励分享人(事务内版本,使用 tx 替代 db/dbRead)。
 * - referrerGets='duplicate': 给分享人发一张相同的券
 * - referrerGets='credit': 给分享人的 API Key 加余额
 *
 * P1 修复:改为接受 tx 参数,与 claimCoupon 同事务执行,失败回滚。
 */
async function rewardReferrerTx(
  tx: DbTx,
  coupon: PromoCoupon,
  referrerUserId: string,
  sourceUserCouponId: string,
): Promise<void> {
  if (coupon.referrerGets === 'duplicate') {
    // 原子递增 issued_count(防超发)
    if (coupon.totalQuota !== null) {
      const rows = await tx
        .update(promoCoupons)
        .set({ issuedCount: sql`${promoCoupons.issuedCount} + 1` })
        .where(
          and(
            eq(promoCoupons.id, coupon.id),
            sql`${promoCoupons.issuedCount} < ${coupon.totalQuota}`,
          ),
        )
        .returning({ id: promoCoupons.id })
      if (!rows[0]) {
        // 库存不足,裂变奖励失败(可接受,不影响被分享人的券)
        return
      }
    } else {
      await tx
        .update(promoCoupons)
        .set({ issuedCount: sql`${promoCoupons.issuedCount} + 1` })
        .where(eq(promoCoupons.id, coupon.id))
    }

    await tx.insert(userCoupons).values({
      userId: referrerUserId,
      couponId: coupon.id,
      status: 'unused',
      // 分享人得到的券不设 referrerUserId,避免无限裂变
      referredBy: sourceUserCouponId,
    })
  } else if (coupon.referrerGets === 'credit' && coupon.referralValue !== null) {
    // 给分享人的 API Key 加余额(referralValue 分)
    const [activeKey] = await tx
      .select({ id: developerApiKeys.id })
      .from(developerApiKeys)
      .where(
        and(eq(developerApiKeys.userId, referrerUserId), eq(developerApiKeys.status, 'active')),
      )
      .orderBy(desc(developerApiKeys.createdAt))
      .limit(1)

    if (activeKey) {
      await tx
        .update(developerApiKeys)
        .set({
          costBalanceCents: sql`${developerApiKeys.costBalanceCents} + ${coupon.referralValue}`,
        })
        .where(eq(developerApiKeys.id, activeKey.id))
    }
    // 如果分享人没有 active Key,余额奖励丢失(可后续补发)
  }
}

// =============================================================================
// 2. redeemCoupon — 核销券(调用前预检)
// =============================================================================

export interface RedeemContext {
  /** 本次消费(分),用于满减校验 */
  spendCents: number
  /** 本次模型,用于 applicableModels 校验 */
  model?: string
}

export interface RedeemResult {
  success: boolean
  discountCents?: number
  userCoupon?: UserCoupon & { coupon: PromoCoupon }
  reason?: string
}

/**
 * 核销券:调用前预检,返回折扣金额。
 *
 * 逻辑:
 * 1. 查 user_coupon → 校验 unused/未过期/适用范围/minSpend
 * 2. 算 discountCents
 * 3. 状态改 used(原子翻转 unused → used)
 *
 * 幂等:用 UPDATE WHERE status='unused' RETURNING 原子翻转。
 */
export async function redeemCoupon(
  userId: string,
  userCouponId: string,
  context: RedeemContext,
): Promise<RedeemResult> {
  // 1. 查 user_coupon + coupon
  const [row] = await dbRead
    .select({
      userCoupon: userCoupons,
      coupon: promoCoupons,
    })
    .from(userCoupons)
    .innerJoin(promoCoupons, eq(userCoupons.couponId, promoCoupons.id))
    .where(eq(userCoupons.id, userCouponId))
    .limit(1)

  if (!row) {
    return { success: false, reason: 'not_found' }
  }

  const { userCoupon: uc, coupon } = row

  // 2. ownership 校验
  if (uc.userId !== userId) {
    return { success: false, reason: 'not_owner' }
  }

  // 3. 校验 unused
  if (uc.status !== 'unused') {
    return { success: false, reason: uc.status === 'used' ? 'already_used' : 'not_unused' }
  }

  // 4. 校验未过期
  const now = new Date()
  if (coupon.expiresAt < now) {
    return { success: false, reason: 'expired' }
  }

  // 5. 校验适用模型
  if (coupon.applicableModels && coupon.applicableModels.length > 0 && context.model) {
    if (!coupon.applicableModels.includes(context.model)) {
      return { success: false, reason: 'model_not_applicable' }
    }
  }

  // 6. 算 discountCents
  let discountCents = 0
  if (coupon.type === 'discount') {
    // 折扣券:value=0.80 表示 8 折,discountCents = spendCents * (1 - value)
    const rate = Number(coupon.value ?? 0)
    discountCents = Math.floor(context.spendCents * (1 - rate))
  } else if (coupon.type === 'deduction') {
    // 满减券:minSpend 门槛,value 减额
    if (coupon.minSpend !== null && context.spendCents < coupon.minSpend) {
      return { success: false, reason: 'min_spend_not_met' }
    }
    discountCents = Number(coupon.value ?? 0)
  } else if (coupon.type === 'referral') {
    // 裂变券:当作折扣券或满减券处理(取决于 value 配置)
    const rate = Number(coupon.value ?? 0)
    if (rate > 0 && rate < 1) {
      discountCents = Math.floor(context.spendCents * (1 - rate))
    } else if (coupon.referralValue !== null && coupon.referralValue > 0) {
      discountCents = coupon.referralValue
    }
  }

  // discountCents 不能超过本次消费
  if (discountCents > context.spendCents) {
    discountCents = context.spendCents
  }

  // 7. 原子翻转状态 unused → used
  const [updated] = await db
    .update(userCoupons)
    .set({
      status: 'used',
      usedAt: new Date(),
      discountCents,
    })
    .where(and(eq(userCoupons.id, userCouponId), eq(userCoupons.status, 'unused')))
    .returning()

  if (!updated) {
    // 抢占失败,可能已被其他请求核销
    return { success: false, reason: 'already_used' }
  }

  return {
    success: true,
    discountCents,
    userCoupon: { ...updated, coupon },
  }
}

// =============================================================================
// 3. refundCoupon — 退券(调用失败时回滚核销)
// =============================================================================

/**
 * 退券:调用失败时回滚核销。
 * 状态 used → unused,清 usedAt/discountCents。
 */
export async function refundCoupon(userCouponId: string): Promise<void> {
  await db
    .update(userCoupons)
    .set({
      status: 'unused',
      usedAt: null,
      discountCents: null,
    })
    .where(and(eq(userCoupons.id, userCouponId), eq(userCoupons.status, 'used')))
}

// =============================================================================
// 4. listUserCoupons — 查用户可用券
// =============================================================================

export async function listUserCoupons(
  userId: string,
  status?: 'unused' | 'used' | 'expired',
): Promise<Array<UserCoupon & { coupon: PromoCoupon }>> {
  const conds: SQL[] = [eq(userCoupons.userId, userId)]
  if (status) {
    conds.push(eq(userCoupons.status, status))
  }

  const rows = await dbRead
    .select({
      userCoupon: userCoupons,
      coupon: promoCoupons,
    })
    .from(userCoupons)
    .innerJoin(promoCoupons, eq(userCoupons.couponId, promoCoupons.id))
    .where(conds.length > 1 ? and(...conds) : conds[0]!)
    .orderBy(desc(userCoupons.createdAt))

  return rows.map((r) => ({ ...r.userCoupon, coupon: r.coupon }))
}

// =============================================================================
// 5. getReferralStats — 裂变统计
// =============================================================================

export interface ReferralStats {
  sharedCount: number
  convertedCount: number
  conversionRate: number
}

/**
 * 裂变统计:某券被分享了多少次,转化多少。
 * - sharedCount: 通过裂变链领取的次数(referrerUserId IS NOT NULL)
 * - convertedCount: 通过裂变链领取且已核销的次数
 * - conversionRate: convertedCount / sharedCount
 */
export async function getReferralStats(couponId: string): Promise<ReferralStats> {
  const [shared] = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(userCoupons)
    .where(and(eq(userCoupons.couponId, couponId), sql`${userCoupons.referrerUserId} IS NOT NULL`))

  const [converted] = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(userCoupons)
    .where(
      and(
        eq(userCoupons.couponId, couponId),
        sql`${userCoupons.referrerUserId} IS NOT NULL`,
        eq(userCoupons.status, 'used'),
      ),
    )

  const sharedCount = shared?.c ?? 0
  const convertedCount = converted?.c ?? 0
  const conversionRate = sharedCount > 0 ? convertedCount / sharedCount : 0

  return { sharedCount, convertedCount, conversionRate }
}

// =============================================================================
// 6. admin 辅助函数
// =============================================================================

export interface BatchGenerateCouponsInput {
  count: number
  template: Omit<NewPromoCoupon, 'id' | 'code' | 'issuedCount' | 'createdAt' | 'updatedAt'>
}

/**
 * 批量生成券(admin 用,根据模板生成 N 个随机码)。
 */
export async function batchGenerateCoupons(
  input: BatchGenerateCouponsInput,
): Promise<PromoCoupon[]> {
  const { count, template } = input

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count 必须是大于 0 的整数')
  }
  if (count > MAX_BATCH_COUNT) {
    throw new Error(`count 不能超过 ${MAX_BATCH_COUNT}`)
  }

  // 生成 count 个不重复的码
  const codeSet = new Set<string>()
  while (codeSet.size < count) {
    codeSet.add(generateCouponCode())
  }

  const rows = Array.from(codeSet).map((code) => ({
    ...template,
    code,
    issuedCount: 0,
  }))

  const inserted = await db.insert(promoCoupons).values(rows).returning()

  return inserted
}

export interface ListCouponsFilter {
  type?: string
  enabled?: boolean
  page?: number
  pageSize?: number
}

export async function listCoupons(
  filter: ListCouponsFilter,
): Promise<{ items: PromoCoupon[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))

  const conds: SQL[] = []
  if (filter.type) {
    conds.push(eq(promoCoupons.type, filter.type))
  }
  if (filter.enabled !== undefined) {
    conds.push(eq(promoCoupons.enabled, filter.enabled))
  }
  const where = conds.length > 0 ? and(...conds) : undefined

  const [items, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(promoCoupons)
      .where(where)
      .orderBy(desc(promoCoupons.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(promoCoupons)
      .where(where),
  ])

  return { items, total: totalRows[0]?.c ?? 0 }
}

export interface CouponStats {
  /** 总发行量,-1 = 无限 */
  total: number
  issued: number
  used: number
  expired: number
  referralShared: number
  referralConverted: number
  referralConversionRate: number
}

export async function getCouponStats(couponId: string): Promise<CouponStats> {
  const [coupon] = await dbRead
    .select()
    .from(promoCoupons)
    .where(eq(promoCoupons.id, couponId))
    .limit(1)

  if (!coupon) {
    throw new Error('coupon_not_found')
  }

  const [used] = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(userCoupons)
    .where(and(eq(userCoupons.couponId, couponId), eq(userCoupons.status, 'used')))

  const [expired] = await dbRead
    .select({ c: sql<number>`count(*)::int` })
    .from(userCoupons)
    .where(and(eq(userCoupons.couponId, couponId), eq(userCoupons.status, 'expired')))

  const referral = await getReferralStats(couponId)

  return {
    total: coupon.totalQuota ?? -1,
    issued: coupon.issuedCount,
    used: used?.c ?? 0,
    expired: expired?.c ?? 0,
    referralShared: referral.sharedCount,
    referralConverted: referral.convertedCount,
    referralConversionRate: referral.conversionRate,
  }
}

export async function listUserCouponsByCoupon(
  couponId: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: Array<UserCoupon & { coupon: PromoCoupon }>; total: number }> {
  const p = Math.max(1, page)
  const ps = Math.min(100, Math.max(1, pageSize))

  const [items, totalRows] = await Promise.all([
    dbRead
      .select({
        userCoupon: userCoupons,
        coupon: promoCoupons,
      })
      .from(userCoupons)
      .innerJoin(promoCoupons, eq(userCoupons.couponId, promoCoupons.id))
      .where(eq(userCoupons.couponId, couponId))
      .orderBy(desc(userCoupons.createdAt))
      .limit(ps)
      .offset((p - 1) * ps),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(userCoupons)
      .where(eq(userCoupons.couponId, couponId)),
  ])

  return {
    items: items.map((r) => ({ ...r.userCoupon, coupon: r.coupon })),
    total: totalRows[0]?.c ?? 0,
  }
}
