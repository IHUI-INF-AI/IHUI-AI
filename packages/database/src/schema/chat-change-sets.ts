// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { chatConversations } from './chat.js'
import { users } from './users.js'

/**
 * 按轮变更集(2026-11-06 立,批次 4)。
 *
 * 为什么以"轮"为聚合单位而不是散点 diff:用户在意的从来不是"某次 write_file 改了哪几行",
 * 而是"这一轮 AI 到底动了哪些文件、能不能整体撤回去"。以 `(conversation_id, turn_id)`
 * 唯一收口,一轮至多一条变更集,重试/续流不会产生第二份台账。
 *
 * 为什么状态分 `open` / `committed` / `partial`:轮次进行中允许继续追加文件;
 * 轮次结束时把 open 收成 committed;上游在 flush 前崩溃时,已落库的文件变更仍可用,
 * 但必须显式标 partial,免得把"没收全"当成"全量"。
 *
 * 为什么 rewind_status 独立于状态:回滚是变更集之上的又一次状态迁移
 * (`available → rewound / conflict`),和"这轮是否结束"是两件事。
 */
export const chatTurnChangeSets = pgTable(
  'chat_turn_change_sets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => chatConversations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 轮次锚点:网关下发的 assistant 占位消息 id(客户端可复用 messageId 关联 UI) */
    turnId: varchar('turn_id', { length: 64 }).notNull(),
    /** ai-service 运行时 session id(文件快照/回滚共用同一把钥匙) */
    sessionId: varchar('session_id', { length: 128 }),
    /**
     * 本轮写盘时的绝对工作区根。回滚可能发生在很久之后,不能靠"当前请求的 root"猜路径;
     * 把根与文件路径一起落库,回滚时才能做 resolve + 越界拒绝。
     */
    workspaceRoot: text('workspace_root'),
    status: varchar('status', { length: 16 }).default('open').notNull(),
    fileCount: integer('file_count').default(0).notNull(),
    additions: integer('additions').default(0).notNull(),
    deletions: integer('deletions').default(0).notNull(),
    rewindStatus: varchar('rewind_status', { length: 16 }).default('available').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convTurnUniq: unique('uq_chat_turn_change_sets_conv_turn').on(t.conversationId, t.turnId),
    userCreatedIdx: index('ix_chat_turn_change_sets_user_created').on(t.userId, t.createdAt),
    statusChk: check(
      'chat_turn_change_sets_status_check',
      sql`${t.status} in ('open', 'committed', 'partial')`,
    ),
    rewindChk: check(
      'chat_turn_change_sets_rewind_check',
      sql`${t.rewindStatus} in ('available', 'rewinding', 'rewound', 'conflict', 'unavailable')`,
    ),
  }),
)

export type ChatTurnChangeSet = typeof chatTurnChangeSets.$inferSelect
export type NewChatTurnChangeSet = typeof chatTurnChangeSets.$inferInsert

/**
 * 变更集逐文件明细(2026-11-06 立,批次 4)。
 *
 * 为什么 before/after 都存 sha256:回滚前必须证明"文件还停在这一轮结束时的样子",
 * 否则把用户之后的编辑一并覆盖掉。sha256 是这一判据的唯一稳定载体(行数/时间戳都不行)。
 *
 * 为什么还要存 before_content:回滚"新增文件"要删除、"删除文件"要恢复,
 * 没有原始正文就只能回滚一半。超过 1MB 的正文不落库并置 `rewind_tracked=false`
 * (见 `content_truncated`),让接口如实回答"这文件不可回滚",而不是假装能回滚。
 *
 * 为什么 operation 只有三档:add / modify / delete。rename 在建表这一层不引入,
 * 因为跨路径 rename 在文件系统层面等价于 add+delete,拆成两行反而与 sha256 判据一致。
 */
export const chatTurnChangeFiles = pgTable(
  'chat_turn_change_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    changeSetId: uuid('change_set_id')
      .references(() => chatTurnChangeSets.id, { onDelete: 'cascade' })
      .notNull(),
    /** 仓库/工作区相对路径,回滚时以 change set 的会话根为基准解析 */
    path: text('path').notNull(),
    operation: varchar('operation', { length: 8 }).notNull(),
    beforeSha256: varchar('before_sha256', { length: 64 }),
    afterSha256: varchar('after_sha256', { length: 64 }),
    additions: integer('additions').default(0).notNull(),
    deletions: integer('deletions').default(0).notNull(),
    unifiedDiff: text('unified_diff'),
    /** 回滚所需的"改前正文";新增文件为 NULL(回滚即删除) */
    beforeContent: text('before_content'),
    contentTruncated: boolean('content_truncated').default(false).notNull(),
    rewindTracked: boolean('rewind_tracked').default(true).notNull(),
    rewindAppliedAt: timestamp('rewind_applied_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    setPathUniq: unique('uq_chat_turn_change_files_set_path').on(t.changeSetId, t.path),
    operationChk: check(
      'chat_turn_change_files_operation_check',
      sql`${t.operation} in ('add', 'modify', 'delete')`,
    ),
  }),
)

export type ChatTurnChangeFile = typeof chatTurnChangeFiles.$inferSelect
export type NewChatTurnChangeFile = typeof chatTurnChangeFiles.$inferInsert
