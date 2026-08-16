import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 模型价格历史表(2026-08-01 立,价格历史 + 限时折扣调度 + 动态调价建议)。
 *
 * 每次调价(改倍率或改单价)时插入一条快照,只增不改(审计追溯)。
 * 前端用 effectiveAt 升序绘制趋势曲线。
 *
 * 字段语义:
 * - modelId: 模型名(如 'gpt-4o'),与 ai_pricing.model_id 对齐
 * - inputTokenPriceCents / outputTokenPriceCents: 输入/输出单价(分/千 token)
 * - relayMultiplier: 中转站倍率(1.00=原价,0.80=8 折,1.20=加价 20%)
 * - effectiveAt: 本次调价生效时间
 * - reason: 调价原因(如 '渠道成本上涨' / '双 11 大促' / '竞品降价')
 * - changedBy: 操作人 user id(可空,系统自动调价时为 NULL)
 */
export const modelPriceHistory = pgTable(
  'model_price_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    /** 输入单价(分/千 token) */
    inputTokenPriceCents: integer('input_token_price_cents').notNull(),
    /** 输出单价(分/千 token) */
    outputTokenPriceCents: integer('output_token_price_cents').notNull(),
    /** 中转站倍率 numeric(5,2),1.00=原价,0.80=8 折 */
    relayMultiplier: numeric('relay_multiplier', { precision: 5, scale: 2 })
      .default('1.00')
      .notNull(),
    /** 本次调价生效时间 */
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    /** 调价原因 */
    reason: varchar('reason', { length: 256 }),
    /** 操作人 user id(可空,系统自动调价时为 NULL) */
    changedBy: uuid('changed_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelIdx: index('model_price_history_model_idx').on(t.modelId),
    effectiveIdx: index('model_price_history_effective_idx').on(t.effectiveAt),
  }),
)

/**
 * 限时折扣调度表(预设折扣,到点自动生效)。
 *
 * - name: 折扣名(如 '双 11 全场 8 折')
 * - modelId: null=全部模型,非 null=指定模型
 * - discountMultiplier: 折扣倍率(0.80=8 折,叠加在 relay_multiplier 之上)
 * - startsAt / endsAt: 折扣生效/失效时间窗口
 * - enabled: 启用/禁用开关(禁用后即使到了时间窗口也不生效)
 *
 * 计费时调 getActiveDiscounts() 查询当前生效的折扣,与 userBillingGroups 倍率叠加。
 */
export const priceDiscountSchedules = pgTable(
  'price_discount_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 折扣名(如 '双 11 全场 8 折') */
    name: varchar('name', { length: 128 }).notNull(),
    /** 模型 id,null=全部模型 */
    modelId: varchar('model_id', { length: 128 }),
    /** 折扣倍率 numeric(5,2),0.80=8 折 */
    discountMultiplier: numeric('discount_multiplier', { precision: 5, scale: 2 }).notNull(),
    /** 折扣生效时间 */
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    /** 折扣失效时间 */
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    /** 启用/禁用开关 */
    enabled: boolean('enabled').default(true).notNull(),
    /** 创建人 user id(可空) */
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelIdx: index('price_discount_schedules_model_idx').on(t.modelId),
    startsAtIdx: index('price_discount_schedules_starts_at_idx').on(t.startsAt),
    enabledIdx: index('price_discount_schedules_enabled_idx').on(t.enabled),
  }),
)

export type ModelPriceHistory = typeof modelPriceHistory.$inferSelect
export type NewModelPriceHistory = typeof modelPriceHistory.$inferInsert
export type PriceDiscountSchedule = typeof priceDiscountSchedules.$inferSelect
export type NewPriceDiscountSchedule = typeof priceDiscountSchedules.$inferInsert
