/**
 * 日期时间工具函数
 * 提供日期格式化、解析、比较等功能
 */

export type DateFormat = 'date' | 'datetime' | 'time' | 'full' | 'relative'

export interface DateFormatOptions {
  format?: DateFormat
  locale?: string
  showSeconds?: boolean
}

const DEFAULT_LOCALE = 'zh-CN'

export function formatDate(date: Date | string | number, options: DateFormatOptions = {}): string {
  const { format = 'datetime', locale = DEFAULT_LOCALE, showSeconds = false } = options

  const d = toDate(date)
  if (!d) return ''

  switch (format) {
    case 'date':
      return d.toLocaleDateString(locale)
    case 'time':
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })
    case 'datetime':
      return d.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
      })
    case 'full':
      return d.toLocaleString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    case 'relative':
      return formatRelative(d)
    default:
      return d.toLocaleString(locale)
  }
}

export function toDate(date: Date | string | number): Date | null {
  if (!date) return null

  if (date instanceof Date) return date

  if (typeof date === 'number') {
    return new Date(date)
  }

  if (typeof date === 'string') {
    const parsed = new Date(date)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

export function formatRelative(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  if (months < 12) return `${months}个月前`
  return `${years}年前`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}毫秒`

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return `${seconds}秒`
  if (minutes < 60) return `${minutes}分${seconds % 60}秒`
  if (hours < 24) return `${hours}小时${minutes % 60}分`

  return `${days}天${hours % 24}小时`
}

export function isToday(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const today = new Date()
  return d.toDateString() === today.toDateString()
}

export function isYesterday(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.toDateString() === yesterday.toDateString()
}

export function isTomorrow(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.toDateString() === tomorrow.toDateString()
}

export function isThisWeek(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  return d >= startOfWeek && d < endOfWeek
}

export function isThisMonth(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export function isThisYear(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return false

  const now = new Date()
  return d.getFullYear() === now.getFullYear()
}

export function addDays(date: Date | string | number, days: number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

export function addMonths(date: Date | string | number, months: number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  const result = new Date(d)
  result.setMonth(result.getMonth() + months)
  return result
}

export function addYears(date: Date | string | number, years: number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  const result = new Date(d)
  result.setFullYear(result.getFullYear() + years)
  return result
}

export function startOfDay(date: Date | string | number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}

export function endOfDay(date: Date | string | number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  const result = new Date(d)
  result.setHours(23, 59, 59, 999)
  return result
}

export function startOfMonth(date: Date | string | number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(date: Date | string | number): Date {
  const d = toDate(date)
  if (!d) return new Date()

  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function diffInDays(date1: Date | string | number, date2: Date | string | number): number {
  const d1 = toDate(date1)
  const d2 = toDate(date2)

  if (!d1 || !d2) return 0

  const diff = d1.getTime() - d2.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function diffInHours(date1: Date | string | number, date2: Date | string | number): number {
  const d1 = toDate(date1)
  const d2 = toDate(date2)

  if (!d1 || !d2) return 0

  const diff = d1.getTime() - d2.getTime()
  return Math.floor(diff / (1000 * 60 * 60))
}

export function diffInMinutes(date1: Date | string | number, date2: Date | string | number): number {
  const d1 = toDate(date1)
  const d2 = toDate(date2)

  if (!d1 || !d2) return 0

  const diff = d1.getTime() - d2.getTime()
  return Math.floor(diff / (1000 * 60))
}

export function isExpired(date: Date | string | number): boolean {
  const d = toDate(date)
  if (!d) return true

  return d.getTime() < Date.now()
}

export function isExpiringSoon(date: Date | string | number, days: number = 7): boolean {
  const d = toDate(date)
  if (!d) return false

  const threshold = Date.now() + days * 24 * 60 * 60 * 1000
  return d.getTime() < threshold
}

export function useDateTime() {
  return {
    formatDate,
    toDate,
    formatRelative,
    formatDuration,
    isToday,
    isYesterday,
    isTomorrow,
    isThisWeek,
    isThisMonth,
    isThisYear,
    addDays,
    addMonths,
    addYears,
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    diffInDays,
    diffInHours,
    diffInMinutes,
    isExpired,
    isExpiringSoon,
  }
}

export default {
  formatDate,
  toDate,
  formatRelative,
  formatDuration,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  isThisYear,
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  diffInDays,
  diffInHours,
  diffInMinutes,
  isExpired,
  isExpiringSoon,
}
