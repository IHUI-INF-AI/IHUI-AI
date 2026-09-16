// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  numeric,
  timestamp,
  text,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 订阅方案表。
 * price 以分为单位（integer），避免浮点误差。
 * interval: 'month' | 'year'。features: 方案权益列表（jsonb）。
 */
export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  interval: varchar('interval', { length: 16 }).notNull(),
  features: jsonb('features').notNull().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  wechatPlanId: varchar('wechat_plan_id', { length: 64 }),
  billingPeriod: varchar('billing_period', { length: 20 }).default('month').notNull(),
  trialDays: integer('trial_days').default(0).notNull(),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  // ── 订阅套餐结构化限额(2026-09-16 立) ──
  // 背景:原实现把 token 配额塞进 features 字符串数组(如 "500000 tokens/month"),
  // 运行时用正则解析(parseTokenQuotaFromFeatures),无法表达"日/周/月窗口限额",
  // 也无法承载原价、币种、在售状态与套餐模型白名单。此处改为结构化列,
  // 旧的 features 字符串解析保留为兼容兜底(见 api-subscription-service)。
  // 限额单位:token。-1 = 不限;0 = 未配置该维度(不约束);>0 = 窗口内可用上限。
  dailyTokenLimit: bigint('daily_token_limit', { mode: 'number' }).default(0).notNull(),
  weeklyTokenLimit: bigint('weekly_token_limit', { mode: 'number' }).default(0).notNull(),
  monthlyTokenLimit: bigint('monthly_token_limit', { mode: 'number' }).default(0).notNull(),
  /** 订阅有效期(天);0 = 不过期(长期有效) */
  validityDays: integer('validity_days').default(30).notNull(),
  /** 划线原价(分);0 = 不展示原价 */
  originalPrice: integer('original_price').default(0).notNull(),
  /** 套餐可用模型白名单(jsonb 字符串数组);空数组 = 全部已上架模型 */
  modelWhitelist: jsonb('model_whitelist').notNull().default([]),
  /** 是否在售(下架后不对外展示,但已购订阅不受影响) */
  isForSale: boolean('is_for_sale').default(true).notNull(),
  /**
   * 绑定的计费分组名(软关联 user_billing_groups.name,该表以 name 唯一;空 = 不绑定分组)。
   * 订阅激活时按此自动入组(assignedReason='subscription',expiresAt=订阅 endAt),
   * 用户即应用分组倍率与限流;订阅到期随 members.expiresAt 自动降级回默认组。
   */
  billingGroupCode: varchar('billing_group_code', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 统一订单表（Phase 1 合并：原 billing.orders + edu_orders 教育订单）。
 * amount/originalPrice/discountAmount 以分为单位（integer），避免浮点误差。
 * status: pending|paid|cancelled|refunded。
 * user_id 可空：用户删除时保留订单财务凭证，userId 置 NULL；plan_id 默认 NO ACTION（有订单时禁止删除方案）。
 * orderType: 1=membership 2=token 3=activity 4=identity 6=api_subscription 7=course 8=card（0=未分类）。
 * paymentMethod: 统一支付方式（原 edu_orders.payType，varchar(50) 兼容所有支付类型）。
 * targetId/targetTitle/quantity: 教育订单关联目标（课程/会员卡）。
 * originalPrice/discountAmount: 原价/优惠金额（分），amount 为实付金额。
 * cancelTime/refundTime: 取消/退款时间（paidAt 对应原 payTime）。
 * G10:补 updatedBy 字段(审计追溯,用户删除时 SET NULL)
 * G13:补 createdBy 字段(创建者审计,与 updatedBy 区分)
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNo: varchar('order_no', { length: 64 }).notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    planId: uuid('plan_id').references(() => plans.id),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }),
    orderType: integer('order_type').default(0).notNull(),
    productId: varchar('product_id', { length: 64 }),
    targetId: varchar('target_id', { length: 64 }),
    targetTitle: varchar('target_title', { length: 200 }),
    quantity: integer('quantity').default(1).notNull(),
    originalPrice: integer('original_price').default(0).notNull(),
    discountAmount: integer('discount_amount').default(0).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    cancelTime: timestamp('cancel_time', { withTimezone: true }),
    refundTime: timestamp('refund_time', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    remark: varchar('remark', { length: 500 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('orders_user_idx').on(t.userId),
    statusIdx: index('orders_status_idx').on(t.status),
    typeIdx: index('orders_type_idx').on(t.orderType),
  }),
)

