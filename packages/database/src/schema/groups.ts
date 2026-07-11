import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户组表。
 * type: 组类型（业务定义，如 'team' / 'class' / 'custom'）。
 * status: 'active'(启用) / 'disabled'(已禁用)。
 * member_count: 成员数（冗余字段，由业务维护）。
 */
export const userGroups = pgTable(
  'user_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 32 }).default('custom').notNull(),
    description: text('description'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    memberCount: integer('member_count').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('user_groups_owner_idx').on(t.ownerId),
    typeIdx: index('user_groups_type_idx').on(t.type),
  }),
)

/**
 * 用户组成员关联表。
 * (group_id, user_id) 联合唯一：同一用户在同一组仅一条记录。
 * role: 成员角色（如 'admin' / 'member'）。
 */
export const userGroupMembers = pgTable(
  'user_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .references(() => userGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 32 }).default('member').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupUserUnique: unique('user_group_members_group_user_unique').on(t.groupId, t.userId),
    groupIdx: index('user_group_members_group_idx').on(t.groupId),
    userIdx: index('user_group_members_user_idx').on(t.userId),
  }),
)

export type UserGroup = typeof userGroups.$inferSelect
export type NewUserGroup = typeof userGroups.$inferInsert
export type UserGroupMember = typeof userGroupMembers.$inferSelect
export type NewUserGroupMember = typeof userGroupMembers.$inferInsert
