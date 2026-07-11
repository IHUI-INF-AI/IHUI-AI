import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 系统配置表。
 * 存储站点级键值对配置（如站点名、是否开放注册、上传限制等）。
 * is_public=true 的配置可被未登录用户读取（GET /api/configs）。
 */
export const systemConfigs = pgTable('system_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: varchar('key', { length: 128 }).notNull().unique(),
  value: text('value').notNull(),
  type: varchar('type', { length: 16 }).default('string').notNull(),
  category: varchar('category', { length: 32 }).default('general').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 集成配置表。
 * 管理第三方服务（微信/支付宝/Stripe/GitHub/Google/Apple/邮件/SMS）的接入配置。
 * credentials 以 jsonb 存储（使用 AES-256-GCM 加密存储，查询时自动解密）。
 */
export const integrationConfigs = pgTable('integration_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  provider: varchar('provider', { length: 32 }).notNull(),
  credentials: jsonb('credentials'),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * API 访问日志表。
 * 由 plugins/api-logger.ts 的 onResponse 钩子异步写入，记录所有 /api 请求。
 * user_id 可空（未鉴权的请求）；用户删除时级联删除其访问记录。
 * 出于隐私和性能考虑，不记录请求/响应体，仅在错误时记录 error 字段。
 */
export const apiLogs = pgTable('api_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  method: varchar('method', { length: 16 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  statusCode: integer('status_code').notNull(),
  duration: integer('duration').notNull(),
  ip: varchar('ip', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
  requestBody: jsonb('request_body'),
  responseBody: jsonb('response_body'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 系统事件表。
 * 记录系统级事件：startup/shutdown/error/warning/maintenance/deploy。
 * 可由系统自动写入（启动/关闭钩子），也可由管理员手动创建。
 */
export const systemEvents = pgTable('system_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 32 }).notNull(),
  level: varchar('level', { length: 16 }).default('info').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SystemConfig = typeof systemConfigs.$inferSelect
export type NewSystemConfig = typeof systemConfigs.$inferInsert
export type IntegrationConfig = typeof integrationConfigs.$inferSelect
export type NewIntegrationConfig = typeof integrationConfigs.$inferInsert
export type ApiLog = typeof apiLogs.$inferSelect
export type NewApiLog = typeof apiLogs.$inferInsert
export type SystemEvent = typeof systemEvents.$inferSelect
export type NewSystemEvent = typeof systemEvents.$inferInsert

/**
 * 支付配置表 (payment_configs)。
 * 存储各支付渠道(微信/支付宝等)的配置键值对。
 * provider: wechat(微信) / alipay(支付宝) / stripe / other。
 * environment: production(生产) / sandbox(沙箱) / test(测试)。
 */
export const paymentConfig = pgTable(
  'payment_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    configKey: varchar('config_key', { length: 100 }).notNull(),
    configValue: text('config_value'),
    isEnabled: boolean('is_enabled').default(true),
    environment: varchar('environment', { length: 20 }).default('production'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('payment_configs_provider_idx').on(t.provider),
  }),
)

export type PaymentConfig = typeof paymentConfig.$inferSelect
export type NewPaymentConfig = typeof paymentConfig.$inferInsert
