import { pgTable, uuid, varchar, timestamp, text, boolean, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * RBAC 角色表。
 * - scope: 数据作用域 'none'|'self'|'team'|'org'|'all'，默认 'self'。
 * - is_system: 系统内置角色（admin/user），不可删除、不可改 scope。
 *   与 users.roleId（legacy 数值角色）并存：RBAC 表用于细粒度权限点。
 */
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  description: text('description'),
  scope: varchar('scope', { length: 16 }).default('self').notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 权限点表。
 * - name: 唯一标识，约定 'resource:action'（如 'rbac:manage'）。
 * - resource/action: 拆分字段，便于按资源批量查询。
 */
export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  displayName: varchar('display_name', { length: 128 }).notNull(),
  resource: varchar('resource', { length: 64 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 角色-权限关联表。
 * (role_id, permission_id) 联合唯一。
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roleId: uuid('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    permissionId: uuid('permission_id')
      .references(() => permissions.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    rolePermissionUnique: unique().on(t.roleId, t.permissionId),
  }),
);

/**
 * 用户-角色关联表。
 * - scope_resource_id: 作用域资源 ID（如限定某 team），nullable 表示全局。
 * (user_id, role_id) 联合唯一。
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    roleId: uuid('role_id')
      .references(() => roles.id, { onDelete: 'cascade' })
      .notNull(),
    scopeResourceId: varchar('scope_resource_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userRoleUnique: unique().on(t.userId, t.roleId),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
