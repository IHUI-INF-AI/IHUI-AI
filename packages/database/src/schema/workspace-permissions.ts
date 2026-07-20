import { pgTable, uuid, varchar, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 工作区访问权限配置 — 用户首次打开本地项目文件夹时弹出选择:
 *   - default            全部人工审计
 *   - accept-edits       白名单放行
 *   - bypass-permissions 完全访问
 *
 * 三表设计:
 *   workspace_permissions         每用户每工作区一条主配置
 *   workspace_permission_rules    白名单规则(default/accept-edits 共用)
 *   workspace_permission_audit_logs 操作审计日志
 */
export const workspacePermissions = pgTable(
  'workspace_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspacePath: text('workspace_path').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    techStack: text('tech_stack'),
    mode: varchar('mode', { length: 32 }).notNull().default('default'),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPathIdx: uniqueIndex('ux_workspace_permissions_user_path').on(t.userId, t.workspacePath),
    userIdx: index('ix_workspace_permissions_user').on(t.userId),
  }),
)

export const workspacePermissionRules = pgTable(
  'workspace_permission_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspacePath: text('workspace_path').notNull(),
    ruleType: varchar('rule_type', { length: 16 }).notNull(),
    pattern: text('pattern').notNull(),
    operation: varchar('operation', { length: 16 }),
    decision: varchar('decision', { length: 8 }).notNull(),
    builtin: boolean('builtin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPathIdx: index('ix_workspace_permission_rules_user_path').on(t.userId, t.workspacePath),
  }),
)

export const workspacePermissionAuditLogs = pgTable(
  'workspace_permission_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspacePath: text('workspace_path').notNull(),
    toolName: varchar('tool_name', { length: 64 }),
    args: text('args'),
    decision: varchar('decision', { length: 16 }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPathIdx: index('ix_workspace_permission_audit_user_path').on(t.userId, t.workspacePath),
    createdIdx: index('ix_workspace_permission_audit_created').on(t.createdAt),
  }),
)

export type WorkspacePermission = typeof workspacePermissions.$inferSelect
export type NewWorkspacePermission = typeof workspacePermissions.$inferInsert
export type WorkspacePermissionRule = typeof workspacePermissionRules.$inferSelect
export type NewWorkspacePermissionRule = typeof workspacePermissionRules.$inferInsert
export type WorkspacePermissionAuditLog = typeof workspacePermissionAuditLogs.$inferSelect
