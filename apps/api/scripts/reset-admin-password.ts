/**
 * admin 密码重置脚本。
 *
 * 用法: pnpm --filter @ihui/api reset:admin-password [新密码]
 * 默认密码: admin123(符合 §user_profile 测试账号规则)
 *
 * 注意: admin 用户由 0067/0071 migration 触发器保护,SQL 直接 UPDATE 会被拒绝,
 *       本脚本通过临时 DISABLE TRIGGER ALL 绕过,更新后立即 ENABLE。
 *
 * 流程:
 * 1. 从 argv[2] 读取新密码(默认 admin123),用 hashPassword(argon2id)生成 hash
 * 2. 先尝试直接 UPDATE,失败(触发器拒绝)走降级路径:
 *    DISABLE TRIGGER ALL → UPDATE → ENABLE TRIGGER ALL
 * 3. 查询 admin 用户名+邮箱确认,打印结果
 */
import 'dotenv/config'
import { hashPassword } from '../src/utils/password-crypto.js'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import { eq, sql } from 'drizzle-orm'

const ADMIN_USERNAME = 'admin'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function updateAdminPassword(hash: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.username, ADMIN_USERNAME))
}

async function main() {
  const plain = process.argv[2] ?? 'admin123'
  console.info(`[reset-admin-password] 开始重置 admin 密码...`)

  const hash = await hashPassword(plain)

  try {
    await updateAdminPassword(hash)
    console.info('[reset-admin-password] 直接 UPDATE 成功(触发器未拦截)')
  } catch (e) {
    console.warn(`[reset-admin-password] 直接 UPDATE 失败,走降级路径(禁用触发器): ${errMsg(e)}`)
    await db.execute(sql`ALTER TABLE users DISABLE TRIGGER ALL`)
    try {
      await updateAdminPassword(hash)
      console.info('[reset-admin-password] 降级路径 UPDATE 成功')
    } finally {
      await db.execute(sql`ALTER TABLE users ENABLE TRIGGER ALL`)
      console.info('[reset-admin-password] 已重新 ENABLE TRIGGER ALL')
    }
  }

  const [admin] = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(eq(users.username, ADMIN_USERNAME))
    .limit(1)

  if (!admin) {
    console.error('[reset-admin-password] 失败:未找到 admin 用户')
    process.exit(1)
  }

  console.info(`[reset-admin-password] 成功 ✓`)
  console.info(`  username: ${admin.username}`)
  console.info(`  email:    ${admin.email ?? '(空)'}`)
  process.exit(0)
}

main().catch((e: unknown) => {
  console.error(`[reset-admin-password] 失败: ${errMsg(e)}`)
  process.exit(1)
})
