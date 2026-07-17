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

export function formatNumber(input: number | null | undefined, locale = 'zh-CN'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return '-'
  return getFormatters(locale).numberFormatter.format(input)
}

export function formatCurrency(input: number | null | undefined, locale = 'zh-CN'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return '-'
  return getFormatters(locale).currencyFormatter.format(input)
}
