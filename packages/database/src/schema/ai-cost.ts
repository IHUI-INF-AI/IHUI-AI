import { pgTable, uuid, varchar, timestamp, integer, boolean, numeric, text, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * AI 成本记录表。
 * 每次 AI 调用（LLM/图像/语音）记录 token 用量与成本，用于成本治理看板。
 * cost 以美元为单位（numeric，保留 6 位小数）。
 */
export const aiCostRecords = pgTable(
  'ai_cost_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id'),
    model: varchar('model', { length: 128 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    promptTokens: integer('prompt_tokens').default(0).notNull(),
    completionTokens: integer('completion_tokens').default(0).notNull(),
    totalTokens: integer('total_tokens').default(0).notNull(),
    cost: numeric('cost', { precision: 12, scale: 6 }).default('0').notNull(),
    cached: boolean('cached').default(false).notNull(),
    requestType: varchar('request_type', { length: 32 }).default('chat').notNull(),
    promptHash: varchar('prompt_hash', { length: 64 }),
    metadata: text('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ai_cost_user_idx').on(t.userId),
    tenantIdx: index('ai_cost_tenant_idx').on(t.tenantId),
    modelIdx: index('ai_cost_model_idx').on(t.model),
    createdIdx: index('ai_cost_created_idx').on(t.createdAt),
  }),
);

/**
 * AI 预算配置表。
 * 按用户/租户/模型维度配置 token 预算上限，超额拒绝或告警。
 * scope: 'user' | 'tenant' | 'model'，与 scopeKey 组合定位。
 */
export const aiBudgets = pgTable(
  'ai_budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: varchar('scope', { length: 32 }).notNull(),
    scopeKey: varchar('scope_key', { length: 128 }).notNull(),
    model: varchar('model', { length: 128 }),
    dailyTokenLimit: integer('daily_token_limit').default(1_000_000).notNull(),
    monthlyTokenLimit: integer('monthly_token_limit').default(30_000_000).notNull(),
    dailyCostLimit: numeric('daily_cost_limit', { precision: 10, scale: 4 }).default('100').notNull(),
    monthlyCostLimit: numeric('monthly_cost_limit', { precision: 10, scale: 4 }).default('2000').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    scopeUnique: index('ai_budget_scope_idx').on(t.scope, t.scopeKey, t.model),
  }),
);

export type AiCostRecord = typeof aiCostRecords.$inferSelect;
export type NewAiCostRecord = typeof aiCostRecords.$inferInsert;
export type AiBudget = typeof aiBudgets.$inferSelect;
export type NewAiBudget = typeof aiBudgets.$inferInsert;
