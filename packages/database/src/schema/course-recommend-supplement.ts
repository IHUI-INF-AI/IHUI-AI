/**
 * D3 edu Java 课程推荐 2 表补迁移 schema(supplement)。
 *
 * 2 张表(本文件新增,G 盘此前缺失课程推荐相关表):
 *   1. t_course_recommend       课程推荐(course_id + member_id + reason)
 *   2. t_course_recommend_log   推荐日志(recommend_id + action)
 *
 * 注:newsRecommends / tourRecommendations 分别是新闻推荐 / 旅游推荐,与课程推荐语义不同。
 * course_id 为 bigint(D3 edu Java 课程 id),不与 lessons.id(uuid)建立外键,
 * 因为 D3 edu Java 课程主键为 bigint;若需关联现代 lessons 表,通过应用层映射。
 *
 * 主键用 bigserial(与 D3 edu Java bigint AUTO_INCREMENT 对齐)。
 */
import { pgTable, bigserial, varchar, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 课程推荐表(D3 edu Java: t_course_recommend)
 */
export const tCourseRecommend = pgTable(
  't_course_recommend',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    courseId: bigserial('course_id', { mode: 'number' }).notNull(),
    memberId: bigserial('member_id', { mode: 'number' }).notNull(),
    reason: varchar('reason', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    courseIdx: index('t_course_recommend_course_idx').on(t.courseId),
    memberIdx: index('t_course_recommend_member_idx').on(t.memberId),
  }),
)

/**
 * 推荐日志表(D3 edu Java: t_course_recommend_log)
 * recommend_id → t_course_recommend.id(同文件 bigserial 外键)
 * action: click / view / enroll / dismiss 等
 */
export const tCourseRecommendLog = pgTable(
  't_course_recommend_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    recommendId: bigserial('recommend_id', { mode: 'number' }).references(() => tCourseRecommend.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    recommendIdx: index('t_course_recommend_log_recommend_idx').on(t.recommendId),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TCourseRecommend = typeof tCourseRecommend.$inferSelect
export type NewTCourseRecommend = typeof tCourseRecommend.$inferInsert
export type TCourseRecommendLog = typeof tCourseRecommendLog.$inferSelect
export type NewTCourseRecommendLog = typeof tCourseRecommendLog.$inferInsert
