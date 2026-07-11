import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

// 私信会话表
// 注意：该表当前无 API 引用，保留以备未来需求
export const privateLetterSessions = pgTable(
  'private_letter_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userAId: uuid('user_a_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    userBId: uuid('user_b_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    lastMessageId: uuid('last_message_id'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    unreadCountA: integer('unread_count_a').default(0).notNull(),
    unreadCountB: integer('unread_count_b').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userAIdx: index('private_letter_sessions_user_a_idx').on(t.userAId),
    userBIdx: index('private_letter_sessions_user_b_idx').on(t.userBId),
  }),
)

// 私信消息表
// 注意：该表当前无 API 引用，保留以备未来需求
export const privateLetterMessages = pgTable(
  'private_letter_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => privateLetterSessions.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    messageType: varchar('message_type', { length: 32 }).default('text').notNull(), // text/image/file/system
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index('private_letter_messages_session_idx').on(t.sessionId),
    senderIdx: index('private_letter_messages_sender_idx').on(t.senderId),
  }),
)

export type PrivateLetterSession = typeof privateLetterSessions.$inferSelect
export type NewPrivateLetterSession = typeof privateLetterSessions.$inferInsert
export type PrivateLetterMessage = typeof privateLetterMessages.$inferSelect
export type NewPrivateLetterMessage = typeof privateLetterMessages.$inferInsert
