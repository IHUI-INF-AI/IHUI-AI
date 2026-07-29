import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  text,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 中转站 Key 池表 (ai_relay_key_pool)。
 *
 * P0-5c(2026-07-29 立):同 provider 多 key 负载均衡/故障转移。
 * - 关联 ai_model_config 的 providerCode(不直接 FK,允许灵活引用)
 * - apiKeyEnc:加密存储的上游 API Key(同 aiModelConfig.apiKeyEnc 模式)
 * - priority:优先级(越小越优先),weight:权重(同优先级内加权随机)
 * - healthStatus:unknown/healthy/degraded/down,healthCheckedAt 最近检查时间
 * - isEnabled:启用/禁用开关
 */
export const aiRelayKeyPool = pgTable(
  'ai_relay_key_pool',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 关联 ai_model_config.provider_code(同 provider 的多 key 池) */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** Key 名称(admin 识别用,如 "StepFun 主账号 #1") */
    name: varchar('name', { length: 128 }).notNull(),
    /** 加密的上游 API Key(同 aiModelConfig.apiKeyEnc 模式) */
    apiKeyEnc: text('api_key_enc').notNull(),
    /** Key 公开前缀(用于 UI 显示,如 "sk-***...***3a2f") */
    keyPrefix: varchar('key_prefix', { length: 32 }),
    /** 优先级(越小越优先,0 = 最高) */
    priority: integer('priority').default(0).notNull(),
    /** 权重(同优先级内加权随机,默认 1) */
    weight: integer('weight').default(1).notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    /** 健康状态:unknown / healthy / degraded / down */
    healthStatus: varchar('health_status', { length: 16 }).default('unknown').notNull(),
    healthCheckedAt: timestamp('health_checked_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    /** 额度信息(可选,从上游拉取或 admin 手填,单位:分,-1=无限) */
    balanceCents: integer('balance_cents').default(-1),
    /** 备注 */
    remark: text('remark'),
    extraMetadata: jsonb('extra_metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('ai_relay_key_pool_provider_idx').on(t.providerCode),
    enabledIdx: index('ai_relay_key_pool_enabled_idx').on(t.isEnabled),
    priorityIdx: index('ai_relay_key_pool_priority_idx').on(t.priority),
  }),
)

/**
 * 中转站动态发现待审批表 (ai_relay_discovery)。
 *
 * P0-5c(2026-07-29 立):从上游 provider 拉取新模型 → 待审批 → 入库上架。
 * - status: pending(待审批)/ approved(已通过,已写入 aiModelConfigModels)/ rejected(已驳回)/ discovered(刚发现,等待人工触发审批)
 * - upstreamPrice:上游定价快照(JSON,如 { input: 0.5, output: 1.5, currency: 'CNY' })
 * - reviewedBy:审批人 user id(可空,系统自动通过时为 NULL)
 */
export const aiRelayDiscovery = pgTable(
  'ai_relay_discovery',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 来源 provider 编码(如 'stepfun' / 'openrouter') */
    providerCode: varchar('provider_code', { length: 64 }).notNull(),
    /** 上游模型 id(原始 model id,如 'step-3.7-flash') */
    modelId: varchar('model_id', { length: 128 }).notNull(),
    /** 模型展示名(上游返回的 name) */
    modelName: varchar('model_name', { length: 256 }),
    /** 上下文长度(上游返回) */
    contextLength: integer('context_length'),
    /** 上游定价快照(JSON,如 { input: 0.5, output: 1.5, currency: 'CNY' }) */
    upstreamPrice: jsonb('upstream_price'),
    /** 上游返回的能力标签(JSON array,如 ['chat', 'vision', 'tools']) */
    capabilities: jsonb('capabilities').default([]),
    /** 上游返回的描述 */
    description: text('description'),
    /** 状态:discovered / pending / approved / rejected */
    status: varchar('status', { length: 16 }).default('discovered').notNull(),
    /** 审批人 user id(可空) */
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** 驳回原因 / 审批备注 */
    reviewNote: text('review_note'),
    /** 审批通过后写入 aiModelConfigModels 的 id(关联追溯) */
    approvedModelRowId: bigint('approved_model_row_id', { mode: 'number' }),
    /** 原始上游 metadata(完整保留,用于审批参考) */
    rawMetadata: jsonb('raw_metadata').default({}),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('ai_relay_discovery_provider_idx').on(t.providerCode),
    statusIdx: index('ai_relay_discovery_status_idx').on(t.status),
    providerModelUniq: unique('ai_relay_discovery_provider_model_unique').on(
      t.providerCode,
      t.modelId,
    ),
  }),
)

export type AiRelayKeyPool = typeof aiRelayKeyPool.$inferSelect
export type NewAiRelayKeyPool = typeof aiRelayKeyPool.$inferInsert
export type AiRelayDiscovery = typeof aiRelayDiscovery.$inferSelect
export type NewAiRelayDiscovery = typeof aiRelayDiscovery.$inferInsert
