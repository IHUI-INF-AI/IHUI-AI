/**
 * D 盘作业/签到表补迁移 schema（supplement）。
 * 迁移自 D:\历史项目存档\code\edu\service\service\init_database.sql
 *
 * 6 张表清单：
 *   1. learn_homework         → 已迁移至 learn-extended.ts（learnHomework，UUID 版）
 *   2. learn_homework_record  → 已迁移至 learn-extra-extended.ts（learnHomeworkRecord，UUID 版）
 *   3. learn_sign_up          → 已迁移至 relation-tables.ts（learnSignUp，serial 版）
 *   4. exam_sign_up           → 已迁移至 relation-tables.ts（examSignUp，serial 版）
 *   5. t_homework             → 本文件新增（通用作业备份/旧版）
 *   6. t_check_in_record      → 本文件新增
 *
 * 上述 4 张已迁移表与 D 盘字段语义一致（D 盘 bigint vs 现代版 serial/UUID），
 * 不在本文件重复定义以避免 TypeScript export 冲突与 PostgreSQL 表名冲突。
 */
import { pgTable, bigserial, bigint, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 通用作业 / 签到
// ---------------------------------------------------------------------------

/**
 * 通用作业表（D 盘: t_homework）
 * 字段与 learn_homework 等价，作为通用作业备份/旧版。
 */
export const tHomework = pgTable(
  't_homework',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    lessonId: bigint('lesson_id', { mode: 'number' }).notNull(), // D 盘: lesson_id bigint
    url: varchar('url', { length: 3000 }).default('').notNull(), // D 盘: url varchar(3000) DEFAULT ''
    content: text('content').notNull(), // D 盘: content text
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    lessonIdx: index('t_homework_lesson_idx').on(t.lessonId),
  }),
)

/**
 * 会员签到记录表（D 盘: t_check_in_record）
 * type: 签到类型（如 daily / activity 等）。
 */
export const tCheckInRecord = pgTable(
  't_check_in_record',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    memberId: bigint('member_id', { mode: 'number' }).notNull(), // D 盘: member_id bigint
    type: varchar('type', { length: 20 }).notNull(), // D 盘: type varchar(20)
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    memberIdx: index('t_check_in_record_member_idx').on(t.memberId),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type THomework = typeof tHomework.$inferSelect
export type NewTHomework = typeof tHomework.$inferInsert
export type TCheckInRecord = typeof tCheckInRecord.$inferSelect
export type NewTCheckInRecord = typeof tCheckInRecord.$inferInsert
