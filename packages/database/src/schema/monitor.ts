import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 监控告警记录表。
 * severity: 'info' / 'warning' / 'critical'。
 * status: 'firing'(触发中) / 'resolved'(已恢复) / 'suppressed'(已抑制)。
 * source: 告警来源标识。labels: 标签（jsonb）。annotations: 附加说明。
 */
export const monitorAlerts = pgTable(
  'monitor_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    source: varchar('source', { length: 100 }).notNull(),
    severity: varchar('severity', { length: 20 }).default('warning').notNull(),
    status: varchar('status', { length: 20 }).default('firing').notNull(),
    message: text('message'),
    labels: jsonb('labels').notNull().default({}),
    annotations: jsonb('annotations').notNull().default({}),
    firedAt: timestamp('fired_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('monitor_alerts_status_idx').on(t.status),
    sourceIdx: index('monitor_alerts_source_idx').on(t.source),
    severityIdx: index('monitor_alerts_severity_idx').on(t.severity),
  }),
)

/**
 * 告警抑制规则表。
 * 匹配条件命中后，告警自动标记为 suppressed。
 * match_labels: 匹配标签（jsonb 键值对）。is_active: 是否启用。
 * suppress_minutes: 抑制时长（分钟）。
 */
export const suppressionRules = pgTable(
  'suppression_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    matchLabels: jsonb('match_labels').notNull().default({}),
    matchSource: varchar('match_source', { length: 100 }),
    isActive: boolean('is_active').default(true).notNull(),
    suppressMinutes: integer('suppress_minutes').default(60).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('suppression_rules_active_idx').on(t.isActive),
  }),
)

export type MonitorAlert = typeof monitorAlerts.$inferSelect
export type NewMonitorAlert = typeof monitorAlerts.$inferInsert
export type SuppressionRule = typeof suppressionRules.$inferSelect
export type NewSuppressionRule = typeof suppressionRules.$inferInsert
