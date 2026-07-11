import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * AI 能力表（ai_capabilities）。
 * - category: text(文本生成) / image(图像生成) / audio(音频) / video(视频) / multimodal / reasoning / tool_use。
 * - provider: openai / anthropic / google / azure / local。
 * - status: draft / testing / staging / production / deprecated。
 * - capability_schema: 输入/输出 schema（jsonb，JSON Schema 格式）。
 */
export const aiCapabilities = pgTable(
  'ai_capabilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull().unique(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    version: varchar('version', { length: 32 }).default('1.0.0').notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).default('draft').notNull(),
    capabilitySchema: jsonb('capability_schema').notNull().default({}),
    inputExample: jsonb('input_example'),
    outputExample: jsonb('output_example'),
    avgLatencyMs: integer('avg_latency_ms'),
    avgCostUsd: real('avg_cost_usd'),
    qualityScore: real('quality_score'),
    enabled: boolean('enabled').default(true).notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('ai_capabilities_category_idx').on(t.category),
    providerIdx: index('ai_capabilities_provider_idx').on(t.provider),
    statusIdx: index('ai_capabilities_status_idx').on(t.status),
  }),
)

/**
 * AI 能力模板表（ai_capability_templates）。
 * - 预定义模板，可基于模板快速创建 ai_capabilities 实例。
 * - template_schema: 模板的参数 schema（jsonb）。
 * - use_count: 模板被使用的次数（用于热度排序）。
 */
export const aiCapabilityTemplates = pgTable(
  'ai_capability_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull().unique(),
    category: varchar('category', { length: 64 }).notNull(),
    description: text('description'),
    templateSchema: jsonb('template_schema').notNull().default({}),
    defaultPayload: jsonb('default_payload').notNull().default({}),
    tags: jsonb('tags').notNull().default([]),
    isBuiltin: boolean('is_builtin').default(false).notNull(),
    useCount: integer('use_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('ai_capability_templates_category_idx').on(t.category),
  }),
)

export type AiCapability = typeof aiCapabilities.$inferSelect
export type NewAiCapability = typeof aiCapabilities.$inferInsert
export type AiCapabilityTemplate = typeof aiCapabilityTemplates.$inferSelect
export type NewAiCapabilityTemplate = typeof aiCapabilityTemplates.$inferInsert
