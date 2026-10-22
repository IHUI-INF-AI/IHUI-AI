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
 * 注意：admin 用户由 0067/0071 migration 创建，迁移内不再写入任何可登录的默认口令；
 * 真实 phone/email 标识不入仓库。本脚本只在显式提供 E2E_ADMIN_PASSWORD 时写入
 * 测试专用管理员 e2e_admin（非 system admin），供 e2e 使用，生产库一律拒绝。
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
 *
 * 判据必须是「库名」而非整串(2026-09-21 修):本机开发库 `ihui` 的口令前缀恰为
 * `ihui_dev_`,整串 includes 把它误判成生产库 → seed 恒拒绝 → global-setup 只 warn
 * → test@aizhs.top 永不存在 → 全部 authenticatedPage 用例死在 fixture 登录。
 * URL 解析不了时退回整串匹配,保持 fail-closed。
 *
 * 显式本地标记(2026-10-22 加):E2E_ALLOW_LOCAL_DB=1 表示操作者**显式声明**当前
 * 名为 ihui_dev 的库就是本机库而非生产库,放行 seed。默认不设 ⇒ 保护原样生效;
 * 生产保护没有被拆掉,只是给"库名恰好撞生产命名"的本地环境一条显式出路。
 */
const DATABASE_URL = process.env.DATABASE_URL ?? ''
let prodDbNameMatched: boolean
try {
  prodDbNameMatched = new URL(DATABASE_URL).pathname.replace(/^\//, '') === 'ihui_dev'
} catch {
  prodDbNameMatched = DATABASE_URL.includes('ihui_dev')
}
if (prodDbNameMatched && process.env.CI !== 'true' && process.env.E2E_ALLOW_LOCAL_DB !== '1') {
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

/**
 * e2e 管理员：测试专用，非 system admin（不触碰 0067 的不可变触发器）。
 * 口令只从环境变量读取；缺失则跳过并告警，绝不回落到仓内字面量。
 */
const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD
if (e2eAdminPassword) {
  SEED_USERS.push({
    email: 'e2e_admin@aizhs.top',
    username: 'e2e_admin',
    nickname: 'E2E Admin',
    password: e2eAdminPassword,
    roleId: 1,
  })
} else {
  console.warn(
    '[seed-test-users] 未设置 E2E_ADMIN_PASSWORD，跳过 e2e 管理员 seed；' +
      '需要管理员登录态的用例会失败（口令仅允许从环境注入）。',
  )
}

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
