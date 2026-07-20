import { and, desc, eq, sql } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import {
  workspacePermissions,
  workspacePermissionRules,
  workspacePermissionAuditLogs,
  type WorkspacePermission,
  type WorkspacePermissionRule,
  type WorkspacePermissionAuditLog,
} from '@ihui/database'

// =============================================================================
// 工作区权限主配置
// =============================================================================

export async function getPermission(
  userId: string,
  workspacePath: string,
): Promise<WorkspacePermission | undefined> {
  const rows = await dbRead
    .select()
    .from(workspacePermissions)
    .where(and(eq(workspacePermissions.userId, userId), eq(workspacePermissions.workspacePath, workspacePath)))
    .limit(1)
  return rows[0]
}

export async function listPermissionsByUser(userId: string): Promise<WorkspacePermission[]> {
  return dbRead
    .select()
    .from(workspacePermissions)
    .where(eq(workspacePermissions.userId, userId))
    .orderBy(desc(workspacePermissions.updatedAt))
}

export async function countPermissionsByUser(userId: string): Promise<number> {
  const rows = await dbRead
    .select({ count: sql<number>`COUNT(*)` })
    .from(workspacePermissions)
    .where(eq(workspacePermissions.userId, userId))
  return Number(rows[0]?.count ?? 0)
}

export async function upsertPermission(data: {
  userId: string
  workspacePath: string
  name: string
  techStack?: string
  mode: string
}): Promise<WorkspacePermission> {
  const rows = await db
    .insert(workspacePermissions)
    .values({
      userId: data.userId,
      workspacePath: data.workspacePath,
      name: data.name,
      techStack: data.techStack,
      mode: data.mode,
      lastAccessedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [workspacePermissions.userId, workspacePermissions.workspacePath],
      set: {
        name: data.name,
        techStack: data.techStack,
        mode: data.mode,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('upsert 工作区权限失败')
  return row
}

export async function touchLastAccessed(userId: string, workspacePath: string): Promise<void> {
  await db
    .update(workspacePermissions)
    .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(workspacePermissions.userId, userId), eq(workspacePermissions.workspacePath, workspacePath)))
}

export async function deletePermission(userId: string, workspacePath: string): Promise<void> {
  // 级联清理:规则 + 审计日志 + 主记录
  await db
    .delete(workspacePermissionRules)
    .where(and(eq(workspacePermissionRules.userId, userId), eq(workspacePermissionRules.workspacePath, workspacePath)))
  await db
    .delete(workspacePermissionAuditLogs)
    .where(and(eq(workspacePermissionAuditLogs.userId, userId), eq(workspacePermissionAuditLogs.workspacePath, workspacePath)))
  await db
    .delete(workspacePermissions)
    .where(and(eq(workspacePermissions.userId, userId), eq(workspacePermissions.workspacePath, workspacePath)))
}

// =============================================================================
// 白名单规则
// =============================================================================

export async function listRules(
  userId: string,
  workspacePath: string,
): Promise<WorkspacePermissionRule[]> {
  return dbRead
    .select()
    .from(workspacePermissionRules)
    .where(and(eq(workspacePermissionRules.userId, userId), eq(workspacePermissionRules.workspacePath, workspacePath)))
    .orderBy(desc(workspacePermissionRules.createdAt))
}

export async function createRule(data: {
  userId: string
  workspacePath: string
  ruleType: string
  pattern: string
  operation?: string
  decision: string
  builtin?: boolean
}): Promise<WorkspacePermissionRule> {
  const rows = await db
    .insert(workspacePermissionRules)
    .values({
      userId: data.userId,
      workspacePath: data.workspacePath,
      ruleType: data.ruleType,
      pattern: data.pattern,
      operation: data.operation,
      decision: data.decision,
      builtin: data.builtin ?? false,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建规则失败')
  return row
}

export async function updateRule(
  id: string,
  userId: string,
  data: Partial<Pick<WorkspacePermissionRule, 'pattern' | 'decision' | 'operation'>>,
): Promise<WorkspacePermissionRule | undefined> {
  const rows = await db
    .update(workspacePermissionRules)
    .set(data)
    .where(and(eq(workspacePermissionRules.id, id), eq(workspacePermissionRules.userId, userId)))
    .returning()
  return rows[0]
}

export async function deleteRule(id: string, userId: string): Promise<void> {
  await db
    .delete(workspacePermissionRules)
    .where(and(eq(workspacePermissionRules.id, id), eq(workspacePermissionRules.userId, userId)))
}

export async function createRulesBulk(
  userId: string,
  workspacePath: string,
  rules: Array<{
    ruleType: string
    pattern: string
    operation?: string
    decision: string
    builtin?: boolean
  }>,
): Promise<void> {
  if (rules.length === 0) return
  await db.insert(workspacePermissionRules).values(
    rules.map((r) => ({
      userId,
      workspacePath,
      ruleType: r.ruleType,
      pattern: r.pattern,
      operation: r.operation,
      decision: r.decision,
      builtin: r.builtin ?? false,
    })),
  )
}

export async function clearUserRules(userId: string, workspacePath: string): Promise<void> {
  await db
    .delete(workspacePermissionRules)
    .where(and(eq(workspacePermissionRules.userId, userId), eq(workspacePermissionRules.workspacePath, workspacePath)))
}

// =============================================================================
// 审计日志
// =============================================================================

export async function appendAuditLog(data: {
  userId: string
  workspacePath: string
  toolName?: string
  args?: string
  decision: string
  reason?: string
}): Promise<void> {
  await db.insert(workspacePermissionAuditLogs).values({
    userId: data.userId,
    workspacePath: data.workspacePath,
    toolName: data.toolName,
    args: data.args,
    decision: data.decision,
    reason: data.reason,
  })
}

export async function listAuditLogs(
  userId: string,
  workspacePath: string,
  limit = 50,
): Promise<WorkspacePermissionAuditLog[]> {
  return dbRead
    .select()
    .from(workspacePermissionAuditLogs)
    .where(and(eq(workspacePermissionAuditLogs.userId, userId), eq(workspacePermissionAuditLogs.workspacePath, workspacePath)))
    .orderBy(desc(workspacePermissionAuditLogs.createdAt))
    .limit(limit)
}
