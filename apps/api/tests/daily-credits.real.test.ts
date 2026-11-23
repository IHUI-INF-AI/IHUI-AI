// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 每日赠送额度（zcode 式“当天有效”）的真实 DB 集成测试。
 * 归属 real 面（pnpm test:real，前置 apps/api/.env.test 指向 ihui_test），
 * 不进默认测试面 —— 它要真建 user_points 行并真跑原子 UPDATE 语义。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '@ihui/database'
import { ensureDailyCreditRow } from '../src/db/gamification-queries.js'
import {
  DAILY_GRANT_POINTS,
  getDailyCreditState,
  getSpendableBalance,
} from '../src/services/daily-credits.js'
import { spendPoints } from '../src/services/points-service.js'
import { bizDayKey } from '../src/utils/biz-day.js'

async function createTestUser(phone: string) {
  const [row] = await db.insert(users).values({ phone }).returning()
  if (!row) throw new Error('daily-credits.real.test.ts: 插入用户未返回行')
  return row
}

/** 直接写夹具：绕过 ensure，构造“已用掉一部分 / 跨日残留”的起始态。 */
async function setDailyState(
  userId: string,
  state: { points?: number; dailyPoints: number; date: string | null },
) {
  await db.execute(sql`
    UPDATE user_points
    SET points = ${state.points ?? 0},
        daily_points = ${state.dailyPoints},
        daily_points_date = ${state.date}
    WHERE user_id = ${userId}
  `)
}

describe('每日赠送额度 — 真实 DB 语义', () => {
  beforeEach(async () => {
    await db.execute(sql`DELETE FROM point_transactions`)
    await db.execute(sql`DELETE FROM user_points`)
    await db.execute(sql`DELETE FROM users WHERE is_system_admin = false`)
  })

  it('当天首次调用即发放 100，且不写进 total_earned / experience', async () => {
    const user = await createTestUser('13911110001')
    const row = await ensureDailyCreditRow(user.id, new Date('2026-11-23T02:00:00Z'))
    expect(row.dailyPoints).toBe(DAILY_GRANT_POINTS)
    // 2026-11-23T02:00Z = 上海 10:00，日键就是 11-23
    expect(row.dailyPointsDate).toBe('2026-11-23')
    expect(row.points).toBe(0)
    expect(row.totalEarned).toBe(0)
    expect(row.experience).toBe(0)
  })

  it('同日重复调用幂等：不累加、也不覆盖已用掉的剩余', async () => {
    const user = await createTestUser('13911110002')
    const day = new Date('2026-11-23T02:00:00Z')
    await ensureDailyCreditRow(user.id, day)
    await setDailyState(user.id, { dailyPoints: 40, date: '2026-11-23' })

    const again = await ensureDailyCreditRow(user.id, day)
    expect(again.dailyPoints).toBe(40)
    expect(again.dailyPointsDate).toBe('2026-11-23')
  })

  it('跨日直接覆盖为 100：昨天的剩余不结转', async () => {
    const user = await createTestUser('13911110003')
    await ensureDailyCreditRow(user.id, new Date('2026-11-22T02:00:00Z'))
    await setDailyState(user.id, { dailyPoints: 40, date: '2026-11-22' })

    const nextDay = await ensureDailyCreditRow(user.id, new Date('2026-11-23T02:00:00Z'))
    expect(nextDay.dailyPoints).toBe(DAILY_GRANT_POINTS)
    expect(nextDay.dailyPointsDate).toBe('2026-11-23')
  })

  it('消费顺序：先扣赠送、再扣永久余额（流水记总可用余额）', async () => {
    const user = await createTestUser('13911110004')
    await ensureDailyCreditRow(user.id)
    await setDailyState(user.id, { points: 500, dailyPoints: 100, date: bizDayKey() })

    const result = await spendPoints(user.id, 150, 'ai_call', 'test-consume')
    expect(result.points.dailyPoints).toBe(0)
    expect(result.points.points).toBe(450)
    // total_spent 只累计永久余额扣减（50），赠送额度属平台补贴不进财务口径
    expect(result.points.totalSpent).toBe(50)
    expect(result.transaction.amount).toBe(-150)
    expect(result.transaction.balanceAfter).toBe(450)
  })

  it('赠送额度够付时永久余额一分不动', async () => {
    const user = await createTestUser('13911110005')
    await ensureDailyCreditRow(user.id)
    await setDailyState(user.id, { points: 0, dailyPoints: 100, date: bizDayKey() })

    const result = await spendPoints(user.id, 60, 'ai_call', 'test-daily-only')
    expect(result.points.points).toBe(0)
    expect(result.points.dailyPoints).toBe(40)
    expect(result.points.totalSpent).toBe(0)
    expect(result.transaction.balanceAfter).toBe(40)
  })

  it('总可用不足时才报余额不足（赠送也算可花额度）', async () => {
    const user = await createTestUser('13911110006')
    await ensureDailyCreditRow(user.id)
    await setDailyState(user.id, { points: 0, dailyPoints: 10, date: bizDayKey() })

    await expect(spendPoints(user.id, 20, 'ai_call', 'test-insufficient')).rejects.toThrow(
      '积分余额不足',
    )
    // 失败必须无副作用：剩余 10 原样还在
    const after = await ensureDailyCreditRow(user.id)
    expect(after.dailyPoints).toBe(10)
    expect(after.points).toBe(0)
  })

  it('余额预检口径包含今日赠送；状态接口回报 used/remaining', async () => {
    const user = await createTestUser('13911110007')
    await ensureDailyCreditRow(user.id)
    await setDailyState(user.id, { points: 500, dailyPoints: 30, date: bizDayKey() })

    const balance = await getSpendableBalance(user.id)
    expect(balance).toEqual({ permanent: 500, daily: 30, available: 530 })

    const state = await getDailyCreditState(user.id)
    expect(state.remaining).toBe(30)
    expect(state.granted).toBe(DAILY_GRANT_POINTS)
    expect(state.used).toBe(DAILY_GRANT_POINTS - 30)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
