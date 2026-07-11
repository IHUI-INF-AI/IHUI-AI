import { pgTable, uuid, varchar, integer, timestamp, serial, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 部门表 - 树形结构(pid 指向父部门)。
 * company_id: 所属公司(扩展用)。
 */
export const departments = pgTable(
  'departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid'), // 父部门(树形结构)
    companyId: integer('company_id'),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('departments_pid_idx').on(t.pid),
  }),
)

/**
 * 用户中心扩展信息 - 关联 users 表，存储 edu_platform 特有字段。
 * departmentId: 所属部门；employeeNo: 工号；position: 职位。
 */
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
    companyId: integer('company_id'),
    employeeNo: varchar('employee_no', { length: 64 }),
    position: varchar('position', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deptIdx: index('user_profiles_dept_idx').on(t.departmentId),
  }),
)

/**
 * 用户证书表。
 * status: 1=有效 0=失效。
 */
export const userCertificates = pgTable(
  'user_certificates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    certificateNo: varchar('certificate_no', { length: 100 }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    expireAt: timestamp('expire_at', { withTimezone: true }),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_certificates_user_idx').on(t.userId),
  }),
)

export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type UserCertificate = typeof userCertificates.$inferSelect
export type NewUserCertificate = typeof userCertificates.$inferInsert

/**
 * 用户岗位关联表 - 用户与岗位的多对多关联。
 */
export const userJobs = pgTable('user_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  jobId: integer('job_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type UserJob = typeof userJobs.$inferSelect
export type NewUserJob = typeof userJobs.$inferInsert
