// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍‌​‌‌​​‌‍‌​‌‌​​‌​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌​‌​​‌‍​‌‌​​‌​‌‍‍‌​​‌​‌​‌‍‍‌​‌​‌​‌​‍​​‌​​‌‌​‌‍​‌​‌​‌‌​‍​‌​‌​‌‌​‌‍​‌​‌​​‌‌‍​‌‌​‌​​‌‍​‌‌​​‌‌​‍​‌​‌​​‌‌‍​‌‌​​‌‌​‍​​‌​​‌‌​‌‍​‌​‌​‌‌​‍​‌​‌‌​‌​‌‍​‌​‌​​‌‌‍​‌‌​‌​​‌‍​‌‌​​‌‌​‍​‌​‌​​‌‌‍​‌‌​​‌‌​‍⁠

import { pgTable, uuid, varchar, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * 发布 API 独立用量账本（2026-11-28 立）。
 *
 * 与 audit_logs 的分工：
 * - audit_logs 是“请求审计”，按 HTTP 请求记，含读写、失败、参数摘要；
 * - 本表是“计费账本”，只在开放能力真正创建发布任务成功后记一行，绑定 task_id。
 *
 * 金额字段暂不放进第一版：当前没有定价与结算账户，先保证“哪个 Key、哪次任务、
 * 多少计费单位”可独立追溯，避免用 0 元假流水冒充分成。
 */
export const publishApiUsageRecords = pgTable(
  'publish_api_usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 调用方 API Key；不设外键，删 Key 后账本仍保留历史。 */
    apiKeyId: uuid('api_key_id').notNull(),
    /** Key 归属用户；不设外键，保留历史。 */
    userId: uuid('user_id').notNull(),
    capabilityScope: varchar('capability_scope', { length: 64 }).default('publish:submit').notNull(),
    /** task.create / task.read */
    action: varchar('action', { length: 32 }).notNull(),
    taskId: varchar('task_id', { length: 64 }),
    statusCode: integer('status_code').notNull(),
    /** 计费单位；当前只把“成功创建任务”记 1，读接口不记。 */
    units: integer('units').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyTimeIdx: index('publish_api_usage_records_key_time_idx').on(t.apiKeyId, t.createdAt),
    taskActionUniq: uniqueIndex('publish_api_usage_records_task_action_uniq').on(
      t.apiKeyId,
      t.action,
      t.taskId,
    ),
  }),
)

export type PublishApiUsageRecord = typeof publishApiUsageRecords.$inferSelect
export type NewPublishApiUsageRecord = typeof publishApiUsageRecords.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​‌‍‍​‍​‌​‌​​‌‌‍​‌‌​​‌‌​‍​​‌​​‌‌​‌‍​‌​‌​‌‌​‍​‌​‌‌​‌​‌‍​‌​‌​​‌‌‍​‌‌​‌​​‌‍​‌‌​​‌‌​‍​‌​‌​​‌‌‍​‌‌​​‌‌​‍⁠
