import { sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'
import { users } from '../src/schema/users.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

// 注意：admin 用户由 0067/0071 migration 永久保证（username='admin' /
// password='admin123' / email='502319984@qq.com' / role_id=1 /
// is_system_admin=true），这里只 seed 普通用户，避免和 system admin 触发器冲突。
const defaultUsers = [
  {
    email: 'test@ihui.ai',
    passwordHash: '$2a$10$OPEUcio1sAiFlDai07aULuYSuyzUdxaesANflUGeNdGG2FiMHojRW',
    nickname: 'Test User',
    roleId: 0,
    status: 1,
  },
]

export async function seedUsers() {
  console.info(`开始导入默认用户数据 (${defaultUsers.length} 条)...`)

  const result = await db
    .insert(users)
    .values(defaultUsers)
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash: sql`EXCLUDED.password_hash`,
        nickname: sql`EXCLUDED.nickname`,
        roleId: sql`EXCLUDED.role_id`,
        status: sql`EXCLUDED.status`,
      },
    })
    .returning({ email: users.email })

  console.info(`默认用户导入完成: ${result.map((u) => u.email).join(', ')}`)
}
