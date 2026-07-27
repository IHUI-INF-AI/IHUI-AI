/**
 * miniapp-taro 端日期/格式化工具(re-export 模式,与 apps/mobile-rn/src/utils/date-utils.ts 对齐)
 * 统一 Asia/Shanghai 时区(AGENTS.md §4),空值返回 ''
 */

// 标准日期格式化函数:re-export 自 @ihui/shared/utils/date-utils(与 mobile-rn 一致)
// 注:shared 的 formatDate(input, locale) 与本文件 formatDate(date, format) 签名不同,
//     本文件保留本地 formatDate 包装(见下),不直接 re-export shared formatDate
export {
  formatDateByTemplate,
  formatDateOnly,
  formatShortDateTime,
  formatShortDate,
  formatShortDateWithYear,
  formatTimeOnly,
  formatRelativeTime,
} from '@ihui/shared/utils/date-utils'

// formatFileSize/formatPrice/formatMoney/formatPhone 复用 @ihui/shared/utils/format(单一来源)
export { formatFileSize, formatPrice, formatMoney, formatPhone } from '@ihui/shared/utils/format'

// formatDate:本地包装,签名 (date, format) 与 shared (input, locale) 不同,保留避免调用方变化
// 底层用 formatDateByTemplate(Asia/Shanghai 时区,AGENTS.md §4)
import { formatDateByTemplate } from '@ihui/shared/utils/date-utils'
export function formatDate(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return formatDateByTemplate(date, format)
}

// relativeTime:legacy 别名,转发到 shared formatRelativeTime(zh-CN)
// 新代码推荐直接使用上方已 re-export 的 formatRelativeTime
import { formatRelativeTime } from '@ihui/shared/utils/date-utils'
export function relativeTime(date: Date | number | string): string {
  return formatRelativeTime(date, 'zh-CN')
}

// 端独占辅助函数(底层复用 formatDate,保持原有行为)
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

export { formatTokenValue } from '@ihui/shared/utils'