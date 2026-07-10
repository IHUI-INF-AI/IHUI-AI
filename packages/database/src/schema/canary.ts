import { pgTable, uuid, varchar, integer, timestamp, text, boolean } from 'drizzle-orm/pg-core'

/**
 * Canary 发布阶段。
 * off → canary_1pct → canary_5pct → canary_25pct → full
 */
export type CanaryStage = 'off' | 'canary_1pct' | 'canary_5pct' | 'canary_25pct' | 'full'

/**
 * Canary 灰度发布配置表。
 * - name: 唯一配置名称，业务层以此为 key 读写。
 * - target: 目标服务/路由（可选，用于标记灰度对象）。
 * - current_stage / target_stage: 当前与目标灰度阶段。
 * - failure_threshold: 连续失败次数达到阈值后自动回滚。
 * - cooldown_minutes: 两次 promote 之间的最小冷却间隔（分钟）。
 * - auto_rollback: 是否在失败阈值触发时自动回滚（默认 true）。
 * - status: active / paused / completed / rolled_back。
 * - is_active: 业务层使用的活跃标志（与 status 冗余，保留以兼容现有接口）。
 */
export const canaryConfigs = pgTable('canary_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  target: varchar('target', { length: 200 }),
  currentStage: varchar('current_stage', { length: 50 }).$type<CanaryStage>().notNull(),
  targetStage: varchar('target_stage', { length: 50 }).$type<CanaryStage>().notNull(),
  failureThreshold: integer('failure_threshold').notNull(),
  cooldownMinutes: integer('cooldown_minutes').notNull(),
  autoRollback: boolean('auto_rollback').default(true).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  lastPromotedAt: timestamp('last_promoted_at', { withTimezone: true }),
  failureCount: integer('failure_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Canary 审计日志表。
 * - config_id 级联删除：配置删除时自动清理关联日志。
 * - action: promote / rollback / reset / failure / traffic。
 * - from_stage / to_stage: 阶段变更前后的灰度阶段。
 * - operator_id: 操作人（可空，用于系统自动操作）。
 */
export const canaryAuditLogs = pgTable('canary_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  configId: uuid('config_id')
    .references(() => canaryConfigs.id, { onDelete: 'cascade' })
    .notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  fromStage: varchar('from_stage', { length: 50 }).$type<CanaryStage>(),
  toStage: varchar('to_stage', { length: 50 }).$type<CanaryStage>(),
  reason: text('reason'),
  operatorId: uuid('operator_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type CanaryConfig = typeof canaryConfigs.$inferSelect
export type NewCanaryConfig = typeof canaryConfigs.$inferInsert
export type CanaryAuditLog = typeof canaryAuditLogs.$inferSelect
export type NewCanaryAuditLog = typeof canaryAuditLogs.$inferInsert
