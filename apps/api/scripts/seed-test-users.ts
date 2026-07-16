/**
 * E2E 测试用户 seed 脚本。
 *
 * 用法：
 *   pnpm --filter @ihui/api tsx scripts/seed-test-users.ts
 *
 * 行为：
 * 1. 用应用层 bcrypt.hash 生成密码 hash（与 auth.ts 登录校验一致，cost=10）
 * 2. upsert test@ihui.ai / admin@ihui.ai 两个用户（onConflictDoUpdate on email）
 * 3. 打印 seed 结果
 *
 * 适用场景：
 * - E2E 测试前初始化认证用户（修复 auth.setup.ts 500）
 * - 数据库重置后恢复测试账号
 */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import { eq } from 'drizzle-orm'

interface SeedUser {
  email: string
  username: string
  nickname: string
  password: string
  roleId: number
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'test@ihui.ai',
    username: 'test_e2e',
    nickname: 'Test User',
    password: 'Test@123456',
    roleId: 0,
  },
  {
    email: 'admin@ihui.ai',
    username: 'admin_e2e',
    nickname: 'Admin User',
    password: 'Admin@123456',
    roleId: 1,
  },
]

async function main() {
  console.info('[seed-test-users] 开始 seed E2E 测试用户...')
  let inserted = 0
  let updated = 0

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10)
    try {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1)

      if (existing) {
        await db
          .update(users)
          .set({
            email: u.email,
            username: u.username,
            nickname: u.nickname,
            passwordHash,
            roleId: u.roleId,
            status: 1,
          })
          .where(eq(users.id, existing.id))
        updated++
        console.info(`  ✓ updated ${u.email} (roleId=${u.roleId})`)
      } else {
        await db.insert(users).values({
          email: u.email,
          username: u.username,
          nickname: u.nickname,
          passwordHash,
          roleId: u.roleId,
          status: 1,
        })
        inserted++
        console.info(`  ✓ inserted ${u.email} (roleId=${u.roleId})`)
      }
    } catch (err) {
      console.error(`  ✗ failed ${u.email}:`, err)
      throw err
    }
  }

  console.info(`[seed-test-users] 完成: ${inserted} inserted, ${updated} updated`)
  console.info('[seed-test-users] 现在可运行 E2E: pnpm --filter @ihui/web test:e2e')
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-test-users] 失败:', err)
  process.exit(1)
})