/**
 * 支付记录表。
 * provider: wechat|alipay|stripe|paypal|usdc。status: pending|success|failed。
 * order_id 级联删除；raw_response 为网关原始响应（不含敏感信息时不返回）。
 */
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  provider: varchar('provider', { length: 16 }).notNull(),
  providerOrderId: varchar('provider_order_id', { length: 128 }),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 16 }).default('pending').notNull(),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

/**
 * AI 模型定价表（ai_pricing）。
 * - modelId: 模型标识（对应 ai_model_config.name 与 ai_cost_records.model，按模型名匹配定价）。
 * - inputTokenPrice/outputTokenPrice: 输入/输出 token 单价，单位"分/千 token"（numeric(18,6)）。
 * - billingMode: 计费模式(2026-09-13 立,四选一):
 *     'token'     按 token 计费(默认,用 input/outputTokenPrice)
 *     'per_call'  按次计费(用 tieredCallPrices 三档,档位按请求 promptTokens 划分)
 *     'per_image' 按张计费(用 perUnitPrice,分/张)
 *     'per_video' 按视频计费(用 perUnitPrice,单位看 videoUnit:'call'=分/次,'second'=分/秒)
 * - perUnitPrice: 单位价(分),per_image=分/张;per_video 看 videoUnit(分/次 或 分/秒)。
 * - tieredCallPrices: per_call 三档价(分/次),键 le256k/mid/gt512k,
 *     档位阈值 256K=262144、512K=524288(按请求 promptTokens)。
 * - videoUnit: per_video 计价单位,'call'(默认)|'second'。
 * - regionPricing: 区域差价系数 JSON，如 { "cn": 1.0, "us": 1.2, "eu": 1.15 }。
 * - discount: 折扣规则 JSON，如 { "type": "percentage", "value": 0.8, "minTokens": 100000 }。
 * - currency: 货币类型，默认 CNY。
 * - effectiveAt/expiresAt: 生效/过期时间，用于支持定价版本管理。
 */
export const aiPricing = pgTable(
  'ai_pricing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    // 单位:分/千 token(CNY)。numeric(18,6) 保留 6 位小数——极廉价模型
    // (如 gpt-4o-mini $0.15/1M ≈ 0.108 分/千 token)在 integer 下会 round 成 0 分。
    // mode:'number' 保持 TS 侧 number 类型,消费端零适配。
    inputTokenPrice: numeric('input_token_price', {
      precision: 18,
      scale: 6,
      mode: 'number',
    }).notNull(),
    outputTokenPrice: numeric('output_token_price', {
      precision: 18,
      scale: 6,
      mode: 'number',
    }).notNull(),
    // 计费模式(2026-09-13):token | per_call | per_image | per_video,默认 token 向后兼容
    billingMode: varchar('billing_mode', { length: 16 }).default('token').notNull(),
    // 单位价(分):per_image=分/张;per_video=分/次 或 分/秒(videoUnit)
    perUnitPrice: numeric('per_unit_price', { precision: 18, scale: 6, mode: 'number' }),
    // per_call 三档价(分/次):{ le256k, mid, gt512k }
    tieredCallPrices: jsonb('tiered_call_prices'),
    // per_video 计价单位:'call'(按次) | 'second'(按秒)
    videoUnit: varchar('video_unit', { length: 8 }),
    // ── 长上下文加价 + 推理输出倍率(2026-09-16 立,对标 Sub2API maxReasoningMultiplier)──
    // 长上下文加价:promptTokens 超过阈值时,倍率链额外乘 longContextMultiplier
    // (上游对超长上下文的成本上浮转嫁,如 1.5 = 加价 50%)。
    longContextMultiplier: numeric('long_context_multiplier', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }),
    /** 长上下文判定阈值(请求 promptTokens,默认 200K) */
    longContextThresholdTokens: integer('long_context_threshold_tokens'),
    /** 推理输出倍率:仅作用于 completionTokens 分量(推理模型输出成本上浮),1 = 同价 */
    reasoningOutputMultiplier: numeric('reasoning_output_multiplier', {
      precision: 10,
      scale: 4,
      mode: 'number',
    }),
    regionPricing: jsonb('region_pricing').notNull().default({ cn: 1.0 }),
    discount: jsonb('discount'),
    currency: varchar('currency', { length: 8 }).default('CNY').notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelIdx: index('ai_pricing_model_idx').on(t.modelId),
    effectiveIdx: index('ai_pricing_effective_idx').on(t.effectiveAt),
  }),
)

