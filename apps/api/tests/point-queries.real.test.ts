import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import {
  createChannel,
  findChannelById,
  findAllActiveChannels,
  findChannels,
  updateChannel,
  deleteChannel,
  createPoint,
  findPointById,
  findPoints,
  updatePoint,
  deletePoint,
  updatePointRelations,
  findRelations,
  findRecords,
  findUserPointsBalance,
} from '../src/db/point-queries.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  return row
}

describe('point-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空
    await db.execute(sql`DELETE FROM edu_point_records`)
    await db.execute(sql`DELETE FROM edu_point_channel_relations`)
    await db.execute(sql`DELETE FROM edu_points`)
    await db.execute(sql`DELETE FROM edu_point_channels`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('Channels 积分渠道', () => {
    it('createChannel + findChannelById', async () => {
      const channel = await createChannel({ name: '签到渠道', code: 'signin', sort: 1 })
      expect(channel.id).toBeDefined()
      expect(channel.name).toBe('签到渠道')
      expect(channel.code).toBe('signin')
      expect(channel.sort).toBe(1)
      expect(channel.status).toBe(1)

      const found = await findChannelById(channel.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('签到渠道')
    })

    it('findAllActiveChannels — 只返回 status=1', async () => {
      await createChannel({ name: '启用渠道', status: 1 })
      await createChannel({ name: '禁用渠道', status: 0 })

      const active = await findAllActiveChannels()
      expect(active).toHaveLength(1)
      expect(active[0].name).toBe('启用渠道')
    })

    it('findChannels — 按 name 模糊搜索 + status 过滤 + 分页', async () => {
      await createChannel({ name: '签到渠道', status: 1 })
      await createChannel({ name: '分享渠道', status: 1 })
      await createChannel({ name: '禁用渠道', status: 0 })

      const byName = await findChannels({ page: 1, pageSize: 10, name: '签' })
      expect(byName.total).toBe(1)
      expect(byName.list[0].name).toBe('签到渠道')

      const byStatus = await findChannels({ page: 1, pageSize: 10, status: 0 })
      expect(byStatus.total).toBe(1)
      expect(byStatus.list[0].name).toBe('禁用渠道')

      const page1 = await findChannels({ page: 1, pageSize: 2 })
      expect(page1.list).toHaveLength(2)
      expect(page1.total).toBe(3)
    })

    it('updateChannel — 更新 name/code/sort/status', async () => {
      const channel = await createChannel({ name: '原名称' })
      const updated = await updateChannel(channel.id, {
        name: '新名称',
        code: 'new-code',
        sort: 5,
        status: 0,
      })
      expect(updated).toBeDefined()
      expect(updated!.name).toBe('新名称')
      expect(updated!.code).toBe('new-code')
      expect(updated!.sort).toBe(5)
      expect(updated!.status).toBe(0)
    })

    it('deleteChannel — 删除后查不到', async () => {
      const channel = await createChannel({ name: '待删除' })
      await deleteChannel(channel.id)
      const found = await findChannelById(channel.id)
      expect(found).toBeUndefined()
    })
  })

  describe('Points 积分规则', () => {
    it('createPoint + findPointById — 默认值 point=0/sort=0/status=1', async () => {
      const point = await createPoint({ name: '每日签到' })
      expect(point.id).toBeDefined()
      expect(point.point).toBe(0)
      expect(point.sort).toBe(0)
      expect(point.status).toBe(1)
      expect(point.channelId).toBeNull()

      const found = await findPointById(point.id)
      expect(found).toBeDefined()
      expect(found!.name).toBe('每日签到')
    })

    it('createPoint 带 channelId — 关联渠道', async () => {
      const channel = await createChannel({ name: '渠道A' })
      const point = await createPoint({ name: '规则A', channelId: channel.id, point: 10 })
      expect(point.channelId).toBe(channel.id)
      expect(point.point).toBe(10)
    })

    it('findPoints — 按 name/channelId/status 过滤', async () => {
      const channel = await createChannel({ name: '渠道A' })
      await createPoint({ name: '签到规则', channelId: channel.id, status: 1 })
      await createPoint({ name: '分享规则', channelId: channel.id, status: 1 })
      await createPoint({ name: '禁用规则', status: 0 })

      const byName = await findPoints({ page: 1, pageSize: 10, name: '签' })
      expect(byName.total).toBe(1)
      expect(byName.list[0].name).toBe('签到规则')

      const byChannel = await findPoints({ page: 1, pageSize: 10, channelId: channel.id })
      expect(byChannel.total).toBe(2)

      const byStatus = await findPoints({ page: 1, pageSize: 10, status: 0 })
      expect(byStatus.total).toBe(1)
      expect(byStatus.list[0].name).toBe('禁用规则')
    })

    it('updatePoint — 更新 point 值和 status', async () => {
      const point = await createPoint({ name: '规则', point: 5 })
      const updated = await updatePoint(point.id, { point: 20, status: 0 })
      expect(updated).toBeDefined()
      expect(updated!.point).toBe(20)
      expect(updated!.status).toBe(0)
    })

    it('deletePoint — 删除后级联删除关联的 channel_relations', async () => {
      const channel = await createChannel({ name: '渠道' })
      const point = await createPoint({ name: '规则', channelId: channel.id })
      await updatePointRelations(point.id, [channel.id])

      await deletePoint(point.id)
      const found = await findPointById(point.id)
      expect(found).toBeUndefined()

      // 关联表应级联删除
      const rels = await findRelations({ page: 1, pageSize: 10, pointId: point.id })
      expect(rels.total).toBe(0)
    })
  })

  describe('Relations 渠道关联', () => {
    it('updatePointRelations — 全量覆盖关联', async () => {
      const ch1 = await createChannel({ name: '渠道1' })
      const ch2 = await createChannel({ name: '渠道2' })
      const ch3 = await createChannel({ name: '渠道3' })
      const point = await createPoint({ name: '规则' })

      // 初始关联 ch1 + ch2
      await updatePointRelations(point.id, [ch1.id, ch2.id])
      const r1 = await findRelations({ page: 1, pageSize: 10, pointId: point.id })
      expect(r1.total).toBe(2)

      // 覆盖为 ch2 + ch3(应先删除旧的再插入新的)
      await updatePointRelations(point.id, [ch2.id, ch3.id])
      const r2 = await findRelations({ page: 1, pageSize: 10, pointId: point.id })
      expect(r2.total).toBe(2)
      const channelIds = r2.list.map((r) => r.channelId).sort()
      expect(channelIds).toEqual([ch2.id, ch3.id].sort())
    })

    it('updatePointRelations — 空数组清空所有关联', async () => {
      const ch = await createChannel({ name: '渠道' })
      const point = await createPoint({ name: '规则' })
      await updatePointRelations(point.id, [ch.id])
      expect((await findRelations({ page: 1, pageSize: 10, pointId: point.id })).total).toBe(1)

      await updatePointRelations(point.id, [])
      expect((await findRelations({ page: 1, pageSize: 10, pointId: point.id })).total).toBe(0)
    })

    it('联合唯一约束 — 同一 pointId + channelId 不重复', async () => {
      const ch = await createChannel({ name: '渠道' })
      const point = await createPoint({ name: '规则' })

      await updatePointRelations(point.id, [ch.id])
      // 再次插入相同的 pointId + channelId 应触发唯一约束
      await expect(
        db.execute(
          sql`INSERT INTO edu_point_channel_relations (point_id, channel_id) VALUES (${point.id}, ${ch.id})`,
        ),
      ).rejects.toThrow()
    })
  })

  describe('Records 积分记录 + 余额查询', () => {
    it('findRecords — 按 memberId 和 type 过滤', async () => {
      const user = await createTestUser('13900000001')
      await db.execute(
        sql`INSERT INTO edu_point_records (member_id, point, balance, type, description) VALUES (${user.id}, 10, 10, 'earn', '签到')`,
      )
      await db.execute(
        sql`INSERT INTO edu_point_records (member_id, point, balance, type, description) VALUES (${user.id}, -5, 5, 'spend', '兑换')`,
      )

      const all = await findRecords({ page: 1, pageSize: 10, memberId: user.id })
      expect(all.total).toBe(2)

      const earnOnly = await findRecords({ page: 1, pageSize: 10, memberId: user.id, type: 'earn' })
      expect(earnOnly.total).toBe(1)
      expect(earnOnly.list[0].point).toBe(10)
    })

    it('findUserPointsBalance — 取最新一条记录的 balance', async () => {
      const user = await createTestUser('13900000002')
      // 无记录返回 0
      expect(await findUserPointsBalance(user.id)).toBe(0)

      // 插入 3 条记录,balance 递增
      await db.execute(
        sql`INSERT INTO edu_point_records (member_id, point, balance, type, description) VALUES (${user.id}, 10, 10, 'earn', '第一次')`,
      )
      await db.execute(
        sql`INSERT INTO edu_point_records (member_id, point, balance, type, description) VALUES (${user.id}, 20, 30, 'earn', '第二次')`,
      )
      await db.execute(
        sql`INSERT INTO edu_point_records (member_id, point, balance, type, description) VALUES (${user.id}, -5, 25, 'spend', '兑换')`,
      )

      // 最新一条 balance=25
      expect(await findUserPointsBalance(user.id)).toBe(25)
    })
  })
})
