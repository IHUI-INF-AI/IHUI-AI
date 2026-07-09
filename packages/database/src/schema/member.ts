import { pgTable, uuid, varchar, integer, timestamp, numeric, index } from 'drizzle-orm/pg-core';

/**
 * 会员等级表。
 * - growthValue: 升级所需成长值；discount: 折扣(1.00=原价)。
 */
export const eduMemberLevels = pgTable(
  'edu_member_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    growthValue: integer('growth_value').default(0).notNull(),
    discount: numeric('discount', { precision: 5, scale: 2 }).default('1.00').notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ sortIdx: index('edu_member_levels_sort_idx').on(t.sort) }),
);

/**
 * 企业表（教育会员体系）。
 */
export const eduCompanies = pgTable(
  'edu_companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    contactName: varchar('contact_name', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 30 }),
    address: varchar('address', { length: 500 }),
    remark: varchar('remark', { length: 500 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ sortIdx: index('edu_companies_sort_idx').on(t.sort) }),
);

/**
 * 部门表（教育会员体系，隶属企业）。
 */
export const eduDepartments = pgTable(
  'edu_departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').notNull().references(() => eduCompanies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    pid: uuid('pid'), // 父部门(树形结构)
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    companyIdx: index('edu_departments_company_idx').on(t.companyId),
    pidIdx: index('edu_departments_pid_idx').on(t.pid),
  }),
);

/**
 * 会员表（教育会员体系）。
 * - password: sha256 哈希（兼容旧 Java 项目数据）。
 * - status: 0=待审核 1=正常 2=封禁。
 * - companyId/departmentId: 企业/部门（外键约束）。
 */
export const eduMembers = pgTable(
  'edu_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 100 }),
    mobile: varchar('mobile', { length: 30 }),
    email: varchar('email', { length: 200 }),
    password: varchar('password', { length: 128 }).notNull().default(''),
    avatar: varchar('avatar', { length: 500 }),
    nickname: varchar('nickname', { length: 100 }),
    gender: integer('gender').default(0).notNull(), // 0=未知 1=男 2=女
    status: integer('status').default(0).notNull(),
    levelId: uuid('level_id').references(() => eduMemberLevels.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => eduCompanies.id, { onDelete: 'set null' }),
    departmentId: uuid('department_id').references(() => eduDepartments.id, { onDelete: 'set null' }),
    growthValue: integer('growth_value').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    usernameIdx: index('edu_members_username_idx').on(t.username),
    mobileIdx: index('edu_members_mobile_idx').on(t.mobile),
    levelIdx: index('edu_members_level_idx').on(t.levelId),
  }),
);

export type EduMember = typeof eduMembers.$inferSelect;
export type NewEduMember = typeof eduMembers.$inferInsert;
export type EduMemberLevel = typeof eduMemberLevels.$inferSelect;
export type NewEduMemberLevel = typeof eduMemberLevels.$inferInsert;
export type EduCompany = typeof eduCompanies.$inferSelect;
export type NewEduCompany = typeof eduCompanies.$inferInsert;
export type EduDepartment = typeof eduDepartments.$inferSelect;
export type NewEduDepartment = typeof eduDepartments.$inferInsert;
