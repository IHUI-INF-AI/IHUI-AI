// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { chatConversations, chatMessages } from './chat.js'
import { users } from './users.js'

/**
 * 输入幂等 receipt(2026-11-06 立,批次 4)。
 *
 * 为什么必须落库:客户端重试(网络抖动 / 双击 / 切网重连)会带着同一个 `inputId`
 * 再次打到网关。此前 ai-service 的 `_admission_seen` 是进程内 dict —— 多实例网关下
 * 两个实例各算各的、重启即清空,"同一输入只生成一次"根本无从判据。本表把
 * `(conversation_id, input_id)` 收成唯一索引,由存储层兜住幂等,而不是靠某个进程的内存。
 *
 * 为什么要 fingerprint:`inputId` 是客户端生成的,一旦客户端复用同一 id 却改了正文
 * (编辑后重发、批量脚本撞 id),静默去重会把新内容吞掉。同 id 不同 fingerprint
 * 一律按 `input_id_reused` 拒绝,并让客户端显式换 id —— 这比"帮用户猜"更安全。
 *
 * 为什么 status 只有三档:`dispatching`(已被网关受理、上游尚未结束)/ `dispatched`
 * (本轮已产出终态)/ `failed`(上游在产出前失败)。只有 `failed` 允许同 id 重试;
 * `dispatching` 的重复请求回 duplicate 而不是再生成一份。
 */
export const chatInputReceipts = pgTable(
  'chat_input_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    inputId: varchar('input_id', { length: 128 }).notNull(),
    /** sha256(规范化请求体),用于识别"同 id 不同正文"的复用 */
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    /** 客户端预生成的 assistant 占位消息 id,重复请求据此回放/续流 */
    messageId: varchar('message_id', { length: 64 }),
    status: varchar('status', { length: 16 }).default('dispatching').notNull(),
    /** 本输入总共被投递过几次(含重复命中),供客户端/运维观测 */
    attemptCount: integer('attempt_count').default(1).notNull(),
    lastErrorCode: varchar('last_error_code', { length: 64 }),
    /**
     * 租约到期时刻(2026-11-06 增补):受理时写成 now()+90s,由网关心跳每 30s 续租。
     * 进程崩溃后行会永远停在 `dispatching`,没有租约就只能一直判 duplicate 而卡死;
     * 有租约则"同 inputId 重试"可在过期后原子接管这一轮。
     * 过期判定一律交给 SQL 的 `now()`(谓词写在 WHERE 里),不用应用时钟比较。
     */
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convInputUniq: unique('uq_chat_input_receipts_conv_input').on(t.conversationId, t.inputId),
    userCreatedIdx: index('ix_chat_input_receipts_user_created').on(t.userId, t.createdAt),
    statusChk: check(
      'chat_input_receipts_status_check',
      sql`${t.status} in ('dispatching', 'dispatched', 'failed')`,
    ),
  }),
)

export type ChatInputReceipt = typeof chatInputReceipts.$inferSelect
export type NewChatInputReceipt = typeof chatInputReceipts.$inferInsert

/**
 * 流式消息投影(2026-11-06 立,批次 4)。
 *
 * 为什么需要第二份表:assistant 正文在流结束后才由 ai-callback worker 写入
 * `chat_messages`,一旦进程崩溃 / 断线,已经吐给用户的半截正文没有任何持久证据,
 * 重连只能靠客户端把 prefix 再传回来。投影表按 `pending → materializing → committed`
 * 记录网关侧观测到的流式正文,给"断线后到底生成了什么"一个服务端事实来源。
 *
 * 为什么状态机在 DB 层封闭:pending 只允许前进到 materializing/committed/failed,
 * materializing 只允许到 committed/failed —— 一旦落库顺序错乱(worker 先提交、
 * 网关后写 partial),约束会让写入当场失败而不是留下一条自相矛盾的记录。
 *
 * 为什么记 attempt_count:同一 `(conversation, client_message_id)` 的重试/续流会让
 * 同一个占位消息被多次打开流;次数是续流归因与"投影是否被重放污染"的唯一判据。
 */
export const chatMessageProjections = pgTable(
  'chat_message_projections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 客户端预生成的消息 id;不使用 chat_messages.id,因为落库前它还不存在 */
    clientMessageId: varchar('client_message_id', { length: 64 }).notNull(),
    state: varchar('state', { length: 16 }).default('pending').notNull(),
    attemptCount: integer('attempt_count').default(1).notNull(),
    content: text('content'),
    reasoning: text('reasoning'),
    tokens: integer('tokens'),
    metadata: jsonb('metadata'),
    committedMessageId: uuid('committed_message_id').references(() => chatMessages.id, {
      onDelete: 'set null',
    }),
    errorCode: varchar('error_code', { length: 64 }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convClientMsgUniq: unique('uq_chat_message_projections_conv_client_msg').on(
      t.conversationId,
      t.clientMessageId,
    ),
    userStateIdx: index('ix_chat_message_projections_user_state').on(t.userId, t.state),
    stateChk: check(
      'chat_message_projections_state_check',
      sql`${t.state} in ('pending', 'materializing', 'committed', 'failed')`,
    ),
  }),
)

export type ChatMessageProjection = typeof chatMessageProjections.$inferSelect
export type NewChatMessageProjection = typeof chatMessageProjections.$inferInsert
