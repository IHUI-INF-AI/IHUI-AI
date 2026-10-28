// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 纯 JS 相对时间 fallback(React Native Hermes 引擎无 Intl.RelativeTimeFormat,2026-08-15 立)。
 * 语义对齐 Intl.RelativeTimeFormat zh-CN numeric:'auto' 的常用输出(刚刚 / X 分钟前 / …)。
 */
/**
 * Intl.RelativeTimeFormat 不可用时的兜底。
 * 这里以前只有两个分支:中文 or **英文散文**("just now" / "3 min ago")⇒ 日语/韩语等
 * 所有非中文用户在这条路径上直接看到英文(界面其余部分全是本地语言,读起来就是坏了)。
 * 兜底不该冒充翻译,也不该选一门自然语言当默认:非中文一律退成**语言中性**的紧凑时长
 * (数字 + 单位符号,与 iOS/Android 系统控件同一形态),真正的本地化文案走 Intl 那条主路径。
 */
/**
 * 按**本地时区**取分组键(YYYY-MM / YYYY-MM-DD)。
 *
 * 为什么需要它:三处列表页此前直接 `chat.time.slice(0, 7)` / `slice(0, 10)` 分组,
 * 而 `chat.time` 是后端给的 UTC ISO 串 ⇒ 分桶其实是**按 UTC 切的**。
 * 后果:北京 11-01 00:30 的会话被归进「2026-10」组(UTC 还是 10-31),月末那 8 小时
 * 每天都会归错月份;而 web 侧同一份数据用 `Intl.DateTimeFormat(locale)`(本地时区)分组,
 * 两端把同一条记录挂在不同标题下。取数一律走这里,不在端内 slice 字符串。
 * 解析不出来时返回 null,由调用方决定归到哪一桶(不许拿"今天"冒充)。
 */
function localParts(input: string | number | Date | null | undefined): { y: number; m: number; d: number } | null {
  if (input === null || input === undefined || input === '') return null
  const date = input instanceof Date ? input : new Date(input)
  if (!Number.isFinite(date.getTime())) return null
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() }
}

export function localMonthKey(input: string | number | Date | null | undefined): string | null {
  const p = localParts(input)
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}` : null
}

export function localDayKey(input: string | number | Date | null | undefined): string | null {
  const p = localParts(input)
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : null
}

function relativeTimeFallback(diffSec: number, locale: string): string {
  const zh = locale.toLowerCase().startsWith('zh')
  const abs = Math.abs(diffSec)
  const n = (v: number) => String(Math.round(v))
  const pick = (unit: string): string => {
    if (zh) return `${unit}${diffSec < 0 ? '前' : '后'}`
    return unit
  }
  if (abs < 60) return zh ? '刚刚' : `${n(abs)}s`
  if (abs < 3600) return pick(zh ? `${n(abs / 60)} 分钟` : `${n(abs / 60)}m`)
  if (abs < 86400) return pick(zh ? `${n(abs / 3600)} 小时` : `${n(abs / 3600)}h`)
  if (abs < 2592000) return pick(zh ? `${n(abs / 86400)} 天` : `${n(abs / 86400)}d`)
  if (abs < 31536000) return pick(zh ? `${n(abs / 2592000)} 个月` : `${n(abs / 2592000)}mo`)
  return pick(zh ? `${n(abs / 31536000)} 年` : `${n(abs / 31536000)}y`)
}

export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  locale = 'zh-CN',
): string {
  if (!input) return '-'
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime()
  if (Number.isNaN(then)) return '-'
  const diffSec = Math.round((then - Date.now()) / 1000)
  // Hermes(React Native)不带 Intl.RelativeTimeFormat,直接 new 会抛
  // "undefined cannot be used as a constructor" 导致整屏渲染崩溃(Red Screen)。
  if (typeof Intl.RelativeTimeFormat !== 'function') {
    return relativeTimeFallback(diffSec, locale)
  }
  let rtf = RTF_CACHE.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    RTF_CACHE.set(locale, rtf)
  }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