export type AiPricing = typeof aiPricing.$inferSelect
export type NewAiPricing = typeof aiPricing.$inferInsert

/**
 * API 订阅实例表(api_subscriptions,2026-09-16 立)。
 *
 * 背景:此前 API 订阅(N 号订阅)只把 plan 的 token 配额一次性累加进
 * developer_api_keys.token_balance,既没有"有效期",也没有"窗口限额",
 * 因此无法表达"包月每月 200 万 token、每日 20 万 token"这类商品形态。
 *
 * 本表记录每笔已支付订阅的有效期与限额快照(快照 = 下单时的 plan 配置,
 * 后续改套餐不影响已购用户),窗口用量另见 api_subscription_window_usage。
 *
 * status: active | expired | cancelled。
 * 限额快照单位 token:-1 = 不限;0 = 未配置该维度;>0 = 上限。
 */
export const apiSubscriptions = pgTable(
  'api_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** 触发本订阅的支付单号(幂等键,与 token_flows.related_order_no 同源) */
    orderNo: varchar('order_no', { length: 64 }),
    /** 下单时的方案名快照(方案改名/下架后仍可追溯) */
    planName: varchar('plan_name', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).default('active').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).defaultNow().notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    dailyTokenLimit: bigint('daily_token_limit', { mode: 'number' }).default(0).notNull(),
    weeklyTokenLimit: bigint('weekly_token_limit', { mode: 'number' }).default(0).notNull(),
    monthlyTokenLimit: bigint('monthly_token_limit', { mode: 'number' }).default(0).notNull(),
    autoRenew: boolean('auto_renew').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userStatusIdx: index('api_subscriptions_user_status_idx').on(t.userId, t.status),
    endIdx: index('api_subscriptions_end_at_idx').on(t.endAt),
    orderNoIdx: index('api_subscriptions_order_no_idx').on(t.orderNo),
  }),
)

/**
 * 订阅窗口用量表(api_subscription_window_usage,2026-09-16 立)。
 *
 * 每个订阅 × 窗口类型 × 窗口起点 一行,记录该窗口内已消耗的 token 与成本。
 * 窗口起点按 UTC+8 计算(与 tiered-pricing-service 的月度口径一致):
 * - daily   → 当日 00:00:00
 * - weekly  → 本周一 00:00:00
 * - monthly → 当月 1 日 00:00:00
 *
 * 唯一索引 (subscription_id, window_type, window_start) 保证并发下同一窗口
 * 只有一行,写入用 UPSERT 累加(见 subscription-window-service)。
 */
export const apiSubscriptionWindowUsage = pgTable(
  'api_subscription_window_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subscriptionId: uuid('subscription_id')
      .references(() => apiSubscriptions.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 窗口类型:daily | weekly | monthly */
    windowType: varchar('window_type', { length: 8 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
    tokensUsed: bigint('tokens_used', { mode: 'number' }).default(0).notNull(),
    costUsedCents: numeric('cost_used_cents', { precision: 18, scale: 6, mode: 'number' })
      .default(0)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    windowUniqIdx: uniqueIndex('api_subscription_window_usage_uniq_idx').on(
      t.subscriptionId,
      t.windowType,
      t.windowStart,
    ),
    userWindowIdx: index('api_subscription_window_usage_user_idx').on(t.userId, t.windowType),
  }),
)

export type ApiSubscription = typeof apiSubscriptions.$inferSelect
export type NewApiSubscription = typeof apiSubscriptions.$inferInsert
export type ApiSubscriptionWindowUsage = typeof apiSubscriptionWindowUsage.$inferSelect
export type NewApiSubscriptionWindowUsage = typeof apiSubscriptionWindowUsage.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
