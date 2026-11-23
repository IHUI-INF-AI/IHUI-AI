// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 每日赠送额度（zcode 式“当天有效”）的只读口径与对外状态。
 *
 * 唯一真相源是 user_points.daily_points(今天还剩) + daily_points_date(归属业务日)；
 * 发放/重置的唯一实现是 db/gamification-queries.ensureDailyCreditRow（懒触发、跨日覆盖、
 * 幂等），本文件只做读封装，不再实现第二份日界或重置逻辑。
 */

import type { UserPoints } from '@ihui/database'
import { DAILY_GRANT_POINTS } from '../constants/daily-credits.js'
import { ensureDailyCreditRow } from '../db/gamification-queries.js'
import { bizDayKey } from '../utils/biz-day.js'

export { DAILY_GRANT_POINTS }

export interface DailyCreditState {
  /** 该额度所属业务日 YYYY-MM-DD（Asia/Shanghai，见 utils/biz-day） */
  date: string
  /** 当天发放总量（当前产品口径 100） */
  granted: number
  /** 当天已用掉 */
  used: number
  /** 当天还剩；跨日归零，不结转 */
  remaining: number
}

/** 积分行 → 今日赠送状态（纯函数：调用方已经拿到对齐后的行时不必再查一次库）。 */
export function dailyCreditStateOf(row: UserPoints, at: Date = new Date()): DailyCreditState {
  const today = bizDayKey(at)
  // 跨日未刷新(或从未发放)的行不得把昨天剩的算成今天可用。
  const aligned = row.dailyPointsDate === today
  const remaining = aligned ? Math.max(0, row.dailyPoints) : 0
  // 脏数据保护：历史行若 remaining 反而大于常量，按 remaining 抬 granted，used 不为负。
  const granted = aligned ? Math.max(DAILY_GRANT_POINTS, remaining) : DAILY_GRANT_POINTS
  return {
    date: aligned ? today : (row.dailyPointsDate ?? today),
    granted,
    // 未对齐 = 今天还没发也没用，used 必须为 0（不能拿 granted - remaining 推成 100）。
    used: aligned ? granted - remaining : 0,
    remaining,
  }
}

/** 今日赠送额度状态（读前先对齐业务日，离线一天回来也只会拿到当天那一份）。 */
export async function getDailyCreditState(
  userId: string,
  at: Date = new Date(),
): Promise<DailyCreditState> {
  return dailyCreditStateOf(await ensureDailyCreditRow(userId, at), at)
}

export interface SpendableBalance {
  /** 永久/充值余额（不随日界变化） */
  permanent: number
  /** 今日赠送剩余（消费优先从这里扣，跨日作废） */
  daily: number
  /** 余额预检实际可用的总额 = permanent + daily */
  available: number
}

/**
 * 可消费余额（余额预检与用户可见余额的唯一口径）。
 * 任何“够不够付这笔”的判断都必须用它，只读 permanent 会把每天 100 的赠送挡在门外。
 */
export async function getSpendableBalance(
  userId: string,
  at: Date = new Date(),
): Promise<SpendableBalance> {
  const row = await ensureDailyCreditRow(userId, at)
  const permanent = Math.max(0, row.points)
  const daily = Math.max(0, row.dailyPoints)
  return { permanent, daily, available: permanent + daily }
}

/** 积分行 → 总可用；口径与 spend 的 balance_after 一致（跨日未刷新的赠送额不计入）。 */
export function availableOf(
  row: Pick<UserPoints, 'points' | 'dailyPoints' | 'dailyPointsDate'>,
  at: Date = new Date(),
): number {
  const permanent = Math.max(0, row.points)
  const daily = row.dailyPointsDate === bizDayKey(at) ? Math.max(0, row.dailyPoints) : 0
  return permanent + daily
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
