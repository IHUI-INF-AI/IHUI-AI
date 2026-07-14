// 注意：该文件包含 learn_topic 等历史表，已由 /api/admin/learn/premium-topics 路由引用
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  bigint,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 学习记录表 (历史 learn_record)。
 * memberId/lessonId/lessonChapterSectionId/signUpId 在旧库为 BigInteger,
 * 新架构统一为 uuid (外部约定,非 DB 外键)。
 * learnTime: 学习时长(秒)。maxProgressTime: 最大学习进度时间。
 * status: progressing/completed。
 */
export const learnRecord = pgTable(
  'learn_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: uuid('member_id').notNull(),
    lessonId: uuid('lesson_id').notNull(),
    lessonChapterSectionId: uuid('lesson_chapter_section_id').notNull(),
    signUpId: uuid('sign_up_id').notNull(),
    learnTime: bigint('learn_time', { mode: 'number' }).default(0).notNull(),
    maxProgressTime: bigint('max_progress_time', { mode: 'number' }).default(0).notNull(),
    status: varchar('status', { length: 200 }).default('progressing').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('learn_record_member_idx').on(t.memberId),
    lessonIdx: index('learn_record_lesson_idx').on(t.lessonId),
    signupIdx: index('learn_record_signup_idx').on(t.signUpId),
  }),
)

/**
 * 学习记录日志表 (历史 learn_record_log)。
 */
export const learnRecordLog = pgTable(
  'learn_record_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: uuid('member_id').notNull(),
    lessonId: uuid('lesson_id').notNull(),
    lessonChapterSectionId: uuid('lesson_chapter_section_id').notNull(),
    signUpId: uuid('sign_up_id').notNull(),
    learnTime: bigint('learn_time', { mode: 'number' }).default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('learn_record_log_member_idx').on(t.memberId),
    lessonIdx: index('learn_record_log_lesson_idx').on(t.lessonId),
  }),
)

/**
 * 专题表 (历史 learn_topic)。
 * status: draft/published。
 * price/originalPrice: 专题价格与原价。
 */
export const learnTopic = pgTable(
  'learn_topic',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 100 }).notNull(),
    image: varchar('image', { length: 1000 }).notNull(),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    description: text('description').default('').notNull(),
    companyId: bigint('company_id', { mode: 'number' }),
    departmentId: bigint('department_id', { mode: 'number' }),
    createUserId: bigint('create_user_id', { mode: 'number' }),
    price: numeric('price', { precision: 14, scale: 2 }).default('0'),
    originalPrice: numeric('original_price', { precision: 14, scale: 2 }).default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('learn_topic_status_idx').on(t.status),
  }),
)

/**
 * 专题分类表 (历史 learn_topic_category)。
 * level: 目录等级。isShow/isShowIndex: 显示控制。
 */
export const learnTopicCategory = pgTable('learn_topic_category', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  sortOrder: integer('sort_order').default(1).notNull(),
  isShow: boolean('is_show').default(true).notNull(),
  isShowIndex: boolean('is_show_index').default(true).notNull(),
  level: integer('level').notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  companyId: bigint('company_id', { mode: 'number' }).default(0).notNull(),
  departmentId: bigint('department_id', { mode: 'number' }).default(0).notNull(),
  createUserId: bigint('create_user_id', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 专题分类关系表 (历史 learn_topic_category_relation)。
 * childCategoryId/fatherCategoryId/directFatherCategoryId 构成分类树。
 * isSub: 是否属于子类目。
 */
export const learnTopicCategoryRelation = pgTable('learn_topic_category_relation', {
  id: uuid('id').defaultRandom().primaryKey(),
  childCategoryId: uuid('child_category_id').notNull(),
  fatherCategoryId: uuid('father_category_id').notNull(),
  directFatherCategoryId: uuid('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 专题与课程关系表 (历史 learn_topic_lesson)。
 */
export const learnTopicLesson = pgTable(
  'learn_topic_lesson',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull(),
    topicId: uuid('topic_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index('learn_topic_lesson_topic_idx').on(t.topicId),
    lessonIdx: index('learn_topic_lesson_lesson_idx').on(t.lessonId),
  }),
)

/**
 * 专题与分类关系表 (历史 learn_topic_topic_category_relation)。
 */
export const learnTopicTopicCategoryRelation = pgTable(
  'learn_topic_topic_category_relation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').notNull(),
    topicId: uuid('topic_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('learn_topic_topic_category_relation_category_idx').on(t.categoryId),
    topicIdx: index('learn_topic_topic_category_relation_topic_idx').on(t.topicId),
  }),
)

/**
 * 学习地图与专题关系表 (历史 learn_learn_map_topic)。
 */
export const learnLearnMapTopic = pgTable(
  'learn_learn_map_topic',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    learnMapId: uuid('learn_map_id').notNull(),
    topicId: uuid('topic_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    mapIdx: index('learn_learn_map_topic_map_idx').on(t.learnMapId),
    topicIdx: index('learn_learn_map_topic_topic_idx').on(t.topicId),
  }),
)

/**
 * 作业提交记录表 (历史 learn_homework_record)。
 * url: 作业提交内容的地址。status: pending/approved/rejected。
 */
export const learnHomeworkRecord = pgTable(
  'learn_homework_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    memberId: uuid('member_id').notNull(),
    lessonId: uuid('lesson_id').notNull(),
    url: varchar('url', { length: 3000 }).notNull(),
    status: varchar('status', { length: 200 }).default('pending').notNull(),
    signUpId: uuid('sign_up_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('learn_homework_record_member_idx').on(t.memberId),
    lessonIdx: index('learn_homework_record_lesson_idx').on(t.lessonId),
    signupIdx: index('learn_homework_record_signup_idx').on(t.signUpId),
  }),
)

