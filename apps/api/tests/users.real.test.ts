import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { testDb, closeTestDb } from './helpers/test-db'
import { users } from '@ihui/database'

describe('users 表 — 真实 DB 集成测试', () => {
  afterAll(async () => {
    await closeTestDb()
  })

  // 用 DELETE 而非 TRUNCATE:users 被 100+ 表外键引用,TRUNCATE CASCADE 会级联清空所有引用表
  // DELETE 不级联,且 users 用 uuid 无序列需重置,速度更快
  beforeEach(async () => {
    await testDb.execute(sql`DELETE FROM users`)
  })

  it('插入用户并查询验证字段', async () => {
    const [inserted] = await testDb
      .insert(users)
      .values({ phone: '13800000001', nickname: '测试用户', gender: 1 })
      .returning()

    expect(inserted).toBeDefined()
    expect(inserted.id).toBeDefined()
    expect(inserted.phone).toBe('13800000001')
    expect(inserted.nickname).toBe('测试用户')
    expect(inserted.gender).toBe(1)
    expect(inserted.status).toBe(1)
    expect(inserted.isVip).toBe(0)
    expect(inserted.roleId).toBe(0)
    expect(inserted.createdAt).toBeDefined()

    const [queried] = await testDb.select().from(users).where(eq(users.id, inserted.id))
    expect(queried.phone).toBe('13800000001')
    expect(queried.nickname).toBe('测试用户')
  })

  it('phone 唯一约束 — 重复插入应报错', async () => {
    await testDb.insert(users).values({ phone: '13800000002', nickname: '用户A' })

    await expect(
      testDb.insert(users).values({ phone: '13800000002', nickname: '用户B' }),
    ).rejects.toThrow()
  })

  it('更新用户 nickname', async () => {
    const [inserted] = await testDb
      .insert(users)
      .values({ phone: '13800000003', nickname: '旧昵称' })
      .returning()

    await testDb.update(users).set({ nickname: '新昵称' }).where(eq(users.id, inserted.id))

    const [updated] = await testDb.select().from(users).where(eq(users.id, inserted.id))
    expect(updated.nickname).toBe('新昵称')
  })

  it('删除用户', async () => {
    const [inserted] = await testDb
      .insert(users)
      .values({ phone: '13800000004', nickname: '待删除' })
      .returning()

    await testDb.delete(users).where(eq(users.id, inserted.id))

    const result = await testDb.select().from(users).where(eq(users.id, inserted.id))
    expect(result).toHaveLength(0)
  })

  it('默认值 — 不指定 gender/status/isVip 时使用 schema 默认', async () => {
    const [inserted] = await testDb.insert(users).values({ phone: '13800000005' }).returning()

    expect(inserted.gender).toBe(0)
    expect(inserted.status).toBe(1)
    expect(inserted.isVip).toBe(0)
    expect(inserted.roleId).toBe(0)
  })
})
