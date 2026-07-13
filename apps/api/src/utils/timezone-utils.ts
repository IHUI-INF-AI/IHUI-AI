/**
 * 时区转换工具（bug137）。
 *
 * 内部全部以 UTC（Date）存储，输入支持 ISO 字符串 / naive Date / aware Date / Unix 时间戳，
 * 输出可转换到任意 IANA 时区。正确处理 DST 夏令时跳变。
 *
 * 常用时区：Asia/Shanghai、UTC、America/Los_Angeles 等。
 * 迁移自旧架构 bug137_timezone.py。
 */

import { AppError } from '../errors/AppError.js'

/** 时区错误。 */
export class TZError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INVALID_TIMEZONE')
    this.name = 'TZError'
  }
}

/** 输入类型：Date / ISO 字符串 / Unix 时间戳（秒或毫秒）。 */
export type TimeInput = Date | string | number

/** 常用时区列表。 */
export const COMMON_ZONES: readonly string[] = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Australia/Sydney',
]

/**
 * 带时区的日期时间。
 *
 * JavaScript 的 Date 本身不携带时区（内部始终 UTC），
 * 此接口附加目标时区的墙钟时间组件，用于展示和跨时区比较。
 */
export interface ZonedDateTime {
  /** UTC 时间戳（epoch ms） */
  readonly epochMs: number
  /** IANA 时区名称 */
  readonly timeZone: string
  /** 目标时区的年 */
  readonly year: number
  /** 目标时区的月（1-12） */
  readonly month: number
  /** 目标时区的日（1-31） */
  readonly day: number
  /** 目标时区的小时（0-23） */
  readonly hour: number
  /** 目标时区的分钟（0-59） */
  readonly minute: number
  /** 目标时区的秒（0-59） */
  readonly second: number
  /** 相对 UTC 的偏移（分钟） */
  readonly offsetMinutes: number
  /** 是否处于夏令时 */
  readonly isDst: boolean
}

/** 常见无时区日期格式。 */
const NAIVE_FORMATS = [
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/,
  /^\d{4}\/\d{2}\/\d{2}$/,
] as const

/**
 * 把各种时间值转成 aware UTC Date。
 *
 * - Date → 直接返回副本
 * - 数字 → 视为 Unix 时间戳（秒），转 Date
 * - 字符串 → 解析 ISO 8601（含 Z 后缀）；无时区的视为 UTC
 */
export function toAwareUtc(value: TimeInput): Date {
  if (value === null || value === undefined) {
    return new Date()
  }
  if (value instanceof Date) {
    return new Date(value.getTime())
  }
  if (typeof value === 'number') {
    // 数字：判定是秒还是毫秒
    // 10 位以下视为秒，13 位视为毫秒
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms)
  }
  if (typeof value === 'string') {
    const s = value.trim()
    // 带 Z 后缀的 ISO 字符串
    if (s.endsWith('Z')) {
      const d = new Date(s)
      if (!Number.isNaN(d.getTime())) return d
    }
    // 标准 ISO 解析
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      // 如果字符串无时区信息（如 "2024-01-01T00:00:00"），new Date 按 local 解析
      // 检测是否无时区
      const hasTz = /[+-]\d{2}:?\d{2}$/.test(s) || s.endsWith('Z')
      if (!hasTz) {
        // 无时区：按 UTC 处理
        // 重新解析：Date.UTC 各部分
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/)
        if (m) {
          const [, y, mo, da, h = '0', mi = '0', se = '0'] = m
          return new Date(
            Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se)),
          )
        }
      }
      return d
    }
    // 尝试常见无时区格式
    for (const fmt of NAIVE_FORMATS) {
      if (fmt.test(s)) {
        // 统一用 Date.UTC 解析
        const parts = s.split(/[- :/]/)
        if (parts.length >= 3) {
          const y = Number(parts[0])
          const mo = Number(parts[1])
          const da = Number(parts[2])
          const h = parts.length > 3 ? Number(parts[3]) : 0
          const mi = parts.length > 4 ? Number(parts[4]) : 0
          const se = parts.length > 5 ? Number(parts[5]) : 0
          if (!Number.isNaN(y)) {
            return new Date(Date.UTC(y, mo - 1, da, h, mi, se))
          }
        }
      }
    }
    throw new TZError(`无法解析时间字符串: ${value}`)
  }
  throw new TZError(`不支持的时间类型: ${typeof value}`)
}

/**
 * 使用 Intl.DateTimeFormat 获取目标时区的墙钟时间组件。
 */
function getZonedParts(
  epochMs: number,
  timeZone: string,
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = formatter.formatToParts(new Date(epochMs))
    const map: Record<string, string> = {}
    for (const p of parts) {
      map[p.type] = p.value
    }
    return {
      year: Number(map['year'] ?? '1970'),
      month: Number(map['month'] ?? '1'),
      day: Number(map['day'] ?? '1'),
      hour: Number(map['hour'] === '24' ? '0' : (map['hour'] ?? '0')),
      minute: Number(map['minute'] ?? '0'),
      second: Number(map['second'] ?? '0'),
    }
  } catch {
    throw new TZError(`未知时区: ${timeZone}`)
  }
}

