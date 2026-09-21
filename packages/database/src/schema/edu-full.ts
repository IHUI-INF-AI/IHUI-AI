// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Edu 教育域完整 schema（等价自旧架构 edu_platform_models / edu_platform_models_ext）。
 * 涵盖：认证 / 设置 / 内容 / 会员 / 课程 / 考试 / 资源 / 圈子 / 评论 / 问答 / 直播 / 通知 / 访问统计 等模块。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  real,
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 认证模块
// ---------------------------------------------------------------------------

/** 角色表 */

/** 权限表 */

/** 角色权限关联表 */

// ---------------------------------------------------------------------------
// 设置模块
// ---------------------------------------------------------------------------

/** 轮播图表 */

/** 协议表 */

// ---------------------------------------------------------------------------
// 内容模块
// ---------------------------------------------------------------------------

/** 文章表 */

/** 资讯表 */

/** 分类表 */

// ---------------------------------------------------------------------------
// 用户模块
// ---------------------------------------------------------------------------

/** 用户表 */
export const eduUser = pgTable('edu_user', {
  id: serial('id').primaryKey(),
  mobile: varchar('mobile', { length: 20 }),
  name: varchar('name', { length: 100 }),
  password: varchar('password', { length: 200 }),
  companyId: integer('company_id'),
  departmentId: integer('department_id'),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 支付模块
// ---------------------------------------------------------------------------

/** 交易表 */

// ---------------------------------------------------------------------------
// 学习模块
// ---------------------------------------------------------------------------

/** 课程分类表 */

/** 学习地图表 */

/** 课程作业表 */

/** 学习记录表 */
export const eduLessonStudyRecord = pgTable(
  'edu_lesson_study_record',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    lessonId: integer('lesson_id').notNull(),
    sectionId: integer('section_id'),
    studyDuration: integer('study_duration').default(0).notNull(),
    progress: real('progress').default(0).notNull(),
    lastPosition: integer('last_position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_lesson_study_record_member_idx').on(t.memberId),
    lessonIdx: index('edu_lesson_study_record_lesson_idx').on(t.lessonId),
  }),
)

/** 课程专题表 */
export const eduLessonTopic = pgTable('edu_lesson_topic', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  coverImage: varchar('cover_image', { length: 500 }),
  description: text('description'),
  lessonIds: text('lesson_ids'),
  isPublished: boolean('is_published').default(false).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 报名记录表 */
export const eduSignUp = pgTable(
  'edu_sign_up',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    targetId: integer('target_id').notNull(),
    targetType: varchar('target_type', { length: 50 }).default('lesson').notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_sign_up_member_idx').on(t.memberId) }),
)

// ---------------------------------------------------------------------------
// 考试模块
// ---------------------------------------------------------------------------

/** 考试分类表 */

/** 考试表 */
export const eduExam = pgTable(
  'edu_exam',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: integer('category_id'),
    description: text('description'),
    totalScore: real('total_score').default(100).notNull(),
    passScore: real('pass_score').default(60).notNull(),
    duration: integer('duration').default(60).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_exam_category_idx').on(t.categoryId) }),
)

/** 考试章节表 */

/** 考试小节表 */

/** 题库题目表 */

/** 试卷表 */

/** 试卷规则表 */

/** 试卷题目关联表 */

/** 考试记录表 */

// ---------------------------------------------------------------------------
// 资源模块
// ---------------------------------------------------------------------------

/** 资源分类表 */

/** 资源表 */

/** 资源产品表 */

// ---------------------------------------------------------------------------
// 圈子模块
// ---------------------------------------------------------------------------

/** 圈子分类表 */

/** 圈子表 */

/** 圈子动态表 */

// ---------------------------------------------------------------------------
// 评论 / 收藏 / 点赞模块
// ---------------------------------------------------------------------------

/** 评论表 */

/** 收藏表 */

/** 点赞表 */

// ---------------------------------------------------------------------------
// 问答模块
// ---------------------------------------------------------------------------

/** 问答分类表 */

/** 问答-问题表 */

/** 问答-回答表 */

// ---------------------------------------------------------------------------
// 直播模块 (edu 域内)
// ---------------------------------------------------------------------------

/** 直播分类表（edu 域） */
export const eduLiveCategory = pgTable('edu_live_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 直播频道表（edu 域） */
export const eduLiveChannel = pgTable(
  'edu_live_channel',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    intro: text('intro'),
    categoryId: integer('category_id'),
    lecturerId: integer('lecturer_id'),
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('edu_live_channel_category_idx').on(t.categoryId),
    liveIdx: index('edu_live_channel_live_idx').on(t.isLive),
  }),
)

// ---------------------------------------------------------------------------
// 首页配置模块
// ---------------------------------------------------------------------------

/** 首页配置表 */

/** 首页分类导航表 */

// ---------------------------------------------------------------------------
// 通知模块
// ---------------------------------------------------------------------------

/** 通知表 */
export const eduNotification = pgTable(
  'edu_notification',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    senderId: integer('sender_id'),
    title: varchar('title', { length: 200 }),
    content: text('content'),
    notifType: varchar('notif_type', { length: 50 }).default('system').notNull(),
    channel: varchar('channel', { length: 50 }).default('letter').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    refId: integer('ref_id'),
    refType: varchar('ref_type', { length: 50 }),
    readTime: timestamp('read_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_notification_member_idx').on(t.memberId) }),
)

/** 通知设备表 */
export const eduNotificationDevice = pgTable('edu_notification_device', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  deviceType: varchar('device_type', { length: 50 }),
  deviceToken: varchar('device_token', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 访问统计模块
// ---------------------------------------------------------------------------

/** 访问日志表 */

/** 浏览记录表 */

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type EduUser = typeof eduUser.$inferSelect
export type NewEduUser = typeof eduUser.$inferInsert
export type EduLessonStudyRecord = typeof eduLessonStudyRecord.$inferSelect
export type NewEduLessonStudyRecord = typeof eduLessonStudyRecord.$inferInsert
export type EduLessonTopicFull = typeof eduLessonTopic.$inferSelect
export type NewEduLessonTopicFull = typeof eduLessonTopic.$inferInsert
export type EduSignUp = typeof eduSignUp.$inferSelect
export type NewEduSignUp = typeof eduSignUp.$inferInsert
export type EduExam = typeof eduExam.$inferSelect
export type NewEduExam = typeof eduExam.$inferInsert
export type EduLiveCategory = typeof eduLiveCategory.$inferSelect
export type NewEduLiveCategory = typeof eduLiveCategory.$inferInsert
export type EduLiveChannel = typeof eduLiveChannel.$inferSelect
export type NewEduLiveChannel = typeof eduLiveChannel.$inferInsert
export type EduNotification = typeof eduNotification.$inferSelect
export type NewEduNotification = typeof eduNotification.$inferInsert
export type EduNotificationDevice = typeof eduNotificationDevice.$inferSelect
export type NewEduNotificationDevice = typeof eduNotificationDevice.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
