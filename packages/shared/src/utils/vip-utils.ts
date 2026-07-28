/**
 * VIP 状态判断纯函数(无副作用,可跨端复用)。
 *
 * 使用场景:
 * - miniapp-taro vip store(stores/vip.ts 的 getVipStatus / isVipActive)
 * - miniapp-taro member 页面剩余天数展示(calcVipRemainDays)
 * - mobile-rn vip screen(未来接入)
 * - web vip page(未来接入)
 *
 * 设计原则:纯函数 + 零依赖 + 防御性(无效日期/空值安全)。
 * 不引入任何外部 import,确保跨端可移植。
 */

/**
 * VIP 存储快照(从 storage / API 响应中读取的部分字段)。
 * 字段均可空,函数内做缺省处理。
 */
export interface VipStatusSnapshot {
  vipExpireTime?: string
  vipLevel?: number
}

/**
 * VIP 状态计算结果。
 */
export interface VipStatusResult {
  isVip: boolean
  level: number
  expireTime: string
}

/**
 * 判断 VIP 是否仍处于有效期内。
 *
 * @param expireTime 过期时间字符串(ISO 或 Date.parse 可识别格式)
 * @returns true=有效;false=空串/无效日期/已过期
 */
export function isVipActive(expireTime: string): boolean {
  if (!expireTime) return false
  const time = new Date(expireTime).getTime()
  if (Number.isNaN(time)) return false
  return time > Date.now()
}

/**
 * 从存储快照计算 VIP 状态(消除 miniapp-taro/vip.ts 的 getVipStatus 重复逻辑)。
 *
 * @param snapshot 存储快照(可空字段)
 * @returns 标准化 VIP 状态(isVip 用 isVipActive 判断,level 默认 0,expireTime 默认空串)
 */
export function getVipStatusFromSnapshot(snapshot: VipStatusSnapshot): VipStatusResult {
  const expireTime = snapshot.vipExpireTime || ''
  return {
    isVip: isVipActive(expireTime),
    level: snapshot.vipLevel || 0,
    expireTime,
  }
}

/**
 * VIP 剩余天数计算(支持秒/毫秒时间戳 + ISO 字符串)。
 *
 * @param expireTime 过期时间:数字(秒或毫秒时间戳)/ ISO 字符串 / null / undefined
 * @returns 剩余天数(向上取整);空值/无效/已过期 → 0
 */
export function calcVipRemainDays(expireTime: string | number | null | undefined): number {
  if (expireTime === null || expireTime === undefined || expireTime === '') return 0
  let ms: number
  if (typeof expireTime === 'number') {
    ms = expireTime > 1e12 ? expireTime : expireTime * 1000
  } else {
    const parsed = Date.parse(expireTime)
    if (Number.isNaN(parsed)) return 0
    ms = parsed
  }
  const diff = ms - Date.now()
  return diff > 0 ? Math.ceil(diff / 86400000) : 0
}
