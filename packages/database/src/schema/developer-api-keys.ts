// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  bigint,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { tenants } from './tenant.js'

/**
 * 开发者 API 密钥表。
 * status: 'active'(启用) / 'revoked'(已吊销)。
 * permissions: 权限点列表（jsonb 数组）。rate_limit: 每分钟请求上限。
 * key: 公开标识（前缀+短码）；secret: 仅创建时返回完整值，存储需哈希。
 */
export const developerApiKeys = pgTable(
  'developer_api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    key: varchar('key', { length: 128 }).notNull().unique(),
    secret: varchar('secret', { length: 255 }).notNull(),
    permissions: jsonb('permissions').notNull().default([]),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    rateLimit: integer('rate_limit').default(60).notNull(),
    // --- P0-5 中转站计费字段(2026-07-29 立) ---
    /** Token 余额(-1 = 无限额度,0 = 余额耗尽,>0 = 可用 token 数) */
    tokenBalance: bigint('token_balance', { mode: 'number' }).default(-1).notNull(),
    /** 成本余额(分,-1 = 无限额度,0 = 余额耗尽,>0 = 可用分) */
    costBalanceCents: numeric('cost_balance_cents', {
      precision: 18,
      scale: 6,
      mode: 'number',
    })
      .default(-1)
      .notNull(),
    /** 已用 token 累计(用于统计,不回退) */
    tokenUsedTotal: bigint('token_used_total', { mode: 'number' }).default(0).notNull(),
    /** 已用成本累计(分,用于统计,不回退) */
    costUsedTotalCents: numeric('cost_used_total_cents', {
      precision: 18,
      scale: 6,
      mode: 'number',
    })
      .default(0)
      .notNull(),
    // --- P0-7 API Key 安全粒度字段(2026-07-31 立,对齐 New API 行业标准)---
    /** 过期时间(null = 永不过期),过期后 Key 自动失效 */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** IP 白名单(jsonb 字符串数组,null/空 = 不限制),支持 CIDR */
    allowedIps: jsonb('allowed_ips'),
    /** 模型白名单(jsonb 字符串数组,null/空 = 不限制),支持通配符 gpt-4* */
    allowedModels: jsonb('allowed_models'),
    /** 单次请求 token 上限(null = 不限制),超过拒绝 */
    maxTokensPerReq: integer('max_tokens_per_req'),
    // --- Key 级限流窗口 + IP 黑名单(2026-09-16 立,第二批深度对标补强 B/C)---
    /** IP 黑名单(jsonb 字符串数组,null/空 = 无黑名单);命中即 403,优先于白名单判断 */
    blockedIps: jsonb('blocked_ips'),
    /** 5 小时窗口最大请求数(null = 不限),对齐订阅上游滚动窗口 */
    rateLimit5h: integer('rate_limit_5h'),
    /** 每日(UTC+8 自然日)最大请求数(null = 不限) */
    rateLimit1d: integer('rate_limit_1d'),
    /** 每周(UTC+8 周一~周日)最大请求数(null = 不限) */
    rateLimit7d: integer('rate_limit_7d'),
    // --- per-model 限流列(2026-09-21 立,O2:此前代码自述"字段未落地"导致限流恒跳过)---
    /** 单模型 RPM 上限映射(jsonb {"gpt-4o": 60},null/缺 key = 该模型不限) */
    perModelRpmLimit: jsonb('per_model_rpm_limit').$type<Record<string, number> | null>(),
    /** 单模型 TPM 上限映射(jsonb {"gpt-4o": 100000},null/缺 key = 该模型不限) */
    perModelTpmLimit: jsonb('per_model_tpm_limit').$type<Record<string, number> | null>(),
    // --- 多租户关联字段(对标 New API,API Key 可关联到 tenant 实现组织级配额池)---
    /** 关联的租户 ID(nullable,不关联则为个人 Key),onDelete set null 避免删租户时级联删 Key */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('developer_api_keys_user_idx').on(t.userId),
    keyIdx: index('developer_api_keys_key_idx').on(t.key),
    tenantIdx: index('developer_api_keys_tenant_id_idx').on(t.tenantId),
  }),
)

export type DeveloperApiKey = typeof developerApiKeys.$inferSelect
export type NewDeveloperApiKey = typeof developerApiKeys.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
