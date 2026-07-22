import { createDb } from '../src/client.js'
import { permissions, roles, rolePermissions } from '../src/schema/rbac.js'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedData = JSON.parse(
  readFileSync(join(__dirname, 'permissions-seed.json'), 'utf-8'),
) as Array<{ name: string; resource: string; action: string; displayName: string }>

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * 权限点 + admin 角色绑定种子数据。
 * - 幂等：已存在的权限点跳过（onConflictDoNothing）
 * - 自动绑定到 admin 角色（name='admin'，若不存在则跳过绑定）
 *
 * 数据来源：apps/web 下所有 .tsx 中 <HasPermi code="..."> 静态扫描结果。
 * 详见 permissions-seed.json（214 条权限码）。
 */
export async function seedPermissions(): Promise<void> {
  console.log(`[permissions] 准备导入 ${seedData.length} 条权限点...`)

  // 1. 写入权限点（幂等）
  let inserted = 0
  for (const item of seedData) {
    const rows = await db
      .insert(permissions)
      .values({
        name: item.name,
        displayName: item.displayName,
        resource: item.resource,
        action: item.action,
      })
      .onConflictDoNothing()
      .returning({ id: permissions.id })
    if (rows.length > 0) inserted++
  }
  console.log(`[permissions] 新增 ${inserted} 条，跳过 ${seedData.length - inserted} 条已存在`)

  // 2. 绑定到 admin 角色（系统管理员通配符 *:*:* 已在 auth.ts 中处理，此处仅为 RBAC 表完整性）
  const adminRole = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.name, 'admin'))
    .limit(1)

  if (!adminRole[0]) {
    console.log('[permissions] admin 角色不存在，跳过角色绑定（admin 已通过 roleId>=1 通配符放行）')
    return
  }

  const roleId = adminRole[0].id
  const allPerms = await db.select({ id: permissions.id, name: permissions.name }).from(permissions)

  let bound = 0
  for (const p of allPerms) {
    const rows = await db
      .insert(rolePermissions)
      .values({ roleId, permissionId: p.id })
      .onConflictDoNothing()
      .returning({ id: rolePermissions.id })
    if (rows.length > 0) bound++
  }
  console.log(`[permissions] 绑定到 admin 角色：新增 ${bound} 条，共 ${allPerms.length} 条`)

  // 3. 同时确保 user 角色存在（普通用户默认角色）
  const userRole = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.name, 'user'))
    .limit(1)

  if (!userRole[0]) {
    await db
      .insert(roles)
      .values({
        name: 'user',
        displayName: '普通用户',
        description: '系统默认普通用户角色，无管理后台权限',
        scope: 'self',
        isSystem: true,
      })
      .onConflictDoNothing()
    console.log('[permissions] 创建 user 系统角色')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPermissions()
    .then(() => {
      console.log('[permissions] 完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[permissions] 失败:', err)
      process.exit(1)
    })
}
