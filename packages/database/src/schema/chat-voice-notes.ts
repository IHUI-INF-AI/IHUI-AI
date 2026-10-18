// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

import { chatConversations } from './chat.js'
import { users } from './users.js'

/**
 * 会话内快捷笔记(D43/G-51 第②格,2026-10-18)。
 *
 * 为什么落库而不是继续留在 localStorage 单桶:票面验收写的是「新建→归档→按分组检索→命中,
 * 全链路走 @ihui/api-client」—— 浏览器本地桶既跨不了端(同一账号换设备就看不见),
 * 也让"归档/分组/搜索"只能在前端按整桶过滤;而按整桶过滤正是"检索命中与否取决于
 * 本地恰好存了多少条"的那种假检索。
 *
 * 为什么有 user_id 而不是只挂 conversation_id:会话可能被清、笔记要能跨会话长期留着,
 * 且入口授权只认身份 —— 归属由承载层从令牌主体写入,客户端不得自报(§5「认证不等于授权」)。
 *
 * 为什么 group_key 是字符串而不是外键表:分组由用户随手命名、无重名约束、无元数据,
 * 建表反而多一张需要级联维护的空壳;检索走 (user_id, group_key) 索引即可。
 */
export const chatVoiceNotes = pgTable(
  'chat_voice_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id').references(() => chatConversations.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 200 }).notNull(),
    /** 转写正文;仅存音频/转写未达为 null(不拿空串冒充"有内容") */
    transcript: text('transcript'),
    durationMs: integer('duration_ms').default(0).notNull(),
    audioUrl: varchar('audio_url', { length: 500 }),
    groupKey: varchar('group_key', { length: 64 }).default('inbox').notNull(),
    /** null = 在活跃列表里;有值 = 已归档并记下收走时刻(可撤销,不是删除的副产品) */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index('chat_voice_notes_user_created_idx').on(t.userId, t.createdAt),
    userGroupIdx: index('chat_voice_notes_user_group_idx').on(t.userId, t.groupKey),
    userArchivedIdx: index('chat_voice_notes_user_archived_idx').on(t.userId, t.archivedAt),
  }),
)

export type ChatVoiceNote = typeof chatVoiceNotes.$inferSelect
export type NewChatVoiceNote = typeof chatVoiceNotes.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
