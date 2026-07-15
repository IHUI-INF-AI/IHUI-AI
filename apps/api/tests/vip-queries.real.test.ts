import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, userVips } from '@ihui/database'
import {
  listVipLevels,
  findVipLevel,
  createVipLevel,
  updateVipLevel,
  deleteVipLevel,
  getMyVip,
  purchaseVip,
  listUserVips,
} from '../src/db/vip-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

describe('vip-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空:user_vips → vip_levels → users
    await db.execute(sql`DELETE FROM user_vips`)
    await db.execute(sql`DELETE FROM vip_levels`)
    await db.execute(sql`DELETE FROM users`)
  })

  describe('VIP Levels', () => {
    it('createVipLevel + findVipLevel — 默认值 status=1', async () => {
      const level = await createVipLevel({
        levelName: '月度VIP',
        levelValue: 1,
        price: 3000,
        durationDays: 30,
        benefits: ['专属客服', '折扣'],
      })
      expect(level.id).toBeDefined()
      expect(level.levelName).toBe('月度VIP')
      expect(level.levelValue).toBe(1)
      expect(level.price).toBe(3000)
      expect(level.durationDays).toBe(30)
      expect(level.status).toBe(1)
      expect(level.benefits).toEqual(['专属客服', '折扣'])

      const found = await findVipLevel(level.id)
      expect(found).toBeDefined()
      expect(found!.levelName).toBe('月度VIP')
    })

    it('listVipLevels — activeOnly=true 只返回 status=1', async () => {
      await createVipLevel({
        levelName: '上架',
        levelValue: 1,
        price: 100,
        durationDays: 30,
        benefits: [],
      })
      const level2 = await createVipLevel({
        levelName: '下架',
        levelValue: 2,
        price: 200,
        durationDays: 60,
        benefits: [],
      })
      await updateVipLevel(level2.id, { status: 0 })

      const all = await listVipLevels(false)
      expect(all).toHaveLength(2)

      const activeOnly = await listVipLevels(true)
      expect(activeOnly).toHaveLength(1)
      expect(activeOnly[0].levelName).toBe('上架')
    })

    it('updateVipLevel — 更新 name/price/durationDays/status', async () => {
      const level = await createVipLevel({
        levelName: '原名称',
        levelValue: 1,
        price: 100,
        durationDays: 30,
        benefits: [],
      })
      await updateVipLevel(level.id, {
        levelName: '新名称',
        price: 200,
        durationDays: 60,
        status: 0,
      })

      const found = await findVipLevel(level.id)
      expect(found!.levelName).toBe('新名称')
      expect(found!.price).toBe(200)
      expect(found!.durationDays).toBe(60)
      expect(found!.status).toBe(0)
    })

    it('deleteVipLevel — 删除后查不到', async () => {
      const level = await createVipLevel({
        levelName: '待删除',
        levelValue: 1,
        price: 100,
        durationDays: 30,
        benefits: [],
      })
      await deleteVipLevel(level.id)
      const found = await findVipLevel(level.id)
      expect(found).toBeUndefined()
    })
  })

  describe('User VIP — purchaseVip + getMyVip', () => {
    it('purchaseVip — 创建订阅记录 + 更新 users.isVip', async () => {
      const user = await createTestUser('13900000001')
      const level = await createVipLevel({
        levelName: '月度VIP',
        levelValue: 1,
        price: 3000,
        durationDays: 30,
        benefits: [],
      })

      await purchaseVip({ userId: user.id, vipLevelId: level.id })

      // users.isVip 应被更新为 level.levelValue
      const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id))
      expect(updatedUser.isVip).toBe(1)

      // user_vips 表应有一条记录
      const vips = await db.select().from(userVips).where(eq(userVips.userId, user.id))
      expect(vips).toHaveLength(1)
      expect(vips[0].status).toBe(1)
      expect(vips[0].levelValue).toBe(1)
      expect(vips[0].endTime.getTime() - vips[0].startTime.getTime()).toBe(30 * 86400_000)
    })

    it('getMyVip — 返回当前生效的 VIP 订阅(含 levelName)', async () => {
      const user = await createTestUser('13900000002')
      const level = await createVipLevel({
        levelName: '年度VIP',
        levelValue: 2,
        price: 30000,
        durationDays: 365,
        benefits: ['专属客服'],
      })
      await purchaseVip({ userId: user.id, vipLevelId: level.id })

      const myVip = await getMyVip(user.id)
      expect(myVip).toBeDefined()
      expect(myVip!.levelName).toBe('年度VIP')
      expect(myVip!.userVip.status).toBe(1)
      expect(myVip!.userVip.levelValue).toBe(2)
    })

    it('getMyVip — 过期订阅不返回(status=0)', async () => {
      const user = await createTestUser('13900000003')
      const level = await createVipLevel({
        levelName: '月度VIP',
        levelValue: 1,
        price: 3000,
        durationDays: 30,
        benefits: [],
      })
      await purchaseVip({ userId: user.id, vipLevelId: level.id })

      // 手动将 status 改为 0(过期)
      await db.update(userVips).set({ status: 0 }).where(eq(userVips.userId, user.id))

      const myVip = await getMyVip(user.id)
      expect(myVip).toBeUndefined()
    })

    it('getMyVip — endTime 已过期的订阅不返回(即使 status=1)', async () => {
      const user = await createTestUser('13900000004')
      const level = await createVipLevel({
        levelName: '短效VIP',
        levelValue: 1,
        price: 100,
        durationDays: 1,
        benefits: [],
      })
      await purchaseVip({ userId: user.id, vipLevelId: level.id })

      // 手动将 endTime 改为过去时间
      const pastTime = new Date(Date.now() - 86400_000)
      await db.update(userVips).set({ endTime: pastTime }).where(eq(userVips.userId, user.id))

      const myVip = await getMyVip(user.id)
      expect(myVip).toBeUndefined()
    })

    it('getMyVip — 无订阅返回 undefined', async () => {
      const user = await createTestUser('13900000005')
      const myVip = await getMyVip(user.id)
      expect(myVip).toBeUndefined()
    })
  })

  describe('listUserVips — 分页 + 按 userId 过滤', () => {
    it('返回指定用户的订阅列表', async () => {
      const user1 = await createTestUser('13900000006')
      const user2 = await createTestUser('13900000007')
      const level = await createVipLevel({
        levelName: 'VIP',
        levelValue: 1,
        price: 100,
        durationDays: 30,
        benefits: [],
      })
      await purchaseVip({ userId: user1.id, vipLevelId: level.id })
      await purchaseVip({ userId: user2.id, vipLevelId: level.id })

      const r1 = await listUserVips(1, 10, user1.id)
      expect(r1.items).toHaveLength(1)
      expect(r1.total).toBe(1)
      expect(r1.items[0].userId).toBe(user1.id)

      const all = await listUserVips(1, 10)
      expect(all.items).toHaveLength(2)
      expect(all.total).toBe(2)
    })
  })

  describe('purchaseVip — 异常场景', () => {
    it('不存在的 vipLevelId 抛错', async () => {
      const user = await createTestUser('13900000008')
      // 使用合法 UUID 格式但不存在的 ID
      const nonexistentId = '00000000-0000-0000-0000-000000000000'
      await expect(purchaseVip({ userId: user.id, vipLevelId: nonexistentId })).rejects.toThrow(
        'VIP 等级不存在',
      )
    })
  })
})
