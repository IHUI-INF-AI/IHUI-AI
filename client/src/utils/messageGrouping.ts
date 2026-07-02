/**
 * 消息分组工具
 * 用于对消息按日期进行分组显示
 */

/**
 * 日期标签类型
 */
export type DateLabel = '今天' | '昨天' | '本周' | '本月' | '更早'

/**
 * 获取日期标签
 * @param timestamp 时间戳
 */
export function getDateLabel(timestamp: number): DateLabel {
  const date = new Date(timestamp)
  const now = new Date()

  // 重置时间部分，只比较日期
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffDays = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return '今天'
  } else if (diffDays === 1) {
    return '昨天'
  } else if (diffDays < 7) {
    return '本周'
  } else if (diffDays < 30) {
    return '本月'
  } else {
    return '更早'
  }
}
