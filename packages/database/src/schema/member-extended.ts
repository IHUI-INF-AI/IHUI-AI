import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * 会员分组表。
 * 用于将会员按业务分组管理。
 */
export const memberGroups = pgTable('member_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  sort: integer('sort').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 会员岗位表。
 * 记录会员在企业中的岗位信息。
 */
export const memberPosts = pgTable('member_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }),
  sort: integer('sort').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 会员标签表。
 * 用于给会员打标签,支持颜色标识。
 */
export const memberTags = pgTable('member_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }),
  sort: integer('sort').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 会员类型表。
 * 区分会员的类型(如个人/企业/VIP 等)。
 */
export const memberTypes = pgTable('member_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }),
  sort: integer('sort').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 企业类型表。
 * 区分企业的类型(如普通/战略/供应商等)。
 */
export const companyTypes = pgTable('company_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 50 }),
  sort: integer('sort').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MemberGroup = typeof memberGroups.$inferSelect;
export type NewMemberGroup = typeof memberGroups.$inferInsert;
export type MemberPost = typeof memberPosts.$inferSelect;
export type NewMemberPost = typeof memberPosts.$inferInsert;
export type MemberTag = typeof memberTags.$inferSelect;
export type NewMemberTag = typeof memberTags.$inferInsert;
export type MemberType = typeof memberTypes.$inferSelect;
export type NewMemberType = typeof memberTypes.$inferInsert;
export type CompanyType = typeof companyTypes.$inferSelect;
export type NewCompanyType = typeof companyTypes.$inferInsert;
