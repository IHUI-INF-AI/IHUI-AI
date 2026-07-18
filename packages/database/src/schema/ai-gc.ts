import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * AI 生成内容表 (ai_gc_content)。
 * 等价自旧架构 ai_gc 表，记录用户通过 AI 生成的内容。
 * gcType: text(文本) / image(图像) / audio(语音) / video(视频)。
 * status: 0=禁用, 1=启用。
 * userUuid / agentId 沿用旧架构字符串标识（非 DB 外键）。
 */
export const aiGcContent = pgTable(
  'ai_gc_content',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 64 }),
    gcType: varchar('gc_type', { length: 32 }).default('text'),
    content: text('content'),
    status: integer('status').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_ai_gc_content_status').on(t.status),
    userUuidIdx: index('ix_ai_gc_content_user_uuid').on(t.userUuid),
  }),
)

/**
 * AI 生成任务表 (ai_gc_task)。
 * 等价自旧架构 ai_gc_user_log 表，记录用户对生成内容的操作行为。
 * action: view(查看) / copy(复制) / share(分享) / delete(删除)。
 * gcContentId 关联 aiGcContent.id，删除内容时级联删除任务记录。
 */
export const aiGcTask = pgTable(
  'ai_gc_task',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gcContentId: uuid('gc_content_id')
      .references(() => aiGcContent.id, { onDelete: 'cascade' })
      .notNull(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    gcContentIdx: index('ix_ai_gc_task_gc_content').on(t.gcContentId),
    userUuidIdx: index('ix_ai_gc_task_user_uuid').on(t.userUuid),
  }),
)

export type AiGcContent = typeof aiGcContent.$inferSelect
export type NewAiGcContent = typeof aiGcContent.$inferInsert
export type AiGcTask = typeof aiGcTask.$inferSelect
export type NewAiGcTask = typeof aiGcTask.$inferInsert
