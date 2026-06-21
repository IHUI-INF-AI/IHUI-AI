/**
 * 开放平台格式化工具
 * 提供日期、时间、文件大小等格式化功能
 */

import { formatRelativeTime as baseFormatRelativeTime } from '@/utils/time-utils'
import dayjs from 'dayjs'

/**
 * 格式化日期（仅日期部分）
 */
export function formatDate(date: Date | string, locale: string = 'zh-CN'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return ''
  }
  
  dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en')
  return dayjs(d).format('YYYY-MM-DD')
}

/**
 * 格式化日期时间（包含日期和时间）
 */
export function formatDateTime(date: Date | string, locale: string = 'zh-CN'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) {
    return ''
  }
  
  dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en')
  return dayjs(d).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * 格式化相对时间（如：刚刚、1分钟前、2小时前等）
 */
export function formatRelativeTime(date: Date | string | number): string {
  let timestamp: number
  if (typeof date === 'string') {
    timestamp = new Date(date).getTime() / 1000
  } else if (date instanceof Date) {
    timestamp = date.getTime() / 1000
  } else {
    timestamp = date
  }
  return baseFormatRelativeTime(timestamp)
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 格式化数字（添加千位分隔符）
 */
export function formatNumber(num: number, locale: string = 'zh-CN'): string {
  return new Intl.NumberFormat(locale).format(num)
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return (value * 100).toFixed(decimals) + '%'
}

/**
 * 格式化货币
 */
export function formatCurrency(
  amount: number,
  currency: string = 'CNY',
  locale: string = 'zh-CN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}
