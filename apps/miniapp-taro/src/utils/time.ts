// formatFileSize/formatPrice/formatMoney/formatPhone 复用 @ihui/shared/utils/format(单一来源)
export { formatFileSize, formatPrice, formatMoney, formatPhone } from '@ihui/shared/utils/format'

// formatDate 复用 @ihui/shared/utils/date-utils 的 formatDateByTemplate(单一来源)
// 底层用 Intl.DateTimeFormat + Asia/Shanghai 时区(AGENTS.md §4),保持 format 模板签名不变
import { formatDateByTemplate } from '@ihui/shared/utils/date-utils'
export function formatDate(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return formatDateByTemplate(date, format)
}

// relativeTime 复用 @ihui/shared/utils/date-utils 的 formatRelativeTime(单一来源)
// 底层用 Intl.RelativeTimeFormat(zh-CN),输出 "3分钟前" 等标准格式
import { formatRelativeTime } from '@ihui/shared/utils/date-utils'
export function relativeTime(date: Date | number | string): string {
  return formatRelativeTime(date, 'zh-CN')
}

export function nowDate(): string {
  return formatDate(new Date(), 'YYYY-MM-DD')
}

export function happenTimeFun(timestamp: number): string {
  return formatDate(new Date(timestamp * 1000), 'YYYY-MM-DD')
}

export function formatFullTime(timestamp: number): string {
  return formatDate(new Date(timestamp * 1000), 'YYYY-MM-DD HH:mm:ss')
}

export function getYMD(date: Date): string {
  return formatDate(date, 'YYYY-MM-DD')
}

export function formatTokenValue(value: number | string): string {
  if (!value) return '0'
  const num = parseInt(String(value), 10)
  if (num >= 10000) {
    const truncated = Math.floor((num / 10000) * 100) / 100
    return `${truncated}万`
  }
  return num.toString()
}
