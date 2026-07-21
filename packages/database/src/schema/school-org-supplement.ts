/**
 * D3 edu Java 学校组织架构 4 表补迁移 schema(supplement)。
 * 迁移自 D:\历史项目存档\code\edu edu Java 微服务 entity。
 *
 * 4 张表清单(本文件新增,G 盘此前缺失学校/班级/年级/学科主表):
 *   1. t_school        学校
 *   2. t_clazz         班级(school_id + grade_id 双外键)
 *   3. t_grade         年级
 *   4. t_subject       学科
 *
 * 注:edu-extended.ts 的 eduClassesSchedules / eduClassesMembers 是班级排期/成员,
 * classId 为 varchar 无主表;本文件补齐 t_clazz 主表后,可与该二表通过 classId 关联。
 *
 * 主键用 bigserial(与 D3 edu Java bigint AUTO_INCREMENT 对齐)。
 */
import { pgTable, bigserial, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 学校表(D3 edu Java: t_school)
 */
export const tSchool = pgTable(
  't_school',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    logo: varchar('logo', { length: 512 }),
    address: varchar('address', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

/**
 * 年级表(D3 edu Java: t_grade)
 */
export const tGrade = pgTable(
  't_grade',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

/**
 * 学科表(D3 edu Java: t_subject)
 */
export const tSubject = pgTable(
  't_subject',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
)

/**
 * 班级表(D3 edu Java: t_clazz)
 * school_id → t_school.id,grade_id → t_grade.id(同文件 bigserial 外键)
 */
export const tClazz = pgTable(
  't_clazz',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    schoolId: bigserial('school_id', { mode: 'number' }).references(() => tSchool.id, { onDelete: 'cascade' }),
    gradeId: bigserial('grade_id', { mode: 'number' }).references(() => tGrade.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    schoolIdx: index('t_clazz_school_idx').on(t.schoolId),
    gradeIdx: index('t_clazz_grade_idx').on(t.gradeId),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type TSchool = typeof tSchool.$inferSelect
export type NewTSchool = typeof tSchool.$inferInsert
export type TGrade = typeof tGrade.$inferSelect
export type NewTGrade = typeof tGrade.$inferInsert
export type TSubject = typeof tSubject.$inferSelect
export type NewTSubject = typeof tSubject.$inferInsert
export type TClazz = typeof tClazz.$inferSelect
export type NewTClazz = typeof tClazz.$inferInsert
