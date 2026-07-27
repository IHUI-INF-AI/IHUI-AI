/**
 * VIP 4 档等级 seed 脚本(AGENTS.md §24 P0-2a)。
 *
 * 用法:
 *   pnpm --filter @ihui/api tsx scripts/seed-vip-levels.ts
 *
 * 行为:
 * 1. 按 levelValue(0/1/2/3)upsert 4 档 VIP(免费/个人/团队/企业)
 * 2. benefits 写入完整 VipPlanQuota 结构(与 plan-entitlement-service DEFAULT_PLAN_QUOTAS 对齐)
 * 3. 不存在则插入,存在则更新 levelName/price/benefits/sortOrder/status
 *
 * 价格(月付,单位:分):
 *   0=免费 0 / 1=个人 ¥29(2900) / 2=团队 ¥99(9900) / 3=企业 ¥499(49900)
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { vipLevels } from '@ihui/database'
import { eq } from 'drizzle-orm'

interface SeedLevel {
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  sortOrder: number
  benefits: Record<string, unknown>
}

const SEED_LEVELS: SeedLevel[] = [
  {
    levelName: '免费版',
    levelValue: 0,
    price: 0,
    durationDays: 3650,
    sortOrder: 0,
    benefits: {
      dailyTokenLimit: 10_000,
      monthlyTokenLimit: 100_000,
      dailyCostLimit: 1.0,
      monthlyCostLimit: 10.0,
      apiQps: 5,
      concurrency: 2,
      modelWhitelist: [],
    },
  },
  {
    levelName: '个人版',
    levelValue: 1,
    price: 2900,
    durationDays: 30,
    sortOrder: 1,
    benefits: {
      dailyTokenLimit: 500_000,
      monthlyTokenLimit: 10_000_000,
      dailyCostLimit: 50.0,
      monthlyCostLimit: 500.0,
      apiQps: 20,
      concurrency: 10,
      modelWhitelist: [],
    },
  },
  {
    levelName: '团队版',
    levelValue: 2,
    price: 9900,
    durationDays: 30,
    sortOrder: 2,
    benefits: {
      dailyTokenLimit: 2_000_000,
      monthlyTokenLimit: 50_000_000,
      dailyCostLimit: 200.0,
      monthlyCostLimit: 2000.0,
      apiQps: 60,
      concurrency: 50,
      modelWhitelist: [],
    },
  },
  {
    levelName: '企业版',
    levelValue: 3,
    price: 49900,
    durationDays: 30,
    sortOrder: 3,
    benefits: {
      dailyTokenLimit: 10_000_000,
      monthlyTokenLimit: 200_000_000,
      dailyCostLimit: 1000.0,
      monthlyCostLimit: 10_000.0,
      apiQps: 200,
      concurrency: 200,
      modelWhitelist: [],
    },
  },
]

async function main() {
  console.info('[seed-vip-levels] 开始 seed VIP 4 档等级...')
  let inserted = 0
  let updated = 0

  for (const level of SEED_LEVELS) {
    const [existing] = await db
      .select({ id: vipLevels.id })
      .from(vipLevels)
      .where(eq(vipLevels.levelValue, level.levelValue))
      .limit(1)

    if (existing) {
      await db
        .update(vipLevels)
        .set({
          levelName: level.levelName,
          price: level.price,
          durationDays: level.durationDays,
          benefits: level.benefits,
          sortOrder: level.sortOrder,
          status: 1,
          updatedAt: new Date(),
        })
        .where(eq(vipLevels.id, existing.id))
      updated++
      console.info(`  [update] levelValue=${level.levelValue} ${level.levelName} ¥${level.price / 100}/月`)
    } else {
      await db.insert(vipLevels).values({
        levelName: level.levelName,
        levelValue: level.levelValue,
        price: level.price,
        durationDays: level.durationDays,
        benefits: level.benefits,
        status: 1,
        sortOrder: level.sortOrder,
      })
      inserted++
      console.info(`  [insert] levelValue=${level.levelValue} ${level.levelName} ¥${level.price / 100}/月`)
    }
  }

  console.info(`[seed-vip-levels] 完成:新增 ${inserted} 档,更新 ${updated} 档`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-vip-levels] 失败:', err)
  process.exit(1)
})
