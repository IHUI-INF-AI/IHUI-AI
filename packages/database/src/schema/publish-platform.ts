import {
  pgTable,
  bigserial,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from 'drizzle-orm/pg-core'

/**
 * 多平台一键发布系统(2026-07-20 新增)。
 *
 * 4 张表(与 ai-service app/services/publish/* 代码字段名严格对齐):
 *   - publish_accounts:       平台账号(凭证 AES-256-GCM 加密存储)
 *   - publish_tasks:          发布任务(BIGSERIAL + task_id 业务主键)
 *   - publish_history:        发布历史(每个平台一条记录)
 *   - publish_notifications:  发布完成通知(DB 持久化 + Socket.IO 推送双通道)
 *
 * 14 平台清单:
 *   文章 7: wordpress / medium / wechat / toutiao / zhihu / csdn / juejin
 *   图片 2: xiaohongshu / weibo
 *   视频 5: youtube / bilibili / douyin / kuaishou / shipinhao
 *
 * 注意:
 * - 使用 bigserial 主键(对齐 ai-service asyncpg 代码,ai-service 不通过 ORM 操作)
 * - task_id 是业务主键(UUID 字符串,跨服务引用)
 * - api 转发层纯透传到 ai-service,不通过 ORM 操作这些表
 * - ai-service 启动时 _ensure_tables 会 idempotent 建表(CREATE IF NOT EXISTS),与 drizzle migration 共存
 */

/** 平台账号表:每个用户在每个平台可配置多个账号 */
export const publishAccounts = pgTable('publish_accounts', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  userId: varchar('user_id', { length: 64 }),
  platform: varchar('platform', { length: 32 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  /** 凭证 JSON 经 AES-256-GCM 加密后的密文(ai-service 代码用字段名 credentials_enc) */
  credentialsEnc: text('credentials_enc').notNull(),
  status: varchar('status', { length: 16 }).default('active').notNull(),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastVerifyResult: text('last_verify_result'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 发布任务表:一条任务 = 一个内容源 + N 个目标平台 */
export const publishTasks = pgTable('publish_tasks', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  /** 业务主键(UUID 字符串,跨服务引用,独立于 DB 主键) */
  taskId: varchar('task_id', { length: 64 }).notNull().unique(),
  userId: varchar('user_id', { length: 64 }),
  title: varchar('title', { length: 500 }).notNull(),
  /** 内容格式:md/docx/html/pdf/image/video */
  format: varchar('format', { length: 32 }).notNull(),
  /** 内容 JSONB: { text, file_path, cover_path, html, images, extra } */
  content: jsonb('content').notNull(),
  /** 目标平台数组 JSON: [{ platform, account_id, config }] */
  targets: jsonb('targets').notNull(),
  /** 任务状态:pending=待执行 / running=执行中 / scheduled=定时 / success=全部成功 / partial=部分成功 / failed=全部失败 / cancelled=已取消 */
  status: varchar('status', { length: 32 }).default('pending').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  /** 结果汇总 JSON: { success: N, failed: N, details: [...] } */
  results: jsonb('results'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 发布历史表:每个平台一条记录(关联 task) */
export const publishHistory = pgTable('publish_history', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  taskId: varchar('task_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  platform: varchar('platform', { length: 32 }).notNull(),
  /** 该平台发布是否成功(ai-service 用 boolean,而非 status 字符串) */
  success: boolean('success').notNull(),
  publishedUrl: text('published_url'),
  platformContentId: varchar('platform_content_id', { length: 255 }),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms').default(0),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 发布通知表:发布完成通知(DB 持久化 + Socket.IO 推送双通道) */
export const publishNotifications = pgTable('publish_notifications', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  taskId: varchar('task_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull(),
  summary: text('summary'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type PublishAccount = typeof publishAccounts.$inferSelect
export type NewPublishAccount = typeof publishAccounts.$inferInsert
export type PublishTask = typeof publishTasks.$inferSelect
export type NewPublishTask = typeof publishTasks.$inferInsert
export type PublishHistoryRecord = typeof publishHistory.$inferSelect
export type NewPublishHistoryRecord = typeof publishHistory.$inferInsert
export type PublishNotification = typeof publishNotifications.$inferSelect
export type NewPublishNotification = typeof publishNotifications.$inferInsert
