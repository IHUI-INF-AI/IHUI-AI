/**
 * 教师角色 RBAC seed 脚本（2026-08-30 教师角色 RBAC 接入）。
 *
 * 用法：
 *   pnpm --filter @ihui/api seed:rbac-teacher
 *   （等价于 pnpm --filter @ihui/api tsx scripts/seed-rbac-teacher.ts）
 *
 * 背景：
 * - 系统只有 users.roleId（0=普通，>=1=admin），不能新增 roleId 表示教师（会提权），
 *   因此教师角色走 RBAC 三表（roles/permissions/role_permissions/user_roles）。
 * - 教务管理端点权限已拆分为两级(2026-08-30 权限粒度细化):
 *   写端点(POST/PUT/DELETE)走 requirePermission('edu:manage');
 *   只读 GET 端点走 requireAnyPermission(['edu:view', 'edu:manage'])(可管理者必然可读)。
 *   admin（roleId>=1）自动豁免,普通用户（roleId=0）需持有 teacher 角色才能访问。
 *
 * 行为（幂等，可重复执行）：
 * 1. upsert RBAC roles 表 teacher 角色（name 唯一冲突时更新描述信息）
 * 2. upsert permissions 表 'edu:manage' / 'edu:view' 两个权限点
 * 3. 补插 role_permissions 关联（已存在则忽略）
 * 4. 打印 seed 结果
 *
 * 注意：本脚本只 seed 角色/权限点/关联，不绑定具体用户。
 * 给用户绑定 teacher 角色请走管理端（user_roles 表 / addUserRole）。
 * 将来"只读教师"可在管理端仅挂 edu:view（移除该角色的 edu:manage 关联）。
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { roles, permissions, rolePermissions } from '@ihui/database'
import { eq, and } from 'drizzle-orm'

// 教师角色（RBAC roles.name 唯一标识）
const TEACHER_ROLE_NAME = 'teacher'
// 教务管理权限点（permissions.name 唯一标识，约定 'resource:action'）
// 2026-08-30 权限粒度细化:拆分为全权(edu:manage)与只读(edu:view)两个权限点
const EDU_PERMISSIONS = [
  {
    name: 'edu:manage',
    displayName: '教务管理',
    resource: 'edu',
    action: 'manage',
    description: '教务管理端点全权访问（term/class/schedule/meal/exam-score 等读写操作）',
  },
  {
    name: 'edu:view',
    displayName: '教务只读',
    resource: 'edu',
    action: 'view',
    description: '教务管理端点只读访问（GET 查询/统计/导出等）',
  },
] as const

async function main() {
  console.info('[seed-rbac-teacher] 开始 seed 教师角色 RBAC 数据...')

  // 1. 幂等插入 teacher 角色
  const [existingRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, TEACHER_ROLE_NAME))
    .limit(1)

  let teacherRole
  if (existingRole) {
    const [updated] = await db
      .update(roles)
      .set({
        displayName: '教师',
        description: '教师角色：可访问教务管理端点（edu:manage + edu:view 权限点）',
        updatedAt: new Date(),
      })
      .where(eq(roles.id, existingRole.id))
      .returning()
    teacherRole = updated ?? existingRole
    console.info(`  ✓ 角色已存在,更新: ${TEACHER_ROLE_NAME} (id=${teacherRole.id})`)
  } else {
    const [inserted] = await db
      .insert(roles)
      .values({
        name: TEACHER_ROLE_NAME,
        displayName: '教师',
        description: '教师角色：可访问教务管理端点（edu:manage + edu:view 权限点）',
        scope: 'self',
        isSystem: false,
      })
      .returning()
    teacherRole = inserted
    console.info(`  ✓ 角色已插入: ${TEACHER_ROLE_NAME} (id=${teacherRole?.id})`)
  }
  if (!teacherRole) throw new Error('teacher 角色 seed 失败')

  // 2. 幂等插入教务权限点（edu:manage / edu:view）并建立角色关联
  for (const perm of EDU_PERMISSIONS) {
    const [existingPermission] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, perm.name))
      .limit(1)

    let eduPermission
    if (existingPermission) {
      const [updated] = await db
        .update(permissions)
        .set({
          displayName: perm.displayName,
          description: perm.description,
        })
        .where(eq(permissions.id, existingPermission.id))
        .returning()
      eduPermission = updated ?? existingPermission
      console.info(`  ✓ 权限点已存在,更新: ${perm.name} (id=${eduPermission.id})`)
    } else {
      const [inserted] = await db
        .insert(permissions)
        .values({
          name: perm.name,
          displayName: perm.displayName,
          resource: perm.resource,
          action: perm.action,
          description: perm.description,
        })
        .returning()
      eduPermission = inserted
      console.info(`  ✓ 权限点已插入: ${perm.name} (id=${eduPermission?.id})`)
    }
    if (!eduPermission) throw new Error(`${perm.name} 权限点 seed 失败`)

    // 3. 幂等插入角色-权限关联（联合唯一冲突则忽略）
    const [existingRelation] = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, teacherRole.id),
          eq(rolePermissions.permissionId, eduPermission.id),
        ),
      )
      .limit(1)

    if (existingRelation) {
      console.info(`  ✓ 角色权限关联已存在,跳过: teacher → ${perm.name}`)
    } else {
      await db
        .insert(rolePermissions)
        .values({ roleId: teacherRole.id, permissionId: eduPermission.id })
        .onConflictDoNothing()
      console.info(`  ✓ 角色权限关联已插入: teacher → ${perm.name}`)
    }
  }

  console.info('[seed-rbac-teacher] 完成: teacher 角色已持有 edu:manage + edu:view 权限点')
  console.info(
    '[seed-rbac-teacher] 后续: 在管理端将教师用户绑定 teacher 角色(user_roles 表)即可访问教务管理端点',
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-rbac-teacher] 失败:', err)
  process.exit(1)
})
