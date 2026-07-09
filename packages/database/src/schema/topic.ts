import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 课程专题表。
 * - lessonIds: 关联课程 id 数组（jsonb），顺序即为专题内排序。
 * - isPublished: 是否发布。
 * - status: 1=启用 0=禁用。
 */
export const eduLessonTopics = pgTable(
  'edu_lesson_topics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 512 }),
    description: text('description'),
    lessonIds: jsonb('lesson_ids').$type<string[]>(),
    isPublished: boolean('is_published').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pubIdx: index('edu_lesson_topics_published_idx').on(t.isPublished),
    statusIdx: index('edu_lesson_topics_status_idx').on(t.status),
  }),
);

export type EduLessonTopic = typeof eduLessonTopics.$inferSelect;
export type NewEduLessonTopic = typeof eduLessonTopics.$inferInsert;
