/**
 * 时间工具函数
 * 迁移自 Ai-WXMiniVue/src/utils/time.js
 * 转换：JS -> TS
 */
import { t } from '@/utils/i18n'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 配置 dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/**
 * 获取当前日期（YYYY-MM-DD）
 */
export function nowDate(): string {
  const date = new Date()
  const y = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${MM}-${d}`
}

/**
 * 将时间戳转换为日期（YYYY-MM-DD）
 */
export function happenTimeFun(num: number): string {
  const date = new Date(num * 1000)
  const y = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${MM}-${d}`
}

/**
 * 将时间戳转换为完整时间（YYYY-MM-DD HH:mm:ss）
 */
export function formatFullTime(num: number): string {
  const date = new Date(num * 1000)
  const y = date.getFullYear()
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${MM}-${d} ${h}:${m}:${s}`
}

/**
 * 将分转换为价格格式（分 -> 元，保留两位小数）
 */
export function formatPrice(cents: number | string | null | undefined): string {
  if (!cents || isNaN(Number(cents))) {
    return '0.00'
  }
  return (Number(cents) / 100).toFixed(2)
}

/**
 * 将日期对象转换为 YYYY-MM-DD 格式
 */
export function getYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 格式化相对时间（如：1分钟前、2小时前、3天前）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp * 1000
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return t('time.justNow')
  } else if (minutes < 60) {
    return t('time.minutesAgo', { minutes })
  } else if (hours < 24) {
    return t('time.hoursAgo', { hours })
  } else if (days < 30) {
    return t('time.daysAgo', { days })
  } else {
    return happenTimeFun(timestamp)
  }
}

/**
 * 格式化时间距离（替代 date-fns 的 formatDistanceToNow）
 * @param time - 时间字符串或 Date 对象
 * @returns 格式化后的相对时间字符串（如：3 分钟前、2 小时前）
 */
export function formatTimeDistance(time: string | Date | number): string {
  try {
    return dayjs(time).fromNow()
  } catch {
    return ''
  }
}
