// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { chatConversations } from './chat.js'
import { users } from './users.js'

/**
 * 批次 3(2026-11-06):预算硬约束 / 上下文七类账本 / 压缩边界的**回放账本**。
 *
 * 三张表与 `packages/shared/src/sse/contract.ts` 的三个形状一一对应,但**不是**镜像:
 *  - 线格式是"这一轮发生了什么",本表是"事后还能查什么"。网关只在命名帧透传时落库,
 *    账本写失败绝不阻断流(与 chat-sync / element-pack 同纪律)。
 *  - 值域封闭集(system_prompt…auto_compact / daily_token_limit…)不在 DB 层再抄一份 CHECK:
 *    唯一事实源在 contract.ts 与 Python `app/core/budget_reason.py`,DB 抄第二份必然漂移;
 *    写入前由 apps/api/src/services/chat-ledger-store.ts 按契约校验,不合格整笔不落。
 *  - `conversation_id` 全部 ON DELETE CASCADE:会话删了,账本没有独立存在的理由。
 *  - 三张表刻意不复用既有 family/conversation 表:`chat_conversations` 是内容实体,
 *    账本是观测事实,混表会让"删会话"与"留证据"两个方向互相牵制。
 */
export const chatContextLedgers = pgTable(
  'chat_context_ledgers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 归属主体:由承载层从令牌主体写入,客户端不得自报(AGENTS §5)。 */
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    /** 挂载的 assistant 消息;降级流/无消息坐标时为 null(唯一索引仅覆盖非空)。 */
    messageId: uuid('message_id'),
    /** 轮次下标,缺省 0 = 帧未携带(不拿 null 冒充"第 0 轮")。 */
    turnIndex: integer('turn_index').default(0).notNull(),
    model: text('model'),
    contextLimit: integer('context_limit').notNull(),
    usedTokens: integer('used_tokens').notNull(),
    /** usedTokens / contextLimit × 100,一位小数(与契约 percentage 同口径)。 */
    percentage: numeric('percentage', { precision: 5, scale: 1 }).notNull(),
    /** 七类占用数组(固定顺序),原样存线格式;查询端按契约类型读。 */
    categories: jsonb('categories').notNull(),
    /** 计量口径:provider_usage / heuristic(闭集见契约 ContextLedger.tokenizer)。 */
    tokenizer: text('tokenizer').notNull(),
    compacted: boolean('compacted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /**
     * 幂等锚点:同一 (会话, 消息) 重放/重连重发只更新不新增。
     * 必须是**部分**唯一索引 —— message_id 为 null 的行(降级流)不参与冲突,
     * 否则同一会话的多次降级轮次会被误判成"同一条"。
     */
    convMessageUniq: uniqueIndex('chat_context_ledgers_conv_message_uniq')
      .on(t.conversationId, t.messageId)
      .where(sql`${t.messageId} is not null`),
    convCreatedIdx: index('chat_context_ledgers_conv_created_idx').on(
      t.conversationId,
      t.createdAt.desc(),
    ),
  }),
)

export const chatBudgetStops = pgTable(
  'chat_budget_stops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /**
     * 本批次所有落库入口都要求会话坐标;列留可空只为容纳将来"无会话"的流,
     * 不在迁移里先立一个 NOT NULL 再从存量补值(那会凭空造出假会话)。
     */
    conversationId: uuid('conversation_id').references(() => chatConversations.id, {
      onDelete: 'cascade',
    }),
    messageId: uuid('message_id'),
    /** warning / critical / stopped(与契约 budget 帧 level 同集)。 */
    level: text('level').notNull(),
    /** 原因码闭集见 contract.ts BUDGET_STOP_REASON_CODES,写入前校验,DB 不抄第二份。 */
    reasonCode: text('reason_code').notNull(),
    /** 作用域:daily / hourly / pillar / request / provider。 */
    scope: text('scope').notNull(),
    pillar: text('pillar'),
    usedTokens: integer('used_tokens'),
    limitTokens: integer('limit_tokens'),
    usagePercent: numeric('usage_percent', { precision: 5, scale: 1 }),
    remainingTokens: integer('remaining_tokens'),
    stoppedAtIteration: integer('stopped_at_iteration'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convCreatedIdx: index('chat_budget_stops_conv_created_idx').on(
      t.conversationId,
      t.createdAt.desc(),
    ),
  }),
)

export const chatCompactionBoundaries = pgTable(
  'chat_compaction_boundaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    /** 压缩发生在哪条 assistant 消息的轮次;取不到时为 null(占位 messageId 非 UUID 也按 null)。 */
    messageId: uuid('message_id'),
    /** 触发来源(llm / truncated / incompressible …),与 compaction 帧 trigger 同值。 */
    trigger: text('trigger').notNull(),
    tokensBefore: integer('tokens_before').notNull(),
    tokensAfter: integer('tokens_after').notNull(),
    messagesSummarized: integer('messages_summarized').notNull(),
    durationMs: integer('duration_ms'),
    /** head/anchor/tail 三锚点,原样存契约 CompactBoundary.preservedSegment。 */
    preservedSegment: jsonb('preserved_segment').notNull(),
    /** 被折叠的压缩前消息下标闭区间 {startIndex,endIndex};无边界信息时为 null。 */
    removedRange: jsonb('removed_range'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convCreatedIdx: index('chat_compaction_boundaries_conv_created_idx').on(
      t.conversationId,
      t.createdAt.desc(),
    ),
  }),
)

export type ChatContextLedger = typeof chatContextLedgers.$inferSelect
export type NewChatContextLedger = typeof chatContextLedgers.$inferInsert
export type ChatBudgetStop = typeof chatBudgetStops.$inferSelect
export type NewChatBudgetStop = typeof chatBudgetStops.$inferInsert
export type ChatCompactionBoundary = typeof chatCompactionBoundaries.$inferSelect
export type NewChatCompactionBoundary = typeof chatCompactionBoundaries.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
