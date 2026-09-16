// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  text,
} from 'drizzle-orm/pg-core'

/**
 * 提示词审计规则表(relay_prompt_audit_rules,2026-09-17 立,补强 54,对标竞品 /prompt-audit)。
 *
 * 用途:对入站提示词做风险检测(涉敏内容、提示词注入特征等),命中后按 action 处理:
 * - log  仅记录命中(默认,零影响)
 * - warn 记录并在响应头/日志告警(不阻断)
 * - block 直接拒绝本次调用(402/400 由调用方决定)
 *
 * 匹配方式:**仅关键字子串匹配(大小写不敏感)**——刻意不支持正则,
 * 规避 ReDoS 与用户可控正则带来的可用性风险;需要复杂模式时用多条 keyword 组合。
 * 匹配前对文本截断(前 N 字符),防止超大输入拖慢链路。
 */
export const relayPromptAuditRules = pgTable(
  'relay_prompt_audit_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    /** 关键字(子串匹配,大小写不敏感) */
    keyword: varchar('keyword', { length: 200 }).notNull(),
    /** 命中动作:log | warn | block */
    action: varchar('action', { length: 8 }).default('log').notNull(),
    /** 严重度 1-5(5 最高,管理端排序用) */
    severity: integer('severity').default(3).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('relay_prompt_audit_rules_enabled_idx').on(t.enabled),
  }),
)

/**
 * 提示词审计命中记录(relay_prompt_audit_hits,2026-09-17 立)。
 * 每次命中一行,供管理端审计与运营分析;block 时同时被拒,便于回溯。
 */
export const relayPromptAuditHits = pgTable(
  'relay_prompt_audit_hits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id').references(() => relayPromptAuditRules.id, { onDelete: 'cascade' }),
    ruleName: varchar('rule_name', { length: 100 }),
    userId: varchar('user_id', { length: 64 }),
    apiKeyId: varchar('api_key_id', { length: 64 }),
    model: varchar('model', { length: 128 }),
    /** 命中的关键字 */
    keyword: varchar('keyword', { length: 200 }),
    /** 采取的行动:log | warn | block */
    actionTaken: varchar('action_taken', { length: 8 }).notNull(),
    /** 命中位置上下文(截断片段,便于人工复核) */
    snippet: text('snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createdIdx: index('relay_prompt_audit_hits_created_at_idx').on(t.createdAt),
    ruleIdx: index('relay_prompt_audit_hits_rule_idx').on(t.ruleId),
  }),
)

export type RelayPromptAuditRule = typeof relayPromptAuditRules.$inferSelect
export type NewRelayPromptAuditRule = typeof relayPromptAuditRules.$inferInsert
export type RelayPromptAuditHit = typeof relayPromptAuditHits.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
