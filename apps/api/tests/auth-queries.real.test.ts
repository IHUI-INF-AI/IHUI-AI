// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// DB-35:直插 users 行也要走"密文 + lookup 盲索引"写入对,否则 phone/email 分支
// 按 lookup 等值查不到;读出的密文须用 decryptUserContact 解密后再比对明文。
import { contactWritePair, decryptUserContact } from '../src/utils/user-contact.js'

describe('auth queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  it('createUser + findUserByPhone — 创建后能按手机号查到', async () => {
    const user = await createUser({
      phone: '13800000001',
      nickname: '测试用户',
      passwordHash: 'hashed-password',
    })

    expect(user.id).toBeDefined()
    // phone 列存密文,读出后解密再比对明文
    expect(decryptUserContact(user.phone)).toBe('13800000001')
    expect(user.status).toBe(1)
    expect(user.roleId).toBe(0)

    const found = await findUserByPhone('13800000001')
    expect(found).toBeDefined()
    expect(found!.nickname).toBe('测试用户')
    expect(found!.passwordHash).toBe('hashed-password')
  })

  it('findUserByAccount — username/phone/email 三选一', async () => {
    // 直插行同样写密文 + lookup,phone/email 分支才能按盲索引命中
    const phonePair = contactWritePair('phone', '13800000002')
    const emailPair = contactWritePair('email', 'test@example.com')
    await db.insert(users).values({
      phone: phonePair.value,
      phoneLookup: phonePair.lookup,
      email: emailPair.value,
      emailLookup: emailPair.lookup,
      username: 'testuser',
      nickname: '账号用户',
    })

    const byUsername = await findUserByAccount('testuser')
    expect(byUsername).toBeDefined()
    expect(decryptUserContact(byUsername!.phone)).toBe('13800000002')

    const byPhone = await findUserByAccount('13800000002')
    expect(byPhone).toBeDefined()
    expect(decryptUserContact(byPhone!.email)).toBe('test@example.com')

    const byEmail = await findUserByAccount('test@example.com')
    expect(byEmail).toBeDefined()
    expect(byEmail!.username).toBe('testuser')
    expect(await findUserByAccount('nonexistent')).toBeUndefined()
  })

  it('findUserByEmail + findUserByUsername', async () => {
    const phonePair = contactWritePair('phone', '13800000003')
    const emailPair = contactWritePair('email', 'email-test@example.com')
    await db.insert(users).values({
      phone: phonePair.value,
      phoneLookup: phonePair.lookup,
      email: emailPair.value,
      emailLookup: emailPair.lookup,
      username: 'unique-user',
    })

    const byEmail = await findUserByEmail('email-test@example.com')
    expect(byEmail).toBeDefined()
    expect(byEmail!.username).toBe('unique-user')

    const byUsername = await findUserByUsername('unique-user')
    expect(byUsername).toBeDefined()
    expect(decryptUserContact(byUsername!.email)).toBe('email-test@example.com')
  })

  it('findUserById — 按 ID 查询', async () => {
    const [inserted] = await db
      .insert(users)
      .values({ phone: '13800000004', nickname: 'ID测试' })
      .returning()
    if (!inserted) throw new Error('auth-queries.real.test.ts: 插入未返回行(inserted)')

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
    expect(decryptUserContact(updated.email)).toBe('new@example.com')
    expect(updated.bio).toBe('个人简介')
  })

  it('checkPhoneExists — 检查手机号是否已注册', async () => {
    await createUser({ phone: '13800000006' })

    expect(await checkPhoneExists('13800000006')).toBe(true)
    expect(await checkPhoneExists('13800000099')).toBe(false)
  })

  it('cancelUserAccount — 软注销 status=3 并 NULL 化所有唯一字段 + 清 2FA', async () => {
    const user = await createUser({
      phone: '13800000007',
      email: 'cancel-test@example.com',
    })
    expect(user.status).toBe(1)

    // CreateUserInput 不含 username(createUser 不写该列);此处显式补写,
    // 保住"注销必须把 username 一并 NULL 化"的覆盖意图。
    await db.update(users).set({ username: 'cancel-test-user' }).where(eq(users.id, user.id))

    await cancelUserAccount(user.id)

    const [row] = await db.select().from(users).where(eq(users.id, user.id))
    expect(row!.status).toBe(3)
    // 2026-08-01 升级:所有唯一约束字段必须 NULL 化,避免占用导致新注册冲突
    expect(row!.phone).toBeNull()
    expect(row!.email).toBeNull()
    expect(row!.username).toBeNull()
    expect(row!.inviteCode).toBeNull()
    // 2FA 字段清空(数据卫生)
    expect(row!.twoFactorSecret).toBeNull()
    expect(row!.twoFactorEnabled).toBe(false)
    expect(row!.twoFactorBackupCodes).toEqual([])
    expect(row!.twoFactorEnabledAt).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
