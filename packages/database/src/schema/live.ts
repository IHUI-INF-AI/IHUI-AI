import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * 直播分类表（树形结构，pid 自引用）。
 */
export const liveCategories = pgTable(
  'live_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid'), // 父分类
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ pidIdx: index('live_categories_pid_idx').on(t.pid) }),
);

/**
 * 讲师表。
 */
export const liveLecturers = pgTable(
  'live_lecturers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    avatar: varchar('avatar', { length: 500 }),
    title: varchar('title', { length: 200 }),
    intro: text('intro'),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ sortIdx: index('live_lecturers_sort_idx').on(t.sort) }),
);

/**
 * 直播频道表。
 * - categoryId/lecturerId 删除时置 NULL。
 * - isLive: 是否正在直播；isPublished: 是否发布。
 */
export const liveChannels = pgTable(
  'live_channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    intro: text('intro'),
    categoryId: uuid('category_id').references(() => liveCategories.id, { onDelete: 'set null' }),
    lecturerId: uuid('lecturer_id').references(() => liveLecturers.id, { onDelete: 'set null' }),
    lecturerName: varchar('lecturer_name', { length: 100 }),
    pushUrl: varchar('push_url', { length: 500 }),
    playUrl: varchar('play_url', { length: 500 }),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    isLive: boolean('is_live').default(false).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('live_channels_category_idx').on(t.categoryId),
    lectIdx: index('live_channels_lecturer_idx').on(t.lecturerId),
    liveIdx: index('live_channels_live_idx').on(t.isLive),
  }),
);

export type LiveCategory = typeof liveCategories.$inferSelect;
export type NewLiveCategory = typeof liveCategories.$inferInsert;
export type LiveLecturer = typeof liveLecturers.$inferSelect;
export type NewLiveLecturer = typeof liveLecturers.$inferInsert;
export type LiveChannel = typeof liveChannels.$inferSelect;
export type NewLiveChannel = typeof liveChannels.$inferInsert;
