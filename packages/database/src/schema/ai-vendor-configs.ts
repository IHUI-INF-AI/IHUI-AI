import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * AI 厂商配置表 (ai_vendor_configs)。
 *
 * R4 重构：将原 ai-vendors.ts 中硬编码的 VENDORS 对象迁移到数据库，
 * 支持动态管理多模态 AI 厂商（DASHSCOPE/DOUBAO/GEMINI/SUNO/SORA2/COZE/BAILIAN/JIMENG4/N8N/TENCENT/VOLCENGINE）。
 *
 * 字段说明：
 * - vendorCode: 厂商唯一编码（路由路径段，例如 'dashscope'）
 * - authType: 鉴权策略类型（bearer / tencent_tc3 / volcengine_v4）
 * - keyEnvName / secretKeyEnvName: 环境变量名（凭据不入库，运行时从环境变量加载）
 * - isEnabled: 是否启用该厂商（关闭后路由直接返回 503）
 * - priority: 排序优先级（同优先级按 vendorCode 字典序）
 * - rateLimit: 厂商级 QPS 上限（预留字段，由 caller service 实施）
 * - configJson: 厂商额外配置（Tencent region/host、Volcengine service 等可覆盖）
 */
export const aiVendorConfigs = pgTable(
  'ai_vendor_configs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorCode: varchar('vendor_code', { length: 64 }).notNull().unique(),
    vendorName: varchar('vendor_name', { length: 128 }).notNull(),
    baseUrl: varchar('base_url', { length: 500 }).notNull(),
    authType: varchar('auth_type', { length: 32 }).notNull(),
    keyEnvName: varchar('key_env_name', { length: 100 }),
    secretKeyEnvName: varchar('secret_key_env_name', { length: 100 }),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    priority: integer('priority').default(0).notNull(),
    rateLimit: integer('rate_limit').default(100),
    configJson: jsonb('config_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('ix_ai_vendor_configs_enabled').on(t.isEnabled),
    codeIdx: index('ix_ai_vendor_configs_code').on(t.vendorCode),
    priorityIdx: index('ix_ai_vendor_configs_priority').on(t.priority),
  }),
)

export type AiVendorConfig = typeof aiVendorConfigs.$inferSelect
export type NewAiVendorConfig = typeof aiVendorConfigs.$inferInsert