/** 计算目标时区在指定时刻的 UTC 偏移（分钟）。 */
function getOffsetMinutes(epochMs: number, timeZone: string): number {
  const parts = getZonedParts(epochMs, timeZone)
  // 把墙钟时间当作 UTC 来算 epochMs，与原始 epochMs 的差即为偏移
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return Math.round((wallAsUtc - epochMs) / 60000)
}

/** 判断指定时刻在目标时区是否处于夏令时。 */
function computeIsDst(epochMs: number, timeZone: string, offsetMinutes: number): boolean {
  const parts = getZonedParts(epochMs, timeZone)
  // 比较当年 1 月和 7 月的偏移，取较小者为标准偏移（DST 总是增大偏移）
  const janOffset = getOffsetMinutes(Date.UTC(parts.year, 0, 1), timeZone)
  const julOffset = getOffsetMinutes(Date.UTC(parts.year, 6, 1), timeZone)
  const standardOffset = Math.min(janOffset, julOffset)
  return offsetMinutes > standardOffset
}

/**
 * 转换到指定时区的 ZonedDateTime。
 *
 * @param value 时间值
 * @param timeZone IANA 时区名称（如 "Asia/Shanghai"）
 */
export function toZone(value: TimeInput, timeZone: string): ZonedDateTime {
  const epochMs = toAwareUtc(value).getTime()
  const parts = getZonedParts(epochMs, timeZone)
  const offsetMinutes = getOffsetMinutes(epochMs, timeZone)
  const isDst = computeIsDst(epochMs, timeZone, offsetMinutes)
  return {
    epochMs,
    timeZone,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    offsetMinutes,
    isDst,
  }
}

/** 转 Unix 时间戳（秒）。 */
export function toUnix(value: TimeInput): number {
  return Math.floor(toAwareUtc(value).getTime() / 1000)
}

/**
 * 输出目标时区的 ISO 字符串。
 * 格式：YYYY-MM-DDTHH:mm:ss±HH:MM（带时区偏移）。
 */
export function toIso(value: TimeInput, timeZone = 'UTC'): string {
  const zoned = toZone(value, timeZone)
  const sign = zoned.offsetMinutes >= 0 ? '+' : '-'
  const absMin = Math.abs(zoned.offsetMinutes)
  const oh = String(Math.floor(absMin / 60)).padStart(2, '0')
  const om = String(absMin % 60).padStart(2, '0')
  const y = String(zoned.year).padStart(4, '0')
  const mo = String(zoned.month).padStart(2, '0')
  const d = String(zoned.day).padStart(2, '0')
  const h = String(zoned.hour).padStart(2, '0')
  const mi = String(zoned.minute).padStart(2, '0')
  const s = String(zoned.second).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`
}

/**
 * 时间窗口（跨时区比较）。
 *
 * 内部以 UTC 存储 start / end，可与任意时区的时间比较。
 */
export class TimeWindow {
  readonly start: Date
  readonly end: Date
  readonly timeZone: string

  constructor(start: TimeInput, end: TimeInput, timeZone = 'UTC') {
    this.start = toAwareUtc(start)
    this.end = toAwareUtc(end)
    this.timeZone = timeZone
    if (this.start.getTime() > this.end.getTime()) {
      throw new TZError('start 必须早于 end')
    }
  }

  /** 判断某时刻是否在窗口内。 */
  contains(t: TimeInput): boolean {
    const utc = toAwareUtc(t).getTime()
    return this.start.getTime() <= utc && utc <= this.end.getTime()
  }

  /** 判断两个窗口是否有重叠。 */
  overlaps(other: TimeWindow): boolean {
    return (
      this.start.getTime() <= other.end.getTime() && other.start.getTime() <= this.end.getTime()
    )
  }

  /** 窗口时长（秒）。 */
  durationSeconds(): number {
    return (this.end.getTime() - this.start.getTime()) / 1000
  }
}

/**
 * 在指定时区上加时长（秒），自动处理 DST 跳变。
 *
 * 实现方式：加到 UTC 时间戳上（绝对时间），再格式化到目标时区。
 * 这意味着 "加 1 天" = 加 86400 秒，DST 切换时墙钟可能偏移 1 小时。
 */
export function safeAddDuration(dt: TimeInput, seconds: number, timeZone = 'UTC'): ZonedDateTime {
  const base = toAwareUtc(dt)
  const result = new Date(base.getTime() + seconds * 1000)
  return toZone(result, timeZone)
}

/** 判断指定时刻在目标时区是否处于夏令时。 */
export function isInDst(dt: TimeInput, timeZone: string): boolean {
  const epochMs = toAwareUtc(dt).getTime()
  const offset = getOffsetMinutes(epochMs, timeZone)
  return computeIsDst(epochMs, timeZone, offset)
}

/**
 * 时区服务：封装常用转换并统计调用次数。
 */
export class TimezoneService {
  private readonly stats = { convert: 0, cacheHit: 0 }

  convert(value: TimeInput, timeZone = 'UTC'): ZonedDateTime {
    this.stats.convert++
    return toZone(value, timeZone)
  }

  unix(value: TimeInput): number {
    return toUnix(value)
  }

  iso(value: TimeInput, timeZone = 'UTC'): string {
    return toIso(value, timeZone)
  }

  listZones(): readonly string[] {
    return COMMON_ZONES
  }

  inDst(dt: TimeInput, timeZone: string): boolean {
    return isInDst(dt, timeZone)
  }

  getStats(): { convert: number; cacheHit: number } {
    return { ...this.stats }
  }
}
