/**
 * 默认用户 seed 脚本(packages/database 层)。
 *
 * Hash 算法: argon2id(与 apps/api/src/utils/password-crypto.ts 一致)
 * - type: argon2id (混合抗侧信道 + 抗 GPU)
 * - memoryCost: 19456 KiB (19 MB, OWASP 最小值)
 * - timeCost: 2 (迭代次数)
 * - parallelism: 1 (单线程,防 DoS)
 *
 * 与 apps/api/scripts/seed-test-users.ts 等价:
 * - 同样 seed email='test@aizhs.top' / username='test_e2e' / password='Test@123456' / roleId=0
 * - 同样用 argon2id 实时 hash(不再用预生成的 bcrypt hash)
 *
 * 依赖说明:
 * - packages/database 是底层包,不依赖 argon2(避免循环依赖)
 * - 这里用动态 import('argon2') 加载,如果 argon2 不可用(未安装),
 *   throw 明确错误提示"请用 apps/api/scripts/seed-test-users.ts 替代"
 * - 推荐场景: E2E / 集成测试前初始化认证用户,优先用 apps/api/scripts/seed-test-users.ts
 *
 * 注意: admin 用户由 0067/0071 migration 永久保证(username='admin' /
 * password='admin123' / email='502319984@qq.com' / role_id=1 /
 * is_system_admin=true),这里只 seed 普通用户,避免和 system admin 触发器冲突。
 */
import { sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'
import { users } from '../src/schema/users.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/** argon2id 参数(与 apps/api/src/utils/password-crypto.ts ARGON2ID_OPTIONS 一致) */
const ARGON2ID_OPTIONS = {
  type: 2, // argon2id(argon2.argon2id = 2)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

/** 测试用户明文密码(与 seed-test-users.ts 一致) */
const TEST_USER_PASSWORD = 'Test@123456'

interface DefaultUser {
  email: string
  username: string
  nickname: string
  roleId: number
  status: number
}

const defaultUsers: DefaultUser[] = [
  {
    email: 'test@aizhs.top',
    username: 'test_e2e',
    nickname: 'Test User',
    roleId: 0,
    status: 1,
  },
]

/**
 * 动态加载 argon2 生成 passwordHash。
 * packages/database 不强依赖 argon2,如果未安装则 throw 明确错误。
 */
async function hashPassword(password: string): Promise<string> {
  type Argon2Module = {
    hash: (plain: string, options: Record<string, unknown>) => Promise<string>
  }
  let argon2: Argon2Module
  try {
    argon2 = (await import('argon2')) as Argon2Module
  } catch {
    throw new Error(
      '[packages/database/seed/users.ts] argon2 包未安装。' +
        'packages/database 是底层包不强依赖 argon2,请改用 apps/api/scripts/seed-test-users.ts 替代:' +
        'pnpm --filter @ihui/api run seed:test-users',
    )
  }
  return argon2.hash(password, ARGON2ID_OPTIONS)
}

export async function seedUsers() {
  console.info(`开始导入默认用户数据 (${defaultUsers.length} 条)...`)

  for (const u of defaultUsers) {
    const passwordHash = await hashPassword(TEST_USER_PASSWORD)
    const result = await db
      .insert(users)
      .values({
        email: u.email,
        username: u.username,
        nickname: u.nickname,
        passwordHash,
        roleId: u.roleId,
        status: u.status,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          passwordHash: sql`EXCLUDED.password_hash`,
          username: sql`EXCLUDED.username`,
          nickname: sql`EXCLUDED.nickname`,
          roleId: sql`EXCLUDED.role_id`,
          status: sql`EXCLUDED.status`,
        },
      })
      .returning({ email: users.email })
    console.info(`  ✓ upsert ${result.map((r) => r.email).join(', ')}`)
  }

  console.info('默认用户导入完成')
}
