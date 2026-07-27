/**
 * 日期/数字格式化工具(统一带时区,避免各页面散落 Date.toLocaleString())
 * AGENTS.md §4: 时间用 Intl.DateTimeFormat + 强制 Asia/Shanghai 时区
 */

const DEFAULT_TZ = 'Asia/Shanghai'

export function getFormatters(locale: string) {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const dateOnlyFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const timeOnlyFormatter = new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const numberFormatter = new Intl.NumberFormat(locale)
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
  })

  return { dateFormatter, dateOnlyFormatter, timeOnlyFormatter, numberFormatter, currencyFormatter }
}

export function formatDate(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return '-'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return getFormatters(locale).dateFormatter.format(d)
}

export function formatDateOnly(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return '-'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return getFormatters(locale).dateOnlyFormatter.format(d)
}

export function formatTimeOnly(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return '-'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  return getFormatters(locale).timeOnlyFormatter.format(d)
}

// ---------------------------------------------------------------------------
// 短格式(用于 extension/小程序等紧凑 UI,无年份)
// 空值返回 ''(UI 不展示),与 extension 原 fmtDate 行为一致
// ---------------------------------------------------------------------------

export function formatShortDateTime(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatShortDate(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatShortDateWithYear(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatNumber(input: number | null | undefined, locale = 'zh-CN'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return '-'
  return getFormatters(locale).numberFormatter.format(input)
}

export function formatCurrency(input: number | null | undefined, locale = 'zh-CN'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return '-'
  return getFormatters(locale).currencyFormatter.format(input)
}

// ---------------------------------------------------------------------------
// 相对时间(用于资讯列表/直播/通知等"X 分钟前"场景)
// ---------------------------------------------------------------------------

const RTF_CACHE = new Map<string, Intl.RelativeTimeFormat>()

export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return '-'
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime()
  if (Number.isNaN(then)) return '-'
  let rtf = RTF_CACHE.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    RTF_CACHE.set(locale, rtf)
  }
  const diffSec = Math.round((then - Date.now()) / 1000)
  const absDiff = Math.abs(diffSec)
  if (absDiff < 60) return rtf.format(Math.round(diffSec), 'second')
  if (absDiff < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (absDiff < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (absDiff < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (absDiff < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month')
  return rtf.format(Math.round(diffSec / 31536000), 'year')
}

// ---------------------------------------------------------------------------
// 模板格式化(2026-07-27 立,从 miniapp-taro time.ts 迁移)
// 支持 'YYYY-MM-DD HH:mm:ss' 等模板,底层用 Intl.DateTimeFormat 确保时区正确(AGENTS.md §4)
// ---------------------------------------------------------------------------

/**
 * 按模板格式化日期,底层用 Intl.DateTimeFormat + Asia/Shanghai 时区(AGENTS.md §4)。
 * @param input 日期(Date/timestamp/字符串/null/undefined)
 * @param format 模板,支持 YYYY/MM/DD/HH/mm/ss 占位符,默认 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的字符串,空值返回 '',无效日期返回 ''
 */
export function formatDateByTemplate(
  input: string | number | Date | null | undefined,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  // Intl hour12=false 在某些环境返回 "24",需归一为 "00"
  const hour = map.hour === '24' ? '00' : (map.hour ?? '00')
  return format
    .replace('YYYY', map.year ?? '0000')
    .replace('MM', map.month ?? '00')
    .replace('DD', map.day ?? '00')
    .replace('HH', hour)
    .replace('mm', map.minute ?? '00')
    .replace('ss', map.second ?? '00')
}
