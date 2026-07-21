/**
 * 签到业务共享工具函数。
 * 统一所有签到路由的奖励计算 + 日期处理逻辑,消除 5 处重复定义。
 */

/** 签到奖励:第1天10分,逐日+5,第7天起50分封顶 */
export function calcSignInReward(consecutiveDays: number): number {
  if (consecutiveDays >= 7) return 50
  return 10 + (consecutiveDays - 1) * 5
}

/** 返回今日日期字符串 YYYY-MM-DD(UTC) */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 日期偏移:days 为正向后,为负向前(基于 UTC) */
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
