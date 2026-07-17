import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户笔记表(独立于 edu_notes 课程笔记,支持与课程无关的个人笔记)。
 */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    lessonId: varchar('lesson_id', { length: 100 }),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('notes_user_idx').on(t.userId),
    lessonIdx: index('notes_lesson_idx').on(t.lessonId),
  }),
)

export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