export type LearnRecord = typeof learnRecord.$inferSelect
export type NewLearnRecord = typeof learnRecord.$inferInsert
export type LearnRecordLog = typeof learnRecordLog.$inferSelect
export type NewLearnRecordLog = typeof learnRecordLog.$inferInsert
export type LearnTopic = typeof learnTopic.$inferSelect
export type NewLearnTopic = typeof learnTopic.$inferInsert
export type LearnTopicCategory = typeof learnTopicCategory.$inferSelect
export type NewLearnTopicCategory = typeof learnTopicCategory.$inferInsert
export type LearnTopicCategoryRelation = typeof learnTopicCategoryRelation.$inferSelect
export type NewLearnTopicCategoryRelation = typeof learnTopicCategoryRelation.$inferInsert
export type LearnTopicLesson = typeof learnTopicLesson.$inferSelect
export type NewLearnTopicLesson = typeof learnTopicLesson.$inferInsert
export type LearnTopicTopicCategoryRelation = typeof learnTopicTopicCategoryRelation.$inferSelect
export type NewLearnTopicTopicCategoryRelation = typeof learnTopicTopicCategoryRelation.$inferInsert
export type LearnLearnMapTopic = typeof learnLearnMapTopic.$inferSelect
export type NewLearnLearnMapTopic = typeof learnLearnMapTopic.$inferInsert
export type LearnHomeworkRecord = typeof learnHomeworkRecord.$inferSelect
export type NewLearnHomeworkRecord = typeof learnHomeworkRecord.$inferInsert

/**
 * 课程讨论帖表 (社区/学习圈讨论)。
 * userId: 发帖人。lessonId: 关联课程(可空,空为综合区)。
 * title/content: 标题/正文。isPinned: 置顶。status: published/draft/hidden。
 * replyCount/viewCount: 回复数/浏览数(冗余计数,异步更新)。
 */
export const learnCommunityPost = pgTable(
  'learn_community_post',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    lessonId: uuid('lesson_id'),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    isPinned: boolean('is_pinned').default(false).notNull(),
    status: varchar('status', { length: 20 }).default('published').notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('learn_community_post_user_idx').on(t.userId),
    lessonIdx: index('learn_community_post_lesson_idx').on(t.lessonId),
    statusIdx: index('learn_community_post_status_idx').on(t.status),
  }),
)

export type LearnCommunityPost = typeof learnCommunityPost.$inferSelect
export type NewLearnCommunityPost = typeof learnCommunityPost.$inferInsert

export const lessonTask = pgTable(
  'lesson_task',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull(),
    lessonChapterId: uuid('lesson_chapter_id'),
    lessonChapterSectionId: uuid('lesson_chapter_section_id'),
    title: varchar('title', { length: 200 }).notNull(),
    contentType: varchar('content_type', { length: 50 }),
    conditions: text('conditions'),
    status: varchar('status', { length: 20 }).default('enable').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('lesson_task_lesson_idx').on(t.lessonId),
    chapterIdx: index('lesson_task_chapter_idx').on(t.lessonChapterId),
  }),
)

export const lessonRate = pgTable(
  'lesson_rate',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull(),
    userId: uuid('user_id').notNull(),
    signId: uuid('sign_id'),
    content: text('content'),
    contentUtilityScore: integer('content_utility_score'),
    teacherScore: integer('teacher_score'),
    serviceScore: integer('service_score'),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    status: varchar('status', { length: 20 }).default('published').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('lesson_rate_lesson_idx').on(t.lessonId),
    userIdx: index('lesson_rate_user_idx').on(t.userId),
  }),
)

export const lessonAccess = pgTable(
  'lesson_access',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lessonId: uuid('lesson_id').notNull(),
    accessType: varchar('access_type', { length: 20 }).default('all').notNull(),
    accessValues: text('access_values').default('[]').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    lessonIdx: index('lesson_access_lesson_idx').on(t.lessonId),
  }),
)

export type LessonTask = typeof lessonTask.$inferSelect
export type NewLessonTask = typeof lessonTask.$inferInsert
export type LessonRate = typeof lessonRate.$inferSelect
export type NewLessonRate = typeof lessonRate.$inferInsert
export type LessonAccess = typeof lessonAccess.$inferSelect
export type NewLessonAccess = typeof lessonAccess.$inferInsert
