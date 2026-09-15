// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * E2E 测试用户 seed 脚本。
 *
 * 用法：
 *   pnpm --filter @ihui/api tsx scripts/seed-test-users.ts
 *
 * 行为：
 * 1. 用应用层 hashPassword(argon2id)生成密码 hash（与 auth.ts 登录校验一致）
 * 2. upsert test@aizhs.top 一个普通测试用户（onConflictDoUpdate on email）
 * 3. 打印 seed 结果
 *
 * 适用场景：
 * - E2E 测试前初始化认证用户（修复 auth.setup.ts 500）
 * - 数据库重置后恢复测试账号
 *
 * 注意：admin 用户由 0067/0071 migration 永久保证（username='admin' / role_id=1 /
 * is_system_admin=true，真实 phone/email 标识不入仓库），本脚本不 seed admin，
 * 避免和 system admin 触发器冲突。
 */
import 'dotenv/config'
import { hashPassword } from '../src/utils/password-crypto.js'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import { eq } from 'drizzle-orm'

/**
 * 生产库防呆(2026-09-14 立):本脚本只允许写 E2E 专用库。
 * dotenv 会兜底读 apps/api/.env(生产 ihui_dev),本地跑 Playwright 时若忘记
 * 显式覆盖 DATABASE_URL,测试账号会被 seed 进生产库。CI 场景 e2e.yml 显式传
 * CI 容器库 + CI=true,不受影响;本地显式传 ihui_e2e 也放行。
 */
const DATABASE_URL = process.env.DATABASE_URL ?? ''
// 2026-09-15 修复:原裸 includes('ihui_dev') 会把密码含 ihui_dev 的合法隔离库
// (如 ihui:ihui_dev_xxx@host/ihui_e2e)误判为生产库。改为解析 URL 取库名段精确匹配;
// URL 解析失败时保守回退 includes(宁可误杀不可漏放)。
const seedDbName = (() => {
  try {
    return new URL(DATABASE_URL).pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  } catch {
    return DATABASE_URL.includes('ihui_dev') ? 'ihui_dev' : ''
  }
})()
const isProdDb = seedDbName ? seedDbName === 'ihui_dev' : DATABASE_URL.includes('ihui_dev')
if (isProdDb && process.env.CI !== 'true') {
  console.error(
    '[seed-test-users] 拒绝执行:DATABASE_URL 指向生产库 ihui_dev。' +
      'E2E 种子只允许写入隔离库,请显式传 DATABASE_URL(如 ihui_e2e);CI 环境不受影响。',
  )
  process.exit(1)
}

interface SeedUser {
  email: string
  username: string
  nickname: string
  password: string
  roleId: number
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'test@aizhs.top',
    username: 'test_e2e',
    nickname: 'Test User',
    password: 'Test@123456',
    roleId: 0,
  },
]

async function main() {
  console.info('[seed-test-users] 开始 seed E2E 测试用户...')
  let inserted = 0
  let updated = 0

  for (const u of SEED_USERS) {
    const passwordHash = await hashPassword(u.password)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
