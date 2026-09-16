// __PROVENANCE_HEAD_1__
// __PROVENANCE_HEAD_2__
// __PROVENANCE_HEAD_3__

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
 * 中转站告警规则表(relay_alert_rules,2026-09-16 立,深度对标补强 U)。
 *
 * 与静态 alert-notification-service 的区别:本表是**用户可自定义的规则引擎**——
 * 运营者定义"指标 + 比较符 + 阈值 + 评估窗口",评估调度器(relay-alert-evaluation
 * job,每 5 分钟)按规则计算当前值,超阈值即触发:落 relay_alert_events 事件流 +
 * 复用 pushAlert 推送(PagerDuty/webhook 等既有通道)。
 *
 * metric 内置四种(评估 SQL 见 relay-alert-rules-service):
 * - error_rate_1h      近 1 小时失败率(0-1)
 * - avg_latency_1h     近 1 小时平均延迟(ms)
 * - failed_calls_24h   近 24 小时失败调用数
 * - low_balance_keys   余额低于告警线的 active Key 数
 */
export const relayAlertRules = pgTable(
  'relay_alert_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    /** 指标:error_rate_1h | avg_latency_1h | failed_calls_24h | low_balance_keys */
    metric: varchar('metric', { length: 32 }).notNull(),
    /** 比较符:gt(超过阈值触发) | lt(低于阈值触发,如成功率/可用数) */
    comparison: varchar('comparison', { length: 4 }).default('gt').notNull(),
    threshold: numeric('threshold', { precision: 18, scale: 4 }).notNull(),
    /** 触发冷却(分钟):同一规则两次触发之间的最小间隔,防告警风暴 */
    cooldownMinutes: integer('cooldown_minutes').default(30).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('relay_alert_rules_enabled_idx').on(t.enabled),
  }),
)

/**
 * 告警触发事件流(relay_alert_events,2026-09-16 立)。
 * 每次规则触发落一行,构成事件历史(管理端可查"最近告警")。
 * 唯一索引 (rule_id, triggered_at 分桶到分钟) 不做——同分钟可能多次评估,
 * 由 cooldownMinutes 在应用层防重复。
 */
export const relayAlertEvents = pgTable(
  'relay_alert_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id')
      .references(() => relayAlertRules.id, { onDelete: 'cascade' })
      .notNull(),
    /** 触发时实际观测值 */
    observedValue: numeric('observed_value', { precision: 18, scale: 4 }).notNull(),
    threshold: numeric('threshold', { precision: 18, scale: 4 }).notNull(),
    message: varchar('message', { length: 500 }).notNull(),
    /** 推送结果:pushed | push_failed | skipped_cooldown */
    pushStatus: varchar('push_status', { length: 24 }).default('pushed').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ruleTimeIdx: index('relay_alert_events_rule_time_idx').on(t.ruleId, t.createdAt),
  }),
)

export type RelayAlertRule = typeof relayAlertRules.$inferSelect
export type NewRelayAlertRule = typeof relayAlertRules.$inferInsert
export type RelayAlertEvent = typeof relayAlertEvents.$inferSelect
// __PROVENANCE_TAIL__
