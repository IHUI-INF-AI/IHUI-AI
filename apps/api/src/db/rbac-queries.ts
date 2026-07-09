import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from './index.js';
import {
  roles,
  permissions,
  rolePermissions,
  userRoles,
  type Role,
  type Permission,
  type RolePermission,
  type UserRole,
} from '@ihui/database';

// =============================================================================
// Roles
// =============================================================================

export interface CreateRoleInput {
  name: string;
  displayName: string;
  description?: string;
  scope?: string;
  isSystem?: boolean;
}

export interface UpdateRoleInput {
  displayName?: string;
  description?: string;
  scope?: string;
}

/**
 * 创建角色。
 */
export async function createRole(data: CreateRoleInput): Promise<Role> {
  const rows = await db
    .insert(roles)
    .values({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      scope: data.scope,
      isSystem: data.isSystem,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建角色失败');
  return row;
}

/**
 * 列出全部角色，按创建时间正序（系统角色靠前）。
 */
export async function findRoles(): Promise<Role[]> {
  return db.select().from(roles).orderBy(roles.createdAt);
}

/**
 * 按 ID 查询角色。
 */
export async function findRoleById(id: string): Promise<Role | undefined> {
  const rows = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return rows[0];
}

/**
 * 按 name 查询角色（唯一性校验）。
 */
export async function findRoleByName(name: string): Promise<Role | undefined> {
  const rows = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  return rows[0];
}

/**
 * 更新角色字段（仅非 system 角色应由调用方校验）。
 */
export async function updateRole(id: string, data: UpdateRoleInput): Promise<Role> {
  const rows = await db
    .update(roles)
    .set({
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.scope !== undefined && { scope: data.scope }),
      updatedAt: new Date(),
    })
    .where(eq(roles.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new Error('更新角色失败');
  return row;
}

/**
 * 删除角色（级联删除关联由外键保证；调用方需校验非 system）。
 */
export async function deleteRole(id: string): Promise<void> {
  await db.delete(roles).where(eq(roles.id, id));
}

// =============================================================================
// Permissions
// =============================================================================

export interface CreatePermissionInput {
  name: string;
  displayName: string;
  resource: string;
  action: string;
  description?: string;
}

/**
 * 创建权限点。
 */
export async function createPermission(data: CreatePermissionInput): Promise<Permission> {
  const rows = await db
    .insert(permissions)
    .values({
      name: data.name,
      displayName: data.displayName,
      resource: data.resource,
      action: data.action,
      description: data.description,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error('创建权限点失败');
  return row;
}

/**
 * 列出全部权限点。
 */
export async function findPermissions(): Promise<Permission[]> {
  return db.select().from(permissions).orderBy(permissions.resource, permissions.action);
}

/**
 * 按 ID 查询权限点。
 */
export async function findPermissionById(id: string): Promise<Permission | undefined> {
  const rows = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
  return rows[0];
}

/**
 * 按 name 查询权限点。
 */
export async function findPermissionByName(name: string): Promise<Permission | undefined> {
  const rows = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
  return rows[0];
}

// =============================================================================
// Role <-> Permissions
// =============================================================================

export type RolePermissionDetail = Permission

/**
 * 列出某角色的全部权限点。
 */
export async function findRolePermissions(roleId: string): Promise<Permission[]> {
  return db
    .select({
      id: permissions.id,
      name: permissions.name,
      displayName: permissions.displayName,
      resource: permissions.resource,
      action: permissions.action,
      description: permissions.description,
      createdAt: permissions.createdAt,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId))
    .orderBy(permissions.resource, permissions.action);
}

/**
 * 给角色批量赋予权限（已存在的会被忽略，依赖联合唯一约束）。
 */
export async function addRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<RolePermission[]> {
  if (permissionIds.length === 0) return [];
  const rows = await db
    .insert(rolePermissions)
    .values(permissionIds.map((pid) => ({ roleId, permissionId: pid })))
    .onConflictDoNothing()
    .returning();
  return rows;
}

/**
 * 移除角色的某个权限。
 */
export async function removeRolePermission(
  roleId: string,
  permissionId: string,
): Promise<void> {
  await db
    .delete(rolePermissions)
    .where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)),
    );
}

// =============================================================================
// User <-> Roles
// =============================================================================

export interface UserRoleDetail {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  roleScope: string;
  scopeResourceId: string | null;
  createdAt: Date;
}

/**
 * 列出用户的全部角色（含角色基础信息）。
 */
export async function findUserRoles(userId: string): Promise<UserRoleDetail[]> {
  return db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      roleId: userRoles.roleId,
      roleName: roles.name,
      roleDisplayName: roles.displayName,
      roleScope: roles.scope,
      scopeResourceId: userRoles.scopeResourceId,
      createdAt: userRoles.createdAt,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
    .orderBy(userRoles.createdAt);
}

/**
 * 给用户赋予角色（已存在则忽略）。
 */
export async function addUserRole(
  userId: string,
  roleId: string,
  scopeResourceId?: string | null,
): Promise<UserRole | undefined> {
  const rows = await db
    .insert(userRoles)
    .values({ userId, roleId, scopeResourceId: scopeResourceId ?? null })
    .onConflictDoNothing()
    .returning();
  return rows[0];
}

/**
 * 移除用户的某角色。
 */
export async function removeUserRole(userId: string, roleId: string): Promise<void> {
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
}

// =============================================================================
// 权限检查
// =============================================================================

/**
 * 综合判断用户是否拥有指定权限。
 * 单次 SQL JOIN：user_roles → role_permissions → permissions，命中即放行。
 * 注意：admin（users.roleId >= 1）的快速放行应由调用方处理，本函数只做 RBAC 表查询。
 */
export async function checkPermission(
  userId: string,
  permissionName: string,
): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), eq(permissions.name, permissionName)))
    .limit(1);
  return Number(rows[0]?.count ?? 0) > 0;
}

/**
 * 批量判断用户是否拥有给定权限中的任意一个（用于 requirePermission 扩展场景）。
 */
export async function checkAnyPermission(
  userId: string,
  permissionNames: string[],
): Promise<boolean> {
  if (permissionNames.length === 0) return false;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, userId), inArray(permissions.name, permissionNames)))
    .limit(1);
  return Number(rows[0]?.count ?? 0) > 0;
}
