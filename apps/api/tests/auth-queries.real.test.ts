import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  createUser,
  findUserByPhone,
  findUserByEmail,
  findUserByUsername,
  findUserByAccount,
  findUserById,
  updateUser,
  checkPhoneExists,
  cancelUserAccount,
} from '../src/db/queries.js'

describe('auth queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM users`)
  })

  it('createUser + findUserByPhone — 创建后能按手机号查到', async () => {
    const user = await createUser({
      phone: '13800000001',
      nickname: '测试用户',
      passwordHash: 'hashed-password',
    })

    expect(user.id).toBeDefined()
    expect(user.phone).toBe('13800000001')
    expect(user.status).toBe(1)
    expect(user.roleId).toBe(0)

    const found = await findUserByPhone('13800000001')
    expect(found).toBeDefined()
    expect(found!.nickname).toBe('测试用户')
    expect(found!.passwordHash).toBe('hashed-password')
  })

  it('findUserByAccount — username/phone/email 三选一', async () => {
    await db.insert(users).values({
      phone: '13800000002',
      email: 'test@example.com',
      username: 'testuser',
      nickname: '账号用户',
    })

    expect((await findUserByAccount('testuser'))?.phone).toBe('13800000002')
    expect((await findUserByAccount('13800000002'))?.email).toBe('test@example.com')
    expect((await findUserByAccount('test@example.com'))?.username).toBe('testuser')
    expect(await findUserByAccount('nonexistent')).toBeUndefined()
  })

  it('findUserByEmail + findUserByUsername', async () => {
    await db.insert(users).values({
      phone: '13800000003',
      email: 'email-test@example.com',
      username: 'unique-user',
    })

    expect((await findUserByEmail('email-test@example.com'))?.username).toBe('unique-user')
    expect((await findUserByUsername('unique-user'))?.email).toBe('email-test@example.com')
  })

  it('findUserById — 按 ID 查询', async () => {
    const [inserted] = await db
      .insert(users)
      .values({ phone: '13800000004', nickname: 'ID测试' })
      .returning()

    const found = await findUserById(inserted.id)
    expect(found).toBeDefined()
    expect(found!.nickname).toBe('ID测试')
  })

  it('updateUser — 更新 nickname/email/bio', async () => {
    const user = await createUser({ phone: '13800000005', nickname: '旧昵称' })

    const updated = await updateUser(user.id, {
      nickname: '新昵称',
      email: 'new@example.com',
      bio: '个人简介',
    })

    expect(updated.nickname).toBe('新昵称')
    expect(updated.email).toBe('new@example.com')
    expect(updated.bio).toBe('个人简介')
  })

  it('checkPhoneExists — 检查手机号是否已注册', async () => {
    await createUser({ phone: '13800000006' })

    expect(await checkPhoneExists('13800000006')).toBe(true)
    expect(await checkPhoneExists('13800000099')).toBe(false)
  })

  it('cancelUserAccount — 软注销 status=3', async () => {
    const user = await createUser({ phone: '13800000007' })
    expect(user.status).toBe(1)

    await cancelUserAccount(user.id)

    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row.status).toBe(3)
  })
})
