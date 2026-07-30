import { pgTable, uuid, varchar, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { llmCallLogs } from './llm-call-logs.js'

/**
 * Relay 调用返佣流水表(2026-07-31 立,把返佣绑到 relay 调用消费)。
 *
 * 语义:
 * - sourceUserId  = 被邀请人(消费方,发起 relay 调用的用户)
 * - sourceCallLogId = 关联 llm_call_logs.id(本次消费的调用流水)
 * - sourceCostCents = 本次消费成本(分,= llm_call_logs.cost_cents)
 * - beneficiaryUserId = 邀请人(收益方,sourceUserId 的父级/祖父级)
 * - beneficiaryLevel = 1=父级(直接邀请人) / 2=祖父级(父级的邀请人)
 * - commissionRate = 返佣率(numeric(5,4),0.0500=5%,0.0100=1%)
 * - commissionCents = 返佣金额(分,= sourceCostCents × commissionRate,四舍五入)
 *
 * 状态机:
 * - frozen   = 冻结(默认,创建后 7 天内不可用,防刷)
 * - released = 已释放(冻结期过后,返佣到账到 beneficiary 的 API Key costBalanceCents)
 * - expired  = 已过期(超过释放窗口仍未释放,admin 标记)
 *
 * 返佣率配置:存 system_configs 表(category='relay_commission'),
 *   key='relay_commission.level1_rate' / 'relay_commission.level2_rate' / 'relay_commission.frozen_days'
 *   未配置时用硬编码默认:level1=0.05 / level2=0.01 / frozen_days=7
 */
export const relayCommissionRecords = pgTable(
  'relay_commission_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // 返佣来源(被邀请人消费方)
    sourceUserId: uuid('source_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sourceCallLogId: uuid('source_call_log_id').references(() => llmCallLogs.id, {
      onDelete: 'set null',
    }),
    sourceCostCents: integer('source_cost_cents').notNull(),
    // 返佣收益方(邀请人)
    beneficiaryUserId: uuid('beneficiary_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 1=父级(直接邀请人) / 2=祖父级(父级的邀请人) */
    beneficiaryLevel: integer('beneficiary_level').notNull(),
    /** 返佣率 numeric(5,4),0.0500=5% */
    commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull(),
    /** 返佣金额(分) */
    commissionCents: integer('commission_cents').notNull(),
    /** 'frozen'=冻结 / 'released'=已释放 / 'expired'=已过期 */
    status: varchar('status', { length: 16 }).default('frozen').notNull(),
    /** 冻结到期时间(默认 +7d,到期后可被 releaseExpiredCommissions 释放) */
    frozenUntil: timestamp('frozen_until', { withTimezone: true }).notNull(),
    /** 释放时间(status → released 时填) */
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceUserIdx: index('relay_commission_records_source_user_idx').on(t.sourceUserId),
    beneficiaryIdx: index('relay_commission_records_beneficiary_idx').on(t.beneficiaryUserId),
    statusIdx: index('relay_commission_records_status_idx').on(t.status),
    frozenUntilIdx: index('relay_commission_records_frozen_until_idx').on(t.frozenUntil),
  }),
)

export type RelayCommissionRecord = typeof relayCommissionRecords.$inferSelect
export type NewRelayCommissionRecord = typeof relayCommissionRecords.$inferInsert
