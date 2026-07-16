import { sql } from 'drizzle-orm'
import { createDb } from '../src/client.js'
import { users } from '../src/schema/users.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

const defaultUsers = [
  {
    email: 'test@ihui.ai',
    passwordHash: '$2a$10$OPEUcio1sAiFlDai07aULuYSuyzUdxaesANflUGeNdGG2FiMHojRW',
    nickname: 'Test User',
    roleId: 0,
    status: 1,
  },
  {
    email: 'admin@ihui.ai',
    passwordHash: '$2a$10$4tg88lwTv64fjJw0TSKFnuNhSInvjnLVofr679KTd1lY8jNYWiInO',
    nickname: 'Admin User',
    roleId: 1,
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
