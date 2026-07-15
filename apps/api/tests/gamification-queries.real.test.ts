import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, levels } from '@ihui/database'
import {
  findUserPoints,
  ensureUserPoints,
  setUserLevel,
  adjustPoints,
  findPointTransactions,
  findSignInRecord,
  createSignInRecord,
  calculateConsecutiveDays,
  findSignInHistory,
  findRecentSignInRecords,
  findLevels,
  findLevelByExperience,
  findCurrentLevel,
  findLeaderboard,
  shiftDate,
} from '../src/db/gamification-queries.js'

async function createTestUser(phone: string, nickname?: string) {
  const [row] = await db.insert(users).values({ phone, nickname }).returning()
  return row
}

describe('gamification-queries — 真实 DB 集成测试', () => {
  beforeEach(async () => {
    // 按外键依赖顺序清空
    await db.execute(sql`DELETE FROM point_transactions`)
    await db.execute(sql`DELETE FROM sign_in_records`)
    await db.execute(sql`DELETE FROM user_points`)
    await db.execute(sql`DELETE FROM levels`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  describe('User Points 用户积分', () => {
    it('findUserPoints — 无记录返回 undefined', async () => {
      const user = await createTestUser('13900000001')
      const points = await findUserPoints(user.id)
      expect(points).toBeUndefined()
    })

    it('ensureUserPoints — 不存在则创建,已存在则返回现有', async () => {
      const user = await createTestUser('13900000002')
      const points1 = await ensureUserPoints(user.id)
      expect(points1.userId).toBe(user.id)
      expect(points1.points).toBe(0)
      expect(points1.totalEarned).toBe(0)
      expect(points1.totalSpent).toBe(0)
      expect(points1.level).toBe(1) // schema 默认 level=1
      expect(points1.experience).toBe(0)

      // 再次调用应返回现有记录(id 相同)
      const points2 = await ensureUserPoints(user.id)
      expect(points2.id).toBe(points1.id)
    })

    it('setUserLevel — 仅更新 level 字段', async () => {
      const user = await createTestUser('13900000003')
      await ensureUserPoints(user.id)
      await setUserLevel(user.id, 3)

      const points = await findUserPoints(user.id)
      expect(points!.level).toBe(3)
      // 其他字段不变
      expect(points!.points).toBe(0)
    })
  })

  describe('adjustPoints 积分调整 — 事务原子性', () => {
    it('earn — 增加积分 + 累计 + 经验,写入流水', async () => {
      const user = await createTestUser('13900000004')
      const result = await adjustPoints({
        userId: user.id,
        type: 'earn',
        amount: 50,
        source: 'signin',
        description: '每日签到',
      })

      expect(result.points.points).toBe(50)
      expect(result.points.totalEarned).toBe(50)
      expect(result.points.experience).toBe(50)
      expect(result.transaction.type).toBe('earn')
      expect(result.transaction.amount).toBe(50)
      expect(result.transaction.balanceAfter).toBe(50)
      expect(result.transaction.source).toBe('signin')
    })

    it('spend — 扣减积分 + 累计消费,流水金额为负', async () => {
      const user = await createTestUser('13900000005')
      // 先赚 100
      await adjustPoints({ userId: user.id, type: 'earn', amount: 100, source: 'task' })
      // 再花 30
      const result = await adjustPoints({
        userId: user.id,
        type: 'spend',
        amount: 30,
        source: 'redeem',
      })

      expect(result.points.points).toBe(70)
      expect(result.points.totalEarned).toBe(100)
      expect(result.points.totalSpent).toBe(30)
      expect(result.transaction.type).toBe('spend')
      expect(result.transaction.amount).toBe(-30)
      expect(result.transaction.balanceAfter).toBe(70)
    })

    it('spend — 余额不足抛错', async () => {
      const user = await createTestUser('13900000006')
      await expect(
        adjustPoints({ userId: user.id, type: 'spend', amount: 100, source: 'test' }),
      ).rejects.toThrow('积分余额不足')
    })

    it('amount=0 抛错', async () => {
      const user = await createTestUser('13900000007')
      await expect(
        adjustPoints({ userId: user.id, type: 'earn', amount: 0, source: 'test' }),
      ).rejects.toThrow('调整积分数不能为 0')
    })

    it('连续 earn — 余额和流水正确累积', async () => {
      const user = await createTestUser('13900000008')
      await adjustPoints({ userId: user.id, type: 'earn', amount: 10, source: 'a' })
      await adjustPoints({ userId: user.id, type: 'earn', amount: 20, source: 'b' })
      const r3 = await adjustPoints({ userId: user.id, type: 'earn', amount: 30, source: 'c' })

      expect(r3.points.points).toBe(60)
      expect(r3.points.totalEarned).toBe(60)
      expect(r3.points.experience).toBe(60)

      // 流水应有 3 条
      const txs = await findPointTransactions({ userId: user.id, page: 1, pageSize: 10 })
      expect(txs.total).toBe(3)
      // 按时间倒序,最新 balanceAfter=60
      expect(Number(txs.list[0].balanceAfter)).toBe(60)
      expect(Number(txs.list[2].balanceAfter)).toBe(10)
    })
  })

  describe('findPointTransactions — 流水查询', () => {
    it('按 type 和 source 过滤 + 分页', async () => {
      const user = await createTestUser('13900000009')
      await adjustPoints({ userId: user.id, type: 'earn', amount: 100, source: 'signin' })
      await adjustPoints({ userId: user.id, type: 'earn', amount: 50, source: 'task' })
      await adjustPoints({ userId: user.id, type: 'spend', amount: 30, source: 'redeem' })

      const all = await findPointTransactions({ userId: user.id, page: 1, pageSize: 10 })
      expect(all.total).toBe(3)

      const earnOnly = await findPointTransactions({
        userId: user.id,
        page: 1,
        pageSize: 10,
        type: 'earn',
      })
      expect(earnOnly.total).toBe(2)

      const signinOnly = await findPointTransactions({
        userId: user.id,
        page: 1,
        pageSize: 10,
        source: 'signin',
      })
      expect(signinOnly.total).toBe(1)

      const page1 = await findPointTransactions({ userId: user.id, page: 1, pageSize: 2 })
      expect(page1.list).toHaveLength(2)
      expect(page1.total).toBe(3)
    })
  })

  describe('Sign-in 签到', () => {
    it('createSignInRecord + findSignInRecord', async () => {
      const user = await createTestUser('13900000010')
      const record = await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-15',
        consecutiveDays: 3,
        rewardPoints: 10,
      })
      expect(record.id).toBeDefined()
      expect(record.consecutiveDays).toBe(3)
      expect(record.rewardPoints).toBe(10)

      const found = await findSignInRecord(user.id, '2026-07-15')
      expect(found).toBeDefined()
      expect(found!.consecutiveDays).toBe(3)
    })

    it('calculateConsecutiveDays — 昨日有记录则 +1', async () => {
      const user = await createTestUser('13900000011')
      // 昨日签到
      const yesterday = shiftDate('2026-07-15', -1)
      await createSignInRecord({
        userId: user.id,
        signInDate: yesterday,
        consecutiveDays: 2,
        rewardPoints: 5,
      })

      const days = await calculateConsecutiveDays(user.id, '2026-07-15')
      expect(days).toBe(3) // 2 + 1
    })

    it('calculateConsecutiveDays — 昨日无记录则重置为 1', async () => {
      const user = await createTestUser('13900000012')
      const days = await calculateConsecutiveDays(user.id, '2026-07-15')
      expect(days).toBe(1)
    })

    it('findSignInHistory — 按 yearMonth 过滤', async () => {
      const user = await createTestUser('13900000013')
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-01',
        consecutiveDays: 1,
        rewardPoints: 5,
      })
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-15',
        consecutiveDays: 15,
        rewardPoints: 10,
      })
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-06-30',
        consecutiveDays: 30,
        rewardPoints: 20,
      })

      const july = await findSignInHistory({
        userId: user.id,
        page: 1,
        pageSize: 10,
        yearMonth: '2026-07',
      })
      expect(july.total).toBe(2)

      const all = await findSignInHistory({ userId: user.id, page: 1, pageSize: 10 })
      expect(all.total).toBe(3)
    })

    it('findRecentSignInRecords — 区间查询(升序)', async () => {
      const user = await createTestUser('13900000014')
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-13',
        consecutiveDays: 1,
        rewardPoints: 5,
      })
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-14',
        consecutiveDays: 2,
        rewardPoints: 5,
      })
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-15',
        consecutiveDays: 3,
        rewardPoints: 10,
      })
      await createSignInRecord({
        userId: user.id,
        signInDate: '2026-07-20',
        consecutiveDays: 1,
        rewardPoints: 5,
      })

      // 查 7-13 ~ 7-16 区间
      const records = await findRecentSignInRecords(user.id, '2026-07-13', '2026-07-16')
      expect(records).toHaveLength(3)
      // 升序
      expect(records[0].signInDate).toBe('2026-07-13')
      expect(records[2].signInDate).toBe('2026-07-15')
    })
  })

  describe('Levels 等级', () => {
    it('findLevels — DB 无数据时使用默认 5 级', async () => {
      const all = await findLevels()
      expect(all).toHaveLength(5)
      expect(all[0].name).toBe('新手')
      expect(all[4].name).toBe('大师')
    })

    it('findLevels — DB 有数据时返回 DB 数据', async () => {
      await db.insert(levels).values([
        { level: 1, name: '自定义新手', minExperience: 0, maxExperience: 99 },
        { level: 2, name: '自定义高手', minExperience: 100, maxExperience: 999 },
      ])

      const all = await findLevels()
      expect(all).toHaveLength(2)
      expect(all[0].name).toBe('自定义新手')
    })

    it('findLevelByExperience — 返回对应经验值的等级', async () => {
      const lv0 = await findLevelByExperience(0)
      expect(lv0.level).toBe(1)
      expect(lv0.name).toBe('新手')

      const lv100 = await findLevelByExperience(100)
      expect(lv100.level).toBe(2)

      const lv500 = await findLevelByExperience(500)
      expect(lv500.level).toBe(3)

      const lv5000 = await findLevelByExperience(5000)
      expect(lv5000.level).toBe(5)
    })

    it('findCurrentLevel — 返回当前等级 + 下一等级 + 进度', async () => {
      const info = await findCurrentLevel(250)
      expect(info.current.level).toBe(2) // 100-499 范围
      expect(info.next).toBeDefined()
      expect(info.next!.level).toBe(3)
      expect(info.experience).toBe(250)
      // 进度 = (250 - 100) / (500 - 100) = 0.375
      expect(info.progress).toBeCloseTo(0.375, 2)
    })

    it('findCurrentLevel — 最高等级时 next=null', async () => {
      const info = await findCurrentLevel(10000)
      expect(info.current.level).toBe(5)
      expect(info.next).toBeNull()
      // 最高等级 maxExperience=MAX_SAFE_INTEGER,experience=10000 时 progress 接近 0
      // progress = (10000 - 5000) / (MAX_SAFE_INTEGER - 5000) ≈ 5.55e-13
      expect(info.progress).toBeGreaterThanOrEqual(0)
      expect(info.progress).toBeLessThanOrEqual(1)
      expect(info.progress).toBeLessThan(0.001)
    })
  })

  describe('Leaderboard 排行榜', () => {
    it('按积分降序返回用户排名', async () => {
      const user1 = await createTestUser('13900000015', '用户A')
      const user2 = await createTestUser('13900000016', '用户B')
      const user3 = await createTestUser('13900000017', '用户C')

      await adjustPoints({ userId: user1.id, type: 'earn', amount: 100, source: 'test' })
      await adjustPoints({ userId: user2.id, type: 'earn', amount: 300, source: 'test' })
      await adjustPoints({ userId: user3.id, type: 'earn', amount: 200, source: 'test' })

      const leaderboard = await findLeaderboard(10)
      expect(leaderboard).toHaveLength(3)
      // 按积分降序:user2(300) > user3(200) > user1(100)
      expect(leaderboard[0].nickname).toBe('用户B')
      expect(leaderboard[0].points).toBe(300)
      expect(leaderboard[1].nickname).toBe('用户C')
      expect(leaderboard[2].nickname).toBe('用户A')
    })
  })

  describe('shiftDate 日期工具', () => {
    it('正偏移', () => {
      expect(shiftDate('2026-07-15', 1)).toBe('2026-07-16')
      expect(shiftDate('2026-07-15', 10)).toBe('2026-07-25')
    })

    it('负偏移(跨月)', () => {
      expect(shiftDate('2026-07-15', -15)).toBe('2026-06-30')
      expect(shiftDate('2026-07-01', -1)).toBe('2026-06-30')
    })

    it('跨年', () => {
      expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    })
  })
})
