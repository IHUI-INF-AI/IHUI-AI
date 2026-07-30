import { pgTable, uuid, varchar, integer, numeric, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 优惠券表(2026-07-31 立,折扣券/满减券/裂变券三合一)。
 *
 * 注:表名用 promo_coupons 而非 coupons,因 promotions.ts 已有同名 coupons 表(简单版)。
 *
 * type: 'discount'=折扣券 / 'deduction'=满减券 / 'referral'=裂变券
 * - 折扣券:value=0.80 表示 8 折(结账时 discountCents = spendCents * (1 - value))
 * - 满减券:minSpend=1000(满 10 元),value=200(减 2 元)
 * - 裂变券:referrerGets='duplicate'(分享人得相同券)/ 'credit'(分享人得余额),referralValue=200(余额分)
 *
 * applicableModels: ['gpt-4o','claude-3-5-sonnet'] 或 null=全部模型
 * applicableScope: 'relay'=中转站 / 'subscription'=订阅 / 'all'=全部
 */
export const promoCoupons = pgTable(
  'promo_coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 券码,如 IHUI-COUPON-XXXXXXXXXXXX(12 位随机,排除易混淆字符 0/O/I/L) */
    code: varchar('code', { length: 32 }).notNull().unique(),
    name: varchar('name', { length: 128 }).notNull(),
    /** 类型:discount=折扣 / deduction=满减 / referral=裂变 */
    type: varchar('type', { length: 16 }).notNull(),
    /** 折扣率(0.80=8 折)或减额(分,200=减 2 元) */
    value: numeric('value', { precision: 5, scale: 2 }),
    /** 满减门槛(分),仅满减券使用 */
    minSpend: integer('min_spend'),
    /** 裂变券:分享人得什么 duplicate=相同券 / credit=余额 */
    referrerGets: varchar('referrer_gets', { length: 16 }),
    /** 裂变券:分享人得多少(分),credit 模式下为余额数 */
    referralValue: integer('referral_value'),
    /** 适用模型列表,null=全部模型 */
    applicableModels: jsonb('applicable_models').$type<string[] | null>(),
    /** 适用范围:relay=中转站 / subscription=订阅 / all=全部 */
    applicableScope: varchar('applicable_scope', { length: 16 }).default('relay').notNull(),
    /** 总发行量,null=无限 */
    totalQuota: integer('total_quota'),
    /** 已发行数(已领取数) */
    issuedCount: integer('issued_count').default(0).notNull(),
    /** 每人限领 */
    perUserLimit: integer('per_user_limit').default(1).notNull(),
    /** 生效时间 */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    /** 过期时间 */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** 是否启用 */
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index('promo_coupons_code_idx').on(t.code),
    typeIdx: index('promo_coupons_type_idx').on(t.type),
    enabledIdx: index('promo_coupons_enabled_idx').on(t.enabled),
  }),
)

/**
 * 用户券(领取记录)。
 * status: 'unused'(未使用) / 'used'(已使用) / 'expired'(已过期)
 *
 * 裂变链:
 * - referrerUserId: 谁分享给我的(裂变券专属)
 * - referredBy: 关联分享人的 user_coupons.id(分享人的券)
 */
export const userCoupons = pgTable(
  'user_coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    couponId: uuid('coupon_id')
      .references(() => promoCoupons.id, { onDelete: 'cascade' })
      .notNull(),
    /** 状态:unused/used/expired */
    status: varchar('status', { length: 16 }).default('unused').notNull(),
    /** 裂变券:谁分享给我的 */
    referrerUserId: uuid('referrer_user_id'),
    /** 裂变券:关联分享人的 user_coupons.id */
    referredBy: uuid('referred_by'),
    /** 核销时间 */
    usedAt: timestamp('used_at', { withTimezone: true }),
    /** 核销的订单 ID */
    usedOnOrderId: uuid('used_on_order_id'),
    /** 核销的调用日志 ID */
    usedOnCallLogId: uuid('used_on_call_log_id'),
    /** 实际折扣金额(分) */
    discountCents: integer('discount_cents'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdStatusIdx: index('user_coupons_user_status_idx').on(t.userId, t.status),
    couponIdIdx: index('user_coupons_coupon_idx').on(t.couponId),
    referrerIdx: index('user_coupons_referrer_idx').on(t.referrerUserId),
  }),
)

export type PromoCoupon = typeof promoCoupons.$inferSelect
export type NewPromoCoupon = typeof promoCoupons.$inferInsert
export type UserCoupon = typeof userCoupons.$inferSelect
export type NewUserCoupon = typeof userCoupons.$inferInsert
