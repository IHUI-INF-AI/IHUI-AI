import { pgTable, uuid, varchar, text, integer, timestamp, serial } from 'drizzle-orm/pg-core'

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
})

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
})

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
})

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
})

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
})

export type MemberGroup = typeof memberGroups.$inferSelect
export type NewMemberGroup = typeof memberGroups.$inferInsert
export type MemberPost = typeof memberPosts.$inferSelect
export type NewMemberPost = typeof memberPosts.$inferInsert
export type MemberTag = typeof memberTags.$inferSelect
export type NewMemberTag = typeof memberTags.$inferInsert
export type MemberType = typeof memberTypes.$inferSelect
export type NewMemberType = typeof memberTypes.$inferInsert
export type CompanyType = typeof companyTypes.$inferSelect
export type NewCompanyType = typeof companyTypes.$inferInsert

/**
 * 企业会员关联表 - 会员与企业的关联关系。
 * - memberId: 关联 edu_members；companyId: 关联 edu_companies（逻辑关联，未做物理外键）。
 */
export const eduMemberCompanyRelations = pgTable('edu_member_company_relations', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  companyId: integer('company_id').notNull(),
  position: varchar('position', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 会员等级关联表 - 会员与等级的关联及有效期。
 * - memberId: 关联 edu_members；levelId: 关联 edu_member_levels（逻辑关联，未做物理外键）。
 */
export const eduMemberLevelRelations = pgTable('edu_member_level_relations', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  levelId: integer('level_id').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 会员岗位关联表 - 会员与岗位的多对多关联。
 * - memberId: 关联 edu_members；postId: 关联 member_posts（逻辑关联，未做物理外键）。
 */
export const eduMemberPostRelations = pgTable('edu_member_post_relations', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  postId: integer('post_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 会员标签关联表 - 会员与标签的多对多关联。
 * - memberId: 关联 edu_members；tagId: 关联 member_tags（逻辑关联，未做物理外键）。
 */
export const eduMemberTagRelations = pgTable('edu_member_tag_relations', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  tagId: integer('tag_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 资源产品关联表 - 资源与产品的多对多关联。
 * - resourceId: 关联 resources；productId: 关联 resource_products（逻辑关联，未做物理外键）。
 */
export const eduResourceProductRelations = pgTable('edu_resource_product_relations', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id').notNull(),
  productId: integer('product_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EduMemberCompanyRelation = typeof eduMemberCompanyRelations.$inferSelect
export type NewEduMemberCompanyRelation = typeof eduMemberCompanyRelations.$inferInsert
export type EduMemberLevelRelation = typeof eduMemberLevelRelations.$inferSelect
export type NewEduMemberLevelRelation = typeof eduMemberLevelRelations.$inferInsert
export type EduMemberPostRelation = typeof eduMemberPostRelations.$inferSelect
export type NewEduMemberPostRelation = typeof eduMemberPostRelations.$inferInsert
export type EduMemberTagRelation = typeof eduMemberTagRelations.$inferSelect
export type NewEduMemberTagRelation = typeof eduMemberTagRelations.$inferInsert
export type EduResourceProductRelation = typeof eduResourceProductRelations.$inferSelect
export type NewEduResourceProductRelation = typeof eduResourceProductRelations.$inferInsert
