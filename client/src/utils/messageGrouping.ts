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

/**
 * 格式化日期显示
 * @param timestamp 时间戳
 * @param includeTime 是否包含时间
 */
export function formatDate(timestamp: number, includeTime: boolean = false): string {
  const date = new Date(timestamp)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()

  if (isToday && includeTime) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isToday) {
    return '今天'
  }

  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return includeTime
      ? `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : '昨天'
  }

  // 今年
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
    })
  }

  // 往年
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  })
}

/**
 * 消息分组接口
 */
export interface MessageGroup<T> {
  label: DateLabel
  items: T[]
}

/**
 * 按日期分组消息
 * @param items 消息列表
 * @param getTimestamp 获取时间戳的函数
 */
export function groupMessagesByDate<T>(
  items: T[],
  getTimestamp: (item: T) => number
): MessageGroup<T>[] {
  const groups = new Map<DateLabel, T[]>()

  // 按日期标签分组
  items.forEach(item => {
    const timestamp = getTimestamp(item)
    const label = getDateLabel(timestamp)

    if (!groups.has(label)) {
      groups.set(label, [])
    }
    groups.get(label)!.push(item)
  })

  // 转换为数组并按优先级排序
  const labelOrder: DateLabel[] = ['今天', '昨天', '本周', '本月', '更早']

  return labelOrder
    .filter(label => groups.has(label))
    .map(label => ({
      label,
      items: groups.get(label)!,
    }))
}

/**
 * 获取相对时间描述
 * @param timestamp 时间戳
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return formatDate(timestamp)
  }
}
